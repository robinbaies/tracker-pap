// ═══════════════════════════════════════════════════════════════
//  FIELD COMMAND — Design System
//  Une identité "poste de commandement terrain" : encre nuit profonde,
//  électrique cyan/lime énergique, accents chaleureux ambre.
// ═══════════════════════════════════════════════════════════════

export const T = {
  // Backgrounds — bleu nuit encre, pas le noir générique
  bg:        "#0B1120",   // fond principal (bleu encre profond)
  bgSoft:    "#111A2E",   // panneau
  bgCard:    "#16223A",   // carte
  bgCardHi:  "#1C2B49",   // carte survol / active
  line:      "#243352",   // bordures

  // Accents — palette énergique multi-tons (fini le mono orange)
  lime:      "#A3E635",   // signature — vert lime électrique (croissance, GO)
  cyan:      "#22D3EE",   // contacts (frais, prospection)
  violet:    "#A78BFA",   // RDV (rendez-vous, engagement)
  amber:     "#FBBF24",   // CA / argent (chaleur, valeur)
  rose:      "#FB7185",   // alertes / perdu
  emerald:   "#34D399",   // succès / signé

  // Texte
  ink:       "#F1F5F9",   // texte principal
  inkSoft:   "#94A3B8",   // texte secondaire
  inkFaint:  "#516079",   // texte tertiaire
  inkGhost:  "#2E3D5C",   // texte fantôme / vide

  // Gradients signatures
  gradLime:  "linear-gradient(135deg, #A3E635, #65D94B)",
  gradCyan:  "linear-gradient(135deg, #22D3EE, #3B82F6)",
  gradHero:  "linear-gradient(135deg, #A3E635 0%, #22D3EE 100%)",
  gradAmber: "linear-gradient(135deg, #FBBF24, #FB923C)",
};

// Couleurs métriques cohérentes partout
export const METRIC = {
  contacts: T.cyan,
  rdv:      T.violet,
  ca:       T.amber,
  conv:     T.lime,
};

export const ZONE_PALETTE = ["#22D3EE","#A78BFA","#A3E635","#FBBF24","#FB7185","#34D399","#60A5FA","#F472B6","#FACC15","#2DD4BF"];

export const STATUTS = [
  { key: "nouveau",    label: "Nouveau",   short:"NOUV", color: "#22D3EE", icon:"✦" },
  { key: "a_rappeler", label: "À rappeler", short:"RAPPEL", color: "#FBBF24", icon:"↻" },
  { key: "rdv_pris",   label: "RDV pris",   short:"RDV", color: "#A78BFA", icon:"◷" },
  { key: "signe",      label: "Signé",      short:"SIGNÉ", color: "#34D399", icon:"✓" },
  { key: "perdu",      label: "Perdu",      short:"PERDU", color: "#FB7185", icon:"✕" },
];

// Police : Space Grotesk (display, technique/moderne) + Inter (body) + Space Mono (data)
export const FONTS_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');";
export const F_DISPLAY = "'Space Grotesk', sans-serif";
export const F_BODY = "'Inter', sans-serif";
export const F_MONO = "'Space Mono', monospace";

export const fmt = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
export const fmtK = (v) => v >= 1000 ? `${(v/1000).toFixed(v >= 10000 ? 0 : 1)}k€` : `${Math.round(v)}€`;
export const todayStr = () => new Date().toISOString().slice(0, 10);
export const dateLabel = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
