"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

type Order = {
  id: string
  participant_id: string
  drink_id: string
  quantity: number
  group_id: string
  session: number
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

// ─── Quick Order Types ───────────────────────────────────────────────────────

type QuickOrderDrink = {
  name: string
  qty: number
  emoji: string
  assignments: { participantId: string; qty: number }[]  // per-person assignment
}

type QuickOrderItem = {
  id: string
  text: string
  drinks: QuickOrderDrink[]
  timestamp: number
}

type SavedOrder = {
  id: string
  name: string
  items: QuickOrderItem[]
  savedAt: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Local storage helpers ────────────────────────────────────────────────────

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

// ─── Voice helpers ────────────────────────────────────────────────────────────

function guessCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return cat
  }
  return FALLBACK_CATEGORY
}

function extractPrice(text: string): string {
  const lower = text.toLowerCase()
  const numMatch = lower.match(/€?\s*(\d+)[.,](\d{1,2})/)
  if (numMatch) return `${numMatch[1]}.${numMatch[2].padEnd(2, "0")}`
  const euroMatch = lower.match(/€\s*(\d+)\b|(\d+)\s*euro/)
  if (euroMatch) return euroMatch[1] ?? euroMatch[2]
  const wordMap: Record<string, number> = {
    nul: 0, een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7,
    acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12, dertien: 13,
    veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18,
    negentien: 19, twintig: 20, anderhalf: 1.5,
  }
  const words = lower.split(/\s+/)
  for (let i = 0; i < words.length; i++) {
    const val = wordMap[words[i]]
    if (val === undefined) continue
    const next = words[i + 1]
    if (next === "euro" || next === "eur") return String(val)
    if (next === "vijftig" || next === "50") return `${val}.50`
    if (next === "tachtig" || next === "80") return `${val}.80`
    if (val > 0 && val <= 20) return String(val)
  }
  return ""
}

function cleanDrinkName(text: string): string {
  return text
    .replace(/€?\s*\d+[.,]\d{1,2}/g, "")
    .replace(/€\s*\d+/g, "")
    .replace(/\d+\s*euro/gi, "")
    .replace(/\b(een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf|dertien|veertien|vijftien|zestien|zeventien|achttien|negentien|twintig|anderhalf)\s*(euro|eur|vijftig|tachtig|50|80)?\b/gi, "")
    .replace(/\b(voor|prijs|kost|aan|van|alsjeblieft|graag|please|met)\b/gi, "")
    .replace(/\s+/g, " ").trim()
    .replace(/^./, (c) => c.toUpperCase())
}

// Parse spoken text into drink items for quick order
function parseSpokenDrinks(text: string): { name: string; qty: number; emoji: string }[] {
  const lower = text.toLowerCase()
    .replace(/één/g, "een")
    .replace(/twee/g, "twee")
    .replace(/cola's|colas/g, "cola")
    .replace(/pintjes|pintje/g, "pils")
    .replace(/biertjes|biertje/g, "pils")
    .replace(/wijntje/g, "wijn")

  const numberWords: Record<string, number> = {
    een: 1, twee: 2, drie: 3, vier: 4, vijf: 5,
    zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
  }

  // Each pattern must be listed most-specific FIRST
  const drinkPatterns: { words: string[]; name: string; emoji: string }[] = [
    { words: ["cola zero"],    name: "Cola Zero",      emoji: "🥤" },
    { words: ["cola light"],   name: "Cola Light",     emoji: "🥤" },
    { words: ["cola cherry"],  name: "Cola Cherry",    emoji: "🥤" },
    { words: ["cola"],         name: "Cola",           emoji: "🥤" },
    { words: ["pepsi"],        name: "Pepsi",          emoji: "🥤" },
    { words: ["fanta zero"],   name: "Fanta Zero",     emoji: "🥤" },
    { words: ["fanta"],        name: "Fanta",          emoji: "🥤" },
    { words: ["sprite"],       name: "Sprite",         emoji: "🥤" },
    { words: ["spa rood"],     name: "Spa Rood",       emoji: "💧" },
    { words: ["spa blauw", "plat water"], name: "Spa Blauw", emoji: "💧" },
    { words: ["water", "spa"], name: "Water",          emoji: "💧" },
    { words: ["ice tea", "ijsthee"], name: "Ice Tea",  emoji: "🥤" },
    { words: ["tonic"],        name: "Tonic",          emoji: "🥤" },
    { words: ["limonade"],     name: "Limonade",       emoji: "🥤" },
    { words: ["gin tonic", "gin-tonic"], name: "Gin Tonic", emoji: "🍸" },
    { words: ["mojito"],       name: "Mojito",         emoji: "🍸" },
    { words: ["hugo"],         name: "Hugo",           emoji: "🍸" },
    { words: ["aperol"],       name: "Aperol Spritz",  emoji: "🍸" },
    { words: ["whisky", "whiskey"], name: "Whisky",    emoji: "🥃" },
    { words: ["vodka"],        name: "Vodka",          emoji: "🍸" },
    { words: ["rum"],          name: "Rum",            emoji: "🍸" },
    { words: ["duvel"],        name: "Duvel",          emoji: "🍺" },
    { words: ["stella artois", "stella"], name: "Stella Artois", emoji: "🍺" },
    { words: ["jupiler"],      name: "Jupiler",        emoji: "🍺" },
    { words: ["leffe"],        name: "Leffe",          emoji: "🍺" },
    { words: ["tripel"],       name: "Tripel",         emoji: "🍺" },
    { words: ["pils", "pintje", "pintjes", "bier", "biertje"], name: "Pils", emoji: "🍺" },
    { words: ["rosé", "rose"], name: "Rosé",           emoji: "🍷" },
    { words: ["wijn"],         name: "Wijn",           emoji: "🍷" },
    { words: ["cava", "prosecco", "champagne"], name: "Cava", emoji: "🥂" },
  ]

  const results: { name: string; qty: number; emoji: string }[] = []

  // Work through the string, consuming matched segments
  let remaining = lower
  let safetyCounter = 0

  while (remaining.trim().length > 0 && safetyCounter < 20) {
    safetyCounter++
    remaining = remaining.trim()

    // Try to read a quantity word at the start
    let qty = 1
    let consumed = ""

    const qtyMatch = remaining.match(/^(\d+|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\s+/)
    if (qtyMatch) {
      qty = numberWords[qtyMatch[1]] ?? parseInt(qtyMatch[1]) ?? 1
      consumed = qtyMatch[0]
      remaining = remaining.slice(consumed.length)
    }

    // Try to match a drink name
    let matched = false
    for (const pattern of drinkPatterns) {
      for (const word of pattern.words) {
        if (remaining.startsWith(word)) {
          const existing = results.find((r) => r.name === pattern.name)
          if (existing) existing.qty += qty
          else results.push({ name: pattern.name, qty, emoji: pattern.emoji })
          remaining = remaining.slice(word.length)
          // skip connectors
          remaining = remaining.replace(/^\s*(en|met|ook|plus|,|en een|en twee)\s*/, "")
          matched = true
          break
        }
      }
      if (matched) break
    }

    if (!matched) {
      // Skip one word and try again
      const skip = remaining.match(/^(\S+)\s*/)
      if (skip) remaining = remaining.slice(skip[0].length)
      else break
    }
  }

  // Fallback: nothing matched at all
  if (results.length === 0 && text.trim()) {
    const cat = guessCategory(text)
    results.push({ name: cleanDrinkName(text) || text, qty: 1, emoji: EMOJI_MAP[cat] ?? "🍹" })
  }

  return results
  return results.map((r) => ({ ...r, assignments: [] }))
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function AddPersonModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const handleSubmit = () => { if (!name.trim()) return; onAdd(name.trim()); onClose() }
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Persoon toevoegen</h3>
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder="Naam..." style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ ...styles.button, ...styles.primary, flex: 1 }} onClick={handleSubmit}>Toevoegen</button>
          <button style={{ ...styles.button, flex: 1 }} onClick={onClose}>Annuleer</button>
        </div>
      </div>
    </div>
  )
}

