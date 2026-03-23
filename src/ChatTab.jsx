import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";

const ROLE_COLORS = { manager: "#f97316", commercial: "#38bdf8" };

function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff/60)}min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"short" });
}

export default function ChatTab({ salespeople, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"), limit(200));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content || !currentUser || sending) return;
    setSending(true);
    await addDoc(collection(db, "messages"), {
      content,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      createdAt: serverTimestamp(),
    });
    setText("");
    setSending(false);
  };

  const inp = { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:16, fontFamily:"inherit", width:"100%", WebkitAppearance:"none" };

  if (!currentUser) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:8, fontFamily:"'Syne',sans-serif" }}>Messagerie équipe</div>
        <div style={{ fontSize:13, color:"#6b7280" }}>Identifie-toi pour accéder au chat.</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 180px)" }}>
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#34d399", boxShadow:"0 0 6px #34d399" }} />
          <span style={{ fontSize:13, fontWeight:600 }}>Chat général</span>
          <span style={{ fontSize:11, color:"#6b7280" }}>{salespeople.length + 1} membres</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:`${ROLE_COLORS[currentUser.role]}22`, border:`1px solid ${ROLE_COLORS[currentUser.role]}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:ROLE_COLORS[currentUser.role] }}>
            {currentUser.name.slice(0,2).toUpperCase()}
          </div>
          <span style={{ fontSize:12, color:"#9ca3af" }}>{currentUser.name} {currentUser.role==="manager"&&"👑"}</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, paddingBottom:8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:"#374151" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>👋</div>
            <div style={{ fontSize:13 }}>Soyez le premier à écrire !</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.senderName === currentUser.name;
          const isManager = msg.senderRole === "manager";
          const showName = i === 0 || messages[i-1].senderName !== msg.senderName;
          return (
            <div key={msg.id} style={{ display:"flex", flexDirection:"column", alignItems:isMe?"flex-end":"flex-start" }}>
              {showName && !isMe && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, marginLeft:4 }}>
                  <div style={{ width:22, height:22, borderRadius:6, background:`${ROLE_COLORS[msg.senderRole]||"#6b7280"}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:ROLE_COLORS[msg.senderRole]||"#9ca3af" }}>
                    {msg.senderName?.slice(0,2).toUpperCase()}
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color:isManager?"#f97316":"#9ca3af" }}>
                    {msg.senderName}{isManager&&" 👑"}
                  </span>
                </div>
              )}
              <div style={{
                maxWidth:"80%",
                background:isMe?"linear-gradient(135deg,#f97316,#fb923c)":isManager?"rgba(249,115,22,0.1)":"rgba(255,255,255,0.06)",
                border:isMe?"none":isManager?"1px solid rgba(249,115,22,0.2)":"1px solid rgba(255,255,255,0.08)",
                borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
                padding:"10px 14px",
              }}>
                <div style={{ fontSize:14, color:"#fff", lineHeight:1.4, wordBreak:"break-word" }}>{msg.content}</div>
                <div style={{ fontSize:10, color:isMe?"rgba(255,255,255,0.6)":"#4b5563", marginTop:4, textAlign:isMe?"right":"left" }}>
                  {timeAgo(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display:"flex", gap:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
        <input
          style={{ ...inp, flex:1, borderRadius:24, padding:"12px 18px" }}
          placeholder="Écrire un message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
        />
        <button onClick={send} disabled={!text.trim()||sending} style={{
          width:48, height:48, borderRadius:24, flexShrink:0,
          background:text.trim()?"linear-gradient(135deg,#f97316,#fb923c)":"rgba(255,255,255,0.07)",
          color:"#fff", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:text.trim()?"0 2px 12px #f9731444":"none", transition:"all .2s",
        }}>➤</button>
      </div>
    </div>
  );
}
