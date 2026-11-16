/* audio.js : toute la gestion du son passe par ce module.
   Le reste du code n'appelle jamais Howler directement : si la librairie
   audio change, seul ce fichier est à réécrire.

   Depuis S#2-01, la musique de fond est une BOUCLE INDÉPENDANTE de la
   timeline : elle part au premier « Lecture », continue pendant l'arrêt de
   fin de double page, et ne suit jamais le temps t (ni seek, ni correction
   de dérive). Les fonctions de transport de main.js la lancent (play) et la
   mettent en pause (pause). Les effets courts, eux, restent posés sur la
   timeline par timeline.call() (sfx).

   Voix (S#2-02) : une par bloc de texte qui a « voice: true », lancée à son
   apparition par timeline.call() (voice), puis indépendante de la timeline
   comme la musique : pause et reprise avec la lecture, arrêt à chaque saut.

   Les sons de démonstration sont synthétisés ici puis encodés en WAV.
   Dans le vrai projet, remplacer les deux appels à toDataUri() par les
   fichiers fournis : src: ['sounds/bgm/musique.webm', 'sounds/bgm/musique.mp3']. */
(function () {
  const D = window.Demo;
  const SR = 22050;
  const VOLUME = 0.15;

  /* ---------- synthèse des sons de démonstration ---------- */

  function synthMusic(duration) {
    const n = Math.floor(duration * SR);
    const out = new Float32Array(n);
    const chords = [
      [220.00, 261.63, 329.63],  // la mineur : la nuit
      [174.61, 220.00, 261.63],  // fa
      [196.00, 246.94, 293.66],  // sol
      [261.63, 329.63, 392.00]   // do majeur : l'aube
    ];
    const seg = duration / chords.length;
    const step = seg / 8;
    const rand = D.prng(7);
    const TAU = Math.PI * 2;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const ci = Math.min(chords.length - 1, Math.floor(t / seg));
      const local = t - ci * seg;
      const chord = chords[ci];
      const env = Math.max(0, Math.min(1, local / 0.9, (seg - local) / 0.9));
      let pad = 0;
      for (let k = 0; k < 3; k++) {
        const f = chord[k];
        pad += Math.sin(TAU * f * t) * 0.5 + Math.sin(TAU * f * 2.004 * t) * 0.14 + Math.sin(TAU * f * 0.5 * t) * 0.28;
      }
      pad *= env * (0.85 + 0.15 * Math.sin(TAU * 0.25 * t)) * 0.16;
      const si = Math.floor(local / step);
      const nt = local - si * step;
      const pf = chord[[0, 1, 2, 1][si % 4]] * 2;
      const pluck = Math.sin(TAU * pf * nt) * Math.exp(-nt * 5.5) * Math.min(1, nt / 0.004) * (0.09 + 0.03 * ci);
      lp += 0.035 * ((rand() * 2 - 1) - lp);            // bruit filtré : le ressac
      const sea = lp * (0.5 + 0.5 * Math.sin(TAU * 0.13 * t)) * 1.1;
      const master = Math.min(1, t / 0.5, (duration - t) / 1.5);
      out[i] = (pad + pluck + sea) * master;
    }
    return normalize(out, 0.8);
  }

  function synthBell() {
    const n = Math.floor(1.4 * SR);
    const out = new Float32Array(n);
    const partials = [[660, 1, 3.2], [1320, 0.45, 4.5], [1987, 0.25, 6], [2640, 0.12, 8]];
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      for (const p of partials) v += Math.sin(Math.PI * 2 * p[0] * t) * p[1] * Math.exp(-t * p[2]);
      out[i] = v * Math.min(1, t / 0.003);
    }
    return normalize(out, 0.7);
  }

  /* Froissement de papier : un souffle de bruit filtré qui monte puis retombe. */
  function synthPage() {
    const n = Math.floor(0.55 * SR);
    const out = new Float32Array(n);
    const rand = D.prng(11);
    let lp = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const white = rand() * 2 - 1;
      lp += 0.5 * (white - lp);                    // adoucit le bruit
      const hp = lp - prev;                        // enlève les graves
      prev = lp;
      const env = Math.pow(Math.sin(Math.PI * Math.pow(k, 0.6)), 2);
      out[i] = hp * env * (0.7 + 0.3 * Math.sin(k * 40));
    }
    return normalize(out, 0.6);
  }

  function normalize(buf, peak) {
    let max = 0;
    for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
    const k = max > 0 ? peak / max : 1;
    for (let i = 0; i < buf.length; i++) buf[i] *= k;
    return buf;
  }

  function toDataUri(samples) {
    const bytes = new Uint8Array(44 + samples.length * 2);
    const v = new DataView(bytes.buffer);
    const ascii = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ascii(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); ascii(8, 'WAVE');
    ascii(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ascii(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  /* ---------- interface publique ---------- */

  let music = null;
  let musicId = null;
  const bank = {};          // effets courts, par clé : { bell: Howl, page: Howl }
  const voices = {};        // voix chargées, par chemin de fichier (une Howl chacune, créée au premier usage)
  let cur = null;           // voix en cours : { howl, id, paused } ; une seule à la fois

  D.audio = {
    locked: false, // vrai pendant l'export PDF : aucun son ne doit partir

    /* Clés que ce module sait jouer. Donnée pure, lue par spreads.checks()
       pour contrôler les pointeurs de la configuration (config.bgm, sfx des
       doubles pages). Toute nouvelle clé s'ajoute ici ET dans init(). */
    sounds: { music: ['musique'], sfx: ['bell', 'page'] },

    init() {
      //music = new Howl({ src: 'sounds/bgm/musique.mp3', format: ['mp3'], volume: VOLUME, loop: true });
      //bank.bell = new Howl({ src: [toDataUri(synthBell())], format: ['wav'], volume: 0.45 });
      bank.page = new Howl({ src: [toDataUri(synthPage())], format: ['wav'], volume: 0.1 });
    },

    /* Lance la musique (la première fois) ou la reprend là où elle s'était
       arrêtée. Sans effet si elle joue déjà : appeler play() deux fois ne la
       relance pas depuis le début. */
    play() {
      if (this.locked || !music) return;
      if (musicId === null) musicId = music.play();
      else if (music.playing(musicId)) return;
      else music.play(musicId);
      music.fade(0, VOLUME, 120, musicId); // évite le clic au démarrage et à la reprise
    },

    pause() {
      if (music && musicId !== null) music.pause(musicId);
    },

    mute(on) { Howler.mute(on); },

    /* ---------- voix (S#2-02) ---------- */

    /* Fichier de la voix d'un bloc : celui de la table config.voices[<langue>][<clé>]
       s'il y en a un (ex. sounds/va/en/2a_Blueprints.wav), sinon le nom par défaut
       sounds/va/<langue>/<clé du bloc>.mp3. */
    voicePath(lang, key) {
      const table = D.config.voices && D.config.voices[lang];
      const file = table && table[key];
      return 'sounds/va/' + lang + '/' + (file || key + '.mp3');
    },

    /* Lit la voix du bloc « key » dans la langue « lang ». Appelé par un
       tl.call posé à l'apparition du bloc (timeline.js) ; la voix joue ensuite
       seule, sans suivre le temps t. Une seule voix à la fois : la nouvelle
       remplace la précédente. Fichier absent : un avertissement, rien d'autre. */
    voice(key, lang) {
      if (this.locked) return;
      this.stopVoice();
      const src = this.voicePath(lang, key);
      if (!voices[src]) {
        voices[src] = new Howl({
          src: [src], format: [src.split('.').pop().toLowerCase()], volume: 1,   // mp3 ou wav, d'après l'extension
          onloaderror: function () { console.warn('Voix introuvable : ' + src + '.'); }
        });
      }
      const howl = voices[src];
      const id = howl.play();
      const me = { howl: howl, id: id, paused: false };
      cur = me;
      howl.once('end', function () { if (cur === me) cur = null; }, id);   // finie : plus rien à reprendre
    },

    /* Pause de la lecture : la voix en cours se met en pause… */
    pauseVoice() {
      if (cur && !cur.paused) { cur.howl.pause(cur.id); cur.paused = true; }
    },

    /* …et reprend avec la lecture. Sans effet s'il n'y a pas de voix en pause. */
    resumeVoice() {
      if (this.locked || !cur || !cur.paused) return;
      cur.paused = false;
      cur.howl.play(cur.id);
    },

    /* Saut, changement de langue, export : la voix s'arrête. */
    stopVoice() {
      if (cur) { cur.howl.stop(cur.id); cur = null; }
    },

    /* Effets courts, déclenchés par timeline.call(). Clé inconnue : rien
       (elle est signalée au chargement par spreads.checks). */
    sfx(name) {
      if (this.locked) return;
      if (bank[name]) bank[name].play();
    }
  };
})();
