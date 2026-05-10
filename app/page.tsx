"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"

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

export default function Home() {
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const [group, setGroup] = useState<any>(null)
  const [groupName, setGroupName] = useState("")
  const [started, setStarted] = useState(false)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [drinks, setDrinks] = useState<Drink[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [session, setSession] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [openPersonHistory, setOpenPersonHistory] = useState<string | null>(null)

  const [newDrink, setNewDrink] = useState({
    name: "",
    price: "",
    emoji: "",
  })

  const [editingDrink, setEditingDrink] = useState<Drink | null>(null)

  // ---------------- LOADERS ----------------

  const loadDrinks = useCallback(async () => {
    const { data } = await supabase.from("drinks").select("*")

    if (mounted.current) {
      setDrinks(data || [])
    }
  }, [])

  const loadAll = useCallback(async (groupId: string) => {
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from("participants").select("*").eq("group_id", groupId),
      supabase.from("orders").select("*").eq("group_id", groupId),
    ])

    if (mounted.current) {
      setParticipants(p || [])
      setOrders(o || [])
    }
  }, [])

  useEffect(() => {
    loadDrinks()
  }, [loadDrinks])

  // ---------------- GROUP ----------------

  const startGroup = async () => {
    if (!groupName.trim()) return

    const { data } = await supabase
      .from("groups")
      .insert([{ name: groupName.trim() }])
      .select()
      .single()

    setGroup(data)
    setStarted(true)

    loadAll(data.id)
  }

  const addPerson = async () => {
    const name = prompt("Naam?")

    if (!name?.trim() || !group) return

    await supabase.from("participants").insert([
      {
        name: name.trim(),
        group_id: group.id,
      },
    ])

    loadAll(group.id)
  }

  // ---------------- PERSON SELECT ----------------

  const togglePerson = (
    id: string,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const multi = e.shiftKey || e.ctrlKey || e.metaKey

    setSelected((prev) => {
      if (!multi) return [id]

      return prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    })
  }

  // ---------------- DRINK CHANGES ----------------

  async function changeDrink(
    drink: Drink,
    delta: number,
    pidOverride?: string
  ) {
    if (!group) return

    const targets = pidOverride ? [pidOverride] : selected

    if (!targets.length) return

    for (const pid of targets) {
      const existing = orders.find(
        (o) =>
          o.participant_id === pid &&
          o.drink_id === drink.id &&
          o.session === session
      )

      if (delta > 0) {
        if (!existing) {
          await supabase.from("orders").insert([
            {
              participant_id: pid,
              drink_id: drink.id,
              quantity: 1,
              group_id: group.id,
              session,
            },
          ])
        } else {
          await supabase
            .from("orders")
            .update({
              quantity: existing.quantity + 1,
            })
            .eq("id", existing.id)
        }
      }

      if (delta < 0 && existing) {
        const newQty = existing.quantity - 1

        if (newQty <= 0) {
          await supabase.from("orders").delete().eq("id", existing.id)
        } else {
          await supabase
            .from("orders")
            .update({
              quantity: newQty,
            })
            .eq("id", existing.id)
        }
      }
    }

    loadAll(group.id)
  }

  async function changeDrinkHistory(
    drink: Drink,
    delta: number,
    pid: string,
    round: number
  ) {
    if (!group) return

    const existing = orders.find(
      (o) =>
        o.participant_id === pid &&
        o.drink_id === drink.id &&
        o.session === round
    )

    if (delta > 0) {
      if (!existing) {
        await supabase.from("orders").insert([
          {
            participant_id: pid,
            drink_id: drink.id,
            quantity: 1,
            group_id: group.id,
            session: round,
          },
        ])
      } else {
        await supabase
          .from("orders")
          .update({
            quantity: existing.quantity + 1,
          })
          .eq("id", existing.id)
      }
    }

    if (delta < 0 && existing) {
      const newQty = existing.quantity - 1

      if (newQty <= 0) {
        await supabase.from("orders").delete().eq("id", existing.id)
      } else {
        await supabase
          .from("orders")
          .update({
            quantity: newQty,
          })
          .eq("id", existing.id)
      }
    }

    loadAll(group.id)
  }

  // ---------------- DRINK CRUD ----------------

  async function addDrink() {
    const { name, price, emoji } = newDrink

    if (!name.trim() || !price) {
      alert("Vul naam en prijs in")
      return
    }

    await supabase.from("drinks").insert([
      {
        name: name.trim(),
        price: parseFloat(price),
        emoji: emoji || "🍹",
      },
    ])

    setNewDrink({
      name: "",
      price: "",
      emoji: "",
    })

    loadDrinks()
  }

  async function saveEditedDrink() {
    if (!editingDrink) return

    await supabase
      .from("drinks")
      .update({
        name: editingDrink.name,
        price: editingDrink.price,
        emoji: editingDrink.emoji,
      })
      .eq("id", editingDrink.id)

    setEditingDrink(null)

    loadDrinks()
  }

  async function deleteDrink(id: string) {
    if (!confirm("Verwijderen?")) return

    await supabase.from("drinks").delete().eq("id", id)

    loadDrinks()
  }

  // ---------------- HELPERS ----------------

  const groupedDrinks = () => {
    const g: Record<string, Drink[]> = {
      Bier: [],
      "Water & Frisdrank": [],
      "Wijn & Cava": [],
      Cocktails: [],
    }

    drinks.forEach((d) => {
      const n = d.name.toLowerCase()

      if (
        ["pint", "duvel", "leffe", "geuze", "karmeliet", "hoegaarden", "kriek"].some((x) =>
          n.includes(x)
        )
      ) {
        g.Bier.push(d)
      } else if (
        ["cocktail", "mojito", "gin", "whisky", "whiskey"].some((x) =>
          n.includes(x)
        )
      ) {
        g.Cocktails.push(d)
      } else if (
        ["cola", "water", "spa", "sprite", "fanta"].some((x) =>
          n.includes(x)
        )
      ) {
        g["Water & Frisdrank"].push(d)
      } else if (["wijn", "cava"].some((x) => n.includes(x))) {
        g["Wijn & Cava"].push(d)
      } else {
        g.Cocktails.push(d)
      }
    })

    return g
  }

  const getPersonTotal = (pid: string) =>
    orders
      .filter((o) => o.participant_id === pid)
      .reduce((sum, o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)
        return sum + (d?.price || 0) * o.quantity
      }, 0)

  const getRoundTotal = (r: number) =>
    orders
      .filter((o) => o.session === r)
      .reduce((sum, o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)
        return sum + (d?.price || 0) * o.quantity
      }, 0)

  const getGlobalTotal = () =>
    orders.reduce((sum, o) => {
      const d = drinks.find((dr) => dr.id === o.drink_id)
      return sum + (d?.price || 0) * o.quantity
    }, 0)

  const getActivePersonDrinks = (pid: string) =>
    orders
      .filter(
        (o) => o.participant_id === pid && o.session === session
      )
      .reduce((acc: any[], o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)

        if (!d) return acc

        const ex = acc.find((x) => x.id === d.id)

        if (ex) ex.qty += o.quantity
        else acc.push({ ...d, qty: o.quantity })

        return acc
      }, [])

  const getRoundGrouped = (r: number) => {
    const map: any = {}

    orders
      .filter((o) => o.session === r)
      .forEach((o) => {
        const d = drinks.find((dr) => dr.id === o.drink_id)
        const p = participants.find(
          (pa) => pa.id === o.participant_id
        )

        if (!d || !p) return

        if (!map[d.id]) {
          map[d.id] = {
            drink: d,
            totalQty: 0,
            people: {},
          }
        }

        map[d.id].totalQty += o.quantity

        if (!map[d.id].people[p.id]) {
          map[d.id].people[p.id] = {
            name: p.name,
            qty: 0,
          }
        }

        map[d.id].people[p.id].qty += o.quantity
      })

    return map
  }

  const getPersonRoundsHistory = (pid: string) => {
    const per = orders.filter(
      (o) => o.participant_id === pid
    )

    const ids = Array.from(
      new Set(per.map((o) => o.session))
    ).sort((a, b) => a - b)

    return ids.map((r) => {
      const items = per
        .filter((o) => o.session === r)
        .map((o) => {
          const d = drinks.find(
            (dr) => dr.id === o.drink_id
          )

          return d
            ? {
                drink: d,
                quantity: o.quantity,
                subtotal: d.price * o.quantity,
              }
            : null
        })
        .filter(Boolean) as any[]

      const tot = items.reduce(
        (s, i) => s + i.subtotal,
        0
      )

      return {
        roundId: r,
        items,
        roundTotal: tot,
      }
    })
  }

  const sessions = Array.from(
    new Set(orders.map((o) => o.session))
  ).sort((a, b) => a - b)

  const newRound = () => {
    setSession((s) => s + 1)
    setSelected([])
  }

  // ---------------- START SCREEN ----------------

  if (!started) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>🍺 Nieuwe groep</h2>

          <input
            value={groupName}
            onChange={(e) =>
              setGroupName(e.target.value)
            }
            placeholder="Groepsnaam"
            style={styles.input}
          />

          <button
            style={{
              ...styles.button,
              ...styles.primary,
            }}
            onClick={startGroup}
          >
            Start
          </button>
        </div>
      </div>
    )
  }

  // ---------------- MAIN ----------------

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.card,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={styles.title}>
          🍻 {group?.name}
        </h2>

        <div
          style={{
            fontWeight: 600,
            color: "#555",
          }}
        >
          🧾 Ronde: €
          {getRoundTotal(session).toFixed(2)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          margin: "20px 0",
        }}
      >
        <button
          style={{
            ...styles.button,
            ...styles.primary,
          }}
          onClick={addPerson}
        >
          + Persoon
        </button>

        <button
          style={styles.button}
          onClick={newRound}
        >
          🔄 Nieuwe ronde {session}
        </button>
      </div>

      {/* PERSONEN */}

      <div style={styles.section}>
        <h3 style={styles.h3}>👤 Personen</h3>

        {participants.map((p) => (
          <div key={p.id} style={styles.card}>
            <div
              onClick={(e) =>
                togglePerson(p.id, e)
              }
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                background: selected.includes(p.id)
                  ? "rgba(79,126,247,0.12)"
                  : "transparent",
                borderRadius: 12,
                padding: "8px 10px",
              }}
            >
              <b>{p.name}</b>

              <div
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 13,
                }}
              >
                {getActivePersonDrinks(p.id).map(
                  (d) => (
                    <span
                      key={d.id}
                      style={{
                        marginRight: 10,
                      }}
                    >
                      {d.emoji} {d.name} × {d.qty}
                    </span>
                  )
                )}
              </div>

              <b>
                €
                {getPersonTotal(p.id).toFixed(2)}
              </b>

              <button
                onClick={(e) => {
                  e.stopPropagation()

                  setOpenPersonHistory((h) =>
                    h === p.id ? null : p.id
                  )
                }}
                style={styles.iconButton}
              >
                📋
              </button>
            </div>

            {openPersonHistory === p.id && (
              <div style={styles.dropPanel}>
                <b>Historiek {p.name}</b>

                {getPersonRoundsHistory(p.id).map(
                  (r) => (
                    <div
                      key={r.roundId}
                      style={{ marginTop: 6 }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                        }}
                      >
                        Ronde {r.roundId} — €
                        {r.roundTotal.toFixed(2)}
                      </div>

                      {r.items.map(
                        (it: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              fontSize: 12,
                              marginLeft: 10,
                            }}
                          >
                            {it.drink.emoji}{" "}
                            {it.drink.name} ×{" "}
                            {it.quantity} = €
                            {it.subtotal.toFixed(2)}
                          </div>
                        )
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* DRANKJES */}

      <div style={styles.section}>
        <h3 style={styles.h3}>🍹 Drankjes</h3>

        {Object.entries(groupedDrinks()).map(
          ([cat, list]) => (
            <div key={cat} style={styles.card}>
              <b
                style={{
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {cat}
              </b>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {list.map((d: Drink) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {editingDrink?.id === d.id ? (
                      <>
                        <input
                          value={editingDrink.emoji}
                          onChange={(e) =>
                            setEditingDrink({
                              ...editingDrink,
                              emoji:
                                e.target.value,
                            })
                          }
                          style={{
                            ...styles.input,
                            width: 50,
                          }}
                        />

                        <input
                          value={editingDrink.name}
                          onChange={(e) =>
                            setEditingDrink({
                              ...editingDrink,
                              name: e.target.value,
                            })
                          }
                          style={{
                            ...styles.input,
                            width: 120,
                          }}
                        />

                        <input
                          type="number"
                          value={
                            editingDrink.price
                          }
                          onChange={(e) =>
                            setEditingDrink({
                              ...editingDrink,
                              price:
                                parseFloat(
                                  e.target.value
                                ) || 0,
                            })
                          }
                          style={{
                            ...styles.input,
                            width: 70,
                          }}
                        />

                        <button
                          style={{
                            ...styles.button,
                            ...styles.primary,
                          }}
                          onClick={
                            saveEditedDrink
                          }
                        >
                          💾
                        </button>

                        <button
                          style={styles.button}
                          onClick={() =>
                            setEditingDrink(null)
                          }
                        >
                          ✖
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={
                            styles.iconButton
                          }
                          onClick={() =>
                            changeDrink(d, -1)
                          }
                        >
                          ➖
                        </button>

                        <button
                          style={{
                            ...styles.button,
                            fontSize: 13,
                          }}
                          onClick={() =>
                            changeDrink(d, 1)
                          }
                        >
                          {d.emoji} {d.name} (€{d.price})
                        </button>

                        <button
                          style={
                            styles.iconButton
                          }
                          onClick={() =>
                            setEditingDrink(d)
                          }
                        >
                          ✏️
                        </button>

                        <button
                          style={
                            styles.iconButton
                          }
                          onClick={() =>
                            deleteDrink(d.id)
                          }
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* NIEUWE DRANK */}

        <div style={styles.card}>
          <h4 style={{ marginBottom: 8 }}>
            + Nieuwe drank
          </h4>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              placeholder="Naam"
              value={newDrink.name}
              onChange={(e) =>
                setNewDrink({
                  ...newDrink,
                  name: e.target.value,
                })
              }
              style={{
                ...styles.input,
                width: 140,
              }}
            />

            <input
              type="number"
              placeholder="Prijs €"
              value={newDrink.price}
              onChange={(e) =>
                setNewDrink({
                  ...newDrink,
                  price: e.target.value,
                })
              }
              style={{
                ...styles.input,
                width: 90,
              }}
            />

            <input
              placeholder="Emoji 🍹"
              value={newDrink.emoji}
              onChange={(e) =>
                setNewDrink({
                  ...newDrink,
                  emoji: e.target.value,
                })
              }
              style={{
                ...styles.input,
                width: 80,
              }}
            />

            <button
              onClick={addDrink}
              style={{
                ...styles.button,
                ...styles.primary,
              }}
            >
              Toevoegen
            </button>
          </div>
        </div>
      </div>

      {/* HISTORIEK */}

      <div style={styles.section}>
        <h3 style={styles.h3}>
          📦 Ronde historiek
        </h3>

        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
          }}
        >
          {sessions.map((s) => (
            <div
              key={s}
              style={{
                ...styles.card,
                minWidth: 300,
              }}
            >
              <b>
                Ronde {s} — €
                {getRoundTotal(s).toFixed(2)}
              </b>

              {Object.values(
                getRoundGrouped(s)
              ).map((it: any) => (
                <div
                  key={it.drink.id}
                  style={{ marginTop: 8 }}
                >
                  <b>
                    {it.drink.emoji}{" "}
                    {it.drink.name} ×{" "}
                    {it.totalQty}
                  </b>

                  <div
                    style={{
                      marginLeft: 10,
                      fontSize: 12,
                    }}
                  >
                    {Object.entries(
                      it.people
                    ).map(
                      ([pid, info]: any) => (
                        <div
                          key={pid}
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                          }}
                        >
                          <span>
                            {info.name} ×{" "}
                            {info.qty}
                          </span>

                          <div>
                            <button
                              style={
                                styles.iconButton
                              }
                              onClick={() =>
                                changeDrinkHistory(
                                  it.drink,
                                  -1,
                                  pid,
                                  s
                                )
                              }
                            >
                              ➖
                            </button>

                            <button
                              style={
                                styles.iconButton
                              }
                              onClick={() =>
                                changeDrinkHistory(
                                  it.drink,
                                  1,
                                  pid,
                                  s
                                )
                              }
                            >
                              ➕
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* TOTAAL */}

      <div
        style={{
          textAlign: "right",
          marginTop: 30,
        }}
      >
        <h3
          style={{
            fontSize: 20,
            color: "#333",
          }}
        >
          💰 Totaal: €
          {getGlobalTotal().toFixed(2)}
        </h3>
      </div>
    </div>
  )
}

const styles: Record<string, any> = {
  container: {
    padding: 24,
    fontFamily: "Inter,sans-serif",
    background:
      "linear-gradient(145deg,#f3f6fb,#dee6f9,#f8fafc)",
    minHeight: "100vh",
    color: "#222",
  },

  card: {
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: 16,
    backdropFilter: "blur(14px)",
    padding: 16,
    boxShadow:
      "0 8px 28px rgba(0,0,0,0.06)",
    transition: "0.2s",
    marginBottom: 12,
  },

  button: {
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    borderRadius: 12,
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: 14,
  },

  primary: {
    background:
      "linear-gradient(90deg,#4f7ef7,#6ba1ff)",
    color: "white",
    border: "none",
    boxShadow:
      "0 4px 14px rgba(79,126,247,0.35)",
  },

  iconButton: {
    border: "none",
    background: "rgba(255,255,255,0.6)",
    borderRadius: "50%",
    width: 26,
    height: 26,
    fontSize: 14,
    cursor: "pointer",
    marginLeft: 4,
  },

  section: {
    marginTop: 24,
  },

  h3: {
    fontSize: 18,
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.3,
  },

  input: {
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 14,
  },

  dropPanel: {
    marginTop: 8,
    background: "rgba(255,255,255,0.6)",
    borderRadius: 12,
    padding: 10,
    border: "1px solid rgba(0,0,0,0.05)",
  },
}
