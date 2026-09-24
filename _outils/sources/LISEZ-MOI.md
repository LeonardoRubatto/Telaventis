# Sources de l'identité

| Fichier | Ce que c'est |
|---|---|
| `logo-telaventis.png` | **Logo actuel** (T marbré avec feuillage, 1254 × 1254, reçu le 2026-09-24). Tout ce qui est publié en est tiré par `python _outils/identite.py _outils/sources/logo-telaventis.png`. |
| `logo-telaventis-v1-sans-feuilles.png` | Première version du même jour (T marbré sans feuillage, fond à motifs). |
| `anciennes-icones/` | **Le jeu d'icônes d'avant la refonte** (T coupé en diagonale, favicon SVG, icônes Android et Apple, et l'ancienne image de partage `og.png`), tel qu'il était en ligne. |

## Revenir aux anciennes icônes

```bash
python _outils/identite.py --restaurer _outils/sources/anciennes-icones
```

remet favicons, icône Apple, icônes Android et silhouette Safari en place
dans `assets/`. Pour l'ancienne image de partage : elle est toujours publiée
en `assets/og.png` ; remplacer `assets/share/telaventis-og.jpg` par
`assets/og.png` dans les balises `og:image` et `twitter:image` des pages (et
`image/jpeg` par `image/png` dans `og:image:type`).

Revenir au logo actuel : relancer `identite.py` sur `logo-telaventis.png`.
