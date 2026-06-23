-- ============================================================
-- 020_referentiels_geo_distrib_pos.sql
-- Référentiels : distributeurs, hiérarchie géo (division/sous-région/
-- territoire/area), types de PDV. Source: BIG FIVE KPI UPDATE vf.xlsx.
-- À exécuter après 018. Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.distributeurs (
  name TEXT PRIMARY KEY,
  trade_type TEXT NOT NULL DEFAULT 'GT' CHECK (trade_type IN ('GT','MT')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.distributeurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS distributeurs_read ON public.distributeurs;
CREATE POLICY distributeurs_read ON public.distributeurs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS distributeurs_write ON public.distributeurs;
CREATE POLICY distributeurs_write ON public.distributeurs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.distributeurs (name, trade_type) VALUES
  ('ABDI', 'GT'),
  ('ABDI MOHAMED', 'GT'),
  ('ADIALEA RCI', 'MT'),
  ('ALI BABA CI', 'GT'),
  ('BALDE IBRAHIMA', 'GT'),
  ('BON MARCHE', 'GT'),
  ('BOUSSOURA SARL', 'GT'),
  ('CIVADIS', 'MT'),
  ('COMPAGNIE DE DISTRIBUTION (C.D.C.I)', 'MT'),
  ('COTE D''IVOIRE SUPERMARCHES', 'MT'),
  ('DYNAMIS', 'GT'),
  ('DYNAMYS', 'GT'),
  ('ESF KORHOGO', 'GT'),
  ('ETABLISSEMENT EL VALAH SARL', 'GT'),
  ('ETABLISSEMENT LEMRABOTT & FRÈRES', 'GT'),
  ('ETABLISSEMENT NIARE & FRERES', 'GT'),
  ('IDMCI', 'GT'),
  ('IVOIRE DISTRIBUTION MARCHANDISES C.I', 'GT'),
  ('KADERIM SA', 'MT'),
  ('KAZA DISTRIBUTION', 'GT'),
  ('LKA SERVICES', 'GT'),
  ('NICE SERVICE', 'GT'),
  ('NOUVEAUX DISTRIBUTEURS ASSOCIES', 'GT'),
  ('OMNI RETAIL', 'GT'),
  ('PLAISIR BACHUSS', 'GT'),
  ('PRODISMA', 'GT'),
  ('PROSUMA CASH PORT', 'MT'),
  ('PROSUMA DIVISION CENTRALE', 'MT'),
  ('RIDACOM', 'GT'),
  ('RIZKALLAH MICHEL', 'GT'),
  ('SDHPA', 'GT'),
  ('SDTP', 'GT'),
  ('SIDECOM', 'GT'),
  ('SOCOCE COTE D''IVOIRE SA', 'MT'),
  ('SOCOCE INTERIEUR', 'GT'),
  ('SOCOPRIX', 'MT'),
  ('SODIAMA', 'GT'),
  ('SODICOM-CI', 'GT'),
  ('SODISMAF', 'GT'),
  ('SOMALI-CI', 'GT'),
  ('Societe des 2 Plateaux - S.2.P', 'MT'),
  ('TAHIROU', 'GT'),
  ('UP GROUND SALES & MARKETING', 'GT')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.geo_divisions (code TEXT PRIMARY KEY, name TEXT NOT NULL);
ALTER TABLE public.geo_divisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_divisions_read ON public.geo_divisions;
CREATE POLICY geo_divisions_read ON public.geo_divisions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS geo_divisions_write ON public.geo_divisions;
CREATE POLICY geo_divisions_write ON public.geo_divisions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
CREATE TABLE IF NOT EXISTS public.geo_sub_regions (code TEXT PRIMARY KEY, name TEXT NOT NULL, division_code TEXT);
ALTER TABLE public.geo_sub_regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_sub_regions_read ON public.geo_sub_regions;
CREATE POLICY geo_sub_regions_read ON public.geo_sub_regions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS geo_sub_regions_write ON public.geo_sub_regions;
CREATE POLICY geo_sub_regions_write ON public.geo_sub_regions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
CREATE TABLE IF NOT EXISTS public.geo_territories (code TEXT PRIMARY KEY, name TEXT NOT NULL, sub_region_code TEXT);
ALTER TABLE public.geo_territories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_territories_read ON public.geo_territories;
CREATE POLICY geo_territories_read ON public.geo_territories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS geo_territories_write ON public.geo_territories;
CREATE POLICY geo_territories_write ON public.geo_territories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
CREATE TABLE IF NOT EXISTS public.geo_areas (
  territory_code TEXT NOT NULL,
  area_code TEXT NOT NULL,
  area_name TEXT,
  distributor_name TEXT,
  PRIMARY KEY (territory_code, area_code)
);
ALTER TABLE public.geo_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_areas_read ON public.geo_areas;
CREATE POLICY geo_areas_read ON public.geo_areas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS geo_areas_write ON public.geo_areas;
CREATE POLICY geo_areas_write ON public.geo_areas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.geo_divisions (code, name) VALUES
  ('SOUTHDIV', 'SOUTH DIVISION'),
  ('NORTHDIV', 'NORTH DIVISION')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.geo_sub_regions (code, name, division_code) VALUES
  ('SOUTH1', 'SOUTH 1 REGION', 'SOUTHDIV'),
  ('SOUTH2', 'SOUTH 2 REGION', 'SOUTHDIV'),
  ('CNE', 'CENTRE-NORD -EST REGION', 'NORTHDIV'),
  ('WEST', 'WEST REGION', 'NORTHDIV')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.geo_territories (code, name, sub_region_code) VALUES
  ('BIN', 'Bingerville', 'SOUTH1'),
  ('COC 1', 'Cocody 1', 'SOUTH1'),
  ('COC 2', 'Cocody 2', 'SOUTH1'),
  ('TRE', 'Treichville', 'SOUTH1'),
  ('MAR', 'Marcory', 'SOUTH1'),
  ('KOU', 'koumassi', 'SOUTH1'),
  ('PRB', 'Port bouet', 'SOUTH1'),
  ('BAS', 'Bassam', 'SOUTH1'),
  ('ABO', 'Aboisso', 'SOUTH1'),
  ('PLA', 'Plateau', 'SOUTH1'),
  ('YOP 1', 'Yopougon 1', 'SOUTH2'),
  ('YOP 2', 'Yopougon 2', 'SOUTH2'),
  ('YOP 3', 'Yopougon 3', 'SOUTH2'),
  ('YOP 4', 'Yopougon 4', 'SOUTH2'),
  ('DAB', 'Dabou', 'SOUTH2'),
  ('ABO 1', 'Abobo 1', 'SOUTH2'),
  ('ABO 2', 'Abobo 2', 'SOUTH2'),
  ('ANY', 'Anyama', 'SOUTH2'),
  ('ADJ', 'Adjame', 'SOUTH2'),
  ('ADZ', 'Adzope', 'SOUTH2'),
  ('AGB', 'Agboville', 'SOUTH2'),
  ('ABEN', 'Abengourou', 'CNE'),
  ('YAM', 'Yamoussoukro', 'CNE'),
  ('DIM', 'Dimbokro', 'CNE'),
  ('BKE 1', 'Bouake 1', 'CNE'),
  ('BKE 2', 'Bouake 2', 'CNE'),
  ('KAT', 'Katiola', 'CNE'),
  ('KOR', 'Korhogo', 'CNE'),
  ('FER', 'Ferke', 'CNE'),
  ('BON', 'Bondoukou', 'CNE'),
  ('DAL', 'Daloa', 'WEST'),
  ('MNK', 'Mankono', 'WEST'),
  ('MAN', 'Man', 'WEST'),
  ('SOU', 'Soubre', 'WEST'),
  ('SPD', 'San Pedro', 'WEST'),
  ('GAG 2', 'Gagnoa 2', 'WEST'),
  ('GAG 1', 'Gagnoa 1', 'WEST'),
  ('DIV', 'Divo', 'WEST'),
  ('GUI 1', 'Guiglo 1', 'WEST'),
  ('GUI 2', 'Guiglo 2', 'WEST'),
  ('ODI', 'Odienne', 'WEST'),
  ('Boun', 'Bouna', 'CNE')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.geo_areas (territory_code, area_code, area_name, distributor_name) VALUES
  ('BIN', 'NVEG', 'NOUVEAU GOUDRON/ FEH KESSE/ CITE SIR/ AKANDJE/ LAURIER 15/SANTE', 'DYNAMYS'),
  ('BIN', 'BLAN', 'BLANCHON/PALMERAIE BINGERVILLE/ADJAME BINGERVILLE/ BREGBO/AKOUAI SANTE/AMAN/', 'DYNAMYS'),
  ('BIN', 'BCIE', 'BASE CIE/ KOROCOBOUGOU/GBAGBA/BERLIN/SAVANE/MACHOU/SICOGI/MACHOUX/MARCHE/', 'DYNAMYS'),
  ('BIN', 'ABAT', 'ABATTA/ABATTA VILLAGE/JULES VERNE/CITE DU PORT', 'DYNAMYS'),
  ('BIN', 'BING', 'TOUT BINGERVILLE', 'DYNAMYS'),
  ('COC 1', 'LCET', 'LYCEE TECHNIQUE/VALLON/COLOMBIE', 'PRODISMA'),
  ('COC 1', 'MAHO', 'MAHOU COLOMBIE', 'PRODISMA'),
  ('COC 1', 'PERL', 'PERLE/MAHOU/ANGRE', 'PRODISMA'),
  ('COC 1', 'PALM', 'PALMERAIE/ATTOBAN /BONOUMIN', 'PRODISMA'),
  ('COC 1', 'PALM2', 'PALMERAIE2 COCOVICO', 'PRODISMA'),
  ('COC 1', 'ANGR', 'ANGRE 2PLATEAUX 7 TRANCHE', 'PRODISMA'),
  ('COC 1', 'DJOR', 'BESSIKOI/DJOROBITE', 'PRODISMA'),
  ('COC 2', 'DNGA', 'DANGA/COCODY CENTRE/BLAUKOSS', 'PRODISMA'),
  ('COC 2', 'BLKH', 'BLAUKOSS COCODY CENTRE', 'PRODISMA'),
  ('COC 2', 'RVER2', 'RIVIERA 2/ RIVIERA 3/ GOLF', 'PRODISMA'),
  ('COC 2', 'ANON', 'ANONO', 'PRODISMA'),
  ('COC 2', 'FAYB', 'FAYA BON PRIX/ABATTA', 'PRODISMA'),
  ('COC 2', 'CIAD', 'CIAD/MPOUTO/SYNACACI/FAYA (COTE ECHANGEUR)', 'PRODISMA'),
  ('TRE', 'ARAS', 'ARAS/ BELLEVILLE/ BIAFRA/ QUARTIER APOLLO / ZONE 3', 'SIDECOM'),
  ('TRE', 'BIAF', 'ARAS/ BELLEVILLE/ BIAFRA/ QUARTIER APOLLO / ZONE 3', 'SIDECOM'),
  ('MAR', 'RSD', 'RÉSIDENTIEL / CHAMPROUX / GROUPEMENT/ HIBISCUS / MASSARANA', 'SIDECOM'),
  ('MAR', 'SICOG', 'SICOGI / REMBLAIS / ANOUMANBO/ SANS FIL / ZONE 4', 'SIDECOM'),
  ('MAR', 'HIBI', 'RÉSIDENTIEL / CHAMPROUX / GRPE/ HIBISCUS / MASSARANA / SICOGI / REMBLAIS /ANOUMANBO/ SANS FIL/ ZONE4', 'SIDECOM'),
  ('KOU', 'RBLA', 'REMBLAIS/MARAIS/ DIVO/ KOUMASSI 32/ TERM 05', 'SIDECOM'),
  ('KOU', 'CTE147', 'CITÉ 147/ PRODOMO/SOPIM/ CAMPEMENT/SOWETO/SICOGI', 'SIDECOM'),
  ('KOU', 'AHOU', 'AHOUSSABOUGOU/ 3 AMPOULES/ MARCHÉ DJE KONAN/SOLEIL/GELTI', 'SIDECOM'),
  ('KOU', 'KMSS32', 'REMBLAIS/MARAIS/ DIVO/ KOUMASSI 32/ TERM 05 /3 AMPOULES / AHOUSSABOUGOU', 'SIDECOM'),
  ('KOU', 'PRDM', 'CITÉ 147/ PRODOMO/SOPIM/ CAMPEMENT/SOWETO/SICOGI/ MARCHÉ DJE KONAN / SOLEIL', 'SIDECOM'),
  ('PRB', 'PRBC', 'PORT BOUET CENTRE/CITÉ POLICIÈRE/PETIT BASSAM/VRIDI', 'SDHPA'),
  ('PRB', 'AERO', 'AÉROPORT/ ADJAWUI', 'SDHPA'),
  ('PRB', 'JANF', 'JEAN FOLLY/ ADJOUFOU', 'SDHPA'),
  ('PRB', 'TRCA', 'TERRE ROUGE/CORRIDOR/ANANI', 'SDHPA'),
  ('PRB', 'PRBO', 'PORT BOUET', 'SDHPA'),
  ('BAS', 'MOKE', 'MOCKEYVILLE/UNIVERSITÉ AMÉRICAINE/ EDOUKOU MIEZAN/QUARTIER ARTISANAL/MODESTE/ANANI/MOOSOU 1', 'LKA SERVICES'),
  ('BAS', 'VETO', 'VETOCO/MOOSOU2/IMPERIAL/DOS/QUARTIER FRANCE/DIOULABOUGOU/AZURETI', 'LKA SERVICES'),
  ('BAS', 'ANAN', 'ANANI/DOS/ DIOULABOUGO/PETIT MARCHÉ', 'LKA SERVICES'),
  ('BAS', '8KLO', '8 KILOS/ YAOU/CENTRE VILLE/BEGNERI/SAMO/ASSINIE', 'LKA SERVICES'),
  ('BAS', 'YAOU', '8 KILOS/ YAOU/CENTRE VILLE/BEGNERI/SAMO/ASSINIE', 'LKA SERVICES'),
  ('BAS', 'CTREV', '8 KILOS/ YAOU/CENTRE VILLE/BEGNERI', 'LKA SERVICES'),
  ('ABO', 'DJELI', 'DJELIBA /TP/ PARCERELLE/KONAN KAN/BOIS BLANC/ AYEBO/ADAOU', 'LKA SERVICES'),
  ('ABO', 'DIATEK', 'DIATEKRO/SOKORA/CCE/WATTVILLE/BELLEVILLE/SOS/DOSOBAH/CITÉ KOUMI/LYCÉE/ KRINDJABO/KOLAIWA/SANHOUMAN', 'LKA SERVICES'),
  ('ABO', 'AYME', 'AYAMÉ/EBIKRA/AKRESIE/N’ZIKRO/BABADOUGOU/EBOUÉ/ABY/ADJOUAN/MOYASSUÉ/AKAKRO/ V1/V2/KRINDJABO/KASSIKRO', 'LKA SERVICES'),
  ('ABO', 'ADKE', 'ADIAKÉ/ABOISSO/AYAMÉ/ KRINDJABO/ NOÉ/ ASSE/SOUMIÉ/N''ZIKRO/ KOFFIKRO/BABADOUGOU/ CARF AHENOUA/ADAOU', 'LKA SERVICES'),
  ('PLA', 'AGBA', 'AGBAN VILLAGE / CITE FERMONT / ATTECOUBE CENTRE / PLATEAU CENTRE / MARCHE DE FRUIT', 'BOUSSOURA SARL'),
  ('PLA', 'CTEFER', 'AGBAN VILLAGE / CITE FERMONT / ATTECOUBE CENTRE / PLATEAU CENTRE / MARCHE DE FRUIT', 'BOUSSOURA SARL'),
  ('YOP 1', 'ATTC', 'YOPOUGON 1 & 2', 'SODICOM-CI'),
  ('YOP 1', 'WASS', 'WASSAKARA / SELMER / SICOGI', 'SODICOM-CI'),
  ('YOP 1', 'SELM', 'WASSAKARA / SELMER / SICOGI', 'SODICOM-CI'),
  ('YOP 1', 'SBLE', 'YOPOUGON SABLE / MILLIONNAIRE / NOUVEAU QUARTIER', 'SODICOM-CI'),
  ('YOP 1', 'MILLI', 'YOPOUGON SABLE / MILLIONNAIRE / NOUVEAU QUARTIER', 'SODICOM-CI'),
  ('YOP 1', 'NGON', 'NIANGON NORD / SIDECI', 'SODICOM-CI'),
  ('YOP 1', 'TOROU', 'TOIT ROUGE / LOKODJRO / ATTECOUBE MOSSIKRO', 'SODICOM-CI'),
  ('YOP 1', 'LKOD', 'TOIT ROUGE / LOKODJRO / ATTECOUBE MOSSIKRO', 'SODICOM-CI'),
  ('YOP 2', 'NGOS', 'NIANGON SUD / AZITO', 'SODICOM-CI'),
  ('YOP 2', 'AZTO', 'NIANGON SUD/ AZITO', 'SODICOM-CI'),
  ('YOP 2', 'KTE', 'KOUTÉ/ PETIT TOIT ROUGE/ BÉAGO', 'SODICOM-CI'),
  ('YOP 2', 'BEAG', 'KOUTÉ/ PETIT TOIT ROUGE/ BÉAGO', 'SODICOM-CI'),
  ('YOP 2', 'KWEI', 'KOWEIT/ SANTÉ/ ABOBO DOUMÉ/ AGBAYATÉ', 'SODICOM-CI'),
  ('YOP 2', 'YOPS', 'KOWEIT/ YOPOUGON SANTÉ/ ABOBO DOUMÉ/ AGBAYATÉ', 'SODICOM-CI'),
  ('YOP 3', 'ADKOI', 'ANDOKOI/ UNIWAX/CRF ZONE /PRISON CIVILE/SODEFOR ET CITÉ ADO', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 3', 'ZNEIND', 'ZONE INDUSTRIELLE/ MICAO/GESCO FOURRIÈRE/ PK22/SIKENSI/ATTINGUÉ', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 3', 'MCAO', 'ANDOKOI/ UNIWAX/ ZONE INDUSTRIELLE/ MICAO GESCO FOURRIÈRE/PRISON CIVILE/ SODEFOR/CITÉ ADO......', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 3', 'GSCO', 'ANDOKOI/UNIWAX/ ZONE INDUSTRIELLE/ MICAO/ GESCO FOURRIÈRE/ PRISON CIVILE/ SODEFOR ET CITÉ ADO....', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 3', 'SPOREXBANCO2/ ABOULAYE DIALLO/ ANANE', 'SIPOREX/ BANCO2/ ABOULAYE DIALLO/ ANANERAIE/ MAMIE ADJOUA/PORT BOUET 2/CRF CHU/MOSQUÉE KOUDOUS', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 3', 'PRTBOU', 'PORT BOUET 2/CRF CHU/MOSQUÉE KOUDOUS/ ANANERAIE/ FUSCOM PORT BOUET 2/RD POINT GESCO', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 3', 'AANERAIEANANERAI', 'ANANERAIE/ GESCO RD POINT/ BATIM/MAMIE ADJOUA', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'LBAFRIQUEJATARK', 'LUBAFRIQUE/ JATARK/ LOKOA/CITÉ VERTE/BAGNON/ LIÈVRE ROUGE/KM17/BIMBRESSO/', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'CNEO', 'MATY/CANARI /ANTENNE/ SICOGI ATTIÉ/NIANGON À DROITE/ NIANGON CONTINUE/ CITÉ EECI', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'KBIM', 'KM17/BIMBRESSO/ ́JATARK/LOKOA CITÉ VERTE/ LIÈVRE ROUGE', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'DCCO', 'SICOGI ATTIÉ/ST ANDRÉ CÔTÉ DROIT/ PMI/AIMÉ CESAIRE/BON PRIX/ CRF BOBY & POLICIER CÔTÉ DROIT/BAR ECLA', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'TRMINUSNUS', 'TERMINUS 47 SECTEUR DROIT/ SICOGI PMI/ TIKEN DJA/BMW/KIMI', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'AADÉMIEMIE', 'ACADÉMIE/ FIN GOUDRON/ PAYS BAS/CAISTAB/CITÉ LAURIER/ CITÉ VERTE', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('YOP 4', 'MROCAN', 'MAROC/ANANERAIE/ PORT BOUET 2/LUBAFRIQUE/ NIANGON À DROITE /TEXACO À DROITE', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('DAB', 'SNGONN', 'SONGON/N’DJEM/ CARREFOUR JACQUESVILLE/JACQUESVILLE VILLE/ DABOU/N’ZEKREZESSOU....', NULL),
  ('DAB', 'GANDLA', 'GRAND LAHOU/CRF GRAND LAHOU/CRF FRESCO/FRESCO VILLE ET PÉRIPHÉRIES', NULL),
  ('DAB', 'DBOUVI', 'DABOU VILLE/ SONGON/ CARREFOUR JACQUESVILLE....', NULL),
  ('DAB', 'SNGON', 'SONGON/ CARREFOUR JACQUESVILLE/ JACQUESVILLE/ DABOU/GRAND LAHOU/FRESCO/', NULL),
  ('ABO 1', 'DKUI', 'DOKUI / ANADOR / COCO SERVICE DERRIÈRE UNIVERSITÉ ABOBO/ADJAMÉ / ALEPE', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 1', 'AOCATIERAVOCATIE', 'AVOCATIER / BC AUTOUTE / NOUVELLE GARE / AGNISSANKOI / BC', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 1', 'SMANKEKE', 'SAMANKE / KOLETCHA / ABOBO BAOULE / BIABOU', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 1', 'AEIKOIOI', 'AKEIKOI / HABITAT / AGBEKOI / HOUPHOUT BOIGNY', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 1', 'LCEEMO', 'LYCEE MODERNE / ETOILE / GENDARMERIE / BON PRIX GENDARMERIE / CHATTONS', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 1', 'CTEPOL', 'CITE POLICIERE / CAMP COMMANDO / CNPS / AVENUE KAZA / COLATIER', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 1', 'AOBOGA', 'ABOBO GARE / MAIRIE', 'ETABLISSEMENT NIARE & FRERES'),
  ('ABO 2', 'MSQUEB', 'MOSQUE BLANCHE/ANOKOUA KOUTE/MARAHOUE/AGRIPAC', 'LKA SERVICES'),
  ('ABO 2', 'SDECIO', 'SODECI/ONUCI/SOTRAPIM/CARREFOUR DIALLO/TAXI BAGAGE', 'LKA SERVICES'),
  ('ABO 2', 'CACOCC', 'CMA/COCCINELLE/CONCORDE/BOIS SEC/DELICE DE FRANCE / ANCIEN MARCHE/UNICAFE/FEU ENCIENNE GENDARMERIE', 'LKA SERVICES'),
  ('ANY', 'ACIENNE', 'ANCIENNE GENDARMERIE/ BELLE VILLE MORGUE/ GARE /ADZOPE/AGBOVILLE', 'LKA SERVICES'),
  ('ANY', 'CÄTEAU', 'CHÄTEAU/MARCHE COLA/MARCHE D''ANYAMA/DON ORION/AZAGUIE/BILDA AZAGUIE AWA ATTINGUE', 'LKA SERVICES'),
  ('ANY', 'AYAMAP', 'ANYAMA/PLAQUE ARABE/ANYAMA RESIDENTIEL/EBIMPE/', 'LKA SERVICES'),
  ('ANY', 'AEAUTO', 'AXE AUTOROUTE N''DOTRE/ DANDI/COMPLEXE/MAIRIE', 'LKA SERVICES'),
  ('ANY', 'ANCGEN', 'ANCIENNE GENDARMERIE/ BELLE VILLE MORGUE/ GARE', 'LKA SERVICES'),
  ('ANY', 'BNDJIN1', 'BANDJI/N''DOTRE EXTENSION/CELESTE/NOUVELLE CASSE / ARC EN CIEL/DANDY/KOBAKRO/TERRE ROUGE/AKWABA', 'LKA SERVICES'),
  ('ANY', 'BNDJIN2', 'BANDJI/N''DOTRE EXTENSION/CELESTE/NOUVELLE CASSE / ARC EN CIEL/DANDY/KOBAKRO/TERRE ROUGE/AKWABA', 'LKA SERVICES'),
  ('ADJ', '20LGTSLGTS', '220LGTS / LIBERTÉ / QUARTIER LATIN / BRACODI / TERRASSE/RENAULT', 'BOUSSOURA SARL'),
  ('ADJ', 'WILLY', 'WILLIAMSVILLE/MACACI/ PAILLET/VIDANGE/ HMA', 'BOUSSOURA SARL'),
  ('ADJ', 'SPEURP', 'SAPEUR POMPIER/ SAINT MICHEL/ QUARTIER EBRIÉ/DALLAS', 'BOUSSOURA SARL'),
  ('ADJ', 'NNGUIA', 'NANGUI ABROGOUA / MARCHE GOURO / BLACK MARKET / MIRADOR / NOUVELLE GARE', 'BOUSSOURA SARL'),
  ('ADJ', 'BRAMA', 'BRAMACOTÉ / DÉLÉGATION / CITÉ RAN / FORUM', 'BOUSSOURA SARL'),
  ('ADJ', 'CNTREAD', 'TERRITOIRE ADJAMÉ', 'BOUSSOURA SARL'),
  ('ADZ', 'AZOPEV', 'ADZOPE VILLE', NULL),
  ('ADZ', 'AKPEVI', 'AKOUPE / YAKASSE ATTOBROU / ANDE / YAKASSE ME', NULL),
  ('AGB', 'AGBVIL', 'AGBOVILLE VILLE / N''DOUCI / SIKENSI', NULL),
  ('AGB', 'AZGUVIL', 'AZAGUIE / PETIT YAPO / GRAND YAPO / RUBINO / SECHI', NULL),
  ('ABEN', 'CFETO', 'CAFETOUTOU/AGNIKRO/ADOUKOFFIKRO/GARE DE NIABLE /AFFALIKRO/ANGOUAKRO/DRAMANKRO/NIABLE/ADAOU/BAOULEKRO', 'RIZKALLAH MICHEL'),
  ('ABEN', 'CMMER', 'COMMERCE/RELAIS/HKB/LOBIKRO/CAMP MILITAIRE/PLATEAU', 'RIZKALLAH MICHEL'),
  ('ABEN', 'RSDT', 'RESIDENTIEL/120 LGMT/CHICAGO/BAOULEKRO/DIOULAKRO/GAGOU/OUELLE/GRAV D''OR/COMMERCE/KREGBE/SOSSOBOUGOU', 'RIZKALLAH MICHEL'),
  ('ABEN', 'PLTEMI', 'ADAOU/ADOUKOFIKRO/BAOULEKRO/CAFETOU/AGNIKRO/CMP MILITAIRE/COMMERCE/DIOULAKRO/HKB/LOBKRO/PLATX/RELAIS', 'RIZKALLAH MICHEL'),
  ('ABEN', 'GRELO', 'BONAHOUIN/ARRAH/BONGOUANOU/APRONPRON/ASSIKASSO/AGNIBILEKRO/ANDE/APKAOUSSOU/DAOUKRO/TANKESSE/ANUANSUE', 'RIZKALLAH MICHEL'),
  ('YAM', 'BNON', 'Bonon / Garango / Gobazra / Bouaflé / Zougoussou / Zambakro / Zuenoula', 'UP GROUND SALES & MARKETING'),
  ('YAM', 'Spim', 'Sopim / Makora - Belleville / Kokrenou 1 / Kokrenou 2 / Kokrenou 3 / Kokenou 4', 'UP GROUND SALES & MARKETING'),
  ('YAM', 'ASSAB', 'Assabou 1 - Djahakro - 50 & 227 logements - INPHB / Assabou 2 - 220 logements', 'UP GROUND SALES & MARKETING'),
  ('YAM', 'DLABOU', 'Dioulabougou 1 / Dioulabougou 2 / Dioulabougou 3 / Dioulabougou 4 / Dioulabougou 5/ Dioulabougou 6', 'UP GROUND SALES & MARKETING'),
  ('YAM', 'MROFE', 'Morofé / Morofé extention/ Morofé 2 / Morofé 3 -Habitat 1 / Habitat', 'UP GROUND SALES & MARKETING'),
  ('DIM', 'TMOD', 'Toumodi', NULL),
  ('DIM', 'DMBKRV', 'Dimbokro ville', NULL),
  ('DIM', 'BCAND', 'Toumodi / Dimbokro / M''batto / Bocanda', NULL),
  ('BKE 1', 'SKOURA', 'Sokoura / Commerce / Centre Ivoire / Houphouet-Ville / Nimbo / Djamourou / Dare_Salam / Tola / Maroc', 'SODIAMA'),
  ('BKE 1', 'KOKO', 'Koko / Audjenekourani / Hypodrome / Beaufort / Zone / Gonvreville / Beaufort/ Habitat Gonvreville', 'SODIAMA'),
  ('BKE 1', 'ONADKH', 'Cmrce/Sokoura/Marche/Boniere/Bokala/Dare salam/Belle ville/Air Frce/Djanbourou/Zone/Sakasou/Tola', 'SODIAMA'),
  ('BKE 1', 'CMRCE', 'Commerce/Nguattakro/Ahougnansou/Houphouet ville/Broukro/Sicogi/Ndakro/Campus/Adje yaokro/Tchelekro', 'SODIAMA'),
  ('BKE 1', 'BKEVILL', 'Bouaké ville', 'SODIAMA'),
  ('BKE 2', 'GRDM', 'Grand marche / Nimbo / Kennedi / Sokoura', 'IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('BKE 2', 'AIRFR', 'Air France 1,2,3 / Corridor sud', 'IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('BKE 2', 'DRSAL', 'Dares salam Djambourou / Abattoir / Laraba / Corridor Nord', 'IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('BKE 2', 'BLLVIL', 'Belle ville 1,2,3 / Campement', 'IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('KAT', 'GRDMA', 'Grand marche / Satama Sokora / Brobo / M''bahiakro/ Niakara / Dabakala', 'IDMCI'),
  ('KAT', 'KTLAVIL', 'Katiola ville', 'IDMCI'),
  ('KOR', 'REBANQ', 'Commerce/Boulevard Ado/Voie kafoudal/Voie de Mbengue/Tarato/Siempurgo/Boundiali/Gbon/Kouto/Tengréla', 'ESF KORHOGO'),
  ('KOR', 'QATAIRF', 'Quartier 14/Air France/ Sinistré/Sodepra/Cite des medecins/Tiékélézo/Prémafolo/Soba/Kassirimé', 'ESF KORHOGO'),
  ('KOR', 'HSSADG', 'Haoussadougou / Petit Paris / Soba', 'ESF KORHOGO'),
  ('KOR', 'NVEQUA', 'Nouveau Quartier / Sossorobougou / Cocody /Klofohakaha', 'ESF KORHOGO'),
  ('FER', 'BNDLI', 'Boundiali & Environs', 'ESF KORHOGO'),
  ('FER', 'FRKESS', 'Ferkessedougou & Environs SICAF1 /SICAF2', 'ESF KORHOGO'),
  ('BON', 'BNAD', 'Bouna / Doropo / Tanda', 'TAHIROU'),
  ('BON', 'BNDOK1', 'Bondoukou 1', 'TAHIROU'),
  ('BON', 'BNDOK2', 'Bondoukou 2', 'TAHIROU'),
  ('DAL', 'Lbia', 'Labia/Mossibougou/Texas/Huberson/ Millionnaire/Soleil/Kenedy2/Suisse/Grand marche/ORLY / Flora', 'BON MARCHE'),
  ('DAL', 'ABTT', 'Abattoir/Marche Manioc/Garage/Orly plateau/Dioulabougou', 'BON MARCHE'),
  ('DAL', 'CMERCE 1', 'Commerce / Kani / Mankono / Serela / Kouenahiri', 'BON MARCHE'),
  ('MNK', 'CMERCE 2', 'Commerce / Kani / Mankona', 'KAZA DISTRIBUTION'),
  ('MNK', 'DMDE', 'Diomande / Traoré / Rymer / Quartier Grarge / Garage Angola / Sifie / Kouego', 'KAZA DISTRIBUTION'),
  ('MNK', 'SGULA', 'Séguéla/ Mankono / Kani / Dianra', 'KAZA DISTRIBUTION'),
  ('MAN', 'MRCHE', 'Marche / Zele / Dayagoine / Municipal / Campus / Quartier thérèse /', 'ALI BABA CI'),
  ('MAN', 'CAFOP', 'Cafop / Camp SEA / Lycée club / Commerce / Koko / Libreville /', 'ALI BABA CI'),
  ('MAN', 'BKOUMA', 'Biankouma / Bafing / Touba / Koro / Complexe / Sangouine /', 'ALI BABA CI'),
  ('MAN', 'MANVI', 'Man ville', 'ALI BABA CI'),
  ('SOU', 'NBOUHI', 'Nanbouhi/Camp manoir/Chateau résidentiel/Gabon/Gbakalepa/Yabayo', 'SOCOCE INTERIEUR'),
  ('SOU', 'ANMANB', 'Anoumanbo/Hibiscus/Sicogi/Sans fil/Zone 4/KBF', 'SOCOCE INTERIEUR'),
  ('SOU', 'SBRE', 'Okrouyo- Guehio -Buyo -Bakayo-osserie-logboville-Dapea-lessirie-commerce-kpeiri-opouyo-cité ouvriere', 'SOCOCE INTERIEUR'),
  ('SOU', 'ISSIA', 'Issia & Environs (mira, zobia, commerce, Saioua)', 'SOCOCE INTERIEUR'),
  ('SPD', 'MNGA', 'Monogaga / Dabiho / Marche / Doupoudou', 'ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('SPD', 'GRDMRCH', 'Grand marche / Bereby / Commerce', 'ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('SPD', 'CTE', 'Cité / Jule Ferry / Lac / Sewke / Bardot', 'ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('SPD', 'JLESFE', 'Lac / Jules ferry / Zone industrielle / Bardot', 'ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('SPD', 'CRDOR', 'Corridor / Gare / Sotref / Dafci', 'ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('GAG 2', 'SLEIL', 'Zapata / Garahio / Babre / Soleil / Dioulabougou', 'SOCOCE INTERIEUR'),
  ('GAG 2', 'CRDORS', 'Dares salam / Grarage Koffi / Garage Dosso / Corridor Sinfra', 'SOCOCE INTERIEUR'),
  ('GAG 2', 'Ggnoa2', 'Gagnoa 2 / Guiberoua / Issia / Gueyo', 'SOCOCE INTERIEUR'),
  ('GAG 1', 'CMRCE', 'Commerce / Gbakayo / Galebre / Tchedelei', 'SOMALI-CI'),
  ('GAG 1', 'SLEIL', 'Soleil / Delbo / Millionnaire / Commerce', 'SOMALI-CI'),
  ('GAG 1', 'GBKY', 'Dioulabougou / Katalina / Commerce / Gbakayo', 'SOMALI-CI'),
  ('DIV', 'SKOURA', 'Doukakou / Sokoura / Commerce / Bribore', 'RIDACOM'),
  ('DIV', 'LBANAIS', 'Konankro / Libanais / Jerusalem / Dialogue 2 / Dioulabougou', 'RIDACOM'),
  ('DIV', 'DLOGUE1', 'Commerce / Dialogue 1 / Gremian / Benoi', 'RIDACOM'),
  ('GUI 1', 'Giglo1N', 'Guiglo 1 nord', 'ETABLISSEMENT EL VALAH SARL'),
  ('GUI 1', 'Giglo1S', 'Guiglo 1 sud', 'ETABLISSEMENT EL VALAH SARL'),
  ('GUI 1', 'Giglo1DK', 'Guiglo 1 / Duekoué', 'ETABLISSEMENT EL VALAH SARL'),
  ('GUI 2', 'Giglo2N', 'Guiglo 2 Nord', 'SODISMAF'),
  ('GUI 2', 'Giglo2S', 'Guiglo 2 sud', 'SODISMAF'),
  ('GUI 2', 'Giglo2TBA', 'Guiglo 2 / Touba', 'SODISMAF'),
  ('ODI', 'ODNE1', 'Odiénne 1', 'BALDE IBRAHIMA'),
  ('ODI', 'ODNE2', 'Odiénne 2', 'BALDE IBRAHIMA'),
  ('ODI', 'SMTIGLA', 'Odiénne / Tiémé / Madinani / Samatiguila', 'BALDE IBRAHIMA'),
  ('Boun', 'NIBLCAMA', 'NI3-BLONTIARA/DOROPO2-DASSIKELE/BOBOSSO-ZONGO/commerce /TEFRO-BOUNA2/CAMARASSO', 'ABDI'),
  ('Boun', 'BNGO', 'BOUNA /BROMAKOTE-VARALE/VARALE-DOROPO/AXE BOUNA-VONKORO/AXE BOUNA- MANGO', 'ABDI')
ON CONFLICT (territory_code, area_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.territory_distributeur (territory_name TEXT PRIMARY KEY, distributor_name TEXT);
ALTER TABLE public.territory_distributeur ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS territory_distributeur_read ON public.territory_distributeur;
CREATE POLICY territory_distributeur_read ON public.territory_distributeur FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS territory_distributeur_write ON public.territory_distributeur;
CREATE POLICY territory_distributeur_write ON public.territory_distributeur FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.territory_distributeur (territory_name, distributor_name) VALUES
  ('Abengourou', 'RIZKALLAH MICHEL'),
  ('Abobo 1', 'ETABLISSEMENT NIARE & FRERES'),
  ('Abobo 2', 'A POURVOIR'),
  ('Aboisso', 'NICE SERVICE'),
  ('Adjame', 'BOUSSOURA SARL'),
  ('Adzope', 'A POURVOIR'),
  ('Agboville', 'A POURVOIR'),
  ('Anyama', 'A POURVOIR'),
  ('Bassam', 'OMNI RETAIL'),
  ('Bingerville', 'DYNAMIS'),
  ('Bondoukou', 'TAHIROU'),
  ('Bouake 1', 'SODIAMA'),
  ('Bouake 2', 'IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('Bouna', 'ABDI MOHAMED'),
  ('Cocody 1', 'PLAISIR BACHUSS'),
  ('Cocody 2', 'PRODISMA'),
  ('Dabou', 'NOT AVAILABLE'),
  ('Daloa', 'BON MARCHE'),
  ('Dimbokro', 'NOT AVAILABLE'),
  ('Divo', 'RIDACOM'),
  ('Ferke', 'ESF KORHOGO'),
  ('Gagnoa 1', 'SOMALI-CI'),
  ('Gagnoa 2', 'SOCOCE INTERIEUR'),
  ('Guiglo 1', 'ETABLISSEMENT EL VALAH SARL'),
  ('Guiglo 2', 'SODISMAF'),
  ('Katiola', 'IDMCI'),
  ('Korhogo', 'ESF KORHOGO'),
  ('koumassi', 'NOT AVAILABLE'),
  ('Man', 'ALI BABA CI'),
  ('Mankono', 'KAZA DISTRIBUTION'),
  ('Marcory', 'SIDECOM'),
  ('Odienne', 'BALDE IBRAHIMA'),
  ('Plateau', 'BOUSSOURA SARL'),
  ('Port bouet', 'SDTP'),
  ('San Pedro', 'ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('Soubre', 'SOCOCE INTERIEUR'),
  ('Treichville', 'SIDECOM'),
  ('Yamoussoukro', 'UP GROUND SALES & MARKETING'),
  ('Yopougon 1', 'SODICOM-CI'),
  ('Yopougon 2', 'SODICOM-CI'),
  ('Yopougon 3', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Yopougon 4', 'NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Tous les territoires', 'PROSUMA CASH PORT')
ON CONFLICT (territory_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pos_types (
  level4_type TEXT PRIMARY KEY,
  level3_group TEXT NOT NULL,
  tier TEXT
);
ALTER TABLE public.pos_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_types_read ON public.pos_types;
CREATE POLICY pos_types_read ON public.pos_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pos_types_write ON public.pos_types;
CREATE POLICY pos_types_write ON public.pos_types FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin','superviseur')));
INSERT INTO public.pos_types (level4_type, level3_group, tier) VALUES
  ('Hypermarket Premium', 'Hypermarkets', NULL),
  ('Supermarket A Value', 'Supermarkets', NULL),
  ('Supermarket B Value', 'Supermarkets', NULL),
  ('Supermarket C', 'Supermarkets', 'C'),
  ('Superettes A', 'Minimarkets', 'A'),
  ('Superettes B', 'Minimarkets', 'B'),
  ('Superettes C', 'Minimarkets', 'C'),
  ('Boutique A', 'Small/Medium Grocery GT', 'A'),
  ('Boutique B', 'Small/Medium Grocery GT', 'B'),
  ('Boutique C', 'Small/Medium Grocery GT', 'C'),
  ('Petrol Station', 'Fuel forecourts', NULL),
  ('Pharmacy A', 'Pharmacy Chain/Independent', 'A'),
  ('Pharmacy B', 'Pharmacy Chain/Independent', 'B'),
  ('Pharmacy C', 'Pharmacy Chain/Independent', 'C'),
  ('Bakery A', 'Bakery (Chain/Independent)', 'A'),
  ('Bakery B', 'Bakery (Chain/Independent)', 'B'),
  ('Bakery C', 'Bakery (Chain/Independent)', 'C'),
  ('General Grocery stall', 'Wet/Public Market', NULL),
  ('Open Market Table Top', 'Wet/Public Market', NULL),
  ('Tmamies (Oil spice & condiments)', 'Wet/Public Market', NULL),
  ('Wholesalers', 'Traditional Wholesale', NULL),
  ('Semi-Wholesalers', 'Traditional Wholesale', NULL),
  ('Cash & Carry A', 'Wholesale Club/Cash & Carry', 'A'),
  ('Cash & Carry B', 'Wholesale Club/Cash & Carry', 'B'),
  ('E-retailers', 'Bricks and Clicks', NULL),
  ('Home delivery', 'Shop in Shop', NULL),
  ('Chain Hotel', 'Hotel chains', NULL),
  ('Independent Hotel', 'Hotel chains', NULL),
  ('International Restaurant', 'Full Service Restaurant', NULL),
  ('Local Restaurant', 'Full Service Restaurant', NULL),
  ('Aboki A', 'Independent Street Vendor Tea & Coffee', 'A'),
  ('Aboki B', 'Independent Street Vendor Tea & Coffee', 'B'),
  ('Kiosk A', 'Independent Street Vendor Tea & Coffee', 'A'),
  ('Kiosk B', 'Independent Street Vendor Tea & Coffee', 'B'),
  ('Pushcard A', 'Independent Street Vendor Tea & Coffee', 'A'),
  ('Pushcard B', 'Independent Street Vendor Tea & Coffee', 'B'),
  ('Horeca coffee', 'Independent Street Vendor Tea & Coffee', NULL),
  ('Porridge', 'Independent Street Vendor Tea & Coffee', NULL),
  ('Table Top', 'Independent Street Vendor Tea & Coffee', NULL),
  ('Vending machine', 'Institutes/Office/Factory/Industry', NULL),
  ('Institutes/company sales', 'Institutes/Office/Factory/Industry', NULL)
ON CONFLICT (level4_type) DO NOTHING;

ALTER TABLE public.pdv ADD COLUMN IF NOT EXISTS territory_code TEXT;
ALTER TABLE public.pdv ADD COLUMN IF NOT EXISTS area_code TEXT;
ALTER TABLE public.pdv ADD COLUMN IF NOT EXISTS distributor_name TEXT;
CREATE INDEX IF NOT EXISTS idx_pdv_territory ON public.pdv(territory_code);
CREATE INDEX IF NOT EXISTS idx_pdv_distributor ON public.pdv(distributor_name);

-- FIN 020
