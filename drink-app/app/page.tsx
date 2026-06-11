"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

type Group = {
  id: string
  name: string
}

type Drink = {
  id: string
  name: string
  price: number
  emoji: string
}

type Participant = {
  id: string
  name: string
  group_id: string
}

type Order = {
  id: string
  participant_id: string
  drink_id: string
  quantity: number
  group_id: string
  session: number
}

type DrinkForm = {
  name: string
  price: string
  emoji: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, string[]> = {
  Bier: ["pint", "duvel", "leffe", "geuze", "karmeliet", "hoegaarden", "kriek"],
  "Water & Frisdrank": ["cola", "water", "spa", "sprite", "fanta"],
  "Wijn & Cava": ["wijn", "cava"],
  Cocktails: ["cocktail", "mojito", "gin", "whisky", "whiskey"],
}

function categorizeDrink(name: string): string {
  const lower = name.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((k) => lower.includes(k))) return cat
  }
  return "Cocktails"
}

function groupDrinksByCategory(drinks: Drink[]): Record<string, Drink[]> {
  const result: Record<string, Drink[]> = {
    Bier: [],
    "Water & Frisdrank": [],
    "Wijn & Cava": [],
    Cocktails: [],
  }
  drinks.forEach((d) => result[categorizeDrink(d.name)].push(d))
  return result
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AddPersonModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (name: string) => void
}) {
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    if (!name.trim()) return
    onAdd(name.trim())
    onClose()
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
          Persoon toevoegen
        </h3>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Naam..."
          style={{ ...styles.input, width: "100%", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ ...styles.button, ...styles.primary, flex: 1 }} onClick={handleSubmit}>
            Toevoegen
          </button>
          <button style={{ ...styles.button, flex: 1 }} onClick={onClose}>
            Annuleer
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return <div style={styles.toast}>{message}</div>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // ── State ──────────────────────────────────────────────────────────────────
  const [group, setGroup] = useState<Group | null>(null)
  const [groupName, setGroupName] = useState("")
  const [started, setStarted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [session, setSession] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [openPersonHistory, setOpenPersonHistory] = useState<string | null>(null)

  const [newDrink, setNewDrink] = useState<DrinkForm>({ name: "", price: "", emoji: "" })
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)

  const [showAddPerson, setShowAddPerson] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loadingDrink, setLoadingDrink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadDrinks = useCallback(async () => {
    const { data, error } = await supabase.from("drinks").select("*")
    if (error) { setError("Drankjes laden mislukt"); return }
    if (mounted.current) setDrinks(data || [])
  }, [])

  const loadAll = useCallback(async (groupId: string) => {
    const [{ data: p, error: pe }, { data: o, error: oe }] = await Promise.all([
      supabase.from("participants").select("*").eq("group_id", groupId),
      supabase.from("orders").select("*").eq("group_id", groupId),
    ])
    if (pe || oe) { setError("Data laden mislukt"); return }
    if (mounted.current) {
      setParticipants(p || [])
      setOrders(o || [])
    }
  }, [])

  useEffect(() => {
    loadDrinks()
  }, [loadDrinks])

  // ── Realtime subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    if (!group) return

    const channel = supabase
      .channel(`group-${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `group_id=eq.${group.id}` },
        () => { if (mounted.current) loadAll(group.id) }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `group_id=eq.${group.id}` },
        () => { if (mounted.current) loadAll(group.id) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [group, loadAll])

  // ── Group ──────────────────────────────────────────────────────────────────

  const startGroup = async () => {
    if (!groupName.trim() || isStarting) return
    setIsStarting(true)
    try {
      const { data, error } = await supabase
        .from("groups")
        .insert([{ name: groupName.trim() }])
        .select()
        .single()
      if (error || !data) { setError("Groep aanmaken mislukt"); return }
      setGroup(data)
      setStarted(true)
      await loadAll(data.id)
    } finally {
      setIsStarting(false)
    }
  }

  const addPerson = async (name: string) => {
    if (!group) return
    const { error } = await supabase.from("participants").insert([{ name, group_id: group.id }])
    if (error) { setError("Persoon toevoegen mislukt"); return }
    setToast(`${name} toegevoegd`)
    await loadAll(group.id)
  }

  // ── Person select ──────────────────────────────────────────────────────────

  const togglePerson = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    const multi = e.shiftKey || e.ctrlKey || e.metaKey
    setSelected((prev) => {
      if (!multi) return prev.includes(id) && prev.length === 1 ? [] : [id]
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    })
  }

  // ── Drink changes (optimistic) ─────────────────────────────────────────────

  const applyDrinkChange = (
    prevOrders: Order[],
    pid: string,
    drink: Drink,
    delta: number,
    sess: number,
    groupId: string
  ): Order[] => {
    const idx = prevOrders.findIndex(
      (o) => o.participant_id === pid && o.drink_id === drink.id && o.session === sess
    )
    if (delta > 0) {
      if (idx === -1) {
        return [...prevOrders, { id: `temp-${Date.now()}-${pid}`, participant_id: pid, drink_id: drink.id, quantity: 1, group_id: groupId, session: sess }]
      }
      const updated = [...prevOrders]
      updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 }
      return updated
    }
    if (delta < 0 && idx !== -1) {
      const newQty = prevOrders[idx].quantity - 1
      if (newQty <= 0) return prevOrders.filter((_, i) => i !== idx)
      const updated = [...prevOrders]
      updated[idx] = { ...updated[idx], quantity: newQty }
      return updated
    }
    return prevOrders
  }

  const syncDrinkChange = async (
    drink: Drink,
    delta: number,
    pid: string,
    sess: number,
    groupId: string
  ) => {
    const existing = orders.find(
      (o) => o.participant_id === pid && o.drink_id === drink.id && o.session === sess
    )
    if (delta > 0) {
      if (!existing) {
        await supabase.from("orders").insert([{ participant_id: pid, drink_id: drink.id, quantity: 1, group_id: groupId, session: sess }])
      } else {
        await supabase.from("orders").update({ quantity: existing.quantity + 1 }).eq("id", existing.id)
      }
    } else if (delta < 0 && existing) {
      const newQty = existing.quantity - 1
      if (newQty <= 0) {
        await supabase.from("orders").delete().eq("id", existing.id)
      } else {
        await supabase.from("orders").update({ quantity: newQty }).eq("id", existing.id)
      }
    }
  }

  const changeDrink = async (drink: Drink, delta: number, pidOverride?: string) => {
    if (!group) return
    const targets = pidOverride ? [pidOverride] : selected
    if (!targets.length) { setToast("Selecteer eerst een persoon"); return }

    const loadKey = `${drink.id}-${delta}`
    setLoadingDrink(loadKey)

    // Optimistic update
    setOrders((prev) => {
      let next = prev
      for (const pid of targets) next = applyDrinkChange(next, pid, drink, delta, session, group.id)
      return next
    })

    try {
      await Promise.all(targets.map((pid) => syncDrinkChange(drink, delta, pid, session, group.id)))
      await loadAll(group.id)
    } catch {
      setError("Order bijwerken mislukt")
      await loadAll(group.id)
    } finally {
      setLoadingDrink(null)
    }
  }

  const changeDrinkHistory = async (drink: Drink, delta: number, pid: string, round: number) => {
    if (!group) return

    setOrders((prev) => applyDrinkChange(prev, pid, drink, delta, round, group.id))

    try {
      await syncDrinkChange(drink, delta, pid, round, group.id)
      await loadAll(group.id)
    } catch {
      setError("Historiek bijwerken mislukt")
      await loadAll(group.id)
    }
  }

  // ── Drink CRUD ─────────────────────────────────────────────────────────────

  const addDrink = async () => {
    const { name, price, emoji } = newDrink
    if (!name.trim() || !price) { setToast("Vul naam en prijs in"); return }
    const { error } = await supabase.from("drinks").insert([{ name: name.trim(), price: parseFloat(price), emoji: emoji || "🍹" }])
    if (error) { setError("Drank toevoegen mislukt"); return }
    setNewDrink({ name: "", price: "", emoji: "" })
    setToast(`${name} toegevoegd`)
    await loadDrinks()
  }

  const saveEditedDrink = async () => {
    if (!editingDrink) return
    const { error } = await supabase.from("drinks").update({ name: editingDrink.name, price: editingDrink.price, emoji: editingDrink.emoji }).eq("id", editingDrink.id)
    if (error) { setError("Drank opslaan mislukt"); return }
    setEditingDrink(null)
    await loadDrinks()
  }

  const deleteDrink = async (id: string) => {
    if (!confirm("Verwijderen?")) return
    const { error } = await supabase.from("drinks").delete().eq("id", id)
    if (error) { setError("Drank verwijderen mislukt"); return }
    await loadDrinks()
  }

  // ── Computed values ────────────────────────────────────────────────────────

  const getPersonTotal = (pid: string) =>
    orders.filter((o) => o.participant_id === pid).reduce((sum, o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      return sum + (d?.price || 0) * o.quantity
    }, 0)

  const getPersonSessionTotal = (pid: string, sess: number) =>
    orders.filter((o) => o.participant_id === pid && o.session === sess).reduce((sum, o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      return sum + (d?.price || 0) * o.quantity
    }, 0)

  const getRoundTotal = (r: number) =>
    orders.filter((o) => o.session === r).reduce((sum, o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      return sum + (d?.price || 0) * o.quantity
    }, 0)

  const getGlobalTotal = () =>
    orders.reduce((sum, o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      return sum + (d?.price || 0) * o.quantity
    }, 0)

  const getActivePersonDrinks = (pid: string) =>
    orders.filter((o) => o.participant_id === pid && o.session === session).reduce((acc: (Drink & { qty: number })[], o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      if (!d) return acc
      const ex = acc.find((x) => x.id === d.id)
      if (ex) { ex.qty += o.quantity; return acc }
      return [...acc, { ...d, qty: o.quantity }]
    }, [])

  const getRoundGrouped = (r: number) => {
    const map: Record<string, { drink: Drink; totalQty: number; people: Record<string, { name: string; qty: number }> }> = {}
    orders.filter((o) => o.session === r).forEach((o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      const p = participants.find((pa) => pa.id === o.participant_id)
      if (!d || !p) return
      if (!map[d.id]) map[d.id] = { drink: d, totalQty: 0, people: {} }
      map[d.id].totalQty += o.quantity
      if (!map[d.id].people[p.id]) map[d.id].people[p.id] = { name: p.name, qty: 0 }
      map[d.id].people[p.id].qty += o.quantity
    })
    return map
  }

  const getPersonRoundsHistory = (pid: string) => {
    const per = orders.filter((o) => o.participant_id === pid)
    const ids = Array.from(new Set(per.map((o) => o.session))).sort((a, b) => a - b)
    return ids.map((r) => {
      const items = per.filter((o) => o.session === r).map((o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)
        return d ? { drink: d, quantity: o.quantity, subtotal: d.price * o.quantity } : null
      }).filter(Boolean) as { drink: Drink; quantity: number; subtotal: number }[]
      return { roundId: r, items, roundTotal: items.reduce((s, i) => s + i.subtotal, 0) }
    })
  }

  const sessions = Array.from(new Set(orders.map((o) => o.session))).sort((a, b) => a - b)
  const nextSession = Math.max(session, ...sessions, 0) + 1

  const newRound = () => {
    setSession(nextSession)
    setSelected([])
    setToast(`Ronde ${nextSession} gestart`)
  }

  const groupedDrinks = groupDrinksByCategory(drinks)

  // ─── Start screen ──────────────────────────────────────────────────────────

  if (!started) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, maxWidth: 420, margin: "80px auto", textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🍺</div>
          <h2 style={{ ...styles.title, marginBottom: 8 }}>Rondje Bijhouden</h2>
          <p style={{ color: "#888", marginBottom: 28, fontSize: 14 }}>
            Maak een groep aan en begin met bestellen
          </p>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startGroup()}
            placeholder="Groepsnaam (bv. Vrijdagavond)"
            style={{ ...styles.input, width: "100%", boxSizing: "border-box", marginBottom: 12 }}
          />
          <button
            style={{ ...styles.button, ...styles.primary, width: "100%", padding: "12px 0", fontSize: 16 }}
            onClick={startGroup}
            disabled={isStarting}
          >
            {isStarting ? "Laden..." : "Start groep"}
          </button>
        </div>
      </div>
    )
  }

  // ─── Main ──────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#c0392b", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Modal */}
      {showAddPerson && (
        <AddPersonModal onClose={() => setShowAddPerson(false)} onAdd={addPerson} />
      )}

      {/* Header */}
      <div style={{ ...styles.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={styles.title}>🍻 {group?.name}</h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#333" }}>
            €{getGlobalTotal().toFixed(2)}
          </span>
          <span style={{ fontSize: 12, color: "#888" }}>
            Ronde {session}: €{getRoundTotal(session).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, margin: "16px 0" }}>
        <button style={{ ...styles.button, ...styles.primary }} onClick={() => setShowAddPerson(true)}>
          + Persoon
        </button>
        <button style={styles.button} onClick={newRound}>
          🔄 Nieuwe ronde ({session} → {nextSession})
        </button>
      </div>

      {/* Persons */}
      <div style={styles.section}>
        <h3 style={styles.h3}>
          👤 Personen
          {selected.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "#4f7ef7", marginLeft: 10 }}>
              {selected.length} geselecteerd — klik op een drank om te bestellen
            </span>
          )}
        </h3>

        {participants.length === 0 && (
          <div style={{ ...styles.card, color: "#999", textAlign: "center", padding: 32 }}>
            Nog geen personen. Voeg er een toe!
          </div>
        )}

        {participants.map((p) => {
          const isSelected = selected.includes(p.id)
          const sessionDrinks = getActivePersonDrinks(p.id)

          return (
            <div
              key={p.id}
              style={{
                ...styles.card,
                border: isSelected ? "2px solid #4f7ef7" : "1px solid rgba(0,0,0,0.06)",
                padding: isSelected ? 15 : 16,
                transition: "border 0.15s, background 0.15s",
              }}
            >
              <div
                onClick={(e) => togglePerson(p.id, e)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  background: isSelected ? "rgba(79,126,247,0.07)" : "transparent",
                  borderRadius: 10,
                  padding: "6px 8px",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isSelected && <span style={{ fontSize: 12, color: "#4f7ef7" }}>✓</span>}
                  <b style={{ fontSize: 15 }}>{p.name}</b>
                </div>

                <div style={{ flex: 1, marginLeft: 12, fontSize: 13, color: "#555" }}>
                  {sessionDrinks.map((d) => (
                    <span key={d.id} style={{ marginRight: 10 }}>
                      {d.emoji} {d.name} × {d.qty}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      €{getPersonTotal(p.id).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>
                      ronde: €{getPersonSessionTotal(p.id, session).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenPersonHistory((h) => h === p.id ? null : p.id) }}
                    style={styles.iconButton}
                    title="Historiek"
                  >
                    📋
                  </button>
                </div>
              </div>

              {openPersonHistory === p.id && (
                <div style={styles.dropPanel}>
                  <b style={{ fontSize: 14 }}>Historiek {p.name}</b>
                  {getPersonRoundsHistory(p.id).length === 0 && (
                    <div style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>Geen bestellingen</div>
                  )}
                  {getPersonRoundsHistory(p.id).map((r) => (
                    <div key={r.roundId} style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#444" }}>
                        Ronde {r.roundId} — €{r.roundTotal.toFixed(2)}
                      </div>
                      {r.items.map((it, i) => (
                        <div key={i} style={{ fontSize: 12, marginLeft: 12, marginTop: 2, color: "#666" }}>
                          {it.drink.emoji} {it.drink.name} × {it.quantity} = €{it.subtotal.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Drinks */}
      <div style={styles.section}>
        <h3 style={styles.h3}>🍹 Drankjes</h3>

        {Object.entries(groupedDrinks).map(([cat, list]) => {
          if (list.length === 0) return null
          return (
            <div key={cat} style={styles.card}>
              <b style={{ display: "block", marginBottom: 10, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, color: "#888" }}>
                {cat}
              </b>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {list.map((d: Drink) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {editingDrink?.id === d.id ? (
                      <>
                        <input
                          value={editingDrink.emoji}
                          onChange={(e) => setEditingDrink({ ...editingDrink, emoji: e.target.value })}
                          style={{ ...styles.input, width: 52 }}
                        />
                        <input
                          value={editingDrink.name}
                          onChange={(e) => setEditingDrink({ ...editingDrink, name: e.target.value })}
                          style={{ ...styles.input, width: 120 }}
                        />
                        <input
                          type="number"
                          value={editingDrink.price}
                          onChange={(e) => setEditingDrink({ ...editingDrink, price: parseFloat(e.target.value) || 0 })}
                          style={{ ...styles.input, width: 70 }}
                        />
                        <button style={{ ...styles.button, ...styles.primary }} onClick={saveEditedDrink}>💾</button>
                        <button style={styles.button} onClick={() => setEditingDrink(null)}>✖</button>
                      </>
                    ) : (
                      <>
                        <button
                          style={styles.iconButton}
                          onClick={() => changeDrink(d, -1)}
                          disabled={loadingDrink !== null}
                        >
                          ➖
                        </button>
                        <button
                          style={{
                            ...styles.button,
                            fontSize: 13,
                            opacity: loadingDrink !== null ? 0.7 : 1,
                            transition: "opacity 0.15s",
                          }}
                          onClick={() => changeDrink(d, 1)}
                          disabled={loadingDrink !== null}
                        >
                          {d.emoji} {d.name}
                          <span style={{ color: "#888", marginLeft: 4 }}>€{d.price.toFixed(2)}</span>
                        </button>
                        <button style={styles.iconButton} onClick={() => setEditingDrink(d)} title="Bewerken">✏️</button>
                        <button style={styles.iconButton} onClick={() => deleteDrink(d.id)} title="Verwijderen">🗑️</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Add drink */}
        <div style={styles.card}>
          <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: "#555" }}>+ Nieuwe drank</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Naam"
              value={newDrink.name}
              onChange={(e) => setNewDrink({ ...newDrink, name: e.target.value })}
              style={{ ...styles.input, width: 140 }}
            />
            <input
              type="number"
              placeholder="Prijs €"
              value={newDrink.price}
              onChange={(e) => setNewDrink({ ...newDrink, price: e.target.value })}
              style={{ ...styles.input, width: 90 }}
            />
            <input
              placeholder="Emoji 🍹"
              value={newDrink.emoji}
              onChange={(e) => setNewDrink({ ...newDrink, emoji: e.target.value })}
              style={{ ...styles.input, width: 80 }}
            />
            <button
              onClick={addDrink}
              style={{ ...styles.button, ...styles.primary }}
            >
              Toevoegen
            </button>
          </div>
        </div>
      </div>

      {/* Round history */}
      <div style={styles.section}>
        <h3 style={styles.h3}>📦 Ronde historiek</h3>

        {sessions.length === 0 && (
          <div style={{ ...styles.card, color: "#999", textAlign: "center", padding: 24 }}>
            Nog geen bestellingen geplaatst.
          </div>
        )}

        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {sessions.map((s) => (
            <div key={s} style={{ ...styles.card, minWidth: 280, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b style={{ fontSize: 15 }}>Ronde {s}</b>
                <span style={{ fontWeight: 700, color: "#4f7ef7" }}>€{getRoundTotal(s).toFixed(2)}</span>
              </div>

              {Object.values(getRoundGrouped(s)).map((it) => (
                <div key={it.drink.id} style={{ marginTop: 10 }}>
                  <b style={{ fontSize: 13 }}>
                    {it.drink.emoji} {it.drink.name} × {it.totalQty}
                  </b>
                  <div style={{ marginLeft: 10, marginTop: 4 }}>
                    {Object.entries(it.people).map(([pid, info]) => (
                      <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginTop: 2 }}>
                        <span style={{ color: "#555" }}>{info.name} × {info.qty}</span>
                        <div>
                          <button style={styles.iconButton} onClick={() => changeDrinkHistory(it.drink, -1, pid, s)}>➖</button>
                          <button style={styles.iconButton} onClick={() => changeDrinkHistory(it.drink, 1, pid, s)}>➕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Footer total */}
      <div style={{ textAlign: "right", marginTop: 32, paddingBottom: 40 }}>
        <h3 style={{ fontSize: 22, color: "#333", fontWeight: 700 }}>
          💰 Totaal: €{getGlobalTotal().toFixed(2)}
        </h3>
        <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
          {participants.length} personen · {sessions.length} rondes · {orders.reduce((s, o) => s + o.quantity, 0)} drankjes
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    background: "linear-gradient(145deg,#f0f4ff,#e8eeff,#f8fafc)",
    minHeight: "100vh",
    color: "#222",
    maxWidth: 960,
    margin: "0 auto",
  },
  card: {
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 16,
    backdropFilter: "blur(14px)",
    padding: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
    marginBottom: 12,
  },
  button: {
    border: "1px solid rgba(0,0,0,0.09)",
    background: "#fff",
    borderRadius: 10,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 14,
    transition: "opacity 0.15s",
  },
  primary: {
    background: "linear-gradient(90deg,#4f7ef7,#6ba1ff)",
    color: "white",
    border: "none",
    boxShadow: "0 4px 14px rgba(79,126,247,0.3)",
  },
  iconButton: {
    border: "none",
    background: "rgba(0,0,0,0.04)",
    borderRadius: "50%",
    width: 28,
    height: 28,
    fontSize: 14,
    cursor: "pointer",
    marginLeft: 4,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 28,
  },
  h3: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  input: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  dropPanel: {
    marginTop: 10,
    background: "rgba(248,250,255,0.9)",
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(79,126,247,0.1)",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff",
    borderRadius: 20,
    padding: 28,
    width: 360,
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },
  toast: {
    position: "fixed",
    bottom: 28,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#222",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 40,
    fontSize: 14,
    fontWeight: 500,
    zIndex: 2000,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    whiteSpace: "nowrap",
  },
  errorBanner: {
    background: "#fff0f0",
    border: "1px solid #fcc",
    color: "#c0392b",
    borderRadius: 12,
    padding: "10px 16px",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    fontSize: 14,
  },
}
