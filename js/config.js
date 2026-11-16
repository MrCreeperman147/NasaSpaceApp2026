/* config.js : constantes partagées par tous les modules.
   Le livre est une liste de « doubles pages » (spreads), précédée d'une
   couverture. Chaque double page est un objet : son fond, son animation,
   ses effets sonores et ses moments clés, en temps local (secondes depuis
   son début). Les temps globaux sont calculés par spreads.js (Demo.book).
   Les « moments clés » servent de repères dans l'animation et de pages
   dans le PDF exporté. */
window.Demo = window.Demo || {};

Demo.config = {
  W: 1280,          // taille logique de la scène (16:9) : une double page
  H: 720,
  version: '0.0.7',   // version du site, affichée en bas du Menu
  title: 'Les deux rovers jumeaux',   // titre du livre (écran-titre, en-tête du PDF), non traduit ; la couverture le reprend (ts/*, blocks['cover.t1'])
  bgm: 'musique',
  bgExt: 'png',
  // Taille des fonds (S#2-03) : double page 16:9, page seule (couverture, quatrième) 8:9.
  // maxSide : au-delà, la carte graphique d'un téléphone refuse l'image (contrôle en console).
  bgSize: { spread: { w: 1920, h: 1080 }, page: { w: 1280, h: 1440 }, maxSide: 4096 },       // extension des fonds de img/story/bgi/ ('png' ou 'jpg'), la même pour tous (débogage #2 de S#2-02)     // musique de fond du livre entier (clé du module audio)

  /* Les pages du livre (la liste des doubles pages) sont dans js/book.js
     depuis S#2-02 : Demo.config.spreads. Leurs textes sont dans
     ts/<langue>/book.js. */

  /* Fichiers des voix (S#2-02) : par langue, clé du bloc → fichier de sounds/va/<langue>/.
     t1 : texte « a » (page gauche), t2 : texte « b » (page droite). Une clé absente
     d'une langue prend le nom par défaut : sounds/va/<langue>/<clé>.mp3 (audio.voicePath).
     Table générée par « node tools/caler-voix.js », qui cale aussi les temps des pages
     (js/book.js) sur la voix la plus longue des deux langues : à relancer après un
     changement de voix. */
  voices: {
    fr: {
      'cover.t1': '1_Titre.wav',
      'dp01.t1': '2a_Blueprints.wav',
      'dp01.t2': '2b_Blueprints.wav',
      'dp02.t1': '3a_Sur_Terre_Donc_Sur_Mars.wav',
      'dp02.t2': '3b_Sur_Terre_Donc_Sur_Mars.wav',
      'dp03.t1': '4a_Partout_Pareil.wav',
      'dp03.t2': '4b_Partout_Pareil.wav',
      'dp04.t1': '5a_Les_Rovers_MER.wav',
      'dp04.t2': '5b_Les_Rover_MER.wav',
      'dp05.t1': '6a_Le_Grand_Depart.wav',
      'dp05.t2': '6b_Le_Grand_Depart.wav',
      'dp06.t1': '7a_Atterrisage.wav',
      'dp06.t2': '7b_Atterissage.wav',
      'dp07.t1': '8a_Debut_De_L_Exploration.wav',
      'dp07.t2': '8b_Debut_De_L_Exploration.wav',
      'dp08.t1': '9a_Spirit.wav',
      'dp08.t2': '9b_Spirit.wav',
      'dp09.t1': '10a_Data_Collecting.wav',
      'dp09.t2': '10b_Data_Collecting.wav',
      'dp10.t1': '11a_Endormissement_De_Spirit.wav',
      'dp10.t2': '11b_Endormissement_Spirit.wav',
      'dp11.t1': '12a_Oppy_Survit_Seule.wav',
      'dp11.t2': '12b_Oppy_Survit_Seule.wav',
      'dp12.t1': '13a_Accomplissements.wav',
      'dp12.t2': '13b_Accompissements.wav',
      'dp13.t1': '14a_Curiosity.wav',
      'dp13.t2': '14b_Curiosity.wav',
      'dp14.t1': '15a_Sommeil_Oppy.wav',
      'dp14.t2': '15b_Sommeil_Oppy.wav',
      'dp15.t1': '16a_The_End.wav',
      'dp15.t2': '16b_The_End.wav'
    },
    en: {
      'cover.t1': '1_Title.wav',
      'dp01.t1': '2a_Blueprints.wav',
      'dp01.t2': '2b_Blueprints.wav',
      'dp02.t1': '3a_On_Earth_So_On_Mars.wav',
      'dp02.t2': '3b_On_Earth_So_On_Mars.wav',
      'dp03.t1': '4a_The_Same_Everywhere.wav',
      'dp03.t2': '4b_The_Same_Everywhere.wav',
      'dp04.t1': '5a_The_Rovers_MER.wav',
      'dp04.t2': '5b_The_Rovers_MER.wav',
      'dp05.t1': '6a_The_Great_Departure.wav',
      'dp05.t2': '6b_The_Great_Departure.wav',
      'dp06.t1': '7a_Landing.wav',
      'dp06.t2': '7b_Landing.wav',
      'dp07.t1': '8a_Exploration_Begins.wav',
      'dp07.t2': '8b_Exploration_Begins.wav',
      'dp08.t1': '9a_Spirit.wav',
      'dp08.t2': '9b_Spirit.wav',
      'dp09.t1': '10a_Collecting_Data.wav',
      'dp09.t2': '10b_Collecting_Data.wav',
      'dp10.t1': '11a_Spirit_Falls_Asleep.wav',
      'dp10.t2': '11b_Spirit_Falls_Asleep.wav',
      'dp11.t1': '12a_Oppy_Carries_On_Alone.wav',
      'dp11.t2': '12b_Oppy_Carries_On_Alone.wav',
      'dp12.t1': '13a_The_Discoveries.wav',
      'dp12.t2': '13b_The_Discoveries.wav',
      'dp13.t1': '14a_Curiosity.wav',
      'dp13.t2': '14b_Curiosity.wav',
      'dp14.t1': '15a_Oppy_Falls_Asleep.wav',
      'dp14.t2': '15b_Oppy_Falls_Asleep.wav',
      'dp15.t1': '16a_The_End.wav',
      'dp15.t2': '16b_The_End.wav'
    }
  },

  // Tournage de page (livre ouvert en double page, axe au milieu, sans reliure dessinée).
  // Une feuille tourne juste avant chaque double page, sauf la première (la couverture).
  flip: {
    duration: 1.0,     // durée d'un tournage, en secondes (il finit au début de la double page)
    cols: 24,          // finesse du maillage de la feuille
    curl: 0.6,         // courbure : 0 = feuille rigide, 1 = très souple
    lift: 0.06,        // fausse perspective : agrandissement de la feuille soulevée
    dark: 0.4,         // assombrissement maximal de la feuille inclinée
    shadowWidth: 90,   // largeur de l'ombre portée sur les pages, en pixels
    shadowAlpha: 0.4   // opacité maximale de cette ombre
  },

  // Interface.
  ui: {
    // Vue du lecteur (reader.js, camera.viewAt) : page ou double page.
    minSpreadWidth: 720,    // vue par défaut : double page à partir de cette largeur d'écran (px CSS), page en dessous
    viewEase: 0.4,          // durée d'un glissement de la vue, en secondes (tournages, bascule du lecteur)
    zoomMin: 1,             // zoom de la vue double page : 100 % à 300 %
    zoomMax: 3,
    zoomStep: 0.5,
    // Swipe (S#2-04) : glisser au moins « distance » pixels de l'écran, au moins « ratio »
    // fois plus à l'horizontale qu'à la verticale. Pas de limite de temps : pendant la
    // lecture, un appareil chargé reçoit le geste en retard (essai : 0,25 s mesuré 1,04 s).
    swipe: { distance: 50, ratio: 1.5 },
    nextLead: 0.05,         // Next saute cette durée avant le tournage, pour que le bruit de papier parte
    pageDuration: 4,        // durée d'une double page qui n'écrit pas « duration » (js/book.js), tournage compris
    bgFallback: 'nuit',
    // Sur téléphone (vue page), Préc. et Suiv. couvrent les bords de la page à mi-hauteur
    // (mesuré à l'essai : y de 318 à 392, x jusqu'à 125). Le texte d'un bloc (sa boîte moins
    // blockPad) qui croise y0..y1 doit rester entre x0 et x1, en pixels de la page. Contrôle en console.
    navZone: { y0: 310, y1: 400, x0: 100, x1: 540 },     // aplat (couleur de la palette) d'une page dont l'image manque ou ne se charge pas

    /* Polices du livre (canevas, et PDF en S#1-05). Fichiers TTF dans
       css/fonts/, déclarés par @font-face dans css/style.css avec les mêmes
       noms de famille. Une seule graisse chacune : aucun style en gras ni en
       italique. L'interface, elle, utilise la police du système (style.css). */
    fonts: {
      title: '"Berlin Sans FB Demi", Georgia, serif',
      body: '"Futura Book", "Helvetica Neue", Arial, sans-serif'
    },
    // Styles des blocs de texte : police (clé de fonts), taille en pixels de
    // la scène, interligne (multiple de la taille), couleur de la palette.
    textStyles: {
      titre: { font: 'title', size: 64, leading: 1.1, color: 'creme' },
      corps: { font: 'body', size: 23, leading: 1.35, color: 'nuit' },     // nuit : #17282f
      // Crédits : tout le texte sur une seule page (titre plus petit, interligne serré).
      // 23 px est le minimum lisible sur téléphone (minTextPx) : ne pas descendre en dessous.
      titreCredits: { font: 'title', size: 48, leading: 1.1, color: 'creme' },
      credits: { font: 'body', size: 23, leading: 1.15, color: 'creme' }   // sur l'image assombrie (dim de la page)
    },
    blockPad: 20,           // marge intérieure d'un bloc, en pixels de la scène
    // Plaque derrière le texte des blocs qui ont « plate: true ».
    // alpha : 0 = transparente (rien n'est dessiné), 1 = opaque ; 0.78 avant S#2-01.
    plate: { color: 'nuit', alpha: 0, radius: 16 },
    minTextPx: 14,          // taille minimale du texte à l'écran…
    narrowRefWidth: 390     // …quand une page occupe un écran de cette largeur (mobile, vue page)
  },

  /* Export PDF au format ebook (S#1-05, export.js) : A4 portrait, une page du
     livre par page du PDF. Mesures en millimètres, tailles de police en points.
     L'image d'une page (640 × 720 px de la scène) fait 190 mm de large :
     1 px de la scène = 190 / 640 = 0,296875 mm. Tout est réglable ici. */
  pdf: {
    W: 210, H: 297,                  // A4 portrait
    margin: 10,
    image: { x: 10, y: 24, w: 190, h: 213.75 },   // ratio 8:9, comme une page
    title: { y: 19, size: 20, minSize: 12, color: '#14202e' },   // titre du moment, en haut
    footer: { y1: 278, y2: 284, size: 9, color: '#6e7887' },     // pied sur deux lignes
    resolution: 2,                   // capture x2 : 1280 × 1440 px par page
    jpegQuality: 0.9,
    // Polices embarquées : les mêmes fichiers que l'écran (@font-face de style.css).
    // Clés : celles de ui.fonts (title, body), utilisées par ui.textStyles.
    fonts: {
      title: { file: 'css/fonts/BerlinSansFB-Demi.ttf', name: 'BerlinSansFBDemi' },
      body: { file: 'css/fonts/Futura-Book.ttf', name: 'FuturaBook' }
    }
  },

  // Palette du projet (14 couleurs). Le thème adaptatif choisit dedans.
  palette: {
    nuit: '#17282f', pin: '#314546', ardoise: '#4e606a', brume: '#8299a1',
    ciel: '#88b3c3', azur: '#81afe0', creme: '#f8e1b8', abricot: '#f4c283',
    sauge: '#cbcaac', sable: '#a7977d', chanvre: '#978368', brun: '#8f613d',
    argile: '#a1694e', terracotta: '#c98060'
  }
};

/* Petit générateur pseudo-aléatoire à graine fixe : les étoiles et le bruit
   de mer sont identiques à chaque chargement, donc les captures aussi. */
Demo.prng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

Demo.formatTime = function (t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return String(m).padStart(2, '0') + ':' + r.toFixed(1).padStart(4, '0');
};
