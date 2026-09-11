"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLang, LanguageToggle } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

const T = {
  nl: {
    tagline: "Rondjes en rekeningen zonder gedoe!",
    // "zonder gedoe" staat al in de tagline — hier niet nog eens.
    partySub: "Rondjes opnemen en splitten",
    // Stap 1 heeft twee manieren (zelf opnemen óf QR scannen). In de estafette tonen
    // we alleen het eerste icoon; het bijschrift vertelt de "of".
    partyFlow: [
      { iconen: ["✍️", "📱"], label: "neem zelf op\nof deel QR" },
      { iconen: ["👆"], label: "tik drankjes\naan" },
      { iconen: ["📋"], label: "handig barlijstje\nen afrekenen" },
    ],
    // Samenvatting op één regel voor de kaart die even niet aan de beurt is.
    partyKort: "opnemen · tik aan · afrekenen",
    yourGroups: "Jouw groepen",
    guestChip: "als gast",
    modeZelf: "Zelf opnemen",
    modeQr: "Via QR",
    closedChip: "afgesloten ✓",
    tableSub: "Scan de rekening en verdeel in groep",
    tableFlow: [
      { iconen: ["📷"], label: "scan\nrekening" },
      { iconen: ["📱"], label: "deel QR" },
      { iconen: ["👆"], label: "tik aan\nwat je nam" },
      { iconen: ["💶"], label: "eerlijk\nverdeeld!" },
    ],
    tableKort: "scan · QR · tik aan · verdeeld",
    start: "Starten",
    pinOn: "Bewaren",
    pinOff: "Niet meer bewaren",
    pinFail: (msg: string) => `Bewaren mislukt: ${msg}`,
    maxPins: (n: number) => `Je kan maximaal ${n} groepen bewaren. Maak er eerst een los.`,
    openChip: "🟡 open",
    wipeAll: "🗑 alles wissen",
    wipeTitle: (n: number, app: string) => `${n} ${app}-groep${n === 1 ? "" : "en"} uit jouw lijst wissen?`,
    wipeNote: "Ook de bewaarde. De groepen zelf blijven bestaan — wie de code of link heeft kan er nog in.",
    wipeDo: "🗑 wissen",
    cancelWord: "annuleer",
    footer: "Gratis · geen registratie · eerlijk splitten",
  },
  fr: {
    tagline: "Tournées et additions, sans prise de tête !",
    partySub: "Prendre les tournées et partager",
    partyFlow: [
      { iconen: ["✍️", "📱"], label: "note toi-même\nou partage le QR" },
      { iconen: ["👆"], label: "coche les\nboissons" },
      { iconen: ["📋"], label: "liste bar pratique\net règlement" },
    ],
    partyKort: "note · coche · règle",
    yourGroups: "Tes groupes",
    guestChip: "invité",
    modeZelf: "Noter soi-même",
    modeQr: "Via QR",
    closedChip: "clôturé ✓",
    tableSub: "Scanne l'addition et partage en groupe",
    tableFlow: [
      { iconen: ["📷"], label: "scanne\nl'addition" },
      { iconen: ["📱"], label: "partage\nle QR" },
      { iconen: ["👆"], label: "coche ce que\ntu as pris" },
      { iconen: ["💶"], label: "partagé\néquitablement !" },
    ],
    tableKort: "scanne · QR · coche · partagé",
    start: "Démarrer",
    pinOn: "Enregistrer",
    pinOff: "Ne plus enregistrer",
    pinFail: (msg: string) => `Échec de l'enregistrement : ${msg}`,
    maxPins: (n: number) => `Tu peux garder ${n} groupes au maximum. Détaches-en un d'abord.`,
    openChip: "🟡 ouvert",
    wipeAll: "🗑 tout effacer",
    wipeTitle: (n: number, app: string) => `Effacer ${n} groupe${n === 1 ? "" : "s"} ${app} de ta liste ?`,
    wipeNote: "Aussi les enregistrés. Les groupes existent encore — le code ou le lien fonctionne toujours.",
    wipeDo: "🗑 effacer",
    cancelWord: "annuler",
    footer: "Gratuit · sans inscription · partage équitable",
  },
}

type Mode = "table" | "party"
type Stap = { iconen: string[]; label: string }

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

// Hoe lang elke stap in de estafette blijft staan.
const BEURT_MS = 1800

