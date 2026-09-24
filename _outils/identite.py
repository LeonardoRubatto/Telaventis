"""Regénère toute l'identité visuelle publiée à partir d'UNE image source.

    python _outils/identite.py "C:/chemin/vers/logo.png"

L'image source est le logo complet sur son fond (le T et le mot TELAVENTIS),
carré de préférence (1254 × 1254 pour les versions actuelles). Le script en
tire, sans rien retoucher à la main :

  assets/share/telaventis-og.jpg       1200 × 630  aperçu de lien (Open Graph, Twitter)
  assets/share/telaventis-1x1.jpg      1200 × 1200 vignette Google (JSON-LD "logo" et "image")
  assets/share/telaventis-4x3.jpg      1200 × 900  JSON-LD "image"
  assets/share/telaventis-16x9.jpg     1200 × 675  JSON-LD "image"
  assets/share/telaventis-logo.png     le logo détouré (T + mot, fond transparent) — JSON-LD "logo"
  assets/favicon.svg                   le T seul détouré, raster net embarqué (onglets)
  assets/favicon-16x16.png, -32x32, -48x48, favicon.ico   (détourés)
  assets/apple-touch-icon.png          180 × 180, fond plein (iOS noircit la transparence)
  assets/icons/icon-192.png, icon-512.png  détourés ; icon-512-maskable.png fond plein (exigé)
  assets/mask-icon.svg                 silhouette du T, une couleur (onglet épinglé Safari)

Les formats larges prolongent le fond en fondu (bords du carré fondus dans la
couleur médiane des coins), sans couture visible. Les icônes ne gardent que
le T et ses décorations (le mot TELAVENTIS est illisible à cette taille) :
le script trouve le T tout seul — c'est le premier bloc de lignes non vides
en partant du haut ; le mot est le bloc suivant.

Rien à changer dans les pages HTML : elles pointent déjà vers ces fichiers.
Après une régénération, monter le paramètre ?v= des favicons dans les pages
si l'on veut forcer les navigateurs à recharger l'icône (facultatif).

Revenir à un ancien jeu d'icônes (gardé dans _outils/sources/anciennes-icones) :

    python _outils/identite.py --restaurer _outils/sources/anciennes-icones

Dépendances : Pillow et NumPy (pip install pillow numpy).
"""
import base64, io, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(ROOT, 'assets', *p)


