# Mode d'emploi — faire évoluer telaventis.fr

Ce fichier est la méthode, pour Leonardo comme pour une IA. Il dit **où est
chaque chose, ce qui est généré, et comment ajouter un projet, changer le logo
ou modifier un effet sans rien casser.** Le dossier `_outils/` n'est jamais
servi par le site (`_redirects` le renvoie en 404).

---

## 1. Ce qui est écrit à la main, ce qui est généré

| Quoi | Où | Comment ça change |
|---|---|---|
| Textes, mises en page, études de cas | les pages `.html` (FR à la racine, `en/`, `it/`) | à la main, **dans les trois langues** |
| Les projets clients sur l'accueil (vitrine), la page Travaux, les liens du pied de page, la police du nom de chaque client | entre des marqueurs `<!-- projets:… -->` et `/* projets:debut */ … /* projets:fin */` | **générés** depuis `_outils/projets.json` par `python _outils/projets.py generer` — ne jamais les éditer à la main |
| Logo, favicons, icônes d'application, images de partage (Google, réseaux) | `assets/share/`, `assets/favicon*`, `assets/icons/`, `assets/apple-touch-icon.png`, `assets/mask-icon.svg` | **générés** depuis une image source par `python _outils/identite.py <image>` |
| Vidéos et captures des sites clients | `assets/video/`, `assets/work/`, `assets/shots/` | **générées** par `node _outils/capturer.js <cle>` |

