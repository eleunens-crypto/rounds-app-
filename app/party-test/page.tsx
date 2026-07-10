"use client"

// ─────────────────────────────────────────────────────────────────────────────
// RUNDO PARTY — TESTPAGINA v7
// - Betaling bevestigen -> rondjes-hub (overzicht) -> nieuw rondje / afrekenen
// - Bewerken (toewijzen + bekers) in het overzicht; app herberekent automatisch
// - Home-knop op elk scherm (geen reset); coin-prijzen zichtbaar/aanpasbaar
// Richtprijzen blijven ONZICHTBAAR bij bestellen. Volledig lokaal. app/party-test/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react"

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
const DEMO_PEOPLE: Person[] = ["Jan", "Sarah", "Tom", "Lisa", "Ben"].map((n, i) => ({ id: "p" + (i + 1), name: n }))

type Assign = Record<string, Record<string, number>>
type Anon = Record<string, number>
type Round = { orders: Assign; anon: Anon; payer: string; amount: number; potPart: number; gaveBack: Record<string, number> }

const euro = (v: number) => "€" + v.toFixed(2).replace(".", ",")

export default function PartyTest() {
  const [view, setView] = useState<"setup" | "order" | "confirmed" | "hub" | "final">("setup")
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
  const [people, setPeople] = useState<Person[]>(DEMO_PEOPLE)
  const [drinks, setDrinks] = useState<Drink[]>(DEMO_DRINKS)
  const [potRounds, setPotRounds] = useState<{ id: number; amounts: Record<string, number> }[]>([])
  const [potDraft, setPotDraft] = useState<Record<string, number>>({})
  const [everyoneDraft, setEveryoneDraft] = useState<string>("")
  const [everyoneChoice, setEveryoneChoice] = useState<number | "custom" | null>(null)
  const [editPotId, setEditPotId] = useState<number | null>(null)

  const [roundNr, setRoundNr] = useState(1)
  const [activeCat, setActiveCat] = useState<Cat>("Bier")
  const [coinCat, setCoinCat] = useState<Cat>("Bier")
  const [coinFull, setCoinFull] = useState(false)
  const [fullList, setFullList] = useState(false)
  const [cart, setCart] = useState<Assign>({})
  const [cartAnon, setCartAnon] = useState<Anon>({})
  const [rounds, setRounds] = useState<Round[]>([])
  const [gaveBackDraft, setGaveBackDraft] = useState<Record<string, number>>({})
  const [displayUnit, setDisplayUnit] = useState<"eur" | "coin">("eur")
  const [showEqual, setShowEqual] = useState(true)
  const [openFairAll, setOpenFairAll] = useState(false)
  const [openFair, setOpenFair] = useState<Record<string, boolean>>({})
  const [openRound, setOpenRound] = useState<number | null>(null)

  const [assignDrink, setAssignDrink] = useState<string | null>(null)
  const [showCups, setShowCups] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [cupsChecked, setCupsChecked] = useState(false)
  const [cupsTouched, setCupsTouched] = useState(false)
  const [amountDraft, setAmountDraft] = useState<string>("")
  const [payPot, setPayPot] = useState(false)
  const [payPerson, setPayPerson] = useState<string>("")
  const [potAmtDraft, setPotAmtDraft] = useState<string>("")
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [confirmDlg, setConfirmDlg] = useState<{ msg: string; yes: string; onYes: () => void; variant?: "danger" } | null>(null)
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

  const addPerson = () => { const name = (typeof window !== "undefined" && window.prompt("Naam van de nieuwe persoon?")) || ""; if (name.trim()) setPeople((ps) => [...ps, { id: "p" + Date.now(), name: name.trim() }]) }
  const setEveryoneAmt = (v: number) => setPotDraft(Object.fromEntries(people.map((p) => [p.id, v])))
  const resetPotDraft = () => { setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft("") }
  const closePot = () => { if (editPotId === null && potDraftTotal > 0.001) setPotRounds((rs) => [...rs, { id: Date.now(), amounts: potDraft }]); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setEditPotId(null); setShowPot(false) }
  const editPotRound = (id: number) => { const r = potRounds.find((x) => x.id === id); if (!r) return; setEditPotId(id); setPotDraft({ ...r.amounts }); setEveryoneChoice(null); setEveryoneDraft("") }
  const saveEditPot = () => { if (editPotId === null) return; if (potDraftTotal > 0.001) setPotRounds((rs) => rs.map((r) => r.id === editPotId ? { ...r, amounts: potDraft } : r)); else setPotRounds((rs) => rs.filter((r) => r.id !== editPotId)); setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft("") }
  const cancelEditPot = () => { setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft("") }
  const removePotRound = (id: number, label: string) => setConfirmDlg({ msg: `De ${label} verwijderen uit de pot? Dit kan niet ongedaan gemaakt worden.`, yes: "Ja, verwijderen", onYes: () => { setPotRounds((rs) => rs.filter((r) => r.id !== id)); setConfirmDlg(null) } })
  const catsPresent = CATS.filter((c) => drinks.some((d) => d.cat === c))
  const firstUnassigned = () => drinks.find((d) => (cartAnon[d.id] ?? 0) > 0)

  const goHome = () => { if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.", yes: "Toch verlaten — bestelling kwijt", onYes: () => { setConfirmDlg(null); setView("setup") } }); else setView("setup") }
  const paymentState = () => {
    const total = parseFloat(amountDraft.replace(",", ".")) || 0
    const potFilled = potAmtDraft.trim() !== ""
    const potAmt = parseFloat(potAmtDraft.replace(",", ".")) || 0
    const split = payPot && !!payPerson
    const potOnly = payPot && !payPerson
    const personOnly = !payPot && !!payPerson
    const potContribToRound = potOnly ? total : split ? potAmt : 0
    const potOver = potContribToRound > potRemaining + 0.001
    const personRest = split ? total - potAmt : personOnly ? total : 0
    let valid = true, reason = ""
    if (total <= 0) { valid = false; reason = "Vul eerst het totaalbedrag in." }
    else if (!payPot && !payPerson) { valid = false; reason = "Kies wie betaalde." }
    else if (potOnly && potOver) { valid = false; reason = `De pot heeft maar ${euro(potRemaining)} — leg bij of kies een andere betaler.` }
    else if (split && !potFilled) { valid = false; reason = "Vul eerst het pot-bedrag in." }
    else if (split && potOver) { valid = false; reason = `De pot heeft maar ${euro(potRemaining)} — verlaag het pot-bedrag of leg bij.` }
    else if (split && potAmt > total + 0.0001) { valid = false; reason = "Het pot-bedrag is hoger dan het totaal." }
    const zeroPot = valid && split && potAmt <= 0.0001
    const zeroPerson = valid && split && Math.abs(personRest) <= 0.0001
    return { total, potFilled, potAmt, split, potOnly, personOnly, potContribToRound, potOver, personRest, valid, reason, zeroPot, zeroPerson }
  }
  const goHub = () => { const to = () => { setOpenRound(rounds.length - 1); setEditAssign(false); setEditCups(false); setEditPay(false); setView("hub") }; if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.", yes: "Toch verlaten — bestelling kwijt", onYes: () => { setConfirmDlg(null); to() } }); else to() }
  const openClose = () => { setAmountDraft(""); setShowClose(true) }
  const goAssignFromWarning = () => { const d = firstUnassigned(); setShowClose(false); if (d) { setActiveCat(d.cat); setAssignDrink(d.id) } }
  const commitRound = () => {
    const effGb: Record<string, number> = {}
    people.forEach((p) => { effGb[p.id] = gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id)) })
    setRounds((r) => [...r, { orders: cart, anon: cartAnon, payer: "", amount: 0, potPart: 0, gaveBack: effGb }])
    setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setAmountDraft(""); setPayPot(false); setPayPerson(""); setPotAmtDraft(""); setPaidConfirmed(false); setView("confirmed")
  }
  const applyPayment = (payer: string, potPart: number, total: number) => setRounds((rs) => rs.map((r, i) => i === rs.length - 1 ? { ...r, payer, amount: total, potPart } : r))
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
    const nets: { id: string; label: string; net: number }[] = people.map((p) => ({ id: p.id, label: p.name, net: (paid[p.id] ?? 0) + contribOf(p.id) - consumption(p.id) - cupOwn(p.id) }))
    if (potContribTotal > 0 || potSpent > 0) nets.push({ id: "pot", label: "de pot", net: potPaid - potContribTotal })
    const creditors = nets.filter((n) => n.net > 0.005).map((n) => ({ ...n })).sort((a, b) => b.net - a.net)
    const debtors = nets.filter((n) => n.net < -0.005).map((n) => ({ ...n, net: -n.net })).sort((a, b) => b.net - a.net)
    const tx: { from: string; to: string; amount: number }[] = []; let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) { const amt = Math.min(debtors[i].net, creditors[j].net); tx.push({ from: debtors[i].label, to: creditors[j].label, amount: amt }); debtors[i].net -= amt; creditors[j].net -= amt; if (debtors[i].net < 0.005) i++; if (creditors[j].net < 0.005) j++ }
    return { tx }
  }, [rounds, people, potRounds, potContribTotal, potSpent, depositOn, depositValue, depositUnit, coinValue, drinks, pay]) // eslint-disable-line
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
    <span onClick={() => setShowPot(true)} style={{ ...S.pill, cursor: "pointer", padding: "5px 11px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(120,95,20,0.08)", color: potRemaining > 0 ? "#1f8a4c" : "#8a7d55" }}>🫙 pot {euro(potRemaining)}<span style={{ color: "#c98a00", fontWeight: 800 }}>+ toevoegen</span></span>
  )
  const renderPotModal = () => (
    <div style={{ ...S.overlay, zIndex: 60 }} onClick={closePot}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ ...S.h3, fontSize: 18, margin: "0 0 8px" }}>🫙 Pot</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ ...S.pill, background: "rgba(120,95,20,0.08)", color: "#8a5e0f", fontSize: 12, padding: "4px 10px" }}>ingelegd {euro(potContribTotal)}</span>
          {potSpent > 0 && <span style={{ ...S.pill, background: "rgba(224,138,0,0.12)", color: "#c98a00", fontSize: 12, padding: "4px 10px" }}>besteed {euro(potSpent)}</span>}
          <span style={{ ...S.pill, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(224,104,92,0.14)", color: potRemaining > 0 ? "#1f8a4c" : "#c0554a", fontSize: 12, padding: "4px 10px", fontWeight: 800 }}>nog {euro(potRemaining)}</span>
        </div>

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
            <div key={p.id} style={{ ...S.row, justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
              <span style={{ fontSize: 14, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{contribOf(p.id) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#8a7d55" }}> · {euro(contribOf(p.id))}</span>}</span>
              <div style={{ ...S.row, gap: 6, flexShrink: 0 }}>
                <input style={{ ...S.input, width: 60, padding: "5px 8px", fontSize: 12.5 }} type="text" inputMode="decimal" placeholder="€" value={potDraft[p.id] ?? ""} onChange={(e) => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: parseFloat(e.target.value.replace(",", ".")) || 0 })) }} />
                <button style={{ ...S.btn, padding: "5px 9px", fontSize: 12, color: "#c0554a" }} onClick={() => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: 0 })) }}>↺</button>
                <span style={{ fontSize: 13, fontWeight: 800, width: 52, textAlign: "right", color: (potDraft[p.id] || 0) > 0 ? "#1f8a4c" : "#b3a988" }}>{(potDraft[p.id] || 0) > 0 ? "+" + euro(potDraft[p.id] || 0) : "+€0"}</span>
              </div>
            </div>
          ))}
        </div>
        {editPotId !== null ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={cancelEditPot}>✕ annuleer</button>
            <button style={{ ...S.btnP, flex: 2 }} onClick={saveEditPot}>{potDraftTotal > 0 ? `✓ Wijziging opslaan (${euro(potDraftTotal)})` : "✓ Inleg verwijderen (leeg)"}</button>
          </div>
        ) : (
          <button style={{ ...S.btnP, marginTop: 14 }} onClick={closePot}>{potDraftTotal > 0 ? `✓ Inleg toevoegen (${euro(potDraftTotal)})` : "Klaar"}</button>
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
                <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => setConfirmDlg(null)}>← terug</button>
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
  const Header = () => (
    <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
      <div style={{ ...S.row, gap: 8, minWidth: 0 }}>
        <button style={{ ...S.btn, padding: "7px 11px", fontSize: 14 }} onClick={goHome}>🏠</button>
        <div style={{ ...S.h1, fontSize: 17, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName.trim() || "Rundo Party"} <span style={{ fontSize: 11, fontWeight: 800, color: "#e08a00", border: "1px solid #e08a00", borderRadius: 6, padding: "1px 5px", verticalAlign: "middle" }}>TEST</span></div>
      </div>
      <div style={{ ...S.row, gap: 6, flexShrink: 0 }}>
        {rounds.length > 0 && view !== "hub" && <button style={{ ...S.btn, padding: "6px 10px", fontSize: 12 }} onClick={goHub}>📋</button>}
        {potTag}
      </div>
    </div>
  )

  // ── SETUP ───────────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={S.page} onClick={() => { setCoinInfo(false); setDepositInfo(false) }}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={S.card}>
          <input style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontSize: 16, fontWeight: 700, marginBottom: 12 }} type="text" placeholder="Naam van de groep (bv. Verjaardag Tom)" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>👥 {people.length} personen</h3>
            <button style={{ ...S.btn, padding: "5px 10px", fontSize: 12 }} onClick={addPerson}>+ persoon</button>
          </div>
          <div style={{ ...S.row, flexWrap: "wrap", gap: 7 }}>{people.map((p) => <span key={p.id} style={{ ...S.pill, fontSize: 12.5, padding: "5px 11px", background: "rgba(240,165,0,0.12)", color: "#8a5e0f" }}>{p.name}</span>)}</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🫙 Gezamenlijke pot <span style={{ fontSize: 12, fontWeight: 600, color: "#8a7d55" }}>— optioneel</span></span>
            <button style={{ ...S.btn, padding: "6px 12px", fontSize: 13 }} onClick={() => setShowPot(true)}>{potContribTotal > 0 ? `beheren · ${euro(potContribTotal)}` : "+ inleggen"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", marginTop: 8 }}>Je kan ook later nog bijleggen — de pot staat altijd bovenaan.</div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.card, height: "100%", marginBottom: 0 }}>
          <h3 style={{ ...S.h3, margin: 0, fontSize: 13.5, lineHeight: 1.3 }}>♻️ Herbruikbare bekers <span onClick={(e) => { e.stopPropagation(); setDepositInfo((v) => !v); setCoinInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 10.5, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8 }}>
            <div style={{ ...S.seg(!depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(false)}>uit</div>
            <div style={{ ...S.seg(depositOn), padding: "6px 8px" }} onClick={() => setDepositOn(true)}>aan</div>
          </div>
          {depositInfo && <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10, fontSize: 12, color: "#6b5f3a", lineHeight: 1.5 }}>♻️ <b>Herbruikbare bekers?</b> Voor events met waarborg per beker die je terugkrijgt bij inleveren. Zet aan om de borg mee te verrekenen.</div>}
          {depositOn && (
            <div style={{ marginTop: 10 }}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: pay === "coin" ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Waarborg/beker</span>
                <div style={S.row}>
                  <input style={{ ...S.input, width: 56 }} type="text" inputMode="decimal" value={depositValue} onChange={(e) => setDepositValue(parseFloat(e.target.value.replace(",", ".")) || 0)} />
                  {pay === "eur" && <span style={{ fontSize: 13, fontWeight: 700, color: "#8a7d55" }}>€</span>}
                </div>
              </div>
              {pay === "coin" && (
                <div style={{ ...S.row, gap: 6 }}>
                  <div style={{ ...S.seg(depositUnit === "coin"), padding: "6px 6px", fontSize: 12 }} onClick={() => setDepositUnit("coin")}>coins</div>
                  <div style={{ ...S.seg(depositUnit === "eur"), padding: "6px 6px", fontSize: 12 }} onClick={() => setDepositUnit("eur")}>€</div>
                </div>
              )}
            </div>
          )}
        </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.card, height: "100%", marginBottom: 0 }}>
          <h3 style={{ ...S.h3, margin: 0, fontSize: 13.5, lineHeight: 1.3 }}>{pay === "coin" ? "🎟️ Coins" : "💶 Euro"} <span onClick={(e) => { e.stopPropagation(); setCoinInfo((v) => !v); setDepositInfo(false) }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 10.5, fontWeight: 800, cursor: "pointer", lineHeight: 1, verticalAlign: "middle" }}>i</span></h3>
          <div style={{ ...S.row, gap: 6, marginTop: 8, justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: pay === "coin" ? "#c98a00" : "#8a7d55" }}>🎟️ coins</span>
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
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
          {rounds.length > 0
            ? <button style={{ ...S.btnP, width: "80%" }} onClick={() => { setOpenRound(rounds.length - 1); setView("hub") }}>Terug naar overzicht →</button>
            : <button style={{ ...S.btnP, width: "80%" }} onClick={() => { setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }}>Start {roundNr === 1 ? "1e rondje" : `rondje ${roundNr}`} →</button>}
        </div>
      </div></div>
    )
  }

  // ── ORDER ───────────────────────────────────────────────────────────────────
  if (view === "order") {
    const catDrinks = drinks.filter((d) => d.cat === activeCat)
    const catVisible = catDrinks.filter((d) => fullList || d.fav || drinkTotal(d.id) > 0)
    const ad = assignDrink ? drinks.find((d) => d.id === assignDrink)! : null
    const adAnon = ad ? (cartAnon[ad.id] ?? 0) : 0
    const needCups = depositOn && (people.some((p) => pickedUpOf(p.id) > 0) || people.some((p) => cupsBal(p.id) !== 0))
    const gaveBackTotal = people.reduce((a, p) => a + (gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id))), 0)
    const cupsBlock = needCups && !cupsChecked
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <div style={{ ...S.row, gap: 8, minWidth: 0 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>Ronde {roundNr}</h3>
            <span style={S.pill}>{roundItems}{unassignedTotal > 0 ? ` · ${unassignedTotal} open` : ""}</span>
          </div>
          <div style={{ display: "inline-flex", background: "#efe6cf", borderRadius: 20, padding: 2, flexShrink: 0 }}>
            <span onClick={() => setFullList(false)} style={{ padding: "4px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: !fullList ? "#fff" : "transparent", color: !fullList ? "#8a5e0f" : "#a89a72", boxShadow: !fullList ? "0 1px 3px rgba(120,95,20,0.2)" : "none" }}>⚡ kort</span>
            <span onClick={() => setFullList(true)} style={{ padding: "4px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, cursor: "pointer", background: fullList ? "#fff" : "transparent", color: fullList ? "#8a5e0f" : "#a89a72", boxShadow: fullList ? "0 1px 3px rgba(120,95,20,0.2)" : "none" }}>📖 alles</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingBottom: 8, marginBottom: 8 }}>
          {catsPresent.map((c) => {
            const openHere = drinks.some((d) => d.cat === c && (cartAnon[d.id] ?? 0) > 0)
            return <span key={c} style={S.tab(activeCat === c)} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}{openHere && <span style={{ marginLeft: 5, color: "#e0685c", fontSize: 15 }}>●</span>}</span>
          })}
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
                <div key={d.id} style={{ padding: "10px 10px", borderRadius: 12, cursor: "pointer", background: un > 0 ? "rgba(224,104,92,0.12)" : tot > 0 ? "rgba(240,165,0,0.12)" : "#faf4e4", border: un > 0 ? "1.5px solid rgba(224,104,92,0.6)" : tot > 0 ? "1px solid rgba(240,165,0,0.45)" : "1px solid rgba(120,95,20,0.1)" }} onClick={() => setAssignDrink(d.id)}>
                  <div style={{ fontSize: 13.5, fontWeight: tot > 0 ? 800 : 600, color: tot > 0 ? "#4a3f1e" : "#6b5f3a", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                  {(tot > 0 || un > 0) && (
                    <div style={{ ...S.row, gap: 5, marginTop: 5 }}>
                      {tot > 0 && <span style={{ ...S.pill, background: "rgba(240,165,0,0.22)", color: "#c98a00" }}>{tot}×</span>}
                      {un > 0 && <span style={{ ...S.pill, background: "rgba(224,104,92,0.15)", color: "#c0554a" }}>{un} open</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {roundItems > 0 && (
          <div style={{ ...S.card, padding: "10px 12px", background: "#fffdf6" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#8a5e0f" }}>🛒 In dit rondje</span>
              <span style={{ ...S.pill, background: "rgba(240,165,0,0.18)", color: "#c98a00" }}>{roundItems} drankje{roundItems === 1 ? "" : "s"}{unassignedTotal > 0 ? ` · ${unassignedTotal} open` : ""}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                const un = cartAnon[d.id] ?? 0
                return (
                  <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, background: un > 0 ? "rgba(224,104,92,0.12)" : "rgba(240,165,0,0.12)", border: un > 0 ? "1px solid rgba(224,104,92,0.4)" : "1px solid rgba(240,165,0,0.35)", color: "#4a3f1e", cursor: "pointer" }} onClick={() => setAssignDrink(d.id)}>
                    {d.emoji} {drinkTotal(d.id)}× {d.name}{un > 0 && <span style={{ color: "#c0554a", fontWeight: 800 }}> ·{un} open</span>}
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
        <button style={{ ...S.btnP, opacity: roundItems === 0 ? 0.5 : 1 }} onClick={() => roundItems > 0 && openClose()}>✅ Rondje {roundNr} bevestigen</button>

        {ad && (
          <div style={S.overlay} onClick={() => setAssignDrink(null)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ ...S.h3, margin: 0, fontSize: 18 }}>{ad.emoji} {ad.name}</h3>
                <span style={{ fontSize: 13, color: "#8a7d55" }}>{drinkTotal(ad.id)}× totaal</span>
              </div>
              {adAnon > 0 ? (
                <div style={{ background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "9px 12px", marginBottom: 12, fontSize: 13, color: "#b0402f", fontWeight: 700 }}>🔴 {adAnon} nog toe te wijzen — tik een naam om er telkens één aan toe te wijzen.</div>
              ) : (
                <p style={{ ...S.sub, marginBottom: 12 }}>Tik wie dit had (nog eens tikken = meer). Of voeg toe zonder naam om later toe te wijzen.</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {people.map((p) => {
                  const n = aQty(ad.id, p.id)
                  return <span key={p.id} style={S.chip(n)} onClick={() => assignTap(ad.id, p.id)} onContextMenu={(e) => { e.preventDefault(); bump(ad.id, p.id, -1) }}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); bump(ad.id, p.id, -1) }} style={{ marginLeft: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 16, fontWeight: 800, lineHeight: 1 }}>−</span>}</span>
                })}
              </div>
              <button style={{ ...S.btn, width: "100%", marginBottom: 14, fontSize: 13, fontWeight: 800, color: "#8a5e0f" }} onClick={() => eachOne(ad.id)}>👥 elk 1 <span style={{ fontWeight: 400, color: "#8a7d55" }}>— iedereen precies één</span></button>
              {adAnon > 0 ? (
                <div style={{ ...S.row, justifyContent: "space-between", background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.3)", borderRadius: 12, padding: "8px 12px", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: "#b0402f", fontWeight: 700 }}>🔴 {adAnon} zonder naam <span style={{ fontWeight: 400, color: "#8a7d55" }}>(tik een naam om toe te wijzen)</span></span>
                  <div style={{ ...S.row, gap: 8 }}><button style={S.step} onClick={() => bumpAnon(ad.id, -1)}>−</button><button style={S.step} onClick={() => bumpAnon(ad.id, 1)}>+</button></div>
                </div>
              ) : (
                <button style={{ ...S.btn, width: "100%", marginBottom: 14, fontSize: 13, color: "#8a5e0f" }} onClick={() => bumpAnon(ad.id, 1)}>+ zonder naam toevoegen <span style={{ color: "#8a7d55", fontWeight: 400 }}>(later toewijzen)</span></button>
              )}
              <button style={S.btnP} onClick={() => setAssignDrink(null)}>Klaar</button>
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
        <div style={{ ...S.card, textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: 34, marginBottom: 4 }}>🍻</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Ronde {roundNr} bevestigd — {items} drankjes</div>
          <div style={{ fontSize: 15, color: "#e08a00", fontWeight: 800, marginTop: 6 }}>👉 Iemand mag gaan halen!</div>
          {depositOn && <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#8a5e0f" }}>🫙 {totalInUse} beker{totalInUse === 1 ? "" : "s"} in omloop · {euro(totalInUse * depositPerCupEur)}</div>}
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.h3, marginBottom: 8 }}>📋 Deze ronde</h3>
          {last && drinks.filter((d) => drinkTotalRound(last, d.id) > 0).map((d) => {
            const n = drinkTotalRound(last, d.id)
            const who = people.filter((p) => (last.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = last.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
            const un = last.anon[d.id] ?? 0
            return <div key={d.id} style={{ fontSize: 14, marginBottom: 5 }}><b>{d.emoji} {n}× {d.name}</b> <span style={{ color: "#8a7d55" }}>→ {who.join(", ")}{un > 0 ? `${who.length ? ", " : ""}${un}× onbekend` : ""}</span></div>
          })}
          <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", marginTop: 8, paddingTop: 8, fontSize: 14, fontWeight: 800, textAlign: "right" }}>Totaal: {items} drankje{items === 1 ? "" : "s"}</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>💰 Totaal betaald voor dit rondje</h3>
            {potTag}
          </div>
          <div style={{ ...S.row, gap: 8, justifyContent: "center", margin: "6px 0 2px" }}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>€</span>
            <input style={{ ...S.input, width: 150, fontSize: 26, textAlign: "center", fontWeight: 800 }} type="text" inputMode="decimal" placeholder="0,00" value={amountDraft} onChange={(e) => { setAmountDraft(e.target.value.replace(/[^0-9.,]/g, "")); setPaidConfirmed(false) }} />
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", textAlign: "center", marginBottom: 14 }}>ⓘ exact bedrag — hierop verdeelt de app eerlijk (Fair Split)</div>

          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#8a7d55", marginBottom: 7 }}>Betaald door</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            <span style={S.chip(payPot ? 1 : 0)} onClick={() => { setPayPot((v) => !v); setPaidConfirmed(false) }}>🫙 de pot</span>
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
              <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 6 }}>{st.potFilled ? "De rest rekent de app automatisch." : "Vul eerst het pot-bedrag in — dan verschijnt de rest."}{st.potOver ? ` Pot heeft maar ${euro(potRemaining)}.` : ""}</div>
            </div>
          )}
          {payPot && !payPerson && <div style={{ fontSize: 12, color: st.potOver ? "#c0554a" : "#8a7d55", fontWeight: 700, marginTop: 8 }}>pot: {euro(potRemaining)}{st.potOver ? " — te weinig, leg bij of kies andere betaler" : ""}</div>}

          {(() => {
            const okGreen = paidConfirmed && st.valid
            const style = okGreen
              ? { ...S.btn, width: "100%", background: "rgba(31,138,76,0.12)", color: "#1f8a4c", border: "1px solid rgba(31,138,76,0.5)", fontWeight: 800 }
              : !st.valid
              ? { ...S.btn, width: "100%", background: "rgba(224,104,92,0.12)", color: "#b0402f", border: "1px solid rgba(224,104,92,0.5)", fontWeight: 800 }
              : S.btnP
            return <button style={{ ...style, marginTop: 14 }} onClick={confirmPayment}>{okGreen ? "✓ betaling bevestigd — pas gerust nog aan" : !st.valid ? `⚠️ ${st.reason}` : "✓ Bevestig betaling"}</button>
          })()}
        </div>

        <button style={{ ...S.btnP, opacity: (paidConfirmed && st.valid) ? 1 : 0.5 }} onClick={closeRound}>✓ Rondje afsluiten</button>
        <button style={{ ...S.btn, width: "100%", marginTop: 8, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelRound}>✕ Rondje annuleren</button>
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
        <h3 style={{ ...S.h3, marginBottom: 6 }}>📋 Rondes-overzicht</h3>
        <p style={{ ...S.sub }}>Tik een ronde open om drankjes/namen of bekers nog aan te passen — de app herberekent automatisch.</p>

        {rounds.map((r, idx) => {
          const items = drinks.reduce((s, d) => s + drinkTotalRound(r, d.id), 0)
          const open = openRound === idx
          const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
          return (
            <div key={idx} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ cursor: "pointer", padding: 14 }} onClick={() => { setOpenRound(open ? null : idx); setEditAssign(false); setEditCups(false); setEditPay(false) }}>
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
                    return <div key={d.id} style={{ fontSize: 13.5, marginBottom: 3 }}><b>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}</b> <span style={{ color: un > 0 ? "#c0554a" : "#8a7d55" }}>→ {who.join(", ")}{un > 0 ? `${who.length ? ", " : ""}${un}× onbekend` : ""}</span></div>
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

        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btn, flex: 1 }} onClick={() => setView("final")}>🧾 Afrekenen</button>
          <button style={{ ...S.btnP, flex: 2 }} onClick={nextRound}>➕ Nieuw rondje</button>
        </div>
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
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>⚖️ Fair Split</h3>
          <div style={{ ...S.row, gap: 12 }}>
            <span onClick={() => { setOpenFairAll((v) => !v); setOpenFair({}) }} style={{ fontSize: 11.5, fontWeight: 800, color: "#8a5e0f", cursor: "pointer" }}>{openFairAll ? "▴ alles dicht" : "⇅ alles open"}</span>
            <span onClick={() => setShowEqual((v) => !v)} style={{ fontSize: 11.5, fontWeight: 700, color: "#8a7d55", cursor: "pointer" }}>{showEqual ? "gelijk-kolom ✓" : "gelijk-kolom ✕"}</span>
          </div>
        </div>
        {anyUnassignedRounds && <div style={{ fontSize: 11.5, color: "#b0402f", marginBottom: 8 }}>⚠️ Sommige drankjes waren niet toegewezen — gelijk verdeeld (minder eerlijk).</div>}
        <div style={{ ...S.row, fontSize: 10.5, color: "#8a7d55", fontWeight: 800, paddingBottom: 4, borderBottom: "1px solid rgba(120,95,20,0.12)" }}>
          <span style={{ flex: 1 }}>naam · aandeel</span>{showEqual && <span style={{ width: 66, textAlign: "right" }}>gelijk</span>}
        </div>
        {people.map((p) => {
          const dronk = consumption(p.id), waarborg = cupOwn(p.id), zelf = paidByPerson(p.id), inpot = contribOf(p.id)
          const owed = dronk + waarborg - zelf - inpot
          const open = openFairAll || openFair[p.id]
          const nettoLabel = Math.abs(owed) < 0.005 ? "staat gelijk" : owed > 0 ? `moet ${show(owed)} betalen` : `krijgt ${show(-owed)} terug`
          const nettoColor = Math.abs(owed) < 0.005 ? "#8a7d55" : owed > 0 ? "#b35309" : "#1f8a4c"
          return (
            <div key={p.id} style={{ borderBottom: "1px solid rgba(120,95,20,0.06)" }}>
              <div style={{ ...S.row, justifyContent: "space-between", padding: "7px 0", cursor: "pointer" }} onClick={() => setOpenFair((o) => ({ ...o, [p.id]: !open }))}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{open ? "▾" : "▸"} {p.name} <span style={{ fontSize: 12.5, fontWeight: 800, color: "#1f8a4c" }}>· {show(dronk)}</span></span>
                {showEqual && <span style={{ width: 66, textAlign: "right", fontSize: 12.5, color: "#8a7d55" }}>{show(equalShare)}</span>}
              </div>
              {open && (
                <div style={{ background: "#faf4e4", borderRadius: 10, padding: "8px 11px", margin: "0 0 8px", fontSize: 12.5 }}>
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>dronk (aandeel)</span><span style={{ fontWeight: 700 }}>{show(dronk)}</span></div>
                  {depositOn && Math.abs(waarborg) > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>waarborg (voorgeschoten)</span><span style={{ fontWeight: 700 }}>{show(waarborg)}</span></div>}
                  {zelf > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>zelf betaald (rondjes)</span><span style={{ fontWeight: 700, color: "#1f8a4c" }}>−{show(zelf)}</span></div>}
                  {inpot > 0.005 && <div style={{ ...S.row, justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#6b5f3a" }}>in pot gelegd</span><span style={{ fontWeight: 700, color: "#1f8a4c" }}>−{show(inpot)}</span></div>}
                  <div style={{ ...S.row, justifyContent: "space-between", padding: "5px 0 0", marginTop: 3, borderTop: "1px dashed rgba(120,95,20,0.25)" }}><span style={{ fontWeight: 800 }}>netto</span><span style={{ fontWeight: 800, color: nettoColor }}>{nettoLabel}</span></div>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 8 }}>Tik een naam open voor de opbouw. <b>Aandeel</b> = wat je verteerde (telt op tot {show(grandTotal)}). <b>Netto</b> houdt rekening met wat je zelf betaalde en in de pot legde.{showEqual ? ` Gelijk = totaal ÷ ${people.length}.` : ""}</div>
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
