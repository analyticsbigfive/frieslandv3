-- ============================================================================
-- TRACE — POINTS GPS DU ROUTING MENSUEL CORRIGÉS LE 17/10/2026 (DÉJÀ APPLIQUÉ)
--
-- Ce n'est PAS une migration à rejouer : les changements ont été faits en
-- production le 17/10 via l'éditeur SQL. Ce fichier garde la trace et le
-- retour arrière. Détail et méthode : docs/suivi/2026-10-17-points-gps-routing.md
--
-- Pour chaque case : point de l'agence hors du lieu → nouveau point
-- (OpenStreetMap ou centre des PDV du quartier). Une règle neuve a été créée
-- (PDV du distributeur à moins de 500 m du nouveau point) et l'ancienne
-- désactivée (is_active = false, note « 17/10/2026 »). Aucune ligne supprimée.
-- Tournées refaites sur place (étapes en attente seulement) : Zogbolou 17, 19,
-- 23, 24/10 ; Abbé 17 (bascule sur Dallas 1), 19, 21/10 ; Gui 19/10 ; Guihi 22/10.
-- ============================================================================

-- case_id | merchandiser | jour | semaine | lieu | ancien point | nouveau point | ancienne règle | nouvelle règle
-- 07d01d63-1bbc-48ce-b528-d7dc15dbd670 | ABBE FREDERIC | Mercredi | S2 | Dallas 1 | 5.33200, -4.03900 | 5.34191, -4.02370 | f2581bb3-217a-429e-ba41-038e3a1724c6 | 747c5ca0-1979-4efe-8d54-393b7de7f572
-- d01df446-926d-411d-8ca7-609903065492 | ABBE FREDERIC | Jeudi | S2 | Williamsville 1 | 5.37200, -4.01800 | 5.37375, -4.02510 | 5803cd64-412b-4a12-98d2-0ed13bad93c2 | 246102a6-3555-4193-b528-41330a5b4b05
-- dfc4431d-f11e-4ec7-9cc8-8103fd35cb7b | ABBE FREDERIC | Vendredi | S2 | Bramakoté 1 | 5.36100, -4.02900 | 5.34927, -4.03242 | 2c4b642a-fff6-4dd9-a758-8ff6a9bf89a3 | 90e9874d-a5cf-456e-b88a-eaef7884c8e6
-- 7ce5316b-cf5a-41bd-a6c5-4662acfb673f | ABBE FREDERIC | Samedi | S2 | Dallas 1 | 5.33200, -4.03900 | 5.34191, -4.02370 | 19599368-bacf-4df2-b256-8f3cef3a6e81 | 34aa4533-5153-48f0-bf92-0055b854df6e
-- 677232eb-e571-45b7-9c1b-f6546c369af9 | ABBE FREDERIC | Lundi | S3 | Bracodi 1 | 5.35200, -4.02500 | 5.36160, -4.02523 | 60ab5816-c8ff-4adb-986e-99f7004fe248 | 15f58c20-77ee-4ebf-a11e-8e89e38881cf
-- d7b73647-d793-483f-b067-9cc4cfa8932a | ABBE FREDERIC | Mercredi | S3 | Saint Michel 1 | 5.35500, -4.02300 | 5.34548, -4.02202 | 8e5b0250-6654-443c-b44d-316ab627f62b | 5e387c9f-2abd-4623-b377-fc8693b12c92
-- 872f4220-6dba-44e6-a463-f791b6d4294e | ABBE FREDERIC | Vendredi | S3 | Bramakoté 2 | 5.36250, -4.03050 | 5.34927, -4.03242 | ff9bf4ac-bcc4-4d24-91b0-ffd73a5b707c | 615f925f-5335-41b8-a5c5-edad93545401
-- f355eed1-d47f-4a50-aca5-f1957598c19b | ABBE FREDERIC | Mercredi | S4 | Dallas 2 | 5.33350, -4.04050 | 5.34191, -4.02370 | dd2a739c-53f1-4c7f-9eac-df97faa7b391 | db2a5369-484d-4b3e-aa8a-c1c227f48ff2
-- b4938a61-3743-42f5-be6a-71c44c8a79be | DEHEO WILFRIED | Lundi | S1 | Sable et Institut des aveugles | 5.33800, -4.07800 | 5.35705, -4.06819 | faa91f91-524b-435f-a936-c280d45cee4c | a382d172-e181-4092-a51e-f62013d20828
-- a57c2eb6-c18d-448a-a697-298427de65db | DEHEO WILFRIED | Jeudi | S2 | Koweït 2 et Agbayaté 1 | 5.32100, -4.09200 | 5.32122, -4.05446 | ef64099f-8e5f-44e0-bf93-36b1dfd3c362 | 6818b543-a9dd-4c7d-ad52-04ca7ea5c576
-- 85e52f80-8772-411b-9676-1fd084290660 | GUI STEPHANE | Lundi | S3 | Quartier Apollo | 5.29200, -4.00800 | 5.30614, -4.00926 | e208fa85-b1ad-472b-b53d-c76b9b3e21c1 | 13a2fdea-2e4e-4f9d-b628-7e48153af87d
-- 19e46d0a-2104-4e45-b8dc-c00768d5122f | GUIHI BERNADIN | Jeudi | S4 | M'Pouto et CAD | 5.34100, -3.95100 | 5.32697, -3.95611 | 5e006292-629d-4f5e-8847-400ffcae8ef7 | 2acb4283-6add-450b-b379-51525a0d5aeb
-- 309bca44-e0dd-44a0-8986-f71a1bec098a | KOUADIO ATOFFE GUY ANICET | Jeudi | S1 | Ahoussabougou | 5.29268, -3.97293 | 5.29388, -3.95973 | 7d8d428b-d388-463e-bd06-bd326239f769 | 7b739ccb-2b34-4be2-8c25-fe222c3c6d28
-- 6fddeac2-63d0-4764-b861-73cb82e70dad | YAO VENANCE | Samedi | S2 | Kennedy 2 | 5.43500, -4.02200 | 5.41948, -4.00835 | cfa46329-b615-44fd-9450-f996ac932a77 | 3a6d0134-ae47-47d8-9520-d9cbbc45cd9e
-- ccf21b08-175b-4104-92b4-34ce98e9e33b | YAO VENANCE | Jeudi | S3 | Anador 2 | 5.42100, -4.02500 | 5.40870, -4.01022 | a938aa12-be36-4296-9be4-eccd932f1a25 | 8479804a-d628-4594-bc71-338db4fbdda0
-- 8b0bca3d-17d2-4708-b9a7-c91a2c750458 | ZOGBOLOU KEVIN | Jeudi | S1 | Lubafrik | 5.37100, -4.08900 | 5.31966, -4.10706 | 688aab57-8f62-4bc8-9bef-9fc114fb3686 | 0d59ecbf-68ba-4af3-9de0-684ee321b130
-- 323743c7-7e92-4778-885b-102afe282990 | ZOGBOLOU KEVIN | Samedi | S1 | Maroc 1 | 5.34850, -4.07220 | 5.33942, -4.09920 | de673e1b-0f4e-4a52-abd7-dfcb0f334ffe | ed4f75b1-2c32-470c-aa1e-115c86c8467f
-- 34f82930-dcfb-4680-b903-8ae692bd0546 | ZOGBOLOU KEVIN | Lundi | S2 | Andokoi 1 | 5.37800, -4.07200 | 5.36607, -4.06824 | 19b3f194-8c4f-4d56-bda4-799670e20d43 | 5e5374c2-de41-47ec-a392-d1a7f16b0589
-- 3eebc657-9938-4112-a90d-babed46c6908 | ZOGBOLOU KEVIN | Samedi | S2 | Maroc 2 | 5.35200, -4.07550 | 5.33942, -4.09920 | 0bafe731-eb37-4576-b367-b441c66ee344 | 85efbc57-429f-4729-b240-047460308f7b
-- c70453e5-3a5b-4835-8bc3-8c9fdf566122 | ZOGBOLOU KEVIN | Lundi | S3 | Andokoi 2 | 5.37950, -4.07050 | 5.36607, -4.06824 | b9bf853b-855a-4222-a050-3adb3e15cbf7 | 0e6bced9-1b38-4907-b9bb-72ced8c6e382
-- b311cd2c-7bcb-4d7a-b400-e851300a9692 | ZOGBOLOU KEVIN | Vendredi | S3 | Port-Bouët 2 (1) | 5.34100, -4.06800 | 5.34983, -4.08868 | f01097cc-ed28-4741-9179-c17347917ca3 | ff3ba201-713c-4a26-bff2-88d532c77aca
-- 91da1496-6c8c-46b6-acc8-51791c456414 | ZOGBOLOU KEVIN | Samedi | S3 | Maroc 3 | 5.35550, -4.07880 | 5.33942, -4.09920 | 37072930-d5df-421a-b23b-b1387a03b950 | 4d758862-79e7-4876-9d6b-23648badd288
-- 68794867-9aec-4605-a279-ffd40b4d31d2 | ZOGBOLOU KEVIN | Vendredi | S4 | Port-Bouët 2 (2) | 5.34250, -4.06650 | 5.34983, -4.08868 | fd837009-1efc-417a-9cb4-dbd64f425f50 | 20287398-66cc-4db9-8878-31e3fbfdcecc
-- f30b023a-85b9-4cd9-8d0c-b7e10c6153a0 | ZOGBOLOU KEVIN | Samedi | S4 | Maroc 4 | 5.35900, -4.08200 | 5.33942, -4.09920 | 2953a5c3-b1df-4be6-b01b-5c4c04e9ca9f | df8f2a96-cd8f-4cf8-a526-aeac0d6c8c33

