# Politique tarifaire — Deux options sans prix affiché

## Objectif

Remplacer l'unique option d'abonnement Pro (avec prix) par deux options coexistantes — achat unitaire de projet et abonnement illimité — sans afficher de tarif pour l'instant.

## Contexte

L'application est en phase d'accès anticipé. Les prix ne sont pas encore publics. Le schéma de base de données possède déjà un champ `project_credits` sur `profiles` et un champ `stripe_customer_id`, tous deux prévus pour cette évolution. Aucune intégration Stripe n'est implémentée : les deux options affichent "disponible prochainement".

## Modèle tarifaire

Deux offres coexistent, présentées sans prix :

| Offre | Description | Statut |
|---|---|---|
| **+1 projet** | Crédit unitaire — débloque un projet supplémentaire, sans engagement | Disponible prochainement |
| **Projets illimités** | Abonnement — projets illimités, sauvegarde cloud, tous appareils | Disponible prochainement |

L'offre "Projets illimités" est mise en avant (badge "Recommandé").

La logique de limite (1 projet pour les utilisateurs Free) reste inchangée.

## Fichiers modifiés

### `src/components/home/UpgradeModal.tsx`

**Avant :** une option "Passez au plan Pro" avec le prix "9 €/mois" et un bouton "Voir les offres Pro →".

**Après :**
- Titre : "Limite atteinte"
- Sous-titre : "Vous avez utilisé votre projet inclus. Comment continuer ?"
- Deux cartes côte à côte :
  - **+1 projet** — "Un crédit projet, sans engagement." — bouton "Acheter →" → `/account`
  - **Projets illimités** — "Abonnement — projets, cloud, tous appareils." — bouton "S'abonner →" → `/account` (badge "RECOMMANDÉ")
- Lien "Continuer avec le plan gratuit" conservé
- Plus aucune mention de prix

### `src/app/account/page.tsx`

**Avant :** un seul bloc "Passez Pro — 9 €/mois" avec "Paiement disponible prochainement".

**Après :** deux blocs côte à côte dans la section "Plan actuel" (visible uniquement pour les utilisateurs Free) :
- **+1 projet** — description + "Disponible prochainement"
- **Projets illimités** — description + "Disponible prochainement" (bordure verte)
- Note de bas de section : "Contactez-nous pour un accès anticipé."

### `src/app/dashboard/page.tsx`

**Avant :** bannière "Passez Pro pour des projets illimités — 9 €/mois"

**Après :** "Passez à la formule supérieure pour des projets illimités" (prix supprimé, logique et comportement inchangés)

### `src/components/home/UpgradeModal.test.tsx`

Tests mis à jour pour refléter les nouveaux libellés (suppression "9 €/mois", vérification des deux options).

## Hors périmètre

- Intégration Stripe ou paiement en ligne
- Modification du store, du schéma DB, ou de la logique de limite de projet
- Page de paiement dédiée
- Envoi d'email ou formulaire de contact
