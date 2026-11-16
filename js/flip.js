/* flip.js : noyau pur du tournage de page (aucun appel à PixiJS, GSAP ou Howler).

   Le livre est ouvert en double page : la scène (W x H) s'étale sur les deux
   pages, l'axe du tournage est au milieu (aucune reliure n'est dessinée).
   À chaque changement de double page, la feuille de droite pivote autour de
   cet axe et vient se poser à gauche.

   Tout ce fichier est une fonction du temps t de la timeline (ou de la
   progression p qui en découle) : même entrée, même sortie. C'est ce qui
   garantit que timeline.seek(t) redonne la même image, y compris au milieu
   d'un tournage. Ces fonctions sont testées sous Node (tests/flip.test.js). */
(function () {
  const D = window.Demo;
  const PI = Math.PI;

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Angles de la feuille pour une progression p (0 = à plat à droite,
     1 = à plat à gauche). Le bord libre est en avance sur la reliure :
     la feuille forme un arc de cercle, plus ou moins marqué selon « curl ». */
  function angles(p, o) {
    const q = 0.5 - 0.5 * Math.cos(PI * clamp01(p));   // départ et arrivée en douceur
    const k = 1 + o.curl;
    const spine = PI * Math.pow(q, k);                 // angle au niveau de la reliure
    const edge = PI * (1 - Math.pow(1 - q, k));        // angle au bord libre
    return { q: q, spine: spine, delta: edge - spine };
  }

  /* Position d'un point de la feuille, à la fraction u de sa largeur
     (0 = reliure, 1 = bord libre). x : position à l'écran, z : hauteur
     au-dessus du livre. La longueur de la feuille est conservée. */
  function pointAt(a, u, o) {
    const alpha = a.spine + a.delta * u;
    if (a.delta < 1e-6) {
      return { x: o.spineX + o.pageW * u * Math.cos(a.spine), z: o.pageW * u * Math.sin(a.spine), alpha: alpha };
    }
    return {
      x: o.spineX + o.pageW * (Math.sin(alpha) - Math.sin(a.spine)) / a.delta,
      z: o.pageW * (Math.cos(a.spine) - Math.cos(alpha)) / a.delta,
      alpha: alpha
    };
  }

  D.flip = {
    /* Réglages géométriques, tirés de la configuration. */
    options(config) {
      const f = config.flip;
      return {
        W: config.W, H: config.H,
        spineX: config.W / 2,      // la reliure est au milieu de la scène
        pageW: config.W / 2,       // largeur d'une page
        cols: f.cols, curl: f.curl, lift: f.lift, dark: f.dark,
        shadowWidth: f.shadowWidth, shadowAlpha: f.shadowAlpha
      };
    },

    /* Liste des tournages : un par double page à partir de la deuxième.
       Le tournage se termine pile au début (start) de la double page. */
    plan(spreads, duration) {
      const out = [];
      for (let i = 1; i < spreads.length; i++) {
        out.push({ index: i - 1, from: spreads[i].start - duration, to: spreads[i].start });
      }
      return out;
    },

    /* Problèmes de configuration, sous forme de messages (liste vide = tout va bien).
       total : durée de la timeline. */
    conflicts(plan, keyMoments, total) {
      const out = [];
      plan.forEach(function (f, i) {
        if (f.from < 0) out.push('Le tournage ' + (i + 1) + ' commence avant 0.');
        if (f.to > total) out.push('Le tournage ' + (i + 1) + ' dépasse la fin de la timeline.');
        if (i > 0 && f.from < plan[i - 1].to) out.push('Les tournages ' + i + ' et ' + (i + 1) + ' se chevauchent.');
      });
      keyMoments.forEach(function (km, i) {
        plan.forEach(function (f, j) {
          if (km.t >= f.from && km.t < f.to) {
            out.push('L’instant capturé du moment clé ' + (i + 1) + ' tombe pendant le tournage ' + (j + 1) + '.');
          }
        });
      });
      return out;
    },

    /* État du livre à l'instant t : { index, p }.
       index = -1 hors tournage (la scène vivante est affichée), sinon le
       numéro du tournage en cours et sa progression p de 0 à 1.
       La borne de fin est exclue : à t = to, on revoit la scène vivante. */
    stateAt(plan, t) {
      for (let i = 0; i < plan.length; i++) {
        const f = plan[i];
        if (t >= f.from && t < f.to) return { index: i, p: (t - f.from) / (f.to - f.from) };
      }
      return { index: -1, p: 0 };
    },

    /* Un point de la feuille (utile aux tests et au réglage). */
    profile(p, u, o) {
      return pointAt(angles(p, o), u, o);
    },

    /* Géométrie complète de la feuille pour une progression p.
       La feuille est coupée en deux maillages au point où elle passe à la
       verticale (split) : le recto avant, le verso après. Chaque maillage a
       (cols + 1) colonnes et 2 rangées (haut, bas).
         recto : moitié droite de l'image « avant le tournage »
         verso : moitié gauche de l'image « après le tournage », en miroir */
    sheet(p, o) {
      const a = angles(p, o);
      const HALF = PI / 2;
      let split;                                   // fraction de la feuille dont on voit le recto
      if (a.delta < 1e-6) split = a.spine < HALF ? 1 : 0;
      else split = clamp01((HALF - a.spine) / a.delta);

      const n = o.cols + 1;
      let xMin = o.spineX, xMax = o.spineX;

      function face(u0, u1, isBack) {
        const positions = new Float32Array(n * 4);
        const uvs = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          const u = u0 + (u1 - u0) * i / o.cols;
          const pt = pointAt(a, u, o);
          // Fausse perspective : ce qui se soulève se rapproche, donc grandit un peu.
          const s = 1 + o.lift * pt.z / o.pageW;
          const U = isBack ? 0.5 - 0.5 * u : 0.5 + 0.5 * u;
          const top = i * 2, bottom = (n + i) * 2;
          positions[top] = pt.x;     positions[top + 1] = o.H / 2 - (o.H / 2) * s;
          positions[bottom] = pt.x;  positions[bottom + 1] = o.H / 2 + (o.H / 2) * s;
          uvs[top] = U;     uvs[top + 1] = 0;
          uvs[bottom] = U;  uvs[bottom + 1] = 1;
          if (pt.x < xMin) xMin = pt.x;
          if (pt.x > xMax) xMax = pt.x;
        }
        // Assombrissement : plus la face est inclinée, moins elle reçoit de lumière.
        const mid = a.spine + a.delta * (u0 + u1) / 2;
        return { positions: positions, uvs: uvs, visible: u1 - u0 > 1e-4, shade: 1 - o.dark * Math.sin(mid) };
      }

      const front = face(0, split, false);
      const back = face(split, 1, true);

      // Ombres portées sur les pages du dessous, de part et d'autre de la feuille.
      let s = Math.sin(PI * a.q);
      if (s < 1e-9) s = 0;                         // feuille à plat : aucune ombre
      const right = xMax > o.spineX + 0.5;
      const left = xMin < o.spineX - 0.5;
      return {
        split: split,
        front: front,
        back: back,
        shadowRight: { x: xMax, width: o.shadowWidth * s, alpha: right ? o.shadowAlpha * s : 0 },
        shadowLeft: { x: xMin, width: o.shadowWidth * s, alpha: left ? o.shadowAlpha * s : 0 }
      };
    },

    /* Indices des triangles d'un maillage de « cols » colonnes sur 2 rangées. */
    indices(cols) {
      const out = new Uint32Array(cols * 6);
      const n = cols + 1;
      for (let i = 0; i < cols; i++) {
        const a = i, b = i + 1, c = n + i, d = n + i + 1;
        out.set([a, b, c, b, d, c], i * 6);
      }
      return out;
    }
  };
})();
