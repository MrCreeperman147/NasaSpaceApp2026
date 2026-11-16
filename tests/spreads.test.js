/* Tests unitaires du livre en doubles pages (js/spreads.js) : compilation des
   temps globaux et contrôles de configuration. Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js', 'ts/fr/book.js', 'ts/en/book.js', 'js/flip.js', 'js/nav.js']);
const C = D.config, S = D.spreads, B = D.book;
const proche = function (a, b) { return Math.abs(a - b) <= 1e-9; };
const copie = function (o) { return JSON.parse(JSON.stringify(o)); };
// Les valeurs viennent d'un autre contexte (vm) : on compare leur contenu, pas leur prototype.
const egal = function (a, b) { assert.deepEqual(copie(a), copie(b)); };

/* Ce que les autres modules savent résoudre (voir main.js). */
const DEPS = { animations: ['traversee', 'spaceship', 'drop', 'oppy_dp09', 'discovery', 'asteroid'], sfx: ['bell', 'page'], music: ['musique'], palette: C.palette, texts: D.texts };

/* Livre minimal indépendant de la configuration livrée. */
function livre(spreads) {
  const config = { spreads: spreads, flip: { duration: 1 }, bgm: 'musique' };
  return { config: config, book: S.compile(spreads, 1) };
}
function messages(spreads, deps) {
  const l = livre(spreads);
  return S.checks(l.config, l.book, Object.assign({}, DEPS, { texts: {} }, deps || {}));
}
const DP = function (id, duration, extra) {
  return Object.assign({ id: id, duration: duration, bg: id, animation: null, sfx: [], moments: [{ start: 0, capture: 0.5 }] }, extra || {});
};

/* ---------- compile ---------- */

/* Le livre livré : couverture, dp01 à dp15, crédits. Les temps attendus sont
   recalculés à partir de js/book.js (durées), pour suivre ses changements. */
const IDS = ['cover'].concat(Array.from({ length: 15 }, function (_, i) { return 'dp' + String(i + 1).padStart(2, '0'); }), ['credits']);

test('compile : débuts et fins globaux, durée totale (configuration livrée)', function () {
  egal(B.spreads.map(function (s) { return s.id; }), IDS);
  let t = 0;
  B.spreads.forEach(function (s, i) {
    assert.equal(s.index, i);
    assert.ok(proche(s.start, t), 'début ' + s.id);
    assert.equal(s.duration, C.spreads[i].duration === undefined ? C.ui.pageDuration : C.spreads[i].duration);
    assert.ok(proche(s.end, s.start + s.duration), 'fin ' + s.id);
    t = s.end;
  });
  assert.ok(proche(B.duration, t));
});

test('compile : moments clés en temps global, dans l’ordre du livre', function () {
  const ids = [], spreads = [];
  B.spreads.forEach(function (s, i) {
    s.moments.forEach(function (m, j) { ids.push(s.id + '.m' + (j + 1)); spreads.push(i); });
  });
  egal(B.keyMoments.map(function (m) { return m.id; }), ids);
  egal(B.keyMoments.map(function (m) { return m.spread; }), spreads);
  B.keyMoments.forEach(function (km) {
    const sp = B.spreads[km.spread], m = sp.moments[Number(km.id.split('.m')[1]) - 1];
    assert.ok(proche(km.start, sp.start + m.start), 'début ' + km.id);
    assert.ok(proche(km.t, sp.start + m.capture), 'capture ' + km.id);
  });
  // Une page sans « moments » en reçoit un, capturé à l'arrêt de la lecture (ex. dp01).
  assert.equal(C.spreads[1].moments, undefined);
  assert.equal(B.spreads[1].moments.length, 1);
});

test('compile : allonger une double page décale les suivantes, pas ses propres moments', function () {
  const a = S.compile([DP('a', 5, { moments: [{ start: 1, capture: 2 }] }), DP('b', 5, { moments: [{ start: 1, capture: 2 }] })], 1);
  const b = S.compile([DP('a', 7, { moments: [{ start: 1, capture: 2 }] }), DP('b', 5, { moments: [{ start: 1, capture: 2 }] })], 1);
  assert.equal(a.keyMoments[0].t, b.keyMoments[0].t);         // moment de « a » : inchangé
  assert.equal(b.keyMoments[1].t - a.keyMoments[1].t, 2);     // moment de « b » : décalé de 2 s
  assert.equal(b.duration - a.duration, 2);
});

/* Livre d'essai animé (indépendant du livre livré) :
   couverture de 4 s, puis trois doubles pages de 9,6, 4,4 et 7 s qui partagent l'animation « x ». */