function LibraryPickerModal({ library, existing, onClose, onAdd }: {
  library: DrinkLibraryItem[]; existing: Drink[]; onClose: () => void; onAdd: (item: DrinkLibraryItem, price: number) => void
}) {
  const [search, setSearch] = useState("")
  const [prices, setPrices] = useState<Record<string, string>>({})
  const filtered = library.filter((d) => {
    const q = search.toLowerCase()
    return d.name.toLowerCase().includes(q) || (d.search_tags ?? "").toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q)
  })
  const alreadyAdded = (item: DrinkLibraryItem) => existing.some((e) => e.name === item.name)
  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, width: 420, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 700 }}>📚 Uit bibliotheek</h3>
        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek op naam, categorie..." style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.map((item) => {
            const added = alreadyAdded(item)
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#999" }}>{item.category}</div>
                </div>
                <input type="number" placeholder={`€${item.default_price.toFixed(2)}`} value={prices[item.id] ?? ""} onChange={(e) => setPrices((p) => ({ ...p, [item.id]: e.target.value }))} style={{ ...styles.input, width: 72 }} disabled={added} />
                <button style={{ ...styles.button, ...(added ? {} : styles.primary), fontSize: 12, padding: "5px 10px" }} disabled={added} onClick={() => { const price = parseFloat(prices[item.id] ?? "") || item.default_price; onAdd(item, price) }}>
                  {added ? "✓" : "+ Voeg toe"}
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20 }}>Niets gevonden</div>}
        </div>
        <button style={{ ...styles.button, marginTop: 12, width: "100%" }} onClick={onClose}>Sluiten</button>
      </div>
    </div>
  )
}

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
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, textAlign: "center" }}>
        <h3 style={{ marginBottom: 6, fontSize: 18, fontWeight: 700 }}>📱 QR-code delen</h3>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Scan om direct deel te nemen aan groep <b>{inviteCode}</b></p>
        <div ref={containerRef} style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.08)", marginBottom: 16 }} />
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 8, color: "#2255cc", marginBottom: 20 }}>{inviteCode}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.button, flex: 1 }} onClick={() => navigator.clipboard?.writeText(inviteCode)}>📋 Kopieer code</button>
          <button style={{ ...styles.button, flex: 1 }} onClick={onClose}>Sluiten</button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [onDone])
  return <div style={styles.toast}>{message}</div>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  // ── State ──────────────────────────────────────────────────────────────────
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedSearch, setSavedSearch] = useState("")
  const [isSaved, setIsSaved] = useState(false)

  const [group, setGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [mode, setMode] = useState<"create" | "join">("create")
  const [started, setStarted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [library, setLibrary] = useState<DrinkLibraryItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [session, setSession] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [openPersonHistory, setOpenPersonHistory] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingPerson, setEditingPerson] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState("")

  const [newDrink, setNewDrink] = useState<DrinkForm>({ name: "", price: "", emoji: "", category: "Bier" })
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)

  // ── Quick Order state ─────────────────────────────────────────────────────
  const [showQuickOrder, setShowQuickOrder] = useState(false)
  const [quickItems, setQuickItems] = useState<QuickOrderItem[]>([])
  const [quickVoiceActive, setQuickVoiceActive] = useState(false)
  const [quickFullscreen, setQuickFullscreen] = useState(false)
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([])
  const [showSavedOrders, setShowSavedOrders] = useState(false)
  const [saveOrderName, setSaveOrderName] = useState("")
  const quickRecogRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any

  const [showAddPerson, setShowAddPerson] = useState(false)
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [showInviteCode, setShowInviteCode] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loadingDrink, setLoadingDrink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Voice ──────────────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>("idle")
  const [voiceTranscript, setVoiceTranscript] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null)

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setVoiceState("error"); setToast("Spraak niet ondersteund in deze browser"); return }
    const recog = new SR()
    recog.lang = "nl-BE"
    recog.interimResults = false
    recog.maxAlternatives = 1
    recogRef.current = recog
    recog.onstart = () => setVoiceState("listening")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      setVoiceTranscript(text)
      const category = guessCategory(text)
      const price = extractPrice(text)
      const name = cleanDrinkName(text) || text
      setNewDrink({ name, price, emoji: EMOJI_MAP[category] ?? "🍹", category })
      setVoiceState("done")
      setToast(`"${name}" herkend — controleer en klik Toevoegen`)
      setTimeout(() => setVoiceState("idle"), 3000)
    }
    recog.onerror = () => { setVoiceState("error"); setTimeout(() => setVoiceState("idle"), 2000) }
    recog.onend = () => { if (recogRef.current === recog) recogRef.current = null }
    recog.start()
  }

  const stopListening = () => { recogRef.current?.stop(); setVoiceState("idle") }

  // ── Loaders ────────────────────────────────────────────────────────────────
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
    const [{ data: p, error: pe }, { data: o, error: oe }] = await Promise.all([
      supabase.from("participants").select("*").eq("group_id", groupId),
      supabase.from("orders").select("*").eq("group_id", groupId),
    ])
    if (pe || oe) { setError("Data laden mislukt"); return }
    if (mounted.current) { setParticipants(p || []); setOrders(o || []) }
  }, [])

  useEffect(() => { loadDrinks(); loadLibrary() }, [loadDrinks, loadLibrary])
  useEffect(() => { setSavedGroups(getSavedGroups()) }, [])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!group) return
    const channel = supabase.channel(`group-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `group_id=eq.${group.id}` }, () => { if (mounted.current) loadAll(group.id) })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `group_id=eq.${group.id}` }, () => { if (mounted.current) loadAll(group.id) })
      .on("postgres_changes", { event: "*", schema: "public", table: "drinks" }, () => { if (mounted.current) loadDrinks() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [group, loadAll, loadDrinks])

  // ── Group ──────────────────────────────────────────────────────────────────
  const startGroup = async () => {
    if (!groupName.trim() || isStarting) return
    setIsStarting(true)
    try {
      const owner_id = getOrCreateOwnerId()
      const invite_code = generateInviteCode()
      const { data, error } = await supabase.from("groups").insert([{ name: groupName.trim(), invite_code, owner_id }]).select().single()
      if (error || !data) { setError("Groep aanmaken mislukt: " + error?.message); return }
      setGroup(data)
      setStarted(true)
      setShowInviteCode(true)
      await loadAll(data.id)
      saveGroupToStorage(data)
      setSavedGroups(getSavedGroups())
      setIsSaved(true)
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
      setStarted(true)
      await loadAll(data.id)
      setIsSaved(getSavedGroups().some((g) => g.id === data.id))
    } finally { setIsStarting(false) }
  }

  const addPerson = async (name: string) => {
    if (!group) return
    const { error } = await supabase.from("participants").insert([{ name, group_id: group.id }])
    if (error) { setError("Persoon toevoegen mislukt"); return }
    setToast(`${name} toegevoegd`)
    await loadAll(group.id)
  }

  // ── Person CRUD ────────────────────────────────────────────────────────────
  const deletePerson = async (id: string, name: string) => {
    if (!group || !confirm(`${name} verwijderen? Hun bestellingen blijven bewaard.`)) return
    const { error } = await supabase.from("participants").delete().eq("id", id)
    if (error) { setError("Persoon verwijderen mislukt"); return }
    setSelected((prev) => prev.filter((x) => x !== id))
    if (openPersonHistory === id) setOpenPersonHistory(null)
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

  // ── Person select ──────────────────────────────────────────────────────────
  const togglePerson = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    const multi = e.shiftKey || e.ctrlKey || e.metaKey || multiSelectMode
    setSelected((prev) => {
      if (!multi) return prev.includes(id) && prev.length === 1 ? [] : [id]
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    })
  }

  const handlePersonTouchStart = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setMultiSelectMode(true)
      setSelected((prev) => prev.includes(id) ? prev : [...prev, id])
    }, 500)
  }

  const handlePersonTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  const exitMultiSelect = () => { setMultiSelectMode(false); setSelected([]) }

  // ── Order helpers ──────────────────────────────────────────────────────────
  const applyDrinkChange = (prev: Order[], pid: string, drink: Drink, delta: number, sess: number, groupId: string): Order[] => {
    const idx = prev.findIndex((o) => o.participant_id === pid && o.drink_id === drink.id && o.session === sess)
    if (delta > 0) {
      if (idx === -1) return [...prev, { id: `temp-${Date.now()}-${pid}`, participant_id: pid, drink_id: drink.id, quantity: 1, group_id: groupId, session: sess }]
      const u = [...prev]; u[idx] = { ...u[idx], quantity: u[idx].quantity + 1 }; return u
    }
    if (delta < 0 && idx !== -1) {
      const newQty = prev[idx].quantity - 1
      if (newQty <= 0) return prev.filter((_, i) => i !== idx)
      const u = [...prev]; u[idx] = { ...u[idx], quantity: newQty }; return u
    }
    return prev
  }

  const syncDrinkChange = async (drink: Drink, delta: number, pid: string, sess: number, groupId: string) => {
    const existing = orders.find((o) => o.participant_id === pid && o.drink_id === drink.id && o.session === sess)
    if (delta > 0) {
      if (!existing) await supabase.from("orders").insert([{ participant_id: pid, drink_id: drink.id, quantity: 1, group_id: groupId, session: sess }])
      else await supabase.from("orders").update({ quantity: existing.quantity + 1 }).eq("id", existing.id)
    } else if (delta < 0 && existing) {
      const newQty = existing.quantity - 1
      if (newQty <= 0) await supabase.from("orders").delete().eq("id", existing.id)
      else await supabase.from("orders").update({ quantity: newQty }).eq("id", existing.id)
    }
  }

  const changeDrink = async (drink: Drink, delta: number, pidOverride?: string) => {
    if (!group) return
    const targets = pidOverride ? [pidOverride] : selected
    if (!targets.length) { setToast("Selecteer eerst een persoon"); return }
    setLoadingDrink(`${drink.id}-${delta}`)
    setOrders((prev) => { let next = prev; for (const pid of targets) next = applyDrinkChange(next, pid, drink, delta, session, group.id); return next })
    try { await Promise.all(targets.map((pid) => syncDrinkChange(drink, delta, pid, session, group.id))); await loadAll(group.id) }
    catch { setError("Order bijwerken mislukt"); await loadAll(group.id) }
    finally { setLoadingDrink(null) }
  }

  const changeDrinkHistory = async (drink: Drink, delta: number, pid: string, round: number) => {
    if (!group) return
    setOrders((prev) => applyDrinkChange(prev, pid, drink, delta, round, group.id))
    try { await syncDrinkChange(drink, delta, pid, round, group.id); await loadAll(group.id) }
    catch { setError("Historiek bijwerken mislukt"); await loadAll(group.id) }
  }

  // ── Quick Order ───────────────────────────────────────────────────────────────

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
      const drinks = parseSpokenDrinks(text)
      const item: QuickOrderItem = { id: randomId(), text, drinks, timestamp: Date.now() }
      setQuickItems((prev) => [...prev, item])
      setQuickVoiceActive(false)
    }
    recog.onerror = () => setQuickVoiceActive(false)
    recog.onend = () => setQuickVoiceActive(false)
    recog.start()
  }

  const stopQuickVoice = () => { quickRecogRef.current?.stop(); setQuickVoiceActive(false) }

  const processQuickItem = async (item: QuickOrderItem) => {
    if (!group) return
    // Check all drinks have at least one assignment
    const allAssigned = item.drinks.every((d) => d.assignments.length > 0 && d.assignments.reduce((s, a) => s + a.qty, 0) > 0)
    if (!allAssigned) { setToast("Wijs eerst alle drankjes toe aan een persoon"); return }

    // Start a new round for this quick order
    const newRoundSession = nextSession
    setSession(newRoundSession)

    for (const spokenDrink of item.drinks) {
      const matchedDrink = drinks.find((d) =>
        d.name.toLowerCase() === spokenDrink.name.toLowerCase() ||
        d.name.toLowerCase().includes(spokenDrink.name.toLowerCase()) ||
        spokenDrink.name.toLowerCase().includes(d.name.toLowerCase())
      )
      if (!matchedDrink) continue
      for (const assignment of (spokenDrink.assignments ?? [])) {
        if (assignment.qty <= 0) continue
        for (let i = 0; i < assignment.qty; i++) {
          await syncDrinkChange(matchedDrink, 1, assignment.participantId, newRoundSession, group.id)
        }
      }
    }
    await loadAll(group.id)
    removeQuickItem(item.id)
    setToast(`Bestelling verwerkt in ronde ${newRoundSession}`)
  }

  const updateDrinkAssignment = (itemId: string, drinkIdx: number, participantId: string, qty: number) => {
    setQuickItems((prev) => prev.map((qi) => {
      if (qi.id !== itemId) return qi
      const newDrinks = qi.drinks.map((d, i) => {
        if (i !== drinkIdx) return d
        const existing = (d.assignments ?? []).find((a) => a.participantId === participantId)
        let newAssignments
        if (qty <= 0) {
          newAssignments = (d.assignments ?? []).filter((a) => a.participantId !== participantId)
        } else if (existing) {
          newAssignments = (d.assignments ?? []).map((a) => a.participantId === participantId ? { ...a, qty } : a)
        } else {
          newAssignments = [...(d.assignments ?? []), { participantId, qty }]
        }
        return { ...d, assignments: newAssignments }
      })
      return { ...qi, drinks: newDrinks }
    }))
  }

  const assignedQty = (item: QuickOrderItem, drinkIdx: number) =>
    (item.drinks[drinkIdx]?.assignments ?? []).reduce((s, a) => s + a.qty, 0)

  const removeQuickItem = (id: string) => setQuickItems((prev) => prev.filter((i) => i.id !== id))

  const clearQuickItems = () => { setQuickItems([]); setSaveOrderName("") }

  const saveQuickOrder = () => {
    if (!saveOrderName.trim() || quickItems.length === 0) { setToast("Geef een naam en voeg items toe"); return }
    const order: SavedOrder = { id: randomId(), name: saveOrderName.trim(), items: quickItems, savedAt: Date.now() }
    const existing = JSON.parse(localStorage.getItem("rondje_saved_orders") || "[]")
    existing.unshift(order)
    localStorage.setItem("rondje_saved_orders", JSON.stringify(existing.slice(0, 10)))
    setSavedOrders(existing.slice(0, 10))
    setSaveOrderName("")
    setToast("Bestelling opgeslagen!")
  }

  const loadSavedOrders = () => {
    const existing = JSON.parse(localStorage.getItem("rondje_saved_orders") || "[]")
    setSavedOrders(existing)
    setShowSavedOrders(true)
  }

  const deleteSavedOrder = (id: string) => {
    const updated = savedOrders.filter((o) => o.id !== id)
    localStorage.setItem("rondje_saved_orders", JSON.stringify(updated))
    setSavedOrders(updated)
  }

  const loadOrderIntoQuick = (order: SavedOrder) => {
    setQuickItems(order.items)
    setShowSavedOrders(false)
    setToast(`"${order.name}" geladen`)
  }

  // Quick order totals
  const quickDrinkSummary = () => {
    const map: Record<string, { name: string; qty: number; emoji: string }> = {}
    quickItems.forEach((item) => {
      item.drinks.forEach((d) => {
        if (!map[d.name]) map[d.name] = { name: d.name, qty: 0, emoji: d.emoji }
        map[d.name].qty += d.qty
      })
    })
    return Object.values(map)
  }

  // ── Drink CRUD ─────────────────────────────────────────────────────────────
  const addDrink = async () => {
    const { name, price, emoji, category } = newDrink
    if (!name.trim() || !price) { setToast("Vul naam en prijs in"); return }
    const { error } = await supabase.from("drinks").insert([{ name: name.trim(), price: parseFloat(price), emoji: emoji || "🍹", category: category || FALLBACK_CATEGORY }])
    if (error) { setError("Drank toevoegen mislukt: " + error.message); return }
    setNewDrink({ name: "", price: "", emoji: "", category: newDrink.category })
    setVoiceTranscript("")
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

  const deleteDrink = async (id: string) => {
    if (!confirm("Verwijderen?")) return
    const { error } = await supabase.from("drinks").delete().eq("id", id)
    if (error) { setError("Drank verwijderen mislukt"); return }
    await loadDrinks()
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const getPersonTotal = (pid: string) => orders.filter((o) => o.participant_id === pid).reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)
  const getPersonSessionTotal = (pid: string, sess: number) => orders.filter((o) => o.participant_id === pid && o.session === sess).reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)
  const getRoundTotal = (r: number) => orders.filter((o) => o.session === r).reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)
  const getGlobalTotal = () => orders.reduce((sum, o) => sum + (drinks.find((d) => d.id === o.drink_id)?.price || 0) * o.quantity, 0)

  const getActivePersonDrinks = (pid: string) =>
    orders.filter((o) => o.participant_id === pid && o.session === session).reduce((acc: (Drink & { qty: number })[], o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      if (!d) return acc
      const ex = acc.find((x) => x.id === d.id)
      if (ex) { ex.qty += o.quantity; return acc }
      return [...acc, { ...d, qty: o.quantity }]
    }, [])

  const getRoundGrouped = (r: number) => {
    const map: Record<string, { drink: Drink; totalQty: number; people: Record<string, { name: string; qty: number }> }> = {}
    orders.filter((o) => o.session === r).forEach((o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      const p = participants.find((pa) => pa.id === o.participant_id)
      if (!d || !p) return
      if (!map[d.id]) map[d.id] = { drink: d, totalQty: 0, people: {} }
      map[d.id].totalQty += o.quantity
      if (!map[d.id].people[p.id]) map[d.id].people[p.id] = { name: p.name, qty: 0 }
      map[d.id].people[p.id].qty += o.quantity
    })
    return map
  }

  const getPersonRoundsHistory = (pid: string) => {
    const per = orders.filter((o) => o.participant_id === pid)
    const ids = Array.from(new Set(per.map((o) => o.session))).sort((a, b) => a - b)
    return ids.map((r) => {
      const items = per.filter((o) => o.session === r).map((o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)
        return d ? { drink: d, quantity: o.quantity, subtotal: d.price * o.quantity } : null
      }).filter(Boolean) as { drink: Drink; quantity: number; subtotal: number }[]
      return { roundId: r, items, roundTotal: items.reduce((s, i) => s + i.subtotal, 0) }
    })
  }

  const sessions = Array.from(new Set(orders.map((o) => o.session))).sort((a, b) => a - b)
  const nextSession = Math.max(session, ...sessions, 0) + 1
  const newRound = () => { setSession(nextSession); setSelected([]); setToast(`Ronde ${nextSession} gestart`) }
  const groupedDrinks = groupDrinksByCategory(drinks)

  // ─── Start screen ──────────────────────────────────────────────────────────
  if (!started) {
    const filteredSaved = savedGroups.filter((g) => g.name.toLowerCase().includes(savedSearch.toLowerCase()))
    return (
      <div style={styles.container}>
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🍺</div>
            <h2 style={{ ...styles.title, marginBottom: 6 }}>Rondje Bijhouden</h2>
            <p style={{ color: "#888", fontSize: 14 }}>Maak een groep aan of sluit je aan met een code</p>
          </div>

          {/* Saved groups - collapsible */}
          {savedGroups.length > 0 && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <button onClick={() => setSavedOpen((o) => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}>
                <b style={{ fontSize: 14, color: "#555" }}>📌 Opgeslagen groepen</b>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{savedGroups.length} groep{savedGroups.length !== 1 ? "en" : ""}</span>
                  <span style={{ fontSize: 12, color: "#aaa", display: "inline-block", transform: savedOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
                </div>
              </button>
              {savedOpen && (
                <div style={{ marginTop: 12 }}>
                  <input value={savedSearch} onChange={(e) => setSavedSearch(e.target.value)} placeholder="🔍 Zoek groep..." style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 10, fontSize: 13 }} />
                  {filteredSaved.length === 0 && <div style={{ color: "#aaa", fontSize: 13, textAlign: "center", padding: 8 }}>Geen resultaten</div>}
                  {filteredSaved.map((g) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderRadius: 10, borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 1 }}>{g.invite_code}</div>
                      </div>
                      <button style={{ ...styles.button, ...styles.primary, fontSize: 12, padding: "5px 12px" }} onClick={() => joinGroup(g.invite_code)} disabled={isStarting}>Openen</button>
                      <button style={styles.iconButton} title="Verwijderen uit lijst" onClick={() => { removeGroupFromStorage(g.id); setSavedGroups(getSavedGroups()) }}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create / Join */}
          <div style={styles.card}>
            <div style={{ display: "flex", background: "#f0f2f5", borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {(["create", "join"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, border: "none", borderRadius: 10, padding: "9px 0", fontSize: 14, cursor: "pointer", fontWeight: mode === m ? 700 : 400, background: mode === m ? "#fff" : "transparent", color: mode === m ? "#333" : "#888", boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                  {m === "create" ? "✨ Nieuwe groep" : "🔗 Deelnemen"}
                </button>
              ))}
            </div>
            {mode === "create" ? (
              <>
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startGroup()} placeholder="Groepsnaam (bv. Vrijdagavond)" style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
                <button style={{ ...styles.button, ...styles.primary, width: "100%", padding: "12px 0", fontSize: 16 }} onClick={startGroup} disabled={isStarting}>{isStarting ? "Laden..." : "Start groep"}</button>
              </>
            ) : (
              <>
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && joinGroup()} placeholder="Uitnodigingscode (bv. AB12CD)" maxLength={6} style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 12, letterSpacing: 3, textAlign: "center", fontSize: 18, fontWeight: 700 }} />
                <button style={{ ...styles.button, ...styles.primary, width: "100%", padding: "12px 0", fontSize: 16 }} onClick={() => joinGroup()} disabled={isStarting}>{isStarting ? "Zoeken..." : "Deelnemen"}</button>
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

  // ─── Main app ──────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }`}</style>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontWeight: 700 }}>✕</button>
        </div>
      )}
      {showAddPerson && <AddPersonModal onClose={() => setShowAddPerson(false)} onAdd={addPerson} />}
      {showLibraryPicker && <LibraryPickerModal library={library} existing={drinks} onClose={() => setShowLibraryPicker(false)} onAdd={addDrinkFromLibrary} />}
      {showQR && group && <QRModal inviteCode={group.invite_code} onClose={() => setShowQR(false)} />}

      {/* Invite code banner */}
      {showInviteCode && group && (
        <div style={{ ...styles.card, background: "linear-gradient(90deg,#eef3ff,#f0f8ff)", border: "1.5px solid #c5d8ff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#7090cc", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Uitnodigingscode</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 6, color: "#2255cc" }}>{group.invite_code}</div>
            <div style={{ fontSize: 11, color: "#99aacc" }}>Deel deze code om anderen te laten deelnemen</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowQR(true)} style={{ ...styles.button, fontSize: 13 }}>📱 QR</button>
            <button onClick={() => { navigator.clipboard?.writeText(group.invite_code); setToast("Code gekopieerd!") }} style={{ ...styles.button, fontSize: 13 }}>📋 Kopieer</button>
            <button onClick={() => setShowInviteCode(false)} style={{ ...styles.iconButton, fontSize: 16 }}>✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={styles.title}>🍻 {group?.name}</h2>
          {!showInviteCode && (
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button onClick={() => setShowInviteCode(true)} style={{ ...styles.button, fontSize: 12, padding: "3px 10px" }}>🔗 {group?.invite_code}</button>
              <button onClick={() => setShowQR(true)} style={{ ...styles.button, fontSize: 12, padding: "3px 10px" }}>📱 QR</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#333" }}>€{getGlobalTotal().toFixed(2)}</span>
          <span style={{ fontSize: 12, color: "#888" }}>Ronde {session}: €{getRoundTotal(session).toFixed(2)}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
        <button style={{ ...styles.button, ...styles.primary }} onClick={() => setShowAddPerson(true)}>+ Persoon</button>
        <button style={styles.button} onClick={newRound}>🔄 Nieuwe ronde ({session} → {nextSession})</button>
        <button
          style={{ ...styles.button, marginLeft: "auto", fontSize: 13, background: isSaved ? "#f0fff4" : "#fff", color: isSaved ? "#27ae60" : "#555", border: isSaved ? "1px solid #a8e6c0" : "1px solid rgba(0,0,0,0.09)" }}
          onClick={() => {
            if (!group) return
            if (isSaved) { removeGroupFromStorage(group.id); setSavedGroups(getSavedGroups()); setIsSaved(false); setToast("Groep verwijderd uit opgeslagen") }
            else { saveGroupToStorage(group); setSavedGroups(getSavedGroups()); setIsSaved(true); setToast("Groep opgeslagen!") }
          }}
        >
          {isSaved ? "✅ Opgeslagen" : "📌 Sla groep op"}
        </button>
      </div>

      {/* Multi-select banner */}
      {multiSelectMode && (
        <div style={{ background: "linear-gradient(90deg,#4f7ef7,#6ba1ff)", borderRadius: 14, padding: "10px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            ✓ {selected.length} geselecteerd — tik een drank om te bestellen
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setSelected(participants.map((p) => p.id))}
              style={{ background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 12, cursor: "pointer" }}
            >
              Iedereen
            </button>
            <button
              onClick={exitMultiSelect}
              style={{ background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 12, cursor: "pointer" }}
            >
              ✕ Stop
            </button>
          </div>
        </div>
      )}

      {/* Persons */}
      <div style={styles.section}>
        <h3 style={styles.h3}>
          👤 Personen
          {selected.length > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: "#4f7ef7", marginLeft: 10 }}>{selected.length} geselecteerd — klik op een drank om te bestellen</span>}
        </h3>
        {participants.length === 0 && <div style={{ ...styles.card, color: "#999", textAlign: "center", padding: 32 }}>Nog geen personen. Voeg er een toe!</div>}
        {participants.map((p) => {
          const isSelected = selected.includes(p.id)
          return (
            <div key={p.id} style={{ ...styles.card, border: isSelected ? "2px solid #4f7ef7" : "1px solid rgba(0,0,0,0.06)", padding: isSelected ? 15 : 16, transition: "border 0.15s" }}>

              {/* Inline rename form */}
              {editingPerson === p.id && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: "4px 8px" }}>
                  <input
                    autoFocus
                    value={editingPersonName}
                    onChange={(e) => setEditingPersonName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") renamePerson(); if (e.key === "Escape") setEditingPerson(null) }}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  <button style={{ ...styles.button, ...styles.primary }} onClick={renamePerson}>💾</button>
                  <button style={styles.button} onClick={() => setEditingPerson(null)}>✖</button>
                </div>
              )}

              <div
                onClick={(e) => togglePerson(p.id, e)}
                onTouchStart={() => handlePersonTouchStart(p.id)}
                onTouchEnd={handlePersonTouchEnd}
                onTouchMove={handlePersonTouchEnd}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: isSelected ? "rgba(79,126,247,0.07)" : "transparent", borderRadius: 10, padding: "6px 8px", userSelect: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isSelected && <span style={{ fontSize: 12, color: "#4f7ef7" }}>✓</span>}
                  <b style={{ fontSize: 15 }}>{p.name}</b>
                </div>
                <div style={{ flex: 1, marginLeft: 12, fontSize: 13, color: "#555" }}>
                  {getActivePersonDrinks(p.id).map((d) => <span key={d.id} style={{ marginRight: 10 }}>{d.emoji} {d.name} × {d.qty}</span>)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ textAlign: "right", marginRight: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>€{getPersonTotal(p.id).toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>ronde: €{getPersonSessionTotal(p.id, session).toFixed(2)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setOpenPersonHistory((h) => h === p.id ? null : p.id) }} style={styles.iconButton} title="Historiek">📋</button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingPerson(p.id); setEditingPersonName(p.name) }} style={styles.iconButton} title="Naam wijzigen">✏️</button>
                  <button onClick={(e) => { e.stopPropagation(); deletePerson(p.id, p.name) }} style={styles.iconButton} title="Verwijderen">🗑️</button>
                </div>
              </div>

              {openPersonHistory === p.id && (
                <div style={styles.dropPanel}>
                  <b style={{ fontSize: 14 }}>Historiek {p.name}</b>
                  {getPersonRoundsHistory(p.id).length === 0 && <div style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>Geen bestellingen</div>}
                  {getPersonRoundsHistory(p.id).map((r) => (
                    <div key={r.roundId} style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#444" }}>Ronde {r.roundId} — €{r.roundTotal.toFixed(2)}</div>
                      {r.items.map((it, i) => <div key={i} style={{ fontSize: 12, marginLeft: 12, marginTop: 2, color: "#666" }}>{it.drink.emoji} {it.drink.name} × {it.quantity} = €{it.subtotal.toFixed(2)}</div>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Drinks */}
      <div style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...styles.h3, marginBottom: 0 }}>🍹 Drankjes</h3>
          <button style={{ ...styles.button, fontSize: 13 }} onClick={() => setShowLibraryPicker(true)}>📚 Uit bibliotheek</button>
        </div>
        {drinks.length === 0 && <div style={{ ...styles.card, color: "#999", textAlign: "center", padding: 24 }}>Nog geen drankjes. Voeg ze toe of gebruik de bibliotheek.</div>}
        {groupedDrinks.map(([cat, list]) => (
          <div key={cat} style={styles.card}>
            <b style={{ display: "block", marginBottom: 10, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, color: "#888" }}>{cat}</b>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {list.map((d: Drink) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {editingDrink?.id === d.id ? (
                    <>
                      <input value={editingDrink.emoji} onChange={(e) => setEditingDrink({ ...editingDrink, emoji: e.target.value })} style={{ ...styles.input, width: 52 }} />
                      <input value={editingDrink.name} onChange={(e) => setEditingDrink({ ...editingDrink, name: e.target.value })} style={{ ...styles.input, width: 120 }} />
                      <input type="number" value={editingDrink.price} onChange={(e) => setEditingDrink({ ...editingDrink, price: parseFloat(e.target.value) || 0 })} style={{ ...styles.input, width: 70 }} />
                      <select value={editingDrink.category ?? FALLBACK_CATEGORY} onChange={(e) => setEditingDrink({ ...editingDrink, category: e.target.value })} style={{ ...styles.input, width: 110 }}>
                        {Object.keys(CATEGORY_LABELS).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button style={{ ...styles.button, ...styles.primary }} onClick={saveEditedDrink}>💾</button>
                      <button style={styles.button} onClick={() => setEditingDrink(null)}>✖</button>
                    </>
                  ) : (
                    <>
                      <button style={styles.iconButton} onClick={() => changeDrink(d, -1)} disabled={loadingDrink !== null}>➖</button>
                      <button style={{ ...styles.button, fontSize: 13, opacity: loadingDrink !== null ? 0.7 : 1 }} onClick={() => changeDrink(d, 1)} disabled={loadingDrink !== null}>
                        {d.emoji} {d.name}<span style={{ color: "#888", marginLeft: 4 }}>€{d.price.toFixed(2)}</span>
                      </button>
                      <button style={styles.iconButton} onClick={() => setEditingDrink(d)} title="Bewerken">✏️</button>
                      <button style={styles.iconButton} onClick={() => deleteDrink(d.id)} title="Verwijderen">🗑️</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add drink form */}
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#555" }}>+ Drank toevoegen</h4>
            <button
              onClick={voiceState === "listening" ? stopListening : startListening}
              title={voiceState === "listening" ? "Stop opname" : "Spreek een dranknaam in"}
              style={{ ...styles.button, fontSize: 13, background: voiceState === "listening" ? "#e74c3c" : voiceState === "done" ? "#27ae60" : voiceState === "error" ? "#e74c3c" : "#fff", color: voiceState !== "idle" ? "#fff" : "#333", border: "none", boxShadow: voiceState === "listening" ? "0 0 0 3px rgba(231,76,60,0.25)" : "none", animation: voiceState === "listening" ? "pulse 1.2s infinite" : "none", transition: "background 0.2s" }}
            >
              {voiceState === "listening" && "🔴 Luistert..."}
              {voiceState === "done" && "✅ Herkend!"}
              {voiceState === "error" && "❌ Niet beschikbaar"}
              {voiceState === "idle" && "🎤 Inspreken"}
            </button>
          </div>
          {voiceTranscript && voiceState !== "idle" && (
            <div style={{ fontSize: 12, color: "#888", fontStyle: "italic", marginBottom: 8, padding: "4px 8px", background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
              Gehoord: &ldquo;{voiceTranscript}&rdquo;
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Naam" value={newDrink.name} onChange={(e) => setNewDrink({ ...newDrink, name: e.target.value })} style={{ ...styles.input, width: 140 }} />
            <input type="number" placeholder="Prijs €" value={newDrink.price} onChange={(e) => setNewDrink({ ...newDrink, price: e.target.value })} style={{ ...styles.input, width: 90 }} />
            <input placeholder="Emoji 🍹" value={newDrink.emoji} onChange={(e) => setNewDrink({ ...newDrink, emoji: e.target.value })} style={{ ...styles.input, width: 80 }} />
            <select value={newDrink.category} onChange={(e) => setNewDrink({ ...newDrink, category: e.target.value })} style={{ ...styles.input, width: 120 }}>
              {Object.keys(CATEGORY_LABELS).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button onClick={addDrink} style={{ ...styles.button, ...styles.primary }}>Toevoegen</button>
          </div>
        </div>
      </div>

      {/* Quick Order */}
      <div style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ ...styles.h3, marginBottom: 0 }}>🎤 Snel bestellen</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...styles.button, fontSize: 13 }} onClick={loadSavedOrders}>📋 Opgeslagen</button>
            {quickItems.length > 0 && (
              <button style={{ ...styles.button, fontSize: 13 }} onClick={() => setQuickFullscreen(true)}>🔍 Volledig scherm</button>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: quickItems.length > 0 ? 16 : 0 }}>
            <button
              onClick={quickVoiceActive ? stopQuickVoice : startQuickVoice}
              style={{
                ...styles.button,
                ...(quickVoiceActive ? {} : styles.primary),
                fontSize: 15,
                padding: "10px 20px",
                background: quickVoiceActive ? "#e74c3c" : undefined,
                color: quickVoiceActive ? "#fff" : undefined,
                border: "none",
                animation: quickVoiceActive ? "pulse 1.2s infinite" : "none",
                boxShadow: quickVoiceActive ? "0 0 0 4px rgba(231,76,60,0.2)" : undefined,
                flex: 1,
              }}
            >
              {quickVoiceActive ? "🔴 Luistert... (tik om te stoppen)" : "🎤 Tik om bestellingen in te spreken"}
            </button>
          </div>

          {quickItems.length > 0 && (
            <>
              {/* Per recording */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {quickItems.map((item, idx) => (
                  <div key={item.id} style={{ background: "rgba(79,126,247,0.05)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(79,126,247,0.1)", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "#aaa" }}>Opname {idx + 1}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button style={{ ...styles.button, ...styles.primary, fontSize: 11, padding: "3px 12px" }} onClick={() => processQuickItem(item)}>
                          ✓ Verwerk in nieuwe ronde
                        </button>
                        <button style={styles.iconButton} onClick={() => removeQuickItem(item.id)}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#777", fontStyle: "italic", marginBottom: 10 }}>&ldquo;{item.text}&rdquo;</div>

                    {/* Per-drink assignment */}
                    {item.drinks.map((d, drinkIdx) => {
                      const totalAssigned = assignedQty(item, drinkIdx)
                      const remaining = d.qty - totalAssigned
                      return (
                        <div key={drinkIdx} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", marginBottom: 8, border: "1px solid rgba(0,0,0,0.06)" }}>
                          {/* Drink header with edit */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <select
                              value={d.name}
                              onChange={(e) => {
                                const picked = drinks.find((dr) => dr.name === e.target.value)
                                if (!picked) return
                                setQuickItems((prev) => prev.map((qi) => qi.id === item.id
                                  ? { ...qi, drinks: qi.drinks.map((dr, di) => di === drinkIdx ? { ...dr, name: picked.name, emoji: picked.emoji, assignments: [] } : dr) }
                                  : qi
                                ))
                              }}
                              style={{ ...styles.input, flex: 1, fontWeight: 600 }}
                            >
                              {drinks.map((dr) => <option key={dr.id} value={dr.name}>{dr.emoji} {dr.name}</option>)}
                              {!drinks.find((dr) => dr.name === d.name) && (
                                <option value={d.name}>{d.emoji} {d.name} (niet in lijst)</option>
                              )}
                            </select>
                            <div style={{ fontSize: 13, fontWeight: 700, color: remaining > 0 ? "#e74c3c" : "#27ae60", minWidth: 80, textAlign: "right" }}>
                              {totalAssigned}/{d.qty} toegewezen
                            </div>
                          </div>

                          {/* Person assignment buttons */}
                          {participants.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {participants.map((p) => {
                                const pAssignment = d.assignments.find((a) => a.participantId === p.id)
                                const pQty = pAssignment?.qty ?? 0
                                return (
                                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, background: pQty > 0 ? "rgba(79,126,247,0.08)" : "rgba(0,0,0,0.03)", borderRadius: 20, padding: "3px 8px 3px 10px", border: pQty > 0 ? "1px solid rgba(79,126,247,0.3)" : "1px solid rgba(0,0,0,0.06)" }}>
                                    <span style={{ fontSize: 12, fontWeight: pQty > 0 ? 700 : 400, color: pQty > 0 ? "#4f7ef7" : "#666" }}>{p.name}</span>
                                    <button style={{ ...styles.iconButton, width: 20, height: 20, fontSize: 11, marginLeft: 0 }} onClick={() => updateDrinkAssignment(item.id, drinkIdx, p.id, Math.max(0, pQty - 1))}>−</button>
                                    <span style={{ fontSize: 12, fontWeight: 700, minWidth: 14, textAlign: "center", color: pQty > 0 ? "#4f7ef7" : "#aaa" }}>{pQty}</span>
                                    <button style={{ ...styles.iconButton, width: 20, height: 20, fontSize: 11, marginLeft: 0 }} onClick={() => updateDrinkAssignment(item.id, drinkIdx, p.id, Math.min(d.qty, pQty + 1))}>+</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Add extra drink */}
                    <button
                      style={{ ...styles.button, fontSize: 12, marginTop: 4 }}
                      onClick={() => {
                        const first = drinks[0]
                        if (!first) return
                        setQuickItems((prev) => prev.map((qi) => qi.id === item.id
                          ? { ...qi, drinks: [...qi.drinks, { name: first.name, qty: 1, emoji: first.emoji, assignments: [] }] }
                          : qi
                        ))
                      }}
                    >
                      + Drank toevoegen
                    </button>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Totaaloverzicht</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {quickDrinkSummary().map((d) => (
                    <span key={d.name} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20, padding: "4px 12px", fontSize: 14, fontWeight: 700 }}>
                      {d.emoji} {d.qty}× {d.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Save & clear */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  placeholder="Naam om op te slaan (bv. Ronde 1)..."
                  value={saveOrderName}
                  onChange={(e) => setSaveOrderName(e.target.value)}
                  style={{ ...styles.input, flex: 1, minWidth: 160 }}
                />
                <button style={{ ...styles.button, ...styles.primary }} onClick={saveQuickOrder}>💾 Sla op</button>
                <button style={{ ...styles.button, color: "#e74c3c" }} onClick={clearQuickItems}>🗑️ Wis alles</button>
              </div>
            </>
          )}

          {quickItems.length === 0 && (
            <div style={{ color: "#bbb", fontSize: 13, textAlign: "center", marginTop: 8 }}>
              Tik op de knop en spreek je bestelling in — bv. &ldquo;twee pintjes en een gin tonic&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Saved orders modal */}
      {showSavedOrders && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, width: 420, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 700 }}>📋 Opgeslagen bestellingen</h3>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {savedOrders.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 24 }}>Geen opgeslagen bestellingen</div>}
              {savedOrders.map((order) => (
                <div key={order.id} style={{ ...styles.card, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <b style={{ fontSize: 14 }}>{order.name}</b>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ ...styles.button, ...styles.primary, fontSize: 12, padding: "4px 10px" }} onClick={() => loadOrderIntoQuick(order)}>Laden</button>
                      <button style={styles.iconButton} onClick={() => deleteSavedOrder(order.id)}>🗑️</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {order.items.flatMap((i) => i.drinks).reduce((acc: {name:string;qty:number;emoji:string}[], d) => {
                      const ex = acc.find((x) => x.name === d.name)
                      if (ex) { ex.qty += d.qty; return acc }
                      return [...acc, { ...d }]
                    }, []).map((d) => (
                      <span key={d.name} style={{ background: "rgba(79,126,247,0.08)", borderRadius: 20, padding: "2px 10px", fontSize: 12 }}>
                        {d.emoji} {d.qty}× {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button style={{ ...styles.button, marginTop: 12, width: "100%" }} onClick={() => setShowSavedOrders(false)}>Sluiten</button>
          </div>
        </div>
      )}

      {/* Fullscreen quick order */}
      {quickFullscreen && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 2000, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🧾 Bestellijst</h2>
              <button style={styles.button} onClick={() => setQuickFullscreen(false)}>✕ Sluiten</button>
            </div>
            {quickItems.map((item, idx) => (
              <div key={item.id} style={{ marginBottom: 16, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>Persoon / tafel {idx + 1}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {item.drinks.map((d, i) => (
                    <span key={i} style={{ fontSize: 18, fontWeight: 700, background: "#f5f7ff", borderRadius: 12, padding: "6px 14px" }}>
                      {d.emoji} {d.qty > 1 ? `${d.qty}× ` : ""}{d.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 24, padding: "16px 20px", background: "linear-gradient(90deg,#4f7ef7,#6ba1ff)", borderRadius: 16, color: "#fff" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Totaal</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {quickDrinkSummary().map((d) => (
                  <span key={d.name} style={{ fontSize: 20, fontWeight: 800, background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "6px 16px" }}>
                    {d.emoji} {d.qty}× {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round history */}
      <div style={styles.section}>
        <h3 style={styles.h3}>📦 Ronde historiek</h3>
        {sessions.length === 0 && <div style={{ ...styles.card, color: "#999", textAlign: "center", padding: 24 }}>Nog geen bestellingen geplaatst.</div>}
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {sessions.map((s) => (
            <div key={s} style={{ ...styles.card, minWidth: 280, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b style={{ fontSize: 15 }}>Ronde {s}</b>
                <span style={{ fontWeight: 700, color: "#4f7ef7" }}>€{getRoundTotal(s).toFixed(2)}</span>
              </div>
              {Object.values(getRoundGrouped(s)).map((it) => (
                <div key={it.drink.id} style={{ marginTop: 10 }}>
                  <b style={{ fontSize: 13 }}>{it.drink.emoji} {it.drink.name} × {it.totalQty}</b>
                  <div style={{ marginLeft: 10, marginTop: 4 }}>
                    {Object.entries(it.people).map(([pid, info]) => (
                      <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 2 }}>
                        <span style={{ color: "#555" }}>{info.name} × {info.qty}</span>
                        <div>
                          <button style={styles.iconButton} onClick={() => changeDrinkHistory(it.drink, -1, pid, s)}>➖</button>
                          <button style={styles.iconButton} onClick={() => changeDrinkHistory(it.drink, 1, pid, s)}>➕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "right", marginTop: 32, paddingBottom: 40 }}>
        <h3 style={{ fontSize: 22, color: "#333", fontWeight: 700 }}>💰 Totaal: €{getGlobalTotal().toFixed(2)}</h3>
        <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
          {participants.length} personen · {sessions.length} rondes · {orders.reduce((s, o) => s + o.quantity, 0)} drankjes
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 24, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "linear-gradient(145deg,#f0f4ff,#e8eeff,#f8fafc)", minHeight: "100vh", color: "#222", maxWidth: 960, margin: "0 auto" },
  card: { background: "rgba(255,255,255,0.82)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, backdropFilter: "blur(14px)", padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", marginBottom: 12 },
  button: { border: "1px solid rgba(0,0,0,0.09)", background: "#fff", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 14, transition: "opacity 0.15s" },
  primary: { background: "linear-gradient(90deg,#4f7ef7,#6ba1ff)", color: "white", border: "none", boxShadow: "0 4px 14px rgba(79,126,247,0.3)" },
  iconButton: { border: "none", background: "rgba(0,0,0,0.04)", borderRadius: "50%", width: 28, height: 28, fontSize: 14, cursor: "pointer", marginLeft: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  section: { marginTop: 28 },
  h3: { fontSize: 17, fontWeight: 700, marginBottom: 12, letterSpacing: -0.2 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: -0.5 },
  input: { border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "8px 10px", fontSize: 14, outline: "none", background: "#fff" },
  dropPanel: { marginTop: 10, background: "rgba(248,250,255,0.9)", borderRadius: 12, padding: 12, border: "1px solid rgba(79,126,247,0.1)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
  modal: { background: "#fff", borderRadius: 20, padding: 28, width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  toast: { position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#222", color: "#fff", padding: "10px 20px", borderRadius: 40, fontSize: 14, fontWeight: 500, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", whiteSpace: "nowrap" },
  errorBanner: { background: "#fff0f0", border: "1px solid #fcc", color: "#c0392b", borderRadius: 12, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", fontSize: 14 },
}
