# Mise en route Supabase — étapes 2 à 6

Pour la recette complète, le déploiement et les guides d’utilisation, consulter
[`architecture/etape-8-tests-deploiement.md`](../architecture/etape-8-tests-deploiement.md),
[`architecture/guide-utilisation-fermier.md`](../architecture/guide-utilisation-fermier.md)
et [`architecture/guide-utilisation-admin.md`](../architecture/guide-utilisation-admin.md).

## Pré-requis

Créez un projet Supabase de développement. Dans **Authentication → URL
Configuration**, ajoutez les URL locale et de production qui seront réellement
utilisées. Gardez la confirmation d'adresse e-mail activée en production.
Le formulaire d'inscription ne crée que des comptes fermiers ; la validation
d'e-mail ne rend pas le profil fermier publiable.

## Appliquer le schéma

Appliquez les migrations dans l'ordre :

1. `migrations/0001_initial_schema.sql`
2. `migrations/0002_auth_policies_storage.sql`
3. `migrations/0003_farmer_platform.sql`
4. `migrations/0004_admin_console.sql`
5. `migrations/0005_private_listing_photos.sql`

Utilisez l'éditeur SQL Supabase dans le même ordre et vérifiez que les cinq
scripts finissent sans erreur. La seconde migration crée des politiques RLS,
un bucket réservé aux photos d'annonces et un bucket privé réservé aux
justificatifs facultatifs. La cinquième migration rend aussi le bucket photo
privé : seules les photos d'annonces publiées et visibles, ou accessibles à leur
fermier, à un modérateur ou à un administrateur, peuvent être lues. Le navigateur
utilise des URL signées temporaires ; ne rendez jamais ces buckets publics.
Les fichiers d'identité ne doivent jamais être rendus publics.

La limite d'upload est de 5 MiB. Le bucket photo accepte JPEG, PNG et WebP ; le
bucket justificatif accepte PDF, JPEG et PNG. Ces contrôles de stockage
complètent la validation du navigateur mais ne remplacent pas une analyse
antivirus ou une vérification serveur du contenu réel des fichiers avant une
mise en production.
Les chemins attendus sont `listing-photos/<UUID-fermier>/<UUID-annonce>/<fichier>`
pour les photos et `farmer-documents/<UUID-fermier>/<fichier-UUID>` pour les
justificatifs.

## Configurer le navigateur

1. Copiez l'URL du projet et sa **clé publishable** (ou la clé `anon` historique)
   dans `site/js/supabase-config.js`.
2. Ne placez jamais la clé `service_role`, un secret ou une clé privée dans
   `site/`. La clé publishable est destinée au navigateur ; RLS est la barrière
   de sécurité des données.
3. Servez `site/` par HTTP(S) local ou un hébergement statique. Les scripts et
   requêtes d'authentification ne fonctionnent pas de façon fiable en ouvrant
   simplement le HTML comme un fichier local.
4. Ouvrez `site/pages/authentification.html` pour créer un fermier de test.
   Son rôle est toujours `farmer` et son statut commence à `pending`. Aucun
   champ envoyé par le navigateur ne peut attribuer le rôle admin/modérateur.
5. Pour tester une demande de nouveau mot de passe, ajoutez l'URL exacte de
   cette page aux redirections autorisées dans la configuration Auth du projet.

La page utilise la version 2.118.0 du SDK JavaScript Supabase depuis jsDelivr.
Sa connexion utilise PKCE et conserve la session avec le mécanisme de stockage
du SDK. Après installation/configuration, contrôlez le flux complet de
confirmation e-mail, connexion, déconnexion et récupération sur le projet
réel ; les secrets de session ne doivent jamais être copiés dans un journal ou
un ticket.

