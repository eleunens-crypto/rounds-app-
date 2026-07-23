"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLang, LanguageToggle } from "@/lib/i18n"

const T = {
  nl: {
    tagline: "Rondjes en rekeningen zonder gedoe!",
    chooseMode: "Kies je mode om te starten",
    partySub: "Rondjes opnemen en splitten zonder gedoe",
    partyDesc: "Ideaal voor groepsbestellingen op café of andere events (fuif, festival, afterwork..)",
    tableSub: "Scan de rekening en verdeel in groep",
    tableDesc: "Ideaal als groep op restaurant, café of na activiteit.",
    whenChoose: "Wanneer kies ik dit?",
    start: "Starten",
    pickFirst: "Kies eerst een mode",
    footer: "Gratis · geen registratie · eerlijk splitten",
  },
  fr: {
    tagline: "Tournées et additions, sans prise de tête !",
    chooseMode: "Choisis ton mode pour démarrer",
    partySub: "Prendre les tournées et partager, sans prise de tête",
    partyDesc: "Idéal pour les commandes de groupe au café ou autres events (soirée, festival, afterwork..)",
    tableSub: "Scanne l'addition et partage en groupe",
    tableDesc: "Idéal en groupe au resto, au café ou après une activité.",
    whenChoose: "Quand choisir ceci ?",
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
  const [openInfo, setOpenInfo] = useState<Mode | null>(null)

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

  const infoRow = (m: Mode, tekst: string, kleur: string, badge: React.CSSProperties) => (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpenInfo(openInfo === m ? null : m) }}
        style={{
          display: "block", width: "100%", textAlign: "left", marginTop: 14, paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.13)", border: "none", borderTopWidth: 1,
          borderTopStyle: "solid", borderTopColor: "rgba(255,255,255,0.13)",
          background: "none", cursor: "pointer", color: kleur, fontSize: 13.5, fontWeight: 800,
          fontFamily: "inherit", padding: "12px 0 0",
        }}>
        {t.whenChoose} {openInfo === m ? "▴" : "▾"}
      </button>
      {openInfo === m && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 11 }}>
          <span style={badge}>i</span>
          <p style={{ fontSize: 13.5, color: "#d8dced", lineHeight: 1.5, margin: 0 }}>{tekst}</p>
        </div>
      )}
    </>
  )

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

        <p style={{ textAlign: "right", color: "#7e879c", fontSize: 12.5, fontWeight: 600, margin: "0 4px 8px 0" }}>
          {t.chooseMode}
        </p>

        {/* TABLE-kaart — koel blauw */}
        <div onClick={() => setPick("table")} style={{ ...S.modeCard, ...S.tableCard, ...cardState("table") }} className="rundo-card rundo-card-table">
          {vinkje("table")}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/table-image.png" alt="" style={S.cardPhoto} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(90deg, #131e2b 0%, #131e2b 42%, rgba(19,30,43,0.85) 56%, rgba(19,30,43,0.35) 72%, rgba(19,30,43,0) 100%)" }} />
          <div style={S.cardBody}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-table-logo.png" alt="Rundo Table" style={{ display: "block", height: 46, width: "auto", maxWidth: "100%", objectFit: "contain", marginBottom: 6 }} />
            <div style={{ ...S.logoSub, color: "#3bbfc4", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-table.png" alt="" style={{ height: 24, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.tableSub}</span>
            </div>
            {infoRow("table", t.tableDesc, "#9cc6ec", { ...S.infoBadge, background: "rgba(91,159,214,0.22)", color: "#9cc6ec" })}
          </div>
        </div>

        {/* PARTY-kaart — warm geel */}
        <div onClick={() => setPick("party")} style={{ ...S.modeCard, ...S.partyCard, ...cardState("party") }} className="rundo-card rundo-card-party">
          {vinkje("party")}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/party-image.png" alt="" style={S.cardPhoto} />
          {/* Warme gloed die de foto iets verlicht */}
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "62%", zIndex: 1, background: "radial-gradient(120% 90% at 88% 32%, rgba(255,214,130,0.42) 0%, rgba(255,190,90,0.16) 42%, rgba(255,190,90,0) 72%)", mixBlendMode: "screen", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(90deg, #211c14 0%, #211c14 42%, rgba(33,28,20,0.85) 56%, rgba(33,28,20,0.35) 72%, rgba(33,28,20,0) 100%)" }} />
          <div style={S.cardBody}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-party-logo.png" alt="Rundo Party" style={{ display: "block", height: 46, width: "auto", maxWidth: "100%", objectFit: "contain", marginBottom: 6 }} />
            <div style={{ ...S.logoSub, color: "#f0a500", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-party.png" alt="" style={{ height: 24, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.partySub}</span>
            </div>
            {infoRow("party", t.partyDesc, "#f0c14b", S.infoBadge)}
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
