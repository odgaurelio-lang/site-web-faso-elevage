# Architecture — marketplace d'élevage burkinabè

## Périmètre

Ce document matérialise le cadrage de l'étape 0. Il décrit la cible ; il ne
crée pas encore un site déployé, des comptes Supabase ou des politiques d'accès
prêtes pour la production.

## Choix technique

- **Interface :** HTML5, CSS3 et JavaScript natifs, mobile-first. Pas de framework
  front-end imposé.
- **Services de données :** Supabase (PostgreSQL, Auth et stockage d'images).
- **Hébergement de l'interface :** hébergeur statique tel que Cloudflare Pages
  ou Netlify.
- **Commande :** ouverture de `wa.me` avec un récapitulatif préparé dans le
  navigateur. Le site ne traite ni paiement ni confirmation de commande.

Supabase évite de maintenir son propre serveur et réunit les services nécessaires
au démarrage. PostgreSQL convient aux relations entre fermiers, annonces,
catégories et avis. Les offres gratuites ont des limites et ne constituent pas
une garantie de coût ou de disponibilité ; les quotas devront être vérifiés au
moment du déploiement.

Le site client, le portail marketplace/fermier et l'espace admin sont trois
interfaces distinctes, avec leurs parcours et leurs accès propres, mais
partagent le même projet Supabase. Au lancement, elles peuvent être servies par
un même code et un même hébergement (par exemple avec des routes dédiées). Le
portail marketplace pourra ensuite être publié sur un sous-domaine ou déployé
séparément sans dupliquer les comptes ni les données. Cela répond au besoin
d'une plateforme fermier distincte sans imposer trois systèmes à maintenir.

## Structure cible

```text
.
├── architecture/
│   ├── architecture.md
│   └── charte-graphique-etape-1.md
├── site/
│   ├── css/
│   │   ├── base.css
│   │   ├── auth.css
│   │   └── client.css
│   ├── design/
│   │   └── maquettes-etape-1.html
│   ├── js/
│   │   ├── supabase-config.js
│   │   ├── i18n.js
│   │   ├── auth.js
│   │   ├── client-shell.js
│   │   └── client.js
│   ├── icons/
│   ├── manifest.webmanifest
│   ├── offline.html
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── sw.js
│   └── pages/
│       ├── authentification.html
│       ├── catalogue.html
│       ├── produit.html
│       └── informations/
│           ├── a-propos.html
│           ├── contact.html
│           ├── faq.html
│           ├── conditions.html
│           ├── confidentialite.html
│           └── conseils.html
└── supabase/
    ├── migrations/
    │   ├── 0001_initial_schema.sql
    │   └── 0002_auth_policies_storage.sql
    ├── README.md
    └── seed.sql
```

Les pages `marketplace.html` et `tableau-fermier.html` constituent le portail
fermier distinct du parcours d'achat client. `admin.html` est réservé aux rôles
autorisés ; masquer un lien dans l'interface ne remplace jamais les contrôles
d'accès côté base.

Les clés publiques du client Supabase peuvent être utilisées dans le navigateur
uniquement avec des politiques RLS correctement testées. La clé `service_role`
et tout secret restent côté serveur et ne sont jamais intégrés aux fichiers
front-end.

## Modèle de données

Le schéma SQL initial correspondant se trouve dans
[`../supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql).

| Table | Contenu |
|---|---|
| `profiles` | Profil applicatif lié au compte Supabase Auth et rôle interne. |
| `farmer_profiles` | Ferme, ville, numéro WhatsApp public et état de validation. |
| `farmer_documents` | Chemins des justificatifs facultatifs dans un bucket privé. |
| `categories` | Catégories d'espèces et état actif/inactif. |
| `listings` | Annonces, prix en XOF, stock, détails, localisation et modération. |
| `listing_photos` | Chemins des photos du stockage Supabase et ordre d'affichage. |
| `reviews` | Notes et avis soumis à modération. |
| `reports` | Signalements d'annonces ou d'avis et traitement associé. |
| `whatsapp_contact_events` | Mesures de clics/intention de contact, sans conversation. |
| `site_settings` | Paramètres et contenus configurables du site. |
| `activity_logs` | Journal des opérations administratives. |

Les commandes via WhatsApp ne sont pas des ventes confirmées : le site ne peut
pas savoir si une conversation a abouti. Les événements de contact ne doivent
donc pas être présentés comme des commandes conclues.

Les nom, téléphone et ville du client servent à composer le message WhatsApp
dans son navigateur ; ils ne sont pas conservés dans la base par défaut. Les
justificatifs d'identité des fermiers sont facultatifs et, s'ils sont ajoutés,
doivent aller dans un bucket privé avec accès limité et durée de conservation
définie.

## Accès par rôle

| Fonction | Visiteur/client | Fermier validé | Modérateur | Admin |
|---|---:|---:|---:|---:|
| Lire les annonces publiées | Oui | Oui | Oui | Oui |
| Contacter un fermier sur WhatsApp | Oui | Oui | Oui | Oui |
| Créer/gérer ses annonces | Non | Oui, les siennes | Non | Oui |
| Gérer les annonces d'autres fermiers | Non | Non | Modération limitée | Oui |
| Valider, refuser ou suspendre un fermier | Non | Non | Non | Oui |
| Modérer les avis et signalements | Non | Non | Oui | Oui |
| Gérer catégories et paramètres | Non | Non | Non | Oui |
| Gérer les administrateurs et consulter le journal | Non | Non | Non | Oui |

Les clients peuvent commander sans compte. Les rôles privilégiés ne sont jamais
choisis à l'inscription publique. L'interface seule ne constitue pas un contrôle
d'accès : chaque règle doit être appliquée en base via RLS, puis vérifiée avec
des comptes de test de chaque rôle avant d'ouvrir l'application.

La migration initiale active RLS sans ajouter de politiques : l'accès via la
clé publique reste donc fermé par défaut. La migration
[`0002_auth_policies_storage.sql`](../supabase/migrations/0002_auth_policies_storage.sql)
ajoute les politiques, les buckets et le profil fermier en attente à l'inscription.
Les politiques doivent encore être exercées avec des comptes séparés dans un
projet Supabase de test avant toute utilisation publique.

## Pages et parcours

### Client

Accueil → catalogue, recherche et filtres → fiche et galerie produit → formulaire
court (nom, téléphone, ville, quantité) → ouverture de WhatsApp avec le message
prérempli. Le panier, s'il est activé, regroupe uniquement des produits du même
fermier dans un message.

### Fermier

Inscription → compte en attente → validation administrative → tableau de bord →
création/modification/mise en pause d'annonce → annonce publiée après les
contrôles et la modération configurés.

### Administration

Connexion dédiée → tableau de bord → validation des fermiers et annonces →
modération des avis et signalements → gestion des catégories, contenus,
paramètres et journal.

### Pages publiques

Accueil, catalogue, fiche produit, profil fermier, marketplace, À propos,
Contact, FAQ, Conditions d'utilisation, Politique de confidentialité et
Conseils d'achat.

## Innovation et évolutions

- L’accueil et le catalogue peuvent être installés comme PWA. Le service worker
  met en cache les fichiers de l’interface et les pages catalogue/fiche produit ;
  les données publiques affichées hors connexion sont une copie locale limitée
  aux 150 offres les plus récentes et conservée 30 jours au maximum. Cette copie
  est signalée comme potentiellement périmée et ne permet pas de commander.
- Le mode léger masque les photos sans les télécharger, réduit les effets visuels
  et se préactive si le navigateur signale `Save-Data`. La compression WebP côté
  navigateur est appliquée uniquement aux photos d’annonce ; les justificatifs
  d’identité ne sont ni modifiés ni redimensionnés par cette fonctionnalité.
- La géolocalisation est déclenchée par un geste explicite. Une distance
  approximative est calculée entre la position du visiteur et le centre de la
  ville du fermier ; la position n’est pas enregistrée ni envoyée au serveur.
- Le catalogue dispose d’un socle de langues (`fr`, `mos`, `dyu`, `ff`) avec
  repli vers le français. Les choix Mooré, Dioula et Fulfuldé restent désactivés
  tant que les traductions n’ont pas été réalisées et relues par des locuteurs.
- Une demande manuelle d’alerte peut ouvrir WhatsApp avec les filtres choisis.
  Elle n’est ni enregistrée par le site ni transformée en notification
  automatique ; une automatisation future demandera un consentement, un numéro
  confirmé et une fonction serveur sécurisée.
- Avant un paiement Mobile Money, une livraison ou un abonnement, ajouter des
  tables dédiées pour les tentatives de paiement, livraisons et abonnements,
  avec états explicites, montants en XOF, références fournisseur et clés
  d’idempotence. Les secrets, validations de paiement et webhooks doivent rester
  côté serveur ; aucun code PIN Mobile Money ne doit être demandé ou stocké par
  le site. Ces fonctionnalités ne sont pas activées par la présente version.

Le domaine de production restant à choisir, le domaine d’exemple du sitemap et
de `robots.txt` doit être remplacé avant de soumettre ces fichiers aux moteurs
de recherche. La vitesse réelle et les scores Lighthouse devront être mesurés
après déploiement avec les photos et le domaine de production ; aucun score
Lighthouse n’est présumé par le code seul.

## Hypothèses à confirmer avant les étapes suivantes

- Nom de la plateforme, logo et identité du contact WhatsApp officiel.
- Villes et régions desservies au lancement.
- Conditions de validation des fermiers et pièces justificatives acceptées.
- Politique de modération des annonces, avis et signalements.
- Durée de conservation des données et coordonnées de contact/confidentialité.
- Hébergeur et formule Supabase après estimation du trafic et vérification des
  tarifs en vigueur.
