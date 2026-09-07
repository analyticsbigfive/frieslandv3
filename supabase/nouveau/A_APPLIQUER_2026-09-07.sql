-- =============================================================================
-- LOT COMBINÉ — à exécuter dans le SQL Editor du projet iirgolfjwdnnesamzcbd
-- Généré le 2026-09-07. Contient, dans l ordre :
--   1. 20260910120200 cloisonnement : politiques de lecture déterministes
--   2. 20260910130000 périmètre de suivi et alertes utilisables
--   3. 20260910140000 recalcul Perfect Store par lot
--   4. 20260910150000 get_visites_filtered : pagination
--
-- Chaque migration a son propre begin/commit : elles sont INDÉPENDANTES.
-- Si l une échoue, les précédentes restent appliquées — toutes sont
-- idempotentes, il suffit de corriger et de relancer le fichier entier.
-- =============================================================================


-- ###########################################################################
-- ### 20260910120200_friesland_cloisonnement_policies_deterministes.sql
-- ###########################################################################

-- ============================================================================
-- CLOISONNEMENT : rendre les politiques de LECTURE déterministes
--
-- Constat après application de 20260910120000, avec le compte
-- qa.merchandiser@friesland-test.ci :
--   - public.pdv_dans_perimetre() renvoie bien FALSE pour un merchandiseur
--     (vérifié par appel RPC direct) ;
--   - mais il lit toujours LES DEUX actions en base, dont une qui ne lui est
--     ni assignée ni imputable.
--
-- Une seule explication tient : il existe sur `action_commerciale` une
-- politique SELECT permissive supplémentaire, posée hors dépôt. Les politiques
-- PERMISSIVE se combinent en OR — une seule suffit à tout rouvrir. Le même
-- précédent est documenté pour `visites` en tête de 20260907140100 :
-- « politique posée hors dépôt, nom inconnu ».
--
-- On ne peut pas la nommer depuis le dépôt : `pg_policies` n'est pas exposée
-- par PostgREST. Cette migration ne devine donc rien — elle ÉNUMÈRE les
-- politiques réellement présentes, retire toutes celles qui gouvernent la
-- lecture (SELECT et ALL), et redéclare l'ensemble complet voulu. L'état final
-- ne dépend plus de ce qui traînait avant.
--
-- Les noms retirés sont affichés en NOTICE : les conserver, ils documentent ce
-- qui existait réellement en base.
--
-- Idempotent. Rejouable sans effet de bord.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Purge des politiques de lecture posées hors dépôt
-- ---------------------------------------------------------------------------
-- `ALL` couvre aussi l'écriture : les politiques d'écriture voulues sont
-- redéclarées intégralement plus bas, rien n'est perdu.
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and tablename in ('action_commerciale', 'field_coaching')
      and cmd in ('SELECT', 'ALL')
  loop
    raise notice 'Politique retirée : %.% → "%" (%)', r.schemaname, r.tablename, r.policyname, r.cmd;
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    n := n + 1;
  end loop;
  raise notice '% politique(s) de lecture retirée(s).', n;
end $$;

-- ---------------------------------------------------------------------------
-- 2) action_commerciale : jeu complet et unique
-- ---------------------------------------------------------------------------
alter table public.action_commerciale enable row level security;

-- Lecture. Le merchandiseur ne passe que par `assigne_a` ou `auteur_id` :
-- pdv_dans_perimetre() est faux pour lui depuis 20260910120000. Il voit donc
-- exactement « les actions qu'il doit réaliser ».
create policy action_commerciale_select on public.action_commerciale
  for select to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.pdv_dans_perimetre(pdv_id)
  );

-- Écriture : identique au lot 3 (20260907150000:137-163), redéclarée pour que
-- le jeu de politiques soit complet même si une politique ALL a été retirée.
drop policy if exists action_commerciale_insert on public.action_commerciale;
create policy action_commerciale_insert on public.action_commerciale
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and public.role_actif_courant() in ('commercial', 'admin', 'superviseur')
    and public.pdv_dans_perimetre(pdv_id)
  );

drop policy if exists action_commerciale_update on public.action_commerciale;
create policy action_commerciale_update on public.action_commerciale
  for update to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  )
  with check (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  );

drop policy if exists action_commerciale_delete on public.action_commerciale;
create policy action_commerciale_delete on public.action_commerciale
  for delete to authenticated
  using (public.role_actif_courant() = 'admin');

