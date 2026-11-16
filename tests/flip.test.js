/* Tests unitaires du noyau pur du tournage de page (js/flip.js).
   Lancer : node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const charger = require('./charger.js');

const D = charger(['js/config.js', 'js/book.js', 'js/spreads.js', 'js/flip.js']);
const C = D.config;
const plan = D.flip.plan(D.book.spreads, C.flip.duration);
const geo = D.flip.options(C);
const proche = function (a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); };

test('plan : un tournage par page à partir de la deuxième, terminé à son start', function () {
  assert.equal(plan.length, D.book.spreads.length - 1);
  plan.forEach(function (f, i) {
    assert.equal(f.to, D.book.spreads[i + 1].start);
    assert.ok(proche(f.to - f.from, C.flip.duration));
  });
});

test('plan : la configuration livrée ne contient aucun conflit', function () {
  assert.equal(D.flip.conflicts(plan, D.book.keyMoments, D.book.duration).length, 0);
});

test('conflicts : un instant capturé pour le PDF pendant un tournage est signalé', function () {
  const moments = [{ start: 0, t: 1 }, { start: 5, t: 4.5 }];   // t = 4.5 tombe dans [4, 5[
  const p = D.flip.plan(moments, 1);
  assert.equal(D.flip.conflicts(p, moments, 10).length, 1);
});

test('conflicts : deux tournages qui se chevauchent sont signalés', function () {
  const moments = [{ start: 0, t: 0.1 }, { start: 3, t: 3.5 }, { start: 3.5, t: 6 }];
  const p = D.flip.plan(moments, 1);
  assert.ok(D.flip.conflicts(p, moments, 10).length >= 1);
});

test('conflicts : un tournage qui commencerait avant 0 est signalé', function () {
  const moments = [{ start: 0, t: 0.1 }, { start: 0.5, t: 2 }];
  assert.ok(D.flip.conflicts(D.flip.plan(moments, 1), moments, 10).length >= 1);
});

test('stateAt : hors tournage, pendant, et aux deux bornes', function () {
  const f = plan[1];
  assert.equal(D.flip.stateAt(plan, f.from - 0.001).index, -1);
  assert.equal(D.flip.stateAt(plan, f.from).index, 1);           // borne de début incluse
  assert.equal(D.flip.stateAt(plan, f.from).p, 0);
  assert.ok(proche(D.flip.stateAt(plan, (f.from + f.to) / 2).p, 0.5));
  assert.equal(D.flip.stateAt(plan, f.to).index, -1);            // borne de fin exclue : scène vivante
  assert.equal(D.flip.stateAt(plan, 0).index, -1);
  assert.equal(D.flip.stateAt(plan, D.book.duration).index, -1);
});

test('stateAt : les instants capturés pour le PDF sont tous hors tournage', function () {
  D.book.keyMoments.forEach(function (km) { assert.equal(D.flip.stateAt(plan, km.t).index, -1); });
});

test('profile : feuille à plat à droite à p = 0, à plat à gauche à p = 1', function () {
  [0, 0.25, 0.5, 1].forEach(function (u) {
    const a = D.flip.profile(0, u, geo), b = D.flip.profile(1, u, geo);
    assert.ok(proche(a.x, geo.spineX + u * geo.pageW, 1e-6));
    assert.ok(proche(a.z, 0, 1e-6));
    assert.ok(proche(b.x, geo.spineX - u * geo.pageW, 1e-6));
    assert.ok(proche(b.z, 0, 1e-6));
  });
});

test('profile : la feuille reste accrochée à la reliure et ne s’étire pas', function () {
  [0.1, 0.37, 0.5, 0.8].forEach(function (p) {
    const o = D.flip.profile(p, 0, geo);
    assert.ok(proche(o.x, geo.spineX) && proche(o.z, 0));
    let len = 0, prev = o;
    const N = 400;
    for (let i = 1; i <= N; i++) {
      const q = D.flip.profile(p, i / N, geo);
      len += Math.hypot(q.x - prev.x, q.z - prev.z);
      assert.ok(q.z >= prev.z - 1e-9, 'la hauteur croît vers le bord libre');
      prev = q;
    }
    assert.ok(proche(len, geo.pageW, 0.05), 'longueur ' + len);
  });
});

test('sheet : même entrée, même sortie (aucun hasard, aucune horloge)', function () {
  const a = D.flip.sheet(0.42, geo), b = D.flip.sheet(0.42, geo);
  assert.deepEqual(Array.from(a.front.positions), Array.from(b.front.positions));
  assert.deepEqual(Array.from(a.back.uvs), Array.from(b.back.uvs));
});

test('sheet : au début seul le recto est visible, à la fin seul le verso', function () {
  const a = D.flip.sheet(0, geo), b = D.flip.sheet(1, geo);
  assert.equal(a.split, 1); assert.ok(a.front.visible); assert.ok(!a.back.visible);
  assert.equal(b.split, 0); assert.ok(!b.front.visible); assert.ok(b.back.visible);
});

test('sheet : au milieu, recto et verso se partagent la feuille', function () {
  const s = D.flip.sheet(0.5, geo);
  assert.ok(s.split > 0.2 && s.split < 0.8, 'split = ' + s.split);
  assert.ok(s.front.visible && s.back.visible);
  assert.ok(s.front.shade < 1 && s.back.shade < 1);
});

test('sheet : tailles des tampons et coordonnées de texture', function () {
  const s = D.flip.sheet(0.5, geo);
  const n = (geo.cols + 1) * 2 * 2;
  assert.equal(s.front.positions.length, n);
  assert.equal(s.back.uvs.length, n);
  // Recto : moitié droite de l'image « avant » (U de 0,5 à 0,5 + split/2).
  assert.ok(proche(s.front.uvs[0], 0.5));
  assert.ok(proche(s.front.uvs[geo.cols * 2], 0.5 + s.split / 2));
  // Verso : moitié gauche de l'image « après », en miroir (bord libre → U = 0).
  assert.ok(proche(s.back.uvs[0], 0.5 - s.split / 2));
  assert.ok(proche(s.back.uvs[geo.cols * 2], 0));
  // Deux rangées : V = 0 en haut, V = 1 en bas.
  assert.equal(s.front.uvs[1], 0);
  assert.equal(s.front.uvs[(geo.cols + 1) * 2 + 1], 1);
});

test('sheet : une fois posé à gauche, le verso affiche chaque pixel à sa place', function () {
  const s = D.flip.sheet(1, geo);
  for (let i = 0; i <= geo.cols; i++) {
    const x = s.back.positions[i * 2], u = s.back.uvs[i * 2];
    assert.ok(proche(x, u * geo.W, 1e-3), 'colonne ' + i);
  }
});

test('sheet : au départ, le recto recouvre exactement la page de droite', function () {
  const s = D.flip.sheet(0, geo);
  for (let i = 0; i <= geo.cols; i++) {
    assert.ok(proche(s.front.positions[i * 2], s.front.uvs[i * 2] * geo.W, 1e-3));
    assert.ok(proche(s.front.positions[i * 2 + 1], 0, 1e-3));
  }
});

test('sheet : ombres portées nulles aux extrémités, présentes au milieu', function () {
  const a = D.flip.sheet(0, geo), m = D.flip.sheet(0.3, geo), n = D.flip.sheet(0.7, geo), b = D.flip.sheet(1, geo);
  assert.equal(a.shadowRight.alpha, 0); assert.equal(a.shadowLeft.alpha, 0);
  assert.equal(b.shadowRight.alpha, 0); assert.equal(b.shadowLeft.alpha, 0);
  assert.ok(m.shadowRight.alpha > 0 && m.shadowRight.x > geo.spineX);
  assert.ok(n.shadowLeft.alpha > 0 && n.shadowLeft.x < geo.spineX);
});

test('indices : deux triangles par colonne, tous dans les bornes', function () {
  const idx = D.flip.indices(geo.cols);
  assert.equal(idx.length, geo.cols * 6);
  const max = (geo.cols + 1) * 2 - 1;
  idx.forEach(function (i) { assert.ok(i >= 0 && i <= max); });
});
