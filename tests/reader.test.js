/* Tests unitaires de la préférence du lecteur (js/reader.js) : vue par
   défaut selon la largeur, mémorisation, côté affiché en vue page.
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert/strict');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/reader.js']);
const UI = D.config.ui, R = D.reader;

function memoire(init) {
  const m = Object.assign({}, init || {});
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, m: m };
}
const bloque = { getItem: function () { throw new Error('bloqué'); }, setItem: function () { throw new Error('bloqué'); } };

test('defaultMode : double page à partir de 720 px CSS, page en dessous', function () {
  assert.equal(R.defaultMode(720, UI), 'spread');
  assert.equal(R.defaultMode(719, UI), 'page');
  assert.equal(R.defaultMode(390, UI), 'page');
  assert.equal(R.defaultMode(1440, UI), 'spread');
});

test('init : sans choix mémorisé, la vue dépend de la largeur ; côté gauche', function () {
  const r = R.init(memoire(), 390, UI);
  assert.equal(r.mode, 'page'); assert.equal(r.chosen, false); assert.equal(r.side, 'left');
  assert.equal(R.init(null, 1024, UI).mode, 'spread');
});

test('init : le choix mémorisé prime sur la largeur ; une valeur inconnue est ignorée', function () {
  assert.equal(R.init(memoire({ '48hours.view': 'spread' }), 390, UI).mode, 'spread');
  assert.equal(R.init(memoire({ '48hours.view': 'spread' }), 390, UI).chosen, true);
  assert.equal(R.init(memoire({ '48hours.view': 'page' }), 1440, UI).mode, 'page');
  const r = R.init(memoire({ '48hours.view': 'zoom' }), 1440, UI);
  assert.equal(r.mode, 'spread'); assert.equal(r.chosen, false);
});

test('init et setMode : stockage bloqué, aucune erreur', function () {
  const r = R.init(bloque, 390, UI);
  assert.equal(r.mode, 'page');
  const s = R.setMode(r, 'spread', bloque);
  assert.equal(s.mode, 'spread'); assert.equal(s.chosen, true);
});

test('setMode : mémorise le choix et rend un nouvel état ; mode inconnu refusé', function () {
  const st = memoire();
  const r = R.init(st, 390, UI);
  const s = R.setMode(r, 'spread', st);
  assert.equal(s.mode, 'spread'); assert.equal(st.m['48hours.view'], 'spread');
  assert.equal(r.mode, 'page');                       // l'état d'origine n'est pas modifié
  assert.equal(R.setMode(r, 'zoom', st), r);
});

test('resize : la vue par défaut suit la largeur tant que le lecteur n’a pas choisi', function () {
  const r = R.init(memoire(), 390, UI);
  assert.equal(R.resize(r, 1024, UI).mode, 'spread');
  const choisi = R.setMode(r, 'page', memoire());
  assert.equal(R.resize(choisi, 1024, UI).mode, 'page');
});

test('sideAt : le côté ne vaut que pour sa double page ; ailleurs, gauche', function () {
  const r = R.setSide(R.init(null, 390, UI), 'right', 2);
  assert.equal(R.sideAt(r, 2), 'right');
  assert.equal(R.sideAt(r, 1), 'left');
  assert.equal(R.sideAt(r, 3), 'left');
});

test('toggle : bascule de mode', function () {
  assert.equal(R.other('page'), 'spread');
  assert.equal(R.other('spread'), 'page');
});

test('shownPage : la page lue par le miroir (null = les deux pages)', function () {
  const page = R.setSide(R.init(null, 390, UI), 'right', 1);
  const dbl = R.setMode(page, 'spread', null);
  assert.equal(R.shownPage(page, { kind: 'spread' }, 1), 'right');
  assert.equal(R.shownPage(page, { kind: 'spread' }, 2), 'left');
  assert.equal(R.shownPage(dbl, { kind: 'spread' }, 1), null);
  assert.equal(R.shownPage(page, { kind: 'cover' }, 0), 'right');
  assert.equal(R.shownPage(dbl, { kind: 'cover' }, 0), 'right');
  // S#2-01 : la quatrième de couverture n'a que la page de gauche, dans les deux vues.
  assert.equal(R.shownPage(page, { kind: 'back' }, 4), 'left');
  assert.equal(R.shownPage(dbl, { kind: 'back' }, 4), 'left');
  assert.equal(R.shownPage(R.setSide(page, 'right', 4), { kind: 'back' }, 4), 'left');
});

test('follow : quitter la double page oublie le côté ; y rester ne change rien', function () {
  const r = R.setSide(R.init(null, 390, UI), 'right', 2);
  assert.equal(R.follow(r, 2), r);
  const ailleurs = R.follow(r, 1);
  assert.equal(R.sideAt(ailleurs, 1), 'left');
  assert.equal(R.sideAt(R.follow(ailleurs, 2), 2), 'left');   // de retour sur dp02 : plus de côté droit
});
