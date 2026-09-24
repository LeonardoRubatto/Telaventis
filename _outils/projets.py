"""Les projets clients du site, générés depuis une seule source : _outils/projets.json.

    python _outils/projets.py generer          réécrit tout ce qui dépend des projets
    python _outils/projets.py nouveau <cle>    prépare les 3 études de cas d'un nouveau
                                               projet (+ sitemap), textes « À RÉDIGER »
    python _outils/projets.py verifier         refuse tant qu'il reste un « À RÉDIGER »,
                                               un média manquant ou une clé incohérente

Ce que « generer » réécrit (et rien d'autre) — entre des marqueurs, dans les
trois langues :

  index.html, en/index.html, it/index.html
      <!-- projets:vitrine --> … <!-- /projets:vitrine -->
      une scène plein écran par projet + la barre de progression (catégories)
  work.html, en/work.html, it/work.html
      <!-- projets:barre -->   … <!-- /projets:barre -->     index des projets
      <!-- projets:travaux --> … <!-- /projets:travaux -->   un bloc par projet
  toutes les pages
      <!-- projets:pied -->    … <!-- /projets:pied -->      liens vers les sites
  assets/telaventis.css
      /* projets:debut */      … /* projets:fin */           police du nom + réglages

Ne jamais éditer à la main ce qui est entre ces marqueurs : c'est écrasé au
prochain passage. Tout le reste des pages (textes d'introduction, études de
cas, etc.) reste écrit à la main. La méthode complète est dans PROJETS.md.
"""
import html, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, '_outils', 'projets.json')
LANGS = {'fr': '', 'en': 'en/', 'it': 'it/'}
AV1 = 'video/webm; codecs=&quot;av01.0.05M.08&quot;'

L = {
    'fr': dict(pb='Le problème&nbsp;:', rp='La réponse&nbsp;:', coul='Couleurs', typo='Typographies',
               cas='Voir l’étude de cas', joue='La page d’accueil de {n}, en ligne — ouvrir l’étude de cas'),
    'en': dict(pb='The problem:', rp='The response:', coul='Colours', typo='Typefaces',
               cas='See the case study', joue='{n}’s home page, live — open the case study'),
    'it': dict(pb='Il problema:', rp='La risposta:', coul='Colori', typo='Caratteri',
               cas='Vedi il caso studio', joue='La home page di {n}, online — apri il caso studio'),
}
A_REDIGER = 'À RÉDIGER'


def esc(t):
    """texte brut → HTML (les & et < sont échappés, l'espace insécable redevient &nbsp;)"""
    return html.escape(t, quote=False).replace(' ', '&nbsp;')


def attr(t):
    return html.escape(t, quote=True)


def load():
    d = json.load(open(DATA, encoding='utf-8'))
    return d['projets']


def name_html(p):
    return p.get('nom_html') or esc(p['nom'])


def style(p):
    c = p['couleurs']
    return f"--bg:{c['fond']};--fg:{c['texte']};--ac:{c['accent']};--mu:{c['doux']}"


def video(pre, k, kind, cls, vt=False):
    w, h = (1280, 800) if kind == 'desk' else (360, 780)
    v = f' style="view-transition-name:shot-{k}"' if vt else ''
    return (f'<video class="{cls}" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true" tabindex="-1" '
            f'width="{w}" height="{h}" poster="{pre}assets/video/{k}-{kind}-poster.webp"{v}>'
            f'<source src="{pre}assets/video/{k}-{kind}.webm" type="{AV1}">'
            f'<source src="{pre}assets/video/{k}-{kind}.mp4" type="video/mp4"></video>')


# ---------------------------------------------------------------- accueil --
def scene(p, lg, pre):
    k, t, l = p['cle'], p['textes'][lg], L[lg]
    sw = ''.join(f'<i style="--c:{c}" title="{c}"></i>' for c in p['nuancier'])
    return f'''
          <article class="scene scene--{k}" data-scene style="{style(p)}" aria-labelledby="scene-{k}">
            <div class="scene__outer"><div class="scene__inner">
              <div class="scene__bg">
                <span class="scene__ghost" aria-hidden="true">{name_html(p)}</span>
                <a class="scene__shots" href="project-{k}.html" tabindex="-1" aria-hidden="true">
                  <div class="scene__desk">
                    {video(pre, k, 'desk', 'scene__video', vt=True)}
                  </div>
                  <div class="scene__phone">
                    {video(pre, k, 'phone', 'scene__video')}
                  </div>
                </a>
              </div>
              <div class="scene__copy">
                <h3 class="scene__name" id="scene-{k}" data-fx-split data-fx-manual>{name_html(p)}</h3>
                <p class="scene__text"><b>{l['pb']}</b> {esc(t['probleme'])}</p>
                <p class="scene__text"><b>{l['rp']}</b> {esc(t['reponse'])}</p>
                <dl class="scene__spec">
                  <div><dt>{l['coul']}</dt><dd><span class="scene__swatches" aria-hidden="true">{sw}</span><span class="scene__hex">{' '.join(p['nuancier'])}</span></dd></div>
                  <div><dt>{l['typo']}</dt><dd>{esc(p['typos'])}</dd></div>
                </dl>
                <div class="scene__links">
                  <a class="link" href="project-{k}.html">{l['cas']}</a>
                  <a class="link link--plain" href="{attr(p['site'])}" target="_blank" rel="noopener">{esc(p['site_libelle'])}</a>
                </div>
              </div>
            </div></div>
          </article>'''


