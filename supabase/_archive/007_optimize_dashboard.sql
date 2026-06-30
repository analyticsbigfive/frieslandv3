-- ============================================================
-- 007: Dashboard Optimization
-- Vue pour la distribution PDV + Fonction RPC filtrage serveur
-- ============================================================

-- Vue: Distribution des PDV par sous-catégorie
-- Remplace le calcul client-side dans fetchStats()
CREATE OR REPLACE VIEW public.v_distribution_pdv AS
SELECT
  COALESCE(sous_categorie_pdv, 'Autre') AS type,
  COUNT(*) AS count
FROM public.pdv
WHERE is_active = true
GROUP BY COALESCE(sous_categorie_pdv, 'Autre')
ORDER BY count DESC;

-- Fonction RPC: Visites filtrées avec jointure PDV côté serveur
-- Remplace le filtrage client-side dans useDashboardDirection
CREATE OR REPLACE FUNCTION public.get_visites_filtered(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_commercial TEXT DEFAULT NULL,
  p_canal TEXT DEFAULT NULL,
  p_categorie TEXT DEFAULT NULL,
  p_sous_categorie TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_zone TEXT DEFAULT NULL,
  p_secteur TEXT DEFAULT NULL,
  p_nom_pdv TEXT DEFAULT NULL
)
RETURNS TABLE (
  visite_id TEXT,
  date_visite TIMESTAMPTZ,
  commercial TEXT,
  email TEXT,
  data JSONB,
  pdv_id TEXT,
  nom_pdv TEXT,
  canal TEXT,
  categorie_pdv TEXT,
  sous_categorie_pdv TEXT,
  region TEXT,
  zone TEXT,
  secteur TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    v.visite_id,
    v.date_visite,
    v.commercial,
    v.email,
    v.data,
    p.pdv_id,
    p.nom_pdv,
    p.canal,
    p.categorie_pdv,
    p.sous_categorie_pdv,
    p.region,
    p.zone,
    p.secteur
  FROM public.visites v
  LEFT JOIN public.pdv p ON v.pdv_id = p.pdv_id
  WHERE
    (p_date_from IS NULL OR v.date_visite >= p_date_from)
    AND (p_date_to IS NULL OR v.date_visite <= p_date_to)
    AND (p_commercial IS NULL OR v.commercial ILIKE '%' || p_commercial || '%')
    AND (p_canal IS NULL OR p.canal = p_canal)
    AND (p_categorie IS NULL OR p.categorie_pdv = p_categorie)
    AND (p_sous_categorie IS NULL OR p.sous_categorie_pdv = p_sous_categorie)
    AND (p_region IS NULL OR p.region = p_region)
    AND (p_zone IS NULL OR p.zone = p_zone)
    AND (p_secteur IS NULL OR p.secteur ILIKE '%' || p_secteur || '%')
    AND (p_nom_pdv IS NULL OR p.nom_pdv ILIKE '%' || p_nom_pdv || '%')
  ORDER BY v.date_visite DESC;
$$;
