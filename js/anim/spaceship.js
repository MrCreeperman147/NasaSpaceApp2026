/* js/anim/spaceship.js : la fusée qui entre par le coin bas gauche de l'écran
   et monte jusqu'au centre (utilisée par dp05).

   Sprite : img/story/sprites/ship.png (1920 × 1280, fusée dessinée au milieu
   d'un fond transparent, déjà inclinée vers le haut à droite), chargé par
   assets.build() sous le nom T.ship.

   Réglages : DUREE (secondes, 2,5 par défaut), ECHELLE (taille du sprite dans
   la scène) et EASE (courbe du mouvement), ci-dessous. */
(function () {
  const D = window.Demo;
  D.animations = D.animations || {};

  const DUREE = 2.5;          // durée du trajet coin bas gauche → centre, en secondes
  const ECHELLE = 0.5;        // ship.png est en 1920 × 1280 ; la scène fait 1280 × 720
  const EASE = 'power2.out';  // arrivée en douceur au centre

  // Centre de la fusée dans ship.png (boîte du dessin : x 478 à 1238, y 445 à 762).
  const ANCRE = { x: 858 / 1920, y: 603 / 1280 };
  // Demi-taille du dessin dans ship.png, pour partir entièrement hors champ.
  const DEMI = { w: (1238 - 478) / 2, h: (762 - 445) / 2 };

  D.animations.spaceship = class Spaceship extends PIXI.Container {
    /* T : textures de D.assets.build() ; W, H : taille de la scène. */
    constructor(T, W, H) {
      super();
      this.W = W; this.H = H;
      this.ship = null;
      if (!T.ship) { console.warn('Animation spaceship : img/story/sprites/ship.png non chargé.'); return; }
      const s = new PIXI.Sprite(T.ship);
      s.anchor.set(ANCRE.x, ANCRE.y);
      s.scale.set(ECHELLE);
      this.addChild(s);
      this.ship = s;
    }

    /* Rien ne dépend directement du temps : le trajet est un tween (build). */
    update(a) {}

    /* Trajet posé sur la timeline maîtresse, à partir de t0 (début de dp05). */
    build(tl, t0, dur) {
      if (!this.ship) return;
      const depart = { x: -DEMI.w * ECHELLE, y: this.H + DEMI.h * ECHELLE };   // hors champ, coin bas gauche
      const arrivee = { x: this.W / 2, y: this.H / 2 };                         // centre de l'écran
      tl.fromTo(this.ship, depart, { x: arrivee.x, y: arrivee.y, duration: Math.min(DUREE, dur), ease: EASE }, t0);
    }
  };
  D.animations.spaceship.DUREE = DUREE;
})();
