"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Group = {
  id: string
  name: string
  invite_code: string
  owner_id: string
}

type Drink = {
  id: string
  name: string
  price: number
  emoji: string
  category: string | null
}

type DrinkLibraryItem = {
  id: string
  name: string
  emoji: string
  category: string | null
  default_price: number
  search_tags: string | null
}

type Participant = {
  id: string
  name: string
  group_id: string
  is_placeholder?: boolean // true if auto-created "Persoon 1" type name without a real name yet
}

type Order = {
  id: string
  participant_id: string | null
  drink_id: string
  quantity: number
  group_id: string
  session: number
}

type Payment = {
  id: string
  group_id: string
  session: number
  participant_id: string
  amount: number
}

type DrinkForm = {
  name: string
  price: string
  emoji: string
  category: string
}

type VoiceState = "idle" | "listening" | "done" | "error"

type SavedGroup = {
  id: string
  name: string
  invite_code: string
  savedAt: number
}

type QuickOrderDrink = {
  name: string
  qty: number
  emoji: string
  assignments: { participantId: string; qty: number }[]
}

type QuickOrderItem = {
  id: string
  text: string
  drinks: QuickOrderDrink[]
  timestamp: number
}

type AppView = "setup" | "ordering" | "rounds" | "bill"

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  Bier:      "🍺 Bier",
  Frisdrank: "🥤 Water & Frisdrank",
  Wijn:      "🍷 Wijn & Cava",
  Cocktail:  "🍸 Cocktails",
}
const FALLBACK_CATEGORY = "Cocktail"
const EMOJI_MAP: Record<string, string> = {
  Bier: "🍺", Wijn: "🍷", Frisdrank: "🥤", Cocktail: "🍸",
}
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Bier:      ["bier", "pils", "tripel", "dubbel", "blonde", "bruin", "lager", "ale", "ipa", "stout", "weizen", "geuze", "lambic", "kriek"],
  Wijn:      ["wijn", "cava", "prosecco", "champagne", "rosé", "rose", "bordeaux", "chardonnay", "pinot", "sauvignon"],
  Frisdrank: ["cola", "fanta", "sprite", "water", "ice tea", "icetea", "limonade", "tonic", "soda", "juice", "sap", "frisdrank", "appelsap", "sinaas", "spa"],
  Cocktail:  ["cocktail", "mojito", "hugo", "gin", "vodka", "rum", "whisky", "whiskey", "aperol", "spritz", "martini", "margarita", "daiquiri", "cosmopolitan"],
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

function getOrCreateOwnerId(): string {
  if (typeof window === "undefined") return randomId()
  const key = "rondje_owner_id"
  let id = localStorage.getItem(key)
  if (!id) { id = randomId(); localStorage.setItem(key, id) }
  return id
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function getSavedGroups(): SavedGroup[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem("rondje_saved_groups") || "[]") } catch { return [] }
}

function saveGroupToStorage(group: Group) {
  const groups = getSavedGroups().filter((g) => g.id !== group.id)
  groups.unshift({ id: group.id, name: group.name, invite_code: group.invite_code, savedAt: Date.now() })
  localStorage.setItem("rondje_saved_groups", JSON.stringify(groups.slice(0, 20)))
}

function removeGroupFromStorage(id: string) {
  const groups = getSavedGroups().filter((g) => g.id !== id)
  localStorage.setItem("rondje_saved_groups", JSON.stringify(groups))
}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE / DRINK NAME HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function guessCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return cat
  }
  return FALLBACK_CATEGORY
}

function normalizeDrinkName(s: string): string {
  return s.toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/  +/g, " ")
    .trim()
}

function fuzzyMatchDrink(spokenName: string, drinkList: Drink[]): Drink | null {
  const spoken = normalizeDrinkName(spokenName)
  const spokenWords = spoken.split(" ").filter((w) => w.length > 1)
  if (!spoken) return null

  let m = drinkList.find((d) => normalizeDrinkName(d.name) === spoken)
  if (m) return m

  m = drinkList.find((d) => {
    const dn = normalizeDrinkName(d.name)
    return spoken.includes(dn) || dn.includes(spoken)
  })
  if (m) return m

  m = drinkList.find((d) => {
    const dn = normalizeDrinkName(d.name)
    return spokenWords.length > 0 && spokenWords.every((w) => dn.includes(w))
  })
  if (m) return m

  let bestScore = 0
  let bestDrink: Drink | null = null
  for (const d of drinkList) {
    const dn = normalizeDrinkName(d.name).split(" ")
    const matches = spokenWords.filter((w) => dn.some((dw) => dw.includes(w) || w.includes(dw))).length
    const score = spokenWords.length > 0 ? matches / spokenWords.length : 0
    if (score > bestScore) { bestScore = score; bestDrink = d }
  }
  return bestScore >= 0.5 ? bestDrink : null
}

function extractPrice(text: string): string {
  const lower = text.toLowerCase()
  const numMatch = lower.match(/€?\s*(\d+)[.,](\d{1,2})/)
  if (numMatch) return `${numMatch[1]}.${numMatch[2].padEnd(2, "0")}`
  const euroMatch = lower.match(/€\s*(\d+)\b|(\d+)\s*euro/)
  if (euroMatch) return euroMatch[1] ?? euroMatch[2]
  return ""
}

function cleanDrinkName(text: string): string {
  return text
    .replace(/€?\s*\d+[.,]\d{1,2}/g, "")
    .replace(/€\s*\d+/g, "")
    .replace(/\d+\s*euro/gi, "")
    .replace(/\s+/g, " ").trim()
    .replace(/^./, (c) => c.toUpperCase())
}

