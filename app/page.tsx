"use client"

import { useEffect, useRef, useState } from "react"
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
    showMore: "toon meer",
    showLess: "toon minder",
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
    pickFirst: "Kies Rundo of Rundo Resto",
    pinOn: "Bewaren",
    pinOff: "Niet meer bewaren",
    maxPins: (n: number) => `Je kan maximaal ${n} groepen bewaren. Maak er eerst een los.`,
    openChip: "🟡 open",
    hiddenNote: (app: string) => `${app} verborgen`,
    wipeAll: "🗑 alles wissen",
    wipeTitle: (n: number, app: string) => `${n} ${app}-groep${n === 1 ? "" : "en"} uit jouw lijst wissen?`,
    wipeNote: "Ook de bewaarde. De groepen zelf blijven bestaan — wie de code of link heeft kan er nog in.",
    wipeDo: "🗑 wissen",
    cancelWord: "annuleer",
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
    showMore: "voir plus",
    showLess: "voir moins",
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
    pickFirst: "Choisis Rundo ou Rundo Resto",
    pinOn: "Enregistrer",
    pinOff: "Ne plus enregistrer",
    maxPins: (n: number) => `Tu peux garder ${n} groupes au maximum. Détaches-en un d'abord.`,
    openChip: "🟡 ouvert",
    hiddenNote: (app: string) => `${app} masqué`,
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
  // Welke kaart staat open? De kaarten tonen dichtgeklapt alleen logo en ondertitel;
  // "toon meer" vouwt de stappen uit. Er kan er maar één open staan, zodat er nooit
  // twee even luide startknoppen tegelijk op het scherm staan.
  const [uitgeklapt, setUitgeklapt] = useState<Mode | null>(null)
  const klapUit = (m: Mode) => setUitgeklapt((v) => v === m ? null : m)
  // ?via=kiezer zegt de doelpagina dat je de stappen híer al gelezen hebt, zodat die
  // haar eigen introscherm mag overslaan. Bewust in de URL en niet in localStorage: die
  // vlag hieronder wordt nooit gewist, en een intro die voorgoed verdwijnt omdat je ooit
  // één keer via de kiezer binnenkwam, is erger dan een intro te veel. Wie via een QR
  // binnenkomt heeft geen via-parameter en krijgt de uitleg dus gewoon.
  const starten = (m: Mode) => {
    try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ }
    router.push(m === "table" ? "/table?via=kiezer" : "/party?via=kiezer")
  }
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
  // Beide lijsten starten dichtgeklapt; elk kopje klapt apart open. Kies je bovenaan
  // een app, dan klapt die lijst vanzelf mee open (zie het effect verderop).
  const [klap, setKlap] = useState<{ party: boolean; table: boolean }>({ party: false, table: false })
  // Wisbevestiging: welke app staat op het punt gewist te worden?
  const [wisVraag, setWisVraag] = useState<null | "party" | "table">(null)
  // Wissen = verbergen op dít toestel: de groep zelf blijft in de databank bestaan.
  // De verborgen id's staan in localStorage; de laadroutine filtert ze eruit. Hier
  // houden we ook de vólledige id-lijsten bij, want de zichtbare lijst is ingekort.
  const alleIds = useRef<{ party: string[]; table: string[] }>({ party: [], table: [] })
  const gewisteIds = (app: "party" | "table"): Set<string> => {
    try { const raw = localStorage.getItem(`rundo_chooser_gewist_${app}`); if (raw) return new Set(JSON.parse(raw)) } catch { /* niets */ }
    return new Set()
  }
  // Telefoons houden de ingezoomde stand vast over paginawissels heen. Bij
  // binnenkomst zetten we de zoom heel even vast op 1 en geven de viewport
  // meteen weer vrij, zodat elke overgang op 100% begint.
  // Telefoons zoomen in op invoervelden en houden die stand vast, ook over
  // paginawissels heen — en Android Chrome geeft hem met een meta-wissel niet
  // terug. Daarom app-gedrag: de viewport staat permanent vast op schaal 1, dus
  // invoer-autozoom bestaat niet meer. iOS laat knijpzoomen bij een echt gebaar
  // gewoon toe (het negeert de limiet daarvoor), Android houdt alles strak op 100%.
  useEffect(() => {
    try {
      let m = document.querySelector('meta[name="viewport"]')
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "viewport"); document.head.appendChild(m) }
      m.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
      // De witte rand op mobiel kwam van de standaardmarge én de witte body-kleur
      // achter de pagina; en de pagina was net iets hoger dan het scherm (100vh telt
      // de adresbalk niet mee), waardoor je kon swipen zonder inhoud. Beide dicht.
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
        const weg = gewisteIds("party")
        const alles = [...map.values()].filter((g) => !weg.has(g.id)).sort((a, b) => b.last.localeCompare(a.last))
        alleIds.current.party = alles.map((g) => g.id)
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

  // Accentkleur per modus — dezelfde die de kaart al gebruikt.
  const accent = { table: "#5b9fd6", party: "#f0c14b" }
  useEffect(() => { if (uitgeklapt) setKlap((k) => ({ ...k, [uitgeklapt]: true })) }, [uitgeklapt])
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

  // De dichte kaart houdt zijn witte rand — dat leest als "hier kan je tikken". De
  // opengeklapte krijgt de accentkleur. De andere kaart dimmen we niet meer: je klapt
  // uit om te lézen, niet om te kiezen, dus die blijft gewoon leesbaar.
  const cardState = (m: Mode): React.CSSProperties => ({
    border: uitgeklapt === m ? `2px solid ${accent[m]}` : "1.5px solid rgba(255,255,255,0.4)",
    boxShadow: uitgeklapt === m
      ? `0 18px 40px -18px ${m === "party" ? "rgba(240,193,75,0.45)" : "rgba(91,159,214,0.45)"}`
      : `0 12px 34px -18px ${m === "party" ? "rgba(240,193,75,0.25)" : "rgba(91,159,214,0.25)"}`,
  })

  // "toon meer" op de scheidingslijn onder de ondertitel: klein en grijs, zodat het
  // nooit met de startknop concurreert. De lijn liep er al; het pilletje gaat erop.
  const toonMeer = (m: Mode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13 }}>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.16)" }} />
      <span onClick={(e) => { e.stopPropagation(); klapUit(m) }}
        style={{ flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap", fontSize: 12.5, fontWeight: 700,
          padding: "4px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.62)", userSelect: "none" }}>
        {uitgeklapt === m ? `${t.showLess} \u25B4` : `${t.showMore} \u25BE`}
      </span>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.16)" }} />
    </div>
  )

  // Dichtgeklapt draaien de stappen één voor één voorbij op dezelfde plek. Zo weet je
  // wat er achter "toon meer" zit zonder te tikken, en kost het maar één regel hoogte.
  // Bij twee iconen tonen we alleen het eerste — de "of"-nuance hoort in de volle lijst.
  const voorproef = (m: Mode, stappen: { iconen: string[]; label: string }[]) => {
    if (uitgeklapt === m) return null
    const kleur = accent[m]
    return (
      <div className={`rundo-wissel rundo-wissel-${stappen.length}`}>
        {stappen.map((st, i) => (
          <div key={i}>
            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: `${kleur}2e`,
              border: `1px solid ${kleur}80`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{st.iconen[0]}</span>
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "#131826", background: kleur, borderRadius: 999, padding: "1px 7px" }}>{i + 1}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e8e2d4", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>{st.label.replace("\n", " ")}</span>
          </div>
        ))}
      </div>
    )
  }

  // De stappen staan onder elkaar in plaats van naast elkaar: zo mag het bijschrift
  // voluit in plaats van afgebroken over twee regeltjes, en lees je van boven naar
  // beneden mee met de volgorde. Een stap kan twee iconen dragen — dan staat er een
  // klein "of" tussen en delen ze één nummer.
  const stappenLijst = (m: Mode, stappen: { iconen: string[]; label: string }[]) => {
    if (uitgeklapt !== m) return null
    const kleur = accent[m]
    return (
      <div style={{ position: "relative", marginTop: 13 }}>
        {/* Verbindingslijn door de nummers heen, zodat het als één route leest. */}
        <span style={{ position: "absolute", left: 13, top: 22, bottom: 22, width: 1.5, background: `${kleur}4d` }} />
        {stappen.map((st, i) => (
          <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
            <span style={{ flexShrink: 0, width: 27, height: 27, borderRadius: "50%", background: kleur, color: "#131826",
              fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
            {st.iconen.map((ic, k) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                {k > 0 && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#b9a67c" }}>{t.orWord}</span>}
                <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: `${kleur}2e`,
                  border: `1px solid ${kleur}80`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{ic}</span>
              </span>
            ))}
            {/* De labels dragen een \n voor de oude tweeregelige opmaak; hier past het op één regel.
                De schaduw houdt de tekst leesbaar waar ze over de foto loopt. */}
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e8e2d4", lineHeight: 1.3,
              textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>{st.label.replace("\n", " ")}</span>
          </div>
        ))}
      </div>
    )
  }

  // De startknop hoort bij de kaart en staat er altijd, ook dichtgeklapt — maar dan
  // omlijnd. Vol gekleurd pas als de kaart openstaat, zodat er nooit twee even luide
  // knoppen tegelijk staan te roepen. Fors gezet: dit is waar je naartoe wil.
  const startKnop = (m: Mode) => {
    const open = uitgeklapt === m
    return (
      <button onClick={(e) => { e.stopPropagation(); starten(m) }} className={`rundo-start-${m}`}
        style={{ position: "relative", zIndex: 2, display: "block", width: "100%", padding: "17px 18px",
          border: "none", borderTop: open ? "none" : `1.5px solid ${accent[m]}66`,
          fontSize: 20, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.2,
          background: open ? accent[m] : "rgba(255,255,255,0.06)",
          color: open ? "#131826" : accent[m],
          transition: "background .15s ease, color .15s ease" }}>
        {t.start} →
      </button>
    )
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 360, margin: "0 auto", paddingTop: "max(18px, env(safe-area-inset-top))", paddingBottom: 28 }}>
        {/* Taalkeuze rechtsboven */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 2 }}>
          <LanguageToggle />
        </div>

        {/* Kop: algemeen Rundo-logo (symbool + naam in één), ondertitel eronder. Links
            uitgelijnd met 34px inspringing: gecentreerd kwam de merknaam vlak onder de
            taalpil rechtsboven te zitten, en die twee vechten dan om dezelfde hoek. De
            inspringing houdt het logo van de rand af en lijnt het ongeveer uit met de
            tekst binnen de kaarten, die ook padding hebben. */}
        <div style={{ textAlign: "left", marginTop: 2, marginBottom: 24, paddingLeft: 34 }}>
          <span style={{ display: "inline-block", marginBottom: 8 }}><RundoLogo size={80} /></span>
          <p style={{ color: "#f0c14b", fontSize: 17, fontWeight: 600, margin: 0 }}>
            {t.tagline}
          </p>
        </div>

        {/* TABLE-kaart — koel blauw */}
        <div onClick={() => klapUit("table")} style={{ ...S.modeCard, ...S.tableCard, ...cardState("table") }} className="rundo-card rundo-card-table">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/table-image.png" alt="" style={S.cardPhoto} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1, transition: "background .2s ease",
            background: uitgeklapt === "table"
              ? "linear-gradient(90deg, #131e2b 0%, #131e2b 46%, rgba(19,30,43,0.94) 62%, rgba(19,30,43,0.78) 82%, rgba(19,30,43,0.6) 100%)"
              : "linear-gradient(90deg, #131e2b 0%, #131e2b 42%, rgba(19,30,43,0.85) 56%, rgba(19,30,43,0.35) 72%, rgba(19,30,43,0) 100%)" }} />
          <div style={{ ...S.cardBody, paddingBottom: 16, maxWidth: uitgeklapt === "table" ? "100%" : "74%" }}>
            <span style={{ display: "block", marginBottom: 6 }}><RundoLogo size={44} resto /></span>
            <div style={{ ...S.logoSub, color: "#3bbfc4", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-table.png" alt="" style={{ height: 24, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.tableSub}</span>
            </div>
            {voorproef("table", t.tableFlow)}
            {toonMeer("table")}
            {stappenLijst("table", t.tableFlow)}
          </div>
          {startKnop("table")}
        </div>

        {/* Je kíest hier niet meer — elke kaart heeft zijn eigen startknop. De lijn
            blijft als scheiding tussen de twee, met een kaal "of" ertussen. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 14px" }}>
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{t.orWord}</span>
          <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
        </div>
        {/* PARTY-kaart — warm geel */}
        <div onClick={() => klapUit("party")} style={{ ...S.modeCard, ...S.partyCard, ...cardState("party") }} className="rundo-card rundo-card-party">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/party-image.png" alt="" style={S.cardPhoto} />
          {/* Warme gloed die de foto iets verlicht */}
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "62%", zIndex: 1, background: "radial-gradient(120% 90% at 88% 32%, rgba(255,214,130,0.42) 0%, rgba(255,190,90,0.16) 42%, rgba(255,190,90,0) 72%)", mixBlendMode: "screen", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, zIndex: 1, transition: "background .2s ease",
            background: uitgeklapt === "party"
              ? "linear-gradient(90deg, #211c14 0%, #211c14 46%, rgba(33,28,20,0.94) 62%, rgba(33,28,20,0.78) 82%, rgba(33,28,20,0.6) 100%)"
              : "linear-gradient(90deg, #211c14 0%, #211c14 42%, rgba(33,28,20,0.85) 56%, rgba(33,28,20,0.35) 72%, rgba(33,28,20,0) 100%)" }} />
          <div style={{ ...S.cardBody, paddingBottom: 16, maxWidth: uitgeklapt === "party" ? "100%" : "74%" }}>
            <span style={{ display: "block", marginBottom: 6 }}><RundoLogo size={44} /></span>
            <div style={{ ...S.logoSub, color: "#f0a500", display: "flex", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-party.png" alt="" style={{ height: 24, width: "auto", objectFit: "contain", flexShrink: 0 }} />
              <span>{t.partySub}</span>
            </div>
            {voorproef("party", t.partyFlow)}
            {toonMeer("party")}
            {stappenLijst("party", t.partyFlow)}
          </div>
          {startKnop("party")}
        </div>

        {/* Jouw open groepen, gesplitst per app — één tik en je zit erin. De Rundo-rij
            linkt met ?g=, waar de app de groep meteen opent. De Table-kolom volgt
            zodra die bron gekoppeld is. */}
        {(groepen.length > 0 || tafels.length > 0) && (
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#9aa2b8", letterSpacing: "0.05em", marginBottom: 9 }}>📂 {t.yourGroups}{uitgeklapt === "party" && tafels.length > 0 && <span style={{ fontWeight: 600, color: "#5d6478" }}> · {t.hiddenNote("Rundo Resto")}</span>}{uitgeklapt === "table" && groepen.length > 0 && <span style={{ fontWeight: 600, color: "#5d6478" }}> · {t.hiddenNote("Rundo")}</span>}</div>
            {melding && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#f2d9a0", background: "rgba(240,193,75,0.12)", border: "1px solid rgba(240,193,75,0.4)", borderRadius: 10, padding: "8px 11px", marginBottom: 8 }}>{melding}</div>
            )}
            {groepen.length > 0 && uitgeklapt !== "table" && (<>
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
              {klap.party && (wisVraag === "party" ? (
                <div style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "10px 12px", margin: "2px 0 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f0a89e", marginBottom: 6 }}>{t.wipeTitle(alleIds.current.party.length, "Party")}</div>
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
            {tafels.length > 0 && uitgeklapt !== "party" && (<>
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
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f0a89e", marginBottom: 6 }}>{t.wipeTitle(alleIds.current.table.length, "Table")}</div>
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
@keyframes rundoKiesPuls{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0.25)}50%{box-shadow:0 0 0 8px rgba(255,255,255,0)}}
@keyframes rundoKiesWip{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #0e1119; }
        .rundo-card { transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease; }
        .rundo-card-party:hover { transform: translateY(-2px); border-color: rgba(240,193,75,0.55); }
        .rundo-card-table:hover { transform: translateY(-2px); border-color: rgba(91,159,214,0.55); }
        /* Voorproef in de dichtgeklapte kaart: de stappen wisselen elkaar af op hun
           plek, zodat je ziet wat er achter "toon meer" zit zonder te tikken. */
        .rundo-wissel { position: relative; height: 34px; margin-top: 11px; }
        .rundo-wissel > div { position: absolute; inset: 0; display: flex; align-items: center; gap: 8px; opacity: 0; }
        .rundo-wissel-3 > div { animation: rundoBeurt3 9s infinite; }
        .rundo-wissel-3 > div:nth-child(2) { animation-delay: 3s; }
        .rundo-wissel-3 > div:nth-child(3) { animation-delay: 6s; }
        .rundo-wissel-4 > div { animation: rundoBeurt4 12s infinite; }
        .rundo-wissel-4 > div:nth-child(2) { animation-delay: 3s; }
        .rundo-wissel-4 > div:nth-child(3) { animation-delay: 6s; }
        .rundo-wissel-4 > div:nth-child(4) { animation-delay: 9s; }
@keyframes rundoBeurt3{0%{opacity:0;transform:translateY(6px)}4%{opacity:1;transform:none}30%{opacity:1;transform:none}36%{opacity:0;transform:translateY(-6px)}100%{opacity:0}}
@keyframes rundoBeurt4{0%{opacity:0;transform:translateY(6px)}3%{opacity:1;transform:none}22%{opacity:1;transform:none}27%{opacity:0;transform:translateY(-6px)}100%{opacity:0}}
        /* Op een telefoon bestaat :hover niet. Zonder deze regel geeft de omlijnde
           startknop geen enkel teken dat je hem raakte; nu vult hij bij het indrukken. */
        .rundo-start-party:active { background: #f0c14b !important; color: #131826 !important; border-top-color: transparent !important; }
        .rundo-start-table:active { background: #5b9fd6 !important; color: #131826 !important; border-top-color: transparent !important; }
        @media (hover: hover) {
          .rundo-start-party:hover { background: rgba(240,193,75,0.18); }
          .rundo-start-table:hover { background: rgba(91,159,214,0.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rundo-wissel > div { animation: none; }
          .rundo-wissel > div:first-child { opacity: 1; }
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
    padding: "18px 22px",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  modeCard: {
    position: "relative",
    borderRadius: 24,
    marginBottom: 14,
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
