# Project Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre le partage de projets entre utilisateurs enregistrés par email, avec rôles viewer/editor, verrouillage pessimiste, et découverte via badge + section dédiée.

**Architecture:** Trois nouvelles tables Supabase (`project_shares`, `project_locks`, `project_notifications`) avec RLS. Une bibliothèque `sharingDb` dans `src/lib/supabase/sharing.ts` expose toutes les opérations. Un `sharingStore` Zustand orchestre l'état client. Deux nouveaux composants UI (`SharePanel`, `LockBanner`) complètent la liste des projets et la page workspace.

**Tech Stack:** Next.js 14, React 18, TypeScript, Zustand, Supabase (PostgreSQL + RLS), Tailwind CSS, Vitest + @testing-library/react

---

## Fichiers touchés

| Action | Fichier | Rôle |
|--------|---------|------|
| Create | `supabase/migrations/002_project_sharing.sql` | 3 tables + RLS policies + profils enrichis |
| Create | `src/types/sharing.ts` | Types ShareRole, ProjectShare, ProjectLock, ProjectNotification |
| Modify | `src/types/project.ts` | Ajouter `myRole?` et `lock?` à Project |
| Create | `src/lib/supabase/sharing.ts` | Toutes les opérations Supabase du partage |
| Create | `src/lib/supabase/sharing.test.ts` | Tests unitaires de sharingDb |
| Modify | `src/lib/supabase/db.ts` | Étendre `getAll()` pour shared projects + myRole + lock |
| Modify | `src/lib/supabase/db.test.ts` | Tests du getAll étendu |
| Create | `src/store/sharingStore.ts` | Zustand store : shares, notifications, locks |
| Create | `src/store/sharingStore.test.ts` | Tests unitaires du store |
| Modify | `src/components/home/ProjectList.tsx` | Split "Mes projets" / "Partagés avec moi" + badge |
| Create | `src/components/home/SharePanel.tsx` | Drawer de gestion des collaborateurs |
| Create | `src/components/home/SharePanel.test.tsx` | Tests composant SharePanel |
| Modify | `src/app/project/[id]/page.tsx` | Intégrer LockBanner + acquireLock/releaseLock |

---

## Task 1 : Types & migration SQL

**Files:**
- Create: `src/types/sharing.ts`
- Modify: `src/types/project.ts`
- Create: `supabase/migrations/002_project_sharing.sql`

- [ ] **Step 1 : Créer `src/types/sharing.ts`**

```ts
export type ShareRole = 'viewer' | 'editor';
export type MyRole = 'owner' | ShareRole;

export interface ProjectShare {
  id: string;
  projectId: string;
  userId: string;
  userEmail: string;
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

- [ ] **Step 2 : Modifier `src/types/project.ts` — ajouter les champs calculés à Project**

Ajouter à la fin de l'interface `Project` (après `tilingDimensions?`):

```ts
  myRole?: MyRole;
  lock?: ProjectLock | null;
```

Et ajouter l'import en haut du fichier :

```ts
import type { MyRole, ProjectLock } from './sharing';
```

- [ ] **Step 3 : Créer la migration SQL `supabase/migrations/002_project_sharing.sql`**

```sql
-- ============================================================
-- CaléPlan — Project Sharing Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Enrich profiles with email and display_name (needed for invitations)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Update trigger to populate email and display_name on new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = EXCLUDED.display_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. project_shares table
CREATE TABLE IF NOT EXISTS public.project_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- Owner can read/insert/delete shares for their projects
CREATE POLICY "shares_select" ON public.project_shares
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "shares_insert" ON public.project_shares
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "shares_delete" ON public.project_shares
  FOR DELETE USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- 3. project_locks table
CREATE TABLE IF NOT EXISTS public.project_locks (
  project_id  uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  locked_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

ALTER TABLE public.project_locks ENABLE ROW LEVEL SECURITY;

-- Members of a project (owner + collaborators) can read locks
CREATE POLICY "locks_select" ON public.project_locks
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM public.project_shares WHERE user_id = auth.uid()
    )
  );

-- Only the lock holder can insert/update/delete their lock
CREATE POLICY "locks_insert" ON public.project_locks
  FOR INSERT WITH CHECK (locked_by = auth.uid());

CREATE POLICY "locks_update" ON public.project_locks
  FOR UPDATE USING (locked_by = auth.uid());

CREATE POLICY "locks_delete" ON public.project_locks
  FOR DELETE USING (locked_by = auth.uid());

-- 4. project_notifications table
CREATE TABLE IF NOT EXISTS public.project_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('share_added', 'share_removed')),
  seen        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.project_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.project_notifications
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

CREATE POLICY "notifications_update" ON public.project_notifications
  FOR UPDATE USING (user_id = auth.uid());

