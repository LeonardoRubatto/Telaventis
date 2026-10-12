// Capture le fond animé SEUL (texte masqué) à plusieurs instants, pour analyser-degrade.py.
//   node mesurer-degrade.js <url de base> <dossier> [--dpr=1|2] [--n=14] [--pas=2500]
// Le halo sombre sous la phrase, lui, reste : on mesure ce que le texte a réellement derrière lui.
const { chromium } = require('playwright-core');
const fs = require('fs');
const args = process.argv.slice(2);
const base = args[0], out = args[1];
const flag = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const dpr = +flag('dpr', 1), n = +flag('n', 14), pas = +flag('pas', 2500);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM, headless: false, args: ['--window-size=1500,1000'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr })).newPage();
  await p.goto(base, { waitUntil: 'load' });
  await p.addStyleTag({ content: '.era__stage,.era__morph,.era__ripple,.era__cue,.nav{visibility:hidden!important}' });
  await p.waitForTimeout(2000);
  const top = await p.evaluate(() => document.querySelector('#digital-era').getBoundingClientRect().top + scrollY);
  await p.evaluate(y => window.scrollTo(0, y + 2), top);
  // stop the autoplay from moving on: any wheel after the section is whole ends it for good
  await p.waitForTimeout(1300); await p.mouse.move(700, 450); await p.mouse.wheel(0, 1);
  await p.evaluate(y => window.scrollTo(0, y + 2), top);
  for (let i = 0; i < n; i++) { await p.waitForTimeout(pas); await p.screenshot({ path: `${out}/f${String(i).padStart(2, '0')}.png` }); }
  await b.close();
})();