// Parse spoken text into one or more drink+qty items
function parseSpokenDrinks(text: string, drinkList: Drink[]): { name: string; qty: number; emoji: string }[] {
  const lower = text.toLowerCase().replace(/één/g, "een").replace(/cola's|colas/g, "cola").replace(/wijntje/g, "wijn")

  const numberWords: Record<string, number> = {
    een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7,
    acht: 8, negen: 9, tien: 10, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
  }

  const results: { name: string; qty: number; emoji: string }[] = []
  let remaining = lower
  let safety = 0

  while (remaining.trim().length > 0 && safety < 20) {
    safety++
    remaining = remaining.trim()

    let qty = 1
    const qtyMatch = remaining.match(/^(\d+|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\s+/)
    if (qtyMatch) {
      qty = numberWords[qtyMatch[1]] ?? parseInt(qtyMatch[1]) ?? 1
      remaining = remaining.slice(qtyMatch[0].length)
    }

    // Try matching against real drink names first (longest match wins)
    let matched = false
    const sortedDrinks = [...drinkList].sort((a, b) => b.name.length - a.name.length)
    for (const d of sortedDrinks) {
      const dn = normalizeDrinkName(d.name)
      const remNorm = normalizeDrinkName(remaining)
      if (remNorm.startsWith(dn) && dn.length > 0) {
        const existing = results.find((r) => r.name === d.name)
        if (existing) existing.qty += qty
        else results.push({ name: d.name, qty, emoji: d.emoji })
        // consume roughly that many characters (approx by word count)
        const wordCount = dn.split(" ").length
        const remWords = remaining.trim().split(/\s+/)
        remaining = remWords.slice(wordCount).join(" ")
        remaining = remaining.replace(/^\s*(en|met|ook|plus|,)\s*/, "")
        matched = true
        break
      }
    }

    if (!matched) {
      const skip = remaining.match(/^(\S+)\s*/)
      if (skip) remaining = remaining.slice(skip[0].length)
      else break
    }
  }

  if (results.length === 0 && text.trim()) {
    const cat = guessCategory(text)
    const fuzzy = fuzzyMatchDrink(text, drinkList)
    if (fuzzy) results.push({ name: fuzzy.name, qty: 1, emoji: fuzzy.emoji })
    else results.push({ name: cleanDrinkName(text) || text, qty: 1, emoji: EMOJI_MAP[cat] ?? "🍹" })
  }

  return results
}

function groupDrinksByCategory(drinks: Drink[]): [string, Drink[]][] {
  const map: Record<string, Drink[]> = {}
  drinks.forEach((d) => {
    const key = d.category ?? FALLBACK_CATEGORY
    if (!map[key]) map[key] = []
    map[key].push(d)
  })
  const knownOrder = Object.keys(CATEGORY_LABELS)
  const allKeys = [
    ...knownOrder.filter((k) => map[k]?.length),
    ...Object.keys(map).filter((k) => !knownOrder.includes(k) && map[k]?.length),
  ]
  return allKeys.map((k) => [CATEGORY_LABELS[k] ?? k, map[k]])
}

// ═══════════════════════════════════════════════════════════════════════════
// BILL / FAIR SPLIT CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

type PersonBillLine = {
  participantId: string
  name: string
  drinkValue: number   // sum of (richtprijs × qty) for everything this person drank
  paid: number         // sum of payments this person made
}

function calculateBill(
  participants: Participant[],
  orders: Order[],
  drinks: Drink[],
  payments: Payment[]
): { lines: PersonBillLine[]; totalDrinkValue: number; totalPaid: number; difference: number } {
  const lines: PersonBillLine[] = participants.map((p) => {
    const drinkValue = orders
      .filter((o) => o.participant_id === p.id)
      .reduce((sum, o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)
        return sum + (d?.price ?? 0) * o.quantity
      }, 0)
    const paid = payments.filter((pay) => pay.participant_id === p.id).reduce((s, pay) => s + pay.amount, 0)
    return { participantId: p.id, name: p.name, drinkValue, paid }
  })

  const totalDrinkValue = lines.reduce((s, l) => s + l.drinkValue, 0)
  const totalPaid = lines.reduce((s, l) => s + l.paid, 0)
  const difference = totalPaid - totalDrinkValue // positive = paid more than richtprijs total, negative = paid less

  return { lines, totalDrinkValue, totalPaid, difference }
}

// Fair split: redistribute the difference (surplus or shortfall) using
// 20% equally among all participants + 80% weighted by how much each person drank (by value)
function calculateFairSplit(
  lines: PersonBillLine[],
  difference: number,
  equalWeight = 0.2
): { participantId: string; name: string; owes: number; fairShare: number; paid: number; balance: number }[] {
  const n = lines.length
  if (n === 0) return []
  const totalDrinkValue = lines.reduce((s, l) => s + l.drinkValue, 0)

  return lines.map((l) => {
    // Each person's "fair share" of the total cost = their drink value adjusted by the difference,
    // split 20% equally / 80% by consumption weight
    const equalPart = (totalDrinkValue + difference) * equalWeight / n
    const weightPart = totalDrinkValue > 0
      ? (totalDrinkValue + difference) * (1 - equalWeight) * (l.drinkValue / totalDrinkValue)
      : (totalDrinkValue + difference) * (1 - equalWeight) / n
    const fairShare = equalPart + weightPart
    const balance = l.paid - fairShare // positive = should get money back, negative = still owes
    return {
      participantId: l.participantId,
      name: l.name,
      owes: fairShare,
      fairShare,
      paid: l.paid,
      balance,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function QRModal({ inviteCode, onClose }: { inviteCode: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
    script.onload = () => {
      if (!containerRef.current) return
      containerRef.current.innerHTML = ""
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (window as any).QRCode(containerRef.current, { text: inviteCode, width: 200, height: 200, colorDark: "#1a2e6e", colorLight: "#ffffff", correctLevel: 2 })
    }
    document.head.appendChild(script)
    return () => { try { document.head.removeChild(script) } catch { /* ignore */ } }
  }, [inviteCode])
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, textAlign: "center" }}>
        <h3 style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>📱 QR-code delen</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Scan om deel te nemen aan <b>{inviteCode}</b></p>
        <div ref={containerRef} style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", marginBottom: 16 }} />
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 8, color: "#2255cc", marginBottom: 20 }}>{inviteCode}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.btn, flex: 1 }} onClick={() => navigator.clipboard?.writeText(inviteCode)}>📋 Kopieer</button>
          <button style={{ ...S.btn, flex: 1 }} onClick={onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t) }, [onDone])
  return <div style={S.toast}>{message}</div>
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  // ── App flow state ────────────────────────────────────────────────────────
  const [view, setView] = useState<AppView>("setup")
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedSearch, setSavedSearch] = useState("")
  const [isSaved, setIsSaved] = useState(false)

  const [group, setGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [mode, setMode] = useState<"create" | "join">("create")
  const [isStarting, setIsStarting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [library, setLibrary] = useState<DrinkLibraryItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  const [personCount, setPersonCount] = useState(4)
  const [editingPerson, setEditingPerson] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState("")

  const [session, setSession] = useState(1)
  const [cart, setCart] = useState<Record<string, number>>({}) // drinkId -> qty, for current round being built
  const [showPrices, setShowPrices] = useState(false)

  const [showAddPerson, setShowAddPerson] = useState(false)
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [newDrink, setNewDrink] = useState<DrinkForm>({ name: "", price: "", emoji: "", category: "Bier" })
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)

  const [roundFullscreen, setRoundFullscreen] = useState<number | null>(null)
  const [editingRound, setEditingRound] = useState<number | null>(null)
  const [paymentEditRound, setPaymentEditRound] = useState<number | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<Record<string, string>>({}) // participantId -> amount string

  const [showBillPrices, setShowBillPrices] = useState(false)
  const [showFairSplit, setShowFairSplit] = useState(false)

  // ── Voice (quick order) state ────────────────────────────────────────────
  const [quickItems, setQuickItems] = useState<QuickOrderItem[]>([])
  const [quickVoiceActive, setQuickVoiceActive] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quickRecogRef = useRef<any>(null)

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadDrinks = useCallback(async () => {
    const { data, error } = await supabase.from("drinks").select("*")
    if (error) { setError("Drankjes laden mislukt"); return }
    if (mounted.current) setDrinks(data || [])
  }, [])

  const loadLibrary = useCallback(async () => {
    const { data } = await supabase.from("drink_library").select("*").order("name")
    if (mounted.current) setLibrary(data || [])
  }, [])

  const loadAll = useCallback(async (groupId: string) => {
    const [{ data: p, error: pe }, { data: o, error: oe }, { data: pay, error: paye }] = await Promise.all([
      supabase.from("participants").select("*").eq("group_id", groupId),
      supabase.from("orders").select("*").eq("group_id", groupId),
      supabase.from("payments").select("*").eq("group_id", groupId),
    ])
    if (pe || oe) { setError("Data laden mislukt"); return }
    if (mounted.current) {
      setParticipants(p || [])
      setOrders(o || [])
      if (!paye) setPayments(pay || [])
    }
  }, [])

  useEffect(() => { loadDrinks(); loadLibrary() }, [loadDrinks, loadLibrary])
  useEffect(() => { setSavedGroups(getSavedGroups()) }, [])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!group) return
    const channel = supabase.channel(`group-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `group_id=eq.${group.id}` }, () => { if (mounted.current) loadAll(group.id) })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `group_id=eq.${group.id}` }, () => { if (mounted.current) loadAll(group.id) })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `group_id=eq.${group.id}` }, () => { if (mounted.current) loadAll(group.id) })
      .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, () => { if (mounted.current) loadDrinks() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [group, loadAll, loadDrinks])

  // ── Group create / join ──────────────────────────────────────────────────
  const startGroup = async () => {
    if (!groupName.trim() || isStarting) return
    setIsStarting(true)
    try {
      const owner_id = getOrCreateOwnerId()
      const invite_code = generateInviteCode()
      const { data, error } = await supabase.from("groups").insert([{ name: groupName.trim(), invite_code, owner_id }]).select().single()
      if (error || !data) { setError("Groep aanmaken mislukt: " + error?.message); return }
      setGroup(data)
      setShowInviteCode(true)
      await loadAll(data.id)
      saveGroupToStorage(data)
      setSavedGroups(getSavedGroups())
      setIsSaved(true)
      setView("setup")
    } finally { setIsStarting(false) }
  }

  const joinGroup = async (codeOverride?: string) => {
    const code = codeOverride ?? joinCode
    if (!code.trim() || isStarting) return
    setIsStarting(true)
    try {
      const { data, error } = await supabase.from("groups").select("*").eq("invite_code", code.trim().toUpperCase()).single()
      if (error || !data) { setError("Groep niet gevonden. Controleer de code."); return }
      setGroup(data)
      await loadAll(data.id)
      setIsSaved(getSavedGroups().some((g) => g.id === data.id))
      setView("setup")
    } finally { setIsStarting(false) }
  }

  // ── Person setup ─────────────────────────────────────────────────────────
  const ensurePersonCount = async (count: number) => {
    if (!group) return
    const current = participants.length
    if (count > current) {
      const toAdd = count - current
      const inserts = Array.from({ length: toAdd }, (_, i) => ({
        name: `Persoon ${current + i + 1}`,
        group_id: group.id,
      }))
      await supabase.from("participants").insert(inserts)
      await loadAll(group.id)
    } else if (count < current) {
      // Remove the last (count - current) participants — only those with no orders ideally,
      // but to keep it simple we just remove the extras from the end
      const toRemove = participants.slice(count)
      for (const p of toRemove) {
        await supabase.from("participants").delete().eq("id", p.id)
      }
      await loadAll(group.id)
    }
  }

  const addPerson = async (name?: string) => {
    if (!group) return
    const finalName = name?.trim() || `Persoon ${participants.length + 1}`
    const { error } = await supabase.from("participants").insert([{ name: finalName, group_id: group.id }])
    if (error) { setError("Persoon toevoegen mislukt"); return }
    await loadAll(group.id)
  }

  const deletePerson = async (id: string, name: string) => {
    if (!group || !confirm(`${name} verwijderen? Hun bestellingen blijven bewaard.`)) return
    const { error } = await supabase.from("participants").delete().eq("id", id)
    if (error) { setError("Persoon verwijderen mislukt"); return }
    if (editingPerson === id) setEditingPerson(null)
    setToast(`${name} verwijderd`)
    await loadAll(group.id)
  }

  const renamePerson = async () => {
    if (!group || !editingPerson || !editingPersonName.trim()) return
    const { error } = await supabase.from("participants").update({ name: editingPersonName.trim() }).eq("id", editingPerson)
    if (error) { setError("Naam wijzigen mislukt"); return }
    setEditingPerson(null)
    setEditingPersonName("")
    await loadAll(group.id)
  }

  // ── Cart (huidige open ronde) ────────────────────────────────────────────
  const addToCart = (drinkId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev }
      const newQty = (next[drinkId] ?? 0) + delta
      if (newQty <= 0) delete next[drinkId]
      else next[drinkId] = newQty
      return next
    })
  }

  const cartTotalItems = Object.values(cart).reduce((s: number, q: number) => s + q, 0)
  const cartTotalValue = Object.entries(cart).reduce((s: number, [drinkId, qty]: [string, number]) => {
    const d = drinks.find((dr) => dr.id === drinkId)
    return s + (d?.price ?? 0) * qty
  }, 0)

  const clearCart = () => setCart({})

  // Finalize the cart into an actual round — distribute evenly is too complex here,
  // so: cart items go in WITHOUT a specific person (anonymous) by default; user assigns after,
  // OR if exactly relevant flow used quick-order with assignment, that's handled separately.
  const sessions = Array.from(new Set(orders.map((o) => o.session))).sort((a, b) => a - b)
  const nextSession = Math.max(session, ...sessions, 0) + 1

  const finishRound = async () => {
    if (!group || cartTotalItems === 0) { setToast("Voeg eerst drankjes toe"); return }
    const newRoundSession = nextSession
    for (const [drinkId, qty] of Object.entries(cart) as [string, number][]) {
      if (qty <= 0) continue
      await supabase.from("orders").insert([{ participant_id: null, drink_id: drinkId, quantity: qty, group_id: group.id, session: newRoundSession }])
    }
    await loadAll(group.id)
    setCart({})
    setSession(newRoundSession)
    setToast(`Ronde ${newRoundSession} afgerond — wijs personen toe in 'Rondes'`)
    setView("rounds")
  }

  // ── Voice quick order ────────────────────────────────────────────────────
  const startQuickVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setToast("Spraak niet ondersteund in deze browser"); return }
    const recog = new SR()
    recog.lang = "nl-BE"
    recog.interimResults = false
    recog.maxAlternatives = 1
    quickRecogRef.current = recog
    recog.onstart = () => setQuickVoiceActive(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      const parsed = parseSpokenDrinks(text, drinks)
      // Snap each to fuzzy match for safety + add directly to cart
      parsed.forEach((pd) => {
        const match = fuzzyMatchDrink(pd.name, drinks)
        if (match) addToCart(match.id, pd.qty)
      })
      const item: QuickOrderItem = {
        id: randomId(), text,
        drinks: parsed.map((pd) => {
          const match = fuzzyMatchDrink(pd.name, drinks)
          return { name: match?.name ?? pd.name, emoji: match?.emoji ?? pd.emoji, qty: pd.qty, assignments: [] }
        }),
        timestamp: Date.now(),
      }
      setQuickItems((prev) => [...prev, item])
      setQuickVoiceActive(false)
      setToast(`Toegevoegd: ${parsed.map((d) => `${d.qty}× ${d.name}`).join(", ")}`)
    }
    recog.onerror = () => setQuickVoiceActive(false)
    recog.onend = () => setQuickVoiceActive(false)
    recog.start()
  }

  const stopQuickVoice = () => { quickRecogRef.current?.stop(); setQuickVoiceActive(false) }

  // ── Round editing (assign drinks to people after the fact) ─────────────
  const getRoundGrouped = (r: number) => {
    const map: Record<string, { drink: Drink; totalQty: number; anonymous: number; people: Record<string, { name: string; qty: number }> }> = {}
    orders.filter((o) => o.session === r).forEach((o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      if (!d) return
      if (!map[d.id]) map[d.id] = { drink: d, totalQty: 0, anonymous: 0, people: {} }
      map[d.id].totalQty += o.quantity
      if (!o.participant_id) { map[d.id].anonymous += o.quantity; return }
      const p = participants.find((pa) => pa.id === o.participant_id)
      if (!p) return
      if (!map[d.id].people[p.id]) map[d.id].people[p.id] = { name: p.name, qty: 0 }
      map[d.id].people[p.id].qty += o.quantity
    })
    return map
  }

  const getRoundTotal = (r: number) =>
    orders.filter((o) => o.session === r).reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)

  // Move qty from anonymous to a specific person (or between persons) for a drink in a round
  const assignAnonymousQty = async (drinkId: string, round: number, participantId: string, qty: number) => {
    if (!group || qty <= 0) return
    const anon = orders.find((o) => !o.participant_id && o.drink_id === drinkId && o.session === round)
    if (!anon || anon.quantity < qty) return
    const remaining = anon.quantity - qty
    if (remaining <= 0) await supabase.from("orders").delete().eq("id", anon.id)
    else await supabase.from("orders").update({ quantity: remaining }).eq("id", anon.id)

    const existing = orders.find((o) => o.participant_id === participantId && o.drink_id === drinkId && o.session === round)
    if (existing) await supabase.from("orders").update({ quantity: existing.quantity + qty }).eq("id", existing.id)
    else await supabase.from("orders").insert([{ participant_id: participantId, drink_id: drinkId, quantity: qty, group_id: group.id, session: round }])

    await loadAll(group.id)
  }

  const changeOrderQty = async (drinkId: string, participantId: string | null, round: number, delta: number) => {
    if (!group) return
    const existing = orders.find((o) => o.participant_id === participantId && o.drink_id === drinkId && o.session === round)
    if (delta > 0) {
      if (existing) await supabase.from("orders").update({ quantity: existing.quantity + delta }).eq("id", existing.id)
      else await supabase.from("orders").insert([{ participant_id: participantId, drink_id: drinkId, quantity: delta, group_id: group.id, session: round }])
    } else if (existing) {
      const newQty = existing.quantity + delta
      if (newQty <= 0) await supabase.from("orders").delete().eq("id", existing.id)
      else await supabase.from("orders").update({ quantity: newQty }).eq("id", existing.id)
    }
    await loadAll(group.id)
  }

  const addDrinkToRound = async (drinkId: string, round: number) => {
    await changeOrderQty(drinkId, null, round, 1)
    setToast("Drankje toegevoegd")
  }

  const deleteRound = async (round: number) => {
    if (!group || !confirm(`Ronde ${round} volledig verwijderen?`)) return
    await supabase.from("orders").delete().eq("group_id", group.id).eq("session", round)
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
    await loadAll(group.id)
    setToast(`Ronde ${round} verwijderd`)
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const openPaymentEditor = (round: number) => {
    const existing = payments.filter((p) => p.session === round)
    const draft: Record<string, string> = {}
    existing.forEach((p) => { draft[p.participant_id] = String(p.amount) })
    setPaymentDraft(draft)
    setPaymentEditRound(round)
  }

  const savePayments = async () => {
    if (!group || paymentEditRound === null) return
    const round = paymentEditRound
    // Remove old payments for this round, then insert new ones
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
    const inserts = (Object.entries(paymentDraft) as [string, string][])
      .filter(([, amt]) => parseFloat(amt) > 0)
      .map(([participantId, amt]) => ({ group_id: group.id, session: round, participant_id: participantId, amount: parseFloat(amt) }))
    if (inserts.length > 0) await supabase.from("payments").insert(inserts)
    await loadAll(group.id)
    setPaymentEditRound(null)
    setToast("Betaling opgeslagen")
  }

  const getRoundPayments = (round: number) => payments.filter((p) => p.session === round)
  const getRoundPaymentTotal = (round: number) => getRoundPayments(round).reduce((s, p) => s + p.amount, 0)

  // ── Drink CRUD ───────────────────────────────────────────────────────────
  const addDrink = async () => {
    const { name, price, emoji, category } = newDrink
    if (!name.trim() || !price) { setToast("Vul naam en prijs in"); return }
    const { error } = await supabase.from("drinks").insert([{ name: name.trim(), price: parseFloat(price), emoji: emoji || "🍹", category: category || FALLBACK_CATEGORY }])
    if (error) { setError("Drank toevoegen mislukt: " + error.message); return }
    setNewDrink({ name: "", price: "", emoji: "", category: newDrink.category })
    setToast(`${name} toegevoegd`)
    await loadDrinks()
  }

  const addDrinkFromLibrary = async (item: DrinkLibraryItem, price: number) => {
    const { error } = await supabase.from("drinks").insert([{ name: item.name, price, emoji: item.emoji, category: item.category || FALLBACK_CATEGORY }])
    if (error) { setError("Drank toevoegen mislukt"); return }
    setToast(`${item.name} toegevoegd`)
    await loadDrinks()
  }

  const saveEditedDrink = async () => {
    if (!editingDrink) return
    const { error } = await supabase.from("drinks").update({ name: editingDrink.name, price: editingDrink.price, emoji: editingDrink.emoji, category: editingDrink.category }).eq("id", editingDrink.id)
    if (error) { setError("Drank opslaan mislukt"); return }
    setEditingDrink(null)
    await loadDrinks()
  }

  const deleteDrinkFromList = async (id: string) => {
    if (!confirm("Verwijderen?")) return
    const { error } = await supabase.from("drinks").delete().eq("id", id)
    if (error) { setError("Drank verwijderen mislukt"); return }
    await loadDrinks()
  }

  // ── Computed totals ──────────────────────────────────────────────────────
  const getGlobalTotal = () => orders.reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)
  const getPersonTotal = (pid: string) => orders.filter((o) => o.participant_id === pid).reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)

  const groupedDrinks = groupDrinksByCategory(drinks)
  const bill = calculateBill(participants, orders, drinks, payments)
  const fairSplit = calculateFairSplit(bill.lines, bill.difference)

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Start screen (no group yet)
  // ═══════════════════════════════════════════════════════════════════════
  if (!group) {
    const filteredSaved = savedGroups.filter((g) => g.name.toLowerCase().includes(savedSearch.toLowerCase()))
    return (
      <div style={S.page}>
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🍺</div>
            <h1 style={S.h1}>Rondje Bijhouden</h1>
            <p style={{ color: "#8a8fa3", fontSize: 14 }}>Maak een groep aan of sluit je aan met een code</p>
          </div>

          {savedGroups.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <button onClick={() => setSavedOpen((o) => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}>
                <b style={{ fontSize: 14, color: "#555" }}>📌 Opgeslagen groepen</b>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{savedGroups.length}</span>
                  <span style={{ fontSize: 12, color: "#aaa", display: "inline-block", transform: savedOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                </div>
              </button>
              {savedOpen && (
                <div style={{ marginTop: 12 }}>
                  <input value={savedSearch} onChange={(e) => setSavedSearch(e.target.value)} placeholder="🔍 Zoek groep..." style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10, fontSize: 13 }} />
                  {filteredSaved.map((g) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderRadius: 10, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 1 }}>{g.invite_code}</div>
                      </div>
                      <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 12, padding: "5px 12px" }} onClick={() => joinGroup(g.invite_code)} disabled={isStarting}>Openen</button>
                      <button style={S.iconBtn} onClick={() => { removeGroupFromStorage(g.id); setSavedGroups(getSavedGroups()) }}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={S.card}>
            <div style={{ display: "flex", background: "#f0f2f7", borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {(["create", "join"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, border: "none", borderRadius: 10, padding: "9px 0", fontSize: 14, cursor: "pointer", fontWeight: mode === m ? 700 : 400, background: mode === m ? "#fff" : "transparent", color: mode === m ? "#333" : "#888", boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                  {m === "create" ? "✨ Nieuwe groep" : "🔗 Deelnemen"}
                </button>
              ))}
            </div>
            {mode === "create" ? (
              <>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startGroup()} placeholder="Groepsnaam (bv. Vrijdagavond)" style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
                <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 16 }} onClick={startGroup} disabled={isStarting}>{isStarting ? "Laden..." : "Start groep"}</button>
              </>
            ) : (
              <>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && joinGroup()} placeholder="Uitnodigingscode" maxLength={6} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 12, letterSpacing: 3, textAlign: "center", fontSize: 18, fontWeight: 700 }} />
                <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 16 }} onClick={() => joinGroup()} disabled={isStarting}>{isStarting ? "Zoeken..." : "Deelnemen"}</button>
              </>
            )}
            {error && (
              <div style={{ marginTop: 12, color: "#c0392b", fontSize: 13, background: "#fff0f0", borderRadius: 10, padding: "8px 12px" }}>
                ⚠️ {error}
                <button onClick={() => setError(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#c0392b" }}>✕</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Main app
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={S.page}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} } * { box-sizing: border-box; }`}</style>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {error && (
        <div style={S.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontWeight: 700 }}>✕</button>
        </div>
      )}
      {showQR && <QRModal inviteCode={group.invite_code} onClose={() => setShowQR(false)} />}

      {showLibraryPicker && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 420, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 700 }}>📚 Uit bibliotheek</h3>
            <LibraryPicker library={library} existing={drinks} onAdd={addDrinkFromLibrary} />
            <button style={{ ...S.btn, marginTop: 12, width: "100%" }} onClick={() => setShowLibraryPicker(false)}>Sluiten</button>
          </div>
        </div>
      )}

      {showAddPerson && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Persoon toevoegen</h3>
            <AddPersonForm onAdd={(name) => { addPerson(name); setShowAddPerson(false) }} onClose={() => setShowAddPerson(false)} />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 800 }}>🍻 {group.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button onClick={() => setShowInviteCode((v) => !v)} style={{ ...S.btn, fontSize: 11, padding: "2px 8px" }}>🔗 {group.invite_code}</button>
            <button onClick={() => setShowQR(true)} style={{ ...S.btn, fontSize: 11, padding: "2px 8px" }}>📱 QR</button>
            <button
              style={{ ...S.btn, fontSize: 11, padding: "2px 8px", background: isSaved ? "#eafff1" : "#fff", color: isSaved ? "#27ae60" : "#888" }}
              onClick={() => {
                if (isSaved) { removeGroupFromStorage(group.id); setIsSaved(false) }
                else { saveGroupToStorage(group); setIsSaved(true) }
                setSavedGroups(getSavedGroups())
              }}
            >
              {isSaved ? "✅" : "📌"}
            </button>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#333" }}>€{getGlobalTotal().toFixed(2)}</div>
          <div style={{ fontSize: 11, color: "#999" }}>{participants.length} pers · {sessions.length} rondes</div>
        </div>
      </div>

      {showInviteCode && (
        <div style={{ ...S.card, background: "linear-gradient(90deg,#eef3ff,#f0f8ff)", border: "1.5px solid #c5d8ff", textAlign: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#7090cc", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Uitnodigingscode</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 6, color: "#2255cc" }}>{group.invite_code}</div>
        </div>
      )}

      {/* Tab navigation */}
      <div style={S.tabBar}>
        {([
          { id: "setup", label: "👥 Groep" },
          { id: "ordering", label: "🛒 Bestellen" },
          { id: "rounds", label: "📦 Rondes" },
          { id: "bill", label: "🧾 Rekening" },
        ] as { id: AppView; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              flex: 1, border: "none", borderRadius: 12, padding: "10px 4px", fontSize: 13, cursor: "pointer",
              fontWeight: view === t.id ? 700 : 500,
              background: view === t.id ? "linear-gradient(135deg,#4f7ef7,#6ba1ff)" : "transparent",
              color: view === t.id ? "#fff" : "#777",
              boxShadow: view === t.id ? "0 4px 14px rgba(79,126,247,0.3)" : "none",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ VIEW: Setup (group + persons) ═══ */}
      {view === "setup" && (
        <div>
          <div style={S.card}>
            <h3 style={S.h3}>👥 Aantal personen</h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "12px 0" }}>
              <button
                style={{ ...S.btn, width: 44, height: 44, fontSize: 20, borderRadius: "50%" }}
                onClick={() => { const n = Math.max(1, participants.length - 1); ensurePersonCount(n) }}
              >−</button>
              <div style={{ fontSize: 36, fontWeight: 800, minWidth: 60, textAlign: "center" }}>{participants.length}</div>
              <button
                style={{ ...S.btn, ...S.btnPrimary, width: 44, height: 44, fontSize: 20, borderRadius: "50%" }}
                onClick={() => ensurePersonCount(participants.length + 1)}
              >+</button>
            </div>
            <p style={{ textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 4 }}>
              Namen zijn optioneel — pas ze aan wanneer je wil
            </p>
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ ...S.h3, marginBottom: 0 }}>Personen</h3>
              <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setShowAddPerson(true)}>+ Naam toevoegen</button>
            </div>

            {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 24 }}>Nog geen personen</div>}

            {participants.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                {editingPerson === p.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingPersonName}
                      onChange={(e) => setEditingPersonName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") renamePerson(); if (e.key === "Escape") setEditingPerson(null) }}
                      style={{ ...S.input, flex: 1 }}
                    />
                    <button style={{ ...S.btn, ...S.btnPrimary, padding: "6px 10px" }} onClick={renamePerson}>💾</button>
                    <button style={{ ...S.btn, padding: "6px 10px" }} onClick={() => setEditingPerson(null)}>✖</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>€{getPersonTotal(p.id).toFixed(2)}</span>
                    <button style={S.iconBtn} onClick={() => { setEditingPerson(p.id); setEditingPersonName(p.name) }}>✏️</button>
                    <button style={S.iconBtn} onClick={() => deletePerson(p.id, p.name)}>🗑️</button>
                  </>
                )}
              </div>
            ))}
          </div>

          <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "14px 0", fontSize: 16, marginTop: 4 }} onClick={() => setView("ordering")}>
            🛒 Start bestellen →
          </button>
        </div>
      )}

      {/* ═══ VIEW: Ordering (main focus) ═══ */}
      {view === "ordering" && (
        <div>
          {/* Voice button */}
          <div style={{ ...S.card, padding: 14 }}>
            <button
              onClick={quickVoiceActive ? stopQuickVoice : startQuickVoice}
              style={{
                ...S.btn, width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, border: "none",
                background: quickVoiceActive ? "#e74c3c" : "linear-gradient(135deg,#4f7ef7,#6ba1ff)",
                color: "#fff",
                animation: quickVoiceActive ? "pulse 1.2s infinite" : "none",
                boxShadow: quickVoiceActive ? "0 0 0 5px rgba(231,76,60,0.18)" : "0 6px 18px rgba(79,126,247,0.3)",
              }}
            >
              {quickVoiceActive ? "🔴 Luistert... (tik om te stoppen)" : "🎤 Spreek je bestelling in"}
            </button>
          </div>

          {/* Subtle price toggle */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button
              onClick={() => setShowPrices((v) => !v)}
              style={{ background: "none", border: "none", color: "#bbb", fontSize: 11, cursor: "pointer", padding: "2px 6px", textDecoration: "underline" }}
            >
              {showPrices ? "richtprijzen verbergen" : "richtprijzen tonen"}
            </button>
          </div>

          {/* Category quick-pick */}
          {groupedDrinks.map(([cat, list]) => (
            <div key={cat} style={S.card}>
              <b style={{ display: "block", marginBottom: 10, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "#999" }}>{cat}</b>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {list.map((d) => {
                  const qty = cart[d.id] ?? 0
                  return (
                    <div key={d.id} style={{ background: qty > 0 ? "rgba(79,126,247,0.08)" : "#fafbff", border: qty > 0 ? "1.5px solid rgba(79,126,247,0.35)" : "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 20 }}>{d.emoji}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{d.name}</span>
                      </div>
                      {showPrices && <span style={{ fontSize: 10, color: "#bbb" }}>≈ €{d.price.toFixed(2)}</span>}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15 }} onClick={() => addToCart(d.id, -1)}>−</button>
                        <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{qty}</span>
                        <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15, background: "rgba(79,126,247,0.12)" }} onClick={() => addToCart(d.id, 1)}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Manage drinks list (collapsed by default feel via small button) */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: 13, color: "#999" }}>Drankjes beheren</b>
              <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setShowLibraryPicker(true)}>📚 Bibliotheek</button>
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "#aaa" }}>Eigen drankje toevoegen / bewerken</summary>
              <div style={{ marginTop: 10 }}>
                {drinks.map((d) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    {editingDrink?.id === d.id ? (
                      <>
                        <input value={editingDrink.emoji} onChange={(e) => setEditingDrink({ ...editingDrink, emoji: e.target.value })} style={{ ...S.input, width: 44 }} />
                        <input value={editingDrink.name} onChange={(e) => setEditingDrink({ ...editingDrink, name: e.target.value })} style={{ ...S.input, flex: 1 }} />
                        <input type="number" value={editingDrink.price} onChange={(e) => setEditingDrink({ ...editingDrink, price: parseFloat(e.target.value) || 0 })} style={{ ...S.input, width: 64 }} />
                        <button style={{ ...S.btn, ...S.btnPrimary, padding: "4px 8px" }} onClick={saveEditedDrink}>💾</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: 13 }}>{d.emoji} {d.name} — €{d.price.toFixed(2)}</span>
                        <button style={S.iconBtn} onClick={() => setEditingDrink(d)}>✏️</button>
                        <button style={S.iconBtn} onClick={() => deleteDrinkFromList(d.id)}>🗑️</button>
                      </>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <input placeholder="Naam" value={newDrink.name} onChange={(e) => setNewDrink({ ...newDrink, name: e.target.value })} style={{ ...S.input, width: 110 }} />
                  <input type="number" placeholder="€" value={newDrink.price} onChange={(e) => setNewDrink({ ...newDrink, price: e.target.value })} style={{ ...S.input, width: 64 }} />
                  <input placeholder="🍹" value={newDrink.emoji} onChange={(e) => setNewDrink({ ...newDrink, emoji: e.target.value })} style={{ ...S.input, width: 50 }} />
                  <select value={newDrink.category} onChange={(e) => setNewDrink({ ...newDrink, category: e.target.value })} style={{ ...S.input, width: 100 }}>
                    {Object.keys(CATEGORY_LABELS).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={addDrink}>+</button>
                </div>
              </div>
            </details>
          </div>

          {/* Sticky cart bar */}
          {cartTotalItems > 0 && (
            <div style={S.stickyCart}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}</div>
                {showPrices && <div style={{ fontSize: 11, color: "#aaa" }}>≈ €{cartTotalValue.toFixed(2)}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn, fontSize: 13 }} onClick={clearCart}>Wis</button>
                <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 14, fontWeight: 700, padding: "10px 18px" }} onClick={finishRound}>✅ Bestelling klaar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ VIEW: Rounds (history, editable, payments) ═══ */}
      {view === "rounds" && (
        <div>
          {sessions.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: 32, color: "#aaa" }}>
              Nog geen rondes. Ga naar &ldquo;Bestellen&rdquo; om te beginnen.
            </div>
          )}

          {sessions.slice().reverse().map((s) => {
            const grouped = getRoundGrouped(s)
            const roundTotal = getRoundTotal(s)
            const roundPayments = getRoundPayments(s)
            const paymentTotal = getRoundPaymentTotal(s)
            const isEditing = editingRound === s

            return (
              <div key={s} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <b style={{ fontSize: 16 }}>Ronde {s}</b>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "#4f7ef7" }}>€{roundTotal.toFixed(2)}</span>
                    <button style={S.iconBtn} title="Volledig scherm" onClick={() => setRoundFullscreen(s)}>🔍</button>
                    <button style={S.iconBtn} title="Bewerken" onClick={() => setEditingRound(isEditing ? null : s)}>{isEditing ? "✓" : "✏️"}</button>
                    <button style={S.iconBtn} title="Verwijderen" onClick={() => deleteRound(s)}>🗑️</button>
                  </div>
                </div>

                {Object.values(grouped).map((it) => (
                  <div key={it.drink.id} style={{ marginTop: 8, padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b style={{ fontSize: 13 }}>{it.drink.emoji} {it.drink.name} × {it.totalQty}</b>
                      {isEditing && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button style={{ ...S.iconBtn, width: 22, height: 22, fontSize: 12 }} onClick={() => changeOrderQty(it.drink.id, null, s, -1)}>−</button>
                          <button style={{ ...S.iconBtn, width: 22, height: 22, fontSize: 12 }} onClick={() => addDrinkToRound(it.drink.id, s)}>+</button>
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: 8, marginTop: 4 }}>
                      {Object.entries(it.people).map(([pid, info]) => (
                        <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 2 }}>
                          <span style={{ color: "#666" }}>{info.name} × {info.qty}</span>
                          {isEditing && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button style={{ ...S.iconBtn, width: 20, height: 20, fontSize: 11 }} onClick={() => changeOrderQty(it.drink.id, pid, s, -1)}>−</button>
                              <button style={{ ...S.iconBtn, width: 20, height: 20, fontSize: 11 }} onClick={() => changeOrderQty(it.drink.id, pid, s, 1)}>+</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {it.anonymous > 0 && (
                        <div style={{ fontSize: 12, color: "#e67e22", marginTop: 4 }}>
                          ⚠️ {it.anonymous}× niet toegewezen
                          {isEditing && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                              {participants.map((p) => (
                                <button key={p.id} style={{ ...S.btn, fontSize: 11, padding: "2px 8px" }} onClick={() => assignAnonymousQty(it.drink.id, s, p.id, 1)}>
                                  → {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isEditing && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    <select id={`add-drink-${s}`} style={{ ...S.input, flex: 1, fontSize: 12, padding: "5px 8px" }} defaultValue={drinks[0]?.id ?? ""}>
                      {drinks.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
                    </select>
                    <button
                      style={{ ...S.btn, fontSize: 12 }}
                      onClick={() => {
                        const sel = document.getElementById(`add-drink-${s}`) as HTMLSelectElement
                        if (sel?.value) addDrinkToRound(sel.value, s)
                      }}
                    >+ Drank toevoegen</button>
                  </div>
                )}

                {/* Payment section */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  {roundPayments.length === 0 ? (
                    <button style={{ ...S.btn, fontSize: 12, width: "100%" }} onClick={() => openPaymentEditor(s)}>
                      💳 Wie betaalde?
                    </button>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Betaald door:</div>
                      {roundPayments.map((p) => {
                        const person = participants.find((pa) => pa.id === p.participant_id)
                        return (
                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                            <span>{person?.name ?? "?"}</span>
                            <span style={{ fontWeight: 700 }}>€{p.amount.toFixed(2)}</span>
                          </div>
                        )
                      })}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: paymentTotal === roundTotal ? "#27ae60" : "#e67e22", marginTop: 4 }}>
                        <span>Totaal betaald</span>
                        <span>€{paymentTotal.toFixed(2)} / €{roundTotal.toFixed(2)}</span>
                      </div>
                      <button style={{ ...S.btn, fontSize: 11, marginTop: 6, width: "100%" }} onClick={() => openPaymentEditor(s)}>Wijzigen</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Payment editor modal */}
      {paymentEditRound !== null && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 380 }}>
            <h3 style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>💳 Ronde {paymentEditRound} — wie betaalde?</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Vul in hoeveel elke persoon betaalde (kan er meer dan 1 zijn)</p>
            {participants.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: "#999" }}>€</span>
                <input
                  type="number"
                  placeholder="0"
                  value={paymentDraft[p.id] ?? ""}
                  onChange={(e) => setPaymentDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  style={{ ...S.input, width: 80 }}
                />
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 12, marginBottom: 16, color: "#888" }}>
              <span>Som ingevuld</span>
              <span style={{ fontWeight: 700 }}>€{Object.values(paymentDraft).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={savePayments}>💾 Opslaan</button>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setPaymentEditRound(null)}>Annuleer</button>
            </div>
          </div>
        </div>
      )}

      {/* Round fullscreen */}
      {roundFullscreen !== null && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 2000, overflowY: "auto", padding: 32 }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>🧾 Ronde {roundFullscreen}</h2>
              <button style={S.btn} onClick={() => setRoundFullscreen(null)}>✕ Sluiten</button>
            </div>
            {Object.values(getRoundGrouped(roundFullscreen)).map((it) => (
              <div key={it.drink.id} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16 }}>
                <span style={{ fontSize: 40 }}>{it.drink.emoji}</span>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#333" }}>{it.totalQty}× {it.drink.name}</div>
                  <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>
                    {Object.values(it.people).map((p) => `${p.name} (${p.qty})`).join(", ")}
                    {it.anonymous > 0 && ` + ${it.anonymous} niet toegewezen`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ VIEW: Bill ═══ */}
      {view === "bill" && (
        <div>
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ ...S.h3, marginBottom: 0 }}>🧾 Rekening overzicht</h3>
              <button onClick={() => setShowBillPrices((v) => !v)} style={{ ...S.btn, fontSize: 12 }}>
                {showBillPrices ? "👁️ Verberg richtprijzen" : "👁️ Geef richtprijzen"}
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              {bill.lines.map((l) => (
                <div key={l.participantId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</span>
                  <div style={{ textAlign: "right" }}>
                    {showBillPrices && <div style={{ fontSize: 13, color: "#666" }}>dronk: €{l.drinkValue.toFixed(2)}</div>}
                    <div style={{ fontSize: 12, color: l.paid > 0 ? "#27ae60" : "#bbb" }}>betaald: €{l.paid.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            {showBillPrices && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(0,0,0,0.03)", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#888" }}>Totaal richtprijzen</span>
                  <span style={{ fontWeight: 700 }}>€{bill.totalDrinkValue.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4 }}>
                  <span style={{ color: "#888" }}>Totaal echt betaald</span>
                  <span style={{ fontWeight: 700 }}>€{bill.totalPaid.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <span style={{ color: bill.difference >= 0 ? "#27ae60" : "#e74c3c", fontWeight: 700 }}>
                    {bill.difference >= 0 ? "Meer betaald dan richtprijs" : "Minder betaald dan richtprijs"}
                  </span>
                  <span style={{ fontWeight: 800, color: bill.difference >= 0 ? "#27ae60" : "#e74c3c" }}>
                    {bill.difference >= 0 ? "+" : ""}€{bill.difference.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {showBillPrices && Math.abs(bill.difference) > 0.01 && (
              <button
                onClick={() => setShowFairSplit((v) => !v)}
                style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 14, padding: "12px 0", fontSize: 14 }}
              >
                ⚖️ {showFairSplit ? "Verberg" : "Toon"} Fair Split
              </button>
            )}
          </div>

          {showFairSplit && showBillPrices && (
            <div style={S.card}>
              <h3 style={S.h3}>⚖️ Fair Split</h3>
              <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>
                Het verschil wordt eerlijk verdeeld: 20% gelijk over iedereen, 80% naar wie meer/minder dronk qua waarde. Dit is een benadering, geen exacte afrekening.
              </p>
              {fairSplit.map((f) => (
                <div key={f.participantId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "#999" }}>fair deel: €{f.fairShare.toFixed(2)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: f.balance >= 0 ? "#27ae60" : "#e74c3c" }}>
                      {f.balance >= 0 ? `krijgt €${f.balance.toFixed(2)} terug` : `moet nog €${Math.abs(f.balance).toFixed(2)} bijleggen`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 40, color: "#aaa", fontSize: 12 }}>
            {participants.length} personen · {sessions.length} rondes · {orders.reduce((s, o) => s + o.quantity, 0)} drankjes
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SMALL HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function AddPersonForm({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const submit = () => { onAdd(name.trim()); }
  return (
    <>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Naam (optioneel)..."
        style={{ ...S.input, width: "100%", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={submit}>Toevoegen</button>
        <button style={{ ...S.btn, flex: 1 }} onClick={onClose}>Annuleer</button>
      </div>
    </>
  )
}

function LibraryPicker({ library, existing, onAdd }: { library: DrinkLibraryItem[]; existing: Drink[]; onAdd: (item: DrinkLibraryItem, price: number) => void }) {
  const [search, setSearch] = useState("")
  const [prices, setPrices] = useState<Record<string, string>>({})
  const filtered = library.filter((d) => {
    const q = search.toLowerCase()
    return d.name.toLowerCase().includes(q) || (d.search_tags ?? "").toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q)
  })
  const alreadyAdded = (item: DrinkLibraryItem) => existing.some((e) => e.name === item.name)
  return (
    <>
      <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek..." style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
      <div style={{ overflowY: "auto", flex: 1, maxHeight: "50vh" }}>
        {filtered.map((item) => {
          const added = alreadyAdded(item)
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: "#999" }}>{item.category}</div>
              </div>
              <input type="number" placeholder={`€${item.default_price.toFixed(2)}`} value={prices[item.id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))} style={{ ...S.input, width: 72 }} disabled={added} />
              <button style={{ ...S.btn, ...(added ? {} : S.btnPrimary), fontSize: 12, padding: "5px 10px" }} disabled={added} onClick={() => { const price = parseFloat(prices[item.id] ?? "") || item.default_price; onAdd(item, price) }}>
                {added ? "✓" : "+"}
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20 }}>Niets gevonden</div>}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const S: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    background: "linear-gradient(160deg,#f4f6ff,#eef1fb,#fafbff)",
    minHeight: "100vh",
    color: "#222",
    maxWidth: 720,
    margin: "0 auto",
  },
  card: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 4px 18px rgba(20,20,60,0.05)",
    marginBottom: 12,
  },
  btn: {
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    borderRadius: 12,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 14,
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#4f7ef7,#6ba1ff)",
    color: "white",
    border: "none",
    boxShadow: "0 4px 14px rgba(79,126,247,0.3)",
  },
  iconBtn: {
    border: "none",
    background: "rgba(0,0,0,0.04)",
    borderRadius: "50%",
    width: 30,
    height: 30,
    fontSize: 14,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  h1: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 },
  h3: { fontSize: 16, fontWeight: 800, marginBottom: 12, letterSpacing: -0.2 },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    padding: "4px 2px",
  },
  tabBar: {
    display: "flex",
    gap: 6,
    background: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 5,
    marginBottom: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  stickyCart: {
    position: "fixed",
    bottom: 16,
    left: 16,
    right: 16,
    maxWidth: 720 - 32,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 18,
    padding: "14px 18px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 500,
    border: "1px solid rgba(0,0,0,0.06)",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff", borderRadius: 20, padding: 24, width: 360,
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "85vh", display: "flex", flexDirection: "column",
  },
  toast: {
    position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#222", color: "#fff",
    padding: "10px 20px", borderRadius: 40, fontSize: 14, fontWeight: 500, zIndex: 2000,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center",
  },
  errorBanner: {
    background: "#fff0f0", border: "1px solid #fcc", color: "#c0392b", borderRadius: 12, padding: "10px 16px",
    marginBottom: 12, display: "flex", alignItems: "center", fontSize: 14,
  },
}
