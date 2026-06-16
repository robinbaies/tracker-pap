import { useState, useMemo } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { T, F_DISPLAY, F_MONO, STATUTS } from "./theme";

function exportProspectsCSV(prospects, salespeople) {
  const rows = [["Nom","Prénom","Adresse","Téléphone","Email","Statut","Commercial","Observation"]];
  prospects.forEach(p => {
    const sp = salespeople.find(s => s.id === p.salespersonId);
    const st = STATUTS.find(s => s.key === p.statut);
    rows.push([p.nom||"", p.prenom||"", p.adresse||"", p.tel||"", p.email||"", st?.label||"", sp?.name||"", p.observation||""]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "prospects.csv"; a.click();
  URL.revokeObjectURL(url);
}

const EMPTY = { nom:"", prenom:"", adresse:"", tel:"", email:"", observation:"", statut:"nouveau", salespersonId:"" };

export default function ProspectsTab({ prospects, salespeople, currentUser }) {
  const myId = currentUser?.role === "commercial" ? (salespeople.find(s=>s.name===currentUser.name)?.id||"") : "";
  const [form, setForm] = useState({ ...EMPTY, salespersonId: myId });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSp, setFilterSp] = useState("all");
  const [filterStatut, setFilterStatut] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState(null);

  const filtered = useMemo(() => prospects.filter(p => {
    const q = search.toLowerCase();
    const ms = !q || (p.nom||"").toLowerCase().includes(q) || (p.prenom||"").toLowerCase().includes(q) || (p.adresse||"").toLowerCase().includes(q) || (p.tel||"").includes(q);
    return ms && (filterSp==="all"||p.salespersonId===filterSp) && (filterStatut==="all"||p.statut===filterStatut);
  }).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)), [prospects, search, filterSp, filterStatut]);

  const inp = { background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:11, padding:"12px 14px", color:T.ink, fontSize:16, fontFamily:F_DISPLAY, width:"100%", WebkitAppearance:"none" };

  const save = async () => {
    if (!form.nom.trim()) return;
    setSaving(true);
    const data = { ...form, nom:form.nom.trim(), prenom:form.prenom.trim(), updatedAt: Date.now() };
    if (editId) await updateDoc(doc(db,"prospects",editId), data);
    else await addDoc(collection(db,"prospects"), { ...data, createdAt: Date.now() });
    setEditId(null); setForm({ ...EMPTY, salespersonId: myId }); setShowForm(false); setSaving(false);
  };
  const startEdit = (p) => { setForm({ nom:p.nom||"", prenom:p.prenom||"", adresse:p.adresse||"", tel:p.tel||"", email:p.email||"", observation:p.observation||"", statut:p.statut||"nouveau", salespersonId:p.salespersonId||"" }); setEditId(p.id); setShowForm(true); setView(null); };
  const del = async (id) => { await deleteDoc(doc(db,"prospects",id)); setView(null); };
  const setStatut = async (id, statut) => { await updateDoc(doc(db,"prospects",id),{statut}); if(view?.id===id) setView(p=>({...p,statut})); };

  const counts = useMemo(() => { const m={}; STATUTS.forEach(s=>m[s.key]=0); prospects.forEach(p=>{if(m[p.statut]!==undefined)m[p.statut]++;}); return m; }, [prospects]);

  return (
    <div>
      {/* Statut pills */}
      <div style={{ display:"flex", gap:7, overflowX:"auto", marginBottom:16, paddingBottom:4 }}>
        {STATUTS.map(s => (
          <button key={s.key} onClick={()=>setFilterStatut(filterStatut===s.key?"all":s.key)} style={{
            flexShrink:0, background:filterStatut===s.key?`${s.color}22`:T.bgCard,
            border:`1px solid ${filterStatut===s.key?s.color:T.line}`, borderRadius:12, padding:"8px 12px",
            display:"flex", alignItems:"center", gap:7, cursor:"pointer",
          }}>
            <span style={{ fontSize:17, fontWeight:700, color:s.color, fontFamily:F_MONO }}>{counts[s.key]||0}</span>
            <span style={{ fontSize:10, color:filterStatut===s.key?s.color:T.inkFaint, fontWeight:600, fontFamily:F_MONO, letterSpacing:0.5 }}>{s.short}</span>
          </button>
        ))}
      </div>

      <input style={{ ...inp, marginBottom:8 }} placeholder="⌕  Rechercher nom, ville, téléphone..." value={search} onChange={e=>setSearch(e.target.value)} />
      <div style={{ position:"relative", marginBottom:16 }}>
        <select style={{ ...inp, paddingRight:30, fontSize:13 }} value={filterSp} onChange={e=>setFilterSp(e.target.value)}>
          <option value="all">Tous les commerciaux</option>
          {salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:T.inkFaint, pointerEvents:"none", fontSize:11 }}>▼</span>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>{ setShowForm(!showForm); setEditId(null); setForm({...EMPTY, salespersonId:myId}); }} style={{
          flex:1, padding:"13px", borderRadius:13, fontSize:14, fontWeight:700, fontFamily:F_DISPLAY,
          background:showForm?T.bgCard:T.gradLime, color:showForm?T.inkSoft:T.bg, border:showForm?`1px solid ${T.line}`:"none",
          boxShadow:showForm?"none":`0 4px 16px ${T.lime}44`,
        }}>{showForm ? "✕  Fermer" : "＋  Nouveau prospect"}</button>
        <button onClick={()=>exportProspectsCSV(filtered, salespeople)} style={{ padding:"13px 16px", borderRadius:13, fontSize:13, fontWeight:600, background:T.bgCard, color:T.inkSoft, border:`1px solid ${T.line}`, fontFamily:F_MONO }}>↓ CSV</button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:18, padding:18, marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:T.lime, marginBottom:16, fontFamily:F_MONO, letterSpacing:1.5 }}>{editId?"◆ MODIFIER LE PROSPECT":"◆ NOUVEAU PROSPECT"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Nom *"><input style={inp} placeholder="Dupont" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))} /></Field>
              <Field label="Prénom"><input style={inp} placeholder="Jean" value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))} /></Field>
            </div>
            <Field label="Adresse"><input style={inp} placeholder="12 rue de la Paix, Marseille" value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))} /></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Téléphone"><input style={inp} type="tel" placeholder="06 00 00 00 00" value={form.tel} onChange={e=>setForm(f=>({...f,tel:e.target.value}))} /></Field>
              <Field label="Email"><input style={inp} type="email" placeholder="jean@email.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="Commercial">
                <div style={{ position:"relative" }}>
                  <select style={{ ...inp, paddingRight:30 }} value={form.salespersonId} onChange={e=>setForm(f=>({...f,salespersonId:e.target.value}))}>
                    <option value="">Choisir...</option>
                    {salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:T.inkFaint, pointerEvents:"none", fontSize:11 }}>▼</span>
                </div>
              </Field>
              <Field label="Statut">
                <div style={{ position:"relative" }}>
                  <select style={{ ...inp, paddingRight:30 }} value={form.statut} onChange={e=>setForm(f=>({...f,statut:e.target.value}))}>
                    {STATUTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:T.inkFaint, pointerEvents:"none", fontSize:11 }}>▼</span>
                </div>
              </Field>
            </div>
            <Field label="Observation"><textarea style={{ ...inp, minHeight:80, resize:"vertical" }} placeholder="Notes, remarques, contexte..." value={form.observation} onChange={e=>setForm(f=>({...f,observation:e.target.value}))} /></Field>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={save} disabled={saving||!form.nom.trim()} style={{ flex:1, padding:"13px", borderRadius:12, fontSize:15, fontWeight:700, fontFamily:F_DISPLAY, background:form.nom.trim()?T.gradLime:T.bgCardHi, color:form.nom.trim()?T.bg:T.inkFaint, border:"none", opacity:!form.nom.trim()?0.5:1 }}>{saving?"…":editId?"Mettre à jour":"Enregistrer"}</button>
              {editId && <button onClick={()=>{setEditId(null);setShowForm(false);setForm(EMPTY);}} style={{ padding:"13px 16px", borderRadius:12, fontSize:14, background:T.bgCard, color:T.inkSoft, border:`1px solid ${T.line}` }}>Annuler</button>}
            </div>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      {view && (
        <div style={{ position:"fixed", inset:0, background:"rgba(7,11,20,0.85)", zIndex:200, display:"flex", alignItems:"flex-end", backdropFilter:"blur(4px)" }} onClick={()=>setView(null)}>
          <div style={{ background:T.bgSoft, borderRadius:"24px 24px 0 0", padding:"16px 18px 40px", width:"100%", maxHeight:"88vh", overflowY:"auto", border:`1px solid ${T.line}`, borderBottom:"none" }} onClick={e=>e.stopPropagation()}>
            <div style={{ width:44, height:4, background:T.line, borderRadius:2, margin:"0 auto 22px" }} />
            {(() => {
              const p = view, sp = salespeople.find(s=>s.id===p.salespersonId), st = STATUTS.find(s=>s.key===p.statut)||STATUTS[0];
              return (
                <>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:52, height:52, borderRadius:15, background:`${st.color}22`, border:`1.5px solid ${st.color}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:st.color, fontFamily:F_DISPLAY, flexShrink:0 }}>{(p.prenom||p.nom||"?").slice(0,1).toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize:21, fontWeight:700, fontFamily:F_DISPLAY, lineHeight:1.1 }}>{p.prenom} {p.nom}</div>
                        {sp && <div style={{ fontSize:12, color:T.inkFaint, marginTop:3, fontFamily:F_MONO }}>◈ {sp.name}</div>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>startEdit(p)} style={{ background:`${T.lime}1A`, border:`1px solid ${T.lime}33`, color:T.lime, borderRadius:10, padding:"8px 13px", fontSize:14 }}>✎</button>
                      <button onClick={()=>del(p.id)} style={{ background:`${T.rose}1A`, border:`1px solid ${T.rose}33`, color:T.rose, borderRadius:10, padding:"8px 13px", fontSize:14 }}>🗑</button>
                    </div>
                  </div>

                  <div style={{ fontSize:10, color:T.inkFaint, marginBottom:9, fontFamily:F_MONO, letterSpacing:1.5 }}>STATUT</div>
                  <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:20 }}>
                    {STATUTS.map(s => (
                      <button key={s.key} onClick={()=>setStatut(p.id,s.key)} style={{
                        padding:"8px 14px", borderRadius:20, fontSize:12, fontWeight:600, fontFamily:F_DISPLAY,
                        background:p.statut===s.key?`${s.color}26`:T.bgCard, color:p.statut===s.key?s.color:T.inkFaint,
                        border:p.statut===s.key?`1px solid ${s.color}66`:`1px solid ${T.line}`,
                      }}>{s.icon} {s.label}</button>
                    ))}
                  </div>

                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {p.adresse && <InfoBlock label="ADRESSE" icon="⌖" color={T.inkSoft}>{p.adresse}</InfoBlock>}
                    {p.tel && <a href={`tel:${p.tel}`} style={{ textDecoration:"none" }}><InfoBlock label="APPELER" icon="☏" color={T.cyan} accent>{p.tel}</InfoBlock></a>}
                    {p.email && <a href={`mailto:${p.email}`} style={{ textDecoration:"none" }}><InfoBlock label="EMAIL" icon="✉" color={T.violet} accent>{p.email}</InfoBlock></a>}
                    {p.observation && <InfoBlock label="OBSERVATION" icon="✱" color={T.inkSoft}>{p.observation}</InfoBlock>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ fontSize:11, color:T.inkFaint, marginBottom:10, fontFamily:F_MONO }}>{filtered.length} PROSPECT{filtered.length!==1?"S":""}</div>
      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"50px 20px", color:T.inkGhost }}>
          <div style={{ fontSize:40, marginBottom:10 }}>⌖</div>
          <div style={{ color:T.inkFaint }}>{search ? "Aucun résultat." : "Aucun prospect. Commencez la prospection."}</div>
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map(p => {
          const sp = salespeople.find(s=>s.id===p.salespersonId), st = STATUTS.find(s=>s.key===p.statut)||STATUTS[0];
          return (
            <div key={p.id} onClick={()=>setView(p)} style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderLeft:`3px solid ${st.color}`, borderRadius:14, padding:"13px 15px", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:p.tel||p.email||sp?7:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background:`${st.color}1A`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, color:st.color, fontFamily:F_DISPLAY, flexShrink:0 }}>{(p.prenom||p.nom||"?").slice(0,1).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:15, fontFamily:F_DISPLAY }}>{p.prenom} {p.nom}</div>
                    {p.adresse && <div style={{ fontSize:11, color:T.inkFaint, marginTop:1 }}>⌖ {p.adresse}</div>}
                  </div>
                </div>
                <span style={{ fontSize:10, background:`${st.color}1A`, color:st.color, borderRadius:8, padding:"4px 9px", fontWeight:700, flexShrink:0, fontFamily:F_MONO, letterSpacing:0.5 }}>{st.short}</span>
              </div>
              {(p.tel||p.email||sp) && (
                <div style={{ display:"flex", gap:12, fontSize:11, color:T.inkFaint, flexWrap:"wrap", paddingLeft:49, fontFamily:F_MONO }}>
                  {p.tel && <span>☏ {p.tel}</span>}
                  {sp && <span>◈ {sp.name}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><div style={{ fontSize:11, color:T.inkFaint, marginBottom:6, fontFamily:F_MONO, letterSpacing:0.5 }}>{label}</div>{children}</div>;
}
function InfoBlock({ label, icon, color, accent, children }) {
  return (
    <div style={{ background:accent?`${color}12`:T.bgCard, border:`1px solid ${accent?color+"33":T.line}`, borderRadius:12, padding:"11px 15px" }}>
      <div style={{ fontSize:10, color:accent?color:T.inkFaint, marginBottom:3, fontFamily:F_MONO, letterSpacing:1 }}>{icon} {label}</div>
      <div style={{ fontSize:15, fontWeight:accent?600:400, color:accent?color:T.ink, lineHeight:1.5 }}>{children}</div>
    </div>
  );
}
