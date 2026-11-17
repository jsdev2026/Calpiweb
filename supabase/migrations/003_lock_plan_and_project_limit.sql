-- ============================================================
-- CaléPlan — Lot 0 : sécurisation des forfaits et de la limite de projets
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- ⚠️ ORDRE DE DÉPLOIEMENT OBLIGATOIRE
--   1. Déployer d'abord le code de la PR « Lot 0 » (db.save n'utilise plus d'upsert).
--   2. Exécuter ensuite ce script.
--   Avec l'ancien code, l'upsert déclencherait la politique INSERT ci-dessous à chaque
--   sauvegarde et les utilisateurs gratuits ne pourraient plus enregistrer.
-- ============================================================

-- 1. profiles : le client ne peut plus modifier plan / project_credits / stripe_customer_id
--    (avant : la politique profiles_update_own autorisait la modification de toutes les colonnes,
--     n'importe quel utilisateur pouvait se passer « pro » depuis la console du navigateur).
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Droit de créer un projet, calculé en base.
--    Seuls les projets POSSÉDÉS comptent (pas ceux partagés avec l'utilisateur).
--    Limite gratuite = 1 projet + crédits projet achetés ; « pro » = illimité.
--    SECURITY DEFINER : lit profiles / projects sans repasser par la RLS (pas de récursion).
CREATE OR REPLACE FUNCTION public.can_create_project(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.plan = 'pro'
            OR (SELECT count(*) FROM public.projects pr WHERE pr.user_id = uid) < 1 + p.project_credits
       FROM public.profiles p
      WHERE p.id = uid),
    (SELECT count(*) FROM public.projects pr WHERE pr.user_id = uid) < 1
  );
$$;

REVOKE ALL ON FUNCTION public.can_create_project(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_create_project(uuid) TO authenticated;

-- 3. La base refuse elle-même la création d'un projet au-delà de la limite
--    (avant : la limite n'existait que dans le bouton du tableau de bord).
DROP POLICY IF EXISTS "projects_insert_own" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_within_limit" ON public.projects;
CREATE POLICY "projects_insert_within_limit" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.can_create_project(auth.uid())
  );

-- 4. Le propriétaire d'un projet ne peut plus changer
--    (avant : l'upsert de db.save réécrivait user_id ; un éditeur invité qui enregistrait
--     un projet partagé en devenait propriétaire).
CREATE OR REPLACE FUNCTION public.prevent_project_owner_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'project owner cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_owner_immutable ON public.projects;
CREATE TRIGGER projects_owner_immutable
  BEFORE UPDATE OF user_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_project_owner_change();

-- ============================================================
-- Vérifications après exécution (à lancer à part, résultats attendus en commentaire)
-- ============================================================
-- Droits sur profiles : seule la colonne display_name doit apparaître pour UPDATE
--   SELECT column_name FROM information_schema.column_privileges
--    WHERE table_schema = 'public' AND table_name = 'profiles'
--      AND grantee = 'authenticated' AND privilege_type = 'UPDATE';
--
-- Utilisateurs gratuits ayant déjà plus de projets que leur limite (conservés, mais ne pourront
-- plus en créer — voir la décision « utilisateurs existants » du plan paywall) :
--   SELECT p.id, p.email, p.project_credits, count(pr.id) AS projets
--     FROM public.profiles p JOIN public.projects pr ON pr.user_id = p.id
--    WHERE p.plan <> 'pro'
--    GROUP BY p.id HAVING count(pr.id) > 1 + p.project_credits;
--
-- Comptes « pro » (à comparer avec les accès accordés manuellement pendant la bêta —
-- un compte inattendu peut s'être attribué le forfait via l'ancienne faille) :
--   SELECT id, email, updated_at FROM public.profiles WHERE plan = 'pro' ORDER BY updated_at DESC;
