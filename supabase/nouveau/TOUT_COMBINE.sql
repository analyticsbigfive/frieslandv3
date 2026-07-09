-- ============================================================================
-- Migration 1/4 : GÉOGRAPHIE  (onglet TERRITORY)
-- Hiérarchie : pays > région > sous-région > territoire > zone
-- 'nom_affichage' = nom commercial lisible (ex. SOUTH 1 REGION -> ABIDJAN 1)
-- (la colonne 'dist' de l'onglet était cassée -> #REF!, non reprise)
-- ============================================================================
begin;

create table if not exists pays (
  id   bigint generated always as identity primary key,
  code text not null unique,
  nom  text not null
);
create table if not exists region (
  id            bigint generated always as identity primary key,
  code          text not null unique,
  nom           text not null,
  nom_affichage text,
  pays_code     text not null references pays(code)
);
create table if not exists sous_region (
  id            bigint generated always as identity primary key,
  code          text not null unique,
  nom           text not null,
  nom_affichage text,
  region_code   text not null references region(code)
);
create table if not exists territoire (
  id              bigint generated always as identity primary key,
  code            text not null unique,
  nom             text not null unique,
  sous_region_code text not null references sous_region(code)
);
create table if not exists zone (
  id              bigint generated always as identity primary key,
  code            text,
  nom             text not null,
  territoire_code text not null references territoire(code)
);

insert into pays(code,nom) values
  ('CI1','Cote d''Ivoire')
on conflict (code) do nothing;

insert into region(code,nom,nom_affichage,pays_code) values
  ('SOUTHDIV','SOUTH DIVISION','ABIDJAN','CI1'),
  ('NORTHDIV','NORTH DIVISION','UP COUNTRY','CI1')
on conflict (code) do nothing;

insert into sous_region(code,nom,nom_affichage,region_code) values
  ('SOUTH1','SOUTH 1 REGION','ABIDJAN 1','SOUTHDIV'),
  ('SOUTH2','SOUTH 2 REGION','ABIDJAN 2','SOUTHDIV'),
  ('CNE','CENTRE-NORD -EST REGION','NORTH 1','NORTHDIV'),
  ('WEST','WEST REGION','NORTH 2','NORTHDIV')
on conflict (code) do nothing;

insert into territoire(code,nom,sous_region_code) values
  ('BIN','Bingerville','SOUTH1'),
  ('COC 1','Cocody 1','SOUTH1'),
  ('COC 2','Cocody 2','SOUTH1'),
  ('TRE','Treichville','SOUTH1'),
  ('MAR','Marcory','SOUTH1'),
  ('KOU','koumassi','SOUTH1'),
  ('PRB','Port bouet','SOUTH1'),
  ('BAS','Bassam','SOUTH1'),
  ('ABO','Aboisso','SOUTH1'),
  ('PLA','Plateau','SOUTH1'),
  ('YOP 1','Yopougon 1','SOUTH2'),
  ('YOP 2','Yopougon 2','SOUTH2'),
  ('YOP 3','Yopougon 3','SOUTH2'),
  ('YOP 4','Yopougon 4','SOUTH2'),
  ('DAB','Dabou','SOUTH2'),
  ('ABO 1','Abobo 1','SOUTH2'),
  ('ABO 2','Abobo 2','SOUTH2'),
  ('ANY','Anyama','SOUTH2'),
  ('ADJ','Adjame','SOUTH2'),
  ('ADZ','Adzope','SOUTH2'),
  ('AGB','Agboville','SOUTH2'),
  ('ABEN','Abengourou','CNE'),
  ('YAM','Yamoussoukro','CNE'),
  ('DIM','Dimbokro','CNE'),
  ('BKE 1','Bouake 1','CNE'),
  ('BKE 2','Bouake 2','CNE'),
  ('KAT','Katiola','CNE'),
  ('KOR','Korhogo','CNE'),
  ('FER','Ferke','CNE'),
  ('BON','Bondoukou','CNE'),
  ('DAL','Daloa','WEST'),
  ('MNK','Mankono','WEST'),
  ('MAN','Man','WEST'),
  ('SOU','Soubre','WEST'),
  ('SPD','San Pedro','WEST'),
  ('GAG 2','Gagnoa 2','WEST'),
  ('GAG 1','Gagnoa 1','WEST'),
  ('DIV','Divo','WEST'),
  ('GUI 1','Guiglo 1','WEST'),
  ('GUI 2','Guiglo 2','WEST'),
  ('ODI','Odienne','WEST'),
  ('Boun','Bouna','CNE')
on conflict (code) do nothing;

insert into zone(code,nom,territoire_code) values
  ('NVEG','NOUVEAU GOUDRON/ FEH KESSE/ CITE SIR/ AKANDJE/ LAURIER 15/SANTE','BIN'),
  ('BLAN','BLANCHON/PALMERAIE BINGERVILLE/ADJAME BINGERVILLE/ BREGBO/AKOUAI SANTE/AMAN/','BIN'),
  ('BCIE','BASE CIE/ KOROCOBOUGOU/GBAGBA/BERLIN/SAVANE/MACHOU/SICOGI/MACHOUX/MARCHE/','BIN'),
  ('ABAT','ABATTA/ABATTA VILLAGE/JULES VERNE/CITE DU PORT','BIN'),
  ('BING','TOUT BINGERVILLE','BIN'),
  ('LCET','LYCEE TECHNIQUE/VALLON/COLOMBIE','COC 1'),
  ('MAHO','MAHOU COLOMBIE','COC 1'),
  ('PERL','PERLE/MAHOU/ANGRE','COC 1'),
  ('PALM','PALMERAIE/ATTOBAN /BONOUMIN','COC 1'),
  ('PALM2','PALMERAIE2 COCOVICO','COC 1'),
  ('ANGR','ANGRE 2PLATEAUX 7 TRANCHE','COC 1'),
  ('DJOR','BESSIKOI/DJOROBITE','COC 1'),
  ('DNGA','DANGA/COCODY CENTRE/BLAUKOSS','COC 2'),
  ('BLKH','BLAUKOSS COCODY CENTRE','COC 2'),
  ('RVER2','RIVIERA 2/ RIVIERA 3/ GOLF','COC 2'),
  ('ANON','ANONO','COC 2'),
  ('FAYB','FAYA BON PRIX/ABATTA','COC 2'),
  ('CIAD','CIAD/MPOUTO/SYNACACI/FAYA (COTE ECHANGEUR)','COC 2'),
  ('ARAS','ARAS/ BELLEVILLE/ BIAFRA/ QUARTIER APOLLO / ZONE 3','TRE'),
  ('BIAF','ARAS/ BELLEVILLE/ BIAFRA/ QUARTIER APOLLO / ZONE 3','TRE'),
  ('RSD','RÉSIDENTIEL / CHAMPROUX / GROUPEMENT/ HIBISCUS / MASSARANA','MAR'),
  ('SICOG','SICOGI / REMBLAIS / ANOUMANBO/ SANS FIL / ZONE 4','MAR'),
  ('HIBI','RÉSIDENTIEL / CHAMPROUX / GRPE/ HIBISCUS / MASSARANA / SICOGI / REMBLAIS /ANOUMANBO/ SANS FIL/ ZONE4','MAR'),
  ('RBLA','REMBLAIS/MARAIS/ DIVO/ KOUMASSI 32/ TERM 05','KOU'),
  ('CTE147','CITÉ 147/ PRODOMO/SOPIM/ CAMPEMENT/SOWETO/SICOGI','KOU'),
  ('AHOU','AHOUSSABOUGOU/ 3 AMPOULES/ MARCHÉ DJE KONAN/SOLEIL/GELTI','KOU'),
  ('KMSS32','REMBLAIS/MARAIS/ DIVO/ KOUMASSI 32/ TERM 05 /3 AMPOULES / AHOUSSABOUGOU','KOU'),
  ('PRDM','CITÉ 147/ PRODOMO/SOPIM/ CAMPEMENT/SOWETO/SICOGI/ MARCHÉ DJE KONAN / SOLEIL','KOU'),
  ('PRBC','PORT BOUET CENTRE/CITÉ POLICIÈRE/PETIT BASSAM/VRIDI','PRB'),
  ('AERO','AÉROPORT/ ADJAWUI','PRB'),
  ('JANF','JEAN FOLLY/ ADJOUFOU','PRB'),
  ('TRCA','TERRE ROUGE/CORRIDOR/ANANI','PRB'),
  ('PRBO','PORT BOUET','PRB'),
  ('MOKE','MOCKEYVILLE/UNIVERSITÉ AMÉRICAINE/ EDOUKOU MIEZAN/QUARTIER ARTISANAL/MODESTE/ANANI/MOOSOU 1','BAS'),
  ('VETO','VETOCO/MOOSOU2/IMPERIAL/DOS/QUARTIER FRANCE/DIOULABOUGOU/AZURETI','BAS'),
  ('ANAN','ANANI/DOS/ DIOULABOUGO/PETIT MARCHÉ','BAS'),
  ('8KLO','8 KILOS/ YAOU/CENTRE VILLE/BEGNERI/SAMO/ASSINIE','BAS'),
  ('YAOU','8 KILOS/ YAOU/CENTRE VILLE/BEGNERI/SAMO/ASSINIE','BAS'),
  ('CTREV','8 KILOS/ YAOU/CENTRE VILLE/BEGNERI','BAS'),
  ('DJELI','DJELIBA /TP/ PARCERELLE/KONAN KAN/BOIS BLANC/ AYEBO/ADAOU','ABO'),
  ('DIATEK','DIATEKRO/SOKORA/CCE/WATTVILLE/BELLEVILLE/SOS/DOSOBAH/CITÉ KOUMI/LYCÉE/ KRINDJABO/KOLAIWA/SANHOUMAN','ABO'),
  ('AYME','AYAMÉ/EBIKRA/AKRESIE/N’ZIKRO/BABADOUGOU/EBOUÉ/ABY/ADJOUAN/MOYASSUÉ/AKAKRO/  V1/V2/KRINDJABO/KASSIKRO','ABO'),
  ('ADKE','ADIAKÉ/ABOISSO/AYAMÉ/ KRINDJABO/ NOÉ/ ASSE/SOUMIÉ/N''ZIKRO/ KOFFIKRO/BABADOUGOU/ CARF AHENOUA/ADAOU','ABO'),
  ('AGBA','AGBAN VILLAGE / CITE FERMONT / ATTECOUBE CENTRE / PLATEAU CENTRE / MARCHE DE FRUIT','PLA'),
  ('CTEFER','AGBAN VILLAGE / CITE FERMONT / ATTECOUBE CENTRE / PLATEAU CENTRE / MARCHE DE FRUIT','PLA'),
  ('ATTC','YOPOUGON 1 & 2','YOP 1'),
  ('WASS','WASSAKARA /  SELMER / SICOGI','YOP 1'),
  ('SELM','WASSAKARA /  SELMER / SICOGI','YOP 1'),
  ('SBLE','YOPOUGON SABLE / MILLIONNAIRE / NOUVEAU QUARTIER','YOP 1'),
  ('MILLI','YOPOUGON SABLE / MILLIONNAIRE / NOUVEAU QUARTIER','YOP 1'),
  ('NGON','NIANGON NORD / SIDECI','YOP 1'),
  ('TOROU','TOIT ROUGE / LOKODJRO / ATTECOUBE MOSSIKRO','YOP 1'),
  ('LKOD','TOIT ROUGE / LOKODJRO / ATTECOUBE MOSSIKRO','YOP 1'),
  ('NGOS','NIANGON SUD / AZITO','YOP 2'),
  ('AZTO','NIANGON SUD/ AZITO','YOP 2'),
  ('KTE','KOUTÉ/ PETIT TOIT ROUGE/ BÉAGO','YOP 2'),
  ('BEAG','KOUTÉ/ PETIT TOIT ROUGE/ BÉAGO','YOP 2'),
  ('KWEI','KOWEIT/ SANTÉ/ ABOBO DOUMÉ/ AGBAYATÉ','YOP 2'),
  ('YOPS','KOWEIT/ YOPOUGON SANTÉ/ ABOBO DOUMÉ/ AGBAYATÉ','YOP 2'),
  ('ADKOI','ANDOKOI/ UNIWAX/CRF ZONE /PRISON CIVILE/SODEFOR  ET CITÉ ADO','YOP 3'),
  ('ZNEIND','ZONE INDUSTRIELLE/ MICAO/GESCO FOURRIÈRE/ PK22/SIKENSI/ATTINGUÉ','YOP 3'),
  ('MCAO','ANDOKOI/ UNIWAX/ ZONE INDUSTRIELLE/ MICAO GESCO FOURRIÈRE/PRISON CIVILE/ SODEFOR/CITÉ ADO......','YOP 3'),
  ('GSCO','ANDOKOI/UNIWAX/ ZONE INDUSTRIELLE/ MICAO/ GESCO FOURRIÈRE/ PRISON CIVILE/ SODEFOR ET CITÉ ADO....','YOP 3'),
  ('SPOREXBANCO2/ ABOULAYE DIALLO/ ANANE','SIPOREX/ BANCO2/ ABOULAYE DIALLO/ ANANERAIE/ MAMIE ADJOUA/PORT BOUET 2/CRF CHU/MOSQUÉE KOUDOUS','YOP 3'),
  ('PRTBOU','PORT BOUET 2/CRF CHU/MOSQUÉE KOUDOUS/ ANANERAIE/ FUSCOM PORT BOUET 2/RD POINT GESCO','YOP 3'),
  ('AANERAIEANANERAI','ANANERAIE/ GESCO RD POINT/ BATIM/MAMIE ADJOUA','YOP 3'),
  ('LBAFRIQUEJATARK','LUBAFRIQUE/ JATARK/ LOKOA/CITÉ VERTE/BAGNON/ LIÈVRE ROUGE/KM17/BIMBRESSO/','YOP 4'),
  ('CNEO','MATY/CANARI /ANTENNE/ SICOGI ATTIÉ/NIANGON À DROITE/ NIANGON CONTINUE/ CITÉ EECI','YOP 4'),
  ('KBIM','KM17/BIMBRESSO/  ́JATARK/LOKOA CITÉ VERTE/ LIÈVRE ROUGE','YOP 4'),
  ('DCCO','SICOGI ATTIÉ/ST ANDRÉ CÔTÉ DROIT/ PMI/AIMÉ CESAIRE/BON PRIX/ CRF BOBY & POLICIER CÔTÉ DROIT/BAR ECLA','YOP 4'),
  ('TRMINUSNUS','TERMINUS 47 SECTEUR DROIT/ SICOGI PMI/ TIKEN DJA/BMW/KIMI','YOP 4'),
  ('AADÉMIEMIE','ACADÉMIE/ FIN GOUDRON/ PAYS BAS/CAISTAB/CITÉ LAURIER/ CITÉ VERTE','YOP 4'),
  ('MROCAN','MAROC/ANANERAIE/ PORT BOUET 2/LUBAFRIQUE/ NIANGON À DROITE /TEXACO À DROITE','YOP 4'),
  ('SNGONN','SONGON/N’DJEM/ CARREFOUR JACQUESVILLE/JACQUESVILLE VILLE/ DABOU/N’ZEKREZESSOU....','DAB'),
  ('GANDLA','GRAND LAHOU/CRF GRAND LAHOU/CRF FRESCO/FRESCO VILLE ET PÉRIPHÉRIES','DAB'),
  ('DBOUVI','DABOU VILLE/ SONGON/ CARREFOUR JACQUESVILLE....','DAB'),
  ('SNGON','SONGON/ CARREFOUR JACQUESVILLE/ JACQUESVILLE/ DABOU/GRAND LAHOU/FRESCO/','DAB'),
  ('DKUI','DOKUI / ANADOR / COCO SERVICE DERRIÈRE UNIVERSITÉ ABOBO/ADJAMÉ / ALEPE','ABO 1'),
  ('AOCATIERAVOCATIE','AVOCATIER / BC AUTOUTE / NOUVELLE GARE / AGNISSANKOI / BC','ABO 1'),
  ('SMANKEKE','SAMANKE / KOLETCHA / ABOBO BAOULE / BIABOU','ABO 1'),
  ('AEIKOIOI','AKEIKOI  / HABITAT  / AGBEKOI /  HOUPHOUT BOIGNY','ABO 1'),
  ('LCEEMO','LYCEE MODERNE / ETOILE / GENDARMERIE / BON PRIX GENDARMERIE / CHATTONS','ABO 1'),
  ('CTEPOL','CITE POLICIERE / CAMP COMMANDO / CNPS / AVENUE KAZA / COLATIER','ABO 1'),
  ('AOBOGA','ABOBO GARE  / MAIRIE','ABO 1'),
  ('MSQUEB','MOSQUE BLANCHE/ANOKOUA KOUTE/MARAHOUE/AGRIPAC','ABO 2'),
  ('MSQUEB','MOSQUE BLANCHE/ANOKOUA KOUTE/MARAHOUE/AGRIPAC','ABO 2'),
  ('SDECIO','SODECI/ONUCI/SOTRAPIM/CARREFOUR DIALLO/TAXI BAGAGE','ABO 2'),
  ('SDECIO','SODECI/ONUCI/SOTRAPIM/CARREFOUR DIALLO/TAXI BAGAGE','ABO 2'),
  ('CACOCC','CMA/COCCINELLE/CONCORDE/BOIS SEC/DELICE DE FRANCE / ANCIEN MARCHE/UNICAFE/FEU ENCIENNE GENDARMERIE','ABO 2'),
  ('ACIENNE','ANCIENNE GENDARMERIE/ BELLE VILLE MORGUE/ GARE /ADZOPE/AGBOVILLE','ANY'),
  ('CÄTEAU','CHÄTEAU/MARCHE COLA/MARCHE D''ANYAMA/DON ORION/AZAGUIE/BILDA AZAGUIE AWA ATTINGUE','ANY'),
  ('AYAMAP','ANYAMA/PLAQUE ARABE/ANYAMA RESIDENTIEL/EBIMPE/','ANY'),
  ('CÄTEAU','CHÄTEAU/MARCHE COLA/MARCHE D''ANYAMA/DON ORION/ MACHE CHAKA KONE','ANY'),
  ('AEAUTO','AXE AUTOROUTE N''DOTRE/ DANDI/COMPLEXE/MAIRIE','ANY'),
  ('ANCGEN','ANCIENNE GENDARMERIE/ BELLE VILLE MORGUE/ GARE','ANY'),
  ('BNDJIN1','BANDJI/N''DOTRE EXTENSION/CELESTE/NOUVELLE CASSE / ARC EN CIEL/DANDY/KOBAKRO/TERRE ROUGE/AKWABA','ANY'),
  ('BNDJIN2','BANDJI/N''DOTRE EXTENSION/CELESTE/NOUVELLE CASSE / ARC EN CIEL/DANDY/KOBAKRO/TERRE ROUGE/AKWABA','ANY'),
  ('20LGTSLGTS','220LGTS / LIBERTÉ / QUARTIER LATIN / BRACODI / TERRASSE/RENAULT','ADJ'),
  ('WILLY','WILLIAMSVILLE/MACACI/ PAILLET/VIDANGE/ HMA','ADJ'),
  ('SPEURP','SAPEUR POMPIER/ SAINT MICHEL/ QUARTIER EBRIÉ/DALLAS','ADJ'),
  ('NNGUIA','NANGUI ABROGOUA / MARCHE GOURO / BLACK MARKET / MIRADOR / NOUVELLE GARE','ADJ'),
  ('BRAMA','BRAMACOTÉ / DÉLÉGATION / CITÉ RAN / FORUM','ADJ'),
  ('CNTREAD','TERRITOIRE ADJAMÉ','ADJ'),
  ('AZOPEV','ADZOPE VILLE','ADZ'),
  ('AKPEVI','AKOUPE / YAKASSE ATTOBROU / ANDE / YAKASSE ME','ADZ'),
  ('AGBVIL','AGBOVILLE VILLE / N''DOUCI / SIKENSI','AGB'),
  ('AZGUVIL','AZAGUIE / PETIT YAPO / GRAND YAPO / RUBINO / SECHI','AGB'),
  ('CFETO','CAFETOUTOU/AGNIKRO/ADOUKOFFIKRO/GARE DE NIABLE /AFFALIKRO/ANGOUAKRO/DRAMANKRO/NIABLE/ADAOU/BAOULEKRO','ABEN'),
  ('CMMER','COMMERCE/RELAIS/HKB/LOBIKRO/CAMP MILITAIRE/PLATEAU','ABEN'),
  ('RSDT','RESIDENTIEL/120 LGMT/CHICAGO/BAOULEKRO/DIOULAKRO/GAGOU/OUELLE/GRAV D''OR/COMMERCE/KREGBE/SOSSOBOUGOU','ABEN'),
  ('PLTEMI','ADAOU/ADOUKOFIKRO/BAOULEKRO/CAFETOU/AGNIKRO/CMP MILITAIRE/COMMERCE/DIOULAKRO/HKB/LOBKRO/PLATX/RELAIS','ABEN'),
  ('GRELO','BONAHOUIN/ARRAH/BONGOUANOU/APRONPRON/ASSIKASSO/AGNIBILEKRO/ANDE/APKAOUSSOU/DAOUKRO/TANKESSE/ANUANSUE','ABEN'),
  ('BNON','Bonon / Garango / Gobazra / Bouaflé / Zougoussou / Zambakro / Zuenoula','YAM'),
  ('Spim','Sopim / Makora - Belleville / Kokrenou 1 / Kokrenou 2 / Kokrenou 3 / Kokenou 4','YAM'),
  ('ASSAB','Assabou 1 - Djahakro - 50 & 227 logements - INPHB / Assabou 2 - 220 logements','YAM'),
  ('DLABOU','Dioulabougou 1 / Dioulabougou 2 / Dioulabougou 3 / Dioulabougou 4 / Dioulabougou 5/ Dioulabougou 6','YAM'),
  ('MROFE','Morofé / Morofé extention/ Morofé 2 / Morofé 3 -Habitat 1 / Habitat','YAM'),
  ('TMOD','Toumodi','DIM'),
  ('DMBKRV','Dimbokro ville','DIM'),
  ('BCAND','Toumodi / Dimbokro / M''batto / Bocanda','DIM'),
  ('SKOURA','Sokoura / Commerce / Centre Ivoire / Houphouet-Ville / Nimbo / Djamourou / Dare_Salam / Tola / Maroc','BKE 1'),
  ('KOKO','Koko / Audjenekourani / Hypodrome / Beaufort / Zone / Gonvreville / Beaufort/ Habitat Gonvreville','BKE 1'),
  ('ONADKH','Cmrce/Sokoura/Marche/Boniere/Bokala/Dare salam/Belle ville/Air Frce/Djanbourou/Zone/Sakasou/Tola','BKE 1'),
  ('CMRCE','Commerce/Nguattakro/Ahougnansou/Houphouet ville/Broukro/Sicogi/Ndakro/Campus/Adje yaokro/Tchelekro','BKE 1'),
  ('BKEVILL','Bouaké ville','BKE 1'),
  ('GRDM','Grand marche / Nimbo / Kennedi / Sokoura','BKE 2'),
  ('AIRFR','Air France 1,2,3 / Corridor sud','BKE 2'),
  ('DRSAL','Dares salam Djambourou / Abattoir / Laraba / Corridor Nord','BKE 2'),
  ('BLLVIL','Belle ville 1,2,3 / Campement','BKE 2'),
  ('GRDMA','Grand marche / Satama Sokora / Brobo / M''bahiakro/ Niakara / Dabakala','KAT'),
  ('KTLAVIL','Katiola ville','KAT'),
  ('REBANQ','Commerce/Boulevard Ado/Voie kafoudal/Voie de Mbengue/Tarato/Siempurgo/Boundiali/Gbon/Kouto/Tengréla','KOR'),
  ('QATAIRF','Quartier 14/Air France/ Sinistré/Sodepra/Cite des medecins/Tiékélézo/Prémafolo/Soba/Kassirimé','KOR'),
  ('HSSADG','Haoussadougou / Petit Paris / Soba','KOR'),
  ('NVEQUA','Nouveau Quartier / Sossorobougou / Cocody /Klofohakaha','KOR'),
  ('BNDLI','Boundiali & Environs','FER'),
  ('FRKESS','Ferkessedougou & Environs SICAF1 /SICAF2','FER'),
  ('BNAD','Bouna / Doropo / Tanda','BON'),
  ('BNDOK1','Bondoukou 1','BON'),
  ('BNDOK2','Bondoukou 2','BON'),
  ('Lbia','Labia/Mossibougou/Texas/Huberson/ Millionnaire/Soleil/Kenedy2/Suisse/Grand marche/ORLY / Flora','DAL'),
  ('ABTT','Abattoir/Marche Manioc/Garage/Orly plateau/Dioulabougou','DAL'),
  ('CMERCE 1','Commerce / Kani / Mankono / Serela / Kouenahiri','DAL'),
  ('CMERCE 2','Commerce / Kani   / Mankona','MNK'),
  ('DMDE','Diomande / Traoré / Rymer / Quartier Grarge / Garage Angola / Sifie / Kouego','MNK'),
  ('SGULA','Séguéla/ Mankono / Kani / Dianra','MNK'),
  ('MRCHE','Marche / Zele / Dayagoine / Municipal / Campus / Quartier thérèse /','MAN'),
  ('CAFOP','Cafop / Camp SEA / Lycée club / Commerce / Koko / Libreville /','MAN'),
  ('BKOUMA','Biankouma / Bafing / Touba / Koro / Complexe / Sangouine /','MAN'),
  ('MANVI','Man ville','MAN'),
  ('NBOUHI','Nanbouhi/Camp manoir/Chateau résidentiel/Gabon/Gbakalepa/Yabayo','SOU'),
  ('ANMANB','Anoumanbo/Hibiscus/Sicogi/Sans fil/Zone 4/KBF','SOU'),
  ('SBRE','Okrouyo- Guehio -Buyo -Bakayo-osserie-logboville-Dapea-lessirie-commerce-kpeiri-opouyo-cité ouvriere','SOU'),
  ('ISSIA','Issia & Environs (mira, zobia, commerce, Saioua)','SOU'),
  ('MNGA','Monogaga / Dabiho / Marche / Doupoudou','SPD'),
  ('GRDMRCH','Grand marche / Bereby / Commerce','SPD'),
  ('CTE','Cité / Jule Ferry / Lac / Sewke / Bardot','SPD'),
  ('JLESFE','Lac / Jules ferry / Zone industrielle / Bardot','SPD'),
  ('CRDOR','Corridor / Gare / Sotref / Dafci','SPD'),
  ('SLEIL','Zapata / Garahio / Babre / Soleil / Dioulabougou','GAG 2'),
  ('CRDORS','Dares salam / Grarage Koffi / Garage Dosso / Corridor Sinfra','GAG 2'),
  ('Ggnoa2','Gagnoa 2 / Guiberoua / Issia / Gueyo','GAG 2'),
  ('CMRCE','Commerce / Gbakayo / Galebre / Tchedelei','GAG 1'),
  ('SLEIL','Soleil / Delbo / Millionnaire / Commerce','GAG 1'),
  ('GBKY','Dioulabougou / Katalina / Commerce / Gbakayo','GAG 1'),
  ('SKOURA','Doukakou / Sokoura / Commerce / Bribore','DIV'),
  ('LBANAIS','Konankro / Libanais / Jerusalem / Dialogue 2 / Dioulabougou','DIV'),
  ('DLOGUE1','Commerce / Dialogue 1 / Gremian / Benoi','DIV'),
  ('Giglo1N','Guiglo 1 nord','GUI 1'),
  ('Giglo1S','Guiglo 1 sud','GUI 1'),
  ('Giglo1DK','Guiglo 1 / Duekoué','GUI 1'),
  ('Giglo2N','Guiglo 2 Nord','GUI 2'),
  ('Giglo2S','Guiglo 2 sud','GUI 2'),
  ('Giglo2TBA','Guiglo 2 / Touba','GUI 2'),
  ('ODNE1','Odiénne 1','ODI'),
  ('ODNE2','Odiénne 2','ODI'),
  ('SMTIGLA','Odiénne / Tiémé / Madinani / Samatiguila','ODI'),
  ('NIBLCAMA','NI3-BLONTIARA/DOROPO2-DASSIKELE/BOBOSSO-ZONGO/commerce /TEFRO-BOUNA2/CAMARASSO','Boun'),
  ('BNGO','BOUNA /BROMAKOTE-VARALE/VARALE-DOROPO/AXE BOUNA-VONKORO/AXE BOUNA- MANGO','Boun')
on conflict do nothing;

commit;-- ============================================================================
-- Migration 2/4 : POINTS DE VENTE  (onglet TYPE DE POINT DE VENTE)
-- Nomenclature 2 niveaux : categorie_pdv (niveau 3) > type_pdv (niveau 4)
-- Noms de catégories conservés à l'identique. 'canal' GT/MT = proposition à valider.
-- ============================================================================
begin;
create table if not exists categorie_pdv (
  id    bigint generated always as identity primary key,
  nom   text not null unique,
  canal text check (canal in ('GT','MT'))
);
create table if not exists type_pdv (
  id              bigint generated always as identity primary key,
  categorie_pdv_id bigint not null references categorie_pdv(id) on delete cascade,
  nom             text not null unique
);

insert into categorie_pdv(nom) values
  ('Bakery (Chain/Independent)'),
  ('Bricks and Clicks'),
  ('Fuel forecourts'),
  ('Full Service Restaurant'),
  ('Hotel chains'),
  ('Hypermarkets'),
  ('Independent Street Vendor Tea & Coffee'),
  ('Institutes/Office/Factory/Industry'),
  ('Minimarkets'),
  ('Pharmacy Chain/Independent'),
  ('Premium Supermarkets'),
  ('Shop in Shop'),
  ('Small/Medium Grocery GT'),
  ('Traditional Wholesale'),
  ('Value Supermarkets'),
  ('Wet/Public Market'),
  ('Wholesale Club/Cash & Carry')
on conflict (nom) do nothing;

insert into type_pdv(categorie_pdv_id,nom)
select cp.id, v.t from (values
  ('Hypermarkets','Hypermarket'),
  ('Premium Supermarkets','Supermarket A'),
  ('Value Supermarkets','Supermarket B'),
  ('Value Supermarkets','Supermarket C'),
  ('Minimarkets','Superettes A'),
  ('Minimarkets','Superettes B'),
  ('Minimarkets','Superettes C'),
  ('Small/Medium Grocery GT','Boutique A'),
  ('Small/Medium Grocery GT','Boutique B'),
  ('Small/Medium Grocery GT','Boutique C'),
  ('Fuel forecourts','Petrol Station'),
  ('Pharmacy Chain/Independent','Pharmacy A'),
  ('Pharmacy Chain/Independent','Pharmacy B'),
  ('Pharmacy Chain/Independent','Pharmacy C'),
  ('Bakery (Chain/Independent)','Bakery A'),
  ('Bakery (Chain/Independent)','Bakery B'),
  ('Bakery (Chain/Independent)','Bakery C'),
  ('Wet/Public Market','General Grocery stall'),
  ('Wet/Public Market','Open Market Table Top'),
  ('Wet/Public Market','Tmamies (Oil spice & condiments)'),
  ('Traditional Wholesale','Wholesalers'),
  ('Traditional Wholesale','Semi-Wholesalers'),
  ('Wholesale Club/Cash & Carry','Cash & Carry A'),
  ('Wholesale Club/Cash & Carry','Cash & Carry B'),
  ('Bricks and Clicks','E-retailers'),
  ('Shop in Shop','Home delivery'),
  ('Hotel chains','Chain Hotel'),
  ('Hotel chains','Independent Hotel'),
  ('Full Service Restaurant','International Restaurant'),
  ('Full Service Restaurant','Local Restaurant'),
  ('Independent Street Vendor Tea & Coffee','Aboki A'),
  ('Independent Street Vendor Tea & Coffee','Aboki B'),
  ('Independent Street Vendor Tea & Coffee','Kiosk A'),
  ('Independent Street Vendor Tea & Coffee','Kiosk B'),
  ('Independent Street Vendor Tea & Coffee','Pushcard A'),
  ('Independent Street Vendor Tea & Coffee','Pushcard B'),
  ('Independent Street Vendor Tea & Coffee','Horeca coffee'),
  ('Independent Street Vendor Tea & Coffee','Porridge'),
  ('Independent Street Vendor Tea & Coffee','Table Top'),
  ('Institutes/Office/Factory/Industry','Vending machine'),
  ('Institutes/Office/Factory/Industry','Institutes/company sales')
) as v(cat,t)
join categorie_pdv cp on cp.nom=v.cat
on conflict (nom) do nothing;

-- PROPOSITION canal (à valider) : MT = hyper/supermarchés, GT = le reste
update categorie_pdv set canal='MT' where nom in ('Hypermarkets', 'Premium Supermarkets', 'Value Supermarkets');
update categorie_pdv set canal='GT' where canal is null;
commit;
-- ============================================================================
-- Migration 3/4 : DISTRIBUTEURS + MAPPING  (onglets DISTRIBUTEUR, Mapping)
-- Dépend de la migration 1 (territoire). 'national'=true -> couvre tous les territoires.
-- NB : 'ABDI MOHAMED' (Bouna) est probablement le même que 'ABDI'.
-- ============================================================================
begin;
create table if not exists distributeur (
  id       bigint generated always as identity primary key,
  nom      text not null unique,
  national boolean not null default false
);
create table if not exists territoire_distributeur (
  territoire_id   bigint not null references territoire(id)  on delete cascade,
  distributeur_id bigint not null references distributeur(id) on delete cascade,
  primary key (territoire_id, distributeur_id)
);

insert into distributeur(nom,national) values
  ('ABDI',false),
  ('ABDI MOHAMED',false),
  ('ADIALEA RCI',true),
  ('ALI BABA CI',false),
  ('BALDE IBRAHIMA',false),
  ('BON MARCHE',false),
  ('BOUSSOURA SARL',false),
  ('CIVADIS',true),
  ('COMPAGNIE DE DISTRIBUTION (C.D.C.I)',true),
  ('COTE D''IVOIRE SUPERMARCHES',true),
  ('DYNAMIS',false),
  ('ESF KORHOGO',false),
  ('ETABLISSEMENT EL VALAH SARL',false),
  ('ETABLISSEMENT LEMRABOTT & FRÈRES',false),
  ('ETABLISSEMENT NIARE & FRERES',false),
  ('IDMCI',false),
  ('IVOIRE DISTRIBUTION MARCHANDISES C.I',false),
  ('KADERIM SA',true),
  ('KAZA DISTRIBUTION',false),
  ('NICE SERVICE',false),
  ('NOUVEAUX DISTRIBUTEURS ASSOCIES',false),
  ('OMNI RETAIL',false),
  ('PLAISIR BACHUSS',false),
  ('PRODISMA',false),
  ('PROSUMA CASH PORT',true),
  ('PROSUMA DIVISION CENTRALE',true),
  ('RIDACOM',false),
  ('RIZKALLAH MICHEL',false),
  ('SDHPA',false),
  ('SDTP',false),
  ('SIDECOM',false),
  ('SOCOCE COTE D''IVOIRE SA',true),
  ('SOCOCE INTERIEUR',false),
  ('SOCOPRIX',true),
  ('SODIAMA',false),
  ('SODICOM-CI',false),
  ('SODISMAF',false),
  ('SOMALI-CI',false),
  ('Societe des 2 Plateaux - S.2.P',true),
  ('TAHIROU',false),
  ('UP GROUND SALES & MARKETING',false)
on conflict (nom) do nothing;

insert into territoire_distributeur(territoire_id,distributeur_id)
select t.id, d.id from (values
  ('Abengourou','RIZKALLAH MICHEL'),
  ('Abobo 1','ETABLISSEMENT NIARE & FRERES'),
  ('Aboisso','NICE SERVICE'),
  ('Adjame','BOUSSOURA SARL'),
  ('Bassam','OMNI RETAIL'),
  ('Bingerville','DYNAMIS'),
  ('Bondoukou','TAHIROU'),
  ('Bouake 1','SODIAMA'),
  ('Bouake 2','IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('Bouna','ABDI MOHAMED'),
  ('Cocody 1','PLAISIR BACHUSS'),
  ('Cocody 2','PRODISMA'),
  ('Daloa','BON MARCHE'),
  ('Divo','RIDACOM'),
  ('Divo','RIDACOM'),
  ('Ferke','ESF KORHOGO'),
  ('Gagnoa 1','SOMALI-CI'),
  ('Gagnoa 2','SOCOCE INTERIEUR'),
  ('Guiglo 1','ETABLISSEMENT EL VALAH SARL'),
  ('Guiglo 2','SODISMAF'),
  ('Katiola','IDMCI'),
  ('Korhogo','ESF KORHOGO'),
  ('Man','ALI BABA CI'),
  ('Mankono','KAZA DISTRIBUTION'),
  ('Marcory','SIDECOM'),
  ('Odienne','BALDE IBRAHIMA'),
  ('Plateau','BOUSSOURA SARL'),
  ('Port bouet','SDTP'),
  ('Port bouet','SDHPA'),
  ('San Pedro','ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('Soubre','SOCOCE INTERIEUR'),
  ('Treichville','SIDECOM'),
  ('Yamoussoukro','UP GROUND SALES & MARKETING'),
  ('Yopougon 1','SODICOM-CI'),
  ('Yopougon 2','SODICOM-CI'),
  ('Yopougon 3','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Yopougon 4','NOUVEAUX DISTRIBUTEURS ASSOCIES')
) as v(terr,distr)
join territoire t on t.nom=v.terr
join distributeur d on d.nom=v.distr
on conflict do nothing;

-- Règle appli : distributeurs d'un territoire = mapping spécifique UNION (national=true).
-- Territoires sans distributeur dans le fichier ('A POURVOIR'/'NOT AVAILABLE') :
--   Abobo 2, Adzope, Agboville, Anyama, Dabou, Dimbokro, koumassi.
commit;-- ============================================================================
-- Migration 4/4 : PRODUITS, POIDS & SEUILS DE DISPONIBILITÉ
-- Sources : onglet DISPONIBILITE GT (seuils) + onglets DISPONIBILITE *_GT/_MT (poids)
-- role : phare | soutien | croissance | nouveaute | a_retirer
-- canal : GT (commerce traditionnel) | MT (commerce moderne)
-- UHT volontairement exclu (référence à retirer).
-- ============================================================================
begin;
create table if not exists categorie_produit (
  id   bigint generated always as identity primary key,
  code text not null unique,           -- EVAP, IMP, SCM
  nom  text not null
);
create table if not exists reference_produit (
  id                   bigint generated always as identity primary key,
  nom                  text not null unique,
  categorie_produit_id bigint not null references categorie_produit(id),
  role                 text not null check (role in ('phare','soutien','croissance','nouveaute','a_retirer'))
);
-- Poids de chaque référence dans la disponibilité pondérée (somme = 1 par catégorie+canal)
create table if not exists poids_reference (
  reference_produit_id bigint not null references reference_produit(id) on delete cascade,
  canal                text not null check (canal in ('GT','MT')),
  base_calcul          text not null default 'taux_vente'
                       check (base_calcul in ('taux_vente','taux_revu')),
  poids                numeric not null,
  primary key (reference_produit_id, canal, base_calcul)
);
alter table poids_reference
  add column if not exists base_calcul text not null default 'taux_vente';
alter table poids_reference drop constraint if exists poids_reference_base_calcul_check;
alter table poids_reference add constraint poids_reference_base_calcul_check
  check (base_calcul in ('taux_vente','taux_revu'));
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid='poids_reference'::regclass
      and contype='p'
      and pg_get_constraintdef(oid) not ilike '%base_calcul%'
  ) then
    alter table poids_reference drop constraint poids_reference_pkey;
    alter table poids_reference
      add primary key(reference_produit_id,canal,base_calcul);
  end if;
end $$;
-- Quantité minimale pour être 'disponible', par segment de PDV et grade
create table if not exists seuil_disponibilite (
  reference_produit_id bigint not null references reference_produit(id) on delete cascade,
  segment              text not null check (segment in ('Boutique','Minimarket','Kiosque','Aboki','Pushcart','TableTop','Porridge')),
  grade                text not null check (grade in ('A','B','C')),
  quantite_min         integer not null,
  primary key (reference_produit_id, segment, grade)
);
-- Règle d'assortiment indiquée sous le tableau de disponibilité :
-- nombre de SKU cibles, minimum présents et présence obligatoire des Hero SKU.
create table if not exists standard_assortiment (
  segment              text not null check (segment in ('Boutique','Minimarket')),
  grade                text not null check (grade in ('A','B','C')),
  sku_cibles           integer not null check (sku_cibles > 0),
  min_sku_presents     integer not null check (min_sku_presents > 0),
  heros_obligatoires  boolean not null default true,
  primary key (segment, grade)
);

insert into categorie_produit(code,nom) values
  ('EVAP','Lait évaporé'),
  ('IMP','Lait en poudre'),
  ('SCM','Lait concentré sucré')
on conflict (code) do nothing;

insert into reference_produit(nom,categorie_produit_id,role)
select v.nom, cp.id, v.role from (values
  ('BR Gold 160g','EVAP','soutien'),
  ('BR 150g','EVAP','phare'),
  ('BRB 150g','EVAP','croissance'),
  ('BR 380g','EVAP','soutien'),
  ('BRB 380g','EVAP','a_retirer'),
  ('Pearl 380g','EVAP','soutien'),
  ('BR 15g','IMP','phare'),
  ('BR Délice 15g','IMP','nouveaute'),
  ('BR Pouch 360g','IMP','croissance'),
  ('BR Delice Pouch 350g','IMP','nouveaute'),
  ('BR tin 400g','IMP','croissance'),
  ('BR tin 900g','IMP','soutien'),
  ('BR tin 2500g','IMP','soutien'),
  ('BR 1kg','SCM','soutien'),
  ('Pearl 1kg','SCM','croissance')
) as v(nom,cat,role)
join categorie_produit cp on cp.code=v.cat
on conflict (nom) do nothing;

insert into poids_reference(reference_produit_id,canal,poids)
select rp.id, v.canal, v.poids from (values
  ('BR 150g','GT',0.749443117),
  ('BRB 150g','GT',0.08421527549),
  ('BR 380g','GT',0.04827634345),
  ('BRB 380g','GT',0.005407986339),
  ('BR Gold 160g','GT',0.009468528271),
  ('Pearl 380g','GT',0.1031887494),
  ('BR 15g','GT',0.8549315705),
  ('BR Pouch 360g','GT',0.05424448477),
  ('BR Délice 15g','GT',0.07805304413),
  ('BR Delice Pouch 350g','GT',0.008819685235),
  ('BR tin 400g','GT',0.002414206552),
  ('BR tin 900g','GT',0.0009114034803),
  ('BR tin 2500g','GT',0.0006256053519412669),
  ('Pearl 1kg','GT',0.9461997208476083),
  ('BR 1kg','GT',0.05380027915239183),
  ('BR 150g','MT',0.6883495803612449),
  ('BRB 150g','MT',0.09333611065985105),
  ('BR 380g','MT',0.08438338534176236),
  ('BRB 380g','MT',0.037705363529118255),
  ('BR Gold 160g','MT',0.042834613860254625),
  ('Pearl 380g','MT',0.05339094624776877),
  ('BR 15g','MT',0.5578973264423553),
  ('BR Pouch 360g','MT',0.17125631171890085),
  ('BR Délice 15g','MT',0.10108308433953332),
  ('BR Delice Pouch 350g','MT',0.04246753155101114),
  ('BR tin 400g','MT',0.06373779055450027),
  ('BR tin 900g','MT',0.03676065927260427),
  ('BR tin 2500g','MT',0.02679729612109489),
  ('Pearl 1kg','MT',0.4677043522764932),
  ('BR 1kg','MT',0.44385217874148497)
) as v(nom,canal,poids)
join reference_produit rp on rp.nom=v.nom
on conflict do nothing;

-- Pondérations revues/validées dans les feuilles DISPONIBILITE *_GT/_MT.
insert into poids_reference(reference_produit_id,canal,base_calcul,poids)
select rp.id, v.canal, 'taux_revu', v.poids from (values
  ('BR 150g','GT',0.65),('BRB 150g','GT',0.07),('BR 380g','GT',0.05),
  ('BRB 380g','GT',0.03),('BR Gold 160g','GT',0.10),('Pearl 380g','GT',0.10),
  ('BR 15g','GT',0.76),('BR Pouch 360g','GT',0.07),('BR Délice 15g','GT',0.05),
  ('BR Delice Pouch 350g','GT',0.03),('BR tin 400g','GT',0.05),
  ('BR tin 900g','GT',0.02),('BR tin 2500g','GT',0.02),
  ('Pearl 1kg','GT',0.9461997208476083),('BR 1kg','GT',0.05380027915239183),
  ('BR 150g','MT',0.55),('BRB 150g','MT',0.12),('BR 380g','MT',0.08),
  ('BRB 380g','MT',0.05),('BR Gold 160g','MT',0.15),('Pearl 380g','MT',0.05),
  ('BR 15g','MT',0.25),('BR Pouch 360g','MT',0.16),('BR Délice 15g','MT',0.15),
  ('BR Delice Pouch 350g','MT',0.10),('BR tin 400g','MT',0.15),
  ('BR tin 900g','MT',0.12),('BR tin 2500g','MT',0.07),
  ('Pearl 1kg','MT',0.30),('BR 1kg','MT',0.70)
) as v(nom,canal,poids)
join reference_produit rp on rp.nom=v.nom
on conflict (reference_produit_id,canal,base_calcul)
do update set poids=excluded.poids;

insert into seuil_disponibilite(reference_produit_id,segment,grade,quantite_min)
select rp.id, v.segment, v.grade, v.qte from (values
  ('BR Gold 160g','Boutique','A',24),
  ('BR Gold 160g','Boutique','B',24),
  ('BR Gold 160g','Boutique','C',12),
  ('BR Gold 160g','Minimarket','A',24),
  ('BR Gold 160g','Minimarket','B',12),
  ('BR 150g','Boutique','A',48),
  ('BR 150g','Boutique','B',36),
  ('BR 150g','Boutique','C',18),
  ('BR 150g','Minimarket','A',48),
  ('BR 150g','Minimarket','B',24),
  ('BRB 150g','Boutique','A',24),
  ('BRB 150g','Boutique','B',18),
  ('BRB 150g','Boutique','C',12),
  ('BRB 150g','Minimarket','A',24),
  ('BRB 150g','Minimarket','B',18),
  ('BR 380g','Boutique','A',24),
  ('BR 380g','Boutique','B',18),
  ('BR 380g','Boutique','C',10),
  ('BR 380g','Minimarket','A',24),
  ('BR 380g','Minimarket','B',18),
  ('BR 380g','Porridge','A',2),
  ('BRB 380g','Boutique','A',12),
  ('BRB 380g','Boutique','B',12),
  ('BRB 380g','Boutique','C',6),
  ('BRB 380g','Minimarket','A',12),
  ('BRB 380g','Minimarket','B',12),
  ('Pearl 380g','Boutique','A',24),
  ('Pearl 380g','Boutique','B',18),
  ('Pearl 380g','Boutique','C',10),
  ('Pearl 380g','Minimarket','A',24),
  ('Pearl 380g','Minimarket','B',18),
  ('Pearl 380g','Kiosque','A',3),
  ('Pearl 380g','Kiosque','B',3),
  ('Pearl 380g','Aboki','A',2),
  ('Pearl 380g','Aboki','B',1),
  ('BR 15g','Boutique','A',12),
  ('BR 15g','Boutique','B',12),
  ('BR 15g','Boutique','C',3),
  ('BR 15g','Minimarket','A',12),
  ('BR 15g','Minimarket','B',12),
  ('BR Délice 15g','Boutique','A',12),
  ('BR Délice 15g','Boutique','B',12),
  ('BR Délice 15g','Boutique','C',3),
  ('BR Délice 15g','Minimarket','A',12),
  ('BR Délice 15g','Minimarket','B',12),
  ('BR Délice 15g','Pushcart','A',2),
  ('BR Délice 15g','Pushcart','B',2),
  ('BR Délice 15g','TableTop','A',1),
  ('BR Délice 15g','Porridge','A',1),
  ('BR Pouch 360g','Boutique','A',6),
  ('BR Pouch 360g','Boutique','B',3),
  ('BR Pouch 360g','Boutique','C',3),
  ('BR Pouch 360g','Minimarket','A',6),
  ('BR Pouch 360g','Minimarket','B',3),
  ('BR Delice Pouch 350g','Boutique','A',6),
  ('BR Delice Pouch 350g','Boutique','B',3),
  ('BR Delice Pouch 350g','Boutique','C',3),
  ('BR Delice Pouch 350g','Minimarket','A',6),
  ('BR Delice Pouch 350g','Minimarket','B',3),
  ('BR tin 400g','Boutique','A',12),
  ('BR tin 400g','Boutique','B',6),
  ('BR tin 400g','Boutique','C',3),
  ('BR tin 400g','Minimarket','A',12),
  ('BR tin 400g','Minimarket','B',6),
  ('BR tin 900g','Boutique','A',6),
  ('BR tin 900g','Boutique','B',3),
  ('BR tin 900g','Minimarket','A',6),
  ('BR tin 900g','Minimarket','B',3),
  ('BR tin 2500g','Boutique','A',3),
  ('BR tin 2500g','Minimarket','A',3),
  ('BR tin 2500g','Minimarket','B',3),
  ('BR 1kg','Boutique','A',3),
  ('BR 1kg','Minimarket','A',6),
  ('BR 1kg','Minimarket','B',3),
  ('Pearl 1kg','Boutique','A',12),
  ('Pearl 1kg','Boutique','B',6),
  ('Pearl 1kg','Boutique','C',3),
  ('Pearl 1kg','Minimarket','A',12),
  ('Pearl 1kg','Minimarket','B',6),
  ('Pearl 1kg','Kiosque','A',3),
  ('Pearl 1kg','Kiosque','B',2),
  ('Pearl 1kg','Aboki','A',3),
  ('Pearl 1kg','Aboki','B',2)
) as v(nom,segment,grade,qte)
join reference_produit rp on rp.nom=v.nom
on conflict do nothing;

insert into standard_assortiment(
  segment,grade,sku_cibles,min_sku_presents,heros_obligatoires
) values
  ('Boutique','A',15,10,true),
  ('Boutique','B',12,8,true),
  ('Boutique','C',11,5,true),
  ('Minimarket','A',15,10,true),
  ('Minimarket','B',12,8,true),
  ('Minimarket','C',11,5,true)
on conflict (segment,grade) do update set
  sku_cibles = excluded.sku_cibles,
  min_sku_presents = excluded.min_sku_presents,
  heros_obligatoires = excluded.heros_obligatoires;

-- Les deux bases du fichier sont conservées : taux_vente et taux_revu.
-- Seuils de visibilité MT (hyper/supermarchés) : absents du fichier -> à fournir.
-- Test d'acceptation EVAP/GT : poids 150g rouge=0.7494 ... -> doit donner 92/14/91.
commit;
-- ============================================================================
-- Migration 5/N : NIVEAUX PERFECT STORE + STANDARDS DE VISIBILITÉ
-- Dépend de la migration 2 (categorie_pdv).
-- Les 4 niveaux vont du plus exigeant (FLAGSHIP STORE) au moins exigeant
-- (BASIC PERFECT STORE). Attribution = gating conjonctif (ET) : un niveau n'est
-- atteint que si TOUS ses seuils minimaux sont satisfaits en même temps.
-- ============================================================================
begin;

-- Seuils minimaux par niveau. Un seuil NULL = pilier non exigé à ce niveau.
create table if not exists niveau_perfect_store (
  code            text primary key,          -- 'FLAGSHIP STORE' | 'VIP PERFECT STORE' | 'CORE PERFECT STORE' | 'BASIC PERFECT STORE'
  rang            int  not null,             -- plus grand = plus exigeant
  dispo_rayon_min numeric,                   -- disponibilité en rayon minimale (%)
  visibilite_min  numeric,                   -- visibilité parfaite = 100 %
  promotion_min   numeric                    -- exécution promo = 100 % si applicable
);

-- Seuils de disponibilité en rayon par niveau (valeurs réunion).
insert into niveau_perfect_store(code, rang, dispo_rayon_min, visibilite_min, promotion_min) values
  ('FLAGSHIP STORE',       4, 95, 100, 100),
  ('VIP PERFECT STORE',    3, 85, 100, 100),
  ('CORE PERFECT STORE',   2, 75, 100, 100),
  ('BASIC PERFECT STORE',  1, 60, 100, 100)
on conflict (code) do update set
  rang = excluded.rang,
  dispo_rayon_min = excluded.dispo_rayon_min,
  visibilite_min = excluded.visibilite_min,
  promotion_min = excluded.promotion_min;

-- La promotion est optionnelle par visite : promotion_min ne s'applique que
-- lorsque visites.data.visibilite.promotion_applicable = true.

commit;
-- ============================================================================
-- Migration 6/N : PONT entre les relevés terrain et le référentiel
-- Les relevés sont dans visites.data (JSONB) avec des clés internes (ex. br_160g) ;
-- le référentiel utilise reference_produit.nom (ex. 'BR 150g'). Ces deux mondes ne
-- joignent pas directement : on crée ici les tables de correspondance.
-- Dépend des migrations 2 (type_pdv) et 4 (reference_produit).
-- ============================================================================
begin;

-- Clé JSONB (categorie + sku) -> référence du référentiel.
-- categorie_jsonb = clé sous visites.data.produits (evap|imp|scm) ; sku_key = clé sous .quantites.
create table if not exists correspondance_reference (
  reference_produit_id bigint not null references reference_produit(id) on delete cascade,
  categorie_jsonb      text   not null,        -- evap | imp | scm
  sku_key              text   not null,        -- ex. br_160g (cf. utils/products.ts)
  primary key (categorie_jsonb, sku_key)
);

-- Segment + grade d'un type de PDV (niveau 4), pour retrouver le seuil de disponibilité.
-- Le segment doit correspondre à seuil_disponibilite.segment ; le grade au suffixe A/B/C.
create table if not exists segment_grade_type_pdv (
  type_pdv_id bigint not null references type_pdv(id) on delete cascade,
  segment     text   not null,                 -- Boutique | Minimarket | Kiosque | Aboki | Pushcart | TableTop | Porridge
  grade       text   not null check (grade in ('A','B','C')),
  primary key (type_pdv_id)
);

-- --- Correspondance clé JSONB -> référence (join par nom du référentiel) ---
-- EVAP : mapping complet et sûr.
-- IMP/SCM : seules les correspondances non ambiguës sont posées. Les libellés IMP de
--           utils/products.ts sont incohérents (cf. -- TODO ci-dessous) -> à compléter.
insert into correspondance_reference(reference_produit_id, categorie_jsonb, sku_key)
select rp.id, v.cat, v.sku from (values
  -- EVAP (6/6)
  ('evap','br_gold',   'BR Gold 160g'),
  ('evap','br_160g',   'BR 150g'),
  ('evap','brb_160g',  'BRB 150g'),
  ('evap','br_400g',   'BR 380g'),
  ('evap','brb_400g',  'BRB 380g'),
  ('evap','pearl_400g','Pearl 380g'),
  -- IMP (correspondances sûres)
  ('imp','br_20g',  'BR 15g'),            -- label "BR 15g"
  ('imp','brd_15g', 'BR Délice 15g'),     -- label "BRD 15g"
  ('imp','br_375g', 'BR Pouch 360g'),     -- label "BR 360g"
  ('imp','br_900g', 'BR tin 400g'),       -- label "BR 400g Tin"
  ('imp','br_2_5kg','BR tin 900g'),       -- label "BR 900g Tin"
  ('imp','brd_350g','BR Delice Pouch 350g'), -- clé présente dans le JSONB historique, absente de utils/products.ts
  -- SCM (correspondances sûres)
  ('scm','br_1kg',   'BR 1kg'),
  ('scm','pearl_1kg','Pearl 1kg')
) as v(cat, sku, nom)
join reference_produit rp on rp.nom = v.nom
on conflict (categorie_jsonb, sku_key) do nothing;

-- TODO confirmer client (correspondances ambiguës, non posées) :
--   IMP : 'BR tin 2500g' (réf) vs clé br_400g (label "BR 2", ambigu) ; clés brb_25g/brb_400g (BRB) sans réf IMP.
--   SCM : clés brb_1kg / br_397g / brb_397g sans référence dans le référentiel.

-- --- Segment + grade par type de PDV (commerce traditionnel) ---
-- Noms canoniques (espaces normalisés).
insert into segment_grade_type_pdv(type_pdv_id, segment, grade)
select tp.id, v.segment, v.grade from (values
  ('Boutique A',  'Boutique',   'A'),
  ('Boutique B',  'Boutique',   'B'),
  ('Boutique C',  'Boutique',   'C'),
  ('Superettes A','Minimarket', 'A'),
  ('Superettes B','Minimarket', 'B'),
  ('Superettes C','Minimarket', 'C'),
  ('Kiosk A',     'Kiosque',    'A'),
  ('Kiosk B',     'Kiosque',    'B'),
  ('Aboki A',     'Aboki',      'A'),
  ('Aboki B',     'Aboki',      'B'),
  ('Pushcard A',  'Pushcart',   'A'),
  ('Pushcard B',  'Pushcart',   'B'),
  ('Table Top',   'TableTop',   'A'),
  ('Porridge',    'Porridge',   'A')
) as v(nom, segment, grade)
join type_pdv tp on tp.nom = v.nom
on conflict (type_pdv_id) do nothing;

-- TODO confirmer client : segment/grade des types MT (Hypermarket, Supermarket A/B/C, Pharmacy, Bakery…)
--   et lien entre pdv (pdv.categorie_pdv / pdv.sous_categorie_pdv, sans grade) et type_pdv.

commit;
-- ============================================================================
-- PATCH 6b/N : complète correspondance_reference (IMP)
-- Comble le TODO de 20260630120500_friesland_pont_releves.sql :
--   IMP : clé JSONB 'br_400g' (label "BR 2") -> référence 'BR tin 2500g'.
-- Dépend de 20260630120300 (reference_produit) et 20260630120500 (correspondance_reference).
-- Idempotent (on conflict do nothing). À exécuter dans le SQL Editor Supabase.
-- ============================================================================
begin;

insert into correspondance_reference(reference_produit_id, categorie_jsonb, sku_key)
select rp.id, v.cat, v.sku from (values
  ('imp', 'br_400g', 'BR tin 2500g')   -- "BR 2" : seule correspondance IMP encore manquante
) as v(cat, sku, nom)
join reference_produit rp on rp.nom = v.nom
on conflict (categorie_jsonb, sku_key) do nothing;

-- RESTE NON MAPPABLE (aucune référence dans le référentiel — ne PAS forcer) :
--   IMP : clés brb_25g / brb_400g (gamme BRB en IMP : pas de réf IMP correspondante).
--   SCM : clés brb_1kg / br_397g / brb_397g (pas de réf SCM correspondante).
-- => signalés par diagnostic_correspondance_references.sql, à arbitrer côté Friesland
--    (soit créer la référence produit, soit confirmer que la clé est hors-scope).

commit;
-- ============================================================================
-- PATCH 6c/N : segment + grade des types de PDV MODERNES (MT)
-- Comble le TODO de 20260630120500_friesland_pont_releves.sql : seul le GT était
-- couvert dans segment_grade_type_pdv -> tout PDV moderne tombait à un score 0
-- (segment NULL => aucun seuil_disponibilite joint).
--
-- ⚠️ HYPOTHÈSE À VALIDER (Friesland) :
--   seuil_disponibilite ne contient PAS de seuils MT (Hypermarket/Supermarket) :
--   ses segments autorisés sont GT (Boutique|Minimarket|Kiosque|Aboki|Pushcart|
--   TableTop|Porridge). On rattache donc provisoirement les formats MT au segment
--   GT le plus proche AYANT des seuils ('Minimarket', grades A/B uniquement) afin
--   d'obtenir un score MT NON nul. À remplacer par de vrais seuils MT dès fournis.
--
--   Hypermarket   -> Minimarket A     Supermarket A -> Minimarket A
--   Supermarket B -> Minimarket B     Supermarket C -> Minimarket B
--   (Minimarket n'a pas de grade C dans seuil_disponibilite -> C rabattu sur B.)
--
-- Canal : géré séparément via categorie_pdv.canal (='MT' pour ces types), qui
-- sélectionne poids_reference.canal='MT' dans calculer_perfect_store. Rien à faire ici.
-- Idempotent. Dépend de 20260630120100 (type_pdv) et 20260630120500 (table pont).
-- ============================================================================
begin;

insert into segment_grade_type_pdv(type_pdv_id, segment, grade)
select tp.id, v.segment, v.grade from (values
  ('Hypermarket',  'Minimarket', 'A'),
  ('Supermarket A','Minimarket', 'A'),
  ('Supermarket B','Minimarket', 'B'),
  ('Supermarket C','Minimarket', 'B')
) as v(nom, segment, grade)
join type_pdv tp on tp.nom = v.nom
on conflict (type_pdv_id) do nothing;

commit;
-- ============================================================================
-- Migration 5/6 : STANDARDS DE VISIBILITÉ  (onglets BOUTIQUE, SUPERETTE,
--                 TABLE TOP, PUSHCART, PORRIDGE, KIOSQUE ET ABOKI)
-- Brique manquante, nécessaire pour noter le pilier Visibilité du Perfect Store.
-- ATTENTION : la source mélange des cellules fusionnées et la distinction
-- optionnel/obligatoire n'est PAS encore tranchée par Friesland.
-- => Ce seed est PROVISOIRE, à valider. La structure, elle, est définitive.
-- ============================================================================
begin;

-- Catalogue des éléments de visibilité / promotion, par segment de PDV
create table if not exists element_visibilite (
  id        bigint generated always as identity primary key,
  segment   text not null check (segment in
              ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki')),
  code      text,
  nom       text not null,
  pilier    text not null check (pilier in ('visibilite','promotion')),
  emplacement text,
  optionnel boolean not null default false,   -- true = ne compte pas dans la note
  unique (segment, nom)
);
alter table element_visibilite add column if not exists code text;
alter table element_visibilite add column if not exists emplacement text;
-- Une exécution antérieure peut avoir déjà posé ces contraintes. Le seed
-- renseigne code/emplacement dans l'étape suivante : on les relâche donc
-- temporairement pour rendre la migration entièrement rejouable.
alter table element_visibilite alter column code drop not null;
alter table element_visibilite alter column emplacement drop not null;

-- Une première ébauche de standard_visibilite utilisait un schéma incompatible.
-- La présence de "segment" seule ne suffit pas : certaines versions intermédiaires
-- n'avaient pas encore niveau_perfect_store, element_visibilite_id ou requis.
-- On archive toute version incomplète sous un nom unique, sans perdre ses données,
-- puis on installe le modèle Big Five. Ce bloc reste sûr si la migration est rejouée.
do $$
declare
  v_colonnes_attendues integer;
  v_archive_name text;
begin
  if to_regclass('public.standard_visibilite') is not null then
    select count(*)
      into v_colonnes_attendues
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'standard_visibilite'
      and column_name in (
        'segment',
        'niveau_perfect_store',
        'element_visibilite_id',
        'requis'
      );

    if v_colonnes_attendues <> 4 then
      v_archive_name := 'standard_visibilite_legacy_'
        || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
        || '_'
        || pg_backend_pid();
      execute format(
        'alter table public.standard_visibilite rename to %I',
        v_archive_name
      );
    end if;
  end if;
end $$;

-- Standard : quel élément est requis à quel niveau de Perfect Store
create table if not exists standard_visibilite (
  segment              text not null,
  niveau_perfect_store text not null check (niveau_perfect_store in
                         ('flagship','vip','core','basic')),
  element_visibilite_id bigint not null references element_visibilite(id) on delete cascade,
  requis               boolean not null default false,
  primary key (niveau_perfect_store, element_visibilite_id)
);

insert into element_visibilite(segment,nom,pilier,optionnel) values
  ('boutique','Affiche','visibilite',false),
  ('boutique','Flèche','visibilite',false),
  ('boutique','Guirlande','visibilite',true),
  ('boutique','sign board','visibilite',false),
  ('boutique','Panneau privilège','visibilite',false),
  ('boutique','Full branding','visibilite',false),
  ('boutique','Reglette','visibilite',false),
  ('boutique','Maison BR','visibilite',false),
  ('boutique','Hanger','visibilite',false),
  ('boutique','Wobler','visibilite',false),
  ('boutique','Présentoire','visibilite',false),
  ('boutique','TG','visibilite',false),
  ('boutique','Plaque BR','visibilite',true),
  ('boutique','Merchandising','visibilite',false),
  ('boutique','Standard','promotion',false),
  ('boutique','Hotesses','promotion',false),
  ('boutique','Dégustation','promotion',false),
  ('superette','Affiche','visibilite',true),
  ('superette','Flèche (Entrée et sortie)','visibilite',false),
  ('superette','sign board lumineux','visibilite',true),
  ('superette','Panneau privilège lumineux','visibilite',true),
  ('superette','Reglette','visibilite',false),
  ('superette','Espace BR','visibilite',false),
  ('superette','Wobler rayon','visibilite',false),
  ('superette','Présentoire','visibilite',false),
  ('superette','TG','visibilite',false),
  ('superette','Plaque BR','visibilite',true),
  ('superette','Merchandising','visibilite',false),
  ('superette','Standard','promotion',false),
  ('superette','Hotesses','promotion',false),
  ('superette','Dégustation','promotion',false),
  ('table_top','PARASOLS','visibilite',false),
  ('table_top','NAPPE','visibilite',false),
  ('table_top','HANGER','visibilite',false),
  ('table_top','TABLIER','visibilite',true),
  ('table_top','Promotion','promotion',false),
  ('pushcart','AFFICHE','visibilite',false),
  ('pushcart','THERMOS','visibilite',false),
  ('pushcart','VERRE JETABLE','visibilite',false),
  ('pushcart','CHASUBLE','visibilite',false),
  ('pushcart','FULL BRANDING','visibilite',false),
  ('pushcart','Promotion','promotion',false),
  ('porridge','PARASOLS','visibilite',false),
  ('porridge','NAPPE','visibilite',false),
  ('porridge','HANGER','visibilite',false),
  ('porridge','VERRE JETABLE','visibilite',false),
  ('porridge','TABLIER','visibilite',false),
  ('porridge','STANDARD','promotion',false),
  ('porridge','DEGUSTATION','promotion',false),
  ('kiosque_aboki','AFFICHE','visibilite',false),
  ('kiosque_aboki','THERMOS','visibilite',false),
  ('kiosque_aboki','VERRE','visibilite',false),
  ('kiosque_aboki','CARAFE','visibilite',false),
  ('kiosque_aboki','MAISON BR','visibilite',false),
  ('kiosque_aboki','CHASUBLE','visibilite',false),
  ('kiosque_aboki','FULL BRANDING','visibilite',false),
  ('kiosque_aboki','Promotion','promotion',false)
on conflict (segment,nom) do update set
  pilier = excluded.pilier,
  optionnel = excluded.optionnel;

-- Identifiants stables écrits dans visites.data.visibilite.standards + emplacement.
update element_visibilite e
set code = v.code, emplacement = v.emplacement
from (values
  ('boutique','Affiche','affiche','exterieure'),
  ('boutique','Flèche','fleche','exterieure'),
  ('boutique','Guirlande','guirlande','exterieure'),
  ('boutique','sign board','sign_board','exterieure'),
  ('boutique','Panneau privilège','panneau_privilege','exterieure'),
  ('boutique','Full branding','full_branding','exterieure'),
  ('boutique','Reglette','reglette','interieure'),
  ('boutique','Maison BR','maison_br','interieure'),
  ('boutique','Hanger','hanger','interieure'),
  ('boutique','Wobler','wobler','interieure'),
  ('boutique','Présentoire','presentoir','interieure'),
  ('boutique','TG','tg','interieure'),
  ('boutique','Plaque BR','plaque_br','interieure'),
  ('boutique','Merchandising','merchandising','interieure'),
  ('boutique','Standard','standard','promotion'),
  ('boutique','Hotesses','hotesses','promotion'),
  ('boutique','Dégustation','degustation','promotion'),
  ('superette','Affiche','affiche','exterieure'),
  ('superette','Flèche (Entrée et sortie)','fleche','exterieure'),
  ('superette','sign board lumineux','sign_board','exterieure'),
  ('superette','Panneau privilège lumineux','panneau_privilege','exterieure'),
  ('superette','Reglette','reglette','interieure'),
  ('superette','Espace BR','espace_br','interieure'),
  ('superette','Wobler rayon','wobler','interieure'),
  ('superette','Présentoire','presentoir','interieure'),
  ('superette','TG','tg','interieure'),
  ('superette','Plaque BR','plaque_br','interieure'),
  ('superette','Merchandising','merchandising','interieure'),
  ('superette','Standard','standard','promotion'),
  ('superette','Hotesses','hotesses','promotion'),
  ('superette','Dégustation','degustation','promotion'),
  ('table_top','PARASOLS','parasol','exterieure'),
  ('table_top','NAPPE','nappe','interieure'),
  ('table_top','HANGER','hanger','interieure'),
  ('table_top','TABLIER','tablier','interieure'),
  ('table_top','Promotion','promotion','promotion'),
  ('pushcart','AFFICHE','affiche','exterieure'),
  ('pushcart','THERMOS','thermos','interieure'),
  ('pushcart','VERRE JETABLE','verre_jetable','interieure'),
  ('pushcart','CHASUBLE','chasuble','interieure'),
  ('pushcart','FULL BRANDING','full_branding','exterieure'),
  ('pushcart','Promotion','promotion','promotion'),
  ('porridge','PARASOLS','parasol','exterieure'),
  ('porridge','NAPPE','nappe','interieure'),
  ('porridge','HANGER','hanger','interieure'),
  ('porridge','VERRE JETABLE','verre_jetable','interieure'),
  ('porridge','TABLIER','tablier','interieure'),
  ('porridge','STANDARD','standard','promotion'),
  ('porridge','DEGUSTATION','degustation','promotion'),
  ('kiosque_aboki','AFFICHE','affiche','exterieure'),
  ('kiosque_aboki','THERMOS','thermos','interieure'),
  ('kiosque_aboki','VERRE','verre','interieure'),
  ('kiosque_aboki','CARAFE','carafe','interieure'),
  ('kiosque_aboki','MAISON BR','maison_br','interieure'),
  ('kiosque_aboki','CHASUBLE','chasuble','interieure'),
  ('kiosque_aboki','FULL BRANDING','full_branding','exterieure'),
  ('kiosque_aboki','Promotion','promotion','promotion')
) as v(segment,nom,code,emplacement)
where e.segment=v.segment and e.nom=v.nom;

alter table element_visibilite alter column code set not null;
alter table element_visibilite alter column emplacement set not null;
alter table element_visibilite drop constraint if exists element_visibilite_emplacement_check;
alter table element_visibilite
  add constraint element_visibilite_emplacement_check
  check (emplacement in ('exterieure','interieure','promotion'));
create unique index if not exists element_visibilite_segment_code_uq
  on element_visibilite(segment,code);

insert into standard_visibilite(segment,niveau_perfect_store,element_visibilite_id,requis)
select v.seg, v.niv, e.id, v.requis from (values
  ('boutique','flagship','Affiche',true),
  ('boutique','flagship','Flèche',true),
  ('boutique','flagship','Guirlande',true),
  ('boutique','flagship','sign board',true),
  ('boutique','flagship','Panneau privilège',true),
  ('boutique','flagship','Full branding',true),
  ('boutique','flagship','Reglette',true),
  ('boutique','flagship','Maison BR',true),
  ('boutique','flagship','Hanger',true),
  ('boutique','flagship','Wobler',true),
  ('boutique','flagship','Présentoire',true),
  ('boutique','flagship','TG',true),
  ('boutique','flagship','Plaque BR',true),
  ('boutique','flagship','Merchandising',true),
  ('boutique','flagship','Standard',true),
  ('boutique','flagship','Hotesses',true),
  ('boutique','flagship','Dégustation',true),
  ('boutique','vip','Affiche',true),
  ('boutique','vip','Flèche',true),
  ('boutique','vip','Guirlande',true),
  ('boutique','vip','sign board',true),
  ('boutique','vip','Panneau privilège',true),
  ('boutique','vip','Full branding',false),
  ('boutique','vip','Reglette',true),
  ('boutique','vip','Maison BR',true),
  ('boutique','vip','Hanger',true),
  ('boutique','vip','Wobler',true),
  ('boutique','vip','Présentoire',true),
  ('boutique','vip','TG',true),
  ('boutique','vip','Plaque BR',false),
  ('boutique','vip','Merchandising',true),
  ('boutique','vip','Standard',true),
  ('boutique','vip','Hotesses',true),
  ('boutique','vip','Dégustation',true),
  ('boutique','core','Affiche',true),
  ('boutique','core','Flèche',true),
  ('boutique','core','Guirlande',true),
  ('boutique','core','sign board',true),
  ('boutique','core','Panneau privilège',false),
  ('boutique','core','Full branding',false),
  ('boutique','core','Reglette',true),
  ('boutique','core','Maison BR',true),
  ('boutique','core','Hanger',true),
  ('boutique','core','Wobler',true),
  ('boutique','core','Présentoire',false),
  ('boutique','core','TG',false),
  ('boutique','core','Plaque BR',false),
  ('boutique','core','Merchandising',true),
  ('boutique','core','Standard',true),
  ('boutique','core','Hotesses',false),
  ('boutique','core','Dégustation',false),
  ('boutique','basic','Affiche',true),
  ('boutique','basic','Flèche',true),
  ('boutique','basic','Guirlande',true),
  ('boutique','basic','sign board',false),
  ('boutique','basic','Panneau privilège',false),
  ('boutique','basic','Full branding',false),
  ('boutique','basic','Reglette',true),
  ('boutique','basic','Maison BR',true),
  ('boutique','basic','Hanger',true),
  ('boutique','basic','Wobler',true),
  ('boutique','basic','Présentoire',false),
  ('boutique','basic','TG',false),
  ('boutique','basic','Plaque BR',false),
  ('boutique','basic','Merchandising',true),
  ('boutique','basic','Standard',true),
  ('boutique','basic','Hotesses',false),
  ('boutique','basic','Dégustation',false),
  ('superette','flagship','Affiche',true),
  ('superette','flagship','Flèche (Entrée et sortie)',true),
  ('superette','flagship','sign board lumineux',true),
  ('superette','flagship','Panneau privilège lumineux',true),
  ('superette','flagship','Reglette',true),
  ('superette','flagship','Espace BR',true),
  ('superette','flagship','Wobler rayon',true),
  ('superette','flagship','Présentoire',true),
  ('superette','flagship','TG',true),
  ('superette','flagship','Plaque BR',true),
  ('superette','flagship','Merchandising',true),
  ('superette','flagship','Standard',true),
  ('superette','flagship','Hotesses',true),
  ('superette','flagship','Dégustation',true),
  ('superette','vip','Affiche',true),
  ('superette','vip','Flèche (Entrée et sortie)',true),
  ('superette','vip','sign board lumineux',true),
  ('superette','vip','Panneau privilège lumineux',true),
  ('superette','vip','Reglette',true),
  ('superette','vip','Espace BR',true),
  ('superette','vip','Wobler rayon',true),
  ('superette','vip','Présentoire',true),
  ('superette','vip','TG',true),
  ('superette','vip','Plaque BR',true),
  ('superette','vip','Merchandising',true),
  ('superette','vip','Standard',true),
  ('superette','vip','Hotesses',true),
  ('superette','vip','Dégustation',true),
  ('superette','core','Affiche',true),
  ('superette','core','Flèche (Entrée et sortie)',true),
  ('superette','core','sign board lumineux',false),
  ('superette','core','Panneau privilège lumineux',false),
  ('superette','core','Reglette',true),
  ('superette','core','Espace BR',true),
  ('superette','core','Wobler rayon',true),
  ('superette','core','Présentoire',false),
  ('superette','core','TG',false),
  ('superette','core','Plaque BR',false),
  ('superette','core','Merchandising',true),
  ('superette','core','Standard',true),
  ('superette','core','Hotesses',true),
  ('superette','core','Dégustation',true),
  ('superette','basic','Affiche',true),
  ('superette','basic','Flèche (Entrée et sortie)',true),
  ('superette','basic','sign board lumineux',false),
  ('superette','basic','Panneau privilège lumineux',false),
  ('superette','basic','Reglette',true),
  ('superette','basic','Espace BR',true),
  ('superette','basic','Wobler rayon',true),
  ('superette','basic','Présentoire',false),
  ('superette','basic','TG',false),
  ('superette','basic','Plaque BR',false),
  ('superette','basic','Merchandising',true),
  ('superette','basic','Standard',true),
  ('superette','basic','Hotesses',false),
  ('superette','basic','Dégustation',false),
  ('table_top','flagship','PARASOLS',true),
  ('table_top','flagship','NAPPE',true),
  ('table_top','flagship','HANGER',true),
  ('table_top','flagship','TABLIER',true),
  ('table_top','flagship','Promotion',true),
  ('table_top','vip','PARASOLS',false),
  ('table_top','vip','NAPPE',true),
  ('table_top','vip','HANGER',true),
  ('table_top','vip','TABLIER',true),
  ('table_top','vip','Promotion',true),
  ('table_top','core','PARASOLS',false),
  ('table_top','core','NAPPE',true),
  ('table_top','core','HANGER',true),
  ('table_top','core','TABLIER',false),
  ('table_top','core','Promotion',true),
  ('table_top','basic','PARASOLS',false),
  ('table_top','basic','NAPPE',false),
  ('table_top','basic','HANGER',true),
  ('table_top','basic','TABLIER',false),
  ('table_top','basic','Promotion',false),
  ('pushcart','flagship','AFFICHE',false),
  ('pushcart','flagship','THERMOS',true),
  ('pushcart','flagship','VERRE JETABLE',true),
  ('pushcart','flagship','CHASUBLE',true),
  ('pushcart','flagship','FULL BRANDING',true),
  ('pushcart','flagship','Promotion',true),
  ('pushcart','vip','AFFICHE',false),
  ('pushcart','vip','THERMOS',true),
  ('pushcart','vip','VERRE JETABLE',true),
  ('pushcart','vip','CHASUBLE',true),
  ('pushcart','vip','FULL BRANDING',false),
  ('pushcart','vip','Promotion',true),
  ('pushcart','core','AFFICHE',false),
  ('pushcart','core','THERMOS',true),
  ('pushcart','core','VERRE JETABLE',true),
  ('pushcart','core','CHASUBLE',false),
  ('pushcart','core','FULL BRANDING',false),
  ('pushcart','core','Promotion',true),
  ('pushcart','basic','AFFICHE',false),
  ('pushcart','basic','THERMOS',false),
  ('pushcart','basic','VERRE JETABLE',false),
  ('pushcart','basic','CHASUBLE',false),
  ('pushcart','basic','FULL BRANDING',false),
  ('pushcart','basic','Promotion',true),
  ('porridge','flagship','PARASOLS',true),
  ('porridge','flagship','NAPPE',true),
  ('porridge','flagship','HANGER',true),
  ('porridge','flagship','VERRE JETABLE',true),
  ('porridge','flagship','TABLIER',true),
  ('porridge','flagship','STANDARD',true),
  ('porridge','flagship','DEGUSTATION',true),
  ('porridge','vip','PARASOLS',false),
  ('porridge','vip','NAPPE',true),
  ('porridge','vip','HANGER',true),
  ('porridge','vip','VERRE JETABLE',true),
  ('porridge','vip','TABLIER',false),
  ('porridge','vip','STANDARD',true),
  ('porridge','vip','DEGUSTATION',false),
  ('porridge','core','PARASOLS',false),
  ('porridge','core','NAPPE',false),
  ('porridge','core','HANGER',true),
  ('porridge','core','VERRE JETABLE',true),
  ('porridge','core','TABLIER',false),
  ('porridge','core','STANDARD',true),
  ('porridge','core','DEGUSTATION',false),
  ('porridge','basic','PARASOLS',false),
  ('porridge','basic','NAPPE',false),
  ('porridge','basic','HANGER',true),
  ('porridge','basic','VERRE JETABLE',false),
  ('porridge','basic','TABLIER',false),
  ('porridge','basic','STANDARD',true),
  ('porridge','basic','DEGUSTATION',false),
  ('kiosque_aboki','flagship','AFFICHE',true),
  ('kiosque_aboki','flagship','THERMOS',true),
  ('kiosque_aboki','flagship','VERRE',true),
  ('kiosque_aboki','flagship','CARAFE',true),
  ('kiosque_aboki','flagship','MAISON BR',true),
  ('kiosque_aboki','flagship','CHASUBLE',true),
  ('kiosque_aboki','flagship','FULL BRANDING',true),
  ('kiosque_aboki','flagship','Promotion',true),
  ('kiosque_aboki','vip','AFFICHE',false),
  ('kiosque_aboki','vip','THERMOS',true),
  ('kiosque_aboki','vip','VERRE',true),
  ('kiosque_aboki','vip','CARAFE',true),
  ('kiosque_aboki','vip','MAISON BR',true),
  ('kiosque_aboki','vip','CHASUBLE',true),
  ('kiosque_aboki','vip','FULL BRANDING',false),
  ('kiosque_aboki','vip','Promotion',true),
  ('kiosque_aboki','core','AFFICHE',false),
  ('kiosque_aboki','core','THERMOS',false),
  ('kiosque_aboki','core','VERRE',true),
  ('kiosque_aboki','core','CARAFE',true),
  ('kiosque_aboki','core','MAISON BR',true),
  ('kiosque_aboki','core','CHASUBLE',false),
  ('kiosque_aboki','core','FULL BRANDING',false),
  ('kiosque_aboki','core','Promotion',true),
  ('kiosque_aboki','basic','AFFICHE',false),
  ('kiosque_aboki','basic','THERMOS',false),
  ('kiosque_aboki','basic','VERRE',false),
  ('kiosque_aboki','basic','CARAFE',false),
  ('kiosque_aboki','basic','MAISON BR',false),
  ('kiosque_aboki','basic','CHASUBLE',false),
  ('kiosque_aboki','basic','FULL BRANDING',false),
  ('kiosque_aboki','basic','Promotion',false)
) as v(seg,niv,nom,requis)
join element_visibilite e on e.segment=v.seg and e.nom=v.nom
on conflict (niveau_perfect_store,element_visibilite_id) do update set
  segment = excluded.segment,
  requis = excluded.requis;

-- Résolution type de PDV -> matrice de visibilité.
create table if not exists segment_visibilite_type_pdv (
  type_pdv_id bigint primary key references type_pdv(id) on delete cascade,
  segment text not null check (segment in
    ('boutique','superette','table_top','pushcart','porridge','kiosque_aboki'))
);

insert into segment_visibilite_type_pdv(type_pdv_id,segment)
select tp.id, v.segment from (values
  ('Boutique A','boutique'),('Boutique B','boutique'),('Boutique C','boutique'),
  ('Superettes A','superette'),('Superettes B','superette'),('Superettes C','superette'),
  ('Hypermarket','superette'),('Supermarket A','superette'),('Supermarket B','superette'),('Supermarket C','superette'),
  ('Table Top','table_top'),('Open Market Table Top','table_top'),
  ('Pushcard A','pushcart'),('Pushcard B','pushcart'),
  ('Porridge','porridge'),
  ('Kiosk A','kiosque_aboki'),('Kiosk B','kiosque_aboki'),
  ('Aboki A','kiosque_aboki'),('Aboki B','kiosque_aboki'),
  ('Horeca coffee','kiosque_aboki')
) as v(nom,segment)
join type_pdv tp on tp.nom=v.nom
on conflict (type_pdv_id) do update set segment=excluded.segment;

alter table element_visibilite enable row level security;
alter table standard_visibilite enable row level security;
alter table segment_visibilite_type_pdv enable row level security;

drop policy if exists element_visibilite_read on element_visibilite;
create policy element_visibilite_read on element_visibilite
  for select to authenticated using (true);
drop policy if exists standard_visibilite_read on standard_visibilite;
create policy standard_visibilite_read on standard_visibilite
  for select to authenticated using (true);
drop policy if exists segment_visibilite_type_pdv_read on segment_visibilite_type_pdv;
create policy segment_visibilite_type_pdv_read on segment_visibilite_type_pdv
  for select to authenticated using (true);

commit;
-- ============================================================================
-- Migration 7/N : CALCUL BIG FIVE / PERFECT STORE
-- Perfect Store = disponibilité (OSA) + visibilité parfaite + promotion
-- effective lorsque la promotion est applicable.
-- Dépend de 120300, 120400, 120500 et 130000.
-- ============================================================================
begin;

create table if not exists resultat_perfect_store (
  visite_id        uuid primary key references visites(id) on delete cascade,
  base_calcul      text not null default 'taux_vente'
                   check (base_calcul in ('taux_vente','taux_revu')),
  dispo_rayon_evap numeric,
  dispo_rayon_imp  numeric,
  dispo_rayon_scm  numeric,
  dispo_rayon      numeric,
  assortiment      numeric,
  sku_presents     integer,
  heros_presents   boolean,
  visibilite       numeric,
  promotion        numeric,
  score_global     numeric,
  niveau           text references niveau_perfect_store(code),
  calcule_le       timestamptz not null default now()
);

alter table resultat_perfect_store add column if not exists base_calcul text not null default 'taux_vente';
alter table resultat_perfect_store add column if not exists score_global numeric;
alter table resultat_perfect_store add column if not exists assortiment numeric;
alter table resultat_perfect_store add column if not exists sku_presents integer;
alter table resultat_perfect_store add column if not exists heros_presents boolean;

-- Disponibilité pondérée d'une catégorie, en %.
create or replace function calculer_dispo_categorie(
  p_data jsonb,
  p_cat text,
  p_canal text,
  p_segment text,
  p_grade text,
  p_base_calcul text default 'taux_vente'
) returns numeric
language sql stable
set search_path = public
as $$
  select case
    when sum(pr.poids) > 0 then
      round(
        sum(pr.poids * (case
          when coalesce((p_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric, 0) >= sd.quantite_min
          then 1 else 0 end))
        / sum(pr.poids) * 100
      )
    else null
  end
  from correspondance_reference cr
  join reference_produit rp on rp.id = cr.reference_produit_id
  join poids_reference pr on pr.reference_produit_id = rp.id
    and pr.canal = p_canal
    and pr.base_calcul = p_base_calcul
  join seuil_disponibilite sd on sd.reference_produit_id = rp.id
    and sd.segment = p_segment
    and sd.grade = p_grade
  where cr.categorie_jsonb = p_cat;
$$;

-- Compatibilité avec les anciennes visites, puis priorité au relevé générique.
create or replace function element_visibilite_observe(p_data jsonb, p_code text)
returns boolean
language sql immutable
set search_path = public
as $$
  select coalesce(
    (p_data->'visibilite'->'standards'->>p_code)::boolean,
    case p_code
      when 'affiche' then (p_data->'visibilite'->'exterieure'->>'poster')::boolean
      when 'guirlande' then (p_data->'visibilite'->'exterieure'->>'guirlande')::boolean
      when 'sign_board' then (p_data->'visibilite'->'exterieure'->>'sign_board')::boolean
      when 'panneau_privilege' then (p_data->'visibilite'->'exterieure'->>'panneau_privilege')::boolean
      when 'full_branding' then (p_data->'visibilite'->'exterieure'->>'full_branding')::boolean
      when 'reglette' then (p_data->'visibilite'->'interieure'->>'reglettes')::boolean
      when 'maison_br' then (p_data->'visibilite'->'interieure'->>'maison_bonnet_rouge')::boolean
      when 'hanger' then (p_data->'visibilite'->'interieure'->>'hanger')::boolean
      when 'presentoir' then (p_data->'visibilite'->'interieure'->>'presentoirs')::boolean
      when 'tg' then (p_data->'visibilite'->'interieure'->>'tete_gondole')::boolean
      when 'merchandising' then (p_data->'visibilite'->'interieure'->>'merchandising')::boolean
      else false
    end,
    false
  );
$$;

-- Taux d'exécution d'un pilier pour un segment et un niveau.
-- Aucun élément requis dans une matrice existante = 100 % (condition vide).
create or replace function calculer_taux_standard(
  p_data jsonb,
  p_segment text,
  p_niveau text,
  p_pilier text
) returns numeric
language plpgsql stable
set search_path = public
as $$
declare
  v_total int;
  v_requis int;
  v_ok int;
begin
  if p_segment is null then return null; end if;

  select count(*),
         count(*) filter (where s.requis and not e.optionnel),
         count(*) filter (
           where s.requis and not e.optionnel
             and element_visibilite_observe(p_data,e.code)
         )
  into v_total, v_requis, v_ok
  from standard_visibilite s
  join element_visibilite e on e.id=s.element_visibilite_id
  where s.segment=p_segment
    and s.niveau_perfect_store=p_niveau
    and e.pilier=p_pilier;

  if v_total=0 then return null; end if;
  if v_requis=0 then return 100; end if;
  return round(v_ok::numeric/v_requis*100,2);
end;
$$;

create or replace function calculer_perfect_store(
  p_visite_id uuid,
  p_base_calcul text default 'taux_vente'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
  v_pdv text;
  v_canal text;
  v_segment text;
  v_grade text;
  v_vis_segment text;
  v_evap numeric;
  v_imp numeric;
  v_scm numeric;
  v_dispo numeric;
  v_sku_presents integer;
  v_min_sku_presents integer;
  v_heros_obligatoires boolean;
  v_heros_total integer;
  v_heros_presents_count integer;
  v_assortiment numeric;
  v_heros_ok boolean;
  v_visi numeric;
  v_promo numeric;
  v_score numeric;
  v_niveau text;
  v_promo_applicable boolean;
  v_niveau_key text;
  n niveau_perfect_store%rowtype;
begin
  select data,pdv_id into v_data,v_pdv from visites where id=p_visite_id;
  if v_data is null then return; end if;

  select coalesce(cp.canal,'GT'),sg.segment,sg.grade,sv.segment
  into v_canal,v_segment,v_grade,v_vis_segment
  from pdv p
  left join lateral (
    select candidate.*
    from type_pdv candidate
    where regexp_replace(trim(candidate.nom),'\s+',' ','g')
      = regexp_replace(trim(p.sous_categorie_pdv),'\s+',' ','g')
    order by (candidate.nom=p.sous_categorie_pdv) desc
    limit 1
  ) tp on true
  left join categorie_pdv cp on cp.id=tp.categorie_pdv_id
  left join segment_grade_type_pdv sg on sg.type_pdv_id=tp.id
  left join segment_visibilite_type_pdv sv on sv.type_pdv_id=tp.id
  where p.pdv_id=v_pdv;

  v_canal := coalesce(v_canal,'GT');
  v_evap := calculer_dispo_categorie(v_data,'evap',v_canal,v_segment,v_grade,p_base_calcul);
  v_imp  := calculer_dispo_categorie(v_data,'imp',v_canal,v_segment,v_grade,p_base_calcul);
  v_scm  := calculer_dispo_categorie(v_data,'scm',v_canal,v_segment,v_grade,p_base_calcul);

  select round(avg(x)) into v_dispo
  from (values(v_evap),(v_imp),(v_scm)) as t(x)
  where x is not null;

  -- Assortiment : nombre minimal de SKU présents + Hero SKU obligatoires.
  -- La présence (quantité > 0) reste distincte de la disponibilité
  -- (quantité >= seuil_disponibilite), conformément au fichier source.
  select sa.min_sku_presents, sa.heros_obligatoires
  into v_min_sku_presents, v_heros_obligatoires
  from standard_assortiment sa
  where sa.segment = v_segment
    and sa.grade = v_grade;

  if v_min_sku_presents is not null then
    select
      count(*) filter (
        where coalesce(
          (v_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric,
          0
        ) > 0
      ),
      count(*) filter (where rp.role = 'phare'),
      count(*) filter (
        where rp.role = 'phare'
          and coalesce(
            (v_data->'produits'->cr.categorie_jsonb->'quantites'->>cr.sku_key)::numeric,
            0
          ) > 0
      )
    into v_sku_presents, v_heros_total, v_heros_presents_count
    from correspondance_reference cr
    join reference_produit rp on rp.id = cr.reference_produit_id;

    v_assortiment := round(
      least(v_sku_presents::numeric / v_min_sku_presents, 1) * 100,
      2
    );
    v_heros_ok := not v_heros_obligatoires
      or v_heros_total = v_heros_presents_count;
  else
    v_sku_presents := null;
    v_assortiment := null;
    v_heros_ok := null;
  end if;

  v_promo_applicable := coalesce(
    (v_data->'visibilite'->>'promotion_applicable')::boolean,
    false
  );

  -- Cherche le niveau le plus élevé dont tous les piliers sont conformes.
  for n in select * from niveau_perfect_store order by rang desc
  loop
    v_niveau_key := case
      when n.code ilike 'FLAGSHIP%' then 'flagship'
      when n.code ilike 'VIP%' then 'vip'
      when n.code ilike 'CORE%' then 'core'
      else 'basic'
    end;
    v_visi := calculer_taux_standard(v_data,v_vis_segment,v_niveau_key,'visibilite');
    v_promo := case when v_promo_applicable
      then calculer_taux_standard(v_data,v_vis_segment,v_niveau_key,'promotion')
      else null
    end;

    if v_dispo is not null
       and v_dispo >= coalesce(n.dispo_rayon_min,0)
       and (
         v_assortiment is null
         or (v_assortiment >= 100 and coalesce(v_heros_ok,false))
       )
       and v_visi is not null
       and v_visi >= coalesce(n.visibilite_min,100)
       and (
         not v_promo_applicable
         or v_promo is null
         or v_promo >= coalesce(n.promotion_min,100)
       )
    then
      v_niveau := n.code;
      exit;
    end if;
  end loop;

  select round(avg(x),2) into v_score
  from (values
    (v_dispo),
    (v_visi),
    (case when v_promo_applicable then v_promo else null end)
  ) as t(x)
  where x is not null;

  insert into resultat_perfect_store(
    visite_id,base_calcul,dispo_rayon_evap,dispo_rayon_imp,dispo_rayon_scm,
    dispo_rayon,assortiment,sku_presents,heros_presents,
    visibilite,promotion,score_global,niveau,calcule_le
  ) values (
    p_visite_id,p_base_calcul,v_evap,v_imp,v_scm,
    v_dispo,v_assortiment,v_sku_presents,v_heros_ok,
    v_visi,v_promo,v_score,v_niveau,now()
  )
  on conflict (visite_id) do update set
    base_calcul=excluded.base_calcul,
    dispo_rayon_evap=excluded.dispo_rayon_evap,
    dispo_rayon_imp=excluded.dispo_rayon_imp,
    dispo_rayon_scm=excluded.dispo_rayon_scm,
    dispo_rayon=excluded.dispo_rayon,
    assortiment=excluded.assortiment,
    sku_presents=excluded.sku_presents,
    heros_presents=excluded.heros_presents,
    visibilite=excluded.visibilite,
    promotion=excluded.promotion,
    score_global=excluded.score_global,
    niveau=excluded.niveau,
    calcule_le=excluded.calcule_le;
end;
$$;

create or replace function trg_calculer_perfect_store()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform calculer_perfect_store(new.id,'taux_vente');
  return new;
end;
$$;

drop trigger if exists trg_perfect_store on visites;
create trigger trg_perfect_store
  after insert or update of data,pdv_id on visites
  for each row execute function trg_calculer_perfect_store();

alter table resultat_perfect_store enable row level security;
drop policy if exists resultat_perfect_store_read on resultat_perfect_store;
create policy resultat_perfect_store_read on resultat_perfect_store
  for select to authenticated using (true);

create or replace view v_perfect_store_global as
select
  count(*) as visites_scorees,
  count(*) filter (where niveau is not null) as perfect_stores,
  round(100.0*count(*) filter (where niveau is not null)/nullif(count(*),0),1) as perfect_store_pct,
  round(avg(score_global),1) as score_global_moyen_pct,
  round(avg(dispo_rayon),1) as osa_moyen_pct,
  round(avg(visibilite),1) as visibilite_moyenne_pct,
  round(avg(promotion),1) as promotion_moyenne_pct,
  round(avg(assortiment),1) as assortiment_moyen_pct
from resultat_perfect_store;

create or replace view v_perfect_store_par_categorie_pdv as
select
  coalesce(p.sous_categorie_pdv,'Non renseigné') as type_pdv,
  count(*) as visites_scorees,
  count(*) filter (where r.niveau is not null) as perfect_stores,
  round(100.0*count(*) filter (where r.niveau is not null)/nullif(count(*),0),1) as perfect_store_pct,
  round(avg(r.score_global),1) as score_global_moyen_pct
from resultat_perfect_store r
join visites v on v.id=r.visite_id
join pdv p on p.pdv_id=v.pdv_id
group by coalesce(p.sous_categorie_pdv,'Non renseigné');

create or replace view v_couverture as
select
  v.commercial as merchandiser,
  to_char(date_trunc('month',v.date_visite),'YYYY-MM') as periode,
  count(distinct v.pdv_id) as pdv_vus
from visites v
group by v.commercial,date_trunc('month',v.date_visite);

create or replace view v_couverture_globale as
select
  to_char(date_trunc('month',v.date_visite),'YYYY-MM') as periode,
  count(distinct v.pdv_id) as pdv_vus
from visites v
group by date_trunc('month',v.date_visite);

-- Recalcule l'historique afin que le dashboard ne soit pas limité aux nouvelles visites.
select calculer_perfect_store(id,'taux_vente') from visites;

commit;
-- ============================================================================
-- Migration 8/N : ADMINISTRATION PERFECT STORE + SÉCURITÉ PAR RÔLE
-- - lecture des référentiels : utilisateurs authentifiés ;
-- - modification des paramètres : admin et superviseur uniquement ;
-- - recalcul global : admin et superviseur uniquement ;
-- - section Perfect Store intégrée à la matrice RBAC du dashboard.
-- Dépend de 120300, 120500, 130000 et 130100.
-- ============================================================================
begin;

create or replace function public.est_gestionnaire_perfect_store()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin','superviseur')
      and is_active = true
  );
$$;

revoke all on function public.est_gestionnaire_perfect_store() from public;
grant execute on function public.est_gestionnaire_perfect_store() to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'categorie_produit',
    'reference_produit',
    'poids_reference',
    'seuil_disponibilite',
    'standard_assortiment',
    'correspondance_reference',
    'segment_grade_type_pdv',
    'niveau_perfect_store',
    'element_visibilite',
    'standard_visibilite',
    'segment_visibilite_type_pdv'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);

    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_authenticated_read',
      v_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      v_table || '_authenticated_read',
      v_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      v_table || '_manager_write',
      v_table
    );
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.est_gestionnaire_perfect_store()) '
      || 'with check (public.est_gestionnaire_perfect_store())',
      v_table || '_manager_write',
      v_table
    );
  end loop;
end $$;

create table if not exists public.role_section_access (
  role text not null,
  section text not null,
  can_access boolean not null default false,
  updated_at timestamptz default now(),
  primary key (role, section)
);

alter table public.role_section_access enable row level security;

drop policy if exists rsa_read on public.role_section_access;
create policy rsa_read on public.role_section_access
  for select to authenticated using (true);

drop policy if exists rsa_admin_write on public.role_section_access;
create policy rsa_admin_write on public.role_section_access
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin' and is_active = true
    )
  );

