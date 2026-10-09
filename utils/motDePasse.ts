// Règles de mot de passe, partagées entre le changement obligatoire
// (pages/changer-mot-de-passe.vue) et le changement volontaire
// (pages/mon-mot-de-passe.vue).
//
// Les comptes privilégiés (admin, superviseur) ouvrent tout le parc et, pour
// l'admin, la gestion des utilisateurs ; le compte agence charge le routing de
// toute une agence depuis le back-office. On leur impose un mot de passe plus
// long et plus varié. Les comptes terrain gardent la règle des 8 caractères,
// saisie sur téléphone.
import { isPrivilegedRole } from './roles'

export interface RegleMotDePasse {
  libelle: string
  respectee: (mdp: string) => boolean
}

const CLASSES: ((mdp: string) => boolean)[] = [
  mdp => /[a-z]/.test(mdp),
  mdp => /[A-Z]/.test(mdp),
  mdp => /\d/.test(mdp),
  mdp => /[^A-Za-z0-9]/.test(mdp),
]

// Mots trop devinables pour un compte privilégié, même noyés dans un mot plus long.
const MOTS_INTERDITS = ['test1234', 'password', 'motdepasse', 'azerty', 'qwerty', '123456', 'admin', 'friesland', 'bonnetrouge']

export function reglesMotDePasse(role?: string | null, email?: string | null): RegleMotDePasse[] {
  if (!isPrivilegedRole(role) && role !== 'agence') {
    return [{ libelle: 'Au moins 8 caractères', respectee: mdp => mdp.length >= 8 }]
  }
  const identifiant = String(email || '').split('@')[0].toLowerCase()
  return [
    { libelle: 'Au moins 12 caractères', respectee: mdp => mdp.length >= 12 },
    {
      libelle: 'Au moins 3 types parmi : minuscule, majuscule, chiffre, symbole',
      respectee: mdp => CLASSES.filter(c => c(mdp)).length >= 3,
    },
    {
      libelle: 'Pas de mot courant (admin, azerty, 123456…) ni votre identifiant',
      respectee: (mdp) => {
        const bas = mdp.toLowerCase()
        if (MOTS_INTERDITS.some(m => bas.includes(m))) return false
        return identifiant.length < 4 || !bas.includes(identifiant)
      },
    },
  ]
}

/** Premier message d'erreur, ou null si le mot de passe respecte toutes les règles. */
export function erreurMotDePasse(mdp: string, role?: string | null, email?: string | null): string | null {
  const manquee = reglesMotDePasse(role, email).find(r => !r.respectee(mdp))
  return manquee ? `Mot de passe trop faible : ${manquee.libelle.toLowerCase()}.` : null
}
