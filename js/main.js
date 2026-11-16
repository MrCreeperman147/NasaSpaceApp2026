/* main.js : relie l'interface aux modules. Ce fichier câble, il ne décide
   pas : les règles (page courante, cible de Prev/Next, vue du lecteur, caméra,
   thème, langue) sont des fonctions pures de nav.js, reader.js, camera.js,
   theme.js et lang.js.

   Les fonctions de transport (play, pause, seekTo, et goPrev, goNext,
   goSpread qui passent par elles) sont les seuls endroits où la timeline et
   la musique sont commandées.
   S#2-01 : la lecture s'arrête d'elle-même à la fin de chaque double page
   (arrêt posé par timeline.js, instants de spreads.holds) ; c'est le lecteur
   qui tourne la page. La musique est une boucle indépendante de la timeline :
   elle joue en lecture ET à l'arrêt, et ne se tait qu'en pause. */
(async function () {
  const D = window.Demo;
  const C = D.config;
  const W = C.W, H = C.H;
  const $ = function (id) { return document.getElementById(id); };
  const els = {
    stage: $('stage'), play: $('play'), playIcon: $('playIcon'), time: $('time'),
    seek: $('seek'), seekLabel: $('seekLabel'), ticks: $('ticks'),
    lang: $('lang'), langCode: $('langCode'),
    title: $('momentTitle'), pageText: $('pageText'), pageNum: $('pageNum'),
    prev: $('prev'), prevLabel: $('prevLabel'), next: $('next'), nextLabel: $('nextLabel'),
    zoom: $('zoom'), zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), zoomFit: $('zoomFit'),
    viewTitle: $('viewTitle'), viewPage: $('viewPage'), viewSpread: $('viewSpread'),
    menuTab: $('menuTab'), menuTabLabel: $('menuTabLabel'), menu: $('menu'), menuTitle: $('menuTitle'), menuClose: $('menuClose'),
    momentsTitle: $('momentsTitle'), moments: $('moments'),
    soundTitle: $('soundTitle'), mute: $('mute'), muteIcon: $('muteIcon'), muteLabel: $('muteLabel'),
    exportTitle: $('exportTitle'), exportHint: $('exportHint'), exportBtn: $('export'), exportStatus: $('exportStatus'),
    version: $('version')
  };

  /* Langue : le stockage peut être bloqué (navigation privée, réglages) ; lang.js s'en accommode. */
  let storage = null;
  try { storage = window.localStorage; } catch (e) { storage = null; }
  D.lang.init(storage);
  const tx = function (key, vars) { return D.lang.get(key, vars); };

  function stageMessage(text) {
    const p = document.createElement('p');
    p.className = 'stage-msg';
    p.textContent = text;
    els.stage.replaceChildren(p);
  }

  if (!window.PIXI || !window.gsap || !window.PixiPlugin || !window.Howl || !window.jspdf) {
    stageMessage(tx('errLibs'));
    return;
  }

  /* Polices du livre (css/fonts, @font-face) : le texte des pages est mesuré
     et coupé à la création de la scène, on les attend donc avant (3 s au plus).
     Une police qui n'a pas pu être chargée est signalée ; la page démarre
     quand même, avec la police de repli. */
  const bookFonts = [C.ui.fonts.title, C.ui.fonts.body].map(function (f) { return f.match(/^"([^"]+)"/)[1]; });
  try {
    await Promise.race([
      // allSettled : on attend chaque police jusqu'au bout, même si l'autre échoue
      // (avec Promise.all, un échec arrêtait l'attente avant la fin de l'autre).
      Promise.allSettled(bookFonts.map(function (name) { return document.fonts.load('32px "' + name + '"'); })),
      new Promise(function (r) { setTimeout(r, 3000); })
    ]);
  } catch (e) { /* signalé ci-dessous */ }
  const loaded = {};
  document.fonts.forEach(function (f) { if (f.status === 'loaded') loaded[f.family.replace(/["']/g, '')] = true; });
  bookFonts.forEach(function (name) {
    if (!loaded[name]) console.warn('Police du livre non chargée : ' + name + ' (css/fonts). Police de repli utilisée.');
  });

  let scene, tl;
  try {
    scene = await D.scene.create(els.stage);
    tl = D.timeline.build(scene, onHold);   // onHold : arrêt de fin de double page (plus bas)
    scene.bake(tl);          // images figées des tournages et couleur moyenne des doubles pages, calculées une fois
    // Une configuration incohérente est signalée dans la console, sans bloquer la page.
    []
      .concat(D.spreads.checks(C, D.book, {
        animations: Object.keys(D.animations || {}),
        sfx: D.audio.sounds.sfx, music: D.audio.sounds.music,
        palette: C.palette, texts: D.texts
      }))
      .concat(D.flip.conflicts(scene.flips, D.book.keyMoments, D.book.duration))
      .concat(D.nav.checks(D.book, scene.flips))
      .concat(D.blocks.checks(C, D.book, D.texts))
      .concat(scene.overflows())
      .concat(D.lang.missing(D.texts))
      .concat(D.lang.problems)          // clés inconnues dans ts/<langue>/book.js (S#2-02)
      .concat(D.assets.sizeProblems(D.book.spreads, scene.backgroundSizes, C))   // fonds trop grands ou déformés (S#2-03)
      .forEach(function (m) { console.warn(m); });
    D.audio.init();
    // Sous ?debug : bilan de démarrage à l'écran (journal.js), et perte du contexte WebGL signalée.
    scene.app.canvas.addEventListener('webglcontextlost', function () { console.error('Contexte WebGL perdu : plus rien ne peut être dessiné.'); });
    if (D.journal && D.journal.active) {
      const r = scene.app.renderer;
      let maxTex = '?';
      try { maxTex = r.gl.getParameter(r.gl.MAX_TEXTURE_SIZE); } catch (e) { /* rendu sans WebGL */ }
      D.journal.summary({
        version: C.version, ua: navigator.userAgent, dpr: window.devicePixelRatio || 1,
        renderer: r.name || String(r.type), resolution: r.resolution, maxTexture: maxTex,
        expected: D.assets.manifest(D.book.spreads).bundles.map(function (b) { return b.name; }),
        loaded: scene.backgrounds, flips: scene.flips.length, W: W, H: H, secure: window.isSecureContext
      }).forEach(function (l) { console.info(l); });
    }
  } catch (e) {
    console.error(e);
    stageMessage(tx('errScene'));
    return;
  }

  const DUR = D.book.duration;
  const moments = D.book.keyMoments;
  const pdfPages = D.exporter.plan(D.book).length;   // pages du PDF : la couverture, puis deux par moment
  const spreads = D.book.spreads;
  // Un thème par double page, d'après sa couleur moyenne (thème par défaut si elle n'a pas pu être lue).
  const themes = scene.spreadColors.map(function (rgb) { return D.theme.themeFor(rgb, C.palette); });
  const debug = /[?&]debug\b/.test(window.location.search);   // ?debug : curseur, repères et temps (tests)
  // Vue du lecteur (page ou double page, côté affiché) : voir reader.js et « vue du lecteur » plus bas.
  let reader = D.reader.init(storage, window.innerWidth, C.ui);

  let playing = false;     // la timeline avance
  let held = false;        // arrêt de fin de double page : image figée, musique qui continue (S#2-01)
  let fresh = true;        // vrai tant que l'utilisateur n'a rien fait : la page affiche l'écran-titre
  let dragging = false;
  let resumeAfterDrag = false;

  /* ---------- transport ---------- */

  /* Musique : elle joue en lecture et à l'arrêt, se tait en pause. Elle ne
     suit pas le temps t (boucle indépendante, règles 4 à 6 du projet). */
  function syncMusic() {
    if (playing || held) D.audio.play(); else D.audio.pause();
  }

  /* Lecture. Première fois : depuis le début du livre. À l'arrêt de fin de
     double page (ou à la fin du livre) : la double page courante rejoue depuis
     son début. Après une pause : reprise là où l'on était. */
  function play() {
    if (fresh) seekTo(0);
    else if (held) seekTo(spreads[D.nav.spreadAt(spreads, tl.time())].start);
    else D.audio.resumeVoice();      // après une pause : la voix reprend où elle était (S#2-02)
    playing = true;
    tl.play();
    syncMusic();
    renderTransport();
  }

  function pause() {
    playing = false;
    held = false;
    tl.pause();
    D.audio.pauseVoice();             // la voix se met en pause avec la lecture (S#2-02)
    syncMusic();
    renderTransport();
  }

  /* Saut à l'instant t. Un saut quitte l'arrêt (held) sans toucher à la
     musique : l'appelant enchaîne avec play() (Suiv., Préc., Menu) ou non. */
  function seekTo(t) {
    fresh = false;
    held = false;
    D.audio.stopVoice();              // un saut arrête la voix : celle de la page d'arrivée partira à l'apparition de son texte (S#2-02)
    t = Math.max(0, Math.min(DUR, t));
    tl.seek(t);                       // ni les effets sonores sautés, ni les arrêts ne se déclenchent
    reader = D.reader.follow(reader, D.nav.spreadAt(spreads, t));   // côté oublié si l'on change de double page
    scene.update(t);                  // seek() ne déclenche pas onUpdate : on redessine ici
    refresh();
  }

  /* Arrêt de fin de double page : appelé par la timeline (addPause), déjà
     arrêtée pile à l'instant de l'arrêt et dessinée. La musique continue, et
     la voix aussi, jusqu'au bout (S#2-02). */
  function onHold() {
    playing = false;
    held = true;
    renderTransport();
    refresh();
  }

  /* Préc. et Suiv. : la cible vient de nav.prev / nav.next selon la vue du
     lecteur. Vue double page : début de la double page précédente, ou saut
     juste avant le tournage suivant puis lecture (on voit la feuille tourner
     et on entend le papier). Vue page : d'abord l'autre page de la double
     page (glissement de 0,4 s, le temps ne bouge pas), puis la double page
     voisine. */
  function step(res) {
    if (!res) return;
    if (res.t === null) {
      changeView(function () { reader = D.reader.setSide(reader, res.side, D.nav.spreadAt(spreads, tl.time())); });
    } else {
      // Le côté est posé avant le saut : la première image est déjà la bonne.
      reader = D.reader.setSide(reader, res.side, D.nav.spreadAt(spreads, res.t));
      seekTo(res.t);
    }
    if (res.play && !playing) play();
    refresh();
  }
  function goPrev() { step(D.nav.prev(reader, spreads, scene.flips, tl.time())); }
  function goNext() { step(D.nav.next(reader, spreads, scene.flips, tl.time(), C.ui.nextLead)); }

  /* Menu : saut au début de la double page i, puis lecture : elle joue
     jusqu'à son arrêt (S#2-01, une entrée par double page depuis S#2-02). */
  function goSpread(i) {
    seekTo(spreads[i].start);
    play();
  }

  /* Fin du livre (crédits) : comme un arrêt, la musique continue. */
  tl.eventCallback('onComplete', function () {
    playing = false;
    held = true;
    renderTransport();
  });

  /* ---------- interface : construction ---------- */

  // Menu : une entrée par double page (S#2-02), avec sa plage de pages et le
  // titre de son premier moment s'il en a un (spreads.pages).
  const pageNums = D.spreads.pages(D.book);
  const firstMoment = spreads.map(function (sp, i) {
    return moments.filter(function (km) { return km.spread === i; })[0] || null;
  });
  function pagesText(p, key1, keyN) {
    return p.first === p.last ? tx(key1, { n: p.first }) : tx(keyN, { a: p.first, b: p.last });
  }
  const spreadButtons = spreads.map(function (sp, i) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    const p = pageNums[i];
    b.type = 'button';
    b.className = 'moment';
    b.innerHTML = '<span class="moment-n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<span class="moment-t"></span><span class="moment-time">' + (p.first === p.last ? p.first : p.first + '-' + p.last) + '</span>';
    b.addEventListener('click', function () { goSpread(i); els.menu.close(); });
    li.appendChild(b);
    els.moments.appendChild(li);
    return b;
  });

  // Repères du curseur : un par moment clé (à son début), un plus marqué par double page.
  moments.forEach(function (km) {
    const tick = document.createElement('span');
    tick.style.left = (km.start / DUR * 100) + '%';
    els.ticks.appendChild(tick);
  });
  spreads.forEach(function (p) {
    const tick = document.createElement('span');
    tick.className = 'tick-page';
    tick.style.left = (p.start / DUR * 100) + '%';
    els.ticks.appendChild(tick);
  });
  els.seek.max = String(DUR);
  document.body.classList.toggle('debug', debug);   // curseur, repères et temps : seulement sous ?debug (style.css)

  /* ---------- interface : textes (rappelé à chaque changement de langue) ---------- */

  function applyTexts() {
    document.documentElement.lang = D.lang.current;
    els.langCode.textContent = tx('langCode');
    els.lang.setAttribute('aria-label', tx('langSwitch'));
    els.menuTabLabel.textContent = tx('menu');
    els.menuTab.setAttribute('aria-label', tx('menuOpen'));
    els.menuTitle.textContent = tx('menu');
    els.menuClose.setAttribute('aria-label', tx('close'));
    els.prevLabel.textContent = tx('prev');
    els.prev.setAttribute('aria-label', tx('prevLabel'));
    els.nextLabel.textContent = tx('next');
    els.next.setAttribute('aria-label', tx('nextLabel'));
    els.seekLabel.textContent = tx('seek');
    els.stage.setAttribute('aria-label', tx('stage'));
    els.pageText.setAttribute('aria-label', tx('pageText'));
    els.zoom.setAttribute('aria-label', tx('zoom'));
    els.zoomIn.setAttribute('aria-label', tx('zoomIn'));
    els.zoomOut.setAttribute('aria-label', tx('zoomOut'));
    els.zoomFit.setAttribute('aria-label', tx('zoomFit'));
    els.momentsTitle.textContent = tx('moments');
    els.viewTitle.textContent = tx('view');
    els.viewPage.textContent = tx('viewPage');
    els.viewSpread.textContent = tx('viewSpread');
    els.soundTitle.textContent = tx('sound');
    els.exportTitle.textContent = tx('exportTitle');
    els.exportHint.textContent = tx('exportHint');
    els.exportBtn.textContent = tx('exportButton', { n: pdfPages });
    els.exportStatus.textContent = '';
    els.version.textContent = tx('version', { v: C.version });
    // Titre du premier moment de la double page, sinon « Pages 2-3 » (titre facultatif, S#2-02).
    spreadButtons.forEach(function (b, i) {
      const title = firstMoment[i] ? D.lang.moment(firstMoment[i].id).title : '';
      b.querySelector('.moment-t').textContent = title || pagesText(pageNums[i], 'menuPage', 'menuPages');
    });
    renderMute();
    renderViewSwitch();
    renderTransport();
    lastMoment = -1;       // force la réécriture du titre du moment…
    lastPages = '';        // …du numéro de page…
    lastMirror = '';       // …et du miroir du texte
    refresh();
  }

  function renderTransport() {
    els.playIcon.className = 'icon ' + (playing ? 'icon-pause' : 'icon-play');
    els.play.setAttribute('aria-label', playing ? tx('pause') : tx('play'));
  }

  let muted = false;
  function renderMute() {
    els.mute.setAttribute('aria-pressed', String(muted));
    els.muteIcon.className = 'icon ' + (muted ? 'icon-sound-off' : 'icon-sound-on');
    els.muteLabel.textContent = muted ? tx('soundOff') : tx('soundOn');
  }

  /* ---------- interface : ce qui suit le temps ---------- */

  /* Miroir du texte de la double page pour les lecteurs d'écran : un
     paragraphe par bloc visible, page gauche puis droite, dans la langue
     courante. Réécrit seulement quand cette liste ou la langue change. */
  let lastMirror = '';
  function renderMirror(sp, i, t) {
    // En vue page, seulement la page affichée (reader.shownPage).
    const keys = D.blocks.keys(sp, D.spreads.localTime(sp, t), D.reader.shownPage(reader, sp, i));
    const sig = D.lang.current + '|' + keys.join('|');   // les clés changent avec la page lue
    if (sig === lastMirror) return;
    lastMirror = sig;
    els.pageText.replaceChildren.apply(els.pageText, keys.map(function (k) {
      const p = document.createElement('p');
      p.textContent = D.lang.block(k);
      return p;
    }));
  }

  /* Met l'interface dans l'état de l'instant courant : temps, curseur, moment
     courant (titre, Menu), double page courante (Prev, Next, miroir du texte)
     et thème. Appelé à chaque battement de GSAP et après un saut ; n'écrit
     dans la page que ce qui a changé. */
  let lastShown = -1, lastMoment = -1, lastNav = '', lastPages = '';
  function refresh() {
    const t = tl.time();
    if (t !== lastShown && (Math.abs(t - lastShown) > 0.04 || t === 0 || t === DUR)) {
      lastShown = t;
      els.time.textContent = D.formatTime(t);
      if (!dragging) els.seek.value = t.toFixed(2);
    }
    const m = D.nav.momentAt(moments, t);
    if (m !== lastMoment) {
      lastMoment = m;
      els.title.textContent = D.lang.moment(moments[m].id).title;   // vide si le moment n'a pas de titre
    }
    const p = D.nav.spreadAt(spreads, t);
    reader = D.reader.follow(reader, p);   // lecture qui franchit un tournage : côté oublié
    // Numéro de page (S#2-02) : la page affichée en vue page, les deux en vue double page.
    const shown = D.spreads.pagesShown(D.book, p, D.reader.shownPage(reader, spreads[p], p));
    const pagesKey = D.lang.current + '|' + p + '|' + shown.first + '|' + shown.last;
    if (pagesKey !== lastPages) {
      lastPages = pagesKey;
      els.pageNum.textContent = shown.first === shown.last
        ? tx('pageOne', { n: shown.first, total: shown.total })
        : tx('pageRange', { a: shown.first, b: shown.last, total: shown.total });
      spreadButtons.forEach(function (b, i) {
        b.classList.toggle('is-current', i === p);
        if (i === p) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }
    // Préc. et Suiv. dépendent de la double page, de la vue, du côté et du tournage en cours.
    const inFlip = scene.flips.some(function (f) { return t >= f.from && t < f.to; });
    const navKey = p + '|' + reader.mode + '|' + D.reader.sideAt(reader, p) + '|' + inFlip;
    if (navKey !== lastNav) {
      lastNav = navKey;
      els.prev.disabled = D.nav.prev(reader, spreads, scene.flips, t) === null;
      els.next.disabled = D.nav.next(reader, spreads, scene.flips, t, C.ui.nextLead) === null;
    }
    renderMirror(spreads[p], p, t);
    D.theme.apply(D.theme.themeAt(themes, scene.flips, t), document.documentElement);
  }
  gsap.ticker.add(refresh);

  /* ---------- interface : commandes ---------- */

  els.play.addEventListener('click', function () { if (playing) pause(); else play(); });
  els.prev.addEventListener('click', goPrev);
  els.next.addEventListener('click', goNext);

  els.lang.addEventListener('click', function () {
    D.lang.set(D.lang.other(), storage);   // ne touche ni à la timeline ni à la musique
    D.audio.stopVoice();                   // la voix en cours est dans l'ancienne langue (S#2-02)
    scene.setLang(tl);                     // texte des pages et images figées des tournages
    applyTexts();
  });

  els.mute.addEventListener('click', function () {
    muted = !muted;
    D.audio.mute(muted);
    renderMute();
  });

  /* Menu : dialog natif (Échap, piège et retour du focus fournis par le navigateur). */
  els.menuTab.addEventListener('click', function () { els.menu.showModal(); });
  els.menuClose.addEventListener('click', function () { els.menu.close(); });
  els.menu.addEventListener('click', function (e) {
    if (e.target === els.menu) els.menu.close();   // clic sur le fond assombri
  });

  /* Curseur (sous ?debug seulement) : pendant le glissement, la timeline est
     en pause et seule l'image suit ; la lecture reprend au relâchement. */
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (resumeAfterDrag) {
      resumeAfterDrag = false;
      playing = true;
      tl.play();
      renderTransport();
    }
    syncMusic();
  }
  els.seek.addEventListener('pointerdown', function () {
    dragging = true;
    resumeAfterDrag = playing;
    if (playing) { playing = false; tl.pause(); renderTransport(); }
  });
  els.seek.addEventListener('input', function () { seekTo(parseFloat(els.seek.value)); });
  els.seek.addEventListener('change', endDrag);
  els.seek.addEventListener('pointerup', endDrag);
  els.seek.addEventListener('pointercancel', endDrag);

  /* ---------- vue du lecteur et zoom ---------- */

  /* Vue du lecteur (reader.js) : « page » (fenêtre 8:9, une page) ou
     « spread » (fenêtre 16:9, la double page). Par défaut selon la largeur
     de l'écran ; le choix du lecteur, dans le Menu, est mémorisé et prime. */
  let userView = D.camera.home(W, H);       // zoom de la vue double page (état de la vue, pas du temps)
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Transition de 0,4 s quand le lecteur change de vue ou de côté : elle se
     fait hors de la timeline (le temps et l'audio ne bougent pas). Exception
     bornée à la règle « pas de boucle de rendu » : on redessine image par
     image pendant la transition seulement, puis plus rien. */
  let glide = null;          // { from: caméra de départ, start: instant (ms) }
  function glideK() {
    if (!glide) return 1;
    const dur = reduced ? 0 : C.ui.viewEase * 1000;
    return dur > 0 ? (performance.now() - glide.start) / dur : 1;
  }

  /* Caméra de l'instant t : la vue du lecteur (camera.viewAt), ou le zoom du
     lecteur en vue double page, mélangée à la caméra de départ pendant une
     transition. Fournie à la scène, qui l'applique à chaque image. */
  function cameraFor(t) {
    const zoomed = reader.mode === 'spread' && userView.zoom > C.ui.zoomMin;
    const cam = zoomed ? userView : D.camera.viewAt(reader, D.book, scene.flips, t, C.ui.viewEase);
    return glide ? D.camera.blend(glide.from, cam, glideK()) : cam;
  }
  scene.setCamera(cameraFor);

  function animateGlide() {
    scene.update(tl.time());
    if (glideK() >= 1) { glide = null; scene.update(tl.time()); return; }
    requestAnimationFrame(animateGlide);
  }

  /* Change la vue du lecteur (mode ou côté) : change(), puis transition. */
  function changeView(change) {
    const from = cameraFor(tl.time());
    const running = !!glide;
    change();
    glide = { from: from, start: performance.now() };
    layout();
    refresh();
    if (!running) requestAnimationFrame(animateGlide);
  }

  /* Forme de la fenêtre et attribut data-view (« page » ou « spread ») selon la vue. */
  function layout() {
    document.body.dataset.view = reader.mode;
    document.documentElement.style.setProperty('--win-ratio', String(D.camera.ratio(reader.mode, C)));
  }
  window.addEventListener('resize', function () {
    const next = D.reader.resize(reader, window.innerWidth, C.ui);
    if (next.mode === reader.mode) return;
    reader = next;
    if (reader.mode === 'page') setUserView(D.camera.home(W, H));
    layout();
    scene.update(tl.time());
    refresh();
  });

  function renderViewSwitch() {
    els.viewPage.setAttribute('aria-pressed', String(reader.mode === 'page'));
    els.viewSpread.setAttribute('aria-pressed', String(reader.mode === 'spread'));
  }
  function chooseMode(mode) {
    if (mode === reader.mode) return;
    changeView(function () {
      reader = D.reader.setMode(reader, mode, storage);
      if (mode === 'page') { userView = D.camera.home(W, H); renderZoom(); }   // pas de zoom en vue page
    });
    renderViewSwitch();
  }
  els.viewPage.addEventListener('click', function () { chooseMode('page'); });
  els.viewSpread.addEventListener('click', function () { chooseMode('spread'); });

  /* Zoom de la vue double page : un état de la vue, indépendant du temps.
     À 100 %, la vue suit le livre (couverture, tournages) ; dès que le lecteur
     zoome, il tient la vue (à partir du cadrage courant) jusqu'à « Ajuster ».
     On redessine une image à chaque changement (pas de boucle de rendu). */
  function renderZoom() {
    els.zoomOut.disabled = userView.zoom <= C.ui.zoomMin;
    els.zoomFit.disabled = userView.zoom <= C.ui.zoomMin;
    els.zoomIn.disabled = userView.zoom >= C.ui.zoomMax;
    els.stage.classList.toggle('is-zoomed', userView.zoom > C.ui.zoomMin);
  }
  function setUserView(v) {
    userView = v;
    renderZoom();
    scene.update(tl.time());
  }
  function zoomStart() {
    return userView.zoom > C.ui.zoomMin ? userView : D.camera.viewAt(reader, D.book, scene.flips, tl.time(), C.ui.viewEase);
  }
  els.zoomIn.addEventListener('click', function () { setUserView(D.camera.zoomBy(zoomStart(), 1, C.ui, W, H)); });
  els.zoomOut.addEventListener('click', function () { setUserView(D.camera.zoomBy(userView, -1, C.ui, W, H)); });
  els.zoomFit.addEventListener('click', function () { setUserView(D.camera.home(W, H)); });

  // Glisser pour déplacer la vue agrandie.
  let panFrom = null;
  let swipeFrom = null;      // début d'un glissement qui peut tourner la page (S#2-04)
  els.stage.addEventListener('pointerdown', function (e) {
    swipeFrom = null;
    if (e.button !== 0) return;
    if (reader.mode !== 'spread' || userView.zoom <= C.ui.zoomMin) {
      // Pas de vue agrandie : glisser tourne la page (swipe), comme Préc. et Suiv.
      swipeFrom = { x: e.clientX, y: e.clientY };
      els.stage.setPointerCapture(e.pointerId);
      return;
    }
    panFrom = { x: e.clientX, y: e.clientY };
    els.stage.setPointerCapture(e.pointerId);
    els.stage.classList.add('is-dragging');
  });
  els.stage.addEventListener('pointermove', function (e) {
    if (!panFrom) return;
    const k = W / els.stage.clientWidth;      // pixels de l'écran vers pixels du canevas
    setUserView(D.camera.pan(userView, (e.clientX - panFrom.x) * k, (e.clientY - panFrom.y) * k, W, H));
    panFrom = { x: e.clientX, y: e.clientY };
  });
  function endPan() { panFrom = null; els.stage.classList.remove('is-dragging'); }
  /* Fin d'un glissement : la décision vient de nav.swipe (fonction pure), l'action
     passe par goNext / goPrev, le même chemin que les boutons. */
  function endSwipe(e) {
    if (panFrom) return;              // vue agrandie : glisser déplaçait l'image
    if (!swipeFrom) return;
    const dir = D.nav.swipe(e.clientX - swipeFrom.x, e.clientY - swipeFrom.y, C.ui);
    swipeFrom = null;
    if (dir === 'next') goNext();
    else if (dir === 'prev') goPrev();
  }
  els.stage.addEventListener('pointerup', function (e) { endSwipe(e); endPan(); });
  // Le navigateur a pris le geste (défilement vertical, geste du système) : pas de swipe.
  els.stage.addEventListener('pointercancel', function () { swipeFrom = null; endPan(); });

  /* ---------- export PDF ---------- */

  const hasPlatform = !!(window.claude && typeof window.claude.use === 'function');
  if (hasPlatform) window.claude.use('downloads').catch(function () {});

  async function save(blob) {
    const size = tx('sizeKb', { n: Math.round(blob.size / 1024) });
    const file = tx('pdfFile');
    if (hasPlatform) {
      // Page publiée sur claude.ai : l'enregistrement passe par la plateforme.
      let dl = null;
      try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
      if (!dl) return tx('exportUnsaved', { size: size });
      try {
        await dl.save({ filename: file, data: blob });
        return tx('exportSaved', { n: pdfPages, size: size });
      } catch (e) {
        if (e && e.code === 'declined') return tx('exportDeclined');
        return tx('exportUnsaved', { size: size });
      }
    }
    // Hors plateforme (projet lancé en local) : téléchargement classique.
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    return tx('exportDownloaded', { n: pdfPages, size: size });
  }

  els.exportBtn.addEventListener('click', async function () {
    // Lecture ou arrêt : la musique joue. L'export la coupe (audio verrouillé)
    // et remet ensuite l'état du lecteur tel qu'il était (S#2-01).
    const was = { playing: playing, held: held };
    D.audio.stopVoice();             // l'export saute d'une page à l'autre : la voix ne reprendra pas (S#2-02)
    playing = false;
    held = false;
    tl.pause();
    syncMusic();
    renderTransport();
    els.exportBtn.disabled = true;
    // L'export saute d'une double page à l'autre ; l'interface, rafraîchie à
    // chaque battement, oublierait le côté choisi (reader.follow). La vue du
    // lecteur est donc gardée, puis remise à la fin, comme le temps.
    const kept = reader;
    try {
      const res = await D.exporter.run(tl, scene, function (i, n) {
        els.exportStatus.textContent = tx('exportCapturing', { i: i, n: n });
      });
      D.debug.lastExport = res;      // pour la vérification (nombre de pages, taille)
      els.exportStatus.textContent = tx('exportSaving');
      els.exportStatus.textContent = await save(res.blob);
    } catch (e) {
      console.error(e);
      els.exportStatus.textContent = tx('exportFailed', { msg: e && e.message ? e.message : tx('unknownError') });
    } finally {
      reader = kept;
      scene.update(tl.time());
      if (was.held) held = true;
      else if (was.playing) { playing = true; tl.play(); }
      syncMusic();
      renderTransport();
      refresh();
      els.exportBtn.disabled = false;
    }
  });

  /* ---------- état initial : écran-titre, en pause ---------- */

  D.debug = {
    tl: tl, scene: scene, themes: themes,
    isPlaying: function () { return playing; },
    isHeld: function () { return held; },
    view: function () { return { reader: reader, user: userView, camera: cameraFor(tl.time()), gliding: !!glide }; }
  };
  tl.seek(moments[0].t);
  layout();                       // pose la forme de la fenêtre selon la vue du lecteur
  setUserView(userView);          // état initial des boutons de zoom, et première image
  applyTexts();
  // La fenêtre ne change de forme en douceur qu'après sa première mise en place
  // (sinon, au chargement, on la verrait passer de 16:9 à 8:9).
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.querySelector('.app').classList.add('is-ready'); }); });
})();
