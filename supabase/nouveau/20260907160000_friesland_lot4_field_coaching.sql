-- ============================================================================
-- LOT 4 (1.0.4) : FIELD COACHING — transposition du questionnaire Kobo
-- « QUESTIONNAIRE DE SUIVI DES ACTIVITES DE PROSPECTION (Rooting) »
--
-- Branché sur les référentiels existants (plan 4.2) :
--   superviseur  -> profiles (compte connecté ou choisi)
--   distributeur -> table distributeur
--   engin        -> nouveau référentiel engin_vente
--   PDV          -> pdv (pdv_id), commune/quartier/rue pré-remplis, éditables
--   SKU dispo    -> reference_produit (ids), copie du nom pour l'historique
-- Les 13 questions Oui / Non / Non applicable sont stockées en JSONB
-- { code: 'oui'|'non'|'na' } avec les codes de utils/fieldCoaching.ts, pour
-- rester comparables avec l'historique Kobo.
--
-- Transfert (4.4) : `assigne_a` porte la charge courante, `auteur_id` reste
-- l'auteur d'origine ; field_coaching_transfert garde l'historique.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

create table if not exists public.engin_vente (
  code    text primary key,
  libelle text not null,
  ordre   integer not null default 100,
  actif   boolean not null default true
);
alter table public.engin_vente enable row level security;
drop policy if exists engin_vente_read on public.engin_vente;
create policy engin_vente_read on public.engin_vente for select to authenticated using (true);
drop policy if exists engin_vente_write on public.engin_vente;
create policy engin_vente_write on public.engin_vente for all to authenticated
  using (est_gestionnaire_perfect_store()) with check (est_gestionnaire_perfect_store());
insert into public.engin_vente (code, libelle, ordre) values
  ('van', 'Van', 10), ('mini_van', 'Mini Van', 20), ('tricycle', 'Tricycle', 30),
  ('moto', 'Moto', 40), ('truck', 'Truck', 50)
on conflict (code) do nothing;

create table if not exists public.field_coaching (
  id                  uuid primary key default gen_random_uuid(),
  date_coaching       timestamptz not null default now(),
  auteur_id           uuid not null references public.profiles(id) on delete cascade,
  superviseur_id      uuid references public.profiles(id) on delete set null,
  assigne_a           uuid references public.profiles(id) on delete set null,
  distributeur_id     bigint,
  distributeur_nom    text,
  engin_code          text references public.engin_vente(code),
  pdv_id              text not null references public.pdv(pdv_id) on delete cascade,
  route_jour          text,
  type_pdv            text,
  commune             text,
  quartier            text,
  rue                 text,
  proche_de           text,
  proprietaire_nom    text,
  proprietaire_prenom text,
  proprietaire_tel    text,
  nb_sku_pdv          integer,
  nb_sku_dispo        integer,
  skus_disponibles    jsonb not null default '[]'::jsonb,
  reponses            jsonb not null default '{}'::jsonb,
  commentaire         text,
  image_urls          text[] not null default '{}',
  statut              text not null default 'soumis' check (statut in ('soumis','valide')),
  geolocation_lat     double precision,
  geolocation_lng     double precision,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.field_coaching is 'Field coaching (ex-Kobo) : identification superviseur / vendeur / PDV / propriétaire puis évaluation Maximise Distribution (13 questions Oui/Non/NA).';
create index if not exists idx_field_coaching_pdv on public.field_coaching (pdv_id, date_coaching desc);
create index if not exists idx_field_coaching_assigne on public.field_coaching (assigne_a);
create index if not exists idx_field_coaching_auteur on public.field_coaching (auteur_id, date_coaching desc);
create index if not exists idx_field_coaching_date on public.field_coaching (date_coaching desc);

drop trigger if exists trg_field_coaching_touch on public.field_coaching;
create trigger trg_field_coaching_touch before update on public.field_coaching
  for each row execute function public.action_commerciale_touch();

create table if not exists public.field_coaching_transfert (
  id          uuid primary key default gen_random_uuid(),
  coaching_id uuid not null references public.field_coaching(id) on delete cascade,
  de_user     uuid references public.profiles(id) on delete set null,
  vers_user   uuid not null references public.profiles(id) on delete cascade,
  par_user    uuid not null references public.profiles(id) on delete cascade,
  motif       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_field_coaching_transfert_coaching on public.field_coaching_transfert (coaching_id, created_at desc);

alter table public.field_coaching enable row level security;
alter table public.field_coaching_transfert enable row level security;

drop policy if exists field_coaching_select on public.field_coaching;
create policy field_coaching_select on public.field_coaching for select to authenticated
  using (auteur_id = auth.uid() or assigne_a = auth.uid() or superviseur_id = auth.uid()
         or public.pdv_dans_perimetre(pdv_id));

drop policy if exists field_coaching_insert on public.field_coaching;
create policy field_coaching_insert on public.field_coaching for insert to authenticated
  with check (auteur_id = auth.uid()
              and public.role_actif_courant() in ('superviseur','commercial','admin'));

drop policy if exists field_coaching_update on public.field_coaching;
create policy field_coaching_update on public.field_coaching for update to authenticated
  using (auteur_id = auth.uid() or assigne_a = auth.uid()
         or public.role_actif_courant() in ('admin','superviseur'))
  with check (auteur_id = auth.uid() or assigne_a = auth.uid()
              or public.role_actif_courant() in ('admin','superviseur'));

drop policy if exists field_coaching_delete on public.field_coaching;
create policy field_coaching_delete on public.field_coaching for delete to authenticated
  using (public.role_actif_courant() = 'admin');

drop policy if exists field_coaching_transfert_select on public.field_coaching_transfert;
create policy field_coaching_transfert_select on public.field_coaching_transfert for select to authenticated
  using (exists (select 1 from public.field_coaching c where c.id = coaching_id));

drop policy if exists field_coaching_transfert_insert on public.field_coaching_transfert;
create policy field_coaching_transfert_insert on public.field_coaching_transfert for insert to authenticated
  with check (par_user = auth.uid()
              and exists (select 1 from public.field_coaching c where c.id = coaching_id
                          and (c.auteur_id = auth.uid() or c.assigne_a = auth.uid()
                               or public.role_actif_courant() in ('admin','superviseur'))));

-- Transfert atomique : met à jour la charge et écrit l'historique.
create or replace function public.transferer_field_coaching(p_coaching_id uuid, p_vers uuid, p_motif text default null)
returns void
language plpgsql security invoker
set search_path = public
as $$
declare v_de uuid;
begin
  select assigne_a into v_de from public.field_coaching where id = p_coaching_id;
  if not found then raise exception 'coaching introuvable'; end if;
  update public.field_coaching set assigne_a = p_vers where id = p_coaching_id;
  if not found then raise exception 'transfert refusé'; end if;
  insert into public.field_coaching_transfert (coaching_id, de_user, vers_user, par_user, motif)
  values (p_coaching_id, v_de, p_vers, auth.uid(), p_motif);
end $$;
grant execute on function public.transferer_field_coaching(uuid, uuid, text) to authenticated;

commit;
