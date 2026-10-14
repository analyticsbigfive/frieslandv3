-- ============================================================================
-- OBJECTIFS DE DISPONIBILITÉ 2026 (fichier client du 14/10/2026,
-- « OBJECTIFS 2026 DISPONIBILITE IVC »)
--
-- Le client fixe, par trimestre et par canal (GT Abidjan, GT intérieur = UPC,
-- Modern Trade), la part des PDV où chaque produit doit être disponible, la
-- part des PDV avec PLV extérieure / intérieure et le respect des prix par
-- famille. Admin › Produits › Objectifs mesure le réalisé en face.
--
-- 1. objectif_disponibilite : objectifs (part de 0 à 1), modifiables par
--    l'admin et le superviseur (Paramètres › Référentiels › Objectifs de
--    disponibilité). Remplie avec les feuilles GT ABIDJAN, GT UPC et MT du
--    fichier ; une cellule vide (produit pas encore lancé) ou à 0 (PLV
--    extérieure en MT) ne donne pas d'objectif. La feuille National n'est pas
--    stockée : elle se calcule.
-- 2. canal_objectif(canal, region, division) : canal d'objectif d'un PDV.
-- 3. dashboard_objectifs_disponibilite(annee, trimestre, territoire) : réalisé
--    par canal et par indicateur, sur la DERNIÈRE visite avec relevé produit
--    de chaque PDV dans le trimestre (les visites sans relevé, dont l'export
--    Atom, ne comptent pas comme des ruptures).
--    - dispo : seuil Perfect Store (décision du 14/10), même règle que
--      dashboard_presence_skus : quantité >= seuil du segment / grade (en MT,
--      standard MT et facings), sinon statut « Disponible » sans rupture. Seuls
--      les PDV où le produit a été relevé comptent. Sans seuil pour le type
--      de PDV, le produit n'y est pas attendu : PDV compté à part
--      (hors_calcul), pas comme une rupture. Types hérités sans grade
--      (« Supermarché », « Kiosque »…) : segment le plus proche, grade le
--      moins exigeant.
--    - plv_exterieure / plv_interieure : visibilite.<emplacement>.presence_visibilite.
--    - prix : produits.<famille>.prix_respectes, parmi les PDV où la famille
--      est présente.
--    Les KPI du fichier (merchandising, visibilité, prix par produit) ne sont
--    pas calculés : l'application n'en a pas de mesure fidèle.
--    SANS security definer : la RLS de visites / pdv cloisonne les comptes agence.
--
-- APPLIQUÉE en production le 14/10/2026 (connecteur Supabase, apply_migration).
--
-- Additif et idempotent (une ré-exécution ne touche pas aux objectifs déjà
-- modifiés dans l'admin : on conflict do nothing).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Objectifs
-- ---------------------------------------------------------------------------
create table if not exists public.objectif_disponibilite (
  id                   bigint generated always as identity primary key,
  annee                integer not null check (annee between 2024 and 2100),
  trimestre            integer not null check (trimestre between 1 and 4),
  canal                text not null check (canal in ('GT_ABIDJAN', 'GT_UPC', 'MT')),
  indicateur           text not null check (indicateur in ('dispo', 'plv_exterieure', 'plv_interieure', 'prix')),
  reference_produit_id integer references public.reference_produit(id) on delete cascade,
  categorie            text check (categorie in ('evap', 'scm', 'imp')),
  cible                numeric(5, 4) not null check (cible >= 0 and cible <= 1),
  updated_at           timestamptz not null default now(),
  constraint objectif_disponibilite_cle check (
    (indicateur = 'dispo' and reference_produit_id is not null and categorie is null)
    or (indicateur = 'prix' and reference_produit_id is null and categorie is not null)
    or (indicateur in ('plv_exterieure', 'plv_interieure') and reference_produit_id is null and categorie is null)
  )
);

create unique index if not exists objectif_disponibilite_unique
  on public.objectif_disponibilite (annee, trimestre, canal, indicateur, coalesce(reference_produit_id, 0), coalesce(categorie, ''));

comment on table public.objectif_disponibilite is
  'Objectifs trimestriels par canal (GT_ABIDJAN, GT_UPC, MT) : part des PDV (0 à 1) avec le produit disponible (dispo), la PLV extérieure / intérieure, les prix respectés (prix, par famille). Admin › Produits › Objectifs ; saisie dans Référentiels.';

drop trigger if exists trg_objectif_disponibilite_updated_at on public.objectif_disponibilite;
create trigger trg_objectif_disponibilite_updated_at
  before update on public.objectif_disponibilite
  for each row execute function update_routing_updated_at();

insert into public.objectif_disponibilite (annee, trimestre, canal, indicateur, reference_produit_id, categorie, cible)
values
  (2026, 1, 'GT_ABIDJAN', 'plv_exterieure', null, null, 0.5),
  (2026, 1, 'GT_ABIDJAN', 'plv_interieure', null, null, 0.45),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 4, null, 0.5),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 2, null, 0.85),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 5, null, 0.3),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 3, null, 0.71),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 1, null, 0.3),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 6, null, 0.39),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 14, null, 0.05),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 13, null, 0.06),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 12, null, 0.15),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 11, null, 0.4498),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 9, null, 0.15),
  (2026, 1, 'GT_ABIDJAN', 'dispo', 7, null, 0.78),
  (2026, 1, 'GT_ABIDJAN', 'prix', null, 'evap', 0.9),
  (2026, 1, 'GT_ABIDJAN', 'prix', null, 'scm', 0.93),
  (2026, 1, 'GT_ABIDJAN', 'prix', null, 'imp', 0.97),
  (2026, 2, 'GT_ABIDJAN', 'plv_exterieure', null, null, 0.55),
  (2026, 2, 'GT_ABIDJAN', 'plv_interieure', null, null, 0.5),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 4, null, 0.53),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 2, null, 0.87),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 5, null, 0.35),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 3, null, 0.75),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 1, null, 0.5),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 6, null, 0.4),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 14, null, 0.07),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 13, null, 0.1),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 12, null, 0.17),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 11, null, 0.5),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 9, null, 0.17),
  (2026, 2, 'GT_ABIDJAN', 'dispo', 7, null, 0.8),
  (2026, 2, 'GT_ABIDJAN', 'prix', null, 'evap', 0.93),
  (2026, 2, 'GT_ABIDJAN', 'prix', null, 'scm', 0.95),
  (2026, 2, 'GT_ABIDJAN', 'prix', null, 'imp', 0.98),
  (2026, 3, 'GT_ABIDJAN', 'plv_exterieure', null, null, 0.6),
  (2026, 3, 'GT_ABIDJAN', 'plv_interieure', null, null, 0.55),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 4, null, 0.55),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 2, null, 0.88),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 5, null, 0.37),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 3, null, 0.8),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 1, null, 0.55),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 6, null, 0.45),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 14, null, 0.1),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 13, null, 0.13),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 12, null, 0.2),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 11, null, 0.53),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 9, null, 0.2),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 7, null, 0.83),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 10, null, 0.45),
  (2026, 3, 'GT_ABIDJAN', 'dispo', 8, null, 0.7),
  (2026, 3, 'GT_ABIDJAN', 'prix', null, 'evap', 0.95),
  (2026, 3, 'GT_ABIDJAN', 'prix', null, 'scm', 0.95),
  (2026, 3, 'GT_ABIDJAN', 'prix', null, 'imp', 0.98),
  (2026, 4, 'GT_ABIDJAN', 'plv_exterieure', null, null, 0.65),
  (2026, 4, 'GT_ABIDJAN', 'plv_interieure', null, null, 0.6),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 4, null, 0.6),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 2, null, 0.9),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 5, null, 0.4),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 3, null, 0.85),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 1, null, 0.6),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 6, null, 0.5),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 14, null, 0.13),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 15, null, 0.62),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 13, null, 0.15),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 12, null, 0.23),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 11, null, 0.55),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 9, null, 0.25),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 7, null, 0.85),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 10, null, 0.6),
  (2026, 4, 'GT_ABIDJAN', 'dispo', 8, null, 0.8),
  (2026, 4, 'GT_ABIDJAN', 'prix', null, 'evap', 0.95),
  (2026, 4, 'GT_ABIDJAN', 'prix', null, 'scm', 0.95),
  (2026, 4, 'GT_ABIDJAN', 'prix', null, 'imp', 0.98),
  (2026, 1, 'GT_UPC', 'plv_exterieure', null, null, 0.85),
  (2026, 1, 'GT_UPC', 'plv_interieure', null, null, 0.7),
  (2026, 1, 'GT_UPC', 'dispo', 4, null, 0.35),
  (2026, 1, 'GT_UPC', 'dispo', 2, null, 0.83),
  (2026, 1, 'GT_UPC', 'dispo', 5, null, 0.25),
  (2026, 1, 'GT_UPC', 'dispo', 3, null, 0.6),
  (2026, 1, 'GT_UPC', 'dispo', 1, null, 0.35),
  (2026, 1, 'GT_UPC', 'dispo', 6, null, 0.33),
  (2026, 1, 'GT_UPC', 'dispo', 14, null, 0.03),
  (2026, 1, 'GT_UPC', 'dispo', 13, null, 0.03),
  (2026, 1, 'GT_UPC', 'dispo', 12, null, 0.05),
  (2026, 1, 'GT_UPC', 'dispo', 11, null, 0.21),
  (2026, 1, 'GT_UPC', 'dispo', 9, null, 0.06),
  (2026, 1, 'GT_UPC', 'dispo', 7, null, 0.68),
  (2026, 1, 'GT_UPC', 'prix', null, 'evap', 0.8),
  (2026, 1, 'GT_UPC', 'prix', null, 'scm', 0.55),
  (2026, 1, 'GT_UPC', 'prix', null, 'imp', 0.87),
  (2026, 2, 'GT_UPC', 'plv_exterieure', null, null, 0.87),
  (2026, 2, 'GT_UPC', 'plv_interieure', null, null, 0.75),
  (2026, 2, 'GT_UPC', 'dispo', 4, null, 0.4),
  (2026, 2, 'GT_UPC', 'dispo', 2, null, 0.85),
  (2026, 2, 'GT_UPC', 'dispo', 5, null, 0.3),
  (2026, 2, 'GT_UPC', 'dispo', 3, null, 0.6),
  (2026, 2, 'GT_UPC', 'dispo', 1, null, 0.5),
  (2026, 2, 'GT_UPC', 'dispo', 6, null, 0.35),
  (2026, 2, 'GT_UPC', 'dispo', 14, null, 0.05),
  (2026, 2, 'GT_UPC', 'dispo', 13, null, 0.05),
  (2026, 2, 'GT_UPC', 'dispo', 12, null, 0.07),
  (2026, 2, 'GT_UPC', 'dispo', 11, null, 0.23),
  (2026, 2, 'GT_UPC', 'dispo', 9, null, 0.1),
  (2026, 2, 'GT_UPC', 'dispo', 7, null, 0.7),
  (2026, 2, 'GT_UPC', 'prix', null, 'evap', 0.85),
  (2026, 2, 'GT_UPC', 'prix', null, 'scm', 0.6),
  (2026, 2, 'GT_UPC', 'prix', null, 'imp', 0.9),
  (2026, 3, 'GT_UPC', 'plv_exterieure', null, null, 0.9),
  (2026, 3, 'GT_UPC', 'plv_interieure', null, null, 0.75),
  (2026, 3, 'GT_UPC', 'dispo', 4, null, 0.45),
  (2026, 3, 'GT_UPC', 'dispo', 2, null, 0.87),
  (2026, 3, 'GT_UPC', 'dispo', 5, null, 0.35),
  (2026, 3, 'GT_UPC', 'dispo', 3, null, 0.65),
  (2026, 3, 'GT_UPC', 'dispo', 1, null, 0.55),
  (2026, 3, 'GT_UPC', 'dispo', 6, null, 0.4),
  (2026, 3, 'GT_UPC', 'dispo', 14, null, 0.07),
  (2026, 3, 'GT_UPC', 'dispo', 13, null, 0.07),
  (2026, 3, 'GT_UPC', 'dispo', 12, null, 0.09),
  (2026, 3, 'GT_UPC', 'dispo', 11, null, 0.25),
  (2026, 3, 'GT_UPC', 'dispo', 9, null, 0.13),
  (2026, 3, 'GT_UPC', 'dispo', 7, null, 0.72),
  (2026, 3, 'GT_UPC', 'dispo', 10, null, 0.45),
  (2026, 3, 'GT_UPC', 'dispo', 8, null, 0.7),
  (2026, 3, 'GT_UPC', 'prix', null, 'evap', 0.9),
  (2026, 3, 'GT_UPC', 'prix', null, 'scm', 0.65),
  (2026, 3, 'GT_UPC', 'prix', null, 'imp', 0.93),
  (2026, 4, 'GT_UPC', 'plv_exterieure', null, null, 0.9),
  (2026, 4, 'GT_UPC', 'plv_interieure', null, null, 0.75),
  (2026, 4, 'GT_UPC', 'dispo', 4, null, 0.5),
  (2026, 4, 'GT_UPC', 'dispo', 2, null, 0.9),
  (2026, 4, 'GT_UPC', 'dispo', 5, null, 0.4),
  (2026, 4, 'GT_UPC', 'dispo', 3, null, 0.7),
  (2026, 4, 'GT_UPC', 'dispo', 1, null, 0.6),
  (2026, 4, 'GT_UPC', 'dispo', 6, null, 0.45),
  (2026, 4, 'GT_UPC', 'dispo', 14, null, 0.1),
  (2026, 4, 'GT_UPC', 'dispo', 15, null, 0.5),
  (2026, 4, 'GT_UPC', 'dispo', 13, null, 0.1),
  (2026, 4, 'GT_UPC', 'dispo', 12, null, 0.1),
  (2026, 4, 'GT_UPC', 'dispo', 11, null, 0.28),
  (2026, 4, 'GT_UPC', 'dispo', 9, null, 0.15),
  (2026, 4, 'GT_UPC', 'dispo', 7, null, 0.75),
  (2026, 4, 'GT_UPC', 'dispo', 10, null, 0.6),
  (2026, 4, 'GT_UPC', 'dispo', 8, null, 0.8),
  (2026, 4, 'GT_UPC', 'prix', null, 'evap', 0.9),
  (2026, 4, 'GT_UPC', 'prix', null, 'scm', 0.7),
  (2026, 4, 'GT_UPC', 'prix', null, 'imp', 0.95),
  (2026, 1, 'MT', 'plv_interieure', null, null, 0.25),
  (2026, 1, 'MT', 'dispo', 4, null, 0.95),
  (2026, 1, 'MT', 'dispo', 2, null, 0.95),
  (2026, 1, 'MT', 'dispo', 5, null, 0.75),
  (2026, 1, 'MT', 'dispo', 3, null, 0.88),
  (2026, 1, 'MT', 'dispo', 1, null, 0.4),
  (2026, 1, 'MT', 'dispo', 6, null, 0.78),
  (2026, 1, 'MT', 'dispo', 13, null, 0.55),
  (2026, 1, 'MT', 'dispo', 12, null, 0.72),
  (2026, 1, 'MT', 'dispo', 11, null, 0.85),
  (2026, 1, 'MT', 'dispo', 9, null, 0.6),
  (2026, 1, 'MT', 'dispo', 7, null, 0.75),
  (2026, 1, 'MT', 'prix', null, 'evap', 0.95),
  (2026, 1, 'MT', 'prix', null, 'imp', 0.95),
  (2026, 2, 'MT', 'plv_interieure', null, null, 0.3),
  (2026, 2, 'MT', 'dispo', 4, null, 0.95),
  (2026, 2, 'MT', 'dispo', 2, null, 0.97),
  (2026, 2, 'MT', 'dispo', 5, null, 0.75),
  (2026, 2, 'MT', 'dispo', 3, null, 0.9),
  (2026, 2, 'MT', 'dispo', 1, null, 0.5),
  (2026, 2, 'MT', 'dispo', 6, null, 0.8),
  (2026, 2, 'MT', 'dispo', 13, null, 0.57),
  (2026, 2, 'MT', 'dispo', 12, null, 0.75),
  (2026, 2, 'MT', 'dispo', 11, null, 0.87),
  (2026, 2, 'MT', 'dispo', 9, null, 0.6),
  (2026, 2, 'MT', 'dispo', 7, null, 0.78),
  (2026, 2, 'MT', 'dispo', 10, null, 0.35),
  (2026, 2, 'MT', 'dispo', 8, null, 0.4),
  (2026, 2, 'MT', 'prix', null, 'evap', 0.95),
  (2026, 2, 'MT', 'prix', null, 'imp', 0.95),
  (2026, 3, 'MT', 'plv_interieure', null, null, 0.3),
  (2026, 3, 'MT', 'dispo', 4, null, 0.96),
  (2026, 3, 'MT', 'dispo', 2, null, 0.98),
  (2026, 3, 'MT', 'dispo', 5, null, 0.75),
  (2026, 3, 'MT', 'dispo', 3, null, 0.9),
  (2026, 3, 'MT', 'dispo', 1, null, 0.55),
  (2026, 3, 'MT', 'dispo', 6, null, 0.85),
  (2026, 3, 'MT', 'dispo', 13, null, 0.6),
  (2026, 3, 'MT', 'dispo', 12, null, 0.77),
  (2026, 3, 'MT', 'dispo', 11, null, 0.88),
  (2026, 3, 'MT', 'dispo', 9, null, 0.6),
  (2026, 3, 'MT', 'dispo', 7, null, 0.8),
  (2026, 3, 'MT', 'dispo', 10, null, 0.4),
  (2026, 3, 'MT', 'dispo', 8, null, 0.5),
  (2026, 3, 'MT', 'prix', null, 'evap', 0.95),
  (2026, 3, 'MT', 'prix', null, 'imp', 0.95),
  (2026, 4, 'MT', 'plv_interieure', null, null, 0.3),
  (2026, 4, 'MT', 'dispo', 4, null, 0.96),
  (2026, 4, 'MT', 'dispo', 2, null, 0.98),
  (2026, 4, 'MT', 'dispo', 5, null, 0.75),
  (2026, 4, 'MT', 'dispo', 3, null, 0.93),
  (2026, 4, 'MT', 'dispo', 1, null, 0.6),
  (2026, 4, 'MT', 'dispo', 6, null, 0.85),
  (2026, 4, 'MT', 'dispo', 13, null, 0.65),
  (2026, 4, 'MT', 'dispo', 12, null, 0.78),
  (2026, 4, 'MT', 'dispo', 11, null, 0.9),
  (2026, 4, 'MT', 'dispo', 9, null, 0.6),
  (2026, 4, 'MT', 'dispo', 7, null, 0.83),
  (2026, 4, 'MT', 'dispo', 10, null, 0.4),
  (2026, 4, 'MT', 'dispo', 8, null, 0.6),
  (2026, 4, 'MT', 'prix', null, 'evap', 0.95),
  (2026, 4, 'MT', 'prix', null, 'imp', 0.95)
