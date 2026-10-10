-- ============================================================================
-- PERFECT STORE : LIRE LES STATUTS DES RELEVÉS, PAS SEULEMENT LES QUANTITÉS
-- (10/10/2026)
-- APPLIQUÉE EN PRODUCTION le 10/10/2026 (MCP), puis 36 349 visites recalculées
-- par lots (resultat_perfect_store et visite_perfect_store). Après recalcul :
-- disponibilité moyenne 53,6 % sur les visites avec relevé (0 % avant).
--
-- Constat : les 36 349 visites évaluées avaient une disponibilité, une présence
-- et un assortiment à 0 %, donc aucun point de vente à un niveau Perfect Store.
-- Le calcul ne lisait que data.produits.<famille>.quantites.<sku>, saisi sur
-- 29 visites seulement. Les visites enregistrent un statut par référence :
-- data.produits.<famille>.<sku> = « Présent , Disponible , Prix respecté »,
-- « En rupture »… (cases cochées, séparées par des virgules).
--
-- Règle décidée le 10/10 :
--   - quantité saisie (nombre) : règle inchangée (quantité ≥ seuil, facings en MT) ;
--   - sinon, DISPONIBLE = le statut contient « Disponible » et pas « En rupture » ;
--   - PRÉSENT = le statut contient « Présent » ou « Disponible », et pas « En rupture ».
--   « Présent » seul compte pour la présence, pas pour la disponibilité.
--
-- Fonctions remplacées (signatures et attributs inchangés) :
--   calculer_dispo_categorie, calculer_presence_categorie, calculer_perfect_store
--   (assortiment), compute_perfect_store, dashboard_presence_skus.
-- Le recalcul des visites existantes se fait à part, par lots.
-- Idempotent.
-- ============================================================================
begin;

