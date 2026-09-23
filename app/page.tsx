"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLang, LanguageToggle } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { RundoLogo, RundoDealsLogo } from "@/lib/RundoLogo"
import { Icoon } from "@/lib/RundoIconen"

const T = {
  nl: {
    tagline: "Rondjes en rekeningen zonder gedoe!",
    partySub: ["Rondjes opnemen", "… en splitten zonder gedoe"],
    tableSub: ["Scan de rekening", "… en verdeel in groep"],
    dealsKorting: "korting",
    dealsLabel: "Groepsdeals",
    dealsSub: "Samen op stap = samen korting bij deelnemende zaken",
    dealsNew: "nieuw",
    dealsSoon: "binnenkort",
    orWord: "of",
    yourGroups: "Jouw groepen",
    guestChip: "als gast",
    modeZelf: "Zelf opnemen",
    modeQr: "Via QR",
    closedChip: "afgesloten ✓",
    start: "Starten",
    pinOn: "Bewaren",
    pinOff: "Niet meer bewaren",
    maxPins: (n: number) => `Je kan maximaal ${n} groepen bewaren. Maak er eerst een los.`,
    openChip: "open",
    wipeAll: "🗑 alles wissen",
    wipeTitle: (n: number, app: string) => `${n} ${app}-groep${n === 1 ? "" : "en"} uit jouw lijst wissen?`,
    wipeNote: "Ook de bewaarde. De groepen zelf blijven bestaan — wie de code of link heeft kan er nog in.",
    wipeDo: "🗑 wissen",
    cancelWord: "annuleer",
    footer: "Gratis · geen registratie · eerlijk splitten",
  },
  fr: {
    tagline: "Tournées et additions, sans prise de tête !",
    partySub: ["Note les tournées", "… et partage sans prise de tête"],
    tableSub: ["Scanne l'addition", "… et partage en groupe"],
    dealsKorting: "remise",
    dealsLabel: "Deals groupe",
    dealsSub: "Sortir ensemble = réduction ensemble chez les partenaires",
    dealsNew: "nouveau",
    dealsSoon: "bientôt",
    orWord: "ou",
    yourGroups: "Tes groupes",
    guestChip: "invité",
    modeZelf: "Noter soi-même",
    modeQr: "Via QR",
    closedChip: "clôturé ✓",
    start: "Démarrer",
    pinOn: "Enregistrer",
    pinOff: "Ne plus enregistrer",
    maxPins: (n: number) => `Tu peux garder ${n} groupes au maximum. Détaches-en un d'abord.`,
    openChip: "ouvert",
    wipeAll: "🗑 tout effacer",
    wipeTitle: (n: number, app: string) => `Effacer ${n} groupe${n === 1 ? "" : "s"} ${app} de ta liste ?`,
    wipeNote: "Aussi les enregistrés. Les groupes existent encore — le code ou le lien fonctionne toujours.",
    wipeDo: "🗑 effacer",
    cancelWord: "annuler",
    footer: "Gratuit · sans inscription · partage équitable",
  },
}

type Mode = "table" | "party"