// Rundo woordmerk — Poppins SemiBold, omgezet naar vectorpaden.
// Geen font-afhankelijkheid: rendert overal identiek.
//
//   <RundoLogo size={34} />              → Rundo, wit op donker
//   <RundoLogo size={34} opDonker={false} /> → Rundo, donkerblauw op licht
//   <RundoLogo size={34} resto />        → Rundo Resto
//
// Hoogte stuurt de maat; de breedte volgt de verhouding.

const GOUD = "#F5B301"
const TURQUOISE = "#4FD1C5"
const DONKER = "#0E1A2E"

const BOOG = "M14.90 30.56A34.0 34.0 0 0 1 -33.98 -1.19A34.0 34.0 0 0 1 17.00 -29.44"
const PIJL = "28.26,-22.94 18.40,-37.87 10.40,-24.02"
const LETTER_R = "M58.69 74.9 49.45 58.58H45.49V74.9H37.09V33.02H52.81Q57.67 33.02 61.09 34.73Q64.51 36.44 66.22 39.35Q67.93 42.26 67.93 45.86Q67.93 50 65.53 53.33Q63.13 56.66 58.39 57.92L68.41 74.9ZM45.49 52.28H52.51Q55.93 52.28 57.61 50.63Q59.29 48.98 59.29 46.04Q59.29 43.16 57.61 41.57Q55.93 39.98 52.51 39.98H45.49Z"
const WOORD_UNDO = "M105.38 44.98V74.9H97.76V71.12Q96.31 73.06 93.96 74.17Q91.61 75.28 88.85 75.28Q85.34 75.28 82.64 73.79Q79.94 72.31 78.41 69.42Q76.87 66.53 76.87 62.53V44.98H84.43V61.45Q84.43 65.02 86.21 66.94Q87.99 68.85 91.07 68.85Q94.2 68.85 95.98 66.94Q97.76 65.02 97.76 61.45V44.98ZM140.74 57.35V74.9H133.18V58.38Q133.18 54.81 131.4 52.9Q129.62 50.98 126.54 50.98Q123.41 50.98 121.6 52.9Q119.79 54.81 119.79 58.38V74.9H112.23V44.98H119.79V48.71Q121.3 46.77 123.65 45.66Q126 44.55 128.81 44.55Q134.15 44.55 137.45 47.93Q140.74 51.3 140.74 57.35ZM159.1 44.5Q162.01 44.5 164.66 45.77Q167.3 47.04 168.87 49.14V34.94H176.54V74.9H168.87V70.47Q167.47 72.69 164.93 74.04Q162.39 75.39 159.04 75.39Q155.26 75.39 152.13 73.44Q149 71.5 147.19 67.96Q145.38 64.42 145.38 59.83Q145.38 55.3 147.19 51.79Q149 48.28 152.13 46.39Q155.26 44.5 159.1 44.5ZM160.99 51.14Q158.88 51.14 157.1 52.17Q155.32 53.19 154.21 55.16Q153.1 57.13 153.1 59.83Q153.1 62.53 154.21 64.56Q155.32 66.58 157.12 67.66Q158.93 68.74 160.99 68.74Q163.09 68.74 164.93 67.69Q166.76 66.64 167.84 64.67Q168.92 62.7 168.92 59.94Q168.92 57.19 167.84 55.22Q166.76 53.25 164.93 52.19Q163.09 51.14 160.99 51.14ZM181.45 59.94Q181.45 55.35 183.47 51.84Q185.5 48.33 189.01 46.42Q192.52 44.5 196.84 44.5Q201.16 44.5 204.67 46.42Q208.18 48.33 210.2 51.84Q212.23 55.35 212.23 59.94Q212.23 64.53 210.15 68.04Q208.07 71.55 204.53 73.47Q200.99 75.39 196.62 75.39Q192.3 75.39 188.84 73.47Q185.39 71.55 183.42 68.04Q181.45 64.53 181.45 59.94ZM204.45 59.94Q204.45 55.68 202.21 53.38Q199.97 51.09 196.73 51.09Q193.49 51.09 191.3 53.38Q189.11 55.68 189.11 59.94Q189.11 64.21 191.25 66.5Q193.38 68.8 196.62 68.8Q198.67 68.8 200.48 67.8Q202.29 66.8 203.37 64.8Q204.45 62.8 204.45 59.94Z"
const WOORD_RESTO = "M249.48 74.9 241.16 60.21H237.6V74.9H230.04V37.21H244.19Q248.56 37.21 251.64 38.75Q254.72 40.29 256.26 42.91Q257.8 45.52 257.8 48.76Q257.8 52.49 255.64 55.49Q253.48 58.48 249.21 59.62L258.23 74.9ZM237.6 54.54H243.92Q247 54.54 248.51 53.06Q250.02 51.57 250.02 48.93Q250.02 46.33 248.51 44.9Q247 43.47 243.92 43.47H237.6ZM291.65 62.21H269.78Q270.05 65.45 272.05 67.29Q274.04 69.12 276.96 69.12Q281.17 69.12 282.95 65.5H291.11Q289.81 69.82 286.14 72.61Q282.47 75.39 277.12 75.39Q272.8 75.39 269.37 73.47Q265.94 71.55 264.03 68.04Q262.11 64.53 262.11 59.94Q262.11 55.3 264 51.79Q265.89 48.28 269.29 46.39Q272.69 44.5 277.12 44.5Q281.39 44.5 284.76 46.33Q288.14 48.17 290 51.55Q291.86 54.92 291.86 59.29Q291.86 60.91 291.65 62.21ZM284.03 57.13Q283.98 54.22 281.93 52.46Q279.88 50.71 276.91 50.71Q274.1 50.71 272.18 52.41Q270.26 54.11 269.83 57.13ZM295.15 65.45H302.77Q302.98 67.18 304.47 68.31Q305.95 69.45 308.17 69.45Q310.33 69.45 311.54 68.58Q312.76 67.72 312.76 66.37Q312.76 64.91 311.27 64.18Q309.79 63.45 306.55 62.59Q303.2 61.78 301.06 60.91Q298.93 60.05 297.39 58.27Q295.85 56.49 295.85 53.46Q295.85 50.98 297.28 48.93Q298.72 46.87 301.39 45.69Q304.06 44.5 307.68 44.5Q313.03 44.5 316.21 47.17Q319.4 49.84 319.72 54.38H312.49Q312.32 52.6 311 51.55Q309.68 50.49 307.46 50.49Q305.41 50.49 304.3 51.25Q303.2 52 303.2 53.35Q303.2 54.87 304.71 55.65Q306.22 56.43 309.41 57.24Q312.65 58.05 314.75 58.92Q316.86 59.78 318.4 61.59Q319.94 63.4 319.99 66.37Q319.99 68.96 318.56 71.01Q317.13 73.06 314.46 74.23Q311.78 75.39 308.22 75.39Q304.55 75.39 301.63 74.06Q298.72 72.74 297.01 70.47Q295.31 68.2 295.15 65.45ZM334.4 51.19V65.67Q334.4 67.18 335.13 67.85Q335.86 68.53 337.59 68.53H341.1V74.9H336.35Q326.79 74.9 326.79 65.61V51.19H323.23V44.98H326.79V37.59H334.4V44.98H341.1V51.19ZM344.06 59.94Q344.06 55.35 346.09 51.84Q348.11 48.33 351.62 46.42Q355.13 44.5 359.45 44.5Q363.77 44.5 367.28 46.42Q370.79 48.33 372.82 51.84Q374.84 55.35 374.84 59.94Q374.84 64.53 372.76 68.04Q370.69 71.55 367.15 73.47Q363.61 75.39 359.24 75.39Q354.92 75.39 351.46 73.47Q348.01 71.55 346.03 68.04Q344.06 64.53 344.06 59.94ZM367.07 59.94Q367.07 55.68 364.83 53.38Q362.59 51.09 359.35 51.09Q356.11 51.09 353.92 53.38Q351.73 55.68 351.73 59.94Q351.73 64.21 353.86 66.5Q356 68.8 359.24 68.8Q361.29 68.8 363.1 67.8Q364.91 66.8 365.99 64.8Q367.07 62.8 367.07 59.94Z"