Dans **Authentication → Settings**, configurez une longueur minimale de mot de
passe d'au moins 12 caractères, les limites d'envoi d'e-mails et les protections
anti-abus disponibles. Un vrai administrateur doit être créé/invité par un
processus opérateur de confiance, puis promu dans un environnement contrôlé ;
ne transformez jamais un formulaire public en outil de promotion de rôle.
Pour l'invitation opérateur, créez le compte depuis le tableau de bord Auth sans
`account_type=farmer`, puis relevez son UUID vérifié et attribuez le rôle via
SQL Editor :

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_AUTH_VERIFIE'::uuid;
```

Le trigger crée un profil de base pour cet utilisateur mais n'accepte jamais
un rôle fourni dans les métadonnées publiques. N'utilisez ce SQL que depuis le
compte opérateur de confiance et remplacez l'UUID par celui du compte attendu.

Après connexion, le compte fermier donne accès à son tableau de bord. L’espace
admin doit être initialisé par un opérateur de confiance, puis protégé par MFA
avant toute gestion des données.

## Données de démonstration

Exécutez `seed.sql` uniquement dans un projet de développement. Il insère les
catégories et contenus d'exemple. Pour obtenir aussi les annonces réalistes,
créez d'abord un compte de test `demo-fermier@example.test` dans ce projet
isolé, puis exécutez le seed. Ce domaine réservé est destiné aux tests et ne
reçoit pas d'e-mails ; confirmez le compte depuis le tableau de bord Supabase
ou utilisez un fournisseur d'e-mails de test. Le seed approuve explicitement
ce seul compte de démonstration.

## Site client — étape 3

- L’accueil : `site/index.html`
- Le catalogue avec recherche, filtres et tri : `site/pages/catalogue.html`
- La fiche d’offre (ouverte par les cartes du catalogue) :
  `site/pages/produit.html?id=<identifiant>`
- Les pages À propos, Contact, FAQ, Conditions, Confidentialité et Conseils
  se trouvent dans `site/pages/informations/`.

Servez `site/` en HTTP(S), puis ouvrez `index.html`. Sans URL/clé Supabase, le
site affiche un catalogue local explicitement fictif. Il n’affiche pas de faux
badge vérifié et bloque l’envoi WhatsApp. Pour tester seulement le parcours de
démonstration, vous pouvez renseigner `demoWhatsAppNumber` dans
`site/js/supabase-config.js` avec un numéro de test contrôlé au format
international, chiffres seuls. Ne déployez pas les annonces de démonstration et
ne dirigez jamais une maquette vers le numéro d’un tiers.

Avec un projet configuré, le catalogue public lit seulement les annonces
publiées (y compris les stocks épuisés, signalés comme indisponibles lorsque le
filtre « en stock » est désactivé), avec le profil fermier approuvé, la
catégorie active et les photos publiques. Le panier conserve dans le stockage local du navigateur
uniquement les identifiants d’offres et les quantités ; nom, téléphone et ville
ne sont intégrés au message que dans le navigateur, puis transmis à WhatsApp
uniquement si l’acheteur choisit de l’envoyer. Un panier ne peut contenir que
des annonces d’un même fermier.

Pour un essai réel, faites publier une offre d’un fermier approuvé disposant
d’un numéro WhatsApp vérifié, sélectionnez-la depuis le catalogue, renseignez
les coordonnées de test et vérifiez le message prérempli avant de l’envoyer.
Le site ne perçoit pas le paiement et ne reçoit aucune confirmation de vente.
Le nom officiel, les photos authentiques, un contact de support et la politique
juridique définitive restent à fournir avant la mise en ligne.

## Plateforme fermier — étape 4

Après avoir appliqué les migrations 0001, 0002 et 0003 dans cet ordre, ouvrez
`site/pages/authentification.html` pour créer un compte fermier, puis validez
son statut `approved` depuis le tableau Supabase avec un compte administrateur
de confiance. Reconnectez-vous et choisissez **Accéder à mon espace fermier**.
Un profil en attente ne peut ni publier une annonce ni envoyer des photos.

Le tableau fermier permet de créer un brouillon ou de soumettre une annonce à
la modération, modifier et supprimer ses propres annonces non publiées,
mettre en pause une annonce publiée, transmettre un justificatif privé et
consulter les vues, clics WhatsApp et notifications internes. Une modification
d’annonce repasse en modération. Les photos sont limitées à cinq par annonce,
JPEG/PNG/WebP, 5 MiB chacune ; le nombre est aussi contrôlé par la base. Les
justificatifs privés sont limités à 5 MiB, PDF/JPEG/PNG. Les contrôles MIME et
taille du navigateur ne remplacent pas une analyse du contenu ou un antivirus.

La marketplace publique se trouve dans `site/pages/marketplace.html` et les
profils dans `site/pages/fermier.html?id=<UUID-fermier>`. Les filtres sont
locaux aux résultats chargés ; les boutons de panier utilisent le panier
commun du site et restent limités à un seul fermier par commande. Les avis et
signalements sont soumis par des fonctions SQL dédiées, puis modérés avant
publication ou traitement. Les avis ne prouvent pas un achat.

Les notifications de validation ou refus sont internes à l’espace fermier ;
aucun e-mail ni message WhatsApp automatique n’est envoyé dans cette étape.
Les statistiques dédupliquent les vues d’offres et les contacts WhatsApp
(annonce ou profil) par clé navigateur et par jour. Elles restent
approximatives : cette clé peut être effacée ou modifiée et ne représente pas
un visiteur unique vérifié ni une vente confirmée. Les avis et signalements
sont également limités à une clé navigateur ; ce n’est pas une protection
complète contre le spam, car un visiteur peut modifier cette clé.

Avant validation, testez avec deux comptes fermiers distincts : un compte en
attente ne peut pas publier ; le compte approuvé peut créer, modifier, mettre
en pause et supprimer seulement ses propres annonces non publiées. Vérifiez
aussi la soumission d’avis et de signalement, la visibilité des annonces
publiées, les notifications après modération et l’absence d’accès aux
justificatifs d’un autre compte. Ces parcours nécessitent un projet Supabase
connecté ; le mode local sans configuration n’utilise que des données fictives.

## Espace d’administration — étape 5

1. Appliquez d’abord la migration `0004_admin_console.sql` après les migrations
   précédentes.
2. Créez/invitez le premier compte opérateur dans **Authentication → Users**,
   sans métadonnée `account_type=farmer`. Depuis le SQL Editor de confiance,
   relevez et vérifiez soigneusement son UUID puis promouvez-le :

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'UUID_OPERATEUR_VERIFIE'::uuid;
   ```

