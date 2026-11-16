/* Tests unitaires de la navigation par pages (js/nav.js) et du plan des
   tournages fondé sur les pages. Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/flip.js', 'js/nav.js', 'js/reader.js', 'js/camera.js']);
const C = D.config;
const flips = D.flip.plan(D.book.spreads, C.flip.duration);

// Jeu d'essai indépendant de la configuration livrée.
const PAGES = [{ start: 0 }, { start: 10 }, { start: 20 }];
const MOMENTS = [{ start: 1, t: 2, spread: 0 }, { start: 5, t: 6, spread: 0 }, { start: 10, t: 12, spread: 1 }, { start: 20, t: 22, spread: 2 }];
const PLAN = D.flip.plan(PAGES, 1);

test('plan : un tournage par page à partir de la deuxième, terminé à son start', function () {
  assert.equal(PLAN.length, 2);
  assert.equal(PLAN[0].from, 9);
  assert.equal(PLAN[0].to, 10);
  assert.equal(PLAN[1].from, 19);
  assert.equal(PLAN[1].to, 20);
});

test('plan : la configuration livrée donne un tournage de moins que de pages', function () {
  assert.equal(flips.length, D.book.spreads.length - 1);
  flips.forEach(function (f, i) { assert.equal(f.to, D.book.spreads[i + 1].start); });
});

test('pageAt : première page avant tout, bornes incluses au début de page', function () {
  assert.equal(D.nav.spreadAt(PAGES, -1), 0);
  assert.equal(D.nav.spreadAt(PAGES, 0), 0);
  assert.equal(D.nav.spreadAt(PAGES, 9.999), 0);
  assert.equal(D.nav.spreadAt(PAGES, 10), 1);
  assert.equal(D.nav.spreadAt(PAGES, 25), 2);
});

test('pageAt : pendant un tournage, c’est la page sortante', function () {
  assert.equal(D.nav.spreadAt(PAGES, 9.5), 0);
  assert.equal(D.nav.spreadAt(PAGES, 19.5), 1);
});

test('momentAt : premier moment avant son start, puis le dernier commencé', function () {
  assert.equal(D.nav.momentAt(MOMENTS, 0), 0);
  assert.equal(D.nav.momentAt(MOMENTS, 1), 0);
  assert.equal(D.nav.momentAt(MOMENTS, 4.99), 0);
  assert.equal(D.nav.momentAt(MOMENTS, 5), 1);
  assert.equal(D.nav.momentAt(MOMENTS, 9.5), 1);   // au milieu d'un tournage : moment sortant
  assert.equal(D.nav.momentAt(MOMENTS, 30), 3);
});

test('prevTarget : nul sur la première page, sinon début de la page précédente', function () {
  assert.equal(D.nav.prevTarget(PAGES, 3), null);
  assert.equal(D.nav.prevTarget(PAGES, 9.5), null);   // tournage 1 : la page courante est encore la première
  assert.equal(D.nav.prevTarget(PAGES, 10), 0);
  assert.equal(D.nav.prevTarget(PAGES, 15), 0);
  assert.equal(D.nav.prevTarget(PAGES, 22), 10);
});

test('nextTarget : nul sur la dernière page, sinon juste avant le tournage suivant', function () {
  assert.equal(D.nav.nextTarget(PAGES, PLAN, 3, 0.05), 8.95);
  assert.equal(D.nav.nextTarget(PAGES, PLAN, 12, 0.05), 18.95);
  assert.equal(D.nav.nextTarget(PAGES, PLAN, 20, 0.05), null);
  assert.equal(D.nav.nextTarget(PAGES, PLAN, 25, 0.05), null);
});

test('nextTarget : pendant un tournage, relance ce tournage', function () {
  assert.equal(D.nav.nextTarget(PAGES, PLAN, 9.5, 0.05), 8.95);
});

test('nextTarget : la cible ne descend jamais sous 0', function () {
  const pages = [{ start: 0 }, { start: 1 }];
  assert.equal(D.nav.nextTarget(pages, D.flip.plan(pages, 1), 0.5, 0.05), 0);
});

test('checks : la configuration livrée ne produit aucun message', function () {
  assert.equal(D.nav.checks(D.book, flips).length, 0);
  assert.equal(D.flip.conflicts(flips, D.book.keyMoments, D.book.duration).length, 0);
});

test('checks : un moment qui commence pendant un tournage est signalé', function () {
  const moments = MOMENTS.map(function (m) { return Object.assign({}, m); });
  moments[1].start = 9.5;
  const out = D.nav.checks({ spreads: PAGES, keyMoments: moments }, PLAN);
  assert.equal(out.length, 1);
  assert.match(out[0], /moment clé 2/);
  assert.match(out[0], /tournage 1/);
});

test('checks : un moment qui commence à la fin exacte d’un tournage est accepté', function () {
  assert.equal(D.nav.checks({ spreads: PAGES, keyMoments: MOMENTS }, PLAN).length, 0);
});

test('checks : une page déclarée qui ne correspond pas au start est signalée', function () {
  const moments = MOMENTS.map(function (m) { return Object.assign({}, m); });
  moments[2].spread = 0;
  // La page 2 garde aucun moment déclaré, mais le contrôle se fonde sur le start : un seul message.
  const out = D.nav.checks({ spreads: PAGES, keyMoments: moments }, PLAN);
  assert.equal(out.length, 1);
  assert.match(out[0], /moment clé 3/);
  assert.match(out[0], /double page 1/);
});

test('checks : une page sans moment clé est signalée', function () {
  const moments = MOMENTS.slice(0, 3);
  const out = D.nav.checks({ spreads: PAGES, keyMoments: moments }, PLAN);
  assert.equal(out.length, 1);
  assert.match(out[0], /double page 3/);
});

test('configuration livrée : chaque instant capturé appartient à la page de son moment', function () {
  D.book.keyMoments.forEach(function (km) {
    assert.equal(D.nav.spreadAt(D.book.spreads, km.t), km.spread);
    assert.ok(km.t >= km.start);
  });
});

test('configuration livrée : sur la couverture, Prev est désactivé et Next ouvre le livre', function () {
  const B = D.book;
  assert.equal(D.nav.prevTarget(B.spreads, 2), null);
  // Next saute juste avant le premier tournage (fin de la couverture moins le tournage), qui ouvre sur dp01.
  const t1 = B.spreads[0].end - C.flip.duration;
  assert.ok(Math.abs(D.nav.nextTarget(B.spreads, flips, 2, C.ui.nextLead) - (t1 - C.ui.nextLead)) < 1e-9);
  assert.equal(flips[0].to, B.spreads[1].start);
  assert.equal(B.spreads[1].id, 'dp01');
});

/* ---------- S#1-04 : Préc. et Suiv. selon la vue du lecteur ---------- */
// Livre livré : les instants sont calculés à partir de ses durées (js/book.js), pour
// suivre ses changements. flips[i] : tournage de la double page i vers i + 1.
// S#2-01 : Préc. qui saute lance la lecture (play: true).
const SP = D.book.spreads, LEAD = C.ui.nextLead;
const PG = { mode: 'page', side: 'left', spread: 0, chosen: true };
const DP = { mode: 'spread', side: 'left', spread: 0, chosen: true };
const cote = function (side, i) { return D.reader.setSide(PG, side, i); };
// Copie comparable (autre contexte vm) ; le temps est arrondi à 1e-9 (12,6 − 0,05 = 12,549999999999999).
const json = function (v) {
  const o = JSON.parse(JSON.stringify(v));
  if (o && typeof o.t === 'number') o.t = Math.round(o.t * 1e9) / 1e9;
  return o;
};
const r9 = function (t) { return Math.round(t * 1e9) / 1e9; };
const dans = function (i) { return SP[i].start + 1; };              // un instant dans la double page i, avant son tournage
const avantTournage = function (i) { return r9(flips[i].from - LEAD); };   // cible de Suiv. depuis la double page i
const DERNIERE = SP.length - 2;                                    // dernière double page avant les crédits

