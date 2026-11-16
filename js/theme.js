/* theme.js : couleurs de l'interface.

   Deux niveaux :
     - le thème par défaut (priorité basse), aussi écrit dans css/style.css :
       il s'applique avant le chargement et sert de repli ;
     - le thème adaptatif : pour chaque double page, un thème dérivé de la couleur
       moyenne de son fond (lue une fois par scene.bake) et de la palette.

   Le thème est une fonction du temps t de la timeline (themeAt) : pendant un
   tournage, il passe du thème de la double page sortante à celui de l’entrante.

   Tout est en fonctions pures, testées sous Node (tests/theme.test.js), sauf
   apply(), seule fonction qui touche au document. Les couleurs sont des
   chaînes '#rrggbb' ; un « rgb » est un tableau [r, g, b] de 0 à 255. */
(function () {
  const D = window.Demo;
  const P = D.config.palette;

  function parse(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('');
  }
  /* Mélange de a vers b : k = 0 donne a, k = 1 donne b. */
  function mix(a, b, k) {
    const x = parse(a), y = parse(b);
    return toHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
  }
  /* Luminance relative et rapport de contraste (définitions du WCAG 2). */
  function luminance(hex) {
    const c = parse(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /* Parmi les candidates, la première qui atteint le contraste voulu sur tous
     les fonds ; à défaut, celle dont le pire contraste est le meilleur. */
  function pick(candidates, grounds, min) {
    let best = candidates[0], bestScore = -1;
    for (const c of candidates) {
      const score = Math.min.apply(null, grounds.map(function (g) { return contrast(c, g); }));
      if (score >= min) return c;
      if (score > bestScore) { best = c; bestScore = score; }
    }
    return best;
  }

  const KEYS = ['bg', 'surface', 'ink', 'muted', 'line', 'accent', 'accentInk'];
  const CSS = { bg: '--bg', surface: '--surface', ink: '--ink', muted: '--muted', line: '--line', accent: '--accent', accentInk: '--accent-ink' };

  const DEFAULT = {
    bg: P.nuit, surface: P.pin, ink: P.creme, muted: P.brume,
    line: P.ardoise, accent: P.abricot, accentInk: P.nuit
  };

  let applied = '';   // dernier thème écrit sur le document (voir apply)

  D.theme = {
    DEFAULT: DEFAULT,
    parse: parse,
    mix: mix,
    contrast: contrast,

    /* Couleur moyenne d'un tableau de pixels RGBA, ou null s'il est vide. */
    average(pixels) {
      if (!pixels || pixels.length < 4) return null;
      let r = 0, g = 0, b = 0;
      const n = Math.floor(pixels.length / 4);
      for (let i = 0; i < n; i++) { r += pixels[i * 4]; g += pixels[i * 4 + 1]; b += pixels[i * 4 + 2]; }
      return [r / n, g / n, b / n];
    },

    /* Nom de la couleur de la palette la plus proche d'un rgb.
       On compare les teintes, pas la luminosité (chaque composante est
       rapportée à la somme des trois) : la moyenne d'une image est toujours
       terne et sombre, et le thème assombrit de toute façon la couleur retenue.
       Comparer les valeurs brutes ramenait presque toutes les images à la
       même couleur grise de la palette. */
    nearest(rgb, palette) {
      const tint = function (c) {
        const sum = c[0] + c[1] + c[2];
        return sum > 0 ? [c[0] / sum, c[1] / sum, c[2] / sum] : [1 / 3, 1 / 3, 1 / 3];
      };
      const target = tint(rgb);
      let best = null, bestD = Infinity;
      Object.keys(palette).forEach(function (name) {
        const c = tint(parse(palette[name]));
        const d = Math.pow(c[0] - target[0], 2) + Math.pow(c[1] - target[1], 2) + Math.pow(c[2] - target[2], 2);
        if (d < bestD) { bestD = d; best = name; }
      });
      return best;
    },

    /* Thème d'une double page à partir de la couleur moyenne de son fond.
       rgb null (lecture impossible) : thème par défaut. */
    themeFor(rgb, palette) {
      if (!rgb) return Object.assign({}, DEFAULT);
      const base = palette[this.nearest(rgb, palette)];
      // Fond et surface : la couleur retenue, assombrie vers le noir, ce qui
      // garde sa teinte. (Débogage #1 : assombrir vers « nuit », un bleu-vert,
      // neutralisait les couleurs chaudes et laissait l'interface grise.)
      const NOIR = '#000000';
      const bg = mix(base, NOIR, 0.72);
      // La surface est un peu plus claire que le fond ; pour une couleur de
      // départ très claire, on l'assombrit jusqu'à ce qu'un texte y soit lisible.
      let k = 0.55;
      let surface = mix(base, NOIR, k);
      while (k < 0.68 && Math.max(contrast(palette.creme, surface), contrast(palette.nuit, surface)) < 4.5) {
        k += 0.03;
        surface = mix(base, NOIR, k);
      }
      if (contrast(surface, bg) < 1.12) surface = mix(bg, palette.creme, 0.12);   // surface trop proche du fond
      const ink = pick([palette.creme, palette.nuit], [bg, surface], 4.5);
      const muted = pick([palette.brume, palette.ciel, ink], [bg], 4.5);          // réservé au fond (--bg)
      const accent = pick([palette.abricot, palette.creme, palette.ciel], [bg, surface], 3);
      const accentInk = pick([palette.nuit, palette.creme], [accent], 4.5);
      return { bg: bg, surface: surface, ink: ink, muted: muted, line: mix(base, NOIR, 0.4), accent: accent, accentInk: accentInk };
    },

    /* Thème à l'instant t. themes : un thème par double page (ou null : thème
       par défaut) ; flips : plan des tournages, flips[i] mène de la double page
       i à i + 1. */
    themeAt(themes, flips, t) {
      if (!themes || !themes.length) return Object.assign({}, DEFAULT);
      let cur = 0;         // double page courante
      for (let i = 0; i < flips.length; i++) {
        const f = flips[i];
        if (t >= f.to) { cur = i + 1; continue; }
        if (t >= f.from) {
          const k = (t - f.from) / (f.to - f.from);
          const a = themes[i], b = themes[i + 1], out = {};
          KEYS.forEach(function (key) { out[key] = mix(a[key], b[key], k); });
          return out;
        }
        break;
      }
      return Object.assign({}, themes[cur]);
    },

    /* Variables CSS correspondant à un thème. */
    cssVars(theme) {
      const out = {};
      KEYS.forEach(function (key) { out[CSS[key]] = theme[key]; });
      return out;
    },

    /* Écrit le thème sur l'élément racine, seulement s'il a changé : rien
       n'est touché quand la timeline est à l'arrêt. Seule fonction non pure. */
    apply(theme, root) {
      const vars = this.cssVars(theme);
      const sig = KEYS.map(function (k) { return theme[k]; }).join('');
      if (sig === applied) return false;
      applied = sig;
      Object.keys(vars).forEach(function (name) { root.style.setProperty(name, vars[name]); });
      return true;
    }
  };
})();