function RundoLogo({
  size = 40,
  opDonker = true,
  resto = false,
  mono,
}: {
  size?: number
  /** true = op donkere achtergrond (witte letters), false = op lichte (donkerblauw) */
  opDonker?: boolean
  /** toont "Rundo Resto" in plaats van "Rundo" */
  resto?: boolean
  /** alles in één kleur, bv. voor drukwerk of een stempel */
  mono?: string
}) {
  const letter = mono ?? (opDonker ? "#FFFFFF" : DONKER)
  const accent = mono ?? GOUD
  const sub = mono ?? TURQUOISE
  return (
    <svg
      height={size}
      viewBox={`0 0 ${resto ? 392.1 : 229.5} 107.3`}
      role="img"
      aria-label={resto ? "Rundo Resto" : "Rundo"}
      style={{ display: "block", width: "auto", flexShrink: 0 }}
    >
      <g transform="translate(52.75 53.87)">
        <path d={BOOG} fill="none" stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
        <polygon points={PIJL} fill={accent} />
      </g>
      <path d={LETTER_R} fill={letter} />
      <path d={WOORD_UNDO} fill={letter} />
      <ellipse cx="196.84" cy="87.50" rx="12.5" ry="3.8" fill={accent} fillOpacity="0.45" />
      {resto && (
        <>
          <path d={WOORD_RESTO} fill={sub} />
          <ellipse cx="359.45" cy="87.50" rx="12.5" ry="3.8" fill={sub} fillOpacity="0.45" />
        </>
      )}
    </svg>
  )
}