on conflict do nothing;

alter table public.objectif_disponibilite enable row level security;
drop policy if exists objectif_disponibilite_read on public.objectif_disponibilite;
create policy objectif_disponibilite_read on public.objectif_disponibilite
  for select to authenticated using (true);
drop policy if exists objectif_disponibilite_write on public.objectif_disponibilite;
create policy objectif_disponibilite_write on public.objectif_disponibilite
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur') and coalesce(p.is_active, true)))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur') and coalesce(p.is_active, true)));
grant select, insert, update, delete on public.objectif_disponibilite to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Canal d'objectif d'un PDV (miroir : utils/objectifsDisponibilite.ts)
-- ---------------------------------------------------------------------------
-- pdv.canal d'abord (Modern trade), puis pdv.region (ABIDJAN 1/2, CNO, CNE, C),
-- à défaut la division du territoire (ABIDJAN / UP COUNTRY). Sinon null.
create or replace function public.canal_objectif(p_canal text, p_region text, p_division text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when lower(coalesce(p_canal, '')) = 'modern trade' then 'MT'
    when upper(coalesce(p_region, '')) like 'ABIDJAN%' then 'GT_ABIDJAN'
    when upper(coalesce(p_region, '')) in ('CNO', 'CNE', 'C', 'NORTH 1', 'NORTH 2') then 'GT_UPC'
    when upper(coalesce(p_division, '')) = 'ABIDJAN' then 'GT_ABIDJAN'
    when upper(coalesce(p_division, '')) = 'UP COUNTRY' then 'GT_UPC'
  end
$function$;

-- ---------------------------------------------------------------------------
-- 3. Réalisé du trimestre
-- ---------------------------------------------------------------------------
-- Une ligne par canal (GT_ABIDJAN, GT_UPC, MT, NATIONAL ; INCONNU = PDV sans
-- canal, sans objectif) × indicateur ; indicateur « base » = PDV relevés. taux et cible en % ; cible NATIONAL =
-- moyenne des canaux qui ont un objectif.
create or replace function public.dashboard_objectifs_disponibilite(p_annee integer, p_trimestre integer, p_territoire text default null)
 returns table(canal text, indicateur text, reference_produit_id integer, reference_nom text, categorie text,
               mesures bigint, atteints bigint, hors_calcul bigint, taux numeric, cible numeric)
 language sql
 stable
 set search_path to 'public'
 set work_mem to '32MB'
as $function$
  with bornes as (
    select make_date(p_annee, (p_trimestre - 1) * 3 + 1, 1) as debut,
           (make_date(p_annee, (p_trimestre - 1) * 3 + 1, 1) + interval '3 months')::date as fin
  ),
  derniere_visite as (
    select distinct on (v.pdv_id) v.pdv_id, v.data, p.sous_categorie_pdv,
      coalesce(public.canal_objectif(p.canal, p.region, rg.nom_affichage), 'INCONNU') as canal
    from bornes b
    join visites v on v.date_visite >= b.debut::timestamptz and v.date_visite < b.fin::timestamptz
    join pdv p on p.pdv_id = v.pdv_id
    left join territoire t on t.code = p.territory_code
    left join sous_region sr on sr.code = t.sous_region_code
    left join region rg on rg.code = sr.region_code
    where jsonb_typeof(v.data->'produits') = 'object'
      and v.data->'produits' <> '{}'::jsonb
      -- Territoire : code (pdv.territory_code) ou nom, sans tenir compte de la casse
      -- (référentiel « Koumassi », pdv.zone « KOUMASSI »).
      and (p_territoire is null or p_territoire = '' or p.territory_code = p_territoire or upper(p.zone) = upper(p_territoire))
    order by v.pdv_id, v.date_visite desc
  ),
  -- Segment et grade du type de PDV (comme dashboard_presence_skus). Les types
  -- hérités de l'ancien formulaire n'ont pas de grade (« Supermarché »,
  -- « Superette MT », « Kiosque »…) et ne correspondent à aucun type_pdv : ils
  -- reçoivent le segment le plus proche et son grade le MOINS exigeant. Une
  -- visite importée (statut texte, sans quantité) ne dépend pas du seuil ; le
  -- segment dit seulement si le produit est attendu dans ce type de PDV.
  segment_du_pdv as (
    select dv.*, coalesce(sg.segment, h.segment) as segment, coalesce(sg.grade, h.grade) as grade,
      coalesce(cp.canal, h.canal, 'GT') as canal_type
    from derniere_visite dv
    left join lateral (
      select candidate.*
      from type_pdv candidate
      where regexp_replace(trim(candidate.nom), '\s+', ' ', 'g')
        = regexp_replace(trim(dv.sous_categorie_pdv), '\s+', ' ', 'g')
      order by (candidate.nom = dv.sous_categorie_pdv) desc
      limit 1
    ) tp on true
    left join categorie_pdv cp on cp.id = tp.categorie_pdv_id
    left join segment_grade_type_pdv sg on sg.type_pdv_id = tp.id
    left join (values
      ('Hypermarché', 'SupermarcheMT', 'A', 'MT'),
      ('Supermarché', 'SupermarcheMT', 'C', 'MT'),
      ('Superette MT', 'SupermarcheMT', 'C', 'MT'),
      ('Superette GT', 'Minimarket', 'B', 'GT'),
      ('Kiosque', 'Kiosque', 'B', 'GT'),
      ('Pushcart', 'Pushcart', 'B', 'GT'),
      ('Aboki', 'Aboki', 'B', 'GT'),
      ('Tabliers', 'TableTop', 'A', 'GT')
    ) as h(type_herite, segment, grade, canal)
      on tp.id is null and h.type_herite = trim(dv.sous_categorie_pdv)
  ),
  -- Disponibilité : PDV où le produit a été relevé (clé présente dans la famille).
  dispo as (
    select sp.canal, rp.id as reference_produit_id, rp.nom as reference_nom, cr.categorie_jsonb as categorie,
      case when sp.canal_type = 'MT' then coalesce(mt.quantite_min, sd.quantite_min) else sd.quantite_min end as seuil,
      mt.facings,
      sp.data->'produits'->cr.categorie_jsonb as releve,
      cr.sku_key
    from segment_du_pdv sp
    join correspondance_reference cr
      on (sp.data->'produits'->cr.categorie_jsonb) ? cr.sku_key
      or (sp.data->'produits'->cr.categorie_jsonb->'quantites') ? cr.sku_key
    join reference_produit rp on rp.id = cr.reference_produit_id
    left join seuil_disponibilite sd on sd.reference_produit_id = rp.id
      and sd.segment = sp.segment and sd.grade = sp.grade
    left join seuil_disponibilite_mt mt on sp.canal_type = 'MT'
      and mt.reference_produit_id = rp.id
      and mt.segment_mt = case sp.grade when 'A' then 'Hypermarche' when 'B' then 'MoyenSuper' when 'C' then 'PetitSuper' end
  ),
  mesures as (
    -- base : points de vente relevés du canal (dénominateur commun de l'écran).
    select dv.canal, 'base'::text as indicateur, null::integer as reference_produit_id, null::text as reference_nom, null::text as categorie,
      count(*) as mesures, 0::bigint as atteints, 0::bigint as hors_calcul
    from derniere_visite dv
    group by 1, 2
    union all
    select d.canal, 'dispo'::text as indicateur, d.reference_produit_id, d.reference_nom, d.categorie,
      count(*) filter (where d.seuil is not null) as mesures,
      count(*) filter (where d.seuil is not null and public.releve_sku_disponible(d.releve, d.sku_key, d.seuil, d.facings)) as atteints,
      count(*) filter (where d.seuil is null) as hors_calcul
    from dispo d
    group by 1, 2, 3, 4, 5
    union all
    select dv.canal, e.indicateur, null::integer, null::text, null::text,
      count(*), count(*) filter (where (dv.data->'visibilite'->e.emplacement->>'presence_visibilite') = 'true'), 0
    from derniere_visite dv
    cross join (values ('plv_exterieure', 'exterieure'), ('plv_interieure', 'interieure')) as e(indicateur, emplacement)
    where (dv.data->'visibilite'->e.emplacement) ? 'presence_visibilite'
    group by 1, 2
    union all
    select dv.canal, 'prix', null::integer, null::text, f.cat,
      count(*), count(*) filter (where (dv.data->'produits'->f.cat->>'prix_respectes') = 'true'), 0
    from derniere_visite dv
    cross join (values ('evap'), ('scm'), ('imp')) as f(cat)
    where (dv.data->'produits'->f.cat->>'present') = 'true'
    group by 1, 2, 3, 4, 5
  ),
  avec_national as (
    select * from mesures
    union all
    select 'NATIONAL', m.indicateur, m.reference_produit_id, max(m.reference_nom), m.categorie,
      sum(m.mesures)::bigint, sum(m.atteints)::bigint, sum(m.hors_calcul)::bigint
    from mesures m
    where m.canal <> 'INCONNU'
    group by m.indicateur, m.reference_produit_id, m.categorie
  ),
  objectifs as (
    select o.canal, o.indicateur, o.reference_produit_id, o.categorie, o.cible
    from objectif_disponibilite o
    where o.annee = p_annee and o.trimestre = p_trimestre
    union all
    select 'NATIONAL', o.indicateur, o.reference_produit_id, o.categorie, avg(o.cible)
    from objectif_disponibilite o
    where o.annee = p_annee and o.trimestre = p_trimestre
    group by o.indicateur, o.reference_produit_id, o.categorie
  )
  select
    coalesce(m.canal, o.canal),
    coalesce(m.indicateur, o.indicateur),
    coalesce(m.reference_produit_id, o.reference_produit_id),
    coalesce(m.reference_nom, rp.nom),
    coalesce(m.categorie, o.categorie, cr.categorie_jsonb),
    coalesce(m.mesures, 0),
    coalesce(m.atteints, 0),
    coalesce(m.hors_calcul, 0),
    round(100.0 * m.atteints / nullif(m.mesures, 0), 1),
    round(100.0 * o.cible, 1)
  from avec_national m
  -- full join : égalités simples (coalesce), seules acceptées par un full join.
  full join objectifs o
    on o.canal = m.canal and o.indicateur = m.indicateur
   and coalesce(o.reference_produit_id, 0) = coalesce(m.reference_produit_id, 0)
   and coalesce(o.categorie, '') = coalesce(case when m.indicateur = 'prix' then m.categorie end, '')
  left join reference_produit rp on rp.id = o.reference_produit_id
  left join lateral (
    select c.categorie_jsonb from correspondance_reference c
    where c.reference_produit_id = coalesce(m.reference_produit_id, o.reference_produit_id) limit 1
  ) cr on true
$function$;

comment on function public.dashboard_objectifs_disponibilite(integer, integer, text) is
  'Réalisé des objectifs de disponibilité d''un trimestre, par canal et indicateur (dernière visite avec relevé de chaque PDV). Admin › Produits › Objectifs.';

grant execute on function public.canal_objectif(text, text, text) to authenticated;
grant execute on function public.dashboard_objectifs_disponibilite(integer, integer, text) to authenticated;

commit;
