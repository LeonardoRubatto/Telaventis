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
**version choisie (légère ou complète), décidée une seule fois au chargement,
voir §7** · 0 menu mobile & barre qui se cache · 1 apparition des blocs · 2 encre au
survol · 2c titre de l'accueil « météo » (graisse/largeur lettre par lettre) ·
3 bandeau TELAVENTIS coupé en diagonale · 5 chiffres mesurés en direct ·
6 vitrine des projets (une scène plein écran par client, passage
« Continuous Sections » ; un geste — molette, pavé tactile, swipe, touche —
= une scène : l'élan est retenu pendant le passage ; la première touche/clic
n'importe où sur la page essaie de lire puis met en pause la vidéo de la
première scène, pour que Safari iOS autorise ensuite les lectures
automatiques qu'un geste ne déclenche pas directement — Mode Faible
consommation ou réglage Auto-Play strict, sinon la vidéo reste bloquée sur
sa première image sans que rien ne le dise ; la retenue elle-même — le
passage de `.showcase__sticky` en `position:fixed` le temps du geste,
nécessaire pour que la scène reste à l'écran pendant que `overflow:hidden`
casse son `position:sticky` — a déjà coupé une vidéo en cours sur Safari
iOS (repéré : la vidéo jouait au premier passage, plus après être
remontée puis redescendue sur la même scène, exactement le chemin qui
redéclenche une retenue) ; `release()` relance donc `syncVideos()` à
chaque fin de retenue, que celle-ci ait coupé quelque chose ou non) ·
7 page Travaux (vidéos en vue, index qui suit) ·
4 formulaire de contact.

