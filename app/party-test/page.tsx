"use client"

// ─────────────────────────────────────────────────────────────────────────────
// RUNDO PARTY — TESTPAGINA v6
// - Volledige drankenlijst met alle categorie-tabs
// - Bekers ALTIJD teruggeven (ook ronde 1); wie er binnenbrengt gaat negatief = krijgt waarborg
// - Pot-saldo overal compact zichtbaar; pot kan niet meer betalen dan er in zit
// - Waarschuwing "niet toegewezen" is aanklikbaar -> direct naar toewijzen
// Richtprijzen blijven ONZICHTBAAR. Volledig lokaal. app/party-test/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react"

type Person = { id: string; name: string }
type Cat = "Bier" | "BierAV" | "Frisdrank" | "Wijn" | "Cocktail" | "Mocktail" | "Longdrink" | "Shot" | "Warm"
type Drink = { id: string; name: string; emoji: string; cat: Cat; price: number; cup: boolean; fav: boolean }

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
const DEMO_DRINKS: Drink[] = DATA.map(([cat, name, price], i) => ({ id: "d" + i, name, emoji: CAT_EMOJI[cat], cat, price, cup: CUPCAT[cat], fav: FAVS.has(name) }))
const DEMO_PEOPLE: Person[] = ["Jan", "Sarah", "Tom", "Lisa", "Ben"].map((n, i) => ({ id: "p" + (i + 1), name: n }))

type Assign = Record<string, Record<string, number>>
type Anon = Record<string, number>
type Round = { orders: Assign; anon: Anon; payer: string; amount: number; pickedUp: Record<string, number>; gaveBack: Record<string, number> }

const euro = (v: number) => "€" + v.toFixed(2).replace(".", ",")

