import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// Het model. Gemini 2.5 Flash-Lite is de goedkoopste actieve optie met beeldherkenning.
// Werkt dit model (nog) niet op jouw sleutel, verander dan enkel deze regel, bv. naar
// "gemini-2.0-flash" of "gemini-2.5-flash".
const MODEL = "gemini-2.5-flash-lite"

const PROMPT = `Je krijgt een foto van een restaurant- of caférekening (Belgisch, meestal Nederlands of Frans).
Haal ALLEEN de bestelde consumpties eruit: eten en drank (ook afkortingen daarvan).
Geef per lijn:
- "name": de naam van het item. Schrijf een duidelijke afkorting voluit (bv. "Spag. Bol." -> "Spaghetti Bolognese"); is het niet duidelijk, laat dan de tekst zoals ze staat.
- "quantity": het aantal (geheel getal, minstens 1).
- "unit_price": de prijs PER STUK in euro (getal). Staat op de bon enkel de lijntotaal en is het aantal groter dan 1, deel dan de lijntotaal door het aantal.

Negeer volledig: datum, tijd, adres, tafelnummer, BTW/TVA-lijnen, subtotaal, kortingen, fooi/tip, afronding, betaalinfo, kaartgegevens en bedankjes.
Geef ook "total" terug: het eindtotaal van de rekening in euro (of null als je het niet zeker kan bepalen).
Antwoord uitsluitend in het gevraagde JSON-formaat, zonder extra tekst.`

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
              type: