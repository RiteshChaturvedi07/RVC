'use client'

import { Printer, X } from 'lucide-react'
import { KOTData, CustomerBillData, printThermalKOT, printThermalCustomerBill } from '@/lib/print-engine'

export function KOTPrintModal({
  data,
  onClose,
}: {
  data: KOTData | null
  onClose: () => void
}) {
  if (!data) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold">🖨️ Kitchen Order Ticket (KOT)</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="my-4 rounded-xl border bg-muted/30 p-4 font-mono text-xs">
          <div className="text-center font-bold">{data.restaurant}</div>
          <div className="mt-1 text-center font-black text-lg">TABLE {data.table}</div>
          <div className="text-center text-muted-foreground">Order #{data.orderNumber}</div>
          <div className="my-2 border-t border-dashed" />
          {data.items.map((item, index) => (
            <div key={index} className="py-1">
              <div className="flex justify-between font-bold">
                <span>{item.name}</span>
                <span>x{item.quantity}</span>
              </div>
              {item.notes && (
                <div className="text-amber-600 dark:text-amber-400 font-semibold pl-2">
                  [NOTE: {item.notes}]
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              printThermalKOT(data)
              onClose()
            }}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            <Printer className="mr-2 inline size-4" />
            Print KOT (80mm)
          </button>
          <button onClick={onClose} className="rounded-xl border px-4 py-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function CustomerBillPrintModal({
  data,
  onClose,
}: {
  data: CustomerBillData | null
  onClose: () => void
}) {
  if (!data) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold">🧾 Customer Tax Invoice</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="my-4 rounded-xl border bg-muted/30 p-4 font-mono text-xs">
          <div className="text-center font-bold">{data.restaurant}</div>
          <div className="text-center text-muted-foreground">Order #{data.orderNumber} · Table {data.table}</div>
          <div className="my-2 border-t border-dashed" />
          {data.items.map((item, index) => (
            <div key={index} className="flex justify-between py-1">
              <span>{item.name} x{item.quantity}</span>
              <span>₹{item.lineTotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="my-2 border-t border-dashed" />
          <div className="flex justify-between font-bold text-sm">
            <span>Grand Total:</span>
            <span>₹{data.grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              printThermalCustomerBill(data)
              onClose()
            }}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90"
          >
            <Printer className="mr-2 inline size-4" />
            Print Bill (80mm)
          </button>
          <button onClick={onClose} className="rounded-xl border px-4 py-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
