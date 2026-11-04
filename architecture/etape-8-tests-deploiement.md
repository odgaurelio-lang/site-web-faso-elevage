# Étape 8 — Recette, déploiement et mise en production

## État de livraison

Ce dossier décrit une mise en ligne à faible coût pour le site statique `site/`
et son backend Supabase. Il ne signifie pas que le site est déjà en ligne ou que
la recette de production est approuvée.

Dans le workspace actuel, `site/js/supabase-config.js` ne contient ni URL ni clé
Supabase, `site/robots.txt` et `site/sitemap.xml` utilisent encore
`votre-domaine.example`, et aucun compte d’hébergement, domaine ou projet
Supabase de production n’est configuré. Le mode sans configuration affiche des
données locales fictives et ne permet pas de contacter un fermier. La mise en
production et son approbation restent donc à effectuer par le responsable du
projet avec les accès et choix réels.

## 1. Checklist de recette

### Conditions préalables

- [ ] Créer un projet Supabase **de test distinct** du projet de production.
- [ ] Appliquer les migrations `0001` à `0005` dans l’ordre indiqué dans
  [`../supabase/README.md`](../supabase/README.md), puis vérifier les politiques
  RLS, les buckets privés et la fonction Edge si la suppression de compte est
  testée.
- [ ] Créer des comptes et des annonces de test, dont deux fermiers distincts,
  un fermier en attente, un fermier approuvé, un modérateur et un administrateur.
  Ne pas utiliser de données personnelles ou de documents réels.
- [ ] Préparer un numéro WhatsApp de test contrôlé par l’équipe. Ne pas envoyer
  de message à un tiers pendant la recette.
- [ ] Noter la version testée, le navigateur, l’appareil, le résultat et toute
  anomalie. Toute permission refusée, fuite de données, erreur bloquante ou
  action destructive inattendue est un **bloquant**.

### Parcours client (visiteur anonyme)

- [ ] Ouvrir l’accueil, le catalogue, la marketplace, une fiche d’annonce, un
  profil fermier et les pages d’information.
- [ ] Rechercher et filtrer par espèce, ville, prix, disponibilité et tri ;
  réinitialiser les filtres et vérifier le cas « aucun résultat ».
- [ ] Vérifier qu’une annonce visible appartient à un fermier approuvé et à une
  catégorie active ; vérifier l’état épuisé lorsqu’il est affiché.
- [ ] Ouvrir une annonce, afficher ses photos et préparer un message WhatsApp.
  Contrôler le numéro, la quantité et le texte avant envoi ; annuler sans
  envoyer.
- [ ] Tester le panier avec plusieurs annonces d’un même fermier, puis tenter
  d’ajouter une annonce d’un autre fermier. Le site doit empêcher le panier
  multi-fermier.
- [ ] Vérifier qu’aucun paiement ou commande confirmée n’est annoncé et que le
  nom, téléphone et ville saisis ne sont pas enregistrés par le site.
- [ ] Sans configuration Supabase, vérifier l’avertissement de données fictives
  et l’impossibilité d’envoyer un contact réel.

### Parcours fermier

- [ ] Créer un compte fermier, confirmer l’adresse e-mail, se connecter, se
  déconnecter et tester la récupération du mot de passe.
- [ ] Avec un profil `pending`, vérifier que la publication et l’envoi de photos
  d’annonce sont refusés ; vérifier le message de statut.
- [ ] Avec un profil `approved`, enregistrer un brouillon, envoyer une annonce
  en modération, puis vérifier qu’elle n’est pas publique avant approbation.
- [ ] Modérer l’annonce depuis le compte administrateur de test ; vérifier sa
  visibilité publique après publication.
- [ ] Modifier une annonce publiée : elle doit repasser en modération. Tester
  aussi la mise en pause et la reprise selon les statuts disponibles.
- [ ] Tester les limites de photo (5 par annonce, formats acceptés, taille
  maximale après optimisation) ainsi que les erreurs de format/taille.
- [ ] Vérifier qu’un fermier A ne peut ni lire ni modifier le profil, les
  annonces, photos ou justificatifs du fermier B, y compris via un accès direct
  à l’API.
- [ ] Si un justificatif est envoyé à la demande de l’équipe, vérifier son
  accès privé, son lien temporaire et son inaccessibilité depuis un compte non
  autorisé.
