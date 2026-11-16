/* scene.js : construit la scène PixiJS et expose :
     - update(t) : met la scène dans l'état de l'instant t et la dessine
     - animations : les animations du livre (Demo.animations), que la
                    timeline GSAP anime (timeline.js)
     - bake(tl)  : calcule une fois les images figées des tournages de page
                   et la couleur moyenne de chaque double page (spreadColors)
     - setCamera(f) : la caméra, fonction du temps t fournie par main.js (vue du lecteur)
     - setLang(tl) : texte des pages dans la langue courante (images figées refaites)
     - overflows() : blocs de texte qui débordent de leur boîte, dans chaque langue
     - capture(opts) : l'image de la scène complète, ou d'une page sans son
                   texte, pour le PDF
     - lines(i, key) : les lignes d'un bloc de texte telles que dessinées (PDF)

   La scène est un livre ouvert en double page. « world » contient le dessin :
   d'abord une vue par double page (classe Spread : son fond, ou pour la
   couverture une seule page à droite), puis les animations par-dessus, puis
   le texte des pages (un calque par double page, au-dessus des animations :
   sinon la mer de l'animation le cacherait). Une seule double page est
   visible à la fois, avec son animation et son texte.
   « pageTurn » est la feuille qui tourne. Aucune reliure n'est dessinée :
   seul l'axe du tournage, au milieu, en garde la place.
   Ces objets sont dans « camera », le conteneur que la caméra déplace et
   agrandit (voir camera.js). Le canevas garde toujours la taille de la
   scène ; en vue page, la fenêtre n'en montre que la partie centrale.

   Règle du projet : rien ne dépend de l'horloge du navigateur. L'état de la
   scène est une fonction du temps t de la timeline, donc seek(t) redonne
   toujours exactement la même image. */
