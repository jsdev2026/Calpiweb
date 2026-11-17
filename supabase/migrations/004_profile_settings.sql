-- ============================================================
-- CaléPlan — Paramètres utilisateur : profil, entreprise, préférences,
-- demandes de contact, logo, suppression de compte
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Ordre : peut être exécuté AVANT ou APRÈS le déploiement du code (tout est additif).
-- Tant qu'il n'est pas exécuté, la page Paramètres affiche une erreur à l'enregistrement.
-- ============================================================

-- 1. Nouvelles colonnes du profil (toutes facultatives)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name             text,
  ADD COLUMN IF NOT EXISTS last_name              text,
  ADD COLUMN IF NOT EXISTS phone                  text,
  ADD COLUMN IF NOT EXISTS profile_type           text,
  ADD COLUMN IF NOT EXISTS company_name           text,
  ADD COLUMN IF NOT EXISTS siret                  text,
  ADD COLUMN IF NOT EXISTS vat_number             text,
  ADD COLUMN IF NOT EXISTS address_line           text,
  ADD COLUMN IF NOT EXISTS postal_code            text,
  ADD COLUMN IF NOT EXISTS city                   text,
  ADD COLUMN IF NOT EXISTS intervention_area      text,
  ADD COLUMN IF NOT EXISTS company_size           text,
  ADD COLUMN IF NOT EXISTS monthly_jobs           text,
  ADD COLUMN IF NOT EXISTS acquisition_source     text,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in_at   timestamptz,
  ADD COLUMN IF NOT EXISTS logo_path              text,
  ADD COLUMN IF NOT EXISTS default_tile_config    jsonb,
  ADD COLUMN IF NOT EXISTS default_wall_thickness int;

-- Valeurs contrôlées
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_type_check
  CHECK (profile_type IS NULL OR profile_type IN
    ('artisan', 'entreprise', 'architecte', 'negoce', 'particulier', 'autre'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_company_size_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_size_check
  CHECK (company_size IS NULL OR company_size IN ('1', '2-5', '6-20', '20+'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_wall_thickness_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_wall_thickness_check
  CHECK (default_wall_thickness IS NULL OR default_wall_thickness BETWEEN 50 AND 1000);

-- 2. Colonnes modifiables par l'utilisateur (plan, project_credits, stripe_customer_id,
--    email restent verrouillés — cf. migration 003)
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  display_name, first_name, last_name, phone, profile_type,
  company_name, siret, vat_number, address_line, postal_code, city,
  intervention_area, company_size, monthly_jobs, acquisition_source,
  newsletter_opt_in, logo_path, default_tile_config, default_wall_thickness
) ON public.profiles TO authenticated;

-- 3. Horodatage : updated_at + preuve de consentement newsletter (RGPD)
CREATE OR REPLACE FUNCTION public.profiles_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.newsletter_opt_in IS DISTINCT FROM OLD.newsletter_opt_in THEN
    NEW.newsletter_opt_in_at := CASE WHEN NEW.newsletter_opt_in THEN now() ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_touch();

-- 4. Inscription : les informations saisies dans le formulaire (métadonnées) remplissent le profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  ptype text := NULLIF(meta->>'profile_type', '');
  opt_in boolean := COALESCE((meta->>'newsletter_opt_in')::boolean, false);
BEGIN
  IF ptype IS NOT NULL AND ptype NOT IN
     ('artisan', 'entreprise', 'architecte', 'negoce', 'particulier', 'autre') THEN
    ptype := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, email, display_name, first_name, last_name, phone, profile_type, company_name,
    acquisition_source, newsletter_opt_in, newsletter_opt_in_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(meta->>'full_name', ''), NULLIF(meta->>'name', '')),
    NULLIF(meta->>'first_name', ''),
    NULLIF(meta->>'last_name', ''),
    NULLIF(meta->>'phone', ''),
    ptype,
    NULLIF(meta->>'company_name', ''),
    NULLIF(meta->>'acquisition_source', ''),
    opt_in,
    CASE WHEN opt_in THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = EXCLUDED.display_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Changement d'adresse e-mail (après confirmation) → recopié dans profiles
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles SET email = new.email WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_profile_email();

-- 6. Demandes de contact (onglet « Contact »)
CREATE TABLE IF NOT EXISTS public.support_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category      text NOT NULL CHECK (category IN ('question', 'bug', 'suggestion', 'facturation', 'autre')),
  message       text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  contact_email text,
  status        text NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'traite')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_select_own" ON public.support_requests;
DROP POLICY IF EXISTS "support_insert_own" ON public.support_requests;
CREATE POLICY "support_select_own" ON public.support_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "support_insert_own" ON public.support_requests
  FOR INSERT WITH CHECK (user_id = auth.uid() AND status = 'nouveau');
-- Pas de politique UPDATE / DELETE : seul l'administrateur (tableau de bord Supabase) change le statut.

-- 7. Logos d'entreprise (Storage) : bucket public en lecture, chacun écrit dans son dossier <user_id>/
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "logos_delete_own" ON storage.objects;
CREATE POLICY "logos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "logos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "logos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Suppression de compte par l'utilisateur (droit à l'effacement RGPD)
--    Supprime auth.users → cascade sur profiles → projets, partages, demandes.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ============================================================
-- Consulter les demandes de contact (à lancer à part) :
--   SELECT r.created_at, r.category, r.status, p.email, p.first_name, p.last_name, r.message
--     FROM public.support_requests r JOIN public.profiles p ON p.id = r.user_id
--    ORDER BY r.created_at DESC;
-- Marquer une demande comme traitée :
--   UPDATE public.support_requests SET status = 'traite' WHERE id = '<id>';
-- ============================================================
