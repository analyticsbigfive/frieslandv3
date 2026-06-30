# Référentiel BIG FIVE KPI

Ces migrations reprennent le fichier `BIG FIVE KPI UPDATE vf.xlsx` :

- 42 territoires et 179 zones/areas ;
- 41 types de point de vente ;
- 41 distributeurs (master + mapping) et 7 territoires non assignés ;
- poids de disponibilité `taux_vente` et `taux_revu` pour EVAP, IMP et SCM ;
- seuils de disponibilité par segment/grade ;
- standards de visibilité extérieure, intérieure et promotion pour Boutique,
  Superette/MT, Table Top, Pushcart, Porridge et Kiosque/Aboki ;
- calcul Perfect Store et couverture avec recalcul de l'historique.

Ordre d'exécution :

```bash
chmod +x scripts/run-big-five-migrations.sh
./scripts/run-big-five-migrations.sh "$DATABASE_URL"
```

Le dernier script recalcule `resultat_perfect_store` pour toutes les visites
existantes. Sur une base volumineuse, exécuter pendant une fenêtre de maintenance.
