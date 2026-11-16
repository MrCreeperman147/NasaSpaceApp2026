/* Tests de S#2-04 : changer de page en glissant le doigt (swipe).
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const lire = function (f) { return fs.readFileSync(path.join(RACINE, f), 'utf8'); };
const code = function (f) { return lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1'); };
const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/flip.js', 'js/nav.js', 'js/reader.js']);
const UI = D.config.ui, sw = function (dx, dy) { return D.nav.swipe(dx, dy, UI); };

test('swipe : réglages dans config.js (50 px, 1,5 fois plus horizontal que vertical, sans limite de temps)', function () {
  assert.deepEqual(JSON.parse(JSON.stringify(UI.swipe)), { distance: 50, ratio: 1.5 });
});

test('swipe : vers la gauche → page suivante ; vers la droite → page précédente', function () {
  assert.equal(sw(-120, 10), 'next');
  assert.equal(sw(120, -10), 'prev');
});

test('swipe : trop court ou trop vertical → rien (un toucher, un aller-retour, un défilement)', function () {
  assert.equal(sw(-49, 0), null);                // sous le seuil (ou un aller-retour du doigt)
  assert.equal(sw(-50, 0), 'next');              // pile au seuil
  assert.equal(sw(0, 0), null);                  // un simple toucher
  assert.equal(sw(-90, 61), null);               // en diagonale, plus vertical que permis
  assert.equal(sw(-90, 60), 'next');             // 90 = 1,5 × 60 : accepté
  assert.equal(sw(-20, -200), null);             // vertical
});

test('swipe : la durée du geste n’entre pas en compte (geste reçu en retard pendant la lecture)', function () {
  // Défaut trouvé à l'essai : un glisser de 0,25 s, mesuré 1,04 s pendant la lecture, était refusé.
  assert.equal(D.nav.swipe.length, 3);           // (dx, dy, ui) : plus de durée
  assert.doesNotMatch(code('js/main.js'), /swipeFrom\.t\b|e\.timeStamp - swipeFrom/);
});

test('swipe enchaîné avec nav.next / nav.prev : vue page, côté gauche de dp01 → côté droit, puis tournage', function () {
  const B = D.book, flips = D.flip.plan(B.spreads, D.config.flip.duration);
  let r = D.reader.init(null, 400, UI);           // téléphone : vue page
  const t = B.spreads[1].start + 1;
  assert.equal(sw(-100, 0), 'next');
  const res = D.nav.next(r, B.spreads, flips, t, UI.nextLead);
  assert.deepEqual(JSON.parse(JSON.stringify(res)), { t: null, side: 'right', play: false });
});

test('câblage : la scène appelle nav.swipe puis goNext / goPrev (le chemin des boutons), sauf pendant le déplacement d’une vue agrandie', function () {
  const src = code('js/main.js');
  assert.match(src, /nav\.swipe\(/);
  assert.match(src, /=== 'next'\) goNext\(\)/);
  assert.match(src, /=== 'prev'\) goPrev\(\)/);
  assert.match(src, /if \(panFrom\)[^\n]*return/);   // en vue agrandie, glisser déplace l'image
});

test('câblage : le navigateur laisse le glissement horizontal à la page (touch-action: pan-y sur la scène)', function () {
  assert.match(lire('css/style.css'), /\.stage\s*\{[^}]*touch-action:\s*pan-y/);
});

test('version : 0.0.7 (filtre sombre des crédits)', function () {
  assert.equal(D.config.version, '0.0.7');
});
