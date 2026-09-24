# Telaventis

Site vitrine de [telaventis.fr](https://telaventis.fr) — studio web indépendant.

## Le principe

Un site statique, écrit à la main : HTML, CSS et JavaScript, sans framework, sans étape de build, sans CMS. Pas de dépendance runtime — les effets visuels (titre « météo » de l'accueil, bandeau TELAVENTIS coupé en diagonale, bulles qui se transforment d'une phrase à l'autre, fente qui ouvre sur l'exemple Moka, vitrine des projets en plein écran, etc.) sont ré-implémentés à la main plutôt qu'importés d'une librairie, et documentés en commentaire à côté du code qu'ils touchent. Le détail de ce qui est adapté de quoi, et sous quelle licence, est dans [`mentions-legales.html`](mentions-legales.html).

**Pour faire évoluer le site — ajouter un projet client, changer le logo, retrouver un effet : [`_outils/MODE-EMPLOI.md`](_outils/MODE-EMPLOI.md).**

## Structure

```
index.html, work.html, studio.html, tarifs.html, contact.html, …   pages FR (racine)
en/                                                                  mêmes pages, EN
it/                                                                  mêmes pages, IT
assets/
  telaventis.css / telaventis.js         styles et scripts globaux (sections listées en tête de fichier)
  telaventis-fx.{css,js}                 effets visuels (méduses, bulles, fente, titres…)
  moka-lab.{css,js}                      l'histoire Atelier Moka (page d'accueil)
  aurelia/                               méduses WebGPU (écrans larges), cf. crédits
  fonts/                                 Archivo, Source Serif 4 (auto-hébergées)
  fonts/clients/                         le nom de chaque client dans sa propre police (OFL, sous-ensembles)
  video/                                 enregistrements des sites clients (AV1 + H.264)   ← générés
  work/, shots/                          écrans des sites clients                          ← générés
  share/, favicon*, icons/               logo, icônes, images de partage                   ← générés
  logos/                                 logos clients montrés (sur accord seulement)
  art/, moka/, menu-qr/                  images éditoriales
_outils/                                 outils de préparation, jamais servis (voir MODE-EMPLOI)
  projets.json                           LA source des projets clients
  projets.py                             generer · nouveau <cle> · verifier
  capturer.js, medias.py                 vidéos et captures d'un projet
  identite.py                            logo → favicons, icônes, images de partage
sitemap.xml, robots.txt, site.webmanifest
_headers, _redirects                     config Cloudflare Pages (CSP, cache, redirections)
```

Trois langues, une seule arborescence par langue : toute page a un équivalent exact dans les deux autres dossiers, avec les mêmes `hreflang` en tête de fichier. Les blocs de projets sont générés dans les trois langues à la fois.

## Hébergement & déploiement

Déployé sur **Cloudflare Pages**, connecté au dépôt : un push sur `main` publie automatiquement. `_headers` fixe une Content-Security-Policy stricte et les en-têtes de sécurité ; `_redirects` gère la consolidation `www` → apex et ferme `_outils/`.

Le formulaire de contact poste directement vers **Web3Forms** (aucun backend à maintenir) — voir le commentaire dans `contact.html`.

## Développement local

Aucune installation pour le site lui-même :

```bash
python -m http.server 8742        # ou tout autre serveur statique
```

Pas de build : modifier un fichier, recharger la page. Les outils de `_outils/` ont leurs propres prérequis (Python + Pillow, Node + playwright-core, ffmpeg), décrits dans le mode d'emploi.

## Licence

Code et contenu © Leonardo Rubatto / Telaventis — tous droits réservés. Ce dépôt sert de suivi de version et de vitrine de la façon dont le site est construit ; il n'est pas distribué sous licence open source. Les quelques techniques adaptées de démonstrations publiées par d'autres auteurs sont créditées en détail dans [`mentions-legales.html`](mentions-legales.html).
