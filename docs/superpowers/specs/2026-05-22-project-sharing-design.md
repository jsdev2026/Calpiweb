# Project Sharing — Design Spec

## Goal

Permettre à un utilisateur de partager ses projets avec des collaborateurs identifiés par email. Deux rôles distincts (lecteur / éditeur), verrouillage optimiste pour éviter les conflits d'édition simultanée, découverte via badge de notification et section dédiée dans la liste de projets.

**Périmètre de ce spec :** partage de projets unitaires uniquement. Les portefeuilles de projets feront l'objet d'un spec séparé.

---

## Contraintes & décisions clés

| Sujet | Décision |
|-------|----------|
| Rôles | `viewer` (lecture seule) et `editor` (modification), choix à l'invitation |
| Invitation | Email uniquement — l'adresse doit correspondre à un compte existant ; sinon erreur explicite |
| Conflits d'édition | Verrouillage pessimiste : un seul éditeur actif à la fois, les autres passent en lecture seule |
| Découverte | Badge de notification non vu + section "Partagés avec moi" dans la liste des projets |
| Emails transactionnels | Aucun — pas d'envoi d'email d'invitation |

---

## Architecture

Supabase PostgreSQL avec RLS. Trois nouvelles tables complètent le modèle existant (`projects`, `profiles`). La logique de permission reste côté base via RLS — aucune vérification de rôle dans le code applicatif au-delà de l'affichage conditionnel de l'UI.

---

## 1. Modèle de données

### Table `project_shares`

```sql
CREATE TABLE project_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
```

Un collaborateur ne peut être invité qu'une fois par projet. La contrainte unique empêche les doublons.

### Table `project_locks`

```sql
CREATE TABLE project_locks (
  project_id  uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  locked_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 minutes'
);
```

Un seul verrou par projet. Expiry de 30 minutes : si l'éditeur ferme l'onglet sans libérer explicitement, le verrou tombe automatiquement. Un intervalle de rafraîchissement côté client prolonge `expires_at` toutes les 10 minutes tant que la session est active.

### Table `project_notifications`

```sql
CREATE TABLE project_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('share_added', 'share_removed')),
  seen        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Alimente le badge et la section "Partagés avec moi". Une notification est créée à chaque invitation et révocation.

---

## 2. Row Level Security

### `projects` — SELECT étendu

```sql
-- Remplace la politique existante projects_select_own
CREATE POLICY projects_select_member ON projects
  FOR SELECT USING (
    user_id = auth.uid()
    OR id IN (
      SELECT project_id FROM project_shares WHERE user_id = auth.uid()
    )
  );
```

### `projects` — UPDATE restreint aux éditeurs actifs

```sql
CREATE POLICY projects_update_editor ON projects
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (
      id IN (
        SELECT project_id FROM project_shares
        WHERE user_id = auth.uid() AND role = 'editor'
      )
      AND id IN (
        SELECT project_id FROM project_locks
        WHERE locked_by = auth.uid() AND expires_at > now()
      )
    )
  );
```

### `project_shares`

```sql
-- Lecture : owner du projet + collaborateur concerné
CREATE POLICY shares_select ON project_shares
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Écriture : owner uniquement
CREATE POLICY shares_insert ON project_shares
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY shares_delete ON project_shares
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );
```

### `project_locks`

```sql
-- Lecture : membres du projet (owner + collaborateurs)
CREATE POLICY locks_select ON project_locks
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM project_shares WHERE user_id = auth.uid()
    )
  );

-- Insertion/mise à jour : uniquement si aucun verrou actif ou verrou expiré
CREATE POLICY locks_upsert ON project_locks
  FOR INSERT WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM project_locks pl
      WHERE pl.project_id = project_id
        AND pl.locked_by != auth.uid()
        AND pl.expires_at > now()
    )
  );

-- Mise à jour (refresh) : uniquement le détenteur du verrou
CREATE POLICY locks_update ON project_locks
  FOR UPDATE USING (locked_by = auth.uid());

-- Suppression : uniquement le détenteur du verrou
CREATE POLICY locks_delete ON project_locks
  FOR DELETE USING (locked_by = auth.uid());
```

### `project_notifications`

```sql
CREATE POLICY notifications_select ON project_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_update ON project_notifications
  FOR UPDATE USING (user_id = auth.uid());
```

---

## 3. Types TypeScript

```ts
export type ShareRole = 'viewer' | 'editor';
export type MyRole = 'owner' | ShareRole;

export interface ProjectShare {
  id: string;
  projectId: string;
  userId: string;
  userEmail: string;   // jointure avec profiles au chargement
  userDisplayName: string;
  role: ShareRole;
  createdAt: string;
}

export interface ProjectLock {
  projectId: string;
  lockedBy: string;
  lockedByDisplayName: string;
  expiresAt: string;
}

