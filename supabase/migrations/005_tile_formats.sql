-- ============================================================
-- CaléPlan — Formats de carreaux personnalisés (Calepinage)
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Ordre : peut être exécuté AVANT ou APRÈS le déploiement du code (additif).
-- Tant qu'il n'est pas exécuté, les formats sont gardés sur l'appareil uniquement
-- (pas de synchronisation entre ordinateur et smartphone).
-- ============================================================

-- Liste des formats proposés dans le Calepinage : [[largeur_mm, longueur_mm], …]
-- NULL = formats par défaut de l'application.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tile_formats jsonb;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tile_formats_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tile_formats_check
  CHECK (
    tile_formats IS NULL
    OR (jsonb_typeof(tile_formats) = 'array' AND jsonb_array_length(tile_formats) <= 40)
  );

-- Modifiable par l'utilisateur (s'ajoute aux colonnes autorisées par la migration 004)
GRANT UPDATE (tile_formats) ON public.profiles TO authenticated;
