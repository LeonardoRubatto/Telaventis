// Simule la barre d'outils d'un téléphone qui se replie pendant qu'on arrive dans la section des
// méduses (la hauteur dvh change pendant le vol des bulles), et mesure, à CHAQUE image, la part des
// bulles qui ne sont pas sur un mot-clé. Un défaut visible = quelques images à plus de 10 %.
//   node bulles-barre.js <url> [--delta=156] [--at=300] [--rest]
//   --at   : ms après l'arrivée dans la section où la hauteur change (défaut 300, en plein vol)
//   --barre : ne change que la hauteur dvh du décor (ce que fait la barre d'outils d'iOS), pas la fenêtre
//   --rest : attend que les bulles soient au repos avant de changer la hauteur
const { chromium, webkit } = require('playwright-core');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a));
const flag = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const delta = flag('delta', 156), at = flag('at', 300), rest = args.includes('--rest');
(async () => {
  // WK=<chemin de Playwright.exe> : le moteur de Safari (WebKit) au lieu de Chromium
  const browser = process.env.WK ? await webkit.launch({ executablePath: process.env.WK }) : await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 688 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const eraTop = await page.evaluate(() => document.querySelector('#digital-era').getBoundingClientRect().top + scrollY);
  await page.evaluate(y => window.scrollTo(0, y - 1800), eraTop);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__rows = [];
    const measure = () => {
      const cv = document.querySelector('.era__morph'), r0 = cv.getBoundingClientRect();
      const sx = cv.width / r0.width, sy = cv.height / r0.height;
      const act = document.querySelector('[data-era-panel].is-active');
      if (!act) return null;
      const boxes = [...act.querySelectorAll('.era__w--key')].map(w => w.getBoundingClientRect());
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let on = 0, off = 0;
      for (let y = 0; y < cv.height; y += 4) for (let x = 0; x < cv.width; x += 4) {
        if (d[(y * cv.width + x) * 4 + 3] < 60) continue;
        const px = r0.left + x / sx, py = r0.top + y / sy;
        if (boxes.some(b => px > b.left - 14 && px < b.right + 14 && py > b.top - 14 && py < b.bottom + 14)) on++; else off++;
      }
      return { on, off };
    };
    window.__go = () => { window.__t0 = performance.now(); const f = () => { const m = measure(); if (m) window.__rows.push({ t: Math.round(performance.now() - window.__t0), ...m }); if (performance.now() - window.__t0 < 5000) requestAnimationFrame(f); }; f(); };
  });
  await page.evaluate(y => window.scrollTo(0, y + 4), eraTop);
  await page.evaluate(() => window.__go());
  await page.waitForTimeout(rest ? 3500 : at);
  if (args.includes('--barre')) {
    // la vraie barre d'outils : la fenêtre (svh) ne change pas, seule la hauteur dvh du décor change
    await page.evaluate(d => { const st = document.createElement('style'); st.textContent = '.era[data-era-live] .era__sticky{height:' + (688 + d) + 'px !important}'; document.head.appendChild(st); }, delta);
  } else await page.setViewportSize({ width: 390, height: 688 + delta });
  await page.waitForTimeout(5200 - (rest ? 3500 : at));
  const rows = await page.evaluate(() => window.__rows);
  const pct = r => r.on + r.off ? r.off / (r.on + r.off) : 0;
  const bad = rows.filter(r => pct(r) > 0.1);
  const flights = rows.filter(r => pct(r) > 0.1 && r.t < (rest ? 3500 : at));
  console.log('images mesurées', rows.length, '| images avec >10 % de bulles hors mot :', bad.length, '(dont avant le changement de hauteur :', flights.length + ')');
  const after = rows.filter(r => r.t >= (rest ? 3500 : at));
  const badAfter = after.filter(r => pct(r) > 0.1);
  console.log('après le changement de hauteur : ', badAfter.length, 'images sur', after.length, '| pire', Math.round(100 * Math.max(0, ...after.map(pct))) + '%');
  if (args.includes('--dump')) console.log(rows.map(r => r.t + ':' + Math.round(100 * pct(r))).join(' '));
  console.log('erreurs :', errors.length ? errors : 'aucune');
  await browser.close();
})();
