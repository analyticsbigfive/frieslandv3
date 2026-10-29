"""Étape 14 : carte des merchandisers (Leaflet intégré, s'ouvre hors ligne sauf les tuiles).

- une couleur par merchandiser pour sa zone (union de ses secteurs) ;
- limites des secteurs en traits fins, nom au survol ;
- PDV en points ; au clic : nom, secteur, date de visite ;
- filtres : merchandiser, territoire, confiance ; légende avec PDV et charge.
Sortie : data/out/carte_merchandisers.html
"""
from __future__ import annotations

import importlib
import json

import geopandas as gpd
import pandas as pd

from atom.commun import DATA_CACHE, DATA_OUT

phase1 = importlib.import_module("07_carte_phase1")


def main() -> None:
    # Caches écrits par les étapes précédentes du pipeline (fichiers locaux).
    ps = pd.read_pickle(DATA_CACHE / "pdv_secteurs.pkl")
    prop = pd.read_pickle(DATA_CACHE / "proprietaires.pkl").set_index("Cle")
    poly = gpd.read_file(DATA_OUT / "secteurs.geojson")
    rm = pd.read_csv(DATA_OUT / "routing_mensuel_v2.csv", dtype=str).fillna("")
    rd = pd.read_csv(DATA_OUT / "routing_detail.csv", dtype=str).fillna("")
    cap = pd.read_csv(DATA_OUT / "capacite.csv")

    merch = sorted(rm.Merchandiser.unique())
    poly["m"] = poly.Cle.map(prop.Merchandiser).fillna("")
    poly["geometry"] = poly.geometry.simplify(0.00008, preserve_topology=True)
    zones = poly[poly.m != ""].dissolve(by="m").reset_index()[["m", "geometry"]]
    zones["geometry"] = zones.geometry.simplify(0.0002, preserve_topology=True)
    date_visite = rd[rd.ID_PDV != ""].set_index("ID_PDV").Date.to_dict()
    terr = sorted(poly.Territoire.unique())
    conf = {"haute": 0, "moyenne": 1, "basse": 2}
    pts = []
    for r in ps[ps.GPS_Lat.notna()].itertuples():
        cle = r.Cle if isinstance(r.Cle, str) and r.Cle else ""
        m = prop.Merchandiser.get(cle, "") if cle else ""
        pts.append([round(float(r.GPS_Lat), 5), round(float(r.GPS_Lng), 5), conf.get(r.Confiance, 3), r.Nom_PDV,
                    cle.split("|")[2] if cle else "", terr.index(r.Territoire) if r.Territoire in terr else -1,
                    merch.index(m) if m in merch else -1, date_visite.get(r.ID_PDV, ""),
                    "" if r.Routable == "oui" else (r.Statut_407 or "hors routing")])
    rep = pd.read_csv(DATA_OUT / "pdv_reportes.csv", dtype=str)
    leg = []
    for m in merch:
        c = cap[cap.Merchandiser == m]
        j = rm[(rm.Merchandiser == m) & (rm.Source != "rattrapage")]
        leg.append({"m": m, "couvrir": int(c["PDV à couvrir"].iloc[0]) if len(c) else 0,
                    "planifies": int(j["Nb PDV"].astype(int).sum()), "reportes": int((rep.Merchandiser == m).sum()),
                    "ratio": float(c.Ratio.iloc[0]) if len(c) else 0})
    donnees = {"secteurs": json.loads(poly[["Cle", "Territoire", "Zone", "Secteur", "Commercial", "m",
                                            "geometry"]].to_json(drop_id=True)),
               "zones": json.loads(zones.to_json(drop_id=True)), "pdv": pts, "territoires": terr,
               "merch": merch, "legende": leg}
    js, css = phase1.leaflet()
    brut = json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
    brut = brut.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    html = PAGE.replace("/*LEAFLET_CSS*/", css).replace("/*LEAFLET_JS*/", js).replace("/*DONNEES*/", brut)
    (DATA_OUT / "carte_merchandisers.html").write_text(html, encoding="utf-8")
    print(f"  carte : {len(pts)} PDV, {len(poly)} secteurs, {len(zones)} zones de merchandiser")


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Routing ATOM – novembre 2026</title>
<style>/*LEAFLET_CSS*/</style>
<style>
:root{--fond:#fafaf9;--texte:#1c1917;--doux:#57534e;--bord:#e7e5e4;--carte:#ffffff}
@media (prefers-color-scheme:dark){:root{--fond:#1c1917;--texte:#f5f5f4;--doux:#a8a29e;--bord:#44403c;--carte:#292524}}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--fond);color:var(--texte);
font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
#app{display:flex;height:100%}#panneau{width:340px;padding:16px;overflow:auto;border-right:1px solid var(--bord);background:var(--carte)}
#carte{flex:1}h1{font-size:17px;margin:0 0 4px}p.sous{margin:0 0 12px;color:var(--doux)}
label{display:block;font-weight:600;margin:12px 0 4px}select{width:100%;padding:6px;border:1px solid var(--bord);border-radius:6px;
background:var(--fond);color:var(--texte)}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
td,th{padding:3px 4px;text-align:left;border-bottom:1px solid var(--bord)}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.pt{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:6px;vertical-align:-1px}
.chk{display:flex;gap:6px;align-items:center;margin:4px 0;font-weight:400}
@media (max-width:700px){#app{flex-direction:column}#panneau{width:auto;max-height:45%;border-right:0;border-bottom:1px solid var(--bord)}}
</style></head><body><div id="app"><div id="panneau">
<h1>Routing ATOM · novembre 2026</h1><p class="sous">Découpage Friesland · une couleur par merchandiser</p>
<label for="fM">Merchandiser</label><select id="fM"><option value="-1">Tous</option></select>
<label for="fT">Territoire</label><select id="fT"><option value="-1">Tous</option></select>
<label>Confiance du rangement</label><div id="fC"></div>
<label>Merchandisers</label><table><thead><tr><th>Nom</th><th class="n">À couvrir</th><th class="n">Charge</th><th class="n">Planifiés</th><th class="n">Reportés</th></tr></thead><tbody id="leg"></tbody></table>
<p class="sous" style="margin-top:6px">Charge = PDV à couvrir ÷ capacité du mois (420 PDV). Au-delà de 1, les PDV les moins prioritaires sont reportés au mois suivant.</p>
<p class="sous" style="margin-top:10px">Points pleins : PDV planifiés en novembre. Points clairs : reportés ou hors routing.</p>
<div id="stat" class="sous"></div></div><div id="carte"></div></div>
<script>/*LEAFLET_JS*/</script>
<script>
const D=/*DONNEES*/;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COUL=['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#9333ea','#ea580c'];
const col=i=>i<0?'#78716c':COUL[i%COUL.length];
const NOMS=['haute','moyenne','basse','sans secteur'];
const map=L.map('carte',{preferCanvas:true}).setView([5.36,-4.0],11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const fM=document.getElementById('fM'),fT=document.getElementById('fT'),fC=document.getElementById('fC');
D.merch.forEach((m,i)=>fM.add(new Option(m,i)));D.territoires.forEach((t,i)=>fT.add(new Option(t,i)));
const cOn=[1,1,1,1];NOMS.forEach((n,i)=>{const d=document.createElement('div');d.className='chk';
d.innerHTML=`<input type="checkbox" checked><span>${n}</span>`;d.querySelector('input').onchange=e=>{cOn[i]=e.target.checked?1:0;dessiner()};fC.appendChild(d)});
document.getElementById('leg').innerHTML=D.legende.map((l,i)=>`<tr><td><span class="pt" style="background:${col(i)}"></span>${esc(l.m)}</td><td class="n">${l.couvrir}</td><td class="n">${l.ratio.toLocaleString('fr-FR')} ×</td><td class="n">${l.planifies}</td><td class="n">${l.reportes}</td></tr>`).join('');
const zones=L.geoJSON(D.zones,{style:f=>({color:col(D.merch.indexOf(f.properties.m)),weight:2,fillOpacity:.18})}).addTo(map);
const sect=L.geoJSON(D.secteurs,{style:{color:'#57534e',weight:.6,fill:true,fillOpacity:0},
onEachFeature:(f,l)=>{const p=f.properties;l.bindTooltip(`<b>${esc(p.Secteur)}</b><br>${esc(p.Zone)} · ${esc(p.Territoire)}<br>Commercial : ${esc(p.Commercial)}<br>Merchandiser : ${esc(p.m||'personne')}`,{sticky:true})}}).addTo(map);
let couche=L.layerGroup().addTo(map);const rendu=L.canvas({padding:.5});
function dessiner(){couche.clearLayers();const m=+fM.value,t=+fT.value;let n=0,np=0;
for(const p of D.pdv){if(m>=0&&p[6]!==m)continue;if(t>=0&&p[5]!==t)continue;if(!cOn[p[2]])continue;n++;const plan=!!p[7];if(plan)np++;
L.circleMarker([p[0],p[1]],{renderer:rendu,radius:plan?3.5:2.5,weight:0,fillColor:col(p[6]),fillOpacity:plan?.95:.3})
.bindPopup(`<b>${esc(p[3])}</b><br>Secteur : ${esc(p[4]||'—')}<br>${esc(D.territoires[p[5]]||'')}<br>Merchandiser : ${esc(D.merch[p[6]]||'personne')}<br>Visite : ${p[7]?esc(new Date(p[7]).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})):esc(p[8]||'reportée (capacité)')}`).addTo(couche)}
document.getElementById('stat').textContent=`${n.toLocaleString('fr-FR')} PDV affichés, dont ${np.toLocaleString('fr-FR')} planifiés`}
function cadrer(){const m=+fM.value;if(m<0)return;const b=L.featureGroup();zones.eachLayer(l=>{if(l.feature.properties.m===D.merch[m])b.addLayer(l)});if(b.getLayers().length)map.fitBounds(b.getBounds())}
fM.onchange=()=>{dessiner();cadrer()};fT.onchange=dessiner;dessiner();
</script></body></html>"""

if __name__ == "__main__":
    main()
