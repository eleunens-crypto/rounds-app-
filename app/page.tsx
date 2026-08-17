"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLang, LanguageToggle } from "@/lib/i18n"

const T = {
  nl: {
    tagline: "Rondjes en rekeningen zonder gedoe!",
    partySub: "Rondjes opnemen en splitten zonder gedoe",
    // De ℹ️-uitleg en de vier losse iconen zijn samengevoegd tot één stappenflow:
    // stap 1 heeft twee manieren (zelf opnemen óf QR scannen), vandaar twee iconen.
    partyFlow: [
      { iconen: ["✍️", "📱"], label: "neem op\nof scan QR" },
      { iconen: ["📋"], label: "barlijstje" },
      { iconen: ["⚖️"], label: "eerlijk\nafrekenen" },
    ],
    orWord: "of",
    tableSteps: ["scan bon", "QR groep", "duid aan", "ieders deel"],
    tableSub: "Scan de rekening en verdeel in groep",
    tableDesc: "Voor het delen van de rekening op restaurant, café of na een activiteit.",
    start: "Starten",
    pickFirst: "Kies eerst een mode",
    footer: "Gratis · geen registratie · eerlijk splitten",
  },
  fr: {
    tagline: "Tournées et additions, sans prise de tête !",
    partySub: "Prendre les tournées et partager, sans prise de tête",
    partyFlow: [
      { iconen: ["✍️", "📱"], label: "note toi-même\nou scanne le QR" },
      { iconen: ["📋"], label: "liste bar" },
      { iconen: ["⚖️"], label: "règle\néquitable" },
    ],
    orWord: "ou",
    tableSteps: ["scan", "QR groupe", "coche", "part de chacun"],
    tableSub: "Scanne l'addition et partage en groupe",
    tableDesc: "Pour partager l'addition au resto, au café ou après une activité.",
    start: "Démarrer",
    pickFirst: "Choisis d'abord un mode",
    footer: "Gratuit · sans inscription · partage équitable",
  },
}

type Mode = "table" | "party"

