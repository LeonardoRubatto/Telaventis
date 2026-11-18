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
 *  7   work page AND the home showcase (same blocks): recordings play in
 *      view, the bar follows the scroll and marks the project in view
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

  /* --- data saver ------------------------------------------------------------
   * There is one version of the site. (There used to be a "light" one chosen by
   * guessing the connection; with the jellyfish gone — the WebGL gradient is
   * 60 fps on an integrated GPU — nothing was left for it to lighten except the
   * recordings, and a guess that is sometimes wrong, on a good wifi, costs more
   * than it saves.) The one thing kept is the visitor's own, explicit ask: when
   * the browser says saveData (or the network is a 2g), the scenes show their
   * posters instead of playing 0.4-1.9 MB recordings. Loading order is what
   * protects a slow line: the headline's font and sky first, everything else
   * after (see the preloads, the fetch priorities, WARM_AT in telaventis-fx.js). */
  var lite = (function () {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData || /^(slow-2g|2g)$/.test(c.effectiveType || '')));
  }());
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
    var headroom = function () {
      hrRaf = 0;
      var y = window.scrollY, dy = y - lastY;
      if (Math.abs(dy) < 6) return;
      var menuOpen = navToggle && navToggle.hasAttribute('open');
      navBar.classList.toggle('nav--hidden', dy > 0 && y > 140 && !menuOpen && !navBar.contains(document.activeElement));
      lastY = y;
    };
    window.addEventListener('scroll', function () { if (!hrRaf) hrRaf = requestAnimationFrame(headroom); }, { passive: true });
    navBar.addEventListener('focusin', function () { navBar.classList.remove('nav--hidden'); });
  }

  /* --- 0c. the hero's scroll cue leaves with the first scroll (CSS: html.is-scrolled) --- */
  (function () {
    var on = false;
    var check = function () {
      var now = window.scrollY > 40;
      if (now !== on) { on = now; html.classList.toggle('is-scrolled', on); }
    };
    window.addEventListener('scroll', check, { passive: true });
    check();
  }());

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
    var rawTitle = Array.prototype.map.call(windTitle.childNodes, function (n) { return n.nodeName === 'BR' ? '\n' : n.textContent; }).join('');   /* a <br> is a hard break, kept as \n */
    windTitle.setAttribute('aria-label', rawTitle.replace(/\s+/g, ' ').trim());
    var wtBox = document.createElement('span');
    wtBox.className = 'wt';
    wtBox.setAttribute('aria-hidden', 'true');
    var wtChars = [], wtWords = [];
    rawTitle.split(/( +|\n)/).forEach(function (tok) {   /* regular spaces only: a no-break space stays inside its word */
      if (!tok) return;
      if (tok === '\n') { var br = document.createElement('br'); br.className = 'wt-br'; wtWords.push(br); return; }   /* hard break; shown only where CSS displays .wt-br */
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
        if (!w || w.nodeName === 'BR') return;
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
    var wtOff = false, wtSlow = 0, wtLastNow = 0;
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
      /* the fail-safe may have shown the title while we waited for a smooth
         moment: never hide it again to replay it */
      if (parseFloat(getComputedStyle(windTitle).opacity) > 0.5) { plainStart(); return; }
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
    /* A CSS animation runs on the clock, not on frames: started in the middle
       of the page's start-up (a first layout of the whole page, scripts, the
       fonts landing — a few hundred milliseconds in which no frame is drawn),
       it has already played half of itself when frames resume, and the arrival
       looks like a skip rather than a movement. So it starts on the first
       smooth stretch: four frames in a row under 24 ms, or after 0.9 s at the
       latest. This is why it stuttered on a first visit and not from the
       cache: from the cache the start-up is short. */
    var whenSmooth = function (cb) {
      var t0 = performance.now(), last = 0, good = 0;
      var f = function (t) {
        if (last) { if (t - last < 24) good++; else good = 0; }
        last = t;
        if (good >= 4 || t - t0 > 900) cb(); else requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    };
    var onFont = function () {
      if (!wtStarted) { clearTimeout(plainTimer); whenSmooth(startArrival); }
      else if (wtMode === 'plain') settleTitle();
    };
    var fonts = document.fonts;
    var fontIn = (fonts && fonts.load) ? fonts.load('750 64px Archivo', rawTitle) : Promise.resolve();
    var fontNow = true;
    try { fontNow = !fonts || !fonts.check || fonts.check('750 64px Archivo', rawTitle); } catch (e) {}
    var shownAlready = parseFloat(getComputedStyle(windTitle).opacity) > 0.5;
    if (shownAlready) plainStart();
    else if (fontNow) whenSmooth(startArrival);
    else plainTimer = setTimeout(plainStart, 450);
    fontIn.then(onFont, onFont);
    if (pointerFine) {
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
         itself — not optional resources a script may pull in later */
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

  /* --- 8. QR menu demo ---------------------------------------------------------------------
   * The menu page's working example: the sheet on the left is what the owner edits, the phone on the
   * right is what the customer sees. Typing a price updates that dish (and flashes it); un-ticking
   * "available" strikes it through with a "sold out" note; the phone's FR / EN / IT buttons switch the
   * dish names, the categories and the way prices are written; its two tabs switch category. No script:
   * the page shows both categories, in the page's language, and the inputs just do nothing. */
  var qd = document.querySelector('[data-qr-demo]');
  if (qd) {
    var qLang = qd.getAttribute('data-lang') || 'fr';
    var qPhone = qd.querySelector('.qr-phone');
    var qLists = [].slice.call(qd.querySelectorAll('.qr-phone__list'));
    var qTabs = [].slice.call(qd.querySelectorAll('.qr-phone__tab'));
    var qMoney = function (v) {
      var n = parseFloat(String(v).replace(',', '.'));
      if (isNaN(n) || n < 0) return '—';
      var s = n.toFixed(2);
      return qLang === 'en' ? '€' + s : s.replace('.', ',') + '\u00a0€';
    };
    var qPrices = {};
    [].forEach.call(qd.querySelectorAll('tbody tr'), function (tr) { qPrices[tr.getAttribute('data-id')] = tr.querySelector('.qr-sheet__p').value; });
    var qPaint = function () {
      [].forEach.call(qd.querySelectorAll('[data-fr]'), function (el) { var t = el.getAttribute('data-' + qLang); if (t) el.textContent = t; });
      [].forEach.call(qd.querySelectorAll('.qr-dish'), function (li) { li.querySelector('.qr-dish__p').textContent = qMoney(qPrices[li.getAttribute('data-id')]); });
      [].forEach.call(qd.querySelectorAll('.qr-phone__langs button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === qLang ? 'true' : 'false'); });
    };
    var qCat = function (i) {
      qLists.forEach(function (ul, k) { ul.hidden = k !== i; });
      qTabs.forEach(function (b, k) { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    };
    qCat(0);
    var qTouched = function () { qd.classList.add('is-touched'); };
    qd.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.classList.contains('qr-sheet__p')) return;
      qTouched();
      var id = el.closest('tr').getAttribute('data-id');
      qPrices[id] = el.value;
      var li = qd.querySelector('.qr-dish[data-id="' + id + '"]');
      if (!li) return;
      li.querySelector('.qr-dish__p').textContent = qMoney(el.value);
      var catIndex = qLists.indexOf(li.parentNode);
      if (catIndex >= 0) qCat(catIndex);                       /* show the category the change is in */
      li.classList.remove('is-flash'); void li.offsetWidth; li.classList.add('is-flash');
    });
    qd.addEventListener('change', function (e) {
      var el = e.target;
      if (!el.classList.contains('qr-sheet__ok')) return;
      qTouched();
      var li = qd.querySelector('.qr-dish[data-id="' + el.closest('tr').getAttribute('data-id') + '"]');
      if (!li) return;
      li.classList.toggle('is-out', !el.checked);
      var catIndex = qLists.indexOf(li.parentNode);
      if (catIndex >= 0) qCat(catIndex);
    });
    qd.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b || !qPhone.contains(b)) return;
      if (b.hasAttribute('data-lang')) { qLang = b.getAttribute('data-lang'); qPaint(); qTouched(); }
      else if (b.hasAttribute('data-cat')) { qCat(+b.getAttribute('data-cat')); qTouched(); }
    });
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
