"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { QRCodeSVG } from "qrcode.react"
import { useLang, LanguageToggle, getLang } from "@/lib/i18n"

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
  share_expected?: number | null
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
  members?: string | null
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

function fmtDate(iso: string | number | undefined, lang: "nl" | "fr" = "nl"): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString(lang === "fr" ? "fr-BE" : "nl-BE", { day: "numeric", month: "short", year: "numeric" })
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

// Verkleint een foto vóór verzending naar de AI. Een gsm-camerafoto is al snel 3-12 MB;
// als base64 wordt dat nog ~33% groter en weigert de server het verzoek (te grote body).
// Max ~1600px breed + JPEG-kwaliteit 0.82 brengt dat terug naar ~200-400 kB: ruim genoeg om te lezen.
async function fileToScaledBase64(file: File, maxW = 1600, quality = 0.82): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error("image decode failed"))
      im.src = URL.createObjectURL(file)
    })
    const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) { URL.revokeObjectURL(img.src); return fileToBase64(file) }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(img.src)
    const dataUrl = canvas.toDataURL("image/jpeg", quality)
    return dataUrl.split(",")[1]
  } catch {
    return fileToBase64(file)
  }
}

// Verkleinde JPEG-versie van de bon voor opslag (Supabase). Scheelt fors in opslagruimte:
// een gsm-foto van 3-12 MB wordt zo ~200-400 kB, nog steeds prima leesbaar bij het nakijken.
async function fileToScaledBlob(file: File, maxW = 1600, quality = 0.82): Promise<Blob> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error("image decode failed"))
      im.src = URL.createObjectURL(file)
    })
    const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) { URL.revokeObjectURL(img.src); return file }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(img.src)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = reader.result as string
      resolve(res.includes(",") ? res.split(",")[1] : res)
    }
    reader.onerror = () => reject(new Error(STRINGS[getLang()].errCantReadPhoto))
    reader.readAsDataURL(file)
  })
}

