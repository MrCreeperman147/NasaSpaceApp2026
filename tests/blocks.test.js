/* Tests unitaires des blocs de texte (js/blocks.js) : visibilité en fonction
   du temps local, contrôles de configuration, contenu de la démo.
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/blocks.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js', 'ts/fr/book.js', 'ts/en/book.js']);
const C = D.config, K = D.blocks;
const proche = function (a, b) { return Math.abs(a - b) <= 1e-9; };

/* Livre minimal : une double page de 5 s, un moment capturé à 3 s. */
const BLOC = function (extra) {
  return Object.assign({ key: 'dp01.t1', page: 'left', box: { x: 40, y: 540, w: 560, h: 140 }, style: 'corps', at: 1, fade: 0.4, plate: true }, extra || {});
};
function livre(blocks, extra) {
  const sp = Object.assign({ id: 'dp01', duration: 5, bg: 'dp01', animation: null, sfx: [], moments: [{ start: 0, capture: 3 }], blocks: blocks }, extra || {});
  const config = { spreads: [sp], flip: { duration: 1 }, ui: C.ui };
  return { config: config, book: D.spreads.compile(config.spreads, 1) };
}
/* Textes : toutes les clés citées, dans les deux langues, sauf celles retirées. */
function textes(book, sauf) {
  const t = { fr: { blocks: {} }, en: { blocks: {} } };
  book.spreads.forEach(function (s) {
    (s.blocks || []).forEach(function (b) { t.fr.blocks[b.key] = 'x'; t.en.blocks[b.key] = 'x'; });
  });
  (sauf || []).forEach(function (s) { delete t[s.code].blocks[s.key]; });
  return t;
}
function messages(blocks, extra, sauf) {
  const l = livre(blocks, extra);
  return K.checks(l.config, l.book, textes(l.book, sauf));
}

/* ---------- visible ---------- */

test('visible : rien avant « at », opacité 0 exclue à « at », rampe, puis 1', function () {
  const sp = livre([BLOC()]).book.spreads[0];
  assert.equal(K.visible(sp, 0.99).length, 0);
  assert.equal(K.visible(sp, 1).length, 0);              // opacité nulle : pas affiché
  const mi = K.visible(sp, 1.2);
  assert.equal(mi.length, 1);
  assert.ok(proche(mi[0].opacity, 0.5));
  assert.equal(K.visible(sp, 1.4)[0].opacity, 1);
  assert.equal(K.visible(sp, 4.9)[0].opacity, 1);        // pas de fondu de sortie : visible jusqu'à la fin
});

test('visible : fondu nul = apparition franche à « at »', function () {
  const sp = livre([BLOC({ fade: 0 })]).book.spreads[0];
  assert.equal(K.visible(sp, 0.999).length, 0);
  assert.equal(K.visible(sp, 1)[0].opacity, 1);
});

test('visible : ordre de la liste, même u même résultat, double page sans bloc', function () {
  const sp = livre([BLOC({ key: 'dp01.t1', at: 2 }), BLOC({ key: 'dp01.t2', page: 'right', at: 1 })]).book.spreads[0];
  assert.deepEqual(Array.from(K.visible(sp, 3), function (v) { return v.block.key; }), ['dp01.t1', 'dp01.t2']);
  assert.deepEqual(JSON.stringify(K.visible(sp, 2.13)), JSON.stringify(K.visible(sp, 2.13)));
  assert.equal(K.visible(livre(undefined).book.spreads[0], 3).length, 0);
});

test('keys : les clés visibles d’une double page, page gauche puis droite', function () {
  const sp = livre([BLOC({ key: 'dp01.t1', page: 'right', at: 0 }), BLOC({ key: 'dp01.t2', page: 'left', at: 0, box: { x: 40, y: 40, w: 100, h: 100 } })]).book.spreads[0];
  assert.deepEqual(Array.from(K.keys(sp, 2)), ['dp01.t2', 'dp01.t1']);
  assert.deepEqual(Array.from(K.keys(sp, 0)), []);
  assert.deepEqual(Array.from(K.keys(sp, 2, 'right')), ['dp01.t1']);   // vue page : une seule page (S#1-04)
  assert.deepEqual(Array.from(K.keys(sp, 2, 'left')), ['dp01.t2']);
});

