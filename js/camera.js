/* camera.js : la caméra, en fonctions pures (aucun appel à PixiJS, GSAP,
   Howler ni au navigateur). Testé sous Node (tests/camera.test.js).

   Une caméra est { x, y, zoom } : (x, y) est le point de la scène placé au
   centre de la fenêtre, zoom 1 = la hauteur de la scène remplit la fenêtre.

   Depuis S#1-04, la forme de la fenêtre suit la vue du lecteur (reader.js) :
   16:9 en vue double page, 8:9 (une page) en vue page. La caméra reste au
   zoom 1 et ne fait que glisser horizontalement : viewAt() dit où, en
   fonction du temps t de la timeline et de la préférence du lecteur.
   En vue double page, le lecteur peut zoomer et déplacer la vue (zoomBy,
   pan) : un état de la vue, indépendant de t, que l'export PDF ignore. */
(function () {
  const D = window.Demo;

  function smooth(p) { return p * p * (3 - 2 * p); }   // départ et arrivée en douceur
  function lerp(a, b, k) { return a + (b - a) * k; }
  function between(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)); }
  const PAGE_X = { left: 320, right: 960 };   // centre de chaque page dans la scène
  const AXIS = 640;                           // axe du tournage, milieu de la double page

  D.camera = {
    /* Vue par défaut : centre de la scène, zoom 1. */
    home(W, H) { return { x: W / 2, y: H / 2, zoom: 1 }; },

    /* Ratio largeur / hauteur de la fenêtre de la scène selon la vue du lecteur. */
    ratio(mode, config) { return mode === 'page' ? (config.W / 2) / config.H : config.W / config.H; },

    /* Caméra de la vue du lecteur à l'instant t (zoom 1).
       reader : état de reader.js ; book : Demo.book ; flips : plan des
       tournages (flips[i] mène de la double page i à i + 1) ; ease : durée
       d'un glissement (ui.viewEase).
       - couverture : centrée sur sa page (droite), dans les deux vues ;
       - quatrième de couverture (crédits) : centrée sur sa page (gauche) ;
       - vue double page : le milieu de la double page ;
       - vue page : la page affichée (reader.sideAt).
       Pendant un tournage, la vue glisse vers l'axe pendant ses « ease »
       premières secondes, y reste, puis glisse vers la page gauche de la
       double page suivante pendant ses « ease » dernières secondes. Hors
       tournage, la vue est donc toujours posée : un moment, Préc. ou le Menu
       n'arrivent jamais à mi-glissement. Même t, même préférence : même vue. */
    viewAt(reader, book, flips, t, ease) {
      const spreads = book.spreads;
      const target = function (i, side) {
        if (spreads[i].kind === 'cover') return PAGE_X.right;
        if (spreads[i].kind === 'back') return PAGE_X.left;   // crédits : page gauche seule (S#2-01)
        return reader.mode === 'page' ? PAGE_X[side] : AXIS;
      };
      let x;
      const k = flips.findIndex(function (f) { return t >= f.from && t < f.to; });
      if (k < 0) {
        const i = D.nav.spreadAt(spreads, t);
        x = target(i, D.reader.sideAt(reader, i));
      } else {
        const f = flips[k];
        const e = Math.min(ease, (f.to - f.from) / 2);   // deux glissements tiennent dans le tournage
        const from = target(k, D.reader.sideAt(reader, k));
        const to = target(k + 1, 'left');
        if (e > 0 && t < f.from + e) x = lerp(from, AXIS, smooth((t - f.from) / e));
        else if (e > 0 && t >= f.to - e) x = lerp(AXIS, to, smooth((t - (f.to - e)) / e));
        else x = AXIS;
      }
      return { x: x, y: 360, zoom: 1 };
    },

    /* Mélange adouci de deux caméras (k de 0 à 1, borné) : transition de 0,4 s
       quand le lecteur change de vue ou de côté, hors de la timeline. */
    blend(a, b, k) {
      const s = smooth(Math.min(1, Math.max(0, k)));
      return { x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s), zoom: lerp(a.zoom, b.zoom, s) };
    },

    /* Ramène la caméra dans la scène : la fenêtre (viewW x H au zoom 1) ne
       montre jamais l'extérieur du livre. */
    clamp(cam, viewW, W, H) {
      const hw = viewW / (2 * cam.zoom), hh = H / (2 * cam.zoom);
      return { x: between(cam.x, hw, W - hw), y: between(cam.y, hh, H - hh), zoom: cam.zoom };
    },

    /* Transformation à appliquer au conteneur PixiJS : échelle et position
       telles que le point visé arrive au centre du canevas (W x H). */
    transform(cam, W, H) {
      return { scale: cam.zoom, x: W / 2 - cam.x * cam.zoom, y: H / 2 - cam.y * cam.zoom };
    },

    /* Vue double page : un pas de zoom (dir = 1 ou -1), borné par la configuration. */
    zoomBy(view, dir, ui, W, H) {
      const zoom = between(view.zoom + dir * ui.zoomStep, ui.zoomMin, ui.zoomMax);
      return this.clamp({ x: view.x, y: view.y, zoom: zoom }, W, W, H);
    },

    /* Vue double page : déplacement par glissement. dx, dy sont en pixels du
       canevas (taille logique) ; l'image suit le doigt. */
    pan(view, dx, dy, W, H) {
      return this.clamp({ x: view.x - dx / view.zoom, y: view.y - dy / view.zoom, zoom: view.zoom }, W, W, H);
    }
  };
})();