// Hoofd-scan: probeer eerst de AI-route (Gemini). Lukt dat niet (geen sleutel, fout, niets herkend),
// dan valt hij automatisch terug op de lokale Tesseract-scan.
async function scanReceipt(files: File | File[], onProgress?: (p: number) => void): Promise<{ items: ParsedItem[] | null; total: number | null; reason: "unavailable" | "empty" | null; status?: number; detail?: string }> {
  try {
    onProgress?.(0.15)
    // Meerdere foto's = stukken van dezelfde bon. Ze gaan samen in één AI-oproep,
    // zodat het model de overlap tussen de stukken zelf herkent en niets dubbel telt.
    const list = Array.isArray(files) ? files : [files]
    // Twee foto's samen zijn zwaar: kleiner en sterker gecomprimeerd, anders loopt de
    // AI-oproep over de tijdslimiet van de server (504). Eén foto blijft op volle kwaliteit.
    // Eén foto mag scherper: dan is er tijd genoeg en blijven kleine letters leesbaar
    // (belangrijk als iemand de hele bon in één beeld probeert te vatten).
    const maxW = list.length > 1 ? 1150 : 2000
    const quality = list.length > 1 ? 0.72 : 0.85
    const images = [] as { imageBase64: string; mimeType: string }[]
    for (const f of list) {
      images.push({ imageBase64: await fileToScaledBase64(f, maxW, quality), mimeType: "image/jpeg" })
    }
    onProgress?.(0.35)
    const resp = await fetch("/api/scan-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, imageBase64: images[0]?.imageBase64, mimeType: "image/jpeg" }),
    })
    onProgress?.(0.85)
    if (!resp.ok) {
      let detail = ""
      try { detail = (await resp.text()).slice(0, 200) } catch { /* negeer */ }
      console.warn("AI-scan mislukt — status " + resp.status + " " + detail)
      return { items: null, total: null, reason: "unavailable", status: resp.status, detail }
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
        return { items, total, reason: null }
      }
    }
    // AI antwoordde, maar niets bruikbaars herkend -> waarschijnlijk fotokwaliteit
    return { items: null, total: null, reason: "empty" }
  } catch (e) {
    console.warn("AI-scan mislukt:", e)
    return { items: null, total: null, reason: "unavailable" }
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
const STRINGS = {
  nl: {
    backToRundo: "← naar Rundo startscherm",
    tableTagline: "Scan de rekening en verdeel in groep",
    groupName: "Groepsnaam",
    loading: "Laden...",
    startGroup: "Groep starten",
    savedGroups: "Opgeslagen groepen",
    hide: "▲ verbergen",
    show: "▼ tonen",
    roleAdmin: "beheerder",
    roleGuest: "gast",
    deletePermanently: "definitief verwijderen",
    tabBon: "Bon",
    tabGuests: "Gasten & delen",
    tabAssign: "Toewijzen",
    errNameTaken: "Je hebt al een groep met die naam. Kies een andere naam.",
    errCreateFailed: "Groep aanmaken mislukt: ",
    errNotFound: "Groep niet gevonden. Controleer de code.",
    errGroupGone: "Deze groep bestaat niet meer.",
    errDeleteFailed: "Verwijderen mislukt: ",
    confirmDeleteGroup: "Deze groep definitief verwijderen? Alles (items, gasten en aanduidingen) wordt gewist en de groep is daarna niet meer terug te halen, ook niet via een code.",
    roleAdminBadge: "👑 Beheerder",
    roleGuestBadge: "👤 Gast",
    switchPerson: "ik ben iemand anders — wissel van persoon",
    toTableHome: "Naar het Table-startscherm",
    person: "persoon",
    persons: "personen",
    shareReady: "✅ Bon-totaal en items kloppen — je kan delen.",
    shareBlocked: "⚠️ Het bon-totaal klopt nog niet met de items. Zet dit eerst recht op de Bon-tab vóór je met je gasten deelt.",
    guestsTitle1: "🔗 Of laat je gasten zelf meedoen",
    guestsSub1: "Deel de QR of link. Iedereen kiest z'n naam en tikt z'n eigen bestelling aan.",
    inviteLine1: "Je gasten komen zo in je groepje ",
    inviteLine2: " om mee de rekening te verdelen.",
    copyInviteBtn: "🔗 Deel de link",
    copyInviteHelp: "Klaar om te plakken in WhatsApp, sms, Messenger enz.",
    inviteModalTitle: "Deel je uitnodiging",
    inviteModalMsg: "Plak deze uitnodiging in WhatsApp, Messenger, sms of een andere berichtenservice en stuur ze naar je groep.",
    inviteModalCopy: "📋 Kopieer opnieuw",
    inviteModalClose: "Sluiten",
    guestsSteps: ["Laat hen de QR-code scannen of deel de link", "Iedereen tikt z'n eigen bestelling aan", "Resultaat: een eerlijk verdeelde rekening"],
    shareLinkLabel: "of deel de link",
    toastInviteCopied: "Uitnodiging gekopieerd",
    inviteMessage: (name: string, link: string) => `Je bent uitgenodigd voor "${name}" — verdeel mee de rekening via Rundo Table 👉 ${link}`,
    guestsTitle2: "👥 Of zet zelf namen klaar",
    guestsSub2: "Ze kunnen daarna nog steeds zelf aantikken via de link, óf jij tikt voor hen aan bij 'Toewijzen'.",
    namePlaceholder: "Naam",
    addBtn: "+ Toevoegen",
    multipleHint: "Met meerdere (bv. koppel)? Zet het aantal personen met de knopjes.",
    guestCount: "Aantal gasten",
    guestCountHint: "Zet het aantal en pas de namen aan. Tik op het personen-knopje als iemand voor twee bestelt.",
    howManyTitle: "👥 Hoeveel zijn jullie?",
    howManySub: "Zet het aantal en pas de namen aan — of deel de groep en laat iedereen zichzelf invullen.",
    personsCount: (n: number) => `${n} ${n === 1 ? "persoon" : "personen"}`,
    howFillIn: "Hoe aanduiden wat iedereen at/dronk?",
    optShare: "📱 Laat hen meedoen",
    optShareSub: "stuur de link of toon de QR",
    optSelf: "✍️ Ik doe het voor hen",
    optSelfSub: "namen invullen & zelf aanduiden",
    sharePopupSub: "Ze kiezen zelf een vrije plaats, zetten hun naam erop en tikken aan wat ze aten.",
    howManyGroupTitle: "👥 Met hoeveel zijn jullie in de groep?",
    yourselfFirstTitle: "✍️ Voeg eerst jezelf (als admin) hier toe",
    adminBadge: "admin",
    nameRequired: "Vul eerst je eigen naam in — anders weet niemand wie de rekening deelde.",
    whoJoinedTitle: "👥 Wie doet al mee?",
    joinedOf: (a: number, b: number) => `${a} van ${b}`,
    stAssigned: (n: number) => `${n} items`,
    stJoinedNothing: "nog niets",
    stNobody: "niemand",
    stYouHandle: "jij regelt",
    stAssignNow: "aanduiden →",
    whoJoinedHint: "💡 Hier zie je wie de link opende. Aanduiden doe je bij Toewijzen.",
    whoAssignTitle: "📝 Wie duid jij aan?",
    youAlreadyIn: "Jij staat er al bij",
    whoAssignSub: "En eventueel anderen: geen smartphone, geen zin, of je regelt gewoon alles zelf.",
    whoAssignFoot: "💡 Straks tik je bij Toewijzen aan wat jij at — en wat zij aten.",
    shareLinkBtn: "🔗 Deel de link",
    shareLinkHint: "Kies daarna je berichtenapp — WhatsApp, Messenger, sms…",
    copyLinkPre: "Liever zelf plakken?",
    copyLinkAction: "Kopieer de link",
    copyLinkPost: "en stuur hem waar je wil.",
    billOkBadge: "✓ bon klopt — je kan delen",
    seatFreedUp: "Die plaats telt nu voor 2 — er is één vrije plaats minder.",
    howManyGroupSub: "Iedereen aan tafel — jezelf inbegrepen.",
    personsWord: "Aantal personen",
    shareStepTitle: "📱 Deel met je gasten",
    shareStepSub: "Zij kiezen een vrije plaats, zetten hun naam erop en tikken zelf aan wat ze aten.",
    sendViaApp: "💬 Versturen via WhatsApp, Messenger…",
    scanThis: "Laat hen dit scannen",
    yourselfTitle: "✍️ Vergeet jezelf niet",
    yourselfSub: "Zet je naam erop, dan weet iedereen wie wat had.",
    othersTitle: "📝 Iemand zonder smartphone?",
    othersSub: "Geen gsm of geen zin om zelf aan te tikken? Zet hun naam hieronder — jij duidt dan voor hen aan.",
    othersAdd: "+ Naam toevoegen die ik zelf regel",
    othersRest: "💡 De rest laat je gewoon vrij — zij claimen hun plaats zelf via de link.",
    personWord: "Persoon",
    onlyOneShares: "⚠️ Maar 1 persoon deelt mee",
    expectedSharers: "Met hoeveel gedeeld?",
    expectedHint: "Enkel invullen als je het zeker weet. De app waarschuwt dan als er te weinig personen toewijzen.",
    expectedShort: (n: number) => `verwacht: ${n}`,
    tooFewShared: (have: number, want: number) => `⚠️ Pas ${have} van de ${want} personen duidden dit aan.`,
    sharedOverviewTitle: "Gedeelde items — wie deelde mee?",
    sharedByLabel: "gedeeld door",
    nobodyShared: "⚠️ Niemand duidde dit gedeelde item aan",
    sharedProblemTitle: "Let op — gedeelde items kloppen mogelijk niet:",
    sharedProblemAsk: "Toch afsluiten?",
    totalsMatch: "✓ klopt met de bon",
    totalsDiff: (d: number) => `⚠️ €${d.toFixed(2).replace(".", ",")} verschil`,
    mixHint: "Gebruik gerust allebei — het één sluit het ander niet uit.",
    meLabel: "jij",
    ownNamePlaceholder: "Zet hier je eigen naam",
    freeSpot: "vrije plaats",
    pickFreeSpot: "Tik een vrije plaats aan en zet je naam erop.",
    freeSpotLabel: "👤 Vrije plaats",
    tapToPick: "tik om te kiezen →",
    takenLabel: "bezet",
    imThisOne: "dit ben ik →",
    addExtraSpot: "+ Extra plaats toevoegen",
    yourNameQ: "Hoe heet je?",
    yourNamesQ: "Hoe heten jullie?",
    thatsMe: "Dat ben ik →",
    thatsUs: "Dat zijn wij →",
    backToSpots: "← terug",
    howManyPersons: "Voor hoeveel personen tik je aan?",
    payTogetherShort: "Meer dan 1 persoon? Jullie betalen dan samen.",
    adminSpotLabel: "admin",
    onePerson: "👤 1 persoon",
    twoPersons: "👫 Met 2",
    threePlus: "👥 Met 3+",
    payTogetherHint: "Wie samen op één plaats staat, betaalt ook samen: alles wat je aantikt telt voor jullie samen.",
    firstName: "Eerste naam…",
    secondName: "Tweede naam…",
    extraName: (n: number) => `Naam ${n}…`,
    showsAsOne: "Verschijnt als één plaats:",
    whoOfYouShared: (names: string) => `🍴 Wie van jullie dronk/at hiervan mee?`,
    onlyFirst: (name: string) => `Alleen ${name}`,
    allOfUs: "Allebei",
    sharePaysOne: "Jullie betalen 1 aandeel in plaats van 2.",
    assignShareHint: "Was iets om te delen (fles wijn, water)? Tik ‘delen’ bij dat item.",
    unshareLink: "niet meer delen",
    confirmRemoveLast: (name: string, n: number) => `${name} heeft al ${n} ${n === 1 ? "item" : "items"} aangetikt. Die toewijzingen gaan verloren. Toch verwijderen?`,
    editNameHint: "· tik een naam om te wijzigen",
    manageDone: "✓ Klaar",
    manageDelete: "🗑️ Verwijderen",
    badgeSelf: "zelf aangemeld",
    badgeAdmin: "via admin",
    badgeMe: "jij",
    deleteTitle: "verwijderen",
    emptyList: "Nog niemand in de lijst.",
    toAssignBtn: "📊 Naar toewijzen →",
    guestWord: "Gast",
    adminName: "Ik",
    close: "✕ Sluiten",
    sleepBanner: "⏸ Live-updates gepauzeerd — tik om te hervatten",
    finalizedTitle: "Alles nagekeken — dit is de definitieve verdeling",
    finalizedBy: "De beheerder heeft de rekening afgerond. ",
    finalizedAdminNote: "Gasten kunnen niets meer wijzigen.",
    finalizedGuestNote: "Bekijk je deel hieronder.",
    remarksOpen: "⚠️ Opmerkingen — vink af wat je gecheckt hebt:",
    remarksDone: "✓ Alle opmerkingen afgehandeld",
    resolved: "opgelost",
    reopenRemark: "↩ Terug openen",
    markResolved: "Markeer als opgelost",
    reopenBill: "🔓 Rekening heropenen — gasten kunnen weer wijzigen",
    viewReceipt: "🧾 Bon bekijken",
    rescan: "🔄 Bon opnieuw scannen",
    startScan: "Start hier — Rekening scannen 📸",
    scanOk: "Scan gelukt en items herkend",
    localScanTitle: "⚠️ Onnauwkeurige scan gebruikt — bevat bijna altijd fouten",
    localScanBody: "Controleer volgorde, namen en prijzen goed na, of doe een nieuwe AI-scan.",
    improveAi: "🔄 Verbeter met een nieuwe AI-scan (vervangt alles)",
    enterTotalPrefix: "Vul het totaal van de bon in — items: ",
    enterCorrectTotal: "Vul het correcte rekeningtotaal in zoals op de bon",
    totalMatches: "✓ Totaalbedrag klopt met de bon",
    checkTotalPrompt: "Kijk op je bon — klopt dit totaalbedrag? Tik dan op Ja.",
    receiptTotalLabel: "Rekeningtotaal op de bon: €",
    amountPlaceholder: "bv. 65.90",
    totalConfirmedTitle: "Bon-totaal bevestigd",
    confirmAmount: "✓ Bevestig",
    confirmAmountTitle: "Bevestig dit bedrag",
    yes: "Ja",
    no: "Neen",
    checkAllNote: "⚠️ Controleer alles goed — bedrag correct, maar een scan kan fouten bevatten, zeker bij een onduidelijke bon. Kijk namen, aantallen en prijzen na, en markeer gedeelde items indien nodig.",
    mismatchExplain: (itemTot: string, diff: string, higher: boolean, receiptTot: string) => `Het totaalbedrag klopt met de bon, maar het itemtotaal (€${itemTot}) is €${diff} ${higher ? "hoger" : "lager"} dan het rekeningtotaal (€${receiptTot}). Een scan kan fouten bevatten — controleer hieronder alles goed:`,
    checkPrices: "prijzen/aantallen correct?",
    checkTax: "BTW/andere kosten/kortingen?",
    allOkGoGuests: "✓ Alles klopt — ga naar Gasten en delen →",
    scanModalTitle: "🧾 Rekening scannen",
    scanModalIntro: "Maak of kies een foto van de rekening. Daarna kan je de herkende items nog nakijken en bijsturen.",
    scanProgress: "De tekst van je bon wordt herkend — even geduld.",
    scanningBusy: "⏳ Bezig met scannen — even geduld",
    longBillTitle: "📑 Te lange rekening? Neem 2 foto's!",
    longBillSub: "bovenste helft & onderste helft",
    addSecondHalf: "2e helft",
    photoAdded: "foto toegevoegd",
    retakePhoto: "opnieuw nemen",
    readBillBtn: "✨ Lees de rekening uit",
    readBillBtn2: "✨ Scan 2 foto's samen",
    countsAsOne: "telt als één scan",
    photoHintOne: "Staat alles erop? Lees uit. Zo niet: voeg de 2e helft toe.",
    photoHintTwo: "Beide helften klaar. De items komen in één lijst.",
    scanningPhotoN: (i: number, n: number) => `✨ Foto ${i} van ${n} wordt gelezen…`,
    itemsSoFar: (n: number) => `${n} items gevonden tot nu toe`,
    otherPhoto: "📷 Andere foto kiezen",
    pickPhoto: "📷 Foto maken / kiezen",
    takePhoto: "Foto maken",
    fromGallery: "Uit galerij",
    scanFailUnavailTitle: "😕 De slimme scan is even niet beschikbaar",
    scanFailUnavailBody: "De AI-herkenning is momenteel overbelast of tijdelijk offline. Wacht heel even en probeer opnieuw — meestal is ze na een halve minuut terug. Je foto blijft bewaard.",
    retryIn: (s: number) => `🔄 Opnieuw proberen over ${s}s`,
    retryNow: "🔄 Opnieuw proberen",
    scanFailEmptyTitle: "📷 Niets herkend op de foto",
    scanFailEmptyBody: "De scan kon geen items lezen. Maak een scherpere foto — recht van boven, goed belicht en zonder plooien of schaduw — en probeer opnieuw.",
    useQuickScan: "Toch de snelle scan gebruiken (minder nauwkeurig)",
    yourPhoto: "Jouw foto — vergelijk met de lijst",
    scannedReceiptAlt: "gescande bon",
    recognizedSuffix: "herkend — controleer en stuur bij",
    perPiece: "€/stuk",
    sharedItemNote: "Gedeeld item (bv. water of wijn) — de prijs wordt straks verdeeld over wie meedeelt.",
    addTaxBtn: "🧮 BTW/Kosten toevoegen",
    itemsWord: "Items",
    taxWord: "🧮 BTW / kosten",
    calcTotal: "Berekend totaal",
    totalOnBill: "Totaal op de bon",
    matchesBillTotal: "✅ Klopt met het bon-totaal",
    diffNote: (amt: string, higher: boolean) => `⚠️ Verschil van €${amt} (${higher ? "berekend is hoger" : "berekend is lager"}). Controleer aantallen, prijzen en BTW.`,
    enterBillLive: "Vul het totaal van de bon in om live te zien of alles (incl. BTW) klopt.",
    cancel: "Annuleren",
    closeWord: "Sluiten",
    confirmAdd: "✅ Bevestigen & toevoegen",
    itemsOnBill: "🧾 Items op de bon",
    checkExcl: "Checken!",
    noItemsScan: "Nog geen items — scan de bon",
    justAddedEdit: "✨ Net toegevoegd — pas de naam aan met ✏️",
    scanDoubtTitle: "De scan twijfelde hier — tik voor details",
    sharedWord: "gedeeld",
    perPieceSuffix: "/stuk",
    openWord: "open",
    shareToggleOn: "gedeeld item — klik om uit te zetten",
    shareToggleOff: "maak hier een gedeeld item van (bv. water, wijn)",
    scanDoubtPre: "⚠️ De scan twijfelde hier",
    scanDoubtPost: ". Controleer even de naam, het aantal en de prijs.",
    notAssignedYet: "nog niet toegewezen",
    sharedItemNoteShort: "Gedeeld item — de prijs wordt verdeeld over wie meedeelt.",
    zeroPriceWarn: "Geen prijs (€0,00) — vul de prijs in of verwijder dit item.",
    zeroPriceShort: "€0,00 — geen prijs",
    zeroPriceDelete: "Verwijderen",
    zeroPriceFix: "Prijs invullen",
    whoTookThis: "Wie nam hiervan mee?",
    tapNames: "tik de namen aan",
    shareFixedBtn: "🔒 vastgezet",
    shareFixBtn: "🔓 vastzetten",
    addGuestsFirst: "Voeg eerst gasten toe.",
    shareFixedNote: "Verdeling vastgezet: gasten zien meteen hun deel.",
    shareLiveNote: "Niet vastgezet: tik gasten aan of laat ze zelf aantikken. Het bedrag deelt live door wie meedoet en kan nog wijzigen tot iedereen bevestigt.",
    addItem: "+ Item toevoegen",
    orderedItems: "Bestelde items: ",
    taxShort: "BTW",
    totalWord: "Totaal",
    billCorrectGoGuests: "Bon correct? Ga naar Gasten en delen! →",
    editItemTitle: "✏️ Item bewerken",
    nameLabel: "Naam",
    qtyLabel: "Aantal",
    pricePerLabel: "Prijs/stuk (€)",
    lineTotal: "Regeltotaal",
    sharedCheckbox: "Gedeeld item (wijn, water...) — splitsen over wie meedeelt",
    saveBtn: "💾 Opslaan",
    newItemTitle: "➕ Nieuw item",
    newItemIntro: "Vul naam en prijs in. Daarna verschijnt het bovenaan opvallend in de lijst.",
    itemNamePlaceholder: "bv. Spaghetti",
    taxInfoBody: "Alleen gebruiken als BTW of andere kosten apart op de bon staan. Kan over de hele rekening verdeeld worden of proportioneel per bestelling.",
    understood: "Begrepen",
    totalsMismatchTitle: "⚠️ De totalen kloppen nog niet",
    diffSuffix: (amt: string) => ` (verschil €${amt})`,
    warnFillTotal: "Vul eerst het totaal van de bon in, of kijk de items na:",
    warnCheckItems: "Kijk dit even na, of vul het juiste bontotaal in zoals op je rekening:",
    checkPricesQty: "prijzen en aantallen correct?",
    checkTaxAdded: "BTW / kosten / kortingen toegevoegd?",
    checkSharedMarked: "gedeelde items aangeduid?",
    backToBill: "Terug naar de bon",
    continueAnyway: "Toch doorgaan →",
    tipReminderTitle: "💶 Nog geen fooi toegevoegd",
    tipReminderBody: "Wil je nog een fooi toevoegen voor je de rekening afsluit? Ze wordt gelijk verdeeld over iedereen die iets bestelde. Je kan ook gewoon zonder fooi doorgaan.",
    addTipBtn: "💶 Fooi toevoegen",
    finalizeNoTip: "Toch afsluiten zonder fooi",
    sureTitle: "Weet je het zeker?",
    sureDiff: (amt: string) => ` De totalen kloppen nog niet (verschil €${amt})`,
    sureNoTotal: " Het bontotaal is nog niet ingevuld",
    finalizeWarnBody: "Na het afsluiten kan niemand nog iets wijzigen. Controleer eerst de items of het bontotaal.",
    finalizeAnyway: "Toch afsluiten",
    billClosedTitle: "Rekening afgesloten",
    billClosedBody: "Je gasten kunnen niets meer wijzigen. Dit is de verdeling per persoon:",
    noGuestsYet: "Nog geen gasten toegevoegd.",
    overWholeBill: "📊 Over de hele rekening",
    overCertainItems: "🎯 Over bepaalde items",
    howToSplit: "Hoe verdelen?",
    tapItemsForCost: "👉 Tik aan welke items deze kost dragen.",
    saveHint: "⬇️ Klik daarna onderaan op \"Bevestigen & toevoegen\" om het op te slaan.",
    justAddedScan: "✨ Net toegevoegd — controleer naam en prijs",
    taxModalTitle: "🧮 BTW / kosten / korting",
    taxDesc: "Aparte BTW, Kosten of Kortingen?",
    taxDescPlaceholder: "bv. Bediening, Couvert, Korting",
    taxAmountLabel: "Bedrag € (gebruik een minteken voor een korting)",
    taxAmountPlaceholder: "bv. 5.00",
    taxEnterAmount: "Vul een bedrag in om verder te gaan.",
    taxSplitOver: "Verdelen over:",
    noItemsShort: "Nog geen items.",
    confirmBtn: "Bevestigen",
    statusConfirmed: "✓ bevestigd",
    statusBusy: "● bezig",
    statusNothing: "nog niets",
    overviewTitle: "📊 Overzicht",
    statTotal: "Totaalbedrag",
    viewPerPerson: "Rekening per persoon bekijken",
    viewPerPersonAttr: "naar de rekening per persoon",
    statNotClaimed: "Nog niet geclaimd",
    allClaimed: "Alles geclaimd",
    todoTitle: "⚠️ Nog te regelen — wijs snel toe",
    addGuestsToAssign: "Voeg eerst gasten toe om te kunnen toewijzen.",
    notClaimedSuffix: "niet geclaimd",
    assignDots: "+ wijs toe…",
    sharedNobody: "— gedeeld, nog niemand",
    letShareDots: "+ laat meedelen…",
    perPersonTitle: "🧾 Per persoon",
    detailsHide: "▲ Details verbergen",
    detailsShow: "▼ Details tonen",
    nothingTapped: "Nog niets aangetikt.",
    sharedNPers: (n: number) => ` (gedeeld, ${n} pers.)`,
    sharedPart: " (gedeeld deel)",
    sharedByN: (n: number) => ` (gedeeld door ${n})`,
    toBeDivided: "nog te verdelen",
    noGuests: "Nog geen gasten",
    allAssigned: "✅ Alles toegewezen",
    assignedLabel: "Toegewezen",
    todoLeft: (n: number) => ` · nog ${n} te doen`,
    tipLabelPre: "💶 Fooi: ",
    tipEqualNote: "· gelijk over wie bestelde",
    clearTip: "Wissen",
    tipItemName: "Fooi",
    explainTooltip: "uitleg",
    tipHeader: "💶 Fooi",
    addTipShort: "Toevoegen",
    tipOptional: "Optioneel — wordt gelijk verdeeld over iedereen die iets bestelde.",
    reopenBillTip: "🔓 Rekening heropenen (gasten kunnen weer wijzigen)",
    finalizeBtn: "✅ Alles toegewezen?  Rekening afsluiten",
    finalizeConfirm: "De rekening afsluiten? Gasten kunnen daarna niets meer aantikken of wijzigen tot je ze heropent.",
    finalizedNote: "De rekening is afgesloten — iedereen ziet de definitieve verdeling.",
    notFinalizedNote: "Sluit pas af als alles is aangetikt en nagekeken. Gasten krijgen dan een melding.",
    backToTop: "↑ Terug naar boven",
    cantFinalizeTitle: "De rekening kan nog niet afgesloten worden:",
    unitsNotAssigned: (n: number) => `${n} ${n === 1 ? "consumptie is" : "consumpties zijn"} nog niet toegewezen`,
    sharedNobodyTakes: (n: number) => `${n} gedeeld ${n === 1 ? "item wordt" : "items worden"} door niemand genomen`,
    assignFirstHint: `Wijs eerst alles toe. Bekijk via "Nog niet geclaimd" wat er nog openstaat.`,
    reopenFirst: "Heropen de rekening eerst om iets te wijzigen.",
    finalizedAskAdmin: "De rekening is afgesloten — vraag de beheerder om ze te heropenen.",
    rescanConfirmClaims: "Opnieuw scannen wist de huidige bon én alles wat al toegewezen werd (items en aanduidingen). Wil je doorgaan?",
    rescanConfirmItems: "Opnieuw scannen wist de huidige items van de vorige bon. Wil je doorgaan?",
    errNoPhotoRescan: "Geen foto beschikbaar om opnieuw te scannen.",
    taxConfigTitle: "verdeling",
    fixedAmount: "vast bedrag",
    distributedWord: "verdeeld",
    overWholeBillShort: "over de hele rekening",
    overNItems: (n: number) => `over ${n} gekozen item${n === 1 ? "" : "s"}`,
    tapGearToChange: " · tik ⚙️ om te wijzigen",
    removeCosts: "✕ Toch geen extra kosten? Weghalen",
    taxDefaultName: "BTW of andere kosten",
    taxRateName: (r: number) => `BTW ${r}%`,
    seatsColMsg: "Let op: 'telt voor meerdere personen' werkt nog niet. Voeg in Supabase de kolom seats toe aan table_participants.",
    selfJoinedColMsg: "Let op: het onderscheid 'via link / vooraf toegevoegd' werkt nog niet. Voeg in Supabase de kolom self_joined toe (zie instructies).",
    errGuestAdd: "Gast toevoegen mislukt: ",
    confirmSeatsChange: "Het aantal personen wijzigen wist wat deze persoon al aantikte (gewone én gedeelde items). Wil je doorgaan?",
    seatsSaveMsg: "Voeg in Supabase de kolom seats toe aan table_participants om dit te bewaren.",
    seatsChanged: "Aantal personen aangepast — eerdere keuzes gewist, tik opnieuw aan",
    finalizeColsMsg: "Voeg in Supabase de kolommen finalized (bool) en disputed_by (text) toe aan table_groups.",
    errPing: "Seintje versturen mislukt",
    errUpdate: "Bijwerken mislukt",
    confirmDeleteGuest: "Deze gast verwijderen? Zijn/haar claims verdwijnen ook.",
    errNoPhoto: "Geen foto beschikbaar.",
    errPhotoSave: "Foto bewaren mislukt — items worden wel toegevoegd",
    errPhotoSaveGroup: "De bonfoto kon niet bij de groep bewaard worden: ",
    errItemsSave: "Items opslaan mislukt: ",
    errTaxSave: "BTW opslaan mislukt: ",
    distributeColTaxMsg: "Let op: voeg in Supabase de kolom 'distribute' toe, anders wordt de BTW-verdeling niet bewaard.",
    errItemAdd: "Item toevoegen mislukt",
    distributeColMsg: "Voeg eerst de kolom 'distribute' toe in Supabase (zie instructies).",
    errAdd: "Toevoegen mislukt: ",
    taxRateColMsg2: "Let op: percentage-BTW werkt nog niet. Voeg in Supabase de kolom tax_rate toe aan table_items.",
    errTaxAdd: "BTW toevoegen mislukt: ",
    errTotalSave: "Rekeningtotaal opslaan mislukt: ",
    taxRateColMsg: "Voeg in Supabase de kolom tax_rate toe aan table_items.",
    errSave: "Opslaan mislukt",
    enterTipFirst: "Vul eerst een fooibedrag in.",
    confirmDeleteItem: "Dit item van de bon verwijderen? Wat er al aan toegewezen werd, verdwijnt mee.",
    claimTitle: "✅ Wie heeft wat genomen?",
    collapseOpen: "▶ openen",
    collapseClose: "▼ inklappen",
    allAssignedTapReview: "✅ Alles toegewezen — tik om opnieuw te bekijken",
    noItemsScanFirst: "Nog geen items — scan eerst de bon.",
    addGuestsInTab1: 'Voeg eerst gasten toe in de tab "Gasten & delen".',
    yellowIs: "👀 Geel = wat ",
    orderedSuffix: " bestelde.",
    totalLower: "totaal",
    nobodyYet: "nog niemand",
    notSelectedShare: (name: string | undefined) => `${name} had dit zelf niet aangeduid. Toch laten meedelen?`,
    fewerPersons: "minder personen",
    morePersons: "meer personen",
    openAssign: "open — wijs toe ▾",
    fullyClaimed: "volledig",
    removeOne: "verwijder er één",
    notSelectedAdd: (name: string | undefined) => `${name} had dit zelf niet aangeduid. Toch toevoegen?`,
    unitsClaimed: "Stuks geclaimd",
    sharedItemsHandled: "Gedeelde items geregeld",
    billTotalLabel: "Totaal rekening",
    forWhomTap: "Voor wie tik je aan?",
    pickPersonHint: "Kies een persoon om voor te claimen (handig als jij voor iemand zonder gsm aantikt).",
    addGuestsInTab2: 'Voeg eerst gasten toe in de tab "Gasten".',
    adminReviewing: "🔎 De beheerder bekijkt de rekening opnieuw",
    adminReviewingBody: "Even geduld — je krijgt straks opnieuw de definitieve verdeling te zien.",
    billClosedTitle2: "De rekening is afgesloten",
    billClosedBody2: "De beheerder rondde de rekening af. Dit is jouw definitieve deel:",
    viewMyShare: "Bekijk mijn verdeling",
    selectItemsPlural: "Selecteer jullie consumpties",
    selectItemsSingular: "Selecteer jouw consumpties",
    noItemsWaitScan: "Nog geen items — wacht tot de bon gescand is.",
    totalSharedByDrinkers: " totaal · wordt gedeeld door wie meedrinkt",
    iShareYes: "✓ ik deel mee",
    iShareNo: "+ meedelen",
    withHowMany: (seats: number) => `🍴 Wie van jullie ${seats} deelde hiervan mee?`,
    onlyMe: "Alleen ik",
    bothOfUs: "Wij allebei",
    nOfUs: (n: number) => `Wij met ${n}`,
    makeSharedTitle: "Dit item delen?",
    makeSharedBody: "De prijs wordt dan verdeeld over iedereen die meedeelt.",
    makeSharedWipe: "De huidige toewijzingen van dit item worden gewist — iedereen duidt opnieuw aan of hij meedeelt.",
    makeSharedYes: "Omzetten naar gedeeld",
    makeUnsharedTitle: "Delen stopzetten?",
    makeUnsharedBody: "Dit item wordt dan weer per stuk toegewezen.",
    makeSharedCancel: "Annuleren",
    sharedBadge: "GEDEELD",
    makeSharedShort: "delen",
    sharedOnShort: "gedeeld",
    addItemBtn: "+ Item toevoegen",
    whatIsThis: "Wat is dit?",
    photoOfN: (i: number, n: number) => `Foto ${i} van ${n}`,
    tooSlowTitle: "⚠️ Lezen duurde te lang",
    tooSlowBody: "Twee foto's zijn zwaarder om te lezen — probeer toch één foto van heel de bon.",
    tooSlowTip: "Recht erboven, goed licht, beeld vullen.",
    tooSlowOne: "📷 Eén foto maken",
    tooSlowRetry: "🔄 Toch met twee",
    taxAddBtn: "+ BTW / kosten / korting",
    legendTitle: "Wat betekenen de knopjes?",
    legendShare: "Gedeelde items (fles wijn, water, dessert)? Tik dit icoon aan. De prijs verdeelt zich over wie meedeelt.",
    legendEdit: "naam, aantal of prijs aanpassen",
    legendDelete: "item verwijderen",
    shareLocked: "Vastgezet door de beheerder",
    yourShareLabel: "Jouw deel: €",
    forNPers: (n: number) => ` (voor ${n} pers.)`,
    sharedByMid: " — gedeeld door ",
    fixedByAdmin: ", vastgelegd door de beheerder.",
    provisionally: "Voorlopig €",
    youN: (n: number) => ` (jullie ${n})`,
    dropsIfMore: ". Daalt als meer mensen meedoen.",
    sharingWaitReveal: "⏳ Je deelt mee. Het bedrag wordt verdeeld over iedereen die meedrinkt — je deel en de namen verschijnen zodra iedereen klaar is met aantikken en bevestigen.",
    tapShareHint: 'Tik "meedelen" als je hiervan dronk. De prijs wordt gedeeld door iedereen die meedrinkt — je betaalt dus niet de hele prijs.',
    orderedMid: "× besteld · ",
    stillFree: (n: number) => `${n} nog vrij`,
    allClaimedWord: "alles geclaimd",
    aboutToConfirm: "Dit ga je bevestigen",
    nothingTappedYet: "Je hebt nog niets aangetikt.",
    yourTotal: "Jouw totaal",
    sharingPendingNote: "ℹ️ Je deelt mee in gedeelde items (wijn/water). Het exacte deel kan nog wijzigen tot iedereen heeft aangetikt en bevestigd.",
    allHandledFinal: "Alles afgehandeld — dit is de definitieve verdeling",
    fullBillInfo: "De volledige rekening ter info — tik een naam aan voor het detail:",
    nothingTapped2: "Niets aangetikt.",
    youSuffix: " (jij)",
    confirmedTapEdit: "✓ Bevestigd — tik om te wijzigen",
    confirmMyOrder: "✅ Bevestig mijn bestelling",
    whatWrong: "🤔 Wat klopt er niet? (optioneel)",
    disputePlaceholder: "bv. die wijn nam ik niet",
    send: "Versturen",
    remarkResolved: "✓ De beheerder heeft je opmerking opgelost.",
    yourRemark: "jouw opmerking: ",
    addAnotherRemark: "➕ Nog een opmerking toevoegen",
    remarkReceived: "💬 De beheerder heeft je opmerking ontvangen en bekijkt ze.",
    withdraw: "toch intrekken",
    somethingWrong: "🤔 Klopt iets niet? Laat het de beheerder weten",
    assignToWhom: "Aan wie toewijzen?",
    everyoneConfirmed: 'Iedereen heeft al bevestigd — kies "andere persoon".',
    otherPerson: "andere persoon ▾",
    yourNamePlaceholder: "Jouw naam",
    joinIn: "Doe mee",
    seatsControlTitle: "Voor hoeveel personen telt deze naam (bij gedeelde items)",
    whoAreYou: "👋 Wie ben jij?",
    enterYourName: "Vul je naam in om mee te doen.",
    orPickYourself: "of kies jezelf uit de lijst",
    errTipAdd: "Fooi toevoegen mislukt: ",
    assignConfirmedWarn: "⚠️ Deze personen bevestigden al; je krijgt een controlevraag voor je toewijst.",
    errCantReadPhoto: "Kon de foto niet lezen",
    errNameRequired: "Geef eerst een naam voor de rekening.",
    finalizedReopenFirst: "De rekening is afgesloten — heropen ze eerst om te wijzigen.",
    billClosedToast: "Rekening afgesloten — gasten kunnen niet meer wijzigen",
    billReopenedToast: "Rekening heropend",
    scanTotalOk: "✅ Bon gescand — totaal klopt. Controleer de items.",
    itemsAddedCheck: (n: number) => `${n} item${n !== 1 ? "s" : ""} toegevoegd — controleer ze op de Bon-tab.`,
  },
  fr: {
    backToRundo: "← retour à l'accueil Rundo",
    tableTagline: "Scanne l'addition et partage en groupe",
    groupName: "Nom du groupe",
    loading: "Chargement…",
    startGroup: "Démarrer le groupe",
    savedGroups: "Groupes enregistrés",
    hide: "▲ masquer",
    show: "▼ afficher",
    roleAdmin: "hôte",
    roleGuest: "invité",
    deletePermanently: "supprimer définitivement",
    tabBon: "Addition",
    tabGuests: "Invités et partage",
    tabAssign: "Répartir",
    errNameTaken: "Tu as déjà un groupe portant ce nom. Choisis-en un autre.",
    errCreateFailed: "Échec de la création du groupe : ",
    errNotFound: "Groupe introuvable. Vérifie le code.",
    errGroupGone: "Ce groupe n'existe plus.",
    errDeleteFailed: "Échec de la suppression : ",
    confirmDeleteGroup: "Supprimer définitivement ce groupe ? Tout (articles, invités et attributions) sera effacé et le groupe ne pourra plus être récupéré, même avec un code.",
    roleAdminBadge: "👑 Hôte",
    roleGuestBadge: "👤 Invité",
    switchPerson: "je suis quelqu'un d'autre — changer de personne",
    toTableHome: "Vers l'accueil Table",
    person: "personne",
    persons: "personnes",
    shareReady: "✅ Total de l'addition et articles corrects — tu peux partager.",
    shareBlocked: "⚠️ Le total de l'addition ne correspond pas encore aux articles. Corrige-le d'abord dans l'onglet Addition avant de partager avec tes invités.",
    guestsTitle1: "🔗 Ou laisse tes invités participer eux-mêmes",
    guestsSub1: "Partage le QR ou le lien. Chacun choisit son nom et coche ce qu'il a pris.",
    inviteLine1: "Tes invités rejoignent ainsi ton groupe ",
    inviteLine2: " pour partager l'addition.",
    copyInviteBtn: "🔗 Partage le lien",
    copyInviteHelp: "Prêt à coller dans WhatsApp, SMS, Messenger, etc.",
    inviteModalTitle: "Partage ton invitation",
    inviteModalMsg: "Colle cette invitation dans WhatsApp, Messenger, SMS ou un autre service de messagerie et envoie-la à ton groupe.",
    inviteModalCopy: "📋 Copier à nouveau",
    inviteModalClose: "Fermer",
    guestsSteps: ["Fais-leur scanner le QR-code ou partage le lien", "Chacun coche ce qu'il a pris", "Résultat : une addition partagée équitablement"],
    shareLinkLabel: "ou partage le lien",
    toastInviteCopied: "Invitation copiée",
    inviteMessage: (name: string, link: string) => `Tu es invité·e dans "${name}" — partage l'addition via Rundo Table 👉 ${link}`,
    guestsTitle2: "👥 Ou ajoute les noms toi-même",
    guestsSub2: "Ils peuvent toujours cocher eux-mêmes via le lien, ou tu le fais pour eux dans « Répartir ».",
    namePlaceholder: "Nom",
    addBtn: "+ Ajouter",
    multipleHint: "Plusieurs (ex. un couple) ? Règle le nombre de personnes avec les boutons.",
    guestCount: "Nombre d'invités",
    guestCountHint: "Règle le nombre et adapte les noms. Touche le bouton personnes si quelqu'un commande pour deux.",
    howManyTitle: "👥 Vous êtes combien ?",
    howManySub: "Règle le nombre et adapte les noms — ou partage le groupe et laisse chacun se compléter.",
    personsCount: (n: number) => `${n} ${n === 1 ? "personne" : "personnes"}`,
    howFillIn: "Comment indiquer ce que chacun a pris ?",
    optShare: "📱 Fais-les participer",
    optShareSub: "envoie le lien ou montre le QR",
    optSelf: "✍️ Je le fais pour eux",
    optSelfSub: "remplir les noms & cocher soi-même",
    sharePopupSub: "Ils choisissent une place libre, y mettent leur nom et cochent ce qu'ils ont pris.",
    howManyGroupTitle: "👥 Vous êtes combien dans le groupe ?",
    yourselfFirstTitle: "✍️ Ajoute-toi d'abord (en tant qu'admin)",
    adminBadge: "admin",
    nameRequired: "Indique d'abord ton nom — sinon personne ne sait qui a partagé l'addition.",
    whoJoinedTitle: "👥 Qui participe déjà ?",
    joinedOf: (a: number, b: number) => `${a} sur ${b}`,
    stAssigned: (n: number) => `${n} articles`,
    stJoinedNothing: "rien encore",
    stNobody: "personne",
    stYouHandle: "tu gères",
    stAssignNow: "cocher →",
    whoJoinedHint: "💡 Ici tu vois qui a ouvert le lien. Le cochage se fait dans Répartir.",
    whoAssignTitle: "📝 Pour qui coches-tu ?",
    youAlreadyIn: "Tu y es déjà",
    whoAssignSub: "Et éventuellement d'autres : pas de smartphone, pas envie, ou tu gères simplement tout toi-même.",
    whoAssignFoot: "💡 Ensuite, dans Répartir, tu coches ce que tu as pris — et ce qu'ils ont pris.",
    shareLinkBtn: "🔗 Partager le lien",
    shareLinkHint: "Choisis ensuite ton app de messagerie — WhatsApp, Messenger, SMS…",
    copyLinkPre: "Tu préfères coller toi-même ?",
    copyLinkAction: "Copie le lien",
    copyLinkPost: "et envoie-le où tu veux.",
    billOkBadge: "✓ l'addition est correcte — tu peux partager",
    seatFreedUp: "Cette place compte maintenant pour 2 — il y a une place libre en moins.",
    howManyGroupSub: "Tout le monde à table — toi compris.",
    personsWord: "Nombre de personnes",
    shareStepTitle: "📱 Partage avec tes invités",
    shareStepSub: "Ils choisissent une place libre, y mettent leur nom et cochent ce qu'ils ont pris.",
    sendViaApp: "💬 Envoyer via WhatsApp, Messenger…",
    scanThis: "Fais-leur scanner ceci",
    yourselfTitle: "✍️ Ne t'oublie pas",
    yourselfSub: "Mets ton nom, ainsi chacun sait qui a pris quoi.",
    othersTitle: "📝 Quelqu'un sans smartphone ?",
    othersSub: "Pas de smartphone ou pas envie ? Mets son nom ci-dessous — tu coches alors pour lui.",
    othersAdd: "+ Ajouter un nom que je gère moi-même",
    othersRest: "💡 Laisse les autres libres — ils choisiront leur place via le lien.",
    personWord: "Personne",
    onlyOneShares: "⚠️ Une seule personne partage",
    expectedSharers: "Partagé à combien ?",
    expectedHint: "À remplir uniquement si tu en es sûr. L'app prévient alors si trop peu de personnes l'indiquent.",
    expectedShort: (n: number) => `attendu : ${n}`,
    tooFewShared: (have: number, want: number) => `⚠️ Seulement ${have} sur ${want} personnes l'ont indiqué.`,
    sharedOverviewTitle: "Articles partagés — qui a partagé ?",
    sharedByLabel: "partagé par",
    nobodyShared: "⚠️ Personne n'a indiqué cet article partagé",
    sharedProblemTitle: "Attention — les articles partagés semblent incorrects :",
    sharedProblemAsk: "Clôturer quand même ?",
    totalsMatch: "✓ correspond à l'addition",
    totalsDiff: (d: number) => `⚠️ €${d.toFixed(2).replace(".", ",")} d'écart`,
    mixHint: "Utilisez les deux — l'un n'exclut pas l'autre.",
    meLabel: "toi",
    ownNamePlaceholder: "Mets ton propre nom ici",
    freeSpot: "place libre",
    pickFreeSpot: "Touche une place libre et mets ton nom dessus.",
    freeSpotLabel: "👤 Place libre",
    tapToPick: "touche pour choisir →",
    takenLabel: "occupée",
    imThisOne: "c'est moi →",
    addExtraSpot: "+ Ajouter une place",
    yourNameQ: "Comment t'appelles-tu ?",
    yourNamesQ: "Comment vous appelez-vous ?",
    thatsMe: "C'est moi →",
    thatsUs: "C'est nous →",
    backToSpots: "← retour",
    howManyPersons: "Pour combien de personnes coches-tu ?",
    payTogetherShort: "Plus d'une personne ? Vous payez alors ensemble.",
    adminSpotLabel: "admin",
    onePerson: "👤 1 personne",
    twoPersons: "👫 À 2",
    threePlus: "👥 À 3+",
    payTogetherHint: "Ceux qui partagent une place paient ensemble : tout ce que tu coches compte pour vous deux.",
    firstName: "Premier prénom…",
    secondName: "Deuxième prénom…",
    extraName: (n: number) => `Prénom ${n}…`,
    showsAsOne: "Apparaît comme une seule place :",
    whoOfYouShared: (names: string) => `🍴 Qui de vous a partagé ceci ?`,
    onlyFirst: (name: string) => `Seulement ${name}`,
    allOfUs: "Tous les deux",
    sharePaysOne: "Vous payez 1 part au lieu de 2.",
    assignShareHint: "Quelque chose à partager (bouteille de vin, eau) ? Touchez « partager » sur cet article.",
    unshareLink: "ne plus partager",
    confirmRemoveLast: (name: string, n: number) => `${name} a déjà sélectionné ${n} ${n === 1 ? "article" : "articles"}. Ces attributions seront perdues. Supprimer quand même ?`,
    editNameHint: "· touche un nom pour le modifier",
    manageDone: "✓ Terminé",
    manageDelete: "🗑️ Supprimer",
    badgeSelf: "inscrit via le lien",
    badgeAdmin: "par l'hôte",
    badgeMe: "toi",
    deleteTitle: "supprimer",
    emptyList: "Personne dans la liste pour l'instant.",
    toAssignBtn: "📊 Vers « Répartir » →",
    guestWord: "Invité",
    adminName: "Moi",
    close: "✕ Fermer",
    sleepBanner: "⏸ Mises à jour en direct en pause — touche pour reprendre",
    finalizedTitle: "Tout est vérifié — voici la répartition définitive",
    finalizedBy: "L'hôte a clôturé l'addition. ",
    finalizedAdminNote: "Les invités ne peuvent plus rien modifier.",
    finalizedGuestNote: "Vois ta part ci-dessous.",
    remarksOpen: "⚠️ Remarques — coche ce que tu as vérifié :",
    remarksDone: "✓ Toutes les remarques traitées",
    resolved: "réglé",
    reopenRemark: "↩ Rouvrir",
    markResolved: "Marquer comme réglé",
    reopenBill: "🔓 Rouvrir l'addition — les invités peuvent à nouveau modifier",
    viewReceipt: "🧾 Voir l'addition",
    rescan: "🔄 Rescanner l'addition",
    startScan: "Commence ici — scanne l'addition 📸",
    scanOk: "Scan réussi, articles reconnus",
    localScanTitle: "⚠️ Scan approximatif utilisé — contient presque toujours des erreurs",
    localScanBody: "Vérifie bien l'ordre, les noms et les prix, ou refais un scan IA.",
    improveAi: "🔄 Améliore avec un nouveau scan IA (remplace tout)",
    enterTotalPrefix: "Indique le total de l'addition — articles : ",
    enterCorrectTotal: "Indique le total exact tel qu'il figure sur l'addition",
    totalMatches: "✓ Le total correspond à l'addition",
    checkTotalPrompt: "Regarde ton addition — ce total est-il correct ? Touche alors Oui.",
    receiptTotalLabel: "Total sur l'addition : €",
    amountPlaceholder: "ex. 65,90",
    totalConfirmedTitle: "Total de l'addition confirmé",
    confirmAmount: "✓ Confirme",
    confirmAmountTitle: "Confirme ce montant",
    yes: "Oui",
    no: "Non",
    checkAllNote: "⚠️ Vérifie bien tout — le montant est correct, mais un scan peut contenir des erreurs, surtout sur une addition peu lisible. Vérifie les noms, les quantités et les prix, et marque les articles partagés si besoin.",
    mismatchExplain: (itemTot: string, diff: string, higher: boolean, receiptTot: string) => `Le total correspond à l'addition, mais le total des articles (€${itemTot}) est €${diff} ${higher ? "plus élevé" : "plus bas"} que le total de l'addition (€${receiptTot}). Un scan peut contenir des erreurs — vérifie bien tout ci-dessous :`,
    checkPrices: "prix/quantités corrects ?",
    checkTax: "TVA/autres frais/réductions ?",
    allOkGoGuests: "✓ Tout est correct — vers Invités et partage →",
    scanModalTitle: "🧾 Scanner l'addition",
    scanModalIntro: "Prends ou choisis une photo de l'addition. Tu pourras ensuite vérifier et corriger les articles reconnus.",
    scanProgress: "Le texte de ton addition est en cours de reconnaissance — un instant.",
    scanningBusy: "⏳ Scan en cours — un instant",
    longBillTitle: "📑 Addition trop longue ? Prends 2 photos !",
    longBillSub: "moitié du haut & moitié du bas",
    addSecondHalf: "2e moitié",
    photoAdded: "photo ajoutée",
    retakePhoto: "reprendre",
    readBillBtn: "✨ Lire l'addition",
    readBillBtn2: "✨ Scanner les 2 photos",
    countsAsOne: "compte pour un seul scan",
    photoHintOne: "Tout y est ? Lance la lecture. Sinon : ajoute la 2e moitié.",
    photoHintTwo: "Les deux moitiés sont prêtes. Les articles arrivent dans une seule liste.",
    scanningPhotoN: (i: number, n: number) => `✨ Lecture de la photo ${i} sur ${n}…`,
    itemsSoFar: (n: number) => `${n} articles trouvés jusqu'ici`,
    otherPhoto: "📷 Choisir une autre photo",
    pickPhoto: "📷 Prendre / choisir une photo",
    takePhoto: "Prendre une photo",
    fromGallery: "Depuis la galerie",
    scanFailUnavailTitle: "😕 Le scan intelligent est momentanément indisponible",
    scanFailUnavailBody: "La reconnaissance IA est surchargée ou temporairement hors ligne. Attends un instant et réessaie — elle revient généralement après une demi-minute. Ta photo est conservée.",
    retryIn: (s: number) => `🔄 Réessayer dans ${s}s`,
    retryNow: "🔄 Réessayer",
    scanFailEmptyTitle: "📷 Rien reconnu sur la photo",
    scanFailEmptyBody: "Le scan n'a lu aucun article. Prends une photo plus nette — de face, bien éclairée et sans plis ni ombres — puis réessaie.",
    useQuickScan: "Utiliser quand même le scan rapide (moins précis)",
    yourPhoto: "Ta photo — compare avec la liste",
    scannedReceiptAlt: "addition scannée",
    recognizedSuffix: "reconnus — vérifie et corrige",
    perPiece: "€/pièce",
    sharedItemNote: "Article partagé (ex. eau ou vin) — le prix sera réparti entre ceux qui le partagent.",
    addTaxBtn: "🧮 Ajouter TVA/frais",
    itemsWord: "Articles",
    taxWord: "🧮 TVA / frais",
    calcTotal: "Total calculé",
    totalOnBill: "Total sur l'addition",
    matchesBillTotal: "✅ Correspond au total de l'addition",
    diffNote: (amt: string, higher: boolean) => `⚠️ Écart de €${amt} (${higher ? "le calcul est plus élevé" : "le calcul est plus bas"}). Vérifie les quantités, les prix et la TVA.`,
    enterBillLive: "Indique le total de l'addition pour voir en direct si tout (TVA comprise) correspond.",
    cancel: "Annuler",
    closeWord: "Fermer",
    confirmAdd: "✅ Confirmer et ajouter",
    itemsOnBill: "🧾 Articles sur l'addition",
    checkExcl: "À vérifier !",
    noItemsScan: "Aucun article — scanne l'addition",
    justAddedEdit: "✨ Vient d'être ajouté — modifie le nom avec ✏️",
    scanDoubtTitle: "Le scan a hésité ici — touche pour les détails",
    sharedWord: "partagé",
    perPieceSuffix: "/pièce",
    openWord: "à prendre",
    shareToggleOn: "article partagé — clique pour désactiver",
    shareToggleOff: "en faire un article partagé (ex. eau, vin)",
    scanDoubtPre: "⚠️ Le scan a hésité ici",
    scanDoubtPost: ". Vérifie le nom, la quantité et le prix.",
    notAssignedYet: "pas encore attribué(s)",
    sharedItemNoteShort: "Article partagé — le prix est réparti entre ceux qui le partagent.",
    zeroPriceWarn: "Pas de prix (0,00 €) — indiquez le prix ou supprimez cet article.",
    zeroPriceShort: "0,00 € — pas de prix",
    zeroPriceDelete: "Supprimer",
    zeroPriceFix: "Indiquer le prix",
    whoTookThis: "Qui en a pris ?",
    tapNames: "touche les noms",
    shareFixedBtn: "🔒 fixé",
    shareFixBtn: "🔓 fixer",
    addGuestsFirst: "Ajoute d'abord des invités.",
    shareFixedNote: "Répartition fixée : les invités voient tout de suite leur part.",
    shareLiveNote: "Non fixée : touche les invités ou laisse-les cocher eux-mêmes. Le montant se répartit en direct selon les participants et peut encore changer jusqu'à ce que tout le monde confirme.",
    addItem: "+ Ajouter un article",
    orderedItems: "Articles commandés : ",
    taxShort: "TVA",
    totalWord: "Total",
    billCorrectGoGuests: "Addition correcte ? Vers Invités et partage ! →",
    editItemTitle: "✏️ Modifier l'article",
    nameLabel: "Nom",
    qtyLabel: "Quantité",
    pricePerLabel: "Prix/pièce (€)",
    lineTotal: "Total de la ligne",
    sharedCheckbox: "Article partagé (vin, eau…) — répartir entre ceux qui le partagent",
    saveBtn: "💾 Enregistrer",
    newItemTitle: "➕ Nouvel article",
    newItemIntro: "Indique le nom et le prix. Il apparaîtra ensuite en évidence en haut de la liste.",
    itemNamePlaceholder: "ex. Spaghetti",
    taxInfoBody: "À utiliser seulement si la TVA ou d'autres frais figurent séparément sur l'addition. Peut être réparti sur toute l'addition ou proportionnellement par commande.",
    understood: "Compris",
    totalsMismatchTitle: "⚠️ Les totaux ne correspondent pas encore",
    diffSuffix: (amt: string) => ` (écart €${amt})`,
    warnFillTotal: "Indique d'abord le total de l'addition, ou vérifie les articles :",
    warnCheckItems: "Vérifie ceci, ou indique le bon total tel qu'il figure sur ton addition :",
    checkPricesQty: "prix et quantités corrects ?",
    checkTaxAdded: "TVA / frais / réductions ajoutés ?",
    checkSharedMarked: "articles partagés indiqués ?",
    backToBill: "Retour à l'addition",
    continueAnyway: "Continuer quand même →",
    tipReminderTitle: "💶 Pas encore de pourboire ajouté",
    tipReminderBody: "Veux-tu ajouter un pourboire avant de clôturer l'addition ? Il sera réparti également entre tous ceux qui ont commandé quelque chose. Tu peux aussi continuer sans pourboire.",
    addTipBtn: "💶 Ajouter un pourboire",
    finalizeNoTip: "Clôturer quand même sans pourboire",
    sureTitle: "En es-tu sûr ?",
    sureDiff: (amt: string) => ` Les totaux ne correspondent pas encore (écart €${amt})`,
    sureNoTotal: " Le total de l'addition n'est pas encore indiqué",
    finalizeWarnBody: "Une fois clôturé, plus personne ne peut modifier. Vérifie d'abord les articles ou le total de l'addition.",
    finalizeAnyway: "Clôturer quand même",
    billClosedTitle: "Addition clôturée",
    billClosedBody: "Tes invités ne peuvent plus rien modifier. Voici la répartition par personne :",
    noGuestsYet: "Aucun invité ajouté.",
    overWholeBill: "📊 Sur toute l'addition",
    overCertainItems: "🎯 Sur certains articles",
    howToSplit: "Comment répartir ?",
    tapItemsForCost: "👉 Touche les articles qui portent ce coût.",
    saveHint: "⬇️ Clique ensuite en bas sur « Confirmer et ajouter » pour l'enregistrer.",
    justAddedScan: "✨ Vient d'être ajouté — vérifie le nom et le prix",
    taxModalTitle: "🧮 TVA / frais / réduction",
    taxDesc: "TVA, frais ou réductions séparés ?",
    taxDescPlaceholder: "ex. Service, Couvert, Réduction",
    taxAmountLabel: "Montant € (utilise un signe moins pour une réduction)",
    taxAmountPlaceholder: "ex. 5,00",
    taxEnterAmount: "Indique un montant pour continuer.",
    taxSplitOver: "Répartir sur :",
    noItemsShort: "Aucun article.",
    confirmBtn: "Confirmer",
    statusConfirmed: "✓ confirmé",
    statusBusy: "● en cours",
    statusNothing: "rien encore",
    overviewTitle: "📊 Aperçu",
    statTotal: "Montant total",
    viewPerPerson: "Voir l'addition par personne",
    viewPerPersonAttr: "vers l'addition par personne",
    statNotClaimed: "Pas encore attribué",
    allClaimed: "Tout est attribué",
    todoTitle: "⚠️ Encore à régler — attribue vite",
    addGuestsToAssign: "Ajoute d'abord des invités pour pouvoir attribuer.",
    notClaimedSuffix: "non attribué(s)",
    assignDots: "+ attribuer…",
    sharedNobody: "— partagé, personne encore",
    letShareDots: "+ faire participer…",
    perPersonTitle: "🧾 Par personne",
    detailsHide: "▲ Masquer les détails",
    detailsShow: "▼ Afficher les détails",
    nothingTapped: "Rien coché pour l'instant.",
    sharedNPers: (n: number) => ` (partagé, ${n} pers.)`,
    sharedPart: " (part partagée)",
    sharedByN: (n: number) => ` (partagé par ${n})`,
    toBeDivided: "à répartir",
    noGuests: "Aucun invité pour l'instant",
    allAssigned: "✅ Tout attribué",
    assignedLabel: "Attribué",
    todoLeft: (n: number) => ` · encore ${n} à faire`,
    tipLabelPre: "💶 Pourboire : ",
    tipEqualNote: "· également entre ceux qui ont commandé",
    clearTip: "Effacer",
    tipItemName: "Pourboire",
    explainTooltip: "explication",
    tipHeader: "💶 Pourboire",
    addTipShort: "Ajouter",
    tipOptional: "Optionnel — réparti également entre tous ceux qui ont commandé quelque chose.",
    reopenBillTip: "🔓 Rouvrir l'addition (les invités peuvent à nouveau modifier)",
    finalizeBtn: "✅ Tout attribué ?  Clôturer l'addition",
    finalizeConfirm: "Clôturer l'addition ? Les invités ne pourront plus rien cocher ni modifier jusqu'à ce que tu la rouvres.",
    finalizedNote: "L'addition est clôturée — tout le monde voit la répartition définitive.",
    notFinalizedNote: "Ne clôture que lorsque tout est coché et vérifié. Les invités reçoivent alors une notification.",
    backToTop: "↑ Retour en haut",
    cantFinalizeTitle: "L'addition ne peut pas encore être clôturée :",
    unitsNotAssigned: (n: number) => `${n} ${n === 1 ? "consommation non attribuée" : "consommations non attribuées"}`,
    sharedNobodyTakes: (n: number) => `${n} ${n === 1 ? "article partagé que personne ne prend" : "articles partagés que personne ne prend"}`,
    assignFirstHint: `Attribue d'abord tout. Regarde via « Pas encore attribué » ce qui reste.`,
    reopenFirst: "Rouvre d'abord l'addition pour modifier quelque chose.",
    finalizedAskAdmin: "L'addition est clôturée — demande à l'hôte de la rouvrir.",
    rescanConfirmClaims: "Rescanner efface l'addition actuelle et tout ce qui a déjà été attribué (articles et sélections). Continuer ?",
    rescanConfirmItems: "Rescanner efface les articles actuels de l'addition précédente. Continuer ?",
    errNoPhotoRescan: "Aucune photo disponible pour rescanner.",
    taxConfigTitle: "répartition",
    fixedAmount: "montant fixe",
    distributedWord: "réparti",
    overWholeBillShort: "sur toute l'addition",
    overNItems: (n: number) => `sur ${n} article${n === 1 ? "" : "s"} choisi${n === 1 ? "" : "s"}`,
    tapGearToChange: " · touche ⚙️ pour modifier",
    removeCosts: "✕ Pas de frais en plus finalement ? Retirer",
    taxDefaultName: "TVA ou autres frais",
    taxRateName: (r: number) => `TVA ${r}%`,
    seatsColMsg: "Attention : « compte pour plusieurs personnes » ne fonctionne pas encore. Ajoute la colonne seats à table_participants dans Supabase.",
    selfJoinedColMsg: "Attention : la distinction « via le lien / ajouté à l'avance » ne fonctionne pas encore. Ajoute la colonne self_joined dans Supabase (voir instructions).",
    errGuestAdd: "Échec de l'ajout de l'invité : ",
    confirmSeatsChange: "Modifier le nombre de personnes efface ce que cette personne a déjà coché (articles simples et partagés). Continuer ?",
    seatsSaveMsg: "Ajoute la colonne seats à table_participants dans Supabase pour l'enregistrer.",
    seatsChanged: "Nombre de personnes modifié — choix précédents effacés, coche à nouveau",
    finalizeColsMsg: "Ajoute les colonnes finalized (bool) et disputed_by (text) à table_groups dans Supabase.",
    errPing: "Échec de l'envoi du signal",
    errUpdate: "Échec de la mise à jour",
    confirmDeleteGuest: "Supprimer cet invité ? Ses sélections disparaissent aussi.",
    errNoPhoto: "Aucune photo disponible.",
    errPhotoSave: "Échec de l'enregistrement de la photo — les articles sont quand même ajoutés",
    errPhotoSaveGroup: "La photo de l'addition n'a pas pu être enregistrée avec le groupe : ",
    errItemsSave: "Échec de l'enregistrement des articles : ",
    errTaxSave: "Échec de l'enregistrement de la TVA : ",
    distributeColTaxMsg: "Attention : ajoute la colonne « distribute » dans Supabase, sinon la répartition de la TVA n'est pas enregistrée.",
    errItemAdd: "Échec de l'ajout de l'article",
    distributeColMsg: "Ajoute d'abord la colonne « distribute » dans Supabase (voir instructions).",
    errAdd: "Échec de l'ajout : ",
    taxRateColMsg2: "Attention : la TVA en pourcentage ne fonctionne pas encore. Ajoute la colonne tax_rate à table_items dans Supabase.",
    errTaxAdd: "Échec de l'ajout de la TVA : ",
    errTotalSave: "Échec de l'enregistrement du total : ",
    taxRateColMsg: "Ajoute la colonne tax_rate à table_items dans Supabase.",
    errSave: "Échec de l'enregistrement",
    enterTipFirst: "Indique d'abord un montant de pourboire.",
    confirmDeleteItem: "Supprimer cet article de l'addition ? Ce qui y était attribué disparaît aussi.",
    claimTitle: "✅ Qui a pris quoi ?",
    collapseOpen: "▶ ouvrir",
    collapseClose: "▼ réduire",
    allAssignedTapReview: "✅ Tout attribué — touche pour revoir",
    noItemsScanFirst: "Aucun article — scanne d'abord l'addition.",
    addGuestsInTab1: "Ajoute d'abord des invités dans l'onglet « Invités et partage ».",
    yellowIs: "👀 Jaune = ce que ",
    orderedSuffix: " a commandé.",
    totalLower: "total",
    nobodyYet: "personne encore",
    notSelectedShare: (name: string | undefined) => `${name} ne l'avait pas coché soi-même. Le faire participer quand même ?`,
    fewerPersons: "moins de personnes",
    morePersons: "plus de personnes",
    openAssign: "à prendre — attribuer ▾",
    fullyClaimed: "complet",
    removeOne: "en retirer un",
    notSelectedAdd: (name: string | undefined) => `${name} ne l'avait pas coché soi-même. L'ajouter quand même ?`,
    unitsClaimed: "Unités attribuées",
    sharedItemsHandled: "Articles partagés réglés",
    billTotalLabel: "Total de l'addition",
    forWhomTap: "Pour qui coches-tu ?",
    pickPersonHint: "Choisis une personne pour cocher à sa place (pratique si tu coches pour quelqu'un sans téléphone).",
    addGuestsInTab2: "Ajoute d'abord des invités dans l'onglet « Invités ».",
    adminReviewing: "🔎 L'hôte revoit l'addition",
    adminReviewingBody: "Un instant — tu reverras bientôt la répartition définitive.",
    billClosedTitle2: "L'addition est clôturée",
    billClosedBody2: "L'hôte a clôturé l'addition. Voici ta part définitive :",
    viewMyShare: "Voir ma part",
    selectItemsPlural: "Sélectionnez vos consommations",
    selectItemsSingular: "Sélectionne tes consommations",
    noItemsWaitScan: "Aucun article — attends que l'addition soit scannée.",
    totalSharedByDrinkers: " au total · réparti entre ceux qui en boivent",
    iShareYes: "✓ je participe",
    iShareNo: "+ participer",
    withHowMany: (seats: number) => `🍴 Qui de vous ${seats} a partagé ceci ?`,
    onlyMe: "Moi seulement",
    bothOfUs: "Nous deux",
    nOfUs: (n: number) => `Nous ${n}`,
    makeSharedTitle: "Partager cet article ?",
    makeSharedBody: "Le prix sera réparti entre tous ceux qui partagent.",
    makeSharedWipe: "Les attributions actuelles de cet article seront effacées — chacun réindique s'il partage.",
    makeSharedYes: "Convertir en partagé",
    makeUnsharedTitle: "Arrêter le partage ?",
    makeUnsharedBody: "Cet article sera de nouveau attribué à l'unité.",
    makeSharedCancel: "Annuler",
    sharedBadge: "PARTAGÉ",
    makeSharedShort: "partager",
    sharedOnShort: "partagé",
    addItemBtn: "+ Ajouter un article",
    whatIsThis: "Qu'est-ce que c'est ?",
    photoOfN: (i: number, n: number) => `Photo ${i} sur ${n}`,
    tooSlowTitle: "⚠️ La lecture a pris trop de temps",
    tooSlowBody: "Deux photos sont plus lourdes à lire — essaie plutôt une seule photo de toute l'addition.",
    tooSlowTip: "Bien au-dessus, bonne lumière, remplis l'image.",
    tooSlowOne: "📷 Prendre une photo",
    tooSlowRetry: "🔄 Réessayer à deux",
    taxAddBtn: "+ TVA / frais / remise",
    legendTitle: "Que font les boutons ?",
    legendShare: "Articles partagés (bouteille de vin, eau, dessert) ? Touche cette icône. Le prix se répartit entre ceux qui partagent.",
    legendEdit: "modifier le nom, la quantité ou le prix",
    legendDelete: "supprimer l'article",
    shareLocked: "Verrouillé par l'administrateur",
    yourShareLabel: "Ta part : €",
    forNPers: (n: number) => ` (pour ${n} pers.)`,
    sharedByMid: " — partagé par ",
    fixedByAdmin: ", fixé par l'hôte.",
    provisionally: "Provisoirement €",
    youN: (n: number) => ` (vous ${n})`,
    dropsIfMore: ". Diminue si plus de personnes participent.",
    sharingWaitReveal: "⏳ Tu participes. Le montant est réparti entre tous ceux qui en boivent — ta part et les noms apparaissent dès que tout le monde a coché et confirmé.",
    tapShareHint: "Coche « participer » si tu en as bu. Le prix est réparti entre tous ceux qui en boivent — tu ne paies donc pas le prix entier.",
    orderedMid: "× commandé · ",
    stillFree: (n: number) => `${n} encore libre${n === 1 ? "" : "s"}`,
    allClaimedWord: "tout attribué",
    aboutToConfirm: "Voici ce que tu confirmes",
    nothingTappedYet: "Tu n'as encore rien coché.",
    yourTotal: "Ton total",
    sharingPendingNote: "ℹ️ Tu participes à des articles partagés (vin/eau). La part exacte peut encore changer jusqu'à ce que tout le monde ait coché et confirmé.",
    allHandledFinal: "Tout est réglé — voici la répartition définitive",
    fullBillInfo: "L'addition complète pour info — touche un nom pour le détail :",
    nothingTapped2: "Rien coché.",
    youSuffix: " (toi)",
    confirmedTapEdit: "✓ Confirmé — touche pour modifier",
    confirmMyOrder: "✅ Confirme ma commande",
    whatWrong: "🤔 Qu'est-ce qui ne va pas ? (optionnel)",
    disputePlaceholder: "ex. je n'ai pas pris ce vin",
    send: "Envoyer",
    remarkResolved: "✓ L'hôte a réglé ta remarque.",
    yourRemark: "ta remarque : ",
    addAnotherRemark: "➕ Ajouter une autre remarque",
    remarkReceived: "💬 L'hôte a reçu ta remarque et l'examine.",
    withdraw: "retirer finalement",
    somethingWrong: "🤔 Quelque chose ne va pas ? Préviens l'hôte",
    assignToWhom: "À qui attribuer ?",
    everyoneConfirmed: "Tout le monde a déjà confirmé — choisis « autre personne ».",
    otherPerson: "autre personne ▾",
    yourNamePlaceholder: "Ton nom",
    joinIn: "Participer",
    seatsControlTitle: "Pour combien de personnes compte ce nom (pour les articles partagés)",
    whoAreYou: "👋 Qui es-tu ?",
    enterYourName: "Indique ton nom pour participer.",
    orPickYourself: "ou choisis-toi dans la liste",
    errTipAdd: "Échec de l'ajout du pourboire : ",
    assignConfirmedWarn: "⚠️ Ces personnes ont déjà confirmé ; tu recevras une question de contrôle avant d'attribuer.",
    errCantReadPhoto: "Impossible de lire la photo",
    errNameRequired: "Donne d'abord un nom à l'addition.",
    finalizedReopenFirst: "L'addition est clôturée — rouvre-la d'abord pour modifier.",
    billClosedToast: "Addition clôturée — les invités ne peuvent plus modifier",
    billReopenedToast: "Addition rouverte",
    scanTotalOk: "✅ Addition scannée — le total correspond. Vérifie les articles.",
    itemsAddedCheck: (n: number) => `${n} article${n !== 1 ? "s" : ""} ajouté${n !== 1 ? "s" : ""} — vérifie-les dans l'onglet Addition.`,
  },
}

const showTip = (nm: string, L: { tipItemName: string }) => (nm || "").trim().toLowerCase() === "fooi" ? L.tipItemName : nm

export default function RundoTable() {
  const [lang] = useLang()
  const L = STRINGS[lang]
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
  const [tipInput, setTipInput] = useState("")
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteModalText, setInviteModalText] = useState("")
  const [showTipReminder, setShowTipReminder] = useState(false)
  // De beheerder bevestigde dat het ingevulde bon-totaal correct is, ook al verschilt het van de items.
  const [receiptConfirmed, setReceiptConfirmed] = useState(false)
  // De beheerder klikte "Neen" en past het rekeningtotaal aan.
  const [receiptEditing, setReceiptEditing] = useState(false)
  const receiptInputRef = useRef<HTMLInputElement>(null)
  // Twijfel-vlaggen uit de AI-scan, per item-id (lokaal, om meteen na de scan na te kijken).
  const [scanFlags, setScanFlags] = useState<Record<string, { note: string }>>({})
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanFail, setScanFail] = useState<null | { reason: "unavailable" | "empty"; status?: number; detail?: string }>(null)
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
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [scanStep, setScanStep] = useState<{ i: number; n: number } | null>(null)
  const [multiFails, setMultiFails] = useState(0)
  const [showJoined, setShowJoined] = useState(false)
  // Bewaarde foto van de laatste scan, zodat je een mislukte AI-scan opnieuw kan proberen.
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const [scanPhotoUrl, setScanPhotoUrl] = useState<string | null>(null)
  const [viewReceipt, setViewReceipt] = useState<string | null>(null)
  const [newGuest, setNewGuest] = useState("")
  const [showNames, setShowNames] = useState(false)
  const [claimSpot, setClaimSpot] = useState<string | null>(null)
  const [claimSeats, setClaimSeats] = useState(1)
  const [claimNames, setClaimNames] = useState<string[]>([""])
  const [showTodo, setShowTodo] = useState(false)
  const [showTaxInfo, setShowTaxInfo] = useState(false)
  const [taxConfig, setTaxConfig] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<BillItem | null>(null)
  const [newItem, setNewItem] = useState<{ name: string; unit_price: string; quantity: number; is_shared: boolean; target: "bill" | "scan" } | null>(null)
  // Venster om BTW/kosten/korting toe te voegen: stap 1 = naam + bedrag, stap 2 = verdeling kiezen.
  const [taxModal, setTaxModal] = useState<null | { name: string; amount: string; scope: "all" | "items"; ids: string[] }>(null)
  const [recentItemId, setRecentItemId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shareConfirm, setShareConfirm] = useState<BillItem | null>(null)
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
    if (!name) { setStartError(L.errNameRequired); return }
    const size = Math.max(2, parseInt(partySize) || 2)
    if (getMyGroups().some((g) => g.name.trim().toLowerCase() === name.toLowerCase())) {
      setStartError(L.errNameTaken); return
    }
    setBusy(true); setStartError(null)
    try {
      const owner_id = getOrCreateOwnerId()
      const invite_code = generateInviteCode()
      const { data, error } = await supabase.from("table_groups")
        .insert([{ name, invite_code, owner_id, party_size: size }]).select().single()
      if (error || !data) { setStartError(L.errCreateFailed + error?.message); return }
      saveMyGroup(data, "admin"); setMyGroups(getMyGroups()); rememberLastGroup(data.id)
      setGroup(data)
      // Zet de beheerder meteen als eerste deelnemer ("Ik") zodat je jezelf niet vergeet (overschrijf- en verwijderbaar).
      let myId = getMeId(data.id)
      if (!myId) {
        let ins = await supabase.from("table_participants").insert([{ name: L.adminName, group_id: data.id, self_joined: false, seats: 1 }]).select().single()
        if (ins.error) ins = await supabase.from("table_participants").insert([{ name: L.adminName, group_id: data.id }]).select().single()
        if (ins.data) myId = ins.data.id
      }
      if (myId) { setMeIdStored(data.id, myId); setMeId(myId) } else setMeId(getMeId(data.id))
      await loadAll(data.id); setAdminTab("scan")
    } finally { setBusy(false) }
  }

  const joinGroup = async (codeOverride?: string, initialTab?: AdminTab) => {
    const code = (codeOverride ?? "").trim().toUpperCase()
    if (!code || busy) return
    setBusy(true); setStartError(null)
    try {
      const { data, error } = await supabase.from("table_groups").select("*").eq("invite_code", code).single()
      if (error || !data) { setStartError(L.errNotFound); return }
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
      if (error || !data) { setStartError(L.errGroupGone); removeMyGroup(id); setMyGroups(getMyGroups()); rememberLastGroup(null); return }
      saveMyGroup(data, data.owner_id === getOrCreateOwnerId() ? "admin" : "gast"); setMyGroups(getMyGroups()); rememberLastGroup(data.id)
      setGroup(data); setMeId(getMeId(data.id)); await loadAll(data.id); setAdminTab(tab)
    } finally { setBusy(false) }
  }

  const forgetSavedGroup = async (id: string) => {
    if (!confirm(L.confirmDeleteGroup)) return
    await supabase.from("table_claims").delete().eq("group_id", id)
    await supabase.from("table_confirmations").delete().eq("group_id", id)
    await supabase.from("table_items").delete().eq("group_id", id)
    await supabase.from("table_participants").delete().eq("group_id", id)
    const { error } = await supabase.from("table_groups").delete().eq("id", id)
    if (error) { setStartError(L.errDeleteFailed + error.message); return }
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
    setShowTodo(false); setViewReceipt(null)
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
    const finalName = (name ?? newGuest).trim() || `${L.guestWord} ${participants.length + 1}`
    const seatsVal = Math.max(1, seats)
    let { data, error } = await supabase.from("table_participants")
      .insert([{ name: finalName, group_id: group.id, self_joined: selfJoined, seats: seatsVal }]).select().single()
    if (error && /seats/.test(error.message || "")) {
      const retry = await supabase.from("table_participants")
        .insert([{ name: finalName, group_id: group.id, self_joined: selfJoined }]).select().single()
      data = retry.data; error = retry.error
      if (!error && seatsVal > 1) setError(L.seatsColMsg)
    }
    if (error && /self_joined/.test(error.message || "")) {
      const retry = await supabase.from("table_participants")
        .insert([{ name: finalName, group_id: group.id }]).select().single()
      data = retry.data; error = retry.error
      if (!error) setError(L.selfJoinedColMsg)
    }
    if (error) { setError(L.errGuestAdd + error.message); return }
    setNewGuest("")
    await loadAll(group.id)
    return data as Participant
  }

  // Voegt een gast toe via de nieuwe flow: aantal personen + naam per persoon.
  // Een koppel wordt één plaats met beide namen ("Els & Tom") en seats = 2 — zij betalen samen.
  const setSeats = async (pid: string, n: number) => {
    if (!group) return
    if (group.finalized) { setToast(isAdmin ? L.finalizedReopenFirst : L.finalizedAskAdmin); return }
    const val = Math.max(1, n)
    const current = Math.max(1, participants.find((p) => p.id === pid)?.seats ?? 1)
    if (val === current) return
    const hasClaims = claims.some((c) => c.participant_id === pid && c.quantity > 0)
    if (hasClaims && !confirm(L.confirmSeatsChange)) return
    setParticipants((cur) => cur.map((p) => p.id === pid ? { ...p, seats: val } : p))
    if (hasClaims) setClaims((cur) => cur.filter((c) => c.participant_id !== pid))
    if (hasClaims) await supabase.from("table_claims").delete().eq("group_id", group.id).eq("participant_id", pid)
    const { error } = await supabase.from("table_participants").update({ seats: val }).eq("id", pid)
    if (error && /seats/.test(error.message || "")) { setError(L.seatsSaveMsg); return }
    // Houd het totaal kloppend: een plaats die voor 2 telt, "eet" een vrije plaats op.
    // Zo blijft de som van alle personen gelijk aan het getal in de teller.
    const delta = val - current
    if (delta > 0) {
      const isFree = (p: Participant) => (new RegExp(`^${L.guestWord}\\s*\\d+$`, "i").test(p.name.trim()) || p.name.trim() === L.adminName)
        && p.id !== pid && p.id !== meId && !claims.some((c) => c.participant_id === p.id && c.quantity > 0)
      const spare = participants.filter(isFree).slice(-delta)
      for (const sp of spare) await supabase.from("table_participants").delete().eq("id", sp.id)
      if (spare.length > 0) setToast(L.seatFreedUp)
    }
    await loadAll(group.id)
    if (hasClaims) setToast(L.seatsChanged)
  }

  const seatsOf = (pid: string) => Math.max(1, participants.find((p) => p.id === pid)?.seats ?? 1)

  const finalizeBill = async (on: boolean) => {
    if (!group) return
    setGroup((cur) => cur ? { ...cur, finalized: on, disputed_by: on ? cur.disputed_by : null } : cur)
    const patch = on ? { finalized: true } : { finalized: false, disputed_by: null }
    const { error } = await supabase.from("table_groups").update(patch).eq("id", group.id)
    if (error && /finalized|disputed_by/.test(error.message || "")) {
      setError(L.finalizeColsMsg)
      return
    }
    await loadAll(group.id)
    setToast(on ? L.billClosedToast : L.billReopenedToast)
    if (on) setAdminFinalPopup(true)
  }

  const flagDispute = async (name: string, on: boolean, comment = "") => {
    if (!group) return
    const cur = parseDisputes(group.disputed_by || "").filter((d) => d.name !== name)
    const next = on ? [...cur, { name, comment: comment.trim(), resolved: false }] : cur
    const val = serializeDisputes(next)
    setGroup((g) => g ? { ...g, disputed_by: val } : g)
    const { error } = await supabase.from("table_groups").update({ disputed_by: val }).eq("id", group.id)
    if (error) { setError(L.errPing); return }
    await loadAll(group.id)
  }

  const resolveDispute = async (name: string, resolved: boolean) => {
    if (!group) return
    const next = parseDisputes(group.disputed_by || "").map((d) => d.name === name ? { ...d, resolved } : d)
    const val = serializeDisputes(next)
    setGroup((g) => g ? { ...g, disputed_by: val } : g)
    const { error } = await supabase.from("table_groups").update({ disputed_by: val }).eq("id", group.id)
    if (error) { setError(L.errUpdate); return }
    await loadAll(group.id)
  }

  // Een plaats is "vrij" zolang niemand er zijn naam op zette (naam is nog "Gast N" of "Ik").
  // De organisator is de eerste deelnemer: die plaats mag niemand overnemen via de link.
  const ownerPid = participants[0]?.id ?? null
  const isFreeSpot = (p: Participant) => new RegExp(`^${L.guestWord}\\s*\\d+$`, "i").test(p.name.trim()) || p.name.trim() === L.adminName

  // Neemt de gekozen plaats over: zet de naam (of namen, bij een koppel) en het aantal personen.
  const confirmClaimSpot = async () => {
    if (!group || !claimSpot) return
    const names = claimNames.slice(0, claimSeats).map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) { setToast(L.enterYourName); return }
    const finalName = names.join(" & ")
    await supabase.from("table_participants").update({ name: finalName, seats: claimSeats, self_joined: true }).eq("id", claimSpot)
    pickMe(claimSpot)
    setClaimSpot(null); setClaimSeats(1); setClaimNames([""])
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


  // Hernummer naamloze gasten ("Gast N") naar hun positie, zodat er geen gaten ontstaan na verwijderen.
  const renumberGuests = async (): Promise<boolean> => {
    if (!group) return
    const { data } = await supabase.from("table_participants").select("*").eq("group_id", group.id)
    const isPh = (nm?: string) => /^(Gast|Invité) \d+$/.test(nm || "")
    const ordered = [...((data as Participant[]) || [])].sort((a, b) => {
      const pa = isPh(a.name) ? 1 : 0, pb = isPh(b.name) ? 1 : 0
      if (pa !== pb) return pa - pb
      const ca = a.created_at ?? "", cb = b.created_at ?? ""
      if (ca !== cb) return ca < cb ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    let changed = false
    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i]
      if (isPh(g.name)) {
        const expected = `${L.guestWord} ${i + 1}`
        if (g.name !== expected) { changed = true; await supabase.from("table_participants").update({ name: expected }).eq("id", g.id) }
      }
    }
    return changed
  }

  // Bij het openen van de Gasten-tab: naamloze gasten netjes hernummeren (repareert ook bestaande groepen).
  useEffect(() => {
    if (!isAdmin || adminTab !== "guests" || !group) return
    ;(async () => { if (await renumberGuests()) await loadAll(group.id) })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab, group?.id])

  const removeGuest = async (id: string) => {
    if (!group) return
    if (!confirm(L.confirmDeleteGuest)) return
    await supabase.from("table_claims").delete().eq("group_id", group.id).eq("participant_id", id)
    await supabase.from("table_confirmations").delete().eq("group_id", group.id).eq("participant_id", id)
    await supabase.from("table_participants").delete().eq("id", id)
    if (meId === id) { setMeIdStored(group.id, null); setMeId(null) }
    await renumberGuests()
    await loadAll(group.id)
  }

  // Zet het aantal gasten in één beweging. Omhoog = extra gasten aanmaken.
  // Omlaag = de laatste gast verwijderen, met waarschuwing als die al items aantikte.
  // Aantal PERSONEN in de groep (niet aantal plaatsen): een koppel is één plaats maar telt voor twee.
  // Zo blijft de som van alle personen altijd gelijk aan het getal in de teller.
  const totalPersons = participants.reduce((a, p) => a + Math.max(1, p.seats ?? 1), 0)

  // Heeft de admin zichzelf al een naam gegeven? Zonder naam mag hij niet delen of toewijzen.
  const adminNamed = (() => {
    const me = participants.find((x) => x.id === meId) || participants[0]
    if (!me) return false
    const nm = me.name.trim()
    return !(new RegExp(`^${L.guestWord}\\s*\\d+$`, "i").test(nm) || nm === L.adminName || nm === "")
  })()
  const requireName = (): boolean => {
    if (adminNamed) return true
    setToast(L.nameRequired)
    // Het naamveld staat op de gasten-tab: kom je van elders, stuur er dan eerst naartoe.
    setAdminTab("guests")
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const el = document.getElementById("own-name")
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
        ;(el as HTMLInputElement | null)?.focus()
      }, 120)
    }
    return false
  }

  // Status per plaats: heeft aangeduid / aangemeld maar niets / nog vrij / door admin geregeld.
  const spotStatus = (p: Participant): { kind: "done" | "idle" | "free" | "mine"; count: number } => {
    const count = claims.filter((c) => c.participant_id === p.id && c.quantity > 0).length
    const nm = p.name.trim()
    const isFree = new RegExp(`^${L.guestWord}\\s*\\d+$`, "i").test(nm) || nm === L.adminName
    if (isFree) return { kind: "free", count }
    if (count > 0) return { kind: "done", count }
    if (p.self_joined) return { kind: "idle", count }
    return { kind: "mine", count }
  }
  const joinedCount = participants.filter((p) => spotStatus(p).kind !== "free").length

  // Overzicht "Wie doet al mee?" — op de gasten-tab ingeklapt, op de toewijs-tab open.
  const joinedList = (opts: { clickable?: boolean } = {}) => (
    <div>
      {participants.map((p) => {
        const st = spotStatus(p)
        const icon = st.kind === "done" ? "✅" : st.kind === "idle" ? "🟡" : st.kind === "free" ? "⚪" : "✍️"
        const right = st.kind === "done" ? L.stAssigned(st.count)
          : st.kind === "idle" ? L.stJoinedNothing
          : st.kind === "free" ? L.stNobody
          : (opts.clickable ? L.stAssignNow : L.stYouHandle)
        const bg = st.kind === "idle" ? "rgba(243,156,18,0.07)" : st.kind === "mine" && opts.clickable ? "rgba(20,153,176,0.06)" : "transparent"
        const clickMine = opts.clickable && st.kind === "mine"
        return (
          <div key={p.id} onClick={() => { if (clickMine) { setClaimMode("person"); setClaimPid(p.id) } }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 6px", borderRadius: 7, background: bg, cursor: clickMine ? "pointer" : "default" }}>
            <span style={{ fontSize: 13 }}>{icon}</span>
            <b style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: st.kind === "free" ? "#9aa0ab" : "#14213a", fontWeight: st.kind === "free" ? 600 : 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.kind === "free" ? L.freeSpot : p.name}</b>
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: st.kind === "idle" ? 800 : 600, color: st.kind === "idle" ? "#b5591a" : clickMine ? "#1499b0" : "#9aa0ab", ...(clickMine ? { border: "1px solid rgba(20,153,176,0.4)", borderRadius: 6, padding: "2px 7px" } : {}) }}>{right}</span>
          </div>
        )
      })}
    </div>
  )

  const setGuestCount = async (target: number) => {
    if (!group) return
    if (group.finalized) { setToast(isAdmin ? L.finalizedReopenFirst : L.finalizedAskAdmin); return }
    const n = Math.max(0, Math.min(30, target))
    const cur = totalPersons
    if (n === cur) return
    if (n > cur) {
      for (let i = 0; i < n - cur; i++) await addGuest(`${L.guestWord} ${participants.length + i + 1}`, false, 1)
      return
    }
    // Verlagen: verwijder de laatste plaats(en) tot het totaal klopt.
    const last = participants[participants.length - 1]
    if (!last) return
    const used = claims.filter((c) => c.participant_id === last.id && c.quantity > 0).length
    if (used > 0 && !confirm(L.confirmRemoveLast(last.name, used))) return
    await supabase.from("table_claims").delete().eq("group_id", group.id).eq("participant_id", last.id)
    await supabase.from("table_confirmations").delete().eq("group_id", group.id).eq("participant_id", last.id)
    await supabase.from("table_participants").delete().eq("id", last.id)
    if (meId === last.id) { setMeIdStored(group.id, null); setMeId(null) }
    await loadAll(group.id)
  }

  const renameGuest = async (id: string, name: string) => {
    if (!group) return
    const finalName = name.trim()
    if (!finalName) return
    setParticipants((cur) => cur.map((p) => p.id === id ? { ...p, name: finalName } : p))
    await supabase.from("table_participants").update({ name: finalName }).eq("id", id)
    await renumberGuests()
    await loadAll(group.id)
  }

  const startRescan = async () => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    const hasItems = items.length > 0
    const hasClaims = claims.length > 0
    if (hasItems || hasClaims) {
      const msg = hasClaims
        ? L.rescanConfirmClaims
        : L.rescanConfirmItems
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
    if (!retryFile) { setToast(L.errNoPhotoRescan); return }
    setShowScan(true)
    onPhotoPicked(retryFile)
  }

  // Voegt een foto toe aan de lijst (max 2: bovenste + onderste helft van een lange rekening).
  const addPhoto = (file: File | undefined) => {
    if (!file) return
    setScanFail(null)
    setPhotos((cur) => (cur.length >= 2 ? cur : [...cur, { file, url: URL.createObjectURL(file) }]))
  }
  const removePhoto = (idx: number) => {
    setPhotos((cur) => {
      const p = cur[idx]
      if (p) URL.revokeObjectURL(p.url)
      return cur.filter((_, i) => i !== idx)
    })
  }

  // Leest alle verzamelde foto's uit en plakt de items aan elkaar.
  // Eén druk op de knop = één scan, ook al zijn het twee foto's (het blijft één rekening).
  const scanPhotos = async () => {
    if (photos.length === 0 || !group) return
    setScanFail(null); setScanPreview([]); setScanProgress(0); setScanning(true)
    setScanFile(photos[0].file); setRetryFile(photos[0].file)
    if (scanPhotoUrl) URL.revokeObjectURL(scanPhotoUrl)
    setScanPhotoUrl(photos[0].url)
    setScanStep(photos.length > 1 ? { i: 1, n: photos.length } : null)

    // Alle foto's gaan in ÉÉN AI-oproep: zo ziet het model de hele bon en herkent het
    // de overlap tussen de stukken zelf (geen dubbele items, juiste volgorde, één totaal).
    const res = await scanReceipt(photos.map((p) => p.file), (pr) => setScanProgress(pr))

    setScanStep(null); setScanning(false)
    if (!res.items || res.items.length === 0) {
      const reason = res.reason ?? "empty"
      if (reason === "unavailable") setCooldownUntil(Date.now() + 30 * 1000)
      if (photos.length > 1) setMultiFails((n) => n + 1)
      setScanFail({ reason, status: res.status, detail: res.detail })
      return
    }
    setMultiFails(0)
    setScanSource("ai")
    await confirmScan(res.items, res.total != null ? res.total.toFixed(2).replace(".", ",") : "", photos.map((p) => p.file))
    for (const ph of photos) URL.revokeObjectURL(ph.url)
    setPhotos([])
  }

  const onPhotoPicked = async (file: File | undefined) => {
    if (!file) return
    setScanFail(null); setScanPreview([]); setScanProgress(0); setScanning(true)
    setScanFile(file); setRetryFile(file)
    if (scanPhotoUrl) URL.revokeObjectURL(scanPhotoUrl)
    setScanPhotoUrl(URL.createObjectURL(file))
    const res = await scanReceipt(file, (pr) => setScanProgress(pr))
    setScanning(false)
    if (!res.items || res.items.length === 0) {
      const reason = res.reason ?? "empty"
      if (reason === "unavailable") setCooldownUntil(Date.now() + 30 * 1000)
      setScanFail({ reason, status: res.status, detail: res.detail })
      return
    }
    setScanSource("ai")
    await confirmScan(res.items, res.total != null ? res.total.toFixed(2).replace(".", ",") : "", file)
  }

  // Alleen als de gebruiker er zelf voor kiest: de snelle, minder nauwkeurige lokale scan.
  const runLocalScan = async () => {
    const file = retryFile ?? scanFile
    if (!file) { setToast(L.errNoPhoto); return }
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
  // Vanuit de rode "onnauwkeurige scan"-melding: opnieuw met AI en, als dat lukt, alles vervangen.
  const improveWithAi = async () => {
    const file = retryFile ?? scanFile
    if (!file || !group) { setToast(L.errNoPhotoRescan); return }
    setShowScan(true); setScanFail(null); setScanPreview([]); setScanProgress(0); setScanning(true)
    const res = await scanReceipt(file, (pr) => setScanProgress(pr))
    setScanning(false)
    if (!res.items || res.items.length === 0) {
      const reason = res.reason ?? "empty"
      if (reason === "unavailable") setCooldownUntil(Date.now() + 30 * 1000)
      setScanFail({ reason, status: res.status, detail: res.detail })
      return // AI mislukt -> de huidige (lokale) items blijven gewoon staan
    }
    // AI gelukt -> vervang alles: oude items + toewijzingen wissen, dan de AI-items toevoegen
    await supabase.from("table_claims").delete().eq("group_id", group.id)
    await supabase.from("table_items").delete().eq("group_id", group.id)
    setScanSource("ai")
    await confirmScan(res.items, res.total != null ? res.total.toFixed(2).replace(".", ",") : "", null)
  }

  const confirmScan = async (previewArg?: ParsedItem[], totalArg?: string, fileArg?: File | File[] | null) => {
    const preview = previewArg ?? scanPreview
    const totalStr = totalArg ?? scanTotal
    const file = fileArg !== undefined ? fileArg : scanFile
    if (!group || preview.length === 0) return
    setReceiptConfirmed(false); setReceiptEditing(false)
    let receiptUrl = group.receipt_url ?? null
    // Meerdere foto's (stukken van dezelfde bon): elk apart bewaren en de URL's samen
    // opslaan, gescheiden door een spatie. Zo kan je ze later allemaal bekijken.
    const fileList: File[] = file ? (Array.isArray(file) ? file : [file]) : []
    if (fileList.length > 0) {
      const urls: string[] = []
      for (const f of fileList) {
        const uploadBlob = await fileToScaledBlob(f)
        const ext = uploadBlob === (f as Blob) ? ((f.name.split(".").pop() || "jpg").toLowerCase()) : "jpg"
        const path = `${group.id}/${Date.now()}-${urls.length}.${ext}`
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, uploadBlob, { upsert: true })
        if (upErr) { setToast(L.errPhotoSave) }
        else urls.push(supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl)
      }
      if (urls.length > 0) {
        receiptUrl = urls.join(" ")
        const { error: urlErr } = await supabase.from("table_groups").update({ receipt_url: receiptUrl }).eq("id", group.id)
        if (urlErr) setError(L.errPhotoSaveGroup + urlErr.message)
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
    if (baseRes.error) { setError(L.errItemsSave + baseRes.error.message); return }
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
      if (taxRes.error) { setError(L.errTaxSave + taxRes.error.message); return }
    }
    if (columnMissing) setError(L.distributeColTaxMsg)
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
    setToast(totalOk ? L.scanTotalOk : L.itemsAddedCheck(rows.length))
  }

  const addManualItem = async () => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    const { error } = await supabase.from("table_items")
      .insert([{ group_id: group.id, name: "Nieuw item", unit_price: 0, quantity: 1, is_shared: false, category: null }])
    if (error) { setError(L.errItemAdd); return }
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
    if (error) { setError(L.errItemAdd); return }
    setNewItem(null)
    await loadAll(group.id)
    if (data?.id) { setRecentItemId(data.id); setTimeout(() => setRecentItemId(null), 6000) }
  }

  const confirmTaxModal = async (scope: "all" | "items") => {
    if (group?.finalized) { setToast(L.reopenFirst); return }
    if (!group || !taxModal) return
    const amt = parseFloat((taxModal.amount || "").replace(",", ".")) || 0
    const name = taxModal.name.trim() || L.taxDefaultName
    const dist = scope === "items" && taxModal.ids.length > 0 ? JSON.stringify(taxModal.ids) : "all"
    const { error } = await supabase.from("table_items").insert([{ group_id: group.id, name, unit_price: amt, quantity: 1, is_shared: false, category: null, distribute: dist }])
    if (error) {
      if (/distribute/.test(error.message || "")) setError(L.distributeColMsg)
      else setError(L.errAdd + error.message)
      return
    }
    setTaxModal(null)
    await loadAll(group.id)
  }

  const addTaxItem = async (rate?: number) => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    const name = rate ? L.taxRateName(rate) : L.taxDefaultName
    const row: Record<string, unknown> = { group_id: group.id, name, unit_price: 0, quantity: 1, is_shared: false, category: null, distribute: "all" }
    if (rate) row.tax_rate = rate
    let { error } = await supabase.from("table_items").insert([row])
    if (error && /tax_rate/.test(error.message || "")) {
      const retry = await supabase.from("table_items").insert([{ group_id: group.id, name, unit_price: 0, quantity: 1, is_shared: false, category: null, distribute: "all" }])
      error = retry.error
      if (!error) setError(L.taxRateColMsg2)
    }
    if (error) {
      if (/distribute/.test(error.message || "")) setError(L.distributeColMsg)
      else setError(L.errTaxAdd + error.message)
      return
    }
    await loadAll(group.id)
  }

  const setReceiptTotal = async (val: number | null) => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    setGroup((g) => g ? { ...g, receipt_total: val } : g)
    const { error } = await supabase.from("table_groups").update({ receipt_total: val }).eq("id", group.id)
    if (error) setError(L.errTotalSave + error.message)
  }
  const setTaxRate = async (it: BillItem, rate: number | null) => {
    if (!group) return
    const patch: Record<string, unknown> = { tax_rate: rate }
    if (rate) patch.name = L.taxRateName(rate)
    const { error } = await supabase.from("table_items").update(patch).eq("id", it.id)
    if (error && /tax_rate/.test(error.message || "")) { setError(L.taxRateColMsg); return }
    await loadAll(group.id)
  }

  const setDistribute = async (it: BillItem, val: string) => {
    if (!group) return
    await supabase.from("table_items").update({ distribute: val }).eq("id", it.id)
    await loadAll(group.id)
  }

  const saveItem = async () => {
    if (!group || !editItem) return
    if (group.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    const { error } = await supabase.from("table_items").update({
      name: editItem.name, unit_price: editItem.unit_price,
      quantity: editItem.quantity, is_shared: editItem.is_shared,
    }).eq("id", editItem.id)
    if (error) { setError(L.errSave); return }
    setEditItem(null); await loadAll(group.id)
  }

  const toggleShared = async (it: BillItem) => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    if (it.share_fixed && !isAdmin) { setToast(L.shareLocked); return }
    // Omzetten verandert de betekenis van bestaande toewijzingen; daarom eerst bevestigen.
    const hasClaims = claims.some((c) => c.item_id === it.id && c.quantity > 0)
    if (hasClaims) { setShareConfirm(it); return }
    await applyToggleShared(it)
  }
  const applyToggleShared = async (it: BillItem) => {
    if (!group) return
    // Toewijzingen van dit item wissen: "2 stuks" betekent iets anders dan "deelt mee met 2".
    await supabase.from("table_claims").delete().eq("group_id", group.id).eq("item_id", it.id)
    await supabase.from("table_items").update({ is_shared: !it.is_shared, share_fixed: false }).eq("id", it.id)
    await loadAll(group.id)
  }

  const addTip = async () => {
    if (group?.finalized) { setToast(L.reopenFirst); return }
    if (!group) return
    const amt = parseFloat((tipInput || "").replace(",", ".")) || 0
    if (amt <= 0) { setToast(L.enterTipFirst); return }
    const { error } = await supabase.from("table_items").insert([{ group_id: group.id, name: "Fooi", unit_price: amt, quantity: 1, is_shared: false, category: null, distribute: "all" }])
    if (error) {
      if (/distribute/.test(error.message || "")) setError(L.distributeColMsg)
      else setError(L.errTipAdd + error.message)
      return
    }
    setTipInput("")
    await loadAll(group.id)
  }

  const deleteItem = async (id: string) => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    if (!confirm(L.confirmDeleteItem)) return
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

  // members = welke leden van een meerpersoonsplaats meedelen, bv. "1" (enkel de tweede naam)
  const setClaim = async (itemId: string, pid: string, qty: number, members?: number[] | null) => {
    if (!group) return
    if (group.finalized) { setToast(isAdmin ? L.finalizedReopenFirst : L.finalizedAskAdmin); return }
    const existing = claims.find((c) => c.item_id === itemId && c.participant_id === pid)
    const mem = members && members.length > 0 ? members.slice().sort((a, b) => a - b).join(",") : null
    if (qty <= 0) {
      if (existing) await supabase.from("table_claims").delete().eq("id", existing.id)
    } else if (existing) {
      await supabase.from("table_claims").update({ quantity: qty, members: mem }).eq("id", existing.id)
    } else {
      await supabase.from("table_claims").insert([{ group_id: group.id, item_id: itemId, participant_id: pid, quantity: qty, members: mem }])
    }
    await loadAll(group.id)
  }

  const toggleShareClaim = async (itemId: string, pid: string) => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    const mine = myQty(itemId, pid)
    // Start altijd op 1 persoon. Vertegenwoordig je er meer, dan vraagt de app expliciet
    // hoeveel van jullie meedeelden — zo betaal je nooit ongemerkt voor twee.
    await setClaim(itemId, pid, mine > 0 ? 0 : 1)
  }

  const shareHeads = (itemId: string) =>
    claims.filter((c) => c.item_id === itemId && c.quantity > 0).reduce((s, c) => s + c.quantity, 0)

  // Welke leden van een meerpersoonsplaats meedelen aan dit item (indexen, bv. [1] = enkel de tweede naam).
  const claimMembers = (itemId: string, pid: string): number[] => {
    const c = claims.find((x) => x.item_id === itemId && x.participant_id === pid)
    if (!c || c.quantity <= 0) return []
    if (c.members) return c.members.split(",").map((x) => parseInt(x, 10)).filter((x) => !isNaN(x))
    return Array.from({ length: c.quantity }, (_, i) => i)
  }

  const myShareHeads = (itemId: string, pid: string) =>
    claims.filter((c) => c.item_id === itemId && c.participant_id === pid).reduce((s, c) => s + c.quantity, 0)

  const setShareFixed = async (it: BillItem, val: boolean) => {
    if (group?.finalized) { setToast(isAdmin ? L.reopenFirst : L.finalizedAskAdmin); return }
    if (!group) return
    await supabase.from("table_items").update({ share_fixed: val }).eq("id", it.id)
    await loadAll(group.id)
  }

  const itemTotal = (it: BillItem) => it.unit_price * it.quantity

  const isTax = (it: BillItem) => it.distribute != null && it.distribute !== ""
  const isTip = (it: BillItem) => it.name.trim().toLowerCase() === "fooi"
  const baseItems = items.filter((it) => !isTax(it))
  const taxItems = items.filter((it) => isTax(it) && !isTip(it))
  const tipTotal = items.filter((it) => isTip(it)).reduce((s, it) => s + itemTotal(it), 0)

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
  // Controleert of een gedeeld item genoeg delers heeft.
  // "warn" = niemand duidde aan, of minder dan het verwachte aantal, of slechts één persoon.
  const sharedStatus = (it: BillItem): { heads: number; expected: number | null; warn: null | "none" | "few" | "one" } => {
    const heads = shareHeads(it.id)
    const expected = it.share_expected ?? null
    if (heads === 0) return { heads, expected, warn: "none" }
    if (expected != null && expected > 0 && heads < expected) return { heads, expected, warn: "few" }
    if (heads === 1) return { heads, expected, warn: "one" }
    return { heads, expected, warn: null }
  }
  const setShareExpected = async (itemId: string, n: number | null) => {
    if (!group) return
    await supabase.from("table_items").update({ share_expected: n }).eq("id", itemId)
    await loadAll(group.id)
  }

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

  const personTotalNoTip = (pid: string): { settled: number; pendingShared: boolean } => {
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

  const tipShare = (pid: string): number => {
    if (tipTotal <= 0) return 0
    const has = (q: string) => baseItems.some((it) => it.is_shared ? sharerIds(it.id).includes(q) : myQty(it.id, q) > 0)
    if (!has(pid)) return 0
    const n = participants.filter((q) => has(q.id)).length
    return n > 0 ? tipTotal / n : 0
  }

  const personTotal = (pid: string): { settled: number; pendingShared: boolean } => {
    const b = personTotalNoTip(pid)
    return { settled: b.settled + tipShare(pid), pendingShared: b.pendingShared }
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
    const tip = tipShare(pid)
    if (tip > 0.005) out.push({ name: `💛 ${L.tipItemName}`, qty: 1, amount: tip, shared: false, revealed: true, sharers: 0, myHeads: 0 })
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
    if (explicitConfirmed(pid)) return { label: L.statusConfirmed, color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
   if (hasAssignment(pid)) {
      const p = participants.find((x) => x.id === pid)
      const billFullyAssigned = openUnits === 0 && undecidedShared.length === 0
      if (p && !p.self_joined && billFullyAssigned) return { label: L.statusConfirmed, color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
      return { label: L.statusBusy, color: "#1499b0", bg: "rgba(90,108,166,0.12)" }
    }
    return { label: L.statusNothing, color: "#9aa0ab", bg: "rgba(16,24,40,0.05)" }
  }

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowTs) / 1000))
  const billTotal = items.filter((it) => !isTip(it)).reduce((s, it) => s + itemTotal(it), 0)
  const billOk = (group?.receipt_total ?? null) != null && Math.abs((group?.receipt_total ?? 0) - billTotal) < 0.005
  const goGuests = () => { if (billOk) setAdminTab("guests"); else setShowShareWarn(true) }
  const openUnits = baseItems.filter((it) => !it.is_shared)
    .reduce((s, it) => s + Math.max(0, it.quantity - claimedQty(it.id)), 0)
  const undecidedShared = baseItems.filter((it) => it.is_shared && sharerIds(it.id).length === 0)
  const sharedWarnings = baseItems.filter((it) => it.is_shared && sharedStatus(it).warn !== null)
  const zeroPriceItems = baseItems.filter((it) => it.unit_price <= 0.0001)
  const allAssignedNow = openUnits === 0 && undecidedShared.length === 0 && sharedWarnings.length === 0 && zeroPriceItems.length === 0
  const tipItem = items.find((i) => i.name.trim().toLowerCase() === "fooi") || null
  const hasTip = !!tipItem

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <button onClick={goToChooser} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#8a93a8", background: "none", border: "none", padding: 0, cursor: "pointer" }}>{L.backToRundo}</button>
            <LanguageToggle compact />
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-symbol.png" alt="" style={{ height: 52, width: "auto", objectFit: "contain", display: "block" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rundo-table-logo-dark.png" alt="Rundo Table" style={{ height: 34, width: "auto", objectFit: "contain", display: "block" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, margin: "0 0 24px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-table.png" alt="" style={{ height: 20, width: "auto", objectFit: "contain", display: "block" }} />
            <span style={{ color: "#1499b0", fontSize: 14.5, fontWeight: 700 }}>{L.tableTagline}</span>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 13, color: "#5a6680", fontWeight: 600, marginBottom: 6 }}>{L.groupName} <span style={{ color: "#c0392b" }}>*</span></div>
            <input value={groupName} onChange={(e) => { setStartError(null); setGroupName(e.target.value) }} onKeyDown={(e) => e.key === "Enter" && createGroup()} placeholder="" style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 14 }} />
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 16, fontWeight: 700 }} onClick={createGroup} disabled={busy}>{busy ? L.loading : L.startGroup}</button>
          </div>

          {startError && (
            <div style={{ marginTop: 4, color: "#c0392b", fontSize: 13, background: "#fff0f0", borderRadius: 10, padding: "10px 12px" }}>⚠️ {startError}</div>
          )}

          {myGroups.length > 0 && (
            <div style={{ ...S.card, marginTop: 14 }}>
              <div onClick={() => setShowSaved((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#3b486a" }}>{L.savedGroups} <span style={{ color: "#9aa0ab", fontWeight: 700 }}>({myGroups.length})</span></span>
                <span style={{ fontSize: 12, color: "#9aa0ab", fontWeight: 700 }}>{showSaved ? L.hide : L.show}</span>
              </div>
              {showSaved && (
                <div style={{ marginTop: 10 }}>
                  {myGroups.map((g) => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <button onClick={() => openSavedGroup(g.id)} disabled={busy} style={{ ...S.btn, flex: 1, minWidth: 0, textAlign: "left", padding: "11px 13px", fontWeight: 700 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: g.role === "admin" ? "#1499b0" : "#9aa0ab" }}>{g.role === "admin" ? L.roleAdmin : L.roleGuest}{fmtDate(g.created_at ?? g.savedAt, lang) ? ` · ${fmtDate(g.created_at ?? g.savedAt, lang)}` : ""}</span>
                      </button>
                      <button onClick={() => forgetSavedGroup(g.id)} style={{ ...S.iconBtn, flexShrink: 0 }} title={L.deletePermanently}>🗑️</button>
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
            {claimSpot === null ? (
              <>
                <h3 style={S.h3}>{L.whoAreYou}</h3>
                <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 14 }}>{L.pickFreeSpot}</p>

                {participants.map((p) => {
                  // De admin-plaats is van de organisator: die mag niemand overnemen.
                  const isAdminSpot = p.id === ownerPid
                  const free = !isAdminSpot && isFreeSpot(p)
                  const clickable = !isAdminSpot
                  return (
                    <button key={p.id} disabled={!clickable}
                      onClick={() => { if (!clickable) return; if (free) { setClaimSpot(p.id); setClaimSeats(Math.max(1, p.seats ?? 1)); setClaimNames([""]) } else pickMe(p.id) }}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", marginBottom: 7, cursor: clickable ? "pointer" : "default", borderRadius: 11, padding: "11px 12px",
                        border: free ? "1.5px dashed rgba(20,153,176,0.6)" : "1px solid rgba(16,24,40,0.12)",
                        opacity: clickable ? 1 : 0.75,
                        background: free ? "rgba(20,153,176,0.05)" : "rgba(16,24,40,0.02)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: free ? "#1499b0" : "#14213a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{free ? L.freeSpotLabel : p.name}</span>
                        {isAdminSpot && <span style={{ flexShrink: 0, color: "#c0392b", fontWeight: 800, fontSize: 13 }}>*</span>}
                        {!free && !isAdminSpot && (p.seats ?? 1) > 1 && <span style={{ fontSize: 11, fontWeight: 700, color: "#9aa0ab" }}>· {p.seats}p.</span>}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isAdminSpot ? "#9aa0ab" : free ? "#1499b0" : "#9aa0ab", flexShrink: 0 }}>{isAdminSpot ? L.adminSpotLabel : free ? L.tapToPick : L.imThisOne}</span>
                    </button>
                  )
                })}

                <button onClick={async () => { const p = await addGuest(undefined, true, 1); if (p) { setClaimSpot(p.id); setClaimSeats(1); setClaimNames([""]) } }}
                  style={{ width: "100%", marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: "#5a6680", textDecoration: "underline", padding: "6px 0" }}>{L.addExtraSpot}</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#14213a", marginBottom: 4, lineHeight: 1.35 }}>{L.howManyPersons}</div>
                <div style={{ fontSize: 12, color: "#9aa0ab", lineHeight: 1.5, marginBottom: 10 }}>{L.payTogetherShort}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[1, 2, 3].map((n) => {
                    const on = n === 3 ? claimSeats >= 3 : claimSeats === n
                    const label = n === 1 ? L.onePerson : n === 2 ? L.twoPersons : L.threePlus
                    return (
                      <button key={n} onClick={() => { const v = n === 3 ? Math.max(3, claimSeats) : n; setClaimSeats(v); setClaimNames((cur) => Array.from({ length: v }, (_, i) => cur[i] ?? "")) }}
                        style={{ flex: 1, fontSize: 12.5, fontWeight: 800, padding: "10px 4px", borderRadius: 10, cursor: "pointer", color: "#14213a", background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff", border: on ? "1.5px solid transparent" : "1.5px solid rgba(16,24,40,0.15)" }}>{label}</button>
                    )
                  })}
                </div>
                {claimSeats >= 3 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 12 }}>
                    <button onClick={() => { const v = Math.max(3, claimSeats - 1); setClaimSeats(v); setClaimNames((c) => c.slice(0, v)) }} style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 17 }}>−</button>
                    <b style={{ fontSize: 16, color: "#14213a" }}>{claimSeats}</b>
                    <button onClick={() => { const v = Math.min(8, claimSeats + 1); setClaimSeats(v); setClaimNames((c) => Array.from({ length: v }, (_, i) => c[i] ?? "")) }} style={{ ...S.iconBtn, width: 30, height: 30, fontSize: 17, background: "rgba(27,42,74,0.12)" }}>+</button>
                  </div>
                )}

                <div style={{ fontSize: 15, fontWeight: 800, color: "#14213a", marginBottom: 8 }}>{claimSeats > 1 ? L.yourNamesQ : L.yourNameQ}</div>
                {Array.from({ length: claimSeats }, (_, i) => i).map((i) => (
                  <input key={i} value={claimNames[i] ?? ""} onChange={(e) => setClaimNames((c) => { const n = [...c]; n[i] = e.target.value; return n })}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmClaimSpot() }}
                    placeholder={claimSeats === 1 ? L.namePlaceholder : i === 0 ? L.firstName : i === 1 ? L.secondName : L.extraName(i + 1)}
                    style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 7 }} autoFocus={i === 0} />
                ))}
                {claimSeats > 1 && claimNames.filter((n) => n.trim()).length > 0 && (
                  <div style={{ fontSize: 11, color: "#9aa0ab", marginBottom: 10 }}>{L.showsAsOne} <b style={{ color: "#14213a" }}>{claimNames.filter((n) => n.trim()).join(" & ")}</b></div>
                )}

                <button onClick={confirmClaimSpot} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 15, fontWeight: 800, marginTop: 4 }}>{claimSeats > 1 ? L.thatsUs : L.thatsMe}</button>
                <button onClick={() => setClaimSpot(null)} style={{ width: "100%", marginTop: 8, background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#9aa0ab" }}>{L.backToSpots}</button>
              </>
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
          {L.sleepBanner}
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
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{L.finalizedTitle}</div>
                <div style={{ fontSize: 12, opacity: 0.92 }}>{L.finalizedBy}{isAdmin ? L.finalizedAdminNote : L.finalizedGuestNote}</div>
              </div>
            </div>
            {isAdmin && disputers.length > 0 && (
              <div style={{ marginTop: 10, background: "#fff7e6", border: "1.5px solid #f0b840", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#8a5a00" }}>
                <div style={{ fontWeight: 800, marginBottom: 6, color: "#a06b00" }}>{openCount > 0 ? L.remarksOpen : L.remarksDone}</div>
                {disputers.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, opacity: d.resolved ? 0.7 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0, textDecoration: d.resolved ? "line-through" : "none" }}>
                      <b>{d.name}</b>{d.comment ? <span>: “{d.comment}”</span> : ""}
                      {d.resolved && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, color: "#1f8a4c", background: "rgba(39,174,96,0.14)", borderRadius: 6, padding: "1px 6px", textDecoration: "none", display: "inline-block" }}>{L.resolved}</span>}
                    </div>
                    <button onClick={() => resolveDispute(d.name, !d.resolved)} style={{ flexShrink: 0, border: d.resolved ? "1px solid rgba(16,24,40,0.2)" : "none", background: d.resolved ? "#fff" : "linear-gradient(135deg,#1f8a4c,#27ae60)", color: d.resolved ? "#5a6680" : "#fff", borderRadius: 9, padding: "5px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {d.resolved ? L.reopenRemark : L.markResolved}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <button onClick={() => finalizeBill(false)} style={{ marginTop: 10, width: "100%", padding: "10px 0", fontSize: 13.5, fontWeight: 800, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.92)", color: "#1f8a4c", cursor: "pointer" }}>
                {L.reopenBill}
              </button>
            )}
          </div>
        )
      })()}

      {isAdmin && (
        <div style={{ ...S.tabBar, gap: 7, padding: 6, border: "1px solid rgba(20,153,176,0.18)", borderRadius: 16, boxShadow: "0 3px 12px -5px rgba(20,153,176,0.35)" }}>
          {([
            { id: "scan", label: L.tabBon },
            { id: "guests", label: L.tabGuests },
            { id: "overview", label: L.tabAssign },
          ] as { id: AdminTab; label: string }[]).map((t) => (
            <button key={t.id} onClick={() => { if (t.id === "overview" && !requireName()) return; setAdminTab(t.id) }} style={{
              flex: 1, border: "none", borderRadius: 12, padding: "13px 4px", fontSize: 14.5, cursor: "pointer", lineHeight: 1.15,
              fontWeight: adminTab === t.id ? 800 : 700,
              background: adminTab === t.id ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#eaf6f9",
              color: adminTab === t.id ? "#fff" : "#1499b0",
              boxShadow: adminTab === t.id ? "0 3px 10px -3px rgba(20,153,176,0.5)" : "none",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Subtiele bon-preview, in elke tab beschikbaar (behalve op de Bon-tab, die heeft z'n eigen knop) */}
      {group.receipt_url && adminTab !== "scan" && (
        <div style={{ textAlign: "right", marginTop: -6, marginBottom: 10 }}>
          <button onClick={() => setViewReceipt(group.receipt_url!)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1499b0", padding: "2px 4px" }}>{L.viewReceipt}{(group.receipt_url!.split(/\s+/).filter(Boolean).length > 1) ? ` (${group.receipt_url!.split(/\s+/).filter(Boolean).length})` : ""}</button>
        </div>
      )}

      {/* ─── ADMIN: Bon & items ─── */}
      {isAdmin && adminTab === "scan" && (
        <div>
          {group.receipt_url ? (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, marginBottom: 10, marginTop: -4 }}>
              <button onClick={() => setViewReceipt(group.receipt_url!)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#1499b0", padding: "2px 4px" }}>{L.viewReceipt}{(group.receipt_url!.split(/\s+/).filter(Boolean).length > 1) ? ` (${group.receipt_url!.split(/\s+/).filter(Boolean).length})` : ""}</button>
              <button onClick={startRescan} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#9aa0ab", padding: "2px 4px" }}>{L.rescan}</button>
            </div>
          ) : (
            <button onClick={() => setShowScan(true)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "15px 0", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{L.startScan}</button>
          )}

          {/* Scan-label bovenaan: vinkje bij AI-succes; duidelijke waarschuwing + retry bij lokale terugval */}
          {items.length > 0 && scanSource === "ai" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 10px", padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: "rgba(16,24,40,0.04)", border: "1px solid rgba(16,24,40,0.1)", color: "#5a6680" }}>
              <span>{L.scanOk} <span style={{ color: "#1f8a4c", fontWeight: 800 }}>✓</span></span>
            </div>
          )}
          {items.length > 0 && scanSource === "local" && (
            <div style={{ margin: "0 0 10px", padding: "11px 13px", borderRadius: 10, background: "rgba(224,107,94,0.08)", border: "1.5px solid rgba(224,107,94,0.55)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#c0392b", marginBottom: 3 }}>{L.localScanTitle}</div>
              <div style={{ fontSize: 12, color: "#8a4514", lineHeight: 1.5, marginBottom: 9 }}>{L.localScanBody}</div>
              <button onClick={improveWithAi} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "11px 0", fontSize: 13.5, fontWeight: 800 }}>{L.improveAi}</button>
            </div>
          )}

          {/* Bon-totaal: ja/neen blijft altijd beschikbaar. Ja = totaal klopt (items nakijken). Neen = aanpassen + bevestigen. */}
          {items.length > 0 && (() => {
            const entered = group?.receipt_total ?? null
            const match = entered != null && Math.abs(entered - billTotal) < 0.005
            const mismatch = entered != null && !match
            const saveTotal = () => { setReceiptConfirmed(false); const raw = (receiptInputRef.current?.value ?? "").trim().replace(",", "."); if (raw === "") { setReceiptTotal(null); return } const n = parseFloat(raw); if (!isNaN(n) && n >= 0) setReceiptTotal(+n.toFixed(2)) }
            const greenState = !receiptEditing && receiptConfirmed
            const jaBtn = { border: "none", background: "#27ae60", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }
            const neenBtn = { border: "1.5px solid rgba(20,33,58,0.2)", background: "#fff", color: "#5a6680", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }
            const jaNeen = (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <button onClick={() => { setReceiptConfirmed(true); setReceiptEditing(false) }} style={{ ...jaBtn }}>{L.yes}</button>
                <button onClick={() => { setReceiptEditing(true); setReceiptConfirmed(false); setTimeout(() => { receiptInputRef.current?.focus(); receiptInputRef.current?.select() }, 0) }} style={{ ...neenBtn, ...(receiptEditing ? { borderColor: "#1499b0", color: "#1499b0" } : {}) }}>{L.no}</button>
              </span>
            )
            return (
              <div style={{ ...S.card, padding: "11px 14px", marginBottom: 12, background: greenState ? "rgba(39,174,96,0.06)" : mismatch ? "rgba(224,107,94,0.06)" : "#fff", border: greenState ? "1.5px solid rgba(39,174,96,0.45)" : mismatch ? "1.5px solid rgba(224,107,94,0.5)" : "1px solid rgba(16,24,40,0.08)" }}>
                {entered == null ? (
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#5a6680", marginBottom: 8 }}>{L.enterTotalPrefix}€{billTotal.toFixed(2).replace(".", ",")}</span>
                ) : receiptEditing ? (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#14213a", marginBottom: 6 }}>{L.enterCorrectTotal}</span>
                ) : receiptConfirmed ? (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#1f8a4c", marginBottom: 6 }}>{L.totalMatches}</span>
                ) : (
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#14213a", marginBottom: 6 }}>{L.checkTotalPrompt}</span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#9aa0ab" }}>{L.receiptTotalLabel}</span>
                  <input ref={receiptInputRef} type="text" inputMode="decimal" defaultValue={entered != null ? entered.toFixed(2).replace(".", ",") : ""} key={entered ?? "leeg"} placeholder={L.amountPlaceholder}
                    onInput={(e) => { e.currentTarget.value = numFilter(e.currentTarget.value) }}
                    onBlur={saveTotal}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    style={{ ...S.input, width: 100, padding: "6px 9px", fontSize: 16, fontWeight: 700 }} />
                  {greenState && <span title={L.totalConfirmedTitle} style={{ color: "#1f8a4c", fontSize: 22, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                  {receiptEditing && (
                    <button onClick={() => { saveTotal(); setReceiptConfirmed(true); setReceiptEditing(false) }} title={L.confirmAmountTitle} style={{ ...jaBtn }}>{L.confirmAmount}</button>
                  )}
                  {entered != null && jaNeen}
                </div>
                {match && receiptConfirmed && !receiptEditing && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#5a6680", lineHeight: 1.5 }}>
                    {L.checkAllNote}
                  </div>
                )}
                {mismatch && receiptConfirmed && !receiptEditing && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#8a4514", lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>{L.mismatchExplain(billTotal.toFixed(2).replace(".", ","), Math.abs(billTotal - (entered ?? 0)).toFixed(2).replace(".", ","), billTotal > (entered ?? 0), (entered ?? 0).toFixed(2).replace(".", ","))}</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li>{L.checkPrices}</li>
                      <li>{L.checkTax}</li>
                    </ul>
                  </div>
                )}
              </div>
            )
          })()}

          {items.length > 0 && receiptConfirmed && !receiptEditing && group?.receipt_total != null && Math.abs((group.receipt_total ?? 0) - billTotal) < 0.005 && (
            <button onClick={goGuests} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginBottom: 10, padding: "9px 0", fontSize: 13, fontWeight: 800, boxShadow: "0 0 0 2px rgba(39,174,96,0.5), 0 6px 16px -6px rgba(39,174,96,0.6)" }}>{L.allOkGoGuests}</button>
          )}

          {items.length > 0 && (
          <ItemList
            items={baseItems} claimedQty={claimedQty} participants={participants} claimsForItem={claimsForItem}
            sharerIds={sharerIds} shareHeads={shareHeads} toggleShareClaim={toggleShareClaim} setShareFixed={setShareFixed}
            onEdit={setEditItem} onToggleShared={toggleShared} onDelete={deleteItem} onSetExpected={isAdmin ? setShareExpected : undefined} onAddManual={() => openNewItem("bill")} bareBill
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
                          onBlur={(e) => { if (group?.finalized) { setToast(L.reopenFirst); loadAll(group.id); return } supabase.from("table_items").update({ name: e.target.value }).eq("id", t.id).then(() => loadAll(group.id)) }}
                          style={{ ...S.input, flex: 1, minWidth: 0, fontWeight: 700, padding: "8px 10px" }} />
                        {t.tax_rate ? (
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a", whiteSpace: "nowrap" }}>€{taxAmount(t).toFixed(2).replace(".", ",")}</span>
                        ) : (
                          <>
                            <span style={{ color: "#999", fontSize: 13 }}>€</span>
                            <input type="number" step="0.01" defaultValue={t.unit_price ? t.unit_price.toFixed(2) : ""} placeholder="0.00"
                              onBlur={(e) => { if (group?.finalized) { setToast(L.reopenFirst); loadAll(group.id); return } const v = parseFloat(e.target.value.replace(",", ".")) || 0; supabase.from("table_items").update({ unit_price: v, quantity: 1 }).eq("id", t.id).then(() => loadAll(group.id)) }}
                              style={{ ...S.input, width: 78, textAlign: "right", padding: "8px 8px" }} />
                          </>
                        )}
                        <button style={{ ...S.iconBtn, background: open ? "rgba(90,108,166,0.18)" : "rgba(16,24,40,0.05)" }} onClick={() => setTaxConfig(open ? null : t.id)} title={L.taxConfigTitle}>⚙️</button>
                        <button style={S.iconBtn} onClick={() => deleteItem(t.id)} title={L.deleteTitle}>🗑️</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, marginLeft: 25, flexWrap: "wrap" }}>
                        {[6, 12, 21].map((r) => (
                          <button key={r} onClick={() => setTaxRate(t, r)} style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 9, padding: "4px 11px", cursor: "pointer", border: t.tax_rate === r ? "none" : "1px solid rgba(16,24,40,0.14)", background: t.tax_rate === r ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: t.tax_rate === r ? "#fff" : "#5a6680" }}>{r}%</button>
                        ))}
                        <button onClick={() => setTaxRate(t, null)} style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 9, padding: "4px 11px", cursor: "pointer", border: !t.tax_rate ? "none" : "1px solid rgba(16,24,40,0.14)", background: !t.tax_rate ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: !t.tax_rate ? "#fff" : "#5a6680" }}>{L.fixedAmount}</button>
                      </div>
                      <div style={{ fontSize: 10.5, color: "#9aa0ab", marginTop: 4, marginLeft: 25 }}>
                        {t.tax_rate ? `${t.tax_rate}% ` : ""}{L.distributedWord} {overAll ? L.overWholeBillShort : L.overNItems(targetCount)}{L.tapGearToChange}
                      </div>
                      <div style={{ marginLeft: 25, marginTop: 4 }}>
                        <button onClick={() => deleteItem(t.id)} style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#c0685c" }}>{L.removeCosts}</button>
                      </div>
                      {open && (
                        <div style={{ marginLeft: 25, marginTop: 8, padding: 10, borderRadius: 12, background: "#fbfaff", border: "1px solid rgba(90,108,166,0.2)" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 5 }}>{L.howToSplit}</div>
                          <div style={{ display: "flex", gap: 6, marginBottom: overAll ? 0 : 8 }}>
                            <button onClick={() => setDistribute(t, "all")} style={{ flex: 1, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 6px", cursor: "pointer", border: overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: overAll ? "#fff" : "#5a6680" }}>{L.overWholeBill}</button>
                            <button onClick={() => { if (overAll) setDistribute(t, JSON.stringify(baseItems.map((i) => i.id))) }} style={{ flex: 1, fontSize: 12.5, fontWeight: 800, borderRadius: 10, padding: "9px 6px", cursor: "pointer", border: !overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: !overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: !overAll ? "#fff" : "#5a6680" }}>{L.overCertainItems}{!overAll ? ` (${targetCount})` : ""}</button>
                          </div>
                          {!overAll && (() => {
                            let ids: string[] = []
                            try { ids = JSON.parse(t.distribute || "[]") } catch { ids = [] }
                            const allOn = baseItems.length > 0 && baseItems.every((bi) => ids.includes(bi.id))
                            return (
                            <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#a06b00" }}>{L.tapItemsForCost}</div>
                                <button onClick={() => setDistribute(t, allOn ? "[]" : JSON.stringify(baseItems.map((i) => i.id)))} style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 8, padding: "3px 9px", cursor: "pointer", border: "1px solid rgba(90,108,166,0.3)", background: "#fff", color: "#1499b0", whiteSpace: "nowrap", flexShrink: 0 }}>{allOn ? "alles uit" : "alles aan"}</button>
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {baseItems.map((bi) => {
                                  const on = ids.includes(bi.id)
                                  return (
                                    <button key={bi.id} onClick={() => { const next = on ? ids.filter((x) => x !== bi.id) : [...ids, bi.id]; setDistribute(t, JSON.stringify(next)) }}
                                      style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: on ? "none" : "1px solid rgba(16,24,40,0.12)", background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff", color: on ? "#5a4a1a" : "#8b93a8" }}>{on ? "✓ " : "+ "}{showTip(bi.name, L)}</button>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end", marginTop: 8, width: "100%" }}>
                  <button onClick={() => setTaxModal({ name: L.taxDefaultName, amount: "", scope: "all", ids: [] })}
                    style={{ width: "62%", minWidth: 190, background: "rgba(20,153,176,0.12)", color: "#0f7d90", border: "1px solid rgba(20,153,176,0.4)", borderRadius: 12, padding: "11px 10px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{L.taxAddBtn}</button>
                  <button onClick={() => setShowTaxInfo(true)} title={L.explainTooltip}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#5a6680", textDecoration: "underline", padding: 0 }}>ⓘ {L.whatIsThis}</button>
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
          <div style={{ ...S.card, order: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h3 style={{ ...S.h3, marginBottom: 0, minWidth: 0 }}>{L.howManyGroupTitle}</h3>
            </div>
            <div style={{ marginTop: 4, marginBottom: 2, fontSize: 12, color: "#9aa0ab", lineHeight: 1.5 }}>{L.howManyGroupSub}</div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(90,108,166,0.06)", borderRadius: 12, padding: "11px 12px" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>{L.personsWord}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setGuestCount(totalPersons - 1)} disabled={totalPersons <= 0} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(16,24,40,0.05)", color: "#5a6680", fontSize: 20, fontWeight: 800, cursor: totalPersons > 0 ? "pointer" : "default", opacity: totalPersons > 0 ? 1 : 0.4 }}>−</button>
                <b style={{ minWidth: 20, textAlign: "center", fontSize: 19, color: "#14213a" }}>{totalPersons}</b>
                <button onClick={() => setGuestCount(totalPersons + 1)} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(27,42,74,0.12)", color: "#14213a", fontSize: 20, fontWeight: 800, cursor: "pointer" }}>+</button>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(16,24,40,0.08)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#14213a", marginBottom: 3 }}>{L.yourselfFirstTitle} <span style={{ color: "#c0392b" }}>*</span></div>
              <div style={{ fontSize: 12, color: "#5a6680", lineHeight: 1.5, marginBottom: 10 }}>{L.yourselfSub}</div>
              {(() => {
                const me = participants.find((x) => x.id === meId) || participants[0]
                if (!me) return null
                const isPh = new RegExp(`^${L.guestWord}\\s*\\d+$`, "i").test(me.name.trim()) || me.name.trim() === L.adminName
                return (
                  <input id="own-name" key={`self-${me.id}-${me.name}`} defaultValue={isPh ? "" : me.name} placeholder={L.ownNamePlaceholder}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== me.name) renameGuest(me.id, v) }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    style={{ ...S.input, width: "100%", boxSizing: "border-box", border: isPh ? "1.5px solid rgba(192,57,43,0.5)" : "1.5px solid rgba(20,153,176,0.5)", background: isPh ? "rgba(192,57,43,0.03)" : "rgba(20,153,176,0.04)" }} />
                )
              })()}
            </div>

          </div>

          <div style={{ ...S.card, order: 2, border: "1.5px solid rgba(20,153,176,0.4)" }}>
            {(() => {
              const entered = group?.receipt_total ?? null
              const match = entered != null && Math.abs(entered - billTotal) < 0.005
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                    <h3 style={{ ...S.h3, marginBottom: 0 }}>{L.shareStepTitle}</h3>
                    {match && <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "#1f8a4c", background: "rgba(39,174,96,0.12)", border: "1px solid rgba(39,174,96,0.4)", borderRadius: 8, padding: "3px 8px", lineHeight: 1.3 }}>{L.billOkBadge}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#5a6680", lineHeight: 1.55, marginBottom: 13 }}>{L.shareStepSub}</div>
                  {!match && (
                    <div style={{ background: "rgba(224,107,94,0.1)", border: "1px solid rgba(224,107,94,0.55)", borderRadius: 10, padding: "9px 11px", fontSize: 12.5, color: "#b0402f", fontWeight: 700, marginBottom: 12, lineHeight: 1.45 }}>{L.shareBlocked}</div>
                  )}
                </>
              )
            })()}

            {(() => {
              const _base = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "") || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "")
              const link = _base && group ? `${_base}/table?code=${group.invite_code}` : ""
              const invite = group ? L.inviteMessage(group.name, link) : ""
              const doShare = async () => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  try { await navigator.share({ text: invite }); return } catch { /* geannuleerd */ }
                }
                if (navigator.clipboard) navigator.clipboard.writeText(invite)
                setInviteModalText(invite); setShowInviteModal(true)
              }
              return (
                <>
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <div style={{ display: "inline-block", background: "#fff", padding: 10, borderRadius: 14, border: "1px solid rgba(16,24,40,0.1)" }}>
                      <QRCodeSVG value={link} size={130} bgColor="#ffffff" fgColor="#1b2a4a" />
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9aa0ab", marginTop: 7 }}>{L.scanThis}</div>
                  </div>

                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => { if (requireName()) doShare() }} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 800 }}>{L.shareLinkBtn}</button>
                  <div style={{ fontSize: 11, color: "#9aa0ab", textAlign: "center", marginTop: 6, lineHeight: 1.45 }}>{L.shareLinkHint}</div>

                  <div style={{ borderTop: "1px solid rgba(16,24,40,0.08)", marginTop: 11, paddingTop: 10, fontSize: 11.5, color: "#5a6680", lineHeight: 1.5 }}>
                    {L.copyLinkPre}{" "}
                    <span onClick={() => { if (!requireName()) return; if (navigator.clipboard) navigator.clipboard.writeText(invite); setToast(L.toastInviteCopied) }} style={{ fontWeight: 800, color: "#1499b0", textDecoration: "underline", cursor: "pointer" }}>{L.copyLinkAction}</span>{" "}
                    {L.copyLinkPost}
                  </div>
                </>
              )
            })()}
          </div>

          <div style={{ ...S.card, order: 3 }}>
            <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(16,24,40,0.08)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#14213a", marginBottom: 6 }}>{L.whoAssignTitle}</div>
              {adminNamed && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(39,174,96,0.07)", border: "1px solid rgba(39,174,96,0.35)", borderRadius: 9, padding: "8px 10px", marginBottom: 9 }}>
                  <span style={{ fontSize: 13 }}>✅</span>
                  <span style={{ fontSize: 12.5, color: "#14213a" }}><b>{(participants.find((x) => x.id === meId) || participants[0])?.name}</b> — {L.youAlreadyIn}</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: "#5a6680", lineHeight: 1.5, marginBottom: 11 }}>{L.whoAssignSub}</div>
              {!showNames && (
                <>
                  <button onClick={() => { if (requireName()) setShowNames(true) }} style={{ width: "100%", border: "1.5px dashed rgba(27,42,74,0.25)", background: "#fff", borderRadius: 11, padding: "12px 10px", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#5a6680" }}>{L.othersAdd}</button>
                  <div style={{ fontSize: 11, color: "#9aa0ab", marginTop: 9, lineHeight: 1.5 }}>{L.othersRest}</div>
                  <div style={{ fontSize: 11.5, color: "#5a6680", background: "rgba(90,108,166,0.06)", borderRadius: 8, padding: "8px 9px", marginTop: 9, lineHeight: 1.45 }}>{L.whoAssignFoot}</div>
                  {participants.length > 0 && (
                    <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid rgba(16,24,40,0.08)" }}>
                      <button onClick={() => setShowJoined((v) => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: "#14213a" }}>{L.whoJoinedTitle} {showJoined ? "▾" : "▸"}</span>
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "#1499b0", background: "rgba(20,153,176,0.12)", borderRadius: 20, padding: "3px 9px" }}>{L.joinedOf(joinedCount, participants.length)}</span>
                      </button>
                      {showJoined && (
                        <div style={{ marginTop: 9 }}>
                          {joinedList()}
                          <div style={{ fontSize: 11, color: "#5a6680", background: "rgba(90,108,166,0.06)", borderRadius: 8, padding: "8px 9px", marginTop: 8, lineHeight: 1.45 }}>{L.whoJoinedHint}</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {showNames && participants.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9aa0ab" }}>{participants.length} {participants.length === 1 ? L.person : L.persons} {L.editNameHint}</span>
                <button onClick={() => setManageGuests((v) => !v)} style={{ ...S.smallBtn, flexShrink: 0, ...(manageGuests ? { borderColor: "rgba(224,107,94,0.6)", color: "#c0392b", background: "rgba(224,107,94,0.06)" } : {}) }}>{manageGuests ? L.manageDone : L.manageDelete}</button>
              </div>
            )}

            {showNames && (() => {
              const twoCol = participants.length > 5
              const isPlaceholderName = (p: Participant) => new RegExp(`^${L.guestWord}\\s*\\d+$`, "i").test(p.name.trim()) || p.name.trim() === L.adminName
              const splitNames = (p: Participant) => {
                if (isPlaceholderName(p)) return []
                return p.name.split(/\s*&\s*/).map((x) => x.trim()).filter(Boolean)
              }
              // Eén rij kan meerdere personen bevatten (bv. een koppel). Dan tonen we per persoon
              // een naamveld en slaan we ze samen op als "Els & Tom" — zij betalen samen.
              const namesBlock = (p: Participant, fontSize: number) => {
                const seats = Math.max(1, p.seats ?? 1)
                const parts = splitNames(p)
                const commit = (idx: number, val: string) => {
                  const next = Array.from({ length: seats }, (_, i) => (i === idx ? val.trim() : (parts[i] ?? "")))
                  const joined = next.filter(Boolean).join(" & ")
                  if (joined && joined !== p.name) renameGuest(p.id, joined)
                }
                return (
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                    {Array.from({ length: seats }, (_, i) => i).map((i) => (
                      <input key={`${p.id}-${i}-${p.name}`} defaultValue={parts[i] ?? ""}
                        placeholder={p.id === meId && i === 0 ? L.ownNamePlaceholder : seats > 1 ? (i === 0 ? L.firstName : i === 1 ? L.secondName : L.extraName(i + 1)) : (isPlaceholderName(p) ? p.name : L.namePlaceholder)}
                        onBlur={(e) => commit(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                        style={{ width: "100%", border: "none", borderBottom: "1px dashed rgba(16,24,40,0.22)", background: "transparent", fontSize, fontWeight: 600, color: "#14213a", padding: "4px 2px", outline: "none" }} />
                    ))}
                  </div>
                )
              }
              const delBtn = (p: Participant) => (
                <button onClick={() => removeGuest(p.id)} title={L.deleteTitle} style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: "none", background: "rgba(224,107,94,0.14)", color: "#c0392b", fontSize: 15, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>×</button>
              )
              const Row = (p: Participant) => {
                const isMe = p.id === meId
                const origin = p.self_joined
                  ? { label: L.badgeSelf, color: "#1f8a4c", bg: "rgba(39,174,96,0.1)" }
                  : { label: L.badgeAdmin, color: "#1499b0", bg: "rgba(90,108,166,0.12)" }
                const badge = isMe ? { label: `${L.badgeMe} · ${L.adminBadge}`, color: "#0f7d90", bg: "rgba(20,153,176,0.18)" } : origin
                if (twoCol) {
                  return (
                    <div key={p.id} style={{ border: manageGuests ? "1px solid rgba(224,107,94,0.4)" : isMe ? "1px solid rgba(20,153,176,0.4)" : "1px solid rgba(16,24,40,0.08)", borderRadius: 12, padding: "7px 8px", background: manageGuests ? "rgba(224,107,94,0.04)" : isMe ? "rgba(20,153,176,0.07)" : "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {namesBlock(p, 13.5)}
                        <SeatsControl n={Math.max(1, p.seats ?? 1)} onChange={(next) => setSeats(p.id, next)} compact />
                        {manageGuests && delBtn(p)}
                      </div>
                      <div style={{ marginTop: 5 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 7, padding: "1px 6px" }}>{badge.label}</span>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderBottom: "1px solid rgba(0,0,0,0.05)", borderRadius: isMe ? 10 : 0, background: isMe ? "rgba(20,153,176,0.06)" : "transparent" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {namesBlock(p, 15)}
                      <div style={{ marginTop: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 7, padding: "1px 7px" }}>{badge.label}</span>
                      </div>
                    </div>
                    <SeatsControl n={Math.max(1, p.seats ?? 1)} onChange={(next) => setSeats(p.id, next)} compact />
                    {manageGuests && delBtn(p)}
                  </div>
                )
              }
              const isPh = (nm?: string) => /^(Gast|Invité) \d+$/.test(nm || "")
              const displayList = [...participants].sort((a, b) => (isPh(a.name) ? 1 : 0) - (isPh(b.name) ? 1 : 0))
              const gridRows = Math.ceil(displayList.length / 2)
              return (
                <div style={{ marginTop: participants.length > 0 ? 8 : 12 }}>
                  {participants.length === 0
                    ? <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>{L.emptyList}</div>
                    : twoCol
                    ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: `repeat(${gridRows}, auto)`, gridAutoFlow: "column", gap: 6 }}>{displayList.map(Row)}</div>
                    : displayList.map(Row)}
                </div>
              )
            })()}
          </div>
          <button onClick={() => { if (requireName()) setAdminTab("overview") }} style={{ ...S.btn, ...S.btnPrimary, width: "100%", order: 3, marginTop: 14, padding: "13px 0", fontSize: 15, fontWeight: 700 }}>{L.toAssignBtn}</button>
        </div>
      )}

      {/* ─── ADMIN: Stand van zaken (bovenaan overzicht-tab) ─── */}
      {isAdmin && adminTab === "overview" && participants.length > 0 && (
        <div style={{ ...S.card, padding: 12 }}>
          <button onClick={() => setShowJoined((v) => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>{L.whoJoinedTitle} {showJoined ? "▾" : "▸"}</span>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "#1499b0", background: "rgba(20,153,176,0.12)", borderRadius: 20, padding: "3px 9px" }}>{L.joinedOf(joinedCount, participants.length)}</span>
          </button>
          {showJoined && <div style={{ marginTop: 8 }}>{joinedList({ clickable: true })}</div>}
        </div>
      )}
      {adminTab === "overview" && baseItems.some((it) => it.is_shared) && (
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#3b486a", marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}><ShareIcon on size={14} /> {L.sharedOverviewTitle}</div>
          {baseItems.filter((it) => it.is_shared).map((it) => {
            const st = sharedStatus(it)
            const names = claims.filter((c) => c.item_id === it.id && c.quantity > 0).map((c) => {
              const p = participants.find((x) => x.id === c.participant_id)
              if (!p) return null
              const parts = p.name.split(/\s*&\s*|\s*\+\s*/).map((x) => x.trim()).filter(Boolean)
              const mem = c.members ? c.members.split(",").map((x) => parseInt(x, 10)).filter((x) => !isNaN(x)) : null
              if (mem && parts.length > 1) return mem.map((i) => parts[i] || p.name).join(", ")
              if (parts.length > 1 && c.quantity < parts.length) return parts.slice(0, c.quantity).join(", ")
              return p.name
            }).filter(Boolean).join(", ")
            return (
              <div key={it.id} style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 10, background: st.warn ? "rgba(243,156,18,0.08)" : "rgba(39,174,96,0.06)", border: st.warn ? "1px solid rgba(243,156,18,0.45)" : "1px solid rgba(39,174,96,0.35)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#14213a" }}>{it.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5a6680", flexShrink: 0 }}>€{itemTotal(it).toFixed(2).replace(".", ",")}{it.share_expected ? ` · ${L.expectedShort(it.share_expected)}` : ""}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#5a6680", marginTop: 3, lineHeight: 1.45 }}>
                  {st.heads > 0 ? <>{L.sharedByLabel} <b style={{ color: "#14213a" }}>{st.heads}</b>: {names}</> : L.nobodyShared}
                </div>
                {st.warn === "few" && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#b5591a", marginTop: 4 }}>{L.tooFewShared(st.heads, it.share_expected as number)}</div>}
                {st.warn === "one" && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#b5591a", marginTop: 4 }}>{L.onlyOneShares}</div>}
              </div>
            )
          })}
        </div>
      )}
      {isAdmin && adminTab === "overview" && (
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#3b486a", marginBottom: 8 }}>{L.overviewTitle}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Stat label={L.statTotal} value={`€${(billTotal + tipTotal).toFixed(2).replace(".", ",")}`} tone="navy" />
            <div onClick={() => { if (typeof document !== "undefined") document.getElementById("rekening-per-persoon")?.scrollIntoView({ behavior: "smooth", block: "start" }) }} style={{ flex: 1, cursor: "pointer", textAlign: "center", background: allAssignedNow ? "rgba(39,174,96,0.14)" : "rgba(233,196,95,0.16)", border: allAssignedNow ? "2px solid rgba(39,174,96,0.75)" : "2px solid transparent", boxShadow: allAssignedNow ? "0 0 0 3px rgba(39,174,96,0.15), 0 4px 14px -4px rgba(39,174,96,0.55)" : "none", borderRadius: 12, padding: "8px 6px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2 }} title={L.viewPerPersonAttr}>
              <span style={{ fontSize: 12, fontWeight: 800, color: allAssignedNow ? "#1f8a4c" : "#a06b00", lineHeight: 1.25 }}>{L.viewPerPerson}{allAssignedNow ? " →" : ""}</span>
            </div>
            {openUnits > 0 ? (
              <div onClick={() => setShowTodo((v) => !v)} style={{ flex: 1, cursor: "pointer" }}>
                <Stat label={L.statNotClaimed} value={`${openUnits}`} tone="red" />
              </div>
            ) : (
              <div style={{ flex: 1, textAlign: "center", background: "rgba(39,174,96,0.12)", borderRadius: 12, padding: "8px 4px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#27ae60", lineHeight: 1 }}>✓</div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#27ae60", lineHeight: 1.15 }}>{L.allClaimed}</div>
              </div>
            )}
          </div>
          {showTodo && (openUnits > 0 || undecidedShared.length > 0) && (
            <div style={{ marginTop: 10, border: "1px solid rgba(224,107,94,0.35)", background: "rgba(224,107,94,0.05)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#c0392b", marginBottom: 6 }}>{L.todoTitle}</div>
              {participants.length === 0 && <div style={{ fontSize: 12, color: "#a06b00", marginBottom: 6 }}>{L.addGuestsToAssign}</div>}
              {items.filter((it) => !it.is_shared && it.quantity - claimedQty(it.id) > 0).map((it) => {
                const openN = it.quantity - claimedQty(it.id)
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{openN}× {showTip(it.name, L)}</b> {L.notClaimedSuffix}</span>
                    {participants.length > 0 && (
                      <select value="" onChange={(e) => { const pid = e.target.value; if (pid) setClaim(it.id, pid, myQty(it.id, pid) + 1) }}
                        style={{ ...S.input, flexShrink: 0, maxWidth: 150, padding: "5px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        <option value="">{L.assignDots}</option>
                        {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
              {undecidedShared.map((it) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)", color: "#a06b00" }}>
                  <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5 }}><ShareIcon on size={14} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{showTip(it.name, L)}</b> {L.sharedNobody}</span></span>
                  {participants.length > 0 && (
                    <select value="" onChange={(e) => { const pid = e.target.value; if (pid) toggleShareClaim(it.id, pid) }}
                      style={{ ...S.input, flexShrink: 0, maxWidth: 150, padding: "5px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <option value="">{L.letShareDots}</option>
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
            setClaim={setClaim} toggleShareClaim={toggleShareClaim} onToggleShared={toggleShared} claimMembers={claimMembers} sharedStatus={sharedStatus} onDeleteItem={isAdmin ? deleteItem : undefined} onSetExpected={isAdmin ? setShareExpected : undefined}
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
              <h3 style={{ ...S.h3, marginBottom: 0 }}>{L.perPersonTitle}</h3>
              {participants.length > 0 && (() => {
                const allOpen = participants.every((p) => expandedPeople.has(p.id))
                return (
                  <button style={S.smallBtn} onClick={() => setExpandedPeople(allOpen ? new Set() : new Set(participants.map((p) => p.id)))}>
                    {allOpen ? L.detailsHide : L.detailsShow}
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
                      {detail.length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>{L.nothingTapped}</div>}
                      {detail.map((d, k) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#5a6680", padding: "2px 0" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{d.shared && <ShareIcon on size={14} />}{d.qty > 1 ? `${d.qty}× ` : ""}{showTip(d.name, L)}{d.shared ? (d.revealed ? ((p.seats ?? 1) > 1 ? L.sharedNPers(d.myHeads) : L.sharedPart) : L.sharedByN(d.sharers)) : ""}</span>
                          <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>
                            {d.shared && !d.revealed ? L.toBeDivided : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2).replace(".", ",")}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {participants.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>{L.noGuests}</div>}
            {items.length > 0 && participants.length > 0 && (() => {
              const assignedSum = participants.reduce((s, p) => s + personTotal(p.id).settled, 0)
              const allAssigned = openUnits === 0 && undecidedShared.length === 0
              const todo = openUnits + undecidedShared.length
              return (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(16,24,40,0.08)" }}>
                  {allAssigned ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "rgba(39,174,96,0.1)", border: "1px solid rgba(39,174,96,0.55)", borderRadius: 12, padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: "#1f8a4c" }}>{L.allAssigned}</span>
                      <span style={{ fontSize: 17, fontWeight: 800, color: "#1f8a4c" }}>€{assignedSum.toFixed(2).replace(".", ",")}</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>{L.assignedLabel} <span style={{ color: "#c0392b", fontWeight: 700 }}>{L.todoLeft(todo)}</span></span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#14213a" }}>€{assignedSum.toFixed(2).replace(".", ",")} <span style={{ fontSize: 12, color: "#9aa0ab", fontWeight: 700 }}>/ €{(billTotal + tipTotal).toFixed(2).replace(".", ",")}</span></span>
                    </div>
                  )}
                  {(() => {
                    const billSum = billTotal + tipTotal
                    const diff = Math.abs(assignedSum - billSum)
                    const ok = diff < 0.02
                    return (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(16,24,40,0.12)" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#5a6680" }}>{L.billTotalLabel}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>€{billSum.toFixed(2).replace(".", ",")}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: ok ? "#1f8a4c" : "#b5591a", background: ok ? "rgba(39,174,96,0.12)" : "rgba(243,156,18,0.12)", border: ok ? "1px solid rgba(39,174,96,0.4)" : "1px solid rgba(243,156,18,0.45)", borderRadius: 7, padding: "2px 7px", whiteSpace: "nowrap" }}>{ok ? L.totalsMatch : L.totalsDiff(diff)}</span>
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>

          {!group.finalized && (
            <div id="fooi-sectie" style={{ ...S.card, padding: "11px 14px", marginTop: 10 }}>
              {tipItem ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#3b486a" }}>{L.tipLabelPre}<b>€{(tipItem.unit_price ?? 0).toFixed(2).replace(".", ",")}</b> <span style={{ fontSize: 11, color: "#9aa0ab", fontWeight: 600 }}>{L.tipEqualNote}</span></span>
                  <button onClick={() => deleteItem(tipItem.id)} style={{ ...S.btn, fontSize: 12, fontWeight: 700, padding: "6px 12px", flexShrink: 0 }}>{L.clearTip}</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#3b486a", flexShrink: 0 }}>{L.tipHeader}</span>
                  <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, border: "1px solid rgba(20,33,58,0.15)", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#5a6680", padding: "0 1px 0 10px" }}>€</span>
                    <input type="text" inputMode="decimal" value={tipInput} onChange={(e) => setTipInput(numFilter(e.target.value, true))} placeholder="0,00" style={{ width: 62, border: "none", outline: "none", background: "transparent", textAlign: "right", padding: "8px 10px 8px 2px", fontSize: 14 }} />
                  </div>
                  <button onMouseDown={(e) => e.preventDefault()} onClick={addTip} style={{ ...S.btn, ...S.btnPrimary, fontSize: 12.5, fontWeight: 700, padding: "8px 14px", flexShrink: 0 }}>{L.addTipShort}</button>
                  <span style={{ fontSize: 10.5, color: "#9aa0ab", width: "100%", marginTop: 2 }}>{L.tipOptional}</span>
                </div>
              )}
            </div>
          )}

          {group.finalized ? (
            <button onClick={() => finalizeBill(false)} style={{ ...S.btn, width: "100%", padding: "13px 0", fontSize: 14.5, fontWeight: 800, background: "linear-gradient(135deg,#f39c12,#e67e22)", border: "none", color: "#fff", boxShadow: "0 6px 16px -6px rgba(230,126,34,0.6)" }}>
              {L.reopenBillTip}
            </button>
          ) : (
            <button onClick={() => {
              if (openUnits > 0 || undecidedShared.length > 0) {
                const delen: string[] = []
                if (openUnits > 0) delen.push(L.unitsNotAssigned(openUnits))
                if (undecidedShared.length > 0) delen.push(L.sharedNobodyTakes(undecidedShared.length))
                alert(`${L.cantFinalizeTitle}\n\n• ${delen.join("\n• ")}\n\n${L.assignFirstHint}`)
                setShowTodo(true)
                return
              }
              if (!billOk) { setShowFinalizeWarn(true); return }
              // Gedeelde items: waarschuw als er te weinig mensen aanduidden dat ze meededen.
              const shareProblems = baseItems.filter((it) => it.is_shared).map((it) => {
                const st = sharedStatus(it)
                if (st.warn === "none") return `${it.name}: ${L.nobodyShared}`
                if (st.warn === "few") return `${it.name}: ${L.tooFewShared(st.heads, it.share_expected as number)}`
                return null
              }).filter(Boolean) as string[]
              if (shareProblems.length > 0 && !confirm(`${L.sharedProblemTitle}\n\n• ${shareProblems.join("\n• ")}\n\n${L.sharedProblemAsk}`)) return
              if (!hasTip) { setShowTipReminder(true); return }
              if (confirm(L.finalizeConfirm)) finalizeBill(true)
            }} style={{ ...S.btn, width: "100%", padding: "14px 0", fontSize: 15, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#1f8a4c,#27ae60)", color: "#fff", boxShadow: "0 6px 16px -6px rgba(39,174,96,0.6)" }}>
              {L.finalizeBtn}
            </button>
          )}
          <div style={{ fontSize: 11, color: "#9aa0ab", textAlign: "center", marginTop: 6, marginBottom: 4 }}>
            {group.finalized ? L.finalizedNote : L.notFinalizedNote}
          </div>
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <button onClick={() => { if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }) }} style={{ ...S.btn, fontSize: 12.5, fontWeight: 700, padding: "8px 16px" }}>{L.backToTop}</button>
          </div>
        </div>
      )}

      {/* ─── Venster: BTW / kosten / korting toevoegen (stap 1: bedrag, stap 2: verdeling) ─── */}
      {taxModal && (() => {
        const hasAmount = !!taxModal.amount.trim() && (parseFloat(taxModal.amount.replace(",", ".")) || 0) !== 0
        return (
        <div style={S.overlay} onClick={() => setTaxModal(null)}>
          <div style={{ ...S.modal, width: 360, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 800 }}>{L.taxModalTitle}</h3>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6680" }}>{L.taxDesc}</label>
            <input value={taxModal.name} onChange={(e) => setTaxModal({ ...taxModal, name: e.target.value })} placeholder={L.taxDescPlaceholder} style={{ ...S.input, width: "100%", boxSizing: "border-box", margin: "4px 0 12px" }} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#5a6680" }}>{L.taxAmountLabel}</label>
            <input type="text" inputMode="decimal" value={taxModal.amount} onChange={(e) => setTaxModal({ ...taxModal, amount: numFilter(e.target.value, true) })} placeholder={L.taxAmountPlaceholder} style={{ ...S.input, width: "100%", boxSizing: "border-box", margin: "4px 0 16px", fontSize: 16 }} autoFocus />
            {!hasAmount ? (
              <div style={{ fontSize: 12, color: "#9aa0ab", marginBottom: 12 }}>{L.taxEnterAmount}</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5a6680", marginBottom: 6 }}>{L.taxSplitOver}</div>
                <button onClick={() => confirmTaxModal("all")} style={{ width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", border: "1.5px solid rgba(20,153,176,0.4)", background: "rgba(20,153,176,0.08)", color: "#14213a" }}>{L.overWholeBill}</button>
                <button onClick={() => setTaxModal({ ...taxModal, scope: "items" })} style={{ width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", border: taxModal.scope === "items" ? "2px solid #1499b0" : "1.5px solid rgba(20,33,58,0.15)", background: taxModal.scope === "items" ? "rgba(20,153,176,0.08)" : "#fff", color: "#14213a" }}>{L.overCertainItems}</button>
                {taxModal.scope === "items" && (
                  <>
                    <div style={{ margin: "4px 0 8px", maxHeight: 200, overflowY: "auto", border: "1px solid rgba(20,33,58,0.12)", borderRadius: 10, padding: "6px 4px" }}>
                      {baseItems.length === 0 && <div style={{ fontSize: 12, color: "#9aa0ab", padding: 8 }}>{L.noItemsShort}</div>}
                      {baseItems.map((it) => {
                        const on = taxModal.ids.includes(it.id)
                        return (
                          <button key={it.id} onClick={() => setTaxModal({ ...taxModal, ids: on ? taxModal.ids.filter((x) => x !== it.id) : [...taxModal.ids, it.id] })} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px", border: "none", background: on ? "rgba(20,153,176,0.08)" : "transparent", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                            <span style={{ width: 18, height: 18, borderRadius: 5, border: on ? "none" : "1.5px solid #b8c0cf", background: on ? "#1499b0" : "#fff", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{on ? "✓" : ""}</span>
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{it.quantity}× {showTip(it.name, L)}</span>
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => confirmTaxModal("items")} disabled={taxModal.ids.length === 0} style={{ ...S.btn, ...S.btnPrimary, width: "100%", fontWeight: 800, opacity: taxModal.ids.length === 0 ? 0.5 : 1 }}>{L.confirmBtn}</button>
                  </>
                )}
              </>
            )}
            <button onClick={() => setTaxModal(null)} style={{ ...S.btn, width: "100%", fontWeight: 700, marginTop: 10 }}>{L.cancel}</button>
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
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: "#c0392b" }}>{L.totalsMismatchTitle}{diff != null ? L.diffSuffix(diff.toFixed(2).replace(".", ",")) : ""}</h3>
              <p style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, margin: "0 0 8px" }}>{entered == null ? L.warnFillTotal : L.warnCheckItems}</p>
              <ul style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 13, color: "#5a6680", lineHeight: 1.6 }}>
                <li>{L.checkPricesQty}</li>
                <li>{L.checkTaxAdded}</li>
                <li>{L.checkSharedMarked}</li>
              </ul>
              <button onClick={() => setShowShareWarn(false)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}>{L.backToBill}</button>
              <button onClick={() => { setShowShareWarn(false); setAdminTab("guests") }} style={{ ...S.btn, width: "100%", padding: "9px 0", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#9aa0ab", background: "transparent", border: "none" }}>{L.continueAnyway}</button>
            </div>
          </div>
        )
      })()}

      {showInviteModal && (
        <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowInviteModal(false)}>
          <div style={{ ...S.modal, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: "#14213a" }}>{L.inviteModalTitle}</h3>
            <div style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, marginBottom: 12 }}>{L.inviteModalMsg}</div>
            <div style={{ background: "#f4f6fb", border: "1px solid rgba(20,33,58,0.12)", borderRadius: 12, padding: "11px 13px", fontSize: 13, color: "#14213a", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap", marginBottom: 14, userSelect: "text" }}>{inviteModalText}</div>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(inviteModalText); setToast(L.toastInviteCopied) } }} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{L.inviteModalCopy}</button>
            <button onClick={() => setShowInviteModal(false)} style={{ ...S.btn, width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#9aa0ab", background: "transparent", border: "none" }}>{L.inviteModalClose}</button>
          </div>
        </div>
      )}

      {/* ─── Waarschuwing: afsluiten terwijl item- en bontotaal niet overeenkomen (onomkeerbaar) ─── */}
      {showTipReminder && (
        <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowTipReminder(false)}>
          <div style={{ ...S.modal, width: 350 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: "#14213a" }}>{L.tipReminderTitle}</h3>
            <div style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, marginBottom: 16 }}>{L.tipReminderBody}</div>
            <button onClick={() => { setShowTipReminder(false); if (typeof document !== "undefined") document.getElementById("fooi-sectie")?.scrollIntoView({ behavior: "smooth", block: "center" }) }} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{L.addTipBtn}</button>
            <button onClick={() => { setShowTipReminder(false); finalizeBill(true) }} style={{ ...S.btn, width: "100%", padding: "10px 0", fontSize: 13, fontWeight: 700, color: "#9aa0ab", background: "transparent", border: "none" }}>{L.finalizeNoTip}</button>
          </div>
        </div>
      )}
      {showFinalizeWarn && (() => {
        const entered = group?.receipt_total ?? null
        const diff = entered != null ? Math.abs(billTotal - entered) : null
        return (
          <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowFinalizeWarn(false)}>
            <div style={{ ...S.modal, width: 350 }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 800, color: "#c0392b" }}>{L.sureTitle}{diff != null ? L.sureDiff(diff.toFixed(2).replace(".", ",")) : L.sureNoTotal}</h3>
              <p style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, margin: "0 0 14px" }}>{L.finalizeWarnBody}</p>
              <button onClick={() => setShowFinalizeWarn(false)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}>{L.backToBill}</button>
              <button onClick={() => { setShowFinalizeWarn(false); finalizeBill(true) }} style={{ ...S.btn, width: "100%", padding: "9px 0", marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "#9aa0ab", background: "transparent", border: "none" }}>{L.finalizeAnyway}</button>
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
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1f8a4c", margin: "0 0 4px" }}>{L.billClosedTitle}</h3>
              <p style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, margin: 0 }}>{L.billClosedBody}</p>
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
              {participants.length === 0 && <div style={{ fontSize: 13, color: "#9aa0ab", textAlign: "center" }}>{L.noGuestsYet}</div>}
            </div>
            <button onClick={() => setAdminFinalPopup(false)} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 14, padding: "12px 0", fontWeight: 800 }}>{L.closeWord}</button>
          </div>
        </div>
      )}

      {/* ─── Modal: bon scannen ─── */}
      {showScan && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 460, maxHeight: "88vh" }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>{L.scanModalTitle}</h3>
            <p style={{ fontSize: 12.5, color: "#999", marginBottom: 14 }}>{L.scanModalIntro}</p>

            {scanning ? (
              <div style={{ ...S.btn, ...S.btnPrimary, textAlign: "center", marginBottom: 14, fontWeight: 700, padding: "14px 0", opacity: 0.6 }}>{scanStep && scanStep.n > 1 ? L.scanningPhotoN(scanStep.i, scanStep.n) : L.scanningBusy}</div>
            ) : (
              <>
                {photos.length === 0 ? (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
                      <label style={{ ...S.btn, ...S.btnPrimary, flex: 1, display: "block", textAlign: "center", cursor: "pointer", fontWeight: 700, padding: "13px 0" }}>
                        📷 {L.takePhoto}
                        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => addPhoto(e.target.files?.[0])} />
                      </label>
                      <label style={{ ...S.btn, flex: 1, display: "block", textAlign: "center", cursor: "pointer", fontWeight: 700, padding: "13px 0" }}>
                        🖼️ {L.fromGallery}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => addPhoto(e.target.files?.[0])} />
                      </label>
                    </div>
                    <div style={{ border: "1px dashed rgba(20,153,176,0.45)", background: "rgba(20,153,176,0.04)", borderRadius: 10, padding: "9px 11px", textAlign: "center", marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1499b0" }}>{L.longBillTitle}</div>
                      <div style={{ fontSize: 11, color: "#9aa0ab", marginTop: 2 }}>{L.longBillSub}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 11 }}>
                      {photos.map((ph, i) => (
                        <div key={i} style={{ position: "relative", width: 58, height: 74, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(39,174,96,0.5)" }}>
                          <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 800, color: "#1f8a4c", background: "rgba(255,255,255,0.9)", borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap" }}>✓ {i + 1}</span>
                          <button onClick={() => removePhoto(i)} title={L.retakePhoto} style={{ position: "absolute", top: 2, right: 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", border: "1px solid rgba(16,24,40,0.2)", color: "#6b7385", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}>✕</button>
                        </div>
                      ))}
                      {photos.length < 2 && (
                        <label style={{ width: 58, height: 74, borderRadius: 10, border: "1.5px dashed rgba(20,153,176,0.5)", background: "rgba(20,153,176,0.04)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                          <span style={{ fontSize: 18, color: "#1499b0", lineHeight: 1 }}>+</span>
                          <span style={{ fontSize: 9, color: "#1499b0", fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{L.addSecondHalf}</span>
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => addPhoto(e.target.files?.[0])} />
                        </label>
                      )}
                      <div style={{ flex: 1, fontSize: 11, color: "#9aa0ab", lineHeight: 1.5, minWidth: 120 }}>{photos.length === 1 ? L.photoHintOne : L.photoHintTwo}</div>
                    </div>
                    <button onClick={scanPhotos} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "13px 0", fontSize: 14.5, fontWeight: 800 }}>{photos.length > 1 ? L.readBillBtn2 : L.readBillBtn}</button>
                    {photos.length > 1 && <div style={{ fontSize: 10.5, color: "#9aa0ab", textAlign: "center", marginTop: 6 }}>{L.countsAsOne}</div>}
                  </div>
                )}
              </>
            )}

            {scanning && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 8, background: "rgba(20,33,58,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(scanProgress * 100)}%`, height: "100%", background: "linear-gradient(90deg,#1499b0,#22b8cf)", borderRadius: 4, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: 11, color: "#8a93a3", textAlign: "center", marginTop: 6 }}>{L.scanProgress}</div>
              </div>
            )}

            {/* Na 2 mislukte pogingen met twee foto's: raad één foto van de hele bon aan. */}
            {scanFail && !scanning && multiFails >= 2 && (
              <div style={{ background: "rgba(243,156,18,0.1)", border: "1px solid rgba(243,156,18,0.5)", borderRadius: 12, padding: "12px 13px", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#b5591a", marginBottom: 4 }}>{L.tooSlowTitle}</div>
                <div style={{ fontSize: 12.5, color: "#8a4514", lineHeight: 1.5, marginBottom: 4 }}>{L.tooSlowBody}</div>
                <div style={{ fontSize: 11.5, color: "#9a6a30", lineHeight: 1.45, marginBottom: 10 }}>💡 {L.tooSlowTip}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ ...S.btn, ...S.btnPrimary, flex: 1, minWidth: 150, display: "block", textAlign: "center", cursor: "pointer", fontWeight: 800, fontSize: 13, padding: "11px 0" }}>
                    {L.tooSlowOne}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                      onChange={(e) => { for (const ph of photos) URL.revokeObjectURL(ph.url); setPhotos([]); setScanFail(null); setMultiFails(0); addPhoto(e.target.files?.[0]) }} />
                  </label>
                  <button onClick={() => { setScanFail(null); scanPhotos() }} disabled={cooldownLeft > 0}
                    style={{ ...S.btn, flex: 1, minWidth: 130, fontWeight: 800, fontSize: 13, padding: "11px 0", opacity: cooldownLeft > 0 ? 0.5 : 1 }}>{cooldownLeft > 0 ? `${cooldownLeft}s` : L.tooSlowRetry}</button>
                </div>
              </div>
            )}
            {scanFail && !scanning && (
              <div style={{ marginBottom: 14, border: "1px solid rgba(224,107,94,0.45)", background: "rgba(224,107,94,0.06)", borderRadius: 12, padding: "13px 14px" }}>
                {scanFail.reason === "unavailable" ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#c0392b", marginBottom: 4 }}>{L.scanFailUnavailTitle}</div>
                    <div style={{ fontSize: 12.5, color: "#8a4514", lineHeight: 1.5, marginBottom: 10 }}>{L.scanFailUnavailBody}</div>
                    <button onClick={retryAiScan} disabled={cooldownLeft > 0} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontSize: 14, fontWeight: 800, opacity: cooldownLeft > 0 ? 0.55 : 1, cursor: cooldownLeft > 0 ? "default" : "pointer" }}>{cooldownLeft > 0 ? L.retryIn(cooldownLeft) : L.retryNow}</button>
                    {scanFail.status ? <div style={{ fontSize: 10.5, color: "#9aa0ab", marginTop: 8, wordBreak: "break-word" }}>technisch: {scanFail.status}{scanFail.detail ? " — " + scanFail.detail : ""}</div> : null}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#c0392b", marginBottom: 4 }}>{L.scanFailEmptyTitle}</div>
                    <div style={{ fontSize: 12.5, color: "#8a4514", lineHeight: 1.5, marginBottom: 10 }}>{L.scanFailEmptyBody}</div>
                    <label style={{ ...S.btn, ...S.btnPrimary, display: "block", textAlign: "center", padding: "12px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                      {L.otherPhoto}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPhotoPicked(e.target.files?.[0])} />
                    </label>
                  </>
                )}
                <button onClick={runLocalScan} style={{ width: "100%", marginTop: 8, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "#9aa0ab", textDecoration: "underline", textUnderlineOffset: 2 }}>{L.useQuickScan}</button>
              </div>
            )}

            {scanPhotoUrl && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 6 }}>{L.yourPhoto}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scanPhotoUrl} alt={L.scannedReceiptAlt} onClick={() => setViewReceipt(scanPhotoUrl)} style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", background: "#faf9f5", cursor: "zoom-in" }} />
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
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#c98a00", textTransform: "uppercase" }}>{scanPreview.filter((x) => !x.distribute).length} {L.recognizedSuffix}</div>
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
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 4 }}>{L.howToSplit}</div>
                        <div style={{ display: "flex", gap: 6, marginBottom: !overAll ? 8 : 0 }}>
                          <button onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, distribute: "all" } : x))} style={{ flex: 1, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "8px 6px", cursor: "pointer", border: overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: overAll ? "#fff" : "#5a6680" }}>{L.overWholeBill}</button>
                          <button onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, distribute: JSON.stringify({ idx: baseRows.map((o) => o.j) }) } : x))} style={{ flex: 1, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: "8px 6px", cursor: "pointer", border: !overAll ? "none" : "1px solid rgba(16,24,40,0.15)", background: !overAll ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff", color: !overAll ? "#fff" : "#5a6680" }}>{L.overCertainItems}{!overAll ? ` (${selIdx.length})` : ""}</button>
                        </div>
                        {!overAll && (
                          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 7 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#a06b00", marginBottom: 6 }}>{L.tapItemsForCost}</div>
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
                        <div style={{ fontSize: 10.5, color: "#1499b0", fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>{L.saveHint}</div>
                      </div>
                    )
                  }
                  return (
                    <div key={i} style={{ border: it._isNew ? "1.5px solid #ecc85a" : scanMatch ? "1.5px solid rgba(39,174,96,0.6)" : "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: 9, marginBottom: 8, background: it._isNew ? "rgba(233,196,95,0.16)" : scanMatch ? "rgba(39,174,96,0.07)" : "transparent" }}>
                      {it._isNew && <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a06b00", marginBottom: 6 }}>{L.justAddedScan}</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <input value={it.name} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...S.input, flex: 1, minWidth: 0 }} />
                        <button title={it.is_shared ? L.shareToggleOn : L.shareToggleOff} onClick={() => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, is_shared: !x.is_shared } : x))} style={{ ...S.iconBtn, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: it.is_shared ? "rgba(233,196,95,0.3)" : "rgba(16,24,40,0.05)" }}><ShareIcon on={it.is_shared} /></button>
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
                          <span style={{ fontSize: 12, color: "#888" }}>{L.perPiece}</span>
                          <input type="number" step="0.01" value={it.unit_price || ""} onChange={(e) => setScanPreview((cur) => cur.map((x, j) => j === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))} style={{ ...S.input, width: 84, padding: "8px 8px" }} />
                        </div>
                        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: scanMatch ? "#1f8a4c" : "#14213a", whiteSpace: "nowrap" }}>= €{lineTotal.toFixed(2).replace(".", ",")}</span>
                      </div>
                      {it.is_shared && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#a06b00", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.45)", borderRadius: 9, padding: "6px 10px", lineHeight: 1.4 }}>
                          <ShareIcon on size={16} /> {L.sharedItemNote}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <button onClick={() => openNewItem("scan")} style={{ ...S.btn, ...S.btnPrimary, padding: "8px 16px", fontSize: 12.5, fontWeight: 700 }}>{L.addItem}</button>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                  <button onClick={() => setScanPreview((cur) => [...cur, { name: L.taxDefaultName, unit_price: 0, quantity: 1, is_shared: false, distribute: "all" }])} style={{ ...S.btn, flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 0" }}>{L.addTaxBtn}</button>
                  <button onClick={() => setShowTaxInfo(true)} style={{ ...S.btn, fontSize: 12, fontWeight: 700, padding: "0 13px" }} title={L.explainTooltip}>ℹ️</button>
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
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8a93a3" }}>{L.itemsWord}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>€{itemsSum.toFixed(2).replace(".", ",")}</span>
                  </div>
                  {taxSum > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#8a93a3" }}>{L.taxWord}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>€{taxSum.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(16,24,40,0.08)" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#14213a" }}>{L.calcTotal}</span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "#14213a" }}>€{computed.toFixed(2).replace(".", ",")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>{L.totalOnBill}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "#999" }}>€</span>
                      <input type="number" step="0.01" placeholder="0.00" value={scanTotal} onChange={(e) => setScanTotal(numFilter(e.target.value))} style={{ ...S.input, width: 90, textAlign: "right", padding: "8px 8px" }} />
                    </div>
                  </div>
                  {hasBill && (
                    <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 700, lineHeight: 1.4, color: ok ? "#1f8a4c" : "#c0392b" }}>
                      {ok
                        ? L.matchesBillTotal
                        : L.diffNote(Math.abs(diff).toFixed(2).replace(".", ","), diff > 0)}
                    </div>
                  )}
                  {!hasBill && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: "#9aa0ab" }}>{L.enterBillLive}</div>
                  )}
                </div>
              )
            })()}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} disabled={scanning} onClick={() => { setShowScan(false); setScanPreview([]); setScanTotal(""); setScanFail(null); setScanFile(null); if (scanPhotoUrl) { URL.revokeObjectURL(scanPhotoUrl); setScanPhotoUrl(null) } }}>{scanPreview.length > 0 ? L.cancel : L.closeWord}</button>
              {scanPreview.length > 0 && (
                <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={() => confirmScan()} disabled={scanning}>{L.confirmAdd}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: item bewerken ─── */}
      {editItem && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 360 }}>
            <h3 style={{ marginBottom: 14, fontSize: 18, fontWeight: 800 }}>{L.editItemTitle}</h3>
            <label style={S.lbl}>{L.nameLabel}</label>
            <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <label style={S.lbl}>{L.qtyLabel}</label>
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
                <label style={S.lbl}>{L.pricePerLabel}</label>
                <input type="number" step="0.01" value={editItem.unit_price || ""} onChange={(e) => setEditItem({ ...editItem, unit_price: parseFloat(e.target.value) || 0 })} style={{ ...S.input, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ paddingBottom: 9 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{L.lineTotal}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#14213a", whiteSpace: "nowrap" }}>€{((editItem.unit_price || 0) * (editItem.quantity || 0)).toFixed(2).replace(".", ",")}</div>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={editItem.is_shared} onChange={(e) => setEditItem({ ...editItem, is_shared: e.target.checked })} />
              <ShareIcon on size={18} /> {L.sharedCheckbox}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setEditItem(null)}>{L.cancel}</button>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={saveItem}>{L.saveBtn}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: nieuw item toevoegen ─── */}
      {newItem && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, width: 360 }}>
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>{L.newItemTitle}</h3>
            <p style={{ fontSize: 12, color: "#999", marginTop: 0, marginBottom: 14 }}>{L.newItemIntro}</p>
            <label style={S.lbl}>{L.nameLabel}</label>
            <input autoFocus value={newItem.name} placeholder={L.itemNamePlaceholder} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") confirmNewItem() }} style={{ ...S.input, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <label style={S.lbl}>{L.qtyLabel}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16 }} onClick={() => setNewItem((cur) => cur ? { ...cur, quantity: Math.max(1, cur.quantity - 1) } : cur)}>−</button>
                  <input type="number" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...S.input, width: 48, textAlign: "center", padding: "9px 4px" }} />
                  <button style={{ ...S.iconBtn, width: 32, height: 38, fontSize: 16, background: "rgba(27,42,74,0.12)" }} onClick={() => setNewItem((cur) => cur ? { ...cur, quantity: cur.quantity + 1 } : cur)}>+</button>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={S.lbl}>{L.pricePerLabel}</label>
                <input type="number" step="0.01" placeholder="0.00" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: numFilter(e.target.value) })} style={{ ...S.input, width: "100%", boxSizing: "border-box" }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={newItem.is_shared} onChange={(e) => setNewItem({ ...newItem, is_shared: e.target.checked })} />
              <ShareIcon on size={18} /> {L.sharedCheckbox}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setNewItem(null)}>{L.cancel}</button>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 700 }} onClick={confirmNewItem}>{L.addBtn}</button>
            </div>
          </div>
        </div>
      )}
      {showTaxInfo && (
        <div style={S.overlay} onClick={() => setShowTaxInfo(false)}>
          <div style={{ ...S.modal, width: 380 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 800 }}>{L.taxWord}</h3>
            <div style={{ fontSize: 13.5, color: "#3b486a", lineHeight: 1.6 }}>
              <p style={{ marginTop: 0, marginBottom: 0 }}>{L.taxInfoBody}</p>
            </div>
            <button style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 16, fontWeight: 700 }} onClick={() => setShowTaxInfo(false)}>{L.understood}</button>
          </div>
        </div>
      )}

      {/* ─── Modal: bon groot bekijken ─── */}
      {shareConfirm && (
        <div style={S.overlay} onClick={() => setShareConfirm(null)}>
          <div style={{ ...S.card, maxWidth: 380, width: "100%", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...S.h3, marginBottom: 6 }}>{shareConfirm.is_shared ? L.makeUnsharedTitle : L.makeSharedTitle}</h3>
            <div style={{ fontSize: 13.5, color: "#14213a", fontWeight: 700, marginBottom: 6 }}>{shareConfirm.quantity}× {shareConfirm.name}</div>
            <div style={{ fontSize: 13, color: "#5a6680", lineHeight: 1.5, marginBottom: 8 }}>{shareConfirm.is_shared ? L.makeUnsharedBody : L.makeSharedBody}</div>
            <div style={{ fontSize: 12.5, color: "#b5591a", background: "rgba(243,156,18,0.1)", border: "1px solid rgba(243,156,18,0.45)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.45, marginBottom: 14 }}>⚠️ {L.makeSharedWipe}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => setShareConfirm(null)}>{L.makeSharedCancel}</button>
              <button style={{ ...S.btn, ...S.btnPrimary, flex: 1, fontWeight: 800 }} onClick={async () => { const it = shareConfirm; setShareConfirm(null); await applyToggleShared(it) }}>{shareConfirm.is_shared ? L.makeUnsharedTitle : L.makeSharedYes}</button>
            </div>
          </div>
        </div>
      )}
      {viewReceipt && (
        <div style={S.overlay} onClick={() => setViewReceipt(null)}>
          <div style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            {/* Meerdere foto's van dezelfde bon staan als spatie-gescheiden URL's opgeslagen. */}
            {viewReceipt.split(/\s+/).filter(Boolean).map((url, i, arr) => (
              <div key={i} style={{ marginBottom: i < arr.length - 1 ? 10 : 0 }}>
                {arr.length > 1 && (
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: 7, padding: "3px 9px", display: "inline-block", marginBottom: 5 }}>{L.photoOfN(i + 1, arr.length)}</div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={L.scannedReceiptAlt} style={{ display: "block", maxWidth: "92vw", maxHeight: arr.length > 1 ? "70vh" : "82vh", borderRadius: 12, objectFit: "contain" }} />
              </div>
            ))}
            <button onClick={() => setViewReceipt(null)} style={{ ...S.btn, position: "sticky", bottom: 0, width: "100%", marginTop: 10, fontWeight: 800 }}>{L.close}</button>
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
  const [lang] = useLang()
  const L = STRINGS[lang]
  return (
    <div style={{ marginBottom: 14, padding: "4px 2px" }}>
      {/* Rol/naam (en voor de gast: tellertje + wisselen) centraal bovenaan */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: isAdmin ? "#1499b0" : "#f0a500", letterSpacing: 0.3 }}>
            {isAdmin ? L.roleAdminBadge : me ? `👤 ${me}` : L.roleGuestBadge}
          </span>
          {!isAdmin && guestSeats != null && onGuestSeatsChange && (
            <SeatsControl n={guestSeats} onChange={onGuestSeatsChange} showLabel size={13} />
          )}
        </div>
        {!isAdmin && onSwitchPerson && (
          <div>
            <button onClick={onSwitchPerson} style={{ marginTop: 2, background: "none", border: "none", padding: 0, color: "#9aa0ab", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>{L.switchPerson}</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div onClick={isAdmin ? onHome : undefined} title={isAdmin ? L.toTableHome : undefined} style={{ display: "flex", alignItems: "center", gap: 7, cursor: isAdmin ? "pointer" : "default", minWidth: 0, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-symbol.png" alt="" style={{ height: 30, width: "auto", objectFit: "contain", display: "block" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-table-logo-dark.png" alt="Rundo Table" style={{ height: 19, width: "auto", objectFit: "contain", display: "block" }} />
        </div>
        <div style={{ textAlign: "right", minWidth: 0, flexShrink: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1b2a4a", overflowWrap: "anywhere", lineHeight: 1.15 }}>{group.name}{fmtDate(group.created_at, lang) ? ` (${fmtDate(group.created_at, lang)})` : ""}</div>
          {totalPersons != null && totalPersons > 0 && <div style={{ fontSize: 11.5, color: "#8a93a3", fontWeight: 700 }}>👤 {totalPersons} {totalPersons === 1 ? L.person : L.persons}</div>}
        </div>
      </div>
    </div>
  )
}

function ItemList({ items, claimedQty, participants, claimsForItem, sharerIds, shareHeads, toggleShareClaim, setShareFixed, onEdit, onToggleShared, onDelete, onSetExpected, onAddManual, bareBill, taxLines, taxNode, recentItemId, onGoGuests, billOk, scanFlags }: {
  items: BillItem[]; claimedQty: (id: string) => number
  participants: Participant[]; claimsForItem: (id: string) => { name: string; qty: number }[]
  sharerIds: (id: string) => string[]; shareHeads: (id: string) => number; toggleShareClaim: (itemId: string, pid: string) => void
  setShareFixed: (it: BillItem, val: boolean) => void
  onEdit: (it: BillItem) => void; onToggleShared: (it: BillItem) => void; onDelete: (id: string) => void; onSetExpected?: (id: string, n: number | null) => void; onAddManual: () => void
  bareBill?: boolean
  taxLines?: { name: string; amount: number }[]
  taxNode?: React.ReactNode
  recentItemId?: string | null
  onGoGuests?: () => void
  billOk?: boolean
  scanFlags?: Record<string, { note: string }>
}) {
  const [openFlag, setOpenFlag] = useState<string | null>(null)
  const [lang] = useLang()
  const L = STRINGS[lang]
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ ...S.h3, marginBottom: 0, display: "flex", alignItems: "baseline", gap: 8 }}>{L.itemsOnBill}{!billOk && <span style={{ fontSize: 13, fontWeight: 800, color: "#c0392b" }}>{L.checkExcl}</span>}</h3>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, background: "rgba(90,108,166,0.06)", borderRadius: 10, padding: "9px 11px" }}>
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "#fff", border: "1px solid rgba(16,24,40,0.15)" }}><ShareIcon size={15} /></span>
          <span style={{ fontSize: 11.5, color: "#5a6680", lineHeight: 1.5 }}>{L.legendShare}</span>
        </div>
      )}
      {items.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 20, fontSize: 13 }}>{L.noItemsScan}</div>}
      {items.map((it) => {
        const open = it.quantity - claimedQty(it.id)
        const who = claimsForItem(it.id)
        const isNew = recentItemId === it.id
        const zeroPrice = it.unit_price <= 0.0001
        return (
          <div key={it.id} style={{ padding: "9px 8px", borderRadius: (isNew || billOk || zeroPrice || it.is_shared) ? 12 : 0, marginTop: (isNew || billOk || zeroPrice || it.is_shared) ? 4 : 0, marginBottom: (isNew || billOk || zeroPrice || it.is_shared) ? 6 : 0, background: zeroPrice ? "rgba(192,57,43,0.06)" : isNew ? "rgba(233,196,95,0.16)" : it.is_shared ? "rgba(233,196,95,0.1)" : billOk ? "rgba(39,174,96,0.06)" : "transparent", border: zeroPrice ? "1.5px solid rgba(192,57,43,0.5)" : isNew ? "1.5px solid #ecc85a" : it.is_shared ? "1.5px solid rgba(196,152,32,0.45)" : billOk ? "1.5px solid rgba(39,174,96,0.55)" : "1px solid transparent", borderBottom: zeroPrice ? "1.5px solid rgba(192,57,43,0.5)" : isNew ? "1.5px solid #ecc85a" : it.is_shared ? "1.5px solid rgba(196,152,32,0.45)" : billOk ? "1.5px solid rgba(39,174,96,0.55)" : "1px solid rgba(0,0,0,0.05)" }}>
            {isNew && <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a06b00", marginBottom: 4 }}>{L.justAddedEdit}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {it.is_shared && <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><ShareIcon on size={20} /></span>}
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere", minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span>{it.quantity}× {showTip(it.name, L)}</span>
                  {it.is_shared && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "#7a5300", background: "rgba(233,196,95,0.45)", border: "1px solid rgba(196,152,32,0.5)", borderRadius: 7, padding: "1px 7px" }}>{L.sharedBadge}</span>}
                  {scanFlags?.[it.id] && (
                    <button onClick={() => setOpenFlag(openFlag === it.id ? null : it.id)} title={L.scanDoubtTitle} style={{ flexShrink: 0, width: 18, height: 18, borderRadius: "50%", border: "none", background: "#f39c12", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</button>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right", lineHeight: 1.2 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: zeroPrice ? "#c0392b" : "#1499b0" }}>€{(it.unit_price * it.quantity).toFixed(2).replace(".", ",")}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: zeroPrice ? "#c0392b" : "#9aa0ab" }}>
                    {zeroPrice ? L.zeroPriceShort : it.is_shared ? L.sharedWord : `€${it.unit_price.toFixed(2).replace(".", ",")}${L.perPieceSuffix}`}
                  </div>
                </div>
              </div>
              <button onClick={() => onToggleShared(it)} title={it.is_shared ? L.shareToggleOn : L.shareToggleOff}
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, padding: "5px 9px", borderRadius: 8, cursor: "pointer",
                  color: it.is_shared ? "#7a5300" : "#5a6680",
                  background: it.is_shared ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff",
                  border: it.is_shared ? "1px solid rgba(196,152,32,0.5)" : "1px solid rgba(16,24,40,0.15)" }}>
                <ShareIcon on={it.is_shared} size={12} />{it.is_shared ? L.sharedOnShort : L.makeSharedShort}
              </button>
              <button style={S.iconBtn} onClick={() => onEdit(it)}>✏️</button>
              <button style={S.iconBtn} onClick={() => onDelete(it.id)}>🗑️</button>
            </div>
            {zeroPrice && (
              <div style={{ marginTop: 6, marginLeft: 26, fontSize: 12, color: "#c0392b", background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.4)", borderRadius: 8, padding: "7px 10px", lineHeight: 1.45 }}>
                ⚠️ {L.zeroPriceWarn}
                <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                  <button onClick={() => onEdit(it)} style={{ ...S.btn, padding: "6px 11px", fontSize: 12, fontWeight: 700 }}>{L.zeroPriceFix}</button>
                  <button onClick={() => onDelete(it.id)} style={{ ...S.btn, padding: "6px 11px", fontSize: 12, fontWeight: 700, color: "#c0392b", borderColor: "rgba(192,57,43,0.4)" }}>🗑️ {L.zeroPriceDelete}</button>
                </div>
              </div>
            )}
            {scanFlags?.[it.id] && openFlag === it.id && (
              <div style={{ marginTop: 6, marginLeft: 26, fontSize: 12, color: "#b5591a", background: "rgba(243,156,18,0.1)", border: "1px solid rgba(243,156,18,0.45)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.4 }}>
                {L.scanDoubtPre}{scanFlags[it.id].note ? ": " + scanFlags[it.id].note : ""}{L.scanDoubtPost}
              </div>
            )}
            {!bareBill && !it.is_shared && participants.length > 0 && (who.length > 0 || open > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 26 }}>
                {who.map((w, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#14213a", background: "rgba(90,108,166,0.1)", borderRadius: 10, padding: "2px 9px" }}>{w.name} ×{w.qty}</span>
                ))}
                {open > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e0685c", background: "rgba(224,107,94,0.1)", borderRadius: 10, padding: "2px 9px" }}>{open} {L.notAssignedYet}</span>
                )}
              </div>
            )}
            {it.is_shared && onSetExpected && (
              <div style={{ marginTop: 7, marginLeft: 26, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(90,108,166,0.06)", borderRadius: 9, padding: "7px 10px" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5a6680" }}>{L.expectedSharers}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <button onClick={() => onSetExpected(it.id, Math.max(0, (it.share_expected ?? 0) - 1) || null)} style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 14 }}>−</button>
                  <b style={{ minWidth: 16, textAlign: "center", fontSize: 14, color: it.share_expected ? "#14213a" : "#c3c8d2" }}>{it.share_expected ?? "–"}</b>
                  <button onClick={() => onSetExpected(it.id, (it.share_expected ?? 0) + 1)} style={{ ...S.iconBtn, width: 26, height: 26, fontSize: 14, background: "rgba(27,42,74,0.12)" }}>+</button>
                </div>
                <span style={{ fontSize: 10.5, color: "#9aa0ab", flex: 1, minWidth: 150, lineHeight: 1.4 }}>{L.expectedHint}</span>
              </div>
            )}
            {bareBill && it.is_shared && (
              <div style={{ marginTop: 7, marginLeft: 26, display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#a06b00", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 9, padding: "5px 9px", lineHeight: 1.4 }}>
                <ShareIcon on size={15} /> {L.sharedItemNoteShort}
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
                      <ShareIcon on size={13} /> {L.whoTookThis} {heads > 0 ? `${heads} ${heads === 1 ? L.person : L.persons} · €${perHead.toFixed(2).replace(".", ",")} p.p.` : L.tapNames}
                    </span>
                    {sh.length > 0 && (
                      <button onClick={() => setShareFixed(it, !fixed)} style={{
                        fontSize: 10.5, fontWeight: 800, borderRadius: 9, padding: "3px 9px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                        border: fixed ? "none" : "1px solid rgba(16,24,40,0.12)",
                        background: fixed ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "#fff",
                        color: fixed ? "#fff" : "#5a6680",
                      }}>{fixed ? L.shareFixedBtn : L.shareFixBtn}</button>
                    )}
                  </div>
                  {participants.length === 0
                    ? <div style={{ fontSize: 11, color: "#aaa" }}>{L.addGuestsFirst}</div>
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
                      ? L.shareFixedNote
                      : L.shareLiveNote}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", marginTop: 12, marginBottom: 2 }}>
        <button onClick={onAddManual} style={{ ...S.btn, ...S.btnPrimary, width: "62%", minWidth: 190, padding: "11px 10px", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>{L.addItemBtn}</button>
        {taxNode}
      </div>
      {items.length > 0 && (() => {
        const units = items.reduce((s, it) => s + it.quantity, 0)
        const sum = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)
        const tax = (taxLines || []).reduce((s, t) => s + t.amount, 0)
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(16,24,40,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>{L.orderedItems}{units}{tax > 0 ? ` · €${sum.toFixed(2).replace(".", ",")} + ${L.taxShort} €${tax.toFixed(2).replace(".", ",")}` : ""}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 7, paddingTop: 7, borderTop: tax > 0 ? "1px solid rgba(16,24,40,0.06)" : "none" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a" }}>{L.totalWord}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#14213a" }}>€{(sum + tax).toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        )
      })()}
      {onGoGuests && (
        <button onClick={onGoGuests} style={{ ...S.btn, ...S.btnPrimary, width: "100%", marginTop: 16, padding: "14px 0", fontSize: 15, fontWeight: 800, boxShadow: billOk ? "0 0 0 2px rgba(39,174,96,0.55), 0 8px 24px -6px rgba(39,174,96,0.65)" : "0 0 0 2px rgba(224,107,94,0.6), 0 8px 24px -6px rgba(224,107,94,0.65)" }}>{billOk ? L.allOkGoGuests : L.billCorrectGoGuests}</button>
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
  const [lang] = useLang()
  const L = STRINGS[lang]
  const open = participants.filter((p) => !confirmedFn(p.id))
  const others = participants.filter((p) => confirmedFn(p.id))
  return (
    <div style={{ marginTop: 8, marginLeft: 25, padding: 10, borderRadius: 12, background: "rgba(90,108,166,0.07)", border: "1px solid rgba(90,108,166,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#5a6680" }}>{L.assignToWhom}</span>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#9aa0ab", fontWeight: 800 }}>✕</button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {open.length === 0 && !showOthers && <span style={{ fontSize: 11.5, color: "#9aa0ab" }}>{L.everyoneConfirmed}</span>}
        {open.map((p) => (
          <button key={p.id} onClick={() => onAssign(p.id, false)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: "1px solid rgba(16,24,40,0.12)", background: "#fff", color: "#5a6680" }}>{p.name}</button>
        ))}
        {!showOthers && others.length > 0 && (
          <button onClick={() => setShowOthers(true)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: "1px dashed rgba(16,24,40,0.25)", background: "transparent", color: "#8b93a8" }}>{L.otherPerson}</button>
        )}
        {showOthers && others.map((p) => (
          <button key={p.id} onClick={() => onAssign(p.id, true)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 10, padding: "5px 11px", cursor: "pointer", border: "1px solid rgba(224,107,94,0.4)", background: "rgba(224,107,94,0.06)", color: "#c0392b" }}>{p.name} ⚠️</button>
        ))}
      </div>
      {showOthers && <div style={{ fontSize: 10.5, color: "#a06b00", marginTop: 6 }}>{L.assignConfirmedWarn}</div>}
    </div>
  )
}

function ClaimScreen(props: {
  items: BillItem[]; meId: string | null; me: Participant | null; isAdmin: boolean
  participants: Participant[]
  claimedQty: (id: string) => number; myQty: (id: string, pid: string | null) => number; sharerIds: (id: string) => string[]
  shareHeads: (id: string) => number; myShareHeads: (id: string, pid: string) => number; seatsOf: (pid: string) => number
  setSeats: (pid: string, n: number) => void
  setClaim: (itemId: string, pid: string, qty: number, members?: number[] | null) => void; toggleShareClaim: (itemId: string, pid: string) => void
  onToggleShared: (it: BillItem) => void
  claimMembers: (itemId: string, pid: string) => number[]
  onDeleteItem?: (id: string) => void
  onSetExpected?: (id: string, n: number | null) => void
  sharedStatus: (it: BillItem) => { heads: number; expected: number | null; warn: null | "none" | "few" | "one" }
  itemTotal: (it: BillItem) => number; personTotal: (pid: string) => { settled: number; pendingShared: boolean }
  personItems: (pid: string) => { name: string; qty: number; amount: number; shared: boolean; revealed: boolean; sharers: number; myHeads: number }[]
  sharedRevealed: (it: BillItem) => boolean; allConfirmed: boolean; isConfirmed: (pid: string) => boolean; explicitConfirmed: (pid: string) => boolean
  claimMode: "item" | "person"; setClaimMode: (m: "item" | "person") => void
  claimPid: string | null; setClaimPid: (id: string | null) => void
  iConfirmed: boolean; confirmMe: () => void; onPickMe: (id: string) => void
  finalized: boolean; iDispute: boolean; iResolved: boolean; iComment: string; onToggleDispute: (on: boolean, comment?: string) => void
}) {
  const [lang] = useLang()
  const L = STRINGS[lang]
  const { items, meId, isAdmin, participants, claimedQty, myQty, sharerIds, shareHeads, myShareHeads, seatsOf, setSeats, setClaim, toggleShareClaim, onToggleShared, claimMembers, sharedStatus, onDeleteItem, onSetExpected, itemTotal, personTotal, personItems, sharedRevealed, allConfirmed, isConfirmed, explicitConfirmed, iConfirmed, confirmMe, onPickMe, finalized, iDispute, iResolved, iComment, onToggleDispute } = props
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

  const _normal = items.filter((i) => !i.is_shared)
  const _shared = items.filter((i) => i.is_shared)
  const _totalU = _normal.reduce((s, i) => s + i.quantity, 0)
  const _claimedU = _normal.reduce((s, i) => s + Math.min(i.quantity, claimedQty(i.id)), 0)
  const _sharedDone = _shared.filter((i) => sharerIds(i.id).length > 0).length
  const allDone = (_totalU > 0 || _shared.length > 0) && _claimedU >= _totalU && _sharedDone === _shared.length
  const [claimCollapsed, setClaimCollapsed] = useState(false)
  const prevDoneRef = useRef(false)
  useEffect(() => {
    if (isAdmin && allDone && !prevDoneRef.current) setClaimCollapsed(true)
    prevDoneRef.current = allDone
  }, [allDone, isAdmin])

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
          <div onClick={isAdmin ? () => setClaimCollapsed((v) => !v) : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: isAdmin ? "pointer" : "default", marginBottom: (isAdmin && claimCollapsed) ? 0 : 10 }}>
            <h3 style={{ ...S.h3, marginBottom: 0 }}>{L.claimTitle}</h3>
            {isAdmin && <span style={{ fontSize: 12.5, color: "#9aa0ab", fontWeight: 700, flexShrink: 0 }}>{claimCollapsed ? L.collapseOpen : L.collapseClose}</span>}
          </div>
          {isAdmin && claimCollapsed
            ? <div onClick={() => setClaimCollapsed(false)} style={{ cursor: "pointer", fontSize: 12.5, color: "#1f8a4c", fontWeight: 700, padding: "2px 2px" }}>{L.allAssignedTapReview}</div>
            : items.length === 0
            ? <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>{L.noItemsScanFirst}</div>
            : participants.length === 0
            ? <div style={{ fontSize: 12.5, color: "#aaa", padding: 10 }}>{L.addGuestsInTab1}</div>
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
                        return <div style={{ fontSize: 12, fontWeight: 700, color: "#5a4a1a", background: "rgba(233,196,95,0.25)", borderRadius: 10, padding: "7px 11px", marginBottom: 12 }}>{L.yellowIs}<b>{sel?.name}</b>{L.orderedSuffix}</div>
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
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{it.name} <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a06b00", background: "rgba(233,196,95,0.2)", borderRadius: 8, padding: "1px 6px" }}>{L.sharedWord}</span></div>
                            <div style={{ fontSize: 11, color: "#999" }}>€{itemTotal(it).toFixed(2).replace(".", ",")} {L.totalLower}{ok ? ` · €${perHead.toFixed(2).replace(".", ",")} p.p.` : ""}</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 9px", color: ok ? "#1f8a4c" : "#c0392b", background: ok ? "rgba(39,174,96,0.12)" : "rgba(224,107,94,0.12)" }}>{ok ? `${heads} ${heads === 1 ? L.person : L.persons}` : L.nobodyYet}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 25 }}>
                          {participants.length === 0
                            ? <span style={{ fontSize: 11, color: "#aaa" }}>{L.addGuestsFirst}</span>
                            : participants.map((p) => {
                                const on = sh.includes(p.id)
                                const pSeats = Math.max(1, p.seats ?? 1)
                                const pHeads = myShareHeads(it.id, p.id)
                                return (
                                  <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <button onClick={() => {
                                      if (!on && explicitConfirmed(p.id) && !confirm(L.notSelectedShare(p.name))) return
                                      toggleShareClaim(it.id, p.id)
                                    }} style={{
                                      fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px", cursor: "pointer",
                                      border: on ? "none" : "1px solid rgba(16,24,40,0.12)",
                                      background: on ? (p.id === adminPid ? "rgba(233,196,95,0.5)" : "linear-gradient(135deg,#f3d27c,#ecc564)") : "#fff",
                                      color: on ? "#5a4a1a" : "#8b93a8",
                                    }}>{on ? "✓ " : ""}{p.name}{on && pSeats > 1 ? ` ×${pHeads}` : ""}</button>
                                    {on && pSeats > 1 && !fixed && (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                        <button onClick={() => setClaim(it.id, p.id, pHeads - 1)} title={L.fewerPersons} style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: 18, height: 18, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>−</button>
                                        <button onClick={() => setClaim(it.id, p.id, Math.min(pSeats, pHeads + 1))} title={L.morePersons} style={{ border: "none", background: "rgba(0,0,0,0.06)", borderRadius: 6, width: 18, height: 18, cursor: "pointer", fontSize: 12, lineHeight: 1 }} disabled={pHeads >= pSeats}>+</button>
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
                          ? <button onClick={() => setAssignItem(assignItem === it.id ? null : it.id)} style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "3px 10px", cursor: "pointer", border: "none", color: "#c0392b", background: "rgba(224,107,94,0.14)" }}>{open} {L.openAssign}</button>
                          : <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 10, padding: "2px 9px", color: "#1f8a4c", background: "rgba(39,174,96,0.12)" }}>{L.fullyClaimed}</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, marginLeft: 25, alignItems: "center" }}>
                        {who.map(({ p, q: pq }) => (
                          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "2px 4px 2px 9px", color: p.id === adminPid ? "#5a4a1a" : "#5a6680", background: p.id === adminPid ? "rgba(233,196,95,0.5)" : "rgba(90,108,166,0.1)" }}>
                            {p.name} ×{pq}
                            <button onClick={() => setClaim(it.id, p.id, Math.max(0, pq - 1))} title={L.removeOne} style={{ border: "2px solid #2b2f38", background: "#fff", color: "#c0392b", borderRadius: 6, width: 26, height: 22, cursor: "pointer", fontSize: 15, fontWeight: 800, lineHeight: 1 }}>−</button>
                          </span>
                        ))}
                        {who.length === 0 && open === 0 && <span style={{ fontSize: 11, color: "#aaa" }}>—</span>}
                      </div>
                      {assignItem === it.id && (
                        <AssignPicker participants={participants} itemId={it.id} confirmedFn={explicitConfirmed}
                          onAssign={(pid, warn) => { if (warn && !confirm(L.notSelectedAdd(participants.find((x) => x.id === pid)?.name))) return; setClaim(it.id, pid, myQty(it.id, pid) + 1); setAssignItem(null) }}
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
                <span>{L.unitsClaimed}</span>
                <span style={{ color: claimedUnits >= totalUnits ? "#1f8a4c" : "#c0392b" }}>{claimedUnits}/{totalUnits}{totalUnits > 0 && claimedUnits >= totalUnits ? " ✓" : ""}</span>
              </div>
              {sharedItems.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#5a6680", marginTop: 4 }}>
                  <span>{L.sharedItemsHandled}</span>
                  <span style={{ color: sharedDecided >= sharedItems.length ? "#1f8a4c" : "#c0392b" }}>{sharedDecided}/{sharedItems.length}{sharedDecided >= sharedItems.length ? " ✓" : ""}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#14213a", marginTop: 6 }}>
                <span>{L.billTotalLabel}</span>
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
        <h3 style={S.h3}>{L.forWhomTap}</h3>
        <p style={{ fontSize: 13, color: "#888", marginTop: -6, marginBottom: 12 }}>{L.pickPersonHint}</p>
        {participants.map((p) => (
          <button key={p.id} onClick={() => onPickMe(p.id)} style={{ ...S.btn, width: "100%", textAlign: "left", marginBottom: 6, padding: "12px 14px", fontWeight: 700 }}>{p.name}</button>
        ))}
        {participants.length === 0 && <div style={{ color: "#aaa", fontSize: 13 }}>{L.addGuestsInTab2}</div>}
      </div>
    )
  }

  const t = personTotal(meId)

  return (
    <div>
      {!finalized && reviewing && (
        <div style={{ width: "100%", marginBottom: 14, padding: "12px 16px", borderRadius: 14, background: "linear-gradient(135deg,#1499b0,#22b8cf)", color: "#fff", boxShadow: "0 6px 18px -6px rgba(20,153,176,0.55)" }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{L.adminReviewing}</div>
          <div style={{ fontSize: 12, opacity: 0.92, marginTop: 2 }}>{L.adminReviewingBody}</div>
        </div>
      )}
      {/* Pop-up zodra de beheerder afsluit: één duidelijke melding + meteen je verdeling zien */}
      {finalized && showFinalizedPopup && (
        <div style={{ ...S.overlay, zIndex: 3000 }} onClick={() => setShowFinalizedPopup(false)}>
          <div style={{ ...S.modal, width: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1f8a4c", margin: "0 0 6px" }}>{L.billClosedTitle2}</h3>
            <p style={{ fontSize: 13.5, color: "#5a6680", lineHeight: 1.5, margin: "0 0 12px" }}>{L.billClosedBody2}</p>
            <div style={{ fontSize: 34, fontWeight: 800, color: "#14213a", marginBottom: 16 }}>€{t.settled.toFixed(2).replace(".", ",")}{t.pendingShared ? "+" : ""}</div>
            <button onClick={() => { setShowFinalizedPopup(false); if (typeof document !== "undefined") setTimeout(() => document.getElementById("gast-eindverdeling")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60) }} style={{ ...S.btn, ...S.btnPrimary, width: "100%", padding: "12px 0", fontWeight: 800 }}>{L.viewMyShare}</button>
          </div>
        </div>
      )}
      <div style={S.card}>
        <h3 style={S.h3}>✅ {meId && seatsOf(meId) > 1 ? L.selectItemsPlural : L.selectItemsSingular}</h3>
        {items.length > 0 && (
          <div style={{ fontSize: 11.5, color: "#5a6680", background: "rgba(90,108,166,0.06)", borderRadius: 9, padding: "8px 10px", marginBottom: 11, lineHeight: 1.45 }}>💡 {L.assignShareHint}</div>
        )}
        {items.length === 0 && <div style={{ color: "#aaa", textAlign: "center", padding: 16, fontSize: 13 }}>{L.noItemsWaitScan}</div>}

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
                    <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span>{it.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "#7a5300", background: "rgba(233,196,95,0.45)", border: "1px solid rgba(196,152,32,0.5)", borderRadius: 7, padding: "1px 7px" }}>{L.sharedBadge}</span>
                    </div>
                    <div style={{ fontSize: 11, color: it.unit_price <= 0.0001 ? "#c0392b" : "#999", fontWeight: it.unit_price <= 0.0001 ? 700 : 400 }}>{it.unit_price <= 0.0001 ? `⚠️ ${L.zeroPriceShort}` : `€${itemTotal(it).toFixed(2).replace(".", ",")}${L.totalSharedByDrinkers}`}</div>
                  </div>
                  <button onClick={() => toggleShareClaim(it.id, meId)} style={{ ...S.btn, fontWeight: 700, ...(iShare ? { background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a", border: "none" } : {}) }}>{iShare ? L.iShareYes : L.iShareNo}</button>
                </div>
                {iShare && mySeats > 1 && !fixed && (
                  <div style={{ marginTop: 9, background: "rgba(90,108,166,0.07)", border: "1.5px solid rgba(90,108,166,0.35)", borderRadius: 12, padding: "10px 11px" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#14213a", marginBottom: 8 }}>{L.withHowMany(mySeats)}</div>
                    {(() => {
                      // Elk lid van de plaats is apart aan/uit te zetten — dus ook "enkel de tweede naam".
                      const raw = participants.find((p) => p.id === meId)?.name ?? ""
                      const parts = raw.split(/\s*&\s*|\s*\+\s*/).map((x) => x.trim()).filter(Boolean)
                      const sel: number[] = meId ? claimMembers(it.id, meId) : []
                      const toggle = (i: number) => {
                        const next = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]
                        setClaim(it.id, meId, next.length, next)
                      }
                      return (
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          {Array.from({ length: mySeats }, (_, i) => i).map((i) => {
                            const on = sel.includes(i)
                            const label = parts[i] || `${L.personWord} ${i + 1}`
                            return (
                              <button key={i} onClick={() => toggle(i)} style={{ flex: 1, minWidth: 96, fontSize: 13, fontWeight: 800, padding: "10px 6px", borderRadius: 10, cursor: "pointer", color: "#14213a", background: on ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff", border: on ? "1.5px solid transparent" : "1.5px solid rgba(16,24,40,0.15)" }}>{on ? "✓ " : ""}{label}</button>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}
                {it.is_shared && (() => {
                  const st = sharedStatus(it)
                  const msg = st.warn === "none" ? L.nobodyShared : st.warn === "few" ? L.tooFewShared(st.heads, st.expected as number) : st.warn === "one" ? L.onlyOneShares : null
                  if (!msg && !onSetExpected) return null
                  return (
                    <div style={{ marginTop: 8, background: msg ? "rgba(243,156,18,0.1)" : "rgba(90,108,166,0.06)", border: msg ? "1px solid rgba(243,156,18,0.45)" : "1px solid rgba(90,108,166,0.25)", borderRadius: 9, padding: "7px 10px" }}>
                      {msg && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#b5591a", lineHeight: 1.4 }}>{msg}</div>}
                      {onSetExpected && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: msg ? 7 : 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#5a6680" }}>{L.expectedSharers}</span>
                          <button onClick={() => onSetExpected(it.id, Math.max(0, (it.share_expected ?? 0) - 1) || null)} style={{ ...S.iconBtn, width: 24, height: 24, fontSize: 13 }}>−</button>
                          <b style={{ minWidth: 14, textAlign: "center", fontSize: 13, color: it.share_expected ? "#14213a" : "#c3c8d2" }}>{it.share_expected ?? "–"}</b>
                          <button onClick={() => onSetExpected(it.id, (it.share_expected ?? 0) + 1)} style={{ ...S.iconBtn, width: 24, height: 24, fontSize: 13, background: "rgba(27,42,74,0.12)" }}>+</button>
                          <span style={{ fontSize: 10.5, color: "#9aa0ab" }}>{L.sharedByLabel} {st.heads}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
                {iShare && (
                  revealed ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.45, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}><ShareIcon on size={14} /></span>
                      <span>{fixed
                        ? <>{L.yourShareLabel}{myShare.toFixed(2).replace(".", ",")}{myHeads > 1 ? L.forNPers(myHeads) : ""}{L.sharedByMid}{heads} {heads === 1 ? L.person : L.persons}{L.fixedByAdmin}</>
                        : <>{L.provisionally}{myShare.toFixed(2).replace(".", ",")}{myHeads > 1 ? L.youN(myHeads) : ""}{L.sharedByMid}{heads} {heads === 1 ? L.person : L.persons}{L.dropsIfMore}</>}</span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#5a6680", background: "rgba(90,108,166,0.08)", border: "1px solid rgba(90,108,166,0.25)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.45 }}>
                      {L.sharingWaitReveal}
                    </div>
                  )
                )}
                {!iShare && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#9aa0ab", lineHeight: 1.4 }}>{L.tapShareHint}</div>
                )}
              </div>
            )
          }
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere", minWidth: 0 }}>{it.name}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: it.unit_price <= 0.0001 ? "#c0392b" : "#1499b0", flexShrink: 0 }}>€{it.unit_price.toFixed(2).replace(".", ",")}</span>
                  <button onClick={() => onToggleShared(it)} title={it.is_shared ? L.makeUnsharedTitle : L.makeSharedTitle}
                    style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, padding: "5px 9px", borderRadius: 8, cursor: "pointer",
                      color: it.is_shared ? "#7a5300" : "#5a6680",
                      background: it.is_shared ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff",
                      border: it.is_shared ? "1px solid rgba(196,152,32,0.5)" : "1px solid rgba(16,24,40,0.15)" }}>
                    <ShareIcon on={it.is_shared} size={12} />{it.is_shared ? L.sharedOnShort : L.makeSharedShort}
                  </button>
                </div>
                {it.unit_price <= 0.0001
                  ? <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#c0392b", fontWeight: 700 }}>⚠️ {L.zeroPriceShort}</span>
                      {onDeleteItem && <button onClick={(e) => { e.stopPropagation(); onDeleteItem(it.id) }} style={{ fontSize: 10.5, fontWeight: 800, color: "#c0392b", background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.4)", borderRadius: 7, padding: "2px 8px", cursor: "pointer" }}>🗑️ {L.zeroPriceDelete}</button>}
                    </div>
                  : <div style={{ fontSize: 11, color: open > 0 ? "#e0685c" : "#1f8a4c", fontWeight: 600 }}>{total}{L.orderedMid}{open > 0 ? L.stillFree(open) : L.allClaimedWord}</div>}
              </div>
              <button style={{ width: 42, height: 34, fontSize: 20, fontWeight: 800, lineHeight: 1, borderRadius: 8, cursor: mine > 0 ? "pointer" : "default", color: mine > 0 ? "#c0392b" : "#c9ced8", background: "#fff", border: "2px solid " + (mine > 0 ? "#2b2f38" : "#e2e6ee") }} onClick={() => setClaim(it.id, meId, Math.max(0, mine - 1))} disabled={mine <= 0} title={L.removeOne}>−</button>
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
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a93a3", textTransform: "uppercase", marginBottom: 8 }}>{L.aboutToConfirm}</div>
              {mine.length === 0 && <div style={{ fontSize: 13, color: "#aaa" }}>{L.nothingTappedYet}</div>}
              {mine.map((d, k) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: "#3b486a" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{d.shared && <ShareIcon on size={14} />}{d.qty > 1 ? `${d.qty}× ` : ""}{showTip(d.name, L)}{d.shared ? (d.revealed ? (meId && seatsOf(meId) > 1 ? L.sharedNPers(d.myHeads) : L.sharedPart) : L.sharedByN(d.sharers)) : ""}</span>
                  <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>
                    {d.shared && !d.revealed ? L.toBeDivided : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
              ))}
            </div>
          )
        })()}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(90,108,166,0.18)", paddingTop: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#5a6680" }}>{L.yourTotal}</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#14213a" }}>€{t.settled.toFixed(2).replace(".", ",")}{t.pendingShared ? "+" : ""}</span>
        </div>
        {t.pendingShared && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "#a06b00", background: "rgba(233,196,95,0.14)", border: "1px solid rgba(233,196,95,0.4)", borderRadius: 10, padding: "8px 11px", lineHeight: 1.4 }}>
            {L.sharingPendingNote}
          </div>
        )}
        {finalized && (
          <div id="gast-eindverdeling" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(90,108,166,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 15 }}>✅</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#1f8a4c" }}>{L.allHandledFinal}</span>
            </div>
            <div style={{ fontSize: 12, color: "#8a93a3", marginBottom: 8 }}>{L.fullBillInfo}</div>
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
                      <span style={{ fontSize: 13.5, fontWeight: isMe ? 800 : 600, color: "#14213a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{isMe ? L.youSuffix : ""}</span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#14213a", flexShrink: 0, marginLeft: 8 }}>€{pt.settled.toFixed(2).replace(".", ",")}{pt.pendingShared ? "+" : ""}</span>
                  </div>
                  {rowOpen && (
                    <div style={{ padding: "0 8px 10px 26px" }}>
                      {detail.length === 0 && <div style={{ fontSize: 12.5, color: "#aaa" }}>{L.nothingTapped2}</div>}
                      {detail.map((d, k) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#5a6680", padding: "2px 0" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{d.shared && <ShareIcon on size={14} />}{d.qty > 1 ? `${d.qty}× ` : ""}{showTip(d.name, L)}{d.shared ? (d.revealed ? L.sharedPart : L.sharedByN(d.sharers)) : ""}</span>
                          <span style={{ fontWeight: 700, color: d.shared && !d.revealed ? "#a06b00" : "#14213a" }}>{d.shared && !d.revealed ? L.toBeDivided : `${d.shared ? "≈ " : ""}€${d.amount.toFixed(2).replace(".", ",")}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(16,24,40,0.1)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6680" }}>{L.billTotalLabel}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#14213a" }}>€{participants.reduce((s, p) => s + personTotal(p.id).settled, 0).toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        )}
        {!(finalized && !isAdmin) && (
          <button onClick={confirmMe} style={{ ...S.btn, width: "100%", marginTop: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, border: "none", ...(iConfirmed ? { background: "rgba(39,174,96,0.12)", color: "#1f8a4c" } : { background: "linear-gradient(135deg,#f3d27c,#ecc564)", color: "#14213a" }) }}>
            {iConfirmed ? L.confirmedTapEdit : L.confirmMyOrder}
          </button>
        )}
        {finalized && !isAdmin && (
          <div style={{ marginTop: 12 }}>
            {disputeOpen ? (
              <div style={{ background: "rgba(90,108,166,0.06)", border: "1px solid rgba(90,108,166,0.2)", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5a6680", marginBottom: 7 }}>{L.whatWrong}</div>
                <textarea value={disputeText} onChange={(e) => setDisputeText(e.target.value)} placeholder={L.disputePlaceholder} rows={2} style={{ ...S.input, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => { setDisputeOpen(false); setDisputeText("") }} style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13 }}>{L.cancel}</button>
                  <button onClick={() => { onToggleDispute(true, disputeText); setDisputeOpen(false); setDisputeText("") }} style={{ ...S.btn, flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 700, border: "none", background: "linear-gradient(135deg,#1499b0,#22b8cf)", color: "#fff" }}>{L.send}</button>
                </div>
              </div>
            ) : iResolved ? (
              <div style={{ fontSize: 12.5, color: "#1f8a4c", background: "rgba(39,174,96,0.12)", border: "1px solid rgba(39,174,96,0.4)", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45, textAlign: "center", fontWeight: 700 }}>
                {L.remarkResolved}
                {iComment && <div style={{ marginTop: 6, fontWeight: 600, fontStyle: "italic", color: "#1f8a4c", opacity: 0.85 }}>{L.yourRemark}“{iComment}”</div>}
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => { setDisputeText(""); setDisputeOpen(true) }} style={{ ...S.btn, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, background: "#fff", border: "1px solid rgba(20,33,58,0.18)", color: "#5a6680" }}>{L.addAnotherRemark}</button>
                </div>
              </div>
            ) : iDispute ? (
              <div style={{ fontSize: 12.5, color: "#a06b00", background: "rgba(233,196,95,0.16)", border: "1px solid rgba(233,196,95,0.5)", borderRadius: 12, padding: "10px 12px", lineHeight: 1.45, textAlign: "center" }}>
                {L.remarkReceived}
                {iComment && <div style={{ marginTop: 6, fontWeight: 600, fontStyle: "italic", color: "#a06b00", opacity: 0.9 }}>{L.yourRemark}“{iComment}”</div>}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => { onToggleDispute(false); setDisputeOpen(false); setDisputeText("") }} style={{ background: "none", border: "none", padding: 0, color: "#1499b0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{L.withdraw}</button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <button onClick={() => { setDisputeText(""); setDisputeOpen(true) }} style={{ ...S.btn, padding: "10px 18px", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid rgba(20,33,58,0.18)", color: "#5a6680" }}>
                  {L.somethingWrong}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ShareIcon({ on, size = 20 }: { on?: boolean; size?: number }) {
  if (!on) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
        <circle cx="8" cy="13" r="5" fill="none" stroke="#5a6680" strokeWidth="2.2" />
        <circle cx="16" cy="13" r="5" fill="none" stroke="#5a6680" strokeWidth="2.2" />
        <circle cx="12" cy="9" r="5" fill="none" stroke="#5a6680" strokeWidth="2.2" />
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
  const [lang] = useLang()
  const L = STRINGS[lang]
  const seats = Math.max(1, n)
  const capIcons = compact ? 2 : 6
  const icons = Math.min(seats, capIcons)
  const atMax = max != null && seats >= max
  const bw = compact ? 16 : 18
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: compact ? 3 : 5, background: "rgba(90,108,166,0.1)", borderRadius: 9, padding: compact ? "2px 4px" : "2px 5px 2px 8px", flexShrink: 0 }} title={L.seatsControlTitle}>
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
