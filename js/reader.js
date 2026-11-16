/* reader.js : la préférence du lecteur, en fonctions pures (aucun appel à
   PixiJS ni au document). Testé sous Node (tests/reader.test.js).

   État du lecteur : { mode, side, spread, chosen }
     mode   : 'page' (une page à l'écran) ou 'spread' (la double page entière)
     side   : page affichée en vue page, 'left' ou 'right'…
     spread : …pour la double page d'indice « spread » seulement. Sur toute
              autre double page, le côté vaut 'left' (sideAt) : le côté revient
              donc à gauche à chaque changement de double page, quel qu'en soit
              le moyen (lecture, curseur, Menu, Préc., Suiv.), sans remise à zéro.
     chosen : vrai quand le mode vient d'un choix du lecteur (mémorisé).
   Ni le mode ni le côté ne dépendent du temps t de la timeline.
   Le stockage (localStorage, ou null) est passé en paramètre, comme dans lang.js. */
(function () {
  const D = window.Demo;
  const KEY = '48hours.view';
  const MODES = ['page', 'spread'];

  D.reader = {
    /* Vue par défaut selon la largeur de l'écran (px CSS) : double page à
       partir de ui.minSpreadWidth, page en dessous. */
    defaultMode(width, ui) { return width >= ui.minSpreadWidth ? 'spread' : 'page'; },

    /* État initial : le choix mémorisé s'il est valide, sinon la vue par défaut. */
    init(storage, width, ui) {
      let saved = null;
      try { saved = storage ? storage.getItem(KEY) : null; } catch (e) { saved = null; }
      const ok = MODES.indexOf(saved) >= 0;
      return { mode: ok ? saved : this.defaultMode(width, ui), side: 'left', spread: 0, chosen: ok };
    },

    /* Choix du lecteur : nouvel état, mémorisé. Mode inconnu : état inchangé. */
    setMode(state, mode, storage) {
      if (MODES.indexOf(mode) < 0) return state;
      try { if (storage) storage.setItem(KEY, mode); } catch (e) { /* stockage bloqué : le mode change quand même */ }
      return Object.assign({}, state, { mode: mode, chosen: true });
    },

    /* Redimensionnement : la vue par défaut suit la largeur tant que le
       lecteur n'a rien choisi. */
    resize(state, width, ui) {
      if (state.chosen) return state;
      return Object.assign({}, state, { mode: this.defaultMode(width, ui) });
    },

    /* Côté affiché sur la double page d'indice i. */
    sideAt(state, i) { return state.spread === i ? state.side : 'left'; },

    /* Le lecteur est sur la double page i : s'il a quitté celle où il avait
       choisi un côté, ce choix est oublié (côté gauche sur i). Sans cela, un
       retour plus tard sur cette double page ressusciterait l'ancien côté.
       Rend le même état si rien ne change. */
    follow(state, i) {
      return state.spread === i ? state : Object.assign({}, state, { side: 'left', spread: i });
    },

    /* Nouvel état avec le côté « side » sur la double page i. */
    setSide(state, side, i) { return Object.assign({}, state, { side: side, spread: i }); },

    /* Page affichée sur la double page d'indice i : 'left', 'right', ou null
       quand les deux pages sont visibles (vue double page). La couverture n'a
       qu'une page, la droite ; la quatrième de couverture, la gauche.
       Sert au miroir du texte pour les lecteurs d'écran. */
    shownPage(state, spread, i) {
      if (spread.kind === 'cover') return 'right';
      if (spread.kind === 'back') return 'left';
      return state.mode === 'page' ? this.sideAt(state, i) : null;
    },

    /* L'autre mode (bouton du Menu). */
    other(mode) { return mode === 'page' ? 'spread' : 'page'; }
  };
})();
