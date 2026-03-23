import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import ChatTab from "./ChatTab";
import ProspectsTab from "./ProspectsTab";

const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
const todayStr = () => new Date().toISOString().slice(0, 10);
const dateLabel = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

const COLORS = { contacts: "#38bdf8", rdv: "#a78bfa", ca: "#f97316", conv: "#34d399" };
const ZONE_PALETTE = ["#38bdf8","#a78bfa","#34d399","#f97316","#f43f5e","#facc15","#60a5fa","#fb7185","#4ade80","#e879f9"];
const MEDALS = ["🥇","🥈","🥉"];
const TABS = ["dashboard","saisie","prospects","zones","graphiques","classement","chat"];
const TAB_ICONS = { dashboard:"📋", saisie:"✏️", prospects:"👥", zones:"📍", graphiques:"📊", classement:"🏆", chat:"💬" };
const TAB_LABELS = { dashboard:"Dashboard", saisie:"Saisie", prospects:"Prospects", zones:"Zones", graphiques:"Graphiques", classement:"Classement", chat:"Chat" };

function exportCSV(salespeople, zones, entries, period) {
  const filtered = entries.filter(e => {
    if (period.type === "day") return e.date === period.date;
    if (period.type === "range") return e.date >= period.from && e.date <= period.to;
    return true;
  });
  const rows = [["Commercial","Zone","Date","Contacts","RDV","CA (EUR)"]];
  filtered.forEach(e => {
    const sp = salespeople.find(s => s.id === e.salespersonId);
    const z = zones.find(z => z.id === e.zoneId);
    if (sp) rows.push([sp.name, z ? z.name : "—", e.date, e.contacts, e.rdv, e.ca]);
  });
  const csv = rows.map(r => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "tracker-pap.csv"; a.click();
  URL.revokeObjectURL(url);
}

function ProgBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100,(value/max)*100) : 0;
  return (
    <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:4, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:4, transition:"width .5s" }} />
    </div>
  );
}

