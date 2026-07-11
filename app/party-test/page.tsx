"use client"

// ─────────────────────────────────────────────────────────────────────────────
// RUNDO PARTY — TESTPAGINA v7
// - Betaling bevestigen -> rondjes-hub (overzicht) -> nieuw rondje / afrekenen
// - Bewerken (toewijzen + bekers) in het overzicht; app herberekent automatisch
// - Home-knop op elk scherm (geen reset); coin-prijzen zichtbaar/aanpasbaar
// Richtprijzen blijven ONZICHTBAAR bij bestellen. Volledig lokaal. app/party-test/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react"

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

type Person = { id: string; name: string }
type Cat = "Bier" | "BierAV" | "Frisdrank" | "Wijn" | "Cocktail" | "Mocktail" | "Longdrink" | "Shot" | "Warm"
type Drink = { id: string; name: string; emoji: string; cat: Cat; price: number; cup: boolean; fav: boolean; coins: number }

const CATS: Cat[] = ["Bier", "BierAV", "Frisdrank", "Wijn", "Cocktail", "Mocktail", "Longdrink", "Shot", "Warm"]
const CAT_LABEL: Record<Cat, string> = { Bier: "🍺 Bier", BierAV: "🌿 AV-bier", Frisdrank: "🥤 Fris", Wijn: "🍷 Wijn", Cocktail: "🍸 Cocktail", Mocktail: "🍹 Mocktail", Longdrink: "🥃 Longdrink", Shot: "🔥 Shot", Warm: "☕ Warm" }
const CAT_EMOJI: Record<Cat, string> = { Bier: "🍺", BierAV: "🌿", Frisdrank: "🥤", Wijn: "🍷", Cocktail: "🍸", Mocktail: "🍹", Longdrink: "🥃", Shot: "🔥", Warm: "☕" }
const CUPCAT: Record<Cat, boolean> = { Bier: true, BierAV: true, Frisdrank: true, Wijn: true, Cocktail: true, Mocktail: true, Longdrink: false, Shot: false, Warm: false }

