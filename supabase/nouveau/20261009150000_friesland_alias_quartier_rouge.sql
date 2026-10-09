-- ============================================================================
-- ALIAS « QUARTIER ROUGE » (Adjamé) — retour d'Atom du 09/10/2026
--
-- Samedi S4 d'Abbé Frédéric avec Tamdia Aliou. Elias : « Quartier rouge »,
-- sous-quartier d'Adjamé derrière la mairie, GPS 5.3508, -4.0205. Aucun
-- quartier des PDV ne porte ce nom : l'alias vise les quartiers des PDV à
-- moins de 300 m de ce point, hors 220 LGTs et Saint Michel qui ont leurs
-- propres jours (choix de l'utilisateur, 09/10).
--
-- Les 153 PDV d'Adjamé sans quartier ne sont PAS modifiés : en attente de la
-- validation d'Elias. Idempotent.
-- ============================================================================
begin;

insert into public.alias_import (type, motif, mode, cible, commentaire) values
  ('quartier', 'QUARTIER ROUGE', 'exact', 'ADJAME›RENAULT | ADJAME›FORUM | ADJAME›MARCHE GOURO',
   'Adjamé, derrière la mairie (5.3508, -4.0205) : quartiers des PDV à moins de 300 m. Confirmé par Atom le 09/10/2026')
on conflict (type, motif, mode) do update set cible = excluded.cible, commentaire = excluded.commentaire;

commit;
