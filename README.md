# Telaventis

Site vitrine de [telaventis.fr](https://telaventis.fr) — studio web indépendant.

## Le principe

Un site statique, écrit à la main : HTML, CSS et JavaScript, sans framework, sans étape de build, sans CMS. Pas de dépendance runtime — les rares effets visuels (révélation de titres, fond animé de la section d'accueil, etc.) sont ré-implémentés à la main plutôt qu'importés d'une librairie, et documentés en commentaire directement à côté du code qu'ils touchent. Le détail de ce qui est adapté de quoi, et sous quelle licence, est dans [`mentions-legales.html`](mentions-legales.html).

## Structure

```
index.html, work.html, studio.html, tarifs.html, contact.html, …   pages FR (racine)
en/                                                                  mêmes pages, EN
it/                                                                  mêmes pages, IT
assets/
  telaventis.css / telaventis.js         styles et scripts globaux du site
  telaventis-fx.{css,js}                 effets visuels (§ voir en-tête du fichier)
  moka-lab.{css,js}                      étude de cas scroll-driven (page d'accueil)
  aurelia/                               méduse WebGPU (desktop), cf. crédits
  fonts/, art/, shots/, icons/, moka/    polices auto-hébergées, images
sitemap.xml, robots.txt, site.webmanifest
_headers, _redirects                     config Cloudflare Pages (CSP, cache, redirections)
```

Trois langues, une seule arborescence par langue (pas de génération de pages) : toute page a un équivalent exact dans les deux autres dossiers, avec les mêmes `hreflang` en tête de fichier.

## Hébergement & déploiement

Déployé sur **Cloudflare Pages**, connecté à ce dépôt : un push sur `main` publie automatiquement. `_headers` fixe une Content-Security-Policy stricte et les en-têtes de sécurité ; `_redirects` gère la consolidation `www` → apex.

Le formulaire de contact poste directement vers **Web3Forms** (aucun backend à maintenir) — voir le commentaire dans `contact.html` pour le détail.

## Développement local

Aucune installation, aucune dépendance :

```bash
npx http-server .        # ou tout autre serveur statique
```

Pas de build : modifier un fichier, recharger la page.

## Licence

Code et contenu © Leonardo Rubatto / Telaventis — tous droits réservés. Ce dépôt sert de suivi de version et de vitrine de la façon dont le site est construit ; il n'est pas distribué sous licence open source. Les quelques techniques adaptées de démonstrations publiées par d'autres auteurs sont créditées en détail dans [`mentions-legales.html`](mentions-legales.html).
