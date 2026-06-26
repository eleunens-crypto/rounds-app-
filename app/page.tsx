"use client"

import Link from "next/link"

// Rundo-logo: gouden cirkel met witte R en een loop-pijl (rondjes)
function RundoLogo({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <circle cx="60" cy="60" r="56" fill="#F5C518" />
      <path d="M88 36 A36 36 0 1 0 96 60" fill="none" stroke="#1b2a4a" strokeWidth="9" strokeLinecap="round" />
      <path d="M88 33 L85 53 L104 49 Z" fill="#1b2a4a" />
      <text x="60" y="84" textAnchor="middle" fontFamily="'DM Sans', Arial, sans-serif" fontSize="64" fontWeight="800" fill="#ffffff">R</text>
    </svg>
  )
}

export default function Home() {
  return (
    <div style={S.page}>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "30px 0 50px" }}>

        {/* Kop: logo + naam + slogan */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <RundoLogo size={84} />
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1.5, margin: 0, color: "#ffffff", lineHeight: 1 }}>Rundo</h1>
          <p style={{ color: "#c9a23a", fontSize: 15, fontWeight: 600, margin: "10px 0 0" }}>
            Rondjes, rekeningen &amp; eerlijk splitten zonder gedoe!
          </p>
        </div>

        <p style={{ textAlign: "center", color: "#b9c0d4", fontSize: 16, fontWeight: 600, marginBottom: 22 }}>
          Kies je mode om te starten
        </p>

        {/* PARTY-kaart */}
        <Link href="/party" style={{ textDecoration: "none" }}>
          <div style={S.modeCard} className="rundo-mode-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 30 }}>🍻</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#f0c14b", letterSpacing: -0.5 }}>PARTY</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.25 }}>
              Samen bestellen, rondjes &amp; fair split
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, color: "#8a93a8", flexShrink: 0, lineHeight: 1.4 }}>ⓘ</span>
              <p style={{ fontSize: 13.5, color: "#aeb6cc", lineHeight: 1.55, margin: 0 }}>
                Voor rondjes, bestellingen of pot leggen op fuiven, festivals, vrijgezellen, teambuildings en meer.
              </p>
            </div>
            <div style={S.goRow}>Openen <span style={{ fontSize: 18 }}>→</span></div>
          </div>
        </Link>

        {/* TABLE-kaart */}
        <Link href="/table" style={{ textDecoration: "none" }}>
          <div style={S.modeCard} className="rundo-mode-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 30 }}>🧾</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: "#5bb6a0", letterSpacing: -0.5 }}>TABLE</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.25 }}>
              Scan de rekening, betaal je deel
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ fontSize: 15, color: "#8a93a8", flexShrink: 0, lineHeight: 1.4 }}>ⓘ</span>
              <p style={{ fontSize: 13.5, color: "#aeb6cc", lineHeight: 1.55, margin: 0 }}>
                Scan een bon (op restaurant, café of na activiteit), kies je items en betaal alleen jouw deel.
              </p>
            </div>
            <div style={S.goRow}>Openen <span style={{ fontSize: 18 }}>→</span></div>
          </div>
        </Link>

        {/* Voetregel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 26 }}>
          <RundoLogo size={30} />
          <span style={{ fontSize: 13, color: "#9aa2b8", fontWeight: 600, textAlign: "center" }}>
            Gratis · Geen registratie nodig · Eindelijk eerlijk splitten
          </span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        .rundo-mode-card { transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
        .rundo-mode-card:hover { transform: translateY(-2px); border-color: rgba(245,197,24,0.4); box-shadow: 0 18px 40px -16px rgba(0,0,0,0.6); }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    background: "radial-gradient(1200px 600px at 50% -10%, #1c2540 0%, #131826 55%, #0e1119 100%)",
    minHeight: "100vh",
    color: "#fff",
    padding: 18,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  modeCard: {
    background: "linear-gradient(180deg, rgba(30,38,60,0.9), rgba(22,28,44,0.9))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: "20px 22px",
    marginBottom: 16,
    boxShadow: "0 10px 30px -16px rgba(0,0,0,0.7)",
    cursor: "pointer",
  },
  goRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 14,
    fontSize: 14,
    fontWeight: 800,
    color: "#f0c14b",
  },
}
