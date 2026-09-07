#!/usr/bin/env bash
# Vérifie que l'artefact (.aab ou .apk) est signé avec la clé d'upload Play de
# Friesland Bonnet Rouge. Sort non-zéro sinon.
#   ./scripts/verify-aab-signature.sh [chemin]
# Empreinte publique = Play Console › Intégrité de l'app › certificat de la clé d'importation.
set -euo pipefail

EXPECTED_SHA1="13b21bc5c7129073bedf65ebaefd0df645fefdcf"
ARTIFACT="${1:-android/app/build/outputs/bundle/release/app-release.aab}"

[ -f "$ARTIFACT" ] || { echo "ERREUR : artefact introuvable : $ARTIFACT" >&2; exit 1; }

# Signature v1 (jar) : un bloc PKCS#7 nommé d'après l'alias.
# alias `upload` -> META-INF/UPLOAD.RSA ; clé debug -> META-INF/ANDROIDD.RSA
COUNT="$(unzip -Z1 "$ARTIFACT" | grep -Eic '^META-INF/.*\.(RSA|DSA|EC)$' || true)"
[ "$COUNT" -ne 0 ] || { echo "ERREUR : aucun bloc de signature — artefact NON SIGNÉ." >&2; exit 1; }
[ "$COUNT" -eq 1 ] || { echo "ERREUR : $COUNT blocs de signature, 1 attendu." >&2; exit 1; }

BLOCK="$(unzip -Z1 "$ARTIFACT" | grep -Ei '^META-INF/.*\.(RSA|DSA|EC)$' | head -1)"

# openssl x509 ne lit que le PREMIER certificat PEM = le signataire. La clé est
# auto-signée (un seul cert), garanti par le contrôle "exactement 1 bloc" ci-dessus.
ACTUAL_SHA1="$(unzip -p "$ARTIFACT" "$BLOCK" \
  | openssl pkcs7 -inform DER -print_certs \
  | openssl x509 -outform DER \
  | shasum -a 1 | cut -d' ' -f1)" \
  || { echo "ERREUR : extraction du certificat impossible — NON VÉRIFIABLE." >&2; exit 1; }

[ "${#ACTUAL_SHA1}" -eq 40 ] \
  || { echo "ERREUR : empreinte illisible — NON VÉRIFIABLE." >&2; exit 1; }

echo "Artefact : $ARTIFACT"
echo "Bloc     : $BLOCK"
echo "SHA-1    : $ACTUAL_SHA1"

if [ "$ACTUAL_SHA1" != "$EXPECTED_SHA1" ]; then
  {
    echo ""
    echo "ÉCHEC : artefact signé avec la MAUVAISE clé."
    echo "  attendu : $EXPECTED_SHA1"
    echo "  obtenu  : $ACTUAL_SHA1"
    echo "  (0d75d17f24eeea465e5bad4ccdb20a38bfed0481 = clé debug Android)"
  } >&2
  exit 1
fi

echo "OK : clé d'upload Friesland Bonnet Rouge."

# Affichage lisible du DN. Locale forcée : keytool traduit ses libellés
# (« Empreintes du certificat » / « SHA 1: » en français) — d'où le contrôle
# principal fait par digest openssl, insensible à la locale.
if command -v keytool >/dev/null 2>&1; then
  unzip -p "$ARTIFACT" "$BLOCK" \
    | keytool -printcert -J-Duser.language=en -J-Duser.country=US 2>/dev/null \
    | sed -n '1,7p' || true
fi