const ANIME = S.compile([DP('cover', 4, { kind: 'cover' }), DP('a', 9.6, { animation: 'x' }), DP('b', 4.4, { animation: 'x' }), DP('c', 7, { animation: 'x' }), DP('d', 4)], 1);

test('compile : une animation partagée couvre ses doubles pages, de la première à la dernière', function () {
  egal(Object.keys(ANIME.animations), ['x']);
  assert.ok(proche(ANIME.animations.x.from, 4));
  assert.ok(proche(ANIME.animations.x.to, 25));
  egal(Object.keys(B.animations), ['spaceship', 'drop', 'oppy_dp09', 'discovery', 'asteroid']);   // livre livré : dp05, dp06, dp09, dp12, dp15
});

test('compile : le plan des tournages en découle, la couverture ouvre sur dp01', function () {
  const plan = D.flip.plan(B.spreads, C.flip.duration);
  assert.equal(plan.length, B.spreads.length - 1);
  plan.forEach(function (f, i) {
    // Un tournage finit au début de la double page suivante et dure flip.duration.
    assert.ok(proche(f.to, B.spreads[i + 1].start) && proche(f.from, f.to - C.flip.duration), 'tournage ' + (i + 1));
  });
  assert.equal(B.spreads[1].id, 'dp01');
});

test('compile : ne modifie pas la configuration reçue', function () {
  const avant = copie(C.spreads);
  S.compile(C.spreads, 1);
  egal(copie(C.spreads), avant);
  assert.equal(C.spreads[0].start, undefined);
});

/* ---------- temps ---------- */

test('localTime : temps local, borné à 0 avant le début', function () {
  const dp02 = B.spreads[2];
  assert.equal(S.localTime(dp02, dp02.start), 0);
  assert.ok(proche(S.localTime(dp02, dp02.start + 1.25), 1.25));
  assert.equal(S.localTime(dp02, 0), 0);
  // Pendant le tournage qui mène à dp02, la sortante (dp01) continue son temps naturel.
  const dp01 = B.spreads[1];
  assert.ok(proche(S.localTime(dp01, dp02.start - 0.5), dp01.duration - 0.5));
});

test('animTime : compté depuis la première double page de l’animation, même sur les suivantes', function () {
  assert.equal(S.animTime(ANIME, 'x', 0), 0);           // couverture : animation à son début
  assert.equal(S.animTime(ANIME, 'x', 4), 0);
  assert.ok(proche(S.animTime(ANIME, 'x', 15), 11));    // sur la 2e double page : temps continu, pas remis à 0
  assert.equal(S.animTime(ANIME, 'inconnue', 10), 0);
});

test('animTime : au début de la 2e double page animée, le temps de la 1re (9,6 s)', function () {
  assert.ok(proche(S.animTime(ANIME, 'x', ANIME.spreads[2].start), 9.6));
});

test('fade : 0 avant, rampe linéaire, 1 après, sans division par zéro', function () {
  assert.equal(S.fade(0.4, 0.5, 0.8), 0);
  assert.equal(S.fade(0.5, 0.5, 0.8), 0);
  assert.ok(proche(S.fade(0.9, 0.5, 0.8), 0.5));
  assert.equal(S.fade(5, 0.5, 0.8), 1);
  assert.equal(S.fade(0.5, 0.5, 0), 1);
});

/* ---------- contrôles ---------- */

test('checks : la configuration livrée ne produit aucun message', function () {
  egal(S.checks(C, B, DEPS), []);
  egal(D.nav.checks(B, D.flip.plan(B.spreads, C.flip.duration)), []);
});

test('checks : identifiant en double', function () {
  const out = messages([DP('a', 3), DP('a', 3)]);
  assert.equal(out.length, 1);
  assert.match(out[0], /« a » est utilisé deux fois/);
});

test('checks : couverture ailleurs qu’en premier, type inconnu', function () {
  assert.match(messages([DP('a', 3), DP('c', 3, { kind: 'cover' })]).join(' | '), /couverture, mais n’est pas en premier/);
  assert.match(messages([DP('a', 3, { kind: 'poster' })]).join(' | '), /type inconnu/);
  egal(messages([DP('c', 3, { kind: 'cover' }), DP('a', 3)]), []);
});

