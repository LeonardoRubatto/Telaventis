// Tous les médias d'un projet, depuis son site en ligne, en une commande.
//
//     node _outils/capturer.js <cle> [--seulement=accueil,ecrans,videos]
//
// Lit l'entrée <cle> de _outils/projets.json (champ "site" et bloc "captures")
// et produit, en refusant les cookies et en fermant les fenêtres modales :
//
//   accueil  assets/shots/<cle>.png (+ -960/-1600 .avif .webp) et
//            assets/shots/<cle>-mobile.png (+ .avif .webp)       → études de cas
//   ecrans   assets/work/<cle>-d1/-d2 (900/1440) et -m1 (420/780), .avif + .webp
//            → les écrans flottants de la page Travaux : les deux URL
//              "captures.ordinateur" et l'URL "captures.telephone"
//   videos   assets/video/<cle>-desk / -phone .webm (AV1) + .mp4 (H.264)
//            + -poster.webp : ~10 s de défilement réel de la page d'accueil,
//              en boucle (descente, pause, remontée) → vitrine et Travaux
//
// Une URL peut viser une section : "https://site.fr/#veranda". Si une section
// fait apparaître ses images en défilant, "telephone_decalage": 3750 (px sous
// le début de la section) fixe l'endroit où la capture est prise — regarder
// le résultat avant de le garder.
//
// Prérequis (une fois) :
//   cd _outils && npm install          (playwright-core)
//   npx playwright install chromium    (ou CHROMIUM=<chemin de chrome.exe>)
//   ffmpeg dans le PATH                (ou FFMPEG=<chemin de ffmpeg.exe>)
//   python avec Pillow (AVIF inclus)   (pip install pillow)
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const cle = process.argv[2];
const only = (process.argv.find(a => a.startsWith('--seulement=')) || '').slice(12).split(',').filter(Boolean);
const want = k => !only.length || only.includes(k);
if (!cle) { console.error('usage : node _outils/capturer.js <cle> [--seulement=accueil,ecrans,videos]'); process.exit(1); }
const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'projets.json'), 'utf8')).projets.find(p => p.cle === cle);
if (!P) { console.error(`« ${cle} » absent de _outils/projets.json`); process.exit(1); }
const FF = process.env.FFMPEG || 'ffmpeg';
const RAW = path.join(__dirname, 'captures', cle);
fs.mkdirSync(RAW, { recursive: true });

function chromePath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  try {
    const d = fs.readdirSync(base).filter(n => /^chromium-\d+$/.test(n)).sort().pop();
    if (d) for (const sub of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome']) {
      const p = path.join(base, d, sub); if (fs.existsSync(p)) return p;
    }
  } catch (e) {}
  return undefined; // playwright's own default
}

