-- ============================================================================
-- SSF RATTACHÉ À UN COMMERCIAL
--
-- Réunion client du 08/10/2026 : le SSF est le vendeur d'un distributeur (pas
-- un salarié Friesland). Comme le merchandiser, il dépend du commercial (sales
-- officer) responsable des PDV : aucun des deux ne commande l'autre.
-- Le SSF garde son distributeur (ssf.distributeur_id) et reçoit son commercial.
--
-- Remplissage initial : quand tous les merchandisers qui travaillent avec un
-- SSF (règles « SSF — ») ont le même commercial, c'est le sien.
--
-- Idempotent. Additif.
-- ============================================================================
begin;

alter table public.ssf
  add column if not exists commercial_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_ssf_commercial on public.ssf(commercial_id);

comment on column public.ssf.commercial_id is
  'Commercial (sales officer) dont dépend ce SSF, comme les merchandisers de son équipe. Lien organisationnel, sans hiérarchie entre SSF et merchandiser.';

-- Même règle que profiles.commercial_id : un commercial (ou un admin).
create or replace function public.ssf_commercial_id_valide()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_role text;
begin
  if new.commercial_id is null then
    return new;
  end if;
  select role into v_role from public.profiles where id = new.commercial_id;
  if v_role is null then
    raise exception 'Commercial du SSF introuvable';
  end if;
  if v_role not in ('commercial', 'admin') then
    raise exception 'Le SSF doit être rattaché à un commercial (rôle reçu : %)', v_role;
  end if;
  return new;
end $$;

drop trigger if exists trg_ssf_commercial_id_valide on public.ssf;
create trigger trg_ssf_commercial_id_valide
  before insert or update of commercial_id on public.ssf
  for each row execute function public.ssf_commercial_id_valide();

-- Remplissage : commercial unique des merchandisers liés au SSF.
with liens as (
  select t.ssf_id, p.commercial_id
  from public.routing_templates t
  join public.profiles p on p.id = t.user_id
  where t.ssf_id is not null and coalesce(t.is_active, true) and p.commercial_id is not null
  group by t.ssf_id, p.commercial_id
),
uniques as (
  select ssf_id, min(commercial_id::text)::uuid as commercial_id
  from liens group by ssf_id having count(*) = 1
)
update public.ssf s
set commercial_id = u.commercial_id
from uniques u
join public.profiles c on c.id = u.commercial_id and c.role in ('commercial', 'admin')
where s.id = u.ssf_id and s.commercial_id is null;

commit;
