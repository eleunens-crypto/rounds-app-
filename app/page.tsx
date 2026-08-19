"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLang, LanguageToggle } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

const T = {
  nl: {
    tagline: "Rondjes en rekeningen zonder gedoe!",
    partySub: "Rondjes opnemen en splitten zonder gedoe",
    // De infozin staat zonder i-badge gecentreerd bóven de stappenflow — één blok:
    // de zin zegt wát je ermee kan, de bolletjes eronder hóe het loopt.
    partyDesc: "Neem zelf op, of deel de QR en iedereen bestelt zelf.",
    // Stap 1 heeft twee manieren (zelf opnemen óf QR scannen), vandaar twee iconen.
    partyFlow: [
      { iconen: ["✍️", "📱"], label: "neem zelf op\nof deel QR" },
      { iconen: ["👆"], label: "tik drankjes\naan" },
      { iconen: ["📋"], label: "handig barlijstje\nen afrekenen" },
    ],
    orWord: "of",
    yourGroups: "Jouw groepen",
    guestChip: "als gast",
    modeZelf: "Zelf opnemen",
    modeQr: "Via QR",
    closedChip: "afgesloten ✓",
    tableSub: "Scan de rekening en verdeel in groep",
    tableDesc: "Scan de bon op restaurant of café — ieder betaalt z'n deel.",
    tableFlow: [
      { iconen: ["📷"], label: "scan\nrekening" },
      { iconen: ["📱"], label: "deel QR" },
      { iconen: ["👆"], label: "tik aan\nwat je nam" },
      { iconen: ["💶"], label: "eerlijk\nverdeeld!" },
    ],
    start: "Starten",
    pickFirst: "Kies eerst een mode",
    pinOn: "Bewaren",
    pinOff: "Niet meer bewaren",
    maxPins: (n: number) => `Je kan maximaal ${n} groepen bewaren. Maak er eerst een los.`,
    openChip: "🟡 open",
    hiddenNote: (app: string) => `${app} verborgen`,
    footer: "Gratis · geen registratie · eerlijk splitten",
  },
  fr: {
    tagline: "Tournées et additions, sans prise de tête !",
    partySub: "Prendre les tournées et partager, sans prise de tête",
    partyDesc: "Note toi-même, ou partage le QR et chacun commande.",
    partyFlow: [
      { iconen: ["✍️", "📱"], label: "note toi-même\nou partage le QR" },
      { iconen: ["👆"], label: "coche les\nboissons" },
      { iconen: ["📋"], label: "liste bar pratique\net règlement" },
    ],
    orWord: "ou",
    yourGroups: "Tes groupes",
    guestChip: "invité",
    modeZelf: "Noter soi-même",
    modeQr: "Via QR",
    closedChip: "clôturé ✓",
    tableSub: "Scanne l'addition et partage en groupe",
    tableDesc: "Scanne l'addition au resto ou au café — chacun paie sa part.",
    tableFlow: [
      { iconen: ["📷"], label: "scanne\nl'addition" },
      { iconen: ["📱"], label: "partage\nle QR" },
      { iconen: ["👆"], label: "coche ce que\ntu as pris" },
      { iconen: ["💶"], label: "partagé\néquitablement !" },
    ],
    start: "Démarrer",
    pickFirst: "Choisis d'abord un mode",
    pinOn: "Enregistrer",
    pinOff: "Ne plus enregistrer",
    maxPins: (n: number) => `Tu peux garder ${n} groupes au maximum. Détaches-en un d'abord.`,
    openChip: "🟡 ouvert",
    hiddenNote: (app: string) => `${app} masqué`,
    footer: "Gratuit · sans inscription · partage équitable",
  },
}

type Mode = "table" | "party"

// Zelfde bewaaricoon als in Party en Table: gevulde diskette, met de subtiele
// schuine streep in de niet-bewaard-stand. Dit scherm is donker, dus de
// uitsparingen krijgen de donkere kaarttint mee in plaats van wit.
function BewaarIcoon({ aan, size = 17, gat = "#161b28" }: { aan: boolean; size?: number; gat?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }}>
      <path d="M4.5 6A1.5 1.5 0 0 1 6 4.5h9.6L19.5 8.4V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18z" fill="currentColor" />
      <path d="M9.2 5.4v3.2h5.6V5.4z" fill={gat} />
      <path d="M8.4 13.4h7.2v5.2H8.4z" fill={gat} />
      {!aan && (<>
        <path d="M3.4 20.6L20.6 3.4" stroke={gat} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M3.4 20.6L20.6 3.4" stroke="#8a93a3" strokeWidth="1.7" strokeLinecap="round" />
      </>)}
    </svg>
  )
}
// Zelfde plafond als in de apps zelf: bewaren blijft een keuze, geen standaard.
const MAX_PINS = 3