(function () {
  const D = window.Demo;

  /* Vue d'une double page : un élément de scène qui étend PIXI.Container,
     reçoit sa texture de fond dans son constructeur et expose update(u),
     u étant son temps local (spreads.localTime).
     Double page ordinaire : son fond sur toute la largeur.
     Couverture : une seule page, à droite (image 8:9 ou aplat) ; la moitié
     gauche reste vide. Quatrième de couverture (crédits, S#2-01) : le miroir,
     une seule page à gauche ; la moitié droite reste vide.
     Sans image, ou si elle n'a pas pu être chargée : un aplat de la palette
     (spreads.plainColor, S#2-02).
     Ses blocs de texte (config.spreads[].blocks, voir blocks.js) sont dans
     « textLayer », un conteneur à part que la scène pose au-dessus des
     animations. Chaque bloc : une plaque optionnelle, puis le texte, retourné
     à la ligne dans sa boîte. Le texte est celui de la langue courante. */
  D.Spread = class Spread extends PIXI.Container {
    constructor(def, texture, W, H, config) {
      super();
      const palette = config.palette, ui = config.ui;
      this.def = def;
      // Rectangle de la page : la moitié droite pour la couverture, la gauche pour
      // la quatrième, toute la scène pour une double page (S#2-02).
      const r = D.spreads.bgRect(def, W, H);
      // Filtre sombre (champ « dim » de la page, de 0 à 1) : le fond est multiplié par un
      // gris (tint), sans calque transparent par-dessus, ce qui rend pareil sur tous les
      // appareils (le voile noir semi-transparent ne s'affichait pas sur Chrome mobile).
      // Le texte (textLayer, posé plus haut par la scène) n'est pas touché.
      const dim = typeof def.dim === 'number' ? Math.min(1, Math.max(0, def.dim)) : 0;
      const g = Math.round(255 * (1 - dim));
      const tint = (g << 16) | (g << 8) | g;
      if (texture) {
        const b = new PIXI.Sprite(texture);
        b.position.set(r.x, r.y);
        b.width = r.w; b.height = r.h;
        b.tint = tint;
        this.addChild(b);
      } else {
        // Sans image (ou image qui n'a pas pu être chargée) : un aplat de la palette.
        const plate = new PIXI.Graphics().rect(r.x, r.y, r.w, r.h).fill(palette[D.spreads.plainColor(def, ui)]);
        plate.tint = tint;
        this.addChild(plate);
      }

      this.textLayer = new PIXI.Container();
      this.blockViews = (def.blocks || []).map(function (b) {
        const node = new PIXI.Container();
        const o = D.blocks.origin(b);
        node.position.set(o.x, o.y);
        node.visible = false;
        if (D.blocks.hasPlate(b, ui)) {   // rien à dessiner si la plaque est transparente (S#2-01)
          // Taille fixe, celle de la boîte : elle ne dépend ni de la langue ni du texte.
          node.addChild(new PIXI.Graphics()
            .roundRect(0, 0, b.box.w, b.box.h, ui.plate.radius)
            .fill({ color: palette[ui.plate.color], alpha: ui.plate.alpha }));
        }
        const st = ui.textStyles[b.style];
        const center = b.align === 'center';
        const text = new PIXI.Text({
          text: D.lang.block(b.key),
          resolution: 2,        // net à l'écran dense comme dans la capture du PDF (2x)
          style: {
            fontFamily: ui.fonts[st.font],
            fontSize: st.size,
            fontWeight: 'normal',
            fontStyle: 'normal',
            lineHeight: Math.round(st.size * st.leading),
            fill: palette[st.color],
            align: center ? 'center' : 'left',
            wordWrap: true,
            wordWrapWidth: D.blocks.wrapWidth(b, ui),
            breakWords: false
          }
        });
        // Aligné en haut de la boîte, après la marge intérieure.
        if (center) { text.anchor.set(0.5, 0); text.position.set(b.box.w / 2, ui.blockPad); }
        else text.position.set(ui.blockPad, ui.blockPad);
        node.addChild(text);
        this.textLayer.addChild(node);
        return { block: b, node: node, text: text };
      }, this);
    }

    /* Texte des blocs dans la langue courante (D.lang). Ne dessine pas. */
    setLang() {
      this.blockViews.forEach(function (v) { v.text.text = D.lang.block(v.block.key); });
    }

    /* Hauteur de chaque texte dans chaque langue, mesurée sans dessin :
       [{ key, code, height, block }]. */
    measure(codes) {
      const out = [];
      this.blockViews.forEach(function (v) {
        codes.forEach(function (code) {
          const s = (D.texts[code] && D.texts[code].blocks && D.texts[code].blocks[v.block.key]) || '';
          out.push({ key: v.block.key, code: code, block: v.block, height: PIXI.CanvasTextMetrics.measureText(s, v.text.style).height });
        });
      });
      return out;
    }

    /* Lignes du bloc « key » telles que dessinées, dans la langue courante :
       [{ text, width, baseline }] en pixels de la scène, baseline comptée
       depuis le haut du texte. Même mesure et même formule que le dessin de
       PixiJS 8 (CanvasTextGenerator : ligne k à k × interligne + ascendante
       + (interligne − taille) / 2) : le PDF garde les mêmes retours à la ligne. */
    lines(key) {
      const v = this.blockViews.find(function (b) { return b.block.key === key; });
      if (!v) return [];
      const m = PIXI.CanvasTextMetrics.measureText(v.text.text, v.text.style);
      const shift = Math.max(0, (m.lineHeight - m.fontProperties.fontSize) / 2);
      return m.lines.map(function (text, k) {
        return { text: text, width: m.lineWidths[k], baseline: k * m.lineHeight + m.fontProperties.ascent + shift };
      });
    }

    /* État au temps local u : l'opacité de chaque bloc (fondu d'entrée). */
    update(u) {
      this.blockViews.forEach(function (v) {
        const o = D.spreads.fade(u, v.block.at, v.block.fade);
        v.node.alpha = o;
        v.node.visible = o > 0;
      });
    }
  };

  D.scene = {
    async create(host) {
      const W = D.config.W, H = D.config.H;
      const app = new PIXI.Application();
      await app.init({
        width: W, height: H,
        background: 0x040817,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoStart: false,          // pas de boucle de rendu : on dessine quand la timeline bouge
        preference: 'webgl'
      });
      host.appendChild(app.canvas);

      const T = await D.assets.build();
      const book = D.book;
      // Tout le dessin va dans « world » : c'est lui qu'on photographie pour les pages du livre.
      const world = new PIXI.Container();

      /* --- doubles pages : une vue chacune, une seule visible à la fois (voir drawWorld) --- */
      const spreadViews = book.spreads.map(function (sp) {
        // Une image absente du chargement (fichier manquant) donne null : aplat de repli.
        const v = new D.Spread(sp, (sp.bg && T.backgrounds[sp.bg]) || null, W, H, D.config);
        v.visible = false;
        world.addChild(v);
        return v;
      });

      /* --- animations : une instance par clé, partagée par les doubles pages qui la citent --- */
      const animations = {};
      Object.keys(book.animations).forEach(function (key) {
        const Anim = D.animations && D.animations[key];
        if (!Anim) { console.warn('Animation inconnue : ' + key + '.'); return; }
        const a = new Anim(T, W, H);
        a.visible = false;
        world.addChild(a);
        animations[key] = a;
      });

      /* --- texte des pages : au-dessus des animations, une double page à la fois --- */
      spreadViews.forEach(function (v) {
        v.textLayer.visible = false;
        world.addChild(v.textLayer);
      });

      /* --- livre : feuille qui tourne (sans reliure dessinée) --- */
      const flips = D.flip.plan(book.spreads, D.config.flip.duration);
      const pageTextures = flips.map(function () {
        const make = function () {
          return PIXI.RenderTexture.create({ width: W, height: H, resolution: app.renderer.resolution });
        };
        return { before: make(), after: make() };
      });
      const pageTurn = new D.PageTurn({ shadow: T.pageShadow, pages: pageTextures }, flips, D.flip.options(D.config));
      const camera = new PIXI.Container();
      camera.addChild(world, pageTurn);
      app.stage.addChild(camera);

      /* Caméra : une fonction du temps t, fournie par main.js (setCamera) à
         partir de la vue du lecteur (camera.viewAt) et du zoom de la vue
         double page. Par défaut, la vue d'ensemble. */
      const HOME = D.camera.home(W, H);
      let cameraAt = function () { return HOME; };
      const spreadColors = [];   // couleur moyenne [r, g, b] de chaque double page, remplie par bake()

      function applyCamera(cam) {
        const tr = D.camera.transform(cam, W, H);
        camera.scale.set(tr.scale);
        camera.position.set(tr.x, tr.y);
      }

      /* Met le dessin dans l'état de l'instant t, sans rien afficher :
         la double page courante (temps local) et son animation (temps de l'animation). */
      function drawWorld(t) {
        const i = D.nav.spreadAt(book.spreads, t);
        const cur = book.spreads[i];
        spreadViews.forEach(function (v, k) { v.visible = k === i; v.textLayer.visible = k === i; });
        spreadViews[i].update(D.spreads.localTime(cur, t));
        Object.keys(animations).forEach(function (key) {
          const on = cur.animation === key;
          animations[key].visible = on;
          if (on) animations[key].update(D.spreads.animTime(book, key, t));
        });
      }

      function update(t) {
        drawWorld(t);
        // Pendant un tournage, la feuille et ses images figées remplacent la scène vivante.
        world.visible = !pageTurn.update(t);
        applyCamera(cameraAt(t));
        app.render();
      }

      /* Calcule les images figées des tournages : pour chacun, la double page
         telle qu'elle est à son début (before) et à sa fin (after).
         Lit aussi, une seule fois, la couleur moyenne du fond de chaque double page
         (pour le thème adaptatif).
         À appeler une fois, quand la timeline est construite.
         seek() est silencieux : ni son, ni rappel onUpdate. */
      function bake(tl) {
        const resumeAt = tl.time();
        bakeFlips(tl);
        // Couleur moyenne : le FOND de chaque double page seul (son image, sans
        // la mer, le voilier ni rien de ce qui est dessiné par-dessus), rendu en
        // tout petit (64 x 36), puis lu. (Débogage #1 de S#1-01 : mesurer toute
        // la scène noyait la couleur du fond sous le bleu de la mer.)
        // Sans fond : sa couleur de la palette, sans mesure.
        // En cas d'échec, la double page n'a pas de couleur : le thème par défaut servira.
        const small = PIXI.RenderTexture.create({ width: 64, height: 36, resolution: 1 });
        book.spreads.forEach(function (sp, i) {
          // Sans image chargée (pas de fond, ou fichier manquant, S#2-02) : la couleur de son aplat.
          const tex = sp.bg && T.backgrounds[sp.bg];
          if (!tex) { spreadColors[i] = D.theme.parse(D.config.palette[D.spreads.plainColor(sp, D.config.ui)]); return; }
          const probe = new PIXI.Sprite(tex);   // sprite temporaire, hors de la scène
          probe.width = 64; probe.height = 36;
          try {
            app.renderer.render({ container: probe, target: small, clearColor: 0x000000 });
            spreadColors[i] = D.theme.average(app.renderer.extract.pixels(small).pixels);
          } catch (e) {
            console.warn('Couleur moyenne de la double page « ' + sp.id + ' » illisible : thème par défaut.', e);
            spreadColors[i] = null;
          } finally {
            probe.destroy();
          }
        });
        small.destroy(true);
        tl.seek(resumeAt);
        update(resumeAt);
      }

      /* Images figées des tournages seules : la double page telle qu'elle est
         au début (before) et à la fin (after) de chaque tournage, texte compris.
         Rappelée à chaque changement de langue (setLang) : sans cela, la feuille
         qui tourne montrerait le texte de l'ancienne langue. Remet ensuite la
         timeline et l'image à l'instant où elles étaient. */
      function bakeFlips(tl) {
        const resumeAt = tl.time();
        world.visible = true;
        applyCamera(HOME);       // les images figées sont toujours la scène complète
        flips.forEach(function (f, i) {
          [['before', f.from], ['after', f.to]].forEach(function (pair) {
            tl.seek(pair[1]);
            drawWorld(pair[1]);
            app.renderer.render({ container: world, target: pageTextures[i][pair[0]], clearColor: 0x040817 });
          });
        });
        tl.seek(resumeAt);
        update(resumeAt);
      }

      /* Texte des pages dans la langue courante. Un changement d'état de
         l'interface, pas du temps : ni t, ni la timeline, ni l'audio ne bougent. */
      function setLang(tl) {
        spreadViews.forEach(function (v) { v.setLang(); });
        bakeFlips(tl);
      }

      /* Blocs dont le texte ne tient pas dans sa boîte, dans l'une des langues
         (mesuré sans dessin, avec les polices chargées) : messages pour la console. */
      function overflows() {
        const out = [];
        spreadViews.forEach(function (v) {
          v.measure(D.lang.codes).forEach(function (m) {
            if (!D.blocks.fits(m.height, m.block, D.config.ui)) {
              out.push('Le texte du bloc ' + m.key + ' (« ' + m.code + ' ») déborde de sa boîte : ' +
                Math.ceil(m.height) + ' px pour ' + (m.block.box.h - 2 * D.config.ui.blockPad) + ' px.');
            }
          });
        });
        return out;
      }

      /* Image d'un cadre de la scène à résolution fixe, quel que soit l'écran :
         la qualité du PDF ne dépend pas de l'appareil.
         opts (facultatif) : frame { x, y, w, h } en pixels de la scène (défaut :
         la scène entière), resolution (défaut 2), text : false pour masquer le
         texte des blocs (pas leurs plaques) le temps de la prise, quand le PDF
         l'écrit lui-même en vrai texte.
         La capture part toujours de la scène complète : la caméra et le zoom
         sont mis de côté le temps de la prise, puis remis, comme le texte. */
      function capture(opts) {
        const o = opts || {};
        const f = o.frame || { x: 0, y: 0, w: W, h: H };
        const sx = camera.scale.x, px = camera.position.x, py = camera.position.y;
        const texts = [];
        if (o.text === false) {
          spreadViews.forEach(function (v) {
            v.blockViews.forEach(function (b) { texts.push([b.text, b.text.visible]); b.text.visible = false; });
          });
        }
        applyCamera(HOME);
        try {
          return app.renderer.extract.canvas({
            target: app.stage,
            frame: new PIXI.Rectangle(f.x, f.y, f.w, f.h),
            resolution: o.resolution || 2,
            clearColor: 0x040817
          });
        } finally {
          camera.scale.set(sx);
          camera.position.set(px, py);
          texts.forEach(function (e) { e[0].visible = e[1]; });
        }
      }

      /* Lignes d'un bloc de la double page i (voir Spread.lines). */
      function lines(i, key) { return spreadViews[i].lines(key); }

      /* Fonction t → caméra { x, y, zoom } utilisée par update(t). Ne dessine pas :
         l'appelant enchaîne avec update(t). */
      function setCamera(f) { cameraAt = f; }

      return {
        app: app,
        backgrounds: Object.keys(T.backgrounds),   // fonds réellement chargés (bilan de ?debug)
        backgroundSizes: D.assets.sizes || {},     // taille réelle de chaque fond (S#2-03)
        animations: animations,
        flips: flips,
        spreadColors: spreadColors,
        update: update,
        bake: bake,
        setCamera: setCamera,
        setLang: setLang,
        overflows: overflows,
        capture: capture,
        lines: lines
      };
    }
  };
})();