Règle simple : si un fichier est listé comme généré, on change la **source**
(le JSON, l'image source, le site du client) et on relance l'outil.

---

## 2. Ajouter un projet client (pas à pas)

1. **Ajouter son entrée dans `_outils/projets.json`**, en copiant un projet
   existant. Champs :
   - `cle` — minuscules et tirets (`maison-dupont`). Sert à tous les noms de fichiers.
   - `nom` (texte), `nom_html` (facultatif : si le nom a une mise en forme,
     comme « BDE <span class="name-outline">Dauphine</span> »).
   - `site`, `site_libelle` — l'URL publique et ce qu'on affiche.
   - `couleurs` — `fond`, `texte`, `accent`, `doux` : **les vraies couleurs du
     site du client** (lire ses variables CSS dans l'inspecteur, ne pas deviner).
   - `nuancier` — 3 à 5 couleurs montrées en pastilles.
   - `typos` — ses polices, en clair (« Newsreader · Hanken Grotesk »).
   - `police_nom` — la police de SON nom : `famille` (nom interne suivi de « TV »),
     `fichier` (dans `assets/fonts/clients/`), `graisse`, `style`, `repli`,
     `reglages` (variables CSS : `--nw` graisse, `--nls` interlettrage,
     `--ntt` casse, `--nsize` taille, `--nst` italique).
   - `css_en_plus` — rarement : une règle propre à ce projet (voir BDE).
   - `logo_barre`, `logo_titre` — **`null` par défaut. Ne montrer le logo d'un
     client que si Leonardo l'a demandé, logo par logo** (aujourd'hui : BDE seulement).
   - `captures` — `ordinateur` : deux URL de pages qui disent ce que fait le
     site (pas des milieux de page) ; `telephone` : une URL ; `telephone_decalage`
     si une section fait apparaître ses images en défilant.
   - `textes.fr|en|it` — `categorie` (générique : « Restaurant & bar »,
     « Portfolio »…), `probleme`, `reponse`, `resume`, `legendes` (3 légendes :
     les deux écrans d'ordinateur puis le téléphone). Texte brut, sans HTML.

2. **La police du nom** (licence libre OFL seulement), réduite aux lettres du nom :
   ```bash
   # depuis Google Fonts : famille, graisse, et le texte exact du nom
   curl -A "Mozilla/5.0 Chrome/126" "https://fonts.googleapis.com/css2?family=Newsreader:wght@300&text=Qualamantis"
   # → télécharger l'URL fonts.gstatic.com indiquée vers assets/fonts/clients/<nom>-name.woff2
   ```
   ou depuis un fichier : `pyftsubset police.woff2 --text="Le Nom" --flavor=woff2 --output-file=assets/fonts/clients/<nom>-name.woff2`.
   Ajouter son copyright dans `assets/fonts/clients/OFL-clients.txt` et une
   ligne dans les crédits des trois `mentions-legales.html`.

3. **Les médias**, depuis le site en ligne du client :
   ```bash
   node _outils/capturer.js <cle>                       # tout
   node _outils/capturer.js <cle> --seulement=ecrans    # refaire une partie
   ```
   Regarder chaque capture dans `_outils/captures/<cle>/` : pas de bannière,
   pas de vide, images bien apparues. Une capture ratée se remplace à la main
   (même nom) puis `python _outils/medias.py <cle>`.

4. **Les trois études de cas** :
   ```bash
   python _outils/projets.py nouveau <cle>
   ```
   crée `project-<cle>.html` dans les trois langues à partir d'une étude
   existante et ajoute les 3 URL au `sitemap.xml`. Tout ce qui ne se déduit
   pas du JSON est marqué **« À RÉDIGER »** : titre, description, contexte,
   décisions, livrable, faits. Rédiger dans les trois langues. Mettre la date
   à la place de `AAAA-MM-JJ` dans le sitemap.

5. **Générer, vérifier, regarder** :
   ```bash
   python _outils/projets.py generer
   python _outils/projets.py verifier     # refuse s'il manque un média ou un texte
   ```
   puis ouvrir le site en local (`python -m http.server`) : la vitrine de
   l'accueil (une scène par projet), la page Travaux, l'étude de cas, à
   1440 px et 390 px. **Relire les textes d'introduction qui citent un nombre
   de projets** (« cinq projets… » sur la page Travaux, dans les trois langues).

6. Monter les `?v=` de `telaventis.css` / `telaventis.js` dans les pages si
   ces fichiers ont changé (voir §6).

**Retirer ou réordonner un projet** : supprimer ou déplacer son entrée dans le
JSON, `generer`. L'ordre du JSON est l'ordre partout (vitrine, Travaux, pied
de page). Les pages `project-<cle>.html` d'un projet retiré se suppriment à la
main, avec leurs 3 URL du sitemap.

---

## 3. Changer le logo

```bash
python _outils/identite.py "C:/chemin/vers/le-logo.png"
```

L'image source : le T et le mot TELAVENTIS sur leur fond, carrée (1254 × 1254
aujourd'hui, gardée dans `_outils/sources/logo-telaventis.png`). L'outil
produit tout seul :
- les **images de partage avec leur fond** (aperçu de lien 1200 × 630, et
  1:1, 4:3, 16:9 pour Google) ;
- le **logo détouré** (T + mot, fond transparent) pour le balisage Google ;
- les **icônes : le T seul, sans le mot, sans fond** là où la plateforme le
  permet (favicon SVG/PNG/ICO, icônes Android « any ») ; **avec fond** là où
  elle l'exige (iPhone noircit la transparence ; l'icône « maskable » doit
  couvrir tout le carré) ;
- la silhouette une couleur pour l'onglet épinglé de Safari.

**Revenir en arrière** : l'ancien jeu d'icônes (d'avant la refonte) et la
première version du logo sont gardés dans `_outils/sources/` (voir son
`LISEZ-MOI.md`) :
```bash
python _outils/identite.py --restaurer _outils/sources/anciennes-icones
```

Ensuite, monter les `?v=` des favicons dans les pages (`favicon.svg?v=…`) pour
que les navigateurs rechargent l'icône. Google met à jour sa vignette et son
favicon **au prochain passage de son robot** (quelques jours à semaines) ;
la Search Console permet de demander une nouvelle exploration.

---

## 4. Où vit chaque effet

`assets/telaventis.js` — sections numérotées en tête de fichier :
0 menu mobile & barre qui se cache · 1 apparition des blocs · 2 encre au
survol · 2c titre de l'accueil « météo » (graisse/largeur lettre par lettre) ·
3 bandeau TELAVENTIS coupé en diagonale · 5 chiffres mesurés en direct ·
6 vitrine des projets (une scène plein écran par client, passage
« Continuous Sections » ; un geste — molette, pavé tactile, swipe, touche —
= une scène : l'élan est retenu pendant le passage) · 7 page Travaux
(vidéos en vue, index qui suit) ·
4 formulaire de contact.

`assets/telaventis-fx.js` — 1 titres révélés lettre par lettre · 2 vagues des
tarifs · 3 bulles/fleurs · 3b chorégraphie de la section méduses · 3c champ de
bulles unique (les mots se transforment d'une phrase à l'autre) · 3d la fente
qui ouvre sur l'exemple Moka (déclenchée, jamais tirée par le scroll), puis
l'arrivée du titre Moka ; **pendant ces ~2,5 s le défilement est retenu**
(« pas de speedrun », demandé par Leonardo) — sauf lors d'un saut par lien
interne ; un filet de sécurité libère tout après 4 s · 4 courbe du Studio.

Trois points de vigilance sur la section 3b (méduses/champ de bulles) :
- **Lisibilité des mots en bulles sur téléphone** : le halo par bulle (le
  `drop-shadow` sur `.era__w canvas`) ne suffit pas là où le champ de
  bulles passe au plus vif *à travers* le mot plutôt qu'autour (signalé :
  « cherche » et « rencontrer » qui se fondaient dans le courant). Chaque
  mot-clé a maintenant, en plus de la mare sombre pleine largeur, sa
  propre mare floutée dimensionnée sur sa propre boîte
  (`.era__w--key::before`, gatée `[data-era-live]` comme le reste — au
  repos le mot est déjà lisible tel quel, rien à corriger). Si une future
  phrase reste illisible malgré ça, monter l'opacité ou le flou de ce
  `::before` plutôt que celui de la mare pleine largeur, qui ne suit pas
  la position réelle du mot.

Deux points de vigilance mesurés au profileur puis corrigés :
- **Sur téléphone**, l'amorçage du champ de bulles (`buildSea`) tournait 80
  cycles d'un coup au chargement (~550 ms de fil principal bloqué sur ce
  test, plus sur un téléphone réel) — assez pour geler une transition CSS en
  cours (la transition de page entre deux documents, `@view-transition` dans
  `telaventis.css`) et donner un « flash » figé. Il tourne maintenant par
  tranches (`warmSlice`, un budget de temps par image plutôt qu'un nombre
  fixe de cycles), toujours 80 cycles au total, jamais en un seul bloc.
- **Sur ordinateur**, `navigator.gpu` peut exister sans qu'un vrai
  périphérique WebGPU réponde derrière (Linux sans GPU, machine virtuelle,
  WebGPU désactivé…) — un cas déjà exclu du téléphone, mais pas du bureau.
  Sans vérifier d'abord, le module `assets/aurelia/` était chargé et sa
  méduse construite en entier (un maillage de ressorts, plusieurs secondes
  de fil principal bloqué) avant de découvrir qu'il n'y avait rien pour
  l'afficher, et de revenir au canevas 2D. `loadGpu()` demande maintenant un
  adaptateur (`requestAdapter()`, quasi instantané) avant de charger le
  module ; sans adaptateur, le canevas 2D reste actif sans jamais payer ce
  coût.

`assets/moka-lab.js` — l'histoire Atelier Moka, et à la fin « du bruit au
signal » (les photos pixelisées que la caméra traverse). L'ouverture de
l'histoire (photos qui traversent l'écran, fragments rassemblés, navigateur
qui s'ouvre : les 30 premiers % du défilement) se **joue en entier à son
rythme (~2,6 s)** dès qu'on commence à défiler, défilement retenu, puis
rendu une fois le geste arrêté ; à l'envers de même en remontant.

Les hauteurs de défilement des sections épinglées sont en CSS
(`.era__track`, `.moka-story__track`, `.showcase__track` — 110svh par scène,
140svh sur téléphone) et doivent rester
cohérentes avec les constantes du JS qui les commentent (ex. `TAIL_VH`).

Chaque effet respecte la même règle : sans JavaScript, avec « réduire les
animations », ou à l'impression, la page est complète et lisible.

---

## 5. Règles de la maison (décidées avec Leonardo)

- Pas d'étiquette au-dessus des titres, pas de flèche sur chaque lien, pas de
  boutons encadrés dans les barres : un soulignement ou un surlignage.
- **Demander avant d'afficher le logo d'un client.**
- Les écrans montrés doivent avoir un sens (une page qui dit ce que fait le
  site), jamais un milieu de section vide.
- Les noms des projets s'écrivent dans la police de leur client ; la barre
  sous la vitrine de l'accueil montre des catégories génériques.
- Le mot TELAVENTIS coupé en diagonale (ciel dans le bas des lettres) est
  l'identité : en-tête, bandeau de l'accueil, pied de page. La ligne de coupe
  n'est pas tracée.
- Trois langues, toujours : une modification de texte se fait en FR, EN et IT.

---

## 6. Vérifier et publier

```bash
python -m http.server 8742            # puis http://127.0.0.1:8742
python _outils/projets.py verifier
```

Après une modification de `assets/*.css` ou `assets/*.js`, monter leur
numéro `?v=` dans **toutes** les pages (même numéro partout), sinon les
visiteurs gardent l'ancienne version en cache.

Publication : ce dossier est une copie de travail ; la production est le dépôt
GitHub relié à Cloudflare Pages (un push sur `main` publie). La
Content-Security-Policy (`_headers`) interdit tout script tiers : un nouvel
effet doit être écrit dans les fichiers du site, pas chargé depuis un CDN.