/* ---------- géométrie ---------- */

test('minSize : 14 px sur un écran de 390 px = 22,97 px de scène', function () {
  assert.ok(Math.abs(K.minSize(C.ui) - 14 * 640 / 390) < 1e-9);
  assert.ok(K.minSize(C.ui) > 22 && K.minSize(C.ui) < 23);
});

test('wrapWidth et fits : marge intérieure de chaque côté', function () {
  const b = BLOC();
  assert.equal(K.wrapWidth(b, C.ui), 560 - 2 * C.ui.blockPad);
  assert.equal(K.fits(140 - 2 * C.ui.blockPad, b, C.ui), true);
  assert.equal(K.fits(140 - 2 * C.ui.blockPad + 0.5, b, C.ui), false);
});

test('origin : la boîte relative à la page devient une position de la scène', function () {
  assert.deepEqual(JSON.stringify(K.origin(BLOC())), JSON.stringify({ x: 40, y: 540 }));
  assert.deepEqual(JSON.stringify(K.origin(BLOC({ page: 'right' }))), JSON.stringify({ x: 680, y: 540 }));
});

/* ---------- checks ---------- */

test('checks : la configuration livrée ne produit aucun message', function () {
  assert.deepEqual(Array.from(K.checks(C, D.book, D.texts)), []);
});

test('checks : boîte qui dépasse sa page d’un pixel, ou vide', function () {
  assert.equal(messages([BLOC({ box: { x: 40, y: 540, w: 600, h: 140 } })]).length, 0);   // 640 : pile au bord
  assert.equal(messages([BLOC({ box: { x: 41, y: 540, w: 600, h: 140 } })]).length, 1);   // 641
  assert.equal(messages([BLOC({ box: { x: 40, y: 581, w: 560, h: 140 } })]).length, 1);   // 721
  assert.equal(messages([BLOC({ box: { x: -1, y: 540, w: 560, h: 140 } })]).length, 1);
  assert.equal(messages([BLOC({ box: { x: 40, y: 540, w: 0, h: 140 } })]).length, 1);
});

test('checks : page inconnue ; bloc de couverture ailleurs qu’à droite', function () {
  assert.equal(messages([BLOC({ page: 'milieu' })]).length, 1);
  assert.equal(messages([BLOC({ page: 'left' })], { kind: 'cover', bg: null, bgColor: 'nuit' }).length, 1);
  assert.equal(messages([BLOC({ page: 'right' })], { kind: 'cover', bg: null, bgColor: 'nuit' }).length, 0);
});

test('checks : deux boîtes qui se touchent passent, deux qui se recouvrent sont signalées', function () {
  const haut = BLOC({ key: 'dp01.t1', box: { x: 40, y: 40, w: 560, h: 100 } });
  assert.equal(messages([haut, BLOC({ key: 'dp01.t2', box: { x: 40, y: 140, w: 560, h: 100 } })]).length, 0);
  assert.equal(messages([haut, BLOC({ key: 'dp01.t2', box: { x: 40, y: 139, w: 560, h: 100 } })]).length, 1);
  // Côte à côte : se toucher passe, un pixel de trop est signalé.
  const gauche = BLOC({ key: 'dp01.t1', box: { x: 40, y: 40, w: 200, h: 100 } });
  assert.equal(messages([gauche, BLOC({ key: 'dp01.t2', box: { x: 240, y: 40, w: 200, h: 100 } })]).length, 0);
  assert.equal(messages([gauche, BLOC({ key: 'dp01.t2', box: { x: 239, y: 40, w: 200, h: 100 } })]).length, 1);
  // Même boîte, mais sur l'autre page : pas de recouvrement.
  assert.equal(messages([haut, BLOC({ key: 'dp01.t2', page: 'right', box: { x: 40, y: 40, w: 560, h: 100 } })]).length, 0);
});