-- ----------------------------------------------------------------------------
-- RETOUR ARRIÈRE (à exécuter seulement si on veut revenir aux points de l'agence)
-- ----------------------------------------------------------------------------
/*
begin;

with t(case_id, a_lat, a_lng, ancienne, nouvelle) as (values
  ('07d01d63-1bbc-48ce-b528-d7dc15dbd670'::uuid, 5.332::float8, -4.039::float8, 'f2581bb3-217a-429e-ba41-038e3a1724c6'::uuid, '747c5ca0-1979-4efe-8d54-393b7de7f572'::uuid),
  ('d01df446-926d-411d-8ca7-609903065492'::uuid, 5.372::float8, -4.018::float8, '5803cd64-412b-4a12-98d2-0ed13bad93c2'::uuid, '246102a6-3555-4193-b528-41330a5b4b05'::uuid),
  ('dfc4431d-f11e-4ec7-9cc8-8103fd35cb7b'::uuid, 5.361::float8, -4.029::float8, '2c4b642a-fff6-4dd9-a758-8ff6a9bf89a3'::uuid, '90e9874d-a5cf-456e-b88a-eaef7884c8e6'::uuid),
  ('7ce5316b-cf5a-41bd-a6c5-4662acfb673f'::uuid, 5.332::float8, -4.039::float8, '19599368-bacf-4df2-b256-8f3cef3a6e81'::uuid, '34aa4533-5153-48f0-bf92-0055b854df6e'::uuid),
  ('677232eb-e571-45b7-9c1b-f6546c369af9'::uuid, 5.352::float8, -4.025::float8, '60ab5816-c8ff-4adb-986e-99f7004fe248'::uuid, '15f58c20-77ee-4ebf-a11e-8e89e38881cf'::uuid),
  ('d7b73647-d793-483f-b067-9cc4cfa8932a'::uuid, 5.355::float8, -4.023::float8, '8e5b0250-6654-443c-b44d-316ab627f62b'::uuid, '5e387c9f-2abd-4623-b377-fc8693b12c92'::uuid),
  ('872f4220-6dba-44e6-a463-f791b6d4294e'::uuid, 5.3625::float8, -4.0305::float8, 'ff9bf4ac-bcc4-4d24-91b0-ffd73a5b707c'::uuid, '615f925f-5335-41b8-a5c5-edad93545401'::uuid),
  ('f355eed1-d47f-4a50-aca5-f1957598c19b'::uuid, 5.3335::float8, -4.0405::float8, 'dd2a739c-53f1-4c7f-9eac-df97faa7b391'::uuid, 'db2a5369-484d-4b3e-aa8a-c1c227f48ff2'::uuid),
  ('b4938a61-3743-42f5-be6a-71c44c8a79be'::uuid, 5.338::float8, -4.078::float8, 'faa91f91-524b-435f-a936-c280d45cee4c'::uuid, 'a382d172-e181-4092-a51e-f62013d20828'::uuid),
  ('a57c2eb6-c18d-448a-a697-298427de65db'::uuid, 5.321::float8, -4.092::float8, 'ef64099f-8e5f-44e0-bf93-36b1dfd3c362'::uuid, '6818b543-a9dd-4c7d-ad52-04ca7ea5c576'::uuid),
  ('85e52f80-8772-411b-9676-1fd084290660'::uuid, 5.292::float8, -4.008::float8, 'e208fa85-b1ad-472b-b53d-c76b9b3e21c1'::uuid, '13a2fdea-2e4e-4f9d-b628-7e48153af87d'::uuid),
  ('19e46d0a-2104-4e45-b8dc-c00768d5122f'::uuid, 5.341::float8, -3.951::float8, '5e006292-629d-4f5e-8847-400ffcae8ef7'::uuid, '2acb4283-6add-450b-b379-51525a0d5aeb'::uuid),
  ('309bca44-e0dd-44a0-8986-f71a1bec098a'::uuid, 5.29268::float8, -3.97293::float8, '7d8d428b-d388-463e-bd06-bd326239f769'::uuid, '7b739ccb-2b34-4be2-8c25-fe222c3c6d28'::uuid),
  ('6fddeac2-63d0-4764-b861-73cb82e70dad'::uuid, 5.435::float8, -4.022::float8, 'cfa46329-b615-44fd-9450-f996ac932a77'::uuid, '3a6d0134-ae47-47d8-9520-d9cbbc45cd9e'::uuid),
  ('ccf21b08-175b-4104-92b4-34ce98e9e33b'::uuid, 5.421::float8, -4.025::float8, 'a938aa12-be36-4296-9be4-eccd932f1a25'::uuid, '8479804a-d628-4594-bc71-338db4fbdda0'::uuid),
  ('8b0bca3d-17d2-4708-b9a7-c91a2c750458'::uuid, 5.371::float8, -4.089::float8, '688aab57-8f62-4bc8-9bef-9fc114fb3686'::uuid, '0d59ecbf-68ba-4af3-9de0-684ee321b130'::uuid),
  ('323743c7-7e92-4778-885b-102afe282990'::uuid, 5.3485::float8, -4.0722::float8, 'de673e1b-0f4e-4a52-abd7-dfcb0f334ffe'::uuid, 'ed4f75b1-2c32-470c-aa1e-115c86c8467f'::uuid),
  ('34f82930-dcfb-4680-b903-8ae692bd0546'::uuid, 5.378::float8, -4.072::float8, '19b3f194-8c4f-4d56-bda4-799670e20d43'::uuid, '5e5374c2-de41-47ec-a392-d1a7f16b0589'::uuid),
  ('3eebc657-9938-4112-a90d-babed46c6908'::uuid, 5.352::float8, -4.0755::float8, '0bafe731-eb37-4576-b367-b441c66ee344'::uuid, '85efbc57-429f-4729-b240-047460308f7b'::uuid),
  ('c70453e5-3a5b-4835-8bc3-8c9fdf566122'::uuid, 5.3795::float8, -4.0705::float8, 'b9bf853b-855a-4222-a050-3adb3e15cbf7'::uuid, '0e6bced9-1b38-4907-b9bb-72ced8c6e382'::uuid),
  ('b311cd2c-7bcb-4d7a-b400-e851300a9692'::uuid, 5.341::float8, -4.068::float8, 'f01097cc-ed28-4741-9179-c17347917ca3'::uuid, 'ff3ba201-713c-4a26-bff2-88d532c77aca'::uuid),
  ('91da1496-6c8c-46b6-acc8-51791c456414'::uuid, 5.3555::float8, -4.0788::float8, '37072930-d5df-421a-b23b-b1387a03b950'::uuid, '4d758862-79e7-4876-9d6b-23648badd288'::uuid),
  ('68794867-9aec-4605-a279-ffd40b4d31d2'::uuid, 5.3425::float8, -4.0665::float8, 'fd837009-1efc-417a-9cb4-dbd64f425f50'::uuid, '20287398-66cc-4db9-8878-31e3fbfdcecc'::uuid),
  ('f30b023a-85b9-4cd9-8d0c-b7e10c6153a0'::uuid, 5.359::float8, -4.082::float8, '2953a5c3-b1df-4be6-b01b-5c4c04e9ca9f'::uuid, 'df8f2a96-cd8f-4cf8-a526-aeac0d6c8c33'::uuid)
),
p as (update public.routing_mensuel m set latitude = t.a_lat, longitude = t.a_lng, updated_at = now() from t where m.id = t.case_id returning 1),
a as (update public.routing_templates r set is_active = true, updated_at = now() from t where r.id = t.ancienne returning 1)
update public.routing_templates r set is_active = false, updated_at = now() from t where r.id = t.nouvelle;

-- « ancienne règle » = règle d'origine de l'agence. Les règles intermédiaires du 17/10
-- (Port-Bouët 2 : b6c37830…, 8af085d1… ; Anador 2 : d790e090…, toutes sur le point OSM)
-- sont déjà désactivées et restent désactivées.
commit;
*/
