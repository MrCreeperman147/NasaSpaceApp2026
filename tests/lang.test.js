/* Tests unitaires de la langue (js/lang.js) et des fichiers de textes
   (ts/fr/ui.js, ts/en/ui.js). Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const charger = require('./charger.js');

const FICHIERS = ['js/config.js', 'js/book.js', 'js/spreads.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js', 'ts/fr/book.js', 'ts/en/book.js'];
function neuf() { return charger(FICHIERS); }

/* Faux localStorage : mémoire simple, ou stockage qui refuse tout. */
function memoire(init) {
  const m = Object.assign({}, init || {});
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, m: m };
}
const bloque = {
  getItem: function () { throw new Error('bloqué'); },
  setItem: function () { throw new Error('bloqué'); }
};

test('textes : mêmes clés en français et en anglais', function () {
  const D = neuf();
  assert.equal(D.lang.missing(D.texts).length, 0);
});

test('textes : titres des moments facultatifs (S#2-02), non vides quand ils existent, sans légende, dans chaque langue', function () {
  const D = neuf();
  const ids = D.book.keyMoments.map(function (km) { return km.id; });
  ['fr', 'en'].forEach(function (code) {
    // Aucun titre pour un moment qui n'existe pas…
    Object.keys(D.texts[code].moments).forEach(function (k) { assert.ok(ids.indexOf(k) >= 0, code + ' : ' + k); });
    // …un titre non vide quand il existe (il est facultatif ; le livre livré en a un partout).
    D.book.keyMoments.forEach(function (km) {
      const m = D.texts[code].moments[km.id];
      assert.ok(m && m.title.length > 0, code + ' : ' + km.id); assert.equal(m.caption, undefined);
    });
  });
});

test('missing : une clé absente d’une langue est signalée, avec son nom', function () {
  const D = neuf();
  const out = D.lang.missing({ fr: { ui: { a: 'x', b: 'y' }, moments: { 'dp01.m1': { title: 't', caption: 'c' } } }, en: { ui: { a: 'x' }, moments: {} } });
  assert.equal(out.length, 3);
  assert.ok(out.some(function (m) { return /ui\.b/.test(m) && /en/.test(m); }));
  assert.ok(out.some(function (m) { return /moments\.dp01\.m1\.title/.test(m); }));
});

test('init : français par défaut, sans stockage', function () {
  const D = neuf();
  assert.equal(D.lang.init(null), 'fr');
  assert.equal(D.lang.current, 'fr');
});

test('init : reprend la langue mémorisée, ignore une valeur inconnue', function () {
  let D = neuf();
  assert.equal(D.lang.init(memoire({ '48hours.lang': 'en' })), 'en');
  D = neuf();
  assert.equal(D.lang.init(memoire({ '48hours.lang': 'xx' })), 'fr');
  D = neuf();
  assert.equal(D.lang.init(memoire({ '48hours.lang': '' })), 'fr');
});

test('set : change la langue et la mémorise ; refuse une langue inconnue', function () {
  const D = neuf();
  const st = memoire();
  D.lang.init(st);
  assert.equal(D.lang.set('en', st), true);
  assert.equal(D.lang.current, 'en');
  assert.equal(st.m['48hours.lang'], 'en');
  assert.equal(D.lang.set('de', st), false);
  assert.equal(D.lang.set('', st), false);
  assert.equal(D.lang.current, 'en');
});

test('stockage bloqué : la langue change quand même, sans erreur', function () {
  const D = neuf();
  assert.equal(D.lang.init(bloque), 'fr');
  assert.equal(D.lang.set('en', bloque), true);
  assert.equal(D.lang.current, 'en');
});

test('other : la langue vers laquelle le bouton bascule', function () {
  const D = neuf();
  D.lang.init(null);
  assert.equal(D.lang.other(), 'en');
  D.lang.set('en', null);
  assert.equal(D.lang.other(), 'fr');
});

test('get : texte de la langue courante, variables remplacées', function () {
  const D = neuf();
  D.lang.init(null);
  const fr = D.lang.get('menu');
  assert.equal(typeof fr, 'string');
  assert.equal(D.lang.get('version', { v: '0.0.1' }), 'Version 0.0.1');
  D.lang.set('en', null);
  assert.notEqual(D.lang.get('play'), D.texts.fr.ui.play);
  assert.match(D.lang.get('exportCapturing', { i: 2, n: 5 }), /2.*5/);
});

test('get : clé inconnue, on rend la clé plutôt qu’un texte vide', function () {
  const D = neuf();
  D.lang.init(null);
  assert.equal(D.lang.get('cle.qui.nexiste.pas'), 'cle.qui.nexiste.pas');
});

test('moment : titre et légende du moment par son identifiant, dans la langue courante', function () {
  const D = neuf();
  D.lang.init(null);
  assert.equal(D.lang.moment('cover.m1').title, 'Couverture');
  assert.equal(D.lang.moment('dp02.m1').title, 'Sur Terre donc sur Mars ?');
  D.lang.set('en', null);
  assert.equal(D.lang.moment('dp02.m1').title, 'On Earth, so on Mars?');
  assert.equal(D.lang.moment('dp02.m1').caption, undefined);   // légende retirée en S#1-03
  assert.equal(D.lang.moment('dp99.m1').title, '');      // identifiant inconnu : textes vides, pas d'erreur
  assert.equal(D.lang.moment(0).title, '');              // ancien indice numérique : plus reconnu
});
