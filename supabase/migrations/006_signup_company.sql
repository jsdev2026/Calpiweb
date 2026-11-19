-- 006 — Compte professionnel : les informations de la société saisies à l'inscription
-- (SIRET, n° de TVA, adresse) sont recopiées dans le profil, comme le nom de la société.
-- Sans danger à relancer (CREATE OR REPLACE). Aucune nouvelle colonne : elles existent
-- depuis la migration 004.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
  ptype text := NULLIF(meta->>'profile_type', '');
  opt_in boolean := COALESCE((meta->>'newsletter_opt_in')::boolean, false);
  v_siret text := regexp_replace(COALESCE(meta->>'siret', ''), '[^0-9]', '', 'g');
  v_vat text := upper(regexp_replace(COALESCE(meta->>'vat_number', ''), '\s', '', 'g'));
  v_postal text := btrim(COALESCE(meta->>'postal_code', ''));
BEGIN
  IF ptype IS NOT NULL AND ptype NOT IN
     ('artisan', 'entreprise', 'architecte', 'negoce', 'particulier', 'autre') THEN
    ptype := NULL;
  END IF;
  -- Valeurs mal formées ignorées (l'utilisateur pourra les corriger dans Paramètres)
  IF v_siret !~ '^[0-9]{14}$' THEN v_siret := NULL; END IF;
  IF v_vat !~ '^[A-Z]{2}[0-9A-Z]{2,13}$' THEN v_vat := NULL; END IF;
  IF v_postal !~ '^[0-9]{5}$' THEN v_postal := NULL; END IF;

  INSERT INTO public.profiles (
    id, email, display_name, first_name, last_name, phone, profile_type, company_name,
    siret, vat_number, address_line, postal_code, city,
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
    NULLIF(btrim(meta->>'company_name'), ''),
    v_siret,
    v_vat,
    NULLIF(btrim(meta->>'address_line'), ''),
    v_postal,
    NULLIF(btrim(meta->>'city'), ''),
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