-- 5. Extend projects SELECT to include shared projects
DROP POLICY IF EXISTS "projects_select_own" ON public.projects;
CREATE POLICY "projects_select_member" ON public.projects
  FOR SELECT USING (
    user_id = auth.uid()
    OR id IN (
      SELECT project_id FROM public.project_shares WHERE user_id = auth.uid()
    )
  );

-- 6. Allow editors (with active lock) to UPDATE projects
DROP POLICY IF EXISTS "projects_update_own" ON public.projects;
CREATE POLICY "projects_update_member" ON public.projects
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (
      id IN (
        SELECT project_id FROM public.project_shares
        WHERE user_id = auth.uid() AND role = 'editor'
      )
      AND id IN (
        SELECT project_id FROM public.project_locks
        WHERE locked_by = auth.uid() AND expires_at > now()
      )
    )
  );
```

- [ ] **Step 4 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur dans les fichiers types.

- [ ] **Step 5 : Commit**

```bash
git add src/types/sharing.ts src/types/project.ts supabase/migrations/002_project_sharing.sql
git commit -m "feat(sharing): types + SQL migration for project_shares, locks, notifications"
```

---

## Task 2 : Bibliothèque Supabase `sharingDb`

**Files:**
- Create: `src/lib/supabase/sharing.ts`
- Create: `src/lib/supabase/sharing.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent dans `src/lib/supabase/sharing.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGt = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockGetUser = vi.fn();

const mockChain = {
  select: mockSelect,
  eq: mockEq,
  gt: mockGt,
  maybeSingle: mockMaybeSingle,
  insert: mockInsert,
  delete: mockDelete,
  update: mockUpdate,
  upsert: mockUpsert,
  in: mockIn,
  order: mockOrder,
};

Object.values(mockChain).forEach((fn) => {
  (fn as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue(mockChain),
    auth: { getUser: mockGetUser },
  }),
}));

import { sharingDb } from './sharing';

describe('sharingDb.findUserByEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user when found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'user-2', display_name: 'Alice' }, error: null,
    });
    const result = await sharingDb.findUserByEmail('alice@example.com');
    expect(result).toEqual({ id: 'user-2', displayName: 'Alice' });
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await sharingDb.findUserByEmail('unknown@example.com');
    expect(result).toBeNull();
  });
});

describe('sharingDb.addShare', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a share row', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    await sharingDb.addShare('proj-1', 'user-2', 'editor');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'proj-1', user_id: 'user-2', role: 'editor' }),
    );
  });

  it('throws on Supabase error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });
    await expect(sharingDb.addShare('proj-1', 'user-2', 'editor')).rejects.toThrow('[23505]');
  });
});

describe('sharingDb.removeShare', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the share row', async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    await sharingDb.removeShare('proj-1', 'user-2');
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('sharingDb.acquireLock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns acquired when no active lock', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockUpsert.mockResolvedValueOnce({ error: null });
    const result = await sharingDb.acquireLock('proj-1');
    expect(result).toBe('acquired');
  });

  it('returns locked_by_other when another user holds the lock', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { locked_by: 'other-user', expires_at: new Date(Date.now() + 10000).toISOString() },
      error: null,
    });
    const result = await sharingDb.acquireLock('proj-1');
    expect(result).toBe('locked_by_other');
  });
});

describe('sharingDb.markNotificationsSeen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates unseen notifications', async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    await sharingDb.markNotificationsSeen();
    expect(mockUpdate).toHaveBeenCalledWith({ seen: true });
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run src/lib/supabase/sharing.test.ts
```

Expected : FAIL — `sharingDb` n'existe pas encore.

- [ ] **Step 3 : Créer `src/lib/supabase/sharing.ts`**

