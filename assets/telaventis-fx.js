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

  /* document.currentScript is only valid during this file's own synchronous
     first run — captured here, at the top, because the one place that
     needs it (the WebGPU loader, in §3b) only knows it wants the value
     much later, inside an IntersectionObserver callback, by which point
     currentScript has long gone back to null. */
  var SELF_SRC = (doc.currentScript && doc.currentScript.src) || (function () {
    var scripts = doc.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (/telaventis-fx\.js/.test(scripts[i].src)) return scripts[i].src;
    }
    return '';
  }());

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
    var SEL = '.h-page, .h2, .band__big, [data-fx-split]';
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
          a: 0.78 + Math.random() * 0.22,
          /* drift is scaled to the grid, so it can never be large enough to
             pull a particle off its own letter */
          d: stepPx,
          /* bubbles: own swell-and-burst period, and the demo's ~6% that
             float away. Flowers: own breathing rate. */
          cyc: isFlower ? (2.2 + Math.random() * 2.6) : (2.6 + Math.random() * 4.2),
          fly: !isFlower && Math.random() < 0.09,
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
          var cyc = phase - Math.floor(phase);
          s *= (0.70 + 0.30 * cyc) * (1 - 0.40 * Math.pow(cyc, 14));
          x += Math.sin(t * 0.55 + p.ph) * p.d * 0.36;
          y += Math.sin(t * 0.42 + p.ph * 1.7) * p.d * 0.32;
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

        var off = doc.createElement('canvas');
        off.width = Math.round(cssW * dpr);
        off.height = Math.round(cssH * dpr);
        var octx = off.getContext('2d');
        octx.scale(dpr, dpr);
        octx.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.fillStyle = '#fff';
        octx.fillText(text, cssW / 2, cssH / 2 + fs * 0.03);

        var data;
        try { data = octx.getImageData(0, 0, off.width, off.height).data; }
        catch (err) { return false; }

        /* tighter still — a denser field of smaller bubbles reads as compact
           texture instead of a scatter of individually obvious circles.
           buildParticles sizes each bubble as a fixed fraction of this same
           step, so shrinking the grid shrinks the bubbles with it and they
           still meet their neighbours; nothing there needed to change. */
        var stepPx = Math.max(1.8, fs * 0.032);
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

      inst.render = function (now, opts) {
        if (!inst.built) return false;
        if (!inst.t0) { inst.t0 = now; inst.prev = now; }
        var t = (now - inst.t0) / 1000;
        var dt = Math.min((now - inst.prev) / 1000, 0.06);
        inst.prev = now;
        drawParticles(inst.ctx, inst.w, inst.h, inst.particles, kind, t, dt, opts);
        return true;
      };

      inst.remeasure = function () {
        if (!inst.built) return;
        if (Math.abs(el.offsetWidth - inst.w) < 4) return;
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
      var seg = 1 / n;
      /* same breakpoint as this section's own CSS (max-width:759px in
         telaventis-fx.css) — the couple of mobile-only cuts below (the
         WebGPU jellyfish, the SVG text warp) both trade a purely
         decorative extra for real per-frame cost on exactly the class of
         device least able to absorb it. */
      var isMobileEra = mq('(max-width:759px)');

      var kinds = panels.map(function (p) { return p.getAttribute('data-fx-kind'); });
      /* Mobile drops the particle canvas entirely — not just its palette.
         It used to keep a recoloured "coral" variant of it (see the
         removed entry in getSprites()), but a scatter of small bubbles
         turned out to be exactly the "unreadable" a phone-sized backdrop
         also had to stop being; see the isMobileEra branch further down
         for what replaced both of them. Every word here just stays the
         plain DOM text it always was underneath the canvas. */
      var words = panels.map(function (p) {
        if (!p.getAttribute('data-fx-kind') || isMobileEra) return [];
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

      /* ---- background layer: jellyfish (desktop) or seascape (mobile) ---
         Exactly one of these two branches ever mounts — decided once here
         by isMobileEra, the same split the WebGPU/2D and warp choices
         already use elsewhere in this file. render() and the panel-change
         trigger further down are shared by both and only ever call
         renderAurora/renderRipple/setAuroraScene OR renderSea/setSeaScene,
         whichever pair actually ran; `var` hoists every one of those names
         to this whole callback's scope, so referencing whichever pair did
         NOT run is simply undefined, never a ReferenceError — the same
         reasoning the gpu/GPU_SCENES names below already relied on. */
      if (!isMobileEra) {
      /* ---- the aurora backdrop ------------------------------------------
         "Aurelia" (holtsetio, https://github.com/holtsetio/aurelia) turns
         out to be a moon-jellyfish simulation, not a light effect the name
         suggested — its own README: "The bell is formed by a sinusoidally
         contracting hemisphere, while the bell seam, oral arms and
         tentacles are simulated using a verlet particle system that is
         evaluated on the GPU with compute shaders," rendered with Three.js'
         WebGPURenderer. None of that runs here: WebGPU still isn't
         supported everywhere, Three.js is ~600KB, and a GPU compute pass is
         a different machine entirely from a 2D canvas — all flatly
         incompatible with a site whose whole argument is zero runtime
         dependencies and support for any browser.
         What IS taken, honestly, is the silhouette and the behaviour its
         README names: a dome that contracts on a sine (kept, literally —
         same idea, no compute shader needed for one pulsing shape), and
         tentacles trailing and swaying beneath it (here, strings of fading
         dots on a swaying offset — a plain restatement of "trailing soft
         particles," not the verlet physics actually driving them there).
         Each panel is a different swum-to position; the jellyfish glides
         between them on the exact same panel-change trigger as everything
         else in this section, so "the background moves to another view
         when the phrase changes" is one more state scroll only ever
         starts, never drives. */
      var auroraCanvas = doc.createElement('canvas');
      auroraCanvas.className = 'era__aurora';
      auroraCanvas.setAttribute('aria-hidden', 'true');
      era.querySelector('.era__sticky').insertBefore(auroraCanvas, era.querySelector('.era__stage'));
      var auroraCtx = auroraCanvas.getContext('2d');

      /* ---- hover bubbles on the water -------------------------------------
         The same bubble sprites a hovered word gets (fxType.getSprites().
         bubbles — the very images drawParticles paints words with) spawned
         at the cursor over the jellyfish backdrop instead of sampled from a
         glyph, so hovering the water gets the same kind of reaction
         hovering the text already had. Its own small canvas rather than a
         reuse of drawParticles itself: that function ages a whole array off
         ONE shared clock, built for a word sampled once — fine there, but
         this is a continuous trail where every bubble is born at its own
         moment, which fits a short-lived, self-contained loop better than
         bending drawParticles' shared-evap model to a spawner. A z-index
         above either jellyfish layer (telaventis-fx.css) keeps it visible
         over whichever one is actually showing. */
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

      /* ---- the text warp -------------------------------------------------
         A slight distortion of the text as the jellyfish passes near it, as
         if it genuinely displaced something in front of it — an SVG
         feDisplacementMap on the text block, its `scale` driven every frame
         by real distance between the jellyfish's current on-screen position
         (tracked below regardless of whether the 2D canvas or the WebGPU
         one is what's actually visible — see warpAt()) and the active
         panel's own box. Zero at rest, so there is no permanent softening
         of the type; it only ever appears while something is genuinely
         passing close, and only ever as much as it is close.
         Skipped entirely on mobile (isMobileEra): feTurbulence +
         feDisplacementMap is real per-frame raster work — its `scale`
         changes every frame below, and most mobile browsers have no
         hardware-accelerated path for this filter pair at all, so it was
         paying for a subtle hover-proximity nicety by recomputing an
         expensive noise+displacement pass on the section's own readable
         text, 60 times a second, on exactly the devices least able to
         absorb that cost. warpMap stays null; applyWarp() below no-ops
         the instant it finds that, so nothing else here needs to know. */
      var warpMap = null;
      if (!isMobileEra) {
        var warpSvg = doc.createElementNS(SVGNS, 'svg');
        warpSvg.setAttribute('width', '0');
        warpSvg.setAttribute('height', '0');
        warpSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        var warpId = 'era-warp-' + Math.random().toString(36).slice(2, 8);
        warpSvg.innerHTML =
          '<filter id="' + warpId + '" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="7" result="n"/>' +
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
          '</filter>';
        era.appendChild(warpSvg);
        warpMap = warpSvg.querySelector('feDisplacementMap');
        era.querySelectorAll('.era__body').forEach(function (b) { b.style.filter = 'url(#' + warpId + ')'; });
      }

      /* current jellyfish position, in VIEWPORT px — kept up to date by
         both renderAurora() (2D mode) and setInterval-free polling of the
         WebGPU camera is not available from outside, so the 2D tracking
         doubles as the position source for the warp even while the WebGPU
         canvas is what visitors actually see: the two scenes are driven by
         the same trigger and roughly the same choreography, so it stays a
         reasonable stand-in rather than requiring a 3D-to-screen
         projection of the real camera. */
      var jellyScreen = { x: -9999, y: -9999 };
      var applyWarp = function () {
        if (!warpMap) return; /* mobile: no filter was ever attached, nothing to drive */
        /* the actual set glyphs — .era__mix or, on the plain panel,
           .era__phrase — not .era__body, which is a flex box padded out to
           most of the sticky viewport: measured against THAT, the
           jellyfish is "inside" it almost everywhere it ever drifts, and
           the warp would sit permanently maxed out instead of responding
           to anything. Distance has to be measured against where the
           letters actually are. */
        var activeText = era.querySelector('.era__panel.is-active .era__mix, .era__panel.is-active .era__phrase');
        if (!activeText) { warpMap.setAttribute('scale', '0'); return; }
        var r = activeText.getBoundingClientRect();
        var cx = clamp(jellyScreen.x, r.left, r.right);
        var cy = clamp(jellyScreen.y, r.top, r.bottom);
        var d = Math.hypot(jellyScreen.x - cx, jellyScreen.y - cy);
        /* falls off over a narrower margin than the text's own box, and the
           per-panel ambient drift is small enough on its own that this
           should mostly sit near zero between panel changes — the big,
           meaningful excursion is the scene glide AT a panel change, which
           sweeps the jellyfish across a genuinely different part of the
           screen, not the small in-place sway the rest of the time. Squared
           for a falloff that's flat near zero and only really shows up once
           truly close, and capped low — "légère", not a melt. */
        var reach = Math.max(140, r.width * 0.32);
        var amt = 1 - range(d, 0, reach);
        warpMap.setAttribute('scale', (amt * amt * 5.5).toFixed(1));
      };

      /* one swim position per panel: [x, y, scale] as fractions of the box */
      var AURORA_SCENES = [
        [.26, .34, .92],
        [.72, .30, 1.05],
        [.50, .60, 1.16]
      ];
      var jelly = {
        x: AURORA_SCENES[0][0], y: AURORA_SCENES[0][1], s: AURORA_SCENES[0][2],
        fx: AURORA_SCENES[0][0], fy: AURORA_SCENES[0][1], fs: AURORA_SCENES[0][2],
        tx: AURORA_SCENES[0][0], ty: AURORA_SCENES[0][1], ts: AURORA_SCENES[0][2]
      };
      var auroraT0 = 0;
      var AURORA_DUR = 1000; /* matches gpu.setView's own glide time below */

      /* Two tiers of trailing strands — a dozen fine "hair" tentacles plus a
         handful of thicker oral arms — rather than one sparse set, which is
         what actually reads as a detailed creature instead of a diagram of
         one. Each carries its own timing so none of them move in lockstep. */
      var HAIR_N = 16, ARM_N = 5, RIB_N = 9, SPARK_N = 26;
      var hairs = [], arms = [], ribs = [], sparks = [];
      for (var hi = 0; hi < HAIR_N; hi++) hairs.push({ ph: Math.random() * Math.PI * 2, ph2: Math.random() * Math.PI * 2, sp: 0.55 + Math.random() * 0.5, len: 0.55 + Math.random() * 0.5, w: 0.5 + Math.random() * 0.5 });
      for (var ai = 0; ai < ARM_N; ai++) arms.push({ ph: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 0.3, len: 0.8 + Math.random() * 0.35 });
      for (var ri = 0; ri < RIB_N; ri++) ribs.push({ a: (ri / RIB_N) * Math.PI });
      for (var sp2 = 0; sp2 < SPARK_N; sp2++) sparks.push({ x: Math.random(), y: Math.random(), ph: Math.random() * Math.PI * 2, sp: 0.2 + Math.random() * 0.3, r: 0.6 + Math.random() * 1.4 });

      /* a small secondary jelly, blurred and dim, drifting behind and to the
         side of the main one — the cheapest possible depth cue in a medium
         with no actual camera or z-buffer: two of the same silhouette at
         different scale and opacity reads as near/far */
      var bgJelly = { phX: Math.random() * 10, phY: Math.random() * 10 };

      var setAuroraScene = function (idx, now) {
        idx = ((idx % AURORA_SCENES.length) + AURORA_SCENES.length) % AURORA_SCENES.length;
        var s = AURORA_SCENES[idx];
        jelly.fx = jelly.x; jelly.fy = jelly.y; jelly.fs = jelly.s;
        jelly.tx = s[0]; jelly.ty = s[1]; jelly.ts = s[2];
        auroraT0 = now;
      };

      /* Draws one jellyfish — bell, ribs, rim light and trailing strands —
         at the given centre/scale/detail level. Used twice: once richly for
         the main animal, once with `detail=false` for the small blurred one
         behind it, so the depth layer costs almost nothing extra to draw. */
      var drawJelly = function (cx, cy, scale, t, detail, alphaMul) {
        /* Real jellyfish locomotion is a sharp contraction (thrust) and a
           slow relax (glide), not a symmetric wobble — sin() raised to a
           power skews it exactly that way, and it is what actually reads
           as swimming rather than breathing. Each pulse also gives the
           whole body a small upward kick, timed to the contraction. */
        var raw = 0.5 + 0.5 * Math.sin(t * 1.1);
        var pulse = Math.pow(raw, 2.4);
        var thrust = Math.pow(raw, 7) * scale * 0.05;
        cy -= thrust;

        var bellW = scale * (1 + 0.07 * pulse);
        var bellH = scale * (0.68 - 0.11 * pulse);

        /* a slow, layered tilt — two sine harmonics of unrelated frequency
           so the roll never repeats on a noticeable cycle — is the one
           cheapest trick that reads as three-dimensional turning rather
           than a flat sprite sliding sideways */
        var tilt = Math.sin(t * 0.11) * 0.09 + Math.sin(t * 0.052 + 2) * 0.05;

        auroraCtx.save();
        auroraCtx.translate(cx, cy);
        auroraCtx.rotate(tilt);
        auroraCtx.globalCompositeOperation = 'lighter';

        /* contrast raised hard against the dark water — the first pass read
           as a flat grey cloud precisely because it was close in value to
           the ink background it sits on; a bioluminescent creature has to
           be BRIGHT against dark water, not a subtle tint of it */
        var glow = auroraCtx.createRadialGradient(0, 0, 0, 0, 0, bellW * (detail ? 1.9 : 1.6));
        glow.addColorStop(0, 'rgba(224,150,90,' + (0.34 * alphaMul).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(224,150,90,0)');
        auroraCtx.fillStyle = glow;
        auroraCtx.beginPath();
        auroraCtx.arc(0, 0, bellW * (detail ? 1.9 : 1.6), 0, Math.PI * 2);
        auroraCtx.fill();

        /* the bell: a dome closed by a softly scalloped skirt instead of a
           flat line, so the silhouette reads as a bell, not a half-circle */
        auroraCtx.beginPath();
        auroraCtx.ellipse(0, 0, bellW, bellH, 0, Math.PI, Math.PI * 2, false);
        var scallops = 8;
        for (var si = 1; si <= scallops; si++) {
          var fx1 = bellW - (bellW * 2) * si / scallops;
          var midX = bellW - (bellW * 2) * (si - 0.5) / scallops;
          var bumpY = bellH * 0.16 + Math.sin(t * 1.4 + si * 0.9) * bellH * 0.05;
          auroraCtx.quadraticCurveTo(midX, bumpY, fx1, 0);
        }
        auroraCtx.closePath();
        var bellGrad = auroraCtx.createRadialGradient(0, -bellH * 0.3, 0, 0, 0, bellW * 1.1);
        bellGrad.addColorStop(0, 'rgba(255,247,232,' + (0.62 * alphaMul).toFixed(3) + ')');
        bellGrad.addColorStop(0.55, 'rgba(232,140,70,' + (0.42 * alphaMul).toFixed(3) + ')');
        bellGrad.addColorStop(1, 'rgba(180,80,30,' + (0.12 * alphaMul).toFixed(3) + ')');
        auroraCtx.fillStyle = bellGrad;
        auroraCtx.fill();

        if (detail) {
          /* radial ribs — the canal pattern a real bell shows — a handful of
             thin curves from the crown to the rim, breathing with the pulse */
          auroraCtx.strokeStyle = 'rgba(255,222,180,' + (0.20 * alphaMul).toFixed(3) + ')';
          auroraCtx.lineWidth = 1;
          for (var rj = 0; rj < RIB_N; rj++) {
            var a = ribs[rj].a;
            var rx = Math.cos(a) * bellW * 0.94, ry = -bellH * 0.55 + Math.sin(a) * bellH * 0.35;
            auroraCtx.beginPath();
            auroraCtx.moveTo(0, -bellH * 0.32);
            auroraCtx.quadraticCurveTo(rx * 0.5, -bellH * 0.15, rx, ry * 0.15 + bellH * (0.05 * pulse));
            auroraCtx.stroke();
          }
          /* rim light: the silhouette's edge only, brighter than the fill —
             a cheap fresnel, same idea as the bubble sprite's rim gradient
             already used for the word particles elsewhere in this file */
          auroraCtx.strokeStyle = 'rgba(255,235,205,' + (0.55 * alphaMul).toFixed(3) + ')';
          auroraCtx.lineWidth = 1.3;
          auroraCtx.beginPath();
          auroraCtx.ellipse(0, 0, bellW, bellH, 0, Math.PI, Math.PI * 2, false);
          auroraCtx.stroke();
        }

        /* trailing strands. Phase carries a term in `u` (distance from the
           root) as well as `t`, so the wave has to travel outward along the
           strand instead of every point swaying in lockstep — the
           difference between something rippling and something just
           wiggling in place. */
        var drawStrand = function (rootX, rootY, len, sway, dots, width, alpha, ph, sp) {
          for (var di = 1; di <= dots; di++) {
            var u = di / dots;
            var s = Math.sin(t * sp - u * 2.6 + ph) * sway * u;
            var px = rootX + s;
            var py = rootY + len * u;
            var a = (1 - u * 0.92) * alpha * alphaMul;
            auroraCtx.beginPath();
            auroraCtx.arc(px, py, Math.max(0.5, width * (1 - u * 0.6)), 0, Math.PI * 2);
            auroraCtx.fillStyle = 'rgba(250,220,180,' + a.toFixed(3) + ')';
            auroraCtx.fill();
          }
        };

        if (detail) {
          for (var k = 0; k < ARM_N; k++) {
            var arm = arms[k];
            var fracA = (k + 0.5) / ARM_N;
            drawStrand(bellW * (fracA * 2 - 1) * 0.7, bellH * 0.08, bellH * 2.1 * arm.len, bellW * 0.10, 16, 2.6, 0.40, arm.ph, arm.sp);
          }
          for (var m = 0; m < HAIR_N; m++) {
            var hair = hairs[m];
            var fracH = (m + 0.5) / HAIR_N;
            drawStrand(bellW * (fracH * 2 - 1) * 0.96, bellH * 0.12, bellH * 2.9 * hair.len, bellW * 0.16 * hair.w, 12, 1.1 * hair.w, 0.26, hair.ph, hair.sp * 0.7);
          }
        } else {
          for (var kk = 0; kk < 4; kk++) {
            drawStrand(bellW * (kk / 3 - 0.5) * 1.3, bellH * 0.1, bellH * 2.2, bellW * 0.12, 8, 2, 0.22, kk * 1.7, 0.4);
          }
        }

        auroraCtx.globalCompositeOperation = 'source-over';
        auroraCtx.restore();
      };

      var renderAurora = function (now) {
        var w = auroraCanvas.clientWidth, h = auroraCanvas.clientHeight;
        if (!w || !h) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var pxW = Math.round(w * dpr), pxH = Math.round(h * dpr);
        if (auroraCanvas.width !== pxW || auroraCanvas.height !== pxH) {
          auroraCanvas.width = pxW; auroraCanvas.height = pxH;
        }
        auroraCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        auroraCtx.clearRect(0, 0, w, h);
        var t = now / 1000;

        /* ambient drifting sparkle — cheap depth and atmosphere: a field of
           tiny twinkling points at a fixed screen position, well behind
           everything else, so the two jellyfish read as swimming THROUGH a
           volume rather than pasted on a flat background */
        for (var sIdx = 0; sIdx < SPARK_N; sIdx++) {
          var sk = sparks[sIdx];
          var sx = (sk.x + Math.sin(t * 0.03 * sk.sp + sk.ph) * 0.02) * w;
          var sy = ((sk.y + t * 0.006 * sk.sp) % 1) * h;
          var tw = 0.10 + 0.10 * (0.5 + 0.5 * Math.sin(t * 0.6 * sk.sp + sk.ph));
          auroraCtx.beginPath();
          auroraCtx.arc(sx, sy, sk.r, 0, Math.PI * 2);
          auroraCtx.fillStyle = 'rgba(210,232,236,' + tw.toFixed(3) + ')';
          auroraCtx.fill();
        }

        /* the eased "which scene" position, still gliding smoothly toward
           its target for AURORA_DUR after every trigger */
        var e = auroraT0 ? easeInOutCubic(clamp((now - auroraT0) / AURORA_DUR, 0, 1)) : 1;
        jelly.x = jelly.fx + (jelly.tx - jelly.fx) * e;
        jelly.y = jelly.fy + (jelly.ty - jelly.fy) * e;
        jelly.s = jelly.fs + (jelly.ts - jelly.fs) * e;

        /* a slow, continuous swim drift on top of that — never perfectly
           still, in transition or out of one — built from two harmonics per
           axis so the path doesn't trace the same loop twice */
        var driftX = Math.sin(t * 0.10 + 1.3) * 0.55 + Math.sin(t * 0.031 + 4) * 0.45;
        var driftY = Math.sin(t * 0.084) * 0.6 + Math.sin(t * 0.021 + 2.2) * 0.4;
        var cx = jelly.x * w + driftX * w * 0.03;
        var cy = jelly.y * h + driftY * h * 0.03;
        var scale = jelly.s * Math.min(w, h) * 0.32;

        /* the small blurred one behind, opposite corner-ish, at its own
           slower drift — pure depth cue, cheap to draw (drawJelly's
           detail=false path skips the ribs/rim/dense hair entirely) */
        var bgx = (1 - jelly.x) * w * 0.9 + Math.sin(t * 0.06 + bgJelly.phX) * w * 0.03;
        var bgy = jelly.y * h * 0.5 + h * 0.18 + Math.sin(t * 0.05 + bgJelly.phY) * h * 0.02;
        drawJelly(bgx, bgy, scale * 0.6, t * 0.8 + 5, false, 0.45);

        drawJelly(cx, cy, scale, t, true, 1);

        /* canvas-local (cx,cy) → viewport px, then let the warp react to
           wherever that now is */
        var canvasRect = auroraCanvas.getBoundingClientRect();
        jellyScreen.x = canvasRect.left + cx * (canvasRect.width / w);
        jellyScreen.y = canvasRect.top + cy * (canvasRect.height / h);
        applyWarp();
      };

      /* ---- the real thing, for browsers that can run it -----------------
         Everything above is the fallback. This is holtsetio's actual
         Aurelia — https://github.com/holtsetio/aurelia, MIT-licensed, built
         from source with their own Vite config and loaded here unmodified
         except for the entry point: the original self-executes fullscreen
         against fixed DOM ids from its own demo page, so it was rewritten
         to export one function, createAurelia(container), that mounts into
         any element and sizes to IT instead of the window — see
         assets/aurelia/ for exactly what changed and why. The physics, the
         shaders, the geometry are untouched.
         Requires WebGPU, which is not universal yet, so this is strictly
         additive: the 2D canvas above is what every browser gets and
         already looks and behaves correctly on its own; this quietly
         upgrades it where it can run, and if it fails for any reason —
         unsupported, slow to init, an exception — the 2D version is simply
         what stays on screen, because it was never removed. */
      var gpu = null;      /* { canvas, setView, dispose } once ready */
      var gpuLoading = false;
      /* [camera position, look-at] per panel. Aurelia's background/light
         (assets/aurelia/, background.js's fogFunction + lights.js) is lit
         from straight overhead, and the fog colour is literally the view
         ray's upward component times the sky colour — a shot that TILTS
         DOWN reads as dark water automatically, no separate darkening
         needed, regardless of how high up the camera itself sits. First
         pass conflated the two and dropped the camera down near the
         medusae's own drift band to get that tilt — which read as diving
         into the swarm instead of watching it from a respectful distance,
         and put the camera close enough to their y=-25 respawn point (see
         medusa.js) that a fresh one could pop in already inside the frame
         instead of visibly rising into it from below. Camera height and
         distance are back up here; only the look-at target is sent deep
         to keep the downward tilt (and the contrast win) on its own. */
      var GPU_SCENES = [
        [[0, 3, 20], [0, -12, 0]],
        [[13, 1, 12], [0, -15, 0]],
        [[-12, 4, 14], [0, -10, 0]]
      ];

      /* reduced-motion is already handled: this whole module returned at
         its very first line if `reduce` was true, so reaching here already
         guarantees motion is wanted — only WebGPU support is left to check.
         isMobileEra excludes mobile outright regardless of navigator.gpu:
         plenty of phones expose that property with no real hardware
         WebGPU backend behind it, so `import()`ing this pulls in Three.js
         (~600KB) and then quietly falls back to running its verlet
         physics sim (tens of thousands of springs, a real "physics bake"
         per the comment above) over WebGL2 instead — on a phone GPU, THAT
         is the mobile lag this was meant to be strictly additive to, not
         the cause of. The 2D canvas above already looks and behaves
         correctly on its own; the upgrade is only worth its cost on a
         screen big enough that it was actually designed and tuned for. */
      if (window.navigator && navigator.gpu && !isMobileEra) {
        var loadGpu = function () {
          if (gpuLoading || gpu) return;
          gpuLoading = true;
          /* resolved against THIS SCRIPT's own captured location (SELF_SRC,
             top of file), not the page, so it finds assets/aurelia/aurelia.js
             at any page depth (site root or /en/, /it/) — same reasoning as
             the ink-hover art path in telaventis.js */
          var url;
          try { url = new URL('aurelia/aurelia.js', SELF_SRC).href; }
          catch (e) { gpuLoading = false; return; }

          var container = doc.createElement('div');
          container.className = 'era__aurora era__aurora--gpu';
          era.querySelector('.era__sticky').insertBefore(container, era.querySelector('.era__stage'));

          /* Console only — never a visible element on the page. A visitor
             has nothing to gain from a status badge; whoever is diagnosing
             this has devtools open already, which is what console.error
             below is actually for. */
          import(/* @vite-ignore */ url).then(function (mod) {
            return mod.createAurelia(container);
          }).then(function (inst) {
            if (!inst) {
              console.error('[aurelia] createAurelia(container) returned null — module loaded but init declined (no WebGPU backend, or app.init() failed inside it). Falling back to the 2D canvas.');
              container.remove();
              return;
            }
            gpu = inst;
            console.info('[aurelia] live: WebGPU jellyfish mounted from ' + url);
            /* the 2D canvas is not removed, only covered — if the WebGPU
               one ever throws mid-flight, dispose() below falls straight
               back to a fully intact fallback with nothing to rebuild */
            auroraCanvas.style.opacity = '0';
            if (gpu.setView) gpu.setView(GPU_SCENES[Math.max(0, target)][0], GPU_SCENES[Math.max(0, target)][1], 1);
          }).catch(function (err) {
            /* console.error, not .warn — a fetch 404, a syntax error in the
               built module, a thrown exception inside init: whatever it is,
               it belongs in the same place every other bug on this page
               would show up, unmissably, not filed away as a warning */
            console.error('[aurelia] failed to load ' + url + ' — 2D fallback stays active. Cause:', err);
            container.remove();
            gpuLoading = false;
          });
        };

        /* Fired immediately — not waited on scroll proximity. The bundle is
           real (a physics bake plus real shader compilation on top of the
           download), and every millisecond of that has to happen before
           the section is ready either way; starting it the moment the page
           is capable of running it, rather than the moment the visitor
           happens to scroll near it, is what "loads fast" actually means
           here — there is no way to make the work itself smaller from
           outside the module, only earlier.
           render(), below, ALSO calls loadGpu() every frame once the
           section is approaching on screen — loadGpu() itself is a no-op
           past its first real call (guarded by gpuLoading/gpu above), so
           that second call site costs nothing; it exists purely as a
           backstop in case this first attempt ever throws before it can
           start the request at all. */
        loadGpu();
      }
      } else {
      /* ---- the flow field: Alex Andrix's actual technique, tamed --------
         codepen.io is not reachable from where this file is written, so
         the very first pass here guessed at what "jgyWww" showed and
         built an invented painted backdrop instead — wrong, and replaced
         outright by this block. What runs below is verified against a
         derivative that reproduces the real pen line-for-line and credits
         it explicitly (github.com/rolandkorgowski, gist
         9f1ce287db6c7efebb3e8b5ec49d1b2a, itself "inspired in very large
         part by Alex Andrix's work… https://codepen.io/alexandrix/pen/
         jgyWww"). The real pen — titled "A random world of Turbulence",
         after earth.nullschool.net's wind map — is not jellyfish or
         bubbles at all: a handful of invisible "eddies" (vortices) sum
         into one velocity field; a swarm of particles drifts through it,
         each drawn every frame as a short line from its last position to
         its new one. createEddy/createParticle/move below are that
         source's own maths, unchanged (radial pull toward each eddy's
         radius + angular spin around it, falling off with distance —
         see move() for the exact terms).
         What changed, and why:
         · The source's canvas is NEVER cleared — strokes accumulate
           forever, which is fine for a standalone demo but would
           eventually paint solid over the body text sitting on top of
           it. FADE below stands in for that: a translucent ink wash
           painted under every new stroke each frame, so old strokes
           dim by degrees instead of staying at full strength — trails
           still read as flowing threads, the canvas never climbs toward
           opaque.
         · Hue is still driven by particle speed exactly as the source
           computes it — only the RANGE moved, from the full 0–360°
           rainbow down to a band between this site's own coral and the
           teal era__sticky::before already glows with, and lightness is
           capped mid-tone rather than bright — "not too bright" was the
           brief, and constraining the same speed-driven hue shift to two
           brand hues gets there without giving up what made the source
           read as alive.
         · Reseeded — a fresh set of eddies AND a fresh particle swarm —
           on every panel change, the same trigger as everything else in
           this section; the source only ever reseeds on click or resize,
           since it has no panels to react to. The still-fading old
           trails already on the canvas cross-fade into the new field on
           their own, for free, because FADE dims them regardless of
           which simulation state produced them.
         · Eddy/particle counts (7/1700) are higher than the source's own
           5/1000 — this canvas is now a whole WORLD larger than any one
           viewport (see PAN_MARGIN_X/Y below), not a phone-width strip,
           so it needs more of both to read as dense wherever the camera
           happens to be sitting, not just in whichever corner was built
           first. Getting a filled-in look at all also needed a much
           slower fade (see FADE below) — density alone with a fast fade
           still faded each stroke before enough of its neighbours had
           overlapped it. */
      var eraSticky = era.querySelector('.era__sticky');
      var seaWrap = doc.createElement('div');
      seaWrap.className = 'era__sea';
      seaWrap.setAttribute('aria-hidden', 'true');
      var seaCanvas = doc.createElement('canvas');
      seaCanvas.className = 'era__sea-canvas';
      seaWrap.appendChild(seaCanvas);
      eraSticky.insertBefore(seaWrap, era.querySelector('.era__stage'));
      var seaCtx = seaCanvas.getContext('2d');

      var NB_EDDIES = 7, NB_PARTICLES = 1700, LIFETIME = 420;
      /* Pulled back from an even slower first try (2%/frame): left running
         a few seconds, that settled into exactly what the source pen's own
         screenshot shows — two tight, saturated vortices on an otherwise
         mostly BLACK canvas, because particles keep drifting off toward
         the eddies and the fade is slow enough that everywhere else has
         time to go fully dark before fresh particles (reborn at random
         positions — see createParticle) refill it. ~4.5%/frame (~0.25s
         half-life) is the middle point: still several times slower than
         the original 9%/7.5% passes, so strokes still overlap into real
         grooves instead of thin scattered lines, but fast enough that
         emptier patches keep getting refreshed before they go black —
         dense texture across the whole field, not two blobs on a void.
         Still a live fade, never a static painting: --panel-fg/
         --panel-shadow-rgb below keep sampling the real pixels each
         frame, so text contrast keeps adapting regardless. */
      var FADE = 'rgba(18,26,34,.045)';
      var HUE_LO = 22, HUE_HI = 200;   /* --coral-2 to the era__sticky::before teal */

      var dimx = 0, dimy = 0, eddies = [], particles = [], seaBuilt = false, seaDpr = 1;

      /* alea/intAlea/createEddy/createParticle/move: the source's own
         functions (same names, same signatures), only the constants
         feeding them and the hue mapping at the very end of move() are
         this site's. */
      var alea = function (a, b) { return b === undefined ? a * Math.random() : a + (b - a) * Math.random(); };
      var intAlea = function (a, b) { if (b === undefined) { b = a; a = 0; } return Math.floor(a + (b - a) * Math.random()); };

      var createEddy = function () {
        return {
          x: alea(dimx), y: alea(dimy),
          coeffR: 0.001 * alea(0.7, 1.3),          /* coefficient for radial velocity */
          radius: 90 + alea(-30, 30),               /* radius where angular velocity is max — smaller than the source's 150±50: this canvas is a phone-width strip, not a fullscreen window */
          coeffA1: 10000 * alea(0.8, 1.2),          /* coefficient in exponent for angular velocity */
          coeffA2: 0.01 * alea(0.8, 1.2),           /* multiplying coefficient for angular velocity */
          dir: Math.random() > 0.5 ? 1 : -1         /* direction of rotation */
        };
      };

      var createParticle = function () {
        /* hue fixed per particle at birth — coral or teal, never anything
           between: interpolating hue itself from 22° to 200° at render
           time was tried first and rejected, because the short way round
           the wheel between those two crosses yellow and green, which
           read as neither brand colour. Keeping each thread a single
           consistent hue and letting speed drive brightness instead (see
           move()) keeps the palette to exactly the two colours intended. */
        return {
          x: alea(-40, dimx + 40), y: alea(-40, dimy + 40),
          hue: (Math.random() < 0.5 ? HUE_LO : HUE_HI) + alea(-8, 8),
          TTL: intAlea(LIFETIME * 0.8, LIFETIME * 1.2)
        };
      };

      var reseed = function () {
        eddies = [];
        for (var i = 0; i < NB_EDDIES; i++) eddies.push(createEddy());
        particles = [];
        for (var j = 0; j < NB_PARTICLES; j++) {
          var p = createParticle();
          p.TTL = intAlea(LIFETIME);   /* staggered, so this reseed doesn't die/respawn every particle in lockstep once TTL starts running out */
          particles.push(p);
        }
      };

      var seaHasActivated = false;

      /* ---- one continuous world, a moving window onto it ----------------
         Earlier passes tried "nudging" by teleporting every eddy and
         particle to a new spot: technically cheap, but it reads exactly
         like what it is — a cut, not a pan. What actually reads as
         movement is the opposite trick: the SIMULATION never jumps at
         all, only the WINDOW looking at it does. So the canvas itself is
         built much bigger than any one viewport (PAN_MARGIN_X/Y below,
         layered on top of the pre-existing SEA_HEADROOM), the field runs
         across that whole world continuously exactly as it always did —
         same reseed() on real resize, same never-reseed on phrase change,
         nothing about moveSea/createParticle/createEddy below changes —
         and seaWrap (overflow:hidden, see the CSS) crops it down to the
         viewport. A phrase change just slides the canvas element itself
         under that crop via a CSS transform, panSea() below, so the
         already-drawn trail comes along for the ride instead of staying
         behind to fade out — the whole point being that there is nothing
         to fade out any more, because nothing was reset. */
      var PAN_MARGIN_X = 0.5, PAN_MARGIN_Y = 0.28;
      var SEA_HEADROOM = 1.25;
      var viewW = 0, viewH = 0, seaCanvasW = 0, seaCanvasH = 0;
      var camX = -1, camY = -1;   /* -1 sentinel: "not yet placed" — buildSea centres it on the very first build instead of pinning the top-left corner */
      var setCam = function (x, y, animate) {
        camX = x; camY = y;
        seaCanvas.style.transition = animate ? 'transform 1100ms cubic-bezier(.22,.9,.24,1)' : 'none';
        seaCanvas.style.transform = 'translate3d(' + (-camX) + 'px,' + (-camY) + 'px,0)';
      };
      /* Called once per phrase change (from applyState, below, gated to
         isMobileEra) — picks a new spot inside the same world and glides
         the camera there. Never picks somewhere too close to the current
         spot to actually notice; falls back to whatever the last try found
         if six attempts in a row all land too close (a handful of pixels
         of headroom, not expected to matter in practice). */
      var panSea = function () {
        var maxX = dimx - viewW, maxY = dimy - viewH;
        if (maxX <= 4 && maxY <= 4) return;
        var minDist = Math.min(maxX, maxY) * 0.35;
        var nx = camX, ny = camY;
        for (var tries = 0; tries < 6; tries++) {
          var tx = alea(0, maxX), ty = alea(0, maxY);
          if (Math.hypot(tx - camX, ty - camY) >= minDist) { nx = tx; ny = ty; break; }
          nx = tx; ny = ty;
        }
        setCam(nx, ny, true);
      };

      /* The canvas is deliberately built TALLER and WIDER than the
         viewport that asked for it — SEA_HEADROOM for the vertical safety
         margin against a mobile address bar collapsing/expanding mid-
         scroll (unrelated to panning: a pure height change here never
         needs a rebuild, see onResize below), PAN_MARGIN_X/Y on top of
         that for the room panSea actually pans around inside. Setting
         .width/.height always wipes a canvas's pixel buffer — there is no
         way to resize one and keep what is drawn on it — so a genuine
         rebuild (real resize, not a pan) still restarts the field, same
         as always; it just now needs to happen far less often, since most
         of what used to force a rebuild (needing a "different view") is
         handled by moving the window instead. */
      var buildSea = function (keepField) {
        var w = eraSticky.clientWidth, h = eraSticky.clientHeight;
        if (!w || !h) return false;
        var worldW = Math.round(w * (1 + PAN_MARGIN_X));
        var worldH = Math.round(Math.max(h * SEA_HEADROOM * (1 + PAN_MARGIN_Y), seaCanvasH));
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        seaDpr = dpr;
        dimx = worldW; dimy = worldH;
        seaCanvas.style.width = worldW + 'px';
        seaCanvas.style.height = worldH + 'px';
        seaCanvas.width = Math.round(worldW * dpr);
        seaCanvas.height = Math.round(worldH * dpr);
        seaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seaCtx.lineWidth = 1.6;
        seaCtx.fillStyle = '#16202B';   /* opaque ink to start — nothing behind this canvas should ever show through on the very first frame */
        seaCtx.fillRect(0, 0, worldW, worldH);
        if (!keepField) reseed();
        viewW = w; viewH = h; seaCanvasW = worldW; seaCanvasH = worldH;
        var cx = camX < 0 ? (worldW - w) / 2 : clamp(camX, 0, worldW - w);
        var cy = camY < 0 ? (worldH - h) / 2 : clamp(camY, 0, worldH - h);
        setCam(cx, cy, false);
        return true;
      };

      /* the source's move(), per particle: sum every eddy's radial + angular
         contribution, advance the particle, stroke old→new, then colour
         that stroke by how far it just moved. */
      var moveSea = function () {
        seaCtx.fillStyle = FADE;
        seaCtx.fillRect(0, 0, dimx, dimy);
        for (var k = 0; k < NB_PARTICLES; k++) {
          var part = particles[k];
          if (part.TTL <= 0) { part = createParticle(); particles[k] = part; }
          var px = part.x, py = part.y;
          for (var e = 0; e < eddies.length; e++) {
            var ed = eddies[e];
            var dx = px - ed.x, dy = py - ed.y;
            var r = Math.hypot(dx, dy); if (r < 0.001) r = 0.001;
            var s = dy / r, c = dx / r;
            var deltar = r - ed.radius;
            var av = ed.coeffA2 * Math.exp(-deltar * deltar / ed.coeffA1) * ed.dir;  /* angular velocity */
            var rv = -deltar * ed.coeffR;                                            /* radial velocity */
            part.x += rv * c - av * r * s;
            part.y += rv * s + av * r * c;
          }
          part.TTL--;
          var speed = Math.hypot(px - part.x, py - part.y);
          /* the source's stroke is coloured by that frame's speed (hue =
             min(speed*100,300)); here hue is fixed per particle (see
             createParticle) and speed drives LIGHTNESS instead — same
             underlying idea, "motion reads as brighter", without ever
             producing a hue this palette doesn't own. 0.7 is tuned
             against this field's actual per-frame speeds (roughly
             0.3–1.5px, measured) so the range is used, not clipped at
             one end; capped at 66% so the fastest stroke still stays
             mid-tone, never pastel-bright.
             Floor raised from an earlier 26% to 34%: near-stationary
             particles (deltar≈0 both very close to an eddy's centre and
             far past its ring — see move() above) are also exactly where
             particles pile up densest, since the field keeps drawing
             more of them there. At the old 26% floor, that pile-up of
             near-minimum-lightness strokes read as a solid black patch
             right at each vortex's core — "too dense = black" was really
             "too dense AND too dark at once", not the fade. Raising the
             floor means even the slowest, most-overlapped cluster still
             paints as a muted colour, never black. */
          var light = 34 + Math.min(speed * 0.7, 1) * 32;
          seaCtx.beginPath();
          seaCtx.moveTo(px, py);
          seaCtx.lineTo(part.x, part.y);
          seaCtx.strokeStyle = 'hsl(' + part.hue.toFixed(0) + ',44%,' + light.toFixed(0) + '%)';
          seaCtx.stroke();
        }
      };

      /* ---- live contrast: read the pixels actually behind the active
         phrase, not a guess about what the palette "should" produce.
         A static background could be sampled once and trusted; this one
         can't — particles genuinely pile up brighter wherever several of
         them happen to pass at once, so a patch under the text can drift
         lighter at any moment regardless of the fixed hue/lightness caps
         above. Reading the true pixels is what makes "readable" a
         guarantee instead of a hope. Threshold and both outcomes are the
         same cream/ink pairing every other backdrop on this site already
         uses for light-on-dark vs dark-on-light text; --panel-fg is set
         on the <section> itself so it cascades to whichever panel is
         actually showing (.era__mix, .era__w--key, .era__phrase, .era__note
         in telaventis-fx.css all read it, with var(--cream) as the
         resting-state fallback if this never runs at all). */
      var sampleActiveTextFg = function () {
        var activeText = era.querySelector('.era__panel.is-active .era__mix, .era__panel.is-active .era__phrase');
        if (!activeText) return;
        var cr = seaCanvas.getBoundingClientRect();
        var tr = activeText.getBoundingClientRect();
        var x0 = Math.max(0, tr.left - cr.left), y0 = Math.max(0, tr.top - cr.top);
        var ww = Math.min(tr.width, cr.width - x0), hh = Math.min(tr.height, cr.height - y0);
        if (ww <= 4 || hh <= 4) return;
        var sx = Math.round(x0 * seaDpr), sy = Math.round(y0 * seaDpr);
        var sw = Math.max(1, Math.round(ww * seaDpr)), sh = Math.max(1, Math.round(hh * seaDpr));
        var data;
        try { data = seaCtx.getImageData(sx, sy, sw, sh).data; } catch (e) { return; }
        var stride = Math.max(4, Math.round(16 * seaDpr));
        var sum = 0, n = 0;
        for (var y = 0; y < sh; y += stride) {
          for (var x = 0; x < sw; x += stride) {
            var idx = (y * sw + x) * 4;
            sum += (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
            n++;
          }
        }
        if (!n) return;
        var dark = (sum / n) < 0.5;
        era.style.setProperty('--panel-fg', dark ? 'var(--cream)' : 'var(--ink)');
        era.style.setProperty('--panel-fg-rgb', dark ? '237,233,226' : '22,32,43');
        era.style.setProperty('--panel-shadow-rgb', dark ? '10,16,22' : '237,233,226');
      };

      /* idx is ignored (no per-panel scene table like the desktop's
         AURORA_SCENES — the field itself is the whole backdrop, there is
         nothing panel-specific to look up); `pending` is what matters.
         true = the trigger just stepped one leg of a longer catch-up and
         the true scroll position (raw) still hasn't been reached, so
         this call is skipped outright — reseeding here would be exactly
         the flicker being fixed. false = target has actually caught up
         to raw, i.e. the scroll has genuinely settled on this panel (the
         common case — one step, immediately settled — reaches this
         branch on its very first and only call), so this is the one
         real reseed for wherever the visitor ended up. Net effect: a
         single fast fling across the whole track still only ever
         reseeds once, right at the end, not once per intermediate step. */
      /* No setSeaScene(): the field is NOT reseeded when the scroll moves
         from one phrase to the next. Reseeding swaps every eddy and every
         particle at once, which is exactly the "different positions" flash
         being reported — and unlike the source demo (which only ever
         reseeds on an explicit click or a resize) there is nothing here
         that needs it: the field is a continuously living backdrop, not a
         per-panel illustration. Panel changes are carried entirely by the
         text crossfade above. Seeded once, then left alone. */

      var seaNeedsReseed = true;   /* true for the very first build; after that, only a genuine width change (set by onResize, below) asks for another — a height-only resize (mobile address-bar collapse) does not */
      var seaFrame = 0;
      var renderSea = function () {
        if (!seaBuilt) {
          seaBuilt = buildSea(!seaNeedsReseed);
          seaNeedsReseed = false;
          if (!seaBuilt) return;
        }
        moveSea();
        /* every 4th frame (~15×/s at 60fps) — frequent enough that a
           brightening patch under the text gets caught well within a
           blink, cheap enough (getImageData forces a GPU→CPU readback)
           to not be worth paying for on every single frame */
        seaFrame++;
        if (seaFrame % 4 === 0) sampleActiveTextFg();
      };

      onResize(function () {
        if (!eraSticky) return;
        var w = eraSticky.clientWidth, h = eraSticky.clientHeight;
        /* The common mobile case — the address bar sliding in or out
           mid-scroll — changes height only, and thanks to SEA_HEADROOM the
           new height still fits inside the canvas that is already drawn. So
           there is nothing to do at all: no rebuild, no wipe, no reseed. The
           field just keeps running, which is the whole point. Compared
           against viewW/viewH (the viewport this was last built for), not
           seaCanvasW/H (the world buffer itself, deliberately bigger). */
        if (w === viewW && h <= seaCanvasH) return;
        /* A genuine WIDTH change (rotation, desktop window resize) is a real
           layout change and does start over, exactly as the source demo does
           on resize. A height change big enough to outgrow the headroom only
           needs the canvas re-made at the larger size — the field itself
           carries over untouched. */
        if (Math.abs(w - viewW) > 2) seaNeedsReseed = true;
        seaBuilt = false;
      });
      }

      /* How long a departed panel's bubble words keep dissolving after the
         panel itself starts fading — matched to .era__body's own opacity
         duration in telaventis-fx.css (see the comment there) and close to
         the camera's glide to the next vantage (gpu.setView's own ms
         below), so the fade, the rise-and-scatter, and the camera still
         read as one beat and not three separate cuts. Brought down from an
         earlier, more deliberate 1.4s that ended up reading as sluggish —
         this is still real time, not scroll-scrubbed, so it always plays
         out at this same pace regardless of how fast the visitor scrolled
         to trigger it; only the pace itself changed. */
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

        /* every fresh phrase after the first pans the mobile camera to a
           new spot in the same world (see panSea above) — not on the very
           first activation, which is the section arriving on screen, not
           a phrase change. */
        if (isMobileEra && state === 'active') {
          if (seaHasActivated) panSea();
          seaHasActivated = true;
        }

        if (kinds[i] && state === 'active') {
          /* fresh entry, either direction: replay from the start. Only the
             couple of key words show as particles here — the rest stays
             plain text the whole time this panel is being read. */
          words[i].forEach(function (w) { w.glyph.reveal(w.key); w.glyph.reset(); });
          exitT0[i] = 0;
        } else if (kinds[i] && wasActive) {
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
            headings[i].classList.add('is-in');
          } else {
            headings[i].classList.remove('is-in');
          }
        }
      };

      /* Only now does the CSS switch from the plain stacked resting state to
         the pinned one — a throw anywhere above leaves the section readable. */
      era.setAttribute('data-era-live', '');

      /* Seed the mobile field NOW, while the visitor is still up on the
         hero, rather than lazily on the first frame the section is actually
         on screen. Two reasons, both about the arrival being settled before
         anyone can see it:
         · The pinned layout only exists once [data-era-live] is set, one
           line above — which is why this sits here and not inside the
           mobile branch itself: only from this point does .era__sticky have
           its real 100dvh box to measure.
         · Building lazily meant the very first frame of the field was drawn
           at whatever instant the section scrolled into view, i.e. in the
           middle of the arriving scroll, and any panel step that same
           gesture triggered landed on top of it. Deciding it up front makes
           the first phrase's backdrop a fact before the scroll starts, so
           there is nothing left to re-decide on the way in.
         renderSea() keeps its own lazy build as a fallback for the one case
         this cannot cover: a layout that still measures 0 here (display
         none, a font/layout pass not yet flushed), where seaBuilt stays
         false and the first on-screen frame builds it exactly as before. */
      if (isMobileEra && typeof buildSea === 'function' && !seaBuilt) {
        seaBuilt = buildSea(false);
        if (seaBuilt) seaNeedsReseed = false;
      }

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
         glitching through them. 1000ms — the longest of the handful of
         fixed-duration animations a step kicks off (the jelly/camera
         glide on desktop, AURORA_DUR, matching gpu.setView's own 1000ms;
         the seascape pan on mobile, SEA_DUR, the same number for the same
         reason; the .era__body crossfade and EXIT_MS bubble dissolve both
         finish sooner, at 850ms) — so none of them is ever cut short by
         the next step starting underneath it. A literal here rather than
         a reference to either AURORA_DUR or SEA_DUR: this line is shared
         code that runs regardless of which of the two branches above
         actually mounted, and whichever one did NOT run never assigned
         its constant — see the comment where the two branches split. */
      var STEP_COOLDOWN_MS = 1000;
      var lastStepAt = 0;

      var render = function (now) {
        var rect = track.getBoundingClientRect();
        var vh = window.innerHeight || 800;
        /* fire a good margin before strictly on screen — init takes real
           time (download, shader compilation, a physics bake), and the 2D
           canvas is what covers that gap regardless of exactly when this
           finishes. Checked ahead of the onScreen early-return below on
           purpose, so it still gets a chance to fire on approach, not only
           once the stricter definition is already met. */
        if (loadGpu && rect.top < vh * 1.8 && rect.bottom > 0) loadGpu();
        var onScreen = rect.top < vh && rect.bottom > 0;
        if (!onScreen || doc.hidden) return false;

        var scrollable = Math.max(1, track.offsetHeight - vh);
        var p = clamp(-rect.top / scrollable, 0, 1);
        if (cue) cue.style.opacity = (1 - range(p, 0.02, 0.12)).toFixed(2);

        /* which panel the trigger currently says is active — a plain
           threshold, nudged by hysteresis at the exact crossing line so a
           pixel of scroll jitter there cannot flip it back and forth */
        var raw = clamp(Math.floor(p * n), 0, n - 1);
        var next = target;
        if (target < 0) {
          /* first entry only: land directly on whatever panel is already
             in view — there is nothing playing yet for a skipped step to
             have skipped */
          next = raw;
        } else if (raw !== target && now - lastStepAt >= STEP_COOLDOWN_MS) {
          var dirStep = raw > target ? 1 : -1;
          var boundary = (dirStep > 0 ? target + 1 : target) * seg;
          next = Math.abs(p - boundary) < HYST ? target : target + dirStep;
        }

        if (next !== target) {
          var dir = target < 0 ? 1 : (next > target ? 1 : -1);
          target = next;
          lastStepAt = now;
          if (!isMobileEra) {
            setAuroraScene(target, now);
            /* the real camera flying to a different vantage point in
               actual 3D space — the same trigger, the same idea as
               setAuroraScene above, just driven by a real perspective
               camera instead of a 2D x/y/scale interpolation */
            if (gpu && gpu.setView) {
              var gscene = GPU_SCENES[target % GPU_SCENES.length];
              gpu.setView(gscene[0], gscene[1], 1000);
            }
          }
          for (var i = 0; i < n; i++) {
            applyState(i, i < target ? 'after' : (i > target ? 'before' : 'active'), now, dir);
          }
        }
        if (isMobileEra) { if (renderSea) renderSea(now); }
        else { renderAurora(now); renderRipple(now); }

        /* the same live cursor already tracked for the word-glyph canvases
           (ptr, above) also nudges any medusa it passes near — the sim
           already has this built in (Medusa.updatePointerInteraction, a
           small speed boost that decays on its own) and only needed a way
           in, since the canvas itself is deliberately pointer-events:none.
           No-op on the 2D fallback (gpu.setPointer only exists once the
           WebGPU module is actually loaded). */
        if (gpu && gpu.setPointer) gpu.setPointer(ptr.active ? ptr.x : -99999, ptr.active ? ptr.y : -99999);

        /* the active panel's words need frames throughout, same as always;
           a just-departed panel's two bubble words additionally get
           EXIT_MS of extra frames with evap climbing 0→1, so they keep
           rising and dissolving after the crossfade has already started
           rather than just fading flat in place. Every other panel — not
           active, not still within its own EXIT_MS window — gets none,
           same as before. */
        for (var pi = 0; pi < n; pi++) {
          if (!kinds[pi]) continue;
          var isActivePanel = pi === target && bodyState[pi] === 'active';
          var exitAge = exitT0[pi] ? now - exitT0[pi] : -1;
          var isExiting = exitAge >= 0 && exitAge < EXIT_MS;
          if (!isActivePanel && !isExiting) continue;
          var list = words[pi];
          for (var k = 0; k < list.length; k++) {
            var wobj = list[k];
            if (isExiting && !wobj.key) continue; /* only the two bubble words dissolve; the rest already left with the panel's own fade */
            var built = wobj.glyph.ensure();
            if (!built) continue;
            /* reveal is a one-shot set inside applyState — except right
               there, the very first time a panel becomes active, its words
               have not been built yet, so reveal() on an unbuilt glyph
               silently no-ops. Re-asserting it here, once built, is what
               actually shows a key word the moment it exists. Harmless to
               repeat every frame — it is a plain class toggle. Skipped
               during the exit pass: reveal() only knows on/off, and off
               would cut the dissolve short instead of letting it play. */
            if (isActivePanel) wobj.glyph.reveal(wobj.key);
            var opts = { ptr: ptrFor(wobj.glyph.canvas) };
            if (isExiting) opts.evap = clamp(exitAge / EXIT_MS, 0, 1);
            wobj.glyph.render(now, opts);
          }
          if (isExiting && exitAge >= EXIT_MS) exitT0[pi] = 0;
        }

        return true;
      };

      addJob(render);
      onResize(function () {
        words.forEach(function (list) { list.forEach(function (w) { w.glyph.remeasure(); }); });
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
