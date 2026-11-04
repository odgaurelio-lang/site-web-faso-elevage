# Charte graphique — étape 1

## Direction

Une place de marché accueillante et fiable, enracinée dans le Burkina Faso.
L'univers associe des surfaces claires et sable, des accents rouge-vert-or, une
typographie lisible et des rappels graphiques discrets inspirés du tissage et
des motifs géométriques. La priorité est donnée aux photos authentiques des
élevages, aux prix visibles en FCFA et aux informations de confiance.

Le nom **Faso Élevage** reste provisoire. Le symbole étoilé de la maquette est
remplacé par une proposition d’emblème : une tête d’élevage stylisée, des
accents rouge-vert-or et de petits losanges évoquant le motif tissé. Le dessin
est volontairement simple pour rester reconnaissable en favicon et sur mobile ;
le nom et le logo restent à valider avant publication.

## Couleurs

| Usage | Couleur | Valeur |
|---|---|---|
| Action principale, confiance | Vert | `#176B45` |
| Survol et texte vert | Vert profond | `#0E4B31` |
| Action secondaire | Rouge | `#B83227` |
| Accent, étoile et avis | Or | `#E4AD27` |
| Détails et badges | Ocre foncé | `#78431F` |
| Fond chaud | Crème | `#FCFAF6` |
| Surface secondaire | Sable | `#F5EDDF` |
| Texte | Encre | `#292720` |
| Texte secondaire | Brun-gris | `#59564F` |
| Bordures et contrôles | Gris chaud | `#918A7F` |

Le rouge et le vert portent les actions plutôt que de former de longues zones de
texte. Le texte courant reste foncé sur fond clair ; l'or est réservé aux accents
et aux badges foncés pour conserver un contraste lisible.

## Typographie et formes

- Titres éditoriaux : Georgia, avec repli sur une police système à empattement.
- Texte, navigation et formulaires : Segoe UI / Noto Sans puis police système.
- Titres courts et prix fortement visibles ; prix exprimés en FCFA.
- Texte courant d'au moins 17 px ; texte secondaire d'au moins 16 px et petits
  libellés d'au moins 14 px.
- Couleurs de texte et de focus vérifiées pour rester contrastées sur les fonds
  clairs et foncés ; l'or reste décoratif plutôt qu'utilisé seul pour du texte.
- Les bordures de champs et de commandes restent visibles sur les surfaces
  claires.
- Boutons et filtres avec des zones tactiles d'au moins 48 px.
- Cartes aux coins doux, bordure sable, ombre légère et contenu hiérarchisé.

Les polices système évitent une dépendance réseau et améliorent le chargement sur
les connexions modestes. Les effets animés restent légers et respectent le
réglage « réduire les animations » du système.

## Motifs et ton

- Une bordure géométrique discrète rappelle le Faso Dan Fani et les motifs
  artisanaux, sans placer de motif derrière du texte dense.
- Les photos de produits et d'éleveurs doivent être réelles, lumineuses et
  prises avec l'accord des personnes concernées.
- Ton direct et chaleureux : « Du terroir burkinabè à votre table », « fermier
  vérifié », « stock confirmé ».
- Le badge « Made in Burkina » est utilisé pour l'origine ; il ne remplace pas
  la vérification d'identité du fermier ni la confirmation du stock.

## Composants

- Bouton vert : action principale et contact ; bouton rouge : action
  d'exploration ou d'ajout.
- Cartes produits : image, nom, ville, disponibilité, prix et action visibles.
- Badges verts : vérification ou disponibilité ; badge or : origine locale ;
  badge rouge : rejet ou attention.
- Filtres sous forme de pastilles à défilement horizontal sur petit écran.
- Tableau fermier : métriques brèves, statut des stocks et action « Ajouter un
  stock » prioritaire.

Les variables et composants de base sont dans
[`../site/css/base.css`](../site/css/base.css). Les quatre maquettes mobiles sont
présentées dans [`../site/design/maquettes-etape-1.html`](../site/design/maquettes-etape-1.html).
