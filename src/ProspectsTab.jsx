import { useState, useMemo } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const STATUTS = [
  { key: "nouveau", label: "Nouveau", color: "#38bdf8" },
  { key: "a_rappeler", label: "À rappeler", color: "#facc15" },
  { key: "rdv_pris", label: "RDV pris", color: "#a78bfa" },
  { key: "signe", label: "Signé ✅", color: "#34d399" },
  { key: "perdu", label: "Perdu ❌", color: "#f43f5e" },
];

function exportProspectsCSV(prospects, salespeople) {
  const rows = [["Nom","Prénom","Adresse","Téléphone","Email","Statut","Commercial","Observation"]];
  prospects.forEach(p => {
    const sp = salespeople.find(s => s.id === p.salespersonId);
    const statut = STATUTS.find(s => s.key === p.statut);
    rows.push([p.nom||"", p.prenom||"", p.adresse||"", p.tel||"", p.email||"", statut?.label||"", sp?.name||"", p.observation||""]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "prospects.csv"; a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_FORM = { nom:"", prenom:"", adresse:"", tel:"", email:"", observation:"", statut:"nouveau", salespersonId:"" };

export default function ProspectsTab({ prospects, salespeople, currentUser }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, salespersonId: currentUser?.role === "commercial" ? (salespeople.find(s=>s.name===currentUser.name)?.id||"") : "" });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSp, setFilterSp] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [viewProspect, setViewProspect] = useState(null);

  const filtered = useMemo(() => prospects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.nom||"").toLowerCase().includes(q) || (p.prenom||"").toLowerCase().includes(q) || (p.adresse||"").toLowerCase().includes(q) || (p.tel||"").includes(q);
    const matchSp = filterSp === "all" || p.salespersonId === filterSp;
    const matchStatut = filterStatut === "all" || p.statut === filterStatut;
    return matchSearch && matchSp && matchStatut;
  }), [prospects, search, filterSp, filterStatut]);

  const inp = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"11px 14px", color:"#fff", fontSize:16, fontFamily:"inherit", width:"100%", WebkitAppearance:"none" };

  const save = async () => {
    if (!form.nom.trim()) return;
    setSaving(true);
    const data = { ...form, nom:form.nom.trim(), prenom:form.prenom.trim(), updatedAt: Date.now() };
    if (editId) { await updateDoc(doc(db,"prospects",editId), data); }
    else { await addDoc(collection(db,"prospects"), { ...data, createdAt: Date.now() }); }
    setEditId(null); setForm({ ...EMPTY_FORM, salespersonId: currentUser?.role==="commercial" ? (salespeople.find(s=>s.name===currentUser.name)?.id||"") : "" });
    setShowForm(false); setSaving(false);
  };

  const startEdit = (p) => {
    setForm({ nom:p.nom||"", prenom:p.prenom||"", adresse:p.adresse||"", tel:p.tel||"", email:p.email||"", observation:p.observation||"", statut:p.statut||"nouveau", salespersonId:p.salespersonId||"" });
    setEditId(p.id); setShowForm(true); setViewProspect(null);
    setTimeout(() => document.getElementById("prospect-form")?.scrollIntoView({ behavior:"smooth" }), 100);
  };

  const del = async (id) => { await deleteDoc(doc(db,"prospects",id)); setViewProspect(null); };

  const updateStatut = async (id, statut) => { await updateDoc(doc(db,"prospects",id),{statut}); if(viewProspect?.id===id) setViewProspect(p=>({...p,statut})); };

  const statCounts = useMemo(() => {
    const m = {};
    STATUTS.forEach(s => { m[s.key] = 0; });
    prospects.forEach(p => { if(m[p.statut]!==undefined) m[p.statut]++; });
    return m;
  }, [prospects]);

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {STATUTS.map(s => (
          <div key={s.key} style={{ background:`${s.color}15`, border:`1px solid ${s.color}33`, borderRadius:10, padding:"6px 12px", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:16, fontWeight:800, color:s.color }}>{statCounts[s.key]||0}</span>
            <span style={{ fontSize:11, color:s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Search & filters */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
        <input style={{ ...inp, fontSize:15 }} placeholder="🔍 Rechercher par nom, ville, téléphone..." value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <div style={{ position:"relative" }}>
            <select style={{ ...inp, paddingRight:30, fontSize:13 }} value={filterSp} onChange={e=>setFilterSp(e.target.value)}>
              <option value="all">👤 Tous les commerciaux</option>
              {salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none", fontSize:11 }}>▼</span>
          </div>
          <div style={{ position:"relative" }}>
            <select style={{ ...inp, paddingRight:30, fontSize:13 }} value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
              <option value="all">📊 Tous les statuts</option>
              {STATUTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none", fontSize:11 }}>▼</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>{ setShowForm(!showForm); setEditId(null); setForm({...EMPTY_FORM, salespersonId:currentUser?.role==="commercial"?(salespeople.find(s=>s.name===currentUser.name)?.id||""):""}); }} style={{
          flex:1, padding:"12px", borderRadius:12, fontSize:14, fontWeight:600,
          background:showForm?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#f97316,#fb923c)",
          color:"#fff", border:"none", boxShadow:showForm?"none":"0 2px 14px #f9731444"
        }}>{showForm ? "✕ Fermer" : "➕ Nouveau prospect"}</button>
        <button onClick={()=>exportProspectsCSV(filtered, salespeople)} style={{ padding:"12px 16px", borderRadius:12, fontSize:13, fontWeight:600, background:"rgba(255,255,255,0.06)", color:"#9ca3af", border:"1px solid rgba(255,255,255,0.1)" }}>⬇ CSV</button>
      </div>

      {/* Form */}
      {showForm && (
        <div id="prospect-form" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#9ca3af", marginBottom:14, textTransform:"uppercase", letterSpacing:1 }}>{editId?"✏️ Modifier le prospect":"➕ Nouveau prospect"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Nom *</div>
                <input style={inp} placeholder="Dupont" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Prénom</div>
                <input style={inp} placeholder="Jean" value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Adresse</div>
              <input style={inp} placeholder="12 rue de la Paix, Marseille" value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Téléphone</div>
                <input style={inp} type="tel" placeholder="06 00 00 00 00" value={form.tel} onChange={e=>setForm(f=>({...f,tel:e.target.value}))} />
              </div>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Email</div>
                <input style={inp} type="email" placeholder="jean@email.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Commercial</div>
                <div style={{ position:"relative" }}>
                  <select style={{ ...inp, paddingRight:30 }} value={form.salespersonId} onChange={e=>setForm(f=>({...f,salespersonId:e.target.value}))}>
                    <option value="">Choisir...</option>
                    {salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none", fontSize:11 }}>▼</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Statut</div>
                <div style={{ position:"relative" }}>
                  <select style={{ ...inp, paddingRight:30 }} value={form.statut} onChange={e=>setForm(f=>({...f,statut:e.target.value}))}>
                    {STATUTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none", fontSize:11 }}>▼</span>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:"#6b7280", marginBottom:5 }}>Observation</div>
              <textarea style={{ ...inp, minHeight:80, resize:"vertical" }} placeholder="Notes, remarques..." value={form.observation} onChange={e=>setForm(f=>({...f,observation:e.target.value}))} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={save} disabled={saving||!form.nom.trim()} style={{
                flex:1, padding:"13px", borderRadius:12, fontSize:15, fontWeight:600,
                background:form.nom.trim()?"linear-gradient(135deg,#f97316,#fb923c)":"rgba(255,255,255,0.06)",
                color:"#fff", border:"none", opacity:!form.nom.trim()?0.4:1
              }}>{saving?"⏳...":editId?"💾 Mettre à jour":"✅ Enregistrer"}</button>
              {editId && <button onClick={()=>{setEditId(null);setShowForm(false);setForm(EMPTY_FORM);}} style={{ padding:"13px 16px", borderRadius:12, fontSize:14, background:"rgba(255,255,255,0.06)", color:"#9ca3af", border:"1px solid rgba(255,255,255,0.1)" }}>Annuler</button>}
            </div>
          </div>
        </div>
      )}

      {/* Prospect detail modal */}
      {viewProspect && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"flex-end", padding:"0" }} onClick={()=>setViewProspect(null)}>
          <div style={{ background:"#111827", borderRadius:"20px 20px 0 0", padding:"20px 16px 40px", width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:40, height:4, background:"rgba(255,255,255,0.2)", borderRadius:2, margin:"0 auto 20px" }} />
            {(() => {
              const p = viewProspect;
              const sp = salespeople.find(s=>s.id===p.salespersonId);
              const statut = STATUTS.find(s=>s.key===p.statut) || STATUTS[0];
              return (
                <>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>{p.prenom} {p.nom}</div>
                      {sp && <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>👤 {sp.name}</div>}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>startEdit(p)} style={{ background:"rgba(249,115,22,0.1)", border:"1px solid rgba(249,115,22,0.2)", color:"#f97316", borderRadius:8, padding:"7px 12px", fontSize:13 }}>✎</button>
                      <button onClick={()=>del(p.id)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", color:"#ef4444", borderRadius:8, padding:"7px 12px", fontSize:13 }}>🗑</button>
                    </div>
                  </div>

                  {/* Statut selector */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, color:"#6b7280", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Statut</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {STATUTS.map(s => (
                        <button key={s.key} onClick={()=>updateStatut(p.id,s.key)} style={{
                          padding:"6px 12px", borderRadius:20, fontSize:12, fontWeight:600, border:"none",
                          background:p.statut===s.key?`${s.color}33`:"rgba(255,255,255,0.05)",
                          color:p.statut===s.key?s.color:"#6b7280",
                          border:p.statut===s.key?`1px solid ${s.color}55`:"1px solid transparent",
                        }}>{s.label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {p.adresse && (
                      <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"10px 14px" }}>
                        <div style={{ fontSize:10, color:"#6b7280", marginBottom:3 }}>📍 ADRESSE</div>
                        <div style={{ fontSize:14 }}>{p.adresse}</div>
                      </div>
                    )}
                    {p.tel && (
                      <a href={`tel:${p.tel}`} style={{ textDecoration:"none" }}>
                        <div style={{ background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:10, padding:"10px 14px" }}>
                          <div style={{ fontSize:10, color:"#38bdf8", marginBottom:3 }}>📞 TÉLÉPHONE</div>
                          <div style={{ fontSize:15, fontWeight:600, color:"#38bdf8" }}>{p.tel}</div>
                        </div>
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`} style={{ textDecoration:"none" }}>
                        <div style={{ background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:10, padding:"10px 14px" }}>
                          <div style={{ fontSize:10, color:"#a78bfa", marginBottom:3 }}>✉️ EMAIL</div>
                          <div style={{ fontSize:14, color:"#a78bfa" }}>{p.email}</div>
                        </div>
                      </a>
                    )}
                    {p.observation && (
                      <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"10px 14px" }}>
                        <div style={{ fontSize:10, color:"#6b7280", marginBottom:3 }}>📝 OBSERVATION</div>
                        <div style={{ fontSize:14, color:"#e2e8f0", lineHeight:1.5 }}>{p.observation}</div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Prospect list */}
      <div style={{ fontSize:12, color:"#6b7280", marginBottom:10 }}>{filtered.length} prospect{filtered.length!==1?"s":""} trouvé{filtered.length!==1?"s":""}</div>
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"50px 20px", color:"#374151" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>👥</div>
          <div>{search ? "Aucun résultat pour cette recherche." : "Aucun prospect enregistré."}</div>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map(p => {
          const sp = salespeople.find(s=>s.id===p.salespersonId);
          const statut = STATUTS.find(s=>s.key===p.statut) || STATUTS[0];
          return (
            <div key={p.id} onClick={()=>setViewProspect(p)} style={{
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:14, padding:"12px 14px", cursor:"pointer",
              borderLeft:`3px solid ${statut.color}`,
            }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${statut.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:statut.color, flexShrink:0 }}>
                    {(p.prenom||p.nom||"?").slice(0,1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15 }}>{p.prenom} {p.nom}</div>
                    {p.adresse && <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>📍 {p.adresse}</div>}
                  </div>
                </div>
                <span style={{ fontSize:11, background:`${statut.color}22`, color:statut.color, borderRadius:20, padding:"3px 10px", fontWeight:600, flexShrink:0 }}>{statut.label}</span>
              </div>
              <div style={{ display:"flex", gap:12, fontSize:12, color:"#6b7280", flexWrap:"wrap" }}>
                {p.tel && <span>📞 {p.tel}</span>}
                {p.email && <span>✉️ {p.email}</span>}
                {sp && <span>👤 {sp.name}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
