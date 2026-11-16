/* Tests de S#2-02 : gabarits de pages, valeurs par défaut, numéros de page,
   voix, textes du livre, et le livre de 16 pages livré.
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const LIVRE = ['js/config.js', 'js/book.js', 'js/spreads.js', 'js/blocks.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js',
  'ts/fr/book.js', 'ts/en/book.js', 'js/flip.js', 'js/nav.js', 'js/reader.js', 'js/audio.js', 'js/export.js'];
const D = charger(LIVRE);
const C = D.config, S = D.spreads, B = D.book;
const json = function (v) { return JSON.parse(JSON.stringify(v)); };

/* Tous les contrôles de configuration que main.js affiche en console, sauf
   ceux qui demandent la scène (débordement des textes). */
function controles(Dx) {
  const flips = Dx.flip.plan(Dx.book.spreads, Dx.config.flip.duration);
  return [].concat(
    Dx.spreads.checks(Dx.config, Dx.book, {
      animations: ['spaceship', 'drop', 'oppy_dp09', 'discovery', 'asteroid'], sfx: Dx.audio.sounds.sfx, music: Dx.audio.sounds.music,
      palette: Dx.config.palette, texts: Dx.texts
    }),
    Dx.flip.conflicts(flips, Dx.book.keyMoments, Dx.book.duration),
    Dx.nav.checks(Dx.book, flips),
    Dx.blocks.checks(Dx.config, Dx.book, Dx.texts),
    Dx.lang.missing(Dx.texts),
    Dx.lang.problems
  );
}

/* ---------- P2 : valeurs par défaut dérivées de l'identifiant ---------- */

const CONF = { flip: { duration: 1 }, ui: { nextLead: 0.05, pageDuration: 4 } };

test('normalize : sans bgColor, le fond est l’identifiant ; avec bgColor, pas d’image ; un bg écrit est gardé', function () {
  const n = S.normalize([
    { id: 'dp04' },
    { id: 'dp05', bgColor: 'nuit' },
    { id: 'dp06', bg: 'autre' },
    { id: 'dp07', bg: null }
  ], CONF);
  assert.equal(n[0].bg, 'dp04');
  assert.equal(n[1].bg, null);
  assert.equal(n[1].bgColor, 'nuit');
  assert.equal(n[2].bg, 'autre');
  assert.equal(n[3].bg, null);       // bg: null écrit à la main : pas d'image
});

test('normalize : clé d’un bloc = <id>.t<n> dans l’ordre ; une clé écrite est gardée ; voice faux par défaut', function () {
  const n = S.normalize([{ id: 'dp09', blocks: [{ page: 'left' }, { page: 'right', key: 'special', voice: true }, { page: 'right' }] }], CONF);
  assert.deepEqual(n[0].blocks.map(function (b) { return b.key; }), ['dp09.t1', 'special', 'dp09.t3']);
  assert.deepEqual(n[0].blocks.map(function (b) { return b.voice; }), [false, true, false]);
});

test('normalize : durée, animation, effets et moment par défaut', function () {
  const n = S.normalize([{ id: 'a' }, { id: 'b', duration: 6 }, { id: 'c' }], CONF);
  assert.equal(n[0].duration, 4);
  assert.equal(n[1].duration, 6);
  assert.equal(n[0].animation, null);
  assert.deepEqual(n[0].sfx, []);
  // Un seul moment, au début, capturé à l'instant de l'arrêt de la page (fin − tournage − nextLead)…
  assert.deepEqual(json(n[0].moments), [{ start: 0, capture: 2.95 }]);
  assert.deepEqual(json(n[1].moments), [{ start: 0, capture: 4.95 }]);
  // …et pour la dernière page, qui n'a pas de tournage de sortie : fin − nextLead.
  assert.deepEqual(json(n[2].moments), [{ start: 0, capture: 3.95 }]);
});

test('normalize : une page complète est gardée telle quelle, et la liste d’entrée n’est pas modifiée', function () {
  const entree = [{ id: 'x', duration: 5, bg: 'y', animation: 'z', sfx: [{ u: 1, key: 'bell' }], moments: [{ start: 1, capture: 2 }],
    blocks: [{ key: 'x.t1', page: 'left', voice: true }] }];
  const avant = JSON.stringify(entree);
  const n = S.normalize(entree, CONF);
  assert.equal(JSON.stringify(entree), avant);
  assert.notStrictEqual(n[0], entree[0]);
  assert.notStrictEqual(n[0].blocks[0], entree[0].blocks[0]);
  assert.equal(n[0].bg, 'y');
  assert.equal(n[0].animation, 'z');
  assert.deepEqual(json(n[0].moments), [{ start: 1, capture: 2 }]);
  assert.deepEqual(json(n[0].sfx), [{ u: 1, key: 'bell' }]);
});