async function open(browser, url, desk) {
  const ctx = await browser.newContext({ viewport: desk ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: desk ? 1.5 : 2, isMobile: !desk, hasTouch: !desk });
  const page = await ctx.newPage();
  await page.goto(url.split('#')[0], { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1200);
  // refuser les cookies (le choix le plus respectueux), fermer les fenêtres
  for (let r = 0; r < 2; r++) {
    await page.evaluate(() => {
      [...document.querySelectorAll('button, a[role=button]')]
        .filter(b => /^\s*(refuser|tout refuser|reject( all)?|decline|rifiuta)\s*$/i.test(b.textContent)).forEach(b => b.click());
      [...document.querySelectorAll('[aria-label*="ermer" i], [aria-label*="close" i], .modal-close')].forEach(b => b.click());
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
  }
  return { ctx, page };
}

async function warm(page, vh) {
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += vh * 0.6) { await page.evaluate(yy => scrollTo({ top: yy, behavior: 'instant' }), y); await page.waitForTimeout(80); }
}

async function shotAt(page, url, file, offset) {
  const anchor = url.includes('#') ? url.split('#')[1] : null;
  const top = await page.evaluate(a => { const el = a && document.getElementById(a); return el ? el.getBoundingClientRect().top + scrollY : 0; }, anchor);
  const y = top + (offset || 0);
  await page.evaluate(t => scrollTo({ top: Math.max(0, t - 300), behavior: 'instant' }), y);
  await page.waitForTimeout(600);
  await page.evaluate(t => scrollTo({ top: t, behavior: 'instant' }), y);
  await page.waitForTimeout(4000);           // laisser les images apparaître
  await page.screenshot({ path: file });
  console.log('  ✓', path.relative(ROOT, file));
}

async function record(browser, desk) {
  const W = desk ? 1280 : 390, H = desk ? 800 : 844;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: desk ? 1.5 : 2, isMobile: !desk, hasTouch: !desk });
  const page = await ctx.newPage();
  await page.goto(P.site, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => [...document.querySelectorAll('button, a[role=button]')]
    .filter(b => /^\s*(refuser|tout refuser|reject( all)?|decline|rifiuta)\s*$/i.test(b.textContent)).forEach(b => b.click()));
  await page.keyboard.press('Escape');
  await warm(page, H);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => { frames.push({ data: f.data, ts: f.metadata.timestamp }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {} });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: desk ? 1920 : 780, maxHeight: desk ? 1200 : 1688 });
  await page.evaluate(vh => new Promise(done => {
    const max = Math.min(document.documentElement.scrollHeight - innerHeight, vh * 3.4);
    const S = [[0, 0, 0.9], [0, max, 5.6], [max, max, 0.9], [max, 0, 2.8], [0, 0, 0.8]];
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const total = S.reduce((a, s) => a + s[2], 0), t0 = performance.now();
    const tick = now => {
      let t = (now - t0) / 1000, acc = 0;
      if (t >= total) { scrollTo({ top: 0, behavior: 'instant' }); return done(); }
      for (const [a, b, d] of S) { if (t < acc + d) { scrollTo({ top: Math.round(a + (b - a) * ease((t - acc) / d)), behavior: 'instant' }); break; } acc += d; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), H);
  await page.waitForTimeout(150);
  await cdp.send('Page.stopScreencast');
  const tmp = path.join(RAW, desk ? 'frames-desk' : 'frames-phone');
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  let list = 'ffconcat version 1.0\n';
  frames.forEach((f, i) => {
    const fn = `f${String(i).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(tmp, fn), Buffer.from(f.data, 'base64'));
    list += `file ${fn}\nduration ${(i + 1 < frames.length ? Math.max(0.001, frames[i + 1].ts - f.ts) : 1 / 30).toFixed(4)}\n`;
  });
  list += `file f${String(frames.length - 1).padStart(5, '0')}.jpg\n`;
  fs.writeFileSync(path.join(tmp, 'list.txt'), list);
  const size = desk ? '1280:800' : '360:780';
  const base = path.join(ROOT, 'assets', 'video', `${cle}-${desk ? 'desk' : 'phone'}`);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  const common = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', `fps=30,scale=${size}:flags=lanczos,format=yuv420p`, '-an'];
  execFileSync(FF, [...common, '-c:v', 'libsvtav1', '-preset', '6', '-crf', desk ? '40' : '42', '-g', '150', base + '.webm']);
  execFileSync(FF, [...common, '-c:v', 'libx264', '-preset', 'slow', '-crf', desk ? '28' : '30', '-profile:v', 'high', '-movflags', '+faststart', base + '.mp4']);
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'f00000.jpg'), '-vf', `scale=${size}:flags=lanczos`, '-quality', '80', base + '-poster.webp']);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`  ✓ vidéo ${desk ? 'ordinateur' : 'téléphone'} : ${frames.length} images`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: chromePath() });
  const c = P.captures || {};
  if (want('accueil')) {
    console.log('accueil…');
    for (const desk of [true, false]) {
      const ctx = await browser.newContext({ viewport: desk ? { width: 1600, height: 820 } : { width: 320, height: 607 }, deviceScaleFactor: desk ? 1 : 2, isMobile: !desk, hasTouch: !desk });
      const page = await ctx.newPage();
      await page.goto(P.site, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => [...document.querySelectorAll('button, a[role=button]')]
        .filter(b => /^\s*(refuser|tout refuser|reject( all)?|decline|rifiuta)\s*$/i.test(b.textContent)).forEach(b => b.click()));
      await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(RAW, desk ? 'accueil.png' : 'accueil-mobile.png') });
      await ctx.close();
    }
  }
  if (want('ecrans')) {
    console.log('écrans clés…');
    const jobs = (c.ordinateur || []).slice(0, 2).map((u, i) => [u, true, `d${i + 1}.png`, 0]).concat(c.telephone ? [[c.telephone, false, 'm1.png', c.telephone_decalage || 0]] : []);
    for (const [url, desk, name, off] of jobs) {
      const { ctx, page } = await open(browser, url, desk);
      await warm(page, desk ? 900 : 844);
      await shotAt(page, url, path.join(RAW, name), off);
      await ctx.close();
    }
  }
  if (want('videos')) {
    console.log('vidéos…');
    await record(browser, true);
    await record(browser, false);
  }
  await browser.close();
  // conversions (AVIF/WebP aux bonnes tailles) : Pillow
  execFileSync(process.env.PYTHON || 'python', [path.join(__dirname, 'medias.py'), cle], { stdio: 'inherit' });
})().catch(e => { console.error(e); process.exit(1); });