```ts
import type { ProjectShare, ProjectLock, ProjectNotification, ShareRole } from '@/types/sharing';
import { createClient } from './client';

export const sharingDb = {
  async findUserByEmail(email: string): Promise<{ id: string; displayName: string } | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (!data) return null;
    return { id: data.id as string, displayName: (data.display_name as string | null) ?? email };
  },

  async getShares(projectId: string): Promise<ProjectShare[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('project_shares')
      .select('id, project_id, user_id, role, created_at, profiles(email, display_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return (data ?? []).map((row) => {
      const profile = row.profiles as { email: string; display_name: string | null } | null;
      return {
        id: row.id as string,
        projectId: row.project_id as string,
        userId: row.user_id as string,
        userEmail: profile?.email ?? '',
        userDisplayName: profile?.display_name ?? profile?.email ?? '',
        role: row.role as ShareRole,
        createdAt: row.created_at as string,
      };
    });
  },

  async addShare(projectId: string, userId: string, role: ShareRole): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('project_shares')
      .insert({ project_id: projectId, user_id: userId, role });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async removeShare(projectId: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('project_shares')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async addNotification(
    userId: string,
    projectId: string,
    type: 'share_added' | 'share_removed',
  ): Promise<void> {
    const supabase = createClient();
    await supabase
      .from('project_notifications')
      .insert({ user_id: userId, project_id: projectId, type });
  },

  async acquireLock(projectId: string): Promise<'acquired' | 'locked_by_other'> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');

    const { data: existing } = await supabase
      .from('project_locks')
      .select('locked_by, expires_at')
      .eq('project_id', projectId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existing && (existing.locked_by as string) !== user.id) {
      return 'locked_by_other';
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('project_locks')
      .upsert({
        project_id: projectId,
        locked_by: user.id,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return 'acquired';
  },

  async releaseLock(projectId: string): Promise<void> {
    const supabase = createClient();
    await supabase
      .from('project_locks')
      .delete()
      .eq('project_id', projectId);
  },

  async refreshLock(projectId: string): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase
      .from('project_locks')
      .update({ expires_at: expiresAt })
      .eq('project_id', projectId)
      .eq('locked_by', user.id);
  },

  async getActiveLock(projectId: string): Promise<ProjectLock | null> {
    const supabase = createClient();
    const { data } = await supabase
      .from('project_locks')
      .select('project_id, locked_by, expires_at, profiles(display_name, email)')
      .eq('project_id', projectId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    const profile = data.profiles as { display_name: string | null; email: string } | null;
    return {
      projectId,
      lockedBy: data.locked_by as string,
      lockedByDisplayName: profile?.display_name ?? profile?.email ?? 'Autre utilisateur',
      expiresAt: data.expires_at as string,
    };
  },

  async getNotifications(): Promise<ProjectNotification[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('project_notifications')
      .select('id, project_id, type, seen, created_at, projects(name)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      projectName: (row.projects as { name: string } | null)?.name ?? '',
      type: row.type as 'share_added' | 'share_removed',
      seen: row.seen as boolean,
      createdAt: row.created_at as string,
    }));
  },

  async markNotificationsSeen(): Promise<void> {
    const supabase = createClient();
    await supabase
      .from('project_notifications')
      .update({ seen: true })
      .eq('seen', false);
  },
};
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
npx vitest run src/lib/supabase/sharing.test.ts
```

Expected : 7 passed (7)

- [ ] **Step 5 : Commit**

```bash
git add src/lib/supabase/sharing.ts src/lib/supabase/sharing.test.ts
git commit -m "feat(sharing): sharingDb — findUserByEmail, shares, locks, notifications"
```

---

## Task 3 : Étendre `db.getAll` pour les projets partagés

**Files:**
- Modify: `src/lib/supabase/db.ts`
- Modify: `src/lib/supabase/db.test.ts`

- [ ] **Step 1 : Ajouter les tests qui échouent dans `db.test.ts`**

À la fin du fichier, ajouter :

```ts
describe('supabaseDb.getAll — with shared projects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets myRole to owner when user_id matches', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const p = makeProject();
    // First call: projects
    mockOrder.mockResolvedValueOnce({ data: [{ id: p.id, user_id: 'user-1', data: p }], error: null });
    // Second call: shares
    mockOrder.mockResolvedValueOnce({ data: [], error: null });
    // Third call: locks
    mockIn.mockResolvedValueOnce({ data: [], error: null });

    const result = await supabaseDb.getAll();
    expect(result[0]?.myRole).toBe('owner');
  });

  it('sets myRole to editor for shared project', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const p = makeProject('shared-proj');
    mockOrder.mockResolvedValueOnce({ data: [{ id: p.id, user_id: 'user-99', data: p }], error: null });
    mockOrder.mockResolvedValueOnce({ data: [{ project_id: p.id, role: 'editor' }], error: null });
    mockIn.mockResolvedValueOnce({ data: [], error: null });

    const result = await supabaseDb.getAll();
    expect(result[0]?.myRole).toBe('editor');
  });
});
```

Also add `mockIn` to the mock chain at top of db.test.ts:
```ts
const mockIn = vi.fn();
// Add to mockChain:
in: mockIn,
// Add to the forEach:
mockIn.mockReturnValue(mockChain);
```

- [ ] **Step 2 : Vérifier que les nouveaux tests échouent**

```bash
npx vitest run src/lib/supabase/db.test.ts
```

Expected : FAIL sur les 2 nouveaux tests.

- [ ] **Step 3 : Modifier `src/lib/supabase/db.ts` — getAll étendu**

Remplacer la méthode `getAll` par :