test('normalize puis compile puis holds (enchaînement) : le moment par défaut est capturé pile à l’arrêt de sa page', function () {
  const n = S.normalize([{ id: 'cover', kind: 'cover', bgColor: 'nuit' }, { id: 'p1' }, { id: 'p2', duration: 5 }, { id: 'fin', kind: 'back', bgColor: 'nuit' }], CONF);
  const b = S.compile(n, 1);
  const holds = S.holds(b, 0.05);
  holds.forEach(function (h) {
    const km = b.keyMoments.filter(function (k) { return k.spread === h.spread; })[0];
    assert.ok(Math.abs(km.t - h.t) < 1e-9, 'page ' + h.spread);
  });
});

/* ---------- P6 : numéros de page ---------- */

// Livre livré : couverture, NB doubles pages, quatrième ; TOTAL pages imprimées.
const NB = B.spreads.length - 2, TOTAL = 2 * NB + 2;

test('pages : couverture 1, double page k → 2k et 2k+1, quatrième = dernière page', function () {
  const p = json(S.pages(B));
  assert.deepEqual(p[0], { first: 1, last: 1 });
  for (let k = 1; k <= NB; k++) assert.deepEqual(p[k], { first: 2 * k, last: 2 * k + 1 });
  assert.deepEqual(p[NB + 1], { first: TOTAL, last: TOTAL });
  assert.equal(p.length, NB + 2);
});

test('pages : un livre sans couverture commence à 1 sur une double page', function () {
  const b = S.compile(S.normalize([{ id: 'a' }, { id: 'b' }], CONF), 1);
  assert.deepEqual(json(S.pages(b)), [{ first: 1, last: 2 }, { first: 3, last: 4 }]);
});

test('pagesShown : selon le côté affiché (vue page) ou les deux (vue double page)', function () {
  assert.deepEqual(json(S.pagesShown(B, 2, 'left')), { first: 4, last: 4, total: TOTAL });
  assert.deepEqual(json(S.pagesShown(B, 2, 'right')), { first: 5, last: 5, total: TOTAL });
  assert.deepEqual(json(S.pagesShown(B, 2, null)), { first: 4, last: 5, total: TOTAL });
  assert.deepEqual(json(S.pagesShown(B, 0, 'right')), { first: 1, last: 1, total: TOTAL });
  assert.deepEqual(json(S.pagesShown(B, 0, null)), { first: 1, last: 1, total: TOTAL });
  assert.deepEqual(json(S.pagesShown(B, NB + 1, 'left')), { first: TOTAL, last: TOTAL, total: TOTAL });
});

test('pagesShown enchaîné avec reader.shownPage : vue page, côté droit de dp01 → page 3 ; couverture → page 1', function () {
  let r = D.reader.init(null, 400, C.ui);              // écran étroit : vue page
  assert.equal(r.mode, 'page');
  r = D.reader.setSide(r, 'right', 1);
  assert.equal(S.pagesShown(B, 1, D.reader.shownPage(r, B.spreads[1], 1)).first, 3);
  assert.equal(S.pagesShown(B, 0, D.reader.shownPage(r, B.spreads[0], 0)).first, 1);
  const r2 = D.reader.init(null, 1400, C.ui);          // écran large : double page
  assert.deepEqual(json(S.pagesShown(B, 1, D.reader.shownPage(r2, B.spreads[1], 1))), { first: 2, last: 3, total: TOTAL });
});

test('textes : numéro de page dans les deux langues', function () {
  ['fr', 'en'].forEach(function (c) {
    D.lang.set(c, null);
    assert.equal(D.lang.get('pageOne', { n: 3, total: 16 }), 'Page 3 / 16');
    assert.equal(D.lang.get('pageRange', { a: 2, b: 3, total: 16 }), 'Pages 2-3 / 16');
  });
  D.lang.set('fr', null);
});

/* ---------- P8, P9 : image d'une page seule, aplat de repli ---------- */