-- ---------------------------------------------------------------------------
-- 3) field_coaching : jeu complet et unique
-- ---------------------------------------------------------------------------
alter table public.field_coaching enable row level security;

-- Le test de rôle est redondant avec pdv_dans_perimetre() : c'est voulu. Le
-- coaching évalue des personnes, il ne doit pas pouvoir se rouvrir par une
-- évolution de la fonction partagée avec les actions.
create policy field_coaching_select on public.field_coaching
  for select to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or superviseur_id = auth.uid()
    or (
      public.role_actif_courant() in ('commercial', 'superviseur', 'admin')
      and public.pdv_dans_perimetre(pdv_id)
    )
  );

-- Écriture : identique au lot 4 (20260907160000:100-113).
drop policy if exists field_coaching_insert on public.field_coaching;
create policy field_coaching_insert on public.field_coaching
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and public.role_actif_courant() in ('superviseur', 'commercial', 'admin')
  );

drop policy if exists field_coaching_update on public.field_coaching;
create policy field_coaching_update on public.field_coaching
  for update to authenticated
  using (
    auteur_id = auth.uid() or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  )
  with check (
    auteur_id = auth.uid() or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin', 'superviseur')
  );

drop policy if exists field_coaching_delete on public.field_coaching;
create policy field_coaching_delete on public.field_coaching
  for delete to authenticated
  using (public.role_actif_courant() = 'admin');

commit;

-- ###########################################################################
-- ### 20260910130000_friesland_perimetre_suivi_alertes.sql
-- ###########################################################################

