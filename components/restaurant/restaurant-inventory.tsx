'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Edit3,
  Grid3X3,
  Layers,
  MessageSquare,
  Minus,
  Package,
  Plus,
  Search,
  Sparkles,
  Table2,
  Trash2,
  TrendingDown,
  X,
  Zap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { currentRestaurantTenant } from '@/lib/restaurant'

type InventoryItem = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  reorder_level: number
  unit_cost: number
  supplier_notes: string | null
  is_auto_deduct?: boolean
  updated_at?: string
}

const db = () => createClient()

const money = (n: number) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

const categoriesList = ['All Categories', 'Dairy', 'Produce & Veggies', 'Spices & Grocery', 'Meat & Poultry', 'Beverages', 'Packaging']

const presets = {
  'Café & Beverages': [
    { name: 'Whole Milk', category: 'Dairy', quantity: 25, unit: 'L', reorder_level: 10, unit_cost: 60, supplier_notes: 'Amul / Mother Dairy' },
    { name: 'Arabica Coffee Beans', category: 'Beverages', quantity: 8, unit: 'kg', reorder_level: 3, unit_cost: 850, supplier_notes: 'Dark Roast Specialty' },
    { name: 'White Sugar', category: 'Spices & Grocery', quantity: 20, unit: 'kg', reorder_level: 5, unit_cost: 45, supplier_notes: 'Refined 1kg packs' },
    { name: 'Chocolate Syrup', category: 'Beverages', quantity: 6, unit: 'bottles', reorder_level: 2, unit_cost: 180, supplier_notes: 'Hershey 1.2kg' },
    { name: 'Paper Takeaway Cups', category: 'Packaging', quantity: 200, unit: 'pcs', reorder_level: 50, unit_cost: 3, supplier_notes: '250ml Eco Cups' },
  ],
  'Fast Food & Bakery': [
    { name: 'Mozzarella Cheese', category: 'Dairy', quantity: 12, unit: 'kg', reorder_level: 5, unit_cost: 420, supplier_notes: 'Diced Amul Cheese' },
    { name: 'Refined Wheat Flour (Maida)', category: 'Spices & Grocery', quantity: 30, unit: 'kg', reorder_level: 10, unit_cost: 35, supplier_notes: '5kg bags' },
    { name: 'Pizza Tomato Sauce', category: 'Spices & Grocery', quantity: 10, unit: 'L', reorder_level: 3, unit_cost: 120, supplier_notes: 'Italian Herb Sauce' },
    { name: 'Sesame Burger Buns', category: 'Packaging', quantity: 60, unit: 'pcs', reorder_level: 20, unit_cost: 8, supplier_notes: 'Fresh Daily Bakery' },
    { name: 'Refined Cooking Oil', category: 'Spices & Grocery', quantity: 20, unit: 'L', reorder_level: 5, unit_cost: 135, supplier_notes: 'Sunflower Oil Can' },
  ],
  'Indian Kitchen': [
    { name: 'Basmati Rice', category: 'Spices & Grocery', quantity: 35, unit: 'kg', reorder_level: 10, unit_cost: 110, supplier_notes: 'Aromatic Long Grain' },
    { name: 'Fresh Paneer', category: 'Dairy', quantity: 10, unit: 'kg', reorder_level: 4, unit_cost: 320, supplier_notes: 'Dairy Fresh Daily' },
    { name: 'Garam Masala Blend', category: 'Spices & Grocery', quantity: 4, unit: 'kg', reorder_level: 1, unit_cost: 450, supplier_notes: 'Whole Spice Mix' },
    { name: 'Mustard Cooking Oil', category: 'Spices & Grocery', quantity: 25, unit: 'L', reorder_level: 8, unit_cost: 150, supplier_notes: 'Kacchi Ghani Oil' },
    { name: 'Whole Wheat Flour (Atta)', category: 'Spices & Grocery', quantity: 40, unit: 'kg', reorder_level: 15, unit_cost: 42, supplier_notes: 'Chakki Fresh Atta' },
  ],
}

