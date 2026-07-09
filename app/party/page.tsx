
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useLang, LanguageToggle } from "@/lib/i18n"

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
  group_id?: string | null // null = standaard basisdrank (voor iedereen); gezet = eigen drank/aanpassing van die groep
  owner_id?: string | null // gezet = eigen drank van die gebruiker (privé, zichtbaar in al zijn groepen)
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

// Verwijdert een datum-achtervoegsel "(— )" achteraan een groepsnaam, voor naam-vergelijking
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

// Personen in logische volgorde: created_at (indien aanwezig & verschillend) ? nummer in naam ? id
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
  created_at?: string  // gebruikt om pot-inleg te groeperen per "pot" (eerste, tweede, —)
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
  BierAV:    "🌿 Alcoholvrij bier",
  Frisdrank: "🥤 Frisdrank & Water",
  Wijn:      "🍷 Wijn & Bubbels",
  Warm:      "☕ Warme dranken",
  Cocktail:  "🍸 Cocktails",
  Longdrink: "🥃 Longdrinks & Mixen",
  Shot:      "🔥 Shots",
  Mocktail:  "🍹 Mocktails",
  Eigen:     "⭐ Eigen drankjes",
}
const FALLBACK_CATEGORY = "Eigen"
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  BierAV:    ["0.0", "0%", "alcoholvrij", "sportzot", "cero"],
  Mocktail:  ["mocktail", "virgin", "gimber"],
  Wijn:      ["wijn", "cava", "prosecco", "champagne", "bubbels", "rosé", "rose", "chardonnay", "pinot", "sauvignon", "merlot", "cabernet", "huiswijn"],
  Warm:      ["koffie", "cappuccino", "espresso", "latte", "thee", "chocomelk", "chocolademelk", "chai", "flat white", "decafé", "decafe"],
  Frisdrank: ["cola", "fanta", "sprite", "water", "ice tea", "icetea", "limonade", "tonic", "soda", "juice", "sap", "frisdrank", "appelsap", "sinaas", "spa", "red bull", "schweppes"],
  Cocktail:  ["cocktail", "mojito", "aperol", "spritz", "martini", "margarita", "daiquiri", "cosmopolitan", "negroni", "colada", "moscow mule", "pornstar", "sex on the beach", "hugo", "gin tonic"],
  Longdrink: ["vodka", "rum cola", "whisky cola", "jäger", "jager", "orange", "malibu", "bacardi", "safari", "pisang", "cuba libre", "longdrink"],
  Shot:      ["shot", "shotje", "tequila", "limoncello", "sourz", "fireball", "sambuca"],
  Bier:      ["bier", "pils", "pintje", "tripel", "dubbel", "blond", "bruin", "lager", "ale", "ipa", "stout", "weizen", "geuze", "lambic", "kriek", "duvel", "leffe", "chouffe", "cornet", "westmalle", "chimay", "karmeliet", "hoegaarden", "vedett"],
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
function normText(s: string): string { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }

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
  // Medium score (0.4—0.7) = only a suggestion, don't auto-add.
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
  drinkValue: number   // sum of (richtprijs — qty) for everything this person drank
  paid: number         // sum of payments this person made (pot-inleg + eigen rondes)
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

// Verdeling van de fair split. 0 = volledig volgens de waarde van wat elk dronk (zuiver proportioneel).
const FAIR_EQUAL_WEIGHT = 0

// Geldhelpers: intern rekenen in hele centen zodat er geen cent-afwijkingen ontstaan
// door floating point (bv. 0.1 + 0.2). We ronden pas op het laatste moment af.
const toCents = (euro: number): number => Math.round((euro + Number.EPSILON) * 100)
const round2 = (euro: number): number => toCents(euro) / 100

// Verdeelt de ÉCHT betaalde drankkost (splitBase = totalActuallySpent) over de mensen.
//  - mode "fair"  : proportioneel volgens wat elk dronk. Wie niets dronk draagt €0.
//  - mode "equal" : het totaalbedrag gelijk over ALLE personen.
// De pot blijft hier volledig buiten: die is voorschot en wordt apart verrekend
// (het onbenutte deel komt terug via settleDebts met de virtuele "de pot").
type FairSplitRow = { participantId: string; name: string; fairShare: number; paid: number; balance: number; participated: boolean }

function calculateFairSplit(
  lines: PersonBillLine[],
  splitBase: number, // = totalActuallySpent (echt betaalde rondes)
  anonymousValue: number, // total richtprijs-value of orders that were never assigned to anyone
  mode: "fair" | "equal" = "fair",
  equalWeight = FAIR_EQUAL_WEIGHT
): FairSplitRow[] {
  void anonymousValue
  const n = lines.length
  if (n === 0) return []

  const assignedTotal = lines.reduce((s, l) => s + l.drinkValue, 0) // som van toegewezen richtprijzen
  const nDrinkers = lines.filter((l) => l.drinkValue > 0).length
  const participatingCount = lines.filter((l) => l.drinkValue > 0 || l.paid > 0).length || n

  return lines.map((l) => {
    // MODE "EQUAL": iedereen (elke persoon in de groep) draagt een gelijk deel van de drankkost.
    if (mode === "equal") {
      const fairShare = splitBase > 0 ? round2(splitBase / n) : 0
      return { participantId: l.participantId, name: l.name, fairShare, paid: l.paid, balance: round2(l.paid - fairShare), participated: true }
    }

    // MODE "FAIR"
    const participated = l.drinkValue > 0 || l.paid > 0
    if (!participated) {
      return { participantId: l.participantId, name: l.name, fairShare: 0, paid: l.paid, balance: l.paid, participated: false }
    }

    let fairShare = 0
    if (splitBase > 0) {
      if (nDrinkers === 0 || assignedTotal <= 0) {
        // Niemand kreeg iets toegewezen ? gelijk over wie meedeed
        fairShare = splitBase / participatingCount
      } else if (l.drinkValue > 0) {
        const gelijkDeel = (splitBase * equalWeight) / nDrinkers
        const waardeDeel = splitBase * (1 - equalWeight) * (l.drinkValue / assignedTotal)
        fairShare = gelijkDeel + waardeDeel
      } else {
        // Wel betaald / ingelegd maar niets gedronken ? geen drankkost (inleg komt volledig terug)
        fairShare = 0
      }
    }
    if (fairShare < 0) fairShare = 0
    fairShare = round2(fairShare)

    const balance = round2(l.paid - fairShare) // positive = should get money back, negative = still owes
    return { participantId: l.participantId, name: l.name, fairShare, paid: l.paid, balance, participated: true }
  })
}

// Debt settlement: turn balances into concrete "X pays Y €amount" transactions.
// People with balance < 0 (owe money) pay people with balance > 0 (should receive), minimizing transaction count.
// potBalance = totalActuallySpent - totalPaid: een virtuele "de pot" die het overschot
// teruggeeft (potBalance < 0 ? pot is schuldenaar) of het tekort int (potBalance > 0 ? pot is schuldeiser).
function settleDebts(
  fairSplit: { participantId: string; name: string; balance: number; participated: boolean }[],
  potBalance = 0
): { from: string; to: string; amount: number }[] {
  // Alles in hele centen zodat er geen cent-restjes overblijven.
  const all = fairSplit.map((f) => ({ name: f.name, participated: f.participated, cents: toCents(f.balance) }))
  const potCents = toCents(potBalance)
  if (Math.abs(potCents) > 0) {
    all.push({ name: "de pot", participated: true, cents: potCents })
  }
  let creditors = all.filter((f) => f.participated && f.cents > 0).map((f) => ({ ...f, inDeg: 0 }))
  let debtors = all.filter((f) => f.participated && f.cents < 0).map((f) => ({ ...f, cents: -f.cents }))

  const transactions: { from: string; to: string; amount: number }[] = []

  // 1) Exacte matches eerst: wie precies evenveel te geven heeft als iemand te krijgen heeft,
  //    wordt in één rechtstreekse betaling gekoppeld. Zo zo weinig mogelijk betalingen.
  let matched = true
  while (matched) {
    matched = false
    for (const d of debtors) {
      if (d.cents <= 0) continue
      const c = creditors.find((c) => c.cents === d.cents)
      if (c) {
        transactions.push({ from: d.name, to: c.name, amount: d.cents / 100 })
        c.cents = 0
        d.cents = 0
        matched = true
      }
    }
    creditors = creditors.filter((c) => c.cents > 0)
    debtors = debtors.filter((d) => d.cents > 0)
  }

  // 2) De rest: elke schuldenaar in zo weinig mogelijk betalingen afhandelen (liefst 1).
  //    We zoeken eerst de kleinste schuldeiser die zijn HELE schuld kan opvangen -> 1 betaling.
  //    Lukt dat niet, dan betaalt hij de grootste schuldeiser en splitst pas als het echt
  //    niet anders kan. Van meerdere ontvangen mag; niemand betaalt liefst meer dan 1-2 keer.
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => b.cents - a.cents)
    const d = debtors[0]
    // Voorkeur bij het kiezen van een ontvanger:
    //  1) iemand die nog van NIEMAND geld krijgt (inDeg 0) en de hele schuld in één keer kan opvangen,
    //  2) idem maar iemand die al van 1 iemand krijgt (inDeg 1),
    //  3) anders de grootste ontvanger met inDeg 0, dan met inDeg 1 (deels betalen),
    //  4) en enkel als het echt niet anders kan, een ontvanger die al 2+ betalers heeft.
    // Zo betaalt iedereen liefst aan 1 iemand en ontvangt iedereen liefst van 1, hoogstens 2.
    const pick = () => {
      for (const deg of [0, 1]) {
        const full = creditors.filter((x) => x.inDeg === deg && x.cents >= d.cents).sort((a, b) => a.cents - b.cents)
        if (full.length > 0) return full[0]
      }
      for (const deg of [0, 1]) {
        const part = creditors.filter((x) => x.inDeg === deg).sort((a, b) => b.cents - a.cents)
        if (part.length > 0) return part[0]
      }
      return [...creditors].sort((a, b) => b.cents - a.cents)[0]
    }
    const c = pick()
    const amountCents = Math.min(d.cents, c.cents)
    transactions.push({ from: d.name, to: c.name, amount: amountCents / 100 })
    c.inDeg++
    d.cents -= amountCents
    c.cents -= amountCents
    creditors = creditors.filter((c) => c.cents > 0)
    debtors = debtors.filter((d) => d.cents > 0)
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

// Rundo-logo — exact hetzelfde symbool als bij Rundo Table (ingebed als afbeelding)
const RUNDO_LOGO_SRC = "data:image/png;base64,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"
function RundoLogo({ size = 64 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={RUNDO_LOGO_SRC} alt="Rundo" width={size} height={size} style={{ display: "block", objectFit: "contain", flexShrink: 0 }} />
}

// Klinkende glazen ("cheers") — getekend icoontje voor de Party-ondertitel
function CheersIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      {/* sprankel bovenaan */}
      <g stroke="#f0a500" strokeWidth="3" strokeLinecap="round">
        <line x1="32" y1="3" x2="32" y2="11" />
        <line x1="27.5" y1="6.5" x2="36.5" y2="6.5" />
      </g>
      {/* linkerglas, helt naar rechts (naar het midden) */}
      <g transform="rotate(16 22 42)">
        <path d="M13 16 H31 L27 30 Q22 34 17 30 Z" fill="#f4c430" stroke="#4a3f1e" strokeWidth="3" strokeLinejoin="round" />
        <line x1="22" y1="31" x2="22" y2="52" stroke="#4a3f1e" strokeWidth="3" strokeLinecap="round" />
        <line x1="14" y1="53" x2="30" y2="53" stroke="#4a3f1e" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* rechterglas, helt naar links (naar het midden) */}
      <g transform="rotate(-16 42 42)">
        <path d="M33 16 H51 L47 30 Q42 34 37 30 Z" fill="#f4c430" stroke="#4a3f1e" strokeWidth="3" strokeLinejoin="round" />
        <line x1="42" y1="31" x2="42" y2="52" stroke="#4a3f1e" strokeWidth="3" strokeLinecap="round" />
        <line x1="34" y1="53" x2="50" y2="53" stroke="#4a3f1e" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const STRINGS = {
  nl: {
    appTagline: "Rondjes en splitten zonder gedoe!",
    aboutBtnTitle: "Wat is Rundo Party?",
    groupNamePlaceholder: "Groepsnaam",
    loading: "Laden...",
    startBtn: "Starten",
    savedGroups: "Opgeslagen groepen",
    person: "persoon",
    people: "personen",
    potLay: "Leg een pot",
    potContributed: (v: string) => `€${v} ingelegd — `,
    potRemaining: (v: string) => `€${v} nog in pot`,
    tabGroup: "Groep",
    tabGroupPot: "Groep + Pot",
    tabOrder: "Nieuwe bestelling",
    tabRounds: (n: number) => `Overzicht Rondjes${n > 0 ? ` (${n})` : ""}`,
    tabBill: "Afrekenen",
    tabLockToast: "Voeg eerst minstens één persoon toe bij Groep.",
    errCreateGroup: (m: string) => "Groep aanmaken mislukt: " + m,
    errGroupNotFound: "Groep niet gevonden. Controleer de code.",
    setupCountTitle: "👥 Aantal personen",
    setupNamesOptional: "Namen zijn optioneel — pas ze aan wanneer je wil",
    setupPersonsTitle: "Personen",
    setupTapToRename: "tik op een naam om te hernoemen",
    setupAddName: "+ Naam toevoegen",
    setupNoPersons: "Nog geen personen",
    personLabel: (n: number) => `Persoon ${n}`,
    personShort: (n: number) => `Pers. ${n}`,
    potPlacedBtn: (v: string) => `🫙 Pot gelegd — €${v}`,
    potLayFirst: "🫙 Leg eerst een pot",
    startOrderingBtn: "🍻 Start bestellen →",
    addPersonNamePlaceholder: "Naam (optioneel)...",
    add: "Toevoegen",
    cancel: "Annuleer",
    cancelN: "Annuleren",
    confirmYes: "Ja",
    saveBtn: "💾 Opslaan",
    perPersonAbbr: "p.p.",
    potAddPersonsFirst: "Voeg eerst personen toe",
    potAmountPlaceholder: "bedrag",
    potName: (i: number) => (["Eerste pot", "Tweede pot", "Derde pot", "Vierde pot", "Vijfde pot", "Zesde pot"][i] ?? `Pot ${i + 1}`),
    potOverviewTitle: "🫙 De pot",
    potOverviewSub: "Overzicht per pot en wie wat bijlegde.",
    potStatContributed: "ingelegd",
    potStatUsed: "gebruikt",
    potStatAvailable: "nog beschikbaar",
    potNoContributions: "Nog geen inleg.",
    potGeneral: "Algemeen",
    potTopUp: "🫙 Pot aanvullen",
    potPerPersonToggle: "Of vul per persoon een eigen bedrag in",
    potTotalAdd: "Totaal toevoegen",
    potAddWarnMsg: "Vul eerst een bedrag in — als p.p. of per persoon.",
    potModalSub: "Iedereen legt vooraf wat in de pot. Je kan het per persoon corrigeren als iemand niet meelegt.",
    potTotalInPot: "Totaal in pot",
    potWarnPre: "Vul eerst een bedrag in voor minstens één persoon, of kies ",
    roundLabelPre: "Rondje",
    currentOrderTitle: "Je huidige bestelling",
    repeatPrevRoundBtn: "🔄 Vorig rondje opnieuw",
    selectDrinksBtn: "🍹 Selecteer drankje(s)",
    andOr: "EN/OF",
    voiceListening: "🎤 Luistert...",
    voiceSpeakOrder: "🎙️ Spreek je bestelling in",
    voiceHowLink: "ⓘ Hoe werkt inspreken?",
    emptyOrder1: "Nog geen drankjes gekozen — selecteer ze hierboven 👆",
    emptyOrderN: "Nog geen drankjes in dit rondje — selecteer ze hierboven 👆",
    toRoundsLink: "Overzicht Rondjes →",
    toBillLink: "Afrekenen →",
    voiceSuggestPre: "Niet helemaal verstaan — bedoelde je ",
    confirmNo: "Nee",
    lastAddedTitle: "🆕 Laatst toegevoegd",
    assignAllLater: "alles later toewijzen",
    allOrdersInRound: "📋 Alle bestellingen in rondje ",
    clearAll: "wis alles",
    editOrderBtn: "✏️ Bestelling wijzigen",
    finishOrderBtn: (n: number) => `✅ Bestelling afronden — ${n} item${n !== 1 ? "s" : ""}`,
    reorderTitle: "🔄 Begin met een vorig rondje",
    reorderExact: "exact opnieuw",
    reorderAdjust: "licht aan te passen",
    reorderSubA: "Bestel een vorig rondje ",
    reorderSubB: ", of neem het over om het ",
    prevBadge: "vorige",
    drink: "drankje",
    drinks: "drankjes",
    reorderExactBtn: "Exact opnieuw",
    adjustBtn: "✏️ Aanpassen",
    reorderShowPrev: "▴ Toon enkel het vorige rondje",
    reorderShowOlder: (n: number) => `▾ Toon ${n} ouder${n === 1 ? "" : "e"} rondje${n === 1 ? "" : "s"}`,
    finishConfirmTitle: "Bestelling afronden?",
    finishConfirmSub: (items: number, persons: string) => `In totaal heb je ${items} item${items !== 1 ? "s" : ""} voor ${persons}. Overzicht:`,
    orderAdjustBtn: "Bestelling aanpassen",
    finishAnyway: "Toch afronden",
    finishYes: "✅ Ja, afronden",
    unassignedWarnB: " nog toe te wijzen. Voeg ze nu toe voor een eerlijke ",
    unassignedWarnC: ". Hoe? Via de knop ",
    unassignedWarnD: " hieronder.",
    persAbbr: "pers.",
    searchPlaceholder: "Zoek… bv. cola, jäger, virgin",
    customReady1: " staat nu klaar onder ",
    customReady2: " — tik het aan om toe te voegen.",
    noDrinkFound: "Geen drankje gevonden — voeg het onderaan toe als eigen drankje.",
    readyBtn: (n: number, over: number) => n === 0 ? "Klaar" : `Klaar? ${n} ${n !== 1 ? "drankjes" : "drankje"}${over > 0 ? ` (${over} meer dan groep)` : ""}`,
    addOwnDrinkBtn: "⭐ Eigen drankje toevoegen",
    manageOwnDrinks: "✏️ Mijn eigen drankjes beheren",
    selectorEmptyToast: "Nog geen drankje geselecteerd — tik er eentje aan 👆",
    asleepBanner: "⏸ Live-updates gepauzeerd — tik om te hervatten",
    toHomeTitle: "Naar startscherm",
    editDrinksTitle: "⭐ Je eigen drankjes",
    editDrinksSub: "Hier beheer je enkel je eigen toegevoegde drankjes. De standaardlijst met richtprijzen staat vast.",
    noOwnDrinks: "Je hebt nog geen eigen drankjes toegevoegd.",
    deleteOwnDrinkTitle: "Eigen drankje verwijderen",
    closeBtn: "Sluiten",
    addDrinkTitle: "➕ Eigen drank toevoegen",
    addDrinkSub: "Naam en richtprijs volstaan. Je drankje komt onder ⭐ Eigen drankjes zodat je ziet dat je het zelf toevoegde.",
    nameLabel: "Naam",
    drinkNamePlaceholder: "bv. een speciaalbiertje",
    priceLabel: "Richtprijs (€)",
    addPersonTitle: "Persoon toevoegen",
    warnNameFirst: "Vul eerst een naam in voor je drankje.",
    warnPriceRequired: "Een richtprijs is verplicht — die hebben we nodig om de rekening achteraf eerlijk te verdelen met Fair Split.",
  },
  fr: {
    appTagline: "Des tournées et un partage sans prise de tête !",
    aboutBtnTitle: "Qu'est-ce que Rundo Party ?",
    groupNamePlaceholder: "Nom du groupe",
    loading: "Chargement...",
    startBtn: "Démarrer",
    savedGroups: "Groupes sauvegardés",
    person: "personne",
    people: "personnes",
    potLay: "Créer une cagnotte",
    potContributed: (v: string) => `€${v} déposés — `,
    potRemaining: (v: string) => `€${v} encore en cagnotte`,
    tabGroup: "Groupe",
    tabGroupPot: "Groupe + Cagnotte",
    tabOrder: "Nouvelle commande",
    tabRounds: (n: number) => `Aperçu des tournées${n > 0 ? ` (${n})` : ""}`,
    tabBill: "Régler",
    tabLockToast: "Ajoute d'abord au moins une personne dans Groupe.",
    errCreateGroup: (m: string) => "Échec de la création du groupe : " + m,
    errGroupNotFound: "Groupe introuvable. Vérifie le code.",
    setupCountTitle: "👥 Nombre de personnes",
    setupNamesOptional: "Les noms sont facultatifs — modifie-les quand tu veux",
    setupPersonsTitle: "Personnes",
    setupTapToRename: "touche un nom pour le renommer",
    setupAddName: "+ Ajouter un nom",
    setupNoPersons: "Encore aucune personne",
    personLabel: (n: number) => `Personne ${n}`,
    personShort: (n: number) => `Pers. ${n}`,
    potPlacedBtn: (v: string) => `🫙 Cagnotte créée — €${v}`,
    potLayFirst: "🫙 Crée d'abord une cagnotte",
    startOrderingBtn: "🍻 Commencer à commander →",
    addPersonNamePlaceholder: "Nom (facultatif)...",
    add: "Ajouter",
    cancel: "Annuler",
    cancelN: "Annuler",
    confirmYes: "Oui",
    saveBtn: "💾 Enregistrer",
    perPersonAbbr: "p.p.",
    potAddPersonsFirst: "Ajoute d'abord des personnes",
    potAmountPlaceholder: "montant",
    potName: (i: number) => (["Première cagnotte", "Deuxième cagnotte", "Troisième cagnotte", "Quatrième cagnotte", "Cinquième cagnotte", "Sixième cagnotte"][i] ?? `Cagnotte ${i + 1}`),
    potOverviewTitle: "🫙 La cagnotte",
    potOverviewSub: "Aperçu par cagnotte et qui a mis quoi.",
    potStatContributed: "déposé",
    potStatUsed: "utilisé",
    potStatAvailable: "encore dispo",
    potNoContributions: "Encore aucun dépôt.",
    potGeneral: "Général",
    potTopUp: "🫙 Compléter la cagnotte",
    potPerPersonToggle: "Ou saisis un montant par personne",
    potTotalAdd: "Total à ajouter",
    potAddWarnMsg: "Saisis d'abord un montant — en p.p. ou par personne.",
    potModalSub: "Chacun met un peu dans la cagnotte à l'avance. Tu peux corriger par personne si quelqu'un ne participe pas.",
    potTotalInPot: "Total en cagnotte",
    potWarnPre: "Saisis d'abord un montant pour au moins une personne, ou choisis ",
    roundLabelPre: "Tournée",
    currentOrderTitle: "Ta commande en cours",
    repeatPrevRoundBtn: "🔄 Refaire la tournée précédente",
    selectDrinksBtn: "🍹 Sélectionne des boissons",
    andOr: "ET/OU",
    voiceListening: "🎤 J'écoute...",
    voiceSpeakOrder: "🎙️ Dicte ta commande",
    voiceHowLink: "ⓘ Comment fonctionne la dictée ?",
    emptyOrder1: "Encore aucune boisson choisie — sélectionne-les ci-dessus 👆",
    emptyOrderN: "Encore aucune boisson dans cette tournée — sélectionne-les ci-dessus 👆",
    toRoundsLink: "Aperçu des tournées →",
    toBillLink: "Régler →",
    voiceSuggestPre: "Pas tout compris — voulais-tu dire ",
    confirmNo: "Non",
    lastAddedTitle: "🆕 Ajouté en dernier",
    assignAllLater: "tout attribuer plus tard",
    allOrdersInRound: "📋 Toutes les commandes de la tournée ",
    clearAll: "tout effacer",
    editOrderBtn: "✏️ Modifier la commande",
    finishOrderBtn: (n: number) => `✅ Finaliser la commande — ${n} article${n !== 1 ? "s" : ""}`,
    reorderTitle: "🔄 Repars d'une tournée précédente",
    reorderExact: "à l'identique",
    reorderAdjust: "l'ajuster légèrement",
    reorderSubA: "Recommande une tournée précédente ",
    reorderSubB: ", ou reprends-la pour ",
    prevBadge: "précédente",
    drink: "boisson",
    drinks: "boissons",
    reorderExactBtn: "À l'identique",
    adjustBtn: "✏️ Ajuster",
    reorderShowPrev: "▴ Afficher seulement la tournée précédente",
    reorderShowOlder: (n: number) => `▾ Afficher ${n} tournée${n === 1 ? "" : "s"} plus ancienne${n === 1 ? "" : "s"}`,
    finishConfirmTitle: "Finaliser la commande ?",
    finishConfirmSub: (items: number, persons: string) => `Au total tu as ${items} article${items !== 1 ? "s" : ""} pour ${persons}. Aperçu :`,
    orderAdjustBtn: "Ajuster la commande",
    finishAnyway: "Finaliser quand même",
    finishYes: "✅ Oui, finaliser",
    unassignedWarnB: " encore à attribuer. Ajoute-les maintenant pour un juste ",
    unassignedWarnC: ". Comment ? Via le bouton ",
    unassignedWarnD: " ci-dessous.",
    persAbbr: "pers.",
    searchPlaceholder: "Cherche… ex. cola, jäger, virgin",
    customReady1: " est maintenant prêt dans ",
    customReady2: " — touche-le pour l'ajouter.",
    noDrinkFound: "Aucune boisson trouvée — ajoute-la ci-dessous comme boisson perso.",
    readyBtn: (n: number, over: number) => n === 0 ? "Prêt" : `Prêt ? ${n} ${n !== 1 ? "boissons" : "boisson"}${over > 0 ? ` (${over} de plus que le groupe)` : ""}`,
    addOwnDrinkBtn: "⭐ Ajouter une boisson perso",
    manageOwnDrinks: "✏️ Gérer mes boissons perso",
    selectorEmptyToast: "Aucune boisson sélectionnée — touches-en une 👆",
    asleepBanner: "⏸ Mises à jour en direct en pause — touche pour reprendre",
    toHomeTitle: "Vers l'écran d'accueil",
    editDrinksTitle: "⭐ Tes boissons perso",
    editDrinksSub: "Ici tu gères uniquement les boissons que tu as ajoutées. La liste standard avec les prix indicatifs est fixe.",
    noOwnDrinks: "Tu n'as encore ajouté aucune boisson perso.",
    deleteOwnDrinkTitle: "Supprimer la boisson perso",
    closeBtn: "Fermer",
    addDrinkTitle: "➕ Ajouter une boisson perso",
    addDrinkSub: "Le nom et le prix indicatif suffisent. Ta boisson apparaît sous ⭐ Boissons perso pour que tu voies que tu l'as ajoutée toi-même.",
    nameLabel: "Nom",
    drinkNamePlaceholder: "ex. une bière spéciale",
    priceLabel: "Prix indicatif (€)",
    addPersonTitle: "Ajouter une personne",
    warnNameFirst: "Saisis d'abord un nom pour ta boisson.",
    warnPriceRequired: "Un prix indicatif est obligatoire — on en a besoin pour partager l'addition équitablement avec Fair Split.",
  },
}

