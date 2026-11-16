/* js/anim/asteroid.js : les deux astéroïdes Spirit et Opportunity, qui entrent
   par la gauche de l'écran, à 30 % de la hauteur depuis le bord bas, et
   montent jusqu'au centre (utilisée par dp15). Même principe que la fusée
   (js/anim/spaceship.js).

   Sprite : img/story/sprites/aste_dp15.png (1920 × 1280, deux astéroïdes sur
   un fond transparent), chargé par assets.build() sous le nom T.aste_dp15.
   Les deux astéroïdes se déplacent ensemble, et tournent un peu sur eux-mêmes.

   Réglages : DUREE (secondes, 2,5 par défaut), ECHELLE (taille du sprite dans
   la scène), EASE (courbe du mouvement), DEPART_Y (hauteur de départ, depuis
   le bord bas) et ROTATION (tour sur eux-mêmes pendant le trajet), ci-dessous. */
(function () {
  const D = window.Demo;
  D.animations = D.animations || {};

  const DUREE = 2.5;          // durée du trajet gauche → centre, en secondes
  const ECHELLE = 0.5;        // aste_dp15.png est en 1920 × 1280 ; la scène fait 1280 × 720
  const EASE = 'power2.out';  // arrivée en douceur au centre
  const DEPART_Y = 0.30;      // départ à 30 % de la hauteur depuis le bord bas (y = 504)
  const ROTATION = 0.25;      // rotation pendant le trajet, en radians (0 : aucune)
  const ELEVATION = 0.10;     // l'arrivée remonte de 10 % de la hauteur (72 px) : y = 288 au lieu du centre (360)

  // Boîte du dessin dans aste_dp15.png : x 514 à 1334, y 131 à 706.
  const BOITE = { x0: 514, x1: 1334, y0: 131, y1: 706 };
  const ANCRE = { x: (BOITE.x0 + BOITE.x1) / 2 / 1920, y: (BOITE.y0 + BOITE.y1) / 2 / 1280 };
  // Demi-largeur du dessin, pour partir entièrement hors champ.
  const DEMI_L = (BOITE.x1 - BOITE.x0) / 2;

  D.animations.asteroid = class Asteroid extends PIXI.Container {
    /* T : textures de D.assets.build() ; W, H : taille de la scène. */
    constructor(T, W, H) {
      super();
      this.W = W; this.H = H;
      this.rocks = null;
      if (!T.aste_dp15) { console.warn('Animation asteroid : img/story/sprites/aste_dp15.png non chargé.'); return; }
      const s = new PIXI.Sprite(T.aste_dp15);
      s.anchor.set(ANCRE.x, ANCRE.y);
      s.scale.set(ECHELLE);
      this.addChild(s);
      this.rocks = s;
    }

    /* Rien ne dépend directement du temps : le trajet est un tween (build). */
    update(a) {}

    /* Trajet posé sur la timeline maîtresse, à partir de t0 (début de dp15). */
    build(tl, t0, dur) {
      if (!this.rocks) return;
      const d = Math.min(DUREE, dur);
      const haut = ELEVATION * this.H;
      const depart = { x: -DEMI_L * ECHELLE, y: this.H - DEPART_Y * this.H, rotation: -ROTATION };   // hors champ, à gauche (y = 504)
      const arrivee = { x: this.W / 2, y: this.H / 2 - haut, rotation: 0 };                                  // centre de l'écran, remonté
      tl.fromTo(this.rocks, depart, { x: arrivee.x, y: arrivee.y, rotation: arrivee.rotation, duration: d, ease: EASE }, t0);
    }
  };
  D.animations.asteroid.DUREE = DUREE;
})();
