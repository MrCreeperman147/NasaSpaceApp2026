/* export.js : le PDF au format ebook (S#1-05). Seul fichier qui appelle jsPDF.
   A4 portrait, une page du livre par page du PDF : la couverture (sa page
   droite), puis, pour chaque moment clé d'une double page, la page gauche et la
   page droite, capturées au même instant, et enfin la quatrième de couverture
   (les crédits, sa page gauche ; S#2-01). Le PDF ne dépend pas de la vue du
   lecteur (page ou double page, côté, zoom) : la capture part toujours de la
   scène complète (scene.capture).
   Sur chaque page : le titre du moment en haut, l'image de la page capturée
   SANS son texte (les plaques restent dans l'image), le texte du livre écrit
   par-dessus en vrai texte, à sa place, dans les polices du livre embarquées,
   puis un pied (nom du livre, numéro, côté, instant capturé).
   Les décisions (pages, positions, tailles) sont des fonctions pures, testées
   sous Node ; run() les applique avec jsPDF et la scène. Réglages : config.pdf. */
(function () {
  const D = window.Demo;
  const PT_PER_MM = 72 / 25.4;
  const fontCache = {};     // fichiers TTF en base64, chargés au premier export

  /* Pixels de la scène → millimètres du PDF (une page de 640 px = image.w mm). */
  function mm(px) { return px * D.config.pdf.image.w / (D.config.W / 2); }
  /* Millimètres → points (taille de police de jsPDF). */
  function pt(m) { return m * PT_PER_MM; }
  /* Espaces insécables (U+00A0) et fines (U+202F) → espace simple : les
     polices du livre ne les ont pas. Les retours à la ligne viennent déjà de
     l'écran, ils ne changent pas. */
  function nbsp(s) { return String(s).replace(/[\u00a0\u202f]/g, ' '); }

  const FRAMES = {
    left: { x: 0, y: 0, w: 640, h: 720 },
    right: { x: 640, y: 0, w: 640, h: 720 }
  };

  /* Liste des pages du PDF, sans rien dessiner :
     [{ index, total, kind: 'cover'|'left'|'right'|'back', momentId, spread, t, u, frame }]. */
  function plan(book) {
    const pages = [];
    book.keyMoments.forEach(function (km) {
      const sp = book.spreads[km.spread];
      const base = { momentId: km.id, spread: km.spread, t: km.t, u: km.t - sp.start };
      if (sp.kind === 'cover') pages.push(Object.assign({ kind: 'cover', frame: Object.assign({}, FRAMES.right) }, base));
      else if (sp.kind === 'back') pages.push(Object.assign({ kind: 'back', frame: Object.assign({}, FRAMES.left) }, base));
      else {
        pages.push(Object.assign({ kind: 'left', frame: Object.assign({}, FRAMES.left) }, base));
        pages.push(Object.assign({ kind: 'right', frame: Object.assign({}, FRAMES.right) }, base));
      }
    });
    pages.forEach(function (p, i) { p.index = i + 1; p.total = pages.length; });
    return pages;
  }

  /* Lignes de texte à écrire sur une page du plan : les blocs de la page
     capturée, entièrement apparus (opacité 1). linesOf(block) rend les lignes
     telles que dessinées à l'écran : [{ text, width, baseline }] en pixels,
     baseline comptée depuis le haut du texte (scene.lines).
     Rend [{ text, x, y, width, size, font, color, align }] : x, y, width en mm
     sur la page A4 (y = ligne de base ; x = début de ligne, ou centre si
     align = 'center'), size en points, font = clé de config.pdf.fonts. */
  function textOps(page, book, linesOf, config) {
    const P = config.pdf, ui = config.ui;
    const spread = book.spreads[page.spread];
    const side = page.kind === 'cover' ? 'right' : (page.kind === 'back' ? 'left' : page.kind);
    const out = [];
    D.blocks.visible(spread, page.u).forEach(function (v) {
      const b = v.block;
      if (b.page !== side || v.opacity < 1) return;
      const st = ui.textStyles[b.style];
      const center = b.align === 'center';
      const x0 = b.box.x + (center ? b.box.w / 2 : ui.blockPad);
      (linesOf(b) || []).forEach(function (l) {
        out.push({
          text: nbsp(l.text),
          x: P.image.x + mm(x0),
          y: P.image.y + mm(b.box.y + ui.blockPad + l.baseline),
          width: mm(l.width),
          size: pt(mm(st.size)),
          font: st.font,
          color: config.palette[st.color],
          align: center ? 'center' : 'left'
        });
      });
    });
    return out;
  }

  /* Lignes qui sortent de l'image de la page : messages pour la console. */
  function checkOps(ops, P) {
    const e = 1e-6, im = P.image, out = [];
    ops.forEach(function (o) {
      const left = o.align === 'center' ? o.x - o.width / 2 : o.x;
      if (left < im.x - e || left + o.width > im.x + im.w + e || o.y < im.y - e || o.y > im.y + im.h + e) {
        out.push('PDF : la ligne « ' + o.text + ' » sort de l’image de la page.');
      }
    });
    return out;
  }

  /* Taille du titre : P.title.size, réduite par pas de 1 pt jusqu'à ce qu'il
     tienne dans la largeur de l'image, sans descendre sous P.title.minSize.
     measure(size) rend la largeur du titre en mm à cette taille. */
  function fitSize(measure, P) {
    for (let s = P.title.size; s >= P.title.minSize; s--) {
      if (measure(s) <= P.image.w) return { size: s, fits: true };
    }
    return { size: P.title.minSize, fits: false };
  }

  /* Pied de page, dans la langue courante. */
  function footer(page) {
    const side = { cover: 'pdfCover', left: 'pdfLeft', right: 'pdfRight', back: 'pdfBack' }[page.kind];
    return {
      left: D.config.title + ' · ' + D.lang.get('pdfHeader'),
      right: page.index + ' / ' + page.total,
      second: D.lang.get(side) + ' · ' + D.lang.get('pdfCaptured', { t: D.formatTime(page.t) })
    };
  }

  /* ---------- navigateur : polices, puis export ---------- */

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* Charge les TTF de config.pdf.fonts (une fois, puis en cache). Un échec
     arrête l'export : pas de repli silencieux dans une autre police. */
  async function loadFonts(P) {
    try {
      for (const k of Object.keys(P.fonts)) {
        if (fontCache[k]) continue;
        const res = await fetch(P.fonts[k].file);
        if (!res.ok) throw new Error(P.fonts[k].file + ' : ' + res.status);
        fontCache[k] = toBase64(await res.arrayBuffer());
      }
    } catch (e) {
      console.error('[48hours] Export PDF :', e);
      throw new Error(D.lang.get('pdfFontError'));
    }
  }

  D.exporter = {
    plan: plan,
    textOps: textOps,
    checkOps: checkOps,
    fitSize: fitSize,
    footer: footer,
    mm: mm,
    pt: pt,
    nbsp: nbsp,

    /* Retourne { blob, pages: [{ title, kind, t, dataUrl }] }. */
    async run(tl, scene, onProgress) {
      const C = D.config, P = C.pdf;
      await loadFonts(P);

      const jsPDF = window.jspdf.jsPDF;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      Object.keys(P.fonts).forEach(function (k) {
        const f = P.fonts[k];
        doc.addFileToVFS(f.name + '.ttf', fontCache[k]);
        doc.addFont(f.name + '.ttf', f.name, 'normal');
      });

      const pages = plan(D.book);
      const out = [];
      const resumeAt = tl.time();
      tl.pause();
      D.audio.locked = true;   // aucun son pendant les sauts dans la timeline

      try {
        for (const pg of pages) {
          if (onProgress) onProgress(pg.index, pg.total);

          tl.seek(pg.t);              // seek() ne déclenche pas les tl.call()
          scene.update(pg.t);
          const dataUrl = scene.capture({ frame: pg.frame, text: false, resolution: P.resolution })
            .toDataURL('image/jpeg', P.jpegQuality);
          const title = nbsp(D.lang.moment(pg.momentId).title);
          out.push({ title: title, kind: pg.kind, t: pg.t, dataUrl: dataUrl });

          if (pg.index > 1) doc.addPage();

          // Titre du moment, en haut, dans la police des titres. Facultatif (S#2-02) :
          // un moment sans titre n'en écrit pas.
          if (title) {
            doc.setFont(P.fonts.title.name, 'normal');
            const fit = fitSize(function (s) { doc.setFontSize(s); return doc.getTextWidth(title); }, P);
            if (!fit.fits) console.warn('[48hours] PDF : le titre « ' + title + ' » dépasse la largeur de la page, même à ' + fit.size + ' pt.');
            doc.setFontSize(fit.size);
            doc.setTextColor(P.title.color);
            doc.text(title, P.image.x, P.title.y);
          }

          // L'image de la page, sans texte (plaques comprises).
          doc.addImage(dataUrl, 'JPEG', P.image.x, P.image.y, P.image.w, P.image.h, undefined, 'FAST');

          // Le texte du livre, ligne par ligne, tel qu'il est dessiné à l'écran.
          const ops = textOps(pg, D.book, function (b) { return scene.lines(pg.spread, b.key); }, C);
          checkOps(ops, P).forEach(function (m) { console.warn('[48hours] ' + m); });
          ops.forEach(function (o) {
            doc.setFont(P.fonts[o.font].name, 'normal');
            doc.setFontSize(o.size);
            doc.setTextColor(o.color);
            doc.text(o.text, o.x, o.y, { align: o.align, baseline: 'alphabetic' });
          });

          // Pied de page.
          const f = footer(pg);
          doc.setFont(P.fonts.body.name, 'normal');
          doc.setFontSize(P.footer.size);
          doc.setTextColor(P.footer.color);
          doc.text(f.left, P.image.x, P.footer.y1);
          doc.text(f.right, P.image.x + P.image.w, P.footer.y1, { align: 'right' });
          doc.text(f.second, P.image.x, P.footer.y2);

          // Laisse le navigateur respirer entre deux captures.
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      } finally {
        D.audio.locked = false;
        tl.seek(resumeAt);
        scene.update(resumeAt);
      }

      return { blob: doc.output('blob'), pages: out };
    }
  };
})();