def vitrine(P, lg, pre):
    rail = ''.join(f'<li style="--ac:{p["couleurs"]["accent"]}">{esc(p["textes"][lg]["categorie"])}</li>' for p in P)
    return ''.join(scene(p, lg, pre) for p in P) + f'\n        <ol class="showcase__rail" aria-hidden="true">{rail}</ol>\n        '


# ---------------------------------------------------------------- travaux --
def shot(pre, k, kind, sizes):
    w1, w2 = (420, 780) if kind == 'm1' else (900, 1440)
    h = 1688 * w1 // 780 if kind == 'm1' else round(900 * w1 / 1440)
    return (f'<picture><source type="image/avif" srcset="{pre}assets/work/{k}-{kind}-{w1}.avif {w1}w, {pre}assets/work/{k}-{kind}-{w2}.avif {w2}w" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{pre}assets/work/{k}-{kind}-{w1}.webp {w1}w, {pre}assets/work/{k}-{kind}-{w2}.webp {w2}w" sizes="{sizes}">'
            f'<img src="{pre}assets/work/{k}-{kind}-{w1}.webp" width="{w1}" height="{h}" alt="" loading="lazy" decoding="async"></picture>')


def barre(P, lg, pre):
    out = []
    for p in P:
        k = p['cle']
        logo = f'<img src="{pre}assets/logos/{p["logo_barre"]}" width="160" height="160" alt="">' if p.get('logo_barre') else ''
        out.append(f'      <a class="work-bar__item scene--{k}" href="#projet-{k}" style="--ac:{p["couleurs"]["accent"]}">{logo}<span>{name_html(p)}</span></a>')
    return '\n' + '\n'.join(out) + '\n    '


def travaux(P, lg, pre):
    l, out = L[lg], []
    for i, p in enumerate(P):
        k, t = p['cle'], p['textes'][lg]
        logo = (f'\n        <img class="cst__logo" src="{pre}assets/logos/{p["logo_titre"]}" width="160" height="160" alt="">'
                if p.get('logo_titre') else '')
        cap = t['legendes']
        out.append(f'''
  <article class="cst scene--{k}{' cst--flip' if i % 2 else ''}" id="projet-{k}" style="{style(p)}" aria-labelledby="cst-{k}">
    <div class="cst__in wrap">
      <header class="cst__head">{logo}
        <h2 class="cst__name" id="cst-{k}">{name_html(p)}</h2>
        <p class="cst__desc">{esc(t['resume'])}</p>
        <p class="cst__links"><a class="link" href="project-{k}.html">{l['cas']}</a><a class="link link--plain" href="{attr(p['site'])}" target="_blank" rel="noopener">{esc(p['site_libelle'])}</a></p>
      </header>
      <div class="cst__stage">
        <a class="cst__main" href="project-{k}.html" aria-label="{attr(l['joue'].format(n=p['nom']))}">
          {video(pre, k, 'desk', 'cst__video', vt=True)}
        </a>
        <figure class="cst__float cst__float--a">{shot(pre, k, 'd1', '(min-width:1000px) 28vw, 44vw')}<figcaption>{esc(cap[0])}</figcaption></figure>
        <figure class="cst__float cst__float--b">{shot(pre, k, 'd2', '(min-width:1000px) 26vw, 44vw')}<figcaption>{esc(cap[1])}</figcaption></figure>
        <figure class="cst__float cst__float--phone">{shot(pre, k, 'm1', '(min-width:1000px) 12vw, 30vw')}<figcaption>{esc(cap[2])}</figcaption></figure>
      </div>
    </div>
  </article>''')
    return ''.join(out) + '\n  '


def pied(P):
    return '\n' + '\n'.join(f'      <a class="foot__mono" href="{attr(p["site"])}" target="_blank" rel="noopener">{esc(p["site_libelle"])}</a>' for p in P) + '\n    '


