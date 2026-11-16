/* Tests unitaires du thème (js/theme.js). Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/flip.js', 'js/theme.js']);
const C = D.config, T = D.theme, P = C.palette;
const CLES = ['bg', 'surface', 'ink', 'muted', 'line', 'accent', 'accentInk'];
const proche = function (a, b, eps) { return Math.abs(a - b) <= eps; };

test('contrast : valeurs connues', function () {
  assert.ok(proche(T.contrast('#ffffff', '#000000'), 21, 1e-9));
  assert.ok(proche(T.contrast(P.creme, P.nuit), 11.91, 0.01));
  assert.ok(proche(T.contrast(P.brume, P.pin), 3.39, 0.01));
  assert.equal(T.contrast(P.nuit, P.creme), T.contrast(P.creme, P.nuit));
});

test('mix : bornes et milieu', function () {
  assert.equal(T.mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(T.mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(T.mix('#000000', '#ffffff', 0.5), '#808080');
});

test('average : moyenne des pixels RGBA, null si rien à lire', function () {
  const px = [255, 0, 0, 255, 0, 0, 255, 255];
  assert.equal(JSON.stringify(T.average(px)), JSON.stringify([127.5, 0, 127.5]));
  assert.equal(T.average([]), null);
  assert.equal(T.average(null), null);
});

test('nearest : chaque couleur de la palette est sa propre plus proche voisine', function () {
  Object.keys(P).forEach(function (name) {
    assert.equal(T.nearest(T.parse(P[name]), P), name);
  });
});

test('nearest : la teinte compte, pas la luminosité', function () {
  // Les mêmes couleurs, deux fois plus sombres, donnent le même résultat.
  Object.keys(P).forEach(function (name) {
    const sombre = T.parse(P[name]).map(function (v) { return v / 2; });
    assert.equal(T.nearest(sombre, P), name);
  });
  // Trois moyennes ternes mais de teintes différentes ne tombent pas sur la même couleur.
  const a = T.nearest([100, 83, 91], P), b = T.nearest([60, 85, 117], P), c = T.nearest([60, 90, 70], P);
  assert.equal(b, 'azur');
  assert.notEqual(a, b); assert.notEqual(b, c); assert.notEqual(a, c);
});

test('nearest : noir pur (aucune teinte), pas de division par zéro', function () {
  assert.equal(typeof T.nearest([0, 0, 0], P), 'string');
});

test('thème par défaut : conforme au design et lisible', function () {
  const d = T.DEFAULT;
  assert.equal(d.bg, P.nuit); assert.equal(d.surface, P.pin); assert.equal(d.ink, P.creme);
  assert.equal(d.accent, P.abricot); assert.equal(d.accentInk, P.nuit);
  assert.ok(T.contrast(d.ink, d.bg) >= 4.5);
  assert.ok(T.contrast(d.ink, d.surface) >= 4.5);
  assert.ok(T.contrast(d.muted, d.bg) >= 4.5);
});

test('themeFor : contrastes tenus pour les 14 couleurs de la palette', function () {
  assert.equal(Object.keys(P).length, 14);
  Object.keys(P).forEach(function (name) {
    const th = T.themeFor(T.parse(P[name]), P);
    CLES.forEach(function (k) { assert.match(th[k], /^#[0-9a-f]{6}$/, name + ' : ' + k); });
    assert.ok(T.contrast(th.ink, th.bg) >= 4.5, name + ' : texte sur fond');
    assert.ok(T.contrast(th.ink, th.surface) >= 4.5, name + ' : texte sur surface');
    assert.ok(T.contrast(th.muted, th.bg) >= 4.5, name + ' : texte secondaire sur fond');
    assert.ok(T.contrast(th.accent, th.bg) >= 3, name + ' : accent sur fond');
    assert.ok(T.contrast(th.accent, th.surface) >= 3, name + ' : accent sur surface');
    assert.ok(T.contrast(th.accentInk, th.accent) >= 4.5, name + ' : texte sur accent');
    assert.notEqual(th.bg, th.surface, name + ' : la surface se distingue du fond');
  });
});

test('themeFor : contrastes tenus aussi pour des couleurs hors palette', function () {
  [[0, 0, 0], [255, 255, 255], [255, 0, 0], [20, 200, 90], [128, 128, 128], [250, 240, 60]].forEach(function (rgb) {
    const th = T.themeFor(rgb, P);
    assert.ok(T.contrast(th.ink, th.bg) >= 4.5);
    assert.ok(T.contrast(th.ink, th.surface) >= 4.5);
  });
});

test('themeFor : couleur illisible (null), on retombe sur le thème par défaut', function () {
  assert.equal(JSON.stringify(T.themeFor(null, P)), JSON.stringify(T.DEFAULT));
});

test('themeFor : deux fonds différents donnent deux thèmes différents', function () {
  assert.notEqual(T.themeFor(T.parse(P.azur), P).bg, T.themeFor(T.parse(P.terracotta), P).bg);
});

const flips = D.flip.plan(D.book.spreads, C.flip.duration);
// Un thème par double page de la configuration livrée (couverture + 3).
// Un thème par double page du livre livré (S#2-02 : neuf, la dernière est celle des crédits).
// Un thème par double page du livre livré (couleurs de la palette, reprises en boucle).
const TEINTES = ['nuit', 'azur', 'terracotta', 'sauge', 'ardoise', 'brun', 'ciel', 'argile', 'pin'];
const THEMES = D.book.spreads.map(function (_, i) { return T.themeFor(T.parse(P[TEINTES[i % TEINTES.length]]), P); });

/* Débogage #1 (scénario 28 bis) : avec un fond rouge, l'interface restait grise,
   parce que la couleur retenue était assombrie vers « nuit » (bleu-vert, la
   couleur opposée du rouge). Les tests suivants échouaient avant la correction. */