export default function Home() {
  const [lang] = useLang()
  const L = STRINGS[lang]
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const lastActive = useRef(Date.now())

  // Sluit het mobiele toetsenbord zodra je buiten een invoerveld tikt (op een knop of lege ruimte),
  // zodat het niet overbodig open blijft staan en je de app beter ziet.
  useEffect(() => {
    const isField = (el: EventTarget | null) => {
      const n = el as HTMLElement | null
      return !!n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.tagName === "SELECT" || n.isContentEditable)
    }
    const onPointerDown = (e: PointerEvent) => {
      const active = document.activeElement as HTMLElement | null
      if (!isField(active)) return
      const target = e.target as HTMLElement | null
      if (isField(target) || (target && target.closest && target.closest("input,textarea,select,[contenteditable=true]"))) return
      active?.blur()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  // ─── App flow state ────────────
  const [view, setView] = useState<AppView>("setup")
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedSearch, setSavedSearch] = useState("")

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
  const [lastAddedViaVoice, setLastAddedViaVoice] = useState(false) // "Laatst toegevoegd"-kaart enkel tonen na spraak
  const [openAssignFor, setOpenAssignFor] = useState<string | null>(null) // welk drankje in "Alle bestellingen" zijn toewijs-dropdown open heeft
  const [openBillAssignFor, setOpenBillAssignFor] = useState<string | null>(null) // welk drankje in het afrekenscherm zijn toewijs-dropdown open heeft
  const [billOriginallyUnassigned, setBillOriginallyUnassigned] = useState<Set<string>>(new Set()) // drankjes die bij het openen van 'afrekenen' nog toe te wijzen waren (krijgen nadien een potloodje)
  const [showPrices, setShowPrices] = useState(false)

  const [showAddPerson, setShowAddPerson] = useState(false)
  const [showEditDrinks, setShowEditDrinks] = useState(false)   // modal: namen/prijzen van bestaande dranken bewerken
  const [showAddDrink, setShowAddDrink] = useState(false)       // modal: eigen drank toevoegen
  const [showDrinkSelector, setShowDrinkSelector] = useState(false) // modal: drankje selecteren (categorie + grid)
  const [selectorDraft, setSelectorDraft] = useState<Record<string, number>>({}) // selector start telkens op 0; wordt bij "Klaar" toegevoegd
  const [selectorEditMode, setSelectorEditMode] = useState(false) // true = 'Bestelling wijzigen': selector toont de huidige bestelling en vervangt ze bij Klaar
  const [lastAddedCustomDrink, setLastAddedCustomDrink] = useState<{ name: string; category: string } | null>(null) // melding in de selector na een eigen drankje
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)  // bevestiging vóór afronden
  const [showReorderPicker, setShowReorderPicker] = useState(false)  // kiezer om een vorig rondje opnieuw te bestellen
  const [reorderShowAll, setReorderShowAll] = useState(false) // toon ook oudere rondjes (standaard enkel het vorige)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Slaapstand: na 3 min zonder activiteit verbreken we realtime + poll (spaart egress). Ontwaakt bij tik/terugkeer.
  const [asleep, setAsleep] = useState(false)
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
  const [showIndicatiefInfo, setShowIndicatiefInfo] = useState(false) // info-popup achter de ? bij richtprijzen
  const [fairInfoMode, setFairInfoMode] = useState<null | "what" | "how">(null) // popup: wat is / hoe werkt fair split
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectorSearch, setSelectorSearch] = useState("")
  const [showFairSplit, setShowFairSplit] = useState(false)
  const [showFairSplitInfo, setShowFairSplitInfo] = useState(false)
  const [splitMode, setSplitMode] = useState<"fair" | "equal">("fair") // fair split of iedereen evenveel
  const [showEqualInfo, setShowEqualInfo] = useState(false)             // info-popup 'iedereen evenveel'
  const [compareOther, setCompareOther] = useState(false)                 // in 'iedereen evenveel': ook de Fair Split ernaast tonen
  const [showAboutParty, setShowAboutParty] = useState(false)             // korte uitleg over Rundo Party (de 'i' naast de titel)
  const [orderEditing, setOrderEditing] = useState(false)                 // toont de toevoeg-knoppen opnieuw terwijl er al een bestelling loopt
  const [showAllOrderedDrinks, setShowAllOrderedDrinks] = useState(false) // afrekenen: 'alle bestelde drankjes'-sectie open/dicht (standaard dicht)
  const [showVoiceExample, setShowVoiceExample] = useState(false)       // info-popup met spraak-voorbeeld
  const [noPayWarn, setNoPayWarn] = useState(false)                     // (reserve) melding geen betaling
  // Eigen bevestigings-popup i.p.v. de kale browser-confirm()
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void } | null>(null)

  // ─── Voice (quick order) state ────────────
  const [quickItems, setQuickItems] = useState<QuickOrderItem[]>([])
  const [voiceSuggestion, setVoiceSuggestion] = useState<{ spokenText: string; qty: number; suggested: Drink } | null>(null)
  const [quickVoiceActive, setQuickVoiceActive] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quickRecogRef = useRef<any>(null)

  // ─── Loaders ────────────
  // Laadt de standaard basisdranken (owner_id = null, voor iedereen) PLUS je eigen dranken
  // (owner_id = jij). Je eigen dranken zijn privé en volgen je naar elke groep die je maakt.
  const loadDrinks = useCallback(async () => {
    const ownerId = getOrCreateOwnerId()
    const { data, error } = await supabase.from("drinks").select("id,name,price,emoji,category,group_id,owner_id")
      .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
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
      setParticipants(orderStable(p || []))
      setOrders(o || [])
      if (!paye) setPayments(pay || [])
    }
  }, [])

  // Zuinig (minder PostgREST-egress): ververs enkel de betrokken tabel i.p.v. telkens alle drie.
  const reloadTable = useCallback(async (groupId: string, table: "participants" | "orders" | "payments") => {
    if (table === "participants") {
      const { data, error } = await supabase.from("participants").select("*").eq("group_id", groupId)
      if (!error && mounted.current) setParticipants(orderStable(data || []))
    } else if (table === "orders") {
      const { data, error } = await supabase.from("orders").select("id,participant_id,drink_id,quantity,group_id,session").eq("group_id", groupId)
      if (!error && mounted.current) setOrders(data || [])
    } else if (table === "payments") {
      const { data, error } = await supabase.from("payments").select("id,group_id,session,participant_id,amount,created_at").eq("group_id", groupId)
      if (!error && mounted.current) setPayments(data || [])
    }
  }, [])

  useEffect(() => { loadDrinks() }, [loadDrinks]) // start: enkel basisdranken
  useEffect(() => { if (group) loadDrinks() }, [group, loadDrinks]) // groep geopend ? ook eigen dranken
  useEffect(() => { setSavedGroups(getSavedGroups()) }, [])

  // Bij het openen van het pot-overzicht: schone lei voor het aanvul-formulier
  useEffect(() => {
    if (showPotOverview) { setPotAddedThisSession(0); setPotAddDraft({}); setPotAddBulk(""); setPotAddWarn(false); setPotAddPerPersonOpen(false) }
  }, [showPotOverview])

  // Bij het openen van 'afrekenen': onthoud welke drankjes toen nog toe te wijzen waren (die krijgen nadien een potloodje)
  useEffect(() => {
    if (view === "bill") {
      const ids = new Set<string>()
      orders.forEach((o) => { if (!o.participant_id && o.quantity > 0) ids.add(o.drink_id) })
      setBillOriginallyUnassigned(ids)
      setShowAllOrderedDrinks(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // ─── Realtime ────────────
  useEffect(() => {
    if (!group || asleep) return
    let reloadTimer: ReturnType<typeof setTimeout> | null = null

    const dirty = new Set<"participants" | "orders" | "payments">()
    const scheduleReload = (table: "participants" | "orders" | "payments") => {
      dirty.add(table)
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        if (!mounted.current) return
        const tables = [...dirty]; dirty.clear()
        tables.forEach((t) => reloadTable(group.id, t))
      }, 400)
    }

    const channel = supabase.channel(`group-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `group_id=eq.${group.id}` }, () => scheduleReload("orders"))
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `group_id=eq.${group.id}` }, () => scheduleReload("participants"))
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `group_id=eq.${group.id}` }, () => scheduleReload("payments"))
      .subscribe((status) => { if (status === "SUBSCRIBED" && mounted.current) { loadAll(group.id); loadDrinks() } })

    const refreshOnReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      if (mounted.current) { loadAll(group.id); loadDrinks() }
    }
    document.addEventListener("visibilitychange", refreshOnReturn)
    window.addEventListener("focus", refreshOnReturn)

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      document.removeEventListener("visibilitychange", refreshOnReturn)
      window.removeEventListener("focus", refreshOnReturn)
      supabase.removeChannel(channel)
    }
  }, [group, loadAll, loadDrinks, reloadTable, asleep])

  // Inactiviteits-slaapstand: na 3 min zonder tik/scroll/toets 'slaapt' het scherm
  // (realtime stopt via de guard hierboven -> spaart data). We meten inactiviteit met een
  // tijdstempel + interval i.p.v. één lange setTimeout, want die wordt door de browser
  // gepauzeerd zodra het tabblad verborgen is (scherm op slot) en vuurt dan niet betrouwbaar.
  // Belangrijk: enkel een échte tik/toets/scroll of een tik op de banner hervat het.
  // Terugkeren naar het tabblad hervat NIET vanzelf, zodat de "gepauzeerd"-melding
  // zichtbaar blijft en de gebruiker bewust op "tik om te hervatten" tikt.
  useEffect(() => {
    if (!group) return
    const SLEEP_MS = 3 * 60 * 1000
    lastActive.current = Date.now()
    setAsleep(false)
    const check = () => {
      if (mounted.current && Date.now() - lastActive.current >= SLEEP_MS) setAsleep(true)
    }
    const markActive = () => { lastActive.current = Date.now(); setAsleep((a) => (a ? false : a)) }
    const onVis = () => { if (typeof document !== "undefined" && document.visibilityState === "visible") check() }
    const evts: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"]
    evts.forEach((e) => window.addEventListener(e, markActive, { passive: true }))
    document.addEventListener("visibilitychange", onVis)
    const iv = setInterval(check, 20 * 1000)
    return () => {
      clearInterval(iv)
      evts.forEach((e) => window.removeEventListener(e, markActive))
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [group])

  // ─── Group create / join ────────────
  const startGroup = async () => {
    if (!groupName.trim() || isStarting) return
    setStartError(null)
    setError(null)
    setIsStarting(true)
    try {
      const owner_id = getOrCreateOwnerId()
      const base = stripDateSuffix(groupName.trim())
      const name = `${base} (${shortDateLabel()})`
      const clash = getSavedGroups().some((g) => g.name.trim().toLowerCase() === name.toLowerCase())
      if (clash) {
        setStartError("Je hebt vandaag al een opgeslagen groep met die naam. Kies een andere naam of open ze bij \u201copgeslagen groepen\u201d.")
        return
      }
      const invite_code = generateInviteCode()
      const { data, error } = await supabase.from("groups").insert([{ name, invite_code, owner_id }]).select().single()
      if (error || !data) { setStartError(L.errCreateGroup(error?.message ?? "")); return }
      setGroup(data)
      setActiveGroupCode(data.invite_code)
      await loadAll(data.id)
      saveGroupToStorage(data)
      setSavedGroups(getSavedGroups())
      setView("setup")
    } finally { setIsStarting(false) }
  }

  const joinGroup = async (codeOverride?: string, initialView?: AppView) => {
    const code = codeOverride ?? joinCode
    if (!code.trim() || isStarting) return
    setStartError(null)
    setError(null)
    setIsStarting(true)
    try {
      const { data, error } = await supabase.from("groups").select("*").eq("invite_code", code.trim().toUpperCase()).single()
      if (error || !data) {
        setStartError(L.errGroupNotFound)
        clearActiveGroupCode()
        return
      }
      setGroup(data)
      setActiveGroupCode(data.invite_code)
      await loadAll(data.id)
      saveGroupToStorage(data) // geopende groep automatisch onthouden (geen 'bewaar'-knop meer nodig)
      setSavedGroups(getSavedGroups())
      setView(initialView ?? "setup")
    } finally { setIsStarting(false) }
  }

  const didRestore = useRef(false)
  useEffect(() => {
    if (didRestore.current) return
    didRestore.current = true
    // Herstel enkel bij een refresh in dezelfde tab (sessionStorage). Vanaf het keuzescherm
    // wordt deze sessie gewist, zodat je daar altijd op het startscherm binnenkomt.
    try {
      const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("rundo_party_session") : null
      if (raw) {
        const s = JSON.parse(raw) as { code?: string; view?: AppView }
        if (s.code) joinGroup(s.code, s.view)
      }
    } catch { /* geen sessie om te herstellen */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bewaar de actieve sessie (groep + tab) in sessionStorage, zodat een refresh je in
  // dezelfde groep en tab houdt. Wordt gewist bij het verlaten van de groep.
  useEffect(() => {
    try {
      if (group && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("rundo_party_session", JSON.stringify({ code: group.invite_code, view }))
      }
    } catch { /* sessionStorage niet beschikbaar */ }
  }, [group, view])

  // ─── Person setup ────────────
  // Haal de HUIDIGE placeholdernummers rechtstreeks uit de DB, zodat we nooit
  // twee keer dezelfde "Persoon N" aanmaken (ook niet na verwijderen/toevoegen).
  const usedNumbersFromDb = async (groupId: string): Promise<Set<number>> => {
    const { data } = await supabase.from("participants").select("name").eq("group_id", groupId)
    const used = new Set<number>()
    ;(data || []).forEach((r: { name: string }) => { const num = nameNumberSuffix(r.name); if (num != null) used.add(num) })
    return used
  }

  const ensurePersonCount = async (count: number) => {
    if (!group) return
    const current = participants.length
    if (count > current) {
      const toAdd = count - current
      const used = await usedNumbersFromDb(group.id) // vers uit DB ? geen dubbels
      for (let i = 0; i < toAdd; i++) {
        const num = smallestFreeNumber(used)
        used.add(num)
        await supabase.from("participants").insert([{ name: `Persoon ${num}`, group_id: group.id }])
      }
      await reloadTable(group.id, "participants")
    } else if (count < current) {
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
    const used = await usedNumbersFromDb(group.id) // vers uit DB ? geen dubbele "Persoon N"
    const finalName = name?.trim() || `Persoon ${smallestFreeNumber(used)}`
    const { error } = await supabase.from("participants").insert([{ name: finalName, group_id: group.id }])
    if (error) { setError("Persoon toevoegen mislukt"); return }
    await reloadTable(group.id, "participants")
  }

  const deletePerson = async (id: string, name: string) => {
    if (!group) return
    if (orders.some((o) => o.participant_id === id)) {
      setError(`${name} kan niet verwijderd worden: er staat al een bestelling op deze naam in een afgerond rondje.`)
      return
    }
    setConfirmDialog({
      title: "Persoon verwijderen?",
      message: `${name} wordt verwijderd uit deze groep.`,
      confirmLabel: "Verwijderen",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("participants").delete().eq("id", id)
        if (error) { setError("Persoon verwijderen mislukt"); return }
        await supabase.from("payments").delete().eq("group_id", group.id).eq("participant_id", id)
        setPaymentDraft((prev) => { const n = { ...prev }; delete n[id]; return n })
        setPotDraft((prev) => { const n = { ...prev }; delete n[id]; return n })
        if (editingPerson === id) setEditingPerson(null)
        setToast(`${name} verwijderd`)
        await loadAll(group.id)
      },
    })
  }

  const renamePerson = async () => {
    if (!group || !editingPerson || !editingPersonName.trim()) return
    const { error } = await supabase.from("participants").update({ name: editingPersonName.trim() }).eq("id", editingPerson)
    if (error) { setError("Naam wijzigen mislukt"); return }
    setEditingPerson(null)
    setEditingPersonName("")
    await reloadTable(group.id, "participants")
  }

  // ─── Cart (huidige open ronde, met per-persoon toewijzing) ────────────
  const addToCart = (drinkId: string, delta: number, markLast = true) => {
    if (delta > 0 && markLast) setLastAddedDrinkIds([drinkId])
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

  const clearCart = () => { setCart({}); setLastAddedDrinkIds([]); setOrderEditing(false) }

  // Voer een actie uit die de huidige (niet-afgeronde) bestelling zou weggooien.
  // Is er nog een lopende bestelling, dan eerst bevestiging vragen.
  const requestDiscardPending = (action: () => void) => {
    if (cartTotalItems > 0) {
      setConfirmDialog({
        title: "Huidige bestelling wissen?",
        message: "Je hebt een niet-afgeronde bestelling. Als je verdergaat wordt je huidige bestellijst gewist en begin je opnieuw.",
        confirmLabel: "Wissen & opnieuw",
        danger: true,
        onConfirm: () => { clearCart(); action() },
      })
    } else {
      action()
    }
  }

  // Terug naar het homescherm (nieuwe groep maken / opgeslagen groep openen)
  const goHome = () => {
    clearActiveGroupCode()
    try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("rundo_party_session") } catch { /* ignore */ }
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
    setLastAddedViaVoice(false)
    setShowReorderPicker(false)
    setToast(`Rondje ${roundLabel(sess)} overgenomen — pas aan en rond af ✏️`)
  }

  // Een drankje volledig uit de huidige bestelling halen
  const removeFromCart = (drinkId: string) => {
    setCart((prev) => { const n = { ...prev }; delete n[drinkId]; return n })
    setLastAddedDrinkIds((cur) => cur.filter((id) => id !== drinkId))
  }

  // ─── Drank-selector: lokale selectie die telkens op 0 start ────────────
  const openDrinkSelector = () => { setSelectorDraft({}); setSelectorEditMode(false); setLastAddedCustomDrink(null); setSelectorSearch(""); setShowDrinkSelector(true) }
  // 'Bestelling wijzigen': open de selector voorgevuld met de huidige bestelling (tellers tonen de huidige drankjes).
  const openDrinkSelectorEdit = () => {
    const q: Record<string, number> = {}
    Object.entries(cart).forEach(([id, line]) => { if (line.total > 0) q[id] = line.total })
    setSelectorDraft(q); setSelectorEditMode(true); setLastAddedCustomDrink(null); setShowDrinkSelector(true)
  }
  const changeSelectorQty = (drinkId: string, delta: number) => {
    setLastAddedCustomDrink(null)
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
    if (addedIds.length === 0) { setToast(L.selectorEmptyToast); return }
    if (selectorEditMode) {
      // Vervang de bestelling door wat nu in de selector staat; behoud toewijzingen (trim als een aantal daalt).
      setCart((prev) => {
        const next: typeof prev = {}
        Object.entries(selectorDraft).forEach(([id, qty]) => {
          if (qty <= 0) return
          const old = prev[id]
          if (old) {
            const assignments = { ...old.assignments }
            let assignedSum = Object.values(assignments).reduce((a, b) => a + b, 0)
            let over = assignedSum - qty
            if (over > 0) {
              for (const pid of Object.keys(assignments)) {
                if (over <= 0) break
                const take = Math.min(assignments[pid], over)
                assignments[pid] -= take; over -= take
                if (assignments[pid] <= 0) delete assignments[pid]
              }
            }
            next[id] = { total: qty, assignments }
          } else {
            next[id] = { total: qty, assignments: {} }
          }
        })
        return next
      })
    } else {
      addedIds.forEach((id) => addToCart(id, selectorDraft[id], false))
    }
    setLastAddedDrinkIds(addedIds)
    setLastAddedViaVoice(false) // via selector ? geen aparte "Laatst toegevoegd"-kaart, wel highlight in de lijst
    setOrderEditing(false)      // toevoeg-knoppen weer verbergen; onderaan komt afronden/wijzigen
    setSelectorDraft({})
    setSelectorEditMode(false)
    setLastAddedCustomDrink(null)
    setShowDrinkSelector(false)
  }

  // Set van personen die ergens in de huidige bestelling al een drankje toegewezen kregen
  const assignedAnywhere = new Set<string>()
  Object.values(cart).forEach((line) => {
    Object.entries(line.assignments).forEach(([pid, q]) => { if (q > 0) assignedAnywhere.add(pid) })
  })

  // Toewijzen via één dropdown-vakje (i.p.v. een rij chips).
  const renderAssignControl = (drinkId: string, line: CartLine, variant: "full" | "summary") => {
    if (participants.length === 0) return null
    const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
    const unassigned = line.total - assignedSum
    const assignedEntries = participants
      .map((p) => ({ p, q: line.assignments[p.id] ?? 0 }))
      .filter((x) => x.q > 0)

    const sortedPeople = participants
    const gold = variant === "full"

    const isOpen = openAssignFor === drinkId
    const showEveryone = line.total === participants.length && participants.length > 0

    const assignedChips = assignedEntries.length > 0 ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
        {assignedEntries.map(({ p, q }) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: gold ? "#ecc85a" : "rgba(120,95,20,0.06)", border: gold ? "1px solid #e0ac00" : "1px solid rgba(120,95,20,0.12)", borderRadius: 20, padding: "3px 5px 3px 11px", fontSize: 12, fontWeight: gold ? 800 : 600, color: "#4a3f1e" }}>
            {p.name}
            <span style={{ background: "#a6790f", color: "#fff", borderRadius: 20, minWidth: 18, textAlign: "center", padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>×{q}</span>
            <button style={{ ...S.iconBtn, width: 18, height: 18, fontSize: 11 }} onClick={() => assignCartItem(drinkId, p.id, -1)}>−</button>
          </span>
        ))}
      </div>
    ) : null

    const panel = (
      <div style={{ marginTop: 6, border: "1px solid rgba(120,95,20,0.18)", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        {gold && (
          <button onClick={() => { setLastAddedDrinkIds((cur) => cur.filter((x) => x !== drinkId)); setOpenAssignFor(null) }}
            style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "9px 12px", fontSize: 13, color: "#a89a6a", cursor: "pointer" }}>
            ? later toewijzen
          </button>
        )}
        {sortedPeople.map((p) => {
          const q = line.assignments[p.id] ?? 0
          const canAdd = unassigned > 0
          const elsewhere = assignedAnywhere.has(p.id) && q === 0
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(150,110,20,0.05)" }}>
              <button onClick={() => { if (canAdd) { assignCartItem(drinkId, p.id, 1); if (unassigned === 1) setOpenAssignFor(null) } }} disabled={!canAdd && q === 0}
                style={{ flex: 1, textAlign: "left", background: q > 0 ? "rgba(214,158,20,0.06)" : "none", border: "none", padding: "10px 12px", fontSize: 13.5, fontWeight: q > 0 ? 800 : 600, color: canAdd || q > 0 ? "#4a3f1e" : "#bbb", cursor: canAdd ? "pointer" : "default", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
                  <span>{p.name}</span>
                  {elsewhere && <span style={{ fontSize: 10.5, color: "#b3a476", fontWeight: 600, whiteSpace: "nowrap" }}>— heeft al iets</span>}
                </span>
                {q > 0 && <span style={{ background: "#a6790f", color: "#fff", borderRadius: 20, minWidth: 20, textAlign: "center", padding: "1px 7px", fontSize: 12, fontWeight: 800 }}>{q}</span>}
                {canAdd && <span style={{ color: "#c8941a", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>+</span>}
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
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: unassigned > 0 ? 700 : 600, cursor: "pointer", color: unassigned > 0 ? "#e0685c" : "#1f8a4c", background: gold ? "#fffdf6" : "#fff", border: gold ? "1.5px solid #ecc85a" : "1px solid rgba(120,95,20,0.18)", borderRadius: 10, padding: "9px 12px" }}>
        <span>{unassigned > 0 ? "voor wie?" : "✅ alles toegewezen"}</span>
        <span style={{ color: "#aaa" }}>{isOpen ? "▾" : "▸"}</span>
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

    if (!isOpen) {
      return (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setOpenAssignFor(drinkId)}
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {assignedEntries.map(({ p, q }) => (
              <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#4a3f1e", fontWeight: 600, background: "rgba(120,95,20,0.06)", borderRadius: 20, padding: "2px 8px 2px 10px" }}>{p.name}<span style={{ background: "#a6790f", color: "#fff", borderRadius: 20, minWidth: 18, textAlign: "center", padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>×{q}</span></span>
            ))}
            {unassigned > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#e0685c", background: "rgba(120,95,20,0.05)", borderRadius: 20, padding: "3px 12px" }}>{unassigned} nog toe te wijzen!</span>
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
        <div style={{ fontSize: 11, color: "#8a7d55", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
          Toewijzen{unassigned > 0 ? <> — <span style={{ color: "#e0685c" }}>{unassigned} open</span></> : " ✓"}
        </div>
        {panel}
        <button
          onClick={() => setOpenAssignFor(null)}
          style={{ marginTop: 7, width: "100%", background: "rgba(120,95,20,0.04)", border: "1px solid rgba(120,95,20,0.08)", color: "#8a7d55", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 10, padding: "8px 0" }}
        >
          Sluiten ?
        </button>
      </div>
    )
  }

  // Toewijs-control voor het afrekenscherm
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

    if (anonymousQty === 0 && !wasOriginallyUnassigned) return null

    const trigger = anonymousQty > 0 ? (
      <button onClick={() => setOpenBillAssignFor(isOpen ? null : drink.id)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#e0685c", background: "rgba(224,107,94,0.06)", border: "1px solid rgba(224,107,94,0.4)", borderRadius: 10, padding: "7px 10px" }}>
        <span>👉 {anonymousQty} nog toe te wijzen — voor wie?</span>
        <span style={{ color: "#aaa" }}>{isOpen ? "▾" : "▸"}</span>
      </button>
    ) : (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setOpenBillAssignFor(isOpen ? null : drink.id)} title="Toewijzing wijzigen"
          style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 12, background: isOpen ? "rgba(214,158,20,0.16)" : "rgba(120,95,20,0.05)" }}>
          {isOpen ? "▲" : "▼"}
        </button>
      </div>
    )
    const panel = isOpen ? (
      <div style={{ marginTop: 6, border: "1px solid rgba(120,95,20,0.18)", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        {participants.map((p) => {
          const q = perPerson[p.id] ?? 0
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(150,110,20,0.05)" }}>
              <button onClick={() => { if (canAdd) { assignOneAnonymous(drink.id, p.id); if (anonymousQty === 1) setOpenBillAssignFor(null) } }} disabled={!canAdd && q === 0}
                style={{ flex: 1, textAlign: "left", background: q > 0 ? "rgba(214,158,20,0.06)" : "none", border: "none", padding: "10px 12px", fontSize: 13.5, fontWeight: q > 0 ? 800 : 600, color: canAdd || q > 0 ? "#4a3f1e" : "#bbb", cursor: canAdd ? "pointer" : "default", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{p.name}</span>
                {q > 0 && <span style={{ background: "#a6790f", color: "#fff", borderRadius: 20, minWidth: 20, textAlign: "center", padding: "1px 7px", fontSize: 12, fontWeight: 800 }}>{q}</span>}
                {canAdd && <span style={{ color: "#c8941a", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>+</span>}
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
  const nextSession = (sessions.length > 0 ? Math.max(...sessions) : 0) + 1
  // Toon rondjes altijd doorlopend (1, 2, 3—) op basis van hun VOLGORDE, los van het interne
  // sessienummer. Zo blijft de nummering netjes ook na het verwijderen van een rondje (geen gaten),
  // zonder dat we in de database moeten hernummeren.
  const roundLabel = (s: number) => { const i = sessions.indexOf(s); return i >= 0 ? i + 1 : sessions.length + 1 }
  const nextRoundLabel = sessions.length + 1 // het rondje dat je nu aan het samenstellen bent

  const [finishedRoundSnapshot, setFinishedRoundSnapshot] = useState<{ session: number; cart: Record<string, CartLine> } | null>(null)
  const [barmanStep, setBarmanStep] = useState<"list" | "pay">("list")
  const [payWarn, setPayWarn] = useState(false)

  const finishRound = async () => {
    if (!group || cartTotalItems === 0) { setToast("Voeg eerst drankjes toe"); return }
    const newRoundSession = nextSession
    // Alle rijen in één keer opbouwen en met ÉÉN insert wegschrijven ? alles-of-niets,
    // geen half rondje meer als de tab sluit of het netwerk hapert.
    const rows: { participant_id: string | null; drink_id: string; quantity: number; group_id: string; session: number }[] = []
    for (const [drinkId, line] of Object.entries(cart)) {
      const assignedSum = Object.values(line.assignments).reduce((s, q) => s + q, 0)
      for (const [participantId, qty] of Object.entries(line.assignments)) {
        if (qty <= 0) continue
        rows.push({ participant_id: participantId, drink_id: drinkId, quantity: qty, group_id: group.id, session: newRoundSession })
      }
      const remaining = line.total - assignedSum
      if (remaining > 0) {
        rows.push({ participant_id: null, drink_id: drinkId, quantity: remaining, group_id: group.id, session: newRoundSession })
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("orders").insert(rows)
      if (error) { setError("Rondje opslaan mislukt — probeer opnieuw"); return }
    }
    await reloadTable(group.id, "orders")
    setBarmanStep("list")
    setFinishedRoundSnapshot({ session: newRoundSession, cart })
    setCart({})
    setLastAddedDrinkIds([])
    setOrderEditing(false)
    setSession(newRoundSession)
  }

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

  // ─── Voice quick order ────────────
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

      const addedIds: string[] = []
      recognized.forEach((pd) => {
        const match = fuzzyMatchDrink(pd.name, drinks)
        if (match) { addToCart(match.id, pd.qty, false); addedIds.push(match.id) }
      })
      if (addedIds.length > 0) { setLastAddedDrinkIds(addedIds); setLastAddedViaVoice(true) }

      if (recognized.length > 0) {
        setToast(`Toegevoegd: ${recognized.map((d) => `${d.qty}× ${d.name}`).join(", ")}`)
      }

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
    setLastAddedDrinkIds([voiceSuggestion.suggested.id])
    setLastAddedViaVoice(true)
    setToast(`${voiceSuggestion.qty}× ${voiceSuggestion.suggested.name} toegevoegd`)
    setVoiceSuggestion(null)
  }

  const dismissVoiceSuggestion = () => setVoiceSuggestion(null)

  // ─── Round editing (assign drinks to people after the fact) ────────────
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

    await reloadTable(group.id, "orders")
  }

  const assignOneAnonymous = async (drinkId: string, participantId: string) => {
    const anon = orders.find((o) => !o.participant_id && o.drink_id === drinkId && o.quantity > 0)
    if (!anon) return
    await assignAnonymousQty(drinkId, anon.session, participantId, 1)
  }

  const assignAnonymousToMany = async (drinkId: string, participantIds: string[]) => {
    if (!group || participantIds.length === 0) return
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
    for (const { session, pid, qty } of adds) {
      const existing = orders.find((o) => o.participant_id === pid && o.drink_id === drinkId && o.session === session)
      if (existing) await supabase.from("orders").update({ quantity: existing.quantity + qty }).eq("id", existing.id)
      else await supabase.from("orders").insert([{ participant_id: pid, drink_id: drinkId, quantity: qty, group_id: group.id, session }])
    }
    await reloadTable(group.id, "orders")
  }

  const unassignOneFromPerson = async (drinkId: string, participantId: string) => {
    const ord = orders.find((o) => o.participant_id === participantId && o.drink_id === drinkId && o.quantity > 0)
    if (!ord) return
    await unassignOrderQty(drinkId, participantId, ord.session, 1)
  }

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
    await reloadTable(group.id, "orders")
  }

  const deleteRound = async (round: number) => {
    if (!group) return
    setConfirmDialog({
      title: `Ronde ${roundLabel(round)} verwijderen?`,
      message: "Je verliest ook de bestellingen én betalingen van deze ronde. De overige rondes behouden hun nummer.",
      confirmLabel: "Verwijderen",
      danger: true,
      onConfirm: async () => {
        // Enkel deze ronde verwijderen; NIET hernummeren (zo blijft "Ronde 3" ook op een
        // tweede toestel "Ronde 3" — er ontstaat gewoon een gaatje in de nummering).
        await supabase.from("orders").delete().eq("group_id", group.id).eq("session", round)
        await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
        await loadAll(group.id)
        setOpenRounds(null)
        setEditingRound(null)
        setToast(`Ronde ${roundLabel(round)} verwijderd`)
      },
    })
  }

  // ─── Payments ────────────
  const openPaymentEditor = (round: number) => {
    const existing = payments.filter((p) => p.session === round)
    const draft: Record<string, string> = {}
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
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", round)
    const inserts = (Object.entries(paymentDraft) as [string, string][])
      .filter(([key, amt]) => (key === POT_PAYER || participants.some((p) => p.id === key)) && parseFloat(amt) > 0)
      .map(([key, amt]) => ({ group_id: group.id, session: round, participant_id: key === POT_PAYER ? null : key, amount: parseFloat(amt) }))
    if (inserts.length > 0) await supabase.from("payments").insert(inserts)
    await reloadTable(group.id, "payments")
    setPaymentEditRound(null)
    setToast("Betaling opgeslagen")
  }

  const getRoundPayments = (round: number) => payments.filter((p) => p.session === round)
  const getRoundPaymentTotal = (round: number) => getRoundPayments(round).reduce((s, p) => s + p.amount, 0)

  // ─── Pot (gezamenlijke inleg vooraf, sessie 0) ────────────
  const POT_SESSION = 0
  const POT_PAYER = "__POT__"
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
      .map(([participantId, amt]) => ({ participantId, euro: Math.round(parseFloat(String(amt).replace(",", ".")) || 0) }))
      .filter(({ participantId, euro }) => participants.some((p) => p.id === participantId) && euro > 0)
      .map(({ participantId, euro }) => ({ group_id: group.id, session: POT_SESSION, participant_id: participantId, amount: euro }))
    if (inserts.length === 0) { setPotWarn(true); return }
    await supabase.from("payments").delete().eq("group_id", group.id).eq("session", POT_SESSION)
    await supabase.from("payments").insert(inserts)
    await reloadTable(group.id, "payments")
    setPotWarn(false)
    setShowPotModal(false)
    setToast("Pot opgeslagen ✅")
  }

  const addToPot = async () => {
    if (!group) return
    let rows = (Object.entries(potAddDraft) as [string, string][])
      .map(([pid, v]) => ({ participant_id: pid, amount: Math.round(parseFloat((v || "").replace(",", ".")) || 0) }))
      .filter((r) => participants.some((p) => p.id === r.participant_id) && !isNaN(r.amount) && r.amount > 0)
    if (rows.length === 0) {
      const amt = Math.round(parseFloat((potAddBulk || "").replace(",", ".")) || 0)
      if (isNaN(amt) || amt <= 0 || participants.length === 0) { setPotAddWarn(true); setToast("Vul eerst een bedrag in om de pot aan te vullen ⚠️"); return }
      rows = participants.map((p) => ({ participant_id: p.id, amount: amt }))
    }
    const inserts = rows.map((r) => ({ group_id: group.id, session: POT_SESSION, participant_id: r.participant_id, amount: r.amount }))
    const { error } = await supabase.from("payments").insert(inserts)
    if (error) { setError("Pot aanvullen mislukt"); return }
    setPotAddDraft({})
    setPotAddBulk("")
    setPotAddWarn(false)
    await reloadTable(group.id, "payments")
    const tot = inserts.reduce((s, r) => s + r.amount, 0)
    const usedNow = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
    const newTotal = potTotal + tot
    const leftNow = Math.max(0, newTotal - usedNow)
    setToast(`🫙 €${tot.toFixed(2)} toegevoegd — €${leftNow.toFixed(2)} nog in pot — €${usedNow.toFixed(2)} gebruikt`)
    setShowPotOverview(false)
  }

  const deletePotContribution = async (id: string) => {
    if (!group) return
    const { error } = await supabase.from("payments").delete().eq("id", id)
    if (error) { setError("Verwijderen mislukt"); return }
    await reloadTable(group.id, "payments")
  }

  // ─── Drink CRUD ────────────
  const addDrink = async () => {
    const { name, price } = newDrink
    const priceNum = parseFloat((price || "").replace(",", "."))
    if (!name.trim()) { setAddDrinkWarn(L.warnNameFirst); return }
    if (!price || isNaN(priceNum) || priceNum <= 0) { setAddDrinkWarn(L.warnPriceRequired); return }
    setAddDrinkWarn(null)
    const cat = "Eigen"
    const autoEmoji = "⭐"
    // Eigen drank hoort enkel bij DEZE groep (group_id), niet bij andere groepen.
    const { data, error } = await supabase.from("drinks").insert([{ name: name.trim(), price: priceNum, emoji: autoEmoji, category: cat, group_id: group?.id ?? null, owner_id: getOrCreateOwnerId() }]).select().single()
    if (error) { setError("Drank toevoegen mislukt: " + error.message); return }
    setNewDrink({ name: "", price: "", emoji: "", category: newDrink.category })
    setToast(`${name} toegevoegd`)
    await loadDrinks()
    if (showDrinkSelector) {
      setActiveCategory(CATEGORY_LABELS[cat] ?? cat)
      setLastAddedCustomDrink({ name: name.trim(), category: cat })
    } else if (data?.id) {
      addToCart(data.id, 1)
      setLastAddedDrinkIds([data.id])
      setLastAddedViaVoice(true) // enkel drankje ? 'Laatst toegevoegd'-kaart mag
    }
    setShowAddDrink(false)
  }

  const saveEditedDrink = async () => {
    if (!editingDrink) return
    if (editingDrink.group_id) {
      // Eigen drank/aanpassing van deze groep ? gewoon bijwerken.
      const { error } = await supabase.from("drinks").update({ name: editingDrink.name, price: editingDrink.price, emoji: editingDrink.emoji, category: editingDrink.category }).eq("id", editingDrink.id)
      if (error) { setError("Drank opslaan mislukt"); return }
    } else {
      // Basisdrank aanpassen ? NIET de globale drank wijzigen (dat zou andere groepen raken),
      // maar een eigen versie voor deze groep aanmaken die de basisdrank hier vervangt.
      const { error } = await supabase.from("drinks").insert([{ name: editingDrink.name, price: editingDrink.price, emoji: editingDrink.emoji, category: editingDrink.category, group_id: group?.id ?? null, owner_id: getOrCreateOwnerId() }])
      if (error) { setError("Drank opslaan mislukt"); return }
    }
    setEditingDrink(null)
    await loadDrinks()
  }

  // ? = zelf toegevoegde drank. group_id gezet = hoort bij deze groep (eigen drank of aanpassing).
  const isGroupDrink = (d: Drink) => !!d.group_id

  const deleteDrinkFromList = async (id: string) => {
    const d = drinks.find((dr) => dr.id === id)
    if (d && !isGroupDrink(d)) { setToast("Basisdranken kunnen niet verwijderd worden"); return }
    setConfirmDialog({
      title: "Drankje verwijderen?",
      message: d ? `${d.name} verdwijnt uit de lijst van deze groep.` : "Dit drankje wordt verwijderd.",
      confirmLabel: "Verwijderen",
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from("drinks").delete().eq("id", id)
        if (error) { setError("Drank verwijderen mislukt"); return }
        await loadDrinks()
      },
    })
  }

  // ─── Computed totals ────────────
  const getGlobalTotal = () => orders.reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)

  // Voor de keuzelijsten/bewerken: als deze groep een eigen versie van een drank heeft
  // (zelfde naam), toon dan die i.p.v. de basisdrank. De volledige `drinks` blijft wél
  // bestaan zodat oude bestellingen (die naar de basisdrank verwijzen) herkend blijven.
  const visibleDrinks = (() => {
    const groupRows = drinks.filter((d) => d.group_id)
    const shadowed = new Set(groupRows.map((d) => normalizeDrinkName(d.name)))
    const baseRows = drinks.filter((d) => !d.group_id && !shadowed.has(normalizeDrinkName(d.name)))
    return [...baseRows, ...groupRows]
  })()
  const groupedDrinks = groupDrinksByCategory(visibleDrinks)
  const bill = calculateBill(participants, orders, drinks, payments)
  // Fair split = de ÉCHT betaalde rondebedragen, verdeeld naar wat elk dronk (of gelijk bij 'iedereen evenveel').
  // De inleg die niet gebruikt werd, komt terug via de virtuele "de pot".
  const fairSplit = calculateFairSplit(bill.lines, bill.totalActuallySpent, bill.anonymousValue, splitMode)
  const settledDebts = settleDebts(fairSplit, bill.totalActuallySpent - bill.totalPaid)
  // Zuivere Fair Split én zuivere gelijke verdeling (los van de actieve modus),
  // zodat we altijd de andere optie ernaast kunnen vergelijken.
  const fairRows = calculateFairSplit(bill.lines, bill.totalActuallySpent, bill.anonymousValue, "fair")
  const fairSettled = settleDebts(fairRows, bill.totalActuallySpent - bill.totalPaid)
  const equalRows = calculateFairSplit(bill.lines, bill.totalActuallySpent, bill.anonymousValue, "equal")
  const equalSettled = settleDebts(equalRows, bill.totalActuallySpent - bill.totalPaid)
  // Kan er wel een verdeling gemaakt worden?
  //  - er moet echt iets betaald zijn voor rondes, EN
  //  - er mag geen enkel rondje onbetaald zijn (anders klopt het totaal niet — ook niet bij 'iedereen evenveel'), EN
  //  - voor Fair Split mag er bovendien geen enkel drankje niet-toegewezen zijn.
  const unpaidRounds = sessions.filter((s) => getRoundPaymentTotal(s) <= 0.01)
  const hasUnassignedDrinks = orders.some((o) => !o.participant_id && o.quantity > 0)
  const allRoundsPaid = sessions.length > 0 && unpaidRounds.length === 0
  const canSplit = bill.totalActuallySpent > 0.01 && allRoundsPaid        // 'iedereen evenveel' mag zodra alles betaald is
  const canFairSplit = canSplit && !hasUnassignedDrinks                    // Fair Split vereist bovendien: alles toegewezen

  // Zodra de verdeling niet (meer) mag (onbetaald rondje, of Fair Split met niet-toegewezen
  // drankjes), verbergen we een eventueel al getoonde verdeling automatisch.
  useEffect(() => {
    if (!canSplit || (splitMode === "fair" && !canFairSplit)) {
      setShowBillPrices(false)
      setShowFairSplit(false)
      setCompareOther(false)
    }
    if (!canFairSplit) setCompareOther(false) // fair-vergelijking kan niet met niet-toegewezen drankjes
  }, [canSplit, canFairSplit, splitMode])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: Start screen (no group yet)
  // ═══════════════════════════════════════════════════════════════════════
  if (!group) {
    const filteredSaved = savedGroups.filter((g) => g.name.toLowerCase().includes(savedSearch.toLowerCase()))
    return (
      <div style={S.page}>
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#a89a6a", textDecoration: "none", marginBottom: 14, cursor: "pointer" }}>← naar Rundo startscherm</a>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}><LanguageToggle compact /></div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <RundoLogo size={60} />
              <h1 style={{ ...S.h1, margin: 0, display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ color: "#4a3f1e" }}>Rundo</span>
                <span style={{ color: "#f0a500" }}>Party</span>
              </h1>
              <button
                onClick={() => setShowAboutParty(true)}
                title={L.aboutBtnTitle}
                style={{ width: 24, height: 24, borderRadius: "50%", border: "1.5px solid rgba(150,110,20,0.25)", background: "#fff", color: "#c8941a", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                i
              </button>
            </div>
            <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, color: "#f0a500", fontSize: 15, fontWeight: 700, margin: 0 }}>
              <CheersIcon size={20} /> {L.appTagline}
            </p>
          </div>

          <div style={S.card}>
            <input value={groupName} onChange={(e) => { setStartError(null); setGroupName(e.target.value) }} onKeyDown={(e) => e.key === "Enter" && startGroup()} placeholder={L.groupNamePlaceholder} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 16, fontWeight: 800 }} onClick={startGroup} disabled={isStarting}>{isStarting ? L.loading : L.startBtn}</button>
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
                <b style={{ fontSize: 14, color: "#4a3f1e" }}>{L.savedGroups}</b>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#c98a00", background: "rgba(233,196,95,0.18)", borderRadius: 10, padding: "1px 8px" }}>{savedGroups.length}</span>
                  <span style={{ fontSize: 12, color: "#c98a00", display: "inline-block", transform: savedOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
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
                      <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); removeGroupFromStorage(g.id); setSavedGroups(getSavedGroups()) }}>🔄</button>
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
              <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#4a3f1e", display: "flex", alignItems: "center", gap: 8 }}>Hoe werkt Fair Split?</h3>
              <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
                Met <b style={{ color: "#c98a00" }}>Fair Split</b> delen we het totaalbedrag <b>NIET</b> door het aantal personen. Op basis van richtprijzen per drankje verdelen we de totaalprijs volgens wie wat dronk. <b>Niet perfect, wel veel eerlijker!</b>
              </p>
              <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setFairInfoMode(null)}>Begrepen</button>
            </div>
          </div>
        )}
        {showAboutParty && (
          <div style={{ ...S.overlay, zIndex: 2200 }} onClick={() => setShowAboutParty(false)}>
            <div style={{ ...S.modal, width: 370 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#4a3f1e", display: "flex", alignItems: "center", gap: 8 }}><RundoLogo size={22} /> Wat is Rundo Party?</h3>
              <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
                Met <b style={{ color: "#f0a500" }}>Rundo Party</b> hou je vlot bij wie welke rondjes bestelt en betaalt — per persoon of via een gezamenlijke pot. Op het einde verdeel je de rekening <b>eerlijk met Fair Split</b> (op basis van wie wat dronk) of gewoon gelijk over iedereen.
              </p>
              <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setShowAboutParty(false)}>Begrepen</button>
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
      {asleep && (
        <div onClick={() => { lastActive.current = Date.now(); setAsleep(false) }} style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 3000, background: "rgba(20,33,58,0.92)", color: "#fff", padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(16,24,40,0.3)", whiteSpace: "nowrap" }}>
          {L.asleepBanner}
        </div>
      )}
      {error && (
        <div style={S.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Modal: Dranken/prijzen bewerken — per categorie, geldt overal */}
      {showEditDrinks && (
        <div style={{ ...S.overlay, zIndex: 2600 }}>
          <div style={{ ...S.modal, width: 440, maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{L.editDrinksTitle}</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>{L.editDrinksSub}</p>
            <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
              {!visibleDrinks.some(isGroupDrink) && <div style={{ color: "#aaa", textAlign: "center", padding: 20, fontSize: 13 }}>{L.noOwnDrinks}</div>}
              {(() => {
                const groups: Record<string, Drink[]> = {}
                visibleDrinks.filter(isGroupDrink).forEach((d) => { const k = d.category ?? FALLBACK_CATEGORY; (groups[k] ||= []).push(d) })
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
                            <button style={{ ...S.btn, padding: "6px 10px" }} onClick={() => setEditingDrink(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, fontSize: 14 }}>{d.emoji} {d.name} <span style={{ color: "#999" }}>— €{d.price.toFixed(2)}</span></span>
                            <button style={S.iconBtn} onClick={() => setEditingDrink(d)}>✏️</button>
                            <button style={S.iconBtn} title={L.deleteOwnDrinkTitle} onClick={() => deleteDrinkFromList(d.id)}>🗑️</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
            <button style={{ ...S.btn, width: "100%" }} onClick={() => { setEditingDrink(null); setShowEditDrinks(false) }}>{L.closeBtn}</button>
          </div>
        </div>
      )}

      {/* Modal: Eigen drank toevoegen — naam + richtprijs + categorie */}
      {showAddDrink && (
        <div style={{ ...S.overlay, zIndex: 2300 }}>
          <div style={{ ...S.modal, width: 400 }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700 }}>{L.addDrinkTitle}</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{L.addDrinkSub}</p>

            <label style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{L.nameLabel}</label>
            <input placeholder={L.drinkNamePlaceholder} value={newDrink.name} onChange={(e) => { setAddDrinkWarn(null); setNewDrink({ ...newDrink, name: e.target.value }) }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginTop: 4, marginBottom: 12 }} />

            <label style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{L.priceLabel}</label>
            <input type="number" placeholder="0.00" value={newDrink.price} onChange={(e) => { setAddDrinkWarn(null); setNewDrink({ ...newDrink, price: e.target.value }) }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginTop: 4, marginBottom: 18 }} />

            {addDrinkWarn && (
              <div style={{ fontSize: 12.5, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 10, padding: "9px 11px", marginBottom: 14, lineHeight: 1.45 }}>
                ⚠️ {addDrinkWarn}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "11px 0", fontWeight: 800 }} onClick={addDrink}>➕ {L.add}</button>
              <button style={{ ...S.btn, flex: 1, padding: "11px 0" }} onClick={() => { setAddDrinkWarn(null); setShowAddDrink(false) }}>{L.closeBtn}</button>
            </div>
          </div>
        </div>
      )}

      {showAddPerson && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>{L.addPersonTitle}</h3>
            <AddPersonForm onAdd={(name) => { addPerson(name); setShowAddPerson(false) }} onClose={() => setShowAddPerson(false)} />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={S.topBar}>
        <div style={{ minWidth: 0 }}>
          <div onClick={goHome} title={L.toHomeTitle} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <RundoLogo size={34} />
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}><span style={{ color: "#4a3f1e" }}>Rundo</span> <span style={{ color: "#f0a500" }}>Party</span></div>
          </div>
          {/* Pot-info linksboven (met de vrijgekomen ruimte) */}
          <div style={{ marginTop: 9 }}>
            {potTotal > 0 ? (() => {
              const used = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
              const left = Math.max(0, potTotal - used)
              return (
                <button onClick={() => setShowPotOverview(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#a06b00", background: "linear-gradient(135deg,#fffdf6,#fff3cf)", border: "1.5px solid #ecc85a", borderRadius: 20, padding: "3px 11px", cursor: "pointer" }}>
                  🫙 {L.potContributed(potTotal.toFixed(2))}<b style={{ color: "#4a3f1e" }}>{L.potRemaining(left.toFixed(2))}</b>
                </button>
              )
            })() : (
              <button onClick={openPotModal} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.5)", borderRadius: 20, padding: "3px 11px", cursor: "pointer" }}>🫙 {L.potLay}</button>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div style={{ marginBottom: 5, display: "flex", justifyContent: "flex-end" }}><LanguageToggle compact /></div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.15, marginBottom: 2 }}>{group.name}</div>
          <div style={{ fontSize: 11.5, color: "#a89a6a", fontWeight: 700 }}>{participants.length} {participants.length === 1 ? L.person : L.people}</div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={S.tabBar}>
        {([
          { id: "setup", label: potTotal > 0 ? L.tabGroupPot : L.tabGroup },
          { id: "ordering", label: L.tabOrder },
          { id: "rounds", label: L.tabRounds(sessions.length) },
          { id: "bill", label: L.tabBill },
        ] as { id: AppView; label: string }[]).map((t) => {
          const locked = participants.length === 0 && t.id !== "setup"
          return (
          <button
            key={t.id}
            onClick={() => {
              if (locked) { setToast(L.tabLockToast); return }
              // 'Nieuwe bestelling' aanklikken terwijl je er al bent met een lopende bestelling:
              // eerst waarschuwen dat opnieuw beginnen je huidige lijst wist.
              if (t.id === "ordering" && view === "ordering" && cartTotalItems > 0) {
                requestDiscardPending(() => {})
              } else {
                setView(t.id)
              }
            }}
            style={{
              flex: 1, border: "none", borderRadius: 12, padding: "11px 3px", fontSize: 13.5, cursor: locked ? "default" : "pointer", opacity: locked ? 0.4 : 1, lineHeight: 1.15,
              fontWeight: view === t.id ? 800 : 700,
              background: view === t.id ? "linear-gradient(135deg,#f6dd95,#eecb6e)" : "transparent",
              color: view === t.id ? "#5a4a1a" : "#a89a6a",
              boxShadow: view === t.id ? "0 3px 10px -2px rgba(233,196,95,0.5)" : "none",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
          )
        })}
      </div>

      {/* ═══ VIEW: Setup (group + persons) ═══ */}
      {view === "setup" && (
        <div>
          <div style={S.card}>
            <h3 style={S.h3}>{L.setupCountTitle}</h3>
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
              {L.setupNamesOptional}
            </p>
          </div>

          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                <h3 style={{ ...S.h3, marginBottom: 0 }}>{L.setupPersonsTitle}</h3>
                <span style={{ fontSize: 11, fontStyle: "italic", color: "#b3a988", fontWeight: 600 }}>{L.setupTapToRename}</span>
              </div>
              <button style={{ ...S.btn, fontSize: 12, flexShrink: 0 }} onClick={() => setShowAddPerson(true)}>{L.setupAddName}</button>
            </div>

            {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 24 }}>{L.setupNoPersons}</div>}

            {(() => {
              const isPh = (pp: (typeof participants)[number]) => /^Persoon \d+$/.test(pp.name)
              const named = participants.filter((pp) => !isPh(pp))
              const placeholders = participants.filter(isPh)
              const ordered = [...named, ...placeholders]   // namen eerst, placeholders erna
              const cols = ordered.length <= 5 ? 1 : ordered.length <= 12 ? 2 : 3
              const rows = Math.max(1, Math.ceil(ordered.length / cols))
              return (
                <div style={cols > 1 ? { display: "grid", gridAutoFlow: "column", gridTemplateRows: `repeat(${rows}, auto)`, columnGap: 16 } : undefined}>
            {ordered.map((p, idx) => {
              const isPlaceholder = isPh(p)
              const posLabel = L.personLabel(idx + 1)   // hernummerd op positie (namen eerst), zonder gaten
              return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                {editingPerson === p.id ? (
                  <input
                    autoFocus
                    value={editingPersonName}
                    placeholder={isPlaceholder ? posLabel : p.name}
                    onChange={(e) => setEditingPersonName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                      if (e.key === "Escape") { setEditingPersonName(""); setEditingPerson(null) }
                    }}
                    onBlur={() => { if (editingPersonName.trim()) renamePerson(); else { setEditingPersonName(""); setEditingPerson(null) } }}
                    style={{ ...S.input, flex: 1 }}
                  />
                ) : (() => {
                  const shown = isPlaceholder ? L.personShort(idx + 1) : p.name
                  return (
                    <>
                      <span
                        onClick={() => { setEditingPerson(p.id); setEditingPersonName("") }}
                        style={{ flex: 1, minWidth: 0, cursor: "text", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: 15, ...(isPlaceholder ? { fontStyle: "italic", color: "#b3a988", borderBottom: "1px dashed #cdbd8e" } : {}) }}
                      >{shown}</span>
                      <button style={S.iconBtn} onClick={() => { setEditingPerson(p.id); setEditingPersonName("") }}>✏️</button>
                      <button style={S.iconBtn} onClick={() => deletePerson(p.id, isPlaceholder ? posLabel : p.name)}>🗑️</button>
                    </>
                  )
                })()}
              </div>
              )
            })}
                </div>
              )
            })()}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              style={{ ...S.btn, flex: 1, padding: "14px 8px", fontSize: 14, fontWeight: 700, border: "1.5px solid #ecc85a", background: potTotal > 0 ? "#ecc85a" : "#fffdf6", color: "#4a3f1e" }}
              onClick={() => (potTotal > 0 ? setShowPotOverview(true) : openPotModal())}
            >
              {potTotal > 0 ? L.potPlacedBtn(potTotal.toFixed(2)) : L.potLayFirst}
            </button>
            <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "14px 8px", fontSize: 15, fontWeight: 800 }} onClick={() => setView("ordering")}>
              {L.startOrderingBtn}
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
              <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#5a4a1a,#7a6528)", color: "#f7d461", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>{nextRoundLabel}</div>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#8a7d55", whiteSpace: "nowrap" }}>{L.roundLabelPre} {nextRoundLabel}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 14, fontWeight: 800, color: "#4a3f1e", lineHeight: 1.15 }}>{cartTotalItems > 0 ? L.currentOrderTitle : ""}</div>
            {sessions.length >= 1 && (
              <button
                onClick={() => requestDiscardPending(() => { setReorderShowAll(false); setShowReorderPicker(true) })}
                style={{ flexShrink: 0, background: "rgba(214,158,20,0.1)", border: "1px solid rgba(214,158,20,0.3)", color: "#c8941a", borderRadius: 20, padding: "6px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {L.repeatPrevRoundBtn}
              </button>
            )}
          </div>

          {/* Toevoeg-knoppen: enkel bij een lege bestelling, of wanneer je op 'Bestelling wijzigen' klikte */}
          {(cartTotalItems === 0 || orderEditing) && (
          <>
          {/* Bovenaan: 2 knoppen — links selecteren, rechts (smaller) spraak met info-i */}
          <div style={{ ...S.card, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
              <button
                onClick={openDrinkSelector}
                style={{ ...S.btn, flex: 1.15, padding: "14px 8px", fontSize: 13, fontWeight: 700, border: "none", lineHeight: 1.25, background: "linear-gradient(135deg,#f4c430,#f7d461)", color: "#4a3a0a", boxShadow: "0 6px 18px rgba(150,110,20,0.3)" }}
              >
                {L.selectDrinksBtn}
              </button>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#aaa", flexShrink: 0, alignSelf: "center" }}>{L.andOr}</span>
              <div style={{ flex: 0.85, position: "relative", display: "flex" }}>
                <button
                  onClick={quickVoiceActive ? stopQuickVoice : startQuickVoice}
                  style={{
                    ...S.btn, width: "100%", padding: "14px 8px", fontSize: 12.5, fontWeight: 700, border: "none", lineHeight: 1.25,
                    background: quickVoiceActive ? "#e74c3c" : "linear-gradient(135deg,#f4c430,#f7d461)",
                    color: quickVoiceActive ? "#fff" : "#4a3a0a",
                    animation: quickVoiceActive ? "pulse 1.2s infinite" : "none",
                    boxShadow: quickVoiceActive ? "0 0 0 5px rgba(231,76,60,0.18)" : "0 6px 18px rgba(150,110,20,0.3)",
                  }}
                >
                  {quickVoiceActive ? L.voiceListening : <>{L.voiceSpeakOrder} <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, opacity: 0.72, border: "1px solid currentColor", borderRadius: 4, padding: "0 3px", verticalAlign: "middle", whiteSpace: "nowrap" }}>BÈTA</span></>}
                </button>
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 8 }}><button onClick={() => setShowVoiceExample(true)} style={{ background: "none", border: "none", color: "#c8941a", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 2px" }}>{L.voiceHowLink}</button></div>
          </div>
          </>
          )}

          {cartTotalItems === 0 && !orderEditing && (
            <div style={{ textAlign: "center", margin: "16px 6px 4px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#a89a6a" }}>
                {sessions.length === 0
                  ? L.emptyOrder1
                  : L.emptyOrderN}
              </div>
              {sessions.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 16 }}>
                  <button onClick={() => setView("rounds")} style={{ background: "none", border: "none", color: "#b3854a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: "2px 4px" }}>{L.toRoundsLink}</button>
                  <button onClick={() => setView("bill")} style={{ background: "none", border: "none", color: "#b3854a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: "2px 4px" }}>{L.toBillLink}</button>
                </div>
              )}
            </div>
          )}

          {/* "Bedoelde je...?" suggestie banner */}
          {voiceSuggestion && (
            <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(231,168,38,0.1),rgba(231,168,38,0.05))", border: "1px solid rgba(231,168,38,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 13 }}>
                {L.voiceSuggestPre}<b>{voiceSuggestion.suggested.emoji} {voiceSuggestion.suggested.name}</b>?
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={{ ...S.btn, ...S.btnPrimary, fontSize: 12, padding: "6px 12px" }} onClick={acceptVoiceSuggestion}>{L.confirmYes}</button>
                <button style={{ ...S.btn, fontSize: 12, padding: "6px 12px" }} onClick={dismissVoiceSuggestion}>{L.confirmNo}</button>
              </div>
            </div>
          )}

          {/* Laatst toegevoegd — ENKEL na spraak (via selector gaat het meteen naar de lijst) */}
          {lastAddedViaVoice && (() => {
            const shown = lastAddedDrinkIds.filter((id) => {
              const l = cart[id]
              if (!l || l.total <= 0) return false
              const assignedSum = Object.values(l.assignments).reduce((s, q) => s + q, 0)
              return assignedSum < l.total
            })
            if (shown.length === 0) return null
            return (
              <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(150,110,20,0.1),rgba(233,196,95,0.06))", border: "1px solid rgba(150,110,20,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#c98a00", textTransform: "uppercase", letterSpacing: 0.6 }}>{L.lastAddedTitle}</div>
                  <button
                    onClick={() => { setLastAddedDrinkIds([]); setLastAddedViaVoice(false) }}
                    style={{ background: "none", border: "none", color: "#b3a476", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2, flexShrink: 0 }}
                  >
                    {L.assignAllLater}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: shown.length > 3 ? "repeat(auto-fill, minmax(205px, 1fr))" : "1fr", gap: 8 }}>
                  {shown.map((id) => {
                    const d = drinks.find((dr) => dr.id === id)
                    const line = cart[id]
                    if (!d || !line) return null
                    return (
                      <div key={id} style={{ border: "1px solid rgba(150,110,20,0.14)", borderRadius: 12, padding: "8px 10px", background: "rgba(255,255,255,0.55)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{d.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                            {showPrices && <div style={{ fontSize: 10, color: "#999" }}>≈ €{(d.price * line.total).toFixed(2)}</div>}
                          </div>
                          <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 15 }} onClick={() => addToCart(d.id, -1)}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 800, minWidth: 18, textAlign: "center" }}>{line.total}</span>
                          <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 15, background: "rgba(150,110,20,0.15)" }} onClick={() => addToCart(d.id, 1)}>+</button>
                          <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13 }} onClick={() => removeFromCart(d.id)}>🗑️</button>
                        </div>
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
            <div style={{ ...S.card, padding: 0, overflow: "hidden", border: "1px solid rgba(214,158,20,0.18)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg,#f4c430,#f7d461)", padding: "12px 16px" }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#4a3a0a", display: "flex", alignItems: "center", gap: 8 }}>
                  {L.allOrdersInRound}{nextRoundLabel}
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#4a3a0a", background: "#fffef2", borderRadius: 20, padding: "1px 10px" }}>{cartTotalItems}</span>
                </span>
                <button style={{ background: "none", border: "none", color: "#7a5f14", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontWeight: 600 }} onClick={clearCart}>{L.clearAll}</button>
              </div>
              <div style={{ padding: 16 }}>
              {(() => {
                const entries = Object.entries(cart).filter(([, line]) => line.total > 0)
                const lastSet = new Set(lastAddedDrinkIds)
                const othersPresent = entries.some(([id]) => !lastSet.has(id))
                const ordered = [...entries.filter(([id]) => lastSet.has(id)), ...entries.filter(([id]) => !lastSet.has(id))]
                return (
                  <div style={{ display: "grid", gridTemplateColumns: ordered.length > 1 ? "repeat(auto-fill, minmax(230px, 1fr))" : "1fr", gap: 10 }}>
                    {ordered.map(([drinkId, line]) => {
                      const d = drinks.find((dr) => dr.id === drinkId)
                      if (!d) return null
                      const justAdded = lastSet.has(drinkId) && othersPresent // markeer nieuw toegevoegde tussen bestaande
                      return (
                        <div key={drinkId} style={{ border: justAdded ? "1.5px solid #ecc85a" : "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 10, background: justAdded ? "rgba(233,196,95,0.12)" : "transparent" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ fontSize: 19, flexShrink: 0 }}>{d.emoji}</span>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                            <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 14 }} onClick={() => addToCart(d.id, -1)}>−</button>
                            <span style={{ fontSize: 15, fontWeight: 800, minWidth: 20, textAlign: "center" }}>{line.total}</span>
                            <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 14, background: "rgba(150,110,20,0.12)" }} onClick={() => addToCart(d.id, 1)}>+</button>
                            <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13 }} onClick={() => removeFromCart(d.id)}>🗑️</button>
                          </div>
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

          {/* Onderaan: afronden (primair) + wijzigen (subtiel). Afronden staat rechts — daar
              verwacht de gebruiker de 'volgende/bevestig'-actie. */}
          {cartTotalItems > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginTop: 2, marginBottom: 14 }}>
              {!orderEditing && (
                <button
                  onClick={openDrinkSelectorEdit}
                  style={{ ...S.btn, flex: 0.6, padding: "13px 8px", fontSize: 13, fontWeight: 700, background: "#fffef9", border: "1.5px solid rgba(120,95,20,0.22)", color: "#8a7d55" }}
                >
                  {L.editOrderBtn}
                </button>
              )}
              <button
                onClick={() => setShowFinishConfirm(true)}
                style={{ ...S.btn, flex: 1.4, padding: "13px 8px", fontSize: 15, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#4a3f1e", boxShadow: "0 4px 14px rgba(233,196,95,0.45)" }}
              >
                {L.finishOrderBtn(cartTotalItems)}
              </button>
            </div>
          )}


          {/* Kiezer: begin met een vorig rondje */}
          {showReorderPicker && (
            <div style={S.overlay}>
              <div style={{ ...S.modal, width: 420, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
                <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, color: "#4a3f1e" }}>{L.reorderTitle}</h3>
                <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>{L.reorderSubA}<b>{L.reorderExact}</b>{L.reorderSubB}<b>{L.reorderAdjust}</b>.</p>
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
                                <span style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#5a4a1a,#7a6528)", color: "#f7d461", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{roundLabel(sess)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4a3f1e" }}>{L.roundLabelPre} {roundLabel(sess)}{isPrev && <span style={{ fontSize: 10, fontWeight: 800, color: "#a06b00", background: "rgba(233,196,95,0.25)", borderRadius: 10, padding: "1px 7px", marginLeft: 6 }}>{L.prevBadge}</span>}</div>
                                  <div style={{ fontSize: 11, color: "#a89a6a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{total} {total === 1 ? L.drink : L.drinks}{names ? ` — ${names}` : ""}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => { reorderFromSession(sess); setShowFinishConfirm(true) }}
                                  style={{ ...S.btn, flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#4a3f1e" }}
                                >
                                  {L.reorderExactBtn}
                                </button>
                                <button
                                  onClick={() => reorderFromSession(sess)}
                                  style={{ ...S.btn, flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid rgba(120,95,20,0.2)", color: "#8a7d55" }}
                                >
                                  {L.adjustBtn}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {olderCount > 0 && (
                          <button
                            onClick={() => setReorderShowAll((v) => !v)}
                            style={{ width: "100%", background: "none", border: "none", color: "#c8941a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "8px 0", textDecoration: "underline", textUnderlineOffset: 3 }}
                          >
                            {reorderShowAll ? L.reorderShowPrev : L.reorderShowOlder(olderCount)}
                          </button>
                        )}
                      </>
                    )
                  })()}
                </div>
                <button style={{ ...S.btn, width: "100%", padding: "11px 0" }} onClick={() => setShowReorderPicker(false)}>{L.cancelN}</button>
              </div>
            </div>
          )}

          {showFinishConfirm && (
            <div style={S.overlay}>
              <div style={{ ...S.modal, width: 360, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#4a3f1e", margin: "0 0 6px" }}>{L.finishConfirmTitle}</h3>
                <p style={{ fontSize: 13, color: "#777", marginBottom: 12 }}>
                  {L.finishConfirmSub(cartTotalItems, `${participants.length} ${participants.length === 1 ? L.person : L.people}`)}
                </p>
                <div style={{ textAlign: "left", maxHeight: 200, overflowY: "auto", marginBottom: 16, border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "6px 12px" }}>
                  {Object.entries(cart).filter(([, l]) => l.total > 0).map(([id, l]) => {
                    const d = drinks.find((dr) => dr.id === id)
                    if (!d) return null
                    return (
                      <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(150,110,20,0.05)" }}>
                        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{d.emoji} {d.name}</span>
                        <span style={{ fontWeight: 800, color: "#4a3f1e", flexShrink: 0, marginLeft: 8 }}>€{l.total}</span>
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
                  const primaryStyle = { ...S.btn, width: "100%", padding: "13px 0", fontSize: 15, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#4a3f1e", boxShadow: "0 4px 14px rgba(233,196,95,0.45)" }
                  const subtleStyle = { ...S.btn, width: "100%", padding: "11px 0", fontSize: 14, fontWeight: 700 }
                  const adjustBtn = (
                    <button style={unassigned > 0 ? primaryStyle : subtleStyle} onClick={() => setShowFinishConfirm(false)}>
                      {(unassigned > 0 ? "✏️ " : "✅ ") + L.orderAdjustBtn}
                    </button>
                  )
                  const finishBtn = (
                    <button style={unassigned > 0 ? subtleStyle : primaryStyle} onClick={() => { setShowFinishConfirm(false); finishRound() }}>
                      {unassigned > 0 ? L.finishAnyway : L.finishYes}
                    </button>
                  )
                  return (
                    <>
                      {unassigned > 0 && (
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", textAlign: "left", background: "rgba(224,107,94,0.1)", border: "1px solid rgba(224,107,94,0.5)", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                          <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
                          <span style={{ fontSize: 12.5, color: "#c0392b", lineHeight: 1.45, fontWeight: 600 }}>
                            <b>{unassigned} {unassigned === 1 ? L.drink : L.drinks}</b>{L.unassignedWarnB}<b>&ldquo;Fair Split&rdquo;</b>{L.unassignedWarnC}<b>&ldquo;{L.orderAdjustBtn}&rdquo;</b>{L.unassignedWarnD}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {unassigned > 0 ? <>{adjustBtn}{finishBtn}</> : <>{finishBtn}{adjustBtn}</>}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Modal: drankje selecteren (categorie-tabs + grid) */}
          {showDrinkSelector && (
            <div style={S.overlay}>
              <div style={{ ...S.modal, width: 460, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{L.selectDrinksBtn}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#a89a6a", whiteSpace: "nowrap" }}>{participants.length} {L.persAbbr}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#4a3a0a", background: "linear-gradient(135deg,#f4c430,#f7d461)", borderRadius: 20, padding: "3px 12px", whiteSpace: "nowrap" }}>{(selectorEditMode ? selectorTotal : cartTotalItems + selectorTotal)} {(selectorEditMode ? selectorTotal : cartTotalItems + selectorTotal) === 1 ? L.drink : L.drinks}</span>
                  </div>
                </div>

                {/* category tabs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginBottom: 10 }}>
                  {groupedDrinks.map(([cat]) => {
                    const isActive = activeCategory === cat || (activeCategory === null && cat === groupedDrinks[0]?.[0])
                    return (
                      <button key={cat} onClick={() => { setActiveCategory(cat); setSelectorSearch(""); setLastAddedCustomDrink(null) }} style={{ border: "none", borderRadius: 13, padding: "11px 6px", fontSize: 12.5, fontWeight: 700, lineHeight: 1.2, cursor: "pointer", minHeight: 46, background: isActive ? "linear-gradient(135deg,#f4c430,#f7d461)" : "#f3ecd6", color: isActive ? "#4a3a0a" : "#a08a4a", boxShadow: isActive ? "0 3px 10px -2px rgba(233,196,95,0.55)" : "none" }}>
                        {cat}
                      </button>
                    )
                  })}
                </div>

                {/* Zoekvak — over alle categorieën heen */}
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: 0.55, pointerEvents: "none" }}>🔍</span>
                  <input value={selectorSearch} onChange={(e) => setSelectorSearch(e.target.value)} placeholder={L.searchPlaceholder} style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 38, paddingRight: 34 }} />
                  {selectorSearch && <button onClick={() => setSelectorSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#b3a476", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0 }}>✕</button>}
                </div>

                {/* Melding na een zelf toegevoegd drankje: waar staat het nu */}
                {lastAddedCustomDrink && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(39,174,96,0.1)", border: "1px solid rgba(39,174,96,0.35)", borderRadius: 12, padding: "8px 11px", marginBottom: 8, fontSize: 12.5, color: "#1f8a4c", lineHeight: 1.4 }}>
                    <span style={{ flex: 1 }}>✅ <b>{lastAddedCustomDrink.name}</b> {L.customReady1}<b>{CATEGORY_LABELS[lastAddedCustomDrink.category] ?? lastAddedCustomDrink.category}</b>{L.customReady2}</span>
                    <button onClick={() => setLastAddedCustomDrink(null)} style={{ background: "none", border: "none", color: "#1f8a4c", fontSize: 14, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>✕</button>
                  </div>
                )}

                {/* grid */}
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {groupedDrinks.map(([cat, list]) => {
                    const words = normText(selectorSearch.trim()).split(/\s+/).filter(Boolean)
                    const shown = words.length ? list.filter((d) => words.every((w) => normText(d.name).includes(w))) : list
                    const isActive = words.length ? shown.length > 0 : (activeCategory === cat || (activeCategory === null && cat === groupedDrinks[0]?.[0]))
                    if (!isActive) return null
                    return (
                      <div key={cat} style={{ marginBottom: words.length ? 14 : 0 }}>
                        {words.length > 0 && <div style={{ fontSize: 11.5, fontWeight: 800, color: "#c98a00", marginBottom: 6, paddingBottom: 3, borderBottom: "1px solid rgba(233,196,95,0.3)" }}>{cat}</div>}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {shown.map((d) => {
                          const qty = selectorDraft[d.id] ?? 0
                          return (
                            <div key={d.id} style={{ background: qty > 0 ? "rgba(150,110,20,0.08)" : "#fffdf3", border: qty > 0 ? "1.5px solid rgba(150,110,20,0.35)" : "1px solid rgba(0,0,0,0.06)", borderRadius: 14, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 20 }}>{d.emoji}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{d.name}</span>
                                {showPrices && <span style={{ fontSize: 10, color: "#bbb" }}>≈ €{d.price.toFixed(2)}</span>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15 }} onClick={() => changeSelectorQty(d.id, -1)}>−</button>
                                <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{qty}</span>
                                <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 15, background: "rgba(150,110,20,0.12)" }} onClick={() => changeSelectorQty(d.id, 1)}>+</button>
                              </div>
                            </div>
                          )
                        })}
                        </div>
                      </div>
                    )
                  })}
                  {selectorSearch.trim() && !groupedDrinks.some(([, list]) => list.some((d) => normText(selectorSearch.trim()).split(/\s+/).filter(Boolean).every((w) => normText(d.name).includes(w)))) && (
                    <div style={{ textAlign: "center", color: "#a89a6a", fontSize: 13, padding: "24px 12px", lineHeight: 1.5 }}>{L.noDrinkFound}</div>
                  )}
                </div>

                <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 10, padding: "12px 0", fontWeight: 700 }} onClick={confirmDrinkSelector}>
                  {L.readyBtn(selectorTotal, Math.max(0, (selectorEditMode ? selectorTotal : cartTotalItems + selectorTotal) - participants.length))}
                </button>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => { setSelectorDraft({}); setSelectorEditMode(false); setLastAddedCustomDrink(null); setSelectorSearch(""); setShowDrinkSelector(false) }}
                    style={{ background: "none", border: "none", color: "#a89a6a", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "8px 6px", flexShrink: 0 }}
                  >
                    Annuleren
                  </button>
                  <button onClick={() => setShowAddDrink(true)} style={{ width: "62%", padding: "11px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: "#a89a6a", background: "rgba(244,196,48,0.09)", border: "2px dashed rgba(214,158,20,0.4)", borderRadius: 14 }}>
                    {L.addOwnDrinkBtn}
                  </button>
                </div>
                {drinks.some(isGroupDrink) && (
                  <div style={{ textAlign: "right", marginTop: 8 }}>
                    <button onClick={() => setShowEditDrinks(true)} style={{ background: "none", border: "none", color: "#b3854a", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: "2px 8px" }}>{L.manageOwnDrinks}</button>
                  </div>
                )}
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
                <span style={{ fontSize: 24, flexShrink: 0 }}>🍻</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#a06b00", fontWeight: 800 }}>Nog in de pot</span>
                    <span style={{ fontSize: 19, fontWeight: 800, color: potLeft > 0.01 ? "#4a3f1e" : "#e67e22" }}>€{potLeft.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(120,95,20,0.08)", borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#f3d27c,#ecc564)", borderRadius: 4, transition: "width 0.2s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 3 }}>€{potUsed.toFixed(2)} van €{potTotal.toFixed(2)} gebruikt{potLeft <= 0.01 ? " — pot is leeg" : ""}</div>
                </div>
                <button onClick={() => setShowPotOverview(true)} style={{ ...S.btn, flexShrink: 0, fontSize: 12, fontWeight: 800, padding: "8px 12px", border: "1.5px solid #ecc85a", background: "#fff", color: "#a06b00" }}>🫙 aanvullen</button>
              </div>
            )
          })()}

          {sessions.length === 0 && (
            cartTotalItems === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: 32, color: "#aaa" }}>
                Nog geen bestellingen. Ga naar &ldquo;Nieuwe bestelling&rdquo; om te starten.
              </div>
            ) : (
              <div style={{ ...S.card, textAlign: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#4a3f1e", marginBottom: 6 }}>Jouw bestelling werd nog niet afgerond</div>
                <div style={{ fontSize: 13, color: "#8a7d55", lineHeight: 1.5, marginBottom: 14 }}>Bekijk ze hier, pas eventueel nog aan en klik op &ldquo;Bestelling afronden&rdquo;.</div>
                <button onClick={() => setView("ordering")} style={{ ...S.btn, ...S.btnPrimary, padding: "10px 20px", fontWeight: 800 }}>🍻 Naar je bestelling</button>
              </div>
            )
          )}

          {sessions.length > 0 && cartTotalItems > 0 && (
            <div style={{ ...S.card, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, background: "rgba(224,107,94,0.07)", border: "1px solid rgba(224,107,94,0.4)" }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#c0392b", fontWeight: 600, lineHeight: 1.4 }}>Je hebt nog een niet-afgeronde bestelling ({cartTotalItems} {cartTotalItems === 1 ? "item" : "items"}).</div>
              <button onClick={() => setView("ordering")} style={{ ...S.btn, flexShrink: 0, fontSize: 12.5, fontWeight: 800, padding: "8px 12px" }}>Bekijk →</button>
            </div>
          )}

          {sessions.length > 1 && (() => {
            const everyOpen = openRounds !== null && sessions.every((s) => openRounds.includes(s))
            return (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                  onClick={() => setOpenRounds(everyOpen ? [] : sessions.slice())}
                  style={{ background: "none", border: "none", color: "#a89a6a", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
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
                    <span style={{ fontSize: 12, color: "#bbb", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", display: "inline-block" }}>▸</span>
                    <b style={{ fontSize: 16 }}>Ronde {roundLabel(s)}</b>
                    {isLatest && <span style={{ fontSize: 10, color: "#4a3f1e", background: "rgba(150,110,20,0.1)", borderRadius: 8, padding: "1px 8px", fontWeight: 700 }}>laatste</span>}
                    {(() => {
                      const open = orders.filter((o) => o.session === s && !o.participant_id).reduce((sum, o) => sum + o.quantity, 0)
                      if (open <= 0) return null
                      return <span style={{ fontSize: 10, color: "#e0685c", background: "rgba(224,107,94,0.12)", border: "1px solid rgba(224,107,94,0.35)", borderRadius: 8, padding: "1px 8px", fontWeight: 800 }}>{open} nog toe te wijzen!</span>
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
                    <button style={{ ...S.btn, fontSize: 12, padding: "4px 12px" }} onClick={(e) => { e.stopPropagation(); openPaymentEditor(s) }}>💶 Wie betaalde?</button>
                  ) : (
                    <div
                      onClick={(e) => { e.stopPropagation(); openPaymentEditor(s) }}
                      style={{ cursor: "pointer", fontSize: 13, color: "#444", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
                    >
                      <span style={{ color: "#888" }}>💶 Betaald</span>
                      {roundPayments.map((p) => {
                        const isPot = !p.participant_id
                        const person = participants.find((pa) => pa.id === p.participant_id)
                        return (
                          <span key={p.id} style={{ background: isPot ? "rgba(233,196,95,0.2)" : "rgba(39,174,96,0.1)", color: isPot ? "#a06b00" : "#1f8a4c", borderRadius: 10, padding: "2px 10px", fontWeight: 700 }}>
                            {isPot ? "🫙 via de pot" : (person?.name ?? "?")} — €{p.amount.toFixed(2)}
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
                      <div key={it.drink.id} style={{ marginTop: 8, padding: "6px 0", borderBottom: "1px solid rgba(150,110,20,0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <b style={{ fontSize: 13 }}>{it.drink.emoji} {it.drink.name} — {it.totalQty}</b>
                        </div>
                        <div style={{ marginLeft: 8, marginTop: 4 }}>
                          {Object.entries(it.people).map(([pid, info]) => (
                            <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 2 }}>
                              <span style={{ color: "#666" }}>{info.name} — {info.qty}</span>
                              {isEditing && (
                                <button title="terug naar nog toe te wijzen" style={{ ...S.iconBtn, width: 20, height: 20, fontSize: 11 }} onClick={() => unassignOrderQty(it.drink.id, pid, s, 1)}>↩</button>
                              )}
                            </div>
                          ))}
                          {it.anonymous > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }} onClick={(e) => e.stopPropagation()}>
                              <span style={{ fontSize: 11, color: "#e0685c", fontWeight: 600, flexShrink: 0 }}>{it.anonymous}× nog toe te wijzen!</span>
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
          {sessions.length > 0 && (
            <button onClick={() => setView("bill")} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 6, padding: "14px 0", fontSize: 15, fontWeight: 800 }}>🧾 Ga naar afrekenen →</button>
          )}
        </div>
      )}

      {/* Info-popup achter de ? bij de richtprijzen */}
      {showIndicatiefInfo && (
        <div style={{ ...S.overlay, zIndex: 2200 }} onClick={() => setShowIndicatiefInfo(false)}>
          <div style={{ ...S.modal, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#4a3f1e", display: "flex", alignItems: "center", gap: 8 }}>🏷️ Indicatieve richtprijs</h3>
            <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
              <b style={{ color: "#a89a6a" }}>Indicatieve richtprijs</b> is een pure schatting per drankje. <b style={{ color: "#c98a00" }}>Fair Split</b> verdeelt het verschil met wat er echt betaald werd tijdens de rondjes volgens wie wat dronk, niet zomaar gelijk over iedereen. <b>Veel eerlijker dus!</b>
            </p>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setShowIndicatiefInfo(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* Fair split — uitleg popup (ingekort) */}
      {fairInfoMode && (
        <div style={{ ...S.overlay, zIndex: 2200 }} onClick={() => setFairInfoMode(null)}>
          <div style={{ ...S.modal, width: 370 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#4a3f1e", display: "flex", alignItems: "center", gap: 8 }}>Hoe werkt Fair Split?</h3>
            <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
              Met <b style={{ color: "#c98a00" }}>Fair Split</b> delen we het totaalbedrag <b>NIET</b> door het aantal personen. Op basis van richtprijzen per drankje verdelen we de totaalprijs volgens wie wat dronk. <b>Niet perfect, wel veel eerlijker!</b>
            </p>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setFairInfoMode(null)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* Info-popup: spraakvoorbeeld */}
      {showVoiceExample && (
        <div style={{ ...S.overlay, zIndex: 2400 }} onClick={() => setShowVoiceExample(false)}>
          <div style={{ ...S.modal, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#4a3f1e", display: "flex", alignItems: "center", gap: 8 }}>🎤 Spreek je bestelling in</h3>
            <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
              Zeg bijvoorbeeld <b>&ldquo;2 pintjes&rdquo;</b> — klik daarna opnieuw en zeg <b>&ldquo;1 gin-tonic&rdquo;</b>, enz. Je kan zoveel drankjes na elkaar inspreken als je wil.
            </p>
            <div style={{ fontSize: 12, color: "#c8941a", fontWeight: 700, background: "rgba(214,158,20,0.1)", borderRadius: 8, padding: "9px 11px", margin: "12px 0 0", lineHeight: 1.5 }}>⚠️ Bèta — deze functie is nog in test en werkt nog niet altijd vlot. Kijk je bestelling na het inspreken zeker even na.</div>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setShowVoiceExample(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* Info-popup: iedereen evenveel */}
      {showEqualInfo && (
        <div style={{ ...S.overlay, zIndex: 2400 }} onClick={() => setShowEqualInfo(false)}>
          <div style={{ ...S.modal, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 17, fontWeight: 800, color: "#4a3f1e", display: "flex", alignItems: "center", gap: 8 }}>Iedereen evenveel</h3>
            <p style={{ fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
              De totale rekening wordt gelijk verdeeld over alle personen. Simpel &amp; snel maar minder eerlijk. Vergelijk zeker even met Fair split!
            </p>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontWeight: 800, marginTop: 16 }} onClick={() => setShowEqualInfo(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* Eigen bevestigings-popup (i.p.v. de kale browser-confirm) */}
      {confirmDialog && (
        <div style={{ ...S.overlay, zIndex: 2500 }} onClick={() => setConfirmDialog(null)}>
          <div style={{ ...S.modal, width: 360, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{confirmDialog.danger ? "⚠️" : "❓"}</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#4a3f1e", margin: "0 0 6px" }}>{confirmDialog.title}</h3>
            <p style={{ fontSize: 13.5, color: "#777", lineHeight: 1.5, margin: "0 0 18px" }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1, padding: "12px 0", fontWeight: 700 }} onClick={() => setConfirmDialog(null)}>{L.cancel}</button>
              <button
                style={{ ...S.btn, flex: 1, padding: "12px 0", fontWeight: 800, border: "none", color: confirmDialog.danger ? "#fff" : "#4a3a0a", background: confirmDialog.danger ? "linear-gradient(135deg,#e0685c,#d1483b)" : "linear-gradient(135deg,#f4c430,#f7d461)" }}
                onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn() }}
              >
                {confirmDialog.confirmLabel ?? L.confirmYes}
              </button>
            </div>
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
        const potName = L.potName
        const n = participants.length
        const allTotal = parseFloat((potAddAmount || "").replace(",", "."))
        const allPer = (!isNaN(allTotal) && allTotal > 0 && n > 0) ? allTotal / n : 0
        return (
          <div style={{ ...S.overlay, zIndex: 2200 }}>
            <div style={{ ...S.modal, width: 440, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <h3 style={{ marginBottom: 4, fontSize: 19, fontWeight: 800, color: "#4a3f1e" }}>{L.potOverviewTitle}</h3>
              <p style={{ fontSize: 12, color: "#999", marginTop: 0, marginBottom: 14 }}>{L.potOverviewSub}</p>

              {/* Stats */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(233,196,95,0.10)", borderRadius: 12, padding: "9px 4px" }}>
                  <div style={{ fontSize: 10, color: "#a06b00", fontWeight: 700 }}>{L.potStatContributed}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#4a3f1e" }}>€{potTotal.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(120,95,20,0.05)", borderRadius: 12, padding: "9px 4px" }}>
                  <div style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>{L.potStatUsed}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#a89a6a" }}>€{potUsed.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "rgba(39,174,96,0.10)", borderRadius: 12, padding: "9px 4px" }}>
                  <div style={{ fontSize: 10, color: "#1f8a4c", fontWeight: 700 }}>{L.potStatAvailable}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#27ae60" }}>€{potLeft.toFixed(2)}</div>
                </div>
              </div>

              {/* Potten (per inleg-moment) */}
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
                {batches.length === 0 && <div style={{ fontSize: 13, color: "#bbb", padding: "8px 0" }}>{L.potNoContributions}</div>}
                {batches.map((rows, i) => {
                  const bt = rows.reduce((s, r) => s + r.amount, 0)
                  return (
                    <div key={i} style={{ border: "1px solid rgba(233,196,95,0.4)", borderRadius: 14, padding: "10px 12px", marginBottom: 10, background: "rgba(233,196,95,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#a06b00" }}>{potName(i)}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#4a3f1e" }}>€{bt.toFixed(2)}</span>
                      </div>
                      {rows.map((r) => {
                        const who = r.participant_id ? (participants.find((p) => p.id === r.participant_id)?.name ?? "?") : L.potGeneral
                        return (
                          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                            <span style={{ fontSize: 14 }}>{r.participant_id ? "👤" : "🫙"}</span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#4a3f1e" }}>{who}</span>
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
                <div style={{ fontSize: 12, fontWeight: 800, color: "#a06b00", marginBottom: 8 }}>{L.potTopUp}</div>
                {participants.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#aaa" }}>{L.potAddPersonsFirst}</div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {["10", "15", "20"].map((v) => (
                        <button
                          key={v}
                          onClick={() => { setPotAddWarn(false); setPotAddBulk(v) }}
                          style={{ flex: 1, borderRadius: 10, padding: "8px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer", border: potAddBulk === v ? "1.5px solid #ecc85a" : "1px solid rgba(120,95,20,0.15)", background: potAddBulk === v ? "rgba(233,196,95,0.18)" : "#fff", color: potAddBulk === v ? "#a06b00" : "#8a7d55" }}
                        >
                          €{v}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, padding: "8px 10px", background: "#fff", border: "1px solid #ecc85a", borderRadius: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#4a3f1e" }}>€</span>
                      <input type="number" step="1" min="0" inputMode="numeric" placeholder={L.potAmountPlaceholder} value={potAddBulk} onChange={(e) => { setPotAddWarn(false); setPotAddBulk(e.target.value.replace(/[^\d]/g, "")) }} style={{ ...S.input, flex: 1, minWidth: 0 }} />
                      <span style={{ fontSize: 13, color: "#777" }}>{L.perPersonAbbr}</span>
                    </div>
                    <button
                      onClick={() => setPotAddPerPersonOpen((o) => !o)}
                      style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "none", border: "none", padding: "2px 0", marginBottom: 8, cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 11, color: "#bbb", transform: potAddPerPersonOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▸</span>
                      <span style={{ fontSize: 11, color: "#a06b00", fontWeight: 600 }}>{L.potPerPersonToggle}</span>
                    </button>
                    {potAddPerPersonOpen && (
                      <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 8 }}>
                        {participants.map((p) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                            <span style={{ color: "#999" }}>€</span>
                            <input type="number" step="1" min="0" inputMode="numeric" placeholder="0" value={potAddDraft[p.id] ?? ""} onChange={(e) => { setPotAddWarn(false); setPotAddDraft({ ...potAddDraft, [p.id]: e.target.value.replace(/[^\d]/g, "") }) }} style={{ ...S.input, width: 72 }} />
                          </div>
                        ))}
                      </div>
                    )}
                    {(() => {
                      const draftSum = Object.values(potAddDraft).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                      const bulk = parseFloat((potAddBulk || "").replace(",", ".")) || 0
                      const willAdd = draftSum > 0 ? draftSum : bulk * participants.length
                      return (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: "#4a3f1e", fontWeight: 700 }}>
                          <span>{L.potTotalAdd}</span>
                          <span>€{willAdd.toFixed(2)}</span>
                        </div>
                      )
                    })()}
                    {potAddWarn && (
                      <div style={{ fontSize: 12.5, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 10, padding: "8px 10px" }}>
                        ⚠️ {L.potAddWarnMsg}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn, flex: 1, padding: "12px 0", fontWeight: 700 }} onClick={() => setShowPotOverview(false)}>{L.cancelN}</button>
                <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "12px 0", fontWeight: 800 }} onClick={addToPot}>{L.add}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pot modal — gezamenlijke inleg vooraf */}
      {showPotModal && (
        <div style={{ ...S.overlay, zIndex: 2200 }}>
          <div style={{ ...S.modal, width: 400, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: "#4a3f1e" }}>🫙 {L.potLay}</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>{L.potModalSub}</p>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, padding: "10px 12px", background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#4a3f1e" }}>€</span>
              <input type="number" value={potBulk} onChange={(e) => setPotBulk(e.target.value)} style={{ ...S.input, width: 70 }} />
              <span style={{ fontSize: 13, color: "#777" }}>{L.perPersonAbbr}</span>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontSize: 13, padding: "8px 0" }} onClick={setPotForEveryone}>{L.add}</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
              {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>{L.potAddPersonsFirst}</div>}
              {participants.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: "#999" }}>€</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    placeholder="0"
                    value={potDraft[p.id] ?? ""}
                    onChange={(e) => { setPotWarn(false); const v = e.target.value.replace(/[^\d]/g, ""); setPotDraft((prev) => ({ ...prev, [p.id]: v })) }}
                    style={{ ...S.input, width: 80 }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14, color: "#4a3f1e", fontWeight: 700 }}>
              <span>{L.potTotalInPot}</span>
              <span>€{Object.values(potDraft).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)}</span>
            </div>

            {potWarn && (
              <div style={{ fontSize: 13, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, lineHeight: 1.45 }}>
                ⚠️ {L.potWarnPre}<b>{L.cancel}</b>.
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, padding: "10px 0" }} onClick={savePot}>{L.saveBtn}</button>
              <button style={{ ...S.btn, flex: 1, padding: "10px 0" }} onClick={() => { setPotWarn(false); setShowPotModal(false) }}>{L.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment editor modal */}
      {paymentEditRound !== null && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 380 }}>
            <h3 style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>🍻 Ronde {roundLabel(paymentEditRound)} — wie betaalde?</h3>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>Vul in hoeveel elke persoon betaalde, of zet het op &ldquo;De pot&rdquo;.</p>

            {/* De pot als betaler — enkel als er een pot is */}
            {(() => {
              const potUsedOther = payments.filter((p) => p.session >= 1 && !p.participant_id && p.session !== paymentEditRound).reduce((s, p) => s + p.amount, 0)
              const potAvailable = Math.max(0, potTotal - potUsedOther)
              if (potTotal <= 0) {
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(150,110,20,0.05)", border: "1px dashed rgba(120,95,20,0.2)", borderRadius: 12, marginBottom: 12 }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#aaa" }}>🫙 De pot</span>
                    <span style={{ fontSize: 12, color: "#bbb" }}>geen pot gelegd</span>
                    <button onClick={openPotModal} style={{ background: "none", border: "none", color: "#c98a00", fontSize: 12, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>+ leg een pot</button>
                  </div>
                )
              }
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 12 }}>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#4a3f1e" }}>🫙 De pot</span>
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
              <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>🍻 Ronde {roundLabel(roundFullscreen)}</h2>
              <button style={S.btn} onClick={() => setRoundFullscreen(null)}>✕ Sluiten</button>
            </div>
            {Object.values(getRoundGrouped(roundFullscreen)).map((it) => (
              <div key={it.drink.id} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "16px 20px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16 }}>
                <span style={{ fontSize: 40 }}>{it.drink.emoji}</span>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#333" }}>{it.totalQty}× {it.drink.name}</div>
                  <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>
                    {Object.values(it.people).map((p) => `${p.name} (${p.qty})`).join(", ")}
                    {it.anonymous > 0 && ` + ${it.anonymous} nog toe te wijzen`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Net afgeronde ronde — fullscreen bevestiging voor de barman + snel betalen */}
      {finishedRoundSnapshot && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 2100, overflowY: "auto", padding: 28 }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Rondje {roundLabel(finishedRoundSnapshot.session)}: overzicht</h2>
            </div>

            {/* Lijst van wat besteld is */}
            {(() => {
              const visible = Object.entries(finishedRoundSnapshot.cart).filter(([, line]) => line.total > 0)
              const multi = visible.length > 4
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

            {/* Snel betalen: bedrag + wie betaalde (chips, meerdere mag, incl. pot) */}
            {(() => {
              const round = finishedRoundSnapshot.session
              const potUsedOther = payments.filter((p) => p.session >= 1 && !p.participant_id && p.session !== round).reduce((s, p) => s + p.amount, 0)
              const potAvailable = Math.max(0, potTotal - potUsedOther)
              // Wie is er al aangeduid als betaler (een bedrag ingevuld)?
              const payerKeys = Object.entries(paymentDraft).filter(([, v]) => parseFloat(v || "") > 0).map(([k]) => k)
              const singlePayer = payerKeys.length <= 1
              const totalEntered = [POT_PAYER, ...participants.map((p) => p.id)].reduce((s, k) => s + (parseFloat(paymentDraft[k] || "") || 0), 0)

              return (
                <div style={{ marginTop: 22, padding: "16px 18px", background: "rgba(150,110,20,0.05)", borderRadius: 16, border: "1px solid rgba(150,110,20,0.15)" }}>
                  <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: "#4a3f1e" }}>💶 Wie betaalde dit rondje?</div>
                  <p style={{ fontSize: 12, color: "#a89a6a", margin: "0 0 12px" }}>Tik wie betaalde — daarna vul je het exacte bedrag in. Meestal 1 persoon, meerdere mag ook.</p>

                  {/* Wie betaalde? — chips: eerst de pot, dan de personen. Tik aan ? bedragveld verschijnt. */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {/* De pot als betaler — als eerste getoond */}
                    {potTotal > 0 ? (() => {
                      const active = (paymentDraft[POT_PAYER] ?? "") !== ""
                      return (
                        <>
                          <button
                            onClick={() => {
                              setPayWarn(false)
                              setPaymentDraft((prev) => {
                                const n = { ...prev }
                                if (n[POT_PAYER] !== undefined) delete n[POT_PAYER]
                                else n[POT_PAYER] = ""
                                return n
                              })
                            }}
                            style={{ border: active ? "1.5px solid #ecc85a" : "1px solid rgba(120,95,20,0.2)", background: active ? "rgba(233,196,95,0.25)" : "#fff", color: active ? "#a06b00" : "#8a7d55", borderRadius: 20, padding: "7px 14px", fontSize: 13, fontWeight: active ? 800 : 700, cursor: "pointer" }}
                          >
                            {active ? "✓ " : ""}🫙 De pot
                          </button>
                          <button onClick={() => setShowPotOverview(true)} title="Pot bekijken of aanvullen" style={{ border: "1px dashed rgba(120,95,20,0.3)", background: "rgba(150,110,20,0.04)", color: "#c98a00", borderRadius: 20, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                            + pot aanvullen
                          </button>
                        </>
                      )
                    })() : (
                      <button onClick={openPotModal} style={{ border: "1px dashed rgba(120,95,20,0.25)", background: "rgba(150,110,20,0.04)", color: "#c98a00", borderRadius: 20, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                        🫙 geen pot gelegd — + leg een pot
                      </button>
                    )}
                    {participants.map((p) => {
                      const active = (paymentDraft[p.id] ?? "") !== ""
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setPayWarn(false)
                            setPaymentDraft((prev) => {
                              const n = { ...prev }
                              if (n[p.id] !== undefined) delete n[p.id]
                              else n[p.id] = ""
                              return n
                            })
                          }}
                          style={{ border: active ? "1.5px solid #c8941a" : "1px solid rgba(120,95,20,0.2)", background: active ? "rgba(214,158,20,0.12)" : "#fff", color: active ? "#6b5a24" : "#8a7d55", borderRadius: 20, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                        >
                          {active ? "✓ " : ""}{p.name}
                        </button>
                      )
                    })}
                  </div>

                  {/* Bedragvelden voor wie aangetikt is */}
                  {(paymentDraft[POT_PAYER] !== undefined || participants.some((p) => paymentDraft[p.id] !== undefined)) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                      {paymentDraft[POT_PAYER] !== undefined && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fffdf6", border: "1.5px solid #ecc85a", borderRadius: 12 }}>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#a06b00" }}>🫙 De pot betaalde</span>
                          <span style={{ color: "#999" }}>€</span>
                          <input
                            type="number"
                            autoFocus={singlePayer}
                            placeholder="0"
                            value={paymentDraft[POT_PAYER] ?? ""}
                            onChange={(e) => {
                              setPayWarn(false)
                              const v = parseFloat(e.target.value)
                              const clamped = isNaN(v) ? e.target.value : String(Math.min(v, potAvailable))
                              setPaymentDraft((prev) => ({ ...prev, [POT_PAYER]: clamped }))
                            }}
                            style={{ ...S.input, width: 90 }}
                          />
                        </div>
                      )}
                      {participants.filter((p) => paymentDraft[p.id] !== undefined).map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fff", border: "1px solid rgba(214,158,20,0.3)", borderRadius: 12 }}>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#6b5a24", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name} betaalde</span>
                          <span style={{ color: "#999" }}>€</span>
                          <input
                            type="number"
                            autoFocus={singlePayer}
                            placeholder="0"
                            value={paymentDraft[p.id] ?? ""}
                            onChange={(e) => { setPayWarn(false); setPaymentDraft((prev) => ({ ...prev, [p.id]: e.target.value })) }}
                            style={{ ...S.input, width: 90 }}
                          />
                        </div>
                      ))}
                      {!singlePayer && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#a89a6a", fontWeight: 700, padding: "2px 4px" }}>
                          <span>Samen betaald</span>
                          <span>€{totalEntered.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {potTotal > 0 && paymentDraft[POT_PAYER] !== undefined && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.5)", borderRadius: 10, textAlign: "center", fontSize: 15, fontWeight: 800, color: "#a06b00" }}>🫙 nog €{potAvailable.toFixed(2)} beschikbaar in de pot</div>
                  )}
                </div>
              )
            })()}

            {/* Acties */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
              {payWarn && (
                <div style={{ fontSize: 13, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45 }}>
                  ⚠️ Geef eerst het betaalde bedrag in — via <b>de pot</b> of een <b>persoon</b>. Of kies <b>Later invullen</b>.
                </div>
              )}
              <button
                style={{ ...S.btn, width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 800, border: "none", background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#4a3f1e", boxShadow: "0 4px 14px rgba(233,196,95,0.45)" }}
                onClick={async () => {
                  if (!group) return
                  const round = finishedRoundSnapshot.session
                  const inserts = (Object.entries(paymentDraft) as [string, string][])
                    .filter(([key, amt]) => (key === POT_PAYER || participants.some((p) => p.id === key)) && parseFloat(amt) > 0)
                    .map(([key, amt]) => ({ group_id: group.id, session: round, participant_id: key === POT_PAYER ? null : key, amount: parseFloat(amt) }))
                  if (inserts.length === 0) { setPayWarn(true); return }
                  await supabase.from("payments").insert(inserts)
                  await reloadTable(group.id, "payments")
                  setPayWarn(false)
                  setPaymentDraft({})
                  setFinishedRoundSnapshot(null)
                  setBarmanStep("list")
                  setView("ordering")
                  setToast(`Ronde ${roundLabel(round)} afgerond!`)
                }}
              >
                💾 Opslaan &amp; sluiten
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13, background: "transparent", border: "1px solid rgba(120,95,20,0.2)", color: "#8a7d55" }}
                  onClick={adjustFinishedRound}
                >
                  ✏️ Bestelling aanpassen
                </button>
                <button
                  style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13, background: "transparent", border: "1px solid rgba(120,95,20,0.2)", color: "#8a7d55" }}
                  onClick={() => { setPayWarn(false); setPaymentDraft({}); setFinishedRoundSnapshot(null); setView("ordering"); setBarmanStep("list") }}
                >
                  Later invullen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VIEW: Totaal (wie dronk wat) ═══ */}
      {view === "bill" && (
        <div>
          {/* Overall drink overview — ALL orders, assigned or not (standaard ingeklapt) */}
          <div style={S.card}>
            <h3 onClick={() => setShowAllOrderedDrinks((v) => !v)} style={{ ...S.h3, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: showAllOrderedDrinks ? 14 : 0, cursor: "pointer" }}>
              📋 Alle bestelde drankjes
              {(() => { const tot = orders.reduce((s, o) => s + o.quantity, 0); return tot > 0 ? <span style={{ fontSize: 12, fontWeight: 800, color: "#4a3f1e", background: "#ecc85a", borderRadius: 20, padding: "1px 11px" }}>{tot} {tot === 1 ? "drankje" : "drankjes"}</span> : null })()}
              <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#b3854a", textDecoration: "underline", textUnderlineOffset: 3, whiteSpace: "nowrap" }}>{showAllOrderedDrinks ? "verberg ▴" : "toon drankjes ▾"}</span>
            </h3>
            {showAllOrderedDrinks && (() => {
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
                        : it.anonymousQty > 0 && <span style={{ fontSize: 10, color: "#e0685c", fontWeight: 600 }}>({it.anonymousQty} nog toe te wijzen!)</span>}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div style={S.card}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ ...S.h3, marginBottom: 6 }}>🧾 Wie dronk en betaalde wat?</h3>
              {(bill.totalActuallySpent > 0.01 || potTotal > 0) && (() => {
                const potUsed = payments.filter((p) => p.session >= 1 && !p.participant_id).reduce((s, p) => s + p.amount, 0)
                const potLeft = Math.max(0, potTotal - potUsed)
                return (
                  <div style={{ display: "flex", flexWrap: "nowrap", gap: 5, fontSize: 11, fontWeight: 700, overflowX: "auto", paddingBottom: 2 }}>
                    <span style={{ background: "rgba(39,174,96,0.1)", color: "#1f8a4c", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>✅ betaald €{bill.totalActuallySpent.toFixed(2)}</span>
                    {potTotal > 0 && <span style={{ background: "rgba(233,196,95,0.16)", color: "#a06b00", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>🫙 uit pot €{potUsed.toFixed(2)}</span>}
                    {potTotal > 0 && <span style={{ background: "rgba(120,95,20,0.05)", color: "#8a7d55", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>🫙 nog in pot €{potLeft.toFixed(2)}</span>}
                  </div>
                )
              })()}
            </div>

            <div style={{ marginTop: 4 }}>
              {/* Kolomtitels boven de twee prijskolommen (enkel bij kleine groep — bij 4+ staan labels in elke kaart) */}
              {showBillPrices && participants.length > 0 && participants.length < 4 && !compareOther && (
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 10, padding: "0 4px 6px" }}>
                  <div style={{ width: 66, textAlign: "right", fontSize: 10, color: "#aaa", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, lineHeight: 1.15 }}>
                    indicatieve prijs
                    <button onClick={() => setShowIndicatiefInfo(true)} title="Wat betekent dit?" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#b9b088", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>ℹ️</button>
                  </div>
                  <button onClick={() => setShowFairSplit((v) => !v)} title="Fair split tonen of verbergen" style={{ width: 158, textAlign: "center", fontSize: 11, fontWeight: 800, color: showFairSplit ? "#4a3f1e" : "#a06b00", background: showFairSplit ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "rgba(233,196,95,0.16)", border: showFairSplit ? "none" : "1px solid rgba(233,196,95,0.55)", borderRadius: 8, padding: "4px 0", letterSpacing: 0.5, boxShadow: showFairSplit ? "0 2px 8px rgba(233,196,95,0.4)" : "none", cursor: "pointer" }}>{showFairSplit ? (splitMode === "equal" ? "EVENVEEL ⇄" : "FAIR SPLIT ⇄") : "+ FAIR SPLIT"}</button>
                </div>
              )}
              {orders.some((o) => o.participant_id) && (
              <div style={participants.length >= 4 ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 2 } : undefined}>
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
                        {potInlegPerson > 0 && <span style={{ fontSize: 11, color: "#c98a00", fontWeight: 600 }}>— €{potInlegPerson.toFixed(2)} in de pot</span>}
                        {personalPaidPerson > 0.01 && <span style={{ fontSize: 11, color: "#27ae60", fontWeight: 600 }}>— €{personalPaidPerson.toFixed(2)} zelf betaald</span>}
                      </div>
                    </div>

                    {/* Drankjes + prijzen. Bij 4+ wrappen de prijzen onder de drankjes. */}
                    <div style={{ display: "flex", flexWrap: multiCol ? "wrap" : "nowrap", justifyContent: "space-between", alignItems: "flex-start", gap: multiCol ? 8 : 12 }}>
                      <div style={{ flex: multiCol ? "1 1 100%" : "1 1 0", minWidth: 0 }}>
                        {Object.values(drinkSummary).length === 0 ? (
                          <div style={{ fontSize: 12, color: "#bbb" }}>nog niets gedronken</div>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                            {Object.values(drinkSummary).map((ds) => (
                              <span key={ds.drink.id} style={{ background: "rgba(150,110,20,0.05)", borderRadius: 10, padding: "3px 10px", fontSize: 12 }}>
                                {ds.drink.emoji} {ds.qty}× {ds.drink.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {pricesVisible && (() => {
                        const compareOn = compareOther
                        const activeKind: "fair" | "equal" = splitMode === "fair" ? "fair" : "equal"
                        const otherKind: "fair" | "equal" = activeKind === "fair" ? "equal" : "fair"
                        const otherRows = otherKind === "fair" ? fairRows : equalRows
                        const otherSettled = otherKind === "fair" ? fairSettled : equalSettled
                        const otherComp = otherRows.find((f) => f.participantId === p.id)
                        const otherDebts = otherSettled.filter((t) => t.from === p.name)
                        const otherCredits = otherSettled.filter((t) => t.to === p.name)

                        // Verrekening ("verdeling") voor een gegeven verdeel-rij + bijhorende schulden
                        const renderSettle = (row: typeof fair, debts: typeof myDebts, credits: typeof myCredits) => {
                          if (!row || !row.participated) return null
                          const net = row.fairShare - paid
                          if (net > 0.01 && debts.length > 0) {
                            return <>{debts.map((t, i) => (
                              <div key={i} style={{ color: "#b35309", fontWeight: 800 }}>💸 betaalt €{t.amount.toFixed(2)} {t.to === "de pot" ? "in de pot" : `aan ${t.to}`}</div>
                            ))}</>
                          }
                          if (net < -0.01 && credits.length > 0) {
                            return <>{credits.map((t, i) => (
                              <div key={i} style={{ color: "#146c43", fontWeight: 800 }}>💰 Ontvangt €{t.amount.toFixed(2)} {t.from === "de pot" ? "uit de pot" : `van ${t.from}`}</div>
                            ))}</>
                          }
                          return <span style={{ color: "#6b5a24", fontWeight: 700 }}>⚖️ staat gelijk</span>
                        }

                        // Bedrag-kader met kleuridentiteit: Fair Split = blauwe rand + gouden vulling (zoals de knop),
                        // iedereen evenveel = amber. Zo zie je meteen welk bedrag bij welke methode hoort.
                        const splitBox = (kind: "fair" | "equal", row: typeof fair, debts: typeof myDebts, credits: typeof myCredits, compact: boolean, fullWidth = false) => {
                          if (!row || !row.participated) return null
                          const isFair = kind === "fair"
                          return (
                            <div style={{ width: fullWidth ? "100%" : (compact ? "auto" : 158), minWidth: (compact && !fullWidth) ? 100 : undefined, boxSizing: "border-box", textAlign: "center", background: isFair ? "linear-gradient(135deg,#f4c430,#f7d461)" : "rgba(232,126,20,0.12)", border: isFair ? "2px solid #3d6fd0" : "2px solid #e0842e", borderRadius: 12, padding: compact ? "5px 9px" : "7px 8px" }}>
                              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: isFair ? "#2f5bb0" : "#b5591a" }}>{isFair ? "fair split" : "evenveel"}</div>
                              <div style={{ fontSize: compact ? 16 : 19, fontWeight: 800, color: "#4a3f1e" }}>€{row.fairShare.toFixed(2)}</div>
                              <div style={{ fontSize: 10.5, marginTop: 2, lineHeight: 1.3 }}>{renderSettle(row, debts, credits)}</div>
                            </div>
                          )
                        }

                        const activeOk = showFairSplit && fair?.participated

                        if (multiCol) {
                          return (
                            <div style={{ width: "100%", borderTop: "1px solid rgba(0,0,0,0.07)", marginTop: 8, paddingTop: 7 }}>
                              <div style={{ fontSize: 11, color: "#aaa", marginBottom: activeOk ? 6 : 0 }}>indicatief <b style={{ color: "#a89a6a", fontWeight: 700 }}>€{drinkValue.toFixed(2)}</b></div>
                              {activeOk && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {splitBox(activeKind, fair, myDebts, myCredits, true, true)}
                                  {compareOn && splitBox(otherKind, otherComp, otherDebts, otherCredits, true, true)}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return (
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexShrink: 0 }}>
                            <div style={{ width: 66, textAlign: "right", paddingTop: 4 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#a89a6a" }}>€{drinkValue.toFixed(2)}</div>
                            </div>
                            {activeOk && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {splitBox(activeKind, fair, myDebts, myCredits, false)}
                                {compareOn && splitBox(otherKind, otherComp, otherDebts, otherCredits, false)}
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

              {/* Knoppen onder de drankjes: Eerlijke rekening + Iedereen evenveel */}
              {!showBillPrices && participants.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  {!canSplit ? (
                    /* Geen verdeling mogelijk: niets betaald, of nog een onbetaald rondje */
                    (() => {
                      const unpaidLabels = unpaidRounds.map((s) => roundLabel(s)).sort((a, b) => a - b)
                      const heeftRondes = sessions.length > 0
                      return (
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(224,107,94,0.08)", border: "1px solid rgba(224,107,94,0.35)", borderRadius: 14, padding: "13px 15px" }}>
                          <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
                          <div style={{ fontSize: 13, color: "#8a4b42", lineHeight: 1.5 }}>
                            {heeftRondes && unpaidLabels.length > 0 ? (
                              <>
                                <b>Nog geen verdeling mogelijk.</b> {unpaidLabels.length === 1 ? <>Rondje <b>{unpaidLabels[0]}</b> is</> : <>De rondjes <b>{unpaidLabels.join(", ")}</b> zijn</>} nog niet betaald. Zolang een rondje niet betaald is, klopt de verdeling niet — ook niet bij &ldquo;iedereen evenveel&rdquo;. Vul eerst in wie elk rondje betaalde bij <b>&ldquo;Overzicht Rondjes&rdquo;</b>.
                              </>
                            ) : (
                              <>
                                <b>Nog geen verdeling mogelijk.</b> Er is nog niet ingevuld wie wat betaalde (een persoon of de pot). Vul dat eerst in bij <b>&ldquo;Overzicht Rondjes&rdquo;</b> — daarna kan je hier de rekening verdelen.
                              </>
                            )}
                            <div style={{ marginTop: 10 }}>
                              <button onClick={() => { setOpenRounds(null); setView("rounds") }} style={{ ...S.btn, fontSize: 12.5, fontWeight: 800, padding: "8px 14px", background: "linear-gradient(135deg,#f4c430,#f7d461)", border: "none", color: "#4a3a0a" }}>📋 Naar Overzicht Rondjes</button>
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        {/* Eerlijke rekening met Fair split (groot, links) + info eronder */}
                        <div style={{ flex: 1.5, display: "flex", flexDirection: "column", gap: 7 }}>
                          <button
                            onClick={() => {
                              setSplitMode("fair")
                              setCompareOther(false)
                              const anon = orders.filter((o) => !o.participant_id && o.quantity > 0)
                              const unassigned = anon.reduce((s, o) => s + o.quantity, 0)
                              if (unassigned > 0) {
                                setAssignPopupDrinkIds(Array.from(new Set(anon.map((o) => o.drink_id))))
                                setShowAssignPopup(true)
                              } else { setShowBillPrices(true); setShowFairSplit(true) }
                            }}
                            style={{ width: "100%", border: "2.5px solid #3d6fd0", borderRadius: 14, padding: "12px 14px", cursor: "pointer", background: "linear-gradient(135deg,#f4c430,#f7d461)", boxShadow: "0 6px 16px -6px rgba(61,111,208,0.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}
                          >
                            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                              <RundoLogo size={18} />
                            </span>
                            <span style={{ fontSize: 14.5, fontWeight: 800, color: "#4a3a0a", lineHeight: 1.15 }}>Eerlijke rekening met Fair split</span>
                          </button>
                          <button
                            onClick={() => setFairInfoMode("what")}
                            style={{ background: "none", border: "none", color: "#2f5bb0", fontSize: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, width: "100%", textAlign: "center", padding: 0 }}
                          >
                            Hoe werkt Fair Split?
                          </button>
                        </div>

                        {/* Iedereen betaalt evenveel (smaller, rechts) + info eronder */}
                        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: 7 }}>
                          <button
                            onClick={() => {
                              setSplitMode("equal")
                              setCompareOther(false)
                              setShowBillPrices(true)
                              setShowFairSplit(true)
                            }}
                            style={{ width: "100%", border: "2.5px solid #e0842e", borderRadius: 14, padding: "12px 8px", cursor: "pointer", background: "linear-gradient(135deg,#fbcf98,#f6b25e)", color: "#8a4514", fontSize: 12.5, fontWeight: 800, lineHeight: 1.25, minHeight: 54, boxShadow: "0 4px 12px -6px rgba(224,132,46,0.6)" }}
                          >
                            Iedereen betaalt evenveel
                          </button>
                          <button
                            onClick={() => setShowEqualInfo(true)}
                            style={{ background: "none", border: "none", color: "#a08a4a", fontSize: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, width: "100%", textAlign: "center", padding: 0 }}
                          >
                            Iedereen evenveel?
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Klein kolomtotaal, uitgelijnd onder de kolommen (enkel bij kleine groep) */}
              {showBillPrices && participants.length > 0 && participants.length < 4 && !compareOther && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "8px 4px 2px", marginTop: 2 }}>
                  <div style={{ width: 66, textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "#aaa" }}>totaal</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#a89a6a" }}>€{bill.totalDrinkValue.toFixed(2)}</div>
                  </div>
                  {showFairSplit && (
                    <div style={{ width: 158, textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#1f8a4c" }}>totaal</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#27ae60" }}>€{bill.totalActuallySpent.toFixed(2)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Totalen + fair split-correctie */}
            {showBillPrices && participants.length > 0 && (() => {
              const indicatief = bill.totalDrinkValue
              const echtBetaald = bill.totalActuallySpent
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, background: "rgba(120,95,20,0.04)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <span>Indicatieve prijs <span style={{ fontSize: 9, color: "#bbb" }}>(totaal)</span></span>
                        <button onClick={() => setShowIndicatiefInfo(true)} title="Wat betekent dit?" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#b9c0cc", fontSize: 13, lineHeight: 1 }}>ℹ️</button>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#a89a6a" }}>€{indicatief.toFixed(2)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ background: "rgba(39,174,96,0.08)", borderRadius: 12, padding: "10px 12px", textAlign: "center", border: "1px solid rgba(39,174,96,0.25)" }}>
                        <div style={{ fontSize: 11, color: "#1f8a4c", marginBottom: 2 }}>Totaal betaald</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#27ae60" }}>€{echtBetaald.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Verdeling weer verbergen + de andere methode ernaast vergelijken (in beide modi) */}
            {showBillPrices && (
              <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "stretch" }}>
                <button onClick={() => { setShowBillPrices(false); setShowFairSplit(false); setCompareOther(false); setSplitMode("fair") }} style={{ flex: 1, background: "#fff", border: "1.5px solid rgba(120,95,20,0.25)", color: "#8a7d55", fontSize: 13.5, fontWeight: 800, cursor: "pointer", borderRadius: 16, padding: "13px 10px", lineHeight: 1.2 }}>
                  Terug
                </button>
                {(() => {
                  // In 'evenveel' vergelijk je met Fair Split (enkel als geldig); in Fair Split vergelijk je met 'evenveel'.
                  const canCompare = splitMode === "equal" ? canFairSplit : true
                  if (!canCompare) return null
                  const showsFair = splitMode === "equal" // de vergelijking toont de Fair Split (blauw) of 'evenveel' (oranje)
                  const label = compareOther
                    ? "Verberg vergelijking"
                    : (splitMode === "equal" ? "Vergelijk met Fair split" : "Vergelijk met iedereen evenveel")
                  return (
                    <button
                      onClick={() => setCompareOther((v) => !v)}
                      style={{ flex: 1, background: compareOther ? "#fff" : (showsFair ? "rgba(61,111,208,0.1)" : "rgba(232,126,20,0.12)"), border: showsFair ? "2px solid #3d6fd0" : "2px solid #e0842e", color: showsFair ? "#2f5bb0" : "#b5591a", fontSize: 13.5, fontWeight: 800, cursor: "pointer", borderRadius: 16, padding: "13px 10px", lineHeight: 1.2 }}
                    >
                      {label}
                    </button>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Popup: drankjes toewijzen vóór Fair Split (per rondje, compact) */}
          {showAssignPopup && (() => {
            // live: hoeveel staat er nu nog open (over alle drankjes)
            const liveUnassignedTotal = orders.filter((o) => !o.participant_id).reduce((s, o) => s + o.quantity, 0)
            // few-modus op basis van de snapshot bij openen ? drankjes blijven zichtbaar, ook na toewijzen
            const snapshotDrinks = assignPopupDrinkIds.map((id) => drinks.find((d) => d.id === id)).filter((d): d is Drink => !!d)
            const few = assignPopupDrinkIds.length > 0 && assignPopupDrinkIds.length <= 2
            return (
              <div style={S.overlay} onClick={() => setShowAssignPopup(false)}>
                <div style={{ ...S.modal, width: 420, maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                  {few ? (
                    <>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#4a3f1e", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>🎯 Toewijzen</h3>
                      <p style={{ fontSize: 13, color: "#777", marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
                        {liveUnassignedTotal > 0
                          ? <><b style={{ color: "#e0685c" }}>{liveUnassignedTotal} {liveUnassignedTotal === 1 ? "drankje" : "drankjes"} nog toe te wijzen.</b> Tik personen aan — meerdere mag.</>
                          : <>Alles toegewezen ✅ Je kan nog <b>wijzigen</b> of doorgaan naar Fair Split.</>}
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
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#4a3f1e", margin: "0 0 6px" }}>Alles toegewezen!</h3>
                      <p style={{ fontSize: 13, color: "#777", marginBottom: 18 }}>Je kan nu de eerlijke verdeling bekijken.</p>
                      <button
                        style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontWeight: 800 }}
                        onClick={() => { setShowAssignPopup(false); setShowBillPrices(true); setShowFairSplit(true) }}
                      >
                        Toon Fair Split ?
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: "#4a3f1e", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 8 }}>👉 Nog toe te wijzen</h3>
                      <p style={{ fontSize: 13, color: "#777", marginTop: 0, marginBottom: 16, lineHeight: 1.55 }}>
                        Er zijn nog <b style={{ color: "#e0685c" }}>{liveUnassignedTotal} {liveUnassignedTotal === 1 ? "drankje" : "drankjes"}</b> nog toe te wijzen. Wijs ze toe in <b>&ldquo;Alle bestelde drankjes&rdquo;</b> of in <b>&ldquo;Overzicht Rondjes&rdquo;</b>.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                          style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}
                          onClick={() => { setShowAssignPopup(false); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }) }}
                        >
                          Naar &ldquo;Alle bestelde drankjes&rdquo;
                        </button>
                        <button style={{ ...S.btn, width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 700, background: "rgba(214,158,20,0.1)", border: "1px solid rgba(214,158,20,0.3)", color: "#c8941a" }} onClick={() => { setOpenRounds(null); setShowAssignPopup(false); setView("rounds") }}>Naar &ldquo;Overzicht Rondjes&rdquo;</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 40, color: "#aaa", fontSize: 12 }}>
            {participants.length} personen — {sessions.length} rondes — {orders.reduce((s, o) => s + o.quantity, 0)} drankjes
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
  const [lang] = useLang()
  const L = STRINGS[lang]
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
        placeholder={L.addPersonNamePlaceholder}
        style={{ ...S.input, width: "100%", boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={{ ...S.btn, ...S.btnPrimary, flex: 1 }} onClick={submit}>{L.add}</button>
        <button style={{ ...S.btn, flex: 1 }} onClick={onClose}>{L.cancel}</button>
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
    background: "linear-gradient(180deg,#fffdf4 0%,#fdf3d4 55%,#fbedc2 100%)",
    minHeight: "100vh",
    color: "#4a3f1e",
    maxWidth: 720,
    margin: "0 auto",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  },
  card: {
    background: "#fffef9",
    border: "1px solid rgba(180,140,20,0.10)",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 1px 2px rgba(150,110,20,0.04), 0 14px 30px -16px rgba(180,140,20,0.28)",
    marginBottom: 14,
  },
  btn: {
    border: "1px solid rgba(120,95,20,0.14)",
    background: "#fffef9",
    borderRadius: 12,
    padding: "9px 16px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
    color: "#4a3f1e",
    boxShadow: "0 1px 2px rgba(150,110,20,0.06)",
    transition: "transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease",
  },
  btnPrimary: {
    background: "linear-gradient(135deg,#f4c430,#f7d461)",
    color: "#4a3a0a",
    border: "none",
    boxShadow: "0 6px 16px -6px rgba(214,158,20,0.6)",
  },
  iconBtn: {
    border: "none",
    background: "rgba(150,110,20,0.08)",
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
    border: "1.5px solid rgba(120,95,20,0.16)",
    borderRadius: 12,
    padding: "10px 13px",
    fontSize: 14,
    outline: "none",
    background: "#fffef9",
    color: "#4a3f1e",
    transition: "border-color .12s ease, box-shadow .12s ease",
  },
  h1: { fontSize: 29, fontWeight: 800, letterSpacing: -0.7, marginBottom: 4, color: "#5a4a1a" },
  h3: { fontSize: 16, fontWeight: 800, marginBottom: 14, letterSpacing: -0.3, color: "#6b5a24", display: "flex", alignItems: "center", gap: 9 },
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
    background: "#f5eccf",
    border: "1px solid rgba(214,158,20,0.28)",
    borderRadius: 16,
    padding: 6,
    marginBottom: 18,
    boxShadow: "0 4px 14px -6px rgba(150,110,20,0.25), inset 0 1px 2px rgba(150,110,20,0.06)",
  },
  stickyCart: {
    position: "fixed",
    bottom: 18,
    left: 16,
    right: 16,
    maxWidth: 720 - 32,
    margin: "0 auto",
    background: "rgba(255,253,244,0.9)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 20,
    padding: "14px 18px",
    boxShadow: "0 10px 40px -6px rgba(150,110,20,0.3)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 500,
    border: "1px solid rgba(180,140,20,0.12)",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(60,45,10,0.4)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)", padding: 16,
  },
  modal: {
    background: "#fffef9", borderRadius: 24, padding: 24, width: 360,
    boxShadow: "0 24px 70px -12px rgba(120,90,20,0.35)", maxHeight: "85vh", display: "flex", flexDirection: "column",
    border: "1px solid rgba(180,140,20,0.12)",
  },
  toast: {
    position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#4a3f1e", color: "#fff",
    padding: "11px 22px", borderRadius: 40, fontSize: 14, fontWeight: 600, zIndex: 2000,
    boxShadow: "0 10px 30px rgba(120,90,20,0.35)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center",
  },
  errorBanner: {
    background: "#fef2f2", border: "1px solid #fecaca", color: "#c0392b", borderRadius: 14, padding: "11px 16px",
    marginBottom: 14, display: "flex", alignItems: "center", fontSize: 14,
  },
}
