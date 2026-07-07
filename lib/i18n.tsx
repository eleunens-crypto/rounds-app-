"use client"
import { useEffect, useState } from "react"
import type { CSSProperties } from "react"

export type Lang = "nl" | "fr"
const KEY = "rundo_lang"

// Bepaalt de actieve taal. Volgorde is bewust:
// 1) /nl of /fr in de URL  -> voor later, als je op je eigen domein taal-paden gebruikt.
// 2) eerdere keuze in localStorage.
// 3) browsertaal (fr* -> Frans).
// 4) standaard Nederlands.
// Zo hoef je later, bij het overstappen op /nl en /fr, hier niets te veranderen:
// de URL krijgt gewoon vanzelf voorrang.
export function getLang(): Lang {
  if (typeof window !== "undefined") {
    const seg = window.location.pathname.split("/").filter(Boolean)[0]
    if (seg === "nl" || seg === "fr") return seg
    try {
      const stored = localStorage.getItem(KEY)
      if (stored === "nl" || stored === "fr") return stored
    } catch {}
    if ((navigator.language || "").toLowerCase().startsWith("fr")) return "fr"
  }
  return "nl"
}

export function setLang(l: Lang) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(KEY, l) } catch {}
  window.dispatchEvent(new CustomEvent("rundo-lang-change", { detail: l }))
}

// Hook voor in elk component: const [lang, changeLang] = useLang()
// Alle componenten die deze hook gebruiken, wisselen samen mee zodra iemand de taal verandert.
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("nl")
  useEffect(() => {
    setLangState(getLang())
    const on = () => setLangState(getLang())
    window.addEventListener("rundo-lang-change", on)
    return () => window.removeEventListener("rundo-lang-change", on)
  }, [])
  return [lang, (l: Lang) => { setLang(l); setLangState(l) }]
}

// Herbruikbare NL/FR-schakelaar in de stijl van de app (voor split-scherm, startscherm, of in een pagina).
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const [lang, change] = useLang()
  const pill = (l: Lang): CSSProperties => ({
    border: "none",
    background: lang === l ? "linear-gradient(135deg,#1499b0,#22b8cf)" : "transparent",
    color: lang === l ? "#fff" : "#5a6680",
    fontWeight: 800,
    fontSize: compact ? 12 : 13,
    padding: compact ? "4px 10px" : "5px 13px",
    borderRadius: 999,
    cursor: "pointer",
    lineHeight: 1,
    boxShadow: lang === l ? "0 2px 8px -2px rgba(20,153,176,0.7)" : "none",
  })
  return (
    <span style={{ display: "inline-flex", background: "#fff", border: "1px solid rgba(20,33,58,0.12)", borderRadius: 999, padding: 3, boxShadow: "0 2px 8px rgba(16,24,40,0.06)" }}>
      <button onClick={() => change("nl")} style={pill("nl")} aria-label="Nederlands">NL</button>
      <button onClick={() => change("fr")} style={pill("fr")} aria-label="Français">FR</button>
    </span>
  )
}
