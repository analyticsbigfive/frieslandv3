-- ============================================================================
-- FIX : réaligne pdv.canal sur le canal du référentiel (categorie_pdv.canal).
-- Le canal était saisi librement dans les formulaires (mobile + admin) et
-- pouvait diverger du type de PDV — cas constaté : « Abouakar », canal
-- 'Modern trade' avec type 'Supérette A' (catégorie GT). Le scoring Perfect
-- Store dérive le canal du type ; les pages admin filtrent sur pdv.canal.
-- Les formulaires dérivent désormais le canal de la catégorie ; ce script
-- corrige le stock existant. Idempotent.
-- ============================================================================
begin;

update pdv p
set canal = case cp.canal when 'MT' then 'Modern trade' else 'General trade' end
from type_pdv tp
join categorie_pdv cp on cp.id = tp.categorie_pdv_id
where regexp_replace(trim(tp.nom), '\s+', ' ', 'g')
    = regexp_replace(trim(p.sous_categorie_pdv), '\s+', ' ', 'g')
  and p.canal is distinct from
    (case cp.canal when 'MT' then 'Modern trade' else 'General trade' end);

commit;
