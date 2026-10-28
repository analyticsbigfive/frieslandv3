-- ============================================================================
-- DÉCOUPAGE DÉFINITIF : zone_assignee des profils encore sur Cocody 1 / Cocody 2
--
-- 20261028140000 a renommé le libellé des boutiques COCODY 1 et COCODY 2 en
-- COCODY (fusion du fichier final). L'app mobile 1.0.15 filtre la liste des
-- boutiques sur pdv.zone = profiles.zone_assignee, au caractère près : les
-- 5 merchandisers restés sur « COCODY 1 » ou « COCODY 2 » ne voyaient plus
-- aucune boutique. Leur zone_assignee passe à COCODY ; leurs quartiers ne
-- changent pas. Valeur d'avant gardée dans decoupage_avant_20261028.
-- Idempotente.
-- ============================================================================
begin;

insert into public.decoupage_avant_20261028 (objet, cle, donnees)
select 'profil_zone_assignee', p.id::text, jsonb_build_object('email', p.email, 'role', p.role, 'zone_assignee', p.zone_assignee)
from public.profiles p where p.zone_assignee in ('COCODY 1', 'COCODY 2', 'Cocody 1', 'Cocody 2')
on conflict do nothing;

update public.profiles set zone_assignee = 'COCODY'
where zone_assignee in ('COCODY 1', 'COCODY 2', 'Cocody 1', 'Cocody 2');

commit;
