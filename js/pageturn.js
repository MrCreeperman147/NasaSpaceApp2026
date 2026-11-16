/* pageturn.js : la feuille qui tourne, en PixiJS.

   Élément de scène : étend PIXI.Container, reçoit ses textures dans son
   constructeur et expose update(t). Toute la géométrie vient de flip.js
   (fonctions pures) ; ce fichier se contente de l'appliquer aux maillages.

   Pendant un tournage, quatre morceaux d'image sont affichés :
     - dessous à droite : la page de droite d'APRÈS le tournage
     - dessous à gauche : la page de gauche d'AVANT le tournage
     - recto de la feuille : la page de droite d'AVANT
     - verso de la feuille : la page de gauche d'APRÈS
   Les deux images (avant, après) sont figées : elles sont calculées une fois
   au chargement par scene.bake(). */
(function () {
  const D = window.Demo;

  function gray(level) {
    const v = Math.max(0, Math.min(255, Math.round(level * 255)));
    return (v << 16) | (v << 8) | v;
  }

  D.PageTurn = class PageTurn extends PIXI.Container {
    /* textures : { shadow, pages: [{ before, after }, ...] }, une paire par tournage
       plan     : liste des tournages (D.flip.plan)
       geo      : réglages géométriques (D.flip.options) */
    constructor(textures, plan, geo) {
      super();
      this.plan = plan;
      this.geo = geo;
      this.pages = textures.pages;
      this.current = -1;            // tournage dont les textures sont en place
      this.visible = false;

      const first = this.pages[0];
      const n = (geo.cols + 1) * 4;

      // Dessous : la nouvelle double page entière, puis l'ancienne page de gauche par-dessus.
      this.under = new PIXI.Sprite(first.after);
      this.underLeft = new PIXI.Mesh({
        geometry: new PIXI.MeshGeometry({
          positions: new Float32Array([0, 0, geo.spineX, 0, 0, geo.H, geo.spineX, geo.H]),
          uvs: new Float32Array([0, 0, 0.5, 0, 0, 1, 0.5, 1]),
          indices: D.flip.indices(1)
        }),
        texture: first.before
      });

      // Ombres portées, à droite et à gauche de la feuille.
      this.shadowRight = new PIXI.Sprite(textures.shadow);
      this.shadowLeft = new PIXI.Sprite(textures.shadow);

      // La feuille : un maillage pour le recto, un pour le verso.
      const makeFace = function (texture) {
        return new PIXI.Mesh({
          geometry: new PIXI.MeshGeometry({
            positions: new Float32Array(n),
            uvs: new Float32Array(n),
            indices: D.flip.indices(geo.cols)
          }),
          texture: texture
        });
      };
      this.front = makeFace(first.before);
      this.back = makeFace(first.after);

      // Ordre d'affichage : le verso est la partie la plus haute de la feuille, donc au-dessus.
      this.addChild(this.under, this.underLeft, this.shadowRight, this.shadowLeft, this.front, this.back);
    }

    /* Met la feuille dans l'état de l'instant t.
       Retourne true si un tournage est en cours (la scène vivante doit alors être masquée). */
    update(t) {
      const st = D.flip.stateAt(this.plan, t);
      this.visible = st.index >= 0;
      if (!this.visible) return false;

      if (st.index !== this.current) {
        const pair = this.pages[st.index];
        this.under.texture = pair.after;
        this.underLeft.texture = pair.before;
        this.front.texture = pair.before;
        this.back.texture = pair.after;
        this.current = st.index;
      }

      const s = D.flip.sheet(st.p, this.geo);
      this._applyFace(this.front, s.front);
      this._applyFace(this.back, s.back);
      this._applyShadow(this.shadowRight, s.shadowRight, 1);
      this._applyShadow(this.shadowLeft, s.shadowLeft, -1);
      return true;
    }

    _applyFace(mesh, face) {
      mesh.visible = face.visible;
      if (!face.visible) return;
      mesh.geometry.positions = face.positions;   // remplace le tampon et prévient PixiJS
      mesh.geometry.uvs = face.uvs;
      mesh.tint = gray(face.shade);
    }

    /* dir : 1 = l'ombre s'étend vers la droite, -1 = vers la gauche. */
    _applyShadow(sprite, shadow, dir) {
      sprite.visible = shadow.alpha > 0 && shadow.width > 0.5;
      if (!sprite.visible) return;
      sprite.alpha = shadow.alpha;
      sprite.x = shadow.x;
      sprite.scale.set(dir * shadow.width / sprite.texture.width, this.geo.H / sprite.texture.height);
    }
  };
})();
