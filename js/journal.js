/* journal.js : sous ?debug, recopie la console à l'écran (débogage #1 de S#2-02).
   Sur téléphone, la console du navigateur n'est pas accessible : les
   avertissements, les erreurs et le bilan de démarrage s'affichent dans un
   panneau en bas de la page, à photographier. Sans ?debug, rien ne change.

   Chargé en PREMIER par index.html (avant les librairies), pour attraper aussi
   leurs erreurs de chargement. format() et summary() sont des fonctions pures,
   testées sous Node (tests/journal.test.js). */
(function () {
  const D = window.Demo = window.Demo || {};
  const lignes = [];
  let boite = null;

  /* Texte d'une valeur de la console. */
  function texte(a) {
    // Une erreur, même venue d'un autre contexte (instanceof Error y échoue).
    if (a && typeof a === 'object' && typeof a.message === 'string' && typeof a.name === 'string') return a.name + ': ' + a.message;
    if (a !== null && typeof a === 'object') {
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }
    return String(a);
  }

  D.journal = {
    active: false,
    lignes: lignes,

    /* Une ligne du journal : le type (warn, error, info) puis les valeurs. */
    format(type, args) { return type + ' ' + Array.from(args).map(texte).join(' '); },

    /* Bilan de démarrage, en lignes. info : { version, ua, dpr, renderer,
       resolution, maxTexture, expected (fonds attendus), loaded (fonds
       chargés), flips, W, H, secure }. La mémoire des images figées des
       tournages (2 par tournage, à la résolution du rendu) est estimée. */
    summary(info) {
      const manquants = info.expected.filter(function (k) { return info.loaded.indexOf(k) < 0; });
      const mo = Math.round(info.flips * 2 * info.W * info.H * info.resolution * info.resolution * 4 / 1048576);
      return [
        'Version ' + info.version + ' · ' + info.ua,
        'Fonds chargés : ' + info.loaded.length + ' / ' + info.expected.length + (manquants.length ? ' ; manquants : ' + manquants.join(', ') : ''),
        'Écran : densité ' + info.dpr + ' · rendu ' + info.renderer + ', résolution ' + info.resolution + ', texture max ' + info.maxTexture,
        'Images figées des tournages : ' + info.flips * 2 + ' images, ' + mo + ' Mo · contexte sécurisé : ' + (info.secure ? 'oui' : 'non')
      ];
    },

    /* Ajoute une ligne et met le panneau à jour. */
    add(type, args) {
      lignes.push(this.format(type, args));
      afficher();
    }
  };

  function afficher() {
    if (!D.journal.active || !document.body) return;
    if (!boite) {
      boite = document.createElement('pre');
      boite.id = 'journal';
      boite.className = 'journal';
      document.body.appendChild(boite);
    }
    boite.textContent = lignes.join('\n');
    boite.scrollTop = boite.scrollHeight;
  }

  // Actif seulement dans le navigateur, sous ?debug.
  if (typeof location === 'undefined' || !/[?&]debug\b/.test(location.search)) return;
  D.journal.active = true;
  ['warn', 'error', 'info'].forEach(function (k) {
    const f = console[k].bind(console);
    console[k] = function () { D.journal.add(k, arguments); return f.apply(null, arguments); };
  });
  window.addEventListener('error', function (e) {
    D.journal.add('error', [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (e) { D.journal.add('error', ['Promesse rejetée :', e.reason]); });
  document.addEventListener('DOMContentLoaded', afficher);
})();
