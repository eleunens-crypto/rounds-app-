import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// Het model. gemini-2.5-flash-lite heeft de ruimste GRATIS dagquota + beeldherkenning.
// Blijft het 429 geven, probeer dan "gemini-2.5-flash" of "gemini-flash-latest".
const MODEL = "gemini-2.5-flash-lite"

const PROMPT = [
  "Je krijgt een foto van een restaurant- of caferekening (Belgisch: Nederlands, Frans of Engels, soms door elkaar).",
  "Je taak: haal ALLEEN de bestelde consumpties (eten en drank) en eventuele echte extra kosten eruit, als nette JSON.",
  "",
  "VOLGORDE: behoud exact de volgorde van de bon, van boven naar onder. Herschik of hersorteer niets.",
  "",
  "Velden per lijn:",
  '- "name": naam van het item. Herken ook afkortingen en menukaart-termen en schrijf ze indien duidelijk voluit (bv. "Spag. Bol." -> "Spaghetti Bolognese", "Duv" -> "Duvel", "Vol-au-v" -> "Vol-au-vent"). Is het echt niet leesbaar, hou dan de tekst zoals ze staat.',
  '- "quantity": het aantal (geheel getal, minstens 1).',
  '- "unit_price": de prijs PER STUK in euro. Reken met: aantal x stukprijs = lijntotaal. Staat enkel de lijntotaal en is het aantal groter dan 1, deel dan door het aantal.',
  '- "uncertain": true als je twijfelt over de naam, het aantal of de prijs; anders false.',
  '- "note": een korte reden als uncertain true is (bv. "prijs onleesbaar"); anders een lege string.',
  '- "is_extra_cost": true ENKEL voor een aparte kost bovenop de consumpties (bediening, service, couvert, dekservet, leveringskosten, supplement); anders false.',
  "",
  "Slimme regels:",
  "- POSITIE: staat een lijn TUSSEN herkende consumpties, in dezelfde prijskolom en met een prijs ernaast, ga er dan van uit dat het OOK een consumptie is, ook al is de naam kort of vreemd.",
  "- MEERDERE LIJNEN: hoort een naam en een prijs op aparte regels bij elkaar, of loopt een lange naam over twee regels, voeg die dan samen tot een item.",
  "- GETALLEN: Europese notatie. De komma is de decimaal (12,50 betekent 12.50). Een punt kan duizendtallen scheiden. Interpreteer de prijzen correct.",
  "- ONDUIDELIJKE PRIJS: lijkt een lijn een consumptie maar is de prijs onduidelijk of onleesbaar, neem ze dan toch op met je beste inschatting (of 0) en zet uncertain op true met een korte note, zodat de gebruiker het kan nakijken.",
  "",
  "BTW/kosten: Belgische prijzen zijn meestal INCLUSIEF BTW. Een BTW/TVA-lijn is dan enkel informatief en mag je NIET toevoegen (anders tel je dubbel). Voeg enkel een extra kost toe als het eindtotaal duidelijk hoger is dan de som van de items.",
  "",
  "NEGEER volledig (nooit als item opnemen):",
  "- kop- en voettekst: restaurantnaam, adres, logo, openingsuren, BTW-/ondernemingsnummer, telefoon, website, e-mail;",
  "- tafelnummer, ticket-/bonnummer, kassanummer, personeelsnaam, datum en tijd;",
  "- subtotaal, afronding, fooi/tip;",
  "- kortingen en promoties (ook negatieve bedragen): gewoon weglaten;",
  "- betaalregels: BANCONTACT, VISA, MASTERCARD, MAESTRO, CASH, CONTANT, WISSELGELD, RENDU, teruggegeven bedrag;",
  "- bedankjes en slogans (BEDANKT, TOT ZIENS, MERCI, enz.).",
  "",
  'Geef ook "total" terug: het eindtotaal van de rekening in euro (of null als je het niet zeker kan bepalen).',
  "Antwoord uitsluitend in het gevraagde JSON-formaat, zonder extra tekst.",
].join("\n")

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    // Geen sleutel ingesteld -> de app valt automatisch terug op de lokale scan.
    return NextResponse.json({ error: "no_key" }, { status: 501 })
  }

  let imageBase64 = ""
  let mimeType = "image/jpeg"
  try {
    const body = await req.json()
    imageBase64 = body.imageBase64 || ""
    if (body.mimeType) mimeType = body.mimeType
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  if (!imageBase64) return NextResponse.json({ error: "no_image" }, { status: 400 })

  const geminiBody = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                quantity: { type: "integer" },
                unit_price: { type: "number" },
                uncertain: { type: "boolean" },
                note: { type: "string" },
                is_extra_cost: { type: "boolean" },
              },
              required: ["name", "quantity", "unit_price", "uncertain"],
            },
          },
          total: { type: "number", nullable: true },
        },
        required: ["items"],
      },
    },
  }

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      MODEL +
      ":generateContent?key=" +
      apiKey
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      console.error("Gemini-fout:", resp.status, detail)
      return NextResponse.json({ error: "gemini_error", status: resp.status }, { status: 502 })
    }
    const data = await resp.json()
    let text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    // Verwijder eventuele markdown-codefences rond de JSON (backtick via char-code, geen letterlijke backtick).
    const BT = String.fromCharCode(96)
    text = text
      .trim()
      .replace(new RegExp("^" + BT + "+json\\s*", "i"), "")
      .replace(new RegExp("^" + BT + "+"), "")
      .replace(new RegExp(BT + "+$"), "")
      .trim()
    let parsed: { items?: unknown; total?: unknown }
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error("Kon Gemini-JSON niet parsen:", text.slice(0, 500))
      return NextResponse.json({ error: "parse_error" }, { status: 502 })
    }
    const items = Array.isArray(parsed.items) ? parsed.items : []
    const total = typeof parsed.total === "number" ? parsed.total : null
    return NextResponse.json({ items, total })
  } catch (e) {
    console.error("scan-receipt route-fout:", e)
    return NextResponse.json({ error: "exception" }, { status: 500 })
  }
}