// Zelfde bewaaricoon als in Party en Table: gevulde diskette, met de subtiele
// schuine streep in de niet-bewaard-stand. De uitsparingen nemen de witte
// kaartkleur aan.
function BewaarIcoon({ aan, size = 17, gat = "#FFFFFF" }: { aan: boolean; size?: number; gat?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }}>
      <path d="M4.5 6A1.5 1.5 0 0 1 6 4.5h9.6L19.5 8.4V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18z" fill="currentColor" />
      <path d="M9.2 5.4v3.2h5.6V5.4z" fill={gat} />
      <path d="M8.4 13.4h7.2v5.2H8.4z" fill={gat} />
      {!aan && (<>
        <path d="M3.4 20.6L20.6 3.4" stroke={gat} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M3.4 20.6L20.6 3.4" stroke="#9AA1AD" strokeWidth="1.7" strokeLinecap="round" />
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
  // ?via=kiezer zegt de doelpagina dat je de stappen híer al gezien hebt, zodat die
  // haar eigen introscherm mag overslaan. Wie via een QR binnenkomt heeft geen
  // via-parameter en krijgt de uitleg dus gewoon.
  const starten = (m: Mode) => {
    try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ }
    router.push(m === "table" ? "/table?via=kiezer" : "/party?via=kiezer")
  }
  type MiniGroep = { id: string; name: string; settle?: boolean; gast: boolean; af: boolean; pin: boolean; last: string; app: "party" | "table"; code?: string }
  const [groepen, setGroepen] = useState<MiniGroep[]>([])
  const [tafels, setTafels] = useState<MiniGroep[]>([])
  const [pinTotaal, setPinTotaal] = useState<{ party: number; table: number }>({ party: 0, table: 0 })
  const [melding, setMelding] = useState<string | null>(null)
  const [klap, setKlap] = useState<{ party: boolean; table: boolean }>({ party: false, table: false })
  const [wisVraag, setWisVraag] = useState<null | "party" | "table">(null)
  const alleIds = useRef<{ party: string[]; table: string[] }>({ party: [], table: [] })
  const gewisteIds = (app: "party" | "table"): Set<string> => {
    try { const raw = localStorage.getItem(`rundo_chooser_gewist_${app}`); if (raw) return new Set(JSON.parse(raw)) } catch { /* niets */ }
    return new Set()
  }
  // App-gedrag: viewport vast op schaal 1 (geen invoer-autozoom), geen witte rand.
  useEffect(() => {
    try {
      let m = document.querySelector('meta[name="viewport"]')
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "viewport"); document.head.appendChild(m) }
      m.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
      document.documentElement.style.margin = "0"
      document.body.style.margin = "0"
      document.body.style.background = "#F6F3EC"
      document.body.style.overscrollBehaviorY = "none"
    } catch { /* niets */ }
  }, [])
  useEffect(() => {
    if (typeof window === "undefined") return
    ;(async () => {
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
        const weg = gewisteIds("party")
        const alles = [...map.values()].filter((g) => !weg.has(g.id)).sort((a, b) => b.last.localeCompare(a.last))
        alleIds.current.party = alles.map((g) => g.id)
        const lijst = [...alles.filter((g) => !g.af).slice(0, 4), ...alles.filter((g) => g.af).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).slice(0, 3)]
        setGroepen(lijst)
        setPinTotaal((v) => ({ ...v, party: alles.filter((g) => !g.gast && g.pin).length }))
      } catch { /* stil: geen sectie is prima */ }
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
        const wegT = gewisteIds("table")
        const allesT = [...tafelMap.values()].filter((g) => !wegT.has(g.id)).sort((a, b) => b.last.localeCompare(a.last))
        alleIds.current.table = allesT.map((g) => g.id)
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

  const wisAlles = (app: "party" | "table") => {
    const weg = gewisteIds(app)
    alleIds.current[app].forEach((id) => weg.add(id))
    try { localStorage.setItem(`rundo_chooser_gewist_${app}`, JSON.stringify([...weg])) } catch { /* niets */ }
    alleIds.current[app] = []
    if (app === "party") setGroepen([]); else setTafels([])
    setPinTotaal((v) => ({ ...v, [app]: 0 }))
    setWisVraag(null)
  }

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
  const pinKnop = (g: MiniGroep) => {
    if (g.gast) return null
    return (
      <button onClick={(e) => { e.stopPropagation(); void togglePin(g) }} title={g.pin ? t.pinOff : t.pinOn} aria-label={g.pin ? t.pinOff : t.pinOn}
        style={{ flexShrink: 0, width: 34, height: 32, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit",
          background: g.pin ? K.goudZacht : "#FFFFFF",
          border: `1px solid ${g.pin ? K.goud : K.lijn}`,
          color: g.pin ? K.goudDiep : "#B3B8C2" }}><BewaarIcoon aan={g.pin} gat={g.pin ? K.goudZacht : "#FFFFFF"} /></button>
    )
  }

  // Eén vormtaal voor het hele scherm: lichte kaarten op een warme achtergrond,
  // marineblauwe tekst. Elke modus heeft één eigen tint (turquoise-blauw voor Resto,
  // goud voor Rundo) die terugkomt in de rand, de kaartkleur en de startbalk.

  // Startbalk over de hele onderkant van de kaart. Dit is het énige wat doorklikt:
  // de rest van de kaart reageert niet op een tik.
  const startKnop = (m: Mode) => (
    <button type="button" onClick={() => starten(m)} className="rundo-start"
      style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        width: "100%", height: 58, padding: "0 18px", border: "none", borderRadius: 0, flexShrink: 0,
        fontSize: 18, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.2,
        background: MODUS[m].knop, color: MODUS[m].knopTekst, transition: "filter .15s ease, transform .1s ease" }}>
      {t.start}
      <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  )

  // Kaart: logo en ondertitel links, je foto rechts die naar links in de kaartkleur
  // vervaagt, startbalk onderaan. De kaarten rekken mee zodat het startscherm
  // (beide modi + Groepsdeals) precies één gsm-scherm vult.
  const modusKaart = (m: Mode) => {
    const resto = m === "table"
    const md = MODUS[m]
    const [regel1, regel2] = resto ? t.tableSub : t.partySub
    return (
      <div style={{ ...S.kaart, background: md.kaart, border: `1.5px solid ${md.kleur}99`, boxShadow: `0 12px 26px -18px ${md.schaduw}` }}>
        {/* Foto in twee lagen: over de hele kaart een zachte, vervaagde waas (zo schemert
            de foto links heel licht door), en rechts de scherpe foto zelf, zodat wat erop
            staat goed zichtbaar blijft. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resto ? "/table-image.png" : "/party-image.png"} alt="" style={S.cardPhotoWaas} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resto ? "/table-image.png" : "/party-image.png"} alt="" style={S.cardPhoto} />
        <div style={{ position: "absolute", inset: 0, zIndex: 1,
          background: `linear-gradient(90deg, rgba(${md.kaartRgb},0.86) 0%, rgba(${md.kaartRgb},0.84) 30%, rgba(${md.kaartRgb},0.6) 46%, rgba(${md.kaartRgb},0.15) 66%, rgba(${md.kaartRgb},0) 82%)` }} />
        <div style={{ position: "relative", zIndex: 2, flex: 1, padding: "16px 16px 16px" }}>
          <span style={{ display: "inline-block", filter: `drop-shadow(0 0 8px rgb(${md.kaartRgb})) drop-shadow(0 0 3px rgb(${md.kaartRgb}))` }}><RundoLogo size={46} resto={resto} opDonker={false} /></span>
          {/* Ondertitel op twee regels: de actie vet, het vervolg lichter eronder. Een
              zachte gloed in de kaartkleur houdt logo en tekst leesbaar waar ze over de
              foto lopen. */}
          <div style={{ ...S.logoSub, marginTop: 6, textShadow: `0 0 10px rgb(${md.kaartRgb}), 0 0 18px rgb(${md.kaartRgb}), 0 0 4px rgb(${md.kaartRgb})` }}>
            <span style={{ display: "block", color: K.tekst, fontWeight: 800 }}>{regel1}</span>
            <span style={{ display: "block" }}>{regel2}</span>
          </div>
        </div>
        {startKnop(m)}
      </div>
    )
  }

  const chip = (tekst: string, vol: boolean) => (
    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", borderRadius: 999, padding: "3px 9px",
      whiteSpace: "nowrap", background: vol ? DEALS.kleur : "transparent", color: vol ? "#FFFFFF" : K.zacht,
      border: `1px solid ${vol ? DEALS.kleur : K.lijn}` }}>{tekst}</span>
  )

  // Groepenlijst: kop per app met het eigen logo, rijen in dezelfde witte stijl.
  const lijstKop = (app: "party" | "table", aantal: number) => (
    <div onClick={() => { setKlap((k) => ({ ...k, [app]: !k[app] })); setWisVraag(null) }} style={{ ...S.rij, padding: "10px 12px" }}>
      <RundoLogo size={22} resto={app === "table"} opDonker={false} />
      <span style={{ fontSize: 11, fontWeight: 800, color: K.zacht, background: K.vlak, borderRadius: 8, padding: "2px 8px" }}>{aantal}</span>
      <span style={{ marginLeft: "auto", color: K.zacht, fontWeight: 800 }}>{klap[app] ? "▾" : "▸"}</span>
    </div>
  )
  const statusChips = (g: MiniGroep) => (<>
    {g.gast && <span style={{ ...S.chipKlein, background: K.vlak, color: K.zacht }}>{t.guestChip}</span>}
    {!g.af && <span style={{ ...S.chipKlein, background: K.goudZacht, color: K.goudDiep }}>{t.openChip}</span>}
    {g.af && <span style={{ ...S.chipKlein, background: "#E8F3EC", color: "#2F7A4A" }}>{t.closedChip}</span>}
  </>)
  const wisBlok = (app: "party" | "table") => wisVraag === app ? (
    <div style={{ background: "#FDEEEC", border: "1px solid #F2C4BE", borderRadius: 12, padding: "10px 12px", margin: "2px 0 10px" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#A23B2F", marginBottom: 6 }}>{t.wipeTitle(alleIds.current[app].length, app === "party" ? "Party" : "Table")}</div>
      <div style={{ fontSize: 11.5, color: "#8A5A54", lineHeight: 1.45, marginBottom: 8 }}>{t.wipeNote}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setWisVraag(null)} style={{ flex: 1, background: "#FFFFFF", border: `1px solid ${K.lijn}`, borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, color: K.tekst, cursor: "pointer" }}>{t.cancelWord}</button>
        <button onClick={() => wisAlles(app)} style={{ flex: 1, background: "#C0554A", border: "none", borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{t.wipeDo}</button>
      </div>
    </div>
  ) : (
    <div style={{ textAlign: "right", margin: "0 2px 10px" }}>
      <span onClick={() => setWisVraag(app)} style={{ fontSize: 11.5, fontWeight: 800, color: "#B85247", cursor: "pointer" }}>{t.wipeAll}</span>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        {/* Eerste scherm: kop, beide modi en Groepsdeals vullen samen precies de
            schermhoogte. Je groepen (als je die hebt) volgen daaronder. */}
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column",
          paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
            <RundoLogo size={46} opDonker={false} />
            <LanguageToggle />
          </div>
          <p style={{ color: K.zacht, fontSize: 14.5, fontWeight: 600, margin: "4px 4px 14px" }}>{t.tagline}</p>

          {modusKaart("table")}

          {/* "of" tussen de twee modi: een duidelijk wit bolletje op een lijn, zodat je
              ziet dat je hier kiest tussen twee dingen. */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0", flexShrink: 0 }}>
            <span style={{ flex: 1, height: 1.5, background: "#D9D2C3" }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: K.tekst, background: "#FFFFFF", border: "1.5px solid #D9D2C3",
              borderRadius: 999, padding: "4px 16px", lineHeight: 1.2, boxShadow: "0 4px 10px -6px rgba(14,26,46,0.35)" }}>{t.orWord}</span>
            <span style={{ flex: 1, height: 1.5, background: "#D9D2C3" }} />
          </div>

          {modusKaart("party")}

          {/* GROEPSDEALS — oogt als een coupon: groene stippelrand, een afscheurstrook
              rechts met groepsicoon en "korting", twee uitsparingen op de scheurlijn.
              Niet klikbaar en zonder knop: het werkt nog niet. */}
          <div aria-disabled="true" style={{ position: "relative", display: "flex", flexShrink: 0, borderRadius: 16, marginTop: 12,
            background: "#FFFFFF", border: `1.5px dashed ${DEALS.kleur}` }}>
            <div style={{ flex: 1, minWidth: 0, padding: "14px 12px 14px 16px" }}>
              <RundoDealsLogo size={32} label={t.dealsLabel} kleur={DEALS.kleur} opDonker={false} />
              <span style={{ display: "flex", gap: 6, marginTop: 8 }}>{chip(t.dealsNew, true)}{chip(t.dealsSoon, false)}</span>
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: K.zacht, lineHeight: 1.3 }}>{t.dealsSub}</div>
            </div>
            <div style={{ position: "relative", width: 88, flexShrink: 0, borderLeft: `1.5px dashed ${DEALS.kleur}`, borderRadius: "0 15px 15px 0",
              background: DEALS.zacht, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: DEALS.kleur }}>
              <span style={{ position: "absolute", left: -9, top: -9, width: 16, height: 16, borderRadius: "50%", background: K.achtergrond, borderBottom: `1.5px dashed ${DEALS.kleur}` }} />
              <span style={{ position: "absolute", left: -9, bottom: -9, width: 16, height: 16, borderRadius: "50%", background: K.achtergrond, borderTop: `1.5px dashed ${DEALS.kleur}` }} />
              <Icoon naam="groep" size={40} dikte={1.6} />
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: DEALS.diep }}>{t.dealsKorting}</span>
            </div>
          </div>

          <div style={{ textAlign: "center", padding: "12px 0 4px", fontSize: 12, color: K.zacht, fontWeight: 600 }}>{t.footer}</div>
        </div>

        {(groepen.length > 0 || tafels.length > 0) && (
          <div style={{ marginTop: 10, paddingBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: K.zacht, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 9 }}>{t.yourGroups}</div>
            {melding && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: K.goudDiep, background: K.goudZacht, border: `1px solid ${K.goud}`, borderRadius: 10, padding: "8px 11px", marginBottom: 8 }}>{melding}</div>
            )}
            {groepen.length > 0 && (<>
              {lijstKop("party", groepen.length)}
              {klap.party && groepen.map((g) => (
                <div key={g.id} onClick={() => { try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ } router.push(`/party?g=${g.id}&via=kiezer`) }}
                  style={{ ...S.rij, borderColor: g.pin ? K.goud : K.lijn, opacity: g.af && !g.pin ? 0.6 : 1 }}>
                  <span style={{ ...S.icoonVak, width: 32, height: 32, borderRadius: 10 }}><Icoon naam={g.settle ? "deel" : "noteer"} size={17} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={S.rijNaam}>{g.name || "Rundo"}</span>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: K.zacht }}>{g.settle ? t.modeQr : t.modeZelf}</span>
                  </span>
                  {statusChips(g)}
                  {pinKnop(g)}
                  <span style={{ flexShrink: 0, color: K.zacht, fontWeight: 800 }}>›</span>
                </div>
              ))}
              {klap.party && wisBlok("party")}
            </>)}
            {tafels.length > 0 && (<>
              {lijstKop("table", tafels.length)}
              {klap.table && tafels.map((g) => (
                <div key={g.id} onClick={() => { if (!g.code) return; try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ } router.push(`/table?code=${g.code}&via=kiezer`) }}
                  style={{ ...S.rij, borderColor: g.pin ? K.goud : K.lijn, opacity: g.af && !g.pin ? 0.6 : 1 }}>
                  <span style={{ ...S.icoonVak, width: 32, height: 32, borderRadius: 10 }}><Icoon naam="scan" size={17} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}><span style={S.rijNaam}>{g.name || "Rundo Resto"}</span></span>
                  {statusChips(g)}
                  {pinKnop(g)}
                  <span style={{ flexShrink: 0, color: K.zacht, fontWeight: 800 }}>›</span>
                </div>
              ))}
              {klap.table && wisBlok("table")}
            </>)}
          </div>
        )}

      </div>

      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${K.achtergrond}; }
        .rundo-start:active { filter: brightness(0.92); transform: scale(0.99); }
        .rundo-start:focus-visible { outline: 3px solid ${K.tekst}; outline-offset: -3px; }
        @media (hover: hover) { .rundo-start:hover { filter: brightness(1.06); } }
      `}</style>
    </div>
  )
}

// Het basispalet van dit scherm (plus de tint per modus en het Groepsdeals-groen hieronder).
const K = {
  achtergrond: "#F6F3EC", // warm gebroken wit
  vlak: "#F4F1EA",        // kleine vlakken (tellers, chips)
  lijn: "#E6E0D4",        // randen en scheidingslijnen
  tekst: "#0E1A2E",       // marineblauw van het logo
  zacht: "#5E6675",       // ondertitels en bijschriften
  goud: "#F5B301",        // het enige accent, uit het logo
  goudDiep: "#B58200",    // goud dat op wit leesbaar blijft
  goudZacht: "#FFF4D6",
}

// Eén tint per modus: turquoise-blauw bij het Resto-logo, goud uit het Rundo-logo.
const MODUS = {
  table: { knop: "#138C9A", knopTekst: "#FFFFFF", kleur: "#3FBFB3", kaart: "#F3FBFA", kaartRgb: "243,251,250", schaduw: "rgba(19,140,154,0.35)" },
  party: { knop: "#F5B301", knopTekst: "#0E1A2E", kleur: "#F5B301", kaart: "#FFFAEC", kaartRgb: "255,250,236", schaduw: "rgba(168,120,0,0.35)" },
}

// Groepsdeals krijgt een eigen groen, zodat het niet op de modi erboven lijkt.
const DEALS = { kleur: "#2E9E6A", diep: "#1F7A50", zacht: "#E6F5EC" }

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    background: K.achtergrond,
    minHeight: "100dvh",
    color: K.tekst,
    padding: "0 16px",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  kaart: {
    position: "relative", flex: 1, minHeight: 170, display: "flex", flexDirection: "column",
    borderRadius: 20, overflow: "hidden",
  },
  cardPhoto: {
    position: "absolute", top: 0, right: 0, bottom: 0, width: "72%", height: "100%", objectFit: "cover",
    display: "block", zIndex: 0,
    WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 40%)", maskImage: "linear-gradient(90deg, transparent 0%, #000 40%)",
  },
  cardPhotoWaas: {
    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
    display: "block", zIndex: 0, filter: "blur(10px) saturate(1.1)", opacity: 0.55, transform: "scale(1.15)",
  },
  logoSub: {
    fontSize: 19, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.25, color: K.zacht,
    fontFamily: "'Nunito', 'Baloo 2', 'DM Sans', -apple-system, 'Segoe UI', sans-serif",
  },
  icoonVak: {
    flexShrink: 0, width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
    background: "#FFFFFF", border: `1px solid ${K.lijn}`, color: K.tekst,
  },
  rij: {
    display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "#FFFFFF",
    border: `1px solid ${K.lijn}`, borderRadius: 14, padding: "10px 12px", marginBottom: 6,
  },
  rijNaam: { display: "block", fontSize: 14.5, fontWeight: 700, color: K.tekst, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chipKlein: { flexShrink: 0, fontSize: 10.5, fontWeight: 800, borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" },
}
