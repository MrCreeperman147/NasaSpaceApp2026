/* Tests de S#2-03 : taille des fonds (une image trop grande ne s'affiche pas
   sur téléphone), et retrait de l'animation de démonstration « traversee ».
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const lire = function (f) { return fs.readFileSync(path.join(RACINE, f), 'utf8'); };
const code = function (f) { return lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1'); };
const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/assets.js']);
const A = D.assets, C = D.config;
const json = function (v) { return JSON.parse(JSON.stringify(v)); };

/* Taille d'une image PNG ou JPEG, lue dans son en-tête. */
function taille(f) {
  const b = fs.readFileSync(f);
  if (b.toString('latin1', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m === 0xC0 || m === 0xC2) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}

/* ---------- taille des fonds ---------- */

const PAGES = [{ bg: 'cover', kind: 'cover' }, { bg: 'dp01' }, { bg: 'credits', kind: 'back' }, { bg: null, bgColor: 'nuit' }];

test('bgSize : formats prévus et limite du téléphone, dans config.js', function () {
  assert.deepEqual(json(C.bgSize), { spread: { w: 1920, h: 1080 }, page: { w: 1280, h: 1440 }, maxSide: 4096 });
});

test('sizeProblems : aux formats prévus, aucun message', function () {
  const m = A.sizeProblems(PAGES, { cover: { w: 1280, h: 1440 }, dp01: { w: 1920, h: 1080 }, credits: { w: 1280, h: 1440 } }, C);
  assert.deepEqual(json(m), []);
});

test('sizeProblems : plus de 4096 pixels de côté → ne s’affichera pas sur téléphone', function () {
  // Le cas réel de S#2-02 : une couverture exportée en grand format, chargée mais invisible sur Android.
  const m = A.sizeProblems(PAGES, { cover: { w: 4000, h: 4500 } }, C);
  assert.equal(m.length, 1);
  assert.match(m[0], /cover/);
  assert.match(m[0], /4000 × 4500/);
  assert.match(m[0], /4096/);
  assert.match(m[0], /téléphone/);
});

test('sizeProblems : exactement 4096 accepté comme limite, mais plus grand que prévu', function () {
  const m = A.sizeProblems(PAGES, { dp01: { w: 4096, h: 2304 } }, C);
  assert.equal(m.length, 1);
  assert.doesNotMatch(m[0], /ne s’affichera pas/);
  assert.match(m[0], /plus grand que prévu \(1920 × 1080\)/);
});

test('sizeProblems : plus grand que prévu, au bon format', function () {
  const m = A.sizeProblems(PAGES, { credits: { w: 2560, h: 2880 } }, C);
  assert.equal(m.length, 1);
  assert.match(m[0], /credits.*plus grand que prévu \(1280 × 1440\)/);
});

test('sizeProblems : mauvais format (une couverture en 16:9) → image déformée', function () {
  const m = A.sizeProblems(PAGES, { cover: { w: 1280, h: 720 } }, C);
  assert.equal(m.length, 1);
  assert.match(m[0], /cover.*format prévu \(8:9\).*déformée/);
});

test('sizeProblems : plus petit au bon format, accepté ; fond non chargé ou page sans image, ignorés', function () {
  assert.deepEqual(json(A.sizeProblems(PAGES, { dp01: { w: 1280, h: 720 } }, C)), []);
  assert.deepEqual(json(A.sizeProblems(PAGES, {}, C)), []);
});

test('fonds livrés : aucun ne dépasse sa taille prévue ni 4096 pixels (images de l’artiste comprises)', function () {
  const tailles = {};
  D.book.spreads.filter(function (s) { return !!s.bg; }).forEach(function (s) {
    tailles[s.bg] = taille(path.join(RACINE, A.bgPath(s.bg, C)));
  });
  assert.deepEqual(json(A.sizeProblems(D.book.spreads, tailles, C)), []);
});

test('chargement : la taille réelle de chaque fond est relevée et contrôlée en console', function () {
  assert.match(code('js/scene.js'), /backgroundSizes/);
  assert.match(code('js/main.js'), /assets\.sizeProblems\(/);
});

/* ---------- animation de démonstration retirée ---------- */

test('démo retirée : plus de js/anim/traversee.js (à supprimer), ni de script dans index.html', function () {
  assert.equal(fs.existsSync(path.join(RACINE, 'js/anim/traversee.js')), false, 'js/anim/traversee.js à supprimer');
  assert.doesNotMatch(lire('index.html'), /traversee\.js/);
});

test('animations du livre : dp05, dp06, dp09, dp12 et dp15 ; le livre a ses pages et ses textes', function () {
  assert.deepEqual(Object.keys(D.book.animations), ['spaceship', 'drop', 'oppy_dp09', 'discovery', 'asteroid']);
  assert.equal(D.book.spreads.filter(function (s) { return s.animation; }).length, 5);
  const n = D.book.spreads.length;   // couverture + doubles pages + crédits
  assert.equal(D.spreads.pages(D.book)[n - 1].last, 2 * (n - 2) + 2);
  assert.equal(D.book.spreads[1].blocks.length, 2);
});

test('démo retirée : plus de sprites dessinés par code dans assets.js (ombre du tournage gardée)', function () {
  const src = code('js/assets.js');
  ['hull', 'island', 'sailFrames', 'moon', 'LAMP', 'buildSailSheet', 'wave()'].forEach(function (k) {
    assert.ok(src.indexOf(k) < 0, k + ' encore présent');
  });
  assert.match(src, /pageShadow/);
});

test('démo retirée : le gabarit ⑤ (animée) reste, en exemple commenté dans js/book.js', function () {
  const src = lire('js/book.js');
  assert.match(src, /Gabarit ⑤/);
  assert.deepEqual(code('js/book.js').match(/animation:\s*'[^']*'/g), ["animation: 'spaceship'", "animation: 'drop'", "animation: 'oppy_dp09'", "animation: 'discovery'", "animation: 'asteroid'"]);   // dp05, dp06, dp09, dp12 et dp15
  assert.match(src, /js\/anim\/<clé>\.js/);
});
