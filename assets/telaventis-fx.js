/* ==========================================================================
   TELAVENTIS — FX layer (behaviour)

   Four effects adapted from published demos. Each source was written against
   a library (GSAP three times, Three.js once); none of that is loaded here.
   The site ships no runtime dependency and says so in its own copy, so every
   effect was re-derived from its source technique and rewritten in the same
   plain, single-rAF, progressive-enhancement idiom as moka-lab.js. What was
   kept, what was changed and why is documented per section below and in
   assets/telaventis-fx.css. Sources are credited in mentions-legales.html.

   Shared contract, identical to the rest of the site:
     · nothing is hidden before the script has proved it can reveal it again
     · prefers-reduced-motion and no-JS both fall back to plain static content
     · one rAF loop for everything, and it stops itself the moment no module
       still wants a frame — nothing spins while the page is idle
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var html = doc.documentElement;
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var reduce = mq('(prefers-reduced-motion: reduce)');

  /* One version for everybody: in #digital-era the backdrop is the animated gradient on every screen; a phone only gets a coarser bubble grid and the shorter track. */
  var phoneScreen = mq('(max-width:759px)');
  var compactView = phoneScreen;

  var clamp = function (n, a, b) { return n < a ? a : n > b ? b : n; };
  var range = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeOutQuint = function (t) { return 1 - Math.pow(1 - t, 5); };
  /* GSAP easing names written out. Its "powerN" ladder is quad, cubic, quart,
     quint — so the shape-overlay demo's "power2.inOut" is CUBIC, and the
     section-transition demo's "power1.inOut" is quad. Worth getting right:
     both effects read visibly flatter on the weaker curve. */
  var easeInOutQuad = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var easeInOutCubic = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* The bezier-through-points construction from "SVG Shape Overlays"
     (GreenSock, https://codepen.io/GreenSock/pen/qBedXpg) — a cubic through
     every value using the midpoint between two points as both handles.
     Shared because it is used twice: once settling to a resting crest
     behind the pricing blocks (fx-wave, below), once as a fixed-duration
     sweep triggered by each panel handoff in #digital-era (fx-type, further
     down) — two independent uses of the one primitive rather than two
     copies of it. */
  var buildBezierPathD = function (n, values) {
    var d = 'M 0 0 V ' + values[0].toFixed(2) + ' C';
    for (var j = 0; j < n - 1; j++) {
      var p = (j + 1) / (n - 1) * 100;
      var cp = p - (1 / (n - 1) * 100) / 2;
      d += ' ' + cp.toFixed(2) + ' ' + values[j].toFixed(2) +
           ' ' + cp.toFixed(2) + ' ' + values[j + 1].toFixed(2) +
           ' ' + p.toFixed(2) + ' ' + values[j + 1].toFixed(2);
    }
    d += ' V 100 H 0 Z';
    return d;
  };

  /* ---- one shared frame loop ---------------------------------------------
     Jobs return true while they still need frames. When every job returns
     false the loop stops requesting them and the page goes fully idle; any
     scroll, resize or observer wake-up kicks it again. */
  var jobs = [];
  var rafId = 0;
  var lastT = 0;
  var loop = function (t) {
    rafId = 0;
    var dt = lastT ? Math.min(t - lastT, 100) : 16;
    lastT = t;
    var again = false;
    for (var i = 0; i < jobs.length; i++) { if (jobs[i](t, dt)) again = true; }
    if (again) rafId = requestAnimationFrame(loop);
    else lastT = 0;
  };
  var kick = function () { if (!rafId) rafId = requestAnimationFrame(loop); };
  var addJob = function (fn) { jobs.push(fn); kick(); };

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', kick, { passive: true });
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden) kick(); });

  /* debounced resize fan-out for the modules that have to re-measure */
  var resizeHooks = [];
  var onResize = function (fn) { resizeHooks.push(fn); };
  var rTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rTimer);
    rTimer = setTimeout(function () {
      for (var i = 0; i < resizeHooks.length; i++) resizeHooks[i]();
      kick();
    }, 180);
  }, { passive: true });


  /* ======================================================================
     1. fx-split — masked per-character heading reveal

     Source: "Animated Continuous Sections with GSAP Observer"
     (GreenSock, https://codepen.io/GreenSock/pen/XWzRraJ). There, SplitText
     cuts a heading into chars/words/lines, the line wrappers get
     overflow:hidden ("clip-text") and the chars are tweened from
     yPercent:150 with stagger {each:.02, from:"random"} — that random-order
     rise out of an invisible baseline is the effect's actual signature.

     What changed, and why:
     · The demo fires it from a hijacked full-page section swap. This site
       keeps native scroll everywhere (and has a scroll-scrubbed case study
       that a hijack would break outright), so the reveal is bound to
       IntersectionObserver instead — the same entry trigger [data-reveal]
       already uses, so the two never fight.
     · SplitText is a paid-tier convenience; the split here is done by hand
       so that <br> and inline elements inside a heading survive, non-
       breaking spaces stay unbreakable, and real whitespace text nodes are
       preserved between words — without those, inline-block words cannot
       wrap and every heading would become one unbreakable line.
     · Lines are grouped from measured offsetTop rather than declared, and
       re-measured on resize, so the mask follows real reflow at any width.
     · The heading keeps an aria-label of its original text: for a labelled
       element the accessible name comes from the label, not from the
       contents, so screen readers announce the sentence once instead of
       walking a hundred one-character spans.
     ====================================================================== */
  (function () {
    /* Headings that already carry [data-ink] are excluded: that effect paints
       an image through background-clip:text on the heading itself, and
       transformed inline-block descendants do not reliably clip against a
       parent's text-clipped background. One effect per heading. */
    /* page titles, plus the few headings that opt in — no longer every .h2:
       one reveal on every section heading is a reflex, not a choice */
    var SEL = '.h-page, [data-fx-split]';
    var nodes = [].slice.call(doc.querySelectorAll(SEL)).filter(function (el) {
      return !el.hasAttribute('data-ink') && !el.closest('[data-ink]');
    });
    if (!nodes.length || reduce) return;

    var WORD_SPLIT = /([ \t\n\r]+)/;   /* deliberately not \s — \s matches
                                          U+00A0, and a non-breaking space
                                          must stay inside its word */

    var buildUnits = function (source, out) {
      for (var n = source.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          var parts = n.nodeValue.split(WORD_SPLIT);
          for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (!part) continue;
            if (!part.trim()) { out.push(doc.createTextNode(part)); continue; }
            var w = doc.createElement('span');
            w.className = 'fx-word';
            var chars = Array.from ? Array.from(part) : part.split('');
            for (var c = 0; c < chars.length; c++) {
              var ch = doc.createElement('span');
              ch.className = 'fx-char';
              ch.textContent = chars[c];
              w.appendChild(ch);
            }
            out.push(w);
          }
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') { out.push(n.cloneNode(false)); }
          else { out.push(n.cloneNode(true)); }  /* links, <wbr>, <em>… kept whole */
        }
      }
    };

    var split = function (el) {
      if (el._fxOrig == null) el._fxOrig = el.innerHTML;
      if (!el.getAttribute('aria-label')) {
        /* <br> has to become a space first: "Questions<br>fréquentes" reads
           as one nonsense word through textContent, and that string is about
           to become the heading's entire accessible name. */
        var lab = doc.createElement('div');
        lab.innerHTML = el._fxOrig.replace(/<br\s*\/?>/gi, ' ');
        el.setAttribute('aria-label', (lab.textContent || '').replace(/\s+/g, ' ').trim());
      }

      var probe = doc.createElement('div');
      probe.innerHTML = el._fxOrig;
      var units = [];
      buildUnits(probe, units);
      if (!units.length) return false;

      el.textContent = '';
      for (var i = 0; i < units.length; i++) el.appendChild(units[i]);

      /* group by measured top: one .fx-line mask per rendered line */
      var lines = [];
      var current = null;
      var top = null;
      for (var j = 0; j < units.length; j++) {
        var u = units[j];
        if (u.nodeType === 1 && u.tagName === 'BR') { current = null; top = null; continue; }
        if (u.nodeType === 1) {
          var y = u.offsetTop;
          if (current === null || top === null || Math.abs(y - top) > 2) {
            current = []; lines.push(current); top = y;
          }
          current.push(u);
        } else if (current) {
          current.push(u);           /* the whitespace that follows a word */
        }
      }
      if (!lines.length) return false;

      var frag = doc.createDocumentFragment();
      for (var k = 0; k < lines.length; k++) {
        var lineEl = doc.createElement('span');
        lineEl.className = 'fx-line';
        for (var m = 0; m < lines[k].length; m++) lineEl.appendChild(lines[k][m]);
        frag.appendChild(lineEl);
      }
      el.textContent = '';
      el.appendChild(frag);

      /* stagger {from:"random"} — shuffle the order, not the characters */
      var chars = el.querySelectorAll('.fx-char');
      var order = [];
      for (var q = 0; q < chars.length; q++) order.push(q);
      for (var s = order.length - 1; s > 0; s--) {
        var r = (Math.random() * (s + 1)) | 0;
        var tmp = order[s]; order[s] = order[r]; order[r] = tmp;
      }
      /* the demo's flat .02s per char runs away on a long editorial heading;
         the total is capped so a 12-word title still lands in well under a
         second, which is what the effect is worth. */
      var each = Math.min(0.022, 0.62 / Math.max(1, chars.length));
      for (var o = 0; o < order.length; o++) {
        chars[order[o]].style.setProperty('--d', (o * each).toFixed(3) + 's');
      }

      el.setAttribute('data-fx-split-ready', '');
      el._fxWidth = el.clientWidth;
      return true;
    };

    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('is-in');
        io.unobserve(el);
        /* stop paying for compositing hints once the reveal has landed */
        setTimeout(function () { el.classList.add('fx-done'); }, 1600);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }) : null;

    var ready = [];
    var prepare = function () {
      nodes.forEach(function (el) {
        if (!el.isConnected || !el.clientWidth) return;
        if (!split(el)) return;
        ready.push(el);
        /* [data-fx-manual]: split now, but let another module decide when to
           play it. Used by #digital-era, whose third phrase is inside a
           pinned panel that enters the viewport long before it is the panel
           being read — an entry trigger would spend the reveal off-screen. */
        if (el.hasAttribute('data-fx-manual')) return;
        if (io) io.observe(el); else el.classList.add('is-in');
      });
    };

    /* Wait for the self-hosted fonts: splitting against a fallback face and
       then reflowing into Archivo regroups the lines and leaves masks in the
       wrong place. font-display:swap makes that a visible jump, not a
       theoretical one. */
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(prepare).catch(prepare);
    else prepare();

    onResize(function () {
      ready.forEach(function (el) {
        if (!el.isConnected || el.clientWidth === el._fxWidth || !el.clientWidth) return;
        var wasIn = el.classList.contains('is-in');
        var wasDone = el.classList.contains('fx-done');
        el.classList.remove('is-in', 'fx-done');
        el.removeAttribute('data-fx-split-ready');
        if (split(el)) {
          if (wasIn) {
            /* already-read headings must not replay on a rotate/resize */
            el.classList.add('is-in');
            if (wasDone) el.classList.add('fx-done');
          }
        }
      });
    });
  }());


  /* ======================================================================
     2. fx-wave — liquid bezier fill behind the pricing blocks

     Source: "SVG Shape Overlays" (GreenSock,
     https://codepen.io/GreenSock/pen/qBedXpg), itself a fork of osublake's
     https://codepen.io/osublake/pen/BYwgBg. Ten points across the width,
     each one a control value the timeline drives to 0 on its own random
     delay; the path is rebuilt every frame with midpoint handles
     (cp = p - (100/(n-1))/2) so the crest stays smooth while the points
     arrive out of step. That construction is reproduced exactly.

     What changed, and why:
     · The source is a fixed, fullscreen, click-toggled page curtain in an
       orange/pink gradient. Dropped in as-is it would sit over the whole
       site in colours that belong to another design. Here each pricing
       block gets its own instance, sized to the block, tinted with two
       washes of that block's OWN palette, so it reads as texture inside the
       existing colour rather than a second colour arguing with it.
     · Click becomes scroll: it fills once when the block reaches the
       viewport, which is when a price is actually being read.
     · It stops at a resting crest instead of flooding to full, with a small
       per-point offset so the waterline is uneven — a solid flood would
       just be a second background colour.
     · gsap.timeline becomes ~20 lines of rAF with the same per-point delay
       and the same power2.inOut easing.
     ====================================================================== */
  (function () {
    var groups = [
      { sel: '.grid-cards .pcard', points: 9, rest: 44, spread: 7, stagger: 0.09 },
      { sel: '.tier-row', points: 10, rest: 52, spread: 9, stagger: 0 }
    ];

    var instances = [];

    var build = function (host, cfg, groupIndex) {
      var svg = doc.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'fx-wave');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');

      var paths = [];
      for (var i = 0; i < 2; i++) {
        var p = doc.createElementNS(SVGNS, 'path');
        svg.appendChild(p);
        paths.push(p);
      }
      host.classList.add('fx-wave-host');
      host.insertBefore(svg, host.firstChild);

      var n = cfg.points;
      var inst = {
        paths: paths, n: n, t: 0, running: false, done: false,
        start: 0, delay: groupIndex * cfg.stagger,
        /* two layers: the back one settles lower, the front one higher, so
           the overlap of the two translucent washes is what you actually
           read as depth */
        layers: [
          { from: 100, to: [], pointDelay: [], pathDelay: 0 },
          { from: 100, to: [], pointDelay: [], pathDelay: 0.22 }
        ]
      };

      for (var L = 0; L < 2; L++) {
        var layer = inst.layers[L];
        var rest = cfg.rest + L * 9;
        for (var j = 0; j < n; j++) {
          layer.to.push(clamp(rest + (Math.random() - 0.5) * 2 * cfg.spread, 4, 96));
          layer.pointDelay.push(Math.random() * 0.3);   /* delayPointsMax, as in the source */
        }
      }
      return inst;
    };

    /* the enclosing "fill from the bottom" form is fixed relative to the
       source (which flips between two forms because it is a curtain that
       opens and closes) — the path construction itself is buildBezierPathD,
       shared with the #digital-era wipe curtain further down. */
    var draw = function (inst, values, pathIndex) {
      inst.paths[pathIndex].setAttribute('d', buildBezierPathD(inst.n, values));
    };

    var settle = function (inst) {
      for (var L = 0; L < 2; L++) draw(inst, inst.layers[L].to, L);
      inst.done = true;
    };

    var step = function (inst, now) {
      if (inst.done) return false;
      var el = (now - inst.start) / 1000 - inst.delay;
      var busy = false;
      for (var L = 0; L < 2; L++) {
        var layer = inst.layers[L];
        var vals = [];
        for (var j = 0; j < inst.n; j++) {
          var local = el - layer.pathDelay - layer.pointDelay[j];
          var u = clamp(local / 0.9, 0, 1);          /* duration 0.9, as in the source */
          if (u < 1) busy = true;
          vals.push(layer.from + (layer.to[j] - layer.from) * easeInOutCubic(u));
        }
        draw(inst, vals, L);
      }
      if (!busy) inst.done = true;
      return busy;
    };

    groups.forEach(function (cfg) {
      var hosts = doc.querySelectorAll(cfg.sel);
      for (var i = 0; i < hosts.length; i++) {
        var inst = build(hosts[i], cfg, i);
        inst.host = hosts[i];
        instances.push(inst);
      }
    });
    if (!instances.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      instances.forEach(settle);
      return;
    }

    var live = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var inst = e.target._fxWave;
        io.unobserve(e.target);
        if (!inst || inst.running) return;
        inst.running = true;
        inst.start = performance.now();
        live.push(inst);
        kick();
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    instances.forEach(function (inst) {
      inst.host._fxWave = inst;
      io.observe(inst.host);
    });

    addJob(function (now) {
      if (!live.length) return false;
      var busy = false;
      for (var i = live.length - 1; i >= 0; i--) {
        if (step(live[i], now)) busy = true;
        else live.splice(i, 1);
      }
      return busy;
    });
  }());


  /* ======================================================================
     3. fx-type — text drawn as flowers / bubbles  (#digital-era)

     Source: Codrops "Typing Effects with Three.js", demos 2 (bubbles) and 3
     (flowers) — https://tympanus.net/Development/3DTypeEffects/ by uuuulala.
     The interesting half of those demos is not the WebGL: it is that the
     string is drawn once into an offscreen 2D canvas and then sampled on a
     grid, and every sampled pixel above an alpha threshold becomes one
     instance. That sampling is the technique reused here, threshold and all.
     Per-particle motion is also theirs, not invented — see the long comment
     on buildParticles()/drawParticles() below for the mapping from their
     Particle objects to this one.

     What changed, and why:
     · The demos load Three.js and OrbitControls from a CDN, run a
       fullscreen WebGL canvas, and feed InstancedMesh — a flower quad with
       an alphaMap PNG in demo 3, a sphere with a fresnel-rim shader in
       demo 2. That is roughly 150 KB of third-party JavaScript over the
       network plus a texture request, on a site whose entire argument is
       that it has no dependencies. So the instances are drawn as 2D-canvas
       sprites instead: the flower is five petals composited once into an
       offscreen sprite, the bubble is a radial rim gradient plus a specular
       blob — a flat restatement of that fresnel term. Each sprite is
       rasterised once and then only ever blitted, so a few hundred of them
       cost one drawImage each per frame and phones keep up.
     · The demos are a toy: you type into a contenteditable and orbit the
       camera. Here the strings are fixed editorial copy, so the real text
       always stays in the DOM (as .era__mix, see 3b below) for crawlers,
       screen readers and no-JS; canvases are a decorative layer over it.
     · Colours come from the site palette, not the demos'.
     · Every word of a phrase gets its own small canvas (makeKeyGlyph),
       sized and positioned by ordinary text layout rather than one big
       display-scale duplicate elsewhere on the page: a couple of words are
       flower/bubble from the moment the panel appears, and the rest of the
       sentence converts into the same treatment, in place, later in the
       scroll — see 3b for when.
     ====================================================================== */
  var fxType = (function () {

    var sprite = function (size, paint) {
      var c = doc.createElement('canvas');
      c.width = c.height = size;
      paint(c.getContext('2d'), size);
      return c;
    };

    /* Demo 3's flower is a textured quad; here five petals are composited
       once into a sprite so the per-frame cost is a single blit. */
    var flowerSprite = function (color, core) {
      return sprite(72, function (g, S) {
        var cx = S / 2, cy = S / 2;
        g.globalAlpha = 0.92;
        for (var k = 0; k < 5; k++) {
          var a = (k / 5) * Math.PI * 2;
          g.save();
          g.translate(cx + Math.cos(a) * S * 0.15, cy + Math.sin(a) * S * 0.15);
          g.rotate(a);
          g.beginPath();
          g.ellipse(0, 0, S * 0.2, S * 0.125, 0, 0, Math.PI * 2);
          g.fillStyle = color;
          g.fill();
          g.restore();
        }
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(cx, cy, S * 0.085, 0, Math.PI * 2);
        g.fillStyle = core;
        g.fill();
      });
    };

    /* Demo 2's bubble is a sphere shaded by
         vReflectionFactor = .2 + 2 * pow(1 + dot(view, normal), 3)
       i.e. nearly transparent facing the camera, bright at the silhouette.
       A radial gradient with the same falloff is the honest 2D equivalent. */
    var bubbleSprite = function (r, g_, b) {
      return sprite(72, function (g, S) {
        var cx = S / 2, cy = S / 2, rad = S * 0.46;
        var grad = g.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
        /* A pure rim with a hollow centre is right at demo scale, where a
           bubble is 60px across. At the ~10px these end up, a hollow centre
           just makes the letter look moth-eaten — so the interior keeps a
           faint fill and the rim carries the shading. */
        grad.addColorStop(0.00, 'rgba(' + r + ',' + g_ + ',' + b + ',0.16)');
        grad.addColorStop(0.58, 'rgba(' + r + ',' + g_ + ',' + b + ',0.26)');
        grad.addColorStop(0.86, 'rgba(' + r + ',' + g_ + ',' + b + ',0.66)');
        grad.addColorStop(0.97, 'rgba(' + r + ',' + g_ + ',' + b + ',0.95)');
        grad.addColorStop(1.00, 'rgba(' + r + ',' + g_ + ',' + b + ',0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cy, rad, 0, Math.PI * 2);
        g.fill();
        g.save();
        g.globalAlpha = 0.5;
        g.translate(cx - rad * 0.34, cy - rad * 0.38);
        g.rotate(-0.5);
        g.beginPath();
        g.ellipse(0, 0, rad * 0.2, rad * 0.1, 0, 0, Math.PI * 2);
        g.fillStyle = '#fff';
        g.fill();
        g.restore();
      });
    };

    var SPRITES = null;
    var getSprites = function () {
      if (SPRITES) return SPRITES;
      /* Every tint has to hold its own against ink navy at roughly 10px.
         The first pass reused the full brand palette including #B4441C,
         which is only a little lighter than the background it sits on —
         those particles read as holes in the word rather than part of it.
         Dark entries are out; the range runs cream to mid-orange. */
      SPRITES = {
        flowers: [
          flowerSprite('#E0742F', '#F6E7CE'),
          flowerSprite('#EDE9E2', '#E0742F'),
          flowerSprite('#E8A87C', '#B4441C'),
          flowerSprite('#F0C9A0', '#C9542A'),
          flowerSprite('#D9682B', '#F6E7CE')
        ],
        bubbles: [
          bubbleSprite(237, 233, 226),
          bubbleSprite(240, 182, 122),
          bubbleSprite(172, 206, 216),
          bubbleSprite(248, 240, 225)
        ]
      };
      return SPRITES;
    };

    /* --- shared particle model, lifted from the demos' Particle objects ---
       Flower.grow() there is:
           age += ageDelta
           growing ? (deltaScale *= .99, scale += deltaScale)
                   : (scale = maxScale + .2*sin(age), rotationZ += .001*cos(age))
       — so a flower opens once, then breathes and turns for as long as it
       exists. Bubble.grow() is different in kind:
           scale += deltaScale
           if (scale >= maxScale) scale = 0        // pop, then regrow
           if (isFlying) y -= 7*deltaScale         // ~6% of them
       — a permanent cycle of bubbles swelling, bursting and starting over,
       with a few drifting off the word entirely. Both behaviours are kept;
       amplitudes are retuned down from the demos', which can be wild
       because they have thousands of instances and no legibility to
       protect. buildParticles() turns a sampled point cloud into instances
       of this model; drawParticles() steps and paints them — used
       identically by the small per-word canvases and the full-phrase one. */
    var buildParticles = function (pts, cssW, kind, stepPx) {
      /* Legibility is a ratio problem: a particle has to stay small against
         the STROKE it belongs to, and the grid has to be tight enough that
         neighbours touch — the two numbers that decide this always move
         together, never independently (see the callers for how stepPx is
         chosen). Both sprites are mostly transparent padding, and by
         different amounts (flower petals reach ~.35 of the box, bubble rim
         ~.46), so their multipliers differ; the bubble also spends most of
         its swell/burst cycle below full size, so it carries a further
         correction or the word reads as a ghost at its average size. */
      var isFlower = kind === 'flowers';
      /* bubbles brought down again — smaller reads as a finer, denser
         texture (closer to the reference jellyfish's own fine tentacle
         beading) rather than a row of individually obvious circles */
      var base = stepPx * (isFlower ? 1.90 : 0.92);
      var vary = isFlower ? 0.38 : 0.26;
      var lo = isFlower ? 0.78 : 0.82;
      var pal = getSprites()[kind];
      return pts.map(function (p) {
        /* the demos skew size hard with pow(random(), n) so most instances
           are small and a few carry the silhouette — kept, but far milder */
        var skew = Math.pow(Math.random(), 1.6);
        return {
          /* jitter enough to break the grid, not enough to blur the edge */
          x: p[0] + (Math.random() - 0.5) * stepPx * 0.34,
          y: p[1] + (Math.random() - 0.5) * stepPx * 0.34,
          s: base * (lo + skew * vary),
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.35,
          ph: Math.random() * Math.PI * 2,
          sp: pal[(Math.random() * pal.length) | 0],
          /* left-to-right birth, so the phrase grows into being rather than
             popping — the demos stagger per instance too */
          born: (p[0] / cssW) * 0.5 + Math.random() * 0.35,
          a: isFlower ? 0.78 + Math.random() * 0.22 : 0.92 + Math.random() * 0.08,
          /* drift is scaled to the grid, so it can never be large enough to
             pull a particle off its own letter */
          d: stepPx,
          /* bubbles: own swell-and-burst period, and the demo's ~6% that
             float away. Flowers: own breathing rate. */
          cyc: isFlower ? (2.2 + Math.random() * 2.6) : (2.6 + Math.random() * 4.2),
          fly: !isFlower && Math.random() < 0.03,
          /* how long this bubble hangs in the air before it respawns, once
             it is one of the ~9% that float away */
          lag: Math.pow(Math.random(), 1.4)
        };
      });
    };

    /* opts: { ptr: {x,y,r} in canvas-local px, or null — the pointer-repel
       interaction; evap: 0..1, how far into its delicate dissolve this word
       is, §3b. }. evap is deliberately scaled by the particle's own grid
       step (p.d), same as every other drift in this function, not by the
       canvas or viewport size — a word evaporates within its own footprint,
       it does not fling itself across the page. Staggered per particle via
       `lag` (already used for the bubble fly-off timing) so the dissolve
       reads as many small departures rather than one flat block fade. */
    var drawParticles = function (g, w, h, particles, kind, t, dt, opts) {
      opts = opts || {};
      var ptr = opts.ptr, evap = opts.evap || 0;
      var flowers = kind === 'flowers';
      g.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var u = clamp((t - p.born) / 0.95, 0, 1);
        if (u <= 0) continue;
        var grow = easeOutQuint(u);        /* the demos' one-time opening */
        var s = p.s * grow;
        var x = p.x, y = p.y, rot = p.rot;
        var phase = t / p.cyc + p.ph;

        /* Positional drift stays a fraction of the grid step — fixed pixel
           amplitudes were the original legibility problem, since the same
           3px sway that looks alive on a big desktop headline is most of a
           letter stroke at phone size. */
        if (flowers) {
          /* Flower.grow(), once open: breathe on its own clock and keep
             turning. The demo's `scale = maxScale + .2*sin(age)` is an
             absolute swing on a tiny maxScale, which flips small flowers
             inside out; taken proportionally here it reads the same but
             stays controlled. */
          s *= 1 + Math.sin(phase * 6.283) * 0.22 * grow;
          rot += p.spin * t * 0.5 + Math.sin(t * 0.5 + p.ph) * 0.3;
          x += Math.sin(t * 0.72 + p.ph) * p.d * 0.42;
          y += Math.cos(t * 0.58 + p.ph) * p.d * 0.36;
        } else {
          /* Bubble.grow(): swell to full, burst, start again. Floor raised
             to .70 (the demo resets scale straight to 0, which here would
             punch a hole in the letterform) and the burst is a sharp dip
             instead of a hard cut — same sawtooth, strokes stay solid. */
          /* Resting state = the packed state a metamorphosis lands in
             (3c): bubbles held tight against their neighbours, so the word
             reads as a word. The old swell-to-burst sawtooth (70-100% then a
             sharp dip) left the letters half-empty at any given instant;
             what survives of it is a slow ±3% breath and a drift of a tenth
             of the grid — alive, never loose. */
          s *= 1 + 0.03 * Math.sin(phase * 6.283);
          x += Math.sin(t * 0.55 + p.ph) * p.d * 0.12;
          y += Math.sin(t * 0.42 + p.ph * 1.7) * p.d * 0.10;
          /* the demo's isFlying 6%: these leave the word and float up,
             respawning at home once clear of it */
          if (p.fly) {
            p.flyY = (p.flyY || 0) - 26 * dt * (0.6 + p.lag);
            if (p.flyY < -h * 0.55) p.flyY = 0;
            y += p.flyY;
          }
        }

        var alpha = p.a * grow;

        /* the delicate evaporation: each particle gets its own onset via
           `lag` (0..1, already on every particle), spread across roughly
           the first half of the exit so they leave one at a time rather
           than in lockstep, then drifts gently upward, shrinks a little
           and fades the rest of the way out. */
        if (evap > 0) {
          var ev = clamp((evap - p.lag * 0.5) / (1 - p.lag * 0.5), 0, 1);
          if (ev > 0) {
            var evEase = easeOutCubic(ev);
            y -= p.d * 2.4 * evEase;
            s *= 1 - 0.3 * evEase;
            alpha *= 1 - evEase;
          }
        }

        /* pointer interaction: a soft push away, distance-decayed, purely
           additive so it never touches the particle's real position — it
           has no memory and relaxes the instant the pointer moves on */
        if (ptr && ptr.active) {
          var pdx = x - ptr.x, pdy = y - ptr.y;
          var pd = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pd < ptr.r && pd > 0.01) {
            var push = (1 - pd / ptr.r) * ptr.r * 0.5;
            x += (pdx / pd) * push;
            y += (pdy / pd) * push;
          }
        }

        if (alpha <= 0.004 || s <= 0.1) continue;
        g.save();
        g.globalAlpha = alpha * (p.fly && p.flyY ? Math.max(0, 1 + p.flyY / (h * 0.55)) : 1);
        g.translate(x, y);
        if (flowers) g.rotate(rot);
        g.drawImage(p.sp, -s / 2, -s / 2, s, s);
        g.restore();
      }
    };

    /* ---- makeKeyGlyph: one word's particle canvas -----------------------
       The box is small and already sized by ordinary text layout, so there
       is no line-wrapping or binary-searched font size to do — just measure
       the word's own rendered box and its computed font, lay it out once on
       an offscreen canvas at that size, and sample it on the same tight
       grid formula every particle canvas on this site uses. Used for both
       kinds of word in a #digital-era phrase: the couple that are always
       flower/bubble, and — built the same way, just left unrevealed until
       3b says otherwise — the rest of the sentence, which converts in place
       later in the scroll. */
    var mobileGlyphs = compactView;
    var makeKeyGlyph = function (el, kind) {
      var canvas = doc.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      el.appendChild(canvas);
      var ctx = canvas.getContext('2d');
      if (!ctx) { canvas.remove(); return null; }

      var text = (el.getAttribute('data-fx-key') || el.textContent || '').trim() || el.textContent.trim();
      var inst = { canvas: canvas, ctx: ctx, particles: [], w: 0, h: 0, built: false, t0: 0, prev: 0 };

      var build = function () {
        var cssW = el.offsetWidth, cssH = el.offsetHeight;
        if (cssW < 8 || cssH < 8) return false;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var cs = getComputedStyle(el);
        var fs = parseFloat(cs.fontSize) || 32;

        /* tighter still — a denser field of smaller bubbles reads as compact
           texture instead of a scatter of individually obvious circles.
           buildParticles sizes each bubble as a fixed fraction of this same
           step, so shrinking the grid shrinks the bubbles with it and they
           still meet their neighbours; nothing there needed to change. */
        /* phones: the word is ~60px, not ~120px, and sits on a busy flow
           field — a finer grid there dissolves into noise, so the grid (and
           with it every bubble, sized off this step) is coarser */
        var stepPx = mobileGlyphs ? Math.max(2.6, fs * 0.05) : Math.max(1.8, fs * 0.032);

        var off = doc.createElement('canvas');
        off.width = Math.round(cssW * dpr);
        off.height = Math.round(cssH * dpr);
        var octx = off.getContext('2d');
        octx.scale(dpr, dpr);
        octx.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
        /* the word's own letter-spacing (tight, negative): without it the
           canvas drew the word wider than the box it stands for, and the
           bubbles spilled onto the neighbouring words */
        if ('letterSpacing' in octx) octx.letterSpacing = cs.letterSpacing;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillStyle = '#fff';
        /* never wider than the box, whatever the browser does with the
           font: the ink is measured and, if it would reach closer than a
           bubble's width to either edge, the word is scaled down to fit
           (evenly, so the letters keep their shape) and centred on its ink */
        var mt = octx.measureText(text);
        var inkL = mt.actualBoundingBoxLeft, inkR = mt.actualBoundingBoxRight;
        if (!(inkL >= 0 || inkR >= 0) || isNaN(inkL + inkR)) { inkL = mt.width / 2; inkR = mt.width / 2; }
        var pad = stepPx * 1.2;
        var fit = Math.min(1, Math.max(1, cssW - 2 * pad) / Math.max(1, inkL + inkR));
        octx.translate(cssW / 2 - (inkR - inkL) / 2 * fit, cssH / 2 + fs * 0.03);
        octx.scale(fit, fit);
        octx.fillText(text, 0, 0);

        var data;
        try { data = octx.getImageData(0, 0, off.width, off.height).data; }
        catch (err) { return false; }

        var st = Math.max(1, Math.round(stepPx * dpr));
        var pts = [];
        for (var y = 0; y < off.height; y += st) {
          for (var x = 0; x < off.width; x += st) {
            if (data[(y * off.width + x) * 4 + 3] > 128) pts.push([x / dpr, y / dpr]);
          }
        }
        if (!pts.length) return false;

        inst.particles = buildParticles(pts, cssW, kind, stepPx);
        inst.w = cssW; inst.h = cssH;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        inst.built = true;
        /* revealing the class is the CALLER's decision, not this build step's
           — a key word wants it the instant it exists, a plain word wants it
           withheld until scroll says "convert now" (see 3b) */
        return true;
      };

      inst.ensure = function () {
        if (inst.built && Math.abs(el.offsetWidth - inst.w) > 6) inst.built = false;
        if (!inst.built) build();
        return inst.built;
      };

      inst.reveal = function (on) { el.classList.toggle('fx-type-on', !!(on && inst.built)); };

      /* replay from the start — called when a panel becomes active again,
         so a word already fully grown from a previous visit doesn't just
         pop back in fully formed */
      inst.reset = function () { inst.t0 = 0; if (inst.built) inst.ctx.clearRect(0, 0, inst.w, inst.h); };

      /* the opposite of reset(): jump the clock past every particle's birth
         (born <= .85s, then .95s of growth) so the word shows fully formed.
         Used when a metamorphosis (3c) has just delivered its particles to
         exactly these positions and the word must take over seamlessly. */
      inst.settle = function (now) { inst.t0 = now - 2600; inst.prev = now; };

      inst.render = function (now, opts) {
        if (!inst.built) return false;
        if (!inst.t0) { inst.t0 = now; inst.prev = now; }
        var t = (now - inst.t0) / 1000;
        var dt = Math.min((now - inst.prev) / 1000, 0.06);
        inst.prev = now;
        drawParticles(inst.ctx, inst.w, inst.h, inst.particles, kind, t, dt, opts);
        return true;
      };

      /* force: redraw even at the same width — the webfont arriving can
         leave the box's width unchanged while the canvas had drawn the
         fallback letters */
      inst.remeasure = function (force) {
        if (!inst.built) return;
        if (!force && Math.abs(el.offsetWidth - inst.w) < 4) return;
        inst.built = false;
        build();
      };

      return inst;
    };

    return { makeKeyGlyph: makeKeyGlyph, getSprites: getSprites };
  }());


  /* ======================================================================
     3b. #digital-era — the panel choreography

     Scroll position is only ever a TRIGGER here, never a value anything
     animates by. Every frame, the script decides which of three states
     each panel is in — before, active, or after — from where the scroll
     currently sits; the actual motion between those states is a plain CSS
     opacity crossfade (see .era__body in telaventis-fx.css) that starts the
     instant the class changes and then runs on its own clock. That split is
     deliberate: a mouse-wheel notch or a momentum flick does not deliver
     scroll in smooth, even steps, so a value that animates BY scroll
     inherits that unevenness directly. A value that only gets a start
     signal FROM scroll, and then plays out over real time, cannot.

     Deliberately minimal: no wipe, no per-particle exit flourish, no rise —
     earlier versions had all three, and the transition itself became the
     thing you noticed rather than the phrase underneath it. A couple of
     words stay flower/bubble type for as long as their panel is active; the
     rest is plain text; the handoff between panels is just a fade.

     Pointer interaction is the one thing kept: every word's particle canvas
     takes a live pointer position and gently pushes nearby particles away
     from it, decaying with distance, with no memory of its own. Wired
     through Pointer Events, which unify mouse and touch — the same
     handlers drive it with a mouse on desktop and a finger on a phone.
     ====================================================================== */
  (function () {
    var eras = doc.querySelectorAll('[data-era]');
    if (!eras.length || reduce) return;

    var HYST = 0.02;      /* fraction of overall track progress */

    [].forEach.call(eras, function (era) {
      var track = era.querySelector('.era__track');
      var panels = [].slice.call(era.querySelectorAll('[data-era-panel]'));
      var cue = era.querySelector('.era__cue');
      if (!track || !panels.length) return;
      var n = panels.length;
      /* same breakpoint as this section's own CSS (max-width:759px in
         telaventis-fx.css): a phone gets a coarser particle grid, fewer
         bubbles and the shorter track; the backdrop is the same animated
         gradient everywhere. */
      var isMobileEra = compactView;
      /* Panel boundaries as fractions of the whole track, not a flat 1/n
         each — mobile only, and only for the 3-panel shape this section
         actually ships (falls back to even thirds otherwise, rather than
         guess at a weighting for a shape it was never tuned against).
         Weights are the exact same 158/158/132 the mobile .era__track
         height in telaventis-fx.css is built from (158+158+132=448svh),
         so a panel's share of scroll here always matches its share of
         that total — first and middle phrase both +20% over the even
         baseline (132), last phrase unchanged. Desktop keeps plain even
         thirds; its own track height was never split unevenly. */
      var segBounds = (function () {
        /* the phone's uneven stretches belong to a phone's screen only */
        var weights = (phoneScreen && n === 3) ? [158, 158, 132] : null;
        var b = [0], acc = 0, i, sum;
        if (weights) {
          sum = weights[0] + weights[1] + weights[2];
          for (i = 0; i < n; i++) { acc += weights[i]; b.push(acc / sum); }
        } else {
          for (i = 1; i <= n; i++) b.push(i / n);
        }
        return b;
      }());
      var panelAt = function (pp) {
        for (var k = 0; k < n; k++) { if (pp < segBounds[k + 1] || k === n - 1) return k; }
        return n - 1;
      };

      var kinds = panels.map(function (p) { return p.getAttribute('data-fx-kind'); });
      /* Mobile drops the particle canvas entirely — not just its palette.
         It used to keep a recoloured "coral" variant of it (see the
         removed entry in getSprites()), but a scatter of small bubbles
         turned out to be exactly the "unreadable" a phone-sized backdrop
         also had to stop being; see the isMobileEra branch further down
         for what replaced both of them. Every word here just stays the
         plain DOM text it always was underneath the canvas. */
      var words = panels.map(function (p) {
        if (!p.getAttribute('data-fx-kind')) return [];
        return [].slice.call(p.querySelectorAll('.era__w')).map(function (el) {
          var glyph = fxType.makeKeyGlyph(el, p.getAttribute('data-fx-kind'));
          return glyph && { el: el, glyph: glyph, key: el.classList.contains('era__w--key') };
        }).filter(Boolean);
      });
      var headings = panels.map(function (p) { return p.querySelector('[data-fx-manual]'); });

      /* null, not 'before': lets the very first applyState() call for each
         panel actually write its class to the DOM instead of short-
         circuiting on "no change needed" — harmless either way visually
         (the CSS default already matches "before"), but keeps the DOM
         state legible for debugging rather than three panels silently
         relying on an implicit default. */
      var bodyState = panels.map(function () { return null; });

      /* ---- pointer interaction ------------------------------------------
         One shared target for the whole section, in viewport coordinates;
         each canvas converts it to its own local space only while it is
         actually being rendered, right below. */
      var ptr = { x: -9999, y: -9999, active: false };
      era.addEventListener('pointermove', function (e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true; kick(); });
      era.addEventListener('pointerleave', function () { ptr.active = false; });
      era.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') ptr.active = false; });
      era.addEventListener('pointercancel', function () { ptr.active = false; });

      var ptrFor = function (canvas) {
        if (!ptr.active) return null;
        var r = canvas.getBoundingClientRect();
        var rad = Math.max(24, Math.min(r.width, r.height) * 0.55 + 14);
        if (ptr.x < r.left - rad || ptr.x > r.right + rad || ptr.y < r.top - rad || ptr.y > r.bottom + rad) return null;
        return { x: ptr.x - r.left, y: ptr.y - r.top, r: rad, active: true };
      };

      /* ---- background layer: the animated gradient + the cursor's bubbles ---
         (the flow field that phones used to have is gone; see the git tag
         champ-de-bulles-mobile for it) */
      {
      /* ---- the animated gradient: the desktop backdrop ---------------------------
         "Animated Gradient" (Harsh Jadhav, Componentry, MIT; design-memory item
         backgrounds/animated-gradient) — its fragment shader, unchanged in the
         maths (three colours blended by a domain-warped pattern: noise-driven
         distortion, then a swirl of cos() iterations, then a checks / stripes /
         edge shape), ported from React to a plain WebGL2 canvas. Adapted:
         · three colours of THIS site (the page's ink, the teal its section always
           glowed with, the coral of the wordmark — _outils/etude-couleurs.py),
           mixed in OKLab, chosen so cream text keeps >= 8:1 on the brightest part;
         · drawn at the screen's pixel ratio (1.5 at most, ~3 Mpx at most), 30
           times a second; fewer swirl iterations; slower than the source's presets;
         · ordered dithering at the end: dark gradients band visibly in 8 bits;
         · it rests when the section is not on screen or the door is opening (the
           shared render loop).
         Without WebGL2 (or if the context is lost) nothing is drawn: the section's
         own ground (.era__sticky::before, two soft radial gradients in CSS) is what
         is seen, and the text stays readable on it. */
      var GRAD_PAL = { c1: '#0E1620', c2: '#1B4458', c3: '#A8441F' };
      var GRAD = {
        rotation: -30, proportion: 36, scale: 0.5, speed: 5, distortion: 22, swirl: 45, iterations: 6,
        softness: 100, offset: 120, shape: 0, shapeSize: 30     /* 0 checks, 1 stripes, 2 edge */
      };
      var GRAD_FS = '#version 300 es\n' +
        'precision highp float;\n' +
        'uniform float u_time; uniform float u_pixelRatio; uniform vec2 u_resolution;\n' +
        'uniform float u_scale, u_rotation, u_proportion, u_softness, u_shape, u_shapeScale, u_distortion, u_swirl, u_swirlIterations;\n' +
        'uniform vec3 u_color1, u_color2, u_color3;\n' +
        'out vec4 fragColor;\n' +
        '#define TWO_PI 6.28318530718\n' +
        '#define PI 3.14159265358979323846\n' +
        'vec2 rotate(vec2 uv, float th) { return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv; }\n' +
        'float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }\n' +
        'float noise(vec2 st) {\n' +
        '  vec2 i = floor(st); vec2 f = fract(st);\n' +
        '  float a = random(i); float b = random(i + vec2(1.0, 0.0)); float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));\n' +
        '  vec2 u = f * f * (3.0 - 2.0 * f);\n' +
        '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n' +
        '}\n' +
        'vec3 oklab_to_srgb(vec3 c) {\n' +
        '  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z; float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z; float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;\n' +
        '  float l = l_ * l_ * l_; float m = m_ * m_ * m_; float s = s_ * s_ * s_;\n' +
        '  vec3 rgb = clamp(vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0., 1.);\n' +
        '  return mix(12.92 * rgb, 1.055 * pow(rgb, vec3(1. / 2.4)) - 0.055, step(0.0031308, rgb));\n' +
        '}\n' +
        'vec3 blend_colors(vec3 c1, vec3 c2, vec3 c3, float mixer, float edgesWidth, float edge_blur) {\n' +
        '  float r1 = smoothstep(.0 + .35 * edgesWidth, .7 - .35 * edgesWidth + .5 * edge_blur, mixer);\n' +
        '  float r2 = smoothstep(.3 + .35 * edgesWidth, 1. - .35 * edgesWidth + edge_blur, mixer);\n' +
        '  return mix(mix(c1, c2, r1), c3, r2);\n' +
        '}\n' +
        'void main() {\n' +
        '  vec2 uv = gl_FragCoord.xy / u_resolution.xy;\n' +
        '  float t = .5 * u_time;\n' +
        '  float noise_scale = .0005 + .006 * u_scale;\n' +
        '  uv -= .5; uv *= (noise_scale * u_resolution); uv = rotate(uv, u_rotation * .5 * PI); uv /= u_pixelRatio; uv += .5;\n' +
        '  float n1 = noise(uv * 1. + t); float n2 = noise(uv * 2. - t);\n' +
        '  float angle = n1 * TWO_PI;\n' +
        '  uv.x += 4. * u_distortion * n2 * cos(angle); uv.y += 4. * u_distortion * n2 * sin(angle);\n' +
        '  float iterations_number = ceil(clamp(u_swirlIterations, 1., 30.));\n' +
        '  for (float i = 1.; i <= iterations_number; i++) {\n' +
        '    uv.x += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1.5 * uv.y);\n' +
        '    uv.y += clamp(u_swirl, 0., 2.) / i * cos(t + i * 1. * uv.x);\n' +
        '  }\n' +
        '  float proportion = clamp(u_proportion, 0., 1.);\n' +
        '  float shape = 0.; float mixer = 0.;\n' +
        '  if (u_shape < .5) {\n' +
        '    vec2 s_uv = uv * (.5 + 3.5 * u_shapeScale);\n' +
        '    shape = .5 + .5 * sin(s_uv.x) * cos(s_uv.y);\n' +
        '    mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);\n' +
        '  } else if (u_shape < 1.5) {\n' +
        '    vec2 s_uv = uv * (.25 + 3. * u_shapeScale);\n' +
        '    float f = fract(s_uv.y);\n' +
        '    shape = smoothstep(.0, .55, f) * smoothstep(1., .45, f);\n' +
        '    mixer = shape + .48 * sign(proportion - .5) * pow(abs(proportion - .5), .5);\n' +
        '  } else {\n' +
        '    float sh = 1. - uv.y; sh -= .5; sh /= (noise_scale * u_resolution.y); sh += .5;\n' +
        '    float shape_scaling = .2 * (1. - u_shapeScale);\n' +
        '    shape = smoothstep(.45 - shape_scaling, .55 + shape_scaling, sh + .3 * (proportion - .5));\n' +
        '    mixer = shape;\n' +
        '  }\n' +
        '  vec3 col = oklab_to_srgb(blend_colors(u_color1, u_color2, u_color3, mixer, 1. - clamp(u_softness, 0., 1.), .01 + .01 * u_scale));\n' +   /* mixed in OKLab, shown in sRGB */
        '  col += (random(gl_FragCoord.xy) - .5) / 255.;\n' +   /* dithering: no banding in the darks */
        '  fragColor = vec4(col, 1.);\n' +
        '}\n';
      var gradCanvas = null, gradGl = null, gradU = null, gradOK = false, gradLast = 0, gradT0 = 0;
      var gradRgb = function (hex) {   /* hex -> OKLab (the shader mixes there: a blend of blue-green and coral stays one colour's brightness, not a muddy sRGB midpoint) */
        var n = parseInt(hex.slice(1), 16), lin = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
        var r = lin(n >> 16 & 255), g = lin(n >> 8 & 255), b = lin(n & 255);
        var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
      };
      var gradInit = function () {
        try {
          var cv = doc.createElement('canvas');
          cv.className = 'era__aurora era__aurora--grad';
          cv.setAttribute('aria-hidden', 'true');
          var gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
          if (!gl) return;
          var mk = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
          var vs = mk(gl.VERTEX_SHADER, '#version 300 es\nin vec4 a_position;\nvoid main() { gl_Position = a_position; }');
          var fs = mk(gl.FRAGMENT_SHADER, GRAD_FS);
          if (!vs || !fs) return;
          var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
          if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
          gl.useProgram(pr);
          var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
          var loc = gl.getAttribLocation(pr, 'a_position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          var names = ['u_time', 'u_pixelRatio', 'u_resolution', 'u_scale', 'u_rotation', 'u_proportion', 'u_softness', 'u_shape', 'u_shapeScale', 'u_distortion', 'u_swirl', 'u_swirlIterations', 'u_color1', 'u_color2', 'u_color3'];
          gradU = {}; names.forEach(function (k) { gradU[k] = gl.getUniformLocation(pr, k); });
          var c1 = gradRgb(GRAD_PAL.c1), c2 = gradRgb(GRAD_PAL.c2), c3 = gradRgb(GRAD_PAL.c3);
          gl.uniform3f(gradU.u_color1, c1[0], c1[1], c1[2]); gl.uniform3f(gradU.u_color2, c2[0], c2[1], c2[2]); gl.uniform3f(gradU.u_color3, c3[0], c3[1], c3[2]);
          gl.uniform1f(gradU.u_scale, GRAD.scale); gl.uniform1f(gradU.u_rotation, GRAD.rotation * Math.PI / 180);
          gl.uniform1f(gradU.u_proportion, GRAD.proportion / 100); gl.uniform1f(gradU.u_softness, GRAD.softness / 100);
          gl.uniform1f(gradU.u_shape, GRAD.shape); gl.uniform1f(gradU.u_shapeScale, GRAD.shapeSize / 100);
          gl.uniform1f(gradU.u_distortion, GRAD.distortion / 50); gl.uniform1f(gradU.u_swirl, GRAD.swirl / 100);
          gl.uniform1f(gradU.u_swirlIterations, GRAD.iterations);
          cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gradOK = false; era.classList.remove('era--grad'); cv.style.display = 'none'; });
          era.querySelector('.era__sticky').insertBefore(cv, era.querySelector('.era__stage'));
          gradCanvas = cv; gradGl = gl; gradOK = true; gradT0 = 0;
          era.classList.add('era--grad');
        } catch (e) { gradOK = false; }
      };
      var drawGrad = function (now) {
        if (!gradOK) return;
        if (now - gradLast < 30) return;     /* 30 times a second: it is a slow, soft field */
        gradLast = now;
        var cw = gradCanvas.clientWidth, ch = gradCanvas.clientHeight;
        /* drawn at the screen's own pixel ratio (1.5 at most: a gradient this soft needs no more),
           and never more than ~3 million pixels, so a huge screen is drawn smaller and upsampled
           smoothly rather than slowly */
        var gres = Math.min(Math.min(window.devicePixelRatio || 1, 1.5), Math.sqrt(3.2e6 / Math.max(1, cw * ch)));
        var w = Math.max(2, Math.round(cw * gres)), h = Math.max(2, Math.round(ch * gres));
        if (gradCanvas.width !== w || gradCanvas.height !== h) { gradCanvas.width = w; gradCanvas.height = h; gradGl.viewport(0, 0, w, h); gradGl.uniform1f(gradU.u_pixelRatio, gres); }
        if (!gradT0) gradT0 = now;
        gradGl.uniform1f(gradU.u_time, (now - gradT0) / 1000 * (GRAD.speed / 100) * 5 + GRAD.offset * 0.01);
        gradGl.uniform2f(gradU.u_resolution, w, h);
        gradGl.drawArrays(gradGl.TRIANGLES, 0, 6);
      };
      gradInit();

      /* ---- hover bubbles on the water -------------------------------------
         The same bubble sprites a hovered word gets (fxType.getSprites().
         bubbles — the very images drawParticles paints words with) spawned
         at the cursor over the gradient backdrop instead of sampled from a
         glyph, so hovering the water gets the same kind of reaction
         hovering the text already had. Its own small canvas rather than a
         reuse of drawParticles itself: that function ages a whole array off
         ONE shared clock, built for a word sampled once — fine there, but
         this is a continuous trail where every bubble is born at its own
         moment, which fits a short-lived, self-contained loop better than
         bending drawParticles' shared-evap model to a spawner. A z-index
         above the gradient (telaventis-fx.css) keeps it visible. */
      var rippleCanvas = doc.createElement('canvas');
      rippleCanvas.className = 'era__ripple';
      rippleCanvas.setAttribute('aria-hidden', 'true');
      era.querySelector('.era__sticky').insertBefore(rippleCanvas, era.querySelector('.era__stage'));
      var rippleCtx = rippleCanvas.getContext('2d');
      var ripplePal = fxType.getSprites().bubbles;
      var rippleParticles = [];
      var rippleLastSpawn = 0;
      var RIPPLE_LIFE = 1.1;

      var renderRipple = function (now) {
        var w = rippleCanvas.clientWidth, h = rippleCanvas.clientHeight;
        if (!w || !h) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var pxW = Math.round(w * dpr), pxH = Math.round(h * dpr);
        if (rippleCanvas.width !== pxW || rippleCanvas.height !== pxH) {
          rippleCanvas.width = pxW; rippleCanvas.height = pxH;
        }
        rippleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var t = now / 1000;

        /* a couple more, roughly two dozen times a second, wherever the
           pointer actually is — same rect-check idea as ptrFor() above,
           just against this canvas instead of a word's */
        var r = rippleCanvas.getBoundingClientRect();
        var inBounds = ptr.active && ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom;
        if (inBounds && t - rippleLastSpawn > 0.045) {
          rippleLastSpawn = t;
          rippleParticles.push({
            x: (ptr.x - r.left) + (Math.random() - 0.5) * 16,
            y: (ptr.y - r.top) + (Math.random() - 0.5) * 16,
            s: 8 + Math.random() * 12,
            ph: Math.random() * Math.PI * 2,
            sp: ripplePal[(Math.random() * ripplePal.length) | 0],
            born: t, a: 0.55 + Math.random() * 0.25
          });
        }

        rippleCtx.clearRect(0, 0, w, h);
        var kept = [];
        for (var ri = 0; ri < rippleParticles.length; ri++) {
          var p = rippleParticles[ri];
          var age = t - p.born;
          if (age > RIPPLE_LIFE) continue;
          kept.push(p);
          var u = age / RIPPLE_LIFE;
          /* quick fade in, slower fade out — the same shape drawParticles'
             own evap uses for the text-bubble dissolve, just carried by
             each particle's own age instead of one value shared by all */
          var alpha = p.a * Math.min(u / 0.12, 1) * (1 - easeOutCubic(u));
          if (alpha <= 0.004) continue;
          var rise = u * 22;
          var sc = p.s * (0.85 + 0.15 * Math.sin(t * 3 + p.ph));
          rippleCtx.save();
          rippleCtx.globalAlpha = alpha;
          rippleCtx.translate(p.x, p.y - rise);
          rippleCtx.drawImage(p.sp, -sc / 2, -sc / 2, sc, sc);
          rippleCtx.restore();
        }
        rippleParticles = kept;
      };

      }

      /* How long a departed panel's bubble words keep dissolving after the
         panel itself starts fading — matched to .era__body's own opacity
         duration in telaventis-fx.css (see the comment there) and close to
         the bubbles' flight to the next phrase, so the fade and the
         rise-and-scatter read as one beat and not two separate cuts. Brought down from an
         earlier, more deliberate 1.4s that ended up reading as sluggish —
         this is still real time, not scroll-scrubbed, so it always plays
         out at this same pace regardless of how fast the visitor scrolled
         to trigger it; only the pace itself changed. */
      /* ---- 3c. one field of bubbles --------------------------------------
         Every bubble word in this section lives on ONE canvas over the
         stage, as one population of particles that never changes state.
         At rest they sit packed tight inside their letters, breathing a
         little on a global clock. When the phrase changes, the very same
         particles lift off and fly (each on its own arc and delay, left to
         right like a gust) to places in the letters of the next phrase's
         words, and simply come to rest there; on the last phrase they fly
         into the serif heading, which rises out of them as they fade.
         Scrolling back plays it the other way. On first arrival they rise
         from the bottom of the screen, bubbles coming up from the deep.
         There is no hand-over anywhere: an earlier version flew the
         particles on a separate canvas and then passed the word back to
         its own per-word canvas, and that swap was a visible flash. The
         per-word canvases now only serve as samplers (their pixels are
         never shown), and the key words' own letters are never painted
         while the section is live (telaventis-fx.css), so nothing but the
         bubbles ever stands for those words.
         Pairing is deliberately simple: both clouds sorted along a shallow
         diagonal and matched by rank, so letters travel to letters in
         reading order instead of crossing in a tangle. */
      var sticky = era.querySelector('.era__sticky');
      var morphCanvas = doc.createElement('canvas');
      morphCanvas.className = 'era__morph';
      morphCanvas.setAttribute('aria-hidden', 'true');
      sticky.appendChild(morphCanvas);
      var morphCtx = morphCanvas.getContext('2d');
      var bubblePal = fxType.getSprites().bubbles;
      var MORPH_MS = 1250;
      var MORPH_CAP = isMobileEra ? 1500 : 2800;
      var morph = null;          /* the flight in progress, or null at rest */
      var live = [];             /* the particles at rest (stage coordinates) */
      var liveOf = -1;           /* which panel `live` spells */
      var headingTimer = 0;

      /* the breath every particle shares, on the global clock — applied in
         full at rest and faded in along a flight, so a landing is exactly
         the resting position at that instant (no step, ever) */
      var breathX = function (q, t) { return Math.sin(t * 0.55 + q.ph) * q.s * 0.12; };
      var breathY = function (q, t) { return Math.sin(t * 0.42 + q.ph * 1.7) * q.s * 0.10; };
      var breathS = function (q, t) { return 1 + 0.03 * Math.sin(t * 1.9 + q.ph); };

      var sampleHeading = function (el, box) {
        var cs = getComputedStyle(el);
        var fs = parseFloat(cs.fontSize) || 60;
        var lines = el.querySelectorAll('.fx-line');
        if (!lines.length) lines = [el];
        var step = Math.max(2.4, fs * 0.052);
        var out = [];
        var off = doc.createElement('canvas');
        var octx = off.getContext('2d', { willReadFrequently: true });
        [].forEach.call(lines, function (ln) {
          var r = ln.getBoundingClientRect();
          var text = ln.textContent.replace(/\s+/g, ' ').trim();
          if (!text || r.width < 4 || r.height < 4) return;
          off.width = Math.ceil(r.width); off.height = Math.ceil(r.height);
          octx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
          if ('letterSpacing' in octx) octx.letterSpacing = cs.letterSpacing;
          octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillStyle = '#fff';
          octx.fillText(text, off.width / 2, off.height / 2 + fs * 0.03);
          var d = octx.getImageData(0, 0, off.width, off.height).data;
          for (var y = 0; y < off.height; y += step) {
            for (var x = 0; x < off.width; x += step) {
              if (d[((y | 0) * off.width + (x | 0)) * 4 + 3] > 128) {
                out.push({ x: r.left - box.left + x, y: r.top - box.top + y, s: step * 1.05, sp: bubblePal[(Math.random() * bubblePal.length) | 0] });
              }
            }
          }
        });
        return out;
      };

      /* where panel i's bubbles belong, in stage coordinates. Key words are
         measured from the WORD's box (their own canvases are display:none
         now and would measure 0). */
      var cloudOf = function (i) {
        var box = sticky.getBoundingClientRect();
        var out = [];
        if (i < 0) return out;
        if (kinds[i] && words[i].length) {
          words[i].forEach(function (w) {
            if (!w.key || !w.glyph.ensure()) return;
            var r = w.el.getBoundingClientRect();
            w.glyph.particles.forEach(function (pt) {
              out.push({ x: r.left - box.left + pt.x, y: r.top - box.top + pt.y, s: pt.s, sp: pt.sp });
            });
          });
          return out;
        }
        return headings[i] ? sampleHeading(headings[i], box) : out;
      };

      var restSig = '';
      /* where this panel's key words (or its heading) are on the screen right now: if
         it changes while the bubbles rest (a phone's address bar sliding in or out
         changes the height the text is centred in; a font landing; a rotation), they
         are put back on the words instead of staying where the words used to be */
      var sigOf = function (i) {
        var b = sticky.getBoundingClientRect(), sg = [b.left | 0, b.top | 0, b.width | 0, b.height | 0];
        if (kinds[i]) words[i].forEach(function (w) { if (w.key) { var r = w.el.getBoundingClientRect(); sg.push(r.left | 0, r.top | 0); } });
        else if (headings[i]) { var hr = headings[i].getBoundingClientRect(); sg.push(hr.left | 0, hr.top | 0); }
        return sg.join(',');
      };
      var restAt = function (cloud, i) {
        var old = live;
        live = cloud.map(function (c, k) { return { x: c.x, y: c.y, s: c.s, sp: c.sp, ph: c.ph != null ? c.ph : (old.length === cloud.length && liveOf === i && old[k] ? old[k].ph : Math.random() * 6.283) }; });
        liveOf = i;
        restSig = sigOf(i);
      };

      var startMorph = function (from, to, now) {
        if (!morphCtx || from === to) return false;
        var t = now / 1000;
        var H = sticky.clientHeight || 800, W = sticky.clientWidth || 1;
        var dst = kinds[to] ? cloudOf(to) : (headings[to] ? cloudOf(to) : []);
        if (!dst.length) { live = []; liveOf = -1; return false; }
        var src, rising = false;
        if (live.length && liveOf === from) {
          /* take off from exactly where each resting bubble is right now */
          src = live.map(function (q) { return { x: q.x + breathX(q, t), y: q.y + breathY(q, t), s: q.s * breathS(q, t), sp: q.sp, ph: q.ph }; });
        } else if (from >= 0 && !kinds[from]) {
          src = cloudOf(from);                      /* out of the heading */
        } else {
          /* first arrival: up from below the screen, spread wide */
          rising = true;
          src = dst.map(function (d) {
            return { x: d.x + (Math.random() - 0.5) * W * 0.9, y: H + 20 + Math.random() * H * 0.35, s: d.s * (0.4 + Math.random() * 0.5), sp: d.sp };
          });
        }
        if (!src.length) return false;
        var rank = function (u, v) { return (u.x + u.y * 0.35) - (v.x + v.y * 0.35); };
        src.sort(rank); dst.sort(rank);
        var N = Math.min(MORPH_CAP, Math.max(src.length, dst.length));
        var parts = new Array(N);
        for (var k = 0; k < N; k++) {
          var a = src[Math.floor(k * src.length / N)];
          var b = dst[Math.floor(k * dst.length / N)];
          var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
          /* each flight bends to one side of its straight line, mostly
             upward, the way a gust lifts before it sets things down */
          var bend = (Math.random() - 0.3) * Math.min(300, len * 0.5);
          parts[k] = {
            ax: a.x, ay: a.y, as: a.s, x: b.x, y: b.y, s: b.s,
            cx: (a.x + b.x) / 2 - dy / len * bend,
            cy: (a.y + b.y) / 2 + dx / len * bend - Math.min(160, len * 0.18),
            sp: Math.random() < 0.5 ? a.sp : b.sp,
            delay: (a.x / W) * 0.24 + Math.random() * 0.14,
            ph: a.ph != null ? a.ph : Math.random() * 6.283
          };
        }
        live = []; liveOf = -1;
        morph = { parts: parts, t0: now, to: to, toHeading: !kinds[to], dur: rising ? MORPH_MS * 1.3 : MORPH_MS };
        return true;
      };

      /* land whatever is in flight, instantly and in place */
      var endMorph = function () {
        if (!morph) return;
        /* landed: the resting places are read from the words as they are NOW, not
           from where they were when the flight began */
        if (!morph.toHeading) { var landed = morph.to; morph = null; restAt(cloudOf(landed), landed); return; }
        morph = null;
      };

      var fieldTick = 0;
      var renderField = function (now) {
        if (!morphCtx) return false;
        /* at rest the bubbles only breathe, slowly: drawn every other frame (the
           canvas keeps what was drawn); a flight or the pointer gets every frame */
        fieldTick++;
        if (!morph && live.length && liveOf >= 0 && (fieldTick & 7) === 0 && sigOf(liveOf) !== restSig) restAt(cloudOf(liveOf), liveOf);
        if (!morph && !ptr.active && live.length && (fieldTick & 1)) return true;
        var w = morphCanvas.clientWidth, h = morphCanvas.clientHeight;
        if (!w || !h) return false;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
        if (morphCanvas.width !== pw || morphCanvas.height !== ph) { morphCanvas.width = pw; morphCanvas.height = ph; }
        morphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        morphCtx.clearRect(0, 0, w, h);
        var t = now / 1000, k, q;
        if (morph) {
          var T = (now - morph.t0) / morph.dur;
          /* into the heading: the bubbles give way to the real letters as
             they rise (the heading's own fx-split, triggered at ~55%) */
          var fade = morph.toHeading ? 1 - clamp((T - 0.62) / 0.34, 0, 1) : 1;
          for (k = 0; k < morph.parts.length; k++) {
            q = morph.parts[k];
            var u = clamp((T - q.delay) / 0.62, 0, 1);
            var e = easeInOutCubic(u), ie = 1 - e;
            var sw = Math.sin(Math.PI * e);
            var x = ie * ie * q.ax + 2 * ie * e * q.cx + e * e * q.x + breathX(q, t) * e;
            var y = ie * ie * q.ay + 2 * ie * e * q.cy + e * e * q.y + breathY(q, t) * e;
            x += Math.sin(q.ph + t * 9) * 3 * sw;
            var sz = (q.as + (q.s - q.as) * e) * (1 + 0.45 * sw) * (1 + (breathS(q, t) - 1) * e);
            morphCtx.globalAlpha = (0.72 + 0.28 * (1 - sw)) * fade;
            morphCtx.drawImage(q.sp, x - sz / 2, y - sz / 2, sz, sz);
          }
          morphCtx.globalAlpha = 1;
          if (T >= 1) endMorph();
          return true;
        }
        if (!live.length) return false;
        /* at rest: the same particles, the same breath, plus the pointer's
           soft push (distance-decayed, no memory) */
        var box = sticky.getBoundingClientRect();
        var px = ptr.active ? ptr.x - box.left : -1e5, py = ptr.active ? ptr.y - box.top : -1e5;
        var R = isMobileEra ? 54 : 78;
        for (k = 0; k < live.length; k++) {
          q = live[k];
          var rx = q.x + breathX(q, t), ry = q.y + breathY(q, t);
          var ddx = rx - px, ddy = ry - py, dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd < R && dd > 0.01) { var push = (1 - dd / R) * R * 0.5; rx += ddx / dd * push; ry += ddy / dd * push; }
          var ss = q.s * breathS(q, t);
          morphCtx.drawImage(q.sp, rx - ss / 2, ry - ss / 2, ss, ss);
        }
        return true;
      };

      /* ---- 3d. the exit: the canvas is cut open onto the next section -----
         The last phrase ends on "...si l'on pousse la porte." — and then the
         door opens. After the three phrases the track runs on for one more
         screen (TAIL_VH): over that stretch a spindle-shaped slit, the same
         diagonal as the wordmark cut and Fontana's "tagli", opens across the
         whole pinned scene, from a hairline to the full screen; the scene
         behind it pushes a little closer as it opens, the way a room seems
         to come at you as you step through a door; and inside the slit is
         the next section's own world: the cream page and the Moka story's
         title, lifted out of #direction-lab so it is the thing the cut
         reveals. When the slit has covered everything, the pinned scene
         scrolls away and the Moka story continues below exactly where the
         cream already is — no seam at all.
         No JS / reduced motion: none of this exists, the title stays in its
         own section and the two sections simply follow each other. */
      /* the tail after the last phrase: its first ~55% is a pause (the last
         sentence stays on screen, readable, a full screen of scroll longer),
         then the door opens */
      var TAIL_VH = 1.8;
      var CUT_AT = 0.55;
      var cut = null, cutIn = null, cutQ = -1;
      var mokaIntro = doc.querySelector('#direction-lab .moka-story__intro');
      if (mokaIntro && era.nextElementSibling && era.nextElementSibling.id === 'direction-lab') {
        cut = doc.createElement('div');
        cut.className = 'era__cut';
        cut.setAttribute('aria-hidden', 'true');
        cutIn = doc.createElement('div');
        cutIn.className = 'era__cut-in';
        var introClone = mokaIntro.cloneNode(true);
        [].forEach.call(introClone.querySelectorAll('[data-reveal],[data-ink]'), function (n) { n.removeAttribute('data-reveal'); n.removeAttribute('data-ink'); });
        /* the title arrives like the home headline once the door is open
           (letters settling from thin and wide to heavy): split it into
           words and letters now, lock its lines at the moment it plays */
        var cutTitle = introClone.querySelector('.moka-story__title');
        if (cutTitle) {
          var ci = 0;
          var parts = cutTitle.textContent.split(/( +)/);
          cutTitle.textContent = '';
          parts.forEach(function (tok) {
            if (!tok) return;
            if (/^ +$/.test(tok)) { cutTitle.appendChild(doc.createTextNode(' ')); return; }
            var w = doc.createElement('span'); w.className = 'wt-w';
            Array.prototype.forEach.call(tok, function (ch) {
              var c = doc.createElement('span'); c.className = 'wt-c'; c.textContent = ch;
              c.style.setProperty('--i', ci++); w.appendChild(c);
            });
            cutTitle.appendChild(w);
          });
        }
        cutIn.appendChild(introClone);
        cut.appendChild(cutIn);
        sticky.appendChild(cut);
        /* the original stays in the DOM for the accessibility tree and for
           any path where this never runs; visually it has moved into the cut */
        mokaIntro.parentNode.classList.add('is-hoisted');
      }
      /* The slit is not tied to the scroll position at all. Scroll only
         crosses a line — a few percent into the tail it opens, back above
         it it closes — and the opening then plays whole, on its own clock:
         1.1s, eased in and out, the same every time whatever the scroll
         speed (it follows nothing, so nothing can make it stutter). Only if
         the visitor has already scrolled the pinned scene away before it
         finished does it hurry (0.35s), so a half-open door never slides
         off the screen. At the moment it opens, the last phrase comes apart
         into bubbles that are drawn into the slit (the same particle field
         as §3c, flying to points along the cut's axis and fading as they
         reach it), so the sentence about pushing the door literally goes
         through it. The slit's edges are slightly irregular — cut canvas,
         not a vector wedge. */
      var cutOpen = 0, cutGoal = 0, cutPainted = -1, cutTw = null;
      var CUT_MS = 1100;
      var axisOf = function (W, H) {
        var ax = -0.55 * W, ay = 0.66 * H, bx = 1.55 * W, by = 0.34 * H;
        var dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy);
        return { ax: ax, ay: ay, dx: dx, dy: dy, L: L, nx: -dy / L, ny: dx / L };
      };
      var paintCut = function (e) {
        if (Math.abs(e - cutPainted) < 0.0005) return;
        cutPainted = e;
        /* the section leans in as the door opens. This used to be a CSS variable
           on the whole pinned scene, re-resolved by every element under it, every
           frame, with calc() on six full-screen layers; now one inline transform
           on each of those layers (they are composited: no style cascade, no
           repaint) and the variable lives only on the door itself. */
        cut.style.setProperty('--cut', e.toFixed(4));
        var leanTo = e > 0.0005 ? 'scale(' + (1 + e * 0.16).toFixed(4) + ')' : '';
        for (var ci = 0; ci < sticky.children.length; ci++) {
          var kid = sticky.children[ci];
          if (/\bera__(stage|aurora|ripple|morph)\b/.test(kid.className)) kid.style.transform = leanTo;
        }
        if (e <= 0.0005) { cut.style.visibility = 'hidden'; return; }
        cut.style.visibility = 'visible';
        /* the spring only approaches 1; past 98.5% the door is simply open */
        if (e >= 0.985) { cutIn.style.clipPath = 'none'; return; }
        var W = sticky.clientWidth, H = sticky.clientHeight, g = axisOf(W, H);
        /* open exactly as wide as this screen needs: the half-width at which
           the last corner is covered, from each corner's distance to the
           axis and the spindle's profile there */
        var need = 0;
        [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (c) {
          var t = ((c[0] - g.ax) * g.dx + (c[1] - g.ay) * g.dy) / (g.L * g.L);
          var dist = Math.abs((c[0] - g.ax) * g.nx + (c[1] - g.ay) * g.ny);
          need = Math.max(need, dist / Math.max(0.05, Math.pow(Math.sin(Math.PI * t), 0.75)));
        });
        var half = need * 1.1 * e;
        var N = 30, top = [], bot = [];
        for (var k = 0; k <= N; k++) {
          var t = k / N, px = g.ax + g.dx * t, py = g.ay + g.dy * t;
          var w = half * Math.pow(Math.sin(Math.PI * t), 0.75);
          /* torn edges: a fixed, position-based irregularity (never animated,
             so the tear holds its shape), different on each lip */
          var tear = Math.min(w * 0.035, 7);
          var wt = w + tear * (Math.sin(t * 23 + 1.3) * 0.65 + Math.sin(t * 47) * 0.35);
          var wb = w + tear * (Math.sin(t * 29 + 4.1) * 0.65 + Math.sin(t * 53 + 2) * 0.35);
          top.push((px + g.nx * wt).toFixed(1) + 'px ' + (py + g.ny * wt).toFixed(1) + 'px');
          bot.push((px - g.nx * wb).toFixed(1) + 'px ' + (py - g.ny * wb).toFixed(1) + 'px');
        }
        cutIn.style.clipPath = 'polygon(' + top.concat(bot.reverse()).join(',') + ')';
      };
      /* the last phrase dissolves into the slit */
      var lastHeading = headings[n - 1];
      var intoCut = function (now) {
        clearTimeout(headingTimer);
        if (!lastHeading || !lastHeading.classList.contains('is-in') || !morphCtx) return;
        endMorph();
        var box = sticky.getBoundingClientRect();
        var src = sampleHeading(lastHeading, box);
        lastHeading.classList.remove('is-in');
        if (!src.length) return;
        var W = sticky.clientWidth, H = sticky.clientHeight, g = axisOf(W, H);
        var tMin = 0.55 / 2.1, tMax = 1.55 / 2.1;   /* the on-screen stretch of the axis */
        var N = Math.min(Math.min(MORPH_CAP, 1400), src.length), parts = new Array(N);   /* the dissolve into the slit is seen for a second, behind the door's own cost: 1400 bubbles are plenty */
        for (var k = 0; k < N; k++) {
          var a = src[Math.floor(k * src.length / N)];
          var t = tMin + (tMax - tMin) * ((a.x / W) * 0.8 + Math.random() * 0.2);
          var jit = (Math.random() - 0.5) * 18;
          var bx = g.ax + g.dx * t + g.nx * jit, by = g.ay + g.dy * t + g.ny * jit;
          parts[k] = { ax: a.x, ay: a.y, as: a.s, x: bx, y: by, s: a.s * 0.5,
            cx: (a.x + bx) / 2 + (Math.random() - 0.5) * 120, cy: Math.min(a.y, by) - 40 - Math.random() * 80,
            sp: a.sp, delay: Math.random() * 0.25, ph: Math.random() * 6.283 };
        }
        live = []; liveOf = -1;
        morph = { parts: parts, t0: now, to: n - 1, toHeading: true, dur: 1150 };
      };
      /* ---- no speedrun: the door and the title play out whole ----------
         Once the slit starts to open, scroll is held — wheel, touch and the
         scrolling keys are ignored and the position pinned — until the Moka
         title and its line have finished arriving (~2.5s), then released.
         A fling that already carried past the trigger is brought back to it
         first, so the sequence is always seen from the start. Never engaged
         by a jump (an anchor link skips the section entirely: this only
         runs while the section is on screen), and a 4s safety net releases
         it whatever happens. The hold itself is overflow:hidden on the page
         (telaventis-fx.css): the only thing that stops a wheel gesture or an
         iOS momentum fling already under way; the listeners below catch the
         rest (keys, the first wheel/touch event). */
      var lockY = null, lockTimer = 0;
      var SCROLL_KEYS = { ' ': 1, Spacebar: 1, PageDown: 1, PageUp: 1, ArrowDown: 1, ArrowUp: 1, End: 1, Home: 1 };
      /* a non-passive wheel/touchmove listener on the window makes the
         browser wait for this script before it scrolls ANYTHING, anywhere on
         the page, for as long as it is attached: so it is attached only
         while the hold runs (lockScroll / unlockScroll, below) */
      var stopIt = function (e) { if (lockY !== null && e.cancelable) e.preventDefault(); };
      var stopOn = false;
      var setStop = function (on) {
        if (on === stopOn) return;
        stopOn = on;
        var m = on ? 'addEventListener' : 'removeEventListener';
        window[m]('wheel', stopIt, { passive: false });
        window[m]('touchmove', stopIt, { passive: false });
      };
      window.addEventListener('keydown', function (e) {
        if (lockY !== null && SCROLL_KEYS[e.key] && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.preventDefault();
      });
      window.addEventListener('scroll', function () {
        if (lockY !== null && Math.abs(window.scrollY - lockY) > 1) window.scrollTo({ top: lockY, behavior: 'instant' });
      }, { passive: true });
      /* a jump through an in-page link (smooth-scrolled by the site's CSS)
         passes through this section on its way: it is travel, not reading,
         so the hold stays off for the length of the trip */
      var jumpUntil = 0;
      doc.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href*="#"]');
        if (a && a.pathname === location.pathname && a.hash) jumpUntil = performance.now() + 2500;
      });
      window.addEventListener('hashchange', function () { jumpUntil = performance.now() + 2500; });
      var unlockScroll = function () {
        lockY = null;
        setStop(false);
        clearTimeout(lockTimer);
        html.classList.remove('fx-scroll-held');
      };
      var lockScroll = function (y) {
        lockY = Math.round(y);
        window.scrollTo({ top: lockY, behavior: 'instant' });
        setStop(true);
        html.classList.add('fx-scroll-held');
        clearTimeout(lockTimer);
        lockTimer = setTimeout(unlockScroll, 4000);
      };

      var cutArrived = false;
      var arriveCut = function () {
        if (cutArrived) return;
        cutArrived = true;
        var t = cutIn.querySelector('.moka-story__title');
        if (t && !t.querySelector('.wt-line')) {
          /* lock each rendered line (the letters change width as they settle) */
          var lines = [], last = null;
          Array.prototype.forEach.call(t.querySelectorAll('.wt-w'), function (w) {
            if (last === null || Math.abs(w.offsetTop - last) > 4) { lines.push([]); last = w.offsetTop; }
            lines[lines.length - 1].push(w);
          });
          t.textContent = '';
          lines.forEach(function (ws) {
            var ln = doc.createElement('span'); ln.className = 'wt-line';
            ws.forEach(function (w, k) { if (k) ln.appendChild(doc.createTextNode(' ')); ln.appendChild(w); });
            t.appendChild(ln);
          });
        }
        cutIn.classList.add('is-arrived');
        /* release once the last letter has landed and the line has risen */
        var letters = cutIn.querySelectorAll('.wt-c').length;
        clearTimeout(lockTimer);
        lockTimer = setTimeout(unlockScroll, Math.max(letters * 16 + 1000, 1350) + 150);
      };
      var tweenCut = function (goal, now, ms) {
        if (goal === 0) { cutArrived = false; cutIn.classList.remove('is-arrived'); }
        cutGoal = goal;
        cutTw = { from: cutOpen, to: goal, t0: now, dur: Math.max(120, ms * Math.abs(goal - cutOpen)) };
      };
      var updateCut = function (q, now, yAt) {
        if (!cut) return;
        if (!cutGoal && q > CUT_AT) {
          /* bring an overshooting fling back to just past the line (not
             during an in-page jump) */
          if (performance.now() > jumpUntil) {
            /* the last phrase gets its time too: after a hard fling the door used to
               open the instant the phrase had landed. The page is held at the line
               until the phrase has been there STEP_COOLDOWN_MS, then the door opens */
            if (now - lastStepAt < STEP_COOLDOWN_MS) {
              if (lockY === null) lockScroll(q > CUT_AT + 0.12 ? yAt(CUT_AT + 0.04) : window.scrollY);
              return paintCut(cutOpen);
            }
            lockScroll(q > CUT_AT + 0.12 ? yAt(CUT_AT + 0.04) : window.scrollY);
          }
          tweenCut(1, now, CUT_MS); intoCut(now);
        }
        else if (cutGoal && q < CUT_AT - 0.06) {
          tweenCut(0, now, CUT_MS * 0.8);
          if (lastHeading && bodyState[n - 1] === 'active') { lastHeading.style.setProperty('--fx-dir', '-1'); lastHeading.classList.add('is-in'); }
        }
        /* the pinned scene is already leaving and the door is not open yet:
           finish quickly rather than scroll a half-open slit off the screen */
        if (cutGoal && q >= 1 && cutTw && cutTw.dur > 400 && cutOpen < 1) tweenCut(1, now, 350);
        if (cutTw) {
          var u = clamp((now - cutTw.t0) / cutTw.dur, 0, 1);
          cutOpen = cutTw.from + (cutTw.to - cutTw.from) * easeInOutCubic(u);
          if (u >= 1) { cutTw = null; if (cutGoal === 1) arriveCut(); }
        }
        paintCut(cutOpen);
      };

      /* sample every key word now, before any panel is shown, and mark it
         as drawn by its canvas: from here on its letters are never the
         thing on screen. A word that cannot be sampled keeps its text. */
      var prebuildOne = function (w) {
        if (w.glyph.ensure()) { w.glyph.reveal(true); w.el.classList.remove('fx-type-fail'); }
        else w.el.classList.add('fx-type-fail');
      };
      var keyWords = [];
      words.forEach(function (list) { list.forEach(function (w) { if (w.key) keyWords.push(w); }); });
      var prebuild = function () { keyWords.forEach(prebuildOne); };
      /* Sampling the key words (a canvas each, read back pixel by pixel) is
         ~270 ms of main thread in all, and it used to run in the first second
         of the visit — in the middle of the headline's arrival, which is what
         made that arrival stutter on a first, uncached visit (everything is
         late then, so everything piles up in the same frames). The section is
         a screen and a half below the fold; nothing needs these words until
         someone gets there. So: one word per task, starting once the headline
         has landed (WARM_AT ms after the page began) and the browser is idle,
         never in one block. If the visitor is already on their way to the
         section (render(), below) whatever is left is done at once, before
         the section can be seen: its key words stay invisible (the canvas
         stands for them) until they are built, so they must be. */
      var WARM_AT = 3200, warmed = false, warmDirty = false, warmRunning = false;
      var warmNow = function () { if (!warmed) { prebuild(); warmed = true; } };
      var warmSlices = function (remeasure) {
        if (warmRunning) { warmDirty = warmDirty || remeasure; return; }
        warmRunning = true;
        var i = 0;
        (function step() {
          if (warmed && !remeasure) { warmRunning = false; return; }
          if (i >= keyWords.length) {
            warmed = true; warmRunning = false;
            if (!morph && liveOf >= 0) restAt(cloudOf(liveOf), liveOf);
            kick();
            if (warmDirty) { warmDirty = false; warmSlices(true); }
            return;
          }
          var w = keyWords[i++];
          if (remeasure) w.glyph.remeasure(true);
          prebuildOne(w);
          setTimeout(step, 0);
        }());
      };
      var scheduleWarm = function (remeasure) {
        var wait = Math.max(0, WARM_AT - performance.now());
        setTimeout(function () {
          if (window.requestIdleCallback) window.requestIdleCallback(function () { warmSlices(remeasure); }, { timeout: 2500 });
          else warmSlices(remeasure);
        }, wait);
      };

      var EXIT_MS = 850;
      var exitT0 = panels.map(function () { return 0; });

      /* fires once, the instant a panel's state actually changes; the CSS
         crossfade takes it from there */
      var applyState = function (i, state, now, dir) {
        if (bodyState[i] === state) return;
        var wasActive = bodyState[i] === 'active';
        bodyState[i] = state;

        panels[i].classList.remove('is-before', 'is-active', 'is-after');
        panels[i].classList.add('is-' + state);
        panels[i].setAttribute('aria-hidden', state === 'active' ? 'false' : 'true');
        panels[i].style.pointerEvents = state === 'active' ? '' : 'none';

        if (kinds[i] && state === 'active') {
          /* fresh entry, either direction: replay from the start. Only the
             couple of key words show as particles here — the rest stays
             plain text the whole time this panel is being read. */
          words[i].forEach(function (w) { w.glyph.reveal(w.key); w.glyph.reset(); });
          exitT0[i] = 0;
        } else if (kinds[i] && wasActive && !morph) {
          /* just left 'active': the couple of bubble words keep rendering
             for EXIT_MS past this point (see the render loop below) with
             an evap value climbing from 0 to 1 — drifting up, shrinking,
             fading, same motion buildParticles/drawParticles already had
             wired for it, just never triggered before now. */
          exitT0[i] = now;
        }
        if (headings[i]) {
          if (state === 'active') {
            headings[i].style.setProperty('--fx-dir', String(dir || 1));
            var hd = headings[i];
            clearTimeout(headingTimer);
            if (morph && morph.to === i) {
              headingTimer = setTimeout(function () { if (bodyState[i] === 'active') hd.classList.add('is-in'); }, MORPH_MS * 0.55);
            } else {
              hd.classList.add('is-in');
            }
          } else {
            headings[i].classList.remove('is-in');
          }
        }
      };

      /* Only now does the CSS switch from the plain stacked resting state to
         the pinned one — a throw anywhere above leaves the section readable. */
      era.setAttribute('data-era-live', '');
      scheduleWarm(false);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () {
        /* the words are measured with whatever face was there: once the real
           fonts are in, measure them again — but only if they were built
           already (otherwise the first build simply uses the real fonts) */
        if (warmed) scheduleWarm(true);
      });

      var target = -1;
      /* Two problems, one fix: on a fast flick `raw` can land several
         panels ahead of `target` in a single frame — jumping straight
         there used to skip the in-between panel's crossfade entirely, so
         the same section read differently (sometimes animated, sometimes
         not) depending purely on how fast the visitor happened to scroll.
         STEP_COOLDOWN_MS below fixes both at once: a step is capped at one
         panel at a time (nothing is ever skipped) and the next one cannot
         start until this one has had the cooldown's worth of real time to
         land, so the pace a visitor sees is set by this number alone,
         never by scroll speed — a fast flick past several thresholds just
         plays each panel in turn at this same fixed pace instead of
         glitching through them. */
      /* A phrase stays at least this long before the next can take over, whatever
         the scroll does: MORPH_MS (3c) is its flight, the rest is time to read it.
         At 1300 a hard flick went 1 -> 2 -> 3 so fast that the second phrase had
         barely landed when it was already leaving: it looked skipped. */
      var STEP_COOLDOWN_MS = 2000;
      var lastStepAt = 0;

      /* ---- 3e. the section moves on by itself, for whoever does not know it scrolls
         "They often don't know you have to scroll": a visitor can sit on the
         first phrase for as long as they like and never learn there are two
         more, then a door, then the Moka story. So: the moment the section is
         100% on screen (pinned) a phrase gets AUTO_DWELL ms, then the page
         scrolls itself to the next one — a real scroll, moving the real scroll
         position, so the trigger above, its thresholds and its cooldown, the
         camera, the bubbles, the door and the Moka title all run through their
         one and only code path, exactly as for a visitor's own wheel. NOTHING
         about how a visitor's own scroll is read has changed (segBounds, HYST,
         STEP_COOLDOWN_MS, the track heights, the hold at the door): with a
         scroll, those rules apply as they always did; this only adds the scroll
         that was missing. After the last phrase it carries on to the door, which
         opens and plays the Moka title in once; there it stops: the title's
         arrival is a one-shot, played whole, and autoplay is over for the visit.
         A visitor's own scroll after the section is 100% on screen (wheel, touch,
         a scrolling key, the scrollbar, Esc) ends it for good, until the next
         reload: someone who scrolls knows how. The scrolling that brings them
         to the section does not count: input in the ARRIVE_GRACE ms after the
         section is pinned is the tail of that gesture (a trackpad's inertia),
         and only pushes the start back. And if the section is a few percent short
         of 100% (the visitor stopped at 95%) and they are still, the page is
         eased the rest of the way, smoothly, so the section is whole. Reduced
         motion never gets here (this module returned at its first line); a
         hidden tab, a held page (the door) or an open door pause or end it.
         Same on phones. */
      var AUTO_DWELL = [3000, 4000, 4000];   /* ms a phrase stays whole, for phrases 1, 2, 3 */
      var QUIET_GAP = 250;                    /* ms without any input once the section is whole: the gesture that brought the visitor is over (a trackpad's inertia can run for more than a second — a fixed grace period cancelled autoplay for people who did nothing) */
      var ASSIST_TOP = 0.08;                  /* within this fraction of the screen of being whole, ease it the rest of the way */
      var autoOff = false, autoSince = 0, autoMove = null, assistMove = null, userAt = 0, autoState = '', pinnedAt = 0, wasPinned = false, quietSeen = false;
      /* data-auto on the section says where autoplay is: idle (waiting for the
         section to be pinned), count, move, off — for debugging and the test
         harness */
      var setAutoState = function (v) { if (v !== autoState) { autoState = v; era.setAttribute('data-auto', v); } };
      var autoStop = function () {
        autoOff = true; autoSince = 0; autoMove = null; assistMove = null;
        setAutoState('off');
      };
      var userMoved = function () {
        var now = performance.now();
        userAt = now;
        assistMove = null;                      /* a visitor who takes over an ease to 100% simply gets the page back */
        if (autoOff) return;
        if (autoMove || (autoSince && quietSeen)) autoStop();
      };
      window.addEventListener('wheel', userMoved, { passive: true });
      window.addEventListener('touchmove', userMoved, { passive: true });
      window.addEventListener('keydown', function (e) {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (SCROLL_KEYS[e.key] || e.key === 'Escape') userMoved();
      });
      var lastSeenY = window.scrollY;
      window.addEventListener('scroll', function () {
        var y = window.scrollY;
        /* while counting, the page is still: any movement that is not ours
           (scrollbar drag, find-in-page, anything) is the visitor's — once the
           arrival gesture's tail is over, and not while a phone's momentum is still
           carrying the page (iOS and Android keep scrolling for a second or two after
           the finger has left, with no touch event to say so) */
        if (autoSince && !autoMove && !assistMove && lockY === null && quietSeen && performance.now() - userAt > 2500 && Math.abs(y - lastSeenY) > 2) autoStop();
        lastSeenY = y;
      }, { passive: true });
      var glide = function (m, now) {
        var u = clamp((now - m.t0) / m.dur, 0, 1);
        window.scrollTo({ top: Math.round(m.from + (m.to - m.from) * easeInOutCubic(u)), behavior: 'instant' });
        return u >= 1;
      };
      var autoTick = function (now, rect, vh, scrollable, tailPx) {
        if (autoOff) return;
        if (cutGoal) { autoStop(); return; }     /* the door has opened (by us or not): its own one-shot takes over, and autoplay is done */
        var pinned = rect.top <= 2 && rect.bottom >= vh - 2;
        if (pinned && !wasPinned) { pinnedAt = now; quietSeen = false; }
        wasPinned = pinned;
        if (pinned && !quietSeen && now - pinnedAt >= QUIET_GAP && now - userAt >= QUIET_GAP) quietSeen = true;
        if (autoMove) {
          setAutoState('move');
          if (lockY !== null) { autoMove = null; autoSince = 0; return; }
          if (glide(autoMove, now)) { autoMove = null; autoSince = 0; }
          return;
        }
        if (assistMove) {
          if (lockY !== null || doc.hidden) { assistMove = null; return; }
          if (glide(assistMove, now)) assistMove = null;
          return;
        }
        if (!pinned) {
          setAutoState('idle'); autoSince = 0;
          /* almost whole, and the visitor has stopped: finish the job smoothly */
          if (rect.top > 1 && rect.top <= vh * ASSIST_TOP && now - userAt >= 350 && lockY === null && !doc.hidden && !html.classList.contains('fx-scroll-held')) {
            assistMove = { t0: now, from: window.scrollY, to: window.scrollY + rect.top, dur: 520 };
          }
          return;
        }
        if (target < 0 || lockY !== null || doc.hidden) { setAutoState('idle'); autoSince = 0; return; }
        /* the phrase's time starts when it does: the moment the section is whole
           for the first, the moment each next one takes over for the others
           (and never before the arrival gesture's own input has died away) */
        var origin = Math.max(pinnedAt, lastStepAt, userAt);
        autoSince = origin || now;
        setAutoState('count');
        if (now - origin < AUTO_DWELL[Math.min(target, AUTO_DWELL.length - 1)]) return;
        var trackTop = window.scrollY + rect.top, run = scrollable - tailPx, to;
        if (target < n - 1) to = trackTop + run * (segBounds[target + 1] + segBounds[target + 2]) / 2;   /* the middle of the next phrase's stretch */
        else to = trackTop + run + tailPx * (CUT_AT + 0.05);                                              /* just past the line that opens the door */
        autoMove = { t0: now, from: window.scrollY, to: to, dur: clamp(900 + Math.abs(to - window.scrollY) / vh * 260, 1100, 2000) };
        autoSince = 0;
      };

      var render = function (now) {
        var rect = track.getBoundingClientRect();
        var vh = window.innerHeight || 800;
        /* fire a good margin before strictly on screen — init takes real
           time (download, shader compilation, a physics bake), and the 2D
           canvas is what covers that gap regardless of exactly when this
           finishes. Checked ahead of the onScreen early-return below on
           purpose, so it still gets a chance to fire on approach, not only
           once the stricter definition is already met. */
        /* "on screen" means actually looked at: the section's top edge sits
           right at the bottom of the hero, so a bare rect.top < vh was true from
           the very first frame — the whole backdrop (gradient, bubble field)
           was being drawn, every frame, for a section that was a few pixels
           inside the fold (349 ms of main thread in the first 3 s: the hero's
           stutter). A margin of 48px keeps that sliver out. */
        var onScreen = rect.top < vh - 48 && rect.bottom > 48;
        /* and while the door is opening: the slit covers the scene within a
           second, its backdrop is not seen any more, and these frames belong to
           the door */
        var doorBusy = !!(cut && cutGoal && cutOpen > 0.02);
        if (!onScreen || doc.hidden) return false;
        if (!warmed) warmNow();

        var scrollable = Math.max(1, track.offsetHeight - vh);
        var tailPx = cut ? vh * TAIL_VH : 0;
        var p = clamp(-rect.top / Math.max(1, scrollable - tailPx), 0, 1);
        if (cut) updateCut(clamp((-rect.top - (scrollable - tailPx)) / tailPx, 0, 1), now, function (qq) {
          return window.scrollY + rect.top + (scrollable - tailPx) + tailPx * qq;
        });
        if (cue) cue.style.opacity = (1 - range(p, 0.02, 0.12)).toFixed(2);
        autoTick(now, rect, vh, scrollable, tailPx);

        /* which panel the trigger currently says is active — a plain
           threshold read off segBounds (even thirds, or the weighted
           split above), nudged by hysteresis at the exact crossing line
           so a pixel of scroll jitter there cannot flip it back and forth */
        var raw = panelAt(p);
        var next = target;
        if (target < 0) {
          /* first entry only: land directly on whatever panel is already
             in view — there is nothing playing yet for a skipped step to
             have skipped */
          next = raw;
        } else if (raw !== target && now - lastStepAt >= STEP_COOLDOWN_MS) {
          var dirStep = raw > target ? 1 : -1;
          var boundary = segBounds[dirStep > 0 ? target + 1 : target];
          next = Math.abs(p - boundary) < HYST ? target : target + dirStep;
        }

        if (next !== target) {
          var dir = target < 0 ? 1 : (next > target ? 1 : -1);
          endMorph(); startMorph(target, next, now);
          target = next;
          lastStepAt = now;
          for (var i = 0; i < n; i++) {
            applyState(i, i < target ? 'after' : (i > target ? 'before' : 'active'), now, dir);
          }
        }
        if (!(cut && cutGoal && cutOpen > 0.6)) {
          drawGrad(now); renderRipple(now);
        }
        renderField(now);


        return true;
      };

      addJob(render);
      onResize(function () {
        words.forEach(function (list) { list.forEach(function (w) { w.glyph.remeasure(); }); });
        if (!morph && liveOf >= 0) restAt(cloudOf(liveOf), liveOf);
      });
    });
  }());


  /* ======================================================================
     4. fx-path — a marker travelling a curve through the process steps

     Source: "Paths & Control Points" (betawaxx,
     https://codepen.io/betawaxx/pen/JoGZQLZ) — an image scrubbed along a
     cubic bezier by ScrollTrigger + MotionPathPlugin, with the four control
     points draggable from a debug panel and default handles derived from
     the anchor boxes.

     What changed, and why:
     · The draggable editor, the debug SVG, the readouts and the control
       panel are tooling for authoring a curve, not part of the effect;
       none of it ships.
     · What is worth keeping is that the anchors are measured from real DOM
       boxes and the handles are derived from them, so the curve reflows
       with the layout instead of being hard-coded. Here the anchors are the
       numbered process steps themselves, which is the one place on this
       site where "a path through stages" means something rather than
       decorating.
     · MotionPathPlugin is replaced by the browser's own
       getPointAtLength() on the path already being drawn — exact, and free.
     · Desktop only: below 760px the process list is a vertical stack where
       a serpentine curve would cross its own text, so it is not drawn.
     ====================================================================== */
  (function () {
    if (reduce) return;
    var hosts = doc.querySelectorAll('[data-fx-path]');
    if (!hosts.length) return;

    [].forEach.call(hosts, function (host) {
      var anchorSel = host.getAttribute('data-fx-path') || '.timeline__item';
      /* how far the handles are pushed off the straight line, in px. Kept
         per-instance because the right bow depends on how much clear space
         sits above and below the anchors in that particular block. */
      var maxAmp = Number(host.getAttribute('data-fx-path-amp')) || 36;
      var svg = doc.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'fx-path-svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('preserveAspectRatio', 'none');

      var line = doc.createElementNS(SVGNS, 'path');
      line.setAttribute('class', 'fx-path-line');
      var glow = doc.createElementNS(SVGNS, 'circle');
      glow.setAttribute('class', 'fx-path-glow');
      glow.setAttribute('r', '13');
      var dot = doc.createElementNS(SVGNS, 'circle');
      dot.setAttribute('class', 'fx-path-dot');
      dot.setAttribute('r', '4.5');
      svg.appendChild(line); svg.appendChild(glow); svg.appendChild(dot);

      host.classList.add('fx-path-host');
      host.insertBefore(svg, host.firstChild);

      var total = 0, ok = false;

      var measure = function () {
        ok = false;
        if (window.innerWidth <= 760) { svg.style.display = 'none'; return; }
        svg.style.display = '';
        var anchors = [].slice.call(host.querySelectorAll(anchorSel));
        if (anchors.length < 2) return;

        var hr = host.getBoundingClientRect();
        svg.setAttribute('viewBox', '0 0 ' + hr.width + ' ' + hr.height);

        /* anchor = the top marker of each step (the numbered node, or the
           rule a .step hangs from), measured relative to the host */
        var pts = anchors.map(function (el) {
          var mark = el.querySelector('.timeline__node') || el;
          var r = mark.getBoundingClientRect();
          return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height / 2 };
        });

        /* The source derives its handles from the anchor geometry rather
           than hard-coding them; same idea, generalised to N points and to
           anchors that sit on one horizontal line — pushing the handles
           perpendicular to each segment, alternating side, is what turns a
           flat run of steps into a curve you can read as a route. */
        var d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
        for (var i = 0; i < pts.length - 1; i++) {
          var a = pts[i], b = pts[i + 1];
          var dx = b.x - a.x, dy = b.y - a.y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / len, ny = dx / len;
          /* alternate the side each segment leans to, starting upwards, so a
             flat row of steps reads as a route rather than a ruled line */
          var amp = Math.min(maxAmp, len * 0.3) * (i % 2 ? 1 : -1);
          d += ' C ' + (a.x + dx * 0.32 + nx * amp).toFixed(1) + ' ' + (a.y + dy * 0.32 + ny * amp).toFixed(1) +
               ' ' + (b.x - dx * 0.32 + nx * amp).toFixed(1) + ' ' + (b.y - dy * 0.32 + ny * amp).toFixed(1) +
               ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
        }
        line.setAttribute('d', d);
        total = line.getTotalLength ? line.getTotalLength() : 0;
        if (!total) return;
        /* start fully retracted, not fully drawn: the curve is meant to be
           traced by the scroll, and a frame where the whole thing is already
           there before the first render would give that away */
        line.style.strokeDasharray = total + ' ' + total;
        line.style.strokeDashoffset = total;
        host.classList.add('fx-path-on');
        ok = true;
      };

      var lastQ = -1;
      var render = function () {
        if (!ok) return false;
        var r = host.getBoundingClientRect();
        var vh = window.innerHeight || 800;
        if (r.bottom < -40 || r.top > vh + 40) return false;
        var q = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.42), 0, 1);
        if (Math.abs(q - lastQ) < 0.0015) return false;
        lastQ = q;
        line.style.strokeDashoffset = (total * (1 - q)).toFixed(1);
        var pt = line.getPointAtLength(total * q);
        dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
        glow.setAttribute('cx', pt.x); glow.setAttribute('cy', pt.y);
        dot.style.opacity = glow.style.opacity = q > 0.004 ? '1' : '0';
        return false;
      };

      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { measure(); kick(); });
      measure();
      addJob(render);
      onResize(function () { measure(); lastQ = -1; });
    });
  }());

}());
