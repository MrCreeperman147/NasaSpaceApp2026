/* Tests de cohérence du projet : ordre de chargement réel des scripts,
   chemins des fichiers cités (workflow §3.1). Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
const locaux = Array.from(html.matchAll(/<script src="([^"]+)"/g)).map(function (m) { return m[1]; })
  .filter(function (src) { return !/^https?:/.test(src); });
// Fichiers qui ne touchent ni au document ni aux librairies au chargement : chargeables sous Node.
const PURS = ['js/config.js', 'js/book.js', 'js/spreads.js', 'js/blocks.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js', 'ts/fr/book.js', 'ts/en/book.js', 'js/flip.js', 'js/nav.js', 'js/reader.js', 'js/camera.js', 'js/theme.js', 'js/assets.js', 'js/audio.js', 'js/export.js'];

test('index.html : chaque script local existe, avec la bonne casse', function () {
  assert.ok(locaux.length >= 14);
  locaux.forEach(function (src) {
    const dir = path.dirname(path.join(RACINE, src));
    assert.ok(fs.readdirSync(dir).indexOf(path.basename(src)) >= 0, src + ' introuvable');
  });
});

test('index.html : les fichiers purs se chargent dans l’ordre réel de la page', function () {
  const ordre = locaux.filter(function (src) { return PURS.indexOf(src) >= 0; });
  assert.equal(ordre.length, PURS.length);
  const D = charger(ordre);     // une dépendance utilisée avant sa définition lèverait ici
  ['config', 'book', 'spreads', 'blocks', 'texts', 'lang', 'flip', 'nav', 'reader', 'camera', 'theme', 'assets', 'audio', 'exporter'].forEach(function (k) {
    assert.ok(D[k], 'Demo.' + k + ' absent');
  });
});

test('index.html : main.js est chargé en dernier, après tous les modules', function () {
  assert.equal(locaux[locaux.length - 1], 'js/main.js');
});

test('manifeste : un bundle par fond de page (valeurs par défaut comprises), et chaque fond existe dans img/story/bgi', function () {
  const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/assets.js']);
  const m = D.assets.manifest(D.book.spreads);
  const avecFond = D.book.spreads.filter(function (s) { return !!s.bg; });
  assert.equal(m.bundles.length, avecFond.length);
  assert.equal(avecFond.length, D.book.spreads.length);   // toutes les pages ont une image, crédits compris
  m.bundles.forEach(function (b, i) {
    assert.equal(b.name, avecFond[i].bg);
    b.assets.forEach(function (a) {
      assert.match(a.src, /^img\/story\/bgi\//);
      const dir = path.dirname(path.join(RACINE, a.src));
      assert.ok(fs.readdirSync(dir).indexOf(path.basename(a.src)) >= 0, a.src + ' introuvable');
    });
  });
});

test('voix : chaque bloc avec voix du livre livré a son fichier dans sounds/va/fr et sounds/va/en', function () {
  const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/blocks.js', 'js/audio.js']);
  const v = D.blocks.voices(D.book);
  assert.ok(v.length > 0);
  v.forEach(function (x) {
    ['fr', 'en'].forEach(function (c) {
      const f = D.audio.voicePath(c, x.key);
      assert.ok(fs.readdirSync(path.join(RACINE, 'sounds/va', c)).indexOf(path.basename(f)) >= 0, f + ' introuvable');
    });
  });
});

test('fonds : la couverture a une image 8:9, les doubles pages une image 16:9', function () {
  const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/assets.js']);
  // Taille d'une image : PNG (en-tête IHDR, largeur puis hauteur, 32 bits) ou
  // JPEG (marqueur SOF0/SOF2, hauteur puis largeur, 16 bits).
  function taille(f) {
    const b = fs.readFileSync(f);
    if (b.toString('latin1', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    for (let i = 2; i < b.length;) {
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m === 0xC0 || m === 0xC2) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
    return null;
  }
  D.book.spreads.filter(function (s) { return !!s.bg; }).forEach(function (s) {
    const t = taille(path.join(RACINE, D.assets.bgPath(s.bg, D.config)));
    const r = t.w / t.h;
    if (s.kind === 'cover' || s.kind === 'back') assert.ok(Math.abs(r - 8 / 9) < 0.01, s.id + ' : ' + t.w + '×' + t.h);
    else assert.ok(Math.abs(r - 16 / 9) < 0.01, s.id + ' : ' + t.w + '×' + t.h);
  });
});

test('livre : js/book.js juste après config.js, textes du livre juste après lang.js', function () {
  const i = function (f) { return locaux.indexOf(f); };
  assert.equal(i('js/book.js'), i('js/config.js') + 1);
  assert.equal(i('ts/fr/book.js'), i('js/lang.js') + 1);
  assert.equal(i('ts/en/book.js'), i('js/lang.js') + 2);
  assert.doesNotMatch(fs.readFileSync(path.join(RACINE, 'js/config.js'), 'utf8'), /spreads:\s*\[/);
});

test('fonds : aucun ancien fichier « page-0N » ne reste dans img/story/bgi', function () {
  fs.readdirSync(path.join(RACINE, 'img/story/bgi')).forEach(function (f) {
    assert.doesNotMatch(f, /^page-/);
  });
});

test('animations : chaque clé citée par une double page a son fichier js/anim/<clé>.js, chargé par index.html avant scene.js', function () {
  const D = charger(['js/config.js', 'js/book.js']);
  const cles = D.config.spreads.map(function (s) { return s.animation; }).filter(Boolean);
  // Depuis S#2-03, le livre livré n'a plus d'animation : la règle vaut pour celles qui seront ajoutées.
  // Et chaque fichier de js/anim/ est chargé par index.html (pas d'animation oubliée).
  const dossier = path.join(RACINE, 'js/anim');
  (fs.existsSync(dossier) ? fs.readdirSync(dossier) : []).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    assert.ok(locaux.indexOf('js/anim/' + f) >= 0, 'js/anim/' + f + ' non chargé par index.html');
  });
  cles.forEach(function (k) {
    const src = 'js/anim/' + k + '.js';
    assert.ok(fs.readdirSync(path.join(RACINE, 'js/anim')).indexOf(k + '.js') >= 0, src + ' introuvable');
    assert.ok(locaux.indexOf(src) >= 0 && locaux.indexOf(src) < locaux.indexOf('js/scene.js'), src + ' absent ou chargé après scene.js');
  });
});

test('reliure : plus aucun dessin de reliure dans la scène ni dans les assets', function () {
  ['js/scene.js', 'js/assets.js'].forEach(function (f) {
    assert.doesNotMatch(fs.readFileSync(path.join(RACINE, f), 'utf8'), /T\.spine|spine\s*:/, f);
  });
});

test('style.css : chaque fichier cité par url() existe', function () {
  const css = fs.readFileSync(path.join(RACINE, 'css/style.css'), 'utf8');
  const urls = Array.from(css.matchAll(/url\(([^)]+)\)/g)).map(function (m) { return m[1].replace(/["']/g, ''); });
  assert.ok(urls.length > 0);
  urls.forEach(function (u) {
    const f = path.join(RACINE, 'css', u);
    assert.ok(fs.readdirSync(path.dirname(f)).indexOf(path.basename(f)) >= 0, u + ' introuvable');
    // Icônes de l'interface, ou polices du livre (S#1-03).
    assert.match(path.relative(RACINE, f).replace(/\\/g, '/'), /^(img\/web\/icons\/|css\/fonts\/)/);
  });
});

test('index.html : chaque identifiant lu par main.js existe dans la page', function () {
  const main = fs.readFileSync(path.join(RACINE, 'js/main.js'), 'utf8');
  const ids = Array.from(main.matchAll(/\$\('([^']+)'\)/g)).map(function (m) { return m[1]; });
  assert.ok(ids.length > 20);
  ids.forEach(function (id) { assert.ok(html.indexOf('id="' + id + '"') >= 0, 'id="' + id + '" absent de index.html'); });
});

test('textes : chaque clé demandée par le code existe dans ts/fr/ui.js', function () {
  const D = charger(['js/config.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js']);
  ['js/main.js', 'js/export.js'].forEach(function (f) {
    const code = fs.readFileSync(path.join(RACINE, f), 'utf8');
    const cles = Array.from(code.matchAll(/(?:tx|D\.lang\.get)\('([^']+)'/g)).map(function (m) { return m[1]; });
    assert.ok(cles.length > 0);
    cles.forEach(function (k) { assert.ok(D.texts.fr.ui[k] !== undefined, f + ' : clé « ' + k + ' » absente'); });
  });
});

/* ---------- S#1-03 : texte dans la page, polices du livre ---------- */

