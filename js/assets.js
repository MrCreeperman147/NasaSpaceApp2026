/* assets.js : fonds des pages, chargés par PIXI.Assets depuis img/story/bgi/
   (un bundle par fond, nommé d'après la clé « bg » de la page), contrôle de
   leur taille, et ombre de la feuille qui tourne, dessinée par code.

   Les sprites de démonstration (bateau, lune, île…) ont été retirés en S#2-03
   avec l'animation « traversee ». Les sprites de l'artiste se chargent avec
       const sheet = await PIXI.Assets.load('img/story/sprites/<nom>.json');
   (planche TexturePacker ou Aseprite en 2x) ; sheet.animations.<nom> donne le
   tableau de textures d'une animation image par image. Les ajouter au
   résultat de build() pour qu'une classe de js/anim/ les reçoive (T). */
(function () {
  const D = window.Demo;
  const S = 2; // les textures sont dessinées à 2x pour rester nettes dans le PDF

  function makeCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * S);
    c.height = Math.round(h * S);
    const g = c.getContext('2d');
    g.scale(S, S);
    draw(g, w, h);
    return c;
  }
  function tex(w, h, draw) {
    return PIXI.Texture.from(makeCanvas(w, h, draw));
  }
  D.assets = {
    SCALE: 1 / S,

    /* Manifeste PIXI.Assets : un bundle par page qui a un fond (D.book.spreads,
       valeurs par défaut comprises : le fond d'une page est son id, sauf si
       elle a une couleur). Fonction pure (les chemins sont contrôlés sous
       Node, tests/projet.test.js). */
    manifest(spreads) {
      const self = this;
      return {
        bundles: spreads.filter(function (s) { return !!s.bg; }).map(function (s) {
          return { name: s.bg, assets: [{ alias: s.bg, src: self.bgPath(s.bg, D.config) }] };
        })
      };
    },

    /* Chemin du fond « bg » : img/story/bgi/<bg>.<config.bgExt> (débogage #2 de S#2-02). */
    bgPath(bg, config) { return 'img/story/bgi/' + bg + '.' + config.bgExt; },

    /* Charge les fonds de toutes les pages. Retourne { clé du fond: texture }.
       Chaque fond est chargé à part (allSettled, S#2-02) : un fichier manquant
       ou illisible est signalé en console et n'empêche pas les autres ; sa
       page prend l'aplat de repli (ui.bgFallback). */
    async loadBackgrounds(spreads) {
      const manifest = this.manifest(spreads);
      await PIXI.Assets.init({ manifest: manifest });
      const names = manifest.bundles.map(function (b) { return b.name; });
      const srcs = manifest.bundles.map(function (b) { return b.assets[0].src; });   // chemins réellement demandés
      const res = await Promise.allSettled(names.map(function (n) { return PIXI.Assets.loadBundle(n); }));
      const out = {};
      const sizes = this.sizes = {};
      res.forEach(function (r, i) {
        const n = names[i];
        const tex = r.status === 'fulfilled' && r.value && r.value[n];
        if (tex) {
          out[n] = tex;
          // Taille réelle de l'image, en pixels (contrôlée par sizeProblems, S#2-03).
          sizes[n] = { w: tex.source.pixelWidth || tex.source.width, h: tex.source.pixelHeight || tex.source.height };
        }
        else {
          // La raison de l'échec (débogage #1 de S#2-02 : un téléphone sans console).
          const why = r.status === 'rejected' ? (r.reason && r.reason.message ? r.reason.message : String(r.reason)) : 'texture absente du résultat';
          console.warn('Fond introuvable ou illisible : ' + srcs[i] + '. Aplat « ' + D.config.ui.bgFallback + ' » à la place. Raison : ' + why);
        }
      });
      return out;
    },

    /* Taille des fonds (S#2-03) : messages pour la console.
       spreads : D.book.spreads ; sizes : { clé du fond: { w, h } } (pixels réels) ;
       config.bgSize : { spread: { w, h }, page: { w, h }, maxSide }.
       - plus de maxSide pixels de côté : la carte graphique d'un téléphone la
         refuse, l'image ne s'y affiche pas (cas réel de S#2-02, PC épargné) ;
       - plus grande que le format prévu : inutilement lourde ;
       - autre proportion que le format prévu : déformée.
       Plus petite au bon format : acceptée (moins nette). */
    sizeProblems(spreads, sizes, config) {
      const B = config.bgSize, out = [], vus = {};
      spreads.forEach(function (s) {
        const z = s.bg && sizes[s.bg];
        if (!z || vus[s.bg]) return;
        vus[s.bg] = true;
        const single = s.kind === 'cover' || s.kind === 'back';
        const e = single ? B.page : B.spread;
        const nom = 'Fond ' + s.bg + ' : ' + z.w + ' × ' + z.h;
        const ratio = single ? '8:9' : '16:9';
        if (Math.max(z.w, z.h) > B.maxSide) {
          out.push(nom + ', trop grand pour un téléphone (au plus ' + B.maxSide + ' pixels de côté) : il ne s’affichera pas. Format prévu : ' + e.w + ' × ' + e.h + '.');
        } else if (z.w > e.w || z.h > e.h) {
          out.push(nom + ', plus grand que prévu (' + e.w + ' × ' + e.h + ') : inutilement lourd sur téléphone.');
        }
        if (Math.abs(z.w / z.h - e.w / e.h) > 0.01 * (e.w / e.h)) {
          out.push(nom + ', n’a pas le format prévu (' + ratio + ') : l’image sera déformée.');
        }
      });
      return out;
    },

    /* Sprite isolé de img/story/sprites/ ; null (et avertissement) s'il manque. */
    async loadSprite(nom) {
      const src = 'img/story/sprites/' + nom + '.png';
      try { return await PIXI.Assets.load(src); }
      catch (e) { console.warn('Sprite introuvable ou illisible : ' + src + '. Raison : ' + (e && e.message ? e.message : String(e))); return null; }
    },

    async build() {
      return {
        backgrounds: await this.loadBackgrounds(D.book.spreads),
        // Fusée de l'animation « spaceship » (dp05).
        ship: await this.loadSprite('ship'),
        // Capsule sous parachute de l'animation « drop » (dp06).
        droppod: await this.loadSprite('droppod'),
        // Oppy qui roule, animation « oppy_dp09 » (dp09).
        oppy_dp9: await this.loadSprite('oppy_dp9'),
        // Les découvertes, animation « discovery » (dp12).
        oppy_dp12: await this.loadSprite('oppy_dp12'),
        water_dp12: await this.loadSprite('water_dp12'),
        hotsprings_dp12: await this.loadSprite('hotsprings_dp12'),
        volcanus_dp12: await this.loadSprite('volcanus_dp12'),
        // Les astéroïdes, animation « asteroid » (dp15).
        aste_dp15: await this.loadSprite('aste_dp15'),
        // Livre : ombre portée de la feuille qui tourne (opaque à gauche, nulle à droite).
        // (La reliure n'est plus dessinée : design S#1-02.)
        pageShadow: tex(64, 8, function (g, w, h) {
          const gr = g.createLinearGradient(0, 0, w, 0);
          gr.addColorStop(0, 'rgba(0,0,0,1)');
          gr.addColorStop(0.4, 'rgba(0,0,0,0.35)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(0, 0, w, h);
        })
      };
    }
  };
})();
