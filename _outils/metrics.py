import re, sys, collections, io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
root = sys.argv[1]
html = open(root + '/index.html', encoding='utf-8').read()
html = re.sub(r'<script.*?</script>|<style.*?</style>|<!--.*?-->', ' ', html, flags=re.S)
txt = re.sub(r'<[^>]+>', ' ', html)
txt = re.sub(r'&nbsp;', ' ', txt); txt = re.sub(r'&[a-z]+;', ' ', txt); txt = re.sub(r'\s+', ' ', txt)
freq = collections.Counter(txt)
def avg(font):
    cmap = font.getBestCmap(); hmtx = font['hmtx']; upm = font['head'].unitsPerEm
    tot = n = 0
    for ch, c in freq.items():
        g = cmap.get(ord(ch))
        if g is None: continue
        tot += hmtx[g][0] * c; n += c
    return tot / n / upm
def inst(path, axes):
    f = TTFont(path)
    return instancer.instantiateVariableFont(f, axes) if axes else f
def vm(f):
    h = f['hhea']; upm = f['head'].unitsPerEm; o = f['OS/2']
    return h.ascent / upm, -h.descent / upm, h.lineGap / upm
def report(name, web, fb):
    a, b = avg(web), avg(fb)
    sa = a / b
    asc, desc, gap = vm(web)
    print(f'{name}: web avg {a:.4f}  fallback avg {b:.4f}  size-adjust {sa*100:.2f}%  ascent {asc/sa*100:.2f}% descent {desc/sa*100:.2f}% gap {gap/sa*100:.2f}%')
F = 'C:/Windows/Fonts/'
arch = root + '/assets/fonts/archivo-latin.woff2'
for w in (400, 750):
    report(f'Archivo {w} vs Arial {"Bold" if w>=600 else "Regular"}', inst(arch, {'wght': w, 'wdth': 100}), TTFont(F + ('arialbd.ttf' if w >= 600 else 'arial.ttf')))
ss = root + '/assets/fonts/sourceserif4-latin.woff2'
f = TTFont(ss); print('SS axes', [a.axisTag for a in f['fvar'].axes] if 'fvar' in f else None)
axes = {a.axisTag: a.defaultValue for a in f['fvar'].axes}
for w in (400, 500):
    ax = dict(axes); ax['wght'] = w
    report(f'SourceSerif {w} vs Georgia', instancer.instantiateVariableFont(TTFont(ss), ax), TTFont(F + 'georgia.ttf'))