```ts
  async getAll(): Promise<Project[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rows, error } = await supabase
      .from('projects')
      .select('id, user_id, data')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`[${error.code}] ${error.message}`);

    const { data: shares } = await supabase
      .from('project_shares')
      .select('project_id, role')
      .order('created_at', { ascending: true });

    const projectIds = (rows ?? []).map((r) => r.id as string);
    const { data: locks } = projectIds.length > 0
      ? await supabase
          .from('project_locks')
          .select('project_id, locked_by, expires_at, profiles(display_name, email)')
          .in('project_id', projectIds)
          .gt('expires_at', new Date().toISOString())
      : { data: [] };

    const shareMap = new Map(
      (shares ?? []).map((s) => [s.project_id as string, s.role as ShareRole]),
    );
    const lockMap = new Map(
      (locks ?? []).map((l) => {
        const profile = l.profiles as { display_name: string | null; email: string } | null;
        return [l.project_id as string, {
          projectId: l.project_id as string,
          lockedBy: l.locked_by as string,
          lockedByDisplayName: profile?.display_name ?? profile?.email ?? 'Autre utilisateur',
          expiresAt: l.expires_at as string,
        }];
      }),
    );

    return (rows ?? []).map((row) => {
      const project = migrateProject(row.data);
      const isOwner = (row.user_id as string) === user.id;
      const myRole: MyRole = isOwner ? 'owner' : (shareMap.get(row.id as string) ?? 'viewer');
      const lock = lockMap.get(row.id as string) ?? null;
      return { ...project, myRole, lock };
    });
  },
```

Ajouter les imports nécessaires en tête de `db.ts` :

```ts
import type { MyRole } from '@/types/sharing';
import type { ShareRole } from '@/types/sharing';
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/lib/supabase/db.test.ts
```

Expected : tous les tests passent (y compris les anciens).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/supabase/db.ts src/lib/supabase/db.test.ts
git commit -m "feat(sharing): extend db.getAll to include shared projects with myRole and lock"
```

---

## Task 4 : `sharingStore` Zustand

**Files:**
- Create: `src/store/sharingStore.ts`
- Create: `src/store/sharingStore.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent dans `src/store/sharingStore.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUserByEmail = vi.fn();
const mockAddShare = vi.fn();
const mockRemoveShare = vi.fn();
const mockAddNotification = vi.fn();
const mockAcquireLock = vi.fn();
const mockReleaseLock = vi.fn();
const mockRefreshLock = vi.fn();
const mockGetNotifications = vi.fn();
const mockMarkNotificationsSeen = vi.fn();
const mockGetShares = vi.fn();

vi.mock('@/lib/supabase/sharing', () => ({
  sharingDb: {
    findUserByEmail: mockFindUserByEmail,
    addShare: mockAddShare,
    removeShare: mockRemoveShare,
    addNotification: mockAddNotification,
    acquireLock: mockAcquireLock,
    releaseLock: mockReleaseLock,
    refreshLock: mockRefreshLock,
    getNotifications: mockGetNotifications,
    markNotificationsSeen: mockMarkNotificationsSeen,
    getShares: mockGetShares,
  },
}));

import { useSharingStore } from './sharingStore';

describe('sharingStore.shareProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSharingStore.setState({ shares: {}, notifications: [], unseenCount: 0 });
  });

  it('throws USER_NOT_FOUND when email not registered', async () => {
    mockFindUserByEmail.mockResolvedValueOnce(null);
    await expect(
      useSharingStore.getState().shareProject('proj-1', 'ghost@x.com', 'editor'),
    ).rejects.toThrow('USER_NOT_FOUND');
  });

  it('calls addShare + addNotification on success', async () => {
    mockFindUserByEmail.mockResolvedValueOnce({ id: 'user-2', displayName: 'Alice' });
    mockAddShare.mockResolvedValueOnce(undefined);
    mockAddNotification.mockResolvedValueOnce(undefined);
    mockGetShares.mockResolvedValueOnce([]);
    await useSharingStore.getState().shareProject('proj-1', 'alice@x.com', 'editor');
    expect(mockAddShare).toHaveBeenCalledWith('proj-1', 'user-2', 'editor');
    expect(mockAddNotification).toHaveBeenCalledWith('user-2', 'proj-1', 'share_added');
  });

  it('throws ALREADY_SHARED when user is already a collaborator', async () => {
    mockFindUserByEmail.mockResolvedValueOnce({ id: 'user-2', displayName: 'Alice' });
    mockAddShare.mockResolvedValueOnce(undefined);
    mockAddNotification.mockResolvedValueOnce(undefined);
    mockGetShares.mockResolvedValueOnce([]);
    await useSharingStore.getState().shareProject('proj-1', 'alice@x.com', 'editor');
    mockFindUserByEmail.mockResolvedValueOnce({ id: 'user-2', displayName: 'Alice' });
    mockGetShares.mockResolvedValueOnce([{ userId: 'user-2', role: 'editor' }]);
    await expect(
      useSharingStore.getState().shareProject('proj-1', 'alice@x.com', 'viewer'),
    ).rejects.toThrow('ALREADY_SHARED');
  });
});

describe('sharingStore.acquireLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSharingStore.setState({ shares: {}, notifications: [], unseenCount: 0 });
  });

  it('returns acquired when lock is free', async () => {
    mockAcquireLock.mockResolvedValueOnce('acquired');
    const result = await useSharingStore.getState().acquireLock('proj-1');
    expect(result).toBe('acquired');
  });

  it('returns locked_by_other when another user has the lock', async () => {
    mockAcquireLock.mockResolvedValueOnce('locked_by_other');
    const result = await useSharingStore.getState().acquireLock('proj-1');
    expect(result).toBe('locked_by_other');
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run src/store/sharingStore.test.ts
```