function ZoneBadge({ zone }) {
  if (!zone) return null;
  return (
    <span style={{ fontSize:11, background:`${zone.color}22`, border:`1px solid ${zone.color}55`, color:zone.color, borderRadius:20, padding:"2px 8px", fontWeight:600, whiteSpace:"nowrap" }}>
      📍 {zone.name}
    </span>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16, background:"#080b12" }}>
      <div style={{ width:40, height:40, border:"3px solid rgba(249,115,22,0.2)", borderTop:"3px solid #f97316", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <div style={{ color:"#6b7280", fontSize:13 }}>Connexion...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function IdentityScreen({ salespeople, onSelect }) {
  const [role, setRole] = useState("commercial");
  const [selectedId, setSelectedId] = useState("");
  const inp = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"13px 14px", color:"#fff", fontSize:16, fontFamily:"inherit", width:"100%", WebkitAppearance:"none" };

  const confirm = () => {
    if (role === "manager") { onSelect({ name:"Manager", role:"manager" }); return; }
    const sp = salespeople.find(s => s.id === selectedId);
    if (!sp) return;
    onSelect({ name: sp.name, role:"commercial" });
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080b12", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing:border-box; }
        input,select,button { outline:none; font-family:inherit; }
        button { cursor:pointer; border:none; }
      `}</style>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#f97316,#fb923c)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, margin:"0 auto 16px", boxShadow:"0 6px 24px #f9731555" }}>🚪</div>
          <div style={{ fontSize:24, fontWeight:800, fontFamily:"'Syne',sans-serif", color:"#fff" }}>Tracker PAP</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:6 }}>Identifie-toi pour continuer</div>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          {[["commercial","👤 Commercial"],["manager","👑 Manager"]].map(([r,l]) => (
            <button key={r} onClick={() => setRole(r)} style={{
              flex:1, padding:"12px", borderRadius:12, fontSize:14, fontWeight:600,
              background:role===r?"linear-gradient(135deg,#f97316,#fb923c)":"rgba(255,255,255,0.06)",
              border:role===r?"none":"1px solid rgba(255,255,255,0.1)",
              color:role===r?"#fff":"#9ca3af",
              boxShadow:role===r?"0 2px 14px #f9731444":"none",
            }}>{l}</button>
          ))}
        </div>

        {role === "commercial" && (
          <div style={{ marginBottom:20, position:"relative" }}>
            <select style={{ ...inp, paddingRight:36 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">Choisir ton nom...</option>
              {salespeople.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none" }}>▼</span>
          </div>
        )}

        {role === "manager" && (
          <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:13, color:"#fb923c" }}>
            👑 Accès manager — vue complète de l'équipe
          </div>
        )}

        <button onClick={confirm} disabled={role==="commercial" && !selectedId} style={{
          width:"100%", padding:"14px", borderRadius:14, fontSize:16, fontWeight:700,
          background:(role==="manager"||selectedId)?"linear-gradient(135deg,#f97316,#fb923c)":"rgba(255,255,255,0.06)",
          color:"#fff", border:"none",
          boxShadow:(role==="manager"||selectedId)?"0 4px 20px #f9731444":"none",
          opacity:(role==="commercial"&&!selectedId)?0.4:1,
          cursor:(role==="commercial"&&!selectedId)?"not-allowed":"pointer",
        }}>Continuer →</button>
      </div>
    </div>
  );
}

export default function App() {
  const [salespeople, setSalespeople] = useState([]);
  const [entries, setEntries] = useState([]);
  const [zones, setZones] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    try { const u = localStorage.getItem("pap_user_v2"); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [tab, setTab] = useState("dashboard");
  const [period, setPeriod] = useState({ type:"all", date:todayStr(), from:todayStr(), to:todayStr() });
  const [newName, setNewName] = useState("");
  const [newZone, setNewZone] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ salespersonId:"", zoneId:"", date:todayStr(), contacts:0, rdv:0, ca:0 });
  const [editId, setEditId] = useState(null);
  const [filterZone, setFilterZone] = useState("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let loaded = 0;
    const check = () => { loaded++; if (loaded >= 3) setLoading(false); };
    const u1 = onSnapshot(collection(db, "salespeople"), s => { setSalespeople(s.docs.map(d => ({ id:d.id, ...d.data() }))); check(); });
    const u2 = onSnapshot(collection(db, "entries"), s => { setEntries(s.docs.map(d => ({ id:d.id, ...d.data() }))); check(); });
    const u3 = onSnapshot(collection(db, "zones"), s => { setZones(s.docs.map(d => ({ id:d.id, ...d.data() }))); check(); });
    const u4 = onSnapshot(collection(db, "prospects"), s => { setProspects(s.docs.map(d => ({ id:d.id, ...d.data() }))); });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const selectUser = (user) => { setCurrentUser(user); localStorage.setItem("pap_user_v2", JSON.stringify(user)); };
  const logout = () => { setCurrentUser(null); localStorage.removeItem("pap_user_v2"); setTab("dashboard"); };

  const filtered = useMemo(() => entries.filter(e => {
    const inP = period.type==="day" ? e.date===period.date : period.type==="range" ? (e.date>=period.from && e.date<=period.to) : true;
    return inP && (filterZone==="all" ? true : e.zoneId===filterZone);
  }), [entries, period, filterZone]);

  const statsBySp = useMemo(() => {
    const m = {};
    salespeople.forEach(s => { m[s.id] = { contacts:0, rdv:0, ca:0 }; });
    filtered.forEach(e => {
      if (!m[e.salespersonId]) m[e.salespersonId] = { contacts:0, rdv:0, ca:0 };
      m[e.salespersonId].contacts += e.contacts; m[e.salespersonId].rdv += e.rdv; m[e.salespersonId].ca += e.ca;
    });
    return m;
  }, [filtered, salespeople]);

  const statsByZone = useMemo(() => {
    const m = {};
    zones.forEach(z => { m[z.id] = { contacts:0, rdv:0, ca:0 }; });
    filtered.forEach(e => {
      if (!e.zoneId) return;
      if (!m[e.zoneId]) m[e.zoneId] = { contacts:0, rdv:0, ca:0 };
      m[e.zoneId].contacts += e.contacts; m[e.zoneId].rdv += e.rdv; m[e.zoneId].ca += e.ca;
    });
    return m;
  }, [filtered, zones]);

  const totals = useMemo(() => Object.values(statsBySp).reduce((a,s) => ({ contacts:a.contacts+s.contacts, rdv:a.rdv+s.rdv, ca:a.ca+s.ca }), { contacts:0, rdv:0, ca:0 }), [statsBySp]);
  const ranked = useMemo(() => [...salespeople].sort((a,b) => { const sa=statsBySp[a.id]||{ca:0,rdv:0}; const sb=statsBySp[b.id]||{ca:0,rdv:0}; return sb.ca-sa.ca||sb.rdv-sa.rdv; }), [salespeople, statsBySp]);
  const chartData = useMemo(() => {
    const bd = {};
    entries.forEach(e => {
      if (filterZone!=="all" && e.zoneId!==filterZone) return;
      if (!bd[e.date]) bd[e.date] = { date:e.date, contacts:0, rdv:0, ca:0 };
      bd[e.date].contacts+=e.contacts; bd[e.date].rdv+=e.rdv; bd[e.date].ca+=e.ca;
    });
    return Object.values(bd).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({...d,label:dateLabel(d.date)}));
  }, [entries, filterZone]);
  const spChartData = useMemo(() => salespeople.map(sp=>({name:sp.name,ca:(statsBySp[sp.id]||{}).ca||0,rdv:(statsBySp[sp.id]||{}).rdv||0})),[salespeople,statsBySp]);
  const zoneChartData = useMemo(() => zones.map(z=>({name:z.name,ca:(statsByZone[z.id]||{}).ca||0,contacts:(statsByZone[z.id]||{}).contacts||0,color:z.color})),[zones,statsByZone]);
  const distinctDays = [...new Set(filtered.map(e=>e.date))].length;

  const addSP = async () => { const n=newName.trim(); if(!n||salespeople.find(s=>s.name.toLowerCase()===n.toLowerCase())) return; setSaving(true); await addDoc(collection(db,"salespeople"),{name:n,target_contacts:0,target_rdv:0,target_ca:0}); setNewName(""); setSaving(false); };
  const delSP = async (id) => { await deleteDoc(doc(db,"salespeople",id)); await Promise.all(entries.filter(e=>e.salespersonId===id).map(e=>deleteDoc(doc(db,"entries",e.id)))); };
  const updTarget = async (id,field,val) => { await updateDoc(doc(db,"salespeople",id),{[field]:parseFloat(val)||0}); };
  const addZone = async () => { const n=newZone.trim(); if(!n||zones.find(z=>z.name.toLowerCase()===n.toLowerCase())) return; setSaving(true); await addDoc(collection(db,"zones"),{name:n,color:ZONE_PALETTE[zones.length%ZONE_PALETTE.length]}); setNewZone(""); setSaving(false); };
  const delZone = async (id) => { await deleteDoc(doc(db,"zones",id)); await Promise.all(entries.filter(e=>e.zoneId===id).map(e=>updateDoc(doc(db,"entries",e.id),{zoneId:""}))); };
  const updateZoneColor = async (id,color) => { await updateDoc(doc(db,"zones",id),{color}); };
  const saveEntry = async () => {
    if (!form.salespersonId||!form.date) return;
    setSaving(true);
    const entry={salespersonId:form.salespersonId,zoneId:form.zoneId||"",date:form.date,contacts:+form.contacts,rdv:+form.rdv,ca:+form.ca};
    if (editId) { await updateDoc(doc(db,"entries",editId),entry); } else { await addDoc(collection(db,"entries"),entry); }
    setEditId(null); setForm({salespersonId:"",zoneId:"",date:todayStr(),contacts:0,rdv:0,ca:0}); setSaving(false);
  };
  const startEdit = (e) => { setForm({salespersonId:e.salespersonId,zoneId:e.zoneId||"",date:e.date,contacts:e.contacts,rdv:e.rdv,ca:e.ca}); setEditId(e.id); setTab("saisie"); };
  const delEntry = async (id) => { await deleteDoc(doc(db,"entries",id)); };

  const inp = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:16, fontFamily:"inherit", width:"100%", WebkitAppearance:"none" };
  const tt = { contentStyle:{ background:"#1f2937", border:"1px solid #374151", borderRadius:8, color:"#fff", fontSize:11 } };

  if (loading) return <Spinner />;
  if (!currentUser) return <IdentityScreen salespeople={salespeople} onSelect={selectUser} />;

  return (
    <div style={{ minHeight:"100vh", background:"#080b12", color:"#e2e8f0", fontFamily:"'DM Sans',sans-serif", paddingBottom:80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        input,select,button,textarea{outline:none;font-family:inherit;}
        button{cursor:pointer;border:none;}
        body{margin:0;overscroll-behavior-y:none;}
        ::-webkit-scrollbar{width:0;}
        select{-webkit-appearance:none;appearance:none;}
        .inp-focus:focus{border-color:#f97316aa!important;}
        .hov-del:active{background:rgba(239,68,68,0.3)!important;}
        .hov-row:active{background:rgba(255,255,255,0.06)!important;}
        .btn-p{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;border-radius:12px;font-size:15px;font-weight:600;box-shadow:0 2px 14px #f9731444;transition:all .15s;padding:13px 20px;}
        .btn-p:active{transform:scale(0.97);}
        .btn-p:disabled{opacity:0.5;}
        @keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .up{animation:up .25s ease both;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#0f1420;border-top:1px solid rgba(255,255,255,0.08);display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom);}
        .nav-item{flex:1;display:flex;flex-direction:column;align-items:center;padding:10px 4px 8px;gap:3px;background:none;border:none;color:#6b7280;font-size:10px;font-family:inherit;cursor:pointer;transition:color .2s;}
        .nav-item.active{color:#f97316;}
        .nav-item-icon{font-size:20px;line-height:1;}
        .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:16px;margin-bottom:12px;}
        input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=color]{padding:2px;border-radius:8px;cursor:pointer;}
      `}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(180deg,#111827,#080b12)", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"12px 16px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#f97316,#fb923c)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🚪</div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, fontFamily:"'Syne',sans-serif", lineHeight:1.2 }}>Tracker PAP</div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#34d399" }} />
                <span style={{ fontSize:10, color:"#34d399" }}>Temps réel</span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.06)", borderRadius:20, padding:"4px 10px 4px 6px" }}>
              <div style={{ width:22, height:22, borderRadius:6, background:currentUser.role==="manager"?"rgba(249,115,22,0.3)":"rgba(56,189,248,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:currentUser.role==="manager"?"#f97316":"#38bdf8" }}>
                {currentUser.name.slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:11, color:"#e2e8f0", fontWeight:600 }}>{currentUser.name}{currentUser.role==="manager"&&" 👑"}</span>
            </div>
            <button onClick={logout} style={{ background:"rgba(255,255,255,0.06)", borderRadius:8, padding:"6px 9px", color:"#6b7280", fontSize:13 }}>⏻</button>
          </div>
        </div>

        {tab !== "chat" && (
          <>
            <div style={{ display:"flex", gap:4, marginTop:10, alignItems:"center" }}>
              {[["all","Tout"],["day","Jour"],["range","Période"]].map(([t,l]) => (
                <button key={t} onClick={()=>setPeriod(p=>({...p,type:t}))} style={{ padding:"5px 12px", borderRadius:16, fontSize:11, fontWeight:600, border:"none", background:period.type===t?"linear-gradient(135deg,#f97316,#fb923c)":"rgba(255,255,255,0.07)", color:period.type===t?"#fff":"#9ca3af" }}>{l}</button>
              ))}
              {zones.length>0 && (
                <div style={{ marginLeft:"auto", position:"relative" }}>
                  <select value={filterZone} onChange={e=>setFilterZone(e.target.value)} style={{ background:"rgba(255,255,255,0.07)", border:"none", borderRadius:16, color:"#9ca3af", padding:"5px 24px 5px 10px", fontSize:11, fontWeight:600 }}>
                    <option value="all">📍 Toutes</option>
                    {zones.map(z=><option key={z.id} value={z.id}>📍 {z.name}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color:"#6b7280", pointerEvents:"none", fontSize:10 }}>▼</span>
                </div>
              )}
            </div>
            {period.type==="day" && <div style={{marginTop:8}}><input type="date" value={period.date} onChange={e=>setPeriod(p=>({...p,date:e.target.value}))} style={{...inp,fontSize:14,padding:"8px 12px"}}/></div>}
            {period.type==="range" && (
              <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                <input type="date" value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} style={{...inp,fontSize:13,padding:"8px 10px",flex:1}}/>
                <span style={{color:"#6b7280",fontSize:14,flexShrink:0}}>→</span>
                <input type="date" value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} style={{...inp,fontSize:13,padding:"8px 10px",flex:1}}/>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding:"16px 14px", maxWidth:640, margin:"0 auto" }}>

        {/* DASHBOARD */}
        {tab==="dashboard" && (
          <div className="up">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Contacts",value:totals.contacts,icon:"📞",color:COLORS.contacts,sub:`${salespeople.length} commerciaux`},
                {label:"Rendez-vous",value:totals.rdv,icon:"📅",color:COLORS.rdv,sub:totals.contacts>0?`Conv. ${((totals.rdv/totals.contacts)*100).toFixed(1)}%`:"—"},
                {label:"Chiffre d'affaires",value:fmt(totals.ca),icon:"💶",color:COLORS.ca,sub:totals.rdv>0?`${fmt(totals.ca/totals.rdv)}/RDV`:"—"},
                {label:"Journées",value:filtered.length,icon:"📌",color:COLORS.conv,sub:`${distinctDays} jour${distinctDays!==1?"s":""} distinct${distinctDays!==1?"s":""}`},
              ].map(k=>(
                <div key={k.label} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${k.color}28`,borderRadius:14,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                    <span style={{fontSize:14}}>{k.icon}</span>
                    <span style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.5,color:k.color,fontFamily:"monospace",lineHeight:1.2}}>{k.label}</span>
                  </div>
                  <div style={{fontSize:20,fontWeight:800,color:"#fff",lineHeight:1}}>{k.value}</div>
                  {k.sub&&<div style={{fontSize:10,color:"#6b7280",marginTop:3}}>{k.sub}</div>}
                </div>
              ))}
            </div>
            {zones.length>0&&(
              <div className="card" style={{marginBottom:16}}>
                <div style={{fontSize:12,color:"#6b7280",fontWeight:600,marginBottom:10}}>📍 ZONES</div>
                {zones.map(z=>{const zs=statsByZone[z.id]||{ca:0,rdv:0};return(
                  <div key={z.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:z.color,display:"inline-block",flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:600}}>{z.name}</span>
                    </div>
                    <div style={{display:"flex",gap:10,fontSize:12,color:"#9ca3af"}}>
                      <span>{zs.rdv} RDV</span>
                      <span style={{color:COLORS.ca,fontWeight:700}}>{fmt(zs.ca)}</span>
                    </div>
                  </div>
                );})}
              </div>
            )}
            {salespeople.length===0&&(
              <div style={{textAlign:"center",padding:"50px 20px",color:"#374151"}}>
                <div style={{fontSize:40,marginBottom:10}}>👤</div>
                <div style={{fontSize:14}}>Ajoutez des commerciaux dans <strong style={{color:"#f97316"}}>Saisie</strong></div>
              </div>
            )}
            {salespeople.map((sp,i)=>{
              const st=statsBySp[sp.id]||{contacts:0,rdv:0,ca:0};
              const conv=st.contacts>0?((st.rdv/st.contacts)*100).toFixed(0):0;
              const rank=ranked.findIndex(r=>r.id===sp.id);
              const spZones=[...new Set(filtered.filter(e=>e.salespersonId===sp.id&&e.zoneId).map(e=>e.zoneId))].map(id=>zones.find(z=>z.id===id)).filter(Boolean);
              return(
                <div key={sp.id} className="card up" style={{animationDelay:`${i*.05}s`}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                    <div style={{width:42,height:42,borderRadius:12,background:`hsl(${(i*47)%360},60%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff",flexShrink:0}}>{sp.name.slice(0,2).toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:16,fontFamily:"'Syne',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sp.name}</div>
                      <div style={{fontSize:11,color:"#6b7280"}}>{rank<3?MEDALS[rank]:`#${rank+1}`} · conv. {conv}%</div>
                    </div>
                  </div>
                  {spZones.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{spZones.map(z=><ZoneBadge key={z.id} zone={z}/>)}</div>}
                  {[{l:"Contacts",v:st.contacts,t:sp.target_contacts,c:COLORS.contacts,f:v=>v},{l:"RDV",v:st.rdv,t:sp.target_rdv,c:COLORS.rdv,f:v=>v},{l:"CA",v:st.ca,t:sp.target_ca,c:COLORS.ca,f:fmt}].map(m=>(
                    <div key={m.l} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <span style={{color:"#9ca3af"}}>{m.l}</span>
                        <span style={{fontWeight:700,color:m.c}}>{m.f(m.v)}{m.t>0&&<span style={{color:"#4b5563",fontWeight:400}}> / {m.f(m.t)}</span>}</span>
                      </div>
                      {m.t>0&&<ProgBar value={m.v} max={m.t} color={m.c}/>}
                    </div>
                  ))}
                </div>
              );
            })}
            <button className="btn-p" onClick={()=>exportCSV(salespeople,zones,entries,period)} style={{width:"100%",marginTop:8}}>⬇ Exporter CSV</button>
          </div>
        )}

        {/* SAISIE */}
        {tab==="saisie"&&(
          <div className="up">
            <div style={{fontSize:12,fontWeight:600,color:"#9ca3af",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Ajouter un commercial</div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <input className="inp-focus" style={inp} placeholder="Nom du commercial..." value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSP()}/>
              <button className="btn-p" onClick={addSP} disabled={saving} style={{flexShrink:0,padding:"12px 16px",fontSize:14}}>+</button>
            </div>
            {salespeople.length>0&&(
              <div style={{marginBottom:24}}>
                <div style={{fontSize:12,fontWeight:600,color:"#9ca3af",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Commerciaux & Objectifs</div>
                {salespeople.map((sp,i)=>(
                  <div key={sp.id} className="card">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:9,background:`hsl(${(i*47)%360},60%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff"}}>{sp.name.slice(0,2).toUpperCase()}</div>
                        <span style={{fontWeight:600,fontSize:15}}>{sp.name}</span>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setEditTarget(editTarget===sp.id?null:sp.id)} style={{background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.2)",color:"#f97316",borderRadius:8,padding:"6px 10px",fontSize:12}}>🎯</button>
                        <button className="hov-del" onClick={()=>delSP(sp.id)} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.15)",color:"#ef4444",borderRadius:8,padding:"6px 10px",fontSize:12}}>✕</button>
                      </div>
                    </div>
                    {editTarget===sp.id&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                        {[["target_contacts","Contacts",COLORS.contacts],["target_rdv","RDV",COLORS.rdv],["target_ca","CA €",COLORS.ca]].map(([f,l,c])=>(
                          <div key={f}>
                            <div style={{fontSize:10,color:c,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                            <input className="inp-focus" style={{...inp,padding:"8px 10px",fontSize:14}} type="number" min="0" value={sp[f]||""} placeholder="0" onChange={e=>updTarget(sp.id,f,e.target.value)}/>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{fontSize:12,fontWeight:600,color:"#9ca3af",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>{editId?"✏️ Modifier l'entrée":"➕ Nouvelle saisie"}</div>
            <div className="card">
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <div style={{fontSize:12,color:"#6b7280",marginBottom:6}}>Commercial</div>
                    <div style={{position:"relative"}}>
                      <select className="inp-focus" style={{...inp,paddingRight:30}} value={form.salespersonId} onChange={e=>setForm(f=>({...f,salespersonId:e.target.value}))}>
                        <option value="">Choisir...</option>
                        {salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#6b7280",pointerEvents:"none",fontSize:12}}>▼</span>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#6b7280",marginBottom:6}}>Zone 📍</div>
                    <div style={{position:"relative"}}>
                      <select className="inp-focus" style={{...inp,paddingRight:30}} value={form.zoneId} onChange={e=>setForm(f=>({...f,zoneId:e.target.value}))}>
                        <option value="">Sans zone</option>
                        {zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                      <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#6b7280",pointerEvents:"none",fontSize:12}}>▼</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:12,color:"#6b7280",marginBottom:6}}>Date</div>
                  <input className="inp-focus" style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
                </div>
                {[["contacts","Contacts 📞",COLORS.contacts],["rdv","RDV 📅",COLORS.rdv],["ca","CA (€) 💶",COLORS.ca]].map(([field,label,color])=>(
                  <div key={field}>
                    <div style={{fontSize:12,color,marginBottom:8}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <button onClick={()=>setForm(f=>({...f,[field]:Math.max(0,+f[field]-(field==="ca"?100:1))}))} style={{width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.07)",color:"#fff",fontSize:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                      <input className="inp-focus" style={{...inp,textAlign:"center",fontWeight:700,fontSize:18,flex:1}} type="number" min="0" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/>
                      <button onClick={()=>setForm(f=>({...f,[field]:+f[field]+(field==="ca"?100:1)}))} style={{width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.07)",color:"#fff",fontSize:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <button className="btn-p" onClick={saveEntry} disabled={saving} style={{flex:1}}>{saving?"⏳...":editId?"💾 Mettre à jour":"✅ Enregistrer"}</button>
                  {editId&&<button onClick={()=>{setEditId(null);setForm({salespersonId:"",zoneId:"",date:todayStr(),contacts:0,rdv:0,ca:0});}} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"#9ca3af",borderRadius:12,padding:"13px 16px",fontSize:14}}>Annuler</button>}
                </div>
              </div>
            </div>
            <div style={{fontSize:12,color:"#6b7280",margin:"20px 0 10px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Dernières entrées</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(e=>{
                const sp=salespeople.find(s=>s.id===e.salespersonId);
                const z=zones.find(z=>z.id===e.zoneId);
                if(!sp) return null;
                return(
                  <div key={e.id} className="card hov-row" style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontWeight:600,fontSize:14}}>{sp.name}</span>
                        <span style={{fontSize:11,color:"#6b7280"}}>{dateLabel(e.date)}</span>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>startEdit(e)} style={{background:"rgba(249,115,22,0.1)",border:"none",color:"#f97316",borderRadius:8,padding:"6px 10px",fontSize:13}}>✎</button>
                        <button className="hov-del" onClick={()=>delEntry(e.id)} style={{background:"rgba(239,68,68,0.08)",border:"none",color:"#ef4444",borderRadius:8,padding:"6px 10px",fontSize:13}}>✕</button>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:12,fontSize:12,color:"#9ca3af",flexWrap:"wrap",alignItems:"center"}}>
                      <span>📞 {e.contacts}</span><span>📅 {e.rdv}</span>
                      <span style={{color:COLORS.ca,fontWeight:700}}>{fmt(e.ca)}</span>
                      {z&&<ZoneBadge zone={z}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ZONES */}
        {tab==="zones"&&(
          <div className="up">
            <div style={{fontSize:12,color:"#6b7280",marginBottom:14}}>Créez vos secteurs géographiques.</div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <input className="inp-focus" style={inp} placeholder="Ex: Marseille Nord..." value={newZone} onChange={e=>setNewZone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addZone()}/>
              <button className="btn-p" onClick={addZone} disabled={saving} style={{flexShrink:0,padding:"12px 16px",fontSize:14}}>+</button>
            </div>
            {zones.length===0&&<div style={{textAlign:"center",padding:"50px 20px",color:"#374151"}}><div style={{fontSize:40,marginBottom:10}}>📍</div><div>Aucune zone créée.</div></div>}
            {zones.map((z,i)=>{
              const zs=statsByZone[z.id]||{contacts:0,rdv:0,ca:0};
              const conv=zs.contacts>0?((zs.rdv/zs.contacts)*100).toFixed(0):0;
              const spInZone=[...new Set(filtered.filter(e=>e.zoneId===z.id).map(e=>e.salespersonId))].map(id=>salespeople.find(s=>s.id===id)).filter(Boolean);
              return(
                <div key={z.id} className="card up" style={{border:`1px solid ${z.color}33`,animationDelay:`${i*.05}s`}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:38,height:38,borderRadius:10,background:`${z.color}22`,border:`2px solid ${z.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📍</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,color:z.color}}>{z.name}</div>
                        <div style={{fontSize:11,color:"#6b7280"}}>conv. {conv}%</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input type="color" value={z.color} onChange={e=>updateZoneColor(z.id,e.target.value)} style={{width:32,height:32,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8}}/>
                      <button className="hov-del" onClick={()=>delZone(z.id)} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.15)",color:"#ef4444",borderRadius:8,padding:"6px 10px",fontSize:13}}>✕</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    {[{l:"Contacts",v:zs.contacts,c:COLORS.contacts},{l:"RDV",v:zs.rdv,c:COLORS.rdv},{l:"CA",v:fmt(zs.ca),c:COLORS.ca}].map(m=>(
                      <div key={m.l} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                        <div style={{fontSize:16,fontWeight:800,color:m.c}}>{m.v}</div>
                        <div style={{fontSize:10,color:"#6b7280"}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                  {spInZone.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{spInZone.map((sp,si)=><span key={sp.id} style={{fontSize:11,background:`hsl(${(si*47)%360},60%,20%)`,border:`1px solid hsl(${(si*47)%360},60%,35%)`,color:`hsl(${(si*47)%360},80%,70%)`,borderRadius:20,padding:"3px 10px"}}>{sp.name}</span>)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* GRAPHIQUES */}
        {tab==="graphiques"&&(
          <div className="up">
            {chartData.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px",color:"#374151"}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div>Saisissez des entrées pour voir les graphiques.</div></div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {[
                  {title:"Contacts & RDV par journée",chart:<BarChart data={chartData} margin={{top:4,right:0,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="label" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip {...tt}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="contacts" name="Contacts" fill={COLORS.contacts} radius={[3,3,0,0]}/><Bar dataKey="rdv" name="RDV" fill={COLORS.rdv} radius={[3,3,0,0]}/></BarChart>},
                  {title:"Évolution du CA",chart:<LineChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="label" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip {...tt} formatter={v=>[fmt(v),"CA"]}/><Line type="monotone" dataKey="ca" stroke={COLORS.ca} strokeWidth={2.5} dot={{fill:COLORS.ca,r:3}} activeDot={{r:5}}/></LineChart>},
                  {title:"CA par commercial",chart:<BarChart data={spChartData} margin={{top:4,right:0,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="name" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip {...tt} formatter={(v,n)=>[n==="ca"?fmt(v):v,n==="ca"?"CA":"RDV"]}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="ca" name="CA" fill={COLORS.ca} radius={[3,3,0,0]}/><Bar dataKey="rdv" name="RDV" fill={COLORS.rdv} radius={[3,3,0,0]}/></BarChart>},
                  ...(zones.length>0?[{title:"CA par zone",chart:<BarChart data={zoneChartData} margin={{top:4,right:0,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/><XAxis dataKey="name" tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"#6b7280",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/><Tooltip {...tt} formatter={(v,n)=>[n==="ca"?fmt(v):v,n==="ca"?"CA":"Contacts"]}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="ca" name="CA" fill={COLORS.ca} radius={[3,3,0,0]}/><Bar dataKey="contacts" name="Contacts" fill={COLORS.contacts} radius={[3,3,0,0]}/></BarChart>}]:[])
                ].map(({title,chart})=>(
                  <div key={title} className="card">
                    <div style={{fontSize:13,fontWeight:700,fontFamily:"'Syne',sans-serif",marginBottom:14}}>{title}</div>
                    <ResponsiveContainer width="100%" height={180}>{chart}</ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLASSEMENT */}
        {tab==="classement"&&(
          <div className="up">
            <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>Trié par CA · période sélectionnée</div>
            {ranked.length===0&&<div style={{textAlign:"center",padding:"60px 20px",color:"#374151"}}><div style={{fontSize:40,marginBottom:10}}>🏆</div><div>Aucun commercial.</div></div>}
            {ranked.map((sp,i)=>{
              const st=statsBySp[sp.id]||{contacts:0,rdv:0,ca:0};
              const topCA=(statsBySp[ranked[0]?.id]||{}).ca||1;
              const pct=topCA>0?Math.min(100,(st.ca/topCA)*100):0;
              const conv=st.contacts>0?((st.rdv/st.contacts)*100).toFixed(0):0;
              const isTop=i===0&&st.ca>0;
              const spIdx=salespeople.findIndex(s=>s.id===sp.id);
              const spZones=[...new Set(filtered.filter(e=>e.salespersonId===sp.id&&e.zoneId).map(e=>e.zoneId))].map(id=>zones.find(z=>z.id===id)).filter(Boolean);
              return(
                <div key={sp.id} className="up" style={{background:isTop?"linear-gradient(135deg,rgba(249,115,22,0.1),rgba(251,146,60,0.04))":"rgba(255,255,255,0.02)",border:isTop?"1px solid rgba(249,115,22,0.25)":"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"14px 16px",marginBottom:10,boxShadow:isTop?"0 4px 20px rgba(249,115,22,0.1)":"none",animationDelay:`${i*.06}s`}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                    <div style={{width:32,textAlign:"center",flexShrink:0}}>{i<3?<span style={{fontSize:24}}>{MEDALS[i]}</span>:<span style={{fontSize:14,fontWeight:700,color:"#4b5563"}}>#{i+1}</span>}</div>
                    <div style={{width:40,height:40,borderRadius:10,background:`hsl(${(spIdx*47)%360},60%,45%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>{sp.name.slice(0,2).toUpperCase()}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,fontSize:16,fontFamily:"'Syne',sans-serif"}}>{sp.name}</span>
                        {isTop&&<span style={{fontSize:10,background:"linear-gradient(90deg,#f97316,#fb923c)",color:"#fff",borderRadius:20,padding:"2px 8px",fontWeight:700}}>⭐ TOP</span>}
                      </div>
                      {spZones.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>{spZones.map(z=><ZoneBadge key={z.id} zone={z}/>)}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:800,fontFamily:"'Syne',sans-serif",color:i===0?"#fb923c":"#fff"}}>{fmt(st.ca)}</div>
                      <div style={{fontSize:10,color:"#4b5563"}}>{pct.toFixed(0)}% du leader</div>
                    </div>
                  </div>
                  <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
                    <div style={{height:"100%",width:`${pct}%`,background:i===0?"linear-gradient(90deg,#f97316,#fb923c)":i===1?COLORS.rdv:i===2?COLORS.contacts:"#374151",borderRadius:4,transition:"width .6s"}}/>
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:12,color:"#6b7280",flexWrap:"wrap"}}>
                    <span>📞 {st.contacts}</span><span>📅 {st.rdv} RDV</span>
                    <span style={{color:COLORS.conv}}>🔄 {conv}%</span>
                    {sp.target_ca>0&&<span style={{color:st.ca>=sp.target_ca?COLORS.conv:"#6b7280"}}>🎯 {Math.min(100,Math.round((st.ca/sp.target_ca)*100))}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PROSPECTS */}
        {tab==="prospects"&&(
          <div className="up">
            <ProspectsTab prospects={prospects} salespeople={salespeople} currentUser={currentUser}/>
          </div>
        )}

        {/* CHAT */}
        {tab==="chat"&&(
          <div className="up">
            <ChatTab salespeople={salespeople} currentUser={currentUser}/>
          </div>
        )}

      </div>

      <nav className="bottom-nav">
        {TABS.map(t=>(
          <button key={t} className={`nav-item${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            <span className="nav-item-icon">{TAB_ICONS[t]}</span>
            <span>{TAB_LABELS[t]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
