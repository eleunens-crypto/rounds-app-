"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { QRCodeSVG } from "qrcode.react"

// ═══════════════════════════════════════════════════════════════════════════
// RUNDO TABLE  —  losstaande mode (route: /table)
// Zelfde Supabase-client + huisstijl als party mode. Raakt /  (party) niet aan.
//
// Flow:
//  1. Admin maakt groep + scant de kassabon  → items (naam, prijs/stuk, aantal)
//  2. Admin kan gasten vooraf toevoegen + deelt de invite-code
//  3. Iedereen tikt aan wat hij at/dronk (per stuk: 1 van 2 cola's kan)
//  4. Gedeelde items (wijn/water) → delen of overlaten aan admin
//  5. Bevestigen → eigen totaal zichtbaar (+ melding als gedeeld nog open is)
//  6. Admin-overzicht: wat is verrekend / nog open / nog onbeslist
// ═══════════════════════════════════════════════════════════════════════════

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Group = { id: string; name: string; invite_code: string; owner_id: string; receipt_url?: string | null; party_size?: number | null; receipt_total?: number | null; created_at?: string }
type Participant = { id: string; name: string; group_id: string; self_joined?: boolean; created_at?: string }
type BillItem = {
  id: string
  group_id: string
  name: string
  unit_price: number
  quantity: number
  is_shared: boolean
  share_fixed?: boolean       // admin heeft de deelnemers van dit gedeelde item vastgelegd
  distribute?: string | null  // BTW/kost: null=gewoon item · "all"=proportioneel over alles · JSON-lijst item-ids
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

type ParsedItem = { name: string; unit_price: number; quantity: number; is_shared: boolean; distribute?: string }
type AdminTab = "scan" | "guests" | "overview"

// ─── LOCAL STORAGE / IDS ─────────────────────────────────────────────────────
function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}
function getOrCreateOwnerId(): string {
  if (typeof window === "undefined") return randomId()
  const key = "rundo_owner_id" // zelfde sleutel als party mode → zelfde toestel = zelfde eigenaar
  let id = localStorage.getItem(key)
  if (!id) { id = randomId(); localStorage.setItem(key, id) }
  return id
}
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
// Welke deelnemer "ben ik" in deze groep (per groep onthouden)
function getMeId(groupId: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`rundo_table_me_${groupId}`)
}
function setMeIdStored(groupId: string, participantId: string | null) {
  if (participantId) localStorage.setItem(`rundo_table_me_${groupId}`, participantId)
  else localStorage.removeItem(`rundo_table_me_${groupId}`)
}

// Laatst geopende groep onthouden, zodat je na een refresh niet naar het startscherm vliegt.
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

// ─── JOUW GROEPEN (lokaal bewaard, gekoppeld aan owner_id → future-proof) ─────
// Later vervang je owner_id door een echt account-id; deze lijst migreert dan mee.
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

// Datum netjes tonen (bv. "26 jun 2026"). Wordt enkel bij de WEERGAVE van de naam gebruikt,
// niet bij het opslaan of vergelijken van de naam zelf.
function fmtDate(iso?: string | number): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })
}

// ─── BON HERKENNEN (geïsoleerde, vervangbare stap) ───────────────────────────
const SHARED_KEYWORDS = ["wijn", "wine", "cava", "champagne", "water", "spa", "bruis", "plat",
  "karaf", "kan", "fles", "bottle", "pitcher", "schol", "aperitief", "sangria"]

// Regels die GEEN item zijn (totalen, belasting, betaalinfo, voettekst...) — die negeren we
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

function guessShared(name: string): boolean {
  const l = name.toLowerCase()
  return SHARED_KEYWORDS.some((k) => l.includes(k))
}

// Haalt een bedrag uit een tekst: ofwel met komma/punt ("13.00" / "24,90"),
// ofwel een blok cijfers waarvan de laatste 2 de centen zijn ("2490" → 24,90, "5 00" → 5,00).
// Geeft de waarde + de startpositie terug (zodat we de naam ervóór kunnen knippen).
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

// Heuristische parser, afgestemd op echte kassabonnen (bv. Lightspeed):
//  - regels beginnen vaak met een BTW-code zoals "1B", "2A" → die knippen we weg
//  - prijzen staan vaak ZONDER komma: "Konijnenbouten 2490" = €24,90, "Coca cola 5 00" = €5,00
//  - btw-detailregels onderaan ("12% 39.20 470 43.90") en totalen negeren we als item,
//    maar het BON-TOTAAL ("Totaal € 65,90") vangen we apart op voor de controle.
function parseReceiptText(raw: string): { items: ParsedItem[]; total: number | null } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const items: ParsedItem[] = []
  let total: number | null = null

  for (const rawLine of lines) {
    // Bon-totaal opvangen: regel met "totaal" maar niet subtotaal/netto/btw-detail (%)
    const low = rawLine.toLowerCase()
    if (/\btotaal\b|\btotal\b/.test(low) && !low.includes("subtotaal") && !low.includes("netto") && !low.includes("%")) {
      const amt = extractAmount(rawLine)
      if (amt && amt.value > 0) total = amt.value
      continue
    }

    if (isSkippableLine(rawLine)) continue
    let line = rawLine

    // BTW-code vooraan weg: "1B Konijnenbouten ..." / "2A Coca cola ..."
    line = line.replace(/^\s*\d{1,2}\s*[A-Da-d]\b\s*/, "").trim()

    // Een regel met 3+ losse getallen achteraan + een % is meestal een btw-detailregel → overslaan
    const trailingNums = line.match(/(\d+[.,]?\d*)(?:\s+\d+[.,]?\d*){2,}\s*$/)
    if (trailingNums && /%/.test(line)) continue

    const amt = extractAmount(line)
    if (!amt || amt.value <= 0) continue
    const lineTotal = amt.value
    const priceStartIdx = amt.startIdx

    // Naam = alles vóór de prijs
    let rest = line.slice(0, priceStartIdx).trim()

    // Aantal vooraan? ("2", "2x", "2 x")
    let qty = 1
    const qtyMatch = rest.match(/^(\d{1,2})\s*[xX×]?\s+/)
    if (qtyMatch) { qty = Math.max(1, parseInt(qtyMatch[1], 10)); rest = rest.slice(qtyMatch[0].length).trim() }

    // Opkuisen: losse leestekens/streepjes vooraan en dubbele spaties weg
    const name = rest.replace(/^[-•*.\s]+/, "").replace(/\s{2,}/g, " ").trim()

    // Onbruikbaar als naam: leeg, te kort, of bijna alleen cijfers/tekens
    const letters = (name.match(/[a-zA-ZÀ-ÿ]/g) || []).length
    if (!name || name.length < 2 || letters < 2) continue

    // We bewaren de prijs PER STUK; bij aantal>1 delen we het lijntotaal.
    const unit = qty > 1 ? +(lineTotal / qty).toFixed(2) : lineTotal
    items.push({ name, unit_price: unit, quantity: qty, is_shared: guessShared(name) })
  }
  return { items, total }
}

// FUTURE — goedkope opkuis: stuur ruwe OCR-tekst naar je API-route met een klein tekstmodel
// dat er nette {name, unit_price, quantity} van maakt. Nu: lokale parser.
//
//   const res = await fetch("/api/parse-receipt", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ text: rawText }),
//   })
//   const { items } = await res.json()
//   return items
async function cleanReceiptToItems(rawText: string): Promise<{ items: ParsedItem[]; total: number | null }> {
  return parseReceiptText(rawText)
}

// Foto opkuisen vóór de OCR: vergroten (kleine itemtekst wordt leesbaar), grijswaarden
// en wat extra contrast. Dit is veruit de grootste winst voor herkenning van kleine regels.
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
      // contrast rond het midden optrekken zodat tekst donkerder en papier witter wordt
      const v = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(id, 0, 0)
  } catch { /* getImageData kan falen bij rare bestanden — dan gewoon de geschaalde foto gebruiken */ }
  URL.revokeObjectURL(img.src)
  return canvas.toDataURL("image/png")
}

