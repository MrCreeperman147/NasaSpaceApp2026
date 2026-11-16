/* timeline.js : la timeline GSAP maîtresse. C'est la seule source de vérité
   pour le temps : l'animation, l'audio et l'export PDF s'alignent sur elle.

   Chaque tween est placé à une position absolue (dernier argument). Les
   tweens des animations sont dans js/anim/<clé>.js (aucune depuis S#2-03) ;
   les temps viennent de Demo.book (spreads.js). */
(function () {
  const D = window.Demo;

  D.timeline = {
    build(scene, onHold) {
      gsap.registerPlugin(PixiPlugin);
      PixiPlugin.registerPIXI(PIXI);

      // Par défaut, GSAP ralentit la timeline quand une image met trop de temps
      // à s'afficher. Avec une piste audio, on préfère sauter des images et
      // rester calé sur l'horloge réelle, donc sur le son.
      gsap.ticker.lagSmoothing(0);

      const book = D.book;
      const DUR = book.duration;

      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });

      /* Animations : chacune pose ses propres tweens, décalés du début de sa
         première double page (js/anim/*.js, méthode build). */
      Object.keys(scene.animations).forEach(function (key) {
        const r = book.animations[key];
        scene.animations[key].build(tl, r.from, r.to - r.from);
      });

      /* Moments clés : un repère. (La cloche automatique a été retirée en
         S#2-02 : un effet sonore se déclare dans la page, champ « sfx ».) */
      book.keyMoments.forEach(function (km, i) {
        tl.addLabel('chapitre' + (i + 1), km.start);
      });

      /* Voix (S#2-02) : un déclencheur à l'apparition de chaque bloc qui a une
         voix (blocks.voices). La voix joue ensuite seule (audio.js), dans la
         langue courante. Vérifié avec GSAP 3.13.0 : un appel posé pile à
         l'instant d'un saut part quand la lecture repart (Préc. sur un bloc
         à « at: 0 »). */
      D.blocks.voices(book).forEach(function (v) {
        tl.call(function () { D.audio.voice(v.key, D.lang.current); }, [], v.t);
      });

      /* Effets sonores des doubles pages, à leur temps local. */
      book.spreads.forEach(function (sp) {
        (sp.sfx || []).forEach(function (e) {
          tl.call(function () { D.audio.sfx(e.key); }, [], sp.start + e.u);
        });
      });

      /* Tournages de page : la feuille elle-même est calculée à partir du temps
         dans scene.update() (voir flip.js). La timeline ne porte que le repère
         et le bruit de papier, au début de chaque tournage. */
      scene.flips.forEach(function (f, i) {
        tl.addLabel('tournage' + (i + 1), f.from);
        tl.call(function () { D.audio.sfx('page'); }, [], f.from);
      });

      /* Arrêts de fin de double page (S#2-01) : la lecture s'arrête d'elle-même
         juste avant chaque tournage et reste sur la dernière image ; c'est le
         lecteur qui tourne la page. Les instants viennent de spreads.holds
         (fonction pure). addPause (lu dans la source de GSAP 3.13.0) arrête la
         tête de lecture EXACTEMENT à l'instant, sans rien rendre au-delà, même
         après une image très longue : le bruit de papier du tournage, 0,05 s
         plus loin, ne part donc pas. Il n'agit qu'en lecture : seek() l'ignore,
         et une lecture qui part de l'instant même de l'arrêt ne s'y reprend
         pas (Suiv. depuis l'arrêt). onHold(h) prévient main.js.
         Attention : après un saut PILE sur l'instant de l'arrêt (Suiv. pendant
         l'animation), la lecture repart sans s'arrêter, mais GSAP appelle quand
         même le rappel au premier rendu (trouvé à l'essai sans écran). Le
         rappel ne compte donc que si la timeline est réellement arrêtée. */
      D.spreads.holds(book, D.config.ui.nextLead).forEach(function (h) {
        tl.addPause(h.t, function () { if (tl.paused() && onHold) onHold(h); });
      });

      /* Force la durée exacte, même si le dernier tween finit plus tôt. */
      tl.set({}, {}, DUR);

      /* À chaque avancée (lecture OU seek), on recalcule ce qui dépend de t
         et on dessine une image. */
      tl.eventCallback('onUpdate', function () { scene.update(tl.time()); });

      return tl;
    }
  };
})();
