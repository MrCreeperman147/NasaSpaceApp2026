/* js/anim/oppy_dp09.js : Oppy qui roule depuis la gauche de la double page et
   s'arrête sur la page droite, à 30 % de son bord droit (utilisée par dp09).

   Sprite : img/story/sprites/oppy_dp9.png (1920 × 1280, fond transparent),
   chargé par assets.build() sous le nom T.oppy_dp9.

   Réglages ci-dessous : DUREE, ECHELLE, EASE, ARRET (part de la largeur de la
   page droite, mesurée depuis son bord droit), HAUTEUR (part de la hauteur,
   mesurée depuis le bord bas) et CAHOTS (secousses pendant qu'il roule). */
(function () {
  const D = window.Demo;
  D.animations = D.animations || {};

  const DUREE = 3;              // durée du trajet, en secondes
  const ECHELLE = 0.5;          // oppy_dp9.png est en 1920 × 1280 ; la scène fait 1280 × 720
  const EASE = 'sine.out';      // ralentit avant de s'arrêter
  const ARRET = 0.30;           // centre d'Oppy à 30 % de la page droite, depuis son bord droit
  const HAUTEUR = 0.68;         // centre d'Oppy à 68 % de la hauteur, depuis le bord bas
  const CAHOTS = 1.5;           // amplitude des secousses, en pixels de scène (0 : aucune)

  // Dessin dans oppy_dp9.png : x 1035 à 1408, y 230 à 632 (bas des roues).
  const BOITE = { x0: 1035, x1: 1408, y0: 230, y1: 632 };
  const ANCRE = { x: (BOITE.x0 + BOITE.x1) / 2 / 1920, y: (BOITE.y0 + BOITE.y1) / 2 / 1280 };   // centre du dessin
  const DEMI_L = (BOITE.x1 - BOITE.x0) / 2 * ECHELLE;

  D.animations.oppy_dp09 = class OppyDp09 extends PIXI.Container {
    /* T : textures de D.assets.build() ; W, H : taille de la scène. */
    constructor(T, W, H) {
      super();
      this.rover = null;
      this.state = { p: 0 };   // avancement du trajet (0 : hors champ à gauche, 1 : arrêt), animé par la timeline
      const page = W / 2;      // largeur d'une page : la page droite va de W/2 à W
      this.depart = -DEMI_L;   // entièrement hors champ, à gauche de la double page
      this.arrivee = W - ARRET * page;
      this.hauteur = H - HAUTEUR * H;   // y du centre (le bord bas de la scène est en y = H) : 230 px
      if (!T.oppy_dp9) { console.warn('Animation oppy_dp09 : img/story/sprites/oppy_dp9.png non chargé.'); return; }
      const s = new PIXI.Sprite(T.oppy_dp9);
      s.anchor.set(ANCRE.x, ANCRE.y);
      s.scale.set(ECHELLE);
      this.addChild(s);
      this.rover = s;
      this.update(0);
    }

    /* Position selon l'avancement ; petites secousses tant qu'il roule. */
    update(a) {
      if (!this.rover) return;
      const p = this.state.p;
      this.rover.x = this.depart + (this.arrivee - this.depart) * p;
      const roule = p > 0 && p < 1 ? 1 : 0;
      this.rover.y = this.hauteur - roule * CAHOTS * Math.abs(Math.sin(a * 18));
    }

    /* Trajet posé sur la timeline maîtresse, à partir de t0 (début de dp09). */
    build(tl, t0, dur) {
      if (!this.rover) return;
      tl.fromTo(this.state, { p: 0 }, { p: 1, duration: Math.min(DUREE, dur), ease: EASE }, t0);
    }
  };
  D.animations.oppy_dp09.DUREE = DUREE;
})();