const DATA: [Cat, string, number][] = [
  ["Bier", "Pils", 3.5], ["Bier", "Duvel", 5.5], ["Bier", "Chimay Blauw", 5.5], ["Bier", "Cornet", 5.5], ["Bier", "Geuze", 5.5], ["Bier", "Hoegaarden Wit", 4.5], ["Bier", "Kriek", 4.5], ["Bier", "La Chouffe", 5.5], ["Bier", "Leffe Blond", 5], ["Bier", "Tripel Karmeliet", 5.5], ["Bier", "Vedett Extra Blond", 4.5], ["Bier", "Westmalle Tripel", 5.5],
  ["BierAV", "Jupiler 0.0", 3.5], ["BierAV", "Stella Artois 0.0", 3.5], ["BierAV", "Carlsberg 0.0", 4.5], ["BierAV", "Corona Cero", 4.5], ["BierAV", "Hoegaarden 0.0", 4.5], ["BierAV", "La Chouffe 0.0", 5], ["BierAV", "Leffe 0.0 Blond", 4.5], ["BierAV", "Sportzot", 4.5], ["BierAV", "Cornet 0.0", 5], ["BierAV", "Vedett Extra Blond 0.0", 4.5],
  ["Frisdrank", "Cola", 3.2], ["Frisdrank", "Cola Zero", 3.2], ["Frisdrank", "Cola Light", 3.2], ["Frisdrank", "Fanta", 3.2], ["Frisdrank", "Sprite", 3.2], ["Frisdrank", "Ice Tea", 3.2], ["Frisdrank", "Red Bull", 4.5], ["Frisdrank", "Schweppes Tonic", 3.4], ["Frisdrank", "Appelsap", 3.5], ["Frisdrank", "Sinaasappelsap", 3.5], ["Frisdrank", "Water plat", 3], ["Frisdrank", "Water bruis", 3],
  ["Wijn", "Huiswijn rood", 5.5], ["Wijn", "Huiswijn wit", 5.5], ["Wijn", "Huiswijn rosé", 5.5], ["Wijn", "Cava", 7.5], ["Wijn", "Prosecco", 7.5], ["Wijn", "Champagne", 12.5], ["Wijn", "Cabernet Sauvignon", 6.5], ["Wijn", "Chardonnay", 6.5], ["Wijn", "Merlot", 6.5], ["Wijn", "Pinot Noir", 7], ["Wijn", "Sauvignon Blanc", 6.5],
  ["Cocktail", "Aperol Spritz", 11.5], ["Cocktail", "Gin Tonic", 12.5], ["Cocktail", "Mojito", 11.5], ["Cocktail", "Margarita", 11.5], ["Cocktail", "Cosmopolitan", 12], ["Cocktail", "Espresso Martini", 12.5], ["Cocktail", "Hugo Spritz", 11], ["Cocktail", "Moscow Mule", 11.5], ["Cocktail", "Negroni", 12.5], ["Cocktail", "Piña Colada", 11.5], ["Cocktail", "Pornstar Martini", 12.5], ["Cocktail", "Sex on the Beach", 11.5],
  ["Mocktail", "Virgin Mojito", 8.5], ["Mocktail", "Virgin Gin Tonic", 9.5], ["Mocktail", "Hugo 0.0", 9], ["Mocktail", "Berry Mule", 9], ["Mocktail", "Gimber", 8.5], ["Mocktail", "Strawberry Daiquiri 0.0", 9], ["Mocktail", "Tropical Sunrise", 8.5], ["Mocktail", "Virgin Aperol Spritz", 9], ["Mocktail", "Virgin Moscow Mule", 9], ["Mocktail", "Virgin Piña Colada", 9],
  ["Longdrink", "Vodka Red Bull", 10], ["Longdrink", "Vodka Orange", 9], ["Longdrink", "Cuba Libre", 10], ["Longdrink", "Rum Cola", 9], ["Longdrink", "Whisky Cola", 9], ["Longdrink", "Malibu Cola", 9], ["Longdrink", "Malibu Pineapple", 9], ["Longdrink", "Bacardi Lemon", 9], ["Longdrink", "Passoa Orange", 9], ["Longdrink", "Pisang Orange", 9], ["Longdrink", "Safari Orange", 9], ["Longdrink", "Jägermeister Red Bull", 10],
  ["Shot", "Tequila", 4], ["Shot", "Jägermeister", 4], ["Shot", "Sambuca", 4], ["Shot", "Fireball", 4], ["Shot", "Limoncello", 4], ["Shot", "Sourz", 4],
  ["Warm", "Koffie", 3.2], ["Warm", "Espresso", 3], ["Warm", "Cappuccino", 3.8], ["Warm", "Latte Macchiato", 4.5], ["Warm", "Flat White", 4.5], ["Warm", "Koffie verkeerd", 4], ["Warm", "Decafé koffie", 3.2], ["Warm", "Thee", 3.2], ["Warm", "Chai Latte", 4.8], ["Warm", "Warme chocolademelk", 4.5], ["Warm", "Irish Coffee", 9.5], ["Warm", "Hasseltse koffie", 9.5],
]
const FAVS = new Set(["Pils", "Duvel", "Cola", "Water plat", "Cava", "Huiswijn rood", "Gin Tonic", "Aperol Spritz", "Koffie", "Jupiler 0.0"])
// Vaste festival-coinprijzen (standaard) — bijstelbaar per 0,1 in de app.
const PILS = new Set(["Pils", "Jupiler 0.0", "Stella Artois 0.0", "Carlsberg 0.0", "Corona Cero", "Hoegaarden 0.0", "Leffe 0.0 Blond", "Sportzot", "Vedett Extra Blond 0.0"])
const COIN3 = new Set(["Champagne", "Irish Coffee", "Hasseltse koffie"])
const coinDefault = (cat: Cat, name: string): number => {
  if (name === "Red Bull") return 1.5
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
const DEMO_DRINKS: Drink[] = DATA.map(([cat, name, price], i) => ({ id: "d" + i, name, emoji: CAT_EMOJI[cat], cat, price, cup: CUPCAT[cat], fav: FAVS.has(name), coins: coinDefault(cat, name) }))

type Assign = Record<string, Record<string, number>>
type Anon = Record<string, number>
type Round = { orders: Assign; anon: Anon; payer: string; amount: number; potPart: number; gaveBack: Record<string, number> }

const euro = (v: number) => "€" + v.toFixed(2).replace(".", ",")

export default function PartyTest() {
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
  const [drinks, setDrinks] = useState<Drink[]>(DEMO_DRINKS)
  const [potRounds, setPotRounds] = useState<{ id: number; amounts: Record<string, number> }[]>([])
  const [potDraft, setPotDraft] = useState<Record<string, number>>({})
  const [everyoneDraft, setEveryoneDraft] = useState<string>("")
  const [everyoneChoice, setEveryoneChoice] = useState<number | "custom" | null>(null)
  const [editPotId, setEditPotId] = useState<number | null>(null)
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
  const [hasSettled, setHasSettled] = useState(false)

  const [showAssignAll, setShowAssignAll] = useState(false)
  const [assignMode, setAssignMode] = useState<"drink" | "person">("drink")
  const [showCups, setShowCups] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [cupsChecked, setCupsChecked] = useState(false)
  const [cupsTouched, setCupsTouched] = useState(false)
  const [amountDraft, setAmountDraft] = useState<string>("")
  const [payPot, setPayPot] = useState(false)
  const [payPerson, setPayPerson] = useState<string>("")
  const [potAmtDraft, setPotAmtDraft] = useState<string>("")
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [confirmDlg, setConfirmDlg] = useState<{ msg: string; yes: string; onYes: () => void; onNo?: () => void; variant?: "danger" } | null>(null)
  const [notice, setNotice] = useState<string>("")

  // edit-in-hub
  const [editAssign, setEditAssign] = useState(false)
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
  const bump = (did: string, pid: string, delta: number) => setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: Math.max(0, (c[did]?.[pid] ?? 0) + delta) } }))
  const bumpAnon = (did: string, delta: number) => setCartAnon((a) => ({ ...a, [did]: Math.max(0, (a[did] ?? 0) + delta) }))
  const assignTap = (did: string, pid: string) => { if ((cartAnon[did] ?? 0) > 0) { bumpAnon(did, -1); bump(did, pid, 1) } else bump(did, pid, 1) }
  const setEachOne = (did: string) => setCart((c) => ({ ...c, [did]: Object.fromEntries(people.map((p) => [p.id, 1])) }))
  const eachOne = (did: string) => { const hi = people.filter((p) => (cart[did]?.[p.id] ?? 0) >= 2).map((p) => p.name); if (hi.length > 0) { setConfirmDlg({ msg: `${hi.join(" en ")} ${hi.length === 1 ? "heeft" : "hebben"} er nu al 2 of meer. Met "elk 1" krijgt iedereen er precies één — ${hi.join(" en ")} ${hi.length === 1 ? "gaat" : "gaan"} dus terug naar 1.`, yes: "Ja, iedereen op 1", onYes: () => { setEachOne(did); setConfirmDlg(null) } }) } else setEachOne(did) }
  const drinkTotal = (did: string) => Object.values(cart[did] ?? {}).reduce((a, b) => a + b, 0) + (cartAnon[did] ?? 0)
  const roundItems = useMemo(() => drinks.reduce((s, d) => s + drinkTotal(d.id), 0), [cart, cartAnon, drinks]) // eslint-disable-line
  const unassignedTotal = useMemo(() => drinks.reduce((s, d) => s + (cartAnon[d.id] ?? 0), 0), [cartAnon, drinks]) // eslint-disable-line
  const pickedUpOf = (pid: string) => drinks.reduce((a, d) => a + (d.cup ? aQty(d.id, pid) : 0), 0)

  // ── per-rondje bewerk-helpers (hub) ─────────────────────────────────────────
  const rBump = (idx: number, did: string, pid: string, delta: number) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, orders: { ...r.orders, [did]: { ...(r.orders[did] ?? {}), [pid]: Math.max(0, (r.orders[did]?.[pid] ?? 0) + delta) } } } : r))
  const rBumpAnon = (idx: number, did: string, delta: number) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, anon: { ...r.anon, [did]: Math.max(0, (r.anon[did] ?? 0) + delta) } } : r))
  const rSetGaveBack = (idx: number, pid: string, v: number) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, gaveBack: { ...r.gaveBack, [pid]: Math.max(0, v) } } : r))
  const rUnassign = (idx: number, did: string, pid: string) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, orders: { ...r.orders, [did]: { ...(r.orders[did] ?? {}), [pid]: Math.max(0, (r.orders[did]?.[pid] ?? 0) - 1) } }, anon: { ...r.anon, [did]: (r.anon[did] ?? 0) + 1 } } : r))
  const rAssignFromAnon = (idx: number, did: string, pid: string) => { if ((rounds[idx]?.anon[did] ?? 0) > 0) { rBumpAnon(idx, did, -1); rBump(idx, did, pid, 1) } }
  const rSetAmount = (idx: number, v: number) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, amount: v, potPart: (r.payer === "" && (r.potPart || 0) > 0) ? v : (r.potPart || 0) } : r))
  const rPickPot = (idx: number) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, payer: "", potPart: r.amount } : r))
  const rPickPerson = (idx: number, pid: string) => setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, payer: pid, potPart: 0 } : r))

  // ── afgeleide bekers (uit rounds) ───────────────────────────────────────────
  const roundPicked = (r: Round, pid: string) => drinks.reduce((a, d) => a + (d.cup ? (r.orders[d.id]?.[pid] ?? 0) : 0), 0)
  const cupsBal = (pid: string) => rounds.reduce((s, r) => s + (roundPicked(r, pid) - (r.gaveBack[pid] || 0)), 0)

  const isGuestDefault = (name: string) => /^Gast \d+$/.test(name.trim())
  const addPerson = () => setPeople((ps) => [...ps, { id: "p" + Date.now() + Math.floor(Math.random() * 1000), name: "Gast " + (ps.length + 1) }])
  const renamePerson = (id: string, name: string) => setPeople((ps) => ps.map((x) => x.id === id ? { ...x, name } : x))
  const personHasDrinks = (pid: string) => rounds.some((r) => Object.values(r.orders).some((o) => (o?.[pid] ?? 0) > 0)) || Object.values(cart).some((o) => (o?.[pid] ?? 0) > 0)
  const removePerson = (id: string) => { const pp = people.find((x) => x.id === id); if (personHasDrinks(id)) { setNotice(`${pp?.name || "Deze persoon"} heeft al drankjes in een rondje en kan niet verwijderd worden. Verwijder eerst die drankjes.`); return } setPeople((ps) => ps.filter((x) => x.id !== id)) }
  const removeLastPerson = () => { const last = people[people.length - 1]; if (!last) return; removePerson(last.id) }
  const setEveryoneAmt = (v: number) => setPotDraft(Object.fromEntries(people.map((p) => [p.id, v])))
  const resetPotDraft = () => { setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft("") }
  const closePot = () => {
    const added = (editPotId === null && potDraftTotal > 0.001) ? potDraftTotal : 0
    if (added > 0) setPotRounds((rs) => [...rs, { id: Date.now(), amounts: potDraft }])
    setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setEditPotId(null); setPotBuilderOpen(false); setShowPot(false)
    if (onbPotActive) {
      setOnbPotActive(false)
      const willHave = potContribTotal + added
      if (potChosen && willHave <= 0.005) {
        setConfirmDlg({ msg: `Je koos voor een ${potIsCard ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch zonder verder gaan? Je kan later nog toevoegen via de knop bovenaan.`, yes: `Toch verder zonder ${potIsCard ? "drankkaart" : "pot"}`, onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("settings") }, onNo: () => { setConfirmDlg(null); setShowPot(true); setOnbPotActive(true) } })
        return
      }
      setView("settings")
    }
  }
  const applyCard = (ids: string[], valStr: string) => { const val = parseFloat((valStr || "").replace(",", ".")) || 0; const d: Record<string, number> = {}; if (val > 0 && ids.length > 0) { const per = val / ids.length; ids.forEach((id) => (d[id] = per)) } setPotDraft(d); setEveryoneChoice(null) }
  const toggleCardPayer = (id: string) => { const next = cardPayers.includes(id) ? cardPayers.filter((x) => x !== id) : [...cardPayers, id]; setCardPayers(next); applyCard(next, cardValue) }
  const cardSelectAll = () => { const all = people.map((p) => p.id); setCardPayers(all); applyCard(all, cardValue) }
  const editPotRound = (id: number) => { const r = potRounds.find((x) => x.id === id); if (!r) return; setEditPotId(id); setPotDraft({ ...r.amounts }); setEveryoneChoice(null); setEveryoneDraft("") }
  const saveEditPot = () => { if (editPotId === null) return; if (potDraftTotal > 0.001) setPotRounds((rs) => rs.map((r) => r.id === editPotId ? { ...r, amounts: potDraft } : r)); else setPotRounds((rs) => rs.filter((r) => r.id !== editPotId)); setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setPotBuilderOpen(false) }
  const cancelEditPot = () => { setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setPotBuilderOpen(false) }
  const removePotRound = (id: number, label: string) => setConfirmDlg({ msg: `De ${label} verwijderen uit de pot? Dit kan niet ongedaan gemaakt worden.`, yes: "Ja, verwijderen", onYes: () => { setPotRounds((rs) => rs.filter((r) => r.id !== id)); setConfirmDlg(null) } })
  const catsPresent = CATS.filter((c) => drinks.some((d) => d.cat === c))
  const bump1 = (did: string) => bumpAnon(did, 1)
  const bumpDown = (did: string) => { if ((cartAnon[did] ?? 0) > 0) { bumpAnon(did, -1); return } const entry = cart[did]; if (!entry) return; const pid = Object.keys(entry).find((k) => (entry[k] ?? 0) > 0); if (pid) bump(did, pid, -1) }
  const firstUnassigned = () => drinks.find((d) => (cartAnon[d.id] ?? 0) > 0)

  const goStart = () => { if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.", yes: "Toch verlaten — bestelling kwijt", onYes: () => { setConfirmDlg(null); setView("start") } }); else setView("start") }
  const goHome = () => { setFromOnboarding(false); if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.", yes: "Toch verlaten — bestelling kwijt", onYes: () => { setConfirmDlg(null); setView("settings") } }); else setView("settings") }
  const paymentState = () => {
    const total = parseFloat(amountDraft.replace(",", ".")) || 0
    const potFilled = potAmtDraft.trim() !== ""
    const potAmt = parseFloat(potAmtDraft.replace(",", ".")) || 0
    const split = payPot && !!payPerson
    const potOnly = payPot && !payPerson
    const personOnly = !payPot && !!payPerson
    const potContribToRound = potOnly ? total : split ? potAmt : 0
    const curPotPart = rounds.length ? (rounds[rounds.length - 1].potPart || 0) : 0
    const potAvail = potContribTotal - (potSpent - curPotPart)
    const potOver = potContribToRound > potAvail + 0.001
    const personRest = split ? total - potAmt : personOnly ? total : 0
    let valid = true, reason = ""
    if (total <= 0) { valid = false; reason = "Vul eerst exact betaald bedrag in." }
    else if (!payPot && !payPerson) { valid = false; reason = "Kies wie betaalde." }
    else if (split && !potFilled) { valid = false; reason = "Vul eerst het pot-bedrag in." }
    else if (split && potAmt > total + 0.0001) { valid = false; reason = "Het pot-bedrag is hoger dan het totaal." }
    const zeroPot = valid && split && potAmt <= 0.0001
    const zeroPerson = valid && split && Math.abs(personRest) <= 0.0001
    return { total, potFilled, potAmt, split, potOnly, personOnly, potContribToRound, potAvail, potOver, personRest, valid, reason, zeroPot, zeroPerson }
  }
  const goHub = () => { const to = () => { setOpenRound(rounds.length - 1); setEditAssign(false); setEditCups(false); setEditPay(false); setView("hub") }; if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.", yes: "Toch verlaten — bestelling kwijt", onYes: () => { setConfirmDlg(null); to() } }); else to() }
  const applyBeginChoices = () => {
    if (bpPotType === "yes") { setNotice("Kies pot of drankkaart — of zet de pot op nee."); return }
    setOnboardedOnce(true)
    const potOn = bpPotType === "pot" || bpPotType === "card"
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
    if (people.length === 0) { setNotice("Voeg eerst minstens één persoon toe."); return }
    if (depositOn && (depositValue || 0) <= 0) { setNotice("Vul het waarborgbedrag per beker in — of zet bekers op ‘uit’."); return }
    if (pay === "coin" && (coinValue || 0) <= 0) { setNotice("Vul de coin-waarde in (1 coin = €…) — of zet coins op ‘uit’."); return }
    if (potChosen && potContribTotal <= 0.005) { setConfirmDlg({ msg: `Je koos voor een ${potIsCard ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch zonder verder gaan? Je kan later nog toevoegen via de knop bovenaan.`, yes: `Toch verder zonder ${potIsCard ? "drankkaart" : "pot"}`, onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("hub") } }); return }
    setView("hub")
  }
  const goFinal = () => { if (rounds.length === 0) { setNotice("Er zijn nog geen rondjes om af te rekenen. Start eerst een rondje."); return } if (anyUnassignedRounds) { const tot = rounds.reduce((s, r) => s + drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0), 0); setNotice(`Er ${tot === 1 ? "is 1 drankje" : `zijn ${tot} drankjes`} nog zonder naam. Wijs ze eerst toe (rood aangeduid in het overzicht) voor je afrekent.`); const fr = rounds.findIndex((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0)); if (fr >= 0) { setOpenRound(fr); setEditAssign(true); setEditCups(false); setEditPay(false); setView("hub") } return } setHasSettled(true); setView("final") }
  const openClose = () => { setAmountDraft(""); setShowClose(true) }
  const goAssignFromWarning = () => { setShowClose(false); setAssignMode("drink"); setShowAssignAll(true) }
  const commitRound = () => {
    const effGb: Record<string, number> = {}
    people.forEach((p) => { effGb[p.id] = gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id)) })
    setRounds((r) => [...r, { orders: cart, anon: cartAnon, payer: "", amount: 0, potPart: 0, gaveBack: effGb }])
    setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setAmountDraft(""); setPayPot(false); setPayPerson(""); setPotAmtDraft(""); setPaidConfirmed(false); setView("confirmed")
  }
  const applyPayment = (payer: string, potPart: number, total: number) => setRounds((rs) => rs.map((r, i) => i === rs.length - 1 ? { ...r, payer, amount: total, potPart } : r))
  const editOrder = () => { const last = rounds[rounds.length - 1]; if (!last) { setView("order"); return } setCart(last.orders); setCartAnon(last.anon); setGaveBackDraft(last.gaveBack); setRounds((rs) => rs.slice(0, -1)); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setPaidConfirmed(false); setActiveCat(catsPresent[0]); setView("order") }
  const confirmPayment = () => {
    const st = paymentState()
    if (!st.valid) { setNotice(st.reason); return }
    const personName = people.find((p) => p.id === payPerson)?.name ?? "die persoon"
    if (st.zeroPot) { setConfirmDlg({ msg: `De pot betaalt €0 — dan betaalt ${personName} het volledige bedrag (${euro(st.total)}). Zo bevestigen?`, yes: "Ja, bevestigen", onYes: () => { applyPayment(payPerson, 0, st.total); setPayPot(false); setPotAmtDraft(""); setPaidConfirmed(true); setConfirmDlg(null) } }); return }
    if (st.zeroPerson) { setConfirmDlg({ msg: `${personName} betaalt €0 — dan betaalt de pot alles (${euro(st.total)}). Zo bevestigen?`, yes: "Ja, bevestigen", onYes: () => { applyPayment("", st.total, st.total); setPayPerson(""); setPaidConfirmed(true); setConfirmDlg(null) } }); return }
    const potPart = st.potOnly ? st.total : st.split ? st.potAmt : 0
    applyPayment(payPerson || "", potPart, st.total)
    setPaidConfirmed(true)
  }
  const closeRound = () => { if (!paidConfirmed || !paymentState().valid) { setNotice("Bevestig eerst de betaling."); return } setOpenRound(rounds.length - 1); setEditAssign(false); setEditCups(false); setEditPay(false); setView("hub") }
  const cancelRound = () => setConfirmDlg({ msg: `Het volledige rondje ${roundNr} annuleren? Alle drankjes en bekers van dit rondje worden verwijderd. Dit kan niet ongedaan gemaakt worden.`, yes: "Ja, annuleren", onYes: () => { const remaining = rounds.length - 1; setRounds((rs) => rs.slice(0, -1)); setPaidConfirmed(false); setConfirmDlg(null); if (remaining > 0) { setOpenRound(remaining - 1); setView("hub") } else setView("order") } })
  const nextRound = () => { setRoundNr((n) => n + 1); setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setCart({}); setCartAnon({}); setView("order") }

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
  const paidByPerson = (pid: string) => rounds.reduce((s, r) => { if (r.payer !== pid) return s; const cupSum = depositOn ? people.reduce((a, pp) => a + roundCupEur(r, pp.id), 0) : 0; return s + (r.amount - (r.potPart || 0)) + cupSum }, 0)
  const settlement = useMemo(() => {
    const paid: Record<string, number> = {}; people.forEach((p) => (paid[p.id] = 0)); let potPaid = 0
    rounds.forEach((r) => {
      const cupSum = depositOn ? people.reduce((a, p) => a + roundCupEur(r, p.id), 0) : 0
      const potPart = r.potPart || 0
      const personPart = r.amount - potPart
      if (r.payer) { paid[r.payer] = (paid[r.payer] ?? 0) + personPart + cupSum; potPaid += potPart }
      else if (potPart > 0) { potPaid += potPart + cupSum }
    })
    const nets: { id: string; label: string; net: number }[] = people.map((p) => ({ id: p.id, label: p.name, net: (paid[p.id] ?? 0) + contribOf(p.id) - consumption(p.id) - cupOwn(p.id) - cardLossPer }))
    if (potContribTotal > 0 || potSpent > 0) nets.push({ id: "pot", label: "de pot", net: potPaid - potContribTotal + (potIsCard ? Math.max(0, potRemaining) : 0) })
    const creditors = nets.filter((n) => n.net > 0.005).map((n) => ({ ...n })).sort((a, b) => b.net - a.net)
    const debtors = nets.filter((n) => n.net < -0.005).map((n) => ({ ...n, net: -n.net })).sort((a, b) => b.net - a.net)
    const tx: { from: string; to: string; amount: number }[] = []; let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) { const amt = Math.min(debtors[i].net, creditors[j].net); tx.push({ from: debtors[i].label, to: creditors[j].label, amount: amt }); debtors[i].net -= amt; creditors[j].net -= amt; if (debtors[i].net < 0.005) i++; if (creditors[j].net < 0.005) j++ }
    return { tx }
  }, [rounds, people, potRounds, potContribTotal, potSpent, potIsCard, potRemaining, depositOn, depositValue, depositUnit, coinValue, drinks, pay]) // eslint-disable-line
  const anyUnassignedRounds = rounds.some((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
  const drinkTotalRound = (r: Round, did: string) => Object.values(r.orders[did] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[did] ?? 0)
  const paidLabel = (r: Round) => {
    const potP = r.potPart || 0
    const person = r.payer ? (people.find((p) => p.id === r.payer)?.name ?? "?") : null
    if (potP > 0 && person) return `pot ${euro(potP)} + ${person} ${euro(r.amount - potP)}`
    if (potP > 0) return "uit de pot"
    if (person) return `door ${person}`
    return "nog niet betaald"
  }

  const S = {
    page: { minHeight: "100vh", background: "#fdf6e3", color: "#4a3f1e", fontFamily: "system-ui,-apple-system,sans-serif", padding: "0 0 90px" } as React.CSSProperties,
    wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 14px" } as React.CSSProperties,
    card: { background: "#fff", border: "1px solid rgba(120,95,20,0.14)", borderRadius: 18, padding: 14, marginBottom: 12, boxShadow: "0 4px 16px -8px rgba(120,95,20,0.25)" } as React.CSSProperties,
    h1: { fontSize: 22, fontWeight: 800, margin: "0 0 2px" } as React.CSSProperties,
    h3: { fontSize: 15, fontWeight: 800, margin: "0 0 10px" } as React.CSSProperties,
    sub: { fontSize: 12.5, color: "#8a7d55", margin: "0 0 12px", lineHeight: 1.5 } as React.CSSProperties,
    btn: { border: "1px solid rgba(120,95,20,0.18)", background: "#fff", color: "#4a3f1e", borderRadius: 12, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
    btnP: { border: "none", background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", borderRadius: 14, padding: "14px 18px", fontSize: 16, fontWeight: 800, cursor: "pointer", width: "100%", boxShadow: "0 4px 12px -4px rgba(224,138,0,0.6)" } as React.CSSProperties,
    input: { border: "1px solid rgba(120,95,20,0.22)", borderRadius: 10, padding: "9px 11px", fontSize: 15, color: "#4a3f1e", outline: "none", width: 80, textAlign: "right" } as React.CSSProperties,
    seg: (on: boolean) => ({ flex: 1, textAlign: "center", padding: "9px 6px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#f3ead2", color: on ? "#fff" : "#8a7d55" } as React.CSSProperties),
    step: { width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(120,95,20,0.18)", background: "#f3ead2", color: "#8a5e0f", fontSize: 19, fontWeight: 800, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
    chip: (n: number) => ({ position: "relative", padding: "8px 13px", borderRadius: 20, fontSize: 14, fontWeight: 700, cursor: "pointer", userSelect: "none", border: n > 0 ? "1px solid rgba(240,165,0,0.5)" : "1px solid rgba(120,95,20,0.15)", background: n > 0 ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#faf4e4", color: n > 0 ? "#fff" : "#8a7d55" } as React.CSSProperties),
    badge: { marginLeft: 5, background: "rgba(0,0,0,0.22)", borderRadius: 20, padding: "0 6px", fontSize: 11, fontWeight: 800 } as React.CSSProperties,
    pill: { fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "rgba(120,95,20,0.08)", color: "#8a7d55" } as React.CSSProperties,
    row: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
    tab: (on: boolean) => ({ padding: "8px 13px", borderRadius: 20, fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", background: on ? "#4a3f1e" : "#f3ead2", color: on ? "#fff" : "#8a7d55" } as React.CSSProperties),
    overlay: { position: "fixed", inset: 0, background: "rgba(40,30,5,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 12 } as React.CSSProperties,
    sheet: { background: "#fff", borderRadius: 20, padding: 18, width: "100%", maxWidth: 460, maxHeight: "82vh", overflowY: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,0.2)" } as React.CSSProperties,
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
          <div onClick={() => setPotIsCard(false)} style={{ ...S.seg(!potIsCard), padding: "7px 6px", fontSize: 12.5, opacity: !potIsCard ? 1 : 0.5 }}>🫙 Pot (geld)</div>
          <div onClick={() => setPotIsCard(true)} style={{ ...S.seg(potIsCard), padding: "7px 6px", fontSize: 12.5, opacity: potIsCard ? 1 : 0.5 }}>💳 Drankkaart</div>
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
                  <span style={{ fontSize: 12, color: "#c98a00", fontWeight: 800 }}>✏️ wordt bewerkt ↓</span>
                ) : rounds.length === 0 ? (
                  <div style={{ ...S.row, gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#8a5e0f", cursor: "pointer", fontWeight: 700 }} onClick={() => editPotRound(r.id)}>✏️ wijzig</span>
                    <span style={{ fontSize: 12, color: "#c0554a", cursor: "pointer", fontWeight: 700 }} onClick={() => removePotRound(r.id, `${i + 1}e inleg`)}>✕ verwijder</span>
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
            <span style={{ fontSize: 13, fontWeight: 700 }}>Kaartwaarde</span>
            <div style={{ ...S.row, gap: 4 }}><span style={{ fontSize: 13, color: "#8a7d55", fontWeight: 700 }}>€</span><input style={{ ...S.input, width: 70 }} type="text" inputMode="decimal" placeholder="15" value={cardValue} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setCardValue(v); applyCard(cardPayers, v) }} /></div>
          </div>
          <div style={{ fontSize: 12, color: "#8a7d55", fontWeight: 700, marginBottom: 6 }}>Wie kocht de kaart? (tik aan — bedrag verschijnt vanzelf)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            <span onClick={cardSelectAll} style={{ ...S.pill, cursor: "pointer", fontSize: 12.5, padding: "6px 12px", background: "rgba(31,138,76,0.14)", color: "#1f8a4c", fontWeight: 800, border: "1px dashed rgba(31,138,76,0.5)" }}>👥 verdeel over iedereen</span>
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
            <span style={{ fontSize: 12, color: "#8a7d55", fontWeight: 700 }}>iedereen evenveel</span>
            <span style={{ fontSize: 11.5, color: "#c0554a", fontWeight: 700, cursor: "pointer" }} onClick={resetPotDraft}>↺ reset inleg</span>
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {[5, 10, 20, 30].map((v) => {
              const on = everyoneChoice === v
              return <button key={v} style={{ ...S.btn, padding: "5px 12px", fontSize: 13, background: on ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: on ? "#fff" : "#4a3f1e", border: on ? "none" : "1px solid rgba(120,95,20,0.18)" }} onClick={() => { setEveryoneChoice(v); setEveryoneDraft(""); setEveryoneAmt(v) }}>€{v}</button>
            })}
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: "#8a7d55" }}>of eigen bedrag:</span>
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
          <button style={{ ...S.btnP, marginTop: 14 }} onClick={closePot}>{potDraftTotal > 0 ? `✓ Inleg toevoegen (${euro(potDraftTotal)})` : "Klaar"}</button>
        )}
        </>
        ) : (
          <div>
            <button style={{ ...S.btnP, marginTop: 4 }} onClick={() => setPotBuilderOpen(true)}>➕ Inleg pot toevoegen</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={closePot}>Klaar</button>
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
            <h3 style={{ ...S.h3, fontSize: 17 }}>Even bevestigen</h3>
            <p style={{ fontSize: 13.5, color: "#4a3f1e", lineHeight: 1.5, marginBottom: 16 }}>{confirmDlg.msg}</p>
            {confirmDlg.variant === "danger" ? (
              <>
                <button style={{ ...S.btnP, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)", boxShadow: "none" }} onClick={() => setConfirmDlg(null)}>← Terug, rondje afmaken</button>
                <button style={{ background: "none", border: "none", width: "100%", marginTop: 10, fontSize: 12.5, color: "#c0554a", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
              </>
            ) : (
              <>
                <button style={{ ...S.btnP, background: "linear-gradient(135deg,#e0685c,#c0554a)", boxShadow: "none" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
                <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => { const f = confirmDlg?.onNo; setConfirmDlg(null); f && f() }}>← terug</button>
              </>
            )}
          </div>
        </div>
      )}
      {notice && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setNotice("")}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 14, color: "#4a3f1e", lineHeight: 1.5, marginBottom: 16, fontWeight: 600 }}>{notice}</p>
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
            <div style={{ ...S.row, gap: 5, marginTop: 2 }}><CheersIcon size={16} color="#4a3f1e" /><span style={{ fontSize: 11.5, color: "#4a3f1e", fontWeight: 700 }}>Rondjes en splitten zonder gedoe!</span></div>
          </div>
        </div>
        {!onboarding && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 0, flexShrink: 0 }}>
            {groupName.trim() && <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a5e0f", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName.trim()}</div>}
            {potTag}
          </div>
        )}
      </div>
      {!onboarding && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={{ ...S.btn, flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 700 }} onClick={goHome}>⚙️ Groep</button>
          <button style={{ ...S.btn, flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 700, opacity: view === "hub" ? 0.55 : 1 }} onClick={goHub}>📋 Overzicht</button>
          <button style={{ ...S.btn, flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 700, opacity: view === "final" ? 0.55 : 1 }} onClick={goFinal}>🧾 Afrekenen</button>
        </div>
      )}
    </div>
    )
  }

  // ── START ───────────────────────────────────────────────────────────────────
  if (view === "start") {
    return (
      <div style={S.page}><div style={{ ...S.wrap, paddingTop: 40 }}>
        {renderDialogs()}
        <style>{`input::placeholder,textarea::placeholder{color:#c4b896;opacity:1;}`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div style={{ ...S.row, gap: 12 }}>
            <RundoLogo size={56} />
            <div style={{ ...S.h1, fontSize: 30, letterSpacing: "-0.02em" }}>Rundo <span style={{ color: "#e08a00" }}>Party</span></div>
          </div>
          <div style={{ ...S.row, gap: 7, marginTop: 8 }}><CheersIcon size={20} color="#4a3f1e" /><span style={{ fontSize: 14, color: "#4a3f1e", fontWeight: 700 }}>Rondjes en splitten zonder gedoe!</span></div>
        </div>
        <div style={S.card}>
          <input style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontSize: 16, fontWeight: 700, marginBottom: 12, background: "#fdfaf2", padding: "13px 14px" }} type="text" placeholder="Typ je groepsnaam" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <button style={{ ...S.btnP, width: "100%", opacity: groupName.trim() ? 1 : 0.5 }} onClick={() => { if (!groupName.trim()) { setNotice("Geef je groep eerst een naam."); return } setView("setup") }}>Starten</button>
        </div>
        <div style={{ ...S.card, opacity: 0.6 }}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>📁 Opgeslagen groepen</span>
            <span style={{ fontSize: 11.5, color: "#8a7d55" }}>later beschikbaar</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", marginTop: 8, lineHeight: 1.5 }}>Groepen bewaren tussen sessies komt in de volledige app (met database).<br /><span style={{ fontSize: 10.5, color: "#b3a988" }}>📌 Live-reminder: groepen automatisch opruimen na inactiviteit, tenzij vastgezet (📌) om te bewaren.</span></div>
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
              <h3 style={{ ...S.h3, fontSize: 18, marginTop: 0, marginBottom: 4 }}>Voor we beginnen</h3>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#4a3f1e", marginBottom: 14 }}>Werk je met…</p>
              <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                <div style={{ ...S.row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>een gezamenlijke pot of drankkaart?</span>
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
              {[["♻️ herbruikbare bekers (met waarborg)", bpBekers, setBpBekers], ["🎟️ coins in plaats van euro's", bpCoins, setBpCoins]].map(([label, val, set]: any, i) => (
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
              <div style={{ fontSize: 11.5, color: "#8a7d55", margin: "12px 0 14px", lineHeight: 1.5 }}>💡 Later aanpasbaar via ⚙️ Groep. Zet je iets op ‘ja’, dan vul je de details zo meteen in.</div>
              <button style={{ ...S.btnP, width: "100%" }} onClick={applyBeginChoices}>{(bpPotType !== "none" || bpBekers || bpCoins) ? "Verdergaan" : "Snel starten"}</button>
            </div>
          </div>
        )}
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10 }}>👥 Aantal personen</h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <button style={{ ...S.step, width: 42, height: 42, fontSize: 22, opacity: people.length > 0 ? 1 : 0.4 }} onClick={removeLastPerson}>−</button>
            <span style={{ fontSize: 26, fontWeight: 800, minWidth: 34, textAlign: "center" }}>{people.length}</span>
            <button style={{ ...S.step, width: 42, height: 42, fontSize: 22, background: "linear-gradient(135deg,#f0a500,#e08a00)", color: "#fff", border: "none" }} onClick={addPerson}>+</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", textAlign: "center", marginTop: 10 }}>Namen zijn optioneel — pas ze aan wanneer je wil.</div>
        </div>

        <div style={S.card}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Personen</span> <span style={{ fontSize: 11.5, color: "#8a7d55", fontStyle: "italic" }}>tik op een naam om te hernoemen</span>
          </div>
          {people.length === 0 ? (
            <div style={{ textAlign: "center", color: "#b3a988", fontSize: 13, padding: "14px 0" }}>Nog geen personen</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 8 }}>
              {people.map((p, idx) => (
                <input key={p.id} value={isGuestDefault(p.name) ? "" : p.name} placeholder={isGuestDefault(p.name) ? p.name : `Gast ${idx + 1}`} onChange={(e) => renamePerson(p.id, e.target.value === "" ? `Gast ${idx + 1}` : e.target.value)} style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: "7px 9px", fontSize: 13, textAlign: "left" }} />
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 24, marginBottom: 4 }}>
          <button style={{ ...S.btnP, width: "80%" }} onClick={() => { if (people.length === 0) { setNotice("Voeg eerst minstens één persoon toe."); return } if (onboardedOnce) { setOpenRound(rounds.length - 1); setView("hub") } else setBeginPrompt(true) }}>Volgende</button>
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
          <input disabled={hasSettled} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Typ je groepsnaam" style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, background: hasSettled ? "#efe8d6" : "#fdfaf2", color: hasSettled ? "#8a7d55" : "#4a3f1e", cursor: hasSettled ? "not-allowed" : "text" }} />
        </div>
        {!fromOnboarding && (
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: people.length > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>👥 Personen</span>
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
          <h3 style={{ ...S.h3, margin: 0, fontSize: 13.5, lineHeight: 1.3, textAlign: "center" }}>♻️ Herbruikbare bekers <span onClick={(e) => { e.stopPropagation(); setDepositInfo((v) => !v); setCoinInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 10.5, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8, justifyContent: "center" }}>
            <div style={{ ...S.seg(!depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(false)}>uit</div>
            <div style={{ ...S.seg(depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(true)}>aan</div>
          </div>
          {depositInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 12, color: "#6b5f3a", lineHeight: 1.5 }}>♻️ <b>Herbruikbare bekers?</b> Voor events met waarborg per beker die je terugkrijgt bij inleveren. Zet aan om de borg mee te verrekenen.</div>}
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
                <span style={{ fontSize: 13, fontWeight: 700 }}>Waarborg/beker</span>
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
          {coinInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 12, color: "#6b5f3a", lineHeight: 1.5 }}>🎟️ <b>Coins?</b> Betaal je met coins i.p.v. euro's? Stel de coin-waarde en prijzen in; de app verdeelt eerlijk. Handig voor festivals, afterwork e.d.</div>}
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
                    <p style={{ ...S.sub, marginBottom: 8 }}>Standaard festival-coins per drankje. Pas aan met − / + (stapjes van 0,1, bv. 1,4). Verborgen tijdens bestellen.</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {catsPresent.map((cc) => <span key={cc} style={{ ...S.tab(coinCat === cc), padding: "6px 10px", fontSize: 12 }} onClick={() => setCoinCat(cc)}>{CAT_LABEL[cc]}</span>)}
                    </div>
                    <div style={{ ...S.row, gap: 8, marginBottom: 8 }}>
                      <div style={{ ...S.seg(!coinFull), padding: "7px 6px", fontSize: 12.5 }} onClick={() => setCoinFull(false)}>⚡ Korte lijst</div>
                      <div style={{ ...S.seg(coinFull), padding: "7px 6px", fontSize: 12.5 }} onClick={() => setCoinFull(true)}>📖 Volledige lijst</div>
                    </div>
                    {vis.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: "#8a7d55", textAlign: "center", padding: "10px 0" }}>Geen favorieten hier. <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setCoinFull(true)}>📖 toon alles</span></div>
                    ) : vis.map((d) => (
                      <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(120,95,20,0.06)" }}>
                        <span style={{ fontSize: 13 }}>{d.emoji} {d.name}</span>
                        <div style={{ ...S.row, gap: 5 }}>
                          <button style={{ ...S.step, width: 26, height: 26, fontSize: 16 }} onClick={() => setDrinks((ds) => ds.map((x) => x.id === d.id ? { ...x, coins: Math.max(0, +(x.coins - 0.1).toFixed(1)) } : x))}>−</button>
                          <span style={{ minWidth: 46, textAlign: "center", fontSize: 12.5, fontWeight: 800 }}>{d.coins.toFixed(1)} c</span>
                          <button style={{ ...S.step, width: 26, height: 26, fontSize: 16 }} onClick={() => setDrinks((ds) => ds.map((x) => x.id === d.id ? { ...x, coins: +(x.coins + 0.1).toFixed(1) } : x))}>+</button>
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
            ? <button style={{ ...S.btnP, width: "100%" }} onClick={() => { setOpenRound(rounds.length - 1); setView("hub") }}>Terug naar overzicht</button>
            : <button style={{ ...S.btnP, width: "100%" }} onClick={tryBegin}>Starten</button>}
        </div>
      </div></div>
    )
  }

  // ── ORDER ───────────────────────────────────────────────────────────────────
  if (view === "order") {
    const catDrinks = drinks.filter((d) => d.cat === activeCat)
    const catVisible = catDrinks.filter((d) => fullList || d.fav || drinkTotal(d.id) > 0)
    const needCups = depositOn && (people.some((p) => pickedUpOf(p.id) > 0) || people.some((p) => cupsBal(p.id) !== 0))
    const gaveBackTotal = people.reduce((a, p) => a + (gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id))), 0)
    const cupsBlock = needCups && !cupsChecked
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>Ronde {roundNr} <span style={{ fontSize: 13, fontWeight: 600, color: "#8a7d55" }}>— {roundItems} drankje{roundItems === 1 ? "" : "s"}</span></h3>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingBottom: 8, marginBottom: 8 }}>
          {catsPresent.map((c) => {
            const openHere = drinks.some((d) => d.cat === c && (cartAnon[d.id] ?? 0) > 0)
            return <span key={c} style={S.tab(activeCat === c)} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}{openHere && <span style={{ marginLeft: 5, color: "#e0685c", fontSize: 15 }}>●</span>}</span>
          })}
        </div>
        <div style={{ display: "inline-flex", marginBottom: 8, border: "1px solid rgba(120,95,20,0.2)", borderRadius: 10, overflow: "hidden" }}>
          <span onClick={() => setFullList(false)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", background: !fullList ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: !fullList ? "#fff" : "#8a7d55" }}>compacte lijst</span>
          <span onClick={() => setFullList(true)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", background: fullList ? "linear-gradient(135deg,#f0a500,#e08a00)" : "#fff", color: fullList ? "#fff" : "#8a7d55" }}>volledige lijst</span>
        </div>
        {catVisible.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "18px 12px", fontSize: 13, color: "#8a7d55" }}>
            Geen favorieten in {CAT_LABEL[activeCat]}. <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setFullList(true)}>📖 toon alles</span>
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
        {roundItems > 0 && (
          <div style={{ ...S.card, padding: "10px 12px", background: "#fffdf6" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#8a5e0f" }}>🛒 In dit rondje</span>
              <span style={{ ...S.pill, background: "rgba(240,165,0,0.18)", color: "#c98a00" }}>{roundItems} drankje{roundItems === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                const un = cartAnon[d.id] ?? 0
                return (
                  <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, background: "rgba(240,165,0,0.12)", border: "1px solid rgba(240,165,0,0.35)", color: "#4a3f1e", cursor: "pointer" }} onClick={() => { setAssignMode("drink"); setShowAssignAll(true) }}>
                    {d.emoji} {drinkTotal(d.id)}× {d.name}{un > 0 && <span style={{ color: "#c0554a", fontWeight: 800, textDecoration: "underline" }}>toewijzen</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {depositOn && <button style={{ ...S.btn, flex: 1 }} onClick={() => setShowCups(true)}>🫙 Bekers</button>}
          {rounds.length > 0 && <button style={{ ...S.btn, flex: 1 }} onClick={() => { setOpenRound(rounds.length - 1); setView("hub") }}>📋 Overzicht</button>}
        </div>
        <button style={{ ...S.btnP, opacity: roundItems === 0 ? 0.5 : 1 }} onClick={() => roundItems > 0 && openClose()}>✅ Rondje {roundNr} bevestigen{roundItems > 0 && <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85 }}> — {roundItems} drankje{roundItems === 1 ? "" : "s"}</span>}</button>

        {showAssignAll && (
          <div style={S.overlay} onClick={() => setShowAssignAll(false)}>
            <div style={{ ...S.sheet, maxHeight: "82vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ ...S.h3, margin: 0, fontSize: 18 }}>Toewijzen</h3>
                <div style={{ ...S.row, gap: 4 }}>
                  <div style={{ ...S.seg(assignMode === "drink"), padding: "6px 10px", fontSize: 12 }} onClick={() => setAssignMode("drink")}>per drank</div>
                  <div style={{ ...S.seg(assignMode === "person"), padding: "6px 10px", fontSize: 12 }} onClick={() => setAssignMode("person")}>per persoon</div>
                </div>
              </div>

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
                        {people.map((p) => { const n = aQty(d.id, p.id); return <span key={p.id} style={{ ...S.chip(n), fontSize: 12.5, padding: "5px 10px" }} onClick={() => assignTap(d.id, p.id)}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); bump(d.id, p.id, -1) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1 }}>−</span>}</span> })}
                        <span onClick={() => eachOne(d.id)} style={{ ...S.chip(0), fontSize: 12.5, padding: "5px 10px", border: "1.5px dashed #c98a00", background: "rgba(240,165,0,0.1)", color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>👥 elk 1</span>
                        {un > 0 && <span onClick={() => bumpAnon(d.id, -1)} style={{ ...S.chip(0), fontSize: 12.5, padding: "5px 10px", cursor: "pointer" }}>− zonder naam</span>}
                      </div>
                    </div>
                  )
                })
              ) : (
                people.map((p) => {
                  const took = drinks.filter((d) => (cart[d.id]?.[p.id] ?? 0) > 0)
                  return (
                    <div key={p.id} style={{ borderTop: "1px solid rgba(120,95,20,0.1)", paddingTop: 9, marginBottom: 9 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{p.name}{took.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#8a7d55" }}> · {took.reduce((a, d) => a + (cart[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => { const n = aQty(d.id, p.id); return <span key={d.id} style={{ ...S.chip(n), fontSize: 12.5, padding: "5px 10px" }} onClick={() => assignTap(d.id, p.id)}>{d.emoji} {d.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); bump(d.id, p.id, -1) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1 }}>−</span>}</span> })}
                      </div>
                    </div>
                  )
                })
              )}
              <button style={{ ...S.btnP, marginTop: 6 }} onClick={() => setShowAssignAll(false)}>Klaar</button>
            </div>
          </div>
        )}

        {showCups && (
          <div style={{ ...S.overlay, zIndex: 55 }} onClick={() => setShowCups(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 18 }}>🫙 Bekers — ronde {roundNr}</h3>
              <p style={{ ...S.sub }}>Hoeveel gaf elk <b>terug</b>? Standaard = ruil. Iedereen kan teruggeven — ook wie niks bestelde of een beker van elders binnenbrengt (gaat dan negatief = krijgt waarborg).</p>
              <button style={{ ...S.btn, width: "100%", marginBottom: 12, fontSize: 13 }} onClick={() => { setGaveBackDraft(Object.fromEntries(people.map((p) => [p.id, 0]))); setCupsChecked(true); setShowCups(false) }}>🚫 niemand gaf een beker terug</button>
              {people.map((p) => {
                const bal = cupsBal(p.id), pu = pickedUpOf(p.id)
                const gb = gaveBackDraft[p.id] ?? Math.min(bal, pu)
                const newBal = bal + pu - gb
                return (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                    <div><div style={{ fontSize: 15, fontWeight: 800 }}>{p.name}</div><div style={{ fontSize: 11.5, fontWeight: 700, color: newBal < 0 ? "#1f8a4c" : "#8a7d55" }}>beker-saldo: {newBal}{newBal < 0 ? " (krijgt waarborg)" : ""}</div></div>
                    <div style={{ ...S.row, gap: 7 }}>
                      <span style={{ fontSize: 11, color: "#8a7d55" }}>gaf terug</span>
                      <button style={{ ...S.step, width: 28, height: 28, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: Math.max(0, gb - 1) })) }}>−</button>
                      <span style={{ minWidth: 16, textAlign: "center", fontSize: 15, fontWeight: 800 }}>{gb}</span>
                      <button style={{ ...S.step, width: 28, height: 28 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: gb + 1 })) }}>+</button>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={{ ...S.btn, flex: 1 }} onClick={() => setShowCups(false)}>← terug</button>
                <button style={{ ...S.btnP, flex: 2, opacity: cupsTouched ? 1 : 0.5 }} onClick={() => { if (cupsTouched) { setCupsChecked(true); setShowCups(false) } }}>Klaar</button>
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
                  ⚠️ <b>{unassignedTotal} drankje{unassignedTotal === 1 ? "" : "s"} nog niet toegewezen.</b> Worden anders gelijk gedeeld. <u>Tik hier om toe te wijzen →</u>
                </div>
              )}
              {depositOn && (cupsBlock ? (
                <div style={{ background: "rgba(224,104,92,0.12)", border: "1.5px solid rgba(224,104,92,0.6)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div onClick={() => setShowCups(true)} style={{ fontSize: 12.5, color: "#b0402f", cursor: "pointer", fontWeight: 700 }}>🫙 <b>Bekers nog niet aangeduid.</b> <u>Tik hier om te regelen →</u></div>
                  <div onClick={() => setDepositOn(false)} style={{ fontSize: 11.5, color: "#8a7d55", cursor: "pointer", marginTop: 6 }}>… of <u>ga verder zonder bekers/waarborg</u> (uitschakelen).</div>
                </div>
              ) : (
                <div style={{ ...S.row, justifyContent: "space-between", background: "rgba(31,138,76,0.1)", borderRadius: 12, padding: "9px 12px", marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, color: "#1f8a4c", fontWeight: 700 }}>🫙 {gaveBackTotal > 0 ? `${gaveBackTotal} beker${gaveBackTotal === 1 ? "" : "s"} teruggegeven ✓` : "0 bekers meegegeven ✓"}</span>
                  <button style={{ ...S.btn, padding: "4px 10px", fontSize: 11.5 }} onClick={() => setShowCups(true)}>aanpassen</button>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: "#8a7d55", marginBottom: 14 }}>Na bevestigen mag iemand gaan halen. Het betaalde bedrag vul je <b>daarna</b> in.</div>
              <button style={{ ...S.btnP, opacity: cupsBlock ? 0.5 : 1 }} onClick={() => !cupsBlock && commitRound()}>✅ Bevestig rondje ({roundItems} drankje{roundItems === 1 ? "" : "s"})</button>
              <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => setShowClose(false)}>← terug</button>
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
    const personRest = st.split ? st.total - st.potAmt : 0
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={S.card}>
          <div style={{ ...S.row, gap: 9, marginBottom: 4 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🍻</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Ronde {roundNr} bevestigd — {items} drankjes</div>
              <div style={{ fontSize: 13, color: "#e08a00", fontWeight: 800 }}>👉 Iemand mag gaan halen!</div>
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
                  const un = last!.anon[d.id] ?? 0
                  return <div key={d.id} style={{ fontSize: 13.5 }}><b>{d.emoji} {n}× {d.name}</b> <span style={{ color: "#8a7d55" }}>→ {who.join(", ")}{un > 0 ? `${who.length ? ", " : ""}${un}× onbekend` : ""}</span></div>
                })}
              </div>
            )
          })()}
          <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", marginTop: 8, paddingTop: 8, fontSize: 14, fontWeight: 800, textAlign: "right" }}>Totaal: {items} drankje{items === 1 ? "" : "s"}</div>
        </div>

        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>💰 Exact bedrag betaald voor dit rondje?</div>
          <div style={{ ...S.row, gap: 8, justifyContent: "center", margin: "2px 0" }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>€</span>
            <input style={{ ...S.input, width: 120, fontSize: 22, textAlign: "center", fontWeight: 800 }} type="text" inputMode="decimal" placeholder="0,00" value={amountDraft} onChange={(e) => { setAmountDraft(e.target.value.replace(/[^0-9.,]/g, "")); setPaidConfirmed(false) }} />
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", textAlign: "center", marginBottom: 14 }}>ⓘ hierop verdeelt de app eerlijk (Fair Split)</div>

          {(parseFloat(amountDraft.replace(",", ".")) || 0) > 0 ? (
          <>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a7d55", marginBottom: 7 }}>Betaald door</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            <span style={S.chip(payPot ? 1 : 0)} onClick={() => { setPayPot((v) => !v); setPaidConfirmed(false) }}>{potIsCard ? "💳 drankkaart" : "🫙 de pot"}</span>
            {people.map((p) => <span key={p.id} style={S.chip(payPerson === p.id ? 1 : 0)} onClick={() => { setPayPerson((v) => (v === p.id ? "" : p.id)); setPaidConfirmed(false) }}>{p.name}</span>)}
          </div>

          {st.split && (
            <div style={{ background: "#faf4e4", borderRadius: 12, padding: "10px 12px", marginTop: 10 }}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>🫙 pot betaalt <span style={{ fontSize: 11, color: "#c0554a" }}>(eerst invullen)</span></span>
                <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input autoFocus style={{ ...S.input, width: 80, borderColor: (st.potOver || !st.potFilled) ? "#e0685c" : "rgba(120,95,20,0.22)" }} type="text" inputMode="decimal" placeholder="?" value={potAmtDraft} onChange={(e) => { setPotAmtDraft(e.target.value.replace(/[^0-9.,]/g, "")); setPaidConfirmed(false) }} /></div>
              </div>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>👤 {people.find((p) => p.id === payPerson)?.name} <span style={{ fontSize: 11, color: "#8a7d55" }}>(de rest)</span></span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#4a3f1e" }}>{st.potFilled ? euro(Math.max(0, personRest)) : "—"}</span>
              </div>
              <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 6 }}>{st.potFilled ? "De rest rekent de app automatisch." : "Vul eerst het pot-bedrag in — dan verschijnt de rest."}{st.potAvail <= 0.005 ? " De pot is leeg." : ""}</div>
            </div>
          )}
          {payPot && !payPerson && <div style={{ fontSize: 12, color: st.potAvail <= 0.005 ? "#c0554a" : "#8a7d55", fontWeight: 700, marginTop: 8 }}>pot: {euro(st.potAvail)}{st.potAvail <= 0.005 ? " — te weinig, leg bij of kies andere/extra betaler" : ""}</div>}

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

        <button style={{ ...S.btnP, opacity: (paidConfirmed && st.valid) ? 1 : 0.5 }} onClick={closeRound}>✓ Rondje afsluiten</button>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={{ ...S.btn, flex: 1, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelRound}>✕ Rondje annuleren</button>
          <button style={{ ...S.btn, flex: 1 }} onClick={editOrder}>✏️ Bestelling wijzigen</button>
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
        <h3 style={{ ...S.h3, marginBottom: 6 }}>📋 Rondjesoverzicht</h3>
        {rounds.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Nog geen rondjes</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>Er zijn nog geen bestellingen. Start een eerste rondje om te beginnen.</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={() => { setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }}>Start 1e rondje</button>
            </div>
          </div>
        ) : (<>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ ...S.sub, margin: 0 }}>Tik een ronde open om aan te passen.</p>
          {rounds.length > 1 && <span onClick={() => setAllRoundsOpen((v) => !v)} style={{ fontSize: 12, fontWeight: 800, color: "#8a5e0f", cursor: "pointer", flexShrink: 0 }}>{allRoundsOpen ? "alles dichtklappen" : "alles openklappen"}</span>}
        </div>

        {rounds.map((r, idx) => {
          const items = drinks.reduce((s, d) => s + drinkTotalRound(r, d.id), 0)
          const open = allRoundsOpen || openRound === idx
          const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
          return (
            <div key={idx} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ cursor: "pointer", padding: 14 }} onClick={() => { if (allRoundsOpen) { setAllRoundsOpen(false); setOpenRound(idx) } else { setOpenRound(open ? null : idx) } setEditAssign(false); setEditCups(false); setEditPay(false) }}>
                <div style={{ ...S.row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Ronde {idx + 1} <span style={{ fontSize: 12, fontWeight: 600, color: "#8a7d55" }}>· {items} drankjes · {euro(r.amount)}</span></span>
                  <span style={{ fontSize: 14, color: "#8a7d55" }}>{open ? "▴" : "▾"}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1f8a4c", marginTop: 3 }}>✓ betaald: {paidLabel(r)}</div>
              </div>
              {open && (
                <div style={{ padding: "0 14px 14px" }}>
                  {roundDrinks.map((d) => {
                    const who = people.filter((p) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = r.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                    const un = r.anon[d.id] ?? 0
                    if (un > 0) return (
                      <div key={d.id} onClick={() => { setEditAssign(true); setEditCups(false); setEditPay(false) }} style={{ fontSize: 13, fontWeight: 700, marginBottom: 5, background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.5)", borderRadius: 10, padding: "7px 10px", color: "#b0402f", cursor: "pointer" }}>🔴 {d.emoji} {drinkTotalRound(r, d.id)}× {d.name} — <u>{un}× zonder naam, hier toewijzen →</u>{who.length > 0 && <span style={{ fontWeight: 400, color: "#8a7d55" }}> (al: {who.join(", ")})</span>}</div>
                    )
                    return <div key={d.id} style={{ fontSize: 13.5, marginBottom: 3 }}><b>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}</b> <span style={{ color: "#8a7d55" }}>→ {who.join(", ")}</span></div>
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button style={{ ...S.btn, flex: 1, fontSize: 12.5, padding: "8px 0" }} onClick={() => { setEditAssign((v) => !v); setEditCups(false); setEditPay(false) }}>{editAssign ? "▴ toewijzen" : "✏️ toewijzen"}</button>
                    {depositOn && <button style={{ ...S.btn, flex: 1, fontSize: 12.5, padding: "8px 0" }} onClick={() => { setEditCups((v) => !v); setEditAssign(false); setEditPay(false) }}>{editCups ? "▴ bekers" : "🫙 bekers"}</button>}
                    <button style={{ ...S.btn, flex: 1, fontSize: 12.5, padding: "8px 0" }} onClick={() => { setEditPay((v) => !v); setEditAssign(false); setEditCups(false) }}>{editPay ? "▴ bedrag" : "💶 bedrag"}</button>
                  </div>

                  {editAssign && (
                    <div style={{ marginTop: 10, background: "#faf4e4", borderRadius: 12, padding: 10 }}>
                      {roundDrinks.map((d) => {
                        const un = r.anon[d.id] ?? 0
                        return (
                          <div key={d.id} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>{d.emoji} {d.name}{un > 0 && <span style={{ color: "#c0554a", fontWeight: 700 }}> · {un} nog toe te wijzen</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {people.map((p) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={p.id} style={{ ...S.chip(n), padding: "6px 11px", fontSize: 13 }} onClick={() => rAssignFromAnon(idx, d.id, p.id)}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 16, fontWeight: 800, lineHeight: 1 }}>−</span>}</span>
                              )})}
                            </div>
                          </div>
                        )
                      })}
                      <div style={{ fontSize: 11, color: "#8a7d55" }}>Herverdelen: ✕ zet een drankje terug op "onbekend", tik dan een andere naam. Het aantal blijft gelijk (er is al betaald).</div>
                    </div>
                  )}

                  {editPay && (
                    <div style={{ marginTop: 10, background: "#faf4e4", borderRadius: 12, padding: 10 }}>
                      <div style={{ ...S.row, gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>€</span>
                        <input style={{ ...S.input, width: 110, fontSize: 16 }} type="text" inputMode="decimal" value={r.amount || ""} onChange={(e) => rSetAmount(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} />
                        <span style={{ fontSize: 11, color: "#8a7d55" }}>totaal — Fair-Split basis</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span style={S.chip(r.payer === "" && (r.potPart || 0) > 0 ? 1 : 0)} onClick={() => rPickPot(idx)}>🫙 de pot</span>
                        {people.map((p) => <span key={p.id} style={{ ...S.chip(r.payer === p.id ? 1 : 0), padding: "6px 11px", fontSize: 13 }} onClick={() => rPickPerson(idx, p.id)}>{p.name}</span>)}
                      </div>
                      <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 6 }}>Eén betaler kiezen. Voor pot + persoon samen: doe het rondje opnieuw via het betaalscherm.</div>
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
                              <span style={{ fontSize: 11, color: "#8a7d55" }}>gaf terug</span>
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
        {rounds.length > 0 && <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btn, flex: 1 }} onClick={goFinal}>🧾 Afrekenen</button>
          <button style={{ ...S.btnP, flex: 2 }} onClick={nextRound}>➕ Nieuw rondje</button>
        </div>}
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
        <h3 style={{ ...S.h3, margin: 0 }}>🧾 Eindbalans</h3>
        {pay === "coin" && (
          <div style={{ ...S.row, gap: 6 }}>
            <div style={{ ...S.seg(displayUnit === "eur"), flex: "none", padding: "6px 12px" }} onClick={() => setDisplayUnit("eur")}>€</div>
            <div style={{ ...S.seg(displayUnit === "coin"), flex: "none", padding: "6px 12px" }} onClick={() => setDisplayUnit("coin")}>🎟️</div>
          </div>
        )}
      </div>

      <div style={{ ...S.card, background: "linear-gradient(135deg,#fff7e6,#fdefc9)" }}>
        <div style={{ ...S.row, justifyContent: "space-between", fontSize: 14 }}>
          <span style={{ fontWeight: 800 }}>💰 Totaal besteld</span>
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
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <div style={{ ...S.row, gap: 6 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>⚖️ Fair Split</h3>
            <span onClick={() => setNotice("⚖️ Fair Split — Eerlijker dan gelijke verdeling. Wie weinig of goedkopere drankjes nam, betaalt niet mee voor wie meer of duurdere drankjes nam.")} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 11, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>i</span>
          </div>
          <span onClick={() => { setOpenFairAll((v) => !v); setOpenFair({}) }} style={{ fontSize: 11.5, fontWeight: 800, color: "#8a5e0f", cursor: "pointer" }}>{openFairAll ? "▴ sluit details" : "bekijk details"}</span>
        </div>
        {anyUnassignedRounds && <div style={{ fontSize: 11.5, color: "#b0402f", marginBottom: 8 }}>⚠️ Sommige drankjes waren niet toegewezen — gelijk verdeeld (minder eerlijk).</div>}
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
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{open ? "▾" : "▸"} {p.name} <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1f8a4c" }}>· {show(dronk)}</span></span>
                {showEqual && <span style={{ width: 96, textAlign: "right", fontSize: 12.5, color: "#8a7d55" }}>{show(equalShare)}</span>}
              </div>
              {open && (
                <div style={{ background: "#faf4e4", borderRadius: 10, padding: "8px 11px", margin: "0 0 8px", fontSize: 12.5 }}>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>dronk (aandeel)</span><span style={{ fontWeight: 700 }}>{show(dronk)}</span></div>
                  {depositOn && Math.abs(waarborg) > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>waarborg (voorgeschoten)</span><span style={{ fontWeight: 700 }}>{show(waarborg)}</span></div>}
                  {zelf > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>zelf betaald (rondjes)</span><span style={{ fontWeight: 700, color: "#1f8a4c" }}>−{show(zelf)}</span></div>}
                  {inpot > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>in pot gelegd</span><span style={{ fontWeight: 700, color: "#1f8a4c" }}>−{show(inpot)}</span></div>}
                  {cardLossPer > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>verlies drankkaart (gedeeld)</span><span style={{ fontWeight: 700 }}>{show(cardLossPer)}</span></div>}
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "5px 0 0", marginTop: 3, borderTop: "1px dashed rgba(120,95,20,0.25)" }}><span style={{ fontWeight: 800 }}>netto</span><span style={{ fontWeight: 800, color: nettoColor }}>{nettoLabel}</span></div>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 8 }}>Tik een naam (of "bekijk details") voor de opbouw. <b>Aandeel</b> = wat je verteerde (telt op tot {show(grandTotal)}). <b>Netto</b> houdt rekening met wat je zelf betaalde en in de pot legde. <span onClick={() => setShowEqual((v) => !v)} style={{ color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{showEqual ? "verberg gelijke verdeling" : "toon gelijke verdeling"}</span></div>
      </div>

      <div style={S.card}>
        <h3 style={{ ...S.h3, marginBottom: 8 }}>🔁 Zo verrekenen jullie</h3>
        <p style={{ ...S.sub, marginBottom: 8 }}>Minste overschrijvingen om quitte te staan:</p>
        {settlement.tx.length === 0 ? <div style={{ fontSize: 13.5, color: "#1f8a4c", fontWeight: 700 }}>✓ Alles staat gelijk.</div> : settlement.tx.map((t, i) => (
          <div key={i} style={{ ...S.row, justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
            <span style={{ fontSize: 14 }}><b>{t.from}</b> → {t.to}</span><span style={{ fontSize: 15, fontWeight: 800, color: "#b35309" }}>{show(t.amount)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...S.btn, flex: 1 }} onClick={() => { setOpenRound(rounds.length - 1); setView("hub") }}>← overzicht</button>
        <button style={{ ...S.btn, flex: 1 }} onClick={goHome}>🏠 home</button>
      </div>
    </div></div>
  )
}