3. Connectez ce compte sur `site/pages/authentification.html`, puis ouvrez
   l’espace administration. Il doit enregistrer un facteur TOTP (application
   d’authentification) ou confirmer son code. Les tables et fonctions admin
   exigent ensuite une session Supabase **AAL2** ; le simple rôle admin ou le
   masquage d’un bouton ne suffit pas pour autoriser l’accès côté serveur.
   Une session AAL1 ne peut pas consulter les données de gestion.
4. Ouvrez `site/pages/admin.html`. Les rôles, modérations, catégories,
   paramètres et statistiques sont chargés depuis Supabase avec RLS. Le journal
   est alimenté par des déclencheurs SQL ; les détails enregistrés évitent les
   numéros et le contenu des avis/signalements. Les statistiques visiteur et
   WhatsApp sont des estimations : un clic WhatsApp ne confirme pas une vente.
5. Pour supprimer réellement un compte fermier, déployez la fonction Edge
   `admin-delete-farmer` et configurez l’origine autorisée exacte de votre
   site. Le navigateur ne reçoit jamais la clé `service_role`. Exemple avec le
   CLI Supabase, depuis un environnement opérateur de confiance :

   ```powershell
   supabase secrets set ADMIN_ALLOWED_ORIGIN=https://votre-domaine.example
   supabase functions deploy admin-delete-farmer
   ```

   La fonction utilise les variables Supabase `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_ANON_KEY` fournies à l’environnement
   Edge. Si votre projet fournit plutôt la clé publishable, configurez
   `SUPABASE_PUBLISHABLE_KEY` comme secret Edge. Elle vérifie le jeton et le
   niveau AAL2, recontrôle le rôle admin, écrit le journal, supprime les objets
   des deux buckets, les annonces et l’utilisateur Auth. La suppression est
   irréversible ; vérifiez le compte et l’environnement avant confirmation.
   Si une suppression échoue après le nettoyage du stockage, consultez les
   journaux de fonction avant de réessayer : les étapes externes à la base ne
   sont pas transactionnelles.

L’espace admin n’invite pas un nouvel utilisateur depuis le navigateur (cela
nécessiterait une clé privilégiée). Créez d’abord son identité depuis Auth ;
un administrateur AAL2 peut ensuite attribuer le rôle depuis l’onglet
**Administrateurs**. Le dernier administrateur et son propre rôle ne peuvent
pas être rétrogradés depuis cette interface. La perte du second facteur doit
être traitée par un opérateur de confiance dans Supabase Auth.