insert into public.role_section_access(role,section,can_access) values
  ('admin','principal',true),('admin','perfect-store',true),('admin','pdv',true),
  ('admin','visites',true),('admin','visibilite',true),('admin','concurrence',true),
  ('admin','produits',true),('admin','actions',true),('admin','administration',true),
  ('superviseur','principal',true),('superviseur','perfect-store',true),('superviseur','pdv',true),
  ('superviseur','visites',true),('superviseur','visibilite',true),('superviseur','concurrence',true),
  ('superviseur','produits',true),('superviseur','actions',true),('superviseur','administration',false),
  ('merchandiser','principal',false),('merchandiser','perfect-store',false),('merchandiser','pdv',false),
  ('merchandiser','visites',false),('merchandiser','visibilite',false),('merchandiser','concurrence',false),
  ('merchandiser','produits',false),('merchandiser','actions',false),('merchandiser','administration',false),
  ('commercial','principal',false),('commercial','perfect-store',false),('commercial','pdv',false),
  ('commercial','visites',false),('commercial','visibilite',false),('commercial','concurrence',false),
  ('commercial','produits',false),('commercial','actions',false),('commercial','administration',false)
on conflict (role,section) do nothing;

create or replace function public.recalculer_tous_perfect_store(
  p_base_calcul text default 'taux_vente'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if p_base_calcul not in ('taux_vente','taux_revu') then
    raise exception 'Base de calcul invalide : %', p_base_calcul;
  end if;

  if not public.est_gestionnaire_perfect_store() then
    raise exception 'Permission refusée : rôle admin ou superviseur requis'
      using errcode = '42501';
  end if;

  select count(*) into v_count from public.visites;
  perform public.calculer_perfect_store(id,p_base_calcul)
  from public.visites;

  return v_count;
end;
$$;

revoke all on function public.recalculer_tous_perfect_store(text) from public;
grant execute on function public.recalculer_tous_perfect_store(text) to authenticated;

commit;

-- ####### 20260709120000_friesland_maj_poids_mt_taux_vente.sql #######

-- ============================================================================
-- MAJ 2026-07-09 : poids MT taux_vente révisés (mise à jour du fichier BIG FIVE)
-- Source : onglets DISPONIBILITE EVAP/IMP MT (nouveau bloc "Contribution '25").
--
-- Seuls les poids MT base 'taux_vente' d'EVAP (6) et IMP (7) changent.
-- Inchangés : tous les poids GT, tous les 'taux_revu', et SCM (voir note).
-- Chaque catégorie somme à 1.0 après mise à jour.
--
-- ⚠️ SCM MT NON traité ici : le fichier passe SCM MT de 2 à 4 SKU (ajoute
--    '397 R' + 'BRB 1Kg', base DIVISION). Cela nécessite 2 nouvelles
--    reference_produit + correspondance + arbitrage rôles/seuils -> migration
--    séparée après validation Friesland (cf. correspondance_imp_scm_fix ligne 19).
--
-- Idempotent (UPDATE des mêmes valeurs). À exécuter après 20260630120300.
-- ============================================================================
begin;

update poids_reference p
set poids = d.poids
from (
  select rp.id as rid, v.poids
  from (values
    -- EVAP / MT / taux_vente
    ('BR 150g',              0.488953),
    ('BRB 150g',             0.135132),
    ('BR 380g',              0.138184),
    ('BRB 380g',             0.062622),
    ('BR Gold 160g',         0.138855),
    ('Pearl 380g',           0.036255),
    -- IMP / MT / taux_vente
    ('BR 15g',               0.575363),
    ('BR Pouch 360g',        0.240079),
    ('BR Délice 15g',        0.078602),
    ('BR Delice Pouch 350g', 0.063667),
    ('BR tin 400g',          0.023089),
    ('BR tin 900g',          0.013755),
    ('BR tin 2500g',         0.005445)
  ) as v(nom, poids)
  join reference_produit rp on rp.nom = v.nom
) d
where p.reference_produit_id = d.rid
  and p.canal = 'MT'
  and p.base_calcul = 'taux_vente';

-- Recalcul de l'historique pour refléter les nouveaux poids MT dans
-- resultat_perfect_store (sinon le dashboard garde les anciens scores).
-- Sur une base volumineuse : fenêtre de maintenance (peut se restreindre aux
-- PDV MT, seuls impactés, si besoin de performance).
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;

-- ####### 20260709130000_friesland_dist_canonique.sql #######

-- ============================================================================
-- MAJ 2026-07-09 : la colonne `dist` de l'onglet TERRITORY devient CANONIQUE
-- (décision Friesland). Elle était cassée (#REF!) et non reprise en migration 1 ;
-- elle est désormais renseignée et remplace l'onglet Mapping comme source du
-- rattachement territoire -> distributeur.
--
-- Changements vs mapping précédent :
--   + LKA SERVICES (nouveau distributeur) : Bassam, Aboisso, Abobo 2, Anyama
--   ~ DYNAMYS -> DYNAMIS (Bingerville) · Cocody 1 -> PRODISMA · koumassi -> SIDECOM
--     Port bouet -> SDHPA · Bouna -> ABDI · Dabou -> NOUVEAUX DISTRIBUTEURS ASSOCIES
--     Dimbokro -> UP GROUND SALES & MARKETING
--   = 5 des 7 territoires jadis non assignés sont désormais couverts.
--
-- ⚠️ Adzope et Agboville : la cellule `dist` répète le nom du territoire
--    (placeholder) -> restent NON assignés. À arbitrer Friesland.
--
-- Idempotent (DELETE + réinsertion déterministe). À exécuter après 20260630120200.
-- N'impacte pas le scoring (référentiel d'affectation, pas de recalcul requis).
-- ============================================================================
begin;

insert into distributeur(nom, national) values ('LKA SERVICES', false)
on conflict (nom) do nothing;

-- Remplacement complet du mapping par la colonne `dist` (valeur unique par territoire,
-- cohérente sur toutes les areas). Adzope/Agboville exclus (placeholder).
delete from territoire_distributeur;

insert into territoire_distributeur(territoire_id, distributeur_id)
select t.id, d.id from (values
  ('Bingerville','DYNAMIS'),
  ('Cocody 1','PRODISMA'),
  ('Cocody 2','PRODISMA'),
  ('Treichville','SIDECOM'),
  ('Marcory','SIDECOM'),
  ('koumassi','SIDECOM'),
  ('Port bouet','SDHPA'),
  ('Bassam','LKA SERVICES'),
  ('Aboisso','LKA SERVICES'),
  ('Plateau','BOUSSOURA SARL'),
  ('Yopougon 1','SODICOM-CI'),
  ('Yopougon 2','SODICOM-CI'),
  ('Yopougon 3','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Yopougon 4','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Dabou','NOUVEAUX DISTRIBUTEURS ASSOCIES'),
  ('Abobo 1','ETABLISSEMENT NIARE & FRERES'),
  ('Abobo 2','LKA SERVICES'),
  ('Anyama','LKA SERVICES'),
  ('Adjame','BOUSSOURA SARL'),
  ('Abengourou','RIZKALLAH MICHEL'),
  ('Yamoussoukro','UP GROUND SALES & MARKETING'),
  ('Dimbokro','UP GROUND SALES & MARKETING'),
  ('Bouake 1','SODIAMA'),
  ('Bouake 2','IVOIRE DISTRIBUTION MARCHANDISES C.I'),
  ('Katiola','IDMCI'),
  ('Korhogo','ESF KORHOGO'),
  ('Ferke','ESF KORHOGO'),
  ('Bondoukou','TAHIROU'),
  ('Bouna','ABDI'),
  ('Daloa','BON MARCHE'),
  ('Divo','RIDACOM'),
  ('Gagnoa 1','SOMALI-CI'),
  ('Gagnoa 2','SOCOCE INTERIEUR'),
  ('Guiglo 1','ETABLISSEMENT EL VALAH SARL'),
  ('Guiglo 2','SODISMAF'),
  ('Man','ALI BABA CI'),
  ('Mankono','KAZA DISTRIBUTION'),
  ('Odienne','BALDE IBRAHIMA'),
  ('San Pedro','ETABLISSEMENT LEMRABOTT & FRÈRES'),
  ('Soubre','SOCOCE INTERIEUR')
) as v(terr, distr)
join territoire t on t.nom = v.terr
join distributeur d on d.nom = v.distr
on conflict do nothing;

commit;

-- ####### 20260709140000_friesland_standard_mt_facings.sql #######

-- ============================================================================
-- MAJ 2026-07-09 : STANDARD DE DISPONIBILITÉ MODERN TRADE (+ facings)
-- Source : onglet STANDARD DISPO MT (nouveau contenu réel du fichier).
-- Quantité minimale + nombre de facings par SKU × format supermarché.
--
-- ⚠️ TABLE DE RÉFÉRENCE — PAS ENCORE BRANCHÉE AU CALCUL.
--    Le moteur (calculer_perfect_store) utilise aujourd'hui le repli Minimarket
--    pour le MT. Pour l'activer il faut d'abord une règle métier de classement
--    des PDV MT en Hyper / Moyen / Petit supermarché (colonne segment MT sur pdv)
--    -> à arbitrer Friesland (voir MAJ_2026-07-09_A_ARBITRER.md).
--    Cette migration CHARGE les données du fichier pour qu'elles soient prêtes.
--
-- Idempotent. À exécuter après 20260630120300 (reference_produit).
-- ============================================================================
begin;

create table if not exists seuil_disponibilite_mt (
  reference_produit_id bigint  not null references reference_produit(id) on delete cascade,
  segment_mt           text    not null check (segment_mt in ('Hypermarche','MoyenSuper','PetitSuper')),
  quantite_min         integer not null,
  facings              integer not null,
  primary key (reference_produit_id, segment_mt)
);
alter table seuil_disponibilite_mt enable row level security;
drop policy if exists seuil_mt_read on seuil_disponibilite_mt;
create policy seuil_mt_read on seuil_disponibilite_mt for select to authenticated using (true);
drop policy if exists seuil_mt_write on seuil_disponibilite_mt;
create policy seuil_mt_write on seuil_disponibilite_mt for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin','superviseur')))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role in ('admin','superviseur')));

-- (nom SKU fichier -> reference_produit.nom) ; qty/facing par segment
insert into seuil_disponibilite_mt(reference_produit_id, segment_mt, quantite_min, facings)
select rp.id, v.segment_mt, v.qte, v.fac from (values
  -- EVAP
  ('BR Gold 160g','Hypermarche',96,13),('BR Gold 160g','MoyenSuper',48,8),('BR Gold 160g','PetitSuper',24,6),
  ('BR 150g','Hypermarche',144,13),('BR 150g','MoyenSuper',96,8),('BR 150g','PetitSuper',48,6),
  ('BRB 150g','Hypermarche',96,13),('BRB 150g','MoyenSuper',48,8),('BRB 150g','PetitSuper',24,6),
  ('BR 380g','Hypermarche',48,11),('BR 380g','MoyenSuper',24,7),('BR 380g','PetitSuper',24,5),
  ('Pearl 380g','Hypermarche',48,11),('Pearl 380g','MoyenSuper',48,7),('Pearl 380g','PetitSuper',24,5),
  -- IMP
  ('BR tin 400g','Hypermarche',24,7),('BR tin 400g','MoyenSuper',12,4),('BR tin 400g','PetitSuper',12,5),
  ('BR tin 900g','Hypermarche',12,5),('BR tin 900g','MoyenSuper',6,3),('BR tin 900g','PetitSuper',6,3),
  ('BR tin 2500g','Hypermarche',6,3),('BR tin 2500g','MoyenSuper',4,2),('BR tin 2500g','PetitSuper',2,2),
  ('BR Pouch 360g','Hypermarche',30,5),('BR Pouch 360g','MoyenSuper',12,2),('BR Pouch 360g','PetitSuper',6,3),
  ('BR Delice Pouch 350g','Hypermarche',30,5),('BR Delice Pouch 350g','MoyenSuper',12,2),('BR Delice Pouch 350g','PetitSuper',6,3),
  ('BR Délice 15g','Hypermarche',24,2),('BR Délice 15g','MoyenSuper',12,2),('BR Délice 15g','PetitSuper',12,2),
  ('BR 15g','Hypermarche',24,2),('BR 15g','MoyenSuper',12,2),('BR 15g','PetitSuper',12,2),
  -- SCM
  ('BR 1kg','Hypermarche',24,6),('BR 1kg','MoyenSuper',24,4),('BR 1kg','PetitSuper',24,5),
  ('Pearl 1kg','Hypermarche',24,6),('Pearl 1kg','MoyenSuper',24,4),('Pearl 1kg','PetitSuper',24,5)
) as v(nom, segment_mt, qte, fac)
join reference_produit rp on rp.nom = v.nom
on conflict (reference_produit_id, segment_mt) do update
  set quantite_min = excluded.quantite_min, facings = excluded.facings;

commit;

-- ####### 20260709150000_friesland_cablage_mt_supermarches.sql #######

-- ============================================================================
-- MAJ 2026-07-09 : CÂBLAGE du standard Modern Trade sur le calcul Perfect Store
-- (point 2 de MAJ_2026-07-09_A_ARBITRER — en assumant A=Grand / B=Moyen / C=Petit).
--
-- Le classement des supermarchés vient de l'onglet TYPE DE POINT DE VENTE :
--   Hypermarket / Supermarket A -> Grands · Supermarket B -> Moyens · Supermarket C -> Petits
--
-- On modélise ça comme un segment 'SupermarcheMT' + grade A/B/C, réutilisé TEL QUEL par
-- calculer_perfect_store (AUCUNE modification de la fonction). Remplace le repli provisoire
-- Minimarket de 20260630120560.
--
-- Déjà en place (rien à faire) : les formulaires PDV proposent ces types (source =
-- référentiel type_pdv), la visibilité MT est mappée (segment 'superette'), et
-- categorie_pdv.canal='MT' pour Hypermarkets/Premium/Value Supermarkets.
--
-- ⚠️ Correspondance A/B/C -> Grand/Moyen/Petit À CONFIRMER par Friesland.
-- Idempotent. À exécuter après 20260709140000. Recalcule l'historique.
-- ============================================================================
begin;

-- 1. Autoriser le segment 'SupermarcheMT' dans seuil_disponibilite (CHECK étendu).
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'seuil_disponibilite'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%segment%';
  if c is not null then execute format('alter table seuil_disponibilite drop constraint %I', c); end if;
end $$;
alter table seuil_disponibilite add constraint seuil_disponibilite_segment_check
  check (segment in ('Boutique','Minimarket','Kiosque','Aboki','Pushcart','TableTop','Porridge','SupermarcheMT'));

-- 2. Quantités minimales MT -> seuil_disponibilite (grade A=Grand/Hyper, B=Moyen, C=Petit),
--    dérivées de seuil_disponibilite_mt (chargé en 20260709140000).
insert into seuil_disponibilite(reference_produit_id, segment, grade, quantite_min)
select reference_produit_id, 'SupermarcheMT',
  case segment_mt
    when 'Hypermarche' then 'A'
    when 'MoyenSuper'  then 'B'
    when 'PetitSuper'  then 'C'
  end,
  quantite_min
from seuil_disponibilite_mt
on conflict (reference_produit_id, segment, grade) do update
  set quantite_min = excluded.quantite_min;

-- 3. Rattacher les types supermarché à (SupermarcheMT, grade) — écrase le repli Minimarket (120560).
insert into segment_grade_type_pdv(type_pdv_id, segment, grade)
select tp.id, 'SupermarcheMT',
  case tp.nom
    when 'Hypermarket'   then 'A'
    when 'Supermarket A' then 'A'
    when 'Supermarket B' then 'B'
    when 'Supermarket C' then 'C'
  end
from type_pdv tp
where tp.nom in ('Hypermarket','Supermarket A','Supermarket B','Supermarket C')
on conflict (type_pdv_id) do update
  set segment = excluded.segment, grade = excluded.grade;

-- 4. Recalcul de l'historique : les PDV supermarchés sont désormais scorés
--    sur le vrai standard MT (au lieu du repli Minimarket).
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;

-- ####### 20260701170000_friesland_rbac_parametres.sql (complété — manquait à TOUT_COMBINE) #######

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

-- ####### 20260701180000_friesland_fix_canal_pdv.sql (complété — manquait à TOUT_COMBINE) #######

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

-- ####### 20260703120000_friesland_position_tournee.sql (complété — manquait à TOUT_COMBINE) #######

-- ============================================================================
-- Positions GPS des tournées terrain (application mobile native).
-- - un point ≈ toutes les 1 à 2 minutes pendant une tournée (début/fin
--   déclenchés par le commercial), envoyé par batch depuis l'app ;
-- - id généré côté client : le renvoi d'un batch après coupure réseau est
--   idempotent (upsert ignoreDuplicates → on conflict do nothing) ;
-- - insertion par le propriétaire uniquement, lecture par le propriétaire
--   et les gestionnaires (admin/superviseur), trace immuable (pas
--   d'update/delete pour les rôles terrain).
-- Dépend de 20260630120000 (profiles) et réutilise
-- public.est_gestionnaire_perfect_store() (20260630130200).
-- ============================================================================
begin;

create table if not exists public.position_tournee (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tournee_id  uuid not null,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  speed       double precision,
  captured_at timestamptz not null,
  -- horodatage serveur : référence fiable si l'horloge du téléphone dérive
  created_at  timestamptz not null default now()
);

comment on table public.position_tournee is
  'Points GPS captés par l''app mobile native pendant les tournées terrain.';

create index if not exists idx_position_tournee_user_date
  on public.position_tournee (user_id, captured_at desc);

create index if not exists idx_position_tournee_tournee
  on public.position_tournee (tournee_id, captured_at);

alter table public.position_tournee enable row level security;

drop policy if exists "position_tournee_insert_own" on public.position_tournee;
create policy "position_tournee_insert_own" on public.position_tournee
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "position_tournee_select" on public.position_tournee;
create policy "position_tournee_select" on public.position_tournee
  for select to authenticated
  using (auth.uid() = user_id or public.est_gestionnaire_perfect_store());

commit;

-- ####### 20260709160000_friesland_dedupe_referentiels.sql #######

-- ============================================================================
-- MAJ 2026-07-09 : DÉDUPLICATION des référentiels + contraintes uniques
--
-- Problème : `categorie_pdv`, `type_pdv` et `zone` ont accumulé des doublons
-- lorsqu'un import (TOUT_COMBINE) a été rejoué : leur `on conflict do nothing`
-- n'avait pas de contrainte unique effective sur la clé naturelle, donc chaque
-- réexécution ré-insérait toutes les lignes.
--
-- Cette migration : (1) supprime les doublons en gardant la plus ancienne ligne,
-- (2) ajoute les contraintes uniques manquantes -> les futures réexécutions
-- deviennent idempotentes (le `on conflict do nothing` fonctionne enfin),
-- (3) recalcule les scores (la résolution type_pdv redevient univoque).
--
-- Idempotent. À exécuter en DERNIER (après toutes les autres migrations).
-- ============================================================================
begin;

-- 1) categorie_pdv : repointer les enfants vers le keeper, puis supprimer les doublons
update type_pdv tp
set categorie_pdv_id = k.kid
from categorie_pdv c
join (select nom, min(id) kid from categorie_pdv group by nom) k on k.nom = c.nom
where tp.categorie_pdv_id = c.id and c.id <> k.kid;

delete from categorie_pdv c
using (select nom, min(id) kid from categorie_pdv group by nom) k
where c.nom = k.nom and c.id <> k.kid;

-- 2) type_pdv : supprimer les enfants rattachés aux doublons (le keeper garde les siens),
--    puis supprimer les doublons de type_pdv
delete from segment_grade_type_pdv sg
using type_pdv t
join (select nom, min(id) kid from type_pdv group by nom) k on k.nom = t.nom
where sg.type_pdv_id = t.id and t.id <> k.kid;

