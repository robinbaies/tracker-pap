import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import ChatTab from "./ChatTab";
import ProspectsTab from "./ProspectsTab";
import { T, METRIC, ZONE_PALETTE, STATUTS, FONTS_IMPORT, F_DISPLAY, F_BODY, F_MONO, fmt, fmtK, todayStr, dateLabel } from "./theme";

const MEDALS = ["①","②","③"];
const TABS = [
  { k:"dashboard", icon:"◎", label:"QG" },
  { k:"saisie", icon:"✎", label:"Saisie" },
  { k:"prospects", icon:"⌖", label:"Prospects" },
  { k:"graphiques", icon:"◊", label:"Stats" },
  { k:"classement", icon:"⚑", label:"Classement" },
  { k:"chat", icon:"✦", label:"Canal" },
];

function exportCSV(salespeople, zones, entries, period) {
  const f = entries.filter(e => period.type==="day"?e.date===period.date:period.type==="range"?(e.date>=period.from&&e.date<=period.to):true);
  const rows = [["Commercial","Zone","Date","Contacts","RDV","Ventes","CA (EUR)"]];
  f.forEach(e => { const sp=salespeople.find(s=>s.id===e.salespersonId), z=zones.find(z=>z.id===e.zoneId); if(sp) rows.push([sp.name,z?z.name:"—",e.date,e.contacts,e.rdv,e.ventes||0,e.ca]); });
  const csv = rows.map(r=>r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="tracker-pap.csv"; a.click(); URL.revokeObjectURL(url);
}

function Spinner() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:18, background:T.bg }}>
      <div style={{ position:"relative", width:54, height:54 }}>
        <div style={{ position:"absolute", inset:0, border:`3px solid ${T.line}`, borderTopColor:T.lime, borderRadius:"50%", animation:"spin .7s linear infinite" }} />
        <div style={{ position:"absolute", inset:10, border:`3px solid ${T.line}`, borderBottomColor:T.cyan, borderRadius:"50%", animation:"spin 1s linear infinite reverse" }} />
      </div>
      <div style={{ color:T.inkFaint, fontSize:12, fontFamily:F_MONO, letterSpacing:2 }}>CONNEXION AU QG…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function IdentityScreen({ salespeople, onSelect }) {
  const [role, setRole] = useState("commercial");
  const [selectedId, setSelectedId] = useState("");
  const inp = { background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:13, padding:"14px 16px", color:T.ink, fontSize:16, fontFamily:F_DISPLAY, width:"100%", WebkitAppearance:"none" };
  const confirm = () => { if(role==="manager"){onSelect({name:"Manager",role:"manager"});return;} const sp=salespeople.find(s=>s.id===selectedId); if(sp) onSelect({name:sp.name,role:"commercial"}); };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px 20px", position:"relative", overflow:"hidden" }}>
      <style>{`${FONTS_IMPORT} *{box-sizing:border-box;} input,select,button{outline:none;font-family:${F_DISPLAY};} button{cursor:pointer;border:none;}
        @keyframes glow { 0%,100%{opacity:0.4;} 50%{opacity:0.7;} }
        @keyframes rise { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }`}</style>
      {/* Ambient grid */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${T.line}33 1px, transparent 1px), linear-gradient(90deg, ${T.line}33 1px, transparent 1px)`, backgroundSize:"40px 40px", maskImage:"radial-gradient(ellipse at center, black, transparent 75%)" }} />
      <div style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", width:300, height:300, background:T.lime, borderRadius:"50%", filter:"blur(120px)", opacity:0.15, animation:"glow 4s ease-in-out infinite" }} />

      <div style={{ width:"100%", maxWidth:390, position:"relative", animation:"rise .5s ease both" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:T.gradHero, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 18px", boxShadow:`0 8px 32px ${T.lime}44`, transform:"rotate(-6deg)" }}>⌖</div>
          <div style={{ fontSize:13, color:T.lime, fontFamily:F_MONO, letterSpacing:4, marginBottom:6 }}>FIELD COMMAND</div>
          <div style={{ fontSize:30, fontWeight:700, fontFamily:F_DISPLAY, color:T.ink, lineHeight:1 }}>Porte-à-Porte</div>
          <div style={{ fontSize:13, color:T.inkFaint, marginTop:10, fontFamily:F_BODY }}>Identifiez-vous pour rejoindre le terrain</div>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:18 }}>
          {[["commercial","◈","Commercial"],["manager","★","Manager"]].map(([r,ic,l]) => (
            <button key={r} onClick={()=>setRole(r)} style={{
              flex:1, padding:"16px 12px", borderRadius:15, fontSize:14, fontWeight:600, fontFamily:F_DISPLAY,
              background:role===r?T.gradHero:T.bgCard, color:role===r?T.bg:T.inkSoft,
              border:role===r?"none":`1px solid ${T.line}`, boxShadow:role===r?`0 6px 20px ${T.lime}33`:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:6,
            }}><span style={{ fontSize:22 }}>{ic}</span>{l}</button>
          ))}
        </div>

        {role==="commercial" && (
          <div style={{ marginBottom:18, position:"relative" }}>
            <select style={{ ...inp, paddingRight:38 }} value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
              <option value="">Sélectionnez votre nom…</option>
              {salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span style={{ position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", color:T.inkFaint, pointerEvents:"none" }}>▼</span>
            {salespeople.length===0 && <div style={{ fontSize:12, color:T.inkFaint, marginTop:10, textAlign:"center" }}>Aucun commercial enregistré. Connectez-vous en Manager pour en ajouter.</div>}
          </div>
        )}
        {role==="manager" && (
          <div style={{ background:`${T.amber}14`, border:`1px solid ${T.amber}33`, borderRadius:13, padding:"14px 16px", marginBottom:18, fontSize:13, color:T.amber, fontFamily:F_BODY }}>
            ★ Vue complète de l'équipe et de tous les indicateurs.
          </div>
        )}

        <button onClick={confirm} disabled={role==="commercial"&&!selectedId} style={{
          width:"100%", padding:"16px", borderRadius:15, fontSize:16, fontWeight:700, fontFamily:F_DISPLAY,
          background:(role==="manager"||selectedId)?T.gradLime:T.bgCard, color:(role==="manager"||selectedId)?T.bg:T.inkFaint,
          boxShadow:(role==="manager"||selectedId)?`0 6px 24px ${T.lime}44`:"none", opacity:(role==="commercial"&&!selectedId)?0.5:1,
        }}>Entrer sur le terrain →</button>
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
  const [currentUser, setCurrentUser] = useState(() => { try { const u=localStorage.getItem("pap_user_v2"); return u?JSON.parse(u):null; } catch { return null; } });
  const [tab, setTab] = useState("dashboard");
  const [period, setPeriod] = useState({ type:"all", date:todayStr(), from:todayStr(), to:todayStr() });
  const [newName, setNewName] = useState("");
  const [newZone, setNewZone] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState({ salespersonId:"", zoneId:"", date:todayStr(), contacts:0, rdv:0, ventes:0, ca:0 });
  const [editId, setEditId] = useState(null);
  const [filterZone, setFilterZone] = useState("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let n=0; const ck=()=>{n++;if(n>=3)setLoading(false);};
    const u1 = onSnapshot(collection(db,"salespeople"), s=>{setSalespeople(s.docs.map(d=>({id:d.id,...d.data()})));ck();});
    const u2 = onSnapshot(collection(db,"entries"), s=>{setEntries(s.docs.map(d=>({id:d.id,...d.data()})));ck();});
    const u3 = onSnapshot(collection(db,"zones"), s=>{setZones(s.docs.map(d=>({id:d.id,...d.data()})));ck();});
    const u4 = onSnapshot(collection(db,"prospects"), s=>setProspects(s.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1();u2();u3();u4(); };
  }, []);

  const selectUser = (u) => { setCurrentUser(u); localStorage.setItem("pap_user_v2", JSON.stringify(u)); };
  const logout = () => { setCurrentUser(null); localStorage.removeItem("pap_user_v2"); setTab("dashboard"); };

  const filtered = useMemo(() => entries.filter(e => {
    const inP = period.type==="day"?e.date===period.date:period.type==="range"?(e.date>=period.from&&e.date<=period.to):true;
    return inP && (filterZone==="all"?true:e.zoneId===filterZone);
  }), [entries, period, filterZone]);

  const statsBySp = useMemo(() => { const m={}; salespeople.forEach(s=>m[s.id]={contacts:0,rdv:0,ventes:0,ca:0,days:new Set(),best:0}); filtered.forEach(e=>{if(!m[e.salespersonId])m[e.salespersonId]={contacts:0,rdv:0,ventes:0,ca:0,days:new Set(),best:0};const x=m[e.salespersonId];x.contacts+=e.contacts;x.rdv+=e.rdv;x.ventes+=(e.ventes||0);x.ca+=e.ca;x.days.add(e.date);if(e.ca>x.best)x.best=e.ca;}); return m; }, [filtered, salespeople]);
  const statsByZone = useMemo(() => { const m={}; zones.forEach(z=>m[z.id]={contacts:0,rdv:0,ventes:0,ca:0}); filtered.forEach(e=>{if(!e.zoneId)return;if(!m[e.zoneId])m[e.zoneId]={contacts:0,rdv:0,ventes:0,ca:0};m[e.zoneId].contacts+=e.contacts;m[e.zoneId].rdv+=e.rdv;m[e.zoneId].ventes+=(e.ventes||0);m[e.zoneId].ca+=e.ca;}); return m; }, [filtered, zones]);
  const totals = useMemo(() => Object.values(statsBySp).reduce((a,s)=>({contacts:a.contacts+s.contacts,rdv:a.rdv+s.rdv,ventes:a.ventes+(s.ventes||0),ca:a.ca+s.ca}),{contacts:0,rdv:0,ventes:0,ca:0}), [statsBySp]);
  const teamTargets = useMemo(() => salespeople.reduce((a,s)=>({contacts:a.contacts+(s.target_contacts||0),rdv:a.rdv+(s.target_rdv||0),ca:a.ca+(s.target_ca||0)}),{contacts:0,rdv:0,ca:0}), [salespeople]);
  const ranked = useMemo(() => [...salespeople].sort((a,b)=>{const sa=statsBySp[a.id]||{ca:0,rdv:0},sb=statsBySp[b.id]||{ca:0,rdv:0};return sb.ca-sa.ca||sb.rdv-sa.rdv;}), [salespeople, statsBySp]);
  const chartData = useMemo(() => { const bd={}; entries.forEach(e=>{if(filterZone!=="all"&&e.zoneId!==filterZone)return;if(!bd[e.date])bd[e.date]={date:e.date,contacts:0,rdv:0,ca:0};bd[e.date].contacts+=e.contacts;bd[e.date].rdv+=e.rdv;bd[e.date].ca+=e.ca;}); return Object.values(bd).sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({...d,label:dateLabel(d.date)})); }, [entries, filterZone]);
  const spChartData = useMemo(() => salespeople.map(sp=>{const s=statsBySp[sp.id]||{};return {name:sp.name.split(" ")[0],ca:s.ca||0,rdv:s.rdv||0,panier:(s.ventes>0)?Math.round(s.ca/s.ventes):0};}), [salespeople, statsBySp]);
  const zoneChartData = useMemo(() => zones.map(z=>({name:z.name,ca:(statsByZone[z.id]||{}).ca||0,contacts:(statsByZone[z.id]||{}).contacts||0,color:z.color})), [zones, statsByZone]);
  const distinctDays = [...new Set(filtered.map(e=>e.date))].length;
  const teamKPI = useMemo(() => {
    const panier = totals.ventes>0 ? totals.ca/totals.ventes : 0;
    const caJour = distinctDays>0 ? totals.ca/distinctDays : 0;
    const contactsJour = distinctDays>0 ? totals.contacts/distinctDays : 0;
    const caContact = totals.contacts>0 ? totals.ca/totals.contacts : 0;
    const best = Math.max(0, ...Object.values(statsBySp).map(s=>s.best||0));
    return { panier, caJour, contactsJour, caContact, best };
  }, [totals, distinctDays, statsBySp]);

  // Tendance : compare la période sélectionnée à la période équivalente précédente
  const trend = useMemo(() => {
    const caNow = totals.ca;
    let prevCA = 0;
    if (period.type === "day") {
      const d = new Date(period.date+"T12:00:00"); d.setDate(d.getDate()-1);
      const prev = d.toISOString().slice(0,10);
      prevCA = entries.filter(e=>e.date===prev && (filterZone==="all"||e.zoneId===filterZone)).reduce((a,e)=>a+e.ca,0);
    } else if (period.type === "range") {
      const from=new Date(period.from+"T12:00:00"), to=new Date(period.to+"T12:00:00");
      const span = Math.max(1, Math.round((to-from)/86400000)+1);
      const pTo=new Date(from); pTo.setDate(pTo.getDate()-1);
      const pFrom=new Date(pTo); pFrom.setDate(pFrom.getDate()-span+1);
      const pf=pFrom.toISOString().slice(0,10), pt=pTo.toISOString().slice(0,10);
      prevCA = entries.filter(e=>e.date>=pf && e.date<=pt && (filterZone==="all"||e.zoneId===filterZone)).reduce((a,e)=>a+e.ca,0);
    } else {
      // "Tout" : compare la dernière moitié des jours à la première moitié
      const days=[...new Set(chartData.map(d=>d.date))].sort();
      if(days.length>=2){const mid=Math.floor(days.length/2);const firstHalf=days.slice(0,mid),secondHalf=days.slice(mid);
        const sum=(arr)=>chartData.filter(d=>arr.includes(d.date)).reduce((a,d)=>a+d.ca,0);
        prevCA=sum(firstHalf); return { pct: prevCA>0?Math.round(((sum(secondHalf)-prevCA)/prevCA)*100):null, hasPrev:prevCA>0 };
      }
      return { pct:null, hasPrev:false };
    }
    return { pct: prevCA>0?Math.round(((caNow-prevCA)/prevCA)*100):null, hasPrev:prevCA>0 };
  }, [totals.ca, period, entries, filterZone, chartData]);

  // Données sparkline (CA cumulé ou par jour)
  const sparkPath = useMemo(() => {
    const pts = chartData.map(d=>d.ca);
    if(pts.length<2) return null;
    const max=Math.max(...pts,1), min=Math.min(...pts,0);
    const W=90, H=44, range=max-min||1;
    const coords = pts.map((v,i)=>{ const x=(i/(pts.length-1))*W; const y=H-((v-min)/range)*H; return [x,y]; });
    const path = coords.map((p,i)=>`${i===0?"M":"L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    return { path, last:coords[coords.length-1] };
  }, [chartData]);

  const addSP = async () => { const n=newName.trim(); if(!n||salespeople.find(s=>s.name.toLowerCase()===n.toLowerCase()))return; setSaving(true); await addDoc(collection(db,"salespeople"),{name:n,target_contacts:0,target_rdv:0,target_ca:0}); setNewName(""); setSaving(false); };
  const delSP = async (id) => { await deleteDoc(doc(db,"salespeople",id)); await Promise.all(entries.filter(e=>e.salespersonId===id).map(e=>deleteDoc(doc(db,"entries",e.id)))); };
  const updTarget = async (id,f,v) => { await updateDoc(doc(db,"salespeople",id),{[f]:parseFloat(v)||0}); };
  const addZone = async () => { const n=newZone.trim(); if(!n||zones.find(z=>z.name.toLowerCase()===n.toLowerCase()))return; setSaving(true); await addDoc(collection(db,"zones"),{name:n,color:ZONE_PALETTE[zones.length%ZONE_PALETTE.length]}); setNewZone(""); setSaving(false); };
  const delZone = async (id) => { await deleteDoc(doc(db,"zones",id)); await Promise.all(entries.filter(e=>e.zoneId===id).map(e=>updateDoc(doc(db,"entries",e.id),{zoneId:""}))); };
  const updateZoneColor = async (id,color) => { await updateDoc(doc(db,"zones",id),{color}); };
  const saveEntry = async () => { if(!form.salespersonId||!form.date)return; setSaving(true); const en={salespersonId:form.salespersonId,zoneId:form.zoneId||"",date:form.date,contacts:+form.contacts,rdv:+form.rdv,ventes:+form.ventes,ca:+form.ca}; if(editId)await updateDoc(doc(db,"entries",editId),en);else await addDoc(collection(db,"entries"),en); setEditId(null); setForm({salespersonId:"",zoneId:"",date:todayStr(),contacts:0,rdv:0,ventes:0,ca:0}); setSaving(false); };
  const startEdit = (e) => { setForm({salespersonId:e.salespersonId,zoneId:e.zoneId||"",date:e.date,contacts:e.contacts,rdv:e.rdv,ventes:e.ventes||0,ca:e.ca}); setEditId(e.id); setTab("saisie"); };
  const delEntry = async (id) => { await deleteDoc(doc(db,"entries",id)); };

  const inp = { background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:11, padding:"12px 14px", color:T.ink, fontSize:16, fontFamily:F_DISPLAY, width:"100%", WebkitAppearance:"none" };
  const tt = { contentStyle:{ background:T.bgSoft, border:`1px solid ${T.line}`, borderRadius:10, color:T.ink, fontSize:12, fontFamily:F_MONO }, cursor:{ fill:"rgba(255,255,255,0.03)" } };

  if (loading) return <Spinner />;
  if (!currentUser) return <IdentityScreen salespeople={salespeople} onSelect={selectUser} />;

  const periodLabel = period.type==="all"?"Tout l'historique":period.type==="day"?dateLabel(period.date):"Période choisie";

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.ink, fontFamily:F_BODY, paddingBottom:84 }}>
      <style>{`
        ${FONTS_IMPORT}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        input,select,button,textarea{outline:none;font-family:${F_DISPLAY};}
        button{cursor:pointer;border:none;}
        body{margin:0;overscroll-behavior-y:none;background:${T.bg};}
        ::-webkit-scrollbar{width:0;height:0;}
        select{-webkit-appearance:none;appearance:none;}
        .ff:focus{border-color:${T.lime}88!important;}
        .press:active{transform:scale(0.97);}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .rise{animation:rise .35s ease both;}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .navbar{position:fixed;bottom:0;left:0;right:0;z-index:100;background:${T.bgSoft}f2;backdrop-filter:blur(16px);border-top:1px solid ${T.line};display:flex;padding:8px 6px;padding-bottom:max(8px,env(safe-area-inset-bottom));gap:2px;}
        .navb{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px;border-radius:12px;background:none;border:none;color:${T.inkFaint};transition:all .2s;}
        .navb .ni{font-size:19px;line-height:1;transition:transform .2s;}
        .navb.on{color:${T.lime};}
        .navb.on .ni{transform:translateY(-1px) scale(1.15);}
        .navb .nl{font-size:9px;font-weight:600;font-family:${F_MONO};letter-spacing:0.3px;}
        input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input[type=color]{padding:2px;border-radius:8px;cursor:pointer;}
        a{color:inherit;}
      `}</style>

      {/* HEADER */}
      <header style={{ position:"sticky", top:0, zIndex:50, background:`${T.bg}f2`, backdropFilter:"blur(14px)", borderBottom:`1px solid ${T.line}` }}>
        <div style={{ maxWidth:680, margin:"0 auto", padding:"12px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
              <div style={{ width:38, height:38, borderRadius:12, background:T.gradHero, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, transform:"rotate(-6deg)", flexShrink:0 }}>⌖</div>
              <div>
                <div style={{ fontSize:11, color:T.lime, fontFamily:F_MONO, letterSpacing:2, lineHeight:1 }}>FIELD COMMAND</div>
                <div style={{ fontSize:15, fontWeight:700, fontFamily:F_DISPLAY, lineHeight:1.3 }}>Porte-à-Porte</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:20, padding:"5px 11px 5px 7px" }}>
                <div style={{ width:24, height:24, borderRadius:7, background:currentUser.role==="manager"?`${T.amber}33`:`${T.cyan}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:currentUser.role==="manager"?T.amber:T.cyan, fontFamily:F_DISPLAY }}>{currentUser.name.slice(0,2).toUpperCase()}</div>
                <span style={{ fontSize:12, fontWeight:600, fontFamily:F_DISPLAY }}>{currentUser.name.split(" ")[0]}{currentUser.role==="manager"&&" ★"}</span>
              </div>
              <button onClick={logout} className="press" style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:10, padding:"7px 10px", color:T.inkFaint, fontSize:13 }}>⏻</button>
            </div>
          </div>

          {tab!=="chat" && tab!=="prospects" && (
            <div style={{ display:"flex", gap:6, marginTop:11, alignItems:"center", animation:"slideDown .25s ease" }}>
              <div style={{ display:"flex", gap:3, background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:11, padding:3 }}>
                {[["all","Tout"],["day","Jour"],["range","Plage"]].map(([t,l]) => (
                  <button key={t} onClick={()=>setPeriod(p=>({...p,type:t}))} className="press" style={{ padding:"6px 13px", borderRadius:8, fontSize:12, fontWeight:600, fontFamily:F_DISPLAY, background:period.type===t?T.gradLime:"transparent", color:period.type===t?T.bg:T.inkFaint }}>{l}</button>
                ))}
              </div>
              {zones.length>0 && (
                <div style={{ marginLeft:"auto", position:"relative" }}>
                  <select value={filterZone} onChange={e=>setFilterZone(e.target.value)} style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:11, color:T.inkSoft, padding:"7px 26px 7px 11px", fontSize:12, fontFamily:F_DISPLAY }}>
                    <option value="all">⌖ Zones</option>
                    {zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                  <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", color:T.inkFaint, pointerEvents:"none", fontSize:9 }}>▼</span>
                </div>
              )}
            </div>
          )}
          {tab!=="chat" && tab!=="prospects" && period.type==="day" && <input type="date" value={period.date} onChange={e=>setPeriod(p=>({...p,date:e.target.value}))} style={{ ...inp, fontSize:14, padding:"9px 12px", marginTop:8 }} />}
          {tab!=="chat" && tab!=="prospects" && period.type==="range" && (
            <div style={{ display:"flex", gap:8, marginTop:8, alignItems:"center" }}>
              <input type="date" value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} style={{ ...inp, fontSize:13, padding:"9px 11px", flex:1 }} />
              <span style={{ color:T.inkFaint }}>→</span>
              <input type="date" value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} style={{ ...inp, fontSize:13, padding:"9px 11px", flex:1 }} />
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth:680, margin:"0 auto", padding:"18px 16px" }}>

        {/* ═══ QG / DASHBOARD ═══ */}
        {tab==="dashboard" && (
          <div className="rise">
            {/* Hero — CA clé + tendance (Proposition C) */}
            <div style={{ background:`radial-gradient(ellipse at top right, ${T.bgCardHi}, ${T.bgSoft})`, border:`1px solid ${T.line}`, borderRadius:22, padding:"20px 20px 18px", marginBottom:14, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-40, right:-30, width:150, height:150, background:T.lime, borderRadius:"50%", filter:"blur(80px)", opacity:0.1 }} />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"relative" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:10, color:T.inkFaint, fontFamily:F_MONO, letterSpacing:2, marginBottom:8 }}>€ CA ÉQUIPE · {periodLabel.toUpperCase()}</div>
                  <div style={{ fontSize:44, fontWeight:700, fontFamily:F_DISPLAY, color:T.ink, lineHeight:0.9, letterSpacing:-1 }}>{new Intl.NumberFormat("fr-FR").format(totals.ca)}<span style={{ fontSize:24, color:T.inkSoft }}> €</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, flexWrap:"wrap" }}>
                    {trend.hasPrev && trend.pct!==null ? (
                      <span style={{ background:trend.pct>=0?`${T.emerald}22`:`${T.rose}22`, color:trend.pct>=0?T.emerald:T.rose, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:8, fontFamily:F_MONO }}>{trend.pct>=0?"▲":"▼"} {trend.pct>=0?"+":""}{trend.pct}%</span>
                    ) : (
                      <span style={{ background:T.bgCard, color:T.inkFaint, fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:8, fontFamily:F_MONO }}>—</span>
                    )}
                    <span style={{ fontSize:11, color:T.inkFaint }}>{period.type==="all"?"tendance récente":"vs période précédente"}</span>
                  </div>
                </div>
                {sparkPath && (
                  <svg width="90" height="44" viewBox="0 0 90 44" style={{ flexShrink:0, marginTop:18, overflow:"visible" }}>
                    <path d={sparkPath.path} fill="none" stroke={T.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter:`drop-shadow(0 0 4px ${T.lime}88)` }} />
                    <circle cx={sparkPath.last[0]} cy={sparkPath.last[1]} r="4" fill={T.lime} />
                  </svg>
                )}
              </div>
              <div style={{ display:"flex", gap:18, marginTop:16, paddingTop:14, borderTop:`1px solid ${T.line}` }}>
                <div><span style={{ fontSize:16, fontWeight:700, fontFamily:F_DISPLAY, color:T.cyan }}>{totals.contacts}</span> <span style={{ fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>contacts</span></div>
                <div><span style={{ fontSize:16, fontWeight:700, fontFamily:F_DISPLAY, color:T.violet }}>{totals.rdv}</span> <span style={{ fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>RDV</span></div>
                <div><span style={{ fontSize:16, fontWeight:700, fontFamily:F_DISPLAY, color:T.lime }}>{totals.contacts>0?((totals.rdv/totals.contacts)*100).toFixed(0):0}%</span> <span style={{ fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>conv.</span></div>
                {teamTargets.ca>0 && <div style={{ marginLeft:"auto" }}><span style={{ fontSize:16, fontWeight:700, fontFamily:F_DISPLAY, color:T.amber }}>{Math.round((totals.ca/teamTargets.ca)*100)}%</span> <span style={{ fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>obj.</span></div>}
              </div>
            </div>

            {/* KPIs visuels — grille 2 colonnes */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[
                { l:"Panier moyen", v:fmt(teamKPI.panier), sub:`${totals.ventes} vente${totals.ventes!==1?"s":""}`, c:T.emerald, icon:"🎯" },
                { l:"CA / jour", v:fmtK(teamKPI.caJour), sub:`${distinctDays} jour${distinctDays!==1?"s":""}`, c:T.lime, icon:"📅" },
                { l:"Contacts / jour", v:teamKPI.contactsJour.toFixed(0), sub:`${totals.contacts} au total`, c:T.cyan, icon:"☏" },
                { l:"CA / contact", v:fmt(teamKPI.caContact), sub:"rendement/porte", c:T.violet, icon:"⊚" },
                { l:"Meilleure journée", v:fmtK(teamKPI.best), sub:"record perso", c:T.amber, icon:"🔥" },
                { l:"Rendez-vous", v:totals.rdv, sub:totals.contacts>0?`${((totals.rdv/totals.contacts)*100).toFixed(0)}% conv.`:"—", c:T.rose, icon:"◷" },
              ].map(s => (
                <div key={s.l} style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:15, padding:"14px 15px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:9, color:T.inkFaint, fontFamily:F_MONO, letterSpacing:1, textTransform:"uppercase" }}>{s.l}</span>
                    <span style={{ fontSize:14 }}>{s.icon}</span>
                  </div>
                  <div style={{ fontSize:23, fontWeight:700, fontFamily:F_DISPLAY, lineHeight:1, color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:10, color:T.inkFaint, marginTop:5, fontFamily:F_MONO }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Zones strip */}
            {zones.length>0 && (
              <div style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:16, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:10, color:T.inkFaint, fontFamily:F_MONO, letterSpacing:1.5, marginBottom:12 }}>⌖ SECTEURS</div>
                {zones.map(z => { const zs=statsByZone[z.id]||{ca:0,rdv:0}; const max=Math.max(...zones.map(zz=>(statsByZone[zz.id]||{}).ca||0),1); return (
                  <div key={z.id} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:600, fontFamily:F_DISPLAY }}>{z.name}</span>
                      <span style={{ fontSize:12, color:z.color, fontWeight:700, fontFamily:F_MONO }}>{fmt(zs.ca)}</span>
                    </div>
                    <div style={{ height:6, background:T.bg, borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(zs.ca/max)*100}%`, background:z.color, borderRadius:3, transition:"width .6s", boxShadow:`0 0 8px ${z.color}66` }} />
                    </div>
                  </div>
                );})}
              </div>
            )}

            {/* Team cards */}
            {salespeople.length===0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.inkGhost, background:T.bgCard, borderRadius:16, border:`1px dashed ${T.line}` }}>
                <div style={{ fontSize:38, marginBottom:10 }}>◈</div>
                <div style={{ color:T.inkFaint }}>Aucun commercial. Ajoutez votre équipe dans <strong style={{color:T.lime}}>Saisie</strong>.</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {ranked.map((sp,i) => {
                  const st=statsBySp[sp.id]||{contacts:0,rdv:0,ventes:0,ca:0,days:new Set(),best:0};
                  const conv=st.contacts>0?((st.rdv/st.contacts)*100).toFixed(0):0;
                  const isLead=i===0&&st.ca>0;
                  return (
                    <div key={sp.id} style={{ background:isLead?`linear-gradient(135deg,${T.lime}14,${T.bgCard})`:T.bgCard, border:`1px solid ${isLead?T.lime+"44":T.line}`, borderRadius:16, padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ position:"relative", flexShrink:0 }}>
                          <div style={{ width:44, height:44, borderRadius:13, background:`hsl(${(salespeople.indexOf(sp)*67)%360},55%,42%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, color:"#fff", fontFamily:F_DISPLAY }}>{sp.name.slice(0,2).toUpperCase()}</div>
                          {i<3 && <div style={{ position:"absolute", bottom:-4, right:-4, width:18, height:18, borderRadius:"50%", background:i===0?T.lime:i===1?T.cyan:T.violet, color:T.bg, fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F_MONO }}>{i+1}</div>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            <span style={{ fontWeight:700, fontSize:15, fontFamily:F_DISPLAY, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp.name}</span>
                            {isLead && <span style={{ fontSize:9, background:T.gradLime, color:T.bg, borderRadius:6, padding:"2px 7px", fontWeight:700, fontFamily:F_MONO, flexShrink:0 }}>TÊTE</span>}
                          </div>
                          <div style={{ display:"flex", gap:11, marginTop:4, fontSize:11, color:T.inkFaint, fontFamily:F_MONO, flexWrap:"wrap" }}>
                            <span style={{ color:T.cyan }}>☏ {st.contacts}</span>
                            <span style={{ color:T.violet }}>◷ {st.rdv}</span>
                            <span style={{ color:T.lime }}>⟳ {conv}%</span>
                            {st.ventes>0 && <span style={{ color:T.emerald }}>🎯 {fmt(st.ca/st.ventes)}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:18, fontWeight:700, fontFamily:F_DISPLAY, color:isLead?T.lime:T.ink, lineHeight:1 }}>{fmtK(st.ca)}</div>
                          {sp.target_ca>0 && <div style={{ fontSize:10, color:T.inkFaint, marginTop:3, fontFamily:F_MONO }}>{Math.min(100,Math.round((st.ca/sp.target_ca)*100))}% obj</div>}
                        </div>
                      </div>
                      {sp.target_ca>0 && (
                        <div style={{ height:4, background:T.bg, borderRadius:2, overflow:"hidden", marginTop:11 }}>
                          <div style={{ height:"100%", width:`${Math.min(100,(st.ca/sp.target_ca)*100)}%`, background:st.ca>=sp.target_ca?T.gradLime:T.gradCyan, borderRadius:2, transition:"width .6s" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={()=>exportCSV(salespeople,zones,entries,period)} className="press" style={{ width:"100%", marginTop:16, padding:"14px", borderRadius:14, fontSize:14, fontWeight:600, fontFamily:F_DISPLAY, background:T.bgCard, color:T.inkSoft, border:`1px solid ${T.line}` }}>↓ Exporter les données (CSV)</button>
          </div>
        )}

        {/* ═══ SAISIE ═══ */}
        {tab==="saisie" && (
          <div className="rise">
            <SectionTitle>Équipe & Objectifs</SectionTitle>
            <div style={{ display:"flex", gap:8, marginBottom:18 }}>
              <input className="ff" style={inp} placeholder="Nom du commercial…" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSP()} />
              <button className="press" onClick={addSP} disabled={saving} style={{ flexShrink:0, padding:"12px 18px", fontSize:18, fontWeight:700, borderRadius:11, background:T.gradLime, color:T.bg, border:"none" }}>＋</button>
            </div>
            {salespeople.length>0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:26 }}>
                {salespeople.map((sp,i)=>(
                  <div key={sp.id} style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:14, padding:14 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                        <div style={{ width:34, height:34, borderRadius:10, background:`hsl(${(i*67)%360},55%,42%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", fontFamily:F_DISPLAY }}>{sp.name.slice(0,2).toUpperCase()}</div>
                        <span style={{ fontWeight:600, fontSize:15, fontFamily:F_DISPLAY }}>{sp.name}</span>
                      </div>
                      <div style={{ display:"flex", gap:7 }}>
                        <button onClick={()=>setEditTarget(editTarget===sp.id?null:sp.id)} className="press" style={{ background:`${T.amber}1A`, border:`1px solid ${T.amber}33`, color:T.amber, borderRadius:9, padding:"6px 11px", fontSize:12, fontFamily:F_MONO }}>⊙ OBJ</button>
                        <button onClick={()=>delSP(sp.id)} className="press" style={{ background:`${T.rose}14`, border:`1px solid ${T.rose}33`, color:T.rose, borderRadius:9, padding:"6px 10px", fontSize:12 }}>✕</button>
                      </div>
                    </div>
                    {editTarget===sp.id && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid ${T.line}`, animation:"slideDown .2s ease" }}>
                        {[["target_contacts","CONTACTS",T.cyan],["target_rdv","RDV",T.violet],["target_ca","CA €",T.amber]].map(([f,l,c])=>(
                          <div key={f}>
                            <div style={{ fontSize:9, color:c, marginBottom:5, fontFamily:F_MONO, letterSpacing:1 }}>{l}</div>
                            <input className="ff" style={{ ...inp, padding:"8px 10px", fontSize:14 }} type="number" min="0" value={sp[f]||""} placeholder="0" onChange={e=>updTarget(sp.id,f,e.target.value)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <SectionTitle>{editId?"◆ Modifier la saisie":"◆ Nouvelle saisie terrain"}</SectionTitle>
            <div style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:18, padding:18 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Lbl t="Commercial"><Sel value={form.salespersonId} onChange={e=>setForm(f=>({...f,salespersonId:e.target.value}))} inp={inp}><option value="">Choisir…</option>{salespeople.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Sel></Lbl>
                  <Lbl t="Zone"><Sel value={form.zoneId} onChange={e=>setForm(f=>({...f,zoneId:e.target.value}))} inp={inp}><option value="">Sans zone</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</Sel></Lbl>
                </div>
                <Lbl t="Date"><input className="ff" style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></Lbl>
                {[["contacts","Contacts",T.cyan,"☏"],["rdv","Rendez-vous",T.violet,"◷"],["ventes","Ventes signées",T.emerald,"✓"],["ca","Chiffre d'affaires",T.amber,"€"]].map(([field,label,color,ic])=>(
                  <div key={field}>
                    <div style={{ fontSize:11, color, marginBottom:8, fontFamily:F_MONO, letterSpacing:0.5 }}>{ic} {label.toUpperCase()}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <button className="press" onClick={()=>setForm(f=>({...f,[field]:Math.max(0,+f[field]-(field==="ca"?100:1))}))} style={{ width:46, height:46, borderRadius:13, background:T.bg, border:`1px solid ${T.line}`, color:T.inkSoft, fontSize:22, flexShrink:0 }}>−</button>
                      <input className="ff" style={{ ...inp, textAlign:"center", fontWeight:700, fontSize:19, flex:1, fontFamily:F_DISPLAY, color }} type="number" min="0" value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} />
                      <button className="press" onClick={()=>setForm(f=>({...f,[field]:+f[field]+(field==="ca"?100:1)}))} style={{ width:46, height:46, borderRadius:13, background:`${color}1A`, border:`1px solid ${color}44`, color, fontSize:22, flexShrink:0 }}>＋</button>
                    </div>
                  </div>
                ))}
                <div style={{ display:"flex", gap:10, marginTop:4 }}>
                  <button className="press" onClick={saveEntry} disabled={saving} style={{ flex:1, padding:"14px", borderRadius:13, fontSize:15, fontWeight:700, fontFamily:F_DISPLAY, background:T.gradLime, color:T.bg, border:"none", boxShadow:`0 4px 16px ${T.lime}33` }}>{saving?"…":editId?"Mettre à jour":"Enregistrer la journée"}</button>
                  {editId && <button onClick={()=>{setEditId(null);setForm({salespersonId:"",zoneId:"",date:todayStr(),contacts:0,rdv:0,ventes:0,ca:0});}} style={{ padding:"14px 16px", borderRadius:13, fontSize:14, background:T.bg, color:T.inkSoft, border:`1px solid ${T.line}` }}>Annuler</button>}
                </div>
              </div>
            </div>

            <div style={{ marginTop:24 }}>
              <SectionTitle>Dernières saisies</SectionTitle>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(e=>{
                  const sp=salespeople.find(s=>s.id===e.salespersonId), z=zones.find(z=>z.id===e.zoneId);
                  if(!sp)return null;
                  return (
                    <div key={e.id} style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:13, padding:"11px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontWeight:600, fontSize:14, fontFamily:F_DISPLAY }}>{sp.name}</span>
                          <span style={{ fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>{dateLabel(e.date)}</span>
                          {z && <span style={{ fontSize:10, background:`${z.color}1A`, color:z.color, borderRadius:6, padding:"2px 7px", fontFamily:F_MONO }}>{z.name}</span>}
                        </div>
                        <div style={{ display:"flex", gap:5 }}>
                          <button onClick={()=>startEdit(e)} style={{ background:`${T.lime}14`, border:"none", color:T.lime, borderRadius:7, padding:"5px 9px", fontSize:12 }}>✎</button>
                          <button onClick={()=>delEntry(e.id)} style={{ background:`${T.rose}14`, border:"none", color:T.rose, borderRadius:7, padding:"5px 9px", fontSize:12 }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:14, fontSize:12, fontFamily:F_MONO }}>
                        <span style={{ color:T.cyan }}>☏ {e.contacts}</span>
                        <span style={{ color:T.violet }}>◷ {e.rdv}</span>
                        <span style={{ color:T.amber }}>€ {fmt(e.ca)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PROSPECTS ═══ */}
        {tab==="prospects" && <div className="rise"><ProspectsTab prospects={prospects} salespeople={salespeople} currentUser={currentUser} /></div>}

        {/* ═══ STATS ═══ */}
        {tab==="graphiques" && (
          <div className="rise">
            {chartData.length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:T.inkGhost }}>
                <div style={{ fontSize:42, marginBottom:12 }}>◊</div>
                <div style={{ color:T.inkFaint }}>Pas encore de données. Lancez la saisie terrain.</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <ChartCard title="Activité par journée" sub="Contacts vs Rendez-vous">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={chartData} margin={{top:6,right:0,left:-22,bottom:0}}>
                      <CartesianGrid strokeDasharray="2 4" stroke={T.line} vertical={false}/>
                      <XAxis dataKey="label" tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false}/>
                      <Tooltip {...tt}/>
                      <Bar dataKey="contacts" name="Contacts" fill={T.cyan} radius={[4,4,0,0]} maxBarSize={26}/>
                      <Bar dataKey="rdv" name="RDV" fill={T.violet} radius={[4,4,0,0]} maxBarSize={26}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Trajectoire du CA" sub="Évolution jour après jour">
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={chartData} margin={{top:6,right:6,left:-10,bottom:0}}>
                      <defs><linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.amber} stopOpacity={0.5}/><stop offset="100%" stopColor={T.amber} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="2 4" stroke={T.line} vertical={false}/>
                      <XAxis dataKey="label" tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <Tooltip {...tt} formatter={v=>[fmt(v),"CA"]}/>
                      <Area type="monotone" dataKey="ca" stroke={T.amber} strokeWidth={2.5} fill="url(#caGrad)" dot={{fill:T.amber,r:3}} activeDot={{r:5}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Duel des commerciaux" sub="CA généré par chacun">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={spChartData} layout="vertical" margin={{top:0,right:12,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="2 4" stroke={T.line} horizontal={false}/>
                      <XAxis type="number" tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <YAxis type="category" dataKey="name" tick={{fill:T.inkSoft,fontSize:11,fontFamily:F_DISPLAY}} axisLine={false} tickLine={false} width={70}/>
                      <Tooltip {...tt} formatter={v=>[fmt(v),"CA"]}/>
                      <Bar dataKey="ca" name="CA" fill={T.lime} radius={[0,5,5,0]} maxBarSize={22}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Panier moyen" sub="CA par vente, commercial par commercial">
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={spChartData} layout="vertical" margin={{top:0,right:12,left:0,bottom:0}}>
                      <CartesianGrid strokeDasharray="2 4" stroke={T.line} horizontal={false}/>
                      <XAxis type="number" tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                      <YAxis type="category" dataKey="name" tick={{fill:T.inkSoft,fontSize:11,fontFamily:F_DISPLAY}} axisLine={false} tickLine={false} width={70}/>
                      <Tooltip {...tt} formatter={v=>[fmt(v),"Panier"]}/>
                      <Bar dataKey="panier" name="Panier" fill={T.emerald} radius={[0,5,5,0]} maxBarSize={22}/>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                {zones.length>0 && (
                  <ChartCard title="Conquête des secteurs" sub="CA par zone géographique">
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={zoneChartData} margin={{top:6,right:0,left:-22,bottom:0}}>
                        <CartesianGrid strokeDasharray="2 4" stroke={T.line} vertical={false}/>
                        <XAxis dataKey="name" tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:T.inkFaint,fontSize:10,fontFamily:F_MONO}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                        <Tooltip {...tt} formatter={v=>[fmt(v),"CA"]}/>
                        <Bar dataKey="ca" name="CA" radius={[5,5,0,0]} maxBarSize={40}>
                          {zoneChartData.map((z,i)=><Cell key={i} fill={z.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ CLASSEMENT ═══ */}
        {tab==="classement" && (
          <div className="rise">
            <div style={{ fontSize:11, color:T.inkFaint, marginBottom:16, fontFamily:F_MONO, letterSpacing:1 }}>⚑ CLASSEMENT — {periodLabel.toUpperCase()}</div>
            {ranked.length===0 && <div style={{ textAlign:"center", padding:"60px 20px", color:T.inkGhost }}><div style={{ fontSize:42, marginBottom:10 }}>⚑</div><div style={{ color:T.inkFaint }}>Aucun commercial.</div></div>}
            {/* Podium top 3 */}
            {ranked.length>0 && ranked[0] && (statsBySp[ranked[0].id]||{}).ca>0 && (
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:10, marginBottom:24, paddingTop:10 }}>
                {[1,0,2].map(pos => {
                  const sp=ranked[pos]; if(!sp) return <div key={pos} style={{flex:1}} />;
                  const st=statsBySp[sp.id]||{ca:0}; const h=pos===0?100:pos===1?72:56;
                  const col=pos===0?T.lime:pos===1?T.cyan:T.violet;
                  return (
                    <div key={pos} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                      <div style={{ width:46, height:46, borderRadius:14, background:`hsl(${(salespeople.indexOf(sp)*67)%360},55%,42%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, color:"#fff", fontFamily:F_DISPLAY, marginBottom:8, border:`2px solid ${col}`, boxShadow:`0 0 16px ${col}55` }}>{sp.name.slice(0,2).toUpperCase()}</div>
                      <div style={{ fontSize:12, fontWeight:600, fontFamily:F_DISPLAY, marginBottom:2, textAlign:"center", maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sp.name.split(" ")[0]}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:col, fontFamily:F_MONO, marginBottom:6 }}>{fmtK(st.ca)}</div>
                      <div style={{ width:"100%", height:h, background:`linear-gradient(180deg,${col}33,${col}0D)`, border:`1px solid ${col}44`, borderBottom:"none", borderRadius:"10px 10px 0 0", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:8 }}>
                        <span style={{ fontSize:24, fontWeight:700, color:col, fontFamily:F_DISPLAY }}>{pos+1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {ranked.map((sp,i)=>{
                const st=statsBySp[sp.id]||{contacts:0,rdv:0,ventes:0,ca:0,days:new Set(),best:0};
                const topCA=(statsBySp[ranked[0]?.id]||{}).ca||1;
                const pct=topCA>0?Math.min(100,(st.ca/topCA)*100):0;
                const conv=st.contacts>0?((st.rdv/st.contacts)*100).toFixed(0):0;
                const isTop=i===0&&st.ca>0;
                return (
                  <div key={sp.id} style={{ background:isTop?`linear-gradient(135deg,${T.lime}14,${T.bgCard})`:T.bgCard, border:`1px solid ${isTop?T.lime+"44":T.line}`, borderRadius:15, padding:"13px 15px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:30, textAlign:"center", flexShrink:0, fontSize:16, fontWeight:700, fontFamily:F_DISPLAY, color:i===0?T.lime:i===1?T.cyan:i===2?T.violet:T.inkFaint }}>{i+1}</div>
                      <div style={{ width:40, height:40, borderRadius:12, background:`hsl(${(salespeople.indexOf(sp)*67)%360},55%,42%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", fontFamily:F_DISPLAY, flexShrink:0 }}>{sp.name.slice(0,2).toUpperCase()}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <span style={{ fontWeight:700, fontSize:15, fontFamily:F_DISPLAY }}>{sp.name}</span>
                          {isTop && <span style={{ fontSize:9, background:T.gradLime, color:T.bg, borderRadius:6, padding:"2px 7px", fontWeight:700, fontFamily:F_MONO }}>★ TÊTE</span>}
                        </div>
                        <div style={{ display:"flex", gap:11, marginTop:4, fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>
                          <span style={{color:T.cyan}}>☏{st.contacts}</span><span style={{color:T.violet}}>◷{st.rdv}</span><span style={{color:T.lime}}>⟳{conv}%</span>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:17, fontWeight:700, fontFamily:F_DISPLAY, color:isTop?T.lime:T.ink, lineHeight:1 }}>{fmt(st.ca)}</div>
                        <div style={{ fontSize:9, color:T.inkFaint, marginTop:3, fontFamily:F_MONO }}>{pct.toFixed(0)}% du leader</div>
                      </div>
                    </div>
                    <div style={{ height:3, background:T.bg, borderRadius:2, overflow:"hidden", marginTop:10 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:i===0?T.gradLime:i===1?T.gradCyan:T.violet, borderRadius:2, transition:"width .6s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ CHAT ═══ */}
        {tab==="chat" && <div className="rise"><ChatTab salespeople={salespeople} currentUser={currentUser} /></div>}
      </main>

      {/* BOTTOM NAV */}
      <nav className="navbar">
        {TABS.map(t=>(
          <button key={t.k} className={`navb press${tab===t.k?" on":""}`} onClick={()=>setTab(t.k)}>
            <span className="ni">{t.icon}</span>
            <span className="nl">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:T.lime, marginBottom:12, fontFamily:F_MONO, letterSpacing:1.5 }}>{children}</div>;
}
function Lbl({ t, children }) {
  return <div><div style={{ fontSize:11, color:T.inkFaint, marginBottom:6, fontFamily:F_MONO, letterSpacing:0.5 }}>{t}</div>{children}</div>;
}
function Sel({ value, onChange, inp, children }) {
  return <div style={{ position:"relative" }}><select className="ff" style={{ ...inp, paddingRight:30 }} value={value} onChange={onChange}>{children}</select><span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:T.inkFaint, pointerEvents:"none", fontSize:10 }}>▼</span></div>;
}
function ChartCard({ title, sub, children }) {
  return (
    <div style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:18, padding:18 }}>
      <div style={{ fontSize:14, fontWeight:700, fontFamily:F_DISPLAY, marginBottom:2 }}>{title}</div>
      <div style={{ fontSize:11, color:T.inkFaint, marginBottom:16, fontFamily:F_MONO }}>{sub}</div>
      {children}
    </div>
  );
}
