/* book.js : les pages du livre (S#2-02). C'est le fichier de la mise en page.

   Le livre est une liste de « doubles pages », dans l'ordre :
     - la couverture (une seule page, à droite, livre fermé) : page 1 ;
     - les doubles pages (deux pages chacune) : pages 2-3, 4-5… ;
     - la quatrième de couverture (une seule page, à gauche) : la dernière.
   Le numéro des pages, les temps, les arrêts de lecture et les pages du PDF
   en découlent tout seuls (spreads.js).

   AJOUTER UNE PAGE : copier une double page de ce fichier, la coller à sa
   place dans la liste (avant les crédits), et changer son « id ». Puis :
     1. son texte dans ts/fr/book.js et ts/en/book.js, sous le même id ;
     2. son image : img/story/bgi/<id>.png (1920 × 1080, toute la double page ;
        extension réglée par bgExt dans config.js) ;
     3. si un bloc a « voice: true » : sounds/va/fr/<id>.t<n>.mp3 et
        sounds/va/en/<id>.t<n>.mp3 (n = rang du bloc dans la page, à partir de 1).
   Les contrôles de la console (F12) signalent ce qui manque ou déborde.

   Les six gabarits (marqués ci-dessous) :
     ① couverture        image 8:9 (img/story/bgi/cover.png, 1280 × 1440), titre centré
     ② texte simple      un fond, un bloc en bas de la page gauche, avec voix
     ③ deux textes       un bloc par page, le second apparaît après la voix du premier
     ④ titre et texte    un bloc « titre » en haut, un bloc « corps » dessous
     ⑤ animée            une animation (js/anim/<clé>.js), un effet sonore, deux moments
                         (exemple en commentaire : aucune page animée depuis S#2-03)
     ⑥ quatrième         crédits : aplat de la palette, page gauche seule

   Téléphone (vue page) : Préc. et Suiv. sont posés sur les bords de la page,
   à mi-hauteur (y de 310 à 400 environ). Un bloc dont le texte passe à cette
   hauteur garde sa boîte entre x = 80 et x = 560 (①, ④, ⑥) ; en haut ou en
   bas de la page, toute la largeur est libre (②, ③). Signalé en console.

   Champs d'une double page. Seul « id » est obligatoire : le reste a une
   valeur par défaut (spreads.normalize).
     id        identifiant unique : lettres, chiffres, « - » ou « _ » (ex. dp08)
     kind      'cover' (en premier), 'back' (en dernier) ; rien pour une double page
     duration  durée en secondes, tournage de sortie compris (défaut : ui.pageDuration,
               4 s). La lecture s'arrête d'elle-même juste avant le tournage
               (1 s avant la fin) : tout le texte doit être apparu avant.
     bg        nom de l'image dans img/story/bgi/ (défaut : l'id). Image absente :
               aplat ui.bgFallback et avertissement en console.
     bgColor   une couleur de la palette (config.js) à la place d'une image
     dim       filtre sombre sur le fond, de 0 (aucun) à 1 (noir) ; ex. 0.55 sur les crédits
     animation clé d'une animation (js/anim/<clé>.js), ou rien
     sfx       effets courts [{ u, key }], u en secondes depuis le début de la page
     moments   repères [{ start, capture }] (en-tête, Menu, pages du PDF). Défaut :
               un seul, capturé à l'instant où la lecture s'arrête.
     blocks    blocs de texte :
                 page  'left' ou 'right'
                 box   { x, y, w, h } en pixels, dans la page (640 × 720)
                 style 'titre' ou 'corps' (config.js, ui.textStyles)
                 align 'left' (défaut) ou 'center'
                 at    apparition (secondes depuis le début de la page) ; fade : fondu
                 plate true : plaque derrière le texte (opacité ui.plate.alpha)
                 voice true : une voix lue pour ce bloc. Une seule voix joue à la
                       fois : une nouvelle voix coupe la précédente.
                 voiceAt début de la voix (secondes depuis le début de la page) ;
                       défaut : « at ». Le livre affiche tout le texte en permanence
                       (at: 0, fade: 0) et lit les voix l'une après l'autre : les
                       « voiceAt » et « duration » sont calés par
                       « node tools/caler-voix.js ».
                 key   (défaut : <id>.t<n>) clé du texte dans ts/<langue>/book.js */
window.Demo = window.Demo || {};

