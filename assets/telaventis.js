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
    var wtFrame = function (now) {
      wtRaf = 0;
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
        wtChars[i].style.setProperty('--wg', (W_REST + (W_OPEN - W_REST) * c).toFixed(1));
        wtChars[i].style.setProperty('--wd', (D_REST + (D_OPEN - D_REST) * c).toFixed(2));
      }
      if (moving || gustT0 || wtPtr.on) wtRaf = requestAnimationFrame(wtFrame);
    };
    var wtKick = function () { if (wtReady && !wtRaf) wtRaf = requestAnimationFrame(wtFrame); };
    /* the arrival starts once Archivo itself is in (at most 1.2s) — started
       on the fallback face, the letters used to jump width when the web
       font swapped in mid-flight. Until then the title is held invisible by
       the CSS (with its own fail-safe). */
    var arrive = (wtChars.length * 14 + 60 + 1000), wtStarted = false;
    var startArrival = function () {
      if (wtStarted) return;
      wtStarted = true;
      windTitle.classList.add('wt-host');
      setTimeout(settleTitle, arrive);
    };
    var fontIn = (document.fonts && document.fonts.load) ? document.fonts.load('750 64px Archivo') : Promise.resolve();
    fontIn.then(startArrival, startArrival);
    setTimeout(startArrival, 1200);
    var settleTitle = function () {
      windTitle.classList.add('wt-settled');
      windTitle.removeAttribute('data-ink-wait');
      layWords();
      wtMeasure();
      wtReady = true;
      gustT0 = performance.now();
      wtKick();
    };
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
   * wipe runs on its own clock — and changes are one scene at a time with
   * a cooldown, so a fast flick plays every scene instead of skipping any.
   * Hidden scenes are `inert`: nothing in them can be focused or read. */
  var show = document.querySelector('[data-showcase]');
  if (show && !reduce && 'animate' in Element.prototype) {
    var scenes = Array.prototype.slice.call(show.querySelectorAll('[data-scene]'));
    var track = show.querySelector('.showcase__track');
    var sticky = show.querySelector('.showcase__sticky');
    var railItems = Array.prototype.slice.call(show.querySelectorAll('.showcase__rail li'));
    var N = scenes.length;
    var cur = -1, lastStep = 0, WIPE = 1150, EASE = 'cubic-bezier(.65,0,.35,1)';
    show.style.setProperty('--scenes', N);
    show.setAttribute('data-showcase-live', '');
    scenes.forEach(function (sc) { sc.setAttribute('inert', ''); });

    var nameOf = function (sc) { return sc.querySelector('.scene__name'); };
    /* phones only (the showcase's phone layout, telaventis.css, on a touch
       screen): the 3s wait below and the one-swipe-one-scene scroll further
       down. Desktop keeps its behaviour untouched. */
    var mobile = !!(window.matchMedia && window.matchMedia('(max-width: 999px) and (hover: none) and (pointer: coarse)').matches);
    /* each scene's screens are recordings of the live site. On phones they
       start only once the visitor has stayed on a project for PLAY_AFTER
       (asked by Leonardo: the scene is read first, as a still, then it comes
       alive; on desktop, at once) — and only the current scene's, only
       while the showcase is on screen and the tab is visible. On phones, leaving a scene also rewinds its
       recordings to their first frame (= the poster), so a scene always
       opens on the same still; the current and next scenes buffer during
       the wait. */
    var PLAY_AFTER = mobile ? 3000 : 0;
    var vidsOf = function (sc) { return sc ? Array.prototype.slice.call(sc.querySelectorAll('video')) : []; };
    var showOn = false, playAt = -1, playTimer = 0, watched = -1;
    var syncVideos = function () {
      var live = showOn && !document.hidden && cur >= 0;
      /* the wait restarts whenever the scene changes or the showcase is
         left (scrolled away, tab hidden) — it counts time spent ON a project */
      if (!live || cur !== watched) { clearTimeout(playTimer); playTimer = 0; playAt = -1; }
      if (live && playAt < 0) {
        watched = cur;
        playAt = performance.now() + PLAY_AFTER;
        if (PLAY_AFTER) playTimer = setTimeout(function () { playTimer = 0; syncVideos(); }, PLAY_AFTER);
      }
      if (!live) watched = -1;
      var due = live && playAt >= 0 && performance.now() >= playAt - 20;
      scenes.forEach(function (sc, i) {
        vidsOf(sc).forEach(function (v) {
          if (i === cur && due) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else {
            if (!v.paused) v.pause();
            if (mobile && i !== cur && v.currentTime > 0) { try { v.currentTime = 0; } catch (e) {} }
          }
          if ((i === cur + 1 || (mobile && i === cur)) && v.preload === 'none') v.preload = 'auto';
        });
      });
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { showOn = es[0].isIntersecting; syncVideos(); }, { threshold: 0.15 }).observe(sticky);
    } else { showOn = true; }
    document.addEventListener('visibilitychange', function () { syncVideos(); });
    var paintRail = function () {
      railItems.forEach(function (li, i) { li.classList.toggle('is-on', i === cur); li.classList.toggle('is-past', i < cur); });
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

    var pick = function () {
      var r = track.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var scrollable = Math.max(1, track.offsetHeight - vh);
      var p = Math.max(0, Math.min(0.9999, -r.top / scrollable));
      return Math.min(N - 1, Math.floor(p * N));
    };
    var scTick = 0;
    var step = function () {
      scTick = 0;
      var want = pick();
      var now = performance.now();
      if (cur < 0) { go(want, 1, true); lastStep = now; return; }
      if (want === cur) return;
      if (now - lastStep < WIPE + 60) { scTick = requestAnimationFrame(step); return; }
      lastStep = now;
      go(cur + (want > cur ? 1 : -1), want > cur ? 1 : -1, false);
      if (pick() !== cur) scTick = requestAnimationFrame(step);
    };
    /* phones: one swipe, one scene. With a finger, a flick carries on
       by itself (momentum) over two or three screens, so the desktop rule
       above — a threshold every screen, changes queued one after another —
       played scenes the visitor had not asked for, often after the finger
       had lifted, and a strong flick left the section before they had
       played. Here, as for the Moka door (telaventis-fx.js §3d, "no
       speedrun"): each scene has a resting point in the middle of its own
       stretch of scroll (the track is taller on phones, telaventis.css:
       SEG_SVH per scene), half a stretch either way from the next one — one
       deliberate swipe, never a light touch. Crossing into another scene's
       stretch plays exactly one hand-over, brings the scroll back to that
       scene's resting point and holds it (the fling is dropped) until the
       wipe has finished; the section arriving on screen does the same, on
       its first or last scene, so a fling from above or below lands on it
       instead of flying through. Never during a jump through an in-page
       link; the hold always ends on its own timer. */
    var follow = step;
    if (mobile) {
      var HOLD_ARRIVE = 500;
      var root = document.documentElement;
      var heldY = null, heldTimer = 0, inside = false, jumpUntil = 0;
      var release = function () { heldY = null; clearTimeout(heldTimer); root.classList.remove('sc-held'); };
      var hold = function (y, ms) {
        heldY = Math.round(y);
        window.scrollTo({ top: heldY, behavior: 'instant' });
        root.classList.add('sc-held');
        clearTimeout(heldTimer);
        heldTimer = setTimeout(release, ms);
      };
      window.addEventListener('touchmove', function (e) { if (heldY !== null && e.cancelable) e.preventDefault(); }, { passive: false });
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href*="#"]');
        if (a && a.pathname === location.pathname && a.hash) jumpUntil = performance.now() + 2500;
      });
      window.addEventListener('hashchange', function () { jumpUntil = performance.now() + 2500; });
      document.addEventListener('visibilitychange', function () { if (document.hidden) release(); });
      follow = function () {
        scTick = 0;
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
    }
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
    if (!reduce) {
      var cvio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting && !document.hidden) { v.preload = 'auto'; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          else if (!v.paused) v.pause();
        });
      }, { threshold: 0.33 });
      Array.prototype.forEach.call(work.querySelectorAll('.cst__video'), function (v) { cvio.observe(v); });
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
