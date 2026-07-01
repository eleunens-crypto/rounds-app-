"use client"

import Link from "next/link"

export default function Home() {
  return (
    <div style={S.page}>
      <div style={{ maxWidth: 360, margin: "0 auto", padding: "30px 0 40px" }}>

        {/* Kop: algemeen Rundo-logo (symbool + naam in één), ondertitel eronder */}
        <div style={{ textAlign: "center", marginTop: 10, marginBottom: 30 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-logo.png" alt="Rundo" style={{ display: "block", height: 64, width: "auto", maxWidth: "90%", objectFit: "contain", margin: "0 auto 8px" }} />
          <p style={{ color: "#f2e3a8", fontSize: 15, fontWeight: 600, margin: 0 }}>
            Rondjes en rekeningen zonder gedoe!
          </p>
        </div>

        <p style={{ textAlign: "right", color: "#7e879c", fontSize: 12.5, fontWeight: 600, margin: "0 4px 8px 0" }}>
          Kies je mode om te starten
        </p>

        {/* PARTY-kaart — warm geel */}
        <Link href="/party" style={{ textDecoration: "none" }}>
          <div style={{ ...S.modeCard, ...S.partyCard }} className="rundo-card rundo-card-party">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/party-image.png" alt="" style={S.cardPhoto} />
            <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(90deg, #211c14 0%, #211c14 42%, rgba(33,28,20,0.85) 56%, rgba(33,28,20,0.35) 72%, rgba(33,28,20,0) 100%)" }} />
            <div style={S.cardBody}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/rundo-party-logo.png" alt="Rundo Party" style={{ display: "block", height: 46, width: "auto", maxWidth: "100%", objectFit: "contain", marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={S.infoBadge}>i</span>
                <p style={{ fontSize: 13.5, color: "#d8dced", lineHeight: 1.55, margin: 0 }}>
                  Ideaal op fuiven, festivals, vrijgezellenfeesten, teambuildings enz.
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* TABLE-kaart — koel blauw */}
        <Link href="/table" style={{ textDecoration: "none" }}>
          <div style={{ ...S.modeCard, ...S.tableCard }} className="rundo-card rundo-card-table">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/table-image.png" alt="" style={S.cardPhoto} />
            <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(90deg, #131e2b 0%, #131e2b 42%, rgba(19,30,43,0.85) 56%, rgba(19,30,43,0.35) 72%, rgba(19,30,43,0) 100%)" }} />
            <div style={S.cardBody}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/rundo-table-logo.png" alt="Rundo Table" style={{ display: "block", height: 46, width: "auto", maxWidth: "100%", objectFit: "contain", marginBottom: 14 }} />
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ ...S.infoBadge, background: "rgba(91,159,214,0.22)", color: "#9cc6ec" }}>i</span>
                <p style={{ fontSize: 13.5, color: "#d8dced", lineHeight: 1.55, margin: 0 }}>
                  Scan een bon (op restaurant, café of na activiteit), kies je items en betaal alleen jouw deel.
                </p>
              </div>
            </div>
          </div>
        </Link>

        {/* Voetregel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-symbol.png" alt="" style={{ display: "block", height: 30, width: "auto", objectFit: "contain" }} />
          <span style={{ fontSize: 13, color: "#9aa2b8", fontWeight: 600, textAlign: "center" }}>
            Gratis · geen registratie · eerlijk splitten
          </span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0e1119; }
        .rundo-card { transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease; }
        .rundo-card-party:hover { transform: translateY(-2px); border-color: rgba(240,193,75,0.55); box-shadow: 0 20px 44px -18px rgba(240,193,75,0.35); }
        .rundo-card-table:hover { transform: translateY(-2px); border-color: rgba(91,159,214,0.55); box-shadow: 0 20px 44px -18px rgba(91,159,214,0.35); }
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
    padding: "18px 22px",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  modeCard: {
    position: "relative",
    borderRadius: 24,
    marginBottom: 16,
    cursor: "pointer",
    overflow: "hidden",
  },
  cardBody: {
    position: "relative",
    zIndex: 2,
    padding: "20px 22px 20px",
    maxWidth: "74%",
  },
  cardPhoto: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "62%",
    objectFit: "cover",
    display: "block",
    zIndex: 0,
    filter: "brightness(1.18) saturate(0.92)",
  },
  // Party: warme gele gloed
  partyCard: {
    background: "#211c14",
    border: "1px solid rgba(240,193,75,0.28)",
    boxShadow: "0 12px 34px -18px rgba(240,193,75,0.25)",
  },
  // Table: koele blauwe gloed
  tableCard: {
    background: "#131e2b",
    border: "1px solid rgba(91,159,214,0.28)",
    boxShadow: "0 12px 34px -18px rgba(91,159,214,0.25)",
  },
  infoBadge: {
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "rgba(240,193,75,0.22)",
    color: "#f0c14b",
    fontSize: 11,
    fontWeight: 800,
    fontStyle: "italic",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    fontFamily: "Georgia, serif",
  },
  goRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 14,
    fontSize: 14,
    fontWeight: 800,
  },
}