Demo.config.spreads = [
  // Gabarit ① couverture : image img/story/bgi/cover.png (8:9), titre du livre centré.
  { id: 'cover', kind: 'cover', duration: 6.0,
    moments: [{ start: 0.3, capture: 2.0 }],
    blocks: [{ page: 'right', box: { x: 80, y: 240, w: 480, h: 130 }, style: 'titre', align: 'center', at: 0, fade: 0, voice: true, voiceAt: 0.5 }] },

  /* Gabarit ⑤ animée (exemple, à décommenter et adapter) :
       { id: 'dp08', duration: 8, animation: 'tempete', sfx: [{ u: 2.5, key: 'bell' }],
         moments: [{ start: 0.3, capture: 2.0 }, { start: 4.0, capture: 6.0 }],
         blocks: [{ page: 'left', box: { x: 40, y: 500, w: 560, h: 180 }, style: 'corps', at: 0, fade: 0 }] },
     L'animation est une classe dans js/anim/<clé>.js (ici js/anim/tempete.js), chargée
     par index.html avant js/scene.js :
       Demo.animations = Demo.animations || {};
       Demo.animations.tempete = class extends PIXI.Container {
         constructor(T, W, H) { super(); … }   // T : textures de assets.build()
         update(a) { … }                        // état au temps a (secondes), sans dessiner
         build(tl, t0, dur) { … }               // tweens posés sur la timeline, à t0 + x
       };
     Plusieurs doubles pages qui se suivent peuvent citer la même animation : son
     temps part du début de la première. Voir claude/Reference_Animations.md. */

  /* Gabarit ② texte simple (exemple, à décommenter et adapter) : image img/story/bgi/<id>.png,
     un texte dans les 30 % du bas de la page gauche, lu.
       { id: 'dp08',
         blocks: [
           { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 }
         ] }, */

  // Gabarit ③ deux textes : le texte « a » (t1) sur la page gauche, le texte « b » (t2) sur
  // la page droite, dans les 30 % du bas de la page (y de 504 à 720). Une seule voix joue
  // à la fois : le second bloc apparaît quand la voix du premier est finie (sinon elle est
  // coupée). Ici 3,2 s plus tard, d'où une page de 7 s (arrêt à 5,95 s). À régler selon
  // la durée des voix.
  { id: 'dp01', duration: 44.8,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 473, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 16.1 }
    ] },
  { id: 'dp02', duration: 35.2,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 20.8 }
    ] },
  { id: 'dp03', duration: 16.8,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 8.0 }
    ] },
  { id: 'dp04', duration: 35.9,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 17.3 }
    ] },

  // Gabarit ③ deux textes, avec l'animation de la fusée (js/anim/spaceship.js).
  { id: 'dp05', duration: 27.7, animation: 'spaceship',
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 14.5 }
    ] },

  /* Gabarit ④ titre et texte (exemple, à décommenter et adapter) : un titre en haut de la
     page gauche, le texte dessous (seul le texte est lu). Le texte passe à mi-hauteur :
     boîtes étroites (x de 120 à 520), voir « Téléphone » plus haut. (Les crédits, ⑥,
     font de même : x de 100 à 540.)
       { id: 'dp08',
         blocks: [
           { page: 'left', box: { x: 120, y: 60, w: 400, h: 150 }, style: 'titre', at: 0, fade: 0 },
           { page: 'left', box: { x: 120, y: 230, w: 400, h: 300 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 1.0 }
         ] }, */

  // Gabarit ⑤ animée : la capsule sous parachute (js/anim/drop.js) arrive en arc de cercle
  // et s'arrête à 20 % de la hauteur. Deux textes, comme le gabarit ③.
  { id: 'dp06', duration: 30.0, animation: 'drop',
    moments: [{ start: 19.0, capture: 19.5 }],
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 19.0 }
    ] },

  // Gabarit ③ deux textes (copies de dp01).
  { id: 'dp07', duration: 21.6,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 14.3 }
    ] },
  { id: 'dp08', duration: 47.0,
    blocks: [
      { page: 'left', box: { x: 40, y: 473, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 31.7 }
    ] },
  // Animation : Oppy (js/anim/oppy_dp09.js) roule depuis la gauche jusqu'à 30 % du bord droit.
  { id: 'dp09', duration: 37.3, animation: 'oppy_dp09',
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 20, y: 504, w: 580, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 15.9 }
    ] },
  { id: 'dp10', duration: 37.8,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 17.2 }
    ] },
  { id: 'dp11', duration: 26.5,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 17.4 }
    ] },
  // Animation : les découvertes (js/anim/discovery.js), Oppy, l'eau, la source chaude et le volcan.
  { id: 'dp12', duration: 60.7, animation: 'discovery',
    blocks: [
      { page: 'left', box: { x: 10, y: 473, w: 600, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 37.1 }
    ] },
  { id: 'dp13', duration: 46.9,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 20.7 }
    ] },
  { id: 'dp14', duration: 40.2,
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 20.4 }
    ] },
  // Animation : les astéroïdes (js/anim/asteroid.js) montent de la gauche jusqu'au centre.
  { id: 'dp15', duration: 41.7, animation: 'asteroid',
    blocks: [
      { page: 'left', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 0.3 },
      { page: 'right', box: { x: 40, y: 504, w: 560, h: 216 }, style: 'corps', at: 0, fade: 0, voice: true, voiceAt: 17.3 }
    ] },
  // Gabarit ⑥ quatrième de couverture : les crédits, sur un aplat de la palette (ou une
  // image 8:9 : retirer bgColor et ajouter img/story/bgi/credits.png). Toujours en dernier.
  // Boîtes étroites (x de 100 à 540) : sur téléphone, Préc. et Suiv. sont sur les bords de la page.
  // dim : filtre sombre sur l'image (0 = aucun, 1 = noir), pour lire le texte crème.
  { id: 'credits', kind: 'back', dim: 0.55,
    moments: [{ start: 0.3, capture: 2.0 }],
    blocks: [
      // Toute la hauteur de la page : titre en haut, texte dessous (22 lignes en français, 572 px).
      { page: 'left', box: { x: 80, y: 0, w: 480, h: 96 }, style: 'titreCredits', align: 'center', at: 0, fade: 0 },
      { page: 'left', box: { x: 80, y: 96, w: 480, h: 624 }, style: 'credits', align: 'center', at: 0, fade: 0 }
    ] }
];
