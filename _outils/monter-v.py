"""Monte d'un cran les ?v= des feuilles et scripts du site dans TOUTES les pages (MODE-EMPLOI §6).
    python _outils/monter-v.py            monte telaventis.css/js, telaventis-fx.css/js, moka-lab.css/js d'un cran
Même numéro dans toutes les pages d'un même fichier ; refuse si les pages ne sont pas d'accord."""
import glob, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHIERS = ['telaventis.css', 'telaventis.js', 'telaventis-fx.css', 'telaventis-fx.js', 'moka-lab.css', 'moka-lab.js']
pages = [p for p in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True) if '_outils' not in p and 'node_modules' not in p]
for nom in FICHIERS:
    rx = re.compile(r'(assets/' + re.escape(nom) + r'\?v=)(\d+)')
    vus = set()
    for p in pages:
        vus.update(m.group(2) for m in rx.finditer(open(p, encoding='utf-8').read()))
    if not vus:
        continue
    if len(vus) > 1:
        sys.exit(f'{nom} : les pages ne sont pas d\'accord sur le ?v= ({sorted(vus)})')
    nv = int(vus.pop()) + 1
    for p in pages:
        s = open(p, encoding='utf-8', newline='').read()
        s2 = rx.sub(lambda m: m.group(1) + str(nv), s)
        if s2 != s:
            open(p, 'w', encoding='utf-8', newline='').write(s2)
    print(f'{nom} -> v={nv}')