test('checks : durée absente, nulle, ou pas plus longue que le tournage qui la termine', function () {
  assert.match(messages([DP('a', undefined)]).join(' | '), /pas de durée valide/);
  assert.match(messages([DP('a', 0)]).join(' | '), /pas de durée valide/);
  // Clé non complaisante : pile la durée du tournage (1 s) est refusée, un poil plus est accepté.
  assert.match(messages([DP('a', 1), DP('b', 3)]).join(' | '), /moins que le tournage/);
  egal(messages([DP('a', 1.01, { moments: [{ start: 0, capture: 0 }] }), DP('b', 3)]), []);
  // La dernière double page n'est suivie d'aucun tournage : 1 s lui suffit.
  egal(messages([DP('a', 3), DP('b', 1)]), []);
});

test('checks : sans fond, il faut une couleur de la palette', function () {
  assert.match(messages([DP('a', 3, { bg: null })]).join(' | '), /ni fond ni couleur/);
  assert.match(messages([DP('a', 3, { bg: null, bgColor: 'fuchsia' })]).join(' | '), /ni fond ni couleur/);
  egal(messages([DP('a', 3, { bg: null, bgColor: 'nuit' })]), []);
});

test('checks : animation et effet sonore inconnus', function () {
  assert.match(messages([DP('a', 3, { animation: 'vol' })]).join(' | '), /animation inconnue : vol/);
  assert.match(messages([DP('a', 3, { sfx: [{ u: 1, key: 'tonnerre' }] })]).join(' | '), /effet sonore inconnu : tonnerre/);
  egal(messages([DP('a', 3, { animation: 'traversee', sfx: [{ u: 1, key: 'bell' }] })]), []);
});

test('checks : effet sonore hors de sa double page (u = durée refusé)', function () {
  assert.match(messages([DP('a', 3, { sfx: [{ u: 3, key: 'bell' }] })]).join(' | '), /hors de la double page/);
  assert.match(messages([DP('a', 3, { sfx: [{ u: -0.1, key: 'bell' }] })]).join(' | '), /hors de la double page/);
  egal(messages([DP('a', 3, { sfx: [{ u: 2.99, key: 'bell' }] })]), []);
});

test('checks : moment hors de sa double page, ou capturé avant son début', function () {
  assert.match(messages([DP('a', 3, { moments: [{ start: 3, capture: 2 }] })]).join(' | '), /début est hors/);
  assert.match(messages([DP('a', 3, { moments: [{ start: 0, capture: 3 }] })]).join(' | '), /instant capturé est hors/);
  assert.match(messages([DP('a', 3, { moments: [{ start: 2, capture: 1 }] })]).join(' | '), /précède son début/);
  egal(messages([DP('a', 3, { moments: [{ start: 1, capture: 1 }] })]), []);
});

test('checks : une animation partagée doit servir à des doubles pages qui se suivent', function () {
  const out = messages([DP('a', 3, { animation: 'traversee' }), DP('b', 3), DP('c', 3, { animation: 'traversee' })]);
  assert.match(out.join(' | '), /ne se suivent pas/);
  egal(messages([DP('a', 3, { animation: 'traversee' }), DP('b', 3, { animation: 'traversee' })]), []);
});

test('checks : musique de fond inconnue', function () {
  const l = livre([DP('a', 3)]);
  l.config.bgm = 'valse';
  assert.match(S.checks(l.config, l.book, Object.assign({}, DEPS, { texts: {} })).join(' | '), /Musique de fond inconnue : valse/);
});

test('checks : titre de moment facultatif (S#2-02) ; absent d’une seule langue, c’est lang.missing qui le signale', function () {
  const l = livre([DP('a', 3)]);
  const texts = { fr: { ui: {}, moments: { 'a.m1': { title: 'x' } } }, en: { ui: {}, moments: {} } };
  assert.deepEqual(copie(S.checks(l.config, l.book, Object.assign({}, DEPS, { texts: texts }))), []);
  const out = D.lang.missing(texts);
  assert.equal(out.length, 1);
  assert.match(out[0], /« en » : moments\.a\.m1\.title/);
});

test('nav.checks : un moment qui déborde de sa double page tombe dans la suivante et est signalé', function () {
  const l = livre([DP('a', 3, { moments: [{ start: 0, capture: 0 }, { start: 3.5, capture: 3.5 }] }), DP('b', 3)]);
  const out = D.nav.checks(l.book, D.flip.plan(l.book.spreads, 1));
  assert.ok(out.some(function (m) { return /appartient à la double page 1, mais son début tombe dans la double page 2/.test(m); }));
});

test('fade : 1 pile à la fin exacte du fondu, malgré l’arithmétique flottante (S#1-03)', function () {
  assert.equal(S.fade(1.4, 1, 0.4), 1);        // (1,4 − 1) / 0,4 = 0,9999999999999998
  assert.equal(S.fade(4.6 + 0.4, 4.6, 0.4), 1);
  assert.ok(S.fade(1.39, 1, 0.4) < 1);
});