test('bgRect : la couverture remplit la page droite, la quatrième la page gauche, une double page tout', function () {
  assert.deepEqual(json(S.bgRect({ kind: 'cover' }, 1280, 720)), { x: 640, y: 0, w: 640, h: 720 });
  assert.deepEqual(json(S.bgRect({ kind: 'back' }, 1280, 720)), { x: 0, y: 0, w: 640, h: 720 });
  assert.deepEqual(json(S.bgRect({}, 1280, 720)), { x: 0, y: 0, w: 1280, h: 720 });
  assert.deepEqual(json(S.bgRect({ kind: 'spread' }, 1280, 720)), { x: 0, y: 0, w: 1280, h: 720 });
});

test('plainColor : la couleur de la page, sinon l’aplat de repli (ui.bgFallback)', function () {
  assert.equal(S.plainColor({ bgColor: 'brun' }, C.ui), 'brun');
  assert.equal(S.plainColor({ bg: 'dp99' }, C.ui), C.ui.bgFallback);
  assert.ok(C.palette[C.ui.bgFallback], 'ui.bgFallback est une couleur de la palette');
});

/* ---------- P3 : textes du livre par page ---------- */

test('lang.book : m<n> → titre de moment, t<n> → texte de bloc, clé inconnue signalée', function () {
  const Dx = charger(['js/config.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js']);
  Dx.lang.book('fr', { dp42: { m1: 'Titre', t1: 'Un', t2: 'Deux', x9: 'faux' } });
  assert.deepEqual(json(Dx.texts.fr.moments['dp42.m1']), { title: 'Titre' });
  assert.equal(Dx.texts.fr.blocks['dp42.t1'], 'Un');
  assert.equal(Dx.texts.fr.blocks['dp42.t2'], 'Deux');
  assert.equal(Dx.lang.problems.length, 1);
  assert.match(Dx.lang.problems[0], /dp42.*x9/);
});

test('lang : titre de moment facultatif (absent → titre vide, aucun contrôle ne le réclame)', function () {
  assert.equal(D.lang.moment('inconnu.m1').title, '');
  const msgs = S.checks(C, B, { animations: ['spaceship', 'drop', 'oppy_dp09', 'discovery', 'asteroid'], sfx: D.audio.sounds.sfx, music: D.audio.sounds.music, palette: C.palette,
    texts: { fr: { moments: {}, blocks: {} }, en: { moments: {}, blocks: {} } } });
  assert.equal(msgs.filter(function (m) { return /moment/.test(m) && /Texte manquant/.test(m); }).length, 0);
});

test('ui.js ne contient plus le texte du livre (il est dans ts/<langue>/book.js)', function () {
  ['fr', 'en'].forEach(function (c) {
    const src = fs.readFileSync(path.join(RACINE, 'ts', c, 'ui.js'), 'utf8');
    assert.doesNotMatch(src, /dp01\.t1|cover\.t1|credits\.t2/, c);
  });
});

/* ---------- P5 : voix ---------- */

test('voicePath : le fichier de la table config.voices, sinon sounds/va/<langue>/<clé du bloc>.mp3', function () {
  assert.equal(D.audio.voicePath('fr', 'dp04.t1'), 'sounds/va/fr/' + C.voices.fr['dp04.t1']);
  assert.equal(D.audio.voicePath('en', 'dp01.t2'), 'sounds/va/en/2b_Blueprints.wav');
  assert.equal(D.audio.voicePath('en', 'credits.t2'), 'sounds/va/en/credits.t2.mp3');   // absente de la table
});

test('blocks.voices : un déclencheur par bloc avec voix, à son apparition, en temps global', function () {
  const n = S.normalize([{ id: 'c', kind: 'cover', bgColor: 'nuit' },
    { id: 'p', blocks: [{ page: 'left', at: 0.3, voice: true }, { page: 'right', at: 1.2 }, { page: 'right', at: 2, voice: true }] }], CONF);
  const b = S.compile(n, 1);
  assert.deepEqual(json(D.blocks.voices(b)), [{ t: 4.3, key: 'p.t1' }, { t: 6, key: 'p.t3' }]);
});

test('blocks.voices : le livre livré a ses voix sur les pages de texte, toutes avant l’arrêt de leur page', function () {
  const v = D.blocks.voices(B);
  assert.ok(v.length >= 4);
  const holds = S.holds(B, C.ui.nextLead);
  v.forEach(function (x) {
    const i = D.nav.spreadAt(B.spreads, x.t);
    if (i < B.spreads.length - 1) assert.ok(x.t < holds[i].t, x.key);
  });
});

/* ---------- P10 : contrôles supplémentaires ---------- */