-- Une case cochée dans le statut texte (« Présent , Disponible »), sans tenir
-- compte de la casse ni des espaces.
create or replace function public.releve_statut_contient(p_statut text, p_case text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select coalesce(lower(p_statut), '') ~ ('(^|,)\s*' || lower(p_case) || '\s*(,|$)')
$function$;

-- Quantité saisie pour un SKU, ou null si absente / non numérique.
create or replace function public.releve_sku_quantite(p_cat jsonb, p_sku text)
 returns numeric
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when jsonb_typeof(p_cat->'quantites'->p_sku) = 'number'
      then (p_cat->'quantites'->>p_sku)::numeric
    when jsonb_typeof(p_cat->'quantites'->p_sku) = 'string'
      and (p_cat->'quantites'->>p_sku) ~ '^\s*\d+(\.\d+)?\s*$'
      then trim(p_cat->'quantites'->>p_sku)::numeric
    else null
  end
$function$;

-- Disponible en rayon. p_cat = data->'produits'-><famille>.
create or replace function public.releve_sku_disponible(p_cat jsonb, p_sku text, p_qte_min numeric, p_facings_min numeric default null)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when public.releve_sku_quantite(p_cat, p_sku) is not null then
      public.releve_sku_quantite(p_cat, p_sku) >= coalesce(p_qte_min, 1)
      and (p_facings_min is null
           or coalesce(case when (p_cat->'facings'->>p_sku) ~ '^\s*\d+(\.\d+)?\s*$'
                            then trim(p_cat->'facings'->>p_sku)::numeric end, 0) >= p_facings_min)
    else
      public.releve_statut_contient(p_cat->>p_sku, 'disponible')
      and not public.releve_statut_contient(p_cat->>p_sku, 'en rupture')
  end
$function$;

-- Présent en rayon (seuil ramené à 1).
create or replace function public.releve_sku_present(p_cat jsonb, p_sku text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when public.releve_sku_quantite(p_cat, p_sku) is not null then
      public.releve_sku_quantite(p_cat, p_sku) >= 1
    else
      (public.releve_statut_contient(p_cat->>p_sku, 'présent')
       or public.releve_statut_contient(p_cat->>p_sku, 'disponible'))
      and not public.releve_statut_contient(p_cat->>p_sku, 'en rupture')
  end
$function$;

create or replace function public.calculer_dispo_categorie(p_data jsonb, p_cat text, p_canal text, p_segment text, p_grade text, p_base_calcul text default 'taux_vente'::text)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select case
    when sum(pr.poids) > 0 then
      round(
        sum(pr.poids * (case
          -- Seuil quantité : en MT, priorité au standard MT vivant (seuil_disponibilite_mt),
          -- sinon seuil_disponibilite (GT ou repli). Sans quantité saisie : statut
          -- « Disponible » sans « En rupture » (20261010160000).
          when public.releve_sku_disponible(p_data->'produits'->cr.categorie_jsonb, cr.sku_key,
                 coalesce(mt.quantite_min, sd.quantite_min), mt.facings)
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
  left join seuil_disponibilite_mt mt on p_canal = 'MT'
    and mt.reference_produit_id = rp.id
    and mt.segment_mt = case p_grade
      when 'A' then 'Hypermarche'
      when 'B' then 'MoyenSuper'
      when 'C' then 'PetitSuper'
    end
  where cr.categorie_jsonb = p_cat;
$function$;

create or replace function public.calculer_presence_categorie(p_data jsonb, p_cat text, p_canal text, p_segment text, p_grade text, p_base_calcul text default 'taux_vente'::text)
 returns numeric
 language sql
 stable
 set search_path to 'public'
as $function$
  select case
    when sum(pr.poids) > 0 then
      round(
        sum(pr.poids * (case
          when public.releve_sku_present(p_data->'produits'->cr.categorie_jsonb, cr.sku_key)
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
$function$;

create or replace function public.calculer_perfect_store(p_visite_id uuid, p_base_calcul text default 'taux_vente'::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
    -- Référence présente : quantité ≥ 1, ou statut « Présent » / « Disponible »
    -- sans « En rupture » (20261010160000).
    select
      count(*) filter (
        where public.releve_sku_present(v_data->'produits'->cr.categorie_jsonb, cr.sku_key)
      ),
      count(*) filter (where rp.role = 'phare'),
      count(*) filter (
        where rp.role = 'phare'
          and public.releve_sku_present(v_data->'produits'->cr.categorie_jsonb, cr.sku_key)
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
$function$;

-- Ancien calcul (table visite_perfect_store) : même règle de disponibilité.
create or replace function public.compute_perfect_store(p_visite_id text, p_basis text default 'taux_vente'::text)
 returns visite_perfect_store
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_visite   public.visites%ROWTYPE;
  v_pdv      public.pdv%ROWTYPE;
  v_group    TEXT; v_tier TEXT; v_trade TEXT; v_objectif TEXT;
  v_min INTEGER; v_weight NUMERIC; v_avail BOOLEAN;
  g_eval     INTEGER := 0; g_avail INTEGER := 0;
  g_wsum     NUMERIC := 0; g_wtot NUMERIC := 0;
  cat_detail JSONB := '{}'::jsonb; cat_eval INTEGER; cat_avail INTEGER;
  vis_req    INTEGER := 0; vis_ok INTEGER := 0; vis_rate NUMERIC;
  v_minsku   INTEGER; assort NUMERIC;
  osa_lin    NUMERIC; osa_w NUMERIC; score NUMERIC; wden NUMERIC;
  cfg        public.perfect_store_score_config%ROWTYPE;
  res        public.visite_perfect_store%ROWTYPE;
  v_rec      RECORD;
BEGIN
  SELECT * INTO v_visite FROM public.visites WHERE visite_id = p_visite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visite % introuvable', p_visite_id; END IF;
  SELECT * INTO v_pdv FROM public.pdv WHERE pdv_id = v_visite.pdv_id;
  SELECT * INTO cfg  FROM public.perfect_store_score_config WHERE id = 1;

  SELECT standard_group, tier INTO v_group, v_tier
    FROM public.pos_standard_map WHERE sous_categorie_pdv = v_pdv.sous_categorie_pdv;
  v_trade := CASE WHEN v_pdv.canal ILIKE '%modern%' OR v_pdv.canal = 'MT' THEN 'MT' ELSE 'GT' END;
  v_objectif := COALESCE(v_pdv.objectif_perfect_store, 'BASIC');

  -- (1)(2)(3) OSA + assortiment
  FOR v_rec IN
    SELECT s.category, s.sku, s.min_quantity
    FROM public.availability_standards s
    WHERE s.standard_group = v_group AND s.tier = v_tier AND s.category IN ('evap','imp','scm')
  LOOP
    v_min := v_rec.min_quantity;
    -- Quantité saisie, sinon statut « Disponible » sans « En rupture » (20261010160000).
    v_avail := public.releve_sku_disponible(v_visite.data->'produits'->v_rec.category, v_rec.sku, v_min, NULL);
    SELECT weight INTO v_weight FROM public.availability_weights
      WHERE category=v_rec.category AND trade_type=v_trade AND basis=p_basis AND sku=v_rec.sku;
    v_weight := COALESCE(v_weight, 0);

    g_eval := g_eval + 1; g_wtot := g_wtot + v_weight;
    IF v_avail THEN g_avail := g_avail + 1; g_wsum := g_wsum + v_weight; END IF;

    cat_eval  := COALESCE((cat_detail->v_rec.category->>'eval')::INTEGER,0) + 1;
    cat_avail := COALESCE((cat_detail->v_rec.category->>'avail')::INTEGER,0) + (CASE WHEN v_avail THEN 1 ELSE 0 END);
    cat_detail := jsonb_set(cat_detail, ARRAY[v_rec.category],
      jsonb_build_object('eval',cat_eval,'avail',cat_avail), true);
  END LOOP;

  osa_lin := CASE WHEN g_eval>0 THEN g_avail::NUMERIC/g_eval ELSE NULL END;
  osa_w   := CASE WHEN g_wtot>0 THEN g_wsum/g_wtot ELSE NULL END;

  SELECT min_sku_present INTO v_minsku FROM public.assortment_standards
    WHERE standard_group=v_group AND tier=v_tier;
  assort := CASE WHEN v_minsku IS NULL OR v_minsku=0 THEN NULL
                 ELSE LEAST(g_avail::NUMERIC / v_minsku, 1) END;

  -- (4) Visibilité
  FOR v_rec IN
    SELECT zone, element_key FROM public.visibility_standards
    WHERE standard_group=v_group AND ps_tier=v_objectif AND is_required
  LOOP
    vis_req := vis_req + 1;
    IF COALESCE((v_visite.data->'visibilite'->v_rec.zone->>v_rec.element_key)::BOOLEAN, false) THEN
      vis_ok := vis_ok + 1;
    END IF;
  END LOOP;
  vis_rate := CASE WHEN vis_req>0 THEN vis_ok::NUMERIC/vis_req ELSE NULL END;

  -- (5) Score composite renormalisé sur les composantes présentes
  score := 0; wden := 0;
  IF osa_lin  IS NOT NULL THEN score := score + cfg.w_osa_lineaire*osa_lin; wden := wden + cfg.w_osa_lineaire; END IF;
  IF osa_w    IS NOT NULL THEN score := score + cfg.w_osa_pondere*osa_w;   wden := wden + cfg.w_osa_pondere; END IF;
  IF assort   IS NOT NULL THEN score := score + cfg.w_assortiment*assort;  wden := wden + cfg.w_assortiment; END IF;
  IF vis_rate IS NOT NULL THEN score := score + cfg.w_visibilite*vis_rate; wden := wden + cfg.w_visibilite; END IF;
  score := CASE WHEN wden>0 THEN score/wden ELSE NULL END;

  -- (6) Gating tier
  res.visite_id := p_visite_id; res.basis := p_basis;
  res.osa_lineaire := osa_lin; res.osa_pondere := osa_w; res.osa_note10 := ROUND(COALESCE(osa_w,0)*10,2);
  res.assortiment_taux := assort; res.visibilite_taux := vis_rate; res.promo_taux := NULL;
  res.score_global := score; res.dispo_categorie := cat_detail;
  res.is_perfect_store := false; res.tier_atteint := NULL; res.computed_at := NOW();

  SELECT ps_tier INTO res.tier_atteint
  FROM public.perfect_store_tier_config c
  WHERE COALESCE(osa_w,0)    >= c.osa_min
    AND COALESCE(assort,1)   >= c.assort_min
    AND COALESCE(vis_rate,0) >= c.visi_min
    AND (c.promo_min IS NULL OR COALESCE(res.promo_taux,0) >= c.promo_min)
  ORDER BY c.rang DESC
  LIMIT 1;
  res.is_perfect_store := res.tier_atteint IS NOT NULL;

  INSERT INTO public.visite_perfect_store AS t VALUES (res.*)
  ON CONFLICT (visite_id) DO UPDATE SET
    basis=EXCLUDED.basis, osa_lineaire=EXCLUDED.osa_lineaire, osa_pondere=EXCLUDED.osa_pondere,
    osa_note10=EXCLUDED.osa_note10, assortiment_taux=EXCLUDED.assortiment_taux,
    visibilite_taux=EXCLUDED.visibilite_taux, promo_taux=EXCLUDED.promo_taux,
    score_global=EXCLUDED.score_global, dispo_categorie=EXCLUDED.dispo_categorie,
    is_perfect_store=EXCLUDED.is_perfect_store, tier_atteint=EXCLUDED.tier_atteint,
    computed_at=EXCLUDED.computed_at;
  RETURN res;
END $function$;

create or replace function public.dashboard_presence_skus(p_division text default null::text, p_territoire text default null::text, p_area text default null::text, p_distributeur text default null::text, p_date_debut date default null::date, p_date_fin date default null::date)
 returns table(reference_nom text, role text, categorie text, releves bigint, presents bigint, disponibles bigint, presence_pct numeric, disponibilite_pct numeric)
 language sql
 stable
 set search_path to 'public'
 set work_mem to '16MB'
as $function$
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
      -- Même règle que calculer_presence_categorie / calculer_dispo_categorie :
      -- quantité saisie, sinon statut du relevé (20261010160000). En modern
      -- trade, le standard MT vivant prime sur le seuil GT.
      public.releve_sku_present(sp.data->'produits'->cr.categorie_jsonb, cr.sku_key) as present,
      public.releve_sku_disponible(sp.data->'produits'->cr.categorie_jsonb, cr.sku_key,
        coalesce(mt.quantite_min, sd.quantite_min), mt.facings) as disponible
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
    count(*) filter (where r.present) as presents,
    count(*) filter (where r.disponible) as disponibles,
    round(100.0 * count(*) filter (where r.present) / nullif(count(*), 0), 1) as presence_pct,
    round(100.0 * count(*) filter (where r.disponible) / nullif(count(*), 0), 1) as disponibilite_pct
  from releve r
  group by r.reference_nom, r.role, r.categorie
  order by (r.role = 'phare') desc, r.reference_nom;
$function$;

grant execute on function public.releve_statut_contient(text, text) to authenticated;
grant execute on function public.releve_sku_quantite(jsonb, text) to authenticated;
grant execute on function public.releve_sku_disponible(jsonb, text, numeric, numeric) to authenticated;
grant execute on function public.releve_sku_present(jsonb, text) to authenticated;

commit;