Expected : FAIL — `useSharingStore` n'existe pas.

- [ ] **Step 3 : Créer `src/store/sharingStore.ts`**

```ts
import { create } from 'zustand';
import { sharingDb } from '@/lib/supabase/sharing';
import type { ProjectShare, ProjectNotification, ShareRole } from '@/types/sharing';

interface SharingState {
  shares: Record<string, ProjectShare[]>;
  notifications: ProjectNotification[];
  unseenCount: number;

  loadShares: (projectId: string) => Promise<void>;
  shareProject: (projectId: string, email: string, role: ShareRole) => Promise<void>;
  unshareProject: (projectId: string, userId: string) => Promise<void>;
  acquireLock: (projectId: string) => Promise<'acquired' | 'locked_by_other'>;
  releaseLock: (projectId: string) => Promise<void>;
  refreshLock: (projectId: string) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationsSeen: () => Promise<void>;
}

export const useSharingStore = create<SharingState>((set, get) => ({
  shares: {},
  notifications: [],
  unseenCount: 0,

  loadShares: async (projectId) => {
    const shares = await sharingDb.getShares(projectId);
    set((s) => ({ shares: { ...s.shares, [projectId]: shares } }));
  },

  shareProject: async (projectId, email, role) => {
    const user = await sharingDb.findUserByEmail(email);
    if (!user) throw new Error('USER_NOT_FOUND');

    await get().loadShares(projectId);
    const existing = get().shares[projectId] ?? [];
    if (existing.some((s) => s.userId === user.id)) throw new Error('ALREADY_SHARED');

    await sharingDb.addShare(projectId, user.id, role);
    await sharingDb.addNotification(user.id, projectId, 'share_added');
    await get().loadShares(projectId);
  },

  unshareProject: async (projectId, userId) => {
    await sharingDb.removeShare(projectId, userId);
    await sharingDb.addNotification(userId, projectId, 'share_removed');
    await get().loadShares(projectId);
  },

  acquireLock: async (projectId) => sharingDb.acquireLock(projectId),

  releaseLock: async (projectId) => sharingDb.releaseLock(projectId),

  refreshLock: async (projectId) => sharingDb.refreshLock(projectId),

  loadNotifications: async () => {
    const notifications = await sharingDb.getNotifications();
    const unseenCount = notifications.filter((n) => !n.seen).length;
    set({ notifications, unseenCount });
  },

  markNotificationsSeen: async () => {
    await sharingDb.markNotificationsSeen();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, seen: true })),
      unseenCount: 0,
    }));
  },
}));
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/store/sharingStore.test.ts
```

Expected : 5 passed (5)

- [ ] **Step 5 : Commit**

```bash
git add src/store/sharingStore.ts src/store/sharingStore.test.ts
git commit -m "feat(sharing): sharingStore — shareProject, locks, notifications"
```

---

## Task 5 : ProjectList — split "Mes projets" / "Partagés avec moi" + badge

**Files:**
- Modify: `src/components/home/ProjectList.tsx`
- Modify: `src/components/home/ProjectCard.tsx`

- [ ] **Step 1 : Modifier `src/components/home/ProjectList.tsx`**

Remplacer l'intégralité du fichier par :

