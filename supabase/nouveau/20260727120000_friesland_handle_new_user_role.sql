-- 20260727120000_friesland_handle_new_user_role.sql
-- Le trigger posait role = 'merchandiser' en dur et ignorait raw_user_meta_data->>'role' :
-- le rôle choisi dans le formulaire admin était perdu à la création du compte.
-- On lit désormais la métadonnée, avec repli sur 'merchandiser' si absente ou invalide
-- (la contrainte profiles_role_check rejetterait toute autre valeur).
-- ON CONFLICT DO NOTHING : la route /api/admin/users complète le profil juste après,
-- le trigger ne doit pas faire échouer la création si la ligne existe déjà.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nom, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'superviseur', 'merchandiser', 'commercial')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'merchandiser'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