export default function Home() {
  const [lang] = useLang()
  const t = T[lang]
  const router = useRouter()
  // Kiezen en starten zijn hier twee stappen: je duidt een kaart aan, leest desgewenst
  // eerst de uitleg, en start dan pas. Zo tik je nooit ongewild een modus binnen.
  const [pick, setPick] = useState<Mode | null>(null)

  // Op het keuzescherm: wis de actieve mode-sessies, zodat je vanaf hier altijd op het
  // startscherm van een modus binnenkomt (nooit meteen in een opgeslagen groep).
  useEffect(() => {
    try {
      sessionStorage.removeItem("rundo_party_session")
      sessionStorage.removeItem("rundo_table_session")
    } catch { /* sessionStorage niet beschikbaar */ }
  }, [])

  // Accentkleur per modus — dezelfde die de kaart al gebruikt.
  const accent = { table: "#5b9fd6", party: "#f0c14b" }

  // Een niet-gekozen kaart dimmen zodra er een keuze is: dat maakt de selectie zichtbaar
  // zonder dat er een extra kader bij hoeft.
  const cardState = (m: Mode): React.CSSProperties => ({
    opacity: pick === null || pick === m ? 1 : 0.45,
    border: pick === m
      ? `2px solid ${accent[m]}`
      : `1px solid ${m === "party" ? "rgba(240,193,75,0.28)" : "rgba(91,159,214,0.28)"}`,
    boxShadow: pick === m
      ? `0 18px 40px -18px ${m === "party" ? "rgba(240,193,75,0.45)" : "rgba(91,159,214,0.45)"}`
      : `0 12px 34px -18px ${m === "party" ? "rgba(240,193,75,0.25)" : "rgba(91,159,214,0.25)"}`,
  })

  // De uitleg zelf: alleen zichtbaar voor de gekozen kaart. Hij loopt door tot de
  // rechterrand, zodat de foto er als achtergrond doorheen blijft schemeren.
  const infoRow = (m: Mode, tekst: string, stappen: string[], iconen: string[], badge: React.CSSProperties) => (
    pick !== m ? null : (
      <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 13 }}>
          <span style={badge}>i</span>
          <p style={{ fontSize: 14.5, color: "#e6eaf6", lineHeight: 1.5, margin: 0 }}>{tekst}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, textAlign: "center" }}>
          {stappen.map((st, i) => (
            <span key={st} style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 21, lineHeight: 1.1 }}>{iconen[i]}</span>
              <span style={{ display: "block", fontSize: 11, color: "#b9c1d6", marginTop: 4, lineHeight: 1.3 }}>{st}</span>
            </span>
          ))}
        </div>
      </div>
    )
  )

  // De stappenflow (Party): genummerde bolletjes in plaats van infotekst + iconenrij.
  // Een stap kan twee iconen dragen — dan staat er een klein "of" tussen en delen ze
  // één nummer, zodat duidelijk is dat het twee manieren voor dezelfde stap zijn.
  const flowRow = (m: Mode, stappen: { iconen: string[]; label: string }[]) => {
    const bolBg = m === "party" ? "rgba(240,193,75,0.14)" : "rgba(91,159,214,0.14)"
    const bolRand = m === "party" ? "rgba(240,193,75,0.45)" : "rgba(91,159,214,0.45)"
    return pick !== m ? null : (
      <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {stappen.map((st, i) => (
            <div key={i} style={{ flex: st.iconen.length > 1 ? 1.6 : 1, minWidth: 0, textAlign: "center" }}>
              <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", gap: 5, width: "max-content", margin: "0 auto" }}>
                {st.iconen.map((ic, k) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {k > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#b9a67c" }}>{t.orWord}</span>}
                    <span style={{ width: 34, height: 34, borderRadius: "50%", background: bolBg, border: `1px solid ${bolRand}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{ic}</span>
                  </span>
                ))}
                <span style={{ position: "absolute", top: -5, right: -7, width: 15, height: 15, borderRadius: "50%", background: accent[m], color: "#131826", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              </div>
              <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: "#d9d2bd", lineHeight: 1.3, whiteSpace: "pre-line" }}>{st.label}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const vinkje = (m: Mode) => (
    pick === m ? (
      <span style={{
        position: "absolute", top: 14, right: 14, zIndex: 3, width: 30, height: 30, borderRadius: "50%",
        background: accent[m], color: "#131826", fontSize: 17, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
      }}>✓</span>
    ) : null
  )

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 360, margin: "0 auto", padding: "30px 0 40px" }}>
        {/* Taalkeuze rechtsboven */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <LanguageToggle />
        </div>

        {/* Kop: algemeen Rundo-logo (symbool + naam in één), ondertitel eronder */}
        <div style={{ textAlign: "center", marginTop: 4, marginBottom: 30 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-logo.png" alt="Rundo" style={{ display: "block", height: 64, width: "auto", maxWidth: "90%", objectFit: "contain", margin: "0 auto 8px" }} />
          <p style={{ color: "#f2e3a8", fontSize: 15, fontWeight: 600, margin: 0 }}>
            {t.tagline}
          </p>
        </div>

        {/* TABLE-kaart — koel blauw */}
        <div onClick={() => setPick("table")} style={{ ...S.modeCard, ...S.tableCard, ...cardState("table") }} className="rundo-card rundo-card-table">
          {vinkje("table")}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/table-image.png" alt="" style={S.cardPhoto} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1, transition: "background .2s ease",
            background: pick === "table"
              ? "linear-gradient(90deg, #131e2b 0%, #131e2b 46%, rgba(19,30,43,0.94) 62%, rgba(19,30,43,0.78) 82%, rgba(19,30,43,0.6) 100%)"
              : "linear-gradient(90deg, #131e2b 0%, #131e2b 42%, rgba(19,30,43,0.85) 56%, rgba(19,30,43,0.35) 72%, rgba(19,30,43,0) 100%)" }} />
          <div style={{ ...S.cardBody, maxWidth: pick === "table" ? "100%" : "74%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-table-logo.png" alt="Rundo Table" style={{ display: "block", height: 46, width: "auto", maxWidth: "100%", objectFit: "contain", marginBottom: 6 }} />
            <div style={{ ...S.logoSub, color: "#3bbfc4", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-table.png" alt="" style={{ height: 24, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.tableSub}</span>
            </div>
            {infoRow("table", t.tableDesc, t.tableSteps, ["📷", "📱", "👆", "💶"], { ...S.infoBadge, background: "rgba(91,159,214,0.22)", color: "#9cc6ec" })}
          </div>
        </div>

        {/* PARTY-kaart — warm geel */}
        <div onClick={() => setPick("party")} style={{ ...S.modeCard, ...S.partyCard, ...cardState("party") }} className="rundo-card rundo-card-party">
          {vinkje("party")}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/party-image.png" alt="" style={S.cardPhoto} />
          {/* Warme gloed die de foto iets verlicht */}
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "62%", zIndex: 1, background: "radial-gradient(120% 90% at 88% 32%, rgba(255,214,130,0.42) 0%, rgba(255,190,90,0.16) 42%, rgba(255,190,90,0) 72%)", mixBlendMode: "screen", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1, transition: "background .2s ease",
            background: pick === "party"
              ? "linear-gradient(90deg, #211c14 0%, #211c14 46%, rgba(33,28,20,0.94) 62%, rgba(33,28,20,0.78) 82%, rgba(33,28,20,0.6) 100%)"
              : "linear-gradient(90deg, #211c14 0%, #211c14 42%, rgba(33,28,20,0.85) 56%, rgba(33,28,20,0.35) 72%, rgba(33,28,20,0) 100%)" }} />
          <div style={{ ...S.cardBody, maxWidth: pick === "party" ? "100%" : "74%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-party-logo.png" alt="Rundo Party" style={{ display: "block", height: 46, width: "auto", maxWidth: "100%", objectFit: "contain", marginBottom: 6 }} />
            <div style={{ ...S.logoSub, color: "#f0a500", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-party.png" alt="" style={{ height: 24, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.partySub}</span>
            </div>
            {flowRow("party", t.partyFlow)}
          </div>
        </div>

        {/* Eén startknop: hij kleurt mee met de gekozen kaart, en blijft rustig zolang
            er niets gekozen is. */}
        <button
          onClick={() => { if (pick) router.push(pick === "table" ? "/table" : "/party") }}
          disabled={pick === null}
          style={{
            width: "100%", marginTop: 4, padding: "17px 18px", borderRadius: 16, border: "none",
            fontSize: 19, fontWeight: 800, fontFamily: "inherit",
            cursor: pick === null ? "default" : "pointer",
            background: pick === null ? "rgba(255,255,255,0.07)" : accent[pick],
            color: pick === null ? "#7e879c" : "#131826",
            boxShadow: pick === null ? "none" : `0 14px 30px -14px ${accent[pick]}`,
            transition: "background .15s ease, color .15s ease, box-shadow .15s ease",
          }}>
          {pick === null ? t.pickFirst : t.start}
        </button>

        {/* Voetregel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 28 }}>
          <span style={{ fontSize: 13, color: "#9aa2b8", fontWeight: 600, textAlign: "center" }}>
            {t.footer}
          </span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0e1119; }
        .rundo-card { transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease; }
        .rundo-card-party:hover { transform: translateY(-2px); border-color: rgba(240,193,75,0.55); }
        .rundo-card-table:hover { transform: translateY(-2px); border-color: rgba(91,159,214,0.55); }
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
    marginBottom: 22,
    cursor: "pointer",
    overflow: "hidden",
  },
  cardBody: {
    position: "relative",
    zIndex: 2,
    padding: "20px 22px 20px",
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
  },
  // Table: koele blauwe gloed
  tableCard: {
    background: "#131e2b",
  },
  logoSub: {
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: -0.2,
    lineHeight: 1.2,
    fontFamily: "'Nunito', 'Baloo 2', 'DM Sans', -apple-system, 'Segoe UI', sans-serif",
  },
  infoBadge: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "rgba(240,193,75,0.22)",
    color: "#f0c14b",
    fontSize: 13,
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
