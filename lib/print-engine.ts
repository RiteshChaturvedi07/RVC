export type KOTItem = {
  name: string
  quantity: number
  notes?: string | null
}

export type KOTData = {
  restaurant: string
  table: string
  orderNumber: number
  tokenNumber?: number | string
  createdAt?: string
  diningType?: 'dine_in' | 'takeaway' | string
  items: KOTItem[]
}

export type BillItem = {
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type CustomerBillData = {
  restaurant: string
  address?: string
  phone?: string
  gstin?: string
  fssaiNo?: string
  table: string
  orderNumber: number
  createdAt?: string
  items: BillItem[]
  subtotal: number
  discount?: number
  taxRate?: number
  taxAmount?: number
  grandTotal: number
  paymentStatus?: 'paid' | 'unpaid' | string
  merchantUpiQrUrl?: string | null
  merchantUpiId?: string | null
}

export function printThermalKOT(data: KOTData) {
  const win = window.open('', '_blank', 'width=420,height=600')
  if (!win) return

  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="font-size: 15px; font-weight: bold; padding: 4px 0;">${item.name}</td>
      <td style="font-size: 16px; font-weight: bold; text-align: right;">x${item.quantity}</td>
    </tr>
    ${
      item.notes
        ? `<tr><td colspan="2" style="font-size: 12px; font-style: italic; color: #000; padding-bottom: 6px; padding-left: 8px;"><strong>[NOTE: ${item.notes}]</strong></td></tr>`
        : ''
    }
  `
    )
    .join('')

  const html = `<!doctype html>
<html>
<head>
  <title>KOT - #${data.orderNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; font-family: monospace, sans-serif; color: #000; }
    body { width: 76mm; margin: 0 auto; font-size: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
    .title { font-size: 16px; font-weight: bold; }
    .badge { display: inline-block; background: #000; color: #fff; padding: 2px 6px; font-size: 14px; font-weight: bold; border-radius: 4px; margin-top: 4px; }
    .table-num { font-size: 24px; font-weight: 900; margin: 4px 0; }
    .info { font-size: 12px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 1px dashed #000; }
    @media print {
      body { width: 76mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${data.restaurant}</div>
    <div class="badge">${(data.diningType || 'dine_in').toUpperCase().replace('_', '-')}</div>
    <div class="table-num">TABLE: ${data.table}</div>
    <div class="info">Order #${data.orderNumber} ${data.tokenNumber ? `| Token #${data.tokenNumber}` : ''}</div>
    <div class="info">${new Date(data.createdAt || Date.now()).toLocaleString('en-IN')}</div>
  </div>
  <h3 style="margin: 0; text-align: center; font-size: 16px; text-decoration: underline;">KITCHEN ORDER TICKET</h3>
  <table>
    ${itemsHtml}
  </table>
  <div style="border-top: 2px solid #000; margin-top: 12px; padding-top: 6px; text-align: center; font-size: 11px;">
    --- END OF KOT ---
  </div>
  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    }
  </script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}

export function printThermalCustomerBill(data: CustomerBillData) {
  const win = window.open('', '_blank', 'width=420,height=750')
  if (!win) return

  const taxRate = data.taxRate || 5
  const cgstRate = (taxRate / 2).toFixed(1)
  const sgstRate = (taxRate / 2).toFixed(1)

  const subtotal = data.subtotal
  const discount = data.discount || 0
  const taxableAmount = Math.max(0, subtotal - discount)
  const taxAmount = data.taxAmount ?? (taxableAmount * taxRate) / 100
  const cgstAmount = taxAmount / 2
  const sgstAmount = taxAmount / 2

  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 3px 0;">${item.name}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">₹${item.unitPrice.toFixed(2)}</td>
      <td style="text-align: right;">₹${item.lineTotal.toFixed(2)}</td>
    </tr>
  `
    )
    .join('')

  const html = `<!doctype html>
<html>
<head>
  <title>Tax Invoice - #${data.orderNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; font-family: monospace, Arial, sans-serif; color: #000; }
    body { width: 76mm; margin: 0 auto; font-size: 11px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    h2 { margin: 0 0 2px; font-size: 18px; text-align: center; }
    .subtitle { font-size: 11px; text-align: center; margin-bottom: 4px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; }
    .grand-total { font-size: 16px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; }
    @media print {
      body { width: 76mm; }
    }
  </style>
</head>
<body>
  <h2>${data.restaurant}</h2>
  <div class="subtitle">${data.address || 'GST Registered Restaurant'}</div>
  ${data.phone ? `<div class="subtitle">Ph: ${data.phone}</div>` : ''}
  ${data.gstin ? `<div class="subtitle bold">GSTIN: ${data.gstin}</div>` : ''}
  ${data.fssaiNo ? `<div class="subtitle">FSSAI Lic: ${data.fssaiNo}</div>` : ''}
  <div class="divider"></div>
  <div class="center bold" style="font-size: 13px;">TAX INVOICE</div>
  <div style="display: flex; justify-content: space-between; margin-top: 4px;">
    <span>Order: <b>#${data.orderNumber}</b></span>
    <span>Table: <b>${data.table}</b></span>
  </div>
  <div>Date: ${new Date(data.createdAt || Date.now()).toLocaleString('en-IN')}</div>
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th style="width: 45%;">Item</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 20%; text-align: right;">Price</th>
        <th style="width: 20%; text-align: right;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  <div class="divider"></div>
  <table>
    <tr>
      <td>Subtotal:</td>
      <td style="text-align: right;">₹${subtotal.toFixed(2)}</td>
    </tr>
    ${
      discount > 0
        ? `<tr><td>Discount:</td><td style="text-align: right;">-₹${discount.toFixed(2)}</td></tr>`
        : ''
    }
    <tr>
      <td>CGST (${cgstRate}%):</td>
      <td style="text-align: right;">₹${cgstAmount.toFixed(2)}</td>
    </tr>
    <tr>
      <td>SGST (${sgstRate}%):</td>
      <td style="text-align: right;">₹${sgstAmount.toFixed(2)}</td>
    </tr>
    <tr class="grand-total">
      <td>GRAND TOTAL:</td>
      <td style="text-align: right;">₹${data.grandTotal.toFixed(2)}</td>
    </tr>
  </table>
  <div class="center bold" style="margin-top: 8px; font-size: 13px;">
    STATUS: [ ${(data.paymentStatus || 'UNPAID').toUpperCase()} ]
  </div>
  ${
    data.merchantUpiQrUrl || data.merchantUpiId
      ? `
    <div class="divider"></div>
    <div class="center">
      <div class="bold" style="font-size: 11px;">SCAN & PAY VIA UPI</div>
      ${data.merchantUpiQrUrl ? `<img src="${data.merchantUpiQrUrl}" style="width: 110px; height: 110px; margin: 4px 0;" alt="UPI QR" />` : ''}
      ${data.merchantUpiId ? `<div style="font-size: 10px;">UPI ID: ${data.merchantUpiId}</div>` : ''}
    </div>
  `
      : ''
  }
  <div class="divider"></div>
  <div class="center" style="font-size: 10px; margin-top: 6px;">
    Thank you for dining with us!<br/>
    <small>Powered by RVC Restaurant SaaS</small>
  </div>
  <script>
    window.onload = () => {
      window.print();
      setTimeout(() => window.close(), 500);
    }
  </script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}