Pour les réglages, `site_content`, `public_whatsapp`, `contact`, `social_links`
et `supported_languages` sont des données publiques : n’y mettez aucun secret.
Le nom du site peut rester explicitement marqué provisoire. Les annonces,
fermiers, avis et signalements restent modérés séparément ; masquer ou refuser
ne signifie pas supprimer.

### Vérifications manuelles requises

- Sans session et avec un compte fermier/modérateur : impossible d’ouvrir les
  listes ou fonctions d’administration, même en appelant directement l’API.
- Compte admin AAL1 : voit seulement son profil et l’écran d’enrôlement MFA ;
  listes, fonctions SQL et mutations admin sont refusées.
- Compte admin AAL2 : peut valider/refuser/suspendre un fermier, attribuer le
  badge, consulter un justificatif privé temporaire, publier/refuser/masquer
  une annonce ou un avis, traiter un signalement, modifier une catégorie et
  les paramètres, changer les rôles, consulter le journal et exporter les CSV.
- Les données du compte farmer B ne sont jamais modifiables depuis une action
  farmer A. Vérifiez que suspendre un fermier met ses annonces en pause et ses
  avis publics en retrait.
- Ne publiez pas une annonce si le fermier n’est pas approuvé ou sa catégorie
  inactive ; la base doit la refuser.
- Vérifiez que seul `ADMIN_ALLOWED_ORIGIN` peut appeler la fonction de
  suppression et que les photos, justificatifs et utilisateur Auth sont
  supprimés ensemble. Inspectez le journal après chaque essai.

Ces tests de permissions et la suppression doivent être exécutés sur un projet
de test avec plusieurs comptes. La migration a été vérifiée syntaxiquement,
mais aucune instance Supabase n’est configurée dans ce dossier : les rôles,
MFA, RLS, stockage et fonction Edge restent à valider sur le projet réel.

## Vérifications d'accès avant tout déploiement

- Utilisateur anonyme : voit catégories actives, annonces publiées de fermiers
  approuvés et photos ; ne lit aucun profil privé, justificatif, rapport ou
  journal.
- Fermier en attente : lit son propre profil et ne peut pas publier, modifier
  une annonce ni envoyer une photo d'annonce.
- Fermier approuvé : gère ses coordonnées, ses annonces et les photos de ses
  annonces, mais ne peut pas changer son rôle/statut ni toucher aux données d'un
  autre fermier.
- Modérateur : peut consulter et modérer annonces, avis et signalements selon
  les politiques ; ne peut pas changer le contenu commercial d'une annonce, un
  rôle, les paramètres ou le journal.
- Administrateur : peut gérer les tables protégées et les documents privés.

Ces tests doivent être exécutés avec des comptes séparés via l'API/SQL Editor
local avant l'ouverture au public. Aucun projet ni identifiant Supabase n'étant
encore configuré ici, les politiques et flux Auth de cette étape sont livrés
mais ne peuvent pas être déclarés testés contre une vraie instance.

## Innovation, performance et référencement — étape 6

### Installation et mode hors connexion

- Le point d’entrée PWA est `site/manifest.webmanifest`. Les icônes de marque
  et le bouton d’installation sont déjà intégrés aux pages publiques.
- Le SDK Supabase n’est téléchargé depuis jsDelivr que si une URL et une clé
  publishable sont configurées ; en démonstration, il n’y a pas de requête à ce
  CDN. Sur une configuration active, le catalogue de secours est utilisé si le
  SDK ou l’accès aux données ne peut pas être chargé.
- `site/sw.js` met en cache les ressources de l’interface et les pages d’accueil,
  catalogue et fiche offre. Il ne met jamais en cache les pages de connexion,
  le tableau fermier ni l’administration. Le navigateur doit servir le site en
  HTTPS (ou sur `localhost`) pour autoriser le service worker.
- Lorsqu’une lecture Supabase échoue pour une raison réseau, jusqu’aux
  150 annonces publiques les plus récentes peuvent être relues depuis le
  navigateur pendant 30 jours maximum. Elles sont signalées comme périmées et
  toute commande reste désactivée jusqu’au retour en ligne. Les photos stockées
  sur Supabase ne sont pas garanties hors connexion. Le cache ne remplace pas
  une sauvegarde serveur.
