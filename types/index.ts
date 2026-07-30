// ============================================================
// Types TypeScript - Friesland Bonnet Rouge
// ============================================================

// ---- Enums & Constantes ----
export type UserRole = 'admin' | 'superviseur' | 'merchandiser' | 'commercial'
// Deux axes distincts : SyncStatus = transport device -> serveur ;
// VisitStatus = cycle de vie métier (validation). Une visite peut être
// status='soumis' et sync_status='pending'. Le brouillon reste local.
export type SyncStatus = 'synced' | 'pending' | 'error'
export type VisitStatus = 'soumis' | 'validé' | 'rejeté'
export type ProductStatus = 'En rupture' | 'Disponible , Prix respecté' | 'Présent , Prix respecté' | 'Présent'
export type BrandingState = 'Bon' | 'Moyen' | 'Mauvais' | ''
export type CanalType = 'General trade' | 'Modern trade' | 'GT' | 'MT' | 'GT et MT'
export type PDVCategorie = 'Point de vente détail' | 'Point de consommation' | 'Supermarché' | 'Grossiste'
export type PDVSousCategorie = 'Boutique A' | 'Boutique B' | 'Boutique C' | 'Superette GT' | 'Kiosque' | string

// ---- Database Models ----
export interface Profile {
  id: string
  email: string
  nom: string
  telephone?: string
  role: UserRole
  zone_assignee?: string
  territoires_assignes?: string[]
  quartiers_assignes?: string[]
  region?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PDV {
  id: string
  pdv_id: string
  nom_pdv: string
  canal: CanalType
  categorie_pdv: PDVCategorie
  sous_categorie_pdv: PDVSousCategorie
  autre_sous_categorie?: string
  region: string
  zone: string
  quartier: string
  geolocation_lat: number
  geolocation_lng: number
  rayon_geofence: number
  adressage?: string
  image_url?: string
  date_creation: string
  ajoute_par: string
  jour_routing?: string
  position_routing?: number
  canal_routing?: string
  sales_rep_routing?: string
  mdm?: string
  // Référentiels (migration 020) + Perfect Store (013_016)
  territory_code?: string
  area_code?: string
  distributor_name?: string
  objectif_perfect_store?: 'FLAGSHIP' | 'VIP' | 'CORE' | 'BASIC'
  is_active: boolean
  created_at: string
}

export interface ZoneSecteur {
  id: number
  zone: string
  secteur: string
  merchandiser: string
  email_merchandiser: string
  sales_rep: string
  email_sales_rep: string
  region: string
}

export interface RoutingData {
  id: number
  jour_routing: string
  canal: string
  position: number
  sales_rep: string
  mdm: string
}

// ---- Routing / Planning ----
export type RoutingStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type RoutingPDVStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export interface RoutingObjectives {
  releve_stock?: boolean
  encaissement?: boolean
  photos?: boolean
  merchandising?: boolean
  prospection?: boolean
  custom?: string
}

export interface RoutingPDV {
  id: string
  routing_id: string
  pdv_id: string
  position_order: number
  objectifs: RoutingObjectives
  status: RoutingPDVStatus
  arrived_at?: string
  completed_at?: string
  geofence_validated: boolean
  geolocation_lat?: number
  geolocation_lng?: number
  precision_gps?: number
  result_notes?: string
  visite_id?: string
  created_at: string
  updated_at: string
  // Joined
  pdv?: PDV
}

export interface Routing {
  id: string
  user_id: string
  date_routing: string
  created_by?: string
  notes?: string
  status: RoutingStatus
  created_at: string
  updated_at: string
  // Joined
  user?: Profile
  creator?: Profile
  routing_pdv?: RoutingPDV[]
}

// ---- Routing Templates (Permanent) ----
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface RoutingTemplatePDV {
  id: string
  template_id: string
  pdv_id: string
  position_order: number
  objectifs: RoutingObjectives
  created_at: string
  updated_at: string
  // Joined
  pdv?: PDV
}

/**
 * Règle de routing récurrente (réunion du 23 juillet).
 * « Ce PDV, ce merchandiser le visite chaque lundi et chaque jeudi » — la règle
 * se répète indéfiniment, mois suivant compris, sans re-paramétrage.
 */
export interface RoutingTemplate {
  id: string
  user_id: string
  /** Jours d'application, 0 = dimanche … 6 = samedi. */
  days_of_week?: DayOfWeek[] | null
  /** Champ historique : une règle ne portait qu'un jour. Conservé pour compat. */
  day_of_week?: DayOfWeek | null
  /** Territoire de CETTE règle : un merchandiser peut en changer en cours de mois. */
  territoire?: string | null
  /** Distributeur de CETTE règle, même raison. */
  distributeur?: string | null
  date_debut?: string | null
  /** NULL = la règle court indéfiniment (cas nominal). */
  date_fin?: string | null
  label?: string
  notes?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
  // Joined
  user?: Profile
  creator?: Profile
  routing_template_pdv?: RoutingTemplatePDV[]
  routing_template_exception?: RoutingTemplateException[]
}

/**
 * Désactivation ponctuelle : « cette semaine, il ne visite pas ce PDV ».
 * `pdv_id` nul = toute la tournée est suspendue sur la période.
 */
export interface RoutingTemplateException {
  id: string
  template_id: string
  pdv_id?: string | null
  date_debut: string
  date_fin: string
  motif?: string | null
  created_by?: string
  created_at: string
}

// ---- Visite Data (JSONB) ----
// Quantité saisie par SKU (nouveau format). Clé = clé SKU du catalogue.
export type SkuQuantites = Record<string, number>

export interface VisiteProduits {
  evap: {
    present: boolean
    br_gold: ProductStatus
    br_160g: ProductStatus
    brb_160g: ProductStatus
    br_400g: ProductStatus
    brb_400g: ProductStatus
    pearl_400g: ProductStatus
    prix_respectes: boolean
    quantites?: SkuQuantites
    facings?: SkuQuantites
  }
  imp: {
    present: boolean
    br_400g: ProductStatus
    br_900g: ProductStatus
    br_2_5kg: ProductStatus
    br_375g: ProductStatus
    brb_400g: ProductStatus
    br_20g: ProductStatus
    brb_25g: ProductStatus
    brd_15g: ProductStatus
    brd_350g: ProductStatus
    prix_respectes: boolean
    quantites?: SkuQuantites
    facings?: SkuQuantites
  }
  scm: {
    present: boolean
    br_1kg: ProductStatus
    pearl_1kg: ProductStatus
    prix_respectes: boolean
    quantites?: SkuQuantites
    facings?: SkuQuantites
  }
  uht: {
    present: boolean
    demi_ecreme: ProductStatus
    elopack_500ml: ProductStatus
    brique_1l: ProductStatus
    prix_respectes: boolean
    quantites?: SkuQuantites
  }
  cereales: {
    present: boolean
    brcv: ProductStatus
    brcc: ProductStatus
    prix_respectes: boolean
    quantites?: SkuQuantites
  }
  yaourt: {
    present: boolean
    br_yogoo_fraise_mini_90ml: ProductStatus
    br_yogoo_fraise_maxi_318ml: ProductStatus
    br_yogoo_nature_mini_90ml: ProductStatus
    br_yogoo_nature_maxi_318ml: ProductStatus
    prix_respectes: boolean
    quantites?: SkuQuantites
  }
}

/**
 * Champs communs à chaque famille de concurrents (réunion du 23 juillet).
 * `present` ne suffisait pas : un concurrent en rayon mais inactif n'appelle
 * pas la même réaction commerciale qu'un concurrent qui pousse une promo.
 */
export interface ConcurrenceCategorieBase {
  present: boolean
  /** Le concurrent mène-t-il une action sur le PDV ? */
  en_activite?: boolean
  /** Nature de l'action : promotion, programme de fidélité, référencement… */
  action_concurrence?: string
  /** Champ historique : nom saisi quand « autre » était Présent. */
  nom_concurrent?: string
}

/**
 * Concurrent signalé en texte libre par le merchandiser.
 * Le nom est obligatoire : sans lui, l'agrégation du dashboard n'a rien à
 * regrouper. Le regroupement se fait sur une clé normalisée (voir
 * `normaliserNomConcurrent`), pas sur la graphie saisie.
 */
export interface ConcurrentSignale {
  nom: string
  categorie?: string
  en_activite?: boolean
  action_concurrence?: string
  photo_url?: string
}

/**
 * Une famille de concurrents : les champs communs, la clé fixe `autre`, et un
 * statut par marque dont la clé vient du référentiel `marque_concurrente`
 * (colonne `code`). Les marques ne sont plus figées dans le type : l'admin
 * peut en ajouter depuis les Référentiels sans redéploiement.
 */
export type ConcurrenceCategorie = ConcurrenceCategorieBase & {
  autre: ProductStatus
} & Record<string, ProductStatus | boolean | string | undefined>

export interface VisiteConcurrence {
  presence_concurrents: boolean
  evap: ConcurrenceCategorie
  imp: ConcurrenceCategorie
  scm: ConcurrenceCategorie
  uht: ConcurrenceCategorie
  /** Concurrents hors liste, saisis librement. Absent sur les visites d'avant juillet 2026. */
  autres?: ConcurrentSignale[]
}

export interface VisiteVisibilite {
  /** Relevé générique piloté par element_visibilite.code (source BIG FIVE KPI). */
  standards: Record<string, boolean>
  /** La promotion ne compte dans le Perfect Store que lorsqu'elle est active au PDV. */
  promotion_applicable: boolean
  exterieure: {
    presence_visibilite: boolean
    photo_branding?: string
    full_branding: boolean
    etat_branding?: BrandingState
    poster: boolean
    etat_poster?: BrandingState
    panneau_privilege: boolean
    etat_panneau?: BrandingState
    sign_board: boolean
    etat_sign_board?: BrandingState
    guirlande: boolean
    etat_guirlande?: BrandingState
    autre_branding: boolean
    etat_autre?: BrandingState
  }
  interieure: {
    presence_visibilite: boolean
    photo_visibilite?: string
    hanger: boolean
    etat_hanger?: BrandingState
    tete_gondole: boolean
    etat_tete_gondole?: BrandingState
    maison_bonnet_rouge: boolean
    etat_maison_br?: BrandingState
    reglettes: boolean
    etat_reglettes?: BrandingState
    zone_chaude: boolean
    etat_zone_chaude?: BrandingState
    produits_frigo: boolean
    etat_frigo?: BrandingState
    presentoirs: boolean
    etat_presentoirs?: BrandingState
    bacs_pouch: boolean
    etat_bacs?: BrandingState
    autre_gt: boolean
    etat_autre_gt?: BrandingState
    habillage_rayon: boolean
    etat_habillage?: BrandingState
    merchandising: boolean
    etat_merchandising?: BrandingState
    autre_interieure: boolean
    etat_autre_int?: BrandingState
  }
  concurrence: {
    presence_visibilite: boolean
    nido_exterieur: boolean
    nido_interieur: boolean
    laity_exterieur: boolean
    laity_interieur: boolean
    candia_exterieur: boolean
    candia_interieur: boolean
    autre_exterieur: boolean
    nom_concurrent_ext?: string
    autre_interieur: boolean
    nom_concurrent_int?: string
  }
}

export interface VisiteActions {
  referencement_produits: boolean
  execution_activites_promotionnelles: boolean
  prospection_pdv: boolean
  verification_fifo: boolean
  rangement_produits: boolean
  pose_affiches: boolean
  pose_materiel_visibilite: boolean
}

export interface VisiteData {
  produits: VisiteProduits
  concurrence: VisiteConcurrence
  visibilite: VisiteVisibilite
  actions: VisiteActions
}

export interface Visite {
  id: string
  visite_id: string
  pdv_id: string
  user_id: string
  date_visite: string
  commercial: string
  email: string
  geolocation_lat?: number
  geolocation_lng?: number
  geofence_validated: boolean
  precision_gps?: number
  data: VisiteData
  image_urls: string[]
  sync_status: SyncStatus
  status: VisitStatus
  synced_at?: string
  created_at: string
  updated_at: string
  // Joined
  pdv?: PDV
  profile?: Profile
}

// ---- Form State ----
export interface VisiteFormState {
  currentTab: number
  pdv_id: string
  date_visite: string
  produits: VisiteProduits
  concurrence: VisiteConcurrence
  visibilite: VisiteVisibilite
  actions: VisiteActions
  images: File[]
  geolocation: { lat: number; lng: number; accuracy: number } | null
}

// ---- Dashboard Stats ----
export interface DashboardStats {
  total_visites: number
  total_pdv: number
  total_commerciaux: number
  visites_today: number
  visites_week: number
  visites_month: number
  taux_evap: number
  taux_imp: number
  taux_scm: number
  taux_uht: number
  taux_yaourt: number
  taux_prix_evap: number
  taux_prix_imp: number
  taux_prix_scm: number
  performance_commerciaux: CommercialPerformance[]
  visites_par_jour: { date: string; count: number }[]
  distribution_pdv: { type: string; count: number }[]
  // Perfect Store
  perfect_store_pct?: number | null
  perfect_store_par_type?: { type_pdv: string; perfect_store_pct: number | null }[]
}

export interface CommercialPerformance {
  nom: string
  email: string
  total_visites: number
  visites_mois: number
  taux_completion: number
}

// ---- Perfect Store ----
// Niveaux du plus exigeant au moins exigeant. Conservés tels quels (référentiel).
export type NiveauPerfectStore =
  | 'FLAGSHIP STORE'
  | 'VIP PERFECT STORE'
  | 'CORE PERFECT STORE'
  | 'BASIC PERFECT STORE'

// Résultat calculé par visite (table resultat_perfect_store). Calcul côté Postgres.
export interface ResultatPerfectStore {
  visite_id: string
  base_calcul: 'taux_vente' | 'taux_revu'
  dispo_rayon_evap: number | null
  dispo_rayon_imp: number | null
  dispo_rayon_scm: number | null
  dispo_rayon: number | null
  visibilite: number | null
  promotion: number | null
  score_global: number | null
  niveau: NiveauPerfectStore | null
  calcule_le: string
}

// Agrégat global (vue v_perfect_store_global).
export interface RepartitionNiveau {
  visites_scorees: number
  perfect_stores: number
  perfect_store_pct: number | null
  score_global_moyen_pct: number | null
  osa_moyen_pct: number | null
  visibilite_moyenne_pct: number | null
  promotion_moyenne_pct: number | null
}

// Couverture par merchandiser et période (vue v_couverture).
export interface CouvertureLigne {
  merchandiser: string
  periode: string
  pdv_vus: number
}

// ---- Offline Queue ----
export interface OfflineQueueItem {
  id: string
  type: 'visite' | 'pdv' | 'image' | 'positions_batch'
  data: any
  timestamp: number
  retries: number
  status: 'pending' | 'processing' | 'error'
}

// ---- Tracking de tournée (app native) ----
// Ligne de la table position_tournee ; id généré côté client pour
// l'idempotence des renvois (upsert ignoreDuplicates).
export interface PositionPoint {
  id: string
  user_id: string
  tournee_id: string
  lat: number
  lng: number
  accuracy: number | null
  speed: number | null
  captured_at: string
}

export interface TourneeActive {
  tourneeId: string
  userId: string
  startedAt: string
}

// ---- CSV Import/Export ----
export interface CSVMapping {
  header: string
  field: string
  transform?: (value: string) => any
}

// ---- Geofencing ----
export interface GeofenceResult {
  isWithinRange: boolean
  distance: number
  accuracy: number
  userPosition: { lat: number; lng: number }
  pdvPosition: { lat: number; lng: number }
}

// ---- Default form values ----
export function getDefaultVisiteData(): VisiteData {
  return {
    produits: {
      evap: { present: false, br_gold: 'En rupture', br_160g: 'En rupture', brb_160g: 'En rupture', br_400g: 'En rupture', brb_400g: 'En rupture', pearl_400g: 'En rupture', prix_respectes: false, quantites: {} },
      imp: { present: false, br_400g: 'En rupture', br_900g: 'En rupture', br_2_5kg: 'En rupture', br_375g: 'En rupture', brb_400g: 'En rupture', br_20g: 'En rupture', brb_25g: 'En rupture', brd_15g: 'En rupture', brd_350g: 'En rupture', prix_respectes: false, quantites: {} },
      scm: { present: false, br_1kg: 'En rupture', pearl_1kg: 'En rupture', prix_respectes: false, quantites: {} },
      uht: { present: false, demi_ecreme: 'En rupture', elopack_500ml: 'En rupture', brique_1l: 'En rupture', prix_respectes: false, quantites: {} },
      cereales: { present: false, brcv: 'En rupture', brcc: 'En rupture', prix_respectes: false, quantites: {} },
      yaourt: { present: false, br_yogoo_fraise_mini_90ml: 'En rupture', br_yogoo_fraise_maxi_318ml: 'En rupture', br_yogoo_nature_mini_90ml: 'En rupture', br_yogoo_nature_maxi_318ml: 'En rupture', prix_respectes: false, quantites: {} },
    },
    concurrence: {
      presence_concurrents: false,
      evap: { present: false, en_activite: false, action_concurrence: '', cowmilk: 'En rupture', nido_150g: 'En rupture', autre: 'En rupture' },
      imp: { present: false, en_activite: false, action_concurrence: '', nido: 'En rupture', laity: 'En rupture', top_lait: 'En rupture', autre: 'En rupture' },
      scm: { present: false, en_activite: false, action_concurrence: '', top_saho: 'En rupture', autre: 'En rupture' },
      uht: { present: false, en_activite: false, action_concurrence: '', candia: 'En rupture', autre: 'En rupture' },
      autres: [],
    },
    visibilite: {
      standards: {},
      promotion_applicable: false,
      exterieure: {
        presence_visibilite: false,
        full_branding: false,
        poster: false,
        panneau_privilege: false,
        sign_board: false,
        guirlande: false,
        autre_branding: false,
      },
      interieure: {
        presence_visibilite: false,
        hanger: false,
        tete_gondole: false,
        maison_bonnet_rouge: false,
        reglettes: false,
        zone_chaude: false,
        produits_frigo: false,
        presentoirs: false,
        bacs_pouch: false,
        autre_gt: false,
        habillage_rayon: false,
        merchandising: false,
        autre_interieure: false,
      },
      concurrence: {
        presence_visibilite: false,
        nido_exterieur: false,
        nido_interieur: false,
        laity_exterieur: false,
        laity_interieur: false,
        candia_exterieur: false,
        candia_interieur: false,
        autre_exterieur: false,
        autre_interieur: false,
      },
    },
    actions: {
      referencement_produits: false,
      execution_activites_promotionnelles: false,
      prospection_pdv: false,
      verification_fifo: false,
      rangement_produits: false,
      pose_affiches: false,
      pose_materiel_visibilite: false,
    },
  }
}
