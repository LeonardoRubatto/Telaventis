"""Étude colorimétrique du fond animé de la section « Le point de départ ».

    python _outils/etude-couleurs.py

Ce que ça établit, en chiffres (OKLCH, contraste WCAG 2, pas ΔE) :
  1. où sont les couleurs du site (encre, crème, corail, bleu-vert, ciel) dans OKLCH ;
  2. pour chaque palette candidate : clarté / chroma / teinte de ses trois couleurs, contraste du
     texte crème sur chacune, et sur le MÉLANGE de chaque paire dans l'espace où le shader mélange
     (sRGB, comme dans la source) et dans OKLab (ce que fait désormais le site) ;
  3. le pas de couleur entre deux pixels voisins (ΔE OKLab) : tant qu'il reste sous ~0,4 sur une
     image réelle, le dégradé ne peut pas montrer de marches (voir mesurer-degrade.js pour
     l'image réelle).
"""
import math


def hex2rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def delin(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def oklab(rgb):
    r, g, b = [lin(c) for c in rgb]
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = [x ** (1 / 3) for x in (l, m, s)]
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s]


def from_oklab(lab):
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return [min(1, max(0, delin(max(0, x)))) for x in (r, g, bb)]


def lch(rgb):
    L, a, b = oklab(rgb)
    return L, math.hypot(a, b), (math.degrees(math.atan2(b, a)) + 360) % 360


def lum(rgb):
    r, g, b = [lin(c) for c in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix_srgb(a, b, t):
    return [x + (y - x) * t for x, y in zip(a, b)]


def mix_oklab(a, b, t):
    A, B = oklab(a), oklab(b)
    return from_oklab([x + (y - x) * t for x, y in zip(A, B)])


CREAM = hex2rgb('#EDE9E2')
TOK = {'encre --ink': '#16202B', 'crème --cream': '#EDE9E2', 'corail --coral': '#B4441C', 'corail clair --coral-2': '#E0742F',
       'bleu-vert (lueur de la section)': '#33627A', 'ciel (le bas du mot TELAVENTIS)': '#6A839B', 'corail sombre --coral-ink': '#8A3616'}
print('1. Les couleurs du site dans OKLCH (L clarté, C chroma, h teinte en degrés)')
for k, v in TOK.items():
    L, C, h = lch(hex2rgb(v))
    print(f'   {k:36s} {v}  L {L:.3f}  C {C:.3f}  h {h:5.1f}')
print('   -> l\'encre est à h ≈ 250 (bleu), le corail à h ≈ 40 : ils sont à ~170° l\'un de l\'autre, quasi complémentaires.')
print('      Le bleu-vert de la lueur (h ≈ 235) est le complément naturel du corail : c\'est lui qui fait le deuxième pôle.')

PAL = {
    'a  encre / bleu-vert / corail (actuelle)': ('#0A1017', '#15374A', '#A63F1A'),
    'b  encre / bleu-vert / ciel': ('#0A1017', '#15374A', '#3E617A'),
    'c  encre / bleu-vert / corail profond': ('#0A1017', '#123140', '#8A3616'),
    'd  encre du site / bleu-vert / corail du site': ('#0E1620', '#1B4458', '#B4441C'),
    'e  d, corail un peu adouci': ('#0E1620', '#1B4458', '#A8441F'),
}
print('\n2. Palettes candidates')
for name, cols in PAL.items():
    print('\n  ' + name)
    rgbs = [hex2rgb(c) for c in cols]
    for c, rgb in zip(cols, rgbs):
        L, C, h = lch(rgb)
        print(f'     {c}  L {L:.3f}  C {C:.3f}  h {h:5.1f}   contraste du texte crème : {contrast(CREAM, rgb):5.2f}')
    for (i, j) in ((0, 1), (1, 2)):
        for t in (0.35, 0.5, 0.65):
            s, o = mix_srgb(rgbs[i], rgbs[j], t), mix_oklab(rgbs[i], rgbs[j], t)
            ls, cs, hs = lch(s)
            lo, co, ho = lch(o)
            print(f'     mélange {i + 1}->{j + 1} à {int(t * 100)} %   sRGB : L {ls:.3f} C {cs:.3f} (texte {contrast(CREAM, s):.2f})   OKLab : L {lo:.3f} C {co:.3f} (texte {contrast(CREAM, o):.2f})')
