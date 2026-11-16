/* tools/caler-voix.js : relie les voix aux textes et cale les temps du livre sur
   leur durée. À relancer après avoir ajouté ou remplacé un fichier de voix :

       node tools/caler-voix.js

   1. Table des voix (js/config.js, « voices ») : refaite à partir des fichiers de
      sounds/va/<langue>/, nommés <n><a|b>_<titre>.wav (ou .mp3) :
        n = 1          → titre de la couverture (cover.t1) ;
        n = 2, 3…      → double page dp01, dp02… (n - 1) ;
        a / b          → texte de gauche (t1) / de droite (t2).
   2. Temps des doubles pages (js/book.js) : pour chaque page, la voix la plus
      longue des deux langues décide.
        - le texte est affiché en permanence (at: 0) ; seules les voix sont calées ;
        - la voix « b » part (« voiceAt ») PAUSE s après la fin de la voix « a » la
          plus longue ;
        - la page dure jusqu'à la fin de la voix « b » la plus longue, plus PAUSE,
          plus l'arrêt avant le tournage (ui.nextLead + flip.duration) ;
        - une page à deux moments (ex. dp06) : le second part avec la voix « b ».
      Seules les pages dont les blocs ont « voice: true » sont touchées.
   Rien d'autre n'est modifié. Le résultat est affiché. */
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const LANGUES = ['fr', 'en'];
const PAUSE = 0.5;            // silence entre deux voix, et après la dernière, en secondes

/* Durée d'un fichier WAV (en-tête RIFF : octets par seconde et taille des données). */
function dureeWav(fichier) {
  const b = fs.readFileSync(fichier);
  let i = 12, octetsParS = 0;
  while (i + 8 <= b.length) {
    const id = b.toString('latin1', i, i + 4), n = b.readUInt32LE(i + 4);
    if (id === 'fmt ') octetsParS = b.readUInt32LE(i + 16);
    if (id === 'data') return n / octetsParS;
    i += 8 + n + (n % 2);
  }
  throw new Error('WAV illisible : ' + fichier);
}

const haut = function (x) { return Math.ceil(x * 10 - 1e-9) / 10; };   // arrondi au dixième supérieur
const ecrit = function (x) { return x.toFixed(1); };                    // 8 → '8.0'

/* 1. Tables des voix, par langue : clé du bloc → { fichier, durée } */
const tables = {};
LANGUES.forEach(function (lg) {
  tables[lg] = {};
  const dossier = path.join(RACINE, 'sounds/va', lg);
  fs.readdirSync(dossier).forEach(function (f) {
    const m = /^(\d+)([ab]?)_.*\.(wav|mp3)$/i.exec(f);
    if (!m) return;
    const n = Number(m[1]);
    const cle = n === 1 ? 'cover.t1' : 'dp' + String(n - 1).padStart(2, '0') + '.t' + (m[2].toLowerCase() === 'b' ? 2 : 1);
    if (tables[lg][cle]) console.warn('Deux fichiers pour ' + lg + ' ' + cle + ' : ' + tables[lg][cle].fichier + ', ' + f);
    tables[lg][cle] = { fichier: f, duree: /\.wav$/i.test(f) ? dureeWav(path.join(dossier, f)) : null };
  });
});

function ordre(a, b) { return a === 'cover.t1' ? -1 : b === 'cover.t1' ? 1 : a < b ? -1 : a > b ? 1 : 0; }
const fCfg = path.join(RACINE, 'js/config.js');
let cfg = fs.readFileSync(fCfg, 'utf8');
const debut = cfg.indexOf('  voices: {');
const fin = cfg.indexOf('\n  },\n', debut);
if (debut < 0 || fin < 0) throw new Error('js/config.js : bloc « voices » introuvable');
const bloc = '  voices: {\n' + LANGUES.slice().sort().reverse().map(function (lg) {   // en puis fr
  const cles = Object.keys(tables[lg]).sort(ordre);
  return '    ' + lg + ': {\n' + cles.map(function (k) { return "      '" + k + "': '" + tables[lg][k].fichier + "'"; }).join(',\n') + '\n    }';
}).join(',\n') + '\n  },\n';
cfg = cfg.slice(0, debut) + bloc + cfg.slice(fin + '\n  },\n'.length);
fs.writeFileSync(fCfg, cfg);

/* 2. Temps des doubles pages. */
global.window = global;
global.Demo = {};
eval(fs.readFileSync(fCfg, 'utf8'));
const C = Demo.config;
const arret = C.ui.nextLead + C.flip.duration;   // la lecture s'arrête ce temps-là avant la fin de la page

function plusLongue(cle) {
  let d = 0;
  LANGUES.forEach(function (lg) {
    const v = tables[lg][cle];
    if (!v) console.warn('Voix manquante : ' + lg + ' ' + cle);
    else if (v.duree === null) console.warn('Durée inconnue (mp3) : ' + lg + ' ' + v.fichier);
    else d = Math.max(d, v.duree);
  });
  return d;
}

const fBook = path.join(RACINE, 'js/book.js');
let src = fs.readFileSync(fBook, 'utf8');
// Zones commentées (/* … */) : les exemples de gabarits ne sont pas des pages.
const commentaires = [];
src.replace(/\/\*[\s\S]*?\*\//g, function (m, i) { commentaires.push([i, i + m.length]); return m; });
const commente = function (i) { return commentaires.some(function (c) { return i >= c[0] && i < c[1]; }); };

const lignes = [];
src = src.replace(/\{ id: '([\w-]+)'[\s\S]*?\] \},/g, function (seg, id, i) {
  if (commente(i)) return seg;
  const blocs = seg.match(/\{ page: [^\n]*\}/g) || [];
  if (!blocs.some(function (b) { return /voice: true/.test(b); })) return seg;
  let t = 0, bAt = null;
  const nouveaux = blocs.map(function (b, k) {
    if (!/voice: true/.test(b)) return b;
    const cle = id + '.t' + (k + 1);
    // Début de la voix : « voiceAt » (le texte, lui, est affiché dès « at »).
    const m = /voiceAt: ([\d.]+)/.exec(b) || /\bat: ([\d.]+)/.exec(b);
    let v = Number(m[1]);
    if (k > 0) { v = haut(t + PAUSE); bAt = v; }
    t = v + plusLongue(cle);
    return /voiceAt: [\d.]+/.test(b) ? b.replace(/voiceAt: [\d.]+/, 'voiceAt: ' + ecrit(v))
      : b.replace('voice: true', 'voice: true, voiceAt: ' + ecrit(v));
  });
  let s = seg;
  blocs.forEach(function (b, k) { s = s.replace(b, nouveaux[k]); });
  const duree = Math.max(haut(t + PAUSE + arret), 2);
  if (/duration: [\d.]+/.test(s.split('\n')[0])) s = s.replace(/duration: [\d.]+/, 'duration: ' + ecrit(duree));
  else s = s.replace("id: '" + id + "'", "id: '" + id + "', duration: " + ecrit(duree));
  // Deux moments : le second part avec le texte « b ».
  if (bAt !== null) s = s.replace(/(moments: \[\{[^}]*\}, \{ start: )[\d.]+, capture: [\d.]+/, function (m, a) { return a + ecrit(bAt) + ', capture: ' + ecrit(haut(bAt + 0.5)); });
  lignes.push(id.padEnd(8) + ' voix b à ' + (bAt === null ? '  -  ' : String(bAt).padStart(5)) + ' s, durée ' + String(duree).padStart(5) + ' s');
  return s;
});
fs.writeFileSync(fBook, src);
console.log(lignes.join('\n'));
