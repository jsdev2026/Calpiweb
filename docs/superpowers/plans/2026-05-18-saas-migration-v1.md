# CaléPlan SaaS Migration V1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CaléPlan from a local IndexedDB app into a cloud-first SaaS with Supabase Auth, PostgreSQL project storage, protected routes, a public landing page, and a user dashboard.

**Architecture:** All projects are stored in Supabase PostgreSQL (no IndexedDB). The store's `hydrate()` and `save()` functions are the only internal changes — the tiling engine and all UI components remain untouched. Route protection is handled by Next.js middleware. The existing `app/page.tsx` becomes the public landing page; current dashboard content moves to `app/dashboard/page.tsx`.

**Tech Stack:** Next.js 14, Supabase (`@supabase/supabase-js` + `@supabase/ssr`), Zustand, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-05-18-saas-migration-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/supabase/client.ts` | Browser Supabase client singleton |
| Create | `lib/supabase/server.ts` | Server-side Supabase client (cookies) |
| Create | `lib/supabase/db.ts` | Project + profile CRUD via Supabase |
| Create | `lib/supabase/db.test.ts` | Unit tests for supabaseDb (mocked client) |
| Create | `middleware.ts` | Route protection + auth redirects |
| Create | `app/dashboard/page.tsx` | Protected dashboard (moved from app/page.tsx) |
| Create | `app/account/page.tsx` | Account page — plan display |
| Modify | `store/projectStore.ts` | Replace `projectsDb` calls with `supabaseDb` |
| Modify | `store/projectStore.test.ts` | Test project limit logic |
| Modify | `store/uiStore.ts` | Supabase Auth integration (replace localStorage auth) |
| Modify | `app/page.tsx` | Transform into public landing page |
| Modify | `app/auth/page.tsx` | Real Supabase Auth (signIn / signUp) |
| Delete | `lib/db.ts` | Replaced by `lib/supabase/db.ts` |

---

## Task 1: Install Supabase dependencies and set up environment

**Files:**
- Modify: `package.json`
- Create: `.env.local.example`

- [ ] **Step 1: Install packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Expected output: packages added to `node_modules/`, no errors.

- [ ] **Step 2: Create `.env.local.example`**

Create the file `/workspaces/Calpiweb/.env.local.example` with this content:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Create your own `.env.local` from the example**

```bash
cp .env.local.example .env.local
```

Fill in the real values from your Supabase project dashboard (Settings → API).

- [ ] **Step 4: Verify the build still compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "feat(saas): install @supabase/supabase-js and @supabase/ssr"
```

---

## Task 2: Set up Supabase database schema

This task runs SQL in the Supabase dashboard — no code files to commit. Open your Supabase project → SQL Editor → New query.

**Files:** none (SQL executed in Supabase dashboard)

- [ ] **Step 1: Create `profiles` and `projects` tables**

Run this SQL in the Supabase SQL Editor:

```sql
-- Profiles table (1:1 with auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  project_credits int NOT NULL DEFAULT 0,
  stripe_customer_id text,
  updated_at timestamptz DEFAULT now()
);

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Enable Row Level Security**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Create RLS policies**

```sql
-- Profiles: users see and update only their own row
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects: full CRUD for own rows
CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 4: Create trigger to auto-create profile on sign-up**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, plan)
  VALUES (NEW.id, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 5: Verify tables exist**

In the Supabase Table Editor, confirm `profiles` and `projects` tables appear with the correct columns.

---

## Task 3: Create Supabase client utilities

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component — cookies are read-only, ignore
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "feat(saas): add Supabase browser and server client utilities"
```

---

## Task 4: Create the Supabase database layer (TDD)

**Files:**
- Create: `src/lib/supabase/db.ts`
- Create: `src/lib/supabase/db.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/db.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the browser client before importing db
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockGetUser = vi.fn();

const mockChain = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  upsert: mockUpsert,
  delete: mockDelete,
};

// Each method returns mockChain so calls can be chained
mockSelect.mockReturnValue(mockChain);
mockEq.mockReturnValue(mockChain);
mockOrder.mockReturnValue(mockChain);
mockDelete.mockReturnValue(mockChain);

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue(mockChain),
    auth: { getUser: mockGetUser },
  }),
}));