export default function PartyTest() {
  const [view, setView] = useState<"setup" | "order" | "confirmed" | "final">("setup")
  const [pay, setPay] = useState<"eur" | "coin">("eur")
  const [coinValue, setCoinValue] = useState(3.9)
  const [depositOn, setDepositOn] = useState(true)
  const [depositValue, setDepositValue] = useState(1)
  const [depositUnit, setDepositUnit] = useState<"eur" | "coin">("eur")
  const [showPot, setShowPot] = useState(false)

  const [people, setPeople] = useState<Person[]>(DEMO_PEOPLE)
  const drinks = DEMO_DRINKS
  const [contrib, setContrib] = useState<Record<string, number>>({})

  const [roundNr, setRoundNr] = useState(1)
  const [activeCat, setActiveCat] = useState<Cat>("Bier")
  const [fullList, setFullList] = useState(false)
  const [cart, setCart] = useState<Assign>({})
  const [cartAnon, setCartAnon] = useState<Anon>({})
  const [rounds, setRounds] = useState<Round[]>([])
  const [cups, setCups] = useState<Record<string, number>>({})
  const [gaveBackDraft, setGaveBackDraft] = useState<Record<string, number>>({})
  const [displayUnit, setDisplayUnit] = useState<"eur" | "coin">("eur")
  const [showCompare, setShowCompare] = useState(false)
  const [openRound, setOpenRound] = useState<number | null>(null)

  const [assignDrink, setAssignDrink] = useState<string | null>(null)
  const [showCups, setShowCups] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [cupsChecked, setCupsChecked] = useState(false)
  const [cupsTouched, setCupsTouched] = useState(false)
  const [payerDraft, setPayerDraft] = useState<string>("")
  const [amountDraft, setAmountDraft] = useState<string>("")

  const priceOf = (d: Drink) => d.price
  const depositPerCupEur = depositUnit === "eur" ? depositValue : depositValue * coinValue
  const show = (eur: number) => (pay === "coin" && displayUnit === "coin" ? (eur / coinValue).toFixed(2).replace(".", ",") + " coins" : euro(eur))

  const potContribTotal = Object.values(contrib).reduce((a, b) => a + (b || 0), 0)
  const potSpent = rounds.reduce((s, r) => s + (r.payer === "pot" ? r.amount : 0), 0)
  const potRemaining = potContribTotal - potSpent

  const aQty = (did: string, pid: string) => cart[did]?.[pid] ?? 0
  const bump = (did: string, pid: string, delta: number) => setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: Math.max(0, (c[did]?.[pid] ?? 0) + delta) } }))
  const bumpAnon = (did: string, delta: number) => setCartAnon((a) => ({ ...a, [did]: Math.max(0, (a[did] ?? 0) + delta) }))
  // toewijs-modus: is er nog een naamloze -> die toewijzen (open -1, naam +1); anders nieuw +1
  const assignTap = (did: string, pid: string) => { if ((cartAnon[did] ?? 0) > 0) { bumpAnon(did, -1); bump(did, pid, 1) } else bump(did, pid, 1) }
  const drinkAssigned = (did: string) => Object.values(cart[did] ?? {}).reduce((a, b) => a + b, 0)
  const drinkTotal = (did: string) => drinkAssigned(did) + (cartAnon[did] ?? 0)
  const roundItems = useMemo(() => drinks.reduce((s, d) => s + drinkTotal(d.id), 0), [cart, cartAnon]) // eslint-disable-line
  const unassignedTotal = useMemo(() => drinks.reduce((s, d) => s + (cartAnon[d.id] ?? 0), 0), [cartAnon]) // eslint-disable-line
  const pickedUpOf = (pid: string) => drinks.reduce((a, d) => a + (d.cup ? aQty(d.id, pid) : 0), 0)

  const addPerson = () => { const name = (typeof window !== "undefined" && window.prompt("Naam van de nieuwe persoon?")) || ""; if (name.trim()) setPeople((ps) => [...ps, { id: "p" + Date.now(), name: name.trim() }]) }
  const addContrib = (pid: string, v: number) => setContrib((c) => ({ ...c, [pid]: (c[pid] || 0) + v }))
  const addEveryone = (v: number) => setContrib((c) => Object.fromEntries(people.map((p) => [p.id, (c[p.id] || 0) + v])))
  const catsPresent = CATS.filter((c) => drinks.some((d) => d.cat === c))
  const firstUnassigned = () => drinks.find((d) => (cartAnon[d.id] ?? 0) > 0)

  const openClose = () => { setPayerDraft(""); setAmountDraft(""); setShowClose(true) }
  const goAssignFromWarning = () => { const d = firstUnassigned(); setShowClose(false); if (d) { setActiveCat(d.cat); setAssignDrink(d.id) } }
  const commitRound = () => {
    const pickedUp: Record<string, number> = {}, effGb: Record<string, number> = {}
    people.forEach((p) => { const pu = pickedUpOf(p.id); pickedUp[p.id] = pu; effGb[p.id] = gaveBackDraft[p.id] ?? Math.min(cups[p.id] ?? 0, pu) })
    if (depositOn) setCups((prev) => { const next = { ...prev }; people.forEach((p) => { next[p.id] = (next[p.id] ?? 0) + (pickedUp[p.id] || 0) - (effGb[p.id] || 0) }); return next })
    setRounds((r) => [...r, { orders: cart, anon: cartAnon, payer: "", amount: 0, pickedUp, gaveBack: effGb }])
    setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setPayerDraft(""); setAmountDraft(""); setView("confirmed")
  }
  const nextRound = () => { setRoundNr((n) => n + 1); setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }
  const goFinal = () => setView("final")
  const resetAll = () => { setRoundNr(1); setCart({}); setCartAnon({}); setRounds([]); setCups({}); setGaveBackDraft({}); setContrib({}); setCupsChecked(false); setCupsTouched(false); setView("setup") }

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

  // netto waarborg-mutatie per persoon per rondje (in euro), voorgeschoten door de betaler
  const roundCupEur = (r: Round, pid: string) => ((r.pickedUp[pid] || 0) - (r.gaveBack[pid] || 0)) * depositPerCupEur
  const cupOwn = (pid: string) => (depositOn ? rounds.reduce((s, r) => s + roundCupEur(r, pid), 0) : 0)
  const settlement = useMemo(() => {
    const paid: Record<string, number> = {}; people.forEach((p) => (paid[p.id] = 0)); let potPaid = 0
    rounds.forEach((r) => {
      const cupSum = depositOn ? people.reduce((a, p) => a + roundCupEur(r, p.id), 0) : 0
      const total = r.amount + cupSum // drank + voorgeschoten waarborg
      if (r.payer === "pot") potPaid += total
      else if (r.payer) paid[r.payer] = (paid[r.payer] ?? 0) + total
    })
    const nets: { id: string; label: string; net: number }[] = people.map((p) => ({ id: p.id, label: p.name, net: (paid[p.id] ?? 0) + (contrib[p.id] || 0) - consumption(p.id) - cupOwn(p.id) }))
    if (potContribTotal > 0 || potSpent > 0) nets.push({ id: "pot", label: "de pot", net: potPaid - potContribTotal })
    const creditors = nets.filter((n) => n.net > 0.005).map((n) => ({ ...n })).sort((a, b) => b.net - a.net)
    const debtors = nets.filter((n) => n.net < -0.005).map((n) => ({ ...n, net: -n.net })).sort((a, b) => b.net - a.net)
    const tx: { from: string; to: string; amount: number }[] = []; let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) { const amt = Math.min(debtors[i].net, creditors[j].net); tx.push({ from: debtors[i].label, to: creditors[j].label, amount: amt }); debtors[i].net -= amt; creditors[j].net -= amt; if (debtors[i].net < 0.005) i++; if (creditors[j].net < 0.005) j++ }
    return { tx }
  }, [rounds, people, contrib, potContribTotal, potSpent, depositOn, depositValue, depositUnit, coinValue]) // eslint-disable-line
  const anyUnassignedRounds = rounds.some((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <span onClick={() => setShowPot(true)} style={{ ...S.pill, cursor: "pointer", padding: "4px 11px", fontSize: 12, background: potRemaining > 0 ? "rgba(31,138,76,0.14)" : "rgba(120,95,20,0.08)", color: potRemaining > 0 ? "#1f8a4c" : "#8a7d55" }}>🫙 pot {euro(potRemaining)}</span>
      {potContribTotal === 0 && <span onClick={() => setShowPot(true)} style={{ fontSize: 10.5, color: "#c98a00", cursor: "pointer", fontWeight: 800 }}>+ pot toevoegen</span>}
    </div>
  )
  const renderPotModal = () => (
    <div style={{ ...S.overlay, zIndex: 60 }} onClick={() => setShowPot(false)}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ ...S.h3, fontSize: 18, margin: 0 }}>🫙 Pot</h3>
          <span style={{ fontSize: 13, color: "#8a7d55" }}>in pot {euro(potContribTotal)} · nog {euro(potRemaining)}</span>
        </div>
        <p style={{ ...S.sub }}>Leg in of voeg toe — ook later tijdens de avond. Snelbedragen tellen op.</p>
        <div style={{ ...S.row, gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#8a7d55", fontWeight: 700 }}>iedereen +</span>
          {[10, 15, 20].map((v) => <button key={v} style={{ ...S.btn, padding: "5px 12px", fontSize: 13 }} onClick={() => addEveryone(v)}>€{v}</button>)}
        </div>
        {people.map((p) => (
          <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{p.name}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: (contrib[p.id] || 0) > 0 ? "#1f8a4c" : "#b3a988" }}>{euro(contrib[p.id] || 0)}</span>
            </div>
            <div style={{ ...S.row, gap: 6, flexWrap: "wrap" }}>
              {[10, 15, 20].map((v) => <button key={v} style={{ ...S.btn, padding: "4px 11px", fontSize: 12 }} onClick={() => addContrib(p.id, v)}>+{v}</button>)}
              <input style={{ ...S.input, width: 62, padding: "5px 8px", fontSize: 12 }} type="number" placeholder="exact" value={contrib[p.id] ?? ""} onChange={(e) => setContrib((c) => ({ ...c, [p.id]: parseFloat(e.target.value) || 0 }))} />
              <button style={{ ...S.btn, padding: "4px 10px", fontSize: 12, color: "#c0554a" }} onClick={() => setContrib((c) => ({ ...c, [p.id]: 0 }))}>↺</button>
            </div>
          </div>
        ))}
        <button style={{ ...S.btnP, marginTop: 14 }} onClick={() => setShowPot(false)}>Klaar</button>
      </div>
    </div>
  )
  const Header = () => (
    <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
      <div>
        <div style={S.h1}>🍻 Rundo Party <span style={{ fontSize: 12, fontWeight: 800, color: "#e08a00", border: "1px solid #e08a00", borderRadius: 6, padding: "1px 6px", verticalAlign: "middle" }}>TEST</span></div>
        <div style={{ fontSize: 11.5, color: "#8a7d55", marginTop: 2 }}>{pay === "coin" ? `coins (1=${euro(coinValue)})` : "euro"}{depositOn ? ` · waarborg ${depositUnit === "eur" ? euro(depositValue) : depositValue + " coin"}` : ""}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        {potTag}
        <button style={{ ...S.btn, padding: "6px 10px", fontSize: 12 }} onClick={resetAll}>↺ reset</button>
      </div>
    </div>
  )

  // ── SETUP ───────────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        <div style={S.card}>
          <h3 style={S.h3}>Hoe reken je af?</h3>
          <div style={{ ...S.row, gap: 8, marginBottom: pay === "coin" ? 12 : 0 }}>
            <div style={S.seg(pay === "eur")} onClick={() => setPay("eur")}>💶 Euro</div>
            <div style={S.seg(pay === "coin")} onClick={() => setPay("coin")}>🎟️ Coins</div>
          </div>
          {pay === "coin" && (
            <div style={{ ...S.row, justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>1 coin =</span>
              <div style={S.row}><span style={{ color: "#8a7d55" }}>€</span><input style={S.input} type="number" step="0.01" value={coinValue} onChange={(e) => setCoinValue(parseFloat(e.target.value) || 0)} /></div>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "#8a7d55", marginTop: 10 }}>Per rondje geef je het <b>echte bedrag</b> in. De app verdeelt eerlijk (Fair Split) op wie wat had — zonder prijzen te tonen.</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: depositOn ? 12 : 0 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>♻️ Herbruikbare bekers</h3>
            <div style={{ ...S.row, gap: 6 }}>
              <div style={{ ...S.seg(!depositOn), flex: "none", padding: "6px 12px" }} onClick={() => setDepositOn(false)}>uit</div>
              <div style={{ ...S.seg(depositOn), flex: "none", padding: "6px 12px" }} onClick={() => setDepositOn(true)}>aan</div>
            </div>
          </div>
          {depositOn && (
            <>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Waarborg per beker</span>
                <input style={{ ...S.input, width: 70 }} type="number" step="0.1" value={depositValue} onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ ...S.row, gap: 8 }}>
                <div style={S.seg(depositUnit === "eur")} onClick={() => setDepositUnit("eur")}>in €</div>
                <div style={S.seg(depositUnit === "coin")} onClick={() => setDepositUnit("coin")}>in coins</div>
              </div>
            </>
          )}
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🫙 Gezamenlijke pot</span>
            <button style={{ ...S.btn, padding: "6px 12px", fontSize: 13 }} onClick={() => setShowPot(true)}>{potContribTotal > 0 ? `beheren · ${euro(potContribTotal)}` : "+ inleggen"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#8a7d55", marginTop: 8 }}>Optioneel. Je kan ook later tijdens de avond bijleggen — de pot staat altijd bovenaan.</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>👥 {people.length} personen</h3>
            <button style={{ ...S.btn, padding: "5px 10px", fontSize: 12 }} onClick={addPerson}>+ persoon</button>
          </div>
          <div style={{ ...S.row, flexWrap: "wrap", gap: 7 }}>{people.map((p) => <span key={p.id} style={{ ...S.pill, fontSize: 12.5, padding: "5px 11px", background: "rgba(240,165,0,0.12)", color: "#8a5e0f" }}>{p.name}</span>)}</div>
        </div>

        <button style={S.btnP} onClick={() => { setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }}>🍻 Start ronde 1 →</button>
      </div></div>
    )
  }

  // ── ORDER ───────────────────────────────────────────────────────────────────
  if (view === "order") {
    const catDrinks = drinks.filter((d) => d.cat === activeCat)
    const catVisible = catDrinks.filter((d) => fullList || d.fav || drinkTotal(d.id) > 0)
    const ad = assignDrink ? drinks.find((d) => d.id === assignDrink)! : null
    const adAnon = ad ? (cartAnon[ad.id] ?? 0) : 0
    const needCups = depositOn && (people.some((p) => pickedUpOf(p.id) > 0) || people.some((p) => (cups[p.id] ?? 0) !== 0))
    const gaveBackTotal = people.reduce((a, p) => a + (gaveBackDraft[p.id] ?? Math.min(cups[p.id] ?? 0, pickedUpOf(p.id))), 0)
    const cupsBlock = needCups && !cupsChecked
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>Ronde {roundNr}</h3>
          <span style={S.pill}>{roundItems} drankje{roundItems === 1 ? "" : "s"}{unassignedTotal > 0 ? ` · ${unassignedTotal} open` : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingBottom: 8, marginBottom: 4 }}>
          {catsPresent.map((c) => {
            const openHere = drinks.some((d) => d.cat === c && (cartAnon[d.id] ?? 0) > 0)
            return <span key={c} style={S.tab(activeCat === c)} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}{openHere && <span style={{ marginLeft: 5, color: "#e0685c", fontSize: 15 }}>●</span>}</span>
          })}
        </div>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "#8a7d55", fontWeight: 700 }}>{fullList ? "📖 volledige lijst" : "⚡ favorieten"}</span>
          <button style={{ ...S.btn, padding: "5px 12px", fontSize: 12.5 }} onClick={() => setFullList((v) => !v)}>{fullList ? "⚡ toon favorieten" : "📖 toon alles"}</button>
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
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {depositOn && <button style={{ ...S.btn, flex: 1 }} onClick={() => setShowCups(true)}>🫙 Bekers</button>}
          {rounds.length > 0 && <button style={{ ...S.btn, flex: 1 }} onClick={goFinal}>🧾 Balans</button>}
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
                <div style={{ background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "9px 12px", marginBottom: 12, fontSize: 13, color: "#b0402f", fontWeight: 700 }}>
                  🔴 {adAnon} nog toe te wijzen — tik een naam om er telkens één aan toe te wijzen.
                </div>
              ) : (
                <p style={{ ...S.sub, marginBottom: 12 }}>Tik wie dit had (nog eens tikken = meer). Of voeg toe zonder naam om later toe te wijzen.</p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {people.map((p) => {
                  const n = aQty(ad.id, p.id)
                  return <span key={p.id} style={S.chip(n)} onClick={() => assignTap(ad.id, p.id)} onContextMenu={(e) => { e.preventDefault(); bump(ad.id, p.id, -1) }}>{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); bump(ad.id, p.id, -1) }} style={{ marginLeft: 4, opacity: 0.85 }}>✕</span>}</span>
                })}
              </div>
              <div style={{ ...S.row, justifyContent: "space-between", background: "#faf4e4", borderRadius: 12, padding: "8px 12px", marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: "#8a7d55", fontWeight: 700 }}>nog zonder naam: {cartAnon[ad.id] ?? 0}</span>
                <div style={{ ...S.row, gap: 8 }}><button style={S.step} onClick={() => bumpAnon(ad.id, -1)}>−</button><button style={S.step} onClick={() => bumpAnon(ad.id, 1)}>+</button></div>
              </div>
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
                const bal = cups[p.id] ?? 0, pu = pickedUpOf(p.id)
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
                <div onClick={() => setShowCups(true)} style={{ background: "rgba(224,104,92,0.12)", border: "1.5px solid rgba(224,104,92,0.6)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: "#b0402f", cursor: "pointer", fontWeight: 700 }}>
                  🫙 <b>Bekers nog niet aangeduid.</b> <u>Tik hier om nu te regelen →</u>
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

  // ── CONFIRMED ───────────────────────────────────────────────────────────────
  if (view === "confirmed") {
    const totalInUse = people.reduce((s, p) => s + Math.max(0, cups[p.id] ?? 0), 0)
    const last = rounds[rounds.length - 1]
    const items = last ? drinks.reduce((s, d) => s + drinkTotalRound(last, d.id), 0) : 0
    const amtNum = parseFloat(amountDraft.replace(",", ".")) || 0
    const potOver = payerDraft === "pot" && amtNum > potRemaining + 0.001
    const canProceed = !!payerDraft && amtNum > 0 && !potOver
    const proceed = (fn: () => void) => { setRounds((rs) => rs.map((r, i) => (i === rs.length - 1 ? { ...r, payer: payerDraft, amount: amtNum } : r))); fn() }
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
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
            return (
              <div key={d.id} style={{ fontSize: 14, marginBottom: 5 }}>
                <b>{d.emoji} {n}× {d.name}</b> <span style={{ color: "#8a7d55" }}>→ {who.join(", ")}{un > 0 ? `${who.length ? ", " : ""}${un}× onbekend` : ""}</span>
              </div>
            )
          })}
          <div style={{ borderTop: "1px dashed rgba(120,95,20,0.25)", marginTop: 8, paddingTop: 8, fontSize: 14, fontWeight: 800, color: "#4a3f1e", textAlign: "right" }}>Totaal: {items} drankje{items === 1 ? "" : "s"}</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>💰 Wie betaalde & hoeveel?</h3>
            {potTag}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            <span style={S.chip(payerDraft === "pot" ? 1 : 0)} onClick={() => setPayerDraft("pot")}>🫙 de pot</span>
            {people.map((p) => <span key={p.id} style={S.chip(payerDraft === p.id ? 1 : 0)} onClick={() => setPayerDraft(p.id)}>{p.name}</span>)}
          </div>
          <div style={{ ...S.row, gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>€</span>
            <input style={{ ...S.input, width: 120, fontSize: 18, borderColor: potOver ? "#e0685c" : "rgba(120,95,20,0.22)" }} type="number" step="0.01" placeholder="0,00" value={amountDraft} onChange={(e) => setAmountDraft(e.target.value)} />
            {payerDraft === "pot" && <span style={{ fontSize: 12, color: potOver ? "#c0554a" : "#8a7d55", fontWeight: 700 }}>pot: {euro(potRemaining)}</span>}
          </div>
          {potOver && <div style={{ fontSize: 12, color: "#c0554a", fontWeight: 700, marginTop: 8 }}>De pot heeft maar {euro(potRemaining)} — leg bij (tik pot) of kies een andere betaler.</div>}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btn, flex: 1, opacity: canProceed ? 1 : 0.5 }} onClick={() => canProceed && proceed(goFinal)}>🧾 Eindbalans</button>
          <button style={{ ...S.btnP, flex: 2, opacity: canProceed ? 1 : 0.5 }} onClick={() => canProceed && proceed(nextRound)}>➕ Nieuwe ronde</button>
        </div>
      </div></div>
    )
  }

  // ── FINAL ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}><div style={S.wrap}>
      <Header />
        {showPot && renderPotModal()}
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
        <h3 style={{ ...S.h3, marginBottom: 8 }}>⚖️ Fair Split</h3>
        {anyUnassignedRounds && <div style={{ fontSize: 11.5, color: "#b0402f", marginBottom: 8 }}>⚠️ Sommige drankjes waren niet toegewezen — gelijk verdeeld (minder eerlijk).</div>}
        {!showCompare ? (
          people.map((p) => { const tot = consumption(p.id) + cupOwn(p.id); return (
            <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(120,95,20,0.06)" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{show(tot)}</span>
            </div>
          )})
        ) : (
          <div>
            <div style={{ ...S.row, justifyContent: "space-between", fontSize: 11, color: "#8a7d55", fontWeight: 800, paddingBottom: 4, borderBottom: "1px solid rgba(120,95,20,0.12)" }}>
              <span style={{ flex: 1 }}>naam</span><span style={{ width: 74, textAlign: "right" }}>fair split</span><span style={{ width: 74, textAlign: "right" }}>gelijk</span>
            </div>
            {people.map((p) => { const fair = consumption(p.id); return (
              <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(120,95,20,0.06)", fontSize: 13 }}>
                <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                <span style={{ width: 74, textAlign: "right", fontWeight: 800, color: "#1f8a4c" }}>{show(fair)}</span>
                <span style={{ width: 74, textAlign: "right", color: "#8a7d55" }}>{show(equalShare)}</span>
              </div>
            )})}
            <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 6 }}>Fair Split = wat je écht dronk. Gelijk = totaal ÷ {people.length}. Zo zie je dat gelijk delen minder eerlijk is.</div>
          </div>
        )}
        {depositOn && <div style={{ fontSize: 11, color: "#8a7d55", marginTop: 6 }}>Bedragen incl. voorgeschoten waarborg; die krijg je terug bij het inleveren van je beker (zie onder).</div>}
        <button style={{ ...S.btn, width: "100%", marginTop: 10, fontSize: 12.5, padding: "8px 0" }} onClick={() => setShowCompare((v) => !v)}>{showCompare ? "▴ verberg vergelijking" : "⇄ vergelijk met iedereen evenveel"}</button>
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

      <div style={S.card}>
        <h3 style={{ ...S.h3, marginBottom: 8 }}>📋 Rondes ({rounds.length})</h3>
        {rounds.map((r, idx) => {
          const items = drinks.reduce((s, d) => s + Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0), 0)
          const payerLabel = r.payer === "pot" ? "de pot" : (people.find((p) => p.id === r.payer)?.name ?? "?")
          const open = openRound === idx
          return (
            <div key={idx} style={{ borderBottom: "1px solid rgba(120,95,20,0.08)", padding: "8px 0" }}>
              <div style={{ ...S.row, justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpenRound(open ? null : idx)}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>Ronde {idx + 1} <span style={{ fontSize: 12, fontWeight: 600, color: "#8a7d55" }}>· {items} drankjes · {euro(r.amount)} · 💶 {payerLabel}</span></span>
                <span style={{ fontSize: 13, color: "#8a7d55" }}>{open ? "▴" : "▾"}</span>
              </div>
              {open && (
                <div style={{ marginTop: 8, paddingLeft: 4 }}>
                  {drinks.filter((d) => drinkTotalRound(r, d.id) > 0).map((d) => {
                    const who = people.filter((p) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = r.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                    const un = r.anon[d.id] ?? 0
                    return <div key={d.id} style={{ fontSize: 13, marginBottom: 3 }}><span style={{ color: "#8a7d55" }}>{d.emoji} {d.name}</span> → {who.join(", ")}{un > 0 ? `${who.length ? ", " : ""}${un}× onbekend` : ""}</div>
                  })}
                  {depositOn && people.some((p) => (r.pickedUp[p.id] || 0) > 0 || (r.gaveBack[p.id] || 0) > 0) && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#8a5e0f", background: "rgba(240,165,0,0.08)", borderRadius: 10, padding: "6px 9px" }}>
                      🫙 {people.map((p) => { const pu = r.pickedUp[p.id] || 0, gb = r.gaveBack[p.id] || 0; if (!pu && !gb) return null; const parts = []; if (pu) parts.push(`nam ${pu}`); if (gb) parts.push(`gaf ${gb} terug`); return `${p.name}: ${parts.join(", ")}` }).filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {depositOn && (
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginBottom: 4 }}>🫙 Bekers per persoon</h3>
          <p style={{ ...S.sub, marginBottom: 10 }}>De waarborg zit al in de verrekening hierboven (via wie elk rondje betaalde). Dit toont enkel wie nog een beker vasthoudt om aan de bar in te leveren.</p>
          {people.map((p) => {
            const b = cups[p.id] ?? 0
            return (
              <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(120,95,20,0.08)" }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name} <span style={{ fontSize: 12.5, fontWeight: 800, color: b > 0 ? "#c98a00" : b < 0 ? "#1f8a4c" : "#b3a988" }}>· saldo {b}</span></span>
                <span style={{ fontSize: 12.5, color: b > 0 ? "#8a7d55" : b < 0 ? "#1f8a4c" : "#b3a988", fontWeight: b === 0 ? 400 : 700 }}>
                  {b > 0 ? `lever ${b} beker${b === 1 ? "" : "s"} in → ${show(b * depositPerCupEur)}` : b < 0 ? `bracht ${-b} binnen → krijgt ${show(-b * depositPerCupEur)}` : "in orde ✓"}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...S.btn, flex: 1 }} onClick={() => setView("order")}>← terug</button>
        <button style={{ ...S.btn, flex: 1 }} onClick={resetAll}>↺ opnieuw</button>
      </div>
    </div></div>
  )

  function drinkTotalRound(r: Round, did: string) { return Object.values(r.orders[did] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[did] ?? 0) }
}