- Après une modification des ressources de l’application, le service worker
  retélécharge les fichiers à sa prochaine installation. Testez le déploiement
  depuis un profil navigateur propre et retirez l’ancien service worker lors
  d’un test de migration.

### Mode léger, images et position

- Le bouton **Mode léger** conserve le choix sur l’appareil, masque les photos
  sans les télécharger, allège les effets visuels et s’active par défaut si le
  navigateur signale `Save-Data`.
- Les photos d’annonce sélectionnées sont redimensionnées jusqu’à 1 600 pixels
  et converties en WebP si cela réduit leur taille. Une image optimisée reste
  soumise à la limite du bucket de 5 Mio. Les fichiers d’origine peuvent faire
  20 Mio au maximum avant optimisation ; les navigateurs sans prise en charge
  de la conversion gardent les fichiers d’au plus 5 Mio. Les justificatifs
  facultatifs ne sont jamais convertis. Les règles MIME/taille de Storage
  restent obligatoires.
- Le bouton **Trouver près de moi** demande l’autorisation du navigateur et
  calcule une distance approximative depuis le centre des villes connues. Les
  coordonnées du visiteur restent en mémoire uniquement ; les distances ne
  remplacent pas une adresse ni un calcul de trajet.

### Langues, alertes et SEO

- Le français reste la seule langue activée. La base `site/js/i18n.js` réserve
  les codes `mos` (mooré), `dyu` (dioula) et `ff` (fulfuldé) ; leurs choix sont
  désactivés jusqu’à traduction et relecture par des locuteurs.
- Quand les filtres ne trouvent aucun stock, le visiteur peut ouvrir WhatsApp
  pour envoyer une demande manuelle au numéro public d’assistance configuré.
  Le site ne sauvegarde pas cette demande et n’envoie pas d’alerte automatique.
- Les titres/descriptions HTML, le titre et la description de la fiche offre,
  `site/robots.txt` et `site/sitemap.xml` fournissent la base SEO. Le domaine
  est encore un exemple réservé : remplacez `votre-domaine.example` dans les
  deux fichiers avant publication et hébergez `site/` à la racine du domaine.
  Les fiches produites dynamiquement ne sont pas listées individuellement dans
  le sitemap.
- Les étapes de paiement Mobile Money, livraison et abonnement ne sont pas
  activées. Avant de les construire, définir tables et statuts dédiés, traitement
  serveur des paiements/webhooks et clés d’idempotence. Ne jamais collecter un
  code PIN Mobile Money ou exposer une clé fournisseur dans le navigateur.

### Essais à effectuer

1. En local HTTPS ou `localhost`, ouvrez l’accueil puis le catalogue en ligne ;
   vérifiez **Application / Manifest** et **Service Workers** dans les outils
   développeur, puis essayez le bouton d’installation sur un appareil éligible.
2. Chargez le catalogue avec des annonces réelles, passez le navigateur hors
   connexion et rechargez `pages/catalogue.html`. Vérifiez la date du cache, le
   filtrage, l’absence de commande et le retour aux données fraîches après
   reconnexion. Vérifiez aussi l’affichage des détails et l’avertissement quand
   le cache est absent ou a plus de 30 jours.
3. À 320 px et en simulation réseau lente, activez/désactivez **Mode léger** :
   les cartes restent utilisables et les photos ne sont pas requêtées en mode
   léger. Vérifiez le chargement différé et la compression WebP sur un appareil
   fermier de test.
4. Autorisez puis refusez la géolocalisation ; contrôlez que la liste se trie
   par ville approximative et que la position n’apparaît ni dans une requête ni
   dans `localStorage`.
5. Testez une recherche sans résultat, vérifiez le message WhatsApp et son
   destinataire avant l’envoi. Sans numéro d’assistance configuré, le site doit
   expliquer qu’aucune demande n’a été transmise.
6. Après avoir remplacé le domaine d’exemple, validez les URL du sitemap avec
   les outils du moteur de recherche et mesurez Lighthouse mobile sur le site
   déployé. Le score supérieur à 85 reste un objectif, pas un résultat mesuré
   dans ce dossier.
