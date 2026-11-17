# Plan d'intégration du paywall — CaléPlan

> Rédigé le 17/11/2026 à partir de l'état de `main` (commit `fb1d55c`).
> Fait suite à `specs/2026-05-18-saas-migration-design.md` (modèle freemium, Stripe prévu en V2)
> et `specs/2026-06-22-pricing-two-options-design.md` (deux offres « +1 projet » et « illimité », sans prix).

## 1. Résumé

Objectif : permettre aux utilisateurs de **payer réellement** pour dépasser la limite gratuite, avec des droits
**vérifiés côté serveur**, un parcours d'achat fluide sur smartphone et une gestion d'abonnement autonome.

Recommandation :

- **Stripe** (Checkout hébergé + Customer Portal + webhooks) — aucune donnée de carte ne transite par l'app.
- **Droits calculés en base (Supabase)** à partir des événements Stripe, et **appliqués par la base** (RLS + fonctions),
  plus seulement par l'interface.
- **Trois niveaux** : Gratuit (1 projet), crédit « +1 projet » (achat unique), **Pro** (abonnement mensuel,
  projets illimités). L'offre Équipe reste hors périmètre.
- Livraison en **6 lots** ; le **lot 0 (sécurité) est à faire immédiatement**, indépendamment du paywall.

Charge estimée : **8 à 11 jours** de développement + 1 à 2 jours de mise en place administrative (Stripe, CGV, TVA).

## 2. État des lieux

### Ce qui existe

| Élément                                           | Où                                                            | État                                                |
| ------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Colonne `profiles.plan` (`free` / `pro`)          | `supabase/migrations/001`                                     | Utilisée partout pour l'affichage et la limite      |
| Colonne `profiles.project_credits`                | idem                                                          | **Jamais utilisée**                                 |
| Colonne `profiles.stripe_customer_id`             | idem                                                          | **Jamais utilisée**                                 |
| Limite « 1 projet en gratuit »                    | `src/app/dashboard/page.tsx` (`handleNewProject`)             | **Uniquement dans l'interface**                     |
| Modale « Limite atteinte » (+1 projet / Illimité) | `src/components/home/UpgradeModal.tsx`                        | Boutons → `/account`, aucun achat possible          |
| Page compte                                       | `src/app/account/page.tsx`                                    | Offres « Disponible prochainement »                 |
| Page d'accueil, section Tarifs                    | `src/app/page.tsx` (`#tarifs`)                                | Affiche **Gratuit 0 € / Pro 9 €**                   |
| Lecture du plan                                   | `uiStore.ts` (`profiles.select('plan')`) et `db.getProfile()` | Deux chemins différents pour la même info           |
| Clé `SUPABASE_SERVICE_ROLE_KEY`                   | `.env.local.example`                                          | Prévue mais aucune route serveur ne l'utilise       |
| Routes API                                        | —                                                             | **Aucune** (seulement `app/auth/callback/route.ts`) |

### Problèmes à corriger avant (ou avec) le paywall

1. **Faille critique — n'importe quel utilisateur peut se passer Pro.**
   La politique RLS `profiles_update_own` autorise un utilisateur à modifier **toutes** les colonnes de sa ligne
   `profiles`, y compris `plan` et `project_credits`. Une simple requête depuis la console du navigateur
   (`supabase.from('profiles').update({ plan: 'pro' })`) suffit. Tant que c'est possible, un paywall ne protège rien.
2. **Limite contournable.** La politique `projects_insert_own` n'impose aucune limite : la règle « 1 projet »
   n'existe que dans le bouton du tableau de bord.
3. **Projets partagés comptés dans la limite.** `projects.length` inclut les projets **partagés avec** l'utilisateur
   (`db.getAll` renvoie propres + partagés). Un utilisateur gratuit invité sur un projet ne peut plus créer le sien.
4. **À vérifier — propriétaire réécrit à la sauvegarde.** `db.save()` fait un `upsert` avec `user_id: user.id`.
   Pour un éditeur invité, la mise à jour pourrait transférer la propriété du projet à l'éditeur. Comme le paywall
   compte les projets par propriétaire, ce point doit être vérifié (test sur un projet partagé) et corrigé.
