/* charger.js : charge les scripts navigateur du projet dans Node, avec un
   « window » factice, sans modifier leur format (workflow §2). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* apres (facultatif) : { '<fichier>': function (Demo) {…} }, appelé juste
   après le chargement de ce fichier (ex. modifier le livre avant sa compilation). */
module.exports = function charger(fichiers, apres) {
  const window = {};
  const contexte = vm.createContext({ window: window, Demo: undefined, console: console, Math: Math, Float32Array: Float32Array, Uint32Array: Uint32Array });
  // « Demo » est une globale du navigateur (window.Demo) : on la relie ici.
  Object.defineProperty(contexte, 'Demo', { get: function () { return window.Demo; }, set: function (v) { window.Demo = v; } });
  fichiers.forEach(function (f) {
    const code = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    vm.runInContext(code, contexte, { filename: f });
    if (apres && apres[f]) apres[f](window.Demo);
  });
  return window.Demo;
};
