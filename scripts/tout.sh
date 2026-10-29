#!/bin/sh
# Relance toute la chaîne (les appels réseau sont en cache dans data/cache/).
set -e
cd "$(dirname "$0")"
for s in 00_download 01_load 02_alias 03_gps_visites 04_secteurs 05_affecter 06_croiser_407 07_carte_phase1 \
         10_routing_existant 11_quota 13_routing 14_carte 15_rapport 20_email 21_envoi_atom; do
  echo "== $s"
  uv run python -u "$s.py"
done
