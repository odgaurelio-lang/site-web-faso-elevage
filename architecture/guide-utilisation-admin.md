# Guide d’utilisation — administration

## Accès sécurisé

1. Un administrateur doit être invité et recevoir son rôle par un opérateur
   autorisé dans Supabase. L’inscription publique ne crée que des comptes
   fermiers.
2. Ouvrir [Connexion](../site/pages/authentification.html), se connecter avec
   le compte administrateur, puis ouvrir **Espace administration**.
3. Configurer une application d’authentification TOTP et saisir le code à
   six chiffres. Les opérations de gestion ne sont accessibles qu’avec une
   session MFA AAL2.
4. Utiliser un appareil privé et se déconnecter après chaque session. Ne jamais
   partager mot de passe, QR code, clé TOTP, clé Supabase ou code de récupération.

## Traiter les opérations courantes

- **Vue d’ensemble :** consulter les indicateurs et utiliser **Actualiser**.
  Les visites et clics WhatsApp sont des estimations, pas des commandes.
- **Fermiers :** rechercher un compte, examiner les coordonnées et le statut,
  puis valider, refuser ou suspendre. La suspension met les annonces en pause.
  N’attribuer le badge vérifié qu’après le contrôle correspondant et à un profil
  approuvé.
- **Justificatifs :** les ouvrir uniquement si nécessaire au contrôle. Les liens
  sont privés et temporaires (60 secondes). Ne pas les télécharger ou partager
  sans nécessité et autorisation.
- **Annonces :** vérifier l’espèce, le prix, le stock, la catégorie et le profil
  fermier avant de publier, refuser ou masquer. Une modification côté fermier
  peut nécessiter une nouvelle modération.
- **Avis et signalements :** examiner le contenu et le contexte avant de publier,
  masquer, traiter ou classer. Un avis ne prouve pas à lui seul un achat.
- **Catégories :** ajouter ou modifier les catégories du catalogue. Désactiver
  une catégorie la retire des choix publics ; vérifier les annonces concernées.
- **Paramètres :** modifier uniquement des informations publiques (nom, slogan,
  contact, liens). Ne jamais y inscrire de mot de passe, clé, donnée privée ou
  information non autorisée. Ne pas activer de langue avant que ses traductions
  soient complètes et relues.
- **Administrateurs :** pour inviter une personne, créer d’abord son compte dans
  Supabase Auth, puis lui attribuer le rôle approprié. Coordonner tout changement
  de rôle ; l’interface protège le compte courant et le dernier administrateur.
- **Journal :** consulter les actions pour le suivi des opérations. Exporter
  uniquement les données nécessaires et conserver les CSV de façon sécurisée.

## Supprimer un compte fermier

La suppression est définitive : elle efface le compte, ses annonces, avis,
photos et justificatifs. Vérifier l’identité et le motif avant de commencer,
prévenir les personnes concernées selon la procédure de l’organisation et
confirmer le nom exact de la ferme dans la boîte de dialogue.

La fonction Edge `admin-delete-farmer` doit avoir été déployée et configurée
pour l’origine HTTPS de production. Si elle est absente ou renvoie une erreur,
ne pas tenter une suppression manuelle improvisée : consulter un opérateur
Supabase et les journaux de fonction. Ne jamais tester cette action sur un
compte de production.

## Incident ou perte d’accès

- En cas d’action erronée, d’accès suspect ou d’exposition de données, arrêter
  les opérations concernées et prévenir immédiatement le responsable technique.
- Pour un problème MFA, suivre la procédure de récupération de l’organisation ;
  ne pas désactiver les contrôles RLS ou MFA en production.
- Les restaurations doivent suivre le guide
  [Tests et déploiement](./etape-8-tests-deploiement.md) et être testées dans un
  environnement isolé avant toute restauration de production.
