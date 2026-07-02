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

// Stabiele volgorde zodat personen niet verspringen na een refetch (rename/insert).
// Gebruikt created_at indien aanwezig (= volgorde van toevoegen), anders id als stabiele sleutel.
function orderStable<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ca = (a as unknown as { created_at?: string }).created_at
    const cb = (b as unknown as { created_at?: string }).created_at
    if (ca && cb && ca !== cb) return ca < cb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

// Verwijdert een datum-achtervoegsel "(… )" achteraan een groepsnaam, voor naam-vergelijking
function stripDateSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim()
}

// Korte datum zoals "01 May 2026"
function shortDateLabel(d = new Date()): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// Nummer achteraan een naam ("Persoon 3" -> 3), anders null
function nameNumberSuffix(name: string): number | null {
  const m = name.match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

// Kleinste positieve nummer dat nog niet gebruikt is (voor unieke "Persoon N")
function smallestFreeNumber(used: Set<number>): number {
  let i = 1
  while (used.has(i)) i++
  return i
}

// Personen in logische volgorde: created_at (indien aanwezig & verschillend) → nummer in naam → id
function orderParticipants<T extends { id: string; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ca = (a as unknown as { created_at?: string }).created_at
    const cb = (b as unknown as { created_at?: string }).created_at
    if (ca && cb && ca !== cb) return ca < cb ? -1 : 1
    const na = nameNumberSuffix(a.name)
    const nb = nameNumberSuffix(b.name)
    if (na != null && nb != null && na !== nb) return na - nb
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
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
  participant_id: string | null  // null = betaald uit de pot
  amount: number
  created_at?: string  // gebruikt om pot-inleg te groeperen per "pot" (eerste, tweede, …)
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
  Andere:    "Andere",
}
const FALLBACK_CATEGORY = "Cocktail"
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

// Actieve groep onthouden binnen dezelfde sessie: overleeft een refresh,
// maar wordt gewist zodra de tab sluit (sessionStorage i.p.v. localStorage).
function getActiveGroupCode(): string | null {
  if (typeof window === "undefined") return null
  try { return sessionStorage.getItem("rondje_active_group") } catch { return null }
}

function setActiveGroupCode(code: string) {
  try { sessionStorage.setItem("rondje_active_group", code) } catch { /* sessionStorage niet beschikbaar */ }
}

function clearActiveGroupCode() {
  try { sessionStorage.removeItem("rondje_active_group") } catch { /* sessionStorage niet beschikbaar */ }
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

type DrinkMatchResult = {
  strongMatch: Drink | null     // confident match — safe to auto-add
  suggestion: Drink | null      // weaker/phonetic match — show as "bedoelde je...?" but don't auto-add
}

function fuzzyMatchDrink(spokenName: string, drinkList: Drink[]): Drink | null {
  return matchDrinkWithSuggestion(spokenName, drinkList).strongMatch
}

// Simple character-level edit distance, used to catch phonetic near-misses like "puntje" vs "pintje"
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function matchDrinkWithSuggestion(spokenName: string, drinkList: Drink[]): DrinkMatchResult {
  const spoken = normalizeDrinkName(spokenName)
  const spokenWords = spoken.split(" ").filter((w) => w.length > 1)
  if (!spoken || drinkList.length === 0) return { strongMatch: null, suggestion: null }

  // 1. Exact match
  let m = drinkList.find((d) => normalizeDrinkName(d.name) === spoken)
  if (m) return { strongMatch: m, suggestion: null }

  // 2. One contains the other (substring) — confident enough to auto-add
  m = drinkList.find((d) => {
    const dn = normalizeDrinkName(d.name)
    return spoken.includes(dn) || dn.includes(spoken)
  })
  if (m) return { strongMatch: m, suggestion: null }

  // 3. All spoken words appear in the drink name — confident
  m = drinkList.find((d) => {
    const dn = normalizeDrinkName(d.name)
    return spokenWords.length > 0 && spokenWords.every((w) => dn.includes(w))
  })
  if (m) return { strongMatch: m, suggestion: null }

  // 4. Word-overlap scoring + phonetic (edit distance) scoring combined.
  // High score (>= 0.7) = confident enough to auto-add.
  // Medium score (0.4–0.7) = only a suggestion, don't auto-add.
  let bestScore = 0
  let bestDrink: Drink | null = null
  for (const d of drinkList) {
    const dn = normalizeDrinkName(d.name)
    const dnWords = dn.split(" ")
    const wordMatches = spokenWords.filter((w) => dnWords.some((dw) => dw.includes(w) || w.includes(dw))).length
    const wordScore = spokenWords.length > 0 ? wordMatches / spokenWords.length : 0

    // Phonetic similarity on the whole normalized strings (handles "puntje" vs "pintje")
    const maxLen = Math.max(spoken.length, dn.length)
    const editScore = maxLen > 0 ? 1 - levenshtein(spoken, dn) / maxLen : 0

    const score = Math.max(wordScore, editScore)
    if (score > bestScore) { bestScore = score; bestDrink = d }
  }

  if (bestScore >= 0.7) return { strongMatch: bestDrink, suggestion: null }
  if (bestScore >= 0.4) return { strongMatch: null, suggestion: bestDrink }
  return { strongMatch: null, suggestion: null }
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
type ParsedSpeechResult = {
  recognized: { name: string; qty: number; emoji: string }[]
  unrecognizedText: string | null         // raw leftover text that didn't match anything
  suggestion: { drink: Drink; qty: number } | null  // best guess for the unrecognized part, for "bedoelde je...?"
}

function parseSpokenDrinks(text: string, drinkList: Drink[]): ParsedSpeechResult {
  const lower = text.toLowerCase().replace(/één/g, "een").replace(/cola's|colas/g, "cola").replace(/wijntje/g, "wijn")

  const numberWords: Record<string, number> = {
    een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7,
    acht: 8, negen: 9, tien: 10, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
  }

  const recognized: { name: string; qty: number; emoji: string }[] = []
  const unmatchedChunks: { text: string; qty: number }[] = []
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

    // Try matching against real drink names first (longest match wins) — exact/substring only, very confident
    let matched = false
    const sortedDrinks = [...drinkList].sort((a, b) => b.name.length - a.name.length)
    for (const d of sortedDrinks) {
      const dn = normalizeDrinkName(d.name)
      const remNorm = normalizeDrinkName(remaining)
      if (remNorm.startsWith(dn) && dn.length > 0) {
        const existing = recognized.find((r) => r.name === d.name)
        if (existing) existing.qty += qty
        else recognized.push({ name: d.name, qty, emoji: d.emoji })
        const wordCount = dn.split(" ").length
        const remWords = remaining.trim().split(/\s+/)
        remaining = remWords.slice(wordCount).join(" ")
        remaining = remaining.replace(/^\s*(en|met|ook|plus|,)\s*/, "")
        matched = true
        break
      }
    }

    if (!matched) {
      // Take the next "chunk" (1-3 words) as a candidate for fuzzy matching / suggestion
      const words = remaining.trim().split(/\s+/)
      const chunkWords = words.slice(0, Math.min(3, words.length))
      const chunk = chunkWords.join(" ")
      if (chunk) unmatchedChunks.push({ text: chunk, qty })
      remaining = words.slice(chunkWords.length).join(" ")
      if (!remaining) break
    }
  }

  // For unmatched chunks, try the fuzzy+phonetic matcher — only as a SUGGESTION, never auto-added
  let suggestion: { drink: Drink; qty: number } | null = null
  let unrecognizedText: string | null = null
  if (unmatchedChunks.length > 0) {
    for (const chunk of unmatchedChunks) {
      const result = matchDrinkWithSuggestion(chunk.text, drinkList)
      if (result.strongMatch) {
        const existing = recognized.find((r) => r.name === result.strongMatch!.name)
        if (existing) existing.qty += chunk.qty
        else recognized.push({ name: result.strongMatch.name, qty: chunk.qty, emoji: result.strongMatch.emoji })
      } else if (result.suggestion && !suggestion) {
        suggestion = { drink: result.suggestion, qty: chunk.qty }
        unrecognizedText = chunk.text
      } else if (!suggestion) {
        unrecognizedText = chunk.text
      }
    }
  }

  return { recognized, unrecognizedText, suggestion }
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
): { lines: PersonBillLine[]; totalDrinkValue: number; anonymousValue: number; totalPaid: number; totalActuallySpent: number; difference: number } {
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

  const anonymousValue = orders
    .filter((o) => !o.participant_id)
    .reduce((sum, o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      return sum + (d?.price ?? 0) * o.quantity
    }, 0)

  const totalDrinkValue = lines.reduce((s, l) => s + l.drinkValue, 0) + anonymousValue
  const totalPaid = lines.reduce((s, l) => s + l.paid, 0) // alle inleg (pot vooraf + door personen betaalde rondes)
  // Wat er écht aan de toog betaald werd voor rondes (sessie >= 1), zowel door personen als uit de pot.
  // De pot-inleg (sessie 0) telt NIET als uitgave — dat is geld dat nog (deels) terug moet.
  const totalActuallySpent = payments.filter((pay) => pay.session >= 1).reduce((s, pay) => s + pay.amount, 0)
  const difference = totalPaid - totalDrinkValue // positive = paid more than richtprijs total, negative = paid less

  return { lines, totalDrinkValue, anonymousValue, totalPaid, totalActuallySpent, difference }
}

// Fair split: verdeel het bedrag dat ÉCHT aan rondes uitgegeven werd (splitBase)
// over de deelnemers: 20% gelijk + 80% naar hoeveel elk dronk (op richtprijs).
// De pot-inleg blijft buiten beschouwing als "uitgave"; het overschot/tekort van
// de pot wordt nadien via settleDebts met de virtuele "de pot" verrekend.
// Verdeling van de fair split. 0 = volledig volgens de waarde van wat elk dronk
// (zuiver proportioneel → ieders deel blijft zo dicht mogelijk bij de richtprijs, ook bij 1 drankje).
// Verhoog dit (bv. 0.2) als je wil dat een deel sowieso gelijk over iedereen verdeeld wordt.
const FAIR_EQUAL_WEIGHT = 0 // volledig proportioneel volgens drankwaarde

function calculateFairSplit(
  lines: PersonBillLine[],
  splitBase: number, // = totalActuallySpent (echt betaalde rondes)
  anonymousValue: number, // total richtprijs-value of orders that were never assigned to anyone
  equalWeight = FAIR_EQUAL_WEIGHT
): { participantId: string; name: string; fairShare: number; paid: number; balance: number; participated: boolean }[] {
  void anonymousValue
  const n = lines.length
  if (n === 0) return []

  const participants = lines.filter((l) => l.drinkValue > 0 || l.paid > 0)
  const nParticipating = participants.length || n

  const assignedTotal = lines.reduce((s, l) => s + l.drinkValue, 0) // som van toegewezen richtprijzen
  const drinkers = lines.filter((l) => l.drinkValue > 0)
  const nDrinkers = drinkers.length

  return lines.map((l) => {
    const participated = l.drinkValue > 0 || l.paid > 0
    if (!participated) {
      return { participantId: l.participantId, name: l.name, fairShare: 0, paid: 0, balance: 0, participated: false }
    }

    let fairShare: number
    if (nDrinkers === 0 || assignedTotal <= 0) {
      // Niemand kreeg iets toegewezen — verdeel het uitgegeven bedrag gelijk
      fairShare = splitBase / nParticipating
    } else if (l.drinkValue > 0) {
      // Deel gelijk over de drinkers + deel volgens de waarde van wat deze persoon dronk
      const gelijkDeel = (splitBase * equalWeight) / nDrinkers
      const waardeDeel = splitBase * (1 - equalWeight) * (l.drinkValue / assignedTotal)
      fairShare = gelijkDeel + waardeDeel
    } else {
      // Wel betaald maar niets gedronken → krijgt inleg terug
      fairShare = 0
    }
    if (fairShare < 0) fairShare = 0

    const balance = l.paid - fairShare // positive = should get money back, negative = still owes
    return { participantId: l.participantId, name: l.name, fairShare, paid: l.paid, balance, participated: true }
  })
}

// Debt settlement: turn balances into concrete "X pays Y €amount" transactions.
// People with balance < 0 (owe money) pay people with balance > 0 (should receive), minimizing transaction count.
// potBalance = totalActuallySpent - totalPaid: een virtuele "de pot" die het overschot
// teruggeeft (potBalance < 0 → pot is schuldenaar) of het tekort int (potBalance > 0 → pot is schuldeiser).
function settleDebts(
  fairSplit: { participantId: string; name: string; balance: number; participated: boolean }[],
  potBalance = 0
): { from: string; to: string; amount: number }[] {
  const all = [...fairSplit]
  if (Math.abs(potBalance) > 0.01) {
    all.push({ participantId: "__POT__", name: "de pot", balance: potBalance, participated: true })
  }
  const creditors = all.filter((f) => f.participated && f.balance > 0.01).map((f) => ({ ...f }))
  const debtors = all.filter((f) => f.participated && f.balance < -0.01).map((f) => ({ ...f, balance: -f.balance }))

  const transactions: { from: string; to: string; amount: number }[] = []
  let ci = 0, di = 0
  creditors.sort((a, b) => b.balance - a.balance)
  debtors.sort((a, b) => b.balance - a.balance)

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debt = debtors[di]
    const amount = Math.min(credit.balance, debt.balance)
    if (amount > 0.01) {
      transactions.push({ from: debt.name, to: credit.name, amount })
    }
    credit.balance -= amount
    debt.balance -= amount
    if (credit.balance <= 0.01) ci++
    if (debt.balance <= 0.01) di++
  }

  return transactions
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t) }, [onDone])
  return <div style={S.toast}>{message}</div>
}

