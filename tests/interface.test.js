/* Tests de S#2-02 sur le câblage (main.js, scene.js, assets.js, index.html) :
   ce qui ne se teste pas sans navigateur est vérifié dans le code source,
   le reste par l'essai sans écran et la campagne d'intégration.
   Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const lire = function (f) { return fs.readFileSync(path.join(RACINE, f), 'utf8'); };
const code = function (f) { return lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1'); };
/* Corps d'une fonction nommée de main.js (jusqu'à la première ligne « } » au même retrait). */
function corps(src, nom) {
  const m = src.match(new RegExp('\\n(\\s*)function ' + nom + '\\b[^\\n]*\\n([\\s\\S]*?)\\n\\1\\}'));
  assert.ok(m, 'fonction ' + nom + ' introuvable');
  return m[2];
}

test('voix : Howler seulement dans audio.js ; voice, pauseVoice, resumeVoice, stopVoice exposés', function () {
  const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/audio.js']);
  ['voice', 'pauseVoice', 'resumeVoice', 'stopVoice', 'voicePath'].forEach(function (f) { assert.equal(typeof D.audio[f], 'function', f); });
  assert.match(code('js/audio.js'), /voicePath\(/);
});

test('voix : sans effet pendant l’export (audio verrouillé)', function () {
  assert.match(code('js/audio.js'), /voice\([^)]*\)\s*\{\s*if \(this\.locked/);
});

test('transport : un saut arrête la voix, la pause la met en pause, la reprise la reprend', function () {
  const src = code('js/main.js');
  assert.match(corps(src, 'seekTo'), /audio\.stopVoice\(\)/);
  assert.match(corps(src, 'pause'), /audio\.pauseVoice\(\)/);
  assert.match(corps(src, 'play'), /audio\.resumeVoice\(\)/);
  // À l'arrêt de fin de double page, la voix continue (comme la musique).
  assert.doesNotMatch(corps(src, 'onHold'), /Voice/);
});

test('transport : changer de langue et exporter arrêtent la voix', function () {
  const src = code('js/main.js');
  assert.match(src, /lang\.set\([\s\S]{0,200}audio\.stopVoice\(\)/);
  assert.match(src, /exportBtn\.addEventListener[\s\S]{0,600}audio\.stopVoice\(\)/);
});

test('interface : numéro de page dans la zone de progression, calculé par spreads.pagesShown', function () {
  assert.match(lire('index.html'), /class="progress"[\s\S]*id="pageNum"/);
  assert.match(code('js/main.js'), /spreads\.pagesShown\(/);
  assert.doesNotMatch(lire('css/style.css'), /body:not\(\.debug\)\s+\.page-num/);   // visible sans ?debug
});

test('Menu : une entrée par double page (plage de pages), clic = début de la double page puis lecture', function () {
  const src = code('js/main.js');
  assert.match(src, /spreads\.map\(function \(sp, i\)[\s\S]{0,800}goSpread\(i\)/);
  assert.match(corps(src, 'goSpread'), /seekTo\(spreads\[i\]\.start\);\s*play\(\)/);
  assert.doesNotMatch(src, /moment-time">' \+ D\.formatTime/);
});

test('PDF : un moment sans titre n’écrit pas de titre', function () {
  assert.match(code('js/export.js'), /if \(title\)/);
});

test('scène : l’image d’une page seule va dans spreads.bgRect ; sans image, l’aplat de spreads.plainColor', function () {
  const src = code('js/scene.js');
  assert.match(src, /spreads\.bgRect\(/);
  assert.match(src, /spreads\.plainColor\(/);
  // Plus de « new PIXI.Sprite(T.backgrounds[...]) » sans garde (plantage de bake, point ouvert S#2-01).
  assert.doesNotMatch(src, /new PIXI\.Sprite\(T\.backgrounds\[sp\.bg\]\)/);
});

test('assets : un fond qui ne se charge pas est signalé sans faire échouer les autres', function () {
  const src = code('js/assets.js');
  assert.match(src, /allSettled/);
  assert.match(src, /console\.warn/);
});

