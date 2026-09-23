// Rundo-iconen: getekende lijniconen (24×24, afgeronde lijnen, 1.8 dik) in plaats
// van emoji. Ze nemen de tekstkleur over (currentColor), dus één icoon werkt in het
// blauw van Resto, het goud van Rundo en het groen van Groepsdeals.
//
//   <Icoon naam="scan" size={22} />

export type IcoonNaam =
  | "scan" | "deel" | "tik" | "verdeeld"
  | "noteer" | "lijstje" | "afrekenen"
  | "deal" | "groep" | "qr" | "euro"

const PADEN: Record<IcoonNaam, React.ReactNode> = {
  // Kader met scanhoeken rond een kasticket
  scan: (<>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <path d="M9 7.5h6v9l-1.5-1-1.5 1-1.5-1-1.5 1z" />
    <path d="M10.7 10.2h2.6M10.7 12.6h2.6" />
  </>),
  // Drie verbonden punten: delen met de groep
  deel: (<>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
  </>),
  // Wijsvinger met tikgolfje
  tik: (<>
    <path d="M9.5 13.5V6a1.75 1.75 0 0 1 3.5 0v5.5" />
    <path d="M13 10.5a1.75 1.75 0 0 1 3.5 0v1.5" />
    <path d="M16.5 11.5a1.75 1.75 0 0 1 3.5 0v3.5a6.5 6.5 0 0 1-6.5 6.5h-1.2c-2 0-3.3-.7-4.5-1.9l-3-3.1a1.7 1.7 0 0 1 2.4-2.4l2.3 2.2" />
    <path d="M6.2 4.3a4.5 4.5 0 0 1 2-1.6M16.3 2.7a4.5 4.5 0 0 1 2 1.6" />
  </>),
  // Eén bedrag dat zich in drie gelijke delen splitst
  verdeeld: (<>
    <circle cx="12" cy="4.8" r="2.3" />
    <path d="M12 7.1v4.4M12 11.5l-6 5.2M12 11.5l6 5.2M12 11.5v5.2" />
    <circle cx="6" cy="19" r="1.9" />
    <circle cx="12" cy="19" r="1.9" />
    <circle cx="18" cy="19" r="1.9" />
  </>),
  // QR-code: drie zoekvierkantjes en wat modules — delen via QR
  qr: (<>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.3" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.3" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.3" />
    <path d="M6.75 6.75h.01M17.25 6.75h.01M6.75 17.25h.01" strokeWidth="2.6" />
    <path d="M14 14h3v3M20.5 14v.01M14 20.5h.01M17.5 20.5h3v-3" />
  </>),
  // Euroteken in een munt: verdeeld / afrekenen
  euro: (<>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.6 8.4A4.9 4.9 0 1 0 15.6 15.6" />
    <path d="M7 10.8h5.6M7 13.2h5.6" />
  </>),
  // Potlood dat een lijn trekt: rondje opnemen
  noteer: (<>
    <path d="M12.5 20H20" />
    <path d="M16.2 3.8a2.1 2.1 0 0 1 3 3L7.5 18.5 3.5 19.5l1-4z" />
    <path d="M14.5 5.5l3 3" />
  </>),
  // Klembord met afvinklijstje: het barlijstje
  lijstje: (<>
    <rect x="8.5" y="2.5" width="7" height="3.5" rx="1" />
    <path d="M15.5 4.2h1.8A1.7 1.7 0 0 1 19 5.9v13.4a1.7 1.7 0 0 1-1.7 1.7H6.7A1.7 1.7 0 0 1 5 19.3V5.9a1.7 1.7 0 0 1 1.7-1.7h1.8" />
    <path d="M8.3 11l1.2 1.2 2-2.2M13.2 11.2H16M8.3 16l1.2 1.2 2-2.2M13.2 16.2H16" />
  </>),
  // Portefeuille: afrekenen
  afrekenen: (<>
    <path d="M18.5 7.5V5.7a1.2 1.2 0 0 0-1.2-1.2H5.5a2 2 0 0 0 0 4h13.8a1.2 1.2 0 0 1 1.2 1.2v3" />
    <path d="M3.5 6.5v11.8a2 2 0 0 0 2 2h13.8a1.2 1.2 0 0 0 1.2-1.2v-3" />
    <path d="M21 12.3h-3.2a2 2 0 0 0 0 4H21z" />
  </>),
  // Prijskaartje met procent
  deal: (<>
    <path d="M12.6 3H5a2 2 0 0 0-2 2v7.6a2 2 0 0 0 .6 1.4l7.4 7.4a2.3 2.3 0 0 0 3.2 0l6.2-6.2a2.3 2.3 0 0 0 0-3.2L13.9 3.6A2 2 0 0 0 12.6 3z" />
    <path d="M9.5 15.5l5-5" />
    <circle cx="10" cy="11" r=".9" />
    <circle cx="14" cy="15" r=".9" />
  </>),
  // Drie hoofdjes: de groep
  groep: (<>
    <circle cx="12" cy="8" r="3" />
    <path d="M6.5 19.5a5.5 5.5 0 0 1 11 0" />
    <circle cx="5" cy="10" r="2.2" />
    <circle cx="19" cy="10" r="2.2" />
    <path d="M1.8 18a3.8 3.8 0 0 1 3.6-3.3M22.2 18a3.8 3.8 0 0 0-3.6-3.3" />
  </>),
}

export function Icoon({ naam, size = 22, dikte = 1.8 }: { naam: IcoonNaam; size?: number; dikte?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={dikte} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ display: "block", flexShrink: 0 }}>
      {PADEN[naam]}
    </svg>
  )
}