/* ---------- S#2-01 : quatrième de couverture (type « back ») ---------- */

test('checks : la quatrième de couverture est acceptée en dernier, refusée ailleurs', function () {
  egal(messages([DP('c', 3, { kind: 'cover' }), DP('a', 3), DP('z', 3, { kind: 'back' })]), []);
  assert.match(messages([DP('z', 3, { kind: 'back' }), DP('a', 3)]).join(' | '), /quatrième de couverture, mais n’est pas en dernier/);
  // Deux quatrièmes : au moins une n'est pas la dernière.
  assert.match(messages([DP('a', 3), DP('y', 3, { kind: 'back' }), DP('z', 3, { kind: 'back' })]).join(' | '), /« y » est une quatrième de couverture/);
});

test('configuration livrée : les crédits ferment le livre (type back, image assombrie, sans animation)', function () {
  const last = B.spreads[B.spreads.length - 1];
  assert.equal(last.id, 'credits');
  assert.equal(last.kind, 'back');
  assert.equal(last.bg, 'credits');                 // img/story/bgi/credits.png
  assert.ok(last.dim > 0 && last.dim <= 1);         // filtre sombre, pour le texte crème
  assert.equal(last.animation, null);
});

/* ---------- S#2-01 : arrêt de la lecture en fin de double page ---------- */

test('holds : un arrêt par double page sauf la dernière, juste avant son tournage (configuration livrée)', function () {
  const h = copie(S.holds(B, C.ui.nextLead));
  egal(h.map(function (x) { return x.spread; }), B.spreads.slice(0, -1).map(function (s) { return s.index; }));
  h.forEach(function (x, i) {
    const v = B.spreads[i].end - C.flip.duration - C.ui.nextLead;
    assert.ok(proche(x.t, v), 'arrêt ' + i + ' : ' + x.t);
  });
});

test('holds : chaque arrêt est dans sa double page, avant le début de son tournage, en ordre croissant', function () {
  const plan = D.flip.plan(B.spreads, C.flip.duration);
  const h = S.holds(B, C.ui.nextLead);
  h.forEach(function (x, i) {
    assert.equal(D.nav.spreadAt(B.spreads, x.t), x.spread);
    assert.ok(x.t < plan[i].from);
    if (i > 0) assert.ok(x.t > h[i - 1].t);
  });
});

test('holds : livre d’une seule double page, aucun arrêt ; avance nulle, arrêt au début du tournage', function () {
  assert.equal(S.holds(S.compile([DP('a', 3)], 1), 0.05).length, 0);
  const b = S.compile([DP('a', 5), DP('b', 5)], 1);
  assert.ok(proche(S.holds(b, 0)[0].t, 4));
  assert.ok(proche(S.holds(b, 0.05)[0].t, 3.95));
});

test('holds et nav.next s’enchaînent : Suiv. vise l’arrêt de sa double page (aucun arrêt entre les deux)', function () {
  // Suiv. saute à l'instant de l'arrêt puis lance la lecture : la lecture repart
  // DE l'arrêt et ne s'y arrête donc pas (une pause ne retient que si on la franchit).
  const plan = D.flip.plan(B.spreads, C.flip.duration);
  S.holds(B, C.ui.nextLead).forEach(function (x) {
    const sp = B.spreads[x.spread];
    const cible = D.nav.nextTarget(B.spreads, plan, sp.start + 0.5, C.ui.nextLead);
    assert.ok(proche(cible, x.t), 'double page ' + x.spread);
  });
});

test('holds : rien de nouveau dans la configuration (calculé, jamais écrit)', function () {
  C.spreads.forEach(function (s) { assert.equal(s.hold, undefined); });
});

test('holds : à l’arrêt, tous les blocs de la double page sont entièrement apparus (configuration livrée)', function () {
  // Défaut trouvé en S#2-01 : dp03, devenue avant-dernière, s'arrêtait avant la fin du fondu de dp03.t2.
  S.holds(B, C.ui.nextLead).forEach(function (h) {
    const sp = B.spreads[h.spread];
    (sp.blocks || []).forEach(function (b) {
      assert.equal(S.fade(h.t - sp.start, b.at, b.fade), 1, sp.id + ' / ' + b.key);
    });
  });
});

test('holds : chaque instant capturé pour le PDF est avant l’arrêt de sa double page', function () {
  const h = S.holds(B, C.ui.nextLead);
  B.keyMoments.forEach(function (km) {
    if (km.spread < h.length) assert.ok(km.t <= h[km.spread].t + 1e-9, km.id);   // capture par défaut : pile à l'arrêt
  });
});
