/* Telaventis — behaviour layer.
 * 1) safety-net .js class (the authoritative one is the inline snippet in
 *    <head>, which runs before first paint; this just guarantees it's set)
 * 2) staggered reveal-on-scroll for [data-reveal] — a handful of major
 *    narrative groups per page, not every card
 * 3) the "ink" pointer-gravity effect on [data-ink] headings — event-driven,
 *    not a permanent animation loop: it only wakes up near an eligible
 *    heading, on pointer:fine devices, and goes back to sleep the moment the
 *    pointer leaves, the tab is hidden, or reduced motion is requested. At
 *    most the homepage hero + one section heading carry [data-ink].
 * 4) hero band tilt (subtle, scroll-driven, already rAF-gated)
 * 5) contact form: submits to Web3Forms in place with an accessible status
 *    region; falls back to a plain HTML POST if fetch or JS is unavailable —
 *    native required-field validation always works because the form never
 *    carries novalidate. */
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
  if (navToggle && navLinksList) {
    navLinksList.querySelectorAll('.nav__link').forEach(function (a) {
      a.addEventListener('click', function () { navToggle.removeAttribute('open'); });
    });
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

  /* --- 3. hero band tilt (subtle, scroll-driven) --------------------------- */
  var band = document.querySelector('[data-band]');
  if (band && !reduce) {
    var tiltBand = function () {
      var r = band.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var t = 1 - 2 * ((r.top + r.height / 2) / (vh + r.height));
      t = Math.max(-1, Math.min(1, t));
      var l = (72 + 5.5 * t).toFixed(2);
      var rt = (16 - 5.5 * t).toFixed(2);
      var lower = 'polygon(0 ' + l + '%,100% ' + rt + '%,100% 100%,0 100%)';
      var upper = 'polygon(0 0,100% 0,100% ' + rt + '%,0 ' + l + '%)';
      var kids = band.children;
      if (kids[0]) kids[0].style.clipPath = lower;
      if (kids[1]) kids[1].style.clipPath = upper;
      if (kids[2]) kids[2].style.clipPath = lower;
    };
    var raf = 0;
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; tiltBand(); });
    }, { passive: true });
    window.addEventListener('resize', tiltBand, { passive: true });
    tiltBand();
  }

  /* --- 4. contact form ----------------------------------------------------- */
  var form = document.querySelector('[data-contact]');
  if (!form) return;

  var note = form.querySelector('[data-formnote]');
  var submitBtn = form.querySelector('[data-contact-submit]');

  var MSG = {
    sending:  form.dataset.msgSending  || 'Envoi en cours…',
    success:  form.dataset.msgSuccess  || 'Message envoyé — vous recevrez une réponse écrite sous un jour ouvré.',
    error:    form.dataset.msgError    || 'L’envoi a échoué. Réessayez, ou écrivez directement à hello@telaventis.com.',
    submitIdle:    form.dataset.msgSubmitIdle    || 'Envoyer →',
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
