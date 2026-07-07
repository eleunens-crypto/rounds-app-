"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { QRCodeSVG } from "qrcode.react"

// ═══════════════════════════════════════════════════════════════════════════
// RUNDO TABLE  —  losstaande mode (route: /table)
// ═══════════════════════════════════════════════════════════════════════════

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Group = { id: string; name: string; invite_code: string; owner_id: string; receipt_url?: string | null; party_size?: number | null; receipt_total?: number | null; finalized?: boolean | null; disputed_by?: string | null; created_at?: string }
type Participant = { id: string; name: string; group_id: string; self_joined?: boolean; seats?: number | null; created_at?: string }
type BillItem = {
  id: string
  group_id: string
  name: string
  unit_price: number
  quantity: number
  is_shared: boolean
  share_fixed?: boolean
  distribute?: string | null
  tax_rate?: number | null
  category: string | null
  created_at?: string
}
type Claim = {
  id: string
  group_id: string
  item_id: string
  participant_id: string
  quantity: number
  created_at?: string
}
type Confirmation = { id: string; group_id: string; participant_id: string; confirmed_at?: string }

type ParsedItem = { name: string; unit_price: number; quantity: number; is_shared: boolean; distribute?: string; tax_rate?: number; _isNew?: boolean; uncertain?: boolean; note?: string }
type AdminTab = "scan" | "guests" | "overview"

// ─── LOCAL STORAGE / IDS ─────────────────────────────────────────────────────
function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}
function getOrCreateOwnerId(): string {
  if (typeof window === "undefined") return randomId()
  const key = "rundo_owner_id"
  let id = localStorage.getItem(key)
  if (!id) { id = randomId(); localStorage.setItem(key, id) }
  return id
}
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
function getMeId(groupId: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`rundo_table_me_${groupId}`)
}
function setMeIdStored(groupId: string, participantId: string | null) {
  if (participantId) localStorage.setItem(`rundo_table_me_${groupId}`, participantId)
  else localStorage.removeItem(`rundo_table_me_${groupId}`)
}

const LAST_GROUP_KEY = "rundo_table_last_group"
function rememberLastGroup(id: string | null) {
  if (typeof window === "undefined") return
  if (id) localStorage.setItem(LAST_GROUP_KEY, id)
  else localStorage.removeItem(LAST_GROUP_KEY)
}
function getLastGroup(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(LAST_GROUP_KEY)
}

type SavedGroup = { id: string; name: string; invite_code: string; role: "admin" | "gast"; savedAt: number; created_at?: string }
function getMyGroups(): SavedGroup[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(`rundo_table_groups_${getOrCreateOwnerId()}`)
    return raw ? (JSON.parse(raw) as SavedGroup[]) : []
  } catch { return [] }
}
function saveMyGroup(g: { id: string; name: string; invite_code: string; created_at?: string }, role: "admin" | "gast") {
  if (typeof window === "undefined") return
  const list = getMyGroups().filter((x) => x.id !== g.id)
  list.unshift({ id: g.id, name: g.name, invite_code: g.invite_code, role, savedAt: Date.now(), created_at: g.created_at })
  localStorage.setItem(`rundo_table_groups_${getOrCreateOwnerId()}`, JSON.stringify(list.slice(0, 50)))
}
function removeMyGroup(id: string) {
  if (typeof window === "undefined") return
  const list = getMyGroups().filter((x) => x.id !== id)
  localStorage.setItem(`rundo_table_groups_${getOrCreateOwnerId()}`, JSON.stringify(list))
}

function fmtDate(iso?: string | number): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })
}

type Dispute = { name: string; comment: string; resolved: boolean }
function parseDisputes(raw: string): Dispute[] {
  return (raw || "").split("\n").map((s) => s.trim()).filter(Boolean).map((row) => {
    const parts = row.split("::")
    return { name: parts[0] || "", comment: parts[1] || "", resolved: (parts[2] || "") === "resolved" }
  })
}
function serializeDisputes(list: Dispute[]): string {
  return list.map((d) => `${d.name}::${d.comment}::${d.resolved ? "resolved" : ""}`).join("\n")
}

const SKIP_LINE_KEYWORDS = [
  "totaal", "total", "subtotaal", "subtotal", "btw", "tva", "vat", "tax", "incl", "excl",
  "te betalen", "betaald", "betaling", "paid", "cash", "contant", "kaart", "card", "bancontact",
  "maestro", "visa", "mastercard", "payconiq", "wisselgeld", "terug", "change", "afgerond",
  "korting", "discount", "fooi", "tip", "bedankt", "thank", "tot ziens", "tafel", "table",
  "ober", "kassa", "datum", "tijd", "tel", "btw-nr", "ondernemingsnr", "ticket", "bon nr",
  "afrekening", "rekening", "factuur", "aantal", "omschrijving",
]

function isSkippableLine(line: string): boolean {
  const l = line.toLowerCase()
  return SKIP_LINE_KEYWORDS.some((k) => l.includes(k))
}

function extractAmount(line: string): { value: number; startIdx: number } | null {
  const decimal = [...line.matchAll(/(\d{1,4})[.,](\d{2})(?!\d)/g)]
  if (decimal.length > 0) {
    const m = decimal[decimal.length - 1]
    return { value: parseFloat(`${m[1]}.${m[2]}`), startIdx: m.index ?? line.length }
  }
  const intMatches = [...line.matchAll(/(\d[\d\s]{1,6}\d|\d{2,7})(?!.*\d)/g)]
  if (intMatches.length > 0) {
    const m = intMatches[intMatches.length - 1]
    const digits = m[1].replace(/\s/g, "")
    if (digits.length >= 3) {
      return { value: parseFloat(`${digits.slice(0, -2)}.${digits.slice(-2)}`), startIdx: m.index ?? line.length }
    } else if (digits.length > 0) {
      return { value: parseFloat(digits), startIdx: m.index ?? line.length }
    }
  }
  return null
}

function parseReceiptText(raw: string): { items: ParsedItem[]; total: number | null } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const items: ParsedItem[] = []
  let total: number | null = null

  for (const rawLine of lines) {
    const low = rawLine.toLowerCase()
    if (/\btotaal\b|\btotal\b/.test(low) && !low.includes("subtotaal") && !low.includes("netto") && !low.includes("%")) {
      const amt = extractAmount(rawLine)
      if (amt && amt.value > 0) total = amt.value
      continue
    }

    if (isSkippableLine(rawLine)) continue
    let line = rawLine

    line = line.replace(/^\s*\d{1,2}\s*[A-Da-d]\b\s*/, "").trim()

    const trailingNums = line.match(/(\d+[.,]?\d*)(?:\s+\d+[.,]?\d*){2,}\s*$/)
    if (trailingNums && /%/.test(line)) continue

    const amt = extractAmount(line)
    if (!amt || amt.value <= 0) continue
    const lineTotal = amt.value
    const priceStartIdx = amt.startIdx

    let rest = line.slice(0, priceStartIdx).trim()

    let qty = 1
    const qtyMatch = rest.match(/^(\d{1,2})\s*[xX×]?\s+/)
    if (qtyMatch) { qty = Math.max(1, parseInt(qtyMatch[1], 10)); rest = rest.slice(qtyMatch[0].length).trim() }

    const name = rest.replace(/^[-•*.\s]+/, "").replace(/\s{2,}/g, " ").trim()

    const letters = (name.match(/[a-zA-ZÀ-ÿ]/g) || []).length
    if (!name || name.length < 2 || letters < 2) continue

    const unit = qty > 1 ? +(lineTotal / qty).toFixed(2).replace(".", ",") : lineTotal
    items.push({ name, unit_price: unit, quantity: qty, is_shared: false })
  }
  return { items, total }
}

async function cleanReceiptToItems(rawText: string): Promise<{ items: ParsedItem[]; total: number | null }> {
  return parseReceiptText(rawText)
}

async function preprocessReceipt(file: File): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = URL.createObjectURL(file)
  })
  const targetW = Math.min(2200, Math.max(1400, img.naturalWidth))
  const scale = img.naturalWidth > 0 ? targetW / img.naturalWidth : 1
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) { URL.revokeObjectURL(img.src); return canvas.toDataURL("image/png") }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = id.data
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const v = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(id, 0, 0)
  } catch { /* getImageData kan falen — dan gewoon de geschaalde foto gebruiken */ }
  URL.revokeObjectURL(img.src)
  return canvas.toDataURL("image/png")
}

// Zet een File om naar pure base64 (zonder de "data:...;base64,"-prefix).
// Laat in prijsvelden enkel cijfers, één decimaalteken (. of ,) en (optioneel) een leidend minteken door.
function numFilter(v: string, allowNeg = false): string {
  let s = v.replace(/[^0-9.,\-]/g, "")
  let sepUsed = false
  s = s.replace(/[.,]/g, (m) => { if (sepUsed) return ""; sepUsed = true; return m })
  if (allowNeg) { const neg = s.startsWith("-"); s = s.replace(/-/g, ""); if (neg) s = "-" + s }
  else s = s.replace(/-/g, "")
  s = s.replace(/^(-?)0+(?=\d)/, "$1")
  return s
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      resolve(res.includes(",") ? res.split(",")[1] : res)
    }
    reader.onerror = () => reject(new Error("Kon de foto niet lezen"))
    reader.readAsDataURL(file)
  })
}

// Hoofd-scan: probeer eerst de AI-route (Gemini). Lukt dat niet (geen sleutel, fout, niets herkend),
// dan valt hij automatisch terug op de lokale Tesseract-scan.
async function scanReceipt(file: File, onProgress?: (p: number) => void): Promise<{ ok: true; items: ParsedItem[]; total: number | null } | { ok: false; reason: "unavailable" | "empty" }> {
  try {
    onProgress?.(0.15)
    const imageBase64 = await fileToBase64(file)
    const resp = await fetch("/api/scan-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType: file.type || "image/jpeg" }),
    })
    onProgress?.(0.85)
    if (!resp.ok) {
      console.warn("AI-scan niet beschikbaar (status " + resp.status + ")")
      return { ok: false, reason: "unavailable" }
    }
    const data = await resp.json()
    if (Array.isArray(data?.items)) {
      const items: ParsedItem[] = data.items
        .map((it: { name?: string; quantity?: number; unit_price?: number; uncertain?: boolean; note?: string; is_extra_cost?: boolean }) => ({
          name: String(it.name ?? "").trim(),
          quantity: it.is_extra_cost ? 1 : Math.max(1, Math.round(Number(it.quantity) || 1)),
          unit_price: Math.max(0, Math.round((Number(it.unit_price) || 0) * 100) / 100),
          is_shared: false,
          uncertain: !!it.uncertain,
          note: String(it.note ?? "").trim(),
          ...(it.is_extra_cost ? { distribute: "all" } : {}),
        }))
        .filter((it: ParsedItem) => it.name.length > 0)
      if (items.length > 0) {
        onProgress?.(1)
        const total = data.total != null && !isNaN(Number(data.total)) ? Math.round(Number(data.total) * 100) / 100 : null
        return { ok: true, items, total }
      }
    }
    // AI antwoordde, maar niets bruikbaars herkend -> waarschijnlijk fotokwaliteit
    return { ok: false, reason: "empty" }
  } catch (e) {
    console.warn("AI-scan mislukt:", e)
    return { ok: false, reason: "unavailable" }
  }
}