export default function Home() {
  const [lang] = useLang()
  const t = T[lang]
  const router = useRouter()
  // Kiezen en starten zijn hier twee stappen: je duidt een kaart aan, leest desgewenst
  // eerst de uitleg, en start dan pas. Zo tik je nooit ongewild een modus binnen.
  const [pick, setPick] = useState<Mode | null>(null)
  // Je opgeslagen Party-groepen, rechtstreeks uit dezelfde bron als de app zelf: het
  // toestel-id in localStorage plus de twee groepsqueries (eigen + als gast). Alleen
  // open groepen — vanaf een startscherm wil je ergens naartoe, niet terugkijken.
  // (Zelfde structuur staat klaar voor Table-groepen zodra die bron gekoppeld is.)
  type MiniGroep = { id: string; name: string; settle?: boolean; gast: boolean; af: boolean; pin: boolean; last: string; app: "party" | "table"; code?: string }
  const [groepen, setGroepen] = useState<MiniGroep[]>([])
  const [tafels, setTafels] = useState<MiniGroep[]>([])
  // Hoeveel er in totáál bewaard zijn, per app — geteld op de volledige lijsten vóór
  // het inkorten, want het plafond geldt voor alles, niet enkel wat hier zichtbaar is.
  const [pinTotaal, setPinTotaal] = useState<{ party: number; table: number }>({ party: 0, table: 0 })
  const [melding, setMelding] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === "undefined") return
    ;(async () => {
      // Twee aparte poortjes: het Party-toestel-id en het Table-id zijn verschillende
      // sleutels. Vroeger blokkeerde een ontbrekend Party-id óók de Table-lijst —
      // op een browser waar je alleen Table gebruikte bleef de sectie dan leeg.
      try {
        const dev = localStorage.getItem("rundo_device_id")
        if (!dev) throw new Error("geen party-id")
        const [eigen, gast] = await Promise.all([
          supabase.from("party_groups").select("id,name,last_active,finalized,settle,pinned").eq("owner_id", dev),
          supabase.from("party_people").select("group_id").eq("claimed_by", dev),
        ])
        const map = new Map<string, MiniGroep>()
        for (const g of eigen.data ?? []) {
          map.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", settle: !!g.settle, gast: false, af: !!g.finalized, pin: !!g.pinned, last: (g.last_active as string) || "", app: "party" })
        }
        const gastIds = [...new Set((gast.data ?? []).map((r) => r.group_id as string))].filter((id) => !map.has(id))
        if (gastIds.length > 0) {
          const { data } = await supabase.from("party_groups").select("id,name,last_active,finalized,settle,pinned").in("id", gastIds)
          for (const g of data ?? []) {
            map.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", settle: !!g.settle, gast: true, af: !!g.finalized, pin: !!g.pinned, last: (g.last_active as string) || "", app: "party" })
          }
        }
        // Open groepen eerst — daar wil je naartoe. Afgesloten avonden blijven
        // raadpleegbaar (afrekening delen, terugkijken) en volgen gedimd eronder.
        const alles = [...map.values()].sort((a, b) => b.last.localeCompare(a.last))
        // Binnen de afgesloten groepen komen de bewaarde eerst: dat zijn de blijvers.
        const lijst = [...alles.filter((g) => !g.af).slice(0, 4), ...alles.filter((g) => g.af).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).slice(0, 3)]
        setGroepen(lijst)
        setPinTotaal((v) => ({ ...v, party: alles.filter((g) => !g.gast && g.pin).length }))
      } catch { /* stil: geen sectie is prima */ }
      // Table: eigen groepen uit de databank (rundo_owner_id), gastgroepen uit de
      // lokale lijst — exact de bronnen die de Table-app zelf gebruikt. De link loopt
      // via de uitnodigingscode, die Table al kent (?code=): daar wijzigt dus niets.
      try {
        const ownerId = localStorage.getItem("rundo_owner_id")
        if (!ownerId) throw new Error("geen table-id")
        let lokaal: { id: string; name: string; invite_code: string; role: string }[] = []
        try { const raw = localStorage.getItem(`rundo_table_groups_${ownerId}`); if (raw) lokaal = JSON.parse(raw) } catch { /* niets */ }
        const tafelMap = new Map<string, MiniGroep>()
        const { data: eigenT } = await supabase.from("table_groups").select("id,name,invite_code,finalized,created_at,pinned").eq("owner_id", ownerId)
        for (const g of eigenT ?? []) {
          tafelMap.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", gast: false, af: !!g.finalized, pin: !!g.pinned, last: (g.created_at as string) || "", app: "table", code: (g.invite_code as string) || "" })
        }
        const gastIds = lokaal.filter((x) => x.role === "gast" && !tafelMap.has(x.id)).map((x) => x.id)
        if (gastIds.length > 0) {
          const { data: gastT } = await supabase.from("table_groups").select("id,name,invite_code,finalized,created_at,pinned").in("id", gastIds)
          for (const g of gastT ?? []) {
            tafelMap.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", gast: true, af: !!g.finalized, pin: !!g.pinned, last: (g.created_at as string) || "", app: "table", code: (g.invite_code as string) || "" })
          }
        }
        const allesT = [...tafelMap.values()].sort((a, b) => b.last.localeCompare(a.last))
        const tafelLijst = [...allesT.filter((g) => !g.af).slice(0, 4), ...allesT.filter((g) => g.af).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).slice(0, 3)]
        setTafels(tafelLijst)
        setPinTotaal((v) => ({ ...v, table: allesT.filter((g) => !g.gast && g.pin).length }))
      } catch { /* stil */ }
    })()
  }, [])

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

  // Bewaren of losmaken zonder eerst de app in te moeten. Zelfde regels als daar:
  // enkel eigen groepen, maximaal drie per app. De melding verdwijnt vanzelf weer.
  const meld = (tekst: string) => { setMelding(tekst); window.setTimeout(() => setMelding(null), 3500) }
  const togglePin = async (g: MiniGroep) => {
    if (g.gast) return
    if (!g.pin && pinTotaal[g.app] >= MAX_PINS) { meld(t.maxPins(MAX_PINS)); return }
    const tabel = g.app === "party" ? "party_groups" : "table_groups"
    const { error } = await supabase.from(tabel).update({ pinned: !g.pin }).eq("id", g.id)
    if (error) { meld("Bewaren mislukt: " + error.message); return }
    const zet = (prev: MiniGroep[]) => prev.map((x) => x.id === g.id ? { ...x, pin: !x.pin } : x)
    if (g.app === "party") setGroepen(zet); else setTafels(zet)
    setPinTotaal((v) => ({ ...v, [g.app]: v[g.app] + (g.pin ? -1 : 1) }))
  }
  // De knop zelf, in de tint van de app: goud voor Party, blauw voor Table. De
  // uitsparingen van de diskette nemen de donkere achtergrond van dit scherm aan.
  const pinKnop = (g: MiniGroep) => {
    if (g.gast) return null
    const kleur = accent[g.app]
    const rand = g.app === "party" ? "rgba(240,193,75,0.5)" : "rgba(91,159,214,0.5)"
    const vlak = g.app === "party" ? "rgba(240,193,75,0.16)" : "rgba(91,159,214,0.16)"
    return (
      <button onClick={(e) => { e.stopPropagation(); void togglePin(g) }} title={g.pin ? t.pinOff : t.pinOn} aria-label={g.pin ? t.pinOff : t.pinOn}
        style={{ flexShrink: 0, width: 34, height: 32, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit",
          background: g.pin ? vlak : "rgba(255,255,255,0.04)",
          border: g.pin ? `1px solid ${rand}` : "1px solid rgba(255,255,255,0.18)",
          color: g.pin ? kleur : "#5d6478" }}><BewaarIcoon aan={g.pin} /></button>
    )
  }

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

  // De stappenflow: genummerde bolletjes met de infozin als rustige kopregel erboven —
  // zonder i-badge, in hetzelfde blok, zodat zin en tekeningen als één geheel lezen.
  // Een stap kan twee iconen dragen — dan staat er een klein "of" tussen en delen ze
  // één nummer, zodat duidelijk is dat het twee manieren voor dezelfde stap zijn.
  // De uitlegzin bij het openklappen is weg: de ondertitel in de banner zegt het al,
  // en de stappenrij hieronder toont de rest. Twee keer hetzelfde vertellen hoeft niet.
  const flowRow = (m: Mode, stappen: { iconen: string[]; label: string }[]) => {
    const bolBg = m === "party" ? "rgba(240,193,75,0.14)" : "rgba(91,159,214,0.14)"
    const bolRand = m === "party" ? "rgba(240,193,75,0.45)" : "rgba(91,159,214,0.45)"
    return pick !== m ? null : (
      <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
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
            {flowRow("table", t.tableFlow)}
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

        {/* Jouw open groepen, gesplitst per app — één tik en je zit erin. De Party-rij
            linkt met ?g=, waar de app de groep meteen opent. De Table-kolom volgt
            zodra die bron gekoppeld is. */}
        {(groepen.length > 0 || tafels.length > 0) && (
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#9aa2b8", letterSpacing: "0.05em", marginBottom: 9 }}>📂 {t.yourGroups}{pick === "party" && tafels.length > 0 && <span style={{ fontWeight: 600, color: "#5d6478" }}> · {t.hiddenNote("Rundo Table")}</span>}{pick === "table" && groepen.length > 0 && <span style={{ fontWeight: 600, color: "#5d6478" }}> · {t.hiddenNote("Rundo Party")}</span>}</div>
            {melding && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f2d9a0", background: "rgba(240,193,75,0.12)", border: "1px solid rgba(240,193,75,0.4)", borderRadius: 10, padding: "8px 11px", marginBottom: 8 }}>{melding}</div>
            )}
            {groepen.length > 0 && pick !== "table" && (<>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: accent.party, marginBottom: 6 }}>🍻 Rundo Party</div>
              {groepen.map((g) => (
                <div key={g.id} onClick={() => router.push(`/party?g=${g.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: g.pin ? "1px solid rgba(240,193,75,0.55)" : "1px solid rgba(240,193,75,0.3)", borderRadius: 12, padding: "10px 12px", marginBottom: 6, opacity: g.af && !g.pin ? 0.6 : 1 }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: "rgba(240,193,75,0.12)" }}>{g.settle ? "📱" : "✍️"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#e8e4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Rundo Party"}</span>
                    {/* Alleen de hoofdsplitsing telt hier: zelf opnemen of via QR —
                        dezelfde keuze als op het Party-startscherm. */}
                    <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#d9c58a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.settle ? t.modeQr : t.modeZelf}</span>
                  </span>
                  {g.gast && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#d9c58a", background: "rgba(240,193,75,0.14)", borderRadius: 7, padding: "2px 7px" }}>{t.guestChip}</span>}
                  {!g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#f2d9a0", background: "rgba(240,193,75,0.14)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.openChip}</span>}
                  {g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9fd6ae", background: "rgba(63,158,96,0.16)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.closedChip}</span>}
                  {pinKnop(g)}
                  <span style={{ flexShrink: 0, color: accent.party, fontWeight: 800 }}>›</span>
                </div>
              ))}
            </>)}
            {tafels.length > 0 && pick !== "party" && (<>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: accent.table, margin: "10px 0 6px" }}>🧾 Rundo Table</div>
              {tafels.map((g) => (
                <div key={g.id} onClick={() => { if (g.code) router.push(`/table?code=${g.code}`) }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: g.pin ? "1px solid rgba(91,159,214,0.6)" : "1px solid rgba(91,159,214,0.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 6, opacity: g.af && !g.pin ? 0.6 : 1 }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: "rgba(91,159,214,0.14)" }}>🧾</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: "#dfe7f2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Rundo Table"}</span>
                  {g.gast && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9cc6ec", background: "rgba(91,159,214,0.16)", borderRadius: 7, padding: "2px 7px" }}>{t.guestChip}</span>}
                  {!g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9cc6ec", background: "rgba(91,159,214,0.16)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.openChip}</span>}
                  {g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9fd6ae", background: "rgba(63,158,96,0.16)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.closedChip}</span>}
                  {pinKnop(g)}
                  <span style={{ flexShrink: 0, color: accent.table, fontWeight: 800 }}>›</span>
                </div>
              ))}
            </>)}
          </div>
        )}

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
