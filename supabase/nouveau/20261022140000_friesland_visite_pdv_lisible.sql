-- ============================================================================
-- UNE VISITE SEULEMENT SUR UN PDV QUE L'ON VOIT DÉJÀ (22/10/2026)
-- PAS ENCORE APPLIQUÉE EN PRODUCTION (attend le oui de Jean Luc).
-- Dépend de 20261022130000 / 20261022131000 (« vos PDV », PR #44) : la
-- fenêtre de tournée ci-dessous reprend leur pdv_ids_tournee.
--
-- Revue de sécurité du 22/10 : visites_insert ne vérifie que
-- auth.uid() = user_id et peut_ecrire_terrain(). Un merchandiser pouvait donc
-- enregistrer une visite sur n'importe quel PDV (son code suffit) :
--   · le PDV devenait lisible par lui 60 jours (pdv_ids_tournee, branche
--     visites → politique pdv_select_tournee) ;
--   · un jour de visite libre ou un pushcart, trg_visite_libre l'ajoutait à
--     sa tournée (lisible aussi par la branche tournée) ;
--   · il comptait dans ses résultats.
-- Valait pour tous les profils, avant « vos PDV ». visites_update laissait de
-- même changer le PDV d'une de ses visites.
--
-- Contrôle (déclencheur BEFORE INSERT OR UPDATE OF pdv_id sur visites) : le PDV
-- doit déjà être lisible par l'agent, sans compter ses visites :
--   1. PDV qu'il a créé (créé sur place puis visité dans la même synchro :
--      la file hors ligne envoie le PDV avant la visite) ;
--   2. PDV de sa tournée du jour de la visite ou de la veille, si ce jour date
--      de moins de 15 jours : visite faite hors ligne et synchronisée plus tard,
--      alors que la tournée d'un merchandiser Atom n'est plus lisible au-delà
--      d'hier. Mesure du 22/10 : le plus long retard de synchro sur 90 jours
--      est de 12,8 jours (99 % des visites arrivent en moins d'une heure) ;
--   3. PDV de ses tournées et règles, comme pdv_ids_tournee (20261022130000)
--      sans la branche visites : Atom = tournées d'hier et à venir, pas de
--      règles ; autres = tournées des 60 derniers jours et règles actives ;
--   4. son périmètre, pdv_ids_perimetre() (calculé en dernier : jusqu'à
--      45 000 PDV pour un profil sans territoire).
-- Pas de contrôle :
--   · admin et superviseur ;
--   · sans utilisateur connecté (auth.uid() nul) : clé service, imports des
--     visites ATOM-…, import_visite_from_csv, cron ;
--   · visite sans PDV ;
--   · rejeu d'une visite déjà reçue (upsert sur visite_id de l'app et de la
--     file hors ligne : le BEFORE INSERT passe avant ON CONFLICT) ; la mise à
--     jour qui suit est contrôlée seulement si le PDV change ;
--   · mise à jour qui ne change pas le PDV (photos, statut…).
-- Refus : erreur 42501, message affiché tel quel par l'app (toast « Erreur »).
-- Hors ligne, la visite reste dans la file du téléphone, rien n'est perdu.
--
-- Mesure du 22/10 (visites faites avec l'app ces 60 derniers jours, PDV lus
-- avec les règles d'aujourd'hui, donc après « vos PDV ») :
--   · admin : 0 refusée sur 1 ; merchandisers Friesland : 0 sur 15 ;
--   · merchandisers Atom actifs : 23 sur 555 (sans le point 2 : 202), sur
--     18 PDV, hors de leur tournée du jour : 21 du 13 au 21/10 (12 le 16/10,
--     jour de la réaffectation), 2 fin septembre. Ces PDV étaient dans leurs
--     territoires ; « vos PDV » ne les montre plus ;
--   · merchandiser Atom désactivé : 4 sur 4, déjà refusées aujourd'hui
--     (peut_ecrire_terrain).
-- Effet dès aujourd'hui : 197 PDV restent affichés à 9 merchandisers Atom
-- parce qu'ils les ont visités (Gui Stéphane 47, Guihi 36, Yao 32, Kouamé 29,
-- Kouadio 16, Abbé 14, Deheo 14, Zogbolou 8, Seregone 1), surtout des PDV de
-- leurs anciennes tournées (jusqu'au 20/10), hors de toute liste validée. Une
-- nouvelle visite sur l'un d'eux sera refusée (y compris un jour de visite
-- libre). À confirmer avec Jean Luc.
--
-- Retour arrière :
--   drop trigger if exists trg_visite_pdv_lisible on public.visites;
-- Idempotente.
-- ============================================================================
begin;

create or replace function public.visite_pdv_lisible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_jour date;
  v_atom boolean;
begin
  -- Clé service (imports, cron) ou visite sans PDV.
  if v_uid is null or new.pdv_id is null then
    return new;
  end if;
  -- Le PDV ne change pas (photos, statut, rejeu de la même visite).
  if tg_op = 'UPDATE' and new.pdv_id is not distinct from old.pdv_id then
    return new;
  end if;
  -- Rejeu d'une visite déjà reçue : l'upsert passera par la mise à jour,
  -- contrôlée ci-dessus si le PDV change, et par visites_update.
  if tg_op = 'INSERT' and exists (select 1 from visites v where v.visite_id = new.visite_id) then
    return new;
  end if;
  if public.role_actif_courant() in ('admin', 'superviseur') then
    return new;
  end if;

  v_jour := (new.date_visite at time zone 'Africa/Abidjan')::date;
  -- Même définition que pdv_ids_tournee et pdv_ids_perimetre.
  select coalesce(pr.role = 'merchandiser' and pr.employeur = 'atom'
                  and coalesce(pr.email, '') not like '%@friesland-test.ci', false)
  into v_atom
  from profiles pr where pr.id = v_uid and pr.is_active = true;
  v_atom := coalesce(v_atom, false);

  -- Du moins cher au plus cher ; s'arrête au premier trouvé.
  if exists (select 1 from pdv p where p.pdv_id = new.pdv_id and p.created_by = v_uid)
     -- Sa tournée du jour de la visite (synchronisée en retard).
     or (v_jour >= current_date - 15 and exists (
           select 1 from routings r
           join routing_pdv rp on rp.routing_id = r.id
           where r.user_id = v_uid and rp.pdv_id = new.pdv_id
             and r.date_routing between v_jour - 1 and v_jour))
     -- Ses tournées, comme pdv_ids_tournee sans les visites.
     or exists (
           select 1 from routings r
           join routing_pdv rp on rp.routing_id = r.id
           where r.user_id = v_uid and rp.pdv_id = new.pdv_id
             and r.date_routing >= case when v_atom then current_date - 1 else current_date - 60 end)
     or (not v_atom and exists (
           select 1 from routing_templates t
           join routing_template_pdv tp on tp.template_id = t.id
           where t.user_id = v_uid and t.is_active and tp.pdv_id = new.pdv_id))
     -- Son périmètre (territoires, ou sa liste pour un merchandiser Atom).
     or exists (select 1 from public.pdv_ids_perimetre() x where x = new.pdv_id)
  then
    return new;
  end if;

  raise exception 'Ce PDV n''est pas dans vos PDV : la visite n''est pas enregistrée (PDV %).', new.pdv_id
    using errcode = 'insufficient_privilege',
          hint = 'Choisissez un PDV de votre liste, ou créez le PDV sur place.';
end;
$$;

revoke all on function public.visite_pdv_lisible() from public, anon, authenticated;

drop trigger if exists trg_visite_pdv_lisible on public.visites;
create trigger trg_visite_pdv_lisible
  before insert or update of pdv_id on public.visites
  for each row execute function public.visite_pdv_lisible();

commit;
