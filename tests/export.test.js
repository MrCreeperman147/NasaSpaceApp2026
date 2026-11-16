/* Tests de l'export PDF au format ebook (S#1-05) : fonctions pures de
   js/export.js. Les lignes de texte, mesurées par PixiJS dans le navigateur,
   sont injectées ici. Lancer depuis la racine : node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charger = require('./charger.js');

const RACINE = path.join(__dirname, '..');
const FICHIERS = ['js/config.js', 'js/book.js', 'js/spreads.js', 'js/blocks.js', 'ts/fr/ui.js', 'ts/en/ui.js', 'js/lang.js', 'ts/fr/book.js', 'ts/en/book.js', 'js/export.js'];
const D = charger(FICHIERS);
const X = D.exporter, P = D.config.pdf, S = 190 / 640;   // 0,296875 mm par pixel de la scène
const json = function (v) { return JSON.parse(JSON.stringify(v)); };
const proche = function (a, b, e) { return Math.abs(a - b) <= (e || 1e-9); };
const plan = function () { return json(X.plan(D.book)); };
// Lignes factices : une ligne par bloc, ligne de base à 30 px du haut du texte.
const uneLigne = function (texte) { return function () { return [{ text: texte || 'Une ligne', width: 200, baseline: 30 }]; }; };

/* ---------- configuration ---------- */

test('config.pdf : A4 portrait, image 8:9 de 190 mm dans les marges, échelle 0,296875 mm/px', function () {
  assert.equal(P.W, 210); assert.equal(P.H, 297);
  assert.equal(P.image.w, 190);
  assert.ok(proche(P.image.h, 190 * 9 / 8));
  assert.ok(P.image.x >= P.margin && P.image.x + P.image.w <= P.W - P.margin);
  assert.ok(P.image.y + P.image.h <= P.footer.y1);
  assert.ok(P.footer.y2 <= P.H - P.margin + 1e-9);
  assert.equal(X.mm(640), 190);
  assert.equal(X.mm(28), 28 * S);
  assert.equal(P.resolution, 2);
  assert.ok(P.jpegQuality > 0 && P.jpegQuality <= 1);
  assert.ok(P.title.minSize > 0 && P.title.minSize <= P.title.size);
});

test('config.pdf : les polices du PDF sont les fichiers de l’écran (@font-face), présents dans css/fonts', function () {
  const css = fs.readFileSync(path.join(RACINE, 'css/style.css'), 'utf8');
  ['title', 'body'].forEach(function (k) {
    const f = P.fonts[k].file;
    assert.match(f, /^css\/fonts\/[^/]+\.ttf$/);
    assert.ok(fs.existsSync(path.join(RACINE, f)), f + ' absent');
    assert.ok(css.indexOf('url("fonts/' + path.basename(f) + '")') >= 0 || css.indexOf("url('fonts/" + path.basename(f) + "')") >= 0 || css.indexOf('url(fonts/' + path.basename(f) + ')') >= 0, f + ' absent du @font-face');
    assert.ok(P.fonts[k].name);
  });
  // Chaque style de texte du livre a une police du PDF.
  Object.keys(D.config.ui.textStyles).forEach(function (s) { assert.ok(P.fonts[D.config.ui.textStyles[s].font]); });
});

test('pt : conversion des millimètres en points', function () {
  assert.ok(proche(X.pt(25.4), 72));
  assert.ok(proche(X.pt(X.mm(28)), 28 * S * 72 / 25.4));   // corps : 23,56 pt
});

/* ---------- plan des pages ---------- */

// Nombre de pages du PDF du livre livré : la couverture, deux pages par moment des
// doubles pages, la quatrième de couverture (une page).
const N = 1 + 2 * (D.book.keyMoments.length - 2) + 1;

test('plan : la couverture, deux pages (gauche, droite) par moment, puis les crédits', function () {
  const p = plan();
  assert.equal(p.length, N);
  assert.ok(N > 2);
  p.forEach(function (pg, i) { assert.equal(pg.index, i + 1); assert.equal(pg.total, N); });
});

test('plan : la 1re page est la page droite de la couverture, à l’instant de son moment', function () {
  const c = plan()[0];
  assert.equal(c.kind, 'cover');
  assert.equal(c.momentId, 'cover.m1');
  assert.deepEqual(c.frame, { x: 640, y: 0, w: 640, h: 720 });
  assert.equal(c.t, D.book.keyMoments[0].t);
  assert.equal(c.spread, 0);
});

