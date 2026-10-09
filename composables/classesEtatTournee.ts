// Couleurs d'un jour de tournée, communes au calendrier par personne et au
// planning d'équipe (page admin Routing). Ici et pas dans utils/ : Tailwind ne
// génère que les classes des dossiers qu'il lit (voir tailwind.config.ts).
import type { EtatTournee } from '~/utils/calendrierTournees'

export const CLASSES_ETAT_TOURNEE: Record<EtatTournee, { fond: string, texte: string }> = {
  annulee: { fond: 'bg-slate-100 dark:bg-slate-700/60', texte: 'text-slate-600 line-through dark:text-slate-300' },
  faite: { fond: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300', texte: 'font-semibold' },
  incomplete: { fond: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300', texte: 'font-semibold' },
  planifiee: { fond: 'bg-sky-50 dark:bg-sky-500/10', texte: 'font-semibold text-sky-700 dark:text-sky-300' },
  a_generer: { fond: 'outline-dashed outline-1 -outline-offset-4 outline-slate-300 dark:outline-slate-600', texte: 'text-slate-600 dark:text-slate-400' },
  non_generee: { fond: '', texte: 'text-slate-600 dark:text-slate-400' },
  suspendue: { fond: 'bg-slate-100 dark:bg-slate-700/60', texte: 'text-slate-600 dark:text-slate-300' },
  vide: { fond: '', texte: '' },
}