// Rundo-logo: gouden cirkel met witte R en een loop-pijl (rondjes)
function RundoLogo({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <circle cx="60" cy="60" r="56" fill="#F5C518" />
      <path d="M88 36 A36 36 0 1 0 96 60" fill="none" stroke="#1b2a4a" strokeWidth="9" strokeLinecap="round" />
      <path d="M88 33 L85 53 L104 49 Z" fill="#1b2a4a" />
      <text x="60" y="84" textAnchor="middle" fontFamily="'DM Sans', Arial, sans-serif" fontSize="64" fontWeight="800" fill="#ffffff">R</text>
    </svg>
  )
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
  const [isStarting, setIsStarting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  const [personCount, setPersonCount] = useState(4)
  const [editingPerson, setEditingPerson] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState("")

  const [session, setSession] = useState(1)
  type CartLine = { total: number; assignments: Record<string, number> } // assignments: participantId -> qty
  const [cart, setCart] = useState<Record<string, CartLine>>({}) // drinkId -> CartLine
  const [lastAddedDrinkIds, setLastAddedDrinkIds] = useState<string[]>([]) // laatst toegevoegde drankjes (hele laatste selectie)
  const [openAssignFor, setOpenAssignFor] = useState<string | null>(null) // welk drankje in "Alle bestellingen" zijn toewijs-dropdown open heeft
  const [openBillAssignFor, setOpenBillAssignFor] = useState<string | null>(null) // welk drankje in het afrekenscherm zijn toewijs-dropdown open heeft
  const [billOriginallyUnassigned, setBillOriginallyUnassigned] = useState<Set<string>>(new Set()) // drankjes die bij het openen van 'afrekenen' nog niet toegewezen waren (krijgen nadien een potloodje)
  const [showPrices, setShowPrices] = useState(false)

  const [showAddPerson, setShowAddPerson] = useState(false)
  const [showEditDrinks, setShowEditDrinks] = useState(false)   // modal: namen/prijzen van bestaande dranken bewerken
  const [showAddDrink, setShowAddDrink] = useState(false)       // modal: eigen drank toevoegen
  const [showDrinkSelector, setShowDrinkSelector] = useState(false) // modal: drankje selecteren (categorie + grid)
  const [selectorDraft, setSelectorDraft] = useState<Record<string, number>>({}) // selector start telkens op 0; wordt bij "Klaar" toegevoegd
  const [lastAddedCustomDrink, setLastAddedCustomDrink] = useState<{ name: string; category: string } | null>(null) // melding in de selector na een eigen drankje
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)  // bevestiging vóór afronden
  const [showReorderPicker, setShowReorderPicker] = useState(false)  // kiezer om een vorig rondje opnieuw te bestellen
  const [reorderShowAll, setReorderShowAll] = useState(false) // toon ook oudere rondjes (standaard enkel het vorige)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null) // foutmeldingen enkel op het startscherm (bv. dubbele groep)

  const [newDrink, setNewDrink] = useState<DrinkForm>({ name: "", price: "", emoji: "", category: "Bier" })
  const [addDrinkWarn, setAddDrinkWarn] = useState<string | null>(null) // inline melding in de eigen-drank-popup
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)

  const [roundFullscreen, setRoundFullscreen] = useState<number | null>(null)
  const [openRounds, setOpenRounds] = useState<number[] | null>(null) // null = standaard (laatste open); array = expliciete keuze (meerdere mogelijk)
  const [editingRound, setEditingRound] = useState<number | null>(null)
  const [paymentEditRound, setPaymentEditRound] = useState<number | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<Record<string, string>>({}) // participantId -> amount string
  const [showPotModal, setShowPotModal] = useState(false)
  const [potWarn, setPotWarn] = useState(false) // melding bij opslaan zonder bedrag
  const [potDraft, setPotDraft] = useState<Record<string, string>>({}) // pot-inleg per persoon (sessie 0)
  const [showPotOverview, setShowPotOverview] = useState(false) // overzicht + aanvullen van de pot
  const [potAddAmount, setPotAddAmount] = useState("") // bedrag voor 'over iedereen' aanvulling (totaal)
  const [potAddMode, setPotAddMode] = useState<"all" | "each">("all") // verdeel over iedereen of per persoon
  const [potAddDraft, setPotAddDraft] = useState<Record<string, string>>({}) // bedrag per persoon (modus 'each')
  const [potBulk, setPotBulk] = useState("5") // bedrag om in één keer voor iedereen te zetten
  const [potAddBulk, setPotAddBulk] = useState("") // aanvullen: bedrag p.p. (leeg = suggesties tonen)
  const [potAddWarn, setPotAddWarn] = useState(false) // aanvullen: melding bij leeg
  const [potAddedThisSession, setPotAddedThisSession] = useState(0) // som van wat in dit pot-overzicht al toegevoegd werd
  const [potAddPerPersonOpen, setPotAddPerPersonOpen] = useState(false) // per-persoon invoer bij aanvullen in-/uitgeklapt

  const [showBillPrices, setShowBillPrices] = useState(false)
  const [showAssignPopup, setShowAssignPopup] = useState(false) // popup: drankjes toewijzen vóór Fair Split
  const [assignPopupDrinkIds, setAssignPopupDrinkIds] = useState<string[]>([]) // drankjes die bij openen van de popup nog open stonden (blijven zichtbaar om te wijzigen)
  const [showIndicatiefInfo, setShowIndicatiefInfo] = useState(false) // info-popup achter de ⓘ bij richtprijzen
  const [fairInfoMode, setFairInfoMode] = useState<null | "what" | "how">(null) // popup: wat is / hoe werkt fair split
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showFairSplit, setShowFairSplit] = useState(false)
  const [showFairSplitInfo, setShowFairSplitInfo] = useState(false)

  // ── Voice (quick order) state ────────────────────────────────────────────
  const [quickItems, setQuickItems] = useState<QuickOrderItem[]>([])
  const [voiceSuggestion, setVoiceSuggestion] = useState<{ spokenText: string; qty: number; suggested: Drink } | null>(null)
  const [quickVoiceActive, setQuickVoiceActive] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quickRecogRef = useRef<any>(null)

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadDrinks = useCallback(async () => {
    const { data, error } = await supabase.from("drinks").select("id,name,price,emoji,category")
    if (error) { setError("Drankjes laden mislukt"); return }
    if (mounted.current) setDrinks(data || [])
  }, [])

  const loadAll = useCallback(async (groupId: string) => {
    const [{ data: p, error: pe }, { data: o, error: oe }, { data: pay, error: paye }] = await Promise.all([
      supabase.from("participants").select("*").eq("group_id", groupId),
      supabase.from("orders").select("id,participant_id,drink_id,quantity,group_id,session").eq("group_id", groupId),
      supabase.from("payments").select("id,group_id,session,participant_id,amount,created_at").eq("group_id", groupId),
    ])
    if (pe || oe) { setError("Data laden mislukt"); return }
    if (mounted.current) {
      setParticipants(orderParticipants(p || []))
      setOrders(o || [])
      if (!paye) setPayments(pay || [])
    }
  }, [])

  useEffect(() => { loadDrinks() }, [loadDrinks])
  useEffect(() => { setSavedGroups(getSavedGroups()) }, [])

  // Bij het openen van het pot-overzicht: schone lei voor het aanvul-formulier
  useEffect(() => {
    if (showPotOverview) { setPotAddedThisSession(0); setPotAddDraft({}); setPotAddBulk(""); setPotAddWarn(false); setPotAddPerPersonOpen(false) }
  }, [showPotOverview])

  // Bij het openen van 'afrekenen': onthoud welke drankjes toen nog niet toegewezen waren (die krijgen nadien een potloodje)
  useEffect(() => {
    if (view === "bill") {
      const ids = new Set<string>()
      orders.forEach((o) => { if (!o.participant_id && o.quantity > 0) ids.add(o.drink_id) })
      setBillOriginallyUnassigned(ids)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!group) return
    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    let drinksTimer: ReturnType<typeof setTimeout> | null = null

    // Debounce: een reeks snelle wijzigingen (bv. een rondje afronden dat meerdere
    // orders na elkaar wegschrijft) leidt tot ÉÉN herlaad i.p.v. tientallen.
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => { if (mounted.current) loadAll(group.id) }, 400)
    }
    const scheduleDrinks = () => {
      if (drinksTimer) clearTimeout(drinksTimer)
      drinksTimer = setTimeout(() => { if (mounted.current) loadDrinks() }, 400)
    }

    const channel = supabase.channel(`group-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `group_id=eq.${group.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `group_id=eq.${group.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `group_id=eq.${group.id}` }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, scheduleDrinks)
      .subscribe()

    // Vangnet: als de tab weer zichtbaar wordt of focus krijgt, meteen verversen.
    // Zo herstelt een tab die een realtime-event miste (achtergrond, netwerk-hik)
    // zichzelf zodra je er terug naartoe klikt.
    const refreshOnReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      if (mounted.current) { loadAll(group.id); loadDrinks() }
    }
    document.addEventListener("visibilitychange", refreshOnReturn)
    window.addEventListener("focus", refreshOnReturn)

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      if (drinksTimer) clearTimeout(drinksTimer)
      document.removeEventListener("visibilitychange", refreshOnReturn)
      window.removeEventListener("focus", refreshOnReturn)
      supabase.removeChannel(channel)
    }
  }, [group, loadAll, loadDrinks])

  // ── Group create / join ──────────────────────────────────────────────────
  const startGroup = async () => {
    if (!groupName.trim() || isStarting) return
    setStartError(null)
    setError(null)
    setIsStarting(true)
    try {
      const owner_id = getOrCreateOwnerId()
      const base = stripDateSuffix(groupName.trim())
      const name = `${base} (${shortDateLabel()})`
      // Dezelfde naam mag op een andere datum — enkel blokkeren als exact dezelfde naam + datum al opgeslagen is
      const clash = getSavedGroups().some((g) => g.name.trim().toLowerCase() === name.toLowerCase())
      if (clash) {
        setStartError("Je hebt vandaag al een opgeslagen groep met die naam. Kies een andere naam of open ze bij \u201copgeslagen groepen\u201d.")
        return
      }
      const invite_code = generateInviteCode()
      const { data, error } = await supabase.from("groups").insert([{ name, invite_code, owner_id }]).select().single()
      if (error || !data) { setStartError("Groep aanmaken mislukt: " + error?.message); return }
      setGroup(data)
      setActiveGroupCode(data.invite_code) // onthoud voor deze sessie (herstel na refresh)
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
    setStartError(null)
    setError(null) // openen lukt → kan geen dubbele zijn, dus eventuele foutmelding weg
    setIsStarting(true)
    try {
      const { data, error } = await supabase.from("groups").select("*").eq("invite_code", code.trim().toUpperCase()).single()
      if (error || !data) {
        setStartError("Groep niet gevonden. Controleer de code.")
        clearActiveGroupCode() // eventueel oude/ongeldige sessie-groep opruimen
        return
      }
      setGroup(data)
      setActiveGroupCode(data.invite_code) // onthoud voor deze sessie (herstel na refresh)
      await loadAll(data.id)
      setIsSaved(getSavedGroups().some((g) => g.id === data.id))
      setView("setup")
    } finally { setIsStarting(false) }
  }

  // Herstel de laatst geopende groep na een refresh — enkel binnen dezelfde sessie.
  // Wordt automatisch vergeten zodra de tab gesloten wordt (sessionStorage).
  const didRestore = useRef(false)
  useEffect(() => {
    if (didRestore.current) return
    didRestore.current = true
    const code = getActiveGroupCode()
    if (code) joinGroup(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Person setup ─────────────────────────────────────────────────────────
  const ensurePersonCount = async (count: number) => {
    if (!group) return
    const current = participants.length
    if (count > current) {
      const toAdd = count - current
      // Eén voor één invoegen met een uniek, vrij nummer (geen dubbele "Persoon N")
      const used = new Set(participants.map((p) => nameNumberSuffix(p.name)).filter((n): n is number => n != null))
      for (let i = 0; i < toAdd; i++) {
        const num = smallestFreeNumber(used)
        used.add(num)
        await supabase.from("participants").insert([{ name: `Persoon ${num}`, group_id: group.id }])
      }
      await loadAll(group.id)
    } else if (count < current) {
      // Remove the last (count - current) participants — only those with no orders ideally,
      // but to keep it simple we just remove the extras from the end
      // Verwijder de extra's van achteraan, maar nooit iemand met een toegewezen bestelling
      const toRemove = participants.slice(count).filter((p) => !orders.some((o) => o.participant_id === p.id))
      for (const p of toRemove) {
        await supabase.from("participants").delete().eq("id", p.id)
        await supabase.from("payments").delete().eq("group_id", group.id).eq("participant_id", p.id)
      }
      await loadAll(group.id)
    }
  }

  const addPerson = async (name?: string) => {
    if (!group) return
    const used = new Set(participants.map((p) => nameNumberSuffix(p.name)).filter((n): n is number => n != null))
    const finalName = name?.trim() || `Persoon ${smallestFreeNumber(used)}`
    const { error } = await supabase.from("participants").insert([{ name: finalName, group_id: group.id }])
    if (error) { setError("Persoon toevoegen mislukt"); return }
    await loadAll(group.id)
  }

  const deletePerson = async (id: string, name: string) => {
    if (!group) return
    // Persoon met een toegewezen bestelling (in een afgerond rondje) kan niet verwijderd worden
    if (orders.some((o) => o.participant_id === id)) {
      setError(`${name} kan niet verwijderd worden: er staat al een bestelling op deze naam in een afgerond rondje.`)
      return
    }
    if (!confirm(`${name} verwijderen?`)) return
    const { error } = await supabase.from("participants").delete().eq("id", id)
    if (error) { setError("Persoon verwijderen mislukt"); return }
    // Hun betalingen/pot-inleg opruimen zodat ze nergens nog (onzichtbaar) meetellen
    await supabase.from("payments").delete().eq("group_id", group.id).eq("participant_id", id)
    setPaymentDraft((prev) => { const n = { ...prev }; delete n[id]; return n })
    setPotDraft((prev) => { const n = { ...prev }; delete n[id]; return n })
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

  // ── Cart (huidige open ronde, met per-persoon toewijzing) ────────────────
  const addToCart = (drinkId: string, delta: number, markLast = true) => {
    if (delta > 0 && markLast) setLastAddedDrinkIds([drinkId]) // onthoud laatst toegevoegd voor bovenaan in barlijst
    setCart((prev) => {
      const next = { ...prev }
      const line = next[drinkId] ?? { total: 0, assignments: {} }
      const newTotal = Math.max(0, line.total + delta)
      if (newTotal === 0) { delete next[drinkId]; return next }
      // If decreasing, also trim assignments proportionally (remove from least-specific first: reduce from any assigned person if total drops below assigned sum)
      const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
      let newAssignments = { ...line.assignments }
      if (newTotal < assignedSum) {
        // Remove from the last-touched assignment(s) until it fits — simplest: clear all if it no longer fits
        let toRemove = assignedSum - newTotal
        const keys = Object.keys(newAssignments)
        for (let i = keys.length - 1; i >= 0 && toRemove > 0; i--) {
          const k = keys[i]
          const reduceBy = Math.min(newAssignments[k], toRemove)
          newAssignments[k] -= reduceBy
          if (newAssignments[k] <= 0) delete newAssignments[k]
          toRemove -= reduceBy
        }
      }
      next[drinkId] = { total: newTotal, assignments: newAssignments }
      return next
    })
  }

  const assignCartItem = (drinkId: string, participantId: string, delta: number) => {
    setCart((prev) => {
      const line = prev[drinkId]
      if (!line) return prev
      const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
      const currentForPerson = line.assignments[participantId] ?? 0
      if (delta > 0 && assignedSum >= line.total) return prev // can't assign more than total
      const newQty = Math.max(0, currentForPerson + delta)
      const newAssignments = { ...line.assignments }
      if (newQty === 0) delete newAssignments[participantId]
      else newAssignments[participantId] = newQty
      return { ...prev, [drinkId]: { ...line, assignments: newAssignments } }
    })
  }

  // Snel aan iedereen toewijzen: iedereen krijgt er 1, totaal = aantal personen
  const assignToEveryone = (drinkId: string) => {
    setCart((prev) => {
      if (participants.length === 0) return prev
      const assignments: Record<string, number> = {}
      participants.forEach((p) => { assignments[p.id] = 1 })
      return { ...prev, [drinkId]: { total: participants.length, assignments } }
    })
    setLastAddedDrinkIds([drinkId])
  }

  const cartTotalItems = Object.values(cart).reduce((s: number, line) => s + line.total, 0)
  const cartTotalValue = Object.entries(cart).reduce((s: number, [drinkId, line]) => {
    const d = drinks.find((dr) => dr.id === drinkId)
    return s + (d?.price ?? 0) * line.total
  }, 0)

  const clearCart = () => { setCart({}); setLastAddedDrinkIds([]) }

  // Terug naar het homescherm (nieuwe groep maken / opgeslagen groep openen)
  const goHome = () => {
    clearActiveGroupCode() // je koos zelf voor het startscherm → niet meer herstellen
    setGroup(null)
    setView("setup")
    setCart({})
    setLastAddedDrinkIds([])
    setFinishedRoundSnapshot(null)
    setError(null)
  }

  // Een vorig rondje overnemen in de huidige bestelling (om snel opnieuw te bestellen of aan te passen)
  const reorderFromSession = (sess: number) => {
    const rows = orders.filter((o) => o.session === sess)
    if (rows.length === 0) { setToast("Dat rondje is leeg"); return }
    setCart((prev) => {
      const next: Record<string, CartLine> = { ...prev }
      rows.forEach((o) => {
        const line = next[o.drink_id] ?? { total: 0, assignments: {} }
        const assignments = { ...line.assignments }
        if (o.participant_id) assignments[o.participant_id] = (assignments[o.participant_id] ?? 0) + o.quantity
        next[o.drink_id] = { total: line.total + o.quantity, assignments }
      })
      return next
    })
    setLastAddedDrinkIds(Array.from(new Set(rows.map((o) => o.drink_id))))
    setShowReorderPicker(false)
    setToast(`Rondje ${sess} overgenomen — pas aan en rond af 🔁`)
  }

  // Een drankje volledig uit de huidige bestelling halen
  const removeFromCart = (drinkId: string) => {
    setCart((prev) => { const n = { ...prev }; delete n[drinkId]; return n })
    setLastAddedDrinkIds((cur) => cur.filter((id) => id !== drinkId))
  }

  // ── Drank-selector: lokale selectie die telkens op 0 start ────────────────
  const openDrinkSelector = () => { setSelectorDraft({}); setLastAddedCustomDrink(null); setShowDrinkSelector(true) }
  const changeSelectorQty = (drinkId: string, delta: number) => {
    setSelectorDraft((prev) => {
      const n = { ...prev }
      const v = Math.max(0, (n[drinkId] ?? 0) + delta)
      if (v === 0) delete n[drinkId]; else n[drinkId] = v
      return n
    })
  }
  const selectorTotal = Object.values(selectorDraft).reduce((s, q) => s + q, 0)
  const confirmDrinkSelector = () => {
    const addedIds = Object.entries(selectorDraft).filter(([, q]) => q > 0).map(([id]) => id)
    addedIds.forEach((id) => addToCart(id, selectorDraft[id], false)) // niet per stuk markeren
    setLastAddedDrinkIds(addedIds) // hele selectie als "laatst toegevoegd"
    setSelectorDraft({})
    setLastAddedCustomDrink(null)
    setShowDrinkSelector(false)
  }

  // Set van personen die ergens in de huidige bestelling al een drankje toegewezen kregen
  const assignedAnywhere = new Set<string>()
  Object.values(cart).forEach((line) => {
    Object.entries(line.assignments).forEach(([pid, q]) => { if (q > 0) assignedAnywhere.add(pid) })
  })

  // Toewijzen via één dropdown-vakje (i.p.v. een rij chips).
  // variant "full" = volledige picker (laatst toegevoegd). variant "summary" = enkel tonen
  // aan wie/niet toegewezen; klikken opent dezelfde dropdown (alle bestellingen).
  const renderAssignControl = (drinkId: string, line: CartLine, variant: "full" | "summary") => {
    if (participants.length === 0) return null
    const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
    const unassigned = line.total - assignedSum
    const assignedEntries = participants
      .map((p) => ({ p, q: line.assignments[p.id] ?? 0 }))
      .filter((x) => x.q > 0)

    // Personen in vaste volgorde laten staan (niet herschikken na toewijzing)
    const sortedPeople = participants
    const gold = variant === "full" // alleen 'laatst toegevoegd' mag opvallend geel zijn

    const isOpen = openAssignFor === drinkId
    const showEveryone = line.total === participants.length && participants.length > 0

    const assignedChips = assignedEntries.length > 0 ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
        {assignedEntries.map(({ p, q }) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: gold ? "#ecc85a" : "rgba(20,33,58,0.06)", border: gold ? "1px solid #e0ac00" : "1px solid rgba(20,33,58,0.12)", borderRadius: 20, padding: "3px 5px 3px 11px", fontSize: 12, fontWeight: gold ? 800 : 600, color: "#14213a" }}>
            {p.name}
            <span style={{ background: "#5a6ca6", color: "#fff", borderRadius: 20, minWidth: 18, textAlign: "center", padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>×{q}</span>
            <button style={{ ...S.iconBtn, width: 18, height: 18, fontSize: 11 }} onClick={() => assignCartItem(drinkId, p.id, -1)}>−</button>
          </span>
        ))}
      </div>
    ) : null

    // Custom dropdown: je kan er meerdere personen na elkaar in aantikken (paneel blijft open)
    const panel = (
      <div style={{ marginTop: 6, border: "1px solid rgba(20,33,58,0.18)", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        {gold && (
          <button onClick={() => { setLastAddedDrinkIds((cur) => cur.filter((x) => x !== drinkId)); setOpenAssignFor(null) }}
            style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "9px 12px", fontSize: 13, color: "#8a93a8", cursor: "pointer" }}>
            ⏳ later toewijzen
          </button>
        )}
        {sortedPeople.map((p) => {
          const q = line.assignments[p.id] ?? 0
          const canAdd = unassigned > 0
          const elsewhere = assignedAnywhere.has(p.id) && q === 0 // heeft al een ander drankje in dit rondje
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
              <button onClick={() => { if (canAdd) { assignCartItem(drinkId, p.id, 1); if (unassigned === 1) setOpenAssignFor(null) } }} disabled={!canAdd && q === 0}
                style={{ flex: 1, textAlign: "left", background: q > 0 ? "rgba(90,108,166,0.06)" : "none", border: "none", padding: "10px 12px", fontSize: 13.5, fontWeight: q > 0 ? 800 : 600, color: canAdd || q > 0 ? "#14213a" : "#bbb", cursor: canAdd ? "pointer" : "default", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                  <span>{p.name}</span>
                  {elsewhere && <span style={{ fontSize: 10.5, color: "#9aa0ab", fontWeight: 600, whiteSpace: "nowrap" }}>· heeft al iets</span>}
                </span>
                {q > 0 && <span style={{ background: "#5a6ca6", color: "#fff", borderRadius: 20, minWidth: 20, textAlign: "center", padding: "1px 7px", fontSize: 12, fontWeight: 800 }}>{q}</span>}
                {canAdd && <span style={{ color: "#5a6ca6", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>+</span>}
              </button>
              {q > 0 && (
                <button onClick={() => assignCartItem(drinkId, p.id, -1)} style={{ ...S.iconBtn, width: 30, height: 30, margin: "0 8px", flexShrink: 0 }}>−</button>
              )}
            </div>
          )
        })}
        {showEveryone && (
          <button onClick={() => { assignToEveryone(drinkId); setOpenAssignFor(null) }}
            style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(233,196,95,0.12)", border: "none", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#a06b00", cursor: "pointer" }}>
            👥 iedereen (elk 1)
          </button>
        )}
      </div>
    )

    const trigger = (
      <button onClick={() => setOpenAssignFor(isOpen ? null : drinkId)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: unassigned > 0 ? 700 : 600, cursor: "pointer", color: unassigned > 0 ? "#e0685c" : "#1f8a4c", background: gold ? "#fffdf6" : "#fff", border: gold ? "1.5px solid #ecc85a" : "1px solid rgba(20,33,58,0.18)", borderRadius: 10, padding: "9px 12px" }}>
        <span>{unassigned > 0 ? "voor wie?" : "✓ alles toegewezen"}</span>
        <span style={{ color: "#aaa" }}>{isOpen ? "▴" : "▾"}</span>
      </button>
    )

    if (variant === "full") {
      return (
        <div style={{ marginTop: 10 }}>
          {trigger}
          {isOpen ? panel : assignedChips}
        </div>
      )
    }

    // summary: gesloten = aan wie / niet toegewezen tonen; open = paneel om aan te tikken
    if (!isOpen) {
      return (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setOpenAssignFor(drinkId)}
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {assignedEntries.map(({ p, q }) => (
              <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#14213a", fontWeight: 600, background: "rgba(20,33,58,0.06)", borderRadius: 20, padding: "2px 8px 2px 10px" }}>{p.name}<span style={{ background: "#5a6ca6", color: "#fff", borderRadius: 20, minWidth: 18, textAlign: "center", padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>×{q}</span></span>
            ))}
            {unassigned > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e0685c", background: "rgba(16,24,40,0.05)", borderRadius: 20, padding: "3px 12px" }}>{unassigned} niet toegewezen</span>
            )}
            {unassigned <= 0 && assignedEntries.length > 0 && (
              <span style={{ fontSize: 11, color: "#aaa" }}>✏️ aanpassen</span>
            )}
          </button>
        </div>
      )
    }
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: "#5a6680", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
          Toewijzen{unassigned > 0 ? <> · <span style={{ color: "#e0685c" }}>{unassigned} open</span></> : " ✓"}
        </div>
        {panel}
        <button
          onClick={() => setOpenAssignFor(null)}
          style={{ marginTop: 7, width: "100%", background: "rgba(16,24,40,0.04)", border: "1px solid rgba(16,24,40,0.08)", color: "#5a6680", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 10, padding: "8px 0" }}
        >
          Sluiten ▴
        </button>
      </div>
    )
  }

  // Toewijs-control voor het afrekenscherm — zelfde stijl als bij het bestellen, werkt op de definitieve orders.
  const renderBillAssign = (drink: Drink) => {
    if (participants.length === 0) return null
    const perPerson: Record<string, number> = {}
    let anonymousQty = 0
    orders.forEach((o) => {
      if (o.drink_id !== drink.id) return
      if (o.participant_id) perPerson[o.participant_id] = (perPerson[o.participant_id] ?? 0) + o.quantity
      else anonymousQty += o.quantity
    })
    const isOpen = openBillAssignFor === drink.id
    const canAdd = anonymousQty > 0
    const showEveryone = anonymousQty === participants.length && participants.length > 0
    const wasOriginallyUnassigned = billOriginallyUnassigned.has(drink.id)

    // Toon enkel iets als er nu nog iets open staat, OF als dit drankje bij het openen van 'afrekenen' niet toegewezen was
    if (anonymousQty === 0 && !wasOriginallyUnassigned) return null

    const trigger = anonymousQty > 0 ? (
      <button onClick={() => setOpenBillAssignFor(isOpen ? null : drink.id)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#e0685c", background: "rgba(224,107,94,0.06)", border: "1px solid rgba(224,107,94,0.4)", borderRadius: 10, padding: "7px 10px" }}>
        <span>⚠️ {anonymousQty} niet toegewezen — voor wie?</span>
        <span style={{ color: "#aaa" }}>{isOpen ? "▴" : "▾"}</span>
      </button>
    ) : (
      // Volledig toegewezen → enkel een mini potloodje om te corrigeren
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setOpenBillAssignFor(isOpen ? null : drink.id)} title="Toewijzing wijzigen"
          style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 12, background: isOpen ? "rgba(90,108,166,0.16)" : "rgba(16,24,40,0.05)" }}>
          {isOpen ? "▴" : "✏️"}
        </button>
      </div>
    )
    const panel = isOpen ? (
      <div style={{ marginTop: 6, border: "1px solid rgba(20,33,58,0.18)", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        {participants.map((p) => {
          const q = perPerson[p.id] ?? 0
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
              <button onClick={() => { if (canAdd) { assignOneAnonymous(drink.id, p.id); if (anonymousQty === 1) setOpenBillAssignFor(null) } }} disabled={!canAdd && q === 0}
                style={{ flex: 1, textAlign: "left", background: q > 0 ? "rgba(90,108,166,0.06)" : "none", border: "none", padding: "10px 12px", fontSize: 13.5, fontWeight: q > 0 ? 800 : 600, color: canAdd || q > 0 ? "#14213a" : "#bbb", cursor: canAdd ? "pointer" : "default", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{p.name}</span>
                {q > 0 && <span style={{ background: "#5a6ca6", color: "#fff", borderRadius: 20, minWidth: 20, textAlign: "center", padding: "1px 7px", fontSize: 12, fontWeight: 800 }}>{q}</span>}
                {canAdd && <span style={{ color: "#5a6ca6", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>+</span>}
              </button>
              {q > 0 && (
                <button onClick={() => unassignOneFromPerson(drink.id, p.id)} style={{ ...S.iconBtn, width: 30, height: 30, margin: "0 8px", flexShrink: 0 }}>−</button>
              )}
            </div>
          )
        })}
        {showEveryone && (
          <button onClick={() => { assignAnonymousToMany(drink.id, participants.map((p) => p.id)); setOpenBillAssignFor(null) }}
            style={{ display: "block", width: "100%", textAlign: "left", background: "rgba(233,196,95,0.12)", border: "none", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#a06b00", cursor: "pointer" }}>
            👥 iedereen (elk 1)
          </button>
        )}
      </div>
    ) : null

    return (
      <div style={{ marginTop: 8 }}>
        {trigger}
        {panel}
      </div>
    )
  }

  const sessions = Array.from(new Set(orders.map((o) => o.session).filter((n) => n >= 1))).sort((a, b) => a - b)
  const nextSession = (sessions.length > 0 ? Math.max(...sessions) : 0) + 1  // eerste ronde = 1

  const [finishedRoundSnapshot, setFinishedRoundSnapshot] = useState<{ session: number; cart: Record<string, CartLine> } | null>(null)
  const [barmanStep, setBarmanStep] = useState<"list" | "pay">("list") // barman-scherm: eerst lijst, dan betaling
  const [payWarn, setPayWarn] = useState(false) // waarschuwing als er nog niets betaald-bedrag ingevuld is

  const finishRound = async () => {
    if (!group || cartTotalItems === 0) { setToast("Voeg eerst drankjes toe"); return }
    const newRoundSession = nextSession
    for (const [drinkId, line] of Object.entries(cart)) {
      const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
      for (const [participantId, qty] of Object.entries(line.assignments)) {
        if (qty <= 0) continue
        await supabase.from("orders").insert([{ participant_id: participantId, drink_id: drinkId, quantity: qty, group_id: group.id, session: newRoundSession }])
      }
      const remaining = line.total - assignedSum
      if (remaining > 0) {
        await supabase.from("orders").insert([{ participant_id: null, drink_id: drinkId, quantity: remaining, group_id: group.id, session: newRoundSession }])
      }
    }
    await loadAll(group.id)
    setBarmanStep("list")
    setFinishedRoundSnapshot({ session: newRoundSession, cart })
    setCart({})
    setLastAddedDrinkIds([])
    setSession(newRoundSession)
  }

  // Bestelling aanpassen: zet de net afgeronde ronde terug in de bestelling om te wijzigen
  // (verwijdert de opgeslagen orders/betalingen van die ronde zodat ze niet dubbel tellen)
  const adjustFinishedRound = async () => {
    if (!group || !finishedRoundSnapshot) return
    const round = finishedRoundSnapshot.session
    const restoreCart = finishedRoundSnapshot.cart
    await supabase.from("orders").delete().eq("group_id", group.id).eq("session", round)
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
    setCart(restoreCart)
    setLastAddedDrinkIds(Object.keys(restoreCart))
    setPaymentDraft({})
    setFinishedRoundSnapshot(null)
    await loadAll(group.id)
    setView("ordering")
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
    recog.onstart = () => { setQuickVoiceActive(true); setVoiceSuggestion(null) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      const { recognized, suggestion } = parseSpokenDrinks(text, drinks)

      // Only add what was confidently recognized — never guess into the cart
      const addedIds: string[] = []
      recognized.forEach((pd) => {
        const match = fuzzyMatchDrink(pd.name, drinks)
        if (match) { addToCart(match.id, pd.qty, false); addedIds.push(match.id) }
      })
      if (addedIds.length > 0) setLastAddedDrinkIds(addedIds)

      if (recognized.length > 0) {
        setToast(`Toegevoegd: ${recognized.map((d) => `${d.qty}× ${d.name}`).join(", ")}`)
      }

      // Show a "bedoelde je...?" banner if part of the speech wasn't confidently recognized
      if (suggestion) {
        setVoiceSuggestion({ spokenText: text, qty: suggestion.qty, suggested: suggestion.drink })
      } else if (recognized.length === 0) {
        setToast("Niet herkend — probeer opnieuw of typ het drankje handmatig")
      }

      setQuickVoiceActive(false)
    }
    recog.onerror = () => setQuickVoiceActive(false)
    recog.onend = () => setQuickVoiceActive(false)
    recog.start()
  }

  const stopQuickVoice = () => { quickRecogRef.current?.stop(); setQuickVoiceActive(false) }

  const acceptVoiceSuggestion = () => {
    if (!voiceSuggestion) return
    addToCart(voiceSuggestion.suggested.id, voiceSuggestion.qty)
    setToast(`${voiceSuggestion.qty}× ${voiceSuggestion.suggested.name} toegevoegd`)
    setVoiceSuggestion(null)
  }

  const dismissVoiceSuggestion = () => setVoiceSuggestion(null)

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

  // Wijs één niet-toegewezen eenheid van een drank toe (eerste ronde waar er nog eentje open staat) — voor het afrekenscherm
  const assignOneAnonymous = async (drinkId: string, participantId: string) => {
    const anon = orders.find((o) => !o.participant_id && o.drink_id === drinkId && o.quantity > 0)
    if (!anon) return
    await assignAnonymousQty(drinkId, anon.session, participantId, 1)
  }

  // Wijs meerdere personen elk één niet-toegewezen eenheid toe in één DB-bewerking (voor 'meerdere'/'iedereen' in het afrekenscherm)
  const assignAnonymousToMany = async (drinkId: string, participantIds: string[]) => {
    if (!group || participantIds.length === 0) return
    // bouw een lijst van beschikbare anonieme eenheden (met hun sessie)
    const units: number[] = []
    orders.filter((o) => !o.participant_id && o.drink_id === drinkId && o.quantity > 0).forEach((o) => { for (let i = 0; i < o.quantity; i++) units.push(o.session) })
    const take = Math.min(participantIds.length, units.length)
    if (take === 0) return
    const removeBySession: Record<number, number> = {}
    const adds: { session: number; pid: string; qty: number }[] = []
    const addIndex: Record<string, number> = {}
    for (let i = 0; i < take; i++) {
      const session = units[i]
      const pid = participantIds[i]
      removeBySession[session] = (removeBySession[session] ?? 0) + 1
      const k = `${session}__${pid}`
      if (addIndex[k] === undefined) { addIndex[k] = adds.length; adds.push({ session, pid, qty: 0 }) }
      adds[addIndex[k]].qty += 1
    }
    // 1) trek af van de anonieme orders per sessie
    for (const [sessStr, removeQty] of Object.entries(removeBySession)) {
      let toRemove = removeQty
      const sess = Number(sessStr)
      for (const anon of orders.filter((o) => !o.participant_id && o.drink_id === drinkId && o.session === sess && o.quantity > 0)) {
        if (toRemove <= 0) break
        const dec = Math.min(toRemove, anon.quantity)
        const remaining = anon.quantity - dec
        if (remaining <= 0) await supabase.from("orders").delete().eq("id", anon.id)
        else await supabase.from("orders").update({ quantity: remaining }).eq("id", anon.id)
        toRemove -= dec
      }
    }
    // 2) tel op bij de personen
    for (const { session, pid, qty } of adds) {
      const existing = orders.find((o) => o.participant_id === pid && o.drink_id === drinkId && o.session === session)
      if (existing) await supabase.from("orders").update({ quantity: existing.quantity + qty }).eq("id", existing.id)
      else await supabase.from("orders").insert([{ participant_id: pid, drink_id: drinkId, quantity: qty, group_id: group.id, session }])
    }
    await loadAll(group.id)
  }

  // Haal één eenheid weg bij een persoon (eerste sessie waar die het drankje heeft) → terug 'niet toegewezen'
  const unassignOneFromPerson = async (drinkId: string, participantId: string) => {
    const ord = orders.find((o) => o.participant_id === participantId && o.drink_id === drinkId && o.quantity > 0)
    if (!ord) return
    await unassignOrderQty(drinkId, participantId, ord.session, 1)
  }

  // Haal een toewijzing weg bij een persoon → de drankjes blijven bestaan maar worden weer "niet toegewezen" (totaal blijft gelijk)
  const unassignOrderQty = async (drinkId: string, participantId: string, round: number, qty: number) => {
    if (!group || qty <= 0) return
    const personOrder = orders.find((o) => o.participant_id === participantId && o.drink_id === drinkId && o.session === round)
    if (!personOrder || personOrder.quantity <= 0) return
    const move = Math.min(qty, personOrder.quantity)
    const remaining = personOrder.quantity - move
    if (remaining <= 0) await supabase.from("orders").delete().eq("id", personOrder.id)
    else await supabase.from("orders").update({ quantity: remaining }).eq("id", personOrder.id)
    const anon = orders.find((o) => !o.participant_id && o.drink_id === drinkId && o.session === round)
    if (anon) await supabase.from("orders").update({ quantity: anon.quantity + move }).eq("id", anon.id)
    else await supabase.from("orders").insert([{ participant_id: null, drink_id: drinkId, quantity: move, group_id: group.id, session: round }])
    await loadAll(group.id)
  }

  const deleteRound = async (round: number) => {
    if (!group) return
    if (!confirm(`Ronde ${round} verwijderen?\n\nLet op: je verliest ook de historiek (bestellingen én betalingen) van deze ronde. De overige rondes worden hernummerd zodat ze netjes op volgorde blijven.`)) return
    // 1. Verwijder bestellingen + betalingen van deze ronde
    await supabase.from("orders").delete().eq("group_id", group.id).eq("session", round)
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
    // 2. Hernummer de overige rondes (alleen ronde 1+, de pot = sessie 0 blijft) zodat ze 1,2,3,... blijven
    const remaining = Array.from(new Set(
      orders.filter((o) => o.session !== round && o.session >= 1).map((o) => o.session)
    )).sort((a, b) => a - b)
    let newNum = 1
    for (const oldSession of remaining) {
      if (oldSession !== newNum) {
        await supabase.from("orders").update({ session: newNum }).eq("group_id", group.id).eq("session", oldSession)
        await supabase.from("payments").update({ session: newNum }).eq("group_id", group.id).eq("session", oldSession)
      }
      newNum++
    }
    await loadAll(group.id)
        setOpenRounds(null)
    setEditingRound(null)
    setToast(`Ronde ${round} verwijderd`)
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  const openPaymentEditor = (round: number) => {
    const existing = payments.filter((p) => p.session === round)
    const draft: Record<string, string> = {}
    // Enkel de pot en bestaande personen overnemen — wees-betalingen van verwijderde personen negeren
    existing.forEach((p) => {
      const key = p.participant_id ?? POT_PAYER
      if (key === POT_PAYER || participants.some((pp) => pp.id === key)) draft[key] = String(p.amount)
    })
    setPaymentDraft(draft)
    setPaymentEditRound(round)
  }

  const savePayments = async () => {
    if (!group || paymentEditRound === null) return
    const round = paymentEditRound
    // Remove old payments for this round, then insert new ones
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
    const inserts = (Object.entries(paymentDraft) as [string, string][])
      .filter(([key, amt]) => (key === POT_PAYER || participants.some((p) => p.id === key)) && parseFloat(amt) > 0)
      .map(([key, amt]) => ({ group_id: group.id, session: round, participant_id: key === POT_PAYER ? null : key, amount: parseFloat(amt) }))
    if (inserts.length > 0) await supabase.from("payments").insert(inserts)
    await loadAll(group.id)
    setPaymentEditRound(null)
    setToast("Betaling opgeslagen")
  }

  const getRoundPayments = (round: number) => payments.filter((p) => p.session === round)
  const getRoundPaymentTotal = (round: number) => getRoundPayments(round).reduce((s, p) => s + p.amount, 0)

  // ── Pot (gezamenlijke inleg vooraf, sessie 0) ──────────────────────────────
  const POT_SESSION = 0
  const POT_PAYER = "__POT__"  // sleutel in paymentDraft = betaald uit de pot (participant_id null)
  const potTotal = payments.filter((p) => p.session === POT_SESSION).reduce((s, p) => s + p.amount, 0)

  const openPotModal = () => {
    const draft: Record<string, string> = {}
    payments.filter((p) => p.session === POT_SESSION).forEach((p) => { if (p.participant_id) draft[p.participant_id] = String(p.amount) })
    setPotDraft(draft)
    setPotWarn(false)
    setShowPotModal(true)
  }

  const setPotForEveryone = () => {
    setPotWarn(false)
    const amt = potBulk.trim()
    const draft: Record<string, string> = {}
    participants.forEach((p) => { draft[p.id] = amt })
    setPotDraft(draft)
  }

  const savePot = async () => {
    if (!group) return
    const inserts = (Object.entries(potDraft) as [string, string][])
      .filter(([participantId, amt]) => participants.some((p) => p.id === participantId) && parseFloat(amt) > 0)
      .map(([participantId, amt]) => ({ group_id: group.id, session: POT_SESSION, participant_id: participantId, amount: parseFloat(amt) }))
    if (inserts.length === 0) { setPotWarn(true); return }
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", POT_SESSION)
    await supabase.from("payments").insert(inserts)
    await loadAll(group.id)
    setPotWarn(false)
    setShowPotModal(false)
    setToast("Pot opgeslagen 💰")
  }

  // Pot achteraf aanvullen — voegt een extra inleg toe (verwijdert niets)
  const addToPot = async () => {
    if (!group) return
    let rows = (Object.entries(potAddDraft) as [string, string][])
      .map(([pid, v]) => ({ participant_id: pid, amount: parseFloat((v || "").replace(",", ".")) }))
      .filter((r) => participants.some((p) => p.id === r.participant_id) && !isNaN(r.amount) && r.amount > 0)
    // Niets per persoon ingevuld → gebruik het p.p.-bedrag voor iedereen
    if (rows.length === 0) {
      const amt = parseFloat((potAddBulk || "").replace(",", "."))
      if (isNaN(amt) || amt <= 0 || participants.length === 0) { setPotAddWarn(true); setToast("Vul eerst een bedrag in om de pot aan te vullen ⚠️"); return }
      rows = participants.map((p) => ({ participant_id: p.id, amount: amt }))
    }
    // Alles in één insert → zelfde tijdstip → telt als één 'pot'
    const inserts = rows.map((r) => ({ group_id: group.id, session: POT_SESSION, participant_id: r.participant_id, amount: r.amount }))
    const { error } = await supabase.from("payments").insert(inserts)
    if (error) { setError("Pot aanvullen mislukt"); return }
    setPotAddDraft({})
    setPotAddBulk("")
    setPotAddWarn(false)
    await loadAll(group.id)
    const tot = inserts.reduce((s, r) => s + r.amount, 0)
    const usedNow = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
    const newTotal = potTotal + tot
    const leftNow = Math.max(0, newTotal - usedNow)
    setToast(`✅ €${tot.toFixed(2)} toegevoegd · €${leftNow.toFixed(2)} nog in pot · €${usedNow.toFixed(2)} gebruikt`)
    setShowPotOverview(false)
  }

  const deletePotContribution = async (id: string) => {
    if (!group) return
    const { error } = await supabase.from("payments").delete().eq("id", id)
    if (error) { setError("Verwijderen mislukt"); return }
    await loadAll(group.id)
  }

  // ── Drink CRUD ───────────────────────────────────────────────────────────
  const addDrink = async () => {
    const { name, price, category } = newDrink
    const priceNum = parseFloat((price || "").replace(",", "."))
    if (!name.trim()) { setAddDrinkWarn("Vul eerst een naam in voor je drankje."); return }
    if (!price || isNaN(priceNum) || priceNum <= 0) { setAddDrinkWarn("Een richtprijs is verplicht — die hebben we nodig om de rekening achteraf eerlijk te verdelen met Fair Split."); return }
    if (!category) { setAddDrinkWarn("Kies nog een categorie."); return }
    setAddDrinkWarn(null)
    const cat = category || FALLBACK_CATEGORY
    // Eigen toegevoegde drank krijgt enkel een ✨ als "nieuw/zelf toegevoegd"-merkteken (geen vast drank-icoon)
    const autoEmoji = "✨"
    const { data, error } = await supabase.from("drinks").insert([{ name: name.trim(), price: priceNum, emoji: autoEmoji, category: cat }]).select().single()
    if (error) { setError("Drank toevoegen mislukt: " + error.message); return }
    setNewDrink({ name: "", price: "", emoji: "", category: newDrink.category })
    setToast(`${name} toegevoegd`)
    await loadDrinks()
    // Vanuit de drank-selector: spring naar de juiste categorie + toon een melding waar het staat.
    // Anders (bv. via de knop in 'Nieuwe bestelling'): meteen in de bestelling / "Laatst toegevoegd" zetten.
    if (showDrinkSelector) {
      setActiveCategory(cat)
      setLastAddedCustomDrink({ name: name.trim(), category: cat })
    } else if (data?.id) {
      addToCart(data.id, 1)
    }
    setShowAddDrink(false)
  }

  const saveEditedDrink = async () => {
    if (!editingDrink) return
    const { error } = await supabase.from("drinks").update({ name: editingDrink.name, price: editingDrink.price, emoji: editingDrink.emoji, category: editingDrink.category }).eq("id", editingDrink.id)
    if (error) { setError("Drank opslaan mislukt"); return }
    setEditingDrink(null)
    await loadDrinks()
  }

  // Enkel zelf toegevoegde dranken (met ✨-merkteken) mogen verwijderd worden; de basis blijft staan
  const isCustomDrink = (d: Drink) => d.emoji.startsWith("✨")

  const deleteDrinkFromList = async (id: string) => {
    const d = drinks.find((dr) => dr.id === id)
    if (d && !isCustomDrink(d)) { setToast("Basisdranken kunnen niet verwijderd worden"); return }
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
  // Fair split = de ÉCHT betaalde rondebedragen (wat in "wie betaalde" ingegeven werd), verdeeld naar wat elk dronk.
  // De inleg die niet gebruikt werd, komt terug.
  const fairSplit = calculateFairSplit(bill.lines, bill.totalActuallySpent, bill.anonymousValue)
  const settledDebts = settleDebts(fairSplit, bill.totalActuallySpent - bill.totalPaid)

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Start screen (no group yet)
  // ═══════════════════════════════════════════════════════════════════════
  if (!group) {
    const filteredSaved = savedGroups.filter((g) => g.name.toLowerCase().includes(savedSearch.toLowerCase()))
    return (
      <div style={S.page}>
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#8a93a8", textDecoration: "none", marginBottom: 14, cursor: "pointer" }}>← Andere mode</a>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <RundoLogo size={60} />
              <h1 style={{ ...S.h1, color: "#1b2a4a", margin: 0 }}>Rundo</h1>
              <button
                onClick={() => setFairInfoMode("what")}
                title="Wat is Fair Split?"
                style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid rgba(27,42,74,0.25)", background: "#fff", color: "#5a6ca6", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                i
              </button>
            </div>
            <p style={{ textAlign: "center", color: "#f0a500", fontSize: 15, fontWeight: 700, margin: 0 }}>Rondjes en splitten zonder gedoe!</p>
          </div>

          <div style={S.card}>
            <input value={groupName} onChange={(e) => { setStartError(null); setGroupName(e.target.value) }} onKeyDown={(e) => e.key === "Enter" && startGroup()} placeholder="Groepsnaam (bv. Vrijdagavond)" style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 16, fontWeight: 800 }} onClick={startGroup} disabled={isStarting}>{isStarting ? "Laden..." : "Starten"}</button>
            {startError && (
              <div style={{ marginTop: 12, color: "#c0392b", fontSize: 13, background: "#fff0f0", borderRadius: 10, padding: "8px 12px" }}>
                ⚠️ {startError}
                <button onClick={() => setStartError(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#c0392b" }}>✕</button>
              </div>
            )}
          </div>

          {/* Opgeslagen groepen — onderaan, uitklapbaar */}
          {savedGroups.length > 0 && (
            <div style={{ ...S.card, marginTop: 4 }}>
              <button onClick={() => setSavedOpen((o) => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}>
                <b style={{ fontSize: 14, color: "#14213a" }}>Opgeslagen groepen</b>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#c98a00", background: "rgba(233,196,95,0.18)", borderRadius: 10, padding: "1px 8px" }}>{savedGroups.length}</span>
                  <span style={{ fontSize: 12, color: "#c98a00", display: "inline-block", transform: savedOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                </div>
              </button>
              {savedOpen && (
                <div style={{ marginTop: 12 }}>
                  <input value={savedSearch} onChange={(e) => setSavedSearch(e.target.value)} placeholder="🔍 Zoek groep..." style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10, fontSize: 13 }} />
                  {filteredSaved.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => { if (!isStarting) joinGroup(g.invite_code) }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 8px", borderRadius: 10, borderBottom: "1px solid rgba(0,0,0,0.05)", cursor: isStarting ? "default" : "pointer" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
                      </div>
                      <span style={{ fontSize: 13, color: "#c98a00", fontWeight: 700 }}>openen →</span>
                      <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); removeGroupFromStorage(g.id); setSavedGroups(getSavedGroups()) }}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {fairInfoMode && (
          <div style={{ ...S.overlay, zIndex: 2200 }} onClick={() => setFairInfoMode(null)}>
            <div style={{ ...S.modal, width: 370 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#14213a", display: "flex", alignItems: "center", gap: 8 }}>Wat is Rundo?</h3>
              <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
                Met <b>Rundo Party</b> neem je makkelijk bestellingen op voor een groep. De rekening wordt niet zomaar gelijk verdeeld maar via <b style={{ color: "#c98a00" }}>Fair Split</b>. Op basis van richtprijzen schatten we wie wat dronk. <b>Niet perfect, wel veel eerlijker!</b>
              </p>
              <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setFairInfoMode(null)}>Begrepen</button>
            </div>
          </div>
        )}
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

      {/* Modal: Dranken/prijzen bewerken — per categorie, geldt overal */}
      {showEditDrinks && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 440, maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700 }}>✏️ Dranken/prijzen bewerken</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>Pas naam en prijs aan, per categorie — dit geldt overal in de app.</p>
            <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
              {drinks.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20, fontSize: 13 }}>Nog geen dranken</div>}
              {(() => {
                const groups: Record<string, Drink[]> = {}
                drinks.forEach((d) => { const k = d.category ?? FALLBACK_CATEGORY; (groups[k] ||= []).push(d) })
                const order = [...Object.keys(CATEGORY_LABELS), ...Object.keys(groups).filter((k) => !CATEGORY_LABELS[k])]
                return order.filter((k) => groups[k]?.length).map((cat) => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#c98a00", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid rgba(233,196,95,0.3)" }}>{CATEGORY_LABELS[cat] ?? cat}</div>
                    {groups[cat].map((d) => (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        {editingDrink?.id === d.id ? (
                          <>
                            <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{d.emoji}</span>
                            <input value={editingDrink.name} onChange={(e) => setEditingDrink({ ...editingDrink, name: e.target.value })} style={{ ...S.input, flex: 1 }} />
                            <span style={{ color: "#999" }}>€</span>
                            <input type="number" value={editingDrink.price} onChange={(e) => setEditingDrink({ ...editingDrink, price: parseFloat(e.target.value) || 0 })} style={{ ...S.input, width: 70 }} />
                            <button style={{ ...S.btn, ...S.btnPrimary, padding: "6px 10px" }} onClick={saveEditedDrink}>💾</button>
                            <button style={{ ...S.btn, padding: "6px 10px" }} onClick={() => setEditingDrink(null)}>✖</button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontSize: 14 }}>{d.emoji} {d.name} <span style={{ color: "#999" }}>— €{d.price.toFixed(2)}</span></span>
                            <button style={S.iconBtn} onClick={() => setEditingDrink(d)}>✏️</button>
                            {isCustomDrink(d)
                              ? <button style={S.iconBtn} onClick={() => deleteDrinkFromList(d.id)}>🗑️</button>
                              : <span title="Basisdrank — blijft altijd staan" style={{ fontSize: 12, color: "#bbb", width: 30, textAlign: "center" }}>🔒</span>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
            <button style={{ ...S.btn, width: "100%" }} onClick={() => { setEditingDrink(null); setShowEditDrinks(false) }}>Sluiten</button>
          </div>
        </div>
      )}

      {/* Modal: Eigen drank toevoegen — naam + richtprijs + categorie */}
      {showAddDrink && (
        <div style={{ ...S.overlay, zIndex: 2300 }}>
          <div style={{ ...S.modal, width: 400 }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700 }}>➕ Eigen drank toevoegen</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Naam, richtprijs en categorie volstaan. Je drank krijgt automatisch een ✨-logo zodat je ziet dat je hem zelf toevoegde.</p>

            <label style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>Naam</label>
            <input placeholder="bv. Westmalle Tripel" value={newDrink.name} onChange={(e) => { setAddDrinkWarn(null); setNewDrink({ ...newDrink, name: e.target.value }) }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginTop: 4, marginBottom: 12 }} />

            <label style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>Richtprijs (€)</label>
            <input type="number" placeholder="0.00" value={newDrink.price} onChange={(e) => { setAddDrinkWarn(null); setNewDrink({ ...newDrink, price: e.target.value }) }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginTop: 4, marginBottom: 12 }} />

            <label style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>Categorie</label>
            <select value={newDrink.category} onChange={(e) => { setAddDrinkWarn(null); setNewDrink({ ...newDrink, category: e.target.value }) }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginTop: 4, marginBottom: 18 }}>
              {(() => {
                const cats = Array.from(new Set([
                  ...Object.keys(CATEGORY_LABELS),
                  ...drinks.map((d) => d.category).filter((c): c is string => !!c),
                ]))
                return cats.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k] ?? k}</option>)
              })()}
            </select>

            {addDrinkWarn && (
              <div style={{ fontSize: 12.5, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 10, padding: "9px 11px", marginBottom: 14, lineHeight: 1.45 }}>
                ⚠️ {addDrinkWarn}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "11px 0", fontWeight: 800 }} onClick={addDrink}>➕ Toevoegen</button>
              <button style={{ ...S.btn, flex: 1, padding: "11px 0" }} onClick={() => { setAddDrinkWarn(null); setShowAddDrink(false) }}>Sluiten</button>
            </div>
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
          <div onClick={goHome} title="Naar startscherm" style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <RundoLogo size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#1b2a4a", lineHeight: 1.1 }}>Rundo</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f0a500", lineHeight: 1.2 }}>Rondjes en splitten zonder gedoe!</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              style={{ ...S.btn, fontSize: 11, padding: "2px 8px", background: isSaved ? "#eafff1" : "#fff", color: isSaved ? "#27ae60" : "#888" }}
              onClick={() => {
                if (isSaved) { removeGroupFromStorage(group.id); setIsSaved(false) }
                else { saveGroupToStorage(group); setIsSaved(true) }
                setSavedGroups(getSavedGroups())
              }}
            >
              {isSaved ? "✅ Opgeslagen" : "📌 Bewaar groep"}
            </button>
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1b2a4a", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.15, marginBottom: 2 }}>{group.name}</div>
          <div style={{ fontSize: 11.5, color: "#8a93a3", fontWeight: 700 }}>{participants.length} {participants.length === 1 ? "persoon" : "personen"}</div>
          {potTotal > 0 ? (() => {
            const used = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
            const left = Math.max(0, potTotal - used)
            return (
              <button onClick={() => setShowPotOverview(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 11, fontWeight: 700, color: "#a06b00", background: "linear-gradient(135deg,#fffdf6,#fff3cf)", border: "1.5px solid #ecc85a", borderRadius: 20, padding: "2px 10px", cursor: "pointer" }}>
                💰 €{potTotal.toFixed(2)} ingelegd · <b style={{ color: "#14213a" }}>€{left.toFixed(2)} nog in pot</b>
              </button>
            )
          })() : (
            <button onClick={openPotModal} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.5)", borderRadius: 20, padding: "2px 10px", cursor: "pointer" }}>💰 Leg een pot</button>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div style={S.tabBar}>
        {([
          { id: "setup", label: potTotal > 0 ? "👥 Groep + Pot" : "👥 Groep" },
          { id: "ordering", label: "🛒 Nieuwe bestelling" },
          { id: "rounds", label: "📦 Rondjes" },
          { id: "bill", label: "💰 Afrekenen" },
        ] as { id: AppView; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{
              flex: 1, border: "none", borderRadius: 12, padding: "10px 4px", fontSize: 13, cursor: "pointer",
              fontWeight: view === t.id ? 800 : 600,
              background: view === t.id ? "linear-gradient(135deg,#f6dd95,#eecb6e)" : "transparent",
              color: view === t.id ? "#5a4a1a" : "#8b93a8",
              boxShadow: view === t.id ? "0 3px 10px -2px rgba(233,196,95,0.5)" : "none",
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

            {(() => {
              const cols = participants.length <= 5 ? 1 : participants.length <= 12 ? 2 : 3
              const rows = Math.max(1, Math.ceil(participants.length / cols))
              return (
                <div style={cols > 1 ? { display: "grid", gridAutoFlow: "column", gridTemplateRows: `repeat(${rows}, auto)`, columnGap: 16 } : undefined}>
            {participants.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                {editingPerson === p.id ? (
                  <input
                    autoFocus
                    value={editingPersonName}
                    placeholder={p.name}
                    onChange={(e) => setEditingPersonName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                      if (e.key === "Escape") { setEditingPersonName(""); setEditingPerson(null) }
                    }}
                    onBlur={() => { if (editingPersonName.trim()) renamePerson(); else { setEditingPersonName(""); setEditingPerson(null) } }}
                    style={{ ...S.input, flex: 1 }}
                  />
                ) : (
                  <>
                    <span
                      onClick={() => { setEditingPerson(p.id); setEditingPersonName("") }}
                      style={{ flex: 1, fontWeight: 600, fontSize: 15, cursor: "text", padding: "2px 0" }}
                    >{p.name}</span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>€{getPersonTotal(p.id).toFixed(2)}</span>
                    <button style={S.iconBtn} onClick={() => { setEditingPerson(p.id); setEditingPersonName("") }}>✏️</button>
                    <button style={S.iconBtn} onClick={() => deletePerson(p.id, p.name)}>🗑️</button>
                  </>
                )}
              </div>
            ))}
                </div>
              )
            })()}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              style={{ ...S.btn, flex: 1, padding: "14px 8px", fontSize: 14, fontWeight: 700, border: "1.5px solid #ecc85a", background: potTotal > 0 ? "#ecc85a" : "#fffdf6", color: "#14213a" }}
              onClick={() => (potTotal > 0 ? setShowPotOverview(true) : openPotModal())}
            >
              {potTotal > 0 ? `💰 Pot gelegd · €${potTotal.toFixed(2)}` : "💰 Leg eerst een pot"}
            </button>
            <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "14px 8px", fontSize: 15, fontWeight: 800 }} onClick={() => setView("ordering")}>
              🛒 Start bestellen →
            </button>
          </div>
        </div>
      )}

      {/* ═══ VIEW: Ordering (main focus) ═══ */}
      {view === "ordering" && (
        <div>
          {/* Alles op één lijn: rondje-nummer links, titel in het midden, vorig-rondje rechts */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 2px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#5a6ca6,#7283b6)", color: "#ecc85a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>{nextSession}</div>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#5a6680", whiteSpace: "nowrap" }}>Rondje {nextSession}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 14, fontWeight: 800, color: "#14213a", lineHeight: 1.15 }}>Start hieronder je bestelling</div>
            {sessions.length >= 1 && (
              <button
                onClick={() => { setReorderShowAll(false); setShowReorderPicker(true) }}
                style={{ flexShrink: 0, background: "rgba(90,108,166,0.1)", border: "1px solid rgba(90,108,166,0.3)", color: "#5a6ca6", borderRadius: 20, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                🔁 Vorig rondje opnieuw
              </button>
            )}
          </div>

          {/* Bovenaan: 2 knoppen — opname EN/OF drankje selecteren + Bestelling afronden */}
          <div style={{ ...S.card, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={quickVoiceActive ? stopQuickVoice : startQuickVoice}
                style={{
                  ...S.btn, flex: 1, padding: "14px 8px", fontSize: 13, fontWeight: 700, border: "none", lineHeight: 1.25,
                  background: quickVoiceActive ? "#e74c3c" : "linear-gradient(135deg,#5a6ca6,#7283b6)",
                  color: "#fff",
                  animation: quickVoiceActive ? "pulse 1.2s infinite" : "none",
                  boxShadow: quickVoiceActive ? "0 0 0 5px rgba(231,76,60,0.18)" : "0 6px 18px rgba(27,42,74,0.3)",
                }}
              >
                {quickVoiceActive ? "🔴 Luistert..." : "🎤 Spreek je bestelling in"}
              </button>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#aaa", flexShrink: 0 }}>EN/OF</span>
              <button
                onClick={openDrinkSelector}
                style={{ ...S.btn, flex: 1, padding: "14px 8px", fontSize: 13, fontWeight: 700, border: "none", lineHeight: 1.25, background: "linear-gradient(135deg,#5a6ca6,#7283b6)", color: "#fff", boxShadow: "0 6px 18px rgba(27,42,74,0.3)" }}
              >
                🍹 Selecteer drankje(s)
              </button>
            </div>

          </div>

          {/* "Bedoelde je...?" suggestie banner */}
          {voiceSuggestion && (
            <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(231,168,38,0.1),rgba(231,168,38,0.05))", border: "1px solid rgba(231,168,38,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 13 }}>
                Niet helemaal verstaan — bedoelde je <b>{voiceSuggestion.suggested.emoji} {voiceSuggestion.suggested.name}</b>?
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 12, padding: "6px 12px" }} onClick={acceptVoiceSuggestion}>Ja</button>
                <button style={{ ...S.btn, fontSize: 12, padding: "6px 12px" }} onClick={dismissVoiceSuggestion}>Nee</button>
              </div>
            </div>
          )}

          {/* Laatst toegevoegd — meteen aanpassen, verwijderen én toewijzen */}
          {(() => {
            // Blijft staan zolang het niet volledig toegewezen is; pas als de laatste eenheid is toegewezen verdwijnt het hier en blijft het in "Alle bestellingen"
            const shown = lastAddedDrinkIds.filter((id) => {
              const l = cart[id]
              if (!l || l.total <= 0) return false
              const assignedSum = Object.values(l.assignments).reduce((s, q) => s + q, 0)
              return assignedSum < l.total
            })
            if (shown.length === 0) return null
            return (
              <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(27,42,74,0.1),rgba(233,196,95,0.06))", border: "1px solid rgba(27,42,74,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#c98a00", textTransform: "uppercase", letterSpacing: 0.6 }}>✨ Laatst toegevoegd</div>
                  <button
                    onClick={() => setLastAddedDrinkIds([])}
                    style={{ background: "none", border: "none", color: "#9aa0ab", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0 }}
                  >
                    ⏳ alles later toewijzen
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: shown.length > 3 ? "repeat(auto-fill, minmax(205px, 1fr))" : "1fr", gap: 8 }}>
                  {shown.map((id) => {
                    const d = drinks.find((dr) => dr.id === id)
                    const line = cart[id]
                    if (!d || !line) return null
                    return (
                      <div key={id} style={{ border: "1px solid rgba(27,42,74,0.14)", borderRadius: 12, padding: "8px 10px", background: "rgba(255,255,255,0.55)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{d.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                            {showPrices && <div style={{ fontSize: 10, color: "#999" }}>≈ €{(d.price * line.total).toFixed(2)}</div>}
                          </div>
                          <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 15 }} onClick={() => addToCart(d.id, -1)}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 800, minWidth: 18, textAlign: "center" }}>{line.total}</span>
                          <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 15, background: "rgba(27,42,74,0.15)" }} onClick={() => addToCart(d.id, 1)}>+</button>
                          <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13 }} onClick={() => removeFromCart(d.id)}>🗑️</button>
                        </div>
                        {/* Toewijzen via dropdown-vakje */}
                        {renderAssignControl(d.id, line, "full")}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Alle bestellingen — alles wat er tot nu toe besteld werd */}
          {cartTotalItems > 0 && (
            <div style={{ ...S.card, padding: 0, overflow: "hidden", border: "1px solid rgba(90,108,166,0.18)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg,#5a6ca6,#7283b6)", padding: "12px 16px" }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  📋 Alle bestellingen in rondje {nextSession}
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#5a6ca6", background: "#fff", borderRadius: 20, padding: "1px 10px" }}>{cartTotalItems}</span>
                </span>
                <button style={{ background: "none", border: "none", color: "#dfe4f1", fontSize: 12, cursor: "pointer", textDecoration: "underline" }} onClick={clearCart}>wis alles</button>
              </div>
              <div style={{ padding: 16 }}>
              {(() => {
                const entries = Object.entries(cart).filter(([, line]) => line.total > 0)
                const lastSet = new Set(lastAddedDrinkIds)
                const ordered = [...entries.filter(([id]) => lastSet.has(id)), ...entries.filter(([id]) => !lastSet.has(id))]
                return (
                  <div style={{ display: "grid", gridTemplateColumns: ordered.length > 1 ? "repeat(auto-fill, minmax(230px, 1fr))" : "1fr", gap: 10 }}>
                    {ordered.map(([drinkId, line]) => {
                      const d = drinks.find((dr) => dr.id === drinkId)
                      if (!d) return null
                      return (
                        <div key={drinkId} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 19, flexShrink: 0 }}>{d.emoji}</span>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                            <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 14 }} onClick={() => addToCart(d.id, -1)}>−</button>
                            <span style={{ fontSize: 15, fontWeight: 800, minWidth: 20, textAlign: "center" }}>{line.total}</span>
                            <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 14, background: "rgba(27,42,74,0.12)" }} onClick={() => addToCart(d.id, 1)}>+</button>
                            <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13 }} onClick={() => removeFromCart(d.id)}>🗑️</button>
                          </div>
                          {/* Enkel tonen aan wie / niet toegewezen; klikken opent dropdown */}
                          {renderAssignControl(drinkId, line, "summary")}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              </div>
            </div>
          )}

          {/* Bestelling afronden — onderaan, onder de volledige lijst (vraagt bevestiging) */}
          {cartTotalItems > 0 && (
            <button
              onClick={() => setShowFinishConfirm(true)}
              style={{ ...S.btn, width: "100%", marginTop: 2, marginBottom: 14, padding: "13px 0", fontSize: 15, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#1b2a4a", boxShadow: "0 4px 14px rgba(233,196,95,0.45)" }}
            >
              ✅ Bestelling rondje {nextSession} afronden · {cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}{showPrices ? ` · ≈ €${cartTotalValue.toFixed(2)}` : ""}
              {" "}<span style={{ fontWeight: 600, fontSize: 12, opacity: 0.85 }}>(voor jouw groep van {participants.length} {participants.length === 1 ? "persoon" : "personen"})</span>
            </button>
          )}

          {/* Beheerknoppen — beide even groot, subtiel en rechts uitgelijnd */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
            <button style={{ ...S.btn, fontSize: 11.5, padding: "6px 12px", color: "#8a93a8", background: "rgba(16,24,40,0.04)", border: "1px solid rgba(16,24,40,0.08)" }} onClick={() => setShowAddDrink(true)}>➕ Eigen drankje toevoegen</button>
            <button style={{ ...S.btn, fontSize: 11.5, padding: "6px 12px", color: "#8a93a8", background: "rgba(16,24,40,0.04)", border: "1px solid rgba(16,24,40,0.08)" }} onClick={() => setShowEditDrinks(true)}>✏️ Dranken of Prijzen bewerken</button>
          </div>

          {/* Bevestiging vóór afronden */}
          {/* Kiezer: begin met een vorig rondje */}
          {showReorderPicker && (
            <div style={S.overlay}>
              <div style={{ ...S.modal, width: 420, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
                <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, color: "#14213a" }}>🔁 Begin met een vorig rondje</h3>
                <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>Bestel een vorig rondje <b>exact opnieuw</b>, of neem het over om het <b>licht aan te passen</b>.</p>
                <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
                  {(() => {
                    const reversed = [...sessions].reverse()
                    const visible = reorderShowAll ? reversed : reversed.slice(0, 1)
                    const olderCount = reversed.length - 1
                    return (
                      <>
                        {visible.map((sess) => {
                          const rows = orders.filter((o) => o.session === sess)
                          const byDrink: Record<string, number> = {}
                          rows.forEach((o) => { byDrink[o.drink_id] = (byDrink[o.drink_id] ?? 0) + o.quantity })
                          const total = rows.reduce((s, o) => s + o.quantity, 0)
                          const names = Object.entries(byDrink).map(([id, q]) => { const d = drinks.find((dr) => dr.id === id); return d ? `${q}× ${d.name}` : null }).filter(Boolean).join(", ")
                          const isPrev = sess === reversed[0]
                          return (
                            <div
                              key={sess}
                              style={{ padding: "11px 12px", marginBottom: 8, borderRadius: 14, border: isPrev ? "1.5px solid #ecc85a" : "1px solid rgba(0,0,0,0.1)", background: isPrev ? "#fffdf6" : "#fff" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                <span style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#5a6ca6,#7283b6)", color: "#ecc85a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{sess}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>Rondje {sess}{isPrev && <span style={{ fontSize: 10, fontWeight: 800, color: "#a06b00", background: "rgba(233,196,95,0.25)", borderRadius: 10, padding: "1px 7px", marginLeft: 6 }}>vorige</span>}</div>
                                  <div style={{ fontSize: 11, color: "#8a93a3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{total} {total === 1 ? "drankje" : "drankjes"}{names ? ` · ${names}` : ""}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => { reorderFromSession(sess); setShowFinishConfirm(true) }}
                                  style={{ ...S.btn, flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a" }}
                                >
                                  ⚡ Exact opnieuw
                                </button>
                                <button
                                  onClick={() => reorderFromSession(sess)}
                                  style={{ ...S.btn, flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid rgba(20,33,58,0.2)", color: "#5a6680" }}
                                >
                                  ✏️ Aanpassen
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {olderCount > 0 && (
                          <button
                            onClick={() => setReorderShowAll((v) => !v)}
                            style={{ width: "100%", background: "none", border: "none", color: "#5a6ca6", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "8px 0", textDecoration: "underline", textUnderlineOffset: 3 }}
                          >
                            {reorderShowAll ? "▴ Toon enkel het vorige rondje" : `▾ Toon ${olderCount} ouder${olderCount === 1 ? "" : "e"} rondje${olderCount === 1 ? "" : "s"}`}
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
                <button style={{ ...S.btn, width: "100%", padding: "11px 0" }} onClick={() => setShowReorderPicker(false)}>Annuleren</button>
              </div>
            </div>
          )}

          {showFinishConfirm && (
            <div style={S.overlay}>
              <div style={{ ...S.modal, width: 360, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🍻</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#14213a", margin: "0 0 6px" }}>Bestelling afronden?</h3>
                <p style={{ fontSize: 13, color: "#777", marginBottom: 12 }}>
                  Je gaat naar het barman-scherm met {cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}. Overzicht:
                </p>
                <div style={{ textAlign: "left", maxHeight: 200, overflowY: "auto", marginBottom: 16, border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "6px 12px" }}>
                  {Object.entries(cart).filter(([, l]) => l.total > 0).map(([id, l]) => {
                    const d = drinks.find((dr) => dr.id === id)
                    if (!d) return null
                    return (
                      <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{d.emoji} {d.name}</span>
                        <span style={{ fontWeight: 800, color: "#14213a", flexShrink: 0, marginLeft: 8 }}>×{l.total}</span>
                      </div>
                    )
                  })}
                </div>
                {(() => {
                  const unassigned = Object.values(cart).reduce((s, l) => {
                    if (l.total <= 0) return s
                    const assigned = Object.values(l.assignments).reduce((a, q) => a + q, 0)
                    return s + Math.max(0, l.total - assigned)
                  }, 0)
                  if (unassigned === 0) return null
                  return (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", textAlign: "left", background: "rgba(245,197,24,0.12)", border: "1px solid rgba(233,196,95,0.5)", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>💡</span>
                      <span style={{ fontSize: 12, color: "#7a6a2a", lineHeight: 1.45 }}>
                        <b>{unassigned} {unassigned === 1 ? "drankje" : "drankjes"}</b> nog niet toegewezen. Handig voor een eerlijke <b>Fair Split</b> — je kan ze nu (via &ldquo;verder bestellen&rdquo;) of later op het afrekenscherm toewijzen.
                      </span>
                    </div>
                  )
                })()}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    style={{ ...S.btn, width: "100%", padding: "12px 0", fontSize: 15, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a" }}
                    onClick={() => { setShowFinishConfirm(false); finishRound() }}
                  >
                    ✅ Ja, afronden
                  </button>
                  <button style={{ ...S.btn, width: "100%", padding: "11px 0" }} onClick={() => setShowFinishConfirm(false)}>
                    ← Verder bestellen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: drankje selecteren (categorie-tabs + grid) */}
          {showDrinkSelector && (
            <div style={S.overlay}>
              <div style={{ ...S.modal, width: 460, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: 10 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🍹 Selecteer drankje(s)</h3>
                </div>

                {/* category tabs */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
                  {groupedDrinks.map(([cat]) => {
                    const isActive = activeCategory === cat || (activeCategory === null && cat === groupedDrinks[0]?.[0])
                    return (
                      <button key={cat} onClick={() => setActiveCategory(cat)} style={{ flexShrink: 0, border: "none", borderRadius: 14, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: isActive ? "linear-gradient(135deg,#5a6ca6,#7283b6)" : "#f0f2f7", color: isActive ? "#fff" : "#777" }}>
                        {cat}
                      </button>
                    )
                  })}
                </div>

                {/* Melding na een zelf toegevoegd drankje: waar staat het nu */}
                {lastAddedCustomDrink && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(39,174,96,0.1)", border: "1px solid rgba(39,174,96,0.35)", borderRadius: 12, padding: "8px 11px", marginBottom: 8, fontSize: 12.5, color: "#1f8a4c", lineHeight: 1.4 }}>
                    <span style={{ flex: 1 }}>✅ <b>{lastAddedCustomDrink.name}</b> staat nu onder <b>{CATEGORY_LABELS[lastAddedCustomDrink.category] ?? lastAddedCustomDrink.category}</b> — selecteer het hieronder.</span>
                    <button onClick={() => setLastAddedCustomDrink(null)} style={{ background: "none", border: "none", color: "#1f8a4c", fontSize: 14, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>✕</button>
                  </div>
                )}

                {/* grid */}
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {groupedDrinks.map(([cat, list]) => {
                    const isActive = activeCategory === cat || (activeCategory === null && cat === groupedDrinks[0]?.[0])
                    if (!isActive) return null
                    return (
                      <div key={cat} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {list.map((d) => {
                          const qty = selectorDraft[d.id] ?? 0
                          return (
                            <div key={d.id} style={{ background: qty > 0 ? "rgba(27,42,74,0.08)" : "#fafbff", border: qty > 0 ? "1.5px solid rgba(27,42,74,0.35)" : "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 20 }}>{d.emoji}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{d.name}</span>
                                {showPrices && <span style={{ fontSize: 10, color: "#bbb" }}>≈ €{d.price.toFixed(2)}</span>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15 }} onClick={() => changeSelectorQty(d.id, -1)}>−</button>
                                <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{qty}</span>
                                <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15, background: "rgba(27,42,74,0.12)" }} onClick={() => changeSelectorQty(d.id, 1)}>+</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Live overzicht: groep, wat al in de bestelling zit, en wat je nu toevoegt */}
                {(() => {
                  const groupSize = participants.length
                  const already = cartTotalItems
                  const adding = selectorTotal
                  const newTotal = already + adding
                  const over = groupSize > 0 ? newTotal - groupSize : 0
                  return (
                    <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 12, background: over > 0 ? "rgba(224,107,94,0.1)" : "rgba(20,33,58,0.04)", border: over > 0 ? "1px solid rgba(224,107,94,0.3)" : "1px solid transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#555", gap: 8, flexWrap: "wrap" }}>
                        <span>👥 <b style={{ color: "#14213a" }}>{groupSize}</b> {groupSize === 1 ? "persoon" : "personen"}</span>
                        <span>
                          🍹 <b style={{ color: "#14213a" }}>{already}</b>
                          {adding > 0 && <> + <b style={{ color: "#5a6ca6" }}>{adding}</b> = <b style={{ color: "#14213a" }}>{newTotal}</b></>}
                          {" "}{(adding > 0 ? newTotal : already) === 1 ? "drankje" : "drankjes"}
                        </span>
                      </div>
                      {over > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "#c0392b", lineHeight: 1.4 }}>
                          ⚠️ {over} drankje{over !== 1 ? "s" : ""} meer dan de groep ({groupSize} {groupSize === 1 ? "persoon" : "personen"})
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5 }}>
                  <span style={{ color: "#8a93a3" }}>Drankje niet gevonden? </span>
                  <button onClick={() => setShowAddDrink(true)} style={{ background: "none", border: "none", padding: 0, color: "#5a6ca6", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                    Voeg je eigen drankje toe
                  </button>
                </div>

                <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 10, padding: "12px 0", fontWeight: 700 }} onClick={confirmDrinkSelector}>
                  {selectorTotal > 0 ? `➕ Toevoegen · ${selectorTotal} item${selectorTotal !== 1 ? "s" : ""}` : "Klaar"}
                </button>
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button
                    onClick={() => { setSelectorDraft({}); setLastAddedCustomDrink(null); setShowDrinkSelector(false) }}
                    style={{ background: "none", border: "none", color: "#9aa0ab", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 10px" }}
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ VIEW: Rounds (history, editable, payments) ═══ */}
      {view === "rounds" && (
        <div>
          {/* Handige pot-stand: hoeveel zit er nog in de pot */}
          {potTotal > 0 && (() => {
            const potUsed = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
            const potLeft = Math.max(0, potTotal - potUsed)
            const pct = potTotal > 0 ? Math.max(0, Math.min(100, (potLeft / potTotal) * 100)) : 0
            return (
              <div style={{ ...S.card, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 13, background: "linear-gradient(135deg,#fffdf6,#fff7e3)", border: "1.5px solid #ecc85a" }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>💰</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#a06b00", fontWeight: 800 }}>Nog in de pot</span>
                    <span style={{ fontSize: 19, fontWeight: 800, color: potLeft > 0.01 ? "#14213a" : "#e67e22" }}>€{potLeft.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(20,33,58,0.08)", borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#f3d27c,#ecc564)", borderRadius: 4, transition: "width 0.2s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 3 }}>€{potUsed.toFixed(2)} van €{potTotal.toFixed(2)} gebruikt{potLeft <= 0.01 ? " · pot is leeg" : ""}</div>
                </div>
                <button onClick={() => setShowPotOverview(true)} style={{ ...S.btn, flexShrink: 0, fontSize: 12, fontWeight: 800, padding: "8px 12px", border: "1.5px solid #ecc85a", background: "#fff", color: "#a06b00" }}>＋ aanvullen</button>
              </div>
            )
          })()}

          {sessions.length === 0 && (
            <div style={{ ...S.card, textAlign: "center", padding: 32, color: "#aaa" }}>
              Nog geen rondjes. Ga naar &ldquo;Nieuwe bestelling&rdquo; om te beginnen.
            </div>
          )}

          {sessions.length > 1 && (() => {
            const everyOpen = openRounds !== null && sessions.every((s) => openRounds.includes(s))
            return (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                  onClick={() => setOpenRounds(everyOpen ? [] : sessions.slice())}
                  style={{ background: "none", border: "none", color: "#8a93a8", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                >
                  {everyOpen ? "▴ Alles inklappen" : "▾ Alles openklappen"}
                </button>
              </div>
            )
          })()}

          {sessions.slice().reverse().map((s) => {
            const grouped = getRoundGrouped(s)
            const roundPayments = getRoundPayments(s)
            const isEditing = editingRound === s
            const latestSession = sessions[sessions.length - 1]
            const isLatest = s === latestSession
            // Standaard staat enkel het laatste rondje open; daarna kan elk rondje los open/dicht (meerdere tegelijk mogelijk)
            const isOpen = openRounds === null ? isLatest : openRounds.includes(s)

            const toggleOpen = () => {
              const base = openRounds === null ? (latestSession != null ? [latestSession] : []) : openRounds
              setOpenRounds(base.includes(s) ? base.filter((x) => x !== s) : [...base, s])
            }

            return (
              <div key={s} style={S.card}>
                <div
                  onClick={toggleOpen}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#bbb", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▶</span>
                    <b style={{ fontSize: 16 }}>Ronde {s}</b>
                    {isLatest && <span style={{ fontSize: 10, color: "#1b2a4a", background: "rgba(27,42,74,0.1)", borderRadius: 8, padding: "1px 8px", fontWeight: 700 }}>laatste</span>}
                    {(() => {
                      const open = orders.filter((o) => o.session === s && !o.participant_id).reduce((sum, o) => sum + o.quantity, 0)
                      if (open <= 0) return null
                      return <span style={{ fontSize: 10, color: "#e0685c", background: "rgba(224,107,94,0.12)", border: "1px solid rgba(224,107,94,0.35)", borderRadius: 8, padding: "1px 8px", fontWeight: 800 }}>{open} niet toegewezen</span>
                    })()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button style={S.iconBtn} title="Volledig scherm" onClick={(e) => { e.stopPropagation(); setRoundFullscreen(s) }}>🔍</button>
                    <button style={S.iconBtn} title="Bewerken" onClick={(e) => { e.stopPropagation(); setEditingRound(isEditing ? null : s); if (!isOpen) toggleOpen() }}>{isEditing ? "✓" : "✏️"}</button>
                    <button style={S.iconBtn} title="Verwijderen" onClick={(e) => { e.stopPropagation(); deleteRound(s) }}>🗑️</button>
                  </div>
                </div>

                {/* Betaald door + bedrag — meteen na de rondenaam */}
                <div style={{ marginTop: 6 }}>
                  {roundPayments.length === 0 ? (
                    <button style={{ ...S.btn, fontSize: 12, padding: "4px 12px" }} onClick={(e) => { e.stopPropagation(); openPaymentEditor(s) }}>💳 Wie betaalde?</button>
                  ) : (
                    <div
                      onClick={(e) => { e.stopPropagation(); openPaymentEditor(s) }}
                      style={{ cursor: "pointer", fontSize: 13, color: "#444", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
                    >
                      <span style={{ color: "#888" }}>💳 Betaald</span>
                      {roundPayments.map((p) => {
                        const isPot = !p.participant_id
                        const person = participants.find((pa) => pa.id === p.participant_id)
                        return (
                          <span key={p.id} style={{ background: isPot ? "rgba(233,196,95,0.2)" : "rgba(39,174,96,0.1)", color: isPot ? "#a06b00" : "#1f8a4c", borderRadius: 10, padding: "2px 10px", fontWeight: 700 }}>
                            {isPot ? "💰 via de pot" : (person?.name ?? "?")} · €{p.amount.toFixed(2)}
                          </span>
                        )
                      })}
                      <span style={{ color: "#bbb", fontSize: 11, textDecoration: "underline" }}>wijzig</span>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <>
                    {Object.values(grouped).map((it) => (
                      <div key={it.drink.id} style={{ marginTop: 8, padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <b style={{ fontSize: 13 }}>{it.drink.emoji} {it.drink.name} × {it.totalQty}</b>
                        </div>
                        <div style={{ marginLeft: 8, marginTop: 4 }}>
                          {Object.entries(it.people).map(([pid, info]) => (
                            <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 2 }}>
                              <span style={{ color: "#666" }}>{info.name} × {info.qty}</span>
                              {isEditing && (
                                <button title="terug naar niet toegewezen" style={{ ...S.iconBtn, width: 20, height: 20, fontSize: 11 }} onClick={() => unassignOrderQty(it.drink.id, pid, s, 1)}>−</button>
                              )}
                            </div>
                          ))}
                          {it.anonymous > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }} onClick={(e) => e.stopPropagation()}>
                              <span style={{ fontSize: 11, color: "#e0685c", fontWeight: 600, flexShrink: 0 }}>{it.anonymous}× niet toegewezen</span>
                              <select
                                value=""
                                onChange={(e) => { if (e.target.value) assignAnonymousQty(it.drink.id, s, e.target.value, 1) }}
                                style={{ ...S.input, flex: 1, fontSize: 12, padding: "5px 8px", fontWeight: 600, cursor: "pointer" }}
                              >
                                <option value="">voor wie?</option>
                                {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info-popup achter de ⓘ bij de richtprijzen */}
      {showIndicatiefInfo && (
        <div style={{ ...S.overlay, zIndex: 2200 }} onClick={() => setShowIndicatiefInfo(false)}>
          <div style={{ ...S.modal, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#14213a", display: "flex", alignItems: "center", gap: 8 }}>💡 Indicatieve richtprijs</h3>
            <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
              <b style={{ color: "#8a93a3" }}>Indicatieve richtprijs</b> is een pure schatting per drankje. <b style={{ color: "#c98a00" }}>Fair Split</b> verdeelt het verschil met wat er echt betaald werd tijdens de rondjes volgens wie wat dronk, niet zomaar gelijk over iedereen. <b>Veel eerlijker dus!</b>
            </p>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setShowIndicatiefInfo(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* Fair split — uitleg popup */}
      {fairInfoMode && (
        <div style={{ ...S.overlay, zIndex: 2200 }} onClick={() => setFairInfoMode(null)}>
          <div style={{ ...S.modal, width: 370 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#14213a", display: "flex", alignItems: "center", gap: 8 }}>Wat is Rundo?</h3>
            <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
              Met <b>Rundo Party</b> neem je makkelijk bestellingen op voor een groep. De rekening wordt niet zomaar gelijk verdeeld maar via <b style={{ color: "#c98a00" }}>Fair Split</b>. Op basis van richtprijzen schatten we wie wat dronk. <b>Niet perfect, wel veel eerlijker!</b>
            </p>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setFairInfoMode(null)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* Pot-overzicht + aanvullen op elk moment */}
      {showPotOverview && (() => {
        const potPays = orderStable(payments.filter((p) => p.session === POT_SESSION))
        const potUsed = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
        const potLeft = Math.max(0, potTotal - potUsed)
        // Groepeer in "potten" op inleg-moment (created_at), zodat je eerste/tweede pot ziet
        const batchMap = new Map<string, Payment[]>()
        const order: string[] = []
        potPays.forEach((p) => {
          const key = p.created_at ? p.created_at.slice(0, 19) : p.id
          if (!batchMap.has(key)) { batchMap.set(key, []); order.push(key) }
          batchMap.get(key)!.push(p)
        })
        const batches = order.map((k) => batchMap.get(k)!)
        const potName = (i: number) => ["Eerste pot", "Tweede pot", "Derde pot", "Vierde pot", "Vijfde pot", "Zesde pot"][i] ?? `Pot ${i + 1}`
        const n = participants.length
        const allTotal = parseFloat((potAddAmount || "").replace(",", "."))
        const allPer = (!isNaN(allTotal) && allTotal > 0 && n > 0) ? allTotal / n : 0
        return (
          <div style={{ ...S.overlay, zIndex: 2200 }}>
            <div style={{ ...S.modal, width: 440, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <h3 style={{ marginBottom: 4, fontSize: 19, fontWeight: 800, color: "#14213a" }}>💰 De pot</h3>
              <p style={{ fontSize: 12, color: "#999", marginTop: 0, marginBottom: 14 }}>Overzicht per pot en wie wat bijlegde.</p>

              {/* Stats */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(233,196,95,0.10)", borderRadius: 12, padding: "9px 4px" }}>
                  <div style={{ fontSize: 10, color: "#a06b00", fontWeight: 700 }}>ingelegd</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#14213a" }}>€{potTotal.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(20,33,58,0.05)", borderRadius: 12, padding: "9px 4px" }}>
                  <div style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>gebruikt</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#8a93a3" }}>€{potUsed.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(39,174,96,0.10)", borderRadius: 12, padding: "9px 4px" }}>
                  <div style={{ fontSize: 10, color: "#1f8a4c", fontWeight: 700 }}>nog beschikbaar</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#27ae60" }}>€{potLeft.toFixed(2)}</div>
                </div>
              </div>

              {/* Potten (per inleg-moment) */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
                {batches.length === 0 && <div style={{ fontSize: 13, color: "#bbb", padding: "8px 0" }}>Nog geen inleg.</div>}
                {batches.map((rows, i) => {
                  const bt = rows.reduce((s, r) => s + r.amount, 0)
                  return (
                    <div key={i} style={{ border: "1px solid rgba(233,196,95,0.4)", borderRadius: 14, padding: "10px 12px", marginBottom: 10, background: "rgba(233,196,95,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#a06b00" }}>{potName(i)}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>€{bt.toFixed(2)}</span>
                      </div>
                      {rows.map((r) => {
                        const who = r.participant_id ? (participants.find((p) => p.id === r.participant_id)?.name ?? "?") : "Algemeen"
                        return (
                          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: 14 }}>{r.participant_id ? "🙋" : "💰"}</span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#14213a" }}>{who}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#a06b00" }}>+€{r.amount.toFixed(2)}</span>
                            <button style={{ ...S.iconBtn, width: 24, height: 24, fontSize: 11 }} onClick={() => deletePotContribution(r.id)}>🗑️</button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Aanvullen — zelfde manier als de eerste pot-inleg */}
              <div style={{ background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 14, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#a06b00", marginBottom: 8 }}>➕ Pot aanvullen</div>
                {participants.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#aaa" }}>Voeg eerst personen toe</div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {["10", "15", "20"].map((v) => (
                        <button
                          key={v}
                          onClick={() => { setPotAddWarn(false); setPotAddBulk(v) }}
                          style={{ flex: 1, borderRadius: 10, padding: "8px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", border: potAddBulk === v ? "1.5px solid #ecc85a" : "1px solid rgba(20,33,58,0.15)", background: potAddBulk === v ? "rgba(233,196,95,0.18)" : "#fff", color: potAddBulk === v ? "#a06b00" : "#5a6680" }}
                        >
                          €{v}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, padding: "8px 10px", background: "#fff", border: "1px solid #ecc85a", borderRadius: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#14213a" }}>€</span>
                      <input type="number" placeholder="bedrag" value={potAddBulk} onChange={(e) => { setPotAddWarn(false); setPotAddBulk(e.target.value) }} style={{ ...S.input, flex: 1, minWidth: 0 }} />
                      <span style={{ fontSize: 13, color: "#777" }}>p.p.</span>
                    </div>
                    <button
                      onClick={() => setPotAddPerPersonOpen((o) => !o)}
                      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "none", border: "none", padding: "2px 0", marginBottom: 8, cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 11, color: "#bbb", transform: potAddPerPersonOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                      <span style={{ fontSize: 11, color: "#a06b00", fontWeight: 600 }}>Of vul per persoon een eigen bedrag in</span>
                    </button>
                    {potAddPerPersonOpen && (
                      <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 8 }}>
                        {participants.map((p) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                            <span style={{ color: "#999" }}>€</span>
                            <input type="number" placeholder="0" value={potAddDraft[p.id] ?? ""} onChange={(e) => { setPotAddWarn(false); setPotAddDraft({ ...potAddDraft, [p.id]: e.target.value }) }} style={{ ...S.input, width: 72 }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const draftSum = Object.values(potAddDraft).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      const bulk = parseFloat((potAddBulk || "").replace(",", ".")) || 0
                      const willAdd = draftSum > 0 ? draftSum : bulk * participants.length
                      return (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: "#14213a", fontWeight: 700 }}>
                          <span>Totaal toevoegen</span>
                          <span>€{willAdd.toFixed(2)}</span>
                        </div>
                      )
                    })()}
                    {potAddWarn && (
                      <div style={{ fontSize: 12.5, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 10, padding: "8px 10px" }}>
                        ⚠️ Vul eerst een bedrag in — als p.p. of per persoon.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn, flex: 1, padding: "12px 0", fontWeight: 700 }} onClick={() => setShowPotOverview(false)}>Annuleren</button>
                <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "12px 0", fontWeight: 800 }} onClick={addToPot}>Toevoegen</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pot modal — gezamenlijke inleg vooraf */}
      {showPotModal && (
        <div style={{ ...S.overlay, zIndex: 2200 }}>
          <div style={{ ...S.modal, width: 400, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: "#14213a" }}>💰 Leg een pot</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>Iedereen legt vooraf wat in de pot. Je kan het per persoon corrigeren als iemand niet meelegt.</p>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, padding: "10px 12px", background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#14213a" }}>€</span>
              <input type="number" value={potBulk} onChange={(e) => setPotBulk(e.target.value)} style={{ ...S.input, width: 70 }} />
              <span style={{ fontSize: 13, color: "#777" }}>p.p.</span>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontSize: 13, padding: "8px 0" }} onClick={setPotForEveryone}>Toevoegen</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
              {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Voeg eerst personen toe</div>}
              {participants.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: "#999" }}>€</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={potDraft[p.id] ?? ""}
                    onChange={(e) => { setPotWarn(false); setPotDraft((prev) => ({ ...prev, [p.id]: e.target.value })) }}
                    style={{ ...S.input, width: 80 }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14, color: "#14213a", fontWeight: 700 }}>
              <span>Totaal in pot</span>
              <span>€{Object.values(potDraft).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)}</span>
            </div>

            {potWarn && (
              <div style={{ fontSize: 13, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, lineHeight: 1.45 }}>
                ⚠️ Vul eerst een bedrag in voor minstens één persoon, of kies <b>Annuleer</b>.
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "10px 0" }} onClick={savePot}>💾 Opslaan</button>
              <button style={{ ...S.btn, flex: 1, padding: "10px 0" }} onClick={() => { setPotWarn(false); setShowPotModal(false) }}>Annuleer</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment editor modal */}
      {paymentEditRound !== null && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 380 }}>
            <h3 style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>💳 Ronde {paymentEditRound} — wie betaalde?</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Vul in hoeveel elke persoon betaalde, of zet het op &ldquo;De pot&rdquo;.</p>

            {/* De pot als betaler — enkel als er een pot is */}
            {(() => {
              const potUsedOther = payments.filter((p) => p.session >= 1 && !p.participant_id && p.session !== paymentEditRound).reduce((s, p) => s + p.amount, 0)
              const potAvailable = Math.max(0, potTotal - potUsedOther)
              if (potTotal <= 0) {
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.03)", border: "1px dashed rgba(20,33,58,0.2)", borderRadius: 12, marginBottom: 12 }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#aaa" }}>💰 De pot</span>
                    <span style={{ fontSize: 12, color: "#bbb" }}>geen pot gelegd</span>
                    <button onClick={openPotModal} style={{ background: "none", border: "none", color: "#c98a00", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>+ leg een pot</button>
                  </div>
                )
              }
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 12 }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#14213a" }}>💰 De pot</span>
                    <span style={{ color: "#999" }}>€</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={paymentDraft[POT_PAYER] ?? ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        const clamped = isNaN(v) ? e.target.value : String(Math.min(v, potAvailable))
                        setPaymentDraft((prev) => ({ ...prev, [POT_PAYER]: clamped }))
                      }}
                      style={{ ...S.input, width: 80 }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: "#a06b00", marginTop: 3, marginLeft: 4 }}>
                    nog €{potAvailable.toFixed(2)} beschikbaar in de pot
                  </div>
                </div>
              )
            })()}

            <div style={participants.length > 4 ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", columnGap: 16, rowGap: 10 } : undefined}>
            {participants.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: participants.length > 4 ? 0 : 10 }}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
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
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 12, marginBottom: 16, color: "#888" }}>
              <span>Som ingevuld</span>
              <span style={{ fontWeight: 700 }}>€{[POT_PAYER, ...participants.map((p) => p.id)].reduce((s, k) => s + (parseFloat(paymentDraft[k] || "") || 0), 0).toFixed(2)}</span>
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

      {/* Net afgeronde ronde — fullscreen bevestiging voor de barman + betaler kiezen */}
      {finishedRoundSnapshot && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 2100, overflowY: "auto", padding: 28 }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "#27ae60", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>✅ Ronde {finishedRoundSnapshot.session} besteld</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>🧾 Voor de barman</h2>
            </div>

            {barmanStep === "list" ? (
            <>
            {(() => {
              const visible = Object.entries(finishedRoundSnapshot.cart).filter(([, line]) => line.total > 0)
              const multi = visible.length > 4 // bij 5+ in kolommen, max ±4 onder elkaar
              return (
                <div style={multi ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: 10 } : undefined}>
                  {visible.map(([drinkId, line]) => {
                    const d = drinks.find((dr) => dr.id === drinkId)
                    if (!d) return null
                    const peopleNames = Object.entries(line.assignments)
                      .map(([pid, qty]) => {
                        const p = participants.find((pp) => pp.id === pid)
                        return p ? `${p.name} (${qty})` : null
                      })
                      .filter(Boolean)
                    return (
                      <div key={drinkId} style={{ display: "flex", alignItems: "center", gap: multi ? 10 : 14, marginBottom: multi ? 0 : 14, padding: multi ? "10px 12px" : "14px 18px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16 }}>
                        <span style={{ fontSize: multi ? 24 : 32, flexShrink: 0 }}>{d.emoji}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: multi ? 16 : 20, fontWeight: 800, color: "#333" }}>{line.total}× {d.name}</div>
                          {peopleNames.length > 0 && <div style={{ fontSize: multi ? 11 : 12, color: "#aaa", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: multi ? "nowrap" : "normal" }}>{peopleNames.join(", ")}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Stap 1-acties: aanpassen (klein) of door naar wie-betaalde (groot) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
              <button
                style={{ ...S.btn, width: "100%", padding: "15px 0", fontSize: 16, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a", boxShadow: "0 4px 14px rgba(233,196,95,0.45)" }}
                onClick={() => setBarmanStep("pay")}
              >
                💳 Wie betaalde dit rondje? →
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13, background: "transparent", border: "1px solid rgba(20,33,58,0.2)", color: "#6a7384" }}
                  onClick={adjustFinishedRound}
                >
                  ✏️ Bestelling aanpassen
                </button>
                <button
                  style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13, background: "transparent", border: "1px solid rgba(20,33,58,0.2)", color: "#6a7384" }}
                  onClick={() => { setPaymentDraft({}); setFinishedRoundSnapshot(null); setView("ordering"); setBarmanStep("list") }}
                >
                  ⏳ Later invullen
                </button>
              </div>
            </div>
            </>
            ) : (
            <>
            <div style={{ marginTop: 8, padding: "16px 18px", background: "rgba(27,42,74,0.05)", borderRadius: 16, border: "1px solid rgba(27,42,74,0.15)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>💳 Wie betaalde deze ronde?</div>

              {/* De pot als betaler — enkel als er een pot is */}
              {(() => {
                const potUsedOther = payments.filter((p) => p.session >= 1 && !p.participant_id && p.session !== finishedRoundSnapshot.session).reduce((s, p) => s + p.amount, 0)
                const potAvailable = Math.max(0, potTotal - potUsedOther)
                if (potTotal <= 0) {
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,0.03)", border: "1px dashed rgba(20,33,58,0.2)", borderRadius: 12, marginBottom: 12 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#aaa" }}>💰 De pot</span>
                      <span style={{ fontSize: 12, color: "#bbb" }}>geen pot gelegd</span>
                      <button onClick={openPotModal} style={{ background: "none", border: "none", color: "#c98a00", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>+ leg een pot</button>
                    </div>
                  )
                }
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 12 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#14213a" }}>💰 De pot</span>
                      <span style={{ color: "#999" }}>€</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={paymentDraft[POT_PAYER] ?? ""}
                        onChange={(e) => {
                          setPayWarn(false)
                          const v = parseFloat(e.target.value)
                          const clamped = isNaN(v) ? e.target.value : String(Math.min(v, potAvailable))
                          setPaymentDraft((prev) => ({ ...prev, [POT_PAYER]: clamped }))
                        }}
                        style={{ ...S.input, width: 80 }}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: "#a06b00", marginTop: 3, marginLeft: 4 }}>
                      nog €{potAvailable.toFixed(2)} beschikbaar in de pot
                    </div>
                  </div>
                )
              })()}

              <div style={participants.length > 4 ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", columnGap: 16, rowGap: 8 } : undefined}>
              {participants.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: participants.length > 4 ? 0 : 8 }}>
                  <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ color: "#999" }}>€</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={paymentDraft[p.id] ?? ""}
                    onChange={(e) => { setPayWarn(false); setPaymentDraft((prev) => ({ ...prev, [p.id]: e.target.value })) }}
                    style={{ ...S.input, width: 80 }}
                  />
                </div>
              ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20 }}>
              {payWarn && (
                <div style={{ fontSize: 13, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45 }}>
                  ⚠️ Geef eerst het betaalde bedrag van dit rondje in — via <b>de pot</b> of een <b>persoon</b>. Of kies <b>Later invullen</b> om het later te doen.
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.btn, flexShrink: 0, padding: "13px 16px", fontSize: 13, fontWeight: 700, background: "transparent", border: "1px solid rgba(20,33,58,0.2)", color: "#6a7384" }}
                  onClick={() => { setPayWarn(false); setPaymentDraft({}); setFinishedRoundSnapshot(null); setView("ordering"); setBarmanStep("list") }}
                >
                  ⏳ Later invullen
                </button>
                <button
                  style={{ ...S.btn, flex: 1, padding: "13px 0", fontSize: 15, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a", boxShadow: "0 4px 14px rgba(233,196,95,0.45)" }}
                  onClick={async () => {
                    if (!group) return
                    const round = finishedRoundSnapshot.session
                    const inserts = (Object.entries(paymentDraft) as [string, string][])
                      .filter(([key, amt]) => (key === POT_PAYER || participants.some((p) => p.id === key)) && parseFloat(amt) > 0)
                      .map(([key, amt]) => ({ group_id: group.id, session: round, participant_id: key === POT_PAYER ? null : key, amount: parseFloat(amt) }))
                    if (inserts.length === 0) { setPayWarn(true); return }
                    await supabase.from("payments").insert(inserts)
                    await loadAll(group.id)
                    setPayWarn(false)
                    setPaymentDraft({})
                    setFinishedRoundSnapshot(null)
                    setBarmanStep("list")
                    setView("ordering")
                    setToast(`Ronde ${round} afgerond!`)
                  }}
                >
                  💾 Opslaan &amp; sluiten
                </button>
              </div>
              <button
                style={{ ...S.btn, width: "100%", padding: "11px 0", fontSize: 13, background: "transparent", border: "1px solid rgba(20,33,58,0.2)", color: "#6a7384" }}
                onClick={() => { setPayWarn(false); setBarmanStep("list") }}
              >
                ← Terug naar het lijstje
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ═══ VIEW: Totaal (wie dronk wat) ═══ */}
      {view === "bill" && (
        <div>
          {/* Overall drink overview — ALL orders, assigned or not */}
          <div style={S.card}>
            <h3 style={{ ...S.h3, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              📦 Alle bestelde drankjes
              {(() => { const tot = orders.reduce((s, o) => s + o.quantity, 0); return tot > 0 ? <span style={{ fontSize: 12, fontWeight: 800, color: "#14213a", background: "#ecc85a", borderRadius: 20, padding: "1px 11px" }}>{tot} {tot === 1 ? "drankje" : "drankjes"}</span> : null })()}
            </h3>
            {(() => {
              const overallSummary: Record<string, { drink: Drink; totalQty: number; anonymousQty: number }> = {}
              orders.forEach((o) => {
                const d = drinks.find((dr) => dr.id === o.drink_id)
                if (!d) return
                if (!overallSummary[d.id]) overallSummary[d.id] = { drink: d, totalQty: 0, anonymousQty: 0 }
                overallSummary[d.id].totalQty += o.quantity
                if (!o.participant_id) overallSummary[d.id].anonymousQty += o.quantity
              })
              const items = Object.values(overallSummary)
              if (items.length === 0) return <div style={{ color: "#aaa", textAlign: "center", padding: 12, fontSize: 13 }}>Nog niets besteld</div>
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8, alignItems: "start" }}>
                  {items.map((it) => (
                    <div key={it.drink.id} style={{ background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 12, padding: "8px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 17 }}>{it.drink.emoji}</span>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{it.totalQty}×</span>
                        <span style={{ fontSize: 12.5, color: "#555", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{it.drink.name}</span>
                      </div>
                      {participants.length > 0
                        ? renderBillAssign(it.drink)
                        : it.anonymousQty > 0 && <span style={{ fontSize: 10, color: "#e0685c", fontWeight: 600 }}>({it.anonymousQty} niet toegewezen)</span>}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div style={S.card}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ ...S.h3, marginBottom: 6 }}>🧾 Wie dronk wat + hoeveel betaald?</h3>
              {(bill.totalActuallySpent > 0.01 || potTotal > 0) && (() => {
                const potUsed = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
                const potLeft = Math.max(0, potTotal - potUsed)
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11.5, fontWeight: 700 }}>
                    <span style={{ background: "rgba(39,174,96,0.1)", color: "#1f8a4c", borderRadius: 20, padding: "3px 11px" }}>💳 betaald €{bill.totalActuallySpent.toFixed(2)}</span>
                    {potTotal > 0 && <span style={{ background: "rgba(233,196,95,0.16)", color: "#a06b00", borderRadius: 20, padding: "3px 11px" }}>💰 uit pot €{potUsed.toFixed(2)}</span>}
                    {potTotal > 0 && <span style={{ background: "rgba(20,33,58,0.05)", color: "#5a6680", borderRadius: 20, padding: "3px 11px" }}>🪙 nog in pot €{potLeft.toFixed(2)}</span>}
                  </div>
                )
              })()}
            </div>

            <div style={{ marginTop: 4 }}>
              {/* Kolomtitels boven de twee prijskolommen (enkel bij kleine groep — bij 4+ staan labels in elke kaart) */}
              {showBillPrices && participants.length > 0 && participants.length < 4 && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 12, padding: "0 4px 6px" }}>
                  <div style={{ width: 74, textAlign: "right", fontSize: 10, color: "#aaa", fontWeight: 700 }}>indicatief</div>
                  <button onClick={() => setShowFairSplit((v) => !v)} title="Fair split tonen of verbergen" style={{ width: 162, textAlign: "center", fontSize: 11, fontWeight: 800, color: showFairSplit ? "#14213a" : "#a06b00", background: showFairSplit ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "rgba(233,196,95,0.16)", border: showFairSplit ? "none" : "1px solid rgba(233,196,95,0.55)", borderRadius: 8, padding: "4px 0", letterSpacing: 0.5, boxShadow: showFairSplit ? "0 2px 8px rgba(233,196,95,0.4)" : "none", cursor: "pointer" }}>{showFairSplit ? "FAIR SPLIT ✕" : "+ FAIR SPLIT"}</button>
                </div>
              )}
              {orders.some((o) => o.participant_id) && (
              <div style={participants.length >= 4 ? { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${participants.length >= 6 ? 188 : 250}px, 1fr))`, gap: 10, marginTop: 2 } : undefined}>
              {participants.map((p) => {
                const personOrders = orders.filter((o) => o.participant_id === p.id)
                const drinkSummary: Record<string, { drink: Drink; qty: number }> = {}
                personOrders.forEach((o) => {
                  const d = drinks.find((dr) => dr.id === o.drink_id)
                  if (!d) return
                  if (!drinkSummary[d.id]) drinkSummary[d.id] = { drink: d, qty: 0 }
                  drinkSummary[d.id].qty += o.quantity
                })
                const line = bill.lines.find((l) => l.participantId === p.id)
                const paid = line?.paid ?? 0
                const potInlegPerson = payments.filter((pay) => pay.session === 0 && pay.participant_id === p.id).reduce((s, pay) => s + pay.amount, 0)
                const personalPaidPerson = paid - potInlegPerson
                const drinkValue = line?.drinkValue ?? 0
                const fair = fairSplit.find((f) => f.participantId === p.id)
                const myDebts = settledDebts.filter((t) => t.from === p.name)   // ik betaal aan ...
                const myCredits = settledDebts.filter((t) => t.to === p.name)   // ik krijg van ...
                const pricesVisible = showBillPrices
                const multiCol = participants.length >= 4

                return (
                  <div key={p.id} style={multiCol
                    ? { padding: 10, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, background: "#fff" }
                    : { padding: "12px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    {/* Naam + al ingelegd/betaald meteen erachter */}
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</span>
                        {potInlegPerson > 0 && <span style={{ fontSize: 11, color: "#c98a00", fontWeight: 600 }}>· €{potInlegPerson.toFixed(2)} in de pot</span>}
                        {personalPaidPerson > 0.01 && <span style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>· €{personalPaidPerson.toFixed(2)} zelf betaald</span>}
                      </div>
                    </div>

                    {/* Drankjes + prijzen. Bij 4+ wrappen de prijzen onder de drankjes. */}
                    <div style={{ display: "flex", flexWrap: multiCol ? "wrap" : "nowrap", justifyContent: "space-between", alignItems: "flex-start", gap: multiCol ? 8 : 12 }}>
                      <div style={{ flex: multiCol ? "1 1 100%" : "1 1 0", minWidth: 0 }}>
                        {Object.values(drinkSummary).length === 0 ? (
                          <div style={{ fontSize: 12, color: "#bbb" }}>nog niets gedronken</div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {Object.values(drinkSummary).map((ds) => (
                              <span key={ds.drink.id} style={{ background: "rgba(0,0,0,0.03)", borderRadius: 10, padding: "3px 10px", fontSize: 12 }}>
                                {ds.drink.emoji} {ds.qty}× {ds.drink.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {pricesVisible && (() => {
                        const fairOk = showFairSplit && fair?.participated
                        const net = fairOk ? fair!.fairShare - paid : 0
                        const back = net < -0.01
                        const owes = net > 0.01
                        const settle = () => {
                          if (!fairOk) return null
                          // Toon ALLE verrekeningen (niet enkel de eerste), zodat ook teruggave uit de pot zichtbaar is en de pot op €0 uitkomt
                          if (owes && myDebts.length > 0) {
                            return <>{myDebts.map((t, i) => (
                              <div key={i} style={{ color: "#e67e22", fontWeight: 700 }}>→ betaalt €{t.amount.toFixed(2)} {t.to === "de pot" ? "in de pot" : `aan ${t.to}`}</div>
                            ))}</>
                          }
                          if (back && myCredits.length > 0) {
                            return <>{myCredits.map((t, i) => (
                              <div key={i} style={{ color: "#1f8a4c", fontWeight: 700 }}>↩ Ontvangt €{t.amount.toFixed(2)} {t.from === "de pot" ? "uit de pot" : `van ${t.from}`}</div>
                            ))}</>
                          }
                          return <span style={{ color: "#999", fontWeight: 700 }}>✓ staat gelijk</span>
                        }
                        const fairLabel = <span style={{ fontSize: 9.5, color: "#caa54e", fontWeight: 600, letterSpacing: 0.3 }}>fair split</span>
                        if (multiCol) {
                          return (
                            <div style={{ width: "100%", borderTop: "1px solid rgba(0,0,0,0.07)", marginTop: 8, paddingTop: 7 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#aaa" }}>indicatief <b style={{ color: "#8a93a3", fontWeight: 700 }}>€{drinkValue.toFixed(2)}</b></span>
                                {fairOk && <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>{fairLabel}<span style={{ fontSize: 17, fontWeight: 800, color: "#14213a" }}>€{fair!.fairShare.toFixed(2)}</span></span>}
                              </div>
                              {fairOk && <div style={{ fontSize: 11, marginTop: 3, textAlign: "right", lineHeight: 1.35 }}>{settle()}</div>}
                            </div>
                          )
                        }
                        return (
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexShrink: 0 }}>
                            <div style={{ width: 74, textAlign: "right", paddingTop: 4 }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 15, fontWeight: 700, color: "#8a93a3" }}>€{drinkValue.toFixed(2)}</div>
                            </div>
                            {fairOk && (
                              <div style={{ width: 162, boxSizing: "border-box", textAlign: "center", background: "linear-gradient(135deg,rgba(233,196,95,0.16),rgba(240,165,0,0.10))", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 12, padding: "6px 8px" }}>
                                <div style={{ fontSize: 19, fontWeight: 800, color: "#14213a" }}>€{fair!.fairShare.toFixed(2)}</div>
                                <div style={{ fontSize: 10.5, marginTop: 2, lineHeight: 1.35 }}>{settle()}</div>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}
              </div>
              )}
              {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20 }}>Nog geen personen</div>}

              {/* Knop onder de drankjes: simpel — verdeel eerlijk via fair split */}
              {!showBillPrices && participants.length > 0 && (
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <button
                    onClick={() => {
                      const anon = orders.filter((o) => !o.participant_id && o.quantity > 0)
                      const unassigned = anon.reduce((s, o) => s + o.quantity, 0)
                      if (unassigned > 0) {
                        setAssignPopupDrinkIds(Array.from(new Set(anon.map((o) => o.drink_id))))
                        setShowAssignPopup(true)
                      }
                      else { setShowBillPrices(true); setShowFairSplit(true) }
                    }}
                    style={{ width: "100%", border: "none", borderRadius: 14, padding: "14px 18px", cursor: "pointer", background: "linear-gradient(135deg,#5a6ca6,#7283b6)", boxShadow: "0 6px 16px -6px rgba(90,108,166,0.55)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                      <RundoLogo size={20} />
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Verdeel eerlijk via Fair split</span>
                  </button>
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 9 }}>
                    <button
                      onClick={() => setFairInfoMode("what")}
                      style={{ background: "none", border: "none", color: "#7a8296", fontSize: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                    >
                      Hoe werkt Fair Split?
                    </button>
                  </div>
                </div>
              )}

              {/* Klein kolomtotaal, uitgelijnd onder de kolommen (enkel bij kleine groep) */}
              {showBillPrices && participants.length > 0 && participants.length < 4 && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "8px 4px 2px", marginTop: 2 }}>
                  <div style={{ width: 74, textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "#aaa" }}>totaal</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#8a93a3" }}>€{bill.totalDrinkValue.toFixed(2)}</div>
                  </div>
                  {showFairSplit && (
                    <div style={{ width: 162, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#1f8a4c" }}>totaal</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#27ae60" }}>€{bill.totalActuallySpent.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Totalen + fair split-correctie */}
            {showBillPrices && participants.length > 0 && (() => {
              const personalRoundPaid = payments.filter((p) => p.session >= 1 && p.participant_id).reduce((s, p) => s + p.amount, 0)
              const potUsed = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
              const potOver = Math.max(0, potTotal - potUsed)
              const indicatief = bill.totalDrinkValue
              const echtBetaald = bill.totalActuallySpent
              const verschil = echtBetaald - indicatief // > 0: indicatief te laag (iedereen meer), < 0: te hoog (minder)
              const heeftVerschil = Math.abs(verschil) > 0.01 && indicatief > 0.01
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, background: "rgba(20,33,58,0.04)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <span>Indicatieve prijs <span style={{ fontSize: 9, color: "#bbb" }}>(totaal)</span></span>
                        <button onClick={() => setShowIndicatiefInfo(true)} title="Wat betekent dit?" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#b9c0cc", fontSize: 13, lineHeight: 1 }}>ⓘ</button>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#8a93a3" }}>€{indicatief.toFixed(2)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: "rgba(39,174,96,0.08)", borderRadius: 12, padding: "10px 12px", textAlign: "center", border: "1px solid rgba(39,174,96,0.25)" }}>
                        <div style={{ fontSize: 11, color: "#1f8a4c", marginBottom: 2 }}>Echt betaald <span style={{ fontSize: 9, color: "#9ccfb0" }}>(totaal)</span></div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#27ae60" }}>€{echtBetaald.toFixed(2)}</div>
                      </div>
                      {/* Opsplitsing van wat er écht betaald werd — hoort bij dit totaal */}
                      {(potTotal > 0 || personalRoundPaid > 0.01) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6, fontSize: 10.5, color: "#999", textAlign: "center", lineHeight: 1.35 }}>
                          {potTotal > 0 && (
                            <span>💰 pot: <b style={{ color: "#c98a00" }}>€{potTotal.toFixed(2)}</b> ingelegd · <b style={{ color: "#a06b00" }}>€{potUsed.toFixed(2)}</b> gebruikt{potOver > 0.01 ? <> · <b style={{ color: "#27ae60" }}>€{potOver.toFixed(2)}</b> terug</> : ""}</span>
                          )}
                          {personalRoundPaid > 0.01 && <span>💳 door personen betaald: <b style={{ color: "#27ae60" }}>€{personalRoundPaid.toFixed(2)}</b></span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Fair split weer verbergen */}
            {showBillPrices && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button onClick={() => { setShowBillPrices(false); setShowFairSplit(false) }} style={{ background: "linear-gradient(135deg,#5a6ca6,#7283b6)", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 20, padding: "8px 16px", boxShadow: "0 6px 16px -6px rgba(90,108,166,0.55)" }}>Verberg Fair split</button>
              </div>
            )}
          </div>

          {/* Popup: drankjes toewijzen vóór Fair Split (per rondje, compact) */}
          {showAssignPopup && (() => {
            // live: hoeveel staat er nu nog open (over alle drankjes)
            const liveUnassignedTotal = orders.filter((o) => !o.participant_id).reduce((s, o) => s + o.quantity, 0)
            // few-modus op basis van de snapshot bij openen → drankjes blijven zichtbaar, ook na toewijzen
            const snapshotDrinks = assignPopupDrinkIds.map((id) => drinks.find((d) => d.id === id)).filter((d): d is Drink => !!d)
            const few = assignPopupDrinkIds.length > 0 && assignPopupDrinkIds.length <= 2
            return (
              <div style={S.overlay} onClick={() => setShowAssignPopup(false)}>
                <div style={{ ...S.modal, width: 420, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                  {few ? (
                    <>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#14213a", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>🍹 Toewijzen</h3>
                      <p style={{ fontSize: 13, color: "#777", marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
                        {liveUnassignedTotal > 0
                          ? <><b style={{ color: "#e0685c" }}>{liveUnassignedTotal} {liveUnassignedTotal === 1 ? "drankje" : "drankjes"} nog niet toegewezen.</b> Tik personen aan — meerdere mag.</>
                          : <>Alles toegewezen 🎉 Je kan nog <b>wijzigen</b> of doorgaan naar Fair Split.</>}
                      </p>
                      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                        {snapshotDrinks.map((d) => {
                          const tot = orders.filter((o) => o.drink_id === d.id).reduce((s, o) => s + o.quantity, 0)
                          return (
                            <div key={d.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "8px 10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{d.emoji}</span>
                                <span style={{ fontSize: 14, fontWeight: 800 }}>{tot}×</span>
                                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{d.name}</span>
                              </div>
                              {renderBillAssign(d)}
                            </div>
                          )
                        })}
                      </div>
                      {liveUnassignedTotal === 0 ? (
                        <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontWeight: 800 }} onClick={() => { setShowAssignPopup(false); setShowBillPrices(true); setShowFairSplit(true) }}>Toon Fair Split →</button>
                      ) : (
                        <button style={{ ...S.btn, width: "100%", padding: "11px 0", fontSize: 13 }} onClick={() => setShowAssignPopup(false)}>Sluiten</button>
                      )}
                    </>
                  ) : liveUnassignedTotal === 0 ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#14213a", margin: "0 0 6px" }}>Alles toegewezen!</h3>
                      <p style={{ fontSize: 13, color: "#777", marginBottom: 18 }}>Je kan nu de eerlijke verdeling bekijken.</p>
                      <button
                        style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontWeight: 800 }}
                        onClick={() => { setShowAssignPopup(false); setShowBillPrices(true); setShowFairSplit(true) }}
                      >
                        Toon Fair Split →
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#14213a", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>🍹 Nog niet toegewezen</h3>
                      <p style={{ fontSize: 13, color: "#777", marginTop: 0, marginBottom: 16, lineHeight: 1.55 }}>
                        Er zijn nog <b style={{ color: "#e0685c" }}>{liveUnassignedTotal} {liveUnassignedTotal === 1 ? "drankje" : "drankjes"}</b> niet toegewezen. Wijs ze toe in <b>&ldquo;Alle bestelde drankjes&rdquo;</b> of in <b>&ldquo;Rondjesoverzicht&rdquo;</b>.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                          style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}
                          onClick={() => { setShowAssignPopup(false); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }) }}
                        >
                          Naar &ldquo;Alle bestelde drankjes&rdquo;
                        </button>
                        <button style={{ ...S.btn, width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 700, background: "rgba(90,108,166,0.1)", border: "1px solid rgba(90,108,166,0.3)", color: "#5a6ca6" }} onClick={() => { setOpenRounds(null); setShowAssignPopup(false); setView("rounds") }}>Naar &ldquo;Rondjesoverzicht&rdquo;</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

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

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const S: Record<string, React.CSSProperties> = {
  page: {
    padding: 18,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    background: "linear-gradient(180deg,#fbfaff 0%,#f1f2fb 55%,#eef3f7 100%)",
    minHeight: "100vh",
    color: "#1d2433",
    maxWidth: 720,
    margin: "0 auto",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  card: {
    background: "#ffffff",
    border: "1px solid rgba(16,24,40,0.04)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 1px 2px rgba(16,24,40,0.03), 0 14px 30px -16px rgba(80,90,140,0.18)",
    marginBottom: 14,
  },
  btn: {
    border: "1px solid rgba(16,24,40,0.10)",
    background: "#ffffff",
    borderRadius: 12,
    padding: "9px 16px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#1d2433",
    boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
    transition: "transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease",
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#5a6ca6,#7283b6)",
    color: "white",
    border: "none",
    boxShadow: "0 6px 16px -6px rgba(90,108,166,0.55)",
  },
  iconBtn: {
    border: "none",
    background: "rgba(16,24,40,0.05)",
    borderRadius: 11,
    width: 32,
    height: 32,
    fontSize: 14,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .12s ease, transform .12s ease",
  },
  input: {
    border: "1.5px solid rgba(16,24,40,0.12)",
    borderRadius: 12,
    padding: "10px 13px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "#1d2433",
    transition: "border-color .12s ease, box-shadow .12s ease",
  },
  h1: { fontSize: 29, fontWeight: 800, letterSpacing: -0.7, marginBottom: 4, color: "#2f3c5e" },
  h3: { fontSize: 16, fontWeight: 800, marginBottom: 14, letterSpacing: -0.3, color: "#3b486a", display: "flex", alignItems: "center", gap: 9 },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    padding: "4px 2px",
  },
  tabBar: {
    display: "flex",
    gap: 4,
    background: "#edeef6",
    borderRadius: 16,
    padding: 5,
    marginBottom: 18,
    boxShadow: "inset 0 1px 2px rgba(16,24,40,0.04)",
  },
  stickyCart: {
    position: "fixed",
    bottom: 18,
    left: 16,
    right: 16,
    maxWidth: 720 - 32,
    margin: "0 auto",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 20,
    padding: "14px 18px",
    boxShadow: "0 10px 40px -6px rgba(16,24,40,0.25)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 500,
    border: "1px solid rgba(16,24,40,0.06)",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)", padding: 16,
  },
  modal: {
    background: "#fff", borderRadius: 24, padding: 24, width: 360,
    boxShadow: "0 24px 70px -12px rgba(16,24,40,0.35)", maxHeight: "85vh", display: "flex", flexDirection: "column",
    border: "1px solid rgba(16,24,40,0.06)",
  },
  toast: {
    position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1d2433", color: "#fff",
    padding: "11px 22px", borderRadius: 40, fontSize: 14, fontWeight: 600, zIndex: 2000,
    boxShadow: "0 10px 30px rgba(16,24,40,0.3)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center",
  },
  errorBanner: {
    background: "#fef2f2", border: "1px solid #fecaca", color: "#c0392b", borderRadius: 14, padding: "11px 16px",
    marginBottom: 14, display: "flex", alignItems: "center", fontSize: 14,
  },
}
