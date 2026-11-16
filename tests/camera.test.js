/* Tests unitaires de la caméra (js/camera.js) : vue du lecteur (S#1-04),
   cadrage, zoom de la vue double page. Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/flip.js', 'js/nav.js', 'js/reader.js', 'js/camera.js']);
const C = D.config;
const W = C.W, H = C.H;
const B = D.book;
const flips = D.flip.plan(B.spreads, C.flip.duration);   // flips[i] : tournage de la double page i vers i + 1
const HOME = D.camera.home(W, H);
const E = C.ui.viewEase;                                  // 0,4 s
const proche = function (a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); };
const PAGE = { mode: 'page', side: 'left', spread: 0, chosen: true };
const DOUBLE = { mode: 'spread', side: 'left', spread: 0, chosen: true };
const droite = function (i) { return D.reader.setSide(PAGE, 'right', i); };
const x = function (r, t) { return D.camera.viewAt(r, B, flips, t, E).x; };

test('home : vue par défaut au centre de la scène, zoom 1', function () {
  assert.equal(HOME.x, 640); assert.equal(HOME.y, 360); assert.equal(HOME.zoom, 1);
});

test('ratio : la fenêtre suit la vue du lecteur (16:9 en double page, 8:9 en page)', function () {
  assert.ok(proche(D.camera.ratio('spread', C), 16 / 9));
  assert.ok(proche(D.camera.ratio('page', C), 8 / 9));
});

// Instants du livre livré, calculés à partir de ses durées (js/book.js).
const F0 = flips[0], F1 = flips[1], F2 = flips[2];        // ouverture de la couverture ; dp01 → dp02 ; dp02 → dp03
const T1 = B.spreads[1].start + 1, T2 = B.spreads[2].start + 1;   // un instant dans dp01, dans dp02

test('viewAt : hors tournage, la vue est posée (double page au centre, page à gauche ou à droite)', function () {
  assert.equal(x(DOUBLE, T1), 640);
  assert.equal(x(PAGE, T1), 320);
  assert.equal(x(droite(1), T1), 960);
  const v = D.camera.viewAt(PAGE, B, flips, T1, E);
  assert.equal(v.y, 360); assert.equal(v.zoom, 1);
});

test('viewAt : la couverture est la page de droite, dans les deux vues', function () {
  [0, 1, F0.from - 0.01].forEach(function (t) {
    assert.equal(x(DOUBLE, t), 960);
    assert.equal(x(PAGE, t), 960);
  });
});

test('viewAt : le côté d’une autre double page est ignoré (retour à gauche)', function () {
  assert.equal(x(droite(1), T2), 320);      // côté droit choisi sur dp01, on est sur dp02
  assert.equal(x(droite(2), T2), 960);
});

test('viewAt : glissements pendant le tournage, 0,4 s au début et 0,4 s à la fin (vue page)', function () {
  const r = droite(1);                       // page droite de dp01, tournage F1 vers dp02
  assert.equal(x(r, F1.from), 960);          // début du tournage : encore sur la page droite
  assert.equal(x(r, F1.from + E), 640);      // arrivé sur l'axe
  assert.equal(x(r, (F1.from + F1.to) / 2), 640);   // tenu sur l'axe
  assert.equal(x(r, F1.to - E), 640);
  assert.ok(proche(x(r, F1.to - 1e-9), 320, 1e-6));   // fin du tournage : page gauche de dp02
  assert.equal(x(r, F1.to), 320);
  const mi = x(r, F1.from + E / 2);
  assert.ok(mi < 960 && mi > 640, 'à mi-glissement : ' + mi);
  assert.ok(proche(mi, 800, 1e-6));          // courbe adoucie, symétrique : la moitié du chemin
});

test('viewAt : la couverture s’ouvre en glissant vers le centre (vue double page) ou vers la page gauche (vue page)', function () {
  assert.equal(x(DOUBLE, F0.from), 960); assert.equal(x(DOUBLE, F0.from + E), 640); assert.equal(x(DOUBLE, F0.to), 640);
  assert.equal(x(PAGE, F0.from), 960); assert.equal(x(PAGE, F0.from + 0.5), 640); assert.equal(x(PAGE, F0.to), 320);
});

test('viewAt : vue double page, aucun mouvement autour des autres tournages', function () {
  [F1.from - 0.6, F1.from, F1.from + 0.2, F1.from + 0.6, F1.to, F2.from + 0.3].forEach(function (t) { assert.equal(x(DOUBLE, t), 640); });
});

test('viewAt : même t et même préférence, même vue ; continue en tout point', function () {
  assert.equal(x(PAGE, F1.from + 0.3), x(PAGE, F1.from + 0.3));
  let prev = x(droite(1), F1.from - 0.6);
  for (let t = F1.from - 0.6; t <= F1.to + 0.6; t += 0.01) {
    const v = x(droite(1), t);
    assert.ok(Math.abs(v - prev) < 15, 'saut de ' + (v - prev) + ' à ' + t.toFixed(2));
    prev = v;
  }
});

test('viewAt : un glissement plus long que la moitié du tournage est raccourci', function () {
  assert.equal(x(PAGE, F0.from + 0.5), 640);
  assert.equal(D.camera.viewAt(PAGE, B, flips, F0.from + 0.5, 2).x, 640);     // ease 2 s ramené à 0,5 s
  assert.equal(D.camera.viewAt(PAGE, B, flips, F0.to, 2).x, 320);
});

test('blend : mélange adouci de deux vues (transition de bascule du lecteur)', function () {
  const a = { x: 320, y: 360, zoom: 1 }, b = { x: 960, y: 360, zoom: 1 };
  assert.equal(D.camera.blend(a, b, 0).x, 320);
  assert.equal(D.camera.blend(a, b, 1).x, 960);
  assert.equal(D.camera.blend(a, b, 0.5).x, 640);
  assert.equal(D.camera.blend(a, b, 2).x, 960);     // borné
});

test('configuration : plus de points de passage de caméra ; durée de transition et largeur de bascule', function () {
  assert.equal(C.camera, undefined);
  assert.equal(C.ui.mobileRatio, undefined);
  assert.equal(C.ui.viewEase, 0.4);
  assert.equal(C.ui.minSpreadWidth, 720);
});

test('clamp : la vue ne sort jamais de la scène', function () {
  const vw = 654;
  let k = D.camera.clamp({ x: 0, y: 0, zoom: 1 }, vw, W, H);
  assert.equal(k.x, 327); assert.equal(k.y, 360);
  k = D.camera.clamp({ x: 5000, y: 5000, zoom: 2 }, vw, W, H);
  assert.equal(k.x, W - 163.5); assert.equal(k.y, H - 180);
  k = D.camera.clamp({ x: 640, y: 360, zoom: 1 }, W, W, H);     // vue complète : un seul centre possible
  assert.equal(k.x, 640); assert.equal(k.y, 360);
});

test('transform : le point visé arrive au centre du canevas', function () {
  const cam = { x: 340, y: 480, zoom: 1.5 };
  const tr = D.camera.transform(cam, W, H);
  assert.equal(tr.scale, 1.5);
  assert.ok(proche(cam.x * tr.scale + tr.x, W / 2));
  assert.ok(proche(cam.y * tr.scale + tr.y, H / 2));
  const id = D.camera.transform(HOME, W, H);
  assert.equal(id.scale, 1); assert.equal(id.x, 0); assert.equal(id.y, 0);
});

test('zoomBy : pas de zoom borné entre le minimum et le maximum', function () {
  const ui = C.ui;
  let v = { x: 640, y: 360, zoom: 1 };
  v = D.camera.zoomBy(v, 1, ui, W, H); assert.equal(v.zoom, 1.5);
  v = D.camera.zoomBy(v, 1, ui, W, H); v = D.camera.zoomBy(v, 1, ui, W, H); v = D.camera.zoomBy(v, 1, ui, W, H);
  v = D.camera.zoomBy(v, 1, ui, W, H); assert.equal(v.zoom, ui.zoomMax);
  for (let i = 0; i < 10; i++) v = D.camera.zoomBy(v, -1, ui, W, H);
  assert.equal(v.zoom, ui.zoomMin);
  assert.equal(v.x, 640); assert.equal(v.y, 360);                // au zoom minimal, la vue est recentrée
});

test('pan : le déplacement suit le doigt et reste dans la scène', function () {
  let v = { x: 640, y: 360, zoom: 2 };
  v = D.camera.pan(v, 100, 0, W, H);       // glisser de 100 px de scène vers la droite : le centre recule
  assert.equal(v.x, 590);
  v = D.camera.pan(v, 99999, 99999, W, H);
  assert.equal(v.x, 320); assert.equal(v.y, 180);
  const one = D.camera.pan({ x: 640, y: 360, zoom: 1 }, 50, 50, W, H);
  assert.equal(one.x, 640); assert.equal(one.y, 360);            // au zoom 1, rien à déplacer
});

test('viewAt : à la fin d’un tournage, toujours la page gauche de la nouvelle double page', function () {
  // Même si un côté droit avait été choisi auparavant sur cette double page (voir reader.follow).
  assert.ok(proche(x(droite(2), 13.6 - 1e-9), 320, 1e-6));
});

/* ---------- S#2-01 : crédits (quatrième de couverture, page gauche seule) ---------- */
// Tournage 4 : 24 → 25 de dp03 vers les crédits (25–29).

