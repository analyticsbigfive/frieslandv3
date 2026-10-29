"""Étape 7 (1.4) : synthèse et première carte de la phase 1.

Sorties : data/out/carte_phase1.html (Leaflet intégré, s'ouvre hors ligne sauf les tuiles),
data/out/synthese_phase1.md
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import geopandas as gpd
import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT, DATA_REF, RACINE


def leaflet() -> tuple[str, str]:
    """Leaflet 1.9.4 depuis node_modules (worktree ou dépôt principal)."""
    commun = subprocess.run(["git", "rev-parse", "--git-common-dir"], cwd=RACINE, capture_output=True,
                            text=True).stdout.strip()
    for base in (RACINE, Path(commun).resolve().parent if commun else RACINE):
        d = base / "node_modules" / "leaflet" / "dist"
        if (d / "leaflet.js").exists():
            return (d / "leaflet.js").read_text(), (d / "leaflet.css").read_text()
    raise SystemExit("ARRÊT : leaflet introuvable dans node_modules")


def synthese(ps: pd.DataFrame, x: pd.DataFrame, an: pd.DataFrame, sect: pd.DataFrame,
             avec_routing: set[str], aff: pd.DataFrame) -> str:
    pos = ps[ps.Cle.notna() & ps.Cle.astype(str).str.len().gt(0)]
    L = ["# Phase 1 : PDV ATOM rangés dans le découpage Friesland", ""]
    L += [f"- PDV distincts : **{len(ps)}** (9 693 lignes, 14 répétées à l'identique, 11 ID en double).",
          f"- Rangés dans un secteur : **{len(pos)}**, dont {(pos.Methode == 'GPS PDV').sum()} par leur GPS, "
          f"{(pos.Methode == 'GPS visite').sum()} par le GPS récupéré des visites et "
          f"{(pos.Methode == 'rattachement manuel').sum()} par le rattachement manuel (407).",
          f"- Sans secteur : **{len(ps) - len(pos)}** ({(ps.Methode == '').sum()} PDV à localiser, "
          f"{len(ps) - len(pos) - (ps.Methode == '').sum()} GPS hors de tout secteur).",
          f"- Éligibles au routing du 2 novembre (rangés, hors conflit et hors « à localiser ») : "
          f"**{(ps.Routable == 'oui').sum()}**, dont {((ps.Routable == 'oui') & ps.Merchandiser.isin(avec_routing)).sum()} "
          f"créés par un merchandiser qui a un routing. Ce n'est pas encore le nombre de PDV planifiés (phase 2).", ""]
    L += ["## Par niveau de confiance", "", "| Confiance | PDV |", "|---|---:|"]
    for k, v in ps.Confiance.fillna("").replace("", "— (sans GPS ou hors secteur)").value_counts().items():
        L.append(f"| {k} | {v} |")
    L += ["", "## Les 407 PDV sans GPS (statut final)", "", "| Statut final | Routable | PDV |", "|---|---|---:|"]
    for (s, r), v in x.groupby(["Statut final", "Routable"]).size().items():
        L.append(f"| {s} | {r} | {v} |")
    L += ["", "## Par territoire", "", "| Territoire | Commercial | Zones | Secteurs | Secteurs avec PDV | PDV |",
          "|---|---|---:|---:|---:|---:|"]
    for t, g in sect.groupby("Territoire"):
        p_t = pos[pos.Territoire == t]
        L.append(f"| {t} | {g.Commercial.iloc[0]} | {g.Zone.nunique()} | {len(g)} | {p_t.Cle.nunique()} | {len(p_t)} |")
    L += ["", "## Par zone", "", "| Territoire | Zone | Secteurs | PDV |", "|---|---|---:|---:|"]
    for (t, z), g in sect.groupby(["Territoire", "Zone"]):
        L.append(f"| {t} | {z} | {len(g)} | {len(pos[(pos.Territoire == t) & (pos.Zone == z)])} |")
    L += ["", "## Communes partagées entre plusieurs territoires", "",
          "Le partage se fait par l'ancrage le plus proche (table `data/ref/territoire_communes.csv`, à valider).", "",
          "| Commune (OSM) | Territoire | PDV |", "|---|---|---:|"]
    a = aff[aff.Cle.notna()]
    for u, g in a.groupby("Unite"):
        if g.Territoire.nunique() > 1:
            for t, n in g.Territoire.value_counts().items():
                L.append(f"| {u} | {t} | {n} |")
    rep = ps[ps.Attribution.fillna("").str.startswith("reprise")]
    if len(rep):
        L += ["", f"## PDV des merchandisers retirés ({len(rep)})", "",
              "Attribués au merchandiser qui couvre aujourd'hui leur secteur (décision du 29/10).", "",
              "| Créé par | Attribué à | Règle | PDV |", "|---|---|---|---:|"]
        for (c, m, r), n in rep.groupby([rep.Cree_par, rep.Merchandiser.replace("", "personne"),
                                         rep.Attribution.str.split(" : ").str[1]]).size().items():
            L.append(f"| {c} | {m} | {r} | {n} |")
    vides = sect[~sect.index.isin(pos.Cle)]
    L += ["", f"## Secteurs sans aucun PDV ({len(vides)})", ""]
    for t, g in vides.groupby("Territoire"):
        L.append(f"- **{t}** : " + ", ".join(f"{s} ({z})" for z, s in zip(g.Zone, g.Secteur)))
    L += ["", "## Anomalies (data/out/anomalies.csv)", "", "| Type | Nombre |", "|---|---:|"]
    for k, v in an.Type.value_counts().items():
        L.append(f"| {k} | {v} |")
    L += ["", "Nombre de PDV par secteur (306 lignes) : `data/out/pdv_par_secteur.csv` ; détail : `data/out/pdv_secteurs.csv`."]
    return "\n".join(L) + "\n"


def main() -> None:
    # Caches écrits par les étapes 01 à 06 du pipeline (fichiers locaux).
    ps = pd.read_pickle(DATA_CACHE / "pdv_secteurs.pkl")
    sect = pd.read_pickle(DATA_CACHE / "secteurs.pkl").set_index("Cle")
    x = pd.read_csv(DATA_OUT / "rattachement_407_croise.csv", dtype=str).fillna("")
    an = pd.read_csv(DATA_OUT / "anomalies.csv", dtype=str).fillna("")
    poly = gpd.read_file(DATA_OUT / "secteurs.geojson")
    routing = pd.read_csv(DATA_REF / "alias_merchandisers.csv", dtype=str)
    avec_routing = set(routing[routing.A_un_routing == "oui"].Merchandiser)
    aff = pd.read_pickle(DATA_CACHE / "affectation.pkl")
    (DATA_OUT / "synthese_phase1.md").write_text(synthese(ps, x, an, sect, avec_routing, aff), encoding="utf-8")
    # Nombre de PDV par secteur, les 306 secteurs (y compris à zéro)
    anc = pd.read_pickle(DATA_CACHE / "ancrages.pkl").set_index("Cle")
    t = sect[["Territoire", "Zone", "Secteur", "Commercial"]].copy()
    t["PDV"] = t.index.map(ps.groupby("Cle").size()).fillna(0).astype(int)
    t["dont rattachement manuel"] = t.index.map(ps[ps.Methode == "rattachement manuel"].groupby("Cle").size()).fillna(0).astype(int)
    for c in ("haute", "moyenne", "basse"):
        t[f"confiance {c}"] = t.index.map(ps[ps.Confiance == c].groupby("Cle").size()).fillna(0).astype(int)
    t["Ancrage"] = t.index.map(anc.Methode_ancrage)
    t.to_csv(DATA_OUT / "pdv_par_secteur.csv", index=False)

    nb = ps.groupby("Cle").size()
    poly["n"] = poly.Cle.map(nb).fillna(0).astype(int)
    poly["geometry"] = poly.geometry.simplify(0.00008, preserve_topology=True)
    secteurs_js = json.loads(poly[["Cle", "Territoire", "Zone", "Secteur", "Commercial", "Methode_ancrage",
                                   "Ancrage_lat", "Ancrage_lng", "n", "geometry"]].to_json(drop_id=True))
    terr = sorted(sect.Territoire.unique())
    merch = sorted(ps.Merchandiser.fillna("").unique())
    conf = {"haute": 0, "moyenne": 1, "basse": 2}
    pts = []
    for r in ps[ps.GPS_Lat.notna()].itertuples():
        cle = r.Cle if isinstance(r.Cle, str) and r.Cle else ""
        pts.append([round(r.GPS_Lat, 5), round(r.GPS_Lng, 5), conf.get(r.Confiance, 3), r.Nom_PDV,
                    cle.split("|")[2] if cle else "", terr.index(r.Territoire) if r.Territoire in terr else -1,
                    merch.index(r.Merchandiser if isinstance(r.Merchandiser, str) else ""),
                    1 if r.Methode == "GPS visite" else 0, r.Type_PDV])
    donnees = {"secteurs": secteurs_js, "pdv": pts, "territoires": terr, "merch": merch}
    js, css = leaflet()
    html = PAGE.replace("/*LEAFLET_CSS*/", css).replace("/*LEAFLET_JS*/", js) \
        .replace("/*DONNEES*/", json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
                 .replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026"))
    (DATA_OUT / "carte_phase1.html").write_text(html, encoding="utf-8")
    print(f"  carte : {len(pts)} PDV, {len(poly)} secteurs ; synthèse : data/out/synthese_phase1.md")


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Découpage Friesland – PDV ATOM</title>
<style>/*LEAFLET_CSS*/</style>
<style>
:root{--fond:#fafaf9;--texte:#1c1917;--doux:#57534e;--bord:#e7e5e4;--carte:#ffffff;
--haute:#15803d;--moyenne:#d97706;--basse:#dc2626;--hors:#78716c;}
@media (prefers-color-scheme:dark){:root{--fond:#1c1917;--texte:#f5f5f4;--doux:#a8a29e;--bord:#44403c;--carte:#292524;
--haute:#4ade80;--moyenne:#fbbf24;--basse:#f87171;--hors:#a8a29e;}}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--fond);color:var(--texte);
font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
#app{display:flex;height:100%}#panneau{width:320px;padding:16px;overflow:auto;border-right:1px solid var(--bord);background:var(--carte)}
#carte{flex:1}h1{font-size:17px;margin:0 0 4px}p.sous{margin:0 0 14px;color:var(--doux)}
label{display:block;font-weight:600;margin:12px 0 4px}select{width:100%;padding:6px;border:1px solid var(--bord);
border-radius:6px;background:var(--fond);color:var(--texte)}.leg{display:flex;align-items:center;gap:8px;margin:4px 0}
.pt{width:10px;height:10px;border-radius:50%;display:inline-block}.n{margin-left:auto;color:var(--doux);font-variant-numeric:tabular-nums}
.chk{font-weight:400;display:flex;gap:6px;align-items:center;margin:4px 0}
@media (max-width:700px){#app{flex-direction:column}#panneau{width:auto;max-height:42%;border-right:0;border-bottom:1px solid var(--bord)}}
</style></head><body><div id="app"><div id="panneau">
<h1>PDV ATOM dans le découpage Friesland</h1><p class="sous">Phase 1 · 306 secteurs · cellules calculées à partir des ancrages</p>
<label for="fT">Territoire</label><select id="fT"><option value="-1">Tous</option></select>
<label for="fM">Merchandiser</label><select id="fM"><option value="-1">Tous</option></select>
<label>Confiance</label><div id="fC"></div>
<label>Secteurs</label><div class="chk"><input type="checkbox" id="fS" checked><span>limites et noms au survol</span></div>
<div id="stat" class="sous" style="margin-top:14px"></div></div><div id="carte"></div></div>
<script>/*LEAFLET_JS*/</script>
<script>
const D=/*DONNEES*/;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NOMS=["haute","moyenne","basse","hors secteur"],VAR=["--haute","--moyenne","--basse","--hors"];
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const map=L.map('carte',{preferCanvas:true}).setView([5.36,-4.0],11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const teinte=i=>`hsl(${(i*137.5)%360} 55% 50%)`;
const fT=document.getElementById('fT'),fM=document.getElementById('fM'),fC=document.getElementById('fC');
D.territoires.forEach((t,i)=>fT.add(new Option(t,i)));D.merch.forEach((m,i)=>fM.add(new Option(m||'(inconnu)',i)));
const cOn=[1,1,1,1];NOMS.forEach((n,i)=>{const d=document.createElement('div');d.className='leg';
d.innerHTML=`<input type="checkbox" checked data-i="${i}"><span class="pt" style="background:${css(VAR[i])}"></span>${n}<span class="n" id="n${i}"></span>`;
d.querySelector('input').onchange=e=>{cOn[i]=e.target.checked?1:0;dessiner()};fC.appendChild(d)});
const sect=L.geoJSON(D.secteurs,{style:f=>({color:teinte(D.territoires.indexOf(f.properties.Territoire)),weight:1,fillOpacity:.06}),
onEachFeature:(f,l)=>{const p=f.properties;l.bindTooltip(`<b>${esc(p.Secteur)}</b><br>${esc(p.Zone)} · ${esc(p.Territoire)}<br>${esc(p.Commercial)}<br>${esc(p.n)} PDV · ancrage : ${esc(p.Methode_ancrage)}`,{sticky:true})}}).addTo(map);
document.getElementById('fS').onchange=e=>e.target.checked?sect.addTo(map):map.removeLayer(sect);
let couche=L.layerGroup().addTo(map);const rendu=L.canvas({padding:.5});
function dessiner(){couche.clearLayers();const t=+fT.value,m=+fM.value,cnt=[0,0,0,0];let n=0;
for(const p of D.pdv){if(t>=0&&p[5]!==t)continue;if(m>=0&&p[6]!==m)continue;cnt[p[2]]++;if(!cOn[p[2]])continue;n++;
L.circleMarker([p[0],p[1]],{renderer:rendu,radius:3,weight:p[7]?2:0,color:'#111',fillColor:css(VAR[p[2]]),fillOpacity:.85})
.bindPopup(`<b>${esc(p[3])}</b><br>${esc(p[8])}<br>Secteur : ${esc(p[4]||'—')}<br>${esc(D.territoires[p[5]]||'hors secteur')}<br>Merchandiser : ${esc(D.merch[p[6]])}${p[7]?'<br><i>GPS récupéré des visites</i>':''}`).addTo(couche)}
cnt.forEach((c,i)=>document.getElementById('n'+i).textContent=c.toLocaleString('fr-FR'));
document.getElementById('stat').textContent=`${n.toLocaleString('fr-FR')} PDV affichés`}
fT.onchange=()=>{dessiner();const t=+fT.value;if(t>=0){const b=L.featureGroup();sect.eachLayer(l=>{if(l.feature.properties.Territoire===D.territoires[t])b.addLayer(L.geoJSON(l.feature))});if(b.getLayers().length)map.fitBounds(b.getBounds())}};
fM.onchange=dessiner;dessiner();
</script></body></html>"""

if __name__ == "__main__":
    main()
