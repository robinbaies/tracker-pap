import { useEffect, useState } from "react";
import { T, F_DISPLAY, F_MONO, fmt } from "./theme";

// ═══════════════════════════════════════════════════════════════
//  SIGNATURE — Le "Radar de Conquête"
//  Trois anneaux concentriques (Contacts / RDV / CA) qui se
//  remplissent vers l'objectif. Cœur = CA total du jour. Animé.
// ═══════════════════════════════════════════════════════════════
export default function Radar({ totals, targets }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      setAnim(1 - Math.pow(1 - p, 3)); // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totals.contacts, totals.rdv, totals.ca]);

  const rings = [
    { val: totals.contacts, max: targets.contacts || totals.contacts || 1, color: T.cyan,   r: 86, label:"CONTACTS" },
    { val: totals.rdv,      max: targets.rdv || totals.rdv || 1,           color: T.violet, r: 66, label:"RDV" },
    { val: totals.ca,       max: targets.ca || totals.ca || 1,             color: T.amber,  r: 46, label:"CA" },
  ];

  const C = 110; // centre
  return (
    <div style={{ position:"relative", width:220, height:220, margin:"0 auto" }}>
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform:"rotate(-90deg)" }}>
        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const pct = Math.min(1, ring.max > 0 ? ring.val / ring.max : 0) * anim;
          return (
            <g key={i}>
              <circle cx={C} cy={C} r={ring.r} fill="none" stroke={T.line} strokeWidth="9" opacity="0.5" />
              <circle cx={C} cy={C} r={ring.r} fill="none" stroke={ring.color} strokeWidth="9"
                strokeLinecap="round" strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                style={{ filter:`drop-shadow(0 0 6px ${ring.color}88)` }} />
            </g>
          );
        })}
      </svg>
      {/* Centre */}
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:9, letterSpacing:2, color:T.inkFaint, fontFamily:F_MONO }}>CA ÉQUIPE</div>
        <div style={{ fontSize:26, fontWeight:700, fontFamily:F_DISPLAY, color:T.ink, lineHeight:1.1, marginTop:2 }}>
          {fmt(totals.ca)}
        </div>
        <div style={{ display:"flex", gap:8, marginTop:6 }}>
          <Pip color={T.cyan} v={totals.contacts} />
          <Pip color={T.violet} v={totals.rdv} />
        </div>
      </div>
    </div>
  );
}

function Pip({ color, v }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}` }} />
      <span style={{ fontSize:13, fontWeight:700, color:T.ink, fontFamily:F_MONO }}>{v}</span>
    </div>
  );
}