- [ ] Vérifier que les vues et clics WhatsApp sont présentés comme des
  estimations, jamais comme des ventes ou des visiteurs uniques garantis.

### Parcours administrateur et modération

- [ ] Sans session, avec un compte fermier et avec un compte modérateur, vérifier
  que les données et opérations d’administration sont refusées côté interface
  **et** côté API.
- [ ] Avec un administrateur en session AAL1, vérifier que les écrans de gestion
  restent bloqués jusqu’à l’activation et à la vérification MFA (AAL2).
- [ ] Avec un administrateur AAL2, vérifier la vue d’ensemble et les listes de
  fermiers, annonces, avis, signalements, catégories, paramètres, rôles et
  journal.
- [ ] Valider, refuser et suspendre un fermier de test ; vérifier qu’une
  suspension met ses annonces en pause. Tester l’attribution et le retrait du
  badge uniquement pour un fermier approuvé.
- [ ] Publier/refuser/masquer une annonce et un avis ; traiter un signalement ;
  vérifier le résultat public et le journal après chaque action.
- [ ] Ajouter/modifier/désactiver une catégorie et modifier un paramètre public.
  Vérifier la mise à jour côté site. Ne jamais saisir de secret dans les
  paramètres publics ni activer une langue non traduite.
- [ ] Tester les exports CSV avec des données fictives et traiter les fichiers
  comme des données sensibles.
- [ ] Si la fonction de suppression est déployée, tester uniquement avec un
  compte fermier jetable dans le projet de test : origine autorisée, session
  AAL2, confirmation du nom exact, nettoyage des objets et journalisation.
  **Ne jamais tester une suppression sur un compte réel.**
- [ ] Vérifier la révocation de session après déconnexion, l’absence de secrets
  dans le navigateur, les journaux et les exports, et la protection du dernier
  compte administrateur.

### Mobile, accessibilité et navigateurs

- [ ] Tester les largeurs 320, 360, 390 et 768 px, en portrait et paysage :
  accueil, catalogue, fiche, connexion, formulaire fermier et espace admin.
- [ ] Vérifier que formulaires et commandes restent utilisables au tactile, que
  les erreurs sont lisibles, que les tableaux admin défilent sans casser la page
  et qu’aucune action ne dépend du survol.
- [ ] Tester navigation clavier, focus visible, libellés de formulaires, titres,
  annonces de statut et zoom navigateur.
- [ ] Tester les versions stables actuelles de Chrome et Edge sous Windows,
  Firefox sous Windows, Chrome sous Android et Safari sous iOS. Ajouter Safari
  macOS si disponible. Noter les versions réellement testées.
- [ ] Sur une connexion lente et avec le mode économie de données, vérifier le
  chargement des pages et des photos, l’absence de requête photo en mode léger
  et les messages d’erreur réseau.
- [ ] Tester l’installation PWA sur un appareil éligible. Hors connexion,
  vérifier le catalogue mis en cache et son avertissement de fraîcheur ; aucune
  donnée de compte ne doit être mise en cache. Vérifier également le retour en
  ligne et la mise à jour du service worker.

### Résultats de recette

| Domaine | Résultat | Référence / anomalie | Testeur et date |
|---|---|---|---|
| Client | À exécuter |  |  |
| Fermier | À exécuter |  |  |
| Administration et RLS | À exécuter |  |  |
| Mobile / accessibilité | À exécuter |  |  |
| Navigateurs | À exécuter |  |  |
| PWA / hors connexion | À exécuter |  |  |
| Sauvegarde et restauration | À exécuter |  |  |

Une section n’est approuvée qu’après exécution sur le projet de test connecté.
Les tests de permissions doivent réussir pour chaque rôle ; un simple contrôle
visuel ou une simulation locale ne vaut pas validation RLS.

## 2. Déploiement pas à pas

### Choix recommandé à petit budget