-- ============================================================================
-- PÉRIMÈTRE DE SUIVI ET ALERTES UTILISABLES (demande du 7 septembre 2026)
--
-- Constat mesuré le 7 sept. sur les 37 zones : `synthese_zones_filtre` rend
-- `alertes = pdv_total` PARTOUT. Le parc compte 25 391 PDV alors que 3 666
-- seulement ont été visités au moins une fois en douze mois : les 21 725
-- jamais visités noient le signal, l'indicateur ne désigne plus rien.
--
-- Décision client : les alertes portent sur les PDV DÉJÀ SUIVIS — visités au
-- moins une fois sur une fenêtre glissante (12 mois par défaut, paramétrable).
-- Les jamais-visités deviennent un compteur « à prospecter », distinct.
--
-- Cette migration :
--  1) crée `parametre_suivi` (+ CRUD admin) et `fenetre_suivi_mois()` ;
--  2) ajoute une colonne `suivi` aux deux RPC PLUTÔT qu'une 4e valeur à `etat` :
--     l'union 'a_jour' | 'en_retard' | 'jamais_visite' est miroir en trois
--     endroits côté client (usePerfectStore.ts:46, utils/actionsCommerciales.ts:52,
--     zones.vue) et sert de valeur au paramètre `p_etat` — l'élargir casserait
--     chaque `switch` ;
--  3) corrige le DOUBLE RÉFÉRENTIEL TEMPOREL. Jusqu'ici, sur une même ligne,
--     `pdv_visites` / `dispo_moyenne` / `perfect_store_pct` suivaient la période
--     choisie tandis que `a_jour` / `en_retard` / `jamais_visites` étaient
--     figés sur `current_date` : deux horloges dans un même tableau. Désormais
--     tout est calculé à `coalesce(p_date_fin, current_date)`.
--     La borne BASSE n'est volontairement pas appliquée à la dernière visite :
--     un PDV vu la veille de la période paraîtrait « jamais visité ». La borne
--     basse pertinente est la fenêtre de suivi, horizon distinct et plus long.
--  4) expose `derniere_visite_statut` (soumis / validé / rejeté), demandé pour
--     la liste PDV mobile.
--
-- ATTENTION : `create or replace function` ne sait pas ajouter un paramètre —
-- il crée une SECONDE surcharge, et PostgREST échoue ensuite en PGRST203
-- (« could not choose the best candidate function ») puisque tous les
-- arguments ont une valeur par défaut. D'où le `drop function <signature
-- exacte>` avant chaque `create` (même motif qu'en 20260730120000:20-24).
--
-- Les nouveaux paramètres ayant tous une valeur par défaut, le front actuel
-- continue de fonctionner sans modification.
--
-- Idempotent. Additif (aucune suppression de données).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Paramètre de fenêtre de suivi
-- ---------------------------------------------------------------------------
-- Table dédiée plutôt qu'une colonne sur `frequence_visite` : cette dernière
-- porte un nombre de JOURS entre deux visites, par zone et type de PDV, avec
-- une clé (zone, type_pdv). Y loger une fenêtre globale en MOIS demanderait une
-- ligne magique, illisible pour qui édite le référentiel.
create table if not exists parametre_suivi (
  cle     text primary key check (cle in ('fenetre_suivi_mois')),
  valeur  integer not null check (valeur > 0),
  libelle text not null,
  aide    text
);

comment on table parametre_suivi is
  'Paramètres de pilotage du suivi. fenetre_suivi_mois : au-delà de ce nombre de mois sans visite, un PDV sort des alertes et bascule dans « à prospecter ».';

alter table parametre_suivi enable row level security;
drop policy if exists parametre_suivi_read on parametre_suivi;
create policy parametre_suivi_read on parametre_suivi
  for select to authenticated using (true);
drop policy if exists parametre_suivi_write on parametre_suivi;
create policy parametre_suivi_write on parametre_suivi
  for all to authenticated
  using (est_gestionnaire_perfect_store())
  with check (est_gestionnaire_perfect_store());

insert into parametre_suivi (cle, valeur, libelle, aide)
select 'fenetre_suivi_mois', 12,
       'Fenêtre de suivi (mois)',
       'Un PDV visité au moins une fois dans cette fenêtre est « suivi » et compte dans les alertes. Au-delà, il bascule dans « à prospecter ».'
where not exists (select 1 from parametre_suivi where cle = 'fenetre_suivi_mois');

-- `coalesce` : si la ligne venait à disparaître, les RPC continuent de répondre.
create or replace function fenetre_suivi_mois()
returns integer
language sql stable
set search_path = public
as $$
  select coalesce((select valeur from parametre_suivi where cle = 'fenetre_suivi_mois'), 12);
$$;

-- ---------------------------------------------------------------------------
-- 2) Fraîcheur par PDV : une seule horloge, colonne `suivi`, statut de visite
-- ---------------------------------------------------------------------------
drop function if exists pdv_fraicheur_filtre(text, text, text, text, text);

create or replace function pdv_fraicheur_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_etat text default null,
  p_date_fin date default null,
  p_fenetre_mois integer default null,
  p_suivi boolean default null
) returns table(
  pdv_id text,
  nom_pdv text,
  zone text,
  quartier text,
  sous_categorie_pdv text,
  distributor_name text,
  derniere_visite timestamptz,
  derniere_visite_statut text,
  jours_depuis integer,
  frequence_jours integer,
  etat text,
  suivi boolean,
  niveau text,
  score_global numeric,
  visite_id uuid
)
language plpgsql stable
set search_path = public
as $$
declare
  v_ref     date := coalesce(p_date_fin, current_date);
  v_fenetre integer := coalesce(p_fenetre_mois, fenetre_suivi_mois());
begin
  return query
  -- plpgsql et non sql : une fonction SQL planifie sur des paramètres
  -- génériques et choisissait des nested loops (7 s à 70 s selon les bornes) ;
  -- plpgsql planifie avec les valeurs réelles. `materialized` évite en plus
  -- l'inlining des CTE référencées une fois. Mesuré : ~0,35 s réseau entier.
  with scope_pdv as materialized (
    select p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.sous_categorie_pdv, p.distributor_name,
           (select f.jours from frequence_visite f
             where (f.zone is null or f.zone = p.zone)
               and (f.type_pdv is null or f.type_pdv = p.sous_categorie_pdv)
             order by (f.zone is not null)::int + (f.type_pdv is not null)::int desc,
                      (f.type_pdv is not null)::int desc
             limit 1) as frequence_jours
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where coalesce(p.is_active, true)
      and (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  -- Sur TOUTES les visites (26k lignes, agrégat trivial), jointes ensuite au
  -- périmètre par hash. Un « where pdv_id in (select … from scope_pdv) » ici
  -- devenait un nested loop × CTE scan dans la fonction (26k × 25k = 70 s).
  -- Bornée PAR LE HAUT seulement : voir l'en-tête, point 3.
  derniere as materialized (
    select distinct on (v.pdv_id) v.pdv_id, v.id as visite_id, v.date_visite, v.status
    from visites v
    where p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz
    order by v.pdv_id, v.date_visite desc
  ),
  etat as materialized (
    select s.*, d.visite_id, d.date_visite, d.status,
           case when d.date_visite is null then null
                else (v_ref - d.date_visite::date) end as jours_depuis,
           case
             when d.date_visite is null then 'jamais_visite'
             when (v_ref - d.date_visite::date) > coalesce(s.frequence_jours, 7) then 'en_retard'
             else 'a_jour'
           end as etat,
           coalesce(d.date_visite::date >= (v_ref - make_interval(months => v_fenetre)), false) as suivi
    from scope_pdv s
    left join derniere d on d.pdv_id = s.pdv_id
  )
  select e.pdv_id, e.nom_pdv, e.zone, e.quartier, e.sous_categorie_pdv, e.distributor_name,
         e.date_visite, e.status, e.jours_depuis, e.frequence_jours, e.etat, e.suivi,
         r.niveau, r.score_global, e.visite_id
  from etat e
  left join resultat_perfect_store r on r.visite_id = e.visite_id
  where (p_etat is null or p_etat = '' or e.etat = p_etat)
    and (p_suivi is null or e.suivi = p_suivi)
  order by case e.etat when 'jamais_visite' then 0 when 'en_retard' then 1 else 2 end,
           e.jours_depuis desc nulls first, e.nom_pdv;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Synthèse par zone : alertes sur les PDV suivis, « à prospecter » à part
-- ---------------------------------------------------------------------------
drop function if exists synthese_zones_filtre(text, text, text, text, date, date);

create or replace function synthese_zones_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null,
  p_fenetre_mois integer default null
) returns table(
  zone text,
  pdv_total bigint,
  pdv_visites bigint,
  pdv_non_visites bigint,
  pdv_suivis bigint,
  a_prospecter bigint,
  a_jour bigint,
  en_retard bigint,
  jamais_visites bigint,
  alertes bigint,
  alertes_toutes bigint,
  dispo_moyenne numeric,
  perfect_store_pct numeric
)
language plpgsql stable
set search_path = public
as $$
declare
  v_ref     date := coalesce(p_date_fin, current_date);
  v_fenetre integer := coalesce(p_fenetre_mois, fenetre_suivi_mois());
begin
  return query
  with scope_pdv as materialized (
    select p.pdv_id, p.zone,
           (select f.jours from frequence_visite f
             where (f.zone is null or f.zone = p.zone)
               and (f.type_pdv is null or f.type_pdv = p.sous_categorie_pdv)
             order by (f.zone is not null)::int + (f.type_pdv is not null)::int desc,
                      (f.type_pdv is not null)::int desc
             limit 1) as frequence_jours
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where coalesce(p.is_active, true)
      and (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  -- Agrégats sur toutes les visites, jointure au périmètre ensuite (voir
  -- pdv_fraicheur_filtre : le semi-join sur la CTE coûtait 70 s).
  derniere as materialized (
    select v.pdv_id, max(v.date_visite) as date_visite
    from visites v
    where p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz
    group by v.pdv_id
  ),
  -- Dernière visite de chaque PDV DANS la période : c'est elle qui compte.
  periode as materialized (
    select distinct on (v.pdv_id) v.pdv_id, v.id as visite_id
    from visites v
    where (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc
  ),
  scored as materialized (
    select p.pdv_id, r.dispo_rayon, r.niveau
    from periode p
    left join resultat_perfect_store r on r.visite_id = p.visite_id
  ),
  etat as materialized (
    select s.pdv_id, s.zone,
           case
             when d.date_visite is null then 'jamais_visite'
             when (v_ref - d.date_visite::date) > coalesce(s.frequence_jours, 7) then 'en_retard'
             else 'a_jour'
           end as etat,
           coalesce(d.date_visite::date >= (v_ref - make_interval(months => v_fenetre)), false) as suivi
    from scope_pdv s
    left join derniere d on d.pdv_id = s.pdv_id
  )
  select
    coalesce(e.zone, '—') as zone,
    count(*) as pdv_total,
    count(sc.pdv_id) as pdv_visites,
    count(*) - count(sc.pdv_id) as pdv_non_visites,
    count(*) filter (where e.suivi) as pdv_suivis,
    count(*) filter (where not e.suivi) as a_prospecter,
    count(*) filter (where e.etat = 'a_jour') as a_jour,
    count(*) filter (where e.etat = 'en_retard') as en_retard,
    count(*) filter (where e.etat = 'jamais_visite') as jamais_visites,
    -- Le sens d'`alertes` CHANGE ici, et c'est voulu : seuls les PDV sous
    -- couverture en retard. `alertes_toutes` conserve l'ancien chiffre.
    count(*) filter (where e.suivi and e.etat = 'en_retard') as alertes,
    count(*) filter (where e.etat in ('en_retard', 'jamais_visite')) as alertes_toutes,
    round(avg(sc.dispo_rayon), 1) as dispo_moyenne,
    round(100.0 * count(*) filter (where sc.niveau is not null) / nullif(count(sc.pdv_id), 0), 1) as perfect_store_pct
  from etat e
  left join scored sc on sc.pdv_id = e.pdv_id
  group by coalesce(e.zone, '—')
  order by 10 desc, 1;
end $$;

commit;

-- ###########################################################################
-- ### 20260910140000_friesland_recalcul_perfect_store_par_lot.sql
-- ###########################################################################

-- ============================================================================
-- RECALCUL PERFECT STORE PAR LOT
--
-- `recalculer_tous_perfect_store()` (20260630130200:130) boucle
-- `calculer_perfect_store(id)` sur TOUTES les visites — 26 261 aujourd'hui,
-- chacune parcourant plusieurs blocs jsonb et la table des niveaux. Or
-- `authenticated` est plafonné à 30 s (`alter role ... statement_timeout`,
-- 20260831200000:33) : au-delà de quelques milliers de visites, le bouton
-- « Recalculer » de /admin/perfect-store/standards ne peut plus aboutir.
--
-- Le contournement évident — lancer le recalcul depuis un script avec la clé de
-- service — ne marche pas non plus : `est_gestionnaire_perfect_store()` lit
-- `profiles where id = auth.uid()`, et `auth.uid()` est NULL en service_role.
-- La fonction lèverait 42501.
--
-- D'où cette variante par lot, appelée en boucle par l'écran d'administration,
-- avec la session d'un admin. Même contrôle de permission, même base de calcul,
-- parcours stable par `id` pour qu'aucune visite ne soit sautée ni traitée deux
-- fois entre deux appels.
--
-- Idempotent. Additif : `recalculer_tous_perfect_store` reste en place.
-- ============================================================================
begin;

create or replace function public.recalculer_perfect_store_lot(
  p_limit integer default 500,
  p_offset integer default 0,
  p_base_calcul text default 'taux_vente'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_base_calcul not in ('taux_vente','taux_revu') then
    raise exception 'Base de calcul invalide : %', p_base_calcul;
  end if;

  if not public.est_gestionnaire_perfect_store() then
    raise exception 'Permission refusée : rôle admin ou superviseur requis'
      using errcode = '42501';
  end if;

  -- `order by id` : un ordre total et stable. Sans lui, deux appels successifs
  -- pourraient rendre les mêmes lignes et en oublier d'autres.
  with lot as (
    select v.id from public.visites v
    order by v.id
    limit greatest(coalesce(p_limit, 500), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select count(*) into v_count from lot;

  perform public.calculer_perfect_store(id, p_base_calcul)
  from (
    select v.id from public.visites v
    order by v.id
    limit greatest(coalesce(p_limit, 500), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  ) s;

  -- Nombre de visites RÉELLEMENT traitées : l'appelant s'arrête quand il
  -- reçoit moins que `p_limit`.
  return v_count;
end;
$$;

comment on function public.recalculer_perfect_store_lot(integer, integer, text) is
  'Recalcule un lot de visites. À appeler en boucle depuis l''administration (offset croissant) : le recalcul complet dépasse le statement_timeout de 30 s.';

revoke all on function public.recalculer_perfect_store_lot(integer, integer, text) from public;
grant execute on function public.recalculer_perfect_store_lot(integer, integer, text) to authenticated;

-- Compteur, pour afficher une progression honnête plutôt qu'une barre qui
-- avance sans savoir où elle va.
create or replace function public.compter_visites_a_recalculer()
returns bigint
language sql stable
set search_path = public
as $$
  select count(*) from public.visites;
$$;

grant execute on function public.compter_visites_a_recalculer() to authenticated;

commit;

-- ###########################################################################
-- ### 20260910150000_friesland_get_visites_filtered_pagination.sql
-- ###########################################################################

-- ============================================================================
-- get_visites_filtered : lever la troncature silencieuse
--
-- La fonction se terminait par un `limit 2000` EN DUR (20260717150000:84), pour
-- 26 261 visites en base. Les 18 écrans branchés sur `DashboardFilters` via
-- `useDashboardDirection` n'analysaient donc que les 2 000 visites les plus
-- récentes du périmètre — sans message, sans indicateur : sur la fenêtre par
-- défaut de trois mois, un territoire actif dépasse ce seuil et les chiffres
-- affichés étaient faux vers le bas.
--
-- On remplace la constante par `p_limit` / `p_offset`, valeurs par défaut
-- inchangées (2 000 / 0) pour que le front actuel se comporte exactement comme
-- avant tant qu'il ne les passe pas.
--
-- `order by v.date_visite desc` seul ne suffit pas à paginer : deux visites
-- peuvent partager la même date et changer d'ordre entre deux requêtes, donc
-- apparaître deux fois ou jamais. On départage par `visite_id`.
--
-- ATTENTION : `create or replace function` ne sait pas ajouter un paramètre —
-- il crée une SECONDE surcharge, et PostgREST échoue en PGRST203 puisque tous
-- les arguments ont une valeur par défaut. D'où le `drop function <signature
-- exacte>` (même motif qu'en 20260730120000:20-24).
--
-- Idempotent. Additif.
-- ============================================================================
begin;

drop function if exists get_visites_filtered(timestamptz, timestamptz, text, text, text, text, text, text, text, text, text, text);

create or replace function get_visites_filtered(
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_commercial text default null,
  p_canal text default null,
  p_categorie text default null,
  p_sous_categorie text default null,
  p_region text default null,
  p_zone text default null,
  p_secteur text default null,
  p_nom_pdv text default null,
  p_division text default null,
  p_area text default null,
  p_limit integer default 2000,
  p_offset integer default 0
) returns table(
  visite_id text,
  date_visite timestamptz,
  commercial text,
  email text,
  data jsonb,
  pdv_id text,
  nom_pdv text,
  canal text,
  categorie_pdv text,
  sous_categorie_pdv text,
  region text,
  zone text,
  quartier text
)
language sql stable
set search_path = public
as $$
  select
    v.visite_id,
    v.date_visite,
    v.commercial,
    v.email,
    v.data,
    p.pdv_id,
    p.nom_pdv,
    p.canal,
    p.categorie_pdv,
    p.sous_categorie_pdv,
    p.region,
    p.zone,
    p.quartier
  from visites v
  left join pdv p on p.pdv_id = v.pdv_id
  left join territoire t on t.nom = p.zone
  left join sous_region sr on sr.code = t.sous_region_code
  left join region rg on rg.code = sr.region_code
  where (p_date_from is null or v.date_visite >= p_date_from)
    and (p_date_to is null or v.date_visite <= p_date_to)
    and (p_commercial is null or p_commercial = '' or v.commercial ilike '%' || p_commercial || '%' or v.email ilike '%' || p_commercial || '%')
    and (p_canal is null or p_canal = '' or p.canal = p_canal)
    and (p_categorie is null or p_categorie = '' or p.categorie_pdv = p_categorie)
    and (p_sous_categorie is null or p_sous_categorie = '' or p.sous_categorie_pdv = p_sous_categorie)
    and (p_division is null or p_division = '' or rg.nom_affichage = p_division)
    and (p_region is null or p_region = '' or sr.nom_affichage = p_region or p.region = p_region)
    and (p_zone is null or p_zone = '' or p.zone = p_zone)
    and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
    and (p_secteur is null or p_secteur = '' or p.quartier ilike '%' || p_secteur || '%')
    and (p_nom_pdv is null or p_nom_pdv = '' or p.nom_pdv ilike '%' || p_nom_pdv || '%')
  -- Ordre TOTAL : sans le départage par visite_id, la pagination pourrait
  -- rendre deux fois la même ligne et en sauter une autre.
  order by v.date_visite desc, v.visite_id
  limit greatest(coalesce(p_limit, 2000), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

commit;
