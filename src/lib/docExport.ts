import { num, money, amountInWordsEn } from "./format";

/** تنزيل نص/بيانات كملف. */
function download(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Company { companyName?: string; companyNameEn?: string; cr?: string; phone?: string; email?: string; addressAr?: string; addressEn?: string; }

function header(s: Company) {
  return {
    nameEn: s.companyNameEn || "MADAME TRADING",
    nameAr: s.companyName || "مدم مي للتجارة",
    cr: s.cr || "147672", phone: s.phone || "55239250",
    email: s.email || "azizhmicheh@outlook.sa",
    addrAr: s.addressAr || "عين خالد 56، مبنى: 299، الدوحة – قطر",
    addrEn: s.addressEn || "Ain Khalid-56, Building: 299, Doha-Qatar.",
  };
}

const fileBase = (s: Company, n: string) => `${(s.companyNameEn || "MADAME-TRADING").replace(/\s+/g, "-")}-${n}`;

/* ─────────────── الفاتورة → Word (مستند HTML يفتحه Word منسّقًا) ─────────────── */
export function invoiceToWord(inv: any, s: Company) {
  const h = header(s);
  const statusAr = inv.status === "approved" ? "معتمدة" : inv.status === "draft" ? "مسودة" : "ملغاة";
  const rows = inv.lines.map((l: any, i: number) =>
    `<tr>
      <td class="c">${i + 1}</td>
      <td class="s">${esc(l.name)}</td>
      <td class="c">${num(l.qty)}</td>
      <td class="c">${esc(l.unit)}</td>
      <td class="e">${num(l.unitPrice)}</td>
      <td class="e"><b>${num(l.qty * l.unitPrice)}</b></td>
    </tr>`).join("");

  const totals = [
    ["Sub Total (QR)", num(inv.subtotal)],
    ...(inv.discount > 0 ? [["Discount", "- " + num(inv.discount)]] : []),
    ...(inv.taxAmount > 0 ? [[`Tax ${inv.taxPct}%`, num(inv.taxAmount)]] : []),
  ].map(([k, v]) => `<tr><td class="s">${k}</td><td class="e">${v}</td></tr>`).join("");

  const meta = (ar: string, val: string) => `<tr><td class="mk">${ar}</td><td class="mv">${esc(val)}</td></tr>`;

  const html = `<!DOCTYPE html><html dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${esc(fileBase(s, inv.number))}</title>
<style>
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#222;font-size:11pt}
  .en{color:#0a7c3f;font-weight:bold;font-size:16pt;margin:0}
  .info{font-size:8.5pt;color:#333;line-height:1.4}
  h1{color:#5C1523;text-align:center;letter-spacing:4px;font-size:18pt;margin:10px 0}
  table{border-collapse:collapse;width:100%}
  .meta td{border:1px solid #d9cfc0;padding:4px 8px;font-size:9.5pt}
  .mk{font-weight:bold;color:#666;width:22%}
  .items td,.items th{border:1px solid #d9cfc0;padding:5px 8px;font-size:9.5pt}
  .items th{background:#5C1523;color:#C9A96E;font-size:9pt}
  .c{text-align:center}.e{text-align:right}.s{text-align:right}
  .tot td{padding:4px 8px;font-size:10pt;border-bottom:1px dashed #ccc}
  .grand{background:#5C1523;color:#fff;font-weight:bold}
</style></head>
<body>
  <table style="border-bottom:3px solid #5C1523"><tr>
    <td style="text-align:left;width:50%">
      <p class="en" style="direction:ltr">${esc(h.nameEn)}</p>
      <div class="info" style="direction:ltr">CR. ${esc(h.cr)}, Mobile: ${esc(h.phone)}<br>${esc(h.email)}<br>${esc(h.addrEn)}</div>
    </td>
    <td style="text-align:right;width:50%">
      <p class="en">${esc(h.nameAr)}</p>
      <div class="info">س.ت: ${esc(h.cr)} ، جوال: ${esc(h.phone)}<br>${esc(h.email)}<br>${esc(h.addrAr)}</div>
    </td>
  </tr></table>

  <h1>INVOICE — فاتورة</h1>

  <table class="meta">
    ${meta("رقم الفاتورة", inv.number)}${meta("التاريخ", inv.date)}
    ${meta("العميل", inv.customer?.nameEn || inv.customerName)}${meta("الحالة", statusAr)}
    ${inv.branch ? meta("الفرع", inv.branch) : ""}${inv.location ? meta("الموقع", inv.location) : ""}
    ${inv.lpo ? meta("رقم الأوردر LPO", inv.lpo) : ""}${inv.dn ? meta("أمر التسليم DN", inv.dn) : ""}
  </table><br>

  <table class="items">
    <tr><th>SN<br>رقم</th><th>ITEM — الصنف</th><th>QTY<br>الكمية</th><th>UNIT<br>الوحدة</th><th>PRICE<br>السعر</th><th>TOTAL<br>الإجمالي</th></tr>
    ${rows}
  </table><br>

  <table style="width:55%;margin-inline-start:auto" class="tot">
    ${totals}
    <tr class="grand"><td>Grand Total (QR) — الصافي</td><td class="e">${num(inv.total)}</td></tr>
    ${inv.paidAmount > 0 ? `<tr><td class="s">Paid — المدفوع</td><td class="e">${num(inv.paidAmount)}</td></tr><tr><td class="s">Remaining — المتبقي</td><td class="e">${num(inv.total - inv.paidAmount)}</td></tr>` : ""}
  </table>

  <p style="font-size:9.5pt;margin-top:12px"><b>Amount in words:</b> ${esc(amountInWordsEn(inv.total))}</p>
  ${inv.notes ? `<p style="font-size:9.5pt"><b>ملاحظات:</b> ${esc(inv.notes)}</p>` : ""}

  <table style="margin-top:30px"><tr>
    <td style="text-align:center;width:50%">__________________<br>المستلم / Received by</td>
    <td style="text-align:center;width:50%">__________________<br>مندوب الشركة / Representative</td>
  </tr></table>
</body></html>`;

  download("﻿" + html, `${fileBase(s, inv.number)}.doc`, "application/msword");
}

/* ─────────────── الفاتورة → Excel (ورقة منسّقة بترويسة الشركة) ─────────────── */
export async function invoiceToExcel(inv: any, s: Company) {
  const XLSX = await import("xlsx");
  const h = header(s);
  const M = "";
  const aoa: any[][] = [
    [h.nameAr, M, M, M, M, h.nameEn],
    [`س.ت ${h.cr} — جوال ${h.phone}`, M, M, M, M, `CR. ${h.cr}, Mobile: ${h.phone}`],
    [h.addrAr, M, M, M, M, h.email],
    [],
    ["فاتورة / INVOICE", M, M, M, M, M],
    ["رقم الفاتورة", inv.number, M, "التاريخ", inv.date, M],
    ["العميل", inv.customer?.nameEn || inv.customerName, M, "الفرع", inv.branch || "—", M],
    ["الموقع", inv.location || "—", M, "الحالة", inv.status === "approved" ? "معتمدة" : inv.status === "draft" ? "مسودة" : "ملغاة", M],
    [],
    ["#", "الصنف / Item", "الكمية", "الوحدة", "السعر", "الإجمالي"],
    ...inv.lines.map((l: any, i: number) => [i + 1, l.name, Number(num(l.qty).replace(/,/g, "")), l.unit, l.unitPrice, Math.round(l.qty * l.unitPrice * 100) / 100]),
    [],
    [M, M, M, M, "الإجمالي الفرعي", inv.subtotal],
    ...(inv.discount > 0 ? [[M, M, M, M, "الخصم", -inv.discount]] : []),
    ...(inv.taxAmount > 0 ? [[M, M, M, M, `الضريبة ${inv.taxPct}%`, inv.taxAmount]] : []),
    [M, M, M, M, "الصافي (QR)", inv.total],
    ...(inv.paidAmount > 0 ? [[M, M, M, M, "المدفوع", inv.paidAmount], [M, M, M, M, "المتبقي", Math.round((inv.total - inv.paidAmount) * 100) / 100]] : []),
    [],
    ["المبلغ كتابةً", amountInWordsEn(inv.total)],
  ];

  const wordsRow = aoa.length - 1; // صف «المبلغ كتابةً» هو الأخير
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  ws["!merges"] = [
    { s: { r: 4, c: 0 }, e: { r: 4, c: 5 } },              // عنوان INVOICE
    { s: { r: wordsRow, c: 1 }, e: { r: wordsRow, c: 5 } }, // المبلغ كتابةً
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  XLSX.writeFile(wb, `${fileBase(s, inv.number)}.xlsx`);
}