// Crédits : dernière double page du livre (début CR) ; celle d'avant est la dernière double page ordinaire.
const CR = B.spreads[B.spreads.length - 1].start, NC = B.spreads.length - 1;
test('viewAt : les crédits sont la page de gauche, dans les deux vues, même avec un côté droit forcé', function () {
  [CR, CR + 1, CR + 3.99, CR + 4].forEach(function (t) {
    assert.equal(x(DOUBLE, t), 320, 'double page à ' + t);
    assert.equal(x(PAGE, t), 320, 'page à ' + t);
    assert.equal(x(droite(NC), t), 320, 'côté droit forcé à ' + t);
  });
});

test('viewAt : le tournage vers les crédits finit sur leur page gauche (vue double page comprise)', function () {
  assert.equal(x(DOUBLE, CR - 1), 640);                      // départ : le milieu de la double page précédente
  assert.ok(proche(x(DOUBLE, CR - 0.2), 480));               // à mi-glissement final (0,6 + 0,2 s)
  assert.equal(x(DOUBLE, CR), 320);
  assert.equal(x(droite(NC - 1), CR - 1), 960);              // vue page, depuis sa page droite
  assert.equal(x(droite(NC - 1), CR - 0.01) < 330, true);
});

test('viewAt : crédits, même t et même préférence, même vue ; continue autour de leur début', function () {
  assert.deepStrictEqual(D.camera.viewAt(DOUBLE, B, flips, CR + 1.3, E), D.camera.viewAt(DOUBLE, B, flips, CR + 1.3, E));
  assert.ok(Math.abs(x(DOUBLE, CR - 0.0001) - x(DOUBLE, CR)) < 0.01);
});