test('blocs : js/blocks.js est chargé après spreads.js et avant scene.js', function () {
  const i = function (f) { return locaux.indexOf(f); };
  assert.ok(i('js/blocks.js') > i('js/spreads.js'));
  assert.ok(i('js/blocks.js') < i('js/scene.js'));
});

test('polices : les deux fichiers TTF existent dans css/fonts et sont déclarés par @font-face', function () {
  const css = fs.readFileSync(path.join(RACINE, 'css/style.css'), 'utf8');
  const dir = fs.readdirSync(path.join(RACINE, 'css/fonts'));
  [['BerlinSansFB-Demi.ttf', 'Berlin Sans FB Demi'], ['Futura-Book.ttf', 'Futura Book']].forEach(function (p) {
    assert.ok(dir.indexOf(p[0]) >= 0, p[0] + ' introuvable');
    assert.ok(css.indexOf('url("fonts/' + p[0] + '")') >= 0, p[0] + ' non cité par @font-face');
    assert.ok(css.indexOf('font-family: "' + p[1] + '"') >= 0, p[1] + ' non déclarée');
  });
  // Une seule graisse chacune : déclarée normale, pour que le navigateur ne simule pas de gras.
  assert.equal((css.match(/@font-face/g) || []).length, 2);
  assert.equal((css.match(/font-weight: normal;/g) || []).length >= 2, true);
});

