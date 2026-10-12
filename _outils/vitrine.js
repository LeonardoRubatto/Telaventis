// Joue la vitrine des projets (barre en haut + minuteur) comme un visiteur.
//
//   node vitrine.js <url> [--mobile] [--lite=0|1] [--scenario=timer|click|user|shots]
//
//   timer   arrive sur la vitrine et ne touche à rien : la barre du projet courant doit se remplir
//           (7 s), puis la vitrine passe au projet suivant, et ainsi de suite jusqu'au dernier,
//           où la barre reste pleine.
//   click   clique sur le 4e nom de la barre : on doit y aller tout droit, le minuteur repart.
//   user    laisse le minuteur tourner, puis défile à la molette : il doit rendre la main
//           (data-timer disparaît) et le projet ne doit plus changer tout seul.
//   shots   images de la barre (haut de l'écran) en cours de remplissage : --film=dossier
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const url = args.find(a => /^https?:/.test(a));
const flag = k => { const a = args.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };
const mobile = !!flag('mobile'), scenario = flag('scenario') || 'timer', film = flag('film');
if (!url) { console.error('usage : node vitrine.js <url> [--mobile] [--lite=0|1] [--scenario=timer|click|user|shots] [--film=dossier]'); process.exit(1); }
const fs = require('fs');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const vp = flag('w') ? { width: +flag('w'), height: +flag('h') } : (mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  const ctx = await browser.newContext(mobile
    ? { viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url + (flag('lite') != null ? (url.includes('?') ? '&' : '?') + 'lite=' + flag('lite') : ''), { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // traverser la section des méduses par un saut d'ancre (c'est ce que le site tolère), puis se poser sur la vitrine
  await page.evaluate(() => { location.hash = '#showcase-title'; });
  await page.waitForTimeout(4500);
  const top = await page.evaluate(() => document.querySelector('.showcase__track').getBoundingClientRect().top + scrollY);
  await page.evaluate(y => window.scrollTo(0, y + 5), top);
  const t0 = Date.now();
  if (film) fs.mkdirSync(film, { recursive: true });
  const snap = () => page.evaluate(() => {
    const show = document.querySelector('[data-showcase]');
    const sc = [...document.querySelectorAll('[data-scene]')];
    const cur = sc.findIndex(s => s.classList.contains('is-current'));
    const li = document.querySelector('.showcase__rail li.is-on');
    let fill = null;
    if (li) { const m = getComputedStyle(li, '::after').transform; fill = m && m !== 'none' ? +(+m.split(',')[0].replace('matrix(', '')).toFixed(2) : 0; }
    const bar = document.querySelector('.showcase__rail').getBoundingClientRect();
    return { cur, fill, timer: show.hasAttribute('data-timer'), timing: show.classList.contains('is-timing'), reading: show.classList.contains('is-reading'), held: document.documentElement.classList.contains('sc-held'), barTop: Math.round(bar.top), barH: Math.round(bar.height) };
  });
  let last = '';
  const sample = async () => {
    const s = await snap();
    const key = [s.cur, s.timer, s.timing, s.held].join('|');
    if (key !== last) { last = key; console.log(String(Date.now() - t0).padStart(6), 'ms  projet', s.cur, ' minuteur', s.timer ? (s.timing ? 'tourne' : 'attend') : 'ARRÊTÉ', s.held ? ' RETENU' : '', ' remplissage', s.fill); }
    return s;
  };
  await sample();

  if (scenario === 'shots') {
    for (const [name, wait] of [['debut', 2000], ['milieu', 3500], ['presque', 3000]]) {
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${film || '.'}/vitrine-${name}.png` });
      const s = await snap(); console.log(name, JSON.stringify(s));
    }
  } else if (scenario === 'click') {
    await page.waitForTimeout(2500); await sample();
    console.log('       >> clic sur le 4e nom');
    await page.locator('.showcase__rail a').nth(3).click();
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); await sample(); }
  } else if (scenario === 'user') {
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); const s = await sample(); if (s.timing && s.fill > 0.2) break; }
    console.log('       >> molette de l\'utilisateur');
    await page.mouse.move(700, 450); await page.mouse.wheel(0, 120);
    const t1 = Date.now();
    while (Date.now() - t1 < 14000) { await page.waitForTimeout(250); await sample(); }
  } else {
    const limit = 60000;
    while (Date.now() - t0 < limit) {
      await page.waitForTimeout(250);
      const s = await sample();
      if (s.cur === 4 && s.fill >= 0.99) break;
    }
    await page.waitForTimeout(2500); await sample();
  }
  console.log('\nerreurs :', errors.length ? errors : 'aucune');
  await browser.close();
})();