def css(P):
    out = ['/* projets:debut — généré par _outils/projets.py depuis projets.json, ne pas éditer ici */']
    for p in P:
        f = p.get('police_nom')
        if f and f.get('fichier'):
            out.append(f"@font-face{{font-family:'{f['famille']}';font-style:{f.get('style', 'normal')};font-weight:{f.get('graisse', '400')};"
                       f"font-display:swap;src:url('fonts/clients/{f['fichier']}') format('woff2')}}")
    for p in P:
        f = p.get('police_nom') or {}
        fam = f"--nf:'{f['famille']}',{f.get('repli', 'var(--sans)')};" if f.get('famille') else ''
        out.append(f".scene--{p['cle']}{{{fam}{f.get('reglages', '')}}}")
    for p in P:
        if p.get('css_en_plus'):
            out.append(p['css_en_plus'])
    out.append('/* projets:fin */')
    return '\n'.join(out)


# ------------------------------------------------------------- écriture --
def put(s, a, b, inner, path):
    i, j = s.find(a), s.find(b)
    if i < 0 or j < 0:
        sys.exit(f'{path} : marqueurs {a} / {b} introuvables')
    return s[:i + len(a)] + inner + s[j:]


def pages():
    for d in LANGS.values():
        base = os.path.join(ROOT, d) if d else ROOT
        for f in sorted(os.listdir(base)):
            if f.endswith('.html'):
                yield (d + f)


def generer():
    P = load()
    n = 0
    for lg, pre in LANGS.items():
        f = os.path.join(ROOT, pre, 'index.html')
        s = open(f, encoding='utf-8').read()
        s = put(s, '<!-- projets:vitrine -->', '<!-- /projets:vitrine -->', vitrine(P, lg, '../' if pre else ''), f)
        open(f, 'w', encoding='utf-8').write(s); n += 1
        f = os.path.join(ROOT, pre, 'work.html')
        s = open(f, encoding='utf-8').read()
        s = put(s, '<!-- projets:barre -->', '<!-- /projets:barre -->', barre(P, lg, '../' if pre else ''), f)
        s = put(s, '<!-- projets:travaux -->', '<!-- /projets:travaux -->', travaux(P, lg, '../' if pre else ''), f)
        open(f, 'w', encoding='utf-8').write(s); n += 1
    for rel in pages():
        f = os.path.join(ROOT, rel)
        s = open(f, encoding='utf-8').read()
        if '<!-- projets:pied -->' in s:
            open(f, 'w', encoding='utf-8').write(put(s, '<!-- projets:pied -->', '<!-- /projets:pied -->', pied(P), f)); n += 1
    f = os.path.join(ROOT, 'assets', 'telaventis.css')
    s = open(f, encoding='utf-8').read()
    i, j = s.find('/* projets:debut'), s.find('/* projets:fin */')
    if i < 0 or j < 0:
        sys.exit('telaventis.css : marqueurs /* projets:debut */ … /* projets:fin */ introuvables')
    s = s[:i] + css(P) + s[j + len('/* projets:fin */'):]
    open(f, 'w', encoding='utf-8').write(s); n += 1
    print(f'{len(P)} projets — {n} fichiers réécrits')


