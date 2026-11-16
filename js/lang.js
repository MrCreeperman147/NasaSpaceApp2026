/* lang.js : langue de l'interface.

   Les textes sont dans ts/fr/ui.js et ts/en/ui.js, chargés tous les deux par
   index.html (Demo.texts.fr, Demo.texts.en). Ce module tient la langue
   courante, la mémorise et rend un texte par sa clé. Il ne touche ni au
   document ni au stockage du navigateur : le stockage lui est passé en
   paramètre (ou null), ce qui le rend testable sous Node (tests/lang.test.js). */
(function () {
  const D = window.Demo;
  const KEY = '48hours.lang';      // clé de mémorisation
  const CODES = ['fr', 'en'];
  const FALLBACK = 'fr';

  /* Aplati un objet de textes en liste de clés pointées : 'ui.menu', 'moments.dp01.m1.title'… */
  function flatten(obj, prefix, out) {
    Object.keys(obj).forEach(function (k) {
      const v = obj[k];
      const name = prefix ? prefix + '.' + k : k;
      if (v !== null && typeof v === 'object') flatten(v, name, out);
      else out.push(name);
    });
    return out;
  }

  D.lang = {
    codes: CODES,
    current: FALLBACK,
    problems: [],    // clés inconnues trouvées par book() : messages pour la console

    /* Textes du livre d'une langue (S#2-02, appelé par ts/<langue>/book.js), par
       page : { <id de la page>: { m1: 'titre', t1: 'texte', t2: '…' } }.
       m<n> : titre du moment n (en-tête, Menu, PDF), facultatif ;
       t<n> : texte du bloc n de la page. Rangés dans D.texts[code].moments
       et .blocks sous « <id>.m<n> » et « <id>.t<n> ». Une autre clé est signalée. */
    book(code, pages) {
      const T = D.texts[code] = D.texts[code] || { ui: {} };
      T.moments = T.moments || {};
      T.blocks = T.blocks || {};
      const problems = this.problems;
      Object.keys(pages).forEach(function (id) {
        Object.keys(pages[id]).forEach(function (k) {
          const v = pages[id][k];
          if (/^m\d+$/.test(k)) T.moments[id + '.' + k] = { title: v };
          else if (/^t\d+$/.test(k)) T.blocks[id + '.' + k] = v;
          else problems.push('ts/' + code + '/book.js, page « ' + id + ' » : clé inconnue « ' + k + ' » (attendu m1, m2… ou t1, t2…).');
        });
      });
    },

    /* Langue initiale : celle mémorisée si elle est connue, sinon le français.
       storage : localStorage, ou null. Un stockage bloqué ne provoque pas d'erreur. */
    init(storage) {
      let saved = null;
      try { saved = storage ? storage.getItem(KEY) : null; } catch (e) { saved = null; }
      this.current = CODES.indexOf(saved) >= 0 ? saved : FALLBACK;
      return this.current;
    },

    /* Change de langue et la mémorise. Retourne false si la langue est inconnue. */
    set(code, storage) {
      if (CODES.indexOf(code) < 0) return false;
      this.current = code;
      try { if (storage) storage.setItem(KEY, code); } catch (e) { /* stockage bloqué : la langue change quand même */ }
      return true;
    },

    /* La langue vers laquelle le bouton de localisation bascule. */
    other() {
      return CODES[(CODES.indexOf(this.current) + 1) % CODES.length];
    },

    /* Texte de l'interface par sa clé, dans la langue courante. vars remplace
       les mots entre accolades : get('version', { v: '0.0.1' }).
       Clé inconnue : le texte français, sinon la clé elle-même. */
    get(key, vars) {
      const here = D.texts[this.current], base = D.texts[FALLBACK];
      let s = here && here.ui[key] !== undefined ? here.ui[key] : (base && base.ui[key] !== undefined ? base.ui[key] : key);
      if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
      return s;
    },

    /* Titre du moment clé « id » (ex. 'dp02.m1', voir Demo.book), dans la
       langue courante. (La légende a disparu en S#1-03 : le texte du livre est
       dans les blocs de texte.) */
    moment(id) {
      const here = D.texts[this.current];
      const m = here && here.moments[id];
      return { title: m ? m.title : '' };
    },

    /* Texte du bloc « key » (ex. 'dp02.t1', voir config.spreads[].blocks),
       dans la langue courante ; texte vide si la clé est inconnue. */
    block(key) {
      const here = D.texts[this.current];
      const t = here && here.blocks && here.blocks[key];
      return typeof t === 'string' ? t : '';
    },

    /* Contrôle de configuration : clés présentes dans une langue et absentes
       d'une autre. Liste vide = tout va bien. */
    missing(texts) {
      const out = [];
      const keys = {};
      CODES.forEach(function (code) { keys[code] = flatten(texts[code] || {}, '', []); });
      CODES.forEach(function (code) {
        CODES.forEach(function (ref) {
          if (ref === code) return;
          keys[ref].forEach(function (k) {
            if (keys[code].indexOf(k) < 0) out.push('Texte manquant en « ' + code + ' » : ' + k + '.');
          });
        });
      });
      return out;
    }
  };
})();