export interface ProjectNotification {
  id: string;
  projectId: string;
  projectName: string;
  type: 'share_added' | 'share_removed';
  seen: boolean;
  createdAt: string;
}
```

Le type `Project` existant reçoit deux champs supplémentaires (non persistés en base, calculés au chargement) :

```ts
myRole: MyRole;
lock: ProjectLock | null;
```

---

## 4. Store Zustand — nouvelles opérations

### Chargement

`loadProjects()` — requête unique exploitant la RLS étendue. Calcule `myRole` pour chaque projet (`owner` si `user_id === auth.uid()`, sinon rôle dans `project_shares`). Charge également le verrou actif pour chaque projet.

`loadNotifications()` — charge les `project_notifications` de l'utilisateur. Appelé au montage de la liste des projets.

### Partage

```ts
shareProject(projectId: string, email: string, role: ShareRole): Promise<void>
```
1. Recherche l'utilisateur par email dans `profiles` — erreur `USER_NOT_FOUND` si absent.
2. Vérifie qu'il n'est pas déjà collaborateur — erreur `ALREADY_SHARED` si présent.
3. Insère dans `project_shares`.
4. Insère une `project_notification` de type `share_added` pour le destinataire.

```ts
unshareProject(projectId: string, userId: string): Promise<void>
```
1. Supprime la ligne dans `project_shares`.
2. Insère une `project_notification` de type `share_removed` pour l'utilisateur révoqué.
3. Si l'utilisateur détenait le verrou, supprime le verrou.

### Verrouillage

```ts
acquireLock(projectId: string): Promise<'acquired' | 'locked_by_other'>
```
Tente un upsert dans `project_locks`. Retourne `locked_by_other` si un verrou actif d'un autre utilisateur existe.

```ts
releaseLock(projectId: string): Promise<void>
```
Supprime le verrou si `locked_by = auth.uid()`. Appelé au démontage du composant projet et sur l'événement `beforeunload`.

```ts
refreshLock(projectId: string): Promise<void>
```
Met à jour `expires_at = now() + 30min`. Appelé par un `setInterval` de 10 minutes dans le composant projet, uniquement si `myRole === 'editor'` et verrou détenu.

### Notifications

```ts
markNotificationsSeen(): Promise<void>
```
`UPDATE project_notifications SET seen = true WHERE user_id = auth.uid() AND seen = false`.

---

## 5. Interface utilisateur

### Badge de notification

Dans le header ou menu utilisateur existant : indicateur numérique rouge affichant le compte des `project_notifications` avec `seen = false`. Disparaît (mis à jour) dès l'ouverture de la liste des projets via `markNotificationsSeen()`.

### Liste des projets — section "Partagés avec moi"

La liste existante est divisée en deux groupes par un séparateur visuel :
- **Mes projets** — projets dont `myRole === 'owner'`
- **Partagés avec moi** — projets dont `myRole === 'viewer' | 'editor'`

Chaque entrée partagée affiche : nom du projet, nom de l'owner, badge de rôle (`Lecteur` / `Éditeur`).

État zéro explicite si la section est vide : "Aucun projet partagé avec vous."

### Panneau de partage

Accessible depuis un projet ouvert, réservé à l'owner (`myRole === 'owner'`). Implémenté comme un drawer ou panneau latéral dans l'UI existante — pas de modale.

Contenu :
- Champ email + sélecteur de rôle (`Lecteur` / `Éditeur`) + bouton "Inviter"
- Feedback immédiat : "Aucun compte trouvé" si `USER_NOT_FOUND`, "Déjà collaborateur" si `ALREADY_SHARED`
- Liste des collaborateurs actuels : nom, email, rôle, bouton de révocation (avec confirmation)

### État verrouillé

Quand `myRole === 'editor'` ou `myRole === 'viewer'` et qu'un verrou actif d'un autre utilisateur existe :

- Bandeau persistant en haut du projet : "Édition en cours par [prénom]. Vous êtes en lecture seule."
- Toutes les interactions de modification désactivées visuellement (curseur interdit, opacité réduite) — pas masquées.
- Réévaluation du verrou toutes les 60 secondes côté client. Si le verrou a expiré ou été libéré, le bandeau disparaît et l'édition se débloque.

Quand `myRole === 'editor'` et que le verrou est libre : `acquireLock` est appelé automatiquement à l'ouverture du projet.

---

## 6. Tests

### Unit — store

- `shareProject` avec email inconnu → erreur `USER_NOT_FOUND`
- `shareProject` avec email déjà collaborateur → erreur `ALREADY_SHARED`
- `shareProject` valide → insère dans `project_shares` + crée notification
- `acquireLock` quand verrou libre → retourne `acquired`
- `acquireLock` quand verrou actif d'un autre → retourne `locked_by_other`
- `releaseLock` par le détenteur → supprime le verrou
- `releaseLock` par un non-détenteur → sans effet

### Integration — RLS

- Owner peut lire et modifier son projet
- Éditeur avec verrou peut modifier
- Éditeur sans verrou ne peut pas modifier (RLS bloque)
- Viewer ne peut jamais modifier (même avec verrou hypothétique)
- Utilisateur sans accès ne voit pas le projet

### Composant — panneau de partage

- Affichage conditionnel (visible owner, caché viewer/editor)
- Feedback erreur `USER_NOT_FOUND`
- Liste collaborateurs + révocation
- Bandeau lecture seule quand `lock.lockedBy !== currentUserId`
