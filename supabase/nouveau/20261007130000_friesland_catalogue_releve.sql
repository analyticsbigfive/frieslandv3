-- ============================================================================
-- PRODUITS DU FORMULAIRE DE VISITE pilotés par l'admin
--
-- Jusqu'ici, les SKU de chaque catégorie (EVAP, IMP, SCM, UHT…) étaient codés
-- en dur dans l'app (cinq listes qui avaient divergé) : ajouter, renommer ou
-- retirer un produit demandait une nouvelle version de l'app.
--
-- `sku_thresholds` (déjà indexée par les clés de visites.data.produits.<cat>,
-- éditée par l'écran des seuils) devient le CATALOGUE du formulaire :
--   - libellé, ordre, actif, seuil « stock bas » par SKU ;
--   - clés (category, sku) FIGÉES : ce sont les clés des visites enregistrées ;
--   - pas de suppression : un SKU se désactive (l'historique reste lisible) ;
--   - un SKU noté au Perfect Store (correspondance_reference) ne peut pas être
--     désactivé : toutes les nouvelles visites le noteraient à 0.
-- `categorie_releve` : nouvelle colonne `facings` (saisie des facings en MT),
-- et le code n'est plus limité aux six catégories d'origine (une nouvelle
-- catégorie est saisie et exportée, mais pas notée au Perfect Store).
--
-- Le calcul Perfect Store ne change pas : il lit les quantités à travers
-- correspondance_reference, par les mêmes clés.
--
-- Idempotent. L'app 1.0.10 garde ses listes codées en dur (rien ne casse).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Catégories
-- ---------------------------------------------------------------------------
do $$
declare v text;
begin
  for v in
    select conname from pg_constraint
    where conrelid = 'public.categorie_releve'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%evap%'
  loop
    execute format('alter table public.categorie_releve drop constraint %I', v);
  end loop;
end $$;

alter table public.categorie_releve drop constraint if exists categorie_releve_code_format;
alter table public.categorie_releve add constraint categorie_releve_code_format
  check (code ~ '^[a-z][a-z0-9_]{1,30}$');

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categorie_releve' and column_name = 'facings'
  ) then
    alter table public.categorie_releve add column facings boolean not null default false;
    -- Comportement actuel : facings saisis en Modern Trade pour EVAP, IMP, SCM.
    update public.categorie_releve set facings = true where code in ('evap', 'imp', 'scm');
  end if;
end $$;

comment on column public.categorie_releve.facings is
  'Saisie des facings (nombre de faces en rayon) dans le formulaire, pour les PDV Modern Trade.';

-- ---------------------------------------------------------------------------
-- 2. Catalogue des SKU
-- ---------------------------------------------------------------------------
alter table public.sku_thresholds add column if not exists actif boolean not null default true;

alter table public.sku_thresholds drop constraint if exists sku_thresholds_sku_format;
alter table public.sku_thresholds add constraint sku_thresholds_sku_format
  check (sku ~ '^[a-z0-9_]+$' and sku not in ('present', 'prix_respectes', 'quantites', 'facings')) not valid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sku_thresholds_categorie_fk') then
    -- not valid : les lignes historiques ne sont pas revérifiées.
    alter table public.sku_thresholds add constraint sku_thresholds_categorie_fk
      foreign key (category) references public.categorie_releve(code) not valid;
  end if;
end $$;

comment on table public.sku_thresholds is
  'Catalogue des produits du formulaire de visite : un SKU par (catégorie, clé), libellé, ordre, actif, seuil « stock bas ». Clés figées (visites.data.produits.<category>.quantites.<sku>).';

-- Les 26 SKU du formulaire, libellés tels qu'affichés sur le téléphone (1.0.10).
insert into public.sku_thresholds (category, sku, label, ordre, actif) values
  ('evap', 'br_gold', 'BR Gold', 1, true),
  ('evap', 'br_160g', 'BR 150g', 2, true),
  ('evap', 'brb_160g', 'BRB 150g', 3, true),
  ('evap', 'br_400g', 'BR 380g', 4, true),
  ('evap', 'brb_400g', 'BRB 380g', 5, true),
  ('evap', 'pearl_400g', 'Pearl 380g', 6, true),
  ('imp', 'br_400g', 'BR tin 2500g', 1, true),
  ('imp', 'br_20g', 'BR 15g', 2, true),
  ('imp', 'brb_25g', 'BRB 16g', 3, true),
  ('imp', 'br_375g', 'BR 360g', 4, true),
  ('imp', 'br_900g', 'BR 400g Tin', 5, true),
  ('imp', 'brb_400g', 'BRB 360g', 6, true),
  ('imp', 'br_2_5kg', 'BR 900g Tin', 7, true),
  ('imp', 'brd_15g', 'BRD 15g', 8, true),
  ('imp', 'brd_350g', 'BR Délice Pouch 350g', 9, true),
  ('scm', 'pearl_1kg', 'Pearl 1Kg', 1, true),
  ('scm', 'br_1kg', 'BR 1Kg', 2, true),
  ('uht', 'demi_ecreme', 'BR 516ml', 1, true),
  ('uht', 'elopack_500ml', 'Elopack 500 ml', 2, true),
  ('uht', 'brique_1l', 'Brique 1L', 3, true),
  ('yaourt', 'br_yogoo_fraise_mini_90ml', 'BR Yogoo fraise mini 90 ml', 1, true),
  ('yaourt', 'br_yogoo_fraise_maxi_318ml', 'BR Yogoo fraise maxi 318 ml', 2, true),
  ('yaourt', 'br_yogoo_nature_mini_90ml', 'BR Yogoo nature mini 90 ml', 3, true),
  ('yaourt', 'br_yogoo_nature_maxi_318ml', 'BR Yogoo nature maxi 318 ml', 4, true),
  ('cereales', 'brcv', 'Céréales BRCV', 1, true),
  ('cereales', 'brcc', 'Céréales BRCC', 2, true)
on conflict (category, sku) do update
  set label = excluded.label, ordre = excluded.ordre, actif = true;

-- Lignes périmées de l'ancien seed (SCM = 2 produits depuis le 15/07).
update public.sku_thresholds set actif = false
where category = 'scm' and sku in ('brb_1kg', 'br_397g', 'brb_397g');

create or replace function public.proteger_sku_catalogue()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category is distinct from old.category or new.sku is distinct from old.sku then
    raise exception 'La clé d''un produit (catégorie, clé) est figée : elle est enregistrée dans les visites. Désactivez-le et créez-en un autre.';
  end if;
  if old.actif and not new.actif and exists (
    select 1 from correspondance_reference c where c.categorie_jsonb = new.category and c.sku_key = new.sku
  ) then
    raise exception 'Ce produit est noté au Perfect Store (correspondance « % / % ») : retirez d''abord la correspondance dans Référentiels › Perfect Store, sinon toutes les nouvelles visites le noteraient à 0.', new.category, new.sku;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proteger_sku_catalogue on public.sku_thresholds;
create trigger trg_proteger_sku_catalogue
  before update on public.sku_thresholds
  for each row execute function public.proteger_sku_catalogue();

-- Écriture : création et modification seulement (on désactive, on ne supprime pas).
drop policy if exists sku_thresholds_write on public.sku_thresholds;
drop policy if exists sku_thresholds_insert on public.sku_thresholds;
create policy sku_thresholds_insert on public.sku_thresholds
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));
drop policy if exists sku_thresholds_update on public.sku_thresholds;
create policy sku_thresholds_update on public.sku_thresholds
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superviseur')));
grant select, insert, update on public.sku_thresholds to authenticated;

commit;
