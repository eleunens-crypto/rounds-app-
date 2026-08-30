"use client"

// ─────────────────────────────────────────────────────────────────────────────
// RUNDO PARTY — TESTPAGINA v7
// - Betaling bevestigen -> rondjes-hub (overzicht) -> nieuw rondje / afrekenen
// - Bewerken (toewijzen + bekers) in het overzicht; app herberekent automatisch
// - Home-knop op elk scherm (geen reset); coin-prijzen zichtbaar/aanpasbaar
// Richtprijzen blijven ONZICHTBAAR bij bestellen. Volledig lokaal. app/party-test/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { QRCodeSVG } from "qrcode.react"
import { useLang, LanguageToggle } from "@/lib/i18n"

// Klinkende glazen — hetzelfde beeld als op het keuzescherm tussen Table en Party, maar
// getekend in plaats van een emoji: zo neemt het de goudkleur over en oogt het op elk
// toestel hetzelfde.
function KlinkIcoon({ size = 32, kleur = "#eab117" }: { size?: number; kleur?: string }) {
  return (
    <svg viewBox="0 0 30 24" width={size} height={size * 0.86} fill="none" stroke={kleur}
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7.5 4.5h9l-1.1 5.4a3.4 3.4 0 0 1-6.8 0z" />
      <path d="M12 13.4v5.2M9.4 19.2h5.2" />
      <path d="M19.5 6.2l7.8 2.2-2.6 4.9a3.4 3.4 0 0 1-6.3-1.8z" />
      <path d="M22.4 15.1l-1.4 5M18.6 21.2l5-1.4" />
      <path d="M16.4 2.2l.7-1.6M19.6 3.1l1.4-1M13.4 2.6l-.4-1.7" strokeWidth={1.5} />
    </svg>
  )
}

// Een getekende gsm. Drie varianten: met notitieregels (jij noteert), met een QR op het
// scherm (de gast scant), of leeg en doorschijnend voor de twee kleintjes ernaast.
// Getekend in plaats van een emoji, zodat hij de kleur van de modus overneemt en op elk
// toestel hetzelfde oogt.
function NoteerIcoon({ size = 84, kleur = "#e8a812" }: { size?: number; kleur?: string }) {
  return (
    <svg viewBox="0 0 84 62" width={size} height={size * 62 / 84} aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx={14} cy={20} r={6.5} fill="none" stroke={kleur} strokeWidth={1.8} />
      <path d="M3.5 42c0-5.8 4.7-10.5 10.5-10.5S24.5 36.2 24.5 42" fill="none" stroke={kleur} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M23.5 35.5c6-2.6 10.5-4.6 13-5.7" stroke={kleur} strokeWidth={1.8} strokeLinecap="round" />
      <g transform="rotate(-4 58 30)">
        <rect x={34.5} y={1.5} width={47} height={55} rx={3.5} fill="#fcfdfe" stroke={kleur} strokeWidth={1.6} />
        <path d="M42.1 8.9c-.7 0-1.27-.57-1.27-1.27 0-.6.42-1.12 1.03-1.24.09-1.1.7-1.6 1.4-1.6.3 0 .58.1.81.27.27-.55.88-.91 1.58-.91.76 0 1.41.44 1.72 1.09.17-.9.36-.13.57-.13.74 0 1.33.6 1.33 1.33 0 .09 0 .17-.2.26.48.19.8.65.8 1.19 0 .7-.57 1.27-1.27 1.27" fill="none" stroke={kleur} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
        <path d="M41.6 8.6h7.2v6.6a1.1 1.1 0 0 1-1.1 1.1h-5a1.1 1.1 0 0 1-1.1-1.1z" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" />
        <path d="M48.8 10.2h1.3a1.15 1.15 0 0 1 1.15 1.15v1.7a1.15 1.15 0 0 1-1.15 1.15h-1.3" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" />
        <path d="M43.4 10.6v3.6M45.2 10.6v3.6M47 10.6v3.6" stroke={kleur} strokeWidth={1} strokeLinecap="round" />
        <text x={59} y={13.6} fontSize={7.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×1</text>
        <path d="M41 21.5h7.4l-3.7 4.4zM44.7 25.9v3.4M42.7 29.3h4" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" strokeLinecap="round" />
        <text x={59} y={27} fontSize={7.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×2</text>
        <path d="M41.6 33.6h6.9l-.73 7.5a1.05 1.05 0 0 1-1.05.95h-3.34a1.05 1.05 0 0 1-1.05-.95z" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" />
        <path d="M41.9 36.8c1.1.68 1.95-.55 3.05 0 1.1.55 2.05-.5 3.2-.05" fill="none" stroke={kleur} strokeWidth={1} strokeLinecap="round" />
        <path d="M46.6 33.6l.9-2.5 1.6.65" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" strokeLinecap="round" />
        <text x={59} y={39} fontSize={7.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×3</text>
        <path d="M40 46h36" stroke={kleur} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
        <text x={58.5} y={53.5} fontSize={8.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×6</text>
      </g>
    </svg>
  )
}

function BonIcoon({ size = 46, kleur = "#e8a812" }: { size?: number; kleur?: string }) {
  return (
    <svg viewBox="0 0 50 58" width={size} height={size * 58 / 50} aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x={1.5} y={1.5} width={47} height={55} rx={3.5} fill="#fcfdfe" stroke={kleur} strokeWidth={1.6} />
      <path d="M9.1 8.9c-.7 0-1.27-.57-1.27-1.27 0-.6.42-1.12 1.03-1.24.09-1.1.7-1.6 1.4-1.6.3 0 .58.1.81.27.27-.55.88-.91 1.58-.91.76 0 1.41.44 1.72 1.09.17-.9.36-.13.57-.13.74 0 1.33.6 1.33 1.33 0 .09 0 .17-.2.26.48.19.8.65.8 1.19 0 .7-.57 1.27-1.27 1.27" fill="none" stroke={kleur} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M8.6 8.6h7.2v6.6a1.1 1.1 0 0 1-1.1 1.1H9.7a1.1 1.1 0 0 1-1.1-1.1z" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" />
      <path d="M15.8 10.2h1.3a1.15 1.15 0 0 1 1.15 1.15v1.7a1.15 1.15 0 0 1-1.15 1.15h-1.3" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" />
      <path d="M10.4 10.6v3.6M12.2 10.6v3.6M14 10.6v3.6" stroke={kleur} strokeWidth={1} strokeLinecap="round" />
      <text x={26} y={13.6} fontSize={7.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×1</text>
      <path d="M8 21.5h7.4l-3.7 4.4zM11.7 25.9v3.4M9.7 29.3h4" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" strokeLinecap="round" />
      <text x={26} y={27} fontSize={7.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×2</text>
      <path d="M8.6 33.6h6.9l-.73 7.5a1.05 1.05 0 0 1-1.05.95h-3.34a1.05 1.05 0 0 1-1.05-.95z" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" />
      <path d="M8.9 36.8c1.1.68 1.95-.55 3.05 0 1.1.55 2.05-.5 3.2-.05" fill="none" stroke={kleur} strokeWidth={1} strokeLinecap="round" />
      <path d="M13.6 33.6l.9-2.5 1.6.65" fill="none" stroke={kleur} strokeWidth={1.15} strokeLinejoin="round" strokeLinecap="round" />
      <text x={26} y={39} fontSize={7.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×3</text>
      <path d="M7 46h36" stroke={kleur} strokeWidth={1.1} strokeLinecap="round" opacity={0.55} />
      <text x={25.5} y={53.5} fontSize={8.5} fontWeight={800} fill="#8a5e0f" fontFamily="system-ui">×6</text>
    </svg>
  )
}

function NamenIcoon({ size = 46, kleur = "#7a3f6d" }: { size?: number; kleur?: string }) {
  // Drie namen met hun drankjes en wat ze kosten. De munten staan overal even ver uit
  // elkaar, zodat de rijen van Tom, Els en Bart onderling te vergelijken zijn.
  const R = 4.3
  const START = 48
  const STAP = 9.6
  const munt = (n: number, cy: number) => (
    Array.from({ length: n }).map((_, k) => {
      const cx = START + k * STAP
      return (
        <g key={`${cy}-${k}`}>
          <circle cx={cx} cy={cy} r={R} fill="#f3d27c" stroke="#d9a83c" strokeWidth={1.2} />
          <text x={cx} y={cy + 2.4} fontSize={5.6} fontWeight={800} fill="#7a5a12" fontFamily="system-ui" textAnchor="middle">€</text>
        </g>
      )
    })
  )
  return (
    <svg viewBox="0 0 74 48" width={size} height={size * 48 / 74} aria-hidden="true" style={{ flexShrink: 0 }}>
      {/* Namen rechts uitgelijnd: dan houdt elk glas dezelfde afstand, hoe lang de naam ook is. */}
      <text x={19} y={11.5} fontSize={7} fontWeight={800} fill={kleur} fontFamily="system-ui" textAnchor="end">Tom</text>
      <text x={19} y={27.5} fontSize={7} fontWeight={800} fill={kleur} fontFamily="system-ui" textAnchor="end">Els</text>
      <text x={19} y={43.5} fontSize={7} fontWeight={800} fill={kleur} fontFamily="system-ui" textAnchor="end">Bart</text>

      <path d="M24.6 6.4c-.7 0-1.27-.57-1.27-1.27 0-.6.42-1.12 1.03-1.24.09-1.1.7-1.6 1.4-1.6.3 0 .58.1.81.27.27-.55.88-.91 1.58-.91.76 0 1.41.44 1.72 1.09.17-.9.36-.13.57-.13.74 0 1.33.6 1.33 1.33 0 .09 0 .17-.2.26.48.19.8.65.8 1.19 0 .7-.57 1.27-1.27 1.27" fill="none" stroke={kleur} strokeWidth={1} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M24.1 6.1h6.6v6a1 1 0 0 1-1 1h-4.6a1 1 0 0 1-1-1z" fill="none" stroke={kleur} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M30.7 7.6h1.2a1.05 1.05 0 0 1 1.05 1.05v1.55a1.05 1.05 0 0 1-1.05 1.05h-1.2" fill="none" stroke={kleur} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M25.8 8v3.2M27.4 8v3.2M29 8v3.2" stroke={kleur} strokeWidth={0.95} strokeLinecap="round" />
      {munt(2, 9)}

      <path d="M24.1 22h4.6l-2.3 4zM26.4 26v3.1M25.1 29.1h2.6" fill="none" stroke={kleur} strokeWidth={1.05} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M28.7 22h4.6l-2.3 4zM31 26v3.1M29.7 29.1h2.6" fill="none" stroke={kleur} strokeWidth={1.05} strokeLinejoin="round" strokeLinecap="round" />
      {munt(3, 25)}

      <path d="M26.8 37h6.3l-.67 6.9a1 1 0 0 1-1 .9h-3a1 1 0 0 1-1-.9z" fill="none" stroke={kleur} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M27.1 39.9c1 .62 1.8-.5 2.8 0 1 .5 1.9-.45 2.95-.05" fill="none" stroke={kleur} strokeWidth={0.95} strokeLinecap="round" />
      <path d="M31.4 37l.85-2.3 1.5.6" fill="none" stroke={kleur} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
      {munt(1, 41)}
    </svg>
  )
}

function MicroIcoon({ size = 18, kleur = "#8a5e0f" }: { size?: number; kleur?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={kleur}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4M9 21h6" />
    </svg>
  )
}

function KroonIcoon({ size = 15, kleur = "#0a6070", gevuld = false }: { size?: number; kleur?: string; gevuld?: boolean }) {
  // Strakke kroon met ronde punten en losse stippen: moderner dan de klassieke
  // gekartelde vorm, en op klein formaat nog steeds herkenbaar.
  return (
    <svg viewBox="0 0 24 20" width={size} height={size * 0.83} fill="none" stroke={kleur}
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M3.4 15.6 2.6 7.4l5 3.4 4.4-6 4.4 6 5-3.4-.8 8.2z" fill={gevuld ? kleur : "none"} opacity={gevuld ? 0.18 : 1} stroke={kleur} />
      <circle cx="2.6" cy="5.6" r="1.5" fill={kleur} stroke="none" />
      <circle cx="12" cy="3.4" r="1.6" fill={kleur} stroke="none" />
      <circle cx="21.4" cy="5.6" r="1.5" fill={kleur} stroke="none" />
      <path d="M4 18.6h16" />
    </svg>
  )
}

function ZakjeIcoon({ size = 15 }: { size?: number }) {
  // Het gouden geldzakje van de potbadge, klein genoeg voor in een tekstregel.
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0, verticalAlign: "-2px" }}>
      <path d="M16 13 L14 7 Q20 5 26 7 L24 13 Z" fill="#d99616" stroke="#b9821a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M13 14 Q20 11 27 14 Q33 19 32 27 Q31 35 20 35 Q9 35 8 27 Q7 19 13 14 Z" fill="#e8a821" stroke="#b9821a" strokeWidth="1.5" />
      <text x="20" y="29" fontSize="12" fontWeight="800" fill="#5a3d0a" textAnchor="middle">€</text>
    </svg>
  )
}

function PotloodIcoon({ size = 14, kleur = "#9aa3b2" }: { size?: number; kleur?: string }) {
  // Klein potloodje rechts in een naamveld: "hier mag geschreven worden". Zelfde
  // grijs als de placeholder; de wrapper verbergt hem zodra er een naam staat.
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17 3.5l3.5 3.5L8 19.5 4 20l.5-4z" />
    </svg>
  )
}

function BonKnopIcoon({ size = 16, kleur = "#6b7484" }: { size?: number; kleur?: string }) {
  // Klein kassabonnetje met kartelrand voor in knoppen — kleurt mee met zijn knop.
  // (Niet te verwarren met BonIcoon, de grote getekende bon op de modekaarten.)
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </svg>
  )
}

function GsmIcoon({ size = 44, kleur = "#1d2942", lijnen = false, qr = false, dof = false }:
  { size?: number; kleur?: string; lijnen?: boolean; qr?: boolean; dof?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={kleur}
      strokeWidth={dof ? 1.9 : 1.7} strokeLinejoin="round" opacity={dof ? 0.5 : 1} aria-hidden="true">
      <rect x="5" y="1.5" width="14" height="21" rx="3.2" />
      <path d="M10 3.9h4" strokeWidth={dof ? 1.7 : 1.5} strokeLinecap="round" />
      <circle cx="12" cy="20" r="0.9" fill={kleur} stroke="none" />
      {lijnen && <path d="M8.4 8.4h7.2M8.4 11.4h7.2M8.4 14.4h4.4" strokeWidth={1.5} strokeLinecap="round" />}
      {qr && (<>
        <rect x="7.6" y="6.6" width="3.4" height="3.4" rx="0.6" />
        <rect x="13" y="6.6" width="3.4" height="3.4" rx="0.6" />
        <rect x="7.6" y="12" width="3.4" height="3.4" rx="0.6" />
        <rect x="13.8" y="12.8" width="1.8" height="1.8" fill={kleur} stroke="none" />
        <rect x="13.8" y="15.6" width="1.8" height="1.8" fill={kleur} stroke="none" />
      </>)}
    </svg>
  )
}

// Rundo-logo — exact hetzelfde symbool als in de app zelf (ingebed als afbeelding)
// Rundo woordmerk — Poppins SemiBold, omgezet naar vectorpaden.
// Geen font-afhankelijkheid: rendert overal identiek.
//
//   <RundoLogo size={34} />              → Rundo, wit op donker
//   <RundoLogo size={34} opDonker={false} /> → Rundo, donkerblauw op licht
//   <RundoLogo size={34} resto />        → Rundo Resto
//
// Hoogte stuurt de maat; de breedte volgt de verhouding.

const GOUD = "#F5B301"
const TURQUOISE = "#4FD1C5"
const DONKER = "#0E1A2E"

const BOOG = "M14.90 30.56A34.0 34.0 0 0 1 -33.98 -1.19A34.0 34.0 0 0 1 17.00 -29.44"
const PIJL = "28.26,-22.94 18.40,-37.87 10.40,-24.02"
const LETTER_R = "M58.69 74.9 49.45 58.58H45.49V74.9H37.09V33.02H52.81Q57.67 33.02 61.09 34.73Q64.51 36.44 66.22 39.35Q67.93 42.26 67.93 45.86Q67.93 50 65.53 53.33Q63.13 56.66 58.39 57.92L68.41 74.9ZM45.49 52.28H52.51Q55.93 52.28 57.61 50.63Q59.29 48.98 59.29 46.04Q59.29 43.16 57.61 41.57Q55.93 39.98 52.51 39.98H45.49Z"
const WOORD_UNDO = "M105.38 44.98V74.9H97.76V71.12Q96.31 73.06 93.96 74.17Q91.61 75.28 88.85 75.28Q85.34 75.28 82.64 73.79Q79.94 72.31 78.41 69.42Q76.87 66.53 76.87 62.53V44.98H84.43V61.45Q84.43 65.02 86.21 66.94Q87.99 68.85 91.07 68.85Q94.2 68.85 95.98 66.94Q97.76 65.02 97.76 61.45V44.98ZM140.74 57.35V74.9H133.18V58.38Q133.18 54.81 131.4 52.9Q129.62 50.98 126.54 50.98Q123.41 50.98 121.6 52.9Q119.79 54.81 119.79 58.38V74.9H112.23V44.98H119.79V48.71Q121.3 46.77 123.65 45.66Q126 44.55 128.81 44.55Q134.15 44.55 137.45 47.93Q140.74 51.3 140.74 57.35ZM159.1 44.5Q162.01 44.5 164.66 45.77Q167.3 47.04 168.87 49.14V34.94H176.54V74.9H168.87V70.47Q167.47 72.69 164.93 74.04Q162.39 75.39 159.04 75.39Q155.26 75.39 152.13 73.44Q149 71.5 147.19 67.96Q145.38 64.42 145.38 59.83Q145.38 55.3 147.19 51.79Q149 48.28 152.13 46.39Q155.26 44.5 159.1 44.5ZM160.99 51.14Q158.88 51.14 157.1 52.17Q155.32 53.19 154.21 55.16Q153.1 57.13 153.1 59.83Q153.1 62.53 154.21 64.56Q155.32 66.58 157.12 67.66Q158.93 68.74 160.99 68.74Q163.09 68.74 164.93 67.69Q166.76 66.64 167.84 64.67Q168.92 62.7 168.92 59.94Q168.92 57.19 167.84 55.22Q166.76 53.25 164.93 52.19Q163.09 51.14 160.99 51.14ZM181.45 59.94Q181.45 55.35 183.47 51.84Q185.5 48.33 189.01 46.42Q192.52 44.5 196.84 44.5Q201.16 44.5 204.67 46.42Q208.18 48.33 210.2 51.84Q212.23 55.35 212.23 59.94Q212.23 64.53 210.15 68.04Q208.07 71.55 204.53 73.47Q200.99 75.39 196.62 75.39Q192.3 75.39 188.84 73.47Q185.39 71.55 183.42 68.04Q181.45 64.53 181.45 59.94ZM204.45 59.94Q204.45 55.68 202.21 53.38Q199.97 51.09 196.73 51.09Q193.49 51.09 191.3 53.38Q189.11 55.68 189.11 59.94Q189.11 64.21 191.25 66.5Q193.38 68.8 196.62 68.8Q198.67 68.8 200.48 67.8Q202.29 66.8 203.37 64.8Q204.45 62.8 204.45 59.94Z"
const WOORD_RESTO = "M249.48 74.9 241.16 60.21H237.6V74.9H230.04V37.21H244.19Q248.56 37.21 251.64 38.75Q254.72 40.29 256.26 42.91Q257.8 45.52 257.8 48.76Q257.8 52.49 255.64 55.49Q253.48 58.48 249.21 59.62L258.23 74.9ZM237.6 54.54H243.92Q247 54.54 248.51 53.06Q250.02 51.57 250.02 48.93Q250.02 46.33 248.51 44.9Q247 43.47 243.92 43.47H237.6ZM291.65 62.21H269.78Q270.05 65.45 272.05 67.29Q274.04 69.12 276.96 69.12Q281.17 69.12 282.95 65.5H291.11Q289.81 69.82 286.14 72.61Q282.47 75.39 277.12 75.39Q272.8 75.39 269.37 73.47Q265.94 71.55 264.03 68.04Q262.11 64.53 262.11 59.94Q262.11 55.3 264 51.79Q265.89 48.28 269.29 46.39Q272.69 44.5 277.12 44.5Q281.39 44.5 284.76 46.33Q288.14 48.17 290 51.55Q291.86 54.92 291.86 59.29Q291.86 60.91 291.65 62.21ZM284.03 57.13Q283.98 54.22 281.93 52.46Q279.88 50.71 276.91 50.71Q274.1 50.71 272.18 52.41Q270.26 54.11 269.83 57.13ZM295.15 65.45H302.77Q302.98 67.18 304.47 68.31Q305.95 69.45 308.17 69.45Q310.33 69.45 311.54 68.58Q312.76 67.72 312.76 66.37Q312.76 64.91 311.27 64.18Q309.79 63.45 306.55 62.59Q303.2 61.78 301.06 60.91Q298.93 60.05 297.39 58.27Q295.85 56.49 295.85 53.46Q295.85 50.98 297.28 48.93Q298.72 46.87 301.39 45.69Q304.06 44.5 307.68 44.5Q313.03 44.5 316.21 47.17Q319.4 49.84 319.72 54.38H312.49Q312.32 52.6 311 51.55Q309.68 50.49 307.46 50.49Q305.41 50.49 304.3 51.25Q303.2 52 303.2 53.35Q303.2 54.87 304.71 55.65Q306.22 56.43 309.41 57.24Q312.65 58.05 314.75 58.92Q316.86 59.78 318.4 61.59Q319.94 63.4 319.99 66.37Q319.99 68.96 318.56 71.01Q317.13 73.06 314.46 74.23Q311.78 75.39 308.22 75.39Q304.55 75.39 301.63 74.06Q298.72 72.74 297.01 70.47Q295.31 68.2 295.15 65.45ZM334.4 51.19V65.67Q334.4 67.18 335.13 67.85Q335.86 68.53 337.59 68.53H341.1V74.9H336.35Q326.79 74.9 326.79 65.61V51.19H323.23V44.98H326.79V37.59H334.4V44.98H341.1V51.19ZM344.06 59.94Q344.06 55.35 346.09 51.84Q348.11 48.33 351.62 46.42Q355.13 44.5 359.45 44.5Q363.77 44.5 367.28 46.42Q370.79 48.33 372.82 51.84Q374.84 55.35 374.84 59.94Q374.84 64.53 372.76 68.04Q370.69 71.55 367.15 73.47Q363.61 75.39 359.24 75.39Q354.92 75.39 351.46 73.47Q348.01 71.55 346.03 68.04Q344.06 64.53 344.06 59.94ZM367.07 59.94Q367.07 55.68 364.83 53.38Q362.59 51.09 359.35 51.09Q356.11 51.09 353.92 53.38Q351.73 55.68 351.73 59.94Q351.73 64.21 353.86 66.5Q356 68.8 359.24 68.8Q361.29 68.8 363.1 67.8Q364.91 66.8 365.99 64.8Q367.07 62.8 367.07 59.94Z"

function RundoLogo({
  size = 40,
  opDonker = true,
  resto = false,
  mono,
}: {
  size?: number
  /** true = op donkere achtergrond (witte letters), false = op lichte (donkerblauw) */
  opDonker?: boolean
  /** toont "Rundo Resto" in plaats van "Rundo" */
  resto?: boolean
  /** alles in één kleur, bv. voor drukwerk of een stempel */
  mono?: string
}) {
  const letter = mono ?? (opDonker ? "#FFFFFF" : DONKER)
  const accent = mono ?? GOUD
  const sub = mono ?? TURQUOISE
  return (
    <svg
      height={size}
      viewBox={`0 0 ${resto ? 392.1 : 229.5} 107.3`}
      role="img"
      aria-label={resto ? "Rundo Resto" : "Rundo"}
      style={{ display: "block", width: "auto", flexShrink: 0 }}
    >
      <g transform="translate(52.75 53.87)">
        <path d={BOOG} fill="none" stroke={accent} strokeWidth="5.5" strokeLinecap="round" />
        <polygon points={PIJL} fill={accent} />
      </g>
      <path d={LETTER_R} fill={letter} />
      <path d={WOORD_UNDO} fill={letter} />
      <ellipse cx="196.84" cy="87.50" rx="12.5" ry="3.8" fill={accent} fillOpacity="0.45" />
      {resto && (
        <>
          <path d={WOORD_RESTO} fill={sub} />
          <ellipse cx="359.45" cy="87.50" rx="12.5" ry="3.8" fill={sub} fillOpacity="0.45" />
        </>
      )}
    </svg>
  )
}

// Klinkende glazen ("cheers") — getekend, kleurt mee met de ondertitel
function CheersIcon({ size = 18, color = "#1d2942" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <g stroke={color} strokeWidth="3" strokeLinecap="round">
        <line x1="32" y1="3" x2="32" y2="11" />
        <line x1="27.5" y1="6.5" x2="36.5" y2="6.5" />
      </g>
      <g transform="rotate(16 22 42)">
        <path d="M13 16 H31 L27 30 Q22 34 17 30 Z" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        <line x1="22" y1="31" x2="22" y2="52" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="14" y1="53" x2="30" y2="53" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="rotate(-16 42 42)">
        <path d="M33 16 H51 L47 30 Q42 34 37 30 Z" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        <line x1="42" y1="31" x2="42" y2="52" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <line x1="34" y1="53" x2="50" y2="53" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// Een persoon is een PLAATS in de groep. De admin zet het aantal, de plaatsen bestaan
// meteen, en gasten claimen er zelf een via de QR/link — net als in Rundo Resto.
// Een vrije plaats heeft in de databank een lege naam; in de UI heet ze "Gast N",
// waardoor de bestaande isGuestDefault-logica gewoon blijft werken.
type Person = { id: string; name: string; seat: number; claimedBy?: string | null; selfJoined?: boolean; named?: boolean; settleWith?: string | null }

// Dit toestel. Bepaalt of je de admin bent en welke plaats van jou is.
function deviceId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem("rundo_device_id")
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("rundo_device_id", id) }
  return id
}
// Uitnodigingscode zonder I/O/0/1 — die worden verkeerd overgetikt vanaf een scherm.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
// De vaste testgroep herken je aan zijn naam. Die kent het opruimen ook, zodat hij
// niet vanzelf dichtgaat of verdwijnt.
const TESTGROEP_NAAM = "🧪 Testgroep"

// Elke modus zijn eigen kleur: paars voor snelle rondjes, groen voor Fair Split. Ze
// komen terug op het keuzescherm (kader + startknop lichten samen op) en als tint in
// de groepenlijst. Bewust NIET op knoppen, velden of de pot — die blijven amber, want
// dat is de kleur van Rundo zelf en niet van één van de twee modi.
// Getekende iconen in plaats van emoji: die zien er op elk toestel hetzelfde uit en
// nemen de kleur van de knop over. De streep bij "niet bewaard" krijgt een witte lijn
// eronder, anders verdwijnt hij half in de gevulde vorm.
function BewaarIcoon({ aan, size = 20 }: { aan: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block" }}>
      <path d="M4.5 6A1.5 1.5 0 0 1 6 4.5h9.6L19.5 8.4V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18z" fill="currentColor" />
      <path d="M9.2 5.4v3.2h5.6V5.4z" fill="#fff" />
      <path d="M8.4 13.4h7.2v5.2H8.4z" fill="#fff" />
      {!aan && (<>
        <path d="M3.4 20.6L20.6 3.4" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M3.4 20.6L20.6 3.4" stroke="#4a5567" strokeWidth="1.7" strokeLinecap="round" />
      </>)}
    </svg>
  )
}
function WisIcoon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M4 6.5h16" /><path d="M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M6.5 6.5l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" />
      <path d="M10.5 10v6" /><path d="M13.5 10v6" />
    </svg>
  )
}

const MODUS_SNEL = {
  rand: "#e8a812", vlak: "#fbf6ec", paneel: "#fdfcf8",
  streep: "rgba(232,168,18,0.35)", lijn: "rgba(232,168,18,0.15)", label: "#b98a10",
  knop: "linear-gradient(135deg,#f7cb5c,#eab117)", gloed: "rgba(234,177,23,0.55)",
  knopTekst: "#1d2942",
  tint: "rgba(232,168,18,0.18)", tekst: "#8a5e0f",
  randZacht: "rgba(232,168,18,0.6)", lijnZacht: "rgba(232,168,18,0.28)",
  bladzij: "#fbf6ec",
}
const GAST_KLEUREN = ["#ffcf5c", "#56b8c4", "#b98ac9", "#7fc47a", "#f0906b", "#9fb4e8", "#e8a0c0", "#c9c07a", "#b07d4f", "#5f9ea0"]
const gastKleur = (i: number) => GAST_KLEUREN[((i % GAST_KLEUREN.length) + GAST_KLEUREN.length) % GAST_KLEUREN.length]
const donkerder = (hex: string, f = 0.55) => {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `rgb(${r},${g},${b})`
}

const MODUS_FAIR = {
  rand: "#0d7c8c", vlak: "#eef8fa", paneel: "#f9fdfe",
  streep: "rgba(13,124,140,0.35)", lijn: "rgba(13,124,140,0.15)", label: "#4e94a0",
  knop: "linear-gradient(135deg,#159cb0,#0d7c8c)", gloed: "rgba(13,124,140,0.55)",
  knopTekst: "#fff",
  tint: "rgba(13,124,140,0.12)", tekst: "#0a6070",
  randZacht: "rgba(13,124,140,0.5)", lijnZacht: "rgba(13,124,140,0.22)",
  bladzij: "#f0f8fa",
}
// Uitgebreid opnemen: de inktblauwe look van zijn eigen keuzeknop, zodat snel en
// uitgebreid ook aan de achtergrond te onderscheiden zijn — niet alleen aan de kop.
const MODUS_NAAM = {
  rand: "#3b486a", vlak: "#eef2f9", paneel: "#f8f9fc",
  streep: "rgba(59,72,106,0.35)", lijn: "rgba(59,72,106,0.15)", label: "#5a6a94",
  knop: "linear-gradient(135deg,#5a6a94,#3b486a)", gloed: "rgba(59,72,106,0.5)",
  knopTekst: "#fff",
  tint: "rgba(90,106,148,0.16)", tekst: "#3b486a",
  randZacht: "rgba(90,106,148,0.55)", lijnZacht: "rgba(90,106,148,0.25)",
  bladzij: "#e8ecf5",
}
// Bekers- en munten-extra's staan tijdelijk uit beeld (setup én ⚙️ Groep). De logica
// blijft slapend aanwezig; deze ene schakelaar brengt ze in een latere update terug.
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("")
type Cat = "Bier" | "BierAV" | "Frisdrank" | "Wijn" | "Cocktail" | "Mocktail" | "Longdrink" | "Shot" | "Warm" | "Eigen"
type Drink = { id: string; name: string; emoji: string; cat: Cat; price: number; cup: boolean; fav: boolean; coins: number; custom?: boolean; by?: string }

const CATS: Cat[] = ["Bier", "BierAV", "Frisdrank", "Wijn", "Cocktail", "Mocktail", "Longdrink", "Shot", "Warm", "Eigen"]
const CAT_LABEL: Record<Cat, string> = { Bier: "🍺 Bier", BierAV: "🌿 0,0%-bier", Frisdrank: "🥤 Fris", Wijn: "🍷 Wijn", Cocktail: "🍸 Cocktail", Mocktail: "🍹 Mocktail", Longdrink: "🥃 Longdrink", Shot: "🔥 Shot", Warm: "☕ Warm", Eigen: "⭐ Eigen" }
const CAT_EMOJI: Record<Cat, string> = { Bier: "🍺", BierAV: "🌿", Frisdrank: "🥤", Wijn: "🍷", Cocktail: "🍸", Mocktail: "🍹", Longdrink: "🥃", Shot: "🔥", Warm: "☕", Eigen: "⭐" }
const CUPCAT: Record<Cat, boolean> = { Bier: true, BierAV: true, Frisdrank: true, Wijn: true, Cocktail: true, Mocktail: true, Longdrink: false, Shot: false, Warm: false, Eigen: true }

// Waar Rundo Resto draait. Pas dit aan als het adres wijzigt.
const RESTO_URL = "/table"
const DATA: [Cat, string, number][] = [
  ["Bier", "Pintje", 3.2], ["Bier", "Duvel", 5], ["Bier", "Chimay Blauw", 5.5], ["Bier", "Cornet", 5], ["Bier", "Geuze", 5], ["Bier", "Hoegaarden Wit", 4], ["Bier", "Kriek", 4.5], ["Bier", "La Chouffe", 5], ["Bier", "Leffe Blond", 4.5], ["Bier", "Tripel Karmeliet", 5.5], ["Bier", "Vedett Extra Blond", 4], ["Bier", "Westmalle Tripel", 5],
  ["BierAV", "Jupiler 0.0", 3], ["BierAV", "Stella Artois 0.0", 3], ["BierAV", "Carlsberg 0.0", 3], ["BierAV", "Corona Cero", 3.5], ["BierAV", "Hoegaarden 0.0", 3.5], ["BierAV", "La Chouffe 0.0", 4], ["BierAV", "Leffe Blond 0.0", 3.5], ["BierAV", "Sportzot", 3.5], ["BierAV", "Cornet 0.0", 4], ["BierAV", "Vedett 0.0", 3.5], ["BierAV", "Cristal 0.0", 3], ["BierAV", "Maes 0.0", 3], ["BierAV", "Palm 0.0", 3.5], ["BierAV", "Kriek 0.0", 3.5], ["BierAV", "Duvel 0.0", 4],
  ["Frisdrank", "Coca-Cola", 3], ["Frisdrank", "Coca-Cola Zero", 3], ["Frisdrank", "Coca-Cola Light", 3], ["Frisdrank", "Fanta", 3], ["Frisdrank", "Sprite", 3], ["Frisdrank", "Ice Tea", 3], ["Frisdrank", "Red Bull", 4], ["Frisdrank", "Schweppes Tonic", 3.5], ["Frisdrank", "Appelsap", 3], ["Frisdrank", "Sinaasappelsap", 4], ["Frisdrank", "Water plat", 2.8], ["Frisdrank", "Water bruis", 2.8], ["Frisdrank", "Ice Tea Green", 3],
  ["Wijn", "Rode wijn", 5], ["Wijn", "Witte wijn", 5], ["Wijn", "Rosé", 5], ["Wijn", "Cava", 6.5], ["Wijn", "Prosecco", 6.5], ["Wijn", "Champagne", 11], ["Wijn", "Cabernet Sauvignon", 5.5], ["Wijn", "Chardonnay", 5.5], ["Wijn", "Merlot", 5.5], ["Wijn", "Pinot Noir", 5.5], ["Wijn", "Sauvignon Blanc", 5.5], ["Wijn", "Sangria", 5], ["Wijn", "Porto", 5],
  ["Cocktail", "Aperol Spritz", 10], ["Cocktail", "Gin Tonic", 11], ["Cocktail", "Mojito", 11.5], ["Cocktail", "Margarita", 11.5], ["Cocktail", "Cosmopolitan", 11.5], ["Cocktail", "Espresso Martini", 12.5], ["Cocktail", "Hugo Spritz", 10], ["Cocktail", "Moscow Mule", 11.5], ["Cocktail", "Negroni", 11.5], ["Cocktail", "Piña Colada", 11.5], ["Cocktail", "Pornstar Martini", 13], ["Cocktail", "Sex on the Beach", 10.5], ["Cocktail", "Caipirinha", 11.5],
  ["Mocktail", "Virgin Mojito", 7.5], ["Mocktail", "Virgin Gin Tonic", 7.5], ["Mocktail", "Hugo 0.0", 7.5], ["Mocktail", "Berry Mule", 7.5], ["Mocktail", "Gimber", 5.5], ["Mocktail", "Strawberry Daiquiri 0.0", 7.5], ["Mocktail", "Virgin Sunrise", 7], ["Mocktail", "Virgin Aperol Spritz", 7.5], ["Mocktail", "Virgin Moscow Mule", 7.5], ["Mocktail", "Virgin Colada", 7.5], ["Mocktail", "Shirley Temple", 6], ["Mocktail", "Ipanema", 6.5], ["Mocktail", "Crodino", 5.5], ["Mocktail", "Virgin Passion Spritz", 7.5],
  ["Longdrink", "Vodka Red Bull", 10], ["Longdrink", "Vodka Orange", 9], ["Longdrink", "Cuba Libre", 9], ["Longdrink", "Rum Cola", 9], ["Longdrink", "Whisky Cola", 9.5], ["Longdrink", "Malibu Cola", 9], ["Longdrink", "Malibu Ananas", 9], ["Longdrink", "Bacardi Lemon", 9], ["Longdrink", "Passoã Orange", 9], ["Longdrink", "Pisang Orange", 9], ["Longdrink", "Safari Orange", 9], ["Longdrink", "Jägermeister Red Bull", 10], ["Longdrink", "Bacardi Cola", 9], ["Longdrink", "Vodka Cassis", 9], ["Longdrink", "Vodka Sprite", 9], ["Longdrink", "Gin Cassis", 9.5], ["Longdrink", "Whisky Ginger Ale", 9.5],
  ["Shot", "Tequila", 3.5], ["Shot", "Jägermeister", 3.5], ["Shot", "Sambuca", 3.5], ["Shot", "Fireball", 3.5], ["Shot", "Limoncello", 3.5], ["Shot", "Sourz", 3.5], ["Shot", "Vodka shot", 3], ["Shot", "Rum shot", 3.5], ["Shot", "Apfelkorn", 3], ["Shot", "Baby Guinness", 4],
  ["Warm", "Koffie", 3], ["Warm", "Espresso", 2.8], ["Warm", "Cappuccino", 3.5], ["Warm", "Latte Macchiato", 4], ["Warm", "Flat White", 4], ["Warm", "Koffie verkeerd", 3.5], ["Warm", "Decafé koffie", 2.8], ["Warm", "Thee", 2.8], ["Warm", "Chai Latte", 4], ["Warm", "Warme chocolademelk", 4.2], ["Warm", "Irish Coffee", 8], ["Warm", "Hasseltse koffie", 8], ["Warm", "Americano", 3], ["Warm", "Verse muntthee", 4.5], ["Warm", "Glühwein", 4.5],
]
// De KORTE lijst: wat je meteen ziet op het bestelscherm, vóór je op "toon alles" tikt.
// Alles hierbuiten blijft gewoon bestaan in DATA en verschijnt zodra fullList aan staat.
const FAVS = new Set([
  // Bier
  "Pintje", "Duvel", "Kriek", "Cornet",
  // AV-bier
  "Jupiler 0.0", "Carlsberg 0.0", "Sportzot", "Cornet 0.0",
  // Frisdrank
  "Coca-Cola", "Coca-Cola Zero", "Coca-Cola Light", "Fanta", "Schweppes Tonic", "Water plat", "Water bruis",
  // Wijn
  "Witte wijn", "Rode wijn", "Rosé", "Cava", "Champagne",
  // Cocktail
  "Aperol Spritz", "Gin Tonic", "Moscow Mule", "Pornstar Martini",
  // Mocktail
  "Virgin Mojito", "Virgin Gin Tonic", "Virgin Aperol Spritz", "Virgin Moscow Mule", "Hugo 0.0", "Gimber",
  // Longdrink
  "Rum Cola", "Whisky Cola", "Vodka Orange", "Vodka Red Bull",
  // Shot
  "Jägermeister", "Tequila", "Limoncello",
  // Warm
  "Koffie", "Espresso", "Decafé koffie", "Latte Macchiato", "Thee", "Warme chocolademelk", "Irish Coffee",
])
// Vaste festival-coinprijzen (standaard) — bijstelbaar per 0,1 in de app.
const PILS = new Set(["Pintje", "Jupiler 0.0", "Stella Artois 0.0", "Carlsberg 0.0", "Corona Cero", "Hoegaarden 0.0", "Leffe Blond 0.0", "Sportzot", "Vedett 0.0", "Cristal 0.0", "Maes 0.0", "Palm 0.0"])
const COIN3 = new Set(["Champagne", "Irish Coffee", "Hasseltse koffie"])
const coinDefault = (cat: Cat, name: string): number => {
  if (name === "Red Bull" || name === "Glühwein") return 1.5
  if (COIN3.has(name)) return 3
  switch (cat) {
    case "Bier": return PILS.has(name) ? 1 : 2
    case "BierAV": return PILS.has(name) ? 1 : 2
    case "Frisdrank": return 1
    case "Wijn": return 2
    case "Cocktail": return 3
    case "Longdrink": return 3
    case "Mocktail": return 2
    case "Shot": return 1
    case "Warm": return 1
    case "Eigen": return 2
    default: return 1
  }
}
// STABIELE sleutel, afgeleid van de naam. Niet de index: die schuift op zodra je een drank
// tussenvoegt, en dan wijzen opgeslagen rondjes ineens naar het verkeerde drankje.
const drinkKey = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Zoeken zonder gedoe: "jagermeister" vindt Jägermeister, "pina" vindt Piña Colada,
// "coca cola" vindt Coca-Cola. Accenten, koppeltekens en hoofdletters doen er niet toe.
const normText = (t: string) =>
  (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// Elk getikt woord moet érgens in de naam voorkomen. Zo vindt "gin to" ook Gin Tonic,
// en "virgin mule" de Virgin Moscow Mule — zonder dat de volgorde moet kloppen.
const drinkMatches = (naam: string, zoek: string) => {
  const woorden = normText(zoek).split(" ").filter(Boolean)
  if (woorden.length === 0) return true
  const n = normText(naam)
  return woorden.every((w) => n.includes(w))
}

const DEMO_DRINKS: Drink[] = DATA.map(([cat, name, price]) => ({ id: drinkKey(name), name, emoji: CAT_EMOJI[cat], cat, price, cup: CUPCAT[cat], fav: FAVS.has(name), coins: coinDefault(cat, name) }))

type Assign = Record<string, Record<string, number>>
type Anon = Record<string, number>
// Een rondje leeft nu in de databank. id/seq/status komen daarvandaan; de rest is
// wat de app al kende. status: open = er wordt besteld, pending = besteld maar niet
// betaald, closed = betaald.
type Proposal = { active?: boolean; by?: string; answers?: Record<string, "same" | "different" | "skip"> }
type Round = { id: string; seq: number; status: "open" | "pending" | "closed"; orders: Assign; anon: Anon; payers: Record<string, number>; amount: number; potPart: number; gaveBack: Record<string, number>; members: string[]; startedBy: string | null; proposal: Proposal; headcount: number }

const euro = (v: number) => "€" + v.toFixed(2).replace(".", ",")

// ── Spraak (beta) ───────────────────────────────────────────────────────────
// "drie pils en twee cola" -> [{pils,3},{coca-cola,2}]. Bewust simpel: we zoeken
// getallen en drankennamen, de rest negeren we. Spraakherkenning maakt fouten, dus
// de gebruiker krijgt ALTIJD te zien wat we verstonden voor er iets in de mand belandt.
const TELWOORD: Record<string, number> = {
  een: 1, één: 1, "n": 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
}

// Andere namen die mensen voor een drankje gebruiken. De sleutel is de drinkKey (uit de
// naam afgeleid), de waarde is een lijst extra termen waarop de spraak ook mag matchen.
// Bewust GEEN heel korte, dubbelzinnige termen ("wit", "zero", "blond") — die zouden
// verkeerd kunnen vallen tussen meerdere drankjes.
const SPRAAK_SYNONIEMEN: Record<string, string[]> = {
  "pintje": ["pint", "pils"],
  "leffe-blond": ["leffe"],
  "hoegaarden-wit": ["hoegaarden", "witbier", "wit bier"],
  "la-chouffe": ["chouffe"],
  "tripel-karmeliet": ["karmeliet", "tripel"],
  "coca-cola": ["cola", "coca"],
  "coca-cola-zero": ["cola zero", "coca zero"],
  "coca-cola-light": ["cola light"],
  "ice-tea": ["icetea", "ijsthee"],
  "water-plat": ["plat water", "water", "spa plat"],
  "water-bruis": ["bruiswater", "spa bruis", "bruis water"],
  "rode-wijn": ["rood", "rooie", "rooiewijn"],
  "witte-wijn": ["witte wijn"],
  "rose": ["rosee"],
  "cappuccino": ["capucino"],
}

function parseSpraak(tekst: string, lijst: { id: string; name: string }[]): { id: string; name: string; qty: number }[] {
  const woorden = normText(tekst).split(" ").filter(Boolean)
  const treffers: { id: string; name: string; qty: number }[] = []

  // Elk drankje krijgt zijn genormaliseerde woorden PLUS eventuele synoniemen (andere
  // namen die mensen gebruiken: "pint"/"pintje" voor Pintje, "coca" voor Coca-Cola).
  // We matchen FLEXIBEL: de gesproken woorden hoeven niet exact of volledig te zijn.
  // Per drankje bewaren we meerdere woordgroepen; matcht er één, dan is het raak.
  const namen = lijst.map((d) => {
    const eigen = normText(d.name).split(" ").filter(Boolean)
    const syn = (SPRAAK_SYNONIEMEN[d.id] || []).map((z) => normText(z).split(" ").filter(Boolean))
    const groepen = [eigen, ...syn].map((delen) => ({ delen, kern: delen.filter((w) => w.length >= 3) }))
    return { id: d.id, name: d.name, groepen }
  })

  // Stopwoorden die geen drankje aanduiden (merk/vulwoorden die vaak wegvallen).
  const negeer = new Set(["een", "de", "het", "en", "met", "van", "glas", "keer", "x"])

  let i = 0
  while (i < woorden.length) {
    let aantal = 1
    const w = woorden[i]
    if (TELWOORD[w] !== undefined) { aantal = TELWOORD[w]; i++ }
    else if (/^\d+$/.test(w)) { aantal = Math.min(20, parseInt(w, 10)); i++ }
    if (i >= woorden.length) break
    if (negeer.has(woorden[i])) { i++; continue }

    // Neem een venster van maximaal de volgende 4 woorden en zoek het drankje dat er
    // het best bij past: zoveel mogelijk kernwoorden van (een naam OF synoniem) die in
    // het venster voorkomen. Langere namen die volledig passen winnen van losse matches.
    const venster = woorden.slice(i, i + 4)
    let best: { d: typeof namen[number]; score: number; kernlen: number; verbruikt: number } | null = null
    for (const d of namen) {
      for (const g of d.groepen) {
        const kern = g.kern.length ? g.kern : g.delen
        if (kern.length === 0) continue
        const aanwezig = kern.filter((deel) => venster.some((vw) => vw === deel || (vw.length >= 4 && deel.length >= 4 && (vw.startsWith(deel) || deel.startsWith(vw)))))
        if (aanwezig.length === 0) continue
        const score = aanwezig.length / kern.length
        if (score < 0.5) continue
        const beter = !best || score > best.score || (score === best.score && kern.length > best.kernlen)
        if (beter) best = { d, score, kernlen: kern.length, verbruikt: Math.min(venster.length, Math.max(1, aanwezig.length)) }
      }
    }

    if (best) {
      const bestaand = treffers.find((t) => t.id === best!.d.id)
      if (bestaand) bestaand.qty += aantal
      else treffers.push({ id: best.d.id, name: best.d.name, qty: aantal })
      i += best.verbruikt
    } else {
      i++
    }
  }
  return treffers
}

// ── Woordenlijst ────────────────────────────────────────────────────────────
// Eerst alles wat een GAST te zien krijgt: hij scant een QR en is misschien
// Franstalig. De adminschermen (die jij zelf bedient) volgen daarna.
const T = {
  nl: {
    invitedFor: "Je bent uitgenodigd voor",
    whoAreYou: "Wie ben jij?",
    tapYourName: "Tik op je naam.",
    notThere: "Sta je er niet bij? Neem een lege plaats.",
    fillNameSeat: "Vul je naam in en neem een plaats.",
    yourName: "Je naam",
    seat: (n: number) => `Plaats ${n}`,
    allSeatsTaken: "Alle plaatsen zijn bezet — er is nog plaats voor jou.",
    joinAddSeat: "Kom erbij",
    someoneJoined: (n: string) => `${n} is erbij gekomen`,
    alreadyJoined: "Al aangemeld",
    fillNameFirst: "Vul eerst je naam in.",
    tapYourSeatNow: "👇 Tik nu je plaats aan",
    potTogetherQ: "💰 Samen een pot leggen?",
    potLayBtn: "Pot leggen",
    whoAreYouTitle: "Wie ben jij?",
    namePlichtTitle: "Groepsnaam & personen",
    persCountLabel: "Aantal personen",
    persNotNow: "hoeft niet nu — kan ook later",
    aanvulTitle: (n: number, d: number) => `✓ Rondje ${n} genoteerd · ${d} drankje${d === 1 ? "" : "s"}`,
    aanvulSub: "Vul aan voor een eerlijke verdeling — of sla over.",
    aanvulCost: "💶 Wat kostte het?",
    aanvulPaidBy: "betaald door",
    aanvulAssign: "🍺 Drankjes toewijzen",
    aanvulAssignSub: (n: number) => `${n} nog zonder naam`,
    aanvulAssignOk: "alles toegewezen",
    aanvulSave: "Bewaren",
    aanvulSkip: "Alles overslaan — later invullen",
    stillToFill: "NOG NODIG VOOR EERLIJK AFREKENEN",
    nogNodigBadge: "NOG NODIG",
    allRoundsBtn: "🍺 Alle rondjes in één keer",
    allRoundsSeg: "alle rondjes",
    thisRoundSeg: "dit rondje",
    onlyThisRound: "↩ Alleen dit rondje",
    tikSamenWord: "voor iedereen",
    hintTogether: "Tik alle drankjes meteen aan voor de hele groep",
    hintPerPerson: "Tik eerst een naam aan, dan het drankje",
    perPersonWord: "per persoon",
    fillWord: "Bedrag toevoegen",
    adjustOrder: "bestelling aanpassen",
    addPersonHere: "Persoon / naam toevoegen",
    personsAndNames: "Personen & namen",
    persWord: "Pers.",
    persWordLow: "pers.",
    tapForStrip: "Je tikt aan voor",
    completeWord: "✓ compleet",
    noAmountShort: "Hoeveel betaald?",
    missRoundsNote: (n: number) => `Nog ${n} rondje${n === 1 ? "" : "s"} aanvullen voor een eerlijke verdeling`,
    fillNowBtn: "Nu aanvullen →",
    klaarBtn: "Klaar →",
    openWord: "Wijs toe",
    sameAgainTitle: "🔁 Zelfde als vorig rondje",
    sameAgainTake: "Overnemen",
    sameAgainEdit: "daarna nog aanpasbaar",
    leaveNoNameTitle: "Deze avond bewaren?",
    leaveAutoSub: "We noemen hem naar de datum, tenzij je zelf iets typt.",
    leaveRoundLine: (n: number, d: number) => `Rondje ${n} · ${d} drankje${d === 1 ? "" : "s"}`,
    closeNeedName: "Geef je groep een naam om ze te bewaren in je lijst.",
    nameRequiredHint: "⚠️ verplicht om te bewaren",
    closeAndSave: "Afsluiten en bewaren",
    leaveNoNameSub: "Zonder naam vind je deze groep straks niet meer terug. Geef hem een naam om alles te bewaren.",
    saveAndStay: "Bewaren en hier blijven",
    leaveNoSaveBtn: "Weggaan zonder bewaren",
    saveAndLeave: "Bewaren en weggaan",
    namePh3: "Typ je groepsnaam",
    naamGoBtn: "Verder →",
    nameFirstNote: "Vul eerst je eigen naam en de groepsnaam in.",
    yourNamePh2: "Jouw naam — nodig vóór de QR",
    backToRundo: "← naar het Rundo-startscherm",
    tryTableLine: "Rekening splitsen in een restaurant? Probeer ook",
    welkomSub1: "Rondjes opnemen",
    welkomSub2: "… en splitten zonder gedoe!",
    welkomStart: "Starten ",
    orWordShort: "of",
    welkomFlow: [
      { ic: ["✍️", "📱"], label: "neem zelf op of deel de QR" },
      { ic: ["👆"], label: "tik de drankjes aan" },
      { ic: ["📋"], label: "handig barlijstje en afrekenen" },
    ],
    potAddBtn: "+ inleggen",
    seatTaken: "Die plaats is net door iemand anders genomen. Kies een andere.",
    badCode: "Deze uitnodigingscode bestaat niet (meer).",
    loading: "Even laden…",

    youAre: "Jij bent",
    notMe: "dit ben ik niet",
    notMeConfirm: (n: string) => `Ben jij niet ${n}? Dan geef je deze plaats vrij en kies je opnieuw.`,
    releaseSeat: "Plaats vrijgeven",
    tabOrder: "🍺 Drankjes",
    tabMe: "📋 Rondjes",
    youTookLabel: "jij nam:",
    backToDrinks: "\u2190 Terug naar drankjes",
    tabGroup: "👥 Groep & QR",
    groupTitle: "👥 In deze groep",
    peopleN: (n: number) => `${n} ${n === 1 ? "persoon" : "personen"}`,
    joinedOfTotal: (a: number, b: number) => `${a} van ${b} aangemeld`,
    hostMark: "organisator",
    startNotAll: (n: number, t: number) => `${n} van ${t} nog niet aangemeld. Toch beginnen?`,
    startWait: "Nog even wachten",
    startAnyway: "Toch beginnen",
    scannedSelf: "📱 zelf aangemeld",
    youMark: "jij",
    notScannedYet: "nog niet aangemeld",
    inviteMore: "Nodig meer mensen uit — laat ze de code scannen.",
    roundWhatYouWant: (n: number) => `🛒 Ronde ${n} — wat jij wil`,
    searchDrink: "Zoek een drankje…",
    shortList: "⚡ Korte lijst",
    fullListBtn: "📖 Volledige lijst",
    nothingFound: "Niets gevonden — probeer een ander woord.",

    myTab: "🧾 Mijn stand",
    noRoundClosed: "Er is nog geen rondje afgesloten.",
    whatYouDrank: "Wat jij dronk",
    whatDidItCost: "Wat kostte dit rondje?",
    costLabel: "WAT KOSTTE DIT RONDJE?",
    whoPutMoney: "Wie legde het geld neer?",
    whoPaidTapIt: "Wie betaalde dit rondje? Tik aan!",
    pickWhoPaid: "Kies wie betaalde.",
    splitEvenNote: "Gelijk verdeeld \u2014 pas aan per persoon indien nodig",
    fromPotQ: "Kwam er iets uit de pot?",
    noSelfPaid: "nee, zelf betaald",
    yesFromPot: "ja, uit de pot",
    selfPaidShort: "zelf betaald",
    fromPotShort: "uit de pot",
    fromPotLabel: "Uit de pot",
    notFromPotLabel: "Niet uit de pot",
    wholeRoundFromPot: "Het hele rondje gaat uit de pot.",
    potLeftAfter: "Daarna blijft er in de pot:",
    confirmPayBtn: "Betaling bevestigen",
    fillAmountHint: "Vul betaalde bedrag in",
    confirmShort: "bevestigen",
    potPaysWholeQ: "Betaalt de pot het hele rondje?",
    yesWord: "ja",
    noPartOnly: "nee, een deel",
    restOutsidePot: "Rest buiten de pot:",
    potPaidIn: (bedrag: string) => `💰 ingelegd ${bedrag}`,
    roundN: (n: number) => `Ronde ${n}`,
    nothingThisRound: "jij had niets in dit rondje",

    newDrinkTile: "Eigen drankje?",
    shortListBtn: "🔼 Korte lijst",

    // ── start & setup
    autoName: () => { const d = new Date(); const m = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"]; return `Rondje ${d.getDate()} ${m[d.getMonth()]}` },
    autoNameQr: () => { const d = new Date(); const m = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"]; return `QR-rondje ${d.getDate()} ${m[d.getMonth()]}` },
    whereLeftTitle: "⏳ Waar was je gebleven?",
    whereLeftSub: "Deze groepen staan hier nog open:",
    whereLeftNew: "🆕 Nieuwe groep starten",
    whereLeftGo: "verder",
    newGroupNameTitle: "Naam voor je nieuwe groep",
    newGroupNameSub: "Zo herken je hem straks tussen je andere groepen.",
    startWord: "Starten",
    startQuickBtn: "Start",
    addNonScanner: "✍️ Zelf iemand toevoegen",
    linkCopiedShort: "✓ Gekopieerd",
    joinInviteShort: (naam: string) => `Doe je mee met ${naam || "ons rondje"}? Scan of tik:`,
    pasteAndShare: "✓ Gekopieerd — plak hem in jullie groepschat.",
    sectionGroup: "DE GROEP",
    sectionExtras: "EXTRA’S",
    startOrdering: "Beginnen met bestellen",
    startOrderingSub: "wie later scant, sluit gewoon aan",
    everyoneTapsNow: "iedereen kan aantikken",
    showQr: "📱 QR-code tonen",
    toQrStep: "Naar de QR-code →",
    addThis: "Toevoegen",
    seatNameTitle: "Iemand die niet scant",
    seatNameSub: "Zet zijn naam erbij — scant hij later toch, dan tikt hij die gewoon aan.",
    yourNamePh: "Jouw naam · optioneel",
    groupNameEdit: "Naam van deze groep",
    groupNamePh: "Typ je groepsnaam",
    groupNameShortPh: "Groepsnaam",
    giveNameQ: "Groepsnaam? · optioneel",
    groupNamePlain: "Groepsnaam",
    voiceNotPerfect: "werkt nog niet altijd perfect",
    howNoteTitle: "Hoe drankjes noteren?",
    howNoteSub: "✏️ Van snel naar op naam kan later nog.",
    noteQuickTitle: "⚡ Snel noteren",
    noteQuickExample: "3× Pintje · 2× Cola",
    nextBtn: "Verder →",
    fastestTag: "SNELSTE",
    fairestTag: "EERLIJKSTE",
    qStep1: "Drankjes opnemen",
    qStep2: "Handig barlijstje",
    qStep3: "Verrekenen optioneel",
    nStep1: "Drankjes opnemen en toewijzen",
    nStep2: "Handig barlijstje",
    nStep3: "Ieder betaalt wat hij dronk",
    noteNamedTitle2: "👤 Op naam noteren",
    confirmedWord: "bevestigd",
    guestN: (n: number) => `Gast ${n}`,
    jijNaam: "Jij",
    youTag: "jij",
    yourselfWord: "jezelf",
    everyoneWord: "iedereen",
    fromTwoOn: "Beschikbaar vanaf 2 personen \u2014 voeg er hieronder \u00e9\u00e9n toe.",
    forWord: "Voor",
    aloneHint: "Voorlopig alleen jij",
    canAlsoLater: "Kan ook later",
    backToOverviewHint: "Er zijn nog rondjes om af te werken.",
    toRoundsOverview: "Naar het rondjesoverzicht",
    nameLockedNote: "🔒 vast — de avond is afgesloten",
    editNamesBtn: "✏️ Namen aanpassen",
    doneNamesBtn: "✓ Klaar met namen",
    editNamesHint: "Pas de namen aan — ze veranderen overal mee, ook in al toegewezen drankjes.",
    notAssignedCount: (n: number) => `${n} ${n === 1 ? "drankje" : "drankjes"} niet toegewezen`,
    howNoteQ: "Hoe noteer je dit rondje?",
    inRoundTitle: "In dit rondje",
    weggehaald: (wat: string) => `${wat} weggehaald`,
    undoWord: "Ongedaan maken",
    nogNiets: (namen: string) => `${namen} nog niets`,
    potTitel: "Pot",
    potEvenIn: "gelijk ingelegd",
    potIn: "ingelegd",
    potOtherBtn: "Anders verdeeld?",
    potWhoFrom: (b: string) => `Van wie komt de ${b} in de pot?`,
    mustBeTot: (b: string) => `moet ${b} zijn`,
    potStayEqual: "Toch gelijk",
    cancelEdit: "Annuleer",
    guestsWhoTitle: "Wie waren de gasten?",
    guestsWhoSub: "Alles klopt al — alleen deze namen ontbreken nog voor een leesbare afrekening.",
    leaveAsIs: "Zo laten",
    toBalanceBtn: "Naar de eindbalans →",
    namePh2: "Naam…",
    retentionInfoLink: "ⓘ hoe lang blijft alles staan?",
    retentionInfo: "Alles wordt automatisch bewaard. Open groepen blijven staan zolang je bezig bent en sluiten zichzelf na 24 uur stilte; afgesloten groepen verdwijnen na de dagen op hun chip — tenzij je ze bewaart met het diskette-knopje of verlengt.",
    chipDays: (n: number) => `nog ${n} ${n === 1 ? "dag" : "dagen"}`,
    filterSaved: "bewaard",
    statusOpen: "🟡 open",
    statusClosed: "✓ afgesloten",
    filterAll: "Alle",
    moreGroups: (n: number) => `meer groepen (${n}) ▾`,
    lessGroups: "▴ minder tonen",
    extendMsg: (naam: string, datum: string) => `"${naam}" 30 dagen langer bewaren? De avond blijft dan staan tot ${datum}.`,
    extendYes: "+30 dagen",
    unpinMsg: (naam: string) => `"${naam}" staat voor onbepaalde tijd bewaard. Losmaken? Dan verdwijnt hij na een tijdje vanzelf.`,
    closeEveBtn: "🌙 Avond afsluiten",
    eveClosedTitle: "🌙 Avond afgesloten ✓",
    eveClosedSub: "Alles staat veilig bewaard — je vindt deze avond terug bij Opgeslagen groepen.",
    shareBillBtn: "📤 Afrekening delen",
    copiedNote: "Afrekening gekopieerd — plak ze in jullie groepschat.",
    namesMissing: (n: number) => `${n} ${n === 1 ? "persoon heeft" : "personen hebben"} nog geen naam. Vul die aan via ⚙️ Groep, anders staat er straks "Plaats 3" op de afrekening.`,
    someUnassigned: (n: number) => `🔴 ${n} ${n === 1 ? "drankje" : "drankjes"} nog zonder naam`,
    nowWord: "nu:",
    starting: "Bezig…",
    savedGroups: "Opgeslagen groepen",
    modeFairShort: "Iedereen tikt zelf aan",
    shareLinkBelow: "deel de link hieronder",
    modeQuickShort: "Ik bestel voor de groep",
    pinOn: "Bewaren",
    pinOff: "Niet meer bewaren",
    maxPins: (n: number) => `Je kan maximaal ${n} groepen vastzetten. Maak er eerst een los.`,
    sleepBanner: "⏸ Live-updates gepauzeerd — tik om te hervatten",
    searchGroups: "Zoek een groep…",
    showWord: "Tonen",
    hideWord: "Verbergen",
    wipeAll: "Alles wissen",
    wipeAllTitle: "Alles wissen?",
    wipeAllBody: (weg: number, blijft: number) => blijft > 0
      ? `Je verwijdert ${weg} ${weg === 1 ? "groep" : "groepen"} definitief, met alle rondjes en bedragen erin. Je ${blijft} bewaarde ${blijft === 1 ? "groep blijft" : "groepen blijven"} staan.`
      : `Je verwijdert ${weg} ${weg === 1 ? "groep" : "groepen"} definitief, met alle rondjes en bedragen erin.`,
    wipeAllYes: (n: number) => `Ja, wis ${n === 1 ? "die ene" : `die ${n}`}`,
    noSearchHit: "Geen groep gevonden.",
    wipeSomeFailed: (n: number) => `${n} ${n === 1 ? "groep kon" : "groepen konden"} niet verwijderd worden. Probeer het opnieuw.`,
    stalePins: (n: number) => `${n} vastgezette ${n === 1 ? "groep is" : "groepen zijn"} al lang niet gebruikt`,
    stalePinsWhy: "Losmaken? Dan worden ze na een maand opgeruimd, net als de andere afgesloten groepen.",
    stalePinsKeep: "Houden",
    asGuest: "als gast",
    delGroupConfirm: (n: string) => `"${n}" verwijderen? Dit kan niet ongedaan worden — alle rondjes en gegevens van deze groep gaan weg.`,
    delGroupYes: "Verwijderen",
    cancel: "Annuleren",
    createFailed: "Groep aanmaken mislukt. Probeer opnieuw.",

    peopleTitle: "Personen",
    addPersonFirst: "Voeg eerst minstens één persoon toe.",
    whichAreYou: "Welke ben jij?",
    assignAnyone: "Je kan aan iedereen toewijzen — ook wie zelf scande.",
    pickYourName: "Tik je naam aan — de rest duid je zelf aan tijdens het bestellen.",
    personHasDrinks: (n: string) => `${n} heeft al drankjes in een rondje en kan niet verwijderd worden. Verwijder eerst die drankjes.`,
    thisPerson: "Deze persoon",

    // ── delen
    letGuestsScan: "📲 Laat je gasten scannen",
    whoIsInYet: "Wie is er al bij",
    scanToJoin: "Wie later scant, sluit gewoon aan.",
    copyLink: "Kopieer link",

    // ── startvragen
    beforeWeStart: "Kies je aanpak",
    beforeQrTitle: "Nog even dit",
    settingsLater: "Pot, bekers of coins nodig? Die zet je aan via ⚙️ Groep — hoeft nu niet.",
    perManShort: "p.p.",
    potTotalIn: "Totaal in de pot:",
    potInShort: "ingelegd",
    potStillIn: "nog in pot",
    alreadyInPot: "Al in de pot",
    nowAdding: "Nu erbij",
    newPotTotal: "Nieuw totaal",
    firstDeposit: "1e inleg",
    addDeposit: "extra inleg",
    editDeposit: "inleg wijzigen",
    addToPot: "Toevoegen aan de pot",
    potFillAmount: "Vul eerst een bedrag in.",
    setPotTo: (v: string) => `Pot op ${v} zetten`,
    unassignedHub: (n: number) => `🔴 ${n} drankje${n === 1 ? "" : "s"} nog niet toegewezen`,
    unassignedHubWhy: "Zonder naam worden ze gelijk verdeeld — niet eerlijk. Wijs ze toe zodat elk betaalt wat hij dronk.",
    assignAllBtn: "Naar toewijzen drankjes",
    assignFirstNote: "Wijs eerst alle drankjes toe aan iemand. Daarna kan je verder.",
    assignTitle: "Toewijzen drankjes",
    roundXofY: (a: number, b: number) => `Rondje ${a} van ${b}`,
    assignAllSub: (n: number) => `Alle ${n} rondjes in \u00e9\u00e9n keer`,
    roundDoneNext: "Dit rondje is rond",
    roundDoneShort: "Rondje toegewezen",
    nextRoundAssign: (n: number) => `Volgende: rondje ${n} →`,
    allAssignedDone: "Klaar \u2014 alles toegewezen",
    quickStart: "Starten",
    continueRound: (n: number) => `Ga verder met rondje ${n}`,
    backToRound: (n: number) => `\u2190 Terug naar rondje ${n}`,

    // ── instellingen
    groupShort: "⚙️ Groep",
    cupsTitle: "♻️ Herbruikbare bekers",
    cupsInfo: "Voor events met waarborg per beker die je terugkrijgt bij inleveren. Zet aan om de borg mee te verrekenen.",
    depositPerCup: "Waarborg/beker",
    coinsTitle: "🎟️ Coins",
    coinsInfo: "Betaal je met coins i.p.v. euro's? Stel de coin-waarde en prijzen in; de app verdeelt eerlijk.",
    coinPrices: "🎟️ coin-prijzen per drankje",
    coinPricesInfo: "Standaard festival-coins per drankje. Pas aan met − / + (stapjes van 0,1).",
    potTitle: "Pot",
    noPotYet: "Nog geen pot",
    potSummary: (n: number, over: string) => `${n} inlegger${n === 1 ? "" : "s"} \u00b7 ${over} nog over`,
    detailsWord: "details",
    alreadySpent: "al besteed",
    stillLeft: (b: string) => `nog ${b}`,
    potAdjust: "Pot aanpassen",
    withHowMany: "Met hoeveel?",
    groupPutIn: (b: string) => `De groep legde samen ${b} in`,
    thatIsEach: (b: string) => `Dat is ${b} per persoon. Doe je mee, dan drink je gewoon mee uit de pot.`,
    whoPutWhat: "Wie legde wat in?",
    potShiftedToSelf: (n: number, b: string) => `\u26a0\ufe0f De pot dekt niet alles meer: ${n} rondje${n === 1 ? "" : "s"} (${b}) wordt nu zelf betaald.`,
    iPutIn: (b: string) => `Ik leg ${b} in`,
    settleApart: "Nee, ik reken apart af",
    joinedPot: (n: string, b: string) => `${n} legde ${b} in de pot`,
    eachPutsIn: "Hoeveel legt ieder in?",
    seatsFillLater: "Wie scant, neemt een plaats in.",
    potHowManyQ: "Met hoeveel?",
    fillCoinValue: "Vul de coin-waarde in (1 coin = €…) — of zet coins op 'uit'.",
    fillDeposit: "Vul het waarborgbedrag per beker in — of zet bekers op 'uit'.",

    // ── bestellen
    inThisRound: "🛒 In dit rondje",
    someoneCanGo: "👉 Iemand mag gaan halen!",
    noFavsHere: "Geen favorieten hier.",
    showAll: "📖 toon alles",
    assign: "Toewijzen",
    assignHint: "— tik om toe te wijzen",
    assigned: "✓ toegewezen",
    eachOne: "👥 elk 1",
    eachOneConfirm: (n: string, meer: boolean) => `${n} ${meer ? "hebben" : "heeft"} er nu al 2 of meer. Met "elk 1" krijgt iedereen er precies één — ${n} ${meer ? "gaan" : "gaat"} dus terug naar 1.`,
    yesEachOne: "Ja, iedereen op 1",
    toAssignCount: (n: number) => `${n} toewijzen`,
    closeRound: "✓ Rondje afsluiten",
    cancelRound: "✕ Rondje annuleren",
    cancelRoundConfirm: (n: number) => `Rondje ${n} annuleren? Alle gekozen drankjes van dit rondje gaan verloren. Dit kan niet ongedaan gemaakt worden.`,
    yesCancel: "Ja, annuleren",
    backFinish: "← Terug, rondje afmaken",
    cups: "Bekers",
    cupsNotSet: "Bekers nog niet aangeduid.",
    tapToArrange: "Tik hier om te regelen →",
    tapToAssign: "Tik hier om toe te wijzen",
    nobodyGaveBack: "🚫 niemand gaf een beker terug",
    howMuchEach: "Hoeveel gaf elk",
    gaveBack: "gaf terug",
    ready: "Klaar",

    // ── betalen
    exactAmount: "💰 Exact bedrag betaald voor dit rondje?",
    whoPaidThis: "Wie betaalde dit rondje?",
    roundsMissingAmount: (nrs: string) => `Rondje ${nrs} heeft nog geen bedrag of betaler. Vul dat eerst in — anders klopt de verdeling niet.`,
    iPaidBtn: "🙋 Jij",
    fromPotBtn: "💰 Uit de pot",
    fromCardBtn: "💳 Van de kaart",
    howMuchYou: "💰 Hoeveel betaalde je zelf voor dit rondje?",
    howMuchPot: "💰 Hoeveel betaalde je uit de pot voor dit rondje?",
    potEmptyPay: (kaart: boolean) => `De ${kaart ? "drankkaart" : "pot"} is leeg — leg eerst iets in of kies "Jij".`,
    amountAndPayer: "bedrag & betaler",
    whoPaid: "Kies wie betaalde.",
    multiplePossible: "(meerdere mogelijk)",
    fillAmountFirst: "Vul eerst het betaalde bedrag in — daarna kies je wie betaalde.",
    fillPerPayer: "Vul een bedrag in per betaler.",
    confirmPaymentFirst: "Bevestig eerst de betaling.",
    thePot: "de pot",
    fromPot: "uit de pot",
    fromCard: "van de drankkaart",
    notPaidYet: "nog niet betaald",
    paidBy: "Betaald door",
    roundingNote: "afrondingscent wordt bij het eerlijk verdelen verrekend",

    // ── pot
    potMoney: "Pot (geld)",
    drinkCard: "💳 Drankkaart",
    addPotContrib: "➕ Inleg pot toevoegen",
    addMoreToPot: "\u2795 Nog extra inleggen",
    nthDeposit: (n: number) => `${n}e inleg`,
    resetContrib: "↺ reset inleg",
    everyone: "👥 verdeel over iedereen",
    ownAmount: "of eigen bedrag:",
    cardValue: "Kaartwaarde",
    whoBoughtCard: "Wie kocht de kaart? (tik aan — bedrag verschijnt vanzelf)",
    addContrib: (b: string) => `✓ Inleg toevoegen (${b})`,
    removeContrib: "✓ Inleg verwijderen (leeg)",
    beingEdited: "✏️ wordt bewerkt ↓",
    inPot: "in pot gelegd",
    removeContribConfirm: (l: string) => `De ${l} verwijderen uit de pot? Dit kan niet ongedaan gemaakt worden.`,
    potEmpty: (kaart: boolean) => `De ${kaart ? "drankkaart" : "pot"} is leeg — leg eerst bij.`,
    potTooLow: (kaart: boolean, max: string) => `De ${kaart ? "drankkaart" : "pot"} heeft maar ${max} — verlaag het bedrag of leg bij.`,
    potNothingIn: (kaart: boolean) => `Je koos voor een ${kaart ? "drankkaart" : "pot"}, maar er is nog niks ingelegd. Toch verder gaan?`,
    anywayWithout: (kaart: boolean) => `Toch verder zonder ${kaart ? "drankkaart" : "pot"}`,

    // ── overzicht
    roundsOverview: "📋 Rondjesoverzicht",
    overview: "📋 Overzicht",
    repeatRound: "🔁 Zelfde opnieuw",
    repeatRoundSub: "aanpasbaar",
    settleBtnShort: "🧾 Afrekenen",
    proposalTitle: "🗳️ Weer hetzelfde rondje?",
    proposalWaiting: "Iedereen antwoordt op zijn scherm. Jij sluit af wanneer je wil.",
    ansSame: "✅ hetzelfde",
    ansDiff: "🔄 iets anders",
    ansWaiting: "⏳ nog niet",
    ansSkip: "✋ slaat over",
    gProposalTitle: "🗳️ Weer hetzelfde rondje?",
    gProposalSame: "✅ Ja, hetzelfde voor mij",
    gProposalDiff: "🔄 Iets anders kiezen",
    gProposalSkip: "✋ Voor mij niks deze ronde",
    gProposalDone: "Je keuze staat genoteerd.",
    gProposalYourLast: "Vorige ronde had je:",
    closeProposalBtn: (n: number) => `Afsluiten · ${n} ${n === 1 ? "doet" : "doen"} mee`,
    noOrderFor: (names: string) => `Geen bestellingen voor ${names}`,
    proposalNobody: "Nog niemand antwoordde. Toch afsluiten?",
    editOrderBtn: "✏️ Bestelling aanpassen?",
    editOrderOld: "✏️ Bestelling wijzigen",
    noRoundsDone: "Nog geen afgeronde rondjes",
    noRoundsHint: "Zodra een rondje bevestigd én betaald is, verschijnt het hier — dan kan je het nog aanpassen.",
    startFirstRoundBtn: "Start 1e rondje",
    toFirstRound: "Naar 1e rondje",
    noRoundsHintQuick: "Noteer wat er besteld wordt. Je afgeronde rondjes verschijnen hier.",
    roundBusy: (n: number) => `Je bent bezig met rondje ${n}`,
    tapRoundToEdit: "Tik een rondje open om de details te zien of aan te passen.",
    roundsSoFar: (n: number) => `🧾 ${n} ${n === 1 ? "rondje" : "rondjes"} tot nu toe`,
    expandAll: "Alles tonen",
    changeNameTitle: "Jouw naam wijzigen",
    changeNameSub: "Zo herkent de rest je in de lijst en op de afrekening.",
    saveName: "Bewaren",
    pricePh: "prijs per stuk",
    notOnList: "staat er niet bij?",
    orderingOpenTitle: "Het bestellen is open!",
    everyoneCanTapNow: "Iedereen kan nu aantikken",
    orderingOpenBody: (naam: string) => `${naam || "De gastheer"} heeft de kaart geopend.`,
    goingToDrinks: "Naar de drankjes →",
    collapseAll: "Alles verbergen",
    settleBtn: "🧾 Afrekenen",
    nothingToSettle: "Er zijn nog geen afgeronde rondjes om af te rekenen.",
    fillAmountsFirst: "€0 — vul eerst het bedrag van je rondjes in. Daarna kan je afrekenen.",
    provisionalTitle: "Voorlopige balans",
    provisionalWhy: (n: number) => `${n} ${n === 1 ? "rondje heeft" : "rondjes hebben"} nog geen bedrag, dus dit totaal klopt nog niet.`,
    zeroRoundsNote: (n: number) => `${n} rondje${n === 1 ? "" : "s"} zonder bedrag — telt als €0 (bv. getrakteerd). Klopt dat niet?`,
    roundUnfinished: (n: number) => `Rondje ${n} is nog bezig — bevestig en betaal het eerst voor je afrekent.`,
    roundUnpaid: (n: number) => `Ronde ${n} is nog niet betaald. Rond die betaling eerst af.`,
    leaveAnyway: "Toch verlaten — bestelling kwijt",
    unfinishedWarn: "Dit rondje is nog niet afgesloten. Ga eerst terug om het af te maken — of verlaat, waarbij de bestelling en betaling verloren gaan.",
    nothingToRepeat: "Er is nog geen rondje om te herhalen.",

    // ── afrekenen
    finalBalance: "🧾 Eindbalans",
    totalPaid: "💰 Totaal betaald",
    fairVsEqual: "⚖️ Eerlijk verdelen vs Gelijk verdelen",
    fairIsFairest: "Eerlijk verdelen is de eerlijkste keuze!",
    whoPaysWho: "🤝 Wie betaalt aan wie?",
    shortestWay: "Zo min mogelijk overschrijvingen — de app zoekt de kortste weg.",
    fairInfo: "⚖️ Eerlijk — wie weinig of goedkopere drankjes nam, betaalt niet mee voor de rest!",
    equalSplit: "iedereen evenveel",
    equalWouldBe: (v: string) => `Gelijk verdelen zou ${v} per persoon zijn.`,
    equalColHead: "gelijk",
    getsWord: "krijgt",
    paysWord: "betaalt",
    fromWord2: "van",
    toWord2: "aan",
    fairColHead: "Eerlijk",
    participantColHead: "Deelnemer",
    equalSplitWarn: "⚠️ Dit is een gelijke verdeling — niet volgens wat ieder dronk.",
    fairSplitInfo: "Gelijke verdeling = totaal ÷ aantal personen. Eerlijk verdelen kijkt naar het verbruik: wie weinig of niks dronk, betaalt niet mee voor wie veel dronk.",
    unassignedWarn: "Wijs de resterende drankjes toe, dan verdeelt de app eerlijk op wat elk verteerde.",
    useFairSplit: "Toewijzen en eerlijk verdelen",
    equalAnyway: "Toch gelijk verdelen",
    total: "Totaal",
    perPerson: "per persoon",
    perDrink: "per drankje",
    drank: "dronk",
    togetherDrank: "Totaal",
    depositAdvanced: "waarborg (voorgeschoten)",
    cardLoss: "verlies drankkaart (gedeeld)",

    // ── eigen drankje
    ownDrinkTitle: "⭐ Eigen drankje",
    ownDrinkIntro: "Staat er iets niet in de lijst? Voeg het toe voor dit feest. Iedereen in de groep ziet het meteen.",
    nameLabel: "Naam",
    namePh: "bv. Trappist van Jos",
    priceLabel: "Richtprijs",
    priceHint: "Nodig om de rekening achteraf eerlijk te verdelen. Een schatting volstaat.",
    addBtn: "Toevoegen",
    remaining: (n: number, max: number) => `Nog ${n} van je ${max} eigen drankjes over`,
    addedByYou: "Door jou toegevoegd",
    removeHint: "Verwijder wat je niet meer nodig hebt. Al besteld in een rondje? Dan blijft het staan.",
    nameYourDrink: "Geef je drankje een naam.",
    needPrice: "Vul een richtprijs in — anders kan dit drankje niet eerlijk verdeeld worden.",
    needAmountOrCancel: "Uit de pot betalen kan niet zonder bedrag. Vul een bedrag in, of kies Geen pot gebruikt.",
    alreadyExists: (n: string) => `"${n}" staat al in de lijst.`,
    maxPerPerson: (n: number) => `Je kan maximaal ${n} eigen drankjes toevoegen.`,
    maxPerGroup: (n: number) => `De groep zit aan het maximum van ${n} eigen drankjes.`,
    drinkInUse: (n: string) => `${n} is al besteld en kan niet meer verwijderd worden.`,

    confirmTitle: "Even bevestigen",
    walkTable: "👥 Rondje opnemen",
    roundTogether: "Nieuw rondje starten",
    roundWalkSelf: "✍️ Rondje zelf opnemen",
    youFetchTitle: "Jij haalt dit rondje",
    theyTap: "Zij tikken aan",
    theyTapRest: "op hun gsm.",
    youPay: "Jij betaalt",
    youPayRest: "aan de bar \u2014 achteraf verrekend.",
    lastRoundWas: (wat: string) => `Vorige was ${wat}`,
    sameAgainShort: "\u21bb zelfde opnieuw",
    notMeShort: "Toch niet",
    iFetchShort: "Ik ga halen \u2192",
    fetchStep1: "Iedereen krijgt nu de melding",
    fetchStep2: "Ieder tikt op zijn eigen gsm aan wat hij wil",
    fetchStep3: "Jij krijgt het barlijstje zodra ze klaar zijn",
    fetchStep4: "Jij betaalt aan de bar — je schiet dus voor",
    yesIFetch: "Ja, ik ga halen →",
    ratherNot: "Toch niet",
    someoneFetches: (naam: string) => `${naam} gaat drankjes halen`,
    gFetchStep1: "Tik aan wat jij wil drinken",
    gFetchStep2: "Iedereen tikt aan op eigen gsm",
    gFetchStep3: (naam: string) => `${naam} krijgt het barlijstje`,
    letsChoose: "Kiezen maar →",
    orderingOpen: "Het bestellen is open",
    roundBusyX: (naam: string) => `Rondje bezig — ${naam} gaat halen`,
    someChose: (n: number, t: number) => `${n} van ${t} pers. zijn klaar`,
    chosenCount: (n: number) => `${n} ${n === 1 ? "drankje" : "drankjes"} gekozen`,
    imDoneBtn: "✓ Bevestig mijn keuze",
    youAreDone: (n: number) => `✓ Jij bent klaar — ${n} ${n === 1 ? "drankje" : "drankjes"}`,
    allChose: "Iedereen heeft gekozen",
    pickBelow: "👇 Selecteer je drankjes",
    noRoundTitle: "Nog geen rondje gestart",
    noRoundBody: "Start er zelf \u00e9\u00e9n of wacht tot iemand anders start.",
    justLooking: "Ik kijk nog even rond",
    extrasLine: "⚙️ Extra’s — bekers, coins",
    oneCoinIs: "1 coin =",
    laterLooking: "Later, ik kijk nog even",
    youAdvance: "Jij schiet voor (of via de pot) — wordt achteraf verrekend in deze app",
    youWalkTitle: "Jij neemt het rondje op",
    walkStep1: "Je gaat de tafel rond, persoon per persoon",
    walkStep2: "Jij tikt alle drankjes zelf aan",
    walkStep3: "Daarna krijg je het barlijstje",
    yesIWalk: "Ja, ik neem op →",
    potInPot: "💰 In de pot",
    peopleInGroup: "Aantal personen in de groep",
    putInPot: (b: string) => `legde ${b} in de pot`,
    notRightBtn: "Klopt niet",
    removeJoinerQ: (n: string) => `${n} verwijderen? Zijn plaats verdwijnt en wat hij in de pot legde wordt teruggedraaid.`,
    waitTitle: "Je zit erbij — even wachten",
    waitForHost: (naam: string) => `Zodra ${naam || "de gastheer"} het bestellen opent, kunnen we starten.`,
    openStep1: "Vanaf nu kan er besteld worden",
    openStep2: "Wie gaat halen, tikt dat aan boven de drankjes",
    openStep3: "Daarna tikt iedereen aan wat hij wil",
    okWord: "Begrepen",
    okKort: "ok",
    stillBusy: "nog bezig…",
    youTapFor: "Je tikt aan voor:",
    youWord: "jij",
    nowTappingFor: (naam: string) => `Nu tik je voor ${naam} aan`,
    tapForQrGuest: (naam: string) => `${naam} kwam via de QR binnen en tikt normaal zelf aan op zijn gsm.\n\nWil je toch voor ${naam} aantikken? Doe dat alleen als het echt nodig is — bijvoorbeeld bij een lege batterij.`,
    tapForQrYes: "Ja, ik tik voor hem aan",
    qrTapsSelf: "📱 tikt zelf aan op zijn gsm — je hoeft niets te doen.",
    nothingForMe: "niets deze ronde",
    nothingForMeBtn: "— Niets voor mij",
    youTakeNothing: "Je neemt niets deze ronde.",
    chooseAnyway: "toch iets kiezen",
    remindBtn: "🔔 Herinner wie nog niet koos",
    remindTitle: "🔔 Een duwtje geven?",
    remindBody: (namen: string) => `${namen} ${namen.includes(",") ? "kozen" : "koos"} nog niets. Zij krijgen meteen een melding op hun scherm.`,
    remindYes: "Ja, stuur →",
    reminderSentTo: (namen: string) => `✓ Herinnering verstuurd naar ${namen}.`,
    everyoneChoseAlready: "Iedereen heeft al gekozen — je kan vertrekken.",
    allChoseTitle: "Iedereen heeft gekozen",
    allChoseYou: "Je kan gaan halen. Dit heb je nodig:",
    allChoseGuest: (naam: string) => `${naam || "De haler"} kan vertrekken — je drankje komt eraan.`,
    toTheBarBtn: "🍻 Op naar de bar →",
    cancelRoundBtn: "✕ Rondje annuleren",
    cancelRoundTitle: "Dit rondje annuleren?",
    cancelRoundBody: "Alles wat al aangetikt is gaat weg, ook bij de anderen. Dit kan niet ongedaan worden.",
    cancelRoundYes: "Ja, annuleren",
    cancelRoundDone: "Het rondje is geannuleerd.",
    cancelRoundFailed: "Annuleren mislukt.",
    roundCancelled: (naam: string) => `${naam || "De haler"} heeft het rondje geannuleerd. Alles van dat rondje is weg.`,
    reminderFailed: "Herinnering versturen mislukt.",
    reminderTitle: "⏰ Nog even jouw keuze",
    reminderBody: (naam: string) => `${naam} klaar om drankjes te halen. Tik aan wat je wil — of laat weten dat je niets neemt.`,
    reminderChoose: "Ik kies iets →",
    everyoneTapsOwn: "iedereen tikt zelf aan op zijn gsm",
    walkDone: "✓ Klaar",
    walkFor: (n: string) => `Wat wil ${n}?`,
    claimSeatFirst: "Neem eerst een plaats voor je een rondje start.",
    modeTitle: "Deel QR in groep",
    modeTitleSub2: "Betaalt eerlijk volgens wat hij of zij dronk",
    modeQuick: "Ik bestel voor de groep",
    modeQuickSub: "Jij tikt zelf alle drankjes aan.",
    orWord: "of",
    modeFairSub: "Iedereen scant QR met eigen gsm",
    modeFairSub2: "Duidt aan wat hij of zij drinkt",
    modeFairLine: "Eerlijk betalen volgens wat je dronk",
    modeSwitchLater: "Kies je snel noteren, dan kan je op het einde alsnog eerlijk per persoon verdelen.",
    chooseHow: "Kies hoe je wil bestellen",
    atRestaurantQ: "Ook de rekening delen op restaurant?",
    seeWhatRestoDoes: "Bekijk wat Rundo Resto doet",
    restoTagline: "Scan de rekening, verdeel in groep",
    restoStep1: "scan de rekening",
    restoStep2: "deel QR met de groep",
    restoStep3: "tik aan wat je nam",
    restoStep4: "eerlijk verdeeld!",
    tryItBtn: "Probeer het eens",
    youNoteSelf: "Neem zelf op",
    youNote1: "Jij tikt alle drankjes zelf aan",
    youNote2: "Handig barlijstje",
    youNote3: "Snel of eerlijk verdelen — jij kiest",
    modeSnelTitle: "Zelf noteren",
    modeNaamTitle: "Ik neem op voor de groep",
    modeNaamShort: "Ik neem zelf op",
    tagline: "Rondjes opnemen en splitten zonder gedoe",
    showToFriend: "📱 QR-code van de groep",
    shareWithMore: "Deel gerust met wie er nog wil bijkomen",
    seatsFullGuest: "Alle plaatsen zijn bezet — de gastheer kan er eentje bijzetten.",
    youBadge: "JIJ",
    orderWord: "Bestelling",
    howManyPeople: "Met hoeveel zijn jullie?",
    people: "pers.",
    headcountForward: "Dit geldt vanaf het volgende rondje. Eerdere rondjes houden hun aantal — corrigeer die desnoods in het rondjesoverzicht.",
    headcountNotRetro: "Dit verandert de bedragen hieronder niet: elk rondje houdt het aantal dat toen gold. Wil je een eerder rondje corrigeren, doe dat in het rondjesoverzicht.",
    barList: "📋 Bestelling",
    tapToRename: "tik om de naam te wijzigen",
    removeWord: "Weghalen",
    barHandOut: "Uitdelen",
    paidForRoundQ: (n: number) => `Betaald voor rondje ${n}?`,
    potTopUpPlus: "+ pot aanvullen",
    withHowManyQ: "Met hoeveel personen was dit rondje?",
    orderedLabel: "Besteld",
    barlistBtn: "handig barlijstje",
    potClamped: (b: string) => `De pot kon maar ${b} dekken — de rest van het rondje telt zonder pot.`,
    thanksClosed: "🍻 Bedankt en tot de volgende! Je avond blijft bewaard bij Opgeslagen groepen.",
    cancelledBy: (naam: string) => `✕ ${naam} annuleerde het rondje.`,
    runnerDoneBtn: "🍻 Rondje afronden en halen",
    runnerDoneNote: (naam: string) => `✓ Bestelling bevestigd — ${naam} gaat halen. Proost!`,
    haalTitel: "✓ Bestelling bevestigd",
    haalSub: "Jij gaat halen — iedereen kreeg een seintje.",
    haalKlaar: "✓ Gehaald",
    runnerCloseFailed: "Afronden mislukt.",
    adminRoundOf: (naam: string) => `rondje van ${naam}`,
    fillPayBtn: "💶 Bedrag & betaling invullen",
    tappedForYou: (naam: string) => `🍺 ${naam} duidt drankjes voor je aan — kijk even op je lijstje.`,
    editOrderPlain: "bestelling aanpassen",
    barlistTitle: "Barlijst",
    barlistPieces: (n: number) => `${n} ${n === 1 ? "stuk" : "stuks"}`,
    barlistAdjust: "Aanpassen",
    barlistDone: "Klaar",
    paidLabel: "Betaald",
    adjustWord: "Aanpassen",
    notSavedYet: "niet opgeslagen",
    saveWord: "Opslaan",
    cardWord: "drankkaart",
    potTopUp: "Pot aanvullen",
    potEmptyFillFirst: "De pot is leeg — vul eerst bij om hieruit te betalen.",
    editRoundHead: (n: number) => `Rondje ${n} aanpassen`,
    paidWithQ: "Waarmee betaald?",
    paidNote: (v: string) => `Betaald ${v}`,
    noAmountNote: "Geen bedrag ingevuld",
    noPotUsed: "geen pot gebruikt",
    paidFromPot: (v: string) => `${v} uit de pot`,
    skipCostWarn: "Je vulde al iets in bij dit rondje. Toch overslaan zonder het op te slaan?",
    skipCostYes: "Ja, overslaan",
    finishRoundFirst: "Rond eerst dit rondje af — vul in wat het kostte of tik Overslaan.",
    payFirstOne: (nr: number) => `Vul eerst de betaling van rondje ${nr} in, of sla ze over.`,
    payFirstMany: (n: number) => `Nog ${n} rondjes zonder bedrag. Vul ze in, of sla de betaling over.`,
    paidSelf: "Geen pot gebruikt",
    paidSelfShort: "Zonder pot",
    paidPotShort: "Uit de pot",
    paidPot: "Pot gebruikt",
    whoPaidWhat: "wie betaalde wat",
    totalPaidShort: "Totaal betaald",
    potShare: "waarvan uit de pot",
    potSpentWord: "besteed",
    potLeftLong: "nog in de pot",
    persPaidWord: "door personen betaald",
    leaveSettleMsg: "Afrekenen loopt nog — toch naar het rondjesoverzicht? Wat je al invulde blijft bewaard.",
    leaveSettleYes: "Ja, ga verder",
    potShareAll: "volledig uit de pot",
    inRounds: (t: string) => `rondje ${t}`,
    mixSamen: (b: string) => `samen ${b}`,
    mixPotAvail: (b: string) => `${b} beschikbaar`,
    mixPotShort: (b: string) => `maar ${b} in de pot`,
    potShortTitle: "Niet genoeg in de pot",
    potShortSimple: (inPot: string, kost: string) => `Nog ${inPot} in de pot, dit rondje kost ${kost}.`,
    tryPartHint: "Kies \u201ceen deel\u201d om de rest zelf te betalen.",
    potWord: "pot",
    skipPayment: "Betaling overslaan",
    skipWord: "Overslaan",
    later: "Later",
    back: "Terug",
    quickSettleTitle: "Afrekenen",
    fairSubtitle: "eerlijk verdelen",
    quickTotalLabel: (n: number) => `Totaal van ${n} ${n === 1 ? "rondje" : "rondjes"}`,
    noAmountsYet: "Nog geen bedragen ingevuld",
    roundsOnly: (n: number) => `${n} ${n === 1 ? "rondje" : "rondjes"}`,
    fairAskShort: "Eerlijk verdelen?",
    roundCancelledNote: (n: number) => `Rondje ${n} is geannuleerd. Je kan meteen opnieuw beginnen.`,
    fairNudge: "Wijs de drankjes toe en vul de bedragen in.",
    fairNudgeBtn: "Nu aanvullen",
    quickTotalOf: (t: number) => `(van in totaal ${t} ${t === 1 ? "rondje" : "rondjes"})`,
    andWord: "en",
    roundsNoAmountNamed: (lijst: string) => `Rondje ${lijst} zonder bedrag`,
    roundsNoAmountCount: (n: number) => `${n} rondjes zonder bedrag`,
    roundsNoAmountWhy: (n: number) => n === 1
      ? "Die telt niet mee in de verdeling hieronder. Vul aan of laat zo."
      : "Die tellen niet mee in de verdeling hieronder. Vul ze aan of laat ze zo.",
    roundsNoAmountFair: "Eerlijk verdelen gebeurt volgens wie wat dronk — daarvoor heeft elk rondje een bedrag nodig. Vul aan om verder te kunnen.",
    fillAmountsBtn: "Bedragen aanvullen ›",
    nothingToSplit: "Er valt nog niets te verdelen",
    nothingToSplitWhy: "Geen enkel rondje heeft een bedrag. Vul de openstaande bedragen aan — daarna kan je gelijk of eerlijk verdelen.",
    noAmountBadge: "zonder bedrag",
    addPaymentBang: "Betaling toevoegen!",
    addAmountBtn: "€ Bedrag toevoegen",
    splitEqually: "Gelijk verdelen",
    splitWithFair: "Eerlijk verdelen",
    splitFairSub: "wie meer dronk, betaalt meer",
    splitEqualSub: "iedereen evenveel",
    fastest: "snelste",
    fairest: "eerlijkste",
    payersTitle: "Wie betaalde?",
    roundCount: (n: number) => `${n} ${n === 1 ? "rondje" : "rondjes"}`,
    stillToAssign: (v: string) => `${v} nog toe te wijzen`,
    whoPaidThisRound: "Wie betaalde dit rondje?",
    tapNameBelow: "Wie betaalde dit rondje? Tik een naam aan",
    fillAmountFirstShort: "Vul eerst het bedrag in",
    sameForAll: "Dezelfde betaler voor alle rondjes",
    toFinal: "Eindbalans — eerlijk verdeeld",
    missingPayer: (n: number) => `Nog ${n} ${n === 1 ? "rondje" : "rondjes"} zonder bedrag of betaler`,
    potNotSplit: "De pot staat op de groep, nog niet op namen.",
    potSpreadEven: "Gelijk verdelen",
    potNewTotal: "Nieuw totaal in de pot",
    potOverMax: (nieuw: string, oud: string) => `Je verdeelt ${nieuw} terwijl er ${oud} in de pot ging. Toch zo opslaan?`,
    potOverShort: (v: string) => `${v} meer dan er in de pot zat`,
    saveAnyway: "Toch opslaan",
    backToSettle: "← Terug naar afrekenen",
    stepOf: (n: number, t: number) => `stap ${n} van ${t}`,
    backToAssign: "← Terug naar toewijzen",
    backToPayers: "← Terug naar wie betaalde",
    backToNames: "← Terug naar namen",
    openAssign: "✏️ Drankjes toewijzen",
    potShort: "In de pot",
    splitEvenShort: (n: number) => `Gelijk over ${n}`,
    perPersonShort: "Per persoon",
    toStep3: "Naar stap 3 · wie betaalde →",
    potFree: (v: string) => `${v} vrij`,
    potUsedFree: (g: string, v: string) => `${g} gebruikt · ${v} vrij`,
    potShared: (tot: string, n: number) => `Pot ${tot} · verdeeld over ${n}`,
    changeWord: "wijzig",
    whoIsIn: "WIE DOET MEE",
    inRoundNow: (n: number) => `In dit rondje · rondje ${n}`,
    confirmedOf: (a: number, b: number) => `${a} van ${b} bevestigd`,
    busyChoosing: "bezig met kiezen…",
    togetherDrinks: (n: number) => `Samen ${n} drankje${n === 1 ? "" : "s"}`,
    remindInfo: "🔔 Een duwtje geven — wie nog niets koos, krijgt meteen een melding op zijn scherm. Handig als je klaar bent om te vertrekken.",
    toTheBar: "🍻 Naar de bar",
    showBig: "⛶ groot tonen",
    forTheBar: "VOOR DE TOOG",
    closeWord: "Sluiten",
    togetherWord: "Samen",
    newRoundBtn: "🍺 Nieuw rondje",
    doneWithRound: "✓ Klaar met dit rondje",
    cancelRoundShort: "✕ Rondje annuleren",
    provisionalStand: "Voorlopig. Wat je uiteindelijk betaalt of terugkrijgt, hangt af van wie wat voorschoot en van de pot — dat komt bij het afrekenen.",
    nothingWord: "neemt niets",
    totalOf: (v: string) => `${v} totaal`,
    stillOpen: (v: string) => `${v} open`,
    fairSplitExplain: "Liever eerlijk betalen volgens wat iedereen dronk? Wijs drankjes en betalers hier toe.",
    treatHint: "Rondje trakteren? Tik hieronder aan (telt dan niet mee in de verdeling)",
    roundWord: "Rondje",
    drinksCount: (n: number) => `${n} drankje${n === 1 ? "" : "s"}`,
    stillEmpty: "nog leeg",
    someHaveDrinks: (n: number, tot: number) => `${n} van ${tot} hebben al iets`,
    confirmRoundTitle: (n: number) => `\u2705 Rondje ${n} bevestigen`,
    confirmRoundBtn: (n: number) => `\u2705 Bevestig rondje (${n} drankje${n === 1 ? "" : "s"})`,
    roundConfirmed: (nr: number, n: number) => `Rondje ${nr} bevestigd \u00b7 ${n} drankje${n === 1 ? "" : "s"}`,
    notAssignedYet: (n: number) => `${n} drankje${n === 1 ? "" : "s"} nog niet toegewezen.`,
    yourTreat: "jouw traktatie",
    eachPaysNote: "Ieder betaalt",
    headcountVaried: "Niet elk rondje had hetzelfde aantal personen:",
    splitOver: "Verdelen over",
    showPerRound: "Liever exact per rondje verdelen",
    treatShort: "Rondje trakteren?",
    backToOneAmount: "\u2190 Terug naar \u00e9\u00e9n bedrag",
    perRoundTitle: "Per rondje verdeeld",
    plusTreat: (v: string) => `Jij trakteert ${v} extra`,
    payAllNote: "De hele rekening komt op jou:",
    notFairSplitWhy: "Iedereen betaalt evenveel, ook wie minder dronk. Wil je dat wie meer dronk ook meer betaalt? Schakel over naar Eerlijk verdelen.",
    switchToFairBtn: "Naar Eerlijk verdelen",
    fairHintLine: "hierop verdeelt de app eerlijk — wie meer dronk, betaalt meer",
    fairSetupTitle: "⚖️ Wie was erbij?",
    guestNamePh: "naam optioneel",
    fairAddPerson: "+ Persoon toevoegen",
    fairSetupDone: "Naar drankjes toewijzen →",
    roundsOverviewTitle: "🧾 Rondjesoverzicht",
    peopleInRound: "personen in dit rondje",
    showDetails: "Toon details",
    hideDetails: "Verberg details",
    editRoundBtn: "Aanpassen",
    roundsOverviewBtn: "Rondjesoverzicht",
    noRoundsYet: "Nog geen afgeronde bestellingen. Bevestig eerst een rondje.",
    roundSummary: (n: number, items: number) => `Rondje ${n} · ${items} drankje${items === 1 ? "" : "s"}`,
    estimate: "schatting op richtprijzen",
    estimateWhy: "Niemand vulde bedragen in, dus rekenen we met de richtprijzen uit de lijst. Bij benadering, maar eerlijk.",
    voiceBtn: "🎤 Inspreken",
    voiceBeta: "beta",
    voiceListening: "🎤 Luisteren…",
    voiceSay: "Zeg bijvoorbeeld \"2 cola zero\". Werkt het best per drankje apart.",
    voiceHeard: "Verstaan",
    voiceNothing: "Niets herkend. Probeer opnieuw, of tik het gewoon aan.",
    voiceAdd: "Toevoegen aan rondje",
    voiceRetry: "🎤 Opnieuw",
    voiceUnsupported: "Spraak werkt niet in deze browser. Probeer Chrome.",
    voiceDenied: "Geen toegang tot de microfoon.",
  },
  fr: {
    invitedFor: "Tu es invité pour",
    whoAreYou: "Qui es-tu ?",
    tapYourName: "Touche ton nom.",
    notThere: "Tu n'es pas dans la liste ? Prends une place libre.",
    fillNameSeat: "Entre ton nom et prends une place.",
    yourName: "Ton nom",
    seat: (n: number) => `Place ${n}`,
    allSeatsTaken: "Toutes les places sont prises — mais tu peux en ajouter une.",
    joinAddSeat: "Me joindre",
    someoneJoined: (n: string) => `${n} a rejoint`,
    alreadyJoined: "Déjà inscrits",
    fillNameFirst: "Entre d'abord ton nom.",
    tapYourSeatNow: "👇 Touche maintenant ta place",
    potTogetherQ: "💰 Faire une cagnotte commune ?",
    potLayBtn: "Faire une cagnotte",
    whoAreYouTitle: "Qui es-tu ?",
    namePlichtTitle: "Nom du groupe & personnes",
    persCountLabel: "Nombre de personnes",
    persNotNow: "pas obligatoire — possible plus tard aussi",
    aanvulTitle: (n: number, d: number) => `✓ Tourn\u00e9e ${n} not\u00e9e · ${d} boisson${d === 1 ? "" : "s"}`,
    aanvulSub: "Compl\u00e8te pour un partage \u00e9quitable — ou passe.",
    aanvulCost: "💶 Combien \u00e7a a co\u00fbt\u00e9\u00a0?",
    aanvulPaidBy: "pay\u00e9 par",
    aanvulAssign: "🍺 Attribuer les boissons",
    aanvulAssignSub: (n: number) => `${n} encore sans nom`,
    aanvulAssignOk: "tout est attribu\u00e9",
    aanvulSave: "Enregistrer",
    aanvulSkip: "Tout passer — compl\u00e9ter plus tard",
    stillToFill: "N\u00c9CESSAIRE POUR UN PARTAGE \u00c9QUITABLE",
    nogNodigBadge: "ENCORE N\u00c9CESSAIRE",
    allRoundsBtn: "🍺 Toutes les tourn\u00e9es d'un coup",
    allRoundsSeg: "toutes",
    thisRoundSeg: "cette tourn\u00e9e",
    onlyThisRound: "↩ Seulement cette tourn\u00e9e",
    tikSamenWord: "pour tous",
    hintTogether: "Coche toutes les boissons d'un coup pour tout le groupe",
    hintPerPerson: "Coche d'abord un nom, puis la boisson",
    perPersonWord: "par personne",
    fillWord: "Ajouter le montant",
    adjustOrder: "modifier la commande",
    addPersonHere: "Ajouter personne / nom",
    personsAndNames: "Personnes & noms",
    persWord: "Pers.",
    persWordLow: "pers.",
    tapForStrip: "Tu coches pour",
    completeWord: "✓ complet",
    noAmountShort: "Combien pay\u00e9\u00a0?",
    missRoundsNote: (n: number) => `Encore ${n} tourn\u00e9e${n === 1 ? "" : "s"} \u00e0 compl\u00e9ter pour un partage \u00e9quitable`,
    fillNowBtn: "Compl\u00e9ter maintenant →",
    klaarBtn: "Termin\u00e9 →",
    openWord: "Attribuer",
    sameAgainTitle: "🔁 Comme la tourn\u00e9e pr\u00e9c\u00e9dente",
    sameAgainTake: "Reprendre",
    sameAgainEdit: "modifiable ensuite",
    leaveNoNameTitle: "Garder cette soir\u00e9e\u00a0?",
    leaveAutoSub: "On la nomme d\u2019apr\u00e8s la date, sauf si tu tapes autre chose.",
    leaveRoundLine: (n: number, d: number) => `Tourn\u00e9e ${n} \u00b7 ${d} boisson${d === 1 ? "" : "s"}`,
    closeNeedName: "Donne un nom \u00e0 ton groupe pour le garder dans ta liste.",
    nameRequiredHint: "⚠️ obligatoire pour enregistrer",
    closeAndSave: "Cl\u00f4turer et enregistrer",
    leaveNoNameSub: "Sans nom, tu ne retrouveras plus ce groupe. Donne-lui un nom pour tout garder.",
    saveAndStay: "Enregistrer et rester ici",
    leaveNoSaveBtn: "Partir sans enregistrer",
    saveAndLeave: "Enregistrer et partir",
    namePh3: "Nomme ton groupe",
    naamGoBtn: "Continuer \u2192",
    nameFirstNote: "Remplis d'abord ton nom et le nom du groupe.",
    yourNamePh2: "Ton nom — requis avant le QR",
    backToRundo: "\u2190 retour \u00e0 l'accueil Rundo",
    tryTableLine: "Partager l'addition au restaurant\u00a0? Essaie aussi",
    welkomSub1: "Prendre les tourn\u00e9es",
    welkomSub2: "… et partager sans prise de t\u00eate\u00a0!",
    welkomStart: "Commencer ",
    orWordShort: "ou",
    welkomFlow: [
      { ic: ["✍️", "📱"], label: "note toi-m\u00eame ou partage le QR" },
      { ic: ["👆"], label: "coche les boissons" },
      { ic: ["📋"], label: "liste bar pratique et r\u00e8glement" },
    ],
    potAddBtn: "+ verser",
    seatTaken: "Cette place vient d'être prise. Choisis-en une autre.",
    badCode: "Ce code d'invitation n'existe pas (plus).",
    loading: "Chargement…",

    youAre: "Tu es",
    notMe: "ce n’est pas moi",
    notMeConfirm: (n: string) => `Tu n'es pas ${n} ? Tu libères cette place et tu choisis à nouveau.`,
    releaseSeat: "Libérer la place",
    tabOrder: "🍺 Boissons",
    tabMe: "📋 Tourn\u00e9es",
    youTookLabel: "toi\u00a0:",
    backToDrinks: "\u2190 Retour aux boissons",
    tabGroup: "👥 Groupe & QR",
    groupTitle: "👥 Dans ce groupe",
    peopleN: (n: number) => `${n} ${n === 1 ? "personne" : "personnes"}`,
    joinedOfTotal: (a: number, b: number) => `${a} sur ${b} inscrits`,
    hostMark: "organisateur",
    startNotAll: (n: number, t: number) => `${n} sur ${t} pas encore inscrits. Commencer quand même ?`,
    startWait: "Attendre encore",
    startAnyway: "Commencer",
    scannedSelf: "📱 inscrit",
    youMark: "toi",
    notScannedYet: "pas encore inscrit",
    inviteMore: "Invite plus de monde — fais scanner le code.",
    roundWhatYouWant: (n: number) => `🛒 Tournée ${n} — ce que tu veux`,
    searchDrink: "Chercher une boisson…",
    shortList: "⚡ Liste courte",
    fullListBtn: "📖 Liste complète",
    nothingFound: "Rien trouvé — essaie un autre mot.",

    myTab: "🧾 Mon compte",
    noRoundClosed: "Aucune tournée n'est encore clôturée.",
    whatYouDrank: "Ce que tu as bu",
    whatDidItCost: "Combien a co\u00fbt\u00e9 cette tourn\u00e9e\u00a0?",
    costLabel: "COMBIEN A CO\u00dbT\u00c9 CETTE TOURN\u00c9E\u00a0?",
    whoPutMoney: "Qui a avanc\u00e9 l'argent\u00a0?",
    whoPaidTapIt: "Qui a pay\u00e9 cette tourn\u00e9e\u00a0? Coche\u00a0!",
    pickWhoPaid: "Choisis qui a pay\u00e9.",
    splitEvenNote: "R\u00e9parti \u00e9galement \u2014 ajuste par personne si besoin",
    fromPotQ: "Une partie vient de la cagnotte\u00a0?",
    noSelfPaid: "non, pay\u00e9 soi-m\u00eame",
    yesFromPot: "oui, de la cagnotte",
    selfPaidShort: "pay\u00e9 soi-m\u00eame",
    fromPotShort: "de la cagnotte",
    fromPotLabel: "De la cagnotte",
    notFromPotLabel: "Hors cagnotte",
    wholeRoundFromPot: "Toute la tourn\u00e9e sort de la cagnotte.",
    potLeftAfter: "Il restera dans la cagnotte\u00a0:",
    confirmPayBtn: "Confirmer le paiement",
    fillAmountHint: "Indique le montant pay\u00e9",
    confirmShort: "confirmer",
    potPaysWholeQ: "La cagnotte paie toute la tourn\u00e9e\u00a0?",
    yesWord: "oui",
    noPartOnly: "non, une partie",
    restOutsidePot: "Reste hors cagnotte\u00a0:",
    potPaidIn: (bedrag: string) => `💰 versé ${bedrag}`,
    roundN: (n: number) => `Tournée ${n}`,
    nothingThisRound: "tu n'avais rien dans cette tournée",

    newDrinkTile: "Boisson perso ?",
    shortListBtn: "🔼 Liste courte",

    // ── start & setup
    autoName: () => { const d = new Date(); const m = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]; return `Tournée ${d.getDate()} ${m[d.getMonth()]}` },
    autoNameQr: () => { const d = new Date(); const m = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]; return `Tournée QR ${d.getDate()} ${m[d.getMonth()]}` },
    whereLeftTitle: "⏳ Où en étais-tu ?",
    whereLeftSub: "Ces groupes sont encore ouverts ici :",
    whereLeftNew: "🆕 Démarrer un nouveau groupe",
    whereLeftGo: "continuer",
    newGroupNameTitle: "Nom de ton nouveau groupe",
    newGroupNameSub: "Ainsi tu le reconnais parmi tes autres groupes.",
    startWord: "Démarrer",
    startQuickBtn: "Démarrer",
    addNonScanner: "✍️ Ajouter quelqu'un soi-m\u00eame",
    linkCopiedShort: "✓ Copié",
    joinInviteShort: (naam: string) => `Tu viens à ${naam || "notre tournée"} ? Scanne ou touche :`,
    pasteAndShare: "✓ Copi\u00e9 — colle-le dans votre chat de groupe.",
    sectionGroup: "LE GROUPE",
    sectionExtras: "EXTRAS",
    startOrdering: "Commencer à commander",
    startOrderingSub: "qui scanne plus tard rejoint simplement",
    everyoneTapsNow: "chacun peut cocher",
    showQr: "📱 Afficher le QR",
    toQrStep: "Vers le QR-code →",
    addThis: "Ajouter",
    seatNameTitle: "Quelqu’un qui ne scanne pas",
    seatNameSub: "Mets son nom — s’il scanne plus tard, il le touchera simplement.",
    yourNamePh: "Ton nom · optionnel",
    groupNameEdit: "Nom de ce groupe",
    groupNamePh: "Tape le nom de ton groupe",
    groupNameShortPh: "Nom du groupe",
    giveNameQ: "Nom du groupe ? · optionnel",
    groupNamePlain: "Nom du groupe",
    voiceNotPerfect: "ne marche pas encore à tous les coups",
    howNoteTitle: "Comment noter les boissons ?",
    howNoteSub: "✏️ Passer de rapide à au nom reste possible plus tard.",
    noteQuickTitle: "⚡ Noter vite",
    noteQuickExample: "3× Pintje · 2× Cola",
    nextBtn: "Continuer →",
    fastestTag: "LE PLUS RAPIDE",
    fairestTag: "LE PLUS ÉQUITABLE",
    qStep1: "Noter les boissons",
    qStep2: "Liste pratique pour le bar",
    qStep3: "Décompte optionnel",
    nStep1: "Noter et attribuer les boissons",
    nStep2: "Liste pratique pour le bar",
    nStep3: "Chacun paie ce qu’il a bu",
    noteNamedTitle2: "👤 Noter au nom",
    confirmedWord: "confirm\u00e9e",
    guestN: (n: number) => `Invité ${n}`,
    jijNaam: "Toi",
    youTag: "toi",
    yourselfWord: "toi-m\u00eame",
    everyoneWord: "tout le monde",
    fromTwoOn: "Disponible \u00e0 partir de 2 personnes \u2014 ajoutes-en une ci-dessous.",
    forWord: "Pour",
    aloneHint: "Pour l'instant, juste toi",
    canAlsoLater: "Ça peut attendre",
    backToOverviewHint: "Il reste des tourn\u00e9es \u00e0 finaliser.",
    toRoundsOverview: "Vers l'aper\u00e7u des tourn\u00e9es",
    nameLockedNote: "🔒 fig\u00e9 — la soir\u00e9e est cl\u00f4tur\u00e9e",
    editNamesBtn: "✏️ Modifier les noms",
    doneNamesBtn: "✓ Noms termin\u00e9s",
    editNamesHint: "Modifie les noms — ils changent partout, aussi dans les boissons d\u00e9j\u00e0 attribu\u00e9es.",
    notAssignedCount: (n: number) => `${n} boisson${n === 1 ? "" : "s"} non attribu\u00e9e${n === 1 ? "" : "s"}`,
    howNoteQ: "Comment notes-tu cette tourn\u00e9e\u00a0?",
    inRoundTitle: "Dans cette tournée",
    weggehaald: (wat: string) => `${wat} retir\u00e9`,
    undoWord: "Annuler",
    nogNiets: (namen: string) => `${namen}\u00a0: rien pour l'instant`,
    potTitel: "Cagnotte",
    potEvenIn: "mise égale",
    potIn: "mise",
    potOtherBtn: "Réparti autrement ?",
    potWhoFrom: (b: string) => `Qui a mis les ${b} dans la cagnotte ?`,
    mustBeTot: (b: string) => `doit être ${b}`,
    potStayEqual: "Rester égal",
    cancelEdit: "Annuler",
    guestsWhoTitle: "Qui étaient les invités ?",
    guestsWhoSub: "Tout est déjà bon — seuls ces noms manquent pour un décompte lisible.",
    leaveAsIs: "Laisser ainsi",
    toBalanceBtn: "Vers le décompte final →",
    namePh2: "Nom…",
    retentionInfoLink: "ⓘ combien de temps tout reste-t-il ?",
    retentionInfo: "Tout est enregistré automatiquement. Les groupes ouverts restent tant que tu es actif et se clôturent après 24 h de silence ; les groupes clôturés disparaissent après les jours sur leur puce — sauf si tu les gardes avec le bouton disquette ou les prolonges.",
    chipDays: (n: number) => `encore ${n} jour${n === 1 ? "" : "s"}`,
    filterSaved: "gardés",
    statusOpen: "🟡 ouvert",
    statusClosed: "✓ clôturé",
    filterAll: "Tous",
    moreGroups: (n: number) => `plus de groupes (${n}) ▾`,
    lessGroups: "▴ en voir moins",
    extendMsg: (naam: string, datum: string) => `Garder "${naam}" 30 jours de plus ? La soirée restera jusqu’au ${datum}.`,
    extendYes: "+30 jours",
    unpinMsg: (naam: string) => `"${naam}" est gardé pour une durée indéterminée. Détacher ? Il disparaîtra alors après un temps.`,
    closeEveBtn: "🌙 Clôturer la soirée",
    eveClosedTitle: "🌙 Soirée clôturée ✓",
    eveClosedSub: "Tout est bien enregistré — tu retrouves cette soirée dans Groupes enregistrés.",
    shareBillBtn: "📤 Partager le décompte",
    copiedNote: "Décompte copié — colle-le dans votre chat de groupe.",
    namesMissing: (n: number) => `${n} personne${n === 1 ? "" : "s"} sans nom. Complète via ⚙️ Groupe, sinon le décompte affichera « Place 3 ».`,
    someUnassigned: (n: number) => `🔴 ${n} boisson${n === 1 ? "" : "s"} sans nom`,
    nowWord: "actuel :",
    starting: "En cours…",
    savedGroups: "Groupes enregistrés",
    modeFairShort: "Chacun coche lui-même",
    shareLinkBelow: "partage le lien ci-dessous",
    modeQuickShort: "Je commande pour le groupe",
    pinOn: "Enregistrer",
    pinOff: "Ne plus enregistrer",
    maxPins: (n: number) => `Tu peux épingler ${n} groupes au maximum. Détaches-en un d'abord.`,
    sleepBanner: "⏸ Mises à jour en direct en pause — touche pour reprendre",
    searchGroups: "Chercher un groupe…",
    showWord: "Afficher",
    hideWord: "Masquer",
    wipeAll: "Tout effacer",
    wipeAllTitle: "Tout effacer ?",
    wipeAllBody: (weg: number, blijft: number) => blijft > 0
      ? `Tu supprimes définitivement ${weg} groupe${weg === 1 ? "" : "s"}, avec toutes les tournées et montants. Tes ${blijft} groupe${blijft === 1 ? "" : "s"} enregistré${blijft === 1 ? "" : "s"} reste${blijft === 1 ? "" : "nt"}.`
      : `Tu supprimes définitivement ${weg} groupe${weg === 1 ? "" : "s"}, avec toutes les tournées et montants.`,
    wipeAllYes: (n: number) => `Oui, efface ${n === 1 ? "celui-là" : `ces ${n}`}`,
    noSearchHit: "Aucun groupe trouvé.",
    wipeSomeFailed: (n: number) => `${n} groupe${n === 1 ? "" : "s"} n’${n === 1 ? "a" : "ont"} pas pu être supprimé${n === 1 ? "" : "s"}. Réessaie.`,
    stalePins: (n: number) => `${n} groupe${n === 1 ? "" : "s"} épinglé${n === 1 ? "" : "s"} depuis longtemps inutilisé${n === 1 ? "" : "s"}`,
    stalePinsWhy: "Les détacher ? Ils seront alors supprimés après un mois, comme les autres groupes clôturés.",
    stalePinsKeep: "Garder",
    asGuest: "en tant qu'invit\u00e9",
    delGroupConfirm: (n: string) => `Supprimer "${n}" ? C'est d\u00e9finitif — toutes les tourn\u00e9es et donn\u00e9es de ce groupe seront perdues.`,
    delGroupYes: "Supprimer",
    cancel: "Annuler",
    createFailed: "Échec de la création du groupe. Réessaie.",

    peopleTitle: "Personnes",
    addPersonFirst: "Ajoute d'abord au moins une personne.",
    whichAreYou: "Lequel es-tu ?",
    assignAnyone: "Tu peux attribuer à tout le monde — même à ceux qui ont scanné.",
    pickYourName: "Touche ton nom — le reste, tu le coches toi-même en commandant.",
    personHasDrinks: (n: string) => `${n} a déjà des boissons dans une tournée et ne peut pas être supprimé. Supprime d'abord ces boissons.`,
    thisPerson: "Cette personne",

    // ── delen
    letGuestsScan: "📲 Fais scanner tes invités",
    whoIsInYet: "Qui est d\u00e9j\u00e0 l\u00e0",
    scanToJoin: "Ceux qui scannent plus tard rejoignent simplement.",
    copyLink: "Copier le lien",

    // ── startvragen
    beforeWeStart: "Choisis ta formule",
    beforeQrTitle: "Encore ceci",
    settingsLater: "Besoin d'un pot, de gobelets ou de jetons ? Ça s'active via ⚙️ Groupe — pas maintenant.",
    perManShort: "p.p.",
    potTotalIn: "Total dans la cagnotte :",
    potInShort: "vers\u00e9",
    potStillIn: "reste",
    alreadyInPot: "D\u00e9j\u00e0 dans la cagnotte",
    nowAdding: "Ajout\u00e9 maintenant",
    newPotTotal: "Nouveau total",
    firstDeposit: "1re mise",
    addDeposit: "mise suppl\u00e9mentaire",
    editDeposit: "modifier la mise",
    addToPot: "Ajouter \u00e0 la cagnotte",
    potFillAmount: "Entre d\u2019abord un montant.",
    setPotTo: (v: string) => `Mettre la cagnotte \u00e0 ${v}`,
    unassignedHub: (n: number) => `🔴 ${n} boisson${n === 1 ? "" : "s"} pas encore attribuée${n === 1 ? "" : "s"}`,
    unassignedHubWhy: "Sans nom, elles sont partagées également — pas équitable. Attribue-les pour que chacun paie ce qu'il a bu.",
    assignAllBtn: "Vers l'attribution des boissons",
    assignFirstNote: "Attribue d\u2019abord toutes les boissons. Ensuite tu peux continuer.",
    assignTitle: "Attribuer les boissons",
    roundXofY: (a: number, b: number) => `Tourn\u00e9e ${a} sur ${b}`,
    assignAllSub: (n: number) => `Les ${n} tourn\u00e9es d\u2019un coup`,
    roundDoneNext: "Cette tourn\u00e9e est compl\u00e8te",
    roundDoneShort: "Tourn\u00e9e attribu\u00e9e",
    nextRoundAssign: (n: number) => `Suivante : tourn\u00e9e ${n} →`,
    allAssignedDone: "Termin\u00e9 \u2014 tout est attribu\u00e9",
    quickStart: "Démarrer",
    continueRound: (n: number) => `Continuer la tournée ${n}`,
    backToRound: (n: number) => `\u2190 Retour à la tournée ${n}`,

    // ── instellingen
    groupShort: "⚙️ Groupe",
    cupsTitle: "♻️ Gobelets réutilisables",
    cupsInfo: "Pour les events avec caution par gobelet, remboursée au retour. Active pour l'inclure dans le décompte.",
    depositPerCup: "Caution/gobelet",
    coinsTitle: "🎟️ Jetons",
    coinsInfo: "Tu paies en jetons plutôt qu'en euros ? Règle la valeur et les prix ; l'app répartit équitablement.",
    coinPrices: "🎟️ prix en jetons par boisson",
    coinPricesInfo: "Jetons festival par défaut. Ajuste avec − / + (pas de 0,1).",
    potTitle: "Pot",
    noPotYet: "Pas encore de cagnotte",
    potSummary: (n: number, over: string) => `${n} participant${n === 1 ? "" : "s"} \u00b7 ${over} restant`,
    detailsWord: "d\u00e9tails",
    alreadySpent: "d\u00e9j\u00e0 d\u00e9pens\u00e9",
    stillLeft: (b: string) => `reste ${b}`,
    potAdjust: "Ajuster la cagnotte",
    withHowMany: "Vous êtes combien ?",
    groupPutIn: (b: string) => `Le groupe a mis ${b} en commun`,
    thatIsEach: (b: string) => `Soit ${b} par personne. Si tu participes, tu bois aussi de la cagnotte.`,
    whoPutWhat: "Qui a mis quoi\u00a0?",
    potShiftedToSelf: (n: number, b: string) => `\u26a0\ufe0f La cagnotte ne couvre plus tout\u00a0: ${n} tourn\u00e9e${n === 1 ? "" : "s"} (${b}) \u00e0 payer soi-m\u00eame.`,
    iPutIn: (b: string) => `Je mets ${b}`,
    settleApart: "Non, je paie s\u00e9par\u00e9ment",
    joinedPot: (n: string, b: string) => `${n} a mis ${b} dans la cagnotte`,
    eachPutsIn: "Combien met chacun\u00a0?",
    seatsFillLater: "Chacun prend une place en scannant.",
    potHowManyQ: "Vous êtes combien ?",
    fillCoinValue: "Entre la valeur du jeton (1 jeton = €…) — ou désactive les jetons.",
    fillDeposit: "Entre le montant de la caution par gobelet — ou désactive les gobelets.",

    // ── bestellen
    inThisRound: "🛒 Dans cette tournée",
    someoneCanGo: "👉 Quelqu'un peut aller chercher !",
    noFavsHere: "Aucun favori ici.",
    showAll: "📖 tout afficher",
    assign: "Attribuer",
    assignHint: "— touche pour attribuer",
    assigned: "✓ attribué",
    eachOne: "👥 1 chacun",
    eachOneConfirm: (n: string, meer: boolean) => `${n} ${meer ? "en ont" : "en a"} déjà 2 ou plus. Avec « 1 chacun », tout le monde en reçoit exactement un — ${n} ${meer ? "redescendent" : "redescend"} donc à 1.`,
    yesEachOne: "Oui, 1 pour tous",
    toAssignCount: (n: number) => `${n} à attribuer`,
    closeRound: "✓ Clôturer la tournée",
    cancelRound: "✕ Annuler la tournée",
    cancelRoundConfirm: (n: number) => `Annuler la tournée ${n} ? Toutes les boissons choisies seront perdues. C'est irréversible.`,
    yesCancel: "Oui, annuler",
    backFinish: "← Retour, terminer la tournée",
    cups: "Gobelets",
    cupsNotSet: "Gobelets pas encore indiqués.",
    tapToArrange: "Touche ici pour régler →",
    tapToAssign: "Touche ici pour attribuer",
    nobodyGaveBack: "🚫 personne n'a rendu de gobelet",
    howMuchEach: "Combien chacun a rendu",
    gaveBack: "a rendu",
    ready: "Terminé",

    // ── betalen
    exactAmount: "💰 Montant exact payé pour cette tournée ?",
    whoPaidThis: "Qui a payé cette tournée ?",
    roundsMissingAmount: (nrs: string) => `La tournée ${nrs} n’a pas encore de montant ou de payeur. Complète d’abord — sinon le partage ne tient pas.`,
    iPaidBtn: "🙋 Toi",
    fromPotBtn: "💰 La cagnotte",
    fromCardBtn: "💳 La carte",
    howMuchYou: "💰 Combien as-tu payé toi-même pour cette tournée ?",
    howMuchPot: "💰 Combien as-tu payé avec la cagnotte ?",
    potEmptyPay: (kaart: boolean) => `${kaart ? "La carte" : "La cagnotte"} est vide — remplis-la d’abord ou choisis « Toi ».`,
    amountAndPayer: "montant & payeur",
    whoPaid: "Choisis qui a payé.",
    multiplePossible: "(plusieurs possibles)",
    fillAmountFirst: "Entre d'abord le montant payé — ensuite tu choisis qui a payé.",
    fillPerPayer: "Entre un montant par payeur.",
    confirmPaymentFirst: "Confirme d'abord le paiement.",
    thePot: "le pot",
    fromPot: "du pot",
    fromCard: "de la carte boissons",
    notPaidYet: "pas encore payé",
    paidBy: "Payé par",
    roundingNote: "le centime d'arrondi est r\u00e9gl\u00e9 dans le partage \u00e9quitable",

    // ── pot
    potMoney: "Pot (argent)",
    drinkCard: "💳 Carte boissons",
    addPotContrib: "➕ Ajouter une mise au pot",
    addMoreToPot: "\u2795 Ajouter encore",
    nthDeposit: (n: number) => `Mise ${n}`,
    resetContrib: "↺ réinitialiser",
    everyone: "👥 répartir sur tous",
    ownAmount: "ou montant libre :",
    cardValue: "Valeur de la carte",
    whoBoughtCard: "Qui a acheté la carte ? (touche — le montant apparaît)",
    addContrib: (b: string) => `✓ Ajouter la mise (${b})`,
    removeContrib: "✓ Supprimer la mise (vide)",
    beingEdited: "✏️ en cours de modification ↓",
    inPot: "mis au pot",
    removeContribConfirm: (l: string) => `Supprimer la ${l} du pot ? C'est irréversible.`,
    potEmpty: (kaart: boolean) => `${kaart ? "La carte boissons" : "Le pot"} est vide — ajoute d'abord.`,
    potTooLow: (kaart: boolean, max: string) => `${kaart ? "La carte" : "Le pot"} n'a que ${max} — baisse le montant ou remets-en.`,
    potNothingIn: (kaart: boolean) => `Tu as choisi ${kaart ? "une carte boissons" : "un pot"}, mais rien n'a encore été mis. Continuer quand même ?`,
    anywayWithout: (kaart: boolean) => `Continuer sans ${kaart ? "carte" : "pot"}`,

    // ── overzicht
    roundsOverview: "📋 Aperçu des tournées",
    overview: "📋 Aperçu",
    repeatRound: "🔁 La même",
    repeatRoundSub: "modifiable",
    settleBtnShort: "🧾 Régler",
    proposalTitle: "🗳️ La même tournée ?",
    proposalWaiting: "Chacun répond sur son écran. Tu clôtures quand tu veux.",
    ansSame: "✅ pareil",
    ansDiff: "🔄 autre chose",
    ansWaiting: "⏳ pas encore",
    ansSkip: "✋ passe",
    gProposalTitle: "🗳️ La même tournée ?",
    gProposalSame: "✅ Oui, pareil pour moi",
    gProposalDiff: "🔄 Choisir autre chose",
    gProposalSkip: "✋ Rien pour moi ce tour",
    gProposalDone: "Ton choix est noté.",
    gProposalYourLast: "Au tour d'avant tu avais :",
    closeProposalBtn: (n: number) => `Clôturer · ${n} ${n === 1 ? "participe" : "participent"}`,
    noOrderFor: (names: string) => `Pas de commande pour ${names}`,
    proposalNobody: "Personne n'a encore répondu. Clôturer quand même ?",
    editOrderBtn: "✏️ Modifier la commande ?",
    editOrderOld: "✏️ Modifier la commande",
    noRoundsDone: "Aucune tournée terminée",
    noRoundsHint: "Dès qu'une tournée est confirmée et payée, elle apparaît ici — tu peux encore la modifier.",
    startFirstRoundBtn: "1re tourn\u00e9e",
    toFirstRound: "1re tourn\u00e9e",
    noRoundsHintQuick: "Note ce qui est command\u00e9. Tes tourn\u00e9es termin\u00e9es appara\u00eetront ici.",
    roundBusy: (n: number) => `Tourn\u00e9e ${n} en cours`,
    tapRoundToEdit: "Touche une tournée pour voir les détails ou la modifier.",
    roundsSoFar: (n: number) => `🧾 ${n} tournée${n === 1 ? "" : "s"} jusqu’ici`,
    expandAll: "Tout afficher",
    changeNameTitle: "Modifier ton nom",
    changeNameSub: "C’est ainsi que les autres te reconnaissent dans la liste et au décompte.",
    saveName: "Enregistrer",
    pricePh: "prix à la pièce",
    notOnList: "pas dans la liste ?",
    orderingOpenTitle: "Les commandes sont ouvertes !",
    everyoneCanTapNow: "Chacun peut cocher maintenant",
    orderingOpenBody: (naam: string) => `${naam || "L’hôte"} a ouvert la carte.`,
    goingToDrinks: "Vers les boissons →",
    collapseAll: "Tout masquer",
    settleBtn: "🧾 Régler",
    nothingToSettle: "Aucune tournée terminée à régler.",
    fillAmountsFirst: "0 € — indique d'abord le montant de tes tournées. Ensuite tu peux régler.",
    provisionalTitle: "Bilan provisoire",
    provisionalWhy: (n: number) => `${n} tournée${n === 1 ? "" : "s"} sans montant : ce total n'est pas encore juste.`,
    zeroRoundsNote: (n: number) => `${n} tournée${n === 1 ? "" : "s"} sans montant — compte comme 0 € (p.ex. offerte). Ce n'est pas ça ?`,
    roundUnfinished: (n: number) => `La tournée ${n} est en cours — confirme et paie-la avant de régler.`,
    roundUnpaid: (n: number) => `La tournée ${n} n'est pas payée. Règle d'abord ce paiement.`,
    leaveAnyway: "Quitter quand même — commande perdue",
    unfinishedWarn: "Cette tournée n'est pas clôturée. Retourne la terminer — ou quitte, et la commande et le paiement seront perdus.",
    nothingToRepeat: "Aucune tournée à refaire.",

    // ── afrekenen
    finalBalance: "🧾 Bilan final",
    totalPaid: "💰 Total payé",
    fairVsEqual: "⚖️ Partage \u00e9quitable vs partage \u00e9gal",
    fairIsFairest: "Le partage \u00e9quitable est le plus juste !",
    whoPaysWho: "🤝 Qui paie à qui ?",
    shortestWay: "Le moins de virements possible — l’appli cherche le chemin le plus court.",
    fairInfo: "⚖️ \u00c9quitable — qui a bu peu ou moins cher ne paie pas pour les autres\u00a0!",
    equalSplit: "part égale",
    equalWouldBe: (v: string) => `Un partage égal ferait ${v} par personne.`,
    equalColHead: "\u00e9gal",
    getsWord: "reçoit",
    paysWord: "paie",
    fromWord2: "de",
    toWord2: "à",
    fairColHead: "\u00c9quitable",
    participantColHead: "Participant",
    equalSplitWarn: "⚠️ Ceci est une r\u00e9partition \u00e9gale — pas selon ce que chacun a bu.",
    fairSplitInfo: "R\u00e9partition \u00e9gale = total \u00f7 nombre de personnes. Le partage \u00e9quitable suit la consommation : qui a peu ou rien bu ne paie pas pour ceux qui ont beaucoup bu.",
    unassignedWarn: "Attribue les boissons restantes, puis l'app répartit selon ce que chacun a consommé.",
    useFairSplit: "Attribuer et partager \u00e9quitablement",
    equalAnyway: "Répartir également quand même",
    total: "Total",
    perPerson: "par personne",
    perDrink: "par boisson",
    drank: "a bu",
    togetherDrank: "Total",
    depositAdvanced: "caution (avancée)",
    cardLoss: "perte carte boissons (partagée)",

    // ── eigen drankje
    ownDrinkTitle: "⭐ Boisson personnalisée",
    ownDrinkIntro: "Il manque quelque chose ? Ajoute-le pour cette fête. Tout le groupe le voit immédiatement.",
    nameLabel: "Nom",
    namePh: "p.ex. Trappiste de Jos",
    priceLabel: "Prix indicatif",
    priceHint: "Nécessaire pour répartir la note équitablement. Une estimation suffit.",
    addBtn: "Ajouter",
    remaining: (n: number, max: number) => `Encore ${n} de tes ${max} boissons personnalisées`,
    addedByYou: "Ajouté par toi",
    removeHint: "Supprime ce dont tu n'as plus besoin. Déjà commandé dans une tournée ? Alors ça reste.",
    nameYourDrink: "Donne un nom à ta boisson.",
    needPrice: "Entre un prix indicatif — sinon cette boisson ne peut pas \u00eatre r\u00e9partie \u00e9quitablement.",
    needAmountOrCancel: "Payer avec la cagnotte sans montant, ça ne va pas. Indique un montant, ou choisis Payé soi-même.",
    alreadyExists: (n: string) => `« ${n} » est déjà dans la liste.`,
    maxPerPerson: (n: number) => `Tu peux ajouter maximum ${n} boissons personnalisées.`,
    maxPerGroup: (n: number) => `Le groupe a atteint le maximum de ${n} boissons personnalisées.`,
    drinkInUse: (n: string) => `${n} a déjà été commandé et ne peut plus être supprimé.`,

    confirmTitle: "Confirmation",
    walkTable: "👥 Faire le tour",
    roundTogether: "Lancer une tourn\u00e9e",
    roundWalkSelf: "✍️ Prendre la tournée toi-même",
    youFetchTitle: "Tu vas chercher cette tourn\u00e9e",
    theyTap: "Ils cochent",
    theyTapRest: "sur leur t\u00e9l\u00e9phone.",
    youPay: "Tu paies",
    youPayRest: "au bar \u2014 r\u00e9gl\u00e9 apr\u00e8s.",
    lastRoundWas: (wat: string) => `Pr\u00e9c\u00e9dente\u00a0: ${wat}`,
    sameAgainShort: "\u21bb la m\u00eame",
    notMeShort: "Pas moi",
    iFetchShort: "J'y vais \u2192",
    fetchStep1: "Tout le monde reçoit l’info maintenant",
    fetchStep2: "Chacun coche sur son propre gsm ce qu’il veut",
    fetchStep3: "Tu reçois la liste pour le bar dès qu’ils ont fini",
    fetchStep4: "Tu paies au bar — tu avances donc l'argent",
    yesIFetch: "Oui, j’y vais →",
    ratherNot: "Finalement non",
    someoneFetches: (naam: string) => `${naam} va chercher les boissons`,
    gFetchStep1: "Coche ce que tu veux boire",
    gFetchStep2: "Chacun coche sur son propre gsm",
    gFetchStep3: (naam: string) => `${naam} reçoit la liste pour le bar`,
    letsChoose: "C’est parti →",
    orderingOpen: "Les commandes sont ouvertes",
    roundBusyX: (naam: string) => `Tournée en cours — ${naam} y va`,
    someChose: (n: number, t: number) => `${n} sur ${t} pers. sont prêts`,
    chosenCount: (n: number) => `${n} boisson${n === 1 ? "" : "s"} choisie${n === 1 ? "" : "s"}`,
    imDoneBtn: "✓ Confirmer mon choix",
    youAreDone: (n: number) => `✓ Tu as fini — ${n} boisson${n === 1 ? "" : "s"}`,
    allChose: "Tout le monde a choisi",
    pickBelow: "👇 Choisis tes boissons",
    noRoundTitle: "Aucune tourn\u00e9e lanc\u00e9e",
    noRoundBody: "Lance-en une toi-m\u00eame ou attends que quelqu'un d'autre commence.",
    justLooking: "Je regarde encore un peu",
    extrasLine: "⚙️ Extras — gobelets, coins",
    oneCoinIs: "1 coin =",
    laterLooking: "Plus tard, je regarde encore",
    youAdvance: "Tu avances (ou via la cagnotte) — tout est réglé ensuite dans l’appli",
    youWalkTitle: "Tu prends la tournée",
    walkStep1: "Tu fais le tour de la table, personne par personne",
    walkStep2: "Tu coches toutes les boissons toi-même",
    walkStep3: "Ensuite tu reçois la liste pour le bar",
    yesIWalk: "Oui, je prends →",
    potInPot: "💰 Dans la cagnotte",
    peopleInGroup: "Nombre de personnes dans le groupe",
    putInPot: (b: string) => `a mis ${b} dans la cagnotte`,
    notRightBtn: "Pas correct",
    removeJoinerQ: (n: string) => `Retirer ${n}\u00a0? Sa place dispara\u00eet et sa mise dans la cagnotte est annul\u00e9e.`,
    waitTitle: "Tu es dans le groupe — un instant",
    waitForHost: (naam: string) => `Dès que ${naam || "l’hôte"} ouvre les commandes, on peut commencer.`,
    openStep1: "À partir de maintenant on peut commander",
    openStep2: "Celui qui y va le signale au-dessus des boissons",
    openStep3: "Ensuite chacun coche ce qu’il veut",
    okWord: "Compris",
    okKort: "ok",
    stillBusy: "en cours…",
    toTheBar: "🍻 Au bar",
    youTapFor: "Tu coches pour :",
    youWord: "toi",
    nowTappingFor: (naam: string) => `Tu coches maintenant pour ${naam}`,
    tapForQrGuest: (naam: string) => `${naam} est arrivé via le QR et coche normalement lui-même sur son gsm.\n\nTu veux quand même cocher pour ${naam} ? À faire seulement si c’est vraiment nécessaire — batterie vide, par exemple.`,
    tapForQrYes: "Oui, je coche pour lui",
    qrTapsSelf: "📱 coche lui-même sur son gsm — tu n’as rien à faire.",
    nothingForMe: "rien ce tour-ci",
    nothingForMeBtn: "— Rien pour moi",
    youTakeNothing: "Tu ne prends rien ce tour-ci.",
    chooseAnyway: "choisir quand même",
    remindBtn: "🔔 Rappeler ceux qui n’ont pas choisi",
    remindTitle: "🔔 Donner un petit coup de pouce ?",
    remindBody: (namen: string) => `${namen} n’${namen.includes(",") ? "ont" : "a"} encore rien choisi. Un message apparaît aussitôt sur leur écran.`,
    remindYes: "Oui, envoie →",
    reminderSentTo: (namen: string) => `✓ Rappel envoyé à ${namen}.`,
    everyoneChoseAlready: "Tout le monde a déjà choisi — tu peux y aller.",
    allChoseTitle: "Tout le monde a choisi",
    allChoseYou: "Tu peux y aller. Voici ce qu’il te faut :",
    allChoseGuest: (naam: string) => `${naam || "Celui qui y va"} peut partir — ta boisson arrive.`,
    toTheBarBtn: "🍻 Direction le bar →",
    cancelRoundBtn: "✕ Annuler la tournée",
    cancelRoundTitle: "Annuler cette tournée ?",
    cancelRoundBody: "Tout ce qui est déjà coché disparaît, aussi chez les autres. C’est définitif.",
    cancelRoundYes: "Oui, annuler",
    cancelRoundDone: "La tournée est annulée.",
    cancelRoundFailed: "Échec de l’annulation.",
    roundCancelled: (naam: string) => `${naam || "Celui qui y allait"} a annulé la tournée. Tout est effacé.`,
    reminderFailed: "Envoi du rappel échoué.",
    reminderTitle: "⏰ Ton choix, vite",
    reminderBody: (naam: string) => `${naam} est prêt à aller chercher les boissons. Coche ce que tu veux — ou dis que tu ne prends rien.`,
    reminderChoose: "Je choisis →",
    everyoneTapsOwn: "chacun coche sur son propre t\u00e9l\u00e9phone",
    walkDone: "✓ Terminé",
    walkFor: (n: string) => `Que veut ${n} ?`,
    claimSeatFirst: "Prends d'abord une place avant de lancer une tournée.",
    modeTitle: "Partage le QR",
    modeTitleSub2: "Paie équitablement selon ce qu’il ou elle a bu",
    modeQuick: "Je commande pour le groupe",
    modeQuickSub: "Tu coches toutes les boissons toi-même.",
    orWord: "ou",
    modeFairSub: "Chacun scanne le QR sur son téléphone",
    modeFairSub2: "Coche ce qu’il ou elle boit",
    modeFairLine: "Payer équitablement selon ce que tu as bu",
    modeSwitchLater: "Si tu notes en vitesse, tu peux encore r\u00e9partir \u00e9quitablement \u00e0 la fin.",
    chooseHow: "Choisissez comment commander",
    atRestaurantQ: "Partager l\u2019addition au restaurant\u00a0?",
    seeWhatRestoDoes: "D\u00e9couvre Rundo Resto",
    restoTagline: "Scanne l'addition, partage en groupe",
    restoStep1: "scanne l'addition",
    restoStep2: "partage le QR",
    restoStep3: "coche ce que tu as pris",
    restoStep4: "partag\u00e9 \u00e9quitablement\u00a0!",
    tryItBtn: "Essaie-le",
    youNoteSelf: "Note toi-même",
    youNote1: "Tu coches toutes les boissons",
    youNote2: "Liste pratique pour le bar",
    youNote3: "Vite ou équitable — à toi de choisir",
    modeSnelTitle: "Je note moi-m\u00eame",
    modeNaamTitle: "Je note pour le groupe",
    modeNaamShort: "Je note pour tous",
    tagline: "Prendre les tournées et partager sans tracas",
    showToFriend: "📱 QR-code du groupe",
    shareWithMore: "Partage-le avec qui veut encore se joindre",
    seatsFullGuest: "Toutes les places sont prises — l’hôte peut en ajouter une.",
    youBadge: "TOI",
    orderWord: "Commande",
    howManyPeople: "Vous \u00eates combien ?",
    people: "pers.",
    headcountForward: "Valable \u00e0 partir de la prochaine tourn\u00e9e. Les tourn\u00e9es pr\u00e9c\u00e9dentes gardent leur nombre \u2014 corrige-les au besoin dans l\u2019aper\u00e7u.",
    headcountNotRetro: "Cela ne change pas les montants ci-dessous : chaque tourn\u00e9e garde le nombre du moment. Pour corriger une tourn\u00e9e pass\u00e9e, va dans l\u2019aper\u00e7u.",
    barList: "📋 Commande",
    tapToRename: "touche pour renommer",
    removeWord: "Retirer",
    barHandOut: "Distribuer",
    paidForRoundQ: (n: number) => `Pay\u00e9 pour la tourn\u00e9e ${n} ?`,
    potTopUpPlus: "+ remplir le pot",
    withHowManyQ: "\u00c0 combien \u00e9tiez-vous pour cette tourn\u00e9e ?",
    orderedLabel: "Command\u00e9",
    barlistBtn: "liste bar pratique",
    potClamped: (b: string) => `La cagnotte n'a pu couvrir que ${b} — le reste de la tournée compte hors cagnotte.`,
    thanksClosed: "🍻 Merci et à la prochaine ! Ta soirée reste dans Groupes enregistrés.",
    cancelledBy: (naam: string) => `✕ ${naam} a annulé la tournée.`,
    runnerDoneBtn: "🍻 Clôturer la tournée et aller la chercher",
    runnerDoneNote: (naam: string) => `✓ Commande confirmée — ${naam} va la chercher. Santé !`,
    haalTitel: "✓ Commande confirmée",
    haalSub: "C'est toi qui vas la chercher — tout le monde est prévenu.",
    haalKlaar: "✓ Ramené",
    runnerCloseFailed: "Échec de la clôture.",
    adminRoundOf: (naam: string) => `tournée de ${naam}`,
    fillPayBtn: "💶 Montant & paiement",
    tappedForYou: (naam: string) => `🍺 ${naam} coche des boissons pour toi — jette un œil à ta liste.`,
    editOrderPlain: "modifier la commande",
    barlistTitle: "Liste bar",
    barlistPieces: (n: number) => `${n} pi\u00e8ce${n === 1 ? "" : "s"}`,
    barlistAdjust: "Modifier",
    barlistDone: "Termin\u00e9",
    paidLabel: "Pay\u00e9",
    adjustWord: "Modifier",
    notSavedYet: "non enregistr\u00e9",
    saveWord: "Enregistrer",
    cardWord: "carte boissons",
    potTopUp: "Compl\u00e9ter la cagnotte",
    potEmptyFillFirst: "La cagnotte est vide \u2014 compl\u00e8te-la d\u2019abord pour payer avec.",
    editRoundHead: (n: number) => `Modifier la tourn\u00e9e ${n}`,
    paidWithQ: "Pay\u00e9 avec quoi ?",
    paidNote: (v: string) => `Pay\u00e9 ${v}`,
    noAmountNote: "Aucun montant indiqu\u00e9",
    noPotUsed: "sans cagnotte",
    paidFromPot: (v: string) => `${v} de la cagnotte`,
    skipCostWarn: "Tu as d\u00e9j\u00e0 rempli quelque chose pour cette tourn\u00e9e. Passer quand m\u00eame sans enregistrer ?",
    skipCostYes: "Oui, passer",
    finishRoundFirst: "Cl\u00f4ture d\u2019abord cette tourn\u00e9e — indique le montant ou appuie sur Passer.",
    payFirstOne: (nr: number) => `Indique d'abord le paiement de la tourn\u00e9e ${nr}, ou passe-le.`,
    payFirstMany: (n: number) => `Encore ${n} tourn\u00e9es sans montant. Indique-les, ou passe le paiement.`,
    paidSelf: "Sans cagnotte",
    paidSelfShort: "Sans cagnotte",
    paidPotShort: "De la cagnotte",
    whoPaidWhat: "qui a pay\u00e9 quoi",
    totalPaidShort: "Total pay\u00e9",
    potShare: "dont du pot",
    potSpentWord: "d\u00e9pens\u00e9",
    potLeftLong: "encore dans le pot",
    persPaidWord: "pay\u00e9 par les personnes",
    leaveSettleMsg: "Le r\u00e8glement est en cours — quand m\u00eame vers l'aper\u00e7u des tourn\u00e9es ? Ce que tu as d\u00e9j\u00e0 rempli reste enregistr\u00e9.",
    leaveSettleYes: "Oui, continuer",
    potShareAll: "enti\u00e8rement du pot",
    inRounds: (t: string) => `tourn\u00e9e ${t}`,
    mixSamen: (b: string) => `ensemble ${b}`,
    mixPotAvail: (b: string) => `${b} disponible`,
    mixPotShort: (b: string) => `mais ${b} dans le pot`,
    paidPot: "Avec cagnotte",
    potShortTitle: "Pas assez dans la cagnotte",
    potShortSimple: (inPot: string, kost: string) => `Il reste ${inPot} dans la cagnotte, cette tourn\u00e9e co\u00fbte ${kost}.`,
    tryPartHint: "Choisis \u00ab une partie \u00bb pour payer le reste toi-m\u00eame.",
    potWord: "cagnotte",
    skipPayment: "Passer le paiement",
    skipWord: "Passer",
    later: "Plus tard",
    back: "Retour",
    quickSettleTitle: "R\u00e9gler",
    fairSubtitle: "r\u00e9partition \u00e9quitable",
    quickTotalLabel: (n: number) => `Total de ${n} tourn\u00e9e${n === 1 ? "" : "s"}`,
    noAmountsYet: "Aucun montant encore saisi",
    roundsOnly: (n: number) => `${n} tourn\u00e9e${n === 1 ? "" : "s"}`,
    fairAskShort: "Partage \u00e9quitable\u00a0?",
    roundCancelledNote: (n: number) => `La tourn\u00e9e ${n} est annul\u00e9e. Tu peux recommencer tout de suite.`,
    fairNudge: "Attribue les boissons et saisis les montants.",
    fairNudgeBtn: "Compl\u00e9ter",
    quickTotalOf: (t: number) => `(sur ${t} au total)`,
    andWord: "et",
    roundsNoAmountNamed: (lijst: string) => `Tournée ${lijst} sans montant`,
    roundsNoAmountCount: (n: number) => `${n} tournées sans montant`,
    roundsNoAmountWhy: (n: number) => n === 1
      ? "Elle ne compte pas dans le partage ci-dessous. Complète-la ou laisse-la."
      : "Elles ne comptent pas dans le partage ci-dessous. Complète-les ou laisse-les.",
    roundsNoAmountFair: "Le partage \u00e9quitable suit qui a bu quoi — chaque tourn\u00e9e doit donc avoir un montant. Compl\u00e8te pour continuer.",
    fillAmountsBtn: "Compléter les montants ›",
    nothingToSplit: "Rien à répartir pour l'instant",
    nothingToSplitWhy: "Aucune tourn\u00e9e n'a de montant. Compl\u00e8te les montants ouverts — ensuite tu pourras partager \u00e0 parts \u00e9gales ou \u00e9quitablement.",
    noAmountBadge: "sans montant",
    addPaymentBang: "Ajouter le paiement !",
    addAmountBtn: "€ Ajouter le montant",
    splitEqually: "R\u00e9partir \u00e9galement",
    splitWithFair: "Partage \u00e9quitable",
    splitFairSub: "qui boit plus, paie plus",
    splitEqualSub: "la m\u00eame chose pour tous",
    fastest: "le plus rapide",
    fairest: "le plus juste",
    payersTitle: "Qui a payé ?",
    roundCount: (n: number) => `${n} ${n === 1 ? "tourn\u00e9e" : "tourn\u00e9es"}`,
    stillToAssign: (v: string) => `${v} \u00e0 attribuer`,
    whoPaidThisRound: "Qui a pay\u00e9 cette tourn\u00e9e\u00a0?",
    tapNameBelow: "Qui a pay\u00e9\u00a0? Coche un nom ci-dessous",
    fillAmountFirstShort: "Indique d'abord le montant",
    sameForAll: "Le même payeur pour toutes les tournées",
    toFinal: "Bilan final — partage \u00e9quitable",
    missingPayer: (n: number) => `Encore ${n} tournée${n === 1 ? "" : "s"} sans montant ou sans payeur`,
    potNotSplit: "La cagnotte est sur le groupe, pas encore sur des noms.",
    potSpreadEven: "Répartir également",
    potNewTotal: "Nouveau total dans la cagnotte",
    potOverMax: (nieuw: string, oud: string) => `Tu répartis ${nieuw} alors que ${oud} est allé dans la cagnotte. Enregistrer quand même ?`,
    potOverShort: (v: string) => `${v} de plus que dans la cagnotte`,
    saveAnyway: "Enregistrer quand même",
    backToSettle: "← Retour au décompte",
    stepOf: (n: number, t: number) => `étape ${n} sur ${t}`,
    backToAssign: "← Retour à l'attribution",
    backToPayers: "← Retour à qui a payé",
    backToNames: "← Retour aux noms",
    openAssign: "✏️ Attribuer les boissons",
    potShort: "Dans la cagnotte",
    splitEvenShort: (n: number) => `Également sur ${n}`,
    perPersonShort: "Par personne",
    toStep3: "Vers l'étape 3 · qui a payé →",
    potFree: (v: string) => `${v} libre`,
    potUsedFree: (g: string, v: string) => `${g} utilisé · ${v} libre`,
    potShared: (tot: string, n: number) => `Cagnotte ${tot} · répartie sur ${n}`,
    changeWord: "modifier",
    whoIsIn: "QUI PARTICIPE",
    inRoundNow: (n: number) => `Dans cette tourn\u00e9e · tourn\u00e9e ${n}`,
    confirmedOf: (a: number, b: number) => `${a} sur ${b} ont confirm\u00e9`,
    busyChoosing: "en train de choisir…",
    togetherDrinks: (n: number) => `${n} boisson${n === 1 ? "" : "s"} en tout`,
    remindInfo: "🔔 Un petit coup de pouce — ceux qui n’ont rien choisi reçoivent aussitôt un message. Pratique quand tu es prêt à partir.",
    showBig: "⛶ en grand",
    forTheBar: "POUR LE BAR",
    closeWord: "Fermer",
    togetherWord: "Total",
    newRoundBtn: "🍺 Nouvelle tournée",
    doneWithRound: "✓ Terminé pour cette tournée",
    cancelRoundShort: "✕ Annuler la tournée",
    provisionalStand: "Provisoire. Ce que tu paieras ou récupéreras dépend de qui a avancé et de la cagnotte — tout se règle au décompte.",
    nothingWord: "ne prend rien",
    totalOf: (v: string) => `${v} au total`,
    stillOpen: (v: string) => `${v} ouvert`,
    fairSplitExplain: "Tu pr\u00e9f\u00e8res payer selon ce que chacun a bu ? Attribue ici les boissons et les payeurs.",
    treatHint: "Tu offres une tourn\u00e9e ? Touche-la ci-dessous (elle ne compte pas dans le partage)",
    roundWord: "Tourn\u00e9e",
    drinksCount: (n: number) => `${n} boisson${n === 1 ? "" : "s"}`,
    stillEmpty: "encore vide",
    someHaveDrinks: (n: number, tot: number) => `${n} sur ${tot} ont d\u00e9j\u00e0 quelque chose`,
    confirmRoundTitle: (n: number) => `\u2705 Confirmer la tourn\u00e9e ${n}`,
    confirmRoundBtn: (n: number) => `\u2705 Confirmer la tourn\u00e9e (${n} boisson${n === 1 ? "" : "s"})`,
    roundConfirmed: (nr: number, n: number) => `Tourn\u00e9e ${nr} confirm\u00e9e \u00b7 ${n} boisson${n === 1 ? "" : "s"}`,
    notAssignedYet: (n: number) => `${n} boisson${n === 1 ? "" : "s"} pas encore attribu\u00e9e${n === 1 ? "" : "s"}.`,
    yourTreat: "ta tourn\u00e9e offerte",
    eachPaysNote: "Chacun paie",
    headcountVaried: "Toutes les tourn\u00e9es n\u2019avaient pas le m\u00eame nombre de personnes :",
    splitOver: "R\u00e9partir sur",
    showPerRound: "Plut\u00f4t r\u00e9partir par tourn\u00e9e",
    treatShort: "Offrir une tourn\u00e9e ?",
    backToOneAmount: "\u2190 Retour \u00e0 un seul montant",
    perRoundTitle: "R\u00e9parti par tourn\u00e9e",
    plusTreat: (v: string) => `Tu offres ${v} en plus`,
    payAllNote: "Toute l\u2019addition est pour toi :",
    notFairSplitWhy: "Tout le monde paie pareil, m\u00eame ceux qui ont moins bu. Tu veux que ceux qui ont plus bu paient plus ? Passe au partage \u00e9quitable.",
    switchToFairBtn: "Vers le partage \u00e9quitable",
    fairHintLine: "l'app r\u00e9partit \u00e9quitablement sur cette base — qui boit plus, paie plus",
    fairSetupTitle: "⚖️ Qui \u00e9tait l\u00e0 ?",
    guestNamePh: "nom facultatif",
    fairAddPerson: "+ Ajouter une personne",
    fairSetupDone: "Vers l'attribution des boissons →",
    roundsOverviewTitle: "🧾 Aper\u00e7u des tourn\u00e9es",
    peopleInRound: "personnes dans cette tourn\u00e9e",
    showDetails: "Voir les détails",
    hideDetails: "Masquer les détails",
    editRoundBtn: "Modifier",
    roundsOverviewBtn: "Aper\u00e7u",
    noRoundsYet: "Aucune commande termin\u00e9e. Confirme d'abord une tourn\u00e9e.",
    roundSummary: (n: number, items: number) => `Tourn\u00e9e ${n} \u00b7 ${items} boisson${items === 1 ? "" : "s"}`,
    estimate: "estimation sur prix indicatifs",
    estimateWhy: "Personne n'a entré de montants, donc on calcule avec les prix indicatifs de la liste. Approximatif, mais équitable.",
    voiceBtn: "🎤 Dicter",
    voiceBeta: "bêta",
    voiceListening: "🎤 J'écoute…",
    voiceSay: "Dis par exemple « 2 cola zero ». Fonctionne mieux par boisson.",
    voiceHeard: "Compris",
    voiceNothing: "Rien reconnu. Réessaie, ou touche simplement les boissons.",
    voiceAdd: "Ajouter à la tournée",
    voiceRetry: "🎤 Réessayer",
    voiceUnsupported: "La dictée ne fonctionne pas dans ce navigateur. Essaie Chrome.",
    voiceDenied: "Pas d'accès au micro.",
  },
} as const

export default function PartyTest() {
  const [lang] = useLang()
  const L = T[(lang === "fr" ? "fr" : "nl") as "nl" | "fr"]
  const [view, setView] = useState<"start" | "setup" | "settings" | "order" | "confirmed" | "hub" | "final" | "quickSettle" | "fairSetup" | "roundsOverview" | "payers">("start")
  const [pay, setPay] = useState<"eur" | "coin">("eur")
  const [coinValue, setCoinValue] = useState(3.9)
  const [depositOn, setDepositOn] = useState(false)
  const [depositValue, setDepositValue] = useState(1)
  const [depositUnit, setDepositUnit] = useState<"eur" | "coin">("eur")
  const [showPot, setShowPot] = useState(false)
  // De volledige barlijst van de avond, schermvullend — leesbaar aan de toog.
  const [showBarlijst, setShowBarlijst] = useState(false)
  // Gevuld = de barlijst hoort bij een net bevestigd rondje: geen sluitknop, maar
  // "Aanpassen" of "Klaar". Leeg = de gewone barlijst uit de hub.
  const [barNaRondje, setBarNaRondje] = useState<Record<string, number> | null>(null)
  const [showCoins, setShowCoins] = useState(false)
  const [coinInfo, setCoinInfo] = useState(false)
  const [depositInfo, setDepositInfo] = useState(false)

  const [groupName, setGroupName] = useState("")
  const groepNaamVeld = useRef<HTMLInputElement | null>(null)
  // Kies je "nieuwe met eigen naam", dan vraagt dit venster om die naam. Het keuzescherm
  // heeft zelf geen naamveld — daar duik je normaal meteen in de drankjes.
  const [naamPrompt, setNaamPrompt] = useState<boolean | null>(null)
  // Verplichte naam in snel opnemen: de eerste tik houdt halt tot er een naam staat.
  const [naamPlicht, setNaamPlicht] = useState(false)
  // Bewerkstand in het toewijzen-venster: naamknoppen worden even invulveldjes.
  const [assignNaamEdit, setAssignNaamEdit] = useState(false)
  // Het personenaantal per rondje staat ingeklapt: één grijs regeltje met "wijzig",
  // want meestal klopt het gewoon. Wie het opent, krijgt de vertrouwde teller.
  const [persOpen, setPersOpen] = useState(false)
  // Personen tellen is optioneel: zolang dit uit staat toont het venster "—".
  const [persGeteld, setPersGeteld] = useState(false)
  const [perPersoon, setPerPersoon] = useState(false)
  // Naam van de actieve pil ter plekke aanpassen, zonder het drankjesscherm te verlaten.
  const [pilNaamId, setPilNaamId] = useState<string | null>(null)
  const [pilNaamVeld, setPilNaamVeld] = useState("")
  // Kwam je binnen via "betaling toevoegen"? Dan springt het bedragveld naar voren.
  const [bedragFocus, setBedragFocus] = useState(false)
  // "Liever per persoon aantikken" opent eerst dit venster: met hoeveel zijn jullie,
  // en optioneel de namen. Daarna start de doorloop per persoon.
  const [naamPlichtNa, setNaamPlichtNa] = useState<null | (() => void)>(null)
  // Alleen-personen-stand: hetzelfde venster, maar zonder het groepsnaamveld.
  const [alleenPers, setAlleenPers] = useState(false)
  // Stand bij het openen van het personenvenster, zodat "Annuleren" alles terugzet.
  const [persSnap, setPersSnap] = useState<{ id: string; name: string }[] | null>(null)
  const [verlaatNaam, setVerlaatNaam] = useState<null | (() => void)>(null)
  const [verlaatVeld, setVerlaatVeld] = useState("")
  // Afsluiten kan alleen met een naam: anders is de groep straks onvindbaar.
  const [sluitNaam, setSluitNaam] = useState(false)
  const [sluitNaamVeld, setSluitNaamVeld] = useState("")
  // Aanvulkaart na een afgerond rondje: bedrag, betaler en toewijzing. Alles mag
  // overgeslagen worden — turven blijft turven.
  const [aanvulIdx, setAanvulIdx] = useState<number | null>(null)
  const [aanvulBedrag, setAanvulBedrag] = useState("")
  const [aanvulBetaler, setAanvulBetaler] = useState<string | null>(null)
  // Rechtstreeks binnengekomen? Dan is dit een Party-only pagina: geen verwijzing
  // naar het keuzescherm, enkel onderaan een tip over Table.
  const [viaKiezer, setViaKiezer] = useState(false)
  useEffect(() => { try { setViaKiezer(localStorage.getItem("rundo_via_kiezer") === "1") } catch { /* niets */ } }, [])
  // "Avond afgesloten" is iets anders dan "afgerekend": pas na het afsluiten gaat
  // de groepsnaam op slot. Tot dan mag alles nog aangepast worden, in elke modus.
  const [groepDicht, setGroepDicht] = useState(false)
  const [naamPlichtVeld, setNaamPlichtVeld] = useState("")
  // Datum van de groep, alleen voor de grijze haakjesweergave achter de naam.
  const [groepDatum, setGroepDatum] = useState<string | null>(null)
  const datumKort = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}` }
  const [gastNaam, setGastNaam] = useState("")
  const [geenRondje, setGeenRondje] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  // Naam zetten op een plaats die nog op een scan wacht.
  const [zitNaam, setZitNaam] = useState<{ id: string; nr: number } | null>(null)
  const [zitNaamTekst, setZitNaamTekst] = useState("")
  const [linkGekopieerd, setLinkGekopieerd] = useState(false)
  // Vroeg je de QR op terwijl de tafel vol zat, dan verscheen er niets — terwijl er
  // altijd iemand kan bijkomen. Deze vlag laat de kaart hoe dan ook zien; met het
  // tellertje erin zet je meteen een plaats bij.
  const [qrGevraagd, setQrGevraagd] = useState(false)
  const [people, setPeople] = useState<Person[]>([])

  // ── Supabase-laag ───────────────────────────────────────────────────────────
  const me = useRef(deviceId())
  const mounted = useRef(true)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [openRoundId, setOpenRoundId] = useState<string | null>(null)
  // Snelle rondjes: is het laatst bevestigde rondje al "afgehandeld" (kost ingevuld of
  // bewust overgeslagen)? Zolang niet, houden de tabs je even op dit scherm zodat je de
  // kans om het bedrag in te vullen niet mist.
  const [lastRoundHandled, setLastRoundHandled] = useState(true)
  // Snelle rondjes afrekenen: betaalt dit rondje uit eigen zak ("self") of uit de pot ("pot")?
  // "mix" = beide bronnen tegelijk: een deel zelf, een deel uit de pot — elk met een
  // eigen veld in zijn eigen kleur, zodat combineren niet meer via één gedeeld veld hoeft.
  const [payVia, setPayVia] = useState<"self" | "pot" | "mix">("self")
  const [, setMixZelf] = useState(0)
  const [mixPot, setMixPot] = useState(0)
  // Welk mix-veld je aan het invullen bent: het vinkje kleurt en pulseert mee —
  // potblauw bij het potveld, de moduskleur bij "zelf betaald".
  const [, setMixFocus] = useState<"zelf" | "pot">("zelf")
  // Tikte je op "Uit de pot" terwijl de pot leeg was, dan opent het inlegvenster. Dit
  // ref onthoudt voor welk rondje dat was: zodra er geld in de pot zit, schakelt de
  // potbron alsnog aan — anders bleef de knop na het inleggen gewoon uit staan.
  const potVulIntent = useRef<number | null>(null)
  // Het lijstje "wie betaalde wat" op de eindbalans: standaard dicht, één tik open.
  const [toonBetalers, setToonBetalers] = useState(false)
  // Pot-meldingen krijgen een potblauwe OK-knop; alle andere houden de themakleur.
  const [noticePot, setNoticePot] = useState(false)
  const meldPot = (tekst: string) => { setNoticePot(true); setNotice(tekst) }
  // Huidig aantal aanwezigen (snelle rondjes). Start op 0 = "nog niet gekozen": de
  // gebruiker moet het bewust instellen (naam én aantal verplicht). Elk afgesloten rondje
  // krijgt dit getal mee; wijzig je het later, dan geldt het vanaf het volgende rondje.
  const [headcount, setHeadcount] = useState(0)
  // Het potvenster begint bij het aantal mensen in de groep — aanpassen mag altijd.
  useEffect(() => {
    if (showPot && !settle && people.length > 0) setHeadcount((n) => (n > 1 ? n : people.length))
  }, [showPot]) // eslint-disable-line
  // Afreken-scherm snelle rondjes: verdelen over de groep, of alles op één iemand. En
  // welke rondjes getrakteerd zijn (tellen niet mee in de verdeling — komen op de tracteur).
  const [settleMode, setSettleMode] = useState<"verdelen" | "allesZelf">("verdelen")
  // Over hoeveel personen verdeelt het afrekenscherm? Leeg = het hoogste aantal dat in
  // een rondje voorkwam; de beheerder kan het bijstellen.
  const [splitPeople, setSplitPeople] = useState<number | null>(null)
  const [showPerRound, setShowPerRound] = useState(false)
  const [showTreat, setShowTreat] = useState(false)
  // Loopt de beheerder alle rondjes in één keer af, of wijst hij er één toe?
  const [assignAllMode, setAssignAllMode] = useState(false)
  // Kwam je bij het toewijzen via de Afrekenen-knop (uitgebreid opnemen)? Dan willen we
  // na "Klaar" meteen door naar het afrekenscherm in plaats van in de hub te blijven.
  const settleNaToewijzen = useRef(false)
  const [treatedRounds, setTreatedRounds] = useState<Set<string>>(new Set())
  // Kleine pop-up om het aantal personen aan te passen (vanaf het afreken-scherm van een rondje).
  const [showPeoplePop, setShowPeoplePop] = useState(false)
  // false = "gewoon rondjes" (geen geld). Eén app, het geld-gedeelte verborgen.
  const [settle, setSettle] = useState(true)
  type Custom = { key: string; name: string; cat: Cat; price: number; coins: number; cup: boolean; by: string }
  const [customDrinks, setCustomDrinks] = useState<Custom[]>([])
  // Afwijkende coin-prijzen voor dit feest. Ook jsonb op de groep-rij, dus gratis mee.
  const [coinPrices, setCoinPrices] = useState<Record<string, number>>({})
  const [showAddDrink, setShowAddDrink] = useState(false)
  const [ndName, setNdName] = useState("")
  const [ndPrice, setNdPrice] = useState("")
  const [inviteCode, setInviteCode] = useState<string>("")
  const [ownerDevice, setOwnerDevice] = useState<string>("")
  const [booting, setBooting] = useState(true)   // eerste laadbeurt (code uit de URL)
  const [busy, setBusy] = useState(false)        // groep aanmaken / plaats claimen
  // Opgeslagen groepen: alle groepen waar dit toestel bij hoort (zelf gemaakt of via
  // QR aan deelgenomen). Getoond op het startscherm zodat je kan terugkeren.
  type SavedGroup = { id: string; name: string; last_active: string; finalized: boolean; owned: boolean; settle: boolean; pinned: boolean; uitgebreid: boolean; fq: boolean }
  // Opruimbeleid. Een groep die een dag stilligt sluit zichzelf af; een afgesloten groep
  // verdwijnt na een maand, tenzij hij vastgezet is. Vastgezet blijft vastgezet — een pin
  // die na verloop van tijd toch wist, is geen pin maar uitstel. Wel suggereren we opruimen
  // wanneer de gebruiker er is, want een waarschuwing die niemand ziet beschermt niemand.
  const DAG = 86400000
  const AUTO_SLUIT = DAG
  const AUTO_WIS = 7 * DAG
  const PIN_STIL = 180 * DAG
  const MAX_PINS = 3
  // Één recente groep volstaat: de rest staat achter "toon alle groepen". Bij vijf werd
  // dat blok op een telefoon langer dan het keuzescherm zelf.
  const [groepZoek, setGroepZoek] = useState("")
  const [groepenOpen, setGroepenOpen] = useState(true)
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [groepFilter, setGroepFilter] = useState<"alle" | "open" | "af" | "pin">("alle")
  // Werkblad voor het verdelen van de pot over namen; null = niet in bewerkmodus.
  const [potNames, setPotNames] = useState<Record<string, number> | null>(null)
  // Bewerkblad voor de pot-inleg op de eindbalans van uitgebreid; null = dicht.
  const [potEdit, setPotEdit] = useState<Record<string, number> | null>(null)
  // Namenvenster bij het afrekenen: enkel de nog-onbenoemde gasten; null = dicht.
  const [naamVenster, setNaamVenster] = useState<Record<string, string> | null>(null)
  // Kaartje na "Avond afsluiten": bevestiging + delen; null-boolean is genoeg.
  const [afsluitKaart, setAfsluitKaart] = useState(false)
  // Het live-kanaal van de groep, ook bruikbaar om korte meldingen naar iedereen te
  // sturen (bv. "X annuleerde het rondje") — data-wijzigingen gaan via postgres_changes.
  const kanaalRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // De kanaal-closure leeft langer dan de state: dit ref geeft hem altijd het actuele meId.
  const meIdRef = useRef<string | null>(null)
  // Bedragvelden: zolang je typt houden we jouw tekst aan, ook halve invoer als "18,"
  // of "0,5". Zetten we elke toetsaanslag meteen om naar een getal, dan verdwijnt de
  // komma weer voor je het cijfer erna kan intikken en kan je enkel ronde bedragen.
  const [ruweBedragen, setRuweBedragen] = useState<Record<string, string>>({})
  const bedragVeld = (sleutel: string, waarde: number, zet: (v: number) => void) => ({
    value: ruweBedragen[sleutel] ?? (waarde > 0 ? String(waarde).replace(".", ",") : ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const tekst = e.target.value.replace(/[^0-9.,]/g, "")
      setRuweBedragen((c) => ({ ...c, [sleutel]: tekst }))
      zet(parseFloat(tekst.replace(",", ".")) || 0)
    },
    onBlur: () => setRuweBedragen((c) => { const n = { ...c }; delete n[sleutel]; return n }),
  })
  // Staat de koppel-kiezer open in de verrekening?
  // Staat de snelkoppeling "dezelfde betaler voor alles" open?
  const [showSameFor, setShowSameFor] = useState(false)

  const [stalePins, setStalePins] = useState<SavedGroup[]>([])
  const isAdmin = !!ownerDevice && ownerDevice === me.current
  // Mijn eigen plaats: die waarop dit toestel zit. Nodig zodra gasten hun eigen
  // drankjes aantikken (blok 3).
  const meId = people.find((p) => p.claimedBy === me.current)?.id ?? null
  // Herkent "Rondje 2 augustus" en "Tournée 2 août": de vorm die de app zelf verzint.
  const isAutoNaam = (naam: string) => /^(QR-rondje|Rondje|Tournée(?:\s+QR)?)\s+\d{1,2}\s+\p{L}+(\s+\d+)?(\s+\(\d+\))?$/u.test(naam.trim())

  const inviteLink = typeof window !== "undefined" && inviteCode
    ? `${window.location.origin}${window.location.pathname}?code=${inviteCode}` : ""
  // De vaste catalogus staat in de code (nul queries per gast). Eigen drankjes komen
  // uit de groep-rij, die we toch al ophalen — dus ook nul extra queries.
  const drinks: Drink[] = useMemo(() => [
    ...DEMO_DRINKS,
    ...customDrinks.map((c) => ({
      id: c.key, name: c.name, emoji: "⭐", cat: "Eigen" as Cat, price: Number(c.price),
      cup: !!c.cup, fav: true, coins: Number(c.coins), custom: true, by: c.by,
    })),
  ].map((d) => (coinPrices[d.id] !== undefined ? { ...d, coins: coinPrices[d.id] } : d)),
  [customDrinks, coinPrices])

  // Coin-prijs bijstellen. Debounced wegschrijven: de +/- knopjes gaan per 0,1, dus
  // wie doorklikt zou anders tien updates afvuren.
  const coinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setCoinPrice = (drinkId: string, coins: number) => {
    const next = { ...coinPrices, [drinkId]: Math.max(0, +coins.toFixed(1)) }
    setCoinPrices(next)
    if (coinTimer.current) clearTimeout(coinTimer.current)
    coinTimer.current = setTimeout(() => {
      if (!groupId) return
      supabase.from("party_groups").update({ coin_prices: next }).eq("id", groupId)
        .then(({ error }) => { if (error) setNotice("Coin-prijs opslaan mislukt: " + error.message) })
    }, 700)
  }
  const [potRounds, setPotRounds] = useState<{ id: string; seq: number; amounts: Record<string, number> }[]>([])
  const [potDraft, setPotDraft] = useState<Record<string, number>>({})
  // Snelle rondjes: bedrag dat IEDEREEN inlegt. Het totaal (potDraft.pot) = dit × aantal.
  const [potPerMan, setPotPerMan] = useState<number>(0)
  // Aantal inleggers dat de beheerder kiest vóór hij de pot invult (snelle rondjes).
  const [potPeopleDraft, setPotPeopleDraft] = useState(2)
  // Is de vraag "met hoeveel leggen jullie in?" beantwoord voor deze pot-sessie?
  const [potPeopleOk, setPotPeopleOk] = useState(false)
  // Koos de beheerder bewust voor "deels pot, deels zelf"? Dan tonen we die verdeling.
  const [potSplitOk, setPotSplitOk] = useState(false)
  // Net een inleg toegevoegd? Dan is "Klaar" de logische volgende stap, niet nóg een inleg.
  const [potJustAdded, setPotJustAdded] = useState(false)
  const [everyoneDraft, setEveryoneDraft] = useState<string>("")
  const [everyoneChoice, setEveryoneChoice] = useState<number | "custom" | null>(null)
  const [editPotId, setEditPotId] = useState<string | null>(null)
  const [potBuilderOpen, setPotBuilderOpen] = useState(false)
  const [potDetails, setPotDetails] = useState(false)
  const [restoInfo, setRestoInfo] = useState(false)
  // Wie aanschuift terwijl er al een pot is, staat daar nog niet in: de beheerder
  // vulde de bestaande plaatsen in, en deze plaats bestond toen nog niet. Eén keer
  // vragen of hij meedoet; daarna niet meer.
  const [potVraag, setPotVraag] = useState<null | { voorstel: number }>(null)
  const [potVraagBedrag, setPotVraagBedrag] = useState("")
  const [potVraagOpen, setPotVraagOpen] = useState(false)
  // Bij elke nieuwe inleg opnieuw vragen met hoeveel personen er ingelegd wordt — zo
  // weet elke inleg apart voor hoeveel mensen hij gold (nodig voor een latere Fair Split).
  // Telefoons houden de ingezoomde stand vast over paginawissels heen. Bij
  // binnenkomst zetten we de zoom heel even vast op 1 en geven de viewport
  // meteen weer vrij, zodat elke overgang op 100% begint.
  // Telefoons zoomen in op invoervelden en houden die stand vast, ook over
  // paginawissels heen — en Android Chrome geeft hem met een meta-wissel niet
  // terug. Daarom app-gedrag: de viewport staat permanent vast op schaal 1, dus
  // invoer-autozoom bestaat niet meer. iOS laat knijpzoomen bij een echt gebaar
  // gewoon toe (het negeert de limiet daarvoor), Android houdt alles strak op 100%.
  useEffect(() => {
    try {
      let m = document.querySelector('meta[name="viewport"]')
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "viewport"); document.head.appendChild(m) }
      m.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
      // De witte rand op mobiel kwam van de standaardmarge én de witte body-kleur
      // achter de pagina; en de pagina was net iets hoger dan het scherm (100vh telt
      // de adresbalk niet mee), waardoor je kon swipen zonder inhoud. Beide dicht.
      document.documentElement.style.margin = "0"
      document.body.style.margin = "0"
      document.body.style.background = "#fdf6e3"
      document.body.style.overscrollBehaviorY = "auto"
    } catch { /* niets */ }
  }, [])
  useEffect(() => {
    if (showPot) setPotJustAdded(false)
  }, [showPot])
  useEffect(() => {
    if (potBuilderOpen || showPot) { setPotPeopleOk(false); setPotPeopleDraft(headcount >= 1 ? headcount : 2) }
  }, [potBuilderOpen, showPot])  // eslint-disable-line react-hooks/exhaustive-deps
  // Welk afgerond rondje staat in bewerkmodus? Buiten die modus is het overzicht
  // gewoon leesbaar, zodat je niets per ongeluk verandert.
  const [editRoundId, setEditRoundId] = useState<string | null>(null)
  // Wijzigingen houden we eerst hier bij; pas op "Opslaan" gaan ze naar de rekening.
  // bron "mix" = deels zelf, deels uit de pot — potAmt is dan het potdeel; bij "pot"
  // volgt het potdeel gewoon het volledige bedrag, bij "self" is het nul.
  const [editDraft, setEditDraft] = useState<{ drinks: Record<string, number>; amount: number; headcount: number; bron: "self" | "pot" | "mix"; potAmt: number } | null>(null)
  const startEditRound = (r: Round) => {
    const d: Record<string, number> = {}
    drinksOf(r).forEach(({ d: dr, n }) => { d[dr.id] = n })
    const potNu = r.potPart || 0
    const totNu = r.amount || 0
    setEditDraft({ drinks: d, amount: totNu, headcount: Math.max(1, r.headcount || 1), bron: potNu > 0.005 ? (potNu >= totNu - 0.005 ? "pot" : "mix") : "self", potAmt: potNu })
    setEditRoundId(r.id)
  }
  const cancelEditRound = () => { setEditDraft(null); setEditRoundId(null) }
  // Alles in één keer wegschrijven: aantallen als verschil, bedrag, personen en bron.
  const saveEditRound = async (r: Round) => {
    if (!editDraft) { cancelEditRound(); return }
    // Uit de pot betalen zonder bedrag kan niet: er zou nul uit de pot gaan terwijl het
    // rondje wél als betaald geldt. Een bedrag wissen mag wél — dan valt het rondje
    // terug op "geen bedrag ingevuld", wat een geldige toestand is.
    if (editDraft.bron !== "self" && (editDraft.amount || 0) <= 0.005) { setNotice(L.needAmountOrCancel); return }
    const idx = rounds.indexOf(r)
    const huidig: Record<string, number> = {}
    drinksOf(r).forEach(({ d, n }) => { huidig[d.id] = n })
    Object.entries(editDraft.drinks).forEach(([did, n]) => {
      const delta = (n || 0) - (huidig[did] || 0)
      if (delta !== 0) rBumpAnon(idx, did, delta)
    })
    const beschikbaar = Math.max(0, potAvailFor(idx))
    // Pot te kort voor het nieuwe bedrag? Niet meer blokkeren: de pot dekt wat hij kan,
    // de rest telt als zelf betaald. Vroeger werd de hele wijziging stil geweigerd — het
    // veld sprong terug naar het oude bedrag en het totaal bovenaan bewoog niet mee.
    const potDeel = editDraft.bron === "pot" ? Math.min(editDraft.amount, beschikbaar)
      : editDraft.bron === "mix" ? Math.min(Math.max(0, editDraft.potAmt), editDraft.amount, beschikbaar) : 0
    const potTekort = editDraft.bron === "pot" ? editDraft.amount > beschikbaar + 0.005
      : editDraft.bron === "mix" ? editDraft.potAmt > beschikbaar + 0.005 : false
    // Heeft dit rondje al betalers (via het betalers-scherm van de Fair Split-overstap,
    // of uitgebreid opnemen)? Dan moet hun verdeling mee met het nieuwe bedrag. Vroeger
    // bleef `payers` op de oude bedragen staan: de eindbalans toonde "al betaald in
    // ronde x" met het vórige bedrag, en "krijgt terug" en de overschrijvingen rekenden
    // met geld dat niet meer bestond. Zelfde betalers, nieuw bedrag, gelijk herverdeeld
    // en het pot-aandeel geklemd — precies zoals het betalers-scherm zelf rekent.
    const betalers = Object.keys(r.payers || {}).filter((pid) => (r.payers[pid] || 0) > 0.005)
    if (betalers.length > 0) {
      // Niet via rRedistribute: die geeft de pot maar één déél (bedrag ÷ aantal),
      // terwijl "uit de pot" hier betekent dat de pot het rondje draagt zover hij
      // reikt. Daardoor kwam "besteed via pot" in de afrekening niet overeen met wat
      // je in het overzicht instelde. Nu: pot eerst (geklemd op wat er in zit), de
      // rest gelijk over de bestaande betalers.
      const restNaPot = Math.max(0, editDraft.amount - potDeel)
      const perBetaler = betalers.length ? restNaPot / betalers.length : 0
      setRounds((rs) => rs.map((rr, i) => i === idx
        ? { ...rr, amount: editDraft.amount, potPart: potDeel, payers: Object.fromEntries(betalers.map((pid) => [pid, perBetaler])) }
        : rr))
      setDirtyRound(idx)
    } else {
      if (Math.abs((r.amount || 0) - editDraft.amount) > 0.001) qSetAmount(idx, editDraft.amount)
      rSetPotAmt(idx, potDeel)
    }
    if (Math.max(1, r.headcount || 1) !== editDraft.headcount) await setRoundHeadcount(r.id, editDraft.headcount)
    if (potTekort) meldPot(L.potClamped(euro(beschikbaar)))
    cancelEditRound()
  }
  const [potIsCard, setPotIsCard] = useState(false)
  const [cardValue, setCardValue] = useState("")
  const [cardPayers, setCardPayers] = useState<string[]>([])
  const [beginPrompt, setBeginPrompt] = useState(false)
  const [potChosen, setPotChosen] = useState(false)
  const [bpSettle, setBpSettle] = useState<boolean | null>(null)
  // Welkomscherm met de Party-kaart: alleen bij een verse start, vóór de keuze
  // tussen zelf noteren en QR.
  const [welkom, setWelkom] = useState(true)
  // De uitleg staat los van de keuze: lezen zonder te kiezen, kiezen zonder te lezen.
  // Eén tegelijk open, anders wordt het keuzescherm meteen twee schermen lang.
  const [fromOnboarding, setFromOnboarding] = useState(false)
  const [onboardedOnce, setOnboardedOnce] = useState(false)
  // Als je een verse groep (nog geen rondjes) heropent, land je op de kaders om de modus
  // te (her)bevestigen. Deze id onthoudt WELKE bestaande groep we dan bijwerken, zodat
  // "Beginnen" niet een nieuwe groep maakt maar deze verse groep voortzet.
  const [resumeGroupId, setResumeGroupId] = useState<string | null>(null)
  const [onbPotActive, setOnbPotActive] = useState(false)

  const [roundNr, setRoundNr] = useState(1)
  const [activeCat, setActiveCat] = useState<Cat>("Bier")
  const [drinkSearch, setDrinkSearch] = useState("")
  const [guestTab, setGuestTab] = useState<"order" | "me" | "group">("order")
  // Dezelfde indeling voor de beheerder in Fair Split; "order" bestaat daar als eigen
  // weergave, dus die tab navigeert in plaats van te wisselen.
  // De haler mag tijdens zíjn rondje ook voor anderen aantikken ("doe mij ook eentje"
  // aan de toog). Gewone gasten blijven enkel zichzelf aantikken.
  const [halerVoor, setHalerVoor] = useState<string | null>(null)
  // Wie al een "X duidt drankjes voor je aan"-melding kreeg dit rondje — één keer volstaat.
  const gemeldVoor = useRef<Set<string>>(new Set())
  // "Rondje opnemen": de tafel rondgaan, persoon per persoon. walkIdx = wie er nu aan
  // de beurt is (index in people). null = het scherm is niet open.
  const [walkIdx, setWalkIdx] = useState<number | null>(null)
  // De haler van het OPEN rondje (person-id). Wie "ik ga halen" tikt, opent het
  // rondje en wordt dit. null = nog niemand ging halen.
  const [startedBy, setStartedBy] = useState<string | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [voiceText, setVoiceText] = useState("")
  const [voiceHits, setVoiceHits] = useState<{ id: string; name: string; qty: number }[]>([])
  const [coinCat, setCoinCat] = useState<Cat>("Bier")
  const [coinFull, setCoinFull] = useState(false)
  const [fullList, setFullList] = useState(false)
  // De groepsnaam is in de header zelf aanpasbaar — niet via een omweg naar de instellingen.
  const [editName, setEditName] = useState(false)
  // Kwam je via "Bedragen aanvullen"? Dan krijgen de lege rondjes een tint en een knop.
  // Anders blijft het overzicht rustig en volstaat een label.
  const [fillMode, setFillMode] = useState(false)
  // Tik op de Fair Split-tab: eerst uitleggen wat er gebeurt, dan pas overstappen.
  // Drie toestanden: nog niets gekozen (allebei opgelicht, verder niets in beeld),
  // gelijk verdelen, of Fair Split. Zonder die derde toestand zou "gelijk verdelen"
  // stilzwijgend de standaard zijn, en dat is precies de keuze die de gebruiker maakt.
  const [settleChoice, setSettleChoice] = useState<"equal" | "fair" | null>(null)
  // Kwam je vanuit de gelijke verdeling? Dan bieden we onderweg een weg terug.
  const [fromQuick, setFromQuick] = useState(false)
  // Waar je was bij een refresh. Een gast die per ongeluk ververst midden in een
  // rondje mag niet terug naar het keuzescherm; het keuzescherm zelf wist deze sleutel,
  // zodat je van daaruit wél altijd vers begint.
  useEffect(() => {
    // Wachten tot het opstarten klaar is. Anders draait dit effect bij de eerste render
    // — met view "start" en nog geen groep — en wist het de sleutel net voordat het
    // herstel hem kan lezen.
    if (typeof window === "undefined" || booting) return
    try {
      if (groupId && view !== "start") sessionStorage.setItem("rundo_party_session", JSON.stringify({ g: groupId, v: view, fq: fromQuick }))
      else sessionStorage.removeItem("rundo_party_session")
    } catch { /* sessionStorage niet beschikbaar */ }
  }, [groupId, view, fromQuick, booting])
  useEffect(() => { if (view !== "roundsOverview") setFillMode(false) }, [view])
  useEffect(() => { setHalerVoor(null); gemeldVoor.current = new Set() }, [openRoundId])
  useEffect(() => { meIdRef.current = meId }, [meId])

  // Terug op je telefoon sprong vanuit een groep meteen naar het keuzescherm — twee
  // niveaus in één tik, en de sessie was daar weg. Nu leggen we bij het openen van een
  // groep één geschiedenis-item neer: terug brengt je naar het startscherm van déze modus,
  // met je opgeslagen groepen. Nog eens terug gaat dan wel naar de keuzepagina.
  // goStart waarschuwt zelf wanneer er een rondje openstaat, dus dat blijft beschermd.
  // De luisteraar wordt één keer per groep opgehangen, maar goStart wordt bij elke render
  // opnieuw gemaakt. Zonder deze verwijzing zou terug een oude versie aanroepen — met de
  // schermnaam van het moment waarop je de groep opende, en dus de verkeerde waarschuwing.
  const terugActie = useRef<() => void>(() => {})
  useEffect(() => {
    if (typeof window === "undefined" || !groupId) return
    window.history.pushState({ rundo: "groep" }, "")
    const terug = () => {
      terugActie.current()
      // Meteen een nieuw item neerleggen: anders werkt terug maar één keer en verlaat de
      // volgende tik de app.
      window.history.pushState({ rundo: "groep" }, "")
    }
    window.addEventListener("popstate", terug)
    return () => window.removeEventListener("popstate", terug)
  }, [groupId])

  // Pijltjes bij de categorierij: ze tonen dat er links of rechts nog meer staat,
  // want een halve pil aan de rand leest als een afsnijfout en niet als een uitnodiging.
  const catScroll = useRef<HTMLDivElement | null>(null)
  // De kop "Rondje X" is het echte begin van dit scherm. Bij het kiezen van een
  // noteermodus schuiven we daarheen, zodat de drankjes meteen in beeld staan in
  // plaats van onder de vouw. Staat de kop al bovenaan, dan gebeurt er niets —
  // anders springt het scherm bij elke tik.
  const rondjeKop = useRef<HTMLDivElement | null>(null)
  // Zodra het eerste drankje van een rondje binnen is, heb je het keuzeblok niet meer
  // nodig: je bent aan het aantikken. Het scherm schuift dan door naar de categorieën
  // (samen) of naar de melding met de naam-instructie (per persoon), zodat de lijst
  // het scherm vult. Alles erboven blijft bereikbaar door omhoog te vegen.
  const catRij = useRef<HTMLDivElement | null>(null)
  const hintBlok = useRef<HTMLDivElement | null>(null)
  const telRij = useRef<HTMLDivElement | null>(null)
  const namenRij = useRef<HTMLDivElement | null>(null)
  const strookRij = useRef<HTMLDivElement | null>(null)
  const sprongGedaan = useRef(false)
  const modusVorig = useRef(perPersoon)
  const naarRondjeKop = (herkans = true) => {
    requestAnimationFrame(() => {
      const el = rondjeKop.current
      if (!el) { if (herkans) setTimeout(() => naarRondjeKop(false), 130); return }
      if (el.getBoundingClientRect().top <= 8) return
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }
  const naarLijst = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = perPersoon
        ? (telRij.current || namenRij.current || hintBlok.current || catRij.current)
        : (catRij.current || strookRij.current)
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }))
  }
  // Het pijltje aan de rand van de categorieën. Zonder teken weet niemand dat de rij
  // verder loopt; het wenkt daarom zachtjes naar de kant waar meer staat.
  const CatPijl = ({ kant }: { kant: "links" | "rechts" }) => {
    const rechts = kant === "rechts"
    return (
      <div onClick={() => catScroll.current?.scrollBy({ left: rechts ? 170 : -170, behavior: "smooth" })}
        style={{ position: "absolute", [rechts ? "right" : "left"]: 0, top: 0, bottom: 4, width: 42, display: "flex", alignItems: "center",
          justifyContent: rechts ? "flex-end" : "flex-start", cursor: "pointer",
          background: `linear-gradient(${rechts ? "90deg" : "270deg"}, rgba(253,246,227,0), ${themaTeal ? MODUS_FAIR.bladzij : themaNaam ? MODUS_NAAM.bladzij : "#fdf6e3"} 55%)` }}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: themaTeal ? MODUS_FAIR.vlak : themaNaam ? MODUS_NAAM.vlak : "#e8b84b",
          border: `2px solid ${themaTeal ? MODUS_FAIR.rand : themaNaam ? MODUS_NAAM.rand : "#1d2942"}`,
          color: themaTeal ? MODUS_FAIR.rand : themaNaam ? MODUS_NAAM.rand : "#1d2942",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, lineHeight: 1, paddingBottom: 2,
          boxShadow: "0 2px 8px -3px rgba(29,41,66,0.6)",
          animation: "rundoWenk 1.6s ease-in-out infinite" }}>{rechts ? "›" : "‹"}</span>
      </div>
    )
  }
  const [catMore, setCatMore] = useState({ left: false, right: false })
  const updateCatArrows = () => {
    const el = catScroll.current
    if (!el) return
    setCatMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  // Bij het openen van een bestelscherm meteen kijken of er rechts nog categorieën staan.
  useEffect(() => { updateCatArrows() }, [view, guestTab, activeCat])  // eslint-disable-line react-hooks/exhaustive-deps
  const [cart, setCart] = useState<Assign>({})
  const [cartAnon, setCartAnon] = useState<Anon>({})
  const [rounds, setRounds] = useState<Round[]>([])
  const [gaveBackDraft, setGaveBackDraft] = useState<Record<string, number>>({})
  const [displayUnit, setDisplayUnit] = useState<"eur" | "coin">("eur")
  const [showEqual, setShowEqual] = useState(true)
  const [openFairAll, setOpenFairAll] = useState(false)
  const [openFair, setOpenFair] = useState<Record<string, boolean>>({})
  const [openRound, setOpenRound] = useState<number | null>(null)
  const [allRoundsOpen, setAllRoundsOpen] = useState(false)
  const [repeated, setRepeated] = useState(false)
  const [hasSettled, setHasSettled] = useState(false)
  // Gewoon rondjes: het bedrag dat verdeeld wordt is de som van alle r.amount — één
  // bron van waarheid. In het aparte rondjesoverzicht kies je totaal of per rondje.
  const [costMode, setCostMode] = useState<"total" | "perRound">("total")
  // Niveau 1 (snel afrekenen): met hoeveel waren jullie? Totaal ÷ dit = ieders deel.
  const [quickHeads, setQuickHeads] = useState<string>("")
  // Rondjesoverzicht (scherm 2): welke rondjes staan open. Standaard alleen het laatste.
  const [openRounds, setOpenRounds] = useState<Set<string>>(new Set())
  // Elk bezoek aan het overzicht begint dicht — je opent zelf wat je wil zien.
  useEffect(() => { if (view === "roundsOverview") setOpenRounds(new Set<string>()) }, [view])
  // Onthoud vanwaar je naar het rondjesoverzicht ging, zodat "terug" daarheen keert.
  const [overviewBackTo, setOverviewBackTo] = useState<"hub" | "order" | "final" | "payers">("hub")
  const [laatstWeg, setLaatstWeg] = useState<{ did: string; pid: string | null; naam: string } | null>(null)
  useEffect(() => {
    if (!laatstWeg) return
    const t = setTimeout(() => setLaatstWeg(null), 6000)
    return () => clearTimeout(t)
  }, [laatstWeg])
  // Waar je vandaan kwam toen je de instellingen opende. De instellingen hebben geen
  // kopbalk met navigatie, dus zonder dit weet je er niet meer hoe je terugkeert.
  const [settingsBackTo, setSettingsBackTo] = useState<"quickSettle" | "order" | "hub">("hub")
  // Welke mode-kaart heeft zijn info-uitleg opengeklapt (via de i-knop).
  const [openInfo, setOpenInfo] = useState<"fair" | "quick" | null>(null)

  const [showAssignAll, setShowAssignAll] = useState(false)
  const [assignMode, setAssignMode] = useState<"drink" | "person">("person")
  const [showCups, setShowCups] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [cupsChecked, setCupsChecked] = useState(false)
  const [cupsTouched, setCupsTouched] = useState(false)
  const [amountDraft, setAmountDraft] = useState<string>("")
  const [payPot, setPayPot] = useState(false)
  const [payPersons, setPayPersons] = useState<string[]>([])
  const [payAmts, setPayAmts] = useState<Record<string, string>>({})
  const [potAmtDraft, setPotAmtDraft] = useState<string>("")
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [confirmDlg, setConfirmDlg] = useState<{ msg: string; yes: string; onYes: () => void; onNo?: () => void; no?: string; variant?: "danger" } | null>(null)
  // "Waar was je gebleven?" bij het naamloos starten van een modus waarin nog groepen
  // openstaan: een lijstje om verder te gaan, of gewoon een nieuwe groep beginnen.
  const [waarGebleven, setWaarGebleven] = useState<{ groepen: SavedGroup[]; wilSettle: boolean } | null>(null)
  const [notice, setNotice] = useState<string>("")
  // Slaapstand. De telefoon ligt bij een rondje vaak minutenlang open op tafel; zonder dit
  // blijft het realtime-kanaal die hele tijd verbinding en data verbruiken. Eén tik hervat.
  const [slaapt, setSlaapt] = useState(false)
  // Wacht dit scherm op gasten die nog moeten scannen? Dan niet in slaap vallen.
  const wachtOpScans = useRef(false)
  const laatsteActie = useRef<number>(Date.now())
  // Zachte melding wanneer iemand nieuw aansluit. Vervaagt vanzelf; alleen de admin
  // krijgt een knop om het terug te draaien (voor als een vreemde de link kreeg).
  const [newcomer, setNewcomer] = useState<{ id: string; name: string } | null>(null)
  // De melding dooft bij een gast pas na een paar seconden kíjken. Een gewone timer
  // loopt door op een slapend scherm; dan zou hij hem nooit gezien hebben.
  useEffect(() => {
    if (!newcomer || isAdmin) return
    let over = 5000
    let sinds = document.visibilityState === "visible" ? Date.now() : 0
    let t: ReturnType<typeof setTimeout> | null = null
    const start = () => { sinds = Date.now(); t = setTimeout(() => setNewcomer(null), over) }
    const pauze = () => { if (t) { clearTimeout(t); t = null; over -= Date.now() - sinds } }
    const wissel = () => { if (document.visibilityState === "visible") start(); else pauze() }
    if (sinds) start()
    document.addEventListener("visibilitychange", wissel)
    return () => { if (t) clearTimeout(t); document.removeEventListener("visibilitychange", wissel) }
  }, [newcomer, isAdmin])
  const knownPeople = useRef<Set<string>>(new Set())

  // edit-in-hub
  const [editOpen, setEditOpen] = useState(false)
  const [assignIdx, setAssignIdx] = useState<number | null>(null)
  const [editAssignMode, setEditAssignMode] = useState<"drink" | "person">("person")
  const [editCups, setEditCups] = useState(false)
  const [editPay, setEditPay] = useState(false)

  const priceOf = (d: Drink) => (pay === "coin" ? d.coins : d.price)
  const effDepositUnit: "eur" | "coin" = pay === "eur" ? "eur" : depositUnit
  const depositPerCupEur = effDepositUnit === "eur" ? depositValue : depositValue * coinValue
  const show = (eur: number) => (pay === "coin" && displayUnit === "coin" ? (eur / coinValue).toFixed(2).replace(".", ",") + " coins" : euro(eur))

  // Bij uitgebreid opnemen zegt het inlegvenster letterlijk "per man": een naamloos
  // bewaarde inleg (sleutel "pot") verdelen we daarom gelijk over de vaste gasten —
  // zo krijgt restgeld uit de pot bij het afrekenen gewoon zijn eigenaars terug.
  const contribOf = (pid: string) => potRounds.reduce((s, r) => {
    let a = r.amounts[pid] || 0
    if (opNaam === true && !settle && people.length > 0) {
      const anoniem = Object.entries(r.amounts).reduce((t, [k, v]) => t + (people.some((pp) => pp.id === k) ? 0 : (v || 0)), 0)
      a += anoniem / people.length
    }
    return s + a
  }, 0)
  const potContribTotal = potRounds.reduce((s, r) => s + Object.values(r.amounts).reduce((a, b) => a + (b || 0), 0), 0)
  const potDraftTotal = Object.values(potDraft).reduce((a, b) => a + (b || 0), 0)
  const potSpent = rounds.reduce((s, r) => s + (r.potPart || 0), 0)
  const potRemaining = potContribTotal - potSpent
  // Terwijl het betaalpaneel openstaat telt wat er richting de pot getypt is alvast
  // zichtbaar mee: de badge en de pot-knop tonen wat er ná deze betaling overblijft.
  // Pas bij "✓ ok" wordt het echt; wie het paneel verlaat, ziet de pot terugveren.
  const rOpenBetaal = rounds.length > 0 ? rounds[rounds.length - 1] : null
  const potInBewerking = rOpenBetaal && !lastRoundHandled && (rOpenBetaal.potPart || 0) <= 0.005
    ? (payVia === "pot" ? Math.min(rOpenBetaal.amount || 0, Math.max(0, potRemaining))
      : payVia === "mix" ? Math.min(Math.max(0, mixPot), Math.max(0, potRemaining)) : 0)
    : 0
  const potZicht = Math.max(0, potRemaining - potInBewerking)
  // Compacte "rest / ingelegd"-weergave voor de badges: het tweede getal zonder
  // centen als het rond is, gedempt grijs zodat het restbedrag de hoofdrol houdt.
  const potInlegKort = Number.isInteger(Math.round(potContribTotal * 100) / 100) && potContribTotal % 1 === 0
    ? `\u20ac${Math.round(potContribTotal)}`
    : euro(potContribTotal)
  const cardLossPer = potIsCard && potRemaining > 0.005 && people.length > 0 ? potRemaining / people.length : 0

  // ── live cart helpers ───────────────────────────────────────────────────────
  const aQty = (did: string, pid: string) => cart[did]?.[pid] ?? 0
  // Zorg dat er een open rondje bestaat vóór er een drankje in gaat. Lui aangemaakt:
  // pas wanneer iemand écht iets aantikt, niet bij het openen van het scherm.
  const openRoundRef = useRef<Promise<string | null> | null>(null)
  const addingPerson = useRef(false)
  const ensureRound = async (starter?: string | null): Promise<string | null> => {
    if (openRoundId) return openRoundId
    if (!groupId) return null
    if (openRoundRef.current) return openRoundRef.current   // twee snelle tikken = één rondje
    openRoundRef.current = (async () => {
      // party_open_round geeft het BESTAANDE open rondje terug als er al een is. Twee
      // gasten die tegelijk hun eerste drankje tikken, delen dus één rondje.
      const { data, error } = await supabase.rpc("party_open_round", { p_group: groupId, p_starter: starter ?? null })
      openRoundRef.current = null
      if (error || !data) { setNotice("Rondje starten mislukt."); return null }
      setOpenRoundId(data as string)
      if (starter) setStartedBy(starter)
      return data as string
    })()
    return openRoundRef.current
  }

  // "Ik ga halen": open het rondje met mezelf als haler. Iedereen die gescand heeft
  // ziet dan "X gaat halen" en kan zijn drankje aantikken.
  // Zet het antwoordveld open op het lópende rondje. Zonder dit weigert de databank
  // antwoorden, want die schrijft alleen wanneer "active" aanstaat.
  const openAntwoordveld = async (rid: string) => {
    if (!rid) return
    const { error } = await supabase.rpc("party_propose_repeat", { p_round: rid, p_by: meId ?? null })
    if (error) { /* niet erg: dan blijft "niets voor mij" gewoon uit */ }
  }
  const startAsRunner = async () => {
    if (!meId) { setNotice(L.claimSeatFirst); return }
    const rid = await ensureRound(meId)
    setStartedBy(meId)
    if (rid) await openAntwoordveld(rid)
  }

  // "Ik haal het toch": neem een lopend rondje over. Het rondje en alle drankjes
  // blijven staan, alleen de haler wisselt.
  const takeOverRound = async () => {
    if (!meId || !openRoundId) return
    setStartedBy(meId)
    const { error } = await supabase.rpc("party_take_over_round", { p_round: openRoundId, p_starter: meId })
    if (error) { setNotice("Overnemen mislukt: " + error.message); if (groupId) loadParty(groupId) }
  }

  // "Toch niet ik": geef het rondje vrij. Een ander kan het dan oppakken.
  const releaseRunner = async () => {
    if (!openRoundId) return
    setStartedBy(null)
    const { error } = await supabase.rpc("party_take_over_round", { p_round: openRoundId, p_starter: null })
    if (error) { setNotice("Vrijgeven mislukt: " + error.message); if (groupId) loadParty(groupId) }
  }

  const runnerName = () => people.find((p) => p.id === startedBy)?.name ?? ""

  // ── Rondje opnemen: de tafel rondgaan ───────────────────────────────────────
  // Persoon per persoon. Je tikt drankjes aan die METEEN op die persoon staan (bump),
  // geen omweg via toewijzen. Zo blijft de toewijzing die al in je hoofd zit ("Tom?
  // pils") ook in de app staan — en werkt Fair Split achteraf zonder extra werk.
  const walkStart = () => { setWalkIdx(people[0] ? 0 : null) }
  const [walkVol, setWalkVol] = useState(false)
  // Bevestigen vóór het starten: wie op "ik ga halen" tikt, zet daarmee de hele tafel in
  // beweging. Eén scherm met wat er gaat gebeuren, en een uitweg.
  const [startCheck, setStartCheck] = useState(false)
  const [walkCheck, setWalkCheck] = useState(false)
  const [naamWijzig, setNaamWijzig] = useState<string | null>(null)
  const [barFull, setBarFull] = useState(false)
  // Na "Rondje afronden en halen" is de mand leeg en het rondje pending — maar de haler
  // heeft zijn lijstje juist DAN nodig, aan de toog. Dus bewaren we het hier, tot hij
  // het zelf wegklikt of het volgende rondje start.
  const [haalInfo, setHaalInfo] = useState<{ items: { id: string; n: number; naam: string; emoji: string }[] } | null>(null)
  // De melding voor de anderen. We tonen ze één keer per rondje, aan iedereen behalve de
  // haler zelf — vandaar dat we onthouden welk rondje we al aankondigden.
  const [rondjeGemeld, setRondjeGemeld] = useState<string | null>(null)
  const [halerGemeld, setHalerGemeld] = useState<string | null>(null)
  const [allenKlaar, setAllenKlaar] = useState(false)
  const [allenGemeld, setAllenGemeld] = useState<string | null>(null)
  // De antwoorden op het lópende rondje: wie koos niets, en het merkje van een
  // herinnering. Staat hier bovenaan omdat de effecten eronder ernaar kijken.
  const [openAnswers, setOpenAnswers] = useState<Record<string, "same" | "different" | "skip">>({})
  // Hoeveel mensen maakten een keuze — een drankje óf "niets voor mij". Moet ná
  // openAnswers staan, want het leest dat.
  const ikHaalNu = !!meId && startedBy === meId
  // Klaar is niet hetzelfde als "heeft iets aangetikt": je bent klaar wanneer je dat
  // zelf zegt, of wanneer je liet weten dat je niets neemt.
  const isKlaar = (pid: string) => openAnswers[pid] === "same" || openAnswers[pid] === "skip"
  const alGekozen = people.filter((pp) => isKlaar(pp.id)).length
  // Staat het bestellen open? Dat is een fase, geen rondje: iedereen mag vanaf dan een
  // rondje starten, maar er loopt er nog geen.
  const [orderingOpen, setOrderingOpen] = useState(false)

  // Deze twee effecten stonden hoger in het bestand, vóór de toestand die ze aflezen.
  // JavaScript staat dat niet toe voor const-verklaringen, dus ze staan nu hier.
  //
  // Kwam er een duwtje binnen terwijl jij nog niets koos? Dan één keer tonen.
  useEffect(() => {
    if (!openRoundId || !meId) return
    const merk = Object.keys(openAnswers).find((k) => k.startsWith("poke:"))
    if (!merk) return
    if (herinneringGezien === merk) return
    setHerinneringGezien(merk)
    const ikKoos = drinks.some((d) => (cart[d.id]?.[meId] ?? 0) > 0) || openAnswers[meId] === "skip"
    if (settle && !ikKoos && startedBy !== meId) setHerinnering(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAnswers, openRoundId, meId])

  // En zodra er een rondje opengaat dat iemand ánders startte, krijg je de melding één
  // keer te zien. We onthouden welk rondje al aangekondigd is, anders komt ze bij elke
  // verversing terug.
  // Ging het bestellen net open? Één melding, voor iedereen behalve wie het zelf deed.
  useEffect(() => {
    if (!orderingOpen || !meId || !groupId) return
    if (rondjeGemeld === `open:${groupId}`) return
    setRondjeGemeld(`open:${groupId}`)
    if (isAdmin) return
    setRondjeMelding("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderingOpen, meId, groupId])

  // Verdween er een rondje dat je aan het invullen was? Dan heeft iemand geannuleerd.
  // We onthouden het laatste open rondje en zijn haler, want die gegevens zijn weg zodra
  // het rondje verdwijnt.
  const vorigOpen = useRef<{ id: string; door: string } | null>(null)
  const netAfgesloten = useRef(false)
  useEffect(() => {
    if (openRoundId) { vorigOpen.current = { id: openRoundId, door: runnerName() }; return }
    const weg = vorigOpen.current
    vorigOpen.current = null
    // Afgesloten rondjes blijven in de lijst staan; alleen een echt gewist rondje is
    // geannuleerd. En wie zelf net afsloot, krijgt sowieso geen melding.
    if (netAfgesloten.current) { netAfgesloten.current = false; return }
    if (!settle) return
    if (weg && meId && rounds.every((r) => r.id !== weg.id)) {
      // De lokale lijst loopt achter op de databank: net-afgeronde (pending) rondjes
      // staan er nog niet in. Eerst nakijken of het rondje echt gewist is — anders
      // meldde dit scherm "geannuleerd" terwijl de haler gewoon onderweg is.
      void (async () => {
        const { data } = await supabase.from("party_rounds").select("id").eq("id", weg.id).maybeSingle()
        if (!data) setNotice(L.roundCancelled(weg.door))
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRoundId])

  // Koos iedereen? Dan één keer een venster — voor de haler het sein om te vertrekken,
  // voor de rest dat hun drankje eraan komt.
  useEffect(() => {
    if (!settle) return
    if (!openRoundId || !meId || people.length === 0) return
    if (allenGemeld === openRoundId) return
    if (alGekozen < people.length) return
    setAllenGemeld(openRoundId)
    setAllenKlaar(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alGekozen, openRoundId, meId, people.length])

  // En zodra iemand zegt dat hij gaat halen, weet de rest wie.
  useEffect(() => {
    if (!settle) return
    if (!openRoundId || !meId || !startedBy || startedBy === meId) return
    if (halerGemeld === openRoundId) return
    setHalerGemeld(openRoundId)
    const haler = people.find((p) => p.id === startedBy)
    if (haler) setRondjeMelding(haler.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRoundId, startedBy, meId])
  const [rondjeMelding, setRondjeMelding] = useState<string | null>(null)
  const [openMelding, setOpenMelding] = useState(false)
  const wasOpen = useRef<boolean | null>(null)
  // Sloeg de gastheer het bestellen open? Dat is iets anders dan een rondje starten:
  // dit gebeurt één keer per avond, vlak na de QR.
  useEffect(() => {
    const eerder = wasOpen.current
    wasOpen.current = orderingOpen
    if (settle && eerder === false && orderingOpen && meId && !isAdmin) setOpenMelding(true)
  }, [orderingOpen, meId, isAdmin])
  useEffect(() => {
    if (!openMelding) return
    const t = setTimeout(() => setOpenMelding(false), 4000)
    return () => clearTimeout(t)
  }, [openMelding])
  const renderWalk = () => {
    if (walkIdx === null) return null
    const p = people[walkIdx]
    if (!p) { setWalkIdx(null); return null }
    const zijne = drinks.filter((d) => (cart[d.id]?.[p.id] ?? 0) > 0)
    // Zelfde opbouw als het bestelscherm: categorieën bovenaan, en de volledige lijst
    // achter "toon alles". Vroeger zag je hier enkel de favorieten, dus een gast die iets
    // anders wou moest je afwimpelen of het achteraf toevoegen.
    const walkZoekt = normText(drinkSearch).length > 0
    const walkCat = walkZoekt ? drinks.filter((d) => drinkMatches(d.name, drinkSearch)) : drinks.filter((d) => d.cat === activeCat)
    const lijst = walkZoekt ? walkCat : walkCat.filter((d) => walkVol || d.fav || (cart[d.id]?.[p.id] ?? 0) > 0)
    // Hoeveel elke persoon al aantikte in dit rondje (voor de teller op de pill).
    const aantalVan = (pid: string) => drinks.reduce((a, d) => a + (cart[d.id]?.[pid] ?? 0), 0)
    return (
      <div style={S.overlay} onClick={() => setWalkIdx(null)}>
        <div style={{ ...S.sheet, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ ...S.h3, margin: 0, fontSize: 21.5 }}>{L.walkTable}</h3>
            <span onClick={() => setWalkIdx(null)} style={{ fontSize: 21, cursor: "pointer", color: "#6b7484", lineHeight: 1 }}>✕</span>
          </div>

          {/* Namen als pills. Tik een naam aan om voor die persoon te bestellen. De
              groene teller toont wat elk al heeft — zo zie je wie je nog moet vragen. */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {people.map((pp, i) => {
              const geselecteerd = i === walkIdx
              const n = aantalVan(pp.id)
              return (
                <button key={pp.id} onClick={() => setWalkIdx(i)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 20, cursor: "pointer",
                    fontSize: 17, fontWeight: 800,
                    background: geselecteerd ? "#e08a00" : VLAK1,
                    color: geselecteerd ? "#fff" : "#1d2942",
                    border: geselecteerd ? "2px solid #e08a00" : "1.5px solid rgba(29,41,66,0.18)" }}>
                  {pp.id === meId ? "⭐ " : ""}{pp.name}
                  {n > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, borderRadius: 9, fontSize: 14.5, background: geselecteerd ? "rgba(255,255,255,0.3)" : "#1f8a4c", color: "#fff" }}>{n}</span>}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 16, color: "#6b7484", marginBottom: 10, fontWeight: 700 }}>{L.walkFor(p.name)}</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
            {catsPresent.map((c) => (
              <span key={c} style={{ ...S.tab(activeCat === c && !walkZoekt), flexShrink: 0 }} onClick={() => { setActiveCat(c); setDrinkSearch("") }}>{CAT_LABEL[c]}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
            {lijst.map((d) => {
              const n = cart[d.id]?.[p.id] ?? 0
              return (
                <button key={d.id} onClick={() => bump(d.id, p.id, 1)}
                  style={{ position: "relative", textAlign: "left", padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                    background: n > 0 ? "rgba(31,138,76,0.1)" : VLAK1,
                    border: n > 0 ? "1.5px solid rgba(31,138,76,0.4)" : "1px solid rgba(29,41,66,0.12)" }}>
                  <span style={{ fontSize: 17.5, fontWeight: 700, color: "#1d2942" }}>{d.emoji} {d.name}</span>
                  {n > 0 && (
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...S.pill, background: "#1f8a4c", color: "#fff", fontSize: 15.5, padding: "2px 8px" }}>{n}</span>
                      <span onClick={(e) => { e.stopPropagation(); bump(d.id, p.id, -1) }}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 18, fontWeight: 800 }}>−</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {/* Meer/minder als zwevende pill, net als op het bestelscherm — geen losse
              knoppenrij meer. "Eigen drankje?" staat eronder. */}
          {!walkZoekt && walkCat.length > lijst.length && (
            <div style={{ textAlign: "center", marginTop: -9, marginBottom: 12 }}>
              <span onClick={() => setWalkVol(true)}
                style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 15, fontWeight: 800, cursor: "pointer", background: RAND, border: "none", color: "#8a5e0f" }}>
                + {walkCat.length - lijst.length} meer ▾
              </span>
            </div>
          )}
          {!walkZoekt && walkVol && (
            <div style={{ textAlign: "center", marginTop: -9, marginBottom: 12 }}>
              <span onClick={() => setWalkVol(false)}
                style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 15, fontWeight: 800, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST }}>
                ▴ {L.shortListBtn.replace("🔼 ", "")}
              </span>
            </div>
          )}
          <button onClick={() => setShowAddDrink(true)}
            style={{ ...S.btn, width: "100%", fontSize: 15.5, fontWeight: 800, padding: "10px 6px", marginBottom: 12 }}>{L.newDrinkTile}</button>
          {zijne.length > 0 && (
            <div style={{ fontSize: 15.5, color: "#4a5567", marginBottom: 12, lineHeight: 1.5 }}>
              {zijne.map((d) => `${cart[d.id][p.id]}× ${d.name}`).join(" · ")}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btn, flex: "0 0 auto", padding: "12px 18px", fontSize: 16, fontWeight: 800 }} onClick={() => setWalkIdx(null)}>{L.cancel}</button>
            <button style={{ ...S.btnP, flex: 1 }} onClick={() => setWalkIdx(null)}>{L.walkDone}</button>
          </div>
        </div>
      </div>
    )
  }

  // De haler-strook. Drie toestanden: niemand haalt, iemand anders haalt, jij haalt.
  // Wie tikte al iets aan, en wat? Iedereen mag dit zien — alleen de haler krijgt er
  // knoppen bij. Alles komt uit de mand, dus er is geen aparte toestand te bewaren.
  const [standOpen, setStandOpen] = useState(false)
  const [barOpen, setBarOpen] = useState(false)
  // Voor wie tik jij aan? Standaard jezelf; je kan wisselen naar iemand zonder gsm.
  const [voorWieRaw, setVoorWieRaw] = useState<string | null>(null)
  // Noteer je op naam? In Fair Split altijd; in "ik bestel voor de groep" is het een
  // keuze die je bij de start maakt en daarna kan omzetten.
  // null = nog niets gekozen, false = snel, true = uitgebreid.
  const [opNaam, setOpNaam] = useState<boolean | null>(false)
  // "Per man × hoeveel man": bij uitgebreid is dat het vaste aantal gasten. (Staat hier
  // omdat de const pas ná de opNaam-declaratie mag rekenen — functies mogen dat wel
  // eerder, directe expressies niet.)
  const potHoofden = opNaam === true && !settle ? Math.max(1, people.length) : Math.max(1, headcount)
  const [noteerKeuze, setNoteerKeuze] = useState(false)
  // Koos je "op naam", dan zet je eerst de namen. Daarna verdwijnt dit scherm.
  const [namenSetup, setNamenSetup] = useState(false)
  // Elk nieuw scherm begint bovenaan; zonder dit erf je de scrollstand van het vorige
  // en land je halverwege de pagina.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo(0, 0)
  }, [view, namenSetup])
  const [noteerPick, setNoteerPick] = useState<"quick" | "named" | null>(null)
  const [noteerInfo, setNoteerInfo] = useState<"quick" | "named" | null>(null)
  const voorWie = voorWieRaw && people.some((p) => p.id === voorWieRaw) ? voorWieRaw : meId
  const renderStandLijst = () => (
    <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
      {people.map((pp) => {
        const zijne = drinks.filter((d) => (cart[d.id]?.[pp.id] ?? 0) > 0)
        const slaOver = openAnswers[pp.id] === "skip" && zijne.length === 0
        const klaar = zijne.length > 0 || slaOver
        const kleur = zijne.length > 0 ? "#1f6b3a" : slaOver ? "#6b7484" : "#8b93a3"
        return (
          <div key={pp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9,
            background: zijne.length > 0 ? "rgba(31,138,76,0.07)" : slaOver ? "rgba(29,41,66,0.05)" : "#fff",
            border: klaar ? "none" : "1px dashed rgba(29,41,66,0.3)" }}>
            <span style={{ fontSize: 16, fontWeight: klaar ? 700 : 400, color: kleur, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {zijne.length > 0 ? "✓" : slaOver ? "—" : ""}
              {!!ownerDevice && pp.claimedBy === ownerDevice && <KroonIcoon size={11} kleur={kleur} />}
              {pp.name}
            </span>
            <span style={{ flexShrink: 0, fontSize: 14.5, color: zijne.length > 0 ? "#4a7a5c" : "#9aa3b2", textAlign: "right" }}>
              {zijne.length > 0 ? zijne.map((d) => `${cart[d.id][pp.id]}× ${d.name}`).join(" · ") : slaOver ? L.nothingForMe : L.stillBusy}
            </span>
          </div>
        )
      })}
    </div>
  )

  const renderBarLijst = () => {
    const regels = drinks.map((d) => {
      const per = cart[d.id] || {}
      const namen = people.filter((pp) => (per[pp.id] ?? 0) > 0)
      const aantal = Object.values(per).reduce((a, b) => a + (b || 0), 0) + (cartAnon[d.id] ?? 0)
      return { d, aantal, namen }
    }).filter((r) => r.aantal > 0)
    if (regels.length === 0) return null
    const totaal = regels.reduce((a, r) => a + r.aantal, 0)
    return (
      <div style={{ marginTop: 9, background: "#fff", borderRadius: 12, padding: "12px 13px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, borderBottom: "2px solid rgba(240,165,0,0.5)", paddingBottom: 7, marginBottom: 9 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: "#1d2942" }}>{L.toTheBar}</span>
          <span style={{ flexShrink: 0, fontSize: 14.5, fontWeight: 700, color: "#8b93a3" }}>{L.drinksCount(totaal)}</span>
        </div>
        {regels.map((r, i) => (
          <div key={r.d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < regels.length - 1 ? "1px solid rgba(29,41,66,0.1)" : "none" }}>
            <span style={{ fontSize: 18.5, fontWeight: 800, color: "#1d2942", minWidth: 0 }}>{r.aantal}× {r.d.name}</span>
            <span style={{ flexShrink: 0, fontSize: 14, color: "#8b93a3", textAlign: "right", maxWidth: "52%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.namen.map((pp) => pp.name).join(", ")}</span>
          </div>
        ))}
      </div>
    )
  }

  const mijnKeuze = meId ? drinks.reduce((a, d) => a + (cart[d.id]?.[meId] ?? 0), 0) : 0
  // Zodra er weer een rondje loopt, is het vorige haal-lijstje geschiedenis.
  useEffect(() => { if (openRoundId) setHaalInfo(null) }, [openRoundId])
  // Nieuw rondje wacht op betaling en er zit geld in de pot? Start meteen met beide
  // velden open — anders stond "Zelf betaald" alvast aan terwijl de pot klaarligt,
  // en was combineren altijd een extra tik.
  const laatsteRondeId = rounds.length > 0 ? rounds[rounds.length - 1].id : null
  useEffect(() => {
    if (!laatsteRondeId) return
    const i = rounds.length - 1
    const r0 = rounds[i]
    if ((r0?.amount || 0) > 0.005 || (r0?.potPart || 0) > 0.005) return
    if (payVia !== "self") return
    if (Math.max(0, potAvailFor(i)) <= 0.005) return
    setMixZelf(0); setMixPot(0); setMixFocus("zelf"); setPayVia("mix")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laatsteRondeId, potContribTotal])
  useEffect(() => {
    if (showPot || potVulIntent.current === null) return
    const i = potVulIntent.current
    if (potAvailFor(i) <= 0.005) return
    potVulIntent.current = null
    if (payVia !== "self") return
    const r0 = rounds[i]
    setMixZelf(r0?.amount || 0); setMixPot(0); setMixFocus("pot"); setPayVia("mix")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPot, potContribTotal, payVia])
  const renderRunnerBar = () => {
    // Net afgerond: de bevestiging voor de haler, mét zijn lijstje en de vergrootknop.
    // De rest van de groep kreeg intussen de broadcast "Bestelling bevestigd — X haalt".
    if (!openRoundId && haalInfo) {
      return (
        <div style={{ ...S.card, background: "#fff", border: `2px solid ${MODUS_FAIR.rand}`, boxShadow: `0 6px 18px -12px ${MODUS_FAIR.gloed}` }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: MODUS_FAIR.tekst, marginBottom: 2 }}>{L.haalTitel}</div>
          <div style={{ fontSize: 15, color: "#1d2942", marginBottom: 10 }}>{L.haalSub}</div>
          <div style={{ background: MODUS_FAIR.vlak, borderRadius: 11, padding: "10px 11px", marginBottom: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: MODUS_FAIR.tekst }}>{L.toTheBar}</span>
              <button onClick={() => setBarFull(true)} style={{ ...S.btn, flexShrink: 0, padding: "5px 10px", fontSize: 13.5, fontWeight: 800, color: MODUS_FAIR.tekst }}>{L.showBig}</button>
            </div>
            <div style={{ fontSize: 16, color: "#1d2942", lineHeight: 1.6 }}>
              {haalInfo.items.map((x, i) => <span key={x.id}>{i > 0 ? " · " : ""}<b>{x.n}×</b> {x.naam}</span>)}
            </div>
          </div>
          <button onClick={() => setHaalInfo(null)} style={{ width: "100%", cursor: "pointer", border: "none", borderRadius: 12, padding: "12px 8px", fontSize: 17, fontWeight: 800, color: "#fff", background: MODUS_FAIR.knop }}>{L.haalKlaar}</button>
        </div>
      )
    }
    const ikHaal = !!meId && startedBy === meId
    if (!openRoundId && !startedBy) {
      // Nog geen rondje. Wie start, haalt — één handeling.
      // Twee wegen, elk met de uitleg in de knop zelf: de keuze gaat niet over "welke
      // knop" maar over wie er aantikt.
      return (
        <button onClick={() => setStartCheck(true)}
          style={{ width: "100%", cursor: "pointer", border: "none", borderRadius: 12, padding: "12px 10px", textAlign: "center", lineHeight: 1.3, fontFamily: "inherit", color: "#fff", background: MODUS_FAIR.knop, boxShadow: `0 4px 14px -6px ${MODUS_FAIR.gloed}`, marginBottom: 11 }}>
          <span style={{ display: "block", fontSize: 18, fontWeight: 600 }}>{L.roundTogether}</span>
          <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#d6f2f6", marginTop: 3 }}>📱 {L.everyoneTapsOwn}</span>
        </button>
      )
    }
    if (ikHaal) {
      const klaar = people.filter((pp) => drinks.some((d) => (cart[d.id]?.[pp.id] ?? 0) > 0) || openAnswers[pp.id] === "skip")
      const allen = klaar.length >= people.length && people.length > 0
      return (
        <div style={{ ...S.card, background: "#fff", border: `2px solid ${MODUS_FAIR.rand}`, boxShadow: `0 6px 18px -12px ${MODUS_FAIR.gloed}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 9 }}>
            <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", background: MODUS_FAIR.knop, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21.5 }}>🍻</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 17.5, fontWeight: 800, color: MODUS_FAIR.tekst }}>{L.inRoundNow(roundNr)}</span>
              <span style={{ display: "block", fontSize: 14, color: allen ? "#1f6b3a" : "#5a8f99", fontWeight: allen ? 800 : 400, marginTop: 1 }}>{allen ? `✓ ${L.allChose}` : L.confirmedOf(klaar.length, people.length)}</span>
            </span>
          </div>
          {/* Bovenaan en duidelijk: de haler rondt zelf af zodra hij terug is van de
              toog. Het bedrag is niet zijn zorg — dat vult de admin straks in. */}
          <button onClick={() => { void runnerRondtAf() }} disabled={barTotalen().length === 0}
            style={{ width: "100%", marginBottom: 11, cursor: "pointer", border: "none", borderRadius: 12, padding: "13px 8px", fontSize: 17.5, fontWeight: 800, color: "#fff", background: MODUS_FAIR.knop, opacity: barTotalen().length === 0 ? 0.45 : 1 }}>{L.runnerDoneBtn}</button>
          {/* Alles over dit rondje in één kader: wie klaar is, wat je moet halen, en de
              twee handelingen. Ingeklapt moest je te veel tikken om te zien waar je aan
              toe was. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, borderTop: `1px solid ${MODUS_FAIR.lijnZacht}`, paddingTop: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: "#6b7484", letterSpacing: "0.04em" }}>{L.whoIsIn}</span>
            {klaar.length < people.length && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button onClick={vraagHerinnering} style={{ ...S.btn, padding: "6px 10px", fontSize: 14, fontWeight: 800, color: "#8a5e0f" }}>{L.remindBtn}</button>
                <span onClick={() => setNotice(L.remindInfo)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 13.5, fontWeight: 800, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>i</span>
              </span>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            {people.map((pp, pi) => {
              const zijne = drinks.filter((d) => (cart[d.id]?.[pp.id] ?? 0) > 0)
              const slaOver = openAnswers[pp.id] === "skip"
              const isOk = isKlaar(pp.id)
              return (
                <div key={pp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, fontSize: 16, padding: "6px 0", borderBottom: pi < people.length - 1 ? `1px solid ${MODUS_FAIR.lijnZacht}` : "none" }}>
                  <span style={{ flexShrink: 0, fontWeight: isOk ? 800 : 600, color: isOk ? "#1f6b3a" : "#a8c4c9", maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isOk ? "✓ " : ""}{pp.name}{pp.id === meId ? ` (${L.youWord})` : ""}
                  </span>
                  <span style={{ minWidth: 0, textAlign: "right", color: isOk ? "#4a5567" : "#a8c4c9", fontStyle: isOk ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {slaOver ? L.nothingWord : isOk && zijne.length > 0 ? zijne.map((d) => `${aQty(d.id, pp.id)}× ${d.name}`).join(" · ") : L.busyChoosing}
                  </span>
                </div>
              )
            })}
            {/* Wat je straks aan de toog moet vragen, alvast opgeteld. */}
            {barTotalen().length > 0 && (
              <div style={{ background: MODUS_FAIR.tint, borderRadius: 10, padding: "8px 11px", marginTop: 9, fontSize: 15, color: MODUS_FAIR.tekst, lineHeight: 1.45 }}>
                <b>{L.togetherDrinks(barTotalen().reduce((a, b) => a + b.n, 0))}</b> · {barTotalen().map((b) => `${b.n}× ${b.naam}`).join(", ")}
              </div>
            )}
          </div>
          {/* Het barlijstje hoort bij het hálen, niet bij het kiezen: het verschijnt pas
              op de bevestigingskaart, nadat op "Rondje afronden en halen" getikt is. */}
          {/* Wie het rondje startte moet er ook makkelijk weer vanaf kunnen — óók na de
              waarschuwing van daarnet. Iedereen krijgt dan de melding met de naam erbij. */}
          <button onClick={annuleerRondje} style={{ width: "100%", cursor: "pointer", background: "none", border: "none", fontSize: 15, fontWeight: 700, color: "#b0402f" }}>{L.cancelRoundBtn}</button>
        </div>
      )
    }
    if (startedBy) {
      // Iemand anders haalt. Informatie — overnemen mag, maar rustig.
      return (
        <div style={{ ...S.card, background: "#fff", border: `2px solid ${MODUS_FAIR.rand}`, boxShadow: `0 6px 18px -12px ${MODUS_FAIR.gloed}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
            <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", background: MODUS_FAIR.knop, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>{(runnerName() || "?").charAt(0).toUpperCase()}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 17.5, fontWeight: 800, color: MODUS_FAIR.tekst }}>{L.roundBusyX(runnerName())}</span>
              <span style={{ display: "block", fontSize: 14, color: alGekozen >= people.length ? "#1f6b3a" : "#5a8f99", fontWeight: alGekozen >= people.length ? 800 : 400, marginTop: 1 }}>{alGekozen >= people.length ? `✓ ${L.allChose}` : L.someChose(alGekozen, people.length)}</span>
            </span>
          </div>
          {/* Wat er van jou verwacht wordt, met de uitweg ernaast. Koos je al iets, dan is
              die uitweg niet meer nodig. */}
          {meId && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${MODUS_FAIR.lijnZacht}`, paddingTop: 10 }}>
              {openAnswers[meId] === "skip" && mijnKeuze === 0 ? (<>
                <span style={{ fontSize: 15.5, color: "#6b7484", minWidth: 0 }}>{L.youTakeNothing}</span>
                <span onClick={() => antwoordRondje("different")} style={{ flexShrink: 0, fontSize: 15, fontWeight: 800, color: "#8a5e0f", cursor: "pointer", textDecoration: "underline" }}>{L.chooseAnyway}</span>
              </>) : openAnswers[meId] === "same" ? (<>
                <span style={{ fontSize: 15, color: "#1f6b3a", fontWeight: 700, minWidth: 0 }}>{L.youAreDone(mijnKeuze)}</span>
                <button onClick={() => antwoordRondje("different")} style={{ flexShrink: 0, cursor: "pointer", border: "1px solid rgba(29,41,66,0.3)", background: "#fff", color: "#6b7484", borderRadius: 9, padding: "7px 11px", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>{L.changeWord}</button>
              </>) : mijnKeuze > 0 ? (<>
                <span style={{ fontSize: 15, color: MODUS_FAIR.tekst, minWidth: 0 }}>{L.chosenCount(mijnKeuze)}</span>
                <button onClick={() => antwoordRondje("same")} style={{ flexShrink: 0, cursor: "pointer", border: "none", background: MODUS_FAIR.knop, color: "#fff", borderRadius: 9, padding: "8px 13px", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>{L.imDoneBtn}</button>
              </>) : (<>
                <span style={{ fontSize: 15.5, color: MODUS_FAIR.tekst, fontWeight: 700, minWidth: 0 }}>{L.pickBelow}</span>
                <button onClick={() => antwoordRondje("skip")} style={{ flexShrink: 0, cursor: "pointer", border: "1.5px solid rgba(29,41,66,0.28)", background: "#fff", color: "#6b7484", borderRadius: 9, padding: "7px 11px", fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap" }}>{L.nothingForMeBtn}</button>
              </>)}
            </div>
          )}
          {/* Ook wie niet haalt kan annuleren, maar alleen de beheerder — nodig wanneer
              de haler zijn gsm wegstak en het rondje eeuwig zou blijven openstaan. */}
          {magAnnuleren && (
            <button onClick={annuleerRondje} style={{ width: "100%", marginTop: 9, cursor: "pointer", background: "none", border: "none", fontSize: 15, fontWeight: 700, color: "#b0402f" }}>{L.cancelRoundBtn}</button>
          )}
        </div>
      )
    }
    // Er loopt een rondje, maar niemand claimde de haler-rol (bv. admin startte het).
    // Geen verwarrende "wie haalt?"-vraag herhalen — gewoon niks tonen.
    return null
  }

  // De optelling gebeurt in Postgres (party_bump), niet hier. Twee gasten die tegelijk
  // hetzelfde drankje aantikken zouden elkaar anders overschrijven.
  const bump = async (did: string, pid: string, delta: number) => {
    setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: Math.max(0, (c[did]?.[pid] ?? 0) + delta) } }))
    // Duidt iemand (haler of admin) iets aan voor een ánder? Die persoon hoort dat te
    // weten — één persoonlijke melding per rondje, bij de eerste tik.
    if (settle && delta > 0 && pid !== meId && !gemeldVoor.current.has(pid)) {
      gemeldVoor.current.add(pid)
      const naam = (meId ? people.find((pp) => pp.id === meId)?.name : null) || "de admin"
      try { void kanaalRef.current?.send({ type: "broadcast", event: "voorJou", payload: { voor: pid, tekst: L.tappedForYou(naam) } }) } catch { /* niets */ }
    }
    // Je was klaar en wijzigt toch nog: dan tel je weer als "bezig".
    if (settle && pid === meId && (openAnswers[pid] === "same" || openAnswers[pid] === "skip")) void antwoordRondje("different")
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: pid, p_drink: did, p_delta: delta })
    if (error) { setNotice("Opslaan mislukt: " + error.message); loadParty(groupId) }
  }
  const bumpAnon = async (did: string, delta: number) => {
    setCartAnon((a) => ({ ...a, [did]: Math.max(0, (a[did] ?? 0) + delta) }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: null, p_drink: did, p_delta: delta })
    if (error) { setNotice("Opslaan mislukt: " + error.message); loadParty(groupId) }
  }
  const assignFromAnon = async (did: string, pid: string) => {
    if ((cartAnon[did] ?? 0) <= 0) return
    setCartAnon((a) => ({ ...a, [did]: Math.max(0, (a[did] ?? 0) - 1) }))
    setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: (c[did]?.[pid] ?? 0) + 1 } }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_assign", { p_group: groupId, p_round: rid, p_drink: did, p_from: null, p_to: pid })
    if (error) { setNotice("Toewijzen mislukt: " + error.message); loadParty(groupId) }
  }
  const unassignCart = async (did: string, pid: string) => {
    if ((cart[did]?.[pid] ?? 0) <= 0) return
    setCart((c) => ({ ...c, [did]: { ...(c[did] ?? {}), [pid]: Math.max(0, (c[did]?.[pid] ?? 0) - 1) } }))
    setCartAnon((a) => ({ ...a, [did]: (a[did] ?? 0) + 1 }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    const { error } = await supabase.rpc("party_assign", { p_group: groupId, p_round: rid, p_drink: did, p_from: pid, p_to: null })
    if (error) { setNotice("Losmaken mislukt: " + error.message); loadParty(groupId) }
  }
  const setEachOne = async (did: string) => {
    const huidig = cart[did] ?? {}
    setCart((c) => ({ ...c, [did]: Object.fromEntries(people.map((p) => [p.id, 1])) }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    for (const p of people) {
      const delta = 1 - (huidig[p.id] ?? 0)
      if (delta !== 0) await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: p.id, p_drink: did, p_delta: delta })
    }
    loadParty(groupId)
  }
  const eachOne = (did: string) => { const hi = people.filter((p) => (cart[did]?.[p.id] ?? 0) >= 2).map((p) => p.name); if (hi.length > 0) { setConfirmDlg({ msg: L.eachOneConfirm(hi.join(" en "), hi.length > 1), yes: L.yesEachOne, onYes: () => { setEachOne(did); setConfirmDlg(null) } }) } else setEachOne(did) }
  const drinkTotal = (did: string) => Object.values(cart[did] ?? {}).reduce((a, b) => a + b, 0) + (cartAnon[did] ?? 0)
  const roundItems = useMemo(() => drinks.reduce((s, d) => s + drinkTotal(d.id), 0), [cart, cartAnon, drinks]) // eslint-disable-line
  // Aan het aantal drankjes gehangen en niet aan de plusknop, zodat de sprong ook
  // volgt als het eerste drankje via zoeken of inspreken binnenkomt. Eén keer per
  // rondje: loopt het rondje leeg of begint er een nieuw, dan mag hij opnieuw.
  useEffect(() => {
    if (settle) return
    if (modusVorig.current !== perPersoon) {
      modusVorig.current = perPersoon
      sprongGedaan.current = false
      return
    }
    if (roundItems === 0) { sprongGedaan.current = false; return }
    if (sprongGedaan.current) return
    sprongGedaan.current = true
    naarLijst()
  }, [roundItems, perPersoon, settle]) // eslint-disable-line
  const resumeRound = () => { if (blockIfUnpaid()) return; setActiveCat(catsPresent[0]); setView("order") }
  const unfinishedRound = roundItems > 0 && rounds.length < roundNr
  // Snelle rondjes kennen geen betalers: daar telt een rondje als afgehandeld zodra er
  // een bedrag op staat én je dat bewust bevestigde of oversloeg. Enkel een bedrag
  // intikken volstaat dus niet — anders kan je halverwege wegwandelen.
  const roundIsPaid = (r: Round) => settle
    ? (r.amount || 0) > 0.005 && ((r.potPart || 0) > 0.005 || Object.values(r.payers || {}).some((a) => (a || 0) > 0.005))
    : true
  // Het laatste rondje van een snelle avond is pas "klaar" na bevestigen of overslaan.
  const laatsteRondjeKlaar = () => settle || lastRoundHandled || rounds.length === 0
  const unpaidIdx = () => {
    const i = rounds.findIndex((r) => !roundIsPaid(r))
    if (i >= 0) return i
    // Alles heeft een bedrag, maar het laatste is nog niet bevestigd? Dan blijft dat open.
    return laatsteRondjeKlaar() ? -1 : rounds.length - 1
  }
  const paidCount = rounds.filter(roundIsPaid).length
  const blockIfUnpaid = () => { if (!settle) return false; const i = unpaidIdx(); if (i < 0) return false; setNotice(L.roundUnpaid(i + 1)); setView("confirmed"); return true }
  const unassignedTotal = useMemo(() => drinks.reduce((s, d) => s + (cartAnon[d.id] ?? 0), 0), [cartAnon, drinks]) // eslint-disable-line
  const pickedUpOf = (pid: string) => drinks.reduce((a, d) => a + (d.cup ? aQty(d.id, pid) : 0), 0)

  // ── per-rondje bewerk-helpers (hub) ─────────────────────────────────────────
  // Een AFGESLOTEN of onbetaald rondje bijstellen doet enkel de admin. Daar is geen
  // gelijktijdigheid, dus mag de hele rij in één keer weg. (Het open rondje niet —
  // dat gaat via party_bump, want daar tikt iedereen tegelijk.)
  const persistRound = (r: Round) => {
    supabase.from("party_rounds")
      .update({ amount: r.amount, pot_part: r.potPart, payers: r.payers, gave_back: r.gaveBack })
      .eq("id", r.id)
      .then(({ error }) => { if (error) setNotice("Opslaan mislukt: " + error.message) })
  }
  // Drankjes van een afgesloten rondje verplaatsen: wél per rij, want die zitten in
  // party_round_items en niet in de jsonb.
  const persistItem = async (r: Round, did: string, pid: string | null, delta: number) => {
    if (!groupId) return
    const { error } = await supabase.rpc("party_bump", { p_group: groupId, p_round: r.id, p_person: pid, p_drink: did, p_delta: delta })
    if (error) setNotice("Opslaan mislukt: " + error.message)
  }

  // Snelle rondjes: het totaal in de pot volgt uit "iedereen legt X in" × aantal
  // personen. Zo klopt het opgeslagen totaal, of je nu het bedrag of het aantal wijzigt.
  // Een drankkaart hoort alleen bij Fair Split. In snelle rondjes (en dus ook in het
  // hele overstaptraject dat daaruit vertrekt) is de pot altijd gewoon geld.
  useEffect(() => {
    if (!settle && potIsCard) setPotIsCard(false)
  }, [settle, potIsCard])

  // Vangnet. Het afrekenscherm van snelle rondjes bestaat niet in Fair Split. Sta je daar
  // toch met settle aan (en niet middenin de overstap), dan is de modus ergens blijven
  // hangen. Zonder deze correctie toont de kopbalk de Fair Split-navigatie en wandel je
  // via “Overzicht” de echte Fair Split-schermen in, zonder weg terug.
  useEffect(() => {
    if (view === "quickSettle" && settle && !fromQuick) {
      setSettle(false)
      persistSettings({ settle: false })
    }
  }, [view, settle, fromQuick]) // eslint-disable-line

  useEffect(() => {
    if (settle) return
    const totaal = potPerMan * potHoofden
    setPotDraft((c) => (c.pot === totaal ? c : { pot: totaal }))
  }, [settle, potPerMan, headcount])

  // Wie een bestaand rondje bijstelt (bedrag, betaler, bekers) markeert het als vuil;
  // dit effect schrijft het daarna weg. Zo hoeft geen enkele mutator databank-logica
  // te kennen, en persisteren we altijd de toestand NA de wijziging.
  const [dirtyRound, setDirtyRound] = useState<number | null>(null)
  useEffect(() => {
    if (dirtyRound == null) return
    const r = rounds[dirtyRound]
    if (r) persistRound(r)
    setDirtyRound(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyRound, rounds])

  const rBump = (idx: number, did: string, pid: string, delta: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, orders: { ...r.orders, [did]: { ...(r.orders[did] ?? {}), [pid]: Math.max(0, (r.orders[did]?.[pid] ?? 0) + delta) } } } : r)); persistItem(rounds[idx], did, pid, delta); setDirtyRound(idx) }
  const rBumpAnon = (idx: number, did: string, delta: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, anon: { ...r.anon, [did]: Math.max(0, (r.anon[did] ?? 0) + delta) } } : r)); persistItem(rounds[idx], did, null, delta); setDirtyRound(idx) }
  const rSetGaveBack = (idx: number, pid: string, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, gaveBack: { ...r.gaveBack, [pid]: Math.max(0, v) } } : r)); setDirtyRound(idx) }
  const rUnassign = (idx: number, did: string, pid: string) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, orders: { ...r.orders, [did]: { ...(r.orders[did] ?? {}), [pid]: Math.max(0, (r.orders[did]?.[pid] ?? 0) - 1) } }, anon: { ...r.anon, [did]: (r.anon[did] ?? 0) + 1 } } : r)); persistItem(rounds[idx], did, pid, -1); persistItem(rounds[idx], did, null, 1); setDirtyRound(idx) }
  const rAssignFromAnon = (idx: number, did: string, pid: string) => { if ((rounds[idx]?.anon[did] ?? 0) > 0) { rBumpAnon(idx, did, -1); rBump(idx, did, pid, 1) } }
  const potAvailFor = (idx: number) => potContribTotal - (potSpent - (rounds[idx]?.potPart || 0))
  // potVast = "de pot betaalt dit vaste bedrag, raak het niet aan": alleen de rest
  // wordt dan over de personen verdeeld. Zonder potVast blijft het oude gedrag
  // (gelijk verdelen over pot + personen) gelden, bijvoorbeeld bij het aanzetten
  // van de pot-chip.
  const rRedistribute = (r: Round, idx: number, usePot: boolean, persons: string[], amount: number, potVast?: number): Round => {
    const n = persons.length + (usePot ? 1 : 0)
    if (n === 0 || amount <= 0) return { ...r, amount, payers: {}, potPart: 0 }
    const avail = Math.max(0, potAvailFor(idx))
    let potPart = 0, rest = amount
    if (usePot) {
      potPart = potVast !== undefined ? Math.min(potVast, avail, amount) : Math.min(amount / n, avail)
      rest = amount - potPart
    }
    const per = persons.length ? rest / persons.length : 0
    const payers: Record<string, number> = {}
    persons.forEach((pid) => (payers[pid] = per))
    return { ...r, amount, payers, potPart }
  }
  const rSetAmount = (idx: number, v: number) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const persons = Object.keys(r.payers || {}); const usePot = (r.potPart || 0) > 0; return rRedistribute(r, idx, usePot, persons, v, usePot ? (r.potPart || 0) : undefined) })); setDirtyRound(idx) }
  const rTogglePot = (idx: number) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const persons = Object.keys(r.payers || {}); const usePot = !((r.potPart || 0) > 0); if (usePot && potAvailFor(idx) <= 0.005) { setNotice(L.potEmpty(potIsCard)); return r } return rRedistribute(r, idx, usePot, persons, r.amount) })); setDirtyRound(idx) }
  const rSetPayerAmt = (idx: number, pid: string, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, payers: { ...(r.payers || {}), [pid]: Math.max(0, v) } } : r)); setDirtyRound(idx) }
  const rSetPotAmt = (idx: number, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, potPart: Math.max(0, Math.min(v, Math.max(0, potAvailFor(idx)))) } : r)); setDirtyRound(idx) }
  // Snelle rondjes: alleen het rondjebedrag zetten, zonder de Fair-Split payer-verdeling.
  // Het pot-deel (potPart) beheren we los via rSetPotAmt (handmatig, geklemd op de pot).
  const qSetAmount = (idx: number, v: number) => { setRounds((rs) => rs.map((r, i) => i === idx ? { ...r, amount: v } : r)); setDirtyRound(idx) }
  // Snelle rondjes: rondje afsluiten en naar het overzicht. "skip" = zonder bedrag; als
  // er dan tóch al iets ingevuld staat, waarschuwen zodat je het niet per ongeluk weggooit.
  const closeQuickRound = (skip: boolean) => {
    const idx = rounds.length - 1
    const r = rounds[idx]
    const heeftIets = r && ((r.amount || 0) > 0.005 || (r.potPart || 0) > 0.005)
    // Overslaan = géén bedrag. Wis wat er stond, zodat het overzicht "geen bedrag" toont
    // en de pot niet onterecht wordt aangesproken.
    const doeOverslaan = () => {
      setRounds((rs) => rs.map((rr, i) => i === idx ? { ...rr, amount: 0, potPart: 0 } : rr))
      if (r) setDirtyRound(idx)
      setLastRoundHandled(true); setPayVia("self"); setOverviewBackTo("hub"); setView("roundsOverview")
    }
    if (skip && heeftIets) {
      setConfirmDlg({ variant: "danger", msg: L.skipCostWarn, yes: L.skipCostYes, onYes: () => { setConfirmDlg(null); doeOverslaan() } })
    } else {
      doeOverslaan()
    }
  }
  // Snelle rondjes: bevestig het betaalde bedrag via de gekozen bron (zelf of pot) en
  // sluit het rondje af. Bij "pot" gaat het bedrag (geklemd op wat er in de pot zit) als
  // potPart; bij "zelf" telt het gewoon als rondjebedrag zonder pot-aandeel.
  const confirmQuickPay = () => {
    const idx = rounds.length - 1
    const r = rounds[idx]
    const bedrag = r?.amount || 0
    if (payVia === "pot") {
      const beschikbaar = Math.max(0, potAvailFor(idx))
      // Volledig uit de pot: het hele bedrag moet erin zitten.
      if (bedrag > beschikbaar + 0.005) { meldPot(L.potShortTitle); return }
      rSetPotAmt(idx, bedrag)
    } else if (payVia === "mix") {
      const beschikbaar = Math.max(0, potAvailFor(idx))
      const potdeel = Math.max(0, Math.min(mixPot, bedrag))
      if (potdeel > beschikbaar + 0.005) { meldPot(L.potShortTitle); return }
      rSetPotAmt(idx, potdeel)
    } else {
      rSetPotAmt(idx, 0)
    }
    setLastRoundHandled(true); setPayVia("self"); setOverviewBackTo("hub"); setView("roundsOverview")
  }
  const openGroepVenster = (metNaam: boolean, vulAan = false) => {
    setNaamPlichtVeld(metNaam && !isAutoNaam(groupName) ? groupName : "")
    setPersGeteld(!metNaam || people.length > 1)
    if (vulAan && people.length < 2) void addPerson()
    setAlleenPers(!metNaam)
    setPersSnap(people.map((pp) => ({ id: pp.id, name: pp.name })))
    setNaamPlichtNa(null)
    setNaamPlicht(true)
  }

  const kopTeller = () => (
    <span onClick={(e) => { e.stopPropagation(); openGroepVenster(false, true) }} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, color: "#3a4459", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
      <span onClick={(e) => { e.stopPropagation(); if (people.length > 1) removeLastPerson() }}
        style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: `1px solid ${RAND}33`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer", opacity: people.length > 1 ? 1 : 0.4 }}>−</span>
      <b style={{ color: RAND, fontSize: 18, padding: "0 2px" }}>{people.length}</b>
      <span style={{ color: "#6b7484", fontSize: 13 }}>{L.persWordLow}</span>
      <span onClick={(e) => { e.stopPropagation(); void addPerson(); openGroepVenster(false) }}
        style={{ width: 28, height: 28, borderRadius: "50%", background: RAND, color: RANDTEKST, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, cursor: "pointer" }}>＋</span>
    </span>
  )

  const rPaidSum = (r: Round) => (r.potPart || 0) + Object.values(r.payers || {}).reduce((a, b) => a + (b || 0), 0)
  const rTogglePayer = (idx: number, pid: string) => { setRounds((rs) => rs.map((r, i) => { if (i !== idx) return r; const cur = Object.keys(r.payers || {}); const persons = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]; const usePot = (r.potPart || 0) > 0; return rRedistribute(r, idx, usePot, persons, r.amount, usePot ? (r.potPart || 0) : undefined) })); setDirtyRound(idx) }

  // ── afgeleide bekers (uit rounds) ───────────────────────────────────────────
  const roundPicked = (r: Round, pid: string) => drinks.reduce((a, d) => a + (d.cup ? (r.orders[d.id]?.[pid] ?? 0) : 0), 0)
  const cupsBal = (pid: string) => rounds.reduce((s, r) => s + (roundPicked(r, pid) - (r.gaveBack[pid] || 0)), 0)

  const isGuestDefault = (name: string) => /^Gast \d+$/.test(name.trim())
  // Heeft deze persoon ergens in de avond drankjes op zijn naam? Een plaats zonder
  // drankjes doet niet mee in de verdeling en hoeft dus ook geen echte naam.
  const dronkIets = (pid: string) => rounds.some((r) => drinks.some((d) => (r.orders[d.id]?.[pid] ?? 0) > 0))
  // Een plaats bijzetten = een rij in party_people. Leeg van naam: vrij tot iemand
  // ze claimt (de admin door ze te benoemen, een gast door de link te openen).
  // Het plaatsnummer wordt in Postgres bepaald, niet hier. Berekende je het in de
  // browser, dan lezen twee snelle tikken dezelfde lijst, komen ze op hetzelfde nummer
  // uit, en weigert de unique-index de tweede: "duplicate key value".
  const addPerson = async () => {
    if (!groupId || addingPerson.current) return
    addingPerson.current = true
    const { error } = await supabase.rpc("party_add_person", { p_group: groupId, p_name: "" })
    addingPerson.current = false
    if (error) { setNotice("Persoon toevoegen mislukt: " + error.message); return }
    loadParty(groupId)
  }
  const renamePerson = async (id: string, name: string) => {
    // Optimistisch: het invoerveld moet meteen meebewegen, niet pas na de rondreis.
    setPeople((ps) => ps.map((x) => x.id === id ? { ...x, name } : x))
    const clean = isGuestDefault(name) ? "" : name.trim()
    const { error } = await supabase.from("party_people").update({ name: clean }).eq("id", id)
    if (error) setNotice("Naam opslaan mislukt: " + error.message)
  }
  const personHasDrinks = (pid: string) => rounds.some((r) => Object.values(r.orders).some((o) => (o?.[pid] ?? 0) > 0)) || Object.values(cart).some((o) => (o?.[pid] ?? 0) > 0)
  // Merk op wanneer er iemand bijkomt die zichzelf aanmeldde. De eerste lading (bij
  // het laden van de groep) telt niet als "nieuw" — anders krijg je een melding voor
  // iedereen die er al was.
  const seededNewcomer = useRef(false)
  // Onthoud wie er al geclaimd was, zodat we een NIEUWE aanmelding herkennen — of het
  // nu een laatkomer is die een plaats bijzette, of iemand die een bestaande vrije
  // plaats claimde via de QR. Beide zijn "iemand meldt zich aan".
  const claimedSeats = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (people.length === 0) return
    if (!seededNewcomer.current) {
      people.forEach((p) => { knownPeople.current.add(p.id); if (p.claimedBy) claimedSeats.current.add(p.id) })
      seededNewcomer.current = true
      return
    }
    for (const p of people) {
      const isNieuwePersoon = !knownPeople.current.has(p.id)
      const netGeclaimd = !!p.claimedBy && !claimedSeats.current.has(p.id)
      knownPeople.current.add(p.id)
      if (p.claimedBy) claimedSeats.current.add(p.id)
      // Meld wie zich aanmeldt: een nieuwe persoon met een claim, óf een bestaande
      // plaats die net geclaimd werd. Niet mezelf.
      if (p.id !== meId && p.claimedBy && (isNieuwePersoon || netGeclaimd)) {
        setNewcomer({ id: p.id, name: p.name })
      }
    }
  }, [people, meId])

  const removePerson = (id: string) => { const pp = people.find((x) => x.id === id); if (personHasDrinks(id)) { setNotice(L.personHasDrinks(pp?.name || L.thisPerson)); return } supabase.from("party_people").delete().eq("id", id).then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message) }) }
  // Iemand wegnemen die al in de pot zat: zijn inleg moet mee, anders blijft dat geld
  // in het totaal staan zonder eigenaar en klopt de eindverdeling niet meer.
  const removePersonEnPot = async (id: string) => {
    if (personHasDrinks(id)) { setNotice(L.personHasDrinks(people.find((x) => x.id === id)?.name || L.thisPerson)); return }
    const raakt = potRounds.filter((r) => (r.amounts[id] || 0) > 0.005)
    for (const r of raakt) {
      const rest = Object.fromEntries(Object.entries(r.amounts).filter(([k]) => k !== id))
      const over = Object.values(rest).reduce((a, b) => a + (b || 0), 0)
      if (over > 0.005) await supabase.from("party_pot").update({ amounts: rest }).eq("id", r.id)
      else await supabase.from("party_pot").delete().eq("id", r.id)
    }
    if (raakt.length > 0) await klemPotDelenOp(potContribTotal - raakt.reduce((s2, r) => s2 + (r.amounts[id] || 0), 0))
    removePerson(id)
  }
  const removeLastPerson = () => { const last = people[people.length - 1]; if (!last) return; removePerson(last.id) }


  // ── Laden & live houden ─────────────────────────────────────────────────────
  // Eén select per tabel, enkel de kolommen die we tonen. Zelfde aanpak als Table:
  // realtime doet het echte werk, met een afkoelperiode zodat een reeks tikken
  // (iedereen bestelt tegelijk) niet tientallen herladingen uitlokt.
  // Welke groep laadden we het laatst? Nodig om bij een échte groepswissel de modus
  // strikt opnieuw af te leiden — anders "plakt" uitgebreid aan de volgende groep.
  const laatsteGeladenGid = useRef<string | null>(null)
  const loadParty = useCallback(async (gid: string) => {
    const [{ data: g }, { data: pp }, { data: rr }, { data: ii }, { data: pt }] = await Promise.all([
      supabase.from("party_groups").select("id,name,invite_code,owner_id,pay,coin_value,deposit_on,deposit_value,deposit_unit,pot_on,pot_is_card,finalized,custom_drinks,coin_prices,settle,ordering_open,last_active,fq").eq("id", gid).single(),
      supabase.from("party_people").select("id,seat,name,claimed_by,self_joined,settle_with").eq("group_id", gid).order("seat"),
      supabase.from("party_rounds").select("id,seq,status,amount,pot_part,payers,gave_back,members,started_by,proposal,headcount").eq("group_id", gid).order("seq"),
      supabase.from("party_round_items").select("round_id,person_id,drink_key,qty").eq("group_id", gid),
      supabase.from("party_pot").select("id,seq,amounts,is_card,card_payers").eq("group_id", gid).order("seq"),
    ])
    if (!mounted.current) return
    if (g) {
      setGroupName(g.name || "")
      setInviteCode(g.invite_code)
      setOwnerDevice(g.owner_id)
      setPay("eur")   // coins komen later; wat er in de groep staat negeren we
      setCoinValue(Number(g.coin_value))
      setDepositOn(false)   // bekers komen later
      setDepositValue(Number(g.deposit_value))
      setDepositUnit(g.deposit_unit as "eur" | "coin")
      setPotIsCard(!!g.pot_is_card)
      setSettle(g.settle !== false)
    // Ook de keuzevlag meezetten: staat die op null, dan duikt "Kies je aanpak" opnieuw op
    // — bijvoorbeeld wanneer je een opgeslagen groep opent en daarna de QR opvraagt.
    setBpSettle(g.settle !== false)
      setCustomDrinks(((g.custom_drinks ?? []) as Custom[]))
      setCoinPrices(((g.coin_prices ?? {}) as Record<string, number>))
    }
    // Lege naam = vrije plaats. In de UI heet die "Gast N", zodat de bestaande
    // placeholder-logica ongemoeid blijft.
    // De modus "uitgebreid opnemen" stond nergens bewaard. Hij is uit de data af te
    // lezen — maar let op: óók snel opnemen heeft één persoon (de admin als stille
    // "Gast 1"), dus het criterium is "meer dan de admin, of een echte naam".
    // Binnen dezelfde groep (en na een refresh) enkel opwaarderen, zodat een verse
    // uitgebreid-setup nooit teruggeduwd wordt; bij een échte groepswissel strikt
    // afleiden, zodat de vlag niet aan de volgende (snel- of QR-)groep blijft plakken.
    const uitgebreidData = !!g && g.settle === false && ((pp || []).length >= 2 || (pp || []).some((r) => !!(r.name || "").trim()))
    const vorigeGid = laatsteGeladenGid.current
    laatsteGeladenGid.current = gid
    const fqVlag = !!(g as { fq?: boolean } | null)?.fq
    if (g && g.settle !== false) setOpNaam(false)
    else if (vorigeGid !== null && vorigeGid !== gid) setOpNaam(uitgebreidData && !fqVlag ? true : false)
    else if (uitgebreidData && !fqVlag) setOpNaam(true)
    if (vorigeGid !== null && vorigeGid !== gid) setFromQuick(false)
    if (fqVlag) setFromQuick(true)
    setGroepDatum((g as { last_active?: string } | null)?.last_active ?? null)
    setGroepDicht(!!(g as { finalized?: boolean } | null)?.finalized)
    setPeople((pp || []).map((r) => ({
      id: r.id, seat: r.seat,
      // named = de admin (of de gast zelf) gaf een echte naam. Een naamloze plaats
      // heet "Gast N", zodat de bestaande placeholder-logica blijft werken.
      named: !!(r.name || "").trim(),
      name: (r.name || "").trim() || `Gast ${r.seat}`,
      claimedBy: r.claimed_by, selfJoined: !!r.self_joined,
      settleWith: r.settle_with,
    })))

    // Drankjes per rondje uitsorteren: toegewezen in `orders`, de rest in `anon`.
    const perRound: Record<string, { orders: Assign; anon: Anon }> = {}
    for (const it of ii || []) {
      const b = (perRound[it.round_id] ??= { orders: {}, anon: {} })
      if (it.person_id) {
        (b.orders[it.drink_key] ??= {})[it.person_id] = it.qty
      } else {
        b.anon[it.drink_key] = it.qty
      }
    }

    const alle = (rr || []).map((r) => ({
      id: r.id as string, seq: r.seq as number, status: r.status as "open" | "pending" | "closed",
      orders: perRound[r.id]?.orders ?? {}, anon: perRound[r.id]?.anon ?? {},
      payers: (r.payers ?? {}) as Record<string, number>,
      amount: Number(r.amount ?? 0), potPart: Number(r.pot_part ?? 0),
      gaveBack: (r.gave_back ?? {}) as Record<string, number>,
      members: ((r.members ?? []) as string[]),
      startedBy: (r.started_by ?? null) as string | null,
      proposal: ((r.proposal ?? {}) as Proposal),
      headcount: Number(r.headcount ?? 2),
    }))

    // Het OPEN rondje is de mand; de rest is historiek.
    // Bestaat de kolom nog niet, dan gaat het bestellen open zodra er een rondje is — zo
    // blijft een installatie zonder die kolom gewoon werken.
    setOrderingOpen(g?.ordering_open === true || alle.length > 0)
    const open = alle.find((r) => r.status === "open") ?? null
    setOpenRoundId(open?.id ?? null)
    // De antwoorden van het lópende rondje. Dezelfde databankfuncties als het
    // herhaal-voorstel, maar dan op het open rondje — zo weet iedereen wie er niets wil
    // zonder dat we de bestaande herhaalstroom aanraken, want die kijkt naar het vórige
    // rondje en die twee botsen dus nooit.
    setOpenAnswers((open?.proposal?.answers ?? {}) as Record<string, "same" | "different" | "skip">)
    setStartedBy(open?.startedBy ?? null)
    setCart(open?.orders ?? {})
    setCartAnon(open?.anon ?? {})
    // Bekerwerk dat al ingevuld was, blijft staan bij een refresh of op een tweede toestel.
    if (open && Object.keys(open.gaveBack).length > 0) setGaveBackDraft(open.gaveBack)
    const gedaan = alle.filter((r) => r.status !== "open")
    setRounds(gedaan)
    setRoundNr(open ? open.seq : Math.max(1, gedaan.length))
    // Huidig aantal = dat van het laatst bekende rondje (open of laatste afgeronde). Zo
    // hervat een geladen groep met het juiste aantal, in plaats van opnieuw "ongekozen".
    const laatstBekend = open ?? gedaan[gedaan.length - 1]
    if (laatstBekend) setHeadcount(laatstBekend.headcount || 2)

    setPotRounds((pt || []).map((r) => ({
      id: r.id as string, seq: r.seq as number,
      amounts: (r.amounts ?? {}) as Record<string, number>,
    })))
    const kaart = (pt || []).find((r) => r.is_card)
    if (kaart) setCardPayers(((kaart.card_payers ?? []) as string[]))
    // Geef terug hoe "vol" de groep is, zodat de aanroeper kan beslissen waar je landt:
    // een verse groep zonder rondjes stuur je naar het bestelscherm, niet naar een lege hub.
    return { rondjes: gedaan.length, heeftOpen: !!open, heeftPending: alle.some((r) => r.status === "pending"), settle: g ? g.settle !== false : true }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Binnenkomen. Twee wegen:
  //   ?code=XXXXXX  -> een gast opent de uitnodiging
  //   geen code     -> de admin ververste of kwam terug. Zonder dit is hij bij een
  //                    simpele refresh zijn groep kwijt.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    const vorige = typeof window !== "undefined" ? localStorage.getItem("rundo_party_group") : null
    ;(async () => {
      if (code) {
        const { data, error } = await supabase.from("party_groups").select("id").eq("invite_code", code.toUpperCase()).maybeSingle()
        if (error || !data) { setNotice(L.badCode); setBooting(false); return }
        setGroupId(data.id)
        await loadParty(data.id)
        setBooting(false)
        return
      }
      // Derde weg: ?g=<groepsid> — het keuzescherm toont je opgeslagen groepen en
      // linkt hierheen. Eerst de lijst vers laden zodat rol (eigen/gast) en modus
      // kloppen vóór de routering; daarna de parameter uit de adresbalk halen, zodat
      // een refresh via het gewone sessieherstel loopt en niet blijft herspringen.
      const gLink = new URLSearchParams(window.location.search).get("g")
      if (gLink) {
        const lijst = await loadSavedGroups()
        try { window.history.replaceState(null, "", window.location.pathname) } catch { /* niets */ }
        await openSavedGroup(gLink, lijst)
        setBooting(false)
        return
      }
      // Verversen midden in een groep: terug naar waar je was.
      let sessie: { g?: string; v?: string; fq?: boolean } | null = null
      try { const rauw = sessionStorage.getItem("rundo_party_session"); if (rauw) sessie = JSON.parse(rauw) } catch { /* niets */ }
      if (sessie?.g) {
        const { data } = await supabase.from("party_groups").select("id").eq("id", sessie.g).maybeSingle()
        if (data) {
          setGroupId(sessie.g)
          const stand = await loadParty(sessie.g)
          if (sessie.fq) setFromQuick(true)
          // Waar je landt volgt uit de toestand, niet uit het opgeslagen schermnaam. Dat naam
          // alleen was te weinig: een hub of overzicht rekent op toestand die na een
          // verversing weg is, en dan hield je een lege pagina met alleen de kop over.
          //
          // Volgorde: een open rondje is je mand → bestelscherm. Een afgesloten maar nog
          // niet betaald rondje → het betaalscherm. Pas als er niets openstaat, mag het
          // opgeslagen scherm beslissen. De afrekenstappen blijven waar ze waren.
          const afrekenen = sessie.v === "payers" || sessie.v === "final" || sessie.v === "fairSetup" || sessie.v === "quickSettle" || sessie.v === "settings"
          if (afrekenen && sessie.v) setView(sessie.v as typeof view)
          else if (stand?.heeftOpen) setView("order")
          else if (stand?.heeftPending) {
            // Een bevestigd-maar-onbetaald rondje: bij Fair Split is "confirmed" het
            // juiste scherm, bij gewone rondjes (snel én uitgebreid) is dat de hub met
            // de betaalkaart — en die verschijnt enkel als het rondje "onafgehandeld" staat.
            if (stand.settle) setView("confirmed")
            else { setLastRoundHandled(false); setView("hub") }
          }
          else if (sessie.v) setView(sessie.v as typeof view)
          setBooting(false)
          return
        }
        try { sessionStorage.removeItem("rundo_party_session") } catch { /* niets */ }
      }
      if (vorige) {
        // Optie A: we openen de laatste groep NIET automatisch meer. Je landt op het
        // keuzescherm en kiest zelf: verdergaan met een opgeslagen groep, of een nieuwe
        // starten (eventueel in een andere modus). De groep blijft bestaan en verschijnt
        // in de opgeslagen-groepen-lijst. We checken enkel of hij nog bestaat; zo niet,
        // ruimen we de verwijzing op.
        const { data } = await supabase.from("party_groups").select("id").eq("id", vorige).maybeSingle()
        if (!data) localStorage.removeItem("rundo_party_group") // groep opgeruimd of gewist
      }
      setBooting(false)
    })()
  }, [loadParty])

  // Haal alle groepen op waar dit toestel bij hoort: zelf gemaakt (owner_id) of via QR
  // aan deelgenomen (een party_people-rij met claimed_by = dit toestel). We voegen ze
  // samen, ontdubbelen op id, en sorteren op recentheid (nieuwste eerst).
  const loadSavedGroups = useCallback(async () => {
    const dev = me.current
    const [eigen, gast] = await Promise.all([
      supabase.from("party_groups").select("id,name,last_active,finalized,owner_id,settle,pinned,fq").eq("owner_id", dev),
      supabase.from("party_people").select("group_id").eq("claimed_by", dev),
    ])
    const map = new Map<string, SavedGroup>()
    for (const g of eigen.data ?? []) {
      map.set(g.id, { id: g.id, name: g.name || "", last_active: g.last_active, finalized: !!g.finalized, owned: true, settle: g.settle !== false, pinned: !!g.pinned, uitgebreid: false, fq: !!(g as { fq?: boolean }).fq })
    }
    // Gast-groepen die nog niet als eigen bekend zijn, apart ophalen voor hun details.
    const gastIds = [...new Set((gast.data ?? []).map((r) => r.group_id as string))].filter((id) => !map.has(id))
    if (gastIds.length > 0) {
      const { data: extra } = await supabase.from("party_groups").select("id,name,last_active,finalized,settle,pinned,fq").in("id", gastIds)
      for (const g of extra ?? []) {
        map.set(g.id, { id: g.id, name: g.name || "", last_active: g.last_active, finalized: !!g.finalized, owned: false, settle: g.settle !== false, pinned: !!g.pinned, uitgebreid: false, fq: !!(g as { fq?: boolean }).fq })
      }
    }
    const lijst = [...map.values()].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return (b.last_active || "").localeCompare(a.last_active || "")
    })

    // Welke gewone-rondjes-groepen waren uitgebreid? Zelfde afleiding als bij het
    // laden van een groep: meer dan de stille admin, of een echte naam.
    const gewoonIds = lijst.filter((g) => !g.settle).map((g) => g.id)
    if (gewoonIds.length > 0) {
      const { data: pplData } = await supabase.from("party_people").select("group_id,name").in("group_id", gewoonIds)
      const telling: Record<string, { n: number; naam: boolean }> = {}
      for (const r of pplData ?? []) {
        const t = (telling[r.group_id as string] ??= { n: 0, naam: false })
        t.n += 1
        if ((r.name || "").trim()) t.naam = true
      }
      lijst.forEach((g) => { const t = telling[g.id]; if (t && (t.n >= 2 || t.naam)) g.uitgebreid = true })
    }

    const nu = Date.now()
    const tijd = (iso: string) => { const d = new Date(iso).getTime(); return isNaN(d) ? nu : d }

    // Stilgevallen groepen sluiten zichzelf af, zodat de lijst "Open" kort blijft.
    const sluiten = lijst.filter((g) => g.owned && !g.finalized && g.name !== TESTGROEP_NAAM && nu - tijd(g.last_active) > AUTO_SLUIT)
    if (sluiten.length > 0) {
      await supabase.from("party_groups").update({ finalized: true }).in("id", sluiten.map((g) => g.id))
      sluiten.forEach((g) => { g.finalized = true })
    }

    // Afgesloten, niet vastgezet en een maand oud: weg. Enkel je eigen groepen.
    const wissen = lijst.filter((g) => g.owned && g.finalized && !g.pinned && nu - tijd(g.last_active) > AUTO_WIS && keepUntil(g.id) <= nu)
    if (wissen.length > 0) {
      await supabase.from("party_groups").delete().in("id", wissen.map((g) => g.id))
    }
    const over = lijst.filter((g) => !wissen.some((w) => w.id === g.id))

    // Vastgezet maar een half jaar niet aangeraakt: voorstellen, niet beslissen.
    const stil = over.filter((g) => g.owned && g.pinned && g.name !== TESTGROEP_NAAM && nu - tijd(g.last_active) > PIN_STIL)

    if (mounted.current) { setSavedGroups(over); setStalePins(stil) }
    return over
  }, [])

  // Bij het openen (als je op het startscherm bent) de opgeslagen groepen laden.
  useEffect(() => {
    if (!booting && view === "start") loadSavedGroups()
  }, [booting, view, loadSavedGroups])

  // Vastzetten beschermt tegen het automatische opruimen. Maximaal vijf, zodat de pin
  // een keuze blijft en niet stilaan de hele lijst omvat.
  // Verlengde bewaartermijnen leven op dit toestel — logisch, want de automatische
  // opruiming draait ook hier (enkel op eigen groepen).
  const keepUntilMap = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem("rundo_keep_until") || "{}") } catch { return {} } }
  const keepUntil = (gid: string) => keepUntilMap()[gid] ?? 0
  const vraagVerlenging = (g: SavedGroup) => {
    if (g.pinned) {
      // Oude vastgezette groepen: die staan al "voor altijd" — hier kan je ze losmaken.
      setConfirmDlg({ msg: L.unpinMsg(g.name || L.autoName()), yes: L.pinOff, onYes: () => { setConfirmDlg(null); void togglePin(g) } })
      return
    }
    const verval = Math.max(Date.now(), new Date(g.last_active).getTime() + AUTO_WIS, keepUntil(g.id))
    const nieuw = verval + 30 * DAG
    const d = new Date(nieuw)
    setConfirmDlg({ msg: L.extendMsg(g.name || L.autoName(), `${d.getDate()}/${d.getMonth() + 1}`), yes: L.extendYes, onYes: () => {
      setConfirmDlg(null)
      try { localStorage.setItem("rundo_keep_until", JSON.stringify({ ...keepUntilMap(), [g.id]: nieuw })) } catch { /* niets */ }
      setSavedGroups((prev) => [...prev])
    } })
  }
  const togglePin = async (g: SavedGroup) => {
    if (!g.pinned && savedGroups.filter((x) => x.pinned).length >= MAX_PINS) { setNotice(L.maxPins(MAX_PINS)); return }
    const { error } = await supabase.from("party_groups").update({ pinned: !g.pinned }).eq("id", g.id)
    if (error) { setNotice("Vastzetten mislukt: " + error.message); return }
    setSavedGroups((prev) => prev.map((x) => x.id === g.id ? { ...x, pinned: !x.pinned } : x))
    setStalePins((prev) => prev.filter((x) => x.id !== g.id))
  }

  // ── Vaste testgroep ────────────────────────────────────────────────

  // Één groep die altijd in de lijst staat, met een avond die al iets voorstelt:
  // vier namen, een pot van €40, en twee afgeronde rondjes van vijf drankjes — het
  // eerste met een bedrag maar zonder betaler, het tweede volledig uit de pot. Zo heb
  // je meteen één open en één gedekt rondje om de afreken- en toewijsschermen te testen.
  // Vastgezet, zodat het automatische opruimen hem laat staan.
  const testGroep = savedGroups.find((g) => g.owned && g.name === TESTGROEP_NAAM) ?? null

  const maakTestgroep = async () => {
    if (busy) return
    setBusy(true)
    const stuk = (waar: string, msg?: string) => { setNotice(`Testgroep — ${waar} mislukt: ${msg ?? "onbekende fout"}`); setBusy(false) }

    // Bestond hij al, dan eerst weg: "opnieuw opzetten" moet een schone lei geven.
    if (testGroep) await supabase.from("party_groups").delete().eq("id", testGroep.id)
    const { data: g, error } = await supabase.from("party_groups")
      .insert([{ name: TESTGROEP_NAAM, invite_code: makeCode(), owner_id: me.current, settle: false, pinned: true }])
      .select("id").single()
    if (error || !g) { stuk("groep aanmaken", error?.message); return }
    const gid = g.id as string

    // Vier personen met een naam, zodat de schermen niet vol "Gast 3" staan.
    const ids: string[] = []
    for (const naam of ["Erent", "Eva", "Ilke", "Yelte"]) {
      const { data: pid, error: eP } = await supabase.rpc("party_add_person", { p_group: gid, p_name: naam })
      if (eP || !pid) { stuk(`persoon ${naam}`, eP?.message); return }
      ids.push(pid as string)
    }
    const { error: eClaim } = await supabase.from("party_people").update({ claimed_by: me.current }).eq("id", ids[0])
    if (eClaim) { stuk("plaats claimen", eClaim.message); return }

    // Een pot van €40 op de groep (niet op namen) — dat is hoe snelle rondjes hem kent,
    // en meteen de toestand waarin het toewijzen op het betaalscherm nog moet gebeuren.
    const { error: ePot } = await supabase.rpc("party_add_pot", { p_group: gid, p_amounts: { pot: 40 }, p_is_card: false, p_payers: [] })
    if (ePot) { stuk("pot", ePot.message); return }

    // Twee afgeronde rondjes van vijf drankjes. De drankjes hangen aan niemand — dat is
    // precies wat snelle rondjes doet, en het laat je de toewijzing zelf doorlopen.
    // Rondje 1: bedrag ingevuld, niemand betaalde → blijft openstaan.
    // Rondje 2: volledig uit de pot betaald → staat gedekt.
    const rondjes: { drankjes: { key: string; n: number }[]; bedrag: number; uitPot: number }[] = [
      { drankjes: [{ key: "pintje", n: 2 }, { key: "duvel", n: 1 }, { key: "gin-tonic", n: 1 }, { key: "coca-cola", n: 1 }], bedrag: 25.60, uitPot: 0 },
      { drankjes: [{ key: "pintje", n: 3 }, { key: "coca-cola", n: 2 }], bedrag: 15.60, uitPot: 15.60 },
    ]
    for (const r of rondjes) {
      const { data: rid, error: eR } = await supabase.rpc("party_open_round", { p_group: gid, p_starter: null })
      if (eR || !rid) { stuk("rondje openen", eR?.message); return }
      for (const it of r.drankjes) {
        const { error: eB } = await supabase.rpc("party_bump", { p_group: gid, p_round: rid, p_person: null, p_drink: it.key, p_delta: it.n })
        if (eB) { stuk(`drankje ${it.key}`, eB.message); return }
      }
      const { error: eC } = await supabase.from("party_rounds").update({
        status: "closed", closed_at: new Date().toISOString(),
        amount: r.bedrag, pot_part: r.uitPot, payers: {}, headcount: 4, members: ids,
      }).eq("id", rid)
      if (eC) { stuk("rondje afsluiten", eC.message); return }
    }

    await loadSavedGroups()
    setBusy(false)
    await openSavedGroup(gid)
  }

  // Een opgeslagen groep heropenen vanaf het startscherm.
  const openSavedGroup = async (id: string, bron?: SavedGroup[]) => {
    setBusy(true)
    localStorage.setItem("rundo_party_group", id)
    setGroupId(id)
    const res = await loadParty(id)
    setBusy(false)
    setResumeGroupId(null)
    // Deze groep bestaat al: de aanpak is ooit gekozen en de startinstellingen staan erop.
    // Zonder dit dook "Kies je aanpak" opnieuw op zodra je iets deed dat dat venster opent.
    setOnboardedOnce(true)
    if (res && res.rondjes === 0 && !res.heeftOpen) {
      // Verse groep: nog nooit een rondje. Vroeger stuurden we je terug naar de keuzekaders
      // om de modus te (her)bevestigen — maar die staat al op de groep, dus dat was een
      // extra tik om te bevestigen wat je al gekozen had. Nu ga je meteen naar de plek waar
      // je bij een nieuwe groep ook belandt: de namenstap bij Fair Split, het bestelscherm
      // bij snelle rondjes.
      // Behalve als je gast bent: de setup is het inrichtscherm van de admin. Een gast
      // hoort in de hub — die past zich vanzelf aan de rol aan.
      const eigen = (bron ?? savedGroups).find((x) => x.id === id)?.owned ?? true
      setSettle(res.settle)
      if (!eigen) setView("hub")
      else if (res.settle) setView("setup")
      else { setActiveCat(catsPresent[0]); setView("order") }
    } else if (res) {
      const sg = (bron ?? savedGroups).find((x) => x.id === id)
      const eigen = sg?.owned ?? true
      // Een afgesloten avond open je om het resultaat te zien: meteen de eindbalans,
      // niet eerst het overzicht. Een open avond landt zoals voorheen.
      if (sg?.finalized) { setHasSettled(true); setView("final"); return }
      // Gewone rondjes (snel én uitgebreid), eigen groep met geschiedenis: land waar
      // de avond staat.
      //  - Staat er nog een rondje open → gewoon verder bestellen.
      //  - Zijn er afgesloten rondjes → het rondjesoverzicht: dat toont in één blik wat
      //    er al genoteerd is — beter dan een kale hub met alleen knoppen. De hub had
      //    hier toch niets te melden: zijn betaalkaart hoort bij het nét afgesloten
      //    rondje, en toewijzen komt pas bij het afrekenen.
      // Fair Split houdt de hub (gasten, QR, plaatsen leven daar), en een gast landt
      // altijd in de hub — die past zich aan de rol aan.
      if (eigen && !res.settle) {
        if (res.heeftOpen) { setActiveCat(catsPresent[0]); setView("order") }
        else { setFillMode(false); setOverviewBackTo("hub"); setView("roundsOverview") }
      } else {
        // De hub toont de kaart van het laatste rondje — maar alleen als dat rondje ook
        // aangewezen is. Elke andere weg naar de hub doet dat al; deze landing vergat
        // het, en dat gaf de kale hub zonder besteld-kaart.
        if (res.rondjes > 0) setOpenRound(res.rondjes - 1)
        setView("hub")
      }
    } else {
      setView("hub")
    }
  }

  // Een eigen opgeslagen groep verwijderen (met bevestiging). Cascade in de database
  // ruimt de rondjes, drankjes, personen en pot mee op.
  // Alles wissen in één keer. Bewaarde groepen zitten er niet bij — die selectie gebeurt
  // in de lijst — en een mislukking op één groep mag de rest niet tegenhouden.
  const wisAlleGroepen = async (lijst: SavedGroup[]) => {
    let mislukt = 0
    for (const g of lijst) {
      const { error } = await supabase.from("party_groups").delete().eq("id", g.id)
      if (error) { mislukt++; continue }
      if (localStorage.getItem("rundo_party_group") === g.id) localStorage.removeItem("rundo_party_group")
    }
    setSavedGroups((prev) => prev.filter((x) => !lijst.some((g) => g.id === x.id && !mislukt)))
    await loadSavedGroups()
    if (mislukt > 0) setNotice(L.wipeSomeFailed(mislukt))
  }

  const deleteSavedGroup = (g: SavedGroup) => {
    setConfirmDlg({
      msg: L.delGroupConfirm(g.name || L.autoName()),
      yes: L.delGroupYes, no: L.cancel, variant: "danger",
      // Zonder eigen tekst zou hier "Terug, rondje afmaken" staan — dat slaat nergens op
      // wanneer je een groep wist.
      onYes: async () => {
        setConfirmDlg(null)
        const { error } = await supabase.from("party_groups").delete().eq("id", g.id)
        if (error) { setNotice("Verwijderen mislukt: " + error.message); return }
        if (localStorage.getItem("rundo_party_group") === g.id) localStorage.removeItem("rundo_party_group")
        setSavedGroups((prev) => prev.filter((x) => x.id !== g.id))
      },
    })
  }

  // Realtime, met twee zuinigheidsmaatregelen — een feest van 8 mensen met telefoons
  // in de broekzak mag geen quota opeten.
  //
  //  1. AFKOELEN: het eerste seintje halen we meteen op (voelt instant), daarna
  //     bundelen we 600 ms. Terwijl iedereen zit te tikken zou elke telefoon anders
  //     tientallen keren per minuut de hele groep herladen.
  //
  //  2. SLAAPSTAND: ligt de telefoon in de zak (tab verborgen), dan sluiten we het
  //     kanaal na 2 minuten. Bij terugkeer heropenen we en halen we één keer alles op.
  //     Zonder dit blijven acht slapende telefoons de hele avond meeluisteren.
  useEffect(() => {
    if (!groupId) return
    const SLAAP_MS = 3 * 60 * 1000
    laatsteActie.current = Date.now()
    setSlaapt(false)
    // Een lange setTimeout wordt door de browser gepauzeerd zodra het scherm op slot gaat,
    // dus meten we met een tijdstempel plus een korte interval. Terugkeren naar het tabblad
    // hervat bewust niet vanzelf: dan blijft de melding zichtbaar en weet je waarom het stil lag.
    const kijk = () => {
      if (wachtOpScans.current) { laatsteActie.current = Date.now(); return }
      if (Date.now() - laatsteActie.current >= SLAAP_MS) setSlaapt(true)
    }
    const wakker = () => {
      // Bijwerken zodra je terug bent: tijdens de slaapstand luistert de app niet mee,
      // dus je zou anders op het beeld van minuten geleden blijven staan.
      if (groupId) loadParty(groupId)
      setSlaapt(false)
    }
    const actief = () => {
      const sliep = Date.now() - laatsteActie.current >= SLAAP_MS
      laatsteActie.current = Date.now()
      if (sliep) wakker()
      else setSlaapt((a) => (a ? false : a))
    }
    const zichtbaar = () => { if (document.visibilityState === "visible") { laatsteActie.current = Date.now(); wakker() } }
    document.addEventListener("visibilitychange", zichtbaar)
    const evts: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"]
    evts.forEach((e) => window.addEventListener(e, actief, { passive: true }))
    const iv = setInterval(kijk, 20 * 1000)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", zichtbaar)
      evts.forEach((e) => window.removeEventListener(e, actief))
    }
  }, [groupId])

  useEffect(() => {
    if (!groupId || slaapt) return
    let active = true, cooling = false, pending = false
    let cool: ReturnType<typeof setTimeout> | null = null
    let slaap: ReturnType<typeof setTimeout> | null = null
    let ch: ReturnType<typeof supabase.channel> | null = null

    const reload = () => {
      if (!active) return
      if (cooling) { pending = true; return }
      cooling = true
      loadParty(groupId)
      cool = setTimeout(() => { cooling = false; if (pending) { pending = false; reload() } }, 600)
    }

    const open = () => {
      if (ch) return
      ch = maakKanaal()
    }
    const sluit = () => {
      if (!ch) return
      supabase.removeChannel(ch)
      ch = null
    }
    const zichtbaar = () => {
      if (slaap) { clearTimeout(slaap); slaap = null }
      if (document.visibilityState === "visible") {
        open()
        reload()            // bijwerken wat we misten terwijl we sliepen
      } else {
        slaap = setTimeout(sluit, 120000)
      }
    }
    document.addEventListener("visibilitychange", zichtbaar)

    const maakKanaal = () => {
      const c = supabase.channel(`party-${groupId}`)
      // Korte tekstmeldingen van andere deelnemers (annulaties e.d.).
      c.on("broadcast", { event: "melding" }, (msg) => { const t = (msg as { payload?: { tekst?: string } }).payload?.tekst; if (t) setNotice(t) })
      c.on("broadcast", { event: "voorJou" }, (msg) => {
        const p = (msg as { payload?: { voor?: string; tekst?: string } }).payload
        if (p?.tekst && p.voor && p.voor === meIdRef.current) setNotice(p.tekst)
      })
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_groups", filter: `id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_people", filter: `group_id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_rounds", filter: `group_id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_round_items", filter: `group_id=eq.${groupId}` }, reload)
      c.on("postgres_changes", { event: "*", schema: "public", table: "party_pot", filter: `group_id=eq.${groupId}` }, reload)
      c.subscribe()
      kanaalRef.current = c
      return c
    }

    open()
    return () => {
      active = false
      if (cool) clearTimeout(cool)
      if (slaap) clearTimeout(slaap)
      document.removeEventListener("visibilitychange", zichtbaar)
      sluit()
    }
  }, [groupId, loadParty, slaapt])

  // "verder" in het waar-was-je-gebleven-venster: gewoon die groep openen — een
  // gastgroep opent als gast (openSavedGroup routeert naar de juiste weergave).
  const geblevenVerder = (id: string) => {
    setWaarGebleven(null)
    void openSavedGroup(id)
  }

  // "Nieuwe groep starten": doorstarten in de gekozen modus, met de automatische
  // naam stil doorgeteld als die al bestaat.
  const geblevenNieuw = () => {
    if (!waarGebleven) return
    const wilSettle = waarGebleven.wilSettle
    setWaarGebleven(null)
    void createGroup(undefined, wilSettle, true)
  }

  // ── Groep aanmaken (admin) ──────────────────────────────────────────────────
  const createGroup = async (fallbackNaam?: string, wilSettle: boolean = true, skipClash = false) => {
    // Geen naam meer nodig bij de start: leeg laten valt terug op "Rondje + datum".
    // De naam blijft achteraf aanpasbaar via ⚙️ Groep.
    const getypt = groupName.trim() || fallbackNaam?.trim() || ""
    // De automatische naam draagt de modus mee: "Rondje …" voor gewone rondjes,
    // "QR-rondje …" voor Fair Split. Zo botsen naamloze groepen van verschillende
    // modi op dezelfde dag nooit — en verschijnt er dus ook geen "(2)" in je lijst.
    let naam = getypt || (wilSettle ? L.autoNameQr() : L.autoName())
    // Naamloos starten terwijl er in déze modus nog groepen openstaan? Dan eerst het
    // "waar was je gebleven?"-venster: een lijstje om verder te gaan, of bewust een
    // nieuwe groep beginnen. Wie zelf een naam typte wil duidelijk iets nieuws en
    // start meteen. De andere modus telt nooit mee — die keuze is zelf al het antwoord.
    if (!skipClash && !getypt) {
      const open = savedGroups.filter((g) => !g.finalized && g.settle === wilSettle)
        .sort((a, b) => (b.last_active || "").localeCompare(a.last_active || ""))
      if (open.length > 0) {
        setWaarGebleven({ groepen: open, wilSettle })
        return
      }
    }
    // Namen blijven uniek in de lijst: bestaat de (auto)naam al — open of afgesloten,
    // eender welke modus — dan telt hij stil door naar "(2)".
    // Dubbele namen mogen: elke groep heeft intern zijn eigen nummer, en de lijst
    // toont de datum ernaast. Nooit meer "(2)"-telwoorden.
    if (busy) return
    setBusy(true)
    // Botsende codes zijn zeldzaam, maar niet onmogelijk (unique index vangt ze).
    for (let poging = 0; poging < 5; poging++) {
      const code = makeCode()
      const { data, error } = await supabase.from("party_groups")
        .insert([{ name: naam, invite_code: code, owner_id: me.current, settle: wilSettle }])
        .select("id,invite_code").single()
      if (!error && data) {
        localStorage.setItem("rundo_party_group", data.id)
        setGroupId(data.id)
        setInviteCode(data.invite_code)
        setOwnerDevice(me.current)
        // De admin maakte de groep en zit dus aan tafel: meteen Gast 1, geclaimd door
        // dit toestel. Zo hoeft de admin zichzelf niet meer aan te duiden ("welke ben
        // jij?" verdwijnt voor hem), en telt hij gewoon mee als persoon. Drinkt hij
        // niets, dan staat hij op nul — net als ieder ander die niets nam.
        const { data: pid } = await supabase.rpc("party_add_person", { p_group: data.id, p_name: "" })
        if (pid) await supabase.from("party_people").update({ claimed_by: me.current }).eq("id", pid as string)
        setBusy(false)
        // Gewoon rondjes heeft geen personen-setup nodig — meteen naar bestellen.
        // Fair Split gaat wél eerst langs de setup (personen, QR).
        if (!wilSettle) {
          setActiveCat(catsPresent[0])
          setView("order")
        } else {
          setView("setup")
        }
        loadParty(data.id)
        return
      }
      if (error && !/duplicate|unique/i.test(error.message)) {
        setNotice("Groep aanmaken mislukt: " + error.message); setBusy(false); return
      }
    }
    setNotice(L.createFailed)
    setBusy(false)
  }

  // Nieuwe start-flow: op het startscherm kies je EERST de aanpak (Fair Split of gewoon
  // rondjes) en de groepsnaam, en "Starten" doet allebei. De modus gaat mee in de insert
  // (createGroup), niet via persistSettings — de groep bestaat op dit punt nog niet.
  // De modus komt nu van de knop zelf mee: elke modus heeft z’n eigen startknop, en
  // setBpSettle is nog niet doorgevoerd op het moment dat we hier binnenkomen.
  const startWithMode = async (fallbackNaam?: string, modus?: boolean) => {
    // De keuze snel-of-op-naam staat al op het keuzescherm; het losse venster erna is
    // daardoor overbodig geworden.
    // Eén zelf-noteer-modus: namen zijn overal optioneel, dus het onderscheid
    // snel/uitgebreid bestaat niet meer. modus === false = zelf noteren, true = QR.
    if (modus === false) { setOpNaam(true); setNamenSetup(false) }
    else if (modus === true) { setOpNaam(false); setNamenSetup(false) }
    const keuze = modus ?? bpSettle
    if (keuze === null || keuze === undefined) return
    const wilSettle = keuze === true
    // Geen naam of aantal personen meer vragen bij de start: je duikt meteen in de
    // drankjes. De naam valt terug op "Rondje + datum", het aantal leidt de app later
    // zelf af uit de bestelde drankjes (en blijft aanpasbaar in het rondjesoverzicht).
    setOnboardedOnce(true)
    if (!wilSettle) {
      setSettle(false)
      setPotChosen(false); setDepositOn(false); setPay("eur")
    } else {
      setSettle(true)
    }
    // Hervat je een bestaande verse groep? Dan de modus op die groep bijwerken en er
    // meteen in duiken — geen nieuwe groep aanmaken.
    if (resumeGroupId) {
      setSettle(wilSettle)
      const naam = groupName.trim()
      await supabase.from("party_groups").update({ settle: wilSettle, ...(naam ? { name: naam } : {}), last_active: new Date().toISOString() }).eq("id", resumeGroupId)
      const rid = resumeGroupId
      setResumeGroupId(null)
      if (!wilSettle) { setActiveCat(catsPresent[0]); setView("order") }
      else setView("setup")
      loadParty(rid)
      return
    }
    await createGroup(fallbackNaam, wilSettle)
  }

  // Een plaats vrijgeven. Nodig als iemand op de verkeerde naam tikte, of als de
  // admin een plaats wil doorgeven. De naam blijft staan — enkel de koppeling met
  // het toestel verdwijnt.
  const releaseSeat = async (personId: string) => {
    const { error } = await supabase.from("party_people")
      .update({ claimed_by: null, self_joined: false }).eq("id", personId)
    if (error) { setNotice("Vrijgeven mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }

  // Een plaats claimen: de gast (of de admin) zegt "dit ben ik".
  // Laatkomer: groep is vol, dus we zetten in Postgres een plaats bij en claimen ze
  // meteen (party_join_new_seat, onder slot). Daarna gedraagt de gast zich als elke
  // andere aangemelde persoon.
  const joinAsLatecomer = async (naam: string) => {
    if (!groupId) return
    if (!naam.trim()) { setNotice(L.fillNameFirst); return }
    setBusy(true)
    const { data, error } = await supabase.rpc("party_join_new_seat", { p_group: groupId, p_device: me.current, p_name: naam.trim() })
    setBusy(false)
    if (error || !data) { setNotice("Aansluiten mislukt: " + (error?.message ?? "")); return }
    loadParty(groupId)
  }

  const joinPot = async (bedrag: number) => {
    if (!groupId || !meId || bedrag <= 0.005) return
    const { error } = await supabase.from("party_pot")
      .insert({ group_id: groupId, seq: potRounds.length + 1, amounts: { [meId]: Math.round(bedrag * 100) / 100 }, is_card: false })
    if (error) { setNotice("Inleggen mislukt: " + error.message); return }
    loadParty(groupId)
    const naam = people.find((pp) => pp.id === meId)?.name ?? ""
    try { void kanaalRef.current?.send({ type: "broadcast", event: "melding", payload: { tekst: L.joinedPot(naam, euro(bedrag)) } }) } catch { /* niets */ }
  }
  const claimSeat = async (personId: string, naam: string) => {
    if (busy) return
    setBusy(true)
    // Voorwaarde op claimed_by: wie een halve seconde te laat is, krijgt netjes
    // te horen dat de plaats net weg is, in plaats van iemand te overschrijven.
    const { data, error } = await supabase.from("party_people")
      .update({ name: naam.trim(), claimed_by: me.current, self_joined: !isAdmin })
      .eq("id", personId).is("claimed_by", null).select("id")
    setBusy(false)
    if (error) { setNotice("Aanmelden mislukt: " + error.message); return }
    if (!data || data.length === 0) { setNotice(L.seatTaken); return }
    if (groupId) loadParty(groupId)
    if (!isAdmin && potContribTotal > 0.005) {
      const eigen = potRounds.reduce((t, r) => t + (r.amounts[personId] || 0), 0)
      if (eigen <= 0.005) {
        // Het bedrag dat de meesten legden is een eerlijker voorstel dan het
        // gemiddelde: één grote inleg zou dat anders scheeftrekken.
        const per: number[] = []
        people.forEach((pp) => { const a = potRounds.reduce((t, r) => t + (r.amounts[pp.id] || 0), 0); if (a > 0.005) per.push(Math.round(a * 100) / 100) })
        const telling = new Map<number, number>()
        per.forEach((v) => telling.set(v, (telling.get(v) || 0) + 1))
        let voorstel = per.length ? [...telling.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0])[0][0] : 0
        if (!voorstel) voorstel = Math.round((potContribTotal / Math.max(1, people.length)) * 100) / 100
        setPotVraagBedrag(voorstel.toFixed(2).replace(".", ","))
        setPotVraagOpen(false)
        setPotVraag({ voorstel })
      }
    }
  }
  const setEveryoneAmt = (v: number) => setPotDraft(Object.fromEntries(people.map((p) => [p.id, v])))
  const resetPotDraft = () => { setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft("") }
  // Een inleg meteen wegschrijven en de pot herladen. Apart van closePot, zodat het
  // opslaan niet afhangt van het sluiten van het venster.
  const saveQuickPot = async () => {
    const totaal = settle ? potDraftTotal : potPerMan * potHoofden
    if (totaal <= 0.001) { meldPot(L.potFillAmount); return }
    if (!groupId) return
    const bedragen = settle ? potDraft
      : opNaam === true ? Object.fromEntries(people.map((pp) => [pp.id, potPerMan]))
      : { pot: totaal }
    const { error } = await supabase.rpc("party_add_pot", { p_group: groupId, p_amounts: bedragen, p_is_card: potIsCard, p_payers: cardPayers })
    if (error) { meldPot("Inleg opslaan mislukt: " + error.message); return }
    setEditDraft((c) => (c && c.bron === "self") ? { ...c, bron: "pot", potAmt: c.amount } : c)
    setPotDraft({}); setPotPerMan(0); setEveryoneChoice(null); setEveryoneDraft("")
    setPotBuilderOpen(false)
    setPotJustAdded(true)
    await loadParty(groupId)
  }
  const closePot = () => {
    const added = (editPotId === null && potDraftTotal > 0.001) ? potDraftTotal : 0
    if (added > 0 && groupId) {
      supabase.rpc("party_add_pot", { p_group: groupId, p_amounts: potDraft, p_is_card: potIsCard, p_payers: cardPayers })
        .then(({ error }) => { if (error) meldPot("Inleg opslaan mislukt: " + error.message); else loadParty(groupId) })
    }
    if (added > 0) setEditDraft((c) => (c && c.bron === "self") ? { ...c, bron: "pot", potAmt: c.amount } : c)
    setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setEditPotId(null); setPotBuilderOpen(false); setShowPot(false)
    if (onbPotActive) {
      setOnbPotActive(false)
      setSettingsBackTo("hub")
      const willHave = potContribTotal + added
      if (potChosen && willHave <= 0.005) {
        setConfirmDlg({ msg: L.potNothingIn(potIsCard), yes: L.anywayWithout(potIsCard), onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("settings") }, onNo: () => { setConfirmDlg(null); setShowPot(true); setOnbPotActive(true) } })
        return
      }
      setView("settings")
    }
  }
  const applyCard = (ids: string[], valStr: string) => { const val = parseFloat((valStr || "").replace(",", ".")) || 0; const d: Record<string, number> = {}; if (val > 0 && ids.length > 0) { const per = val / ids.length; ids.forEach((id) => (d[id] = per)) } setPotDraft(d); setEveryoneChoice(null) }
  const toggleCardPayer = (id: string) => { const next = cardPayers.includes(id) ? cardPayers.filter((x) => x !== id) : [...cardPayers, id]; setCardPayers(next); applyCard(next, cardValue) }
  const cardSelectAll = () => { const all = people.map((p) => p.id); setCardPayers(all); applyCard(all, cardValue) }
  const editPotRound = (id: string) => { const r = potRounds.find((x) => x.id === id); if (!r) return; setEditPotId(id); setPotDraft({ ...r.amounts }); setEveryoneChoice(null); setEveryoneDraft("") }
  const saveEditPot = () => {
    if (editPotId === null) return
    const oudeRonde = potRounds.find((x) => x.id === editPotId)
    const oudTot = oudeRonde ? Object.values(oudeRonde.amounts).reduce((a, b) => a + (b || 0), 0) : 0
    if (potDraftTotal > 0.001) {
      supabase.from("party_pot").update({ amounts: potDraft }).eq("id", editPotId)
        .then(({ error }) => { if (error) setNotice("Opslaan mislukt: " + error.message); else klemPotDelenOp(potContribTotal - oudTot + potDraftTotal).then(() => { if (groupId) loadParty(groupId) }) })
    } else {
      // Alles op nul gezet = de inleg-ronde bestaat niet meer.
      supabase.from("party_pot").delete().eq("id", editPotId)
        .then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message); else klemPotDelenOp(potContribTotal - oudTot).then(() => { if (groupId) loadParty(groupId) }) })
    }
    setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setPotBuilderOpen(false)
  }
  const cancelEditPot = () => { setEditPotId(null); setPotDraft({}); setEveryoneChoice(null); setEveryoneDraft(""); setPotBuilderOpen(false) }
  const removePotRound = (id: string, label: string) => setConfirmDlg({ msg: L.removeContribConfirm(label), yes: L.yesCancel, onYes: () => {
    const weg = potRounds.find((r) => r.id === id)
    const wegTot = weg ? Object.values(weg.amounts).reduce((a, b) => a + (b || 0), 0) : 0
    supabase.from("party_pot").delete().eq("id", id).then(({ error }) => { if (error) setNotice("Verwijderen mislukt: " + error.message); else klemPotDelenOp(potContribTotal - wegTot).then(() => { if (groupId) loadParty(groupId) }) })
    setPotRounds((rs) => rs.filter((r) => r.id !== id)); setConfirmDlg(null)
  } })
  // Zodra er een eigen drankje bestaat, springt ⭐ Eigen vooraan — dat is dan de
  // categorie die je zelf hebt aangemaakt en dus het eerst zoekt. Zolang ze leeg is,
  // blijft ze achteraan staan en duwt ze de gewone lijst niet opzij.
  const heeftEigen = drinks.some((d) => d.cat === "Eigen")
  const catOrde: Cat[] = heeftEigen ? ["Eigen", ...CATS.filter((c) => c !== "Eigen")] : CATS
  const catsPresent = catOrde.filter((c) => drinks.some((d) => d.cat === c))
  // Zet personen en namen terug zoals ze waren toen het venster openging.
  const herstelPersonen = () => {
    const snap = persSnap
    setPersSnap(null)
    if (!snap) return
    const oudId = new Set(snap.map((x) => x.id))
    people.forEach((pp) => {
      if (!oudId.has(pp.id)) {
        const heeftDrankjes = drinks.some((d) => (cart[d.id]?.[pp.id] ?? 0) > 0)
        if (!heeftDrankjes) removePerson(pp.id)
      }
    })
    snap.forEach((oud) => {
      const nu = people.find((pp) => pp.id === oud.id)
      if (nu && nu.name !== oud.name) renamePerson(oud.id, oud.name)
    })
  }
  const bewaarNaamPlicht = () => {
    const nm = naamPlichtVeld.trim()
    // Naam is optioneel: zonder naam sluiten we gewoon, de personen zijn al bewaard.
    if (!nm) { setNaamPlicht(false); setPersSnap(null); const na0 = naamPlichtNa; setNaamPlichtNa(null); if (na0) na0(); return }
    setGroupName(nm); persistSettings({ name: nm }); setNaamPlicht(false); setPersSnap(null)
    // Ging je ergens heen toen de naam gevraagd werd? Dan nu alsnog.
    const na = naamPlichtNa
    setNaamPlichtNa(null)
    if (na) na()
  }
  // Alles in een naamloze groep loopt hierlangs: is er nog geen echte naam, dan
  // eerst het naamvenster; anders meteen doen wat je wilde.
  const eersteNaamDan = (doe: () => void) => { doe() }
  const bump1 = (did: string) => {
    // Snel opnemen zonder echte groepsnaam: de tik wordt tegengehouden (dus nog níét
    // genoteerd) en het naamvenster verschijnt. Na "Verder" tik je gewoon opnieuw.
    if (voorWie && (settle || perPersoon)) return bump(did, voorWie, 1)
    return bumpAnon(did, 1)
  }
  // Een drankje in één tik volledig uit de lopende bestelling halen — zowel de nog niet
  // toegewezen exemplaren als die al aan iemand hingen.
  const clearDrink = async (did: string) => {
    const anon = cartAnon[did] ?? 0
    const perPersoon = Object.entries(cart[did] ?? {}).filter(([, n]) => (n || 0) > 0)
    setCartAnon((a) => ({ ...a, [did]: 0 }))
    setCart((c) => ({ ...c, [did]: {} }))
    const rid = await ensureRound()
    if (!rid || !groupId) return
    if (anon > 0) await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: null, p_drink: did, p_delta: -anon })
    for (const [pid, n] of perPersoon) {
      await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: pid, p_drink: did, p_delta: -(n || 0) })
    }
  }
  const bumpDown = (did: string) => {
    // In Fair Split haal je weg bij wie je op dat moment aantikt; anders eerst de nog
    // niet toegewezen exemplaren, dan de rest.
    if (voorWie && (settle || perPersoon)) { if ((cart[did]?.[voorWie] ?? 0) > 0) bump(did, voorWie, -1); return }
    if ((cartAnon[did] ?? 0) > 0) { bumpAnon(did, -1); return }
    const entry = cart[did]; if (!entry) return
    const pid = Object.keys(entry).find((k) => (entry[k] ?? 0) > 0); if (pid) bump(did, pid, -1)
  }
  const firstUnassigned = () => drinks.find((d) => (cartAnon[d.id] ?? 0) > 0)

  const dropUnpaidRound = () => {
    const last = rounds[rounds.length - 1]
    // Alleen een rondje dat nóg niemand aanging: zodra er drankjes in staan of iemand
    // anders het startte, blijft het. Anders verdween andermans werk bij het weglopen.
    const vanMij = !settle || !startedBy || startedBy === meId
    const leeg = !settle || drinks.every((d) => Object.values(cart[d.id] || {}).every((q) => (q || 0) === 0) && (cartAnon[d.id] ?? 0) === 0)
    if (last && !roundIsPaid(last) && vanMij && leeg) supabase.from("party_rounds").delete().eq("id", last.id).then(() => { if (groupId) loadParty(groupId) })
    if (openRoundId && vanMij && leeg) supabase.from("party_rounds").delete().eq("id", openRoundId).then(() => { if (groupId) loadParty(groupId) })
    setOpenRoundId(null)
    setRounds((rs) => (rs.length && !roundIsPaid(rs[rs.length - 1]) ? rs.slice(0, -1) : rs)); setCart({}); setCartAnon({}); setAmountDraft(""); setPayPot(false); setPayPersons([]); setPayAmts({}); setPotAmtDraft(""); setPaidConfirmed(false) }
  const goStart = () => { if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); setView("start") } }); else setView("start") }
  terugActie.current = () => {
    // Eerst één stap terug binnen de groep. Sta je al op het bestelscherm, dan pas naar
    // het startscherm — anders sprong je vanuit elke tussenpagina meteen naar buiten.
    // Snel opnemen: sta je op het bestelscherm terwijl er al rondjes zijn — bv. na
    // "Bestelling aanpassen" vanuit de hub — dan is één stap terug de hub. Vroeger viel
    // je hier door naar het startscherm met de keuzekaders, midden in je avond.
    if (view === "order" && !settle && rounds.length > 0) { setOpenRound(rounds.length - 1); setEditCups(false); setEditPay(false); setView("hub"); return }
    if (view === "settings") { setView(settingsBackTo === "order" ? "order" : "hub"); return }
    if (view === "roundsOverview") { setView(overviewBackTo === "order" ? "order" : overviewBackTo); return }
    if (view === "final" && opNaam === true) { terugNaarUitgebreid(); setOverviewBackTo("hub"); setView("roundsOverview"); return }
    if (view === "confirmed" || view === "quickSettle" || view === "payers" || view === "final") { setView("hub"); return }
    goStart()
  }
  // Naar het echte beginscherm van de site (waar je Rundo of Rundo Resto kiest). Bij een
  // onbevestigd rondje eerst waarschuwen, zodat je geen werk verliest.
  // Weggaan uit een naamloze groep: eerst vragen om een naam, want zonder naam
  // is de groep straks niet terug te vinden in de lijst.
  // Tabblad sluiten of wegnavigeren met de browserknop: de app kan dan geen eigen
  // venster meer tonen, dus laten we de browser zijn standaardwaarschuwing geven.
  // Een naamloze groep is altijd het waarschuwen waard: ook zonder drankjes kan er
  // al werk in zitten (namen, personen, pot) — en anders kost "toch weggaan" één tik.
  const heeftInhoud = !!groupId
  useEffect(() => {
    const naamloos = !settle && !!groupId && heeftInhoud && isAutoNaam(groupName)
    if (!naamloos) return
    const waarschuw = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", waarschuw)
    // De terugknop van de telefoon krijgt hetzelfde venster als het logo: we leggen
    // een extra stap in de geschiedenis en vangen het terugstappen op.
    const terug = () => {
      history.pushState(null, "", location.href)
      setVerlaatVeld((v) => v || L.autoName())
      setVerlaatNaam(() => () => { window.location.href = "/" })
    }
    history.pushState(null, "", location.href)
    window.addEventListener("popstate", terug)
    return () => { window.removeEventListener("beforeunload", waarschuw); window.removeEventListener("popstate", terug) }
  }, [settle, groupId, heeftInhoud, groupName]) // eslint-disable-line

  const verlaatMetNaamcheck = (doe: () => void) => {
    if (!settle && groupId && heeftInhoud && isAutoNaam(groupName)) { setVerlaatVeld((v) => v || L.autoName()); setVerlaatNaam(() => doe); return }
    doe()
  }
  const goSiteHome = () => {
    // Het logo brengt je naar het Party-startscherm — de keuzekaders plus je opgeslagen
    // groepen. Vroeger herlaadde dit de hele site-root: een lege pagina met alleen
    // koppen tot de chooser geladen was, en je was de app uit. Het startscherm wist de
    // sessie vanzelf (zie het sessie-effect), dus netjes uitstappen is gewoon: erheen.
    const ga = () => {
      // Telefoons zoomen in zodra een invoerveld met kleine letters focus krijgt en
      // laten die zoom stáán — na "Avond afsluiten" landde je dan ingezoomd op het
      // startscherm. Eerst het veld loslaten, dan de zoom heel even vergrendelen op
      // 1 en de viewport meteen weer vrijgeven.
      try {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
      } catch { /* niets */ }
      setView("start")
    }
    if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); ga() } })
    else ga()
  }
  const goHome = () => { setFromOnboarding(false); setSettingsBackTo(view === "order" ? "order" : view === "quickSettle" ? "quickSettle" : "hub"); if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); setView("settings") } }); else setView("settings") }
  const potAvailNow = () => { const curPotPart = rounds.length ? (rounds[rounds.length - 1].potPart || 0) : 0; return potContribTotal - (potSpent - curPotPart) }
  const paymentState = () => {
    const total = parseFloat(amountDraft.replace(",", ".")) || 0
    const potAvail = potAvailNow()
    const potAmt = parseFloat(potAmtDraft.replace(",", ".")) || 0
    const persons = payPersons
    const nPayers = persons.length + (payPot ? 1 : 0)
    const multi = nPayers > 1
    const amtOf = (pid: string) => parseFloat((payAmts[pid] || "").replace(",", ".")) || 0
    const personAmts: Record<string, number> = {}
    if (!multi && persons.length === 1) personAmts[persons[0]] = total
    else persons.forEach((pid) => (personAmts[pid] = amtOf(pid)))
    const potPart = payPot ? (multi ? potAmt : total) : 0
    const personSum = Object.values(personAmts).reduce((a, b) => a + b, 0)
    const sum = personSum + potPart
    const missing = total - sum
    const allFilled = !multi || (persons.every((pid) => (payAmts[pid] || "").trim() !== "") && (!payPot || potAmtDraft.trim() !== ""))
    const potOver = potPart > potAvail + 0.001
    let valid = true, reason = ""
    if (total <= 0) { valid = false; reason = "Vul eerst exact betaald bedrag in." }
    else if (nPayers === 0) { valid = false; reason = L.whoPaid }
    else if (payPot && potAvail <= 0.005) { valid = false; reason = L.potEmpty(potIsCard) }
    else if (potOver) { valid = false; reason = L.potTooLow(potIsCard, euro(Math.max(0, potAvail))) }
    else if (multi && !allFilled) { valid = false; reason = L.fillPerPayer }
    const tol = 0.005 + 0.01 * Math.max(0, nPayers - 1)
    const rounding = multi && Math.abs(missing) > 0.005 && Math.abs(missing) <= tol
    if (valid && multi && Math.abs(missing) > tol) { valid = false; reason = missing > 0 ? `Samen ${euro(sum)} van ${euro(total)} — er ontbreekt ${euro(missing)}.` : `Samen ${euro(sum)} van ${euro(total)} — ${euro(-missing)} te veel.` }
    return { total, potAmt, potPart, personAmts, personSum, sum, missing, multi, nPayers, potAvail, potOver, valid, reason, rounding }
  }
  // Verdeelt het rondjebedrag automatisch en exact (tot op de cent) over de gekozen betalers.
  // De laatste betaler krijgt de restcent, zodat de som altijd precies klopt.
  const autoSplit = (persons: string[], usePot: boolean, totalStr?: string) => {
    const total = Math.round(((parseFloat((totalStr ?? amountDraft).replace(",", ".")) || 0)) * 100)
    const n = persons.length + (usePot ? 1 : 0)
    if (total <= 0 || n === 0) { setPayAmts({}); setPotAmtDraft(usePot ? "" : ""); return }
    const availC = Math.max(0, Math.round(potAvailNow() * 100))
    let potC = 0
    if (usePot) potC = Math.min(Math.floor(total / n), availC)
    const restC = total - potC
    const perC = persons.length ? Math.floor(restC / persons.length) : 0
    const next: Record<string, string> = {}
    persons.forEach((pid) => (next[pid] = (perC / 100).toFixed(2)))
    setPayAmts(next)
    setPotAmtDraft(usePot ? (potC / 100).toFixed(2) : "")
    setPaidConfirmed(false)
  }
  const togglePayPerson = (pid: string) => { const next = payPersons.includes(pid) ? payPersons.filter((x) => x !== pid) : [...payPersons, pid]; setPayPersons(next); autoSplit(next, payPot); setPaidConfirmed(false) }
  const goHub = () => { const to = () => { setOpenRound(rounds.length - 1); setEditCups(false); setEditPay(false); setView("hub") }; if (view === "confirmed") setConfirmDlg({ variant: "danger", msg: L.unfinishedWarn, yes: L.leaveAnyway, onYes: () => { setConfirmDlg(null); dropUnpaidRound(); to() } }); else to() }
  // Instellingen van het feest wegschrijven. Zonder dit ziet een gast die scant de
  // verkeerde modus: euro's terwijl de rest met coins werkt, of geen waarborg.
  const persistSettings = (extra?: Record<string, unknown>) => {
    if (!groupId) return
    supabase.from("party_groups").update({
      name: groupName.trim(), pay, coin_value: coinValue,
      deposit_on: depositOn, deposit_value: depositValue, deposit_unit: depositUnit,
      pot_on: potChosen, pot_is_card: potIsCard, last_active: new Date().toISOString(), ...(extra ?? {}),
    }).eq("id", groupId).then(({ error }) => { if (error) setNotice("Instellingen opslaan mislukt: " + error.message) })
  }

  // Delen kan pas als de groep vaststaat: naam, aantal personen én de startvragen.
  // Zo kan er niemand ongevraagd bijkomen en blijft de groep even groot als de admin
  // aangaf — gasten claimen enkel een vrije plaats, ze maken er geen bij.
  // Het bestellen openzetten voor iedereen. Zonder rondje: wie wil halen drukt daarna
  // zelf op één van de twee knoppen.
  const noteerGevraagd = useRef<string | null>(null)

  const openBestellen = async () => {
    if (!groupId) return
    setOrderingOpen(true)
    const { error } = await supabase.from("party_groups").update({ ordering_open: true }).eq("id", groupId)
    if (error) { setNotice("Openen mislukt: " + error.message); loadParty(groupId) }
  }

  // Loopt er een rondje? Zonder dat kan er niets aangetikt worden — ook niet door de
  // beheerder, want anders start híj altijd het eerste rondje zonder het te weten.
  const bezig = !!openRoundId
  const canShare = settle && isAdmin && !!inviteCode && people.length > 0 && onboardedOnce
  // Staat de QR in beeld en is er nog een plaats vrij, dan wacht dit scherm op scans.
  wachtOpScans.current = canShare && view === "hub" && people.some((p) => !p.claimedBy)
  // Wie nam dit drankje? Kort achter de naam, zodat je in één oogopslag ziet voor wie je
  // aantikte — zeker handig wanneer je voor meerdere mensen noteert.
  const wieNam = (did: string) => {
    const per = cart[did] || {}
    return people.filter((pp) => (per[pp.id] ?? 0) > 0).map((pp) => (per[pp.id] > 1 ? `${pp.name} ×${per[pp.id]}` : pp.name)).join(", ")
  }

  // Het levende namenblok: kroonrij, groene ✅-rijen voor wie scande, de wachtende
  // plaatsen in kolommen (het raster kiest zelf 2, 3 of meer kolommen naar de ruimte)
  // en de tellende wacht-pill die groen wordt zodra iedereen binnen is. Wordt gedeeld
  // door het instelscherm en het QR-scherm, zodat je overal hetzelfde ziet vollopen.
  const renderNamenBlok = () => {
    // Geen plaatsen meer om te reserveren of vrij te geven: wie scant en zijn naam
    // invult, staat in de lijst. De admin kan iemand wegklikken met het kruisje.
    const mijnPlaats = people.find((p) => p.id === meId)
    const anderen = people.filter((p) => p.id !== meId)
    return (
      <>
        {mijnPlaats && (
          <div style={{ ...S.row, gap: 8, padding: "8px 11px", borderRadius: 10, marginBottom: 6, background: VLAK1, border: "1px solid rgba(13,124,140,0.22)" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: MODUS_FAIR.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><KroonIcoon size={14} kleur={MODUS_FAIR.tekst} /></span>
            <span style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mijnPlaats.name} <span style={{ color: MODUS_FAIR.tekst, fontWeight: 700 }}>({L.youWord})</span></span>
          </div>
        )}
        {anderen.map((p) => (
          <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 11px", borderRadius: 10, marginBottom: 6, background: "rgba(31,138,76,0.08)", border: "1px solid rgba(31,138,76,0.25)" }}>
            <span style={{ fontSize: 17.5, fontWeight: 700, color: "#1d2942", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.claimedBy ? "✅" : "✍️"} {p.name}</span>
            {isAdmin && (
              <button onClick={() => removePerson(p.id)} title={L.removeWord}
                style={{ flexShrink: 0, background: "#fff", border: "1px solid rgba(224,104,92,0.45)", color: "#c0554a", borderRadius: 8, padding: "4px 9px", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
            )}
          </div>
        ))}
        {anderen.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 15, color: "#5a8f99", fontWeight: 600 }}>{L.scanToJoin}</div>
        )}
      </>
    )
  }
  const renderShare = () => {
    if (!canShare) return null
    return (
      <>
      <div style={{ ...S.card, border: `1.5px solid ${MODUS_FAIR.randZacht}` }}>
        {/* De QR ís de uitnodiging: groot en centraal, meteen onder de kop. */}
        <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10, textAlign: "center" }}>{L.letGuestsScan}</h3>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "#fff", padding: 10, borderRadius: 14, border: "1px solid rgba(29,41,66,0.15)" }}>
            <QRCodeSVG value={inviteLink} size={148} bgColor="#ffffff" fgColor="#1d2942" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ ...S.btn, flex: 1, fontWeight: 800, padding: "12px 8px" }}
            onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(`${L.joinInviteShort(groupName)} ${inviteLink}`); setLinkGekopieerd(true); setTimeout(() => setLinkGekopieerd(false), 6000) } }}>
            {linkGekopieerd ? L.linkCopiedShort : L.copyLink}</button>
          <button onClick={async () => {
              const vrijP = people.find((p) => !p.claimedBy && p.id !== meId)
              if (vrijP) { setZitNaam({ id: vrijP.id, nr: people.indexOf(vrijP) + 1 }); return }
              if (!groupId) return
              const { data: pid } = await supabase.rpc("party_add_person", { p_group: groupId, p_name: "" })
              await loadParty(groupId)
              if (pid) setZitNaam({ id: pid as string, nr: people.length + 1 })
            }}
            style={{ ...S.btn, flex: 1, fontWeight: 800, padding: "12px 8px" }}>{L.addNonScanner}</button>
        </div>
        {/* De volledige link staat niet meer permanent in beeld: hij verschijnt alleen
            even als bevestiging na het kopiëren — mét de link in het klein, zodat je
            ziet wat er op je klembord kwam. */}
        {linkGekopieerd && (
          <div style={{ marginTop: 7, background: "rgba(31,138,76,0.1)", border: "1px solid rgba(31,138,76,0.3)", borderRadius: 10, padding: "9px 11px", fontSize: 15, color: "#1f6b3a", lineHeight: 1.45 }}>{L.pasteAndShare}</div>
        )}
        {/* Teller + het levende namenblok. Het groene "plaatsen vrij"-regeltje is weg:
            groen betekent voortaan alleen "binnen", het wachten vertelt de pill. */}
        <div style={{ borderTop: "1px dashed rgba(13,124,140,0.25)", marginTop: 13, paddingTop: 11 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942" }}>{L.whoIsInYet}</span>
          </div>
          {renderNamenBlok()}
        </div>
      </div>
      {/* De weg vooruit plakt onderaan en ademt zachtjes — onmiskenbaar dé volgende
          stap, zonder te schreeuwen. Pijl-in-cirkel in plaats van de bieremoji. */}
      <div style={{ position: "sticky", bottom: 10, zIndex: 5, marginTop: 4, marginBottom: 13 }}>
        <button className="rundo-adem" onClick={() => { void openBestellen(); setActiveCat(catsPresent[0]); setView("order") }}
          style={{ width: "100%", cursor: "pointer", border: "none", borderRadius: 14, padding: "13px 12px", color: "#fff", background: MODUS_FAIR.knop }}>
          <span style={{ display: "block", fontSize: 18.5, fontWeight: 800 }}>{L.startOrdering}</span>
          <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#d6f2f6", marginTop: 2 }}>{L.everyoneTapsNow}</span>
        </button>
      </div>
      </>
    )
  }
  // ── Eigen drankje ───────────────────────────────────────────────────────────
  const MAX_EIGEN_PERSOON = 5
  const MAX_EIGEN_GROEP = 20
  const eigenVanMij = customDrinks.filter((c) => c.by === me.current).length

  const addCustomDrink = async () => {
    const naam = ndName.trim()
    if (!naam) { setNotice(L.nameYourDrink); return }
    const prijs = parseFloat(ndPrice.replace(",", "."))
    // De richtprijs is niet optioneel: zonder prijs kan Fair Split dit drankje niet
    // wegen tegen de rest, en dan is de verdeling gewoon fout.
    if (!(prijs > 0)) { setNotice(L.needPrice); return }
    const sleutel = drinkKey(naam)
    if (drinks.some((d) => d.id === sleutel)) { setNotice(L.alreadyExists(naam)); return }
    if (!groupId) return

    const coins = coinDefault("Eigen", naam)

    const { error } = await supabase.rpc("party_add_drink", {
      p_group: groupId, p_key: sleutel, p_name: naam, p_cat: "Eigen",
      p_price: prijs, p_coins: coins, p_cup: true, p_by: me.current,
      p_max_person: MAX_EIGEN_PERSOON, p_max_group: MAX_EIGEN_GROEP,
    })
    if (error) {
      if (/PERSOON_VOL/.test(error.message)) setNotice(L.maxPerPerson(MAX_EIGEN_PERSOON))
      else if (/GROEP_VOL/.test(error.message)) setNotice(L.maxPerGroup(MAX_EIGEN_GROEP))
      else setNotice("Toevoegen mislukt: " + error.message)
      return
    }
    setNdName(""); setNdPrice(""); setShowAddDrink(false)
    setActiveCat("Eigen"); setDrinkSearch("")
    loadParty(groupId)
  }

  const removeCustomDrink = async (key: string, naam: string) => {
    if (!groupId) return
    const { error } = await supabase.rpc("party_remove_drink", { p_group: groupId, p_key: key })
    if (error) {
      // Een drankje dat al besteld is, mag niet weg: dan zouden er bestellingen naar
      // een onbestaand drankje wijzen en klopt de verdeling niet meer.
      if (/IN_GEBRUIK/.test(error.message)) setNotice(L.drinkInUse(naam))
      else setNotice("Verwijderen mislukt: " + error.message)
      return
    }
    loadParty(groupId)
  }

  const renderAddDrink = () => {
    if (!showAddDrink) return null
    const mijne = customDrinks.filter((c) => c.by === me.current)
    return (
      <div style={S.overlay} onClick={() => setShowAddDrink(false)}>
        <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>{L.ownDrinkTitle}</h3>
            <button onClick={() => setShowAddDrink(false)} style={{ border: "none", background: "none", fontSize: 21, cursor: "pointer", color: "#6b7484" }}>✕</button>
          </div>

          <div style={{ fontSize: 15.5, color: "#6b7484", marginBottom: 12, lineHeight: 1.5 }}>
            {L.ownDrinkIntro}
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 5 }}>{L.nameLabel}</div>
          <input value={ndName} onChange={(e) => setNdName(e.target.value)} placeholder={L.namePh}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 18, textAlign: "left", marginBottom: 12 }} />


          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 5 }}>{L.priceLabel}</div>
          <div style={{ fontSize: 14.5, color: "#6b7484", marginBottom: 6, lineHeight: 1.4 }}>
            {L.priceHint}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 21.5, fontWeight: 700, color: "#6b7484", flexShrink: 0 }}>€</span>
            <input value={ndPrice} onChange={(e) => setNdPrice(e.target.value)} inputMode="decimal" placeholder={L.pricePh}
              style={{ ...S.input, flex: 1, minWidth: 0, boxSizing: "border-box", fontSize: 18, textAlign: "left" }} />
          </div>


          <button style={{ ...S.btnP, width: "100%", opacity: ndName.trim() && ndPrice ? 1 : 0.5 }} onClick={addCustomDrink}>
            {L.addBtn}
          </button>
          <div style={{ fontSize: 14.5, color: "#6b7484", textAlign: "center", marginTop: 8 }}>
            {L.remaining(Math.max(0, MAX_EIGEN_PERSOON - eigenVanMij), MAX_EIGEN_PERSOON)}
          </div>

          {mijne.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(29,41,66,0.12)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{L.addedByYou}</div>
              <div style={{ fontSize: 14.5, color: "#6b7484", marginBottom: 9, lineHeight: 1.45 }}>{L.removeHint}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {mijne.map((c) => (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 10, background: VLAK1, border: "1px solid rgba(29,41,66,0.12)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, color: "#1d2942", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>⭐ {c.name}</span>
                    <span style={{ fontSize: 15.5, color: "#6b7484", fontWeight: 700, flexShrink: 0 }}>{euro(Number(c.price))}</span>
                    <button onClick={() => removeCustomDrink(c.key, c.name)} aria-label={L.removeWord}
                      style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 9, background: "#fff", border: "1px solid rgba(224,104,92,0.4)", color: "#c0554a", fontSize: 18, cursor: "pointer" }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Spraak (beta) ───────────────────────────────────────────────────────────
  // Bewust met een bevestigingsstap: spraakherkenning zit er geregeld naast, en niets
  // is vervelender dan drie tequila's in je rondje die je nooit besteld hebt.
  const startVoice = () => {
    type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void;
                onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Herkenner = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Herkenner) { setNotice(L.voiceUnsupported); return }

    const r = new Herkenner()
    r.lang = lang === "fr" ? "fr-BE" : "nl-BE"
    r.interimResults = false
    r.continuous = false
    setVoiceText(""); setVoiceHits([]); setVoiceOn(true); setVoiceOpen(true)

    r.onresult = (e) => {
      const tekst = e.results[0]?.[0]?.transcript ?? ""
      setVoiceText(tekst)
      setVoiceHits(parseSpraak(tekst, drinks))
    }
    r.onerror = (e) => {
      setVoiceOn(false)
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setNotice(L.voiceDenied)
    }
    r.onend = () => setVoiceOn(false)
    r.start()
  }

  // De verstane drankjes in de mand zetten. Een gast zet ze op zichzelf; de admin laat
  // ze onbekend, want hij spreekt voor de hele groep en wijst daarna toe.
  const applyVoice = async () => {
    for (const h of voiceHits) {
      const doel = (!isAdmin && meId) ? meId : (settle ? voorWie : null)
      if (doel) await bump(h.id, doel, h.qty)
      else await bumpAnon(h.id, h.qty)
    }
    setVoiceOpen(false); setVoiceHits([]); setVoiceText("")
  }

  const renderVoice = () => {
    if (!voiceOpen) return null
    return (
      <div style={S.overlay} onClick={() => { if (!voiceOn) setVoiceOpen(false) }}>
        <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><MicroIcoon size={19} kleur="#c98a00" /> {L.voiceBtn}</span>
            </h3>
            {!voiceOn && <button onClick={() => setVoiceOpen(false)} style={{ border: "none", background: "none", fontSize: 21, cursor: "pointer", color: "#6b7484" }}>✕</button>}
          </div>

          {/* Beta staat hier in plaats van als label op de knop: je leest het op het
              moment dat het ertoe doet. */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(240,165,0,0.13)", borderRadius: 9, padding: "7px 11px", fontSize: 14, color: "#8a5e0f", fontWeight: 700, marginBottom: 12 }}>
            <span style={{ background: "#c98a00", color: "#fff", borderRadius: 5, padding: "1px 5px", fontSize: 13, fontWeight: 800 }}>{L.voiceBeta.toUpperCase()}</span>
            {L.voiceNotPerfect}
          </div>
          {voiceOn ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(240,165,0,0.15)", marginBottom: 10 }}><MicroIcoon size={30} kleur="#c98a00" /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#c98a00" }}>{L.voiceListening}</div>
              <div style={{ fontSize: 15.5, color: "#6b7484", marginTop: 8 }}>{L.voiceSay}</div>
            </div>
          ) : (
            <>
              {voiceText && (
                <div style={{ background: VLAK1, border: "1px solid rgba(29,41,66,0.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div style={{ fontSize: 14.5, color: "#6b7484", marginBottom: 3 }}>{L.voiceHeard}</div>
                  <div style={{ fontSize: 17.5, fontStyle: "italic", color: "#4a5567" }}>&ldquo;{voiceText}&rdquo;</div>
                </div>
              )}

              {voiceHits.length === 0 ? (
                <div style={{ fontSize: 17, color: "#9aa3b2", textAlign: "center", padding: "10px 0 16px", lineHeight: 1.5 }}>
                  {L.voiceNothing}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {voiceHits.map((h) => (
                    <span key={h.id} style={{ ...S.pill, background: "rgba(31,138,76,0.1)", border: "1px solid rgba(31,138,76,0.3)", color: "#1f6b3a", fontSize: 17, padding: "5px 10px" }}>
                      {h.qty}× {h.name}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn, flex: 1, fontWeight: 800 }} onClick={startVoice}>{L.voiceRetry}</button>
                {voiceHits.length > 0 && (
                  <button style={{ ...S.btnP, flex: 2 }} onClick={applyVoice}>{L.voiceAdd}</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // De toog-lijst. Wie gaat halen wil geen lijst per persoon — hij wil weten wat hij
  // aan de barman moet zeggen. Totalen om te bestellen, namen om uit te delen.
  const renderBarList = () => {
    const r = rounds[rounds.length - 1]
    if (!r) return null
    const perDrank = drinks
      .map((d) => ({ d, n: Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0) }))
      .filter((x) => x.n > 0)
    if (perDrank.length === 0) return null

    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.45)" }}>
        {settle && <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10 }}>{L.barList}</h3>}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {perDrank.map(({ d, n }) => (
            <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0" }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{d.emoji} {d.name}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#c98a00" }}>{n}×</span>
            </div>
          ))}
        </div>
        {settle && (
        <div style={{ borderTop: "1px solid rgba(29,41,66,0.12)", marginTop: 10, paddingTop: 9 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#6b7484", marginBottom: 5 }}>{L.barHandOut}</div>
          <div style={{ fontSize: 16, color: "#4a5567", lineHeight: 1.6 }}>
            {people.map((p) => {
              const zijne = drinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
              if (zijne.length === 0) return null
              return <div key={p.id}><b>{p.name}:</b> {zijne.map((d) => `${r.orders[d.id][p.id] > 1 ? r.orders[d.id][p.id] + "× " : ""}${d.name}`).join(", ")}</div>
            })}
          </div>
        </div>
        )}
      </div>
    )
  }

  // Halverwege alsnog willen afrekenen. Kost niets: de rondjes en drankjes zijn in
  // beide modi identiek, en de Fair Split valt terug op de richtprijzen.
  const switchToSettle = () => {
    setSettle(true)
    persistSettings({ settle: true })
    setView("final")
  }

  // Gewoon rondjes: het bedrag dat verdeeld wordt is de som van alle rondje-bedragen.
  const totalCost = rounds.reduce((s, r) => s + (r.amount || 0), 0)
  const setTotalCost = (v: number) => {
    // "Totaal"-modus: alles op het eerste rondje, de rest op 0, zodat de som klopt.
    // We schrijven elk rondje expliciet weg (dirtyRound kan er maar één markeren).
    if (rounds.length === 0) return
    const nieuwe = rounds.map((r, i) => rRedistribute(r, i, false, [], i === 0 ? v : 0))
    setRounds(nieuwe)
    nieuwe.forEach((r) => persistRound(r))
  }

  // Gewoon rondjes → afrekenen. Altijd bereikbaar. Zonder bedragen valt er niets te
  // verdelen: dan een melding met een duw naar het rondjesoverzicht.
  // De avond dichtzetten: de groep verhuist in de lijst naar "afgesloten" en ruimt
  // zichzelf later op (tenzij verlengd). Idempotent — nogmaals tikken kan geen kwaad.
  const sluitAvondAf = async () => {
    if (!groupId) return
    // Een rondje zonder bedrag verdwijnt uit de verdeling; een rondje zonder betaler
    // maakt dat de saldi niet op nul uitkomen. Allebei leggen ze een foute eindbalans
    // vast, dus afsluiten kan pas als alles ingevuld is.
    const nietRond = rounds.some((rr) => (rr.amount || 0) <= 0.005
      || (Math.max(0, (rr.amount || 0) - (rr.potPart || 0)) > 0.005
        && Object.values(rr.payers || {}).reduce((a, b) => a + (b || 0), 0) <= 0.005))
    if (nietRond) { setNotice(L.fillAmountsFirst); setOverviewBackTo("final"); setView("payers"); return }
    // Kwam de Fair Split hier via de overstap vanuit zelf opnemen (fromQuick), dan is
    // "settle" enkel geleend geweest voor de afrekening — de groep wás en blijft een
    // zelf-opgenomen avond. Zonder deze terugzetting bestempelden de lijsten hem
    // achteraf als "iedereen tikt zelf aan", wat nooit gebeurd is.
    const terugNaarZelf = fromQuick && settle
    await supabase.from("party_groups").update({ finalized: true, last_active: new Date().toISOString(), ...(terugNaarZelf ? { settle: false } : {}) }).eq("id", groupId)
    // Ook meteen in de lokale lijst: anders stond de nét afgesloten avond nog even in
    // het oranje bezig-blok ("verder waar je gebleven was") én onderaan bij afgesloten.
    setSavedGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, finalized: true, ...(terugNaarZelf ? { settle: false, uitgebreid: true } : {}) } : g)))
    setAfsluitKaart(true)
  }
  // De eindafrekening als deelbaar tekstje: per persoon het eerlijke bedrag, plus wie
  // aan wie overschrijft. Via het deelmenu van de telefoon; op desktop naar het klembord.
  const deelAfrekening = async () => {
    const regels: string[] = [`🍻 ${groupName.trim() || L.autoName()}`]
    people.forEach((pp) => { const b = consumption(pp.id) + cupOwn(pp.id) + cardLossPer; regels.push(`• ${pp.name}: ${euro(Math.round(b * 100) / 100)}`) })
    if (settlement.tx.length > 0) {
      regels.push("")
      settlement.tx.forEach((t) => regels.push(`${t.from} → ${t.to}: ${euro(t.amount)}`))
    }
    regels.push(""); regels.push("— Rundo")
    const tekst = regels.join("\n")
    try { if (navigator.share) { await navigator.share({ text: tekst }); return } } catch { return }
    try { await navigator.clipboard.writeText(tekst); setNotice(L.copiedNote) } catch { /* niets */ }
  }
  // De eindsprong van uitgebreid: betalers registreren en naar de eindbalans, in de
  // eigen amber-stijl (de modus blijft uitgebreid).
  const naarEindbalans = () => {
    // Een rondje met een bedrag maar zonder betaler kan de eindbalans niet uitrekenen:
    // er staat geld op tafel waarvan niemand weet wie het voorschoot. Vroeger zette dit
    // zulke rondjes stil op naam van de noteerder — handig, maar fout zodra iemand
    // anders betaald had, en je zag het nergens. Nu gaat het langs het betalersscherm:
    // dáár vul je in hoeveel er betaald werd en door wie, en pas als alles gedekt is
    // laat dat scherm je door naar de eindbalans.
    const ongedekt = rounds.some((rr) => (rr.amount || 0) <= 0.005
      || (Math.max(0, (rr.amount || 0) - (rr.potPart || 0)) > 0.005
        && Object.values(rr.payers || {}).reduce((a, b) => a + (b || 0), 0) <= 0.005))
    if (ongedekt) { setView("payers"); return }
    setHasSettled(true)
    setView("final")
  }
  const goQuickSettle = () => {
    // Geen enkel rondje? Dan valt er niets te verdelen. Wél rondjes maar (nog) geen
    // bedragen? Dan gewoon doorlaten: het afrekenscherm zegt zelf welke rondjes leeg
    // zijn en biedt de knop om ze aan te vullen. Een pop-up ervoor is een drempel die
    // hetzelfde vertelt, maar zonder de knop.
    if (rounds.length === 0) { setNotice(L.nothingToSettle); return }
    // Snel opnemen met enkel lege rondjes: op €0 valt er niets te verdelen én niets te
    // kiezen. In plaats van een afrekenscherm vol nullen: zeggen wat er moet gebeuren en
    // meteen de invul-stand van het rondjesoverzicht openen, met de knop per leeg rondje.
    if (!opNaam && !rounds.some((r) => (r.amount || 0) > 0.005)) {
      setNotice(L.fillAmountsFirst)
      setFillMode(true); setOverviewBackTo("hub"); setView("roundsOverview")
      return
    }
    // Uitgebreid opnemen belooft "ieder betaalt wat hij dronk"; dat kan niet zolang er
    // drankjes zonder naam zijn.
    if (!settle && opNaam && unassignedAllRounds > 0) {
      setNotice(L.assignFirstNote)
      // Open meteen de toewijs-flow over alle rondjes, en onthoud dat we daarna naar
      // het afrekenscherm willen. (setShowAssignAll werkte hier niet: dat venster
      // bestaat alleen op het bestelscherm.)
      const fr = rounds.findIndex((rr) => drinks.some((d) => (rr.anon[d.id] ?? 0) > 0))
      if (fr >= 0) { settleNaToewijzen.current = true; setOpenRound(fr); setAllRoundsOpen(false); setEditCups(false); setEditPay(false); setAssignAllMode(true); setAssignIdx(fr); setView("hub") }
      return
    }
    // Uitgebreid opnemen loopt nooit meer door de drie Fair Split-stappen: elk gat
    // krijgt zijn eigen kleinste oplossing, in volgorde — bedragen aanvullen in het
    // overzicht, gast-namen in een venstertje — en daarna land je op de eindbalans.
    if (opNaam === true) {
      if (unfinishedRound) { setNotice(L.finishRoundFirst); return }
      if (blockIfUnpaid()) return
      // Een rondje zonder bedrag is bij het afsluiten een bewuste keuze geweest
      // ("overslaan" — getrakteerd, niets te betalen) en telt gewoon als €0 in de
      // eindbalans. Alleen als ÁLLE rondjes leeg zijn valt er niets te verdelen:
      // dan eerst de bedragen, met de invul-stand van het overzicht erbij.
      // De eindbalans zelf toont een regel voor €0-rondjes, met de aanvul-knop.
      const zonderBedrag = rounds.filter((rr) => (rr.amount || 0) <= 0.005).length
      if (zonderBedrag > 0) {
        setNotice(L.fillAmountsFirst)
        setFillMode(true); setOverviewBackTo("hub"); setView("roundsOverview")
        return
      }
      // Enkel naamloze plaatsen die ook écht meedronken hebben een naam nodig — een
      // ongebruikte "Gast 3" zonder drankjes staat toch niet in de verdeling.
      const gasten = people.filter((pp) => (isGuestDefault(pp.name) || !pp.name.trim()) && dronkIets(pp.id))
      if (gasten.length > 0) {
        setNaamVenster(Object.fromEntries(gasten.map((g) => [g.id, ""])))
        return
      }
      naarEindbalans()
      return
    }
    setView("quickSettle")
  }
  // Van niveau 1 naar Fair Split: eerst snel personen + namen, daarna toewijzen.
  // Fair Split rekent met de bedragen per rondje. Ontbreekt er één, dan klopt de
  // verdeling niet — dus tegenhouden en zeggen waarom, in plaats van half doorlaten.
  const goToFairSplit = () => {
    // Losse rondjes zonder bedrag (overgeslagen — getrakteerd) tellen als €0 en houden
    // de overstap niet meer tegen; alleen als álle rondjes leeg zijn valt er niets te
    // verdelen. De eindbalans toont voor €0-rondjes een eigen regel met aanvul-knop.
    const leeg = rounds.filter((r) => (r.amount || 0) <= 0.005).length
    if (leeg === rounds.length) { setNotice(L.fillAmountsFirst); setFillMode(true); setOverviewBackTo("hub"); setView("roundsOverview"); return }
    // Staat alles al ingevuld van een vorige keer — echte namen voor wie meedronk,
    // alle drankjes toegewezen én elk rondje met bedrag heeft een betaler of
    // pot-aandeel — dan valt er niets meer te vragen: meteen door naar de eindbalans.
    // Dat gebeurt typisch de twééde keer: je paste een bedrag aan in het
    // rondjesoverzicht en tikt opnieuw op afrekenen; de drie stappen nóg eens lopen
    // voegt dan niets toe. Ontbreekt er wél iets, dan begint de flow gewoon bij stap 1.
    const namenOk = people.length > 0 && people.every((pp) => (pp.name.trim() && !isGuestDefault(pp.name)) || !dronkIets(pp.id))
    const betalersOk = rounds.every((r) => (r.amount || 0) <= 0.005 || (r.potPart || 0) > 0.005 || Object.values(r.payers || {}).some((a) => (a || 0) > 0.005))
    if (namenOk && unassignedAllRounds === 0 && betalersOk) {
      setSettle(true)
      // fq = "begon als snel opnemen": zo blijft de sessie ook na herladen of op een
      // ander toestel amber lezen met "Snel opnemen", in plaats van als QR-groep.
      persistSettings({ settle: true, fq: true })
      setFromQuick(true)
      setHasSettled(true)
      setView("final")
      return
    }
    persistSettings({ fq: true })
    const alleAantallen = rounds.map((r) => Math.max(1, r.headcount || 1))
    const doelAantal = Math.max(1, splitPeople ?? (alleAantallen.length ? Math.max(...alleAantallen) : 1))
    if (people.length < doelAantal && groupId) {
      const bij = doelAantal - people.length
      Promise.all(Array.from({ length: bij }, () => supabase.rpc("party_add_person", { p_group: groupId, p_name: "" })))
        .then(() => loadParty(groupId))
    }
    setFromQuick(true); setView("fairSetup")
  }
  // Terug naar de gelijke verdeling: de modus omzetten en de rondjes ongemoeid laten.
  const backToEqualSplit = (keuze: "equal" | "fair" = "equal") => {
    setSettle(false)
    persistSettings({ settle: false })
    setFromQuick(false)
    setSettleChoice(keuze)
    // Alles wat bij het Fair Split-traject hoort sluiten. Bleef daar iets van openstaan,
    // dan kom je via de gewone navigatie alsnog in een Fair Split-scherm terecht — en
    // daar hoor je niet zolang de groep in snelle rondjes staat.
    setAssignIdx(null); setAssignAllMode(false)
    setPotNames(null); setFillMode(false)
    setView("quickSettle")
  }
  // Eén tik voor het meest voorkomende geval: dezelfde persoon haalde telkens.
  // pid = null betekent: de pot draagt alles. Komt de pot tekort, dan klemt
  // rRedistribute het aandeel op wat er in zit en blijft de rest zichtbaar openstaan.
  const zelfdeBetalerVoorAlles = (pid: string | null) => {
    let potVerbruikt = 0
    const nieuwe = rounds.map((r, idx) => {
      if ((r.amount || 0) <= 0.005) return r
      if (pid !== null) return rRedistribute(r, idx, false, [pid], r.amount)
      // De pot betaalt alles: cumulatief klemmen, zodat de rondjes samen nooit meer
      // opnemen dan er in de pot zit — wat overblijft, blijft gewoon open staan.
      const vrij = Math.max(0, potContribTotal - potVerbruikt)
      const deel = Math.min(r.amount || 0, vrij)
      potVerbruikt += deel
      return { ...r, payers: {}, potPart: deel }
    })
    setRounds(nieuwe)
    nieuwe.forEach((r) => persistRound(r))
  }
  // In snelle rondjes gaat de pot naar de groep, zonder namen. Fair Split rekent per
  // persoon, dus die inleg moet eerst over namen verdeeld worden.
  const potZonderNamen = potRounds.some((r) => Object.keys(r.amounts).some((k) => !people.some((p) => p.id === k)))
  // Bij het verdelen over namen voegen we de losse inlegrondes samen tot één rij: wie
  // wat inlegde is vanaf hier de vraag, niet in welke beurt het gebeurde.
  const klemPotDelenOp = async (nieuwTotaal: number) => {
    let vrij = Math.max(0, nieuwTotaal)
    const geklemd = rounds.map((r) => {
      const deel = Math.min(r.potPart || 0, vrij)
      vrij -= deel
      return Math.abs(deel - (r.potPart || 0)) > 0.004 ? { ...r, potPart: deel } : r
    })
    const gewijzigd = geklemd.filter((r, i) => r !== rounds[i])
    if (gewijzigd.length > 0) {
      // Vergelijk index voor index: wat er minder uit de pot komt, betaalt iemand zelf.
      const bedrag = geklemd.reduce((s, r, i) => s + Math.max(0, (rounds[i].potPart || 0) - (r.potPart || 0)), 0)
      await Promise.all(gewijzigd.map((r) => persistRound(r)))
      if (bedrag > 0.005) setNotice(L.potShiftedToSelf(gewijzigd.length, euro(bedrag)))
    }
  }
  const bewaarPotPerPersoon = async (bedragen: Record<string, number>) => {
    if (!groupId || potRounds.length === 0) return
    const [eerste, ...rest] = potRounds
    const { error } = await supabase.from("party_pot").update({ amounts: bedragen }).eq("id", eerste.id)
    if (error) { setNotice("Pot opslaan mislukt: " + error.message); return }
    if (rest.length > 0) await supabase.from("party_pot").delete().in("id", rest.map((r) => r.id))
    // Inleg omlaag terwijl rondjes al uit de pot betaald waren? Meekrimpen.
    await klemPotDelenOp(Object.values(bedragen).reduce((a, b) => a + (b || 0), 0))
    setPotNames(null)
    loadParty(groupId)
  }
  const verdeelPotOverNamen = async () => {
    if (people.length === 0) return
    for (const r of potRounds) {
      const tot = Object.values(r.amounts).reduce((a, b) => a + (b || 0), 0)
      const per = tot / people.length
      const nieuw: Record<string, number> = {}
      people.forEach((p) => { nieuw[p.id] = per })
      const { error } = await supabase.from("party_pot").update({ amounts: nieuw }).eq("id", r.id)
      if (error) { setNotice("Pot verdelen mislukt: " + error.message); return }
    }
    if (groupId) loadParty(groupId)
  }
  const confirmFairSetup = async () => {
    if (people.length === 0) { setNotice(L.addPersonFirst); return }
    // Elk rondje bevriest bij het bevestigen wie er toen in de groep zat. In de snelle
    // modus was dat alleen de beheerder; de anderen komen er hier pas bij. Zonder deze
    // bijwerking telt hun consumptie voor nul en klopt de eindbalans niet.
    if (groupId && rounds.length > 0) {
      const leden = people.map((pp) => pp.id)
      const { error } = await supabase.from("party_rounds").update({ members: leden }).eq("group_id", groupId)
      if (error) { setNotice("Deelnemers bijwerken mislukt: " + error.message); return }
      setRounds((rs) => rs.map((r) => ({ ...r, members: leden })))
    }
    setSettle(true)
    persistSettings({ settle: true })
    setOpenRound(rounds.length - 1)
    // Stap 1 leidt altijd naar stap 2 zélf, niet naar een tussenscherm met een knop
    // naar stap 3. Ook als alles al toegewezen is: dan zie je gewoon dat het klaar is
    // en ga je van daar verder. Zo is de volgorde in beide richtingen dezelfde.
    if (fromQuick && rounds.length > 0) { setAssignAllMode(true); setAssignIdx(0) }
    setView("hub")
  }
  // Nieuw rondje in gewoon-rondjes: eerst vragen of het hetzelfde rondje opnieuw is
  // (bestelling overgenomen, aanpasbaar) of een vers rondje.
  // "Weer hetzelfde rondje?" hoorde hier niet thuis: op het overzicht kijk je terug,
  // je bestelt er niet. De vraag staat op het bestelscherm zelf.
  const askNewRound = () => { nextRound() }

  // Het aantal personen van één rondje bijstellen. De app leidt dit af uit het aantal
  // drankjes, maar soms nam iemand twee glazen of dronk er iemand niets mee.
  const setRoundHeadcount = async (roundId: string, n: number) => {
    const val = Math.max(1, n)
    setRounds((cur) => cur.map((r) => r.id === roundId ? { ...r, headcount: val } : r))
    const { error } = await supabase.from("party_rounds").update({ headcount: val }).eq("id", roundId)
    if (error) setNotice("Aanpassen mislukt: " + error.message)
  }

  const applyBeginChoices = () => {
    if (bpSettle === null) return
    setOnboardedOnce(true)
    // "Gewoon rondjes": geen pot, geen coins, geen bekers. Niet omdat het niet KAN,
    // maar omdat het niets betekent zonder afrekening.
    if (bpSettle === false) {
      setSettle(false)
      setPotChosen(false); setDepositOn(false); setPay("eur")
      persistSettings({ settle: false, pot_on: false, deposit_on: false, pay: "eur" })
      setBeginPrompt(false)
      setView("hub")
      return
    }
    // Fair Split: gewoon aanzetten en beginnen. Pot, bekers en coins stelt de admin
    // in wanneer hij ze nodig heeft, via ⚙️ Groep. Ze horen niet als opstartvraag —
    // de meeste avonden gebruiken ze niet.
    setSettle(true)
    persistSettings({ settle: true })
    setBeginPrompt(false)
    setView("hub")
  }
  const tryBegin = () => {
    if (people.length === 0) { setNotice(L.addPersonFirst); return }
    if (depositOn && (depositValue || 0) <= 0) { setNotice(L.fillDeposit); return }
    if (pay === "coin" && (coinValue || 0) <= 0) { setNotice(L.fillCoinValue); return }
    if (potChosen && potContribTotal <= 0.005) { setConfirmDlg({ msg: L.potNothingIn(potIsCard), yes: L.anywayWithout(potIsCard), onYes: () => { setConfirmDlg(null); setPotChosen(false); setView("hub") } }); return }
    setView("hub")
  }
  // Het eerste rondje starten, met een zachte drempel: is nog niet iedereen aangemeld,
  // dan een vriendelijke bevestiging — geen poort. De admin houdt de keuze.
  const startFirstRound = () => {
    if (unfinishedRound) { resumeRound(); return }
    const nietAangemeld = people.filter((p) => !p.claimedBy).length
    const ga = () => { setActiveCat(catsPresent[0]); setCupsChecked(false); setCupsTouched(false); setView("order") }
    // Alleen relevant als er ooit iets te scannen viel (een invite-code bestaat) en er
    // echt nog mensen ontbreken. Anders gewoon starten.
    if (inviteCode && nietAangemeld > 0) {
      setConfirmDlg({ msg: L.startNotAll(nietAangemeld, people.length), yes: L.startAnyway, no: L.startWait, onYes: () => { setConfirmDlg(null); ga() } })
      return
    }
    ga()
  }
  const goAssignUnassigned = () => {
    const fr = rounds.findIndex((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
    if (fr < 0) return
    setOpenRound(fr); setAllRoundsOpen(false); setEditCups(false); setEditPay(false); setView("hub"); setAssignIdx(fr)
  }
  // Welke rondjes missen een bedrag of een betaler? Zonder die twee klopt de verdeling
  // niet, en dan mag de eindafrekening niet.
  const rondjesZonderBedrag = () => rounds
    .map((r, i) => ({ nr: i + 1, open: r.id === openRoundId || r.status === "open",
      ok: (r.amount || 0) > 0.005 && ((r.potPart || 0) > 0.005 || Object.values(r.payers || {}).some((a) => (a || 0) > 0.005)) }))
    .filter((x) => !x.ok && !x.open).map((x) => x.nr)

  const goFinal = () => {
    if (unfinishedRound) { setNotice(L.roundUnfinished(roundNr)); setActiveCat(catsPresent[0]); setView("order"); return }
    // Naamloze plaatsen maken de verdeling onbetrouwbaar: je ziet dan "Plaats 3" op de
    // afrekening en niemand weet wie dat was.
    const naamloos = people.filter((p) => isGuestDefault(p.name) || !p.name.trim())
    if (settle && naamloos.length > 0) setNotice(L.namesMissing(naamloos.length))
    const zonder = rondjesZonderBedrag()
    if (settle && zonder.length > 0) {
      setNotice(L.roundsMissingAmount(zonder.join(", ")))
      setOpenRound(zonder[0] - 1); setView("confirmed")
      return
    }
    if (view === "confirmed") { setNotice(`Rondje ${roundNr} is nog niet betaald. Rond die betaling eerst af.`); return }
    if (paidCount === 0) { setNotice(L.nothingToSettle); return }
    if (blockIfUnpaid()) return
    if (anyUnassignedRounds) {
      const tot = rounds.reduce((s, r) => s + drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0), 0)
      setConfirmDlg({
        msg: `🔴 ${tot} drankje${tot === 1 ? "" : "s"} nog niet toegewezen.\n\nWijs toe → eerlijk verdeeld: elk betaalt wat hij écht dronk.\nDoe je dat niet → gelijk verdeeld: iedereen evenveel.\n\nVoorbeeld: Jan 1 cola (€4), Tom 4 speciaalbieren (€20). Gelijk verdeeld betaalt elk €12 — Jan €8 te veel.`,
        yes: L.equalAnyway,
        no: "Toewijzen",
        onYes: () => { setConfirmDlg(null); setHasSettled(true); setView("final") },
        onNo: () => { setConfirmDlg(null); goAssignUnassigned() },
      })
      return
    }
    setHasSettled(true); setView("final") }
  const openClose = () => {
    setAmountDraft("")
    // Wie haalde, schoot voor: die staat standaard als betaler klaar. Nog te wijzigen
    // naar de pot of iemand anders op het betaalscherm.
    if (settle && startedBy && payPersons.length === 0 && !payPot) {
      setPayPersons([startedBy]); autoSplit([startedBy], false)
    }
    setShowClose(true)
  }
  const goAssignFromWarning = () => { setShowClose(false); setAssignNaamEdit(false); setShowAssignAll(true) }
  const commitRound = () => {
    // Nog drankjes zonder naam bij uitgebreid opnemen? Geen popup: de afsluiting met
    // betaalstap in de hub komt eerst, en daarna land je vanzelf in het rondjesoverzicht
    // waar de toewijs-melding al duidelijk staat.
    const effGb: Record<string, number> = {}
    people.forEach((p) => { effGb[p.id] = gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id)) })
    // De haler heeft de mensen op de plaats vastgezet — reset de haler-strook voor het
    // volgende rondje.
    setStartedBy(null)
    if (openRoundId) {
      // "Gewoon rondjes": het rondje is meteen klaar. Geen bedrag, geen betaler.
      const nieuweStatus = settle ? "pending" : "closed"
      // Bevries WIE er nu in de groep zit: dit zijn de deelnemers aan dit rondje.
      // Vanaf hier telt een latere nieuwkomer niet meer mee voor dit rondje.
      const leden = people.map((p) => p.id)
      // De groep blijft meestal dezelfde hele avond. Een volgend rondje neemt daarom het
      // aantal van het vorige over — ook als er die ronde iemand niets dronk. Enkel bij
      // het allereerste rondje leiden we het af uit het aantal drankjes, als startpunt.
      // Per rondje bijstellen kan altijd in het rondjesoverzicht.
      const vorige = rounds.length > 0 ? Math.max(1, rounds[rounds.length - 1].headcount || 1) : 0
      const drankjesNu = drinks.reduce((s, d) => s + drinkTotal(d.id), 0)
      const effHeadcount = settle ? headcount : opNaam === true ? leden.length : (vorige > 0 ? vorige : Math.max(1, drankjesNu || headcount || 1))
      supabase.from("party_rounds").update({ status: nieuweStatus, gave_back: effGb, members: leden, headcount: effHeadcount, ...(settle ? {} : { closed_at: new Date().toISOString() }) }).eq("id", openRoundId)
        .then(({ error }) => { if (error) setNotice("Rondje bevestigen mislukt: " + error.message); else if (groupId) loadParty(groupId) })
      setOpenRoundId(null)
    }
    setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setAmountDraft(""); setPayPot(false); setPayPersons([]); setPayAmts({}); setPotAmtDraft(""); setPaidConfirmed(false)
    // "Gewoon rondjes" kent geen betaalscherm: het rondje is klaar, en wie gaat halen
    // krijgt de toog-lijst in de hub te zien.
    if (!settle) setLastRoundHandled(false)
    if (!settle) {
      const snap: Record<string, number> = {}
      drinks.forEach((d) => { const n = drinkTotal(d.id); if (n > 0) snap[d.id] = n })
      if (Object.keys(snap).length > 0) { setBarNaRondje(snap); setShowBarlijst(true) }
    }
    setView(settle ? "confirmed" : "hub")
    setRoundNr(rounds.length + 1)

  }
  const persistPayment = (roundId: string, payers: Record<string, number>, potPart: number, total: number) => {
    supabase.from("party_rounds")
      .update({ payers, pot_part: potPart, amount: total, status: "closed", closed_at: new Date().toISOString() })
      .eq("id", roundId)
      .then(({ error }) => { if (error) setNotice("Betaling opslaan mislukt: " + error.message); else if (groupId) loadParty(groupId) })
  }
  const applyPayment = (payers: Record<string, number>, potPart: number, total: number) => setRounds((rs) => rs.map((r, i) => i === rs.length - 1 ? { ...r, payers, amount: total, potPart } : r))
  const editOrder = () => { const last = rounds[rounds.length - 1]; if (!last) { setView("order"); return }
    // Terug naar bestellen: hetzelfde rondje weer openzetten. De drankjes staan al in
    // party_round_items, dus er hoeft niets verplaatst te worden.
    supabase.from("party_rounds").update({ status: "open" }).eq("id", last.id)
      .then(({ error }) => { if (error) setNotice("Terugkeren mislukt: " + error.message); else if (groupId) loadParty(groupId) })
    setOpenRoundId(last.id)
    setCart(last.orders); setCartAnon(last.anon); setGaveBackDraft(last.gaveBack); setRounds((rs) => rs.slice(0, -1)); setCupsChecked(false); setCupsTouched(false); setShowClose(false); setPaidConfirmed(false); setActiveCat(catsPresent[0]); setView("order") }
  const confirmPayment = () => {
    const st = paymentState()
    if (!st.valid) { setNotice(st.reason); return }
    const payers: Record<string, number> = {}
    Object.entries(st.personAmts).forEach(([pid, a]) => { if (a > 0.0001) payers[pid] = a })
    // De afrondingscent(en) intern bij één betaler leggen zodat de boekhouding exact klopt.
    // Zichtbaar blijft iedereen even veel betalen; het verschil verrekent de Fair Split.
    let potPart = st.potPart
    const ids = Object.keys(payers)
    const diff = Math.round((st.total - (potPart + ids.reduce((a, k) => a + payers[k], 0))) * 100) / 100
    if (Math.abs(diff) > 0.0001) {
      if (ids.length > 0) payers[ids[ids.length - 1]] = Math.round((payers[ids[ids.length - 1]] + diff) * 100) / 100
      else potPart = Math.round((potPart + diff) * 100) / 100
    }
    const laatste = rounds[rounds.length - 1]
    netAfgesloten.current = true
    if (laatste) persistPayment(laatste.id, payers, potPart, st.total)
    applyPayment(payers, potPart, st.total)
    setPaidConfirmed(true)
  }
  const closeRound = () => {
    const st = paymentState()
    if (!st.valid) { setNotice(st.reason || L.confirmPaymentFirst); return }
    if (!paidConfirmed) { setNotice(L.confirmPaymentFirst); return } setOpenRound(rounds.length - 1); setEditCups(false); setEditPay(false); setView("hub") }
  const cancelOrder = () => setConfirmDlg({
    msg: L.cancelRoundConfirm(roundNr),
    yes: L.yesCancel,
    onYes: () => {
      setConfirmDlg(null)
      setCart({}); setCartAnon({}); setGaveBackDraft({}); setCupsChecked(false); setCupsTouched(false); setRepeated(false)
      // Ook het rondje zelf weg: anders blijft het openstaan en biedt het overzicht aan
      // om "verder te gaan" met iets wat je net annuleerde.
      if (openRoundId) {
        const rid = openRoundId
        setOpenRoundId(null); setStartedBy(null); setOpenAnswers({})
        supabase.from("party_rounds").delete().eq("id", rid).then(() => { if (groupId) loadParty(groupId) })
      }
      // Een afgerond rondje blijft afgerond: we openen het niet opnieuw. Aanpassen kan
      // enkel via het rondjesoverzicht.
      setRoundNr(rounds.length + 1)
      setLastRoundHandled(true)
      setNotice(L.roundCancelledNote(roundNr))
      setActiveCat(catsPresent[0])
      setView("order")
      naarRondjeKop()
    },
  })
  const cancelRound = () => setConfirmDlg({ msg: `Het volledige rondje ${roundNr} annuleren? Alle drankjes en bekers van dit rondje worden verwijderd. Dit kan niet ongedaan gemaakt worden.`, yes: L.yesCancel, onYes: () => { const remaining = rounds.length - 1; setRounds((rs) => rs.slice(0, -1)); setPaidConfirmed(false); setConfirmDlg(null); if (remaining > 0) { setOpenRound(remaining - 1); setView("hub") } else setView("order") } })
  // Na de eindbalans verder als uitgebreid: kwam je via de Fair Split-stappen (settle
  // aan), dan gaat de schakelaar terug — de rondjes zijn in beide modi identiek.
  const terugNaarUitgebreid = () => {
    if (settle) { setSettle(false); persistSettings({ settle: false }) }
    setFromQuick(false)
  }
  // Alles van het vorige rondje overnemen: per persoon toegewezen drankjes én de
  // nog niet toegewezen exemplaren. Daarna kan je gewoon bijsturen.
  const neemVorigeOver = async (vorig: Round) => {
    for (const d of drinks) {
      const perPersoon = vorig.orders[d.id] || {}
      for (const [pid, aantal] of Object.entries(perPersoon)) {
        const n = Number(aantal || 0)
        if (n > 0 && people.some((pp) => pp.id === pid)) await bump(d.id, pid, n)
      }
      const los = vorig.anon[d.id] || 0
      if (los > 0) await bumpAnon(d.id, los)
    }
    setWalkIdx(null); setShowAssignAll(false)
  }
  const nextRound = () => {
    if (blockIfUnpaid()) return
    setActiveCat(catsPresent[0])
    // Loopt er nog een rondje? Dan is dit geen nieuw rondje maar gewoon terugkeren.
    // Vroeger telde het nummer bij elk bezoek op, ook zonder één bestelling.
    if (settle && openRoundId) { setView("order"); return }
    setRoundNr(rounds.length + 1)
    setCupsChecked(false); setCupsTouched(false); setCart({}); setCartAnon({}); setRepeated(false)
    // Nooit met een venster beginnen: je landt gewoon op de drankjes.
    setWalkIdx(null); setShowAssignAll(false)
    setView("order")
    naarRondjeKop()
  }
  // Neemt de drankjes én de toewijzing van het laatste rondje over. Daarna nog gewoon aanpasbaar.
  // Wie deed mee aan dit rondje? Wie het rondje niet meemaakte, betaalt niet mee.
  // Oude rondjes zonder members vallen terug op de hele groep.
  const roundMembers = (r: Round) => {
    const basis = r.members.length > 0 ? r.members : people.map((p) => p.id)
    const metDrank = people.filter((p) => drinks.some((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0)).map((p) => p.id)
    return metDrank.every((id) => basis.includes(id)) ? basis : Array.from(new Set([...basis, ...metDrank]))
  }

  // ── "Zelfde rondje opnieuw" met inspraak ──────────────────────────────────
  // Het voorstel leeft op het LAATSTE rondje (proposal jsonb). De haler start het,
  // elke gast antwoordt op zijn eigen scherm, wie zwijgt krijgt niets. Alles loopt
  // via realtime (blok 11/12), zodat elk toestel de stand live ziet.
  const lastRound = rounds[rounds.length - 1] ?? null
  const activeProposal = lastRound && lastRound.proposal?.active ? lastRound.proposal : null
  const proposalRoundId = activeProposal ? lastRound!.id : null
  const myAnswer = (activeProposal && meId) ? activeProposal.answers?.[meId] : undefined
  // Wie deed mee aan het rondje dat we herhalen? Dat zijn de mensen die mogen antwoorden.
  const proposalPeople = lastRound ? people.filter((p) => roundMembers(lastRound).includes(p.id)) : []
  // De haler (of admin) start een voorstel op basis van het laatste rondje.
  const startProposal = async () => {
    if (blockIfUnpaid()) return
    if (!lastRound) { setNotice(L.nothingToRepeat); return }
    const by = meId || (startedBy ?? null)
    const { error } = await supabase.rpc("party_propose_repeat", { p_round: lastRound.id, p_by: by })
    if (error) { setNotice("Voorstel starten mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }
  // Een gast antwoordt: hetzelfde, iets anders, of bewust niks deze ronde.
  // "Wie nog niet koos" een duwtje geven. We schrijven een antwoord met de waarde
  // "same" weg op naam van de haler zelf — die waarde gebruikt dit rondje verder niet —
  // en gebruiken de tijdstempel eromheen als sein. Simpeler: we zetten een merkje in het
  // antwoordveld dat de andere toestellen bij hun volgende verversing oppikken.
  const [herinneringGezien, setHerinneringGezien] = useState<string | null>(null)
  const [herinnering, setHerinnering] = useState(false)
  // Wie koos er nog niets? Die namen staan in de vraag, zodat je weet wie je wakker
  // schudt — en of dat wel nodig is.
  const nogNietGekozen = () => people.filter((pp) =>
    !drinks.some((d) => (cart[d.id]?.[pp.id] ?? 0) > 0) && openAnswers[pp.id] !== "skip" && pp.id !== startedBy)

  // Alleen wie het rondje startte en de beheerder mogen annuleren — anders blijft een
  // rondje eeuwig openstaan wanneer de haler zijn gsm wegstak.
  const magAnnuleren = !!openRoundId && (isAdmin || (!!meId && startedBy === meId))
  // De haler rondt zelf af: status naar "pending" (bevestigd, bedrag volgt), leden
  // bevroren — exact wat de admin-bevestiging ook doet, zonder de betaalstap. Die
  // betaalstap blijft van de admin: bij het afrekenen leidt de bestaande
  // bevestigd-maar-onbetaald-flow hem er vanzelf naartoe.
  const runnerRondtAf = async () => {
    if (!openRoundId || !groupId) return
    const leden = people.map((pp) => pp.id)
    const { error } = await supabase.from("party_rounds")
      .update({ status: "pending", members: leden, headcount: Math.max(1, headcount || people.length || 1) })
      .eq("id", openRoundId)
    if (error) { setNotice(L.runnerCloseFailed); return }
    const naam = people.find((pp) => pp.id === meId)?.name || "?"
    try { void kanaalRef.current?.send({ type: "broadcast", event: "melding", payload: { tekst: L.runnerDoneNote(naam) } }) } catch { /* niets */ }
    // Wie zelf afsloot hoort géén "geannuleerd"-melding te krijgen wanneer het open
    // rondje zo dadelijk uit beeld verdwijnt — dit is afronden, geen annuleren.
    netAfgesloten.current = true
    // Het barlijstje overleeft het leegmaken van de mand: dit is wat de haler meeneemt.
    setHaalInfo({ items: barTotalen().map((x) => ({ id: x.id, n: x.n, naam: x.naam, emoji: x.emoji })) })
    setCart({}); setCartAnon({}); setOpenRoundId(null); setStartedBy(null); setOpenAnswers({})
    loadParty(groupId)
  }

  const annuleerRondje = () => {
    if (!openRoundId || !groupId) return
    setConfirmDlg({
      variant: "danger",
      msg: `${L.cancelRoundTitle}\n\n${L.cancelRoundBody}`,
      yes: L.cancelRoundYes, no: L.ratherNot,
      onYes: async () => {
        setConfirmDlg(null)
        const rid = openRoundId
        // Iedereen hoort wíe annuleerde — de rij verdwijnt zo meteen, dus de melding
        // gaat via het live-kanaal, vóór het verwijderen.
        const naam = people.find((pp) => pp.id === meId)?.name || "de admin"
        try { void kanaalRef.current?.send({ type: "broadcast", event: "melding", payload: { tekst: L.cancelledBy(naam) } }) } catch { /* niets */ }
        // De drankjes hangen aan het rondje: die gaan mee weg. Half bewaren levert een
        // rondje op waarvan niemand nog weet wat het was.
        const { error } = await supabase.from("party_rounds").delete().eq("id", rid)
        if (error) { setNotice(L.cancelRoundFailed); return }
        setCart({}); setCartAnon({}); setOpenRoundId(null); setStartedBy(null); setOpenAnswers({})
        setNotice(L.cancelRoundDone)
        loadParty(groupId)
      },
    })
  }

  const vraagHerinnering = () => {
    const wachten = nogNietGekozen()
    if (wachten.length === 0) { setNotice(L.everyoneChoseAlready); return }
    setConfirmDlg({
      msg: `${L.remindTitle}\n\n${L.remindBody(wachten.map((pp) => pp.name).join(", "))}`,
      yes: L.remindYes, no: L.ratherNot,
      onYes: () => { setConfirmDlg(null); void stuurHerinnering(wachten.map((pp) => pp.name).join(", ")) },
    })
  }

  const stuurHerinnering = async (namen: string) => {
    if (!openRoundId || !groupId) return
    const merk = `poke:${Date.now()}`
    const { error } = await supabase.rpc("party_answer_repeat", { p_round: openRoundId, p_person: merk, p_answer: "same" })
    if (error) {
      // De RPC verwacht een échte deelnemer en weigert het duwtje-merk. Val dan terug
      // op een rechtstreekse merge in het voorstel — duwtjes zijn zeldzaam genoeg dat
      // dit racevrij genoeg is, en de ontvangst leest tóch alleen de "poke:"-sleutel.
      const { data: rij } = await supabase.from("party_rounds").select("proposal").eq("id", openRoundId).single()
      const prop = ((rij?.proposal as Proposal | null) ?? {})
      const nieuwProp = { ...prop, answers: { ...(prop.answers || {}), [merk]: "same" as const } }
      const { error: e2 } = await supabase.from("party_rounds").update({ proposal: nieuwProp }).eq("id", openRoundId)
      if (e2) { setNotice(L.reminderFailed); return }
    }
    setNotice(L.reminderSentTo(namen))
    loadParty(groupId)
  }

  // Alleen wat bevestigd is telt mee: anders staat er al bier in het lijstje van
  // iemand die nog aan het kiezen is.
  const barTotalen = () => drinks
    .map((d) => ({ id: d.id, naam: d.name, emoji: d.emoji, n: Object.entries(cart[d.id] || {}).reduce((a: number, [pid, q]) => a + (isKlaar(pid) ? Number(q || 0) : 0), 0) + (cartAnon[d.id] ?? 0) }))
    .filter((x) => x.n > 0)

  const antwoordRondje = async (answer: "different" | "skip" | "same") => {
    if (!openRoundId || !meId) return
    setOpenAnswers((cur) => ({ ...cur, [meId]: answer }))
    const { error } = await supabase.rpc("party_answer_repeat", { p_round: openRoundId, p_person: meId, p_answer: answer })
    if (error) { setNotice("Antwoord mislukt: " + error.message); if (groupId) loadParty(groupId) }
  }

  const answerProposal = async (answer: "same" | "different" | "skip") => {
    if (!proposalRoundId || !meId) return
    const { error } = await supabase.rpc("party_answer_repeat", { p_round: proposalRoundId, p_person: meId, p_answer: answer })
    if (error) { setNotice("Antwoord mislukt: " + error.message); return }
    if (groupId) loadParty(groupId)
  }
  // De haler sluit het voorstel af. Enkel wie "same" of "different" antwoordde, telt.
  const closeProposal = async () => {
    if (!proposalRoundId || !lastRound) return
    const antwoorden = activeProposal?.answers || {}
    const { error } = await supabase.rpc("party_close_proposal", { p_round: proposalRoundId })
    if (error) { setNotice("Afsluiten mislukt: " + error.message); return }

    // Wie "hetzelfde" antwoordde, krijgt zijn eigen vorige bestelling in het nieuwe rondje.
    // Wie "iets anders" koos tikt zelf aan, wie oversloeg krijgt niets.
    const rid = await ensureRound(meId ?? null)
    if (rid && groupId) {
      const items: { person: string | null; drink: string; delta: number }[] = []
      for (const [did, per] of Object.entries(lastRound.orders || {})) {
        for (const [pid, q] of Object.entries(per || {})) {
          if (antwoorden[pid] === "same" && (q || 0) > 0 && people.some((pp) => pp.id === pid)) {
            items.push({ person: pid, drink: did, delta: q })
          }
        }
      }
      if (items.length > 0) {
        const { error: e2 } = await supabase.rpc("party_bump_many", { p_group: groupId, p_round: rid, p_items: items })
        if (e2) {
          for (const it of items) {
            await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: it.person, p_drink: it.drink, p_delta: it.delta })
          }
        }
      }
      await openAntwoordveld(rid)
    }
    if (groupId) loadParty(groupId)
    setActiveCat(catsPresent[0])
    setView("order")
  }

  // Het overzicht dat de HALER ziet zolang een voorstel loopt: wie antwoordde wat,
  // en de afsluit-knop met de geruststellende regel over wie er niet bij staat.
  const renderProposalHost = () => {
    if (!activeProposal || !lastRound) return null
    const answers = activeProposal.answers || {}
    const meedoen = proposalPeople.filter((p) => answers[p.id] === "same" || answers[p.id] === "different")
    const stil = proposalPeople.filter((p) => !answers[p.id])
    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.5)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1d2942", marginBottom: 3 }}>{L.proposalTitle}</div>
        <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 12, lineHeight: 1.5 }}>{L.proposalWaiting}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {proposalPeople.map((p) => {
            const a = answers[p.id]
            const label = a === "same" ? L.ansSame : a === "different" ? L.ansDiff : a === "skip" ? L.ansSkip : L.ansWaiting
            const kleur = a === "same" ? "#1f6b3a" : a === "different" ? "#8a5e0f" : a === "skip" ? "#8b93a3" : "#9aa3b2"
            const bg = a ? VLAK1 : "#fff"
            return (
              <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 11px", borderRadius: 10, background: bg, border: "1px solid rgba(29,41,66,0.12)" }}>
                <span style={{ fontSize: 17.5, fontWeight: 700, color: "#1d2942" }}>{p.name}</span>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: kleur }}>{label}</span>
              </div>
            )
          })}
        </div>
        {/* De laatste blik vóór afsluiten: wie krijgt geen bestelling? Zo kan de haler
            desgewenst nog even langs die mensen voor hij op de knop tikt. */}
        {stil.length > 0 && (
          <div style={{ fontSize: 15, color: "#8a5e0f", background: "rgba(240,165,0,0.1)", borderRadius: 10, padding: "8px 11px", marginBottom: 10, lineHeight: 1.45 }}>
            {L.noOrderFor(stil.map((p) => p.name).join(", "))}
          </div>
        )}
        <button style={{ ...S.btnP, width: "100%" }}
          onClick={() => {
            if (meedoen.length === 0) { setConfirmDlg({ msg: L.proposalNobody, yes: L.startAnyway, onYes: () => { setConfirmDlg(null); closeProposal() }, no: L.startWait }); return }
            closeProposal()
          }}>{L.closeProposalBtn(meedoen.length)}</button>
      </div>
    )
  }

  // Het kaartje dat elke GAST ziet zolang een voorstel loopt. Drie keuzes; wie niks
  // kiest, zwijgt (en krijgt niets). "Iets anders" schakelt door naar het bestellen.
  const renderProposalGuest = () => {
    if (!activeProposal || !lastRound || !meId) return null
    if (!roundMembers(lastRound).includes(meId)) return null
    // Wat had ik vorige ronde? Toon dat, zodat "hetzelfde" concreet is.
    const mijnVorige = drinks
      .map((d) => ({ d, n: lastRound.orders[d.id]?.[meId] ?? 0 }))
      .filter((x) => x.n > 0)
    const gekozen = myAnswer
    return (
      <div style={{ ...S.card, border: "1.5px solid rgba(240,165,0,0.6)", background: "#fff8ec" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1d2942", marginBottom: 8 }}>{L.gProposalTitle}</div>
        {mijnVorige.length > 0 && (
          <div style={{ fontSize: 15.5, color: "#4a5567", marginBottom: 12, lineHeight: 1.5 }}>
            {L.gProposalYourLast} {mijnVorige.map((x) => `${x.n}× ${x.d.name}`).join(" · ")}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => answerProposal("same")}
            style={{ ...S.btnP, width: "100%", opacity: gekozen && gekozen !== "same" ? 0.5 : 1,
              background: gekozen === "same" ? "linear-gradient(135deg,#2fae6a,#1f8a4c)" : undefined }}>
            {L.gProposalSame}{gekozen === "same" && " ✓"}
          </button>
          <button onClick={() => { answerProposal("different"); setActiveCat(catsPresent[0]); setGuestTab("order") }}
            style={{ ...S.btn, width: "100%", fontWeight: 800, opacity: gekozen && gekozen !== "different" ? 0.5 : 1,
              border: gekozen === "different" ? "1.5px solid #e08a00" : undefined }}>
            {L.gProposalDiff}{gekozen === "different" && " ✓"}
          </button>
          <button onClick={() => answerProposal("skip")}
            style={{ ...S.btn, width: "100%", fontWeight: 700, fontSize: 17, opacity: gekozen && gekozen !== "skip" ? 0.5 : 1,
              border: gekozen === "skip" ? "1.5px solid #8b93a3" : undefined, color: "#6b7484" }}>
            {L.gProposalSkip}{gekozen === "skip" && " ✓"}
          </button>
        </div>
        {gekozen && (
          <div style={{ fontSize: 15, color: "#1f6b3a", fontWeight: 700, textAlign: "center", marginTop: 10 }}>{L.gProposalDone}</div>
        )}
      </div>
    )
  }

  const repeatRound = () => {
    if (blockIfUnpaid()) return
    const last = rounds[rounds.length - 1]
    if (!last) { setNotice(L.nothingToRepeat); return }
    const orders: Assign = {}
    Object.entries(last.orders).forEach(([did, per]) => {
      const row: Record<string, number> = {}
      Object.entries(per || {}).forEach(([pid, q]) => { if (people.some((p) => p.id === pid) && (q || 0) > 0) row[pid] = q })
      if (Object.keys(row).length) orders[did] = row
    })
    const anon: Anon = {}
    Object.entries(last.anon || {}).forEach(([did, q]) => { if ((q || 0) > 0) anon[did] = q })
    setRoundNr(rounds.length + 1)
    setCart(orders); setCartAnon(anon)
    setCupsChecked(false); setCupsTouched(false)
    setRepeated(true)
    setActiveCat(catsPresent[0])
    setView("order")
    naarRondjeKop()
    // En wegschrijven, want anders staat dit rondje alleen op jouw scherm: een gast zag
    // een leeg rondje en kon dus niets bijsturen, en zijn eerste tik overschreef jouw
    // kopie bij het volgende laden.
    void (async () => {
      const rid = await ensureRound(meId ?? null)
      if (!rid || !groupId) return
      const items: { person: string | null; drink: string; delta: number }[] = []
      for (const [did, per] of Object.entries(orders)) {
        for (const [pid, q] of Object.entries(per)) if ((q || 0) > 0) items.push({ person: pid, drink: did, delta: q })
      }
      for (const [did, q] of Object.entries(anon)) if ((q || 0) > 0) items.push({ person: null, drink: did, delta: q })
      if (items.length > 0) {
        // In één keer wegschrijven: bij tien personen scheelt dat tien aparte verzoeken en
        // één vergrendeling in plaats van tien. Bestaat die functie nog niet in de databank,
        // dan vallen we terug op het oude gedrag zodat een oudere installatie blijft werken.
        const { error } = await supabase.rpc("party_bump_many", { p_group: groupId, p_round: rid, p_items: items })
        if (error) {
          for (const it of items) {
            await supabase.rpc("party_bump", { p_group: groupId, p_round: rid, p_person: it.person, p_drink: it.drink, p_delta: it.delta })
          }
        }
      }
      await openAntwoordveld(rid)
      loadParty(groupId)
    })()
  }

  const roundKeyTotal = (r: Round) => drinks.reduce((s, d) => s + (Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0)) * priceOf(d), 0)
  // Drankjes (met aantal) van een rondje — gebruikt op het afreken-scherm én in het overzicht.
  const drinksOf = (r: Round) => drinks
    .map((d) => ({ d, n: Object.values(r.orders[d.id] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[d.id] ?? 0) }))
    .filter((x) => x.n > 0)
  // Wat dit rondje "waard" is. Vulde iemand een bedrag in, dan telt dat. Zo niet
  // (modus "gewoon rondjes"), dan de som van de richtprijzen.
  //
  // Dit is de brug die het mogelijk maakt om ACHTERAF alsnog af te rekenen zonder dat
  // er ooit een bedrag is ingevuld. En hij kost bijna niets: de Fair Split rekende AL
  // met richtprijzen — die bepaalden ieders AANDEEL, en `amount` was enkel de
  // schaalfactor. Valt die weg, dan blijft het aandeel staan.
  const roundValue = (r: Round) => (r.amount > 0.005 ? r.amount : roundKeyTotal(r))

  // Wie was er TOEN bij? Onbekende drankjes worden gedeeld over de mensen die aan dít
  // rondje deelnamen — niet over het huidige aantal. Anders betaalt een laatkomer mee
  const personRoundShare = (r: Round, pid: string) => {
    const leden = roundMembers(r)
    // Zat deze persoon niet in dit rondje? Dan draagt hij er niets aan bij.
    if (!leden.includes(pid)) return 0
    const n = leden.length || 1
    const bedrag = roundValue(r)
    // De deler telt alleen de drankjes van wie in dit rondje zat, plus de onbekende.
    // Vroeger telde hij álle drankjes: stond er nog iets op naam van iemand die niet
    // in het rondje zat, dan zat dat wél in de deler maar betaalde niemand het — en
    // kwam de eerlijke verdeling samen lager uit dan het totaal van de avond.
    const anon = drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0) * priceOf(d), 0)
    const kt = leden.reduce((som, lid) => som + drinks.reduce((a, d) => a + (r.orders[d.id]?.[lid] ?? 0) * priceOf(d), 0), 0) + anon
    if (kt <= 0 || bedrag <= 0) return bedrag / n
    const own = drinks.reduce((a, d) => a + (r.orders[d.id]?.[pid] ?? 0) * priceOf(d), 0)
    return ((own + anon / n) / kt) * bedrag
  }
  const consumption = (pid: string) => rounds.reduce((s, r) => s + personRoundShare(r, pid), 0)
  // In "gewoon rondjes" is er nooit een bedrag ingevuld -> toon de geschatte waarde.
  const grandTotal = useMemo(() => rounds.reduce((s, r) => s + roundValue(r), 0), [rounds]) // eslint-disable-line
  const isSchatting = useMemo(() => rounds.length > 0 && rounds.every((r) => r.amount <= 0.005), [rounds])
  const equalShare = people.length ? grandTotal / people.length : 0

  const roundCupEur = (r: Round, pid: string) => (roundPicked(r, pid) - (r.gaveBack[pid] || 0)) * depositPerCupEur
  const cupOwn = (pid: string) => (depositOn ? rounds.reduce((s, r) => s + roundCupEur(r, pid), 0) : 0)
  const roundParts = (r: Round) => { const potPart = r.potPart || 0; const persons = r.payers || {}; const personSum = Object.values(persons).reduce((a, b) => a + (b || 0), 0); const base = potPart + personSum; const cupSum = depositOn ? people.reduce((a, pp) => a + roundCupEur(r, pp.id), 0) : 0; return { potPart, persons, personSum, base, cupSum } }
  const paidByPerson = (pid: string) => rounds.reduce((s, r) => { const { persons, base, cupSum } = roundParts(r); const own = persons[pid] || 0; if (own <= 0) return s; return s + own + (base > 0 ? cupSum * (own / base) : 0) }, 0)
  // ── Samen afrekenen ─────────────────────────────────────────────────────────
  // Bewust GEEN gedeelde plaats: dan deelt een koppel ook één telefoon en kan de
  // tweede zijn eigen drankje niet aantikken. Iedereen houdt dus zijn plaats en zijn
  // drankjes; enkel de eindafrekening wordt samengeteld. Halverwege van gedachten
  // veranderen kan, zonder dat er iets aan de bestellingen wijzigt.
  // Samen afrekenen als koppel is eruit: het bespaarde één overschrijving, maar de
  // verrekening staat nu per persoon in de eindbalans, dus dat won niets meer. De
  // groepering blijft als kern bestaan — ze krijgt alleen nooit nog meer dan één
  // persoon per partij. De kolom settle_with in de databank blijft ongebruikt staan;
  // ook oude groepen waar nog een koppel in zit vallen daardoor terug op losse personen.
  const settleGroups = useMemo(() => {
    const g: Record<string, Person[]> = {}
    people.forEach((p) => { (g[p.id] ??= []).push(p) })
    return Object.entries(g).map(([key, leden]) => ({
      key, leden,
      label: leden.map((p) => p.name).join(" & "),
      samen: leden.length > 1,
    })).sort((a, b) => Math.min(...a.leden.map((p) => p.seat)) - Math.min(...b.leden.map((p) => p.seat)))
  }, [people])

  // Drie bolletjes met het stapnummer ernaast: klein genoeg om niet te storen,
  // duidelijk genoeg om te weten hoeveel er nog komt.
  const stapBalk = (nu: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
      <span style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3].map((n) => (
          <span key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: n <= nu ? "#1f8a4c" : "#e0e5ec" }} />
        ))}
      </span>
      <span style={{ fontSize: 13, color: "#8b93a3", fontWeight: 800 }}>{L.stepOf(nu, 3)}</span>
    </div>
  )

  const settlement = useMemo(() => {
    const paid: Record<string, number> = {}; people.forEach((p) => (paid[p.id] = 0)); let potPaid = 0
    rounds.forEach((r) => {
      const { potPart, persons, base, cupSum } = roundParts(r)
      if (base <= 0) { if (potPart > 0) potPaid += potPart + cupSum; return }
      Object.entries(persons).forEach(([pid, amt]) => { const a = amt || 0; if (a > 0) paid[pid] = (paid[pid] ?? 0) + a + cupSum * (a / base) })
      if (potPart > 0) potPaid += potPart + cupSum * (potPart / base)
    })
    // Per persoon, en daarna opgeteld per afreken-groepje. Wie alleen afrekent, is een
    // groepje van één — dan verandert er niets aan de uitkomst.
    const perPerson: Record<string, number> = {}
    people.forEach((p) => { perPerson[p.id] = (paid[p.id] ?? 0) + contribOf(p.id) - consumption(p.id) - cupOwn(p.id) - cardLossPer })
    const nets: { id: string; label: string; net: number }[] = settleGroups.map((g) => ({
      id: g.key, label: g.label,
      net: g.leden.reduce((a, p) => a + (perPerson[p.id] ?? 0), 0),
    }))
    if (potContribTotal > 0 || potSpent > 0) nets.push({ id: "pot", label: "de pot", net: potPaid - potContribTotal + (potIsCard ? Math.max(0, potRemaining) : 0) })
    const creditors = nets.filter((n) => n.net > 0.005).map((n) => ({ ...n })).sort((a, b) => b.net - a.net)
    const debtors = nets.filter((n) => n.net < -0.005).map((n) => ({ ...n, net: -n.net })).sort((a, b) => b.net - a.net)
    const tx: { from: string; to: string; amount: number }[] = []; let i = 0, j = 0
    while (i < debtors.length && j < creditors.length) { const amt = Math.min(debtors[i].net, creditors[j].net); tx.push({ from: debtors[i].label, to: creditors[j].label, amount: amt }); debtors[i].net -= amt; creditors[j].net -= amt; if (debtors[i].net < 0.005) i++; if (creditors[j].net < 0.005) j++ }
    return { tx }
  }, [rounds, people, settleGroups, potRounds, potContribTotal, potSpent, potIsCard, potRemaining, depositOn, depositValue, depositUnit, coinValue, drinks, pay]) // eslint-disable-line
  const anyUnassignedRounds = rounds.some((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
  // Totaal aantal drankjes dat over ALLE afgeronde rondjes nog anoniem staat, plus de
  // index van het eerste rondje waar iets ontbreekt. Voor de waarschuwing op de hub.
  const unassignedAllRounds = rounds.reduce((s, r) => s + drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0), 0)
  const firstUnassignedIdx = rounds.findIndex((r) => drinks.some((d) => (r.anon[d.id] ?? 0) > 0))
  const drinkTotalRound = (r: Round, did: string) => Object.values(r.orders[did] ?? {}).reduce((a, b) => a + b, 0) + (r.anon[did] ?? 0)
  const paidLabel = (r: Round) => {
    const potP = r.potPart || 0
    const entries = Object.entries(r.payers || {}).filter(([, a]) => (a || 0) > 0)
    const parts: string[] = []
    if (potP > 0) parts.push(`${potIsCard ? "kaart" : "pot"} ${euro(potP)}`)
    entries.forEach(([pid, a]) => parts.push(`${people.find((p) => p.id === pid)?.name ?? "?"} ${euro(a)}`))
    if (parts.length === 0) return L.notPaidYet
    if (parts.length === 1 && entries.length === 1) return `door ${people.find((p) => p.id === entries[0][0])?.name ?? "?"}`
    if (parts.length === 1 && potP > 0) return potIsCard ? L.fromCard : L.fromPot
    return parts.join(" + ")
  }

  // De crèmekleurige vlakken van tegels, velden en pillen. In de QR-modus horen die koel
  // te zijn, anders blijft het scherm geel ogen ondanks alle randen.
  // Welke look draagt de sessie? QR = koel teal; uitgebreid opnemen = inktblauw;
  // snel = amber. De Fair Split-overstap vanuit zelf opnemen zet settle aan voor de
  // rekenlogica, maar de belevíng blijft zelf opnemen — dus kleuren we dan niet om.
  // Dat was precies de storende achtergrondwissel halverwege de avond.
  const themaTeal = !!groupId && settle && !fromQuick && opNaam !== true
  // Eén zelf-noteer-modus betekent ook één kleur: amber. Het aparte "uitgebreid"-
  // thema (paars/slate) bestaat niet meer; MODUS_NAAM blijft alleen voor accenten.
  const themaNaam = false
  const koel = themaTeal
  // De kleur van alles wat "aan" of "gekozen" is. Stond overal los in de code op goud,
  // waardoor vensters en tellers geel bleven in de QR-modus.
  const AAN = koel ? MODUS_FAIR.knop : themaNaam ? MODUS_NAAM.knop : "linear-gradient(135deg,#f0a500,#e08a00)"
  const RAND = koel ? "#0a4f5b" : themaNaam ? "#2b3450" : "#1d2942"
  const RANDTEKST = koel ? "#7fe3f2" : themaNaam ? "#c3cbe4" : "#F5B301"
  const VLAK1 = koel ? "#f2fafb" : themaNaam ? "#f1f3f9" : "#faf7ec"
  const VLAK2 = koel ? "#f7fcfd" : themaNaam ? "#f7f9fc" : "#fdfaf2"
  const VLAK3 = koel ? "#e4f2f5" : themaNaam ? "#e6eaf4" : "#f3ead2"
  const S = {
    page: { minHeight: "100dvh", overflowX: "clip", maxWidth: "100vw", background: groupId ? (koel ? MODUS_FAIR.bladzij : themaNaam ? MODUS_NAAM.bladzij : MODUS_SNEL.bladzij) : "#fdf6e3", color: "#1d2942", fontFamily: "system-ui,-apple-system,sans-serif", padding: "0 0 90px" } as React.CSSProperties,
    wrap: { maxWidth: 560, margin: "0 auto", padding: "calc(env(safe-area-inset-top, 0px) + 114px) 16px 16px" } as React.CSSProperties,
    card: { background: "#fff", border: `1.5px solid ${koel ? "#0a4f5b" : themaNaam ? "#2b3450" : "#1d2942"}`, borderRadius: 18, padding: 16, marginBottom: 13, boxShadow: koel ? "0 4px 16px -8px rgba(13,124,140,0.22)" : themaNaam ? "0 4px 16px -8px rgba(59,72,106,0.2)" : "0 4px 16px -8px rgba(29,41,66,0.25)" } as React.CSSProperties,
    h1: { fontSize: 26, fontWeight: 800, margin: "0 0 2px" } as React.CSSProperties,
    h3: { fontSize: 19.5, fontWeight: 800, margin: "0 0 10px" } as React.CSSProperties,
    sub: { fontSize: 17.5, color: "#6b7484", margin: "0 0 12px", lineHeight: 1.55 } as React.CSSProperties,
    btn: { border: `1.5px solid ${koel ? "#0a4f5b" : themaNaam ? "#2b3450" : "#1d2942"}`, background: "#fff", color: koel ? MODUS_FAIR.tekst : themaNaam ? MODUS_NAAM.tekst : "#1d2942", borderRadius: 12, padding: "12px 16px", fontSize: 18, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
    btnP: { border: "none", background: koel ? "#0a4f5b" : themaNaam ? "#2b3450" : "#1d2942", color: koel ? "#7fe3f2" : themaNaam ? "#c3cbe4" : "#F5B301", borderRadius: 14, padding: "16px 18px", fontSize: 20, fontWeight: 800, cursor: "pointer", width: "100%", boxShadow: koel ? `0 4px 14px -5px ${MODUS_FAIR.gloed}` : themaNaam ? `0 4px 14px -5px ${MODUS_NAAM.gloed}` : "0 4px 14px -5px rgba(29,41,66,0.55)" } as React.CSSProperties,
    input: { border: "1px solid rgba(29,41,66,0.22)", borderRadius: 10, padding: "11px 12px", fontSize: 19, color: "#1d2942", outline: "none", width: 94, textAlign: "right" } as React.CSSProperties,
    seg: (on: boolean) => ({ flex: 1, textAlign: "center", padding: "10px 6px", borderRadius: 999, fontSize: 15.5, fontWeight: 600, cursor: "pointer", background: on ? RAND : "transparent", boxShadow: on ? `0 2px 6px -2px ${RAND}73` : "none", color: on ? RANDTEKST : "#1d2942" } as React.CSSProperties),
    // De baan waarin twee of drie segmenten liggen: één object, zodat het als één
    // keuze leest en niet als losse knoppen die je allebei kan aanzetten.
    segBaan: { display: "flex", background: "#eef1f6", border: "1.5px solid rgba(29,41,66,0.28)", borderRadius: 999, padding: 3 } as React.CSSProperties,
    step: { width: 42, height: 42, borderRadius: 11, border: `1px solid ${koel ? "rgba(13,124,140,0.22)" : themaNaam ? "rgba(59,72,106,0.22)" : "rgba(29,41,66,0.18)"}`, background: koel ? "#e4f2f5" : VLAK3, color: koel ? MODUS_FAIR.tekst : themaNaam ? "#3b486a" : "#8a5e0f", fontSize: 24.5, fontWeight: 800, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
    chip: (n: number) => ({ position: "relative", display: "inline-flex", alignItems: "center", padding: n > 0 ? "6px 6px 6px 13px" : "7px 13px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer", userSelect: "none", border: n > 0 ? `1.5px solid ${RAND}` : "1.5px solid rgba(29,41,66,0.4)", background: n > 0 ? RAND : "#fff", color: n > 0 ? RANDTEKST : "#1d2942" } as React.CSSProperties),
    badge: { marginLeft: 6, background: RANDTEKST, color: RAND, borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 } as React.CSSProperties,
    pill: { fontSize: 15, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: "rgba(29,41,66,0.08)", color: "#6b7484" } as React.CSSProperties,
    row: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
    tab: (on: boolean) => ({ padding: "9px 14px", borderRadius: 20, fontSize: 17.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", background: on ? (themaNaam ? "#232c44" : "#1d2942") : VLAK3, color: on ? "#fff" : (themaNaam ? "#5a6a94" : "#6b7484") } as React.CSSProperties),
    overlay: { position: "fixed", inset: 0, background: "rgba(38,32,14,0.62)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 14 } as React.CSSProperties,
    sheet: { background: "#fff", borderRadius: 20, padding: 20, width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" } as React.CSSProperties,
  }
  const potTag = (
    <span onClick={() => setShowPot(true)} style={{ ...S.pill, cursor: "pointer", padding: "5px 11px", fontSize: 15.5, display: "inline-flex", alignItems: "center", gap: 6, background: potZicht > 0 ? "rgba(31,138,76,0.14)" : "rgba(29,41,66,0.08)", color: potZicht > 0 ? "#1f8a4c" : "#6b7484" }}>{potRemaining < -0.005 && <span style={{ color: "#c0554a" }}>⚠️ </span>}{potIsCard ? <>💳 drankkaart </> : <><ZakjeIcoon size={15} /> pot </>}{euro(potZicht)}<span style={{ color: "#8a93ad", fontWeight: 700 }}> / {potInlegKort}</span><span style={{ color: "#c98a00", fontWeight: 800 }}> + toevoegen</span></span>
  )
  const renderPotModal = () => (
    <div style={{ ...S.overlay, zIndex: 60 }} onClick={closePot}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...S.row, justifyContent: "space-between", margin: "0 0 8px" }}>
          <h3 style={{ ...S.h3, fontSize: 21.5, margin: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{potIsCard ? L.drinkCard : L.potTitle}
              {(potRounds.length === 0 || potBuilderOpen || editPotId !== null) && (
                <span style={{ fontSize: 14, fontWeight: 700, color: "#6b7484", marginLeft: 8 }}>
                  · {editPotId !== null ? L.editDeposit : (potRounds.length === 0 ? L.firstDeposit : L.addDeposit)}
                </span>
              )}
            </span>
            {/* Meteen zichtbaar wat er nu in zit — dat is waarom je dit venster opent. */}
            <span style={{ fontSize: 18, fontWeight: 800, color: potRemaining > 0.005 ? "#2f6fb5" : "#c0554a" }}>{euro(potRemaining)}</span>
          </h3>
          {/* Hier stond een tweede teller voor hetzelfde aantal personen. Die van het
              inlegblok hieronder is groter, heeft een label en staat waar je hem nodig hebt —
              twee knopjes voor dezelfde waarde vlak boven elkaar is alleen verwarrend.
              Staat het inlegblok dicht (er is al ingelegd), dan pas je het aantal aan door
              die inleg te bewerken; het aantal hoorde bij díé inleg. */}
          {!settle && potRounds.length > 0 && !potBuilderOpen && editPotId === null && (
            <span style={{ fontSize: 17, fontWeight: 700, color: "#6b7484", whiteSpace: "nowrap" }}>👤 {headcount < 1 ? "—" : headcount}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ ...S.pill, background: "rgba(29,41,66,0.08)", color: "#8a5e0f", fontSize: 15.5, padding: "4px 10px" }}>ingelegd {euro(potContribTotal)}</span>
          {potSpent > 0 && <span style={{ ...S.pill, background: "rgba(47,111,181,0.12)", color: "#2f6fb5", fontSize: 15.5, padding: "4px 10px" }}>besteed {euro(potSpent)}</span>}
          <span style={{ ...S.pill, background: potRemaining > 0 ? "rgba(47,111,181,0.14)" : "rgba(224,104,92,0.14)", color: potRemaining > 0 ? "#2f6fb5" : "#c0554a", fontSize: 15.5, padding: "4px 10px", fontWeight: 800 }}>nog {euro(potRemaining)}</span>
        </div>


        {potRounds.map((r, i) => {
          const tot = Object.values(r.amounts).reduce((a, b) => a + (b || 0), 0)
          const who = people.filter((pp) => (r.amounts[pp.id] || 0) > 0)
          return (
            <div key={r.id} style={{ background: editPotId === r.id ? "rgba(47,111,181,0.16)" : "#eef4fb", borderRadius: 12, padding: "11px 13px", marginBottom: 8, border: editPotId === r.id ? "1px solid rgba(47,111,181,0.55)" : "1px solid transparent" }}>
              <div style={{ ...S.row, justifyContent: "space-between" }}>
                <div style={{ ...S.row, gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#3f7fc4", color: "#fff", fontSize: 15.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942" }}>{L.nthDeposit(i + 1)}</span>
                </div>
                <div style={{ ...S.row, gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#2f6fb5" }}>{euro(tot)}</span>
                  {editPotId === r.id ? (
                    <span style={{ fontSize: 15.5, color: "#2f6fb5", fontWeight: 800 }}>{L.beingEdited}</span>
                  ) : (settle ? rounds.length === 0 : potSpent < 0.005) ? (
                    <div style={{ ...S.row, gap: 8 }}>
                      <span style={{ fontSize: 17, color: "#c0554a", cursor: "pointer", fontWeight: 700 }} onClick={() => removePotRound(r.id, `${i + 1}e inleg`)}>🗑️</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 14.5, color: "#9aa3b2" }}>🔒</span>
                  )}
                </div>
              </div>
              {settle && who.length > 0 && (
                <div style={{ fontSize: 15.5, color: "#6b7484", marginTop: 5, paddingLeft: 30 }}>{who.map((pp) => `${pp.name} ${euro(r.amounts[pp.id] || 0)}`).join(" · ")}</div>
              )}
            </div>
          )
        })}

        {(potRounds.length === 0 || potBuilderOpen || editPotId !== null) ? (
        <>
        {potIsCard ? (
        <div style={{ background: "rgba(47,111,181,0.06)", border: "1px dashed rgba(47,111,181,0.45)", borderRadius: 12, padding: 11, marginTop: 4 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#2f5693" }}>{editPotId !== null ? "✏️ kaart wijzigen" : "➕ Drankkaart inleggen"}</span>
            {potDraftTotal > 0 && <span style={{ fontSize: 16, fontWeight: 800, color: "#2f6fb5" }}>+{euro(potDraftTotal)}</span>}
          </div>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{L.cardValue}</span>
            <div style={{ ...S.row, gap: 4 }}><span style={{ fontSize: 17, color: "#6b7484", fontWeight: 700 }}>€</span><input style={{ ...S.input, width: 80 }} type="text" inputMode="decimal" placeholder="15" value={cardValue} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setCardValue(v); if (settle) applyCard(cardPayers, v); else setPotDraft({ pot: parseFloat(v.replace(",", ".")) || 0 }) }} /></div>
          </div>
          {settle && <>
          <div style={{ fontSize: 15.5, color: "#6b7484", fontWeight: 700, marginBottom: 6 }}>{L.whoBoughtCard}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            <span onClick={cardSelectAll} style={{ ...S.pill, cursor: "pointer", fontSize: 16, padding: "6px 12px", background: "rgba(47,111,181,0.14)", color: "#2f6fb5", fontWeight: 800, border: "1px dashed rgba(47,111,181,0.5)" }}>{L.everyone}</span>
            {people.map((p) => { const on = cardPayers.includes(p.id); const amt = potDraft[p.id] || 0; return <span key={p.id} onClick={() => toggleCardPayer(p.id)} style={{ ...S.pill, cursor: "pointer", fontSize: 16, padding: "6px 12px", background: on ? "linear-gradient(135deg,#3f7fc4,#2f6fb5)" : "rgba(240,165,0,0.1)", color: on ? "#fff" : "#8a5e0f", fontWeight: 700 }}>{p.name} {on ? euro(amt) : "€0"}</span> })}
          </div>
          </>}
        </div>
        ) : (
        <div style={{ background: "rgba(47,111,181,0.06)", border: "1px dashed rgba(47,111,181,0.45)", borderRadius: 12, padding: 11, marginTop: 4 }}>
          {settle ? (
          <>
          {settle && (
            <div style={{ background: MODUS_FAIR.vlak, borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: MODUS_FAIR.tekst, minWidth: 0 }}>{L.withHowMany}</span>
                <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => { const laatste = [...people].reverse().find((pp) => !pp.claimedBy && !pp.named); if (laatste) removePerson(laatste.id) }}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: `1px solid ${MODUS_FAIR.randZacht}`, fontSize: 20, cursor: "pointer", fontFamily: "inherit", color: MODUS_FAIR.tekst,
                      opacity: people.some((pp) => !pp.claimedBy && !pp.named) ? 1 : 0.35 }}>−</button>
                  <b style={{ fontSize: 21, color: "#1d2942", minWidth: 20, textAlign: "center" }}>{people.length}</b>
                  <span style={{ fontSize: 13, color: MODUS_FAIR.label }}>{L.persWordLow}</span>
                  <button onClick={() => void addPerson()}
                    style={{ width: 32, height: 32, borderRadius: "50%", background: MODUS_FAIR.rand, border: "none", color: "#fff", fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>＋</button>
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: MODUS_FAIR.label, marginTop: 4 }}>{L.seatsFillLater}</div>
            </div>
          )}
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 15, color: "#1d2942", fontWeight: 800 }}>{L.equalSplit}</span>
            <span style={{ fontSize: 15, color: "#c0554a", fontWeight: 700, cursor: "pointer" }} onClick={resetPotDraft}>{L.resetContrib}</span>
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {(settle ? [10, 20, 30, 40, 50] : [5, 10, 20, 30]).map((v) => {
              const on = everyoneChoice === v
              return <button key={v} style={{ ...S.btn, padding: "5px 12px", fontSize: 17, background: on ? "linear-gradient(135deg,#3f7fc4,#2f6fb5)" : "#fff", color: on ? "#fff" : "#1d2942", border: on ? "none" : "1px solid rgba(29,41,66,0.18)" }} onClick={() => { setEveryoneChoice(v); setEveryoneDraft(""); setEveryoneAmt(v) }}>€{v}</button>
            })}
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 15.5, color: "#6b7484" }}>{L.ownAmount}</span>
            <input style={{ ...S.input, width: 76, padding: "5px 8px", fontSize: 18, borderColor: everyoneChoice === "custom" ? "#2f6fb5" : "rgba(29,41,66,0.22)" }} type="text" inputMode="decimal" placeholder="€" value={everyoneDraft} onChange={(e) => setEveryoneDraft(e.target.value.replace(/[^0-9.,]/g, ""))} />
            <button style={{ ...S.btn, padding: "5px 11px", fontSize: 15.5, opacity: (parseFloat(everyoneDraft.replace(",", ".")) || 0) > 0 ? 1 : 0.5 }} onClick={() => { const v = parseFloat(everyoneDraft.replace(",", ".")) || 0; if (v > 0) { setEveryoneChoice("custom"); setEveryoneAmt(v) } }}>toepassen</button>
          </div>
          {(!settle || people.filter((p) => p.claimedBy || p.named).length > 1) && people.map((p) => (
            <div key={p.id} style={{ ...S.row, gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(29,41,66,0.08)" }}>
              <span style={{ fontSize: 17.5, fontWeight: 800, width: 112, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{contribOf(p.id) > 0 && <span style={{ fontSize: 14.5, fontWeight: 700, color: "#6b7484" }}> · {euro(contribOf(p.id))}</span>}</span>
              <input style={{ ...S.input, width: 71, padding: "5px 8px", fontSize: 18, flexShrink: 0 }} type="text" inputMode="decimal" placeholder="€" value={potDraft[p.id] ?? ""} onChange={(e) => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: parseFloat(e.target.value.replace(",", ".")) || 0 })) }} />
              <button style={{ ...S.btn, padding: "5px 9px", fontSize: 15.5, color: "#c0554a", flexShrink: 0 }} onClick={() => { setEveryoneChoice(null); setPotDraft((c) => ({ ...c, [p.id]: 0 })) }}>↺</button>
              <span style={{ fontSize: 17, fontWeight: 800, marginLeft: "auto", textAlign: "right", color: (potDraft[p.id] || 0) > 0 ? "#2f6fb5" : "#9aa3b2" }}>{(potDraft[p.id] || 0) > 0 ? "+" + euro(potDraft[p.id] || 0) : "+€0"}</span>
            </div>
          ))}
          </>
          ) : (
          <>
          {/* Snelle rondjes: iedereen legt hetzelfde in. Totaal = per man × aantal.
              Het aantal staat hier, zodat elke inleg weet voor hoeveel mensen hij gold. */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#eef1f6", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#1d2942" }}>{L.potHowManyQ}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <button style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "1px solid rgba(29,41,66,0.25)", fontSize: 20, color: "#6b7484", fontWeight: 800, cursor: "pointer", opacity: (opNaam === true && !settle ? people.some((pp) => !pp.named) && people.length > 1 : headcount > 1) ? 1 : 0.4 }} onClick={() => { if (opNaam === true && !settle) { const laatste = [...people].reverse().find((pp) => !pp.named); if (laatste && people.length > 1) removePerson(laatste.id) } else setHeadcount((n) => Math.max(1, n - 1)) }}>−</button>
              <span style={{ fontSize: 21, fontWeight: 800, minWidth: 22, textAlign: "center", color: "#1d2942" }}>{potHoofden}</span>
                    <span style={{ fontSize: 13, color: "#6b7484" }}>{L.persWordLow}</span>
              <button style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#3f7fc4,#2f6fb5)", border: "none", fontSize: 20, color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => { if (opNaam === true && !settle) void addPerson(); else setHeadcount((n) => n < 1 ? 2 : n + 1) }}>+</button>
                  </span>
          </div>
          <div style={{ ...S.row, gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 21, color: "#6b7484", fontWeight: 700 }}>€</span>
            <input style={{ ...S.input, flex: 1, fontSize: 21, fontWeight: 800, padding: "10px 12px", color: "#2f5693", textAlign: "right" }} type="text" inputMode="decimal" placeholder="0,00"
              {...bedragVeld("potPerMan", potPerMan, setPotPerMan)} />
            <span style={{ fontSize: 17, color: "#6b7484", fontWeight: 700, whiteSpace: "nowrap" }}>{L.perManShort}</span>
          </div>
          <div style={{ ...S.row, gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {[10, 20, 30, 40, 50].map((v) => (
              <button key={v} style={{ ...S.btn, flex: 1, padding: "8px 6px", fontSize: 17, fontWeight: 800, background: potPerMan === v ? "linear-gradient(135deg,#3f7fc4,#2f6fb5)" : "#fff", color: potPerMan === v ? "#fff" : "#1d2942", border: potPerMan === v ? "none" : "1px solid rgba(29,41,66,0.18)" }} onClick={() => setPotPerMan(v)}>€{v}</button>
            ))}
            <button style={{ ...S.btn, padding: "8px 11px", fontSize: 15.5, color: "#c0554a" }} onClick={() => setPotPerMan(0)}>↺</button>
          </div>
          {(() => {
            const nieuweInleg = potPerMan * potHoofden
            const alIn = potRemaining // wat er NU nog in zit (na eerder uitgeven)
            const heeftPot = potContribTotal > 0.005
            return heeftPot ? (
              <div style={{ background: "rgba(47,111,181,0.07)", borderRadius: 12, padding: "11px 13px" }}>
                <div style={{ ...S.row, justifyContent: "space-between", fontSize: 16, color: "#4a5567", marginBottom: 4 }}>
                  <span>{L.alreadyInPot}</span><span style={{ fontWeight: 700 }}>{euro(alIn)}</span>
                </div>
                <div style={{ ...S.row, justifyContent: "space-between", fontSize: 16, color: "#2f5693", marginBottom: 7 }}>
                  <span>{L.nowAdding}</span><span style={{ fontWeight: 700 }}>+ {euro(nieuweInleg)}</span>
                </div>
                <div style={{ ...S.row, justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(47,111,181,0.22)", paddingTop: 7 }}>
                  <span style={{ fontSize: 17, color: "#2f5693", fontWeight: 800 }}>{L.newPotTotal}</span>
                  <span style={{ fontSize: 21, color: "#2f6fb5", fontWeight: 800 }}>{euro(alIn + nieuweInleg)}</span>
                </div>
              </div>
            ) : (
              <div style={{ ...S.row, justifyContent: "center", alignItems: "baseline", gap: 8, padding: "11px", background: "rgba(47,111,181,0.08)", borderRadius: 12 }}>
                <span style={{ fontSize: 17, color: "#2f5693", fontWeight: 700 }}>{L.potTotalIn}</span>
                <span style={{ fontSize: 23, fontWeight: 800, color: "#2f6fb5" }}>{euro(nieuweInleg)}</span>
              </div>
            )
          })()}
          </>
          )}
        </div>
        )}
        {editPotId !== null ? (
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={cancelEditPot}>✕ annuleer</button>
            <button style={{ ...S.btnP, flex: 2, background: "linear-gradient(135deg,#3f7fc4,#2f6fb5)", boxShadow: "0 4px 12px -4px rgba(47,111,181,0.55)" }} onClick={saveEditPot}>{potDraftTotal > 0 ? L.addContrib(euro(potDraftTotal)) : L.removeContrib}</button>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <button style={{ ...S.btnP, width: "100%", background: "linear-gradient(135deg,#3f7fc4,#2f6fb5)", boxShadow: "0 4px 12px -4px rgba(47,111,181,0.55)" }} onClick={saveQuickPot}>{potDraftTotal > 0
              ? (!settle && potContribTotal > 0.005 ? L.setPotTo(euro(potRemaining + potDraftTotal)) : L.addContrib(euro(potDraftTotal)))
              : L.ready}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 15.5, padding: "9px 6px", color: "#8b93a3" }}
              onClick={() => { setPotDraft({}); setPotPerMan(0); if (potRounds.length === 0) setShowPot(false); else setPotBuilderOpen(false) }}>✕ {L.cancel}</button>
          </div>
        )}
        </>
        ) : (
          <div>
            {potRounds.length > 0 && (
              <div style={{ ...S.row, justifyContent: "space-between", padding: "10px 13px", background: "rgba(47,111,181,0.08)", borderRadius: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#2f5693" }}>{L.potTotalIn}</span>
                <span style={{ fontSize: 21.5, fontWeight: 800, color: "#2f6fb5" }}>{euro(potContribTotal)}</span>
              </div>
            )}
            {potJustAdded ? (
              // Net iets ingelegd: afronden is nu de logische stap.
              <>
                <button style={{ ...S.btnP, width: "100%", marginTop: 4, background: "linear-gradient(135deg,#3f7fc4,#2f6fb5)", boxShadow: "0 4px 12px -4px rgba(47,111,181,0.55)" }} onClick={closePot}>{L.ready}</button>
                <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 15.5, padding: "9px 6px", color: "#2f5693", border: "1px solid rgba(47,111,181,0.4)" }} onClick={() => setPotBuilderOpen(true)}>{L.addMoreToPot}</button>
              </>
            ) : (
              <>
                <button style={{ ...S.btnP, width: "100%", marginTop: 4, background: "linear-gradient(135deg,#3f7fc4,#2f6fb5)", boxShadow: "0 4px 12px -4px rgba(47,111,181,0.55)" }} onClick={() => setPotBuilderOpen(true)}>{L.addPotContrib}</button>
                <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 15.5, padding: "9px 6px" }} onClick={closePot}>{L.ready}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
  // Verwijzing naar de zusterapp. Dicht is het een strook; open toont ze het
  // welkomscherm van Resto, met vanaf daar pas de stap naar de app zelf.
  const renderRestoVerwijzing = (opDonker = true) => (
            <div style={{ marginTop: 32, background: opDonker ? "rgba(255,255,255,0.04)" : "#fff", border: `1${opDonker ? "px" : ".5px"} solid rgba(79,209,197,0.${opDonker ? "45" : "6"})`, borderRadius: 14, padding: 13 }}>
              {!restoInfo ? (
                <div onClick={() => setRestoInfo(true)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                    <span style={{ fontSize: 13.5, color: opDonker ? "#9fb0b3" : "#4a6e73", minWidth: 0, lineHeight: 1.35 }}>{L.atRestaurantQ}</span>
                    <span style={{ marginLeft: "auto", flexShrink: 0 }}><RundoLogo size={26} resto opDonker={opDonker} /></span>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(79,209,197,0.3)", paddingTop: 9, textAlign: "center", fontSize: 13, color: opDonker ? "#4FD1C5" : "#0f7d90", fontWeight: 700 }}>{L.seeWhatRestoDoes} ▾</div>
                </div>
              ) : (
                <div style={{ background: "#0d1520", borderRadius: 14, padding: 14, margin: -13, position: "relative" }}>
                  <button onClick={() => setRestoInfo(false)}
                    style={{ position: "absolute", top: 10, right: 11, width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "#9fb8bd", fontSize: 15, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>✕</button>
                  <span style={{ display: "block", marginBottom: 10 }}><RundoLogo size={40} resto /></span>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                    <span style={{ fontSize: 17 }}>🧾</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#4FD1C5" }}>{L.restoTagline}</span>
                  </div>
                  {/* Om beurten links en rechts, net als op het echte welkomscherm van
                      Resto: dat leest als een pad in plaats van een lijst. */}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                    {[["📷", L.restoStep1], ["📱", L.restoStep2], ["👆", L.restoStep3], ["💶", L.restoStep4]].map(([icoon, tekst], n, rij) => (
                      <div key={n} style={{ display: "flex", justifyContent: "center", padding: "8px 0",
                        borderBottom: n < rij.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexDirection: n % 2 === 1 ? "row-reverse" : "row" }}>
                          <span style={{ position: "relative", flexShrink: 0, width: 46, height: 46, borderRadius: "50%", background: "rgba(91,159,214,0.16)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                            {icoon}
                            <span style={{ position: "absolute", top: -5, right: -6, width: 21, height: 21, borderRadius: "50%", background: "#5b9fd6", color: "#0f1c26", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800 }}>{n + 1}</span>
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 500, color: "#d9d2bd" }}>{tekst}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
                    <button onClick={() => setRestoInfo(false)}
                      style={{ flex: 1, cursor: "pointer", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 12, padding: 11, fontSize: 14, fontWeight: 600, color: "#9fb8bd", fontFamily: "inherit" }}>{L.closeWord}</button>
                    <a href={RESTO_URL} style={{ flex: 1.5, textDecoration: "none", background: "linear-gradient(135deg,#4FD1C5,#0d7c8c)", borderRadius: 12, padding: 11, fontSize: 15, fontWeight: 700, color: "#08313a", textAlign: "center" }}>{L.tryItBtn} →</a>
                  </div>
                </div>
              )}
            </div>
  )

  const renderDialogs = () => (
    <>
        {assignIdx !== null && rounds[assignIdx] && (() => {
          // "Alles meteen" toont elk rondje in één lijst; "per rondje" toont er precies één
          // en springt daarna door naar het volgende dat nog namen mist.
          const toonIdx = assignAllMode
            ? rounds.map((_, i) => i).filter((i) => drinks.some((d) => drinkTotalRound(rounds[i], d.id) > 0))
            : [assignIdx]
          const done = !toonIdx.some((i) => drinks.some((d) => (rounds[i].anon[d.id] ?? 0) > 0))
          const volgende = assignAllMode ? -1 : rounds.findIndex((rr, i) => i !== assignIdx && drinks.some((d) => (rr.anon[d.id] ?? 0) > 0))
          const naarVolgende = done && volgende >= 0
          const nogOpen = rounds.filter((rr) => drinks.some((d) => (rr.anon[d.id] ?? 0) > 0)).length
          return (
            <div style={S.overlay} onClick={() => { settleNaToewijzen.current = false; setAssignIdx(null); setAssignAllMode(false) }}>
              <div style={{ ...S.sheet, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.assignTitle}</h3>
                <div style={{ fontSize: 15, color: "#6b7484", fontWeight: 700, marginBottom: 10 }}>
                  {assignAllMode ? L.assignAllSub(toonIdx.length) : L.roundXofY(assignIdx + 1, rounds.length)}
                </div>

                {/* Twee schakelaars onder elkaar: eerst hoe je toewijst, dan waarop. De
                    tweede stond eerst als knop met wisselende tekst, en dan moest je lezen
                    wat er zou gebeuren in plaats van te zien waar je staat. */}
                <div style={{ ...S.segBaan, display: "flex", marginBottom: 8 }}>
                  <div style={{ ...S.seg(editAssignMode === "person"), flex: 1, padding: "8px 6px", fontSize: 15, textAlign: "center" }} onClick={() => setEditAssignMode("person")}>{L.perPerson}</div>
                  <div style={{ ...S.seg(editAssignMode === "drink"), flex: 1, padding: "8px 6px", fontSize: 15, textAlign: "center" }} onClick={() => setEditAssignMode("drink")}>{L.perDrink}</div>
                </div>
                {rounds.length > 1 && (
                  <div style={{ ...S.segBaan, display: "flex", marginBottom: 10 }}>
                    <div style={{ ...S.seg(assignAllMode), flex: 1, padding: "8px 6px", fontSize: 15, textAlign: "center" }} onClick={() => setAssignAllMode(true)}>{L.allRoundsSeg}</div>
                    <div style={{ ...S.seg(!assignAllMode), flex: 1, padding: "8px 6px", fontSize: 15, textAlign: "center" }} onClick={() => setAssignAllMode(false)}>{L.thisRoundSeg}</div>
                  </div>
                )}
                {!settle && (
                  <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 10px" }}>
                    <button onClick={() => { setPersGeteld(true); setAlleenPers(true); setPersSnap(people.map((pp) => ({ id: pp.id, name: pp.name }))); setNaamPlichtNa(null); setNaamPlicht(true) }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "2px solid rgba(47,111,181,0.55)", background: "#f2f6fc", color: "#2f5693", borderRadius: 999, padding: "8px 14px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      ＋ {L.addPersonHere}
                    </button>
                  </div>
                )}

                {toonIdx.map((idx) => {
                  const r = rounds[idx]
                  const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
                  const un = roundDrinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0)
                  return (
                    <div key={r.id} style={{ marginBottom: toonIdx.length > 1 ? 16 : 0 }}>
                      {toonIdx.length > 1 && (
                        <div style={{ ...S.row, justifyContent: "space-between", background: un > 0 ? "rgba(224,104,92,0.1)" : MODUS_FAIR.tint, borderRadius: 9, padding: "7px 11px", marginBottom: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: un > 0 ? "#b0402f" : MODUS_FAIR.tekst }}>{L.roundWord} {idx + 1} <span style={{ fontWeight: 600, opacity: 0.75 }}>· {L.drinksCount(roundDrinks.reduce((a, d) => a + drinkTotalRound(r, d.id), 0))}</span></span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: un > 0 ? "#b0402f" : MODUS_FAIR.rand }}>{un > 0 ? `🔴 ${un}` : "✓"}</span>
                        </div>
                      )}
                      {toonIdx.length === 1 && un > 0 && editAssignMode === "person" && (
                        <div style={{ fontSize: 15.5, fontWeight: 800, color: "#c0554a", marginBottom: 8 }}>🔴 {L.notAssignedYet(un)}</div>
                      )}
                      {editAssignMode === "drink" ? roundDrinks.map((d) => {
                        const dun = r.anon[d.id] ?? 0
                        return (
                          <div key={d.id} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 5 }}>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}{dun > 0 && <span style={{ color: "#c0554a", fontWeight: 700 }}> · 🔴 {L.toAssignCount(dun)}</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {people.map((p) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={p.id} style={{ ...S.chip(n) }} onClick={() => rAssignFromAnon(idx, d.id, p.id)}>{opNaam === true && p.id === meId && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}><KroonIcoon size={14} kleur="#8a5e0f" gevuld /></span>}{p.name}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 17.5, fontWeight: 800, lineHeight: 1 }}>−</span>}</span>
                              )})}
                            </div>
                          </div>
                        )
                      }) : (<div style={{ display: people.length > 4 ? "grid" : "block", gridTemplateColumns: people.length > 4 ? "1fr 1fr" : undefined, columnGap: 12 }}>{people.map((p) => {
                        const took = roundDrinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
                        return (
                          <div key={p.id} style={{ marginBottom: 9 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opNaam === true && p.id === meId && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}><KroonIcoon size={14} kleur="#8a5e0f" gevuld /></span>}{p.name}{took.length > 0 && <span style={{ fontSize: 14.5, fontWeight: 600, color: "#6b7484" }}> · {took.reduce((a, d) => a + (r.orders[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {roundDrinks.filter((d) => (r.orders[d.id]?.[p.id] ?? 0) > 0).map((d) => { const n = r.orders[d.id]?.[p.id] ?? 0; return (
                                <span key={d.id} style={{ ...S.chip(n) }}>{d.emoji} {d.name}<span style={S.badge}>{n}</span><span onClick={(e) => { e.stopPropagation(); rUnassign(idx, d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 17.5, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>−</span></span>
                              )})}
                              {roundDrinks.filter((d) => (r.anon[d.id] ?? 0) > 0).map((d) => (
                                <span key={"add" + d.id} onClick={() => rAssignFromAnon(idx, d.id, p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", fontSize: 16, borderRadius: 20, background: "#fff", border: "1px dashed rgba(29,41,66,0.4)", color: "#6b7484", fontWeight: 700, cursor: "pointer" }}>+ {d.emoji} {d.name}
                                  {/* Zonder dit getal zie je per persoon niet hoeveel er nog
                                      te verdelen valt — per drank staat dat er wél. */}
                                  <span style={{ marginLeft: 2, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "rgba(224,104,92,0.16)", color: "#c0554a", fontSize: 14, fontWeight: 800 }}>{r.anon[d.id] ?? 0}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}</div>)}
                    </div>
                  )
                })}

                {/* Alles rond? Dan een duidelijk groen vinkje in plaats van een gewone knop. */}
                {done && (
                  <div style={{ background: settle ? MODUS_FAIR.tint : "rgba(31,138,76,0.1)", border: `1.5px solid ${settle ? MODUS_FAIR.randZacht : "rgba(31,138,76,0.45)"}`, borderRadius: 11, padding: "12px 13px", marginTop: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>✅</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#1f6b3a" }}>{naarVolgende ? L.roundDoneNext : nogOpen === 0 ? L.allAssignedDone : L.roundDoneShort}</div>
                  </div>
                )}
                {/* Alles rond en je kwam uit de snelle modus? Dan zelf kiezen of je
                    doorgaat of nog iets bijstelt — geen automatische sprong. */}
                {done && !naarVolgende && fromQuick ? (
                  <>
                    <button style={{ ...S.btnP, marginTop: 10, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" }}
                      onClick={() => { setAssignIdx(null); setAssignAllMode(false); setView("payers") }}>{L.toStep3}</button>
                    <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 16, fontWeight: 700, color: "#6b7484" }}
                      onClick={() => { setAssignIdx(null); setAssignAllMode(false); setView("fairSetup") }}>{L.backToNames}</button>
                  </>
                ) : (
                  <button style={done ? { ...S.btnP, marginTop: 10, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" } : { ...S.btnP, marginTop: 10 }}
                    onClick={() => { if (naarVolgende) setAssignIdx(volgende); else { setAssignIdx(null); setAssignAllMode(false); if (settleNaToewijzen.current) { settleNaToewijzen.current = false; if (done) goQuickSettle(); else { setFromQuick(false); setView("roundsOverview") } } } }}>
                    {naarVolgende ? L.nextRoundAssign(volgende + 1) : L.ready}
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      {/* Avond afgesloten: rustige bevestiging zonder termijnen, met de afrekening
          als deelbaar tekstje erbij — dan staat het resultaat veilig bij iedereen. */}
      {afsluitKaart && (
        <div style={{ ...S.overlay, zIndex: 75 }}>
          <div style={S.sheet}>
            <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.eveClosedTitle}</h3>
            <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 14, lineHeight: 1.5 }}>{L.eveClosedSub}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.btn, flex: 1, fontSize: 15.5, fontWeight: 800 }} onClick={() => { void deelAfrekening() }}>{L.shareBillBtn}</button>
              <button style={{ ...S.btnP, flex: 1, fontSize: 15.5, fontWeight: 800 }} onClick={() => { setAfsluitKaart(false); setNotice(L.thanksClosed); goSiteHome() }}>{L.ready}</button>
            </div>
              <div style={{ marginTop: 12 }}>{renderRestoVerwijzing(false)}</div>
          </div>
        </div>
      )}
      {/* Namenvenster bij het afrekenen (uitgebreid): enkel de gast-namen die nog
          openstaan. Invullen is welkom maar nooit verplicht — de eindbalans rekent
          even goed met "Gast 2" als etiket. */}
      {naamVenster !== null && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setNaamVenster(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 4 }}>{L.guestsWhoTitle}</h3>
            <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 12, lineHeight: 1.45 }}>{L.guestsWhoSub}</div>
            {Object.keys(naamVenster).map((pid) => { const pp = people.find((x) => x.id === pid); return pp ? (
              <div key={pid} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ flexShrink: 0, width: 62, fontSize: 15, color: "#8b93a3", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pp.name || "?"}</span>
                <input value={naamVenster[pid]} onChange={(e) => setNaamVenster((c) => ({ ...(c || {}), [pid]: e.target.value }))}
                  placeholder={L.namePh2} style={{ ...S.input, flex: 1, minWidth: 0, boxSizing: "border-box", background: "#fff", padding: "9px 11px", fontSize: 18, textAlign: "left" }} />
              </div>
            ) : null })}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button style={{ ...S.btn, flex: 1, fontSize: 15.5, fontWeight: 800 }}
                onClick={() => { setNaamVenster(null); naarEindbalans() }}>{L.leaveAsIs}</button>
              <button style={{ ...S.btnP, flex: 1, fontSize: 15.5, fontWeight: 800 }}
                onClick={() => {
                  Object.entries(naamVenster).forEach(([pid, nm]) => { if (nm.trim()) renamePerson(pid, nm.trim()) })
                  setNaamVenster(null); naarEindbalans()
                }}>{L.toBalanceBtn}</button>
            </div>
          </div>
        </div>
      )}
      {showBarlijst && (() => {
        // Alleen dít rondje: dat is wat je aan de toog gaat bestellen. Bij een lopend
        // rondje het mandje, anders het laatst afgeronde rondje.
        const totalen: Record<string, number> = barNaRondje ? { ...barNaRondje } : {}
        if (!barNaRondje) {
          const lopend = drinks.reduce((a, d) => a + drinkTotal(d.id), 0) > 0
          if (lopend) drinks.forEach((d) => { const n = drinkTotal(d.id); if (n > 0) totalen[d.id] = n })
          else { const laatste = rounds[rounds.length - 1]; if (laatste) drinksOf(laatste).forEach(({ d, n }) => { totalen[d.id] = n }) }
        }
        const lijst = drinks.filter((d) => (totalen[d.id] || 0) > 0).map((d) => ({ d, n: totalen[d.id] })).sort((a, b) => b.n - a.n || a.d.name.localeCompare(b.d.name))
        const som = lijst.reduce((a, x) => a + x.n, 0)
        // Na een bevestigd rondje is dit geen venster dat je wegtikt maar een stap: je
        // gaat ermee naar de toog. Vandaar geen sluitknop en geen wegtikken op de
        // achtergrond — één van beide knoppen onderaan brengt je verder.
        const sluitBar = () => { setShowBarlijst(false); setBarNaRondje(null) }
        const naarDrankjes = async () => {
          const laatste = rounds[rounds.length - 1]
          sluitBar()
          if (!laatste) { setActiveCat(catsPresent[0]); setView("order"); return }
          const { error } = await supabase.from("party_rounds").update({ status: "open", closed_at: null }).eq("id", laatste.id)
          if (error) { setNotice("Rondje heropenen mislukt: " + error.message); return }
          setRoundNr(rounds.length)
          setLastRoundHandled(true)
          setActiveCat(catsPresent[0])
          if (groupId) await loadParty(groupId)
          setView("order")
        }
        const naarOverzicht = (openKlappen: boolean) => {
          sluitBar()
          setLastRoundHandled(true)
          if (openKlappen) setOpenRound(Math.max(0, rounds.length - 1))
          setEditCups(false); setEditPay(false)
          setOverviewBackTo("hub"); setView("roundsOverview")
        }
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#fbf3e4", overflowY: "auto", padding: "18px 16px 28px" }} onClick={() => { if (!barNaRondje) sluitBar() }}>
            <div style={{ maxWidth: 430, margin: "0 auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: "0.01em", color: "#1d2942" }}>🔍 {L.barlistTitle}</div>
                {barNaRondje
                  ? <span style={{ flexShrink: 0, fontSize: 16, fontWeight: 800, color: "#c98a00", whiteSpace: "nowrap" }}>{L.barlistPieces(som)}</span>
                  : <button onClick={sluitBar} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: RAND, color: RANDTEKST, height: 50, padding: "0 20px", borderRadius: 999, fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ {L.closeWord}</button>}
              </div>
              <div style={{ fontSize: 15, color: "#6b7484", fontWeight: 700, margin: "2px 0 14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName.trim() || L.autoName()} · {rounds.length} {L.roundWord.toLowerCase()}{rounds.length === 1 ? "" : "s"} · {L.drinksCount(som)}</div>
              <div style={{ ...S.card, padding: "6px 16px", background: "#fcfdfe" }}>
                {lijst.map(({ d, n }, i) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "12px 0", borderBottom: i < lijst.length - 1 ? "1px solid rgba(29,41,66,0.1)" : "none" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 20, fontWeight: 800, color: "#1d2942" }}>{d.emoji} {d.name}</span>
                    <span style={{ flexShrink: 0, fontSize: 21.5, fontWeight: 800, color: "#c98a00" }}>{n}×</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Sticky, niet fixed: bij een kort lijstje staan de knoppen er meteen onder
                in plaats van een half scherm lager, en bij een lang rondje plakken ze
                alsnog onderaan zodat je niet eerst terug moet scrollen. */}
            {barNaRondje && (
              <div style={{ position: "sticky", bottom: 0, marginTop: 16, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)", background: "linear-gradient(180deg,rgba(251,243,228,0),#fbf3e4 22%)" }} onClick={(e) => e.stopPropagation()}>
                <div style={{ maxWidth: 430, margin: "0 auto", display: "flex", gap: 9, paddingTop: 14 }}>
                  <button onClick={naarDrankjes} style={{ flex: 1, background: "#fff", border: `1.5px solid ${RAND}`, color: RAND, borderRadius: 13, padding: "13px 6px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{L.barlistAdjust}</button>
                  <button onClick={() => naarOverzicht(false)} style={{ flex: 1.3, background: RAND, border: "none", color: RANDTEKST, borderRadius: 13, padding: "13px 6px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{L.barlistDone} →</button>
                </div>
              </div>
            )}
          </div>
        )
      })()}
      {waarGebleven && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setWaarGebleven(null)}>
          <div style={{ ...S.sheet, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <button aria-label="✕" onClick={() => setWaarGebleven(null)}
              style={{ float: "right", margin: "-4px -4px 0 0", width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(29,41,66,0.08)", color: "#6b7484", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>✕</button>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#1d2942", marginBottom: 2 }}>{L.whereLeftTitle}</div>
            <div style={{ fontSize: 14.5, color: "#6b7484", marginBottom: 11 }}>{L.whereLeftSub}</div>
            {/* Alleen groepen van de gekozen modus, recentste eerst. Verder is één tik;
                het venster wegdoen (✕, ernaast tikken of gewoon nieuw starten) ook. */}
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {waarGebleven.groepen.map((g) => (
                <div key={g.id} onClick={() => geblevenVerder(g.id)}
                  style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", border: "1.5px solid rgba(232,168,18,0.55)", background: "rgba(240,165,0,0.07)", borderRadius: 11, padding: "10px 11px", marginBottom: 7 }}>
                  <span style={{ flexShrink: 0, fontSize: 18 }}>{g.settle ? "📱" : "✍️"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: "#1d2942", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || L.autoName()} <span style={{ fontWeight: 700, color: "#8b93a3", fontSize: 14 }}>({datumKort(g.last_active)})</span></span>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#8b93a3" }}>{(() => { const d = new Date(g.last_active); return isNaN(d.getTime()) ? "" : `${d.getDate()}/${d.getMonth() + 1}` })()}{g.owned ? "" : ` · ${L.asGuest}`}</span>
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 14.5, fontWeight: 800, color: "#c98a00", whiteSpace: "nowrap" }}>{L.whereLeftGo} ›</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 10px" }}>
              <span style={{ flex: 1, height: 1, background: "rgba(29,41,66,0.14)" }} />
              <span style={{ fontSize: 14.5, color: "#8b93a3", fontWeight: 700 }}>{L.orWord}</span>
              <span style={{ flex: 1, height: 1, background: "rgba(29,41,66,0.14)" }} />
            </div>
            <button style={{ ...S.btnP, width: "100%", fontSize: 17.5, padding: "13px 14px" }} onClick={geblevenNieuw}>{L.whereLeftNew}</button>
          </div>
        </div>
      )}
      {confirmDlg && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setConfirmDlg(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...S.h3, fontSize: 20 }}>{L.confirmTitle}</h3>
            <p style={{ fontSize: 17.5, color: "#1d2942", lineHeight: 1.55, marginBottom: 16, whiteSpace: "pre-line" }}>{confirmDlg.msg}</p>
            {confirmDlg.variant === "danger" ? (
              <>
                <button style={{ ...S.btnP, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)", boxShadow: "none" }} onClick={() => setConfirmDlg(null)}>{confirmDlg.no ?? L.backFinish}</button>
                <button style={{ background: "none", border: "none", width: "100%", marginTop: 10, fontSize: 16, color: "#c0554a", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
              </>
            ) : (
              <>
                {confirmDlg.no ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={{ ...S.btn, flex: 1, fontSize: 16, padding: "11px 4px" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
                      <button style={{ ...S.btnP, flex: 1, fontSize: 17, padding: "11px 4px" }} onClick={() => { const f = confirmDlg?.onNo; setConfirmDlg(null); f && f() }}>{confirmDlg.no}</button>
                    </div>
                    <button style={{ background: "none", border: "none", width: "100%", marginTop: 11, fontSize: 16, color: "#8b93a3", fontWeight: 700, cursor: "pointer" }} onClick={() => setConfirmDlg(null)}>{L.cancel}</button>
                  </>
                ) : (
                  <>
                    <button style={{ ...S.btnP, background: "linear-gradient(135deg,#e0685c,#c0554a)", boxShadow: "none" }} onClick={confirmDlg.onYes}>{confirmDlg.yes}</button>
                    <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => { const f = confirmDlg?.onNo; setConfirmDlg(null); f && f() }}>← terug</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {slaapt && groupId && (
        <div onClick={() => { laatsteActie.current = Date.now(); setSlaapt(false) }}
          style={{ position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 3000, background: "rgba(29,41,66,0.92)", color: "#fff", padding: "9px 16px", borderRadius: 999, fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 24px rgba(29,41,66,0.35)", whiteSpace: "nowrap" }}>
          {L.sleepBanner}
        </div>
      )}
      {zitNaam && (
        <div style={{ ...S.overlay, zIndex: 72 }} onClick={() => setZitNaam(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d2942", marginBottom: 4 }}>{L.seatNameTitle}</div>
            <div style={{ fontSize: 16, color: "#6b7484", lineHeight: 1.45, marginBottom: 13 }}>{L.seatNameSub}</div>
            <input autoFocus value={zitNaamTekst} onChange={(e) => setZitNaamTekst(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && zitNaamTekst.trim()) { renamePerson(zitNaam.id, zitNaamTekst.trim()); setZitNaam(null); setZitNaamTekst("") } }}
              placeholder={L.yourName}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, marginBottom: 13 }} />
            <button disabled={!zitNaamTekst.trim()}
              onClick={() => { renamePerson(zitNaam.id, zitNaamTekst.trim()); setZitNaam(null); setZitNaamTekst("") }}
              style={{ ...S.btnP, width: "100%", opacity: zitNaamTekst.trim() ? 1 : 0.5, cursor: zitNaamTekst.trim() ? "pointer" : "default" }}>{L.addThis}</button>
            <button onClick={() => { setZitNaam(null); setZitNaamTekst("") }} style={{ width: "100%", marginTop: 9, background: "none", border: "none", cursor: "pointer", fontSize: 17.5, fontWeight: 700, color: "#8b93a3" }}>{L.cancel}</button>
          </div>
        </div>
      )}
      {/* Wie gaat halen bevestigt eerst; pas daarna weet de rest ervan. */}
      {/* Tikte je op een drankje terwijl er geen rondje loopt? Dan legt dit uit waarom er
          niets gebeurt, en staat de weg vooruit meteen in hetzelfde venster. */}
      {potVraag && meId && (() => {
        const bedrag = Math.max(0, parseFloat(potVraagBedrag.replace(",", ".")) || 0)
        const inleggers = people.map((pp) => ({ pp, a: potRounds.reduce((t, r) => t + (r.amounts[pp.id] || 0), 0) })).filter((x) => x.a > 0.005)
        return (
        <div style={{ ...S.overlay, zIndex: 78 }}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 30, marginBottom: 7 }}>🪙</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#1d2942", marginBottom: 6 }}>{L.groupPutIn(euro(potContribTotal))}</div>
            <div style={{ fontSize: 15, color: MODUS_FAIR.tekst, lineHeight: 1.55, marginBottom: 13 }}>{L.thatIsEach(euro(potVraag.voorstel))}</div>

            {/* Wie wat legde, dicht tenzij je het wil zien — en meteen de plek om je
                eigen bedrag te zetten als je iets anders bijlegt. */}
            <div onClick={() => setPotVraagOpen((v) => !v)}
              style={{ cursor: "pointer", border: `1px solid ${MODUS_FAIR.lijnZacht}`, borderRadius: 10, padding: "9px 12px", marginBottom: 13, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, color: "#1d2942" }}>
              <span style={{ fontWeight: potVraagOpen ? 700 : 400 }}>{L.whoPutWhat}</span>
              <span style={{ color: MODUS_FAIR.label }}>{potVraagOpen ? "▴" : "▾"}</span>
            </div>
            {potVraagOpen && (
              <div style={{ textAlign: "left", border: `1px solid ${MODUS_FAIR.lijnZacht}`, borderRadius: 10, padding: "4px 12px 11px", marginTop: -8, marginBottom: 13 }}>
                {inleggers.map(({ pp, a }) => (
                  <div key={pp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(29,41,66,0.08)", fontSize: 14.5 }}>
                    <span style={{ color: "#1d2942", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pp.name}</span>
                    <b style={{ color: MODUS_FAIR.rand, flexShrink: 0 }}>{euro(a)}</b>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 9, marginTop: 5, borderTop: `1.5px solid ${MODUS_FAIR.randZacht}` }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1d2942" }}>{L.jijNaam}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, color: MODUS_FAIR.label }}>€</span>
                    <input value={potVraagBedrag} onChange={(e) => setPotVraagBedrag(e.target.value)} type="text" inputMode="decimal"
                      style={{ ...S.input, width: 78, padding: "6px 10px", textAlign: "right", fontSize: 16, fontWeight: 800, color: MODUS_FAIR.rand, border: `1.5px solid ${MODUS_FAIR.rand}` }} />
                  </span>
                </div>
              </div>
            )}

            <button disabled={bedrag <= 0.005} onClick={() => { void joinPot(bedrag); setPotVraag(null) }}
              style={{ width: "100%", boxSizing: "border-box", cursor: bedrag > 0.005 ? "pointer" : "not-allowed", border: "none", borderRadius: 12, padding: "13px 10px", fontSize: 16, fontWeight: 600, fontFamily: "inherit", color: "#fff", background: MODUS_FAIR.knop, opacity: bedrag > 0.005 ? 1 : 0.5, marginBottom: 8 }}>
              {L.iPutIn(euro(bedrag))}</button>
            <button onClick={() => setPotVraag(null)}
              style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 12, padding: "12px 10px", fontSize: 14.5, fontWeight: 600, fontFamily: "inherit" }}>{L.settleApart}</button>
          </div>
        </div>
        )
      })()}
      {geenRondje && (
        <div style={{ ...S.overlay, zIndex: 75 }} onClick={() => setGeenRondje(false)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#1d2942", marginBottom: 7 }}>{L.noRoundTitle}</div>
            <div style={{ fontSize: 16, color: MODUS_FAIR.tekst, lineHeight: 1.5, marginBottom: 15, maxWidth: 290, marginLeft: "auto", marginRight: "auto" }}>{L.noRoundBody}</div>
            <button onClick={() => { setGeenRondje(false); setStartCheck(true) }}
              style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", border: "none", borderRadius: 12, padding: "13px 10px", fontSize: 16.5, fontWeight: 600, fontFamily: "inherit", color: "#fff", background: MODUS_FAIR.knop, marginBottom: 8 }}>{L.roundTogether}</button>
            <button onClick={() => setGeenRondje(false)}
              style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 12, padding: "12px 10px", fontSize: 14.5, fontWeight: 600, fontFamily: "inherit" }}>{L.justLooking}</button>
          </div>
        </div>
      )}
      {/* Kreeg je een duwtje terwijl je nog niets koos? Eén venster, met beide uitwegen. */}
      {herinnering && (
        <div style={{ ...S.overlay, zIndex: 75 }} onClick={() => setHerinnering(false)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 21.5, fontWeight: 800, color: "#1d2942", marginBottom: 6 }}>{L.reminderTitle}</div>
            <div style={{ fontSize: 17, color: "#6b7484", lineHeight: 1.5, marginBottom: 15 }}>{L.reminderBody(runnerName())}</div>
            <button onClick={() => { setHerinnering(false); setGuestTab("order"); setActiveCat(catsPresent[0]) }} style={{ ...S.btnP, width: "100%", padding: "13px 0", fontSize: 18.5, fontWeight: 800 }}>{L.reminderChoose}</button>
            <button onClick={() => { setHerinnering(false); void antwoordRondje("skip") }} style={{ width: "100%", marginTop: 9, background: "none", border: "none", cursor: "pointer", fontSize: 17, fontWeight: 700, color: "#8b93a3" }}>{L.nothingForMeBtn}</button>
          </div>
        </div>
      )}
      {barFull && (
        <div style={{ ...S.overlay, zIndex: 80 }} onClick={() => setBarFull(false)}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: MODUS_FAIR.tekst, borderRadius: 18, padding: "22px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em", marginBottom: 14 }}>{L.roundWord} {roundNr} · {L.forTheBar}</div>
            {(haalInfo?.items?.length ? haalInfo.items : barTotalen()).map((x, i, arr) => (
              <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 4px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>{x.n}×</span>
                <span style={{ fontSize: 22, color: "#fff" }}>{x.emoji} {x.naam}</span>
              </div>
            ))}
            <button onClick={() => setBarFull(false)} style={{ width: "100%", marginTop: 16, cursor: "pointer", border: "none", background: "#fff", color: MODUS_FAIR.tekst, borderRadius: 11, padding: "12px 0", fontSize: 17, fontWeight: 800 }}>{L.closeWord}</button>
          </div>
        </div>
      )}
      {openMelding && (
        <div style={{ ...S.overlay, zIndex: 77 }} onClick={() => setOpenMelding(false)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>🍻</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: MODUS_FAIR.tekst, marginBottom: 14 }}>{L.everyoneCanTapNow}</div>
            <button onClick={() => setOpenMelding(false)} style={{ ...S.btnP, width: "100%", padding: "13px 0", fontSize: 17, fontWeight: 600 }}>{L.goingToDrinks}</button>
          </div>
        </div>
      )}
      {allenKlaar && (
        <div style={{ ...S.overlay, zIndex: 75 }} onClick={() => setAllenKlaar(false)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 30, marginBottom: 5 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1f6b3a", marginBottom: 6 }}>{L.allChoseTitle}</div>
            <div style={{ fontSize: 16, color: "#5a8f99", lineHeight: 1.5, marginBottom: 13 }}>{ikHaalNu ? L.allChoseYou : L.allChoseGuest(runnerName())}</div>
            {ikHaalNu && <div style={{ textAlign: "left", marginBottom: 13 }}>{renderBarLijst()}</div>}
            <button onClick={() => setAllenKlaar(false)} style={{ ...S.btnP, width: "100%", padding: "13px 0", fontSize: 18, fontWeight: 800 }}>{ikHaalNu ? L.toTheBarBtn : L.okWord}</button>
          </div>
        </div>
      )}
      {naamWijzig !== null && (
        <div style={{ ...S.overlay, zIndex: 76 }} onClick={() => setNaamWijzig(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d2942", marginBottom: 4 }}>{L.changeNameTitle}</div>
            <div style={{ fontSize: 15.5, color: "#6b7484", lineHeight: 1.5, marginBottom: 12 }}>{L.changeNameSub}</div>
            <input autoFocus value={naamWijzig} onChange={(e) => setNaamWijzig(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { const n = naamWijzig.trim(); if (n && meId) renamePerson(meId, n); setNaamWijzig(null) } }}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontSize: 19, fontWeight: 700, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setNaamWijzig(null)}
                style={{ flex: 1, minWidth: 0, cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 12, padding: "12px 6px", fontSize: 17, fontWeight: 800 }}>{L.cancel}</button>
              <button onClick={() => { const n = naamWijzig.trim(); if (n && meId) renamePerson(meId, n); setNaamWijzig(null) }}
                style={{ ...S.btnP, flex: 1.4, minWidth: 0, padding: "12px 6px", fontSize: 17.5, fontWeight: 800, opacity: naamWijzig.trim() ? 1 : 0.45 }}>{L.saveName}</button>
            </div>
          </div>
        </div>
      )}
      {noteerKeuze && (
        <div style={{ ...S.overlay, zIndex: 78 }} onClick={() => { setNoteerKeuze(false); setNoteerPick(null); setNoteerInfo(null) }}>
          <div style={{ ...S.sheet, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 19.5, fontWeight: 800, color: "#16203a", textAlign: "center", marginBottom: 2 }}>{L.howNoteTitle}</div>
            <div style={{ fontSize: 14, color: "#8b93a3", textAlign: "center", lineHeight: 1.5, marginBottom: 13 }}>{L.howNoteSub}</div>

            {/* Kiezen licht de kaart op; het vraagteken opent de uitleg. Twee aparte
                handelingen, zodat een tik naast het vraagteken geen keuze maakt. */}
            {([
              { id: "quick" as const, tag: L.fastestTag, titel: L.noteQuickTitle, stappen: [L.qStep1, L.qStep2, L.qStep3],
                rand: "rgba(232,168,18,0.5)", top: "#e8a812", vlak: "rgba(240,165,0,0.07)", tekst: "#8a5e0f" },
              { id: "named" as const, tag: L.fairestTag, titel: L.noteNamedTitle2, stappen: [L.nStep1, L.nStep2, L.nStep3],
                rand: "rgba(59,72,106,0.4)", top: "#3b486a", vlak: "rgba(59,72,106,0.06)", tekst: "#3b486a" },
            ]).map((k, idx) => {
              const gekozen = noteerPick === k.id
              const open = noteerInfo === k.id
              return (
                <div key={k.id}>
                  {idx === 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "13px 0" }}>
                      <span style={{ flex: 1, height: 1, background: "rgba(29,41,66,0.18)" }} />
                      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: "#fff", border: "1.5px solid rgba(29,41,66,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#8b93a3" }}>{L.orWord}</span>
                      <span style={{ flex: 1, height: 1, background: "rgba(29,41,66,0.18)" }} />
                    </div>
                  )}
                  <div onClick={() => { setNoteerPick(k.id); if (noteerInfo && noteerInfo !== k.id) setNoteerInfo(null) }}
                    style={{ position: "relative", overflow: "hidden", cursor: "pointer", borderRadius: 12, padding: 12,
                      background: k.vlak, border: `${gekozen ? 2.5 : 1.5}px solid ${gekozen ? k.top : k.rand}`,
                      borderTop: `3px solid ${k.top}`, boxShadow: gekozen ? `0 0 0 3px ${k.vlak}` : "none",
                      // Niet gekozen terwijl de ander dat wel is: licht gedempt, zodat je
                      // keuze eruit springt zonder dat de andere onleesbaar wordt.
                      opacity: noteerPick && !gekozen ? 0.62 : 1, transition: "opacity .15s" }}>
                    <span style={{ position: "absolute", top: 0, right: 0, background: k.top, color: "#fff", borderRadius: "0 0 0 10px", padding: "4px 10px 5px 12px", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em" }}>{k.tag}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5, fontWeight: 800,
                        background: gekozen ? k.top : "transparent", border: gekozen ? "none" : `2px solid ${k.rand}`, color: "#fff" }}>{gekozen ? "✓" : ""}</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: k.tekst }}>{k.titel}</span>
                    </div>
                    {k.stappen.map((t, n) => (
                      <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, marginBottom: n < 2 ? 4 : 0 }}>
                        <span style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
                          <span style={{ flexShrink: 0, color: "#1f8a4c", fontWeight: 800, fontSize: 15 }}>✓</span>
                          <span style={{ fontSize: 15, color: "#4a5567", lineHeight: 1.4 }}>{t}</span>
                        </span>
                        {n === 2 && (
                          <span onClick={(e) => { e.stopPropagation(); setNoteerInfo(open ? null : k.id) }}
                            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14.5, fontWeight: 800, cursor: "pointer",
                              background: open ? k.top : "transparent", color: open ? "#fff" : k.tekst, border: `1.5px solid ${k.top}` }}>?</span>
                        )}
                      </div>
                    ))}
                    {open && (
                      <div style={{ borderTop: `1px solid ${k.rand}`, marginTop: 11, paddingTop: 11 }}>
                        {k.id === "quick" ? (<>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 9 }}>
                            {[["3", "🍺"], ["2", "🥤"], ["1", "🍷"]].map(([n2, e2]) => (
                              <span key={e2} style={{ background: "#fff", border: "1px solid rgba(29,41,66,0.18)", borderRadius: 16, padding: "6px 11px", fontSize: 17, color: "#4a5567" }}><b>{n2}×</b> {e2}</span>
                            ))}
                          </div>
                          <div style={{ borderTop: "1px solid rgba(240,165,0,0.25)", paddingTop: 9 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#8b93a3", marginBottom: 3 }}>📋 {L.orderWord.toUpperCase()}</div>
                            <div style={{ fontSize: 15.5, color: "#1d2942" }}>{L.noteQuickExample}</div>
                          </div>
                        </>) : (<>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, textAlign: "center" }}>
                            {[{ d: "🍺", m: 1, n3: "Tom" }, { d: "🍷🍷", m: 3, n3: "Els" }, { d: "🍻", m: 2, n3: "Bart" }].map((x) => (
                              <div key={x.n3}>
                                <div style={{ fontSize: 21, height: 26, whiteSpace: "nowrap", letterSpacing: -3 }}>{x.d}</div>
                                <div style={{ height: 21, marginTop: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                                  {Array.from({ length: x.m }).map((_, q) => (
                                    <span key={q} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: "#f3d27c", border: "1px solid #d9a83c", fontSize: 13, fontWeight: 800, color: "#7a5a12" }}>€</span>
                                  ))}
                                </div>
                                <div style={{ fontSize: 14, marginTop: 3, color: "#6b7484", fontWeight: 700 }}>{x.n3}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ textAlign: "center", fontSize: 14, color: "#6b7484", marginTop: 9 }}>{L.nStep3.toLowerCase()}</div>
                        </>)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            <button disabled={!noteerPick}
              onClick={() => {
                if (noteerPick === "named") { setOpNaam(true); setNamenSetup(true) } else setOpNaam(false)
                setNoteerKeuze(false); setNoteerPick(null); setNoteerInfo(null)
              }}
              style={{ ...S.btnP, width: "100%", marginTop: 14, padding: "14px 0", fontSize: 18.5, fontWeight: 800, opacity: noteerPick ? 1 : 0.45,
                background: noteerPick === "named" ? "linear-gradient(135deg,#5a6a94,#3b486a)" : noteerPick === "quick" ? "linear-gradient(135deg,#f7cb5c,#eab117)" : "linear-gradient(135deg,#e3d9c2,#cfc3a6)",
                color: noteerPick === "named" ? "#fff" : noteerPick === "quick" ? "#1d2942" : "#6b7484",
                boxShadow: "none" }}>{L.nextBtn}</button>
          </div>
        </div>
      )}
      {walkCheck && (
        <div style={{ ...S.overlay, zIndex: 74 }} onClick={() => setWalkCheck(false)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 30, marginBottom: 5 }}>✍️</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d2942", marginBottom: 12 }}>{L.youWalkTitle}</div>
            <div style={{ textAlign: "left", marginBottom: 13 }}>
              {[L.walkStep1, L.walkStep2, L.walkStep3].map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < 2 ? 9 : 0 }}>
                  <span style={{ flexShrink: 0, color: "#1f8a4c", fontWeight: 800, fontSize: 19 }}>✓</span>
                  <span style={{ fontSize: 18, color: "#1d2942", lineHeight: 1.45 }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(240,165,0,0.13)", borderRadius: 11, padding: "10px 12px", marginBottom: 13, textAlign: "left" }}>
              <span style={{ flexShrink: 0 }}>💰</span>
              <span style={{ fontSize: 15, color: "#8a5e0f", lineHeight: 1.45 }}>{L.youAdvance}</span>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setWalkCheck(false)}
                style={{ flex: 1, minWidth: 0, cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 12, padding: "13px 6px", fontSize: 17, fontWeight: 800 }}>{L.ratherNot}</button>
              <button onClick={() => { setWalkCheck(false); void startAsRunner(); setWalkIdx(0) }}
                style={{ ...S.btnP, flex: 1.6, minWidth: 0, padding: "13px 6px", fontSize: 17.5, fontWeight: 800 }}>{L.yesIWalk}</button>
            </div>
          </div>
        </div>
      )}
      {startCheck && (() => {
        const vorige = rounds[rounds.length - 1]
        const stuks = vorige ? drinks.map((d) => ({ d, n: drinkTotalRound(vorige, d.id) })).filter((x) => x.n > 0) : []
        const herhaalbaar = stuks.length > 0
        const herhaalTekst = stuks.slice(0, 2).map((x) => `${x.n}× ${x.d.name}`).join(", ") + (stuks.length > 2 ? "…" : "")
        return (
        <div style={{ ...S.overlay, zIndex: 74 }} onClick={() => setStartCheck(false)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 13 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#1d2942", marginBottom: 5 }}>{L.youFetchTitle}</div>
              <div style={{ fontSize: 15, color: MODUS_FAIR.tekst, lineHeight: 1.55 }}>
📱 <b>{L.theyTap}</b> {L.theyTapRest}<br />
                <b>{L.youPay}</b> {L.youPayRest}
              </div>
            </div>
            {herhaalbaar && (
              <div style={{ background: MODUS_FAIR.vlak, border: `1px dashed ${MODUS_FAIR.randZacht}`, borderRadius: 11, padding: "10px 12px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 12.5, color: MODUS_FAIR.tekst, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{L.lastRoundWas(herhaalTekst)}</span>
                <button onClick={() => { setStartCheck(false); repeatRound(); void startAsRunner() }}
                  style={{ flexShrink: 0, cursor: "pointer", border: "none", background: MODUS_FAIR.rand, color: "#fff", borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>{L.sameAgainShort}</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setStartCheck(false)}
                style={{ flex: 1, minWidth: 0, cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 12, padding: "13px 6px", fontSize: 15, fontWeight: 600, fontFamily: "inherit" }}>{L.notMeShort}</button>
              <button onClick={() => { setStartCheck(false); void startAsRunner() }}
                style={{ ...S.btnP, flex: 1.6, minWidth: 0, padding: "13px 6px", fontSize: 16.5, fontWeight: 600 }}>{L.iFetchShort}</button>
            </div>
          </div>
        </div>
        )
      })()}
      {/* En de anderen krijgen te horen wie gaat en wat er van hen verwacht wordt. */}
      {rondjeMelding && (
        <div style={{ ...S.overlay, zIndex: 74 }} onClick={() => setRondjeMelding(null)}>
          <div style={{ ...S.sheet, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 5 }}>🍻</div>
            <div style={{ fontSize: 20.5, fontWeight: 800, color: "#1d2942", marginBottom: 12 }}>{rondjeMelding ? L.someoneFetches(rondjeMelding) : L.orderingOpen}</div>
            <div style={{ textAlign: "left", marginBottom: 14 }}>
              {(rondjeMelding
                ? [L.gFetchStep1, L.gFetchStep2, L.gFetchStep3(rondjeMelding)]
                : [L.openStep1, L.openStep2, L.openStep3]).map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < 2 ? 9 : 0 }}>
                  <span style={{ flexShrink: 0, color: "#1f8a4c", fontWeight: 800, fontSize: 19 }}>✓</span>
                  <span style={{ fontSize: 18, color: "#1d2942", lineHeight: 1.45 }}>{t}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { setRondjeMelding(null); setGuestTab("order"); setActiveCat(catsPresent[0]); if (view !== "order") setView("order") }} style={{ ...S.btnP, width: "100%", padding: "13px 0", fontSize: 18.5, fontWeight: 800 }}>{rondjeMelding ? L.letsChoose : L.okWord}</button>
          </div>
        </div>
      )}
      {aanvulIdx !== null && (() => {
        const r = rounds[aanvulIdx]
        const openDrankjes = unassignedAllRounds
        return (
          <div style={{ ...S.overlay, zIndex: 73 }}>
            <div style={{ ...S.sheet, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1d2942" }}>{L.aanvulTitle(aanvulIdx + 1, r ? (Object.values(r.orders || {}).reduce((n: number, m) => n + Object.values(m || {}).reduce((a: number, b) => a + Number(b || 0), 0), 0) + Object.values(r.anon || {}).reduce((a: number, b) => a + Number(b || 0), 0)) : 0)}</div>
              <div style={{ fontSize: 15, color: "#6b7484", lineHeight: 1.45, marginTop: 5 }}>{L.aanvulSub}</div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#1d2942" }}>{L.aanvulCost}</span>
                <input type="text" inputMode="decimal" placeholder="0,00" value={aanvulBedrag}
                  onChange={(e) => setAanvulBedrag(e.target.value.replace(/[^0-9.,]/g, ""))}
                  style={{ ...S.input, width: 96, fontSize: 17, fontWeight: 800, border: "1.5px solid rgba(240,165,0,0.55)" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                <span style={{ fontSize: 14, color: "#6b7484", fontWeight: 700 }}>{L.aanvulPaidBy}</span>
                {potContribTotal > 0.005 ? (
                  <button onClick={() => setAanvulBetaler("pot")}
                    style={{ border: aanvulBetaler === "pot" ? "none" : "1px solid rgba(47,111,181,0.4)", background: aanvulBetaler === "pot" ? "#2f6fb5" : "#fff", color: aanvulBetaler === "pot" ? "#fff" : "#2f5693", borderRadius: 10, padding: "7px 12px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    <ZakjeIcoon size={14} /> {L.potWord} <span style={{ fontWeight: 700, opacity: 0.8 }}>{euro(potZicht)}</span>
                  </button>
                ) : (
                  <button onClick={() => setShowPot(true)}
                    style={{ border: "1px dashed rgba(47,111,181,0.5)", background: "#f2f6fc", color: "#2f5693", borderRadius: 10, padding: "7px 12px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    <ZakjeIcoon size={14} /> + {L.potWord}
                  </button>
                )}
                {people.map((pp) => (
                  <button key={pp.id} onClick={() => setAanvulBetaler(pp.id)}
                    style={{ border: aanvulBetaler === pp.id ? "none" : "1px solid rgba(29,41,66,0.28)", background: aanvulBetaler === pp.id ? AAN : "#fff", color: aanvulBetaler === pp.id ? "#fff" : "#6b7484", borderRadius: 10, padding: "7px 12px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    {pp.id === meId ? `👑 ${L.youWord}` : pp.name}
                  </button>
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(29,41,66,0.14)", marginTop: 13, paddingTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 16, color: "#1d2942" }}>{L.aanvulAssign}</b><br />
                  <span style={{ fontSize: 14, color: openDrankjes > 0 ? "#8b93a3" : "#1f8a4c", fontWeight: openDrankjes > 0 ? 400 : 700 }}>{openDrankjes > 0 ? L.aanvulAssignSub(openDrankjes) : L.aanvulAssignOk}</span>
                </span>
                <button onClick={() => { setAssignNaamEdit(false); setShowAssignAll(true) }}
                  style={{ ...S.btn, flexShrink: 0, padding: "9px 14px", fontSize: 14.5, fontWeight: 800, borderColor: "rgba(240,165,0,0.6)", color: "#8a5e0f" }}>{L.assign} →</button>
              </div>

              <button style={{ ...S.btnP, width: "100%", marginTop: 14 }}
                onClick={() => {
                  const bedrag = parseFloat(aanvulBedrag.replace(",", ".")) || 0
                  if (r && bedrag > 0) {
                    const idx = aanvulIdx
                    if (aanvulBetaler === "pot") setRounds((rs) => rs.map((x, i) => i === idx ? { ...x, amount: bedrag, potPart: Math.min(bedrag, Math.max(0, potAvailFor(idx))), payers: {} } : x))
                    else if (aanvulBetaler) setRounds((rs) => rs.map((x, i) => i === idx ? { ...x, amount: bedrag, potPart: 0, payers: { [aanvulBetaler]: bedrag } } : x))
                    else setRounds((rs) => rs.map((x, i) => i === idx ? { ...x, amount: bedrag } : x))
                    setDirtyRound(idx)
                  }
                  setAanvulIdx(null); setAanvulBetaler(null); setAanvulBedrag("")
                }}>{L.aanvulSave}</button>
              <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 16, fontWeight: 800 }}
                onClick={() => { setAanvulIdx(null); setAanvulBetaler(null); setAanvulBedrag("") }}>{L.aanvulSkip}</button>
            </div>
          </div>
        )
      })()}
      {sluitNaam && (
        <div style={{ ...S.overlay, zIndex: 75 }}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d2942" }}>{L.closeEveBtn}</div>
            <div style={{ fontSize: 15, color: "#6b7484", lineHeight: 1.45, marginTop: 6 }}>{L.closeNeedName}</div>
            <input autoFocus value={sluitNaamVeld} onChange={(e) => setSluitNaamVeld(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && sluitNaamVeld.trim()) { const nm = sluitNaamVeld.trim(); setGroupName(nm); persistSettings({ name: nm }); setSluitNaam(false); void sluitAvondAf() } }}
              placeholder={L.namePh3}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, fontSize: 18, marginTop: 11, border: "2px solid rgba(240,165,0,0.6)" }} />
            <div style={{ fontSize: 14, color: "#c0554a", fontWeight: 700, marginTop: 8 }}>{L.nameRequiredHint}</div>
            <button disabled={!sluitNaamVeld.trim()}
              style={{ ...S.btnP, width: "100%", marginTop: 13, opacity: sluitNaamVeld.trim() ? 1 : 0.45 }}
              onClick={() => { const nm = sluitNaamVeld.trim(); if (!nm) return; setGroupName(nm); persistSettings({ name: nm }); setSluitNaam(false); void sluitAvondAf() }}>{L.closeAndSave}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 16, fontWeight: 800 }}
              onClick={() => setSluitNaam(false)}>{L.cancel}</button>
          </div>
        </div>
      )}
      {verlaatNaam && (
        <div style={{ ...S.overlay, zIndex: 74 }}>
          <div style={{ ...S.sheet, padding: 0, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const drankjesTot = rounds.reduce((a: number, r0) => a
                + Object.values(r0.orders || {}).reduce((x: number, m) => x + Object.values(m || {}).reduce((p: number, q) => p + Number(q || 0), 0), 0)
                + Object.values(r0.anon || {}).reduce((x: number, q) => x + Number(q || 0), 0), 0)
              const bewaar = () => { const nm = verlaatVeld.trim(); if (!nm) return nm; setGroupName(nm); persistSettings({ name: nm }); return nm }
              return (<>
                <div style={{ background: "linear-gradient(135deg,#e0725c,#c0554a)", color: "#fff", padding: "13px 16px", fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>⚠️ {L.leaveNoNameTitle}</div>
                <div style={{ padding: "14px 16px 16px" }}>
                {(rounds.length > 0 || potContribTotal > 0.005) && (
                  <div style={{ background: "rgba(224,104,92,0.08)", border: "1px solid rgba(224,104,92,0.35)", borderRadius: 11, padding: "10px 12px", marginTop: 10, fontSize: 15, color: "#b0402f", fontWeight: 700, lineHeight: 1.7 }}>
                    {rounds.map((r0, i0) => (
                      <div key={r0.id}>{L.leaveRoundLine(i0 + 1, Object.values(r0.orders || {}).reduce((x: number, m) => x + Object.values(m || {}).reduce((a: number, b) => a + Number(b || 0), 0), 0) + Object.values(r0.anon || {}).reduce((a: number, b) => a + Number(b || 0), 0))}</div>
                    ))}
                    {potContribTotal > 0.005 && <div>🪙 {L.potWord} {euro(potContribTotal)}</div>}
                  </div>
                )}
                <div style={{ fontSize: 15, color: "#6b7484", lineHeight: 1.45, marginTop: 10 }}>{L.leaveAutoSub}</div>
                <input autoFocus value={verlaatVeld} onChange={(e) => setVerlaatVeld(e.target.value)}
                  placeholder={L.namePh3}
                  style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, fontSize: 18, marginTop: 12, border: "2px solid rgba(240,165,0,0.6)" }} />
                {/* Bewaren en weggaan, of bewaren en gewoon verder doen — dat laatste
                    kon nergens anders. Zonder naam blijft alleen "toch weggaan" over. */}
                <button disabled={!verlaatVeld.trim()}
                  style={{ ...S.btnP, width: "100%", marginTop: 12, opacity: verlaatVeld.trim() ? 1 : 0.45 }}
                  onClick={() => { if (!bewaar()) return; const doe = verlaatNaam; setVerlaatNaam(null); setVerlaatVeld(""); doe?.() }}>{L.saveAndLeave}</button>
                {/* Weggaan zonder bewaren blijft mogelijk, maar als kleine link: het is de
                    uitzondering, niet een van drie gelijkwaardige keuzes. */}
                <div onClick={() => { const doe = verlaatNaam; setVerlaatNaam(null); setVerlaatVeld(""); doe?.() }}
                  style={{ textAlign: "center", marginTop: 13, fontSize: 13.5, fontWeight: 700, color: "#8b93a3", textDecoration: "underline", cursor: "pointer" }}>{L.leaveNoSaveBtn}</div>
                </div>
              </>)
            })()}
          </div>
        </div>
      )}
      {naamPlicht && (
        <div style={{ ...S.overlay, zIndex: 72 }}>
          <div style={{ ...S.sheet, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d2942", marginBottom: 4 }}>{alleenPers ? `👥 ${L.personsAndNames}` : `📝 ${L.namePlichtTitle}`}</div>
            {!alleenPers && <input autoFocus value={naamPlichtVeld} onChange={(e) => setNaamPlichtVeld(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && naamPlichtVeld.trim()) bewaarNaamPlicht() }}
              placeholder={L.namePh3}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, fontSize: 18, marginTop: 8, border: "2px solid rgba(240,165,0,0.6)" }} />}

            {/* Personen zijn optioneel: het vlak blijft grijs met een streepje tot je
                telt. De eerste tik zet jou plus één gast, en dan verschijnen meteen
                de naamvelden — één plek voor alles wat "uitgebreid" was. */}
            <div style={{ background: "#f1f3f7", borderRadius: 12, padding: "11px 12px", marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: persGeteld ? "#6b7484" : "#8b93a3" }}>👥 {L.persCountLabel}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                  <button onClick={() => { if (!persGeteld) return; if (people.length <= 1) { setPersGeteld(false); return } removeLastPerson() }}
                    style={{ ...S.step, width: 34, height: 34, fontSize: 19, opacity: persGeteld ? 1 : 0.4 }}>−</button>
                  <b style={{ fontSize: 18, color: persGeteld ? "#1d2942" : "#9aa3b2", minWidth: 20, textAlign: "center" }}>{persGeteld ? people.length : "—"}</b>
                  <button onClick={() => { if (!persGeteld) { setPersGeteld(true); return } addPerson() }} disabled={busy}
                    style={{ ...S.step, width: 34, height: 34, fontSize: 19, background: AAN, color: "#fff", border: "none" }}>+</button>
                </span>
              </div>
              {!persGeteld ? (
                <div style={{ fontSize: 15, color: "#8b93a3", marginTop: 8, fontWeight: 600 }}>{L.persNotNow}</div>
              ) : (
                <div style={{ marginTop: 9 }}>
                  {people.map((pp, idx) => {
                    const ikZelf = pp.id === meId
                    const leeg = isGuestDefault(pp.name)
                    if (ikZelf) return (
                      <div key={pp.id} style={{ position: "relative", display: "flex", marginBottom: 6 }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><KroonIcoon size={17} kleur="#c98a00" /></span>
                        <input value={leeg ? "" : pp.name} onChange={(e) => renamePerson(pp.id, e.target.value)} placeholder={L.yourNamePh}
                          style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: "9px 38px 9px 34px", fontSize: 16, textAlign: "left", fontWeight: 800, background: "rgba(240,165,0,0.1)", border: "1.5px solid rgba(240,165,0,0.5)", color: "#8a5e0f" }} />
                        <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", width: 24, height: 24, borderRadius: 8, background: "rgba(240,165,0,0.28)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✏️</span>
                      </div>
                    )
                    return (
                      <div key={pp.id} style={{ position: "relative", display: "flex", marginBottom: 6 }}>
                        <input value={leeg ? "" : pp.name} onChange={(e) => renamePerson(pp.id, e.target.value)} placeholder={`${L.guestN(idx + 1)} · ${L.guestNamePh}`}
                          style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: "9px 38px 9px 11px", fontSize: 16, textAlign: "left", background: "#fff" }} />
                        <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", width: 24, height: 24, borderRadius: 8, background: "rgba(240,165,0,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✏️</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button style={{ ...S.btnP, width: "100%", marginTop: 14 }}
              onClick={bewaarNaamPlicht}>{L.naamGoBtn}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 16, fontWeight: 800 }}
              onClick={() => { herstelPersonen(); setNaamPlicht(false); setNaamPlichtNa(null) }}>{L.cancel}</button>
          </div>
        </div>
      )}
      {naamPrompt !== null && (
        <div style={{ ...S.overlay, zIndex: 72 }} onClick={() => setNaamPrompt(null)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1d2942", marginBottom: 4 }}>{L.newGroupNameTitle}</div>
            <div style={{ fontSize: 17, color: "#6b7484", lineHeight: 1.45, marginBottom: 13 }}>{L.newGroupNameSub}</div>
            <input ref={groepNaamVeld} autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && groupName.trim()) { const m = naamPrompt; setNaamPrompt(null); void startWithMode(undefined, m) } }}
              placeholder={L.namePh3}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, marginBottom: 13 }} />
            <button disabled={!groupName.trim() || busy}
              onClick={() => { const m = naamPrompt; setNaamPrompt(null); void startWithMode(undefined, m) }}
              style={{ ...S.btnP, width: "100%", opacity: groupName.trim() ? 1 : 0.5, cursor: groupName.trim() ? "pointer" : "default" }}>{L.startWord}</button>
            <button onClick={() => setNaamPrompt(null)} style={{ width: "100%", marginTop: 9, background: "none", border: "none", cursor: "pointer", fontSize: 17.5, fontWeight: 700, color: "#8b93a3" }}>{L.cancel}</button>
          </div>
        </div>
      )}
      {notice && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => { setNotice(""); setNoticePot(false) }}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 18, color: "#1d2942", lineHeight: 1.55, marginBottom: 18, fontWeight: 600 }}>{notice}</p>
            <button style={{ ...S.btnP, ...(noticePot ? { background: "linear-gradient(135deg,#3f7fc4,#2f6fb5)", boxShadow: "0 4px 12px -4px rgba(47,111,181,0.55)" } : {}) }} onClick={() => { setNotice(""); setNoticePot(false) }}>OK</button>
          </div>
        </div>
      )}
      {showPeoplePop && (
        <div style={{ ...S.overlay, zIndex: 70 }} onClick={() => setShowPeoplePop(false)}>
          <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ ...S.h3, fontSize: 20, marginBottom: 4 }}>👤 {L.howManyPeople}</h3>
            <p style={{ fontSize: 16, color: "#6b7484", lineHeight: 1.5, marginBottom: 16 }}>{view === "quickSettle" ? L.headcountNotRetro : L.headcountForward}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginBottom: 18 }}>
              <button style={{ width: 44, height: 44, borderRadius: 12, background: "#eef1f6", border: "1px solid rgba(29,41,66,0.2)", fontSize: 23, color: "#6b7484", fontWeight: 800, cursor: "pointer", opacity: headcount > 1 ? 1 : 0.4 }} onClick={() => setHeadcount((n) => Math.max(1, n - 1))}>−</button>
              <span style={{ fontSize: 30, fontWeight: 800, minWidth: 44, textAlign: "center", color: headcount < 1 ? "#a7b0bf" : "#1d2942" }}>{headcount < 1 ? "—" : headcount}</span>
              <button style={{ width: 44, height: 44, borderRadius: 12, background: AAN, border: "none", fontSize: 23, color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => setHeadcount((n) => n < 1 ? 1 : n + 1)}>+</button>
            </div>
            <button style={S.btnP} onClick={() => setShowPeoplePop(false)}>{L.ready}</button>
          </div>
        </div>
      )}
      {newcomer && (() => {
        const ingelegd = potRounds.reduce((t, r) => t + (r.amounts[newcomer.id] || 0), 0)
        return (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", zIndex: 60, pointerEvents: "none", padding: "0 14px" }}>
          <div style={{ pointerEvents: "auto", background: "#1f6b3a", color: "#fff", borderRadius: 16, padding: "13px 15px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)", maxWidth: 380, width: "100%" }}>
            <div style={{ ...S.row, justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 800, minWidth: 0 }}>👋 {L.someoneJoined(newcomer.name)}</span>
              {!isAdmin && (
                <button onClick={() => setNewcomer(null)}
                  style={{ border: "none", background: "transparent", color: "rgba(255,255,255,0.8)", fontSize: 21.5, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✕</button>
              )}
            </div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", fontWeight: 600, marginTop: 3 }}>
              {L.joinedOfTotal(people.filter((p) => p.claimedBy).length, people.length)}
              {ingelegd > 0.005 && <> · {L.putInPot(euro(ingelegd))}</>}
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                <button onClick={() => { setConfirmDlg({ variant: "danger", msg: L.removeJoinerQ(newcomer.name), yes: L.removeWord, onYes: () => { setConfirmDlg(null); void removePersonEnPot(newcomer.id); setNewcomer(null) } }) }}
                  style={{ flex: 1, cursor: "pointer", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 10, padding: "9px 6px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit" }}>{L.notRightBtn}</button>
                <button onClick={() => setNewcomer(null)}
                  style={{ flex: 1.4, cursor: "pointer", background: "#fff", border: "none", color: "#1f6b3a", borderRadius: 10, padding: "9px 6px", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}>{L.okKort}</button>
              </div>
            )}
          </div>
        </div>
        )
      })()}
    </>
  )
  // De drie tabbladen van de beheerder. Ze wijzen naar bestaande schermen, dus de
  // navigatie eronder verandert niet — alleen de vorm is nu gelijk aan die van de gast.
  const AdminTabs = () => {
    // Alleen in de echte QR-modus: een snel- of uitgebreid-sessie die via Fair Split
    // afrekende, krijgt settle=true maar blijft een noteer-sessie — daar horen geen
    // tabbladen met "Mijn stand".
    if (!groupId || !isAdmin || !settle || fromQuick || rounds.length === 0) return null
    const hier: "order" | "me" | "group" =
      view === "settings" ? "group" : (view === "hub" || view === "roundsOverview" || view === "confirmed") ? "me" : "order"
    const naar = (t: "order" | "me" | "group") => {
      if (t === "order") { setActiveCat(catsPresent[0]); setView("order"); return }
      if (t === "group") { setSettingsBackTo(view === "order" ? "order" : "hub"); setView("settings"); return }
      if (settle) { setOpenRound(Math.max(0, rounds.length - 1)); setView("hub") }
      else { setOverviewBackTo("hub"); setView("roundsOverview") }
    }
    const knop = (t: "order" | "me" | "group", tekst: string) => (
      <button onClick={() => naar(t)}
        style={{ ...S.btn, flex: 1, minWidth: 0, padding: "13px 3px", fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: hier === t ? 1 : 0.6,
          background: hier === t ? (settle ? MODUS_FAIR.vlak : "rgba(240,165,0,0.1)") : "#fff",
          borderColor: hier === t ? (settle ? MODUS_FAIR.rand : "#e08a00") : undefined,
          borderWidth: hier === t ? 1.5 : 1,
          color: hier === t ? (settle ? MODUS_FAIR.tekst : "#8a5e0f") : "#6b7484" }}>{tekst}</button>
    )
    return (
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {knop("group", L.tabGroup)}
        {knop("order", L.tabOrder)}
        {knop("me", L.tabMe)}
      </div>
    )
  }

  // De pot-geldzak als losse functie: hij staat in de kop, en bij uitgebreid opnemen
  // op het bestelscherm verhuist hij naar de rondje-titelregel.
  // "Pot leggen +" zolang de pot leeg is — zelfde vorm en plek als de saldobadge,
  // zodat er bij de eerste inleg niets verspringt.
  const potLegBadge = () => (
      <span onClick={() => setShowPot(true)} style={{ cursor: "pointer", padding: "7px 14px 7px 10px", borderRadius: 999, fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "rgba(255,255,255,0.1)", border: "1.5px dashed rgba(255,255,255,0.42)" }}>
      <svg width="23" height="23" viewBox="0 0 40 40" style={{ display: "block" }}>
      <path d="M16 13 L14 7 Q20 5 26 7 L24 13 Z" fill="#d99616" stroke="#b9821a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M13 14 Q20 11 27 14 Q33 19 32 27 Q31 35 20 35 Q9 35 8 27 Q7 19 13 14 Z" fill="#e8a821" stroke="#b9821a" strokeWidth="1.5" />
      <text x="20" y="29" fontSize="12" fontWeight="800" fill="#5a3d0a" textAnchor="middle">€</text>
      </svg>
      <span style={{ color: "#c3cbd8" }}>{L.potLayBtn}</span>
      <span style={{ color: "#F5B301", fontWeight: 800 }}>+</span>
      </span>
  )

  const potKnopje = () => (
    <span onClick={() => setShowPot(true)} style={{ cursor: "pointer", padding: "9px 15px 9px 11px", borderRadius: 999, fontSize: 16, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: "#f2f6fc", border: `1.5px solid ${RAND}` }}>
      {potRemaining < -0.005 && <span style={{ color: "#c0554a" }}>⚠️</span>}
      {potIsCard ? (
        <span style={{ fontSize: 20 }}>💳</span>
      ) : (
        <svg width="23" height="23" viewBox="0 0 40 40" style={{ display: "block" }}>
          <path d="M16 13 L14 7 Q20 5 26 7 L24 13 Z" fill="#d99616" stroke="#b9821a" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M13 14 Q20 11 27 14 Q33 19 32 27 Q31 35 20 35 Q9 35 8 27 Q7 19 13 14 Z" fill="#e8a821" stroke="#b9821a" strokeWidth="1.5"/>
          <text x="20" y="29" fontSize="12" fontWeight="800" fill="#5a3d0a" textAnchor="middle">€</text>
        </svg>
      )}
      <span style={{ color: "#2f5693" }}>{euro(potZicht)}<span style={{ color: "#8a93ad", fontWeight: 700 }}> / {potInlegKort}</span></span>
      <span style={{ color: "#F5B301", fontWeight: 800 }}>+</span>
    </span>
  )
  // Per persoon noteren terwijl je de enige bent: dan valt er niets te verdelen en
  // belanden alle drankjes stilzwijgend bij jou. De lijst gaat op slot tot er iemand
  // bij is — een waarschuwing alleen kun je wegtikken, dit niet. Staat hier en niet
  // in de render-functie, want zowel de strook als de lijst moeten erbij kunnen.
  const alleenJij = !settle && perPersoon && people.length < 2
  // Zoekveld met microfoon: bij uitgebreid opnemen ingebouwd bovenin de drankjeskaart
  // (inKaart), bij de andere modi op zijn vertrouwde plek onder de lijst.
  // De strook staat los van het zoekblok. Ze plakte namelijk vast binnen dat blok, en
  // een sticky element komt nooit voorbij de onderrand van zijn eigen ouder — dus
  // verdween ze zodra je voorbij het zoekveld scrolde. Als eigen kind van de
  // drankjeskaart heeft ze de hele lijst als speelveld en blijft ze staan.
  const renderVoorWieStrook = (inRaster = false) => (
    (() => {
      const idx = people.findIndex((pp) => pp.id === voorWie)
      const ik = idx >= 0 ? people[idx] : null
      if (!ik || settle || alleenJij) return null
      const benIkHet = ik.id === meId
      // In de samen-stand tik je niet voor één iemand aan maar voor de hele groep;
      // daar stond ten onrechte "jezelf". De strook draagt dan de moduskleur in plaats
      // van een persoonskleur, want ze slaat op niemand in het bijzonder.
      const samen = !perPersoon
      const wie = samen ? L.everyoneWord : (benIkHet && !ik.named ? L.yourselfWord : ik.name)
      const k = samen ? RAND : gastKleur(idx)
      // Één regel, altijd: past de volle zin niet, dan valt "Je tikt aan" weg en blijft
      // de naam even groot staan. Afbreken zou de strook twee regels hoog maken, en dat
      // is net de ruimte die de drankjes nodig hebben.
      const kort = wie.length > 12
      return (
        <div ref={inRaster ? strookRij : undefined} style={{ ...(inRaster ? { gridColumn: "1 / -1" } : null), scrollMarginTop: 8, position: "sticky", top: 0, zIndex: 5, display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <span style={{ background: "#fff", border: `2px solid ${k}`, borderRadius: 999, padding: "8px 17px", display: "inline-flex", alignItems: "center", gap: 7, maxWidth: "100%", whiteSpace: "nowrap", color: "#1a1a1a", boxShadow: "0 3px 10px -5px rgba(29,41,66,0.5)" }}>
            <span style={{ fontSize: kort ? 14 : 16, fontWeight: 700, flexShrink: 0 }}>{kort ? L.forWord : L.tapForStrip}</span>
            <b style={{ fontSize: 19, fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{wie}</b>
            <span style={{ fontSize: 18, flexShrink: 0 }}>👇</span>
          </span>
        </div>
      )
    })()
  )
  const renderZoekBlok = (inKaart = false) => (<>
    {!inKaart && renderVoorWieStrook()}
    <div style={{ display: "flex", gap: 7, alignItems: "stretch", marginBottom: inKaart ? 2 : 10 }}>
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 18, pointerEvents: "none" }}>🔍</span>
        <input value={drinkSearch} onChange={(e) => setDrinkSearch(e.target.value)}
          placeholder={L.searchDrink}
          style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 36, paddingRight: drinkSearch ? 34 : 12, fontSize: 18, textAlign: "left" }} />
        {drinkSearch && (
          <button onClick={() => setDrinkSearch("")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#6b7484", padding: 4 }}>✕</button>
        )}
      </div>
        {(!settle || walkIdx !== null) && (
        <button onClick={startVoice} title={L.voiceBtn} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 13px", borderRadius: 10, cursor: "pointer", background: themaNaam ? "#fbfcff" : "#fcfdfe", border: `1px solid ${settle ? MODUS_FAIR.randZacht : themaNaam ? "rgba(90,106,148,0.5)" : "rgba(240,165,0,0.5)"}` }}>
          <MicroIcoon size={18} kleur={settle ? MODUS_FAIR.tekst : themaNaam ? "#3b486a" : "#8a5e0f"} />
        </button>
        )}
    </div>
  </>)
  const Header = ({ verbergNav = false, kaal = false }: { verbergNav?: boolean; kaal?: boolean }) => {
    // Onderweg van gelijk verdelen naar Fair Split is er maar één route: namen,
    // toewijzen, pot, betalers, eindbalans. Instellingen en overzichten zouden je
    // daar alleen uit halen, dus die verbergen we tot de omschakeling rond is.
    // De eindbalans hoort niet meer bij het traject van drie stappen: daar mag de gewone
    // navigatie weer verschijnen, ook al staat fromQuick nog aan voor de weg terug.
    const onboarding = view === "setup" || view === "settings" || (view === "roundsOverview" && fillMode)
    // Eenmaal binnen stond nergens in welke modus je zit. Een gekleurde balk bovenaan zegt
    // dat zonder plaats te kosten, en bij Fair Split kan er rechts bij waar je zit in het
    // traject — die modus loopt door drie stappen, snelle rondjes niet.
    const modus = settle ? MODUS_FAIR : MODUS_SNEL
    // De eindbalans van een uitgebreid-sessie draagt de uitgebreid-kop, óók als de route
    // via de Fair Split-stappen liep en settle daardoor aanstond: qua beleving blijft
    // het "ik bestel voor de groep".
    const alsUitgebreid = opNaam === true && (!settle || view === "final")
    // Snel opnemen kreeg een eigen kop met statusbalk, pot onder het logo en de naam
    // rechtsboven. Sinds het bestelscherm zelf gelijkgetrokken is, hoort de kop dat ook
    // te zijn: beide gewone-rondjes-modi dragen de uitgebreid-look — modus-regeltje
    // rechts naast het logo, naamplaatje gecentreerd, pot-geldzak rechts ernaast.
    // Alleen Fair Split (QR) houdt zijn eigen kop met de gekleurde balk.
    const uitgebreidLook = alsUitgebreid || !settle || fromQuick
    // Het QR-instelscherm krijgt één samengestelde kopbalk (logo + modus in degradé)
    // in plaats van de losse teal balk, logo-rij en naam rechtsboven.
    const setupKop = !!groupId && settle && !kaal && (view === "setup" || (view === "hub" && isAdmin && !fromQuick && rounds.length === 0))
    return (
    <div style={{ marginBottom: 12, paddingTop: 18 }}>
      {/* Bij uitgebreid opnemen geen aparte statusbalk: de tekst staat rechts op de
          Rundo-regel. */}
      {/* Degradé wit → teal: het logo staat links op zijn vertrouwde lichte ondergrond
          in exact zijn eigen kleuren, en de balk loopt rechts vol teal uit onder de
          modus-tekst. Eén balk in plaats van drie koplagen. */}
      {setupKop && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: RAND, borderRadius: 14, padding: "10px 12px", marginBottom: 9 }}>
          <span onClick={() => verlaatMetNaamcheck(goSiteHome)} style={{ cursor: "pointer", display: "inline-flex", flexShrink: 0 }}>
            <RundoLogo size={40} />
          </span>
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>{potContribTotal > 0.005 ? potKnopje() : potLegBadge()}</span>
        </div>
      )}
      {/* Wat er nu gebeurt en wat jij moet doen, op twee gecentreerde regels — dezelfde
          rol als de "Je tikt aan voor"-strook op het aantikscherm. */}
      {/* Logo met de pot eronder aan de linkerkant; de groepsnaam en het aantal personen
          rechtsboven. Zo staan "waar ben ik" en "hoeveel zit er nog in" naast elkaar in
          plaats van elkaar te verdringen op één regel. */}
      {!setupKop && (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, background: RAND, borderRadius: 15, padding: "11px 13px", marginBottom: 11 }}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        <div style={{ ...S.row, gap: 10, alignItems: "center" }}>
          <span onClick={() => verlaatMetNaamcheck(goSiteHome)} style={{ cursor: "pointer", flexShrink: 0, display: "inline-flex" }}>
            <RundoLogo size={58} />
          </span>
        </div>
        {/* Op het instelscherm staat geen ondertitel: de tagline staat al op het
            startscherm, en hier telt elke pixel voor de twee keuzekaarten. */}
        </div>
        {/* Pot rechtsboven, in de buitenste rij: hij gaat over de hele avond en hoort
            dus naast het logo, niet bij één rondje. */}
        {!!groupId && !kaal && (
          <span style={{ flexShrink: 0 }}>{potContribTotal > 0.005 ? potKnopje() : potLegBadge()}</span>
        )}
        {!uitgebreidLook && !!groupId && !kaal && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 11, marginLeft: -13, marginRight: -13, marginBottom: -11, padding: "10px 13px", background: "#f4fafb", borderRadius: "0 0 15px 15px", boxSizing: "content-box" }}>
            {settle && !fromQuick && (
              <button onClick={() => { setSettingsBackTo(view === "order" ? "order" : "hub"); setView("settings") }}
                style={{ flexShrink: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, background: "#dbeef0", border: "none", borderRadius: 999, padding: "7px 15px", fontSize: 13, fontWeight: 700, color: RAND, fontFamily: "inherit" }}>
                {L.tabGroup}
              </button>
            )}
            {groupName.trim() && !editName && (
              <span onClick={() => { if (!onboarding && !groepDicht) setEditName(true) }}
                style={{ marginLeft: "auto", minWidth: 0, cursor: onboarding ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 19, fontWeight: 600, color: RAND }}>
                  {!settle && isAutoNaam(groupName) ? L.giveNameQ : groupName.trim()}
                </span>
                {groepDatum && <span style={{ flexShrink: 0, fontSize: 13, color: "#7d999d" }}>{datumKort(groepDatum)}</span>}
                {!onboarding && (
                  <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: RAND, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <PotloodIcoon size={12} kleur="#fff" />
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
      )}
          {!settle && !kaal && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: `1.5px solid ${RAND}33`, marginBottom: 10 }}>
              <span onClick={() => { if (onboarding || groepDicht) return; openGroepVenster(true) }}
                style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: onboarding ? "default" : "pointer", fontSize: 20, fontWeight: 800, color: isAutoNaam(groupName) ? "#9aa3b2" : "#1d2942" }}>
                {isAutoNaam(groupName) ? L.namePh3 : groupName.trim()}
                {!onboarding && <span style={{ fontSize: 13, color: "#6b7484" }}> ✏️</span>}
              </span>
              <span style={{ flexShrink: 0, borderLeft: `1px solid ${RAND}2e`, paddingLeft: 11 }}>{kopTeller()}</span>
            </div>
          )}
      {/* De naam zelf staat in de kop rechtsboven. Hier blijft enkel het invulveld over
          voor wanneer je op die naam tikt om hem te wijzigen. */}
      {groupName.trim() && editName && !onboarding && (
        <div style={{ marginTop: 9, textAlign: "center" }}>
          <input autoFocus value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={() => { setEditName(false); persistSettings() }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
            style={{ ...S.input, width: "auto", minWidth: 180, maxWidth: "88%", textAlign: "center", fontSize: 19, fontWeight: 800, padding: "5px 13px", borderRadius: 16, background: "#fcfdfe", border: "1px solid rgba(240,165,0,0.8)" }} />
        </div>
      )}
      {!verbergNav && !onboarding && !(settle && isAdmin && !fromQuick) && !(!settle && view === "order" && roundItems > 0) && !(!settle && view === "confirmed") && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {/* Snel opnemen: geen ⚙️ Groep meer (naam via de pill, pot via de badge) —
              Afrekenen staat er links vooraan, met het getekende bonnetje. */}
          {(fromQuick || !settle) && rounds.length >= 1 && (
            !lastRoundHandled ? (
              <button style={{ flex: 1, padding: "11px 4px", fontSize: 17, fontWeight: 700, borderRadius: 999, textAlign: "center", background: VLAK1, color: "#6b7484", border: "1.5px dashed rgba(29,41,66,0.45)", cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => {
                  const open = rounds.filter((rr) => (rr.amount || 0) <= 0.005).length
                  if (open > 1) { setNotice(L.payFirstMany(open)); setFillMode(true); setOverviewBackTo("hub"); setView("roundsOverview"); return }
                  setNotice(L.payFirstOne(rounds.length))
                }}>
                {L.quickSettleTitle}
              </button>
            ) : (
              <button style={{ flex: 1, padding: "11px 4px", fontSize: 17, fontWeight: 700, borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit",
                border: `1.5px solid ${RAND}`,
                background: (view === "quickSettle" || view === "final" || view === "payers" || view === "fairSetup") ? RAND : VLAK1,
                color: (view === "quickSettle" || view === "final" || view === "payers" || view === "fairSetup") ? RANDTEKST : RAND }}
                onClick={goQuickSettle}><BonKnopIcoon kleur={(view === "quickSettle" || view === "final" || view === "payers" || view === "fairSetup") ? RANDTEKST : RAND} /> {L.quickSettleTitle}</button>
            )
          )}
          {settle && !fromQuick && (
          <button style={{ ...S.btn, flex: 1, padding: "13px 4px", fontSize: 16, fontWeight: 800, lineHeight: 1.15, borderRadius: 13 }} onClick={() => { if ((settle || opNaam) && unassignedAllRounds > 0) { setNotice(L.assignFirstNote); return } if (!settle && !lastRoundHandled) { setNotice(L.finishRoundFirst); return } goHome() }}>{L.groupShort}</button>
          )}
          {settle && !fromQuick ? (
            <button style={{ ...S.btn, flex: 1, padding: "13px 4px", fontSize: 16, fontWeight: 800, borderRadius: 13, opacity: (view === "hub" || ((settle || opNaam) && unassignedAllRounds > 0)) ? 0.45 : 1 }} onClick={() => { if ((settle || opNaam) && unassignedAllRounds > 0) { setNotice(L.assignFirstNote); return } goHub() }}>{L.overview}</button>
          ) : rounds.length === 0 ? null : (
            <button style={{ flex: 1.2, padding: "11px 4px", fontSize: 17, fontWeight: 700, borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${RAND}`,
              background: view === "roundsOverview" ? RAND : "#fff",
              color: view === "roundsOverview" ? RANDTEKST : RAND }}
              onClick={() => { if (view === "payers" || view === "fairSetup") { setConfirmDlg({ msg: L.leaveSettleMsg, yes: L.leaveSettleYes, onYes: () => { setConfirmDlg(null); setOverviewBackTo("hub"); setView("roundsOverview") } }); return } if (rounds.length >= 1) { setOverviewBackTo(view === "order" ? "order" : "hub"); setView("roundsOverview") } else setNotice(L.noRoundsYet) }}>{L.roundsOverviewBtn}</button>
          )}
          {settle && !fromQuick && <button style={{ ...S.btn, flex: 1, padding: "11px 4px", fontSize: 17, fontWeight: 700, opacity: (view === "final" || ((settle || opNaam) && unassignedAllRounds > 0)) ? 0.45 : 1 }} onClick={() => { if ((settle || opNaam) && unassignedAllRounds > 0) { setNotice(L.assignFirstNote); return } goFinal() }}>{L.settleBtn}</button>}
          {/* Op het rondjesoverzicht is de derde tab overbodig: het rondje is bevestigd
              en de afreken-knop staat daar al onderaan naast "Nieuw rondje" — dat geldt
              voor snel én uitgebreid, want die knoppenrij staat er in beide modi. */}
          {false && !settle && !fromQuick && rounds.length >= 1 && view !== "roundsOverview" && !(view === "hub" && paidCount > 0 && laatsteRondjeKlaar() && unassignedAllRounds === 0) && (
            !lastRoundHandled ? (
              // Bezig een rondje af te ronden op de hub: geen afreken-knop maar een rustig
              // label dat toont waar je bent. Niet klikbaar, niet opgelicht.
              <div style={{ flex: 1, padding: "11px 4px", fontSize: 17, fontWeight: 800, borderRadius: 10, textAlign: "center", background: "#eef1f6", color: "#8a5e0f", border: "1px solid rgba(240,165,0,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{L.roundWord} {roundNr}</div>
            ) : (
              <button style={{ flex: 1, padding: "11px 4px", fontSize: 17, fontWeight: 700, borderRadius: 10, cursor: "pointer",
                border: view === "quickSettle" ? "none" : "1px solid rgba(29,41,66,0.25)",
                background: view === "quickSettle" ? AAN : "#fff",
                color: view === "quickSettle" ? "#fff" : "#6b7484" }}
                onClick={goQuickSettle}>{L.quickSettleTitle}</button>
            )
          )}
        </div>
      )}
    </div>
    )
  }

  // ── START ───────────────────────────────────────────────────────────────────
  // ── Laden (gast opent de link) ──────────────────────────────────────────────
  if (booting) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 17.5, color: "#6b7484" }}>{L.loading}</div>
      </div>
    )
  }

  // ── GAST: wie ben jij? ──────────────────────────────────────────────────────
  // Twee wegen naar binnen: tik op je naam als de admin ze al invulde, of neem een
  // lege plaats en typ ze zelf. Een naam is een etiket; claimen is wat jouw telefoon
  // aan die plaats koppelt. Dat scheiden is wat de app laat werken voor wie NIET
  // scant — de admin kan voor hem blijven aanduiden.
  if (groupId && !isAdmin && !meId) {
    const vrij = people.filter((p) => !p.claimedBy)
    const metNaam = vrij.filter((p) => p.named)
    const leeg = vrij.filter((p) => !p.named)
    return (
      <div style={S.page}><div style={S.wrap}>
        {renderDialogs()}
        <AdminTabs />
        <div style={{ display: "flex", justifyContent: "flex-end" }}><LanguageToggle compact /></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24, marginTop: 8 }}>
          <div style={{ ...S.row, gap: 13 }}>
            <RundoLogo size={62} opDonker={false} />
          </div>
          <div style={{ fontSize: 17.5, color: "#6b7484", marginTop: 10 }}>{L.invitedFor} <b style={{ color: "#1d2942" }}>{groupName}</b></div>
        </div>

        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0, fontSize: 22 }}>{L.whoAreYou}</h3>

          {vrij.length === 0 ? (
            <>
              <div style={{ fontSize: 16, color: "#6b7484", marginBottom: 10, lineHeight: 1.5 }}>{L.allSeatsTaken}</div>
              <input id="latecomer-name" style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 19, marginBottom: 10 }}
                placeholder={L.yourName} autoComplete="name" />
              <button disabled={busy} style={{ ...S.btnP, width: "100%", opacity: busy ? 0.5 : 1 }}
                onClick={() => {
                  const el = document.getElementById("latecomer-name") as HTMLInputElement | null
                  joinAsLatecomer((el?.value || "").trim())
                }}>{L.joinAddSeat}</button>
            </>
          ) : (
            <>
              {metNaam.length > 0 && (
                <>
                  <div style={{ fontSize: 18.5, color: "#4a5567", marginBottom: 12, lineHeight: 1.5 }}>{L.tapYourName}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: leeg.length ? 16 : 0 }}>
                    {metNaam.map((p) => (
                      <button key={p.id} disabled={busy} onClick={() => claimSeat(p.id, p.name)}
                        style={{ ...S.btn, padding: "16px 8px", fontWeight: 800, fontSize: 19, opacity: busy ? 0.5 : 1 }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {leeg.length > 0 && (
                <>
                  <div style={{ fontSize: 18.5, color: "#4a5567", marginBottom: 10, lineHeight: 1.5 }}>
                    {metNaam.length > 0 ? L.notThere : L.fillNameSeat}
                  </div>
                  <input id="guest-name" value={gastNaam} onChange={(e) => setGastNaam(e.target.value)}
                    style={{ ...S.input, width: "100%", boxSizing: "border-box", fontSize: 20, padding: "13px 14px", textAlign: "left", marginBottom: 12,
                      border: gastNaam.trim() ? `1.5px solid ${MODUS_FAIR.randZacht}` : undefined }}
                    placeholder={L.yourName} autoComplete="name" />
                  {/* Zolang er geen naam staat zijn deze knoppen bleek: er valt nog niets te
                      kiezen. Zodra je typt worden ze groen met een gloed, en staat erboven
                      wat je nu moet doen. */}
                  {gastNaam.trim() && <div style={{ fontSize: 18.5, fontWeight: 800, color: MODUS_FAIR.tekst, marginBottom: 9 }}>{L.tapYourSeatNow}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                    {leeg.map((p) => {
                      const klaar = gastNaam.trim().length > 0
                      return (
                        <button key={p.id} disabled={busy || !klaar}
                          onClick={() => { if (!klaar) { setNotice(L.fillNameFirst); return } claimSeat(p.id, gastNaam.trim()) }}
                          style={{ ...S.btn, padding: "16px 8px", fontSize: 18.5, fontWeight: 800, cursor: klaar ? "pointer" : "default",
                            background: klaar ? MODUS_FAIR.knop : VLAK1,
                            border: klaar ? "none" : "1px solid rgba(29,41,66,0.18)",
                            color: klaar ? "#fff" : "#a7b0bf",
                            boxShadow: klaar ? `0 10px 24px -8px ${MODUS_FAIR.gloed}, 0 0 0 4px ${MODUS_FAIR.tint}` : "none",
                            opacity: busy ? 0.5 : 1 }}>
                          {L.seat(p.seat)}{klaar ? " →" : ""}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {people.some((p) => p.claimedBy) && (
          <div style={S.card}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{L.alreadyJoined}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {people.filter((p) => p.claimedBy).map((p) => <span key={p.id} style={S.pill}>📱 {p.name}</span>)}
            </div>
          </div>
        )}
      </div></div>
    )
  }

  // ── GAST: bestellen ────────────────────────────────────────────────────────
  // Eén taak, één scherm: tik aan wat JIJ wil. Geen personen kiezen, geen bedragen,
  // geen pot — dat is werk voor wie naar de toog gaat. De gast ziet enkel zichzelf.
  // Zolang er nog geen rondje is, kan een gast niets bestellen. Dan tonen we de tafel:
  // wie er is, wie nog moet scannen, en wat er in de pot zit.
  if (groupId && !isAdmin && meId && settle && !orderingOpen) {
    const ik = people.find((p) => p.id === meId)
    const aangemeld = people.filter((p) => p.claimedBy).length
    const gastheer = people.find((p) => !!ownerDevice && p.claimedBy === ownerDevice)
    return (
      <div style={{ ...S.wrap, maxWidth: 430 }}>
        {renderDialogs()}
        <div style={{ background: MODUS_FAIR.rand, borderRadius: 15, padding: "11px 13px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RundoLogo size={36} />
            <span style={{ marginLeft: "auto", flexShrink: 0 }}><LanguageToggle compact /></span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName}</span>
            <span onClick={() => ik && setNaamWijzig(ik.name)}
              style={{ flexShrink: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.32)", borderRadius: 999, padding: "4px 13px 4px 7px", fontSize: 17, fontWeight: 600, color: "#fff", maxWidth: 180 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <PotloodIcoon size={12} kleur={MODUS_FAIR.rand} />
              </span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ik?.name}</span>
            </span>
          </div>
        </div>
        <div style={{ ...S.card }}>
          <div style={{ background: MODUS_FAIR.tint, borderRadius: 11, padding: 11, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              paddingBottom: potContribTotal > 0.005 ? 8 : 0,
              borderBottom: potContribTotal > 0.005 ? `1px solid ${MODUS_FAIR.lijnZacht}` : "none" }}>
              <span style={{ fontSize: 14.5, color: MODUS_FAIR.tekst }}>{L.peopleInGroup}</span>
              <b style={{ fontSize: 19, color: "#1d2942" }}>{people.length}</b>
            </div>
            {potContribTotal > 0.005 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: MODUS_FAIR.tekst }}>{L.potInPot}</span>
                <b style={{ fontSize: 19, color: "#1d2942" }}>{euro(potContribTotal)}</b>
              </div>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1f6b3a", marginBottom: 7 }}>📱 {L.joinedOfTotal(aangemeld, people.length)}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 13 }}>
            {people.map((p) => {
              const leeg = !p.claimedBy && !p.named
              const isIk = p.id === meId
              const isHost = !!ownerDevice && p.claimedBy === ownerDevice
              return (
                <span key={p.id} style={{ borderRadius: 16, padding: "5px 11px", fontSize: 15, fontWeight: isIk || isHost ? 800 : 700,
                  background: isHost ? "rgba(240,165,0,0.14)" : isIk ? "rgba(31,138,76,0.14)" : p.claimedBy ? "rgba(31,138,76,0.08)" : "transparent",
                  border: leeg ? "1px dashed rgba(29,41,66,0.28)" : "none",
                  color: isHost ? "#8a5e0f" : p.claimedBy || p.named ? "#1f6b3a" : "#8b93a3" }}>
                  {isHost ? <><KroonIcoon size={12} kleur="#8a5e0f" />{" "}</> : isIk ? "● " : p.claimedBy ? "📱 " : ""}{leeg ? L.seat(p.seat) : p.name}
                </span>
              )
            })}
          </div>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start", background: MODUS_FAIR.tint, borderRadius: 13, padding: 14 }}>
            <span style={{ flexShrink: 0, fontSize: 22 }}>⏳</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 19, fontWeight: 800, color: MODUS_FAIR.tekst, lineHeight: 1.3 }}>{L.waitTitle}</span>
              <span style={{ display: "block", fontSize: 17, color: MODUS_FAIR.tekst, lineHeight: 1.45, marginTop: 4 }}>{L.waitForHost(gastheer?.name ?? "")}</span>
            </span>
          </div>
          {/* Is er nog plaats, toon dan de QR ook hier: dan kan jij een vriend laten
              scannen zonder dat de gastheer met zijn toestel moet rondgaan. */}
          {inviteLink && (
            <div style={{ borderTop: `1px solid ${MODUS_FAIR.lijnZacht}`, marginTop: 13, paddingTop: 12, textAlign: "center" }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: MODUS_FAIR.tekst, marginBottom: 2 }}>{L.showToFriend}</div>
              <div style={{ fontSize: 14, color: "#5a8f99", marginBottom: 9 }}>{L.shareWithMore}</div>
              <div style={{ display: "inline-block", background: "#fff", padding: 9, borderRadius: 13, border: `1px solid ${MODUS_FAIR.lijnZacht}` }}>
                <QRCodeSVG value={inviteLink} size={112} bgColor="#ffffff" fgColor={MODUS_FAIR.tekst} />
              </div>
              {/* Zit alles vol, dan levert scannen niets op — maar de code verbergen laat je
                  in het ongewisse. Beter zeggen wat er moet gebeuren. */}
              {!people.some((p) => !p.claimedBy) && (
                <div style={{ fontSize: 14, color: "#8a5e0f", background: "rgba(240,165,0,0.12)", borderRadius: 10, padding: "8px 11px", marginTop: 9, lineHeight: 1.45 }}>{L.seatsFullGuest}</div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (groupId && !isAdmin && meId) {
    const ik = people.find((p) => p.id === meId)!
    // De haler mag voor anderen aantikken; iedereen anders tikt vast voor zichzelf.
    const ikHaalNu = !!openRoundId && startedBy === meId
    const doelG = ikHaalNu && halerVoor && people.some((pp) => pp.id === halerVoor) ? halerVoor : meId
    const zoekt = normText(drinkSearch).length > 0
    const catDrinks = zoekt ? drinks.filter((d) => drinkMatches(d.name, drinkSearch)) : drinks.filter((d) => d.cat === activeCat)
    const lijst = zoekt ? catDrinks : catDrinks.filter((d) => fullList || d.fav || aQty(d.id, meId) > 0)
    const mijn = drinks.filter((d) => aQty(d.id, meId) > 0)
    const mijnAantal = mijn.reduce((a, d) => a + aQty(d.id, meId), 0)

    // Wat de gast op dit moment staat. Zelfde helpers als de admin gebruikt, dus de
    // cijfers kunnen niet uit elkaar lopen.
    // Ben ik gekoppeld aan iemand? Dan is de vereffening op het groepje, niet op mij.
    const mijnGroep = settleGroups.find((g) => g.leden.some((p) => p.id === meId))
    const mijnTx = settlement.tx.filter((t) => t.from === (mijnGroep?.label ?? "") || t.to === (mijnGroep?.label ?? ""))

    return (
      <div style={S.page}><div style={S.wrap}>
        {renderDialogs()}
        {renderAddDrink()}
        {renderVoice()}

        {/* Logo boven, groep en jouw naam eronder — dezelfde kop als de beheerder ziet. */}
        <div style={{ background: MODUS_FAIR.rand, borderRadius: 15, padding: "11px 13px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RundoLogo size={36} />
            <span style={{ marginLeft: "auto", flexShrink: 0 }}><LanguageToggle compact /></span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 9, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName}</span>
            <span onClick={() => setNaamWijzig(ik.name)}
              style={{ flexShrink: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.32)", borderRadius: 999, padding: "4px 13px 4px 7px", fontSize: 17, fontWeight: 600, color: "#fff", maxWidth: 180 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <PotloodIcoon size={12} kleur={MODUS_FAIR.rand} />
              </span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ik.name}</span>
            </span>
          </div>
        </div>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            {/* Wat je in de pot stopte hoort bovenaan: het is het enige bedrag dat al vaststaat. */}
            {contribOf(meId) > 0.005 && (
              <span style={{ background: "rgba(31,138,76,0.1)", border: "1px solid rgba(31,138,76,0.3)", borderRadius: 16, padding: "4px 11px", fontSize: 14.5, fontWeight: 800, color: "#1f6b3a", whiteSpace: "nowrap" }}>{L.potPaidIn(euro(contribOf(meId)))}</span>
            )}
            <button style={{ ...S.pill, cursor: "pointer", border: "1px solid rgba(29,41,66,0.2)" }}
              onClick={() => setConfirmDlg({ msg: L.notMeConfirm(ik.name), yes: L.releaseSeat, onYes: () => { setConfirmDlg(null); releaseSeat(meId); setZitNaam(null); setGuestTab("group") } })}>
              {L.notMe}
            </button>
          </div>
        </div>

        {(orderingOpen || rounds.length > 0) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setGuestTab("group")}
            style={{ ...S.btn, flex: 1, padding: "13px 4px", fontSize: 17.5, fontWeight: 800, opacity: guestTab === "group" ? 1 : 0.6,
              background: guestTab === "group" ? MODUS_FAIR.vlak : "#fff",
              borderColor: guestTab === "group" ? MODUS_FAIR.rand : undefined,
              borderWidth: guestTab === "group" ? 1.5 : 1,
              color: guestTab === "group" ? MODUS_FAIR.tekst : "#6b7484" }}>{L.tabGroup}</button>
          <button onClick={() => setGuestTab("order")}
            style={{ ...S.btn, flex: 1, padding: "13px 4px", fontSize: 17.5, fontWeight: 800, opacity: guestTab === "order" ? 1 : 0.6,
              background: guestTab === "order" ? MODUS_FAIR.vlak : "#fff",
              borderColor: guestTab === "order" ? MODUS_FAIR.rand : undefined,
              borderWidth: guestTab === "order" ? 1.5 : 1,
              color: guestTab === "order" ? MODUS_FAIR.tekst : "#6b7484" }}>{L.tabOrder}</button>
          <button onClick={() => setGuestTab("me")}
            style={{ ...S.btn, flex: 1, padding: "13px 4px", fontSize: 17.5, fontWeight: 800, opacity: guestTab === "me" ? 1 : 0.6,
              background: guestTab === "me" ? MODUS_FAIR.vlak : "#fff",
              borderColor: guestTab === "me" ? MODUS_FAIR.rand : undefined,
              borderWidth: guestTab === "me" ? 1.5 : 1,
              color: guestTab === "me" ? MODUS_FAIR.tekst : "#6b7484" }}>{L.tabMe}</button>
        </div>
        )}

        {(guestTab === "group" || !(orderingOpen || rounds.length > 0)) && (
          <div style={S.card}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.row, justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ ...S.h3, margin: 0 }}>{groupName || L.groupTitle}</h3>
                <span style={{ ...S.pill, background: "rgba(29,41,66,0.08)", color: "#8a5e0f", flexShrink: 0 }}>{L.peopleN(people.length)}</span>
              </div>
              <div style={{ fontSize: 15.5, color: "#1f6b3a", fontWeight: 700, marginTop: 4 }}>📱 {L.joinedOfTotal(people.filter((p) => p.claimedBy).length, people.length)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {people.map((p) => {
                const benIkHet = p.id === meId
                const aangemeld = !!p.claimedBy
                const isHost = !!ownerDevice && p.claimedBy === ownerDevice
                return (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 11px", borderRadius: 10,
                    background: benIkHet ? "rgba(31,138,76,0.08)" : VLAK1,
                    border: benIkHet ? "1px solid rgba(31,138,76,0.3)" : "1px solid rgba(29,41,66,0.1)" }}>
                    <span style={{ fontSize: 17.5, fontWeight: benIkHet ? 800 : 700, color: p.named ? "#1d2942" : "#9aa3b2" }}>
                      {p.name}
                      {benIkHet && <span style={{ fontSize: 14.5, color: "#1f6b3a", fontWeight: 800 }}> · {L.youMark}</span>}
                      {isHost && !benIkHet && <span style={{ fontSize: 14.5, color: "#8a5e0f", fontWeight: 800 }}> · {L.hostMark}</span>}
                    </span>
                    <span style={{ fontSize: 14.5, color: aangemeld ? "#8a5e0f" : "#9aa3b2", fontWeight: 700 }}>
                      {aangemeld ? L.scannedSelf : L.notScannedYet}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 15, color: "#6b7484", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>{L.inviteMore}</div>
            {/* Ook hier de QR, zolang er plaats is: dan kan een gast zelf iemand laten
                aansluiten zonder de gastheer erbij te halen. */}
            {inviteLink && (
              <div style={{ borderTop: `1px solid ${MODUS_FAIR.lijnZacht}`, marginTop: 13, paddingTop: 12, textAlign: "center" }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: MODUS_FAIR.tekst, marginBottom: 2 }}>{L.showToFriend}</div>
                <div style={{ fontSize: 14, color: "#5a8f99", marginBottom: 9 }}>{L.shareWithMore}</div>
                <div style={{ display: "inline-block", background: "#fff", padding: 9, borderRadius: 13, border: `1px solid ${MODUS_FAIR.lijnZacht}` }}>
                  <QRCodeSVG value={inviteLink} size={112} bgColor="#ffffff" fgColor={MODUS_FAIR.tekst} />
                </div>
                {/* Zit alles vol, dan levert scannen niets op — maar de code verbergen laat je
                    in het ongewisse. Beter zeggen wat er moet gebeuren. */}
                {!people.some((p) => !p.claimedBy) && (
                  <div style={{ fontSize: 14, color: "#8a5e0f", background: "rgba(240,165,0,0.12)", borderRadius: 10, padding: "8px 11px", marginTop: 9, lineHeight: 1.45 }}>{L.seatsFullGuest}</div>
                )}
              </div>
            )}
          </div>
        )}

        {guestTab === "me" && (orderingOpen || rounds.length > 0) && (
          <>
            {/* Geen bedragen meer: het zijn richtprijzen. Wat telt is wat jij nam per
                rondje en of dat rondje al betaald is. */}
            {rounds.length === 0 ? (
              <div style={{ ...S.card, fontSize: 17, color: "#9aa3b2", textAlign: "center", padding: "18px 0" }}>{L.noRoundClosed}</div>
            ) : (
              <>
                {[...rounds].reverse().map((r) => {
                  const mijne = drinks.filter((d) => (r.orders[d.id]?.[meId] ?? 0) > 0)
                  const alles = drinks.map((d) => ({ d, n: drinkTotalRound(r, d.id) })).filter((x) => x.n > 0)
                  return (
                    <div key={r.id} style={{ ...S.card, padding: 11, marginBottom: 9 }}>
                      <div style={{ ...S.row, justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 15.5, fontWeight: 800, color: "#1d2942" }}>{L.roundN(r.seq)}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: (r.amount || 0) > 0.005 ? "#c88a1a" : "#9aa3b2" }}>
                          {(r.amount || 0) > 0.005 ? euro(r.amount) : paidLabel(r)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7484", lineHeight: 1.45 }}>
                        {alles.map((x) => `${x.n}× ${x.d.name}`).join(" · ")}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: mijne.length ? MODUS_FAIR.rand : "#9aa3b2", marginTop: 5 }}>
                        {mijne.length
                          ? `${L.youTookLabel} ${mijne.map((d) => `${r.orders[d.id][meId]}× ${d.name}`).join(" · ")}`
                          : L.nothingThisRound}
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => setGuestTab("order")}
                  style={{ ...S.btn, width: "100%", padding: "11px 0", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#1d2942" }}>{L.backToDrinks}</button>
              </>
            )}
          </>
        )}

        {guestTab === "order" && (orderingOpen || rounds.length > 0) && (
        <>
        {settle && renderRunnerBar()}
        {/* De losse "niets voor mij"-knop en de statusbalk stonden hier. Ze zitten nu in
            de strook zelf: één kader met alles over dit rondje. */}

        {mijnAantal > 0 && (
          <div style={{ ...S.card, background: MODUS_FAIR.vlak }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 17.5, fontWeight: 800, color: MODUS_FAIR.tekst }}>{L.roundWhatYouWant(roundNr)}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mijn.map((d) => (
                <button key={d.id} onClick={() => bump(d.id, meId, -1)}
                  style={{ ...S.pill, cursor: "pointer", background: "#fff", border: `1px solid ${MODUS_FAIR.randZacht}`, color: MODUS_FAIR.tekst, fontSize: 15.5 }}>
                  {aQty(d.id, meId)}× {d.name} ✕
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 7, alignItems: "stretch", marginBottom: 10 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 18, pointerEvents: "none" }}>🔍</span>
            <input value={drinkSearch} onChange={(e) => setDrinkSearch(e.target.value)} placeholder={L.searchDrink}
              style={{ ...S.input, width: "100%", boxSizing: "border-box", paddingLeft: 36, paddingRight: drinkSearch ? 34 : 12, fontSize: 18, textAlign: "left" }} />
            {drinkSearch && (
              <button onClick={() => setDrinkSearch("")}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#6b7484", padding: 4 }}>✕</button>
            )}
          </div>
        </div>

        <div style={{ display: zoekt ? "none" : "block", position: "relative", marginBottom: 8 }}>
          <div ref={catScroll} onScroll={updateCatArrows} className="rundo-catscroll"
            style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(2, auto)", gap: 6, justifyContent: "start", overflowX: "auto", padding: "0 8px 4px 0", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {catsPresent.map((c) => (
              <span key={c} style={{ ...S.tab(activeCat === c), flexShrink: 0, textAlign: "center" }} onClick={() => setActiveCat(c)}>{CAT_LABEL[c]}</span>
            ))}
          </div>
          {catMore.left && <CatPijl kant="links" />}
          {catMore.right && <CatPijl kant="rechts" />}
        </div>

        {(lijst.length === 0 && (zoekt || activeCat !== "Eigen")) ? (<>
            {/* Nog niets aangetikt en er is een vorig rondje? Dan één tik om het over
                te nemen — drankjes én toewijzing, daarna gewoon aanpasbaar. */}
            {!settle && roundItems === 0 && rounds.length > 0 && (() => {
              const vorig = rounds[rounds.length - 1]
              const stukjes = drinks.map((d) => ({ d, n: drinkTotalRound(vorig, d.id) })).filter((x) => x.n > 0)
              if (stukjes.length === 0) return null
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffdf4", border: "1.5px solid rgba(240,165,0,0.55)", borderRadius: 12, padding: "10px 12px", marginBottom: 11 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 800, color: "#8a5e0f", lineHeight: 1.3 }}>
                    {L.sameAgainTitle}
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#8b93a3", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {stukjes.map((x) => `${x.n}× ${x.d.name}`).join(" · ")} — {L.sameAgainEdit}
                    </span>
                  </span>
                  <button onClick={() => neemVorigeOver(vorig)}
                    style={{ ...S.btnP, flexShrink: 0, padding: "9px 14px", fontSize: 14.5, fontWeight: 800 }}>{L.sameAgainTake}</button>
                </div>
              )
            })()}
          {opNaam === true && !settle && renderZoekBlok()}
          <div style={{ ...S.card, textAlign: "center", color: "#9aa3b2", fontSize: 17, padding: "20px 0" }}>
            {!zoekt && !fullList ? (
              <span onClick={() => setFullList(true)} style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }}>{L.showAll}</span>
            ) : L.nothingFound}
          </div>
        </>) : (
          <div style={{ position: "relative" }}>
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", whiteSpace: "nowrap", zIndex: 2 }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
            {ikHaalNu && people.length > 1 && (
              /* Jij haalt: dan mag je ook voor de anderen aantikken — "doe mij ook
                 eentje" aan de toog. Wie je kiest krijgt eenmalig een melding. */
              <div style={{ ...S.card, padding: "9px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: doelG !== meId ? MODUS_FAIR.tekst : "#6b7484", marginBottom: 7 }}>
                  {doelG !== meId ? L.nowTappingFor(people.find((pp) => pp.id === doelG)?.name ?? "") : L.youTapFor}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {[people.find((pp) => pp.id === meId), ...people.filter((pp) => pp.id !== meId)].map((pp) => pp && (
                    <span key={pp.id} onClick={() => setHalerVoor(pp.id === meId ? null : pp.id)}
                      style={{ cursor: "pointer", borderRadius: 15, padding: "6px 12px", fontSize: 15, fontWeight: 800,
                        background: doelG === pp.id ? MODUS_FAIR.knop : "#fff",
                        color: doelG === pp.id ? "#fff" : "#6b7484",
                        border: doelG === pp.id ? "none" : "1px solid rgba(29,41,66,0.25)" }}>
                      {pp.id === meId ? `${pp.name} (${L.youWord})` : pp.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12, paddingTop: (!zoekt && fullList) ? 26 : 12, paddingBottom: (!zoekt && (catDrinks.length > lijst.length || fullList)) ? 26 : 12 }}>
            {lijst.map((d) => {
              const n = aQty(d.id, doelG)
              return (
                <div key={d.id} onClick={() => { if (!bezig) setGeenRondje(true) }}
                  style={{ padding: "10px", borderRadius: 12, cursor: bezig ? "default" : "pointer", opacity: bezig ? 1 : 0.55,
                    background: n > 0 ? MODUS_FAIR.tint : VLAK1, border: n > 0 ? `1.5px solid ${MODUS_FAIR.randZacht}` : "1px solid rgba(29,41,66,0.1)" }}>
                  <div style={{ fontSize: 17.5, fontWeight: n > 0 ? 800 : 600, color: n > 0 ? MODUS_FAIR.tekst : "#4a5567", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                  {bezig && (
                    <div style={{ ...S.row, justifyContent: "space-between", marginTop: 7 }}>
                      <button style={{ ...S.step, opacity: n > 0 ? 1 : 0.4 }} onClick={() => n > 0 && bump(d.id, doelG, -1)}>−</button>
                      <span style={{ fontSize: 20, fontWeight: 800, color: n > 0 ? MODUS_FAIR.rand : "#9aa3b2" }}>{n}</span>
                      <button style={S.step} onClick={() => bump(d.id, doelG, 1)}>+</button>
                    </div>
                  )}
                </div>
              )
            })}
            {!zoekt && (
              <div onClick={() => { setShowAddDrink(true); setNdName("") }}
                style={{ padding: "10px", borderRadius: 12, background: "#fcfdfe", border: `1.5px dashed ${settle ? MODUS_FAIR.randZacht : themaNaam ? "rgba(90,106,148,0.6)" : "rgba(240,165,0,0.6)"}`, display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", color: settle ? MODUS_FAIR.tekst : themaNaam ? "#3b486a" : "#c98a00" }}>
                <div style={{ fontSize: 17.5, fontWeight: 800, lineHeight: 1.25 }}>＋ {L.newDrinkTile}</div>
                <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.8, marginTop: 7 }}>{L.notOnList}</div>
              </div>
            )}
            </div>
            {/* "Meer/minder" hangt centraal, half over de onderrand van de lijst. */}
            {!zoekt && !fullList && catDrinks.length > lijst.length && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(true)} style={{ display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                  + {catDrinks.length - lijst.length} meer ▾
                </span>
              </div>
            )}
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
          </div>
        )}

        </>
        )}
      </div></div>
    )
  }

  if (view === "start" && welkom && !groupId && !onboardedOnce) {
    return (
      <div style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#131826 0%,#0f1420 100%)", padding: "0 0 18px", boxSizing: "border-box" }}>
        <style>{`@keyframes rundoStartWenk{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
          @keyframes rundoStartPijl{0%,100%{transform:translateX(0)}50%{transform:translateX(6px)}}
          @keyframes rundoStartWoord{0%{text-shadow:0 0 0 rgba(255,255,255,0)}7%{text-shadow:0 0 14px rgba(255,255,255,0.9),0 0 26px rgba(255,240,190,0.7)}24%{text-shadow:0 0 0 rgba(255,255,255,0)}100%{text-shadow:0 0 0 rgba(255,255,255,0)}}
          .rundo-startknop{animation:rundoStartWenk 5s ease-in-out infinite}
          .rundo-startwoord{display:inline-block;animation:rundoStartWoord 6s ease-in-out 4.95s 3}
          .rundo-startpijl{display:inline-block;animation:rundoStartPijl 1.6s ease-in-out infinite}`}</style>
        <div style={{ maxWidth: 460, margin: "0 auto", padding: "18px 16px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, marginBottom: 42 }}>
            <div style={{ transform: "scale(1.45)", transformOrigin: "right center" }}><LanguageToggle compact /></div>
          </div>
          {/* Dezelfde kaart als op het keuzescherm, ruimer opgezet: hij heeft het
              scherm nu voor zich alleen. Daarna pas de keuze zelf noteren / QR. */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 22, border: "1.5px solid rgba(240,193,75,0.55)", boxShadow: "0 18px 40px -22px rgba(0,0,0,0.9)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/party-image.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(90deg, #1c1608 0%, #1c1608 46%, rgba(28,22,8,0.94) 62%, rgba(28,22,8,0.8) 82%, rgba(28,22,8,0.6) 100%)" }} />
            <div style={{ position: "relative", zIndex: 2, padding: "24px 20px 16px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ textAlign: "center" }}>
                <RundoLogo size={66} />
                <div style={{ display: "inline-flex", alignItems: "flex-start", gap: 9, marginTop: 13, textAlign: "left", fontSize: 19, fontWeight: 700, lineHeight: 1.35 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}><KlinkIcoon size={26} /></span>
                  <span style={{ color: "#fff" }}>{L.welkomSub1}<br /><span style={{ color: "#f0c14b" }}>{L.welkomSub2}</span></span>
                </div>
              </div>
              {/* De stappen stonden om beurten links en rechts, waardoor je oog per rij
                  opnieuw moest zoeken waar het nummer stond. Nu vormen de cijfers zelf een
                  linkerkolom, met een draadje ertussen dat uitdooft voor het volgende
                  cijfer. Het cijfer tikt op en de draad loopt door naar de volgende stap:
                  drie keer, dan is het stil — een startscherm hoeft niet eeuwig te pulseren.
                  Stap 1 heeft twee manieren, vandaar twee iconen met "of"; die tekst zakt
                  daar naar de regel eronder. */}
              <style>{`@keyframes rundoFlowVul{0%{transform:scaleY(0);opacity:1}14%{transform:scaleY(1);opacity:1}72%{transform:scaleY(1);opacity:1}84%{opacity:0}100%{transform:scaleY(0);opacity:0}}
                @keyframes rundoFlowTik{0%{box-shadow:0 0 0 0 rgba(240,193,75,0.5);transform:scale(1)}7%{box-shadow:0 0 0 7px rgba(240,193,75,0);transform:scale(1.14)}16%{box-shadow:0 0 0 0 rgba(240,193,75,0);transform:scale(1)}100%{transform:scale(1)}}`}</style>
              <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                {L.welkomFlow.map((st, i) => {
                  const laatste = i === L.welkomFlow.length - 1
                  const breed = st.ic.length > 1
                  return (
                    <div key={i} style={{ position: "relative", padding: "7px 0" }}>
                      {!laatste && (
                        <>
                          <span style={{ position: "absolute", left: 13, top: 45, width: 2, height: breed ? 64 : 40, background: "linear-gradient(180deg,rgba(240,193,75,0.22),rgba(240,193,75,0))" }} />
                          <span style={{ position: "absolute", left: 13, top: 45, width: 2, height: breed ? 64 : 40, transformOrigin: "top", background: "linear-gradient(180deg,rgba(240,193,75,0.95),rgba(240,193,75,0))", animation: `rundoFlowVul 6s ease-in-out ${0.36 + i * 1.65}s 3` }} />
                        </>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#f0c14b", color: "#131826", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: `rundoFlowTik 6s ease-in-out ${i * 1.65}s 3` }}>{i + 1}</span>
                        {st.ic.map((ic, k) => (
                          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                            {k > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: "#b9a67c" }}>{L.orWordShort}</span>}
                            <span style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(240,193,75,0.16)", border: "1px solid rgba(240,193,75,0.5)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{ic}</span>
                          </span>
                        ))}
                        {!breed && <span style={{ fontSize: 16.5, fontWeight: 500, color: "#d9d2bd", lineHeight: 1.3 }}>{st.label}</span>}
                      </div>
                      {breed && <div style={{ fontSize: 16.5, fontWeight: 500, color: "#d9d2bd", lineHeight: 1.3, paddingLeft: 40, marginTop: 2 }}>{st.label}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          <button onClick={() => setWelkom(false)} className="rundo-startknop"
            style={{ position: "relative", zIndex: 2, width: "100%", display: "block", padding: "21px", border: "none", fontSize: 27, fontWeight: 800, letterSpacing: "0.005em", color: "#2a2110", cursor: "pointer", fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", background: `linear-gradient(100deg,#e2a01c 0%,#f7cd63 45%,#e2a01c 90%)`, backgroundSize: "260% 100%" }}>
            <span className="rundo-startwoord">{L.welkomStart}</span><span className="rundo-startpijl">→</span>
          </button>
          </div>
          {renderRestoVerwijzing(true)}
        </div>
      </div>
    )
  }

  if (view === "start") {
    return (
      <div style={{ ...S.page, minHeight: "auto", padding: "0 0 40px" }}><div style={{ ...S.wrap, paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)" }}>
        {renderDialogs()}
        <style>{`@keyframes rundoWenk{0%,100%{transform:translateX(0);opacity:.6}50%{transform:translateX(3px);opacity:1}}
          @keyframes rundoLoop{from{width:0}to{width:100%}}
          input::placeholder,textarea::placeholder{color:#a7b0bf;opacity:1;} html,body{overflow-x:hidden;} button,input{font-family:inherit;}`}</style>
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: "#0E1A2E", padding: "13px 14px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rundo-merk.png" alt="" height={36} style={{ width: "auto", flexShrink: 0, display: "block" }} />
          <span style={{ fontSize: 20, fontWeight: 500, color: "#fff" }}>{L.chooseHow}</span>
        </div>

        <div style={{ padding: "14px 13px" }}>

          <div>
            {/* Eén kaart: de eerste vraag gaat over wíe aantikt, niet over hoe. Snel of
                uitgebreid kies je pas op het instelscherm erna. */}
            <div style={{ opacity: bpSettle === true ? 0.6 : 1 }}>
            <div style={{ borderRadius: 20, overflow: "hidden", background: "#fff", border: bpSettle === false ? `2px solid ${MODUS_SNEL.rand}` : `1px solid rgba(29,41,66,0.16)`,
              boxShadow: bpSettle === false ? `0 16px 34px -18px ${MODUS_SNEL.gloed}, 0 3px 8px -4px rgba(29,41,66,0.35)` : "0 14px 30px -14px rgba(29,41,66,0.85), 0 3px 8px -4px rgba(29,41,66,0.35)" }}>
              <div style={{ height: 34, background: MODUS_SNEL.rand }} />
              <button onClick={() => setBpSettle(false)}
                style={{ position: "relative", width: "100%", display: "block", textAlign: "center", padding: "14px 14px 13px", cursor: "pointer", border: "none",
                  borderBottom: `1px solid ${MODUS_SNEL.randZacht}`,
                  background: bpSettle === false ? MODUS_SNEL.vlak : "linear-gradient(180deg,#fcfdfe,#fff)" }}>
                <span style={{ display: "flex", justifyContent: "center", marginTop: -38, marginBottom: 7 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 74, height: 74, borderRadius: "50%", background: "#fff", border: `2px solid ${MODUS_SNEL.rand}` }}>
                    <NoteerIcoon size={48} kleur={MODUS_SNEL.rand} />
                  </span>
                </span>
                <span style={{ display: "block", fontSize: 22, fontWeight: 800, color: "#16203a", lineHeight: 1.18, letterSpacing: -0.3 }}>{L.youNoteSelf}</span>
                <span style={{ display: "block", textAlign: "left", marginTop: 12, paddingLeft: 6 }}>
                  {[L.youNote1, L.youNote2, L.youNote3].map((t, i2) => (
                    <span key={i2} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i2 < 2 ? 5 : 0 }}>
                      <span style={{ flexShrink: 0, color: "#1f8a4c", fontWeight: 800, fontSize: 17 }}>✓</span>
                      <span style={{ fontSize: 18, color: "#4a5567", lineHeight: 1.4 }}>{t}</span>
                    </span>
                  ))}
                </span>
              </button>
              <div style={{ padding: "12px 12px 14px", background: bpSettle === false ? MODUS_SNEL.vlak : "#fff" }}>
                <button disabled={busy} onClick={() => { setBpSettle(false); startWithMode(undefined, false) }}
                  style={{ display: "block", width: "100%", padding: "15px 12px", fontSize: 19.5, fontWeight: 800, cursor: "pointer", border: "none", borderRadius: 15,
                    background: MODUS_SNEL.knop, color: MODUS_SNEL.knopTekst, boxSizing: "border-box",
                    boxShadow: `0 12px 28px -8px ${MODUS_SNEL.gloed}, 0 0 0 4px ${MODUS_SNEL.tint}` }}>{busy ? L.starting : L.startQuickBtn} →</button>
              </div>
            </div>
            </div>


            {/* Duidelijk dat er een tweede, andere keuze volgt. */}
            {/* Lijnen die naar de randen uitvagen, met het woord in kleine kapitalen: een
                scheiding die je ziet zonder dat ze zelf een knop lijkt. */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 2px" }}>
              <span style={{ flex: 1, height: 2, borderRadius: 2, background: "linear-gradient(90deg,rgba(29,41,66,0),rgba(29,41,66,0.45))" }} />
              <span style={{ flexShrink: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: "0.24em", color: "#1d2942", textTransform: "uppercase" }}>{L.orWord}</span>
              <span style={{ flex: 1, height: 2, borderRadius: 2, background: "linear-gradient(90deg,rgba(29,41,66,0.45),rgba(29,41,66,0))" }} />
            </div>

            <div style={{ opacity: bpSettle === false ? 0.6 : 1 }}>
            <div style={{ borderRadius: 20, overflow: "hidden", background: "#fff", border: bpSettle === true ? `2px solid ${MODUS_FAIR.rand}` : `1.5px solid ${MODUS_FAIR.randZacht}`,
              boxShadow: bpSettle === true ? `0 16px 34px -18px ${MODUS_FAIR.gloed}, 0 3px 8px -4px rgba(29,41,66,0.35)` : "0 14px 30px -14px rgba(29,41,66,0.85), 0 3px 8px -4px rgba(29,41,66,0.35)" }}>
              {/* Kleurbalk als vlag: nog vóór je de tekst leest weet je welke modus dit is.
                  Het icoon hangt er in een wit rondje half overheen. */}
              <div style={{ height: 34, background: MODUS_FAIR.rand }} />
              <button onClick={() => setBpSettle(true)}
                style={{ position: "relative", width: "100%", display: "block", textAlign: "center", padding: "14px 14px 13px", border: "none", cursor: "pointer",
                  borderBottom: `1px solid ${MODUS_FAIR.lijnZacht}`,
                  background: bpSettle === true ? MODUS_FAIR.vlak : "linear-gradient(180deg,#fdfcfa,#fff)" }}>
                {/* Drie toestellen, de middelste met een QR: het verschil met de andere
                    kaart is dat er méér telefoons in het spel zijn. */}
                <span style={{ display: "flex", justifyContent: "center", marginTop: -38, marginBottom: 7 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2, width: 74, height: 74, borderRadius: "50%", background: "#fff", border: `2px solid ${MODUS_FAIR.rand}`, boxSizing: "border-box" }}>
                    <GsmIcoon size={13} kleur={MODUS_FAIR.rand} dof />
                    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", marginTop: 2 }}>
                      <GsmIcoon size={24} kleur={MODUS_FAIR.rand} qr />
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: MODUS_FAIR.rand, letterSpacing: "0.06em", marginTop: 1 }}>QR</span>
                    </span>
                    <GsmIcoon size={13} kleur={MODUS_FAIR.rand} dof />
                  </span>
                </span>
                <span style={{ display: "block", fontSize: 22, fontWeight: 800, color: "#16203a", lineHeight: 1.18, letterSpacing: -0.3 }}>{L.modeTitle}</span>
                <span style={{ display: "block", textAlign: "left", marginTop: 11, paddingLeft: 6 }}>
                  {[L.modeFairSub, L.modeFairSub2, L.modeTitleSub2].map((t, i) => (
                    <span key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < 2 ? 5 : 0 }}>
                      <span style={{ flexShrink: 0, color: MODUS_FAIR.rand, fontWeight: 800, fontSize: 17 }}>✓</span>
                      <span style={{ fontSize: 18, color: "#4a5567", lineHeight: 1.4 }}>{t}</span>
                    </span>
                  ))}
                </span>
              </button>
              <div style={{ padding: "12px 12px 14px", background: bpSettle === true ? MODUS_FAIR.vlak : "#fff" }}>
                <button disabled={busy} onClick={() => { setBpSettle(true); startWithMode(undefined, true) }}
                  style={{ display: "block", width: "100%", padding: "15px 12px", fontSize: 19.5, fontWeight: 800, cursor: "pointer", borderRadius: 14, border: "none",
                    background: MODUS_FAIR.knop, color: "#fff", boxSizing: "border-box",
                    boxShadow: `0 12px 28px -8px ${MODUS_FAIR.gloed}, 0 0 0 4px ${MODUS_FAIR.tint}` }}>{busy ? L.starting : L.startQuickBtn} →</button>
              </div>
            </div>
            </div>
          </div>
        </div>
        </div>

        {savedGroups.length > 0 && (() => {
          const fmt = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : `${d.getDate()}/${d.getMonth() + 1}` }
          const open = savedGroups.filter((g) => !g.finalized)
          const dicht = savedGroups.filter((g) => g.finalized)
          const rij = (g: SavedGroup) => (
            <div key={g.id} style={{ display: "flex", alignItems: "stretch", gap: 7, marginBottom: 7 }}>
              <button onClick={() => openSavedGroup(g.id)} disabled={busy}
                style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                  /* De linkerrand draagt de status: amber = open, goud = blijft staan,
                     groen-grijs = afgesloten. Herkenbaar nog vóór je de chip leest. */
                  background: g.pinned ? "#fcfdfe" : "#fff",
                  border: "1px solid rgba(29,41,66,0.15)",
                  borderLeft: `4px solid ${!g.finalized ? "#e8a812" : g.pinned ? "#c98a00" : "#9db8a4"}` }}>
                {/* Aan de kleur en het icoon zie je in één oogopslag welke modus het was. */}
                <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21.5, background: g.settle && !g.fq ? MODUS_FAIR.tint : MODUS_SNEL.tint }}>{g.settle && !g.fq ? "⚖️" : g.uitgebreid ? "👥" : "🍻"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name || L.autoName()} <span style={{ fontWeight: 700, color: "#8b93a3", fontSize: 14.5 }}>({datumKort(g.last_active)})</span></div>
                  <div style={{ fontSize: 14.5, color: "#8b93a3", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: g.settle && !g.fq ? MODUS_FAIR.tekst : MODUS_SNEL.tekst, fontWeight: 800 }}>{g.settle && !g.fq ? L.modeFairShort : g.uitgebreid ? L.modeNaamShort : L.modeSnelTitle}</span> · {fmt(g.last_active)}{g.owned ? "" : ` · ${L.asGuest}`}
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, borderRadius: 9, padding: "3px 8px", whiteSpace: "nowrap",
                  color: !g.finalized ? "#8a5e0f" : "#5d7a66",
                  background: !g.finalized ? "rgba(240,165,0,0.14)" : "rgba(157,184,164,0.18)",
                  border: !g.finalized ? "1px solid rgba(240,165,0,0.55)" : "1px solid rgba(157,184,164,0.6)" }}>{!g.finalized ? L.statusOpen : L.statusClosed}</span>
                <span style={{ fontSize: 19, color: "#a7b0bf", flexShrink: 0 }}>›</span>
              </button>
              {/* De dagenteller ís de knop: je ziet dat de avond afloopt en verlengt met
                  dezelfde tik — via een bevestiging, zodat een mistik niets verandert. */}
              {/* De dagenteller ís de verlengknop; bij bewaarde groepen is er niets
                  om te verlengen en zegt de gouden diskette ernaast al alles. */}
              {g.owned && g.finalized && !g.pinned && (() => {
                const rest = Math.max(0, Math.ceil((Math.max(new Date(g.last_active).getTime() + AUTO_WIS, keepUntil(g.id)) - Date.now()) / DAG))
                const verlengd = keepUntil(g.id) > Date.now()
                return (
                  <button onClick={() => vraagVerlenging(g)} disabled={busy} title={L.extendYes}
                    style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 14, cursor: "pointer", padding: "0 10px", fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap",
                      background: verlengd ? "rgba(240,165,0,0.14)" : "#fcf0ef",
                      border: verlengd ? "1px solid rgba(240,165,0,0.6)" : "1px solid rgba(224,104,92,0.5)",
                      color: verlengd ? "#c88a1a" : "#b0402f" }}>{L.chipDays(rest)} 🕑</button>
                )
              })()}
              {/* Bewaren of losmaken zonder de groep te openen: goud gevuld = blijft
                  staan, grijs met streep = verdwijnt na de termijn. Losmaken loopt via
                  een bevestiging (in vraagVerlenging), want dat stelt de groep weer
                  bloot aan het automatische opruimen. */}
              {g.owned && (
                <button onClick={() => { if (g.pinned) { vraagVerlenging(g) } else { void togglePin(g) } }} disabled={busy} title={g.pinned ? L.pinOff : L.pinOn}
                  style={{ flexShrink: 0, width: 44, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    background: g.pinned ? "rgba(240,165,0,0.14)" : "#fff",
                    border: g.pinned ? "1px solid rgba(240,165,0,0.6)" : "1px solid rgba(29,41,66,0.25)",
                    color: g.pinned ? "#c88a1a" : "#6b7484" }}><BewaarIcoon aan={!!g.pinned} /></button>
              )}
              {g.owned && (
                <button onClick={() => deleteSavedGroup(g)} disabled={busy} aria-label={L.delGroupYes}
                  style={{ flexShrink: 0, width: 44, borderRadius: 12, background: "#fff", border: "1px solid rgba(29,41,66,0.2)", color: "#6b7484", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><WisIcoon /></button>
              )}
            </div>
          )
          // Zoeken op naam; bij weinig groepen heeft een zoekveld geen zin.
          const zoek = normText(groepZoek)
          const past = (g: SavedGroup) => !zoek || normText(g.name || L.autoName()).includes(zoek)
          // Bezig = een open avond waar jij bij hoort: eigen groepen altijd, gastgroepen
          // alleen als er de laatste 24 uur nog iets gebeurde. Die klep spiegelt de
          // automatische afsluiting aan admin-kant — een gast kan andermans avond niet
          // dichtzetten, en zonder de klep bleef een verlaten avond hier eeuwig hangen.
          const versGenoeg = (g: SavedGroup) => Date.now() - new Date(g.last_active).getTime() < 24 * 3600 * 1000
          // Eén lijst voor alles: open groepen eerst (waar je gebleven was — voor gasten
          // met de 24-uursklep), dan wat blijft staan, dan de rest op recentheid. Het
          // filter erboven snijdt op status; de meer-knop houdt het startscherm kort.
          const openLijst = savedGroups.filter((g) => !g.finalized && past(g) && (g.owned || versGenoeg(g)))
          const dichtLijst = savedGroups.filter((g) => g.finalized && past(g))
          const alles = [...openLijst, ...dichtLijst.filter((g) => g.pinned), ...dichtLijst.filter((g) => !g.pinned)]
          // "Afgesloten" toont álles wat dicht is — bewaard is daar een deelverzameling
          // van (vastgepind = geen vervaldatum), met zijn eigen pill voor wie enkel
          // de blijvers wil zien.
          const gefilterd = groepFilter === "open" ? alles.filter((g) => !g.finalized)
            : groepFilter === "af" ? alles.filter((g) => g.finalized)
            : groepFilter === "pin" ? alles.filter((g) => g.pinned)
            : alles
          const zichtbaarN = 3
          const zichtbaar = showAllGroups ? gefilterd : gefilterd.slice(0, zichtbaarN)
          const wisbaar = savedGroups.filter((g) => g.owned && !g.pinned)
          const bewaardTotaal = savedGroups.filter((g) => g.pinned).length
          return (
            <div style={{ marginTop: 18 }}>
              <div onClick={() => setGroepenOpen((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", marginBottom: groepenOpen ? 10 : 0 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: "#6b7484", letterSpacing: "0.02em" }}>📂 {L.savedGroups} <span style={{ color: "#9aa3b2", fontWeight: 700 }}>({savedGroups.length})</span></span>
                <span style={{ flexShrink: 0, border: "1.5px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 9, padding: "6px 11px", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>{groepenOpen ? `${L.hideWord} ▴` : `${L.showWord} ▾`}</span>
              </div>
              {groepenOpen && (<>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {([["alle", L.filterAll], ["open", L.statusOpen], ["af", L.statusClosed], ["pin", L.filterSaved]] as const).map(([f, tekst]) => (
                  <span key={f} onClick={() => { setGroepFilter(f); setShowAllGroups(false) }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 16, padding: "7px 13px", fontSize: 14, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                      background: groepFilter === f ? "#ef9f27" : "#fff",
                      border: groepFilter === f ? "1px solid #ef9f27" : "1px solid rgba(29,41,66,0.2)",
                      color: groepFilter === f ? "#412402" : "#6b7484" }}>
                    {/* De bewaard-pill draagt de diskette: hetzelfde icoon als de knop op de
                        rijen, zodat pill en knop zichtbaar over hetzelfde gaan. */}
                    {f === "pin" && <BewaarIcoon aan size={13} />}{tekst}</span>
                ))}
              </div>
              {savedGroups.length > 4 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: VLAK1, border: "1px solid rgba(29,41,66,0.18)", borderRadius: 11, padding: "8px 12px", marginBottom: 12 }}>
                  <span style={{ fontSize: 17, color: "#8b93a3" }}>🔍</span>
                  <input value={groepZoek} onChange={(e) => setGroepZoek(e.target.value)} placeholder={L.searchGroups}
                    style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: 18, fontFamily: "inherit", color: "#1d2942" }} />
                  {groepZoek && <span onClick={() => setGroepZoek("")} style={{ cursor: "pointer", fontSize: 17, color: "#8b93a3", padding: "0 2px" }}>✕</span>}
                </div>
              )}

              {/* Opruimen voorstellen op het moment dat de gebruiker er is. */}
              {stalePins.length > 0 && (
                <div style={{ ...S.card, background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.45)", padding: "12px 13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 800, color: "#8a5e0f", marginBottom: 3 }}><BewaarIcoon aan size={15} /> {L.stalePins(stalePins.length)}</div>
                  <div style={{ fontSize: 14.5, color: "#6b7484", lineHeight: 1.5, marginBottom: 9 }}>{stalePins.map((g) => g.name || L.autoName()).join(" · ")}</div>
                  <div style={{ fontSize: 14.5, color: "#6b7484", lineHeight: 1.5, marginBottom: 10 }}>{L.stalePinsWhy}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...S.btn, flex: 1, fontSize: 15.5, fontWeight: 800, padding: "10px 6px" }}
                      onClick={async () => {
                        const ids = stalePins.map((g) => g.id)
                        await supabase.from("party_groups").update({ pinned: false }).in("id", ids)
                        setSavedGroups((prev) => prev.map((x) => ids.includes(x.id) ? { ...x, pinned: false } : x))
                        setStalePins([])
                      }}>{L.pinOff}</button>
                    <button style={{ ...S.btn, flex: 1, fontSize: 15.5, fontWeight: 700, padding: "10px 6px", color: "#8b93a3" }}
                      onClick={() => setStalePins([])}>{L.stalePinsKeep}</button>
                  </div>
                </div>
              )}

              {zichtbaar.map(rij)}
              {gefilterd.length > zichtbaarN && (
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <span onClick={() => setShowAllGroups((v) => !v)} style={{ display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 14.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(29,41,66,0.3)", color: "#6b7484" }}>
                    {showAllGroups ? L.lessGroups : L.moreGroups(gefilterd.length - zichtbaarN)}
                  </span>
                </div>
              )}
              {gefilterd.length === 0 && (
                <div style={{ fontSize: 15.5, color: "#9aa3b2", textAlign: "center", padding: "14px 0" }}>{L.noSearchHit}</div>
              )}
              {/* Opruimen in één keer. Bewaarde groepen blijven staan — anders is die
                  bewaarknop zinloos — en de bevestiging zegt hoeveel er weggaat. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid rgba(29,41,66,0.12)", marginTop: 12, paddingTop: 11 }}>
                <span onClick={() => setNotice(L.retentionInfo)} style={{ fontSize: 14, fontWeight: 700, color: "#6b7484", cursor: "pointer", minWidth: 0 }}>{L.retentionInfoLink}</span>
                {wisbaar.length > 0 && (
                  <button disabled={busy} onClick={() => setConfirmDlg({
                    variant: "danger", msg: `${L.wipeAllTitle}\n\n${L.wipeAllBody(wisbaar.length, bewaardTotaal)}`,
                    yes: L.wipeAllYes(wisbaar.length), no: L.cancel,
                    onYes: async () => { setConfirmDlg(null); await wisAlleGroepen(wisbaar) },
                  })}
                    style={{ flexShrink: 0, border: "1px solid rgba(224,104,92,0.4)", color: "#c0554a", background: "#fff", borderRadius: 10, padding: "7px 11px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{L.wipeAll}</button>
                )}
              </div>
              </>)}
            </div>
          )
        })()}
        {/* Eén trap hoger dan het logo: dit startscherm ís al de Party-keuze, dus de
            link hier gaat naar het Rundo-keuzescherm (Table of Party) op de site-root.
            De chooser zet bij binnenkomst zelf de zoom recht. */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          {viaKiezer ? (
            <button onClick={() => verlaatMetNaamcheck(() => { window.location.href = "/" })} style={{ fontSize: 16, fontWeight: 700, color: "#a08d5f", background: "none", border: "none", padding: 4, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>{L.backToRundo}</button>
          ) : (
            <span style={{ fontSize: 15, color: "#8b93a3", fontWeight: 600 }}>{L.tryTableLine}{" "}
              <a href="/table" style={{ display: "inline-flex", alignItems: "center", gap: 6, verticalAlign: "middle", textDecoration: "none" }}>
                <RundoLogo size={22} opDonker={false} resto />
                <span style={{ color: "#2f9bb5", fontWeight: 800 }}>→</span>
              </a>
            </span>
          )}
        </div>

        {/* De testgroep zelf staat gewoon in de lijst hierboven en blijft daar staan.
            Deze regel maakt hem aan, of zet hem in één tik terug op nul. */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          {typeof window !== "undefined" && window.location.hostname === "localhost" && (
          <span
            onClick={() => {
              if (busy) return
              if (!testGroep) { maakTestgroep(); return }
              setConfirmDlg({
                msg: "Testgroep opnieuw opzetten? Alles wat er nu in staat gaat weg.",
                yes: "Opnieuw opzetten", no: L.cancel, variant: "danger",
                onYes: () => { setConfirmDlg(null); maakTestgroep() },
              })
            }}
            style={{ display: "inline-block", padding: "7px 15px", borderRadius: 20, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#fff", border: "1px dashed rgba(29,41,66,0.3)", color: "#8b93a3", opacity: busy ? 0.5 : 1 }}>
            {testGroep ? "↺ Testgroep opnieuw opzetten" : "🧪 Testgroep aanmaken"}
          </span>
          )}
        </div>
      </div></div>
    )
  }

  // ── SETUP (GROEP) ────────────────────────────────────────────────────────────
  if (view === "setup") {
    return (
      <div style={S.page} onClick={() => { setCoinInfo(false); setDepositInfo(false) }}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        {beginPrompt && (
          <div style={{ ...S.overlay, zIndex: 65 }} onClick={() => setBeginPrompt(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 21.5, marginTop: 0, marginBottom: 4 }}>{bpSettle === null ? L.beforeWeStart : L.beforeQrTitle}</h3>

              {/* De modus koos je al op het keuzescherm en staat op de groep. Hem hier
                  opnieuw vragen liet dit venster als een tweede keuzescherm lezen — precies
                  wat je niet verwacht na een knop die "Naar de QR-code" heet. Alleen wanneer
                  er nog niets gekozen is, tonen we de kaders. */}
              {bpSettle === null && <p style={{ fontSize: 18, fontWeight: 700, color: "#1d2942", marginBottom: 10 }}>{L.modeTitle}</p>}
              <div style={{ display: bpSettle === null ? "flex" : "none", flexDirection: "column" }}>
                {/* Fair Split BOVEN — de voorkeur. Al geselecteerd bij binnenkomst. */}
                <button onClick={() => setBpSettle(true)}
                  style={{ position: "relative", overflow: "hidden", textAlign: "left", padding: "18px 15px 15px", borderRadius: 14, cursor: "pointer",
                           background: bpSettle === true ? MODUS_FAIR.vlak : "#fff",
                           boxShadow: bpSettle === true ? `0 2px 12px -4px ${MODUS_FAIR.gloed}` : "0 1px 4px rgba(29,41,66,0.06)",
                           border: bpSettle === true ? `2.5px solid ${MODUS_FAIR.rand}` : `2px solid ${MODUS_FAIR.randZacht}` }}>
                  {/* Dezelfde kleurbalk als op het keuzescherm, zodat beide schermen één taal spreken. */}
                  <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: MODUS_FAIR.rand }} />
                  <div style={{ ...S.row, gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 21 }}>⚖️</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#1d2942" }}>{L.splitWithFair}</span>
                    {bpSettle === true && <span style={{ marginLeft: "auto", fontSize: 19, color: MODUS_FAIR.rand, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 13 }}>{L.modeFairSub}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, textAlign: "center" }}>
                    {/* Zelfde opbouw als op het startscherm: eerst scannen, dan wie wat nam. */}
                    <div>
                      <div style={{ height: 51, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ display: "inline-flex", padding: 2, borderRadius: 6, background: "#fff", border: "1px solid rgba(29,41,66,0.35)" }}>
                          <QRCodeSVG value="rundo-party" size={38} bgColor="transparent" fgColor="#1d2942" />
                        </span>
                      </div>
                      <div style={{ fontSize: 14.5, marginTop: 4, color: "#1d2942", fontWeight: 800 }}>QR scannen</div>
                    </div>
                    {[{ drank: "🍺", munten: 1, naam: "Tom" }, { drank: "🍷🍷", munten: 3, naam: "Els" }, { drank: "🍻", munten: 2, naam: "Bart" }].map((x) => (
                      <div key={x.naam}>
                        <div style={{ fontSize: 21.5, height: 24, whiteSpace: "nowrap", letterSpacing: -3 }}>{x.drank}</div>
                        <div style={{ height: 22, marginTop: 5, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          {Array.from({ length: x.munten }).map((_, k) => (
                            <span key={k} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 17, height: 17, borderRadius: "50%", background: "#FAC775", color: "#412402", fontSize: 13, fontWeight: 800 }}>€</span>
                          ))}
                        </div>
                        <div style={{ fontSize: 14.5, marginTop: 4, color: "#6b7484", fontWeight: 700 }}>{x.naam}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 15, color: "#1d2942", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(29,41,66,0.12)", lineHeight: 1.5 }}>{L.modeFairLine}</div>
                </button>

                {/* Geruststelling, precies waar de twijfel ontstaat. */}
                <div style={{ textAlign: "center", fontSize: 13.5, color: "#8b93a3", padding: "9px 0" }}>{L.modeSwitchLater}</div>

                {/* Gewoon aantallen ONDER, met bestellijstje. */}
                <button onClick={() => setBpSettle(false)}
                  style={{ position: "relative", overflow: "hidden", textAlign: "left", padding: "18px 15px 15px", borderRadius: 14, cursor: "pointer",
                           background: bpSettle === false ? MODUS_SNEL.vlak : "#fff",
                           boxShadow: bpSettle === false ? `0 2px 12px -4px ${MODUS_SNEL.gloed}` : "0 1px 4px rgba(29,41,66,0.06)",
                           border: bpSettle === false ? `2.5px solid ${MODUS_SNEL.rand}` : `2px solid ${MODUS_SNEL.randZacht}` }}>
                  {/* Dezelfde kleurbalk als op het keuzescherm, zodat beide schermen één taal spreken. */}
                  <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: MODUS_SNEL.rand }} />
                  <div style={{ ...S.row, gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 21 }}>🍺</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#1d2942" }}>{L.modeQuick}</span>
                    {bpSettle === false && <span style={{ marginLeft: "auto", fontSize: 19, color: MODUS_SNEL.rand, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 11 }}>{L.modeQuickSub}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ background: VLAK1, borderRadius: 16, padding: "5px 12px", fontSize: 16, color: "#4a5567" }}><b>3×</b> 🍺</span>
                    <span style={{ background: VLAK1, borderRadius: 16, padding: "5px 12px", fontSize: 16, color: "#4a5567" }}><b>2×</b> 🥤</span>
                    <span style={{ background: VLAK1, borderRadius: 16, padding: "5px 12px", fontSize: 16, color: "#4a5567" }}><b>1×</b> 🍷</span>
                  </div>
                  {/* Bestellijstje: wat er aan de toog moet komen. */}
                  <div style={{ borderTop: "1px solid rgba(29,41,66,0.12)", paddingTop: 10 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#6b7484", marginBottom: 5 }}>📋 Bestelling</div>
                    <div style={{ fontSize: 17, color: "#1d2942", lineHeight: 1.6 }}>3× Pils · 2× Cola · 1× Wijn</div>
                  </div>
                </button>
              </div>

              {bpSettle === true && (
                <div style={{ fontSize: 15, color: "#6b7484", margin: "14px 0 0", lineHeight: 1.5 }}>{L.settingsLater}</div>
              )}

              <button style={{ ...S.btnP, width: "100%", marginTop: 14, opacity: bpSettle === null ? 0.45 : 1 }}
                disabled={bpSettle === null}
                onClick={applyBeginChoices}>
                {bpSettle === true ? L.toQrStep : L.quickStart}
              </button>
            </div>
          </div>
        )}
        <div style={S.card}>
          {/* De enige verplichte stap staat bovenaan: wie ben jij? De groepsnaam is
              optioneel en zakte naar onder in dezelfde kaart. */}
          {(() => {
            const mijnPlaats = people.find((p) => p.id === meId)
            const mijnIdx = mijnPlaats ? people.indexOf(mijnPlaats) : -1
            return mijnPlaats ? (
              <>
                <div style={{ fontSize: 18.5, fontWeight: 800, color: "#1d2942", marginBottom: 8 }}>{L.whoAreYouTitle}</div>
                <div style={{ ...S.row, gap: 8, marginBottom: 14 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", background: MODUS_FAIR.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><KroonIcoon size={14} kleur={MODUS_FAIR.tekst} /></span>
                  <input value={isGuestDefault(mijnPlaats.name) ? "" : mijnPlaats.name}
                    placeholder={L.yourNamePh2}
                    onChange={(e) => renamePerson(mijnPlaats.id, e.target.value === "" ? `Gast ${mijnIdx + 1}` : e.target.value)}
                    style={{ ...S.input, flex: 1, minWidth: 0, padding: "10px 11px", fontSize: 18, fontWeight: 800, textAlign: "left", background: "#fff", border: "1.5px solid rgba(13,124,140,0.5)" }} />
                </div>
              </>
            ) : null
          })()}
          {/* De groepsnaam is voortaan verplicht: leeg veld zolang er alleen een
              autonaam bestaat, en de QR-knop onderaan blijft gedimd tot hij gevuld is. */}
          <div style={{ borderTop: "1px solid rgba(29,41,66,0.14)", margin: "14px 0" }} />
          <div style={{ fontSize: 18.5, fontWeight: 800, color: "#1d2942", marginBottom: 8 }}>{L.groupNameEdit}</div>
          <div style={{ ...S.row, gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: MODUS_FAIR.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>📝</span>
          <input value={isAutoNaam(groupName) ? "" : groupName} onChange={(e) => setGroupName(e.target.value)} onBlur={(e) => { if (!e.target.value.trim()) setGroupName(settle ? L.autoNameQr() : L.autoName()); persistSettings() }} onFocus={(e) => e.currentTarget.select()} onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }} placeholder={L.namePh3}
            style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontSize: 18, fontWeight: 700, padding: "10px 11px", borderRadius: 10, background: "#fff", border: "1.5px solid rgba(13,124,140,0.5)", marginBottom: 14 }} />
          </div>

        </div>

        {/* Plakt onderaan: op kleine schermen mag de weg vooruit nooit onder de vouw
            verdwijnen. De extra gloed houdt hem leesbaar over wat eronder doorschuift. */}
        <div style={{ position: "sticky", bottom: 10, zIndex: 5, display: "flex", justifyContent: "center", marginTop: 24, marginBottom: 4 }}>
          <button style={{ ...S.btnP, width: "80%", boxShadow: "0 6px 22px -6px rgba(13,124,140,0.6)" }} onClick={() => {
              if (people.length === 0) { setNotice(L.addPersonFirst); return }
              // Vul je eigen naam in vóór je deelt: anders sta jij als "Gast 1" tussen de
              // anderen en weet niemand — jijzelf incluis — welke rij van jou is.
              const mij = meId ? people.find((pp) => pp.id === meId) : null
              if (settle && (!mij || isGuestDefault(mij.name) || !mij.name.trim() || isAutoNaam(groupName) || !groupName.trim())) { setNotice(L.nameFirstNote); return }
              if (unfinishedRound) { resumeRound(); return }
              if (onboardedOnce) { setOpenRound(rounds.length - 1); setView("hub") } else if (bpSettle !== null) { applyBeginChoices() } else setBeginPrompt(true)
            }}>{unfinishedRound ? L.continueRound(roundNr) : L.toQrStep}</button>
        </div>
      </div></div>
    )
  }

  // ── SETTINGS (drank, bekers, pot) ────────────────────────────────────────────
  if (view === "settings") {
    return (
      <div style={S.page} onClick={() => { setCoinInfo(false); setDepositInfo(false) }}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 10 }}>⚙️ Groepsinstellingen</h3>
        {/* Naam en personen horen bij elkaar — ze zeggen allebei "welke groep is dit".
            De pot, bekers en coins zijn extra's en staan in een eigen kaart eronder. */}
        <div style={{ ...S.card, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#8b93a3", letterSpacing: "0.05em", marginBottom: 8 }}>{L.sectionGroup}</div>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 17.5, fontWeight: 800 }}>{!settle && isAutoNaam(groupName) ? L.giveNameQ : L.groupNamePlain}</span>
            {groepDicht && <span style={{ fontSize: 14.5, color: "#6b7484", fontWeight: 700 }}>{L.nameLockedNote}</span>}
          </div>
          <input disabled={groepDicht} value={!settle && isAutoNaam(groupName) ? "" : groupName} onChange={(e) => setGroupName(e.target.value)} onBlur={() => persistSettings()} onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }} placeholder={settle ? L.groupNamePh : L.groupNameShortPh} style={{ ...S.input, width: "100%", boxSizing: "border-box", textAlign: "left", fontWeight: 700, background: groepDicht ? "#e6eaf0" : VLAK2, color: groepDicht ? "#6b7484" : "#1d2942", cursor: groepDicht ? "not-allowed" : "text" }} />
              {!groepDicht && (!settle && isAutoNaam(groupName)
                ? <div style={{ fontSize: 14, color: "#8b93a3", fontWeight: 700, marginTop: 6 }}>{L.nowWord} {groupName.trim()}</div>
                : <div style={{ fontSize: 14, color: "#8b93a3", fontWeight: 700, marginTop: 6 }}>{L.tapToRename}</div>)}
        {settle && !fromOnboarding && (() => {
          const inleggers = people.map((pp) => ({ pp, a: potRounds.reduce((t, r) => t + (r.amounts[pp.id] || 0), 0) })).filter((x) => x.a > 0.005)
          const leeg = potContribTotal <= 0.005
          return (
            <div style={{ marginTop: 13, background: "#f4fafb", border: "1px solid rgba(13,63,73,0.18)", borderRadius: 12, padding: "11px 12px" }}>
              {leeg ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <ZakjeIcoon size={16} /><span style={{ fontSize: 15, color: MODUS_FAIR.label }}>{L.noPotYet}</span>
                  </span>
                  <button onClick={() => setShowPot(true)}
                    style={{ flexShrink: 0, cursor: "pointer", background: "#dbeef0", border: "none", color: RAND, borderRadius: 999, padding: "7px 14px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit" }}>{L.potLayBtn} +</button>
                </div>
              ) : (<>
                <div onClick={() => setPotDetails((v) => !v)} style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <ZakjeIcoon size={16} /><span style={{ fontSize: 17, fontWeight: 800, color: RAND }}>{L.potTitle}</span>
                    </span>
                    <b style={{ flexShrink: 0, fontSize: 18, color: RAND }}>{euro(potContribTotal)}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 8, borderTop: "1px solid rgba(13,63,73,0.15)" }}>
                    <span style={{ fontSize: 12.5, color: MODUS_FAIR.label, minWidth: 0 }}>{L.potSummary(inleggers.length, euro(Math.max(0, potRemaining)))}</span>
                    <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: MODUS_FAIR.rand }}>{L.detailsWord} {potDetails ? "▴" : "▾"}</span>
                  </div>
                </div>
                {potDetails && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(13,63,73,0.15)" }}>
                    {inleggers.map(({ pp, a }) => (
                      <div key={pp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(13,63,73,0.08)", fontSize: 14 }}>
                        <span style={{ color: RAND, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pp.name}</span>
                        <b style={{ flexShrink: 0, color: MODUS_FAIR.rand }}>{euro(a)}</b>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 9, marginTop: 4, borderTop: `1.5px solid ${MODUS_FAIR.randZacht}` }}>
                      <span style={{ fontSize: 13, color: MODUS_FAIR.label }}>{L.alreadySpent} <b style={{ color: "#c88a1a" }}>{euro(potSpent)}</b></span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: RAND }}>{L.stillLeft(euro(Math.max(0, potRemaining)))}</span>
                    </div>
                    <button onClick={() => setShowPot(true)}
                      style={{ width: "100%", boxSizing: "border-box", cursor: "pointer", border: "none", borderRadius: 11, padding: "10px 8px", fontSize: 14.5, fontWeight: 600, fontFamily: "inherit", color: "#fff", background: MODUS_FAIR.knop, marginTop: 11 }}>{L.potAdjust}</button>
                  </div>
                )}
              </>)}
            </div>
          )
        })()}
        {(settle || opNaam) && !fromOnboarding && (
        <div style={{ borderTop: "1px solid rgba(29,41,66,0.12)", marginTop: 12, paddingTop: 11 }}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: people.length > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 17.5, fontWeight: 800 }}>{L.peopleTitle}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button style={{ ...S.step, opacity: people.length > 0 ? 1 : 0.4 }} onClick={removeLastPerson}>−</button>
              <span style={{ fontSize: 21.5, fontWeight: 800, minWidth: 22, textAlign: "center" }}>{people.length}</span>
              <button style={{ ...S.step, background: AAN, color: "#fff", border: "none" }} onClick={addPerson}>+</button>
            </div>
          </div>
          {people.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 6 }}>
              {people.map((p, idx) => {
                // Welke van deze namen ben jij? Zonder markering zoek je dat elke keer
                // opnieuw uit — zeker wanneer je zelf een gewone voornaam invulde.
                const ikZelf = p.id === meId
                return (
                  <div key={p.id} style={{ position: "relative" }}>
                    <input value={isGuestDefault(p.name) ? "" : p.name} placeholder={isGuestDefault(p.name) ? p.name : `Gast ${idx + 1}`} onChange={(e) => renamePerson(p.id, e.target.value === "" ? `Gast ${idx + 1}` : e.target.value)}
                      style={{ ...S.input, width: "100%", boxSizing: "border-box", padding: ikZelf ? "5px 42px 5px 9px" : "5px 8px", fontSize: 18, textAlign: "left", fontWeight: ikZelf ? 700 : 400,
                        background: ikZelf ? MODUS_FAIR.vlak : undefined, border: ikZelf ? `1.5px solid ${MODUS_FAIR.rand}` : undefined, color: ikZelf ? MODUS_FAIR.tekst : undefined }} />
                    {ikZelf && <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", background: MODUS_FAIR.rand, color: "#fff", borderRadius: 9, padding: "2px 7px", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", pointerEvents: "none" }}>{L.youBadge}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}
        </div>
        <div style={{ marginTop: 24 }}>
          {(() => {
            // In snelle rondjes telt een rondje als "afgehandeld" zodra het bevestigd of
            // overgeslagen is; dan is er nooit "ga verder", enkel een nieuw rondje.
            const echtOnafgerond = unfinishedRound && (settle || !lastRoundHandled)
            // Zolang het bedrag van het vorige rondje niet bevestigd of overgeslagen is,
            // tonen we geen "nieuw rondje" — anders loop je zo van het afronden weg.
            const magNieuw = settle || lastRoundHandled
            const naarRondje = () => { setActiveCat(catsPresent[0]); setView("order") }
            // De instellingen tonen geen kopbalk, dus de weg terug moet hier staan — en
            // precies naar waar je vandaan kwam, niet naar een algemeen beginpunt.
            const terug = settingsBackTo === "quickSettle" ? { label: L.backToSettle, ga: () => setView("quickSettle") }
              : settingsBackTo === "order" ? { label: L.backToRound(roundNr), ga: naarRondje }
              : null
            // Afrekenen is vanuit de instellingen altijd bereikbaar zodra er iets te
            // verdelen valt. Kwam je er net vandaan, dan doet de terugknop hierboven dat al.
            const kanAfrekenen = (settle ? paidCount > 0 : rounds.length > 0) && settingsBackTo !== "quickSettle"
            return (
            <>
            {terug && (
              <button style={{ ...S.btnP, width: "100%", marginBottom: 10 }} onClick={terug.ga}>{terug.label}</button>
            )}
            {rounds.length > 0 ? (
            // Er zijn afgeronde rondjes: overzicht + nieuw/verder.
            <div style={{ display: "flex", gap: 10 }}>
              {!(settle && !fromQuick && isAdmin) && <button style={{ ...S.btn, flex: 1 }} onClick={() => { if (!settle || fromQuick) { setOverviewBackTo("hub"); setView("roundsOverview") } else { setOpenRound(rounds.length - 1); setView("hub") } }}>{L.roundsOverview}</button>}
              {/* Kwam je uit het bestelscherm, dan zegt de knop hierboven dit al. */}
              {echtOnafgerond
                ? (settingsBackTo === "order" ? null : <button style={{ ...S.btnP, flex: 1 }} onClick={resumeRound}>{L.continueRound(roundNr)}</button>)
                : magNieuw
                ? <button style={{ ...S.btnP, flex: 1 }} onClick={nextRound}>{settle && openRoundId ? L.continueRound(roundNr) : (!settle ? L.klaarBtn : L.newRoundBtn)}</button>
                : null}
            </div>
          ) : echtOnafgerond ? (
            // Nog geen afgerond rondje, maar wel bezig met rondje 1: verder of terug.
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => { if (!settle || fromQuick) { setNotice(L.noRoundsYet); return } setQrGevraagd(true); setView("hub") }}>{settle && !fromQuick ? L.showQr : L.roundsOverview}</button>
              {settingsBackTo !== "order" && <button style={{ ...S.btnP, flex: 1 }} onClick={resumeRound}>{L.continueRound(roundNr)}</button>}
            </div>
          ) : (
            // Groep bestaat, nog geen rondjes: kies zelf waar je heen wil. Kwam je uit het
            // bestelscherm, dan zegt de terugknop bovenaan dit al — twee knoppen naar
            // hetzelfde scherm, waarvan één "terug naar rondje 1" en één "naar 1e rondje".
            // De andere twee takken vingen dat al af; deze was vergeten.
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={() => { if (settle && !fromQuick) setQrGevraagd(true); setView("hub") }}>{settle && !fromQuick ? L.showQr : L.roundsOverview}</button>
              {settingsBackTo !== "order" && <button style={{ ...S.btnP, flex: 1 }} onClick={naarRondje}>{L.toFirstRound}</button>}
            </div>
          )}
            {/* Laatkomer? Ook als iedereen gescand heeft: je zet er een plaats bij en de
                nieuwe scant alsnog. Daarom geen voorwaarde op vrije plaatsen. */}
            {settle && !fromQuick && rounds.length > 0 && (
              <button style={{ ...S.btn, width: "100%", marginTop: 10, fontWeight: 800 }}
                onClick={() => { setQrGevraagd(true); setView("hub") }}>{L.showQr}</button>
            )}
            {kanAfrekenen && (
              <button style={{ ...S.btn, width: "100%", marginTop: 10, padding: "11px 8px", borderRadius: 12, background: RAND, border: "none", color: RANDTEKST, lineHeight: 1.3 }}
                onClick={() => { if (settle) goFinal(); else goQuickSettle() }}>
                <span style={{ display: "block", fontSize: 18, fontWeight: 600 }}>📋 {settle ? L.settleBtn : L.quickSettleTitle}</span>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: koel ? "#a8c8cd" : "#c9d2de" }}>{L.fairSubtitle}</span>
              </button>
            )}
            </>
          )
          })()}
        </div>
      </div></div>
    )
  }

  // ── ORDER ───────────────────────────────────────────────────────────────────
  // Namen zetten voor je op naam gaat noteren. Overslaan kan: dan wijs je later toe.
  // Instelscherm na "jij noteert". Snel opnemen staat bovenaan en vraagt niets: dat is
  // de belofte van die kaart. Bij uitgebreid klappen groepsnaam, aantal en namen open,
  // want zonder die drie kan de eerlijke verdeling niet kloppen.


  if (view === "order") {
    // Zoeken gaat OVER de categorieën heen en negeert de korte lijst — anders zoek je
    // naar iets wat bestaat en krijg je "niets gevonden" omdat het toevallig niet in de
    // favorieten zit.
    const zoekt = normText(drinkSearch).length > 0
    const catDrinks = zoekt ? drinks.filter((d) => drinkMatches(d.name, drinkSearch)) : drinks.filter((d) => d.cat === activeCat)
    const catVisible = zoekt ? catDrinks : catDrinks.filter((d) => fullList || d.fav || drinkTotal(d.id) > 0)
    // Voor wie tik je aan: als balk bovenin de drankjeskaart. Alleen als er echt iemand
    // gekozen is — bij "zonder namen" bestaat voorWie niet.
    const voorWieIdx = people.findIndex((pp) => pp.id === voorWie)
    const voorWieKleur = voorWieIdx >= 0 ? gastKleur(voorWieIdx) : "#F5B301"
    const qrBalk = !!voorWie && settle && !!openRoundId && isAdmin
    const needCups = depositOn && (people.some((p) => pickedUpOf(p.id) > 0) || people.some((p) => cupsBal(p.id) !== 0))
    const gaveBackTotal = people.reduce((a, p) => a + (gaveBackDraft[p.id] ?? Math.min(cupsBal(p.id), pickedUpOf(p.id))), 0)
    const cupsBlock = needCups && !cupsChecked
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <AdminTabs />
        {renderAddDrink()}
        {renderVoice()}
        {/* Het rondje als echte titel: groot links, het aantal drankjes rechts, met een
            gouden lijn eronder. Zo leest het als kop van wat volgt. */}
        <div ref={rondjeKop} style={{ scrollMarginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: `1px solid ${themaNaam ? "rgba(59,72,106,0.22)" : "rgba(29,41,66,0.18)"}`, paddingBottom: 9, marginBottom: opNaam === true && !settle ? 0 : 12 }}>
          <span style={{ fontSize: 23, fontWeight: 800, color: "#1d2942", letterSpacing: -0.3, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {L.roundWord} {roundNr}
            {repeated && roundItems > 0 && <span style={{ ...S.pill, marginLeft: 7, background: "rgba(31,138,76,0.14)", color: "#1f8a4c" }}>overgenomen ✓</span>}
          </span>
                {roundItems > 0 && (
                  <span style={{ flexShrink: 0, background: "rgba(240,165,0,0.14)", border: "1.5px solid rgba(224,138,0,0.5)", color: "#a8720a", borderRadius: 999, padding: "5px 13px", fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap" }}>{L.drinksCount(roundItems)}</span>
                )}
        </div>
        {settle && renderRunnerBar()}
        {(settle || opNaam) && renderWalk()}

        {!settle && (
          opNaam ? (
            /* Twee gelijke, gecentreerde keuzes: snel aantikken (dit scherm — actief) of
               per persoon aantikken (opent de doorloop). Zo zie je meteen wat kan. */
            null
          ) : null
          /* Snel opnemen toont hier bewust níets meer. De oude "⚖️ op naam noteren"-knop
             zette je met één (mis)tik in de uitgebreid-flow — met toewijzingsmeldingen en
             betaalstappen die snel opnemen niet kent — en eenmaal er personen bestonden,
             herkende ook het herladen de groep als uitgebreid. Een moduswissel midden in
             de avond bestaat bewust niet; op naam verdelen kan op het einde via de
             Fair Split-overstap op het afrekenscherm. */
        )}
        {/* Eerst voor wie je aantikt, dan de categorieën vlak boven de lijst. Zoeken en
            inspreken staan onderaan: die gebruik je zelden en ze duwden de drankjes weg. */}
            {/* Voor wie tik je aan? Wie via de QR binnenkwam staat achteraan en gedimd:
                die duidt normaal zelf aan. Aantikken kan wel, voor als er iets misloopt. */}
            {/* Samen turven of per persoon aantikken — wisselen mag altijd, en wat al
                op naam staat blijft gewoon staan. Alles in één kader. */}
            {!settle && (() => {
              const kleur = voorWieKleur
              return (<>
              <div style={{ background: "#fff", border: perPersoon ? `2.5px solid ${donkerder(kleur, 0.82)}` : `1.5px solid ${RAND}`, borderRadius: 13, padding: 9, marginBottom: 16 }}>
                {/* Eén baan met twee standen: alleen de gekozen helft krijgt een vlak, de
                    andere ligt er zichtbaar naast. Twee losse pillen lazen als twee acties
                    die je allebei kon aantikken — dit is duidelijk één keuze. */}
                {/* De vraag hing als klein kapitaaltje boven de baan en werd daardoor
                    gelezen als rubriekje. Nu is ze de titel van het kader eromheen: gewone
                    zinsgrootte, over de rand heen, met lucht tussen haar en de knoppen. */}
                <div style={{ position: "relative", border: "1px solid rgba(29,41,66,0.18)", borderRadius: 11, padding: "18px 0 0", marginTop: 12, marginBottom: 9 }}>
                  <span style={{ position: "absolute", top: -11, left: 12, background: "#fff", padding: "0 7px", fontSize: 17, fontWeight: 700, color: "#1d2942", whiteSpace: "nowrap" }}>{L.howNoteQ}</span>
                  {/* Donkerdere gleuf, lichte duim: dat is wat een baan als schuifbalk laat
                      lezen. De baan loopt tot tegen de kaderrand en vult de onderkant ervan —
                      dat wint twintig pixels, precies wat "voor iedereen" en het Franse
                      "par personne" nodig hadden om niet tegen de duimrand te duwen. De
                      poppetjes staan niet hier maar in de melding eronder, zodat de baan een
                      rustige schakelaar blijft. */}
                  <div style={{ display: "flex", background: "#e7ebf3", borderTop: "1px solid rgba(29,41,66,0.14)", borderRadius: "0 0 10px 10px", padding: 4 }}>
                    {[false, true].map((mode) => {
                      const aan = perPersoon === mode
                      return (
                        <button key={String(mode)} onClick={() => { setPerPersoon(mode); naarRondjeKop() }}
                          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, padding: "10px 0", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                            background: aan ? "#fdf3d8" : "transparent",
                            border: aan ? "2px solid #e0a020" : "2px solid transparent",
                            color: aan ? "#6b5b28" : "#5c667d" }}>
                          {aan && <span style={{ fontSize: 14 }}>✓</span>}
                          {mode ? L.perPersonWord : L.tikSamenWord}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {alleenJij ? (
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 9, background: "#fdf6e4", border: "1.5px solid rgba(224,138,0,0.6)", borderRadius: 12, padding: "11px 12px" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{"\u{1F465}"}</span>
                    <span style={{ fontSize: 15.5, color: "#1d2942", fontWeight: 700, lineHeight: 1.35 }}>{L.fromTwoOn}</span>
                  </div>
                ) : (
                <div ref={hintBlok} style={{ scrollMarginTop: 8, display: "flex", gap: 10, alignItems: "center", marginTop: 9, background: "#eef1f6", borderRadius: 12, padding: "11px 13px" }}>
                  {/* Eén poppetje tegenover meerdere: hetzelfde onderscheid als de knop
                      erboven. Er stond hier een vingertje bij per persoon, en dat is een
                      ander soort teken — een aanwijzing in plaats van een wie. */}
                  <span style={{ fontSize: 21, flexShrink: 0 }}>{perPersoon ? "\u{1F464}" : "\u{1F465}"}</span>
                  <span style={{ fontSize: 16.5, color: "#1d2942", fontWeight: 700, lineHeight: 1.35 }}>{perPersoon ? L.hintPerPerson : L.hintTogether}</span>
                </div>
                )}


                {perPersoon && (<>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: VLAK1, borderRadius: 10, padding: "6px 7px", marginBottom: 9 }}>
                    <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#3a4459", fontSize: 14.5, fontWeight: 800 }}>
                      <span onClick={() => { if (people.length > 1) removeLastPerson() }}
                        style={{ width: 28, height: 28, borderRadius: "50%", background: "#fff", border: "1px solid rgba(29,41,66,0.3)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", opacity: people.length > 1 ? 1 : 0.4 }}>−</span>
                      <b style={{ fontSize: 18, color: RAND }}>{people.length}</b>
                      <span style={{ color: "#6b7484", fontSize: 13.5 }}>{L.persWordLow}</span>
                      <span onClick={() => { void addPerson() }}
                        style={{ width: 28, height: 28, borderRadius: "50%", background: RAND, color: RANDTEKST, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>＋</span>
                    </span>
                    <button onClick={() => { setPersGeteld(true); setAlleenPers(true); setPersSnap(people.map((pp) => ({ id: pp.id, name: pp.name }))); setNaamPlichtNa(null); setNaamPlicht(true) }}
                      style={{ flexShrink: 0, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 5, border: "none", borderLeft: "1px solid rgba(29,41,66,0.2)", background: "transparent", color: RAND, padding: "3px 4px 3px 10px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{L.editNamesBtn}</button>
                  </div>
                {(() => {
                  if (people.length < 2 || roundItems === 0) return null
                  const klaar = people.filter((pp) => drinks.some((d) => (cart[d.id]?.[pp.id] ?? 0) > 0)).length
                  return <div ref={telRij} style={{ scrollMarginTop: 8, fontSize: 13, fontWeight: 700, color: "#8a5e0f", marginBottom: 8 }}>{L.someHaveDrinks(klaar, people.length)}</div>
                })()}
                  {/* Namen breken over meerdere regels in plaats van zijwaarts te scrollen:
                      zo staat niemand verborgen en is er geen veeggebaar om te ontdekken. */}
                  <div ref={namenRij} style={{ scrollMarginTop: 8, display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                    {people.map((pp, i) => {
                      const aan = voorWie === pp.id
                      const k = gastKleur(i)
                      const viaLink = !!pp.claimedBy && pp.id !== meId
                      return (
                        <button key={pp.id} onClick={() => {
                          if (viaLink) { setConfirmDlg({ msg: L.tapForQrGuest(pp.name), yes: L.tapForQrYes, no: L.cancel, onYes: () => { setConfirmDlg(null); setVoorWieRaw(pp.id) } }); return }
                          setVoorWieRaw(pp.id)
                        }}
                          style={{ borderRadius: 999, padding: aan ? "9px 16px" : "9px 15px", fontSize: aan ? 16.5 : 16, cursor: "pointer", fontFamily: "inherit",
                            fontWeight: 800,
                            background: aan ? k : "transparent",
                            border: `1.5px solid ${k}`,
                            color: aan ? "#2a1f06" : donkerder(k) }}>
                          {pp.id === meId ? "♛ " : viaLink ? "📱 " : ""}{pp.id === meId && !pp.named ? L.jijNaam : pp.name}
                        {(() => { const n = drinks.reduce((a, d) => a + (cart[d.id]?.[pp.id] ?? 0), 0); return n > 0 ? (
                          <span style={{ marginLeft: 6, borderRadius: 999, minWidth: 20, height: 20, padding: "0 5px", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", background: aan ? "rgba(42,31,6,0.85)" : donkerder(k), color: aan ? k : "#fff" }}>{n}</span>
                        ) : null })()}
                          {pp.id === meId && pp.named && (
                            <span style={{ marginLeft: 5, borderRadius: 999, padding: "1px 6px", fontSize: 9.5, background: aan ? "rgba(42,31,6,0.18)" : `${k}33`, color: aan ? "#2a1f06" : donkerder(k) }}>{L.youTag}</span>
                          )}
                        </button>
                      )
                    })}
                        {people.length <= 1 && (
                          <span style={{ fontSize: 14.5, fontWeight: 700, color: "#6b7484" }}>{L.aloneHint}</span>
                        )}
                  </div>
                </>)}
              </div>
              </>)
            })()}
            {settle && people.length > 0 && (
              <div style={settle ? { ...S.card, padding: "11px 12px", marginBottom: 8 } : { marginTop: -17, marginBottom: 18, background: "#fff", border: `2.5px solid ${donkerder(voorWieKleur, 0.82)}`, borderTop: "none", borderRadius: "0 0 13px 13px", padding: "0 11px 13px" }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: voorWie && voorWie !== meId ? "#8a5e0f" : "#6b7484", marginBottom: 7 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ minWidth: 0 }}>{voorWie && voorWie !== meId ? L.nowTappingFor(people.find((pp) => pp.id === voorWie)?.name ?? "") : L.youTapFor}</span>
                  </span>
                </div>
                {false ? (
                  <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <input autoFocus value={pilNaamVeld} onChange={(e) => setPilNaamVeld(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && pilNaamId) { renamePerson(pilNaamId, pilNaamVeld); setPilNaamId(null) } }}
                      placeholder={L.guestNamePh}
                      style={{ ...S.input, flex: 1, minWidth: 0, textAlign: "left", fontSize: 16, fontWeight: 800, border: "1.5px solid rgba(240,165,0,0.6)" }} />
                    <button onClick={() => { if (pilNaamId) renamePerson(pilNaamId, pilNaamVeld); setPilNaamId(null) }}
                      style={{ ...S.btnP, flexShrink: 0, padding: "9px 13px", fontSize: 15 }}>✓</button>
                    <button onClick={() => setPilNaamId(null)}
                      style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: "#6b7484", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{L.cancel}</button>
                  </div>
                ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[...people].sort((a, b) =>
                    (a.id === meId ? -1 : b.id === meId ? 1 : 0) || Number(!!a.claimedBy) - Number(!!b.claimedBy)
                  ).map((pp) => {
                    const aan = voorWie === pp.id
                    const viaLink = !!pp.claimedBy && pp.id !== meId
                    return (
                      <button key={pp.id} onClick={() => {
                        // Iemand die scande tikt normaal zelf aan. Overnemen mag — platte
                        // batterij, gsm in de jas — maar niet per ongeluk.
                        if (viaLink) { setConfirmDlg({ msg: L.tapForQrGuest(pp.name), yes: L.tapForQrYes, no: L.cancel, onYes: () => { setConfirmDlg(null); setVoorWieRaw(pp.id) } }); return }
                        setVoorWieRaw(pp.id)
                      }}
                        style={{ borderRadius: 11, padding: "8px 12px", fontSize: 16, cursor: "pointer",
                          fontWeight: aan ? 800 : 700,
                          background: aan ? "linear-gradient(135deg,#f3d27c,#ecc564)" : "#fff",
                          border: aan ? "none" : viaLink ? "1px solid rgba(29,41,66,0.18)" : "1.5px solid rgba(240,165,0,0.45)",
                          color: aan ? "#1d2942" : viaLink ? "#8b93a3" : "#1d2942",
                          opacity: aan ? 1 : viaLink ? 0.8 : 1 }}>
                        {pp.id === meId ? <KroonIcoon size={13} kleur={aan ? "#1d2942" : MODUS_FAIR.tekst} /> : viaLink ? "📱 " : ""}{pp.id === meId ? " " : ""}{pp.name}{pp.id === meId ? <span style={{ opacity: 0.75, fontSize: 13, marginLeft: 4 }}>{L.youBadge}</span> : null}

                      </button>
                    )
                  })}
                </div>
                )}

                {settle && <div style={{ fontSize: 13.5, color: "#8b93a3", marginTop: 7, lineHeight: 1.45 }}>{L.qrTapsSelf}</div>}
              </div>
            )}
        <div ref={catRij} style={{ scrollMarginTop: 8, display: zoekt ? "none" : "block", position: "relative", marginBottom: 10 }}>
          <div ref={catScroll} onScroll={updateCatArrows} className="rundo-catscroll" style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(2, auto)", gap: 6, justifyContent: "start", overflowX: "auto", padding: "0 8px 9px 0", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          <style>{`.rundo-catscroll::-webkit-scrollbar{display:none}`}</style>
          {catsPresent.map((c) => {
            const openHere = drinks.some((d) => d.cat === c && (cartAnon[d.id] ?? 0) > 0)
            const actief = activeCat === c
            return <span key={c} onClick={() => { setActiveCat(c); setFullList(false) }}
              style={{ flexShrink: 0, textAlign: "center", padding: "10px 17px", borderRadius: 22, fontSize: 18, fontWeight: actief ? 800 : 700, cursor: "pointer", whiteSpace: "nowrap",
                       background: actief ? (themaNaam ? "#232c44" : "#1d2942") : "#fff", color: actief ? (themaNaam ? "#c9d3ec" : "#fff") : (themaNaam ? "#5a6a94" : "#6b7484"),
                       border: actief ? "none" : `0.5px solid ${themaNaam ? "rgba(59,72,106,0.3)" : "rgba(29,41,66,0.22)"}` }}>
              {CAT_LABEL[c]}{openHere && <span style={{ marginLeft: 5, color: actief ? "#ffd27f" : "#e0685c", fontSize: 18 }}>●</span>}
            </span>
          })}
          </div>
          {catMore.left && <CatPijl kant="links" />}
          {catMore.right && <CatPijl kant="rechts" />}
        </div>

        {zoekt && (
          <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 8 }}>
            {catVisible.length === 0
              ? "Niets gevonden — probeer een ander woord."
              : `${catVisible.length} ${catVisible.length === 1 ? "drankje" : "drankjes"} gevonden (alle categorieën)`}
          </div>
        )}

        {(catVisible.length === 0 && (zoekt || activeCat !== "Eigen")) ? (
          <div style={{ ...S.card, textAlign: "center", padding: "18px 12px", fontSize: 17, color: "#6b7484" }}>
            Geen favorieten in {CAT_LABEL[activeCat]}. <span style={{ color: "#c98a00", fontWeight: 800, cursor: "pointer" }} onClick={() => setFullList(true)}>{L.showAll}</span>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {qrBalk && (
              <div style={{ position: "sticky", top: 0, zIndex: 4, display: "flex", alignItems: "center", gap: 10, background: "#0a4f5b", borderRadius: "18px 18px 0 0", padding: "8px 10px 8px 15px", fontSize: 15, fontWeight: 700, color: "#9fd0d9" }}>
                <span style={{ flexShrink: 0 }}>{L.tapForStrip}</span>
                <b style={{ fontWeight: 800, fontSize: 17, color: "#08323b", background: "#7fe3f2", borderRadius: 999, padding: "4px 15px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{people.find((pp) => pp.id === voorWie)?.name ?? ""}</b>
              </div>
            )}
            {!zoekt && fullList && settle && (
              <div style={{ position: "absolute", left: "50%", top: qrBalk ? 26 : -13, transform: "translateX(-50%)", whiteSpace: "nowrap", zIndex: 2 }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
            <div style={{ ...S.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12, paddingTop: (!zoekt && fullList && settle) ? 26 : 12, paddingBottom: (!zoekt && (catDrinks.length > catVisible.length || fullList)) ? 26 : 12, ...(qrBalk ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" } : {}), ...(!settle && perPersoon && voorWie ? { border: `2.5px solid ${donkerder(voorWieKleur, 0.82)}` } : {}) }}>
              {/* Zoeken + inspreken bovenin de kaart, onder de categorieën — zelfde plek
                  en zelfde blok voor snel én uitgebreid opnemen. */}
                {/* "Minder tonen" hing bovenaan de kaart, boven het zoekveld — ver van de
                    lijst die hij inklapt. Nu zit hij op de naad tussen het zoekveld en het
                    eerste drankje, met een witte achtergrond zodat hij leesbaar blijft
                    waar hij over de lijst valt. */}
                {!settle && renderVoorWieStrook(true)}
                {!settle && (
                  <div style={{ gridColumn: "1 / -1", position: "relative", marginBottom: (!zoekt && fullList) ? 11 : 0 }}>
                    {renderZoekBlok(true)}
                    {!zoekt && fullList && (
                      <span onClick={() => setFullList(false)}
                        style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -19, zIndex: 3, display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                        {L.lessGroups}
                      </span>
                    )}
                  </div>
                )}
              {catVisible.map((d) => {
                const perPers = voorWie && (settle || perPersoon)
                const tot = perPers ? (cart[d.id]?.[voorWie] ?? 0) : drinkTotal(d.id)
                const tafel = drinkTotal(d.id)
                const un = cartAnon[d.id] ?? 0
                return (
                  <div key={d.id} onClick={() => { if (settle && !bezig) setGeenRondje(true) }}
                    style={{ opacity: alleenJij ? 0.45 : settle && !bezig ? 0.55 : 1, pointerEvents: alleenJij ? "none" : "auto", cursor: settle && !bezig ? "pointer" : "default", padding: "10px 10px", borderRadius: 12, background: tot > 0 ? "rgba(31,138,76,0.08)" : themaNaam ? "#e9edf6" : "#eef1f6", border: tot > 0 ? "1.5px solid rgba(31,138,76,0.5)" : `1px solid ${themaNaam ? "rgba(59,72,106,0.14)" : "rgba(29,41,66,0.1)"}`, boxShadow: tot > 0 ? "0 0 0 3px rgba(31,138,76,0.1)" : "none" }}>
                    <div style={{ fontSize: 17.5, fontWeight: tot > 0 ? 800 : 600, color: tot > 0 ? "#1f6b3a" : themaNaam ? "#2c3752" : "#4a5567", lineHeight: 1.25 }}>{d.emoji} {d.name}</div>
                    <div style={{ ...S.row, justifyContent: "space-between", marginTop: 7 }}>
                      <button style={{ ...S.step, opacity: tot > 0 ? 1 : 0.4 }} onClick={() => { if (settle && !bezig) { setGeenRondje(true); return } bumpDown(d.id) }}>−</button>
                      <span style={{ fontSize: 20, fontWeight: 800, color: tot > 0 ? "#1f8a4c" : "#9aa3b2" }}>{tot}{false && perPers && tafel > tot ? <span style={{ fontSize: 13.5, color: "#8b93a3", fontWeight: 700 }}>/{tafel}</span> : null}</span>
                      <button style={S.step} onClick={() => { if (settle && !bezig) { setGeenRondje(true); return } bump1(d.id) }}>+</button>
                    </div>
                  </div>
                )
              })}
              {!zoekt && (
                <div onClick={() => { if (alleenJij) return; setShowAddDrink(true); setNdName("") }}
                  style={{ opacity: alleenJij ? 0.45 : 1, pointerEvents: alleenJij ? "none" : "auto", padding: "10px", borderRadius: 12, background: "#fff", border: `1.5px dashed ${settle ? MODUS_FAIR.randZacht : themaNaam ? "rgba(90,106,148,0.6)" : "rgba(224,138,0,0.75)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer", color: themaNaam ? "#2c3752" : "#4a5567" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, background: settle ? MODUS_FAIR.vlak : themaNaam ? MODUS_NAAM.vlak : "#fdf3d8", border: `1.5px solid ${settle ? MODUS_FAIR.randZacht : themaNaam ? "rgba(90,106,148,0.6)" : "rgba(224,138,0,0.6)"}`, color: settle ? MODUS_FAIR.rand : themaNaam ? "#3b486a" : "#8a5e0f" }}>＋</div>
                  <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.25, marginTop: 6 }}>{L.newDrinkTile}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#8b93a3", marginTop: 3 }}>{L.notOnList}</div>
                </div>
              )}
            </div>
            {!zoekt && !fullList && catDrinks.length > catVisible.length && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(true)} style={{ display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                  + {catDrinks.length - catVisible.length} meer ▾
                </span>
              </div>
            )}
            {!zoekt && fullList && (
              <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span onClick={() => setFullList(false)} style={{ display: "inline-block", padding: "8px 17px", borderRadius: 20, fontSize: 15, fontWeight: 600, cursor: "pointer", background: RAND, border: "none", color: RANDTEKST, boxShadow: `0 2px 8px -2px ${RAND}80` }}>
                  ▴ minder tonen
                </span>
              </div>
            )}
          </div>
        )}
        {/* Zoeken en inspreken: bij de gewone-rondjes-modi staat dit bovenin de
            drankjeskaart; hier enkel nog voor Fair Split (QR). */}
        {settle && renderZoekBlok()}

        {roundItems > 0 && (
          settle ? (
          <div style={{ ...S.card, padding: "10px 12px", background: "#fcfdfe" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#8a5e0f" }}>{settle ? L.inThisRound : `📋 ${L.orderWord}`} {settle && Object.values(cartAnon).some((q) => (q || 0) > 0) && <span style={{ fontWeight: 600, color: "#9aa3b2" }}>{L.assignHint}</span>}</span>
              <span style={{ ...S.pill, background: "rgba(240,165,0,0.18)", color: "#c98a00" }}>{L.drinksCount(roundItems)}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                const un = cartAnon[d.id] ?? 0
                return (
                  <span key={d.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 6px 4px 10px", borderRadius: 20, fontSize: 16, fontWeight: 700, background: "rgba(240,165,0,0.12)", border: "1px solid rgba(240,165,0,0.35)", color: "#1d2942" }}>
                    <span style={{ cursor: settle ? "pointer" : "default" }} onClick={() => { if (!settle) return; setAssignNaamEdit(false); setShowAssignAll(true) }}>
                      {d.emoji} {drinkTotal(d.id)}× {d.name}{settle && wieNam(d.id) && <span style={{ color: "#8b93a3", fontWeight: 600 }}> · {wieNam(d.id)}</span>}{settle && un > 0 && <span style={{ color: "#c0554a", fontWeight: 800, textDecoration: "underline" }}> toewijzen</span>}
                    </span>
                    {/* Meteen weghalen — handig als je je vertikte bij het bestellen. */}
                    <button title={L.removeWord} onClick={() => clearDrink(d.id)}
                      style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: "none", background: "rgba(224,104,92,0.16)", color: "#c0554a", fontSize: 14.5, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                  </span>
                )
              })}
            </div>
          </div>
          ) : (
          /* In "ik bestel voor de groep" was dit een vijfde wit kader op één scherm.
             Als smalle regel zie je hetzelfde in een derde van de hoogte; weghalen doe
             je op de tegel zelf. */
          <>
          {/* De toewijzen-melding woont voortaan ín het rondje-kader hieronder: het
              gaat over precies die drankjes, en rood-als-fout is vervangen door de
              ambertint van het kader zelf — mét "kan ook later". */}
          {/* Hetzelfde kaartje voor snel én uitgebreid: duidelijke titel met teller en
              chips per drankje, elk met een ingetogen ✕ om het meteen weg te halen.
              De oude platte tekstregel van snel (zonder teller, zonder verwijderen)
              is daarmee weg — één look voor de gewone-rondjes-modi. */}
          <div style={{ ...S.card, padding: "11px 13px", marginBottom: 11, background: "#fcfdfe", border: "1px solid rgba(240,165,0,0.5)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1d2942", marginBottom: 8 }}>📋 {L.inRoundTitle} <span style={{ color: "#c98a00" }}>· {L.drinksCount(roundItems)}</span></div>
              {/* Alleen wie iets dronk krijgt een regel; wie nog niets had staat samen in
                  één zin eronder. Het drankje komt eerst en de naam volgt tussen haakjes:
                  zo neemt elke regel enkel de plaats die hij nodig heeft, en als er toch
                  moet worden afgekapt sneuvelt de naam en niet het drankje. Vanaf vier
                  regels twee kolommen, anders wordt het bij grote groepen te hoog.
                  Bij "voor iedereen" heeft dit geen zin: dan staat er niets op naam. */}
              {(() => {
                type Pil = { key: string; d: typeof drinks[number]; n: number; pid: string | null; naam: string; kleur: string | null }
                const pillen: Pil[] = []
                drinks.filter((d) => drinkTotal(d.id) > 0).forEach((d) => {
                  people.forEach((pp, i) => {
                    const n = cart[d.id]?.[pp.id] ?? 0
                    if (n > 0) pillen.push({ key: `${d.id}-${pp.id}`, d, n, pid: pp.id, naam: pp.name, kleur: gastKleur(i) })
                  })
                  const anon = cartAnon[d.id] ?? 0
                  if (anon > 0) pillen.push({ key: `${d.id}-vrij`, d, n: anon, pid: null, naam: "", kleur: null })
                })
                const zonder = people.filter((pp) => !drinks.some((d) => (cart[d.id]?.[pp.id] ?? 0) > 0))
                return (<>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {pillen.map((x) => (
                      <span key={x.key}
                        onClick={() => { setAssignNaamEdit(false); setShowAssignAll(true) }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                          background: x.kleur ? `${x.kleur}2e` : "#fff",
                          border: x.kleur ? `1px solid ${x.kleur}` : "1px dashed rgba(29,41,66,0.45)",
                          borderRadius: 999, padding: "3px 4px 3px 10px", fontSize: 12.5, color: x.kleur ? "#1d2942" : "#6b7484" }}>
                        <span><b style={{ fontWeight: 800 }}>{x.d.emoji} {x.n}× {x.d.name}</b>{x.kleur && <span style={{ fontSize: 10.5, fontWeight: 800, color: donkerder(x.kleur) }}> ({x.naam})</span>}</span>
                        {/* Eén exemplaar per tik; de pil verdwijnt zodra hij op nul komt.
                            De strook onderaan biedt de weg terug bij een mistik. */}
                        <button title={L.removeWord} onClick={(e) => {
                          e.stopPropagation()
                          setLaatstWeg({ did: x.d.id, pid: x.pid, naam: `1× ${x.d.name}` })
                          if (x.pid) void bump(x.d.id, x.pid, -1); else void bumpAnon(x.d.id, -1)
                        }}
                          style={{ width: 19, height: 19, borderRadius: "50%", flexShrink: 0, border: "none", background: "rgba(29,41,66,0.12)", color: "#4a5567", fontSize: 12, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                  </div>
                  {people.length > 1 && zonder.length > 0 && zonder.length < people.length && (
                    <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px dashed rgba(29,41,66,0.2)", fontSize: 12, fontWeight: 700, color: "#9aa3b2" }}>
                      {L.nogNiets(zonder.map((pp) => pp.name).join(", "))}
                    </div>
                  )}
                  {laatstWeg && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: RAND, borderRadius: 10, padding: "7px 8px 7px 12px", marginTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#e8dcc0" }}>{L.weggehaald(laatstWeg.naam)}</span>
                      <button onClick={() => {
                        const t = laatstWeg
                        setLaatstWeg(null)
                        if (t.pid) void bump(t.did, t.pid, 1); else void bumpAnon(t.did, 1)
                      }}
                        style={{ flexShrink: 0, background: RANDTEKST, color: "#16203a", border: "none", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{L.undoWord}</button>
                    </div>
                  )}
                </>)
              })()}
            </div>
          </>
          )
        )}
        {depositOn && (
          <div style={{ marginBottom: 12 }}>
            <button style={{ ...S.btn, width: "100%" }} onClick={() => setShowCups(true)}>{L.cups}</button>
          </div>
        )}
        {settle && startedBy && meId && startedBy !== meId ? (
          /* Iemand anders haalt dit rondje: de haler rondt zelf af, dus de admin heeft
             hier geen grote bevestigknop nodig. Wat overblijft is de noodingang — het
             bedrag alvast invullen of het rondje annuleren als de haler verdween. */
          <div style={{ border: "1.5px dashed rgba(90,143,153,0.5)", borderRadius: 12, padding: "10px 13px" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: "#5a8f99", marginBottom: 8 }}>⚙️ {L.adminRoundOf(runnerName() || "?")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
              <span onClick={openClose} style={{ fontSize: 15, fontWeight: 800, color: "#3d7b86", cursor: "pointer" }}>{L.fillPayBtn}</span>
              <span onClick={annuleerRondje} style={{ fontSize: 15, fontWeight: 800, color: "#b0402f", cursor: "pointer" }}>{L.cancelRoundBtn}</span>
            </div>
          </div>
        ) : (settle || roundItems > 0) && (
        <button style={{ ...S.btnP, opacity: roundItems === 0 ? 0.5 : 1, ...(roundItems > 0 ? { position: "fixed", left: "50%", transform: "translateX(-50%)", width: "min(528px, calc(100vw - 32px))", bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", zIndex: 40, borderRadius: 999, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontWeight: 600, boxShadow: "0 8px 22px -8px rgba(29,41,66,0.75)" } : null) }} onClick={() => { if (roundItems === 0) return; if (settle) openClose(); else commitRound() }}>{settle ? L.confirmRoundTitle(roundNr) : L.doneWithRound}{roundItems > 0 && <span style={{ flexShrink: 0, background: "#F5B301", color: "#2a2110", borderRadius: 999, minWidth: 23, height: 23, padding: "0 6px", fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", order: -1 }}>{roundItems}</span>}</button>
        )}
        {settle
          ? (roundItems > 0 && !(startedBy && meId && startedBy !== meId) && <button style={{ ...S.btn, width: "100%", marginTop: 10, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelOrder}>{L.cancelRound}</button>)
          : <button style={{ width: "100%", boxSizing: "border-box", marginTop: 11, cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.28)", borderRadius: 12, fontSize: 17, fontWeight: 800, color: "#b0402f", padding: "12px 8px" }}
              onClick={() => { if (roundItems === 0) { setOverviewBackTo("hub"); setView("roundsOverview"); return } cancelOrder() }}>{L.cancelRoundShort}</button>}
        {roundItems > 0 && <div style={{ height: 66 }} />}


        {showAssignAll && (
          <div style={S.overlay} onClick={() => setShowAssignAll(false)}>
            <div style={{ ...S.sheet, maxHeight: "82vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ ...S.h3, margin: "0 0 10px", fontSize: 21.5, textAlign: "center" }}>{L.assign}</h3>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <div style={{ ...S.segBaan }}>
                  <div style={{ ...S.seg(assignMode === "person"), padding: "6px 12px", fontSize: 14.5, minWidth: 78, textAlign: "center" }} onClick={() => setAssignMode("person")}>{L.perPerson}</div>
                  <div style={{ ...S.seg(assignMode === "drink"), padding: "5px 9px", fontSize: 15, minWidth: 78, textAlign: "center" }} onClick={() => setAssignMode("drink")}>{L.perDrink}</div>
                  </div>
                </div>
              {/* Namen vergeten in te vullen? Hier aanpassen, zonder het venster of je
                  toewijzingen te verlaten — alles hangt aan nummers, dus de nieuwe naam
                  verschijnt overal. */}
              <div style={{ textAlign: "right", marginBottom: 8 }}>
                <button onClick={() => setAssignNaamEdit((v) => !v)}
                  style={assignNaamEdit
                    ? { border: "none", background: MODUS_NAAM.knop, color: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 15, fontWeight: 800, cursor: "pointer" }
                    : { background: "#fff", border: "1px solid rgba(29,41,66,0.3)", color: "#6b7484", borderRadius: 9, padding: "7px 12px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                  {assignNaamEdit ? L.doneNamesBtn : `👥 ${L.addPersonHere}`}</button>
              </div>
              {assignNaamEdit && (<>
                <div style={{ fontSize: 14.5, color: "#6b7484", marginBottom: 10, lineHeight: 1.4 }}>{L.editNamesHint}</div>
                {people.map((p, i) => {
                  const leeg = isGuestDefault(p.name)
                  return (
                    <div key={p.id} style={{ ...S.row, gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 800, color: "#9aa3b2", width: 18, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
                        <input value={leeg ? "" : p.name} onChange={(e) => renamePerson(p.id, e.target.value)} placeholder={`${p.name} · ${L.guestNamePh}`}
                          style={{ ...S.input, flex: 1, minWidth: 0, boxSizing: "border-box", textAlign: "left", fontSize: 18, fontWeight: 700, padding: leeg ? "9px 32px 9px 11px" : "9px 11px", borderRadius: 10, background: VLAK2, color: leeg ? "#9aa3b2" : "#1d2942" }} />
                        <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", width: 24, height: 24, borderRadius: 8, background: "rgba(240,165,0,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✏️</span>
                      </span>
                    </div>
                  )
                })}
              </>)}
              {!assignNaamEdit && (<>
              {assignMode === "person" && unassignedTotal > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: "#c0554a", marginBottom: 4 }}>🔴 {L.notAssignedYet(unassignedTotal)}</div>}
              <div style={{ fontSize: 14.5, color: "#6b7484", marginBottom: 8, lineHeight: 1.4 }}>{L.assignAnyone}</div>

              {assignMode === "drink" ? (
                drinks.filter((d) => drinkTotal(d.id) > 0).map((d) => {
                  const un = cartAnon[d.id] ?? 0
                  return (
                    <div key={d.id} style={{ borderTop: "1px solid rgba(29,41,66,0.1)", paddingTop: 9, marginBottom: 9 }}>
                      <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 17.5, fontWeight: 800 }}>{d.emoji} {drinkTotal(d.id)}× {d.name}</span>
                        {un > 0 && <span style={{ fontSize: 15, color: "#c0554a", fontWeight: 800 }}>🔴 {un} zonder naam</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {people.map((p) => { const n = aQty(d.id, p.id); return <span key={p.id} style={{ ...S.chip(n) }} onClick={() => assignFromAnon(d.id, p.id)}>{opNaam === true && p.id === meId && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}><KroonIcoon size={14} kleur="#8a5e0f" gevuld /></span>}{p.name}{p.claimedBy && <span style={{ fontSize: 13, marginLeft: 3, opacity: 0.7 }}>📱</span>}{n > 0 && <span style={S.badge}>{n}</span>}{n > 0 && <span onClick={(e) => { e.stopPropagation(); unassignCart(d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 17.5, fontWeight: 800, lineHeight: 1 }}>−</span>}</span> })}
                        {drinkTotal(d.id) === people.length && people.length > 0 && <span onClick={() => eachOne(d.id)} style={{ ...S.chip(0), fontSize: 16, padding: "5px 10px", border: "1.5px dashed #c98a00", background: "rgba(240,165,0,0.1)", color: "#8a5e0f", fontWeight: 800, cursor: "pointer" }}>{L.eachOne}</span>}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ display: people.length > 4 ? "grid" : "block", gridTemplateColumns: people.length > 4 ? "1fr 1fr" : undefined, columnGap: 12 }}>
                {people.map((p) => {
                  const took = drinks.filter((d) => (cart[d.id]?.[p.id] ?? 0) > 0)
                  return (
                    <div key={p.id} style={{ borderTop: "1px solid rgba(29,41,66,0.1)", paddingTop: 9, marginBottom: 9 }}>
                      <div style={{ fontSize: 17.5, fontWeight: 800, marginBottom: 6 }}>{opNaam === true && p.id === meId && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 4 }}><KroonIcoon size={14} kleur="#8a5e0f" gevuld /></span>}{p.name}{took.length > 0 && <span style={{ fontSize: 15, fontWeight: 600, color: "#6b7484" }}> · {took.reduce((a, d) => a + (cart[d.id]?.[p.id] ?? 0), 0)} drankje(s)</span>}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {drinks.filter((d) => aQty(d.id, p.id) > 0).map((d) => { const n = aQty(d.id, p.id); return <span key={d.id} style={{ ...S.chip(n) }}>{d.emoji} {d.name}<span style={S.badge}>{n}</span><span onClick={(e) => { e.stopPropagation(); unassignCart(d.id, p.id) }} style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "rgba(200,110,95,0.9)", color: "#fff", fontSize: 17.5, fontWeight: 800, lineHeight: 1, cursor: "pointer" }}>−</span></span> })}
                        {drinks.filter((d) => (cartAnon[d.id] ?? 0) > 0).map((d) => <span key={"add" + d.id} onClick={() => assignFromAnon(d.id, p.id)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 16, padding: "5px 10px", borderRadius: 20, background: "#fff", border: "1px dashed rgba(29,41,66,0.4)", color: "#6b7484", fontWeight: 700, cursor: "pointer" }}>+ {d.emoji} {d.name}</span>)}
                      </div>
                    </div>
                  )
                })}
                </div>
              )}
              </>)}
              <button style={unassignedTotal === 0 ? { ...S.btnP, marginTop: 6, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" } : { ...S.btnP, marginTop: 6 }} onClick={() => setShowAssignAll(false)}>{unassignedTotal === 0 ? "Klaar — alles toegewezen" : "Klaar"}</button>
            </div>
          </div>
        )}

        {showCups && (
          <div style={{ ...S.overlay, zIndex: 55 }} onClick={() => setShowCups(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 21.5 }}>🫙 Bekers — ronde {roundNr}</h3>
              <p style={{ ...S.sub }}>{L.howMuchEach} <b>terug</b>? Standaard = ruil. Iedereen kan teruggeven — ook wie niks bestelde of een beker van elders binnenbrengt (gaat dan negatief = krijgt waarborg).</p>
              <button style={{ ...S.btn, width: "100%", marginBottom: 12, fontSize: 17 }} onClick={() => { setGaveBackDraft(Object.fromEntries(people.map((p) => [p.id, 0]))); setCupsChecked(true); setShowCups(false) }}>{L.nobodyGaveBack}</button>
              {people.map((p) => {
                const bal = cupsBal(p.id), pu = pickedUpOf(p.id)
                const gb = gaveBackDraft[p.id] ?? Math.min(bal, pu)
                const newBal = bal + pu - gb
                return (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid rgba(29,41,66,0.08)" }}>
                    <div><div style={{ fontSize: 18, fontWeight: 800 }}>{p.name}</div><div style={{ fontSize: 15, fontWeight: 700, color: newBal < 0 ? "#1f8a4c" : "#6b7484" }}>beker-saldo: {newBal}{newBal < 0 ? " (krijgt waarborg)" : ""}</div></div>
                    <div style={{ ...S.row, gap: 7 }}>
                      <span style={{ fontSize: 14.5, color: "#6b7484" }}>{L.gaveBack}</span>
                      <button style={{ ...S.step, width: 28, height: 28, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: Math.max(0, gb - 1) })) }}>−</button>
                      <span style={{ minWidth: 16, textAlign: "center", fontSize: 18, fontWeight: 800 }}>{gb}</span>
                      <button style={{ ...S.step, width: 28, height: 28 }} onClick={() => { setCupsTouched(true); setGaveBackDraft((g) => ({ ...g, [p.id]: gb + 1 })) }}>+</button>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button style={{ ...S.btn, flex: 1 }} onClick={() => setShowCups(false)}>← terug</button>
                <button style={{ ...S.btnP, flex: 2, opacity: cupsTouched ? 1 : 0.5 }} onClick={() => { if (cupsTouched) { setCupsChecked(true); setShowCups(false) } }}>{L.ready}</button>
              </div>
            </div>
          </div>
        )}

        {showClose && (
          <div style={S.overlay} onClick={() => setShowClose(false)}>
            <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ ...S.h3, fontSize: 21.5 }}>{L.confirmRoundTitle(roundNr)}</h3>
              {unassignedTotal > 0 && (
                <div onClick={goAssignFromWarning} style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.35)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 16, color: "#b0402f", cursor: "pointer" }}>
                  🔴 <b>{L.notAssignedYet(unassignedTotal)}</b> <u>{L.tapToAssign}</u>
                </div>
              )}
              {depositOn && (cupsBlock ? (
                <div style={{ background: "rgba(224,104,92,0.12)", border: "1.5px solid rgba(224,104,92,0.6)", borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                  <div onClick={() => setShowCups(true)} style={{ fontSize: 16, color: "#b0402f", cursor: "pointer", fontWeight: 700 }}>🫙 <b>{L.cupsNotSet}</b> <u>{L.tapToArrange}</u></div>
                  <div onClick={() => setDepositOn(false)} style={{ fontSize: 15, color: "#6b7484", cursor: "pointer", marginTop: 6 }}>… of <u>ga verder zonder bekers/waarborg</u> (uitschakelen).</div>
                </div>
              ) : (
                <div style={{ ...S.row, justifyContent: "space-between", background: settle ? MODUS_FAIR.tint : "rgba(31,138,76,0.1)", borderRadius: 12, padding: "9px 12px", marginBottom: 12 }}>
                  <span style={{ fontSize: 16, color: "#1f8a4c", fontWeight: 700 }}>🫙 {gaveBackTotal > 0 ? `${gaveBackTotal} beker${gaveBackTotal === 1 ? "" : "s"} teruggegeven ✓` : "0 bekers meegegeven ✓"}</span>
                  <button style={{ ...S.btn, padding: "4px 10px", fontSize: 15 }} onClick={() => setShowCups(true)}>aanpassen</button>
                </div>
              ))}
              <button style={{ ...S.btnP, opacity: cupsBlock ? 0.5 : 1 }} onClick={() => !cupsBlock && commitRound()}>{L.confirmRoundBtn(roundItems)}</button>
              <button style={{ ...S.btn, width: "100%", marginTop: 8 }} onClick={() => setShowClose(false)}>Bestelling aanpassen</button>
            </div>
          </div>
        )}
      </div></div>
    )
  }

  // ── CONFIRMED (overzicht + betaling) ────────────────────────────────────────
  if (view === "confirmed") {
    const totalInUse = people.reduce((s, p) => s + Math.max(0, cupsBal(p.id)), 0)
    const last = rounds[rounds.length - 1]
    const items = last ? drinks.reduce((s, d) => s + drinkTotalRound(last, d.id), 0) : 0
    const st = paymentState()
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "flex-end", marginBottom: 8 }}>{potTag}</div>
        <div style={S.card}>
          <div style={{ ...S.row, gap: 9, marginBottom: 4 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🍻</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{L.roundConfirmed(roundNr, items)}</div>
            </div>
          </div>
          {depositOn && <div style={{ fontSize: 16, fontWeight: 700, color: "#8a5e0f", marginBottom: 6 }}>🫙 {totalInUse} beker{totalInUse === 1 ? "" : "s"} in omloop · {euro(totalInUse * depositPerCupEur)}</div>}
          {(() => {
            const rl = last ? drinks.filter((d) => drinkTotalRound(last, d.id) > 0) : []
            return (
              <div style={{ borderTop: "1px dashed rgba(29,41,66,0.2)", paddingTop: 8, display: "grid", gridTemplateColumns: rl.length > 4 ? "1fr 1fr" : "1fr", gap: rl.length > 4 ? "4px 14px" : 4 }}>
                {rl.map((d) => {
                  const n = drinkTotalRound(last!, d.id)
                  const who = people.filter((p) => (last!.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = last!.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                  return <div key={d.id} style={{ fontSize: 17.5 }}><b>{d.emoji} {n}× {d.name}</b>{who.length > 0 && <span style={{ color: "#6b7484" }}> → {who.join(", ")}</span>}</div>
                })}
              </div>
            )
          })()}
          <div style={{ ...S.row, justifyContent: "space-between", gap: 8, borderTop: "1px dashed rgba(29,41,66,0.25)", marginTop: 8, paddingTop: 8 }}>
            {/* "Iemand mag gaan halen" hoort bij Fair Split, waar gasten zelf aantikken.
                Bij snelle rondjes noteert de beheerder alles zelf. */}
            {settle ? <span style={{ fontSize: 17, color: "#e08a00", fontWeight: 800 }}>{L.someoneCanGo}</span> : <span />}
            <span style={{ fontSize: 17.5, fontWeight: 800, flexShrink: 0 }}>{L.total}: {items}</span>
          </div>
          {last && (() => { const un = drinks.reduce((a, d) => a + (last.anon[d.id] ?? 0), 0); return un > 0 ? (
            <div onClick={() => { editOrder(); setAssignNaamEdit(false); setShowAssignAll(true) }} style={{ marginTop: 8, background: "#fffdf4", border: "1px solid rgba(240,165,0,0.45)", borderRadius: 10, padding: "9px 11px", fontSize: 15.5, fontWeight: 800, color: "#8a5e0f", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>🍺 {L.notAssignedYet(un)}</span>
              <span style={{ flexShrink: 0, border: "1.5px solid rgba(240,165,0,0.6)", borderRadius: 9, padding: "5px 10px", fontSize: 14 }}>{L.assign}</span>
            </div>
          ) : null })()}
        </div>

        <div style={S.card}>
          {settle && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13.5, color: "#4a5567", marginBottom: 8 }}>{L.whoPaidThis}</div>
              <div style={{ ...S.segBaan }}>
                {(() => {
                  const ikBetaalde = !payPot && payPersons.length > 0
                  const knop = (aan: boolean, tekst: string, doe: () => void, kleur: string) => (
                    <button onClick={doe} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: aan ? kleur : "transparent", boxShadow: aan ? `0 2px 6px -2px ${kleur}99` : "none",
                      color: aan ? "#fff" : "#1d2942", borderRadius: 999, padding: "10px 4px", fontSize: 14.5, fontWeight: 600 }}>{tekst}</button>
                  )
                  return (<>
                    {knop(ikBetaalde, L.iPaidBtn, () => { setPayPot(false); if (meId) { setPayPersons([meId]); autoSplit([meId], false) } }, MODUS_FAIR.rand)}
                    {knop(payPot, potIsCard ? L.fromCardBtn : L.fromPotBtn, () => { if (st.potAvail <= 0.005) { setNotice(L.potEmptyPay(potIsCard)); return } setPayPersons([]); setPayPot(true); autoSplit([], true) }, "#0f7d90")}
                  </>)
                })()}
              </div>
            </div>
          )}
          <div style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 8, opacity: settle && payPersons.length === 0 && !payPot ? 0.4 : 1 }}>{!settle ? L.exactAmount : payPot ? L.howMuchPot : L.howMuchYou}</div>
          <div style={{ ...S.row, gap: 8, justifyContent: "center", margin: "2px 0", opacity: settle && payPersons.length === 0 && !payPot ? 0.4 : 1, pointerEvents: settle && payPersons.length === 0 && !payPot ? "none" : "auto" }}>
            <span style={{ fontSize: 21, fontWeight: 800 }}>€</span>
            <input style={{ ...S.input, width: 120, fontSize: 23, textAlign: "center", fontWeight: 800 }} type="text" inputMode="decimal" placeholder="0,00" value={amountDraft} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setAmountDraft(v); autoSplit(payPersons, payPot, v); setPaidConfirmed(false) }} />
          </div>
          <div style={{ fontSize: 15, color: "#6b7484", textAlign: "center", marginBottom: 14 }}>ⓘ {L.fairHintLine}</div>

          {(parseFloat(amountDraft.replace(",", ".")) || 0) > 0 ? (
          <>
                  <div style={{ background: payPersons.length === 0 && !payPot ? "rgba(240,165,0,0.09)" : "transparent",
                    border: payPersons.length === 0 && !payPot ? "1.5px dashed rgba(224,138,0,0.55)" : "1.5px solid transparent",
                    borderRadius: 13, padding: payPersons.length === 0 && !payPot ? 12 : 0, marginBottom: 4, transition: "background .2s" }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: payPersons.length === 0 && !payPot ? "#a8720a" : "#1d2942", marginBottom: 9 }}>
                      {payPersons.length === 0 && !payPot ? <>👆 {L.whoPaidTapIt}</> : L.whoPutMoney}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            <span style={{ ...S.chip(payPot ? 1 : 0), opacity: st.potAvail <= 0.005 ? 0.45 : 1 }} onClick={() => { if (!payPot && st.potAvail <= 0.005) { setNotice(`De ${potIsCard ? "drankkaart" : "pot"} is leeg (€0). Tik rechtsboven op “${potIsCard ? "drankkaart" : "pot"} + toevoegen” om eerst in te leggen.`); return } const nextPot = !payPot; setPayPot(nextPot); autoSplit(payPersons, nextPot); setPaidConfirmed(false) }}>{potIsCard ? "💳 drankkaart" : L.thePot}</span>
            {people.map((p) => <span key={p.id} style={S.chip(payPersons.includes(p.id) ? 1 : 0)} onClick={() => togglePayPerson(p.id)}>{p.name}</span>)}
          </div>
                  </div>

          {st.multi && (
            <div style={{ background: "#eef4fb", border: "1px solid rgba(47,111,181,0.25)", borderRadius: 11, padding: 11, marginTop: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#2f5693", marginBottom: 9 }}>{L.splitEvenNote}</div>
              {payPot && (
                <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>{potIsCard ? "💳" : <ZakjeIcoon size={17} />} {potIsCard ? L.cardWord : L.potWord}</span>
                  <div style={S.row}><span style={{ color: "#6b7484" }}>€</span><input style={{ ...S.input, width: 97, borderColor: st.potOver ? "#e0685c" : "rgba(29,41,66,0.22)" }} type="text" inputMode="decimal" placeholder="0,00" value={potAmtDraft} onChange={(e) => { setPotAmtDraft(e.target.value.replace(/[^0-9.,]/g, "")); setPaidConfirmed(false) }} /></div>
                </div>
              )}
              {payPersons.map((pid) => (
                <div key={pid} style={{ ...S.row, justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>👤 {people.find((p) => p.id === pid)?.name}</span>
                  <div style={S.row}><span style={{ color: "#6b7484" }}>€</span><input style={{ ...S.input, width: 97 }} type="text" inputMode="decimal" placeholder="0,00" value={payAmts[pid] ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ""); setPayAmts((m) => ({ ...m, [pid]: v })); setPaidConfirmed(false) }} /></div>
                </div>
              ))}
              <div style={{ borderTop: "1px dashed rgba(29,41,66,0.25)", paddingTop: 8, fontSize: 15.5, fontWeight: 800, color: st.valid ? "#1f8a4c" : "#c0554a" }}>
                Samen {euro(st.sum)} van {euro(st.total)}{st.valid ? " ✓ klopt" : st.missing > 0 ? ` — er ontbreekt ${euro(st.missing)}` : ` — ${euro(-st.missing)} te veel`}
              </div>
              {st.rounding && <div style={{ fontSize: 13.5, color: "#9aa3b2", marginTop: 3 }}>{L.roundingNote}</div>}
              {payPot && <div style={{ fontSize: 14.5, color: st.potOver ? "#c0554a" : "#6b7484", marginTop: 5 }}>{potIsCard ? "Drankkaart" : "Pot"} beschikbaar: {euro(Math.max(0, st.potAvail))}</div>}
            </div>
          )}
          {payPot && !st.multi && <div style={{ fontSize: 15.5, color: st.potOver ? "#c0554a" : "#6b7484", fontWeight: 700, marginTop: 8 }}>{potIsCard ? "drankkaart" : "pot"}: {euro(Math.max(0, st.potAvail))} beschikbaar{st.potOver ? " — te weinig, kies een extra betaler of leg bij" : ""}</div>}

          {(() => {
            const okGreen = paidConfirmed && st.valid
            const style = okGreen
              ? { ...S.btn, width: "100%", background: "rgba(31,138,76,0.12)", color: "#1f8a4c", border: "1px solid rgba(31,138,76,0.5)", fontWeight: 800 }
              : !st.valid
              ? { ...S.btn, width: "100%", background: "rgba(224,104,92,0.12)", color: "#b0402f", border: "1px solid rgba(224,104,92,0.5)", fontWeight: 800 }
              : S.btnP
            return <button style={{ ...style, marginTop: 14 }} onClick={confirmPayment}>{okGreen ? "✓ betaling bevestigd — pas gerust nog aan" : !st.valid ? st.reason : "✓ Bevestig betaling"}</button>
          })()}
          </>
          ) : (
            <div style={{ fontSize: 16, color: "#9aa3b2", textAlign: "center", padding: "6px 0 2px" }}>{L.fillAmountFirst}</div>
          )}
        </div>

        {paidConfirmed && st.valid && <button style={S.btnP} onClick={closeRound}>{L.closeRound}</button>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={{ ...S.btn, flex: 1, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)" }} onClick={cancelRound}>{L.cancelRound}</button>
          <button style={{ ...S.btn, flex: 1, ...(settle ? {} : { padding: "14px 8px", fontSize: 17.5, fontWeight: 800 }) }} onClick={editOrder}>{settle ? L.editOrderOld : L.editOrderBtn}</button>
        </div>
      </div></div>
    )
  }

  // ── HUB (rondjes-overzicht, bewerkbaar) ─────────────────────────────────────
  if (view === "hub") {
    return (
      <div style={S.page}><div style={S.wrap}>
        <style>{`@keyframes rundoVeldWenk{0%,100%{border-color:rgba(224,138,0,0.4);box-shadow:0 0 0 0 rgba(224,138,0,0)}50%{border-color:rgba(224,138,0,0.9);box-shadow:0 0 0 4px rgba(224,138,0,0.13)}}
          .rundo-veld-wenk{animation:rundoVeldWenk 2s ease-in-out infinite}`}</style>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <AdminTabs />
        {settle && meId && rounds.length > 0 && (
          <div style={S.card}>
            <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 9, fontSize: 19 }}>{L.whatYouDrank}</h3>
            {rounds.map((r, i) => {
              const mijne = drinks.map((d) => ({ d, n: r.orders[d.id]?.[meId] ?? 0 })).filter((x) => x.n > 0)
              if (mijne.length === 0) return null
              return (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(29,41,66,0.1)" }}>
                  <span style={{ fontSize: 16, color: "#1d2942", minWidth: 0 }}>{L.roundWord} {i + 1} · {mijne.map((x) => `${x.n}× ${x.d.name}`).join(", ")}</span>
                  <span style={{ flexShrink: 0, fontSize: 16, color: "#6b7484" }}>{show(personRoundShare(r, meId))}</span>
                </div>
              )
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0 4px" }}>
              <span style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942" }}>{L.togetherWord}</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: MODUS_FAIR.tekst }}>{show(consumption(meId))}</span>
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "rgba(240,165,0,0.12)", borderRadius: 10, padding: "10px 11px", marginTop: 6 }}>
              <span style={{ flexShrink: 0 }}>⏳</span>
              <span style={{ fontSize: 14.5, color: "#8a5e0f", lineHeight: 1.45 }}>{L.provisionalStand}</span>
            </div>
          </div>
        )}
        {/* Tijdens de omschakeling van snel naar Fair Split is de hub enkel het
            toewijsscherm. Rondjesoverzicht, nieuwe rondjes en afrekenen horen daar
            niet: die leiden je weg uit een traject van drie stappen. */}
        {/* Het potblok stond hier als eigen kaart onderaan. Het staat nu als brede balk
            onder de kop — dichter bij de geldzak, en dit scherm gaat over de QR. */}
        {!fromQuick && (rounds.length === 0 || qrGevraagd) && renderShare()}
        {/* Het potblok stond hier onderaan het QR-scherm. Het staat nu als brede balk
            onder de kop, dichter bij de geldzak waar je het zoekt. */}
        {!settle && rounds.length === 0 && !openRoundId && (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{L.noRoundsDone}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHintQuick}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={() => { setActiveCat(catsPresent[0]); setView("order") }}>{L.startFirstRoundBtn}</button>
            </div>
          </div>
        )}
        {!settle && rounds.length === 0 && openRoundId && (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{L.roundBusy(roundNr)}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHintQuick}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={() => setView("order")}>Ga verder met rondje {roundNr}</button>
            </div>
          </div>
        )}
        {!settle && rounds.length >= 1 && !lastRoundHandled && (() => {
          const idx = rounds.length - 1
          const r = rounds[idx]
          const amount = r?.amount || 0
          const potPart = r?.potPart || 0
          const potAvail = Math.max(0, potAvailFor(idx))
          const zelf = Math.max(0, amount - potPart)
          // Kleuraccenten: "zelf betaald" volgt de moduskleur (amber bij snel, inktblauw
          // bij uitgebreid), de pot is overal potblauw — bedragveld, vinkje en meldingen
          // kleuren mee. Het losse groene vinkje is daarmee overal weg.
          const accentKleur = payVia === "pot"
            ? { hoofd: "#2f6fb5", tekst: "#2f5693", pulse: "rundo-pulse-pot" }
            : { hoofd: "#e08a00", tekst: "#c88a1a", pulse: "rundo-pulse-amber" }
          const heeftBestelling = (rounds[idx] ? drinksOf(rounds[idx]).length : 0) > 0
          return (
          <>
            {/* Kop met het rondje-nummer: bij rondje 2, 3, … is meteen duidelijk waar je mee
                bezig bent. De flow zelf is voor elk rondje identiek. Bij uitgebreid opnemen
                is dit de duidelijke afsluiting in de stijl van de Fair Split-flow — zónder
                "iemand mag gaan halen", want jij noteert zelf. */}
        {opNaam === true && r && <div style={{ ...S.row, justifyContent: "center", marginTop: 6, marginBottom: 11 }}>
              <span style={{ display: "block", width: "100%", fontSize: 15, fontWeight: 600, color: "#e8dcc0", background: RAND, borderRadius: 12, padding: "10px 14px" }}>✓ {L.roundWord} {idx + 1} {L.confirmedWord} · <b style={{ fontWeight: 800, color: RANDTEKST }}>{L.drinksCount(drinksOf(r).reduce((a, x) => a + x.n, 0))}</b></span>
        </div>}
            {/* Drankjes van dit net-bevestigde rondje, met de aanpas-knop erin verwerkt. */}
            {(() => { const laatste = rounds[idx]; const lijst = laatste ? drinksOf(laatste) : []; return lijst.length > 0 && (
              <div style={{ ...S.card, padding: "12px 14px", background: "#fcfdfe", overflow: "hidden", marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: "none" }}>
                {/* Variant C: beide acties in de titelregel — barlijst én aanpassen —
                    en de aparte voetregel eronder is weg. Op een smal scherm wrappen de
                    twee links samen naar een tweede regel, rechts uitgelijnd. */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", columnGap: 8, rowGap: 3, marginBottom: 9, paddingBottom: 9, borderBottom: "1px solid rgba(29,41,66,0.1)" }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15.5, fontWeight: 800, color: "#6b7484" }}>📋 {L.orderedLabel} <span style={{ fontWeight: 600, color: "#9aa3b2" }}>— {L.drinksCount(lijst.reduce((a, x) => a + x.n, 0))}</span></span>
                  {/* De hele avond in één oogopslag: label plus zoomknopje openen samen
                      de schermvullende barlijst — het woordje ervoor zegt wat je krijgt. */}
                  <span onClick={() => setShowBarlijst(true)} style={{ marginLeft: "auto", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: themaNaam ? "#5a6a94" : "#c98a00", whiteSpace: "nowrap" }}>{L.barlistBtn}</span>
                    <span aria-label={L.barlistBtn} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 30, borderRadius: 9, border: `1px solid ${themaNaam ? "rgba(90,106,148,0.45)" : "rgba(29,41,66,0.3)"}`, background: "#fff", color: themaNaam ? "#3b486a" : "#8a5e0f", fontSize: 17 }}>🔍</span>
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: lijst.length >= 4 ? "1fr 1fr" : "1fr", gap: "2px 12px" }}>
                  {lijst.map(({ d, n }) => {
                    const who = opNaam === true && laatste
                      ? people.filter((p) => (laatste.orders[d.id]?.[p.id] ?? 0) > 0).map((p) => { const q = laatste.orders[d.id][p.id]; return q > 1 ? `${p.name} (${q})` : p.name })
                      : []
                    return (
                      <span key={d.id} style={{ padding: "4px 0", borderBottom: "1px solid rgba(29,41,66,0.08)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: "#1d2942" }}>{d.emoji} {n}× {d.name}</span>
                        {who.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6b7484" }}> ({who.join(", ")})</span>}
                      </span>
                    )
                  })}
                </div>
                {opNaam === true && (() => {
                  const anonTot = laatste ? drinks.reduce((s2, d) => s2 + (laatste.anon?.[d.id] ?? 0), 0) : 0
                  return null
                })()}
                {/* Aanpassen hoort bij de aantallen die er net boven staan: rechts
                    onderaan, in de sectie zelf verwerkt — een gewone tekstlink, geen pil. */}
                <div style={{ textAlign: "right", marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(29,41,66,0.18)" }}>
                  <span onClick={editOrder} style={{ fontSize: 15, color: "#c98a00", fontWeight: 800, cursor: "pointer" }}>✏️ {settle ? L.editRoundBtn : L.editOrderPlain}</span>
                </div>
                {/* Wat nog zonder naam staat, hoort bij deze bestelling — dus hier, net
                    onder het aanpassen. */}
                {!settle && laatste && drinks.reduce((a, d) => a + (laatste.anon[d.id] ?? 0), 0) > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, marginLeft: -14, marginRight: -14, marginBottom: -12, padding: "11px 14px", background: "#fdf6e6", borderTop: `1.5px dashed ${themaNaam ? "rgba(59,72,106,0.35)" : "rgba(29,41,66,0.35)"}`, borderRadius: "0 0 16px 16px" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, color: "#8a5e0f", lineHeight: 1.35 }}>
                      {L.notAssignedYet(drinks.reduce((a, d) => a + (laatste.anon[d.id] ?? 0), 0))}
                      <br /><span style={{ fontSize: 13, fontWeight: 600, color: "#6b7484" }}>{L.canAlsoLater}</span>
                    </span>
                    <button onClick={() => { setAssignAllMode(false); setAssignIdx(idx) }}
                      style={{ flexShrink: 0, background: VLAK1, border: `1.5px solid ${RAND}`, color: RAND, borderRadius: 999, padding: "8px 15px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{L.assign}</button>
                  </div>
                )}
              </div>
            ) })()}



            {/* Bij uitgebreid opnemen hoort de toewijs-waarschuwing direct onder de
                drankjeslijst waar het probleem zichtbaar is — niet pas helemaal onderaan. */}


            {/* Hoeveel betaald voor dit rondje. Kies eerst de bron (zelf/pot), vul één
                bedrag in, en bevestig met ✓ (of sla over). Beide sluiten het rondje af. */}
            <div style={{ ...S.card, ...(heeftBestelling ? { background: "#f6f8fb", borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}) }}>
              {/* Aantal personen staat er gewoon bij: geen vraag, maar wel zichtbaar zodat
                  een verandering meteen opvalt in plaats van pas bij het afrekenen. */}
              {/* Bij uitgebreid opnemen liggen de gasten vast — dan is deze vraag zinloos
                  en staat het aantal automatisch juist. Enkel tonen bij snel opnemen. */}
              {false && (
              <div style={{ background: VLAK1, border: `1px solid ${themaNaam ? "rgba(59,72,106,0.16)" : "rgba(29,41,66,0.14)"}`, borderRadius: 12, padding: 11, marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1d2942", marginBottom: 9, paddingBottom: 8, borderBottom: `1px solid ${themaNaam ? "rgba(59,72,106,0.14)" : "rgba(29,41,66,0.12)"}` }}>👥 {L.withHowManyQ}</div>
              <div style={{ ...S.row, justifyContent: "space-between", background: "#fff", borderRadius: 10, padding: "8px 12px" }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#8a5e0f" }}>👤 {r?.headcount || 1} {L.people}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={{ width: 30, height: 30, borderRadius: 8, background: "#fff", border: "1px solid rgba(29,41,66,0.25)", fontSize: 18, color: "#6b7484", fontWeight: 800, cursor: "pointer", opacity: (r?.headcount || 1) > 1 ? 1 : 0.4 }}
                    onClick={() => r && setRoundHeadcount(r.id, Math.max(1, (r.headcount || 1) - 1))}>−</button>
                  <button style={{ width: 30, height: 30, borderRadius: 8, background: AAN, border: "none", fontSize: 18, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                    onClick={() => r && setRoundHeadcount(r.id, (r.headcount || 1) + 1)}>+</button>
                </div>
              </div>
              </div>
              )}

              {/* Eén paneel voor de hele betaalvraag: kopbalk met het "+ pot aanvullen"-
                  linkje erin, knoppen, velden en overslaan er samen onder — zelfde stijl
                  als het personenpaneel erboven, zodat het blok als één ding leest. */}
              <div style={{ background: VLAK1, border: `1px solid ${themaNaam ? "rgba(59,72,106,0.16)" : "rgba(29,41,66,0.14)"}`, borderRadius: 12, padding: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 9, paddingBottom: 8, borderBottom: `1px solid ${themaNaam ? "rgba(59,72,106,0.14)" : "rgba(29,41,66,0.12)"}` }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#1d2942" }}>💶 {L.whatDidItCost}</span>
                <span onClick={() => setShowPot(true)} style={{ flexShrink: 0, fontSize: 14.5, fontWeight: 800, color: "#2f6fb5", cursor: "pointer", textDecoration: "underline", lineHeight: 1.2 }}>{L.potTopUpPlus}</span>
              </div>
              {/* Eén bedrag, dan één vraag — en die tweede vraag pas als er iets in de pot
                  zit. Bij een leeg bedrag toonde het scherm eerder al de hele potvraag met
                  een tweede veld en een rekenregel, over geld dat er nog niet was. Nu klapt
                  dat pas open wanneer het ergens over gaat. */}
              <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#6b7484" }}>€</span>
                <input className={amount <= 0.005 ? "rundo-veld-wenk" : undefined} {...bedragVeld(`hub-${idx}`, amount, (v) => qSetAmount(idx, v))}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur() }}
                  style={{ ...S.input, flex: 1, minWidth: 0, textAlign: "left", fontSize: 19, fontWeight: 800, border: `1.5px solid ${amount > 0.005 ? RAND : "rgba(29,41,66,0.25)"}`, color: "#1d2942" }} />
              </div>

              {(() => {
                const potdeel = payVia === "pot" ? amount : payVia === "mix" ? Math.max(0, Math.min(mixPot, amount)) : 0
                const rest = Math.round(Math.max(0, amount - potdeel) * 100) / 100
                const potNa = Math.round(Math.max(0, potAvail - potdeel) * 100) / 100
                const teVeel = potdeel > potAvail + 0.005
                const wissel = (aan: boolean, tekst: string, doe: () => void, kleur: string) => (
                  <button onClick={doe} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontFamily: "inherit", border: "none",
                    background: aan ? kleur : "transparent", boxShadow: aan ? `0 2px 6px -2px ${kleur}99` : "none",
                    color: aan ? (kleur === RAND ? RANDTEKST : "#fff") : "#1d2942",
                    borderRadius: 999, padding: "9px 4px", fontSize: 13.5, fontWeight: 600 }}>{tekst}</button>
                )
                return (<>
                  {/* Alleen vragen als er iets te halen valt. */}
                  {potAvail > 0.005 && amount > 0.005 && (<>
                    <div style={{ fontSize: 13.5, color: "#4a5567", marginBottom: 8 }}>{L.fromPotQ}</div>
                    <div style={{ ...S.segBaan, marginBottom: 10 }}>
                      {wissel(payVia === "self", L.noSelfPaid, () => { setPayVia("self"); setMixPot(0) }, RAND)}
                      {wissel(payVia !== "self", L.yesFromPot, () => { const d = Math.round(Math.min(potAvail, amount) * 100) / 100; setMixPot(d); setPayVia(d >= amount - 0.005 ? "pot" : "mix") }, "#2f6fb5")}
                    </div>
                  </>)}

                  {potAvail > 0.005 && amount > 0.005 && payVia !== "self" && (
                    <div style={{ background: "#eef4fb", border: "1px solid rgba(47,111,181,0.25)", borderRadius: 11, padding: 11, marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 9 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: "#2f5693", minWidth: 0 }}>{L.potPaysWholeQ}</span>
                        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#2f5693", display: "inline-flex", alignItems: "center", gap: 4 }}><ZakjeIcoon size={14} /> {euro(potAvail)}</span>
                          <span onClick={() => setShowPot(true)} style={{ fontSize: 12, fontWeight: 800, color: "#2f6fb5", textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}>{L.potTopUpPlus}</span>
                        </span>
                      </div>
                      <div style={{ ...S.segBaan, background: "#fff", marginBottom: 10 }}>
                        {wissel(payVia === "pot", `${L.yesWord}, ${euro(amount)}`, () => { setMixPot(amount); setPayVia("pot") }, "#2f6fb5")}
                        {wissel(payVia === "mix", L.noPartOnly, () => { const d = Math.round(Math.min(potAvail, amount) * 100) / 100; setMixPot(d); setPayVia("mix") }, "#2f6fb5")}
                      </div>
                      {payVia === "pot" ? (
                        /* Alles uit de pot: geen rest, maar wél nuttig om te zeggen wat er
                           daarna nog in de pot zit. */
                        <div style={{ textAlign: "center", fontSize: 14.5, fontWeight: 700, color: "#2f5693", lineHeight: 1.5, padding: "2px 0" }}>
                          {L.wholeRoundFromPot}<br />
                          <span style={{ color: "#4a5567" }}>{L.potLeftAfter} <b style={{ fontSize: 17, color: "#2f5693" }}>{euro(potNa)}</b></span>
                        </div>
                      ) : (<>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#2f5693" }}>{L.fromPotLabel}</span>
                          <input {...bedragVeld(`mixpot-${idx}`, mixPot, (v) => setMixPot(Math.max(0, Math.min(v, amount))))}
                            style={{ ...S.input, width: 104, padding: "6px 11px", textAlign: "right", fontSize: 17, fontWeight: 800, background: "#fff", border: `1.5px solid ${teVeel ? "#b0402f" : "#2f6fb5"}`, color: "#2f5693" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#8a5e0f" }}>{L.notFromPotLabel}</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: "#c88a1a" }}>+ {euro(rest)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 0", marginTop: 4, borderTop: "1.5px solid rgba(47,111,181,0.3)" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#1d2942" }}>{L.togetherWord}</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: "#1d2942" }}>{euro(amount)}</span>
                        </div>
                      </>)}
                      {teVeel && <div style={{ fontSize: 13, fontWeight: 800, color: "#b0402f", marginTop: 8 }}>{L.potShortTitle}</div>}
                    </div>
                  )}

                  <button className={amount > 0.005 && !teVeel ? (potdeel > 0.005 ? "rundo-pulse-pot" : "rundo-pulse-amber") : undefined}
                    style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "13px 0", fontSize: 16, fontWeight: 700, cursor: amount > 0.005 ? "pointer" : "default", fontFamily: "inherit",
                      border: amount <= 0.005 ? "1.5px dashed rgba(224,138,0,0.55)" : "1.5px solid transparent",
                      color: amount <= 0.005 ? "#a8720a" : "#fff",
                      background: amount <= 0.005 ? "rgba(240,165,0,0.1)" : potdeel > 0.005 ? "#2f6fb5" : "#e08a00",
                      boxShadow: amount > 0.005 ? `0 3px 10px -3px ${potdeel > 0.005 ? "rgba(47,111,181,0.7)" : "rgba(224,138,0,0.7)"}` : "none" }}
                    onClick={() => { (document.activeElement as HTMLElement)?.blur?.(); if (amount > 0.005) confirmQuickPay() }}>
                    {amount <= 0.005 ? <>{L.fillAmountHint}&nbsp;&nbsp;&nbsp;↑</> : <>✓ {euro(amount)} {L.confirmShort}</>}</button>
                </>)
              })()}

                {/* Overslaan hoort bij de betaalkaart, niet eronder: anders lijkt een
                    bedrag invullen de enige weg. De zin staat tegen de knop aan, zodat
                    de nabijheid het verband legt. */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 9, marginTop: 11 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#8b7d5e" }}>{L.canAlsoLater}</span>
                  <button onClick={() => closeQuickRound(true)}
                    style={{ flexShrink: 0, cursor: "pointer", background: "#fff", border: "1.5px solid rgba(29,41,66,0.3)", borderRadius: 11, padding: "9px 15px", fontSize: 14, fontWeight: 700, color: "#1d2942", fontFamily: "inherit" }}>{L.skipWord}</button>
                </div>
              </div>
            </div>
          </>
          )
        })()}
        {/* Alles toegewezen en je kwam uit de snelle modus? Dan is dit de weg vooruit.
            Eén knop, geen kaart: je hebt hier verder niets te beslissen. */}
        {/* Staat het toewijspaneel open, dan draagt dat zélf de knoppen naar stap 3 en
            terug naar de namen. Dit kaartje erbij zou hetzelfde twee keer zeggen. */}
        {settle && fromQuick && assignIdx === null && rounds.length > 0 && unassignedAllRounds === 0 && (
          <div style={{ ...S.card, background: "rgba(31,138,76,0.06)", border: "1.5px solid rgba(31,138,76,0.35)" }}>
            {/* Ook wanneer alles al toegewezen is blijft dit stap 2: dezelfde balk, dezelfde
                weg vooruit én achteruit. Anders lijkt het alsof de stap werd overgeslagen. */}
            {stapBalk(2)}
            <div style={{ fontSize: 17.5, fontWeight: 800, color: "#1f6b3a", marginBottom: 11 }}>✅ {L.allAssignedDone}</div>
            <button style={{ ...S.btnP, width: "100%", background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" }}
              onClick={() => setView("payers")}>{L.toStep3}</button>
            {/* Alles toegewezen betekent niet dat je niets meer wil schuiven. */}
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 16, fontWeight: 800, color: "#8a5e0f" }}
              onClick={() => { setAssignAllMode(true); setAssignIdx(0) }}>{L.openAssign}</button>
            <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 17, fontWeight: 700, color: "#6b7484" }}
              onClick={() => setView("fairSetup")}>{L.backToNames}</button>
          </div>
        )}
        {/* Bij uitgebreid opnemen staat deze kaart tijdens het afsluiten al bovenaan,
            direct onder de drankjeslijst — dan niet nog eens onderaan herhalen. */}
        {settle && !fromQuick && unassignedAllRounds > 0 && firstUnassignedIdx >= 0 && (
          <div style={{ ...S.card, background: "rgba(224,104,92,0.08)", border: "1.5px solid rgba(224,104,92,0.45)" }}>
            {fromQuick && stapBalk(2)}
            <div style={{ fontSize: 17.5, fontWeight: 800, color: "#b0402f", marginBottom: 4 }}>{L.unassignedHub(unassignedAllRounds)}</div>
            <div style={{ fontSize: 15.5, color: "#8a6b5f", lineHeight: 1.5, marginBottom: 11 }}>{L.unassignedHubWhy}</div>
            <button style={{ ...S.btnP, width: "100%", background: "linear-gradient(135deg,#e0725c,#c0554a)" }}
              onClick={() => { setAssignAllMode(true); setAssignIdx(firstUnassignedIdx) }}>{L.assignAllBtn}</button>
            {fromQuick && (
              <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 17, fontWeight: 700, color: "#6b7484" }}
                onClick={() => setView("fairSetup")}>{L.back}</button>
            )}
          </div>
        )}

        {!fromQuick && settle && rounds.length > 0 && unassignedAllRounds === 0 && (
        <div style={{ ...S.row, justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.roundsOverview}</h3>
          {potTag}
        </div>
        )}
        {/* Zolang er nog geen rondje is, is dit het QR-scherm: alleen delen en de pot.
            Een leeg rondjesoverzicht of een "start je eerste rondje"-blok hoort hier niet;
            dat komt vanzelf zodra de eerste bestelling er is. */}
        {fromQuick && rounds.length > 0 && (
          <div style={{ ...S.card, textAlign: "center", padding: "22px 18px" }}>
            <div style={{ fontSize: 16, color: "#6b7484", marginBottom: 14, lineHeight: 1.5 }}>{L.backToOverviewHint}</div>
            <button style={{ ...S.btnP, width: "100%" }} onClick={() => { setFromQuick(false); setView("roundsOverview") }}>{L.toRoundsOverview}</button>
          </div>
        )}
        {fromQuick || (settle && rounds.length === 0) ? null : settle && paidCount === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "28px 18px" }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🍻</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{L.noRoundsDone}</div>
            <div style={{ ...S.sub, marginBottom: 16 }}>{L.noRoundsHint}</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button style={{ ...S.btnP, width: "80%" }} onClick={startFirstRound}>{unfinishedRound ? L.continueRound(roundNr) : "Start 1e rondje"}</button>
            </div>
          </div>
        ) : (!settle || unassignedAllRounds > 0) ? null : (<>
        <div style={{ marginTop: 22, marginBottom: 10, borderTop: `2px solid ${settle ? MODUS_FAIR.randZacht : "rgba(240,165,0,0.5)"}`, paddingTop: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 21.5, fontWeight: 800, color: "#1d2942", lineHeight: 1.25 }}>{L.roundsSoFar(paidCount)}</span>
              <span style={{ display: "block", fontSize: 15, color: "#6b7484", marginTop: 2 }}>{L.tapRoundToEdit}</span>
            </span>
            {paidCount > 1 && (
              <button onClick={() => setAllRoundsOpen((v) => !v)}
                style={{ flexShrink: 0, cursor: "pointer", background: "#fff", border: `1.5px solid ${settle ? MODUS_FAIR.randZacht : "rgba(240,165,0,0.5)"}`, color: settle ? MODUS_FAIR.tekst : "#8a5e0f", borderRadius: 10, padding: "8px 12px", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>
                {allRoundsOpen ? `${L.collapseAll} ▴` : `${L.expandAll} ▾`}
              </button>
            )}
          </div>
        </div>

        {rounds.map((r, idx) => ({ r, idx })).reverse().map(({ r, idx }) => {
          if (!roundIsPaid(r)) return null
          const items = drinks.reduce((s, d) => s + drinkTotalRound(r, d.id), 0)
          const open = allRoundsOpen || openRound === idx
          const roundDrinks = drinks.filter((d) => drinkTotalRound(r, d.id) > 0)
          return (
            <div key={idx} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <div style={{ cursor: "pointer", padding: 14 }} onClick={() => { if (allRoundsOpen) { setAllRoundsOpen(false); setOpenRound(idx) } else { setOpenRound(open ? null : idx) } setEditOpen(false); setEditCups(false); setEditPay(false) }}>
                <div style={{ ...S.row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 19, fontWeight: 800 }}>{L.roundWord} {idx + 1} <span style={{ fontSize: 15.5, fontWeight: 600, color: "#6b7484" }}>· {L.drinksCount(items)} · {euro(r.amount)}</span>{!drinks.some((d) => (r.anon[d.id] ?? 0) > 0) && <span style={{ fontSize: 15, fontWeight: 800, color: "#1f8a4c", marginLeft: 6 }}>{L.assigned}</span>}</span>
                  {opNaam === true ? (
                    <span style={{ flexShrink: 0, fontSize: 20, fontWeight: 800, color: "#8a5e0f", lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
                  ) : (
                  <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, fontSize: 15.5, fontWeight: 800,
                    background: open ? (settle ? MODUS_FAIR.tint : "rgba(240,165,0,0.15)") : "transparent",
                    border: `1.5px solid ${settle ? MODUS_FAIR.lijnZacht : "rgba(240,165,0,0.4)"}`,
                    color: settle ? MODUS_FAIR.tekst : "#8a5e0f" }}>{open ? "▴" : "▾"}</span>
                  )}
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "#1f8a4c", marginTop: 3 }}>✓ betaald: {paidLabel(r)}</div>
              </div>
              {(() => {
                const un = drinks.reduce((a, d) => a + (r.anon[d.id] ?? 0), 0)
                if (un === 0 || !settle) return null
                return (
                  <div onClick={() => { setAssignIdx(idx) }} style={{ margin: "0 14px 14px", background: "rgba(224,104,92,0.12)", border: "1px solid rgba(224,104,92,0.5)", borderRadius: 10, padding: "9px 11px", fontSize: 16, fontWeight: 800, color: "#b0402f", cursor: "pointer", textAlign: "center" }}>
                    🔴 {L.notAssignedYet(un)} <u>{L.tapToAssign}</u>
                  </div>
                )
              })()}
              {open && (
                <div style={{ padding: "0 14px 14px" }}>
                  {roundDrinks.map((d) => {
                    const wie = people.filter((p) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
                    // Bij uitgebreid opnemen zijn de namen de kern: amber en met het
                    // kroontje bij je eigen naam, net als in de toewijs-schermen.
                    return <div key={d.id} style={{ fontSize: 17.5, marginBottom: 3 }}><b>{d.emoji} {drinkTotalRound(r, d.id)}× {d.name}</b>{wie.length > 0 && <span style={{ color: opNaam === true ? "#8a5e0f" : "#6b7484", fontWeight: opNaam === true ? 700 : undefined }}> → {wie.map((p, i2) => { const q = r.orders[d.id][p.id]; return <span key={p.id}>{i2 > 0 ? ", " : ""}{opNaam === true && p.id === meId && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 3 }}><KroonIcoon size={13} kleur="#8a5e0f" gevuld /></span>}{p.name}{q > 1 ? ` (${q})` : ""}</span> })}</span>}</div>
                  })}

                  <div style={{ ...S.row, justifyContent: "flex-end", marginTop: 10 }}>
                    <button style={{ ...S.btn, fontSize: 15.5, padding: "5px 12px", fontWeight: 800, color: "#8a5e0f" }} onClick={() => { const next = !editOpen; setEditOpen(next); if (!next) { setEditCups(false); setEditPay(false) } }}>{editOpen ? "▴ sluiten" : "✏️ aanpassen"}</button>
                  </div>
                  {editOpen && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button style={{ ...S.btn, flex: 1, fontSize: 15, padding: "7px 0" }} onClick={() => { setEditCups(false); setEditPay(false); setAssignIdx(idx) }}>toewijzen{!drinks.some((d) => (r.anon[d.id] ?? 0) > 0) && <span style={{ color: "#1f8a4c", fontWeight: 800 }}> ✓</span>}</button>
                      <button style={{ ...S.btn, flex: 1, fontSize: 15, padding: "7px 0", ...(editPay ? { background: "rgba(240,165,0,0.16)", borderColor: "rgba(240,165,0,0.5)", fontWeight: 800 } : {}) }} onClick={() => { setEditPay((v) => !v); setEditCups(false) }}>{L.amountAndPayer}</button>
                      {depositOn && <button style={{ ...S.btn, flex: 1, fontSize: 15, padding: "7px 0", ...(editCups ? { background: "rgba(240,165,0,0.16)", borderColor: "rgba(240,165,0,0.5)", fontWeight: 800 } : {}) }} onClick={() => { setEditCups((v) => !v); setEditPay(false) }}>bekers</button>}
                    </div>
                  )}


                  {editPay && (
                    <div style={{ marginTop: 10, background: "#eef1f6", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.04em", color: "#1d2942", marginBottom: 9 }}>{L.costLabel}</div>
                      <div style={{ ...S.row, gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: "#6b7484" }}>€</span>
                        <input style={{ ...S.input, width: 110, fontSize: 19, borderColor: (r.amount || 0) <= 0 ? "#e0685c" : "rgba(29,41,66,0.22)" }} type="text" inputMode="decimal" value={r.amount || ""} onChange={(e) => rSetAmount(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} />

                      </div>
                      <div style={{ fontSize: 13.5, color: "#4a5567", marginBottom: 8 }}>{L.whoPutMoney} <span style={{ color: "#8b93a3" }}>{L.multiplePossible}</span></div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <span onClick={() => rTogglePot(idx)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", borderRadius: 999, padding: "7px 13px", fontSize: 13.5, fontWeight: 600,
                            background: (r.potPart || 0) > 0 ? "#2f6fb5" : "#fff",
                            border: (r.potPart || 0) > 0 ? "1.5px solid #2f6fb5" : "1.5px solid rgba(29,41,66,0.4)",
                            color: (r.potPart || 0) > 0 ? "#fff" : "#1d2942" }}>
                          {potIsCard ? <>💳 {L.cardWord}</> : <><ZakjeIcoon size={14} /> {L.potWord}</>}{(r.potPart || 0) > 0 ? " ✓" : ""}
                        </span>
                        {people.map((p) => {
                          const aan = (r.payers?.[p.id] || 0) > 0
                          return (
                            <span key={p.id} onClick={() => rTogglePayer(idx, p.id)}
                              style={{ cursor: "pointer", borderRadius: 999, padding: "7px 13px", fontSize: 13.5, fontWeight: 600,
                                background: aan ? RAND : "#fff",
                                border: aan ? `1.5px solid ${RAND}` : "1.5px solid rgba(29,41,66,0.4)",
                                color: aan ? RANDTEKST : "#1d2942" }}>{p.name}{aan ? " ✓" : ""}</span>
                          )
                        })}
                      </div>
                      {(() => {
                        const sel = Object.keys(r.payers || {}).filter((pid) => people.some((p) => p.id === pid))
                        const nPay = sel.length + ((r.potPart || 0) > 0 ? 1 : 0)
                        if (nPay === 0) return <div style={{ fontSize: 15, color: "#c0554a", fontWeight: 700, marginTop: 6 }}>Kies wie betaalde.</div>
                        const sum = rPaidSum(r), diff = (r.amount || 0) - sum
                        return (
                          <div style={{ marginTop: 10, background: "#eef4fb", border: "1px solid rgba(47,111,181,0.25)", borderRadius: 11, padding: 11 }}>
                            {nPay > 1 && <div style={{ fontSize: 12.5, fontWeight: 800, color: "#2f5693", marginBottom: 9 }}>{L.splitEvenNote}</div>}
                            {(r.potPart || 0) > 0 && (
                              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>{potIsCard ? "💳" : <ZakjeIcoon size={16} />} {potIsCard ? L.cardWord : L.potWord}</span>
                                <div style={S.row}><span style={{ color: "#6b7484" }}>€</span><input style={{ ...S.input, width: 90, fontSize: 18 }} type="text" inputMode="decimal" value={r.potPart || ""} onChange={(e) => rSetPotAmt(idx, parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                              </div>
                            )}
                            {sel.map((pid) => (
                              <div key={pid} style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 16, fontWeight: 700 }}>👤 {people.find((p) => p.id === pid)?.name}</span>
                                <div style={S.row}><span style={{ color: "#6b7484" }}>€</span><input style={{ ...S.input, width: 90, fontSize: 18 }} type="text" inputMode="decimal" value={r.payers[pid] || ""} onChange={(e) => rSetPayerAmt(idx, pid, parseFloat(e.target.value.replace(",", ".")) || 0)} /></div>
                              </div>
                            ))}
                            <div style={{ borderTop: "1px dashed rgba(29,41,66,0.25)", paddingTop: 7, fontSize: 15, fontWeight: 800, color: Math.abs(diff) <= 0.005 ? "#1f8a4c" : "#c0554a" }}>Samen {euro(sum)} van {euro(r.amount || 0)}{Math.abs(diff) <= 0.005 ? " ✓ klopt" : diff > 0 ? ` — er ontbreekt ${euro(diff)}` : ` — ${euro(-diff)} te veel`}</div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {editCups && depositOn && (
                    <div style={{ marginTop: 10, background: "#eef1f6", borderRadius: 12, padding: 10 }}>
                      {people.map((p) => {
                        const nam = roundPicked(r, p.id), gb = r.gaveBack[p.id] || 0
                        return (
                          <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "5px 0" }}>
                            <span style={{ fontSize: 17.5, fontWeight: 700 }}>{p.name} <span style={{ fontSize: 14.5, color: "#6b7484" }}>· nam {nam}</span></span>
                            <div style={{ ...S.row, gap: 6 }}>
                              <span style={{ fontSize: 14.5, color: "#6b7484" }}>{L.gaveBack}</span>
                              <button style={{ ...S.step, width: 26, height: 26, fontSize: 19, opacity: gb === 0 ? 0.4 : 1 }} onClick={() => rSetGaveBack(idx, p.id, gb - 1)}>−</button>
                              <span style={{ minWidth: 14, textAlign: "center", fontSize: 17.5, fontWeight: 800 }}>{gb}</span>
                              <button style={{ ...S.step, width: 26, height: 26, fontSize: 19 }} onClick={() => rSetGaveBack(idx, p.id, gb + 1)}>+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        </>)}
        {!fromQuick && paidCount > 0 && laatsteRondjeKlaar() && !((settle || opNaam) && unassignedAllRounds > 0) && <>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.btn, flex: 1 }} onClick={goFinal}>{L.settleBtn}</button>
            <button style={{ ...S.btnP, flex: 2 }} onClick={() => { if (unfinishedRound) resumeRound(); else nextRound() }}>{unfinishedRound ? L.continueRound(roundNr) : "➕ Nieuw rondje"}</button>
          </div>
          {!unfinishedRound && paidCount > 0 && activeProposal && (
            <div style={{ marginTop: 10 }}>{renderProposalHost()}</div>
          )}
        </>}

      </div></div>
    )
  }

  // ── SNEL AFREKENEN (niveau 2: elk rondje ÷ wie er toen was) ──────────────────
  if (view === "quickSettle") {
    const betaalde = rounds.filter((r) => (r.amount || 0) > 0.005)
    // Rondjes die overgeslagen zijn tellen niet mee in het totaal. Dat is een geldige
    // keuze, maar je moet het wel wéten voor je de verdeling leest.
    const zonderBedrag = rounds.filter((r) => (r.amount || 0) <= 0.005)
    const zbNrs = zonderBedrag.map((r) => rounds.indexOf(r) + 1)
    const zbLabel = zbNrs.length === 0 ? "" : zbNrs.length <= 3
      ? L.roundsNoAmountNamed(zbNrs.length === 1 ? String(zbNrs[0]) : `${zbNrs.slice(0, -1).join(", ")} ${L.andWord} ${zbNrs[zbNrs.length - 1]}`)
      : L.roundsNoAmountCount(zbNrs.length)
    // Wisselde het aantal personen tussen de rondjes? Dan hoort dat bij het totaal,
    // niet in een apart kader verderop. We kijken naar álle rondjes, ook die zonder
    // bedrag: ook daar heb je het aantal kunnen bijstellen, en het verschil telt.
    const aantallen = rounds.map((r) => Math.max(1, r.headcount || 1))
    const wisselde = new Set(aantallen).size > 1
    const getrakteerd = betaalde.filter((r) => treatedRounds.has(r.id))
    const teVerdelen = betaalde.filter((r) => !treatedRounds.has(r.id))
    const traktatieTot = getrakteerd.reduce((s, r) => s + (r.amount || 0), 0)
    // Staat alles op €0, dan is er geen verdeling — in geen van beide modi. Dan tonen we
    // geen rekensom van nul, maar zeggen we waar het aan ligt.
    const nietsTeVerdelen = teVerdelen.reduce((s, r) => s + (r.amount || 0), 0) <= 0.005
    // Wie wanneer meedeed, afgeleid uit het aantal per rondje: gaat het omhoog dan schoof
    // er iemand aan, gaat het omlaag dan ging er iemand weg (de laatst aangekomene eerst).
    // Zo betaalt een laatkomer niet mee voor rondjes van vóór z'n aankomst.
    const groepen: { count: number; from: number; until: number | null }[] = []
    let vorigAantal = 0
    rounds.forEach((r, i) => {
      const h = Math.max(1, r.headcount || 1)
      if (h > vorigAantal) groepen.push({ count: h - vorigAantal, from: i, until: null })
      else if (h < vorigAantal) {
        let weg = vorigAantal - h
        for (let j = groepen.length - 1; j >= 0 && weg > 0; j--) {
          if (groepen[j].until !== null) continue
          const neem = Math.min(weg, groepen[j].count)
          if (neem === groepen[j].count) groepen[j].until = i - 1
          else { groepen[j].count -= neem; groepen.push({ count: neem, from: groepen[j].from, until: i - 1 }) }
          weg -= neem
        }
      }
      vorigAantal = h
    })
    // Wat één persoon uit zo'n groep betaalt: z'n deel van elk rondje waar hij bij was.
    const deelVan = (g: { from: number; until: number | null }) => rounds.reduce((s, r, i) => {
      if (i < g.from || (g.until !== null && i > g.until)) return s
      if (!teVerdelen.includes(r)) return s
      return s + (r.amount || 0) / Math.max(1, r.headcount || 1)
    }, 0)
    const groepenMetDeel = groepen.filter((g) => g.count > 0).map((g) => ({ ...g, deel: deelVan(g) }))
    const gelijkVoorIedereen = groepenMetDeel.length <= 1
    const perPersoon = groepenMetDeel[0]?.deel ?? 0
    const alles = settleMode === "allesZelf"
    return (
      <div style={S.page} onClick={() => { setShowPerRound(false); setShowTreat(false) }}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <AdminTabs />
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ ...S.h3, margin: 0 }}>{L.quickSettleTitle}</h3>
        </div>

        <div style={{ ...S.card, textAlign: "center", background: "rgba(240,165,0,0.06)", border: "1.5px solid rgba(240,165,0,0.4)" }}>
          {/* Het kopje telt alleen de rondjes die meegerekend zijn; het aantal erachter
              telt álle rondjes. Zie je een verschil, dan zegt de melding eronder welk
              rondje er nog geen bedrag heeft. */}
          <div style={{ fontSize: 16, fontWeight: 700, color: "#6b7484", marginBottom: 4 }}>
            {betaalde.length === 0 ? L.noAmountsYet : L.quickTotalLabel(betaalde.length)}
            {betaalde.length > 0 && rounds.length > betaalde.length && <span style={{ fontWeight: 600, color: "#8b93a3" }}> {L.quickTotalOf(rounds.length)}</span>}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#c98a00" }}>{euro(totalCost)}</div>
          {wisselde && (
            <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px dashed rgba(29,41,66,0.25)", textAlign: "left" }}>
              <div style={{ fontSize: 14.5, color: "#8a5e0f", fontWeight: 800, marginBottom: 4 }}>⚠️ {L.headcountVaried}</div>
              <div style={{ fontSize: 14, color: "#8a5e0f", lineHeight: 1.6 }}>
                {rounds.map((r, i) => `${L.roundWord} ${i + 1}: ${Math.max(1, r.headcount || 1)} ${L.people}`).join("  ·  ")}
              </div>
            </div>
          )}
        </div>

        {/* Los van het totaalkader: het bedrag klopt, er ontbreekt alleen iets. */}
        {zonderBedrag.length > 0 && (
          <div style={{ ...S.card, background: "rgba(224,104,92,0.08)", border: "1px solid rgba(224,104,92,0.45)", padding: "12px 13px" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>{zbLabel}</div>
            {/* Bij gelijk verdelen is een leeg rondje een keuze; bij Fair Split een blokkade.
                Dezelfde melding, maar de tweede zin zegt wat er in jouw geval geldt. */}
            <div style={{ fontSize: 15, color: "#8a6b5f", lineHeight: 1.5, marginBottom: 10 }}>{settleChoice === "fair" ? L.roundsNoAmountFair : L.roundsNoAmountWhy(zonderBedrag.length)}</div>
            <button
              onClick={() => {
                // Niets openklappen: in het overzicht markeren we de lege rondjes en
                // zetten we er een knop bij, zodat je zelf kiest waar je begint.
                setFillMode(true)
                setOverviewBackTo("hub")
                setView("roundsOverview")
              }}
              style={{ width: "100%", padding: "11px 6px", borderRadius: 10, fontSize: 15.5, fontWeight: 800, cursor: "pointer", background: "#fff", border: "1px solid rgba(224,104,92,0.4)", color: "#b0402f" }}>
              {L.fillAmountsBtn}
            </button>
          </div>
        )}

        {/* Bij het openen staat er nog niets onder: eerst kiezen hoe je verdeelt.
            Wat niet gekozen is, dimt — zoals op het keuzescherm van de app zelf. */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginTop: 16, marginBottom: 14 }}>
          <button onClick={() => { setSettleMode("verdelen"); setSettleChoice((c) => c === "equal" ? null : "equal") }}
            style={{ flex: 1, position: "relative", background: "#fff", borderRadius: 14, padding: "19px 10px 15px", textAlign: "center", cursor: "pointer",
              border: settleChoice === "fair" ? "1.5px solid rgba(29,41,66,0.2)" : "2px solid rgba(240,165,0,0.55)",
              boxShadow: settleChoice === "fair" ? "none" : "0 4px 14px -8px rgba(240,165,0,0.5)",
              opacity: settleChoice === "fair" ? 0.5 : 1 }}>
            <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: "#e08a00", color: "#fff", fontSize: 13, fontWeight: 800, borderRadius: 10, padding: "3px 10px", whiteSpace: "nowrap" }}>{L.fastest}</span>
            <div style={{ fontSize: 23, marginBottom: 5 }}>👥</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1d2942", lineHeight: 1.3 }}>{L.splitEqually}</div>
            <div style={{ fontSize: 13.5, color: "#8b93a3", marginTop: 3, lineHeight: 1.3 }}>{L.splitEqualSub}</div>
          </button>
          <div style={{ display: "flex", alignItems: "center", fontSize: 15.5, fontWeight: 800, color: "#8b93a3" }}>{L.orWord}</div>
          <button onClick={() => setSettleChoice((c) => c === "fair" ? null : "fair")}
            style={{ flex: 1, position: "relative", background: "#fff", borderRadius: 14, padding: "19px 10px 15px", textAlign: "center", cursor: "pointer",
              border: settleChoice === "equal" ? "1.5px solid rgba(29,41,66,0.2)" : "2px solid rgba(31,138,76,0.5)",
              boxShadow: settleChoice === "equal" ? "none" : "0 4px 14px -8px rgba(31,138,76,0.5)",
              opacity: settleChoice === "equal" ? 0.5 : 1 }}>
            <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: "#1f8a4c", color: "#fff", fontSize: 13, fontWeight: 800, borderRadius: 10, padding: "3px 10px", whiteSpace: "nowrap" }}>{L.fairest}</span>
            <div style={{ fontSize: 23, marginBottom: 5 }}>⚖️</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "#1d2942", lineHeight: 1.3 }}>{L.splitWithFair}</div>
            <div style={{ fontSize: 13.5, color: "#8b93a3", marginTop: 3, lineHeight: 1.3 }}>{L.splitFairSub}</div>
          </button>
        </div>

        {/* Ontbrekende stukjes voor een eerlijke verdeling: bedrag, toewijzing of
            betaler. De kaarten hierboven blijven onaangeroerd. */}
        {(() => {
          const teVullen = rounds.filter((r) => (r.amount || 0) <= 0.005).length
          if (settle || teVullen === 0) return null
          return (
            <div style={{ ...S.card, background: "rgba(240,165,0,0.08)", border: "1.5px solid rgba(240,165,0,0.5)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#8a5e0f", lineHeight: 1.4 }}>{L.missRoundsNote(teVullen)}</div>
              <button style={{ ...S.btnP, width: "100%", marginTop: 11 }}
                onClick={() => { setOverviewBackTo("hub"); setView("roundsOverview") }}>{L.fillNowBtn}</button>
            </div>
          )
        })()}

        {/* De uitleg verschijnt waar je tikte, met de overstap eronder. */}
        {settleChoice === "fair" && !nietsTeVerdelen && zonderBedrag.length === 0 && (
          <div style={{ ...S.card, background: "rgba(31,138,76,0.06)", border: "1.5px solid rgba(31,138,76,0.3)" }}>
            <div style={{ fontSize: 16, color: "#4a6b57", lineHeight: 1.55, marginBottom: 14, textAlign: "center" }}>{L.fairSplitExplain}</div>
            <button style={{ ...S.btnP, width: "100%", background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" }} onClick={goToFairSplit}>{L.switchToFairBtn}</button>
            <button style={{ width: "100%", marginTop: 8, padding: "9px 0", background: "none", border: "none", fontSize: 15.5, fontWeight: 700, color: "#8b93a3", cursor: "pointer" }} onClick={() => setSettleChoice(null)}>{L.later}</button>
          </div>
        )}

        {/* Op €0 valt er niets te kiezen: geen bedragen, geen verdeling. Eén melding
            met de knop om ze aan te vullen — voor beide knoppen dezelfde. */}
        {settleChoice !== null && nietsTeVerdelen && (
          <div style={{ ...S.card, background: "rgba(240,165,0,0.08)", border: "1.5px solid rgba(240,165,0,0.5)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#8a5e0f", marginBottom: 4 }}>€0 — {L.nothingToSplit}</div>
            <div style={{ fontSize: 15, color: "#6b7484", lineHeight: 1.5, marginBottom: 11 }}>{L.nothingToSplitWhy}</div>
            <button style={{ ...S.btnP, width: "100%" }}
              onClick={() => { setFillMode(true); setOverviewBackTo("hub"); setView("roundsOverview") }}>
              {L.fillAmountsBtn}
            </button>
          </div>
        )}

        {!alles ? (
          <>

            {/* Eén bedrag, verdeeld over een aantal dat jij bepaalt. Wisselde het aantal
                per rondje, dan melden we dat maar houden we het bedrag simpel. */}
            {(() => {
              const deelAantal = Math.max(1, splitPeople ?? (aantallen.length ? Math.max(...aantallen) : 1))
              const teVerdelenTot = teVerdelen.reduce((s, r) => s + (r.amount || 0), 0)
              return (
                <>
                  {/* Koos je Fair Split? Dan is de gelijke verdeling niet meer aan de orde. */}
                  {settleChoice === "equal" && !nietsTeVerdelen && (<>
                  {/* Gecentreerd tussen de twee knoppen: het getal is hier de hoofdzaak. */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, background: "#eef1f6", borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
                    <button style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: "#fff", border: "1px solid rgba(29,41,66,0.25)", fontSize: 19, color: "#6b7484", fontWeight: 800, cursor: "pointer", opacity: deelAantal > 1 ? 1 : 0.4 }}
                      onClick={() => setSplitPeople(Math.max(1, deelAantal - 1))}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#8a5e0f", textAlign: "center" }}>{L.splitOver} 👤 {deelAantal} {L.people}</span>
                    <button style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: AAN, border: "none", fontSize: 19, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                      onClick={() => setSplitPeople(deelAantal + 1)}>+</button>
                  </div>
                  <div style={{ ...S.card, background: "rgba(31,138,76,0.06)", border: "1.5px solid rgba(31,138,76,0.3)", textAlign: "center" }}>
                    <div style={{ fontSize: 16, color: "#4a6b57", marginBottom: 3 }}>{L.eachPaysNote}</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: "#1f8a4c" }}>{euro(teVerdelenTot / deelAantal)}</div>
                    {traktatieTot > 0.005 && (
                      <div style={{ fontSize: 15.5, color: "#8a5e0f", fontWeight: 700, marginTop: 7 }}>🎁 {L.plusTreat(euro(traktatieTot))}</div>
                    )}
                    {/* De kanttekening hoort bij het bedrag, niet in een eigen kader. */}
                    <div style={{ fontSize: 14.5, color: "#4a6b57", lineHeight: 1.55, marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(31,138,76,0.2)", textAlign: "center" }}>{L.notFairSplitWhy}</div>
                  </div>
                  {/* Twee rustige keuzes onder het bedrag: detail per rondje, of iemand
                      die een rondje trakteert. */}
            {betaalde.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={(e) => { e.stopPropagation(); setShowPerRound((v) => !v); setShowTreat(false) }}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 11, fontSize: 14.5, fontWeight: 800, cursor: "pointer", lineHeight: 1.3,
                        background: showPerRound ? "rgba(240,165,0,0.14)" : "#fff", border: showPerRound ? "1px solid rgba(240,165,0,0.6)" : "1px solid rgba(29,41,66,0.22)", color: "#8a5e0f" }}>
                      {showPerRound ? L.backToOneAmount : L.showPerRound}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowTreat((v) => !v); setShowPerRound(false) }}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: 11, fontSize: 14.5, fontWeight: 800, cursor: "pointer", lineHeight: 1.3,
                        background: showTreat ? "rgba(240,165,0,0.14)" : "#fff", border: showTreat ? "1px solid rgba(240,165,0,0.6)" : "1px solid rgba(29,41,66,0.22)", color: "#8a5e0f" }}>
                      🎁 {L.treatShort}
                    </button>
                  </div>
            )}
                  {showPerRound && (
                    <div onClick={(e) => e.stopPropagation()} style={{ ...S.card, marginTop: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 9 }}>{L.perRoundTitle}</div>
                      {betaalde.map((r) => {
                        const nr = rounds.indexOf(r) + 1
                        const h = Math.max(1, r.headcount || 1)
                        const getr = treatedRounds.has(r.id)
                        return (
                          <div key={r.id} style={{ ...S.row, justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(29,41,66,0.08)", fontSize: 16 }}>
                            <span>{L.roundWord} {nr} · 👤 {h}</span>
                            <span style={{ fontWeight: 800 }}>{getr ? `🎁 ${L.yourTreat}` : `${euro(r.amount || 0)} → ${euro((r.amount || 0) / h)} p.p.`}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  </>)}
                </>
              )
            })()}

            {settleChoice === "equal" && betaalde.length > 0 && showTreat && (
              <div onClick={(e) => e.stopPropagation()} style={{ ...S.card }}>
                <div style={{ fontSize: 17, color: "#6b7484", fontWeight: 800, marginBottom: 9, lineHeight: 1.45 }}>{L.treatHint}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {betaalde.map((r) => {
                    const nr = rounds.indexOf(r) + 1
                    const on = treatedRounds.has(r.id)
                    return (
                      <div key={r.id} onClick={() => setTreatedRounds((prev) => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })}
                        style={{ ...S.row, justifyContent: "space-between", padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                          background: on ? "rgba(31,138,76,0.08)" : VLAK1, border: on ? "1px solid rgba(31,138,76,0.4)" : "1px solid transparent" }}>
                        <span style={{ fontSize: 17, fontWeight: on ? 800 : 700, color: on ? "#1f6b3a" : "#1d2942" }}>
                          {L.roundWord} {nr} · 👤{r.headcount || 1}{on && <span style={{ fontWeight: 700, color: "#6b7484" }}> · 🎁 {L.yourTreat}</span>}
                        </span>
                        <div style={{ ...S.row, gap: 9 }}>
                          <span style={{ fontSize: 17, fontWeight: 800, color: on ? "#1f8a4c" : "#6b7484" }}>{euro(r.amount || 0)}</span>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15.5, fontWeight: 800,
                            background: on ? "#1f8a4c" : "#fff", color: "#fff", border: on ? "none" : "1.5px solid rgba(29,41,66,0.3)" }}>{on ? "✓" : ""}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ ...S.card, background: "rgba(240,165,0,0.06)", border: "1.5px solid rgba(240,165,0,0.4)", textAlign: "center" }}>
            <div style={{ fontSize: 17, color: "#8a5e0f", fontWeight: 700, marginBottom: 6, lineHeight: 1.5 }}>{L.payAllNote}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#c98a00" }}>{euro(totalCost)}</div>
          </div>
        )}

      </div></div>
    )
  }

  // ── FAIR SPLIT SETUP (snel personen + namen) ─────────────────────────────────
  if (view === "fairSetup") {
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {renderDialogs()}
        <div style={{ marginBottom: 6 }}>
          {fromQuick && stapBalk(1)}
          <h3 style={{ ...S.h3, margin: 0 }}>{L.fairSetupTitle}</h3>
        </div>
        <div style={{ ...S.card }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {people.map((p, i) => {
              const leeg = isGuestDefault(p.name)
              return (
                <div key={p.id} style={{ ...S.row, gap: 8 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#9aa3b2", width: 20, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
                    <input value={leeg ? "" : p.name} onChange={(e) => renamePerson(p.id, e.target.value)} placeholder={`${p.name} · ${L.guestNamePh}`}
                      style={{ ...S.input, flex: 1, minWidth: 0, boxSizing: "border-box", textAlign: "left", fontSize: 18, fontWeight: 700, padding: leeg ? "11px 32px 11px 12px" : "11px 12px", borderRadius: 10, background: VLAK2, color: leeg ? "#9aa3b2" : "#1d2942" }} />
                    {leeg && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "inline-flex" }}><PotloodIcoon /></span>}
                  </span>
                  {people.length > 1 && (
                    <button onClick={() => removePerson(p.id)} style={{ ...S.btn, padding: "8px 11px", fontSize: 18, color: "#c0554a", borderColor: "rgba(224,104,92,0.4)", flexShrink: 0 }}>✕</button>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={addPerson} style={{ ...S.btn, width: "100%", marginTop: 12, fontWeight: 800, border: "1.5px dashed rgba(240,165,0,0.6)", background: "rgba(240,165,0,0.06)", color: "#c98a00" }}>{L.fairAddPerson}</button>
        </div>
        <button style={{ ...S.btnP, width: "100%", marginTop: 6, background: "linear-gradient(135deg,#2fae6a,#1f8a4c)" }} onClick={confirmFairSetup}>{L.fairSetupDone}</button>
        {/* Terug uit het traject betekent terug NAAR snelle rondjes — de modus gaat mee.
            Liet je settle op true staan, dan land je op het afrekenscherm van snelle
            rondjes terwijl de app in Fair Split staat, en dan brengt de gewone navigatie
            je in de echte Fair Split-schermen zonder weg terug.
            Zat de groep al in Fair Split (niet via het traject), dan hoor je op de hub. */}
        <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 17, fontWeight: 700, color: "#6b7484" }}
          onClick={() => { if (fromQuick || !settle) backToEqualSplit("fair"); else { setOpenRound(rounds.length - 1); setView("hub") } }}>{L.back}</button>
      </div></div>
    )
  }

  // ── RONDJESOVERZICHT (alle rondjes + bedragen, totaal of per rondje) ─────────
  if (view === "roundsOverview") {
    // Hoeveel rondjes tellen echt mee in het totaal: die met een bedrag erop.
    const metBedrag = rounds.filter((r) => (r.amount || 0) > 0.005).length
    // Oudste rondje bovenaan, zoals je ze besteld hebt. Open als het in openRounds zit.
    const laatsteId = rounds.length ? rounds[rounds.length - 1].id : ""
    // Standaard staat alles dicht — je opent zelf wat je wil bekijken.
    const isOpen = (r: Round) => openRounds.has(r.id)
    const toggle = (id: string) => setOpenRounds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
    return (
      <div style={S.page}><div style={S.wrap}>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}
        <div style={{ ...S.row, justifyContent: "flex-end", marginBottom: 6, gap: 8 }}>
          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
            {settle && <button style={{ ...S.btn, fontSize: 15.5, fontWeight: 700, padding: "7px 12px" }} onClick={() => { if (overviewBackTo === "order") { setActiveCat(catsPresent[0]); setView("order") } else setView(overviewBackTo) }}>← {L.back}</button>}
          </div>
        </div>

        {/* Totaal — de som van alle rondjes. Eén blik op wat de avond kostte. */}
        {/* Geen kader: het totaal hoort bij de lijst eronder, niet als losse knop. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "0 4px 12px", marginBottom: 4, borderBottom: "1px solid rgba(29,41,66,0.18)" }}>
          <span style={{ fontSize: 21.5, fontWeight: 800, color: "#1d2942" }}>
            {metBedrag === 0 ? L.roundsOnly(rounds.length) : L.quickTotalLabel(metBedrag)}
            {metBedrag > 0 && rounds.length > metBedrag && <span style={{ fontWeight: 700, color: "#8b93a3" }}> {L.quickTotalOf(rounds.length)}</span>}
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: metBedrag === 0 ? "#b9c0cc" : "#c98a00" }}>{euro(totalCost)}</span>
        </div>

        {!settle && rounds.length > 0 && rounds.some((r) => (r.amount || 0) <= 0.005 || Object.values(r.anon || {}).reduce((a, b) => a + (b || 0), 0) > 0) && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#fff", border: "1.5px solid rgba(29,41,66,0.2)", borderRadius: 12, padding: 12, marginTop: 12 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "#1d2942", lineHeight: 1.35 }}><b>⚖️ {L.fairAskShort}</b> {L.fairNudge}</span>
            <button onClick={() => setOpenRounds(new Set(rounds.map((r) => r.id)))}
              style={{ flexShrink: 0, background: "#fdf3d8", border: "1.5px solid rgba(224,138,0,0.6)", color: "#8a5e0f", borderRadius: 999, padding: "8px 13px", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit" }}>{L.fairNudgeBtn}</button>
          </div>
        )}
        {/* Elk rondje, nieuwste bovenaan. Klik de kop om open/dicht te klappen.
            De toon/verberg-pil hangt half over de rand, boven én onder. */}
        <div style={{ position: "relative" }}>
          {rounds.length > 0 && (() => {
            const allesOpen = openRounds.size >= rounds.length
            const pil = {
              display: "inline-block", padding: "7px 16px", borderRadius: 20, fontSize: 14, fontWeight: 800,
              cursor: "pointer", background: "#fff", border: "1px solid rgba(29,41,66,0.3)", color: "#6b7484",
              boxShadow: "0 2px 6px rgba(29,41,66,0.14)", whiteSpace: "nowrap" as const,
            }
            const klik = () => setOpenRounds(allesOpen ? new Set<string>() : new Set(rounds.map((r) => r.id)))
            return (
              <>
                <div style={{ position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", zIndex: 2 }}>
                  <span onClick={klik} style={pil}>{allesOpen ? `▴ ${L.hideDetails}` : `▾ ${L.showDetails}`}</span>
                </div>
                {/* Onderaan pas nodig zodra alles openstaat: dan is de lijst lang en wil je
                    niet terug naar boven scrollen om ze weer dicht te klappen. */}
                {allesOpen && (
                  <div style={{ position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)", zIndex: 2 }}>
                    <span onClick={klik} style={pil}>▴ {L.hideDetails}</span>
                  </div>
                )}
              </>
            )
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: rounds.length > 0 ? 14 : 0, paddingBottom: (rounds.length > 0 && openRounds.size >= rounds.length) ? 14 : 0 }}>
          {rounds.map((r) => {
            const nr = rounds.indexOf(r) + 1
            const items = drinksOf(r).reduce((a, x) => a + x.n, 0)
            const open = isOpen(r)
            const geenBedrag = (r.amount || 0) <= 0.005
            const invulRij = fillMode && geenBedrag && editRoundId !== r.id
            const nogOpen = geenBedrag || Object.values(r.anon || {}).reduce((a, b) => a + (b || 0), 0) > 0
            return (
              <div key={r.id} style={{ ...S.card, padding: 0, overflow: "hidden", ...(!settle && nogOpen && editRoundId !== r.id && !invulRij ? { border: "1.5px solid rgba(200,138,0,0.7)" } : {}), ...(editRoundId === r.id ? { boxShadow: "inset 0 0 0 2px rgba(240,165,0,0.55)", background: "#fffdf3" } : invulRij ? { border: "2px solid rgba(224,104,92,0.65)", background: "rgba(224,104,92,0.05)" } : {}) }}>
                <div onClick={() => toggle(r.id)} style={{ padding: "12px 14px", cursor: "pointer", background: editRoundId === r.id ? "rgba(240,165,0,0.1)" : open ? "rgba(240,165,0,0.06)" : invulRij ? "rgba(224,104,92,0.07)" : "#fff" }}>
                  <div style={{ ...S.row, justifyContent: "space-between", gap: 8 }}>
                    <div style={{ ...S.row, gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942" }}>{editRoundId === r.id ? L.editRoundHead(nr) : L.roundSummary(nr, items)}</span>
                      {settle && geenBedrag && editRoundId !== r.id && (
                        <span style={{ flexShrink: 0, fontSize: 13.5, fontWeight: 800, borderRadius: 12, padding: "3px 9px", whiteSpace: "nowrap", color: invulRij ? "#b0402f" : "#8a5e0f", background: invulRij ? "rgba(224,104,92,0.14)" : "rgba(240,165,0,0.16)" }}>{L.noAmountBadge}</span>
                      )}
                    </div>
                    <div style={{ ...S.row, gap: 9, flexShrink: 0 }}>
                      {editRoundId === r.id ? (
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#c0554a", background: "rgba(224,104,92,0.12)", borderRadius: 12, padding: "4px 10px", whiteSpace: "nowrap" }}>{L.notSavedYet}</span>
                      ) : (
                        <>
                          <span style={{ fontSize: 17.5, fontWeight: 800, color: (r.amount || 0) > 0 ? "#c98a00" : "#a7b0bf" }}>{(r.amount || 0) > 0 ? euro(r.amount) : "€ —"}</span>
                          <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: RAND, color: RANDTEKST, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Betaald-melding net onder de titel — leesbaar, geen invulveld meer. */}
                  {!geenBedrag && <div style={{ fontSize: 15.5, color: "#6b7484", fontWeight: 600, marginTop: 4 }}>
                    {(r.amount || 0) > 0.005 ? L.paidNote(euro(r.amount)) : L.noAmountNote}
                    {(r.potPart || 0) > 0.005
                      ? <span style={{ color: "#2f5693", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}> · <ZakjeIcoon size={14} /> {L.paidFromPot(euro(r.potPart || 0))}</span>
                      : <span style={{ color: "#9aa3b2" }}> · {L.noPotUsed}</span>}
                  </div>}
                </div>
                {open && (() => {
                  const idx = rounds.indexOf(r)
                  const bewerk = editRoundId === r.id && editDraft !== null
                  const dr = editDraft
                  const uitPot = bewerk && dr ? dr.bron !== "self" : (r.potPart || 0) > 0.005
                  const potLeeg = Math.max(0, potAvailFor(idx)) <= 0.005
                  return (
                  <div style={{ padding: "4px 14px 14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {drinksOf(r).map(({ d, n }) => {
                        const val = bewerk && dr ? (dr.drinks[d.id] ?? n) : n
                        return (
                        <div key={d.id} style={{ ...S.row, justifyContent: "space-between", padding: "3px 0" }}>
                          <span style={{ fontSize: 17.5, fontWeight: 700, minWidth: 0 }}>{d.emoji} {d.name}{opNaam === true && !bewerk && (() => {
                            // De kern van uitgebreid opnemen: wíe dronk het. Amber, met het
                            // kroontje bij je eigen naam; onbenoemde aantallen in het rood.
                            const wie = people.filter((p) => (r.orders[d.id]?.[p.id] ?? 0) > 0)
                            const anon2 = r.anon?.[d.id] ?? 0
                            return (wie.length > 0 || anon2 > 0) ? <span style={{ fontSize: 15, fontWeight: 700, color: "#8a5e0f" }}> → {wie.map((p, i2) => { const q = r.orders[d.id][p.id]; return <span key={p.id}>{i2 > 0 ? ", " : ""}{p.id === meId && <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 3 }}><KroonIcoon size={12} kleur="#8a5e0f" gevuld /></span>}{p.name}{q > 1 ? ` (${q})` : ""}</span> })}{anon2 > 0 && <span style={{ color: "#b0402f" }}>{wie.length > 0 ? " · " : ""}{anon2}× ?</span>}</span> : null
                          })()}</span>
                          {bewerk ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                              <button style={{ width: 30, height: 30, borderRadius: 8, background: "#eef1f6", border: "1px solid rgba(29,41,66,0.2)", fontSize: 18, color: "#6b7484", fontWeight: 800, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, drinks: { ...c.drinks, [d.id]: Math.max(0, (c.drinks[d.id] ?? n) - 1) } } : c) }}>−</button>
                              <span style={{ fontSize: 19, fontWeight: 800, color: "#c98a00", minWidth: 28, textAlign: "center" }}>{val}×</span>
                              <button style={{ width: 30, height: 30, borderRadius: 8, background: AAN, border: "none", fontSize: 18, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                                onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, drinks: { ...c.drinks, [d.id]: (c.drinks[d.id] ?? n) + 1 } } : c) }}>+</button>
                            </span>
                          ) : (
                            <span style={{ fontSize: 19, fontWeight: 800, color: "#c98a00" }}>{n}×</span>
                          )}
                        </div>
                        )
                      })}
                      {!bewerk && (
                        <div style={{ textAlign: "right", marginTop: 9 }}>
                          <span onClick={(e) => { e.stopPropagation(); startEditRound(r) }}
                            style={{ fontSize: 14.5, fontWeight: 500, color: "#c98a00", textDecoration: "underline", cursor: "pointer" }}>✏️ {L.adjustOrder}</span>
                        </div>
                      )}
                    </div>

                    {/* Wat er nog moet gebeuren staat ná de drankjes: eerst zie je wat er
                        besteld is, dan pas wat er nog ontbreekt. Dichtgeklapt toont de kaart
                        hier niets van — dan is het een rustige regel met nummer en bedrag. */}
                  {!settle && editRoundId !== r.id && isOpen(r) && (() => {
                    const nogToe = Object.values(r.anon || {}).reduce((a, b) => a + (b || 0), 0)
                    if (!geenBedrag && nogToe === 0) return null
                    const regel = (tekst: string, knopTekst: string, doe: () => void) => (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(240,165,0,0.3)" }}>
                        <span style={{ minWidth: 0, fontSize: 15, fontWeight: 800, color: "#1d2942" }}>{tekst}</span>
                        <span onClick={(e) => { e.stopPropagation(); doe() }}
                          style={{ flexShrink: 0, border: "1.5px solid rgba(240,165,0,0.6)", color: "#8a5e0f", background: "#fff", borderRadius: 10, padding: "7px 12px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>{knopTekst}</span>
                      </div>
                    )
                    return (
                      <div style={{ background: "#fffaeb", border: "2px solid rgba(240,165,0,0.65)", borderRadius: 12, padding: "11px 12px", marginTop: 11 }}>
                        <span style={{ display: "inline-block", fontSize: 13, fontWeight: 800, letterSpacing: "0.05em", background: "rgba(240,165,0,0.25)", color: "#8a5e0f", borderRadius: 20, padding: "7px 14px" }}>{L.nogNodigBadge} — {L.stillToFill}</span>
                        {nogToe > 0 && regel(L.notAssignedYet(nogToe), L.openWord, () => { setAssignAllMode(false); setAssignIdx(rounds.findIndex((x) => x.id === r.id)) })}
                        {geenBedrag && regel(L.noAmountShort, L.fillWord, () => { startEditRound(r); setBedragFocus(true) })}
                      </div>
                    )
                  })()}
                    {/* Bij uitgebreid opnemen liggen de gasten vast; het aantal staat dan
                        automatisch juist en hoeft hier niet getoond of bewerkt. */}
                    {opNaam !== true && <div style={{ ...S.row, justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(29,41,66,0.12)" }}>
                      <span style={{ fontSize: 17, fontWeight: 800, color: "#6b7484" }}>👤 {L.peopleInRound}</span>
                      {bewerk && dr ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <button style={{ width: 32, height: 32, borderRadius: 9, background: "#eef1f6", border: "1px solid rgba(29,41,66,0.2)", fontSize: 19, color: "#6b7484", fontWeight: 800, cursor: "pointer", opacity: dr.headcount > 1 ? 1 : 0.4 }}
                            onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, headcount: Math.max(1, c.headcount - 1) } : c) }}>−</button>
                          <span style={{ fontSize: 20, fontWeight: 800, minWidth: 22, textAlign: "center", color: "#1d2942" }}>{dr.headcount}</span>
                          <button style={{ width: 32, height: 32, borderRadius: 9, background: AAN, border: "none", fontSize: 19, color: "#fff", fontWeight: 800, cursor: "pointer" }}
                            onClick={(e) => { e.stopPropagation(); setEditDraft((c) => c ? { ...c, headcount: c.headcount + 1 } : c) }}>+</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 19, fontWeight: 800, color: "#c98a00" }}>{r.headcount || 1}</span>
                      )}
                    </div>}

                    {bewerk && dr && (
                      <div style={{ ...S.row, justifyContent: "space-between", alignItems: "center", marginTop: 11, paddingTop: 10, borderTop: "1px solid rgba(29,41,66,0.12)" }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: "#6b7484" }}>💶 {L.paidLabel}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18, color: "#6b7484", fontWeight: 700 }}>€</span>
                          <input autoFocus={bedragFocus} onFocus={() => setBedragFocus(false)} onClick={(e) => e.stopPropagation()} type="text" inputMode="decimal" placeholder="0,00"
                            {...bedragVeld(`edit-${r.id}`, dr.amount, (v) => setEditDraft((c) => c ? { ...c, amount: v, potAmt: c.bron === "pot" ? v : c.potAmt } : c))}
                            style={{ ...S.input, width: 106, padding: "8px 10px", fontSize: 18, fontWeight: 800, color: dr.bron === "pot" ? "#2f5693" : "#c88a1a", textAlign: "right", borderColor: dr.bron === "pot" ? "rgba(47,111,181,0.45)" : undefined }} />
                        </span>
                      </div>
                    )}
                    {/* Waarmee betaald? Ook achteraf nog te corrigeren. */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(29,41,66,0.12)" }}>
                      {bewerk && dr ? (
                        <>
                          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 15, color: "#6b7484", fontWeight: 800 }}><ZakjeIcoon size={15} /> {L.paidWithQ}</span>
                            <span onClick={(e) => { e.stopPropagation(); setShowPot(true) }} style={{ fontSize: 14.5, fontWeight: 800, color: "#2f6fb5", textDecoration: "underline", cursor: "pointer" }}>{L.potTopUp}</span>
                          </div>
                          {(() => {
                            const beschikbaar = Math.max(0, potAvailFor(idx))
                            const uitDePot = dr.bron !== "self"
                            const wissel = (aan: boolean, tekst: string, doe: () => void, kleur: string) => (
                              <button onClick={(e) => { e.stopPropagation(); doe() }} style={{ flex: 1, textAlign: "center", cursor: "pointer", fontFamily: "inherit", border: "none",
                                background: aan ? kleur : "transparent", boxShadow: aan ? `0 2px 6px -2px ${kleur}99` : "none",
                                color: aan ? (kleur === RAND ? RANDTEKST : "#fff") : "#1d2942",
                                borderRadius: 999, padding: "9px 4px", fontSize: 13.5, fontWeight: 600 }}>{tekst}</button>
                            )
                            return (<>
                              <div style={{ ...S.segBaan }}>
                                {wissel(!uitDePot, L.selfPaidShort, () => setEditDraft((c) => c ? { ...c, bron: "self", potAmt: 0 } : c), RAND)}
                                {wissel(uitDePot, L.fromPotShort, () => { if (potLeeg) return; setEditDraft((c) => {
                                  if (!c) return c
                                  const d = Math.round(Math.min(beschikbaar, c.amount) * 100) / 100
                                  return { ...c, bron: d >= c.amount - 0.005 ? "pot" : "mix", potAmt: d }
                                }) }, "#2f6fb5")}
                              </div>
                              {uitDePot && (
                                <div style={{ background: "#eef4fb", border: "1px solid rgba(47,111,181,0.25)", borderRadius: 11, padding: 11, marginTop: 9 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#2f5693", marginBottom: 9 }}>{L.potPaysWholeQ}</div>
                                  <div style={{ ...S.segBaan, background: "#fff", marginBottom: 10 }}>
                                    {wissel(dr.bron === "pot", `${L.yesWord}, ${euro(dr.amount || 0)}`, () => setEditDraft((c) => c ? { ...c, bron: "pot", potAmt: c.amount } : c), "#2f6fb5")}
                                    {wissel(dr.bron === "mix", L.noPartOnly, () => setEditDraft((c) => c ? { ...c, bron: "mix", potAmt: Math.round(Math.min(beschikbaar, c.amount) * 100) / 100 } : c), "#2f6fb5")}
                                  </div>
                                  {dr.bron === "pot" ? (
                                    <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#2f5693", lineHeight: 1.5 }}>
                                      {L.wholeRoundFromPot}<br />
                                      <span style={{ color: "#4a5567" }}>{L.potLeftAfter} <b style={{ fontSize: 16.5, color: "#2f5693" }}>{euro(Math.max(0, beschikbaar - dr.amount))}</b></span>
                                    </div>
                                  ) : (<>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2f5693" }}>{L.fromPotLabel}</span>
                                      <input onClick={(e) => e.stopPropagation()} {...bedragVeld(`edit-pot-${r.id}`, dr.potAmt, (v) => setEditDraft((c) => c ? { ...c, potAmt: Math.max(0, Math.min(v, c.amount)) } : c))}
                                        style={{ ...S.input, width: 104, padding: "6px 11px", textAlign: "right", fontSize: 17, fontWeight: 800, background: "#fff", border: "1.5px solid #2f6fb5", color: "#2f5693" }} />
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                                      <span style={{ fontSize: 14, fontWeight: 700, color: "#8a5e0f" }}>{L.notFromPotLabel}</span>
                                      <span style={{ fontSize: 18, fontWeight: 800, color: "#c88a1a" }}>+ {euro(Math.max(0, dr.amount - Math.min(dr.potAmt, dr.amount)))}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 0", marginTop: 4, borderTop: "1.5px solid rgba(47,111,181,0.3)" }}>
                                      <span style={{ fontSize: 14, fontWeight: 800, color: "#1d2942" }}>{L.togetherWord}</span>
                                      <span style={{ fontSize: 18, fontWeight: 800, color: "#1d2942" }}>{euro(dr.amount)}</span>
                                    </div>
                                  </>)}
                                </div>
                              )}
                            </>)
                          })()}
                          {potLeeg && <div style={{ fontSize: 14, color: "#c0554a", fontWeight: 700, marginTop: 6 }}>{L.potEmptyFillFirst}</div>}
                          {/* Te weinig in de pot: binair — bijvullen of zelf betalen. */}
                          {!potLeeg && dr.bron === "pot" && dr.amount > Math.max(0, potAvailFor(idx)) + 0.005 && (
                            <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 700, color: "#6b4a00", lineHeight: 1.45 }}>
                              {L.potShortSimple(euro(Math.max(0, potAvailFor(idx))), euro(dr.amount))} <span style={{ color: "#24476f" }}>{L.tryPartHint}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Eerst het totaal, pas daaronder de bron: twee regels met
                              allebei "betaald" erin lazen als twee bedragen. */}
                          <div style={{ display: (r.amount || 0) > 0.005 ? "flex" : "none", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 17, fontWeight: 500, color: "#6b7484" }}>💶 {L.totalPaidShort}</span>
                            {opNaam === true && !uitPot && geenBedrag ? (
                              <span onClick={(e) => { e.stopPropagation(); startEditRound(r) }}
                                style={{ fontSize: 17.5, fontWeight: 800, color: "#b0402f", textDecoration: "underline", cursor: "pointer" }}>{L.addPaymentBang}</span>
                            ) : (
                              <span style={{ fontSize: 19, fontWeight: 600, color: "#c98a00" }}>{(r.amount || 0) > 0 ? euro(r.amount) : "—"}</span>
                            )}
                          </div>
                          {uitPot && (
                            <div style={{ ...S.row, justifyContent: "space-between", marginTop: 3, paddingLeft: 14 }}>
                              <span style={{ fontSize: 15, fontWeight: 500, color: "#2f5693", display: "inline-flex", alignItems: "center", gap: 5 }}><ZakjeIcoon size={15} /> {(r.potPart || 0) >= (r.amount || 0) - 0.005 ? L.potShareAll : L.potShare}</span>
                              <span style={{ fontSize: 16, fontWeight: 600, color: "#2f6fb5" }}>{euro(r.potPart || 0)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>


                    {bewerk && (
                      <div style={{ marginTop: 14 }}>
                        {(() => {
                          const uitPot = dr ? (dr.bron === "pot" || (dr.bron === "mix" && Math.max(0, dr.potAmt) > 0.005)) : false
                          return (
                            <button style={{ ...S.btnP, width: "100%", color: "#fff", ...(uitPot
                              ? { background: "linear-gradient(135deg,#3d86cc,#2f5693)", boxShadow: "0 4px 12px -4px rgba(47,86,147,0.6)" }
                              : { background: "linear-gradient(135deg,#f0a500,#e08a00)", boxShadow: "0 4px 12px -4px rgba(224,138,0,0.6)" }) }}
                              onClick={(e) => { e.stopPropagation(); saveEditRound(r) }}>💾 {L.saveWord}</button>
                          )
                        })()}
                        <button style={{ width: "100%", marginTop: 8, padding: "9px 0", background: "none", border: "none", fontSize: 15.5, fontWeight: 700, color: "#8b93a3", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); cancelEditRound() }}>✕ {L.cancel}</button>
                      </div>
                    )}

                    {/* Verplaatst naar onder de drankjeslijst; deze plek blijft leeg. */}
                    {false && !bewerk && (
                      <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(29,41,66,0.12)", textAlign: "right" }}>
                        <span onClick={(e) => { e.stopPropagation(); startEditRound(r) }}
                          style={{ display: "inline-block", fontSize: 14.5, fontWeight: 800, color: "#c98a00", background: "#eef1f6", border: "1px solid rgba(240,165,0,0.45)", borderRadius: 14, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>✏️ {L.adjustWord}</span>
                      </div>
                    )}
                  </div>
                  )
                })()}
              </div>
            )
          })}
          </div>
        </div>

        {/* Kwam je bedragen aanvullen? Dan is er maar één zinnige volgende stap. */}
        {fillMode ? (
          <button style={{ ...S.btnP, width: "100%", marginTop: 16, padding: "14px 6px", fontSize: 17.5 }}
            onClick={() => {
              // Bewust een rondje op €0 laten (getrakteerd) mag; alleen als er nog
              // helemaal níks ingevuld staat valt er niets af te rekenen.
              if (!rounds.some((rr) => (rr.amount || 0) > 0.005)) { setNotice(L.fillAmountsFirst); return }
              // Vanaf de eindbalans komen aanvullen? Dan ook daarheen terug — de
              // balans rekent meteen met de nieuwe bedragen.
              if (overviewBackTo === "final") { setFillMode(false); setView("final"); return }
              if (opNaam === true && !settle) { setFillMode(false); goQuickSettle() }
              else { setFillMode(false); setView("quickSettle") }
            }}>{L.backToSettle}</button>
        ) : (
          <>
            {/* Gelijkwaardig: doorgaan of stoppen. Goud voor het rondje, inktblauw voor
                de afrekening — rood en oranje zouden als waarschuwing lezen. */}
            {false && !settle && unassignedAllRounds > 0 && (
              <div onClick={goAssignUnassigned}
                style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.4)", borderRadius: 10, padding: "10px 12px", marginTop: 14, fontSize: 15, fontWeight: 800, color: "#b0402f", textAlign: "center", cursor: "pointer" }}>
                {L.someUnassigned(unassignedAllRounds)} — <u>{L.tapToAssign}</u>
              </div>
            )}
            {/* Afrekenen links, nieuw rondje rechts: doorgaan staat aan de kant waar je
                duim zit. */}
            {/* Rustige rij: doorgaan-acties naast elkaar, afrekenen eronder. Geen
                gevulde knoppen — één amber kader markeert de gewone volgende stap. */}
            <div style={{ position: "sticky", bottom: 0, marginTop: 16, paddingTop: 14, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)", background: "linear-gradient(180deg,rgba(250,247,236,0),#faf7ec 22%)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {rounds.length > 0 && laatsteRondjeKlaar() && (
                <button onClick={repeatRound}
                  style={{ flex: 1, minWidth: 0, boxSizing: "border-box", cursor: "pointer", borderRadius: 12, padding: "12px 8px", fontSize: 16.5, fontWeight: 800, fontFamily: "inherit", lineHeight: 1.25,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 62,
                    background: "#fff", color: "#1d2942", border: "1px solid rgba(29,41,66,0.28)" }}>
                  <span>{L.repeatRound}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#8b93a3", marginTop: 3 }}>{L.repeatRoundSub}</span>
                </button>
              )}
              {laatsteRondjeKlaar() && (
                <button onClick={nextRound}
                  style={{ flex: 1, minWidth: 0, boxSizing: "border-box", cursor: "pointer", borderRadius: 12, padding: "12px 8px", fontSize: 16.5, fontWeight: 800, fontFamily: "inherit", lineHeight: 1.25,
                    display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: 62,
                    background: "#fffdf4", color: "#8a5e0f", border: "2px solid rgba(240,165,0,0.7)" }}>{settle && openRoundId ? L.continueRound(roundNr) : L.newRoundBtn}</button>
              )}
            </div>
            <button onClick={goQuickSettle}
              style={{ width: "100%", marginTop: 8, boxSizing: "border-box", cursor: "pointer", borderRadius: 12, padding: "13px 8px", fontSize: 16.5, fontWeight: 800, fontFamily: "inherit",
                background: "#fff", color: "#1d2942", border: "1px solid rgba(29,41,66,0.28)" }}>{L.settleBtnShort}</button>
            </div>
          </>
        )}
      </div></div>
    )
  }

  // ── WIE BETAALDE (na het toewijzen, vóór de eindbalans) ─────────────────────
  // Eén scherm voor de twee dingen die de snelle modus niet bijhoudt: wie het rondje
  // voorschoot, en van wie het geld in de pot komt. Zonder die twee kan de eindbalans
  // niet uitrekenen wie aan wie moet overschrijven.
  if (view === "payers") {
    // Gedekt = pot + personen samen komen aan het bedrag. Een rondje dat volledig uit
    // de pot ging heeft geen enkele persoon als betaler, en dat is prima.
    const zonderBedragHier = rounds.filter((r) => (r.amount || 0) <= 0.005)
    const zonderBetaler = rounds.filter((r) => (r.amount || 0) <= 0.005 || rPaidSum(r) < (r.amount || 0) - 0.005)
    const klaar = zonderBetaler.length === 0 && !potZonderNamen
    return (
      <div style={S.page}><div style={S.wrap}>
        <style>{`@keyframes rundoPilWenk{0%,100%{border-color:rgba(224,138,0,0.35);box-shadow:0 0 0 0 rgba(224,138,0,0)}50%{border-color:rgba(224,138,0,0.95);box-shadow:0 0 0 4px rgba(224,138,0,0.13)}}
          .rundo-pil-wenk{animation:rundoPilWenk 1.9s ease-in-out infinite}`}</style>
        <Header />
        {showPot && renderPotModal()}
        {renderDialogs()}

        {fromQuick && stapBalk(3)}
        <h3 style={{ ...S.h3, margin: "0 0 9px" }}>💶 {L.payersTitle}</h3>

        {/* Eén regel volstaat: het totaal staat vast, en wat je nog moet doen is het
            openstaande bedrag. De rest — pot, personen — lees je bij de rondjes zelf. */}
        {(() => {
          const totaalRondjes = rounds.reduce((a, r) => a + (r.amount || 0), 0)
          const doorPersonen = rounds.reduce((a, r) => a + Object.values(r.payers || {}).reduce((x, y) => x + (y || 0), 0), 0)
          const openstaand = Math.max(0, totaalRondjes - potSpent - doorPersonen)
          return (
            <div style={{ ...S.row, justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "0 4px 11px", borderBottom: "1px solid rgba(29,41,66,0.18)", marginBottom: 12 }}>
              <span style={{ fontSize: 15.5, color: "#6b7484", fontWeight: 800 }}>{openstaand > 0.005 ? L.roundCount(rounds.length) : L.totalOf(euro(totaalRondjes))}</span>
              {/* Staat er niets meer open, dan zeggen de vinkjes bij de rondjes het al.
                  Een "alles gedekt" naast een leeg scherm bevestigt niets. */}
              {openstaand > 0.005 && <span style={{ fontSize: 21.5, fontWeight: 800, color: "#b0402f" }}>{L.stillToAssign(euro(openstaand))}</span>}
            </div>
          )
        })()}

        {/* Zolang de pot nog niet op namen staat, is dit een taak — dus bovenaan. Is hij
            verdeeld, dan wordt het informatie en schuift hij als regel naar onderen. */}
        {potContribTotal > 0.005 && (potZonderNamen || potNames !== null) && (
          <div style={{ margin: "12px 0 13px", position: "relative", background: "#f4faf6", border: potZonderNamen ? "1.5px solid rgba(224,104,92,0.55)" : "1.5px solid rgba(31,138,76,0.4)", borderRadius: 16, padding: "13px 13px 12px" }}>
            {/* Een zakje op de hoek en een smaller kader: de pot is geen rondje in de rij. */}
            <span style={{ position: "absolute", top: -13, left: -11, width: 34, height: 34, borderRadius: "50%", background: "#fff", border: potZonderNamen ? "1.5px solid rgba(224,104,92,0.55)" : "1.5px solid rgba(31,138,76,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, zIndex: 1 }}>💰</span>
            {/* Groen leest als "klaar". Zolang de pot op de groep staat is hij dat niet, en
                dat moet je zien vóór je de bedragen leest — vandaar bovenaan, over de breedte. */}
            {potZonderNamen && (
              <div style={{ margin: "-13px -13px 12px", padding: "6px 13px 6px 40px", borderRadius: "14px 14px 0 0", background: "#c0554a", color: "#fff", fontSize: 14, fontWeight: 800, lineHeight: 1.4 }}>⚠ {L.potNotSplit}</div>
            )}
            <div style={{ ...S.row, justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10, paddingLeft: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#1f6b3a", minWidth: 0 }}>{L.potShort}
                {potSpent > 0.005 && <span style={{ fontSize: 14, fontWeight: 600, color: "#5a9a75" }}> · {L.potUsedFree(euro(potSpent), euro(Math.max(0, potRemaining)))}</span>}
              </span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#1f8a4c", flexShrink: 0 }}>{euro(potContribTotal)}</span>
            </div>
            {potNames !== null ? (
              <>
                {/* Per persoon aanpasbaar. Wie meer intikt, verhoogt meteen de pot. */}
                {people.map((p) => (
                  <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(29,41,66,0.08)" }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: "#1d2942", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 17, color: "#6b7484", fontWeight: 700 }}>€</span>
                      <input type="text" inputMode="decimal" placeholder="0,00"
                        {...bedragVeld(`potnaam-${p.id}`, potNames[p.id] || 0, (v) => setPotNames((c) => ({ ...(c || {}), [p.id]: v })))}
                        style={{ ...S.input, width: 99, padding: "7px 9px", fontSize: 18, fontWeight: 800 }} />
                    </span>
                  </div>
                ))}
                <div style={{ ...S.row, justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: "1px dashed rgba(29,41,66,0.25)" }}>
                  <span style={{ fontSize: 15.5, fontWeight: 800, color: "#6b7484" }}>{L.potNewTotal}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: Object.values(potNames).reduce((a, b) => a + (b || 0), 0) > potContribTotal + 0.005 ? "#b0402f" : "#1f8a4c" }}>{euro(Object.values(potNames).reduce((a, b) => a + (b || 0), 0))}</span>
                </div>
                {/* Meer verdelen dan er ooit inging kan kloppen (iemand legde bij), maar
                    het is bijna altijd een tikfout. Dus melden, niet blokkeren. */}
                {Object.values(potNames).reduce((a, b) => a + (b || 0), 0) > potContribTotal + 0.005 && (
                  <div style={{ fontSize: 14, color: "#b0402f", fontWeight: 800, marginTop: 6 }}>⚠️ {L.potOverShort(euro(Object.values(potNames).reduce((a, b) => a + (b || 0), 0) - potContribTotal))}</div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                  <button style={{ ...S.btn, flex: 1, fontSize: 15, fontWeight: 800, padding: "10px 6px" }}
                    onClick={() => { const per = potContribTotal / Math.max(1, people.length); const n: Record<string, number> = {}; people.forEach((p) => { n[p.id] = Math.round(per * 100) / 100 }); setPotNames(n) }}>{L.potSpreadEven}</button>
                  <button style={{ ...S.btnP, flex: 1, fontSize: 15.5, padding: "10px 6px" }}
                    onClick={() => {
                      const nieuw = Object.values(potNames).reduce((a, b) => a + (b || 0), 0)
                      if (nieuw > potContribTotal + 0.005) {
                        setConfirmDlg({ msg: L.potOverMax(euro(nieuw), euro(potContribTotal)), yes: L.saveAnyway,
                          onYes: () => { setConfirmDlg(null); bewaarPotPerPersoon(potNames) } })
                        return
                      }
                      bewaarPotPerPersoon(potNames)
                    }}>{L.saveWord}</button>
                </div>
                <button style={{ width: "100%", marginTop: 8, padding: "8px 0", background: "none", border: "none", fontSize: 15, fontWeight: 700, color: "#8b93a3", cursor: "pointer" }}
                  onClick={() => setPotNames(null)}>{L.cancel}</button>
              </>
            ) : potZonderNamen ? (
              <>
                {/* Twee keuzes naast elkaar; dat de pot nog verdeeld moet worden, blijkt
                    uit het feit dat deze knoppen er staan. Een zin erbij is dubbelop. */}
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={{ flex: 1, background: AAN, border: "none", borderRadius: 9, padding: "9px 6px", fontSize: 14.5, fontWeight: 800, color: "#fff", cursor: "pointer" }}
                    onClick={verdeelPotOverNamen}>{L.splitEvenShort(people.length)}</button>
                  <button style={{ flex: 1, background: "#fff", border: "1px solid rgba(240,165,0,0.6)", borderRadius: 9, padding: "9px 6px", fontSize: 14.5, fontWeight: 800, color: "#8a5e0f", cursor: "pointer" }}
                    onClick={() => { const per = potContribTotal / Math.max(1, people.length); const n: Record<string, number> = {}; people.forEach((p) => { n[p.id] = Math.round(per * 100) / 100 }); setPotNames(n) }}>{L.perPersonShort}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ ...S.row, justifyContent: "space-between", gap: 9 }}>
                  <span style={{ fontSize: 14.5, color: "#5a9a75", lineHeight: 1.5, minWidth: 0 }}>
                    {people.filter((p) => contribOf(p.id) > 0.005).map((p) => `${p.name} ${euro(contribOf(p.id))}`).join(" · ")}
                  </span>
                  <button style={{ flexShrink: 0, background: "#fff", border: "1px solid rgba(31,138,76,0.35)", borderRadius: 9, padding: "8px 12px", fontSize: 14.5, fontWeight: 800, color: "#1f6b3a", cursor: "pointer", whiteSpace: "nowrap" }}
                    onClick={() => { const n: Record<string, number> = {}; people.forEach((p) => { n[p.id] = Math.round(contribOf(p.id) * 100) / 100 }); setPotNames(n) }}>{L.perPersonShort}</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Een snelkoppeling die je meestal niet nodig hebt: pas uitklappen bij een tik. */}
        {people.length > 0 && rounds.length > 1 && !showSameFor && (
          <div style={{ textAlign: "right", marginBottom: 11 }}>
            <span onClick={() => setShowSameFor(true)}
              style={{ fontSize: 14, fontWeight: 800, color: "#c98a00", background: "#fcfdfe", border: "1px solid rgba(240,165,0,0.5)", borderRadius: 14, padding: "5px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>⚡ {L.sameForAll} ▾</span>
          </div>
        )}
        {people.length > 0 && rounds.length > 1 && showSameFor && (
          <div style={{ ...S.card, padding: "12px 13px" }}>
            <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 15.5, fontWeight: 800, color: "#6b7484" }}>⚡ {L.sameForAll}</span>
              <span onClick={() => setShowSameFor(false)} style={{ fontSize: 17, color: "#a7b0bf", cursor: "pointer" }}>✕</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {potContribTotal > 0.005 && (
                <span onClick={() => zelfdeBetalerVoorAlles(null)}
                  style={{ ...S.pill, cursor: "pointer", fontSize: 16, padding: "6px 12px", background: "#f0f9f4", border: "1px solid rgba(31,138,76,0.4)", color: "#1f6b3a" }}><ZakjeIcoon size={15} /> {L.thePot}</span>
              )}
              {people.map((p) => (
                <span key={p.id} onClick={() => zelfdeBetalerVoorAlles(p.id)}
                  style={{ ...S.pill, cursor: "pointer", fontSize: 16, padding: "6px 12px", background: "#fff", border: "1px solid rgba(29,41,66,0.25)", color: "#1d2942" }}>{p.name}</span>
              ))}
            </div>
          </div>
        )}

        {rounds.map((r, idx) => {
          const items = drinksOf(r).reduce((a, x) => a + x.n, 0)
          const geenBedrag = (r.amount || 0) <= 0.005
          const gekozen = Object.keys(r.payers || {}).filter((pid) => (r.payers[pid] || 0) > 0.005)
          const uitPot = (r.potPart || 0) > 0.005
          const tekort = (r.amount || 0) - rPaidSum(r)
          const mist = geenBedrag || tekort > 0.005
          return (
            <div key={r.id} style={{ ...S.card, position: "relative", padding: "13px 14px", ...(mist
              ? { border: "2px solid rgba(224,104,92,0.6)", background: "rgba(224,104,92,0.05)" }
              : {}) }}>
              {/* Het vinkje verschijnt pas als een rondje rond is: zo blijft je oog hangen
                  bij de kaders die er nog niet staan. */}
              {!mist && (
                <span style={{ position: "absolute", top: -11, left: 13, width: 23, height: 23, borderRadius: "50%", background: "#1f8a4c", color: "#fff", fontSize: 14.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
              )}
              <div style={{ ...S.row, justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 17.5, fontWeight: 800, color: "#1d2942", paddingLeft: mist ? 0 : 20, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{L.roundSummary(idx + 1, items)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {geenBedrag ? null : (
                    <span onClick={() => { setFillMode(false); setOverviewBackTo("payers"); setOpenRounds((prev) => new Set(prev).add(r.id)); startEditRound(r); setView("roundsOverview") }}
                      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 18, fontWeight: 800, color: "#c88a1a", whiteSpace: "nowrap", cursor: "pointer", border: "1.5px solid rgba(200,138,0,0.55)", borderRadius: 999, padding: "4px 12px" }}>
                      {euro(r.amount || 0)} <span style={{ fontSize: 12 }}>✏️</span></span>
                  )}
                </span>
              </div>
                  {geenBedrag ? (
                    <div onClick={() => { setFillMode(true); setOverviewBackTo("payers"); setView("roundsOverview") }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, cursor: "pointer", background: "rgba(240,165,0,0.1)", border: "1.5px dashed rgba(176,64,47,0.5)", borderRadius: 12, padding: "10px 12px", marginBottom: 9 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 800, color: "#8a4436", minWidth: 0 }}>{L.fillAmountFirstShort}</span>
                      <span style={{ flexShrink: 0, background: "#fff", color: "#8a4436", border: "1.5px solid rgba(176,64,47,0.55)", borderRadius: 999, padding: "7px 15px", fontSize: 13.5, fontWeight: 800 }}>{L.fillWord}</span>
                    </div>
                  ) : tekort > 0.005 ? (
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: "#a8720a", marginBottom: 9 }}>{L.tapNameBelow} 👇</div>
                  ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {/* De pot is een betaler zoals een persoon: hij heeft geld en geeft het uit. */}
                {potContribTotal > 0.005 && (
                  <span onClick={() => { if (geenBedrag) { setNotice(L.fillAmountFirst); return } rTogglePot(idx) }}
                    style={{ ...S.chip(uitPot ? 1 : 0), opacity: geenBedrag ? 0.5 : 1,
                      ...(uitPot ? { background: "#2f6fb5", border: "1.5px solid #2f6fb5", color: "#fff" } : {}) }}>
                    {/* Gekozen: wat de pot voor dít rondje draagt. Niet gekozen: wat er nog
                        beschikbaar is. Zonder dat onderscheid lijken beide getallen hetzelfde. */}
                    <ZakjeIcoon size={15} /> {L.potWord}<span style={{ fontWeight: 600, opacity: 0.85 }}> · {uitPot ? euro(r.potPart || 0) : L.potFree(euro(Math.max(0, potAvailFor(idx))))}</span>
                  </span>
                )}
                {people.map((p) => {
                  const on = (r.payers?.[p.id] || 0) > 0.005
                  return (
                    <span key={p.id} className={!on && !geenBedrag && tekort > 0.005 ? "rundo-pil-wenk" : undefined} onClick={() => { if (geenBedrag) { setNotice(L.fillAmountFirst); return } rTogglePayer(idx, p.id) }} title={p.name}
                      style={{ ...S.chip(on ? 1 : 0), opacity: geenBedrag ? 0.45 : 1, padding: on ? "9px 9px 9px 15px" : "10px 16px", fontSize: 15,
                        ...(!on && !geenBedrag && tekort > 0.005 ? { border: "2px solid rgba(224,138,0,0.6)", background: "rgba(240,165,0,0.07)", color: "#8a5e0f" } : {}) }}>
                      {p.name}{on && <span style={{ marginLeft: 6, background: RANDTEKST, color: RAND, borderRadius: 999, padding: "1px 8px", fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>{euro(r.payers[p.id])}</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}


        {/* Verdeeld? Dan volstaat één regel, met een weg terug als je wil bijstellen. */}
        {potContribTotal > 0.005 && !potZonderNamen && potNames === null && (
          <div style={{ ...S.row, justifyContent: "space-between", gap: 8, background: RAND, borderRadius: 13, padding: "9px 12px", marginBottom: 13 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14.5, color: "#e8f0f2", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><ZakjeIcoon size={15} /> {L.potShared(euro(potContribTotal), people.filter((pp) => contribOf(pp.id) > 0.005).length)}</span>
            <span onClick={() => { const n: Record<string, number> = {}; people.forEach((pp) => { n[pp.id] = Math.round(contribOf(pp.id) * 100) / 100 }); setPotNames(n) }}
              style={{ flexShrink: 0, fontSize: 14, color: RANDTEKST, textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>{L.changeWord}</span>
          </div>
        )}

        {/* De knop laat altijd door: ontbreekt er iets, dan verschijnt een melding die
               zegt wát er nog ontbreekt en blijft de knop dof. */}
            <button disabled={!klaar}
              style={{ ...S.btnP, width: "100%",
                background: klaar ? RAND : "#c3c9d4",
                color: klaar ? RANDTEKST : "#fff",
                cursor: klaar ? "pointer" : "default",
                boxShadow: klaar ? `0 4px 12px -4px ${RAND}99` : "none" }}
              onClick={() => {
                if (!klaar) return
                // fromQuick blijft staan: zo kan je vanaf de eindbalans nog stap voor stap terug.
                setHasSettled(true); setView("final")
              }}>{L.toFinal}</button>
            {!klaar && (
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "#a8720a", marginTop: 7, lineHeight: 1.4 }}>
                {zonderBedragHier.length > 0 ? L.fillAmountsFirst
                  : zonderBetaler.length > 0 ? L.missingPayer(zonderBetaler.length) : L.potNotSplit}
              </div>
            )}
        {fromQuick && (
          <button style={{ ...S.btn, width: "100%", marginTop: 8, fontSize: 17, fontWeight: 700, color: "#6b7484" }}
            onClick={() => { setAssignAllMode(true); setAssignIdx(0); setView("hub") }}>{L.backToAssign}</button>
        )}
      </div></div>
    )
  }

  // ── FINAL ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}><div style={S.wrap}>
      <Header />
      {showPot && renderPotModal()}
        {renderDialogs()}
      {pay === "coin" && (
        <div style={{ ...S.row, justifyContent: "flex-end", gap: 6, marginBottom: 10 }}>
            <div style={{ ...S.seg(displayUnit === "eur"), flex: "none", padding: "6px 12px" }} onClick={() => setDisplayUnit("eur")}>€</div>
            <div style={{ ...S.seg(displayUnit === "coin"), flex: "none", padding: "6px 12px" }} onClick={() => setDisplayUnit("coin")}>🎟️</div>
        </div>
      )}

      {/* Rondjes zonder bedrag blokkeren de eindbalans niet meer (overslaan is een
          bewuste keuze — getrakteerd telt als €0), maar ze blijven wel benoemd: was het
          tóch vergeten, dan is aanvullen één tik en rekent de balans meteen opnieuw. */}
      {rounds.some((r) => (r.amount || 0) <= 0.005) && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(240,165,0,0.1)", border: "1px solid rgba(240,165,0,0.45)", borderRadius: 11, padding: "9px 11px", marginBottom: 10 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: "#8a5e0f", lineHeight: 1.4 }}>💶 {L.zeroRoundsNote(rounds.filter((r) => (r.amount || 0) <= 0.005).length)}</span>
          <button onClick={() => { setFillMode(true); setOverviewBackTo("final"); setView("roundsOverview") }}
            style={{ flexShrink: 0, background: "#fff", border: "1px solid rgba(240,165,0,0.6)", color: "#c98a00", borderRadius: 9, padding: "8px 11px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{L.fillAmountsBtn}</button>
        </div>
      )}

      <div style={{ marginBottom: 13, padding: "0 2px" }}>
        <div style={{ ...S.row, justifyContent: "space-between", fontSize: 20 }}>
          <span style={{ fontWeight: 800 }}>{L.totalPaid}</span>
          <span style={{ fontWeight: 800, fontSize: 23 }}>{show(grandTotal)}</span>
        </div>
        {/* Drieluik: uit de pot, door personen, en wat er nog in de pot zit — met het
            goudzakje bij elke pot-regel en de potbedragen in het vertrouwde potblauw. */}
        {(potSpent > 0.005 || potContribTotal > 0.005) && (
          <div style={{ marginTop: 6, borderTop: "1px dashed rgba(29,41,66,0.2)", paddingTop: 6 }}>
            {potSpent > 0.005 && (<>
              <div style={{ ...S.row, justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}><span style={{ color: "#2f5693", display: "inline-flex", alignItems: "center", gap: 7 }}><ZakjeIcoon size={18} /> {L.fromPot}</span><span style={{ fontWeight: 700, color: "#2f6fb5" }}>−{show(potSpent)}</span></div>
              <div style={{ ...S.row, justifyContent: "space-between", fontSize: 18, color: "#4a5567", fontWeight: 700, marginTop: 2 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ fontSize: 18, lineHeight: 1 }}>👤</span> {L.persPaidWord}</span><span style={{ fontWeight: 700 }}>{show(grandTotal - potSpent)}</span></div>
            </>)}
            {potContribTotal > 0.005 && (
              <div style={{ ...S.row, justifyContent: "space-between", fontSize: 18, fontWeight: 700, marginTop: 4, borderTop: "1px dashed rgba(47,111,181,0.3)", paddingTop: 6 }}><span style={{ color: "#2f5693", display: "inline-flex", alignItems: "center", gap: 7 }}><ZakjeIcoon size={18} /> {L.potLeftLong}</span><span style={{ fontWeight: 800, color: "#2f6fb5" }}>{show(Math.max(0, potRemaining))}</span></div>
            )}
          </div>
        )}
      </div>


      <div style={S.card}>
        <div style={{ ...S.row, gap: 6, marginBottom: 8 }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 21.5, fontWeight: 800, color: "#1d2942", lineHeight: 1.25 }}>{L.fairVsEqual}</span>
              <span onClick={() => setNotice(L.fairInfo)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 19, height: 19, borderRadius: "50%", border: "1.5px solid #c98a00", color: "#c98a00", fontSize: 14, fontWeight: 800, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>i</span>
            </span>
          </span>
        </div>
        {/* Staat de kolom uit? Dan de vergelijking als één regel, zodat ze niet verdwijnt. */}
        {people.length > 0 && !showEqual && (
          <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 10, lineHeight: 1.5 }}>👥 {L.equalWouldBe(show(equalShare))}</div>
        )}
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => { setOpenFairAll((v) => !v); setOpenFair({}) }} style={{ ...S.btn, padding: "7px 14px", fontSize: 16, fontWeight: 800, color: "#8a5e0f" }}>{openFairAll ? "▴ Sluit details" : "▾ Bekijk details"}</button>
        </div>
        {(() => {
          const zonder = rounds.filter((rr) => (rr.amount || 0) <= 0.005).length
          if (zonder === 0) return null
          return (
            <div style={{ background: "rgba(240,165,0,0.14)", border: "1.5px solid rgba(200,138,0,0.6)", borderRadius: 12, padding: "11px 12px", marginBottom: 10 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: "#6b4a00", marginBottom: 3 }}>{L.provisionalTitle}</div>
              <div style={{ fontSize: 14, color: "#6b7484", lineHeight: 1.5, marginBottom: 9 }}>{L.provisionalWhy(zonder)}</div>
              <button style={{ ...S.btn, width: "100%", padding: "10px 0", fontSize: 16, fontWeight: 800 }}
                onClick={() => { setFillMode(true); setOverviewBackTo("final"); setView("roundsOverview") }}>{L.fillWord}</button>
            </div>
          )
        })()}
        {anyUnassignedRounds && (
          <div style={{ background: "rgba(224,104,92,0.1)", border: "1px solid rgba(224,104,92,0.45)", borderRadius: 12, padding: "11px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#b0402f", marginBottom: 3 }}>{L.equalSplitWarn}</div>
            <div style={{ fontSize: 15, color: "#8a5e0f", lineHeight: 1.5, marginBottom: 9 }}>{L.unassignedWarn}</div>
            <button style={{ ...S.btnP, width: "100%", padding: "11px 0", fontSize: 17.5 }} onClick={goAssignUnassigned}>{L.useFairSplit}</button>
          </div>
        )}
        {/* Kolomkoppen: de twee bedragen staan naast elkaar, elk onder zijn eigen naam.
            Zonder kop moest je raden welk getal welke verdeling was. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 6, borderBottom: "1.5px solid rgba(29,41,66,0.2)", fontSize: 14, fontWeight: 800, letterSpacing: "0.04em" }}>
          <span style={{ flex: 1, minWidth: 0, color: "#6b7484" }}>{L.participantColHead.toUpperCase()}</span>
          <span style={{ width: 82, textAlign: "right", color: "#1f8a4c", flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{L.fairColHead.toUpperCase()}</span>
          {showEqual ? (
            <span style={{ width: 80, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", gap: 4, paddingLeft: 8, borderLeft: "1px solid rgba(29,41,66,0.18)" }}>
              <span onClick={() => setNotice(L.fairSplitInfo)} style={{ cursor: "pointer", color: "#8b93a3", textAlign: "right", lineHeight: 1.15 }}>{L.equalColHead.toUpperCase()}</span>
              <span onClick={() => setShowEqual(false)} style={{ cursor: "pointer", fontSize: 13.5, color: "#a7b0bf" }}>✕</span>
            </span>
          ) : (
            <span onClick={() => setShowEqual(true)} style={{ flexShrink: 0, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#c98a00", background: "#fcfdfe", border: "1px solid rgba(240,165,0,0.5)", borderRadius: 11, padding: "3px 8px", letterSpacing: 0 }}>+ {L.equalColHead}</span>
          )}
        </div>
        {people.map((p) => {
          const dronk = consumption(p.id), waarborg = cupOwn(p.id), zelf = paidByPerson(p.id), inpot = contribOf(p.id)
          const open = openFairAll || openFair[p.id]
          const mijnGroep = settleGroups.find((g) => g.leden.some((x) => x.id === p.id))
          const mijnTx = settlement.tx.filter((t) => t.from === mijnGroep?.label || t.to === mijnGroep?.label)
          return (
            <div key={p.id} style={{ borderBottom: "1px solid rgba(29,41,66,0.06)" }}>
              <div style={{ ...S.row, alignItems: "flex-start", justifyContent: "space-between", padding: "8px 0", cursor: "pointer" }} onClick={() => setOpenFair((o) => ({ ...o, [p.id]: !open }))}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{open ? "▾" : "▸"} {p.name}</span>
                  {/* Een zin in plaats van pillen: zo staat er meteen bij van wie of aan wie,
                      en blijft de rijhoogte voorspelbaar ook bij lange namen. */}
                  {(() => {
                    const krijgt = mijnTx.filter((t) => t.to === mijnGroep?.label)
                    const betaalt = mijnTx.filter((t) => t.to !== mijnGroep?.label)
                    return (
                      <>
                        {krijgt.length > 0 && (
                          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#1f6b3a", marginTop: 2, lineHeight: 1.4 }}>
                            {L.getsWord} {krijgt.map((t) => `${show(t.amount)} ${L.fromWord2} ${t.from}`).join(" · ")}
                          </span>
                        )}
                        {betaalt.length > 0 && (
                          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#b35309", marginTop: 2, lineHeight: 1.4 }}>
                            {L.paysWord} {betaalt.map((t) => `${show(t.amount)} ${L.toWord2} ${t.to}`).join(" · ")}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </span>
                <span style={{ width: 78, textAlign: "right", fontSize: 17, fontWeight: 800, color: "#1f8a4c", flexShrink: 0 }}>{show(dronk)}</span>
                {showEqual && <span style={{ width: 80, textAlign: "right", paddingLeft: 8, borderLeft: "1px solid rgba(29,41,66,0.18)", fontSize: 14, color: "#8b93a3", flexShrink: 0 }}>{show(equalShare)}</span>}
              </div>
              {open && (
                <div style={{ background: "#eef1f6", borderRadius: 10, padding: "8px 11px", margin: "0 0 8px", fontSize: 16 }}>
                  <div style={{ color: "#1d2942", fontWeight: 800, padding: "2px 0" }}>{L.drank}</div>
                  {(() => {
                    const cnt: Record<string, number> = {}
                    rounds.forEach((r) => Object.entries(r.orders).forEach(([did, per]) => { const q = per?.[p.id] ?? 0; if (q > 0) cnt[did] = (cnt[did] ?? 0) + q }))
                    const list = drinks.filter((d) => (cnt[d.id] ?? 0) > 0)
                    if (list.length === 0) return null
                    return <div style={{ fontSize: 15, color: "#6b7484", padding: "1px 0 5px", lineHeight: 1.5 }}>{list.map((d) => `${cnt[d.id]}× ${d.name}`).join(" · ")}</div>
                  })()}
                  {depositOn && Math.abs(waarborg) > 0.005 && <div style={{ color: "#4a5567", padding: "2px 0" }}>{L.depositAdvanced} <b style={{ color: "#1d2942" }}>{show(waarborg)}</b></div>}
                  {zelf > 0.005 && (() => {
                    const rr = rounds.map((r, i) => ((r.payers?.[p.id] || 0) > 0.005 ? i + 1 : 0)).filter((n) => n > 0)
                    const label = rr.length === 0 ? "al betaald" : rr.length === 1 ? `al betaald in ronde ${rr[0]}` : `al betaald in ronde ${rr.join(", ")}`
                    return <div style={{ color: "#4a5567", padding: "2px 0" }}>{label} <b style={{ color: "#1f8a4c" }}>{show(zelf)}</b></div>
                  })()}
                  {inpot > 0.005 && <div style={{ color: "#4a5567", padding: "2px 0" }}>{L.inPot} <b style={{ color: "#1f8a4c" }}>{show(inpot)}</b></div>}
                  {cardLossPer > 0.005 && <div style={{ color: "#4a5567", padding: "2px 0" }}>{L.cardLoss} <b style={{ color: "#1d2942" }}>{show(cardLossPer)}</b></div>}
                  {/* Geen saldo- of overschrijvingsherhaling meer hier: de regels onder
                      de naam tonen al wie wat krijgt of betaalt, nog vóór je openklikt. */}
                </div>
              )}
            </div>
          )
        })}
        <div style={{ ...S.row, justifyContent: "space-between", padding: "9px 0 2px", borderTop: "2px solid rgba(29,41,66,0.25)", marginTop: 2 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 17.5, fontWeight: 800 }}>{L.togetherDrank}</span>
          <span style={{ width: 78, textAlign: "right", fontSize: 17, fontWeight: 800, color: "#1f8a4c", flexShrink: 0 }}>{show(grandTotal)}</span>
          {showEqual && <span style={{ width: 80, textAlign: "right", paddingLeft: 8, borderLeft: "1px solid rgba(29,41,66,0.18)", fontSize: 14, fontWeight: 800, color: "#6b7484", flexShrink: 0 }}>{show(equalShare * people.length)}</span>}
        </div>
        {isSchatting && (
          <div style={{ background: "#fff8e8", border: "1px solid rgba(240,165,0,0.35)", borderRadius: 10, padding: "9px 11px", marginTop: 10 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: "#c98a00", marginBottom: 2 }}>⚠️ {L.estimate}</div>
            <div style={{ fontSize: 15, color: "#6b7484", lineHeight: 1.5 }}>{L.estimateWhy}</div>
          </div>
        )}
      </div>

      {/* Uit beeld sinds de samenvattingsregels bij elke naam: dit kader herhaalde
          elke overschrijving een derde keer. Terugzetten = false weghalen. */}
      {false && settlement.tx.length > 0 && (
        <div style={S.card}>
          <h3 style={{ ...S.h3, marginTop: 0, marginBottom: 3, fontSize: 21.5 }}>{L.whoPaysWho}</h3>
          <div style={{ fontSize: 15, color: "#6b7484", marginBottom: 11, lineHeight: 1.45 }}>{L.shortestWay}</div>
          {settlement.tx.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < settlement.tx.length - 1 ? "1px solid rgba(29,41,66,0.1)" : "none" }}>
              <span style={{ fontSize: 18, color: "#1d2942", minWidth: 0 }}><b>{t.from}</b> <span style={{ color: "#8b93a3" }}>→</span> <b>{t.to}</b></span>
              <b style={{ flexShrink: 0, fontSize: 20, color: "#1f8a4c" }}>{show(t.amount)}</b>
            </div>
          ))}
        </div>
      )}

      {/* Kwam je hier via de drie stappen, dan moet de weg terug even netjes zijn als de
          weg heen: van de eindbalans naar stap 3, en van daar verder achteruit. */}
      {fromQuick && opNaam !== true && (
        <button style={{ ...S.btn, width: "100%", marginTop: 12, fontSize: 17, fontWeight: 700, color: "#6b7484" }}
          onClick={() => setView("payers")}>{L.backToPayers}</button>
      )}
      {/* Vanuit uitgebreid opnemen zijn er maar twee logische vervolgstappen: terugkijken
          in het overzicht, of doordrinken met een nieuw rondje. Liep de route via de
          Fair Split-stappen, dan gaat de modus eerst stilletjes terug. */}
      {opNaam === true && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button style={{ ...S.btn, flex: 1, fontSize: 17, fontWeight: 800 }}
            onClick={() => { terugNaarUitgebreid(); setOverviewBackTo("hub"); setView("roundsOverview") }}>{L.roundsOverview}</button>
          <button style={{ ...S.btnP, flex: 1, fontSize: 17, fontWeight: 800 }}
            onClick={() => { terugNaarUitgebreid(); nextRound() }}>{L.newRoundBtn}</button>
        </div>
      )}
      {/* De avond dichtzetten kan vanaf elke eindbalans; bij de QR-modus enkel voor de
          admin — gasten sluiten andermans avond niet af. */}
      {!!groupId && (!settle || isAdmin) && (
        <button onClick={() => { if (isAutoNaam(groupName)) { setSluitNaamVeld(""); setSluitNaam(true); return } void sluitAvondAf() }}
          style={{ width: "100%", marginTop: 10, padding: "12px 6px", borderRadius: 11, fontSize: 16, fontWeight: 800, cursor: "pointer", background: "#fff", color: "#3b486a", border: "1.5px dashed rgba(90,100,140,0.55)" }}>{L.closeEveBtn}</button>
      )}

    </div></div>
  )
}