```tsx
'use client';

import { useEffect } from 'react';
import { Plus, Users } from 'lucide-react';
import type { Project } from '@/types/project';
import { useSharingStore } from '@/store/sharingStore';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: Project[];
  onCreate: () => void;
  onOpen: (project: Project) => void;
  onDelete: (project: Project) => void;
  onShare: (project: Project) => void;
}

export const ProjectList = ({ projects, onCreate, onOpen, onDelete, onShare }: ProjectListProps) => {
  const { unseenCount, loadNotifications, markNotificationsSeen } = useSharingStore();

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const ownProjects = projects.filter((p) => !p.myRole || p.myRole === 'owner');
  const sharedProjects = projects.filter((p) => p.myRole === 'viewer' || p.myRole === 'editor');

  const handleOpenShared = (project: Project) => {
    void markNotificationsSeen();
    onOpen(project);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Mes projets */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Mes projets
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ownProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpen(p)}
              onDelete={() => onDelete(p)}
              onShare={() => onShare(p)}
            />
          ))}
          <button
            type="button"
            onClick={onCreate}
            className="group flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-zinc-800 text-zinc-600 transition-all hover:border-blue-500/40 hover:bg-blue-500/5 hover:text-blue-500/60"
          >
            <div className="rounded-full bg-zinc-900 p-4 transition-colors group-hover:bg-blue-500/10">
              <Plus size={40} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Créer un projet</span>
          </button>
        </div>
      </section>

      {/* Partagés avec moi */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">
            Partagés avec moi
          </h2>
          {unseenCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
              {unseenCount}
            </span>
          )}
        </div>
        {sharedProjects.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-800">
            <div className="flex flex-col items-center gap-2 text-zinc-600">
              <Users size={20} />
              <span className="text-xs">Aucun projet partagé avec vous</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sharedProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => handleOpenShared(p)}
                onDelete={() => onDelete(p)}
                onShare={() => onShare(p)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
```

- [ ] **Step 2 : Modifier `src/components/home/ProjectCard.tsx` — ajouter badge de rôle et bouton partage**

Remplacer l'intégralité du fichier par :

```tsx
'use client';

import { ChevronRight, Share2, Trash2 } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onShare: () => void;
}

const ROLE_LABELS: Record<string, string> = { viewer: 'Lecteur', editor: 'Éditeur' };

export const ProjectCard = ({ project, onOpen, onDelete, onShare }: ProjectCardProps) => {
  const isOwner = !project.myRole || project.myRole === 'owner';
  const roleLabel = !isOwner ? ROLE_LABELS[project.myRole ?? ''] : null;

  const handleDelete = (e: MouseEvent) => { e.stopPropagation(); onDelete(); };
  const handleShare = (e: MouseEvent) => { e.stopPropagation(); onShare(); };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className="group flex h-64 cursor-pointer flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-sm transition-all duration-500 hover:border-blue-500/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-500/5"
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-lg font-bold text-zinc-200 transition-colors group-hover:text-blue-400">
            {project.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={handleShare}
                className="p-1 text-zinc-600 transition-colors hover:text-blue-400"
                aria-label="Partager le projet"
              >
                <Share2 size={14} />
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 text-zinc-600 transition-colors hover:text-red-400"
                aria-label="Supprimer le projet"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs font-medium text-zinc-500">
          {project.rooms.length} pièce{project.rooms.length > 1 ? 's' : ''} —{' '}
          {project.rooms.reduce((n, r) => n + r.points.length, 0)} sommets
        </p>
        {roleLabel && (
          <span className="mt-2 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            {roleLabel}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="mb-0.5 text-[10px] font-black uppercase tracking-tighter text-zinc-600">
            Dernière édition
          </p>
          <p className="font-mono text-xs text-zinc-400">
            {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-all group-hover:bg-blue-600 group-hover:text-white">
          <ChevronRight size={20} />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "ProjectList|ProjectCard" | head -10
```

Expected : aucune erreur TypeScript sur ces fichiers.

- [ ] **Step 4 : Commit**

```bash
git add src/components/home/ProjectList.tsx src/components/home/ProjectCard.tsx
git commit -m "feat(sharing): split ProjectList into own/shared sections + role badge + share button"
```

---

## Task 6 : Composant `SharePanel`

**Files:**
- Create: `src/components/home/SharePanel.tsx`
- Create: `src/components/home/SharePanel.test.tsx`

