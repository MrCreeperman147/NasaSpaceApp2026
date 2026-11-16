/* nav.js : navigation par doubles pages et par moments clés, en fonctions
   pures (aucun appel à PixiJS, GSAP, Howler ni au navigateur).

   Les doubles pages sont celles de Demo.book (temps globaux, voir spreads.js) ;
   un tournage mène d'une double page à la suivante et finit au « start » de
   celle-ci. Un moment clé est un repère dans une double page.
   Tout est fonction du temps t de la timeline : ces fonctions sont testées
   sous Node (tests/nav.test.js) et appelées par main.js, qui ne décide rien. */
(function () {
  const D = window.Demo;

  /* Indice du dernier élément dont le « start » est <= t (0 si aucun). */
  function lastStarted(list, t) {
    let k = 0;
    for (let i = 0; i < list.length; i++) if (t >= list[i].start) k = i;
    return k;
  }

  /* Page seule (couverture à droite, quatrième de couverture à gauche) :
     pas de passage d'une page à l'autre en vue page. */
  function single(spread) { return spread.kind === 'cover' || spread.kind === 'back'; }

  /* Vrai pendant un tournage (de son début inclus à sa fin exclue). */
  function inFlip(flips, t) {
    return flips.some(function (f) { return t >= f.from && t < f.to; });
  }

  D.nav = {
    /* Double page courante à l'instant t. Pendant un tournage, c'est la double
       page sortante, puisque le tournage finit au « start » de l'entrante. */
    spreadAt(spreads, t) { return lastStarted(spreads, t); },

    /* Moment clé courant à l'instant t (le premier tant qu'aucun n'a commencé). */
    momentAt(moments, t) { return lastStarted(moments, t); },

    /* Cible du bouton Prev : début de la double page précédente, ou null sur la première. */
    prevTarget(spreads, t) {
      const i = lastStarted(spreads, t);
      return i === 0 ? null : spreads[i - 1].start;
    },

    /* Cible du bouton Next : un peu avant le tournage qui mène à la double
       page suivante (lead secondes), ou null sur la dernière.
       flips : plan des tournages (flip.plan), flips[i] mène à la double page i + 1. */
    nextTarget(spreads, flips, t, lead) {
      const i = lastStarted(spreads, t);
      if (i >= spreads.length - 1) return null;
      return Math.max(0, flips[i].from - lead);
    },

    /* Suiv. et Préc. selon la vue du lecteur (S#1-04). Retournent null quand
       le bouton est désactivé, sinon { t, side, play } :
         t    : instant où sauter, ou null pour rester à l'instant courant ;
         side : côté affiché après l'action, sur la double page de cet instant
                (vers un tournage : le côté actuel, d'où la vue part en glissant) ;
         play : lancer la lecture. Vrai pour tout saut (S#2-01) : Suiv. vers un
                tournage, Préc. vers la double page précédente, qui rejoue
                ainsi son animation. Faux quand seul le côté change.
       Vue double page : comportement de S#1-01 (tournage, début de la
       précédente). Vue page : page par page (design S#1-02 §4.4). Pendant un
       tournage, la vue page se comporte comme la vue double page.
       reader : état de reader.js. */
    next(reader, spreads, flips, t, lead) {
      const i = lastStarted(spreads, t);
      const paged = reader.mode === 'page' && !inFlip(flips, t) && !single(spreads[i]);
      if (paged && D.reader.sideAt(reader, i) === 'left') return { t: null, side: 'right', play: false };
      // Vers un tournage : le côté de la double page sortante ne change pas, la
      // vue en part en glissant (la suivante s'ouvre d'elle-même à gauche).
      const to = this.nextTarget(spreads, flips, t, lead);
      return to === null ? null : { t: to, side: D.reader.sideAt(reader, i), play: true };
    },

    prev(reader, spreads, flips, t) {
      const i = lastStarted(spreads, t);
      const paged = reader.mode === 'page' && !inFlip(flips, t);
      if (paged && !single(spreads[i]) && D.reader.sideAt(reader, i) === 'right') {
        return { t: null, side: 'left', play: false };
      }
      const to = this.prevTarget(spreads, t);
      if (to === null) return null;
      return { t: to, side: paged ? 'right' : 'left', play: true };
    },

    /* Swipe (S#2-04) : un glissement de dx, dy pixels de l'écran, du premier
       contact au lâcher. Vers la gauche → 'next' (Suiv.), vers la droite →
       'prev' (Préc.), sinon null : trop court (un toucher, un aller-retour) ou
       trop vertical (défilement). ui.swipe : { distance, ratio }. Pas de
       limite de temps (débogage de l'essai : geste reçu en retard pendant la
       lecture sur un appareil chargé). */
    swipe(dx, dy, ui) {
      const s = ui.swipe;
      if (Math.abs(dx) < s.distance || Math.abs(dx) < s.ratio * Math.abs(dy)) return null;
      return dx < 0 ? 'next' : 'prev';
    },

    /* Problèmes de configuration, sous forme de messages (liste vide = tout va bien).
       Complète flip.conflicts, qui contrôle les tournages eux-mêmes.
       book : Demo.book (ou un livre compilé de même forme). */
    checks(book, flips) {
      const out = [];
      const spreads = book.spreads, moments = book.keyMoments;
      const used = spreads.map(function () { return 0; });
      moments.forEach(function (km, i) {
        flips.forEach(function (f, j) {
          if (km.start >= f.from && km.start < f.to) {
            out.push('Le moment clé ' + (i + 1) + ' commence pendant le tournage ' + (j + 1) + '.');
          }
        });
        const real = lastStarted(spreads, km.start);
        used[real]++;
        if (km.spread !== real) {
          out.push('Le moment clé ' + (i + 1) + ' appartient à la double page ' + (km.spread + 1) + ', mais son début tombe dans la double page ' + (real + 1) + '.');
        }
      });
      used.forEach(function (n, i) {
        if (n === 0) out.push('La double page ' + (i + 1) + ' ne contient aucun moment clé.');
      });
      return out;
    }
  };
})();