def ground(im):
    """couleur du fond : médiane des pixels des quatre coins"""
    w, h = im.size
    px = [im.getpixel((x, y)) for x in (4, 12, w - 13, w - 5) for y in (4, 12, h - 13, h - 5)]
    return tuple(sorted(p[i] for p in px)[len(px) // 2] for i in range(3))


def blocks(im, bg, thr=38):
    """blocs de lignes contenant autre chose que le fond (haut → bas)"""
    w, h = im.size
    small = im.resize((w // 2, h // 2))
    sw, sh = small.size
    px = small.load()
    rows = []
    e = int(sw * 0.08)          # les bords (coins vignettés) ne comptent pas
    for y in range(sh):
        n = 0
        for x in range(e, sw - e, 2):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thr:
                n += 1
        rows.append(n > 2)
    out, start = [], None
    for y, on in enumerate(rows + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start > 4:
                out.append((start * 2, y * 2))
            start = None
    return out


def hbounds(im, bg, y0, y1, thr=38):
    w = im.size[0]
    px = im.load()
    e = int(w * 0.08)
    xs = [x for x in range(e, w - e, 2) for y in range(y0, y1, 6)
          if sum(abs(a - b) for a, b in zip(px[x, y], bg)) > thr]
    return (min(xs), max(xs)) if xs else (0, w)


def feathered(src, W, H, bg):
    side = min(W, H)
    sq = src.resize((side, side), Image.LANCZOS)
    if W == H:
        return sq
    c = Image.new('RGB', (W, H), bg)
    f = int(side * 0.12)
    m = Image.new('L', (side, side), 255)
    for x in range(f):
        a = int(255 * (x / f) ** 1.6)
        m.paste(a, (x, 0, x + 1, side))
        m.paste(a, (side - 1 - x, 0, side - x, side))
    c.paste(sq, ((W - side) // 2, (H - side) // 2), m)
    return c


def mark_square(src, bg, box, pad, limit_bottom=None):
    """carré centré sur le T (x0, y0, x1, y1), avec une marge relative.
    Seule la zone du T est reprise (jamais le mot en dessous, borné par
    limit_bottom), et ses bords sont fondus dans la couleur du fond — le fond
    de l'image source n'est pas parfaitement uni (vignettage), un collage
    net laisserait une couture."""
    x0, y0, x1, y1 = box
    m = int(max(x1 - x0, y1 - y0) * 0.09)
    rx0, ry0, rx1 = max(0, x0 - m), max(0, y0 - m), min(src.size[0], x1 + m)
    ry1 = min(src.size[1], y1 + m, limit_bottom or src.size[1])
    region = src.crop((rx0, ry0, rx1, ry1))
    rw, rh = region.size
    f = max(4, int(min(rw, rh) * 0.11))
    mask = Image.new('L', (rw, rh), 255)
    for i in range(f):
        a = int(255 * (i / f) ** 1.3)
        for (bx0, by0, bx1, by1) in ((i, i, rw - i, i + 1), (i, rh - i - 1, rw - i, rh - i),
                                     (i, i, i + 1, rh - i), (rw - i - 1, i, rw - i, rh - i)):
            mask.paste(a, (bx0, by0, bx1, by1))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = max(x1 - x0, y1 - y0) * (1 + 2 * pad)
    canvas = Image.new('RGB', (int(side), int(side)), bg)
    canvas.paste(region, (int(side / 2 - cx + rx0), int(side / 2 - cy + ry0)), mask)
    return canvas


def cutout(src, bg, lo=9, hi=46):
    """le logo sans son fond : alpha doux selon l'écart au fond LOCAL (le
    fond de l'image est légèrement vignetté : on l'estime par un flou large
    après avoir remplacé le motif par la couleur du fond), puis couleur
    « décontaminée » pour ne pas garder de halo crème sur les bords. Les
    feuilles gravées, proches du fond, restent en demi-transparence."""
    from PIL import ImageFilter
    import numpy as np
    a = np.asarray(src, dtype=np.float32)
    g = np.array(bg, dtype=np.float32)
    far = np.abs(a - g).sum(axis=2) > 30
    flat = a.copy()
    flat[far] = g
    local = np.asarray(Image.fromarray(flat.astype('uint8')).filter(ImageFilter.GaussianBlur(40)), dtype=np.float32)
    d = np.abs(a - local).sum(axis=2)
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    al = alpha[..., None]
    col = np.where(al > 0.02, (a - (1 - al) * local) / np.maximum(al, 0.02), a)
    out = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype('uint8')
    return Image.fromarray(out, 'RGBA')


def mark_rgba(cut, box, pad, limit_bottom=None):
    """comme mark_square, sur le logo détouré : fond transparent"""
    x0, y0, x1, y1 = box
    m = int(max(x1 - x0, y1 - y0) * 0.06)
    rx0, ry0 = max(0, x0 - m), max(0, y0 - m)
    ry1 = min(cut.size[1], y1 + m, limit_bottom or cut.size[1])
    region = cut.crop((rx0, ry0, min(cut.size[0], x1 + m), ry1))
    side = int(max(x1 - x0, y1 - y0) * (1 + 2 * pad))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(region, (int(side / 2 - (x0 + x1) / 2 + rx0), int(side / 2 - (y0 + y1) / 2 + ry0)))
    return canvas


def rounded(im, radius_ratio, bg=None):
    s = im.size[0]
    m = Image.new('L', (s * 4, s * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=int(s * 4 * radius_ratio), fill=255)
    m = m.resize((s, s), Image.LANCZOS)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(im.convert('RGBA'), (0, 0), m)
    return out


def main(path):
    src = Image.open(path).convert('RGB')
    bg = ground(src)
    bl = blocks(src, bg)
    if not bl:
        sys.exit('aucun motif trouvé sur le fond')
    ty0, ty1 = bl[0]
    tx0, tx1 = hbounds(src, bg, ty0, ty1)
    tbox = (tx0, ty0, tx1, ty1)
    print('fond', bg, '| T', tbox, '| blocs', bl)

    os.makedirs(A('share'), exist_ok=True)
    os.makedirs(A('icons'), exist_ok=True)
    # partage
    for name, (W, H) in {'telaventis-1x1': (1200, 1200), 'telaventis-4x3': (1200, 900),
                         'telaventis-16x9': (1200, 675), 'telaventis-og': (1200, 630)}.items():
        feathered(src, W, H, bg).save(A('share', name + '.jpg'), quality=88, optimize=True, progressive=True)

    # icônes : le T et ses décorations, sans le mot
    below = (ty1 + bl[1][0]) // 2 if len(bl) > 1 else None   # à mi-chemin du mot
    big = mark_square(src, bg, tbox, 0.14, below)     # grandes icônes : de l'air autour
    tight = mark_square(src, bg, tbox, 0.06, below)   # petites : le T occupe le carré
    # sans fond là où la plateforme le permet (onglets, manifeste « any »,
    # logo JSON-LD) ; avec fond là où elle l'exige : iOS remplit la
    # transparence en noir (apple-touch-icon), une icône « maskable » doit
    # couvrir tout le carré
    cut = cutout(src, bg)
    # ne garder que le T et le mot : ailleurs (coins vignettés de l'image
    # source) l'écart au fond n'est que du bruit
    keep = Image.new('L', cut.size, 0)
    from PIL import ImageDraw
    dr = ImageDraw.Draw(keep)
    mt = int(max(tx1 - tx0, ty1 - ty0) * 0.05)
    dr.rectangle((tx0 - mt, ty0 - mt, tx1 + mt, ty1 + mt), fill=255)
    if len(bl) > 1:
        wy0, wy1 = bl[1]
        wx0, wx1 = hbounds(src, bg, wy0, wy1, thr=90)   # lettres pleines : seuil strict
        dr.rectangle((wx0 - 12, wy0 - 12, wx1 + 12, wy1 + 12), fill=255)
    from PIL import ImageChops
    cut.putalpha(ImageChops.multiply(cut.getchannel('A'), keep))
    logo = cut.crop(cut.getbbox())
    logo.thumbnail((640, 640), Image.LANCZOS)
    logo.save(A('share', 'telaventis-logo.png'), optimize=True)      # T + mot, détouré
    # (enregistré plus bas, une fois limité au T et au mot)
    t_big = mark_rgba(cut, tbox, 0.06, below)
    t_tight = mark_rgba(cut, tbox, 0.02, below)
    big.resize((180, 180), Image.LANCZOS).save(A('apple-touch-icon.png'), optimize=True)
    t_big.resize((192, 192), Image.LANCZOS).save(A('icons', 'icon-192.png'), optimize=True)
    t_big.resize((512, 512), Image.LANCZOS).save(A('icons', 'icon-512.png'), optimize=True)
    # masquable : zone sûre = 80 % centraux → le T tient dans 64 % du côté
    safe = mark_square(src, bg, tbox, 0.40, below)
    safe.resize((512, 512), Image.LANCZOS).save(A('icons', 'icon-512-maskable.png'), optimize=True)
    fav = {}
    for s_ in (16, 32, 48):
        fav[s_] = t_tight.resize((s_, s_), Image.LANCZOS)
        fav[s_].save(A(f'favicon-{s_}x{s_}.png'), optimize=True)
    fav[48].save(A('favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])

    # favicon.svg : le T détouré (128 px) embarqué ; en thème sombre, un
    # liseré clair autour, sinon la moitié encre du T disparaît sur l'onglet
    buf = io.BytesIO()
    t_tight.resize((128, 128), Image.LANCZOS).save(buf, 'PNG', optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    open(A('favicon.svg'), 'w', encoding='utf-8').write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        '<style>@media (prefers-color-scheme:dark){image{filter:drop-shadow(0 0 .6px #EDE9E2) drop-shadow(0 0 .6px #EDE9E2)}}</style>'
        f'<image href="data:image/png;base64,{b64}" width="32" height="32"/></svg>\n')

    # mask-icon.svg : silhouette du T tracée depuis l'image (barre + fût)
    W = tx1 - tx0
    px = src.load()
    dark = lambda x, y: sum(abs(a - b) for a, b in zip(px[x, y], bg)) > 90
    bar_bottom = next((y for y in range(ty0 + 10, ty1) if not dark(tx0 + int(W * .03), y)), ty0 + (ty1 - ty0) // 4)
    mid_y = (bar_bottom + ty1) // 2
    xs = [x for x in range(tx0, tx1) if dark(x, mid_y)]
    sx0, sx1 = (min(xs), max(xs)) if xs else (tx0 + W * .38, tx0 + W * .62)
    k = 32 / max(W, ty1 - ty0)
    ox, oy = (32 - W * k) / 2, (32 - (ty1 - ty0) * k) / 2
    P = lambda x, y: f'{(x - tx0) * k + ox:.2f},{(y - ty0) * k + oy:.2f}'
    pts = ' '.join([P(tx0, ty0), P(tx1, ty0), P(tx1, bar_bottom), P(sx1, bar_bottom), P(sx1, ty1),
                    P(sx0, ty1), P(sx0, bar_bottom), P(tx0, bar_bottom)])
    open(A('mask-icon.svg'), 'w', encoding='utf-8').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><polygon points="{pts}" fill="#000"/></svg>\n')
    print('ok — partage, favicons, icônes et mask-icon régénérés')


ICONES = ['favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'favicon.ico',
          'apple-touch-icon.png', 'mask-icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png']


def restaurer(dossier):
    """remet en place un jeu d'icônes archivé (ex. _outils/sources/anciennes-icones)"""
    import shutil
    for n in ICONES:
        src = os.path.join(dossier, n)
        if os.path.exists(src):
            shutil.copyfile(src, A(n)); print('  ✓', n)
        else:
            print("  – absent de l'archive :", n)
    print('icônes restaurées — monter les ?v= des favicons dans les pages')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    if sys.argv[1] == '--restaurer':
        restaurer(sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, '_outils', 'sources', 'anciennes-icones'))
    else:
        main(sys.argv[1])