test('plan : gauche puis droite, même instant, cadres de la scène', function () {
  const p = plan().slice(1, -1);   // sans la couverture ni les crédits (S#2-01)
  for (let i = 0; i < p.length; i += 2) {
    const g = p[i], d = p[i + 1];
    assert.equal(g.kind, 'left'); assert.equal(d.kind, 'right');
    assert.equal(g.momentId, d.momentId);
    assert.equal(g.t, d.t);
    assert.deepEqual(g.frame, { x: 0, y: 0, w: 640, h: 720 });
    assert.deepEqual(d.frame, { x: 640, y: 0, w: 640, h: 720 });
  }
  assert.deepEqual(p.filter(function (_, i) { return i % 2 === 0; }).map(function (g) { return g.momentId; }),
    D.book.keyMoments.slice(1, -1).map(function (km) { return km.id; }));
});

test('plan : le temps local u de chaque page est celui du moment dans sa double page', function () {
  plan().forEach(function (pg) {
    const sp = D.book.spreads[pg.spread];
    assert.ok(proche(pg.u, pg.t - sp.start), pg.momentId);
    assert.ok(pg.u >= 0 && pg.u < sp.end - sp.start);
  });
});

test('plan : une page sans texte est exportée quand même (page droite de dp02, son bloc retiré)', function () {
  const d = plan().find(function (pg) { return pg.momentId === 'dp02.m1' && pg.kind === 'right'; });
  assert.ok(d);
  const livre = sansBloc(2, 'right');
  assert.deepEqual(json(X.textOps(d, livre, uneLigne(), D.config)), []);
});

test('plan : même livre, même plan (ne dépend ni de la vue du lecteur, ni du côté, ni du zoom)', function () {
  assert.equal(X.plan.length, 1);          // seul argument : le livre
  assert.deepEqual(plan(), plan());
});

/* ---------- texte à sa place ---------- */

function page(id, kind) { return plan().find(function (pg) { return pg.momentId === id && pg.kind === kind; }); }
const PAD = D.config.ui.blockPad;
// Blocs de dp01 dans le livre livré : t1 à gauche, t2 à droite, affichés en permanence.
const G1 = D.book.spreads[1].blocks[0], D1 = D.book.spreads[1].blocks[1];
// Copie du livre où l'on modifie un bloc (cas absents du livre livré).
function avecBloc(i, k, champs) { const b = json(D.book); Object.assign(b.spreads[i].blocks[k], champs); return b; }
function sansBloc(i, cote) { const b = json(D.book); b.spreads[i].blocks = b.spreads[i].blocks.filter(function (x) { return x.page !== cote; }); return b; }

test('textOps : page gauche, bloc à gauche, x et ligne de base convertis en mm', function () {
  const ops = json(X.textOps(page('dp01.m1', 'left'), D.book, uneLigne('Voici'), D.config));
  assert.equal(ops.length, 1);
  const o = ops[0], st = D.config.ui.textStyles[G1.style];
  assert.equal(o.text, 'Voici');
  assert.ok(proche(o.x, 10 + (G1.box.x + PAD) * S));                // boîte x + marge
  assert.ok(proche(o.y, 24 + (G1.box.y + PAD + 30) * S));           // boîte y + marge + ligne de base 30
  assert.equal(o.align, 'left');
  assert.equal(o.font, 'body');
  assert.ok(proche(o.size, X.pt(st.size * S)));
  assert.equal(o.color, D.config.palette[st.color]);
  assert.ok(proche(o.width, 200 * S));
});

test('textOps : page droite, x relatif à la page (pas à la scène)', function () {
  const ops = json(X.textOps(page('dp01.m1', 'right'), D.book, uneLigne(), D.config));
  assert.equal(ops.length, 1);
  assert.ok(proche(ops[0].x, 10 + (D1.box.x + PAD) * S));        // et non 10 + (640 + x + marge) × S
});

test('textOps : seuls les blocs de la page capturée (dp01 : un à gauche, un à droite)', function () {
  const g = json(X.textOps(page('dp01.m1', 'left'), D.book, function (b) { return [{ text: b.key, width: 10, baseline: 30 }]; }, D.config));
  const d = json(X.textOps(page('dp01.m1', 'right'), D.book, function (b) { return [{ text: b.key, width: 10, baseline: 30 }]; }, D.config));
  assert.deepEqual(g.map(function (o) { return o.text; }), ['dp01.t1']);
  assert.deepEqual(d.map(function (o) { return o.text; }), ['dp01.t2']);
});