export default function Home() {
  const [lang] = useLang()
  const t = T[lang]
  const router = useRouter()

  // ?via=kiezer zegt de doelpagina dat je de stappen híer al gezien hebt, zodat die
  // haar eigen introscherm mag overslaan. Bewust in de URL: een intro die voorgoed
  // verdwijnt omdat je ooit één keer via de kiezer binnenkwam, is erger dan een intro
  // te veel. Wie via een QR binnenkomt heeft geen via-parameter en krijgt de uitleg.
  const starten = (m: Mode) => {
    try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ }
    router.push(m === "table" ? "/table?via=kiezer" : "/party?via=kiezer")
  }

  // ── Estafette ────────────────────────────────────────────────────────────────
  // Eén gedeelde teller in plaats van twee losse CSS-animaties: eerst loopt Resto
  // zijn stappen af, dan geeft hij de beurt door aan Rundo. Er beweegt dus altijd
  // maar op één plek. De kaart die niet aan de beurt is toont een gedimde
  // samenvatting, zodat je beide flows toch in één blik ziet.
  // null = geen beweging (reduced motion): beide kaarten tonen hun samenvatting.
  const reeks: [Mode, number][] = [
    ...t.tableFlow.map((_, i): [Mode, number] => ["table", i]),
    ...t.partyFlow.map((_, i): [Mode, number] => ["party", i]),
  ]
  const [beurt, setBeurt] = useState<number | null>(0)
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setBeurt(null); return }
    const id = window.setInterval(() => {
      // Niet doortikken in een verborgen tabblad: bij terugkeer begin je gewoon waar je was.
      if (document.hidden) return
      setBeurt((b) => (b === null ? null : (b + 1) % reeks.length))
    }, BEURT_MS)
    return () => window.clearInterval(id)
  }, [reeks.length])
  const actief = beurt === null ? null : reeks[beurt % reeks.length]

  // Je opgeslagen groepen, rechtstreeks uit dezelfde bron als de apps zelf.
  type MiniGroep = { id: string; name: string; settle?: boolean; gast: boolean; af: boolean; pin: boolean; last: string; app: "party" | "table"; code?: string }
  const [groepen, setGroepen] = useState<MiniGroep[]>([])
  const [tafels, setTafels] = useState<MiniGroep[]>([])
  // Hoeveel er in totáál bewaard zijn, per app — geteld op de volledige lijsten vóór
  // het inkorten, want het plafond geldt voor alles, niet enkel wat hier zichtbaar is.
  const [pinTotaal, setPinTotaal] = useState<{ party: number; table: number }>({ party: 0, table: 0 })
  const [melding, setMelding] = useState<string | null>(null)
  // Beide lijsten starten dichtgeklapt; elk kopje klapt apart open.
  const [klap, setKlap] = useState<{ party: boolean; table: boolean }>({ party: false, table: false })
  // Wisbevestiging: welke app staat op het punt gewist te worden?
  const [wisVraag, setWisVraag] = useState<null | "party" | "table">(null)
  // Wissen = verbergen op dít toestel: de groep zelf blijft in de databank bestaan.
  const alleIds = useRef<{ party: string[]; table: string[] }>({ party: [], table: [] })
  const gewisteIds = (app: "party" | "table"): Set<string> => {
    try { const raw = localStorage.getItem(`rundo_chooser_gewist_${app}`); if (raw) return new Set(JSON.parse(raw)) } catch { /* niets */ }
    return new Set()
  }

  // Telefoons zoomen in op invoervelden en houden die stand vast, ook over
  // paginawissels heen. Daarom app-gedrag: de viewport staat vast op schaal 1.
  useEffect(() => {
    try {
      let m = document.querySelector('meta[name="viewport"]')
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "viewport"); document.head.appendChild(m) }
      m.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
      // Geen witte rand en geen lege swipe-ruimte op mobiel. Zelfde kleur als in de
      // <style> onderaan — vroeger stonden daar twee verschillende tinten.
      document.documentElement.style.margin = "0"
      document.body.style.margin = "0"
      document.body.style.background = "#131826"
      document.body.style.overscrollBehaviorY = "none"
    } catch { /* niets */ }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    ;(async () => {
      // Twee aparte poortjes: het Party-toestel-id en het Table-id zijn verschillende
      // sleutels, zodat een ontbrekend Party-id de Table-lijst niet blokkeert.
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
        // Open groepen eerst; afgesloten volgen gedimd, bewaarde daarbinnen bovenaan.
        const weg = gewisteIds("party")
        const alles = [...map.values()].filter((g) => !weg.has(g.id)).sort((a, b) => b.last.localeCompare(a.last))
        alleIds.current.party = alles.map((g) => g.id)
        const lijst = [...alles.filter((g) => !g.af).slice(0, 4), ...alles.filter((g) => g.af).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).slice(0, 3)]
        setGroepen(lijst)
        setPinTotaal((v) => ({ ...v, party: alles.filter((g) => !g.gast && g.pin).length }))
      } catch { /* stil: geen sectie is prima */ }
      // Table: eigen groepen uit de databank, gastgroepen uit de lokale lijst.
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

  // Accentkleur per modus.
  const accent = { table: "#5b9fd6", party: "#f0c14b" }

  const wisAlles = (app: "party" | "table") => {
    const weg = gewisteIds(app)
    alleIds.current[app].forEach((id) => weg.add(id))
    try { localStorage.setItem(`rundo_chooser_gewist_${app}`, JSON.stringify([...weg])) } catch { /* niets */ }
    alleIds.current[app] = []
    if (app === "party") setGroepen([]); else setTafels([])
    setPinTotaal((v) => ({ ...v, [app]: 0 }))
    setWisVraag(null)
  }

  // Bewaren of losmaken zonder eerst de app in te moeten. Zelfde regels als daar:
  // enkel eigen groepen, maximaal drie per app. De melding verdwijnt vanzelf weer.
  const meld = (tekst: string) => { setMelding(tekst); window.setTimeout(() => setMelding(null), 3500) }
  const togglePin = async (g: MiniGroep) => {
    if (g.gast) return
    if (!g.pin && pinTotaal[g.app] >= MAX_PINS) { meld(t.maxPins(MAX_PINS)); return }
    const tabel = g.app === "party" ? "party_groups" : "table_groups"
    const { error } = await supabase.from(tabel).update({ pinned: !g.pin }).eq("id", g.id)
    if (error) { meld(t.pinFail(error.message)); return }
    const zet = (prev: MiniGroep[]) => prev.map((x) => x.id === g.id ? { ...x, pin: !x.pin } : x)
    if (g.app === "party") setGroepen(zet); else setTafels(zet)
    setPinTotaal((v) => ({ ...v, [g.app]: v[g.app] + (g.pin ? -1 : 1) }))
  }
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

  // De stappen als ketting van bolletjes met een bijschrift eronder. Aan de beurt:
  // het actieve bolletje vult zich en het bijschrift noemt de stap. Niet aan de
  // beurt: alles gedimd, bijschrift = samenvatting op één regel.
  const estafette = (m: Mode, stappen: Stap[], kort: string) => {
    const kleur = accent[m]
    const aanDeBeurt = actief?.[0] === m
    const stap = aanDeBeurt ? actief![1] : -1
    const helder = aanDeBeurt || actief === null
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: helder ? 1 : 0.45, transition: "opacity .35s ease" }}>
          {stappen.map((st, i) => (
            <Fragment key={i}>
              {i > 0 && <span aria-hidden style={{ color: "rgba(255,255,255,0.32)", fontSize: 14, fontWeight: 700 }}>›</span>}
              <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                border: `1px solid ${kleur}80`,
                background: i === stap ? kleur : `${kleur}2e`,
                transform: i === stap ? "scale(1.12)" : "none",
                transition: "background .3s ease, transform .3s ease" }}>{st.iconen[0]}</span>
            </Fragment>
          ))}
        </div>
        {/* Vaste hoogte (twee regels), zodat de kaart niet verspringt als het bijschrift wisselt. */}
        <div style={{ height: 34, marginTop: 6, fontSize: 12.5, fontWeight: 600, lineHeight: "17px", overflow: "hidden",
          color: "#e8e2d4", textShadow: "0 1px 3px rgba(0,0,0,0.7)", opacity: helder ? 1 : 0.55, transition: "opacity .35s ease" }}>
          {aanDeBeurt ? `${stap + 1}. ${stappen[stap].label.replace("\n", " ")}` : kort}
        </div>
      </div>
    )
  }

  // De startbalk onderaan elke kaart. De hele kaart start al; de balk maakt duidelijk
  // wát er gebeurt als je tikt, en is voor toetsenbordgebruikers het focuspunt.
  const startKnop = (m: Mode) => (
    <button onClick={(e) => { e.stopPropagation(); starten(m) }} className={`rundo-start-${m}`}
      style={{ position: "relative", zIndex: 2, display: "block", width: "100%", padding: "14px 18px",
        border: "none", borderTop: `1.5px solid ${accent[m]}66`,
        fontSize: 18, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.2,
        background: "rgba(255,255,255,0.06)", color: accent[m],
        transition: "background .15s ease, color .15s ease" }}>
      {t.start} →
    </button>
  )

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 360, margin: "0 auto", paddingTop: "max(18px, env(safe-area-inset-top))", paddingBottom: 28 }}>
        {/* Taalkeuze rechtsboven */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
          <LanguageToggle />
        </div>

        {/* Kop: logo links, naast de taalpil (negatieve bovenmarge), tagline eronder. */}
        <div style={{ textAlign: "left", marginTop: -30, marginBottom: 18, paddingLeft: 20 }}>
          <span style={{ display: "inline-block", marginBottom: 8 }}><RundoLogo size={68} /></span>
          <p style={{ color: "#f0c14b", fontSize: 18, fontWeight: 600, margin: 0 }}>
            {t.tagline}
          </p>
        </div>

        {/* TABLE-kaart — koel blauw. De hele kaart is één tikdoel: starten. */}
        <div onClick={() => starten("table")} style={{ ...S.modeCard, ...S.tableCard }} className="rundo-card rundo-card-table">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/table-image.png" alt="" style={S.cardPhoto} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1,
            background: "linear-gradient(90deg, #131e2b 0%, #131e2b 42%, rgba(19,30,43,0.85) 56%, rgba(19,30,43,0.35) 72%, rgba(19,30,43,0) 100%)" }} />
          <div style={S.cardBody}>
            <span style={{ display: "block", marginBottom: 6 }}><RundoLogo size={40} resto /></span>
            <div style={{ ...S.logoSub, color: "#3bbfc4", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-table.png" alt="" style={{ height: 22, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.tableSub}</span>
            </div>
            {estafette("table", t.tableFlow, t.tableKort)}
          </div>
          {startKnop("table")}
        </div>

        {/* PARTY-kaart — warm geel */}
        <div onClick={() => starten("party")} style={{ ...S.modeCard, ...S.partyCard }} className="rundo-card rundo-card-party">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/party-image.png" alt="" style={S.cardPhoto} />
          {/* Warme gloed die de foto iets verlicht */}
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "62%", zIndex: 1, background: "radial-gradient(120% 90% at 88% 32%, rgba(255,214,130,0.42) 0%, rgba(255,190,90,0.16) 42%, rgba(255,190,90,0) 72%)", mixBlendMode: "screen", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1,
            background: "linear-gradient(90deg, #211c14 0%, #211c14 42%, rgba(33,28,20,0.85) 56%, rgba(33,28,20,0.35) 72%, rgba(33,28,20,0) 100%)" }} />
          <div style={S.cardBody}>
            <span style={{ display: "block", marginBottom: 6 }}><RundoLogo size={40} /></span>
            <div style={{ ...S.logoSub, color: "#f0a500", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-party.png" alt="" style={{ height: 22, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.partySub}</span>
            </div>
            {estafette("party", t.partyFlow, t.partyKort)}
          </div>
          {startKnop("party")}
        </div>

        {/* Jouw groepen, gesplitst per app — één tik en je zit erin. */}
        {(groepen.length > 0 || tafels.length > 0) && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#9aa2b8", letterSpacing: "0.05em", marginBottom: 9 }}>📂 {t.yourGroups}</div>
            {melding && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f2d9a0", background: "rgba(240,193,75,0.12)", border: "1px solid rgba(240,193,75,0.4)", borderRadius: 10, padding: "8px 11px", marginBottom: 8 }}>{melding}</div>
            )}
            {groepen.length > 0 && (<>
              <div onClick={() => { setKlap((k) => ({ ...k, party: !k.party })); setWisVraag(null) }}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(240,193,75,0.3)", borderRadius: 12, padding: "11px 12px", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: accent.party }}>🍻 Rundo</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#d9c58a", background: "rgba(240,193,75,0.14)", borderRadius: 8, padding: "2px 8px" }}>{groepen.length}</span>
                <span style={{ marginLeft: "auto", color: accent.party, fontWeight: 800 }}>{klap.party ? "▾" : "▸"}</span>
              </div>
              {klap.party && groepen.map((g) => (
                <div key={g.id} onClick={() => { try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ } router.push(`/party?g=${g.id}&via=kiezer`) }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: g.pin ? "1px solid rgba(240,193,75,0.55)" : "1px solid rgba(240,193,75,0.3)", borderRadius: 12, padding: "10px 12px", marginBottom: 6, opacity: g.af && !g.pin ? 0.6 : 1 }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: "rgba(240,193,75,0.12)" }}>{g.settle ? "📱" : "✍️"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#e8e4d8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Rundo"}</span>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#d9c58a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.settle ? t.modeQr : t.modeZelf}</span>
                  </span>
                  {g.gast && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#d9c58a", background: "rgba(240,193,75,0.14)", borderRadius: 7, padding: "2px 7px" }}>{t.guestChip}</span>}
                  {!g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#f2d9a0", background: "rgba(240,193,75,0.14)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.openChip}</span>}
                  {g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9fd6ae", background: "rgba(63,158,96,0.16)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.closedChip}</span>}
                  {pinKnop(g)}
                  <span style={{ flexShrink: 0, color: accent.party, fontWeight: 800 }}>›</span>
                </div>
              ))}
              {klap.party && (wisVraag === "party" ? (
                <div style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "10px 12px", margin: "2px 0 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f0a89e", marginBottom: 6 }}>{t.wipeTitle(alleIds.current.party.length, "Rundo")}</div>
                  <div style={{ fontSize: 11.5, color: "#c9a9a3", lineHeight: 1.45, marginBottom: 8 }}>{t.wipeNote}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setWisVraag(null)} style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, color: "#e8e4d8", cursor: "pointer" }}>{t.cancelWord}</button>
                    <button onClick={() => wisAlles("party")} style={{ flex: 1, background: "#c0554a", border: "none", borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{t.wipeDo}</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "right", margin: "0 2px 10px" }}>
                  <span onClick={() => setWisVraag("party")} style={{ fontSize: 11.5, fontWeight: 800, color: "#e0857a", cursor: "pointer" }}>{t.wipeAll}</span>
                </div>
              ))}
            </>)}
            {tafels.length > 0 && (<>
              <div onClick={() => { setKlap((k) => ({ ...k, table: !k.table })); setWisVraag(null) }}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(91,159,214,0.35)", borderRadius: 12, padding: "11px 12px", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: accent.table }}>🧾 Rundo Resto</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "#9cc6ec", background: "rgba(91,159,214,0.16)", borderRadius: 8, padding: "2px 8px" }}>{tafels.length}</span>
                <span style={{ marginLeft: "auto", color: accent.table, fontWeight: 800 }}>{klap.table ? "▾" : "▸"}</span>
              </div>
              {klap.table && tafels.map((g) => (
                <div key={g.id} onClick={() => { if (!g.code) return; try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ } router.push(`/table?code=${g.code}&via=kiezer`) }}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: g.pin ? "1px solid rgba(91,159,214,0.6)" : "1px solid rgba(91,159,214,0.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 6, opacity: g.af && !g.pin ? 0.6 : 1 }}>
                  <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, background: "rgba(91,159,214,0.14)" }}>🧾</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: "#dfe7f2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || "Rundo Resto"}</span>
                  {g.gast && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9cc6ec", background: "rgba(91,159,214,0.16)", borderRadius: 7, padding: "2px 7px" }}>{t.guestChip}</span>}
                  {!g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9cc6ec", background: "rgba(91,159,214,0.16)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.openChip}</span>}
                  {g.af && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#9fd6ae", background: "rgba(63,158,96,0.16)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{t.closedChip}</span>}
                  {pinKnop(g)}
                  <span style={{ flexShrink: 0, color: accent.table, fontWeight: 800 }}>›</span>
                </div>
              ))}
              {klap.table && (wisVraag === "table" ? (
                <div style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "10px 12px", margin: "2px 0 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f0a89e", marginBottom: 6 }}>{t.wipeTitle(alleIds.current.table.length, "Rundo Resto")}</div>
                  <div style={{ fontSize: 11.5, color: "#c9a9a3", lineHeight: 1.45, marginBottom: 8 }}>{t.wipeNote}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setWisVraag(null)} style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, color: "#e8e4d8", cursor: "pointer" }}>{t.cancelWord}</button>
                    <button onClick={() => wisAlles("table")} style={{ flex: 1, background: "#c0554a", border: "none", borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{t.wipeDo}</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "right", margin: "0 2px 10px" }}>
                  <span onClick={() => setWisVraag("table")} style={{ fontSize: 11.5, fontWeight: 800, color: "#e0857a", cursor: "pointer" }}>{t.wipeAll}</span>
                </div>
              ))}
            </>)}
          </div>
        )}

        {/* Voetregel */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <span style={{ fontSize: 13, color: "#b6bdcf", fontWeight: 600, textAlign: "center" }}>
            {t.footer}
          </span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #131826; }
        /* De randkleur staat hier en niet inline: anders wint de inline stijl altijd
           en doet :hover niets (dat was eerder het geval). */
        .rundo-card { transition: transform .15s ease, border-color .15s ease; }
        .rundo-card-party { border-color: rgba(240,193,75,0.35); }
        .rundo-card-table { border-color: rgba(91,159,214,0.4); }
        .rundo-card:active { transform: scale(0.99); }
        .rundo-start-party:active { background: #f0c14b !important; color: #131826 !important; border-top-color: transparent !important; }
        .rundo-start-table:active { background: #5b9fd6 !important; color: #131826 !important; border-top-color: transparent !important; }
        .rundo-start-party:focus-visible, .rundo-start-table:focus-visible { outline: 2px solid #fff; outline-offset: -4px; }
        @media (hover: hover) {
          .rundo-card-party:hover { transform: translateY(-2px); border-color: rgba(240,193,75,0.7); }
          .rundo-card-table:hover { transform: translateY(-2px); border-color: rgba(91,159,214,0.75); }
          .rundo-card-party:hover .rundo-start-party { background: rgba(240,193,75,0.18); }
          .rundo-card-table:hover .rundo-start-table { background: rgba(91,159,214,0.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rundo-card, .rundo-card:hover, .rundo-card:active { transform: none !important; }
        }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    background: "radial-gradient(1200px 600px at 50% -10%, #1c2540 0%, #131826 55%, #0e1119 100%)",
    minHeight: "100dvh",
    color: "#fff",
    padding: "4px 18px 18px",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  modeCard: {
    position: "relative",
    borderRadius: 24,
    marginBottom: 14,
    cursor: "pointer",
    overflow: "hidden",
    // Geen `border`-shorthand: de kleur komt uit de CSS-klasse (zie <style>).
    borderWidth: 1.5,
    borderStyle: "solid",
  },
  cardBody: {
    position: "relative",
    zIndex: 2,
    padding: "18px 20px 14px",
    maxWidth: "76%",
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
  partyCard: {
    background: "#211c14",
    boxShadow: "0 12px 34px -18px rgba(240,193,75,0.3)",
  },
  tableCard: {
    background: "#131e2b",
    boxShadow: "0 12px 34px -18px rgba(91,159,214,0.3)",
  },
  logoSub: {
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: -0.2,
    lineHeight: 1.2,
    fontFamily: "'Nunito', 'Baloo 2', 'DM Sans', -apple-system, 'Segoe UI', sans-serif",
  },
}
