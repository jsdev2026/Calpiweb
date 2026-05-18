# TILEA — Migration SaaS : Design Document

**Date :** 2026-05-18  
**Statut :** Approuvé  
**Portée :** V1 (beta) + feuille de route V2/V3

---

## 1. Contexte

TILEA est une application web de calepinage carrelage (Next.js 14, TypeScript, Tailwind, Zustand) aujourd'hui 100 % client-side. Les projets sont stockés dans IndexedDB du navigateur. L'objectif est de la transformer en SaaS monétisable.

---

## 2. Décisions produit

### Cible utilisateurs
Modèle **freemium** couvrant deux segments :
- **Artisans indépendants** — sensibles au prix, usage solo
- **PME du carrelage** — plusieurs chantiers, budget pro (adressé en V3)

### Modèle tarifaire

| Plan | Prix | Limite | Stockage |
|------|------|--------|----------|
| Gratuit | 0 € | 1 projet | Cloud Supabase |
| Pro | 9 €/mois | Illimité | Cloud Supabase |
| À la carte (V2) | 2,99 € / projet | — | Cloud Supabase |
| Packages (V2) | ex. 5 projets à 9,99 € | — | Cloud Supabase |

**Note V1 :** Stripe n'est pas intégré en V1. Les premiers comptes Pro sont activés manuellement en beta : mise à jour directe du champ `profiles.plan = 'pro'` via le dashboard Supabase. Stripe est implémenté en V2.

### Contrainte clé
Tous les utilisateurs (y compris gratuits) ont leurs projets stockés dans le cloud Supabase. Un compte est obligatoire pour utiliser l'application. Cela garantit une bonne expérience multi-appareil dès le plan gratuit et simplifie l'architecture (pas de double source de vérité).

---

## 3. Architecture technique

### Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 + React 18 + Tailwind CSS (existant) |
| Hosting | Vercel (auto-deploy depuis GitHub) |
| Auth | Supabase Auth (email + mot de passe) |
| Base de données | Supabase PostgreSQL |
| Paiements | — (V1) · Stripe (V2) |

### Schéma de base de données Supabase

```sql
-- Géré par Supabase Auth
auth.users (
  id uuid PRIMARY KEY,
  email text,
  created_at timestamptz
)

-- Profil applicatif
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan text NOT NULL DEFAULT 'free',   -- 'free' | 'pro'
  project_credits int NOT NULL DEFAULT 0,  -- V2 : crédits à la carte
  stripe_customer_id text,             -- V2
  updated_at timestamptz DEFAULT now()
)

-- Projets
projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  name text NOT NULL,
  data jsonb NOT NULL,                 -- objet Project TypeScript sérialisé
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**Sécurité :** Row Level Security (RLS) activée sur `projects` et `profiles`. Règle : `user_id = auth.uid()` — un utilisateur ne peut accéder qu'à ses propres données.

**Trigger automatique :** à la création d'un `auth.user`, un trigger Supabase crée automatiquement une ligne dans `profiles` avec `plan = 'free'`.

### Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # serveur uniquement, jamais exposé au client
```

---

## 4. Pages et routing

### Pages publiques (sans authentification)

| Route | Description |
|-------|-------------|
| `/` | Landing page marketing |
| `/auth` | Connexion + Inscription + Reset mot de passe |

### Pages protégées (authentification requise)

| Route | Description |
|-------|-------------|
| `/dashboard` | Liste des projets, compteur, upsell |
| `/account` | Plan actuel, gestion abonnement (V2 : historique Stripe) |
| `/project/[id]` | Éditeur plan + calepinage + quantitatif (existant) |

**Protection des routes :** `middleware.ts` Next.js intercepte toutes les routes protégées et redirige vers `/auth` si la session Supabase est absente. À l'inverse, un utilisateur déjà connecté qui visite `/` ou `/auth` est redirigé vers `/dashboard`.

---

## 5. Flux utilisateur

```
Landing (/)
  → CTA "Commencer gratuitement"
  → /auth (inscription)
  → /dashboard (0 projet)
  → "+ Nouveau projet" → /project/[id] (éditeur)
  → Sauvegarde auto : debounce 1s après chaque action store (updateRoom, setConfig, etc.) → upsert Supabase
  → Retour /dashboard (1 projet sur 1)
  → Tentative 2e projet → bannière upsell "Passer Pro"
  → (V2) Checkout Stripe → plan = 'pro' → projets illimités
```