export function RestaurantInventory() {
  const [tenant, setTenant] = useState('')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'reorder' | 'healthy'>('all')
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [notice, setNotice] = useState('')

  // Modal State
  const [showItemModal, setShowItemModal] = useState<InventoryItem | 'new' | null>(null)
  const [showWastageModal, setShowWastageModal] = useState<InventoryItem | null>(null)
  const [wastageQty, setWastageQty] = useState('1')
  const [wastageReason, setWastageReason] = useState('Spoilage / Expiry')

  // Item Form
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('Dairy')
  const [formQty, setFormQty] = useState('10')
  const [formUnit, setFormUnit] = useState('kg')
  const [formMinThreshold, setFormMinThreshold] = useState('5')
  const [formCost, setFormCost] = useState('100')
  const [formNotes, setFormNotes] = useState('')
  const [formAutoDeduct, setFormAutoDeduct] = useState(true)

  const loadData = async () => {
    try {
      const currentTenant = tenant || (await currentRestaurantTenant())
      setTenant(currentTenant)

      const { data, error } = await db()
        .from('restaurant_inventory_items')
        .select('*')
        .eq('tenant_id', currentTenant)
        .order('name')

      if (error) throw error
      setItems((data ?? []) as InventoryItem[])
    } catch (e) {
      setNotice('Unable to load inventory records.')
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // KPI Metrics
  const totalItemsCount = items.length
  const criticalCount = items.filter((i) => Number(i.quantity) <= Number(i.reorder_level)).length
  const reorderCount = items.filter(
    (i) => Number(i.quantity) > Number(i.reorder_level) && Number(i.quantity) <= Number(i.reorder_level) * 1.8
  ).length
  const totalStockValue = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_cost || 0), 0)

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const catMatch = selectedCategory === 'All Categories' || i.category === selectedCategory
      const isCritical = Number(i.quantity) <= Number(i.reorder_level)
      const isReorder = Number(i.quantity) > Number(i.reorder_level) && Number(i.quantity) <= Number(i.reorder_level) * 1.8
      const isHealthy = !isCritical && !isReorder

      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'critical' && isCritical) ||
        (statusFilter === 'reorder' && isReorder) ||
        (statusFilter === 'healthy' && isHealthy)

      const searchMatch =
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase()) ||
        (i.supplier_notes || '').toLowerCase().includes(search.toLowerCase())

      return catMatch && statusMatch && searchMatch
    })
  }, [items, selectedCategory, statusFilter, search])

  // 1-Click Stepper Adjust (+5 or -1)
  const handleQuickAdjust = async (item: InventoryItem, delta: number) => {
    const nextQty = Math.max(0, Number(item.quantity) + delta)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: nextQty } : i)))

    const { error } = await db()
      .from('restaurant_inventory_items')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', item.id)

    if (error) {
      setNotice(`Update failed: ${error.message}`)
      void loadData()
    }
  }

  // 1-Click Log Wastage
  const handleLogWastage = async () => {
    if (!showWastageModal) return
    const loss = Number(wastageQty) || 1
    const nextQty = Math.max(0, Number(showWastageModal.quantity) - loss)

    setItems((prev) => prev.map((i) => (i.id === showWastageModal.id ? { ...i, quantity: nextQty } : i)))
    setShowWastageModal(null)

    const { error } = await db()
      .from('restaurant_inventory_items')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', showWastageModal.id)

    if (error) {
      setNotice(`Wastage log error: ${error.message}`)
      void loadData()
    } else {
      setNotice(`⚠️ Logged wastage of ${loss} ${showWastageModal.unit} for ${showWastageModal.name}.`)
    }
  }

  // Delete Item
  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`Delete ingredient "${item.name}" from inventory?`)) return
    setItems((prev) => prev.filter((i) => i.id !== item.id))

    const { error } = await db().from('restaurant_inventory_items').delete().eq('id', item.id)
    if (error) alert(error.message)
    else void loadData()
  }

  // Open Item Modal
  const openItemModal = (item?: InventoryItem) => {
    if (item) {
      setShowItemModal(item)
      setFormName(item.name)
      setFormCategory(item.category || 'Dairy')
      setFormQty(String(item.quantity))
      setFormUnit(item.unit || 'kg')
      setFormMinThreshold(String(item.reorder_level))
      setFormCost(String(item.unit_cost || 0))
      setFormNotes(item.supplier_notes || '')
      setFormAutoDeduct(item.is_auto_deduct ?? true)
    } else {
      setShowItemModal('new')
      setFormName('')
      setFormCategory('Dairy')
      setFormQty('10')
      setFormUnit('kg')
      setFormMinThreshold('5')
      setFormCost('100')
      setFormNotes('')
      setFormAutoDeduct(true)
    }
  }

  // Save Add/Edit Form
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    const payload = {
      tenant_id: tenant,
      name: formName.trim(),
      category: formCategory,
      quantity: Number(formQty) || 0,
      unit: formUnit,
      reorder_level: Number(formMinThreshold) || 0,
      unit_cost: Number(formCost) || 0,
      supplier_notes: formNotes.trim() || null,
      is_auto_deduct: formAutoDeduct,
      updated_at: new Date().toISOString(),
    }

    if (typeof showItemModal === 'object' && showItemModal !== null) {
      const { error } = await db().from('restaurant_inventory_items').update(payload).eq('id', showItemModal.id)
      if (error) setNotice(error.message)
      else {
        setShowItemModal(null)
        void loadData()
      }
    } else {
      const { error } = await db().from('restaurant_inventory_items').insert(payload)
      if (error) setNotice(error.message)
      else {
        setShowItemModal(null)
        void loadData()
      }
    }
  }

  // Load Preset Starter Kit
  const handleLoadPreset = async (presetName: keyof typeof presets) => {
    const list = presets[presetName]
    setNotice(`Seeding ${presetName} starter ingredients…`)

    const payload = list.map((item) => ({
      tenant_id: tenant,
      ...item,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await db().from('restaurant_inventory_items').insert(payload)
    if (error) setNotice(error.message)
    else {
      setNotice(`✅ Loaded ${list.length} ingredients for ${presetName}!`)
      void loadData()
    }
  }

  // 1-Click WhatsApp Vendor Reorder Generator
  const openWhatsAppReorder = () => {
    const lowStockItems = items.filter((i) => Number(i.quantity) <= Number(i.reorder_level) * 1.5)
    if (!lowStockItems.length) {
      alert('All stock items are healthy! No reorder needed right now.')
      return
    }

    const lines = lowStockItems.map((i) => {
      const needed = Math.max(1, Number(i.reorder_level) * 2 - Number(i.quantity))
      return `• ${i.name}: Need ${needed} ${i.unit} (Current: ${i.quantity} ${i.unit})`
    })

    const message = `🛒 *RESTAURANT INVENTORY PURCHASE ORDER*\n----------------------------------------\n${lines.join(
      '\n'
    )}\n----------------------------------------\nGenerated via RVC Restaurant SaaS`

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* TITLE & VENDOR REORDER ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kitchen Stock & Vendor Reorder</h2>
          <p className="text-sm text-muted-foreground">
            Track ingredients, 1-click steppers, log wastage, and generate instant WhatsApp vendor purchase orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openWhatsAppReorder}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700"
          >
            <MessageSquare className="size-4" />
            <span>1-Click WhatsApp Reorder</span>
          </button>

          <button
            onClick={() => openItemModal()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90"
          >
            <Plus className="size-4" />
            <span>Quick Add Stock Item</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-medium text-primary flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="hover:opacity-70">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* SUMMARY KPI METRICS BAND */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Tracked Items</span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Ingredients</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{totalItemsCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
              <AlertTriangle className="size-5 animate-bounce" />
            </span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
              Action Needed
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Critical Low Stock</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{criticalCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <TrendingDown className="size-5" />
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Near Limit
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Reorder Soon</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{reorderCount}</p>
        </article>

        <article className="rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Layers className="size-5" />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Asset Valuation</span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Stock Value</p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">{money(totalStockValue)}</p>
        </article>
      </div>

      {/* FILTER & CATEGORIES TOOLBAR */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3.5 top-2.5 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredient, category, supplier notes…"
              className="w-full rounded-xl border border-border bg-background py-2 pl-10 text-xs outline-none focus:border-primary"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'all' ? 'bg-primary text-primary-foreground shadow-2xs' : 'bg-secondary text-foreground'
              }`}
            >
              All Status ({totalItemsCount})
            </button>

            <button
              onClick={() => setStatusFilter('critical')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'critical' ? 'bg-red-600 text-white shadow-2xs' : 'bg-red-500/10 text-red-700 dark:text-red-400'
              }`}
            >
              🔴 Critical ({criticalCount})
            </button>

            <button
              onClick={() => setStatusFilter('reorder')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'reorder' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              🟡 Reorder ({reorderCount})
            </button>

            <div className="flex rounded-xl border border-border bg-background p-0.5">
              <button
                onClick={() => setView('table')}
                className={`rounded-lg p-1.5 ${view === 'table' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
              >
                <Table2 className="size-4" />
              </button>

              <button
                onClick={() => setView('grid')}
                className={`rounded-lg p-1.5 ${view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}
              >
                <Grid3X3 className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* CATEGORY STRIP */}
        <div className="flex gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                selectedCategory === cat ? 'bg-slate-900 text-white dark:bg-slate-800' : 'bg-secondary text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* INVENTORY TABLE WITH INLINE STEPPERS */}
      {view === 'table' ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="p-4">Ingredient & Vendor</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Stock Level & Meter</th>
                  <th className="p-4">Unit Cost</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Quick Steppers (1-Click)</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredItems.map((item) => {
                  const qty = Number(item.quantity)
                  const min = Number(item.reorder_level)
                  const maxCap = Math.max(min * 2.5, 1)
                  const pct = Math.min(100, Math.round((qty / maxCap) * 100))

                  const isCritical = qty <= min
                  const isReorder = qty > min && qty <= min * 1.8

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      {/* INGREDIENT & VENDOR */}
                      <td className="p-4">
                        <div className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                          <span>🥬</span>
                          {item.name}
                        </div>
                        {item.supplier_notes && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.supplier_notes}</p>
                        )}
                      </td>

                      {/* CATEGORY */}
                      <td className="p-4">
                        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          {item.category}
                        </span>
                      </td>

                      {/* STOCK LEVEL & PROGRESS BAR */}
                      <td className="p-4 min-w-[180px]">
                        <div className="flex items-center justify-between text-xs font-extrabold">
                          <span>
                            {qty} <small className="font-semibold text-muted-foreground">{item.unit}</small>
                          </span>
                          <span className="text-[10px] text-muted-foreground">Min: {min}</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isCritical ? 'bg-red-500' : isReorder ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* UNIT COST */}
                      <td className="p-4 font-bold text-foreground text-sm">{money(item.unit_cost || 0)}</td>

                      {/* STATUS BADGE */}
                      <td className="p-4">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700 dark:bg-red-950 dark:text-red-300 animate-pulse">
                            🔴 Critical Low
                          </span>
                        ) : isReorder ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            🟡 Order Soon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            🟢 In Stock
                          </span>
                        )}
                      </td>

                      {/* QUICK STEPPERS */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => void handleQuickAdjust(item, -1)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold hover:bg-secondary"
                            title="Decrement -1"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => void handleQuickAdjust(item, 5)}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold hover:bg-secondary"
                            title="Add +5"
                          >
                            +5
                          </button>

                          <button
                            onClick={() => setShowWastageModal(item)}
                            className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                            title="Log Spoilage / Wastage"
                          >
                            ⚠️ Wastage
                          </button>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openItemModal(item)}
                            className="rounded-xl border border-border px-2.5 py-1 text-xs font-semibold hover:bg-secondary flex items-center gap-1"
                          >
                            <Edit3 className="size-3.5 text-primary" />
                            Edit
                          </button>
                          <button
                            onClick={() => void handleDeleteItem(item)}
                            className="rounded-xl border border-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-1"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* GRID VIEW */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const qty = Number(item.quantity)
            const min = Number(item.reorder_level)
            const isCritical = qty <= min

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-foreground text-base">🥬 {item.name}</h3>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {item.category}
                      </span>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isCritical ? 'bg-red-100 text-red-700 dark:bg-red-950' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isCritical ? 'Critical' : 'Healthy'}
                    </span>
                  </div>

                  <p className="mt-4 text-3xl font-extrabold text-foreground">
                    {qty} <small className="text-xs text-muted-foreground font-semibold">{item.unit}</small>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Min threshold: {min} {item.unit}</p>
                </div>

                <div className="mt-4 border-t border-border pt-3 flex gap-2">
                  <button
                    onClick={() => void handleQuickAdjust(item, -1)}
                    className="flex-1 rounded-xl border border-border py-1.5 text-xs font-bold"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => void handleQuickAdjust(item, 5)}
                    className="flex-1 rounded-xl border border-border py-1.5 text-xs font-bold"
                  >
                    +5
                  </button>
                  <button
                    onClick={() => openItemModal(item)}
                    className="rounded-xl border border-border p-2 text-primary"
                  >
                    <Edit3 className="size-4" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* QUICK START PRESETS (WHEN EMPTY) */}
      {!items.length && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-2xs dark:bg-slate-900">
          <Boxes className="mx-auto size-12 text-muted-foreground" />
          <h3 className="mt-3 text-xl font-bold">No inventory items tracked yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">Select a cuisine starter kit to pre-load ingredients in 1-click:</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
            {Object.keys(presets).map((name) => (
              <button
                key={name}
                onClick={() => void handleLoadPreset(name as keyof typeof presets)}
                className="rounded-2xl border border-border bg-background p-4 text-left hover:border-primary transition-all shadow-xs space-y-1"
              >
                <b className="font-extrabold text-sm text-foreground block">{name}</b>
                <p className="text-[11px] text-muted-foreground">5 Essential Ingredients</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-primary">
                  <Zap className="size-3" /> Load Kit →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ADD / EDIT ITEM MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
          <form
            onSubmit={handleSaveItem}
            className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xl font-extrabold">
                {typeof showItemModal === 'object' ? 'Edit Ingredient' : 'Add Stock Ingredient'}
              </h3>
              <button type="button" onClick={() => setShowItemModal(null)} className="rounded-full p-1.5 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Ingredient Name *</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Whole Milk, Mozzarella Cheese, Basmati Rice"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
                  >
                    {categoriesList.slice(1).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Unit of Measure</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
                  >
                    {['kg', 'g', 'L', 'mL', 'pcs', 'packs', 'boxes', 'bottles', 'cans'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Current Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formQty}
                    onChange={(e) => setFormQty(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formMinThreshold}
                    onChange={(e) => setFormMinThreshold(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Supplier / Vendor Notes</label>
                <input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Amul Dairy, Contact: +91 9876543210"
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowItemModal(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:opacity-90">
                Save Ingredient
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LOG WASTAGE MODAL */}
      {showWastageModal && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-extrabold text-red-600">Log Wastage / Spoilage</h3>
              <button onClick={() => setShowWastageModal(null)} className="rounded-full p-1.5 hover:bg-secondary">
                <X className="size-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Ingredient: <b className="text-foreground">{showWastageModal.name}</b>
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Quantity Lost ({showWastageModal.unit}):</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={wastageQty}
                onChange={(e) => setWastageQty(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-sm font-bold text-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason for Loss:</label>
              <select
                value={wastageReason}
                onChange={(e) => setWastageReason(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none"
              >
                <option>Spoilage / Expiry</option>
                <option>Kitchen Spillage</option>
                <option>Preparation Waste</option>
                <option>Damaged Goods</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowWastageModal(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleLogWastage()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700"
              >
                Deduct Wastage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