test('checks : identifiant de page mal formé', function () {
  const n = S.normalize([{ id: 'ma page', bgColor: 'nuit' }, { id: 'ok.1', bgColor: 'nuit' }, { id: 'bien-2_x', bgColor: 'nuit' }], CONF);
  const b = S.compile(n, 1);
  const m = S.checks({ spreads: [], flip: { duration: 1 } }, b, { animations: [], sfx: [], music: [], palette: C.palette, texts: {} });
  assert.equal(m.filter(function (x) { return /identifiant/.test(x) && /mal formé/.test(x); }).length, 2);
});

test('checks : voice doit valoir true ou false', function () {
  const Dx = charger(LIVRE);
  Dx.book.spreads[4].blocks[0].voice = 'oui';
  assert.ok(Dx.blocks.checks(Dx.config, Dx.book, Dx.texts).some(function (m) { return /voix/.test(m); }));
});

test('checks : un bloc pas entièrement apparu à l’arrêt de sa page est signalé', function () {
  const Dx = charger(LIVRE);
  const sp = Dx.book.spreads[4];                         // dp04
  const hold = sp.duration - Dx.config.flip.duration - Dx.config.ui.nextLead;   // arrêt, en temps local
  sp.blocks[0].at = hold - 0.15;                         // fondu de 0,4 s : fini après l'arrêt
  sp.blocks[0].fade = 0.4;
  assert.ok(Dx.blocks.checks(Dx.config, Dx.book, Dx.texts).some(function (m) { return /arrêt/.test(m) && /dp04\.t1/.test(m); }));
});

test('checks : un bloc qui passe à mi-hauteur sous les boutons du téléphone est signalé ; en bas de page, non', function () {
  const Dx = charger(LIVRE);
  const dp06 = Dx.book.spreads[6];
  dp06.blocks[0].box = { x: 40, y: 230, w: 560, h: 300 };     // à mi-hauteur, pleine largeur (gabarit ④ mal réglé)
  const m = Dx.blocks.checks(Dx.config, Dx.book, Dx.texts);
  assert.equal(m.length, 1);
  assert.match(m[0], /dp06\.t1.*boutons Préc\. et Suiv\./);
  assert.ok(Dx.book.spreads[4].blocks[0].box.x === 40, 'le bloc de dp04 (en bas, pleine largeur) n’est pas concerné');
  // Juste au bord : texte de 100 à 540 accepté, de 99 à 540 refusé.
  dp06.blocks[0].box = { x: 80, y: 230, w: 480, h: 300 };
  assert.equal(Dx.blocks.checks(Dx.config, Dx.book, Dx.texts).length, 0);
  dp06.blocks[0].box = { x: 79, y: 230, w: 481, h: 300 };
  assert.equal(Dx.blocks.checks(Dx.config, Dx.book, Dx.texts).length, 1);
});

/* ---------- P12 : plus de cloche automatique ---------- */

