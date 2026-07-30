-- ============================================================================
-- TAUX DE PRÉSENCE, DISTINCT DU TAUX DE DISPONIBILITÉ (réunion 23/07, tâche 3)
--
-- Le dashboard ne distinguait pas les deux notions :
--   - PRÉSENCE      : le produit est là           → quantité relevée >= 1
--   - DISPONIBILITÉ : il est là en quantité suffisante → quantité >= seuil
-- Le seuil paramétré (seuil_disponibilite, par segment/grade) définit la
-- disponibilité, pas la présence. On peut donc avoir 80 % de présence et 40 %
-- de disponibilité — c'est exactement ce que le client veut pouvoir lire.
--
-- CHOIX D'IMPLÉMENTATION : la présence est calculée par le MÊME chemin que la
-- disponibilité (mêmes SKU, même pondération, même résolution segment/grade),
-- avec pour seule différence le seuil comparé. Écrire un second calcul
-- indépendant aurait garanti la dérive entre les deux taux, et ils n'auraient
-- plus été comparables — or leur écart EST l'information recherchée.
--
-- Le résultat est stocké dans resultat_perfect_store à côté de dispo_rayon,
-- rempli par le trigger existant. Il n'entre PAS dans le score ni dans le
-- niveau Perfect Store : c'est un indicateur de lecture, la règle métier de
-- conformité reste inchangée.
--
-- Idempotent. Additif : nouvelles colonnes, aucune suppression.
-- ============================================================================
begin;

alter table resultat_perfect_store add column if not exists presence_rayon numeric;
alter table resultat_perfect_store add column if not exists presence_rayon_evap numeric;
alter table resultat_perfect_store add column if not exists presence_rayon_imp numeric;
alter table resultat_perfect_store add column if not exists presence_rayon_scm numeric;

comment on column resultat_perfect_store.presence_rayon is
  'Distribution numérique pondérée : part des SKU avec quantité >= 1. À opposer à dispo_rayon (quantité >= seuil_disponibilite).';

