-- ============================================================================
-- RBAC : la section 'administration' devient 'parametres'.
-- Réorganisation du dashboard : les pages de statistiques (pdv, visites,
-- perfect-store, visibilite, concurrence, produits) restent des sections
-- dédiées ; tout le paramétrage (standards Perfect Store, seuils stock,
-- référentiels, utilisateurs, permissions, import/export) est regroupé sous
-- la clé 'parametres'. La carte rejoint 'principal'.
-- ============================================================================
begin;

-- Reprend la valeur de l'ancienne ligne sans écraser une ligne 'parametres'
-- déjà présente.
insert into public.role_section_access(role, section, can_access, updated_at)
select role, 'parametres', can_access, now()
from public.role_section_access
where section = 'administration'
on conflict (role, section) do nothing;

delete from public.role_section_access where section = 'administration';

commit;
