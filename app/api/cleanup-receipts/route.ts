// app/api/cleanup-receipts/route.ts
//
// Verwijdert bonnetjes-foto's die meer dan 48u geleden zijn afgerekend en sindsdien
// niet heropend. Draait op de server met de service-role sleutel (de enige die bestanden
// uit Storage mag wissen). Beveiligd met een geheim, zodat alleen de cron hem aanroept.
//
// De cron (pg_cron in Supabase) roept deze route aan; die roept op zijn beurt de
// Storage API aan om zowel het bestand als de databank-rij netjes op te ruimen.

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const runtime = "nodejs"          // service-role hoort NIET in een edge-omgeving
export const dynamic = "force-dynamic"   // nooit cachen

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  // 1) Beveiliging: alleen wie het geheim kent, mag deze route draaien. Het geheim
  //    mag in de Authorization-header (zo roept de cron aan) OF als ?key= in de URL
  //    (handig om even met een browser-link te testen).
  const secret = process.env.CLEANUP_SECRET
  const auth = req.headers.get("authorization") || ""
  const urlKey = new URL(req.url).searchParams.get("key") || ""
  const ok = !!secret && (auth === `Bearer ${secret}` || urlKey === secret)
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "missing env" }, { status: 500 })
  }

  // Service-role client: mag alles, draait alleen hier op de server.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 2) Welke groepen zijn meer dan 48u geleden afgerekend en niet heropend?
  //    finalized_at wordt gezet bij afrekenen en op null gezet bij heropenen, dus dit
  //    respecteert automatisch het "heropenen reset de klok"-principe.
  const grens = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: groepen, error: qErr } = await admin
    .from("table_groups")
    .select("id, receipt_url")
    .eq("finalized", true)
    .not("finalized_at", "is", null)
    .lt("finalized_at", grens)
    .not("receipt_url", "is", null)

  if (qErr) {
    return NextResponse.json({ error: "query failed", detail: qErr.message }, { status: 500 })
  }
  if (!groepen || groepen.length === 0) {
    return NextResponse.json({ ok: true, groepen: 0, bestanden: 0 })
  }

  let verwijderd = 0
  const fouten: string[] = []

  // 3) Per groep: alle foto's in de map <group_id>/ opzoeken en verwijderen.
  //    Foto's zijn opgeslagen als "<group_id>/<timestamp>-<n>.<ext>".
  for (const g of groepen) {
    const gid = g.id as string
    // Lijst de bestanden in de map van deze groep.
    const { data: files, error: listErr } = await admin.storage
      .from("receipts")
      .list(gid, { limit: 1000 })
    if (listErr) { fouten.push(`list ${gid}: ${listErr.message}`); continue }

    if (files && files.length > 0) {
      const paden = files.map((f) => `${gid}/${f.name}`)
      const { error: rmErr } = await admin.storage.from("receipts").remove(paden)
      if (rmErr) { fouten.push(`remove ${gid}: ${rmErr.message}`); continue }
      verwijderd += paden.length
    }

    // De verwijzing leegmaken zodat de app niet naar een verdwenen foto wijst.
    const { error: updErr } = await admin
      .from("table_groups")
      .update({ receipt_url: null })
      .eq("id", gid)
    if (updErr) fouten.push(`update ${gid}: ${updErr.message}`)
  }

  return NextResponse.json({
    ok: fouten.length === 0,
    groepen: groepen.length,
    bestanden: verwijderd,
    fouten: fouten.length ? fouten : undefined,
  })
}