---

## 6. Couche de persistance — ce qui change

### Remplacement de `lib/db.ts`

`lib/db.ts` (IndexedDB) est remplacé par `lib/supabase.ts` qui expose la même interface :

```typescript
// Même contrat que projectsDb existant
supabaseDb.getAll(): Promise<Project[]>
supabaseDb.get(id: string): Promise<Project | undefined>
supabaseDb.save(project: Project): Promise<void>
supabaseDb.delete(id: string): Promise<void>
```

### Modifications dans `store/projectStore.ts`

Seules deux fonctions changent d'implémentation :
- `hydrate()` — lit depuis Supabase au lieu d'IndexedDB
- Les actions `create()`, `remove()`, `updateRoom()`, etc. — appellent `supabaseDb.save()` au lieu de `projectsDb.save()`

### Limite de projets

Dans `create()`, avant de créer un projet :
```typescript
if (profile.plan === 'free' && projects.length >= 1) {
  throw new Error('PROJECT_LIMIT_REACHED')
}
```
L'interface affiche alors la bannière upsell.

---

## 7. Ce qui ne change pas

- Tout `src/engine/` — moteur de calepinage, géométrie, quantités
- Tous les composants `plan/`, `tiling/`, `quantities/`, `results/`
- L'interface du store Zustand (même actions, même état)
- Les types TypeScript (`Project`, `Room`, `TilingConfig`, etc.)
- Les tests unitaires existants
- Le routing `/project/[id]`

---

## 8. Landing page — contenu

### Hero
- Titre : "Le calepinage carrelage pour les professionnels"
- Sous-titre : "Dessinez, simulez, quantifiez. En quelques minutes."
- CTA primaire : "Commencer gratuitement" → `/auth`
- CTA secondaire : "Voir la démo" → scroll vers capture d'écran

### Arguments produit (3 blocs)
1. Plan 2D — Dessinez vos pièces avec contraintes dimensionnelles
2. Calepinage — 3 modes : droit, bâton rompu, pointe de hongrie
3. Quantitatif — Commande optimisée avec gestion des chutes

### Grille tarifaire
| | Gratuit | Pro |
|--|---------|-----|
| Prix | 0 € | 9 €/mois |
| Projets | 1 | Illimité |
| Stockage cloud | ✓ | ✓ |
| Toutes les fonctions | ✓ | ✓ |

### Footer
Liens : Mentions légales · Politique de confidentialité · Contact

---

## 9. Pipeline de déploiement

```
Dev local (next dev + Supabase local ou projet dev)
  → git push → GitHub (branche main)
  → Vercel auto-deploy
  → tilea.fr (domaine custom configuré dans Vercel)
```

**Environnements Vercel :**
- `main` → production (`tilea.fr`)
- Pull Requests → preview URLs automatiques (pour tester avant merge)

---

## 10. Feuille de route

### V1 — Beta (3-4 semaines)
- [ ] Créer projet Supabase (auth + tables + RLS)
- [ ] `lib/supabase.ts` — client et opérations CRUD
- [ ] Modifier `projectStore.ts` — hydrate/save via Supabase
- [ ] `middleware.ts` — protection routes
- [ ] `app/auth/page.tsx` — compléter avec Supabase Auth
- [ ] `app/dashboard/page.tsx` — liste projets + upsell
- [ ] `app/account/page.tsx` — plan actuel (statique en V1)
- [ ] `app/page.tsx` — landing page marketing
- [ ] Supprimer `lib/db.ts` (IndexedDB)
- [ ] Déploiement Vercel + domaine

### V2 — Monétisation (4-6 semaines après beta)
- [ ] Stripe — abonnement Pro 9 €/mois
- [ ] Stripe — achat unitaire projet 2,99 €
- [ ] Stripe — packages (5 projets, 20 projets)
- [ ] Webhooks Stripe (activation plan en base)
- [ ] Dashboard facturation / historique achats
- [ ] Export PDF marque blanche

### V3 — Croissance (selon traction)
- [ ] Plan Équipe (multi-utilisateurs, espaces partagés)
- [ ] Partage client (lien lecture seule)
- [ ] Bibliothèque de carreaux (catalogue)
- [ ] Devis client généré automatiquement
- [ ] API intégration négoces / fournisseurs

---

*Document validé le 2026-05-18 lors de la session de brainstorming.*
