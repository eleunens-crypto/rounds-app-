"use client"

// ─────────────────────────────────────────────────────────────────────────────
// RUNDO PARTY — TESTPAGINA v7
// - Betaling bevestigen -> rondjes-hub (overzicht) -> nieuw rondje / afrekenen
// - Bewerken (toewijzen + bekers) in het overzicht; app herberekent automatisch
// - Home-knop op elk scherm (geen reset); coin-prijzen zichtbaar/aanpasbaar
// Richtprijzen blijven ONZICHTBAAR bij bestellen. Volledig lokaal. app/party-test/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { QRCodeSVG } from "qrcode.react"
import { useLang, LanguageToggle } from "@/lib/i18n"

// Rundo-logo — exact hetzelfde symbool als bij Rundo Party (ingebed als afbeelding)
const RUNDO_LOGO_SRC = "data:image/png;base64,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"
function RundoLogo({ size = 40 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={RUNDO_LOGO_SRC} alt="Rundo" width={size} height={size} style={{ display: "block", objectFit: "contain", flexShrink: 0 }} />
}

// Klinkende glazen ("cheers") — getekend, kleurt mee met de ondertitel
function CheersIcon({ size = 18, color = "#4a3f1e" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <g stroke={color} strokeWidth="3" strokeLinecap="round">
        <line x1="32" y1="3" x2="32" y2="11" />
        <line x1="27.5" y1="6.5" x2="36.5" y2="6.5" />
      </g>
      <g transform="rotate(16 22 42)">
        <path d="M13 16 H31 L27 30 Q22 34 17 30 Z" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        <line x1="22" y1="31" x2="22" y2="52" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="14" y1="53" x2="30" y2="53" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="rotate(-16 42 42)">
        <path d="M33 16 H51 L47 30 Q42 34 37 30 Z" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        <line x1="42" y1="31" x2="42" y2="52" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="34" y1="53" x2="50" y2="53" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// Een persoon is een PLAATS in de groep. De admin zet het aantal, de plaatsen bestaan
// meteen, en gasten claimen er zelf een via de QR/link — net als in Rundo Table.
// Een vrije plaats heeft in de databank een lege naam; in de UI heet ze "Gast N",
// waardoor de bestaande isGuestDefault-logica gewoon blijft werken.
type Person = { id: string; name: string; seat: number; claimedBy?: string | null; selfJoined?: boolean; named?: boolean; settleWith?: string | null }

// Dit toestel. Bepaalt of je de admin bent en welke plaats van jou is.
function deviceId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("rundo_device_id")
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("rundo_device_id", id) }
  return id
}
// Uitnodigingscode zonder I/O/0/1 — die worden verkeerd overgetikt vanaf een scherm.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("")
type Cat = "Bier" | "BierAV" | "Frisdrank" | "Wijn" | "Cocktail" | "Mocktail" | "Longdrink" | "Shot" | "Warm" | "Eigen"
type Drink = { id: string; name: string; emoji: string; cat: Cat; price: number; cup: boolean; fav: boolean; coins: number; custom?: boolean; by?: string }

const CATS: Cat[] = ["Bier", "BierAV", "Frisdrank", "Wijn", "Cocktail", "Mocktail", "Longdrink", "Shot", "Warm", "Eigen"]
const CAT_LABEL: Record<Cat, string> = { Bier: "🍺 Bier", BierAV: "🌿 0,0%-bier", Frisdrank: "🥤 Fris", Wijn: "🍷 Wijn", Cocktail: "🍸 Cocktail", Mocktail: "🍹 Mocktail", Longdrink: "🥃 Longdrink", Shot: "🔥 Shot", Warm: "☕ Warm", Eigen: "⭐ Eigen" }
const CAT_EMOJI: Record<Cat, string> = { Bier: "🍺", BierAV: "🌿", Frisdrank: "🥤", Wijn: "🍷", Cocktail: "🍸", Mocktail: "🍹", Longdrink: "🥃", Shot: "🔥", Warm: "☕", Eigen: "⭐" }
const CUPCAT: Record<Cat, boolean> = { Bier: true, BierAV: true, Frisdrank: true, Wijn: true, Cocktail: true, Mocktail: true, Longdrink: false, Shot: false, Warm: false, Eigen: true }

const DATA: [Cat, string, number][] = [
  ["Bier", "Pintje", 3.2], ["Bier", "Duvel", 5], ["Bier", "Chimay Blauw", 5.5], ["Bier", "Cornet", 5], ["Bier", "Geuze", 5], ["Bier", "Hoegaarden Wit", 4], ["Bier", "Kriek", 4.5], ["Bier", "La Chouffe", 5], ["Bier", "Leffe Blond", 4.5], ["Bier", "Tripel Karmeliet", 5.5], ["Bier", "Vedett Extra Blond", 4], ["Bier", "Westmalle Tripel", 5],
  ["BierAV", "Jupiler 0.0", 3], ["BierAV", "Stella Artois 0.0", 3], ["BierAV", "Carlsberg 0.0", 3], ["BierAV", "Corona Cero", 3.5], ["BierAV", "Hoegaarden 0.0", 3.5], ["BierAV", "La Chouffe 0.0", 4], ["BierAV", "Leffe Blond 0.0", 3.5], ["BierAV", "Sportzot", 3.5], ["BierAV", "Cornet 0.0", 4], ["BierAV", "Vedett 0.0", 3.5], ["BierAV", "Cristal 0.0", 3], ["BierAV", "Maes 0.0", 3], ["BierAV", "Palm 0.0", 3.5], ["BierAV", "Kriek 0.0", 3.5], ["BierAV", "Duvel 0.0", 4],
  ["Frisdrank", "Coca-Cola", 3], ["Frisdrank", "Coca-Cola Zero", 3], ["Frisdrank", "Coca-Cola Light", 3], ["Frisdrank", "Fanta", 3], ["Frisdrank", "Sprite", 3], ["Frisdrank", "Ice Tea", 3], ["Frisdrank", "Red Bull", 4], ["Frisdrank", "Schweppes Tonic", 3.5], ["Frisdrank", "Appelsap", 3], ["Frisdrank", "Sinaasappelsap", 4], ["Frisdrank", "Water plat", 2.8], ["Frisdrank", "Water bruis", 2.8], ["Frisdrank", "Ice Tea Green", 3],
  ["Wijn", "Rode wijn", 5], ["Wijn", "Witte wijn", 5], ["Wijn", "Rosé", 5], ["Wijn", "Cava", 6.5], ["Wijn", "Prosecco", 6.5], ["Wijn", "Champagne", 11], ["Wijn", "Cabernet Sauvignon", 5.5], ["Wijn", "Chardonnay", 5.5], ["Wijn", "Merlot", 5.5], ["Wijn", "Pinot Noir", 5.5], ["Wijn", "Sauvignon Blanc", 5.5], ["Wijn", "Sangria", 5], ["Wijn", "Porto", 5],
  ["Cocktail", "Aperol Spritz", 10], ["Cocktail", "Gin Tonic", 11], ["Cocktail", "Mojito", 11.5], ["Cocktail", "Margarita", 11.5], ["Cocktail", "Cosmopolitan", 11.5], ["Cocktail", "Espresso Martini", 12.5], ["Cocktail", "Hugo Spritz", 10], ["Cocktail", "Moscow Mule", 11.5], ["Cocktail", "Negroni", 11.5], ["Cocktail", "Piña Colada", 11.5], ["Cocktail", "Pornstar Martini", 13], ["Cocktail", "Sex on the Beach", 10.5], ["Cocktail", "Caipirinha", 11.5],
  ["Mocktail", "Virgin Mojito", 7.5], ["Mocktail", "Virgin Gin Tonic", 7.5], ["Mocktail", "Hugo 0.0", 7.5], ["Mocktail", "Berry Mule", 7.5], ["Mocktail", "Gimber", 5.5], ["Mocktail", "Strawberry Daiquiri 0.0", 7.5], ["Mocktail", "Virgin Sunrise", 7], ["Mocktail", "Virgin Aperol Spritz", 7.5], ["Mocktail", "Virgin Moscow Mule", 7.5], ["Mocktail", "Virgin Colada", 7.5], ["Mocktail", "Shirley Temple", 6], ["Mocktail", "Ipanema", 6.5], ["Mocktail", "Crodino", 5.5], ["Mocktail", "Virgin Passion Spritz", 7.5],
  ["Longdrink", "Vodka Red Bull", 10], ["Longdrink", "Vodka Orange", 9], ["Longdrink", "Cuba Libre", 9], ["Longdrink", "Rum Cola", 9], ["Longdrink", "Whisky Cola", 9.5], ["Longdrink", "Malibu Cola", 9], ["Longdrink", "Malibu Ananas", 9], ["Longdrink", "Bacardi Lemon", 9], ["Longdrink", "Passoã Orange", 9], ["Longdrink", "Pisang Orange", 9], ["Longdrink", "Safari Orange", 9], ["Longdrink", "Jägermeister Red Bull", 10], ["Longdrink", "Bacardi Cola", 9], ["Longdrink", "Vodka Cassis", 9], ["Longdrink", "Vodka Sprite", 9], ["Longdrink", "Gin Cassis", 9.5], ["Longdrink", "Whisky Ginger Ale", 9.5],
  ["Shot", "Tequila", 3.5], ["Shot", "Jägermeister", 3.5], ["Shot", "Sambuca", 3.5], ["Shot", "Fireball", 3.5], ["Shot", "Limoncello", 3.5], ["Shot", "Sourz", 3.5], ["Shot", "Vodka shot", 3], ["Shot", "Rum shot", 3.5], ["Shot", "Apfelkorn", 3], ["Shot", "Baby Guinness", 4],
  ["Warm", "Koffie", 3], ["Warm", "Espresso", 2.8], ["Warm", "Cappuccino", 3.5], ["Warm", "Latte Macchiato", 4], ["Warm", "Flat White", 4], ["Warm", "Koffie verkeerd", 3.5], ["Warm", "Decafé koffie", 2.8], ["Warm", "Thee", 2.8], ["Warm", "Chai Latte", 4], ["Warm", "Warme chocolademelk", 4.2], ["Warm", "Irish Coffee", 8], ["Warm", "Hasseltse koffie", 8], ["Warm", "Americano", 3], ["Warm", "Verse muntthee", 4.5], ["Warm", "Glühwein", 4.5],
]
// De KORTE lijst: wat je meteen ziet op het bestelscherm, vóór je op "toon alles" tikt.
// Alles hierbuiten blijft gewoon bestaan in DATA en verschijnt zodra fullList aan staat.
const FAVS = new Set([
  // Bier
  "Pintje", "Duvel", "Kriek", "Cornet",
  // AV-bier
  "Jupiler 0.0", "Carlsberg 0.0", "Sportzot", "Cornet 0.0",
  // Frisdrank
  "Coca-Cola", "Coca-Cola Zero", "Coca-Cola Light", "Fanta", "Schweppes Tonic", "Water plat", "Water bruis",
  // Wijn
  "Witte wijn", "Rode wijn", "Rosé", "Cava", "Champagne",
  // Cocktail
  "Aperol Spritz", "Gin Tonic", "Moscow Mule", "Pornstar Martini",
  // Mocktail
  "Virgin Mojito", "Virgin Gin Tonic", "Virgin Aperol Spritz", "Virgin Moscow Mule", "Hugo 0.0", "Gimber",
  // Longdrink
  "Rum Cola", "Whisky Cola", "Vodka Orange", "Vodka Red Bull",
  // Shot
  "Jägermeister", "Tequila", "Limoncello",
  // Warm
  "Koffie", "Espresso", "Decafé koffie", "Latte Macchiato", "Thee", "Warme chocolademelk", "Irish Coffee",
])
// Vaste festival-coinprijzen (standaard) — bijstelbaar per 0,1 in de app.
const PILS = new Set(["Pintje", "Jupiler 0.0", "Stella Artois 0.0", "Carlsberg 0.0", "Corona Cero", "Hoegaarden 0.0", "Leffe Blond 0.0", "Sportzot", "Vedett 0.0", "Cristal 0.0", "Maes 0.0", "Palm 0.0"])
const COIN3 = new Set(["Champagne", "Irish Coffee", "Hasseltse koffie"])
const coinDefault = (cat: Cat, name: string): number => {
  if (name === "Red Bull" || name === "Glühwein") return 1.5
  if (COIN3.has(name)) return 3
  switch (cat) {
    case "Bier": return PILS.has(name) ? 1 : 2
    case "BierAV": return PILS.has(name) ? 1 : 2
    case "Frisdrank": return 1
    case "Wijn": return 2
    case "Cocktail": return 3
    case "Longdrink": return 3
    case "Mocktail": return 2
    case "Shot": return 1
    case "Warm": return 1
    case "Eigen": return 2
    default: return 1
  }
}
// STABIELE sleutel, afgeleid van de naam. Niet de index: die schuift op zodra je een drank
// tussenvoegt, en dan wijzen opgeslagen rondjes ineens naar het verkeerde drankje.
const drinkKey = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Zoeken zonder gedoe: "jagermeister" vindt Jägermeister, "pina" vindt Piña Colada,
// "coca cola" vindt Coca-Cola. Accenten, koppeltekens en hoofdletters doen er niet toe.
const normText = (t: string) =>
  (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// Elk getikt woord moet érgens in de naam voorkomen. Zo vindt "gin to" ook Gin Tonic,
// en "virgin mule" de Virgin Moscow Mule — zonder dat de volgorde moet kloppen.
const drinkMatches = (naam: string, zoek: string) => {
  const woorden = normText(zoek).split(" ").filter(Boolean)
  if (woorden.length === 0) return true
  const n = normText(naam)
  return woorden.every((w) => n.includes(w))
}

const DEMO_DRINKS: Drink[] = DATA.map(([cat, name, price]) => ({ id: drinkKey(name), name, emoji: CAT_EMOJI[cat], cat, price, cup: CUPCAT[cat], fav: FAVS.has(name), coins: coinDefault(cat, name) }))

type Assign = Record<string, Record<string, number>>
type Anon = Record<string, number>
// Een rondje leeft nu in de databank. id/seq/status komen daarvandaan; de rest is
// wat de app al kende. status: open = er wordt besteld, pending = besteld maar niet
// betaald, closed = betaald.
type Proposal = { active?: boolean; by?: string; answers?: Record<string, "same" | "different" | "skip"> }
type Round = { id: string; seq: number; status: "open" | "pending" | "closed"; orders: Assign; anon: Anon; payers: Record<string, number>; amount: number; potPart: number; gaveBack: Record<string, number>; members: string[]; startedBy: string | null; proposal: Proposal; headcount: number }

const euro = (v: number) => "€" + v.toFixed(2).replace(".", ",")

// ── Spraak (beta) ───────────────────────────────────────────────────────────
// "drie pils en twee cola" -> [{pils,3},{coca-cola,2}]. Bewust simpel: we zoeken
// getallen en drankennamen, de rest negeren we. Spraakherkenning maakt fouten, dus
// de gebruiker krijgt ALTIJD te zien wat we verstonden voor er iets in de mand belandt.
const TELWOORD: Record<string, number> = {
  een: 1, één: 1, "n": 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
}

// Andere namen die mensen voor een drankje gebruiken. De sleutel is de drinkKey (uit de
// naam afgeleid), de waarde is een lijst extra termen waarop de spraak ook mag matchen.
// Bewust GEEN heel korte, dubbelzinnige termen ("wit", "zero", "blond") — die zouden
// verkeerd kunnen vallen tussen meerdere drankjes.
const SPRAAK_SYNONIEMEN: Record<string, string[]> = {
  "pintje": ["pint", "pils"],
  "leffe-blond": ["leffe"],
  "hoegaarden-wit": ["hoegaarden", "witbier", "wit bier"],
  "la-chouffe": ["chouffe"],
  "tripel-karmeliet": ["karmeliet", "tripel"],
  "coca-cola": ["cola", "coca"],
  "coca-cola-zero": ["cola zero", "coca zero"],
  "coca-cola-light": ["cola light"],
  "ice-tea": ["icetea", "ijsthee"],
  "water-plat": ["plat water", "water", "spa plat"],
  "water-bruis": ["bruiswater", "spa bruis", "bruis water"],
  "rode-wijn": ["rood", "rooie", "rooiewijn"],
  "witte-wijn": ["witte wijn"],
  "rose": ["rosee"],
  "cappuccino": ["capucino"],
}

function parseSpraak(tekst: string, lijst: { id: string; name: string }[]): { id: string; name: string; qty: number }[] {
  const woorden = normText(tekst).split(" ").filter(Boolean)
  const treffers: { id: string; name: string; qty: number }[] = []

  // Elk drankje krijgt zijn genormaliseerde woorden PLUS eventuele synoniemen (andere
  // namen die mensen gebruiken: "pint"/"pintje" voor Pintje, "coca" voor Coca-Cola).
  // We matchen FLEXIBEL: de gesproken woorden hoeven niet exact of volledig te zijn.
  // Per drankje bewaren we meerdere woordgroepen; matcht er één, dan is het raak.
  const namen = lijst.map((d) => {
    const eigen = normText(d.name).split(" ").filter(Boolean)
    const syn = (SPRAAK_SYNONIEMEN[d.id] || []).map((z) => normText(z).split(" ").filter(Boolean))
    const groepen = [eigen, ...syn].map((delen) => ({ delen, kern: delen.filter((w) => w.length >= 3) }))
    return { id: d.id, name: d.name, groepen }
  })

  // Stopwoorden die geen drankje aanduiden (merk/vulwoorden die vaak wegvallen).
  const negeer = new Set(["een", "de", "het", "en", "met", "van", "glas", "keer", "x"])

  let i = 0
  while (i < woorden.length) {
    let aantal = 1
    const w = woorden[i]
    if (TELWOORD[w] !== undefined) { aantal = TELWOORD[w]; i++ }
    else if (/^\d+$/.test(w)) { aantal = Math.min(20, parseInt(w, 10)); i++ }
    if (i >= woorden.length) break
    if (negeer.has(woorden[i])) { i++; continue }

    // Neem een venster van maximaal de volgende 4 woorden en zoek het drankje dat er
    // het best bij past: zoveel mogelijk kernwoorden van (een naam OF synoniem) die in
    // het venster voorkomen. Langere namen die volledig passen winnen van losse matches.
    const venster = woorden.slice(i, i + 4)
    let best: { d: typeof namen[number]; score: number; kernlen: number; verbruikt: number } | null = null
    for (const d of namen) {
      for (const g of d.groepen) {
        const kern = g.kern.length ? g.kern : g.delen
        if (kern.length === 0) continue
        const aanwezig = kern.filter((deel) => venster.some((vw) => vw === deel || (vw.length >= 4 && deel.length >= 4 && (vw.startsWith(deel) || deel.startsWith(vw)))))
        if (aanwezig.length === 0) continue
        const score = aanwezig.length / kern.length
        if (score < 0.5) continue
        const beter = !best || score > best.score || (score === best.score && kern.length > best.kernlen)
        if (beter) best = { d, score, kernlen: kern.length, verbruikt: Math.min(venster.length, Math.max(1, aanwezig.length)) }
      }
    }

    if (best) {
      const bestaand = treffers.find((t) => t.id === best!.d.id)
      if (bestaand) bestaand.qty += aantal
      else treffers.push({ id: best.d.id, name: best.d.name, qty: aantal })
      i += best.verbruikt
    } else {
      i++
    }
  }
  return treffers
}

// ── Woordenlijst ────────────────────────────────────────────────────────────
// Eerst alles wat een GAST te zien krijgt: hij scant een QR en is misschien
// Franstalig. De adminschermen (die jij zelf bedient) volgen daarna.
const T = {
  nl: {
    invitedFor: "Je bent uitgenodigd voor",
    whoAreYou: "Wie ben jij?",
    tapYourName: "Tik op je naam.",
    notThere: "Sta je er niet bij? Neem een lege plaats.",
    fillNameSeat: "Vul je naam in en neem een plaats.",
    yourName: "Je naam",
    seat: (n: number) => `Plaats ${n}`,
    allSeatsTaken: "Alle plaatsen zijn ingenomen — maar je kan er zelf een bijzetten.",
    joinAddSeat: "Erbij komen",
    someoneJoined: (n: string) => `${n} is erbij gekomen`,
    notRight: "klopt niet",
    alreadyJoined: "Al aangemeld",
    fillNameFirst: "Vul eerst je naam in.",
    seatTaken: "Die plaats is net door iemand anders genomen. Kies een andere.",
    badCode: "Deze uitnodigingscode bestaat niet (meer).",
    loading: "Even laden…",

    youAre: "Jij bent",
    notMe: "niet ik",
    notMeConfirm: (n: string) => `Ben jij niet ${n}? Dan geef je deze plaats vrij en kies je opnieuw.`,
    releaseSeat: "Plaats vrijgeven",
    tabOrder: "🍺 Bestellen",
    tabMe: "🧾 Mijn stand",
    tabGroup: "👥 Groep",
    groupTitle: "👥 In deze groep",
    peopleN: (n: number) => `${n} ${n === 1 ? "persoon" : "personen"}`,
    joinedOfTotal: (a: number, b: number) => `${a} van ${b} aangemeld`,
    hostMark: "👑 organisator",
    startNotAll: (n: number, t: number) => `${n} van ${t} nog niet aangemeld. Toch beginnen?`,
    startWait: "Nog even wachten",
    startAnyway: "Toch beginnen",
    scannedSelf: "📱 zelf aangemeld",
    youMark: "⭐ jij",
    notScannedYet: "nog niet aangemeld",
    inviteMore: "Nodig meer mensen uit — laat ze de code scannen.",
    roundWhatYouWant: (n: number) => `🛒 Ronde ${n} — wat jij wil`,
    noRoundYet: "🛒 Nog geen rondje bezig",
    tapBelow: "Tik hieronder aan wat je wil. Wie naar de toog gaat, ziet het meteen op zijn scherm.",
    searchDrink: "Zoek een drankje…",
    shortList: "⚡ Korte lijst",
    fullListBtn: "📖 Volledige lijst",
    nothingFound: "Niets gevonden — probeer een ander woord.",
    barFootnote1: "Wie naar de toog gaat, sluit het rondje af en vult het bedrag in.",
    barFootnote2: "Jouw deel wordt op het einde eerlijk verrekend.",

    myTab: "🧾 Mijn stand",
    noRoundClosed: "Er is nog geen rondje afgesloten.",
    whatYouDrank: "Wat jij dronk",
    yourShare: "(jouw deel)",
    whatYouPaid: "Wat jij betaalde",
    inclPot: "(incl. inleg pot)",
    youAreEven: "Je staat gelijk",
    youGetBack: "Je krijgt terug",
    youStillPay: "Je betaalt nog",
    settlesWith: (n: string) => `🔗 Jij rekent samen af met ${n} — hierboven staat enkel jouw eigen deel.`,
    directionOnly: "Dit is een richting, geen eindafrekening. Zolang er nog rondjes bijkomen, verandert het.",
    howYouSettle: "🔁 Zo verreken jij",
    roundsTitle: "📜 Rondjes",
    roundN: (n: number) => `Ronde ${n}`,
    nothingThisRound: "jij had niets in dit rondje",

    addOwnDrink: "⭐ Eigen drankje",
    newDrinkTile: "Eigen drankje?",

    // ── start & setup
    tagline: "Rondjes en splitten zonder gedoe!",
    autoName: () => { const d = new Date(); const m = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"]; return `Rondje ${d.getDate()} ${m[d.getMonth()]}` },
    startNow: "Start",
    groupNameHint: "NAAM VAN JE GROEP",
    tapToChange: "tik om te wijzigen",
    peopleHeader: (n: number) => `👥 ${n} ${n === 1 ? "persoon" : "personen"}`,
    peopleIntro: (n: number) => `Jij bent erbij. De ${n} ${n === 1 ? "andere scant" : "anderen scannen"} de QR en vult zelf zijn naam in.`,
    waitingSeats: (names: string) => `${names} — wachten op scan…`,
    noPhoneAdd: "Iemand zonder telefoon?",
    addSelf: "+ zelf toevoegen",
    yourSeat: "Jij",
    groupNameEdit: "Naam van deze groep",
    groupNamePh: "Typ je groepsnaam",
    starting: "Bezig…",
    savedGroups: "Opgeslagen groepen",
    asGuest: "als gast",
    groupsOpen: "Open",
    groupsClosed: "Afgesloten",
    savedLater: "later beschikbaar",
    savedNote: "Groepen bewaren tussen sessies komt in de volledige app (met database).",
    nameGroupFirst: "Geef je groep eerst een naam.",
    dupGroupName: (n: string) => `"${n}" bestaat al en staat nog open. Geef deze groep een andere naam, of sluit de vorige eerst af.`,
    delGroupConfirm: (n: string) => `"${n}" verwijderen? Dit kan niet ongedaan worden — alle rondjes en gegevens van deze groep gaan weg.`,
    delGroupYes: "Verwijderen",
    cancel: "Annuleren",
    createFailed: "Groep aanmaken mislukt. Probeer opnieuw.",

    peopleCount: "👥 Aantal personen",
    namesOptional: "Namen zijn optioneel — pas ze aan wanneer je wil.",
    namesForPot: "Voeg personen toe als je een pot wil leggen — namen zijn optioneel.",
    peopleTitle: "Personen",
    addPersonFirst: "Voeg eerst minstens één persoon toe.",
    whichAreYou: "Welke ben jij?",
    assignAnyone: "Je kan aan iedereen toewijzen — ook wie zelf scande.",
    pickYourName: "Tik je naam aan — de rest duid je zelf aan tijdens het bestellen.",
    freeUp: "vrijgeven",
    personHasDrinks: (n: string) => `${n} heeft al drankjes in een rondje en kan niet verwijderd worden. Verwijder eerst die drankjes.`,
    thisPerson: "Deze persoon",

    // ── delen
    letGuestsScan: "📲 Laat je gasten scannen",
    freeSeats: (n: number) => `Nog ${n} vrije ${n === 1 ? "plaats" : "plaatsen"}. Wie scant, kiest er een en tikt zelf zijn drankjes aan.`,
    allTakenAdmin: "Alle plaatsen zijn ingenomen. Zet er een bij als er nog iemand aansluit.",
    shareLink: "Link delen",
    copyLink: "Kopieer link",
    linkCopied: "Link gekopieerd.",
    joinInvite: (g: string, l: string) => `Doe mee met ${g} op Rundo Party: ${l}`,

    // ── startvragen
    beforeWeStart: "Kies je aanpak",
    settingsLater: "Pot, bekers of coins nodig? Die zet je aan via ⚙️ Groep — hoeft nu niet.",
    potStartTitle: "🧪 Samen een pot?",
    potHowMany: "Met hoeveel zijn jullie?",
    perManShort: "p.p.",
    potTotalIn: "Totaal in de pot:",
    potInShort: "ingelegd",
    potStillIn: "nog in pot",
    alreadyInPot: "Al in de pot",
    nowAdding: "Nu erbij",
    newPotTotal: "Nieuw totaal",
    firstDeposit: "1e inleg",
    addToPot: "Toevoegen aan de pot",
    potFillAmount: "Vul eerst een bedrag in.",
    potAdded: (v: string) => `\u2713 ${v} toegevoegd aan de pot`,
    setPotTo: (v: string) => `Pot op ${v} zetten`,
    potPerPerson: (v: string) => `≈ ${v} per persoon`,
    potStartWhy: "Iedereen legt vooraf iets in. Rondjes gaan er dan uit — niemand hoeft telkens te betalen.",
    potStartIn: (b: string) => `In de pot: ${b}`,
    potStartAdd: "+ Inleggen",
    potStartMore: "Bijleggen",
    unassignedHub: (n: number) => `🔴 ${n} drankje${n === 1 ? "" : "s"} nog niet toegewezen`,
    unassignedHubWhy: "Zonder naam worden ze gelijk verdeeld — niet eerlijk. Wijs ze toe zodat elk betaalt wat hij dronk.",
    unassignedHubBtn: "Toewijzen",
    assignAllBtn: "Alles meteen toewijzen",
    assignFirstNote: "Wijs eerst alle drankjes toe aan iemand. Daarna kan je verder.",
    assignPerRoundBtn: "Toewijzen per rondje",
    assignTitle: "Toewijzen",
    roundXofY: (a: number, b: number) => `Rondje ${a} van ${b}`,
    assignAllHint: "je loopt ze allemaal af",
    assignAllSub: (n: number) => `Alle ${n} rondjes in \u00e9\u00e9n keer`,
    roundDoneNext: "Dit rondje is rond",
    roundDoneShort: "Rondje toegewezen",
    nextRoundAssign: (n: number) => `Volgende: rondje ${n} \u2192`,
    allAssignedDone: "Klaar \u2014 alles toegewezen",
    quickStart: "Starten",
    continueRound: (n: number) => `Ga verder met rondje ${n}`,

    // ── instellingen
    groupSettings: "⚙️ Groepsinstellingen",
    cupsTitle: "♻️ Herbruikbare bekers",
    cupsInfo: "Voor events met waarborg per beker die je terugkrijgt bij inleveren. Zet aan om de borg mee te verrekenen.",
    depositPerCup: "Waarborg/beker",
    coinsTitle: "🎟️ Coins",
    coinsInfo: "Betaal je met coins i.p.v. euro's? Stel de coin-waarde en prijzen in; de app verdeelt eerlijk.",
    coinPrices: "🎟️ coin-prijzen per drankje",
    coinPricesInfo: "Standaard festival-coins per drankje. Pas aan met − / + (stapjes van 0,1).",
    potTitle: "🫙 Pot",
    potHowManyQ: "Met hoeveel personen leggen jullie in?",
    potHowManySub: "Nodig om het bedrag per persoon te kunnen berekenen.",
    continueWord: "Verder",
    fillCoinValue: "Vul de coin-waarde in (1 coin = €…) — of zet coins op 'uit'.",
    fillDeposit: "Vul het waarborgbedrag per beker in — of zet bekers op 'uit'.",

    // ── bestellen
    inThisRound: "🛒 In dit rondje",
    someoneCanGo: "👉 Iemand mag gaan halen!",
    noFavsHere: "Geen favorieten hier.",
    showAll: "📖 toon alles",
    assign: "Toewijzen",
    assignHint: "{L.assignHint}",
    assigned: "✓ toegewezen",
    eachOne: "👥 elk 1",
    eachOneConfirm: (n: string, meer: boolean) => `${n} ${meer ? "hebben" : "heeft"} er nu al 2 of meer. Met "elk 1" krijgt iedereen er precies één — ${n} ${meer ? "gaan" : "gaat"} dus terug naar 1.`,
    yesEachOne: "Ja, iedereen op 1",
    redistribute: 'Herverdelen: − zet een drankje terug op "onbekend", tik dan een andere naam.',
    closeRound: "✓ Rondje afsluiten",
    cancelRound: "✕ Rondje annuleren",
    cancelRoundConfirm: (n: number) => `Rondje ${n} annuleren? Alle gekozen drankjes van dit rondje gaan verloren. Dit kan niet ongedaan gemaakt worden.`,
    yesCancel: "Ja, annuleren",
    backFinish: "← Terug, rondje afmaken",
    cups: "🫙 Bekers",
    cupsNotSet: "Bekers nog niet aangeduid.",
    tapToArrange: "Tik hier om te regelen →",
    tapToAssign: "Tik hier om toe te wijzen",
    nobodyGaveBack: "🚫 niemand gaf een beker terug",
    howMuchEach: "Hoeveel gaf elk",
    gaveBack: "gaf terug",
    ready: "Klaar",

    // ── betalen
    exactAmount: "💰 Exact bedrag betaald voor dit rondje?",
    amountAndPayer: "bedrag & betaler",
    whoPaid: "Kies wie betaalde.",
    multiplePossible: "(meerdere mogelijk)",
    fillAmountFirst: "Vul eerst het betaalde bedrag in — daarna kies je wie betaalde.",
    fillPerPayer: "Vul een bedrag in per betaler.",
    confirmPaymentFirst: "Bevestig eerst de betaling.",
    thePot: "🫙 de pot",
    fromPot: "uit de pot",
    fromCard: "van de drankkaart",
    notPaidYet: "nog niet betaald",
    paidBy: "Betaald door",
    roundingNote: "afrondingscent wordt in de Fair Split verrekend",

    // ── pot
    potMoney: "🫙 Pot (geld)",
    drinkCard: "💳 Drankkaart",
    addPotContrib: "➕ Inleg pot toevoegen",
    addMoreToPot: "\u2795 Nog extra inleggen",
    nthDeposit: (n: number) => `${n}e inleg`,
    resetContrib: "↺ reset inleg",
    everyone: "👥 verdeel over iedereen",
    ownAmount: "of eigen bedrag:",
    cardValue: "Kaartwaarde",
    whoBoughtCard: "Wie kocht de kaart? (tik aan — bedrag verschijnt vanzelf)",
    addContrib: (b: string) => `✓ Inleg toevoegen (${b})`,
    removeContrib: "✓ Inleg verwijderen (leeg)",
    edit: "✏️ wijzig",
    remove: "✕ verwijder",
    beingEdited: "✏️ wordt bewerkt ↓",
    inPot: "in pot gelegd",
    removeContribConfirm: (l: string) => `De ${l} verwijderen uit de pot? Dit kan niet ongedaan gemaakt worden.`,
    potEmpty: (kaart: boolean) => `De ${kaart ? "drankkaart" : "pot"} is leeg — leg eerst bij.`,
    potTooLow: (kaart: boolean, max: string) => `De ${kaart ? "drankkaart" : "pot"} heeft maar ${max} — verlaag het bedrag of leg bij.`,
    potNothingIn: (kaart: boolean) => `Je koos voor een ${kaart ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch verder gaan?`,
    anywayWithout: (kaart: boolean) => `Toch verder zonder ${kaart ? "drankkaart" : "pot"}`,

    // ── overzicht
    roundsOverview: "📋 Rondjesoverzicht",
    overview: "📋 Overzicht",
    newRound: "➕ Nieuw rondje",
    repeatRound: "🔁 Zelfde rondje opnieuw (aanpasbaar)",
    askGroupRepeat: "🗳️ Vraag de groep: weer hetzelfde?",
    proposalTitle: "🗳️ Weer hetzelfde rondje?",
    proposalWaiting: "Iedereen antwoordt op zijn scherm. Jij sluit af wanneer je wil.",
    ansSame: "✅ hetzelfde",
    ansDiff: "🔄 iets anders",
    ansWaiting: "⏳ nog niet",
    ansSkip: "✋ slaat over",
    gProposalTitle: "🗳️ Weer hetzelfde rondje?",
    gProposalSame: "✅ Ja, hetzelfde voor mij",
    gProposalDiff: "🔄 Iets anders kiezen",
    gProposalSkip: "✋ Voor mij niks deze ronde",
    gProposalDone: "Je keuze staat genoteerd.",
    gProposalYourLast: "Vorige ronde had je:",
    closeProposalBtn: (n: number) => `Afsluiten · ${n} ${n === 1 ? "doet" : "doen"} mee`,
    noOrderFor: (names: string) => `Geen bestellingen voor ${names}`,
    proposalNobody: "Nog niemand antwoordde. Toch afsluiten?",
    editOrderBtn: "✏️ Bestelling wijzigen",
    noRoundsDone: "Nog geen afgeronde rondjes",
    noRoundsHint: "Zodra een rondje bevestigd én betaald is, verschijnt het hier — dan kan je het nog aanpassen.",
    startFirstRoundBtn: "Start 1e rondje",
    toFirstRound: "Naar 1e rondje",
    noRoundsHintQuick: "Noteer wat er besteld wordt. Je afgeronde rondjes verschijnen hier.",
    roundBusy: (n: number) => `Je bent bezig met rondje ${n}`,
    tapRoundToEdit: "Tik een ronde open om aan te passen.",
    settleBtn: "🧾 Afrekenen",
    nothingToSettle: "Er zijn nog geen afgeronde rondjes om af te rekenen.",
    roundUnfinished: (n: number) => `Rondje ${n} is nog bezig — bevestig en betaal het eerst voor je afrekent.`,
    roundUnpaid: (n: number) => `Ronde ${n} is nog niet betaald. Rond die betaling eerst af.`,
    leaveAnyway: "Toch verlaten — bestelling kwijt",
    unfinishedWarn: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.",
    nothingToRepeat: "Er is nog geen rondje om te herhalen.",

    // ── afrekenen
    finalBalance: "🧾 Eindbalans",
    totalOrdered: "💰 Totaal besteld",
    fairSplit: "⚖️ Fair Split",
    equalSplit: "iedereen evenveel",
    equalSplitWarn: "⚠️ Dit is een gelijke verdeling, geen Fair Split.",
    fairSplitInfo: "Gelijke verdeling = totaal ÷ aantal personen. Fair Split is eerlijker: wie weinig of niks dronk, betaalt niet mee voor wie veel dronk.",
    unassignedWarn: "Wijs de resterende drankjes toe, dan verdeelt de app eerlijk op wat elk verteerde.",
    useFairSplit: "Toewijzen en Fair Split gebruiken",
    equalAnyway: "Toch gelijk verdelen",
    howYouAllSettle: "🔁 Zo verrekenen jullie",
    fewestTransfers: "Minste overschrijvingen om quitte te staan:",
    allEven: "✓ Alles staat gelijk.",
    total: "Totaal",
    perPerson: "per persoon",
    drank: "dronk",
    settleTogether: "👥 Rekent er iemand samen af?",
    settleTogetherInfo: "Voor koppels, huisgenoten, wie samen naar huis rijdt. Iedereen houdt zijn eigen drankjes — enkel het eindbedrag wordt samengeteld.",
    tapWhoWith: (n: string) => `Tik nu op wie samen met ${n} afrekent.`,
    separateAgain: "Weer apart zetten:",
    depositAdvanced: "waarborg (voorgeschoten)",
    cardLoss: "verlies drankkaart (gedeeld)",

    // ── eigen drankje
    ownDrinkTitle: "⭐ Eigen drankje",
    ownDrinkIntro: "Staat er iets niet in de lijst? Voeg het toe voor dit feest. Iedereen in de groep ziet het meteen.",
    nameLabel: "Naam",
    namePh: "bv. Trappist van Jos",
    categoryLabel: "Categorie",
    priceLabel: "Richtprijs",
    priceHint: "Nodig om de rekening achteraf eerlijk te verdelen. Een schatting volstaat.",
    coinsAuto: "{L.coinsAuto}",
    addBtn: "Toevoegen",
    remaining: (n: number, max: number) => `Nog ${n} van je ${max} eigen drankjes over`,
    addedByYou: "Door jou toegevoegd",
    removeHint: "Verwijder wat je niet meer nodig hebt. Al besteld in een rondje? Dan blijft het staan.",
    nameYourDrink: "Geef je drankje een naam.",
    needPrice: "Vul een richtprijs in — anders kan Fair Split dit drankje niet eerlijk verdelen.",
    needAmountOrCancel: "Uit de pot betalen kan niet zonder bedrag. Vul een bedrag in, of kies Zelf betaald.",
    alreadyExists: (n: string) => `"${n}" staat al in de lijst.`,
    maxPerPerson: (n: number) => `Je kan maximaal ${n} eigen drankjes toevoegen.`,
    maxPerGroup: (n: number) => `De groep zit aan het maximum van ${n} eigen drankjes.`,
    drinkAdded: (n: string) => `⭐ ${n} toegevoegd.`,
    drinkInUse: (n: string) => `${n} is al besteld en kan niet meer verwijderd worden.`,

    confirmTitle: "Even bevestigen",
    imGoing: "🍻 Ik start een rondje",
    walkTable: "👥 Rondje opnemen",
    walkIntro: "Ga de tafel rond. Tik per persoon aan wat die wil.",
    walkDone: "✓ Klaar",
    walkFor: (n: string) => `Wat wil ${n}?`,
    whoGoes: "Klaar voor een rondje?",
    xIsGoing: (n: string) => `🍻 ${n} haalt dit rondje`,
    youAreGoing: "🍻 Jij haalt dit rondje",
    iGoInstead: "ik neem het over",
    notMeRunner: "geef door",
    claimSeatFirst: "Neem eerst een plaats voor je een rondje start.",
    modeTitle: "Samen bestellen + Fair Split",
    modeQuick: "Snelle groepsbestelling",
    modeFairInfo: "Groepsbestellingen, pot leggen en delen via QR. Ieder betaalt zijn deel > betaal niet mee voor wat je niet dronk!",
    modeQuickInfo: "Hou gewoon bij wat er besteld wordt en leg eventueel een pot, verdelen kan later nog.",
    groupNamePlaceholder: "Bv. De Bubbelkes",
    modeQuickSub: "Snel 1 of meerdere rondjes noteren!",
    howItWorks: "zo werkt dat",
    orWord: "of",
    modeFairSub: "Scan QR, bestel samen & eerlijk afrekenen",
    modeFairLine: "Eerlijk betalen volgens wat je dronk",
    modeSwitchLater: "Je kan later nog wisselen — je rondjes blijven bewaard.",
    chooseHow: "Kies hoe jullie bestellen",
    howManyPeople: "Met hoeveel zijn jullie?",
    people: "pers.",
    adjust: "aanpassen",
    nameRequired: "Geef eerst je groep een naam.",
    peopleRequired: "Kies eerst met hoeveel personen jullie zijn.",
    headcountForward: "Dit geldt vanaf het volgende rondje. Eerdere rondjes houden hun aantal — corrigeer die desnoods in het rondjesoverzicht.",
    headcountNotRetro: "Dit verandert de bedragen hieronder niet: elk rondje houdt het aantal dat toen gold. Wil je een eerder rondje corrigeren, doe dat in het rondjesoverzicht.",
    chosen: "GEKOZEN",
    tapToChoose: "tik om te kiezen",
    exampleTag: "voorbeeld",
    switchModeLink: "Van aanpak wisselen",
    switchToFair: "Naar Fair Split modus",
    switchToQuick: "Naar snelle rondjes",
    switchModeWarn: "Van aanpak wisselen? Je begint helemaal opnieuw — wat je tot nu toe noteerde, verdwijnt.\n\nTip: kies de volgende keer meteen de juiste aanpak bij de start, dan hoef je niets over te doen.",
    switchModeYes: "Wisselen en opnieuw",
    barList: "📋 Bestelling",
    tapToRename: "tik om de naam te wijzigen",
    removeWord: "Weghalen",
    barHandOut: "Uitdelen",
    settleNow: "🧾 Toch afrekenen?",
    settleNowWhy: "We hielden alles bij. Eén tik en je weet wie wat schuldig is.",
    settleNowBtn: "Ja, verdeel het eerlijk",
    costTitle: "Wat kostte het?",
    costModeTotal: "totaal",
    costModePerRound: "per rondje",
    costWholeNight: "Hele avond",
    costRoundN: (n: number) => `Rondje ${n}`,
    costTotalLabel: "Totaal",
    roundCostOptional: "Hoeveel betaald voor dit rondje?",
    roundCostFor: (n: number) => `Hoeveel betaald voor rondje ${n}?`,
    withHowManyQ: "Met hoeveel personen was dit rondje?",
    orderedLabel: "Besteld",
    thisRoundLabel: "Dit rondje",
    paidLabel: "Betaald",
    adjustWord: "Aanpassen",
    notSavedYet: "niet opgeslagen",
    saveWord: "Opslaan",
    potTopUp: "Pot bijvullen",
    emptyWord: "leeg",
    potEmptyFillFirst: "De pot is leeg — vul eerst bij om hieruit te betalen.",
    editRoundHead: (n: number) => `Rondje ${n} aanpassen`,
    paidWithQ: "Waarmee betaald?",
    paidNote: (v: string) => `Betaald ${v}`,
    noAmountNote: "Geen bedrag ingevuld",
    noPotUsed: "geen pot gebruikt",
    paidFromPot: (v: string) => `${v} uit de pot`,
    skipCostWarn: "Je vulde al iets in bij dit rondje. Toch overslaan zonder het op te slaan?",
    skipCostYes: "Ja, overslaan",
    finishRoundFirst: "Rond eerst dit rondje af — vul in wat het kostte of tik Overslaan.",
    payFromPotQ: "Uit de pot betalen?",
    paidSelf: "Zelf betaald",
    paidPot: "Uit de pot",
    potEmptyNote: "De pot is nog leeg — vul eerst iets in.",
    potNotEnough: (v: string) => `Pot heeft maar ${v} — de rest reken je zelf af.`,
    potPayLeft: (bedrag: string, over: string) => `${bedrag} uit de pot \u2192 ${over} over na dit rondje`,
    potShortTitle: "Niet genoeg in de pot",
    potShortSimple: (inPot: string, kost: string) => `Nog ${inPot} in de pot, dit rondje kost ${kost}.`,
    potChoiceTopUp: "\ud83e\uded9 Toevoegen aan de pot",
    potChoicePaySelf: "\ud83d\udcb6 Alles zelf betalen",
    potWord: "pot",
    potHasLeft: (v: string) => `nog ${v} in pot`,
    maxAmount: (v: string) => `max ${v}`,
    restSelf: "Rest zelf:",
    potEmptyLabel: "Pot is leeg",
    potFillBtn: "+ Pot bijvullen",
    skipRound: "Overslaan",
    skipPayment: "Betaling overslaan",
    tapToConfirm: "tik ✓ om te bevestigen",
    noAmountsYet: "Je vulde nog geen bedragen in. Zonder bedragen valt er niets te verdelen — vul eerst in wat de rondjes kostten.",
    fillAmountsNow: "Bedragen invullen",
    later: "Later",
    back: "Terug",
    quickSettleTitle: "🧾 Afrekenen",
    quickTotalLabel: "Totaal van alle rondjes",
    andWord: "en",
    roundsNoAmountNamed: (lijst: string) => `Rondje ${lijst} zonder bedrag`,
    roundsNoAmountCount: (n: number) => `${n} rondjes zonder bedrag`,
    roundsNoAmountWhy: "Die tellen niet mee in de verdeling hieronder. Vul ze aan of laat ze zo.",
    fillAmountsBtn: "Bedragen aanvullen ›",
    noAmountBadge: "zonder bedrag",
    addAmountBtn: "€ Bedrag toevoegen",
    splitOverGroup: "Verdelen",
    splitEqually: "Gelijk verdelen",
    fairSplitExplain: "Bij Fair Split hangt elk drankje aan een naam. Wie meer dronk, betaalt meer \u2014 en wie niets nam, betaalt niets.\n\nJe wijst per rondje toe wie wat nam. Let op: overstappen wist wat je tot nu toe noteerde.",
    payAllSelf: "Alles zelf",
    treatHint: "Rondje trakteren? Tik hieronder aan (telt dan niet mee in de verdeling)",
    roundWord: "Rondje",
    drinksCount: (n: number) => `${n} drankje${n === 1 ? "" : "s"}`,
    confirmRoundTitle: (n: number) => `\u2705 Rondje ${n} bevestigen`,
    confirmRoundBtn: (n: number) => `\u2705 Bevestig rondje (${n} drankje${n === 1 ? "" : "s"})`,
    roundConfirmed: (nr: number, n: number) => `Rondje ${nr} bevestigd \u2014 ${n} drankje${n === 1 ? "" : "s"}`,
    notAssignedYet: (n: number) => `${n} drankje${n === 1 ? "" : "s"} nog niet toegewezen.`,
    yourTreat: "jouw traktatie",
    eachPaysNote: "Ieder betaalt",
    headcountVaried: "Niet elk rondje had hetzelfde aantal personen:",
    splitOver: "Verdelen over",
    showPerRound: "Liever exact per rondje verdelen",
    treatShort: "Rondje trakteren?",
    backToOneAmount: "\u2190 Terug naar \u00e9\u00e9n bedrag",
    perRoundTitle: "Per rondje verdeeld",
    notEveryoneAllRounds: "Niet iedereen deed elk rondje mee, dus het verschilt per persoon:",
    fromStart: "van bij het begin",
    fromRound: (n: number) => `vanaf rondje ${n}`,
    untilRound: (n: number) => `tot en met rondje ${n}`,
    roundsRange: (a: number, b: number) => `rondje ${a} t/m ${b}`,
    plusTreat: (v: string) => `Jij trakteert ${v} extra`,
    payAllNote: "De hele rekening komt op jou:",
    quickHeadsLabel: "Met hoeveel waren jullie?",
    quickPerHead: "Ieders deel",
    quickPerHeadNote: (n: number) => `gelijk verdeeld over ${n} ${n === 1 ? "persoon" : "personen"}`,
    notFairSplitYet: "Dit is een gelijke verdeling",
    notFairSplitWhy: "Iedereen betaalt evenveel, ook wie minder dronk. Wil je dat wie meer dronk ook meer betaalt? Schakel over naar Fair Split.",
    switchToFairBtn: "⚖️ Overschakelen naar Fair Split",
    fairSetupTitle: "⚖️ Wie was erbij?",
    fairSetupIntro: "Voeg de mensen toe. Tik een naam of laat 'm staan (Gast N). Daarna wijs je toe wie wat dronk.",
    fairAddPerson: "+ Persoon toevoegen",
    fairSetupDone: "Klaar — nu toewijzen",
    roundsOverviewTitle: "🧾 Rondjesoverzicht",
    peopleInRound: "personen in dit rondje",
    showDetails: "Toon details",
    hideDetails: "Verberg details",
    newRoundBtn: "Nieuw rondje",
    editRoundBtn: "Aanpassen",
    editOrderFull: "Bestelling aanpassen",
    roundsOverviewBtn: "Rondjesoverzicht",
    noRoundsYet: "Nog geen afgeronde bestellingen. Bevestig eerst een rondje.",
    roundsTab: "Rondjes",
    roundSummary: (n: number, items: number) => `Rondje ${n} · ${items} drankje${items === 1 ? "" : "s"}`,
    sameRoundAgainQ: "Zelfde rondje opnieuw (aanpasbaar) of een nieuw rondje?",
    sameRoundYes: "🔁 Zelfde opnieuw",
    newRoundFresh: "✨ Nieuw rondje",
    estimate: "schatting op richtprijzen",
    estimateWhy: "Niemand vulde bedragen in, dus rekenen we met de richtprijzen uit de lijst. Bij benadering, maar eerlijk.",
    voiceBtn: "🎤 Inspreken",
    voiceBeta: "beta",
    voiceListening: "🎤 Luisteren…",
    voiceSay: "Zeg bijvoorbeeld \"2 cola zero\". Werkt het best per drankje apart.",
    voiceHeard: "Verstaan",
    voiceNothing: "Niets herkend. Probeer opnieuw, of tik het gewoon aan.",
    voiceAdd: "Toevoegen aan rondje",
    voiceRetry: "🎤 Opnieuw",
    voiceUnsupported: "Spraak werkt niet in deze browser. Probeer Chrome.",
    voiceDenied: "Geen toegang tot de microfoon.",
  },
  fr: {
    invitedFor: "Tu es invité pour",
    whoAreYou: "Qui es-tu ?",
    tapYourName: "Touche ton nom.",
    notThere: "Tu n'es pas dans la liste ? Prends une place libre.",
    fillNameSeat: "Entre ton nom et prends une place.",
    yourName: "Ton nom",
    seat: (n: number) => `Place ${n}`,
    allSeatsTaken: "Toutes les places sont prises — mais tu peux en ajouter une.",
    joinAddSeat: "Me joindre",
    someoneJoined: (n: string) => `${n} a rejoint`,
    notRight: "pas correct",
    alreadyJoined: "Déjà inscrits",
    fillNameFirst: "Entre d'abord ton nom.",
    seatTaken: "Cette place vient d'être prise. Choisis-en une autre.",
    badCode: "Ce code d'invitation n'existe pas (plus).",
    loading: "Chargement…",

    youAre: "Tu es",
    notMe: "pas moi",
    notMeConfirm: (n: string) => `Tu n'es pas ${n} ? Tu libères cette place et tu choisis à nouveau.`,
    releaseSeat: "Libérer la place",
    tabOrder: "🍺 Commander",
    tabMe: "🧾 Mon compte",
    tabGroup: "👥 Groupe",
    groupTitle: "👥 Dans ce groupe",
    peopleN: (n: number) => `${n} ${n === 1 ? "personne" : "personnes"}`,
    joinedOfTotal: (a: number, b: number) => `${a} sur ${b} inscrits`,
    hostMark: "👑 organisateur",
    startNotAll: (n: number, t: number) => `${n} sur ${t} pas encore inscrits. Commencer quand même ?`,
    startWait: "Attendre encore",
    startAnyway: "Commencer",
    scannedSelf: "📱 inscrit",
    youMark: "⭐ toi",
    notScannedYet: "pas encore inscrit",
    inviteMore: "Invite plus de monde — fais scanner le code.",
    roundWhatYouWant: (n: number) => `🛒 Tournée ${n} — ce que tu veux`,
    noRoundYet: "🛒 Aucune tournée en cours",
    tapBelow: "Touche ci-dessous ce que tu veux. Celui qui va au bar le voit tout de suite.",
    searchDrink: "Chercher une boisson…",
    shortList: "⚡ Liste courte",
    fullListBtn: "📖 Liste complète",
    nothingFound: "Rien trouvé — essaie un autre mot.",
    barFootnote1: "Celui qui va au bar clôture la tournée et entre le montant.",
    barFootnote2: "Ta part sera répartie équitablement à la fin.",

    myTab: "🧾 Mon compte",
    noRoundClosed: "Aucune tournée n'est encore clôturée.",
    whatYouDrank: "Ce que tu as bu",
    yourShare: "(ta part)",
    whatYouPaid: "Ce que tu as payé",
    inclPot: "(mise au pot incluse)",
    youAreEven: "Tu es à l'équilibre",
    youGetBack: "Tu récupères",
    youStillPay: "Tu dois encore",
    settlesWith: (n: string) => `🔗 Tu règles avec ${n} — ci-dessus, seulement ta propre part.`,
    directionOnly: "C'est une estimation, pas le décompte final. Tant qu'il y a des tournées, ça change.",
    howYouSettle: "🔁 Comment tu règles",
    roundsTitle: "📜 Tournées",
    roundN: (n: number) => `Tournée ${n}`,
    nothingThisRound: "tu n'avais rien dans cette tournée",

    addOwnDrink: "⭐ Boisson perso",
    newDrinkTile: "Boisson perso ?",

    // ── start & setup
    tagline: "Les tournées et le partage, sans prise de tête !",
    autoName: () => { const d = new Date(); const m = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]; return `Tournée ${d.getDate()} ${m[d.getMonth()]}` },
    startNow: "Start",
    groupNameHint: "NOM DE TON GROUPE",
    tapToChange: "touche pour changer",
    peopleHeader: (n: number) => `👥 ${n} ${n === 1 ? "personne" : "personnes"}`,
    peopleIntro: (n: number) => `Tu es là. ${n === 1 ? "L'autre scanne" : `Les ${n} autres scannent`} le QR et met son nom.`,
    waitingSeats: (names: string) => `${names} — en attente de scan…`,
    noPhoneAdd: "Quelqu'un sans téléphone ?",
    addSelf: "+ ajouter moi-même",
    yourSeat: "Toi",
    groupNameEdit: "Nom de ce groupe",
    groupNamePh: "Tape le nom de ton groupe",
    starting: "En cours…",
    savedGroups: "Groupes enregistrés",
    asGuest: "en tant qu'invit\u00e9",
    groupsOpen: "Ouvert",
    groupsClosed: "Cl\u00f4tur\u00e9",
    savedLater: "bientôt disponible",
    savedNote: "La sauvegarde des groupes entre les sessions arrive dans l'app complète.",
    nameGroupFirst: "Donne d'abord un nom à ton groupe.",
    dupGroupName: (n: string) => `"${n}" existe déjà et est encore ouvert. Donne un autre nom à ce groupe, ou clôture d'abord le précédent.`,
    delGroupConfirm: (n: string) => `Supprimer "${n}" ? C'est d\u00e9finitif — toutes les tourn\u00e9es et donn\u00e9es de ce groupe seront perdues.`,
    delGroupYes: "Supprimer",
    cancel: "Annuler",
    createFailed: "Échec de la création du groupe. Réessaie.",

    peopleCount: "👥 Nombre de personnes",
    namesOptional: "Les noms sont facultatifs — modifie-les quand tu veux.",
    namesForPot: "Ajoute des personnes si tu veux une cagnotte — les noms sont optionnels.",
    peopleTitle: "Personnes",
    addPersonFirst: "Ajoute d'abord au moins une personne.",
    whichAreYou: "Lequel es-tu ?",
    assignAnyone: "Tu peux attribuer à tout le monde — même à ceux qui ont scanné.",
    pickYourName: "Touche ton nom — le reste, tu le coches toi-même en commandant.",
    freeUp: "libérer",
    personHasDrinks: (n: string) => `${n} a déjà des boissons dans une tournée et ne peut pas être supprimé. Supprime d'abord ces boissons.`,
    thisPerson: "Cette personne",

    // ── delen
    letGuestsScan: "📲 Fais scanner tes invités",
    freeSeats: (n: number) => `Encore ${n} place${n === 1 ? "" : "s"} libre${n === 1 ? "" : "s"}. Qui scanne en choisit une et coche ses boissons.`,
    allTakenAdmin: "Toutes les places sont prises. Ajoutes-en une si quelqu'un arrive.",
    shareLink: "Partager le lien",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié.",
    joinInvite: (g: string, l: string) => `Rejoins ${g} sur Rundo Party : ${l}`,

    // ── startvragen
    beforeWeStart: "Choisis ta formule",
    settingsLater: "Besoin d'un pot, de gobelets ou de jetons ? Ça s'active via ⚙️ Groupe — pas maintenant.",
    potStartTitle: "🧪 Une cagnotte commune ?",
    potHowMany: "Vous \u00eates combien ?",
    perManShort: "p.p.",
    potTotalIn: "Total dans la cagnotte :",
    potInShort: "vers\u00e9",
    potStillIn: "reste",
    alreadyInPot: "D\u00e9j\u00e0 dans la cagnotte",
    nowAdding: "Ajout\u00e9 maintenant",
    newPotTotal: "Nouveau total",
    firstDeposit: "1re mise",
    addToPot: "Ajouter \u00e0 la cagnotte",
    potFillAmount: "Entre d\u2019abord un montant.",
    potAdded: (v: string) => `\u2713 ${v} ajout\u00e9 \u00e0 la cagnotte`,
    setPotTo: (v: string) => `Mettre la cagnotte \u00e0 ${v}`,
    potPerPerson: (v: string) => `\u2248 ${v} par personne`,
    potStartWhy: "Chacun met quelque chose d'avance. Les tournées sortent de là — personne ne paie à chaque fois.",
    potStartIn: (b: string) => `Dans la cagnotte : ${b}`,
    potStartAdd: "+ Mettre",
    potStartMore: "Ajouter",
    unassignedHub: (n: number) => `🔴 ${n} boisson${n === 1 ? "" : "s"} pas encore attribuée${n === 1 ? "" : "s"}`,
    unassignedHubWhy: "Sans nom, elles sont partagées également — pas équitable. Attribue-les pour que chacun paie ce qu'il a bu.",
    unassignedHubBtn: "Attribuer",
    assignAllBtn: "Tout attribuer d\u2019un coup",
    assignFirstNote: "Attribue d\u2019abord toutes les boissons. Ensuite tu peux continuer.",
    assignPerRoundBtn: "Attribuer par tourn\u00e9e",
    assignTitle: "Attribuer",
    roundXofY: (a: number, b: number) => `Tourn\u00e9e ${a} sur ${b}`,
    assignAllHint: "tu les parcours toutes",
    assignAllSub: (n: number) => `Les ${n} tourn\u00e9es d\u2019un coup`,
    roundDoneNext: "Cette tourn\u00e9e est compl\u00e8te",
    roundDoneShort: "Tourn\u00e9e attribu\u00e9e",
    nextRoundAssign: (n: number) => `Suivante : tourn\u00e9e ${n} \u2192`,
    allAssignedDone: "Termin\u00e9 \u2014 tout est attribu\u00e9",
    quickStart: "Démarrer",
    continueRound: (n: number) => `Continuer la tournée ${n}`,

    // ── instellingen
    groupSettings: "⚙️ Paramètres",
    cupsTitle: "♻️ Gobelets réutilisables",
    cupsInfo: "Pour les events avec caution par gobelet, remboursée au retour. Active pour l'inclure dans le décompte.",
    depositPerCup: "Caution/gobelet",
    coinsTitle: "🎟️ Jetons",
    coinsInfo: "Tu paies en jetons plutôt qu'en euros ? Règle la valeur et les prix ; l'app répartit équitablement.",
    coinPrices: "🎟️ prix en jetons par boisson",
    coinPricesInfo: "Jetons festival par défaut. Ajuste avec − / + (pas de 0,1).",
    potTitle: "🫙 Pot",
    potHowManyQ: "Vous \u00eates combien \u00e0 mettre au pot ?",
    potHowManySub: "N\u00e9cessaire pour calculer le montant par personne.",
    continueWord: "Continuer",
    fillCoinValue: "Entre la valeur du jeton (1 jeton = €…) — ou désactive les jetons.",
    fillDeposit: "Entre le montant de la caution par gobelet — ou désactive les gobelets.",

    // ── bestellen
    inThisRound: "🛒 Dans cette tournée",
    someoneCanGo: "👉 Quelqu'un peut aller chercher !",
    noFavsHere: "Aucun favori ici.",
    showAll: "📖 tout afficher",
    assign: "Attribuer",
    assignHint: "— touche pour attribuer",
    assigned: "✓ attribué",
    eachOne: "👥 1 chacun",
    eachOneConfirm: (n: string, meer: boolean) => `${n} ${meer ? "en ont" : "en a"} déjà 2 ou plus. Avec « 1 chacun », tout le monde en reçoit exactement un — ${n} ${meer ? "redescendent" : "redescend"} donc à 1.`,
    yesEachOne: "Oui, 1 pour tous",
    redistribute: 'Redistribuer : − remet une boisson sur « inconnu », puis touche un autre nom.',
    closeRound: "✓ Clôturer la tournée",
    cancelRound: "✕ Annuler la tournée",
    cancelRoundConfirm: (n: number) => `Annuler la tournée ${n} ? Toutes les boissons choisies seront perdues. C'est irréversible.`,
    yesCancel: "Oui, annuler",
    backFinish: "← Retour, terminer la tournée",
    cups: "🫙 Gobelets",
    cupsNotSet: "Gobelets pas encore indiqués.",
    tapToArrange: "Touche ici pour régler →",
    tapToAssign: "Touche ici pour attribuer",
    nobodyGaveBack: "🚫 personne n'a rendu de gobelet",
    howMuchEach: "Combien chacun a rendu",
    gaveBack: "a rendu",
    ready: "Terminé",

    // ── betalen
    exactAmount: "💰 Montant exact payé pour cette tournée ?",
    amountAndPayer: "montant & payeur",
    whoPaid: "Choisis qui a payé.",
    multiplePossible: "(plusieurs possibles)",
    fillAmountFirst: "Entre d'abord le montant payé — ensuite tu choisis qui a payé.",
    fillPerPayer: "Entre un montant par payeur.",
    confirmPaymentFirst: "Confirme d'abord le paiement.",
    thePot: "🫙 le pot",
    fromPot: "du pot",
    fromCard: "de la carte boissons",
    notPaidYet: "pas encore payé",
    paidBy: "Payé par",
    roundingNote: "le centime d'arrondi est réglé dans le Fair Split",

    // ── pot
    potMoney: "🫙 Pot (argent)",
    drinkCard: "💳 Carte boissons",
    addPotContrib: "➕ Ajouter une mise au pot",
    addMoreToPot: "\u2795 Ajouter encore",
    nthDeposit: (n: number) => `Mise ${n}`,
    resetContrib: "↺ réinitialiser",
    everyone: "👥 répartir sur tous",
    ownAmount: "ou montant libre :",
    cardValue: "Valeur de la carte",
    whoBoughtCard: "Qui a acheté la carte ? (touche — le montant apparaît)",
    addContrib: (b: string) => `✓ Ajouter la mise (${b})`,
    removeContrib: "✓ Supprimer la mise (vide)",
    edit: "✏️ modifier",
    remove: "✕ supprimer",
    beingEdited: "✏️ en cours de modification ↓",
    inPot: "mis au pot",
    removeContribConfirm: (l: string) => `Supprimer la ${l} du pot ? C'est irréversible.`,
    potEmpty: (kaart: boolean) => `${kaart ? "La carte boissons" : "Le pot"} est vide — ajoute d'abord.`,
    potTooLow: (kaart: boolean, max: string) => `${kaart ? "La carte" : "Le pot"} n'a que ${max} — baisse le montant ou remets-en.`,
    potNothingIn: (kaart: boolean) => `Tu as choisi ${kaart ? "une carte boissons" : "un pot"}, mais rien n'a encore été mis. Continuer quand même ?`,
    anywayWithout: (kaart: boolean) => `Continuer sans ${kaart ? "carte" : "pot"}`,

    // ── overzicht
    roundsOverview: "📋 Aperçu des tournées",
    overview: "📋 Aperçu",
    newRound: "➕ Nouvelle tournée",
    repeatRound: "🔁 Refaire la même tournée (modifiable)",
    askGroupRepeat: "🗳️ Demande au groupe : encore pareil ?",
    proposalTitle: "🗳️ La même tournée ?",
    proposalWaiting: "Chacun répond sur son écran. Tu clôtures quand tu veux.",
    ansSame: "✅ pareil",
    ansDiff: "🔄 autre chose",
    ansWaiting: "⏳ pas encore",
    ansSkip: "✋ passe",
    gProposalTitle: "🗳️ La même tournée ?",
    gProposalSame: "✅ Oui, pareil pour moi",
    gProposalDiff: "🔄 Choisir autre chose",
    gProposalSkip: "✋ Rien pour moi ce tour",
    gProposalDone: "Ton choix est noté.",
    gProposalYourLast: "Au tour d'avant tu avais :",
    closeProposalBtn: (n: number) => `Clôturer · ${n} ${n === 1 ? "participe" : "participent"}`,
    noOrderFor: (names: string) => `Pas de commande pour ${names}`,
    proposalNobody: "Personne n'a encore répondu. Clôturer quand même ?",
    editOrderBtn: "✏️ Modifier la commande",
    noRoundsDone: "Aucune tournée terminée",
    noRoundsHint: "Dès qu'une tournée est confirmée et payée, elle apparaît ici — tu peux encore la modifier.",
    startFirstRoundBtn: "1re tourn\u00e9e",
    toFirstRound: "1re tourn\u00e9e",
    noRoundsHintQuick: "Note ce qui est command\u00e9. Tes tourn\u00e9es termin\u00e9es appara\u00eetront ici.",
    roundBusy: (n: number) => `Tourn\u00e9e ${n} en cours`,
    tapRoundToEdit: "Touche une tournée pour la modifier.",
    settleBtn: "🧾 Régler",
    nothingToSettle: "Aucune tournée terminée à régler.",
    roundUnfinished: (n: number) => `La tournée ${n} est en cours — confirme et paie-la avant de régler.`,
    roundUnpaid: (n: number) => `La tournée ${n} n'est pas payée. Règle d'abord ce paiement.`,
    leaveAnyway: "Quitter quand même — commande perdue",
    unfinishedWarn: "Cette tournée n'est pas clôturée. Retourne la terminer — ou quitte, et la commande et le paiement seront perdus.",
    nothingToRepeat: "Aucune tournée à refaire.",

    // ── afrekenen
    finalBalance: "🧾 Bilan final",
    totalOrdered: "💰 Total commandé",
    fairSplit: "⚖️ Fair Split",
    equalSplit: "part égale",
    equalSplitWarn: "⚠️ Ceci est une répartition égale, pas un Fair Split.",
    fairSplitInfo: "Répartition égale = total ÷ nombre de personnes. Le Fair Split est plus juste : qui a peu ou rien bu ne paie pas pour ceux qui ont beaucoup bu.",
    unassignedWarn: "Attribue les boissons restantes, puis l'app répartit selon ce que chacun a consommé.",
    useFairSplit: "Attribuer et utiliser le Fair Split",
    equalAnyway: "Répartir également quand même",
    howYouAllSettle: "🔁 Comment vous réglez",
    fewestTransfers: "Le moins de virements pour être quittes :",
    allEven: "✓ Tout est à l'équilibre.",
    total: "Total",
    perPerson: "par personne",
    drank: "a bu",
    settleTogether: "👥 Quelqu'un règle-t-il ensemble ?",
    settleTogetherInfo: "Pour les couples, colocataires, ceux qui rentrent ensemble. Chacun garde ses boissons — seul le montant final est additionné.",
    tapWhoWith: (n: string) => `Touche maintenant qui règle avec ${n}.`,
    separateAgain: "Séparer à nouveau :",
    depositAdvanced: "caution (avancée)",
    cardLoss: "perte carte boissons (partagée)",

    // ── eigen drankje
    ownDrinkTitle: "⭐ Boisson personnalisée",
    ownDrinkIntro: "Il manque quelque chose ? Ajoute-le pour cette fête. Tout le groupe le voit immédiatement.",
    nameLabel: "Nom",
    namePh: "p.ex. Trappiste de Jos",
    categoryLabel: "Catégorie",
    priceLabel: "Prix indicatif",
    priceHint: "Nécessaire pour répartir la note équitablement. Une estimation suffit.",
    coinsAuto: "(vide = automatique)",
    addBtn: "Ajouter",
    remaining: (n: number, max: number) => `Encore ${n} de tes ${max} boissons personnalisées`,
    addedByYou: "Ajouté par toi",
    removeHint: "Supprime ce dont tu n'as plus besoin. Déjà commandé dans une tournée ? Alors ça reste.",
    nameYourDrink: "Donne un nom à ta boisson.",
    needPrice: "Entre un prix indicatif — sinon le Fair Split ne peut pas répartir cette boisson.",
    needAmountOrCancel: "Payer avec la cagnotte sans montant, ça ne va pas. Indique un montant, ou choisis Payé soi-même.",
    alreadyExists: (n: string) => `« ${n} » est déjà dans la liste.`,
    maxPerPerson: (n: number) => `Tu peux ajouter maximum ${n} boissons personnalisées.`,
    maxPerGroup: (n: number) => `Le groupe a atteint le maximum de ${n} boissons personnalisées.`,
    drinkAdded: (n: string) => `⭐ ${n} ajouté.`,
    drinkInUse: (n: string) => `${n} a déjà été commandé et ne peut plus être supprimé.`,

    confirmTitle: "Confirmation",
    imGoing: "🍻 Je lance une tournée",
    walkTable: "👥 Faire le tour",
    walkIntro: "Fais le tour de la table. Coche pour chacun ce qu'il veut.",
    walkDone: "✓ Terminé",
    walkFor: (n: string) => `Que veut ${n} ?`,
    whoGoes: "Prêt pour une tournée ?",
    xIsGoing: (n: string) => `🍻 ${n} s'en occupe`,
    youAreGoing: "🍻 Tu t'occupes de cette tournée",
    iGoInstead: "je reprends",
    notMeRunner: "passer",
    claimSeatFirst: "Prends d'abord une place avant de lancer une tournée.",
    modeTitle: "Commander ensemble + Fair Split",
    modeQuick: "Commande de groupe rapide",
    modeFairInfo: "Commandes de groupe, cagnotte et partage via QR. Chacun paie sa part > ne paie pas pour ce que tu n'as pas bu !",
    modeQuickInfo: "Note simplement ce qui est command\u00e9 et mets \u00e9ventuellement une cagnotte, tu peux partager plus tard.",
    groupNamePlaceholder: "Ex. Les Bulles",
    modeQuickSub: "Note vite une ou plusieurs tournées !",
    howItWorks: "voici comment",
    orWord: "ou",
    modeFairSub: "Scanne le QR, commandez ensemble & partagez équitablement",
    modeFairLine: "Payer équitablement selon ce que tu as bu",
    modeSwitchLater: "Tu peux changer plus tard — tes tournées sont gardées.",
    chooseHow: "Choisissez comment commander",
    howManyPeople: "Vous \u00eates combien ?",
    people: "pers.",
    adjust: "modifier",
    nameRequired: "Donne d\u2019abord un nom \u00e0 ton groupe.",
    peopleRequired: "Choisis d\u2019abord combien vous \u00eates.",
    headcountForward: "Valable \u00e0 partir de la prochaine tourn\u00e9e. Les tourn\u00e9es pr\u00e9c\u00e9dentes gardent leur nombre \u2014 corrige-les au besoin dans l\u2019aper\u00e7u.",
    headcountNotRetro: "Cela ne change pas les montants ci-dessous : chaque tourn\u00e9e garde le nombre du moment. Pour corriger une tourn\u00e9e pass\u00e9e, va dans l\u2019aper\u00e7u.",
    chosen: "CHOISI",
    tapToChoose: "appuie pour choisir",
    exampleTag: "exemple",
    switchModeLink: "Changer de formule",
    switchToFair: "Vers le mode Fair Split",
    switchToQuick: "Vers les tourn\u00e9es rapides",
    switchModeWarn: "Changer de formule ? Tu recommences \u00e0 z\u00e9ro — ce que tu as not\u00e9 jusqu'ici dispara\u00eet.\n\nAstuce : choisis directement la bonne formule au d\u00e9part la prochaine fois.",
    switchModeYes: "Changer et recommencer",
    barList: "📋 Commande",
    tapToRename: "touche pour renommer",
    removeWord: "Retirer",
    barHandOut: "Distribuer",
    settleNow: "🧾 Régler quand même ?",
    settleNowWhy: "On a tout noté. Un clic et tu sais qui doit quoi.",
    settleNowBtn: "Oui, répartis équitablement",
    costTitle: "Combien \u00e7a a co\u00fbt\u00e9 ?",
    costModeTotal: "total",
    costModePerRound: "par tourn\u00e9e",
    costWholeNight: "Toute la soir\u00e9e",
    costRoundN: (n: number) => `Tourn\u00e9e ${n}`,
    costTotalLabel: "Total",
    roundCostOptional: "Combien pay\u00e9 pour cette tourn\u00e9e ?",
    roundCostFor: (n: number) => `Combien pay\u00e9 pour la tourn\u00e9e ${n} ?`,
    withHowManyQ: "\u00c0 combien \u00e9tiez-vous pour cette tourn\u00e9e ?",
    orderedLabel: "Command\u00e9",
    thisRoundLabel: "Cette tourn\u00e9e",
    paidLabel: "Pay\u00e9",
    adjustWord: "Modifier",
    notSavedYet: "non enregistr\u00e9",
    saveWord: "Enregistrer",
    potTopUp: "Compl\u00e9ter la cagnotte",
    emptyWord: "vide",
    potEmptyFillFirst: "La cagnotte est vide \u2014 compl\u00e8te-la d\u2019abord pour payer avec.",
    editRoundHead: (n: number) => `Modifier la tourn\u00e9e ${n}`,
    paidWithQ: "Pay\u00e9 avec quoi ?",
    paidNote: (v: string) => `Pay\u00e9 ${v}`,
    noAmountNote: "Aucun montant indiqu\u00e9",
    noPotUsed: "sans cagnotte",
    paidFromPot: (v: string) => `${v} de la cagnotte`,
    skipCostWarn: "Tu as d\u00e9j\u00e0 rempli quelque chose pour cette tourn\u00e9e. Passer quand m\u00eame sans enregistrer ?",
    skipCostYes: "Oui, passer",
    finishRoundFirst: "Cl\u00f4ture d\u2019abord cette tourn\u00e9e — indique le montant ou appuie sur Passer.",
    payFromPotQ: "Payer avec la cagnotte ?",
    paidSelf: "Pay\u00e9 soi-m\u00eame",
    paidPot: "De la cagnotte",
    potEmptyNote: "La cagnotte est vide — ajoute d\u2019abord un montant.",
    potNotEnough: (v: string) => `La cagnotte n\u2019a que ${v} — le reste, tu le paies toi-m\u00eame.`,
    potPayLeft: (bedrag: string, over: string) => `${bedrag} de la cagnotte \u2192 ${over} restant apr\u00e8s`,
    potShortTitle: "Pas assez dans la cagnotte",
    potShortSimple: (inPot: string, kost: string) => `Il reste ${inPot} dans la cagnotte, cette tourn\u00e9e co\u00fbte ${kost}.`,
    potChoiceTopUp: "\ud83e\uded9 Ajouter \u00e0 la cagnotte",
    potChoicePaySelf: "\ud83d\udcb6 Tout payer soi-m\u00eame",
    potWord: "cagnotte",
    potHasLeft: (v: string) => `${v} dans la cagnotte`,
    maxAmount: (v: string) => `max ${v}`,
    restSelf: "Reste \u00e0 payer :",
    potEmptyLabel: "Cagnotte vide",
    potFillBtn: "+ Remplir la cagnotte",
    skipRound: "Passer",
    skipPayment: "Passer le paiement",
    tapToConfirm: "appuie sur ✓ pour confirmer",
    noAmountsYet: "Tu n'as pas encore entr\u00e9 de montants. Sans montants, rien \u00e0 partager — indique d'abord ce qu'ont co\u00fbt\u00e9 les tourn\u00e9es.",
    fillAmountsNow: "Entrer les montants",
    later: "Plus tard",
    back: "Retour",
    quickSettleTitle: "🧾 R\u00e9gler",
    quickTotalLabel: "Total de toutes les tourn\u00e9es",
    andWord: "et",
    roundsNoAmountNamed: (lijst: string) => `Tournée ${lijst} sans montant`,
    roundsNoAmountCount: (n: number) => `${n} tournées sans montant`,
    roundsNoAmountWhy: "Elles ne comptent pas dans le partage ci-dessous. Complète-les ou laisse-les.",
    fillAmountsBtn: "Compléter les montants ›",
    noAmountBadge: "sans montant",
    addAmountBtn: "€ Ajouter le montant",
    splitOverGroup: "Partager",
    splitEqually: "R\u00e9partir \u00e9galement",
    fairSplitExplain: "Avec Fair Split, chaque boisson est li\u00e9e \u00e0 un nom. Qui a bu plus paie plus \u2014 qui n\u2019a rien pris ne paie rien.\n\nTu attribues par tourn\u00e9e qui a pris quoi. Attention : changer efface ce que tu as not\u00e9.",
    payAllSelf: "Tout payer",
    treatHint: "Tu offres une tourn\u00e9e ? Touche-la ci-dessous (elle ne compte pas dans le partage)",
    roundWord: "Tourn\u00e9e",
    drinksCount: (n: number) => `${n} boisson${n === 1 ? "" : "s"}`,
    confirmRoundTitle: (n: number) => `\u2705 Confirmer la tourn\u00e9e ${n}`,
    confirmRoundBtn: (n: number) => `\u2705 Confirmer la tourn\u00e9e (${n} boisson${n === 1 ? "" : "s"})`,
    roundConfirmed: (nr: number, n: number) => `Tourn\u00e9e ${nr} confirm\u00e9e \u2014 ${n} boisson${n === 1 ? "" : "s"}`,
    notAssignedYet: (n: number) => `${n} boisson${n === 1 ? "" : "s"} pas encore attribu\u00e9e${n === 1 ? "" : "s"}.`,
    yourTreat: "ta tourn\u00e9e offerte",
    eachPaysNote: "Chacun paie",
    headcountVaried: "Toutes les tourn\u00e9es n\u2019avaient pas le m\u00eame nombre de personnes :",
    splitOver: "R\u00e9partir sur",
    showPerRound: "Plut\u00f4t r\u00e9partir par tourn\u00e9e",
    treatShort: "Offrir une tourn\u00e9e ?",
    backToOneAmount: "\u2190 Retour \u00e0 un seul montant",
    perRoundTitle: "R\u00e9parti par tourn\u00e9e",
    notEveryoneAllRounds: "Tout le monde n\u2019a pas particip\u00e9 \u00e0 chaque tourn\u00e9e, donc \u00e7a varie :",
    fromStart: "depuis le d\u00e9but",
    fromRound: (n: number) => `\u00e0 partir de la tourn\u00e9e ${n}`,
    untilRound: (n: number) => `jusqu\u2019\u00e0 la tourn\u00e9e ${n}`,
    roundsRange: (a: number, b: number) => `tourn\u00e9es ${a} \u00e0 ${b}`,
    plusTreat: (v: string) => `Tu offres ${v} en plus`,
    payAllNote: "Toute l\u2019addition est pour toi :",
    quickHeadsLabel: "Vous \u00e9tiez combien ?",
    quickPerHead: "La part de chacun",
    quickPerHeadNote: (n: number) => `partag\u00e9 \u00e9galement entre ${n} ${n === 1 ? "personne" : "personnes"}`,
    notFairSplitYet: "C'est un partage \u00e9gal",
    notFairSplitWhy: "Tout le monde paie pareil, m\u00eame ceux qui ont moins bu. Tu veux que ceux qui ont plus bu paient plus ? Passe au Fair Split.",
    switchToFairBtn: "⚖️ Passer au Fair Split",
    fairSetupTitle: "⚖️ Qui \u00e9tait l\u00e0 ?",
    fairSetupIntro: "Ajoute les personnes. Tape un nom ou laisse-le (Invit\u00e9 N). Ensuite tu attribues qui a bu quoi.",
    fairAddPerson: "+ Ajouter une personne",
    fairSetupDone: "Termin\u00e9 — attribuer",
    roundsOverviewTitle: "🧾 Aper\u00e7u des tourn\u00e9es",
    peopleInRound: "personnes dans cette tourn\u00e9e",
    showDetails: "Voir les détails",
    hideDetails: "Masquer les détails",
    newRoundBtn: "Nouvelle tourn\u00e9e",
    editRoundBtn: "Modifier",
    editOrderFull: "Modifier la commande",
    roundsOverviewBtn: "Aper\u00e7u",
    noRoundsYet: "Aucune commande termin\u00e9e. Confirme d'abord une tourn\u00e9e.",
    roundsTab: "Tourn\u00e9es",
    roundSummary: (n: number, items: number) => `Tourn\u00e9e ${n} \u00b7 ${items} boisson${items === 1 ? "" : "s"}`,
    sameRoundAgainQ: "Refaire la m\u00eame tourn\u00e9e (modifiable) ou une nouvelle ?",
    sameRoundYes: "🔁 Refaire pareil",
    newRoundFresh: "✨ Nouvelle tourn\u00e9e",
    estimate: "estimation sur prix indicatifs",
    estimateWhy: "Personne n'a entré de montants, donc on calcule avec les prix indicatifs de la liste. Approximatif, mais équitable.",
    voiceBtn: "🎤 Dicter",
    voiceBeta: "bêta",
    voiceListening: "🎤 J'écoute…",
    voiceSay: "Dis par exemple « 2 cola zero ». Fonctionne mieux par boisson.",
    voiceHeard: "Compris",
    voiceNothing: "Rien reconnu. Réessaie, ou touche simplement les boissons.",
    voiceAdd: "Ajouter à la tournée",
    voiceRetry: "🎤 Réessayer",
    voiceUnsupported: "La dictée ne fonctionne pas dans ce navigateur. Essaie Chrome.",
    voiceDenied: "Pas d'accès au micro.",
  },
} as const

export default function PartyTest() {
  const [lang] = useLang()
  const L = T[(lang === "fr" ? "fr" : "nl") as "nl" | "fr"]
  const [view, setView] = useState<"start" | "setup" | "settings" | "order" | "confirmed" | "hub" | "final" | "quickSettle" | "fairSetup" | "roundsOverview">("start")
  const [pay, setPay] = useState<"eur" | "coin">("eur")
  const [coinValue, setCoinValue] = useState(3.9)
  const [depositOn, setDepositOn] = useState(false)
  const [depositValue, setDepositValue] = useState(1)
  const [depositUnit, setDepositUnit] = useState<"eur" | "coin">("eur")
  const [showPot, setShowPot] = useState(false)
  const [showCoins, setShowCoins] = useState(false)
  const [coinInfo, setCoinInfo] = useState(false)
  const [depositInfo, setDepositInfo] = useState(false)

  const [groupName, setGroupName] = useState("")
  const [people, setPeople] = useState<Person[]>([])

  // ── Supabase-laag ───────────────────────────────────────────────────────────
  const me = useRef(deviceId())
  const mounted = useRef(true)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [openRoundId, setOpenRoundId] = useState<string | null>(null)
  // Snelle rondjes: is het laatst bevestigde rondje al "afgehandeld" (kost ingevuld of
  // bewust overgeslagen)? Zolang niet, houden de tabs je even op dit scherm zodat je de
  // kans om het bedrag in te vullen niet mist.
  const [lastRoundHandled, setLastRoundHandled] = useState(true)
  // Snelle rondjes afrekenen: betaalt dit rondje uit eigen zak ("self") of uit de pot ("pot")?
  const [payVia, setPayVia] = useState<"self" | "pot">("self")
  // Huidig aantal aanwezigen (snelle rondjes). Start op 0 = "nog niet gekozen": de
  // gebruiker moet het bewust instellen (naam én aantal verplicht). Elk afgesloten rondje
  // krijgt dit getal mee; wijzig je het later, dan geldt het vanaf het volgende rondje.
  const [headcount, setHeadcount] = useState(0)
  // Afreken-scherm snelle rondjes: verdelen over de groep, of alles op één iemand. En
  // welke rondjes getrakteerd zijn (tellen niet mee in de verdeling — komen op de tracteur).
  const [settleMode, setSettleMode] = useState<"verdelen" | "allesZelf">("verdelen")
  // Over hoeveel personen verdeelt het afrekenscherm? Leeg = het hoogste aantal dat in
  // een rondje voorkwam; de beheerder kan het bijstellen.
  const [splitPeople, setSplitPeople] = useState<number | null>(null)
  const [showPerRound, setShowPerRound] = useState(false)
  const [showTreat, setShowTreat] = useState(false)
  // Loopt de beheerder alle rondjes in één keer af, of wijst hij er één toe?
  const [assignAllMode, setAssignAllMode] = useState(false)
  const [treatedRounds, setTreatedRounds] = useState<Set<string>>(new Set())
  // Kleine pop-up om het aantal personen aan te passen (vanaf het afreken-scherm van een rondje).
  const [showPeoplePop, setShowPeoplePop] = useState(false)
  // false = "gewoon rondjes" (geen geld). Eén app, het geld-gedeelte verborgen.
  const [settle, setSettle] = useState(true)
  type Custom = { key: string; name: string; cat: Cat; price: number; coins: number; cup: boolean; by: string }
  const [customDrinks, setCustomDrinks] = useState<Custom[]>([])
  // Afwijkende coin-prijzen voor dit feest. Ook jsonb op de groep-rij, dus gratis mee.
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({})
  const [showAddDrink, setShowAddDrink] = useState(false)
  const [ndName, setNdName] = useState("")
  const [ndPrice, setNdPrice] = useState("")
  const [inviteCode, setInviteCode] = useState<string>("")
  const [ownerDevice, setOwnerDevice] = useState<string>("")
  const [booting, setBooting] = useState(true)   // eerste laadbeurt (code uit de URL)
  const [busy, setBusy] = useState(false)        // groep aanmaken / plaats claimen
  // Opgeslagen groepen: alle groepen waar dit toestel bij hoort (zelf gemaakt of via
  // QR aan deelgenomen). Getoond op het startscherm zodat je kan terugkeren.
  type SavedGroup = { id: string; name: string; last_active: string; finalized: boolean; owned: boolean }
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const isAdmin = !!ownerDevice && ownerDevice === me.current
  // Mijn eigen plaats: die waarop dit toestel zit. Nodig zodra gasten hun eigen
  // drankjes aantikken (blok 3).
  const meId = people.find((p) => p.claimedBy === me.current)?.id ?? null
  const inviteLink = typeof window !== "undefined" && inviteCode
    ? `${window.location.origin}${window.location.pathname}?code=${inviteCode}` : ""
  // De vaste catalogus staat in de code (nul queries per gast). Eigen drankjes komen
  // uit de groep-rij, die we toch al ophalen — dus ook nul extra queries.
  const drinks: Drink[] = useMemo(() => [
    ...DEMO_DRINKS,
    ...customDrinks.map((c) => ({
      id: c.key, name: c.name, emoji: "⭐", cat: "Eigen" as Cat, price: Number(c.price),
      cup: !!c.cup, fav: true, coins: Number(c.coins), custom: true, by: c.by,
    })),
  ].map((d) => (coinPrices[d.id] !== undefined ? { ...d, coins: coinPrices[d.id] } : d)),
  [customDrinks, coinPrices])

  // Coin-prijs bijstellen. Debounced wegschrijven: de +/- knopjes gaan per 0,1, dus
  // wie doorklikt zou anders tien updates afvuren.
  const coinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setCoinPrice = (drinkId: string, coins: number) => {
    const next = { ...coinPrices, [drinkId]: Math.max(0, +coins.toFixed(1)) }
    setCoinPrices(next)
    if (coinTimer.current) clearTimeout(coinTimer.current)
    coinTimer.current = setTimeout(() => {
      if (!groupId) return
      supabase.from("party_groups").update({ coin_prices: next }).eq("id", groupId)
        .then(({ error }) => { if (error) setNotice("Coin-prijs opslaan mislukt: " + error.message) })
    }, 700)
  }
  const [potRounds, setPotRounds] = useState<{ id: string; seq: number; amounts: Record<string, number> }[]>([])
  const [potDraft, setPotDraft] = useState<Record<string, number>>({})
  // Snelle rondjes: bedrag dat IEDEREEN inlegt. Het totaal (potDraft.pot) = dit × aantal.
  const [potPerMan, setPotPerMan] = useState<number>(0)
  // Aantal inleggers dat de beheerder kiest vóór hij de pot invult (snelle rondjes).
  const [potPeopleDraft, setPotPeopleDraft] = useState(2)
  // Is de vraag "met hoeveel leggen jullie in?" beantwoord voor deze pot-sessie?
  const [potPeopleOk, setPotPeopleOk] = useState(false)
  // Koos de beheerder bewust voor "deels pot, deels zelf"? Dan tonen we die verdeling.
  const [potSplitOk, setPotSplitOk] = useState(false)
  // Net een inleg toegevoegd? Dan is "Klaar" de logische volgende stap, niet nóg een inleg.
  const [potJustAdded, setPotJustAdded] = useState(false)
  const [everyoneDraft, setEveryoneDraft] = useState<string>("")
  const [everyoneChoice, setEveryoneChoice] = useState<number | "custom" | null>(null)
  const [editPotId, setEditPotId] = useState<string | null>(null)
  const [potBuilderOpen, setPotBuilderOpen] = useState(false)
  // Bij elke nieuwe inleg opnieuw vragen met hoeveel personen er ingelegd wordt — zo
  // weet elke inleg apart voor hoeveel mensen hij gold (nodig voor een latere Fair Split).
  useEffect(() => {
    if (showPot) setPotJustAdded(false)
  }, [showPot])
  useEffect(() => {
    if (potBuilderOpen || showPot) { setPotPeopleOk(false); setPotPeopleDraft(headcount >= 1 ? headcount : 2) }
  }, [potBuilderOpen, showPot])  // eslint-disable-line react-hooks/exhaustive-deps
  // Welk afgerond rondje staat in bewerkmodus? Buiten die modus is het overzicht
  // gewoon leesbaar, zodat je niets per ongeluk verandert.
  const [editRoundId, setEditRoundId] = useState<string | null>(null)
  // Wijzigingen houden we eerst hier bij; pas op "Opslaan" gaan ze naar de rekening.
  const [editDraft, setEditDraft] = useState<{ drinks: Record<string, number>; amount: number; headcount: number; usePot: boolean } | null>(null)
  const startEditRound = (r: Round) => {
    const d: Record<string, number> = {}
    drinksOf(r).forEach(({ d: dr, n }) => { d[dr.id] = n })
    setEditDraft({ drinks: d, amount: r.amount || 0, headcount: Math.max(1, r.headcount || 1), usePot: (r.potPart || 0) > 0.005 })
    setEditRoundId(r.id)
  }
  const cancelEditRound = () => { setEditDraft(null); setEditRoundId(null) }
  // Alles in één keer wegschrijven: aantallen als verschil, bedrag, personen en bron.
  const saveEditRound = async (r: Round) => {
    if (!editDraft) { cancelEditRound(); return }
    // Uit de pot betalen zonder bedrag kan niet: er zou nul uit de pot gaan terwijl het
    // rondje wél als betaald geldt. Een bedrag wissen mag wél — dan valt het rondje
    // terug op "geen bedrag ingevuld", wat een geldige toestand is.
    if (editDraft.usePot && (editDraft.amount || 0) <= 0.005) { setNotice(L.needAmountOrCancel); return }
    const idx = rounds.indexOf(r)
    const huidig: Record<string, number> = {}
    drinksOf(r).forEach(({ d, n }) => { huidig[d.id] = n })
    Object.entries(editDraft.drinks).forEach(([did, n]) => {
      const delta = (n || 0) - (huidig[did] || 0)
      if (delta !== 0) rBumpAnon(idx, did, delta)
    })
    const beschikbaar = Math.max(0, potAvailFor(idx))
    // Komt de pot tekort, dan moet je eerst kiezen — net als bij het bestellen.
    if (editDraft.usePot && editDraft.amount > beschikbaar + 0.005) { setNotice(L.potShortTitle); return }
    if (Math.abs((r.amount || 0) - editDraft.amount) > 0.001) qSetAmount(idx, editDraft.amount)
    if (Math.max(1, r.headcount || 1) !== editDraft.headcount) await setRoundHeadcount(r.id, editDraft.headcount)
    rSetPotAmt(idx, editDraft.usePot ? editDraft.amount : 0)
    cancelEditRound()
  }
  const [potIsCard, setPotIsCard] = useState(false)
  const [cardValue, setCardValue] = useState("")
  const [cardPayers, setCardPayers] = useState<string[]>([])
  const [beginPrompt, setBeginPrompt] = useState(false)
  const [potChosen, setPotChosen] = useState(false)
  const [bpSettle, setBpSettle] = useState<boolean | null>(null)
  const [fromOnboarding, setFromOnboarding] = useState(false)
  const [onboardedOnce, setOnboardedOnce] = useState(false)
  // Als je een verse groep (nog geen rondjes) heropent, land je op de kaders om de modus
  // te (her)bevestigen. Deze id onthoudt WELKE bestaande groep we dan bijwerken, zodat
  // "Beginnen" niet een nieuwe groep maakt maar deze verse groep voortzet.
  const [resumeGroupId, setResumeGroupId] = useState<string | null>(null)
  const [onbPotActive, setOnbPotActive] = useState(false)

  const [roundNr, setRoundNr] = useState(1)
  const [activeCat, setActiveCat] = useState<Cat>("Bier")
  const [drinkSearch, setDrinkSearch] = useState("")
  const [guestTab, setGuestTab] = useState<"order" | "me" | "group">("order")
  // "Rondje opnemen": de tafel rondgaan, persoon per persoon. walkIdx = wie er nu aan
  // de beurt is (index in people). null = het scherm is niet open.
  const [walkIdx, setWalkIdx] = useState<number | null>(null)
  // De haler van het OPEN rondje (person-id). Wie "ik ga halen" tikt, opent het
  // rondje en wordt dit. null = nog niemand ging halen.
  const [startedBy, setStartedBy] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [voiceText, setVoiceText] = useState("")
  const [voiceHits, setVoiceHits] = useState<{ id: string; name: string; qty: number }[]>([])
  const [coinCat, setCoinCat] = useState<Cat>("Bier")
  const [coinFull, setCoinFull] = useState(false)
  const [fullList, setFullList] = useState(false)
  // De groepsnaam is in de header zelf aanpasbaar — niet via een omweg naar de instellingen.
  const [editName, setEditName] = useState(false)
  // Kwam je via "Bedragen aanvullen"? Dan krijgen de lege rondjes een tint en een knop.
  // Anders blijft het overzicht rustig en volstaat een label.
  const [fillMode, setFillMode] = useState(false)
  useEffect(() => { if (view !== "roundsOverview") setFillMode(false) }, [view])
  // Pijltjes bij de categorierij: ze tonen dat er links of rechts nog meer staat,
  // want een halve pil aan de rand leest als een afsnijfout en niet als een uitnodiging.
  const catScroll = useRef<HTMLDivElement | null>(null)
  const [catMore, setCatMore] = useState({ left: false, right: false })
  const updateCatArrows = () => {
    const el = catScroll.current
    if (!el) return
    setCatMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  // Bij het openen van een bestelscherm meteen kijken of er rechts nog categorieën staan.
  useEffect(() => { updateCatArrows() }, [view, guestTab, activeCat])  // eslint-disable-line react-hooks/exhaustive-deps
  const [cart, setCart] = useState<Assign>({})
  const [cartAnon, setCartAnon] = useState<Anon>({})
  const [rounds, setRounds] = useState<Round[]>([])
  const [gaveBackDraft, setGaveBackDraft] = useState<Record<string, number>>({})
  const [displayUnit, setDisplayUnit] = useState<"eur" | "coin">("eur")
  const [showEqual, setShowEqual] = useState(true)
  const [openFairAll, setOpenFairAll] = useState(false)
  const [openFair, setOpenFair] = useState<Record<string, boolean>>({})
  const [openRound, setOpenRound] = useState<number | null>(null)
  const [allRoundsOpen, setAllRoundsOpen] = useState(false)
  const [repeated, setRepeated] = useState(false)
  const [hasSettled, setHasSettled] = useState(false)
  // Gewoon rondjes: het bedrag dat verdeeld wordt is de som van alle r.amount — één
  // bron van waarheid. In het aparte rondjesoverzicht kies je totaal of per rondje.
  const [costMode, setCostMode] = useState<"total" | "perRound">("total")
  // Niveau 1 (snel afrekenen): met hoeveel waren jullie? Totaal ÷ dit = ieders deel.
  const [quickHeads, setQuickHeads] = useState<string>("")
  // Rondjesoverzicht (scherm 2): welke rondjes staan open. Standaard alleen het laatste.
  const [openRounds, setOpenRounds] = useState<Set<string>>(new Set())
  // Onthoud vanwaar je naar het rondjesoverzicht ging, zodat "terug" daarheen keert.
  const [overviewBackTo, setOverviewBackTo] = useState<"hub" | "order">("hub")
  // Welke mode-kaart heeft zijn info-uitleg opengeklapt (via de i-knop).
  const [openInfo, setOpenInfo] = useState<"fair" | "quick" | null>(null)

  const [showAssignAll, setShowAssignAll] = useState(false)
  const [assignMode, setAssignMode] = useState<"drink" | "person">("person")
  const [showCups, setShowCups] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [cupsChecked, setCupsChecked] = useState(false)
  const [cupsTouched, setCupsTouched] = useState(false)
  const [amountDraft, setAmountDraft] = useState<string>("")
  const [payPot, setPayPot] = useState(false)
  const [payPersons, setPayPersons] = useState<string[]>([])
  const [payAmts, setPayAmts] = useState<Record<string, string>>({})
  const [potAmtDraft, setPotAmtDraft] = useState<string>("")
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [confirmDlg, setConfirmDlg] = useState<{ msg: string; yes: string; onYes: () => void; onNo?: () => void; no?: string; variant?: "danger" } | null>(null)
  const [notice, setNotice] = useState<string>("")
  // Zachte melding wanneer iemand nieuw aansluit. Vervaagt vanzelf; alleen de admin
  // krijgt een knop om het terug te draaien (voor als een vreemde de link kreeg).
  const [newcomer, setNewcomer] = useState<{ id: string; name: string } | null>(null)
  const knownPeople = useRef<Set<string>>(new Set())

  // edit-in-hub
  const [editOpen, setEditOpen] = useState(false)
  const [assignIdx, setAssignIdx] = useState<number | null>(null)
  const [editAssignMode, setEditAssignMode] = useState<"drink" | "person">("person")
  const [editCups, setEditCups] = useState(false)
  const [editPay, setEditPay] = useState(false)

  const priceOf = (d: Drink) => (pay === "coin" ? d.coins : d.price)
  const effDepositUnit: "eur" | "coin" = pay === "eur" ? "eur" : depositUnit
  const depositPerCupEur = effDepositUnit === "eur" ? depositValue : depositValue * coinValue
  const show = (eur: number) => (pay === "coin" && displayUnit === "coin" ? (eur / coinValue).toFixed(2).replace(".", ",") + " coins" : euro(eur))

  const contribOf = (pid: string) => potRounds.reduce((s, r) => s + (r.amounts[pid] || 0), 0)
  const potContribTotal = potRounds.reduce((s, r) => s + Object.values(r.amounts).reduce((a, b) => a + (b || 0), 0), 0)
  const potDraftTotal = Object.values(potDraft).reduce((a, b) => a + (b || 0), 0)
  const potSpent = rounds.reduce((s, r) => s + (r.potPart || 0), 0)
  const potRemaining = potContribTotal - potSpent
  const cardLossPer = potIsCard && potRemaining > 0.005 && people.length > 0 ? potRemaining / people.length : 0

  // ── live cart helpers ───────────────────────────────────────────────────────
  const aQty = (did: string, pid: string) => cart[did]?.[pid] ?? 0
  // Zorg dat er een open rondje bestaat vóór er een drankje in gaat. Lui aangemaakt:
  // pas wanneer iemand écht iets aantikt, niet bij het openen van het scherm.
  const openRoundRef = useRef<Promise<string | null> | null>(null)
  const addingPerson = useRef(false)
  const ensureRound = async (starter?: string | null): Promise<string | null> => {
    if (openRoundId) return openRoundId
    if (!groupId) return null
    if (openRoundRef.current) return openRoundRef.current   // twee snelle tikken = één rondje
    openRoundRef.current = (async () => {
      // party_open_round geeft het BESTAANDE open rondje terug als er al een is. Twee
      // gasten die tegelijk hun eerste drankje tikken, delen dus één rondje.
      const { data, error } = await supabase.rpc("party_open_round", { p_group: groupId, p_starter: starter ?? null })
      openRoundRef.current = null
      if (error || !data) { setNotice("Rondje starten mislukt."); return null }
      setOpenRoundId(data as string)
      if (starter) setStartedBy(starter)
      return data as string
    })()
    return openRoundRef.current
  }

  // "Ik ga halen": open het rondje met mezelf als haler. Iedereen die gescand heeft
  // ziet dan "X gaat halen" en kan zijn drankje aantikken.
  const startAsRunner = async () => {
    if (!meId) { setNotice(L.claimSeatFirst); return }
    await ensureRound(meId)
    setStartedBy(meId)
  }

  // "Ik haal het toch": neem een lopend rondje over. Het rondje en alle drankjes
  // blijven staan, alleen de haler wisselt.
  const takeOverRound = async () => {
    if (!meId || !openRoundId) return
    setStartedBy(meId)
    const { error } = await supabase.rpc("party_take_over_round", { p_round: openRoundId, p_starter: meId })
    if (error) { setNotice("Overnemen mislukt: " + error.message); if (groupId) loadParty(groupId) }
  }

  // "Toch niet ik": geef het rondje vrij. Een ander kan het dan oppakken.
  const releaseRunner = async () => {
    if (!openRoundId) return
    setStartedBy(null)
    const { error } = await supabase.rpc("party_take_over_round", { p_round: openRoundId, p_starter: null })
    if (error) { setNotice("Vrijgeven mislukt: " + error.message); if (groupId) loadParty(groupId) }
  }

  const runnerName = () => people.find((p) => p.id === startedBy)?.name ?? ""

  // ── Rondje opnemen: de tafel rondgaan ───────────────────────────────────────
  // Persoon per persoon. Je tikt drankjes aan die METEEN op die persoon staan (bump),
  // geen omweg via toewijzen. Zo blijft de toewijzing die al in je hoofd zit ("Tom?
  // pils") ook in de app staan — en werkt Fair Split achteraf zonder extra werk.
  const walkStart = () => { setWalkIdx(people[0] ? 0 : null) }
  const renderWalk = () => {
    if (walkIdx === null) return null
    const p = people[walkIdx]
    if (!p) { setWalkIdx(null); return null }
    const zijne = drinks.filter((d) => (cart[d.id]?.[p.id] ?? 0) > 0)
    const lijst = drinks.filter((d) => d.fav)
    // Hoeveel elke persoon al aantikte in dit rondje (voor de teller op de pill).
    const aantalVan = (pid: string) => drinks.reduce((a, d) => a + (cart[d.id]?.[pid] ?? 0), 0)
    return (
      <div style={S.overlay} onClick={() => setWalkIdx(null)}>
        <div style={{ ...S.sheet, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ ...S.h3, margin: 0, fontSize: 19 }}>{L.walkTable}</h3>
            <span onClick={() => setWalkIdx(null)} style={{ fontSize: 21, cursor: "pointer", color: "#8a7d55", lineHeight: 1 }}>✕</span>
          </div>

          {/* Namen als pills. Tik een naam aan om voor die persoon te bestellen. De
              groene teller toont wat elk al heeft — zo zie je wie je nog moet vragen. */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {people.map((pp, i) => {
              const geselecteerd = i === walkIdx
              const n = aantalVan(pp.id)
              return (
                <button key={pp.id} onClick={() => setWalkIdx(i)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 20, cursor: "pointer",
                    fontSize: 15, fontWeight: 800,
                    background: geselecteerd ? "#e08a00" : "#faf7ec",
                    color: geselecteerd ? "#fff" : "#4a3f1e",
                    border: geselecteerd ? "2px solid #e08a00" : "1.5px solid rgba(120,95,20,0.18)" }}>
                  {pp.name}
                  {n > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 9, fontSize: 13, background: geselecteerd ? "rgba(255,255,255,0.3)" : "#1f8a4c", color: "#fff" }}>{n}</span>}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 14.5, color: "#8a7d55", marginBottom: 10, fontWeight: 700 }}>{L.walkFor(p.name)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
            {lijst.map((d) => {
              const n = cart[d.id]?.[p.id] ?? 0
              return (
                <button key={d.id} onClick={() => bump(d.id, p.id, 1)}
                  style={{ position: "relative", textAlign: "left", padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                    background: n > 0 ? "rgba(31,138,76,0.1)" : "#faf7ec",
                    border: n > 0 ? "1.5px solid rgba(31,138,76,0.4)" : "1px solid rgba(120,95,20,0.12)" }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: "#4a3f1e" }}>{d.emoji} {d.name}</span>
                  {n > 0 && (
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...S.pill, background: "#1f8a4c", color: "#fff", fontSize: 14, padding: "2px 8px" }}>{n}</span>
                      <span onClick={(e) => { e.stopPropagation(); bump(d.id, p.id, -1) }}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 16, fontWeight: 800 }}>−</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {zijne.length > 0 && (
            <div style={{ fontSize: 14, color: "#6b5f3a", marginBottom: 12, lineHeight: 1.5 }}>
              {zijne.map((d) => `${cart[d.id][p.id]}× ${d.name}`).join(" · ")}
            </div>
          )}
          <button style={{ ...S.btnP, width: "100%" }} onClick={() => setWalkIdx(null)}>{L.walkDone}</button>
        </div>
      </div>
    )
  }

  // De haler-strook. Drie toestanden: niemand haalt, iemand anders haalt, jij haalt.
  const renderRunnerBar = () => {
    const ikHaal = !!meId && startedBy === meId
    if (!openRoundId && !startedBy) {
      // Nog geen rondje. Wie start, haalt — één handeling.
      return (
        <div style={{ ...S.card, background: "rgba(240,165,0,0.08)", border: "1.5px solid rgba(240,165,0,0.4)", textAlign: "center" }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "#8a5e0f", marginBottom: 10 }}>{L.whoGoes}</div>
          <button style={{ ...S.btnP, width: "100%" }} onClick={startAsRunner}>{L.imGoing}</button>
        </div>
      )
    }
    if (ikHaal) {
      return (
        <div style={{ ...S.card, background: "rgba(31,138,76,0.08)", border: "1.5px solid rgba(31,138,76,0.35)" }}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1f6b3a" }}>{L.youAreGoing}</span>
            <button style={{ ...S.btn, fontSize: 13.5, fontWeight: 700, padding: "6px 11px" }} onClick={releaseRunner}>{L.notMeRunner}</button>
          </div>
        </div>
      )
    }
    if (startedBy) {
      // Iemand anders haalt. Informatie — overnemen mag, maar rustig.
      return (
        <div style={{ ...S.card, background: "rgba(240,165,0,0.08)", border: "1.5px solid rgba(240,165,0,0.4)" }}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: "#8a5e0f" }}>{L.xIsGoing(runnerName())}</span>
            <button style={{ ...S.btn, fontSize: 13.5, fontWeight: 700, padding: "6px 11px" }} onClick={takeOverRound}>{L.iGoInstead}</button>
          </div>
        </div>
      )
    }
    // Er loopt een rondje, maar niemand claimde de haler-rol (bv. admin startte het).
    // Geen verwarrende "wie haalt?"-vraag herhalen — gewoon niks tonen.
    return null
  }

  // De optelling gebeurt in Postgres (party_bump), niet hier. Twee gasten die tegelijk
  // hetzelfde drankje aantikken zouden elkaar anders overschrijven.
  const bump = async (did: string, pid: string, delta: number) => {
    setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: Math.max(0, (c[did]?.[pid] ?? 0) + delta) } }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: pid, p_drink: did, p_delta: delta })
    if (error) { setNotice("Opslaan mislukt: " + error.message); loadParty(groupId) }
  }
  const bumpAnon = async (did: string, delta: number) => {
    setCartAnon((a) => ({ ...a, [did]: Math.max(0, (a[did] ?? 0) + delta) }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: null, p_drink: did, p_delta: delta })
    if (error) { setNotice("Opslaan mislukt: " + error.message); loadParty(groupId) }
  }
  const assignFromAnon = async (did: string, pid: string) => {
    if ((cartAnon[did] ?? 0) <= 0) return
    setCartAnon((a) => ({ ...a, [did]: Math.max(0, (a[did] ?? 0) - 1) }))
    setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: (c[did]?.[pid] ?? 0) + 1 } }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_assign", { p_group: groupId, p_round: rid, p_drink: did, p_from: null, p_to: pid })
    if (error) { setNotice("Toewijzen mislukt: " + error.message); loadParty(groupId) }
  }
  const unassignCart = async (did: string, pid: string) => {
    if ((cart[did]?.[pid] ?? 0) <= 0) return
    setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: Math.max(0, (c[did]?.[pid] ?? 0) - 1) } }))
    setCartAnon((a) => ({ ...a, [did]: (a[did] ?? 0) + 1 }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_assign", { p_group: groupId, p_round: rid, p_drink: did, p_from: pid, p_to: null })
    if (error) { setNotice("Losmaken mislukt: " + error.message); loadParty(groupId) }
  }
  const setEachOne = async (did: string) => {
    const huidig = cart[did] ?? {}
    setCart((c) => ({ ...c, [did]: Object.fromEntries(people.map((p) => [p.id, 1])) }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    for (const p of people) {
      const delta = 1 - (huidig[p.id] ?? 0)
      if (delta !== 0) await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: p.id, p_drink: did, p_delta: delta })
    }
    loadParty(groupId)
  }
  const eachOne = (did: string) => { const hi = people.filter((p) => (cart[did]?.[p.id] ?? 0) >= 2).map((p) => p.name); if (hi.length > 0) { setConfirmDlg({ msg: L.eachOneConfirm(hi.join(" en "), hi.length > 1), yes: L.yesEachOne, onYes: () => { setEachOne(did); setConfirmDlg(null) } }) } else setEachOne(did) }
  const drinkTotal = (did: string) => Object.values(cart[did] ?? {}).reduce((a, b) => a + b, 0) + (cartAnon[did] ?? 0)
  const roundItems = useMemo(() => drinks.reduce((s, d) => s + drinkTotal(d.id), 0), [cart, cartAnon, drinks]) // eslint-disable-line
  const resumeRound = () => { if (blockIfUnpaid()) return; setActiveCat(catsPresent[0]); setView("order") }
  const unfinishedRound = roundItems > 0 && rounds.length < roundNr
  // Snelle rondjes kennen geen betalers: daar telt een rondje als afgehandeld zodra er
  // een bedrag op staat én je dat bewust bevestigde of oversloeg. Enkel een bedrag
  // intikken volstaat dus niet — anders kan je halverwege wegwandelen.
  const roundIsPaid = (r: Round) => settle
    ? (r.amount || 0) > 0.005 && ((r.potPart || 0) > 0.005 || Object.values(r.payers || {}).some((a) => (a || 0) > 0.005))
    : true
  // Het laatste rondje van een snelle avond is pas "klaar" na bevestigen of overslaan.
  const laatsteRondjeKlaar = () => settle || lastRoundHandled || rounds.length === 0
  const unpaidIdx = () => {
    const i = rounds.findIndex((r) => !roundIsPaid(r))
    if (i >= 0) return i
    // Alles heeft een bedrag, maar het laatste is nog niet bevestigd? Dan blijft dat open.
    return laatsteRondjeKlaar() ? -1 : rounds.length - 1
  }
  const paidCount = rounds.filter(roundIsPaid).length
  const blockIfUnpaid = () => { const i = unpaidIdx(); if (i < 0) return false; setNotice(settle ? L.roundUnpaid(i + 1) : L.finishRoundFirst); if (settle) setView("confirmed"); return true }
  const unassignedTotal = useMemo(() => drinks.reduce((s, d) => s + (cartAnon[d.id] ?? 0), 0), [cartAnon, drinks]) // eslint-disable-line
  const pickedUpOf = (pid: string) => drinks.reduce((a, d) => a + (d.cup ? aQty(d.id, pid) : 0), 0)

  // ── per-rondje bewerk-helpers (hub) ─────────────────────────────────────────
  // Een AFGESLOTEN of onbetaald rondje bijstellen doet enkel de admin. Daar is geen
  // gelijktijdigheid, dus mag de hele rij in één keer weg. (Het open rondje niet —
  // dat gaat via party_bump, want daar tikt iedereen tegelijk.)
  const persistRound = (r: Round) => {
    supabase.from("party_rounds")
      .update({ amount: r.amount, pot_part: r.potPart, payers: r.payers, gave_back: r.gaveBack })
      .eq("id", r.id)
      .then(({ error }) => { if (error) setNotice("Opslaan mislukt: " + error.message) })
  }
  // Drankjes van een afgesloten rondje verplaatsen: wél per rij, want die zitten in
  // party_round_items en niet in de jsonb.
  const persistItem = async (r: Round, did: string, pid: string | null, delta: number) => {
    if (!groupId) return
    const { error } = await supabase.rpc("party_bump", { p_group: groupId, p_round: r.id, p_person: pid, p_drink: did, p_delta: delta })
    if (error) setNotice("Opslaan mislukt: " + error.message)
  }

  // Snelle rondjes: het totaal in de pot volgt uit "iedereen legt X in" × aantal
  // personen. Zo klopt het opgeslagen totaal, of je nu het bedrag of het aantal wijzigt.
  useEffect(() => {
    if (settle) return
    const totaal = potPerMan * Math.max(1, headcount)
    setPotDraft((c) => (c.pot === totaal ? c : { pot: totaal }))
  }, [settle, potPerMan, headcount])

  // Wie een bestaand rondje bijstelt (bedrag, betaler, bekers) markeert het als vuil;
  // dit effect schrijft het daarna weg. Zo hoeft geen enkele mutator databank-logica
  // te kennen, en persisteren we altijd de toestand NA de wijziging.
  const [dirtyRound, setDirtyRound] = useState<number | null>(null)
  useEffect(() => {
    if (dirtyRound == null) return
    const r = rounds[dirtyRound]
    if (r) persistRound(r)
    setDirtyRound(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyRound, rounds])

  const rBump = (idx: number, did: string, pid: string, delta: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, orders: { ...r.orders, [did]: { ...(r.orders[did] ?? {}), [pid]: Math.max(0, (r.orders[did]?.[pid] ?? 0) + delta) } } } : r)); persistItem(rounds[idx], did, pid, delta); setDirtyRound(idx) }
  const rBumpAnon = (idx: number, did: string, delta: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, anon: { ...r.anon, [did]: Math.max(0, (r.anon[did] ?? 0) + delta) } } : r)); persistItem(rounds[idx], did, null, delta); setDirtyRound(idx) }
  const rSetGaveBack = (idx: number, pid: string, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, gaveBack: { ...r.gaveBack, [pid]: Math.max(0, v) } } : r)); setDirtyRound(idx) }
  const rUnassign = (idx: number, did: string, pid: string) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, orders: { ...r.orders, [did]: { ...(r.orders[did] ?? {}), [pid]: Math.max(0, (r.orders[did]?.[pid] ?? 0) - 1) } }, anon: { ...r.anon, [did]: (r.anon[did] ?? 0) + 1 } } : r)); persistItem(rounds[idx], did, pid, -1); persistItem(rounds[idx], did, null, 1); setDirtyRound(idx) }
  const rAssignFromAnon = (idx: number, did: string, pid: string) => { if ((rounds[idx]?.anon[did] ?? 0) > 0) { rBumpAnon(idx, did, -1); rBump(idx, did, pid, 1) } }
  const potAvailFor = (idx: number) => potContribTotal - (potSpent - (rounds[idx]?.potPart || 0))
  const rRedistribute = (r: Round, idx: number, usePot: boolean, persons: string[], amount: number): Round => {
    const n = persons.length + (usePot ? 1 : 0)
    if (n === 0 || amount <= 0) return { ...r, amount, payers: {}, potPart: 0 }
    const avail = Math.max(0, potAvailFor(idx))
    let potPart = 0, rest = amount
    if (usePot) { potPart = Math.min(amount / n, avail); rest = amount - potPart }
    const per = persons.length ? rest / persons.length : 0
    const payers: Record<string, number> = {}
    persons.forEach((pid) => (payers[pid] = per))
    return { ...r, amount, payers, potPart }
  }
  const rSetAmount = (idx: number, v: number) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const persons = Object.keys(r.payers || {}); const usePot = (r.potPart || 0) > 0; return rRedistribute(r, idx, usePot, persons, v) })); setDirtyRound(idx) }
  const rTogglePot = (idx: number) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const persons = Object.keys(r.payers || {}); const usePot = !((r.potPart || 0) > 0); if (usePot && potAvailFor(idx) <= 0.005) { setNotice(L.potEmpty(potIsCard)); return r } return rRedistribute(r, idx, usePot, persons, r.amount) })); setDirtyRound(idx) }
  const rSetPayerAmt = (idx: number, pid: string, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, payers: { ...(r.payers || {}), [pid]: Math.max(0, v) } } : r)); setDirtyRound(idx) }
  const rSetPotAmt = (idx: number, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, potPart: Math.max(0, Math.min(v, Math.max(0, potAvailFor(idx)))) } : r)); setDirtyRound(idx) }
  // Snelle rondjes: alleen het rondjebedrag zetten, zonder de Fair-Split payer-verdeling.
  // Het pot-deel (potPart) beheren we los via rSetPotAmt (handmatig, geklemd op de pot).
  const qSetAmount = (idx: number, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, amount: v } : r)); setDirtyRound(idx) }
  // Snelle rondjes: rondje afsluiten en naar het overzicht. "skip" = zonder bedrag; als
  // er dan tóch al iets ingevuld staat, waarschuwen zodat je het niet per ongeluk weggooit.
  const closeQuickRound = (skip: boolean) => {
    const idx = rounds.length - 1
    const r = rounds[idx]
    const heeftIets = r && ((r.amount || 0) > 0.005 || (r.potPart || 0) > 0.005)
    // Overslaan = géén bedrag. Wis wat er stond, zodat het overzicht "geen bedrag" toont
    // en de pot niet onterecht wordt aangesproken.
    const doeOverslaan = () => {
      setRounds((rs) => rs.map((rr, i) => i === idx ? { ...rr, amount: 0, potPart: 0 } : rr))
      if (r) setDirtyRound(idx)
      setLastRoundHandled(true); setPayVia("self"); setOverviewBackTo("hub"); setView("roundsOverview")
    }
    if (skip && heeftIets) {
      setConfirmDlg({ variant: "danger", msg: L.skipCostWarn, yes: L.skipCostYes, onYes: () => { setConfirmDlg(null); doeOverslaan() } })
    } else {
      doeOverslaan()
    }
  }
  // Snelle rondjes: bevestig het betaalde bedrag via de gekozen bron (zelf of pot) en
  // sluit het rondje af. Bij "pot" gaat het bedrag (geklemd op wat er in de pot zit) als
  // potPart; bij "zelf" telt het gewoon als rondjebedrag zonder pot-aandeel.
  const confirmQuickPay = () => {
    const idx = rounds.length - 1
    const r = rounds[idx]
    const bedrag = r?.amount || 0
    if (payVia === "pot") {
      const beschikbaar = Math.max(0, potAvailFor(idx))
      // Binair: een rondje komt volledig uit de pot, of je betaalt het volledig zelf.
      if (bedrag > beschikbaar + 0.005) { setNotice(L.potShortTitle); return }
      rSetPotAmt(idx, bedrag)
    } else {
      rSetPotAmt(idx, 0)
    }
    setLastRoundHandled(true); setPayVia("self"); setOverviewBackTo("hub"); setView("roundsOverview")
  }
  const rPaidSum = (r: Round) => (r.potPart || 0) + Object.values(r.payers || {}).reduce((a, b) => a + (b || 0), 0)
  const rTogglePayer = (idx: number, pid: string) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const cur = Object.keys(r.payers || {}); const persons = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]; const usePot = (r.potPart || 0) > 0; return rRedistribute(r, idx, usePot, persons, r.amount) })); setDirtyRound(idx) }

  // ── afgeleide bekers (uit rounds) ───────────────────────────────────────────
  const roundPicked = (r: Round, pid: string) => drinks.reduce((a, d) => a + (d.cup ? (r.orders[d.id]?.[pid] ?? 0) : 0), 0)
  const cupsBal = (pid: string) => rounds.reduce((s, r) => s + (roundPicked(r, pid) - (r.gaveBack[pid] || 0)), 0)

  const isGuestDefault = (name: string) => /^Gast \d+$/.test(name.trim())
  // Een plaats bijzetten = een rij in party_people. Leeg van naam: vrij tot iemand
  // ze claimt (de admin door ze te benoemen, een gast door de link te openen).
  // Het plaatsnummer wordt in Postgres bepaald, niet hier. Berekende je het in de
  // browser, dan lezen twee snelle tikken dezelfde lijst, komen ze op hetzelfde nummer
  // uit, en weigert de unique-index de tweede: "duplicate key value".
  const addPerson = async () => {
    if (!groupId || addingPerson.current) return
    addingPerson.current = true
    const { error } = await supabase.rpc("party_add_person", { p_group: groupId, p_name: "" })
    addingPerson.current = false
    if (error) { setNotice("Persoon toevoegen mislukt: " + error.message); return }
    loadParty(groupId)
  }
  const renamePerson = async (id: string, name: string) => {
    // Optimistisch: het invoerveld moet meteen meebewegen, niet pas na de rondreis.
    setPeople((ps) => ps.map((x) => x.id === id ? { ...x, name } : x))
    const clean = isGuestDefault(name) ? "" : name.trim()
    const { error } = await supabase.from("party_people").update({ name: clean }).eq("id", id)
    if (error) setNotice("Naam opslaan mislukt: " + error.message)
  }
  const personHasDrinks = (pid: string) => rounds.some((r) => Object.values(r.orders).some((o) => (o?.[pid] ?? 0) > 0)) || Object.values(cart).some((o) => (o?.[pid] ?? 0) > 0)
  // Merk op wanneer er iemand bijkomt die zichzelf aanmeldde. De eerste lading (bij
  // het laden van de groep) telt niet als "nieuw" — anders krijg je een melding voor
  // iedereen die er al was.
  const seededNewcomer = useRef(false)
  // Onthoud wie er al geclaimd was, zodat we een NIEUWE aanmelding herkennen — of het
  // nu een laatkomer is die een plaats bijzette, of iemand die een bestaande vrije
  // plaats claimde via de QR. Beide zijn "iemand meldt zich aan".
  const claimedSeats = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (people.length === 0) return
    if (!seededNewcomer.current) {
      people.forEach((p) => { knownPeople.current.add(p.id); if (p.claimedBy) claimedSeats.current.add(p.id) })
      seededNewcomer.current = true
      return
    }
    for (const p of people) {
      const isNieuwePersoon = !knownPeople.current.has(p.id)
      const netGeclaimd = !!p.claimedBy && !claimedSeats.current.has(p.id)
      knownPeople.current.add(p.id)
      if (p.claimedBy) claimedSeats.current.add(p.id)
      // Meld wie zich aanmeldt: een nieuwe persoon met een claim, óf een bestaande
      // plaats die net geclaimd werd. Niet mezelf.
      if (p.id !== meId && p.claimedBy && (isNieuwePersoon || netGeclaimd)) {
        setNewcomer({ id: p.id, name: p.name })
        setTimeout(() => setNewcomer((c) => (c && c.id === p.id ? null : c)), 7000)
      }
    }
  }, [people, meId])

  const removePerson = (id: string) => { const pp = people.find((x) => x.id === id); if (personHasDrinks(id)) { setNotice(L.personHasDrinks(pp?.name || L.thisPerson)); return } supabase.from("party_people").delete().eq("id", id).then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message) }) }
  const removeLastPerson = () => { const last = people[people.length - 1]; if (!last) return; removePerson(last.id) }

  // ── Laden & live houden ─────────────────────────────────────────────────────
  // Eén select per tabel, enkel de kolommen die we tonen. Zelfde aanpak als Table:
  // realtime doet het echte werk, met een afkoelperiode zodat een reeks tikken
  // (iedereen bestelt tegelijk) niet tientallen herladingen uitlokt.
  const loadParty = useCallback(async (gid: string) => {
    const [{ data: g }, { data: pp }, { data: rr }, { data: ii }, { data: pt }] = await Promise.all([
      supabase.from("party_groups").select("id,name,invite_code,owner_id,pay,coin_value,deposit_on,deposit_value,deposit_unit,pot_on,pot_is_card,finalized,custom_drinks,coin_prices,settle").eq("id", gid).single(),
      supabase.from("party_people").select("id,seat,name,claimed_by,self_joined,settle_with").eq("group_id", gid).order("seat"),
      supabase.from("party_rounds").select("id,seq,status,amount,pot_part,payers,gave_back,members,started_by,proposal,headcount").eq("group_id", gid).order("seq"),
      supabase.from("party_round_items").select("round_id,person_id,drink_key,qty").eq("group_id", gid),
      supabase.from("party_pot").select("id,seq,amounts,is_card,card_payers").eq("group_id", gid).order("seq"),
    ])
    if (!mounted.current) return
    if (g) {
      setGroupName(g.name || "")
      setInviteCode(g.invite_code)
      setOwnerDevice(g.owner_id)
      setPay(g.pay as "eur" | "coin")
      setCoinValue(Number(g.coin_value))
      setDepositOn(!!g.deposit_on)
      setDepositValue(Number(g.deposit_value))
      setDepositUnit(g.deposit_unit as "eur" | "coin")
      setPotIsCard(!!g.pot_is_card)
      setSettle(g.settle !== false)
      setCustomDrinks(((g.custom_drinks ?? []) as Custom[]))
      setCoinPrices(((g.coin_prices ?? {}) as Record<string, number>))
    }
    // Lege naam = vrije plaats. In de UI heet die "Gast N", zodat de bestaande
    // placeholder-logica ongemoeid blijft.
    setPeople((pp || []).map((r) => ({
      id: r.id, seat: r.seat,
      // named = de admin (of de gast zelf) gaf een echte naam. Een naamloze plaats
      // heet "Gast N", zodat de bestaande placeholder-logica blijft werken.
      named: !!(r.name || "").trim(),
      name: (r.name || "").trim() || `Gast ${r.seat}`,
      claimedBy: r.claimed_by, selfJoined: !!r.self_joined,
      settleWith: r.settle_with,
    })))

    // Drankjes per rondje uitsorteren: toegewezen in `orders`, de rest in `anon`.
    const perRound: Record<string, { orders: Assign; anon: Anon }> = {}
    for (const it of ii || []) {
      const b = (perRound[it.round_id] ??= { orders: {}, anon: {} })
      if (it.person_id) {
        (b.orders[it.drink_key] ??= {})[it.person_id] = it.qty
      } else {
        b.anon[it.drink_key] = it.qty
      }
    }

    const alle = (rr || []).map((r) => ({
      id: r.id as string, seq: r.seq as number, status: r.status as "open" | "pending" | "closed",
      orders: perRound[r.id]?.orders ?? {}, anon: perRound[r.id]?.anon ?? {},
      payers: (r.payers ?? {}) as Record<string, number>,
      amount: Number(r.amount ?? 0), potPart: Number(r.pot_part ?? 0),
      gaveBack: (r.gave_back ?? {}) as Record<string, number>,
      members: ((r.members ?? []) as string[]),
      startedBy: (r.started_by ?? null) as string | null,
      proposal: ((r.proposal ?? {}) as Proposal),
      headcount: Number(r.headcount ?? 2),
    }))

    // Het OPEN rondje is de mand; de rest is historiek.
    const open = alle.find((r) => r.status === "open") ?? null
    setOpenRoundId(open?.id ?? null)
    setStartedBy(open?.startedBy ?? null)
    setCart(open?.orders ?? {})
    setCartAnon(open?.anon ?? {})
    // Bekerwerk dat al ingevuld was, blijft staan bij een refresh of op een tweede toestel.
    if (open && Object.keys(open.gaveBack).length > 0) setGaveBackDraft(open.gaveBack)
    const gedaan = alle.filter((r) => r.status !== "open")
    setRounds(gedaan)
    setRoundNr(open ? open.seq : Math.max(1, gedaan.length))
    // Huidig aantal = dat van het laatst bekende rondje (open of laatste afgeronde). Zo
    // hervat een geladen groep met het juiste aantal, in plaats van opnieuw "ongekozen".
    const laatstBekend = open ?? gedaan[gedaan.length - 1]
    if (laatstBekend) setHeadcount(laatstBekend.headcount || 2)

    setPotRounds((pt || []).map((r) => ({
      id: r.id as string, seq: r.seq as number,
      amounts: (r.amounts ?? {}) as Record<string, number>,
    })))
    const kaart = (pt || []).find((r) => r.is_card)
    if (kaart) setCardPayers(((kaart.card_payers ?? []) as string[]))
    // Geef terug hoe "vol" de groep is, zodat de aanroeper kan beslissen waar je landt:
    // een verse groep zonder rondjes stuur je naar het bestelscherm, niet naar een lege hub.
    return { rondjes: gedaan.length, heeftOpen: !!open, settle: g ? g.settle !== false : true }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Binnenkomen. Twee wegen:
  //   ?code=XXXXXX  -> een gast opent de uitnodiging
  //   geen code     -> de admin ververste of kwam terug. Zonder dit is hij bij een
  //                    simpele refresh zijn groep kwijt.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    const vorige = typeof window !== "undefined" ? localStorage.getItem("rundo_party_group") : null
    ;(async () => {
      if (code) {
        const { data, error } = await supabase.from("party_groups").select("id").eq("invite_code", code.toUpperCase()).maybeSingle()
        if (error || !data) { setNotice(L.badCode); setBooting(false); return }
        setGroupId(data.id)
        await loadParty(data.id)
        setBooting(false)
        return
      }
      if (vorige) {
        // Optie A: we openen de laatste groep NIET automatisch meer. Je landt op het
        // keuzescherm en kiest zelf: verdergaan met een opgeslagen groep, of een nieuwe
        // starten (eventueel in een andere modus). De groep blijft bestaan en verschijnt
        // in de opgeslagen-groepen-lijst. We checken enkel of hij nog bestaat; zo niet,
        // ruimen we de verwijzing op.
        const { data } = await supabase.from("party_groups").select("id").eq("id", vorige).maybeSingle()
        if (!data) localStorage.removeItem("rundo_party_group") // groep opgeruimd of gewist
      }
      setBooting(false)
    })()
  }, [loadParty])

  // Haal alle groepen op waar dit toestel bij hoort: zelf gemaakt (owner_id) of via QR
  // aan deelgenomen (een party_people-rij met claimed_by = dit toestel). We voegen ze
  // samen, ontdubbelen op id, en sorteren op recentheid (nieuwste eerst).
  const loadSavedGroups = useCallback(async () => {
    const dev = me.current
    const [eigen, gast] = await Promise.all([
      supabase.from("party_groups").select("id,name,last_active,finalized,owner_id").eq("owner_id", dev),
      supabase.from("party_people").select("group_id").eq("claimed_by", dev),
    ])
    const map = new Map<string, SavedGroup>()
    for (const g of eigen.data ?? []) {
      map.set(g.id, { id: g.id, name: g.name || "", last_active: g.last_active, finalized: !!g.finalized, owned: true })
    }
    // Gast-groepen die nog niet als eigen bekend zijn, apart ophalen voor hun details.
    const gastIds = [...new Set((gast.data ?? []).map((r) => r.group_id as string))].filter((id) => !map.has(id))
    if (gastIds.length > 0) {
      const { data: extra } = await supabase.from("party_groups").select("id,name,last_active,finalized").in("id", gastIds)
      for (const g of extra ?? []) {
        map.set(g.id, { id: g.id, name: g.name || "", last_active: g.last_active, finalized: !!g.finalized, owned: false })
      }
    }
    const lijst = [...map.values()].sort((a, b) => (b.last_active || "").localeCompare(a.last_active || ""))
    if (mounted.current) setSavedGroups(lijst)
  }, [])

  // Bij het openen (als je op het startscherm bent) de opgeslagen groepen laden.
  useEffect(() => {
    if (!booting && view === "start") loadSavedGroups()
  }, [booting, view, loadSavedGroups])

  // Een opgeslagen groep heropenen vanaf het startscherm.
  const openSavedGroup = async (id: string) => {
    setBusy(true)
    localStorage.setItem("rundo_party_group", id)
    setGroupId(id)
    const res = await loadParty(id)
    setBusy(false)
    if (res && res.rondjes === 0 && !res.heeftOpen) {
      // Verse groep: nog nooit een rondje. Terug naar de kaders zodat je de modus kan
      // (her)bevestigen of alsnog wisselen. De al-gekozen modus staat voorgeselecteerd,
      // en resumeGroupId zorgt dat "Beginnen" DEZE groep voortzet (geen nieuwe maakt).
      setResumeGroupId(id)
      setBpSettle(res.settle)
      setView("start")
    } else {
      setResumeGroupId(null)
      setView("hub")
    }
  }

  // Een eigen opgeslagen groep verwijderen (met bevestiging). Cascade in de database
  // ruimt de rondjes, drankjes, personen en pot mee op.
  const deleteSavedGroup = (g: SavedGroup) => {
    setConfirmDlg({
      msg: L.delGroupConfirm(g.name || L.autoName()),
      yes: L.delGroupYes, no: L.cancel, variant: "danger",
      onYes: async () => {
        setConfirmDlg(null)
        const { error } = await supabase.from("party_groups").delete().eq("id", g.id)
        if (error) { setNotice("Verwijderen mislukt: " + error.message); return }
        if (localStorage.getItem("rundo_party_group") === g.id) localStorage.removeItem("rundo_party_group")
        setSavedGroups((prev) => prev.filter((x) => x.id !== g.id))
      },
    })
  }

  // Realtime, met twee zuinigheidsmaatregelen — een feest van 8 mensen met telefoons
  // in de broekzak mag geen quota opeten.
  //
  //  1. AFKOELEN: het eerste seintje halen we meteen op (voelt instant), daarna
  //     bundelen we 600 ms. Terwijl iedereen zit te tikken zou elke telefoon anders
  //     tientallen keren per minuut de hele groep herladen.
  //
  //  2. SLAAPSTAND: ligt de telefoon in de zak (tab verborgen), dan sluiten we het
  //     kanaal na 2 minuten. Bij terugkeer heropenen we en halen we één keer alles op.
  //     Zonder dit blijven acht slapende telefoons de hele avond meeluisteren.
  useEffect(() => {
    if (!groupId) return
    let active = true, cooling = false, pending = false
    let cool: ReturnType<typeof setTimeout> | null = null
    let slaap: ReturnType<typeof setTimeout> | null = null
    let ch: ReturnType<typeof supabase.channel> | null = null

    const reload = () => {
      if (!active) return
      if (cooling) { pending = true; return }
      cooling = true
      loadParty(groupId)
      cool = setTimeout(() => { cooling = false; if (pending) { pending = false; reload() } }, 600)
    }

    const open = () => {
      if (ch) return
      ch = maakKanaal()
    }
    const sluit = () => {
      if (!ch) return
      supabase.removeChannel(ch)
      ch = null
    }
    const zichtbaar = () => {
      if (slaap) { clearTimeout(slaap); slaap = null }
      if (document.visibilityState === "visible") {
        open()
        reload()            // bijwerken wat we misten terwijl we sliepen
      } else {
        slaap = setTimeout(sluit, 120000)
      }
    }
    document.addEventListener("visibilitychange", zichtbaar)

    const maakKanaal = () => {
      const c = supabase.channel(`party-${groupId}`)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_groups", filter: `id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_people", filter: `group_id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_rounds", filter: `group_id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_round_items", filter: `group_id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_pot", filter: `group_id=eq.${groupId}` }, reload)
      c.subscribe()
      return c
    }

    open()
    return () => {
      active = false
      if (cool) clearTimeout(cool)
      if (slaap) clearTimeout(slaap)
      document.removeEventListener("visibilitychange", zichtbaar)
      sluit()
    }
  }, [groupId, loadParty])

  // ── Groep aanmaken (admin) ──────────────────────────────────────────────────
  const createGroup = async (fallbackNaam?: string, wilSettle: boolean = true) => {
    // Geen naam meer nodig bij de start: leeg laten valt terug op "Rondje + datum".
    // De naam blijft achteraf aanpasbaar via ⚙️ Groep.
    const getypt = groupName.trim() || fallbackNaam?.trim() || ""
    let naam = getypt || L.autoName()
    // Zelf getypt en al in gebruik? Dan waarschuwen. Automatisch gekozen? Dan tellen we
    // gewoon door (Rondje 20 juli 2, 3 …) zodat je nooit vastloopt op de startknop.
    if (getypt) {
      const dubbel = savedGroups.find((g) => !g.finalized && g.name.trim().toLowerCase() === naam.toLowerCase())
      if (dubbel) { setNotice(L.dupGroupName(naam)); return }
    } else {
      const bestaat = (n: string) => savedGroups.some((g) => !g.finalized && g.name.trim().toLowerCase() === n.toLowerCase())
      if (bestaat(naam)) { let i = 2; while (bestaat(`${naam} ${i}`)) i++; naam = `${naam} ${i}` }
    }
    if (busy) return
    setBusy(true)
    // Botsende codes zijn zeldzaam, maar niet onmogelijk (unique index vangt ze).
    for (let poging = 0; poging < 5; poging++) {
      const code = makeCode()
      const { data, error } = await supabase.from("party_groups")
        .insert([{ name: naam, invite_code: code, owner_id: me.current, settle: wilSettle }])
        .select("id,invite_code").single()
      if (!error && data) {
        localStorage.setItem("rundo_party_group", data.id)
        setGroupId(data.id)
        setInviteCode(data.invite_code)
        setOwnerDevice(me.current)
        // De admin maakte de groep en zit dus aan tafel: meteen Gast 1, geclaimd door
        // dit toestel. Zo hoeft de admin zichzelf niet meer aan te duiden ("welke ben
        // jij?" verdwijnt voor hem), en telt hij gewoon mee als persoon. Drinkt hij
        // niets, dan staat hij op nul — net als ieder ander die niets nam.
        const { data: pid } = await supabase.rpc("party_add_person", { p_group: data.id, p_name: "" })
        if (pid) await supabase.from("party_people").update({ claimed_by: me.current }).eq("id", pid as string)
        setBusy(false)
        // Gewoon rondjes heeft geen personen-setup nodig — meteen naar bestellen.
        // Fair Split gaat wél eerst langs de setup (personen, QR).
        if (!wilSettle) {
          setActiveCat(catsPresent[0])
          setView("order")
        } else {
          setView("setup")
        }
        loadParty(data.id)
        return
      }
      if (error && !/duplicate|unique/i.test(error.message)) {
        setNotice("Groep aanmaken mislukt: " + error.message); setBusy(false); return
      }
    }
    setNotice(L.createFailed)
    setBusy(false)
  }

  // Nieuwe start-flow: op het startscherm kies je EERST de aanpak (Fair Split of gewoon
  // rondjes) en de groepsnaam, en "Starten" doet allebei. De modus gaat mee in de insert
  // (createGroup), niet via persistSettings — de groep bestaat op dit punt nog niet.
  const startWithMode = async (fallbackNaam?: string) => {
    if (bpSettle === null) return
    const wilSettle = bpSettle === true
    // Geen naam of aantal personen meer vragen bij de start: je duikt meteen in de
    // drankjes. De naam valt terug op "Rondje + datum", het aantal leidt de app later
    // zelf af uit de bestelde drankjes (en blijft aanpasbaar in het rondjesoverzicht).
    setOnboardedOnce(true)
    if (!wilSettle) {
      setSettle(false)
      setPotChosen(false); setDepositOn(false); setPay("eur")
    } else {
      setSettle(true)
    }
    // Hervat je een bestaande verse groep? Dan de modus op die groep bijwerken en er
    // meteen in duiken — geen nieuwe groep aanmaken.
    if (resumeGroupId) {
      setSettle(wilSettle)
      const naam = groupName.trim()
      await supabase.from("party_groups").update({ settle: wilSettle, ...(naam ? { name: naam } : {}), last_active: new Date().toISOString() }).eq("id", resumeGroupId)
      const rid = resumeGroupId
      setResumeGroupId(null)
      if (!wilSettle) { setActiveCat(catsPresent[0]); setView("order") }
      else setView("setup")
      loadParty(rid)
      return
    }
    await createGroup(fallbackNaam, wilSettle)
  }

  // Een plaats vrijgeven. Nodig als iemand op de verkeerde naam tikte, of als de
  // admin een plaats wil doorgeven. De naam blijft staan — enkel de koppeling met
  // het toestel verdwijnt.
  const releaseSeat = async (personId: string) => {
    const { error } = await supabase.from("party_people")
      .update({ claimed_by: null, self_joined: false }).eq("id", personId)
    if (error) { setNotice("Vrijgeven mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }

  // Een plaats claimen: de gast (of de admin) zegt "dit ben ik".
  // Laatkomer: groep is vol, dus we zetten in Postgres een plaats bij en claimen ze
  // meteen (party_join_new_seat, onder slot). Daarna gedraagt de gast zich als elke
  // andere aangemelde persoon.
  const joinAsLatecomer = async (naam: string) => {
    if (!groupId) return
    if (!naam.trim()) { setNotice(L.fillNameFirst); return }
    setBusy(true)
    const { data, error } = await supabase.rpc("party_join_new_seat", { p_group: groupId, p_device: me.current, p_name: naam.trim() })
    setBusy(false)
    if (error || !data) { setNotice("Aansluiten mislukt: " + (error?.message ?? "")); return }
    loadParty(groupId)
  }

  const claimSeat = async (personId: string, naam: string) => {
    if (busy) return
    setBusy(true)
    // Voorwaarde op claimed_by: wie een halve seconde te laat is, krijgt netjes
    // te horen dat de plaats net weg is, in plaats van iemand te overschrijven.
    const { data, error } = await supabase.from("party_people")
      .update({ name: naam.trim(), claimed_by: me.current, self_joined: !isAdmin })
      .eq("id", personId).is("claimed_by", null).select("id")
    setBusy(false)
    if (error) { setNotice("Aanmelden mislukt: " + error.message); return }
    if (!data || data.length === 0) { setNotice(L.seatTaken); return }
    if (groupId) loadParty(groupId)
  }
  const setEveryoneAmt = (v: number) => setPotDraft(Object.fromEntries(people.map((p) => [p.id, v])))
  const resetPotDraft = () => { setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft("") }
  // Een inleg meteen wegschrijven en de pot herladen. Apart van closePot, zodat het
  // opslaan niet afhangt van het sluiten van het venster.
  const saveQuickPot = async () => {
    const totaal = settle ? potDraftTotal : potPerMan * Math.max(1, headcount)
    if (totaal <= 0.001) { setNotice(L.potFillAmount); return }
    if (!groupId) return
    const bedragen = settle ? potDraft : { pot: totaal }
    const { error } = await supabase.rpc("party_add_pot", { p_group: groupId, p_amounts: bedragen, p_is_card: potIsCard, p_payers: cardPayers })
    if (error) { setNotice("Inleg opslaan mislukt: " + error.message); return }
    setPotDraft({}); setPotPerMan(0); setEveryoneChoice(null); setEveryoneDraft("")
    setPotBuilderOpen(false)
    setPotJustAdded(true)
    await loadParty(groupId)
  }
  const closePot = () => {
    const added = (editPotId === null && potDraftTotal > 0.001) ? potDraftTotal : 0
    if (added > 0 && groupId) {
      supabase.rpc("party_add_pot", { p_group: groupId, p_amounts: potDraft, p_is_card: potIsCard, p_payers: cardPayers })
        .then(({ error }) => { if (error) setNotice("Inleg opslaan mislukt: " + error.message); else loadParty(groupId) })
    }
    setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setEditPotId(null); setPotBuilderOpen(false); setShowPot(false)
    if (onbPotActive) {
      setOnbPotActive(false)
      const willHave = potContribTotal + added
      if (potChosen && willHave <= 0.005) {
        setConfirmDlg({ msg: L.potNothingIn(potIsCard), yes: L.anywayWithout(potIsCard), onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("settings") }, onNo: () => { setConfirmDlg(null); setShowPot(true); setOnbPotActive(true) } })
        return
      }
      setView("settings")
    }
  }
  const applyCard = (ids: string[], valStr: string) => { const val = parseFloat((valStr || "").replace(",", ".")) || 0; const d: Record<string, number> = {}; if (val > 0 && ids.length > 0) { const per = val / ids.length; ids.forEach((id) => (d[id] = per)) } setPotDraft(d); setEveryoneChoice(null) }
  const toggleCardPayer = (id: string) => { const next = cardPayers.includes(id) ? cardPayers.filter((x) => x !== id) : [...cardPayers, id]; setCardPayers(next); applyCard(next, cardValue) }
  const cardSelectAll = () => { const all = people.map((p) => p.id); setCardPayers(all); applyCard(all, cardValue) }
  const editPotRound = (id: string) => { const r = potRounds.find((x) => x.id === id); if (!r) return; setEditPotId(id); setPotDraft({ ...r.amounts }); setEveryoneChoice(null); setEveryoneDraft("") }
  const saveEditPot = () => {
    if (editPotId === null) return
    if (potDraftTotal > 0.001) {
      supabase.from("party_pot").update({ amounts: potDraft }).eq("id", editPotId)
        .then(({ error }) => { if (error) setNotice("Opslaan mislukt: " + error.message); else if (groupId) loadParty(groupId) })
    } else {
      // Alles op nul gezet = de inleg-ronde bestaat niet meer.
      supabase.from("party_pot").delete().eq("id", editPotId)
        .then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message); else if (groupId) loadParty(groupId) })
    }
    setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setPotBuilderOpen(false)
  }
  const cancelEditPot = () => { setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setPotBuilderOpen(false) }
  const removePotRound = (id: string, label: string) => setConfirmDlg({ msg: L.removeContribConfirm(label), yes: L.yesCancel, onYes: () => {
    supabase.from("party_pot").delete().eq("id", id).then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message); else if (groupId) loadParty(groupId) })
    setPotRounds((rs) => rs.filter((r) => r.id !== id)); setConfirmDlg(null)
  } })
  // Zodra er een eigen drankje bestaat, springt ⭐ Eigen vooraan — dat is dan de
  // categorie die je zelf hebt aangemaakt en dus het eerst zoekt. Zolang ze leeg is,
  // blijft ze achteraan staan en duwt ze de gewone lijst niet opzij.
  const heeftEigen = drinks.some((d) => d.cat === "Eigen")
  const catOrde: Cat[] = heeftEigen ? ["Eigen", ...CATS.filter((c) => c !== "Eigen")] : CATS
  const catsPresent = catOrde.filter((c) => c === "Eigen" || drinks.some((d) => d.cat === c))
  const bump1 = (did: string) => bumpAnon(did, 1)
  // Een drankje in één tik volledig uit de lopende bestelling halen — zowel de nog niet
  // toegewezen exemplaren als die al aan iemand hingen.
  const clearDrink = async (did: string) => {
    const anon = cartAnon[did] ?? 0
    const perPersoon = Object.entries(cart[did] ?? {}).filter(([, n]) => (n || 0) > 0)
    setCartAnon((a) => ({ ...a, [did]: 0 }))
    setCart((c) => ({ ...c, [did]: {} }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    if (anon > 0) await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: null, p_drink: did, p_delta: -anon })
    for (const [pid, n] of perPersoon) {
      await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: pid, p_drink: did, p_delta: -(n || 0) })
    }
  }
  const bumpDown = (did: string) => { if ((cartAnon[did] ?? 0) > 0) { bumpAnon(did, -1); return } const entry = cart[did]; if (!entry) return; const pid = Object.keys(entry).find((k) => (entry[k] ?? 0) > 0); if (pid) bump(did, pid, -1) }
  const firstUnassigned = () => drinks.find((d) => (cartAnon[d.id] ?? 0) > 0)

  const dropUnpaidRound = () => {
    const last = rounds[rounds.length - 1]
    if (last && !roundIsPaid(last)) supabase.from("party_rounds").delete().eq("id", last.id).then(() => { if (groupId) loadParty(groupId) })
    if (openRoundId) supabase.from("party_rounds").delete().eq("id", openRoundId).then(() => { if (groupId) loadParty(groupId) })
    setOpenRoundId(null)
    setRounds((rs) => (rs.length && !roundIsPaid(rs[rs.length - 1]) ? rs.slice(0, -1) : rs)); setCart({}); setCartAnon({}); setAmountDraft(""); setPayPot(false); setPayPersons([]); setPayAmts({}); setPotAmtDraft(""); setPaidConfirmed(false) }
  const goStart = () => { if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); setView("start") } }); else setView("start") }
  // Naar het echte beginscherm van de site (waar je Rundo Table of Party kiest). Bij een
  // onbevestigd rondje eerst waarschuwen, zodat je geen werk verliest.
  const goSiteHome = () => {
    const ga = () => { window.location.href = "/" }
    if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); ga() } })
    else ga()
  }
  const goHome = () => { setFromOnboarding(false); if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); setView("settings") } }); else setView("settings") }
  const potAvailNow = () => { const curPotPart = rounds.length ? (rounds[rounds.length - 1].potPart || 0) : 0; return potContribTotal - (potSpent - curPotPart) }
  // Van aanpak wisselen: je begint helemaal opnieuw in de andere modus. We wissen de
  // rondjes, drankjes en pot van deze groep en sturen je terug naar de kaders met de
  // andere modus voorgeselecteerd. De groep zelf (naam, id) blijft — geen dubbels.
  const switchMode = () => {
    if (!groupId) return
    setConfirmDlg({
      variant: "danger", msg: L.switchModeWarn, yes: L.switchModeYes, no: L.cancel,
      onYes: async () => {
        setConfirmDlg(null)
        // Child-data weg (rondjes, items, pot). CASCADE zit op de groep, niet hiertussen,
        // dus we wissen expliciet per tabel.
        await Promise.all([
          supabase.from("party_round_items").delete().eq("group_id", groupId),
          supabase.from("party_rounds").delete().eq("group_id", groupId),
          supabase.from("party_pot").delete().eq("group_id", groupId),
        ])
        // Lokale staat leegmaken zodat er niets blijft hangen.
        setRounds([]); setCart({}); setCartAnon({}); setPotRounds([]); setOpenRoundId(null); setStartedBy(null)
        setRoundNr(1); setHasSettled(false)
        // Terug naar de kaders met de ándere modus voorgeselecteerd, deze groep hervatten.
        setResumeGroupId(groupId)
        setBpSettle(!settle)
        setOpenInfo(null)
        setView("start")
      },
    })
  }
  const paymentState = () => {
    const total = parseFloat(amountDraft.replace(",", ".")) || 0
    const potAvail = potAvailNow()
    const potAmt = parseFloat(potAmtDraft.replace(",", ".")) || 0
    const persons = payPersons
    const nPayers = persons.length + (payPot ? 1 : 0)
    const multi = nPayers > 1
    const amtOf = (pid: string) => parseFloat((payAmts[pid] || "").replace(",", ".")) || 0
    const personAmts: Record<string, number> = {}
    if (!multi && persons.length === 1) personAmts[persons[0]] = total
    else persons.forEach((pid) => (personAmts[pid] = amtOf(pid)))
    const potPart = payPot ? (multi ? potAmt : total) : 0
    const personSum = Object.values(personAmts).reduce((a, b) => a + b, 0)
    const sum = personSum + potPart
    const missing = total - sum
    const allFilled = !multi || (persons.every((pid) => (payAmts[pid] || "").trim() !== "") && (!payPot || potAmtDraft.trim() !== ""))
    const potOver = potPart > potAvail + 0.001
    let valid = true, reason = ""
    if (total <= 0) { valid = false; reason = "Vul eerst exact betaald bedrag in." }
    else if (nPayers === 0) { valid = false; reason = L.whoPaid }
    else if (payPot && potAvail <= 0.005) { valid = false; reason = L.potEmpty(potIsCard) }
    else if (potOver) { valid = false; reason = L.potTooLow(potIsCard, euro(Math.max(0, potAvail))) }
    else if (multi && !allFilled) { valid = false; reason = L.fillPerPayer }
    const tol = 0.005 + 0.01 * Math.max(0, nPayers - 1)
    const rounding = multi && Math.abs(missing) > 0.005 && Math.abs(missing) <= tol
    if (valid && multi && Math.abs(missing) > tol) { valid = false; reason = missing > 0 ? `Samen ${euro(sum)} van ${euro(total)} — er ontbreekt ${euro(missing)}.` : `Samen ${euro(sum)} van ${euro(total)} — ${euro(-missing)} te veel.` }
    return { total, potAmt, potPart, personAmts, personSum, sum, missing, multi, nPayers, potAvail, potOver, valid, reason, rounding }
  }
  // Verdeelt het rondjebedrag automatisch en exact (tot op de cent) over de gekozen betalers.
  // De laatste betaler krijgt de restcent, zodat de som altijd precies klopt.
  const autoSplit = (persons: string[], usePot: boolean, totalStr?: string) => {
    const total = Math.round(((parseFloat((totalStr ?? amountDraft).replace(",", ".")) || 0)) * 100)
    const n = persons.length + (usePot ? 1 : 0)
    if (total <= 0 || n === 0) { setPayAmts({}); setPotAmtDraft(usePot ? "" : ""); return }
    const availC = Math.max(0, Math.round(potAvailNow() * 100))
    let potC = 0
    if (usePot) potC = Math.min(Math.floor(total / n), availC)
    const restC = total - potC
    const perC = persons.length ? Math.floor(restC / persons.length) : 0
    const next: Record<string, string> = {}
    persons.forEach((pid) => (next[pid] = (perC / 100).toFixed(2)))
    setPayAmts(next)
    setPotAmtDraft(usePot ? (potC / 100).toFixed(2) : "")
    setPaidConfirmed(false)
  }
  const togglePayPerson = (pid: string) => { const next = payPersons.includes(pid) ? payPersons.filter((x) => x !== pid) : [...payPersons, pid]; setPayPersons(next); autoSplit(next, payPot); setPaidConfirmed(false) }
  const goHub = () => { const to = () => { setOpenRound(rounds.length - 1); setEditCups(false); setEditPay(false); setView("hub") }; if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); to() } }); else to() }
  // Instellingen van het feest wegschrijven. Zonder dit ziet een gast die scant de
  // verkeerde modus: euro's terwijl de rest met coins werkt, of geen waarborg.
  const persistSettings = (extra?: Record<string, unknown>) => {
    if (!groupId) return
    supabase.from("party_groups").update({
      name: groupName.trim(), pay, coin_value: coinValue,
      deposit_on: depositOn, deposit_value: depositValue, deposit_unit: depositUnit,
      pot_on: potChosen, pot_is_card: potIsCard, last_active: new Date().toISOString(), ...(extra ?? {}),
    }).eq("id", groupId).then(({ error }) => { if (error) setNotice("Instellingen opslaan mislukt: " + error.message) })
  }

  // Delen kan pas als de groep vaststaat: naam, aantal personen én de startvragen.
  // Zo kan er niemand ongevraagd bijkomen en blijft de groep even groot als de admin
  // aangaf — gasten claimen enkel een vrije plaats, ze maken er geen bij.
  const canShare = settle && isAdmin && !!inviteCode && people.length > 0 && onboardedOnce
  const renderShare = () => {
    if (!canShare) return null
    const vrij = people.filter((p) => !p.claimedBy).length
    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.45)" }}>
        <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.letGuestsScan}</h3>
        <div style={{ fontSize: 14, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>
          {vrij > 0 ? L.freeSeats(vrij) : L.allTakenAdmin}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "#fff", padding: 10, borderRadius: 14, border: "1px solid rgba(120,95,20,0.15)" }}>
            <QRCodeSVG value={inviteLink} size={132} bgColor="#ffffff" fgColor="#4a3f1e" />
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "0.18em", color: "#4a3f1e", marginTop: 10 }}>{inviteCode}</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ ...S.btn, flex: 1, fontWeight: 800 }}
            onClick={async () => {
              const txt = L.joinInvite(groupName, inviteLink)
              if (typeof navigator !== "undefined" && navigator.share) {
                try { await navigator.share({ text: txt }); return } catch { /* geannuleerd */ }
              }
              if (navigator.clipboard) { navigator.clipboard.writeText(txt); setNotice(L.linkCopied) }
            }}>{L.shareLink}</button>
          <button style={{ ...S.btn, flex: 1, fontWeight: 800 }}
            onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(inviteLink); setNotice(L.linkCopied) } }}>{L.copyLink}</button>
        </div>
        {/* Wie scande al? Zo ziet de admin de groep vollopen zonder te moeten raden. */}
        <div style={{ borderTop: "1px solid rgba(120,95,20,0.12)", marginTop: 14, paddingTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1f6b3a", marginBottom: 8 }}>📱 {L.joinedOfTotal(people.filter((p) => p.claimedBy).length, people.length)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {people.map((p) => (
              <span key={p.id} style={{ fontSize: 14, fontWeight: 700, padding: "4px 10px", borderRadius: 16,
                background: p.claimedBy ? "rgba(31,138,76,0.12)" : "#faf7ec",
                color: p.claimedBy ? "#1f6b3a" : "#b3a988",
                border: p.claimedBy ? "1px solid rgba(31,138,76,0.25)" : "1px dashed rgba(120,95,20,0.25)" }}>
                {p.claimedBy ? "📱 " : ""}{p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Eigen drankje ───────────────────────────────────────────────────────────
  const MAX_EIGEN_PERSOON = 5
  const MAX_EIGEN_GROEP = 20
  const eigenVanMij = customDrinks.filter((c) => c.by === me.current).length

  const addCustomDrink = async () => {
    const naam = ndName.trim()
    if (!naam) { setNotice(L.nameYourDrink); return }
    const prijs = parseFloat(ndPrice.replace(",", "."))
    // De richtprijs is niet optioneel: zonder prijs kan Fair Split dit drankje niet
    // wegen tegen de rest, en dan is de verdeling gewoon fout.
    if (!(prijs > 0)) { setNotice(L.needPrice); return }
    const sleutel = drinkKey(naam)
    if (drinks.some((d) => d.id === sleutel)) { setNotice(L.alreadyExists(naam)); return }
    if (!groupId) return

    const coins = coinDefault("Eigen", naam)

    const { error } = await supabase.rpc("party_add_drink", {
      p_group: groupId, p_key: sleutel, p_name: naam, p_cat: "Eigen",
      p_price: prijs, p_coins: coins, p_cup: true, p_by: me.current,
      p_max_person: MAX_EIGEN_PERSOON, p_max_group: MAX_EIGEN_GROEP,
    })
    if (error) {
      if (/PERSOON_VOL/.test(error.message)) setNotice(L.maxPerPerson(MAX_EIGEN_PERSOON))
      else if (/GROEP_VOL/.test(error.message)) setNotice(L.maxPerGroup(MAX_EIGEN_GROEP))
      else setNotice("Toevoegen mislukt: " + error.message)
      return
    }
    setNdName(""); setNdPrice(""); setShowAddDrink(false)
    setActiveCat("Eigen"); setDrinkSearch("")
    loadParty(groupId)
  }

  const removeCustomDrink = async (key: string, naam: string) => {
    if (!groupId) return
    const { error } = await supabase.rpc("party_remove_drink", { p_group: groupId, p_key: key })
    if (error) {
      // Een drankje dat al besteld is, mag niet weg: dan zouden er bestellingen naar
      // een onbestaand drankje wijzen en klopt de verdeling niet meer.
      if (/IN_GEBRUIK/.test(error.message)) setNotice(L.drinkInUse(naam))
      else setNotice("Verwijderen mislukt: " + error.message)
      return
    }
    loadParty(groupId)
  }

  const renderAddDrink = () => {
    if (!showAddDrink) return null
    const mijne = customDrinks.filter((c) => c.by === me.current)
    return (
      <div style={S.overlay} onClick={() => setShowAddDrink(false)}>
        <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>{L.ownDrinkTitle}</h3>
            <button onClick={() => setShowAddDrink(false)} style={{ border: "none", background: "none", fontSize: 21, cursor: "pointer", color: "#8a7d55" }}>✕</button>
          </div>

          <div style={{ fontSize: 14, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>
            {L.ownDrinkIntro}
          </div>

          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>{L.nameLabel}</div>
          <input value={ndName} onChange={(e) => setNdName(e.target.value)} placeholder={L.namePh}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 16, textAlign: "left", marginBottom: 12 }} />


          <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 5 }}>{L.priceLabel}</div>
          <div style={{ fontSize: 13, color: "#8a7d55", marginBottom: 6, lineHeight: 1.4 }}>
            {L.priceHint}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: "#8a7d55", flexShrink: 0 }}>€</span>
            <input value={ndPrice} onChange={(e) => setNdPrice(e.target.value)} inputMode="decimal" placeholder="4,50"
              style={{ ...S.input, flex: 1, minWidth: 0, boxSizing: "border-box", fontSize: 16, textAlign: "left" }} />
          </div>


          <button style={{ ...S.btnP, width: "100%", opacity: ndName.trim() && ndPrice ? 1 : 0.5 }} onClick={addCustomDrink}>
            {L.addBtn}
          </button>
          <div style={{ fontSize: 13, color: "#8a7d55", textAlign: "center", marginTop: 8 }}>
            {L.remaining(Math.max(0, MAX_EIGEN_PERSOON - eigenVanMij), MAX_EIGEN_PERSOON)}
          </div>

          {mijne.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(120,95,20,0.12)" }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 3 }}>{L.addedByYou}</div>
              <div style={{ fontSize: 13, color: "#8a7d55", marginBottom: 9, lineHeight: 1.45 }}>{L.removeHint}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {mijne.map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: "#faf7ec", border: "1px solid rgba(120,95,20,0.12)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: "#4a3f1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⭐ {c.name}</span>
                    <span style={{ fontSize: 14, color: "#8a7d55", fontWeight: 700, flexShrink: 0 }}>{euro(Number(c.price))}</span>
                    <button onClick={() => removeCustomDrink(c.key, c.name)} aria-label={L.removeWord}
                      style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 9, background: "#fff", border: "1px solid rgba(224,104,92,0.4)", color: "#c0554a", fontSize: 16, cursor: "pointer" }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Spraak (beta) ───────────────────────────────────────────────────────────
  // Bewust met een bevestigingsstap: spraakherkenning zit er geregeld naast, en niets
  // is vervelender dan drie tequila's in je rondje die je nooit besteld hebt.
  const startVoice = () => {
    type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void;
                onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Herkenner = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Herkenner) { setNotice(L.voiceUnsupported); return }

    const r = new Herkenner()
    r.lang = lang === "fr" ? "fr-BE" : "nl-BE"
    r.interimResults = false
    r.continuous = false
    setVoiceText(""); setVoiceHits([]); setVoiceOn(true); setVoiceOpen(true)

    r.onresult = (e) => {
      const tekst = e.results[0]?.[0]?.transcript ?? ""
      setVoiceText(tekst)
      setVoiceHits(parseSpraak(tekst, drinks))
    }
    r.onerror = (e) => {
      setVoiceOn(false)
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setNotice(L.voiceDenied)
    }
    r.onend = () => setVoiceOn(false)
    r.start()
  }

  // De verstane drankjes in de mand zetten. Een gast zet ze op zichzelf; de admin laat
  // ze onbekend, want hij spreekt voor de hele groep en wijst daarna toe.
  const applyVoice = async () => {
    for (const h of voiceHits) {
      if (!isAdmin && meId) await bump(h.id, meId, h.qty)
      else await bumpAnon(h.id, h.qty)
    }
    setVoiceOpen(false); setVoiceHits([]); setVoiceText("")
  }

  const renderVoice = () => {
    if (!voiceOpen) return null
    return (
      <div style={S.overlay} onClick={() => { if (!voiceOn) setVoiceOpen(false) }}>
        <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>
              {L.voiceBtn} <span style={{ fontSize: 10, fontWeight: 800, color: "#c98a00", border: "1px solid #e08a00", borderRadius: 5, padding: "1px 5px", verticalAlign: "middle" }}>{L.voiceBeta}</span>
            </h3>
            {!voiceOn && <button onClick={() => setVoiceOpen(false)} style={{ border: "none", background: "none", fontSize: 21, cursor: "pointer", color: "#8a7d55" }}>✕</button>}
          </div>

          {voiceOn ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎤</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#c98a00" }}>{L.voiceListening}</div>
              <div style={{ fontSize: 14, color: "#8a7d55", marginTop: 8 }}>{L.voiceSay}</div>
            </div>
          ) : (
            <>
              {voiceText && (
                <div style={{ background: "#faf7ec", border: "1px solid rgba(120,95,20,0.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: "#8a7d55", marginBottom: 3 }}>{L.voiceHeard}</div>
                  <div style={{ fontSize: 15.5, fontStyle: "italic", color: "#6b5f3a" }}>&ldquo;{voiceText}&rdquo;</div>
                </div>
              )}

              {voiceHits.length === 0 ? (
                <div style={{ fontSize: 15, color: "#b3a988", textAlign: "center", padding: "10px 0 16px", lineHeight: 1.5 }}>
                  {L.voiceNothing}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {voiceHits.map((h) => (
                    <span key={h.id} style={{ ...S.pill, background: "rgba(31,138,76,0.1)", border: "1px solid rgba(31,138,76,0.3)", color: "#1f6b3a", fontSize: 15, padding: "5px 10px" }}>
                      {h.qty}× {h.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn, flex: 1, fontWeight: 800 }} onClick={startVoice}>{L.voiceRetry}</button>
                {voiceHits.length > 0 && (
                  <button style={{ ...S.btnP, flex: 2 }} onClick={applyVoice}>{L.voiceAdd}</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // De toog-lijst. Wie gaat halen wil geen lijst per persoon — hij wil weten wat hij
  // aan de barman moet zeggen. Totalen om te bestellen, namen om uit te delen.
  const renderBarList = () => {
    const r = rounds[rounds.length - 1]
    if (!r) return null
    const perDrank = drinks
      .map((d) => ({ d, n: Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0) }))
      .filter((x) => x.n > 0)
    if (perDrank.length === 0) return null

    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.45)" }}>
        {settle && <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10 }}>{L.barList}</h3>}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {perDrank.map(({ d, n }) => (
            <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{d.emoji} {d.name}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#c98a00" }}>{n}×</span>
            </div>
          ))}
        </div>
        {settle && (
        <div style={{ borderTop: "1px solid rgba(120,95,20,0.12)", marginTop: 10, paddingTop: 9 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#8a7d55", marginBottom: 5 }}>{L.barHandOut}</div>
          <div style={{ fontSize: 14.5, color: "#6b5f3a", lineHeight: 1.6 }}>
            {people.map((p) => {
              const zijne = drinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
              if (zijne.length === 0) return null
              return <div key={p.id}><b>{p.name}:</b> {zijne.map((d) => `${r.orders[d.id][p.id] > 1 ? r.orders[d.id][p.id] + "× " : ""}${d.name}`).join(", ")}</div>
            })}
          </div>
        </div>
        )}
      </div>
    )
  }

  // Halverwege alsnog willen afrekenen. Kost niets: de rondjes en drankjes zijn in
  // beide modi identiek, en de Fair Split valt terug op de richtprijzen.
  const switchToSettle = () => {
    setSettle(true)
    persistSettings({ settle: true })
    setView("final")
  }

  // Gewoon rondjes: het bedrag dat verdeeld wordt is de som van alle rondje-bedragen.
  const totalCost = rounds.reduce((s, r) => s + (r.amount || 0), 0)
  const setTotalCost = (v: number) => {
    // "Totaal"-modus: alles op het eerste rondje, de rest op 0, zodat de som klopt.
    // We schrijven elk rondje expliciet weg (dirtyRound kan er maar één markeren).
    if (rounds.length === 0) return
    const nieuwe = rounds.map((r, i) => rRedistribute(r, i, false, [], i === 0 ? v : 0))
    setRounds(nieuwe)
    nieuwe.forEach((r) => persistRound(r))
  }

  // Gewoon rondjes → afrekenen. Altijd bereikbaar. Zonder bedragen valt er niets te
  // verdelen: dan een melding met een duw naar het rondjesoverzicht.
  const goQuickSettle = () => {
    if (paidCount === 0 && rounds.length === 0) { setNotice(L.nothingToSettle); return }
    if (totalCost <= 0.005) {
      setConfirmDlg({
        msg: L.noAmountsYet,
        yes: L.fillAmountsNow,
        onYes: () => { setConfirmDlg(null); setFillMode(true); setOverviewBackTo("hub"); setView("roundsOverview") },
        no: L.later,
      })
      return
    }
    setView("quickSettle")
  }
  // Van niveau 1 naar Fair Split: eerst snel personen + namen, daarna toewijzen.
  const goToFairSplit = () => { setView("fairSetup") }
  const confirmFairSetup = async () => {
    if (people.length === 0) { setNotice(L.addPersonFirst); return }
    setSettle(true)
    persistSettings({ settle: true })
    setOpenRound(rounds.length - 1)
    setView("hub")
  }
  // Nieuw rondje in gewoon-rondjes: eerst vragen of het hetzelfde rondje opnieuw is
  // (bestelling overgenomen, aanpasbaar) of een vers rondje.
  const askNewRound = () => {
    if (rounds.length === 0) { nextRound(); return }
    setConfirmDlg({
      msg: L.sameRoundAgainQ,
      yes: L.sameRoundYes,
      onYes: () => { setConfirmDlg(null); repeatRound() },
      no: L.newRoundFresh,
      onNo: () => { setConfirmDlg(null); nextRound() },
    })
  }

  // Het aantal personen van één rondje bijstellen. De app leidt dit af uit het aantal
  // drankjes, maar soms nam iemand twee glazen of dronk er iemand niets mee.
  const setRoundHeadcount = async (roundId: string, n: number) => {
    const val = Math.max(1, n)
    setRounds((cur) => cur.map((r) => r.id === roundId ? { ...r, headcount: val } : r))
    const { error } = await supabase.from("party_rounds").update({ headcount: val }).eq("id", roundId)
    if (error) setNotice("Aanpassen mislukt: " + error.message)
  }

  const applyBeginChoices = () => {
    if (bpSettle === null) return
    setOnboardedOnce(true)
    // "Gewoon rondjes": geen pot, geen coins, geen bekers. Niet omdat het niet KAN,
    // maar omdat het niets betekent zonder afrekening.
    if (bpSettle === false) {
      setSettle(false)
      setPotChosen(false); setDepositOn(false); setPay("eur")
      persistSettings({ settle: false, pot_on: false, deposit_on: false, pay: "eur" })
      setBeginPrompt(false)
      setView("hub")
      return
    }
    // Fair Split: gewoon aanzetten en beginnen. Pot, bekers en coins stelt de admin
    // in wanneer hij ze nodig heeft, via ⚙️ Groep. Ze horen niet als opstartvraag —
    // de meeste avonden gebruiken ze niet.
    setSettle(true)
    persistSettings({ settle: true })
    setBeginPrompt(false)
    setView("hub")
  }
  const tryBegin = () => {
    if (people.length === 0) { setNotice(L.addPersonFirst); return }
    if (depositOn && (depositValue || 0) <= 0) { setNotice(L.fillDeposit); return }
    if (pay === "coin" && (coinValue || 0) <= 0) { setNotice(L.fillCoinValue); return }
    if (potChosen && potContribTotal <= 0.005) { setConfirmDlg({ msg: L.potNothingIn(potIsCard), yes: L.anywayWithout(potIsCard), onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("hub") } }); return }
    setView("hub")
  }
  // Het eerste rondje starten, met een zachte drempel: is nog niet iedereen aangemeld,
  // dan een vriendelijke bevestiging — geen poort. De admin houdt de keuze.
  const startFirstRound = () => {
    if (unfinishedRound) { resumeRound(); return }
    const nietAangemeld = people.filter((p) => !p.claimedBy).length
    const ga = () => { setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }
    // Alleen relevant als er ooit iets te scannen viel (een invite-code bestaat) en er
    // echt nog mensen ontbreken. Anders gewoon starten.
    if (inviteCode && nietAangemeld > 0) {
      setConfirmDlg({ msg: L.startNotAll(nietAangemeld, people.length), yes: L.startAnyway, no: L.startWait, onYes: () => { setConfirmDlg(null); ga() } })
      return
    }
    ga()
  }
  const goAssignUnassigned = () => {
    const fr = rounds.findIndex((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
    if (fr < 0) return
    setOpenRound(fr); setAllRoundsOpen(false); setEditCups(false); setEditPay(false); setView("hub"); setAssignIdx(fr)
  }
  const goFinal = () => {
    if (unfinishedRound) { setNotice(L.roundUnfinished(roundNr)); setActiveCat(catsPresent[0]); setView("order"); return }
    if (view === "confirmed") { setNotice(`Rondje ${roundNr} is nog niet betaald. Rond die betaling eerst af.`); return }
    if (paidCount === 0) { setNotice(L.nothingToSettle); return }
    if (blockIfUnpaid()) return
    if (anyUnassignedRounds) {
      const tot = rounds.reduce((s, r) => s + drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0), 0)
      setConfirmDlg({
        msg: `🔴 ${tot} drankje${tot === 1 ? "" : "s"} nog niet toegewezen.\n\nWijs toe → Fair Split: elk betaalt wat hij écht dronk.\nDoe je dat niet → gelijk verdeeld: iedereen evenveel.\n\nVoorbeeld: Jan 1 cola (€4), Tom 4 speciaalbieren (€20). Gelijk verdeeld betaalt elk €12 — Jan €8 te veel.`,
        yes: L.equalAnyway,
        no: "Toewijzen",
        onYes: () => { setConfirmDlg(null); setHasSettled(true); setView("final") },
        onNo: () => { setConfirmDlg(null); goAssignUnassigned() },
      })
      return
    }
    setHasSettled(true); setView("final") }
  const openClose = () => {
    setAmountDraft("")
    // Wie haalde, schoot voor: die staat standaard als betaler klaar. Nog te wijzigen
    // naar de pot of iemand anders op het betaalscherm.
    if (settle && startedBy && payPersons.length === 0 && !payPot) {
      setPayPersons([startedBy]); autoSplit([startedBy], false)
    }
    setShowClose(true)
  }
  const goAssignFromWarning = () => { setShowClose(false); setShowAssignAll(true) }
  const commitRound = () => {
    const effGb: Record<string, number> = {}
    people.forEach((p) => { effGb[p.id] = gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id)) })
    // De haler heeft de mensen op de plaats vastgezet — reset de haler-strook voor het
    // volgende rondje.
    setStartedBy(null)
    if (openRoundId) {
      // "Gewoon rondjes": het rondje is meteen klaar. Geen bedrag, geen betaler.
      const nieuweStatus = settle ? "pending" : "closed"
      // Bevries WIE er nu in de groep zit: dit zijn de deelnemers aan dit rondje.
      // Vanaf hier telt een latere nieuwkomer niet meer mee voor dit rondje.
      const leden = people.map((p) => p.id)
      // De groep blijft meestal dezelfde hele avond. Een volgend rondje neemt daarom het
      // aantal van het vorige over — ook als er die ronde iemand niets dronk. Enkel bij
      // het allereerste rondje leiden we het af uit het aantal drankjes, als startpunt.
      // Per rondje bijstellen kan altijd in het rondjesoverzicht.
      const vorige = rounds.length > 0 ? Math.max(1, rounds[rounds.length - 1].headcount || 1) : 0
      const drankjesNu = drinks.reduce((s, d) => s + drinkTotal(d.id), 0)
      const effHeadcount = settle ? headcount : (vorige > 0 ? vorige : Math.max(1, drankjesNu || headcount || 1))
      supabase.from("party_rounds").update({ status: nieuweStatus, gave_back: effGb, members: leden, headcount: effHeadcount, ...(settle ? {} : { closed_at: new Date().toISOString() }) }).eq("id", openRoundId)
        .then(({ error }) => { if (error) setNotice("Rondje bevestigen mislukt: " + error.message); else if (groupId) loadParty(groupId) })
      setOpenRoundId(null)
    }
    setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setAmountDraft(""); setPayPot(false); setPayPersons([]); setPayAmts({}); setPotAmtDraft(""); setPaidConfirmed(false)
    // "Gewoon rondjes" kent geen betaalscherm: het rondje is klaar, en wie gaat halen
    // krijgt de toog-lijst in de hub te zien.
    if (!settle) setLastRoundHandled(false)
    setView(settle ? "confirmed" : "hub")
    setRoundNr((n) => n + 1)
  }
  const persistPayment = (roundId: string, payers: Record<string, number>, potPart: number, total: number) => {
    supabase.from("party_rounds")
      .update({ payers, pot_part: potPart, amount: total, status: "closed", closed_at: new Date().toISOString() })
      .eq("id", roundId)
      .then(({ error }) => { if (error) setNotice("Betaling opslaan mislukt: " + error.message); else if (groupId) loadParty(groupId) })
  }
  const applyPayment = (payers: Record<string, number>, potPart: number, total: number) => setRounds((rs) => rs.map((r, i) => i === rs.length - 1 ? { ...r, payers, amount: total, potPart } : r))
  const editOrder = () => { const last = rounds[rounds.length - 1]; if (!last) { setView("order"); return }
    // Terug naar bestellen: hetzelfde rondje weer openzetten. De drankjes staan al in
    // party_round_items, dus er hoeft niets verplaatst te worden.
    supabase.from("party_rounds").update({ status: "open" }).eq("id", last.id)
      .then(({ error }) => { if (error) setNotice("Terugkeren mislukt: " + error.message); else if (groupId) loadParty(groupId) })
    setOpenRoundId(last.id)
    setCart(last.orders); setCartAnon(last.anon); setGaveBackDraft(last.gaveBack); setRounds((rs) => rs.slice(0, -1)); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setPaidConfirmed(false); setActiveCat(catsPresent[0]); setView("order") }
  const confirmPayment = () => {
    const st = paymentState()
    if (!st.valid) { setNotice(st.reason); return }
    const payers: Record<string, number> = {}
    Object.entries(st.personAmts).forEach(([pid, a]) => { if (a > 0.0001) payers[pid] = a })
    // De afrondingscent(en) intern bij één betaler leggen zodat de boekhouding exact klopt.
    // Zichtbaar blijft iedereen even veel betalen; het verschil verrekent de Fair Split.
    let potPart = st.potPart
    const ids = Object.keys(payers)
    const diff = Math.round((st.total - (potPart + ids.reduce((a, k) => a + payers[k], 0))) * 100) / 100
    if (Math.abs(diff) > 0.0001) {
      if (ids.length > 0) payers[ids[ids.length - 1]] = Math.round((payers[ids[ids.length - 1]] + diff) * 100) / 100
      else potPart = Math.round((potPart + diff) * 100) / 100
    }
    const laatste = rounds[rounds.length - 1]
    if (laatste) persistPayment(laatste.id, payers, potPart, st.total)
    applyPayment(payers, potPart, st.total)
    setPaidConfirmed(true)
  }
  const closeRound = () => { if (!paidConfirmed || !paymentState().valid) { setNotice(L.confirmPaymentFirst); return } setOpenRound(rounds.length - 1); setEditCups(false); setEditPay(false); setView("hub") }
  const cancelOrder = () => setConfirmDlg({
    msg: L.cancelRoundConfirm(roundNr),
    yes: L.yesCancel,
    onYes: () => {
      setConfirmDlg(null)
      setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setRepeated(false)
      // Een afgerond rondje blijft afgerond: we openen het niet opnieuw. Aanpassen kan
      // enkel via het rondjesoverzicht.
      setRoundNr(rounds.length > 0 ? rounds.length : 1)
      setLastRoundHandled(true)
      setView("hub")
    },
  })
  const cancelRound = () => setConfirmDlg({ msg: `Het volledige rondje ${roundNr} annuleren? Alle drankjes en bekers van dit rondje worden verwijderd. Dit kan niet ongedaan gemaakt worden.`, yes: L.yesCancel, onYes: () => { const remaining = rounds.length - 1; setRounds((rs) => rs.slice(0, -1)); setPaidConfirmed(false); setConfirmDlg(null); if (remaining > 0) { setOpenRound(remaining - 1); setView("hub") } else setView("order") } })
  const nextRound = () => { if (blockIfUnpaid()) return; setRoundNr((n) => n + 1); setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setCart({}); setCartAnon({}); setRepeated(false); setView("order") }
  // Neemt de drankjes én de toewijzing van het laatste rondje over. Daarna nog gewoon aanpasbaar.
  // Wie deed mee aan dit rondje? Wie het rondje niet meemaakte, betaalt niet mee.
  // Oude rondjes zonder members vallen terug op de hele groep.
  const roundMembers = (r: Round) => (r.members.length > 0 ? r.members : people.map((p) => p.id))

  // ── "Zelfde rondje opnieuw" met inspraak ──────────────────────────────────
  // Het voorstel leeft op het LAATSTE rondje (proposal jsonb). De haler start het,
  // elke gast antwoordt op zijn eigen scherm, wie zwijgt krijgt niets. Alles loopt
  // via realtime (blok 11/12), zodat elk toestel de stand live ziet.
  const lastRound = rounds[rounds.length - 1] ?? null
  const activeProposal = lastRound && lastRound.proposal?.active ? lastRound.proposal : null
  const proposalRoundId = activeProposal ? lastRound!.id : null
  const myAnswer = (activeProposal && meId) ? activeProposal.answers?.[meId] : undefined
  // Wie deed mee aan het rondje dat we herhalen? Dat zijn de mensen die mogen antwoorden.
  const proposalPeople = lastRound ? people.filter((p) => roundMembers(lastRound).includes(p.id)) : []
  // De haler (of admin) start een voorstel op basis van het laatste rondje.
  const startProposal = async () => {
    if (blockIfUnpaid()) return
    if (!lastRound) { setNotice(L.nothingToRepeat); return }
    const by = meId || (startedBy ?? null)
    const { error } = await supabase.rpc("party_propose_repeat", { p_round: lastRound.id, p_by: by })
    if (error) { setNotice("Voorstel starten mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }
  // Een gast antwoordt: hetzelfde, iets anders, of bewust niks deze ronde.
  const answerProposal = async (answer: "same" | "different" | "skip") => {
    if (!proposalRoundId || !meId) return
    const { error } = await supabase.rpc("party_answer_repeat", { p_round: proposalRoundId, p_person: meId, p_answer: answer })
    if (error) { setNotice("Antwoord mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }
  // De haler sluit het voorstel af. Enkel wie "same" of "different" antwoordde, telt.
  const closeProposal = async () => {
    if (!proposalRoundId) return
    const { error } = await supabase.rpc("party_close_proposal", { p_round: proposalRoundId })
    if (error) { setNotice("Afsluiten mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }

  // Het overzicht dat de HALER ziet zolang een voorstel loopt: wie antwoordde wat,
  // en de afsluit-knop met de geruststellende regel over wie er niet bij staat.
  const renderProposalHost = () => {
    if (!activeProposal || !lastRound) return null
    const answers = activeProposal.answers || {}
    const meedoen = proposalPeople.filter((p) => answers[p.id] === "same" || answers[p.id] === "different")
    const stil = proposalPeople.filter((p) => !answers[p.id])
    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.5)" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e", marginBottom: 3 }}>{L.proposalTitle}</div>
        <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>{L.proposalWaiting}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {proposalPeople.map((p) => {
            const a = answers[p.id]
            const label = a === "same" ? L.ansSame : a === "different" ? L.ansDiff : a === "skip" ? L.ansSkip : L.ansWaiting
            const kleur = a === "same" ? "#1f6b3a" : a === "different" ? "#8a5e0f" : a === "skip" ? "#a89a6f" : "#b3a988"
            const bg = a ? "#faf7ec" : "#fff"
            return (
              <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 11px", borderRadius: 10, background: bg, border: "1px solid rgba(120,95,20,0.12)" }}>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: "#4a3f1e" }}>{p.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: kleur }}>{label}</span>
              </div>
            )
          })}
        </div>
        {/* De laatste blik vóór afsluiten: wie krijgt geen bestelling? Zo kan de haler
            desgewenst nog even langs die mensen voor hij op de knop tikt. */}
        {stil.length > 0 && (
          <div style={{ fontSize: 13.5, color: "#8a5e0f", background: "rgba(240,165,0,0.1)", borderRadius: 10, padding: "8px 11px", marginBottom: 10, lineHeight: 1.45 }}>
            {L.noOrderFor(stil.map((p) => p.name).join(", "))}
          </div>
        )}
        <button style={{ ...S.btnP, width: "100%" }}
          onClick={() => {
            if (meedoen.length === 0) { setConfirmDlg({ msg: L.proposalNobody, yes: L.startAnyway, onYes: () => { setConfirmDlg(null); closeProposal() }, no: L.startWait }); return }
            closeProposal()
          }}>{L.closeProposalBtn(meedoen.length)}</button>
      </div>
    )
  }

  // Het kaartje dat elke GAST ziet zolang een voorstel loopt. Drie keuzes; wie niks
  // kiest, zwijgt (en krijgt niets). "Iets anders" schakelt door naar het bestellen.
  const renderProposalGuest = () => {
    if (!activeProposal || !lastRound || !meId) return null
    if (!roundMembers(lastRound).includes(meId)) return null
    // Wat had ik vorige ronde? Toon dat, zodat "hetzelfde" concreet is.
    const mijnVorige = drinks
      .map((d) => ({ d, n: lastRound.orders[d.id]?.[meId] ?? 0 }))
      .filter((x) => x.n > 0)
    const gekozen = myAnswer
    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.6)", background: "#fff8ec" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e", marginBottom: 8 }}>{L.gProposalTitle}</div>
        {mijnVorige.length > 0 && (
          <div style={{ fontSize: 14, color: "#6b5f3a", marginBottom: 12, lineHeight: 1.5 }}>
            {L.gProposalYourLast} {mijnVorige.map((x) => `${x.n}× ${x.d.name}`).join(" · ")}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => answerProposal("same")}
            style={{ ...S.btnP, width: "100%", opacity: gekozen && gekozen !== "same" ? 0.5 : 1,
              background: gekozen === "same" ? "linear-gradient(135deg,#2fae6a,#1f8a4c)" : undefined }}>
            {L.gProposalSame}{gekozen === "same" && " ✓"}
          </button>
          <button onClick={() => { answerProposal("different"); setActiveCat(catsPresent[0]); setGuestTab("order") }}
            style={{ ...S.btn, width: "100%", fontWeight: 800, opacity: gekozen && gekozen !== "different" ? 0.5 : 1,
              border: gekozen === "different" ? "1.5px solid #e08a00" : undefined }}>
            {L.gProposalDiff}{gekozen === "different" && " ✓"}
          </button>
          <button onClick={() => answerProposal("skip")}
            style={{ ...S.btn, width: "100%", fontWeight: 700, fontSize: 15, opacity: gekozen && gekozen !== "skip" ? 0.5 : 1,
              border: gekozen === "skip" ? "1.5px solid #a89a6f" : undefined, color: "#8a7d55" }}>
            {L.gProposalSkip}{gekozen === "skip" && " ✓"}
          </button>
        </div>
        {gekozen && (
          <div style={{ fontSize: 13.5, color: "#1f6b3a", fontWeight: 700, textAlign: "center", marginTop: 10 }}>{L.gProposalDone}</div>
        )}
      </div>
    )
  }

  const repeatRound = () => {
    if (blockIfUnpaid()) return
    const last = rounds[rounds.length - 1]
    if (!last) { setNotice(L.nothingToRepeat); return }
    const orders: Assign = {}
    Object.entries(last.orders).forEach(([did, per]) => {
      const row: Record<string, number> = {}
      Object.entries(per || {}).forEach(([pid, q]) => { if (people.some((p) => p.id === pid) && (q || 0) > 0) row[pid] = q })
      if (Object.keys(row).length) orders[did] = row
    })
    const anon: Anon = {}
    Object.entries(last.anon || {}).forEach(([did, q]) => { if ((q || 0) > 0) anon[did] = q })
    setRoundNr((n) => n + 1)
    setCart(orders); setCartAnon(anon)
    setCupsChecked(false); setCupsTouched(false)
    setRepeated(true)
    setActiveCat(catsPresent[0])
    setView("order")
  }

  const roundKeyTotal = (r: Round) => drinks.reduce((s, d) => s + (Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0)) * priceOf(d), 0)
  // Drankjes (met aantal) van een rondje — gebruikt op het afreken-scherm én in het overzicht.
  const drinksOf = (r: Round) => drinks
    .map((d) => ({ d, n: Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0) }))
    .filter((x) => x.n > 0)
  // Wat dit rondje "waard" is. Vulde iemand een bedrag in, dan telt dat. Zo niet
  // (modus "gewoon rondjes"), dan de som van de richtprijzen.
  //
  // Dit is de brug die het mogelijk maakt om ACHTERAF alsnog af te rekenen zonder dat
  // er ooit een bedrag is ingevuld. En hij kost bijna niets: de Fair Split rekende AL
  // met richtprijzen — die bepaalden ieders AANDEEL, en `amount` was enkel de
  // schaalfactor. Valt die weg, dan blijft het aandeel staan.
  const roundValue = (r: Round) => (r.amount > 0.005 ? r.amount : roundKeyTotal(r))

  // Wie was er TOEN bij? Onbekende drankjes worden gedeeld over de mensen die aan dít
  // rondje deelnamen — niet over het huidige aantal. Anders betaalt een laatkomer mee
  const personRoundShare = (r: Round, pid: string) => {
    const leden = roundMembers(r)
    // Zat deze persoon niet in dit rondje? Dan draagt hij er niets aan bij.
    if (!leden.includes(pid)) return 0
    const n = leden.length || 1
    const kt = roundKeyTotal(r)
    const bedrag = roundValue(r)
    if (kt <= 0 || bedrag <= 0) return bedrag / n
    const own = drinks.reduce((a, d) => a + (r.orders[d.id]?.[pid] ?? 0) * priceOf(d), 0)
    const anon = drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0) * priceOf(d), 0)
    return ((own + anon / n) / kt) * bedrag
  }
  const consumption = (pid: string) => rounds.reduce((s, r) => s + personRoundShare(r, pid), 0)
  // In "gewoon rondjes" is er nooit een bedrag ingevuld -> toon de geschatte waarde.
  const grandTotal = useMemo(() => rounds.reduce((s, r) => s + roundValue(r), 0), [rounds]) // eslint-disable-line
  const isSchatting = useMemo(() => rounds.length > 0 && rounds.every((r) => r.amount <= 0.005), [rounds])
  const equalShare = people.length ? grandTotal / people.length : 0

  const roundCupEur = (r: Round, pid: string) => (roundPicked(r, pid) - (r.gaveBack[pid] || 0)) * depositPerCupEur
  const cupOwn = (pid: string) => (depositOn ? rounds.reduce((s, r) => s + roundCupEur(r, pid), 0) : 0)
  const roundParts = (r: Round) => { const potPart = r.potPart || 0; const persons = r.payers || {}; const personSum = Object.values(persons).reduce((a, b) => a + (b || 0), 0); const base = potPart + personSum; const cupSum = depositOn ? people.reduce((a, pp) => a + roundCupEur(r, pp.id), 0) : 0; return { potPart, persons, personSum, base, cupSum } }
  const paidByPerson = (pid: string) => rounds.reduce((s, r) => { const { persons, base, cupSum } = roundParts(r); const own = persons[pid] || 0; if (own <= 0) return s; return s + own + (base > 0 ? cupSum * (own / base) : 0) }, 0)
  // ── Samen afrekenen ─────────────────────────────────────────────────────────
  // Bewust GEEN gedeelde plaats: dan deelt een koppel ook één telefoon en kan de
  // tweede zijn eigen drankje niet aantikken. Iedereen houdt dus zijn plaats en zijn
  // drankjes; enkel de eindafrekening wordt samengeteld. Halverwege van gedachten
  // veranderen kan, zonder dat er iets aan de bestellingen wijzigt.
  const settleKey = (pid: string) => people.find((p) => p.id === pid)?.settleWith || pid
  const settleGroups = useMemo(() => {
    const g: Record<string, Person[]> = {}
    people.forEach((p) => { (g[p.settleWith || p.id] ??= []).push(p) })
    return Object.entries(g).map(([key, leden]) => ({
      key, leden,
      label: leden.map((p) => p.name).join(" & "),
      samen: leden.length > 1,
    })).sort((a, b) => Math.min(...a.leden.map((p) => p.seat)) - Math.min(...b.leden.map((p) => p.seat)))
  }, [people])

  const linkSettle = async (a: string, b: string) => {
    // b sluit aan bij de groep van a. Bestond a al in een groep, dan neemt hij die mee.
    const kop = settleKey(a)
    const groepVanB = people.filter((p) => (p.settleWith || p.id) === (people.find((x) => x.id === b)?.settleWith || b))
    const ids = groepVanB.map((p) => p.id)
    const { error } = await supabase.from("party_people").update({ settle_with: kop }).in("id", ids)
    if (error) { setNotice("Koppelen mislukt: " + error.message); return }
    // de kop van a wijst naar zichzelf, zodat de groepering sluit
    await supabase.from("party_people").update({ settle_with: kop }).eq("id", kop)
    if (groupId) loadParty(groupId)
  }
  const unlinkSettle = async (pid: string) => {
    const { error } = await supabase.from("party_people").update({ settle_with: null }).eq("id", pid)
    if (error) { setNotice("Ontkoppelen mislukt: " + error.message); return }
    // Blijft er nog één iemand alleen over in de groep, dan heeft die groep geen zin meer.
    const kop = settleKey(pid)
    const rest = people.filter((p) => p.id !== pid && (p.settleWith || p.id) === kop)
    if (rest.length === 1) await supabase.from("party_people").update({ settle_with: null }).eq("id", rest[0].id)
    if (groupId) loadParty(groupId)
  }

  // Kaart in het afrekenscherm: tik twee namen aan en ze rekenen samen af.
  const [settlePick, setSettlePick] = useState<string | null>(null)
  const renderSettleTogether = () => {
    if (people.length < 2) return null
    return (
      <div style={S.card}>
        <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.settleTogether}</h3>
        <div style={{ fontSize: 14, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>
          {L.settleTogetherInfo}
          enkel het eindbedrag wordt samengeteld tot één betaling.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {settleGroups.map((g) => {
            const gekozen = settlePick === g.key
            return (
              <button key={g.key}
                onClick={() => {
                  if (g.samen) { setSettlePick(null); return }              // groepje: enkel ontkoppelen hieronder
                  if (!settlePick) { setSettlePick(g.key); return }
                  if (settlePick === g.key) { setSettlePick(null); return }
                  linkSettle(settlePick, g.key); setSettlePick(null)
                }}
                style={{
                  ...S.chip(gekozen ? 1 : 0), cursor: "pointer",
                  ...(g.samen ? { background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", border: "1px solid rgba(240,165,0,0.5)" } : {}),
                }}>
                {g.samen ? "🔗 " : ""}{g.label}
              </button>
            )
          })}
        </div>
        {settlePick && (
          <div style={{ fontSize: 14, color: "#c98a00", fontWeight: 700, marginTop: 10 }}>
            {L.tapWhoWith(settleGroups.find((g) => g.key === settlePick)?.label ?? "")}
          </div>
        )}
        {settleGroups.some((g) => g.samen) && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(120,95,20,0.1)" }}>
            <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 7 }}>{L.separateAgain}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {settleGroups.filter((g) => g.samen).flatMap((g) => g.leden).map((p) => (
                <button key={p.id} onClick={() => unlinkSettle(p.id)}
                  style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(120,95,20,0.2)" }}>
                  ✕ {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const settlement = useMemo(() => {
    const paid: Record<string, number> = {}; people.forEach((p) => (paid[p.id] = 0)); let potPaid = 0
    rounds.forEach((r) => {
      const { potPart, persons, base, cupSum } = roundParts(r)
      if (base <= 0) { if (potPart > 0) potPaid += potPart + cupSum; return }
      Object.entries(persons).forEach(([pid, amt]) => { const a = amt || 0; if (a > 0) paid[pid] = (paid[pid] ?? 0) + a + cupSum * (a / base) })
      if (potPart > 0) potPaid += potPart + cupSum * (potPart / base)
    })
    // Per persoon, en daarna opgeteld per afreken-groepje. Wie alleen afrekent, is een
    // groepje van één — dan verandert er niets aan de uitkomst.
    const perPerson: Record<string, number> = {}
    people.forEach((p) => { perPerson[p.id] = (paid[p.id] ?? 0) + contribOf(p.id) - consumption(p.id) - cupOwn(p.id) - cardLossPer })
    const nets: { id: string; label: string; net: number }[] = settleGroups.map((g) => ({
      id: g.key, label: g.label,
      net: g.leden.reduce((a, p) => a + (perPerson[p.id] ?? 0), 0),
    }))
    if (potContribTotal > 0 || potSpent > 0) nets.push({ id: "pot", label: "de pot", net: potPaid - potContribTotal + (potIsCard ? Math.max(0, potRemaining) : 0) })
    const creditors = nets.filter((n) => n.net > 0.005).map((n) => ({ ...n })).sort((a, b) => b.net - a.net)
    const debtors = nets.filter((n) => n.net < -0.005).map((n) => ({ ...n, net: -n.net })).sort((a, b) => b.net - a.net)
    const tx: { from: string; to: string; amount: number }[] = []; let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) { const amt = Math.min(debtors[i].net, creditors[j].net); tx.push({ from: debtors[i].label, to: creditors[j].label, amount: amt }); debtors[i].net -= amt; creditors[j].net -= amt; if (debtors[i].net < 0.005) i++; if (creditors[j].net < 0.005) j++ }
    return { tx }
  }, [rounds, people, settleGroups, potRounds, potContribTotal, potSpent, potIsCard, potRemaining, depositOn, depositValue, depositUnit, coinValue, drinks, pay]) // eslint-disable-line
  const anyUnassignedRounds = rounds.some((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
  // Totaal aantal drankjes dat over ALLE afgeronde rondjes nog anoniem staat, plus de
  // index van het eerste rondje waar iets ontbreekt. Voor de waarschuwing op de hub.
  const unassignedAllRounds = rounds.reduce((s, r) => s + drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0), 0)
  const firstUnassignedIdx = rounds.findIndex((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
  const drinkTotalRound = (r: Round, did: string) => Object.values(r.orders[did] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[did] ?? 0)
  const paidLabel = (r: Round) => {
    const potP = r.potPart || 0
    const entries = Object.entries(r.payers || {}).filter(([, a]) => (a || 0) > 0)
    const parts: string[] = []
    if (potP > 0) parts.push(`${potIsCard ? "kaart" : "pot"} ${euro(potP)}`)
    entries.forEach(([pid, a]) => parts.push(`${people.find((p) => p.id === pid)?.name ?? "?"} ${euro(a)}`))
    if (parts.length === 0) return L.notPaidYet
    if (parts.length === 1 && entries.length === 1) return `door ${people.find((p) => p.id === entries[0][0])?.name ?? "?"}`
    if (parts.length === 1 && potP > 0) return potIsCard ? L.fromCard : L.fromPot
    return parts.join(" + ")
  }

  const S = {
    page: { minHeight: "100vh", background: "#fdf6e3", color: "#4a3f1e", fontFamily: "system-ui,-apple-system,sans-serif", padding: "0 0 90px" } as React.CSSProperties,
    wrap: { maxWidth: 560, margin: "0 auto", padding: "16px 16px" } as React.CSSProperties,
    card: { background: "#fff", border: "1px solid rgba(120,95,20,0.14)", borderRadius: 18, padding: 16, marginBottom: 13, boxShadow: "0 4px 16px -8px rgba(120,95,20,0.25)" } as React.CSSProperties,
    h1: { fontSize: 23, fontWeight: 800, margin: "0 0 2px" } as React.CSSProperties,
    h3: { fontSize: 17.5, fontWeight: 800, margin: "0 0 10px" } as React.CSSProperties,
    sub: { fontSize: 15.5, color: "#8a7d55", margin: "0 0 12px", lineHeight: 1.55 } as React.CSSProperties,
    btn: { border: "1px solid rgba(120,95,20,0.18)", background: "#fff", color: "#4a3f1e", borderRadius: 12, padding: "12px 16px", fontSize: 16, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
    btnP: { border: "none", background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", borderRadius: 14, padding: "16px 18px", fontSize: 18, fontWeight: 800, cursor: "pointer", width: "100%", boxShadow: "0 4px 12px -4px rgba(224,138,0,0.6)" } as React.CSSProperties,
    input: { border: "1px solid rgba(120,95,20,0.22)", borderRadius: 10, padding: "11px 12px", fontSize: 17, color: "#4a3f1e", outline: "none", width: 84, textAlign: "right" } as React.CSSProperties,
    seg: (on: boolean) => ({ flex: 1, textAlign: "center", padding: "11px 6px", borderRadius: 10, fontSize: 15.5, fontWeight: 800, cursor: "pointer", background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#f3ead2", color: on ? "#fff" : "#8a7d55" } as React.CSSProperties),
    step: { width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(120,95,20,0.18)", background: "#f3ead2", color: "#8a5e0f", fontSize: 22, fontWeight: 800, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
    chip: (n: number) => ({ position: "relative", padding: "10px 14px", borderRadius: 20, fontSize: 16, fontWeight: 700, cursor: "pointer", userSelect: "none", border: n > 0 ? "1px solid rgba(240,165,0,0.5)" : "1px solid rgba(120,95,20,0.15)", background: n > 0 ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#faf4e4", color: n > 0 ? "#fff" : "#8a7d55" } as React.CSSProperties),
    badge: { marginLeft: 5, background: "rgba(0,0,0,0.22)", borderRadius: 20, padding: "0 6px", fontSize: 13, fontWeight: 800 } as React.CSSProperties,
    pill: { fontSize: 13.5, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: "rgba(120,95,20,0.08)", color: "#8a7d55" } as React.CSSProperties,
    row: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
    tab: (on: boolean) => ({ padding: "9px 14px", borderRadius: 20, fontSize: 15.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", background: on ? "#4a3f1e" : "#f3ead2", color: on ? "#fff" : "#8a7d55" } as React.CSSProperties),
    overlay: { position: "fixed", inset: 0, background: "rgba(40,30,5,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 14 } as React.CSSProperties,
    sheet: { background: "#fff", borderRadius: 20, padding: 20, width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" } as React.CSSProperties,
  }
  const potTag = (
    <span onClick={() => setShowPot(true)} style={{ ...S.pill, cursor: "pointer", padding: "5px 11px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(120,95,20,0.08)", color: potRemaining > 0 ? "#1f8a4c" : "#8a7d55" }}>{potContribTotal > 0 && potRemaining <= 0.005 && <span style={{ color: "#c0554a" }}>⚠️ </span>}{potIsCard ? "💳 drankkaart " : "🫙 pot "}{euro(potRemaining)}<span style={{ color: "#c98a00", fontWeight: 800 }}>+ toevoegen</span></span>
  )
  const renderPotModal = () => (
    <div style={{ ...S.overlay, zIndex: 60 }} onClick={closePot}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...S.row, justifyContent: "space-between", margin: "0 0 8px" }}>
          <h3 style={{ ...S.h3, fontSize: 19, margin: 0 }}>{potIsCard ? L.drinkCard : L.potTitle}</h3>
          {!settle && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#faf4e4", borderRadius: 20, padding: "4px 8px" }}>
              <button style={{ width: 26, height: 26, borderRadius: 8, background: "#f7f1e2", border: "1px solid rgba(120,95,20,0.2)", fontSize: 16, color: "#8a7d55", fontWeight: 800, cursor: "pointer", opacity: headcount > 1 ? 1 : 0.4 }} onClick={() => setHeadcount((n) => Math.max(1, n - 1))}>−</button>
              <span style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e", minWidth: 34, textAlign: "center" }}>👤 {headcount < 1 ? "—" : headcount}</span>
              <button style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 16, color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => setHeadcount((n) => n < 1 ? 1 : n + 1)}>+</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ ...S.pill, background: "rgba(120,95,20,0.08)", color: "#8a5e0f", fontSize: 14, padding: "4px 10px" }}>ingelegd {euro(potContribTotal)}</span>
          {potSpent > 0 && <span style={{ ...S.pill, background: "rgba(224,138,0,0.12)", color: "#c98a00", fontSize: 14, padding: "4px 10px" }}>besteed {euro(potSpent)}</span>}
          <span style={{ ...S.pill, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(224,104,92,0.14)", color: potRemaining > 0 ? "#1f8a4c" : "#c0554a", fontSize: 14, padding: "4px 10px", fontWeight: 800 }}>nog {euro(potRemaining)}</span>
        </div>
        {settle && (
        <div style={{ ...S.row, gap: 6, marginBottom: 8 }}>
          <div onClick={() => setPotIsCard(false)} style={{ ...S.seg(!potIsCard), padding: "7px 6px", fontSize: 14.5, opacity: !potIsCard ? 1 : 0.5 }}>{L.potMoney}</div>
          <div onClick={() => setPotIsCard(true)} style={{ ...S.seg(potIsCard), padding: "7px 6px", fontSize: 14.5, opacity: potIsCard ? 1 : 0.5 }}>{L.drinkCard}</div>
        </div>
        )}
        {settle && <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>{potIsCard ? "💳 Drankkaart van de groep — leg de kaartwaarde (bv. €15) in. Wat niet opgedronken wordt, is verloren en wordt gelijk over iedereen verdeeld." : "🫙 Echt geld — wat niet opgaat, krijgen de inleggers terug bij de afrekening."}</div>}


        {potRounds.map((r, i) => {
          const tot = Object.values(r.amounts).reduce((a, b) => a + (b || 0), 0)
          const who = people.filter((pp) => (r.amounts[pp.id] || 0) > 0)
          return (
            <div key={r.id} style={{ background: editPotId === r.id ? "rgba(240,165,0,0.18)" : "#faf4e4", borderRadius: 12, padding: "11px 13px", marginBottom: 8, border: editPotId === r.id ? "1px solid rgba(240,165,0,0.6)" : "1px solid transparent" }}>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <div style={{ ...S.row, gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#e8a821", color: "#fff", fontSize: 14, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e" }}>{L.nthDeposit(i + 1)}</span>
                </div>
                <div style={{ ...S.row, gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#1f8a4c" }}>{euro(tot)}</span>
                  {editPotId === r.id ? (
                    <span style={{ fontSize: 14, color: "#c98a00", fontWeight: 800 }}>{L.beingEdited}</span>
                  ) : (settle ? rounds.length === 0 : potSpent < 0.005) ? (
                    <div style={{ ...S.row, gap: 8 }}>
                      <span style={{ fontSize: 15, color: "#c0554a", cursor: "pointer", fontWeight: 700 }} onClick={() => removePotRound(r.id, `${i + 1}e inleg`)}>🗑️</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "#b3a988" }}>🔒</span>
                  )}
                </div>
              </div>
              {settle && who.length > 0 && (
                <div style={{ fontSize: 14, color: "#8a7d55", marginTop: 5, paddingLeft: 30 }}>{who.map((pp) => `${pp.name} ${euro(r.amounts[pp.id] || 0)}`).join(" · ")}</div>
              )}
            </div>
          )
        })}

        {(potRounds.length === 0 || potBuilderOpen || editPotId !== null) ? (
        <>
        {potIsCard ? (
        <div style={{ background: "rgba(240,165,0,0.08)", border: "1px dashed rgba(240,165,0,0.5)", borderRadius: 12, padding: 11, marginTop: 4 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#8a5e0f" }}>{editPotId !== null ? "✏️ kaart wijzigen" : "➕ Drankkaart inleggen"}</span>
            {potDraftTotal > 0 && <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1f8a4c" }}>+{euro(potDraftTotal)}</span>}
          </div>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{L.cardValue}</span>
            <div style={{ ...S.row, gap: 4 }}><span style={{ fontSize: 15, color: "#8a7d55", fontWeight: 700 }}>€</span><input style={{ ...S.input, width: 70 }} type="text" inputMode="decimal" placeholder="15" value={cardValue} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setCardValue(v); if (settle) applyCard(cardPayers, v); else setPotDraft({ pot: parseFloat(v.replace(",", ".")) || 0 }) }} /></div>
          </div>
          {settle && <>
          <div style={{ fontSize: 14, color: "#8a7d55", fontWeight: 700, marginBottom: 6 }}>{L.whoBoughtCard}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            <span onClick={cardSelectAll} style={{ ...S.pill, cursor: "pointer", fontSize: 14.5, padding: "6px 12px", background: "rgba(31,138,76,0.14)", color: "#1f8a4c", fontWeight: 800, border: "1px dashed rgba(31,138,76,0.5)" }}>{L.everyone}</span>
            {people.map((p) => { const on = cardPayers.includes(p.id); const amt = potDraft[p.id] || 0; return <span key={p.id} onClick={() => toggleCardPayer(p.id)} style={{ ...S.pill, cursor: "pointer", fontSize: 14.5, padding: "6px 12px", background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "rgba(240,165,0,0.1)", color: on ? "#fff" : "#8a5e0f", fontWeight: 700 }}>{p.name} {on ? euro(amt) : "€0"}</span> })}
          </div>
          </>}
        </div>
        ) : (
        <div style={{ background: "rgba(240,165,0,0.08)", border: "1px dashed rgba(240,165,0,0.5)", borderRadius: 12, padding: 11, marginTop: 4 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#8a5e0f" }}>{editPotId !== null ? "✏️ inleg wijzigen" : (potRounds.length === 0 ? `➕ ${L.firstDeposit}` : `➕ ${L.addToPot}`)}</span>
            {potDraftTotal > 0 && <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1f8a4c" }}>+{euro(potDraftTotal)}</span>}
          </div>
          {settle ? (
          <>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: "#8a7d55", fontWeight: 700 }}>{L.equalSplit}</span>
            <span style={{ fontSize: 13.5, color: "#c0554a", fontWeight: 700, cursor: "pointer" }} onClick={resetPotDraft}>{L.resetContrib}</span>
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {[5, 10, 20, 30].map((v) => {
              const on = everyoneChoice === v
              return <button key={v} style={{ ...S.btn, padding: "5px 12px", fontSize: 15, background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: on ? "#fff" : "#4a3f1e", border: on ? "none" : "1px solid rgba(120,95,20,0.18)" }} onClick={() => { setEveryoneChoice(v); setEveryoneDraft(""); setEveryoneAmt(v) }}>€{v}</button>
            })}
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: "#8a7d55" }}>{L.ownAmount}</span>
            <input style={{ ...S.input, width: 62, padding: "5px 8px", fontSize: 14, borderColor: everyoneChoice === "custom" ? "#e08a00" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" placeholder="€" value={everyoneDraft} onChange={(e) => setEveryoneDraft(e.target.value.replace(/[^0-9.,]/g, ""))} />
            <button style={{ ...S.btn, padding: "5px 11px", fontSize: 14, opacity: (parseFloat(everyoneDraft.replace(",", ".")) || 0) > 0 ? 1 : 0.5 }} onClick={() => { const v = parseFloat(everyoneDraft.replace(",", ".")) || 0; if (v > 0) { setEveryoneChoice("custom"); setEveryoneAmt(v) } }}>toepassen</button>
          </div>
          {people.map((p) => (
            <div key={p.id} style={{ ...S.row, gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
              <span style={{ fontSize: 15.5, fontWeight: 800, width: 112, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{contribOf(p.id) > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#8a7d55" }}> · {euro(contribOf(p.id))}</span>}</span>
              <input style={{ ...S.input, width: 58, padding: "5px 8px", fontSize: 14.5, flexShrink: 0 }} type="text" inputMode="decimal" placeholder="€" value={potDraft[p.id] ?? ""} onChange={(e) => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: parseFloat(e.target.value.replace(",", ".")) || 0 })) }} />
              <button style={{ ...S.btn, padding: "5px 9px", fontSize: 14, color: "#c0554a", flexShrink: 0 }} onClick={() => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: 0 })) }}>↺</button>
              <span style={{ fontSize: 15, fontWeight: 800, marginLeft: "auto", textAlign: "right", color: (potDraft[p.id] || 0) > 0 ? "#1f8a4c" : "#b3a988" }}>{(potDraft[p.id] || 0) > 0 ? "+" + euro(potDraft[p.id] || 0) : "+€0"}</span>
            </div>
          ))}
          </>
          ) : (
          <>
          {/* Snelle rondjes: iedereen legt hetzelfde in. Totaal = per man × aantal.
              Het aantal staat hier, zodat elke inleg weet voor hoeveel mensen hij gold. */}
          <div style={{ ...S.row, justifyContent: "space-between", background: "#faf4e4", borderRadius: 12, padding: "10px 13px", marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#4a3f1e" }}>👤 {L.potHowManyQ}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button style={{ width: 34, height: 34, borderRadius: 9, background: "#f7f1e2", border: "1px solid rgba(120,95,20,0.2)", fontSize: 18, color: "#8a7d55", fontWeight: 800, cursor: "pointer", opacity: headcount > 1 ? 1 : 0.4 }} onClick={() => setHeadcount((n) => Math.max(1, n - 1))}>−</button>
              <span style={{ fontSize: 20, fontWeight: 800, minWidth: 26, textAlign: "center", color: "#4a3f1e" }}>{headcount < 1 ? 1 : headcount}</span>
              <button style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 18, color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => setHeadcount((n) => n < 1 ? 2 : n + 1)}>+</button>
            </div>
          </div>
          <div style={{ ...S.row, gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 21, color: "#8a7d55", fontWeight: 700 }}>€</span>
            <input style={{ ...S.input, flex: 1, fontSize: 21, fontWeight: 800, padding: "10px 12px", color: "#c88a1a", textAlign: "right" }} type="text" inputMode="decimal" placeholder="0,00"
              value={potPerMan ? String(potPerMan).replace(".", ",") : ""}
              onChange={(e) => setPotPerMan(parseFloat(e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0)} />
            <span style={{ fontSize: 15, color: "#8a7d55", fontWeight: 700, whiteSpace: "nowrap" }}>{L.perManShort}</span>
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {[5, 10, 20].map((v) => (
              <button key={v} style={{ ...S.btn, flex: 1, padding: "8px 6px", fontSize: 15, fontWeight: 800, background: potPerMan === v ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: potPerMan === v ? "#fff" : "#4a3f1e", border: potPerMan === v ? "none" : "1px solid rgba(120,95,20,0.18)" }} onClick={() => setPotPerMan(v)}>€{v}</button>
            ))}
            <button style={{ ...S.btn, padding: "8px 11px", fontSize: 14, color: "#c0554a" }} onClick={() => setPotPerMan(0)}>↺</button>
          </div>
          {(() => {
            const nieuweInleg = potPerMan * Math.max(1, headcount)
            const alIn = potRemaining // wat er NU nog in zit (na eerder uitgeven)
            const heeftPot = potContribTotal > 0.005
            return heeftPot ? (
              <div style={{ background: "rgba(31,138,76,0.08)", borderRadius: 12, padding: "11px 13px" }}>
                <div style={{ ...S.row, justifyContent: "space-between", fontSize: 14.5, color: "#6b5f3a", marginBottom: 4 }}>
                  <span>{L.alreadyInPot}</span><span style={{ fontWeight: 700 }}>{euro(alIn)}</span>
                </div>
                <div style={{ ...S.row, justifyContent: "space-between", fontSize: 14.5, color: "#1f6b3a", marginBottom: 7 }}>
                  <span>{L.nowAdding}</span><span style={{ fontWeight: 700 }}>+ {euro(nieuweInleg)}</span>
                </div>
                <div style={{ ...S.row, justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(31,138,76,0.2)", paddingTop: 7 }}>
                  <span style={{ fontSize: 15, color: "#1f6b3a", fontWeight: 800 }}>{L.newPotTotal}</span>
                  <span style={{ fontSize: 21, color: "#1f8a4c", fontWeight: 800 }}>{euro(alIn + nieuweInleg)}</span>
                </div>
              </div>
            ) : (
              <div style={{ ...S.row, justifyContent: "center", alignItems: "baseline", gap: 8, padding: "11px", background: "rgba(31,138,76,0.09)", borderRadius: 12 }}>
                <span style={{ fontSize: 15, color: "#1f6b3a", fontWeight: 700 }}>{L.potTotalIn}</span>
                <span style={{ fontSize: 23, fontWeight: 800, color: "#1f8a4c" }}>{euro(nieuweInleg)}</span>
              </div>
            )
          })()}
          </>
          )}
        </div>
        )}
        {editPotId !== null ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={cancelEditPot}>✕ annuleer</button>
            <button style={{ ...S.btnP, flex: 2 }} onClick={saveEditPot}>{potDraftTotal > 0 ? L.addContrib(euro(potDraftTotal)) : L.removeContrib}</button>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <button style={{ ...S.btnP, width: "100%" }} onClick={saveQuickPot}>{potDraftTotal > 0
              ? (!settle && potContribTotal > 0.005 ? L.setPotTo(euro(potRemaining + potDraftTotal)) : L.addContrib(euro(potDraftTotal)))
              : L.ready}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 14, padding: "9px 6px", color: "#a89a6f" }}
              onClick={() => { setPotDraft({}); setPotPerMan(0); if (potRounds.length === 0) setShowPot(false); else setPotBuilderOpen(false) }}>✕ {L.cancel}</button>
          </div>
        )}
        </>
        ) : (
          <div>
            {potRounds.length > 0 && (
              <div style={{ ...S.row, justifyContent: "space-between", padding: "10px 13px", background: "rgba(31,138,76,0.09)", borderRadius: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#1f6b3a" }}>{L.potTotalIn}</span>
                <span style={{ fontSize: 19, fontWeight: 800, color: "#1f8a4c" }}>{euro(potContribTotal)}</span>
              </div>
            )}
            {potJustAdded ? (
              // Net iets ingelegd: afronden is nu de logische stap.
              <>
                <button style={{ ...S.btnP, width: "100%", marginTop: 4 }} onClick={closePot}>{L.ready}</button>
                <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 14, padding: "9px 6px" }} onClick={() => setPotBuilderOpen(true)}>{L.addMoreToPot}</button>
              </>
            ) : (
              <>
                <button style={{ ...S.btnP, width: "100%", marginTop: 4 }} onClick={() => setPotBuilderOpen(true)}>{L.addPotContrib}</button>
                <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 14, padding: "9px 6px" }} onClick={closePot}>{L.ready}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
  const renderDialogs = () => (
    <>
      {confirmDlg && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setConfirmDlg(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...S.h3, fontSize: 18 }}>{L.confirmTitle}</h3>
            <p style={{ fontSize: 15.5, color: "#4a3f1e", lineHeight: 1.55, marginBottom: 16, whiteSpace: "pre-line" }}>{confirmDlg.msg}</p>
            {confirmDlg.variant === "danger" ? (
              <>
                <button style={{ ...S.btnP, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)", boxShadow: "none" }} onClick={() => setConfirmDlg(null)}>{L.backFinish}</button>
                <button style={{ background: "none", border: "none", width: "100%", marginTop: 10, fontSize: 14.5, color: "#c0554a", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
              </>
            ) : (
              <>
                {confirmDlg.no ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btn, flex: 1, fontSize: 14.5, padding: "11px 4px" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
                      <button style={{ ...S.btnP, flex: 1, fontSize: 15, padding: "11px 4px" }} onClick={() => { const f = confirmDlg?.onNo; setConfirmDlg(null); f && f() }}>{confirmDlg.no}</button>
                    </div>
                    <button style={{ background: "none", border: "none", width: "100%", marginTop: 11, fontSize: 14.5, color: "#a89a6f", fontWeight: 700, cursor: "pointer" }} onClick={() => setConfirmDlg(null)}>{L.cancel}</button>
                  </>
                ) : (
                  <>
                    <button style={{ ...S.btnP, background: "linear-gradient(135deg,#e0685c,#c0554a)", boxShadow: "none" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
                    <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => { const f = confirmDlg?.onNo; setConfirmDlg(null); f && f() }}>← terug</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {notice && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setNotice("")}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 16, color: "#4a3f1e", lineHeight: 1.55, marginBottom: 18, fontWeight: 600 }}>{notice}</p>
            <button style={S.btnP} onClick={() => setNotice("")}>OK</button>
          </div>
        </div>
      )}
      {showPeoplePop && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setShowPeoplePop(false)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...S.h3, fontSize: 18, marginBottom: 4 }}>👤 {L.howManyPeople}</h3>
            <p style={{ fontSize: 14.5, color: "#8a7d55", lineHeight: 1.5, marginBottom: 16 }}>{view === "quickSettle" ? L.headcountNotRetro : L.headcountForward}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 18 }}>
              <button style={{ width: 44, height: 44, borderRadius: 12, background: "#f7f1e2", border: "1px solid rgba(120,95,20,0.2)", fontSize: 23, color: "#8a7d55", fontWeight: 800, cursor: "pointer", opacity: headcount > 1 ? 1 : 0.4 }} onClick={() => setHeadcount((n) => Math.max(1, n - 1))}>−</button>
              <span style={{ fontSize: 30, fontWeight: 800, minWidth: 44, textAlign: "center", color: headcount < 1 ? "#c4b896" : "#4a3f1e" }}>{headcount < 1 ? "—" : headcount}</span>
              <button style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 23, color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => setHeadcount((n) => n < 1 ? 1 : n + 1)}>+</button>
            </div>
            <button style={S.btnP} onClick={() => setShowPeoplePop(false)}>{L.ready}</button>
          </div>
        </div>
      )}
      {newcomer && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", zIndex: 60, pointerEvents: "none", padding: "0 12px" }}>
          <div style={{ pointerEvents: "auto", background: "#1f6b3a", color: "#fff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.22)", maxWidth: "94%", minWidth: 240 }}>
            <div style={{ ...S.row, justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>👋 {L.someoneJoined(newcomer.name)}</span>
              <button onClick={() => setNewcomer(null)}
                style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 19, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 3 }}>
              📱 {L.joinedOfTotal(people.filter((p) => p.claimedBy).length, people.length)}
            </div>
            {isAdmin && (
              <button onClick={() => { removePerson(newcomer.id); setNewcomer(null) }}
                style={{ marginTop: 9, width: "100%", border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", borderRadius: 10, padding: "7px 9px", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>{L.notRight}</button>
            )}
          </div>
        </div>
      )}
    </>
  )
  const Header = () => {
    const onboarding = view === "setup" || view === "settings"
    return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div onClick={goSiteHome} style={{ cursor: "pointer", ...S.row, gap: 10 }}>
          <RundoLogo size={40} />
          <div style={{ ...S.h1, fontSize: 21, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Rundo <span style={{ color: "#e08a00" }}>Party</span></div>
        </div>
        {!!groupId && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Pot altijd binnen handbereik, rechtsboven — als geldzak. */}
            <span onClick={() => setShowPot(true)} style={{ cursor: "pointer", padding: "7px 14px 7px 9px", borderRadius: 22, fontSize: 16, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "#fff", border: potRemaining > 0.005 ? "1px solid rgba(200,138,26,0.55)" : "0.5px solid rgba(120,95,20,0.3)" }}>
              {potContribTotal > 0 && potRemaining <= 0.005 && <span style={{ color: "#c0554a" }}>⚠️</span>}
              {potIsCard ? (
                <span style={{ fontSize: 20 }}>💳</span>
              ) : (
                <svg width="27" height="27" viewBox="0 0 40 40" style={{ display: "block" }}>
                  <path d="M16 13 L14 7 Q20 5 26 7 L24 13 Z" fill="#d99616" stroke="#b9821a" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M13 14 Q20 11 27 14 Q33 19 32 27 Q31 35 20 35 Q9 35 8 27 Q7 19 13 14 Z" fill="#e8a821" stroke="#b9821a" strokeWidth="1.5"/>
                  <text x="20" y="29" fontSize="12" fontWeight="800" fill="#5a3d0a" textAnchor="middle">€</text>
                </svg>
              )}
              <span style={{ color: "#c88a1a" }}>{euro(potRemaining)}</span>
              <span style={{ color: "#c98a00", fontWeight: 800 }}>+</span>
            </span>
          </div>
        )}
      </div>
      {/* Groepsnaam + aantal personen — gecentreerd onder de logobalk. Bij snelle rondjes
          is het aantal klikbaar naar de instellingen. */}
      {groupName.trim() && (
        <div style={{ textAlign: "center", marginTop: 9 }}>
          {/* De naam is aanpasbaar: potlood + omkadering maken dat zichtbaar. Op het
              instellingenscherm staat het naamveld al open, dus daar geen tweede ingang. */}
          {editName && !onboarding ? (
            <input autoFocus value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onBlur={() => { setEditName(false); persistSettings() }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
              style={{ ...S.input, width: "auto", minWidth: 180, maxWidth: "88%", textAlign: "center", fontSize: 17, fontWeight: 800, padding: "5px 13px", borderRadius: 16, background: "#fffdf6", border: "1px solid rgba(240,165,0,0.8)" }} />
          ) : (
            <div onClick={() => { if (!onboarding) setEditName(true) }} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: onboarding ? "default" : "pointer", padding: "5px 13px", borderRadius: 16, background: "#fffdf6", border: "1px dashed rgba(240,165,0,0.55)" }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#4a3f1e", lineHeight: 1.2 }}>{groupName.trim()}</span>
              {!onboarding && <span style={{ fontSize: 13 }}>✏️</span>}
            </div>
          )}
          {!onboarding && (
            <div style={{ fontSize: 12.5, color: "#a89a6f", fontWeight: 700, marginTop: 3 }}>{L.tapToRename}</div>
          )}
          {settle && (
            <div style={{ fontSize: 14, fontWeight: 700, color: "#8a7d55", marginTop: 2 }}>👥 {people.length}</div>
          )}
        </div>
      )}
      {!onboarding && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={{ ...S.btn, flex: 1.5, padding: "11px 4px", fontSize: 14, fontWeight: 700, lineHeight: 1.15 }} onClick={() => { if (settle && unassignedAllRounds > 0) { setNotice(L.assignFirstNote); return } if (!settle && !lastRoundHandled) { setNotice(L.finishRoundFirst); return } goHome() }}>{L.groupSettings}</button>
          {settle ? (
            <button style={{ ...S.btn, flex: 1, padding: "11px 4px", fontSize: 15, fontWeight: 700, opacity: (view === "hub" || (settle && unassignedAllRounds > 0)) ? 0.45 : 1 }} onClick={() => { if (settle && unassignedAllRounds > 0) { setNotice(L.assignFirstNote); return } goHub() }}>{L.overview}</button>
          ) : (
            <button style={{ flex: 1.2, padding: "11px 4px", fontSize: 15, fontWeight: 800, borderRadius: 10, cursor: "pointer",
              border: view === "roundsOverview" ? "none" : "1px solid rgba(120,95,20,0.25)",
              background: view === "roundsOverview" ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff",
              color: view === "roundsOverview" ? "#fff" : "#8a7d55" }}
              onClick={() => { if (!lastRoundHandled) { setNotice(L.finishRoundFirst); return } if (rounds.length >= 1) { setOverviewBackTo(view === "order" ? "order" : "hub"); setView("roundsOverview") } else setNotice(L.noRoundsYet) }}>{L.roundsOverviewBtn}</button>
          )}
          {settle && <button style={{ ...S.btn, flex: 1, padding: "11px 4px", fontSize: 15, fontWeight: 700, opacity: (view === "final" || (settle && unassignedAllRounds > 0)) ? 0.45 : 1 }} onClick={() => { if (settle && unassignedAllRounds > 0) { setNotice(L.assignFirstNote); return } goFinal() }}>{L.settleBtn}</button>}
          {!settle && rounds.length >= 1 && (
            !lastRoundHandled ? (
              // Bezig een rondje af te ronden op de hub: geen afreken-knop maar een rustig
              // label dat toont waar je bent. Niet klikbaar, niet opgelicht.
              <div style={{ flex: 1, padding: "11px 4px", fontSize: 15, fontWeight: 800, borderRadius: 10, textAlign: "center", background: "#faf4e4", color: "#8a5e0f", border: "1px solid rgba(240,165,0,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{L.roundWord} {roundNr}</div>
            ) : (
              <button style={{ flex: 1, padding: "11px 4px", fontSize: 15, fontWeight: 700, borderRadius: 10, cursor: "pointer",
                border: view === "quickSettle" ? "none" : "1px solid rgba(120,95,20,0.25)",
                background: view === "quickSettle" ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff",
                color: view === "quickSettle" ? "#fff" : "#8a7d55" }}
                onClick={goQuickSettle}>{L.quickSettleTitle}</button>
            )
          )}
        </div>
      )}
    </div>
    )
  }

  // ── START ───────────────────────────────────────────────────────────────────
  // ── Laden (gast opent de link) ──────────────────────────────────────────────
  if (booting) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 15.5, color: "#8a7d55" }}>{L.loading}</div>
      </div>
    )
  }

  // ── GAST: wie ben jij? ──────────────────────────────────────────────────────
  // Twee wegen naar binnen: tik op je naam als de admin ze al invulde, of neem een
  // lege plaats en typ ze zelf. Een naam is een etiket; claimen is wat jouw telefoon
  // aan die plaats koppelt. Dat scheiden is wat de app laat werken voor wie NIET
  // scant — de admin kan voor hem blijven aanduiden.
  if (groupId && !isAdmin && !meId) {
    const vrij = people.filter((p) => !p.claimedBy)
    const metNaam = vrij.filter((p) => p.named)
    const leeg = vrij.filter((p) => !p.named)
    return (
      <div style={S.page}><div style={S.wrap}>
        {renderDialogs()}
        <div style={{ display: "flex", justifyContent: "flex-end" }}><LanguageToggle compact /></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24, marginTop: 8 }}>
          <div style={{ ...S.row, gap: 13 }}>
            <RundoLogo size={54} />
            <div style={{ ...S.h1, fontSize: 28 }}>Rundo <span style={{ color: "#e08a00" }}>Party</span></div>
          </div>
          <div style={{ fontSize: 15.5, color: "#8a7d55", marginTop: 10 }}>{L.invitedFor} <b style={{ color: "#4a3f1e" }}>{groupName}</b></div>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0 }}>{L.whoAreYou}</h3>

          {vrij.length === 0 ? (
            <>
              <div style={{ fontSize: 14.5, color: "#8a7d55", marginBottom: 10, lineHeight: 1.5 }}>{L.allSeatsTaken}</div>
              <input id="latecomer-name" style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 17, marginBottom: 10 }}
                placeholder={L.yourName} autoComplete="name" />
              <button disabled={busy} style={{ ...S.btnP, width: "100%", opacity: busy ? 0.5 : 1 }}
                onClick={() => {
                  const el = document.getElementById("latecomer-name") as HTMLInputElement | null
                  joinAsLatecomer((el?.value || "").trim())
                }}>{L.joinAddSeat}</button>
            </>
          ) : (
            <>
              {metNaam.length > 0 && (
                <>
                  <div style={{ fontSize: 14.5, color: "#8a7d55", marginBottom: 10, lineHeight: 1.5 }}>{L.tapYourName}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: leeg.length ? 16 : 0 }}>
                    {metNaam.map((p) => (
                      <button key={p.id} disabled={busy} onClick={() => claimSeat(p.id, p.name)}
                        style={{ ...S.btn, padding: "13px 8px", fontWeight: 800, fontSize: 15.5, opacity: busy ? 0.5 : 1 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {leeg.length > 0 && (
                <>
                  <div style={{ fontSize: 14.5, color: "#8a7d55", marginBottom: 8, lineHeight: 1.5 }}>
                    {metNaam.length > 0 ? L.notThere : L.fillNameSeat}
                  </div>
                  <input id="guest-name" style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 17, marginBottom: 10 }}
                    placeholder={L.yourName} autoComplete="name" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                    {leeg.map((p) => (
                      <button key={p.id} disabled={busy}
                        onClick={() => {
                          const el = document.getElementById("guest-name") as HTMLInputElement | null
                          const naam = (el?.value || "").trim()
                          if (!naam) { setNotice(L.fillNameFirst); return }
                          claimSeat(p.id, naam)
                        }}
                        style={{ ...S.btn, padding: "13px 8px", fontWeight: 800, opacity: busy ? 0.5 : 1 }}>
                        {L.seat(p.seat)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {people.some((p) => p.claimedBy) && (
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{L.alreadyJoined}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {people.filter((p) => p.claimedBy).map((p) => <span key={p.id} style={S.pill}>📱 {p.name}</span>)}
            </div>
          </div>
        )}
      </div></div>
    )
  }

  // ── GAST: bestellen ────────────────────────────────────────────────────────
  // Eén taak, één scherm: tik aan wat JIJ wil. Geen personen kiezen, geen bedragen,
  // geen pot — dat is werk voor wie naar de toog gaat. De gast ziet enkel zichzelf.
  if (groupId && !isAdmin && meId) {
    const ik = people.find((p) => p.id === meId)!
    const zoekt = normText(drinkSearch).length > 0
    const catDrinks = zoekt ? drinks.filter((d) => drinkMatches(d.name, drinkSearch)) : drinks.filter((d) => d.cat === activeCat)
    const lijst = zoekt ? catDrinks : catDrinks.filter((d) => fullList || d.fav || aQty(d.id, meId) > 0)
    const mijn = drinks.filter((d) => aQty(d.id, meId) > 0)
    const mijnAantal = mijn.reduce((a, d) => a + aQty(d.id, meId), 0)
    const bezig = !!openRoundId

    // Wat de gast op dit moment staat. Zelfde helpers als de admin gebruikt, dus de
    // cijfers kunnen niet uit elkaar lopen.
    const mijnVerbruik = consumption(meId) + cupOwn(meId)
    const mijnBetaald = paidByPerson(meId) + contribOf(meId)
    const mijnSaldo = mijnBetaald - mijnVerbruik
    // Ben ik gekoppeld aan iemand? Dan is de vereffening op het groepje, niet op mij.
    const mijnGroep = settleGroups.find((g) => g.leden.some((p) => p.id === meId))
    const mijnTx = settlement.tx.filter((t) => t.from === (mijnGroep?.label ?? "") || t.to === (mijnGroep?.label ?? ""))

    return (
      <div style={S.page}><div style={S.wrap}>
        {renderDialogs()}
        {renderAddDrink()}
        {renderVoice()}

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}><LanguageToggle compact /></div>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>🍻 {groupName}</div>
            <div style={{ fontSize: 14, color: "#8a7d55" }}>
              {L.youAre} <b style={{ color: "#4a3f1e" }}>{ik.name}</b>
              {pay === "coin" ? ` · coins (1 = ${euro(coinValue)})` : ""}
            </div>
          </div>
          <button style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(120,95,20,0.2)" }}
            onClick={() => setConfirmDlg({ msg: L.notMeConfirm(ik.name), yes: L.releaseSeat, onYes: () => { setConfirmDlg(null); releaseSeat(meId) } })}>
            {L.notMe}
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setGuestTab("order")}
            style={{ ...S.btn, flex: 1, padding: "9px 4px", fontSize: 14, fontWeight: 800, opacity: guestTab === "order" ? 1 : 0.55 }}>{L.tabOrder}</button>
          <button onClick={() => setGuestTab("me")}
            style={{ ...S.btn, flex: 1, padding: "9px 4px", fontSize: 14, fontWeight: 800, opacity: guestTab === "me" ? 1 : 0.55 }}>{L.tabMe}</button>
          <button onClick={() => setGuestTab("group")}
            style={{ ...S.btn, flex: 1, padding: "9px 4px", fontSize: 14, fontWeight: 800, opacity: guestTab === "group" ? 1 : 0.55 }}>{L.tabGroup}</button>
        </div>

        {guestTab === "group" && (
          <div style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.row, justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ ...S.h3, margin: 0 }}>{groupName || L.groupTitle}</h3>
                <span style={{ ...S.pill, background: "rgba(120,95,20,0.08)", color: "#8a5e0f", flexShrink: 0 }}>{L.peopleN(people.length)}</span>
              </div>
              <div style={{ fontSize: 14, color: "#1f6b3a", fontWeight: 700, marginTop: 4 }}>📱 {L.joinedOfTotal(people.filter((p) => p.claimedBy).length, people.length)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {people.map((p) => {
                const benIkHet = p.id === meId
                const aangemeld = !!p.claimedBy
                const isHost = !!ownerDevice && p.claimedBy === ownerDevice
                return (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 11px", borderRadius: 10,
                    background: benIkHet ? "rgba(31,138,76,0.08)" : "#faf7ec",
                    border: benIkHet ? "1px solid rgba(31,138,76,0.3)" : "1px solid rgba(120,95,20,0.1)" }}>
                    <span style={{ fontSize: 15.5, fontWeight: benIkHet ? 800 : 700, color: p.named ? "#4a3f1e" : "#b3a988" }}>
                      {p.name}
                      {benIkHet && <span style={{ fontSize: 13, color: "#1f6b3a", fontWeight: 800 }}> · {L.youMark}</span>}
                      {isHost && !benIkHet && <span style={{ fontSize: 13, color: "#8a5e0f", fontWeight: 800 }}> · {L.hostMark}</span>}
                    </span>
                    <span style={{ fontSize: 13, color: aangemeld ? "#8a5e0f" : "#b3a988", fontWeight: 700 }}>
                      {aangemeld ? L.scannedSelf : L.notScannedYet}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 13.5, color: "#8a7d55", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>{L.inviteMore}</div>
          </div>
        )}

        {guestTab === "me" && (
          <>
            <div style={S.card}>
              <h3 style={{ ...S.h3, marginTop: 0 }}>{L.myTab}</h3>
              {rounds.length === 0 ? (
                <div style={{ fontSize: 15, color: "#b3a988", textAlign: "center", padding: "14px 0" }}>
                  {L.noRoundClosed}
                </div>
              ) : (
                <>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ fontSize: 15.5 }}>{L.whatYouDrank} <span style={{ fontSize: 13, color: "#8a7d55" }}>{L.yourShare}</span></span>
                    <b style={{ fontSize: 16 }}>{euro(mijnVerbruik)}</b>
                  </div>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(120,95,20,0.1)" }}>
                    <span style={{ fontSize: 15.5 }}>{L.whatYouPaid} {contribOf(meId) > 0 ? <span style={{ fontSize: 13, color: "#8a7d55" }}>{L.inclPot}</span> : null}</span>
                    <b style={{ fontSize: 16 }}>{euro(mijnBetaald)}</b>
                  </div>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "11px 0 2px" }}>
                    <span style={{ fontSize: 15.5, fontWeight: 800 }}>
                      {Math.abs(mijnSaldo) < 0.005 ? L.youAreEven : mijnSaldo > 0 ? L.youGetBack : L.youStillPay}
                    </span>
                    <b style={{ fontSize: 20, color: Math.abs(mijnSaldo) < 0.005 ? "#1f8a4c" : mijnSaldo > 0 ? "#1f8a4c" : "#c0392b" }}>
                      {euro(Math.abs(mijnSaldo))}
                    </b>
                  </div>
                  {mijnGroep?.samen && (
                    <div style={{ fontSize: 13.5, color: "#c98a00", fontWeight: 700, marginTop: 8 }}>
                      {L.settlesWith(mijnGroep.leden.filter((p) => p.id !== meId).map((p) => p.name).join(" & "))}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "#8a7d55", marginTop: 10, lineHeight: 1.5 }}>
                    {L.directionOnly}
                  </div>
                </>
              )}
            </div>

            {mijnTx.length > 0 && (
              <div style={S.card}>
                <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 8 }}>{L.howYouSettle}</h3>
                {mijnTx.map((t, i) => (
                  <div key={i} style={{ ...S.row, justifyContent: "space-between", padding: "7px 0", borderBottom: i < mijnTx.length - 1 ? "1px solid rgba(120,95,20,0.08)" : "none" }}>
                    <span style={{ fontSize: 15.5 }}><b>{t.from}</b> → {t.to}</span>
                    <b style={{ fontSize: 16 }}>{euro(t.amount)}</b>
                  </div>
                ))}
              </div>
            )}

            {rounds.length > 0 && (
              <div style={S.card}>
                <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 8 }}>{L.roundsTitle}</h3>
                {rounds.map((r) => {
                  const mijne = drinks.filter((d) => (r.orders[d.id]?.[meId] ?? 0) > 0)
                  return (
                    <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                      <div style={{ ...S.row, justifyContent: "space-between" }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{L.roundN(r.seq)}</span>
                        <span style={{ fontSize: 13.5, color: "#8a7d55" }}>{paidLabel(r)}</span>
                      </div>
                      <div style={{ fontSize: 14, color: mijne.length ? "#6b5f3a" : "#b3a988", marginTop: 3 }}>
                        {mijne.length
                          ? mijne.map((d) => `${r.orders[d.id][meId]}× ${d.name}`).join(" · ")
                          : L.nothingThisRound}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {guestTab === "order" && (
        <>
        {settle && renderRunnerBar()}
        {renderProposalGuest()}
        {/* Wat je al aantikte in dit rondje. Bovenaan, want dat is wat je wil zien. */}
        <div style={{ ...S.card, background: mijnAantal > 0 ? "rgba(31,138,76,0.06)" : "#fff" }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: mijnAantal > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>
              {bezig ? L.roundWhatYouWant(roundNr) : L.noRoundYet}
            </span>
            {mijnAantal > 0 && <span style={{ ...S.pill, background: "#1f8a4c", color: "#fff" }}>{mijnAantal}</span>}
          </div>
          {mijnAantal === 0 ? (
            <div style={{ fontSize: 14.5, color: "#8a7d55", lineHeight: 1.5, marginTop: 6 }}>
              {L.tapBelow}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mijn.map((d) => (
                <button key={d.id} onClick={() => bump(d.id, meId, -1)}
                  style={{ ...S.pill, cursor: "pointer", background: "#fff", border: "1px solid rgba(31,138,76,0.35)", color: "#1f6b3a", fontSize: 14 }}>
                  {aQty(d.id, meId)}× {d.name} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "stretch", marginBottom: 10 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
            <input value={drinkSearch} onChange={(e) => setDrinkSearch(e.target.value)} placeholder={L.searchDrink}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 36, paddingRight: drinkSearch ? 34 : 12, fontSize: 16, textAlign: "left" }} />
            {drinkSearch && (
              <button onClick={() => setDrinkSearch("")}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#8a7d55", padding: 4 }}>✕</button>
            )}
          </div>
          <button onClick={startVoice} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 13px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", background: "#fffdf6", border: "1px solid rgba(240,165,0,0.6)", color: "#c98a00", whiteSpace: "nowrap" }}>
            {L.voiceBtn} <span style={{ fontSize: 8.5, fontWeight: 800, border: "1px solid rgba(240,165,0,0.6)", borderRadius: 4, padding: "0 3px", letterSpacing: "0.03em" }}>{L.voiceBeta}</span>
          </button>
        </div>

        <div style={{ display: zoekt ? "none" : "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
          {catsPresent.map((c) => (
            <span key={c} style={S.tab(activeCat === c)} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}</span>
          ))}
        </div>

        {(lijst.length === 0 && (zoekt || activeCat !== "Eigen")) ? (
          <div style={{ ...S.card, textAlign: "center", color: "#b3a988", fontSize: 15, padding: "20px 0" }}>
            {!zoekt && !fullList ? (
              <span onClick={() => setFullList(true)} style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }}>{L.showAll}</span>
            ) : L.nothingFound}
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", whiteSpace: "nowrap", zIndex: 2 }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(200,160,90,0.5)", color: "#a89a6f", boxShadow: "0 2px 6px rgba(120,95,20,0.14)" }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12, paddingTop: (!zoekt && fullList) ? 26 : 12, paddingBottom: (!zoekt && (catDrinks.length > lijst.length || fullList)) ? 26 : 12 }}>
            {lijst.map((d) => {
              const n = aQty(d.id, meId)
              return (
                <div key={d.id} style={{ padding: "10px", borderRadius: 12, background: n > 0 ? "rgba(31,138,76,0.08)" : "#faf7ec", border: n > 0 ? "1px solid rgba(31,138,76,0.3)" : "1px solid rgba(120,95,20,0.1)" }}>
                  <div style={{ fontSize: 15.5, fontWeight: n > 0 ? 800 : 600, color: n > 0 ? "#1f6b3a" : "#6b5f3a", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                  <div style={{ ...S.row, justifyContent: "space-between", marginTop: 7 }}>
                    <button style={{ ...S.step, opacity: n > 0 ? 1 : 0.4 }} onClick={() => n > 0 && bump(d.id, meId, -1)}>−</button>
                    <span style={{ fontSize: 18, fontWeight: 800, color: n > 0 ? "#1f8a4c" : "#b3a988" }}>{n}</span>
                    <button style={S.step} onClick={() => bump(d.id, meId, 1)}>+</button>
                  </div>
                </div>
              )
            })}
            {!zoekt && (
              <div onClick={() => { setShowAddDrink(true); setNdName("") }}
                style={{ padding: "10px", borderRadius: 12, background: "#fffdf6", border: "1.5px dashed rgba(240,165,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 74, cursor: "pointer", color: "#c98a00" }}>
                <div style={{ fontSize: 20, lineHeight: 1 }}>＋</div>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 5 }}>{L.newDrinkTile}</div>
              </div>
            )}
            </div>
            {/* "Meer/minder" hangt centraal, half over de onderrand van de lijst. */}
            {!zoekt && !fullList && catDrinks.length > lijst.length && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(true)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(240,165,0,0.6)", color: "#c98a00", boxShadow: "0 2px 6px rgba(120,95,20,0.14)" }}>
                  + {catDrinks.length - lijst.length} meer ▾
                </span>
              </div>
            )}
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(200,160,90,0.5)", color: "#a89a6f", boxShadow: "0 2px 6px rgba(120,95,20,0.14)" }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 13.5, color: "#8a7d55", textAlign: "center", padding: "6px 0 20px", lineHeight: 1.5 }}>
          {L.barFootnote1}<br />
          {L.barFootnote2}
        </div>
        </>
        )}
      </div></div>
    )
  }

  if (view === "start") {
    return (
      <div style={{ ...S.page, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: "0 0 40px" }}><div style={{ ...S.wrap, paddingTop: 26 }}>
        {renderDialogs()}
        <style>{`input::placeholder,textarea::placeholder{color:#c4b896;opacity:1;} html,body{overflow-x:hidden;} button,input{font-family:inherit;}`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <div style={{ ...S.row, gap: 13 }}>
            <RundoLogo size={58} />
            <div style={{ ...S.h1, fontSize: 32, letterSpacing: "-0.02em" }}>Rundo <span style={{ color: "#e08a00" }}>Party</span></div>
          </div>
        </div>

        <div style={{ ...S.card, padding: "22px 18px" }}>
          <div style={{ textAlign: "center", fontSize: 19, fontWeight: 800, color: "#6b5f3a", marginBottom: 16 }}>{L.chooseHow}</div>

          <div>
            {/* Elke keuze is één blok: de rij én z’n voorbeeld zitten binnen dezelfde
                omlijning, zodat meteen duidelijk is wat bij wat hoort. */}
            <div style={{ borderRadius: 12, overflow: "hidden", opacity: bpSettle === true ? 0.6 : 1,
                          border: bpSettle === false ? "2.5px solid #1f8a4c" : "2px solid rgba(120,95,20,0.16)" }}>
              <button onClick={() => setBpSettle(false)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, textAlign: "left", padding: "17px 16px", border: "none", cursor: "pointer", background: bpSettle === false ? "#f0f9f4" : "#fff" }}>
                <span style={{ fontSize: 31, flexShrink: 0 }}>🍻</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 19, fontWeight: 800, color: "#4a3f1e", lineHeight: 1.25 }}>{L.modeQuick}</span>
                  <span style={{ display: "block", fontSize: 15, color: "#8a7d55", lineHeight: 1.45, marginTop: 2 }}>{L.modeQuickSub}</span>
                </span>
                {bpSettle === false && <span style={{ color: "#1f8a4c", fontWeight: 800, fontSize: 24, flexShrink: 0 }}>✓</span>}
              </button>
              {bpSettle === false && (
                <div style={{ background: "#fbfefc", borderTop: "1.5px dashed rgba(31,138,76,0.35)", padding: "14px 15px" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#5a9a75", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 11 }}>↓ {L.howItWorks}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ background: "#faf7ec", borderRadius: 18, padding: "7px 15px", fontSize: 16, color: "#6b5f3a" }}><b>3×</b> 🍺</span>
                    <span style={{ background: "#faf7ec", borderRadius: 18, padding: "7px 15px", fontSize: 16, color: "#6b5f3a" }}><b>2×</b> 🥤</span>
                    <span style={{ background: "#faf7ec", borderRadius: 18, padding: "7px 15px", fontSize: 16, color: "#6b5f3a" }}><b>1×</b> 🍷</span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(31,138,76,0.15)", paddingTop: 9 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a7d55", marginBottom: 5 }}>📋 Bestelling</div>
                    <div style={{ fontSize: 15, color: "#4a3f1e", lineHeight: 1.6 }}>3× Pintje · 2× Cola · 1× Wijn</div>
                  </div>
                </div>
              )}
            </div>

            {/* Duidelijk dat er een tweede, andere keuze volgt. */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0" }}>
              <span style={{ flex: 1, height: 2, borderRadius: 2, background: "rgba(120,95,20,0.28)" }} />
              <span style={{ fontSize: 20, fontWeight: 800, color: "#8a7d55", letterSpacing: "0.04em", padding: "0 2px" }}>{L.orWord}</span>
              <span style={{ flex: 1, height: 2, borderRadius: 2, background: "rgba(120,95,20,0.28)" }} />
            </div>

            <div style={{ borderRadius: 12, overflow: "hidden", opacity: bpSettle === false ? 0.6 : 1,
                          border: bpSettle === true ? "2.5px solid #1f8a4c" : "2px solid rgba(120,95,20,0.16)" }}>
              <button onClick={() => setBpSettle(true)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, textAlign: "left", padding: "17px 16px", border: "none", cursor: "pointer", background: bpSettle === true ? "#f0f9f4" : "#fff" }}>
                <span style={{ fontSize: 31, flexShrink: 0 }}>⚖️</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 19, fontWeight: 800, color: "#4a3f1e", lineHeight: 1.25 }}>{L.modeTitle}</span>
                  <span style={{ display: "block", fontSize: 15, color: "#8a7d55", lineHeight: 1.45, marginTop: 2 }}>{L.modeFairSub}</span>
                </span>
                {bpSettle === true && <span style={{ color: "#1f8a4c", fontWeight: 800, fontSize: 24, flexShrink: 0 }}>✓</span>}
              </button>
              {bpSettle === true && (
                <div style={{ background: "#fbfefc", borderTop: "1.5px dashed rgba(31,138,76,0.35)", padding: "14px 15px" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#5a9a75", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 11 }}>↓ {L.howItWorks}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, textAlign: "center" }}>
                    {/* De QR staat vooraan: scannen is de eerste stap, zonder scan geen Fair Split. */}
                    <div>
                      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ display: "inline-flex", padding: 3, borderRadius: 7, background: "#fff", border: "1px solid rgba(120,95,20,0.35)" }}>
                          <QRCodeSVG value="rundo-party" size={40} bgColor="transparent" fgColor="#4a3f1e" />
                        </span>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4, color: "#4a3f1e", fontWeight: 800 }}>QR scannen</div>
                    </div>
                    {[{ drank: "🍺", munten: 1, naam: "Tom" }, { drank: "🍷🍷", munten: 3, naam: "Els" }, { drank: "🍻", munten: 2, naam: "Bart" }].map((x) => (
                      <div key={x.naam}>
                        <div style={{ fontSize: 23, height: 30, whiteSpace: "nowrap", letterSpacing: -3 }}>{x.drank}</div>
                        <div style={{ height: 24, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          {Array.from({ length: x.munten }).map((_, k) => (
                            <span key={k} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#FAC775", color: "#412402", fontSize: 11.5, fontWeight: 800 }}>€</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4, color: "#8a7d55", fontWeight: 700 }}>{x.naam}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 14.5, color: "#6b5f3a", marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(31,138,76,0.15)", lineHeight: 1.5 }}>{L.modeFairLine}</div>
                </div>
              )}
            </div>
          </div>

          <button style={{ ...S.btnP, width: "100%", marginTop: 22, padding: "18px", fontSize: 20, opacity: bpSettle === null ? 0.45 : 1 }}
            disabled={bpSettle === null}
            onClick={() => startWithMode()}>{busy ? L.starting : L.startNow}</button>
        </div>

        {savedGroups.length > 0 && (() => {
          const fmt = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : `${d.getDate()}/${d.getMonth() + 1}` }
          const open = savedGroups.filter((g) => !g.finalized)
          const dicht = savedGroups.filter((g) => g.finalized)
          const rij = (g: SavedGroup) => (
            <div key={g.id} style={{ display: "flex", alignItems: "stretch", gap: 7, marginBottom: 7 }}>
              <button onClick={() => openSavedGroup(g.id)} disabled={busy}
                style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid rgba(120,95,20,0.15)", cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || L.autoName()}</div>
                  <div style={{ fontSize: 13, color: "#a89a6f", marginTop: 2 }}>
                    {fmt(g.last_active)}{g.owned ? "" : ` · ${L.asGuest}`}
                  </div>
                </div>
                <span style={{ fontSize: 17, color: "#c4b896", flexShrink: 0, marginLeft: 10 }}>›</span>
              </button>
              {g.owned && (
                <button onClick={() => deleteSavedGroup(g)} disabled={busy} aria-label={L.delGroupYes}
                  style={{ flexShrink: 0, width: 44, borderRadius: 12, background: "#fff", border: "1px solid rgba(224,104,92,0.35)", color: "#c0554a", fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🗑️</button>
              )}
            </div>
          )
          return (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#8a7d55", marginBottom: 9, letterSpacing: "0.02em" }}>{L.savedGroups}</div>
              {open.length > 0 && (
                <div style={{ marginBottom: dicht.length > 0 ? 14 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#1f8a4c", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>● {L.groupsOpen}</div>
                  {open.map(rij)}
                </div>
              )}
              {dicht.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#a89a6f", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>✓ {L.groupsClosed}</div>
                  {dicht.map(rij)}
                </div>
              )}
            </div>
          )
        })()}
      </div></div>
    )
  }

  // ── SETUP (GROEP) ────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={S.page} onClick={() => { setCoinInfo(false); setDepositInfo(false) }}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        {beginPrompt && (
          <div style={{ ...S.overlay, zIndex: 65 }} onClick={() => setBeginPrompt(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 19, marginTop: 0, marginBottom: 4 }}>{L.beforeWeStart}</h3>

              {/* De modus komt EERST — hij bepaalt of de rest nog relevant is. Bekers,
                  coins en pot bestaan alleen als je afrekent. Kies je "gewoon rondjes",
                  dan is dit scherm hiermee klaar. */}
              <p style={{ fontSize: 16, fontWeight: 700, color: "#4a3f1e", marginBottom: 10 }}>{L.modeTitle}</p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Fair Split BOVEN — de voorkeur. Al geselecteerd bij binnenkomst. */}
                <button onClick={() => setBpSettle(true)}
                  style={{ textAlign: "left", padding: "15px 15px", borderRadius: 14, cursor: "pointer",
                           background: bpSettle === true ? "#fff8e8" : "#fff",
                           boxShadow: bpSettle === true ? "0 2px 10px rgba(224,138,0,0.15)" : "0 1px 4px rgba(120,95,20,0.06)",
                           border: bpSettle === true ? "2.5px solid #e08a00" : "2px solid rgba(120,95,20,0.18)" }}>
                  <div style={{ ...S.row, gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 21 }}>⚖️</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e" }}>Fair Split</span>
                    {bpSettle === true && <span style={{ marginLeft: "auto", fontSize: 17, color: "#1f8a4c", fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 13 }}>{L.modeFairSub}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, textAlign: "center" }}>
                    {/* Zelfde opbouw als op het startscherm: eerst scannen, dan wie wat nam. */}
                    <div>
                      <div style={{ height: 51, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ display: "inline-flex", padding: 2, borderRadius: 6, background: "#fff", border: "1px solid rgba(120,95,20,0.35)" }}>
                          <QRCodeSVG value="rundo-party" size={38} bgColor="transparent" fgColor="#4a3f1e" />
                        </span>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4, color: "#4a3f1e", fontWeight: 800 }}>QR scannen</div>
                    </div>
                    {[{ drank: "🍺", munten: 1, naam: "Tom" }, { drank: "🍷🍷", munten: 3, naam: "Els" }, { drank: "🍻", munten: 2, naam: "Bart" }].map((x) => (
                      <div key={x.naam}>
                        <div style={{ fontSize: 19, height: 24, whiteSpace: "nowrap", letterSpacing: -3 }}>{x.drank}</div>
                        <div style={{ height: 22, marginTop: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          {Array.from({ length: x.munten }).map((_, k) => (
                            <span key={k} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", background: "#FAC775", color: "#412402", fontSize: 11, fontWeight: 800 }}>€</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4, color: "#8a7d55", fontWeight: 700 }}>{x.naam}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#4a3f1e", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(120,95,20,0.12)", lineHeight: 1.5 }}>{L.modeFairLine}</div>
                </button>

                {/* Geruststelling, precies waar de twijfel ontstaat. */}
                <div style={{ textAlign: "center", fontSize: 12, color: "#a89a6f", padding: "9px 0" }}>{L.modeSwitchLater}</div>

                {/* Gewoon aantallen ONDER, met bestellijstje. */}
                <button onClick={() => setBpSettle(false)}
                  style={{ textAlign: "left", padding: "15px 15px", borderRadius: 14, cursor: "pointer",
                           background: bpSettle === false ? "#fff8e8" : "#fff",
                           boxShadow: bpSettle === false ? "0 2px 10px rgba(224,138,0,0.15)" : "0 1px 4px rgba(120,95,20,0.06)",
                           border: bpSettle === false ? "2.5px solid #e08a00" : "2px solid rgba(120,95,20,0.18)" }}>
                  <div style={{ ...S.row, gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 21 }}>🍺</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e" }}>{L.modeQuick}</span>
                    {bpSettle === false && <span style={{ marginLeft: "auto", fontSize: 17, color: "#1f8a4c", fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 11 }}>{L.modeQuickSub}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ background: "#faf7ec", borderRadius: 16, padding: "5px 12px", fontSize: 14.5, color: "#6b5f3a" }}><b>3×</b> 🍺</span>
                    <span style={{ background: "#faf7ec", borderRadius: 16, padding: "5px 12px", fontSize: 14.5, color: "#6b5f3a" }}><b>2×</b> 🥤</span>
                    <span style={{ background: "#faf7ec", borderRadius: 16, padding: "5px 12px", fontSize: 14.5, color: "#6b5f3a" }}><b>1×</b> 🍷</span>
                  </div>
                  {/* Bestellijstje: wat er aan de toog moet komen. */}
                  <div style={{ borderTop: "1px solid rgba(120,95,20,0.12)", paddingTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#8a7d55", marginBottom: 5 }}>📋 Bestelling</div>
                    <div style={{ fontSize: 15, color: "#4a3f1e", lineHeight: 1.6 }}>3× Pils · 2× Cola · 1× Wijn</div>
                  </div>
                </button>
              </div>

              {bpSettle === true && (
                <div style={{ fontSize: 13.5, color: "#8a7d55", margin: "14px 0 0", lineHeight: 1.5 }}>{L.settingsLater}</div>
              )}

              <button style={{ ...S.btnP, width: "100%", marginTop: 14, opacity: bpSettle === null ? 0.45 : 1 }}
                disabled={bpSettle === null}
                onClick={applyBeginChoices}>
                {L.quickStart}
              </button>
            </div>
          </div>
        )}
        <div style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8a7d55", marginBottom: 6 }}>{L.groupNameEdit}</div>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} onBlur={() => persistSettings()} onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontSize: 16, fontWeight: 700, padding: "11px 12px", borderRadius: 10, background: "#fdfaf2" }} />
        </div>
        {settle && (
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 14 }}>{L.peopleCount}</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <button style={{ ...S.step, width: 42, height: 42, fontSize: 23, opacity: people.length > 0 ? 1 : 0.4 }} onClick={removeLastPerson}>−</button>
            <span style={{ fontSize: 26, fontWeight: 800, minWidth: 34, textAlign: "center" }}>{people.length}</span>
            <button style={{ ...S.step, width: 42, height: 42, fontSize: 23, background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", border: "none" }} onClick={addPerson}>+</button>
          </div>
          <div style={{ fontSize: 13.5, color: "#8a7d55", textAlign: "center", marginTop: 10 }}>{L.namesOptional}</div>
        </div>
        )}

        <div style={S.card}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e", marginBottom: 3 }}>{L.peopleHeader(people.length)}</div>
          <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 13, lineHeight: 1.5 }}>{L.peopleIntro(Math.max(0, people.length - 1))}</div>

          {/* Wie ben JIJ? Alleen relevant als de admin nog nergens zit — normaal is hij
              al Gast 1, dus dit blijft verborgen. Vangnet voor het randgeval. */}
          {!meId && people.length > 0 && (
            <div style={{ background: "#fff8e8", border: "1px solid rgba(240,165,0,0.4)", borderRadius: 12, padding: "11px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#8a5e0f", marginBottom: 3 }}>⭐ {L.whichAreYou}</div>
              <div style={{ fontSize: 13, color: "#8a7d55", marginBottom: 9, lineHeight: 1.45 }}>{L.pickYourName}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {people.filter((p) => !p.claimedBy).map((p) => {
                  const idx = people.indexOf(p)
                  return (
                    <button key={p.id} disabled={busy} onClick={() => claimSeat(p.id, isGuestDefault(p.name) ? `Gast ${idx + 1}` : p.name)}
                      style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(240,165,0,0.5)", background: "#fff", color: "#4a3f1e", fontWeight: 800, opacity: busy ? 0.5 : 1 }}>
                      {isGuestDefault(p.name) ? `Gast ${idx + 1}` : p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(() => {
            const mijnPlaats = people.find((p) => p.id === meId)
            // Iedereen behalve ikzelf: geclaimd (echte naam) of nog wachtend op scan.
            const anderen = people.filter((p) => p.id !== meId)
            const geclaimd = anderen.filter((p) => p.claimedBy)
            const wachtend = anderen.filter((p) => !p.claimedBy)
            const mijnIdx = mijnPlaats ? people.indexOf(mijnPlaats) : -1
            return (
              <>
                {/* JOUW plaats — de enige die de admin standaard invult. */}
                {mijnPlaats && (
                  <div style={{ background: "#faf7ec", borderRadius: 10, padding: "10px 11px", marginBottom: geclaimd.length || wachtend.length ? 8 : 0, border: "1px solid rgba(31,138,76,0.25)" }}>
                    <div style={{ ...S.row, gap: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(31,138,76,0.15)", color: "#1f6b3a", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⭐</span>
                      <input value={isGuestDefault(mijnPlaats.name) ? "" : mijnPlaats.name}
                        placeholder={L.yourSeat}
                        onChange={(e) => renamePerson(mijnPlaats.id, e.target.value === "" ? `Gast ${mijnIdx + 1}` : e.target.value)}
                        style={{ ...S.input, flex: 1, minWidth: 0, padding: "7px 9px", fontSize: 15.5, fontWeight: 800, textAlign: "left", background: "#fff" }} />
                      <span style={{ fontSize: 12, color: "#8a5e0f", background: "#f3e4c4", padding: "3px 9px", borderRadius: 10, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>✏️ {L.nameLabel}</span>
                    </div>
                  </div>
                )}

                {/* Wie al scande — echte namen, compact. */}
                {geclaimd.map((p) => {
                  const bezet = true
                  return (
                    <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 11px", borderRadius: 10, marginBottom: 6, background: "#faf7ec", border: "1px solid rgba(120,95,20,0.1)" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700, color: "#4a3f1e" }}>📱 {p.name}</span>
                      {bezet && (
                        <button onClick={() => releaseSeat(p.id)}
                          style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(120,95,20,0.2)", fontSize: 12, padding: "3px 8px" }}>
                          {L.freeUp}
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* De rest samengevat — géén zes lege velden, dus geen reflex om alles in
                    te vullen. Ze wachten op de scan. */}
                {wachtend.length > 0 && (
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "9px 11px", borderRadius: 10, background: "#fff", border: "1px dashed rgba(120,95,20,0.25)" }}>
                    <span style={{ fontSize: 14, color: "#a89a6f" }}>{L.waitingSeats(wachtend.map((p) => people.indexOf(p) + 1).join(" · "))}</span>
                  </div>
                )}

                {/* De uitzondering: iemand zonder telefoon. Bewust een aparte tik. */}
                <div style={{ borderTop: "1px solid rgba(120,95,20,0.1)", marginTop: 12, paddingTop: 11, textAlign: "center" }}>
                  <span style={{ fontSize: 13, color: "#8a7d55" }}>{L.noPhoneAdd} </span>
                  <span onClick={addPerson} style={{ fontSize: 13.5, color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{L.addSelf}</span>
                </div>
              </>
            )
          })()}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 24, marginBottom: 4 }}>
          <button style={{ ...S.btnP, width: "80%" }} onClick={() => { if (people.length === 0) { setNotice(L.addPersonFirst); return } if (unfinishedRound) { resumeRound(); return } if (onboardedOnce) { setOpenRound(rounds.length - 1); setView("hub") } else setBeginPrompt(true) }}>{unfinishedRound ? L.continueRound(roundNr) : "Volgende"}</button>
        </div>
      </div></div>
    )
  }

  // ── SETTINGS (drank, bekers, pot) ────────────────────────────────────────────
  if (view === "settings") {
    return (
      <div style={S.page} onClick={() => { setCoinInfo(false); setDepositInfo(false) }}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10 }}>⚙️ Groepsinstellingen</h3>
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>Groepsnaam</span>
            {hasSettled && <span style={{ fontSize: 13, color: "#8a7d55", fontWeight: 700 }}>🔒 vast na afrekenen</span>}
          </div>
          <input disabled={hasSettled} value={groupName} onChange={(e) => setGroupName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }} placeholder={L.groupNamePh} style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, background: hasSettled ? "#efe8d6" : "#fdfaf2", color: hasSettled ? "#8a7d55" : "#4a3f1e", cursor: hasSettled ? "not-allowed" : "text" }} />
          {!hasSettled && <div style={{ fontSize: 12.5, color: "#a89a6f", fontWeight: 700, marginTop: 6 }}>{L.tapToRename}</div>}
        </div>
        {settle && !fromOnboarding && (
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: people.length > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>{L.peopleTitle}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button style={{ ...S.step, opacity: people.length > 0 ? 1 : 0.4 }} onClick={removeLastPerson}>−</button>
              <span style={{ fontSize: 19, fontWeight: 800, minWidth: 22, textAlign: "center" }}>{people.length}</span>
              <button style={{ ...S.step, background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", border: "none" }} onClick={addPerson}>+</button>
            </div>
          </div>
          {people.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 6 }}>
              {people.map((p, idx) => (
                <input key={p.id} value={isGuestDefault(p.name) ? "" : p.name} placeholder={isGuestDefault(p.name) ? p.name : `Gast ${idx + 1}`} onChange={(e) => renamePerson(p.id, e.target.value === "" ? `Gast ${idx + 1}` : e.target.value)} style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 14.5, textAlign: "left" }} />
              ))}
            </div>
          )}
        </div>
        )}
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ ...S.row, justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 15.5, fontWeight: 700 }}>{potIsCard ? L.drinkCard : L.potTitle} <span style={{ fontSize: 14, fontWeight: 600, color: "#8a7d55" }}>— optioneel</span></span>
            {potContribTotal > 0.005 ? (
              // Twee cijfers die er echt toe doen: wat erin ging, en wat er nu nog is.
              <button style={{ ...S.btn, padding: "8px 13px", textAlign: "right", lineHeight: 1.3, flexShrink: 0 }} onClick={() => setShowPot(true)}>
                <span style={{ display: "block", fontSize: 13.5, color: "#8a7d55", fontWeight: 700 }}>{L.potInShort} {euro(potContribTotal)}</span>
                <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: potRemaining > 0.005 ? "#1f8a4c" : "#c0554a" }}>{L.potStillIn} {euro(Math.max(0, potRemaining))}</span>
              </button>
            ) : (
              <button style={{ ...S.btn, padding: "6px 12px", fontSize: 15, flexShrink: 0 }} onClick={() => setShowPot(true)}>+ inleggen</button>
            )}
          </div>
          {potChosen && potContribTotal <= 0.005 && <div style={{ marginTop: 8, textAlign: "right" }}><span onClick={() => setPotChosen(false)} style={{ fontSize: 14, color: "#c0554a", fontWeight: 700, cursor: "pointer" }}>✕ toch niet</span></div>}
        </div>

        {settle && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <h3 style={{ ...S.h3, margin: 0, fontSize: 15.5, lineHeight: 1.3, textAlign: "center" }}>{L.cupsTitle} <span onClick={(e) => { e.stopPropagation(); setDepositInfo((v) => !v); setCoinInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8, justifyContent: "center" }}>
            <div style={{ ...S.seg(!depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(false)}>uit</div>
            <div style={{ ...S.seg(depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(true)}>aan</div>
          </div>
          {depositInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 14, color: "#6b5f3a", lineHeight: 1.5 }}>♻️ <b>Herbruikbare bekers?</b>{L.cupsInfo}</div>}
          {depositOn && (
            <div style={{ marginTop: 10 }}>
              {pay === "coin" && (
                <>
                  <div style={{ ...S.row, gap: 6, marginBottom: 6 }}>
                    <div style={{ ...S.seg(depositUnit === "coin"), padding: "6px 6px", fontSize: 14 }} onClick={() => setDepositUnit("coin")}>in coins</div>
                    <div style={{ ...S.seg(depositUnit === "eur"), padding: "6px 6px", fontSize: 14 }} onClick={() => setDepositUnit("eur")}>in €</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#c98a00", marginBottom: 8, lineHeight: 1.4 }}>💡 Coins staat aan — kies of de waarborg in <b>coins</b> of <b>€</b> is.</div>
                </>
              )}
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{L.depositPerCup}</span>
                <div style={{ ...S.row, gap: 4 }}>
                  {effDepositUnit === "eur" && <span style={{ fontSize: 15, fontWeight: 700, color: "#8a7d55" }}>€</span>}
                  <input style={{ ...S.input, width: 56 }} type="text" inputMode="decimal" value={depositValue} onChange={(e) => setDepositValue(parseFloat(e.target.value.replace(",", ".")) || 0)} />
                  {effDepositUnit === "coin" && <span style={{ fontSize: 14.5, fontWeight: 700, color: "#c98a00" }}>coins</span>}
                </div>
              </div>
            </div>
          )}
        </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <h3 style={{ ...S.h3, margin: 0, fontSize: 15.5, lineHeight: 1.3, textAlign: "center" }}>{L.coinsTitle} <span onClick={(e) => { e.stopPropagation(); setCoinInfo((v) => !v); setDepositInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8, justifyContent: "center" }}>
            <div onClick={() => { const on = pay !== "coin"; setPay(on ? "coin" : "eur"); setDepositUnit(on ? "coin" : "eur") }} style={{ width: 44, height: 26, borderRadius: 20, background: pay === "coin" ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#d9cdb0", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .15s" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: pay === "coin" ? 21 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
          {coinInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 14, color: "#6b5f3a", lineHeight: 1.5 }}>🎟️ <b>Coins?</b>{L.coinsInfo}</div>}
          {pay === "coin" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>1 coin =</span>
                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={S.input} type="text" inputMode="decimal" value={coinValue} onChange={(e) => setCoinValue(parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
              </div>
              <button style={{ ...S.btn, width: "100%", marginTop: 10, fontSize: 14.5 }} onClick={() => setShowCoins((v) => !v)}>{showCoins ? "▴ verberg coin-prijzen" : L.coinPrices}</button>
              {showCoins && (() => {
                const cd = drinks.filter((d) => d.cat === coinCat)
                const vis = cd.filter((d) => coinFull || d.fav)
                return (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ ...S.sub, marginBottom: 8 }}>{L.coinPricesInfo}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {catsPresent.map((cc) => <span key={cc} style={{ ...S.tab(coinCat === cc), padding: "6px 10px", fontSize: 14 }} onClick={() => setCoinCat(cc)}>{CAT_LABEL[cc]}</span>)}
                    </div>
                    <div style={{ ...S.row, gap: 8, marginBottom: 8 }}>
                      <div style={{ ...S.seg(!coinFull), padding: "7px 6px", fontSize: 14.5 }} onClick={() => setCoinFull(false)}>{L.shortList}</div>
                      <div style={{ ...S.seg(coinFull), padding: "7px 6px", fontSize: 14.5 }} onClick={() => setCoinFull(true)}>{L.fullListBtn}</div>
                    </div>
                    {vis.length === 0 ? (
                      <div style={{ fontSize: 14.5, color: "#8a7d55", textAlign: "center", padding: "10px 0" }}>{L.noFavsHere} <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setCoinFull(true)}>{L.showAll}</span></div>
                    ) : vis.map((d) => (
                      <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(120,95,20,0.06)" }}>
                        <span style={{ fontSize: 15 }}>{d.emoji} {d.name}</span>
                        <div style={{ ...S.row, gap: 5 }}>
                          <button style={{ ...S.step, width: 26, height: 26, fontSize: 17 }} onClick={() => setCoinPrice(d.id, d.coins - 0.1)}>−</button>
                          <span style={{ minWidth: 46, textAlign: "center", fontSize: 14.5, fontWeight: 800 }}>{d.coins.toFixed(1)} c</span>
                          <button style={{ ...S.step, width: 26, height: 26, fontSize: 17 }} onClick={() => setCoinPrice(d.id, d.coins + 0.1)}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
          </div>
        </div>
        )}
        <div style={{ marginTop: 24 }}>
          {(() => {
            // In snelle rondjes telt een rondje als "afgehandeld" zodra het bevestigd of
            // overgeslagen is; dan is er nooit "ga verder", enkel een nieuw rondje.
            const echtOnafgerond = unfinishedRound && (settle || !lastRoundHandled)
            // Zolang het bedrag van het vorige rondje niet bevestigd of overgeslagen is,
            // tonen we geen "nieuw rondje" — anders loop je zo van het afronden weg.
            const magNieuw = settle || lastRoundHandled
            return rounds.length > 0 ? (
            // Er zijn afgeronde rondjes: overzicht + nieuw/verder.
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => { if (!settle) { setOverviewBackTo("hub"); setView("roundsOverview") } else { setOpenRound(rounds.length - 1); setView("hub") } }}>{L.roundsOverview}</button>
              {echtOnafgerond
                ? <button style={{ ...S.btnP, flex: 1 }} onClick={resumeRound}>{L.continueRound(roundNr)}</button>
                : magNieuw
                ? <button style={{ ...S.btnP, flex: 1 }} onClick={nextRound}>{L.newRound}</button>
                : null}
            </div>
          ) : echtOnafgerond ? (
            // Nog geen afgerond rondje, maar wel bezig met rondje 1: verder of terug.
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setNotice(L.noRoundsYet)}>{L.roundsOverview}</button>
              <button style={{ ...S.btnP, flex: 1 }} onClick={resumeRound}>{L.continueRound(roundNr)}</button>
            </div>
          ) : (
            // Groep bestaat, nog geen rondjes: kies zelf waar je heen wil.
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setView("hub")}>{L.roundsOverview}</button>
              <button style={{ ...S.btnP, flex: 1 }} onClick={() => { setActiveCat(catsPresent[0]); setView("order") }}>{L.toFirstRound}</button>
            </div>
          )
          })()}
        </div>
      </div></div>
    )
  }

  // ── ORDER ───────────────────────────────────────────────────────────────────
  if (view === "order") {
    // Zoeken gaat OVER de categorieën heen en negeert de korte lijst — anders zoek je
    // naar iets wat bestaat en krijg je "niets gevonden" omdat het toevallig niet in de
    // favorieten zit.
    const zoekt = normText(drinkSearch).length > 0
    const catDrinks = zoekt ? drinks.filter((d) => drinkMatches(d.name, drinkSearch)) : drinks.filter((d) => d.cat === activeCat)
    const catVisible = zoekt ? catDrinks : catDrinks.filter((d) => fullList || d.fav || drinkTotal(d.id) > 0)
    const needCups = depositOn && (people.some((p) => pickedUpOf(p.id) > 0) || people.some((p) => cupsBal(p.id) !== 0))
    const gaveBackTotal = people.reduce((a, p) => a + (gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id))), 0)
    const cupsBlock = needCups && !cupsChecked
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        {renderAddDrink()}
        {renderVoice()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.roundWord} {roundNr} <span style={{ fontSize: 15, fontWeight: 600, color: "#8a7d55" }}>— {L.drinksCount(roundItems)}</span>{repeated && roundItems > 0 && <span style={{ ...S.pill, marginLeft: 7, background: "rgba(31,138,76,0.14)", color: "#1f8a4c" }}>overgenomen ✓</span>}</h3>
        </div>
        {settle && renderRunnerBar()}
        {settle && renderWalk()}
        {settle && people.length > 0 && (
          <button onClick={walkStart}
            style={{ width: "100%", marginBottom: 4, border: "1.5px solid rgba(240,165,0,0.5)", background: "rgba(240,165,0,0.08)", color: "#8a5e0f", borderRadius: 12, padding: "11px 8px", fontSize: 15.5, fontWeight: 800, cursor: "pointer" }}>
            {L.walkTable}
          </button>
        )}
        {settle && people.length > 0 && <div style={{ fontSize: 12, color: "#8a7d55", textAlign: "center", marginBottom: 10, lineHeight: 1.4 }}>{L.walkIntro}</div>}
        <div style={{ display: zoekt ? "none" : "block", position: "relative", marginBottom: 10 }}>
          <div ref={catScroll} onScroll={updateCatArrows} className="rundo-catscroll" style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", padding: "0 8px 9px 0", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <style>{`.rundo-catscroll::-webkit-scrollbar{display:none}`}</style>
          {catsPresent.map((c) => {
            const openHere = drinks.some((d) => d.cat === c && (cartAnon[d.id] ?? 0) > 0)
            const actief = activeCat === c
            return <span key={c} onClick={() => { setActiveCat(c); setFullList(false) }}
              style={{ flexShrink: 0, padding: "10px 17px", borderRadius: 22, fontSize: 16, fontWeight: actief ? 800 : 700, cursor: "pointer", whiteSpace: "nowrap",
                       background: actief ? "#4a3f1e" : "#fff", color: actief ? "#fff" : "#8a7d55",
                       border: actief ? "none" : "0.5px solid rgba(120,95,20,0.22)" }}>
              {CAT_LABEL[c]}{openHere && <span style={{ marginLeft: 5, color: actief ? "#ffd27f" : "#e0685c", fontSize: 16 }}>●</span>}
            </span>
          })}
          </div>
          {catMore.left && (
            <div onClick={() => catScroll.current?.scrollBy({ left: -170, behavior: "smooth" })}
              style={{ position: "absolute", left: 0, top: 0, bottom: 9, width: 46, display: "flex", alignItems: "center", justifyContent: "flex-start", cursor: "pointer", background: "linear-gradient(to left, rgba(253,246,227,0), #fdf6e3 60%)" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", border: "1px solid rgba(120,95,20,0.3)", color: "#8a5e0f", fontSize: 17, fontWeight: 800, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</span>
            </div>
          )}
          {catMore.right && (
            <div onClick={() => catScroll.current?.scrollBy({ left: 170, behavior: "smooth" })}
              style={{ position: "absolute", right: 0, top: 0, bottom: 9, width: 46, display: "flex", alignItems: "center", justifyContent: "flex-end", cursor: "pointer", background: "linear-gradient(to right, rgba(253,246,227,0), #fdf6e3 60%)" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", border: "1px solid rgba(120,95,20,0.3)", color: "#8a5e0f", fontSize: 17, fontWeight: 800, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>›</span>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "stretch", marginBottom: 10 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
            <input value={drinkSearch} onChange={(e) => setDrinkSearch(e.target.value)}
              placeholder={L.searchDrink}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 36, paddingRight: drinkSearch ? 34 : 12, fontSize: 16, textAlign: "left" }} />
            {drinkSearch && (
              <button onClick={() => setDrinkSearch("")}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#8a7d55", padding: 4 }}>✕</button>
            )}
          </div>
          <button onClick={startVoice} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 13px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", background: "#fffdf6", border: "1px solid rgba(240,165,0,0.6)", color: "#c98a00", whiteSpace: "nowrap" }}>
            {L.voiceBtn} <span style={{ fontSize: 8.5, fontWeight: 800, border: "1px solid rgba(240,165,0,0.6)", borderRadius: 4, padding: "0 3px", letterSpacing: "0.03em" }}>{L.voiceBeta}</span>
          </button>
        </div>

        {zoekt && (
          <div style={{ fontSize: 13.5, color: "#8a7d55", marginBottom: 8 }}>
            {catVisible.length === 0
              ? "Niets gevonden — probeer een ander woord."
              : `${catVisible.length} ${catVisible.length === 1 ? "drankje" : "drankjes"} gevonden (alle categorieën)`}
          </div>
        )}

        {(catVisible.length === 0 && (zoekt || activeCat !== "Eigen")) ? (
          <div style={{ ...S.card, textAlign: "center", padding: "18px 12px", fontSize: 15, color: "#8a7d55" }}>
            Geen favorieten in {CAT_LABEL[activeCat]}. <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setFullList(true)}>{L.showAll}</span>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", whiteSpace: "nowrap", zIndex: 2 }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(200,160,90,0.5)", color: "#a89a6f", boxShadow: "0 2px 6px rgba(120,95,20,0.14)" }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12, paddingTop: (!zoekt && fullList) ? 26 : 12, paddingBottom: (!zoekt && (catDrinks.length > catVisible.length || fullList)) ? 26 : 12 }}>
              {catVisible.map((d) => {
                const tot = drinkTotal(d.id), un = cartAnon[d.id] ?? 0
                return (
                  <div key={d.id} style={{ padding: "10px 10px", borderRadius: 12, background: tot > 0 ? "rgba(31,138,76,0.08)" : "#faf4e4", border: tot > 0 ? "1.5px solid rgba(31,138,76,0.5)" : "1px solid rgba(120,95,20,0.1)", boxShadow: tot > 0 ? "0 0 0 3px rgba(31,138,76,0.1)" : "none" }}>
                    <div style={{ fontSize: 15.5, fontWeight: tot > 0 ? 800 : 600, color: tot > 0 ? "#1f6b3a" : "#6b5f3a", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                    <div style={{ ...S.row, justifyContent: "space-between", marginTop: 7 }}>
                      <button style={{ ...S.step, opacity: tot > 0 ? 1 : 0.4 }} onClick={() => bumpDown(d.id)}>−</button>
                      <span style={{ fontSize: 18, fontWeight: 800, color: tot > 0 ? "#1f8a4c" : "#b3a988" }}>{tot}</span>
                      <button style={S.step} onClick={() => bump1(d.id)}>+</button>
                    </div>
                  </div>
                )
              })}
              {!zoekt && (
                <div onClick={() => { setShowAddDrink(true); setNdName("") }}
                  style={{ padding: "10px", borderRadius: 12, background: "#fffdf6", border: "1.5px dashed rgba(240,165,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 74, cursor: "pointer", color: "#c98a00" }}>
                  <div style={{ fontSize: 20, lineHeight: 1 }}>＋</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 5 }}>{L.newDrinkTile}</div>
                </div>
              )}
            </div>
            {/* "Meer/minder" hangt centraal, half over de onderrand van de lijst. */}
            {!zoekt && !fullList && catDrinks.length > catVisible.length && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(true)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(240,165,0,0.6)", color: "#c98a00", boxShadow: "0 2px 6px rgba(120,95,20,0.14)" }}>
                  + {catDrinks.length - catVisible.length} meer ▾
                </span>
              </div>
            )}
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(200,160,90,0.5)", color: "#a89a6f", boxShadow: "0 2px 6px rgba(120,95,20,0.14)" }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
          </div>
        )}
        {roundItems > 0 && (
          <div style={{ ...S.card, padding: "10px 12px", background: "#fffdf6" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: "#8a5e0f" }}>{settle ? L.inThisRound : "📋 Bestelling"} {settle && <span style={{ fontWeight: 600, color: "#b3a988" }}>{L.assignHint}</span>}</span>
              <span style={{ ...S.pill, background: "rgba(240,165,0,0.18)", color: "#c98a00" }}>{L.drinksCount(roundItems)}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                const un = cartAnon[d.id] ?? 0
                return (
                  <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 6px 4px 10px", borderRadius: 20, fontSize: 14.5, fontWeight: 700, background: "rgba(240,165,0,0.12)", border: "1px solid rgba(240,165,0,0.35)", color: "#4a3f1e" }}>
                    <span style={{ cursor: settle ? "pointer" : "default" }} onClick={() => settle && setShowAssignAll(true)}>
                      {d.emoji} {drinkTotal(d.id)}× {d.name}{settle && un > 0 && <span style={{ color: "#c0554a", fontWeight: 800, textDecoration: "underline" }}> toewijzen</span>}
                    </span>
                    {/* Meteen weghalen — handig als je je vertikte bij het bestellen. */}
                    <button title={L.removeWord} onClick={() => clearDrink(d.id)}
                      style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: "none", background: "rgba(224,104,92,0.16)", color: "#c0554a", fontSize: 13, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                  </span>
                )
              })}
            </div>
          </div>
        )}
        {depositOn && (
          <div style={{ marginBottom: 12 }}>
            <button style={{ ...S.btn, width: "100%" }} onClick={() => setShowCups(true)}>{L.cups}</button>
          </div>
        )}
        <button style={{ ...S.btnP, opacity: roundItems === 0 ? 0.5 : 1 }} onClick={() => { if (roundItems === 0) return; if (settle) openClose(); else commitRound() }}>{L.confirmRoundTitle(roundNr)}{roundItems > 0 && <span style={{ fontSize: 14.5, fontWeight: 600, opacity: 0.85 }}> — {L.drinksCount(roundItems)}</span>}</button>
        {roundItems > 0 && (
          <button style={{ ...S.btn, width: "100%", marginTop: 10, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelOrder}>{L.cancelRound}</button>
        )}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span onClick={switchMode} style={{ fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: "#b8ac8a" }}>↺ {settle ? L.switchToQuick : L.switchToFair}</span>
        </div>

        {showAssignAll && (
          <div style={S.overlay} onClick={() => setShowAssignAll(false)}>
            <div style={{ ...S.sheet, maxHeight: "82vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ ...S.h3, margin: 0, fontSize: 19 }}>{L.assign}</h3>
                <div style={{ ...S.row, gap: 4 }}>
                  <div style={{ ...S.seg(assignMode === "person"), padding: "6px 10px", fontSize: 14, minWidth: 82, textAlign: "center" }} onClick={() => setAssignMode("person")}>{L.perPerson}</div>
                  <div style={{ ...S.seg(assignMode === "drink"), padding: "6px 10px", fontSize: 14, minWidth: 82, textAlign: "center" }} onClick={() => setAssignMode("drink")}>per drank</div>
                </div>
              </div>
              {assignMode === "person" && unassignedTotal > 0 && <div style={{ fontSize: 14.5, fontWeight: 800, color: "#c0554a", marginBottom: 4 }}>🔴 {L.notAssignedYet(unassignedTotal)}</div>}
              <div style={{ fontSize: 13, color: "#8a7d55", marginBottom: 8, lineHeight: 1.4 }}>{L.assignAnyone}</div>

              {assignMode === "drink" ? (
                drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                  const un = cartAnon[d.id] ?? 0
                  return (
                    <div key={d.id} style={{ borderTop: "1px solid rgba(120,95,20,0.1)", paddingTop: 9, marginBottom: 9 }}>
                      <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 800 }}>{d.emoji} {drinkTotal(d.id)}× {d.name}</span>
                        {un > 0 && <span style={{ fontSize: 13.5, color: "#c0554a", fontWeight: 800 }}>🔴 {un} zonder naam</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {people.map((p) => { const n = aQty(d.id, p.id); return <span key={p.id} style={{ ...S.chip(n), fontSize: 14.5, padding: "5px 10px" }} onClick={() => assignFromAnon(d.id, p.id)}>{p.name}{p.claimedBy && <span style={{ fontSize: 10, marginLeft: 3, opacity: 0.7 }}>📱</span>}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); unassignCart(d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 15.5, fontWeight: 800, lineHeight: 1 }}>−</span>}</span> })}
                        {drinkTotal(d.id) === people.length && people.length > 0 && <span onClick={() => eachOne(d.id)} style={{ ...S.chip(0), fontSize: 14.5, padding: "5px 10px", border: "1.5px dashed #c98a00", background: "rgba(240,165,0,0.1)", color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{L.eachOne}</span>}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ display: people.length > 4 ? "grid" : "block", gridTemplateColumns: people.length > 4 ? "1fr 1fr" : undefined, columnGap: 12 }}>
                {people.map((p) => {
                  const took = drinks.filter((d) => (cart[d.id]?.[p.id] ?? 0) > 0)
                  return (
                    <div key={p.id} style={{ borderTop: "1px solid rgba(120,95,20,0.1)", paddingTop: 9, marginBottom: 9 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 6 }}>{p.name}{took.length > 0 && <span style={{ fontSize: 13.5, fontWeight: 600, color: "#8a7d55" }}> · {took.reduce((a, d) => a + (cart[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {drinks.filter((d) => aQty(d.id, p.id) > 0).map((d) => { const n = aQty(d.id, p.id); return <span key={d.id} style={{ ...S.chip(n), fontSize: 14.5, padding: "5px 10px" }}>{d.emoji} {d.name}<span style={S.badge}>{n}</span><span onClick={(e) => { e.stopPropagation(); unassignCart(d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 15.5, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>−</span></span> })}
                        {drinks.filter((d) => (cartAnon[d.id] ?? 0) > 0).map((d) => <span key={"add" + d.id} onClick={() => assignFromAnon(d.id, p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14.5, padding: "5px 10px", borderRadius: 20, background: "#fff", border: "1px dashed rgba(120,95,20,0.4)", color: "#8a7d55", fontWeight: 700, cursor: "pointer" }}>+ {d.emoji} {d.name}</span>)}
                      </div>
                    </div>
                  )
                })}
                </div>
              )}
              <button style={unassignedTotal === 0 ? { ...S.btnP, marginTop: 6, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" } : { ...S.btnP, marginTop: 6 }} onClick={() => setShowAssignAll(false)}>{unassignedTotal === 0 ? "Klaar — alles toegewezen" : "Klaar"}</button>
            </div>
          </div>
        )}

        {showCups && (
          <div style={{ ...S.overlay, zIndex: 55 }} onClick={() => setShowCups(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 19 }}>🫙 Bekers — ronde {roundNr}</h3>
              <p style={{ ...S.sub }}>{L.howMuchEach} <b>terug</b>? Standaard = ruil. Iedereen kan teruggeven — ook wie niks bestelde of een beker van elders binnenbrengt (gaat dan negatief = krijgt waarborg).</p>
              <button style={{ ...S.btn, width: "100%", marginBottom: 12, fontSize: 15 }} onClick={() => { setGaveBackDraft(Object.fromEntries(people.map((p) => [p.id, 0]))); setCupsChecked(true); setShowCups(false) }}>{L.nobodyGaveBack}</button>
              {people.map((p) => {
                const bal = cupsBal(p.id), pu = pickedUpOf(p.id)
                const gb = gaveBackDraft[p.id] ?? Math.min(bal, pu)
                const newBal = bal + pu - gb
                return (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                    <div><div style={{ fontSize: 16, fontWeight: 800 }}>{p.name}</div><div style={{ fontSize: 13.5, fontWeight: 700, color: newBal < 0 ? "#1f8a4c" : "#8a7d55" }}>beker-saldo: {newBal}{newBal < 0 ? " (krijgt waarborg)" : ""}</div></div>
                    <div style={{ ...S.row, gap: 7 }}>
                      <span style={{ fontSize: 13, color: "#8a7d55" }}>{L.gaveBack}</span>
                      <button style={{ ...S.step, width: 28, height: 28, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: Math.max(0, gb - 1) })) }}>−</button>
                      <span style={{ minWidth: 16, textAlign: "center", fontSize: 16, fontWeight: 800 }}>{gb}</span>
                      <button style={{ ...S.step, width: 28, height: 28 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: gb + 1 })) }}>+</button>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={{ ...S.btn, flex: 1 }} onClick={() => setShowCups(false)}>← terug</button>
                <button style={{ ...S.btnP, flex: 2, opacity: cupsTouched ? 1 : 0.5 }} onClick={() => { if (cupsTouched) { setCupsChecked(true); setShowCups(false) } }}>{L.ready}</button>
              </div>
            </div>
          </div>
        )}

        {showClose && (
          <div style={S.overlay} onClick={() => setShowClose(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 19 }}>{L.confirmRoundTitle(roundNr)}</h3>
              {unassignedTotal > 0 && (
                <div onClick={goAssignFromWarning} style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 14.5, color: "#b0402f", cursor: "pointer" }}>
                  🔴 <b>{L.notAssignedYet(unassignedTotal)}</b> <u>{L.tapToAssign}</u>
                </div>
              )}
              {depositOn && (cupsBlock ? (
                <div style={{ background: "rgba(224,104,92,0.12)", border: "1.5px solid rgba(224,104,92,0.6)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div onClick={() => setShowCups(true)} style={{ fontSize: 14.5, color: "#b0402f", cursor: "pointer", fontWeight: 700 }}>🫙 <b>{L.cupsNotSet}</b> <u>{L.tapToArrange}</u></div>
                  <div onClick={() => setDepositOn(false)} style={{ fontSize: 13.5, color: "#8a7d55", cursor: "pointer", marginTop: 6 }}>… of <u>ga verder zonder bekers/waarborg</u> (uitschakelen).</div>
                </div>
              ) : (
                <div style={{ ...S.row, justifyContent: "space-between", background: "rgba(31,138,76,0.1)", borderRadius: 12, padding: "9px 12px", marginBottom: 12 }}>
                  <span style={{ fontSize: 14.5, color: "#1f8a4c", fontWeight: 700 }}>🫙 {gaveBackTotal > 0 ? `${gaveBackTotal} beker${gaveBackTotal === 1 ? "" : "s"} teruggegeven ✓` : "0 bekers meegegeven ✓"}</span>
                  <button style={{ ...S.btn, padding: "4px 10px", fontSize: 13.5 }} onClick={() => setShowCups(true)}>aanpassen</button>
                </div>
              ))}
              <button style={{ ...S.btnP, opacity: cupsBlock ? 0.5 : 1 }} onClick={() => !cupsBlock && commitRound()}>{L.confirmRoundBtn(roundItems)}</button>
              <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => setShowClose(false)}>Bestelling aanpassen</button>
            </div>
          </div>
        )}
      </div></div>
    )
  }

  // ── CONFIRMED (overzicht + betaling) ────────────────────────────────────────
  if (view === "confirmed") {
    const totalInUse = people.reduce((s, p) => s + Math.max(0, cupsBal(p.id)), 0)
    const last = rounds[rounds.length - 1]
    const items = last ? drinks.reduce((s, d) => s + drinkTotalRound(last, d.id), 0) : 0
    const st = paymentState()
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "flex-end", marginBottom: 8 }}>{potTag}</div>
        <div style={S.card}>
          <div style={{ ...S.row, gap: 9, marginBottom: 4 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🍻</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{L.roundConfirmed(roundNr, items)}</div>
            </div>
          </div>
          {depositOn && <div style={{ fontSize: 14.5, fontWeight: 700, color: "#8a5e0f", marginBottom: 6 }}>🫙 {totalInUse} beker{totalInUse === 1 ? "" : "s"} in omloop · {euro(totalInUse * depositPerCupEur)}</div>}
          {(() => {
            const rl = last ? drinks.filter((d) => drinkTotalRound(last, d.id) > 0) : []
            return (
              <div style={{ borderTop: "1px dashed rgba(120,95,20,0.2)", paddingTop: 8, display: "grid", gridTemplateColumns: rl.length > 4 ? "1fr 1fr" : "1fr", gap: rl.length > 4 ? "4px 14px" : 4 }}>
                {rl.map((d) => {
                  const n = drinkTotalRound(last!, d.id)
                  const who = people.filter((p) => (last!.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = last!.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                  return <div key={d.id} style={{ fontSize: 15.5 }}><b>{d.emoji} {n}× {d.name}</b>{who.length > 0 && <span style={{ color: "#8a7d55" }}> → {who.join(", ")}</span>}</div>
                })}
              </div>
            )
          })()}
          <div style={{ ...S.row, justifyContent: "space-between", gap: 8, borderTop: "1px dashed rgba(120,95,20,0.25)", marginTop: 8, paddingTop: 8 }}>
            {/* "Iemand mag gaan halen" hoort bij Fair Split, waar gasten zelf aantikken.
                Bij snelle rondjes noteert de beheerder alles zelf. */}
            {settle ? <span style={{ fontSize: 15, color: "#e08a00", fontWeight: 800 }}>{L.someoneCanGo}</span> : <span />}
            <span style={{ fontSize: 15.5, fontWeight: 800, flexShrink: 0 }}>{L.total}: {items}</span>
          </div>
          {last && (() => { const un = drinks.reduce((a, d) => a + (last.anon[d.id] ?? 0), 0); return un > 0 ? (
            <div onClick={() => { editOrder(); setShowAssignAll(true) }} style={{ marginTop: 8, background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.5)", borderRadius: 10, padding: "8px 11px", fontSize: 14.5, fontWeight: 800, color: "#b0402f", cursor: "pointer", textAlign: "center" }}>🔴 {L.notAssignedYet(un)} <u>{L.tapToAssign}</u></div>
          ) : null })()}
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>{L.exactAmount}</div>
          <div style={{ ...S.row, gap: 8, justifyContent: "center", margin: "2px 0" }}>
            <span style={{ fontSize: 21, fontWeight: 800 }}>€</span>
            <input style={{ ...S.input, width: 120, fontSize: 23, textAlign: "center", fontWeight: 800 }} type="text" inputMode="decimal" placeholder="0,00" value={amountDraft} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setAmountDraft(v); autoSplit(payPersons, payPot, v); setPaidConfirmed(false) }} />
          </div>
          <div style={{ fontSize: 13.5, color: "#8a7d55", textAlign: "center", marginBottom: 14 }}>ⓘ hierop verdeelt de app eerlijk (Fair Split)</div>

          {(parseFloat(amountDraft.replace(",", ".")) || 0) > 0 ? (
          <>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "#8a7d55", marginBottom: 7 }}>{L.paidBy} <span style={{ fontWeight: 600, color: "#b3a988" }}>{L.multiplePossible}</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            <span style={{ ...S.chip(payPot ? 1 : 0), opacity: st.potAvail <= 0.005 ? 0.45 : 1 }} onClick={() => { if (!payPot && st.potAvail <= 0.005) { setNotice(`De ${potIsCard ? "drankkaart" : "pot"} is leeg (€0). Tik rechtsboven op “${potIsCard ? "drankkaart" : "pot"} + toevoegen” om eerst in te leggen.`); return } const nextPot = !payPot; setPayPot(nextPot); autoSplit(payPersons, nextPot); setPaidConfirmed(false) }}>{potIsCard ? "💳 drankkaart" : "{L.thePot}"}</span>
            {people.map((p) => <span key={p.id} style={S.chip(payPersons.includes(p.id) ? 1 : 0)} onClick={() => togglePayPerson(p.id)}>{p.name}</span>)}
          </div>

          {st.multi && (
            <div style={{ background: "#faf4e4", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#8a7d55", marginBottom: 8 }}>Gelijk verdeeld <span style={{ fontWeight: 600, color: "#b3a988" }}>— pas aan per persoon indien nodig</span></div>
              {payPot && (
                <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
                  <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 84, borderColor: st.potOver ? "#e0685c" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" placeholder="0,00" value={potAmtDraft} onChange={(e) => { setPotAmtDraft(e.target.value.replace(/[^0-9.,]/g, "")); setPaidConfirmed(false) }} /></div>
                </div>
              )}
              {payPersons.map((pid) => (
                <div key={pid} style={{ ...S.row, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>👤 {people.find((p) => p.id === pid)?.name}</span>
                  <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 84 }} type="text" inputMode="decimal" placeholder="0,00" value={payAmts[pid] ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setPayAmts((m) => ({ ...m, [pid]: v })); setPaidConfirmed(false) }} /></div>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", paddingTop: 8, fontSize: 14, fontWeight: 800, color: st.valid ? "#1f8a4c" : "#c0554a" }}>
                Samen {euro(st.sum)} van {euro(st.total)}{st.valid ? " ✓ klopt" : st.missing > 0 ? ` — er ontbreekt ${euro(st.missing)}` : ` — ${euro(-st.missing)} te veel`}
              </div>
              {st.rounding && <div style={{ fontSize: 12, color: "#b3a988", marginTop: 3 }}>{L.roundingNote}</div>}
              {payPot && <div style={{ fontSize: 13, color: st.potOver ? "#c0554a" : "#8a7d55", marginTop: 5 }}>{potIsCard ? "Drankkaart" : "Pot"} beschikbaar: {euro(Math.max(0, st.potAvail))}</div>}
            </div>
          )}
          {payPot && !st.multi && <div style={{ fontSize: 14, color: st.potOver ? "#c0554a" : "#8a7d55", fontWeight: 700, marginTop: 8 }}>{potIsCard ? "drankkaart" : "pot"}: {euro(Math.max(0, st.potAvail))} beschikbaar{st.potOver ? " — te weinig, kies een extra betaler of leg bij" : ""}</div>}

          {(() => {
            const okGreen = paidConfirmed && st.valid
            const style = okGreen
              ? { ...S.btn, width: "100%", background: "rgba(31,138,76,0.12)", color: "#1f8a4c", border: "1px solid rgba(31,138,76,0.5)", fontWeight: 800 }
              : !st.valid
              ? { ...S.btn, width: "100%", background: "rgba(224,104,92,0.12)", color: "#b0402f", border: "1px solid rgba(224,104,92,0.5)", fontWeight: 800 }
              : S.btnP
            return <button style={{ ...style, marginTop: 14 }} onClick={confirmPayment}>{okGreen ? "✓ betaling bevestigd — pas gerust nog aan" : !st.valid ? st.reason : "✓ Bevestig betaling"}</button>
          })()}
          </>
          ) : (
            <div style={{ fontSize: 14.5, color: "#b3a988", textAlign: "center", padding: "6px 0 2px" }}>{L.fillAmountFirst}</div>
          )}
        </div>

        {paidConfirmed && st.valid && <button style={S.btnP} onClick={closeRound}>{L.closeRound}</button>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={{ ...S.btn, flex: 1, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelRound}>{L.cancelRound}</button>
          <button style={{ ...S.btn, flex: 1 }} onClick={editOrder}>{L.editOrderBtn}</button>
        </div>
      </div></div>
    )
  }

  // ── HUB (rondjes-overzicht, bewerkbaar) ─────────────────────────────────────
  if (view === "hub") {
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        {rounds.length === 0 && renderShare()}
        {/* De pot is een handeling aan het BEGIN van de avond: iedereen legt vooraf in.
            Daarom staat hij hier, zichtbaar, vóór het eerste rondje — niet weggestopt
            in de instellingen. Het ⚙️-wieltje leidt naar pot + bekers + coins samen. */}
        {settle && rounds.length === 0 && (
          <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.35)" }}>
            <div style={{ ...S.row, justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e" }}>{potIsCard ? L.drinkCard : L.potStartTitle}</span>
              <span onClick={() => setView("settings")} title="⚙️" style={{ fontSize: 19, cursor: "pointer", lineHeight: 1, flexShrink: 0, opacity: 0.7 }}>⚙️</span>
            </div>
            {potContribTotal > 0.005 ? (
              <div style={{ ...S.row, justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: "#1f6b3a" }}>{L.potStartIn(euro(potContribTotal))}</span>
                <button style={{ ...S.btn, padding: "7px 13px", fontSize: 15 }} onClick={() => setShowPot(true)}>{L.potStartMore}</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: "#8a7d55", lineHeight: 1.5, marginBottom: 11 }}>{L.potStartWhy}</div>
                <button style={{ ...S.btn, width: "100%", fontWeight: 800 }} onClick={() => setShowPot(true)}>{L.potStartAdd}</button>
              </>
            )}
          </div>
        )}
        {!settle && rounds.length === 0 && !openRoundId && (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{L.noRoundsDone}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHintQuick}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={() => { setActiveCat(catsPresent[0]); setView("order") }}>{L.startFirstRoundBtn}</button>
            </div>
          </div>
        )}
        {!settle && rounds.length === 0 && openRoundId && (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{L.roundBusy(roundNr)}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHintQuick}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={() => setView("order")}>Ga verder met rondje {roundNr}</button>
            </div>
          </div>
        )}
        {!settle && rounds.length >= 1 && !lastRoundHandled && (() => {
          const idx = rounds.length - 1
          const r = rounds[idx]
          const amount = r?.amount || 0
          const potPart = r?.potPart || 0
          const potAvail = Math.max(0, potAvailFor(idx))
          const zelf = Math.max(0, amount - potPart)
          return (
          <>
            {/* Kop met het rondje-nummer: bij rondje 2, 3, … is meteen duidelijk waar je mee
                bezig bent. De flow zelf is voor elk rondje identiek. */}
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 16.5, fontWeight: 800, color: "#8a5e0f", background: "linear-gradient(135deg,#fdf3dc,#fae9c2)", border: "1.5px solid rgba(240,165,0,0.45)", borderRadius: 18, padding: "7px 16px" }}>🍻 {L.roundWord} {idx + 1}</span>
            </div>
            {/* Drankjes van dit net-bevestigde rondje, met de aanpas-knop erin verwerkt. */}
            {(() => { const laatste = rounds[idx]; const lijst = laatste ? drinksOf(laatste) : []; return lijst.length > 0 && (
              <div style={{ ...S.card, padding: "12px 14px", background: "#fffdf6" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#8a7d55", marginBottom: 9, paddingBottom: 9, borderBottom: "1px solid rgba(120,95,20,0.1)" }}>📋 {L.orderedLabel} <span style={{ fontWeight: 600, color: "#b3a988" }}>— {L.drinksCount(lijst.reduce((a, x) => a + x.n, 0))}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {lijst.map(({ d, n }) => (
                    <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "4px 0" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e" }}>{d.emoji} {d.name}</span>
                      <span style={{ fontSize: 19, fontWeight: 800, color: "#c98a00" }}>{n}×</span>
                    </div>
                  ))}
                </div>
                {/* Aanpassen hoort bij de lijst zelf: rechtsonder, na de drankjes. */}
                <div style={{ textAlign: "right", marginTop: 11, paddingTop: 9, borderTop: "1px solid rgba(120,95,20,0.1)" }}>
                  <span onClick={editOrder} style={{ fontSize: 13.5, color: "#c98a00", fontWeight: 800, padding: "6px 12px", borderRadius: 14, background: "#faf4e4", border: "1px solid rgba(240,165,0,0.35)", cursor: "pointer" }}>✏️ {L.editRoundBtn}</span>
                </div>
              </div>
            ) })()}

            {/* Hoeveel betaald voor dit rondje. Kies eerst de bron (zelf/pot), vul één
                bedrag in, en bevestig met ✓ (of sla over). Beide sluiten het rondje af. */}
            <div style={{ ...S.card }}>
              {/* Aantal personen staat er gewoon bij: geen vraag, maar wel zichtbaar zodat
                  een verandering meteen opvalt in plaats van pas bij het afrekenen. */}
              <div style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e", marginBottom: 6 }}>{L.withHowManyQ}</div>
              <div style={{ ...S.row, justifyContent: "space-between", background: "#faf4e4", borderRadius: 10, padding: "8px 12px", marginBottom: 13 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: "#8a5e0f" }}>👤 {r?.headcount || 1} {L.people}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", border: "1px solid rgba(120,95,20,0.25)", fontSize: 16, color: "#8a7d55", fontWeight: 800, cursor: "pointer", opacity: (r?.headcount || 1) > 1 ? 1 : 0.4 }}
                    onClick={() => r && setRoundHeadcount(r.id, Math.max(1, (r.headcount || 1) - 1))}>−</button>
                  <button style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 16, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                    onClick={() => r && setRoundHeadcount(r.id, (r.headcount || 1) + 1)}>+</button>
                </div>
              </div>

              {/* Staat vlak boven de knop "uit de pot", rechts uitgelijnd zodat de link
                  duidelijk bij die knop hoort. */}
              {(payVia === "pot" || potContribTotal > 0.005) && (
                <div style={{ display: "flex", marginBottom: 4 }}>
                  <span style={{ flex: 1 }} />
                  <span style={{ flex: 1, textAlign: "center" }}>
                    <span onClick={() => setShowPot(true)} style={{ display: "inline-block", fontSize: 13, fontWeight: 800, color: "#c98a00", cursor: "pointer", textDecoration: "underline", lineHeight: 1.2 }}>{L.addToPot}</span>
                  </span>
                </div>
              )}
              {/* Bron: zelf betaald of uit de pot. */}
              <div style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e", marginBottom: 6 }}>{L.roundCostFor(idx + 1)}</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button style={{ flex: 1, padding: "10px 6px", fontSize: 14.5, fontWeight: 800, borderRadius: 10, cursor: "pointer",
                  background: payVia === "self" ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#f7f1e2",
                  color: payVia === "self" ? "#fff" : "#8a7d55", border: "none" }}
                  onClick={() => setPayVia("self")}>💶 {L.paidSelf}</button>
                <button style={{ flex: 1, padding: "10px 6px", fontSize: 14.5, fontWeight: 800, borderRadius: 10, cursor: "pointer",
                  background: payVia === "pot" ? "linear-gradient(135deg,#2fae6a,#1f8a4c)" : "#f7f1e2",
                  color: payVia === "pot" ? "#fff" : "#8a7d55", border: "none" }}
                  onClick={() => { setPayVia("pot"); if (potAvail <= 0.005) { setNotice(L.potEmptyNote); setShowPot(true) } }}>🫙 {L.paidPot}{potAvail > 0.005 && <span style={{ fontWeight: 800, opacity: payVia === "pot" ? 1 : 0.75 }}> · {euro(potAvail)}</span>}</button>
              </div>

              {/* Bedrag-veld met ✓ én Overslaan samen op één rij. Het vinkje pulseert groen
                  (omrand) zodra er een bedrag staat = "tik om te bevestigen". */}
              <style>{`@keyframes rundoPulse{0%,100%{box-shadow:0 0 0 0 rgba(31,138,76,0.45)}50%{box-shadow:0 0 0 7px rgba(31,138,76,0)}}.rundo-pulse{animation:rundoPulse 1.4s infinite}`}</style>
              <div style={{ ...S.row, gap: 7 }}>
                <span style={{ fontSize: 20, color: "#8a7d55", fontWeight: 700 }}>€</span>
                <input style={{ ...S.input, flex: 1, minWidth: 70, fontSize: 19, fontWeight: 800, padding: "12px 10px", textAlign: "left",
                  color: "#c88a1a",
                  borderColor: amount > 0.005 ? "#e08a00" : "rgba(120,95,20,0.22)",
                  background: amount > 0.005 ? "#fff" : "#fdfaf2" }}
                  type="text" inputMode="decimal" placeholder="0,00"
                  value={amount > 0 ? String(amount).replace(".", ",") : ""}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."); qSetAmount(idx, parseFloat(v) || 0) }}
                  onKeyDown={(e) => { if (e.key === "Enter") { (e.currentTarget as HTMLInputElement).blur(); if ((rounds[idx]?.amount || 0) > 0.005) confirmQuickPay() } }} />
                <button className={amount > 0.005 ? "rundo-pulse" : undefined} style={{ width: 54, height: 56, borderRadius: 13, fontSize: 27, fontWeight: 800, cursor: "pointer", flexShrink: 0,
                  background: amount > 0.005 ? "#fff" : "#e8e2d2",
                  color: amount > 0.005 ? "#1f8a4c" : "#b3a988",
                  border: amount > 0.005 ? "2.5px solid #1f8a4c" : "none" }}
                  onClick={() => { (document.activeElement as HTMLElement)?.blur?.(); if (amount > 0.005) confirmQuickPay() }}>✓</button>
                <button style={{ padding: "0 10px", height: 46, alignSelf: "center", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0, background: "#fff", border: "1px solid rgba(120,95,20,0.25)", color: "#a89a6f", lineHeight: 1.25, maxWidth: 92 }} onClick={() => closeQuickRound(true)}>{L.skipPayment}</button>
              </div>
              {amount > 0.005 && (
                <div style={{ fontSize: 13.5, color: "#1f8a4c", fontWeight: 800, textAlign: "right", marginTop: 7, paddingRight: 78 }}>{L.tapToConfirm}</div>
              )}

              {/* Pot-context (variant A). Genoeg in pot → toon wat overblijft. Te weinig →
                  toon automatische verdeling (pot + zelf) met een knopje om aan te vullen. */}
              {payVia === "pot" && amount > 0.005 && (
                amount <= potAvail + 0.005 ? (
                  <div style={{ fontSize: 14, color: "#1f6b3a", fontWeight: 700, marginTop: 9 }}>
                    🫙 {L.potPayLeft(euro(amount), euro(potAvail - amount))}
                  </div>
                ) : (
                  // Te weinig in de pot: geen mengvorm. Ofwel bijvullen, ofwel zelf betalen.
                  <div style={{ background: "rgba(224,104,92,0.08)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 10, padding: "11px 12px", marginTop: 10 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>⚠️ {L.potShortTitle}</div>
                    <div style={{ fontSize: 13.5, color: "#8a6b5f", lineHeight: 1.5, marginBottom: 10 }}>{L.potShortSimple(euro(potAvail), euro(amount))}</div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button style={{ ...S.btn, flex: 1, fontSize: 14, fontWeight: 800, padding: "10px 6px" }} onClick={() => setShowPot(true)}>{L.potChoiceTopUp}</button>
                      <button style={{ ...S.btn, flex: 1, fontSize: 14, fontWeight: 800, padding: "10px 6px" }} onClick={() => setPayVia("self")}>{L.potChoicePaySelf}</button>
                    </div>
                  </div>
                )
              )}
            </div>
          </>
          )
        })()}
        {settle && unassignedAllRounds > 0 && firstUnassignedIdx >= 0 && (
          <div style={{ ...S.card, background: "rgba(224,104,92,0.08)", border: "1.5px solid rgba(224,104,92,0.45)" }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "#b0402f", marginBottom: 4 }}>{L.unassignedHub(unassignedAllRounds)}</div>
            <div style={{ fontSize: 14, color: "#8a6b5f", lineHeight: 1.5, marginBottom: 11 }}>{L.unassignedHubWhy}</div>
            <button style={{ ...S.btnP, width: "100%", background: "linear-gradient(135deg,#e0725c,#c0554a)" }}
              onClick={() => { setAssignAllMode(true); setAssignIdx(firstUnassignedIdx) }}>{L.assignAllBtn}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 14.5, fontWeight: 800 }}
              onClick={() => { setAssignAllMode(false); setAssignIdx(firstUnassignedIdx) }}>{L.assignPerRoundBtn}</button>
          </div>
        )}
        {assignIdx !== null && rounds[assignIdx] && (() => {
          // "Alles meteen" toont elk rondje in één lijst; "per rondje" toont er precies één
          // en springt daarna door naar het volgende dat nog namen mist.
          const toonIdx = assignAllMode
            ? rounds.map((_, i) => i).filter((i) => drinks.some((d) => drinkTotalRound(rounds[i], d.id) > 0))
            : [assignIdx]
          const done = !toonIdx.some((i) => drinks.some((d) => (rounds[i].anon[d.id] ?? 0) > 0))
          const volgende = assignAllMode ? -1 : rounds.findIndex((rr, i) => i !== assignIdx && drinks.some((d) => (rr.anon[d.id] ?? 0) > 0))
          const naarVolgende = done && volgende >= 0
          const nogOpen = rounds.filter((rr) => drinks.some((d) => (rr.anon[d.id] ?? 0) > 0)).length
          return (
            <div style={S.overlay} onClick={() => { setAssignIdx(null); setAssignAllMode(false) }}>
              <div style={{ ...S.sheet, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.assignTitle}</h3>
                <div style={{ fontSize: 13.5, color: "#8a7d55", fontWeight: 700, marginBottom: 10 }}>
                  {assignAllMode ? L.assignAllSub(toonIdx.length) : L.roundXofY(assignIdx + 1, rounds.length)}
                </div>

                <div style={{ ...S.row, justifyContent: "flex-end", gap: 4, marginBottom: 8 }}>
                  <div style={{ ...S.seg(editAssignMode === "person"), padding: "5px 9px", fontSize: 13.5, minWidth: 78, textAlign: "center" }} onClick={() => setEditAssignMode("person")}>{L.perPerson}</div>
                  <div style={{ ...S.seg(editAssignMode === "drink"), padding: "5px 9px", fontSize: 13.5, minWidth: 78, textAlign: "center" }} onClick={() => setEditAssignMode("drink")}>per drank</div>
                </div>

                {toonIdx.map((idx) => {
                  const r = rounds[idx]
                  const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
                  const un = roundDrinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0)
                  return (
                    <div key={r.id} style={{ marginBottom: toonIdx.length > 1 ? 16 : 0 }}>
                      {toonIdx.length > 1 && (
                        <div style={{ ...S.row, justifyContent: "space-between", background: un > 0 ? "rgba(224,104,92,0.1)" : "rgba(31,138,76,0.1)", borderRadius: 9, padding: "7px 11px", marginBottom: 8 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800, color: un > 0 ? "#b0402f" : "#1f6b3a" }}>{L.roundWord} {idx + 1}</span>
                          <span style={{ fontSize: 13.5, fontWeight: 800, color: un > 0 ? "#b0402f" : "#1f8a4c" }}>{un > 0 ? `🔴 ${un}` : "✓"}</span>
                        </div>
                      )}
                      {toonIdx.length === 1 && un > 0 && editAssignMode === "person" && (
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#c0554a", marginBottom: 8 }}>🔴 {L.notAssignedYet(un)}</div>
                      )}
                      {editAssignMode === "drink" ? roundDrinks.map((d) => {
                        const dun = r.anon[d.id] ?? 0
                        return (
                          <div key={d.id} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 5 }}>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}{dun > 0 && <span style={{ color: "#c0554a", fontWeight: 700 }}> · 🔴 {dun} onbekend</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {people.map((p) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={p.id} style={{ ...S.chip(n), padding: "5px 10px", fontSize: 14.5 }} onClick={() => rAssignFromAnon(idx, d.id, p.id)}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 15.5, fontWeight: 800, lineHeight: 1 }}>−</span>}</span>
                              )})}
                            </div>
                          </div>
                        )
                      }) : (<div style={{ display: people.length > 4 ? "grid" : "block", gridTemplateColumns: people.length > 4 ? "1fr 1fr" : undefined, columnGap: 12 }}>{people.map((p) => {
                        const took = roundDrinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
                        return (
                          <div key={p.id} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 5 }}>{p.name}{took.length > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: "#8a7d55" }}> · {took.reduce((a, d) => a + (r.orders[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {roundDrinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((d) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={d.id} style={{ ...S.chip(n), padding: "5px 10px", fontSize: 14.5 }}>{d.emoji} {d.name}<span style={S.badge}>{n}</span><span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 15.5, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>−</span></span>
                              )})}
                              {roundDrinks.filter((d) => (r.anon[d.id] ?? 0) > 0).map((d) => (
                                <span key={"add" + d.id} onClick={() => rAssignFromAnon(idx, d.id, p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 14.5, borderRadius: 20, background: "#fff", border: "1px dashed rgba(120,95,20,0.4)", color: "#8a7d55", fontWeight: 700, cursor: "pointer" }}>+ {d.emoji} {d.name}</span>
                              ))}
                            </div>
                          </div>
                        )
                      })}</div>)}
                    </div>
                  )
                })}

                <div style={{ fontSize: 13, color: "#8a7d55" }}>{L.redistribute}</div>

                {/* Alles rond? Dan een duidelijk groen vinkje in plaats van een gewone knop. */}
                {done && (
                  <div style={{ background: "rgba(31,138,76,0.1)", border: "1.5px solid rgba(31,138,76,0.45)", borderRadius: 11, padding: "12px 13px", marginTop: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>✅</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#1f6b3a" }}>{naarVolgende ? L.roundDoneNext : nogOpen === 0 ? L.allAssignedDone : L.roundDoneShort}</div>
                  </div>
                )}
                <button style={done ? { ...S.btnP, marginTop: 10, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" } : { ...S.btnP, marginTop: 10 }}
                  onClick={() => { if (naarVolgende) setAssignIdx(volgende); else { setAssignIdx(null); setAssignAllMode(false) } }}>
                  {naarVolgende ? L.nextRoundAssign(volgende + 1) : done ? L.ready : L.ready}
                </button>
              </div>
            </div>
          )
        })()}
        {settle && unassignedAllRounds === 0 && (
        <div style={{ ...S.row, justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.roundsOverview}</h3>
          {potTag}
        </div>
        )}
        {settle && paidCount === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{L.noRoundsDone}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHint}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={startFirstRound}>{unfinishedRound ? L.continueRound(roundNr) : "Start 1e rondje"}</button>
            </div>
          </div>
        ) : (!settle || unassignedAllRounds > 0) ? null : (<>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ ...S.sub, margin: 0 }}>{L.tapRoundToEdit}</p>
          {paidCount > 1 && <span onClick={() => setAllRoundsOpen((v) => !v)} style={{ fontSize: 14, fontWeight: 800, color: "#8a5e0f", cursor: "pointer", flexShrink: 0 }}>{allRoundsOpen ? "alles dichtklappen" : "alles openklappen"}</span>}
        </div>

        {rounds.map((r, idx) => ({ r, idx })).reverse().map(({ r, idx }) => {
          if (!roundIsPaid(r)) return null
          const items = drinks.reduce((s, d) => s + drinkTotalRound(r, d.id), 0)
          const open = allRoundsOpen || openRound === idx
          const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
          return (
            <div key={idx} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ cursor: "pointer", padding: 14 }} onClick={() => { if (allRoundsOpen) { setAllRoundsOpen(false); setOpenRound(idx) } else { setOpenRound(open ? null : idx) } setEditOpen(false); setEditCups(false); setEditPay(false) }}>
                <div style={{ ...S.row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{L.roundWord} {idx + 1} <span style={{ fontSize: 14, fontWeight: 600, color: "#8a7d55" }}>· {L.drinksCount(items)} · {euro(r.amount)}</span>{!drinks.some((d) => (r.anon[d.id] ?? 0) > 0) && <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1f8a4c", marginLeft: 6 }}>{L.assigned}</span>}</span>
                  <span style={{ fontSize: 15.5, color: "#8a7d55" }}>{open ? "▴" : "▾"}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1f8a4c", marginTop: 3 }}>✓ betaald: {paidLabel(r)}</div>
              </div>
              {(() => {
                const un = drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0)
                if (un === 0) return null
                return (
                  <div onClick={() => { setAssignIdx(idx) }} style={{ margin: "0 14px 14px", background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.5)", borderRadius: 10, padding: "9px 11px", fontSize: 14.5, fontWeight: 800, color: "#b0402f", cursor: "pointer", textAlign: "center" }}>
                    🔴 {L.notAssignedYet(un)} <u>{L.tapToAssign}</u>
                  </div>
                )
              })()}
              {open && (
                <div style={{ padding: "0 14px 14px" }}>
                  {roundDrinks.map((d) => {
                    const who = people.filter((p) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = r.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                    return <div key={d.id} style={{ fontSize: 15.5, marginBottom: 3 }}><b>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}</b>{who.length > 0 && <span style={{ color: "#8a7d55" }}> → {who.join(", ")}</span>}</div>
                  })}

                  <div style={{ ...S.row, justifyContent: "flex-end", marginTop: 10 }}>
                    <button style={{ ...S.btn, fontSize: 14, padding: "5px 12px", fontWeight: 800, color: "#8a5e0f" }} onClick={() => { const next = !editOpen; setEditOpen(next); if (!next) { setEditCups(false); setEditPay(false) } }}>{editOpen ? "▴ sluiten" : "✏️ aanpassen"}</button>
                  </div>
                  {editOpen && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button style={{ ...S.btn, flex: 1, fontSize: 13.5, padding: "7px 0" }} onClick={() => { setEditCups(false); setEditPay(false); setAssignIdx(idx) }}>toewijzen{!drinks.some((d) => (r.anon[d.id] ?? 0) > 0) && <span style={{ color: "#1f8a4c", fontWeight: 800 }}> ✓</span>}</button>
                      <button style={{ ...S.btn, flex: 1, fontSize: 13.5, padding: "7px 0", ...(editPay ? { background: "rgba(240,165,0,0.16)", borderColor: "rgba(240,165,0,0.5)", fontWeight: 800 } : {}) }} onClick={() => { setEditPay((v) => !v); setEditCups(false) }}>{L.amountAndPayer}</button>
                      {depositOn && <button style={{ ...S.btn, flex: 1, fontSize: 13.5, padding: "7px 0", ...(editCups ? { background: "rgba(240,165,0,0.16)", borderColor: "rgba(240,165,0,0.5)", fontWeight: 800 } : {}) }} onClick={() => { setEditCups((v) => !v); setEditPay(false) }}>bekers</button>}
                    </div>
                  )}


                  {editPay && (
                    <div style={{ marginTop: 10, background: "#faf4e4", borderRadius: 12, padding: 10 }}>
                      <div style={{ ...S.row, gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 19, fontWeight: 800 }}>€</span>
                        <input style={{ ...S.input, width: 110, fontSize: 17, borderColor: (r.amount || 0) <= 0 ? "#e0685c" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" value={r.amount || ""} onChange={(e) => rSetAmount(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} />
                        <span style={{ fontSize: 13, color: "#8a7d55" }}>totaal — Fair-Split basis</span>
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#8a7d55", marginBottom: 6 }}>Betaald door <span style={{ fontWeight: 600, color: "#b3a988" }}>{L.multiplePossible}</span></div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span style={S.chip((r.potPart || 0) > 0 ? 1 : 0)} onClick={() => rTogglePot(idx)}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
                        {people.map((p) => <span key={p.id} style={{ ...S.chip((r.payers?.[p.id] || 0) > 0 ? 1 : 0), padding: "6px 11px", fontSize: 15 }} onClick={() => rTogglePayer(idx, p.id)}>{p.name}</span>)}
                      </div>
                      {(() => {
                        const sel = Object.keys(r.payers || {}).filter((pid) => people.some((p) => p.id === pid))
                        const nPay = sel.length + ((r.potPart || 0) > 0 ? 1 : 0)
                        if (nPay === 0) return <div style={{ fontSize: 13.5, color: "#c0554a", fontWeight: 700, marginTop: 6 }}>Kies wie betaalde.</div>
                        const sum = rPaidSum(r), diff = (r.amount || 0) - sum
                        return (
                          <div style={{ marginTop: 8, background: "#fff", borderRadius: 10, padding: "9px 10px" }}>
                            {nPay > 1 && <div style={{ fontSize: 13, fontWeight: 800, color: "#8a7d55", marginBottom: 7 }}>Gelijk verdeeld <span style={{ fontWeight: 600, color: "#b3a988" }}>— pas aan per persoon indien nodig</span></div>}
                            {(r.potPart || 0) > 0 && (
                              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
                                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 78, fontSize: 15 }} type="text" inputMode="decimal" value={r.potPart || ""} onChange={(e) => rSetPotAmt(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                              </div>
                            )}
                            {sel.map((pid) => (
                              <div key={pid} style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 14.5, fontWeight: 700 }}>👤 {people.find((p) => p.id === pid)?.name}</span>
                                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 78, fontSize: 15 }} type="text" inputMode="decimal" value={r.payers[pid] || ""} onChange={(e) => rSetPayerAmt(idx, pid, parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                              </div>
                            ))}
                            <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", paddingTop: 7, fontSize: 13.5, fontWeight: 800, color: Math.abs(diff) <= 0.005 ? "#1f8a4c" : "#c0554a" }}>Samen {euro(sum)} van {euro(r.amount || 0)}{Math.abs(diff) <= 0.005 ? " ✓ klopt" : diff > 0 ? ` — er ontbreekt ${euro(diff)}` : ` — ${euro(-diff)} te veel`}</div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {editCups && depositOn && (
                    <div style={{ marginTop: 10, background: "#faf4e4", borderRadius: 12, padding: 10 }}>
                      {people.map((p) => {
                        const nam = roundPicked(r, p.id), gb = r.gaveBack[p.id] || 0
                        return (
                          <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0" }}>
                            <span style={{ fontSize: 15.5, fontWeight: 700 }}>{p.name} <span style={{ fontSize: 13, color: "#8a7d55" }}>· nam {nam}</span></span>
                            <div style={{ ...S.row, gap: 6 }}>
                              <span style={{ fontSize: 13, color: "#8a7d55" }}>{L.gaveBack}</span>
                              <button style={{ ...S.step, width: 26, height: 26, fontSize: 17, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => rSetGaveBack(idx, p.id, gb - 1)}>−</button>
                              <span style={{ minWidth: 14, textAlign: "center", fontSize: 15.5, fontWeight: 800 }}>{gb}</span>
                              <button style={{ ...S.step, width: 26, height: 26, fontSize: 17 }} onClick={() => rSetGaveBack(idx, p.id, gb + 1)}>+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        </>)}
        {paidCount > 0 && laatsteRondjeKlaar() && !(settle && unassignedAllRounds > 0) && <>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={goFinal}>{L.settleBtn}</button>
            <button style={{ ...S.btnP, flex: 2 }} onClick={() => { if (unfinishedRound) resumeRound(); else nextRound() }}>{unfinishedRound ? L.continueRound(roundNr) : "➕ Nieuw rondje"}</button>
          </div>
          {!unfinishedRound && paidCount > 0 && activeProposal && (
            <div style={{ marginTop: 10 }}>{renderProposalHost()}</div>
          )}
        </>}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span onClick={switchMode} style={{ fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: "#b8ac8a" }}>↺ {settle ? L.switchToQuick : L.switchToFair}</span>
        </div>
      </div></div>
    )
  }

  // ── SNEL AFREKENEN (niveau 2: elk rondje ÷ wie er toen was) ──────────────────
  if (view === "quickSettle") {
    const betaalde = rounds.filter((r) => (r.amount || 0) > 0.005)
    // Rondjes die overgeslagen zijn tellen niet mee in het totaal. Dat is een geldige
    // keuze, maar je moet het wel wéten voor je de verdeling leest.
    const zonderBedrag = rounds.filter((r) => (r.amount || 0) <= 0.005)
    const zbNrs = zonderBedrag.map((r) => rounds.indexOf(r) + 1)
    const zbLabel = zbNrs.length === 0 ? "" : zbNrs.length <= 3
      ? L.roundsNoAmountNamed(zbNrs.length === 1 ? String(zbNrs[0]) : `${zbNrs.slice(0, -1).join(", ")} ${L.andWord} ${zbNrs[zbNrs.length - 1]}`)
      : L.roundsNoAmountCount(zbNrs.length)
    const getrakteerd = betaalde.filter((r) => treatedRounds.has(r.id))
    const teVerdelen = betaalde.filter((r) => !treatedRounds.has(r.id))
    const traktatieTot = getrakteerd.reduce((s, r) => s + (r.amount || 0), 0)
    // Wie wanneer meedeed, afgeleid uit het aantal per rondje: gaat het omhoog dan schoof
    // er iemand aan, gaat het omlaag dan ging er iemand weg (de laatst aangekomene eerst).
    // Zo betaalt een laatkomer niet mee voor rondjes van vóór z'n aankomst.
    const groepen: { count: number; from: number; until: number | null }[] = []
    let vorigAantal = 0
    rounds.forEach((r, i) => {
      const h = Math.max(1, r.headcount || 1)
      if (h > vorigAantal) groepen.push({ count: h - vorigAantal, from: i, until: null })
      else if (h < vorigAantal) {
        let weg = vorigAantal - h
        for (let j = groepen.length - 1; j >= 0 && weg > 0; j--) {
          if (groepen[j].until !== null) continue
          const neem = Math.min(weg, groepen[j].count)
          if (neem === groepen[j].count) groepen[j].until = i - 1
          else { groepen[j].count -= neem; groepen.push({ count: neem, from: groepen[j].from, until: i - 1 }) }
          weg -= neem
        }
      }
      vorigAantal = h
    })
    // Wat één persoon uit zo'n groep betaalt: z'n deel van elk rondje waar hij bij was.
    const deelVan = (g: { from: number; until: number | null }) => rounds.reduce((s, r, i) => {
      if (i < g.from || (g.until !== null && i > g.until)) return s
      if (!teVerdelen.includes(r)) return s
      return s + (r.amount || 0) / Math.max(1, r.headcount || 1)
    }, 0)
    const groepenMetDeel = groepen.filter((g) => g.count > 0).map((g) => ({ ...g, deel: deelVan(g) }))
    const gelijkVoorIedereen = groepenMetDeel.length <= 1
    const perPersoon = groepenMetDeel[0]?.deel ?? 0
    const alles = settleMode === "allesZelf"
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.quickSettleTitle}</h3>
          <button style={{ ...S.btn, fontSize: 14, fontWeight: 700, padding: "7px 12px" }} onClick={() => setView("hub")}>{L.back}</button>
        </div>

        <div style={{ ...S.card, textAlign: "center", background: "rgba(240,165,0,0.06)", border: "1.5px solid rgba(240,165,0,0.4)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#8a7d55", marginBottom: 4 }}>{L.quickTotalLabel}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#c98a00" }}>{euro(totalCost)}</div>
        </div>

        {/* Los van het totaalkader: het bedrag klopt, er ontbreekt alleen iets. */}
        {zonderBedrag.length > 0 && (
          <div style={{ ...S.card, background: "rgba(224,104,92,0.08)", border: "1px solid rgba(224,104,92,0.45)", padding: "12px 13px" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>{zbLabel}</div>
            <div style={{ fontSize: 13.5, color: "#8a6b5f", lineHeight: 1.5, marginBottom: 10 }}>{L.roundsNoAmountWhy}</div>
            <button
              onClick={() => {
                // Niets openklappen: in het overzicht markeren we de lege rondjes en
                // zetten we er een knop bij, zodat je zelf kiest waar je begint.
                setFillMode(true)
                setOverviewBackTo("hub")
                setView("roundsOverview")
              }}
              style={{ width: "100%", padding: "11px 6px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(224,104,92,0.4)", color: "#b0402f" }}>
              {L.fillAmountsBtn}
            </button>
          </div>
        )}

        {/* Links: gelijk verdelen over de groep. Rechts: overstappen naar Fair Split,
            waar elk drankje aan een naam hangt. */}
        <div style={{ display: "flex", gap: 4, background: "#f7f1e2", padding: 4, borderRadius: 12, marginBottom: 12 }}>
          <button style={{ flex: 1, padding: "10px 6px", borderRadius: 9, fontSize: 14.5, fontWeight: 800, cursor: "pointer", border: "none",
            background: "#fff", color: "#4a3f1e", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
            onClick={() => setSettleMode("verdelen")}>👥 {L.splitEqually}</button>
          <button style={{ flex: 1, padding: "10px 6px", borderRadius: 9, fontSize: 14.5, fontWeight: 800, cursor: "pointer", border: "none",
            background: "transparent", color: "#8a7d55", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={switchMode}>
            ⚖️ {L.modeTitle}
            <span onClick={(e) => { e.stopPropagation(); setNotice(L.fairSplitExplain) }}
              style={{ width: 19, height: 19, borderRadius: "50%", border: "1.5px solid #b8ac8a", color: "#8a7d55", fontSize: 11, fontWeight: 800, fontStyle: "italic", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>i</span>
          </button>
        </div>

        {!alles ? (
          <>

            {/* Eén bedrag, verdeeld over een aantal dat jij bepaalt. Wisselde het aantal
                per rondje, dan melden we dat maar houden we het bedrag simpel. */}
            {(() => {
              const aantallen = betaalde.map((r) => Math.max(1, r.headcount || 1))
              const wisselde = new Set(aantallen).size > 1
              const deelAantal = Math.max(1, splitPeople ?? (aantallen.length ? Math.max(...aantallen) : 1))
              const teVerdelenTot = teVerdelen.reduce((s, r) => s + (r.amount || 0), 0)
              return (
                <>
                  {wisselde && (
                    <div style={{ background: "rgba(240,165,0,0.1)", border: "1px solid rgba(240,165,0,0.4)", borderRadius: 10, padding: "10px 12px", marginBottom: 11 }}>
                      <div style={{ fontSize: 13.5, color: "#8a5e0f", fontWeight: 800, marginBottom: 4 }}>⚠️ {L.headcountVaried}</div>
                      <div style={{ fontSize: 13, color: "#8a5e0f", lineHeight: 1.6 }}>
                        {betaalde.map((r, i) => `${L.roundWord} ${rounds.indexOf(r) + 1}: ${Math.max(1, r.headcount || 1)} ${L.people}`).join("  ·  ")}
                      </div>
                    </div>
                  )}
                  <div style={{ ...S.row, justifyContent: "space-between", background: "#faf4e4", borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: "#8a5e0f" }}>{L.splitOver} 👤 {deelAantal} {L.people}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button style={{ width: 32, height: 32, borderRadius: 9, background: "#fff", border: "1px solid rgba(120,95,20,0.25)", fontSize: 17, color: "#8a7d55", fontWeight: 800, cursor: "pointer", opacity: deelAantal > 1 ? 1 : 0.4 }}
                        onClick={() => setSplitPeople(Math.max(1, deelAantal - 1))}>−</button>
                      <button style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 17, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                        onClick={() => setSplitPeople(deelAantal + 1)}>+</button>
                    </div>
                  </div>
                  <div style={{ ...S.card, background: "rgba(31,138,76,0.06)", border: "1.5px solid rgba(31,138,76,0.3)", textAlign: "center" }}>
                    <div style={{ fontSize: 14.5, color: "#4a6b57", marginBottom: 3 }}>{L.eachPaysNote}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: "#1f8a4c" }}>{euro(teVerdelenTot / deelAantal)}</div>
                    {traktatieTot > 0.005 && (
                      <div style={{ fontSize: 14, color: "#8a5e0f", fontWeight: 700, marginTop: 7 }}>🎁 {L.plusTreat(euro(traktatieTot))}</div>
                    )}
                  </div>
                  {/* Twee rustige keuzes onder het bedrag: detail per rondje, of iemand
                      die een rondje trakteert. */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={() => { setShowPerRound((v) => !v); setShowTreat(false) }}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", lineHeight: 1.3,
                        background: showPerRound ? "rgba(240,165,0,0.14)" : "#fff", border: showPerRound ? "1px solid rgba(240,165,0,0.6)" : "1px solid rgba(120,95,20,0.22)", color: "#8a5e0f" }}>
                      {showPerRound ? L.backToOneAmount : L.showPerRound}
                    </button>
                    <button onClick={() => { setShowTreat((v) => !v); setShowPerRound(false) }}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", lineHeight: 1.3,
                        background: showTreat ? "rgba(240,165,0,0.14)" : "#fff", border: showTreat ? "1px solid rgba(240,165,0,0.6)" : "1px solid rgba(120,95,20,0.22)", color: "#8a5e0f" }}>
                      🎁 {L.treatShort}
                    </button>
                  </div>
                  {showPerRound && (
                    <div style={{ ...S.card, marginTop: 10 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 9 }}>{L.perRoundTitle}</div>
                      {betaalde.map((r) => {
                        const nr = rounds.indexOf(r) + 1
                        const h = Math.max(1, r.headcount || 1)
                        const getr = treatedRounds.has(r.id)
                        return (
                          <div key={r.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(120,95,20,0.08)", fontSize: 14.5 }}>
                            <span>{L.roundWord} {nr} · 👤 {h}</span>
                            <span style={{ fontWeight: 800 }}>{getr ? `🎁 ${L.yourTreat}` : `${euro(r.amount || 0)} → ${euro((r.amount || 0) / h)} p.p.`}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )
            })()}

            {betaalde.length > 0 && showTreat && (
              <div style={{ ...S.card }}>
                <div style={{ fontSize: 15, color: "#8a7d55", fontWeight: 800, marginBottom: 9, lineHeight: 1.45 }}>{L.treatHint}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {betaalde.map((r) => {
                    const nr = rounds.indexOf(r) + 1
                    const on = treatedRounds.has(r.id)
                    return (
                      <div key={r.id} onClick={() => setTreatedRounds((prev) => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                        style={{ ...S.row, justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                          background: on ? "rgba(31,138,76,0.08)" : "#faf7ec", border: on ? "1px solid rgba(31,138,76,0.4)" : "1px solid transparent" }}>
                        <span style={{ fontSize: 15, fontWeight: on ? 800 : 700, color: on ? "#1f6b3a" : "#4a3f1e" }}>
                          {L.roundWord} {nr} · 👤{r.headcount || 1}{on && <span style={{ fontWeight: 700, color: "#8a7d55" }}> · 🎁 {L.yourTreat}</span>}
                        </span>
                        <div style={{ ...S.row, gap: 9 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: on ? "#1f8a4c" : "#8a7d55" }}>{euro(r.amount || 0)}</span>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800,
                            background: on ? "#1f8a4c" : "#fff", color: "#fff", border: on ? "none" : "1.5px solid rgba(120,95,20,0.3)" }}>{on ? "✓" : ""}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...S.card, background: "rgba(240,165,0,0.06)", border: "1.5px solid rgba(240,165,0,0.4)", textAlign: "center" }}>
            <div style={{ fontSize: 15, color: "#8a5e0f", fontWeight: 700, marginBottom: 6, lineHeight: 1.5 }}>{L.payAllNote}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#c98a00" }}>{euro(totalCost)}</div>
          </div>
        )}

        {/* Fair Split blijft de weg naar een echt per-persoon-detail. */}
        <div style={{ ...S.card, background: "rgba(31,138,76,0.06)", border: "1.5px solid rgba(31,138,76,0.3)" }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1f6b3a", marginBottom: 4 }}>{L.notFairSplitYet}</div>
          <div style={{ fontSize: 14, color: "#4a6b57", lineHeight: 1.5, marginBottom: 11 }}>{L.notFairSplitWhy}</div>
          <button style={{ ...S.btnP, width: "100%", background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" }} onClick={goToFairSplit}>{L.switchToFairBtn}</button>
        </div>
      </div></div>
    )
  }

  // ── FAIR SPLIT SETUP (snel personen + namen) ─────────────────────────────────
  if (view === "fairSetup") {
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.fairSetupTitle}</h3>
          <button style={{ ...S.btn, fontSize: 14, fontWeight: 700, padding: "7px 12px" }} onClick={() => setView("quickSettle")}>{L.back}</button>
        </div>
        <div style={{ fontSize: 14.5, color: "#8a7d55", lineHeight: 1.5, marginBottom: 14 }}>{L.fairSetupIntro}</div>
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {people.map((p, i) => {
              const leeg = isGuestDefault(p.name)
              return (
                <div key={p.id} style={{ ...S.row, gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#b3a988", width: 20, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                  <input value={leeg ? "" : p.name} onChange={(e) => renamePerson(p.id, e.target.value)} placeholder={p.name}
                    style={{ ...S.input, flex: 1, textAlign: "left", fontSize: 16, fontWeight: 700, padding: "11px 12px", borderRadius: 10, background: "#fdfaf2", color: leeg ? "#b3a988" : "#4a3f1e" }} />
                  {people.length > 1 && (
                    <button onClick={() => removePerson(p.id)} style={{ ...S.btn, padding: "8px 11px", fontSize: 16, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)", flexShrink: 0 }}>✕</button>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={addPerson} style={{ ...S.btn, width: "100%", marginTop: 12, fontWeight: 800, border: "1.5px dashed rgba(240,165,0,0.6)", background: "rgba(240,165,0,0.06)", color: "#c98a00" }}>{L.fairAddPerson}</button>
        </div>
        <button style={{ ...S.btnP, width: "100%", marginTop: 6, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" }} onClick={confirmFairSetup}>{L.fairSetupDone}</button>
      </div></div>
    )
  }

  // ── RONDJESOVERZICHT (alle rondjes + bedragen, totaal of per rondje) ─────────
  if (view === "roundsOverview") {
    // Nieuwste rondje bovenaan. Open als het in openRounds zit; het laatste rondje
    // staat standaard open (als de gebruiker niks toggelde).
    const laatsteId = rounds.length ? rounds[rounds.length - 1].id : ""
    // Standaard staat alles dicht — je opent zelf wat je wil bekijken.
    const isOpen = (r: Round) => openRounds.has(r.id)
    const toggle = (id: string) => setOpenRounds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.roundsOverviewTitle}</h3>
          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
            {settle && <button style={{ ...S.btn, fontSize: 14, fontWeight: 700, padding: "7px 12px" }} onClick={() => { if (overviewBackTo === "order") { setActiveCat(catsPresent[0]); setView("order") } else setView("hub") }}>← {L.back}</button>}
          </div>
        </div>

        {/* Totaal — de som van alle rondjes. Eén blik op wat de avond kostte. */}
        <div style={{ ...S.card, background: "rgba(240,165,0,0.06)", border: "1.5px solid rgba(240,165,0,0.4)" }}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 15.5, fontWeight: 800, color: "#8a5e0f" }}>{L.costTotalLabel}</span>
            <span style={{ fontSize: 21, fontWeight: 800, color: "#c98a00" }}>{euro(totalCost)}</span>
          </div>
        </div>

        {/* Elk rondje, nieuwste bovenaan. Klik de kop om open/dicht te klappen.
            De toon/verberg-pil hangt half over de rand, boven én onder. */}
        <div style={{ position: "relative" }}>
          {rounds.length > 0 && (() => {
            const allesOpen = openRounds.size >= rounds.length
            const pil = {
              display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 12.5, fontWeight: 800,
              cursor: "pointer", background: "#fff", border: "1px solid rgba(120,95,20,0.3)", color: "#8a7d55",
              boxShadow: "0 2px 6px rgba(120,95,20,0.14)", whiteSpace: "nowrap" as const,
            }
            const klik = () => setOpenRounds(allesOpen ? new Set<string>() : new Set(rounds.map((r) => r.id)))
            return (
              <>
                <div style={{ position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", zIndex: 2 }}>
                  <span onClick={klik} style={pil}>{allesOpen ? `▴ ${L.hideDetails}` : `▾ ${L.showDetails}`}</span>
                </div>
                {/* Onderaan pas nodig zodra alles openstaat: dan is de lijst lang en wil je
                    niet terug naar boven scrollen om ze weer dicht te klappen. */}
                {allesOpen && (
                  <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", zIndex: 2 }}>
                    <span onClick={klik} style={pil}>▴ {L.hideDetails}</span>
                  </div>
                )}
              </>
            )
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: rounds.length > 0 ? 14 : 0, paddingBottom: (rounds.length > 0 && openRounds.size >= rounds.length) ? 14 : 0 }}>
          {rounds.slice().reverse().map((r) => {
            const nr = rounds.indexOf(r) + 1
            const items = drinksOf(r).reduce((a, x) => a + x.n, 0)
            const open = isOpen(r)
            const geenBedrag = (r.amount || 0) <= 0.005
            const invulRij = fillMode && geenBedrag && editRoundId !== r.id
            return (
              <div key={r.id} style={{ ...S.card, padding: 0, overflow: "hidden", ...(editRoundId === r.id ? { boxShadow: "inset 0 0 0 2px rgba(240,165,0,0.55)", background: "#fffdf3" } : invulRij ? { border: "1.5px solid rgba(240,165,0,0.55)", background: "#fffdf3" } : {}) }}>
                <div onClick={() => toggle(r.id)} style={{ padding: "12px 14px", cursor: "pointer", background: editRoundId === r.id ? "rgba(240,165,0,0.1)" : open ? "rgba(240,165,0,0.06)" : invulRij ? "rgba(240,165,0,0.09)" : "#fff" }}>
                  <div style={{ ...S.row, justifyContent: "space-between", gap: 8 }}>
                    <div style={{ ...S.row, gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 800, color: "#4a3f1e" }}>{editRoundId === r.id ? L.editRoundHead(nr) : L.roundSummary(nr, items)}</span>
                      {geenBedrag && editRoundId !== r.id && (
                        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: "#8a5e0f", background: "rgba(240,165,0,0.16)", borderRadius: 12, padding: "3px 9px", whiteSpace: "nowrap" }}>{L.noAmountBadge}</span>
                      )}
                    </div>
                    <div style={{ ...S.row, gap: 9, flexShrink: 0 }}>
                      {editRoundId === r.id ? (
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: "#c0554a", background: "rgba(224,104,92,0.12)", borderRadius: 12, padding: "4px 10px", whiteSpace: "nowrap" }}>{L.notSavedYet}</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 15.5, fontWeight: 800, color: (r.amount || 0) > 0 ? "#c98a00" : "#c4b896" }}>{(r.amount || 0) > 0 ? euro(r.amount) : "€ —"}</span>
                          <span style={{ fontSize: 15, color: "#8a7d55", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Betaald-melding net onder de titel — leesbaar, geen invulveld meer. */}
                  <div style={{ fontSize: 14, color: "#8a7d55", fontWeight: 600, marginTop: 4 }}>
                    {(r.amount || 0) > 0.005 ? L.paidNote(euro(r.amount)) : L.noAmountNote}
                    {(r.potPart || 0) > 0.005
                      ? <span style={{ color: "#1f6b3a", fontWeight: 700 }}> · 🫙 {L.paidFromPot(euro(r.potPart || 0))}</span>
                      : <span style={{ color: "#b3a988" }}> · {L.noPotUsed}</span>}
                  </div>
                  {/* Kwam je aanvullen? Dan hoef je niet eerst open te klappen. */}
                  {invulRij && (
                    <div style={{ textAlign: "right", marginTop: 9 }}>
                      <span onClick={(e) => { e.stopPropagation(); setOpenRounds((prev) => new Set(prev).add(r.id)); startEditRound(r) }}
                        style={{ display: "inline-block", fontSize: 13, fontWeight: 800, color: "#c98a00", background: "#fff", border: "1px solid rgba(240,165,0,0.6)", borderRadius: 14, padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>{L.addAmountBtn}</span>
                    </div>
                  )}
                </div>
                {open && (() => {
                  const idx = rounds.indexOf(r)
                  const bewerk = editRoundId === r.id && editDraft !== null
                  const dr = editDraft
                  const uitPot = bewerk && dr ? dr.usePot : (r.potPart || 0) > 0.005
                  const potLeeg = Math.max(0, potAvailFor(idx)) <= 0.005
                  return (
                  <div style={{ padding: "4px 14px 14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {drinksOf(r).map(({ d, n }) => {
                        const val = bewerk && dr ? (dr.drinks[d.id] ?? n) : n
                        return (
                        <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "3px 0" }}>
                          <span style={{ fontSize: 15.5, fontWeight: 700 }}>{d.emoji} {d.name}</span>
                          {bewerk ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                              <button style={{ width: 30, height: 30, borderRadius: 8, background: "#f7f1e2", border: "1px solid rgba(120,95,20,0.2)", fontSize: 16, color: "#8a7d55", fontWeight: 800, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, drinks: { ...c.drinks, [d.id]: Math.max(0, (c.drinks[d.id] ?? n) - 1) } } : c) }}>−</button>
                              <span style={{ fontSize: 17, fontWeight: 800, color: "#c98a00", minWidth: 28, textAlign: "center" }}>{val}×</span>
                              <button style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 16, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, drinks: { ...c.drinks, [d.id]: (c.drinks[d.id] ?? n) + 1 } } : c) }}>+</button>
                            </span>
                          ) : (
                            <span style={{ fontSize: 17, fontWeight: 800, color: "#c98a00" }}>{n}×</span>
                          )}
                        </div>
                        )
                      })}
                    </div>

                    <div style={{ ...S.row, justifyContent: "space-between", alignItems: "center", marginTop: 11, paddingTop: 10, borderTop: "1px solid rgba(120,95,20,0.12)" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#8a7d55" }}>💶 {L.paidLabel}</span>
                      {bewerk && dr ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 16, color: "#8a7d55", fontWeight: 700 }}>€</span>
                          <input onClick={(e) => e.stopPropagation()} type="text" inputMode="decimal" placeholder="0,00"
                            value={dr.amount > 0 ? String(dr.amount).replace(".", ",") : ""}
                            onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."); setEditDraft((c) => c ? { ...c, amount: parseFloat(v) || 0 } : c) }}
                            style={{ ...S.input, width: 92, padding: "8px 10px", fontSize: 16, fontWeight: 800, color: "#c88a1a", textAlign: "right" }} />
                        </span>
                      ) : (
                        <span style={{ fontSize: 17, fontWeight: 800, color: "#c98a00" }}>{(r.amount || 0) > 0 ? euro(r.amount) : "—"}</span>
                      )}
                    </div>

                    {/* Waarmee betaald? Ook achteraf nog te corrigeren. */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(120,95,20,0.12)" }}>
                      {bewerk && dr ? (
                        <>
                          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13.5, color: "#8a7d55", fontWeight: 800 }}>🫙 {L.paidWithQ}</span>
                            <span onClick={(e) => { e.stopPropagation(); setShowPot(true) }} style={{ fontSize: 13, fontWeight: 800, color: "#c98a00", textDecoration: "underline", cursor: "pointer" }}>{L.potTopUp}</span>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, usePot: false } : c) }}
                              style={{ flex: 1, padding: "9px 6px", borderRadius: 9, fontSize: 13.5, fontWeight: 800, border: "none", cursor: "pointer", background: !uitPot ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#f7f1e2", color: !uitPot ? "#fff" : "#8a7d55" }}>💶 {L.paidSelf}</button>
                            <button onClick={(e) => { e.stopPropagation(); if (!potLeeg) setEditDraft((c) => c ? { ...c, usePot: true } : c) }}
                              style={{ flex: 1, padding: "9px 6px", borderRadius: 9, fontSize: 13.5, fontWeight: 800, border: "none", cursor: potLeeg ? "not-allowed" : "pointer", opacity: potLeeg ? 0.5 : 1, background: uitPot ? "linear-gradient(135deg,#2fae6a,#1f8a4c)" : "#f7f1e2", color: uitPot ? "#fff" : "#8a7d55" }}>🫙 {L.paidPot}{potLeeg ? ` · ${L.emptyWord}` : ""}</button>
                          </div>
                          {potLeeg && <div style={{ fontSize: 12.5, color: "#c0554a", fontWeight: 700, marginTop: 6 }}>{L.potEmptyFillFirst}</div>}
                          {/* Te weinig in de pot: binair — bijvullen of zelf betalen. */}
                          {!potLeeg && dr.usePot && dr.amount > Math.max(0, potAvailFor(idx)) + 0.005 && (
                            <div style={{ background: "rgba(224,104,92,0.08)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 10, padding: "10px 11px", marginTop: 9 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>⚠️ {L.potShortTitle}</div>
                              <div style={{ fontSize: 12.5, color: "#8a6b5f", lineHeight: 1.5, marginBottom: 9 }}>{L.potShortSimple(euro(Math.max(0, potAvailFor(idx))), euro(dr.amount))}</div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button style={{ ...S.btn, flex: 1, fontSize: 13, fontWeight: 800, padding: "9px 6px" }} onClick={(e) => { e.stopPropagation(); setShowPot(true) }}>{L.potChoiceTopUp}</button>
                                <button style={{ ...S.btn, flex: 1, fontSize: 13, fontWeight: 800, padding: "9px 6px" }} onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, usePot: false } : c) }}>{L.potChoicePaySelf}</button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ ...S.row, justifyContent: "space-between" }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#8a7d55" }}>🫙 {L.paidWithQ}</span>
                          <span style={{ fontSize: 15.5, fontWeight: 800, color: uitPot ? "#1f8a4c" : "#8a7d55" }}>{uitPot ? L.paidFromPot(euro(r.potPart || 0)) : L.paidSelf}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ ...S.row, justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(120,95,20,0.12)" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#8a7d55" }}>👤 {L.peopleInRound}</span>
                      {bewerk && dr ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <button style={{ width: 32, height: 32, borderRadius: 9, background: "#f7f1e2", border: "1px solid rgba(120,95,20,0.2)", fontSize: 17, color: "#8a7d55", fontWeight: 800, cursor: "pointer", opacity: dr.headcount > 1 ? 1 : 0.4 }}
                            onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, headcount: Math.max(1, c.headcount - 1) } : c) }}>−</button>
                          <span style={{ fontSize: 18, fontWeight: 800, minWidth: 22, textAlign: "center", color: "#4a3f1e" }}>{dr.headcount}</span>
                          <button style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#f0a500,#e08a00)", border: "none", fontSize: 17, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                            onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, headcount: c.headcount + 1 } : c) }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 17, fontWeight: 800, color: "#c98a00" }}>{r.headcount || 1}</span>
                      )}
                    </div>

                    {bewerk && (
                      <div style={{ marginTop: 14 }}>
                        <button style={{ ...S.btnP, width: "100%" }} onClick={(e) => { e.stopPropagation(); saveEditRound(r) }}>💾 {L.saveWord}</button>
                        <button style={{ width: "100%", marginTop: 8, padding: "9px 0", background: "none", border: "none", fontSize: 14, fontWeight: 700, color: "#a89a6f", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); cancelEditRound() }}>✕ {L.cancel}</button>
                      </div>
                    )}

                    {/* Aanpassen staat onderaan en enkel bij een open rondje — zo tik je er niet per ongeluk op. */}
                    {!bewerk && (
                      <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(120,95,20,0.12)", textAlign: "right" }}>
                        <span onClick={(e) => { e.stopPropagation(); startEditRound(r) }}
                          style={{ display: "inline-block", fontSize: 13, fontWeight: 800, color: "#c98a00", background: "#faf4e4", border: "1px solid rgba(240,165,0,0.45)", borderRadius: 14, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>✏️ {L.adjustWord}</span>
                      </div>
                    )}
                  </div>
                  )
                })()}
              </div>
            )
          })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button style={{ ...S.btn, flex: 1, padding: "14px 6px", fontSize: 15.5, fontWeight: 800 }} onClick={goQuickSettle}>{L.quickSettleTitle}</button>
          {laatsteRondjeKlaar() && (
            <button style={{ ...S.btnP, flex: 1.3, padding: "14px 6px", fontSize: 15.5 }} onClick={nextRound}>{L.newRound}</button>
          )}
        </div>
        {rounds.length > 0 && laatsteRondjeKlaar() && (
          <button style={{ width: "100%", marginTop: 8, border: "1.5px dashed rgba(240,165,0,0.6)", background: "rgba(240,165,0,0.08)", color: "#8a5e0f", borderRadius: 14, padding: "12px 6px", fontSize: 15, fontWeight: 800, cursor: "pointer" }} onClick={repeatRound}>{L.repeatRound}</button>
        )}
      </div></div>
    )
  }

  // ── FINAL ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}><div style={S.wrap}>
      <Header />
      {showPot && renderPotModal()}
        {renderDialogs()}
      <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ ...S.h3, margin: 0 }}>{L.finalBalance}</h3>
        {pay === "coin" && (
          <div style={{ ...S.row, gap: 6 }}>
            <div style={{ ...S.seg(displayUnit === "eur"), flex: "none", padding: "6px 12px" }} onClick={() => setDisplayUnit("eur")}>€</div>
            <div style={{ ...S.seg(displayUnit === "coin"), flex: "none", padding: "6px 12px" }} onClick={() => setDisplayUnit("coin")}>🎟️</div>
          </div>
        )}
      </div>

      <div style={{ ...S.card, background: "linear-gradient(135deg,#fff7e6,#fdefc9)" }}>
        <div style={{ ...S.row, justifyContent: "space-between", fontSize: 15.5 }}>
          <span style={{ fontWeight: 800 }}>{L.totalOrdered}</span>
          <span style={{ fontWeight: 800, fontSize: 19 }}>{show(grandTotal)}</span>
        </div>
        {potSpent > 0 && (
          <div style={{ marginTop: 6, borderTop: "1px dashed rgba(120,95,20,0.2)", paddingTop: 6 }}>
            <div style={{ ...S.row, justifyContent: "space-between", fontSize: 14.5, color: "#8a7d55" }}><span>🫙 waarvan uit de pot</span><span style={{ fontWeight: 700, color: "#1f8a4c" }}>−{show(potSpent)}</span></div>
            <div style={{ ...S.row, justifyContent: "space-between", fontSize: 14.5, color: "#8a7d55" }}><span>door personen betaald</span><span style={{ fontWeight: 700 }}>{show(grandTotal - potSpent)}</span></div>
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ ...S.row, gap: 6, marginBottom: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.fairSplit}</h3>
          <span onClick={() => setNotice("⚖️ Fair Split — Eerlijker dan gelijke verdeling. Wie weinig of goedkopere drankjes nam, betaalt niet mee voor wie meer of duurdere drankjes nam.")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 13, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>i</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => { setOpenFairAll((v) => !v); setOpenFair({}) }} style={{ ...S.btn, padding: "7px 14px", fontSize: 14.5, fontWeight: 800, color: "#8a5e0f" }}>{openFairAll ? "▴ Sluit details" : "▾ Bekijk details"}</button>
        </div>
        {anyUnassignedRounds && (
          <div style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "11px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>{L.equalSplitWarn}</div>
            <div style={{ fontSize: 13.5, color: "#8a5e0f", lineHeight: 1.5, marginBottom: 9 }}>{L.unassignedWarn}</div>
            <button style={{ ...S.btnP, width: "100%", padding: "11px 0", fontSize: 15.5 }} onClick={goAssignUnassigned}>{L.useFairSplit}</button>
          </div>
        )}
        {showEqual && (
          <div style={{ ...S.row, justifyContent: "flex-end", gap: 4, fontSize: 12, color: "#8a7d55", fontWeight: 800, paddingBottom: 4, borderBottom: "1px solid rgba(120,95,20,0.12)" }}>
            <span>gelijke verdeling</span>
            <span onClick={() => setNotice(L.fairSplitInfo)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 9.5, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>i</span>
          </div>
        )}
        {people.map((p) => {
          const dronk = consumption(p.id), waarborg = cupOwn(p.id), zelf = paidByPerson(p.id), inpot = contribOf(p.id)
          const owed = dronk + waarborg - zelf - inpot + cardLossPer
          const open = openFairAll || openFair[p.id]
          const nettoLabel = Math.abs(owed) < 0.005 ? "staat gelijk" : owed > 0 ? `moet ${show(owed)} betalen` : `krijgt ${show(-owed)} terug`
          const nettoColor = Math.abs(owed) < 0.005 ? "#8a7d55" : owed > 0 ? "#b35309" : "#1f8a4c"
          return (
            <div key={p.id} style={{ borderBottom: "1px solid rgba(120,95,20,0.06)" }}>
              <div style={{ ...S.row, justifyContent: "space-between", padding: "7px 0", cursor: "pointer" }} onClick={() => setOpenFair((o) => ({ ...o, [p.id]: !open }))}>
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 700 }}>{open ? "▾" : "▸"} {p.name} <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1f8a4c" }}>· {show(dronk)}</span>
                  {Math.abs(owed) > 0.005 && <span style={{ display: "inline-block", marginLeft: 6, fontSize: 13, fontWeight: 800, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", background: owed > 0 ? "rgba(224,138,0,0.16)" : "rgba(31,138,76,0.14)", color: owed > 0 ? "#b35309" : "#1f8a4c" }}>{owed > 0 ? `betaalt ${show(owed)}` : `krijgt ${show(-owed)}`}</span>}
                </span>
                {showEqual && <span style={{ width: 96, textAlign: "right", fontSize: 14.5, color: "#8a7d55" }}>{show(equalShare)}</span>}
              </div>
              {open && (
                <div style={{ background: "#faf4e4", borderRadius: 10, padding: "8px 11px", margin: "0 0 8px", fontSize: 14.5 }}>
                  <div style={{ color: "#6b5f3a", padding: "2px 0" }}>{L.drank}</div>
                  {(() => {
                    const cnt: Record<string, number> = {}
                    rounds.forEach((r) => Object.entries(r.orders).forEach(([did, per]) => { const q = per?.[p.id] ?? 0; if (q > 0) cnt[did] = (cnt[did] ?? 0) + q }))
                    const list = drinks.filter((d) => (cnt[d.id] ?? 0) > 0)
                    if (list.length === 0) return null
                    return <div style={{ fontSize: 13.5, color: "#8a7d55", padding: "1px 0 5px", lineHeight: 1.5 }}>{list.map((d) => `${cnt[d.id]}× ${d.name}`).join(" · ")}</div>
                  })()}
                  {depositOn && Math.abs(waarborg) > 0.005 && <div style={{ color: "#6b5f3a", padding: "2px 0" }}>{L.depositAdvanced} <b style={{ color: "#4a3f1e" }}>{show(waarborg)}</b></div>}
                  {zelf > 0.005 && (() => {
                    const rr = rounds.map((r, i) => ((r.payers?.[p.id] || 0) > 0.005 ? i + 1 : 0)).filter((n) => n > 0)
                    const label = rr.length === 0 ? "al betaald" : rr.length === 1 ? `al betaald in ronde ${rr[0]}` : `al betaald in ronde ${rr.join(", ")}`
                    return <div style={{ color: "#6b5f3a", padding: "2px 0" }}>{label} <b style={{ color: "#1f8a4c" }}>{show(zelf)}</b></div>
                  })()}
                  {inpot > 0.005 && <div style={{ color: "#6b5f3a", padding: "2px 0" }}>{L.inPot} <b style={{ color: "#1f8a4c" }}>{show(inpot)}</b></div>}
                  {cardLossPer > 0.005 && <div style={{ color: "#6b5f3a", padding: "2px 0" }}>{L.cardLoss} <b style={{ color: "#4a3f1e" }}>{show(cardLossPer)}</b></div>}
                  <div style={{ padding: "6px 0 0", marginTop: 4, borderTop: "1px dashed rgba(120,95,20,0.25)", fontWeight: 800, color: nettoColor }}>{nettoLabel}</div>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ ...S.row, justifyContent: "space-between", padding: "9px 0 2px", borderTop: "2px solid rgba(120,95,20,0.25)", marginTop: 2 }}>
          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 800 }}>Totaal <span style={{ fontSize: 15, fontWeight: 800, color: "#1f8a4c" }}>· {show(grandTotal)}</span></span>
          {showEqual && <span style={{ width: 96, textAlign: "right", fontSize: 14.5, fontWeight: 800, color: "#8a7d55" }}>{show(equalShare * people.length)}</span>}
        </div>
        <div style={{ fontSize: 13.5, marginTop: 10, textAlign: "right" }}><span onClick={() => setShowEqual((v) => !v)} style={{ color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{showEqual ? "verberg gelijke verdeling" : "toon gelijke verdeling"}</span></div>
      </div>

      {renderSettleTogether()}

      <div style={S.card}>
        <h3 style={{ ...S.h3, marginBottom: 8 }}>{L.howYouAllSettle}</h3>
        {isSchatting && (
          <div style={{ background: "#fff8e8", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#c98a00", marginBottom: 2 }}>⚠️ {L.estimate}</div>
            <div style={{ fontSize: 13.5, color: "#8a7d55", lineHeight: 1.5 }}>{L.estimateWhy}</div>
          </div>
        )}
        <p style={{ ...S.sub, marginBottom: 8 }}>{L.fewestTransfers}</p>
        {settlement.tx.length === 0 ? <div style={{ fontSize: 15.5, color: "#1f8a4c", fontWeight: 700 }}>{L.allEven}</div> : settlement.tx.map((t, i) => (
          <div key={i} style={{ ...S.row, justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
            <span style={{ fontSize: 15.5 }}><b>{t.from}</b> → {t.to}</span><span style={{ fontSize: 16, fontWeight: 800, color: "#b35309" }}>{show(t.amount)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...S.btn, flex: 1 }} onClick={() => { setOpenRound(rounds.length - 1); setView("hub") }}>{L.roundsOverview}</button>
        <button style={{ ...S.btnP, flex: 1 }} onClick={nextRound}>{L.newRound}</button>
      </div>
    </div></div>
  )
}
