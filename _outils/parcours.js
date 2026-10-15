// Joue la section des méduses (#digital-era) comme un visiteur, et note ce qui se passe.
//
//   node parcours.js <url> [--mobile] [--scenario=auto|user|user-late|assist|inertia|fling]
//
//   auto       arrive sur la section et ne touche plus à rien : le défilement automatique doit
//              enchaîner les 3 phrases, ouvrir la porte, jouer le titre Moka, puis s'arrêter.
//   user       arrive, attend que le compte à rebours ait commencé, puis défile à la molette :
//              il doit rendre la main immédiatement et ne plus jamais se relancer.
//   user-late  laisse le défilement automatique passer à la 2e phrase, puis défile : idem.
//   assist     s'arrête à ~95 % (la section à 40 px du haut) sans plus toucher à rien : la page doit
//              être amenée en douceur à 100 %, puis le défilement automatique démarre.
//   inertia    arrive puis laisse courir l'inertie d'un pavé tactile (molette qui décroît, 1,4 s) : le défilement
//              automatique ne doit PAS s'en croire coupé.
//   fling      défile à la molette, fort, depuis le haut de la page jusqu'au-delà de la section :
//              le défilement automatique ne doit jamais s'en mêler.
//
// Sortie : une ligne à chaque changement (temps, position dans la section, état de l'autoplay,
// phrase active, page retenue, porte), puis un verdict.
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a));
const flag = k => { const a = args.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const mobile = !!flag('mobile'), scenario = flag('scenario') || 'auto';
if (!url) { console.error('usage : node parcours.js <url> [--mobile] [--scenario=auto|user|user-late|assist|inertia|fling]'); process.exit(1); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url + '', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({ trackH: document.querySelector('.era__track').offsetHeight, vh: innerHeight }));
  console.log('fond : dégradé', 'piste', info.trackH, 'px, écran', info.vh);

  const snap = () => page.evaluate(() => {
    const era = document.querySelector('#digital-era'), top = era.getBoundingClientRect().top + scrollY;
    return {
      y: Math.round(scrollY - top), auto: era.getAttribute('data-auto') || '-', fill: +(era.style.getPropertyValue('--auto') || 0),
      panel: [...document.querySelectorAll('[data-era-panel]')].findIndex(p => p.classList.contains('is-active')),
      held: document.documentElement.classList.contains('fx-scroll-held'),
      door: (document.querySelector('.era__cut-in') || { classList: { contains: () => false } }).classList.contains('is-arrived'),
      cut: era.querySelector('.era__sticky').style.getPropertyValue('--cut'),
    };
  });
  const t0 = Date.now();
  const log = [];
  let last = '';
  const sample = async () => {
    const s = await snap();
    const key = [s.auto, s.panel, s.held, s.door].join('|');
    if (key !== last) { last = key; log.push({ t: Date.now() - t0, ...s }); console.log(String(Date.now() - t0).padStart(6), 'ms  y', String(s.y).padStart(6), ' auto', s.auto.padEnd(5), ' phrase', s.panel, s.held ? ' RETENU' : '', s.door ? ' titre Moka arrivé' : '', s.cut ? ' porte ' + s.cut : ''); }
    return s;
  };
  const eraTop = await page.evaluate(() => document.querySelector('#digital-era').getBoundingClientRect().top + scrollY);
  const wheel = async (dy) => { await page.mouse.move(700, 450); await page.mouse.wheel(0, dy); };

  if (scenario === 'fling') {
    await page.evaluate(y => window.scrollTo(0, y - 600), eraTop);
    for (let i = 0; i < 40; i++) { await wheel(260); await page.waitForTimeout(30); await sample(); }
    await page.waitForTimeout(3000); await sample();
  } else {
    await page.evaluate(([y, a]) => window.scrollTo(0, a ? y - 40 : y + 2), [eraTop, scenario === 'assist']);
    let did = false, countAt = 0;
    if (scenario === 'inertia') { await page.mouse.move(700, 450); for (let i = 0; i < 85; i++) { await page.mouse.wheel(0, Math.max(1, Math.round(60 * Math.exp(-i / 22)))); await page.waitForTimeout(16); } }
    const limit = 45000;
    while (Date.now() - t0 < limit) {
      await page.waitForTimeout(200);
      const s = await sample();
      if (s.auto === 'count') { if (!countAt) countAt = Date.now(); } else countAt = 0;
      const counting = countAt ? Date.now() - countAt : 0;
      if (scenario === 'user' && !did && s.auto === 'count' && counting > 1200) { did = true; console.log('       >> molette de l\'utilisateur'); await wheel(120); }
      if (scenario === 'user-late' && !did && s.panel === 1 && s.auto === 'count' && counting > 1500) { did = true; console.log('       >> molette de l\'utilisateur'); await wheel(120); }
      if (s.door && s.auto === 'off' && !s.held && scenario === 'auto') { await page.waitForTimeout(800); await sample(); break; }
      if (did && s.auto === 'off' && Date.now() - t0 > 20000 + (log[log.length - 1] || {}).t) break;
    }
  }
  const fin = await snap();
  const autos = log.filter(l => l.auto === 'move').length;
  console.log('\nétat final', JSON.stringify(fin), '| glissades automatiques :', autos, '| erreurs :', errors.length ? errors : 'aucune');
  await browser.close();
})();