- **Interface :** Cloudflare Pages pour héberger gratuitement ou à faible coût
  les fichiers statiques `site/`. Les quotas et conditions changent : consulter
  les [tarifs Pages](https://www.cloudflare.com/plans/developer-platform/) avant
  de choisir une formule.
- **Données et comptes :** Supabase. Le coût dépend du plan, du trafic, du
  stockage et des fonctions activées. Vérifier les [tarifs Supabase](https://supabase.com/pricing)
  et les limites en vigueur avant la mise en production.
- **Domaine :** réserver au nom de l’organisation. Préférer `.bf` si le domaine
  est disponible et que ses conditions d’attribution conviennent ; sinon `.com`
  est une solution de repli. La disponibilité, le prix, les justificatifs
  demandés et les renouvellements doivent être vérifiés auprès du registre ou
  d’un bureau d’enregistrement avant achat.

### A. Préparer les identifiants et le domaine

1. Confirmer le nom définitif, le propriétaire du domaine, le contact de
   support, le numéro WhatsApp officiel, les textes juridiques et la personne
   qui approuve la publication.
2. Acheter le domaine avec une adresse de récupération détenue par
   l’organisation ; activer l’authentification multifacteur et le renouvellement
   automatique. Ne pas communiquer les codes d’accès dans les documents du
   projet.
3. Créer un projet Supabase de production distinct du projet de test. Vérifier
   la région, les quotas, la facturation, les alertes et les règles de
   conservation des données.

### B. Configurer Supabase de production

1. Appliquer une seule fois les migrations
   `supabase/migrations/0001_initial_schema.sql` à `0005_private_listing_photos.sql`
   dans l’ordre. Ne pas exécuter `supabase/seed.sql` en production.
2. Dans **Authentication → URL Configuration**, ajouter le domaine HTTPS
   canonique, les origines réellement utilisées et l’URL exacte de
   `pages/authentification.html` pour la redirection de réinitialisation de mot
   de passe. Conserver la confirmation d’adresse e-mail et renforcer les
   limites de mot de passe et d’envoi.
3. Dans `site/js/supabase-config.js`, renseigner l’URL du projet de production
   et sa clé **publishable**. Laisser `demoWhatsAppNumber` vide. La clé
   `service_role`, les mots de passe et les secrets Edge ne doivent jamais
   apparaître dans `site/`.
4. Inviter et promouvoir les administrateurs depuis un environnement de
   confiance ; activer MFA et vérifier l’accès AAL2. Ne pas créer de rôle admin
   via le formulaire public.
5. Si la suppression de compte est nécessaire, configurer `ADMIN_ALLOWED_ORIGIN`
   pour l’origine exacte `https://domaine`, puis déployer
   `admin-delete-farmer` selon le guide Supabase. Vérifier la fonction avant
   toute utilisation ; la suppression est irréversible.
6. Vérifier que les buckets `listing-photos` et `farmer-documents` restent
   privés et que les politiques RLS sont testées avec des comptes séparés.

### C. Préparer les fichiers publics

1. Remplacer `votre-domaine.example` dans `site/robots.txt` et
   `site/sitemap.xml` par le domaine canonique HTTPS. Ne publier aucun placeholder
   ou URL d’exemple.
2. Relire le contenu public (nom, coordonnées, conditions, confidentialité,
   photos) et supprimer toute donnée de démonstration ou de test.
3. Contrôler les chemins relatifs et ouvrir les pages depuis un serveur local
   HTTP(S), et non par double-clic `file://`.
4. La racine publique à déployer est le **contenu du dossier `site/`**. Ne pas
   mettre `supabase/`, les migrations, les justificatifs ou des fichiers
   d’environnement dans le répertoire publié.

### D. Publier sur Cloudflare Pages

1. Créer un compte Cloudflare avec une adresse contrôlée par l’organisation et
   activer MFA.
2. Dans **Workers & Pages**, créer un projet Pages par téléversement direct
   (Direct Upload) et choisir un nom de projet non confidentiel.
3. Téléverser le contenu de `site/` comme racine du site statique. Aucun
   framework ni commande de build n’est requis pour les fichiers actuels.
4. Ouvrir l’URL temporaire `*.pages.dev`. Vérifier l’accueil, les pages, les
   ressources, l’authentification Supabase, les liens, le catalogue et les
   erreurs de console/réseau.
5. Conserver la procédure et les fichiers de la version déployée. Pour chaque
   mise à jour, lancer la recette sur une préversion, puis téléverser une
   version approuvée. Le dossier actuel n’étant pas un dépôt Git, le téléversement
   direct est le chemin initial le plus simple.

### E. Connecter le domaine et vérifier HTTPS

1. Dans les paramètres Pages, ajouter le domaine racine choisi et, si souhaité,
   `www`. Suivre les enregistrements DNS fournis par Cloudflare ; ne pas
   remplacer les serveurs DNS d’un domaine sans l’accord de son propriétaire.
2. Si le domaine est géré ailleurs, appliquer exactement les enregistrements DNS
   indiqués dans Pages. Vérifier la validation du domaine avant d’annoncer le
   lancement.
3. Attendre l’émission du certificat TLS géré par l’hébergeur. Tester
   `https://domaine` et `https://www.domaine` si ce dernier est activé ; rediriger
   une seule variante vers l’URL canonique HTTPS.
4. Dans Supabase Auth et `ADMIN_ALLOWED_ORIGIN`, utiliser les origines HTTPS
   finales exactes. Tester inscription, confirmation e-mail, connexion, MFA,
   récupération du mot de passe, déconnexion et retour après expiration de
   session.
5. Sur le domaine final, vérifier le service worker, les pages privées
   non indexées, `robots.txt`, le sitemap et le manifeste PWA. Soumettre le
   sitemap aux outils de référencement seulement après remplacement de tous les
   exemples.

## 3. Sauvegardes automatiques et reprise

Une sauvegarde automatique n’est pas configurée dans ce workspace. La mise en
production doit inclure les deux volets suivants ; une sauvegarde de la base ne
protège pas les fichiers du Storage.

1. **Base PostgreSQL :** choisir un plan Supabase offrant des sauvegardes
   automatiques quotidiennes, vérifier dans le tableau de bord la fréquence et
   la rétention réellement incluses, puis désigner un responsable des alertes
   et restaurations. Supabase indique que les projets Pro, Team et Enterprise
   ont des sauvegardes quotidiennes, avec une rétention dépendant du plan ; les
   projets gratuits doivent exporter régulièrement leurs données.
2. **Copies hors site :** organiser en plus une exportation chiffrée et
   planifiée de la base vers un espace contrôlé distinct du projet. Stocker les
   identifiants uniquement dans le gestionnaire de secrets du mécanisme
   d’automatisation ; jamais dans le navigateur ou le dépôt public.
3. **Objets Storage :** planifier une copie distincte des objets des buckets
   `listing-photos` et `farmer-documents` vers un stockage chiffré contrôlé,
   avec droits minimaux, politique d’accès et durée de conservation définies.
   Une sauvegarde de base Supabase ne contient pas les objets, uniquement leurs
   métadonnées. Traiter les justificatifs comme des données personnelles et ne
   conserver que ce qu’autorise la politique de confidentialité.
4. **Surveillance :** envoyer une alerte en cas d’échec, vérifier l’âge de la
   dernière copie chaque jour et conserver plusieurs générations séparées de
   la production.
5. **Restauration :** au moins chaque trimestre et après toute modification
   importante, restaurer une copie dans un projet isolé. Vérifier la connexion,
   les rôles, les migrations, les annonces et l’ouverture des photos avant de
   déclarer la sauvegarde exploitable. Consigner le résultat et le temps de
   reprise.

La documentation Supabase précise que ses sauvegardes de base ne restaurent pas
les objets du Storage : [Sauvegardes de base de données Supabase](https://supabase.com/docs/guides/platform/backups).

## 4. Approbation de mise en ligne

Ne pas annoncer la plateforme comme disponible avant d’avoir rempli et approuvé
les points suivants :

- [ ] Nom, domaine, propriétaire et contact de support confirmés.
- [ ] Projet Supabase de production configuré ; migrations, RLS, Auth, MFA,
  buckets privés et fonction Edge vérifiés.
- [ ] URL et clé publishable de production renseignées ; aucun secret ou jeu de
  données de démonstration dans les fichiers publics.
- [ ] Domaine HTTPS actif ; redirections, liens, référencement et PWA vérifiés.
- [ ] Parcours client, fermier, administration, mobile et navigateurs réussis
  dans le tableau de recette ci-dessus.
- [ ] Sauvegarde de la base **et des objets** planifiée, surveillée et restaurée
  avec succès sur un environnement isolé.
- [ ] Responsable métier a vérifié les annonces, coordonnées, conditions et
  politique de confidentialité.

| Approbateur | Rôle | Date | Décision / référence |
|---|---|---|---|
|  |  |  | En attente |

### Références officielles

- [Cloudflare Pages — téléversement direct](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Pages — domaines personnalisés](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare — tarifs](https://www.cloudflare.com/plans/developer-platform/)
- [Supabase — tarifs](https://supabase.com/pricing)
- [Supabase — sauvegardes](https://supabase.com/docs/guides/platform/backups)