// Tesseract.js leest de tekst uit de (opgekuiste) foto. createWorker + vaste taaldata-bron
// is betrouwbaarder onder Next.js/Turbopack. PSM 6 leest de bon als één tekstblok regel per
// regel, wat doorgaans méér itemregels oplevert dan de automatische modus.
async function scanReceipt(file: File, onProgress?: (p: number) => void): Promise<{ items: ParsedItem[]; total: number | null }> {
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

// ─── RUNDO LOGO (overgenomen uit party mode) ─────────────────────────────────
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

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t) }, [onDone])
  return <div style={S.toast}>{message}</div>
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function RundoTable() {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const autoJoined = useRef(false)

  const [group, setGroup] = useState<Group | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [viaLink, setViaLink] = useState(false) // binnengekomen via gedeelde link/QR → altijd als gast behandelen
  const isOwnerDevice = !!group && group.owner_id === getOrCreateOwnerId()
  const isAdmin = isOwnerDevice && !viaLink

  // start-scherm
  const [groupName, setGroupName] = useState("")
  const [partySize, setPartySize] = useState("")        // verwacht aantal personen in de groep
  const [busy, setBusy] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [myGroups, setMyGroups] = useState<SavedGroup[]>([])
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => { setMyGroups(getMyGroups()) }, [])

  // data
  const [participants, setParticipants] = useState<Participant[]>([])
  const [items, setItems] = useState<BillItem[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])

  // ui
  const [adminTab, setAdminTab] = useState<AdminTab>("scan")
  const [showScan, setShowScan] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanPreview, setScanPreview] = useState<ParsedItem[]>([])
  const [scanTotal, setScanTotal] = useState<string>("")          // bon-totaal (uit scan, bewerkbaar)
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set()) // wie is uitgeklapt in overzicht
  const [claimMode, setClaimMode] = useState<"item" | "person">("item")        // aantikken: per item of per persoon
  const [claimPid, setClaimPid] = useState<string | null>(null)                // gekozen persoon in 'per persoon'-modus
  const [scanFile, setScanFile] = useState<File | null>(null)        // de gekozen foto, om te bewaren
  const [scanPhotoUrl, setScanPhotoUrl] = useState<string | null>(null) // tijdelijke preview-url
  const [viewReceipt, setViewReceipt] = useState<string | null>(null)   // bon groot bekijken
  const [newGuest, setNewGuest] = useState("")
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [showTodo, setShowTodo] = useState(false)
  const [showTaxInfo, setShowTaxInfo] = useState(false)       // uitleg-popup bij BTW-knop
  const [taxConfig, setTaxConfig] = useState<string | null>(null) // welk BTW-item zijn doel-items kiest
  const [editItem, setEditItem] = useState<BillItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ─── loaders ───────────────────────────────────────────────────────────────
  const loadAll = useCallback(async (groupId: string) => {
    const [{ data: p }, { data: it }, { data: cl }, { data: cf }] = await Promise.all([
      supabase.from("table_participants").select("*").eq("group_id", groupId),
      supabase.from("table_items").select("*").eq("group_id", groupId),
      supabase.from("table_claims").select("*").eq("group_id", groupId),
      supabase.from("table_confirmations").select("*").eq("group_id", groupId),
    ])
    if (!mounted.current) return
    const order = <T extends { created_at?: string; id: string }>(rows: T[]) =>
      [...(rows || [])].sort((a, b) => (a.created_at ?? a.id) < (b.created_at ?? b.id) ? -1 : 1)
    setParticipants(order(p as Participant[] || []))
    setItems(order(it as BillItem[] || []))
    setClaims((cl as Claim[]) || [])
    setConfirmations((cf as Confirmation[]) || [])
  }, [])

  // realtime — zelfde patroon als party mode
  useEffect(() => {
    if (!group) return
    const ch = supabase.channel(`table-${group.id}`)
    const reload = () => { if (mounted.current) loadAll(group.id) }
    ;["table_participants", "table_items", "table_claims", "table_confirmations"].forEach((table) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `group_id=eq.${group.id}` }, reload)
    })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [group, loadAll])

  // Actieve tab onthouden zodat een refresh je op dezelfde tab houdt.
  useEffect(() => {
    if (group && typeof window !== "undefined") localStorage.setItem("rundo_table_last_tab", adminTab)
  }, [adminTab, group])

  // Bij opstarten: een gedeelde link (?code=) opent die groep; anders heropenen we
  // automatisch de laatst geopende groep, zodat een refresh je niet naar het startscherm gooit.
  useEffect(() => {
    if (autoJoined.current || group) return
    if (typeof window === "undefined") return
    const code = new URLSearchParams(window.location.search).get("code")
    if (code) { autoJoined.current = true; setViaLink(true); joinGroup(code); return }
    const last = getLastGroup()
    if (last) {
      autoJoined.current = true
      const savedTab = localStorage.getItem("rundo_table_last_tab")
      const tab: AdminTab = (savedTab === "guests" || savedTab === "overview" || savedTab === "scan") ? savedTab : "scan"
      openSavedGroup(last, tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── groep maken / joinen ────────────────────────────────────────────────────
  const createGroup = async () => {
    if (busy) return
    const name = groupName.trim()
    if (!name) { setStartError("Geef eerst een naam voor de rekening."); return }
    const size = parseInt(partySize)
    if (!size || size < 1) { setStartError("Vul het aantal personen in om de groep te starten."); return }
    // Geen dubbele namen (hoofdletter-ongevoelig); de datum die we later tonen telt hier niet mee.
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

  const joinGroup = async (codeOverride?: string) => {
    const code = (codeOverride ?? "").trim().toUpperCase()
    if (!code || busy) return
    setBusy(true); setStartError(null)
    try {
      const { data, error } = await supabase.from("table_groups").select("*").eq("invite_code", code).single()
      if (error || !data) { setStartError("Groep niet gevonden. Controleer de code."); return }
      const role = data.owner_id === getOrCreateOwnerId() ? "admin" : "gast"
      saveMyGroup(data, role); setMyGroups(getMyGroups()); rememberLastGroup(data.id)
      setGroup(data); setMeId(getMeId(data.id)); await loadAll(data.id)
    } finally { setBusy(false) }
  }

  // Een eerder bewaarde groep heropenen vanuit "jouw groepen"
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
    // Alles wat aan de groep hangt eerst wissen, dan de groep zelf.
    await supabase.from("table_claims").delete().eq("group_id", id)
    await supabase.from("table_confirmations").delete().eq("group_id", id)
    await supabase.from("table_items").delete().eq("group_id", id)
    await supabase.from("table_participants").delete().eq("group_id", id)
    const { error } = await supabase.from("table_groups").delete().eq("id", id)
    if (error) { setStartError("Verwijderen mislukt: " + error.message); return }
    if (getLastGroup() === id) rememberLastGroup(null)
    removeMyGroup(id); setMyGroups(getMyGroups())
  }

  const leaveGroup = () => {
    setGroup(null); setMeId(null); setItems([]); setClaims([]); setParticipants([]); setConfirmations([])
    setGroupName(""); setPartySize(""); setError(null)
    setViaLink(false); autoJoined.current = false
    rememberLastGroup(null)
    setMyGroups(getMyGroups())
  }

  // ─── gasten / identiteit ─────────────────────────────────────────────────────
  const addGuest = async (name?: string, selfJoined = false) => {
    if (!group) return
    const finalName = (name ?? newGuest).trim() || `Gast ${participants.length + 1}`
    let { data, error } = await supabase.from("table_participants")
      .insert([{ name: finalName, group_id: group.id, self_joined: selfJoined }]).select().single()
    // Bestaat de kolom self_joined nog niet in de database? Probeer dan zonder, maar waarschuw.
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

  const pickMe = (participantId: string) => {
    if (!group) return
    setMeIdStored(group.id, participantId); setMeId(participantId)
  }

  const joinAsNewPerson = async (name: string) => {
    const p = await addGuest(name, true)  // gast meldt zichzelf aan via de link
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

  // ─── bon scannen / items ─────────────────────────────────────────────────────
  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return
    setScanError(null); setScanPreview([]); setScanProgress(0); setScanning(true)
    setScanFile(file)
    if (scanPhotoUrl) URL.revokeObjectURL(scanPhotoUrl)
    setScanPhotoUrl(URL.createObjectURL(file)) // tonen zodat je kan checken of alles erop staat
    try {
      const parsed = await scanReceipt(file, (p) => setScanProgress(p))
      setScanPreview(parsed.items)
      setScanTotal(parsed.total != null ? parsed.total.toFixed(2) : "")
      if (parsed.items.length === 0) {
        setScanError("Niets herkend op de foto. Maak een scherpere foto, recht van boven en goed belicht, en probeer opnieuw.")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("Tesseract scan-fout:", e)
      setScanError("Scannen kon niet starten (technische fout): " + msg)
    } finally {
      setScanning(false)
    }
  }

  const confirmScan = async () => {
    if (!group || scanPreview.length === 0) return
    // 1. Foto bewaren in Supabase Storage (bucket "receipts") zodat jij + de gasten ze kunnen bekijken
    let receiptUrl = group.receipt_url ?? null
    if (scanFile) {
      const ext = (scanFile.name.split(".").pop() || "jpg").toLowerCase()
      const path = `${group.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, scanFile, { upsert: true })
      if (upErr) { setToast("Foto bewaren mislukt — items worden wel toegevoegd") }
      else {
        receiptUrl = supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl
        const { error: urlErr } = await supabase.from("table_groups").update({ receipt_url: receiptUrl }).eq("id", group.id)
        if (urlErr) setError("De bonfoto kon niet bij de groep bewaard worden: " + urlErr.message)
        else setGroup({ ...group, receipt_url: receiptUrl })
      }
    }
    // 2. Items opslaan: eerst de gewone items, dan de BTW-regels met opgeloste verdeling.
    const baseList = scanPreview.map((it, idx) => ({ it, idx })).filter((o) => !o.it.distribute)
    const taxList = scanPreview.map((it, idx) => ({ it, idx })).filter((o) => !!o.it.distribute)
    const baseRows = baseList.map(({ it }) => ({
      group_id: group.id, name: it.name, unit_price: it.unit_price,
      quantity: it.quantity, is_shared: it.is_shared, category: null,
    }))
    let columnMissing = false
    // Gewone items invoegen en hun nieuwe ids ophalen (in volgorde)
    const baseRes = await supabase.from("table_items").insert(baseRows).select()
    if (baseRes.error) { setError("Items opslaan mislukt: " + baseRes.error.message); return }
    const inserted = baseRes.data || []
    // scanPreview-index → nieuw item-id (voor de "bepaalde items"-verdeling)
    const idByScanIdx: Record<number, string> = {}
    baseList.forEach((o, k) => { if (inserted[k]) idByScanIdx[o.idx] = inserted[k].id })

    // BTW-regels invoegen, met "all" of een ids-lijst
    if (taxList.length > 0) {
      const taxRows = taxList.map(({ it }) => {
        let dist: string = "all"
        if (it.distribute && it.distribute !== "all") {
          try { const sel = (JSON.parse(it.distribute).idx) as number[]; dist = JSON.stringify(sel.map((ix) => idByScanIdx[ix]).filter(Boolean)) } catch { dist = "all" }
        }
        return { group_id: group.id, name: it.name, unit_price: it.unit_price, quantity: 1, is_shared: false, category: null, distribute: dist }
      })
      let taxRes = await supabase.from("table_items").insert(taxRows)
      if (taxRes.error && /distribute/.test(taxRes.error.message || "")) {
        columnMissing = true
        const stripped = taxList.map(({ it }) => ({ group_id: group.id, name: it.name, unit_price: it.unit_price, quantity: 1, is_shared: false, category: null }))
        taxRes = await supabase.from("table_items").insert(stripped)
      }
      if (taxRes.error) { setError("BTW opslaan mislukt: " + taxRes.error.message); return }
    }
    if (columnMissing) setError("Let op: voeg in Supabase de kolom 'distribute' toe, anders wordt de BTW-verdeling niet bewaard.")
    const rows = scanPreview  // voor de teller in de toast hieronder
    // 3. Bon-totaal onthouden zodat de vergelijking ook later op de Bon-tab beschikbaar blijft
    const billNum = parseFloat((scanTotal || "").replace(",", "."))
    if (!isNaN(billNum) && billNum > 0) {
      const { error: tErr } = await supabase.from("table_groups").update({ receipt_total: billNum }).eq("id", group.id)
      if (!tErr) setGroup((g) => g ? { ...g, receipt_total: billNum } : g)
    }
    setScanPreview([]); setScanTotal(""); setScanError(null); setScanFile(null)
    if (scanPhotoUrl) { URL.revokeObjectURL(scanPhotoUrl); setScanPhotoUrl(null) }
    setShowScan(false)
    await loadAll(group.id)
    setToast(`${rows.length} item${rows.length !== 1 ? "s" : ""} toegevoegd`)
  }

  // Verwacht aantal personen (de teller) achteraf wijzigen
  const setPartySizeValue = async (n: number) => {
    if (!group || n < 1) return
    setGroup((g) => g ? { ...g, party_size: n } : g)
    const { error } = await supabase.from("table_groups").update({ party_size: n }).eq("id", group.id)
    if (error) setError("Aantal personen opslaan mislukt: " + error.message)
  }

  const addManualItem = async () => {
    if (!group) return
    const { error } = await supabase.from("table_items")
      .insert([{ group_id: group.id, name: "Nieuw item", unit_price: 0, quantity: 1, is_shared: false, category: null }])
    if (error) { setError("Item toevoegen mislukt"); return }
    await loadAll(group.id)
  }

  // BTW/kost als apart item dat proportioneel over de rekening wordt verdeeld.
  // distribute = "all" (over alles) of een JSON-lijst van item-ids (gekozen items).
  const addTaxItem = async () => {
    if (!group) return
    const { error } = await supabase.from("table_items")
      .insert([{ group_id: group.id, name: "BTW / tax", unit_price: 0, quantity: 1, is_shared: false, category: null, distribute: "all" }])
    if (error) {
      if (/distribute/.test(error.message || "")) setError("Voeg eerst de kolom 'distribute' toe in Supabase (zie instructies).")
      else setError("BTW toevoegen mislukt: " + error.message)
      return
    }
    await loadAll(group.id)
  }

  const setDistribute = async (it: BillItem, val: string) => {
    if (!group) return
    await supabase.from("table_items").update({ distribute: val }).eq("id", it.id)
    await loadAll(group.id)
  }

  const saveItem = async () => {
    if (!group || !editItem) return
    const { error } = await supabase.from("table_items").update({
      name: editItem.name, unit_price: editItem.unit_price,
      quantity: editItem.quantity, is_shared: editItem.is_shared,
    }).eq("id", editItem.id)
    if (error) { setError("Opslaan mislukt"); return }
    setEditItem(null); await loadAll(group.id)
  }

  const toggleShared = async (it: BillItem) => {
    if (!group) return
    await supabase.from("table_items").update({ is_shared: !it.is_shared }).eq("id", it.id)
    await loadAll(group.id)
  }

  const deleteItem = async (id: string) => {
    if (!group) return
    await supabase.from("table_claims").delete().eq("item_id", id)
    await supabase.from("table_items").delete().eq("id", id)
    await loadAll(group.id)
  }

  // ─── claims (per stuk aantikken) ────────────────────────────────────────────
  const claimedQty = (itemId: string) =>
    claims.filter((c) => c.item_id === itemId).reduce((s, c) => s + c.quantity, 0)
  const myQty = (itemId: string, pid: string | null) =>
    pid ? claims.filter((c) => c.item_id === itemId && c.participant_id === pid).reduce((s, c) => s + c.quantity, 0) : 0
  const sharerIds = (itemId: string) => {
    const ids = new Set<string>()
    claims.filter((c) => c.item_id === itemId && c.quantity > 0).forEach((c) => ids.add(c.participant_id))
    return [...ids]
  }
  // Per item: lijst van {naam, aantal} per persoon die iets claimde
  const claimsForItem = (itemId: string) =>
    claims
      .filter((c) => c.item_id === itemId && c.quantity > 0)
      .map((c) => ({ name: participants.find((p) => p.id === c.participant_id)?.name ?? "?", qty: c.quantity }))

  // Zet het aantal dat 'pid' van een item claimt op een absolute waarde (1 row per persoon/item)
  const setClaim = async (itemId: string, pid: string, qty: number) => {
    if (!group) return
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

  // Gedeeld item: in/uit het delen stappen (quantity 1 = "ik deel mee")
  const toggleShareClaim = async (itemId: string, pid: string) => {
    const mine = myQty(itemId, pid)
    await setClaim(itemId, pid, mine > 0 ? 0 : 1)
  }

  // Admin legt de deelnemers van een gedeeld item vast (of maakt het weer open)
  const setShareFixed = async (it: BillItem, val: boolean) => {
    if (!group) return
    await supabase.from("table_items").update({ share_fixed: val }).eq("id", it.id)
    await loadAll(group.id)
  }

  // ─── totalen ─────────────────────────────────────────────────────────────────
  const itemTotal = (it: BillItem) => it.unit_price * it.quantity

  // Een BTW/kost-item heeft een 'distribute'-waarde; het wordt niet geclaimd maar verdeeld.
  const isTax = (it: BillItem) => it.distribute != null && it.distribute !== ""
  const baseItems = items.filter((it) => !isTax(it))   // de echte, claimbare items
  const taxItems = items.filter((it) => isTax(it))     // BTW/kosten

  // Op welke basis-items slaat een BTW-item? "all" = alle, anders een JSON-lijst van ids.
  const taxTargetIds = (t: BillItem): Set<string> => {
    if (t.distribute === "all") return new Set(baseItems.map((i) => i.id))
    try {
      const ids = JSON.parse(t.distribute || "[]") as string[]
      return new Set(baseItems.filter((i) => ids.includes(i.id)).map((i) => i.id))
    } catch { return new Set(baseItems.map((i) => i.id)) }
  }

  // Een gedeeld item deelt zijn bedrag LIVE door wie er meedoet, zodra er minstens
  // één deelnemer is aangeduid. De som verschijnt dus meteen (wijn door 3 = /3),
  // ook als nog niet iedereen bevestigd heeft. Of het al "definitief" is (iedereen
  // bevestigd of door de admin vastgezet) tonen we apart via pendingShared.
  const sharedRevealed = (it: BillItem) => sharerIds(it.id).length > 0

  // Wat draagt 'pid' bij aan één basis-item (gewoon: prijs×aantal · gedeeld: aandeel)?
  const baseAmountForItem = (pid: string, it: BillItem): number => {
    if (it.is_shared) {
      const sh = sharerIds(it.id)
      return sh.includes(pid) && sharedRevealed(it) ? itemTotal(it) / sh.length : 0
    }
    return it.unit_price * myQty(it.id, pid)
  }
  // Som van iemands bijdrage binnen een set basis-items (voor proportionele BTW-verdeling)
  const baseWithin = (pid: string, ids: Set<string>): number =>
    baseItems.filter((i) => ids.has(i.id)).reduce((s, i) => s + baseAmountForItem(pid, i), 0)

  // Iemands aandeel in alle BTW-items: per BTW-item proportioneel t.o.v. wat ieder in de
  // doel-items bestelde. Verdeelt het BTW-bedrag exact over wie die items nam.
  const taxShare = (pid: string): number => {
    let total = 0
    for (const t of taxItems) {
      const ids = taxTargetIds(t)
      const denom = participants.reduce((s, q) => s + baseWithin(q.id, ids), 0)
      if (denom > 0) total += itemTotal(t) * (baseWithin(pid, ids) / denom)
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
            settled += itemTotal(it) / sh.length
            if (!allConfirmed) pendingShared = true // kan nog licht wijzigen tot iedereen bevestigt
          } else {
            pendingShared = true // bedrag nog niet bepaald (geen deelnemers vastgelegd)
          }
        }
      } else {
        settled += it.unit_price * myQty(it.id, pid)
      }
    }
    settled += taxShare(pid)  // proportioneel aandeel in BTW/kosten
    return { settled, pendingShared }
  }

  // Detail: welke items nam deze persoon, en voor welk bedrag (incl. aandeel in gedeelde items + BTW)
  const personItems = (pid: string): { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number }[] => {
    const out: { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number }[] = []
    for (const it of baseItems) {
      if (it.is_shared) {
        const sh = sharerIds(it.id)
        if (sh.includes(pid)) {
          const rev = sharedRevealed(it)
          out.push({ name: it.name, qty: 1, amount: rev ? itemTotal(it) / sh.length : 0, shared: true, revealed: rev, sharers: sh.length })
        }
      } else {
        const q = myQty(it.id, pid)
        if (q > 0) out.push({ name: it.name, qty: q, amount: it.unit_price * q, shared: false, revealed: true, sharers: 0 })
      }
    }
    const tax = taxShare(pid)
    if (tax > 0.005) out.push({ name: "BTW / kosten (verdeeld)", qty: 1, amount: tax, shared: false, revealed: true, sharers: 0 })
    return out
  }

  // Heeft deze persoon al iets toegewezen gekregen (een stuk geclaimd of meedelen in een gedeeld item)?
  const hasAssignment = (pid: string): boolean =>
    baseItems.some((it) => it.is_shared ? sharerIds(it.id).includes(pid) : myQty(it.id, pid) > 0)

  // Wat telt als "bevestigd":
  //  - link/QR-gast (self_joined): pas wanneer die zélf bevestigt
  //  - door admin toegevoegde gast: zodra die iets toegewezen kreeg
  const isConfirmed = (pid: string): boolean => {
    const p = participants.find((x) => x.id === pid)
    if (p && !p.self_joined) return hasAssignment(pid)
    return confirmations.some((c) => c.participant_id === pid)
  }
  // Heeft deze persoon écht zelf op 'bevestigen' gedrukt? (Gebruikt in het aantikscherm.)
  const explicitConfirmed = (pid: string): boolean => confirmations.some((c) => c.participant_id === pid)
  const allConfirmed = participants.length > 0 && participants.every((p) => isConfirmed(p.id))
  const iConfirmed = !!meId && confirmations.some((c) => c.participant_id === meId)

  // Statuslabel voor een gast: groen bevestigd · oranje nog niet bevestigd · rood nog toe te wijzen
  const guestStatus = (pid: string): { label: string; color: string; bg: string } => {
    if (isConfirmed(pid)) return { label: "✓ bevestigd", color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
    if (!hasAssignment(pid)) return { label: "nog toe te wijzen", color: "#c0392b", bg: "rgba(224,107,94,0.12)" }
    return { label: "nog niet bevestigd", color: "#a06b00", bg: "rgba(233,196,95,0.18)" }
  }

  const billTotal = items.reduce((s, it) => s + itemTotal(it), 0)
  const openUnits = baseItems.filter((it) => !it.is_shared)
    .reduce((s, it) => s + Math.max(0, it.quantity - claimedQty(it.id)), 0)
  const undecidedShared = baseItems.filter((it) => it.is_shared && sharerIds(it.id).length === 0)

  // ─── bevestigen ──────────────────────────────────────────────────────────────
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
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <RundoLogo size={56} />
            <div>
              <h1 style={{ ...S.h1, color: "#1b2a4a", margin: 0 }}>Rundo</h1>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#5a6ca6,#7283b6)", borderRadius: 8, padding: "2px 10px", letterSpacing: 0.5 }}>TABLE</span>
            </div>
          </div>
          <p style={{ textAlign: "center", color: "#f0a500", fontSize: 15, fontWeight: 700, margin: "0 0 24px" }}>Scan de rekening, ieder tikt aan, klaar.</p>

          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#3b486a", marginBottom: 8 }}>🧾 Nieuwe rekening (admin)</div>
            <input value={groupName} onChange={(e) => { setStartError(null); setGroupName(e.target.value) }} onKeyDown={(e) => e.key === "Enter" && createGroup()} placeholder="Naam (bv. Tafel 12 — De Kroeg)" style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#5a6680", fontWeight: 600 }}>Aantal personen <span style={{ color: "#c0392b" }}>*</span></span>
              <input type="number" min="1" value={partySize} onChange={(e) => { setStartError(null); setPartySize(e.target.value) }} onKeyDown={(e) => e.key === "Enter" && createGroup()} placeholder="bv. 6" style={{ ...S.input, width: 80, textAlign: "center" }} />
              <span style={{ fontSize: 11.5, color: "#9aa0ab" }}>(verplicht · later aanpasbaar)</span>
            </div>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 16, fontWeight: 800 }} onClick={createGroup} disabled={busy}>{busy ? "Laden..." : "Groep starten →"}</button>
          </div>

          {startError && (
            <div style={{ marginTop: 4, color: "#c0392b", fontSize: 13, background: "#fff0f0", borderRadius: 10, padding: "10px 12px" }}>⚠️ {startError}</div>
          )}

          {myGroups.length > 0 && (
            <div style={{ ...S.card, marginTop: 14 }}>
              <div onClick={() => setShowSaved((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#3b486a" }}>📂 Opgeslagen groepen <span style={{ color: "#9aa0ab", fontWeight: 700 }}>({myGroups.length})</span></span>
                <span style={{ fontSize: 12, color: "#9aa0ab", fontWeight: 700 }}>{showSaved ? "▲ verbergen" : "▼ tonen"}</span>
              </div>
              {showSaved && (
                <div style={{ marginTop: 10 }}>
                  {myGroups.map((g) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <button onClick={() => openSavedGroup(g.id)} disabled={busy} style={{ ...S.btn, flex: 1, minWidth: 0, textAlign: "left", padding: "11px 13px", fontWeight: 700 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: g.role === "admin" ? "#5a6ca6" : "#9aa0ab" }}>{g.role === "admin" ? "beheerder" : "gast"}{fmtDate(g.created_at ?? g.savedAt) ? ` · ${fmtDate(g.created_at ?? g.savedAt)}` : ""}</span>
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
        <TopBar group={group} isAdmin={isAdmin} onHome={leaveGroup} signedUp={participants.length} />
        <div style={{ maxWidth: 440, margin: "0 auto" }}>
          <div style={S.card}>
            <h3 style={S.h3}>👋 Wie ben jij?</h3>
            <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 14 }}>Vul je naam in om mee te doen.</p>

            {/* Eigen naam invullen — primaire actie */}
            <IdentityAdder onAdd={joinAsNewPerson} />

            {/* Vooraf toegevoegde namen — optioneel aanklikken */}
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

      <TopBar group={group} isAdmin={isAdmin} onHome={leaveGroup} me={me?.name} signedUp={participants.length} />

      {/* Vaste statusbalk — op elke tab zichtbaar, vlak onder de groepsnaam */}
      {isAdmin && (() => {
        const total = group.party_size ?? participants.length
        const aangemeld = participants.length
        const viaButton = participants.filter((p) => !p.self_joined).length
        const viaLink = participants.filter((p) => p.self_joined).length
        const bevestigd = participants.filter((p) => isConfirmed(p.id)).length
        const nietBevestigd = participants.filter((p) => !isConfirmed(p.id))
        const nietAangemeld = Math.max(0, total - aangemeld)
        const allIn = nietAangemeld === 0 && nietBevestigd.length === 0
        return (
          <div style={{ background: allIn ? "rgba(39,174,96,0.1)" : "rgba(20,33,58,0.04)", border: "1px solid rgba(16,24,40,0.06)", borderRadius: 14, padding: "9px 12px", marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: allIn ? "#1f8a4c" : "#5a6680" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                🧑‍🤝‍🧑 Groep:
                <button onClick={() => setPartySizeValue(Math.max(1, total - 1))} style={{ ...S.iconBtn, width: 24, height: 24, fontSize: 15 }} title="minder personen">−</button>
                <b style={{ minWidth: 16, textAlign: "center", display: "inline-block", color: "#14213a" }}>{total}</b>
                <button onClick={() => setPartySizeValue(total + 1)} style={{ ...S.iconBtn, width: 24, height: 24, fontSize: 15, background: "rgba(27,42,74,0.12)" }} title="meer personen">+</button>
                {total === 1 ? "persoon" : "personen"}
              </span>
              <span>👤 Aangemeld {aangemeld}/{total} <span style={{ fontWeight: 600, color: "#8a93a3" }}>({viaButton} knop · {viaLink} link)</span></span>
              <span>✅ Bevestigd {bevestigd}/{total}</span>
            </div>
            {(nietAangemeld > 0 || nietBevestigd.length > 0) && (
              <div style={{ marginTop: 5, fontWeight: 600, color: "#a06b00", fontSize: 12 }}>
                {nietAangemeld > 0 && <span>⏳ Nog {nietAangemeld} aan te melden{nietBevestigd.length > 0 ? " · " : ""}</span>}
                {nietBevestigd.length > 0 && <span>Nog niet bevestigd: {nietBevestigd.map((p) => p.name).join(", ")}</span>}
              </div>
            )}
          </div>
        )
      })()}

      {/* Admin tabs */}
      {isAdmin && (
        <div style={S.tabBar}>
          {([
            { id: "scan", label: "🧾 Bon" },
            { id: "guests", label: "👥 Gasten & delen" },
            { id: "overview", label: "📊 Overzicht" },
          ] as { id: AdminTab; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => setAdminTab(t.id)} style={{
              flex: 1, border: "none", borderRadius: 12, padding: "10px 4px", fontSize: 13, cursor: "pointer",
              fontWeight: adminTab === t.id ? 800 : 600,
              background: adminTab === t.id ? "linear-gradient(135deg,#f6dd95,#eecb6e)" : "transparent",
              color: adminTab === t.id ? "#5a4a1a" : "#8b93a8",
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Subtiele bon-preview, in elke tab beschikbaar */}
      {group.receipt_url && (
        <div style={{ textAlign: "right", marginTop: -6, marginBottom: 10 }}>
          <button onClick={() => setViewReceipt(group.receipt_url!)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#5a6ca6", padding: "2px 4px" }}>🧾 Bon bekijken</button>
        </div>
      )}

      {/* ─── ADMIN: Bon & items ─── */}
      {isAdmin && adminTab === "scan" && (
        <div>
          <button onClick={() => setShowScan(true)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "15px 0", fontSize: 15, fontWeight: 800, marginBottom: 12 }}>📷 Kassabon scannen</button>

          {/* Gescande bon — altijd in beeld naast wat je toevoegde */}
          {group.receipt_url && (
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 8 }}>📷 Gescande bon — vergelijk met je items</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={group.receipt_url} alt="gescande bon" onClick={() => setViewReceipt(group.receipt_url!)} style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", background: "#faf9f5", cursor: "zoom-in" }} />
              <div style={{ fontSize: 11, color: "#9aa0ab", textAlign: "center", marginTop: 6 }}>Tik de foto aan om groot te bekijken.</div>
            </div>
          )}

          {items.length > 0 && (
          <ItemList
            items={baseItems} claimedQty={claimedQty} participants={participants} claimsForItem={claimsForItem}
            sharerIds={sharerIds} toggleShareClaim={toggleShareClaim} setShareFixed={setShareFixed}
            onEdit={setEditItem} onToggleShared={toggleShared} onDelete={deleteItem} onAddManual={addManualItem} bareBill
            taxLines={taxItems.map((t) => ({ name: t.name, amount: itemTotal(t) }))}
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
                          onBlur={(e) => supabase.from("table_items").update({ name: e.target.value }).eq("id", t.id).then(() => loadAll(group.id))}
                          style={{ ...S.input, flex: 1, minWidth: 0, fontWeight: 700, padding: "8px 10px" }} />
                        <span style={{ color: "#999", fontSize: 13 }}>€</span>
                        <input type="number" step="0.01" defaultValue={t.unit_price ? t.unit_price.toFixed(2) : ""} placeholder="0.00"
                          onBlur={(e) => { const v = parseFloat(e.target.value.replace(",", ".")) || 0; supabase.from("table_items").update({ unit_price: v, quantity: 1 }).eq("id", t.id).then(() => loadAll(group.id)) }}
                          style={{ ...S.input, width: 78, textAlign: "right", padding: "8px 8px" }} />
                        <button style={{ ...S.iconBtn, background: open ? "rgba(90,108,166,0.18)" : "rgba(16,24,40,0.05)" }} onClick={() => setTaxConfig(open ? null : t.id)} title="verdeling">⚙️</button>
                        <button style={S.iconBtn} onClick={() => deleteItem(t.id)} title="verwijderen">🗑️</button>
                      </div>
                      <div style={{ fontSize: 10.5, color: "#9aa0ab", marginTop: 4, marginLeft: 25 }}>
                        verdeeld {overAll ? "over de hele rekening" : `over ${targetCount} gekozen item${targetCount === 1 ? "" : "s"}`} · tik ⚙️ om te wijzigen
                      </div>
                      {open && (
                        <div style={{ marginLeft: 25, marginTop: 8, padding: 10, borderRadius: 12, background: "#fbfaff", border: "1px solid rgba(90,108,166,0.2)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 5 }}>Hoe verdelen?</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: overAll ? 0 : 8 }}>
                            <button onClick={() => setDistribute(t, "all")} style={{ flex: 1, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 6px", cursor: "pointer", border: overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: overAll ? "linear-gradient(135deg,#5a6ca6,#7283b6)" : "#fff", color: overAll ? "#fff" : "#5a6680" }}>📊 Over de hele rekening</button>
                            <button onClick={() => { if (overAll) setDistribute(t, JSON.stringify(baseItems.map((i) => i.id))) }} style={{ flex: 1, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 6px", cursor: "pointer", border: !overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: !overAll ? "linear-gradient(135deg,#5a6ca6,#7283b6)" : "#fff", color: !overAll ? "#fff" : "#5a6680" }}>🎯 Over bepaalde items{!overAll ? ` (${targetCount})` : ""}</button>
                          </div>
                          {!overAll && (
                            <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#a06b00", marginBottom: 6 }}>👉 Tik aan welke items deze kost dragen.</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {baseItems.map((bi) => {
                                  let ids: string[] = []
                                  try { ids = JSON.parse(t.distribute || "[]") } catch { ids = [] }
                                  const on = ids.includes(bi.id)
                                  return (
                                    <button key={bi.id} onClick={() => { const next = on ? ids.filter((x) => x !== bi.id) : [...ids, bi.id]; setDistribute(t, JSON.stringify(next)) }}
                                      style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: on ? "none" : "1px solid rgba(16,24,40,0.12)", background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff", color: on ? "#5a4a1a" : "#8b93a8" }}>{on ? "✓ " : "+ "}{bi.name}</button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button onClick={addTaxItem} style={{ ...S.btn, flex: 1, fontWeight: 700, fontSize: 13 }}>🧮 BTW / tax toevoegen</button>
                  <button onClick={() => setShowTaxInfo(true)} style={{ ...S.btn, fontWeight: 700, fontSize: 13, padding: "0 14px" }}>ℹ️</button>
                </div>
              </div>
            }
          />
          )}
        </div>
      )}

      {/* ─── ADMIN: Gasten & delen ─── */}
      {isAdmin && adminTab === "guests" && (
        <div>
          {/* GASTEN eerst */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ ...S.h3, marginBottom: 0 }}>👥 Gasten</h3>
              <button style={{ ...S.btn, ...S.btnPrimary, padding: "7px 14px", fontWeight: 800, fontSize: 13 }} onClick={() => setShowAddGuest((v) => !v)}>{showAddGuest ? "✕ Sluiten" : "+ Gast vooraf toevoegen"}</button>
            </div>
            {showAddGuest && (
              <div style={{ marginTop: 10, marginBottom: 6, background: "rgba(90,108,166,0.06)", borderRadius: 12, padding: 12 }}>
                <p style={{ fontSize: 12, color: "#5a6680", marginTop: 0, marginBottom: 10 }}>Voor wie geen gsm heeft — jij tikt voor hen aan.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newGuest} onChange={(e) => setNewGuest(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addGuest() }} placeholder="Naam" style={{ ...S.input, flex: 1, minWidth: 0 }} autoFocus />
                  <button style={{ ...S.btn, ...S.btnPrimary, padding: "0 18px", fontWeight: 800 }} onClick={() => addGuest()}>+ Toevoegen</button>
                </div>
              </div>
            )}

            {(() => {
              const twoCol = participants.length > 5
              const Row = (p: Participant) => {
                const st = guestStatus(p.id)
                const origin = p.self_joined
                  ? { label: "zelf aangemeld", color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
                  : { label: "door admin", color: "#5a6ca6", bg: "rgba(90,108,166,0.12)" }
                if (twoCol) {
                  return (
                    <div key={p.id} onClick={() => { setClaimMode("person"); setClaimPid(p.id); setAdminTab("overview") }}
                      style={{ border: "1px solid rgba(16,24,40,0.08)", borderRadius: 12, padding: "8px 10px", cursor: "pointer", background: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                        <button style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 13 }} onClick={(e) => { e.stopPropagation(); removeGuest(p.id) }}>🗑️</button>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5, alignItems: "center" }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: origin.color, background: origin.bg, borderRadius: 7, padding: "1px 6px" }}>{origin.label}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 7, padding: "1px 6px" }}>{st.label}</span>
                        <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto", fontWeight: 700 }}>€{personTotal(p.id).settled.toFixed(2)}</span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={p.id} onClick={() => { setClaimMode("person"); setClaimPid(p.id); setAdminTab("overview") }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)", cursor: "pointer" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: origin.color, background: origin.bg, borderRadius: 8, padding: "1px 7px", marginLeft: 7, whiteSpace: "nowrap" }}>{origin.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 10, padding: "2px 9px" }}>{st.label}</span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>€{personTotal(p.id).settled.toFixed(2)}</span>
                    <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); removeGuest(p.id) }}>🗑️</button>
                  </div>
                )
              }
              return (
                <div style={{ marginTop: showAddGuest ? 6 : 12 }}>
                  {participants.length === 0
                    ? <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Nog geen gasten — voeg er toe of deel de link.</div>
                    : twoCol
                    ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{participants.map(Row)}</div>
                    : participants.map(Row)}
                </div>
              )
            })()}
            <p style={{ fontSize: 11.5, color: "#9aa0ab", marginTop: 12, marginBottom: 0 }}>Tip: tik op een gast om meteen voor die persoon aan te tikken.</p>
          </div>

          {/* DELEN daaronder */}
          <div style={S.card}>
            <h3 style={S.h3}>🔗 Deel deze groep</h3>
            <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 12 }}>Gasten doen mee via de QR-code of de deelbare link.</p>
            {(() => {
              const link = typeof window !== "undefined" ? `${window.location.origin}/table?code=${group.invite_code}` : ""
              return (
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
                    <QRCodeSVG value={link} size={120} bgColor="#ffffff" fgColor="#1b2a4a" />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 6 }}>Deelbare link</div>
                    <div style={{ fontSize: 12, color: "#5a6680", wordBreak: "break-all", background: "rgba(20,33,58,0.04)", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>{link}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btn, flex: 1, fontWeight: 700 }} onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(link); setToast("Link gekopieerd") } }}>📋 Link kopiëren</button>
                      {typeof navigator !== "undefined" && "share" in navigator && (
                        <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={() => navigator.share({ title: "Rundo Table", text: "Doe mee met de rekening", url: link }).catch(() => {})}>📤 Delen</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ─── ADMIN: Stand van zaken (bovenaan overzicht-tab) ─── */}
      {isAdmin && adminTab === "overview" && (
        <div style={S.card}>
          <h3 style={S.h3}>📊 Stand van zaken</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <Stat label="rekening" value={`€${billTotal.toFixed(2)}`} tone="navy" />
            <div onClick={() => setShowTodo((v) => !v)} style={{ flex: 1, cursor: "pointer" }}>
              <Stat label="nog niet geclaimd" value={`${openUnits}`} tone={openUnits > 0 ? "red" : "green"} />
            </div>
            <div onClick={() => setShowTodo((v) => !v)} style={{ flex: 1, cursor: "pointer" }}>
              <Stat label="gedeeld onbeslist" value={`${undecidedShared.length}`} tone={undecidedShared.length > 0 ? "gold" : "green"} />
            </div>
          </div>
          {(openUnits > 0 || undecidedShared.length > 0) && (
            <div style={{ fontSize: 11, color: "#9aa0ab", textAlign: "center", marginTop: 6 }}>{showTodo ? "▲ verberg wat nog te regelen valt" : "▼ tik op een rood vakje om te zien wat nog te regelen valt"}</div>
          )}
          {showTodo && (openUnits > 0 || undecidedShared.length > 0) && (
            <div style={{ marginTop: 10, border: "1px solid rgba(224,107,94,0.35)", background: "rgba(224,107,94,0.05)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#c0392b", marginBottom: 6 }}>⚠️ Nog te regelen</div>
              {items.filter((it) => !it.is_shared && it.quantity - claimedQty(it.id) > 0).map((it) => (
                <div key={it.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <b>{it.quantity - claimedQty(it.id)}× {it.name}</b> niet geclaimd
                </div>
              ))}
              {undecidedShared.map((it) => (
                <div key={it.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "#a06b00" }}>
                  🍷 <b>{it.name}</b> — gedeeld, nog niemand neemt deel
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
            setClaim={setClaim} toggleShareClaim={toggleShareClaim}
            itemTotal={itemTotal} personTotal={personTotal} personItems={personItems}
            sharedRevealed={sharedRevealed} allConfirmed={allConfirmed} isConfirmed={isConfirmed} explicitConfirmed={explicitConfirmed}
            claimMode={claimMode} setClaimMode={setClaimMode} claimPid={claimPid} setClaimPid={setClaimPid}
            iConfirmed={iConfirmed} confirmMe={confirmMe}
            onPickMe={pickMe}
          />
        </>
      )}

      {/* ─── ADMIN: Per persoon (overzicht-tab) ─── */}
      {isAdmin && adminTab === "overview" && (
        <div>
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
                    <span style={{ fontWeight: 800, fontSize: 16, color: "#14213a", flexShrink: 0, marginLeft: 8 }}>€{t.settled.toFixed(2)}{t.pendingShared ? "+" : ""}</span>
                  </div>
                  {open && (
                    <div style={{ padding: "2px 4px 12px 23px" }}>
                      {detail.length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>Nog niets aangetikt.</div>}
                      {detail.map((d, k) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#5a6680", padding: "2px 0" }}>
                          <span>{d.shared ? "🍷 " : ""}{d.qty > 1 ? `${d.qty}× ` : ""}{d.name}{d.shared ? (d.revealed ? " (gedeeld deel)" : ` (gedeeld door ${d.sharers})`) : ""}</span>
                          <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>
                            {d.shared && !d.revealed ? "nog te verdelen" : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2)}`}
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
        </div>
      )}

      {/* ─── Modal: bon scannen ─── */}
      {showScan && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 460, maxHeight: "88vh" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>🧾 Kassabon scannen</h3>
            <p style={{ fontSize: 12.5, color: "#999", marginBottom: 14 }}>Maak of kies een foto van de rekening. Daarna kan je de herkende items nog nakijken en bijsturen.</p>

            <label style={{ ...S.btn, ...S.btnPrimary, display: "block", textAlign: "center", marginBottom: 14, cursor: scanning ? "default" : "pointer", fontWeight: 800, padding: "14px 0", opacity: scanning ? 0.6 : 1 }}>
              {scanning ? "⏳ Bezig met scannen..." : scanPreview.length > 0 ? "📷 Andere foto kiezen" : "📷 Foto maken / kiezen"}
              <input type="file" accept="image/*" disabled={scanning} style={{ display: "none" }} onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
            </label>

            {scanning && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 8, background: "rgba(20,33,58,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(scanProgress * 100)}%`, height: "100%", background: "linear-gradient(90deg,#5a6ca6,#7283b6)", borderRadius: 4, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: 11, color: "#8a93a3", textAlign: "center", marginTop: 6 }}>De tekst van je bon wordt herkend — even geduld.</div>
              </div>
            )}

            {scanError && !scanning && (
              <div style={{ fontSize: 12.5, color: "#c0392b", background: "#fff0f0", border: "1px solid rgba(192,57,43,0.25)", borderRadius: 10, padding: "9px 11px", marginBottom: 14, lineHeight: 1.45 }}>⚠️ {scanError}</div>
            )}

            {scanPhotoUrl && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 6 }}>Jouw foto — vergelijk met de lijst</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scanPhotoUrl} alt="gescande bon" onClick={() => setViewReceipt(scanPhotoUrl)} style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", background: "#faf9f5", cursor: "zoom-in" }} />
              </div>
            )}

            {scanPreview.length > 0 && (
              <div style={{ marginBottom: 12, maxHeight: 320, overflowY: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#c98a00", textTransform: "uppercase", marginBottom: 8 }}>{scanPreview.filter((x) => !x.distribute).length} herkend — controleer en stuur bij</div>
                {scanPreview.map((it, i) => ({ it, i })).sort((a, b) => (a.it.distribute ? 1 : 0) - (b.it.distribute ? 1 : 0)).map(({ it, i }) => {
                  const lineTotal = (it.unit_price || 0) * (it.quantity || 0)
                  // BTW/kost-regel: eenvoudige weergave, geen aantal/gedeeld
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
                          <input type="number" step="0.01" value={it.unit_price} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, unit_price: parseFloat(e.target.value) || 0, quantity: 1 } : x))} style={{ ...S.input, width: 80, textAlign: "right", padding: "8px 8px" }} />
                          <button onClick={() => setScanPreview((cur) => cur.filter((_, j) => j !== i))} style={{ ...S.iconBtn, flexShrink: 0 }}>✕</button>
                        </div>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 4 }}>Hoe verdelen?</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: !overAll ? 8 : 0 }}>
                          <button onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, distribute: "all" } : x))} style={{ flex: 1, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "8px 6px", cursor: "pointer", border: overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: overAll ? "linear-gradient(135deg,#5a6ca6,#7283b6)" : "#fff", color: overAll ? "#fff" : "#5a6680" }}>📊 Over de hele rekening</button>
                          <button onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, distribute: JSON.stringify({ idx: baseRows.map((o) => o.j) }) } : x))} style={{ flex: 1, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "8px 6px", cursor: "pointer", border: !overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: !overAll ? "linear-gradient(135deg,#5a6ca6,#7283b6)" : "#fff", color: !overAll ? "#fff" : "#5a6680" }}>🎯 Over bepaalde items{!overAll ? ` (${selIdx.length})` : ""}</button>
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
                        <div style={{ fontSize: 10.5, color: "#5a6ca6", fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>⬇️ Klik daarna onderaan op <b>“Bevestigen &amp; toevoegen”</b> om het op te slaan.</div>
                      </div>
                    )
                  }
                  return (
                    <div key={i} style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: 9, marginBottom: 8 }}>
                      {/* Naam over de volle breedte */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <input value={it.name} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...S.input, flex: 1, minWidth: 0 }} />
                        <button title="gedeeld (wijn/water)" onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, is_shared: !x.is_shared } : x))} style={{ ...S.iconBtn, flexShrink: 0, background: it.is_shared ? "rgba(233,196,95,0.3)" : "rgba(16,24,40,0.05)" }}>{it.is_shared ? "🍷" : "👤"}</button>
                        <button onClick={() => setScanPreview((cur) => cur.filter((_, j) => j !== i))} style={{ ...S.iconBtn, flexShrink: 0 }}>✕</button>
                      </div>
                      {/* Aantal-stepper (houdt regeltotaal vast) + prijs/stuk + regeltotaal */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 16 }} onClick={() => setScanPreview((cur) => cur.map((x, j) => {
                            if (j !== i) return x
                            const total = +((x.unit_price || 0) * (x.quantity || 0)).toFixed(2)
                            const q = Math.max(1, x.quantity - 1)
                            return { ...x, quantity: q, unit_price: +(total / q).toFixed(2) }
                          }))}>−</button>
                          <input type="number" value={it.quantity} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => {
                            if (j !== i) return x
                            const total = +((x.unit_price || 0) * (x.quantity || 0)).toFixed(2)
                            const q = Math.max(1, parseInt(e.target.value) || 1)
                            return { ...x, quantity: q, unit_price: +(total / q).toFixed(2) }
                          }))} style={{ ...S.input, width: 46, textAlign: "center", padding: "8px 4px" }} />
                          <button style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setScanPreview((cur) => cur.map((x, j) => {
                            if (j !== i) return x
                            const total = +((x.unit_price || 0) * (x.quantity || 0)).toFixed(2)
                            const q = x.quantity + 1
                            return { ...x, quantity: q, unit_price: +(total / q).toFixed(2) }
                          }))}>+</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "#888" }}>€/stuk</span>
                          <input type="number" step="0.01" value={it.unit_price} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))} style={{ ...S.input, width: 84, padding: "8px 8px" }} />
                        </div>
                        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: "#14213a", whiteSpace: "nowrap" }}>= €{lineTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })}
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <button onClick={() => setScanPreview((cur) => [...cur, { name: "Nieuw item", unit_price: 0, quantity: 1, is_shared: false }])} style={{ ...S.btn, flex: 1, fontSize: 12.5, fontWeight: 700 }}>+ Item toevoegen</button>
                  <button onClick={() => setScanPreview((cur) => [...cur, { name: "BTW / tax", unit_price: 0, quantity: 1, is_shared: false, distribute: "all" }])} style={{ ...S.btn, flex: 1, fontSize: 12.5, fontWeight: 700 }}>🧮 BTW / tax</button>
                </div>
                <button onClick={() => setShowTaxInfo(true)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#5a6ca6", marginTop: 6, padding: 0 }}>ℹ️ Wanneer BTW apart toevoegen?</button>
              </div>
            )}

            {/* Totaalcontrole: berekend (items + BTW) vs bon-totaal — beweegt live mee */}
            {scanPreview.length > 0 && (() => {
              const itemsSum = scanPreview.filter((x) => !x.distribute).reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 0), 0)
              const taxSum = scanPreview.filter((x) => x.distribute).reduce((s, it) => s + (it.unit_price || 0), 0)
              const computed = itemsSum + taxSum
              const billTotal = parseFloat((scanTotal || "").replace(",", "."))
              const hasBill = !isNaN(billTotal) && billTotal > 0
              const diff = hasBill ? +(computed - billTotal).toFixed(2) : 0
              const ok = hasBill && Math.abs(diff) < 0.01
              return (
                <div style={{ marginBottom: 14, border: `1.5px solid ${ok ? "rgba(39,174,96,0.4)" : hasBill ? "rgba(224,107,94,0.4)" : "rgba(16,24,40,0.1)"}`, borderRadius: 12, padding: "11px 13px", background: ok ? "rgba(39,174,96,0.06)" : hasBill ? "rgba(224,107,94,0.05)" : "#fafbff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8a93a3" }}>Items</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>€{itemsSum.toFixed(2)}</span>
                  </div>
                  {taxSum > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8a93a3" }}>🧮 BTW / kosten</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>€{taxSum.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(16,24,40,0.08)" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#14213a" }}>Berekend totaal</span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "#14213a" }}>€{computed.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>Totaal op de bon</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#999" }}>€</span>
                      <input type="number" step="0.01" placeholder="0.00" value={scanTotal} onChange={(e) => setScanTotal(e.target.value)} style={{ ...S.input, width: 90, textAlign: "right", padding: "8px 8px" }} />
                    </div>
                  </div>
                  {hasBill && (
                    <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 700, lineHeight: 1.4, color: ok ? "#1f8a4c" : "#c0392b" }}>
                      {ok
                        ? "✅ Klopt met het bon-totaal"
                        : `⚠️ Verschil van €${Math.abs(diff).toFixed(2)} (${diff > 0 ? "berekend is hoger" : "berekend is lager"}). Controleer aantallen, prijzen en BTW.`}
                    </div>
                  )}
                  {!hasBill && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "#9aa0ab" }}>Vul het totaal van de bon in om live te zien of alles (incl. BTW) klopt.</div>
                  )}
                </div>
              )
            })()}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} disabled={scanning} onClick={() => { setShowScan(false); setScanPreview([]); setScanTotal(""); setScanError(null); setScanFile(null); if (scanPhotoUrl) { URL.revokeObjectURL(scanPhotoUrl); setScanPhotoUrl(null) } }}>{scanPreview.length > 0 ? "Annuleren" : "Sluiten"}</button>
              {scanPreview.length > 0 && (
                <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 800 }} onClick={confirmScan} disabled={scanning}>✅ Bevestigen & toevoegen</button>
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
                    const total = +((cur.unit_price || 0) * (cur.quantity || 0)).toFixed(2)
                    const q = Math.max(1, cur.quantity - 1)
                    return { ...cur, quantity: q, unit_price: +(total / q).toFixed(2) }
                  })}>−</button>
                  <input type="number" value={editItem.quantity} onChange={(e) => setEditItem((cur) => {
                    if (!cur) return cur
                    const total = +((cur.unit_price || 0) * (cur.quantity || 0)).toFixed(2)
                    const q = Math.max(1, parseInt(e.target.value) || 1)
                    return { ...cur, quantity: q, unit_price: +(total / q).toFixed(2) }
                  })} style={{ ...S.input, width: 48, textAlign: "center", padding: "9px 4px" }} />
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setEditItem((cur) => {
                    if (!cur) return cur
                    const total = +((cur.unit_price || 0) * (cur.quantity || 0)).toFixed(2)
                    const q = cur.quantity + 1
                    return { ...cur, quantity: q, unit_price: +(total / q).toFixed(2) }
                  })}>+</button>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={S.lbl}>Prijs/stuk (€)</label>
                <input type="number" step="0.01" value={editItem.unit_price} onChange={(e) => setEditItem({ ...editItem, unit_price: parseFloat(e.target.value) || 0 })} style={{ ...S.input, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ paddingBottom: 9 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>Regeltotaal</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#14213a", whiteSpace: "nowrap" }}>€{((editItem.unit_price || 0) * (editItem.quantity || 0)).toFixed(2)}</div>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={editItem.is_shared} onChange={(e) => setEditItem({ ...editItem, is_shared: e.target.checked })} />
              🍷 Gedeeld item (wijn, water...) — splitsen over wie meedeelt
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setEditItem(null)}>Annuleren</button>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 800 }} onClick={saveItem}>💾 Opslaan</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: uitleg BTW / kosten ─── */}
      {showTaxInfo && (
        <div style={S.overlay} onClick={() => setShowTaxInfo(false)}>
          <div style={{ ...S.modal, width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 800 }}>🧮 BTW / kosten verdelen</h3>
            <div style={{ fontSize: 13.5, color: "#3b486a", lineHeight: 1.6 }}>
              <p style={{ marginTop: 0 }}>Gebruik dit <b>enkel</b> als de BTW (of een dienstkost/couvert) <b>apart als totaal onderaan de bon</b> staat — en dus <b>niet</b> al in de prijs van elk gerecht zit.</p>
              <p>Zit de BTW al in elke gerechtprijs verrekend (zoals meestal in België op restaurant), dan hoef je hier niets te doen.</p>
              <p style={{ marginBottom: 0 }}>Het bedrag wordt <b>proportioneel</b> verdeeld: naar verhouding van wat elk item kostte. Wie meer bestelde, draagt automatisch meer BTW — eerlijker dan gelijk per persoon. Je kan kiezen of het over de hele rekening gaat of enkel over bepaalde items.</p>
            </div>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 16, fontWeight: 800 }} onClick={() => setShowTaxInfo(false)}>Begrepen</button>
          </div>
        </div>
      )}

      {/* ─── Modal: bon groot bekijken ─── */}
      {viewReceipt && (
        <div style={S.overlay} onClick={() => setViewReceipt(null)}>
          <div style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewReceipt} alt="gescande bon" style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 14, background: "#fff", boxShadow: "0 24px 70px -12px rgba(16,24,40,0.5)" }} />
            <button onClick={() => setViewReceipt(null)} style={{ ...S.btn, position: "absolute", top: -14, right: -14, width: 40, height: 40, borderRadius: "50%", fontWeight: 800, fontSize: 16, padding: 0 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
function TopBar({ group, isAdmin, onHome, me, signedUp }: { group: Group; isAdmin: boolean; onHome: () => void; me?: string; signedUp?: number }) {
  return (
    <div style={S.topBar}>
      <div onClick={onHome} title="Naar startscherm" style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <RundoLogo size={30} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1b2a4a", lineHeight: 1.1, display: "flex", alignItems: "center", gap: 6 }}>
            Rundo <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#5a6ca6,#7283b6)", borderRadius: 6, padding: "1px 6px" }}>TABLE</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f0a500" }}>{isAdmin ? "beheerder" : me ? `jij: ${me}` : "gast"}</div>
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1b2a4a", overflowWrap: "anywhere", lineHeight: 1.15 }}>{group.name}</div>
        <div style={{ fontSize: 11.5, color: "#8a93a3", fontWeight: 700 }}>
          {fmtDate(group.created_at) && <span>{fmtDate(group.created_at)}</span>}
          {!isAdmin && signedUp != null && <span style={{ marginLeft: fmtDate(group.created_at) ? 6 : 0, color: (group.party_size && signedUp < group.party_size) ? "#c0392b" : "#1f8a4c" }}>{fmtDate(group.created_at) ? "· " : ""}👤 {signedUp}{group.party_size ? `/${group.party_size}` : ""}</span>}
        </div>
      </div>
    </div>
  )
}

function ItemList({ items, claimedQty, participants, claimsForItem, sharerIds, toggleShareClaim, setShareFixed, onEdit, onToggleShared, onDelete, onAddManual, bareBill, taxLines, taxNode }: {
  items: BillItem[]; claimedQty: (id: string) => number
  participants: Participant[]; claimsForItem: (id: string) => { name: string; qty: number }[]
  sharerIds: (id: string) => string[]; toggleShareClaim: (itemId: string, pid: string) => void
  setShareFixed: (it: BillItem, val: boolean) => void
  onEdit: (it: BillItem) => void; onToggleShared: (it: BillItem) => void; onDelete: (id: string) => void; onAddManual: () => void
  bareBill?: boolean
  taxLines?: { name: string; amount: number }[]
  taxNode?: React.ReactNode
}) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ ...S.h3, marginBottom: 0 }}>🍽️ Items op de bon</h3>
      </div>
      {items.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20, fontSize: 13 }}>Nog geen items — scan de bon</div>}
      {items.map((it) => {
        const open = it.quantity - claimedQty(it.id)
        const who = claimsForItem(it.id)
        return (
          <div key={it.id} style={{ padding: "9px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{it.is_shared ? "🍷" : "🍽️"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{it.quantity}× {it.name}</div>
                {/* Gedeeld: enkel totaalprijs · Niet-gedeeld: prijs per stuk + totaal */}
                <div style={{ fontSize: 11, color: "#999" }}>
                  {it.is_shared
                    ? `€${(it.unit_price * it.quantity).toFixed(2)} totaal · gedeeld`
                    : `€${it.unit_price.toFixed(2)}/stuk · €${(it.unit_price * it.quantity).toFixed(2)}${open > 0 ? ` · ${open} open` : ""}`}
                </div>
              </div>
              <button title="gedeeld aan/uit" style={{ ...S.iconBtn, background: it.is_shared ? "rgba(233,196,95,0.3)" : "rgba(16,24,40,0.05)" }} onClick={() => onToggleShared(it)}>{it.is_shared ? "🍷" : "👤"}</button>
              <button style={S.iconBtn} onClick={() => onEdit(it)}>✏️</button>
              <button style={S.iconBtn} onClick={() => onDelete(it.id)}>🗑️</button>
            </div>
            {/* Niet-gedeeld: wie heeft welk stuk genomen (alleen tonen) */}
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
            {/* Gedeeld: admin tikt aan wie meedronk + kan de verdeling vastzetten */}
            {!bareBill && it.is_shared && (() => {
              const sh = sharerIds(it.id)
              const perHead = sh.length > 0 ? (it.unit_price * it.quantity) / sh.length : 0
              const fixed = !!it.share_fixed
              return (
                <div style={{ marginTop: 7, marginLeft: 26 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: "#a06b00" }}>
                      🍷 Wie dronk hiervan mee? {sh.length > 0 ? `${sh.length} ${sh.length === 1 ? "persoon" : "personen"} · €${perHead.toFixed(2)} p.p.` : "tik de namen aan"}
                    </span>
                    {sh.length > 0 && (
                      <button onClick={() => setShareFixed(it, !fixed)} style={{
                        fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "3px 9px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                        border: fixed ? "none" : "1px solid rgba(16,24,40,0.12)",
                        background: fixed ? "linear-gradient(135deg,#5a6ca6,#7283b6)" : "#fff",
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
      {taxNode}
      {items.length > 0 && (() => {
        const units = items.reduce((s, it) => s + it.quantity, 0)
        const sum = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
        const tax = (taxLines || []).reduce((s, t) => s + t.amount, 0)
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(16,24,40,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>Bestelde items: {units}{tax > 0 ? ` · €${sum.toFixed(2)} + BTW €${tax.toFixed(2)}` : ""}</span>
              {tax === 0 && <span style={{ fontSize: 15, fontWeight: 700, color: "#5a6680" }}>€{sum.toFixed(2)}</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 7, paddingTop: 7, borderTop: tax > 0 ? "1px solid rgba(16,24,40,0.06)" : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>Totaal</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#14213a" }}>€{(sum + tax).toFixed(2)}</span>
            </div>
          </div>
        )
      })()}
      <button onClick={onAddManual} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 14, padding: "13px 0", fontSize: 15, fontWeight: 800 }}>➕ Item toevoegen</button>
    </div>
  )
}

// Kleine kiezer om een open item aan iemand toe te wijzen. Toont eerst wie het item
// (waarschijnlijk) nam; via "andere persoon" kan je iemand kiezen die al bevestigde —
// dan geeft onAssign het tweede argument 'warn'=true zodat de admin een waarschuwing krijgt.
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
  setClaim: (itemId: string, pid: string, qty: number) => void; toggleShareClaim: (itemId: string, pid: string) => void
  itemTotal: (it: BillItem) => number; personTotal: (pid: string) => { settled: number; pendingShared: boolean }
  personItems: (pid: string) => { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number }[]
  sharedRevealed: (it: BillItem) => boolean; allConfirmed: boolean; isConfirmed: (pid: string) => boolean; explicitConfirmed: (pid: string) => boolean
  claimMode: "item" | "person"; setClaimMode: (m: "item" | "person") => void
  claimPid: string | null; setClaimPid: (id: string | null) => void
  iConfirmed: boolean; confirmMe: () => void; onPickMe: (id: string) => void
}) {
  const { items, meId, me, isAdmin, participants, claimedQty, myQty, sharerIds, setClaim, toggleShareClaim, itemTotal, personTotal, personItems, sharedRevealed, allConfirmed, isConfirmed, explicitConfirmed, iConfirmed, confirmMe, onPickMe } = props
  const adminPid = props.claimPid, setAdminPid = props.setClaimPid  // bovenaan geselecteerde (gele) persoon
  const [assignItem, setAssignItem] = useState<string | null>(null) // welk open item we nu toewijzen

  // ── ADMIN-BEHEERWEERGAVE: per item wie claimde + zelf bijsturen, groen/rood status ──
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
          <h3 style={{ ...S.h3, marginBottom: 10 }}>✅ Checken en toewijzen</h3>
          {items.length === 0
            ? <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>Nog geen items — scan eerst de bon.</div>
            : participants.length === 0
            ? <div style={{ fontSize: 12.5, color: "#aaa", padding: 10 }}>Voeg eerst gasten toe in de tab &ldquo;Gasten &amp; delen&rdquo;.</div>
            : (
              <>
                {/* Persoonsknoppen — alle personen. Aanklikken = geel bekijken. Bij >6: horizontaal scrollen. */}
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
                              border: on ? "1px solid #ecc564" : "1px solid rgba(16,24,40,0.12)",
                              background: on ? "linear-gradient(135deg,#f6dd95,#eecb6e)" : "#fff",
                              color: on ? "#5a4a1a" : "#5a6680",
                            }}>{conf ? "✓ " : ""}{p.name} <span style={{ fontWeight: 600, opacity: 0.85 }}>€{pt.settled.toFixed(2)}{pt.pendingShared ? "+" : ""}</span></button>
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

                {/* Itemlijst: gele persoon licht op; open items zijn aanklikbaar om toe te wijzen */}
                {items.map((it) => {
                  const claimed = claimedQty(it.id)
                  const open = it.quantity - claimed
                  if (it.is_shared) {
                    const sh = sharerIds(it.id)
                    const ok = sh.length > 0
                    const perHead = ok ? itemTotal(it) / sh.length : 0
                    const mine = adminPid ? sh.includes(adminPid) : false
                    return (
                      <div key={it.id} style={{ padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: mine ? "rgba(233,196,95,0.16)" : "transparent", borderRadius: mine ? 10 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 17 }}>🍷</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{it.name} <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.2)", borderRadius: 8, padding: "1px 6px" }}>gedeeld</span></div>
                            <div style={{ fontSize: 11, color: "#999" }}>€{itemTotal(it).toFixed(2)} totaal{ok ? ` · €${perHead.toFixed(2)} p.p.` : ""}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 9px", color: ok ? "#1f8a4c" : "#c0392b", background: ok ? "rgba(39,174,96,0.12)" : "rgba(224,107,94,0.12)" }}>{ok ? `${sh.length} ${sh.length === 1 ? "deelt" : "delen"}` : "nog niemand"}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 25 }}>
                          {sh.length === 0
                            ? <button onClick={() => setAssignItem(assignItem === it.id ? null : it.id)} style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "3px 10px", cursor: "pointer", border: "none", color: "#c0392b", background: "rgba(224,107,94,0.14)" }}>nog niemand deelt mee — wijs toe ▾</button>
                            : participants.filter((p) => sh.includes(p.id)).map((p) => (
                              <span key={p.id} style={{ fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 9px", color: p.id === adminPid ? "#5a4a1a" : "#5a6680", background: p.id === adminPid ? "rgba(233,196,95,0.5)" : "rgba(90,108,166,0.1)" }}>{p.name}</span>
                            ))}
                        </div>
                        {assignItem === it.id && (
                          <AssignPicker participants={participants} itemId={it.id} isShared confirmedFn={explicitConfirmed}
                            onAssign={(pid, warn) => { if (warn && !confirm(`${participants.find((x) => x.id === pid)?.name} had dit zelf niet aangeduid. Toch toevoegen?`)) return; toggleShareClaim(it.id, pid); setAssignItem(null) }}
                            onClose={() => setAssignItem(null)} />
                        )}
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
                        <span style={{ fontSize: 17 }}>🍽️</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{it.quantity}× {it.name}</div>
                          <div style={{ fontSize: 11, color: "#999" }}>€{it.unit_price.toFixed(2)}/stuk</div>
                        </div>
                        {open > 0
                          ? <button onClick={() => setAssignItem(assignItem === it.id ? null : it.id)} style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "3px 10px", cursor: "pointer", border: "none", color: "#c0392b", background: "rgba(224,107,94,0.14)" }}>{open} open — wijs toe ▾</button>
                          : <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 9px", color: "#1f8a4c", background: "rgba(39,174,96,0.12)" }}>volledig</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 25, alignItems: "center" }}>
                        {who.map(({ p, q: pq }) => (
                          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 4px 2px 9px", color: p.id === adminPid ? "#5a4a1a" : "#5a6680", background: p.id === adminPid ? "rgba(233,196,95,0.5)" : "rgba(90,108,166,0.1)" }}>
                            {p.name} ×{pq}
                            <button onClick={() => setClaim(it.id, p.id, Math.max(0, pq - 1))} title="−1" style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: 18, height: 18, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>−</button>
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
                <span>€{billSum.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Admin kan zonder eigen identiteit afrekenen, maar om aan te tikken moet hij "ik ben" kiezen
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
      <div style={S.card}>
        <h3 style={S.h3}>✅ Tik aan wat {me ? me.name : "jij"} had</h3>
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
            const perHead = sh.length > 0 ? itemTotal(it) / sh.length : itemTotal(it)
            return (
              <div key={it.id} style={{ padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🍷</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{it.name} <span style={{ fontSize: 11, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.2)", borderRadius: 8, padding: "1px 7px" }}>gedeeld</span></div>
                    <div style={{ fontSize: 11, color: "#999" }}>€{itemTotal(it).toFixed(2)} totaal · wordt gedeeld door wie meedrinkt</div>
                  </div>
                  <button onClick={() => toggleShareClaim(it.id, meId)} style={{ ...S.btn, fontWeight: 800, ...(iShare ? { background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a", border: "none" } : {}) }}>{iShare ? "✓ ik deel mee" : "+ meedelen"}</button>
                </div>
                {iShare && (
                  revealed ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.45 }}>
                      {fixed
                        ? <>🍷 Jouw deel: €{perHead.toFixed(2)} (gedeeld door {sh.length} {sh.length === 1 ? "persoon" : "personen"}, vastgelegd door de beheerder).</>
                        : <>🍷 Jouw deel: €{perHead.toFixed(2)} (gedeeld door {sh.length} {sh.length === 1 ? "persoon" : "personen"}).</>}
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
              <span style={{ fontSize: 18 }}>🍽️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{it.name}</div>
                <div style={{ fontSize: 11, color: open > 0 ? "#e0685c" : "#1f8a4c", fontWeight: 600 }}>€{it.unit_price.toFixed(2)} · {total}× besteld · {open > 0 ? `${open} nog vrij` : "alles geclaimd"}</div>
              </div>
              <button style={{ ...S.iconBtn, width: 32, height: 32, fontSize: 16 }} onClick={() => setClaim(it.id, meId, Math.max(0, mine - 1))} disabled={mine <= 0}>−</button>
              <span style={{ fontSize: 16, fontWeight: 800, minWidth: 22, textAlign: "center" }}>{mine}</span>
              <button style={{ ...S.iconBtn, width: 32, height: 32, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setClaim(it.id, meId, mine + 1)} disabled={open <= 0}>+</button>
            </div>
          )
        })}
      </div>

      {/* Eigen totaal + overzicht + bevestigen */}
      <div style={{ ...S.card, background: "linear-gradient(135deg,#fbfaff,#f1f2fb)", border: "1.5px solid rgba(90,108,166,0.25)" }}>
        {(() => {
          const mine = personItems(meId)
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 8 }}>Dit ga je bevestigen</div>
              {mine.length === 0 && <div style={{ fontSize: 13, color: "#aaa" }}>Je hebt nog niets aangetikt.</div>}
              {mine.map((d, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: "#3b486a" }}>
                  <span>{d.shared ? "🍷 " : ""}{d.qty > 1 ? `${d.qty}× ` : ""}{d.name}{d.shared ? (d.revealed ? " (gedeeld deel)" : ` (gedeeld door ${d.sharers})`) : ""}</span>
                  <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>
                    {d.shared && !d.revealed ? "nog te verdelen" : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          )
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(90,108,166,0.18)", paddingTop: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#5a6680" }}>Jouw totaal</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#14213a" }}>€{t.settled.toFixed(2)}{t.pendingShared ? "+" : ""}</span>
        </div>
        {t.pendingShared && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.4 }}>
            ℹ️ Je deelt mee in gedeelde items (wijn/water). Het exacte deel kan nog wijzigen tot iedereen heeft aangetikt en bevestigd.
          </div>
        )}
        <button onClick={confirmMe} style={{ ...S.btn, width: "100%", marginTop: 12, padding: "14px 0", fontSize: 15, fontWeight: 800, border: "none", ...(iConfirmed ? { background: "rgba(39,174,96,0.12)", color: "#1f8a4c" } : { background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a" }) }}>
          {iConfirmed ? "✓ Bevestigd — tik om te wijzigen" : "✅ Bevestig mijn bestelling"}
        </button>
      </div>
    </div>
  )
}

function IdentityAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("")
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onAdd(name.trim()); setName("") } }} placeholder="Jouw naam" style={{ ...S.input, flex: 1, minWidth: 0 }} />
      <button style={{ ...S.btn, ...S.btnPrimary, padding: "0 18px", fontWeight: 800 }} onClick={() => { if (name.trim()) { onAdd(name.trim()); setName("") } }}>Dat ben ik →</button>
    </div>
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

// ═══════════════════════════════════════════════════════════════════════════
// STYLES (overgenomen uit party mode — zelfde look & feel)
// ═══════════════════════════════════════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  page: { padding: 18, fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", background: "linear-gradient(180deg,#fbfaff 0%,#f1f2fb 55%,#eef3f7 100%)", minHeight: "100vh", color: "#1d2433", maxWidth: 720, margin: "0 auto", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
  card: { background: "#ffffff", border: "1px solid rgba(16,24,40,0.04)", borderRadius: 22, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,0.03), 0 14px 30px -16px rgba(80,90,140,0.18)", marginBottom: 14 },
  btn: { border: "1px solid rgba(16,24,40,0.10)", background: "#ffffff", borderRadius: 12, padding: "9px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#1d2433", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" },
  btnPrimary: { background: "linear-gradient(135deg,#5a6ca6,#7283b6)", color: "white", border: "none", boxShadow: "0 6px 16px -6px rgba(90,108,166,0.55)" },
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
