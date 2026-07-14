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
type Cat = "Bier" | "BierAV" | "Frisdrank" | "Wijn" | "Cocktail" | "Mocktail" | "Longdrink" | "Shot" | "Warm"
type Drink = { id: string; name: string; emoji: string; cat: Cat; price: number; cup: boolean; fav: boolean; coins: number; custom?: boolean; by?: string }

const CATS: Cat[] = ["Bier", "BierAV", "Frisdrank", "Wijn", "Cocktail", "Mocktail", "Longdrink", "Shot", "Warm"]
const CAT_LABEL: Record<Cat, string> = { Bier: "🍺 Bier", BierAV: "🌿 AV-bier", Frisdrank: "🥤 Fris", Wijn: "🍷 Wijn", Cocktail: "🍸 Cocktail", Mocktail: "🍹 Mocktail", Longdrink: "🥃 Longdrink", Shot: "🔥 Shot", Warm: "☕ Warm" }
const CAT_EMOJI: Record<Cat, string> = { Bier: "🍺", BierAV: "🌿", Frisdrank: "🥤", Wijn: "🍷", Cocktail: "🍸", Mocktail: "🍹", Longdrink: "🥃", Shot: "🔥", Warm: "☕" }
const CUPCAT: Record<Cat, boolean> = { Bier: true, BierAV: true, Frisdrank: true, Wijn: true, Cocktail: true, Mocktail: true, Longdrink: false, Shot: false, Warm: false }