import { supabaseDb } from './db';
import type { Project } from '@/types/project';

const makeProject = (id = 'proj-1'): Project => ({
  id,
  name: 'Test',
  status: 'new',
  createdAt: 1000,
  updatedAt: 1000,
  rooms: [],
  config: {
    width: 300, height: 600, joint: 3,
    offsetX: 0, offsetY: 0, stagger: 33,
    angle: 0, chevronAngle: 45,
    color: '#93c5fd', layout: 'STRAIGHT',
  },
  wallThickness: 100,
  constraints: [],
  notes: [],
});

describe('supabaseDb.getAll', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns projects from Supabase rows', async () => {
    const p = makeProject();
    mockOrder.mockResolvedValueOnce({ data: [{ data: p }], error: null });
    const result = await supabaseDb.getAll();
    expect(result).toEqual([p]);
  });

  it('returns empty array when no data', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: null });
    const result = await supabaseDb.getAll();
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('DB error') });
    await expect(supabaseDb.getAll()).rejects.toThrow('DB error');
  });
});

describe('supabaseDb.get', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a project when found', async () => {
    const p = makeProject('proj-42');
    mockSingle.mockResolvedValueOnce({ data: { data: p }, error: null });
    const result = await supabaseDb.get('proj-42');
    expect(result).toEqual(p);
  });

  it('returns undefined when not found', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error('not found') });
    const result = await supabaseDb.get('missing');
    expect(result).toBeUndefined();
  });
});

describe('supabaseDb.save', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts project with user_id', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    mockUpsert.mockResolvedValueOnce({ error: null });
    const p = makeProject();
    await supabaseDb.save(p);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj-1', user_id: 'user-1', name: 'Test' }),
    );
  });

  it('throws when not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(supabaseDb.save(makeProject())).rejects.toThrow('NOT_AUTHENTICATED');
  });
});

describe('supabaseDb.delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes project by id', async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    await supabaseDb.delete('proj-1');
    expect(mockEq).toHaveBeenCalledWith('id', 'proj-1');
  });
});

describe('supabaseDb.getProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns profile plan', async () => {
    mockSingle.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const profile = await supabaseDb.getProfile();
    expect(profile.plan).toBe('pro');
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
npm test -- db.test
```

Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 3: Implement `src/lib/supabase/db.ts`**

```typescript
import type { Project } from '@/types/project';
import { createClient } from './client';

export const supabaseDb = {
  async getAll(): Promise<Project[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => row.data as Project);
  },

  async get(id: string): Promise<Project | undefined> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .single();
    if (error) return undefined;
    return data?.data as Project | undefined;
  },

  async save(project: Project): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const { error } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: user.id,
      name: project.name,
      data: { ...project, updatedAt: Date.now() },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  async getProfile(): Promise<{ plan: 'free' | 'pro' }> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .single();
    if (error) throw error;
    return data as { plan: 'free' | 'pro' };
  },
};
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npm test -- db.test
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/db.ts src/lib/supabase/db.test.ts
git commit -m "feat(saas): add Supabase project CRUD layer (TDD)"
```

---

## Task 5: Migrate `projectStore` to use Supabase

**Files:**
- Modify: `src/store/projectStore.ts`
- Create: `src/store/projectStore.test.ts`

- [ ] **Step 1: Write the failing test for project limit**

Create `src/store/projectStore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/db', () => ({
  supabaseDb: {
    getAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getProfile: vi.fn(),
  },
}));

import { supabaseDb } from '@/lib/supabase/db';
import { useProjectStore } from './projectStore';

const mockSupabaseDb = supabaseDb as {
  getAll: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getProfile: ReturnType<typeof vi.fn>;
};