- [ ] **Step 1 : Écrire les tests qui échouent dans `src/components/home/SharePanel.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockShareProject = vi.fn();
const mockUnshareProject = vi.fn();
const mockLoadShares = vi.fn();

vi.mock('@/store/sharingStore', () => ({
  useSharingStore: (sel: (s: unknown) => unknown) =>
    sel({
      shares: {
        'proj-1': [
          {
            id: 's1', projectId: 'proj-1', userId: 'user-2',
            userEmail: 'alice@x.com', userDisplayName: 'Alice',
            role: 'editor', createdAt: '2026-01-01',
          },
        ],
      },
      shareProject: mockShareProject,
      unshareProject: mockUnshareProject,
      loadShares: mockLoadShares,
    }),
}));

import { SharePanel } from './SharePanel';

const defaultProps = {
  projectId: 'proj-1',
  onClose: vi.fn(),
};

describe('SharePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders existing collaborators', () => {
    render(<SharePanel {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('alice@x.com')).toBeDefined();
  });

  it('shows error when email not found', async () => {
    mockShareProject.mockRejectedValueOnce(new Error('USER_NOT_FOUND'));
    render(<SharePanel {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('adresse@email.com'), {
      target: { value: 'ghost@x.com' },
    });
    fireEvent.click(screen.getByText('Inviter'));
    await waitFor(() => {
      expect(screen.getByText('Aucun compte trouvé pour cet email.')).toBeDefined();
    });
  });

  it('shows error when already shared', async () => {
    mockShareProject.mockRejectedValueOnce(new Error('ALREADY_SHARED'));
    render(<SharePanel {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('adresse@email.com'), {
      target: { value: 'alice@x.com' },
    });
    fireEvent.click(screen.getByText('Inviter'));
    await waitFor(() => {
      expect(screen.getByText('Déjà collaborateur sur ce projet.')).toBeDefined();
    });
  });

  it('calls unshareProject on revoke', async () => {
    mockUnshareProject.mockResolvedValueOnce(undefined);
    render(<SharePanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Révoquer alice@x.com'));
    await waitFor(() => {
      expect(mockUnshareProject).toHaveBeenCalledWith('proj-1', 'user-2');
    });
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run src/components/home/SharePanel.test.tsx
```

Expected : FAIL — `SharePanel` n'existe pas.

- [ ] **Step 3 : Créer `src/components/home/SharePanel.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X, UserMinus } from 'lucide-react';
import { useSharingStore } from '@/store/sharingStore';
import type { ShareRole } from '@/types/sharing';

interface SharePanelProps {
  projectId: string;
  onClose: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: 'Aucun compte trouvé pour cet email.',
  ALREADY_SHARED: 'Déjà collaborateur sur ce projet.',
};

export const SharePanel = ({ projectId, onClose }: SharePanelProps) => {
  const { shares, shareProject, unshareProject, loadShares } = useSharingStore();
  const collaborators = shares[projectId] ?? [];

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { void loadShares(projectId); }, [projectId, loadShares]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await shareProject(projectId, email.trim(), role);
      setEmail('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      setError(ERROR_MESSAGES[msg] ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    await unshareProject(projectId, userId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="flex w-full max-w-sm flex-col rounded-2xl shadow-2xl"
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--bdr)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Partager le projet</h2>
          <button type="button" className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Invite form */}
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--bdr)' }}>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="adresse@email.com"
              className="flex-1 rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--bdr)'; }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleInvite(); }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
              className="rounded-lg px-2 py-2 text-[12px] outline-none"
              style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', color: 'var(--text)' }}
            >
              <option value="editor">Éditeur</option>
              <option value="viewer">Lecteur</option>
            </select>
          </div>
          {error && (
            <p className="mt-2 text-[12px] text-red-400">{error}</p>
          )}
          <button
            type="button"
            className="btn-primary mt-3 w-full text-[13px]"
            onClick={() => void handleInvite()}
            disabled={loading || !email.trim()}
          >
            {loading ? 'Envoi…' : 'Inviter'}
          </button>
        </div>

        {/* Collaborators list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {collaborators.length === 0 ? (
            <p className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>
              Aucun collaborateur pour le moment.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {collaborators.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}
                >
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
                      {c.userDisplayName || c.userEmail}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{c.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'var(--surf3)', color: 'var(--text2)' }}
                    >
                      {c.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRevoke(c.userId)}
                      aria-label={`Révoquer ${c.userEmail}`}
                      className="p-1 text-zinc-600 transition-colors hover:text-red-400"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/home/SharePanel.test.tsx
```

Expected : 4 passed (4)

- [ ] **Step 5 : Commit**

```bash
git add src/components/home/SharePanel.tsx src/components/home/SharePanel.test.tsx
git commit -m "feat(sharing): SharePanel component — invite, role select, revoke"
```

---

## Task 7 : Verrouillage dans la page workspace

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

- [ ] **Step 1 : Ajouter le `LockBanner` inline dans la page workspace**

Dans `src/app/project/[id]/page.tsx`, ajouter l'import :

```ts
import { useSharingStore } from '@/store/sharingStore';
```

Dans le composant `WorkspacePage`, après `const removeNote = useProjectStore((s) => s.removeNote);`, ajouter :

```ts
  const acquireLock = useSharingStore((s) => s.acquireLock);
  const releaseLock = useSharingStore((s) => s.releaseLock);
  const refreshLock = useSharingStore((s) => s.refreshLock);

  const [lockStatus, setLockStatus] = useState<'idle' | 'acquired' | 'locked_by_other'>('idle');
  const [lockInfo, setLockInfo] = useState<{ lockedByDisplayName: string } | null>(null);
```

- [ ] **Step 2 : Acquérir le verrou à l'ouverture du projet**

Après le `useEffect` qui appelle `setActive(id)`, ajouter :