5. **Messages incohérents.** La page d'accueil annonce « Pro 9 € », l'application dit « Disponible prochainement »,
   l'en-tête du projet connaît un plan « Équipe » (`planLabel` dans `project/[id]/page.tsx`) qui n'existe pas en base.

## 3. Offre recommandée

### Grille

|                                       | **Gratuit**                               | **+1 projet** (achat unique)         | **Pro** (abonnement)                         |
| ------------------------------------- | ----------------------------------------- | ------------------------------------ | -------------------------------------------- |
| Projets actifs                        | 1                                         | +1 par crédit, sans expiration       | Illimités                                    |
| Plan 2D, calepinage, quantitatif      | ✅                                        | ✅                                   | ✅                                           |
| Export PDF du quantitatif             | ✅ avec mention « Réalisé avec CaléPlan » | ✅ sans mention sur le projet acheté | ✅ sans mention                              |
| Partage de projet (lecture / édition) | Recevoir uniquement                       | Recevoir uniquement                  | ✅ Partager                                  |
| Prix (validés le 17/11/2026)          | 0 €                                       | **1,99 € TTC** par projet            | **6,90 € TTC / mois** (pas d'offre annuelle) |

Les prix sont configurés dans Stripe, pas dans le code (sauf l'affichage sur la page d'accueil et le paywall).

### Principes

- **Le gratuit reste vraiment utile** : un projet complet, sans fonctionnalité bridée — c'est le meilleur argument de vente.
- **Ne jamais bloquer l'accès aux données** : un utilisateur qui arrête de payer garde ses projets en **lecture seule**
  (consulter, exporter) ; il ne peut plus en créer ni modifier ceux au-delà de sa limite.
- **Pas d'essai gratuit** pour Pro (décision du 17/11/2026) : le projet gratuit sert de découverte.

### Points de déclenchement du paywall

| Moment                                       | Comportement                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| « Nouveau projet » au-delà de la limite      | Modale paywall (existante, à brancher)                                      |
| « Dupliquer un projet » au-delà de la limite | Même modale                                                                 |
| Partager un projet en gratuit                | Modale « Le partage est inclus dans Pro »                                   |
| Export PDF en gratuit                        | Export autorisé avec mention + lien discret « Retirer la mention avec Pro » |
| Abonnement expiré / impayé                   | Bandeau sur le tableau de bord + projets excédentaires en lecture seule     |

## 4. Architecture technique

### Vue d'ensemble

```
Navigateur ──(1) POST /api/billing/checkout──▶ Next.js (route serveur)
                                                 │ crée/réutilise le client Stripe
                                                 │ crée une Checkout Session
           ◀──(2) URL Stripe Checkout────────────┘
Navigateur ──(3) paie sur la page Stripe (carte, Apple Pay, Google Pay, 3DS)
Stripe     ──(4) webhook /api/stripe/webhook──▶ Next.js (signature vérifiée)
                                                 │ clé service_role
                                                 ▼
                                             Supabase : subscriptions / credit_ledger / profiles
Navigateur ◀──(5) redirection /account?checkout=success → relit ses droits
```

La **source de vérité est le webhook**, jamais la redirection de retour (l'utilisateur peut fermer l'onglet).

### Base de données — migration `003_billing.sql`

```sql
-- 1. Verrouiller les colonnes sensibles de profiles (corrige la faille §2.1)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;
CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Abonnements (miroir de Stripe, écrit uniquement par le webhook)
CREATE TABLE public.subscriptions (
  id                    text PRIMARY KEY,               -- sub_...
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                text NOT NULL,                  -- trialing | active | past_due | canceled | ...
  price_id              text NOT NULL,
  current_period_end    timestamptz NOT NULL,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 3. Registre des crédits projet (achats + consommations), jamais modifié, seulement complété
CREATE TABLE public.credit_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta       int  NOT NULL,                            -- +1 achat, -1 consommation, +1 remboursement
  reason      text NOT NULL,                            -- purchase | project_created | refund | admin
  stripe_ref  text UNIQUE,                              -- payment_intent : évite les doublons
  project_id  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Idempotence des webhooks
CREATE TABLE public.stripe_events (
  id           text PRIMARY KEY,                        -- evt_...
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- RLS : lecture de ses propres lignes, aucune écriture côté client
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select_own"   ON public.subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ledger_select_own" ON public.credit_ledger FOR SELECT USING (user_id = auth.uid());

-- 5. Droits calculés en un seul endroit
CREATE OR REPLACE FUNCTION public.entitlements(uid uuid)
RETURNS TABLE (is_pro boolean, project_limit int, owned_projects int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM subscriptions s
            WHERE s.user_id = uid
              AND (s.status IN ('active','trialing')
                   OR (s.status = 'past_due' AND s.current_period_end > now() - interval '7 days'))),
    1 + COALESCE((SELECT SUM(delta) FILTER (WHERE delta > 0) FROM credit_ledger WHERE user_id = uid), 0),
    (SELECT count(*)::int FROM projects WHERE user_id = uid);
$$;

-- 6. La base refuse elle-même la création au-delà de la limite (corrige §2.2)
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
CREATE POLICY "projects_insert_within_limit" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (SELECT e.is_pro OR e.owned_projects < e.project_limit FROM entitlements(auth.uid()) e)
  );
```

Notes :

- `profiles.plan` devient une **valeur dérivée** (mise à jour par le webhook pour la compatibilité de l'interface
  existante) ; la décision réelle passe par `entitlements()`.
- `profiles.project_credits` est remplacé par `credit_ledger` (traçable, remboursable, sans double comptage).
- Seuls les projets **possédés** (`user_id`) comptent, ce qui corrige §2.3.
- La correction de `db.save()` (§2.4) — ne jamais écrire `user_id` lors d'une mise à jour — fait partie du lot 1.
- Les projets au-delà de la limite après une résiliation restent lisibles ; le blocage de modification passe par la
  politique `projects_update_member` (à étendre avec la même fonction) et par l'interface (bandeau + lecture seule).

### Routes serveur (Next.js, `src/app/api/...`)

| Route                                       | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/billing/checkout`                | Reçoit `{ offer: 'credit' \| 'pro_monthly' }`, vérifie la session Supabase, crée / réutilise le `customer` Stripe (stocké dans `profiles.stripe_customer_id`), crée la Checkout Session (`mode: payment` ou `subscription`, `client_reference_id = user.id`, TVA automatique, codes promo autorisés) et renvoie l'URL. **Les `price_id` sont choisis côté serveur** à partir de l'offre, jamais envoyés par le client.                                     |
| `POST /api/billing/portal`                  | Crée une session Customer Portal Stripe (changer de carte, résilier, télécharger les factures).                                                                                                                                                                                                                                                                                                                                                            |
| `POST /api/stripe/webhook`                  | Vérifie la signature (`STRIPE_WEBHOOK_SECRET`), ignore les événements déjà traités (`stripe_events`), puis : `checkout.session.completed` (crédit → ligne `+1` dans le registre ; abonnement → lien client), `customer.subscription.created/updated/deleted` (miroir dans `subscriptions` + mise à jour de `profiles.plan`), `invoice.payment_failed` (statut `past_due`), `charge.refunded` (crédit retiré si non consommé). Runtime Node.js, corps brut. |
| `GET /api/billing/entitlements` (optionnel) | Renvoie `entitlements()` pour l'interface ; sinon un appel RPC Supabase direct suffit.                                                                                                                                                                                                                                                                                                                                                                     |

Le middleware doit **exclure `/api/stripe/webhook`** de la vérification de session (Stripe n'a pas de cookie).

### Variables d'environnement (Vercel, Production et Preview séparés)

| Variable                                          | Usage                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                               | Clé secrète (test en Preview, live en Production)                                  |
| `STRIPE_WEBHOOK_SECRET`                           | Secret de signature du webhook                                                     |
| `STRIPE_PRICE_CREDIT`, `STRIPE_PRICE_PRO_MONTHLY` | Identifiants des prix                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`                       | Écriture des droits par le webhook (**serveur uniquement**, jamais `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_SITE_URL`                            | URLs de retour Checkout                                                            |

Dépendance à ajouter : `stripe` (SDK Node officiel). Aucune bibliothèque côté navigateur n'est nécessaire avec
Checkout hébergé.

### Côté application

- **Un seul hook `useEntitlements()`** (remplace les lectures de `user.plan` dispersées dans `uiStore`, `db.getProfile`,
  le tableau de bord, la page compte et la page projet). Il expose `isPro`, `projectLimit`, `ownedProjects`,
  `canCreateProject`, `canShare`, `isOverLimit`, et se rafraîchit après un retour de paiement.
- **Gestion de l'erreur base** : si l'insertion d'un projet est refusée par la RLS (limite), afficher la modale paywall
  au lieu du message brut (même logique que pour `NOT_AUTHENTICATED`).
- **`UpgradeModal` → `PaywallSheet`** : panneau du bas sur mobile, modale centrée sur ordinateur, réutilisant le style du
  panneau Carreau ; prix lus depuis la configuration (pas codés en dur).

## 5. Parcours utilisateur (mobile d'abord)

1. **Atteinte de la limite** → panneau paywall : « Votre projet gratuit est utilisé » ; deux cartes (Pro mis en avant
   6,90 € / mois, +1 projet à 1,99 €) ; lien « Continuer en gratuit ».
2. **Choix d'une offre** → bouton désactivé + indicateur de chargement → redirection vers Stripe Checkout
   (Apple Pay / Google Pay proposés automatiquement sur mobile).
3. **Retour `/account?checkout=success`** → écran « Merci ! » qui **attend la confirmation du webhook** (relecture des droits
   toutes les 2 s pendant 20 s max) puis renvoie vers l'action interrompue (ex. ouvre la fenêtre « Nouveau projet »).
   Si le délai expire : message « Paiement reçu, activation en cours » + bouton rafraîchir.
4. **Retour `?checkout=cancel`** → retour au tableau de bord sans message culpabilisant.
5. **Page Compte** :
   - Gratuit : forfait actuel, projets utilisés « 1 / 1 », crédits restants, offres avec prix ;
   - Pro : statut, prochaine échéance ou date de fin si résilié, bouton « Gérer mon abonnement » (Customer Portal),
     factures.
6. **Paiement échoué** (`past_due`) → bandeau « Mettez à jour votre moyen de paiement » + 7 jours de grâce, puis retour
   en gratuit (projets excédentaires en lecture seule, jamais supprimés).
7. **Page d'accueil `#tarifs`** → reprend exactement la même grille et les mêmes prix que l'application.

## 6. Juridique, fiscal, conformité (France)

- **Compte Stripe** au nom de l'entité qui facture (SIREN, IBAN, justificatifs) — à créer par toi, je ne peux pas le faire.
- **TVA** : activer **Stripe Tax** (TVA française 20 %, et TVA du pays du client pour les particuliers de l'UE) ;
  afficher des prix **TTC** pour les particuliers ; collecter le **numéro de TVA intracommunautaire** des entreprises
  (Checkout le propose).
- **Factures** : générées automatiquement par Stripe (numérotation, mentions obligatoires à compléter dans le tableau de
  bord Stripe : raison sociale, adresse, SIREN, TVA).
- **CGV / CGU** : pages `/cgv` et `/mentions-legales` à créer, case à cocher d'acceptation dans Checkout
  (`consent_collection.terms_of_service`).
- **Droit de rétractation (particuliers)** : pour un contenu numérique fourni immédiatement, demander la renonciation
  expresse au moment du paiement (mention dans Checkout + CGV).
- **Résiliation en 3 clics** (obligation légale depuis 2023) : couverte par le Customer Portal.
- **SCA / 3-D Secure** : géré par Checkout.
- **RGPD** : mettre à jour la politique de confidentialité (Stripe comme sous-traitant, données de facturation).

## 7. Tests et recette

- **Unitaires (Vitest)** : calcul des droits côté interface, mapping offre → `price_id`, traitement de chaque type de
  webhook (avec événements Stripe enregistrés en fixtures), idempotence (même événement reçu deux fois).
- **Base (SQL)** : script de test RLS — un utilisateur gratuit ne peut ni insérer un 2e projet, ni modifier `plan` /
  `project_credits`, ni lire les abonnements d'un autre.
- **Bout en bout** : Playwright est déjà dans les dépendances mais non configuré — scénario « gratuit → paywall →
  Checkout test → retour → création du 2e projet » en mode test Stripe.
- **Recette manuelle en Preview Vercel** avec les **cartes de test Stripe** (succès, refus, 3-D Secure), la commande
  `stripe listen` pour les webhooks en local, et une recette sur **vrai téléphone** (iOS Safari + Android Chrome).
- **Avant la mise en production** : passer les clés en mode live, créer le webhook live, faire un **vrai achat de
  1,99 € puis le rembourser**.

## 8. Découpage en lots

| Lot                       | Contenu                                                                                                                                                                                 | Dépend de | Charge          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------- |
| **0 — Sécurité (urgent)** | Retirer l'écriture de `plan` / `project_credits` par le client ; limite de projets appliquée par la RLS (comptage des seuls projets possédés) ; vérifier et corriger `db.save()` (§2.4) | —         | 0,5–1 j         |
| **1 — Droits**            | Migration `003_billing.sql`, fonction `entitlements()`, hook `useEntitlements()`, remplacement des lectures de `user.plan`, gestion de l'erreur « limite »                              | 0         | 1,5–2 j         |
| **2 — Stripe**            | SDK, routes `checkout` / `portal` / `webhook`, idempotence, variables Vercel, produits et prix en mode test                                                                             | 1         | 2–3 j           |
| **3 — Paywall**           | `PaywallSheet` mobile/ordinateur, déclencheurs (nouveau projet, duplication, partage, mention PDF), écran de retour de paiement                                                         | 2         | 1,5–2 j         |
| **4 — Compte & tarifs**   | Page compte (statut, crédits, portail, factures), bandeau impayé, lecture seule au-delà de la limite, harmonisation de la page d'accueil `#tarifs`                                      | 2         | 1–1,5 j         |
| **5 — Lancement**         | CGV / mentions / confidentialité, Stripe Tax, tests E2E, recette mobile, bascule en live                                                                                                | 3, 4      | 1–1,5 j + admin |

Les lots 3 et 4 peuvent avancer en parallèle une fois le lot 2 terminé. Chaque lot = une PR, testée en préversion Vercel.

**Mesure après lancement** (optionnel, lot 6) : taux d'affichage du paywall → clic → paiement, part crédits / abonnement,
taux de résiliation ; e-mails transactionnels (bienvenue Pro, échec de paiement) via Stripe ou Resend.

## 9. Décisions

Prises le 17/11/2026 :

1. **Prix** : Pro **6,90 € TTC / mois**, crédit « +1 projet » **1,99 € TTC**. Pas d'abonnement annuel
   (`STRIPE_PRICE_PRO_YEARLY` et l'offre `pro_yearly` sont donc retirés du périmètre).
2. **Essai gratuit** : aucun.
3. **Gratuit** : 1 projet complet ; export PDF avec mention « Réalisé avec CaléPlan » ; partage réservé à Pro. ✅
4. **Comptes Pro de la bêta** : conservent Pro (pas d'abonnement Stripe ; `entitlements()` doit continuer à considérer
   `profiles.plan = 'pro'` posé à la main comme Pro, même sans ligne dans `subscriptions`).
5. **Entité de facturation / compte Stripe** : reporté — les lots 2 à 5 (Stripe) attendent cette étape.
6. **Offre Équipe** : hors périmètre pour cette première version.

Le lot 1 (droits en base, sans Stripe) peut avancer sans attendre le point 5.

## 10. Risques

| Risque                                                         | Parade                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Webhook non reçu → client payé sans accès                      | Idempotence + relecture de l'abonnement côté Stripe sur l'écran de retour + bouton « Restaurer mes achats »                                                              |
| Droits divergents entre l'interface et la base                 | Une seule fonction `entitlements()` utilisée partout                                                                                                                     |
| Migration RLS qui bloque des utilisateurs existants            | Script de vérification avant/après sur une copie de la base ; utilisateurs gratuits ayant déjà plus d'un projet : conservés en lecture seule ou crédités (décision §9.4) |
| Clé `service_role` exposée                                     | Utilisée uniquement dans les routes serveur ; jamais préfixée `NEXT_PUBLIC_`                                                                                             |
| Application installée plus tard via les stores (iOS / Android) | Les achats numériques y imposent le paiement in-app (Apple / Google) : à réévaluer si une app native est envisagée ; la PWA web n'est pas concernée                      |
