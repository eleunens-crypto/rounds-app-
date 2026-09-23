// Rundo woordmerk — Poppins SemiBold, omgezet naar vectorpaden.
// Geen font-afhankelijkheid: rendert overal identiek.
//
//   <RundoLogo size={34} />                  → Rundo, wit op donker
//   <RundoLogo size={34} opDonker={false} /> → Rundo, donkerblauw op licht
//   <RundoLogo size={34} resto />            → Rundo Resto
//   <RundoDealsLogo size={34} label="Groepsdeals" /> → Rundo Groepsdeals
//
// Hoogte stuurt de maat; de breedte volgt de verhouding.
// (Verhuisd uit app/page.tsx zodat ook /deals hem kan gebruiken.)

export const GOUD = "#F5B301"
export const TURQUOISE = "#4FD1C5"
export const DONKER = "#0E1A2E"
export const DEALS_GROEN = "#6FD08C"

const BOOG = "M14.90 30.56A34.0 34.0 0 0 1 -33.98 -1.19A34.0 34.0 0 0 1 17.00 -29.44"
const PIJL = "28.26,-22.94 18.40,-37.87 10.40,-24.02"
const LETTER_R = "M58.69 74.9 49.45 58.58H45.49V74.9H37.09V33.02H52.81Q57.67 33.02 61.09 34.73Q64.51 36.44 66.22 39.35Q67.93 42.26 67.93 45.86Q67.93 50 65.53 53.33Q63.13 56.66 58.39 57.92L68.41 74.9ZM45.49 52.28H52.51Q55.93 52.28 57.61 50.63Q59.29 48.98 59.29 46.04Q59.29 43.16 57.61 41.57Q55.93 39.98 52.51 39.98H45.49Z"
const WOORD_UNDO = "M105.38 44.98V74.9H97.76V71.12Q96.31 73.06 93.96 74.17Q91.61 75.28 88.85 75.28Q85.34 75.28 82.64 73.79Q79.94 72.31 78.41 69.42Q76.87 66.53 76.87 62.53V44.98H84.43V61.45Q84.43 65.02 86.21 66.94Q87.99 68.85 91.07 68.85Q94.2 68.85 95.98 66.94Q97.76 65.02 97.76 61.45V44.98ZM140.74 57.35V74.9H133.18V58.38Q133.18 54.81 131.4 52.9Q129.62 50.98 126.54 50.98Q123.41 50.98 121.6 52.9Q119.79 54.81 119.79 58.38V74.9H112.23V44.98H119.79V48.71Q121.3 46.77 123.65 45.66Q126 44.55 128.81 44.55Q134.15 44.55 137.45 47.93Q140.74 51.3 140.74 57.35ZM159.1 44.5Q162.01 44.5 164.66 45.77Q167.3 47.04 168.87 49.14V34.94H176.54V74.9H168.87V70.47Q167.47 72.69 164.93 74.04Q162.39 75.39 159.04 75.39Q155.26 75.39 152.13 73.44Q149 71.5 147.19 67.96Q145.38 64.42 145.38 59.83Q145.38 55.3 147.19 51.79Q149 48.28 152.13 46.39Q155.26 44.5 159.1 44.5ZM160.99 51.14Q158.88 51.14 157.1 52.17Q155.32 53.19 154.21 55.16Q153.1 57.13 153.1 59.83Q153.1 62.53 154.21 64.56Q155.32 66.58 157.12 67.66Q158.93 68.74 160.99 68.74Q163.09 68.74 164.93 67.69Q166.76 66.64 167.84 64.67Q168.92 62.7 168.92 59.94Q168.92 57.19 167.84 55.22Q166.76 53.25 164.93 52.19Q163.09 51.14 160.99 51.14ZM181.45 59.94Q181.45 55.35 183.47 51.84Q185.5 48.33 189.01 46.42Q192.52 44.5 196.84 44.5Q201.16 44.5 204.67 46.42Q208.18 48.33 210.2 51.84Q212.23 55.35 212.23 59.94Q212.23 64.53 210.15 68.04Q208.07 71.55 204.53 73.47Q200.99 75.39 196.62 75.39Q192.3 75.39 188.84 73.47Q185.39 71.55 183.42 68.04Q181.45 64.53 181.45 59.94ZM204.45 59.94Q204.45 55.68 202.21 53.38Q199.97 51.09 196.73 51.09Q193.49 51.09 191.3 53.38Q189.11 55.68 189.11 59.94Q189.11 64.21 191.25 66.5Q193.38 68.8 196.62 68.8Q198.67 68.8 200.48 67.8Q202.29 66.8 203.37 64.8Q204.45 62.8 204.45 59.94Z"
const WOORD_RESTO = "M249.48 74.9 241.16 60.21H237.6V74.9H230.04V37.21H244.19Q248.56 37.21 251.64 38.75Q254.72 40.29 256.26 42.91Q257.8 45.52 257.8 48.76Q257.8 52.49 255.64 55.49Q253.48 58.48 249.21 59.62L258.23 74.9ZM237.6 54.54H243.92Q247 54.54 248.51 53.06Q250.02 51.57 250.02 48.93Q250.02 46.33 248.51 44.9Q247 43.47 243.92 43.47H237.6ZM291.65 62.21H269.78Q270.05 65.45 272.05 67.29Q274.04 69.12 276.96 69.12Q281.17 69.12 282.95 65.5H291.11Q289.81 69.82 286.14 72.61Q282.47 75.39 277.12 75.39Q272.8 75.39 269.37 73.47Q265.94 71.55 264.03 68.04Q262.11 64.53 262.11 59.94Q262.11 55.3 264 51.79Q265.89 48.28 269.29 46.39Q272.69 44.5 277.12 44.5Q281.39 44.5 284.76 46.33Q288.14 48.17 290 51.55Q291.86 54.92 291.86 59.29Q291.86 60.91 291.65 62.21ZM284.03 57.13Q283.98 54.22 281.93 52.46Q279.88 50.71 276.91 50.71Q274.1 50.71 272.18 52.41Q270.26 54.11 269.83 57.13ZM295.15 65.45H302.77Q302.98 67.18 304.47 68.31Q305.95 69.45 308.17 69.45Q310.33 69.45 311.54 68.58Q312.76 67.72 312.76 66.37Q312.76 64.91 311.27 64.18Q309.79 63.45 306.55 62.59Q303.2 61.78 301.06 60.91Q298.93 60.05 297.39 58.27Q295.85 56.49 295.85 53.46Q295.85 50.98 297.28 48.93Q298.72 46.87 301.39 45.69Q304.06 44.5 307.68 44.5Q313.03 44.5 316.21 47.17Q319.4 49.84 319.72 54.38H312.49Q312.32 52.6 311 51.55Q309.68 50.49 307.46 50.49Q305.41 50.49 304.3 51.25Q303.2 52 303.2 53.35Q303.2 54.87 304.71 55.65Q306.22 56.43 309.41 57.24Q312.65 58.05 314.75 58.92Q316.86 59.78 318.4 61.59Q319.94 63.4 319.99 66.37Q319.99 68.96 318.56 71.01Q317.13 73.06 314.46 74.23Q311.78 75.39 308.22 75.39Q304.55 75.39 301.63 74.06Q298.72 72.74 297.01 70.47Q295.31 68.2 295.15 65.45ZM334.4 51.19V65.67Q334.4 67.18 335.13 67.85Q335.86 68.53 337.59 68.53H341.1V74.9H336.35Q326.79 74.9 326.79 65.61V51.19H323.23V44.98H326.79V37.59H334.4V44.98H341.1V51.19ZM344.06 59.94Q344.06 55.35 346.09 51.84Q348.11 48.33 351.62 46.42Q355.13 44.5 359.45 44.5Q363.77 44.5 367.28 46.42Q370.79 48.33 372.82 51.84Q374.84 55.35 374.84 59.94Q374.84 64.53 372.76 68.04Q370.69 71.55 367.15 73.47Q363.61 75.39 359.24 75.39Q354.92 75.39 351.46 73.47Q348.01 71.55 346.03 68.04Q344.06 64.53 344.06 59.94ZM367.07 59.94Q367.07 55.68 364.83 53.38Q362.59 51.09 359.35 51.09Q356.11 51.09 353.92 53.38Q351.73 55.68 351.73 59.94Q351.73 64.21 353.86 66.5Q356 68.8 359.24 68.8Q361.29 68.8 363.1 67.8Q364.91 66.8 365.99 64.8Q367.07 62.8 367.07 59.94Z"

export function RundoLogo({
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

// "Rundo Groepsdeals": het Rundo-merk met een tweede woord in de huisletter, zoals
// "Resto". Dat tweede woord is (nog) geen vectorpad maar live tekst in Poppins
// SemiBold, op dezelfde basislijn en x-hoogte als het logo gezet. Wie het straks
// net als Resto in paden wil, kan het woord uit Poppins exporteren en hier vervangen.
export function RundoDealsLogo({ size = 44, label = "Groepsdeals", kleur = DEALS_GROEN, opDonker = true }: { size?: number; label?: string; kleur?: string; opDonker?: boolean }) {
  return (
    <span role="img" aria-label={`Rundo ${label}`} style={{ display: "inline-flex", alignItems: "center" }}>
      <RundoLogo size={size} opDonker={opDonker} />
      <span aria-hidden style={{ fontFamily: "'Poppins', 'DM Sans', -apple-system, sans-serif", fontWeight: 600,
        fontSize: size * 0.52, lineHeight: 1, letterSpacing: -0.3, color: kleur, whiteSpace: "nowrap",
        marginTop: size * 0.08 }}>{label}</span>
    </span>
  )
}