test('next, vue page : page gauche → page droite, sans saut ni lecture', function () {
  assert.deepStrictEqual(json(D.nav.next(PG, SP, flips, dans(1), LEAD)), { t: null, side: 'right', play: false });
});

test('next, vue page : page droite → tournage vers la double page suivante, en gardant le côté droit, lecture', function () {
  assert.deepStrictEqual(json(D.nav.next(cote('right', 1), SP, flips, dans(1), LEAD)), { t: avantTournage(1), side: 'right', play: true });
});

test('next, vue page : aucun saut de la vue avant le tournage, puis arrivée sur la page gauche', function () {
  // Défaut trouvé à l'essai sans écran : le côté était remis à gauche sur la double
  // page SORTANTE, et la vue sautait de la page droite à la gauche avant le tournage.
  const avant = cote('right', 1);
  const res = D.nav.next(avant, SP, flips, dans(1), LEAD);
  const apres = D.reader.setSide(avant, res.side, D.nav.spreadAt(SP, res.t));
  const E = C.ui.viewEase;
  assert.equal(D.camera.viewAt(apres, D.book, flips, res.t, E).x, 960);         // toujours sur la page droite
  assert.equal(D.camera.viewAt(apres, D.book, flips, SP[2].start, E).x, 320);   // tournage fini : page gauche de dp02
});

test('next, vue page : la couverture ouvre le livre ; page droite de la dernière double page : tournage vers les crédits', function () {
  assert.deepStrictEqual(json(D.nav.next(PG, SP, flips, 1, LEAD)), { t: avantTournage(0), side: 'left', play: true });
  assert.deepStrictEqual(json(D.nav.next(cote('right', DERNIERE), SP, flips, dans(DERNIERE), LEAD)), { t: avantTournage(DERNIERE), side: 'right', play: true });
  assert.deepStrictEqual(json(D.nav.next(PG, SP, flips, dans(DERNIERE), LEAD)), { t: null, side: 'right', play: false });
});