test('textOps : bloc pas encore apparu → rien (bloc de droite de dp01 retardé après la capture)', function () {
  const pg = page('dp01.m1', 'right');
  assert.deepEqual(json(X.textOps(pg, avecBloc(1, 1, { at: pg.u + 1 }), uneLigne(), D.config)), []);
});

test('textOps : bloc en plein fondu → rien d’écrit (le texte de l’image serait à demi transparent)', function () {
  const pg = page('dp01.m1', 'left');
  const livre = avecBloc(1, 0, { at: 0.3, fade: 0.4 });
  pg.u = 0.3 + 0.2;                                     // en plein fondu
  assert.deepEqual(json(X.textOps(pg, livre, uneLigne(), D.config)), []);
  pg.u = 0.3 + 0.4;                                     // fin exacte du fondu : opacité 1
  assert.equal(json(X.textOps(pg, livre, uneLigne(), D.config)).length, 1);
});

test('textOps : couverture, titre centré sur la boîte, police des titres', function () {
  const ops = json(X.textOps(plan()[0], D.book, uneLigne('La traversée'), D.config));
  assert.equal(ops.length, 1);
  assert.equal(ops[0].align, 'center');
  assert.ok(proche(ops[0].x, 10 + (40 + 280) * S));     // centre de la boîte = centre de l'image
  assert.ok(proche(ops[0].x, 10 + 95));
  assert.equal(ops[0].font, 'title');
  assert.ok(proche(ops[0].size, X.pt(64 * S)));
});

test('textOps : plusieurs lignes gardent leur ligne de base mesurée ; espaces insécables remplacées', function () {
  const lignes = function () { return [{ text: 'Un\u00a0deux', width: 100, baseline: 30 }, { text: 'trois\u202f:', width: 80, baseline: 68 }]; };
  const ops = json(X.textOps(page('dp01.m1', 'left'), D.book, lignes, D.config));
  assert.deepEqual(ops.map(function (o) { return o.text; }), ['Un deux', 'trois :']);
  assert.ok(proche(ops[1].y - ops[0].y, 38 * S));
});

test('nbsp : U+00A0 et U+202F deviennent des espaces ; accents, apostrophe courbe et guillemets intacts', function () {
  assert.equal(X.nbsp('« Il\u00a0dit\u202f: l’été à Noël »'), '« Il dit : l’été à Noël »');
  assert.equal(X.nbsp(''), '');
});

test('checkOps : une ligne qui sort de l’image est signalée ; une ligne dedans ne l’est pas', function () {
  const dedans = { text: 'a', x: 20, y: 100, width: 50, align: 'left' };
  const dehors = { text: 'b', x: 180, y: 100, width: 30, align: 'left' };      // 180 + 30 > 200
  const centre = { text: 'c', x: 105, y: 100, width: 190, align: 'center' };   // 10 → 200 : juste dedans
  const haut = { text: 'd', x: 20, y: 20, width: 5, align: 'left' };           // au-dessus de l'image
  assert.deepEqual(json(X.checkOps([dedans, centre], P)), []);
  assert.equal(json(X.checkOps([dehors], P)).length, 1);
  assert.equal(json(X.checkOps([haut], P)).length, 1);
});

test('checkOps : le texte réel du livre, avec des lignes factices pleine largeur, reste dans l’image', function () {
  plan().forEach(function (pg) {
    const ops = X.textOps(pg, D.book, function (b) { return [{ text: 'x', width: D.blocks.wrapWidth(b, D.config.ui), baseline: b.box.h - 2 * D.config.ui.blockPad }]; }, D.config);
    assert.deepEqual(json(X.checkOps(ops, P)), [], pg.momentId + ' ' + pg.kind);
  });
});

/* ---------- titre et pied ---------- */

