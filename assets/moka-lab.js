/* Atelier Moka — native-scroll choreography for #direction-lab.
   Self-contained: delete this file's <script> tag (+ the CSS <link> and the
   <section id="direction-lab"> block) to remove the experiment entirely.
   The only thing here that is NOT part of that experiment is renderProjects()
   below, which adds a very small scroll parallax to the #selected-work case
   studies (a separate, independent improvement) — safe to keep either way.
   Single rAF-gated scroll/resize listener; nothing runs while idle. */
(function(){
  var stories=document.querySelectorAll('[data-moka-story]');
  if(!stories.length)return;
  var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var clamp=function(n,a,b){return Math.max(a,Math.min(b,n));};
  var range=function(p,a,b){return clamp((p-a)/(b-a),0,1);};
  var ease=function(t){return 1-Math.pow(1-t,3);};
  var raf=0;
  var projects=Array.prototype.slice.call(document.querySelectorAll('#selected-work .proj'));
  var renderProjects=function(){
    var vh=window.innerHeight||800;
    projects.forEach(function(el,i){
      var r=el.getBoundingClientRect();
      if(r.bottom<0||r.top>vh)return;
      var t=clamp(((r.top+r.height*.5)-vh*.5)/(vh+r.height),-.5,.5)*2;
      var amp=i===2?8:13;
      el.style.setProperty('--proj-shift',(-t*amp).toFixed(2)+'px');
    });
  };

  stories.forEach(function(story){
    var track=story.querySelector('.moka-story__track');
    var browser=story.querySelector('[data-moka-browser]');
    var viewport=story.querySelector('[data-moka-viewport]');
    var page=story.querySelector('[data-moka-page]');
    var fragments=Array.prototype.slice.call(story.querySelectorAll('[data-moka-fragment]'));
    var progress=story.querySelector('[data-moka-progress]');
    var phaseWrap=story.querySelector('.moka-story__phase');
    var phaseNum=story.querySelector('[data-moka-phase-num]');
    var phaseName=story.querySelector('[data-moka-phase-name]');
    var endcard=story.querySelector('[data-moka-endcard]');
    var phaseNames=(function(){
      var lang=document.documentElement.lang||'fr';
      if(lang.indexOf('en')===0)return ['Gather','Give it direction','Bring it to life','Make it useful','Make it yours'];
      if(lang.indexOf('it')===0)return ['Raccogliere','Dare una direzione','Far vivere','Rendere utile','Renderlo tuo'];
      return ['Rassembler','Donner une direction','Faire vivre','Rendre utile','Vous appartient'];
    })();
    /* Phase text used to just get overwritten in place, every frame the
       index changed — legible enough once made bigger (see the CSS), but
       an instant swap still read as a glitch rather than a deliberate
       change. This is the clean version: the outgoing phrase swipes up
       and fades (.is-out, a normal transition), then — the instant the
       new text is written in — .is-in snaps it to "below and invisible"
       with transition:none (no visible jump because nothing is animating
       yet), and one rAF later .is-in comes off so the browser animates
       FROM that snapped start back to rest. Net motion: old rises and
       fades out, new rises and fades in, one swipe, ~0.3s, no scroll-
       linked flourish stacked on top of it. */
    var phasePainted=false, phaseTimer=0;
    var setPhaseText=function(i){
      if(phaseNum)phaseNum.textContent=('0'+i).slice(-2);
      if(phaseName)phaseName.textContent=phaseNames[i];
    };
    var swapPhase=function(i){
      if(!phaseWrap){setPhaseText(i);return;}
      if(phaseTimer)clearTimeout(phaseTimer);
      phaseWrap.classList.remove('is-in');
      phaseWrap.classList.add('is-out');
      phaseTimer=setTimeout(function(){
        setPhaseText(i);
        phaseWrap.classList.remove('is-out');
        phaseWrap.classList.add('is-in');
        void phaseWrap.offsetWidth;   /* force the .is-in (transition:none) start state to actually apply before it's removed */
        phaseWrap.classList.remove('is-in');
        phaseTimer=0;
      },260);
    };
    var canvas=story.querySelector('[data-moka-canvas]');
    var maxInner=0;
    var measure=function(){maxInner=Math.max(0,page.scrollHeight-viewport.clientHeight);};
    measure();
    if('ResizeObserver' in window)new ResizeObserver(measure).observe(viewport);

    var render=function(dt){
      var rect=track.getBoundingClientRect();
      var scrollable=Math.max(1,track.offsetHeight-window.innerHeight);
      var target=clamp(-rect.top/scrollable,0,1);
      /* Mobile only, by design: this whole smoothing mechanism exists to
         fix touch-flick jerkiness (native momentum scroll delivering
         position in uneven steps). Desktop scrolling (wheel/trackpad,
         no OS momentum layer fighting the main thread the same way)
         never had that complaint, so it keeps the original direct,
         1:1 scroll-to-progress behaviour — checked fresh every render
         rather than cached, so resizing across the breakpoint (or
         rotating a tablet) picks it up immediately. 759px matches the
         site's one general mobile breakpoint everywhere else. */
      var isMobile=window.innerWidth<=759;
      /* Chase the scroll-derived target instead of snapping to it every
         frame — raw scroll position (especially touch momentum on mobile)
         made the choreography feel jerky. The catch-up is expressed as a
         decay against real elapsed time (dt, ms), not a fixed fraction per
         frame: during a fast flick, the main thread that runs this rAF
         loop is often delayed or starved while the OS compositor drives
         native momentum scrolling, so frames arrive late and unevenly
         spaced. A fixed per-frame ratio has no idea how much real time
         just passed, so it either crawls (frames arriving on schedule) or
         — worse — lets a big gap build up during the flick and then
         visibly races to close it once frames resume, reading as
         "detached" from the gesture rather than smoothed. Tying the decay
         to dt keeps the catch-up consistent in wall-clock time regardless
         of how choppy frame delivery gets, so it stays visibly tethered
         to the scroll while still easing out the raw jitter. TAU is the
         time (ms) to close ~63% of the remaining gap. */
      var TAU=120;
      var settled=story._mokaP==null;
      var p;
      if(settled||!isMobile){
        p=target;
      }else{
        var dtEff=dt||16;
        var k=1-Math.exp(-dtEff/TAU);
        var wanted=story._mokaP+(target-story._mokaP)*k;
        /* Safety net, not the main fix: the real cause of a big single-
           frame jump was the mobile track being short enough that one
           fast flick could cover a large slice of the whole story (see
           the mobile .moka-story__track height in moka-lab.css) — fixed
           at the source there. This cap just guards the remaining edge
           case, a frame that follows a skipped one (dt large, e.g. the
           main thread busy while native momentum scroll runs): without
           it, the dt-scaled decay above would close most of a large gap
           in that one frame — a sudden lurch rather than continued
           motion. MAXRATE is in progress per ms: 1/350 means even a
           full 0→1 sweep can't visually complete in under ~350ms, no
           matter how big a single jump the target made. Loose on
           purpose — it should essentially never bind now. */
        var MAXRATE=1/350;
        var maxStep=MAXRATE*dtEff;
        var delta=wanted-story._mokaP;
        if(delta>maxStep)delta=maxStep;
        else if(delta<-maxStep)delta=-maxStep;
        p=story._mokaP+delta;
      }
      if(Math.abs(target-p)<.0004)p=target;
      story._mokaP=p;
      var assemble=ease(range(p,.02,.20));
      var open=ease(range(p,.12,.30));
      var inner=range(p,.28,.84);
      /* the resolve card only had a ~3% scroll window fully visible before
         the section unpinned — easy to blow straight through and never
         actually read. Same start (right as the page finishes scrolling to
         its final section), but full opacity lands sooner and holds for
         the rest of the track instead of arriving right as it's cut off. */
      var finish=ease(range(p,.84,.92));
      var fadeSources=1-range(p,.14,.27);

      if(progress)progress.style.transform='scaleY('+p.toFixed(4)+')';
      if(browser){browser.style.setProperty('--open',open.toFixed(4));browser.style.opacity=(open*(1-.13*finish)).toFixed(4);browser.style.transform='translate(-50%,-50%) scale('+(0.72+open*.28-finish*.055).toFixed(4)+')';}
      if(page)page.style.transform='translate3d(0,'+(-maxInner*inner).toFixed(2)+'px,0)';
      /* Fragments are clamped against the canvas's *actual* rendered size
         (not a guessed scale constant) so they can never overflow the
         viewport at any width — this is what was cut off on mobile before. */
      var cw=canvas?canvas.clientWidth:9999, ch=canvas?canvas.clientHeight:9999;
      fragments.forEach(function(el,i){
        var x=Number(el.dataset.x)||0,y=Number(el.dataset.y)||0,r=Number(el.dataset.r)||0;
        var fw=el.offsetWidth||180,fh=el.offsetHeight||56;
        var maxX=Math.max(16,cw/2-fw/2-6),maxY=Math.max(16,ch/2-fh/2-6);
        /* Each fragment gets its own slice of the assembly window instead of
           all six moving in lockstep — the scattered material now converges
           the way a handful of things actually get gathered, one after the
           other, rather than as a single collapsing formation. */
        var ui=ease(range(p,.02+i*.013,.20+i*.013));
        var remain=1-ui;
        /* …and each travels a quadratic bezier towards the centre rather
           than a straight lerp: the control point is the midpoint of its own
           start vector pushed perpendicular to it, alternating side, so the
           six arrive on arcs that sweep in from different directions. Same
           technique as the fx-path curve in telaventis-fx.js — the anchors
           are known, the handle is derived from them, nothing is hard-coded
           per fragment, so it holds at every viewport width. */
        var len=Math.sqrt(x*x+y*y)||1;
        var amp=Math.min(160,len*.44)*(i%2?1:-1);
        var ctrlX=x*.5+(-y/len)*amp, ctrlY=y*.5+(x/len)*amp;
        var mt=1-ui;
        var bx=mt*mt*x+2*mt*ui*ctrlX;   /* end point is the centre, (0,0), */
        var by=mt*mt*y+2*mt*ui*ctrlY;   /* so its term drops out entirely   */
        var drift=(i%2?1:-1)*10*range(p,0,.14);
        var ox=clamp(bx+drift*remain,-maxX,maxX);
        var oy=clamp(by,-maxY,maxY);
        /* a little extra spin along the arc, unwinding to flat on arrival */
        var rot=r*remain+amp*.055*remain*ui*4;
        el.style.transform='translate3d(calc(-50% + '+ox.toFixed(1)+'px),calc(-50% + '+oy.toFixed(1)+'px),0) rotate('+rot.toFixed(2)+'deg) scale('+(1-.07*assemble).toFixed(3)+')';
        el.style.opacity=(fadeSources*(.72+.28*remain)).toFixed(3);
      });
      if(endcard){endcard.style.opacity=finish.toFixed(3);endcard.style.transform='translate(-50%,'+(28-28*finish).toFixed(1)+'px)';}

      var phase=p<.14?0:p<.34?1:p<.58?2:p<.82?3:4;
      if(phase!==story._mokaPhase){
        story._mokaPhase=phase;
        if(!phasePainted){setPhaseText(phase);phasePainted=true;}
        else swapPhase(phase);
      }

      return p!==target;
    };
    story._mokaRender=render;
    if(reduce){
      fragments.forEach(function(el){el.style.opacity='0';});
      if(browser){browser.style.setProperty('--open','1');browser.style.opacity='1';browser.style.transform='translate(-50%,-50%) scale(1)';}
      if(page)page.style.transform='translate3d(0,0,0)';
    }
  });

  var lastT=0;
  var tick=function(t){
    raf=0;
    /* dt clamped to 200ms: guards the first-ever frame (lastT still 0)
       and any long gap (tab backgrounded, rAF throttled) from being
       read as "a lot of real time passed, snap straight to target". */
    var dt=lastT?clamp(t-lastT,0,200):16;
    lastT=t;
    var settling=false;
    stories.forEach(function(s){if(s._mokaRender&&!reduce&&s._mokaRender(dt))settling=true;});
    if(!reduce)renderProjects();
    if(settling)request();
  };
  var request=function(){if(!raf)raf=requestAnimationFrame(tick);};
  window.addEventListener('scroll',request,{passive:true});
  window.addEventListener('resize',request,{passive:true});
  request();
})();