async function scanReceiptOCR(file: File, onProgress?: (p: number) => void): Promise<{ items: ParsedItem[]; total: number | null }> {
  const image = await preprocessReceipt(file)
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("nld", 1, {
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress)
    },
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never })
    const { data } = await worker.recognize(image)
    console.log("─── RUWE OCR-TEKST ───\n" + (data.text || "(leeg)") + "\n──────────────────────")
    return cleanReceiptToItems(data.text || "")
  } finally {
    await worker.terminate()
  }
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 2400)
    return () => clearTimeout(t)
  }, [message])
  return <div style={S.toast}>{message}</div>
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function RundoTable() {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const lastActive = useRef(Date.now())

  // Zorg dat het scherm op iPhone/Android altijd volledig toont en niet inzoomt bij het tikken
  // in een invoerveld (iOS zoomt anders in en toont niet alles). We forceren de juiste viewport.
  useEffect(() => {
    if (typeof document === "undefined") return
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta) }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover")
  }, [])

  // Sluit het mobiele toetsenbord zodra je buiten een invoerveld tikt (op een knop of lege ruimte).
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
  const autoJoined = useRef(false)

  const [group, setGroup] = useState<Group | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [viaLink, setViaLink] = useState(false)
  const isOwnerDevice = !!group && group.owner_id === getOrCreateOwnerId()
  const isAdmin = isOwnerDevice && !viaLink

  const [groupName, setGroupName] = useState("")
  const [partySize, setPartySize] = useState("")
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [myGroups, setMyGroups] = useState<SavedGroup[]>([])
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => { setMyGroups(getMyGroups()) }, [])

  const [participants, setParticipants] = useState<Participant[]>([])
  const [items, setItems] = useState<BillItem[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])

  const [adminTab, setAdminTab] = useState<AdminTab>("scan")
  const [showScan, setShowScan] = useState(false)
  const [adminFinalPopup, setAdminFinalPopup] = useState(false)
  const [showShareWarn, setShowShareWarn] = useState(false)   // waarschuwing bij delen terwijl totalen niet kloppen
  const [showFinalizeWarn, setShowFinalizeWarn] = useState(false) // waarschuwing bij afsluiten terwijl totalen niet kloppen
  // De beheerder bevestigde dat het ingevulde bon-totaal correct is, ook al verschilt het van de items.
  const [receiptConfirmed, setReceiptConfirmed] = useState(false)
  // De beheerder klikte "Neen" en past het rekeningtotaal aan.
  const [receiptEditing, setReceiptEditing] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)
  // Twijfel-vlaggen uit de AI-scan, per item-id (lokaal, om meteen na de scan na te kijken).
  const [scanFlags, setScanFlags] = useState<Record<string, { note: string }>>({})
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanFail, setScanFail] = useState<null | { reason: "unavailable" | "empty" }>(null)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [nowTs, setNowTs] = useState<number>(() => Date.now())
  const [scanPreview, setScanPreview] = useState<ParsedItem[]>([])
  // Toont of de laatste scan via de AI ging of via de lokale terugval (voor de beheerder).
  const [scanSource, setScanSource] = useState<"ai" | "local" | null>(null)
  const [scanTotal, setScanTotal] = useState<string>("")
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  const [claimMode, setClaimMode] = useState<"item" | "person">("item")
  const [claimPid, setClaimPid] = useState<string | null>(null)
  const [scanFile, setScanFile] = useState<File | null>(null)
  // Bewaarde foto van de laatste scan, zodat je een mislukte AI-scan opnieuw kan proberen.
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const [scanPhotoUrl, setScanPhotoUrl] = useState<string | null>(null)
  const [viewReceipt, setViewReceipt] = useState<string | null>(null)
  const [newGuest, setNewGuest] = useState("")
  const [newGuestSeats, setNewGuestSeats] = useState(1)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [showTodo, setShowTodo] = useState(false)
  const [showTaxInfo, setShowTaxInfo] = useState(false)
  const [taxConfig, setTaxConfig] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<BillItem | null>(null)
  const [newItem, setNewItem] = useState<{ name: string; unit_price: string; quantity: number; is_shared: boolean; target: "bill" | "scan" } | null>(null)
  // Venster om BTW/kosten/korting toe te voegen: stap 1 = naam + bedrag, stap 2 = verdeling kiezen.
  const [taxModal, setTaxModal] = useState<null | { name: string; amount: string; scope: "all" | "items"; ids: string[] }>(null)
  const [recentItemId, setRecentItemId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [asleep, setAsleep] = useState(false)
  const [manageGuests, setManageGuests] = useState(false)

  const loadAll = useCallback(async (groupId: string) => {
    const [{ data: p }, { data: it }, { data: cl }, { data: cf }, { data: g }] = await Promise.all([
      supabase.from("table_participants").select("*").eq("group_id", groupId),
      supabase.from("table_items").select("*").eq("group_id", groupId),
      supabase.from("table_claims").select("*").eq("group_id", groupId),
      supabase.from("table_confirmations").select("*").eq("group_id", groupId),
      supabase.from("table_groups").select("*").eq("id", groupId).single(),
    ])
    if (!mounted.current) return
    const order = <T extends { created_at?: string; id: string }>(rows: T[]) =>
    [...(rows || [])].sort((a, b) => {
        const ca = a.created_at ?? "", cb = b.created_at ?? ""
        if (ca !== cb) return ca < cb ? -1 : 1
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })
    setParticipants(order(p as Participant[] || []))
    setItems(order(it as BillItem[] || []))
    setClaims((cl as Claim[]) || [])
    setConfirmations((cf as Confirmation[]) || [])
    if (g) setGroup((cur) => cur ? { ...cur, ...(g as Group) } : cur)
  }, [])

 useEffect(() => {
    if (!group || asleep) return
    const groupId = group.id
    let active = true
    let ch: ReturnType<typeof supabase.channel> | null = null
    let retry: ReturnType<typeof setTimeout> | null = null

    const reload = () => { if (mounted.current && active) loadAll(groupId) }

    const connect = () => {
      if (!active) return
      ch = supabase.channel(`table-${groupId}`)
      ;["table_participants", "table_items", "table_claims", "table_confirmations", "table_groups"].forEach((table) => {
        const filter = table === "table_groups" ? `id=eq.${groupId}` : `group_id=eq.${groupId}`
        ch!.on("postgres_changes", { event: "*", schema: "public", table, filter }, reload)
      })
      ch!.subscribe((status) => {
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && active) {
          if (retry) clearTimeout(retry)
          retry = setTimeout(() => { if (ch) supabase.removeChannel(ch); connect() }, 2000)
        }
        if (status === "SUBSCRIBED") reload()
      })
    }
    connect()
    const refreshOnReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      reload()
    }
    document.addEventListener("visibilitychange", refreshOnReturn)
    window.addEventListener("focus", refreshOnReturn)
    const poll = setInterval(() => { if (typeof document === "undefined" || document.visibilityState === "visible") reload() }, 30000)

    return () => {
      active = false
      if (retry) clearTimeout(retry)
      clearInterval(poll)
      document.removeEventListener("visibilitychange", refreshOnReturn)
      window.removeEventListener("focus", refreshOnReturn)
      if (ch) supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, loadAll, asleep])

  // Inactiviteits-slaapstand: na 3 min zonder tik/scroll/toets 'slaapt' het scherm
  // (realtime stopt via de guard hierboven -> spaart data). We meten inactiviteit met een
  // tijdstempel + interval i.p.v. één lange setTimeout, want die wordt door de browser
  // gepauzeerd zodra het tabblad verborgen is (scherm op slot) en vuurt dan niet betrouwbaar.
  // Enkel een échte tik/toets/scroll of een tik op de banner hervat; terugkeren naar het
  // tabblad hervat NIET vanzelf, zodat de "gepauzeerd"-melding zichtbaar blijft.
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
  }, [group?.id])

  // Live afteller voor de "opnieuw proberen"-knop na een tijdelijk mislukte scan.
  useEffect(() => {
    if (!scanFail || scanFail.reason !== "unavailable") return
    setNowTs(Date.now())
    const iv = setInterval(() => setNowTs(Date.now()), 500)
    return () => clearInterval(iv)
  }, [scanFail, cooldownUntil])

  useEffect(() => {
    if (group && typeof window !== "undefined") localStorage.setItem("rundo_table_last_tab", adminTab)
  }, [adminTab, group])

  useEffect(() => {
    if (autoJoined.current || group) return
    if (typeof window === "undefined") return
    const code = new URLSearchParams(window.location.search).get("code")
    if (code) { autoJoined.current = true; setViaLink(true); joinGroup(code); return }
    // Geen link-code → herstel een eventuele eigen sessie (refresh in dezelfde tab, bv. de beheerder).
    // Vanaf het keuzescherm is deze sessie gewist, dus daar kom je altijd op het startscherm.
    try {
      const raw = sessionStorage.getItem("rundo_table_session")
      if (raw) {
        const s = JSON.parse(raw) as { code?: string; tab?: AdminTab }
        if (s.code) { autoJoined.current = true; joinGroup(s.code, s.tab); return }
      }
    } catch { /* geen sessie om te herstellen */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bewaar de actieve sessie (groep + tab) zodat een refresh je in dezelfde groep en tab houdt.
  useEffect(() => {
    try {
      if (group && typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("rundo_table_session", JSON.stringify({ code: group.invite_code, tab: adminTab }))
      }
    } catch { /* sessionStorage niet beschikbaar */ }
  }, [group, adminTab])

  const createGroup = async () => {
    if (busy) return
    const name = groupName.trim()
    if (!name) { setStartError("Geef eerst een naam voor de rekening."); return }
    const size = Math.max(2, parseInt(partySize) || 2)
    if (getMyGroups().some((g) => g.name.trim().toLowerCase() === name.toLowerCase())) {
      setStartError("Je hebt al een groep met die naam. Kies een andere naam."); return
    }
    setBusy(true); setStartError(null)
    try {
      const owner_id = getOrCreateOwnerId()
      const invite_code = generateInviteCode()
      const { data, error } = await supabase.from("table_groups")
        .insert([{ name, invite_code, owner_id, party_size: size }]).select().single()
      if (error || !data) { setStartError("Groep aanmaken mislukt: " + error?.message); return }
      saveMyGroup(data, "admin"); setMyGroups(getMyGroups()); rememberLastGroup(data.id)
      setGroup(data); setMeId(getMeId(data.id)); await loadAll(data.id); setAdminTab("scan")
    } finally { setBusy(false) }
  }

  const joinGroup = async (codeOverride?: string, initialTab?: AdminTab) => {
    const code = (codeOverride ?? "").trim().toUpperCase()
    if (!code || busy) return
    setBusy(true); setStartError(null)
    try {
      const { data, error } = await supabase.from("table_groups").select("*").eq("invite_code", code).single()
      if (error || !data) { setStartError("Groep niet gevonden. Controleer de code."); return }
      const role = data.owner_id === getOrCreateOwnerId() ? "admin" : "gast"
      setViaLink(role === "gast")
      saveMyGroup(data, role); setMyGroups(getMyGroups()); rememberLastGroup(data.id)
      setGroup(data); setMeId(getMeId(data.id)); await loadAll(data.id)
      if (initialTab) setAdminTab(initialTab)
    } finally { setBusy(false) }
  }

  const openSavedGroup = async (id: string, tab: AdminTab = "scan") => {
    if (busy) return
    setBusy(true); setStartError(null)
    try {
      const { data, error } = await supabase.from("table_groups").select("*").eq("id", id).single()
      if (error || !data) { setStartError("Deze groep bestaat niet meer."); removeMyGroup(id); setMyGroups(getMyGroups()); rememberLastGroup(null); return }
      saveMyGroup(data, data.owner_id === getOrCreateOwnerId() ? "admin" : "gast"); setMyGroups(getMyGroups()); rememberLastGroup(data.id)
      setGroup(data); setMeId(getMeId(data.id)); await loadAll(data.id); setAdminTab(tab)
    } finally { setBusy(false) }
  }

  const forgetSavedGroup = async (id: string) => {
    if (!confirm("Deze groep definitief verwijderen? Alles (items, gasten en aanduidingen) wordt gewist en de groep is daarna niet meer terug te halen, ook niet via een code.")) return
    await supabase.from("table_claims").delete().eq("group_id", id)
    await supabase.from("table_confirmations").delete().eq("group_id", id)
    await supabase.from("table_items").delete().eq("group_id", id)
    await supabase.from("table_participants").delete().eq("group_id", id)
    const { error } = await supabase.from("table_groups").delete().eq("id", id)
    if (error) { setStartError("Verwijderen mislukt: " + error.message); return }
    if (getLastGroup() === id) rememberLastGroup(null)
    removeMyGroup(id); setMyGroups(getMyGroups())
  }

  const goToChooser = () => {
    if (typeof window === "undefined") return
    try { sessionStorage.removeItem("rundo_table_session") } catch { /* ignore */ }
    try {
      const target = window.location.origin + "/"
      if (window.top && window.top !== window.self) { window.top.location.href = target; return }
      window.location.href = target
    } catch {
      window.location.href = "/"
    }
  }

  const leaveGroup = () => {
    setGroup(null); setMeId(null); setItems([]); setClaims([]); setParticipants([]); setConfirmations([])
    setGroupName(""); setPartySize(""); setError(null)
    setViaLink(false); setShowSaved(false)
    setScanPreview([]); setScanFile(null); setScanPhotoUrl(null); setScanTotal(""); setScanFail(null); setShowScan(false)
    setAdminTab("scan"); setExpandedPeople(new Set()); setClaimMode("item"); setClaimPid(null)
    setShowTodo(false); setShowAddGuest(false); setViewReceipt(null)
    setManageGuests(false); setAsleep(false)
    autoJoined.current = true
    rememberLastGroup(null)
    try { if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("rundo_table_session") } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }

  const addGuest = async (name?: string, selfJoined = false, seats = 1) => {
    if (!group) return
    const finalName = (name ?? newGuest).trim() || `Gast ${participants.length + 1}`
    const seatsVal = Math.max(1, seats)
    let { data, error } = await supabase.from("table_participants")
      .insert([{ name: finalName, group_id: group.id, self_joined: selfJoined, seats: seatsVal }]).select().single()
    if (error && /seats/.test(error.message || "")) {
      const retry = await supabase.from("table_participants")
        .insert([{ name: finalName, group_id: group.id, self_joined: selfJoined }]).select().single()
      data = retry.data; error = retry.error
      if (!error && seatsVal > 1) setError("Let op: 'telt voor meerdere personen' werkt nog niet. Voeg in Supabase de kolom seats toe aan table_participants.")
    }
    if (error && /self_joined/.test(error.message || "")) {
      const retry = await supabase.from("table_participants")
        .insert([{ name: finalName, group_id: group.id }]).select().single()
      data = retry.data; error = retry.error
      if (!error) setError("Let op: het onderscheid 'via link / vooraf toegevoegd' werkt nog niet. Voeg in Supabase de kolom self_joined toe (zie instructies).")
    }
    if (error) { setError("Gast toevoegen mislukt: " + error.message); return }
    setNewGuest("")
    await loadAll(group.id)
    return data as Participant
  }

  const setSeats = async (pid: string, n: number) => {
    if (!group) return
    if (group.finalized) { setToast(isAdmin ? "De rekening is afgesloten — heropen ze eerst om te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    const val = Math.max(1, n)
    const current = Math.max(1, participants.find((p) => p.id === pid)?.seats ?? 1)
    if (val === current) return
    const hasClaims = claims.some((c) => c.participant_id === pid && c.quantity > 0)
    if (hasClaims && !confirm("Het aantal personen wijzigen wist wat deze persoon al aantikte (gewone én gedeelde items). Wil je doorgaan?")) return
    setParticipants((cur) => cur.map((p) => p.id === pid ? { ...p, seats: val } : p))
    if (hasClaims) setClaims((cur) => cur.filter((c) => c.participant_id !== pid))
    if (hasClaims) await supabase.from("table_claims").delete().eq("group_id", group.id).eq("participant_id", pid)
    const { error } = await supabase.from("table_participants").update({ seats: val }).eq("id", pid)
    if (error && /seats/.test(error.message || "")) { setError("Voeg in Supabase de kolom seats toe aan table_participants om dit te bewaren."); return }
    if (hasClaims) setToast("Aantal personen aangepast — eerdere keuzes gewist, tik opnieuw aan")
  }

  const seatsOf = (pid: string) => Math.max(1, participants.find((p) => p.id === pid)?.seats ?? 1)

  const finalizeBill = async (on: boolean) => {
    if (!group) return
    setGroup((cur) => cur ? { ...cur, finalized: on, disputed_by: on ? cur.disputed_by : null } : cur)
    const patch = on ? { finalized: true } : { finalized: false, disputed_by: null }
    const { error } = await supabase.from("table_groups").update(patch).eq("id", group.id)
    if (error && /finalized|disputed_by/.test(error.message || "")) {
      setError("Voeg in Supabase de kolommen finalized (bool) en disputed_by (text) toe aan table_groups.")
      return
    }
    await loadAll(group.id)
    setToast(on ? "Rekening afgesloten — gasten kunnen niet meer wijzigen" : "Rekening heropend")
    if (on) setAdminFinalPopup(true)
  }

  const flagDispute = async (name: string, on: boolean, comment = "") => {
    if (!group) return
    const cur = parseDisputes(group.disputed_by || "").filter((d) => d.name !== name)
    const next = on ? [...cur, { name, comment: comment.trim(), resolved: false }] : cur
    const val = serializeDisputes(next)
    setGroup((g) => g ? { ...g, disputed_by: val } : g)
    const { error } = await supabase.from("table_groups").update({ disputed_by: val }).eq("id", group.id)
    if (error) { setError("Seintje versturen mislukt"); return }
    await loadAll(group.id)
  }

  const resolveDispute = async (name: string, resolved: boolean) => {
    if (!group) return
    const next = parseDisputes(group.disputed_by || "").map((d) => d.name === name ? { ...d, resolved } : d)
    const val = serializeDisputes(next)
    setGroup((g) => g ? { ...g, disputed_by: val } : g)
    const { error } = await supabase.from("table_groups").update({ disputed_by: val }).eq("id", group.id)
    if (error) { setError("Bijwerken mislukt"); return }
    await loadAll(group.id)
  }

  const pickMe = (participantId: string) => {
    if (!group) return
    setMeIdStored(group.id, participantId); setMeId(participantId)
  }

  const switchPerson = () => {
    if (!group) return
    setMeIdStored(group.id, null); setMeId(null)
  }

  const joinAsNewPerson = async (name: string, seats = 1) => {
    const p = await addGuest(name, true, seats)
    if (p) pickMe(p.id)
  }

  const removeGuest = async (id: string) => {
    if (!group) return
    if (!confirm("Deze gast verwijderen? Zijn/haar claims verdwijnen ook.")) return
    await supabase.from("table_claims").delete().eq("group_id", group.id).eq("participant_id", id)
    await supabase.from("table_confirmations").delete().eq("group_id", group.id).eq("participant_id", id)
    await supabase.from("table_participants").delete().eq("id", id)
    if (meId === id) { setMeIdStored(group.id, null); setMeId(null) }
    await loadAll(group.id)
  }

  const renameGuest = async (id: string, name: string) => {
    if (!group) return
    const finalName = name.trim()
    if (!finalName) return
    setParticipants((cur) => cur.map((p) => p.id === id ? { ...p, name: finalName } : p))
    await supabase.from("table_participants").update({ name: finalName }).eq("id", id)
    await loadAll(group.id)
  }

  const startRescan = async () => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    const hasItems = items.length > 0
    const hasClaims = claims.length > 0
    if (hasItems || hasClaims) {
      const msg = hasClaims
        ? "Opnieuw scannen wist de huidige bon én alles wat al toegewezen werd (items en aanduidingen). Wil je doorgaan?"
        : "Opnieuw scannen wist de huidige items van de vorige bon. Wil je doorgaan?"
      if (!confirm(msg)) return
      await supabase.from("table_claims").delete().eq("group_id", group.id)
      await supabase.from("table_items").delete().eq("group_id", group.id)
    }
    if (group.receipt_url) {
      await supabase.from("table_groups").update({ receipt_url: null }).eq("id", group.id)
      setGroup((g) => g ? { ...g, receipt_url: null } : g)
    }
    setItems([]); setClaims([])
    setShowScan(true)
  }

  const retryAiScan = () => {
    if (!retryFile) { setToast("Geen foto beschikbaar om opnieuw te scannen."); return }
    setShowScan(true)
    onPhotoPicked(retryFile)
  }

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return
    setScanFail(null); setScanPreview([]); setScanProgress(0); setScanning(true)
    setScanFile(file); setRetryFile(file)
    if (scanPhotoUrl) URL.revokeObjectURL(scanPhotoUrl)
    setScanPhotoUrl(URL.createObjectURL(file))
    const res = await scanReceipt(file, (pr) => setScanProgress(pr))
    setScanning(false)
    if (!res.ok) {
      if (res.reason === "unavailable") setCooldownUntil(Date.now() + 45 * 1000)
      setScanFail({ reason: res.reason })
      return
    }
    setScanSource("ai")
    await confirmScan(res.items, res.total != null ? res.total.toFixed(2).replace(".", ",") : "", file)
  }

  // Alleen als de gebruiker er zelf voor kiest: de snelle, minder nauwkeurige lokale scan.
  const runLocalScan = async () => {
    const file = retryFile ?? scanFile
    if (!file) { setToast("Geen foto beschikbaar."); return }
    setScanFail(null); setScanProgress(0); setScanning(true)
    try {
      const { items, total } = await scanReceiptOCR(file, (pr) => setScanProgress(pr))
      setScanning(false)
      if (items.length === 0) { setScanFail({ reason: "empty" }); return }
      setScanSource("local")
      await confirmScan(items, total != null ? total.toFixed(2).replace(".", ",") : "", file)
    } catch (e) {
      console.error("Lokale scan-fout:", e)
      setScanning(false)
      setScanFail({ reason: "empty" })
    }
  }
  const confirmScan = async (previewArg?: ParsedItem[], totalArg?: string, fileArg?: File | null) => {
    const preview = previewArg ?? scanPreview
    const totalStr = totalArg ?? scanTotal
    const file = fileArg !== undefined ? fileArg : scanFile
    if (!group || preview.length === 0) return
    let receiptUrl = group.receipt_url ?? null
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${group.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file, { upsert: true })
      if (upErr) { setToast("Foto bewaren mislukt — items worden wel toegevoegd") }
      else {
        receiptUrl = supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl
        const { error: urlErr } = await supabase.from("table_groups").update({ receipt_url: receiptUrl }).eq("id", group.id)
        if (urlErr) setError("De bonfoto kon niet bij de groep bewaard worden: " + urlErr.message)
        else setGroup({ ...group, receipt_url: receiptUrl })
      }
    }
    const baseList = preview.map((it, idx) => ({ it, idx })).filter((o) => !o.it.distribute)
    const taxList = preview.map((it, idx) => ({ it, idx })).filter((o) => !!o.it.distribute)
    // Oplopende tijdstempel per scan-item, zodat ze bij het herladen in de bon-volgorde blijven staan.
    const scanBaseTime = Date.now()
    const stamp = (idx: number) => new Date(scanBaseTime + idx * 100).toISOString()
    const baseRows = baseList.map(({ it, idx }) => ({
      group_id: group.id, name: it.name, unit_price: it.unit_price,
      quantity: it.quantity, is_shared: it.is_shared, category: null,
      created_at: stamp(idx),
    }))
    let columnMissing = false
    let canStamp = true
    let baseRes = await supabase.from("table_items").insert(baseRows).select()
    if (baseRes.error && /created_at/i.test(baseRes.error.message || "")) {
      // Databank laat een handmatige tijdstempel niet toe -> zonder (volgorde kan dan afwijken).
      canStamp = false
      baseRes = await supabase.from("table_items").insert(
        baseList.map(({ it }) => ({ group_id: group.id, name: it.name, unit_price: it.unit_price, quantity: it.quantity, is_shared: it.is_shared, category: null }))
      ).select()
    }
    if (baseRes.error) { setError("Items opslaan mislukt: " + baseRes.error.message); return }
    const inserted = baseRes.data || []
    const idByScanIdx: Record<number, string> = {}
    const flags: Record<string, { note: string }> = {}
    baseList.forEach((o, k) => {
      if (inserted[k]) {
        idByScanIdx[o.idx] = inserted[k].id
        if (o.it.uncertain) flags[inserted[k].id] = { note: o.it.note || "" }
      }
    })
    setScanFlags((prev) => ({ ...prev, ...flags }))

    if (taxList.length > 0) {
      const taxRows = taxList.map(({ it, idx }) => {
        let dist: string = "all"
        if (it.distribute && it.distribute !== "all") {
          try { const sel = (JSON.parse(it.distribute).idx) as number[]; dist = JSON.stringify(sel.map((ix) => idByScanIdx[ix]).filter(Boolean)) } catch { dist = "all" }
        }
        return { group_id: group.id, name: it.name, unit_price: it.unit_price, quantity: 1, is_shared: false, category: null, distribute: dist, ...(canStamp ? { created_at: stamp(idx) } : {}) }
      })
      let taxRes = await supabase.from("table_items").insert(taxRows)
      if (taxRes.error && /distribute/.test(taxRes.error.message || "")) {
        columnMissing = true
        const stripped = taxList.map(({ it, idx }) => ({ group_id: group.id, name: it.name, unit_price: it.unit_price, quantity: 1, is_shared: false, category: null, ...(canStamp ? { created_at: stamp(idx) } : {}) }))
        taxRes = await supabase.from("table_items").insert(stripped)
      }
      if (taxRes.error) { setError("BTW opslaan mislukt: " + taxRes.error.message); return }
    }
    if (columnMissing) setError("Let op: voeg in Supabase de kolom 'distribute' toe, anders wordt de BTW-verdeling niet bewaard.")
    const rows = preview
    const billNum = parseFloat((totalStr || "").replace(",", "."))
    if (!isNaN(billNum) && billNum > 0) {
      const { error: tErr } = await supabase.from("table_groups").update({ receipt_total: billNum }).eq("id", group.id)
      if (!tErr) setGroup((g) => g ? { ...g, receipt_total: billNum } : g)
    }
    // Klopt het ingevulde totaal met items + BTW? Dan enkel een korte bevestiging.
    const computedNow = preview.filter((x) => !x.distribute).reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 0), 0) + preview.filter((x) => x.distribute).reduce((s, it) => s + (it.unit_price || 0), 0)
    const totalOk = !isNaN(billNum) && billNum > 0 && Math.abs(billNum - computedNow) < 0.01
    setScanPreview([]); setScanTotal(""); setScanFail(null); setScanFile(null)
    if (scanPhotoUrl) { URL.revokeObjectURL(scanPhotoUrl); setScanPhotoUrl(null) }
    setShowScan(false)
    await loadAll(group.id)
    setToast(totalOk ? "✅ Bon gescand — totaal klopt. Controleer de items." : `${rows.length} item${rows.length !== 1 ? "s" : ""} toegevoegd — controleer ze op de Bon-tab.`)
  }

  const addManualItem = async () => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    const { error } = await supabase.from("table_items")
      .insert([{ group_id: group.id, name: "Nieuw item", unit_price: 0, quantity: 1, is_shared: false, category: null }])
    if (error) { setError("Item toevoegen mislukt"); return }
    await loadAll(group.id)
  }

  const openNewItem = (target: "bill" | "scan") =>
    setNewItem({ name: "", unit_price: "", quantity: 1, is_shared: false, target })

  const confirmNewItem = async () => {
    if (!newItem) return
    const name = newItem.name.trim() || "Nieuw item"
    const price = parseFloat((newItem.unit_price || "").replace(",", ".")) || 0
    const qty = Math.max(1, newItem.quantity || 1)
    if (newItem.target === "scan") {
      setScanPreview((cur) => [...cur, { name, unit_price: price, quantity: qty, is_shared: newItem.is_shared, _isNew: true }])
      setNewItem(null)
      setTimeout(() => setScanPreview((cur) => cur.map((x) => x._isNew ? { ...x, _isNew: false } : x)), 5000)
      return
    }
    if (!group) { setNewItem(null); return }
    const { data, error } = await supabase.from("table_items")
      .insert([{ group_id: group.id, name, unit_price: price, quantity: qty, is_shared: newItem.is_shared, category: null }])
      .select().single()
    if (error) { setError("Item toevoegen mislukt"); return }
    setNewItem(null)
    await loadAll(group.id)
    if (data?.id) { setRecentItemId(data.id); setTimeout(() => setRecentItemId(null), 6000) }
  }

  const confirmTaxModal = async (scope: "all" | "items") => {
    if (group?.finalized) { setToast("Heropen de rekening eerst om iets te wijzigen."); return }
    if (!group || !taxModal) return
    const amt = parseFloat((taxModal.amount || "").replace(",", ".")) || 0
    const name = taxModal.name.trim() || "BTW of andere kosten"
    const dist = scope === "items" && taxModal.ids.length > 0 ? JSON.stringify(taxModal.ids) : "all"
    const { error } = await supabase.from("table_items").insert([{ group_id: group.id, name, unit_price: amt, quantity: 1, is_shared: false, category: null, distribute: dist }])
    if (error) {
      if (/distribute/.test(error.message || "")) setError("Voeg eerst de kolom 'distribute' toe in Supabase (zie instructies).")
      else setError("Toevoegen mislukt: " + error.message)
      return
    }
    setTaxModal(null)
    await loadAll(group.id)
  }

  const addTaxItem = async (rate?: number) => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    const name = rate ? `BTW ${rate}%` : "BTW of andere kosten"
    const row: Record<string, unknown> = { group_id: group.id, name, unit_price: 0, quantity: 1, is_shared: false, category: null, distribute: "all" }
    if (rate) row.tax_rate = rate
    let { error } = await supabase.from("table_items").insert([row])
    if (error && /tax_rate/.test(error.message || "")) {
      const retry = await supabase.from("table_items").insert([{ group_id: group.id, name, unit_price: 0, quantity: 1, is_shared: false, category: null, distribute: "all" }])
      error = retry.error
      if (!error) setError("Let op: percentage-BTW werkt nog niet. Voeg in Supabase de kolom tax_rate toe aan table_items.")
    }
    if (error) {
      if (/distribute/.test(error.message || "")) setError("Voeg eerst de kolom 'distribute' toe in Supabase (zie instructies).")
      else setError("BTW toevoegen mislukt: " + error.message)
      return
    }
    await loadAll(group.id)
  }

  const setReceiptTotal = async (val: number | null) => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    setGroup((g) => g ? { ...g, receipt_total: val } : g)
    const { error } = await supabase.from("table_groups").update({ receipt_total: val }).eq("id", group.id)
    if (error) setError("Rekeningtotaal opslaan mislukt: " + error.message)
  }
  const setTaxRate = async (it: BillItem, rate: number | null) => {
    if (!group) return
    const patch: Record<string, unknown> = { tax_rate: rate }
    if (rate) patch.name = `BTW ${rate}%`
    const { error } = await supabase.from("table_items").update(patch).eq("id", it.id)
    if (error && /tax_rate/.test(error.message || "")) { setError("Voeg in Supabase de kolom tax_rate toe aan table_items."); return }
    await loadAll(group.id)
  }

  const setDistribute = async (it: BillItem, val: string) => {
    if (!group) return
    await supabase.from("table_items").update({ distribute: val }).eq("id", it.id)
    await loadAll(group.id)
  }

  const saveItem = async () => {
    if (!group || !editItem) return
    if (group.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    const { error } = await supabase.from("table_items").update({
      name: editItem.name, unit_price: editItem.unit_price,
      quantity: editItem.quantity, is_shared: editItem.is_shared,
    }).eq("id", editItem.id)
    if (error) { setError("Opslaan mislukt"); return }
    setEditItem(null); await loadAll(group.id)
  }

  const toggleShared = async (it: BillItem) => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    await supabase.from("table_items").update({ is_shared: !it.is_shared }).eq("id", it.id)
    await loadAll(group.id)
  }

  const deleteItem = async (id: string) => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    if (!confirm("Dit item van de bon verwijderen? Wat er al aan toegewezen werd, verdwijnt mee.")) return
    await supabase.from("table_claims").delete().eq("item_id", id)
    await supabase.from("table_items").delete().eq("id", id)
    await loadAll(group.id)
  }

  const claimedQty = (itemId: string) =>
    claims.filter((c) => c.item_id === itemId).reduce((s, c) => s + c.quantity, 0)
  const myQty = (itemId: string, pid: string | null) =>
    pid ? claims.filter((c) => c.item_id === itemId && c.participant_id === pid).reduce((s, c) => s + c.quantity, 0) : 0
  const sharerIds = (itemId: string) => {
    const ids = new Set<string>()
    claims.filter((c) => c.item_id === itemId && c.quantity > 0).forEach((c) => ids.add(c.participant_id))
    return [...ids]
  }
  const claimsForItem = (itemId: string) =>
    claims
      .filter((c) => c.item_id === itemId && c.quantity > 0)
      .map((c) => ({ name: participants.find((p) => p.id === c.participant_id)?.name ?? "?", qty: c.quantity }))

  const setClaim = async (itemId: string, pid: string, qty: number) => {
    if (!group) return
    if (group.finalized) { setToast(isAdmin ? "De rekening is afgesloten — heropen ze eerst om te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    const existing = claims.find((c) => c.item_id === itemId && c.participant_id === pid)
    if (qty <= 0) {
      if (existing) await supabase.from("table_claims").delete().eq("id", existing.id)
    } else if (existing) {
      await supabase.from("table_claims").update({ quantity: qty }).eq("id", existing.id)
    } else {
      await supabase.from("table_claims").insert([{ group_id: group.id, item_id: itemId, participant_id: pid, quantity: qty }])
    }
    await loadAll(group.id)
  }

  const toggleShareClaim = async (itemId: string, pid: string) => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    const mine = myQty(itemId, pid)
    await setClaim(itemId, pid, mine > 0 ? 0 : seatsOf(pid))
  }

  const shareHeads = (itemId: string) =>
    claims.filter((c) => c.item_id === itemId && c.quantity > 0).reduce((s, c) => s + c.quantity, 0)

  const myShareHeads = (itemId: string, pid: string) =>
    claims.filter((c) => c.item_id === itemId && c.participant_id === pid).reduce((s, c) => s + c.quantity, 0)

  const setShareFixed = async (it: BillItem, val: boolean) => {
    if (group?.finalized) { setToast(isAdmin ? "Heropen de rekening eerst om iets te wijzigen." : "De rekening is afgesloten — vraag de beheerder om ze te heropenen."); return }
    if (!group) return
    await supabase.from("table_items").update({ share_fixed: val }).eq("id", it.id)
    await loadAll(group.id)
  }

  const itemTotal = (it: BillItem) => it.unit_price * it.quantity

  const isTax = (it: BillItem) => it.distribute != null && it.distribute !== ""
  const baseItems = items.filter((it) => !isTax(it))
  const taxItems = items.filter((it) => isTax(it))

  const taxTargetIds = (t: BillItem): Set<string> => {
    if (t.distribute === "all") return new Set(baseItems.map((i) => i.id))
    try {
      const ids = JSON.parse(t.distribute || "[]") as string[]
      return new Set(baseItems.filter((i) => ids.includes(i.id)).map((i) => i.id))
    } catch { return new Set(baseItems.map((i) => i.id)) }
  }

  const taxAmount = (t: BillItem): number => {
    if (t.tax_rate && t.tax_rate > 0) {
      const ids = taxTargetIds(t)
      const base = baseItems.filter((i) => ids.has(i.id)).reduce((s, i) => s + i.unit_price * i.quantity, 0)
      return +(base * (t.tax_rate / 100)).toFixed(2).replace(".", ",")
    }
    return itemTotal(t)
  }

  const sharedRevealed = (it: BillItem) => sharerIds(it.id).length > 0

  const baseAmountForItem = (pid: string, it: BillItem): number => {
    if (it.is_shared) {
      const heads = shareHeads(it.id)
      return heads > 0 && sharedRevealed(it) ? itemTotal(it) * (myShareHeads(it.id, pid) / heads) : 0
    }
    return it.unit_price * myQty(it.id, pid)
  }
  const baseWithin = (pid: string, ids: Set<string>): number =>
    baseItems.filter((i) => ids.has(i.id)).reduce((s, i) => s + baseAmountForItem(pid, i), 0)

  const taxShare = (pid: string): number => {
    let total = 0
    for (const t of taxItems) {
      const ids = taxTargetIds(t)
      const denom = participants.reduce((s, q) => s + baseWithin(q.id, ids), 0)
      if (denom > 0) total += taxAmount(t) * (baseWithin(pid, ids) / denom)
    }
    return total
  }

  const personTotal = (pid: string): { settled: number; pendingShared: boolean } => {
    let settled = 0
    let pendingShared = false
    for (const it of baseItems) {
      if (it.is_shared) {
        const sh = sharerIds(it.id)
        if (sh.includes(pid)) {
          if (sharedRevealed(it)) {
            const heads = shareHeads(it.id)
            settled += heads > 0 ? itemTotal(it) * (myShareHeads(it.id, pid) / heads) : 0
            if (!allConfirmed) pendingShared = true
          } else {
            pendingShared = true
          }
        }
      } else {
        settled += it.unit_price * myQty(it.id, pid)
      }
    }
    settled += taxShare(pid)
    return { settled, pendingShared }
  }

  const personItems = (pid: string): { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number; myHeads: number }[] => {
    const out: { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number; myHeads: number }[] = []
    for (const it of baseItems) {
      if (it.is_shared) {
        const sh = sharerIds(it.id)
        if (sh.includes(pid)) {
          const rev = sharedRevealed(it)
          const heads = shareHeads(it.id)
          const mine = myShareHeads(it.id, pid)
          out.push({ name: it.name, qty: 1, amount: rev && heads > 0 ? itemTotal(it) * (mine / heads) : 0, shared: true, revealed: rev, sharers: sh.length, myHeads: mine })
        }
      } else {
        const q = myQty(it.id, pid)
        if (q > 0) out.push({ name: it.name, qty: q, amount: it.unit_price * q, shared: false, revealed: true, sharers: 0, myHeads: 0 })
      }
    }
    const tax = taxShare(pid)
    if (tax > 0.005) out.push({ name: "BTW / kosten (verdeeld)", qty: 1, amount: tax, shared: false, revealed: true, sharers: 0, myHeads: 0 })
    return out
  }

  const hasAssignment = (pid: string): boolean =>
    baseItems.some((it) => it.is_shared ? sharerIds(it.id).includes(pid) : myQty(it.id, pid) > 0)

  const isConfirmed = (pid: string): boolean => {
    const p = participants.find((x) => x.id === pid)
    if (p && !p.self_joined) return hasAssignment(pid)
    return confirmations.some((c) => c.participant_id === pid)
  }
  const explicitConfirmed = (pid: string): boolean => confirmations.some((c) => c.participant_id === pid)
  const allConfirmed = participants.length > 0 && participants.every((p) => isConfirmed(p.id))
  const iConfirmed = !!meId && confirmations.some((c) => c.participant_id === meId)

  const guestStatus = (pid: string): { label: string; color: string; bg: string } => {
    if (explicitConfirmed(pid)) return { label: "✓ bevestigd", color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
   if (hasAssignment(pid)) {
      const p = participants.find((x) => x.id === pid)
      const billFullyAssigned = openUnits === 0 && undecidedShared.length === 0
      if (p && !p.self_joined && billFullyAssigned) return { label: "✓ bevestigd", color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
      return { label: "● bezig", color: "#1499b0", bg: "rgba(90,108,166,0.12)" }
    }
    return { label: "nog niets", color: "#9aa0ab", bg: "rgba(16,24,40,0.05)" }
  }

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowTs) / 1000))
  const billTotal = items.reduce((s, it) => s + itemTotal(it), 0)
  const billOk = (group?.receipt_total ?? null) != null && Math.abs((group?.receipt_total ?? 0) - billTotal) < 0.005
  const goGuests = () => { if (billOk) setAdminTab("guests"); else setShowShareWarn(true) }
  const openUnits = baseItems.filter((it) => !it.is_shared)
    .reduce((s, it) => s + Math.max(0, it.quantity - claimedQty(it.id)), 0)
  const undecidedShared = baseItems.filter((it) => it.is_shared && sharerIds(it.id).length === 0)

  const confirmMe = async () => {
    if (!group || !meId) return
    if (iConfirmed) {
      const row = confirmations.find((c) => c.participant_id === meId)
      if (row) await supabase.from("table_confirmations").delete().eq("id", row.id)
    } else {
      await supabase.from("table_confirmations").insert([{ group_id: group.id, participant_id: meId }])
    }
    await loadAll(group.id)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: start
  // ═══════════════════════════════════════════════════════════════════════════
  if (!group) {
    return (
      <div style={S.page}>
        <div style={{ maxWidth: 420, margin: "40px auto" }}>
          <button onClick={goToChooser} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#8a93a8", background: "none", border: "none", padding: 0, marginBottom: 14, cursor: "pointer" }}>← naar Rundo startscherm</button>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-symbol.png" alt="" style={{ height: 52, width: "auto", objectFit: "contain", display: "block" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-table-logo-dark.png" alt="Rundo Table" style={{ height: 34, width: "auto", objectFit: "contain", display: "block" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, margin: "0 0 24px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-table.png" alt="" style={{ height: 20, width: "auto", objectFit: "contain", display: "block" }} />
            <span style={{ color: "#1499b0", fontSize: 14.5, fontWeight: 700 }}>Scan de rekening en verdeel in groep</span>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 13, color: "#5a6680", fontWeight: 600, marginBottom: 6 }}>Groepsnaam <span style={{ color: "#c0392b" }}>*</span></div>
            <input value={groupName} onChange={(e) => { setStartError(null); setGroupName(e.target.value) }} onKeyDown={(e) => e.key === "Enter" && createGroup()} placeholder="" style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 14 }} />
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 16, fontWeight: 700 }} onClick={createGroup} disabled={busy}>{busy ? "Laden..." : "Groep starten"}</button>
          </div>

          {startError && (
            <div style={{ marginTop: 4, color: "#c0392b", fontSize: 13, background: "#fff0f0", borderRadius: 10, padding: "10px 12px" }}>⚠️ {startError}</div>
          )}

          {myGroups.length > 0 && (
            <div style={{ ...S.card, marginTop: 14 }}>
              <div onClick={() => setShowSaved((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#3b486a" }}>Opgeslagen groepen <span style={{ color: "#9aa0ab", fontWeight: 700 }}>({myGroups.length})</span></span>
                <span style={{ fontSize: 12, color: "#9aa0ab", fontWeight: 700 }}>{showSaved ? "▲ verbergen" : "▼ tonen"}</span>
              </div>
              {showSaved && (
                <div style={{ marginTop: 10 }}>
                  {myGroups.map((g) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <button onClick={() => openSavedGroup(g.id)} disabled={busy} style={{ ...S.btn, flex: 1, minWidth: 0, textAlign: "left", padding: "11px 13px", fontWeight: 700 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: g.role === "admin" ? "#1499b0" : "#9aa0ab" }}>{g.role === "admin" ? "beheerder" : "gast"}{fmtDate(g.created_at ?? g.savedAt) ? ` · ${fmtDate(g.created_at ?? g.savedAt)}` : ""}</span>
                      </button>
                      <button onClick={() => forgetSavedGroup(g.id)} style={{ ...S.iconBtn, flexShrink: 0 }} title="definitief verwijderen">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: identiteit kiezen (wie ben ik) — admin mag overslaan
  // ═══════════════════════════════════════════════════════════════════════════
  const needIdentity = !meId
  if (needIdentity && !isAdmin) {
    return (
      <div style={S.page}>
        <TopBar group={group} isAdmin={isAdmin} onHome={leaveGroup} signedUp={participants.length} totalPersons={participants.reduce((s, p) => s + Math.max(1, p.seats ?? 1), 0)} />
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div style={S.card}>
            <h3 style={S.h3}>👋 Wie ben jij?</h3>
            <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 14 }}>Vul je naam in om mee te doen.</p>

            <IdentityAdder onAdd={joinAsNewPerson} />

            {participants.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(16,24,40,0.1)" }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9aa0ab" }}>of kies jezelf uit de lijst</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(16,24,40,0.1)" }} />
                </div>
                {participants.map((p) => (
                  <button key={p.id} onClick={() => pickMe(p.id)} style={{ ...S.btn, width: "100%", textAlign: "left", marginBottom: 6, padding: "12px 14px", fontWeight: 700 }}>{p.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: hoofd-app
  // ═══════════════════════════════════════════════════════════════════════════
  const me = participants.find((p) => p.id === meId) || null

  return (
    <div style={S.page}>
      <style>{`* { box-sizing: border-box; }`}</style>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {error && (
        <div style={S.errorBanner}>⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {asleep && (
        <div onClick={() => { lastActive.current = Date.now(); setAsleep(false) }} style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 3000, background: "rgba(20,33,58,0.92)", color: "#fff", padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(16,24,40,0.3)", whiteSpace: "nowrap" }}>
          ⏸ Live-updates gepauzeerd — tik om te hervatten
        </div>
      )}

      <TopBar group={group} isAdmin={isAdmin} onHome={leaveGroup} me={me?.name} signedUp={participants.length} totalPersons={participants.reduce((s, p) => s + Math.max(1, p.seats ?? 1), 0)} guestSeats={meId ? seatsOf(meId) : undefined} onGuestSeatsChange={meId ? (n) => setSeats(meId, n) : undefined} onSwitchPerson={meId ? switchPerson : undefined} />

      {group.finalized && (() => {
        const disputers = parseDisputes(group.disputed_by || "")
        const openCount = disputers.filter((d) => !d.resolved).length
        return (
          <div style={{ background: "linear-gradient(135deg,#1f8a4c,#27ae60)", color: "#fff", borderRadius: 14, padding: "12px 16px", marginBottom: 14, boxShadow: "0 6px 18px -6px rgba(39,174,96,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>Alles nagekeken — dit is de definitieve verdeling</div>
                <div style={{ fontSize: 12, opacity: 0.92 }}>De beheerder heeft de rekening afgerond. {isAdmin ? "Gasten kunnen niets meer wijzigen." : "Bekijk je deel hieronder."}</div>
              </div>
            </div>
            {isAdmin && disputers.length > 0 && (
              <div style={{ marginTop: 10, background: "#fff7e6", border: "1.5px solid #f0b840", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#8a5a00" }}>
                <div style={{ fontWeight: 800, marginBottom: 6, color: "#a06b00" }}>{openCount > 0 ? "⚠️ Opmerkingen — vink af wat je gecheckt hebt:" : "✓ Alle opmerkingen afgehandeld"}</div>
                {disputers.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, opacity: d.resolved ? 0.7 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0, textDecoration: d.resolved ? "line-through" : "none" }}>
                      <b>{d.name}</b>{d.comment ? <span>: “{d.comment}”</span> : ""}
                      {d.resolved && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: "#1f8a4c", background: "rgba(39,174,96,0.14)", borderRadius: 6, padding: "1px 6px", textDecoration: "none", display: "inline-block" }}>opgelost</span>}
                    </div>
                    <button onClick={() => resolveDispute(d.name, !d.resolved)} style={{ flexShrink: 0, border: d.resolved ? "1px solid rgba(16,24,40,0.2)" : "none", background: d.resolved ? "#fff" : "linear-gradient(135deg,#1f8a4c,#27ae60)", color: d.resolved ? "#5a6680" : "#fff", borderRadius: 9, padding: "5px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {d.resolved ? "↩ Terug openen" : "Markeer als opgelost"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <button onClick={() => finalizeBill(false)} style={{ marginTop: 10, width: "100%", padding: "10px 0", fontSize: 13.5, fontWeight: 800, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.92)", color: "#1f8a4c", cursor: "pointer" }}>
                🔓 Rekening heropenen — gasten kunnen weer wijzigen
              </button>
            )}
          </div>
        )
      })()}

      {isAdmin && (
        <div style={S.tabBar}>
          {([
            { id: "scan", label: "🧾 Bon" },
            { id: "guests", label: "👥 Gasten & delen" },
            { id: "overview", label: "📊 Toewijzen" },
          ] as { id: AdminTab; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => setAdminTab(t.id)} style={{
              flex: 1, border: "none", borderRadius: 12, padding: "10px 4px", fontSize: 13, cursor: "pointer",
              fontWeight: adminTab === t.id ? 800 : 600,
              background: adminTab === t.id ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "transparent",
              color: adminTab === t.id ? "#fff" : "#1499b0",
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Subtiele bon-preview, in elke tab beschikbaar (behalve op de Bon-tab, die heeft z'n eigen knop) */}
      {group.receipt_url && adminTab !== "scan" && (
        <div style={{ textAlign: "right", marginTop: -6, marginBottom: 10 }}>
          <button onClick={() => setViewReceipt(group.receipt_url!)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1499b0", padding: "2px 4px" }}>🧾 Bon bekijken</button>
        </div>
      )}

      {/* ─── ADMIN: Bon & items ─── */}
      {isAdmin && adminTab === "scan" && (
        <div>
          {group.receipt_url ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 10, marginTop: -4 }}>
              <button onClick={() => setViewReceipt(group.receipt_url!)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1499b0", padding: "2px 4px" }}>🧾 Bon bekijken</button>
              <button onClick={startRescan} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#9aa0ab", padding: "2px 4px" }}>🔄 Bon opnieuw scannen</button>
            </div>
          ) : (
            <button onClick={() => setShowScan(true)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "15px 0", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Start hier — Rekening scannen 📸</button>
          )}

          {/* Scan-label bovenaan: vinkje bij AI-succes; duidelijke waarschuwing + retry bij lokale terugval */}
          {items.length > 0 && scanSource === "ai" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 10px", padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: "rgba(16,24,40,0.04)", border: "1px solid rgba(16,24,40,0.1)", color: "#5a6680" }}>
              <span>Scan gelukt en items herkend <span style={{ color: "#1f8a4c", fontWeight: 800 }}>✓</span></span>
            </div>
          )}

          {/* Bon-totaal: ja/neen blijft altijd beschikbaar. Ja = totaal klopt (items nakijken). Neen = aanpassen + bevestigen. */}
          {items.length > 0 && (() => {
            const entered = group?.receipt_total ?? null
            const match = entered != null && Math.abs(entered - billTotal) < 0.005
            const mismatch = entered != null && !match
            const saveTotal = () => { setReceiptConfirmed(false); const raw = (receiptInputRef.current?.value ?? "").trim().replace(",", "."); if (raw === "") { setReceiptTotal(null); return } const n = parseFloat(raw); if (!isNaN(n) && n >= 0) setReceiptTotal(+n.toFixed(2)) }
            const greenState = !receiptEditing && (match || (mismatch && receiptConfirmed))
            const jaBtn = { border: "none", background: "#27ae60", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }
            const neenBtn = { border: "1.5px solid rgba(20,33,58,0.2)", background: "#fff", color: "#5a6680", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }
            const jaNeen = (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <button onClick={() => { setReceiptConfirmed(true); setReceiptEditing(false) }} style={{ ...jaBtn, opacity: (greenState) ? 1 : 0.55 }}>Ja</button>
                <button onClick={() => { setReceiptEditing(true); setReceiptConfirmed(false); setTimeout(() => { receiptInputRef.current?.focus(); receiptInputRef.current?.select() }, 0) }} style={{ ...neenBtn, ...(receiptEditing ? { borderColor: "#1499b0", color: "#1499b0" } : {}) }}>Neen</button>
              </span>
            )
            return (
              <div style={{ ...S.card, padding: "11px 14px", marginBottom: 12, background: greenState ? "rgba(39,174,96,0.06)" : mismatch ? "rgba(224,107,94,0.06)" : "#fff", border: greenState ? "1.5px solid rgba(39,174,96,0.45)" : mismatch ? "1.5px solid rgba(224,107,94,0.5)" : "1px solid rgba(16,24,40,0.08)" }}>
                {entered == null ? (
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#5a6680", marginBottom: 8 }}>Vul het totaal van de bon in — items: €{billTotal.toFixed(2).replace(".", ",")}</span>
                ) : receiptEditing ? (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#14213a", marginBottom: 6 }}>Vul het correcte rekeningtotaal in zoals op de bon</span>
                ) : match ? (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#14213a", marginBottom: 6 }}>Kijk op je bon — klopt dit totaalbedrag?</span>
                ) : receiptConfirmed ? (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#1f8a4c", marginBottom: 6 }}>✓ Totaalbedrag klopt met de bon</span>
                ) : (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#c0392b", marginBottom: 6 }}>⚠️ Kijk op je bon — klopt dit totaalbedrag?</span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9aa0ab" }}>Rekeningtotaal op de bon: €</span>
                  <input ref={receiptInputRef} type="text" inputMode="decimal" defaultValue={entered != null ? entered.toFixed(2).replace(".", ",") : ""} key={entered ?? "leeg"} placeholder="bv. 65.90"
                    onInput={(e) => { e.currentTarget.value = numFilter(e.currentTarget.value) }}
                    onBlur={saveTotal}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    style={{ ...S.input, width: 100, padding: "6px 9px", fontSize: 16, fontWeight: 700 }} />
                  {greenState && <span title="Bon-totaal bevestigd" style={{ color: "#1f8a4c", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                  {receiptEditing && (
                    <button onClick={() => { saveTotal(); setReceiptConfirmed(true); setReceiptEditing(false) }} title="Bevestig dit bedrag" style={{ ...jaBtn }}>✓ Bevestig</button>
                  )}
                  {entered != null && jaNeen}
                </div>
                {match && !receiptEditing && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#5a6680", lineHeight: 1.5 }}>
                    ⚠️ Controleer alles goed — bedrag correct, maar een scan kan fouten bevatten, zeker bij een onduidelijke bon. Kijk namen, aantallen en prijzen na, en markeer gedeelde items indien nodig.
                  </div>
                )}
                {mismatch && receiptConfirmed && !receiptEditing && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#8a4514", lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>Het totaalbedrag klopt met de bon, maar het itemtotaal (€{billTotal.toFixed(2).replace(".", ",")}) is €{Math.abs(billTotal - (entered ?? 0)).toFixed(2).replace(".", ",")} {billTotal > (entered ?? 0) ? "hoger" : "lager"} dan het rekeningtotaal (€{(entered ?? 0).toFixed(2).replace(".", ",")}). Een scan kan fouten bevatten — controleer hieronder alles goed:</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li>prijzen/aantallen correct?</li>
                      <li>BTW/andere kosten/kortingen?</li>
                    </ul>
                  </div>
                )}
              </div>
            )
          })()}

          {items.length > 0 && group?.receipt_total != null && Math.abs((group.receipt_total ?? 0) - billTotal) < 0.005 && (
            <button onClick={goGuests} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginBottom: 10, padding: "9px 0", fontSize: 13, fontWeight: 800, boxShadow: "0 0 0 2px rgba(39,174,96,0.5), 0 6px 16px -6px rgba(39,174,96,0.6)" }}>✓ Alles klopt — ga naar Gasten en delen →</button>
          )}

          {items.length > 0 && (
          <ItemList
            items={baseItems} claimedQty={claimedQty} participants={participants} claimsForItem={claimsForItem}
            sharerIds={sharerIds} shareHeads={shareHeads} toggleShareClaim={toggleShareClaim} setShareFixed={setShareFixed}
            onEdit={setEditItem} onToggleShared={toggleShared} onDelete={deleteItem} onAddManual={() => openNewItem("bill")} bareBill
            recentItemId={recentItemId} onGoGuests={goGuests}
            scanFlags={scanFlags}
            billOk={group?.receipt_total != null && Math.abs((group.receipt_total ?? 0) - billTotal) < 0.005}
            taxLines={taxItems.map((t) => ({ name: t.name, amount: taxAmount(t) }))}
            taxNode={
              <div style={{ marginTop: 6 }}>
                {taxItems.map((t) => {
                  const overAll = t.distribute === "all"
                  const targetCount = taxTargetIds(t).size
                  const open = taxConfig === t.id
                  return (
                    <div key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 9, marginTop: 9 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 17, flexShrink: 0 }}>🧮</span>
                        <input value={t.name} onChange={(e) => setItems((cur) => cur.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x))}
                          onBlur={(e) => { if (group?.finalized) { setToast("Heropen de rekening eerst om iets te wijzigen."); loadAll(group.id); return } supabase.from("table_items").update({ name: e.target.value }).eq("id", t.id).then(() => loadAll(group.id)) }}
                          style={{ ...S.input, flex: 1, minWidth: 0, fontWeight: 700, padding: "8px 10px" }} />
                        {t.tax_rate ? (
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a", whiteSpace: "nowrap" }}>€{taxAmount(t).toFixed(2).replace(".", ",")}</span>
                        ) : (
                          <>
                            <span style={{ color: "#999", fontSize: 13 }}>€</span>
                            <input type="number" step="0.01" defaultValue={t.unit_price ? t.unit_price.toFixed(2) : ""} placeholder="0.00"
                              onBlur={(e) => { if (group?.finalized) { setToast("Heropen de rekening eerst om iets te wijzigen."); loadAll(group.id); return } const v = parseFloat(e.target.value.replace(",", ".")) || 0; supabase.from("table_items").update({ unit_price: v, quantity: 1 }).eq("id", t.id).then(() => loadAll(group.id)) }}
                              style={{ ...S.input, width: 78, textAlign: "right", padding: "8px 8px" }} />
                          </>
                        )}
                        <button style={{ ...S.iconBtn, background: open ? "rgba(90,108,166,0.18)" : "rgba(16,24,40,0.05)" }} onClick={() => setTaxConfig(open ? null : t.id)} title="verdeling">⚙️</button>
                        <button style={S.iconBtn} onClick={() => deleteItem(t.id)} title="verwijderen">🗑️</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, marginLeft: 25, flexWrap: "wrap" }}>
                        {[6, 12, 21].map((r) => (
                          <button key={r} onClick={() => setTaxRate(t, r)} style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 9, padding: "4px 11px", cursor: "pointer", border: t.tax_rate === r ? "none" : "1px solid rgba(16,24,40,0.14)", background: t.tax_rate === r ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: t.tax_rate === r ? "#fff" : "#5a6680" }}>{r}%</button>
                        ))}
                        <button onClick={() => setTaxRate(t, null)} style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 9, padding: "4px 11px", cursor: "pointer", border: !t.tax_rate ? "none" : "1px solid rgba(16,24,40,0.14)", background: !t.tax_rate ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: !t.tax_rate ? "#fff" : "#5a6680" }}>vast bedrag</button>
                      </div>
                      <div style={{ fontSize: 10.5, color: "#9aa0ab", marginTop: 4, marginLeft: 25 }}>
                        {t.tax_rate ? `${t.tax_rate}% ` : ""}verdeeld {overAll ? "over de hele rekening" : `over ${targetCount} gekozen item${targetCount === 1 ? "" : "s"}`} · tik ⚙️ om te wijzigen
                      </div>
                      <div style={{ marginLeft: 25, marginTop: 4 }}>
                        <button onClick={() => deleteItem(t.id)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#c0685c" }}>✕ Toch geen extra kosten? Weghalen</button>
                      </div>
                      {open && (
                        <div style={{ marginLeft: 25, marginTop: 8, padding: 10, borderRadius: 12, background: "#fbfaff", border: "1px solid rgba(90,108,166,0.2)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 5 }}>Hoe verdelen?</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: overAll ? 0 : 8 }}>
                            <button onClick={() => setDistribute(t, "all")} style={{ flex: 1, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 6px", cursor: "pointer", border: overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: overAll ? "#fff" : "#5a6680" }}>📊 Over de hele rekening</button>
                            <button onClick={() => { if (overAll) setDistribute(t, JSON.stringify(baseItems.map((i) => i.id))) }} style={{ flex: 1, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 6px", cursor: "pointer", border: !overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: !overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: !overAll ? "#fff" : "#5a6680" }}>🎯 Over bepaalde items{!overAll ? ` (${targetCount})` : ""}</button>
                          </div>
                          {!overAll && (() => {
                            let ids: string[] = []
                            try { ids = JSON.parse(t.distribute || "[]") } catch { ids = [] }
                            const allOn = baseItems.length > 0 && baseItems.every((bi) => ids.includes(bi.id))
                            return (
                            <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#a06b00" }}>👉 Tik aan welke items deze kost dragen.</div>
                                <button onClick={() => setDistribute(t, allOn ? "[]" : JSON.stringify(baseItems.map((i) => i.id)))} style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 8, padding: "3px 9px", cursor: "pointer", border: "1px solid rgba(90,108,166,0.3)", background: "#fff", color: "#1499b0", whiteSpace: "nowrap", flexShrink: 0 }}>{allOn ? "alles uit" : "alles aan"}</button>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {baseItems.map((bi) => {
                                  const on = ids.includes(bi.id)
                                  return (
                                    <button key={bi.id} onClick={() => { const next = on ? ids.filter((x) => x !== bi.id) : [...ids, bi.id]; setDistribute(t, JSON.stringify(next)) }}
                                      style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: on ? "none" : "1px solid rgba(16,24,40,0.12)", background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff", color: on ? "#5a4a1a" : "#8b93a8" }}>{on ? "✓ " : "+ "}{bi.name}</button>
                                  )
                                })}
                              </div>
                            </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => setTaxModal({ name: "BTW of andere kosten", amount: "", scope: "all", ids: [] })} style={{ ...S.btn, fontWeight: 700, fontSize: 12.5, padding: "7px 14px" }}>🧮 BTW / kosten / korting</button>
                  <button onClick={() => setShowTaxInfo(true)} style={{ ...S.btn, fontWeight: 700, fontSize: 12.5, padding: "7px 12px" }} title="uitleg">ℹ️</button>
                </div>
              </div>
            }
          />
          )}
        </div>
      )}

      {/* ─── ADMIN: Gasten & delen ─── */}
      {isAdmin && adminTab === "guests" && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...S.card, order: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h3 style={{ ...S.h3, marginBottom: 0, minWidth: 0 }}>👥 Of voeg zelf alvast gasten toe</h3>
              <button style={{ ...S.btn, ...S.btnPrimary, padding: "7px 14px", fontWeight: 700, fontSize: 13, flexShrink: 0 }} onClick={() => setShowAddGuest((v) => !v)}>{showAddGuest ? "✕ Sluiten" : "+ Toevoegen"}</button>
            </div>
            <div style={{ marginTop: 4, marginBottom: 2 }}>
              <div style={{ fontSize: 12, color: "#9aa0ab", lineHeight: 1.5 }}>• Ze kunnen dan hun naam selecteren via QR/link hierboven</div>
              <div style={{ fontSize: 12, color: "#9aa0ab", lineHeight: 1.5 }}>• ...of jij kan voor hen zelf drankjes/gerechten toewijzen</div>
            </div>
            {showAddGuest && (
              <div style={{ marginTop: 10, marginBottom: 6, background: "rgba(90,108,166,0.06)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input value={newGuest} onChange={(e) => setNewGuest(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addGuest(undefined, false, newGuestSeats); setNewGuestSeats(1) } }} placeholder="Naam" style={{ ...S.input, flex: 1, minWidth: 110 }} autoFocus />
                  <SeatsControl n={newGuestSeats} onChange={setNewGuestSeats} showLabel />
                  <button style={{ ...S.btn, ...S.btnPrimary, padding: "0 18px", fontWeight: 700 }} onClick={() => { addGuest(undefined, false, newGuestSeats); setNewGuestSeats(1) }}>+ Toevoegen</button>
                </div>
                <div style={{ fontSize: 11, color: "#9aa0ab", marginTop: 6 }}>Met meerdere (bv. koppel)? Zet het aantal personen met de knopjes.</div>
              </div>
            )}

            {participants.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9aa0ab" }}>{participants.length} {participants.length === 1 ? "gast" : "gasten"} · tik een naam om te wijzigen</span>
                <button onClick={() => setManageGuests((v) => !v)} style={{ ...S.smallBtn, flexShrink: 0, ...(manageGuests ? { borderColor: "rgba(224,107,94,0.6)", color: "#c0392b", background: "rgba(224,107,94,0.06)" } : {}) }}>{manageGuests ? "✓ Klaar" : "🗑️ Verwijderen"}</button>
              </div>
            )}

            {(() => {
              const twoCol = participants.length > 5
              const nameInput = (p: Participant, fontSize: number) => (
                <input defaultValue={p.name} key={p.name}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) renameGuest(p.id, v); else e.target.value = p.name }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                  style={{ flex: 1, minWidth: 0, width: "100%", border: "none", borderBottom: "1px dashed rgba(16,24,40,0.22)", background: "transparent", fontWeight: 700, fontSize, color: "#14213a", padding: "3px 2px", outline: "none" }} />
              )
              const delBtn = (p: Participant) => (
                <button onClick={() => removeGuest(p.id)} title="verwijderen" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: "none", background: "rgba(224,107,94,0.14)", color: "#c0392b", fontSize: 15, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>×</button>
              )
              const Row = (p: Participant) => {
                const origin = p.self_joined
                  ? { label: "zelf aangemeld", color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
                  : { label: "via admin", color: "#1499b0", bg: "rgba(90,108,166,0.12)" }
                if (twoCol) {
                  return (
                    <div key={p.id} style={{ border: manageGuests ? "1px solid rgba(224,107,94,0.4)" : "1px solid rgba(16,24,40,0.08)", borderRadius: 12, padding: "7px 8px", background: manageGuests ? "rgba(224,107,94,0.04)" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <SeatsControl n={Math.max(1, p.seats ?? 1)} onChange={(next) => setSeats(p.id, next)} compact />
                        {nameInput(p, 13.5)}
                        {manageGuests && delBtn(p)}
                      </div>
                      <div style={{ marginTop: 5 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: origin.color, background: origin.bg, borderRadius: 7, padding: "1px 6px" }}>{origin.label}</span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <SeatsControl n={Math.max(1, p.seats ?? 1)} onChange={(next) => setSeats(p.id, next)} compact />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {nameInput(p, 15)}
                      <div style={{ marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: origin.color, background: origin.bg, borderRadius: 7, padding: "1px 7px" }}>{origin.label}</span>
                      </div>
                    </div>
                    {manageGuests && delBtn(p)}
                  </div>
                )
              }
              return (
                <div style={{ marginTop: participants.length > 0 ? 8 : (showAddGuest ? 6 : 12) }}>
                  {participants.length === 0
                    ? <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Nog geen gasten — voeg er toe of deel de link hierboven <span style={{ fontStyle: "italic" }}>(tip: vergeet jezelf niet!)</span></div>
                    : twoCol
                    ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{participants.map(Row)}</div>
                    : participants.map(Row)}
                </div>
              )
            })()}
          </div>

          <div style={{ ...S.card, order: 1 }}>
            {(() => {
              const entered = group?.receipt_total ?? null
              const match = entered != null && Math.abs(entered - billTotal) < 0.005
              return match ? (
                <div style={{ background: "rgba(39,174,96,0.10)", border: "1px solid rgba(39,174,96,0.5)", borderRadius: 10, padding: "7px 11px", marginBottom: 10, fontSize: 12.5, fontWeight: 700, color: "#1f8a4c" }}>✅ Bon-totaal en items kloppen — je kan delen.</div>
              ) : (
                <div style={{ background: "rgba(224,107,94,0.1)", border: "1px solid rgba(224,107,94,0.55)", borderRadius: 10, padding: "8px 11px", marginBottom: 10, fontSize: 12.5, fontWeight: 700, color: "#c0392b", lineHeight: 1.45 }}>
                  ⚠️ Het bon-totaal klopt nog niet met de items. Zet dit eerst recht op de <b>Bon</b>-tab vóór je met je gasten deelt.
                </div>
              )
            })()}
            <h3 style={S.h3}>🔗 Laat je gasten meedoen</h3>
            <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 12 }}>Deel deze groep via de QR-code of de link.</p>
            {(() => {
              const link = typeof window !== "undefined" ? `${window.location.origin}/table?code=${group.invite_code}` : ""
              const invite = `Je bent uitgenodigd voor "${group.name}" — verdeel mee de rekening via Rundo Table 👉 ${link}`
              return (
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
                    <QRCodeSVG value={link} size={120} bgColor="#ffffff" fgColor="#1b2a4a" />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 12.5, color: "#3b486a", lineHeight: 1.5, marginBottom: 8 }}>Je gasten komen zo in <b>{group.name}</b> om mee de rekening te verdelen.</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 6 }}>Deelbare link</div>
                    <div style={{ fontSize: 12, color: "#5a6680", wordBreak: "break-all", background: "rgba(20,33,58,0.04)", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>{link}</div>
                    <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", fontWeight: 700 }} onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(invite); setToast("Uitnodiging gekopieerd") } }}>📋 Uitnodiging kopiëren</button>
                  </div>
                </div>
              )
            })()}
          </div>

          <button onClick={() => setAdminTab("overview")} style={{ ...S.btn, ...S.btnPrimary, width: "100%", order: 3, marginTop: 14, padding: "13px 0", fontSize: 15, fontWeight: 700 }}>📊 Naar toewijzen →</button>
        </div>
      )}

      {/* ─── ADMIN: Stand van zaken (bovenaan overzicht-tab) ─── */}
      {isAdmin && adminTab === "overview" && (
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#3b486a", marginBottom: 8 }}>📊 Overzicht</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Stat label="Totaalbedrag" value={`€${billTotal.toFixed(2).replace(".", ",")}`} tone="navy" />
            <div onClick={() => { if (typeof document !== "undefined") document.getElementById("rekening-per-persoon")?.scrollIntoView({ behavior: "smooth", block: "start" }) }} style={{ flex: 1, cursor: "pointer", textAlign: "center", background: "rgba(233,196,95,0.16)", borderRadius: 12, padding: "8px 6px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2 }} title="naar de rekening per persoon">
              <span style={{ fontSize: 12, fontWeight: 800, color: "#a06b00", lineHeight: 1.25 }}>Rekening per persoon bekijken</span>
            </div>
            {openUnits > 0 ? (
              <div onClick={() => setShowTodo((v) => !v)} style={{ flex: 1, cursor: "pointer" }}>
                <Stat label="Nog niet geclaimd" value={`${openUnits}`} tone="red" />
              </div>
            ) : (
              <div style={{ flex: 1, textAlign: "center", background: "rgba(39,174,96,0.12)", borderRadius: 12, padding: "8px 4px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60", lineHeight: 1 }}>✓</div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#27ae60", lineHeight: 1.15 }}>Alles geclaimd</div>
              </div>
            )}
          </div>
          {showTodo && (openUnits > 0 || undecidedShared.length > 0) && (
            <div style={{ marginTop: 10, border: "1px solid rgba(224,107,94,0.35)", background: "rgba(224,107,94,0.05)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#c0392b", marginBottom: 6 }}>⚠️ Nog te regelen — wijs snel toe</div>
              {participants.length === 0 && <div style={{ fontSize: 12, color: "#a06b00", marginBottom: 6 }}>Voeg eerst gasten toe om te kunnen toewijzen.</div>}
              {items.filter((it) => !it.is_shared && it.quantity - claimedQty(it.id) > 0).map((it) => {
                const openN = it.quantity - claimedQty(it.id)
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{openN}× {it.name}</b> niet geclaimd</span>
                    {participants.length > 0 && (
                      <select value="" onChange={(e) => { const pid = e.target.value; if (pid) setClaim(it.id, pid, myQty(it.id, pid) + 1) }}
                        style={{ ...S.input, flexShrink: 0, maxWidth: 150, padding: "5px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        <option value="">+ wijs toe…</option>
                        {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
              {undecidedShared.map((it) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "#a06b00" }}>
                  <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5 }}><ShareIcon on size={14} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{it.name}</b> — gedeeld, nog niemand</span></span>
                  {participants.length > 0 && (
                    <select value="" onChange={(e) => { const pid = e.target.value; if (pid) toggleShareClaim(it.id, pid) }}
                      style={{ ...S.input, flexShrink: 0, maxWidth: 150, padding: "5px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <option value="">+ laat meedelen…</option>
                      {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Aantikken & bewerken (admin op overzicht-tab óf gast-hoofdscherm) ─── */}
      {((isAdmin && adminTab === "overview") || !isAdmin) && (
        <>
          <ClaimScreen
            items={baseItems} meId={meId} me={me} isAdmin={isAdmin}
            participants={participants}
            claimedQty={claimedQty} myQty={myQty} sharerIds={sharerIds}
            shareHeads={shareHeads} myShareHeads={myShareHeads} seatsOf={seatsOf} setSeats={setSeats}
            setClaim={setClaim} toggleShareClaim={toggleShareClaim}
            itemTotal={itemTotal} personTotal={personTotal} personItems={personItems}
            sharedRevealed={sharedRevealed} allConfirmed={allConfirmed} isConfirmed={isConfirmed} explicitConfirmed={explicitConfirmed}
            claimMode={claimMode} setClaimMode={setClaimMode} claimPid={claimPid} setClaimPid={setClaimPid}
            iConfirmed={iConfirmed} confirmMe={confirmMe}
            onPickMe={pickMe}
            finalized={!!group.finalized} iDispute={!!me && parseDisputes(group.disputed_by || "").some((d) => d.name === me.name)} iResolved={!!me && parseDisputes(group.disputed_by || "").some((d) => d.name === me.name && d.resolved)} iComment={(me && parseDisputes(group.disputed_by || "").find((d) => d.name === me.name)?.comment) || ""} onToggleDispute={(on, comment) => { if (me) flagDispute(me.name, on, comment) }}
          />
        </>
      )}

      {/* ─── ADMIN: Per persoon (overzicht-tab) ─── */}
      {isAdmin && adminTab === "overview" && (
        <div id="rekening-per-persoon">
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ ...S.h3, marginBottom: 0 }}>🧾 Per persoon</h3>
              {participants.length > 0 && (() => {
                const allOpen = participants.every((p) => expandedPeople.has(p.id))
                return (
                  <button style={S.smallBtn} onClick={() => setExpandedPeople(allOpen ? new Set() : new Set(participants.map((p) => p.id)))}>
                    {allOpen ? "▲ Alles dicht" : "▼ Alles open"}
                  </button>
                )
              })()}
            </div>
            {participants.map((p) => {
              const t = personTotal(p.id)
              const st = guestStatus(p.id)
              const open = expandedPeople.has(p.id)
              const detail = personItems(p.id)
              return (
                <div key={p.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <div onClick={() => setExpandedPeople((cur) => { const n = new Set(cur); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", cursor: "pointer" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "#9aa0ab", width: 12, display: "inline-block", flexShrink: 0 }}>{open ? "▼" : "▶"}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 8, padding: "1px 7px", flexShrink: 0 }}>{st.label}</span>
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: "#14213a", flexShrink: 0, marginLeft: 8 }}>€{t.settled.toFixed(2).replace(".", ",")}{t.pendingShared ? "+" : ""}</span>
                  </div>
                  {open && (
                    <div style={{ padding: "2px 4px 12px 23px" }}>
                      {detail.length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>Nog niets aangetikt.</div>}
                      {detail.map((d, k) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#5a6680", padding: "2px 0" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{d.shared && <ShareIcon on size={14} />}{d.qty > 1 ? `${d.qty}× ` : ""}{d.name}{d.shared ? (d.revealed ? ((p.seats ?? 1) > 1 ? ` (gedeeld, ${d.myHeads} pers.)` : " (gedeeld deel)") : ` (gedeeld door ${d.sharers})`) : ""}</span>
                          <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>
                            {d.shared && !d.revealed ? "nog te verdelen" : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2).replace(".", ",")}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Nog geen gasten</div>}
          </div>

          {group.finalized ? (
            <button onClick={() => finalizeBill(false)} style={{ ...S.btn, width: "100%", padding: "13px 0", fontSize: 14.5, fontWeight: 800, background: "linear-gradient(135deg,#f39c12,#e67e22)", border: "none", color: "#fff", boxShadow: "0 6px 16px -6px rgba(230,126,34,0.6)" }}>
              🔓 Rekening heropenen (gasten kunnen weer wijzigen)
            </button>
          ) : (
            <button onClick={() => {
              if (openUnits > 0 || undecidedShared.length > 0) {
                const delen: string[] = []
                if (openUnits > 0) delen.push(`${openUnits} ${openUnits === 1 ? "consumptie is" : "consumpties zijn"} nog niet toegewezen`)
                if (undecidedShared.length > 0) delen.push(`${undecidedShared.length} gedeeld ${undecidedShared.length === 1 ? "item wordt" : "items worden"} door niemand genomen`)
                alert(`De rekening kan nog niet afgesloten worden:\n\n• ${delen.join("\n• ")}\n\nWijs eerst alles toe. Bekijk via "Nog niet geclaimd" wat er nog openstaat.`)
                setShowTodo(true)
                return
              }
              if (!billOk) { setShowFinalizeWarn(true); return }
              if (confirm("De rekening afsluiten? Gasten kunnen daarna niets meer aantikken of wijzigen tot je ze heropent.")) finalizeBill(true)
            }} style={{ ...S.btn, width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#1f8a4c,#27ae60)", color: "#fff", boxShadow: "0 6px 16px -6px rgba(39,174,96,0.6)" }}>
              ✅ Alles toegewezen?  Rekening afsluiten
            </button>
          )}
          <div style={{ fontSize: 11, color: "#9aa0ab", textAlign: "center", marginTop: 6, marginBottom: 4 }}>
            {group.finalized ? "De rekening is afgesloten — iedereen ziet de definitieve verdeling." : "Sluit pas af als alles is aangetikt en nagekeken. Gasten krijgen dan een melding."}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={() => { if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }) }} style={{ ...S.btn, fontSize: 12.5, fontWeight: 700, padding: "8px 16px" }}>↑ Terug naar boven</button>
          </div>
        </div>
      )}

      {/* ─── Venster: BTW / kosten / korting toevoegen (stap 1: bedrag, stap 2: verdeling) ─── */}
      {taxModal && (() => {
        const hasAmount = !!taxModal.amount.trim() && (parseFloat(taxModal.amount.replace(",", ".")) || 0) !== 0
        return (
        <div style={S.overlay} onClick={() => setTaxModal(null)}>
          <div style={{ ...S.modal, width: 360, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 800 }}>🧮 BTW / kosten / korting</h3>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6680" }}>Omschrijving</label>
            <input value={taxModal.name} onChange={(e) => setTaxModal({ ...taxModal, name: e.target.value })} placeholder="bv. Bediening, Couvert, Korting" style={{ ...S.input, width: "100%", boxSizing: "border-box", margin: "4px 0 12px" }} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6680" }}>Bedrag € (gebruik een minteken voor een korting)</label>
            <input type="text" inputMode="decimal" value={taxModal.amount} onChange={(e) => setTaxModal({ ...taxModal, amount: numFilter(e.target.value, true) })} placeholder="bv. 5.00" style={{ ...S.input, width: "100%", boxSizing: "border-box", margin: "4px 0 16px", fontSize: 16 }} autoFocus />
            {!hasAmount ? (
              <div style={{ fontSize: 12, color: "#9aa0ab", marginBottom: 12 }}>Vul een bedrag in om verder te gaan.</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5a6680", marginBottom: 6 }}>Verdelen over:</div>
                <button onClick={() => confirmTaxModal("all")} style={{ width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", border: "1.5px solid rgba(20,153,176,0.4)", background: "rgba(20,153,176,0.08)", color: "#14213a" }}>📊 Over de hele rekening</button>
                <button onClick={() => setTaxModal({ ...taxModal, scope: "items" })} style={{ width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", border: taxModal.scope === "items" ? "2px solid #1499b0" : "1.5px solid rgba(20,33,58,0.15)", background: taxModal.scope === "items" ? "rgba(20,153,176,0.08)" : "#fff", color: "#14213a" }}>🎯 Over bepaalde items</button>
                {taxModal.scope === "items" && (
                  <>
                    <div style={{ margin: "4px 0 8px", maxHeight: 200, overflowY: "auto", border: "1px solid rgba(20,33,58,0.12)", borderRadius: 10, padding: "6px 4px" }}>
                      {baseItems.length === 0 && <div style={{ fontSize: 12, color: "#9aa0ab", padding: 8 }}>Nog geen items.</div>}
                      {baseItems.map((it) => {
                        const on = taxModal.ids.includes(it.id)
                        return (
                          <button key={it.id} onClick={() => setTaxModal({ ...taxModal, ids: on ? taxModal.ids.filter((x) => x !== it.id) : [...taxModal.ids, it.id] })} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px", border: "none", background: on ? "rgba(20,153,176,0.08)" : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                            <span style={{ width: 18, height: 18, borderRadius: 5, border: on ? "none" : "1.5px solid #b8c0cf", background: on ? "#1499b0" : "#fff", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{on ? "✓" : ""}</span>
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{it.quantity}× {it.name}</span>
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => confirmTaxModal("items")} disabled={taxModal.ids.length === 0} style={{ ...S.btn, ...S.btnPrimary, width: "100%", fontWeight: 800, opacity: taxModal.ids.length === 0 ? 0.5 : 1 }}>Bevestigen</button>
                  </>
                )}
              </>
            )}
            <button onClick={() => setTaxModal(null)} style={{ ...S.btn, width: "100%", fontWeight: 700, marginTop: 10 }}>Annuleren</button>
          </div>
        </div>
        )
      })()}

      {/* ─── Waarschuwing: delen terwijl item- en bontotaal niet overeenkomen ─── */}
      {showShareWarn && (() => {
        const entered = group?.receipt_total ?? null
        const diff = entered != null ? Math.abs(billTotal - entered) : null
        return (
          <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowShareWarn(false)}>
            <div style={{ ...S.modal, width: 350 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: "#c0392b" }}>⚠️ De totalen kloppen nog niet{diff != null ? ` (verschil €${diff.toFixed(2).replace(".", ",")})` : ""}</h3>
              <p style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, margin: "0 0 8px" }}>{entered == null ? "Vul eerst het totaal van de bon in, of kijk de items na:" : "Kijk dit even na, of vul het juiste bontotaal in zoals op je rekening:"}</p>
              <ul style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 13, color: "#5a6680", lineHeight: 1.6 }}>
                <li>prijzen en aantallen correct?</li>
                <li>BTW / kosten / kortingen toegevoegd?</li>
                <li>gedeelde items aangeduid?</li>
              </ul>
              <button onClick={() => setShowShareWarn(false)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}>Terug naar de bon</button>
              <button onClick={() => { setShowShareWarn(false); setAdminTab("guests") }} style={{ ...S.btn, width: "100%", padding: "9px 0", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#9aa0ab", background: "transparent", border: "none" }}>Toch doorgaan →</button>
            </div>
          </div>
        )
      })()}

      {/* ─── Waarschuwing: afsluiten terwijl item- en bontotaal niet overeenkomen (onomkeerbaar) ─── */}
      {showFinalizeWarn && (() => {
        const entered = group?.receipt_total ?? null
        const diff = entered != null ? Math.abs(billTotal - entered) : null
        return (
          <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowFinalizeWarn(false)}>
            <div style={{ ...S.modal, width: 350 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: "#c0392b" }}>Weet je het zeker?{diff != null ? ` De totalen kloppen nog niet (verschil €${diff.toFixed(2).replace(".", ",")})` : " Het bontotaal is nog niet ingevuld"}</h3>
              <p style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, margin: "0 0 14px" }}>Na het afsluiten kan niemand nog iets wijzigen. Controleer eerst de items of het bontotaal.</p>
              <button onClick={() => setShowFinalizeWarn(false)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}>Terug naar de bon</button>
              <button onClick={() => { setShowFinalizeWarn(false); finalizeBill(true) }} style={{ ...S.btn, width: "100%", padding: "9px 0", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#9aa0ab", background: "transparent", border: "none" }}>Toch afsluiten</button>
            </div>
          </div>
        )
      })()}

      {/* ─── Pop-up: rekening afgesloten (voor de beheerder), met overzicht per persoon ─── */}
      {adminFinalPopup && (
        <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setAdminFinalPopup(false)}>
          <div style={{ ...S.modal, width: 360, maxHeight: "84vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 4 }}>✅</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1f8a4c", margin: "0 0 4px" }}>Rekening afgesloten</h3>
              <p style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, margin: 0 }}>Je gasten kunnen niets meer wijzigen. Dit is de verdeling per persoon:</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {participants.map((p) => {
                const pt = personTotal(p.id)
                return (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(20,153,176,0.06)", border: "1px solid rgba(20,153,176,0.18)" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#14213a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#1499b0", flexShrink: 0 }}>€{pt.settled.toFixed(2).replace(".", ",")}{pt.pendingShared ? "+" : ""}</span>
                  </div>
                )
              })}
              {participants.length === 0 && <div style={{ fontSize: 13, color: "#9aa0ab", textAlign: "center" }}>Nog geen gasten toegevoegd.</div>}
            </div>
            <button onClick={() => setAdminFinalPopup(false)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 14, padding: "12px 0", fontWeight: 800 }}>Sluiten</button>
          </div>
        </div>
      )}

      {/* ─── Modal: bon scannen ─── */}
      {showScan && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 460, maxHeight: "88vh" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>🧾 Rekening scannen</h3>
            <p style={{ fontSize: 12.5, color: "#999", marginBottom: 14 }}>Maak of kies een foto van de rekening. Daarna kan je de herkende items nog nakijken en bijsturen.</p>

            <label style={{ ...S.btn, ...S.btnPrimary, display: "block", textAlign: "center", marginBottom: 14, cursor: scanning ? "default" : "pointer", fontWeight: 700, padding: "14px 0", opacity: scanning ? 0.6 : 1 }}>
              {scanning ? "⏳ Bezig met scannen — even geduld" : scanPreview.length > 0 ? "📷 Andere foto kiezen" : "📷 Foto maken / kiezen"}
              <input type="file" accept="image/*" disabled={scanning} style={{ display: "none" }} onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
            </label>

            {scanning && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 8, background: "rgba(20,33,58,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(scanProgress * 100)}%`, height: "100%", background: "linear-gradient(90deg,#1499b0,#22b8cf)", borderRadius: 4, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: 11, color: "#8a93a3", textAlign: "center", marginTop: 6 }}>De tekst van je bon wordt herkend — even geduld.</div>
              </div>
            )}

            {scanFail && !scanning && (
              <div style={{ marginBottom: 14, border: "1px solid rgba(224,107,94,0.45)", background: "rgba(224,107,94,0.06)", borderRadius: 12, padding: "13px 14px" }}>
                {scanFail.reason === "unavailable" ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#c0392b", marginBottom: 4 }}>😕 De slimme scan is even niet beschikbaar</div>
                    <div style={{ fontSize: 12.5, color: "#8a4514", lineHeight: 1.5, marginBottom: 10 }}>De AI-herkenning is momenteel overbelast of tijdelijk offline. Wacht heel even en probeer opnieuw — meestal is ze na een halve minuut terug. Je foto blijft bewaard.</div>
                    <button onClick={retryAiScan} disabled={cooldownLeft > 0} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 800, opacity: cooldownLeft > 0 ? 0.55 : 1, cursor: cooldownLeft > 0 ? "default" : "pointer" }}>{cooldownLeft > 0 ? `🔄 Opnieuw proberen over ${cooldownLeft}s` : "🔄 Opnieuw proberen"}</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#c0392b", marginBottom: 4 }}>📷 Niets herkend op de foto</div>
                    <div style={{ fontSize: 12.5, color: "#8a4514", lineHeight: 1.5, marginBottom: 10 }}>De scan kon geen items lezen. Maak een scherpere foto — recht van boven, goed belicht en zonder plooien of schaduw — en probeer opnieuw.</div>
                    <label style={{ ...S.btn, ...S.btnPrimary, display: "block", textAlign: "center", padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                      📷 Andere foto kiezen
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
                    </label>
                  </>
                )}
                <button onClick={() => { setScanFail(null); setShowScan(false); if (scanPhotoUrl) { URL.revokeObjectURL(scanPhotoUrl); setScanPhotoUrl(null) } openNewItem("bill") }} style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 12.5, fontWeight: 700 }}>✏️ Zelf items invoeren</button>
                <button onClick={runLocalScan} style={{ width: "100%", marginTop: 8, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "#9aa0ab", textDecoration: "underline", textUnderlineOffset: 2 }}>Toch de snelle scan gebruiken (minder nauwkeurig)</button>
              </div>
            )}

            {scanPhotoUrl && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 6 }}>Jouw foto — vergelijk met de lijst</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scanPhotoUrl} alt="gescande bon" onClick={() => setViewReceipt(scanPhotoUrl)} style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", background: "#faf9f5", cursor: "zoom-in" }} />
              </div>
            )}

            {scanPreview.length > 0 && (() => {
              const _iSum = scanPreview.filter((x) => !x.distribute).reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 0), 0)
              const _tSum = scanPreview.filter((x) => x.distribute).reduce((s, it) => s + (it.unit_price || 0), 0)
              const _bill = parseFloat((scanTotal || "").replace(",", "."))
              const scanMatch = !isNaN(_bill) && _bill > 0 && Math.abs((_iSum + _tSum) - _bill) < 0.01
              return (
              <div style={{ marginBottom: 12, maxHeight: 320, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#c98a00", textTransform: "uppercase" }}>{scanPreview.filter((x) => !x.distribute).length} herkend — controleer en stuur bij</div>
                </div>
                {scanPreview.map((it, i) => ({ it, i })).sort((a, b) => (a.it.distribute ? 1 : 0) - (b.it.distribute ? 1 : 0)).map(({ it, i }) => {
                  const lineTotal = (it.unit_price || 0) * (it.quantity || 0)
                  if (it.distribute) {
                    const overAll = it.distribute === "all"
                    let selIdx: number[] = []
                    if (!overAll) { try { selIdx = (JSON.parse(it.distribute).idx) || [] } catch { selIdx = [] } }
                    const baseRows = scanPreview.map((x, j) => ({ x, j })).filter((o) => !o.x.distribute)
                    return (
                      <div key={i} style={{ border: "1px solid rgba(90,108,166,0.3)", borderRadius: 12, padding: 10, marginBottom: 8, background: "#fbfaff" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                          <span style={{ fontSize: 16 }}>🧮</span>
                          <input value={it.name} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...S.input, flex: 1, minWidth: 0, fontWeight: 700 }} />
                          <span style={{ fontSize: 12, color: "#888" }}>€</span>
                          <input type="number" step="0.01" value={it.unit_price || ""} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, unit_price: parseFloat(e.target.value) || 0, quantity: 1 } : x))} style={{ ...S.input, width: 80, textAlign: "right", padding: "8px 8px" }} />
                          <button onClick={() => setScanPreview((cur) => cur.filter((_, j) => j !== i))} style={{ ...S.iconBtn, flexShrink: 0 }}>✕</button>
                        </div>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 4 }}>Hoe verdelen?</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: !overAll ? 8 : 0 }}>
                          <button onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, distribute: "all" } : x))} style={{ flex: 1, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "8px 6px", cursor: "pointer", border: overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: overAll ? "#fff" : "#5a6680" }}>📊 Over de hele rekening</button>
                          <button onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, distribute: JSON.stringify({ idx: baseRows.map((o) => o.j) }) } : x))} style={{ flex: 1, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "8px 6px", cursor: "pointer", border: !overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: !overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: !overAll ? "#fff" : "#5a6680" }}>🎯 Over bepaalde items{!overAll ? ` (${selIdx.length})` : ""}</button>
                        </div>
                        {!overAll && (
                          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 7 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#a06b00", marginBottom: 6 }}>👉 Tik aan welke items deze kost dragen.</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {baseRows.map(({ x, j }) => {
                                const on = selIdx.includes(j)
                                return (
                                  <button key={j} onClick={() => { const next = on ? selIdx.filter((v) => v !== j) : [...selIdx, j]; setScanPreview((cur) => cur.map((y, k) => k === i ? { ...y, distribute: JSON.stringify({ idx: next }) } : y)) }}
                                    style={{ fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "4px 10px", cursor: "pointer", border: on ? "none" : "1px solid rgba(16,24,40,0.12)", background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff", color: on ? "#5a4a1a" : "#8b93a8" }}>{on ? "✓ " : "+ "}{x.name || "?"}</button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div style={{ fontSize: 10.5, color: "#1499b0", fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>⬇️ Klik daarna onderaan op <b>“Bevestigen &amp; toevoegen”</b> om het op te slaan.</div>
                      </div>
                    )
                  }
                  return (
                    <div key={i} style={{ border: it._isNew ? "1.5px solid #ecc85a" : scanMatch ? "1.5px solid rgba(39,174,96,0.6)" : "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: 9, marginBottom: 8, background: it._isNew ? "rgba(233,196,95,0.16)" : scanMatch ? "rgba(39,174,96,0.07)" : "transparent" }}>
                      {it._isNew && <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a06b00", marginBottom: 6 }}>✨ Net toegevoegd — controleer naam en prijs</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <input value={it.name} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...S.input, flex: 1, minWidth: 0 }} />
                        <button title={it.is_shared ? "gedeeld item — klik om uit te zetten" : "maak hier een gedeeld item van (bv. water, wijn)"} onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, is_shared: !x.is_shared } : x))} style={{ ...S.iconBtn, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: it.is_shared ? "rgba(233,196,95,0.3)" : "rgba(16,24,40,0.05)" }}><ShareIcon on={it.is_shared} /></button>
                        <button onClick={() => setScanPreview((cur) => cur.filter((_, j) => j !== i))} style={{ ...S.iconBtn, flexShrink: 0 }}>✕</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 16 }} onClick={() => setScanPreview((cur) => cur.map((x, j) => {
                            if (j !== i) return x
                            const total = +((x.unit_price || 0) * (x.quantity || 0)).toFixed(2).replace(".", ",")
                            const q = Math.max(1, x.quantity - 1)
                            return { ...x, quantity: q, unit_price: +(total / q).toFixed(2).replace(".", ",") }
                          }))}>−</button>
                          <input type="number" value={it.quantity} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => {
                            if (j !== i) return x
                            const total = +((x.unit_price || 0) * (x.quantity || 0)).toFixed(2).replace(".", ",")
                            const q = Math.max(1, parseInt(e.target.value) || 1)
                            return { ...x, quantity: q, unit_price: +(total / q).toFixed(2).replace(".", ",") }
                          }))} style={{ ...S.input, width: 46, textAlign: "center", padding: "8px 4px" }} />
                          <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setScanPreview((cur) => cur.map((x, j) => {
                            if (j !== i) return x
                            const total = +((x.unit_price || 0) * (x.quantity || 0)).toFixed(2).replace(".", ",")
                            const q = x.quantity + 1
                            return { ...x, quantity: q, unit_price: +(total / q).toFixed(2).replace(".", ",") }
                          }))}>+</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "#888" }}>€/stuk</span>
                          <input type="number" step="0.01" value={it.unit_price || ""} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))} style={{ ...S.input, width: 84, padding: "8px 8px" }} />
                        </div>
                        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: scanMatch ? "#1f8a4c" : "#14213a", whiteSpace: "nowrap" }}>= €{lineTotal.toFixed(2).replace(".", ",")}</span>
                      </div>
                      {it.is_shared && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#a06b00", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.45)", borderRadius: 9, padding: "6px 10px", lineHeight: 1.4 }}>
                          <ShareIcon on size={16} /> Gedeeld item (bv. water of wijn) — de prijs wordt straks verdeeld over wie meedeelt.
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <button onClick={() => openNewItem("scan")} style={{ ...S.btn, ...S.btnPrimary, padding: "8px 16px", fontSize: 12.5, fontWeight: 700 }}>+ Item toevoegen</button>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <button onClick={() => setScanPreview((cur) => [...cur, { name: "BTW of andere kosten", unit_price: 0, quantity: 1, is_shared: false, distribute: "all" }])} style={{ ...S.btn, flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 0" }}>🧮 BTW/Kosten toevoegen</button>
                  <button onClick={() => setShowTaxInfo(true)} style={{ ...S.btn, fontSize: 12, fontWeight: 700, padding: "0 13px" }} title="uitleg">ℹ️</button>
                </div>
              </div>
              )
            })()}

            {/* Totaalcontrole: berekend (items + BTW) vs bon-totaal — beweegt live mee */}
            {scanPreview.length > 0 && (() => {
              const itemsSum = scanPreview.filter((x) => !x.distribute).reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 0), 0)
              const taxSum = scanPreview.filter((x) => x.distribute).reduce((s, it) => s + (it.unit_price || 0), 0)
              const computed = itemsSum + taxSum
              const billTotalScan = parseFloat((scanTotal || "").replace(",", "."))
              const hasBill = !isNaN(billTotalScan) && billTotalScan > 0
              const diff = hasBill ? +(computed - billTotalScan).toFixed(2).replace(".", ",") : 0
              const ok = hasBill && Math.abs(diff) < 0.01
              return (
                <div style={{ marginBottom: 14, border: `1.5px solid ${ok ? "rgba(39,174,96,0.4)" : hasBill ? "rgba(224,107,94,0.4)" : "rgba(16,24,40,0.1)"}`, borderRadius: 12, padding: "11px 13px", background: ok ? "rgba(39,174,96,0.06)" : hasBill ? "rgba(224,107,94,0.05)" : "#fafbff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8a93a3" }}>Items</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>€{itemsSum.toFixed(2).replace(".", ",")}</span>
                  </div>
                  {taxSum > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8a93a3" }}>🧮 BTW / kosten</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>€{taxSum.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(16,24,40,0.08)" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#14213a" }}>Berekend totaal</span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "#14213a" }}>€{computed.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>Totaal op de bon</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#999" }}>€</span>
                      <input type="number" step="0.01" placeholder="0.00" value={scanTotal} onChange={(e) => setScanTotal(numFilter(e.target.value))} style={{ ...S.input, width: 90, textAlign: "right", padding: "8px 8px" }} />
                    </div>
                  </div>
                  {hasBill && (
                    <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 700, lineHeight: 1.4, color: ok ? "#1f8a4c" : "#c0392b" }}>
                      {ok
                        ? "✅ Klopt met het bon-totaal"
                        : `⚠️ Verschil van €${Math.abs(diff).toFixed(2).replace(".", ",")} (${diff > 0 ? "berekend is hoger" : "berekend is lager"}). Controleer aantallen, prijzen en BTW.`}
                    </div>
                  )}
                  {!hasBill && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "#9aa0ab" }}>Vul het totaal van de bon in om live te zien of alles (incl. BTW) klopt.</div>
                  )}
                </div>
              )
            })()}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} disabled={scanning} onClick={() => { setShowScan(false); setScanPreview([]); setScanTotal(""); setScanFail(null); setScanFile(null); if (scanPhotoUrl) { URL.revokeObjectURL(scanPhotoUrl); setScanPhotoUrl(null) } }}>{scanPreview.length > 0 ? "Annuleren" : "Sluiten"}</button>
              {scanPreview.length > 0 && (
                <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={() => confirmScan()} disabled={scanning}>✅ Bevestigen & toevoegen</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: item bewerken ─── */}
      {editItem && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 360 }}>
            <h3 style={{ marginBottom: 14, fontSize: 18, fontWeight: 800 }}>✏️ Item bewerken</h3>
            <label style={S.lbl}>Naam</label>
            <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <label style={S.lbl}>Aantal</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16 }} onClick={() => setEditItem((cur) => {
                    if (!cur) return cur
                    const total = +((cur.unit_price || 0) * (cur.quantity || 0)).toFixed(2).replace(".", ",")
                    const q = Math.max(1, cur.quantity - 1)
                    return { ...cur, quantity: q, unit_price: +(total / q).toFixed(2).replace(".", ",") }
                  })}>−</button>
                  <input type="number" value={editItem.quantity} onChange={(e) => setEditItem((cur) => {
                    if (!cur) return cur
                    const total = +((cur.unit_price || 0) * (cur.quantity || 0)).toFixed(2).replace(".", ",")
                    const q = Math.max(1, parseInt(e.target.value) || 1)
                    return { ...cur, quantity: q, unit_price: +(total / q).toFixed(2).replace(".", ",") }
                  })} style={{ ...S.input, width: 48, textAlign: "center", padding: "9px 4px" }} />
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setEditItem((cur) => {
                    if (!cur) return cur
                    const total = +((cur.unit_price || 0) * (cur.quantity || 0)).toFixed(2).replace(".", ",")
                    const q = cur.quantity + 1
                    return { ...cur, quantity: q, unit_price: +(total / q).toFixed(2).replace(".", ",") }
                  })}>+</button>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={S.lbl}>Prijs/stuk (€)</label>
                <input type="number" step="0.01" value={editItem.unit_price || ""} onChange={(e) => setEditItem({ ...editItem, unit_price: parseFloat(e.target.value) || 0 })} style={{ ...S.input, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ paddingBottom: 9 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>Regeltotaal</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#14213a", whiteSpace: "nowrap" }}>€{((editItem.unit_price || 0) * (editItem.quantity || 0)).toFixed(2).replace(".", ",")}</div>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={editItem.is_shared} onChange={(e) => setEditItem({ ...editItem, is_shared: e.target.checked })} />
              <ShareIcon on size={18} /> Gedeeld item (wijn, water...) — splitsen over wie meedeelt
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setEditItem(null)}>Annuleren</button>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={saveItem}>💾 Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: nieuw item toevoegen ─── */}
      {newItem && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 360 }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>➕ Nieuw item</h3>
            <p style={{ fontSize: 12, color: "#999", marginTop: 0, marginBottom: 14 }}>Vul naam en prijs in. Daarna verschijnt het bovenaan opvallend in de lijst.</p>
            <label style={S.lbl}>Naam</label>
            <input autoFocus value={newItem.name} placeholder="bv. Spaghetti" onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") confirmNewItem() }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <label style={S.lbl}>Aantal</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16 }} onClick={() => setNewItem((cur) => cur ? { ...cur, quantity: Math.max(1, cur.quantity - 1) } : cur)}>−</button>
                  <input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...S.input, width: 48, textAlign: "center", padding: "9px 4px" }} />
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setNewItem((cur) => cur ? { ...cur, quantity: cur.quantity + 1 } : cur)}>+</button>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={S.lbl}>Prijs/stuk (€)</label>
                <input type="number" step="0.01" placeholder="0.00" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: numFilter(e.target.value) })} style={{ ...S.input, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={newItem.is_shared} onChange={(e) => setNewItem({ ...newItem, is_shared: e.target.checked })} />
              <ShareIcon on size={18} /> Gedeeld item (wijn, water...) — splitsen over wie meedeelt
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setNewItem(null)}>Annuleren</button>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={confirmNewItem}>+ Toevoegen</button>
            </div>
          </div>
        </div>
      )}
      {showTaxInfo && (
        <div style={S.overlay} onClick={() => setShowTaxInfo(false)}>
          <div style={{ ...S.modal, width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 800 }}>🧮 BTW / kosten</h3>
            <div style={{ fontSize: 13.5, color: "#3b486a", lineHeight: 1.6 }}>
              <p style={{ marginTop: 0, marginBottom: 0 }}>Alleen gebruiken als BTW of andere kosten <b>apart op de bon</b> staan. Kan over de <b>hele rekening</b> verdeeld worden of <b>proportioneel per bestelling</b>.</p>
            </div>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 16, fontWeight: 700 }} onClick={() => setShowTaxInfo(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* ─── Modal: bon groot bekijken ─── */}
      {viewReceipt && (
        <div style={S.overlay} onClick={() => setViewReceipt(null)}>
          <div style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewReceipt} alt="gescande bon" style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 14, background: "#fff", boxShadow: "0 24px 70px -12px rgba(16,24,40,0.5)" }} />
            <button onClick={() => setViewReceipt(null)} style={{ ...S.btn, position: "absolute", top: -14, right: -14, width: 40, height: 40, borderRadius: "50%", fontWeight: 700, fontSize: 16, padding: 0 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTEN
// ═══════════════════════════════════════════════════════════════════════════
function TopBar({ group, isAdmin, onHome, me, totalPersons, guestSeats, onGuestSeatsChange, onSwitchPerson }: { group: Group; isAdmin: boolean; onHome: () => void; me?: string; signedUp?: number; totalPersons?: number; guestSeats?: number; onGuestSeatsChange?: (n: number) => void; onSwitchPerson?: () => void }) {
  return (
    <div style={{ marginBottom: 14, padding: "4px 2px" }}>
      {/* Rol/naam (en voor de gast: tellertje + wisselen) centraal bovenaan */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: isAdmin ? "#1499b0" : "#f0a500", letterSpacing: 0.3 }}>
            {isAdmin ? "👑 Beheerder" : me ? `👤 ${me}` : "👤 Gast"}
          </span>
          {!isAdmin && guestSeats != null && onGuestSeatsChange && (
            <SeatsControl n={guestSeats} onChange={onGuestSeatsChange} showLabel size={13} />
          )}
        </div>
        {!isAdmin && onSwitchPerson && (
          <div>
            <button onClick={onSwitchPerson} style={{ marginTop: 2, background: "none", border: "none", padding: 0, color: "#9aa0ab", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>ik ben iemand anders — wissel van persoon</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div onClick={isAdmin ? onHome : undefined} title={isAdmin ? "Naar het Table-startscherm" : undefined} style={{ display: "flex", alignItems: "center", gap: 7, cursor: isAdmin ? "pointer" : "default", minWidth: 0, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-symbol.png" alt="" style={{ height: 30, width: "auto", objectFit: "contain", display: "block" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-table-logo-dark.png" alt="Rundo Table" style={{ height: 19, width: "auto", objectFit: "contain", display: "block" }} />
        </div>
        <div style={{ textAlign: "right", minWidth: 0, flexShrink: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1b2a4a", overflowWrap: "anywhere", lineHeight: 1.15 }}>{group.name}{fmtDate(group.created_at) ? ` (${fmtDate(group.created_at)})` : ""}</div>
          {totalPersons != null && totalPersons > 0 && <div style={{ fontSize: 11.5, color: "#8a93a3", fontWeight: 700 }}>👤 {totalPersons} {totalPersons === 1 ? "persoon" : "personen"}</div>}
        </div>
      </div>
    </div>
  )
}

function ItemList({ items, claimedQty, participants, claimsForItem, sharerIds, shareHeads, toggleShareClaim, setShareFixed, onEdit, onToggleShared, onDelete, onAddManual, bareBill, taxLines, taxNode, recentItemId, onGoGuests, billOk, scanFlags }: {
  items: BillItem[]; claimedQty: (id: string) => number
  participants: Participant[]; claimsForItem: (id: string) => { name: string; qty: number }[]
  sharerIds: (id: string) => string[]; shareHeads: (id: string) => number; toggleShareClaim: (itemId: string, pid: string) => void
  setShareFixed: (it: BillItem, val: boolean) => void
  onEdit: (it: BillItem) => void; onToggleShared: (it: BillItem) => void; onDelete: (id: string) => void; onAddManual: () => void
  bareBill?: boolean
  taxLines?: { name: string; amount: number }[]
  taxNode?: React.ReactNode
  recentItemId?: string | null
  onGoGuests?: () => void
  billOk?: boolean
  scanFlags?: Record<string, { note: string }>
}) {
  const [openFlag, setOpenFlag] = useState<string | null>(null)
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ ...S.h3, marginBottom: 0, display: "flex", alignItems: "baseline", gap: 8 }}>🧾 Items op de bon{!billOk && <span style={{ fontSize: 13, fontWeight: 800, color: "#c0392b" }}>Checken!</span>}</h3>
      </div>
      {items.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20, fontSize: 13 }}>Nog geen items — scan de bon</div>}
      {items.map((it) => {
        const open = it.quantity - claimedQty(it.id)
        const who = claimsForItem(it.id)
        const isNew = recentItemId === it.id
        return (
          <div key={it.id} style={{ padding: "9px 8px", borderRadius: (isNew || billOk) ? 12 : 0, marginTop: (isNew || billOk) ? 4 : 0, marginBottom: (isNew || billOk) ? 6 : 0, background: isNew ? "rgba(233,196,95,0.16)" : billOk ? "rgba(39,174,96,0.06)" : "transparent", border: isNew ? "1.5px solid #ecc85a" : billOk ? "1.5px solid rgba(39,174,96,0.55)" : "1px solid transparent", borderBottom: isNew ? "1.5px solid #ecc85a" : billOk ? "1.5px solid rgba(39,174,96,0.55)" : "1px solid rgba(0,0,0,0.05)" }}>
            {isNew && <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a06b00", marginBottom: 4 }}>✨ Net toegevoegd — pas de naam aan met ✏️</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {it.is_shared && <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><ShareIcon on size={20} /></span>}
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere", minWidth: 0, display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span>{it.quantity}× {it.name}</span>
                  {scanFlags?.[it.id] && (
                    <button onClick={() => setOpenFlag(openFlag === it.id ? null : it.id)} title="De scan twijfelde hier — tik voor details" style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: "none", background: "#f39c12", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</button>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right", lineHeight: 1.2 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1499b0" }}>€{(it.unit_price * it.quantity).toFixed(2).replace(".", ",")}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9aa0ab" }}>
                    {it.is_shared ? "gedeeld" : `€${it.unit_price.toFixed(2).replace(".", ",")}/stuk${open > 0 ? ` · ${open} open` : ""}`}
                  </div>
                </div>
              </div>
              <button title={it.is_shared ? "gedeeld item — klik om uit te zetten" : "maak hier een gedeeld item van (bv. water, wijn)"} style={{ ...S.iconBtn, display: "flex", alignItems: "center", justifyContent: "center", background: it.is_shared ? "rgba(233,196,95,0.3)" : "rgba(16,24,40,0.05)" }} onClick={() => onToggleShared(it)}><ShareIcon on={it.is_shared} /></button>
              <button style={S.iconBtn} onClick={() => onEdit(it)}>✏️</button>
              <button style={S.iconBtn} onClick={() => onDelete(it.id)}>🗑️</button>
            </div>
            {scanFlags?.[it.id] && openFlag === it.id && (
              <div style={{ marginTop: 6, marginLeft: 26, fontSize: 12, color: "#b5591a", background: "rgba(243,156,18,0.1)", border: "1px solid rgba(243,156,18,0.45)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.4 }}>
                ⚠️ De scan twijfelde hier{scanFlags[it.id].note ? ": " + scanFlags[it.id].note : ""}. Controleer even de naam, het aantal en de prijs.
              </div>
            )}
            {!bareBill && !it.is_shared && participants.length > 0 && (who.length > 0 || open > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 26 }}>
                {who.map((w, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#14213a", background: "rgba(90,108,166,0.1)", borderRadius: 10, padding: "2px 9px" }}>{w.name} ×{w.qty}</span>
                ))}
                {open > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e0685c", background: "rgba(224,107,94,0.1)", borderRadius: 10, padding: "2px 9px" }}>{open} nog niet toegewezen</span>
                )}
              </div>
            )}
            {bareBill && it.is_shared && (
              <div style={{ marginTop: 7, marginLeft: 26, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#a06b00", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 9, padding: "5px 9px", lineHeight: 1.4 }}>
                <ShareIcon on size={15} /> Gedeeld item — de prijs wordt verdeeld over wie meedeelt.
              </div>
            )}
            {!bareBill && it.is_shared && (() => {
              const sh = sharerIds(it.id)
              const heads = shareHeads(it.id)
              const perHead = heads > 0 ? (it.unit_price * it.quantity) / heads : 0
              const fixed = !!it.share_fixed
              return (
                <div style={{ marginTop: 7, marginLeft: 26 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#a06b00", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <ShareIcon on size={13} /> Wie nam hiervan mee? {heads > 0 ? `${heads} ${heads === 1 ? "persoon" : "personen"} · €${perHead.toFixed(2).replace(".", ",")} p.p.` : "tik de namen aan"}
                    </span>
                    {sh.length > 0 && (
                      <button onClick={() => setShareFixed(it, !fixed)} style={{
                        fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "3px 9px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                        border: fixed ? "none" : "1px solid rgba(16,24,40,0.12)",
                        background: fixed ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff",
                        color: fixed ? "#fff" : "#5a6680",
                      }}>{fixed ? "🔒 vastgezet" : "🔓 vastzetten"}</button>
                    )}
                  </div>
                  {participants.length === 0
                    ? <div style={{ fontSize: 11, color: "#aaa" }}>Voeg eerst gasten toe.</div>
                    : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {participants.map((p) => {
                          const on = sh.includes(p.id)
                          return (
                            <button key={p.id} onClick={() => toggleShareClaim(it.id, p.id)} style={{
                              fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px", cursor: "pointer",
                              border: on ? "none" : "1px solid rgba(16,24,40,0.12)",
                              background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff",
                              color: on ? "#5a4a1a" : "#8b93a8",
                            }}>{on ? "✓ " : ""}{p.name}</button>
                          )
                        })}
                      </div>
                    )}
                  <div style={{ fontSize: 10.5, color: "#9aa0ab", marginTop: 5, lineHeight: 1.4 }}>
                    {fixed
                      ? "Verdeling vastgezet: gasten zien meteen hun deel."
                      : "Niet vastgezet: tik gasten aan of laat ze zelf aantikken. Het bedrag deelt live door wie meedoet en kan nog wijzigen tot iedereen bevestigt."}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })}
      <div style={{ textAlign: "right", marginTop: 10, marginBottom: 2 }}>
        <button onClick={onAddManual} style={{ ...S.btn, ...S.btnPrimary, display: "inline-block", width: "auto", padding: "8px 18px", fontSize: 13.5, fontWeight: 700 }}>+ Item toevoegen</button>
      </div>
      {taxNode}
      {items.length > 0 && (() => {
        const units = items.reduce((s, it) => s + it.quantity, 0)
        const sum = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
        const tax = (taxLines || []).reduce((s, t) => s + t.amount, 0)
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(16,24,40,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>Bestelde items: {units}{tax > 0 ? ` · €${sum.toFixed(2).replace(".", ",")} + BTW €${tax.toFixed(2).replace(".", ",")}` : ""}</span>
              {tax === 0 && <span style={{ fontSize: 15, fontWeight: 700, color: "#5a6680" }}>€{sum.toFixed(2).replace(".", ",")}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 7, paddingTop: 7, borderTop: tax > 0 ? "1px solid rgba(16,24,40,0.06)" : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>Totaal</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#14213a" }}>€{(sum + tax).toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        )
      })()}
      {onGoGuests && (
        <button onClick={onGoGuests} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 16, padding: "14px 0", fontSize: 15, fontWeight: 800, boxShadow: billOk ? "0 0 0 2px rgba(39,174,96,0.55), 0 8px 24px -6px rgba(39,174,96,0.65)" : "0 0 0 2px rgba(224,107,94,0.6), 0 8px 24px -6px rgba(224,107,94,0.65)" }}>{billOk ? "✓ Alles klopt — ga naar Gasten en delen →" : "Bon correct? Ga naar Gasten en delen! →"}</button>
      )}
    </div>
  )
}

function AssignPicker({ participants, itemId, isShared, confirmedFn, onAssign, onClose }: {
  participants: Participant[]; itemId: string; isShared?: boolean
  confirmedFn: (pid: string) => boolean
  onAssign: (pid: string, warn: boolean) => void; onClose: () => void
}) {
  const [showOthers, setShowOthers] = useState(false)
  const open = participants.filter((p) => !confirmedFn(p.id))
  const others = participants.filter((p) => confirmedFn(p.id))
  return (
    <div style={{ marginTop: 8, marginLeft: 25, padding: 10, borderRadius: 12, background: "rgba(90,108,166,0.07)", border: "1px solid rgba(90,108,166,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#5a6680" }}>Aan wie toewijzen?</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#9aa0ab", fontWeight: 800 }}>✕</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {open.length === 0 && !showOthers && <span style={{ fontSize: 11.5, color: "#9aa0ab" }}>Iedereen heeft al bevestigd — kies “andere persoon”.</span>}
        {open.map((p) => (
          <button key={p.id} onClick={() => onAssign(p.id, false)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: "1px solid rgba(16,24,40,0.12)", background: "#fff", color: "#5a6680" }}>{p.name}</button>
        ))}
        {!showOthers && others.length > 0 && (
          <button onClick={() => setShowOthers(true)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: "1px dashed rgba(16,24,40,0.25)", background: "transparent", color: "#8b93a8" }}>andere persoon ▾</button>
        )}
        {showOthers && others.map((p) => (
          <button key={p.id} onClick={() => onAssign(p.id, true)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: "1px solid rgba(224,107,94,0.4)", background: "rgba(224,107,94,0.06)", color: "#c0392b" }}>{p.name} ⚠️</button>
        ))}
      </div>
      {showOthers && <div style={{ fontSize: 10.5, color: "#a06b00", marginTop: 6 }}>⚠️ Deze personen bevestigden al; je krijgt een controlevraag voor je toewijst.</div>}
    </div>
  )
}

function ClaimScreen(props: {
  items: BillItem[]; meId: string | null; me: Participant | null; isAdmin: boolean
  participants: Participant[]
  claimedQty: (id: string) => number; myQty: (id: string, pid: string | null) => number; sharerIds: (id: string) => string[]
  shareHeads: (id: string) => number; myShareHeads: (id: string, pid: string) => number; seatsOf: (pid: string) => number
  setSeats: (pid: string, n: number) => void
  setClaim: (itemId: string, pid: string, qty: number) => void; toggleShareClaim: (itemId: string, pid: string) => void
  itemTotal: (it: BillItem) => number; personTotal: (pid: string) => { settled: number; pendingShared: boolean }
  personItems: (pid: string) => { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number; myHeads: number }[]
  sharedRevealed: (it: BillItem) => boolean; allConfirmed: boolean; isConfirmed: (pid: string) => boolean; explicitConfirmed: (pid: string) => boolean
  claimMode: "item" | "person"; setClaimMode: (m: "item" | "person") => void
  claimPid: string | null; setClaimPid: (id: string | null) => void
  iConfirmed: boolean; confirmMe: () => void; onPickMe: (id: string) => void
  finalized: boolean; iDispute: boolean; iResolved: boolean; iComment: string; onToggleDispute: (on: boolean, comment?: string) => void
}) {
  const { items, meId, isAdmin, participants, claimedQty, myQty, sharerIds, shareHeads, myShareHeads, seatsOf, setSeats, setClaim, toggleShareClaim, itemTotal, personTotal, personItems, sharedRevealed, allConfirmed, isConfirmed, explicitConfirmed, iConfirmed, confirmMe, onPickMe, finalized, iDispute, iResolved, iComment, onToggleDispute } = props
  const adminPid = props.claimPid, setAdminPid = props.setClaimPid
  const [assignItem, setAssignItem] = useState<string | null>(null)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeText, setDisputeText] = useState("")
  const [openGuestRows, setOpenGuestRows] = useState<Set<string>>(() => new Set(meId ? [meId] : []))
  // Detecteer of de beheerder heropende na een eerdere afsluiting → toon dan één 'bekijkt opnieuw'-melding.
  const wasFinalizedRef = useRef(false)
  const prevFinalizedRef = useRef<boolean | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [showFinalizedPopup, setShowFinalizedPopup] = useState(false)
  useEffect(() => {
    const prev = prevFinalizedRef.current
    if (finalized) {
      if (prev !== true) setShowFinalizedPopup(true) // net afgesloten (of net geladen als afgesloten) → één pop-up
      wasFinalizedRef.current = true
      setReviewing(false)
    } else {
      setShowFinalizedPopup(false)
      if (prev === true && wasFinalizedRef.current) setReviewing(true) // heropend na afsluiten
    }
    prevFinalizedRef.current = finalized
  }, [finalized])

  if (isAdmin) {
    const normalItems = items.filter((i) => !i.is_shared)
    const sharedItems = items.filter((i) => i.is_shared)
    const totalUnits = normalItems.reduce((s, i) => s + i.quantity, 0)
    const claimedUnits = normalItems.reduce((s, i) => s + Math.min(i.quantity, claimedQty(i.id)), 0)
    const sharedDecided = sharedItems.filter((i) => sharerIds(i.id).length > 0).length
    const billSum = items.reduce((s, i) => s + itemTotal(i), 0)
    return (
      <div>
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginBottom: 10 }}>✅ Wie heeft wat genomen?</h3>
          {items.length === 0
            ? <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Nog geen items — scan eerst de bon.</div>
            : participants.length === 0
            ? <div style={{ fontSize: 12.5, color: "#aaa", padding: 10 }}>Voeg eerst gasten toe in de tab &ldquo;Gasten &amp; delen&rdquo;.</div>
            : (
              <>
                {(() => {
                  const list = participants
                  const scroll = list.length > 6
                  return (
                    <>
                      <div style={scroll
                        ? { display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }
                        : { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        {list.map((p) => {
                          const on = adminPid === p.id
                          const pt = personTotal(p.id)
                          const conf = explicitConfirmed(p.id)
                          return (
                            <button key={p.id} onClick={() => setAdminPid(on ? null : p.id)} style={{
                              flexShrink: 0, whiteSpace: "nowrap",
                              fontSize: 13, fontWeight: 700, borderRadius: 11, padding: scroll ? "7px 11px" : "7px 12px", cursor: "pointer",
                              border: on ? "1px solid #1499b0" : "1px solid rgba(16,24,40,0.12)",
                              background: on ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff",
                              color: on ? "#fff" : "#5a6680",
                            }}>{conf ? "✓ " : ""}{p.name} <span style={{ fontWeight: 700, opacity: pt.settled < 0.005 ? 1 : 0.85, color: pt.settled < 0.005 ? (on ? "#ffd7d1" : "#e0685c") : "inherit" }}>€{pt.settled.toFixed(2).replace(".", ",")}{pt.pendingShared ? "+" : ""}</span></button>
                          )
                        })}
                      </div>
                      {adminPid && (() => {
                        const sel = participants.find((p) => p.id === adminPid)
                        return <div style={{ fontSize: 12, fontWeight: 700, color: "#5a4a1a", background: "rgba(233,196,95,0.25)", borderRadius: 10, padding: "7px 11px", marginBottom: 12 }}>👀 Geel = wat <b>{sel?.name}</b> bestelde.</div>
                      })()}
                    </>
                  )
                })()}

                {items.map((it) => {
                  const claimed = claimedQty(it.id)
                  const open = it.quantity - claimed
                  if (it.is_shared) {
                    const sh = sharerIds(it.id)
                    const ok = sh.length > 0
                    const heads = shareHeads(it.id)
                    const perHead = heads > 0 ? itemTotal(it) / heads : 0
                    const fixed = !!it.share_fixed
                    const mine = adminPid ? sh.includes(adminPid) : false
                    return (
                      <div key={it.id} style={{ padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: mine ? "rgba(233,196,95,0.16)" : "transparent", borderRadius: mine ? 10 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><ShareIcon on size={18} /></span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{it.name} <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.2)", borderRadius: 8, padding: "1px 6px" }}>gedeeld</span></div>
                            <div style={{ fontSize: 11, color: "#999" }}>€{itemTotal(it).toFixed(2).replace(".", ",")} totaal{ok ? ` · €${perHead.toFixed(2).replace(".", ",")} p.p.` : ""}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 9px", color: ok ? "#1f8a4c" : "#c0392b", background: ok ? "rgba(39,174,96,0.12)" : "rgba(224,107,94,0.12)" }}>{ok ? `${heads} ${heads === 1 ? "persoon" : "personen"}` : "nog niemand"}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 25 }}>
                          {participants.length === 0
                            ? <span style={{ fontSize: 11, color: "#aaa" }}>Voeg eerst gasten toe.</span>
                            : participants.map((p) => {
                                const on = sh.includes(p.id)
                                const pSeats = Math.max(1, p.seats ?? 1)
                                const pHeads = myShareHeads(it.id, p.id)
                                return (
                                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <button onClick={() => {
                                      if (!on && explicitConfirmed(p.id) && !confirm(`${p.name} had dit zelf niet aangeduid. Toch laten meedelen?`)) return
                                      toggleShareClaim(it.id, p.id)
                                    }} style={{
                                      fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px", cursor: "pointer",
                                      border: on ? "none" : "1px solid rgba(16,24,40,0.12)",
                                      background: on ? (p.id === adminPid ? "rgba(233,196,95,0.5)" : "linear-gradient(135deg,#f3d27c,#ecc564)") : "#fff",
                                      color: on ? "#5a4a1a" : "#8b93a8",
                                    }}>{on ? "✓ " : ""}{p.name}{on && pSeats > 1 ? ` ×${pHeads}` : ""}</button>
                                    {on && pSeats > 1 && !fixed && (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                        <button onClick={() => setClaim(it.id, p.id, pHeads - 1)} title="minder personen" style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: 18, height: 18, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>−</button>
                                        <button onClick={() => setClaim(it.id, p.id, Math.min(pSeats, pHeads + 1))} title="meer personen" style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: 18, height: 18, cursor: "pointer", fontSize: 12, lineHeight: 1 }} disabled={pHeads >= pSeats}>+</button>
                                      </span>
                                    )}
                                  </span>
                                )
                              })}
                        </div>
                      </div>
                    )
                  }
                  const who = participants.map((p) => ({ p, q: myQty(it.id, p.id) })).filter((x) => x.q > 0)
                  const mineQ = adminPid ? myQty(it.id, adminPid) : 0
                  const ok = open === 0
                  const highlight = adminPid && mineQ > 0
                  return (
                    <div key={it.id} style={{ padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: highlight ? "rgba(233,196,95,0.16)" : "transparent", borderRadius: highlight ? 10 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{it.quantity}× {it.name}</div>
                          <div style={{ fontSize: 11, color: "#999" }}>€{it.unit_price.toFixed(2).replace(".", ",")}/stuk</div>
                        </div>
                        {open > 0
                          ? <button onClick={() => setAssignItem(assignItem === it.id ? null : it.id)} style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "3px 10px", cursor: "pointer", border: "none", color: "#c0392b", background: "rgba(224,107,94,0.14)" }}>{open} open — wijs toe ▾</button>
                          : <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 9px", color: "#1f8a4c", background: "rgba(39,174,96,0.12)" }}>volledig</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 25, alignItems: "center" }}>
                        {who.map(({ p, q: pq }) => (
                          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 4px 2px 9px", color: p.id === adminPid ? "#5a4a1a" : "#5a6680", background: p.id === adminPid ? "rgba(233,196,95,0.5)" : "rgba(90,108,166,0.1)" }}>
                            {p.name} ×{pq}
                            <button onClick={() => setClaim(it.id, p.id, Math.max(0, pq - 1))} title="verwijder er één" style={{ border: "2px solid #2b2f38", background: "#fff", color: "#c0392b", borderRadius: 6, width: 26, height: 22, cursor: "pointer", fontSize: 15, fontWeight: 800, lineHeight: 1 }}>−</button>
                          </span>
                        ))}
                        {who.length === 0 && open === 0 && <span style={{ fontSize: 11, color: "#aaa" }}>—</span>}
                      </div>
                      {assignItem === it.id && (
                        <AssignPicker participants={participants} itemId={it.id} confirmedFn={explicitConfirmed}
                          onAssign={(pid, warn) => { if (warn && !confirm(`${participants.find((x) => x.id === pid)?.name} had dit zelf niet aangeduid. Toch toevoegen?`)) return; setClaim(it.id, pid, myQty(it.id, pid) + 1); setAssignItem(null) }}
                          onClose={() => setAssignItem(null)} />
                      )}
                    </div>
                  )
                })}
              </>
            )}

          {items.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(16,24,40,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#5a6680" }}>
                <span>Stuks geclaimd</span>
                <span style={{ color: claimedUnits >= totalUnits ? "#1f8a4c" : "#c0392b" }}>{claimedUnits}/{totalUnits}{totalUnits > 0 && claimedUnits >= totalUnits ? " ✓" : ""}</span>
              </div>
              {sharedItems.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#5a6680", marginTop: 4 }}>
                  <span>Gedeelde items geregeld</span>
                  <span style={{ color: sharedDecided >= sharedItems.length ? "#1f8a4c" : "#c0392b" }}>{sharedDecided}/{sharedItems.length}{sharedDecided >= sharedItems.length ? " ✓" : ""}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#14213a", marginTop: 6 }}>
                <span>Totaal rekening</span>
                <span>€{billSum.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!meId) {
    return (
      <div style={S.card}>
        <h3 style={S.h3}>Voor wie tik je aan?</h3>
        <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 12 }}>Kies een persoon om voor te claimen (handig als jij voor iemand zonder gsm aantikt).</p>
        {participants.map((p) => (
          <button key={p.id} onClick={() => onPickMe(p.id)} style={{ ...S.btn, width: "100%", textAlign: "left", marginBottom: 6, padding: "12px 14px", fontWeight: 700 }}>{p.name}</button>
        ))}
        {participants.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>Voeg eerst gasten toe in de tab &ldquo;Gasten&rdquo;.</div>}
      </div>
    )
  }

  const t = personTotal(meId)

  return (
    <div>
      {!finalized && reviewing && (
        <div style={{ width: "100%", marginBottom: 14, padding: "12px 16px", borderRadius: 14, background: "linear-gradient(135deg,#1499b0,#22b8cf)", color: "#fff", boxShadow: "0 6px 18px -6px rgba(20,153,176,0.55)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>🔎 De beheerder bekijkt de rekening opnieuw</div>
          <div style={{ fontSize: 12, opacity: 0.92, marginTop: 2 }}>Even geduld — je krijgt straks opnieuw de definitieve verdeling te zien.</div>
        </div>
      )}
      {/* Pop-up zodra de beheerder afsluit: één duidelijke melding + meteen je verdeling zien */}
      {finalized && showFinalizedPopup && (
        <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowFinalizedPopup(false)}>
          <div style={{ ...S.modal, width: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1f8a4c", margin: "0 0 6px" }}>De rekening is afgesloten</h3>
            <p style={{ fontSize: 13.5, color: "#5a6680", lineHeight: 1.5, margin: "0 0 12px" }}>De beheerder rondde de rekening af. Dit is jouw definitieve deel:</p>
            <div style={{ fontSize: 34, fontWeight: 800, color: "#14213a", marginBottom: 16 }}>€{t.settled.toFixed(2).replace(".", ",")}{t.pendingShared ? "+" : ""}</div>
            <button onClick={() => { setShowFinalizedPopup(false); if (typeof document !== "undefined") setTimeout(() => document.getElementById("gast-eindverdeling")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60) }} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}>Bekijk mijn verdeling</button>
          </div>
        </div>
      )}
      <div style={S.card}>
        <h3 style={S.h3}>✅ {meId && seatsOf(meId) > 1 ? "Selecteer jullie consumpties" : "Selecteer jouw consumpties"}</h3>
        {items.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Nog geen items — wacht tot de bon gescand is.</div>}

        {items.map((it) => {
          const total = it.quantity
          const claimed = claimedQty(it.id)
          const mine = myQty(it.id, meId)
          const open = total - claimed
          if (it.is_shared) {
            const sh = sharerIds(it.id)
            const iShare = sh.includes(meId)
            const revealed = sharedRevealed(it)
            const fixed = !!it.share_fixed
            const heads = shareHeads(it.id)
            const perHead = heads > 0 ? itemTotal(it) / heads : itemTotal(it)
            const myHeads = myShareHeads(it.id, meId)
            const myShare = perHead * (myHeads || 1)
            const mySeats = seatsOf(meId)
            return (
              <div key={it.id} style={{ padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><ShareIcon on size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{it.name} <span style={{ fontSize: 11, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.2)", borderRadius: 8, padding: "1px 7px" }}>gedeeld</span></div>
                    <div style={{ fontSize: 11, color: "#999" }}>€{itemTotal(it).toFixed(2).replace(".", ",")} totaal · wordt gedeeld door wie meedrinkt</div>
                  </div>
                  <button onClick={() => toggleShareClaim(it.id, meId)} style={{ ...S.btn, fontWeight: 700, ...(iShare ? { background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a", border: "none" } : {}) }}>{iShare ? "✓ ik deel mee" : "+ meedelen"}</button>
                </div>
                {iShare && mySeats > 1 && !fixed && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#5a6680", background: "rgba(90,108,166,0.07)", border: "1px solid rgba(90,108,166,0.2)", borderRadius: 10, padding: "7px 11px" }}>
                    <span style={{ flex: 1 }}>🍴 Met hoeveel van jullie {mySeats} deelden jullie dit?</span>
                    <button onClick={() => setClaim(it.id, meId, Math.max(1, myHeads - 1))} style={{ ...S.iconBtn, width: 28, height: 28, fontSize: 16 }} title="minder personen" disabled={myHeads <= 1}>−</button>
                    <b style={{ minWidth: 18, textAlign: "center", fontSize: 15, color: "#14213a" }}>{myHeads}</b>
                    <button onClick={() => setClaim(it.id, meId, Math.min(mySeats, myHeads + 1))} style={{ ...S.iconBtn, width: 28, height: 28, fontSize: 16, background: "rgba(27,42,74,0.12)" }} disabled={myHeads >= mySeats}>+</button>
                  </div>
                )}
                {iShare && (
                  revealed ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.45, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}><ShareIcon on size={14} /></span>
                      <span>{fixed
                        ? <>Jouw deel: €{myShare.toFixed(2).replace(".", ",")}{myHeads > 1 ? ` (voor ${myHeads} pers.)` : ""} — gedeeld door {heads} {heads === 1 ? "persoon" : "personen"}, vastgelegd door de beheerder.</>
                        : <>Voorlopig €{myShare.toFixed(2).replace(".", ",")}{myHeads > 1 ? ` (jullie ${myHeads})` : ""} — gedeeld door {heads} {heads === 1 ? "persoon" : "personen"}. Daalt als meer mensen meedoen.</>}</span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#5a6680", background: "rgba(90,108,166,0.08)", border: "1px solid rgba(90,108,166,0.25)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.45 }}>
                      ⏳ Je deelt mee. Het bedrag wordt verdeeld over iedereen die meedrinkt — je deel en de namen verschijnen zodra iedereen klaar is met aantikken en bevestigen.
                    </div>
                  )
                )}
                {!iShare && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#9aa0ab", lineHeight: 1.4 }}>Tik &ldquo;meedelen&rdquo; als je hiervan dronk. De prijs wordt gedeeld door iedereen die meedrinkt — je betaalt dus niet de hele prijs.</div>
                )}
              </div>
            )
          }
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere", minWidth: 0 }}>{it.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#1499b0", flexShrink: 0 }}>€{it.unit_price.toFixed(2).replace(".", ",")}</span>
                </div>
                <div style={{ fontSize: 11, color: open > 0 ? "#e0685c" : "#1f8a4c", fontWeight: 600 }}>{total}× besteld · {open > 0 ? `${open} nog vrij` : "alles geclaimd"}</div>
              </div>
              <button style={{ width: 42, height: 34, fontSize: 20, fontWeight: 800, lineHeight: 1, borderRadius: 8, cursor: mine > 0 ? "pointer" : "default", color: mine > 0 ? "#c0392b" : "#c9ced8", background: "#fff", border: "2px solid " + (mine > 0 ? "#2b2f38" : "#e2e6ee") }} onClick={() => setClaim(it.id, meId, Math.max(0, mine - 1))} disabled={mine <= 0} title="verwijder er één">−</button>
              <span style={{ fontSize: 16, fontWeight: 800, minWidth: 22, textAlign: "center" }}>{mine}</span>
              <button style={{ ...S.iconBtn, width: 32, height: 32, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setClaim(it.id, meId, mine + 1)} disabled={open <= 0}>+</button>
            </div>
          )
        })}
      </div>

      <div style={{ ...S.card, background: "linear-gradient(135deg,#fbfaff,#f1f2fb)", border: "1.5px solid rgba(90,108,166,0.25)" }}>
        {(() => {
          const mine = personItems(meId)
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 8 }}>Dit ga je bevestigen</div>
              {mine.length === 0 && <div style={{ fontSize: 13, color: "#aaa" }}>Je hebt nog niets aangetikt.</div>}
              {mine.map((d, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: "#3b486a" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{d.shared && <ShareIcon on size={14} />}{d.qty > 1 ? `${d.qty}× ` : ""}{d.name}{d.shared ? (d.revealed ? (meId && seatsOf(meId) > 1 ? ` (gedeeld, ${d.myHeads} pers.)` : " (gedeeld deel)") : ` (gedeeld door ${d.sharers})`) : ""}</span>
                  <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>
                    {d.shared && !d.revealed ? "nog te verdelen" : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
              ))}
            </div>
          )
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(90,108,166,0.18)", paddingTop: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#5a6680" }}>Jouw totaal</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#14213a" }}>€{t.settled.toFixed(2).replace(".", ",")}{t.pendingShared ? "+" : ""}</span>
        </div>
        {t.pendingShared && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.4 }}>
            ℹ️ Je deelt mee in gedeelde items (wijn/water). Het exacte deel kan nog wijzigen tot iedereen heeft aangetikt en bevestigd.
          </div>
        )}
        {finalized && (
          <div id="gast-eindverdeling" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(90,108,166,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 15 }}>✅</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1f8a4c" }}>Alles afgehandeld — dit is de definitieve verdeling</span>
            </div>
            <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 8 }}>De volledige rekening ter info — tik een naam aan voor het detail:</div>
            {participants.map((p) => {
              const pt = personTotal(p.id)
              const isMe = p.id === meId
              const rowOpen = openGuestRows.has(p.id)
              const detail = personItems(p.id)
              return (
                <div key={p.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", borderRadius: 8, background: isMe ? "rgba(233,196,95,0.16)" : "transparent" }}>
                  <div onClick={() => setOpenGuestRows((cur) => { const n = new Set(cur); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 8px", cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: "#9aa0ab", width: 12, flexShrink: 0 }}>{rowOpen ? "▼" : "▶"}</span>
                      <span style={{ fontSize: 13.5, fontWeight: isMe ? 800 : 600, color: "#14213a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{isMe ? " (jij)" : ""}</span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a", flexShrink: 0, marginLeft: 8 }}>€{pt.settled.toFixed(2).replace(".", ",")}{pt.pendingShared ? "+" : ""}</span>
                  </div>
                  {rowOpen && (
                    <div style={{ padding: "0 8px 10px 26px" }}>
                      {detail.length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>Niets aangetikt.</div>}
                      {detail.map((d, k) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#5a6680", padding: "2px 0" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{d.shared && <ShareIcon on size={14} />}{d.qty > 1 ? `${d.qty}× ` : ""}{d.name}{d.shared ? (d.revealed ? " (gedeeld deel)" : ` (gedeeld door ${d.sharers})`) : ""}</span>
                          <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>{d.shared && !d.revealed ? "nog te verdelen" : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2).replace(".", ",")}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(16,24,40,0.1)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>Totaal rekening</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#14213a" }}>€{participants.reduce((s, p) => s + personTotal(p.id).settled, 0).toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        )}
        {!(finalized && !isAdmin) && (
          <button onClick={confirmMe} style={{ ...S.btn, width: "100%", marginTop: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, border: "none", ...(iConfirmed ? { background: "rgba(39,174,96,0.12)", color: "#1f8a4c" } : { background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a" }) }}>
            {iConfirmed ? "✓ Bevestigd — tik om te wijzigen" : "✅ Bevestig mijn bestelling"}
          </button>
        )}
        {finalized && !isAdmin && (
          <div style={{ marginTop: 12 }}>
            {disputeOpen ? (
              <div style={{ background: "rgba(90,108,166,0.06)", border: "1px solid rgba(90,108,166,0.2)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5a6680", marginBottom: 7 }}>🤔 Wat klopt er niet? (optioneel)</div>
                <textarea value={disputeText} onChange={(e) => setDisputeText(e.target.value)} placeholder="bv. die wijn nam ik niet" rows={2} style={{ ...S.input, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setDisputeOpen(false); setDisputeText("") }} style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13 }}>Annuleren</button>
                  <button onClick={() => { onToggleDispute(true, disputeText); setDisputeOpen(false); setDisputeText("") }} style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#1499b0,#22b8cf)", color: "#fff" }}>Versturen</button>
                </div>
              </div>
            ) : iResolved ? (
              <div style={{ fontSize: 12.5, color: "#1f8a4c", background: "rgba(39,174,96,0.12)", border: "1px solid rgba(39,174,96,0.4)", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45, textAlign: "center", fontWeight: 700 }}>
                ✓ De beheerder heeft je opmerking opgelost.
                {iComment && <div style={{ marginTop: 6, fontWeight: 600, fontStyle: "italic", color: "#1f8a4c", opacity: 0.85 }}>jouw opmerking: “{iComment}”</div>}
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => { setDisputeText(""); setDisputeOpen(true) }} style={{ ...S.btn, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, background: "#fff", border: "1px solid rgba(20,33,58,0.18)", color: "#5a6680" }}>➕ Nog een opmerking toevoegen</button>
                </div>
              </div>
            ) : iDispute ? (
              <div style={{ fontSize: 12.5, color: "#a06b00", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.5)", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45, textAlign: "center" }}>
                💬 De beheerder heeft je opmerking ontvangen en bekijkt ze.
                {iComment && <div style={{ marginTop: 6, fontWeight: 600, fontStyle: "italic", color: "#a06b00", opacity: 0.9 }}>jouw opmerking: “{iComment}”</div>}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => { onToggleDispute(false); setDisputeOpen(false); setDisputeText("") }} style={{ background: "none", border: "none", padding: 0, color: "#1499b0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>toch intrekken</button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <button onClick={() => { setDisputeText(""); setDisputeOpen(true) }} style={{ ...S.btn, padding: "10px 18px", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid rgba(20,33,58,0.18)", color: "#5a6680" }}>
                  🤔 Klopt iets niet? Laat het de beheerder weten
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IdentityAdder({ onAdd }: { onAdd: (name: string, seats?: number) => void }) {
  const [name, setName] = useState("")
  const [seats, setSeats] = useState(1)
  const submit = () => { if (name.trim()) { onAdd(name.trim(), seats); setName(""); setSeats(1) } }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit() }} placeholder="Jouw naam" style={{ ...S.input, flex: 1, minWidth: 120 }} />
        <SeatsControl n={seats} onChange={setSeats} showLabel />
      </div>
      <div style={{ fontSize: 11, color: "#9aa0ab", marginTop: 6 }}>Met meerdere (bv. koppel)? Zet het aantal personen met de knopjes.</div>
      <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 12, padding: "14px 0", fontSize: 16, fontWeight: 700 }} onClick={submit}>Doe mee</button>
    </div>
  )
}

function ShareIcon({ on, size = 20 }: { on?: boolean; size?: number }) {
  if (!on) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
        <circle cx="8" cy="13" r="5" fill="none" stroke="#b6bccb" strokeWidth="1.5" />
        <circle cx="16" cy="13" r="5" fill="none" stroke="#b6bccb" strokeWidth="1.5" />
        <circle cx="12" cy="9" r="5" fill="none" stroke="#b6bccb" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
      <circle cx="16" cy="13" r="5" fill="#62c75a" stroke="#fff" strokeWidth="1.4" />
      <circle cx="12" cy="9" r="5" fill="#2bb0a3" stroke="#fff" strokeWidth="1.4" />
      <circle cx="8" cy="13" r="5" fill="#4a7fd6" stroke="#fff" strokeWidth="1.4" />
    </svg>
  )
}

function SeatsControl({ n, onChange, max, size = 15, showLabel = false, compact = false }: { n: number; onChange: (next: number) => void; max?: number; size?: number; showLabel?: boolean; compact?: boolean }) {
  const seats = Math.max(1, n)
  const capIcons = compact ? 2 : 6
  const icons = Math.min(seats, capIcons)
  const atMax = max != null && seats >= max
  const bw = compact ? 16 : 18
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: compact ? 3 : 5, background: "rgba(90,108,166,0.1)", borderRadius: 9, padding: compact ? "2px 4px" : "2px 5px 2px 8px", flexShrink: 0 }} title="Voor hoeveel personen telt deze naam (bij gedeelde items)">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 1, fontSize: compact ? 12 : size, lineHeight: 1 }}>
        {Array.from({ length: icons }).map((_, i) => <span key={i}>👤</span>)}
        {seats > capIcons && <span style={{ fontSize: compact ? 9.5 : 11, fontWeight: 800, color: "#5a6680", marginLeft: 1 }}>+{seats - capIcons}</span>}
      </span>
      {(showLabel || compact) && <span style={{ fontSize: compact ? 10.5 : 11.5, fontWeight: 700, color: "#5a6680", whiteSpace: "nowrap" }}>{seats} p.</span>}
      <button onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, seats - 1)) }} disabled={seats <= 1} style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: bw, height: bw, cursor: seats <= 1 ? "default" : "pointer", fontSize: compact ? 11 : 12, lineHeight: 1, opacity: seats <= 1 ? 0.4 : 1 }}>−</button>
      <button onClick={(e) => { e.stopPropagation(); if (!atMax) onChange(seats + 1) }} disabled={atMax} style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: bw, height: bw, cursor: atMax ? "default" : "pointer", fontSize: compact ? 11 : 12, lineHeight: 1, opacity: atMax ? 0.4 : 1 }}>+</button>
    </span>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "navy" | "green" | "red" | "gold" }) {
  const colors = {
    navy: { bg: "rgba(20,33,58,0.05)", fg: "#14213a" },
    green: { bg: "rgba(39,174,96,0.1)", fg: "#27ae60" },
    red: { bg: "rgba(224,107,94,0.1)", fg: "#e0685c" },
    gold: { bg: "rgba(233,196,95,0.16)", fg: "#a06b00" },
  }[tone]
  return (
    <div style={{ flex: 1, textAlign: "center", background: colors.bg, borderRadius: 12, padding: "10px 4px" }}>
      <div style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: colors.fg }}>{value}</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: 18, fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", background: "linear-gradient(180deg,#e4f5f8 0%,#cfecf3 55%,#bfe4ee 100%)", minHeight: "100vh", color: "#1d2433", maxWidth: 720, margin: "0 auto", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
  card: { background: "#ffffff", border: "1px solid rgba(16,24,40,0.04)", borderRadius: 22, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,0.03), 0 14px 30px -16px rgba(80,90,140,0.18)", marginBottom: 14 },
  btn: { border: "1px solid rgba(16,24,40,0.10)", background: "#ffffff", borderRadius: 12, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#1d2433", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" },
  btnPrimary: { background: "linear-gradient(135deg,#1499b0,#22b8cf)", color: "white", border: "none", boxShadow: "0 6px 16px -6px rgba(20,153,176,0.55)" },
  smallBtn: { border: "1px solid rgba(16,24,40,0.10)", background: "#fff", borderRadius: 10, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#5a6680" },
  iconBtn: { border: "none", background: "rgba(16,24,40,0.05)", borderRadius: 11, width: 32, height: 32, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  input: { border: "1.5px solid rgba(16,24,40,0.12)", borderRadius: 12, padding: "10px 13px", fontSize: 14, outline: "none", background: "#fff", color: "#1d2433" },
  lbl: { fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 },
  h1: { fontSize: 29, fontWeight: 800, letterSpacing: -0.7, marginBottom: 4, color: "#2f3c5e" },
  h3: { fontSize: 16, fontWeight: 800, marginBottom: 14, letterSpacing: -0.3, color: "#3b486a", display: "flex", alignItems: "center", gap: 9 },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, padding: "4px 2px" },
  tabBar: { display: "flex", gap: 4, background: "#edeef6", borderRadius: 16, padding: 5, marginBottom: 18, boxShadow: "inset 0 1px 2px rgba(16,24,40,0.04)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(16,24,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: 16 },
  modal: { background: "#fff", borderRadius: 24, padding: 24, width: 360, boxShadow: "0 24px 70px -12px rgba(16,24,40,0.35)", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(16,24,40,0.06)" },
  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1d2433", color: "#fff", padding: "11px 22px", borderRadius: 40, fontSize: 14, fontWeight: 600, zIndex: 2000, boxShadow: "0 10px 30px rgba(16,24,40,0.3)", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" },
  errorBanner: { background: "#fef2f2", border: "1px solid #fecaca", color: "#c0392b", borderRadius: 14, padding: "11px 16px", marginBottom: 14, display: "flex", alignItems: "center", fontSize: 14 },
}
