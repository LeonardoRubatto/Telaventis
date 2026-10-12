/* Telaventis — behaviour layer. Sections, in file order:
 *  0   mobile menu (close on link, Escape) · 0b headroom (bar hides on the
 *      way down, returns on the way up)
 *  1   staggered reveal-on-scroll for [data-reveal] — a handful of major
 *      narrative groups per page, not every card
 *  2   the "ink" pointer effect on [data-ink] headings (idle until near)
 *  2c  the home headline's weather: letters arrive wide and thin, a gust
 *      crosses, the pointer parts them (Archivo's wght/wdth axes)
 *  3   hero band: the diagonal cut steepens and slips with scroll, the sky
 *      in the letters follows the pointer
 *  5   live proof: this page's own numbers (Performance API)
 *  6   home showcase: one full-screen scene per client project
 *  7   work page: live recordings play in view, index follows the scroll
 *  4   contact form: Web3Forms in place, plain POST fallback
 * The client projects themselves (scenes, work blocks, footer links) are
 * generated from _outils/projets.json — see _outils/MODE-EMPLOI.md.
 * Every effect has a static, readable resting state: no JS, reduced motion
 * and print all get the plain page. */
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  html.classList.remove('no-js');

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pointerFine = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);

  /* --- connection tier: decided ONCE per page load, never revisited ----------
   * The heavy parts of the site (the WebGPU jellyfish, the recordings, the
   * 2D jellyfish, the bubble flight at full density) are a luxury a bad
   * connection or a weak device cannot pay for, and a page that changes its
   * mind half-way (a jellyfish that appears, then a different one) is worse
   * than either version. So the tier is read here, first thing, and kept:
   * until the next reload, the visitor has the same version throughout.
   * "lite" is the version the phones already get (telaventis-fx.js: the
   * flow field instead of the jellyfish, no WebGPU), plus posters instead of
   * recordings (§6, §7).
   * Signals, any one is enough:
   *  · the Network Information API (Chromium only): saveData, a 2g/3g
   *    effective type, a downlink under 1.5 Mbit/s or an RTT over 450 ms;
   *  · measured, for the browsers that do not have it (Safari, Firefox):
   *    this deferred script only starts once the page's HTML and its CSS are
   *    in, so if that took more than 1.8 s the connection is the problem
   *    (a cold load on a decent line starts it in well under a second;
   *    measured: ~2.4 s at 700 kbit/s, ~1.6-1.9 s at 1.6 Mbit/s);
   *  · a weak device: 2 cores or fewer, or 2 GB of memory or less;
   *  · ?lite=1 / ?lite=0 in the address, to see either version on purpose.
   * Exposed as window.__tvTier = { lite, why } and as html.lite. */
  var tier = (function () {
    var q = /[?&]lite=([01])/.exec(location.search);
    if (q) return { lite: q[1] === '1', why: 'url' };
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var why = '';
    if (c && c.saveData) why = 'saveData';
    else if (c && /^(slow-2g|2g|3g)$/.test(c.effectiveType || '')) why = c.effectiveType;
    else if (c && c.downlink && c.downlink < 1.5) why = 'downlink ' + c.downlink;
    else if (c && c.rtt && c.rtt > 450) why = 'rtt ' + c.rtt;
    else if (window.performance && performance.now() > 1800) why = 'slow start ' + Math.round(performance.now());
    else if ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2)) why = 'weak device';
    return { lite: !!why, why: why, at: Math.round(window.performance ? performance.now() : 0) };
  }());
  window.__tvTier = tier;
  if (tier.lite) html.classList.add('lite');
  var lite = tier.lite;
  /* posters are applied by script, as the video's scene comes near (the
     browser fetches a poster the moment it sees the attribute, even with
     preload="none": ten of them, 420 KB, used to be fetched before the
     headline's own font). The generator writes data-poster; without script
     a <noscript> still stands in for the video. */
  var loadPoster = function (v) {
    var p = v.getAttribute && v.getAttribute('data-poster');
    if (p) { v.setAttribute('poster', p); v.removeAttribute('data-poster'); }
  };

  /* --- 0. mobile menu: close the <details> disclosure after a link is
     clicked. Purely a nicety — the menu works perfectly without this (native
     <details>/<summary>, no JS required to open or close it). --- */
  var navToggle = document.querySelector('.nav__toggle-wrap');
  var navLinksList = document.querySelector('.nav__links');
  var navBar = document.querySelector('.nav');
  if (navToggle && navLinksList) {
    navLinksList.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navToggle.removeAttribute('open'); });
    });
    /* the open menu covers the page, so it behaves like one: Escape closes
       it and hands focus back to the toggle, and tabbing out of the bar
       closes it rather than leaving it open over content you can't see */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navToggle.hasAttribute('open')) {
        navToggle.removeAttribute('open');
        var s = navToggle.querySelector('summary');
        if (s) s.focus();
      }
    });
    if (navBar) navBar.addEventListener('focusout', function (e) {
      if (navToggle.hasAttribute('open') && e.relatedTarget && !navBar.contains(e.relatedTarget)) navToggle.removeAttribute('open');
    });
  }

  /* --- 0b. headroom: hide the bar while reading down, bring it back the
     moment the visitor scrolls up (or tabs into it). A 6px dead zone keeps
     trackpad jitter from flickering it. --- */
  if (navBar) {
    var lastY = window.scrollY, hrRaf = 0;
    /* Inside the pinned project showcase the bar never comes back by itself:
       the page moves there on its own (the scene's resting point, the project
       timer, a hand-over) and an upward nudge of a few pixels used to bring the
       bar down over the project names and the copy while someone was reading.
       It returns when the visitor scrolls up past the top of the showcase, and
       only then. */
    var showcaseTrack = document.querySelector('[data-showcase] .showcase__track');
    var inShowcase = function () {
      if (!showcaseTrack || !document.querySelector('[data-showcase][data-showcase-live]')) return false;
      var r = showcaseTrack.getBoundingClientRect();
      return r.top <= 0 && r.bottom > (window.innerHeight || 800) * 0.5;
    };
    var headroom = function () {
      hrRaf = 0;
      var y = window.scrollY, dy = y - lastY;
      if (inShowcase() && !navBar.contains(document.activeElement)) { navBar.classList.add('nav--hidden'); lastY = y; return; }
      if (Math.abs(dy) < 6) return;
      var menuOpen = navToggle && navToggle.hasAttribute('open');
      navBar.classList.toggle('nav--hidden', dy > 0 && y > 140 && !menuOpen && !navBar.contains(document.activeElement));
      lastY = y;
    };
    window.addEventListener('scroll', function () { if (!hrRaf) hrRaf = requestAnimationFrame(headroom); }, { passive: true });
    navBar.addEventListener('focusin', function () { navBar.classList.remove('nav--hidden'); });
  }

  /* --- 1. staggered reveal on entry --------------------------------------- */
  var targets = document.querySelectorAll('[data-reveal]');
  if (targets.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry, i) {
          if (entry.isIntersecting) {
            var d = (Number(entry.target.dataset.order) || i) * 70;
            setTimeout(function () { entry.target.classList.add('in'); }, d);
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
      targets.forEach(function (t) { io.observe(t); });
    }
  }

  /* --- 2. ink hover effect on [data-ink] headings ------------------------- *
   * Rewritten to be idle by default: a cheap, rAF-throttled proximity probe
   * runs on pointermove; the actual paint loop only starts once the pointer
   * is within range of a heading, and it stops requesting new frames the
   * instant nothing is lit and nothing is near. Bounding rects are cached
   * and only refreshed on scroll/resize, never read on every pointermove. */
  var inkNodes = Array.prototype.slice.call(document.querySelectorAll('[data-ink]'));
  if (inkNodes.length && !reduce && pointerFine) {
    /* Resolved against THIS FILE, not against the page. A url() written into
       an inline style resolves against the document, so the literal
       'assets/art/…' this used to be became '/en/assets/art/…' on the English
       and Italian homepages and 404'd. The veil gradient underneath it is
       transparent in the middle, so with the image missing the hovered
       letters showed the cream page background straight through — they went
       white, ringed by the gradient's navy. The script always sits in
       assets/, so deriving the path from its own src is correct at any
       page depth. */
    var ART = "url('" + (function () {
      var s = document.currentScript;
      try { return s ? new URL('art/alexandra-fox.jpg', s.src).href : 'assets/art/alexandra-fox.jpg'; }
      catch (e) { return 'assets/art/alexandra-fox.jpg'; }
    }()) + "')";
    var ptr = { x: -9999, y: -9999, live: false };
    var MARGIN = 160;
    var rects = [];
    var loopRunning = false;
    var probeQueued = false;

    var inkFix = function (el) {
      if (el.getAttribute('data-ink-fix')) return;
      el.setAttribute('data-ink-fix', '1');
      var cs = getComputedStyle(el);
      var fs = parseFloat(cs.fontSize) || 28;
      el._fs = fs;
      var pb = Math.round(fs * 0.24), pt = Math.round(fs * 0.12);
      el.style.paddingBottom = ((parseFloat(cs.paddingBottom) || 0) + pb) + 'px';
      el.style.marginBottom = ((parseFloat(cs.marginBottom) || 0) - pb) + 'px';
      el.style.paddingTop = ((parseFloat(cs.paddingTop) || 0) + pt) + 'px';
      el.style.marginTop = ((parseFloat(cs.marginTop) || 0) - pt) + 'px';
    };
    inkNodes.forEach(inkFix);

    var refreshRects = function () {
      rects = inkNodes.map(function (el) { return el.isConnected ? el.getBoundingClientRect() : null; });
    };
    refreshRects();
    var rTimer = 0;
    var scheduleRefresh = function () {
      if (rTimer) return;
      rTimer = requestAnimationFrame(function () { rTimer = 0; refreshRects(); });
    };
    window.addEventListener('scroll', scheduleRefresh, { passive: true });
    window.addEventListener('resize', scheduleRefresh, { passive: true });

    var douse = function (el) {
      if (!el._lit) return;
      el._lit = 0;
      el.style.background = 'none';
      el.style.color = '';
      el.style.backgroundClip = '';
      el.style.webkitBackgroundClip = '';
      el.style.filter = '';
    };
    var douseAll = function () { inkNodes.forEach(douse); };

    var nearAny = function () {
      if (!ptr.live) return false;
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (!r) continue;
        if (ptr.x >= r.left - MARGIN && ptr.x <= r.right + MARGIN &&
            ptr.y >= r.top - MARGIN && ptr.y <= r.bottom + MARGIN) return true;
      }
      return false;
    };

    var t0 = performance.now();
    var tick = function () {
      if (document.hidden || !nearAny()) { douseAll(); loopRunning = false; return; }
      var t = (performance.now() - t0) / 1000;
      for (var i = 0; i < inkNodes.length; i++) {
        var el = inkNodes[i];
        var r = rects[i];
        if (!el.isConnected || !r) continue;
        if (el.hasAttribute('data-ink-wait')) { douse(el); continue; }
        var ph = i * 1.73;
        var rx = 104 + 38 * Math.sin(t * 0.9 + ph) + 18 * Math.sin(t * 2.3 + ph);
        var ry = Math.max((el._fs || 28) * 1.55, 58) * (0.82 + 0.26 * Math.sin(t * 1.31 + ph));
        var cx = ptr.x - r.left, cy = ptr.y - r.top;
        var dx = Math.max(r.left - ptr.x, 0, ptr.x - r.right);
        var dy = Math.max(r.top - ptr.y, 0, ptr.y - r.bottom);
        if ((dx / rx) * (dx / rx) + (dy / ry) * (dy / ry) > 1) { douse(el); continue; }
        var veil = 'radial-gradient(ellipse ' + rx.toFixed(0) + 'px ' + ry.toFixed(0) + 'px at ' +
          cx.toFixed(0) + 'px ' + cy.toFixed(0) + 'px,rgba(22,32,43,0) 0%,rgba(22,32,43,0) 58%,rgba(22,32,43,.45) 80%,#16202B 100%)';
        var sx = 260 + 100 * Math.sin(t * 0.53 + ph);
        var sy = 165 + 78 * Math.cos(t * 0.41 + ph);
        el.style.backgroundImage = veil + ',' + ART;
        el.style.backgroundSize = '100% 100%,' + sx.toFixed(0) + '% ' + sy.toFixed(0) + '%';
        el.style.backgroundPosition = '0 0,' +
          Math.max(0, Math.min(100, (cx / Math.max(1, r.width)) * 100)).toFixed(0) + '% ' +
          Math.max(0, Math.min(100, (cy / Math.max(1, r.height)) * 100)).toFixed(0) + '%';
        el.style.webkitBackgroundClip = 'text';
        el.style.backgroundClip = 'text';
        el.style.color = 'transparent';
        el.style.filter = 'saturate(1.25) contrast(1.05)';
        el._lit = 1;
      }
      requestAnimationFrame(tick);
    };
    var startLoop = function () {
      if (loopRunning) return;
      loopRunning = true;
      requestAnimationFrame(tick);
    };

    var probe = function () {
      probeQueued = false;
      if (nearAny()) startLoop();
    };
    window.addEventListener('pointermove', function (e) {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.live = true;
      if (!probeQueued) { probeQueued = true; requestAnimationFrame(probe); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { ptr.live = false; douseAll(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { ptr.live = false; douseAll(); }
    });
  }

  /* --- 2c. the headline has weather ------------------------------------------
   * Tela + venti: the hero title is set in Archivo, a variable font with a
   * real weight axis (400-800) and a real width axis (100-125%), and this
   * drives both, letter by letter (after design-memory's variable-font
   * items — hover-by-letter, font-and-cursor — without React/Motion):
   *  · arrival: every letter blows in wide and thin and settles into the
   *    heavy, upright setting, left to right, like a gust dying down;
   *  · then one gust crosses the line: a band of letters opens (lighter,
   *    wider) and closes again as it passes — phones get this too;
   *  · with a mouse, the letters near the pointer open the same way and
   *    close behind it, so the title parts around the cursor like grass.
   * Lines are measured once the font is in and each is locked (nowrap), so
   * a widening letter can push its line out a little but can never send a
   * word down to the next line. The accessible name stays the plain
   * sentence (aria-label); the letters are aria-hidden. */
  var windTitle = document.querySelector('.hero .h-hero');
  if (windTitle && !reduce && window.CSS && CSS.supports('font-variation-settings', '"wght" 700')) {
    var rawTitle = windTitle.textContent;
    windTitle.setAttribute('aria-label', rawTitle.replace(/\s+/g, ' ').trim());
    var wtBox = document.createElement('span');
    wtBox.className = 'wt';
    wtBox.setAttribute('aria-hidden', 'true');
    var wtChars = [], wtWords = [];
    rawTitle.split(/( +)/).forEach(function (tok) {   /* regular spaces only: a no-break space stays inside its word */
      if (!tok) return;
      if (/^ +$/.test(tok)) { wtWords.push(null); return; }
      var w = document.createElement('span');
      w.className = 'wt-w';
      Array.prototype.forEach.call(tok, function (ch) {
        var c = document.createElement('span');
        c.className = 'wt-c';
        c.textContent = ch;
        c.style.setProperty('--i', wtChars.length);
        wtChars.push(c);
        w.appendChild(c);
      });
      wtWords.push(w);
    });
    var layWords = function () {
      /* flat first, so the browser wraps them itself, then lock what it chose */
      wtBox.textContent = '';
      wtWords.forEach(function (w) { wtBox.appendChild(w || document.createTextNode(' ')); });
      var lines = [], lastTop = null;
      wtWords.forEach(function (w) {
        if (!w) return;
        var t = w.offsetTop;
        if (lastTop === null || Math.abs(t - lastTop) > 4) { lines.push([]); lastTop = t; }
        lines[lines.length - 1].push(w);
      });
      wtBox.textContent = '';
      lines.forEach(function (ws) {
        var ln = document.createElement('span');
        ln.className = 'wt-line';
        ws.forEach(function (w, k) { if (k) ln.appendChild(document.createTextNode(' ')); ln.appendChild(w); });
        wtBox.appendChild(ln);
      });
    };
    windTitle.textContent = '';
    windTitle.appendChild(wtBox);
    /* flat during the arrival: moving a letter to another parent restarts
       its CSS animation, so the lines are only locked once every letter has
       landed (below) — re-laying them when the web font arrived used to
       replay the arrival halfway through, the glitch on first load */
    wtWords.forEach(function (w) { wtBox.appendChild(w || document.createTextNode(' ')); });
    /* the pointer "ink" effect (§2) waits too: it clips an image into the
       glyphs, and transformed letters mid-arrival escape that clip */
    windTitle.setAttribute('data-ink-wait', '');
    var wtResize = 0;
    /* only once landed: a phone's toolbar collapsing fires resize, and
       re-parenting letters mid-arrival would replay it */
    window.addEventListener('resize', function () { clearTimeout(wtResize); wtResize = setTimeout(function () { if (!windTitle.classList.contains('wt-settled')) return; layWords(); wtMeasure(); }, 150); }, { passive: true });

    /* every letter's rest position, relative to the title — read once (and on
       resize), never per frame, so the field never chases its own output */
    var wtPos = [], wtFs = 60;
    var wtMeasure = function () {
      var b = windTitle.getBoundingClientRect();
      wtFs = parseFloat(getComputedStyle(windTitle).fontSize) || 60;
      wtPos = wtChars.map(function (c) { var r = c.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; });
    };
    var W_REST = 750, W_OPEN = 360, D_REST = 100, D_OPEN = 125;
    var wtCur = wtChars.map(function () { return 0; });   /* 0 = at rest, 1 = fully open */
    var wtPtr = { x: -1e5, y: -1e5, on: false };
    var gustT0 = 0, GUST_MS = 1700, wtRaf = 0, wtReady = false;
    /* Changing a letter's weight/width re-shapes it and re-lays-out its line,
       which is real work (tens of letters, every frame). So: values are
       quantised (a handful of distinct instances per letter, which the font
       cache then reuses instead of re-shaping a new one each frame), a letter
       is only written when its value actually changed, and if the page cannot
       keep up while the effect runs (slow frames, 10 in a row) the effect is
       dropped for good and the letters return to rest: a title that stays
       still is better than one that stutters. The lite tier never runs it. */
    var wtW = wtChars.map(function () { return W_REST; }), wtD = wtChars.map(function () { return D_REST; });
    var wtOff = lite, wtSlow = 0, wtLastNow = 0;
    var wtStop = function () {
      wtOff = true; gustT0 = 0; wtPtr.on = false;
      for (var i = 0; i < wtChars.length; i++) { wtChars[i].style.removeProperty('--wg'); wtChars[i].style.removeProperty('--wd'); wtW[i] = W_REST; wtD[i] = D_REST; }
    };
    var wtFrame = function (now) {
      wtRaf = 0;
      if (wtOff) return;
      if (wtLastNow && now - wtLastNow < 120) {
        /* only judge frames that follow each other (not the gap after idling) */
        if (now - wtLastNow > 28) { if (++wtSlow >= 10) { wtStop(); return; } } else if (wtSlow > 0) wtSlow--;
      }
      wtLastNow = now;
      var b = windTitle.getBoundingClientRect();
      var px = wtPtr.x - b.left, py = wtPtr.y - b.top, R = wtFs * 1.35;
      var gx = -1;
      if (gustT0) {
        var g = (now - gustT0) / GUST_MS;
        if (g >= 1) gustT0 = 0; else gx = -0.15 + g * 1.3;     /* the gust's centre, in title widths */
      }
      var moving = false, bw = b.width || 1;
      for (var i = 0; i < wtChars.length; i++) {
        var p = wtPos[i]; if (!p) continue;
        var target = 0;
        if (wtPtr.on) {
          var dx = p.x - px, dy = (p.y - py) * 1.5, d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) { var f = 1 - d / R; target = f * f * (3 - 2 * f); }
        }
        if (gx > -1) {
          var gd = (p.x / bw) - gx;
          target = Math.max(target, 0.8 * Math.exp(-(gd * gd) / 0.012));
        }
        var c = wtCur[i] + (target - wtCur[i]) * 0.16;
        if (Math.abs(c - wtCur[i]) > 0.001 || Math.abs(target - c) > 0.002) moving = true;
        wtCur[i] = c;
        var nw = Math.round((W_REST + (W_OPEN - W_REST) * c) / 18) * 18, nd = Math.round((D_REST + (D_OPEN - D_REST) * c) / 2.5) * 2.5;
        if (nw !== wtW[i]) { wtW[i] = nw; wtChars[i].style.setProperty('--wg', nw); }
        if (nd !== wtD[i]) { wtD[i] = nd; wtChars[i].style.setProperty('--wd', nd); }
      }
      if (moving || gustT0 || wtPtr.on) wtRaf = requestAnimationFrame(wtFrame); else wtLastNow = 0;
    };
    var wtKick = function () { if (wtReady && !wtOff && !wtRaf) wtRaf = requestAnimationFrame(wtFrame); };
    /* The title never waits for the network. Three cases, decided once, at
       the moment this script runs (which, on a slow connection, can be
       seconds after the page was first drawn):
       · Archivo is already in (cache, or the preload won), and the CSS
         fail-safe has not shown the title yet: the whole arrival plays —
         letters blow in wide and thin and settle. Archivo itself is
         preloaded in the head, so on a good connection this is the case.
       · Archivo is not in yet, but the title is still held by the CSS: wait
         for it at most 450 ms, then show the title as it is.
       · The CSS fail-safe (0.6 s) has already shown the title in the
         size-matched fallback face: leave it exactly where it is, never
         hide and replay it (that blank-then-again was the glitch on a slow
         first visit), and when Archivo arrives re-lock the lines on the
         real face and let the gust cross.
       The face swap itself moves nothing: the fallback is scaled to
       Archivo's measured widths (telaventis.css). */
    var arrive = (wtChars.length * 14 + 60 + 1000), wtStarted = false;
    var startArrival = function () {
      if (wtStarted) return;
      wtStarted = true; wtMode = 'arrival';
      /* lock the lines NOW, one frame before any letter starts moving —
         layWords() measures the browser's own wrap at whatever width the
         letters currently render at, which right up to this point is
         still --wg/--wd's plain @property default (750/100, the same
         settled values the animation ends on), so this locks in exactly
         the final grouping. Skipping this used to leave the words flat
         (unwrapped) through the whole arrival: wt-arrive's `from` opens
         each letter to --wd:125 (a quarter wider) before narrowing back
         to 100, so early in the arrival the same sentence measured wider
         and wrapped onto more, shorter lines than its resting shape —
         visibly reflowing, a word or two at a time, as it settled. Locked
         from the first frame instead, a widening letter can still push
         its own line a little wide (nowrap lets it overflow rather than
         wrap), but never moves a word to another line. windTitle stays
         opacity:0 until the next line adds wt-host, so this reparenting
         itself is never seen. The later call in settleTitle() re-measures
         the same, now-real, settled width — ordinarily an unchanged
         grouping, just re-locked in case a webfont swap or a mid-arrival
         resize (both currently skipped for layWords by wt-settled's own
         guard) shifted anything. */
      layWords();
      windTitle.classList.add('wt-host');
      setTimeout(settleTitle, arrive);
    };
    var settleTitle = function () {
      windTitle.classList.add('wt-settled');
      windTitle.removeAttribute('data-ink-wait');
      layWords();
      wtMeasure();
      wtReady = true;
      gustT0 = performance.now();
      wtKick();
    };
    var wtMode = '', plainTimer = 0;
    var plainStart = function () {
      if (wtStarted) return;
      wtStarted = true; wtMode = 'plain';
      layWords();
      windTitle.classList.add('wt-host', 'wt-settled');   /* settled = no arrival animation: it simply shows */
    };
    var onFont = function () {
      if (!wtStarted) { clearTimeout(plainTimer); startArrival(); }
      else if (wtMode === 'plain') settleTitle();
    };
    var fonts = document.fonts;
    var fontIn = (fonts && fonts.load) ? fonts.load('750 64px Archivo', rawTitle) : Promise.resolve();
    var fontNow = true;
    try { fontNow = !fonts || !fonts.check || fonts.check('750 64px Archivo', rawTitle); } catch (e) {}
    var shownAlready = parseFloat(getComputedStyle(windTitle).opacity) > 0.5;
    if (shownAlready) plainStart();
    else if (fontNow) startArrival();
    else plainTimer = setTimeout(plainStart, 450);
    fontIn.then(onFont, onFont);
    if (pointerFine && !lite) {
      var heroEl = document.querySelector('.hero');
      heroEl.addEventListener('pointermove', function (e) { wtPtr.x = e.clientX; wtPtr.y = e.clientY; wtPtr.on = true; wtKick(); }, { passive: true });
      heroEl.addEventListener('pointerleave', function () { wtPtr.on = false; wtKick(); });
    }
  }

  /* --- 3. hero band: the cut ------------------------------------------------
   * Scroll steepens the cut and slips the lower (sky) half along it; the
   * pointer, on desktop, drifts the sky inside the letters. Everything is
   * written as custom properties on the band (--cut-l, --cut-r, --slip,
   * --sky-x, --sky-y), so
   * the CSS keeps sole ownership of how the band looks — and with no script,
   * the static values in telaventis.css are already a finished band. */
  var band = document.querySelector('[data-band]');
  if (band && !reduce) {
    var sky = { x: 50, y: 42, tx: 50, ty: 42 };
    var tiltBand = function () {
      var r = band.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      /* t: 0 while the band rests on the fold, → 1 as it leaves the top */
      var t = Math.max(0, Math.min(1, (vh - r.bottom) / vh));
      var l = 72 + 9 * t, rt = 16 - 9 * t;
      band.style.setProperty('--cut-l', l.toFixed(2) + '%');
      band.style.setProperty('--cut-r', rt.toFixed(2) + '%');
      band.style.setProperty('--slip', (t * r.width * 0.022).toFixed(1) + 'px');
    };
    var raf = 0;
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; tiltBand(); });
    }, { passive: true });
    window.addEventListener('resize', tiltBand, { passive: true });
    tiltBand();

    if (pointerFine) {
      var skyRaf = 0;
      var stepSky = function () {
        sky.x += (sky.tx - sky.x) * 0.08;
        sky.y += (sky.ty - sky.y) * 0.08;
        band.style.setProperty('--sky-x', sky.x.toFixed(2) + '%');
        band.style.setProperty('--sky-y', sky.y.toFixed(2) + '%');
        skyRaf = (Math.abs(sky.tx - sky.x) + Math.abs(sky.ty - sky.y) > 0.05) ? requestAnimationFrame(stepSky) : 0;
      };
      document.querySelector('.hero').addEventListener('pointermove', function (e) {
        sky.tx = 50 - ((e.clientX / window.innerWidth) - 0.5) * 22;
        sky.ty = 42 - ((e.clientY / window.innerHeight) - 0.5) * 30;
        if (!skyRaf) skyRaf = requestAnimationFrame(stepSky);
      }, { passive: true });
    }
  }

  /* --- 5. live proof: this page's own numbers ----------------------------------
   * Fills the [data-proof] strip under "Ce que ça change concrètement" with
   * values read from the visitor's own browser, once the page has loaded:
   * first contentful paint, bytes of HTML+CSS+JS actually received (the
   * encoded, i.e. compressed, sizes the Resource Timing API reports),
   * requests to any other origin, and cookies set. Nothing is typed in:
   * if the APIs are missing, the strip simply stays hidden. */
  var proof = document.querySelector('[data-proof]');
  if (proof && window.performance && performance.getEntriesByType) {
    var lang = (document.documentElement.lang || 'fr').slice(0, 2);
    var dec = lang === 'en' ? '.' : ',';
    var kb = lang === 'fr' ? 'Ko' : 'KB';
    var fillProof = function () {
      var nav = performance.getEntriesByType('navigation')[0];
      var res = performance.getEntriesByType('resource');
      var paint = performance.getEntriesByName && performance.getEntriesByName('first-contentful-paint')[0];
      if (!nav) return;
      /* "code" = this document plus the stylesheets and scripts it declares
         itself — not optional modules a script may pull in later (the
         WebGPU jellyfish, which production never loads anyway) */
      var own = {};
      Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"][href],script[src]'), function (el) {
        try { own[new URL(el.getAttribute('href') || el.getAttribute('src'), location.href).href] = 1; } catch (e) {}
      });
      var code = nav.encodedBodySize || nav.transferSize || 0, third = 0;
      res.forEach(function (r) {
        var u;
        try { u = new URL(r.name, location.href); } catch (e) { return; }
        if (u.origin !== location.origin) third++;
        else if (own[u.href]) code += r.encodedBodySize || r.transferSize || 0;
      });
      var ms = paint ? paint.startTime : nav.domContentLoadedEventEnd;
      var set = function (k, v) { var el = proof.querySelector('[data-proof-v="' + k + '"]'); if (el) el.innerHTML = v; };
      set('fcp', (ms / 1000).toFixed(2).replace('.', dec) + '<small>s</small>');
      set('code', String(Math.max(1, Math.round(code / 1024))) + '<small>' + kb + '</small>');
      set('third', String(third));
      set('cookies', String(document.cookie ? document.cookie.split(';').length : 0));
      proof.hidden = false;
    };
    if (document.readyState === 'complete') setTimeout(fillProof, 0);
    else window.addEventListener('load', function () { setTimeout(fillProof, 0); });
  }

  /* --- 6. showcase: one scene per project ------------------------------------
   * The section pins (CSS, gated on [data-showcase-live], set here), scroll
   * position picks the scene, and each change plays the "Animated
   * Continuous Sections" hand-over (GreenSock codepen XWzRraJ, after
   * BrianCross PoWapLP) with the Web Animations API instead of GSAP: the
   * incoming scene's outer mask travels in from the scroll direction while
   * its inner layer travels the opposite way (so the scene is uncovered in
   * place, not pushed), both backdrops drift 15% against the motion, and
   * the name rises letter by letter out of its mask (fx-split's manual
   * mode, telaventis-fx.js §1). Scroll only ever TRIGGERS a change — the
   * wipe runs on its own clock — and one gesture plays one scene, never
   * two (the hold, below).
   * Hidden scenes are `inert`: nothing in them can be focused or read. */
  var show = document.querySelector('[data-showcase]');
  if (show && !reduce && 'animate' in Element.prototype) {
    var scenes = Array.prototype.slice.call(show.querySelectorAll('[data-scene]'));
    var track = show.querySelector('.showcase__track');
    var sticky = show.querySelector('.showcase__sticky');
    var rail = show.querySelector('.showcase__rail');
    var railItems = Array.prototype.slice.call(show.querySelectorAll('.showcase__rail li'));
    var railLinks = Array.prototype.slice.call(show.querySelectorAll('.showcase__rail a'));
    var N = scenes.length;
    var cur = -1, WIPE = 1150, EASE = 'cubic-bezier(.65,0,.35,1)';
    show.style.setProperty('--scenes', N);
    show.setAttribute('data-showcase-live', '');
    scenes.forEach(function (sc) { sc.setAttribute('inert', ''); });

    var nameOf = function (sc) { return sc.querySelector('.scene__name'); };
    /* each scene's screens are recordings of the live site; only the current
       scene's play, only while the showcase is on screen and the tab is
       visible, and the next scene's are asked to buffer ahead of time */
    var vidsOf = function (sc) { return sc ? Array.prototype.slice.call(sc.querySelectorAll('video')) : []; };
    /* iOS Safari (and any browser under a strict autoplay policy — Low
       Power Mode, or Settings > Safari > Auto-Play set to "Never Auto-
       Play") can flatly refuse a play() that isn't tied to a genuine user
       gesture: the promise just rejects, syncVideos()'s own catch already
       swallows that silently, and the scene is left sitting on its
       poster with nothing to say why. Once a video HAS played inside a
       real gesture, WebKit's own "media needs a user action" gate opens
       for the rest of the document — not just that one element — so this
       primes it with exactly one: the very first touchstart / pointerdown
       / keydown anywhere on the page tries play() on the first scene's
       own video, then pauses it straight back before a frame could be
       seen moving. One-shot, and it never runs at all once one of these
       has already fired. Doesn't touch scenes never scrolled to, so nothing
       here forces a video open that autoplay would already have covered. */
    var unlockVideos = function () {
      var v = lite ? null : vidsOf(scenes[0])[0];
      if (!v) return;
      var pr = v.play();
      if (pr && pr.then) pr.then(function () { v.pause(); }).catch(function () {});
      else if (!v.paused) v.pause();
    };
    ['touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, unlockVideos, { capture: true, passive: true, once: true });
    });
    var showOn = false;
    /* The scenes' posters, in order of need. Not at page load (they are four
       sections down and were taking the headline's bandwidth), and not all
       at once: a scene's own and the next two are fetched as the visitor
       approaches, and — on the full version only — the rest trickle in once
       the page has finished loading and the browser has nothing else to do.
       The lite version never fetches ahead. */
    var warmed = 0;
    var warmPosters = function (upTo) {
      for (var k = warmed; k <= Math.min(upTo, N - 1); k++) vidsOf(scenes[k]).forEach(loadPoster);
      warmed = Math.max(warmed, Math.min(upTo, N - 1) + 1);
    };
    var syncVideos = function () {
      /* lite: the posters stand for the recordings — no 0.4–1.9 MB video per
         scene on a connection that cannot afford it */
      scenes.forEach(function (sc, i) {
        vidsOf(sc).forEach(function (v) {
          if (lite) return;
          if (i === cur && showOn && !document.hidden) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else if (!v.paused) v.pause();
          /* buffer the next scene only once the showcase is really on screen:
             at page load `cur` is already 0, and this used to start the
             second project's 1.2 MB of video on the first second of the visit */
          if (showOn && i === cur + 1 && v.preload === 'none') v.preload = 'auto';
        });
      });
      if (showOn) warmPosters(cur + 2);
    };
    if (!lite) {
      var whenIdle = function (fn, ms) {
        setTimeout(function () { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 4000 }); else fn(); }, ms);
      };
      var idleWarm = function () {
        if (warmed >= N) return;
        warmPosters(warmed);
        whenIdle(idleWarm, 700);
      };
      var afterLoad = function () { whenIdle(idleWarm, 2500); };
      if (document.readyState === 'complete') afterLoad(); else window.addEventListener('load', afterLoad);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { showOn = es[0].isIntersecting; syncVideos(); syncTimer(); }, { threshold: 0.15 }).observe(sticky);
    } else { showOn = true; }
    document.addEventListener('visibilitychange', function () { syncVideos(); syncTimer(); });
    var paintRail = function () {
      railItems.forEach(function (li, i) { li.classList.toggle('is-on', i === cur); li.classList.toggle('is-past', i < cur); });
      railLinks.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      if (scenes[cur]) sticky.style.setProperty('--rail-fg', getComputedStyle(scenes[cur]).getPropertyValue('--fg'));
    };
    var riseName = function (sc, dir, delay) {
      var nm = nameOf(sc);
      if (!nm) return;
      nm.style.setProperty('--fx-dir', String(dir));
      nm.classList.remove('is-in', 'fx-done');
      void nm.offsetWidth;
      setTimeout(function () { nm.classList.add('is-in'); }, delay);
    };
    var go = function (j, dir, instant) {
      var i = cur;
      if (j === i) return;
      cur = j;
      var B = scenes[j], A = i >= 0 ? scenes[i] : null;
      B.classList.add('is-current');
      B.classList.remove('is-leaving');
      B.removeAttribute('inert');
      paintRail();
      syncVideos();
      if (instant) { riseName(B, 1, 80); if (A) { A.classList.remove('is-current'); A.setAttribute('inert', ''); } return; }
      var opts = { duration: WIPE, easing: EASE };
      B.querySelector('.scene__outer').animate([{ transform: 'translateY(' + (100 * dir) + '%)' }, { transform: 'translateY(0)' }], opts);
      B.querySelector('.scene__inner').animate([{ transform: 'translateY(' + (-100 * dir) + '%)' }, { transform: 'translateY(0)' }], opts);
      B.querySelector('.scene__bg').animate([{ transform: 'translateY(' + (15 * dir) + '%)' }, { transform: 'translateY(0)' }], opts);
      riseName(B, dir, WIPE * 0.2);
      if (A) {
        A.classList.remove('is-current');
        A.classList.add('is-leaving');
        A.setAttribute('inert', '');
        var out = A.querySelector('.scene__bg').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(' + (-15 * dir) + '%)' }], { duration: WIPE, easing: EASE, fill: 'forwards' });
        out.onfinish = function () {
          out.cancel();
          if (scenes[cur] !== A) { A.classList.remove('is-leaving'); var nm = nameOf(A); if (nm) nm.classList.remove('is-in'); }
        };
      }
    };

    /* one gesture, one scene. A wheel, a trackpad or a finger all carry on
       by themselves (momentum / inertia) over two or three screens, so a
       plain threshold every screen played scenes the visitor had not asked
       for — "a scroll a bit long and it goes down two projects" — often
       after the gesture had ended, and a strong one left the section before
       they had played. Here, as for the Moka door (telaventis-fx.js §3d, "no
       speedrun"): each scene has a resting point in the middle of its own
       stretch of scroll (telaventis.css: SEG per scene), half a stretch
       either way from the next one — a deliberate gesture, never a nudge.
       Crossing into another scene's stretch plays exactly one hand-over,
       brings the scroll back to that scene's resting point and holds it
       until the wipe has finished AND the gesture has stopped (no wheel or
       touch for QUIET ms — the tail of a trackpad's inertia is still the
       same gesture, not a new one); the section arriving on screen does the
       same on its first or last scene, so a scroll from above or below
       lands on it instead of flying through. Never during a jump (an
       in-page link, Home/End); the hold always ends by HOLD_MAX. */
    var HOLD_ARRIVE = 500, QUIET = 180, HOLD_MAX = 3000;
    var root = document.documentElement;
    var scTick = 0, heldY = null, heldUntil = 0, heldSince = 0, heldTimer = 0, lastInput = 0, inside = false, jumpUntil = 0;
    /* Releasing flips .showcase__sticky back from position:fixed to its
       normal sticky (sc-held's own CSS) — a real repositioning of the very
       element the current scene's <video> lives inside, and iOS Safari has
       been known to pause a video outright across exactly that kind of
       layout change, not just visually hiccup it (reported: a video that
       played fine on the FIRST pass through the showcase going silent on a
       later one — re-entering after having scrolled past once is exactly
       the path that re-triggers a hold, see the `!inside` branch below,
       where the very first pass does not). Calling syncVideos() again
       right as the hold lifts is the cheap, unconditional fix regardless
       of whether THIS particular hold actually tripped it: play() on a
       video already playing is a harmless no-op, so this costs nothing on
       the times nothing needed fixing and quietly resumes the times it did. */
    /* The wheel / touch listeners that can cancel a scroll must be
       { passive:false }, and a non-passive listener on the window makes the
       browser wait for this script before it scrolls ANYTHING — at every
       notch, on every part of the page, for the whole visit (it was how a
       busy main thread froze scrolling far from the showcase). So the
       blocking pair is attached only while a hold is actually running, and
       removed with it; a passive pair, free, keeps lastInput honest the rest
       of the time. */
    var blocking = false;
    var block = function (e) { lastInput = performance.now(); if (e.cancelable) e.preventDefault(); };
    var setBlock = function (on) {
      if (on === blocking) return;
      blocking = on;
      var m = on ? 'addEventListener' : 'removeEventListener';
      window[m]('wheel', block, { passive: false });
      window[m]('touchmove', block, { passive: false });
    };
    var release = function () {
      heldY = null; clearTimeout(heldTimer); setBlock(false); root.classList.remove('sc-held'); syncVideos();
      syncTimer();
      /* a hold that ended on a visitor's gesture: the timer waits for stillness */
      if (!show.classList.contains('is-timing')) { clearTimeout(quietT); quietT = setTimeout(syncTimer, 760); }
    };
    /* released once the wipe is done and the gesture has been quiet for
       QUIET ms, re-checked until then */
    var tryRelease = function () {
      var now = performance.now();
      if (heldY === null) return;
      if (now - heldSince >= HOLD_MAX || (now >= heldUntil && now - lastInput >= QUIET)) { release(); return; }
      heldTimer = setTimeout(tryRelease, Math.max(40, Math.max(heldUntil, lastInput + QUIET) - now));
    };
    var hold = function (y, ms) {
      heldY = Math.round(y);
      heldSince = performance.now();
      heldUntil = heldSince + ms;
      window.scrollTo({ top: heldY, behavior: 'instant' });
      root.classList.add('sc-held');
      setBlock(true);
      clearTimeout(heldTimer);
      heldTimer = setTimeout(tryRelease, ms);
      syncTimer();
    };
    var gesture = function () { lastInput = performance.now(); userMoved(); };
    window.addEventListener('wheel', gesture, { passive: true });
    window.addEventListener('touchmove', gesture, { passive: true });
    var SCROLL_KEYS = { ' ': 1, Spacebar: 1, PageDown: 1, PageUp: 1, ArrowDown: 1, ArrowUp: 1 };
    window.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === 'Home' || e.key === 'End') { jumpUntil = performance.now() + 2500; release(); return; }
      if (SCROLL_KEYS[e.key] || e.key === 'Escape') { lastInput = performance.now(); userMoved(); if (heldY !== null && e.key !== 'Escape') e.preventDefault(); }
    });
    /* a jump through an in-page link passes through the section on its
       way: it is travel, not reading, so the hold stays off for the trip */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (a && a.pathname === location.pathname && a.hash) jumpUntil = performance.now() + 2500;
    });
    window.addEventListener('hashchange', function () { jumpUntil = performance.now() + 2500; });
    document.addEventListener('visibilitychange', function () { if (document.hidden) release(); });
    /* the first scene's video only starts actually fetching once play() is
       first called on it (preload="none" otherwise) — reported: a beat of
       "having trouble loading" on arrival, on a slower connection. Giving
       it a head start: once the track is within 1.5 screens of view, ask
       it to preload — same margin telaventis-fx.js's loadGpu() uses for
       the same reason (its own physics bake) — well before `go()` would
       otherwise be the first thing to ask for it. One-shot, and it costs
       nothing extra: normal browsing was always going to fetch this video
       moments later regardless, just not until the section arrived. */
    var primed0 = false;
    var follow = function () {
      scTick = 0;
      if (!primed0 && track.getBoundingClientRect().top < (window.innerHeight || 800) * 1.5) {
        primed0 = true;
        warmPosters(1);
        if (!lite) vidsOf(scenes[0]).forEach(function (v) { if (v.preload === 'none') v.preload = 'auto'; });
      }
      if (heldY !== null) {
        if (Math.abs(window.scrollY - heldY) > 1) window.scrollTo({ top: heldY, behavior: 'instant' });
        return;
      }
      var r = track.getBoundingClientRect();
      var seg = Math.max(1, track.offsetHeight - (window.innerHeight || 800)) / N;
      var t = -r.top, top = window.scrollY + r.top;
      var rest = function (k) { return top + (k + 0.5) * seg; };
      /* outside the pinned stretch: the scene seen on the way in is the
         first one from above, the last one from below */
      if (t < 0 || t > seg * N) {
        inside = false;
        var edge = t < 0 ? 0 : N - 1;
        if (cur !== edge) go(edge, 1, true);
        return;
      }
      var want = Math.min(N - 1, Math.floor(t / seg));
      if (cur < 0 || performance.now() < jumpUntil) { inside = true; if (want !== cur) go(want, 1, true); return; }
      if (!inside) { inside = true; hold(rest(cur), HOLD_ARRIVE); return; }
      if (want === cur) return;
      var d = want > cur ? 1 : -1;
      go(cur + d, d, false);
      hold(rest(cur), WIPE);
    };
    /* ---- the project bar -------------------------------------------------
       Five links at the top of the pinned screen (telaventis.css: .showcase__rail,
       generated by _outils/projets.py), and the current one is a timer: while
       the section is really being looked at, its bar fills over --dwell (7 s,
       a CSS animation: the stylesheet is the clock) and when it is full the
       showcase moves on to the next project, the way a click on that project
       would. Clicking a name goes straight to that project.
       The timer runs only while the section is pinned on screen, the tab is
       visible, no hand-over is in progress and the visitor has been still for
       a moment (.is-timing); it waits while the pointer rests on the copy or
       keyboard focus is in it (.is-reading: someone is reading). The moment
       the visitor scrolls (wheel, touch, a scrolling key, the scrollbar) or
       presses Escape it is over for this visit - the bars just show where you
       are - exactly as for the jellyfish section's autoplay: whoever scrolls
       knows how. Arriving by scrolling does not count (the stillness it waits
       for), and clicking the bar does not stop it. It does not loop: on the
       last project the bar fills and stays full. Reduced motion never gets
       here (this whole block is skipped under it). */
    var timerOn = true, timedY = 0, quietT = 0, hoverCopy = false, focusCopy = false;
    show.setAttribute('data-timer', '');
    var syncTimer = function () {
      var on = timerOn && inside && heldY === null && !document.hidden && showOn && performance.now() - lastInput >= 700;
      if (on !== show.classList.contains('is-timing')) { show.classList.toggle('is-timing', on); if (on) timedY = window.scrollY; }
    };
    var stopTimer = function () {
      timerOn = false; clearTimeout(quietT);
      show.removeAttribute('data-timer'); show.classList.remove('is-timing', 'is-reading');
    };
    var userMoved = function () {
      if (!timerOn) return;
      if (show.classList.contains('is-timing')) stopTimer();
      else { clearTimeout(quietT); quietT = setTimeout(syncTimer, 760); }
    };
    var restOf = function (k) {
      var seg = Math.max(1, track.offsetHeight - (window.innerHeight || 800)) / N;
      return window.scrollY + track.getBoundingClientRect().top + (k + 0.5) * seg;
    };
    /* to any project, not only the next: the hand-over plays once, the scroll
       is brought to that project's resting point and held until it is over */
    var goTo = function (j) {
      if (j === cur || j < 0 || j >= N || heldY !== null) return;
      go(j, j > cur ? 1 : -1, false);
      hold(restOf(j), WIPE);
    };
    /* the bar is the minimum time, not the whole of it: the recording on screen
       is allowed to finish the loop it is in before the next project takes over
       (the posters of the lite tier have no loop to wait for) */
    var advanceAfterLoop = function (from) {
      var v = !lite && scenes[from] && scenes[from].querySelector('.scene__desk video');
      var left = (v && !v.paused && isFinite(v.duration) && v.duration > 0) ? (v.duration - v.currentTime) * 1000 : 0;
      setTimeout(function () {
        if (cur !== from || !timerOn) return;
        if (!show.classList.contains('is-timing') || show.classList.contains('is-reading')) { advanceAfterLoop(from); return; }
        goTo(from + 1);
      }, Math.min(Math.max(left, 0) + 80, 30000));
    };
    if (rail) {
      rail.addEventListener('animationend', function (e) {
        if (e.animationName === 'rail-fill' && timerOn && show.classList.contains('is-timing') && cur < N - 1) advanceAfterLoop(cur);
      });
      rail.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();   /* not an in-page jump (the document-level handler would call it one) */
        lastInput = performance.now();
        goTo(railLinks.indexOf(a));
      });
    }
    var setReading = function () { show.classList.toggle('is-reading', hoverCopy || focusCopy); };
    sticky.addEventListener('pointerover', function (e) { hoverCopy = !!(e.target.closest && e.target.closest('.scene__copy')); setReading(); });
    sticky.addEventListener('pointerleave', function () { hoverCopy = false; setReading(); });
    sticky.addEventListener('focusin', function (e) { focusCopy = !!(e.target.closest && e.target.closest('.scene__copy')); setReading(); });
    sticky.addEventListener('focusout', function () { focusCopy = false; setReading(); });
    var followCore = follow;
    follow = function () {
      /* while the timer runs the page is still: a scroll that is not ours (the scrollbar, anything) is the visitor's */
      if (show.classList.contains('is-timing') && heldY === null && Math.abs(window.scrollY - timedY) > 2) stopTimer();
      followCore();
      syncTimer();
    };
    window.addEventListener('scroll', function () { if (!scTick) scTick = requestAnimationFrame(follow); }, { passive: true });
    window.addEventListener('resize', function () { if (!scTick) scTick = requestAnimationFrame(follow); }, { passive: true });
    follow();

    /* the pointer tilts the current scene's screens a few degrees toward
       it — the same object seen from where you stand */
    if (pointerFine) {
      var tilt = { x: 0, y: 0, tx: 0, ty: 0 }, tiltRaf = 0;
      var stepTilt = function () {
        tilt.x += (tilt.tx - tilt.x) * 0.08; tilt.y += (tilt.ty - tilt.y) * 0.08;
        var shots = scenes[cur] && scenes[cur].querySelector('.scene__shots');
        if (shots) { shots.style.setProperty('--ry', tilt.x.toFixed(2) + 'deg'); shots.style.setProperty('--rx', tilt.y.toFixed(2) + 'deg'); }
        tiltRaf = (Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.02) ? requestAnimationFrame(stepTilt) : 0;
      };
      sticky.addEventListener('pointermove', function (e) {
        tilt.tx = ((e.clientX / window.innerWidth) - 0.5) * -9;
        tilt.ty = ((e.clientY / window.innerHeight) - 0.5) * 6;
        if (!tiltRaf) tiltRaf = requestAnimationFrame(stepTilt);
      }, { passive: true });
      sticky.addEventListener('pointerleave', function () { tilt.tx = 0; tilt.ty = 0; if (!tiltRaf) tiltRaf = requestAnimationFrame(stepTilt); });
    }
  }

  /* --- 7. work page: constellations ------------------------------------------
   * The big screen of each project is a recording of its live home page; it
   * plays while at least a third of it is on screen and rests otherwise (never
   * with reduced motion — the poster, its first frame, stays). The index bar
   * marks the project currently in view with a stroke of that client's colour,
   * and keeps it scrolled into sight when the bar overflows (phones). */
  var work = document.querySelector('[data-work]');
  if (work && 'IntersectionObserver' in window) {
    /* posters: the first project's at once, every other as it comes within
       a screen and a half (they were all fetched at page load) */
    var wvids = Array.prototype.slice.call(work.querySelectorAll('.cst__video'));
    var pio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { loadPoster(e.target); pio.unobserve(e.target); } });
    }, { rootMargin: '150% 0px' });
    wvids.forEach(function (v) { pio.observe(v); });
    if (!reduce && !lite) {
      var cvio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting && !document.hidden) { v.preload = 'auto'; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else if (!v.paused) v.pause();
        });
      }, { threshold: 0.33 });
      wvids.forEach(function (v) { cvio.observe(v); });
    }
    var bar = document.querySelector('[data-work-bar]');
    if (bar) {
      var items = {};
      Array.prototype.forEach.call(bar.querySelectorAll('.work-bar__item'), function (a) { items[a.getAttribute('href').slice(1)] = a; });
      var spy = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          Object.keys(items).forEach(function (k) { items[k].classList.toggle('is-on', k === e.target.id); });
          var it = items[e.target.id], inner = bar.firstElementChild;
          if (it && inner && inner.scrollWidth > inner.clientWidth) inner.scrollTo({ left: it.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Array.prototype.forEach.call(work.querySelectorAll('.cst'), function (s) { spy.observe(s); });
    }
  }

  /* --- 4. contact form ----------------------------------------------------- */
  var form = document.querySelector('[data-contact]');
  if (!form) return;

  var note = form.querySelector('[data-formnote]');
  var submitBtn = form.querySelector('[data-contact-submit]');

  var MSG = {
    sending:  form.dataset.msgSending  || 'Envoi en cours…',
    success:  form.dataset.msgSuccess  || 'Message envoyé — vous recevrez une réponse écrite sous un jour ouvré.',
    error:    form.dataset.msgError    || 'L’envoi a échoué. Réessayez, ou écrivez directement à hello@telaventis.fr.',
    submitIdle:    form.dataset.msgSubmitIdle    || 'Envoyer',
    submitSending: form.dataset.msgSubmitSending || 'Envoi en cours…',
    submitDone:    form.dataset.msgSubmitDone    || 'Envoyé ✓'
  };

  /* note is a permanent, empty, aria-live region in the markup — we only
     ever change its text, never its presence, so assistive tech reliably
     announces each update. */
  var setNote = function (text, isError) {
    if (!note) return;
    note.textContent = text;
    note.style.color = isError ? 'var(--coral-ink)' : '';
  };

  if (new URLSearchParams(window.location.search).get('sent') === '1') {
    setNote(MSG.success, false);
  }

  if (!window.fetch) return; // no fetch: native action/method still work, native validation still applies

  form.addEventListener('submit', function (e) {
    if (!form.reportValidity()) return; // form has no novalidate, so this only matters for older browsers
    e.preventDefault();

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = MSG.submitSending; }
    setNote(MSG.sending, false);

    fetch(form.action, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form)
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data && result.data.success) {
          setNote(MSG.success, false);
          if (submitBtn) { submitBtn.textContent = MSG.submitDone; }
          form.reset();
        } else {
          throw new Error((result.data && result.data.message) || 'Web3Forms error');
        }
      })
      .catch(function () {
        setNote(MSG.error, true);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = MSG.submitIdle; }
      });
  });
})();
