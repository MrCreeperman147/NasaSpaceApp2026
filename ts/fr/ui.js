/* ts/fr/ui.js : textes en français.
   « ui » : libellés de l'interface. Les mots entre accolades ({n}, {t}…)
   sont remplacés par une valeur. « moments » : titre de chaque moment clé,
   par son identifiant « <double page>.m<numéro> » (voir config.spreads).
   « blocks » : texte du livre, posé sur les pages (blocs de texte).
   Les mêmes clés doivent exister dans ts/en/ui.js (contrôlé au chargement). */
window.Demo = window.Demo || {};
Demo.texts = Demo.texts || {};

Demo.texts.fr = {
  ui: {
    langCode: 'FR',
    langSwitch: 'Langue : français. Passer en anglais',
    menu: 'Menu',
    menuOpen: 'Ouvrir le menu',
    close: 'Fermer',
    prev: 'Préc.',
    prevLabel: 'Page précédente',
    next: 'Suiv.',
    nextLabel: 'Page suivante',
    play: 'Lancer la lecture',
    pause: 'Mettre en pause',
    seek: 'Position dans l’animation, en secondes',
    pageOne: 'Page {n} / {total}',          // numéro de page sous la scène (S#2-02)
    pageRange: 'Pages {a}-{b} / {total}',
    menuPage: 'Page {n}',                    // entrée du Menu d'une page sans titre
    menuPages: 'Pages {a}-{b}',
    stage: 'Animation',
    pageText: 'Texte de la double page',
    view: 'Affichage',
    viewPage: 'Page',
    viewSpread: 'Double page',
    moments: 'Pages',
    sound: 'Son',
    soundOn: 'Son actif',
    soundOff: 'Son coupé',
    zoom: 'Zoom',
    zoomIn: 'Agrandir',
    zoomOut: 'Réduire',
    zoomFit: 'Ajuster à la fenêtre',
    exportTitle: 'Export PDF',
    exportHint: 'La couverture, deux pages par moment clé, puis les crédits : l’image et le texte du livre, en vrai texte.',
    exportButton: 'Exporter les {n} pages en PDF',
    exportCapturing: 'Capture de la page {i} sur {n}…',
    exportSaving: 'Préparation de l’enregistrement…',
    exportDownloaded: 'PDF téléchargé : {n} pages, {size}.',
    exportSaved: 'PDF enregistré : {n} pages, {size}.',
    exportUnsaved: 'PDF généré ({size}), mais cette vue ne permet pas de l’enregistrer.',
    exportDeclined: 'Enregistrement annulé.',
    exportFailed: 'L’export a échoué : {msg}.',
    unknownError: 'erreur inconnue',
    sizeKb: '{n} Ko',
    version: 'Version {v}',
    pdfHeader: 'pages clés',
    pdfCaptured: 'Instant capturé : {t}',
    pdfCover: 'Couverture',
    pdfLeft: 'Page gauche',
    pdfRight: 'Page droite',
    pdfBack: 'Quatrième de couverture',
    pdfFontError: 'les polices du livre (css/fonts) n’ont pas pu être chargées',
    pdfFile: 'la-traversee-pages-cles.pdf',
    errLibs: 'Une librairie n’a pas pu être chargée. Vérifiez la connexion, puis rechargez la page.',
    errScene: 'La scène n’a pas pu démarrer. Vérifiez que la page est servie par un serveur local et que le navigateur prend en charge WebGL.'
  },
  // Texte du livre (titres des moments, blocs) : ts/fr/book.js depuis S#2-02.
  moments: {},
  blocks: {}
};
