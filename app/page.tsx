"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLang, LanguageToggle } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { RundoLogo, RundoDealsLogo } from "@/lib/RundoLogo"
import { Icoon } from "@/lib/RundoIconen"

// ─── Schakelaars ────────────────────────────────────────────────────────────
// Groepsdeals staat nog uit; de coupon zit volledig in de code. Zet op true om
// hem terug te tonen.
const TOON_DEALS: boolean = false
// Tagline bovenaan ("Rondjes en rekeningen zonder gedoe!"). Uit = meer ruimte
// voor de kaarten; enkel de taalkeuze blijft rechtsboven staan.
const TOON_TAGLINE: boolean = false
// Waar je opgeslagen groepen staan:
//   "per-kaart" → ingeklapt onder elke modus-kaart (Resto-groepen onder Resto, …)
//   "onderaan"  → samen in één blok onder het startscherm
const GROEPEN_LAYOUT: "per-kaart" | "onderaan" = "per-kaart"
// Wat een tik op de kaart zelf doet:
//   "selecteer" → kaart licht op, de andere dimt, de startknop pulseert.
//                 Starten kan ALLEEN met de startknop; de kaart zelf start nooit.
//   "direct"    → de hele kaart is de startknop.
const KAART_TIK: "selecteer" | "direct" = "selecteer"
// Vorm van de startknop (zonder pijltje, met het icoon van de modus):
//   "balk" → brede balk over de onderkant van de kaart
//   "pil"  → zwevende pil linksonder in de kaart
const START_STIJL: "balk" | "pil" = "balk"
// Jouw groepen: elke groep (open of afgesloten) blijft zoveel dagen op het
// beginscherm staan en verdwijnt dan vanzelf. Rundo telt vanaf de laatste
// activiteit, Resto vanaf het aanmaken (Resto houdt geen activiteit bij).
// Verdwijnen is niet wissen: met de link of code kan je er nog in.
const GROEP_DAGEN = 7
// Vangnet zodat de lijst nooit te lang wordt.
const MAX_GROEPEN = 8
// Uitlegfilmpje per kaart:
//   "naast-start"→ knop "Zo werkt het" naast de startknop onderaan, met ruimte
//                  ertussen zodat je niet per ongeluk start. Standaard.
//   "knop"       → klein knopje in de kaart onder de ondertitel
//   "bij-kiezen" → eerste tik op de kaart kiest ze én speelt de uitleg stil af waar
//                  de foto stond (+ knopje "groot" voor schermvullend)
//   "mini"       → klein gsm-venstertje dat stil in een lus speelt op de foto
//   "uit"        → geen filmpjes
const VIDEO_STIJL: "naast-start" | "bij-kiezen" | "knop" | "mini" | "uit" = "naast-start"
// Bestanden in /public/uitleg/. "groot" = 720p (±1,3 MB) voor de schermvullende
// speler; "klein" (±370 kB) is alleen nodig voor de varianten "mini" en "bij-kiezen".
const FILM = {
  table: { klein: "/uitleg/resto-klein.mp4", groot: "/uitleg/resto-720.mp4", poster: "/uitleg/resto-poster.jpg" },
  party: { klein: "/uitleg/rundo-klein.mp4", groot: "/uitleg/rundo-720.mp4", poster: "/uitleg/rundo-poster.jpg" },
}

const T = {
  nl: {
    tagline: "Rondjes en rekeningen zonder gedoe!",
    partySub: ["Rondjes opnemen", "… en splitten", "zonder gedoe"],
    tableSub: ["Scan de rekening", "… en verdeel", "in groep"],
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
    start: "Start",
    howWorks: "Zo werkt het",
    tapHint: "tik voor uitleg",
    videoBadge: "uitleg",
    bigVideo: "groot",
    replay: "Opnieuw",
    close: "Sluiten",
    pause: "Pauze",
    play: "Verder afspelen",
    prevStep: "Vorige stap",
    nextStep: "Volgende stap",
    seek: "Spoelen",
    playerTip: "Midden: pauze · zijkant: vorige/volgende stap",
    ago: (d: number) => d <= 0 ? "vandaag" : d === 1 ? "gisteren" : `${d} dagen geleden`,
    keepNote: (app: Mode) => `Groepen verdwijnen hier ${GROEP_DAGEN} dagen na ${app === "table" ? "het aanmaken" : "je laatste activiteit"}. Met de link of code kan je er nog in.`,
    openChip: "open",
    countOpen: (n: number) => `${n} open`,
    countClosed: (n: number) => `${n} afgesloten`,
    showWord: "tonen",
    hideWord: "verbergen",
    toGroups: (n: number) => `Jouw groepen (${n})`,
    wipeAll: "🗑 alles wissen",
    wipeTitle: (n: number, app: string) => `${n} ${app}-groep${n === 1 ? "" : "en"} uit jouw lijst wissen?`,
    wipeNote: "Ook de bewaarde. De groepen zelf blijven bestaan — wie de code of link heeft kan er nog in.",
    wipeDo: "🗑 wissen",
    cancelWord: "annuleer",
    footer: "Gratis · geen registratie · eerlijk splitten",
  },
  fr: {
    tagline: "Tournées et additions, sans prise de tête !",
    partySub: ["Note les tournées", "… et partage", "sans prise de tête"],
    tableSub: ["Scanne l'addition", "… et partage", "en groupe"],
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
    // Korter dan "Comment ça marche", zodat het naast de startknop past.
    howWorks: "Voir la démo",
    tapHint: "touche pour l'explication",
    videoBadge: "explication",
    bigVideo: "agrandir",
    replay: "Revoir",
    close: "Fermer",
    pause: "Pause",
    play: "Reprendre",
    prevStep: "Étape précédente",
    nextStep: "Étape suivante",
    seek: "Avancer",
    playerTip: "Milieu : pause · côtés : étape précédente/suivante",
    ago: (d: number) => d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`,
    keepNote: (app: Mode) => `Les groupes disparaissent d'ici ${GROEP_DAGEN} jours après ${app === "table" ? "leur création" : "ta dernière activité"}. Avec le lien ou le code, tu peux toujours y accéder.`,
    openChip: "ouvert",
    countOpen: (n: number) => `${n} ouvert${n === 1 ? "" : "s"}`,
    countClosed: (n: number) => `${n} clôturé${n === 1 ? "" : "s"}`,
    showWord: "afficher",
    hideWord: "masquer",
    toGroups: (n: number) => `Tes groupes (${n})`,
    wipeAll: "🗑 tout effacer",
    wipeTitle: (n: number, app: string) => `Effacer ${n} groupe${n === 1 ? "" : "s"} ${app} de ta liste ?`,
    wipeNote: "Aussi les enregistrés. Les groupes existent encore — le code ou le lien fonctionne toujours.",
    wipeDo: "🗑 effacer",
    cancelWord: "annuler",
    footer: "Gratuit · sans inscription · partage équitable",
  },
}