`assets/telaventis-fx.js` — 1 titres révélés lettre par lettre · 2 vagues des
tarifs · 3 bulles/fleurs · 3b chorégraphie de la section méduses · 3c champ de
bulles unique (les mots se transforment d'une phrase à l'autre) · 3d la fente
qui ouvre sur l'exemple Moka (déclenchée, jamais tirée par le scroll), puis
l'arrivée du titre Moka ; **pendant ces ~2,5 s le défilement est retenu**
(« pas de speedrun », demandé par Leonardo) — sauf lors d'un saut par lien
interne ; un filet de sécurité libère tout après 4 s · 4 courbe du Studio.

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
défilement qui l'amène à la section ne compte pas : une entrée dans les 900 ms
qui suivent (`ARRIVE_GRACE`, la queue d'un geste de pavé tactile) repousse
seulement le départ. Et si la section est à moins de 8 % d'être entière (le
visiteur s'est arrêté à ~95 %) et qu'il est immobile, la page est amenée en
douceur à 100 % (`ASSIST_TOP`). État lisible dans `data-auto` sur la section
(idle / count / move / off). Mouvement réduit : rien, la section n'est même pas
épinglée. Le « Faites défiler » reste masqué (`display:none`), comme avant.
Les écouteurs molette/toucher qui peuvent annuler un défilement (non passifs) ne
sont posés que **pendant une retenue** (porte, vitrine, ouverture Moka) : posés
en permanence, ils obligent le navigateur à attendre le script avant chaque
cran de défilement, n'importe où sur la page.

**La barre des projets (vitrine de l'accueil)** : en haut de l'écran épinglé, un
lien par projet (`.showcase__rail`, générée par `projets.py` depuis les
catégories de `projets.json`, libellé de la barre dans le dictionnaire `L`). Elle
flotte au-dessus des scènes sans jamais entrer dans leur mise en page : leur
taille ne change pas. Un clic va droit au projet (une seule transition jouée,
le défilement amené au point de repos de ce projet, `goTo()`). La barre du projet
courant est un minuteur : elle se remplit en 7 s (`--dwell`, une animation CSS
`rail-fill` : la feuille de style est l'horloge), puis la vitrine passe au
projet suivant (événement `animationend`). Le minuteur ne tourne que lorsque la
vitrine est vraiment regardée (épinglée à l'écran, onglet visible, aucune
transition en cours, visiteur immobile : `.is-timing`) et attend tant que le
pointeur est sur le texte ou que le clavier y est (`.is-reading`). Dès que le
visiteur défile (molette, doigt, touche, barre de défilement) ou presse Échap, il
s'arrête pour la visite (`data-timer` disparaît, les barres indiquent seulement
où l'on est) ; cliquer sur la barre ne l'arrête pas. Pas de boucle : sur le
dernier projet la barre se remplit et reste pleine. L'en-tête du site ne redescend jamais de lui-même tant qu'on est dans la
vitrine (`inShowcase()` dans le §0b de `telaventis.js`) : il revient quand le
visiteur remonte au-dessus du début de la vitrine, et seulement alors. Le
contenu des scènes est descendu d'une bande (`padding-top` du `.scene__inner`,
puis de `.scene__copy` sur téléphone) pour laisser sa place à la barre sans
changer la taille des scènes. Sans JavaScript la barre
n'existe pas (scènes empilées). Rejouable avec `node _outils/vitrine.js <url>
--scenario=timer|click|user|shots`.

La méduse WebGPU (2 Mo de code, ~630 ms de fil principal bloqué même sur un
PC à 16 cœurs) ne se charge plus au chargement de la page : seulement en
version complète, une fois la page chargée, le navigateur au repos et le
visiteur immobile ; elle apparaît en fondu par-dessus la méduse 2D, qui était
à l'écran depuis le début.

Trois points de vigilance sur la section 3b (méduses/champ de bulles) :
- **Lisibilité des mots en bulles sur téléphone** : le halo par bulle (le
  `drop-shadow` sur `.era__w canvas`) ne suffit pas là où le champ de
  bulles passe au plus vif *à travers* le mot plutôt qu'autour (signalé
  deux fois : « cherche » et « rencontrer » qui se fondaient dans le
  courant — encore vrai après une première mare, trop douce, qui
  retombait à rien bien avant le bord du mot). Chaque mot-clé a
  maintenant, en plus de la mare sombre pleine largeur, sa propre mare
  dimensionnée sur sa propre boîte (`.era__w--key::before`, gatée
  `[data-era-live]` comme le reste — au repos le mot est déjà lisible tel
  quel, rien à corriger) — et cette fois **quasi opaque** sur l'essentiel
  de la boîte (dégradé radial, .94 → .8 → transparent seulement dans les
  15 derniers %), pas un simple assombrissement : un mot en bulles est
  une texture éparse, pas un aplat, donc il perd contre un fond qui fait
  le même genre de traits (les courants du champ) tant que ce fond garde
  un peu de motif visible en dessous — seul le retirer marche. Si une
  future phrase reste illisible malgré ça, monter encore l'opacité ou
  agrandir ce `::before` plutôt que celui de la mare pleine largeur, qui
  ne suit pas la position réelle du mot.

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

---

## 7. Connexion lente : la version choisie, et comment la mesurer

Le site doit rester agréable sur une mauvaise connexion, à froid, sans cache —
pas seulement sur la fibre ou au second passage. Deux idées commandent tout :

**Le premier écran ne dépend de rien d'autre que de lui-même.** Le titre est
visible dès la première image, dans une police de repli réglée sur les largeurs
d'Archivo (`@font-face 'Archivo Fallback'`, chiffres mesurés par
`_outils/metrics.py`) : quand Archivo arrive, rien ne bouge. L'animation du titre
ne se joue que si Archivo est déjà là (cache, préchargement) ; sinon le titre
reste où il est, puis le coup de vent passe quand la police est arrivée. Le mot
TELAVENTIS (bandeau, en-tête, pied de page) a sous le ciel un fond uni et un
aperçu flou de 332 octets (`--sky-lqip`) : le mot est entier dès la première
image, le vrai ciel se précise par-dessus. La police et le ciel sont préchargés
(`<link rel="preload">` dans chaque page, et `Link:` dans `_headers` pour les
trois accueils : Cloudflare en fait des « 103 Early Hints »). Tout ce qui est
plus bas dans la page attend : affiches des vidéos (`data-poster`, appliquées
par `loadPoster()` à l'approche — le générateur les écrit ainsi, et un
`<noscript>` garde l'image sans JavaScript), vidéos, méduse WebGPU, images de
l'histoire Moka.

**L'apparition du titre est fluide parce qu'elle ne fait travailler que le
compositeur.** Elle animait les axes de la police (graisse et largeur) de 49
lettres à la fois : à chaque image, chaque lettre était recomposée à un nouveau
réglage et toute la ligne remise en page (10 à 23 ms par image sur un PC rapide,
40 à 90 ms sur un portable ordinaire) : c'était la saccade. Elle n'anime plus que
l'opacité et la position (`wt-arrive`). Le coup de vent et l'effet du pointeur,
eux, animent bien les axes, mais par paliers (quelques réglages par lettre, que
la police met en cache), seulement quand une valeur change, et s'arrêtent d'eux-mêmes
si la page n'arrive plus à suivre (10 images lentes de suite : `wtStop`). En
version légère, ni coup de vent ni effet du pointeur. `node _outils/fluidite.js
<url> --cpu=4` mesure les images perdues et le script responsable.

**Ce qui est repoussé après le titre (première visite, rien en cache).** Tout
arrive en retard à froid, donc tout s'empile dans les mêmes images : c'est là que
l'apparition du titre saccadait alors qu'elle est fluide depuis le cache. Le titre
ne démarre donc qu'au premier moment fluide (4 images de suite sous 24 ms, 0,9 s
au plus : `whenSmooth`) ; l'échantillonnage des mots-clés des bulles (~270 ms)
se fait un mot par tâche, une fois le titre posé (`WARM_AT`) ; la section méduses
ne dessine rien tant qu'elle n'est pas vraiment à l'écran (marge de 48 px) ; la
méduse WebGPU ne se charge qu'après ~4,8 s, quand le visiteur est immobile, et
**se met en pause hors de l'écran** (`setPaused`, ajouté à `aurelia.js`, importé
avec `?v=2`) : sa boucle de rendu tournait en permanence et faisait passer toute
la page à 30 images/s. Mesurer dans un vrai navigateur, pas seulement le mode
sans écran : `HEADED=1 CHROMIUM=<chrome.exe de playwright> node _outils/fluidite.js <url>`.

**Le cadre de performance de la section méduses.** Mesuré dans une vraie fenêtre
Chrome (carte Intel intégrée), la section tournait à 24 images/s et la porte vers
Moka à 26 (45 images de plus de 50 ms en 4,5 s). Coupables, dans l'ordre :
un flou de 18 px recalculé par le GPU à chaque image sur le fond animé
(`.era__sticky::before`) ; le décor entier qui continuait d'être dessiné pendant
la porte ; la variable `--cut` re-résolue par tous les éléments de la scène à
chaque image (maintenant une transformation en ligne sur six calques, la variable
ne vit que dans la porte) ; le filtre SVG de déformation gardé sur les trois blocs
de texte même à zéro (maintenant attaché seulement quand il agit) ; la méduse 2D
redessinée sous la WebGPU ; les bulles au repos redessinées à chaque image (une
sur deux maintenant). Résultat sur la même machine : 54 images/s dans la section,
60 pendant la porte. Règles posées pour que ça tienne :
- le décor se met en pause dès que la porte s'ouvre (`doorBusy`) ;
- la méduse WebGPU n'est chargée que sur une carte forte (NVIDIA, AMD, Apple, Intel
  Arc) : sur Intel intégré ou Qualcomm elle tournait à 20-28 images/s même sans
  bloom et à 0,7 de résolution, donc c'est la méduse 2D qui reste (60 images/s) et le
  module de 2 Mo n'est jamais téléchargé ;
- si elle est chargée, elle est gouvernée (`govern`) : chaque seconde à l'écran son
  débit réel est lu ; sous 40 images/s elle descend d'un cran (1 : résolution 1 et
  demi-bloom ; 2 : 0,7 sans bloom ; 3 : retour à la méduse 2D, définitif). Jamais
  de remontée. `?gq=0|1|2|3` force un cran (3 = pas de WebGPU) pour le regarder.
Mesurer : `HEADED=1 node _outils/fluidite.js <url>` (accueil) ; la section et la
porte se rejouent avec `parcours.js` et les scripts de mesure de `_outils/`.

**Une seule version par visite.** `telaventis.js` décide au tout début, une fois,
si la visite est « légère » : `saveData`, type effectif 2g/3g, débit < 1,5 Mbit/s
ou latence > 450 ms (Chrome) ; sinon, pour Safari/Firefox qui n'ont pas cette
API, le script lui-même démarre plus de 1,8 s après le début de la navigation ;
ou appareil faible (≤ 2 cœurs ou ≤ 2 Go). Le résultat est gardé jusqu'au
rechargement (`window.__tvTier`, classe `html.lite`) : jamais de méduse qui
apparaît puis disparaît. La version légère est celle des téléphones — champ de
bulles au lieu de la méduse, pas de WebGPU, pas de déformation du texte, grille
de bulles plus grossière, piste plus courte — sur n'importe quel écran
(`compactView` dans `telaventis-fx.js` ; les règles CSS du téléphone sont
recopiées sans leur condition de largeur, rien à dupliquer à la main), plus des
affiches à la place des vidéos (accueil et page Travaux). **Pour voir l'une ou l'autre : `?lite=1` ou
`?lite=0` dans l'adresse.**

**Mesurer.** Dans deux terminaux :

```bash
python _outils/lent.py 3g            # serveur lent : 700 kbit/s, 400 ms (ou « 4g » : 1,6 Mbit/s, 300 ms)
cd _outils && npm install            # une fois
node mesurer.js http://127.0.0.1:8762/index.html            # ordinateur ; --mobile pour un téléphone
node mesurer.js http://127.0.0.1:8762/index.html --film=out  # garde des images à 1, 2, 3, 5, 8 s
node parcours.js http://127.0.0.1:8742/index.html --scenario=auto   # joue la section des méduses
```

(`mesurer.js` / `parcours.js` utilisent le Chromium de playwright-core ; si la
version installée n'est pas celle attendue : `CHROMIUM=<chemin du .exe>`.)
Objectifs, à 1,6 Mbit/s sans cache : premier écran lisible en moins de 2 s,
décalage de mise en page (CLS) sous 0,1, aucune vidéo ni affiche de la vitrine
demandée avant la fin du chargement, aucune erreur dans la console. Mesures de
référence de ce travail (ordinateur, 1,6 Mbit/s, sans cache, version complète) :
premier affichage 1,65 s, CLS 0,009, 237 Ko reçus avant le premier affichage,
aucune vidéo ni affiche de la vitrine avant la fin du chargement. `parcours.js` rejoue la section des méduses :
`auto` (doit aller jusqu'au titre Moka puis s'arrêter), `user` et `user-late`
(doivent rendre la main au premier geste et ne plus se relancer), `fling` (une
molette vive ne doit jamais déclencher le défilement automatique).

Avant d'ajouter quoi que ce soit au premier écran : le mesurer ainsi. Un ajout
qui se charge avant le titre ou le ciel se paie en secondes sur ceux qui en ont
le plus besoin.
