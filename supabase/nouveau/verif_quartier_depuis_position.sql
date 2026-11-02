-- ============================================================================
-- SUIVI : QUARTIER D'APRÈS LA POSITION VALIDÉE À LA VISITE (lecture seule)
--
-- Contexte (02/11/2026) : 416 points de vente hors Atom ont un quartier qui ne
-- correspond pas à l'endroit où tombe leur GPS (liste du Google Sheet « Points
-- de vente mal placés hors Atom – 02/11/2026 », onglet « Liste nominative »).
-- Jean Luc demande l'accord de Friesland avant toute correction ; en
-- attendant, les merchandisers fixent la vraie position à leur visite
-- (pdv_gps_depuis_visite : gps_source = 'terrain' ou 'visite_validee').
--
-- Pour chaque point de vente de la liste dont la position a été fixée par une
-- visite depuis le 02/11, propose le quartier comme pour Atom (« quartier =
-- point le plus proche ») : le quartier du même territoire (pdv.zone), porté
-- par au moins 5 points de vente actifs, dont le centre (latitude et
-- longitude médianes de ces points de vente) est le plus proche de la
-- position validée. Les quartiers utilisés sont ceux déjà saisis dans la base,
-- donc ceux des listes des merchandisers.
--
-- Limite : le quartier proposé reste dans le territoire de la fiche. Depuis la
-- migration 20261102160000 (accord de Friesland), 119 de ces points de vente
-- ont déjà leur quartier corrigé, territoire compris pour Daloa, Noé, Maféré
-- et Grand-Bassam : pour eux, la requête sert de contrôle.
--
-- Ne modifie rien. À relancer pour mettre à jour l'onglet « Suivi des visites ».
-- ============================================================================
with liste(pdv_id) as (values
    ('0028e1ea'), ('003c6580'), ('00b90707'), ('03c22c71'), ('03fcd40b'), ('042330a1'), ('0464c0a5'), ('0476fa0b'),
    ('04b59c14'), ('06112c62'), ('0759d2c8'), ('0818c147'), ('083b672b'), ('08ffc948'), ('091863cc'), ('09987715'),
    ('09fbf2c2'), ('0a80bc2a'), ('0bad3c35'), ('0c47c16c'), ('0c50907e'), ('0caa68fb'), ('0ce199d5'), ('0dfbdb90'),
    ('126fd1e6'), ('12e9b96d'), ('130e47ac'), ('14bbc615'), ('15155ca9'), ('16115005'), ('1614fa7e'), ('16d175bf'),
    ('18502a90'), ('1875db1f'), ('18aa8788'), ('18d69cd6'), ('19179474'), ('19322d3a'), ('1979ba0b'), ('1bc21d29'),
    ('1bd8b535'), ('1c1f8e15'), ('1ca7c565'), ('1ccd17ca'), ('1d010393'), ('1d096f65'), ('1dac0a71'), ('1ded16a7'),
    ('1f595ad7'), ('1f71d655'), ('221f32c3'), ('223aaf55'), ('22957315'), ('22f3e31e'), ('23746a81'), ('25d845f9'),
    ('26b26fc4'), ('26ee123c'), ('27d5254d'), ('28127fbf'), ('28a0a581'), ('28a712d1'), ('292a62df'), ('2a3463e4'),
    ('2b524ae8'), ('2cc68dbc'), ('2cf18999'), ('2d8abb87'), ('2e2286e0'), ('2e3b3625'), ('2ed43e52'), ('2f625f25'),
    ('30fd0d95'), ('31811c25'), ('322e7fb6'), ('3392cc3a'), ('3483c627'), ('35121d3b'), ('3636083b'), ('3674f9ae'),
    ('36805eb1'), ('36f7c7fd'), ('373b2061'), ('37a55a45'), ('38b06b94'), ('38ba28e0'), ('38c0badf'), ('39a8581b'),
    ('39e1e8fc'), ('3bb7560b'), ('3ccabe89'), ('3dc1356c'), ('3de0159f'), ('3fac6289'), ('3fbf139f'), ('4162bb8e'),
    ('41bd11ca'), ('426b2c65'), ('42788408'), ('42dddb06'), ('43211bd8'), ('43b39f8e'), ('43fd4666'), ('44894850'),
    ('45f17b40'), ('47f85880'), ('47fc40c6'), ('48df9ac6'), ('4915d58f'), ('4a4d7017'), ('4a6a3d48'), ('4c7d2217'),
    ('4cf7d98f'), ('4d264ceb'), ('4dad0a2c'), ('4de903cc'), ('4e103466'), ('4ed72133'), ('4f4fd104'), ('508a3cd9'),
    ('50bbdde9'), ('52191d51'), ('52373b5f'), ('524f0d98'), ('5257392e'), ('52b31866'), ('5346e6b6'), ('545be3e1'),
    ('54d55a2d'), ('54db44ad'), ('554dd450'), ('55dba2b5'), ('565df68d'), ('5673dfc4'), ('5687369e'), ('56c67886'),
    ('573c8824'), ('5900ba52'), ('59646a93'), ('5adcffa8'), ('5c26c8d7'), ('5d05c746'), ('5d401b2a'), ('5e1f8ad7'),
    ('5e5208d2'), ('5eb126d2'), ('5ed0aa12'), ('5f1aa301'), ('5f7724c7'), ('6028d08d'), ('6044e134'), ('60771dcc'),
    ('611d56fd'), ('6151d903'), ('61fa7bd2'), ('620d5b31'), ('6303b3e6'), ('63d931ea'), ('64a962cf'), ('656cc63a'),
    ('65a6e885'), ('65fbb5e6'), ('6643ab06'), ('669dd2fa'), ('67554297'), ('67d7bcbd'), ('69a6f71f'), ('69b3efc9'),
    ('6a1277d8'), ('6a481ec9'), ('6b463e95'), ('6b72be09'), ('6cb92e6d'), ('6ce589f2'), ('6cef9de4'), ('6edbc91c'),
    ('6eecc082'), ('6f3262c3'), ('6fb31053'), ('70e3e6d8'), ('71619135'), ('731ddd84'), ('7344704e'), ('73edcc3e'),
    ('75abb2f5'), ('75f99195'), ('76894a14'), ('773d3519'), ('7756f804'), ('77ca0ca4'), ('77d3ee0e'), ('784b4ca7'),
    ('78e2f0b9'), ('793565a6'), ('7943cc53'), ('79759867'), ('798ca86f'), ('7a418221'), ('7af01556'), ('7b127292'),
    ('7b6c6c80'), ('7bb53f4d'), ('7bf7b467'), ('7c0d3d0f'), ('7db9892f'), ('7f52178f'), ('7fc11d80'), ('80e82c42'),
    ('80ee0482'), ('810bc544'), ('812dda2c'), ('8239d7e7'), ('82db6ae1'), ('8344860b'), ('848be522'), ('85472a26'),
    ('85481344'), ('86337034'), ('86a336ac'), ('86e5de56'), ('87883fad'), ('87d85ea6'), ('88dd8b4e'), ('89415d62'),
    ('89c46a0f'), ('8ac24b66'), ('8ad2ea00'), ('8df65f27'), ('8e9cc47b'), ('8f035f8a'), ('8f036228'), ('8f47c2ea'),
    ('8f9b9a72'), ('9092266f'), ('90fd5ba6'), ('91c1e37e'), ('923db99f'), ('92436e30'), ('94722319'), ('95187d11'),
    ('95a5ed50'), ('969cb63f'), ('97de7d3e'), ('981ced00'), ('9c255acf'), ('9cc6c9d0'), ('9d0dd6f1'), ('9d607276'),
    ('9e2742fe'), ('9ea48ebd'), ('9f6b0fe4'), ('9fabee3f'), ('a0905077'), ('a197576a'), ('a2812479'), ('a2a532e9'),
    ('a36ae56b'), ('a381f1a6'), ('a3a437fc'), ('a3b0c589'), ('a3fb7e6f'), ('a416e379'), ('a5e52007'), ('a5f201aa'),
    ('a6edf4bc'), ('a964fb6c'), ('a9a38beb'), ('a9fb34de'), ('aa102901'), ('abaa3ccc'), ('ad0e270c'), ('ad796175'),
    ('aded2612'), ('adfbd0ec'), ('ae651728'), ('af374280'), ('af94c2de'), ('afda1b54'), ('b166cd76'), ('b3ba2cfb'),
    ('b3c2dd6c'), ('b3fd3eb9'), ('b5b4ea28'), ('b5e40df4'), ('b758cb50'), ('b781fd22'), ('b7a1c288'), ('b905a717'),
    ('b957b8bb'), ('bb09ba53'), ('bb0aa980'), ('bb74d4c7'), ('bbca0843'), ('bd70d102'), ('bd810d24'), ('bd8de426'),
    ('bdc6eb4c'), ('bdf90c90'), ('be4d7133'), ('bf2e0913'), ('bf9a9607'), ('bfb14dfc'), ('c01c34d9'), ('c047c1ef'),
    ('c22ab36e'), ('c22ae689'), ('c2a00dc7'), ('c31c2bc0'), ('c3457a03'), ('c36b202d'), ('c4fb9729'), ('c596b5d7'),
    ('c62cb0ac'), ('c6b2401b'), ('c6d2f9d7'), ('c7519c86'), ('c924ea68'), ('ca06fa0f'), ('ca7dd349'), ('cace0c85'),
    ('caf8cb42'), ('cb6efcef'), ('cb9d7d50'), ('cc78a7ee'), ('cdf244bb'), ('ce8298fc'), ('cf32dfde'), ('cf90278e'),
    ('cfb324d0'), ('d0a5d68f'), ('d0cc1ca4'), ('d21ef470'), ('d2c6ab03'), ('d340a1d9'), ('d342717a'), ('d3ce8238'),
    ('d542c1b2'), ('d67e9f08'), ('d6f56660'), ('d73dd8bc'), ('d7bdc52a'), ('d86cbe0d'), ('d87d940b'), ('d8f0826a'),
    ('d9342283'), ('d94aad9a'), ('d961e9ef'), ('db15b9a5'), ('dbf5eb30'), ('dc82014a'), ('e050df8e'), ('e056c83e'),
    ('e0b5f550'), ('e1343cfa'), ('e1661940'), ('e27e1f05'), ('e2b97368'), ('e342f344'), ('e4b0e4ba'), ('e5369ac8'),
    ('e5389efd'), ('e5b1c828'), ('e60d7ae3'), ('e6dfd5fd'), ('e70b5e94'), ('e72ceac7'), ('e752d74d'), ('e75f5a02'),
    ('e7b8e03a'), ('e7da76f8'), ('e85acd9b'), ('e891dc15'), ('ea47bcad'), ('eade1388'), ('ebd37b52'), ('ecb0f3e7'),
    ('ecbb1d6f'), ('ed1007cd'), ('ee53cf1f'), ('f0087b01'), ('f106b35b'), ('f210890a'), ('f2277382'), ('f3250133'),
    ('f3432a68'), ('f35068e9'), ('f43f851f'), ('f45b0af5'), ('f47ca465'), ('f4fc099f'), ('f6700375'), ('f6bea0b8'),
    ('f6f31cd3'), ('f7ef0928'), ('f80df1ff'), ('f8589e1c'), ('f8c1466a'), ('f8d879fc'), ('f94c1259'), ('f9d07a0b'),
    ('fa6d086a'), ('fa9d6543'), ('faabada4'), ('fabaff25'), ('fc0abb18'), ('fc0cf372'), ('fc802905'), ('fd1d3dfc'),
    ('fde8d17b'), ('fdf9add7'), ('fe18895f'), ('fe39b7d0'), ('fe3ff529'), ('fe9ec2c1'), ('ff84dee6'), ('ffaa9504')
),
reperes as (
  select p.pdv_id, p.nom_pdv, p.zone, p.quartier, p.geolocation_lat lat, p.geolocation_lng lng,
         p.gps_source, p.gps_maj_le, p.gps_precision_m
  from public.pdv p join liste l using (pdv_id)
  where p.is_active
    and p.gps_source in ('terrain', 'visite_validee')
    and p.gps_maj_le >= '2026-11-02'
),
centres as (
  select p.zone, p.quartier, count(*) nb,
         percentile_cont(0.5) within group (order by p.geolocation_lat) clat,
         percentile_cont(0.5) within group (order by p.geolocation_lng) clng
  from public.pdv p
  where p.is_active and p.quartier is not null and p.geolocation_lat is not null
    and p.zone in (select zone from reperes)
  group by p.zone, p.quartier
  having count(*) >= 5
)
select r.pdv_id, r.nom_pdv, r.zone as territoire, r.quartier as quartier_saisi,
       round(r.lat::numeric, 6) as latitude, round(r.lng::numeric, 6) as longitude,
       r.gps_source, r.gps_precision_m, r.gps_maj_le as reperee_le,
       pr.quartier as quartier_propose,
       round((public.distance_m(r.lat, r.lng, pr.clat, pr.clng) / 1000)::numeric, 1) as km_du_centre,
       (pr.quartier is distinct from r.quartier) as quartier_a_changer
from reperes r
left join lateral (
  select c.quartier, c.clat, c.clng from centres c
  where c.zone = r.zone
  order by public.distance_m(r.lat, r.lng, c.clat, c.clng)
  limit 1
) pr on true
order by r.zone, r.quartier, r.nom_pdv;
