-- ============================================================================
-- ADJAMÉ : QUARTIER DES PDV SANS QUARTIER, ALIAS « QUARTIER ROUGE »
--
-- Retours d'Elias (Atom) du 09/10/2026, soir :
-- 1. Les 153 PDV actifs de la zone ADJAME sans quartier relèvent de BRACODI.
--    Ils sont dispersés (de Dallas à Williamsville) : chacun prend le
--    quartier de son voisin renseigné le plus proche à Adjamé, à 500 m au
--    plus (même règle que l'import des clients DMS) ; sans GPS ou sans
--    voisin assez proche : BRACODI. Au 09/10 : 75 BRACODI (dont 47 sans GPS),
--    28 DALLAS, 28 220 LGTs, 13 WILLIAMSVILLE, 6 MOSQUEE, 2 DELEGATION,
--    1 SAINT MICHEL.
--    L'import DMS ne remplit un quartier que s'il est vide : rien n'écrasera
--    ces valeurs.
-- 2. « Quartier rouge » (Adjamé, derrière la mairie ; GPS 5.3508, -4.0205) :
--    alias vers les quartiers des PDV à moins de 300 m de ce point, hors
--    220 LGTs et Saint Michel qui ont leurs propres jours (samedi S4 d'Abbé
--    avec Tamdia Aliou).
--
-- Retour arrière : update public.pdv set quartier = null where pdv_id in
-- (liste ci-dessous) ; delete from public.alias_import where type =
-- 'quartier' and motif = 'QUARTIER ROUGE'.
-- Idempotent : seuls les PDV de la liste encore sans quartier changent.
-- ============================================================================
begin;

with cibles as (
  select p.pdv_id, p.geolocation_lat lat, p.geolocation_lng lng
  from public.pdv p
  where p.pdv_id in (
    '01f6ec37', '0655bb66', '06e71cda', '09c7de5b', '0b007836', '0bd144cc', '0c325828', '0d2cd114',
    '0d85d2c7', '0de279d9', '10461372', '12119d8e', '13cef3c6', '1457ded5', '18245374', '187800aa',
    '1b4599df', '1b702bce', '1b99b77a', '1ea15c55', '1f3e6d6a', '24ee2bc2', '2aef57e1', '2bf63654',
    '30711196', '315db662', '33628aa2', '349084fa', '34bb1c6e', '3646c100', '377548de', '3783a9ed',
    '3797e74e', '3853bda2', '38ca7ea2', '38e5c70d', '3ae0c1c5', '3ba9aa31', '3d2183c2', '3f24530e',
    '3f3bd8ac', '40144939', '43be4100', '45c5886b', '46ef2aba', '4830733d', '4c971471', '504ba7eb',
    '516a7e76', '55a51165', '5695082d', '5820172f', '5b7e9eeb', '5dc9a78b', '5ec1a523', '61bc55b7',
    '62580295', '62580c2e', '63ba7ac5', '67b10645', '69a74115', '6bf3e175', '70de72fb', '71002da5',
    '72162492', '723399c0', '7570266e', '77ed8a89', '7853d473', '7ac77c96', '7d5977e3', '80d8b6fc',
    '8104fac2', '81340a43', '81aea488', '82bfe977', '8387f67a', '8716756a', '877a4bc8', '8789a8e5',
    '8b4b5925', '8c49d41e', '8c89dc5f', '917f449e', '91a6ac9f', '93b6ceb7', '9baf792d', '9c2641f1',
    '9d297b61', '9d3bef3a', '9da5b631', '9dcf1872', '9f8af127', 'a149e41d', 'a1fe2c31', 'a20d9500',
    'a218e42a', 'a361730e', 'a5a308e0', 'a6d22b36', 'a90c0fac', 'aabaef3c', 'ab2806b5', 'ab679f74',
    'ac36af23', 'b0a11dec', 'b11dd647', 'b227f384', 'b304cfe5', 'b6f98a6d', 'bbb1a9ba', 'bd19f726',
    'bf1e9aec', 'c1578191', 'c434a268', 'c542011f', 'c954948c', 'cad0ca25', 'cb7f3411', 'ce08bf9c',
    'cebeebfe', 'cf24c841', 'd3027c29', 'd32dacbe', 'd60899c6', 'd83944ff', 'd9cf24b7', 'da292a7d',
    'daf17bb3', 'db96a864', 'dd5815a2', 'df81caf4', 'e32e6bc6', 'e473b3c8', 'e4ca87fa', 'e5afc00f',
    'e6b85abe', 'e6fe7e15', 'eaac8f36', 'ecc25c01', 'eeb9a05f', 'f10a6629', 'f3fadb21', 'f551ee61',
    'f887aead', 'f97a7de4', 'f97d48eb', 'fbf65c28', 'fc5f78a7', 'fe92f84f', 'fed17c08', 'ff0de058',
    'ffdb0c37'
  )
    and upper(p.zone) = 'ADJAME'
    and coalesce(trim(p.quartier), '') = ''
),
voisins as (
  select c.pdv_id, v.quartier, v.m
  from cibles c
  left join lateral (
    select r.quartier,
      6371000 * 2 * asin(sqrt(power(sin(radians(r.geolocation_lat - c.lat) / 2), 2)
        + cos(radians(c.lat)) * cos(radians(r.geolocation_lat)) * power(sin(radians(r.geolocation_lng - c.lng) / 2), 2))) m
    from public.pdv r
    where c.lat is not null
      and r.is_active and upper(r.zone) = 'ADJAME'
      and coalesce(trim(r.quartier), '') <> '' and r.geolocation_lat is not null
    order by (r.geolocation_lat - c.lat) ^ 2 + (r.geolocation_lng - c.lng) ^ 2
    limit 1
  ) v on true
)
update public.pdv p
set quartier = case when v.m <= 500 then v.quartier else 'BRACODI' end
from voisins v
where p.pdv_id = v.pdv_id;

insert into public.alias_import (type, motif, mode, cible, commentaire) values
  ('quartier', 'QUARTIER ROUGE', 'exact', 'ADJAME›RENAULT | ADJAME›FORUM | ADJAME›MARCHE GOURO',
   'Adjamé, derrière la mairie (5.3508, -4.0205) : quartiers des PDV à moins de 300 m. Confirmé par Atom le 09/10/2026')
on conflict (type, motif, mode) do update set cible = excluded.cible, commentaire = excluded.commentaire;

commit;