describe('projectStore — free plan limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state between tests
    useProjectStore.setState({ projects: [], hydrated: false });
  });

  it('allows creating a project when under the free limit', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    useProjectStore.setState({ projects: [] });

    const project = await useProjectStore.getState().create();
    expect(project.id).toBeDefined();
  });

  it('throws PROJECT_LIMIT_REACHED for free users at 1 project', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    const existing = {
      id: 'existing', name: 'Existing', status: 'new' as const,
      createdAt: 1000, updatedAt: 1000, rooms: [], config: {} as never,
      wallThickness: 100, constraints: [], notes: [],
    };
    useProjectStore.setState({ projects: [existing] });

    await expect(useProjectStore.getState().create()).rejects.toThrow('PROJECT_LIMIT_REACHED');
  });

  it('allows creating a project for pro users regardless of count', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'pro' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    const existing = {
      id: 'existing', name: 'Existing', status: 'new' as const,
      createdAt: 1000, updatedAt: 1000, rooms: [], config: {} as never,
      wallThickness: 100, constraints: [], notes: [],
    };
    useProjectStore.setState({ projects: [existing] });

    const project = await useProjectStore.getState().create();
    expect(project.id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npm test -- projectStore.test
```

Expected: FAIL — project limit logic doesn't exist yet.

- [ ] **Step 3: Update `src/store/projectStore.ts`**

Replace the import at line 5:
```typescript
// Before:
import { projectsDb } from '@/lib/db';

// After:
import { supabaseDb } from '@/lib/supabase/db';
```

Replace the `hydrate` action (lines 115–119):
```typescript
hydrate: async () => {
  if (get().hydrated) return;
  const all = await supabaseDb.getAll();
  set({ projects: all.map(migrateProject).sort(sortByUpdatedDesc), hydrated: true });
},
```

Replace the `create` action (lines 121–138) to add the plan limit check:
```typescript
create: async (data) => {
  const profile = await supabaseDb.getProfile();
  if (profile.plan === 'free' && get().projects.length >= 1) {
    throw new Error('PROJECT_LIMIT_REACHED');
  }
  const now = Date.now();
  const newProject: Project = {
    id: generateId(),
    name: data?.name ?? `Nouveau projet ${get().projects.length + 1}`,
    client: data?.client,
    status: 'new',
    createdAt: now,
    updatedAt: now,
    rooms: [{ id: generateId(), points: [], edges: [], partitions: [], excludedZones: [] }],
    config: { ...DEFAULT_TILING_CONFIG },
    wallThickness: WALL_THICKNESS_MM,
    constraints: [],
    notes: [],
  };
  await supabaseDb.save(newProject);
  set({ projects: [newProject, ...get().projects], activeProjectId: newProject.id });
  return newProject;
},
```

Replace the `rename` action (lines 141–144):
```typescript
rename: (id, name) => {
  set({ projects: get().projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)) });
  const target = get().projects.find((p) => p.id === id);
  if (target) void supabaseDb.save(target);
},
```

Replace the `remove` action (lines 147–153):
```typescript
remove: async (id) => {
  await supabaseDb.delete(id);
  set({
    projects: get().projects.filter((p) => p.id !== id),
    activeProjectId: get().activeProjectId === id ? null : get().activeProjectId,
  });
},
```

Replace the `updateActive` action (lines 157–166). Find all `projectsDb.save` calls and change to `supabaseDb.save`:
```typescript
updateActive: (updater) => {
  const id = get().activeProjectId;
  if (!id) return;
  const next = get().projects.map((p) =>
    p.id === id ? { ...updater(p), updatedAt: Date.now() } : p,
  );
  set({ projects: next });
  const updated = next.find((p) => p.id === id);
  if (updated) void supabaseDb.save(updated);
},
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npm test -- projectStore.test
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/projectStore.ts src/store/projectStore.test.ts
git commit -m "feat(saas): migrate projectStore from IndexedDB to Supabase"
```

---

## Task 6: Create the Next.js middleware

**Files:**
- Create: `middleware.ts` (at the project root, next to `package.json`)

- [ ] **Step 1: Write the failing test**

Create `src/middleware.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// We test the route classification logic independently of the Supabase call
// so we extract a pure helper to test.
import { classifyRoute } from '../middleware';

