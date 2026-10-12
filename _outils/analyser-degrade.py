"""Analyse des images de mesurer-degrade.js : contraste réel derrière le texte, marches, pixellisation.

    python _outils/analyser-degrade.py <dossier d'images> [dpr]
"""
import sys, glob, math
import numpy as np
from PIL import Image

folder = sys.argv[1]
dpr = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
CREAM_L = 0.8215  # luminance relative de #EDE9E2


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(a):
    r, g, b = lin(a[..., 0]), lin(a[..., 1]), lin(a[..., 2])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def oklab(a):
    r, g, b = lin(a[..., 0]), lin(a[..., 1]), lin(a[..., 2])
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


files = sorted(glob.glob(folder + '/f*.png'))
rows = []
for f in files:
    im = np.asarray(Image.open(f).convert('RGB')).astype(float)
    H, W = im.shape[:2]
    s = dpr
    # the phrase sits in the centre band
    x0, x1, y0, y1 = int(300 * s), int(1120 * s), int(340 * s), int(580 * s)
    band = im[y0:y1, x0:x1]
    L = lum(band)
    p99 = np.percentile(L, 99.5)
    worst = (CREAM_L + 0.05) / (p99 + 0.05)
    mean_c = (CREAM_L + 0.05) / (L.mean() + 0.05)
    # steps between neighbouring pixels (OKLab distance, x100 so 1.0 ~ one just-noticeable step)
    ok = oklab(im[: int(880 * s), : int(1400 * s)])
    dx = np.linalg.norm(np.diff(ok, axis=1), axis=2) * 100
    dy = np.linalg.norm(np.diff(ok, axis=0), axis=2) * 100
    step = max(np.percentile(dx, 99.9), np.percentile(dy, 99.9)); p90 = max(np.percentile(dx, 90), np.percentile(dy, 90))
    # blockiness: dither / upsampling leave a period-2 (or period-dpr) texture. Compare the neighbour step at even and odd columns.
    ev, od = dx[:, 0::2].mean(), dx[:, 1::2].mean()
    block = abs(ev - od) / max(1e-9, (ev + od) / 2)
    # grain: high-frequency residual in the darkest 20 % of the image
    g = im.mean(axis=2)
    dark = g < np.percentile(g, 20)
    hf = np.abs(g[1:-1, 1:-1] - (g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]) / 4)
    grain = hf[dark[1:-1, 1:-1]].mean()
    rows.append((f.split('/')[-1], worst, mean_c, step, block, grain, p90))

print(f'{len(rows)} images, dpr {dpr}')
print('image   contraste crème sur le point le plus clair derrière le texte | sur la moyenne | marche (ΔE×100, 99,9 %) | blocs | grain')
for r in rows:
    print(f'{r[0]}   {r[1]:5.2f}   {r[2]:5.2f}   {r[3]:5.2f}   {r[4]:.3f}   {r[5]:.2f}')
w = [r[1] for r in rows]
print(f'\npire contraste : {min(w):.2f} (WCAG AA texte normal = 4,5 ; grand texte = 3)   moyen : {np.mean([r[2] for r in rows]):.2f}')
print(f'pas typique (90 % des voisins sous) : {max(r[6] for r in rows):.2f}')
print(f'plus grande marche entre deux pixels voisins : {max(r[3] for r in rows):.2f} (sous ~1 : invisible)   motif de blocs max : {max(r[4] for r in rows):.3f} (sous 0,05 : aucun)   grain moyen : {np.mean([r[5] for r in rows]):.2f} niveaux sur 255')