test('timeline : plus de cloche automatique aux moments clés ; voix posées par tl.call à partir de blocks.voices', function () {
  const src = fs.readFileSync(path.join(RACINE, 'js/timeline.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
  assert.doesNotMatch(src, /keyMoments[\s\S]{0,200}sfx\('bell'\)/);
  assert.match(src, /blocks\.voices\(/);
  assert.match(src, /audio\.voice\(/);
});

/* ---------- P1, P4 : le livre livré ---------- */

test('livre : 32 pages — couverture, 15 doubles pages (dp01 à dp15), quatrième de couverture', function () {
  assert.equal(B.spreads.length, 17);
  assert.equal(B.spreads[0].kind, 'cover');
  assert.equal(B.spreads[16].kind, 'back');
  assert.equal(B.spreads[16].id, 'credits');
  for (let i = 1; i < 16; i++) {
    assert.equal(B.spreads[i].id, 'dp' + String(i).padStart(2, '0'));
    assert.ok(!B.spreads[i].kind || B.spreads[i].kind === 'spread', B.spreads[i].id);
  }
  assert.equal(S.pages(B)[16].last, 32);
});

test('livre : tous les contrôles de configuration passent', function () {
  assert.deepEqual(controles(D), []);
});

test('livre : dp05 (la fusée, js/anim/spaceship.js) dp06 (la capsule, js/anim/drop.js) dp09 (Oppy, js/anim/oppy_dp09.js) dp12 (les découvertes, js/anim/discovery.js) et dp15 (les astéroïdes, js/anim/asteroid.js) sont animées ; les autres pages sont un fond et du texte', function () {
  assert.deepEqual(B.spreads.filter(function (s) { return s.animation; }).map(function (s) { return s.id + ':' + s.animation; }), ['dp05:spaceship', 'dp06:drop', 'dp09:oppy_dp09', 'dp12:discovery', 'dp15:asteroid']);
});

test('livre : les six gabarits sont marqués dans js/book.js (① à ⑥)', function () {
  const src = fs.readFileSync(path.join(RACINE, 'js/book.js'), 'utf8');
  ['①', '②', '③', '④', '⑤', '⑥'].forEach(function (g) {
    assert.match(src, new RegExp('Gabarit ' + g), g);
  });
});

test('copier-coller : chaque page de texte copiée sous un nouvel identifiant ne demande que ses textes', function () {
  ['dp04', 'dp05', 'dp06', 'dp07'].forEach(function (id) {
    const n = D.config.spreads.length;                   // pages du livre avant la copie
    const Dx = charger(LIVRE, { 'js/book.js': function (Demo) {
      const brute = Demo.config.spreads.filter(function (s) { return s.id === id; })[0];
      const copie = JSON.parse(JSON.stringify(brute));      // la page telle qu'écrite dans js/book.js
      copie.id = 'dp99';                                    // seule modification…
      delete copie.animation;                               // …avec, pour dp06, son animation (une animation sert à des pages qui se suivent)
      Demo.config.spreads.splice(Demo.config.spreads.length - 1, 0, copie);   // avant les crédits
    } });
    const m = controles(Dx);
    assert.ok(m.length > 0, id + ' : les textes de dp99 manquent forcément');
    m.forEach(function (x) { assert.match(x, /dp99/, id + ' : ' + x); assert.match(x, /Texte manquant/, id + ' : ' + x); });
    assert.equal(Dx.book.spreads[n - 1].bg, 'dp99');           // insérée juste avant les crédits
    assert.equal(S.pages(Dx.book)[n].last, 2 * (n - 1) + 2);   // deux pages de plus
  });
});

test('PDF : la quatrième de couverture en dernier ; une page par côté et par moment', function () {
  const p = D.exporter.plan(B);
  assert.equal(p.length, 1 + 2 * (B.keyMoments.length - 2) + 1);
  assert.equal(p[0].kind, 'cover');
  assert.equal(p[p.length - 1].kind, 'back');
});

/* Caractères d'une police TTF : table « cmap », sous-table Windows Unicode (format 4). */
function caracteres(fichier) {
  const b = fs.readFileSync(fichier);
  const n = b.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < n; i++) { const e = 12 + i * 16; if (b.toString('latin1', e, e + 4) === 'cmap') cmap = b.readUInt32BE(e + 8); }
  const nt = b.readUInt16BE(cmap + 2);
  for (let i = 0; i < nt; i++) {
    const e = cmap + 4 + i * 8;
    if (b.readUInt16BE(e) !== 3 || b.readUInt16BE(e + 2) !== 1) continue;
    const st = cmap + b.readUInt32BE(e + 4);
    if (b.readUInt16BE(st) !== 4) continue;
    const segs = b.readUInt16BE(st + 6) / 2, ends = st + 14, starts = ends + segs * 2 + 2;
    const plages = [];
    for (let k = 0; k < segs; k++) plages.push([b.readUInt16BE(starts + k * 2), b.readUInt16BE(ends + k * 2)]);
    return function (c) { return plages.some(function (p) { return c >= p[0] && c <= p[1]; }); };
  }
  throw new Error('cmap introuvable : ' + fichier);
}

test('textes du livre : chaque caractère existe dans la police de son bloc (sinon il disparaît du PDF)', function () {
  // Trouvé en relisant le PDF : « ④ » s'affichait à l'écran (police de repli du navigateur),
  // mais Futura Book ne l'a pas et le PDF le perdait.
  const polices = {};
  Object.keys(C.pdf.fonts).forEach(function (k) { polices[k] = caracteres(path.join(RACINE, C.pdf.fonts[k].file)); });
  assert.equal(polices.body(0x2463), false, 'contrôle du test : « ④ » absent de Futura Book');
  B.spreads.forEach(function (sp) {
    sp.blocks.forEach(function (b) {
      const a = polices[C.ui.textStyles[b.style].font];
      ['fr', 'en'].forEach(function (c) {
        Array.from(D.texts[c].blocks[b.key]).forEach(function (ch) {
          if (ch === '\n') return;
          assert.ok(a(ch.codePointAt(0)), c + ' : ' + b.key + ' : « ' + ch + ' » (U+' + ch.codePointAt(0).toString(16) + ') absent de la police');
        });
      });
    });
  });
});