describe('classifyRoute', () => {
  it('marks /dashboard as protected', () => {
    expect(classifyRoute('/dashboard')).toBe('protected');
  });

  it('marks /project/abc as protected', () => {
    expect(classifyRoute('/project/abc-123')).toBe('protected');
  });

  it('marks /account as protected', () => {
    expect(classifyRoute('/account')).toBe('protected');
  });

  it('marks /auth as auth-only', () => {
    expect(classifyRoute('/auth')).toBe('auth');
  });

  it('marks / as public', () => {
    expect(classifyRoute('/')).toBe('public');
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
npm test -- middleware.test
```

Expected: FAIL — `classifyRoute` does not exist.

- [ ] **Step 3: Create `middleware.ts` at the project root**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/account', '/project'];
const AUTH_ONLY = ['/auth'];

export function classifyRoute(pathname: string): 'protected' | 'auth' | 'public' {
  if (PROTECTED.some((r) => pathname === r || pathname.startsWith(r + '/'))) return 'protected';
  if (AUTH_ONLY.some((r) => pathname === r || pathname.startsWith(r + '/'))) return 'auth';
  return 'public';
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const kind = classifyRoute(pathname);

  if (kind === 'protected' && !user) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if ((kind === 'auth' || pathname === '/') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
npm test -- middleware.test
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts src/middleware.test.ts
git commit -m "feat(saas): add Next.js middleware for route protection"
```

---

## Task 7: Update `uiStore` for Supabase Auth

**Files:**
- Modify: `src/store/uiStore.ts`

The `uiStore` currently stores user in `localStorage`. We replace the auth parts with Supabase while keeping the dark mode logic.

- [ ] **Step 1: Rewrite `src/store/uiStore.ts`**

```typescript
'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro';
}

interface UiState {
  darkMode: boolean;
  user: AuthUser | null;
  init: () => Promise<void>;
  toggleDarkMode: () => void;
  logout: () => Promise<void>;
}

export const useUiStore = create<UiState>((set, get) => ({
  darkMode: false,
  user: null,

  init: async () => {
    if (typeof window === 'undefined') return;

    // Dark mode (localStorage — unchanged)
    const darkMode = localStorage.getItem('caleplan_dark') === 'true';
    if (darkMode) document.documentElement.setAttribute('data-dark', 'true');
    set({ darkMode });

    // Auth: read from Supabase session
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      set({ user: null });
      return;
    }

    // Read plan from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .single();

    set({
      user: {
        id: authUser.id,
        name: authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? 'Utilisateur',
        email: authUser.email ?? '',
        plan: (profile?.plan ?? 'free') as 'free' | 'pro',
      },
    });
  },

  toggleDarkMode: () => {
    const next = !get().darkMode;
    localStorage.setItem('caleplan_dark', String(next));
    if (next) {
      document.documentElement.setAttribute('data-dark', 'true');
    } else {
      document.documentElement.removeAttribute('data-dark');
    }
    set({ darkMode: next });
  },

  logout: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
```

- [ ] **Step 2: Update `ThemeProvider` to call the new async `init`**

Open `src/components/ThemeProvider.tsx`. Find where `init()` is called. Change:

```typescript
// Before (synchronous):
useEffect(() => { init(); }, [init]);

// After (async):
useEffect(() => { void init(); }, [init]);
```

- [ ] **Step 3: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors. If `user?.plan` is used anywhere expecting a `'team'` type, update those references — the new `AuthUser` only has `'free' | 'pro'`.

- [ ] **Step 4: Commit**

```bash
git add src/store/uiStore.ts src/components/ThemeProvider.tsx
git commit -m "feat(saas): integrate Supabase Auth into uiStore"
```

---

## Task 8: Rewrite the auth page with Supabase Auth

**Files:**
- Modify: `src/app/auth/page.tsx`

The page currently has 4 fake steps (login, register, plans, payment). In V1 we keep 2 real steps: login and register. The plan selection step is removed (everyone starts free). The payment step is V2.

- [ ] **Step 1: Rewrite `src/app/auth/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'login' | 'register' | 'forgot';

// ─── Brand panel (unchanged from existing) ─────────────────────────────────────
const BrandPanel = () => (
  <div
    className="relative hidden w-[420px] shrink-0 flex-col overflow-hidden lg:flex"
    style={{ background: 'linear-gradient(145deg, #1a2332, #0f1520, #1C2A1A)' }}
  >
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="tiles" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="26" height="26" fill="#E8671A" rx="2"/>
          <rect x="33" y="1" width="26" height="26" fill="#E8671A" rx="2"/>
          <rect x="1" y="33" width="26" height="26" fill="#E8671A" rx="2"/>
          <rect x="33" y="33" width="26" height="26" fill="#E8671A" rx="2"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tiles)"/>
    </svg>
    <div className="relative flex flex-1 flex-col p-10">
      <div className="mb-12 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#E8671A' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity=".7"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity=".7"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>CaléPlan</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.15 }} className="mb-4">
        Calepinage de carrelage
      </h1>
      <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 14.5 }} className="mb-10 leading-relaxed">
        Concevez vos plans 2D, simulez la pose et générez des quantitatifs précis en quelques minutes.
      </p>
      <ul className="mb-auto space-y-4">
        {['Tracé de plans 2D libre', 'Simulation de 3 types de pose', 'Quantitatif optimisé avec réutilisation des chutes', 'Sauvegarde cloud automatique'].map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(232,103,26,.25)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#E8671A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const inputCls = 'w-full rounded-[var(--rs)] border px-[11px] py-2 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]';
  const inputStyle = { borderColor: 'var(--bdr2)', background: 'var(--surf)', color: 'var(--text)' };
  const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px]';
  const labelStyle = { color: 'var(--text2)' };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Email ou mot de passe incorrect.');
    } else {
      router.push('/dashboard');
      router.refresh();
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() || email.split('@')[0] } },
    });
    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    setLoading(true);
    setError(null);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?step=reset`,
    });
    setForgotSent(true);
    setLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">

        {step === 'login' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-1">Connexion</h2>
            <p className="mb-7 text-[13px]" style={{ color: 'var(--text2)' }}>Bienvenue sur CaléPlan</p>
            {error && <p className="mb-4 rounded-lg p-3 text-[12.5px]" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>}
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={labelCls} style={labelStyle}>Mot de passe</label>
                  <button type="button" onClick={() => setStep('forgot')} className="text-[11.5px]" style={{ color: 'var(--accent)' }}>Mot de passe oublié ?</button>
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && void handleLogin()} />
              </div>
            </div>
            <button type="button" onClick={() => void handleLogin()} disabled={loading} className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="mt-5 text-center text-[12.5px]" style={{ color: 'var(--text2)' }}>
              Pas encore de compte ?{' '}
              <button type="button" onClick={() => { setError(null); setStep('register'); }} className="font-semibold" style={{ color: 'var(--accent)' }}>Créer un compte</button>
            </p>
          </div>
        )}

        {step === 'register' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <button type="button" onClick={() => { setError(null); setStep('login'); }} className="btn-ghost mb-5 -ml-2 gap-1.5 text-[12.5px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-6">Créer un compte</h2>
            {error && <p className="mb-4 rounded-lg p-3 text-[12.5px]" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>}
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Prénom et nom</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Mot de passe</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" className={inputCls} style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && void handleRegister()} />
              </div>
            </div>
            <button type="button" onClick={() => void handleRegister()} disabled={loading} className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50">
              {loading ? 'Création…' : 'Créer mon compte gratuit'}
            </button>
            <p className="mt-4 text-center text-[11.5px]" style={{ color: 'var(--muted)' }}>
              Plan gratuit — 1 projet cloud inclus. Aucune carte requise.
            </p>
          </div>
        )}

        {step === 'forgot' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <button type="button" onClick={() => { setError(null); setForgotSent(false); setStep('login'); }} className="btn-ghost mb-5 -ml-2 gap-1.5 text-[12.5px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-6">Mot de passe oublié</h2>
            {forgotSent ? (
              <p className="rounded-lg p-4 text-[13px]" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
              </p>
            ) : (
              <>
                {error && <p className="mb-4 rounded-lg p-3 text-[12.5px]" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>}
                <div className="mb-6">
                  <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
                </div>
                <button type="button" onClick={() => void handleForgot()} disabled={loading} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual test — register flow**

Start dev server (`npm run dev`), navigate to `http://localhost:3000/auth`, create a test account. Verify redirect to `/dashboard` and that a `profiles` row is created in Supabase.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/page.tsx
git commit -m "feat(saas): rewrite auth page with real Supabase Auth"
```

---

## Task 9: Create the dashboard page

**Files:**
- Create: `src/app/dashboard/page.tsx`

Move the existing home page content (project list, KPIs, filters) to `/dashboard` and add the upsell banner for free users at project limit.

- [ ] **Step 1: Create `src/app/dashboard/page.tsx`**

Copy the entire content of the current `src/app/page.tsx`, then apply these changes:

1. Change the export name from `HomePage` to `DashboardPage`
2. Change the file's first line to `'use client';` (already there)
3. Replace the `useEffect` auth redirect block (lines 440–445 of the original):

```typescript
// Remove this block entirely — middleware handles redirect now:
// useEffect(() => {
//   if (user === null && typeof window !== 'undefined') {
//     const raw = localStorage.getItem('caleplan_user');
//     if (!raw) router.push('/auth');
//   }
// }, [user, router]);
```

4. Add a `logout` handler that uses the new async `logout` from `uiStore`:

```typescript
const logout = useUiStore((s) => s.logout);

const handleLogout = async () => {
  await logout();
  router.push('/auth');
};
```

5. Replace all calls to the old synchronous `logout` in the JSX with `() => void handleLogout()`.

6. Add an upsell banner. Insert this JSX block **after** the KPIs `<div>` and **before** the Filters `<div>`:

```typescript
{/* Upsell banner for free users at limit */}
{user?.plan === 'free' && projects.length >= 1 && (
  <div className="mb-5 flex items-center justify-between rounded-xl border px-5 py-3" style={{ background: 'var(--accent-l)', borderColor: 'var(--accent)' }}>
    <div>
      <p className="text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>Limite du plan gratuit atteinte</p>
      <p className="text-[12px]" style={{ color: 'var(--accent)' }}>Passez Pro pour créer des projets illimités — 9 €/mois</p>
    </div>
    <a href="/account" className="btn-primary shrink-0 text-[12px] px-4 py-2">Passer Pro →</a>
  </div>
)}
```

7. Update the `handleCreate` error handling to display the upsell banner instead of crashing when `PROJECT_LIMIT_REACHED` is thrown:

```typescript
const handleCreate = async (name: string, client: ClientInfo | undefined) => {
  try {
    const project = await createProject({ name, client });
    router.push(`/project/${project.id}`);
  } catch (err) {
    if (err instanceof Error && err.message === 'PROJECT_LIMIT_REACHED') {
      // Upsell banner already visible — just close the modal
      setShowNewModal(false);
    }
  }
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual test**

Navigate to `http://localhost:3000/dashboard`. Verify:
- Projects list displays
- Upsell banner appears when 1 project exists (free plan)
- Logout redirects to `/auth`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(saas): add protected dashboard with upsell banner"
```

---

## Task 10: Transform `app/page.tsx` into the landing page

**Files:**
- Modify: `src/app/page.tsx`

The current content moves to `dashboard/page.tsx` (Task 9). Now replace it with the marketing landing page.

- [ ] **Step 1: Replace `src/app/page.tsx` entirely**

```typescript
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-4" style={{ borderBottom: '1px solid var(--bdr)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white"/>
              <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="white" fillOpacity=".7"/>
              <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="white"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>CaléPlan</span>
        </div>
        <nav className="flex items-center gap-4">
          <a href="#tarifs" className="text-[13.5px]" style={{ color: 'var(--text2)' }}>Tarifs</a>
          <Link href="/auth" className="text-[13.5px] font-medium" style={{ color: 'var(--text2)' }}>Connexion</Link>
          <Link href="/auth" className="btn-primary text-[13px] px-4 py-2">Commencer gratuitement</Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 rounded-full border px-4 py-1.5 text-[12px] font-semibold" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-l)' }}>
          Outil professionnel pour carreleurs
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }} className="mb-6 max-w-3xl">
          Le calepinage carrelage<br />pour les professionnels
        </h1>
        <p className="mb-10 max-w-xl text-[16px] leading-relaxed" style={{ color: 'var(--text2)' }}>
          Dessinez vos pièces, simulez la pose et obtenez un quantitatif précis en quelques minutes. Sauvegarde cloud automatique.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/auth" className="btn-primary px-7 py-3 text-[15px]">Commencer gratuitement</Link>
          <a href="#fonctions" className="rounded-xl border px-7 py-3 text-[15px] font-medium transition-colors" style={{ borderColor: 'var(--bdr)', color: 'var(--text2)', background: 'var(--surf)' }}>
            Voir les fonctions
          </a>
        </div>
      </main>

      {/* Features */}
      <section id="fonctions" className="px-8 py-16" style={{ borderTop: '1px solid var(--bdr)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }} className="mb-12">
          Tout ce dont vous avez besoin
        </h2>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { emoji: '✏️', title: 'Plan 2D', desc: 'Dessinez vos pièces avec contraintes dimensionnelles, murs, portes et zones exclues.' },
            { emoji: '🏁', title: 'Calepinage', desc: '3 modes de pose : droit, bâton rompu, pointe de hongrie. Rotation et décalage libres.' },
            { emoji: '📦', title: 'Quantitatif', desc: 'Nombre de carreaux, coupes, chutes récupérables, quantité à commander avec marge.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border p-7" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
              <div className="mb-4 text-3xl">{f.emoji}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)' }} className="mb-2">{f.title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text2)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="px-8 py-16" style={{ borderTop: '1px solid var(--bdr)', background: 'var(--surf2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }} className="mb-12">
          Tarifs simples
        </h2>
        <div className="mx-auto flex max-w-2xl flex-col justify-center gap-6 sm:flex-row">
          {[
            {
              name: 'Gratuit', price: '0', period: '', highlight: false,
              features: ['1 projet cloud', 'Toutes les fonctions', 'Sauvegarde automatique'],
              cta: 'Commencer gratuitement',
            },
            {
              name: 'Pro', price: '9', period: '/mois', highlight: true,
              features: ['Projets illimités', 'Toutes les fonctions', 'Sauvegarde automatique', 'Support prioritaire'],
              cta: 'Passer Pro',
            },
          ].map((plan) => (
            <div key={plan.name} className="flex-1 rounded-2xl border p-8" style={{
              background: 'var(--surf)',
              borderColor: plan.highlight ? 'var(--accent)' : 'var(--bdr)',
              borderWidth: plan.highlight ? 2 : 1,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: plan.highlight ? 'var(--accent)' : 'var(--text)' }} className="mb-3">{plan.name}</div>
              <div className="mb-6 flex items-baseline gap-1">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, color: 'var(--text)' }}>{plan.price}€</span>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>{plan.period}</span>
              </div>
              <ul className="mb-8 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13.5px]" style={{ color: 'var(--text2)' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth" className={plan.highlight ? 'btn-primary w-full justify-center py-2.5 text-[14px]' : 'w-full justify-center rounded-xl border py-2.5 text-[14px] font-medium text-center block transition-colors'}
                style={plan.highlight ? {} : { borderColor: 'var(--bdr)', color: 'var(--text2)' }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 text-center text-[12.5px]" style={{ color: 'var(--muted)', borderTop: '1px solid var(--bdr)' }}>
        © {new Date().getFullYear()} CaléPlan · <a href="#" style={{ color: 'var(--muted)' }}>Mentions légales</a> · <a href="#" style={{ color: 'var(--muted)' }}>Contact</a>
      </footer>

    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual test**

Navigate to `http://localhost:3000`. Verify the landing page renders. Click "Commencer gratuitement" → redirects to `/auth`.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(saas): replace home page with public landing page"
```

---

## Task 11: Create the account page

**Files:**
- Create: `src/app/account/page.tsx`

A simple static page showing the user's current plan. Stripe billing management is V2.

- [ ] **Step 1: Create `src/app/account/page.tsx`**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useUiStore } from '@/store/uiStore';

export default function AccountPage() {
  const router = useRouter();
  const user = useUiStore((s) => s.user);
  const logout = useUiStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  const planLabel = user?.plan === 'pro' ? 'Pro' : 'Gratuit';
  const planDesc = user?.plan === 'pro'
    ? 'Projets illimités, sauvegarde cloud automatique.'
    : '1 projet cloud inclus. Passez Pro pour des projets illimités.';

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      <header className="shell-topbar px-6">
        <button type="button" onClick={() => router.push('/dashboard')} className="btn-ghost gap-1.5 text-[13px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Mes projets
        </button>
      </header>

      <main className="mx-auto w-full max-w-lg px-6 py-12">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }} className="mb-8">Mon compte</h1>

        {/* Profile card */}
        <div className="mb-6 rounded-2xl border p-6" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold text-white" style={{ background: 'var(--accent)' }}>
              {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
            </div>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{user?.name ?? '—'}</p>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Plan card */}
        <div className="mb-6 rounded-2xl border p-6" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Plan actuel</h2>
            <span className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={user?.plan === 'pro'
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surf2)', color: 'var(--text2)', border: '1px solid var(--bdr)' }}>
              {planLabel}
            </span>
          </div>
          <p className="mb-5 text-[13px]" style={{ color: 'var(--text2)' }}>{planDesc}</p>
          {user?.plan !== 'pro' && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--accent-l)', borderColor: 'var(--accent)' }}>
              <p className="mb-3 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                Passez Pro — 9 €/mois
              </p>
              <p className="mb-4 text-[12.5px]" style={{ color: 'var(--accent)' }}>
                Projets illimités + sauvegarde cloud. Annulation à tout moment.
              </p>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                Paiement disponible prochainement. Contactez-nous pour un accès anticipé.
              </p>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
          <h2 className="mb-4 text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Session</h2>
          <button type="button" onClick={() => void handleLogout()}
            className="rounded-xl border px-5 py-2.5 text-[13.5px] font-medium transition-colors"
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            Se déconnecter
          </button>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/account/page.tsx
git commit -m "feat(saas): add account page with plan display"
```

---

## Task 12: Delete `lib/db.ts` and clean up imports

**Files:**
- Delete: `src/lib/db.ts`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "from '@/lib/db'" src/
grep -r "from \"@/lib/db\"" src/
```

Expected: no output. If any files still import from `lib/db`, update them to use `@/lib/supabase/db` instead.

- [ ] **Step 2: Verify no remaining imports of `idb`**

```bash
grep -r "from 'idb'" src/
```

Expected: no output.

- [ ] **Step 3: Delete the file**

```bash
rm src/lib/db.ts
```

- [ ] **Step 4: Optionally remove `idb` from dependencies**

```bash
npm uninstall idb
```

- [ ] **Step 5: Full test suite + typecheck**

```bash
npm run typecheck && npm test
```

Expected: no TypeScript errors, all existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(saas): remove IndexedDB layer (lib/db.ts)"
```

---

## Task 13: Final verification and deployment

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS (the 4 original test files + the 2 new ones).

- [ ] **Step 2: Build for production**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 3: Push to GitHub to trigger Vercel deployment**

```bash
git push origin main
```

Vercel auto-deploys. Check the Vercel dashboard for build status.

- [ ] **Step 4: Set environment variables in Vercel**

In the Vercel dashboard → Project → Settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 5: Connect custom domain**

In Vercel → Project → Settings → Domains, add your domain (e.g., `caleplan.fr`). Follow the DNS instructions Vercel provides.

- [ ] **Step 6: Smoke test in production**

1. Visit `https://caleplan.fr` → landing page renders
2. Visit `https://caleplan.fr/dashboard` → redirects to `/auth`
3. Create an account → redirects to `/dashboard`
4. Create a project → opens editor, saves to Supabase
5. Create a second project (free plan) → upsell banner appears

---

## Self-review notes

- **Spec coverage:** All V1 checklist items from the spec are covered across Tasks 1–13.
- **No placeholders:** All code blocks are complete and runnable.
- **Type consistency:** `AuthUser.plan` is `'free' | 'pro'` throughout. `supabaseDb` method signatures match between db.ts, db.test.ts, and projectStore.ts. The `classifyRoute` export in middleware.ts matches its import in middleware.test.ts.
- **`uiStore` backward compatibility:** Components using `user?.plan` expecting `'team'` need updating — the type is now `'free' | 'pro'` only. The `planLabel` in `app/page.tsx` (old dashboard) that had a `'team'` key is replaced entirely in Task 10.