test('checks : style inconnu, trop petit (22 px refusé, 23 px accepté), gras ou italique', function () {
  assert.equal(messages([BLOC({ style: 'inconnu' })]).length, 1);
  const avec = function (style) {
    const l = livre([BLOC({ style: 'test' })]);
    l.config.ui = Object.assign({}, C.ui, { textStyles: { test: style } });
    return K.checks(l.config, l.book, textes(l.book));
  };
  const base = { font: 'body', size: 23, leading: 1.3, color: 'creme' };
  assert.equal(avec(base).length, 0);
  assert.equal(avec(Object.assign({}, base, { size: 22 })).length, 1);
  assert.equal(avec(Object.assign({}, base, { weight: 'bold' })).length, 1);
  assert.equal(avec(Object.assign({}, base, { style: 'italic' })).length, 1);
  assert.equal(avec(Object.assign({}, base, { font: 'inconnue' })).length, 1);
});

test('checks : « at » hors de la double page (durée refusée, durée − 0,01 acceptée), fondu négatif', function () {
  // Moment déplacé à 4,995 pour que la capture ne tombe pas dans le fondu.
  const tard = { moments: [{ start: 0, capture: 4.995 }] };
  assert.equal(messages([BLOC({ at: 5, fade: 0 })], tard).length, 1);
  assert.equal(messages([BLOC({ at: 4.99, fade: 0 })], tard).length, 0);
  assert.equal(messages([BLOC({ at: -0.1 })]).length, 1);
  assert.equal(messages([BLOC({ fade: -1 })]).length, 1);
});

test('checks : capture à la fin du fondu acceptée, 0,01 s avant refusée', function () {
  assert.equal(messages([BLOC({ at: 2.6, fade: 0.4 })]).length, 0);    // 2,6 + 0,4 = 3 = capture
  assert.equal(messages([BLOC({ at: 2.61, fade: 0.4 })]).length, 1);
  assert.equal(messages([BLOC({ at: 3.5 })]).length, 0);               // pas encore visible : rien à signaler
});

test('checks : clé en double, ou absente d’une seule langue', function () {
  assert.equal(messages([BLOC({ key: 'dp01.t1' }), BLOC({ key: 'dp01.t1', page: 'right' })]).length, 1);
  assert.equal(messages([BLOC()], undefined, [{ code: 'en', key: 'dp01.t1' }]).length, 1);
});

/* ---------- configuration livrée et textes ---------- */

test('livre : clés des blocs (dérivées de l’identifiant depuis S#2-02), dans l’ordre du livre', function () {
  const cles = [];
  D.book.spreads.forEach(function (s) { (s.blocks || []).forEach(function (b) { cles.push(b.key); }); });
  // <id>.t1, <id>.t2… dans l'ordre des blocs de chaque page de js/book.js.
  const attendu = [];
  C.spreads.forEach(function (s) { (s.blocks || []).forEach(function (_, k) { attendu.push(s.id + '.t' + (k + 1)); }); });
  assert.deepEqual(cles, attendu);
  assert.equal(cles[0], 'cover.t1');
  assert.deepEqual(cles.slice(-2), ['credits.t1', 'credits.t2']);
});

test('livre : le titre de la couverture est celui du livre en français, traduit en anglais', function () {
  assert.equal(D.texts.fr.blocks['cover.t1'], C.title);
  assert.equal(D.texts.en.blocks['cover.t1'], 'The Twin Rovers');
});

test('démo : chaque moment capture tous ses blocs visibles en entier', function () {
  D.book.keyMoments.forEach(function (km) {
    const sp = D.book.spreads[km.spread];
    K.visible(sp, km.t - sp.start).forEach(function (v) { assert.equal(v.opacity, 1, km.id + ' / ' + v.block.key); });
  });
});

