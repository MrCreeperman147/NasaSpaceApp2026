/* js/anim/discovery.js : les découvertes (utilisée par dp12).

   Oppy arrive de la gauche de la double page, hors champ, à 75 % de la hauteur
   depuis le bord bas, et roule en descendant légèrement jusqu'au centre de la
   page droite, à 68 % de la hauteur depuis le bord bas. Pendant son trajet apparaissent, l'un après l'autre :
     - l'eau (water_dp12) dans le coin inférieur gauche ;
     - la source chaude (hotsprings_dp12) à 70 % de la largeur depuis le bord
       droit, 80 % de la hauteur depuis le bord bas ;
     - le volcan (volcanus_dp12) à 20 % depuis le bord droit, 70 % depuis le
       bord bas.
   Les pourcentages se mesurent sur la double page entière (1280 × 720) ; une
   position donne le centre du dessin. Oppy est au premier plan.

   Sprites : img/story/sprites/<nom>.png, chargés par assets.build() sous leur
   nom (T.oppy_dp12, T.water_dp12, T.hotsprings_dp12, T.volcanus_dp12).

   Réglages ci-dessous : DUREE et EASE du trajet d'Oppy, ARRIVEE, et pour
   chaque décor sa position, son échelle et l'instant de son apparition. */
(function () {
  const D = window.Demo;
  D.animations = D.animations || {};

  const DUREE = 6;               // durée du trajet d'Oppy, en secondes
  const EASE = 'sine.inOut';
  const CAHOTS = 1.5;            // secousses d'Oppy pendant qu'il roule, en pixels (0 : aucune)
  const APPARITION = 0.8;        // durée du fondu d'apparition d'un décor, en secondes

  // Positions : x depuis le bord DROIT, y depuis le bord BAS, en part de la double page.
  const DEPART = { bas: 0.75 };                  // hors champ à gauche, centre à 75 % depuis le bas (y = 180)
  const ARRIVEE = { droite: 0.25, bas: 0.68 };   // centre de la page droite (x = 960), y = 230

  /* Sprites. boite : contour du dessin dans le fichier (pixels du fichier) ;
     ech : échelle (fichiers en 1920 × 1280 pour une scène de 1280 × 720 → 0.5) ;
     u : instant d'apparition, en secondes depuis le début de la page (décors). */
  const OPPY = { nom: 'oppy_dp12', taille: [1920, 1280], boite: [932, 197, 1480, 861], ech: 0.5 };
  const DECORS = [
    // L'eau : posée dans le coin inférieur gauche (son dessin y est déjà, dans le fichier).
    { nom: 'water_dp12', taille: [1920, 1280], boite: [0, 726, 590, 1280], ech: 0.5, coin: true, u: 1.0 },
    { nom: 'hotsprings_dp12', taille: [1290, 860], boite: [864, 270, 1263, 561], ech: 0.5, droite: 0.70, bas: 0.80, u: 2.5 },
    { nom: 'volcanus_dp12', taille: [1920, 1280], boite: [597, 0, 1231, 453], ech: 0.5, droite: 0.20, bas: 0.70, u: 4.0 }
  ];

  function sprite(T, d) {
    const tex = T[d.nom];
    if (!tex) { console.warn('Animation discovery : img/story/sprites/' + d.nom + '.png non chargé.'); return null; }
    const s = new PIXI.Sprite(tex);
    const b = d.boite, t = d.taille;
    if (d.coin) s.anchor.set(0, 1);                                            // coin inférieur gauche du fichier
    else s.anchor.set((b[0] + b[2]) / 2 / t[0], (b[1] + b[3]) / 2 / t[1]);     // centre du dessin
    s.scale.set(d.ech);
    return s;
  }

  D.animations.discovery = class Discovery extends PIXI.Container {
    /* T : textures de D.assets.build() ; W, H : taille de la scène. */
    constructor(T, W, H) {
      super();
      this.state = { p: 0 };     // avancement d'Oppy (0 : hors champ, 1 : arrivé), animé par la timeline

      // Décors d'abord (derrière), Oppy en dernier (premier plan).
      this.decors = [];
      DECORS.forEach(function (d) {
        const s = sprite(T, d);
        if (!s) return;
        if (d.coin) s.position.set(0, H);
        else s.position.set(W - d.droite * W, H - d.bas * H);
        s.alpha = 0;
        this.addChild(s);
        this.decors.push({ s: s, d: d });
      }, this);

      this.oppy = sprite(T, OPPY);
      if (this.oppy) {
        const b = OPPY.boite;
        const demi = { w: (b[2] - b[0]) / 2 * OPPY.ech, h: (b[3] - b[1]) / 2 * OPPY.ech };
        this.depart = { x: -demi.w, y: H - DEPART.bas * H };                   // hors champ, à gauche
        this.arrivee = { x: W - ARRIVEE.droite * W, y: H - ARRIVEE.bas * H };
        this.addChild(this.oppy);
      }
      this.update(0);
    }

    /* Position d'Oppy selon l'avancement ; petites secousses tant qu'il roule. */
    update(a) {
      if (!this.oppy) return;
      const p = this.state.p;
      const roule = p > 0 && p < 1 ? 1 : 0;
      this.oppy.x = this.depart.x + (this.arrivee.x - this.depart.x) * p;
      this.oppy.y = this.depart.y + (this.arrivee.y - this.depart.y) * p - roule * CAHOTS * Math.abs(Math.sin(a * 18));
    }

    /* Trajet d'Oppy et apparition des décors, posés sur la timeline à partir de t0. */
    build(tl, t0, dur) {
      this.decors.forEach(function (x) {
        const e = x.d.ech;
        tl.fromTo(x.s, { alpha: 0 }, { alpha: 1, duration: APPARITION, ease: 'power1.out' }, t0 + x.d.u);
        tl.fromTo(x.s.scale, { x: e * 0.85, y: e * 0.85 }, { x: e, y: e, duration: APPARITION, ease: 'back.out(2)' }, t0 + x.d.u);
      });
      if (this.oppy) tl.fromTo(this.state, { p: 0 }, { p: 1, duration: Math.min(DUREE, dur), ease: EASE }, t0);
    }
  };
  D.animations.discovery.DUREE = DUREE;
})();
