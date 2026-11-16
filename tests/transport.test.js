/* Tests de S#2-01 sur le câblage du transport et du son : ce qui ne se teste
   pas sans navigateur (GSAP, Howler) est vérifié ici dans le code source,
   le reste par l'essai sans écran et la campagne d'intégration.
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const lire = function (f) { return fs.readFileSync(path.join(RACINE, f), 'utf8'); };
// Code sans ses commentaires : on teste ce qui s'exécute, pas ce qui est expliqué.
const code = function (f) { return lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1'); };

test('audio : la musique tourne en boucle et n’est plus alignée sur la timeline (ni seek, ni time)', function () {
  const src = code('js/audio.js');
  assert.match(src, /loop:\s*true/);
  const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/audio.js']);
  assert.equal(typeof D.audio.play, 'function');
  assert.equal(typeof D.audio.pause, 'function');
  assert.equal(D.audio.seek, undefined);
  assert.equal(D.audio.time, undefined);
  ['js/main.js', 'js/export.js', 'js/timeline.js', 'js/scene.js'].forEach(function (f) {
    assert.doesNotMatch(code(f), /audio\.(seek|time)\(/, f);
  });
});

test('audio : Howler n’est appelé que dans le module audio', function () {
  // main.js vérifie seulement que la librairie est chargée (!window.Howl) : ce n'est pas un appel.
  fs.readdirSync(path.join(RACINE, 'js')).filter(function (f) { return /\.js$/.test(f) && f !== 'audio.js'; }).forEach(function (f) {
    assert.doesNotMatch(code('js/' + f), /new Howl\b|\bHowler\./, f);
  });
});

test('dérive : plus de vérification périodique ni d’affichage de l’écart audio', function () {
  assert.doesNotMatch(code('js/main.js'), /setInterval|drift/);
  assert.doesNotMatch(lire('index.html'), /id="drift"/);
  const D = charger(['js/config.js', 'js/book.js', 'ts/fr/ui.js', 'ts/en/ui.js']);
  ['fr', 'en'].forEach(function (c) {
    assert.equal(D.texts[c].ui.drift, undefined, c);
    assert.equal(D.texts[c].ui.driftNone, undefined, c);
  });
});

test('timeline : un arrêt (addPause) à chaque instant de spreads.holds, posé dans timeline.js seulement', function () {
  const src = code('js/timeline.js');
  assert.match(src, /spreads\.holds\(/);
  assert.match(src, /addPause\(/);
  ['js/main.js', 'js/scene.js', 'js/export.js'].forEach(function (f) { assert.doesNotMatch(code(f), /addPause/, f); });
});

test('transport : Lecture ne rembobine plus le livre entier en fin de timeline', function () {
  assert.doesNotMatch(code('js/main.js'), /DUR\s*-\s*0\.01/);
});

test('interface : curseur, repères et temps masqués hors ?debug', function () {
  const css = lire('css/style.css');
  assert.match(css, /body:not\(\.debug\)\s+\.scrub/);
  assert.match(css, /body:not\(\.debug\)\s+\.time/);
  assert.match(code('js/main.js'), /classList\.toggle\('debug',\s*debug\)/);
});

// (Version : voir tests/interface.test.js, 0.0.4 depuis S#2-02.)

test('timeline : le rappel d’arrêt ne compte que si GSAP a réellement arrêté la timeline', function () {
  // Défaut trouvé à l'essai sans écran : Suiv. pendant l'animation saute pile sur
  // l'arrêt puis lance la lecture ; GSAP ne s'arrête pas mais appelait le rappel,
  // et l'interface se croyait à l'arrêt pendant que la lecture continuait.
  assert.match(code('js/timeline.js'), /addPause\([^)]*function \(\) \{ if \(tl\.paused\(\)/);
});
