-- 20261105130000_friesland_pdv_auteurs.sql
-- Liste admin des PDV : filtre « Créé par » (demande de Jean Luc du 05/11/2026,
-- retrouver les boutiques créées sur le terrain et le compte qui les a créées).
--
-- Une ligne par valeur de pdv.ajoute_par : nom du compte pour un PDV créé dans
-- l'app (« GUI STEPHANE »), e-mail pour le recensement d'août, étiquette
-- d'import (« import-dms-2026-09-29 »). Lecture seule, sans nouvelle donnée.
-- security_invoker : la vue applique les droits de lecture de pdv de celui
-- qui la lit (un compte ne voit que les auteurs des PDV qu'il peut lire).

create or replace view public.v_pdv_auteurs
with (security_invoker = true) as
select
  p.ajoute_par,
  count(*)::int as nb_pdv,
  max(p.created_at) as dernier_ajout
from public.pdv p
where p.is_active
  and p.ajoute_par is not null
  and btrim(p.ajoute_par) <> ''
group by p.ajoute_par;

comment on view public.v_pdv_auteurs is
  'Comptes (ou imports) qui ont ajouté des PDV actifs : options du filtre « Créé par » de la liste admin.';

grant select on public.v_pdv_auteurs to authenticated;