# ------------------------------------------------------------- nouveau --
def nouveau(cle, modele='wecalc'):
    """copie l'étude de cas du projet `modele` dans les trois langues, remplace
    ce qui se déduit de projets.json et marque le reste « À RÉDIGER »"""
    P = {p['cle']: p for p in load()}
    if cle not in P:
        sys.exit(f"« {cle} » n'est pas dans projets.json : ajoute d'abord son entrée (voir PROJETS.md)")
    p, m = P[cle], P[modele]
    for lg, pre in LANGS.items():
        src = os.path.join(ROOT, pre, f'project-{modele}.html')
        dst = os.path.join(ROOT, pre, f'project-{cle}.html')
        if os.path.exists(dst):
            print('existe déjà, laissé tel quel :', pre + f'project-{cle}.html'); continue
        s = open(src, encoding='utf-8').read()
        s = s.replace(f'project-{modele}.html', f'project-{cle}.html')
        s = s.replace(f'assets/shots/{modele}', f'assets/shots/{cle}')
        s = s.replace(f'shot-{modele}', f'shot-{cle}')
        s = s.replace(m['site'], p['site']).replace(m['site_libelle'], p['site_libelle'])
        s = s.replace(m['nom'], p['nom'])
        # tout le texte propre au modèle : titre, description, paragraphes, faits
        s = re.sub(r'(<title>)[^<]*(</title>)', rf'\g<1>{p["nom"]} — {A_REDIGER} · Telaventis\g<2>', s)
        s = re.sub(r'(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*', rf'\g<1>{A_REDIGER}', s)
        s = re.sub(r'(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*', rf'\g<1>{p["nom"]} — {A_REDIGER}', s)
        s = re.sub(r'(<p class="(?:lede|body-serif)"[^>]*>)(?:(?!</p>).)*(</p>)', rf'\g<1>{A_REDIGER}\g<2>', s, flags=re.S)
        s = re.sub(r'(<dd class="fact__v"[^>]*>)(?!<a)(?:(?!</dd>).)*(</dd>)', rf'\g<1>{A_REDIGER}\g<2>', s, flags=re.S)
        s = re.sub(r'(<img src="(?:\.\./)?assets/shots/' + re.escape(cle) + r'\.png"[^>]*alt=")[^"]*', rf'\g<1>{A_REDIGER}', s)
        open(dst, 'w', encoding='utf-8').write(s)
        print('créé :', pre + f'project-{cle}.html')
    # sitemap : les trois URL, avec leurs alternates
    sm = os.path.join(ROOT, 'sitemap.xml')
    s = open(sm, encoding='utf-8').read()
    if f'project-{cle}.html' not in s:
        alts = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{lg}" href="https://telaventis.fr/{pre}project-{cle}.html"/>' for lg, pre in LANGS.items())
        alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="https://telaventis.fr/project-{cle}.html"/>'
        entries = ''.join(f'''  <url>
    <loc>https://telaventis.fr/{pre}project-{cle}.html</loc>
    <lastmod>AAAA-MM-JJ</lastmod>
    <priority>0.7</priority>{alts}
  </url>
''' for pre in LANGS.values())
        s = s.replace('</urlset>', entries + '</urlset>')
        open(sm, 'w', encoding='utf-8').write(s)
        print('sitemap.xml : 3 URL ajoutées (mettre la date du jour à la place de AAAA-MM-JJ)')


# ------------------------------------------------------------ vérifier --
def verifier():
    P = load()
    err = []
    cles = [p['cle'] for p in P]
    if len(set(cles)) != len(cles):
        err.append('clés en double dans projets.json')
    for p in P:
        k = p['cle']
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', k):
            err.append(f'{k} : la clé doit être en minuscules, chiffres et tirets')
        for lg in LANGS:
            t = p['textes'].get(lg)
            if not t:
                err.append(f'{k} : textes « {lg} » absents'); continue
            for champ in ('categorie', 'probleme', 'reponse', 'resume'):
                if not t.get(champ) or A_REDIGER in t[champ]:
                    err.append(f'{k} : texte « {champ} » ({lg}) vide ou à rédiger')
            if len(t.get('legendes', [])) != 3:
                err.append(f'{k} : il faut 3 légendes ({lg})')
        need = [f'assets/video/{k}-{v}.{e}' for v in ('desk', 'phone') for e in ('webm', 'mp4')]
        need += [f'assets/video/{k}-{v}-poster.webp' for v in ('desk', 'phone')]
        need += [f'assets/work/{k}-{c}-{w}.{e}' for c, ws in (('d1', (900, 1440)), ('d2', (900, 1440)), ('m1', (420, 780))) for w in ws for e in ('avif', 'webp')]
        need += [f'assets/shots/{k}{s}' for s in ('.png', '-960.avif', '-960.webp', '-1600.avif', '-1600.webp', '-mobile.png', '-mobile.avif', '-mobile.webp')]
        f = p.get('police_nom') or {}
        if f.get('fichier'):
            need.append(f'assets/fonts/clients/{f["fichier"]}')
        for lg in ('logo_barre', 'logo_titre'):
            if p.get(lg):
                need.append(f'assets/logos/{p[lg]}')
        for pre in LANGS.values():
            need.append(f'{pre}project-{k}.html')
        for n in need:
            if not os.path.exists(os.path.join(ROOT, n)):
                err.append(f'{k} : fichier manquant {n}')
    for rel in pages():
        s = open(os.path.join(ROOT, rel), encoding='utf-8').read()
        if A_REDIGER in s:
            err.append(f'{rel} : il reste du « {A_REDIGER} »')
    if 'AAAA-MM-JJ' in open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read():
        err.append('sitemap.xml : une date AAAA-MM-JJ n\'a pas été remplie')
    if err:
        print('\n'.join('✗ ' + e for e in err)); sys.exit(1)
    print(f'✓ {len(P)} projets cohérents, médias présents, aucun texte à rédiger')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'generer':
        generer()
    elif cmd == 'nouveau' and len(sys.argv) > 2:
        nouveau(sys.argv[2], *(sys.argv[3:4]))
    elif cmd == 'verifier':
        verifier()
    else:
        sys.exit(__doc__)