const teinte = function (hex) { return T.parse(hex); };

test('themeFor : la teinte de la couleur retenue est conservée dans le fond et la surface', function () {
  // Couleurs chaudes : le rouge domine le bleu ; couleurs froides : le bleu domine le rouge.
  ['argile', 'terracotta', 'brun', 'abricot'].forEach(function (name) {
    const th = T.themeFor(T.parse(P[name]), P);
    [th.bg, th.surface].forEach(function (c) {
      const rgb = teinte(c);
      assert.ok(rgb[0] > rgb[2] + 8, name + ' : ' + c + ' devrait rester chaud');
    });
  });
  ['azur', 'ciel'].forEach(function (name) {
    const th = T.themeFor(T.parse(P[name]), P);
    [th.bg, th.surface].forEach(function (c) {
      const rgb = teinte(c);
      assert.ok(rgb[2] > rgb[0] + 8, name + ' : ' + c + ' devrait rester froid');
    });
  });
});

test('themeFor : la moyenne d’un fond rouge sombre donne une interface rouge', function () {
  // Moyenne mesurée sur le fond rouge de la campagne (au-dessus de l'horizon) : [33, 21, 19].
  const th = T.themeFor([33, 21, 19], P);
  const rgb = teinte(th.bg);
  assert.ok(rgb[0] > rgb[1] && rgb[0] > rgb[2] + 8, th.bg);
});

test('themeFor : le fond adaptatif reste sombre (le texte crème y est très lisible)', function () {
  Object.keys(P).forEach(function (name) {
    const th = T.themeFor(T.parse(P[name]), P);
    assert.ok(T.contrast(P.creme, th.bg) >= 7, name + ' : ' + th.bg);
  });
});

test('themeAt : hors tournage, le thème de la double page courante', function () {
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, 0)), JSON.stringify(THEMES[0]));
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, flips[0].from - 0.01)), JSON.stringify(THEMES[0]));
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, flips[0].to)), JSON.stringify(THEMES[1]));
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, (flips[0].to + flips[1].from) / 2)), JSON.stringify(THEMES[1]));   // au milieu de dp01
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, D.book.duration)), JSON.stringify(THEMES[THEMES.length - 1]));   // crédits
});

test('themeAt : continu aux bornes d’un tournage, intermédiaire au milieu', function () {
  const f = flips[0];
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, f.from)), JSON.stringify(THEMES[0]));
  const juste = T.themeAt(THEMES, flips, f.to - 1e-6);
  const a = T.parse(juste.bg), b = T.parse(THEMES[1].bg);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) <= 1);       // aucun saut à la fin du tournage
  const mid = T.themeAt(THEMES, flips, (f.from + f.to) / 2);
  assert.equal(mid.bg, T.mix(THEMES[0].bg, THEMES[1].bg, 0.5));
});

test('themeAt : même t, même thème (saut direct ou non)', function () {
  const t = flips[1].from + 0.37;
  const a = T.themeAt(THEMES, flips, t);
  T.themeAt(THEMES, flips, 2); T.themeAt(THEMES, flips, 19);
  assert.equal(JSON.stringify(T.themeAt(THEMES, flips, t)), JSON.stringify(a));
});

test('themeAt : sans thèmes calculés, le thème par défaut', function () {
  assert.equal(JSON.stringify(T.themeAt(null, flips, 5)), JSON.stringify(T.DEFAULT));
});

test('cssVars : une variable CSS par clé du thème', function () {
  const v = T.cssVars(T.DEFAULT);
  assert.equal(v['--bg'], P.nuit);
  assert.equal(v['--accent-ink'], P.nuit);
  assert.equal(Object.keys(v).length, CLES.length);
});
