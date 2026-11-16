/* js/anim/drop.js : la capsule sous parachute qui arrive de l'extérieur de
   l'image en arc de cercle et s'arrête à environ 20 % de la hauteur, depuis
   le bord haut (utilisée par dp06).

   Sprite : img/story/sprites/droppod.png (1920 × 1280, fond transparent),
   chargé par assets.build() sous le nom T.droppod. Le dessin contient la
   grande capsule (repère du mouvement) et une petite au loin, en haut à
   droite, qui suit le même mouvement.

   Trajet : un arc de cercle de rayon RAYON, parcouru dans le sens horaire,
   de ANGLE_DEPART à ANGLE_ARRIVEE. La capsule entre par le bord gauche, en
   haut, file vers la droite puis s'incurve vers le bas, et s'arrête au
   milieu de l'image (centre du cercle calculé pour que l'arc finisse à la
   position d'arrivée). Avec les réglages livrés : départ vers (-247, -53),
   passage vers (278, -2) puis (540, 93), arrivée en (640, 144).

   Réglages ci-dessous : DUREE, ECHELLE, EASE, ARRIVEE_Y (part de la hauteur),
   RAYON, ANGLE_DEPART et ANGLE_ARRIVEE (forme de l'arc), BALANCE (inclinaison). */
(function () {
  const D = window.Demo;
  D.animations = D.animations || {};

  const DUREE = 2.5;            // durée du trajet, en secondes
  const ECHELLE = 0.5;          // droppod.png est en 1920 × 1280 ; la scène fait 1280 × 720
  const EASE = 'power2.out';    // arrivée en douceur
  const ARRIVEE_Y = 0.20;       // centre de la capsule à 20 % de la hauteur, depuis le haut
  const RAYON = 1600;            // rayon de l'arc, en pixels de scène
  // Angles sur le cercle, en degrés, y vers le bas : 270 = haut du cercle, 0 = droite,
  // 90 = bas. Angle croissant = sens horaire. Départ vers le haut du cercle (la capsule
  // file vers la droite, hors champ à gauche), arrivée sur le quart haut droit (elle descend).
  const ANGLE_DEPART = 266;
  const ANGLE_ARRIVEE = 299;
  const BALANCE = 0.3;          // inclinaison de la capsule le long de l'arc (0 : aucune)

  // Centre de la grande capsule dans droppod.png (boîte du dessin : x 655 à 848, y 12 à 320).
  const ANCRE = { x: 751 / 1920, y: 166 / 1280 };

  const RAD = Math.PI / 180;

  D.animations.drop = class Drop extends PIXI.Container {
    /* T : textures de D.assets.build() ; W, H : taille de la scène. */
    constructor(T, W, H) {
      super();
      this.pod = null;
      // Avancement sur l'arc (0 : départ hors champ, 1 : arrivée), animé par la timeline.
      this.state = { p: 0 };
      // Centre du cercle : l'arc finit, à l'angle ANGLE_ARRIVEE, sur la position d'arrivée.
      const arrivee = { x: W / 2, y: H * ARRIVEE_Y };
      this.centre = {
        x: arrivee.x - RAYON * Math.cos(ANGLE_ARRIVEE * RAD),
        y: arrivee.y - RAYON * Math.sin(ANGLE_ARRIVEE * RAD)
      };
      if (!T.droppod) { console.warn('Animation drop : img/story/sprites/droppod.png non chargé.'); return; }
      const s = new PIXI.Sprite(T.droppod);
      s.anchor.set(ANCRE.x, ANCRE.y);
      s.scale.set(ECHELLE);
      this.addChild(s);
      this.pod = s;
      this.update(0);
    }

    /* Place la capsule sur l'arc selon l'avancement (state.p, posé par la timeline). */
    update(a) {
      if (!this.pod) return;
      const angle = (ANGLE_DEPART + (ANGLE_ARRIVEE - ANGLE_DEPART) * this.state.p) * RAD;
      this.pod.x = this.centre.x + RAYON * Math.cos(angle);
      this.pod.y = this.centre.y + RAYON * Math.sin(angle);
      this.pod.rotation = (angle - ANGLE_ARRIVEE * RAD) * BALANCE;   // droite à l'arrivée
    }

    /* Trajet posé sur la timeline maîtresse, à partir de t0 (début de dp06). */
    build(tl, t0, dur) {
      if (!this.pod) return;
      tl.fromTo(this.state, { p: 0 }, { p: 1, duration: Math.min(DUREE, dur), ease: EASE }, t0);
    }
  };
  D.animations.drop.DUREE = DUREE;
})();