test('prev, vue page : page droite → page gauche ; page gauche → page droite de la double page précédente, à son début', function () {
  assert.deepStrictEqual(json(D.nav.prev(cote('right', 2), SP, flips, dans(2))), { t: null, side: 'left', play: false });
  assert.deepStrictEqual(json(D.nav.prev(PG, SP, flips, dans(2))), { t: SP[1].start, side: 'right', play: true });
  // Depuis la page gauche d'une double page déjà avancée dans le temps : même règle.
  assert.deepStrictEqual(json(D.nav.prev(PG, SP, flips, flips[2].from - 0.5)), { t: SP[1].start, side: 'right', play: true });
  assert.equal(D.nav.prev(PG, SP, flips, 1), null);                       // couverture
  assert.deepStrictEqual(json(D.nav.prev(PG, SP, flips, dans(1))), { t: 0, side: 'right', play: true });   // dp01 → couverture
});

test('next et prev, vue double page : comportement de S#1-01 (tournage, début de la précédente)', function () {
  assert.deepStrictEqual(json(D.nav.next(DP, SP, flips, dans(1), LEAD)), { t: avantTournage(1), side: 'left', play: true });
  assert.deepStrictEqual(json(D.nav.next(DP, SP, flips, dans(DERNIERE), LEAD)), { t: avantTournage(DERNIERE), side: 'left', play: true });
  assert.deepStrictEqual(json(D.nav.prev(DP, SP, flips, dans(2))), { t: SP[1].start, side: 'left', play: true });
  assert.equal(D.nav.prev(DP, SP, flips, 1), null);
});

test('next et prev, vue page, pendant un tournage : comme en vue double page', function () {
  const pendant = flips[1].from + 0.4;     // tournage de dp01 vers dp02 : la double page courante est encore dp01
  assert.deepStrictEqual(json(D.nav.next(PG, SP, flips, pendant, LEAD)), { t: avantTournage(1), side: 'left', play: true });   // relance ce tournage
  assert.deepStrictEqual(json(D.nav.prev(cote('right', 1), SP, flips, pendant)), { t: 0, side: 'left', play: true });
});

/* ---------- S#2-01 : crédits (quatrième de couverture) et arrêts ---------- */
const CR = SP.length - 1;   // indice des crédits
const TC = SP[CR].start + 1, TP = SP[CR - 1].start;   // un instant dans les crédits ; début de la double page d'avant

test('crédits : Suiv. désactivé, dans les deux vues et des deux côtés', function () {
  assert.equal(SP[CR].kind, 'back');
  assert.equal(D.nav.next(PG, SP, flips, TC, LEAD), null);
  assert.equal(D.nav.next(DP, SP, flips, TC, LEAD), null);
  assert.equal(D.nav.next(cote('right', CR), SP, flips, TC, LEAD), null);   // un côté droit forcé n'ouvre pas une page qui n'existe pas
  assert.equal(D.nav.next(PG, SP, flips, D.book.duration, LEAD), null);     // fin de la timeline
});

test('crédits : Préc. mène à la double page d’avant (page droite en vue page, double page sinon) et lance la lecture', function () {
  assert.deepStrictEqual(json(D.nav.prev(PG, SP, flips, TC)), { t: TP, side: 'right', play: true });
  assert.deepStrictEqual(json(D.nav.prev(DP, SP, flips, TC)), { t: TP, side: 'left', play: true });
  // Une seule page : jamais de glissement vers la gauche, même avec un côté droit forcé.
  assert.deepStrictEqual(json(D.nav.prev(cote('right', CR), SP, flips, TC)), { t: TP, side: 'right', play: true });
});

test('couverture : une seule page aussi pour Préc. (côté droit forcé, Préc. reste désactivé)', function () {
  assert.equal(D.nav.prev(cote('right', 0), SP, flips, 1), null);
});

test('Préc. et Suiv. sans saut (changement de côté) ne lancent pas la lecture', function () {
  assert.equal(D.nav.next(PG, SP, flips, dans(1), LEAD).play, false);
  assert.equal(D.nav.prev(cote('right', 1), SP, flips, dans(1)).play, false);
});

test('arrêt puis Suiv. : depuis l’arrêt de dp01, Suiv. vise le même instant (aucun nouvel arrêt à franchir)', function () {
  const h = D.spreads.holds(D.book, LEAD)[1].t;      // arrêt de dp01
  const res = D.nav.next(DP, SP, flips, h, LEAD);
  assert.ok(Math.abs(res.t - h) < 1e-9);
  assert.equal(res.play, true);
  // Vue page, à l'arrêt sur la page gauche : d'abord la page droite, sans quitter l'arrêt.
  assert.deepStrictEqual(json(D.nav.next(PG, SP, flips, h, LEAD)), { t: null, side: 'right', play: false });
});
