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
  is_placeholder?: boolean
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

type SavedGroup = {
  id: string
  name: string
  invite_code: string
  savedAt: number
}

type QuickOrderItem = {
  id: string
  text: string
  drinks: { name: string; qty: number; emoji: string; assignments: { participantId: string; qty: number }[] }[]
  timestamp: number
}

type AppView = "setup" | "ordering" | "rounds" | "bill"

// ─── New: tracks the last item(s) added to the bar list ───────────────────
type LastAdded = {
  items: { name: string; qty: number; emoji: string }[]
  source: "voice" | "manual"
}

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

type DrinkMatchResult = {
  strongMatch: Drink | null
  suggestion: Drink | null
}

function fuzzyMatchDrink(spokenName: string, drinkList: Drink[]): Drink | null {
  return matchDrinkWithSuggestion(spokenName, drinkList).strongMatch
}

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

  let m = drinkList.find((d) => normalizeDrinkName(d.name) === spoken)
  if (m) return { strongMatch: m, suggestion: null }

  m = drinkList.find((d) => {
    const dn = normalizeDrinkName(d.name)
    return spoken.includes(dn) || dn.includes(spoken)
  })
  if (m) return { strongMatch: m, suggestion: null }

  m = drinkList.find((d) => {
    const dn = normalizeDrinkName(d.name)
    return spokenWords.length > 0 && spokenWords.every((w) => dn.includes(w))
  })
  if (m) return { strongMatch: m, suggestion: null }

  let bestScore = 0
  let bestDrink: Drink | null = null
  for (const d of drinkList) {
    const dn = normalizeDrinkName(d.name)
    const dnWords = dn.split(" ")
    const wordMatches = spokenWords.filter((w) => dnWords.some((dw) => dw.includes(w) || w.includes(dw))).length
    const wordScore = spokenWords.length > 0 ? wordMatches / spokenWords.length : 0
    const maxLen = Math.max(spoken.length, dn.length)
    const editScore = maxLen > 0 ? 1 - levenshtein(spoken, dn) / maxLen : 0
    const score = Math.max(wordScore, editScore)
    if (score > bestScore) { bestScore = score; bestDrink = d }
  }

  if (bestScore >= 0.7) return { strongMatch: bestDrink, suggestion: null }
  if (bestScore >= 0.4) return { strongMatch: null, suggestion: bestDrink }
  return { strongMatch: null, suggestion: null }
}

type ParsedSpeechResult = {
  recognized: { name: string; qty: number; emoji: string }[]
  unrecognizedText: string | null
  suggestion: { drink: Drink; qty: number } | null
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
      const words = remaining.trim().split(/\s+/)
      const chunkWords = words.slice(0, Math.min(3, words.length))
      const chunk = chunkWords.join(" ")
      if (chunk) unmatchedChunks.push({ text: chunk, qty })
      remaining = words.slice(chunkWords.length).join(" ")
      if (!remaining) break
    }
  }

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
  drinkValue: number
  paid: number
}

function calculateBill(
  participants: Participant[],
  orders: Order[],
  drinks: Drink[],
  payments: Payment[]
): { lines: PersonBillLine[]; totalDrinkValue: number; anonymousValue: number; totalPaid: number; difference: number } {
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
  const totalPaid = lines.reduce((s, l) => s + l.paid, 0)
  const difference = totalPaid - totalDrinkValue

  return { lines, totalDrinkValue, anonymousValue, totalPaid, difference }
}

