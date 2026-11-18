// Mesure la fluidité du passage « porte → histoire Moka » : amène la section méduses à 100 %,
// laisse le défilement automatique jouer jusqu'au titre Moka, puis continue dans l'histoire.
//   node moka-saccade.js <url> [--cpu=4] [--mobile] [--secs=34]
// Sortie : les images de plus de 34 ms avec l'instant, le scrollY et l'état (data-auto) du moment, + les LoAF.
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a));
const flag = k => { const a = args.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const mobile = !!flag('mobile'), cpu = +(flag('cpu') || 1), secs = +(flag('secs') || 34);
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, headless: !process.env.HEADED } : {});
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  await page.addInitScript(() => {
    window.__f = []; window.__loaf = []; window.__cb = [];
    const raf0 = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = fn => raf0(t => { const a = performance.now(); fn(t); const d = performance.now() - a; if (d > 12) window.__cb.push([Math.round(a), Math.round(d), String(fn).replace(/\s+/g, ' ').slice(0, 70)]); });
    let last = performance.now();
    const tick = t => { const e = document.getElementById('digital-era'); window.__f.push([Math.round(t), +(t - last).toFixed(1), Math.round(scrollY), e ? e.dataset.auto || '' : '', document.documentElement.className.replace(/\bjs\b/, '').trim()]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), b: Math.round(e.blockingDuration || 0), s: (e.scripts || []).map(x => (x.sourceURL || '').split('/').pop() + ':' + (x.sourceFunctionName || x.invoker) + ':' + Math.round(x.duration)).join(' | ') }))).observe({ type: 'long-animation-frame', buffered: true }); } catch (e) {}
  });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const e = document.getElementById('digital-era'); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY, behavior: 'instant' }); });
  await page.waitForTimeout(secs * 1000);
  const r = await page.evaluate(() => ({ f: window.__f, loaf: window.__loaf, cb: window.__cb, y: scrollY }));
  const t0 = r.f.find(x => x[2] > 0 && x[3]) ?.[0] ?? 0;
  console.log(`CPU x${cpu} ${mobile ? 'téléphone' : 'ordinateur'} — images ${r.f.length}, scrollY final ${r.y}`);
  r.f.filter(x => x[1] > 34 && x[0] > 3000).forEach(x => console.log(`  +${((x[0] - t0) / 1000).toFixed(2)}s  écart ${x[1]} ms  y=${x[2]}  auto=${x[3]}  html="${x[4]}"`));
  console.log('LoAF >= 50 ms :');
  r.loaf.filter(l => l.d >= 50 && l.t > 3000).forEach(l => console.log(`  +${((l.t - t0) / 1000).toFixed(2)}s durée ${l.d} bloquant ${l.b}  ${l.s}`));
  console.log('rappels rAF > 12 ms :');
  r.cb.forEach(c => console.log(`  +${((c[0] - t0) / 1000).toFixed(2)}s ${c[1]} ms  ${c[2]}`));
  await browser.close();
})();
