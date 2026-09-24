// utils/fetchAll.ts
// Lit toutes les lignes d'une requête PostgREST, page par page.
//
// Le projet plafonne chaque réponse à 1 000 lignes (max_rows) : une requête
// sans range() sur `pdv` (25 000+ lignes) ne renvoie que les 1 000 premières,
// sans erreur. `page(from, to)` doit construire la requête avec un ordre stable
// (clé unique en dernier critère), sinon des lignes sautent d'une page à l'autre.
//
// Les pages partent par lots de LOT en parallèle : 26 allers-retours en série
// prenaient ~12 s pour la table pdv.
const PAGE = 1000
const LOT = 6

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null, error: any }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let debut = 0; ; debut += PAGE * LOT) {
    const reponses = await Promise.all(
      Array.from({ length: LOT }, (_, i) => page(debut + i * PAGE, debut + (i + 1) * PAGE - 1)),
    )
    for (const { data, error } of reponses) {
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < PAGE) return rows
    }
  }
}
