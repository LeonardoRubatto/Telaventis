# AGENTS.md — instructions pour toute IA qui travaille sur ce site

Lire d'abord **[`_outils/MODE-EMPLOI.md`](_outils/MODE-EMPLOI.md)** : ce qui est
généré, ce qui est écrit à la main, et la méthode pas à pas.

## Les règles

1. **Ne jamais éditer à la main ce qui est entre les marqueurs**
   `<!-- projets:… -->` (pages) et `/* projets:debut */ … /* projets:fin */`
   (`assets/telaventis.css`). Modifier `_outils/projets.json`, puis
   `python _outils/projets.py generer`.
2. **Ajouter un projet** : suivre MODE-EMPLOI §2 dans l'ordre, et terminer par
   `python _outils/projets.py verifier` (il doit répondre ✓).
3. **Changer le logo** : `python _outils/identite.py <image>` — jamais de
   favicon ou d'image de partage retouchée à la main.
4. **Trois langues** : toute modification de texte se fait en FR (racine),
   EN (`en/`) et IT (`it/`).
5. **Demander à Leonardo avant d'afficher le logo d'un client**, logo par logo.
6. Pas d'étiquette au-dessus des titres, pas de flèche sur chaque lien, pas de
   bouton encadré dans une barre. Les écrans montrés doivent avoir un sens.
7. Aucune dépendance chargée depuis un CDN (la CSP de `_headers` l'interdit) ;
   tout effet vit dans `assets/`, avec un état au repos lisible sans JS et avec
   « réduire les animations ».
8. Après une modification de `assets/*.css|js` : monter leur `?v=` dans toutes
   les pages. Vérifier à 1440 px et à 390 px avant de dire que c'est fini.

Pour tout travail de front-end, le Design Memory
(`C:\.Leonardo\Project\design system (website elements template)`) se consulte
avant d'écrire : `node scripts/search.mjs "<besoin>"`.
