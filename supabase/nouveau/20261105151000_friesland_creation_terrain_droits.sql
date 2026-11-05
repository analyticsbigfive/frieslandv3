-- ============================================================================
-- DROITS DES FONCTIONS DE 20261105150000 (relecture de sécurité du 05/11)
--
-- 1. corriger_pdv_terrain et noter_correction_terrain sont SECURITY DEFINER :
--    appelées en RPC, la première lisait le routing et les PDV voisins de
--    n'importe quel compte, la seconde écrivait dans le journal. Elles ne
--    servent qu'au trigger (qui tourne avec les droits du propriétaire) :
--    plus aucun rôle client ne peut les exécuter.
-- 2. pdv_creation_terrain ne corrige que la boutique dont created_by est le
--    compte connecté (ou une écriture serveur, sans compte) : un created_by
--    envoyé pour quelqu'un d'autre ne lui applique pas le routing d'autrui.
-- ============================================================================
begin;

revoke all on function public.corriger_pdv_terrain(public.pdv) from public, anon, authenticated;
revoke all on function public.noter_correction_terrain(public.pdv, public.pdv, text) from public, anon, authenticated;
revoke all on function public.pdv_creation_terrain() from public, anon, authenticated;

create or replace function public.pdv_creation_terrain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corrige public.pdv;
begin
  if new.created_by is null
     or (auth.uid() is not null and new.created_by is distinct from auth.uid()) then
    return new;
  end if;
  -- Une erreur ici ne doit jamais empêcher la boutique d'être enregistrée.
  begin
    v_corrige := corriger_pdv_terrain(new);
    perform noter_correction_terrain(new, v_corrige, 'creation');
    new := v_corrige;
  exception when others then
    raise warning 'pdv_creation_terrain % : %', new.pdv_id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.pdv_creation_terrain() from public, anon, authenticated;

commit;