delete from segment_visibilite_type_pdv sv
using type_pdv t
join (select nom, min(id) kid from type_pdv group by nom) k on k.nom = t.nom
where sv.type_pdv_id = t.id and t.id <> k.kid;

delete from type_pdv t
using (select nom, min(id) kid from type_pdv group by nom) k
where t.nom = k.nom and t.id <> k.kid;

-- 3) zone : supprimer les doublons exacts (territoire_code, code, nom)
delete from zone z
using zone z2
where z.id > z2.id
  and z.territoire_code = z2.territoire_code
  and coalesce(z.code,'') = coalesce(z2.code,'')
  and z.nom = z2.nom;

-- 4) Contraintes uniques (rendent les futures réexécutions idempotentes)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categorie_pdv_nom_uk') then
    alter table categorie_pdv add constraint categorie_pdv_nom_uk unique (nom);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'type_pdv_nom_uk') then
    alter table type_pdv add constraint type_pdv_nom_uk unique (nom);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'zone_nat_uk') then
    alter table zone add constraint zone_nat_uk unique (territoire_code, code, nom);
  end if;
end $$;

-- 5) Recalcul (type_pdv redevient univoque -> segment/grade correctement résolus)
select calculer_perfect_store(id, 'taux_vente') from visites;

commit;