const DATA: [Cat, string, number][] = [
  ["Bier", "Pils", 3.2], ["Bier", "Duvel", 5], ["Bier", "Chimay Blauw", 5.5], ["Bier", "Cornet", 5], ["Bier", "Geuze", 5], ["Bier", "Hoegaarden Wit", 4], ["Bier", "Kriek", 4.5], ["Bier", "La Chouffe", 5], ["Bier", "Leffe Blond", 4.5], ["Bier", "Tripel Karmeliet", 5.5], ["Bier", "Vedett Extra Blond", 4], ["Bier", "Westmalle Tripel", 5],
  ["BierAV", "Jupiler 0.0", 3], ["BierAV", "Stella Artois 0.0", 3], ["BierAV", "Carlsberg 0.0", 3], ["BierAV", "Corona Cero", 3.5], ["BierAV", "Hoegaarden 0.0", 3.5], ["BierAV", "La Chouffe 0.0", 4], ["BierAV", "Leffe Blond 0.0", 3.5], ["BierAV", "Sportzot", 3.5], ["BierAV", "Cornet 0.0", 4], ["BierAV", "Vedett 0.0", 3.5], ["BierAV", "Cristal 0.0", 3], ["BierAV", "Maes 0.0", 3], ["BierAV", "Palm 0.0", 3.5], ["BierAV", "Kriek 0.0", 3.5], ["BierAV", "Duvel 0.0", 4],
  ["Frisdrank", "Coca-Cola", 3], ["Frisdrank", "Coca-Cola Zero", 3], ["Frisdrank", "Coca-Cola Light", 3], ["Frisdrank", "Fanta", 3], ["Frisdrank", "Sprite", 3], ["Frisdrank", "Ice Tea", 3], ["Frisdrank", "Red Bull", 4], ["Frisdrank", "Schweppes Tonic", 3.5], ["Frisdrank", "Appelsap", 3], ["Frisdrank", "Sinaasappelsap", 4], ["Frisdrank", "Water plat", 2.8], ["Frisdrank", "Water bruis", 2.8], ["Frisdrank", "Ice Tea Green", 3],
  ["Wijn", "Huiswijn rood", 5], ["Wijn", "Huiswijn wit", 5], ["Wijn", "Huiswijn rosé", 5], ["Wijn", "Cava", 6.5], ["Wijn", "Prosecco", 6.5], ["Wijn", "Champagne", 11], ["Wijn", "Cabernet Sauvignon", 5.5], ["Wijn", "Chardonnay", 5.5], ["Wijn", "Merlot", 5.5], ["Wijn", "Pinot Noir", 5.5], ["Wijn", "Sauvignon Blanc", 5.5], ["Wijn", "Sangria", 5], ["Wijn", "Porto", 5],
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
  "Pils", "Duvel",
  // AV-bier
  "Jupiler 0.0", "Carlsberg 0.0", "Sportzot",
  // Frisdrank
  "Coca-Cola", "Coca-Cola Zero", "Coca-Cola Light", "Fanta", "Schweppes Tonic", "Water plat", "Water bruis",
  // Wijn
  "Huiswijn wit", "Huiswijn rood", "Huiswijn rosé", "Cava", "Champagne",
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
const PILS = new Set(["Pils", "Jupiler 0.0", "Stella Artois 0.0", "Carlsberg 0.0", "Corona Cero", "Hoegaarden 0.0", "Leffe Blond 0.0", "Sportzot", "Vedett 0.0", "Cristal 0.0", "Maes 0.0", "Palm 0.0"])
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
type Round = { id: string; seq: number; status: "open" | "pending" | "closed"; orders: Assign; anon: Anon; payers: Record<string, number>; amount: number; potPart: number; gaveBack: Record<string, number> }

const euro = (v: number) => "€" + v.toFixed(2).replace(".", ",")

// ── Spraak (beta) ───────────────────────────────────────────────────────────
// "drie pils en twee cola" -> [{pils,3},{coca-cola,2}]. Bewust simpel: we zoeken
// getallen en drankennamen, de rest negeren we. Spraakherkenning maakt fouten, dus
// de gebruiker krijgt ALTIJD te zien wat we verstonden voor er iets in de mand belandt.
const TELWOORD: Record<string, number> = {
  een: 1, één: 1, "n": 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
}

function parseSpraak(tekst: string, lijst: { id: string; name: string }[]): { id: string; name: string; qty: number }[] {
  const woorden = normText(tekst).split(" ").filter(Boolean)
  const treffers: { id: string; name: string; qty: number }[] = []

  // Langste namen eerst: anders kaapt "cola" de match van "coca cola zero".
  const namen = [...lijst]
    .map((d) => ({ ...d, delen: normText(d.name).split(" ").filter(Boolean) }))
    .sort((a, b) => b.delen.length - a.delen.length)

  let i = 0
  while (i < woorden.length) {
    let aantal = 1
    const w = woorden[i]
    if (TELWOORD[w] !== undefined) { aantal = TELWOORD[w]; i++ }
    else if (/^\d+$/.test(w)) { aantal = Math.min(20, parseInt(w, 10)); i++ }
    if (i >= woorden.length) break

    const kandidaat = namen.find((d) => d.delen.every((deel, k) => woorden[i + k] === deel))
    if (kandidaat) {
      const bestaand = treffers.find((t) => t.id === kandidaat.id)
      if (bestaand) bestaand.qty += aantal
      else treffers.push({ id: kandidaat.id, name: kandidaat.name, qty: aantal })
      i += kandidaat.delen.length
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
    allSeatsTaken: "Alle plaatsen zijn ingenomen. Vraag de organisator om er een bij te zetten.",
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

    addOwnDrink: "⭐ Eigen drankje toevoegen",

    // ── start & setup
    tagline: "Rondjes en splitten zonder gedoe!",
    groupNameLabel: "Groepsnaam",
    groupNamePh: "Typ je groepsnaam",
    startBtn: "Starten",
    starting: "Bezig…",
    savedGroups: "📁 Opgeslagen groepen",
    savedLater: "later beschikbaar",
    savedNote: "Groepen bewaren tussen sessies komt in de volledige app (met database).",
    nameGroupFirst: "Geef je groep eerst een naam.",
    createFailed: "Groep aanmaken mislukt. Probeer opnieuw.",

    peopleCount: "👥 Aantal personen",
    namesOptional: "Namen zijn optioneel — pas ze aan wanneer je wil.",
    peopleTitle: "Personen",
    tapToRename: "tik op een naam om te hernoemen",
    noPeopleYet: "Nog geen personen",
    addPersonFirst: "Voeg eerst minstens één persoon toe.",
    thatsMe: "dat ben ik",
    notMeShort: "niet ik",
    freeUp: "vrijgeven",
    thisIsYou: "Dit ben jij",
    selfJoined: "Deze persoon meldde zich zelf aan",
    seatLegend: "📱 = meldde zich zelf aan via de link · ⭐ = dat ben jij. Wie niet scant, duid je gewoon zelf aan tijdens het bestellen.",
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
    beforeWeStart: "Voor we beginnen",
    workWith: "Werk je met…",
    reusableCups: "♻️ herbruikbare bekers (met waarborg)",
    coinsInstead: "🎟️ coins in plaats van euro's",
    sharedPot: "een gezamenlijke pot of drankkaart?",
    adjustLater: "💡 Later aanpasbaar via ⚙️ Groep. Zet je iets op 'ja', dan vul je de details zo meteen in.",
    quickStart: "Snel starten",
    continueRound: (n: number) => `Ga verder met rondje ${n}`,

    // ── instellingen
    groupSettings: "⚙️ Groep",
    cupsTitle: "♻️ Herbruikbare bekers",
    cupsInfo: "Voor events met waarborg per beker die je terugkrijgt bij inleveren. Zet aan om de borg mee te verrekenen.",
    depositPerCup: "Waarborg/beker",
    coinsTitle: "🎟️ Coins",
    coinsInfo: "Betaal je met coins i.p.v. euro's? Stel de coin-waarde en prijzen in; de app verdeelt eerlijk.",
    coinPrices: "🎟️ coin-prijzen per drankje",
    coinPricesInfo: "Standaard festival-coins per drankje. Pas aan met − / + (stapjes van 0,1).",
    potTitle: "🫙 Pot",
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
    eachOneConfirm: (n: string, meer: boolean) => `${n} ${meer ? "hebben" : "heeft"} er nu al 2 of meer. Met "elk 1" krijgt iedereen er precies 1.`,
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
    potTooLow: (kaart: boolean, max: string) => `De ${kaart ? "drankkaart" : "pot"} heeft maar ${max} — verlaag het bedrag.`,
    potNothingIn: (kaart: boolean) => `Je koos voor een ${kaart ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch verder gaan?`,
    anywayWithout: (kaart: boolean) => `Toch verder zonder ${kaart ? "drankkaart" : "pot"}`,

    // ── overzicht
    roundsOverview: "📋 Rondjesoverzicht",
    overview: "📋 Overzicht",
    newRound: "➕ Nieuw rondje",
    repeatRound: "🔁 Zelfde rondje opnieuw",
    editOrderBtn: "✏️ Bestelling wijzigen",
    noRoundsDone: "Nog geen afgeronde rondjes",
    noRoundsHint: "Zodra een rondje bevestigd én betaald is, verschijnt het hier — dan kan je het nog aanpassen.",
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
    fairSplitInfo: "Gelijke verdeling = totaal ÷ aantal personen. Fair Split is eerlijker: wie weinig of niks dronk, betaalt minder.",
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
    coinsLabel: "Coins",
    coinsAuto: "{L.coinsAuto}",
    addBtn: "Toevoegen",
    remaining: (n: number, max: number) => `Nog ${n} van je ${max} eigen drankjes over`,
    addedByYou: "Door jou toegevoegd",
    nameYourDrink: "Geef je drankje een naam.",
    needPrice: "Vul een richtprijs in — anders kan Fair Split dit drankje niet eerlijk verdelen.",
    alreadyExists: (n: string) => `"${n}" staat al in de lijst.`,
    maxPerPerson: (n: number) => `Je kan maximaal ${n} eigen drankjes toevoegen.`,
    maxPerGroup: (n: number) => `De groep zit aan het maximum van ${n} eigen drankjes.`,
    drinkAdded: (n: string) => `⭐ ${n} toegevoegd.`,
    drinkInUse: (n: string) => `${n} is al besteld en kan niet meer verwijderd worden.`,

    confirmTitle: "Even bevestigen",
    reset: "↺ reset",
    voiceBtn: "🎤 Inspreken",
    voiceBeta: "beta",
    voiceListening: "🎤 Luisteren…",
    voiceSay: "Zeg bijvoorbeeld: \"drie pils en twee cola\"",
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
    allSeatsTaken: "Toutes les places sont prises. Demande à l'organisateur d'en ajouter une.",
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

    addOwnDrink: "⭐ Ajouter une boisson",

    // ── start & setup
    tagline: "Les tournées et le partage, sans prise de tête !",
    groupNameLabel: "Nom du groupe",
    groupNamePh: "Tape le nom de ton groupe",
    startBtn: "Démarrer",
    starting: "En cours…",
    savedGroups: "📁 Groupes enregistrés",
    savedLater: "bientôt disponible",
    savedNote: "La sauvegarde des groupes entre les sessions arrive dans l'app complète.",
    nameGroupFirst: "Donne d'abord un nom à ton groupe.",
    createFailed: "Échec de la création du groupe. Réessaie.",

    peopleCount: "👥 Nombre de personnes",
    namesOptional: "Les noms sont facultatifs — modifie-les quand tu veux.",
    peopleTitle: "Personnes",
    tapToRename: "touche un nom pour le modifier",
    noPeopleYet: "Aucune personne",
    addPersonFirst: "Ajoute d'abord au moins une personne.",
    thatsMe: "c'est moi",
    notMeShort: "pas moi",
    freeUp: "libérer",
    thisIsYou: "C'est toi",
    selfJoined: "Cette personne s'est inscrite elle-même",
    seatLegend: "📱 = inscrit via le lien · ⭐ = c'est toi. Ceux qui ne scannent pas, tu les coches toi-même en commandant.",
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
    beforeWeStart: "Avant de commencer",
    workWith: "Tu travailles avec…",
    reusableCups: "♻️ des gobelets réutilisables (avec caution)",
    coinsInstead: "🎟️ des jetons au lieu d'euros",
    sharedPot: "un pot commun ou une carte boissons ?",
    adjustLater: "💡 Modifiable plus tard via ⚙️ Groupe. Si tu mets 'oui', tu remplis les détails juste après.",
    quickStart: "Démarrage rapide",
    continueRound: (n: number) => `Continuer la tournée ${n}`,

    // ── instellingen
    groupSettings: "⚙️ Groupe",
    cupsTitle: "♻️ Gobelets réutilisables",
    cupsInfo: "Pour les events avec caution par gobelet, remboursée au retour. Active pour l'inclure dans le décompte.",
    depositPerCup: "Caution/gobelet",
    coinsTitle: "🎟️ Jetons",
    coinsInfo: "Tu paies en jetons plutôt qu'en euros ? Règle la valeur et les prix ; l'app répartit équitablement.",
    coinPrices: "🎟️ prix en jetons par boisson",
    coinPricesInfo: "Jetons festival par défaut. Ajuste avec − / + (pas de 0,1).",
    potTitle: "🫙 Pot",
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
    eachOneConfirm: (n: string, meer: boolean) => `${n} ${meer ? "en ont" : "en a"} déjà 2 ou plus. Avec « 1 chacun », tout le monde en reçoit exactement 1.`,
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
    potTooLow: (kaart: boolean, max: string) => `${kaart ? "La carte" : "Le pot"} n'a que ${max} — baisse le montant.`,
    potNothingIn: (kaart: boolean) => `Tu as choisi ${kaart ? "une carte boissons" : "un pot"}, mais rien n'a encore été mis. Continuer quand même ?`,
    anywayWithout: (kaart: boolean) => `Continuer sans ${kaart ? "carte" : "pot"}`,

    // ── overzicht
    roundsOverview: "📋 Aperçu des tournées",
    overview: "📋 Aperçu",
    newRound: "➕ Nouvelle tournée",
    repeatRound: "🔁 Refaire la même tournée",
    editOrderBtn: "✏️ Modifier la commande",
    noRoundsDone: "Aucune tournée terminée",
    noRoundsHint: "Dès qu'une tournée est confirmée et payée, elle apparaît ici — tu peux encore la modifier.",
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
    fairSplitInfo: "Répartition égale = total ÷ nombre de personnes. Le Fair Split est plus juste : qui a peu ou rien bu paie moins.",
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
    coinsLabel: "Jetons",
    coinsAuto: "(vide = automatique)",
    addBtn: "Ajouter",
    remaining: (n: number, max: number) => `Encore ${n} de tes ${max} boissons personnalisées`,
    addedByYou: "Ajouté par toi",
    nameYourDrink: "Donne un nom à ta boisson.",
    needPrice: "Entre un prix indicatif — sinon le Fair Split ne peut pas répartir cette boisson.",
    alreadyExists: (n: string) => `« ${n} » est déjà dans la liste.`,
    maxPerPerson: (n: number) => `Tu peux ajouter maximum ${n} boissons personnalisées.`,
    maxPerGroup: (n: number) => `Le groupe a atteint le maximum de ${n} boissons personnalisées.`,
    drinkAdded: (n: string) => `⭐ ${n} ajouté.`,
    drinkInUse: (n: string) => `${n} a déjà été commandé et ne peut plus être supprimé.`,

    confirmTitle: "Confirmation",
    reset: "↺ reset",
    voiceBtn: "🎤 Dicter",
    voiceBeta: "bêta",
    voiceListening: "🎤 J'écoute…",
    voiceSay: "Dis par exemple : « trois pils et deux cola »",
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
  const [view, setView] = useState<"start" | "setup" | "settings" | "order" | "confirmed" | "hub" | "final">("start")
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
  type Custom = { key: string; name: string; cat: Cat; price: number; coins: number; cup: boolean; by: string }
  const [customDrinks, setCustomDrinks] = useState<Custom[]>([])
  // Afwijkende coin-prijzen voor dit feest. Ook jsonb op de groep-rij, dus gratis mee.
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({})
  const [showAddDrink, setShowAddDrink] = useState(false)
  const [ndName, setNdName] = useState("")
  const [ndCat, setNdCat] = useState<Cat>("Bier")
  const [ndPrice, setNdPrice] = useState("")
  const [ndCoins, setNdCoins] = useState("")
  const [inviteCode, setInviteCode] = useState<string>("")
  const [ownerDevice, setOwnerDevice] = useState<string>("")
  const [booting, setBooting] = useState(true)   // eerste laadbeurt (code uit de URL)
  const [busy, setBusy] = useState(false)        // groep aanmaken / plaats claimen
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
      id: c.key, name: c.name, emoji: "⭐", cat: c.cat, price: Number(c.price),
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
  const [everyoneDraft, setEveryoneDraft] = useState<string>("")
  const [everyoneChoice, setEveryoneChoice] = useState<number | "custom" | null>(null)
  const [editPotId, setEditPotId] = useState<string | null>(null)
  const [potBuilderOpen, setPotBuilderOpen] = useState(false)
  const [potIsCard, setPotIsCard] = useState(false)
  const [cardValue, setCardValue] = useState("")
  const [cardPayers, setCardPayers] = useState<string[]>([])
  const [beginPrompt, setBeginPrompt] = useState(false)
  const [bpPotType, setBpPotType] = useState<"none" | "yes" | "pot" | "card">("none")
  const [potChosen, setPotChosen] = useState(false)
  const [bpBekers, setBpBekers] = useState(false)
  const [bpCoins, setBpCoins] = useState(false)
  const [fromOnboarding, setFromOnboarding] = useState(false)
  const [onboardedOnce, setOnboardedOnce] = useState(false)
  const [onbPotActive, setOnbPotActive] = useState(false)

  const [roundNr, setRoundNr] = useState(1)
  const [activeCat, setActiveCat] = useState<Cat>("Bier")
  const [drinkSearch, setDrinkSearch] = useState("")
  const [guestTab, setGuestTab] = useState<"order" | "me">("order")
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [voiceText, setVoiceText] = useState("")
  const [voiceHits, setVoiceHits] = useState<{ id: string; name: string; qty: number }[]>([])
  const [coinCat, setCoinCat] = useState<Cat>("Bier")
  const [coinFull, setCoinFull] = useState(false)
  const [fullList, setFullList] = useState(true)
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
  const ensureRound = async (): Promise<string | null> => {
    if (openRoundId) return openRoundId
    if (!groupId) return null
    if (openRoundRef.current) return openRoundRef.current   // twee snelle tikken = één rondje
    openRoundRef.current = (async () => {
      const seq = Math.max(0, ...rounds.map((r) => r.seq)) + 1
      const { data, error } = await supabase.from("party_rounds")
        .insert([{ group_id: groupId, seq, status: "open" }]).select("id").single()
      if (error || !data) {
        // Iemand anders was net iets sneller: pak dan zijn open rondje.
        const { data: bestaand } = await supabase.from("party_rounds")
          .select("id").eq("group_id", groupId).eq("status", "open").maybeSingle()
        openRoundRef.current = null
        if (!bestaand) { setNotice("Rondje starten mislukt."); return null }
        setOpenRoundId(bestaand.id)
        return bestaand.id
      }
      openRoundRef.current = null
      setOpenRoundId(data.id)
      return data.id
    })()
    return openRoundRef.current
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
  const eachOne = (did: string) => { const hi = people.filter((p) => (cart[did]?.[p.id] ?? 0) >= 2).map((p) => p.name); if (hi.length > 0) { setConfirmDlg({ msg: `${hi.join(" en ")} ${hi.length === 1 ? "heeft" : "hebben"} er nu al 2 of meer. Met "elk 1" krijgt iedereen er precies één — ${hi.join(" en ")} ${hi.length === 1 ? "gaat" : "gaan"} dus terug naar 1.`, yes: L.yesEachOne, onYes: () => { setEachOne(did); setConfirmDlg(null) } }) } else setEachOne(did) }
  const drinkTotal = (did: string) => Object.values(cart[did] ?? {}).reduce((a, b) => a + b, 0) + (cartAnon[did] ?? 0)
  const roundItems = useMemo(() => drinks.reduce((s, d) => s + drinkTotal(d.id), 0), [cart, cartAnon, drinks]) // eslint-disable-line
  const resumeRound = () => { if (blockIfUnpaid()) return; setActiveCat(catsPresent[0]); setView("order") }
  const unfinishedRound = roundItems > 0 && rounds.length < roundNr
  const roundIsPaid = (r: Round) => (r.amount || 0) > 0.005 && ((r.potPart || 0) > 0.005 || Object.values(r.payers || {}).some((a) => (a || 0) > 0.005))
  const unpaidIdx = () => rounds.findIndex((r) => !roundIsPaid(r))
  const paidCount = rounds.filter(roundIsPaid).length
  const blockIfUnpaid = () => { const i = unpaidIdx(); if (i < 0) return false; setNotice(L.roundUnpaid(i + 1)); setView("confirmed"); return true }
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
  const rPaidSum = (r: Round) => (r.potPart || 0) + Object.values(r.payers || {}).reduce((a, b) => a + (b || 0), 0)
  const rTogglePayer = (idx: number, pid: string) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const cur = Object.keys(r.payers || {}); const persons = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]; const usePot = (r.potPart || 0) > 0; return rRedistribute(r, idx, usePot, persons, r.amount) })); setDirtyRound(idx) }

  // ── afgeleide bekers (uit rounds) ───────────────────────────────────────────
  const roundPicked = (r: Round, pid: string) => drinks.reduce((a, d) => a + (d.cup ? (r.orders[d.id]?.[pid] ?? 0) : 0), 0)
  const cupsBal = (pid: string) => rounds.reduce((s, r) => s + (roundPicked(r, pid) - (r.gaveBack[pid] || 0)), 0)

  const isGuestDefault = (name: string) => /^Gast \d+$/.test(name.trim())
  // Een plaats bijzetten = een rij in party_people. Leeg van naam: vrij tot iemand
  // ze claimt (de admin door ze te benoemen, een gast door de link te openen).
  const addPerson = async () => {
    if (!groupId) return
    const seat = people.reduce((m, p) => Math.max(m, p.seat), 0) + 1
    const { error } = await supabase.from("party_people").insert([{ group_id: groupId, seat, name: "" }])
    if (error) setNotice("Persoon toevoegen mislukt: " + error.message)
  }
  const renamePerson = async (id: string, name: string) => {
    // Optimistisch: het invoerveld moet meteen meebewegen, niet pas na de rondreis.
    setPeople((ps) => ps.map((x) => x.id === id ? { ...x, name } : x))
    const clean = isGuestDefault(name) ? "" : name.trim()
    const { error } = await supabase.from("party_people").update({ name: clean }).eq("id", id)
    if (error) setNotice("Naam opslaan mislukt: " + error.message)
  }
  const personHasDrinks = (pid: string) => rounds.some((r) => Object.values(r.orders).some((o) => (o?.[pid] ?? 0) > 0)) || Object.values(cart).some((o) => (o?.[pid] ?? 0) > 0)
  const removePerson = (id: string) => { const pp = people.find((x) => x.id === id); if (personHasDrinks(id)) { setNotice(L.personHasDrinks(pp?.name || L.thisPerson)); return } supabase.from("party_people").delete().eq("id", id).then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message) }) }
  const removeLastPerson = () => { const last = people[people.length - 1]; if (!last) return; removePerson(last.id) }

  // ── Laden & live houden ─────────────────────────────────────────────────────
  // Eén select per tabel, enkel de kolommen die we tonen. Zelfde aanpak als Table:
  // realtime doet het echte werk, met een afkoelperiode zodat een reeks tikken
  // (iedereen bestelt tegelijk) niet tientallen herladingen uitlokt.
  const loadParty = useCallback(async (gid: string) => {
    const [{ data: g }, { data: pp }, { data: rr }, { data: ii }, { data: pt }] = await Promise.all([
      supabase.from("party_groups").select("id,name,invite_code,owner_id,pay,coin_value,deposit_on,deposit_value,deposit_unit,pot_on,pot_is_card,finalized,custom_drinks,coin_prices").eq("id", gid).single(),
      supabase.from("party_people").select("id,seat,name,claimed_by,self_joined,settle_with").eq("group_id", gid).order("seat"),
      supabase.from("party_rounds").select("id,seq,status,amount,pot_part,payers,gave_back").eq("group_id", gid).order("seq"),
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
    }))

    // Het OPEN rondje is de mand; de rest is historiek.
    const open = alle.find((r) => r.status === "open") ?? null
    setOpenRoundId(open?.id ?? null)
    setCart(open?.orders ?? {})
    setCartAnon(open?.anon ?? {})
    // Bekerwerk dat al ingevuld was, blijft staan bij een refresh of op een tweede toestel.
    if (open && Object.keys(open.gaveBack).length > 0) setGaveBackDraft(open.gaveBack)
    const gedaan = alle.filter((r) => r.status !== "open")
    setRounds(gedaan)
    setRoundNr(open ? open.seq : Math.max(1, gedaan.length))

    setPotRounds((pt || []).map((r) => ({
      id: r.id as string, seq: r.seq as number,
      amounts: (r.amounts ?? {}) as Record<string, number>,
    })))
    const kaart = (pt || []).find((r) => r.is_card)
    if (kaart) setCardPayers(((kaart.card_payers ?? []) as string[]))
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
        const { data } = await supabase.from("party_groups").select("id").eq("id", vorige).maybeSingle()
        if (data) {
          setGroupId(data.id)
          await loadParty(data.id)
          setView("setup")
          setBooting(false)
          return
        }
        localStorage.removeItem("rundo_party_group") // groep opgeruimd of gewist
      }
      setBooting(false)
    })()
  }, [loadParty])

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
  const createGroup = async () => {
    if (!groupName.trim()) { setNotice(L.nameGroupFirst); return }
    if (busy) return
    setBusy(true)
    // Botsende codes zijn zeldzaam, maar niet onmogelijk (unique index vangt ze).
    for (let poging = 0; poging < 5; poging++) {
      const code = makeCode()
      const { data, error } = await supabase.from("party_groups")
        .insert([{ name: groupName.trim(), invite_code: code, owner_id: me.current }])
        .select("id,invite_code").single()
      if (!error && data) {
        localStorage.setItem("rundo_party_group", data.id)
        setGroupId(data.id)
        setInviteCode(data.invite_code)
        setOwnerDevice(me.current)
        setBusy(false)
        setView("setup")
        return
      }
      if (error && !/duplicate|unique/i.test(error.message)) {
        setNotice("Groep aanmaken mislukt: " + error.message); setBusy(false); return
      }
    }
    setNotice(L.createFailed)
    setBusy(false)
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
  const closePot = () => {
    const added = (editPotId === null && potDraftTotal > 0.001) ? potDraftTotal : 0
    if (added > 0 && groupId) {
      const seq = Math.max(0, ...potRounds.map((r) => r.seq)) + 1
      const bedragen = potDraft
      supabase.from("party_pot")
        .insert([{ group_id: groupId, seq, amounts: bedragen, is_card: potIsCard, card_payers: cardPayers }])
        .then(({ error }) => { if (error) setNotice("Inleg opslaan mislukt: " + error.message); else loadParty(groupId) })
    }
    setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setEditPotId(null); setPotBuilderOpen(false); setShowPot(false)
    if (onbPotActive) {
      setOnbPotActive(false)
      const willHave = potContribTotal + added
      if (potChosen && willHave <= 0.005) {
        setConfirmDlg({ msg: `Je koos voor een ${potIsCard ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch zonder verder gaan? Je kan later nog toevoegen via de knop bovenaan.`, yes: L.anywayWithout(potIsCard), onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("settings") }, onNo: () => { setConfirmDlg(null); setShowPot(true); setOnbPotActive(true) } })
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
  const catsPresent = CATS.filter((c) => drinks.some((d) => d.cat === c))
  const bump1 = (did: string) => bumpAnon(did, 1)
  const bumpDown = (did: string) => { if ((cartAnon[did] ?? 0) > 0) { bumpAnon(did, -1); return } const entry = cart[did]; if (!entry) return; const pid = Object.keys(entry).find((k) => (entry[k] ?? 0) > 0); if (pid) bump(did, pid, -1) }
  const firstUnassigned = () => drinks.find((d) => (cartAnon[d.id] ?? 0) > 0)

  const dropUnpaidRound = () => {
    const last = rounds[rounds.length - 1]
    if (last && !roundIsPaid(last)) supabase.from("party_rounds").delete().eq("id", last.id).then(() => { if (groupId) loadParty(groupId) })
    if (openRoundId) supabase.from("party_rounds").delete().eq("id", openRoundId).then(() => { if (groupId) loadParty(groupId) })
    setOpenRoundId(null)
    setRounds((rs) => (rs.length && !roundIsPaid(rs[rs.length - 1]) ? rs.slice(0, -1) : rs)); setCart({}); setCartAnon({}); setAmountDraft(""); setPayPot(false); setPayPersons([]); setPayAmts({}); setPotAmtDraft(""); setPaidConfirmed(false) }
  const goStart = () => { if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); setView("start") } }); else setView("start") }
  const goHome = () => { setFromOnboarding(false); if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); setView("settings") } }); else setView("settings") }
  const potAvailNow = () => { const curPotPart = rounds.length ? (rounds[rounds.length - 1].potPart || 0) : 0; return potContribTotal - (potSpent - curPotPart) }
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
    else if (potOver) { valid = false; reason = `De ${potIsCard ? "drankkaart" : "pot"} heeft maar ${euro(Math.max(0, potAvail))} — verlaag het bedrag of leg bij.` }
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
      pot_on: potChosen, pot_is_card: potIsCard, ...(extra ?? {}),
    }).eq("id", groupId).then(({ error }) => { if (error) setNotice("Instellingen opslaan mislukt: " + error.message) })
  }

  // Delen kan pas als de groep vaststaat: naam, aantal personen én de startvragen.
  // Zo kan er niemand ongevraagd bijkomen en blijft de groep even groot als de admin
  // aangaf — gasten claimen enkel een vrije plaats, ze maken er geen bij.
  const canShare = isAdmin && !!inviteCode && people.length > 0 && onboardedOnce
  const renderShare = () => {
    if (!canShare) return null
    const vrij = people.filter((p) => !p.claimedBy).length
    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.45)" }}>
        <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.letGuestsScan}</h3>
        <div style={{ fontSize: 12, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>
          {vrij > 0 ? L.freeSeats(vrij) : L.allTakenAdmin}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "#fff", padding: 10, borderRadius: 14, border: "1px solid rgba(120,95,20,0.15)" }}>
            <QRCodeSVG value={inviteLink} size={132} bgColor="#ffffff" fgColor="#4a3f1e" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.18em", color: "#4a3f1e", marginTop: 10 }}>{inviteCode}</div>
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

    const coins = pay === "coin"
      ? (parseFloat((ndCoins || "").replace(",", ".")) || coinDefault(ndCat, naam))
      : coinDefault(ndCat, naam)

    const { error } = await supabase.rpc("party_add_drink", {
      p_group: groupId, p_key: sleutel, p_name: naam, p_cat: ndCat,
      p_price: prijs, p_coins: coins, p_cup: CUPCAT[ndCat], p_by: me.current,
      p_max_person: MAX_EIGEN_PERSOON, p_max_group: MAX_EIGEN_GROEP,
    })
    if (error) {
      if (/PERSOON_VOL/.test(error.message)) setNotice(L.maxPerPerson(MAX_EIGEN_PERSOON))
      else if (/GROEP_VOL/.test(error.message)) setNotice(L.maxPerGroup(MAX_EIGEN_GROEP))
      else setNotice("Toevoegen mislukt: " + error.message)
      return
    }
    setNdName(""); setNdPrice(""); setNdCoins(""); setShowAddDrink(false)
    setActiveCat(ndCat); setDrinkSearch("")
    setNotice(L.drinkAdded(naam))
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
            <button onClick={() => setShowAddDrink(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#8a7d55" }}>✕</button>
          </div>

          <div style={{ fontSize: 12, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>
            {L.ownDrinkIntro}
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>{L.nameLabel}</div>
          <input value={ndName} onChange={(e) => setNdName(e.target.value)} placeholder={L.namePh}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 15, textAlign: "left", marginBottom: 12 }} />

          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>{L.categoryLabel}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {CATS.map((c) => (
              <span key={c} style={S.tab(ndCat === c)} onClick={() => setNdCat(c)}>{CAT_LABEL[c]}</span>
            ))}
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>{L.priceLabel}</div>
          <div style={{ fontSize: 11, color: "#8a7d55", marginBottom: 6, lineHeight: 1.4 }}>
            {L.priceHint}
          </div>
          <input value={ndPrice} onChange={(e) => setNdPrice(e.target.value)} inputMode="decimal" placeholder="4,50"
            style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 15, marginBottom: 12 }} />

          {pay === "coin" && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>Coins <span style={{ fontWeight: 600, color: "#8a7d55" }}>{L.coinsAuto}</span></div>
              <input value={ndCoins} onChange={(e) => setNdCoins(e.target.value)} inputMode="decimal" placeholder={String(coinDefault(ndCat, ndName || "x"))}
                style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 15, marginBottom: 12 }} />
            </>
          )}

          <button style={{ ...S.btnP, width: "100%", opacity: ndName.trim() && ndPrice ? 1 : 0.5 }} onClick={addCustomDrink}>
            {L.addBtn}
          </button>
          <div style={{ fontSize: 11, color: "#8a7d55", textAlign: "center", marginTop: 8 }}>
            {L.remaining(Math.max(0, MAX_EIGEN_PERSOON - eigenVanMij), MAX_EIGEN_PERSOON)}
          </div>

          {mijne.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(120,95,20,0.12)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>{L.addedByYou}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {mijne.map((c) => (
                  <button key={c.key} onClick={() => removeCustomDrink(c.key, c.name)}
                    style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(120,95,20,0.2)" }}>
                    ⭐ {c.name} ✕
                  </button>
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
            {!voiceOn && <button onClick={() => setVoiceOpen(false)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#8a7d55" }}>✕</button>}
          </div>

          {voiceOn ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎤</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#c98a00" }}>{L.voiceListening}</div>
              <div style={{ fontSize: 12, color: "#8a7d55", marginTop: 8 }}>{L.voiceSay}</div>
            </div>
          ) : (
            <>
              {voiceText && (
                <div style={{ background: "#faf7ec", border: "1px solid rgba(120,95,20,0.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#8a7d55", marginBottom: 3 }}>{L.voiceHeard}</div>
                  <div style={{ fontSize: 14, fontStyle: "italic", color: "#6b5f3a" }}>&ldquo;{voiceText}&rdquo;</div>
                </div>
              )}

              {voiceHits.length === 0 ? (
                <div style={{ fontSize: 13, color: "#b3a988", textAlign: "center", padding: "10px 0 16px", lineHeight: 1.5 }}>
                  {L.voiceNothing}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {voiceHits.map((h) => (
                    <span key={h.id} style={{ ...S.pill, background: "rgba(31,138,76,0.1)", border: "1px solid rgba(31,138,76,0.3)", color: "#1f6b3a", fontSize: 13, padding: "5px 10px" }}>
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

  const applyBeginChoices = () => {
    if (bpPotType === "yes") { setNotice("Kies pot of drankkaart — of zet de pot op nee."); return }
    setOnboardedOnce(true)
    const potOn = bpPotType === "pot" || bpPotType === "card"
    // Meteen wegschrijven met de zopas gekozen waarden (de state hieronder is nog niet
    // doorgekomen, dus we geven ze expliciet mee).
    persistSettings({
      pay: bpCoins ? "coin" : "eur",
      deposit_on: bpBekers,
      deposit_unit: bpCoins ? "coin" : "eur",
      pot_on: potOn,
      pot_is_card: bpPotType === "card",
    })
    setPotIsCard(bpPotType === "card")
    setPotChosen(potOn)
    setDepositOn(bpBekers)
    setPay(bpCoins ? "coin" : "eur")
    setDepositUnit(bpCoins ? "coin" : "eur")
    setBeginPrompt(false)
    if (!potOn && !bpBekers && !bpCoins) { setView("hub"); return }
    setFromOnboarding(true)
    if (potOn) { setShowPot(true); setOnbPotActive(true) }
    else setView("settings")
  }
  const tryBegin = () => {
    if (people.length === 0) { setNotice(L.addPersonFirst); return }
    if (depositOn && (depositValue || 0) <= 0) { setNotice(L.fillDeposit); return }
    if (pay === "coin" && (coinValue || 0) <= 0) { setNotice(L.fillCoinValue); return }
    if (potChosen && potContribTotal <= 0.005) { setConfirmDlg({ msg: `Je koos voor een ${potIsCard ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch zonder verder gaan? Je kan later nog toevoegen via de knop bovenaan.`, yes: L.anywayWithout(potIsCard), onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("hub") } }); return }
    setView("hub")
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
  const openClose = () => { setAmountDraft(""); setShowClose(true) }
  const goAssignFromWarning = () => { setShowClose(false); setShowAssignAll(true) }
  const commitRound = () => {
    const effGb: Record<string, number> = {}
    people.forEach((p) => { effGb[p.id] = gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id)) })
    if (openRoundId) {
      supabase.from("party_rounds").update({ status: "pending", gave_back: effGb }).eq("id", openRoundId)
        .then(({ error }) => { if (error) setNotice("Rondje bevestigen mislukt: " + error.message); else if (groupId) loadParty(groupId) })
      setOpenRoundId(null)
    }
    setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setAmountDraft(""); setPayPot(false); setPayPersons([]); setPayAmts({}); setPotAmtDraft(""); setPaidConfirmed(false); setView("confirmed")
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
      if (rounds.length > 0) { setRoundNr(rounds.length); setOpenRound(rounds.length - 1); setView("hub") }
      else { setRoundNr(1); setView("hub") }
    },
  })
  const cancelRound = () => setConfirmDlg({ msg: `Het volledige rondje ${roundNr} annuleren? Alle drankjes en bekers van dit rondje worden verwijderd. Dit kan niet ongedaan gemaakt worden.`, yes: L.yesCancel, onYes: () => { const remaining = rounds.length - 1; setRounds((rs) => rs.slice(0, -1)); setPaidConfirmed(false); setConfirmDlg(null); if (remaining > 0) { setOpenRound(remaining - 1); setView("hub") } else setView("order") } })
  const nextRound = () => { if (blockIfUnpaid()) return; setRoundNr((n) => n + 1); setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setCart({}); setCartAnon({}); setRepeated(false); setView("order") }
  // Neemt de drankjes én de toewijzing van het laatste rondje over. Daarna nog gewoon aanpasbaar.
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
  const personRoundShare = (r: Round, pid: string) => {
    const kt = roundKeyTotal(r); if (kt <= 0 || r.amount <= 0) return people.length ? r.amount / people.length : 0
    const own = drinks.reduce((a, d) => a + (r.orders[d.id]?.[pid] ?? 0) * priceOf(d), 0)
    const anon = drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0) * priceOf(d), 0)
    return ((own + anon / people.length) / kt) * r.amount
  }
  const consumption = (pid: string) => rounds.reduce((s, r) => s + personRoundShare(r, pid), 0)
  const grandTotal = useMemo(() => rounds.reduce((s, r) => s + r.amount, 0), [rounds])
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
        <div style={{ fontSize: 12, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>
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
          <div style={{ fontSize: 12, color: "#c98a00", fontWeight: 700, marginTop: 10 }}>
            {L.tapWhoWith(settleGroups.find((g) => g.key === settlePick)?.label ?? "")}
          </div>
        )}
        {settleGroups.some((g) => g.samen) && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(120,95,20,0.1)" }}>
            <div style={{ fontSize: 11.5, color: "#8a7d55", marginBottom: 7 }}>{L.separateAgain}</div>
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
    h1: { fontSize: 22, fontWeight: 800, margin: "0 0 2px" } as React.CSSProperties,
    h3: { fontSize: 16.5, fontWeight: 800, margin: "0 0 10px" } as React.CSSProperties,
    sub: { fontSize: 13.5, color: "#8a7d55", margin: "0 0 12px", lineHeight: 1.55 } as React.CSSProperties,
    btn: { border: "1px solid rgba(120,95,20,0.18)", background: "#fff", color: "#4a3f1e", borderRadius: 12, padding: "12px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
    btnP: { border: "none", background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", borderRadius: 14, padding: "16px 18px", fontSize: 17, fontWeight: 800, cursor: "pointer", width: "100%", boxShadow: "0 4px 12px -4px rgba(224,138,0,0.6)" } as React.CSSProperties,
    input: { border: "1px solid rgba(120,95,20,0.22)", borderRadius: 10, padding: "11px 12px", fontSize: 16, color: "#4a3f1e", outline: "none", width: 84, textAlign: "right" } as React.CSSProperties,
    seg: (on: boolean) => ({ flex: 1, textAlign: "center", padding: "11px 6px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#f3ead2", color: on ? "#fff" : "#8a7d55" } as React.CSSProperties),
    step: { width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(120,95,20,0.18)", background: "#f3ead2", color: "#8a5e0f", fontSize: 21, fontWeight: 800, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
    chip: (n: number) => ({ position: "relative", padding: "10px 14px", borderRadius: 20, fontSize: 14.5, fontWeight: 700, cursor: "pointer", userSelect: "none", border: n > 0 ? "1px solid rgba(240,165,0,0.5)" : "1px solid rgba(120,95,20,0.15)", background: n > 0 ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#faf4e4", color: n > 0 ? "#fff" : "#8a7d55" } as React.CSSProperties),
    badge: { marginLeft: 5, background: "rgba(0,0,0,0.22)", borderRadius: 20, padding: "0 6px", fontSize: 11, fontWeight: 800 } as React.CSSProperties,
    pill: { fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: "rgba(120,95,20,0.08)", color: "#8a7d55" } as React.CSSProperties,
    row: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
    tab: (on: boolean) => ({ padding: "9px 14px", borderRadius: 20, fontSize: 13.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", background: on ? "#4a3f1e" : "#f3ead2", color: on ? "#fff" : "#8a7d55" } as React.CSSProperties),
    overlay: { position: "fixed", inset: 0, background: "rgba(40,30,5,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 14 } as React.CSSProperties,
    sheet: { background: "#fff", borderRadius: 20, padding: 20, width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" } as React.CSSProperties,
  }
  const potTag = (
    <span onClick={() => setShowPot(true)} style={{ ...S.pill, cursor: "pointer", padding: "5px 11px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(120,95,20,0.08)", color: potRemaining > 0 ? "#1f8a4c" : "#8a7d55" }}>{potContribTotal > 0 && potRemaining <= 0.005 && <span style={{ color: "#c0554a" }}>⚠️ </span>}{potIsCard ? "💳 drankkaart " : "🫙 pot "}{euro(potRemaining)}<span style={{ color: "#c98a00", fontWeight: 800 }}>+ toevoegen</span></span>
  )
  const renderPotModal = () => (
    <div style={{ ...S.overlay, zIndex: 60 }} onClick={closePot}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ ...S.h3, fontSize: 18, margin: "0 0 8px" }}>{potIsCard ? "💳 Drankkaart" : "🫙 Pot"}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ ...S.pill, background: "rgba(120,95,20,0.08)", color: "#8a5e0f", fontSize: 12, padding: "4px 10px" }}>ingelegd {euro(potContribTotal)}</span>
          {potSpent > 0 && <span style={{ ...S.pill, background: "rgba(224,138,0,0.12)", color: "#c98a00", fontSize: 12, padding: "4px 10px" }}>besteed {euro(potSpent)}</span>}
          <span style={{ ...S.pill, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(224,104,92,0.14)", color: potRemaining > 0 ? "#1f8a4c" : "#c0554a", fontSize: 12, padding: "4px 10px", fontWeight: 800 }}>nog {euro(potRemaining)}</span>
        </div>
        <div style={{ ...S.row, gap: 6, marginBottom: 8 }}>
          <div onClick={() => setPotIsCard(false)} style={{ ...S.seg(!potIsCard), padding: "7px 6px", fontSize: 12.5, opacity: !potIsCard ? 1 : 0.5 }}>{L.potMoney}</div>
          <div onClick={() => setPotIsCard(true)} style={{ ...S.seg(potIsCard), padding: "7px 6px", fontSize: 12.5, opacity: potIsCard ? 1 : 0.5 }}>{L.drinkCard}</div>
        </div>
        <div style={{ fontSize: 11.5, color: "#8a7d55", marginBottom: 12, lineHeight: 1.5 }}>{potIsCard ? "💳 Drankkaart van de groep — leg de kaartwaarde (bv. €15) in. Wat niet opgedronken wordt, is verloren en wordt gelijk over iedereen verdeeld." : "🫙 Echt geld — wat niet opgaat, krijgen de inleggers terug bij de afrekening."}</div>

        {potRounds.map((r, i) => {
          const tot = Object.values(r.amounts).reduce((a, b) => a + (b || 0), 0)
          const who = people.filter((pp) => (r.amounts[pp.id] || 0) > 0)
          return (
            <div key={r.id} style={{ background: editPotId === r.id ? "rgba(240,165,0,0.18)" : "#faf4e4", borderRadius: 12, padding: "9px 11px", marginBottom: 8, border: editPotId === r.id ? "1px solid rgba(240,165,0,0.6)" : "1px solid transparent" }}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{i + 1}e inleg <span style={{ fontSize: 12, fontWeight: 700, color: "#1f8a4c" }}>· {euro(tot)}</span></span>
                {editPotId === r.id ? (
                  <span style={{ fontSize: 12, color: "#c98a00", fontWeight: 800 }}>{L.beingEdited}</span>
                ) : rounds.length === 0 ? (
                  <div style={{ ...S.row, gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#8a5e0f", cursor: "pointer", fontWeight: 700 }} onClick={() => editPotRound(r.id)}>{L.edit}</span>
                    <span style={{ fontSize: 12, color: "#c0554a", cursor: "pointer", fontWeight: 700 }} onClick={() => removePotRound(r.id, `${i + 1}e inleg`)}>{L.remove}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "#b3a988" }}>🔒 vast</span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: "#6b5f3a" }}>{who.map((pp) => `${pp.name} ${euro(r.amounts[pp.id] || 0)}`).join(" · ")}</div>
            </div>
          )
        })}

        {(potRounds.length === 0 || potBuilderOpen || editPotId !== null) ? (
        <>
        {potIsCard ? (
        <div style={{ background: "rgba(240,165,0,0.08)", border: "1px dashed rgba(240,165,0,0.5)", borderRadius: 12, padding: 11, marginTop: 4 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#8a5e0f" }}>{editPotId !== null ? "✏️ kaart wijzigen" : "➕ Drankkaart inleggen"}</span>
            {potDraftTotal > 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1f8a4c" }}>+{euro(potDraftTotal)}</span>}
          </div>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{L.cardValue}</span>
            <div style={{ ...S.row, gap: 4 }}><span style={{ fontSize: 13, color: "#8a7d55", fontWeight: 700 }}>€</span><input style={{ ...S.input, width: 70 }} type="text" inputMode="decimal" placeholder="15" value={cardValue} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setCardValue(v); applyCard(cardPayers, v) }} /></div>
          </div>
          <div style={{ fontSize: 12, color: "#8a7d55", fontWeight: 700, marginBottom: 6 }}>{L.whoBoughtCard}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            <span onClick={cardSelectAll} style={{ ...S.pill, cursor: "pointer", fontSize: 12.5, padding: "6px 12px", background: "rgba(31,138,76,0.14)", color: "#1f8a4c", fontWeight: 800, border: "1px dashed rgba(31,138,76,0.5)" }}>{L.everyone}</span>
            {people.map((p) => { const on = cardPayers.includes(p.id); const amt = potDraft[p.id] || 0; return <span key={p.id} onClick={() => toggleCardPayer(p.id)} style={{ ...S.pill, cursor: "pointer", fontSize: 12.5, padding: "6px 12px", background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "rgba(240,165,0,0.1)", color: on ? "#fff" : "#8a5e0f", fontWeight: 700 }}>{p.name} {on ? euro(amt) : "€0"}</span> })}
          </div>
        </div>
        ) : (
        <div style={{ background: "rgba(240,165,0,0.08)", border: "1px dashed rgba(240,165,0,0.5)", borderRadius: 12, padding: 11, marginTop: 4 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#8a5e0f" }}>{editPotId !== null ? "✏️ inleg wijzigen" : `➕ ${potRounds.length === 0 ? "1e inleg" : `${potRounds.length + 1}e inleg`}`}</span>
            {potDraftTotal > 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1f8a4c" }}>+{euro(potDraftTotal)}</span>}
          </div>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "#8a7d55", fontWeight: 700 }}>{L.equalSplit}</span>
            <span style={{ fontSize: 11.5, color: "#c0554a", fontWeight: 700, cursor: "pointer" }} onClick={resetPotDraft}>{L.resetContrib}</span>
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {[5, 10, 20, 30].map((v) => {
              const on = everyoneChoice === v
              return <button key={v} style={{ ...S.btn, padding: "5px 12px", fontSize: 13, background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: on ? "#fff" : "#4a3f1e", border: on ? "none" : "1px solid rgba(120,95,20,0.18)" }} onClick={() => { setEveryoneChoice(v); setEveryoneDraft(""); setEveryoneAmt(v) }}>€{v}</button>
            })}
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#8a7d55" }}>{L.ownAmount}</span>
            <input style={{ ...S.input, width: 62, padding: "5px 8px", fontSize: 12, borderColor: everyoneChoice === "custom" ? "#e08a00" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" placeholder="€" value={everyoneDraft} onChange={(e) => setEveryoneDraft(e.target.value.replace(/[^0-9.,]/g, ""))} />
            <button style={{ ...S.btn, padding: "5px 11px", fontSize: 12, opacity: (parseFloat(everyoneDraft.replace(",", ".")) || 0) > 0 ? 1 : 0.5 }} onClick={() => { const v = parseFloat(everyoneDraft.replace(",", ".")) || 0; if (v > 0) { setEveryoneChoice("custom"); setEveryoneAmt(v) } }}>toepassen</button>
          </div>
          {people.map((p) => (
            <div key={p.id} style={{ ...S.row, gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
              <span style={{ fontSize: 14, fontWeight: 800, width: 112, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{contribOf(p.id) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#8a7d55" }}> · {euro(contribOf(p.id))}</span>}</span>
              <input style={{ ...S.input, width: 58, padding: "5px 8px", fontSize: 12.5, flexShrink: 0 }} type="text" inputMode="decimal" placeholder="€" value={potDraft[p.id] ?? ""} onChange={(e) => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: parseFloat(e.target.value.replace(",", ".")) || 0 })) }} />
              <button style={{ ...S.btn, padding: "5px 9px", fontSize: 12, color: "#c0554a", flexShrink: 0 }} onClick={() => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: 0 })) }}>↺</button>
              <span style={{ fontSize: 13, fontWeight: 800, marginLeft: "auto", textAlign: "right", color: (potDraft[p.id] || 0) > 0 ? "#1f8a4c" : "#b3a988" }}>{(potDraft[p.id] || 0) > 0 ? "+" + euro(potDraft[p.id] || 0) : "+€0"}</span>
            </div>
          ))}
        </div>
        )}
        {editPotId !== null ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={cancelEditPot}>✕ annuleer</button>
            <button style={{ ...S.btnP, flex: 2 }} onClick={saveEditPot}>{potDraftTotal > 0 ? `✓ Wijziging opslaan (${euro(potDraftTotal)})` : "✓ Inleg verwijderen (leeg)"}</button>
          </div>
        ) : (
          <button style={{ ...S.btnP, marginTop: 14 }} onClick={closePot}>{potDraftTotal > 0 ? L.addContrib(euro(potDraftTotal)) : "Klaar"}</button>
        )}
        </>
        ) : (
          <div>
            <button style={{ ...S.btnP, marginTop: 4 }} onClick={() => setPotBuilderOpen(true)}>{L.addPotContrib}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={closePot}>{L.ready}</button>
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
            <h3 style={{ ...S.h3, fontSize: 17 }}>{L.confirmTitle}</h3>
            <p style={{ fontSize: 13.5, color: "#4a3f1e", lineHeight: 1.55, marginBottom: 16, whiteSpace: "pre-line" }}>{confirmDlg.msg}</p>
            {confirmDlg.variant === "danger" ? (
              <>
                <button style={{ ...S.btnP, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)", boxShadow: "none" }} onClick={() => setConfirmDlg(null)}>{L.backFinish}</button>
                <button style={{ background: "none", border: "none", width: "100%", marginTop: 10, fontSize: 12.5, color: "#c0554a", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
              </>
            ) : (
              <>
                {confirmDlg.no ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.btn, flex: 1, fontSize: 12.5, padding: "11px 4px" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
                    <button style={{ ...S.btnP, flex: 1, fontSize: 13, padding: "11px 4px" }} onClick={() => { const f = confirmDlg?.onNo; setConfirmDlg(null); f && f() }}>{confirmDlg.no}</button>
                  </div>
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
            <p style={{ fontSize: 15, color: "#4a3f1e", lineHeight: 1.55, marginBottom: 18, fontWeight: 600 }}>{notice}</p>
            <button style={S.btnP} onClick={() => setNotice("")}>OK</button>
          </div>
        </div>
      )}
    </>
  )
  const Header = () => {
    const onboarding = view === "setup" || view === "settings"
    return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ ...S.row, gap: 10, minWidth: 0 }}>
          <div onClick={goStart} style={{ cursor: "pointer" }}><RundoLogo size={40} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...S.h1, fontSize: 20, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Rundo <span style={{ color: "#e08a00" }}>Party</span></div>
            <div style={{ ...S.row, gap: 5, marginTop: 2 }}><CheersIcon size={16} color="#4a3f1e" /><span style={{ fontSize: 11.5, color: "#4a3f1e", fontWeight: 700 }}>{L.tagline}</span></div>
          </div>
        </div>
        {!onboarding && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 0, flexShrink: 0 }}>
            {groupName.trim() && <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a5e0f", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName.trim()} <span style={{ color: "#8a7d55", fontWeight: 700 }}>· 👥 {people.length}</span></div>}
          </div>
        )}
      </div>
      {!onboarding && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={{ ...S.btn, flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 700 }} onClick={goHome}>{L.groupSettings}</button>
          <button style={{ ...S.btn, flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 700, opacity: view === "hub" ? 0.55 : 1 }} onClick={goHub}>{L.overview}</button>
          <button style={{ ...S.btn, flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 700, opacity: view === "final" ? 0.55 : 1 }} onClick={goFinal}>{L.settleBtn}</button>
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
        <div style={{ fontSize: 14, color: "#8a7d55" }}>{L.loading}</div>
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
          <div style={{ fontSize: 14, color: "#8a7d55", marginTop: 10 }}>{L.invitedFor} <b style={{ color: "#4a3f1e" }}>{groupName}</b></div>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0 }}>{L.whoAreYou}</h3>

          {vrij.length === 0 ? (
            <div style={{ fontSize: 13, color: "#b3a988", textAlign: "center", padding: "16px 0", lineHeight: 1.5 }}>
              {L.allSeatsTaken}
            </div>
          ) : (
            <>
              {metNaam.length > 0 && (
                <>
                  <div style={{ fontSize: 12.5, color: "#8a7d55", marginBottom: 10, lineHeight: 1.5 }}>{L.tapYourName}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: leeg.length ? 16 : 0 }}>
                    {metNaam.map((p) => (
                      <button key={p.id} disabled={busy} onClick={() => claimSeat(p.id, p.name)}
                        style={{ ...S.btn, padding: "13px 8px", fontWeight: 800, fontSize: 14, opacity: busy ? 0.5 : 1 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {leeg.length > 0 && (
                <>
                  <div style={{ fontSize: 12.5, color: "#8a7d55", marginBottom: 8, lineHeight: 1.5 }}>
                    {metNaam.length > 0 ? L.notThere : L.fillNameSeat}
                  </div>
                  <input id="guest-name" style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 16, marginBottom: 10 }}
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
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{L.alreadyJoined}</div>
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
    const lijst = zoekt
      ? drinks.filter((d) => drinkMatches(d.name, drinkSearch))
      : drinks.filter((d) => d.cat === activeCat).filter((d) => fullList || d.fav || aQty(d.id, meId) > 0)
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
            <div style={{ fontSize: 18, fontWeight: 800 }}>🍻 {groupName}</div>
            <div style={{ fontSize: 12, color: "#8a7d55" }}>
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
            style={{ ...S.btn, flex: 1, padding: "9px 4px", fontSize: 12.5, fontWeight: 800, opacity: guestTab === "order" ? 1 : 0.55 }}>{L.tabOrder}</button>
          <button onClick={() => setGuestTab("me")}
            style={{ ...S.btn, flex: 1, padding: "9px 4px", fontSize: 12.5, fontWeight: 800, opacity: guestTab === "me" ? 1 : 0.55 }}>{L.tabMe}</button>
        </div>

        {guestTab === "me" && (
          <>
            <div style={S.card}>
              <h3 style={{ ...S.h3, marginTop: 0 }}>{L.myTab}</h3>
              {rounds.length === 0 ? (
                <div style={{ fontSize: 13, color: "#b3a988", textAlign: "center", padding: "14px 0" }}>
                  {L.noRoundClosed}
                </div>
              ) : (
                <>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ fontSize: 13.5 }}>{L.whatYouDrank} <span style={{ fontSize: 11, color: "#8a7d55" }}>{L.yourShare}</span></span>
                    <b style={{ fontSize: 14.5 }}>{euro(mijnVerbruik)}</b>
                  </div>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(120,95,20,0.1)" }}>
                    <span style={{ fontSize: 13.5 }}>{L.whatYouPaid} {contribOf(meId) > 0 ? <span style={{ fontSize: 11, color: "#8a7d55" }}>{L.inclPot}</span> : null}</span>
                    <b style={{ fontSize: 14.5 }}>{euro(mijnBetaald)}</b>
                  </div>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "11px 0 2px" }}>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>
                      {Math.abs(mijnSaldo) < 0.005 ? L.youAreEven : mijnSaldo > 0 ? L.youGetBack : L.youStillPay}
                    </span>
                    <b style={{ fontSize: 19, color: Math.abs(mijnSaldo) < 0.005 ? "#1f8a4c" : mijnSaldo > 0 ? "#1f8a4c" : "#c0392b" }}>
                      {euro(Math.abs(mijnSaldo))}
                    </b>
                  </div>
                  {mijnGroep?.samen && (
                    <div style={{ fontSize: 11.5, color: "#c98a00", fontWeight: 700, marginTop: 8 }}>
                      {L.settlesWith(mijnGroep.leden.filter((p) => p.id !== meId).map((p) => p.name).join(" & "))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 10, lineHeight: 1.5 }}>
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
                    <span style={{ fontSize: 14 }}><b>{t.from}</b> → {t.to}</span>
                    <b style={{ fontSize: 15 }}>{euro(t.amount)}</b>
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
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{L.roundN(r.seq)}</span>
                        <span style={{ fontSize: 11.5, color: "#8a7d55" }}>{paidLabel(r)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: mijne.length ? "#6b5f3a" : "#b3a988", marginTop: 3 }}>
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
        {/* Wat je al aantikte in dit rondje. Bovenaan, want dat is wat je wil zien. */}
        <div style={{ ...S.card, background: mijnAantal > 0 ? "rgba(31,138,76,0.06)" : "#fff" }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: mijnAantal > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>
              {bezig ? L.roundWhatYouWant(roundNr) : L.noRoundYet}
            </span>
            {mijnAantal > 0 && <span style={{ ...S.pill, background: "#1f8a4c", color: "#fff" }}>{mijnAantal}</span>}
          </div>
          {mijnAantal === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8a7d55", lineHeight: 1.5, marginTop: 6 }}>
              {L.tapBelow}
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mijn.map((d) => (
                <button key={d.id} onClick={() => bump(d.id, meId, -1)}
                  style={{ ...S.pill, cursor: "pointer", background: "#fff", border: "1px solid rgba(31,138,76,0.35)", color: "#1f6b3a", fontSize: 12 }}>
                  {aQty(d.id, meId)}× {d.name} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: "relative", marginBottom: 9 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔍</span>
          <input value={drinkSearch} onChange={(e) => setDrinkSearch(e.target.value)} placeholder={L.searchDrink}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 36, paddingRight: drinkSearch ? 34 : 12, fontSize: 15, textAlign: "left" }} />
          {drinkSearch && (
            <button onClick={() => setDrinkSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 15, color: "#8a7d55", padding: 4 }}>✕</button>
          )}
        </div>

        <div style={{ display: zoekt ? "none" : "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
          {catsPresent.map((c) => (
            <span key={c} style={S.tab(activeCat === c)} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}</span>
          ))}
        </div>

        {!zoekt && (
          <div style={{ fontSize: 11.5, textAlign: "right", marginBottom: 6 }}>
            <span onClick={() => setFullList((v) => !v)} style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }}>
              {fullList ? L.shortList : L.fullListBtn}
            </span>
          </div>
        )}

        {lijst.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", color: "#b3a988", fontSize: 13, padding: "20px 0" }}>
            {L.nothingFound}
          </div>
        ) : (
          <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12 }}>
            {lijst.map((d) => {
              const n = aQty(d.id, meId)
              return (
                <div key={d.id} style={{ padding: "10px", borderRadius: 12, background: n > 0 ? "rgba(31,138,76,0.08)" : "#faf7ec", border: n > 0 ? "1px solid rgba(31,138,76,0.3)" : "1px solid rgba(120,95,20,0.1)" }}>
                  <div style={{ fontSize: 13.5, fontWeight: n > 0 ? 800 : 600, color: n > 0 ? "#1f6b3a" : "#6b5f3a", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                  <div style={{ ...S.row, justifyContent: "space-between", marginTop: 7 }}>
                    <button style={{ ...S.step, opacity: n > 0 ? 1 : 0.4 }} onClick={() => n > 0 && bump(d.id, meId, -1)}>−</button>
                    <span style={{ fontSize: 17, fontWeight: 800, color: n > 0 ? "#1f8a4c" : "#b3a988" }}>{n}</span>
                    <button style={S.step} onClick={() => bump(d.id, meId, 1)}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "2px 0 14px" }}>
          <button onClick={startVoice}
            style={{ ...S.btn, fontSize: 12.5, fontWeight: 800, padding: "9px 14px", border: "1px dashed rgba(240,165,0,0.6)", background: "#fffdf6", color: "#c98a00" }}>
            {L.voiceBtn} <span style={{ fontSize: 9, opacity: 0.75 }}>{L.voiceBeta}</span>
          </button>
          <button onClick={() => { setShowAddDrink(true); setNdName(drinkSearch.trim()) }}
            style={{ ...S.btn, fontSize: 12.5, fontWeight: 800, padding: "9px 14px", border: "1px dashed rgba(240,165,0,0.6)", background: "#fffdf6", color: "#c98a00" }}>
            {L.addOwnDrink}
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: "#8a7d55", textAlign: "center", padding: "6px 0 20px", lineHeight: 1.5 }}>
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 34 }}>
          <div style={{ ...S.row, gap: 13 }}>
            <RundoLogo size={64} />
            <div style={{ ...S.h1, fontSize: 34, letterSpacing: "-0.02em" }}>Rundo <span style={{ color: "#e08a00" }}>Party</span></div>
          </div>
          <div style={{ ...S.row, gap: 8, marginTop: 12 }}><CheersIcon size={22} color="#4a3f1e" /><span style={{ fontSize: 15, color: "#4a3f1e", fontWeight: 700 }}>{L.tagline}</span></div>
        </div>
        <div style={{ ...S.card, padding: "20px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 11 }}>{L.groupNameLabel}</div>
          <input style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontSize: 16, fontWeight: 700, marginBottom: 18, background: "#fdfaf2", padding: "15px 14px", borderRadius: 12 }} type="text" placeholder={L.groupNamePh} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <button style={{ ...S.btnP, width: "100%", opacity: groupName.trim() ? 1 : 0.5 }} onClick={createGroup}>{busy ? L.starting : L.startBtn}</button>
        </div>
        <div style={{ ...S.card, opacity: 0.6 }}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{L.savedGroups}</span>
            <span style={{ fontSize: 11.5, color: "#8a7d55" }}>{L.savedLater}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", marginTop: 8, lineHeight: 1.5 }}>{L.savedNote}<br /><span style={{ fontSize: 10.5, color: "#b3a988" }}>📌 Live-reminder: groepen automatisch opruimen na inactiviteit, tenzij vastgezet (📌) om te bewaren.</span></div>
        </div>
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
              <h3 style={{ ...S.h3, fontSize: 18, marginTop: 0, marginBottom: 4 }}>{L.beforeWeStart}</h3>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#4a3f1e", marginBottom: 14 }}>{L.workWith}</p>
              <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                <div style={{ ...S.row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>{L.sharedPot}</span>
                  <div style={{ ...S.row, gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: bpPotType !== "none" ? "#1f8a4c" : "#b3a988" }}>{bpPotType !== "none" ? "ja" : "nee"}</span>
                    <div onClick={() => setBpPotType((t) => t === "none" ? "yes" : "none")} style={{ width: 46, height: 27, borderRadius: 20, background: bpPotType !== "none" ? "linear-gradient(135deg,#2fae6a,#1f8a4c)" : "#d9cdb0", position: "relative", cursor: "pointer", transition: "background .15s" }}>
                      <div style={{ width: 21, height: 21, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: bpPotType !== "none" ? 22 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                    </div>
                  </div>
                </div>
                {bpPotType !== "none" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <div onClick={() => setBpPotType("pot")} style={{ ...S.seg(bpPotType === "pot"), padding: "8px 4px", fontSize: 12.5 }}>🫙 pot</div>
                    <div onClick={() => setBpPotType("card")} style={{ ...S.seg(bpPotType === "card"), padding: "8px 4px", fontSize: 12.5 }}>💳 drankkaart</div>
                  </div>
                )}
              </div>
              {[[L.reusableCups, bpBekers, setBpBekers], [L.coinsInstead, bpCoins, setBpCoins]].map(([label, val, set]: any, i) => (
                <div key={i} style={{ ...S.row, justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, minWidth: 0 }}>{label}</span>
                  <div style={{ ...S.row, gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: val ? "#1f8a4c" : "#b3a988" }}>{val ? "ja" : "nee"}</span>
                    <div onClick={() => set((v: boolean) => !v)} style={{ width: 46, height: 27, borderRadius: 20, background: val ? "linear-gradient(135deg,#2fae6a,#1f8a4c)" : "#d9cdb0", position: "relative", cursor: "pointer", transition: "background .15s" }}>
                      <div style={{ width: 21, height: 21, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: val ? 22 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: "#8a7d55", margin: "12px 0 14px", lineHeight: 1.5 }}>{L.adjustLater}</div>
              <button style={{ ...S.btnP, width: "100%" }} onClick={applyBeginChoices}>{(bpPotType !== "none" || bpBekers || bpCoins) ? "Verdergaan" : "Snel starten"}</button>
            </div>
          </div>
        )}
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 14 }}>{L.peopleCount}</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <button style={{ ...S.step, width: 42, height: 42, fontSize: 22, opacity: people.length > 0 ? 1 : 0.4 }} onClick={removeLastPerson}>−</button>
            <span style={{ fontSize: 26, fontWeight: 800, minWidth: 34, textAlign: "center" }}>{people.length}</span>
            <button style={{ ...S.step, width: 42, height: 42, fontSize: 22, background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", border: "none" }} onClick={addPerson}>+</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", textAlign: "center", marginTop: 10 }}>{L.namesOptional}</div>
        </div>

        <div style={S.card}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{L.peopleTitle}</span> <span style={{ fontSize: 11.5, color: "#8a7d55", fontStyle: "italic" }}>{L.tapToRename}</span>
          </div>
          {people.length === 0 ? (
            <div style={{ textAlign: "center", color: "#b3a988", fontSize: 13, padding: "14px 0" }}>{L.noPeopleYet}</div>
          ) : (
            <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 8 }}>
              {people.map((p, idx) => {
                const ikZelf = p.claimedBy === me.current
                const bezet = !!p.claimedBy && !ikZelf
                return (
                  <div key={p.id} style={{ position: "relative" }}>
                    {/* De admin kan ALTIJD de naam aanpassen — ook nadat een gast de plaats
                        claimde. Iemand tikt zich verkeerd in, en dan moet je dat kunnen rechtzetten. */}
                    <input value={isGuestDefault(p.name) ? "" : p.name}
                      placeholder={isGuestDefault(p.name) ? p.name : `Gast ${idx + 1}`}
                      onChange={(e) => renamePerson(p.id, e.target.value === "" ? `Gast ${idx + 1}` : e.target.value)}
                      style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: "7px 9px", paddingRight: p.claimedBy ? 26 : 9, fontSize: 13, textAlign: "left" }} />
                    {p.claimedBy && (
                      <span title={ikZelf ? L.thisIsYou : L.selfJoined}
                        style={{ position: "absolute", right: 7, top: 7, fontSize: 12, pointerEvents: "none" }}>
                        {ikZelf ? "⭐" : "📱"}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                      {!p.claimedBy && !meId && (
                        <button onClick={() => claimSeat(p.id, isGuestDefault(p.name) ? `Gast ${idx + 1}` : p.name)} disabled={busy}
                          style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(240,165,0,0.5)", background: "#faf4e4", color: "#8a7d55" }}>
                          {L.thatsMe}
                        </button>
                      )}
                      {(ikZelf || bezet) && (
                        <button onClick={() => releaseSeat(p.id)}
                          style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(120,95,20,0.2)" }}>
                          {ikZelf ? L.notMeShort : L.freeUp}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 10, lineHeight: 1.5 }}>
              {L.seatLegend}
            </div>
            </>
          )}
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
            <span style={{ fontSize: 14, fontWeight: 800 }}>Groepsnaam</span>
            {hasSettled && <span style={{ fontSize: 11, color: "#8a7d55", fontWeight: 700 }}>🔒 vast na afrekenen</span>}
          </div>
          <input disabled={hasSettled} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={L.groupNamePh} style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, background: hasSettled ? "#efe8d6" : "#fdfaf2", color: hasSettled ? "#8a7d55" : "#4a3f1e", cursor: hasSettled ? "not-allowed" : "text" }} />
        </div>
        {!fromOnboarding && (
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: people.length > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{L.peopleTitle}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button style={{ ...S.step, opacity: people.length > 0 ? 1 : 0.4 }} onClick={removeLastPerson}>−</button>
              <span style={{ fontSize: 18, fontWeight: 800, minWidth: 22, textAlign: "center" }}>{people.length}</span>
              <button style={{ ...S.step, background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", border: "none" }} onClick={addPerson}>+</button>
            </div>
          </div>
          {people.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 6 }}>
              {people.map((p, idx) => (
                <input key={p.id} value={isGuestDefault(p.name) ? "" : p.name} placeholder={isGuestDefault(p.name) ? p.name : `Gast ${idx + 1}`} onChange={(e) => renamePerson(p.id, e.target.value === "" ? `Gast ${idx + 1}` : e.target.value)} style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: "6px 8px", fontSize: 12.5, textAlign: "left" }} />
              ))}
            </div>
          )}
        </div>
        )}
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{potIsCard ? "💳 Drankkaart" : "🫙 Pot"} <span style={{ fontSize: 12, fontWeight: 600, color: "#8a7d55" }}>— optioneel</span></span>
            <button style={{ ...S.btn, padding: "6px 12px", fontSize: 13 }} onClick={() => setShowPot(true)}>{potContribTotal > 0 ? `inleg ${euro(potContribTotal)}` : "+ inleggen"}</button>
          </div>
          {potChosen && potContribTotal <= 0.005 && <div style={{ marginTop: 8, textAlign: "right" }}><span onClick={() => setPotChosen(false)} style={{ fontSize: 12, color: "#c0554a", fontWeight: 700, cursor: "pointer" }}>✕ toch niet</span></div>}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <h3 style={{ ...S.h3, margin: 0, fontSize: 13.5, lineHeight: 1.3, textAlign: "center" }}>{L.cupsTitle} <span onClick={(e) => { e.stopPropagation(); setDepositInfo((v) => !v); setCoinInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 10.5, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8, justifyContent: "center" }}>
            <div style={{ ...S.seg(!depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(false)}>uit</div>
            <div style={{ ...S.seg(depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(true)}>aan</div>
          </div>
          {depositInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 12, color: "#6b5f3a", lineHeight: 1.5 }}>♻️ <b>Herbruikbare bekers?</b>{L.cupsInfo}</div>}
          {depositOn && (
            <div style={{ marginTop: 10 }}>
              {pay === "coin" && (
                <>
                  <div style={{ ...S.row, gap: 6, marginBottom: 6 }}>
                    <div style={{ ...S.seg(depositUnit === "coin"), padding: "6px 6px", fontSize: 12 }} onClick={() => setDepositUnit("coin")}>in coins</div>
                    <div style={{ ...S.seg(depositUnit === "eur"), padding: "6px 6px", fontSize: 12 }} onClick={() => setDepositUnit("eur")}>in €</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#c98a00", marginBottom: 8, lineHeight: 1.4 }}>💡 Coins staat aan — kies of de waarborg in <b>coins</b> of <b>€</b> is.</div>
                </>
              )}
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{L.depositPerCup}</span>
                <div style={{ ...S.row, gap: 4 }}>
                  {effDepositUnit === "eur" && <span style={{ fontSize: 13, fontWeight: 700, color: "#8a7d55" }}>€</span>}
                  <input style={{ ...S.input, width: 56 }} type="text" inputMode="decimal" value={depositValue} onChange={(e) => setDepositValue(parseFloat(e.target.value.replace(",", ".")) || 0)} />
                  {effDepositUnit === "coin" && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#c98a00" }}>coins</span>}
                </div>
              </div>
            </div>
          )}
        </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <h3 style={{ ...S.h3, margin: 0, fontSize: 13.5, lineHeight: 1.3, textAlign: "center" }}>🎟️ Coins <span onClick={(e) => { e.stopPropagation(); setCoinInfo((v) => !v); setDepositInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 10.5, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8, justifyContent: "center" }}>
            <div onClick={() => { const on = pay !== "coin"; setPay(on ? "coin" : "eur"); setDepositUnit(on ? "coin" : "eur") }} style={{ width: 44, height: 26, borderRadius: 20, background: pay === "coin" ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#d9cdb0", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background .15s" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: pay === "coin" ? 21 : 3, transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </div>
          </div>
          {coinInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 12, color: "#6b5f3a", lineHeight: 1.5 }}>🎟️ <b>Coins?</b>{L.coinsInfo}</div>}
          {pay === "coin" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>1 coin =</span>
                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={S.input} type="text" inputMode="decimal" value={coinValue} onChange={(e) => setCoinValue(parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
              </div>
              <button style={{ ...S.btn, width: "100%", marginTop: 10, fontSize: 12.5 }} onClick={() => setShowCoins((v) => !v)}>{showCoins ? "▴ verberg coin-prijzen" : "🎟️ coin-prijzen per drankje"}</button>
              {showCoins && (() => {
                const cd = drinks.filter((d) => d.cat === coinCat)
                const vis = cd.filter((d) => coinFull || d.fav)
                return (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ ...S.sub, marginBottom: 8 }}>{L.coinPricesInfo}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {catsPresent.map((cc) => <span key={cc} style={{ ...S.tab(coinCat === cc), padding: "6px 10px", fontSize: 12 }} onClick={() => setCoinCat(cc)}>{CAT_LABEL[cc]}</span>)}
                    </div>
                    <div style={{ ...S.row, gap: 8, marginBottom: 8 }}>
                      <div style={{ ...S.seg(!coinFull), padding: "7px 6px", fontSize: 12.5 }} onClick={() => setCoinFull(false)}>{L.shortList}</div>
                      <div style={{ ...S.seg(coinFull), padding: "7px 6px", fontSize: 12.5 }} onClick={() => setCoinFull(true)}>{L.fullListBtn}</div>
                    </div>
                    {vis.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: "#8a7d55", textAlign: "center", padding: "10px 0" }}>{L.noFavsHere} <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setCoinFull(true)}>{L.showAll}</span></div>
                    ) : vis.map((d) => (
                      <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(120,95,20,0.06)" }}>
                        <span style={{ fontSize: 13 }}>{d.emoji} {d.name}</span>
                        <div style={{ ...S.row, gap: 5 }}>
                          <button style={{ ...S.step, width: 26, height: 26, fontSize: 16 }} onClick={() => setCoinPrice(d.id, d.coins - 0.1)}>−</button>
                          <span style={{ minWidth: 46, textAlign: "center", fontSize: 12.5, fontWeight: 800 }}>{d.coins.toFixed(1)} c</span>
                          <button style={{ ...S.step, width: 26, height: 26, fontSize: 16 }} onClick={() => setCoinPrice(d.id, d.coins + 0.1)}>+</button>
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
        <div style={{ marginTop: 24 }}>
          {rounds.length > 0
            ? <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...S.btn, flex: 1 }} onClick={() => { setOpenRound(rounds.length - 1); setView("hub") }}>{L.roundsOverview}</button>
                {unfinishedRound
                  ? <button style={{ ...S.btnP, flex: 1 }} onClick={resumeRound}>Ga verder met rondje {roundNr}</button>
                  : <button style={{ ...S.btnP, flex: 1 }} onClick={nextRound}>{L.newRound}</button>}
              </div>
            : <button style={{ ...S.btnP, width: "100%" }} onClick={() => { if (unfinishedRound) resumeRound(); else tryBegin() }}>{unfinishedRound ? L.continueRound(roundNr) : "Starten"}</button>}
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
          <h3 style={{ ...S.h3, margin: 0 }}>Ronde {roundNr} <span style={{ fontSize: 13, fontWeight: 600, color: "#8a7d55" }}>— {roundItems} drankje{roundItems === 1 ? "" : "s"}</span>{repeated && roundItems > 0 && <span style={{ ...S.pill, marginLeft: 7, background: "rgba(31,138,76,0.14)", color: "#1f8a4c" }}>overgenomen ✓</span>}</h3>
        </div>
        <div style={{ position: "relative", marginBottom: 9 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔍</span>
          <input value={drinkSearch} onChange={(e) => setDrinkSearch(e.target.value)}
            placeholder={L.searchDrink}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 36, paddingRight: drinkSearch ? 34 : 12, fontSize: 15, textAlign: "left" }} />
          {drinkSearch && (
            <button onClick={() => setDrinkSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 15, color: "#8a7d55", padding: 4 }}>✕</button>
          )}
        </div>

        {zoekt && (
          <div style={{ fontSize: 11.5, color: "#8a7d55", marginBottom: 8 }}>
            {catVisible.length === 0
              ? "Niets gevonden — probeer een ander woord."
              : `${catVisible.length} ${catVisible.length === 1 ? "drankje" : "drankjes"} gevonden (alle categorieën)`}
          </div>
        )}

        <div style={{ display: zoekt ? "none" : "flex", gap: 7, flexWrap: "wrap", paddingBottom: 8, marginBottom: 8 }}>
          {catsPresent.map((c) => {
            const openHere = drinks.some((d) => d.cat === c && (cartAnon[d.id] ?? 0) > 0)
            return <span key={c} style={S.tab(activeCat === c)} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}{openHere && <span style={{ marginLeft: 5, color: "#e0685c", fontSize: 15 }}>●</span>}</span>
          })}
        </div>
        <div style={{ ...S.row, justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div style={{ display: "inline-flex", border: "1px solid rgba(120,95,20,0.2)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
            <span onClick={() => setFullList(false)} style={{ padding: "6px 11px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: !fullList ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: !fullList ? "#fff" : "#8a7d55" }}>compacte lijst</span>
            <span onClick={() => setFullList(true)} style={{ padding: "6px 11px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: fullList ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: fullList ? "#fff" : "#8a7d55" }}>volledige lijst</span>
          </div>
          {potTag}
        </div>
        {catVisible.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "18px 12px", fontSize: 13, color: "#8a7d55" }}>
            Geen favorieten in {CAT_LABEL[activeCat]}. <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setFullList(true)}>{L.showAll}</span>
          </div>
        ) : (
          <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12 }}>
            {catVisible.map((d) => {
              const tot = drinkTotal(d.id), un = cartAnon[d.id] ?? 0
              return (
                <div key={d.id} style={{ padding: "10px 10px", borderRadius: 12, background: tot > 0 ? "rgba(31,138,76,0.08)" : "#faf4e4", border: tot > 0 ? "1.5px solid rgba(31,138,76,0.5)" : "1px solid rgba(120,95,20,0.1)", boxShadow: tot > 0 ? "0 0 0 3px rgba(31,138,76,0.1)" : "none" }}>
                  <div style={{ fontSize: 13.5, fontWeight: tot > 0 ? 800 : 600, color: tot > 0 ? "#1f6b3a" : "#6b5f3a", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                  <div style={{ ...S.row, justifyContent: "space-between", marginTop: 7 }}>
                    <button style={{ ...S.step, opacity: tot > 0 ? 1 : 0.4 }} onClick={() => bumpDown(d.id)}>−</button>
                    <span style={{ fontSize: 17, fontWeight: 800, color: tot > 0 ? "#1f8a4c" : "#b3a988" }}>{tot}</span>
                    <button style={S.step} onClick={() => bump1(d.id)}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "2px 0 14px" }}>
          <button onClick={startVoice}
            style={{ ...S.btn, fontSize: 12.5, fontWeight: 800, padding: "9px 14px", border: "1px dashed rgba(240,165,0,0.6)", background: "#fffdf6", color: "#c98a00" }}>
            {L.voiceBtn} <span style={{ fontSize: 9, opacity: 0.75 }}>{L.voiceBeta}</span>
          </button>
          <button onClick={() => { setShowAddDrink(true); setNdName(drinkSearch.trim()) }}
            style={{ ...S.btn, fontSize: 12.5, fontWeight: 800, padding: "9px 14px", border: "1px dashed rgba(240,165,0,0.6)", background: "#fffdf6", color: "#c98a00" }}>
            {L.addOwnDrink}
          </button>
        </div>
        {roundItems > 0 && (
          <div style={{ ...S.card, padding: "10px 12px", background: "#fffdf6" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#8a5e0f" }}>{L.inThisRound} <span style={{ fontWeight: 600, color: "#b3a988" }}>{L.assignHint}</span></span>
              <span style={{ ...S.pill, background: "rgba(240,165,0,0.18)", color: "#c98a00" }}>{roundItems} drankje{roundItems === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                const un = cartAnon[d.id] ?? 0
                return (
                  <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, background: "rgba(240,165,0,0.12)", border: "1px solid rgba(240,165,0,0.35)", color: "#4a3f1e", cursor: "pointer" }} onClick={() => setShowAssignAll(true)}>
                    {d.emoji} {drinkTotal(d.id)}× {d.name}{un > 0 && <span style={{ color: "#c0554a", fontWeight: 800, textDecoration: "underline" }}>toewijzen</span>}
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
        <button style={{ ...S.btnP, opacity: roundItems === 0 ? 0.5 : 1 }} onClick={() => roundItems > 0 && openClose()}>✅ Rondje {roundNr} bevestigen{roundItems > 0 && <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}> — {roundItems} drankje{roundItems === 1 ? "" : "s"}</span>}</button>
        {roundItems > 0 && (
          <button style={{ ...S.btn, width: "100%", marginTop: 10, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelOrder}>{L.cancelRound}</button>
        )}

        {showAssignAll && (
          <div style={S.overlay} onClick={() => setShowAssignAll(false)}>
            <div style={{ ...S.sheet, maxHeight: "82vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ ...S.h3, margin: 0, fontSize: 18 }}>{L.assign}</h3>
                <div style={{ ...S.row, gap: 4 }}>
                  <div style={{ ...S.seg(assignMode === "person"), padding: "6px 10px", fontSize: 12, minWidth: 82, textAlign: "center" }} onClick={() => setAssignMode("person")}>{L.perPerson}</div>
                  <div style={{ ...S.seg(assignMode === "drink"), padding: "6px 10px", fontSize: 12, minWidth: 82, textAlign: "center" }} onClick={() => setAssignMode("drink")}>per drank</div>
                </div>
              </div>
              {assignMode === "person" && unassignedTotal > 0 && <div style={{ fontSize: 12.5, fontWeight: 800, color: "#c0554a", marginBottom: 8 }}>🔴 {unassignedTotal} drankje{unassignedTotal === 1 ? "" : "s"} nog niet toegewezen</div>}

              {assignMode === "drink" ? (
                drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                  const un = cartAnon[d.id] ?? 0
                  return (
                    <div key={d.id} style={{ borderTop: "1px solid rgba(120,95,20,0.1)", paddingTop: 9, marginBottom: 9 }}>
                      <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{d.emoji} {drinkTotal(d.id)}× {d.name}</span>
                        {un > 0 && <span style={{ fontSize: 11.5, color: "#c0554a", fontWeight: 800 }}>🔴 {un} zonder naam</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {people.map((p) => { const n = aQty(d.id, p.id); return <span key={p.id} style={{ ...S.chip(n), fontSize: 12.5, padding: "5px 10px" }} onClick={() => assignFromAnon(d.id, p.id)}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); unassignCart(d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1 }}>−</span>}</span> })}
                        {drinkTotal(d.id) === people.length && people.length > 0 && <span onClick={() => eachOne(d.id)} style={{ ...S.chip(0), fontSize: 12.5, padding: "5px 10px", border: "1.5px dashed #c98a00", background: "rgba(240,165,0,0.1)", color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{L.eachOne}</span>}
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
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{p.name}{took.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8a7d55" }}> · {took.reduce((a, d) => a + (cart[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {drinks.filter((d) => aQty(d.id, p.id) > 0).map((d) => { const n = aQty(d.id, p.id); return <span key={d.id} style={{ ...S.chip(n), fontSize: 12.5, padding: "5px 10px" }}>{d.emoji} {d.name}<span style={S.badge}>{n}</span><span onClick={(e) => { e.stopPropagation(); unassignCart(d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>−</span></span> })}
                        {drinks.filter((d) => (cartAnon[d.id] ?? 0) > 0).map((d) => <span key={"add" + d.id} onClick={() => assignFromAnon(d.id, p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, padding: "5px 10px", borderRadius: 20, background: "#fff", border: "1px dashed rgba(120,95,20,0.4)", color: "#8a7d55", fontWeight: 700, cursor: "pointer" }}>+ {d.emoji} {d.name}</span>)}
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
              <h3 style={{ ...S.h3, fontSize: 18 }}>🫙 Bekers — ronde {roundNr}</h3>
              <p style={{ ...S.sub }}>{L.howMuchEach} <b>terug</b>? Standaard = ruil. Iedereen kan teruggeven — ook wie niks bestelde of een beker van elders binnenbrengt (gaat dan negatief = krijgt waarborg).</p>
              <button style={{ ...S.btn, width: "100%", marginBottom: 12, fontSize: 13 }} onClick={() => { setGaveBackDraft(Object.fromEntries(people.map((p) => [p.id, 0]))); setCupsChecked(true); setShowCups(false) }}>{L.nobodyGaveBack}</button>
              {people.map((p) => {
                const bal = cupsBal(p.id), pu = pickedUpOf(p.id)
                const gb = gaveBackDraft[p.id] ?? Math.min(bal, pu)
                const newBal = bal + pu - gb
                return (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                    <div><div style={{ fontSize: 15, fontWeight: 800 }}>{p.name}</div><div style={{ fontSize: 11.5, fontWeight: 700, color: newBal < 0 ? "#1f8a4c" : "#8a7d55" }}>beker-saldo: {newBal}{newBal < 0 ? " (krijgt waarborg)" : ""}</div></div>
                    <div style={{ ...S.row, gap: 7 }}>
                      <span style={{ fontSize: 11, color: "#8a7d55" }}>{L.gaveBack}</span>
                      <button style={{ ...S.step, width: 28, height: 28, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: Math.max(0, gb - 1) })) }}>−</button>
                      <span style={{ minWidth: 16, textAlign: "center", fontSize: 15, fontWeight: 800 }}>{gb}</span>
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
              <h3 style={{ ...S.h3, fontSize: 18 }}>✅ Ronde {roundNr} bevestigen</h3>
              {unassignedTotal > 0 && (
                <div onClick={goAssignFromWarning} style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: "#b0402f", cursor: "pointer" }}>
                  🔴 <b>{unassignedTotal} drankje{unassignedTotal === 1 ? "" : "s"} nog niet toegewezen.</b> <u>{L.tapToAssign}</u>
                </div>
              )}
              {depositOn && (cupsBlock ? (
                <div style={{ background: "rgba(224,104,92,0.12)", border: "1.5px solid rgba(224,104,92,0.6)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div onClick={() => setShowCups(true)} style={{ fontSize: 12.5, color: "#b0402f", cursor: "pointer", fontWeight: 700 }}>🫙 <b>{L.cupsNotSet}</b> <u>{L.tapToArrange}</u></div>
                  <div onClick={() => setDepositOn(false)} style={{ fontSize: 11.5, color: "#8a7d55", cursor: "pointer", marginTop: 6 }}>… of <u>ga verder zonder bekers/waarborg</u> (uitschakelen).</div>
                </div>
              ) : (
                <div style={{ ...S.row, justifyContent: "space-between", background: "rgba(31,138,76,0.1)", borderRadius: 12, padding: "9px 12px", marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, color: "#1f8a4c", fontWeight: 700 }}>🫙 {gaveBackTotal > 0 ? `${gaveBackTotal} beker${gaveBackTotal === 1 ? "" : "s"} teruggegeven ✓` : "0 bekers meegegeven ✓"}</span>
                  <button style={{ ...S.btn, padding: "4px 10px", fontSize: 11.5 }} onClick={() => setShowCups(true)}>aanpassen</button>
                </div>
              ))}
              <button style={{ ...S.btnP, opacity: cupsBlock ? 0.5 : 1 }} onClick={() => !cupsBlock && commitRound()}>✅ Bevestig rondje ({roundItems} drankje{roundItems === 1 ? "" : "s"})</button>
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
              <div style={{ fontSize: 15, fontWeight: 800 }}>Ronde {roundNr} bevestigd — {items} drankjes</div>
            </div>
          </div>
          {depositOn && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8a5e0f", marginBottom: 6 }}>🫙 {totalInUse} beker{totalInUse === 1 ? "" : "s"} in omloop · {euro(totalInUse * depositPerCupEur)}</div>}
          {(() => {
            const rl = last ? drinks.filter((d) => drinkTotalRound(last, d.id) > 0) : []
            return (
              <div style={{ borderTop: "1px dashed rgba(120,95,20,0.2)", paddingTop: 8, display: "grid", gridTemplateColumns: rl.length > 4 ? "1fr 1fr" : "1fr", gap: rl.length > 4 ? "4px 14px" : 4 }}>
                {rl.map((d) => {
                  const n = drinkTotalRound(last!, d.id)
                  const who = people.filter((p) => (last!.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = last!.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                  return <div key={d.id} style={{ fontSize: 13.5 }}><b>{d.emoji} {n}× {d.name}</b>{who.length > 0 && <span style={{ color: "#8a7d55" }}> → {who.join(", ")}</span>}</div>
                })}
              </div>
            )
          })()}
          <div style={{ ...S.row, justifyContent: "space-between", gap: 8, borderTop: "1px dashed rgba(120,95,20,0.25)", marginTop: 8, paddingTop: 8 }}>
            <span style={{ fontSize: 13, color: "#e08a00", fontWeight: 800 }}>{L.someoneCanGo}</span>
            <span style={{ fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{L.total}: {items}</span>
          </div>
          {last && (() => { const un = drinks.reduce((a, d) => a + (last.anon[d.id] ?? 0), 0); return un > 0 ? (
            <div onClick={() => { editOrder(); setShowAssignAll(true) }} style={{ marginTop: 8, background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.5)", borderRadius: 10, padding: "8px 11px", fontSize: 12.5, fontWeight: 800, color: "#b0402f", cursor: "pointer", textAlign: "center" }}>🔴 {un} drankje{un === 1 ? "" : "s"} nog niet toegewezen. <u>{L.tapToAssign}</u></div>
          ) : null })()}
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>{L.exactAmount}</div>
          <div style={{ ...S.row, gap: 8, justifyContent: "center", margin: "2px 0" }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>€</span>
            <input style={{ ...S.input, width: 120, fontSize: 22, textAlign: "center", fontWeight: 800 }} type="text" inputMode="decimal" placeholder="0,00" value={amountDraft} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setAmountDraft(v); autoSplit(payPersons, payPot, v); setPaidConfirmed(false) }} />
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", textAlign: "center", marginBottom: 14 }}>ⓘ hierop verdeelt de app eerlijk (Fair Split)</div>

          {(parseFloat(amountDraft.replace(",", ".")) || 0) > 0 ? (
          <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a7d55", marginBottom: 7 }}>{L.paidBy} <span style={{ fontWeight: 600, color: "#b3a988" }}>{L.multiplePossible}</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            <span style={{ ...S.chip(payPot ? 1 : 0), opacity: st.potAvail <= 0.005 ? 0.45 : 1 }} onClick={() => { if (!payPot && st.potAvail <= 0.005) { setNotice(`De ${potIsCard ? "drankkaart" : "pot"} is leeg (€0). Tik rechtsboven op “${potIsCard ? "drankkaart" : "pot"} + toevoegen” om eerst in te leggen.`); return } const nextPot = !payPot; setPayPot(nextPot); autoSplit(payPersons, nextPot); setPaidConfirmed(false) }}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
            {people.map((p) => <span key={p.id} style={S.chip(payPersons.includes(p.id) ? 1 : 0)} onClick={() => togglePayPerson(p.id)}>{p.name}</span>)}
          </div>

          {st.multi && (
            <div style={{ background: "#faf4e4", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: "#8a7d55", marginBottom: 8 }}>Gelijk verdeeld <span style={{ fontWeight: 600, color: "#b3a988" }}>— pas aan per persoon indien nodig</span></div>
              {payPot && (
                <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
                  <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 84, borderColor: st.potOver ? "#e0685c" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" placeholder="0,00" value={potAmtDraft} onChange={(e) => { setPotAmtDraft(e.target.value.replace(/[^0-9.,]/g, "")); setPaidConfirmed(false) }} /></div>
                </div>
              )}
              {payPersons.map((pid) => (
                <div key={pid} style={{ ...S.row, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>👤 {people.find((p) => p.id === pid)?.name}</span>
                  <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 84 }} type="text" inputMode="decimal" placeholder="0,00" value={payAmts[pid] ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setPayAmts((m) => ({ ...m, [pid]: v })); setPaidConfirmed(false) }} /></div>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", paddingTop: 8, fontSize: 12, fontWeight: 800, color: st.valid ? "#1f8a4c" : "#c0554a" }}>
                Samen {euro(st.sum)} van {euro(st.total)}{st.valid ? " ✓ klopt" : st.missing > 0 ? ` — er ontbreekt ${euro(st.missing)}` : ` — ${euro(-st.missing)} te veel`}
              </div>
              {st.rounding && <div style={{ fontSize: 10.5, color: "#b3a988", marginTop: 3 }}>{L.roundingNote}</div>}
              {payPot && <div style={{ fontSize: 11, color: st.potOver ? "#c0554a" : "#8a7d55", marginTop: 5 }}>{potIsCard ? "Drankkaart" : "Pot"} beschikbaar: {euro(Math.max(0, st.potAvail))}</div>}
            </div>
          )}
          {payPot && !st.multi && <div style={{ fontSize: 12, color: st.potOver ? "#c0554a" : "#8a7d55", fontWeight: 700, marginTop: 8 }}>{potIsCard ? "drankkaart" : "pot"}: {euro(Math.max(0, st.potAvail))} beschikbaar{st.potOver ? " — te weinig, kies een extra betaler of leg bij" : ""}</div>}

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
            <div style={{ fontSize: 12.5, color: "#b3a988", textAlign: "center", padding: "6px 0 2px" }}>Vul eerst het betaalde bedrag in — daarna kies je wie betaalde.</div>
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
        {assignIdx !== null && rounds[assignIdx] && (() => {
          const idx = assignIdx
          const r = rounds[idx]
          const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
          const done = !drinks.some((d) => (r.anon[d.id] ?? 0) > 0)
          return (
            <div style={S.overlay} onClick={() => setAssignIdx(null)}>
              <div style={{ ...S.sheet, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10 }}>Toewijzen — ronde {idx + 1}</h3>

                      <div style={{ ...S.row, justifyContent: "flex-end", gap: 4, marginBottom: 8 }}>
                        <div style={{ ...S.seg(editAssignMode === "person"), padding: "5px 9px", fontSize: 11.5, minWidth: 78, textAlign: "center" }} onClick={() => setEditAssignMode("person")}>{L.perPerson}</div>
                        <div style={{ ...S.seg(editAssignMode === "drink"), padding: "5px 9px", fontSize: 11.5, minWidth: 78, textAlign: "center" }} onClick={() => setEditAssignMode("drink")}>per drank</div>
                      </div>
                      {editAssignMode === "person" && (() => { const u = roundDrinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0); return u > 0 ? <div style={{ fontSize: 12, fontWeight: 800, color: "#c0554a", marginBottom: 8 }}>🔴 {u} drankje{u === 1 ? "" : "s"} nog niet toegewezen</div> : null })()}
                      {editAssignMode === "drink" ? roundDrinks.map((d) => {
                        const un = r.anon[d.id] ?? 0
                        return (
                          <div key={d.id} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}{un > 0 && <span style={{ color: "#c0554a", fontWeight: 700 }}> · 🔴 {un} onbekend</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {people.map((p) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={p.id} style={{ ...S.chip(n), padding: "5px 10px", fontSize: 12.5 }} onClick={() => rAssignFromAnon(idx, d.id, p.id)}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1 }}>−</span>}</span>
                              )})}
                            </div>
                          </div>
                        )
                      }) : (<div style={{ display: people.length > 4 ? "grid" : "block", gridTemplateColumns: people.length > 4 ? "1fr 1fr" : undefined, columnGap: 12 }}>{people.map((p) => {
                        const took = roundDrinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
                        return (
                          <div key={p.id} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{p.name}{took.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#8a7d55" }}> · {took.reduce((a, d) => a + (r.orders[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {roundDrinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((d) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={d.id} style={{ ...S.chip(n), padding: "5px 10px", fontSize: 12.5 }}>{d.emoji} {d.name}<span style={S.badge}>{n}</span><span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>−</span></span>
                              )})}
                              {roundDrinks.filter((d) => (r.anon[d.id] ?? 0) > 0).map((d) => (
                                <span key={"add" + d.id} onClick={() => rAssignFromAnon(idx, d.id, p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 12.5, borderRadius: 20, background: "#fff", border: "1px dashed rgba(120,95,20,0.4)", color: "#8a7d55", fontWeight: 700, cursor: "pointer" }}>+ {d.emoji} {d.name}</span>
                              ))}
                            </div>
                          </div>
                        )
                      })}</div>)}
                      <div style={{ fontSize: 11, color: "#8a7d55" }}>{L.redistribute}</div>
                <button style={done ? { ...S.btnP, marginTop: 10, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" } : { ...S.btnP, marginTop: 10 }} onClick={() => setAssignIdx(null)}>{done ? "Klaar — alles toegewezen" : "Klaar"}</button>
              </div>
            </div>
          )
        })()}
        <div style={{ ...S.row, justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.roundsOverview}</h3>
          {potTag}
        </div>
        {paidCount === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{L.noRoundsDone}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHint}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={() => { if (unfinishedRound) { resumeRound(); return } setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }}>{unfinishedRound ? L.continueRound(roundNr) : "Start 1e rondje"}</button>
            </div>
          </div>
        ) : (<>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ ...S.sub, margin: 0 }}>{L.tapRoundToEdit}</p>
          {paidCount > 1 && <span onClick={() => setAllRoundsOpen((v) => !v)} style={{ fontSize: 12, fontWeight: 800, color: "#8a5e0f", cursor: "pointer", flexShrink: 0 }}>{allRoundsOpen ? "alles dichtklappen" : "alles openklappen"}</span>}
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
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Ronde {idx + 1} <span style={{ fontSize: 12, fontWeight: 600, color: "#8a7d55" }}>· {items} drankjes · {euro(r.amount)}</span>{!drinks.some((d) => (r.anon[d.id] ?? 0) > 0) && <span style={{ fontSize: 11.5, fontWeight: 800, color: "#1f8a4c", marginLeft: 6 }}>{L.assigned}</span>}</span>
                  <span style={{ fontSize: 14, color: "#8a7d55" }}>{open ? "▴" : "▾"}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f8a4c", marginTop: 3 }}>✓ betaald: {paidLabel(r)}</div>
              </div>
              {(() => {
                const un = drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0)
                if (un === 0) return null
                return (
                  <div onClick={() => { setAssignIdx(idx) }} style={{ margin: "0 14px 14px", background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.5)", borderRadius: 10, padding: "9px 11px", fontSize: 12.5, fontWeight: 800, color: "#b0402f", cursor: "pointer", textAlign: "center" }}>
                    🔴 {un} drankje{un === 1 ? "" : "s"} nog niet toegewezen. <u>{L.tapToAssign}</u>
                  </div>
                )
              })()}
              {open && (
                <div style={{ padding: "0 14px 14px" }}>
                  {roundDrinks.map((d) => {
                    const who = people.filter((p) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = r.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                    return <div key={d.id} style={{ fontSize: 13.5, marginBottom: 3 }}><b>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}</b>{who.length > 0 && <span style={{ color: "#8a7d55" }}> → {who.join(", ")}</span>}</div>
                  })}

                  <div style={{ ...S.row, justifyContent: "flex-end", marginTop: 10 }}>
                    <button style={{ ...S.btn, fontSize: 12, padding: "5px 12px", fontWeight: 800, color: "#8a5e0f" }} onClick={() => { const next = !editOpen; setEditOpen(next); if (!next) { setEditCups(false); setEditPay(false) } }}>{editOpen ? "▴ sluiten" : "✏️ aanpassen"}</button>
                  </div>
                  {editOpen && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button style={{ ...S.btn, flex: 1, fontSize: 11.5, padding: "7px 0" }} onClick={() => { setEditCups(false); setEditPay(false); setAssignIdx(idx) }}>toewijzen{!drinks.some((d) => (r.anon[d.id] ?? 0) > 0) && <span style={{ color: "#1f8a4c", fontWeight: 800 }}> ✓</span>}</button>
                      <button style={{ ...S.btn, flex: 1, fontSize: 11.5, padding: "7px 0", ...(editPay ? { background: "rgba(240,165,0,0.16)", borderColor: "rgba(240,165,0,0.5)", fontWeight: 800 } : {}) }} onClick={() => { setEditPay((v) => !v); setEditCups(false) }}>{L.amountAndPayer}</button>
                      {depositOn && <button style={{ ...S.btn, flex: 1, fontSize: 11.5, padding: "7px 0", ...(editCups ? { background: "rgba(240,165,0,0.16)", borderColor: "rgba(240,165,0,0.5)", fontWeight: 800 } : {}) }} onClick={() => { setEditCups((v) => !v); setEditPay(false) }}>bekers</button>}
                    </div>
                  )}


                  {editPay && (
                    <div style={{ marginTop: 10, background: "#faf4e4", borderRadius: 12, padding: 10 }}>
                      <div style={{ ...S.row, gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>€</span>
                        <input style={{ ...S.input, width: 110, fontSize: 16, borderColor: (r.amount || 0) <= 0 ? "#e0685c" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" value={r.amount || ""} onChange={(e) => rSetAmount(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} />
                        <span style={{ fontSize: 11, color: "#8a7d55" }}>totaal — Fair-Split basis</span>
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: "#8a7d55", marginBottom: 6 }}>Betaald door <span style={{ fontWeight: 600, color: "#b3a988" }}>{L.multiplePossible}</span></div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span style={S.chip((r.potPart || 0) > 0 ? 1 : 0)} onClick={() => rTogglePot(idx)}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
                        {people.map((p) => <span key={p.id} style={{ ...S.chip((r.payers?.[p.id] || 0) > 0 ? 1 : 0), padding: "6px 11px", fontSize: 13 }} onClick={() => rTogglePayer(idx, p.id)}>{p.name}</span>)}
                      </div>
                      {(() => {
                        const sel = Object.keys(r.payers || {}).filter((pid) => people.some((p) => p.id === pid))
                        const nPay = sel.length + ((r.potPart || 0) > 0 ? 1 : 0)
                        if (nPay === 0) return <div style={{ fontSize: 11.5, color: "#c0554a", fontWeight: 700, marginTop: 6 }}>Kies wie betaalde.</div>
                        const sum = rPaidSum(r), diff = (r.amount || 0) - sum
                        return (
                          <div style={{ marginTop: 8, background: "#fff", borderRadius: 10, padding: "9px 10px" }}>
                            {nPay > 1 && <div style={{ fontSize: 11, fontWeight: 800, color: "#8a7d55", marginBottom: 7 }}>Gelijk verdeeld <span style={{ fontWeight: 600, color: "#b3a988" }}>— pas aan per persoon indien nodig</span></div>}
                            {(r.potPart || 0) > 0 && (
                              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
                                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 78, fontSize: 13 }} type="text" inputMode="decimal" value={r.potPart || ""} onChange={(e) => rSetPotAmt(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                              </div>
                            )}
                            {sel.map((pid) => (
                              <div key={pid} style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700 }}>👤 {people.find((p) => p.id === pid)?.name}</span>
                                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={{ ...S.input, width: 78, fontSize: 13 }} type="text" inputMode="decimal" value={r.payers[pid] || ""} onChange={(e) => rSetPayerAmt(idx, pid, parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                              </div>
                            ))}
                            <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", paddingTop: 7, fontSize: 11.5, fontWeight: 800, color: Math.abs(diff) <= 0.005 ? "#1f8a4c" : "#c0554a" }}>Samen {euro(sum)} van {euro(r.amount || 0)}{Math.abs(diff) <= 0.005 ? " ✓ klopt" : diff > 0 ? ` — er ontbreekt ${euro(diff)}` : ` — ${euro(-diff)} te veel`}</div>
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
                            <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name} <span style={{ fontSize: 11, color: "#8a7d55" }}>· nam {nam}</span></span>
                            <div style={{ ...S.row, gap: 6 }}>
                              <span style={{ fontSize: 11, color: "#8a7d55" }}>{L.gaveBack}</span>
                              <button style={{ ...S.step, width: 26, height: 26, fontSize: 16, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => rSetGaveBack(idx, p.id, gb - 1)}>−</button>
                              <span style={{ minWidth: 14, textAlign: "center", fontSize: 14, fontWeight: 800 }}>{gb}</span>
                              <button style={{ ...S.step, width: 26, height: 26, fontSize: 16 }} onClick={() => rSetGaveBack(idx, p.id, gb + 1)}>+</button>
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
        {rounds.length > 0 && <>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={goFinal}>{L.settleBtn}</button>
            <button style={{ ...S.btnP, flex: 2 }} onClick={() => { if (unfinishedRound) resumeRound(); else nextRound() }}>{unfinishedRound ? L.continueRound(roundNr) : "➕ Nieuw rondje"}</button>
          </div>
          {!unfinishedRound && paidCount > 0 && (
            <div style={{ marginTop: 10 }}>
              <button style={{ width: "100%", border: "1.5px dashed rgba(240,165,0,0.6)", background: "rgba(240,165,0,0.08)", color: "#8a5e0f", borderRadius: 14, padding: "13px 6px", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }} onClick={repeatRound}>{L.repeatRound}</button>
              <div style={{ fontSize: 11, color: "#b3a988", textAlign: "center", marginTop: 6 }}>daarna nog aanpasbaar</div>
            </div>
          )}
        </>}
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
        <div style={{ ...S.row, justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ fontWeight: 800 }}>{L.totalOrdered}</span>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{show(grandTotal)}</span>
        </div>
        {potSpent > 0 && (
          <div style={{ marginTop: 6, borderTop: "1px dashed rgba(120,95,20,0.2)", paddingTop: 6 }}>
            <div style={{ ...S.row, justifyContent: "space-between", fontSize: 12.5, color: "#8a7d55" }}><span>🫙 waarvan uit de pot</span><span style={{ fontWeight: 700, color: "#1f8a4c" }}>−{show(potSpent)}</span></div>
            <div style={{ ...S.row, justifyContent: "space-between", fontSize: 12.5, color: "#8a7d55" }}><span>door personen betaald</span><span style={{ fontWeight: 700 }}>{show(grandTotal - potSpent)}</span></div>
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ ...S.row, gap: 6, marginBottom: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.fairSplit}</h3>
          <span onClick={() => setNotice("⚖️ Fair Split — Eerlijker dan gelijke verdeling. Wie weinig of goedkopere drankjes nam, betaalt niet mee voor wie meer of duurdere drankjes nam.")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>i</span>
        </div>
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => { setOpenFairAll((v) => !v); setOpenFair({}) }} style={{ ...S.btn, padding: "7px 14px", fontSize: 12.5, fontWeight: 800, color: "#8a5e0f" }}>{openFairAll ? "▴ Sluit details" : "▾ Bekijk details"}</button>
        </div>
        {anyUnassignedRounds && (
          <div style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "11px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>{L.equalSplitWarn}</div>
            <div style={{ fontSize: 11.5, color: "#8a5e0f", lineHeight: 1.5, marginBottom: 9 }}>{L.unassignedWarn}</div>
            <button style={{ ...S.btnP, width: "100%", padding: "11px 0", fontSize: 13.5 }} onClick={goAssignUnassigned}>{L.useFairSplit}</button>
          </div>
        )}
        {showEqual && (
          <div style={{ ...S.row, justifyContent: "flex-end", gap: 4, fontSize: 10.5, color: "#8a7d55", fontWeight: 800, paddingBottom: 4, borderBottom: "1px solid rgba(120,95,20,0.12)" }}>
            <span>gelijke verdeling</span>
            <span onClick={() => setNotice("Gelijke verdeling = totaal ÷ aantal personen. Fair Split is eerlijker: wie weinig of niks dronk, betaalt niet mee voor wie veel dronk.")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 9.5, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>i</span>
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
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{open ? "▾" : "▸"} {p.name} <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1f8a4c" }}>· {show(dronk)}</span>
                  {Math.abs(owed) > 0.005 && <span style={{ display: "inline-block", marginLeft: 6, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", background: owed > 0 ? "rgba(224,138,0,0.16)" : "rgba(31,138,76,0.14)", color: owed > 0 ? "#b35309" : "#1f8a4c" }}>{owed > 0 ? `betaalt ${show(owed)}` : `krijgt ${show(-owed)}`}</span>}
                </span>
                {showEqual && <span style={{ width: 96, textAlign: "right", fontSize: 12.5, color: "#8a7d55" }}>{show(equalShare)}</span>}
              </div>
              {open && (
                <div style={{ background: "#faf4e4", borderRadius: 10, padding: "8px 11px", margin: "0 0 8px", fontSize: 12.5 }}>
                  <div style={{ color: "#6b5f3a", padding: "2px 0" }}>{L.drank}</div>
                  {(() => {
                    const cnt: Record<string, number> = {}
                    rounds.forEach((r) => Object.entries(r.orders).forEach(([did, per]) => { const q = per?.[p.id] ?? 0; if (q > 0) cnt[did] = (cnt[did] ?? 0) + q }))
                    const list = drinks.filter((d) => (cnt[d.id] ?? 0) > 0)
                    if (list.length === 0) return null
                    return <div style={{ fontSize: 11.5, color: "#8a7d55", padding: "1px 0 5px", lineHeight: 1.5 }}>{list.map((d) => `${cnt[d.id]}× ${d.name}`).join(" · ")}</div>
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
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800 }}>Totaal <span style={{ fontSize: 13, fontWeight: 800, color: "#1f8a4c" }}>· {show(grandTotal)}</span></span>
          {showEqual && <span style={{ width: 96, textAlign: "right", fontSize: 12.5, fontWeight: 800, color: "#8a7d55" }}>{show(equalShare * people.length)}</span>}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 10, textAlign: "right" }}><span onClick={() => setShowEqual((v) => !v)} style={{ color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{showEqual ? "verberg gelijke verdeling" : "toon gelijke verdeling"}</span></div>
      </div>

      {renderSettleTogether()}

      <div style={S.card}>
        <h3 style={{ ...S.h3, marginBottom: 8 }}>{L.howYouAllSettle}</h3>
        <p style={{ ...S.sub, marginBottom: 8 }}>{L.fewestTransfers}</p>
        {settlement.tx.length === 0 ? <div style={{ fontSize: 13.5, color: "#1f8a4c", fontWeight: 700 }}>{L.allEven}</div> : settlement.tx.map((t, i) => (
          <div key={i} style={{ ...S.row, justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
            <span style={{ fontSize: 14 }}><b>{t.from}</b> → {t.to}</span><span style={{ fontSize: 15, fontWeight: 800, color: "#b35309" }}>{show(t.amount)}</span>
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