```ts
  useEffect(() => {
    if (!hydrated || !activeProject) return;
    const isEditor = activeProject.myRole === 'editor' || activeProject.myRole === 'owner';
    if (!isEditor) return;

    void acquireLock(id).then((status) => {
      setLockStatus(status);
      if (status === 'locked_by_other' && activeProject.lock) {
        setLockInfo({ lockedByDisplayName: activeProject.lock.lockedByDisplayName });
      }
    });

    return () => { void releaseLock(id); };
  }, [id, hydrated, activeProject?.myRole]);

  useEffect(() => {
    if (lockStatus !== 'acquired') return;
    const interval = setInterval(() => { void refreshLock(id); }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [id, lockStatus]);

  useEffect(() => {
    const handler = () => { void releaseLock(id); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [id]);
```

- [ ] **Step 3 : Rendre le LockBanner dans le JSX**

Dans le JSX, juste après le `<header>` de la topbar (après la balise `</header>`) et avant `{/* Tab bar */}`, ajouter :

```tsx
      {/* Lock banner */}
      {lockStatus === 'locked_by_other' && (
        <div className="flex items-center gap-2 border-b px-5 py-2 text-[12px]"
          style={{ background: '#f97316/10', borderColor: 'var(--bdr)', color: '#f97316' }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="6" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 6V4.5a2 2 0 1 1 4 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Édition en cours par{' '}
          <strong>{lockInfo?.lockedByDisplayName ?? 'un autre utilisateur'}</strong>.{' '}
          Vous êtes en lecture seule.
        </div>
      )}
```

- [ ] **Step 4 : Ajouter le polling du verrou toutes les 60s (lecture seule → déblocage auto)**

Ajouter à `sharingStore.ts` la méthode `checkLock` :

```ts
  checkLock: async (projectId: string): Promise<'acquired' | 'locked_by_other' | 'free'> => {
    const result = await sharingDb.acquireLock(projectId);
    return result;
  },
```

Dans la page workspace, après le `useEffect` du refresh (10 min), ajouter :

```ts
  useEffect(() => {
    if (lockStatus !== 'locked_by_other') return;
    const interval = setInterval(async () => {
      const status = await acquireLock(id);
      setLockStatus(status);
      if (status === 'acquired') setLockInfo(null);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [id, lockStatus]);
```

- [ ] **Step 5 : Désactiver les modifications en lecture seule**

Dans le composant, définir :

```ts
  const isReadOnly = lockStatus === 'locked_by_other' || activeProject?.myRole === 'viewer';
```

Passer `isReadOnly` comme prop aux composants qui modifient des données (les composants existants n'ont pas encore ce prop — cette étape se limite à bloquer le `updateActive` du store). Dans l'`updateActive` du store côté composant, vérifier `isReadOnly` avant de modifier :

Sur la balise `<input>` du nom de projet dans la topbar, ajouter :

```tsx
readOnly={isReadOnly}
disabled={isReadOnly}
```

Et désactiver le bouton Settings :

```tsx
disabled={isReadOnly}
```

- [ ] **Step 6 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "project/\[id\]" | head -10
```

Expected : aucune erreur.

- [ ] **Step 7 : Lancer toute la suite de tests**

```bash
npx vitest run
```

Expected : tous les tests passent.

- [ ] **Step 8 : Commit**

```bash
git add src/app/project/[id]/page.tsx src/store/sharingStore.ts
git commit -m "feat(sharing): lock acquisition, refresh, release + 60s poll + read-only banner in workspace"
```

---

## Task 8 : Brancher SharePanel dans le dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1 : Lire la page dashboard**

Lire `src/app/dashboard/page.tsx` pour comprendre comment `ProjectList` est actuellement utilisé.

- [ ] **Step 2 : Ajouter l'état et le handler `onShare`**

Dans le composant dashboard, ajouter :

```ts
const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
```

- [ ] **Step 3 : Passer `onShare` à `ProjectList` et rendre `SharePanel`**

Dans le JSX du dashboard, modifier le rendu de `ProjectList` pour ajouter :
```tsx
onShare={(project) => setSharingProjectId(project.id)}
```

Et juste après `ProjectList`, ajouter :

```tsx
{sharingProjectId && (
  <SharePanel
    projectId={sharingProjectId}
    onClose={() => setSharingProjectId(null)}
  />
)}
```

Ajouter les imports :
```ts
import { useState } from 'react';
import { SharePanel } from '@/components/home/SharePanel';
```

- [ ] **Step 4 : Vérifier la compilation**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 5 : Lancer toute la suite de tests**

```bash
npx vitest run
```

Expected : tous les tests passent.

- [ ] **Step 6 : Commit final**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(sharing): wire SharePanel into dashboard"
```