-- ####### 20260709170000_friesland_perfect_store_liste_full.sql #######

-- ============================================================================
-- LISTE COMPLÈTE des Perfect Stores par niveau (non conformes INCLUS)
-- Comme v_perfect_store_liste, mais garde aussi les PDV sans niveau
-- (niveau = 'NON CONFORME'), pour une liste filtrable exhaustive.
-- ============================================================================
begin;

create or replace view public.v_perfect_store_liste_full
with (security_invoker = true)
as
select
  latest.visite_id,
  latest.pdv_id,
  latest.nom_pdv,
  latest.type_pdv,
  latest.zone,
  latest.date_visite,
  latest.commercial,
  coalesce(latest.niveau, 'NON CONFORME') as niveau,
  latest.score_global,
  latest.dispo_rayon,
  latest.assortiment,
  latest.visibilite,
  latest.promotion
from (
  select distinct on (v.pdv_id)
    r.visite_id,
    v.pdv_id,
    p.nom_pdv,
    coalesce(p.sous_categorie_pdv, 'Non renseigné') as type_pdv,
    p.zone,
    v.date_visite,
    v.commercial,
    r.niveau,
    r.score_global,
    r.dispo_rayon,
    r.assortiment,
    r.visibilite,
    r.promotion
  from public.resultat_perfect_store r
  join public.visites v on v.id = r.visite_id
  join public.pdv p on p.pdv_id = v.pdv_id
  order by v.pdv_id, v.date_visite desc, r.calcule_le desc
) latest;

revoke all on public.v_perfect_store_liste_full from public, anon;
grant select on public.v_perfect_store_liste_full to authenticated;

commit;