-- Présence pondérée d'une catégorie, en %.
-- Copie conforme de calculer_dispo_categorie, au seuil près : le prédicat
-- passe de « >= sd.quantite_min » à « >= 1 ». La jointure sur
-- seuil_disponibilite est CONSERVÉE volontairement : elle définit quels SKU
-- sont attendus pour ce segment/grade. La retirer élargirait l'assiette et
-- rendrait les deux taux incomparables.
create or replace function calculer_presence_categorie(
  p_data jsonb,
  p_cat text,
  p_canal text,
  p_segment text,
  p_grade text,
  p_base_calcul text default 'taux_vente'
) returns numeric
language sql stable
set search_path = public
as $$
  select case
    when sum(pr.poids) > 0 then
      round(
        sum(pr.poids * (case
          when coalesce((p_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric, 0) >= 1
          then 1 else 0 end))
        / sum(pr.poids) * 100
      )
    else null
  end
  from correspondance_reference cr
  join reference_produit rp on rp.id = cr.reference_produit_id
  join poids_reference pr on pr.reference_produit_id = rp.id
    and pr.canal = p_canal
    and pr.base_calcul = p_base_calcul
  join seuil_disponibilite sd on sd.reference_produit_id = rp.id
    and sd.segment = p_segment
    and sd.grade = p_grade
  where cr.categorie_jsonb = p_cat;
$$;

-- ---------------------------------------------------------------------------
-- calculer_perfect_store : calcule et stocke aussi la présence.
-- Le corps est repris à l'identique de 20260630130100 ; seuls les blocs
-- marqués « PRÉSENCE » sont nouveaux. Le calcul du niveau et du score n'est
-- pas modifié.
-- ---------------------------------------------------------------------------
create or replace function calculer_perfect_store(
  p_visite_id uuid,
  p_base_calcul text default 'taux_vente'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
  v_pdv text;
  v_canal text;
  v_segment text;
  v_grade text;
  v_vis_segment text;
  v_evap numeric;
  v_imp numeric;
  v_scm numeric;
  v_dispo numeric;
  -- PRÉSENCE
  v_pres_evap numeric;
  v_pres_imp numeric;
  v_pres_scm numeric;
  v_presence numeric;
  v_sku_presents integer;
  v_min_sku_presents integer;
  v_heros_obligatoires boolean;
  v_heros_total integer;
  v_heros_presents_count integer;
  v_assortiment numeric;
  v_heros_ok boolean;
  v_visi numeric;
  v_promo numeric;
  v_score numeric;
  v_niveau text;
  v_promo_applicable boolean;
  v_niveau_key text;
  n niveau_perfect_store%rowtype;
begin
  select data,pdv_id into v_data,v_pdv from visites where id=p_visite_id;
  if v_data is null then return; end if;

  select coalesce(cp.canal,'GT'),sg.segment,sg.grade,sv.segment
  into v_canal,v_segment,v_grade,v_vis_segment
  from pdv p
  left join lateral (
    select candidate.*
    from type_pdv candidate
    where regexp_replace(trim(candidate.nom),'\s+',' ','g')
      = regexp_replace(trim(p.sous_categorie_pdv),'\s+',' ','g')
    order by (candidate.nom=p.sous_categorie_pdv) desc
    limit 1
  ) tp on true
  left join categorie_pdv cp on cp.id=tp.categorie_pdv_id
  left join segment_grade_type_pdv sg on sg.type_pdv_id=tp.id
  left join segment_visibilite_type_pdv sv on sv.type_pdv_id=tp.id
  where p.pdv_id=v_pdv;

  v_canal := coalesce(v_canal,'GT');
  v_evap := calculer_dispo_categorie(v_data,'evap',v_canal,v_segment,v_grade,p_base_calcul);
  v_imp  := calculer_dispo_categorie(v_data,'imp',v_canal,v_segment,v_grade,p_base_calcul);
  v_scm  := calculer_dispo_categorie(v_data,'scm',v_canal,v_segment,v_grade,p_base_calcul);

  select round(avg(x)) into v_dispo
  from (values(v_evap),(v_imp),(v_scm)) as t(x)
  where x is not null;

  -- PRÉSENCE : même assiette de SKU, seuil ramené à 1.
  v_pres_evap := calculer_presence_categorie(v_data,'evap',v_canal,v_segment,v_grade,p_base_calcul);
  v_pres_imp  := calculer_presence_categorie(v_data,'imp',v_canal,v_segment,v_grade,p_base_calcul);
  v_pres_scm  := calculer_presence_categorie(v_data,'scm',v_canal,v_segment,v_grade,p_base_calcul);

  select round(avg(x)) into v_presence
  from (values(v_pres_evap),(v_pres_imp),(v_pres_scm)) as t(x)
  where x is not null;

  select sa.min_sku_presents, sa.heros_obligatoires
  into v_min_sku_presents, v_heros_obligatoires
  from standard_assortiment sa
  where sa.segment = v_segment
    and sa.grade = v_grade;

  if v_min_sku_presents is not null then
    select
      count(*) filter (
        where coalesce(
          (v_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric,
          0
        ) > 0
      ),
      count(*) filter (where rp.role = 'phare'),
      count(*) filter (
        where rp.role = 'phare'
          and coalesce(
            (v_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric,
            0
          ) > 0
      )
    into v_sku_presents, v_heros_total, v_heros_presents_count
    from correspondance_reference cr
    join reference_produit rp on rp.id = cr.reference_produit_id;

    v_assortiment := round(
      least(v_sku_presents::numeric / v_min_sku_presents, 1) * 100,
      2
    );
    v_heros_ok := not v_heros_obligatoires
      or v_heros_total = v_heros_presents_count;
  else
    v_sku_presents := null;
    v_assortiment := null;
    v_heros_ok := null;
  end if;

  v_promo_applicable := coalesce(
    (v_data->'visibilite'->>'promotion_applicable')::boolean,
    false
  );

  for n in select * from niveau_perfect_store order by rang desc
  loop
    v_niveau_key := case
      when n.code ilike 'FLAGSHIP%' then 'flagship'
      when n.code ilike 'VIP%' then 'vip'
      when n.code ilike 'CORE%' then 'core'
      else 'basic'
    end;
    v_visi := calculer_taux_standard(v_data,v_vis_segment,v_niveau_key,'visibilite');
    v_promo := case when v_promo_applicable
      then calculer_taux_standard(v_data,v_vis_segment,v_niveau_key,'promotion')
      else null
    end;

    if v_dispo is not null
       and v_dispo >= coalesce(n.dispo_rayon_min,0)
       and (
         v_assortiment is null
         or (v_assortiment >= 100 and coalesce(v_heros_ok,false))
       )
       and v_visi is not null
       and v_visi >= coalesce(n.visibilite_min,100)
       and (
         not v_promo_applicable
         or v_promo is null
         or v_promo >= coalesce(n.promotion_min,100)
       )
    then
      v_niveau := n.code;
      exit;
    end if;
  end loop;

  -- La présence n'entre PAS dans le score : le score reste la moyenne
  -- disponibilité / visibilité / promotion définie par le fichier Big Five.
  select round(avg(x),2) into v_score
  from (values
    (v_dispo),
    (v_visi),
    (case when v_promo_applicable then v_promo else null end)
  ) as t(x)
  where x is not null;

  insert into resultat_perfect_store(
    visite_id,base_calcul,dispo_rayon_evap,dispo_rayon_imp,dispo_rayon_scm,
    dispo_rayon,presence_rayon,presence_rayon_evap,presence_rayon_imp,presence_rayon_scm,
    assortiment,sku_presents,heros_presents,
    visibilite,promotion,score_global,niveau,calcule_le
  ) values (
    p_visite_id,p_base_calcul,v_evap,v_imp,v_scm,
    v_dispo,v_presence,v_pres_evap,v_pres_imp,v_pres_scm,
    v_assortiment,v_sku_presents,v_heros_ok,
    v_visi,v_promo,v_score,v_niveau,now()
  )
  on conflict (visite_id) do update set
    base_calcul=excluded.base_calcul,
    dispo_rayon_evap=excluded.dispo_rayon_evap,
    dispo_rayon_imp=excluded.dispo_rayon_imp,
    dispo_rayon_scm=excluded.dispo_rayon_scm,
    dispo_rayon=excluded.dispo_rayon,
    presence_rayon=excluded.presence_rayon,
    presence_rayon_evap=excluded.presence_rayon_evap,
    presence_rayon_imp=excluded.presence_rayon_imp,
    presence_rayon_scm=excluded.presence_rayon_scm,
    assortiment=excluded.assortiment,
    sku_presents=excluded.sku_presents,
    heros_presents=excluded.heros_presents,
    visibilite=excluded.visibilite,
    promotion=excluded.promotion,
    score_global=excluded.score_global,
    niveau=excluded.niveau,
    calcule_le=excluded.calcule_le;
end;
$$;

-- ---------------------------------------------------------------------------
-- KPI dashboard : présence + disponibilité, global et par catégorie.
-- Signature identique à celle de 20260730120000, on ajoute seulement des clés.
-- ---------------------------------------------------------------------------
create or replace function dashboard_perfect_store_filtre(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
) returns jsonb
language sql stable
set search_path = public
as $$
  with scope_pdv as (
    select p.pdv_id
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  actifs as (
    select count(*) filter (where coalesce(p.is_active, true)) as pdv_total
    from pdv p where p.pdv_id in (select pdv_id from scope_pdv)
  ),
  visites_scope as (
    select v.id, v.pdv_id, v.date_visite
    from visites v
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
  ),
  scored as (
    select r.niveau, r.score_global, r.dispo_rayon, r.visibilite, r.promotion,
           r.assortiment, r.calcule_le, v.pdv_id, v.date_visite,
           r.presence_rayon, r.presence_rayon_evap, r.presence_rayon_imp, r.presence_rayon_scm,
           r.dispo_rayon_evap, r.dispo_rayon_imp, r.dispo_rayon_scm
    from resultat_perfect_store r
    join visites_scope v on v.id = r.visite_id
  ),
  -- Une ligne par PDV : sa dernière visite scorée de la période, avec TOUS ses
  -- piliers. Les moyennes ci-dessous portent sur cette CTE et non sur `scored`,
  -- sinon un PDV revisité 3 fois pèserait 3 fois dans le taux de présence alors
  -- que le reste de la page le compte une fois.
  dernier as (
    select distinct on (s.pdv_id) s.*
    from scored s
    order by s.pdv_id, s.date_visite desc, s.calcule_le desc
  ),
  -- Tous les niveaux du référentiel, y compris ceux à 0 PDV : le client lit
  -- « 500 Flagship, 0 VIP, … » — un niveau absent se lirait comme un oubli.
  par_niveau as (
    select n.code as niveau, count(d.pdv_id) as nb_pdv, n.rang
    from niveau_perfect_store n
    left join dernier d on d.niveau = n.code
    group by n.code, n.rang
  )
  select jsonb_build_object(
    'pdv_scores', (select count(*) from dernier),
    'pdv_perfect_stores', (select count(*) filter (where niveau is not null) from dernier),
    'pdv_perfect_store_pct', (select round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) from dernier),
    'pdv_non_conformes', (select count(*) filter (where niveau is null) from dernier),
    'par_niveau', coalesce((
      select jsonb_agg(jsonb_build_object('niveau', niveau, 'nb_pdv', nb_pdv) order by rang desc nulls last, niveau)
      from par_niveau
    ), '[]'::jsonb),
    -- Compteurs d'activité : ceux-là comptent bien des passages.
    'visites_scorees', (select count(*) from scored),
    'perfect_stores', (select count(*) filter (where niveau is not null) from scored),
    'perfect_store_pct', (select round(100.0 * count(*) filter (where niveau is not null) / nullif(count(*), 0), 1) from scored),
    -- Moyennes des piliers : base PDV distincts, comme le KPI principal.
    'score_global_moyen_pct', (select round(avg(score_global), 1) from dernier),
    'osa_moyen_pct', (select round(avg(dispo_rayon), 1) from dernier),
    'visibilite_moyenne_pct', (select round(avg(visibilite), 1) from dernier),
    'promotion_moyenne_pct', (select round(avg(promotion), 1) from dernier),
    'assortiment_moyen_pct', (select round(avg(assortiment), 1) from dernier),
    -- Taux de présence : distribution numérique (quantité >= 1).
    'presence_moyenne_pct', (select round(avg(presence_rayon), 1) from dernier),
    'par_categorie', coalesce((
      select jsonb_agg(x order by x->>'categorie')
      from (
        select jsonb_build_object(
          'categorie', c.cat,
          'presence_pct', round(avg(case c.cat when 'evap' then s.presence_rayon_evap when 'imp' then s.presence_rayon_imp else s.presence_rayon_scm end), 1),
          'disponibilite_pct', round(avg(case c.cat when 'evap' then s.dispo_rayon_evap when 'imp' then s.dispo_rayon_imp else s.dispo_rayon_scm end), 1)
        ) as x
        from dernier s cross join (values ('evap'),('imp'),('scm')) as c(cat)
        group by c.cat
      ) t
    ), '[]'::jsonb),
    'pdv_vus', (select count(distinct pdv_id) from visites_scope),
    'pdv_total', (select pdv_total from actifs),
    'couverture_pct', (
      select round(100.0 * (select count(distinct pdv_id) from visites_scope)
        / nullif((select pdv_total from actifs), 0), 1)
    ),
    'visites_total', (select count(*) from visites_scope)
  );
$$;

-- ---------------------------------------------------------------------------
-- Détail par SKU (tâche 3.3) : d'abord la catégorie, puis les SKU clés.
-- Les SKU remontés sont ceux dont le rôle est « phare » (les 2 SKU clés) ou
-- « nouveaute » (la gamme Délice). Les rôles viennent de reference_produit —
-- pas de liste codée en dur, la taxonomie reste pilotée par le référentiel.
-- ---------------------------------------------------------------------------
drop function if exists dashboard_presence_skus(text, text, text, text, date, date);

create or replace function dashboard_presence_skus(
  p_division text default null,
  p_territoire text default null,
  p_area text default null,
  p_distributeur text default null,
  p_date_debut date default null,
  p_date_fin date default null
) returns table(
  reference_nom text,
  role text,
  categorie text,
  releves bigint,
  presents bigint,
  disponibles bigint,
  presence_pct numeric,
  disponibilite_pct numeric
)
language sql stable
set search_path = public
as $$
  with scope_pdv as (
    select p.pdv_id
    from pdv p
    left join territoire t on t.nom = p.zone
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where (p_division is null or p_division = '' or rg.nom_affichage = p_division)
      and (p_territoire is null or p_territoire = '' or p.zone = p_territoire)
      and (p_area is null or p_area = '' or p.area_code = p_area or p.quartier = p_area)
      and (p_distributeur is null or p_distributeur = '' or p.distributor_name = p_distributeur)
  ),
  -- Une visite par PDV (la dernière de la période), pour rester sur la même
  -- base de comptage que le reste du dashboard.
  derniere_visite as (
    select distinct on (v.pdv_id) v.id, v.pdv_id, v.data, p.sous_categorie_pdv
    from visites v
    join pdv p on p.pdv_id = v.pdv_id
    where v.pdv_id in (select pdv_id from scope_pdv)
      and (p_date_debut is null or v.date_visite >= p_date_debut::timestamptz)
      and (p_date_fin is null or v.date_visite < (p_date_fin + 1)::timestamptz)
    order by v.pdv_id, v.date_visite desc
  ),
  segment_du_pdv as (
    select dv.id, dv.data, sg.segment, sg.grade, coalesce(cp.canal, 'GT') as canal
    from derniere_visite dv
    left join lateral (
      select candidate.*
      from type_pdv candidate
      where regexp_replace(trim(candidate.nom),'\s+',' ','g')
        = regexp_replace(trim(dv.sous_categorie_pdv),'\s+',' ','g')
      order by (candidate.nom = dv.sous_categorie_pdv) desc
      limit 1
    ) tp on true
    left join categorie_pdv cp on cp.id = tp.categorie_pdv_id
    left join segment_grade_type_pdv sg on sg.type_pdv_id = tp.id
  ),
  releve as (
    select
      rp.nom as reference_nom,
      rp.role,
      cr.categorie_jsonb as categorie,
      coalesce((sp.data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric, 0) as quantite,
      coalesce((sp.data->'produits'->cr.categorie_jsonb->'facings'->>cr.sku_key)::numeric, 0) as facings,
      -- Même règle de seuil que calculer_dispo_categorie depuis 20260716190000 :
      -- en modern trade, le standard MT vivant prime sur le seuil GT. Sans ça,
      -- la colonne « Dispo. » de ce tableau contredirait le bloc « Par catégorie »
      -- (qui lit dispo_rayon_*, lui MT-aware) sur les supermarchés.
      coalesce(mt.quantite_min, sd.quantite_min) as quantite_min,
      mt.facings as facings_min
    from segment_du_pdv sp
    join correspondance_reference cr on true
    join reference_produit rp on rp.id = cr.reference_produit_id
    join seuil_disponibilite sd on sd.reference_produit_id = rp.id
      and sd.segment = sp.segment
      and sd.grade = sp.grade
    left join seuil_disponibilite_mt mt on sp.canal = 'MT'
      and mt.reference_produit_id = rp.id
      and mt.segment_mt = case sp.grade
        when 'A' then 'Hypermarche'
        when 'B' then 'MoyenSuper'
        when 'C' then 'PetitSuper'
      end
    where rp.role in ('phare', 'nouveaute')
  )
  select
    r.reference_nom,
    r.role,
    r.categorie,
    count(*) as releves,
    count(*) filter (where r.quantite >= 1) as presents,
    count(*) filter (
      where r.quantite >= r.quantite_min
        and (r.facings_min is null or r.facings >= r.facings_min)
    ) as disponibles,
    round(100.0 * count(*) filter (where r.quantite >= 1) / nullif(count(*), 0), 1) as presence_pct,
    round(100.0 * count(*) filter (
      where r.quantite >= r.quantite_min
        and (r.facings_min is null or r.facings >= r.facings_min)
    ) / nullif(count(*), 0), 1) as disponibilite_pct
  from releve r
  group by r.reference_nom, r.role, r.categorie
  order by (r.role = 'phare') desc, r.reference_nom;
$$;

-- Backfill : remplit presence_rayon sur tout l'historique déjà scoré.
-- On appelle calculer_perfect_store directement, comme dans 20260630130100 :
-- recalculer_tous_perfect_store est protégée par un contrôle RBAC
-- (« rôle admin ou superviseur requis ») qui échoue hors session applicative.
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;
