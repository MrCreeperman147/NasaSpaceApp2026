/* spreads.js : le livre en doubles pages, en fonctions pures (aucun appel à
   PixiJS, GSAP, Howler ni au navigateur). Testé sous Node (tests/spreads.test.js).

   La configuration décrit chaque double page en temps LOCAL (secondes depuis
   son début) et par sa durée. compile() en tire les temps GLOBAUX de la
   timeline : début et fin de chaque double page, moments clés, durée totale,
   et la plage de temps de chaque animation. Allonger une double page décale
   donc les suivantes sans toucher à leurs moments.

   Le tournage qui mène à une double page occupe la dernière seconde (durée
   du tournage) de la précédente et finit pile au début de la nouvelle.

   À la fin du fichier, Demo.book est compilé une fois pour toutes à partir
   de Demo.config : c'est lui que lisent les autres modules. */
(function () {
  const D = window.Demo;

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  const ID = /^[A-Za-z0-9_-]+$/;   // identifiant de page : il entre dans des noms de fichiers et des clés pointées

  D.spreads = {
    /* Valeurs par défaut des pages (S#2-02), dérivées de l'identifiant, pour
       qu'une page copiée-collée ne demande que de changer son « id » :
         duration  : config.ui.pageDuration
         bg        : l'id, sauf si la page a une couleur (bgColor) ou écrit « bg »
         animation : null ; sfx : [] ; blocks : []
         blocks[n] : key = « <id>.t<n+1> », voice = false
         moments   : un seul, au début, capturé à l'instant où la lecture
                     s'arrête (fin − tournage − nextLead ; dernière page :
                     fin − nextLead, elle n'a pas de tournage de sortie).
       Rend une nouvelle liste : la configuration n'est pas modifiée. */
    normalize(list, config) {
      const flip = config.flip.duration, lead = config.ui.nextLead;
      return list.map(function (s, i) {
        const o = Object.assign({}, s);
        if (!isNum(o.duration)) o.duration = config.ui.pageDuration;
        if (o.bg === undefined) o.bg = o.bgColor ? null : o.id;
        if (o.animation === undefined) o.animation = null;
        o.sfx = (s.sfx || []).map(function (e) { return Object.assign({}, e); });
        o.blocks = (s.blocks || []).map(function (b, j) {
          const c = Object.assign({}, b);
          if (c.key === undefined) c.key = s.id + '.t' + (j + 1);
          if (c.voice === undefined) c.voice = false;
          return c;
        });
        if (s.moments) o.moments = s.moments.map(function (m) { return Object.assign({}, m); });
        else {
          const end = i < list.length - 1 ? o.duration - flip : o.duration;
          o.moments = [{ start: 0, capture: Math.round((end - lead) * 1e6) / 1e6 }];
        }
        return o;
      });
    },

    /* Temps globaux du livre.
       spreads : D.config.spreads ; flipDur : durée d'un tournage.
       Retourne {
         spreads    : copies des doubles pages, avec index, start, end (globaux)
         keyMoments : [{ id, spread, start, t }] en temps global, dans l'ordre
                      (t = instant capturé pour le PDF)
         animations : { clé: { from, to } } plage globale de chaque animation
         duration   : durée totale de la timeline
       } */
    compile(spreads, flipDur) {
      const out = { spreads: [], keyMoments: [], animations: {}, duration: 0 };
      let start = 0;
      spreads.forEach(function (s, i) {
        const d = isNum(s.duration) ? s.duration : 0;
        const c = Object.assign({}, s, { index: i, start: start, end: start + d });
        out.spreads.push(c);
        (s.moments || []).forEach(function (m, j) {
          out.keyMoments.push({ id: s.id + '.m' + (j + 1), spread: i, start: start + m.start, t: start + m.capture });
        });
        if (s.animation) {
          const a = out.animations[s.animation];
          if (!a) out.animations[s.animation] = { from: start, to: start + d };
          else a.to = start + d;
        }
        start += d;
      });
      out.duration = start;
      out.flipDuration = flipDur;
      return out;
    },

    /* Temps local de la double page à l'instant global t (borné à 0 : une
       double page pas encore commencée est à son début). */
    localTime(spread, t) { return Math.max(0, t - spread.start); },

    /* Temps d'une animation à l'instant global t : compté depuis le début de
       la première double page qui l'utilise (borné à 0). */
    animTime(book, key, t) {
      const a = book.animations[key];
      return a ? Math.max(0, t - a.from) : 0;
    },

    /* Arrêts de la lecture (S#2-01) : la lecture s'arrête d'elle-même à la fin
       de chaque double page, juste avant le tournage qui la termine, et reste
       sur cette image ; c'est le lecteur qui tourne la page. La dernière
       double page n'a pas d'arrêt : elle finit avec la timeline.
       L'arrêt est à « début du tournage − lead » (ui.nextLead) : l'instant même
       que vise Suiv. (nav.nextTarget). Suiv. depuis l'arrêt repart donc de
       l'arrêt sans s'y reprendre, et ne saute jamais par-dessus.
       Rend [{ spread, t }] en temps global, dans l'ordre. Rien à écrire dans
       la configuration : tout découle des durées. Posés par timeline.js. */
    holds(book, lead) {
      const out = [];
      const sp = book.spreads;
      for (let i = 0; i < sp.length - 1; i++) {
        out.push({ spread: i, t: Math.max(0, sp[i + 1].start - book.flipDuration - lead) });
      }
      return out;
    },

    /* Numéros de page (S#2-02) : [{ first, last }] par double page, dans
       l'ordre. Une couverture ou une quatrième compte une page, une double
       page deux. Couverture : 1 ; double page suivante : 2-3… */
    pages(book) {
      let n = 0;
      return book.spreads.map(function (s) {
        const k = s.kind === 'cover' || s.kind === 'back' ? 1 : 2;
        const r = { first: n + 1, last: n + k };
        n += k;
        return r;
      });
    },

    /* Pages affichées de la double page i : { first, last, total }.
       side : 'left' ou 'right' (vue page, reader.shownPage), null : les deux. */
    pagesShown(book, i, side) {
      const all = this.pages(book);
      const p = all[i];
      const total = all[all.length - 1].last;
      if (p.first === p.last || !side) return { first: p.first, last: p.last, total: total };
      const n = side === 'left' ? p.first : p.last;
      return { first: n, last: n, total: total };
    },

    /* Rectangle de la scène que remplit l'image (ou l'aplat) d'une page :
       la moitié droite pour la couverture, la gauche pour la quatrième, toute
       la scène pour une double page. */
    bgRect(def, W, H) {
      if (def.kind === 'cover') return { x: W / 2, y: 0, w: W / 2, h: H };
      if (def.kind === 'back') return { x: 0, y: 0, w: W / 2, h: H };
      return { x: 0, y: 0, w: W, h: H };
    },

    /* Couleur de la palette d'une page sans image : la sienne (bgColor), sinon
       l'aplat de repli (ui.bgFallback) : image absente ou illisible. */
    plainColor(def, ui) { return def.bgColor || ui.bgFallback; },

    /* Opacité d'un fondu d'entrée : 0 avant « at », 1 après at + dur. */
    fade(u, at, dur) {
      if (u < at) return 0;
      // À la fin exacte du fondu, 1 pile : (u - at) / dur peut donner 0,9999999999999998
      // (arithmétique flottante), et une capture à at + dur doit montrer un texte opaque.
      if (!(dur > 0) || u >= at + dur) return 1;
      return (u - at) / dur;
    },

    /* Problèmes de configuration, sous forme de messages (liste vide = tout va bien).
       Complète nav.checks (moments et tournages) et flip.conflicts.
       deps : ce que les autres modules savent résoudre, passé en paramètre
       pour que ce contrôle reste pur :
         animations : clés connues de Demo.animations
         sfx, music : clés connues du module audio
         palette    : D.config.palette
         texts      : D.texts ({ fr, en }) */
    checks(config, book, deps) {
      const out = [];
      const list = book.spreads || [];
      const flipDur = config.flip ? config.flip.duration : 0;
      const seen = {};
      if (!list.length) out.push('Le livre ne contient aucune double page.');

      list.forEach(function (s, i) {
        const name = 'La double page « ' + s.id + ' »';
        if (!s.id) out.push('La double page ' + (i + 1) + ' n’a pas d’identifiant.');
        else if (!ID.test(s.id)) out.push('L’identifiant « ' + s.id + ' » est mal formé : lettres, chiffres, « - » ou « _ » seulement.');
        else if (seen[s.id]) out.push('L’identifiant « ' + s.id + ' » est utilisé deux fois.');
        seen[s.id] = true;

        if (s.kind && s.kind !== 'spread' && s.kind !== 'cover' && s.kind !== 'back') out.push(name + ' a un type inconnu : ' + s.kind + '.');
        if (s.kind === 'cover' && i !== 0) out.push(name + ' est une couverture, mais n’est pas en premier.');
        if (s.kind === 'back' && i !== list.length - 1) out.push(name + ' est une quatrième de couverture, mais n’est pas en dernier.');

        if (!isNum(s.duration) || s.duration <= 0) out.push(name + ' n’a pas de durée valide.');
        else if (i < list.length - 1 && s.duration <= flipDur) {
          out.push(name + ' dure moins que le tournage qui la termine (' + flipDur + ' s).');
        }

        if (!s.bg && !(deps.palette && deps.palette[s.bgColor])) {
          out.push(name + ' n’a ni fond ni couleur de la palette.');
        }
        if (s.animation && deps.animations.indexOf(s.animation) < 0) {
          out.push(name + ' pointe vers une animation inconnue : ' + s.animation + '.');
        }
        (s.sfx || []).forEach(function (e) {
          if (deps.sfx.indexOf(e.key) < 0) out.push(name + ' pointe vers un effet sonore inconnu : ' + e.key + '.');
          if (!isNum(e.u) || e.u < 0 || e.u >= s.duration) out.push(name + ' : l’effet « ' + e.key + ' » est hors de la double page.');
        });
        (s.moments || []).forEach(function (m, j) {
          const label = name + ', moment ' + (j + 1);
          if (!isNum(m.start) || m.start < 0 || m.start >= s.duration) out.push(label + ' : son début est hors de la double page.');
          if (!isNum(m.capture) || m.capture < 0 || m.capture >= s.duration) out.push(label + ' : son instant capturé est hors de la double page.');
          else if (isNum(m.start) && m.capture < m.start) out.push(label + ' : son instant capturé précède son début.');
        });
      });

      // Une animation partagée doit servir à des doubles pages qui se suivent.
      Object.keys(book.animations).forEach(function (key) {
        const users = book.spreads.filter(function (s) { return s.animation === key; }).map(function (s) { return s.index; });
        for (let k = 1; k < users.length; k++) {
          if (users[k] !== users[k - 1] + 1) {
            out.push('L’animation « ' + key + ' » sert à des doubles pages qui ne se suivent pas.');
            break;
          }
        }
      });

      if (config.bgm && deps.music.indexOf(config.bgm) < 0) out.push('Musique de fond inconnue : ' + config.bgm + '.');

      // Titre des moments : facultatif depuis S#2-02 (absent, l'en-tête reste vide).
      return out;
    }
  };

  // Le livre de js/book.js, complété par les valeurs par défaut.
  D.book = D.spreads.compile(D.spreads.normalize(D.config.spreads, D.config), D.config.flip.duration);
})();