function calculateFairSplit(
  lines: PersonBillLine[],
  difference: number,
  anonymousValue: number,
  equalWeight = 0.2
): { participantId: string; name: string; fairShare: number; paid: number; balance: number; participated: boolean }[] {
  const n = lines.length
  if (n === 0) return []

  const participants = lines.filter((l) => l.drinkValue > 0 || l.paid > 0)
  const nParticipating = participants.length || n

  const totalDrinkValue = lines.reduce((s, l) => s + l.drinkValue, 0)
  const allAnonymous = totalDrinkValue === 0 && anonymousValue > 0

  return lines.map((l) => {
    const participated = l.drinkValue > 0 || l.paid > 0
    if (!participated) {
      return { participantId: l.participantId, name: l.name, fairShare: 0, paid: 0, balance: 0, participated: false }
    }

    let fairShare: number
    if (allAnonymous) {
      fairShare = (totalDrinkValue + anonymousValue + difference) / nParticipating
    } else {
      const equalPart = (totalDrinkValue + anonymousValue + difference) * equalWeight / nParticipating
      const weightPart = totalDrinkValue > 0
        ? (totalDrinkValue + anonymousValue + difference) * (1 - equalWeight) * (l.drinkValue / totalDrinkValue)
        : 0
      fairShare = equalPart + weightPart
    }

    const balance = l.paid - fairShare
    return { participantId: l.participantId, name: l.name, fairShare, paid: l.paid, balance, participated: true }
  })
}

