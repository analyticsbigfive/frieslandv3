-- ============================================================================
-- LOT 3 (1.0.4) : CONSULTATION COMMERCIALE — actions décidées par le commercial
--
-- 3.5  action_commerciale : PDV, visite d'origine, auteur, type, merchandiseur
--      assigné, échéance, statut, commentaire. Le type vient d'un référentiel
--      configurable `type_action_commerciale` (le client n'a pas figé la liste),
--      pré-rempli : activation SSR, activation SSM, référencement produit.
--
-- Périmètre : pdv_dans_perimetre(pdv_id) généralise pdv_dans_perimetre_commercial
-- (lot 2) à tout rôle actif — admin/superviseur voient tout, les rôles terrain
-- voient leur périmètre territoires + quartiers (même règle que pdvInScope).
--
-- Écriture : commercial, admin, superviseur créent ; l'auteur, l'assigné et les
-- privilégiés mettent à jour (l'assigné pour passer l'action à « faite ») ;
-- seul l'admin supprime. Le commentaire du merchandiseur (3.4) vit dans
-- visites.data.commentaires : aucun schéma à ajouter.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Périmètre générique
-- ---------------------------------------------------------------------------
create or replace function public.pdv_dans_perimetre(p_pdv_id text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  with moi as (
    select pr.role,
      case
        when jsonb_typeof(pr.territoires_assignes) = 'array'
             and jsonb_array_length(pr.territoires_assignes) > 0
          then (select array_agg(t) from jsonb_array_elements_text(pr.territoires_assignes) t where t <> '')
        when pr.zone_assignee is not null and pr.zone_assignee <> ''
          then array[pr.zone_assignee]
        else array[]::text[]
      end as territoires,
      case
        when jsonb_typeof(pr.quartiers_assignes) = 'array'
          then (select coalesce(array_agg(q), array[]::text[]) from jsonb_array_elements_text(pr.quartiers_assignes) q where q <> '')
        else array[]::text[]
      end as quartiers
    from public.profiles pr
    where pr.id = auth.uid() and pr.is_active = true
  )
  select exists (
    select 1
    from moi m
    left join public.pdv p on p.pdv_id = p_pdv_id
    where m.role in ('admin','superviseur')
       or (
         p.pdv_id is not null
         and (cardinality(m.territoires) = 0 or p.zone = any(m.territoires))
         and (cardinality(m.quartiers) = 0 or p.quartier is null or p.quartier = any(m.quartiers))
       )
  );
$$;
revoke all on function public.pdv_dans_perimetre(text) from public;
grant execute on function public.pdv_dans_perimetre(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Référentiel des types d'action
-- ---------------------------------------------------------------------------
create table if not exists public.type_action_commerciale (
  code    text primary key,
  libelle text not null,
  ordre   integer not null default 100,
  actif   boolean not null default true
);
comment on table public.type_action_commerciale is
  'Types d''action qu''un commercial peut décider après consultation d''une visite. Paramétrable depuis l''admin, aucune liste figée dans le code.';

alter table public.type_action_commerciale enable row level security;
drop policy if exists type_action_commerciale_read on public.type_action_commerciale;
create policy type_action_commerciale_read on public.type_action_commerciale
  for select to authenticated using (true);
drop policy if exists type_action_commerciale_write on public.type_action_commerciale;
create policy type_action_commerciale_write on public.type_action_commerciale
  for all to authenticated
  using (est_gestionnaire_perfect_store())
  with check (est_gestionnaire_perfect_store());

insert into public.type_action_commerciale (code, libelle, ordre) values
  ('activation_ssr', 'Activation SSR', 10),
  ('activation_ssm', 'Activation SSM', 20),
  ('referencement_produit', 'Référencement produit', 30)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Actions commerciales
-- ---------------------------------------------------------------------------
create table if not exists public.action_commerciale (
  id          uuid primary key default gen_random_uuid(),
  pdv_id      text not null references public.pdv(pdv_id) on delete cascade,
  visite_id   uuid references public.visites(id) on delete set null,
  auteur_id   uuid not null references public.profiles(id) on delete cascade,
  type_code   text not null references public.type_action_commerciale(code),
  assigne_a   uuid references public.profiles(id) on delete set null,
  echeance    date,
  statut      text not null default 'a_faire'
              check (statut in ('a_faire','en_cours','faite','annulee')),
  commentaire text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.action_commerciale is
  'Action décidée par un commercial (ou un privilégié) sur un PDV, éventuellement à partir d''une visite, assignée à un merchandiseur.';

create index if not exists idx_action_commerciale_pdv on public.action_commerciale (pdv_id, statut);
create index if not exists idx_action_commerciale_assigne on public.action_commerciale (assigne_a, statut);
create index if not exists idx_action_commerciale_auteur on public.action_commerciale (auteur_id, created_at desc);

create or replace function public.action_commerciale_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_action_commerciale_touch on public.action_commerciale;
create trigger trg_action_commerciale_touch
  before update on public.action_commerciale
  for each row execute function public.action_commerciale_touch();

alter table public.action_commerciale enable row level security;

drop policy if exists action_commerciale_select on public.action_commerciale;
create policy action_commerciale_select on public.action_commerciale
  for select to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.pdv_dans_perimetre(pdv_id)
  );

drop policy if exists action_commerciale_insert on public.action_commerciale;
create policy action_commerciale_insert on public.action_commerciale
  for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and public.role_actif_courant() in ('commercial','admin','superviseur')
    and public.pdv_dans_perimetre(pdv_id)
  );

drop policy if exists action_commerciale_update on public.action_commerciale;
create policy action_commerciale_update on public.action_commerciale
  for update to authenticated
  using (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin','superviseur')
  )
  with check (
    auteur_id = auth.uid()
    or assigne_a = auth.uid()
    or public.role_actif_courant() in ('admin','superviseur')
  );

drop policy if exists action_commerciale_delete on public.action_commerciale;
create policy action_commerciale_delete on public.action_commerciale
  for delete to authenticated
  using (public.role_actif_courant() = 'admin');

commit;