type Mode = "table" | "party"


const PlayIcoon = ({ size = 11 }: { size?: number }) => (
  <svg aria-hidden viewBox="0 0 10 12" width={size} height={size * 1.2} style={{ display: "block" }}><path d="M0 0l10 6-10 6z" fill="currentColor" /></svg>
)

// Schermvullende speler in "stories"-stijl: vier balkjes bovenaan (de vier stappen
// uit het filmpje), sluitknop rechtsboven en onderaan meteen de startknop van die
// modus. Bediening: tik midden = pauze/verder, tik links/rechts = vorige/volgende
// stap, schuifje = spoelen. Na afloop pulseert de startknop en verschijnt "Opnieuw".
const STAPPEN = 4
const PauzeIcoon = ({ size = 14 }: { size?: number }) => (
  <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }}><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
)
function UitlegSpeler({ m, knop, onStart, onSluit, t }: {
  m: Mode; knop: React.ReactNode; onStart: () => void; onSluit: () => void
  t: { replay: string; close: string; pause: string; play: string; prevStep: string; nextStep: string; seek: string; playerTip: string }
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [tijd, setTijd] = useState(0)
  const [duur, setDuur] = useState(0)
  const [pauze, setPauze] = useState(false)
  const [klaar, setKlaar] = useState(false)
  const [tip, setTip] = useState(true)
  const [flits, setFlits] = useState<null | "l" | "r">(null)
  const slepen = useRef(false)
  useEffect(() => {
    const vorige = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onSluit() }
    window.addEventListener("keydown", esc)
    const weg = window.setTimeout(() => setTip(false), 3500)
    return () => { document.body.style.overflow = vorige; window.removeEventListener("keydown", esc); window.clearTimeout(weg) }
  }, [onSluit])
  const speel = () => { const v = ref.current; if (!v) return; setKlaar(false); void v.play().catch(() => {}) }
  const wissel = () => { const v = ref.current; if (!v) return; if (v.paused) speel(); else v.pause() }
  const opnieuw = () => { const v = ref.current; if (!v) return; v.currentTime = 0; speel() }
  // Spring naar het begin van de vorige/volgende stap. Zit je al meer dan 1,2 s in
  // een stap, dan brengt "terug" je eerst naar het begin van die stap.
  const stap = (richting: -1 | 1) => {
    const v = ref.current; if (!v || !v.duration) return
    const lengte = v.duration / STAPPEN
    const nu = Math.floor(v.currentTime / lengte)
    const doel = richting < 0 ? (v.currentTime - nu * lengte < 1.2 ? nu - 1 : nu) * lengte : (nu + 1) * lengte
    v.currentTime = Math.max(0, Math.min(v.duration - 0.1, doel))
    speel()
    setFlits(richting < 0 ? "l" : "r"); window.setTimeout(() => setFlits(null), 450)
  }
  const voortgang = duur ? tijd / duur : 0
  const sec = (x: number) => `0:${String(Math.floor(x)).padStart(2, "0")}`
  const zone: React.CSSProperties = { border: "none", background: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }
  const rondje: React.CSSProperties = { position: "absolute", top: "50%", borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", transition: "opacity .2s ease" }
  return (
    <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "#0A1416", display: "flex", flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", animation: "rundoIn .2s ease" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <video ref={ref} src={FILM[m].groot} poster={FILM[m].poster} autoPlay muted playsInline preload="auto"
          onLoadedMetadata={(e) => setDuur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => { if (!slepen.current) setTijd(e.currentTarget.currentTime) }}
          onPlay={() => setPauze(false)} onPause={(e) => setPauze(!e.currentTarget.ended)}
          onEnded={() => setKlaar(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }} />
        {/* Tikzones: links = vorige stap, midden = pauze, rechts = volgende stap. */}
        <div style={{ position: "absolute", inset: "60px 0 0 0", display: "flex" }}>
          <button type="button" aria-label={t.prevStep} onClick={() => stap(-1)} style={{ ...zone, flex: "0 0 28%" }} />
          <button type="button" aria-label={pauze ? t.play : t.pause} onClick={wissel} style={{ ...zone, flex: 1 }} />
          <button type="button" aria-label={t.nextStep} onClick={() => stap(1)} style={{ ...zone, flex: "0 0 28%" }} />
        </div>
        <span aria-hidden style={{ ...rondje, left: "50%", width: 74, height: 74, margin: "-37px 0 0 -37px", opacity: pauze && !klaar ? 1 : 0 }}><PlayIcoon size={24} /></span>
        <span aria-hidden style={{ ...rondje, left: 14, width: 46, height: 46, marginTop: -23, opacity: flits === "l" ? 1 : 0, fontSize: 20, fontWeight: 800 }}>‹</span>
        <span aria-hidden style={{ ...rondje, right: 14, width: 46, height: 46, marginTop: -23, opacity: flits === "r" ? 1 : 0, fontSize: 20, fontWeight: 800 }}>›</span>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", pointerEvents: "none", opacity: tip ? 1 : 0, transition: "opacity .4s ease" }}>
          <span style={{ background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>{t.playerTip}</span>
        </div>
        <div style={{ position: "absolute", top: 14, left: 16, right: 66, display: "flex", gap: 4, pointerEvents: "none" }}>
          {Array.from({ length: STAPPEN }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", background: "#fff", width: `${Math.max(0, Math.min(1, voortgang * STAPPEN - i)) * 100}%` }} />
            </span>
          ))}
        </div>
        <button type="button" onClick={onSluit} aria-label={t.close}
          style={{ position: "absolute", top: 4, right: 10, width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      {/* Pauzeknop, schuifje om te spoelen en de tijd. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 0" }}>
        <button type="button" onClick={wissel} aria-label={pauze || klaar ? t.play : t.pause}
          style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {pauze || klaar ? <PlayIcoon size={13} /> : <PauzeIcoon />}
        </button>
        <input type="range" min={0} max={1000} step={1} aria-label={t.seek} value={Math.round(voortgang * 1000)}
          onPointerDown={() => { slepen.current = true }}
          onPointerUp={() => { slepen.current = false }}
          onChange={(e) => { const v = ref.current; if (!v || !v.duration) return; const nieuw = Number(e.target.value) / 1000 * v.duration; v.currentTime = nieuw; setTijd(nieuw); setKlaar(false) }}
          style={{ flex: 1, accentColor: MODUS[m].kleur, height: 28 }} />
        <span style={{ flexShrink: 0, color: "#fff", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{sec(tijd)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12 }}>
        {klaar && (
          <button type="button" onClick={opnieuw}
            style={{ height: 56, padding: "0 16px", borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.3)", background: "none",
              color: "#fff", fontSize: 15, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>{t.replay}</button>
        )}
        <button type="button" onClick={onStart} className={klaar ? "rundo-puls-balk" : undefined}
          style={{ position: "relative", overflow: "hidden", flex: 1, height: 56, borderRadius: 14, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 18, fontWeight: 800, fontFamily: "inherit",
            background: MODUS[m].knop, color: MODUS[m].knopTekst }}>{knop}</button>
      </div>
    </div>
  )
}

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
  type MiniGroep = { id: string; name: string; settle?: boolean; gast: boolean; af: boolean; last: string; app: "party" | "table"; code?: string }
  const [groepen, setGroepen] = useState<MiniGroep[]>([])
  const [tafels, setTafels] = useState<MiniGroep[]>([])
  // Pas true als we weten of er groepen zijn, zodat de kaarten niet eerst zakken
  // en dan terugspringen.
  const [geladen, setGeladen] = useState(false)
  const [klap, setKlap] = useState<{ party: boolean; table: boolean }>({ party: false, table: false })
  const [wisVraag, setWisVraag] = useState<null | "party" | "table">(null)
  // Welke kaart is aangetikt (alleen bij KAART_TIK = "selecteer").
  const [gekozen, setGekozen] = useState<Mode | null>(null)
  // Welk uitlegfilmpje schermvullend openstaat.
  const [film, setFilm] = useState<Mode | null>(null)
  // Een tik op de kaart kiest ze alleen (ook een tweede tik start niets).
  const kaartTik = (m: Mode) => {
    if (KAART_TIK === "direct") starten(m)
    else setGekozen(m)
  }
  const alleIds = useRef<{ party: string[]; table: string[] }>({ party: [], table: [] })
  const groepenSectie = useRef<HTMLDivElement>(null)
  const gewisteIds = (app: "party" | "table"): Set<string> => {
    try { const raw = localStorage.getItem(`rundo_chooser_gewist_${app}`); if (raw) return new Set(JSON.parse(raw)) } catch { /* niets */ }
    return new Set()
  }
  // Hoeveel dagen geleden (kalenderdagen), voor "vandaag" / "gisteren" / "3 dagen geleden".
  const dagenGeleden = (iso: string) => {
    const t0 = Date.parse(iso); if (Number.isNaN(t0)) return GROEP_DAGEN + 1
    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0)
    const dan = new Date(t0); dan.setHours(0, 0, 0, 0)
    return Math.round((vandaag.getTime() - dan.getTime()) / 864e5)
  }
  // Groepen van de laatste GROEP_DAGEN dagen: open eerst, dan afgesloten, telkens
  // de recentste bovenaan (de invoer is al op datum gesorteerd).
  const recent = (alles: MiniGroep[]) => {
    const binnen = alles.filter((g) => dagenGeleden(g.last) < GROEP_DAGEN)
    return [...binnen.filter((g) => !g.af), ...binnen.filter((g) => g.af)].slice(0, MAX_GROEPEN)
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
          supabase.from("party_groups").select("id,name,last_active,finalized,settle").eq("owner_id", dev),
          supabase.from("party_people").select("group_id").eq("claimed_by", dev),
        ])
        const map = new Map<string, MiniGroep>()
        for (const g of eigen.data ?? []) {
          map.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", settle: !!g.settle, gast: false, af: !!g.finalized, last: (g.last_active as string) || "", app: "party" })
        }
        const gastIds = [...new Set((gast.data ?? []).map((r) => r.group_id as string))].filter((id) => !map.has(id))
        if (gastIds.length > 0) {
          const { data } = await supabase.from("party_groups").select("id,name,last_active,finalized,settle").in("id", gastIds)
          for (const g of data ?? []) {
            map.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", settle: !!g.settle, gast: true, af: !!g.finalized, last: (g.last_active as string) || "", app: "party" })
          }
        }
        const weg = gewisteIds("party")
        const alles = [...map.values()].filter((g) => !weg.has(g.id)).sort((a, b) => b.last.localeCompare(a.last))
        alleIds.current.party = alles.map((g) => g.id)
        setGroepen(recent(alles))
      } catch { /* stil: geen sectie is prima */ }
      try {
        const ownerId = localStorage.getItem("rundo_owner_id")
        if (!ownerId) throw new Error("geen table-id")
        let lokaal: { id: string; name: string; invite_code: string; role: string }[] = []
        try { const raw = localStorage.getItem(`rundo_table_groups_${ownerId}`); if (raw) lokaal = JSON.parse(raw) } catch { /* niets */ }
        const tafelMap = new Map<string, MiniGroep>()
        const { data: eigenT } = await supabase.from("table_groups").select("id,name,invite_code,finalized,created_at").eq("owner_id", ownerId)
        for (const g of eigenT ?? []) {
          tafelMap.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", gast: false, af: !!g.finalized, last: (g.created_at as string) || "", app: "table", code: (g.invite_code as string) || "" })
        }
        const gastIds = lokaal.filter((x) => x.role === "gast" && !tafelMap.has(x.id)).map((x) => x.id)
        if (gastIds.length > 0) {
          const { data: gastT } = await supabase.from("table_groups").select("id,name,invite_code,finalized,created_at").in("id", gastIds)
          for (const g of gastT ?? []) {
            tafelMap.set(g.id as string, { id: g.id as string, name: (g.name as string) || "", gast: true, af: !!g.finalized, last: (g.created_at as string) || "", app: "table", code: (g.invite_code as string) || "" })
          }
        }
        const wegT = gewisteIds("table")
        const allesT = [...tafelMap.values()].filter((g) => !wegT.has(g.id)).sort((a, b) => b.last.localeCompare(a.last))
        alleIds.current.table = allesT.map((g) => g.id)
        setTafels(recent(allesT))
      } catch { /* stil */ }
      setGeladen(true)
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
    setWisVraag(null)
  }


  // Eén vormtaal voor het hele scherm: lichte kaarten op een warme achtergrond,
  // marineblauwe tekst. Elke modus heeft één eigen tint (turquoise-blauw voor Resto,
  // goud voor Rundo) die terugkomt in de rand, de kaartkleur en de startbalk.

  // Startknop: icoon van de modus + "Start". Pulseert zodra de kaart gekozen is.
  const naastUitleg = VIDEO_STIJL === "naast-start"
  const startKnop = (m: Mode) => {
    const md = MODUS[m]
    const pil = START_STIJL === "pil" && !naastUitleg
    const puls = gekozen === m ? ` ${pil ? "rundo-puls-pil" : "rundo-puls-balk"} m-${m}` : ""
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); starten(m) }} className={`rundo-start${puls}`}
        style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexShrink: 0,
          fontSize: 19, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", letterSpacing: 0.1, border: "none",
          background: md.knop, color: md.knopTekst, transition: "filter .15s ease, transform .1s ease",
          ...(naastUitleg
            ? { flex: 1, minWidth: 0, height: 56, padding: "0 10px", borderRadius: 14, overflow: "hidden", whiteSpace: "nowrap" }
            : pil
            ? { alignSelf: "flex-start", height: 52, padding: "0 24px", margin: "0 16px 16px", borderRadius: 999, boxShadow: `0 10px 22px -10px ${md.schaduw}` }
            : { width: "100%", height: 62, padding: "0 18px", borderRadius: 0, overflow: "hidden" }) }}>
        {knopInhoud(m)}
      </button>
    )
  }
  // Icoon + label van de startknop (ook gebruikt in de uitlegspeler).
  const knopInhoud = (m: Mode) => (<>
    <Icoon naam={m === "table" ? "scan" : "noteer"} size={21} />
    {t.start}
  </>)
  const openFilm = (e: React.MouseEvent, m: Mode) => { e.stopPropagation(); setFilm(m) }

  // Kaart: logo en ondertitel links, je foto rechts die naar links in de kaartkleur
  // vervaagt, startbalk onderaan. De kaarten rekken mee zodat het startscherm
  // precies één gsm-scherm vult.
  const modusKaart = (m: Mode) => {
    const resto = m === "table"
    const md = MODUS[m]
    const [regel1, ...vervolg] = resto ? t.tableSub : t.partySub
    const actief = gekozen === m
    const ander = gekozen !== null && !actief
    return (
      <div role="button" tabIndex={0} aria-pressed={KAART_TIK === "selecteer" ? actief : undefined}
        onClick={(e) => { e.stopPropagation(); kaartTik(m) }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); kaartTik(m) } }}
        className={KAART_TIK === "direct" ? "rundo-kaart rundo-kaart-direct" : "rundo-kaart"}
        style={{ ...S.kaart, background: md.kaart, cursor: "pointer",
          border: actief ? `2.5px solid ${md.kleur}` : `1.5px solid ${md.kleur}99`,
          boxShadow: actief ? `0 18px 34px -14px ${md.schaduw}` : `0 12px 26px -18px ${md.schaduw}`,
          // Zacht dimmen: de andere kaart blijft goed leesbaar, ze wijkt alleen wat terug.
          opacity: ander ? 0.8 : 1, filter: ander ? "saturate(0.75)" : undefined,
          transform: actief ? "scale(1.012)" : undefined,
          transition: "opacity .25s ease, filter .25s ease, transform .25s ease, box-shadow .25s ease, border-color .25s ease" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resto ? "/table-image.png" : "/party-image.png"} alt="" style={S.cardPhotoWaas} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resto ? "/table-image.png" : "/party-image.png"} alt=""
          style={{ ...S.cardPhoto, transition: "opacity .35s ease", opacity: VIDEO_STIJL === "bij-kiezen" && actief ? 0 : 1 }} />
        {/* Variant "bij-kiezen": de uitleg speelt stil waar de foto stond. Pas
            gerenderd (en dus geladen) als je de kaart kiest. */}
        {VIDEO_STIJL === "bij-kiezen" && actief && (
          <video src={FILM[m].klein} poster={FILM[m].poster} autoPlay muted loop playsInline preload="auto" aria-hidden
            style={{ ...S.cardPhoto, width: "62%", objectPosition: "center 50%", animation: "rundoIn .35s ease" }} />
        )}
        <div style={{ position: "absolute", inset: 0, zIndex: 1,
          background: `linear-gradient(90deg, rgba(${md.kaartRgb},0.86) 0%, rgba(${md.kaartRgb},0.84) 30%, rgba(${md.kaartRgb},0.6) 46%, rgba(${md.kaartRgb},0.15) 66%, rgba(${md.kaartRgb},0) 82%)` }} />
        {VIDEO_STIJL === "bij-kiezen" && (actief ? (
          <button type="button" onClick={(e) => openFilm(e, m)}
            style={{ position: "absolute", zIndex: 4, top: 10, right: 10, height: 34, padding: "0 12px", display: "flex", alignItems: "center", gap: 6,
              borderRadius: 999, border: "none", background: "rgba(14,26,46,0.85)", color: "#fff", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
            <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            {t.bigVideo}
          </button>
        ) : (
          <span aria-hidden style={{ position: "absolute", zIndex: 3, top: 10, right: 10, display: "flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,0.92)", border: `1px solid ${md.kleur}`, borderRadius: 999, padding: "4px 10px 4px 8px",
            fontSize: 11.5, fontWeight: 800, color: K.tekst }}><PlayIcoon size={9} />{t.tapHint}</span>
        ))}
        {/* Variant "mini": klein gsm-venstertje dat stil in een lus speelt. */}
        {VIDEO_STIJL === "mini" && (
          <button type="button" onClick={(e) => openFilm(e, m)} aria-label={t.howWorks}
            style={{ position: "absolute", zIndex: 3, right: 14, top: 14, bottom: 76, aspectRatio: "9 / 16", padding: 0, borderRadius: 12, overflow: "hidden",
              border: "2.5px solid #fff", background: "#000", cursor: "pointer", transform: "rotate(3deg)", boxShadow: "0 10px 22px -10px rgba(14,26,46,0.6)" }}>
            <video src={FILM[m].klein} poster={FILM[m].poster} autoPlay muted loop playsInline preload="metadata" aria-hidden
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <span style={{ position: "absolute", left: "50%", bottom: 6, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4,
              background: "rgba(14,26,46,0.82)", color: "#fff", fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "3px 8px 3px 6px", whiteSpace: "nowrap" }}>
              <PlayIcoon size={8} />{t.videoBadge}</span>
          </button>
        )}
        <div style={{ position: "relative", zIndex: 2, flex: 1, padding: "16px 16px 14px", maxWidth: VIDEO_STIJL === "uit" ? undefined : "68%" }}>
          <span style={{ display: "inline-block", filter: `drop-shadow(0 0 8px rgb(${md.kaartRgb})) drop-shadow(0 0 3px rgb(${md.kaartRgb}))` }}><RundoLogo size={46} resto={resto} opDonker={false} /></span>
          <div style={{ ...S.logoSub, marginTop: 6, textShadow: `0 0 10px rgb(${md.kaartRgb}), 0 0 18px rgb(${md.kaartRgb}), 0 0 4px rgb(${md.kaartRgb})` }}>
            <span style={{ display: "block", color: K.tekst, fontWeight: 800 }}>{regel1}</span>
            {vervolg.map((regel, i) => <span key={i} style={{ display: "block" }}>{regel}</span>)}
          </div>
          {/* Variant "knop": klein wit knopje onder de ondertitel. */}
          {VIDEO_STIJL === "knop" && (
            <button type="button" onClick={(e) => openFilm(e, m)}
              style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 13px 0 5px", whiteSpace: "nowrap",
                borderRadius: 999, background: "#fff", border: `1.5px solid ${md.kleur}`, color: K.tekst, fontSize: 13.5, fontWeight: 800,
                fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 10px -8px rgba(14,26,46,0.5)" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: md.knop, color: md.knopTekst, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 2 }}><PlayIcoon /></span>
              {t.howWorks}
            </button>
          )}
        </div>
        {naastUitleg ? (
          // Onderaan twee losse knoppen met 10 px ruimte: wit "Zo werkt het" en de
          // volle startknop. Anders van vorm en niet tegen elkaar, dus minder mistikken.
          <div style={{ position: "relative", zIndex: 3, display: "flex", gap: 10, padding: "0 12px 12px", flexShrink: 0 }}>
            <button type="button" onClick={(e) => openFilm(e, m)}
              style={{ flex: "0 0 46%", minWidth: 0, height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 6px",
                borderRadius: 14, background: "#fff", border: `2px solid ${md.kleur}`, color: K.tekst, fontSize: lang === "fr" ? 13.5 : 14.5, fontWeight: 800,
                fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
              <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: md.knop, color: md.knopTekst, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 2 }}><PlayIcoon /></span>
              {t.howWorks}
            </button>
            {startKnop(m)}
          </div>
        ) : startKnop(m)}
      </div>
    )
  }

  const chip = (tekst: string, vol: boolean) => (
    <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", borderRadius: 999, padding: "3px 9px",
      whiteSpace: "nowrap", background: vol ? DEALS.kleur : "transparent", color: vol ? "#FFFFFF" : K.zacht,
      border: `1px solid ${vol ? DEALS.kleur : K.lijn}` }}>{tekst}</span>
  )

  // ─── Opgeslagen groepen ───────────────────────────────────────────────────
  // Kop: een volle, tikbare balk (min. 50 px hoog) met tellers "x open · y afgesloten"
  // en een duidelijke tonen/verbergen-knop. Ingeklapt bij het openen van de pagina.
  const lijstKop = (app: Mode, lijst: MiniGroep[], perKaart: boolean) => {
    const open = lijst.filter((g) => !g.af).length
    const af = lijst.length - open
    const isOpen = klap[app]
    const tint = MODUS[app].kleur
    return (
      <button type="button" aria-expanded={isOpen}
        onClick={() => { setKlap((k) => ({ ...k, [app]: !k[app] })); setWisVraag(null) }}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "9px 12px",
          background: "#FFFFFF", border: `1.5px solid ${isOpen ? tint : K.lijn}`, borderRadius: 14, cursor: "pointer",
          fontFamily: "inherit", textAlign: "left", color: K.tekst, boxShadow: "0 4px 12px -10px rgba(14,26,46,0.4)" }}>
        {perKaart
          ? <span style={{ ...S.icoonVak, width: 34, height: 34, borderRadius: 10, background: MODUS[app].kaart, border: `1px solid ${tint}66` }}><Icoon naam="groep" size={18} /></span>
          : <RundoLogo size={22} resto={app === "table"} opDonker={false} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          {perKaart && <span style={{ display: "block", fontSize: 14.5, fontWeight: 800 }}>{t.yourGroups}</span>}
          <span style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: perKaart ? 3 : 0 }}>
            {open > 0 && <span style={{ ...S.chipKlein, background: K.goudZacht, color: K.goudDiep }}>{t.countOpen(open)}</span>}
            {af > 0 && <span style={{ ...S.chipKlein, background: "#E8F3EC", color: "#2F7A4A" }}>{t.countClosed(af)}</span>}
          </span>
        </span>
        <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: K.zacht }}>{isOpen ? t.hideWord : t.showWord}</span>
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={K.zacht} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transition: "transform .2s ease", transform: isOpen ? "rotate(180deg)" : "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
    )
  }
  const statusChips = (g: MiniGroep) => (<>
    {g.gast && <span style={{ ...S.chipKlein, background: K.vlak, color: K.zacht }}>{t.guestChip}</span>}
    {!g.af && <span style={{ ...S.chipKlein, background: K.goudZacht, color: K.goudDiep }}>{t.openChip}</span>}
    {g.af && <span style={{ ...S.chipKlein, background: "#E8F3EC", color: "#2F7A4A" }}>{t.closedChip}</span>}
  </>)
  const openGroep = (g: MiniGroep) => {
    if (g.app === "table" && !g.code) return
    try { localStorage.setItem("rundo_via_kiezer", "1") } catch { /* niets */ }
    router.push(g.app === "party" ? `/party?g=${g.id}&via=kiezer` : `/table?code=${g.code}&via=kiezer`)
  }
  const groepRij = (g: MiniGroep) => (
    <div key={g.id} onClick={() => openGroep(g)}
      style={{ ...S.rij, opacity: g.af ? 0.62 : 1 }}>
      <span style={{ ...S.icoonVak, width: 32, height: 32, borderRadius: 10 }}>
        <Icoon naam={g.app === "table" ? "scan" : g.settle ? "deel" : "noteer"} size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={S.rijNaam}>{g.name || (g.app === "table" ? "Rundo Resto" : "Rundo")}</span>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: K.zacht }}>
          {g.app === "party" && `${g.settle ? t.modeQr : t.modeZelf} · `}{t.ago(dagenGeleden(g.last))}
        </span>
      </span>
      {statusChips(g)}
      <span style={{ flexShrink: 0, color: K.zacht, fontWeight: 800 }}>›</span>
    </div>
  )
  const wisBlok = (app: Mode) => wisVraag === app ? (
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
  // Eén blok per app: kop + (uitgeklapt) de rijen en de wis-link.
  const groepenBlok = (app: Mode, perKaart: boolean) => {
    const lijst = app === "party" ? groepen : tafels
    if (lijst.length === 0) return null
    return (
      <div style={{ flexShrink: 0, marginTop: perKaart ? 8 : 0, marginBottom: perKaart ? 0 : 10 }}>
        {lijstKop(app, lijst, perKaart)}
        {klap[app] && (
          <div style={{ marginTop: 6 }}>
            {lijst.map(groepRij)}
            <p style={{ margin: "2px 4px 4px", fontSize: 11.5, lineHeight: 1.4, fontWeight: 600, color: K.zacht }}>{t.keepNote(app)}</p>
            {wisBlok(app)}
          </div>
        )}
      </div>
    )
  }

  const perKaart = GROEPEN_LAYOUT === "per-kaart"
  const aantalGroepen = groepen.length + tafels.length
  const zakken = geladen && aantalGroepen === 0

  return (
    // Tik naast de kaarten = keuze ongedaan maken.
    <div style={S.page} onClick={() => setGekozen(null)}>
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        {/* Eerste scherm: kop en beide modi vullen samen de schermhoogte. */}
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column",
          paddingTop: "max(14px, env(safe-area-inset-top))", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
          {/* Zonder groepen zakken taalkeuze en kaarten samen wat: 1/3 van de lege
              ruimte komt erboven, 2/3 eronder. Met groepen (of tijdens het laden)
              staat alles gewoon bovenaan. flex-grow schuift zacht mee. */}
          <div aria-hidden style={{ flex: `${zakken ? 1 : 0} 1 0px`, minHeight: 0, transition: "flex-grow .4s ease" }} />
          {/* Kop zonder los logo (dat staat al op beide kaarten): tagline links,
              taalkeuze rechts, groter zodat je hem op gsm makkelijk raakt. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: TOON_TAGLINE ? "space-between" : "flex-end", gap: 12, padding: "0 2px", margin: TOON_TAGLINE ? "2px 0 12px" : "0 0 8px", flexShrink: 0 }}>
            {TOON_TAGLINE && <p style={{ margin: 0, color: K.tekst, fontSize: 16.5, fontWeight: 800, lineHeight: 1.25, letterSpacing: -0.2 }}>{t.tagline}</p>}
            <div className="rundo-taal"><LanguageToggle /></div>
          </div>

          {modusKaart("table")}
          {perKaart && groepenBlok("table", true)}

          {/* "of" tussen de twee modi. Zonder groepen (zakken) wordt het een grote ronde
              "of" met een turquoise lijn naar Resto en een gouden naar Rundo: de kaarten
              staan dan verder uit elkaar en het scherm is beter gevuld. */}
          <div style={{ display: "flex", alignItems: "center", gap: zakken ? 14 : 10, margin: zakken ? "30px 0" : "8px 0", flexShrink: 0,
            transition: "margin .4s ease" }}>
            <span style={{ flex: 1, height: zakken ? 2.5 : 1.5, borderRadius: 2,
              background: zakken ? `linear-gradient(90deg, ${MODUS.table.kleur}00, ${MODUS.table.kleur})` : "#D9D2C3" }} />
            <span style={{ fontWeight: 800, color: K.tekst, background: "#FFFFFF", lineHeight: 1.2, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all .4s ease",
              ...(zakken
                ? { width: 60, height: 60, borderRadius: "50%", fontSize: 21, border: "2.5px solid #D9D2C3", boxShadow: "0 8px 18px -10px rgba(14,26,46,0.45)" }
                : { fontSize: 15, borderRadius: 999, padding: "4px 16px", border: "1.5px solid #D9D2C3", boxShadow: "0 4px 10px -6px rgba(14,26,46,0.35)" }) }}>{t.orWord}</span>
            <span style={{ flex: 1, height: zakken ? 2.5 : 1.5, borderRadius: 2,
              background: zakken ? `linear-gradient(90deg, ${MODUS.party.kleur}, ${MODUS.party.kleur}00)` : "#D9D2C3" }} />
          </div>

          {modusKaart("party")}
          {perKaart && groepenBlok("party", true)}

          {/* GROEPSDEALS — voorlopig verborgen (TOON_DEALS bovenaan). Oogt als een
              coupon: groene stippelrand, afscheurstrook rechts met groepsicoon. */}
          {TOON_DEALS && (
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
          )}

          {/* Variant "onderaan": een duidelijke knop die naar je groepen scrolt, want
              die staan net onder de vouw. */}
          {!perKaart && aantalGroepen > 0 && (
            <button type="button" onClick={() => groepenSectie.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ alignSelf: "center", marginTop: 12, display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 18px",
                background: "#FFFFFF", border: `1.5px solid ${K.lijn}`, borderRadius: 999, fontFamily: "inherit",
                fontSize: 14, fontWeight: 800, color: K.tekst, cursor: "pointer", boxShadow: "0 4px 12px -8px rgba(14,26,46,0.4)" }}>
              {t.toGroups(aantalGroepen)}
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          )}

          <div aria-hidden style={{ flex: `${zakken ? 2 : 1} 1 0px`, minHeight: 0, transition: "flex-grow .4s ease" }} />
          <div style={{ textAlign: "center", padding: "12px 0 4px", fontSize: 12, color: K.zacht, fontWeight: 600 }}>{t.footer}</div>
        </div>

        {!perKaart && aantalGroepen > 0 && (
          <div ref={groepenSectie} style={{ paddingTop: 14, paddingBottom: 28, scrollMarginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: K.tekst, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.yourGroups}</span>
              <span style={{ flex: 1, height: 1.5, background: "#D9D2C3" }} />
            </div>
            {groepenBlok("table", false)}
            {groepenBlok("party", false)}
          </div>
        )}
      </div>

      {film && (
        <UitlegSpeler m={film} knop={knopInhoud(film)} t={t}
          onSluit={() => setFilm(null)}
          onStart={() => { const m = film; setFilm(null); starten(m) }} />
      )}


      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: ${K.achtergrond}; }
        .rundo-start:active { filter: brightness(0.92); transform: scale(0.99); }
        .rundo-start:focus-visible { outline: 3px solid ${K.tekst}; outline-offset: -3px; }
        @media (hover: hover) { .rundo-start:hover { filter: brightness(1.06); } }
        .rundo-kaart { -webkit-tap-highlight-color: transparent; outline: none; }
        .rundo-kaart:focus-visible { outline: 3px solid ${K.tekst}; outline-offset: 2px; }
        .rundo-kaart-direct:active { transform: scale(0.985); }
        /* Balk: zachte ademhaling + een glansstreep die over de knop loopt. */
        .rundo-puls-balk { animation: rundoAdem 2.8s ease-in-out infinite; }
        .rundo-puls-balk::after { content: ""; position: absolute; top: 0; bottom: 0; left: -45%; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
          animation: rundoGlans 3.4s ease-in-out infinite; pointer-events: none; }
        @keyframes rundoAdem { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.12); } }
        @keyframes rundoGlans { 0% { left: -45%; } 60%, 100% { left: 110%; } }
        /* Pil: een ring die naar buiten uitdijt in de kleur van de modus. */
        .rundo-puls-pil.m-table { animation: rundoRingT 2.6s ease-out infinite; }
        .rundo-puls-pil.m-party { animation: rundoRingP 2.6s ease-out infinite; }
        @keyframes rundoRingT { 0% { box-shadow: 0 0 0 0 rgba(19,140,154,0.55); } 100% { box-shadow: 0 0 0 14px rgba(19,140,154,0); } }
        @keyframes rundoRingP { 0% { box-shadow: 0 0 0 0 rgba(245,179,1,0.6); } 100% { box-shadow: 0 0 0 14px rgba(245,179,1,0); } }
        @keyframes rundoIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .rundo-puls-balk, .rundo-puls-balk::after, .rundo-puls-pil { animation: none !important; } }
        /* Taalkeuze groter: de hele toggle (ook het tikvlak) schaalt mee. */
        .rundo-taal { flex-shrink: 0; display: flex; align-items: center; min-height: 48px; padding-left: 34px; }
        .rundo-taal > * { transform: scale(1.45); transform-origin: right center; }
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
    // Groeit mee met het scherm, maar nooit hoger dan 250 px: zonder groepenbalken
    // rekken de kaarten anders uit over een hoge gsm. De hoge flex-grow zorgt dat
    // de kaarten eerst groeien; pas daarna gaat de rest naar de lege ruimte.
    position: "relative", flex: "100 1 auto", minHeight: 190, maxHeight: 250, display: "flex", flexDirection: "column",
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
