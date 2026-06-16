import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { T, F_DISPLAY, F_MONO } from "./theme";

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
    const unsub = onSnapshot(q, snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content || !currentUser || sending) return;
    setSending(true);
    await addDoc(collection(db, "messages"), { content, senderName: currentUser.name, senderRole: currentUser.role, createdAt: serverTimestamp() });
    setText(""); setSending(false);
  };

  const inp = { background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:12, padding:"13px 16px", color:T.ink, fontSize:16, fontFamily:F_DISPLAY, width:"100%", WebkitAppearance:"none" };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 200px)" }}>
      <div style={{ background:T.bgCard, border:`1px solid ${T.line}`, borderRadius:16, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:T.lime, boxShadow:`0 0 8px ${T.lime}` }} />
          <span style={{ fontSize:14, fontWeight:600, fontFamily:F_DISPLAY }}>Canal équipe</span>
        </div>
        <span style={{ fontSize:11, color:T.inkFaint, fontFamily:F_MONO }}>{salespeople.length + 1} MEMBRES</span>
      </div>

      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, paddingBottom:8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:T.inkGhost }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📡</div>
            <div style={{ fontSize:13, color:T.inkFaint }}>Canal silencieux. Lancez la première transmission.</div>
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
                  <span style={{ fontSize:11, fontWeight:700, color:isManager?T.amber:T.cyan, fontFamily:F_MONO }}>
                    {msg.senderName}{isManager&&" ★"}
                  </span>
                </div>
              )}
              <div style={{
                maxWidth:"82%",
                background:isMe?T.gradLime:isManager?`${T.amber}1A`:T.bgCard,
                border:isMe?"none":isManager?`1px solid ${T.amber}44`:`1px solid ${T.line}`,
                borderRadius:isMe?"16px 16px 5px 16px":"16px 16px 16px 5px",
                padding:"10px 14px",
              }}>
                <div style={{ fontSize:14, color:isMe?T.bg:T.ink, lineHeight:1.45, wordBreak:"break-word", fontWeight:isMe?500:400 }}>{msg.content}</div>
                <div style={{ fontSize:10, color:isMe?"rgba(11,17,32,0.5)":T.inkFaint, marginTop:4, textAlign:isMe?"right":"left", fontFamily:F_MONO }}>{timeAgo(msg.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display:"flex", gap:10, paddingTop:10, borderTop:`1px solid ${T.line}` }}>
        <input style={{ ...inp, flex:1, borderRadius:24 }} placeholder="Transmettre un message..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} />
        <button onClick={send} disabled={!text.trim()||sending} style={{
          width:50, height:50, borderRadius:25, flexShrink:0,
          background:text.trim()?T.gradLime:T.bgCard, color:T.bg, fontSize:20,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:text.trim()?`0 4px 16px ${T.lime}55`:"none", transition:"all .2s", border:"none",
        }}>➤</button>
      </div>
    </div>
  );
}