test('fitSize : 20 pt si le titre tient ; réduit par pas de 1 pt ; jamais sous 12 pt', function () {
  assert.deepEqual(json(X.fitSize(function (s) { return s * 5; }, P)), { size: 20, fits: true });   // 100 mm
  assert.deepEqual(json(X.fitSize(function (s) { return s * 10; }, P)), { size: 19, fits: true });  // 200 mm à 20 pt, 190 à 19
  assert.deepEqual(json(X.fitSize(function (s) { return s * 100; }, P)), { size: 12, fits: false });
  assert.deepEqual(json(X.fitSize(function (s) { return s * 190 / 12; }, P)), { size: 12, fits: true });   // tient tout juste à 12 pt
});

test('footer : nom du livre, « n / N », côté et instant, dans la langue courante', function () {
  const p = plan();
  D.lang.set('fr');
  assert.deepEqual(json(X.footer(p[0])), { left: D.config.title + ' · pages clés', right: '1 / ' + N, second: 'Couverture · Instant capturé : ' + D.formatTime(p[0].t) });
  assert.equal(X.footer(p[1]).second, 'Page gauche · Instant capturé : ' + D.formatTime(p[1].t));
  assert.equal(X.footer(p[2]).second, 'Page droite · Instant capturé : ' + D.formatTime(p[1].t));
  D.lang.set('en');
  assert.equal(X.footer(p[0]).second.indexOf('Cover'), 0);
  assert.equal(X.footer(p[2]).second.indexOf('Right page'), 0);
  D.lang.set('fr');
});

test('textes : les clés de l’export existent dans les deux langues', function () {
  ['pdfCover', 'pdfLeft', 'pdfRight', 'pdfBack', 'pdfFontError', 'exportHint', 'pdfHeader', 'pdfCaptured'].forEach(function (k) {
    ['fr', 'en'].forEach(function (code) { assert.ok(D.texts[code].ui[k], k + ' absent en ' + code); });
  });
});

test('export.js : aucune espace insécable en clair dans le code (échappements \\u seulement)', function () {
  const src = fs.readFileSync(path.join(RACINE, 'js/export.js'), 'utf8');
  assert.doesNotMatch(src, /[\u00a0\u202f]/);
});

test('export.js : plus d’Helvetica, jsPDF appelé seulement dans run', function () {
  const src = fs.readFileSync(path.join(RACINE, 'js/export.js'), 'utf8');
  assert.doesNotMatch(src, /helvetica/i);
  assert.doesNotMatch(src, /pdfText/);
  ['js/main.js', 'js/scene.js'].forEach(function (f) {
    assert.doesNotMatch(fs.readFileSync(path.join(RACINE, f), 'utf8'), /jspdf\.|new jsPDF/, f);
  });
});

/* ---------- S#2-01 : la quatrième de couverture (crédits) ---------- */

test('plan : la dernière page est la page gauche des crédits, seule, à l’instant de son moment', function () {
  const p = plan();
  const last = p[p.length - 1];
  assert.equal(last.kind, 'back');
  assert.equal(last.momentId, 'credits.m1');
  assert.deepEqual(last.frame, { x: 0, y: 0, w: 640, h: 720 });
  assert.ok(proche(last.t, D.book.spreads[D.book.spreads.length - 1].start + 2.0));
  assert.ok(proche(last.u, 2.0));
  // Aucune autre page des crédits : ni page droite, ni double.
  assert.equal(p.filter(function (pg) { return pg.momentId === 'credits.m1'; }).length, 1);
});

test('textOps : crédits, les blocs de la page gauche (titre centré, police des titres, puis le texte)', function () {
  const p = plan();
  const ops = json(X.textOps(p[p.length - 1], D.book, uneLigne('Crédits'), D.config));
  assert.equal(ops.length, 2);
  assert.equal(ops[0].font, 'title');
  assert.equal(ops[0].align, 'center');
  assert.ok(proche(ops[0].x, 10 + 95));                 // centre de la boîte (x 40, w 560) = centre de l'image
  assert.equal(ops[1].font, 'body');
  X.checkOps(ops, P).forEach(function (m) { assert.fail(m); });
});

test('footer : quatrième de couverture, dernière page « N / N », dans les deux langues', function () {
  const p = plan();
  D.lang.set('fr');
  const f = json(X.footer(p[p.length - 1]));
  assert.equal(f.right, N + ' / ' + N);
  assert.equal(f.second, 'Quatrième de couverture · Instant capturé : ' + D.formatTime(p[p.length - 1].t));
  D.lang.set('en');
  assert.equal(X.footer(p[p.length - 1]).second.indexOf('Back cover'), 0);
  D.lang.set('fr');
});
