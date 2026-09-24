"""Convertit les captures brutes d'un projet (_outils/captures/<cle>/) aux formats du site.

    python _outils/medias.py <cle>

Appelé à la fin de capturer.js ; utile seul pour refaire les conversions
après avoir remplacé une capture à la main (même nom de fichier).

  accueil.png          → assets/shots/<cle>.png, -960 / -1600 .avif .webp
  accueil-mobile.png   → assets/shots/<cle>-mobile.png, .avif, .webp
  d1.png, d2.png       → assets/work/<cle>-d1|d2-900|1440 .avif .webp
  m1.png               → assets/work/<cle>-m1-420|780 .avif .webp
"""
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def save(im, dst, widths, png=False):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if png:
        im.save(dst + '.png', optimize=True)
    for w in widths:
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(f'{dst}-{w}.avif', quality=52, speed=6)
        r.save(f'{dst}-{w}.webp', quality=76, method=6)
        print('  ✓', os.path.relpath(f'{dst}-{w}', ROOT), '.avif .webp')


def main(cle):
    raw = os.path.join(ROOT, '_outils', 'captures', cle)
    got = lambda n: os.path.join(raw, n) if os.path.exists(os.path.join(raw, n)) else None
    if got('accueil.png'):
        im = Image.open(got('accueil.png')).convert('RGB')
        save(im, os.path.join(ROOT, 'assets', 'shots', cle), [960, 1600], png=True)
    if got('accueil-mobile.png'):
        im = Image.open(got('accueil-mobile.png')).convert('RGB')
        dst = os.path.join(ROOT, 'assets', 'shots', f'{cle}-mobile')
        im.save(dst + '.png', optimize=True)
        im.save(dst + '.avif', quality=52, speed=6)
        im.save(dst + '.webp', quality=76, method=6)
        print('  ✓', os.path.relpath(dst, ROOT), '.png .avif .webp')
    for k, ws in (('d1', [900, 1440]), ('d2', [900, 1440]), ('m1', [420, 780])):
        if got(f'{k}.png'):
            im = Image.open(got(f'{k}.png')).convert('RGB')
            save(im, os.path.join(ROOT, 'assets', 'work', f'{cle}-{k}'), ws)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
