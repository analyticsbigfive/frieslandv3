-- PROPOSITION 2026-10-19 (retour) : Yao sur abobomerchone (ABOBO 1), Seregone sur abobomerchtwo (ABOBO 2)
--
-- Les comptes suivent les territoires : depuis la réaffectation du 16/10,
--   - abobomerchone (107d190d…) = compte ABOBO 1 = Yao Venance ;
--   - abobomerchtwo (c4f8d184…) = compte ABOBO 2 = Seregone Chadrac.
-- Les fiches du 16/10 et l'import de 10 h 46 (routing_yao_seregone_a_appliquer_2026-10-19.xlsx)
-- étaient donc justes. Le script collé à 17 h 12 les a échangés à tort ; celui-ci refait
-- l'échange en sens inverse et retombe sur la sauvegarde
-- ~/Downloads/imports-terrain/inversion-yao-seregone-2026-10-19/avant.json.
--
-- Garde-fou : ne fait rien si abobomerchone ne s'appelle pas SEREGONE SCHADRACK (état après
-- 17 h 12), donc rien non plus s'il est collé deux fois.

do $$
declare
  v_one    constant uuid := '107d190d-25c0-4bf4-afb8-9383bb48bcdd';  -- abobomerchone → Yao, ABOBO 1
  v_two    constant uuid := 'c4f8d184-718a-4f45-8ac1-1e2a90e20da3';  -- abobomerchtwo → Seregone, ABOBO 2
  -- Compte de passage (QA Atom, sans routing mensuel) : routing_mensuel_cle interdit
  -- d'échanger deux merchandisers en une seule mise à jour.
  v_relais constant uuid := 'e1eab5c9-5364-4fe5-89f8-0265ca04de7c';
  v_source constant text := 'client-routing_yao_seregone_a_appliquer_2026-10-19.xlsx';
  p1 profiles%rowtype;
  p2 profiles%rowtype;
  n  integer;
begin
  select * into p1 from profiles where id = v_one;
  select * into p2 from profiles where id = v_two;
  if p1.nom is distinct from 'SEREGONE SCHADRACK' or p2.nom is distinct from 'YAO VENANCE' then
    raise exception 'État inattendu (abobomerchone = %, abobomerchtwo = %) : rien n''est fait', p1.nom, p2.nom;
  end if;
  if exists (select 1 from routing_mensuel where merchandiser_id = v_relais) then
    raise exception 'Le compte de passage a un routing mensuel : rien n''est fait';
  end if;

  -- 1. Fiches.
  update profiles set
    nom = p2.nom, telephone = p2.telephone, zone_assignee = p2.zone_assignee,
    quartiers_assignes = p2.quartiers_assignes, territoires_assignes = p2.territoires_assignes
  where id = v_one;
  update profiles set
    nom = p1.nom, telephone = p1.telephone, zone_assignee = p1.zone_assignee,
    quartiers_assignes = p1.quartiers_assignes, territoires_assignes = p1.territoires_assignes
  where id = v_two;

  -- 2a. Routing mensuel : one → relais, two → one, relais → two.
  update routing_mensuel set merchandiser_id = v_relais where merchandiser_id = v_one and source = v_source;
  get diagnostics n = row_count;
  if n <> 24 then raise exception 'routing_mensuel abobomerchone : % lignes au lieu de 24', n; end if;
  update routing_mensuel set merchandiser_id = v_one where merchandiser_id = v_two and source = v_source;
  get diagnostics n = row_count;
  if n <> 24 then raise exception 'routing_mensuel abobomerchtwo : % lignes au lieu de 24', n; end if;
  update routing_mensuel set merchandiser_id = v_two where merchandiser_id = v_relais and source = v_source;

  -- 2b. Règles « Routing mensuel — … » créées par l'import du 19/10.
  update routing_templates set user_id = case user_id when v_one then v_two else v_one end
  where user_id in (v_one, v_two)
    and label like 'Routing mensuel — %'
    and created_at >= '2026-10-19 10:46+00' and created_at < '2026-10-19 10:48+00';
  get diagnostics n = row_count;
  if n <> 48 then raise exception 'routing_templates : % règles au lieu de 48', n; end if;
end $$;

-- 3. Tournées à partir de demain (pending, aucune étape traitée) : supprimées puis recréées.
select recalculer_tournees_a_venir('107d190d-25c0-4bf4-afb8-9383bb48bcdd', 14) as yao_abobomerchone,
       recalculer_tournees_a_venir('c4f8d184-718a-4f45-8ac1-1e2a90e20da3', 14) as seregone_abobomerchtwo;
