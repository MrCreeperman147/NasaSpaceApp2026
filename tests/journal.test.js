/* Tests du débogage #1 de S#2-02 : journal de la console affiché à l'écran
   sous ?debug (le téléphone n'a pas de console accessible), et bilan de
   démarrage. Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const lire = function (f) { return fs.readFileSync(path.join(RACINE, f), 'utf8'); };
const code = function (f) { return lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1'); };
const D = charger(['js/journal.js']);

test('journal : une ligne par message, type puis texte ; erreurs, objets et valeurs vides lisibles', function () {
  const J = D.journal;
  assert.equal(J.format('warn', ['Fond introuvable', 'dp01']), 'warn Fond introuvable dp01');
  const e = new Error('boom'); e.name = 'TypeError';
  assert.equal(J.format('error', [e]), 'error TypeError: boom');
  assert.equal(J.format('info', [{ a: 1 }]), 'info {"a":1}');
  assert.equal(J.format('info', [null, undefined]), 'info null undefined');
  const cycle = {}; cycle.moi = cycle;
  assert.equal(J.format('info', [cycle]), 'info [object Object]');   // objet non sérialisable : pas d'exception
});

test('journal : bilan de démarrage — fonds chargés, appareil, rendu, mémoire des tournages', function () {
  const l = D.journal.summary({
    version: '0.0.4', ua: 'Android 14', dpr: 2.75, renderer: 'webgl2', resolution: 2, maxTexture: 4096,
    expected: ['cover', 'dp01', 'dp02'], loaded: ['dp01'], flips: 8, W: 1280, H: 720, secure: false
  });
  assert.equal(l.length, 4);
  const s = l.join('\n');
  assert.match(s, /Version 0\.0\.4/);
  assert.match(s, /Fonds chargés : 1 \/ 3/);
  assert.match(s, /manquants : cover, dp02/);
  assert.match(s, /densité 2\.75/);
  assert.match(s, /webgl2/);
  assert.match(s, /texture max 4096/);
  // 8 tournages × 2 images × 1280 × 720 × résolution² × 4 octets = 225 Mo (de 1 048 576 octets)
  assert.match(s, /tournages : 16 images, 225 Mo/);
  assert.match(s, /contexte sécurisé : non/);
});

test('journal : bilan sans fond manquant', function () {
  const s = D.journal.summary({ version: 'x', ua: '', dpr: 1, renderer: 'webgl', resolution: 1, maxTexture: 8192,
    expected: ['a'], loaded: ['a'], flips: 1, W: 1280, H: 720, secure: true }).join('\n');
  assert.match(s, /Fonds chargés : 1 \/ 1/);
  assert.doesNotMatch(s, /manquants/);
});

test('journal : chargé en premier (avant les librairies), actif seulement sous ?debug', function () {
  const html = lire('index.html');
  const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g)).map(function (m) { return m[1]; });
  assert.equal(scripts[0], 'js/journal.js');
  assert.match(code('js/journal.js'), /debug\\b/);
  assert.equal(D.journal.active, false);    // pas de « location » sous Node : inactif
});

test('fond introuvable : le message donne la raison de l’échec', function () {
  assert.match(code('js/assets.js'), /r\.reason[\s\S]{0,300}Fond introuvable[^;]*Raison : ' \+ why/);
});

test('démarrage : bilan affiché sous ?debug, perte du contexte WebGL signalée', function () {
  const src = code('js/main.js');
  assert.match(src, /journal\.summary\(/);
  assert.match(src, /webglcontextlost/);
  assert.match(code('js/scene.js'), /backgrounds:\s*Object\.keys\(T\.backgrounds\)/);
});

/* ---------- Débogage #2 : extension des fonds réglable (PNG) ---------- */

test('fonds : extension réglable (config.bgExt), PNG pour le livre livré', function () {
  const Dx = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/assets.js']);
  assert.equal(Dx.config.bgExt, 'png');
  assert.equal(Dx.assets.bgPath('dp04', Dx.config), 'img/story/bgi/dp04.png');
  assert.equal(Dx.assets.bgPath('dp04', { bgExt: 'jpg' }), 'img/story/bgi/dp04.jpg');
  Dx.assets.manifest(Dx.book.spreads).bundles.forEach(function (b) {
    assert.equal(b.assets[0].src, Dx.assets.bgPath(b.name, Dx.config));
  });
});

test('fonds : img/story/bgi ne contient que des fichiers de l’extension réglée (ancien .jpg à supprimer)', function () {
  const Dx = charger(['js/config.js']);
  fs.readdirSync(path.join(RACINE, 'img/story/bgi')).forEach(function (f) {
    assert.equal(path.extname(f), '.' + Dx.config.bgExt, f + ' : à supprimer ou à convertir');
  });
});

test('fond introuvable : le message cite le chemin réellement demandé, sans extension écrite en dur', function () {
  // Défaut trouvé au débogage #2 : le message disait toujours « .jpg », même après
  // le passage au PNG, et faisait croire que le téléphone gardait l'ancien code.
  const src = code('js/assets.js');
  assert.doesNotMatch(src, /'\.jpg'/);
  assert.match(src, /Fond introuvable ou illisible : ' \+ srcs\[i\]/);
});

test('notice : js/book.js ne parle plus de fichiers .jpg', function () {
  assert.doesNotMatch(lire('js/book.js'), /\.jpg/);
});
