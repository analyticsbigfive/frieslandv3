// server/utils/apiError.ts
// statusMessage ET message : selon la version de Nuxt, le client lit l'un ou
// l'autre dans err.data — poser les deux garantit un message lisible en toast.
export function apiError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message })
}
