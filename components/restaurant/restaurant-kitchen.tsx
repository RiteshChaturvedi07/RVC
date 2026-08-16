'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'
import { printThermalKOT } from '@/lib/print-engine'

type Order = {
  id: string
  order_number: number
  status: string
  created_at: string
  dining_type?: 'dine_in' | 'takeaway'
  notes?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  restaurant_tables?: { table_number: string } | null
  restaurant_order_items: { item_name: string; quantity: number; notes?: string | null }[]
}

const nextStatus = (status: string) =>
  status === 'new' ? 'accepted' : status === 'accepted' ? 'preparing' : status === 'preparing' ? 'ready' : 'served'

const action = (status: string) =>
  status === 'ready' ? 'Mark served' : status === 'preparing' ? 'Mark ready' : 'Start preparing'

export function RestaurantKitchen() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const tenant = await currentRestaurantTenant()
      const { data, error } = await createClient()
        .from('restaurant_orders')
        .select(
          'id,order_number,status,created_at,dining_type,notes,customer_name,customer_phone,restaurant_tables(table_number),restaurant_order_items(item_name,quantity,notes)'
        )
        .eq('tenant_id', tenant)
        .order('created_at', { ascending: true })

      if (error) throw error
      setOrders((data ?? []) as unknown as Order[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load kitchen queue')
    }
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 10000)
    return () => clearInterval(interval)
  }, [])

  const update = async (order: Order) => {
    const { error } = await createClient()
      .from('restaurant_orders')
      .update({ status: nextStatus(order.status), updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (error) alert(error.message)
    else void load()
  }

  const handlePrintKOT = (order: Order) => {
    printThermalKOT({
      restaurant: 'Kitchen Display',
      table: order.restaurant_tables?.table_number || '—',
      orderNumber: order.order_number,
      createdAt: order.created_at,
      diningType: order.dining_type,
      items: order.restaurant_order_items.map((item) => ({
        name: item.item_name,
        quantity: item.quantity,
        notes: item.notes,
      })),
    })
  }

  if (!orders) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed text-muted-foreground">
        {error || 'Loading kitchen queue…'}
      </div>
    )
  }

  const active = orders.filter((order) => !['served', 'completed', 'closed', 'cancelled'].includes(order.status))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold">Kitchen display</h2>
        <p className="mt-1 text-muted-foreground">
          Live QR orders refresh every 10 seconds. Dine-in, takeaway and cooking notes are shown here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {active.map((order) => (
          <article key={order.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <b className="text-xl">Order #{order.order_number}</b>
                <p className="mt-1 text-sm text-muted-foreground">
                  Table {order.restaurant_tables?.table_number || '—'} · {order.customer_name || order.customer_phone || 'Guest'}
                </p>
              </div>
              <span className="capitalize text-sm font-semibold text-primary">
                {order.status === 'new' ? 'Received' : order.status}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                  order.dining_type === 'takeaway'
                    ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {order.dining_type === 'takeaway' ? '🛍️ Takeaway / parcel' : '🍽️ Dine-in'}
              </span>

              <button
                onClick={() => handlePrintKOT(order)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <Printer className="size-3.5" />
                Print KOT
              </button>
            </div>

            {order.notes && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <b>General instruction</b>
                <p className="mt-1">{order.notes}</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {order.restaurant_order_items.map((item, index) => (
                <div key={index} className="text-sm">
                  <div className="flex justify-between">
                    <b>{item.item_name}</b>
                    <span>× {item.quantity}</span>
                  </div>
                  {item.notes && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      [NOTE: {item.notes}]
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => void update(order)}
              className="mt-6 min-h-11 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              {action(order.status)}
            </button>
          </article>
        ))}
      </div>

      {!active.length && (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          No active kitchen orders.
        </p>
      )}
    </div>
  )
}
