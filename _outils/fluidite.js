// Mesure la fluidité des premières secondes : images perdues, tâches longues, et QUI les cause.
//
//   node fluidite.js <url> [--cpu=4] [--mobile] [--lite=0|1] [--secs=6]
//
// --cpu=4 ralentit le processeur 4 fois (un portable ordinaire, un téléphone moyen) : un défaut
// de fluidité qui passe inaperçu sur un PC rapide y saute aux yeux.
// Sortie : le temps entre deux images (idéal 16,7 ms) pendant les premières secondes, les
// « long animation frames » avec le script responsable, et les dix pires images.
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a));
const flag = k => { const a = args.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const mobile = !!flag('mobile'), cpu = +(flag('cpu') || 1), secs = +(flag('secs') || 6);
if (!url) { console.error('usage : node fluidite.js <url> [--cpu=4] [--mobile] [--lite=0|1] [--secs=6]'); process.exit(1); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, headless: !process.env.HEADED, args: process.env.HEADED ? ['--window-size=1500,1000'] : [] } : {});
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  await page.addInitScript(() => {
    window.__f = []; window.__loaf = []; window.__lt = [];
    let last = performance.now();
    const tick = t => { window.__f.push([Math.round(t), +(t - last).toFixed(1)]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), blocking: Math.round(e.blockingDuration || 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts: (e.scripts || []).map(s => [s.invoker || s.type, (s.sourceURL || '').split('/').pop().split('?')[0], s.sourceFunctionName || '', Math.round(s.duration), Math.round(s.forcedStyleAndLayoutDuration || 0)]) }))).observe({ type: 'long-animation-frame', buffered: true }); } catch (e) {}
    try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  });
  await page.goto(url + (flag('lite') != null ? (url.includes('?') ? '&' : '?') + 'lite=' + flag('lite') : ''), { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(secs * 1000);
  const r = await page.evaluate(() => ({ f: window.__f, loaf: window.__loaf, lt: window.__lt, tier: window.__tvTier }));
  const frames = r.f.filter(x => x[0] < 1000 * 1000);
  const bad = frames.filter(x => x[1] > 24);
  const w = (a, b) => frames.filter(x => x[0] >= a && x[0] < b);
  console.log(`CPU x${cpu}  ${mobile ? 'téléphone' : 'ordinateur'}  version ${JSON.stringify(r.tier)}`);
  console.log(`images : ${frames.length}, plus de 24 ms : ${bad.length}, plus de 50 ms : ${frames.filter(x => x[1] > 50).length}, pire : ${Math.max(...frames.map(x => x[1]))} ms`);
  console.log('par tranche de 500 ms (nombre d\'images / pire écart) :');
  const line = [];
  for (let a = 0; a < secs * 1000 + 1500; a += 500) { const g = w(a, a + 500); if (g.length) line.push(`${(a / 1000).toFixed(1)}s:${g.length}/${Math.max(...g.map(x => x[1]))}`); }
  console.log('  ' + line.join('  '));
  console.log('\nlong animation frames (>= 50 ms) :');
  r.loaf.filter(l => l.d >= 50).forEach(l => console.log(`  ${String(l.t).padStart(5)} ms  durée ${l.d}  bloquant ${l.blocking}  style+mise en page ${l.style}\n` + l.scripts.map(s => `        ${s[0]}  ${s[1]} ${s[2]}  ${s[3]} ms (dont style/layout forcé ${s[4]})`).join('\n')));
  console.log('\ntâches longues :', r.lt.map(x => `${x[0]}ms+${x[1]}`).join('  ') || 'aucune');
  await browser.close();
})();
