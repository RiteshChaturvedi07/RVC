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

export type ZReportExpense = {
  category: string
  note?: string | null
  amount: number
  time?: string
}

export type ZReportData = {
  restaurant: string
  address?: string
  date: string
  shiftStatus: string
  openingFloat: number
  grossRevenue: number
  cashSales: number
  upiSales: number
  unpaidDues: number
  pettyExpenses: number
  expectedCash: number
  actualCash: number
  discrepancy: number
  taxableSales: number
  cgst: number
  sgst: number
  totalTax: number
  expenseLedger: ZReportExpense[]
  settledBy?: string
}

export function printThermalZReport(data: ZReportData) {
  const win = window.open('', '_blank', 'width=420,height=800')
  if (!win) return

  const expensesHtml = data.expenseLedger.length
    ? data.expenseLedger
        .map(
          (e) => `
    <tr>
      <td style="padding: 2px 0;">${e.category}${e.note ? ` (${e.note})` : ''}</td>
      <td style="text-align: right;">₹${Number(e.amount).toFixed(2)}</td>
    </tr>
  `
        )
        .join('')
    : '<tr><td colspan="2" style="font-style: italic;">No petty cash expenses logged</td></tr>'

  const discText =
    data.discrepancy === 0
      ? 'EXACT MATCH (₹0.00)'
      : data.discrepancy < 0
      ? `SHORTAGE (-₹${Math.abs(data.discrepancy).toFixed(2)})`
      : `SURPLUS (+₹${data.discrepancy.toFixed(2)})`

  const html = `<!doctype html>
<html>
<head>
  <title>Day-End Z-Report - ${data.date}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; font-family: monospace, Arial, sans-serif; color: #000; }
    body { width: 76mm; margin: 0 auto; font-size: 11px; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    h2 { margin: 0 0 2px; font-size: 18px; text-align: center; }
    .subtitle { font-size: 11px; text-align: center; margin-bottom: 4px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .divider-double { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    td { padding: 2px 0; }
    .highlight { font-size: 12px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; }
    @media print {
      body { width: 76mm; }
    }
  </style>
</head>
<body>
  <h2>${data.restaurant}</h2>
  <div class="subtitle">${data.address || 'GST Registered Restaurant'}</div>
  <div class="divider-double"></div>
  <div class="center bold" style="font-size: 14px;">DAY-END Z-REPORT</div>
  <div class="center" style="font-size: 10px; margin-top: 2px;">Shift Status: <b>${data.shiftStatus.toUpperCase()}</b></div>
  <div class="center" style="font-size: 10px;">Date: ${data.date} | Audit Time: ${new Date().toLocaleTimeString('en-IN')}</div>
  
  <div class="divider"></div>
  <div class="bold center">--- REVENUE & SETTLEMENTS ---</div>
  <table>
    <tr><td>Gross Revenue Collected:</td><td style="text-align: right;" class="bold">₹${data.grossRevenue.toFixed(2)}</td></tr>
    <tr><td>(+) UPI / QR Digital Sales:</td><td style="text-align: right;">₹${data.upiSales.toFixed(2)}</td></tr>
    <tr><td>(+) Cash Sales:</td><td style="text-align: right;">₹${data.cashSales.toFixed(2)}</td></tr>
    <tr><td>(ℹ) Pending / Unpaid Dues:</td><td style="text-align: right;">₹${data.unpaidDues.toFixed(2)}</td></tr>
  </table>

  <div class="divider"></div>
  <div class="bold center">--- TAX & GST ACCOUNTING ---</div>
  <table>
    <tr><td>Net Taxable Sales:</td><td style="text-align: right;">₹${data.taxableSales.toFixed(2)}</td></tr>
    <tr><td>CGST (2.5%):</td><td style="text-align: right;">₹${data.cgst.toFixed(2)}</td></tr>
    <tr><td>SGST (2.5%):</td><td style="text-align: right;">₹${data.sgst.toFixed(2)}</td></tr>
    <tr class="bold"><td>Total GST Collected (5%):</td><td style="text-align: right;">₹${data.totalTax.toFixed(2)}</td></tr>
  </table>

  <div class="divider"></div>
  <div class="bold center">--- CASH DRAWER BALANCING ---</div>
  <table>
    <tr><td>(+) Opening Float:</td><td style="text-align: right;">₹${data.openingFloat.toFixed(2)}</td></tr>
    <tr><td>(+) Total Cash Sales:</td><td style="text-align: right;">₹${data.cashSales.toFixed(2)}</td></tr>
    <tr><td>(-) Petty Cash Expenses:</td><td style="text-align: right;">-₹${data.pettyExpenses.toFixed(2)}</td></tr>
    <tr class="highlight"><td>(=) Expected Cash in Drawer:</td><td style="text-align: right;">₹${data.expectedCash.toFixed(2)}</td></tr>
    <tr><td>Actual Counted Cash:</td><td style="text-align: right;" class="bold">₹${data.actualCash.toFixed(2)}</td></tr>
  </table>

  <div style="margin-top: 6px; padding: 4px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 11px;">
    AUDIT DISCREPANCY: ${discText}
  </div>

  <div class="divider"></div>
  <div class="bold center">--- PETTY CASH LEDGER ---</div>
  <table>
    ${expensesHtml}
  </table>

  <div class="divider-double"></div>
  <div style="margin-top: 16px; font-size: 10px;">
    <div style="margin-bottom: 20px;">Manager Sign: ___________________________</div>
    <div>Cashier Sign: ___________________________</div>
  </div>

  <div class="divider"></div>
  <div class="center" style="font-size: 9px; margin-top: 6px;">
    --- END OF Z-REPORT ---<br/>
    Powered by RVC POS SaaS
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

