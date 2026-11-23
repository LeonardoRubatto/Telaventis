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
| Les projets clients sur l'accueil (mêmes blocs que la page Travaux), la page Travaux, les liens du pied de page, la police du nom de chaque client | entre des marqueurs `<!-- projets:… -->` et `/* projets:debut */ … /* projets:fin */` | **générés** depuis `_outils/projets.json` par `python _outils/projets.py generer` — ne jamais les éditer à la main |
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
   l'accueil (un bloc par projet), la page Travaux, l'étude de cas, à
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
0c le repère de défilement du hero s'efface au premier défilement (`html.is-scrolled`) ·
7 page Travaux **et vitrine de l'accueil** (vidéos en vue, barre qui suit ; sur
l'accueil la barre porte les catégories génériques et pointe `#scene-<cle>`) ·
4 formulaire de contact.

**La vitrine de l'accueil (17 novembre)** n'est plus une scène épinglée : ce sont
les mêmes blocs que la page Travaux (`.cst`, générés par `projets.py` entre
`<!-- projets:vitrine -->`), défilement naturel, aucune retenue du geste, aucune
minuterie. Avant, une scène plein écran par client, passage « Continuous Sections »,
un geste = une scène : trop de coups de molette. Récupérable dans l'historique du
dépôt (commit d'avant le 17 novembre). La barre (`.work-bar--home`, sticky) donne
« Entreprise de conseil · Plateforme événementielle · Outil en ligne · Portfolio ·
Restaurant & bar » ; les liens publiés `https://telaventis.fr/#scene-qualamantis`,
`#scene-bde`, `#scene-wecalc`, `#scene-jeanne-randu`, `#scene-cave-antoine` sont les
`id` des blocs.

`assets/telaventis-fx.js` — 1 titres révélés lettre par lettre · 2 vagues des
tarifs · 3 bulles/fleurs · 3b chorégraphie de la section méduses · 3c champ de
bulles unique (les mots se transforment d'une phrase à l'autre) · 3d la fente
qui ouvre sur l'exemple Moka (déclenchée, jamais tirée par le scroll), puis
l'arrivée du titre Moka ; **pendant ces ~2,5 s le défilement est retenu**
(« pas de speedrun », demandé par Leonardo) — sauf lors d'un saut par lien
interne ; un filet de sécurité libère tout après 4 s · 4 courbe du Studio ·
5 **la crème du hero qui coule sur la section sombre** (`fx-melt` : canvas 2D posé sur le
haut de `#digital-era`, langues de longueurs différentes + filet de lumière + deux franges
ciel/bleu-vert ; dérive seule, poussée par la vitesse du défilement, plus profonde à mesure
que la section monte, puis effacée quand la section est épinglée ; ne dessine que s'il est à l'écran ; mouvement réduit : dessiné une
fois).

**3e — la section avance toute seule** (défilement automatique, pour qui ne sait
pas qu'il faut défiler) : dès que la section est à 100 % de l'écran (épinglée),
la phrase reste entière 3 s, puis 4 s pour la deuxième et la troisième
(`AUTO_DWELL`), puis la page défile d'elle-même vers la suivante —
un vrai défilement (la position réelle bouge), donc le déclencheur, ses seuils
(`segBounds`, `HYST`, `STEP_COOLDOWN_MS`, hauteurs de piste, retenue de la porte),
la caméra, les bulles et le titre Moka passent par le même chemin qu'avec la
molette. **Les règles de défilement du visiteur n'ont pas changé** : avec un
défilement, ce sont celles d'origine ; l'automatique ajoute seulement le défilement
qui manquait. Le temps de chaque phrase part à l'instant où elle prend la
place (et pour la première, à l'instant où la section est entière). Après la
dernière phrase la page va jusqu'à la porte, qui joue son titre Moka d'un seul
coup ; c'est là que l'automatique s'arrête, pour la visite. Un défilement du
visiteur **après** que la section est à 100 % (molette, doigt, touche, barre de
défilement, Échap) lui rend la main pour de bon jusqu'au rechargement. Le
défilement qui l'amène à la section ne compte pas : tout ce qui arrive avant le
premier instant d'immobilité (250 ms sans rien, `QUIET_GAP` : l'inertie d'un pavé
tactile peut durer plus d'une seconde) fait seulement repartir l'attente. Et si la section est à moins de 8 % d'être entière (le
visiteur s'est arrêté à ~95 %) et qu'il est immobile, la page est amenée en
douceur à 100 % (`ASSIST_TOP`). État lisible dans `data-auto` sur la section
(idle / count / move / off). Mouvement réduit : rien, la section n'est même pas
épinglée. Le « Faites défiler » reste masqué (`display:none`), comme avant.
Les écouteurs molette/toucher qui peuvent annuler un défilement (non passifs) ne
sont posés que **pendant une retenue** (porte, ouverture Moka) : posés
en permanence, ils obligent le navigateur à attendre le script avant chaque
cran de défilement, n'importe où sur la page.

Point de vigilance sur la section 3b : la **lisibilité des mots en bulles**. Un mot en
bulles est une texture éparse, pas un aplat : il perd contre un fond qui fait le même genre
de traits. Il n'y a plus de plaque sombre sous chaque mot (retirée à la demande de
Leonardo : « pas d'ombres sous les écritures en bulles ») ; seul reste un halo général doux
sous la phrase (`.era--grad`). Si une phrase devient illisible, c'est d'abord la couleur du
fond qu'il faut revoir, pas une ombre qu'il faut rajouter.

`assets/moka-lab.js` — l'histoire Atelier Moka, et à la fin « du bruit au
signal » (les photos pixelisées que la caméra traverse). L'ouverture de
l'histoire (photos qui traversent l'écran, fragments rassemblés, navigateur
qui s'ouvre : les 30 premiers % du défilement) se **joue en entier à son
rythme (~2,6 s)** dès qu'on commence à défiler, défilement retenu, puis
rendu une fois le geste arrêté ; à l'envers de même en remontant.

Les hauteurs de défilement des sections épinglées sont en CSS
(`.era__track`, `.moka-story__track` : 740svh et 628svh sur téléphone pour l'ère) et doivent rester
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
visiteurs gardent l'ancienne version en cache : `python _outils/monter-v.py`
(monte d'un cran les six fichiers, refuse si les pages ne sont pas d'accord).

**Adresses sans `.html` (20 novembre).** Cloudflare Pages renvoie `work.html` vers `/work`
(308) : l'adresse officielle d'une page est donc **sans `.html`** (`/work`, `/en/work`,
`/project-bde`, l'accueil `/`, `/en/`, `/it/`). Canonical, hreflang, `og:url`, JSON-LD,
`sitemap.xml` et liens internes doivent tous dire la même chose ; le fichier garde son nom
`.html`, seul ce qu'on **publie** change. Un canonical en `.html` annonce à Google une
adresse qui redirige ailleurs : il hésite, indexe mal les pages internes, et les sous-liens
(sitelinks) n'apparaissent pas. Un nouveau projet suit la règle tout seul (`projets.py nouveau`).
Vérification rapide : `curl -sI https://telaventis.fr/<page>` doit répondre 200, jamais 308.
`404.html` utilise des liens absolus (`/work`) car elle est servie à n'importe quelle adresse.

**Icônes à la racine.** `identite.py` copie `favicon.ico` et `apple-touch-icon.png` à la racine
du site (navigateurs, Bing et lecteurs RSS les demandent là sans lire le HTML), et les pages
déclarent aussi le favicon 48 px (Google veut un multiple de 48).

**Icônes : ne pas compter sur le SVG ni sur le PNG seuls (20 novembre).** Les icônes
n'apparaissaient pas sur Internet Explorer (et les très vieux navigateurs, certains lecteurs
RSS, Bing) : ils ne lisent ni le favicon SVG ni les PNG déclarés, seulement un vrai fichier
`.ico`. Règles qui évitent que ça se reproduise :
- `/favicon.ico` doit exister **à la racine** du site, être un vrai `.ico` multi-tailles
  (16, 32 et 48 px dans le même fichier : `identite.py` le fait), jamais un PNG renommé ;
- chaque page déclare aussi `<link rel="shortcut icon" href="/favicon.ico">` (chemin absolu
  depuis la racine, sans `?v=`), en plus des liens SVG/PNG : IE le lit, les navigateurs
  récents l'ignorent au profit du SVG ;
- ne jamais retirer le `.ico` « parce que le SVG suffit » : le SVG est un confort pour les
  navigateurs récents, pas un remplacement ;
- vérifier après publication : `curl -sI https://telaventis.fr/favicon.ico` doit répondre 200
  avec `content-type: image/x-icon` (ou `image/vnd.microsoft.icon`), jamais 404 ni 308 ; et
  ouvrir le site dans un navigateur qui ne lit pas le SVG (ou tester le `.ico` seul) avant
  de dire que les icônes sont réglées.

Publication : ce dossier est une copie de travail ; la production est le dépôt
GitHub relié à Cloudflare Pages (un push sur `main` publie). La
Content-Security-Policy (`_headers`) interdit tout script tiers : un nouvel
effet doit être écrit dans les fichiers du site, pas chargé depuis un CDN.

---

## 7. Connexion lente et fluidité : l'état actuel

Le site doit rester agréable sur une mauvaise connexion, à froid, sans cache. **Il n'y a
qu'une version** (une version « légère » devinée d'après la connexion a existé : elle se
trompait parfois, par exemple un « 3g » annoncé par Chrome sur un bon wifi, et ne
servait plus à rien une fois les méduses retirées). Ce qui protège une connexion lente,
c'est l'**ordre de chargement** — le hero d'abord, tout le reste après :

- **Le premier écran ne dépend de rien d'autre que de lui-même.** Le titre est visible dès
  la première image, dans une police de repli réglée sur les largeurs d'Archivo
  (`@font-face 'Archivo Fallback'`, chiffres de `_outils/metrics.py`) : quand Archivo arrive,
  rien ne bouge. Son animation (opacité et position seulement : elle ne fait travailler que
  le compositeur) ne démarre qu'au premier moment fluide (4 images de suite sous 24 ms,
  0,9 s au plus : `whenSmooth`) ; si Archivo n'est pas là, le titre s'affiche avec
  la police de repli sans rejouer son apparition. `wtStop` concerne uniquement
  le suivi continu de la souris. Le mot TELAVENTIS a un fond uni et un aperçu flou du ciel
  (`--sky-lqip`, 332 octets) : entier dès la première image.
- **Préchargé, en haute priorité :** la police Archivo et le ciel (`<link rel="preload">`
  dans chaque page, et `Link:` dans `_headers` pour les trois accueils : Early Hints), les
  deux scripts `telaventis.js` et `telaventis-fx.js`.
- **Après, en priorité basse ou à l'approche :** `moka-lab.js`, les images du bas de page,
  les affiches des vidéos (`data-poster`, chargées par `loadPoster()` ; l'image recouvre le
  lecteur jusqu'à deux images vidéo présentées au compositeur et reste comme fond
  du cadre pour combler une surface transparente ; un `<noscript>` garde
  l'image sans JavaScript), les vidéos (lecture quand un tiers du cadre est visible),
  les images de l'histoire Moka (en 640 px pour la mosaïque).
- **Repoussé après le titre :** l'échantillonnage des mots-clés des bulles (~270 ms, un
  mot par tâche, `WARM_AT`), la première mesure de l'histoire
  Moka. La section méduses ne dessine rien tant qu'elle n'est pas vraiment à l'écran
  (marge de 48 px), ni pendant la porte (`doorBusy`).
- **Le défilement n'est jamais freiné pour rien :** les écouteurs molette/toucher non
  passifs ne sont posés que pendant une retenue.
- **Le seul réglage lié au réseau :** si le navigateur dit `saveData` (ou un réseau 2g),
  les scènes montrent leurs affiches au lieu de lire les enregistrements (`lite` dans
  `telaventis.js`, qui ne veut plus dire que cela).

**Le fond de la section « Le point de départ ».** Ordinateur et tablette : le « Animated
Gradient » du design system (Harsh Jadhav / Componentry, MIT : `backgrounds/animated-gradient`,
crédité dans les trois `mentions-legales.html`), son shader porté sur une toile WebGL2. Trois
couleurs du site, choisies par une étude en OKLCH (`_outils/etude-couleurs.py`) : encre
`#0E1620`, bleu-vert `#1B4458` (la lueur que la section avait déjà, teinte 232°), corail
`#A8441F` (`--coral` adouci d'un cheveu, teinte 39° : ~170° du bleu-vert, une paire presque
complémentaire). Mélange en OKLab (le milieu bleu-vert/corail y est moins boueux), tramage
final contre les bandes, dessiné au rapport de pixels de l'écran (1,5 au plus, ~3 Mpx au
plus), 30 images/s, `speed: 5`, en pause hors écran et pendant la porte, halo sombre doux
sous la phrase (`.era--grad`). Mesuré sur images réelles du fond seul (`mesurer-degrade.js`
+ `analyser-degrade.py`) : le texte crème a au pire 8,3:1 derrière lui, 13,6:1 en moyenne ;
aucun motif de blocs ; grain de 0,3 niveau sur 255. Mesuré en fenêtre Chrome réelle (carte
Intel intégrée) : 60 images/s dans la section, porte comprise. Sans WebGL2, rien n'est
dessiné : le fond CSS de la section (`.era__sticky::before`) reste. Téléphone : le même dégradé (le champ de
bulles : le même dégradé, avec une piste plus courte et une grille de bulles plus grossière.

**Mesurer.** Dans deux terminaux :

```bash
python _outils/lent.py 3g            # serveur lent : 700 kbit/s, 400 ms (ou « 4g » : 1,6 Mbit/s, 300 ms)
cd _outils && npm install            # une fois
node mesurer.js http://127.0.0.1:8762/index.html            # premier affichage à froid ; --mobile pour un téléphone
node parcours.js http://127.0.0.1:8742/index.html --scenario=auto   # joue la section : auto | user | user-late | assist | inertia | fling
HEADED=1 node fluidite.js http://127.0.0.1:8742/index.html          # images perdues, avec le script responsable
```

(`CHROMIUM=<chemin du .exe>` si le navigateur de playwright-core n'est pas celui installé ;
`HEADED=1` ouvre une vraie fenêtre, avec carte graphique : les mesures « sans écran » ne
voient pas les coûts de rendu réels.) Objectifs à 1,6 Mbit/s sans cache : premier écran
lisible en moins de 2 s, CLS sous 0,1, aucune vidéo ni affiche de la vitrine avant la fin du
chargement, aucune erreur de console. Avant d'ajouter quoi que ce soit au premier écran :
le mesurer ainsi.

---

## 8. Réglages décidés avec Leonardo (12 octobre)

- **Le défilement du visiteur n'a pas changé** : seuils (`segBounds`, `HYST`), hauteurs de
  piste, retenue de la porte. Le défilement automatique ne fait que bouger la vraie
  position, il n'invente aucune règle.
- **Une phrase reste au moins 2 s** avant que la suivante puisse la remplacer
  (`STEP_COOLDOWN_MS`) ; la porte attend aussi que la dernière phrase ait eu ses 2 s.
- **Défilement automatique** : 3 s, 4 s, 4 s ; départ dès que la section est à 100 % de
  l'écran, accompagnement doux de ~95 % à 100 % ; rendu au premier geste du visiteur
  après le premier instant d'immobilité (`QUIET_GAP`, 250 ms : l'inertie d'un pavé
  tactile peut durer plus d'une seconde). Arrêt au titre Moka.
- **Bulles : elles suivent leurs mots** (`sigOf` / `restAt` : positions relues sur les
  mots à l'atterrissage et dès que la page bouge sous elles). Pas d'ombre ni de plaque
  sous les mots en bulles.
- **Phrases** : Source Serif 4 en graisse 330 (350 pour la grande), plus grand ; 400/450 sur
  téléphone ; pas de point final ; plus de texte sous la dernière.
- **(remplacé le 17 novembre, voir §9) Barre des projets (vitrine)** : en haut de l'écran épinglé, un lien par projet
  (`projets.py` la génère) ; le projet courant est un minuteur de 7 s (animation CSS
  `rail-fill`, `animationend`), qui laisse finir la boucle de la vidéo ; en pause
  pendant la lecture (pointeur sur le texte), arrêté pour la visite au premier défilement
  du visiteur ; l'en-tête du site ne redescend pas tant qu'on est dans la vitrine
  (`inShowcase()`) ; le contenu des scènes est descendu d'une bande pour lui faire
  place.
- **Titre de l'histoire Moka** (« 01 Donner une direction ») : centré en haut.
- **Accueil** : plus de « Ouvert à de nouveaux projets » dans le hero (le fait reste sur
  la page Studio, « En ce moment »).

**Retirés, récupérables dans l'historique git (tag `meduses-webgpu-et-version-legere`) :**
la méduse WebGPU (`assets/aurelia/`, holtsetio / Aurelia, MIT), la méduse 2D de secours,
le champ de bulles des téléphones (Alex Andrix, tag `champ-de-bulles-mobile`) et
la déformation du texte, la version « légère » et sa détection, le texte sous la dernière
phrase. Les crédits de `mentions-legales.html` ont été mis à jour (Aurelia n'y figure plus).

**Barre d'outils des téléphones (15 octobre).** La scène épinglée de `#digital-era` est
`100dvh` (pour toujours toucher le bord réel de l'écran), mais la hauteur dvh change quand la
barre d'Safari se replie pendant le défilement : tout ce qui y était centré (la phrase) glissait
d'environ la moitié du changement pendant que les bulles restaient en place, puis revenaient d'un
coup (« petit saccadement »). Maintenant : le cadre du texte (`.era__stage`) fait `100svh` collé en
haut, le dégradé et les canvas (`era__aurora`, `era__ripple`, `era__morph`) font `100lvh` (jamais
réalloués), et un vol de bulles en cours suit les mots s'ils bougent (`retarget` dans
`telaventis-fx.js`). Test : `node _outils/bulles-barre.js <url> --barre --rest` (part des bulles
hors des mots, image par image) ; l'ancienne version donne ~60 % pendant ~170 ms, la nouvelle 0 %.

---

## 9. Réglages du 17 novembre (Leonardo)

- **Vitrine de l'accueil = les blocs de la page Travaux**, défilement naturel (voir §4). Plus de
  scène épinglée, plus de retenue, plus de minuterie. La barre qui suit le défilement porte les
  catégories génériques (pas les noms des clients).
- **Transition hero → section sombre liquide** (§4, fx-melt) : plus de ligne droite sous le mot
  TELAVENTIS. Rien n'est ajouté au premier écran (mesuré : premier affichage identique, +4 Ko).
- **Repère de défilement du hero** : une goutte d'encre qui se détache de son fil, s'étire en
  tombant et ouvre un anneau (SVG + filtre « goo », opacité/transformation seulement). Elle part
  2,2 s après le chargement, disparaît au premier défilement, ne bouge pas en mouvement réduit.
  Un clic mène à `#digital-era`.
- **Accroc après l'ouverture de l'histoire Moka** : l'arrivée du titre (« Même activité. Autre
  perception. ») interpolait les axes de la police lettre par lettre (le défaut déjà corrigé pour
  le titre de l'accueil) ; elle n'anime plus que l'opacité et la transformation. Les images du champ
  « du bruit au signal » sont décodées d'avance (`createImageBitmap`) au lieu de l'être à leur
  première image. Mesure : `node _outils/moka-saccade.js <url> --cpu=4` (images perdues, rappels rAF
  lents, LoAF, instant par instant).
- **Portrait de Leonardo** : page Studio (trois langues), `assets/team/portrait-lr-*`, découpé selon
  la diagonale de la marque. Gardé hors des moteurs de recherche : `X-Robots-Tag: noindex` sur
  `/assets/team/*` (`_headers`) — **robots.txt ne doit pas le bloquer** (noindex exige que le fichier
  reste lisible, même règle que `assets/art/`), pas de balise `og:image`/`image` structurée, nom de
  fichier neutre, absent du sitemap.
- **LinkedIn** : page entreprise dans le pied de page de toutes les pages et sur Contact ; profil de
  Leonardo sur Studio et Contact ; `sameAs` dans le balisage de l'accueil.

- **Bulles qui montent dans la section des phrases** (`fx-rise`, §6 de `telaventis-fx.js`, CSS `.era__rise`) : 9 bulles sur téléphone, 16 ailleurs, qui quittent le bas de l'écran, ondulent et se dissolvent au-dessus du milieu, derrière les mots. Le mouvement vers le haut dit « la page descend » sans flèche ni étiquette. Transformation et opacité seulement ; coupées quand le visiteur a repris la main (`data-auto="off"`), absentes en mouvement réduit.
- **La section des phrases répond au clic** (§3f de `telaventis-fx.js`) : un clic ou un toucher sur la phrase passe à la suivante, et après la dernière ouvre la porte ; c'est le même vrai défilement que l'autoplay (`goPhrase` → `clickMove` → `glide`) : seuils, retenue et porte inchangés ; un clic relance le temps de la phrase mais n'arrête pas l'autoplay. Seul élément visible : un grand triangle ouvert (deux traits fins ; Leonardo a refusé les flèches, les marqueurs 01 02 03 et le texte « Cliquez, ou laissez faire »), qui apparaît 1 s après le début du temps de la phrase, respire deux fois, se dissout et revient (`.era__arrow`, `data-auto="count"`) ; cliquable aussi.
- **Jointure liquide entre les blocs de projets** (accueil et Travaux) : deux bandes masquées par une vague, qui glissent lentement en sens contraires, dans la couleur du bloc précédent (`--pv`, écrite par `projets.py`) ; CSS seul, transformation seulement.
- **Plus de retenue à l'entrée de l'histoire Moka** : l'ouverture (images qui traversent l'écran, fragments, navigateur) suit maintenant le défilement du visiteur (`ACT_HOLD=false` dans `moka-lab.js`). La porte vers Moka (titre « Même activité. Autre perception. ») garde sa retenue d'environ 2,5 s.
- **Titre de la vitrine** : « Quelques projets, expliqués clairement. » en grand titre de section, précédé de la note « Exemple fictif » qui conclut l'exemple Moka.
- **Entrée de Moka plus longue** : l'ouverture dispose de `ACT_EXTRA` = 1 écran de défilement de plus (pistes CSS +100svh : 620 / 580 / 740) ; le reste de l'histoire garde sa longueur (remappage de `p` dans `moka-lab.js`). Un grand coup de molette (1500 px) n'en traverse plus que 3/4.
- **La transition liquide ne se fond plus** (une couche crème semi-transparente remplissait l'écran de gris) : elle reste pleine et ne remonte qu'à la toute fin (12 % d'écran). Le triangle pulse en continu tant que la section est à l'écran (visible dès qu'elle est épinglée, y compris pendant les déplacements automatiques).
- **La phrase monte comme des bulles** (remplace les ronds qui montaient) : les mots simples se soulèvent d'un tiers d'em et retombent, chacun avec sa période et son retard (CSS `era-lift`, après 1,4 à 2,6 s) ; les mots-clés, dessinés par le champ de bulles, font pareil (`liftY` dans `telaventis-fx.js`, même forme). Rien n'est synchronisé.
- **Transition liquide** : revenue à la version qui monte progressivement (pas de retrait, pas de fondu) ; la montée s'étale sur 90 % d'écran. **Triangle** : toujours actif tant que la section est à l'écran, taille et position fluides (`clamp`), jamais masqué par une fenêtre basse. **Moka** : l'ouverture dispose de 1,56 écran de plus (+25 % sur l'ouverture ; pistes 676 / 636 / 796 svh).
- **Page menu numérique** (trois langues, écrite à la main) : refaite dans l'ordre des questions d'un restaurateur : l'image du QR à côté du titre, ce qu'on obtient (4 cases), comment ça se met en place (4 étapes numérotées sur fond encre, joint diagonal), le prix (rangée « tier » comme la page Tarifs). Classes `qr-*` dans `telaventis.css`.
- **Page menu numérique, deuxième version** (17-18 novembre) : l'image à côté du titre ; une **démo qui marche** (`[data-qr-demo]`, §8 de `telaventis.js`) : à gauche le tableau que le restaurateur modifierait, à droite le téléphone du client ; changer un prix, décocher un plat (« épuisé »), basculer FR/EN/IT ou de catégorie met le téléphone à jour (sans JS : les deux catégories, en statique) ; « ce que vous obtenez » en grands titres serif entre filets ; « comment ça se met en place » avec le titre qui reste en vue à côté de quatre grandes étapes, sans points ni ornement (marge haute corrigée : `.qr-how.seam`) ; prix en rangée « tier ». Les noms de plats sont dans les trois langues dans le HTML (`data-fr/en/it`).
- **Entrée de Moka encore +25 %** : `ACT_EXTRA = 2,26` écrans (l'ouverture passe de 2,82 à 3,52 écrans de défilement ; pistes 746 / 706 / 866 svh).
- **Menu numérique : pas de page d'administration ni de serveur** (décision de Leonardo, 18 novembre). C'est lui qui change la carte (version optionnelle du site ou version chargée par les QR codes) d'après ce que lui disent les restaurateurs. La démo de la page est une illustration, rien n'y est enregistré ; les textes disent « vous nous dites ce qui change, Telaventis met la carte à jour », jamais que le client édite lui-même.
- **Page contact** (trois langues) : sur les matières du site (crème, encre, une action corail), pas de version sombre ni « une question à la fois » (refusées par Leonardo : « ça doit être intuitif et naturel »). Bandeau de titre compact comme les autres pages intérieures, puis le formulaire avec ses quatre champs visibles (les styles `.form-card` / `.field` d'origine) et, à côté, les coordonnées. Le formulaire (`data-contact`, champs, clés Web3Forms, textes `data-msg-*`) est celui d'origine ; testé avec Web3Forms intercepté, rien n'est envoyé en test.

---

## 10. Design Memory, 23 novembre (Leonardo)

- **Titre du hero** : `telaventis.js` §9a (ombre douce d'après « Shadow Text », force 0,30) et §9d. Dans les trois langues, `data-hero-phrase` délimite la partie qui tourne, indépendamment de la ponctuation. La première valeur apparaît lettre par lettre (§2c). La première transition commence deux secondes après le début de cette apparition. Les valeurs et leurs images vivent dans `data-words` et `data-art` sur le `<h1>`. Chaque œuvre est cadrée sur ses zones plus claires, avec une teinte moins sombre. En italien, la boucle commence par « la tua attività » puis « il tuo ristorante » et le « ? » reste à côté. Les `<br class="br-always">` gardent les sauts de ligne à toutes les largeurs. Le flou de « Text Morph » a été essayé puis écarté.
- **Section des phrases** (`telaventis-fx.js` §6 et §7) : mots-clés en encre (solveur de fluide WebGL2, d'après « Ink Background » ; police des mots-clés inchangée, les mots autour sont en Archivo léger), plus de bulles qui suivent le curseur, repère « goutte » dans la marge droite (fil sinueux, goutte à vitesse variable, pas de texte) à la place du repère du hero. Le flow field a été retiré (demande de Leonardo).
- **Transitions entre pages** : le balayage diagonal sur ordinateur révèle la nouvelle page au-dessus d'une capture opaque de la page précédente. Avec un pointeur tactile, la nouvelle page affiche directement son propre effet d'entrée.
- **Captures latérales des exemples** : le sélecteur de proportion cible les images à l'intérieur de `<picture>`. Leur hauteur suit leur largeur et le ratio du fichier choisi par le navigateur.
- **Boutons** (`a.btn`) : texte qui roule (« Slide Text Button »). **Barre des projets** : trait qui s'ouvre autour du projet courant (« Morphic Navbar »). **Démo de la page menu** : pastille d'état, boutons − / + sur les prix, bulle dans le téléphone (§9e).
- **Moka** : cadre du navigateur plus grand, plus de chiffres, trait de progression moderne avec une goutte en tête ; la retenue après le titre « Même activité. Autre perception. » est ~1,2 s plus courte.
- Crédits (Kokonut UI, Componentry) dans les trois `mentions-legales.html`.
