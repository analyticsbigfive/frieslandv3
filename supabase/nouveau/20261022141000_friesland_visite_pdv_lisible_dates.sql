-- ============================================================================
-- CONTRÔLE DES VISITES : LA DATE NE PROLONGE PLUS L'ACCÈS (22/10/2026)
-- Suite de 20261022140000_friesland_visite_pdv_lisible (appliquée le 22/10).
-- APPLIQUÉE EN PRODUCTION le 22/10/2026 (MCP, apply_migration).
--
-- Revue de sécurité de 20261022140000 : la date de la visite vient du
-- téléphone, donc de l'agent.
--   1. PDV déjà visités (choix B) : la comparaison jusqu_au >= least(aujourd'hui,
--      jour de la visite) laissait une visite antidatée passer après le délai
--      de 60 jours. Maintenant : délai pas dépassé, ou visite d'au plus
--      15 jours (synchro hors ligne, comme la tournée du jour) faite avant
--      la fin du délai.
--   2. Une visite datée dans le futur rendait le PDV lisible jusqu'à cette
--      date + 60 jours (pdv_ids_tournee, branche visites). Refusée au-delà
--      d'un jour (heure du téléphone). Mesure du 22/10 : aucune visite de
--      l'app n'a jamais été datée après son envoi.
--   3. Changer la date d'une visite est contrôlé comme changer son PDV (l'app
--      ne modifie jamais la date ; le rejeu garde la même date).
-- La liste figée (visite_pdv_deja_visites) est déjà bornée : dernière date
-- limite le 21/12/2026, aucune visite datée dans le futur.
-- Idempotente.
-- ============================================================================
begin;

create or replace function public.peut_visiter_pdv(p_pdv_id text, p_jour date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_atom boolean;
begin
  if v_uid is null then
    return false;
  end if;
  -- Même définition que pdv_ids_tournee et pdv_ids_perimetre.
  select coalesce(pr.role = 'merchandiser' and pr.employeur = 'atom'
                  and coalesce(pr.email, '') not like '%@friesland-test.ci', false)
  into v_atom
  from profiles pr where pr.id = v_uid and pr.is_active = true;
  v_atom := coalesce(v_atom, false);

  -- Du moins cher au plus cher ; s'arrête au premier trouvé.
  return exists (select 1 from pdv p where p.pdv_id = p_pdv_id and p.created_by = v_uid)
    -- Déjà visité avant le contrôle (choix B) : délai pas dépassé, ou visite
    -- faite avant la fin du délai et synchronisée en retard (15 jours).
    or exists (select 1 from visite_pdv_deja_visites d
               where d.user_id = v_uid and d.pdv_id = p_pdv_id
                 and (d.jusqu_au >= current_date
                      or (p_jour >= current_date - 15 and d.jusqu_au >= p_jour)))
    -- Sa tournée du jour de la visite (synchronisée en retard).
    or (p_jour >= current_date - 15 and exists (
          select 1 from routings r
          join routing_pdv rp on rp.routing_id = r.id
          where r.user_id = v_uid and rp.pdv_id = p_pdv_id
            and r.date_routing between p_jour - 1 and p_jour))
    -- Ses tournées, comme pdv_ids_tournee sans les visites.
    or exists (
          select 1 from routings r
          join routing_pdv rp on rp.routing_id = r.id
          where r.user_id = v_uid and rp.pdv_id = p_pdv_id
            and r.date_routing >= case when v_atom then current_date - 1 else current_date - 60 end)
    or (not v_atom and exists (
          select 1 from routing_templates t
          join routing_template_pdv tp on tp.template_id = t.id
          where t.user_id = v_uid and t.is_active and tp.pdv_id = p_pdv_id))
    -- Son périmètre (territoires, ou sa liste pour un merchandiser Atom).
    or exists (select 1 from public.pdv_ids_perimetre() x where x = p_pdv_id);
end;
$$;

create or replace function public.visite_pdv_lisible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clé service (imports, cron) ou visite sans PDV.
  if auth.uid() is null or new.pdv_id is null then
    return new;
  end if;
  -- Ni le PDV ni la date ne changent (photos, statut, rejeu de la même visite).
  if tg_op = 'UPDATE' and new.pdv_id is not distinct from old.pdv_id
     and new.date_visite is not distinct from old.date_visite then
    return new;
  end if;
  -- Rejeu d'une visite déjà reçue : l'upsert passera par la mise à jour,
  -- contrôlée ci-dessus si le PDV ou la date change, et par visites_update.
  if tg_op = 'INSERT' and exists (select 1 from visites v where v.visite_id = new.visite_id) then
    return new;
  end if;
  if public.role_actif_courant() in ('admin', 'superviseur') then
    return new;
  end if;

  -- Datée dans le futur : le PDV resterait lisible jusqu'à cette date + 60 jours.
  if new.date_visite > now() + interval '1 day' then
    raise exception 'La date de la visite est dans le futur : la visite n''est pas enregistrée.'
      using errcode = 'insufficient_privilege',
            hint = 'Vérifiez la date et l''heure du téléphone.';
  end if;

  if public.peut_visiter_pdv(new.pdv_id, (new.date_visite at time zone 'Africa/Abidjan')::date) then
    return new;
  end if;

  raise exception 'Ce PDV n''est pas dans vos PDV : la visite n''est pas enregistrée (PDV %).', new.pdv_id
    using errcode = 'insufficient_privilege',
          hint = 'Choisissez un PDV de votre liste, ou créez le PDV sur place.';
end;
$$;

revoke all on function public.peut_visiter_pdv(text, date) from public, anon, authenticated;
grant execute on function public.peut_visiter_pdv(text, date) to service_role;
revoke all on function public.visite_pdv_lisible() from public, anon, authenticated;

drop trigger if exists trg_visite_pdv_lisible on public.visites;
create trigger trg_visite_pdv_lisible
  before insert or update of pdv_id, date_visite on public.visites
  for each row execute function public.visite_pdv_lisible();

commit;
