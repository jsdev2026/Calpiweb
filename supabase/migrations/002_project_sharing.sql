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

CREATE POLICY "locks_select" ON public.project_locks
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
    OR project_id IN (
      SELECT project_id FROM public.project_shares WHERE user_id = auth.uid()
    )
  );

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