test('styles livrés : polices du livre, ni gras ni italique, au-dessus de la taille minimale', function () {
  Object.keys(C.ui.textStyles).forEach(function (k) {
    const s = C.ui.textStyles[k];
    assert.ok(C.ui.fonts[s.font], k + ' : police inconnue');
    assert.ok(!s.weight || s.weight === 'normal', k);
    assert.ok(!s.style || s.style === 'normal', k);
    assert.ok(s.size >= K.minSize(C.ui), k);
  });
  assert.match(C.ui.fonts.title, /^"Berlin Sans FB Demi"/);
  assert.match(C.ui.fonts.body, /^"Futura Book"/);
});

test('lang.block : texte du bloc dans la langue courante ; clé inconnue = texte vide', function () {
  D.lang.current = 'fr';
  assert.equal(D.lang.block('dp02.t1'), D.texts.fr.blocks['dp02.t1']);
  D.lang.current = 'en';
  assert.equal(D.lang.block('dp02.t1'), D.texts.en.blocks['dp02.t1']);
  assert.notEqual(D.texts.fr.blocks['dp02.t1'], D.texts.en.blocks['dp02.t1']);
  assert.equal(D.lang.block('dp99.t9'), '');
  D.lang.current = 'fr';
});

/* ---------- S#2-01 : quatrième de couverture et plaque réglable ---------- */

test('checks : bloc de la quatrième de couverture ailleurs qu’à gauche', function () {
  const back = { kind: 'back', bg: null, bgColor: 'nuit' };
  assert.equal(messages([BLOC({ page: 'left' })], back).length, 0);
  const out = messages([BLOC({ page: 'right' })], back);
  assert.equal(out.length, 1);
  assert.match(out[0], /quatrième de couverture n’a que la page de gauche/);
});

test('hasPlate : plaque demandée ET visible ; transparente (alpha 0) ou absente = rien à dessiner', function () {
  const ui = function (alpha) { return Object.assign({}, C.ui, { plate: Object.assign({}, C.ui.plate, { alpha: alpha }) }); };
  assert.equal(K.hasPlate(BLOC({ plate: true }), ui(0.78)), true);
  assert.equal(K.hasPlate(BLOC({ plate: true }), ui(0)), false);
  assert.equal(K.hasPlate(BLOC({ plate: false }), ui(0.78)), false);
  assert.equal(K.hasPlate(BLOC({ plate: undefined }), ui(1)), false);
  assert.equal(K.hasPlate(BLOC({ plate: true }), ui(0.01)), true);
});

test('plaque livrée : opacité réglable entre 0 (transparente) et 1 (opaque) — valeur non figée par les tests', function () {
  const a = C.ui.plate.alpha;
  assert.equal(typeof a, 'number');
  assert.ok(a >= 0 && a <= 1, 'ui.plate.alpha = ' + a);
});

test('démo : crédits, titre centré puis texte, page gauche, dans les deux langues', function () {
  const sp = D.book.spreads[D.book.spreads.length - 1];
  assert.equal(sp.id, 'credits');
  sp.blocks.forEach(function (b) {
    assert.equal(b.page, 'left');
    ['fr', 'en'].forEach(function (code) { assert.ok(D.texts[code].blocks[b.key], b.key + ' en ' + code); });
  });
  assert.equal(sp.blocks[0].style, 'titreCredits');   // titre réduit : tout le texte tient sur la page
  assert.notEqual(D.texts.fr.blocks['credits.t2'], D.texts.en.blocks['credits.t2']);
});

test('livre : les textes du livre n’ont aucun caractère invisible en clair (échappements seulement)', function () {
  const fs = require('node:fs'), path = require('node:path');
  ['ts/fr/book.js', 'ts/en/book.js'].forEach(function (f) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const i = src.indexOf('credits: {');
    assert.ok(i >= 0, f + ' : crédits absents');     // test non complaisant : les crédits doivent y être
    const bloc = src;
    assert.doesNotMatch(bloc, /[  ​‌‍⁠﻿]/, f);
  });
});
