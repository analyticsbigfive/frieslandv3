-- ============================================================================
-- Migration 7/N : CALCUL BIG FIVE / PERFECT STORE
-- Perfect Store = disponibilité (OSA) + visibilité parfaite + promotion
-- effective lorsque la promotion est applicable.
-- Dépend de 120300, 120400, 120500 et 130000.
-- ============================================================================
begin;

create table if not exists resultat_perfect_store (
  visite_id        uuid primary key references visites(id) on delete cascade,
  base_calcul      text not null default 'taux_vente'
                   check (base_calcul in ('taux_vente','taux_revu')),
  dispo_rayon_evap numeric,
  dispo_rayon_imp  numeric,
  dispo_rayon_scm  numeric,
  dispo_rayon      numeric,
  visibilite       numeric,
  promotion        numeric,
  score_global     numeric,
  niveau           text references niveau_perfect_store(code),
  calcule_le       timestamptz not null default now()
);

alter table resultat_perfect_store add column if not exists base_calcul text not null default 'taux_vente';
alter table resultat_perfect_store add column if not exists score_global numeric;

-- Disponibilité pondérée d'une catégorie, en %.
create or replace function calculer_dispo_categorie(
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
          when coalesce((p_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric, 0) >= sd.quantite_min
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

-- Compatibilité avec les anciennes visites, puis priorité au relevé générique.
create or replace function element_visibilite_observe(p_data jsonb, p_code text)
returns boolean
language sql immutable
set search_path = public
as $$
  select coalesce(
    (p_data->'visibilite'->'standards'->>p_code)::boolean,
    case p_code
      when 'affiche' then (p_data->'visibilite'->'exterieure'->>'poster')::boolean
      when 'guirlande' then (p_data->'visibilite'->'exterieure'->>'guirlande')::boolean
      when 'sign_board' then (p_data->'visibilite'->'exterieure'->>'sign_board')::boolean
      when 'panneau_privilege' then (p_data->'visibilite'->'exterieure'->>'panneau_privilege')::boolean
      when 'full_branding' then (p_data->'visibilite'->'exterieure'->>'full_branding')::boolean
      when 'reglette' then (p_data->'visibilite'->'interieure'->>'reglettes')::boolean
      when 'maison_br' then (p_data->'visibilite'->'interieure'->>'maison_bonnet_rouge')::boolean
      when 'hanger' then (p_data->'visibilite'->'interieure'->>'hanger')::boolean
      when 'presentoir' then (p_data->'visibilite'->'interieure'->>'presentoirs')::boolean
      when 'tg' then (p_data->'visibilite'->'interieure'->>'tete_gondole')::boolean
      when 'merchandising' then (p_data->'visibilite'->'interieure'->>'merchandising')::boolean
      else false
    end,
    false
  );
$$;

-- Taux d'exécution d'un pilier pour un segment et un niveau.
-- Aucun élément requis dans une matrice existante = 100 % (condition vide).
create or replace function calculer_taux_standard(
  p_data jsonb,
  p_segment text,
  p_niveau text,
  p_pilier text
) returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  v_total int;
  v_requis int;
  v_ok int;
begin
  if p_segment is null then return null; end if;

  select count(*),
         count(*) filter (where s.requis and not e.optionnel),
         count(*) filter (
           where s.requis and not e.optionnel
             and element_visibilite_observe(p_data,e.code)
         )
  into v_total, v_requis, v_ok
  from standard_visibilite s
  join element_visibilite e on e.id=s.element_visibilite_id
  where s.segment=p_segment
    and s.niveau_perfect_store=p_niveau
    and e.pilier=p_pilier;

  if v_total=0 then return null; end if;
  if v_requis=0 then return 100; end if;
  return round(v_ok::numeric/v_requis*100,2);
end;
$$;

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

  v_promo_applicable := coalesce(
    (v_data->'visibilite'->>'promotion_applicable')::boolean,
    false
  );

  -- Cherche le niveau le plus élevé dont tous les piliers sont conformes.
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

  select round(avg(x),2) into v_score
  from (values
    (v_dispo),
    (v_visi),
    (case when v_promo_applicable then v_promo else null end)
  ) as t(x)
  where x is not null;

  insert into resultat_perfect_store(
    visite_id,base_calcul,dispo_rayon_evap,dispo_rayon_imp,dispo_rayon_scm,
    dispo_rayon,visibilite,promotion,score_global,niveau,calcule_le
  ) values (
    p_visite_id,p_base_calcul,v_evap,v_imp,v_scm,
    v_dispo,v_visi,v_promo,v_score,v_niveau,now()
  )
  on conflict (visite_id) do update set
    base_calcul=excluded.base_calcul,
    dispo_rayon_evap=excluded.dispo_rayon_evap,
    dispo_rayon_imp=excluded.dispo_rayon_imp,
    dispo_rayon_scm=excluded.dispo_rayon_scm,
    dispo_rayon=excluded.dispo_rayon,
    visibilite=excluded.visibilite,
    promotion=excluded.promotion,
    score_global=excluded.score_global,
    niveau=excluded.niveau,
    calcule_le=excluded.calcule_le;
end;
$$;

create or replace function trg_calculer_perfect_store()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform calculer_perfect_store(new.id,'taux_vente');
  return new;
end;
$$;

drop trigger if exists trg_perfect_store on visites;
create trigger trg_perfect_store
  after insert or update of data,pdv_id on visites
  for each row execute function trg_calculer_perfect_store();

alter table resultat_perfect_store enable row level security;
drop policy if exists resultat_perfect_store_read on resultat_perfect_store;
create policy resultat_perfect_store_read on resultat_perfect_store
  for select to authenticated using (true);

create or replace view v_perfect_store_global as
select
  count(*) as visites_scorees,
  count(*) filter (where niveau is not null) as perfect_stores,
  round(100.0*count(*) filter (where niveau is not null)/nullif(count(*),0),1) as perfect_store_pct,
  round(avg(score_global),1) as score_global_moyen_pct,
  round(avg(dispo_rayon),1) as osa_moyen_pct,
  round(avg(visibilite),1) as visibilite_moyenne_pct,
  round(avg(promotion),1) as promotion_moyenne_pct
from resultat_perfect_store;

create or replace view v_perfect_store_par_categorie_pdv as
select
  coalesce(p.sous_categorie_pdv,'Non renseigné') as type_pdv,
  count(*) as visites_scorees,
  count(*) filter (where r.niveau is not null) as perfect_stores,
  round(100.0*count(*) filter (where r.niveau is not null)/nullif(count(*),0),1) as perfect_store_pct,
  round(avg(r.score_global),1) as score_global_moyen_pct
from resultat_perfect_store r
join visites v on v.id=r.visite_id
join pdv p on p.pdv_id=v.pdv_id
group by coalesce(p.sous_categorie_pdv,'Non renseigné');

create or replace view v_couverture as
select
  v.commercial as merchandiser,
  to_char(date_trunc('month',v.date_visite),'YYYY-MM') as periode,
  count(distinct v.pdv_id) as pdv_vus
from visites v
group by v.commercial,date_trunc('month',v.date_visite);

create or replace view v_couverture_globale as
select
  to_char(date_trunc('month',v.date_visite),'YYYY-MM') as periode,
  count(distinct v.pdv_id) as pdv_vus
from visites v
group by date_trunc('month',v.date_visite);

-- Recalcule l'historique afin que le dashboard ne soit pas limité aux nouvelles visites.
select calculer_perfect_store(id,'taux_vente') from visites;

commit;