test('polices : plus aucune trace de Fraunces, IBM Plex ni Google Fonts', function () {
  const fichiers = ['index.html', 'css/style.css'].concat(
    fs.readdirSync(path.join(RACINE, 'js')).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return 'js/' + f; }),
    fs.readdirSync(path.join(RACINE, 'js/anim')).map(function (f) { return 'js/anim/' + f; }));
  fichiers.forEach(function (f) {
    const s = fs.readFileSync(path.join(RACINE, f), 'utf8');
    assert.doesNotMatch(s, /Fraunces|IBM Plex|fonts\.googleapis|fonts\.gstatic/, f);
  });
});

test('textes : aucune légende de moment ne reste dans ts/', function () {
  ['ts/fr/ui.js', 'ts/en/ui.js'].forEach(function (f) {
    assert.doesNotMatch(fs.readFileSync(path.join(RACINE, f), 'utf8'), /caption/, f);
  });
});

test('interface : la zone de texte du moment a disparu, le miroir du texte est présent', function () {
  assert.doesNotMatch(html, /momentText|momentCaption/);
  assert.match(html, /id="pageText"/);
  assert.doesNotMatch(html.match(/<div[^>]*id="pageText"[^>]*>/)[0], /aria-live/);
});

/* Lit un champ 16 bits de la table « maxp » d'un fichier TTF (répertoire des
   tables en tête du fichier). maxZones est à l'octet 14 de la table. */
function maxZones(fichier) {
  const b = fs.readFileSync(fichier);
  const n = b.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const e = 12 + i * 16;
    if (b.toString('latin1', e, e + 4) === 'maxp') return b.readUInt16BE(b.readUInt32BE(e + 8) + 14);
  }
  return null;
}

test('polices : les fichiers passent le contrôle des navigateurs (maxp.maxZones vaut 1 ou 2)', function () {
  // Le Futura-Book.ttf reçu avait maxZones = 3 : Chrome et Firefox le refusaient
  // (OTS). Le fichier livré est la version réparée (voir le rapport de S#1-03).
  ['BerlinSansFB-Demi.ttf', 'Futura-Book.ttf'].forEach(function (f) {
    const z = maxZones(path.join(RACINE, 'css/fonts', f));
    assert.ok(z === 1 || z === 2, f + ' : maxZones = ' + z);
  });
});

/* ---------- S#1-04 : vues du lecteur ---------- */

test('vues : reader.js est chargé après nav.js et avant camera.js (viewAt les utilise)', function () {
  const i = function (f) { return locaux.indexOf(f); };
  assert.ok(i('js/reader.js') > i('js/nav.js'));
  assert.ok(i('js/reader.js') < i('js/camera.js'));
});

test('vues : plus de disposition « mobile » ni « complete », ni de points de passage de caméra', function () {
  const css = fs.readFileSync(path.join(RACINE, 'css/style.css'), 'utf8');
  const main = fs.readFileSync(path.join(RACINE, 'js/main.js'), 'utf8');
  assert.doesNotMatch(css, /data-view="(complete|mobile)"/);
  assert.doesNotMatch(main + html, /modeFor|viewWidth|config\.camera|C\.camera/);
  assert.match(html, /id="viewPage"/); assert.match(html, /id="viewSpread"/);
});
