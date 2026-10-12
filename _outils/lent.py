"""Le site tel que le voit quelqu'un qui a une mauvaise connexion.

    python _outils/lent.py            # 4G faible : 1,6 Mbit/s, 300 ms
    python _outils/lent.py 3g         # 3G / wifi de café : 700 kbit/s, 400 ms
    python _outils/lent.py 3g 8800    # même chose, port 8800

Puis ouvrir http://127.0.0.1:8761 (4g) ou :8762 (3g) dans un navigateur
*sans cache* (fenêtre privée, ou DevTools > Network > Disable cache).

Ce que ça reproduit : une première visite à froid. Une bande passante
partagée entre toutes les requêtes (comme une vraie ligne), une latence
ajoutée à chaque requête, le texte compressé en gzip (Cloudflare le fait en
production), aucun cache. Chaque fichier servi est journalisé dans
_outils/lent-<port>.log avec l'instant où il a commencé et fini d'arriver :
c'est le moyen le plus rapide de voir ce qui retarde le premier écran.

Objectifs (voir MODE-EMPLOI §7) : à 1,6 Mbit/s sans cache, le premier écran
complet (titre, mot TELAVENTIS avec son ciel) en moins de 2,5 s, aucun
décalage de mise en page (CLS < 0,1), moins de 350 Ko transférés avant que
le premier écran soit complet.

Pour voir l'une ou l'autre version sans attendre que la détection tranche :
ajouter ?lite=1 (version allégée) ou ?lite=0 (version complète) à l'adresse.
"""
import gzip, mimetypes, os, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PROFILS = {'4g': (1600, 300, 8761), '3g': (700, 400, 8762)}
nom = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in PROFILS else '4g'
KBPS, RTT_MS, PORT = PROFILS[nom]
if len(sys.argv) > 2:
    PORT = int(sys.argv[2])
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BPS, RTT = KBPS * 1000 / 8, RTT_MS / 1000
TEXTE = ('text/', 'application/json', 'image/svg+xml', 'application/javascript')

verrou = threading.Lock()
etat = {'prochain': time.monotonic()}
T0 = time.monotonic()
LOG = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), f'lent-{PORT}.log'), 'w', encoding='utf-8')


def envoyer(wfile, data):
    """Un seul tuyau pour tout le monde : chaque morceau attend son tour."""
    for i in range(0, len(data), 4096):
        part = data[i:i + 4096]
        with verrou:
            now = time.monotonic()
            debut = max(now, etat['prochain'])
            etat['prochain'] = debut + len(part) / BPS
            attente = etat['prochain'] - now
        if attente > 0:
            time.sleep(attente)
        wfile.write(part)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        t = time.monotonic()
        time.sleep(RTT)
        chemin = self.translate_path(self.path)
        if os.path.isdir(chemin):
            chemin = os.path.join(chemin, 'index.html')
        rel = os.path.relpath(chemin, ROOT).replace('\\', '/')
        if rel.startswith('_outils') or not os.path.isfile(chemin):
            self.send_error(404)
            return
        data = open(chemin, 'rb').read()
        ctype = mimetypes.guess_type(chemin)[0] or 'application/octet-stream'
        for ext, ct in (('.js', 'text/javascript'), ('.avif', 'image/avif'), ('.webp', 'image/webp'), ('.woff2', 'font/woff2')):
            if chemin.endswith(ext):
                ctype = ct
        enc = None
        if ctype.startswith(TEXTE) and 'gzip' in self.headers.get('Accept-Encoding', ''):
            data, enc = gzip.compress(data, 6), 'gzip'
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        if enc:
            self.send_header('Content-Encoding', enc)
        self.end_headers()
        try:
            envoyer(self.wfile, data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        LOG.write(f'{t - T0:7.2f} -> {time.monotonic() - T0:7.2f}  {len(data) // 1024:6d}K  {self.path}\n')
        LOG.flush()


if __name__ == '__main__':
    print(f'profil {nom} : {KBPS} kbit/s, {RTT_MS} ms - http://127.0.0.1:{PORT}  (Ctrl+C pour arrêter)')
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
