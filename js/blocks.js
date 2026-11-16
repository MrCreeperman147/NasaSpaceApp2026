/* blocks.js : les blocs de texte des pages, en fonctions pures (aucun appel à
   PixiJS ni au navigateur). Testé sous Node (tests/blocks.test.js).

   Un bloc de texte est posé sur une page (« left » ou « right ») d'une double
   page, dans une boîte en pixels de la scène RELATIVE à sa page (x de 0 à 640).
   Il apparaît à son temps local « at », avec un fondu d'entrée, et reste
   visible jusqu'à la fin de sa double page. Sa voix part à « voiceAt » (à
   défaut, à « at ») : le livre affiche tout son texte dès le début de la page
   (at: 0, fade: 0) et lit les voix l'une après l'autre. Son texte est dans
   ts/<langue>/ui.js, sous blocks['<clé>'].
   L'opacité ne dépend que du temps local u : seek(t) redonne la même image.

   Nom : « blocks » et non « texts », car Demo.texts est déjà le dictionnaire
   des langues (ts/). */
(function () {
  const D = window.Demo;
  const PAGE_W = 640, PAGE_H = 720;   // une page = la moitié de la scène
  const PAGES = ['left', 'right'];

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  /* Deux boîtes se recouvrent (se toucher ne compte pas). */
  function overlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  D.blocks = {
    /* Blocs visibles de la double page au temps local u, dans l'ordre de la
       liste : [{ block, opacity }]. Un bloc d'opacité nulle n'y figure pas. */
    visible(spread, u) {
      const out = [];
      (spread.blocks || []).forEach(function (b) {
        const o = D.spreads.fade(u, b.at, b.fade);
        if (o > 0) out.push({ block: b, opacity: o });
      });
      return out;
    },

    /* Clés des blocs visibles, page gauche d'abord puis droite (ordre de
       lecture). Sert au miroir du texte pour les lecteurs d'écran.
       page : 'left' ou 'right' pour une seule page (vue page), sinon les deux. */
    keys(spread, u, page) {
      const vis = this.visible(spread, u);
      const out = [];
      PAGES.filter(function (p) { return !page || p === page; }).forEach(function (p) {
        vis.forEach(function (v) { if (v.block.page === p) out.push(v.block.key); });
      });
      return out;
    },

    /* Voix du livre (S#2-02) : un déclencheur par bloc qui a « voice: true »,
       à l'instant global où sa voix commence : [{ t, key }], dans l'ordre du
       livre. Ce temps est « voiceAt » (temps local) s'il est donné, sinon
       l'apparition du bloc (« at ») : le texte peut être affiché dès le début
       de la page et lu plus tard. timeline.js pose un tl.call à chacun ; la
       voix joue ensuite seule (audio.js), sans suivre le temps t. */
    voiceTime(b) { return isNum(b.voiceAt) ? b.voiceAt : b.at; },

    voices(book) {
      const out = [];
      const self = this;
      book.spreads.forEach(function (sp) {
        (sp.blocks || []).forEach(function (b) {
          if (b.voice === true) out.push({ t: sp.start + self.voiceTime(b), key: b.key });
        });
      });
      return out;
    },

    /* Plaque à dessiner derrière le bloc : demandée par le bloc (plate: true)
       et visible (ui.plate.alpha > 0). À 0, rien n'est dessiné (S#2-01). */
    hasPlate(block, ui) { return !!block.plate && ui.plate.alpha > 0; },

    /* Coin haut gauche de la boîte, en coordonnées de la scène. */
    origin(block) {
      return { x: block.box.x + (block.page === 'right' ? PAGE_W : 0), y: block.box.y };
    },

    /* Largeur de retour à la ligne : la boîte moins sa marge intérieure. */
    wrapWidth(block, ui) { return block.box.w - 2 * ui.blockPad; },

    /* Un texte de hauteur « height » tient-il dans la boîte (marges comprises) ? */
    fits(height, block, ui) { return height <= block.box.h - 2 * ui.blockPad; },

    /* Taille minimale d'un style, en pixels de la scène : ui.minTextPx à
       l'écran quand une page (640 px) occupe un écran de ui.narrowRefWidth. */
    minSize(ui) { return ui.minTextPx * PAGE_W / ui.narrowRefWidth; },

    /* Problèmes de configuration des blocs (liste vide = tout va bien).
       texts : D.texts ({ fr, en }), passé en paramètre pour rester pur. */
    checks(config, book, texts) {
      const out = [];
      const ui = config.ui || {};
      const styles = ui.textStyles || {};
      const fonts = ui.fonts || {};
      const min = this.minSize(ui);
      const seen = {};

      Object.keys(styles).forEach(function (k) {
        const s = styles[k];
        if (!fonts[s.font]) out.push('Le style « ' + k + ' » cite une police inconnue : ' + s.font + '.');
        if (!isNum(s.size) || s.size < min) out.push('Le style « ' + k + ' » est trop petit pour un écran étroit (minimum ' + min.toFixed(1) + ' px).');
        // Une seule graisse par police : le navigateur simulerait le gras ou l'italique, le PDF non.
        if (s.weight && s.weight !== 'normal') out.push('Le style « ' + k + ' » demande du gras : les polices du livre n’en ont pas.');
        if (s.style && s.style !== 'normal') out.push('Le style « ' + k + ' » demande de l’italique : les polices du livre n’en ont pas.');
      });

      const flipDur = config.flip ? config.flip.duration : 0;
      const lead = ui.nextLead || 0;
      book.spreads.forEach(function (sp, i) {
        const list = sp.blocks || [];
        // Instant local de l'arrêt de la lecture (spreads.holds) ; la dernière page n'en a pas.
        const hold = i < book.spreads.length - 1 ? sp.duration - flipDur - lead : null;
        list.forEach(function (b, j) {
          const name = 'Double page « ' + sp.id + ' », bloc ' + (b.key || j + 1);
          if (!b.key) out.push(name + ' : clé absente.');
          else if (seen[b.key]) out.push('La clé de bloc « ' + b.key + ' » est utilisée deux fois.');
          seen[b.key] = true;

          if (PAGES.indexOf(b.page) < 0) out.push(name + ' : page inconnue (' + b.page + ').');
          else if (sp.kind === 'cover' && b.page !== 'right') out.push(name + ' : la couverture n’a que la page de droite.');
          else if (sp.kind === 'back' && b.page !== 'left') out.push(name + ' : la quatrième de couverture n’a que la page de gauche.');

          const x = b.box || {};
          if (!isNum(x.x) || !isNum(x.y) || !isNum(x.w) || !isNum(x.h) || x.w <= 0 || x.h <= 0) {
            out.push(name + ' : boîte invalide.');
          } else if (x.x < 0 || x.y < 0 || x.x + x.w > PAGE_W || x.y + x.h > PAGE_H) {
            out.push(name + ' : la boîte dépasse de sa page (640 × 720).');
          }
          // Sur téléphone, Préc. et Suiv. sont posés sur les bords de la page à mi-hauteur (S#2-02).
          // On compare la zone du texte : la boîte moins sa marge intérieure.
          const z = ui.navZone, pad = ui.blockPad || 0;
          if (z && isNum(x.y) && x.y + pad < z.y1 && x.y + x.h - pad > z.y0 && (x.x + pad < z.x0 || x.x + x.w - pad > z.x1)) {
            out.push(name + ' : passe sous les boutons Préc. et Suiv. sur téléphone (à mi-hauteur : garder la boîte entre x = ' + (z.x0 - pad) + ' et x = ' + (z.x1 + pad) + ').');
          }

          if (!styles[b.style]) out.push(name + ' : style inconnu (' + b.style + ').');
          if (!isNum(b.at) || b.at < 0 || b.at >= sp.duration) out.push(name + ' : son apparition est hors de la double page.');
          if (b.fade !== undefined && (!isNum(b.fade) || b.fade < 0)) out.push(name + ' : durée de fondu invalide.');
          if (b.voice !== undefined && typeof b.voice !== 'boolean') out.push(name + ' : « voice » (voix) vaut true ou false.');
          if (b.voiceAt !== undefined && (!isNum(b.voiceAt) || b.voiceAt < 0 || b.voiceAt >= sp.duration)) out.push(name + ' : le début de sa voix (« voiceAt ») est hors de la double page.');
          // Le lecteur s'arrête sur cette page : tout son texte doit être apparu avant (S#2-02).
          if (hold !== null && isNum(b.at) && b.at + (isNum(b.fade) ? b.fade : 0) > hold + 1e-9) {
            out.push(name + ' : pas entièrement apparu à l’arrêt de la page (' + (Math.round(hold * 100) / 100) + ' s) ; allonger « duration » ou avancer « at ».');
          }

          // Deux blocs d'une même page ne se recouvrent pas.
          for (let k = j + 1; k < list.length; k++) {
            const o = list[k];
            if (o.page === b.page && o.box && b.box && overlap(o.box, b.box)) {
              out.push(name + ' recouvre le bloc ' + o.key + '.');
            }
          }

          // Une capture ne tombe pas au milieu d'un fondu : le texte serait à demi transparent.
          if (isNum(b.at) && b.fade > 0) {
            (sp.moments || []).forEach(function (m, n) {
              if (m.capture >= b.at && m.capture < b.at + b.fade) {
                out.push(name + ' : le moment ' + (n + 1) + ' est capturé pendant son fondu.');
              }
            });
          }

          // Le texte existe dans chaque langue.
          Object.keys(texts || {}).forEach(function (code) {
            const t = texts[code] && texts[code].blocks;
            if (b.key && !(t && typeof t[b.key] === 'string')) out.push('Texte manquant en « ' + code + ' » pour le bloc ' + b.key + '.');
          });
        });
      });
      return out;
    }
  };
})();