// Debt settlement — returns concrete "X pays Y €amount" transactions, filtering out self-payments
function settleDebts(
  fairSplit: { participantId: string; name: string; balance: number; participated: boolean }[]
): { from: string; fromId: string; to: string; toId: string; amount: number }[] {
  const creditors = fairSplit.filter((f) => f.participated && f.balance > 0.01).map((f) => ({ ...f }))
  const debtors = fairSplit.filter((f) => f.participated && f.balance < -0.01).map((f) => ({ ...f, balance: -f.balance }))

  const transactions: { from: string; fromId: string; to: string; toId: string; amount: number }[] = []
  let ci = 0, di = 0
  creditors.sort((a, b) => b.balance - a.balance)
  debtors.sort((a, b) => b.balance - a.balance)

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci]
    const debt = debtors[di]
    // Never create a self-payment transaction
    if (credit.participantId === debt.participantId) {
      ci++
      continue
    }
    const amount = Math.min(credit.balance, debt.balance)
    if (amount > 0.01) {
      transactions.push({ from: debt.name, fromId: debt.participantId, to: credit.name, toId: credit.participantId, amount })
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

function QRModal({ inviteCode, onClose }: { inviteCode: string; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "[cdnjs.cloudflare.com](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js)"
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

// ─── "Zojuist toegevoegd" banner ──────────────────────────────────────────
function LastAddedBanner({ lastAdded, onDismiss }: { lastAdded: LastAdded; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [lastAdded, onDismiss])

  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(39,174,96,0.12),rgba(39,174,96,0.06))",
      border: "1px solid rgba(39,174,96,0.35)",
      borderRadius: 14,
      padding: "10px 14px",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#27ae60", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>
          {lastAdded.source === "voice" ? "🎤 Zojuist via spraak toegevoegd" : "✅ Zojuist toegevoegd aan barlijst"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {lastAdded.items.map((item, i) => (
            <span key={i} style={{ background: "rgba(39,174,96,0.15)", borderRadius: 10, padding: "2px 10px", fontSize: 13, fontWeight: 700, color: "#1e8449" }}>
              {item.emoji} {item.qty}× {item.name}
            </span>
          ))}
        </div>
      </div>
      <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#aaa", flexShrink: 0 }}>✕</button>
    </div>
  )
}

// ─── Inline "Drankje niet herkend" modal ─────────────────────────────────
type UnrecognizedDrinkAction = "add-custom" | "pick-from-list" | null

function UnrecognizedDrinkPanel({
  spokenText,
  suggestion,
  drinks,
  onAcceptSuggestion,
  onAddCustom,
  onPickFromList,
  onDismiss,
}: {
  spokenText: string
  suggestion: Drink | null
  drinks: Drink[]
  onAcceptSuggestion: (drink: Drink) => void
  onAddCustom: (name: string, price: string, emoji: string, category: string) => void
  onPickFromList: (drink: Drink) => void
  onDismiss: () => void
}) {
  const [action, setAction] = useState<UnrecognizedDrinkAction>(null)
  const [customName, setCustomName] = useState(spokenText.charAt(0).toUpperCase() + spokenText.slice(1))
  const [customPrice, setCustomPrice] = useState("")
  const [customEmoji, setCustomEmoji] = useState("🍹")
  const [customCategory, setCustomCategory] = useState("Cocktail")
  const [pickSearch, setPickSearch] = useState("")
  const [activePickCat, setActivePickCat] = useState<string | null>(null)

  const groupedDrinks = groupDrinksByCategory(drinks)

  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(231,76,60,0.06),rgba(231,76,60,0.03))",
      border: "1px solid rgba(231,76,60,0.25)",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#e74c3c", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            🎤 Niet herkend
          </div>
          <div style={{ fontSize: 13, color: "#555" }}>
            &ldquo;<b>{spokenText}</b>&rdquo; staat niet in de barlijst
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#aaa" }}>✕</button>
      </div>

      {/* Step 1: Suggestion if available */}
      {suggestion && action === null && (
        <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Bedoelde je misschien:</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{suggestion.emoji} {suggestion.name}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 12, padding: "6px 14px" }} onClick={() => onAcceptSuggestion(suggestion)}>
                Ja, dit is het
              </button>
              <button style={{ ...S.btn, fontSize: 12, padding: "6px 10px" }} onClick={() => setAction("add-custom")}>
                Nee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Action choice (if no suggestion or suggestion declined) */}
      {(action === null && !suggestion) && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{ ...S.btn, flex: 1, fontSize: 13, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
            onClick={() => setAction("add-custom")}
          >
            <span style={{ fontSize: 20 }}>➕</span>
            <span style={{ fontWeight: 700 }}>Eigen drankje</span>
            <span style={{ fontSize: 11, color: "#aaa" }}>toevoegen aan lijst</span>
          </button>
          <button
            style={{ ...S.btn, flex: 1, fontSize: 13, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
            onClick={() => setAction("pick-from-list")}
          >
            <span style={{ fontSize: 20 }}>🍹</span>
            <span style={{ fontWeight: 700 }}>Kies uit lijst</span>
            <span style={{ fontSize: 11, color: "#aaa" }}>bestaand drankje</span>
          </button>
        </div>
      )}

      {/* When suggestion was shown but not yet acted on — also show the two options below */}
      {action === null && suggestion && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{ ...S.btn, flex: 1, fontSize: 12 }} onClick={() => setAction("pick-from-list")}>
            🍹 Kies een ander drankje
          </button>
        </div>
      )}

      {/* Add custom drink form */}
      {action === "add-custom" && (
        <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "12px", border: "1px solid rgba(0,0,0,0.07)", marginTop: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Nieuw drankje toevoegen</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              placeholder="Naam"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{ ...S.input, flex: "1 1 120px", minWidth: 100 }}
            />
            <input
              type="number"
              placeholder="Prijs €"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              style={{ ...S.input, width: 72 }}
            />
            <input
              placeholder="🍹"
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              style={{ ...S.input, width: 50 }}
            />
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              style={{ ...S.input, flex: "1 1 90px" }}
            >
              {Object.keys(CATEGORY_LABELS).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              style={{ ...S.btn, ...S.btnPrimary, flex: 1 }}
              onClick={() => { if (customName && customPrice) onAddCustom(customName, customPrice, customEmoji, customCategory) }}
            >
              ➕ Toevoegen & bestellen
            </button>
            <button style={{ ...S.btn }} onClick={() => setAction(null)}>← Terug</button>
          </div>
        </div>
      )}

      {/* Pick from list */}
      {action === "pick-from-list" && (
        <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "12px", border: "1px solid rgba(0,0,0,0.07)", marginTop: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Kies een drankje</div>
          <input
            autoFocus
            placeholder="Zoek..."
            value={pickSearch}
            onChange={(e) => setPickSearch(e.target.value)}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
          />
          {pickSearch.trim() === "" && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 }}>
              {groupedDrinks.map(([cat]) => (
                <button
                  key={cat}
                  onClick={() => setActivePickCat(activePickCat === cat ? null : cat)}
                  style={{
                    flexShrink: 0, border: "none", borderRadius: 12, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: activePickCat === cat ? "linear-gradient(135deg,#4f7ef7,#6ba1ff)" : "#f0f2f7",
                    color: activePickCat === cat ? "#fff" : "#777",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {groupedDrinks
              .filter(([cat]) => pickSearch.trim() !== "" || activePickCat === null || activePickCat === cat)
              .flatMap(([, list]) => list)
              .filter((d) => pickSearch.trim() === "" || d.name.toLowerCase().includes(pickSearch.toLowerCase()))
              .map((d) => (
                <button
                  key={d.id}
                  style={{ ...S.btn, width: "100%", textAlign: "left", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}
                  onClick={() => onPickFromList(d)}
                >
                  <span style={{ fontSize: 18 }}>{d.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#bbb" }}>€{d.price.toFixed(2)}</span>
                </button>
              ))}
          </div>
          <button style={{ ...S.btn, marginTop: 8 }} onClick={() => setAction(null)}>← Terug</button>
        </div>
      )}
    </div>
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
  const [mode, setMode] = useState<"create" | "join">("create")
  const [isStarting, setIsStarting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [library, setLibrary] = useState<DrinkLibraryItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  const [editingPerson, setEditingPerson] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState("")

  const [session, setSession] = useState(1)
  type CartLine = { total: number; assignments: Record<string, number> }
  const [cart, setCart] = useState<Record<string, CartLine>>({})
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
  const [expandedRound, setExpandedRound] = useState<number | null>(null)
  const [manuallyCollapsedLatest, setManuallyCollapsedLatest] = useState(false)
  const [editingRound, setEditingRound] = useState<number | null>(null)
  const [paymentEditRound, setPaymentEditRound] = useState<number | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<Record<string, string>>({})

  const [showBillPrices, setShowBillPrices] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showFairSplit, setShowFairSplit] = useState(false)
  // NEW: per-person detail expansion in fair split
  const [fairSplitExpandedPerson, setFairSplitExpandedPerson] = useState<string | null>(null)

  // ── Ordering UI state ────────────────────────────────────────────────────
  // "Hoe wil je bestellen?" — null = choice screen, "voice" or "drinks" = active mode
  type OrderMode = null | "voice" | "drinks"
  const [orderMode, setOrderMode] = useState<OrderMode>(null)
  // Show/hide the manage-drinks panel (eigen drankje toevoegen / bewerken)
  const [showManageDrinks, setShowManageDrinks] = useState(false)

  // ── Last added banner ─────────────────────────────────────────────────────
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null)

  // ── Voice state ───────────────────────────────────────────────────────────
  const [quickVoiceActive, setQuickVoiceActive] = useState(false)
  const [voiceSuggestion, setVoiceSuggestion] = useState<{ spokenText: string; qty: number; suggested: Drink } | null>(null)
  // NEW: unrecognized (no suggestion at all) voice input
  const [unrecognizedVoice, setUnrecognizedVoice] = useState<{ spokenText: string } | null>(null)
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

  // ── Cart ─────────────────────────────────────────────────────────────────
  const addToCart = (drinkId: string, delta: number, source?: "voice" | "manual") => {
    setCart((prev) => {
      const next = { ...prev }
      const line = next[drinkId] ?? { total: 0, assignments: {} }
      const newTotal = Math.max(0, line.total + delta)
      if (newTotal === 0) { delete next[drinkId]; return next }
      const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
      let newAssignments = { ...line.assignments }
      if (newTotal < assignedSum) {
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
    // Update lastAdded banner when adding (delta > 0)
    if (delta > 0 && source) {
      const drink = drinks.find((d) => d.id === drinkId)
      if (drink) {
        setLastAdded({ items: [{ name: drink.name, qty: delta, emoji: drink.emoji }], source })
      }
    }
  }

  const assignCartItem = (drinkId: string, participantId: string, delta: number) => {
    setCart((prev) => {
      const line = prev[drinkId]
      if (!line) return prev
      const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
      const currentForPerson = line.assignments[participantId] ?? 0
      if (delta > 0 && assignedSum >= line.total) return prev
      const newQty = Math.max(0, currentForPerson + delta)
      const newAssignments = { ...line.assignments }
      if (newQty === 0) delete newAssignments[participantId]
      else newAssignments[participantId] = newQty
      return { ...prev, [drinkId]: { ...line, assignments: newAssignments } }
    })
  }

  const cartTotalItems = Object.values(cart).reduce((s: number, line) => s + line.total, 0)
  const cartTotalValue = Object.entries(cart).reduce((s: number, [drinkId, line]) => {
    const d = drinks.find((dr) => dr.id === drinkId)
    return s + (d?.price ?? 0) * line.total
  }, 0)

  const clearCart = () => setCart({})

  const sessions = Array.from(new Set(orders.map((o) => o.session))).sort((a, b) => a - b)
  const nextSession = Math.max(session, ...sessions, 0) + 1

  const [finishedRoundSnapshot, setFinishedRoundSnapshot] = useState<{ session: number; cart: Record<string, CartLine> } | null>(null)

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
    setFinishedRoundSnapshot({ session: newRoundSession, cart })
    setCart({})
    setSession(newRoundSession)
    setLastAdded(null)
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
    recog.onstart = () => { setQuickVoiceActive(true); setVoiceSuggestion(null); setUnrecognizedVoice(null); setLastAdded(null) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      const { recognized, unrecognizedText, suggestion } = parseSpokenDrinks(text, drinks)

      // Add recognized items to cart
      const addedItems: { name: string; qty: number; emoji: string }[] = []
      recognized.forEach((pd) => {
        const match = fuzzyMatchDrink(pd.name, drinks)
        if (match) {
          addToCart(match.id, pd.qty)
          addedItems.push({ name: match.name, qty: pd.qty, emoji: match.emoji })
        }
      })

      if (addedItems.length > 0) {
        setLastAdded({ items: addedItems, source: "voice" })
      }

      // Handle unrecognized parts
      if (suggestion) {
        setVoiceSuggestion({ spokenText: unrecognizedText ?? text, qty: suggestion.qty, suggested: suggestion.drink })
        setUnrecognizedVoice(null)
      } else if (unrecognizedText && recognized.length === 0) {
        // Nothing at all recognized — show full unrecognized panel
        setUnrecognizedVoice({ spokenText: unrecognizedText })
        setVoiceSuggestion(null)
      } else if (unrecognizedText) {
        // Part was recognized, part wasn't — show unrecognized panel for the leftover
        setUnrecognizedVoice({ spokenText: unrecognizedText })
        setVoiceSuggestion(null)
      } else if (recognized.length === 0) {
        setToast("Niet herkend — probeer opnieuw")
      }

      setQuickVoiceActive(false)
    }
    recog.onerror = () => setQuickVoiceActive(false)
    recog.onend = () => setQuickVoiceActive(false)
    recog.start()
  }

  const stopQuickVoice = () => { quickRecogRef.current?.stop(); setQuickVoiceActive(false) }

  // ── Round editing ─────────────────────────────────────────────────────────
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
  const fairSplit = calculateFairSplit(bill.lines, bill.difference, bill.anonymousValue)
  const settledDebts = settleDebts(fairSplit)

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Start screen
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
          { id: "bill", label: "🧾 Totaal" },
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

      {/* ═══ VIEW: Setup ═══ */}
      {view === "setup" && (
        <div>
          <div style={S.card}>
            <h3 style={S.h3}>👥 Aantal personen</h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "12px 0" }}>
              <button style={{ ...S.btn, width: 44, height: 44, fontSize: 20, borderRadius: "50%" }} onClick={() => ensurePersonCount(Math.max(1, participants.length - 1))}>−</button>
              <div style={{ fontSize: 36, fontWeight: 800, minWidth: 60, textAlign: "center" }}>{participants.length}</div>
              <button style={{ ...S.btn, ...S.btnPrimary, width: 44, height: 44, fontSize: 20, borderRadius: "50%" }} onClick={() => ensurePersonCount(participants.length + 1)}>+</button>
            </div>
            <p style={{ textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 4 }}>Namen zijn optioneel — pas ze aan wanneer je wil</p>
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
                    <input autoFocus value={editingPersonName} onChange={(e) => setEditingPersonName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renamePerson(); if (e.key === "Escape") setEditingPerson(null) }} style={{ ...S.input, flex: 1 }} />
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

      {/* ═══ VIEW: Ordering ═══ */}
      {view === "ordering" && (
        <div>
          {/* ── Last added banner ── */}
          {lastAdded && (
            <LastAddedBanner lastAdded={lastAdded} onDismiss={() => setLastAdded(null)} />
          )}

          {/* ── Voice: unrecognized panel ── */}
          {unrecognizedVoice && (
            <UnrecognizedDrinkPanel
              spokenText={unrecognizedVoice.spokenText}
              suggestion={null}
              drinks={drinks}
              onAcceptSuggestion={(drink) => {
                addToCart(drink.id, 1, "voice")
                setUnrecognizedVoice(null)
              }}
              onAddCustom={async (name, price, emoji, category) => {
                await supabase.from("drinks").insert([{ name, price: parseFloat(price), emoji, category }])
                await loadDrinks()
                const updated = await supabase.from("drinks").select("*").eq("name", name).single()
                if (updated.data) addToCart(updated.data.id, 1, "voice")
                setUnrecognizedVoice(null)
                setToast(`${name} toegevoegd en besteld`)
              }}
              onPickFromList={(drink) => {
                addToCart(drink.id, 1, "voice")
                setUnrecognizedVoice(null)
              }}
              onDismiss={() => setUnrecognizedVoice(null)}
            />
          )}

          {/* ── Voice: suggestion banner (still-present legacy path for partial recognitions) ── */}
          {voiceSuggestion && !unrecognizedVoice && (
            <UnrecognizedDrinkPanel
              spokenText={voiceSuggestion.spokenText}
              suggestion={voiceSuggestion.suggested}
              drinks={drinks}
              onAcceptSuggestion={(drink) => {
                addToCart(drink.id, voiceSuggestion.qty, "voice")
                setLastAdded({ items: [{ name: drink.name, qty: voiceSuggestion.qty, emoji: drink.emoji }], source: "voice" })
                setVoiceSuggestion(null)
              }}
              onAddCustom={async (name, price, emoji, category) => {
                await supabase.from("drinks").insert([{ name, price: parseFloat(price), emoji, category }])
                await loadDrinks()
                const updated = await supabase.from("drinks").select("*").eq("name", name).single()
                if (updated.data) {
                  addToCart(updated.data.id, voiceSuggestion.qty, "voice")
                  setLastAdded({ items: [{ name: updated.data.name, qty: voiceSuggestion.qty, emoji: updated.data.emoji }], source: "voice" })
                }
                setVoiceSuggestion(null)
                setToast(`${name} toegevoegd en besteld`)
              }}
              onPickFromList={(drink) => {
                addToCart(drink.id, voiceSuggestion.qty, "voice")
                setLastAdded({ items: [{ name: drink.name, qty: voiceSuggestion.qty, emoji: drink.emoji }], source: "voice" })
                setVoiceSuggestion(null)
              }}
              onDismiss={() => setVoiceSuggestion(null)}
            />
          )}

          {/* ── "Hoe wil je bestellen?" — choice screen ── */}
          {orderMode === null && (
            <div style={S.card}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Hoe wil je bestellen?</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {/* Voice button */}
                <button
                  onClick={() => { setOrderMode("voice"); startQuickVoice() }}
                  style={{
                    flex: 1, border: "none", borderRadius: 16, padding: "18px 12px", cursor: "pointer",
                    background: "linear-gradient(135deg,#4f7ef7,#6ba1ff)",
                    color: "#fff",
                    boxShadow: "0 6px 18px rgba(79,126,247,0.3)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ fontSize: 28 }}>🎤</span>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>Spreek je bestelling in</span>
                </button>

                {/* Drinks picker button */}
                <button
                  onClick={() => setOrderMode("drinks")}
                  style={{
                    flex: 1, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "18px 12px", cursor: "pointer",
                    background: "#fff",
                    color: "#333",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ fontSize: 28 }}>🍹</span>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>Kies uit dranken</span>
                  <span style={{ fontSize: 10, color: "#aaa" }}>eigen drankje toevoegen</span>
                </button>
              </div>

              {/* If cart already has items, show mini summary so they don't lose context */}
              {cartTotalItems > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#888" }}>In je mandje: {cartTotalItems} item{cartTotalItems !== 1 ? "s" : ""}</span>
                  <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 12, padding: "6px 14px" }} onClick={finishRound}>✅ Bestelling klaar</button>
                </div>
              )}
            </div>
          )}

          {/* ── Voice mode active ── */}
          {orderMode === "voice" && (
            <div style={{ ...S.card, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>🎤 Spraakbestelling</span>
                <button style={{ ...S.btn, fontSize: 12 }} onClick={() => { stopQuickVoice(); setOrderMode(null) }}>← Terug</button>
              </div>
              <button
                onClick={quickVoiceActive ? stopQuickVoice : startQuickVoice}
                style={{
                  ...S.btn, width: "100%", padding: "16px 0", fontSize: 15, fontWeight: 700, border: "none",
                  background: quickVoiceActive ? "#e74c3c" : "linear-gradient(135deg,#4f7ef7,#6ba1ff)",
                  color: "#fff",
                  animation: quickVoiceActive ? "pulse 1.2s infinite" : "none",
                  boxShadow: quickVoiceActive ? "0 0 0 5px rgba(231,76,60,0.18)" : "0 6px 18px rgba(79,126,247,0.3)",
                  borderRadius: 14,
                }}
              >
                {quickVoiceActive ? "🔴 Luistert... (tik om te stoppen)" : "🎤 Opnieuw inspreken"}
              </button>
              <p style={{ fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 8 }}>
                Zeg bv. &ldquo;twee pils en een cola&rdquo;
              </p>
            </div>
          )}

          {/* ── Drinks picker mode ── */}
          {orderMode === "drinks" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>🍹 Kies je drankjes</span>
                <button style={{ ...S.btn, fontSize: 12 }} onClick={() => setOrderMode(null)}>← Terug</button>
              </div>

              {/* Subtle price toggle */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                <button onClick={() => setShowPrices((v) => !v)} style={{ background: "none", border: "none", color: "#bbb", fontSize: 11, cursor: "pointer", padding: "2px 6px", textDecoration: "underline" }}>
                  {showPrices ? "richtprijzen verbergen" : "richtprijzen tonen"}
                </button>
              </div>

              {/* Category tabs */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 4 }}>
                {groupedDrinks.map(([cat]) => {
                  const isActive = activeCategory === cat || (activeCategory === null && cat === groupedDrinks[0]?.[0])
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        flexShrink: 0, border: "none", borderRadius: 14, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                        background: isActive ? "linear-gradient(135deg,#4f7ef7,#6ba1ff)" : "#fff",
                        color: isActive ? "#fff" : "#777",
                        boxShadow: isActive ? "0 4px 14px rgba(79,126,247,0.3)" : "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>

              {/* Drinks grid for active category */}
              {groupedDrinks.map(([cat, list]) => {
                const isActive = activeCategory === cat || (activeCategory === null && cat === groupedDrinks[0]?.[0])
                if (!isActive) return null
                return (
                  <div key={cat} style={S.card}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {list.map((d) => {
                        const line = cart[d.id]
                        const qty = line?.total ?? 0
                        return (
                          <div
                            key={d.id}
                            style={{
                              background: qty > 0 ? "rgba(79,126,247,0.08)" : "#fafbff",
                              border: qty > 0 ? "1.5px solid rgba(79,126,247,0.35)" : "1px solid rgba(0,0,0,0.06)",
                              borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 20 }}>{d.emoji}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{d.name}</span>
                              {showPrices && <span style={{ fontSize: 10, color: "#bbb" }}>≈ €{d.price.toFixed(2)}</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15 }} onClick={() => addToCart(d.id, -1)}>−</button>
                              <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{qty}</span>
                              <button
                                style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15, background: "rgba(79,126,247,0.12)" }}
                                onClick={() => addToCart(d.id, 1, "manual")}
                              >+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Manage drinks — collapsed by default, opened via subtekst link */}
              <div style={S.card}>
                <button
                  onClick={() => setShowManageDrinks((v) => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#888" }}>🍹 Eigen drankje toevoegen / bewerken</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button style={{ ...S.btn, fontSize: 11, padding: "2px 8px" }} onClick={(e) => { e.stopPropagation(); setShowLibraryPicker(true) }}>📚 Bibliotheek</button>
                    <span style={{ fontSize: 12, color: "#aaa", transform: showManageDrinks ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
                  </div>
                </button>

                {showManageDrinks && (
                  <div style={{ marginTop: 12 }}>
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
                )}
              </div>
            </div>
          )}

          {/* Cart summary — always visible when items exist */}
          {cartTotalItems > 0 && orderMode === "drinks" && (
            <div style={{ ...S.card, padding: 10 }}>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>In je mandje</div>
              {Object.entries(cart).map(([drinkId, line]) => {
                const d = drinks.find((dr) => dr.id === drinkId)
                if (!d || line.total === 0) return null
                const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
                const unassigned = line.total - assignedSum
                return (
                  <div key={drinkId} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{d.emoji} {d.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13 }} onClick={() => addToCart(d.id, -1)}>−</button>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{line.total}</span>
                        <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13, background: "rgba(79,126,247,0.12)" }} onClick={() => addToCart(d.id, 1, "manual")}>+</button>
                      </div>
                    </div>
                    {participants.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "#aaa" }}>wie?</span>
                          <span style={{ fontSize: 10, color: unassigned > 0 ? "#e67e22" : "#27ae60", fontWeight: 600 }}>{assignedSum}/{line.total} toegewezen</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
                          {participants.map((p) => {
                            const pQty = line.assignments[p.id] ?? 0
                            return (
                              <div key={p.id} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, background: pQty > 0 ? "rgba(79,126,247,0.12)" : "rgba(0,0,0,0.035)", border: pQty > 0 ? "1px solid rgba(79,126,247,0.35)" : "1px solid rgba(0,0,0,0.06)", borderRadius: 20, padding: "3px 4px 3px 10px" }}>
                                <span style={{ fontSize: 11, fontWeight: pQty > 0 ? 700 : 500, color: pQty > 0 ? "#4f7ef7" : "#888", whiteSpace: "nowrap" }}>{p.name}</span>
                                <button style={{ ...S.iconBtn, width: 18, height: 18, fontSize: 10 }} onClick={() => assignCartItem(d.id, p.id, -1)}>−</button>
                                <span style={{ fontSize: 11, fontWeight: 800, minWidth: 12, textAlign: "center", color: pQty > 0 ? "#4f7ef7" : "#ccc" }}>{pQty}</span>
                                <button style={{ ...S.iconBtn, width: 18, height: 18, fontSize: 10 }} onClick={() => assignCartItem(d.id, p.id, 1)}>+</button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

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

      {/* ═══ VIEW: Rounds ═══ */}
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
            const latestSession = sessions[sessions.length - 1]
            const isLatest = s === latestSession
            const isOpen = expandedRound === s || (expandedRound === null && isLatest && !manuallyCollapsedLatest)

            const toggleOpen = () => {
              if (isOpen) {
                setExpandedRound(null)
                if (isLatest) setManuallyCollapsedLatest(true)
              } else {
                setExpandedRound(s)
                if (isLatest) setManuallyCollapsedLatest(false)
              }
            }

            return (
              <div key={s} style={S.card}>
                <div onClick={toggleOpen} style={{ display
