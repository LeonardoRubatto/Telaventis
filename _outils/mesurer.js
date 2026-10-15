// Mesure la première visite à froid de l'accueil sur une connexion lente.
//
//   cd _outils && npm install                      (une fois : playwright-core)
//   python lent.py 3g                              (dans un autre terminal)
//   node mesurer.js http://127.0.0.1:8762/index.html            ordinateur
//   node mesurer.js http://127.0.0.1:8762/index.html --mobile   téléphone 390 px
//   node mesurer.js <url> --film=out/dossier        garde les images (1, 2, 3, 5, 8 s)
//
// Ce que ça donne, et ce que ça vérifie (objectifs : MODE-EMPLOI §7) :
//   FCP, LCP (et quel élément), CLS (et quels éléments ont bougé), fin du
//   chargement, octets reçus à ces trois instants, si l'animation du titre a joué ou si le titre s'est
//   simplement affiché, et les fichiers lourds demandés avant le premier écran.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a));
const flag = k => { const a = args.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const mobile = !!flag('mobile');
const film = flag('film');
if (!url) { console.error('usage : node mesurer.js <url> [--mobile] [--film=dossier]'); process.exit(1); }

(async () => {
  // CHROMIUM=<chemin> si le navigateur de playwright-core n'est pas celui installé
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const reqs = [];
  const t0 = Date.now();
  page.on('response', r => {
    const u = r.url().replace(/^https?:\/\/[^/]+/, '');
    const len = +(r.headers()['content-length'] || 0);
    reqs.push({ t: Date.now() - t0, u, len });
  });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__m = { cls: [], lcp: [], paint: {} };
    new PerformanceObserver(l => l.getEntries().forEach(e => { window.__m.paint[e.name] = Math.round(e.startTime); })).observe({ type: 'paint', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => window.__m.lcp.push([Math.round(e.startTime), (e.element && (e.element.className || e.element.tagName)) || '?']))).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__m.cls.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources || []).map(s => s.node && (s.node.className || s.node.nodeName)).filter(Boolean).slice(0, 3).join('|')]); })).observe({ type: 'layout-shift', buffered: true });
  });
  if (film) fs.mkdirSync(film, { recursive: true });
  const target = url + '';
  const go = page.goto(target, { waitUntil: 'load', timeout: 120000 }).catch(e => errors.push('goto: ' + e.message));
  const shots = [1, 2, 3, 5, 8];
  const tStart = Date.now();
  for (const s of shots) {
    const wait = s * 1000 - (Date.now() - tStart);
    if (wait > 0) await page.waitForTimeout(wait);
    if (film) await page.screenshot({ path: path.join(film, `t${s}.png`) }).catch(() => {});
  }
  await go;
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const h = document.querySelector('.h-hero');
    return {
      paint: window.__m.paint, lcp: window.__m.lcp, cls: window.__m.cls,
      clsTotal: +window.__m.cls.reduce((a, b) => a + b[1], 0).toFixed(4),
      load: Math.round(nav.loadEventEnd), htmlClass: document.documentElement.className,
      title: h && h.className,
      eraLive: document.querySelector('[data-era]') && document.querySelector('[data-era]').hasAttribute('data-era-live'),
      trackH: document.querySelector('.era__track') && document.querySelector('.era__track').offsetHeight,
    };
  });
  const kb = n => Math.round(n / 1024);
  const upto = t => kb(reqs.filter(r => r.t <= t).reduce((a, r) => a + r.len, 0));
  const fcp = m.paint['first-contentful-paint'] || 0, lcp = (m.lcp[m.lcp.length - 1] || [0])[0];
  console.log(JSON.stringify({ viewport: mobile ? '390x844' : '1440x900', tier: m.tier, htmlClass: m.htmlClass, fcp, lcp, lcpEl: (m.lcp[m.lcp.length - 1] || [])[1], clsTotal: m.clsTotal, cls: m.cls, load: m.load,
    KB_beforeFCP: upto(fcp), KB_beforeLCP: upto(lcp), KB_beforeLoad: upto(m.load), titleClass: m.title, eraLive: m.eraLive, trackH: m.trackH, errors }, null, 1));
  console.log('\nfichiers > 20 Ko, dans l\'ordre d\'arrivée :');
  reqs.filter(r => r.len > 20000).forEach(r => console.log(String(r.t).padStart(6), 'ms', String(kb(r.len)).padStart(5), 'Ko', r.u));
  await browser.close();
})();
