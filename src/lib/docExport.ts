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

/* ─────────────── PDF حقيقي + مشاركة (واتساب على الموبايل) ─────────────── */

/** يصوّر عنصر ورقة الفاتورة إلى ملف PDF (A4) — يتعامل مع العربي لأنه يلتقط ما يرسمه المتصفح. */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const { jsPDF } = await import("jspdf");
  const canvas = await html2canvas(el, {
    scale: 2, backgroundColor: "#ffffff", useCORS: true,
    ignoreElements: (e) => (e as HTMLElement).classList?.contains("no-print"), // لا تلتقط كتلة الربح الداخلية
  });
  const img = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 8;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const imgH = (canvas.height * availW) / canvas.width;

  // صفحة واحدة إن وسِعت، وإلا نقسّم الصورة على عدة صفحات
  pdf.addImage(img, "JPEG", margin, margin, availW, imgH);
  let heightLeft = imgH - availH;
  while (heightLeft > 0.5) {
    pdf.addPage();
    pdf.addImage(img, "JPEG", margin, margin - (imgH - heightLeft), availW, imgH);
    heightLeft -= availH;
  }
  return pdf.output("blob");
}

/**
 * يشارك الـ PDF عبر قائمة مشاركة النظام (واتساب على الموبايل) إن كانت مدعومة،
 * وإلا ينزّل الملف (على الكمبيوتر غالبًا). يُرجع ما حدث فعلًا.
 */
export async function sharePdf(blob: Blob, fileName: string, opts: { title?: string; text?: string } = {}): Promise<"shared" | "cancelled" | "downloaded"> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancelled"; // المستخدم أغلق القائمة
      // غير مدعوم فعليًا → ننزّل
    }
  }
  download(blob, fileName, "application/pdf");
  return "downloaded";
}

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

const fileBase = (s: Company, n: string) => `${(s.companyNameEn || "MADAME-TRADING").trim().replace(/\s+/g, "-")}-${n}`;

/* ─────────────── أدوات تنسيق Excel (xlsx-js-style) ─────────────── */
const PRIMARY = "5C1523", GOLD = "C9A96E", GREEN = "0A7C3F", GREY = "6B6B6B", LINE = "D9CFC0";
const B = { style: "thin", color: { rgb: LINE } };
const BORDER = { top: B, bottom: B, left: B, right: B };
const XS = {
  coAr: { font: { bold: true, sz: 15, color: { rgb: GREEN } }, alignment: { horizontal: "right", vertical: "center" } },
  coEn: { font: { bold: true, sz: 12, color: { rgb: GREEN } }, alignment: { horizontal: "right", vertical: "center" } },
  info: { font: { sz: 9, color: { rgb: GREY } }, alignment: { horizontal: "right" } },
  title: { fill: { fgColor: { rgb: PRIMARY } }, font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } },
  label: { font: { bold: true, color: { rgb: GREY } }, alignment: { horizontal: "right" }, border: BORDER },
  value: { alignment: { horizontal: "right" }, border: BORDER },
  th: { fill: { fgColor: { rgb: PRIMARY } }, font: { bold: true, sz: 10, color: { rgb: GOLD } }, alignment: { horizontal: "center", vertical: "center" }, border: BORDER },
  cell: { alignment: { horizontal: "center" }, border: BORDER },
  cellS: { alignment: { horizontal: "right" }, border: BORDER },
  numCell: { alignment: { horizontal: "right" }, border: BORDER, numFmt: "#,##0.00" },
  totLabel: { font: { bold: true, color: { rgb: GREY } }, alignment: { horizontal: "right" } },
  totVal: { alignment: { horizontal: "right" }, numFmt: "#,##0.00" },
  grandLabel: { fill: { fgColor: { rgb: PRIMARY } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "right" } },
  grandVal: { fill: { fgColor: { rgb: PRIMARY } }, font: { bold: true, color: { rgb: GOLD } }, alignment: { horizontal: "right" }, numFmt: "#,##0.00" },
} as const;

/** يهيّئ ورقة منسّقة RTL: يكتب الخلايا مع أنماطها ويضبط الأعمدة والدمج. */
function buildStyledSheet(XLSX: any, opts: {
  cells: { r: number; c: number; v: any; t?: string; s?: any }[];
  cols: number[]; merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[]; rows?: number;
}) {
  const ws: any = {};
  let maxR = 0, maxC = 0;
  for (const cell of opts.cells) {
    const addr = XLSX.utils.encode_cell({ r: cell.r, c: cell.c });
    ws[addr] = { v: cell.v, t: cell.t ?? (typeof cell.v === "number" ? "n" : "s"), s: cell.s };
    maxR = Math.max(maxR, cell.r); maxC = Math.max(maxC, cell.c);
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(maxR, opts.rows ?? 0), c: maxC } });
  ws["!cols"] = opts.cols.map((w) => ({ wch: w }));
  ws["!merges"] = opts.merges ?? [];
  ws["!views"] = [{ RTL: true }]; // ورقة من اليمين لليسار للعربية
  return ws;
}

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

/* ─────────────── الفاتورة → Excel (ورقة منسّقة RTL بترويسة الشركة) ─────────────── */
export async function invoiceToExcel(inv: any, s: Company) {
  const mod: any = await import("xlsx-js-style");
  const XLSX = mod.default ?? mod;
  const h = header(s);
  const statusAr = inv.status === "approved" ? "معتمدة" : inv.status === "draft" ? "مسودة" : "ملغاة";

  const cells: { r: number; c: number; v: any; t?: string; s?: any }[] = [];
  const merges: any[] = [];
  const put = (r: number, c: number, v: any, st?: any, t?: string) => cells.push({ r, c, v, s: st, t });
  const full = (r: number) => merges.push({ s: { r, c: 0 }, e: { r, c: 5 } });

  let R = 0;
  put(R, 0, h.nameAr, XS.coAr); full(R++);
  put(R, 0, h.nameEn, XS.coEn); full(R++);
  put(R, 0, `س.ت ${h.cr} · جوال ${h.phone} · ${h.email}`, XS.info); full(R++);
  R++; // فراغ
  put(R, 0, "فاتورة  /  INVOICE", XS.title); full(R++);

  // زوجان label/value لكل صف؛ القيمة تمتد على عمودين
  const metaRow = (l1: string, v1: any, l2: string, v2: any) => {
    put(R, 0, l1, XS.label); put(R, 1, v1, XS.value); put(R, 2, "", XS.value);
    put(R, 3, l2, XS.label); put(R, 4, v2, XS.value); put(R, 5, "", XS.value);
    merges.push({ s: { r: R, c: 1 }, e: { r: R, c: 2 } }, { s: { r: R, c: 4 }, e: { r: R, c: 5 } });
    R++;
  };
  metaRow("رقم الفاتورة", inv.number, "التاريخ", inv.date);
  metaRow("العميل", inv.customer?.nameEn || inv.customerName, "الفرع", inv.branch || "—");
  metaRow("الحالة", statusAr, "الموقع", inv.location || "—");
  R++; // فراغ

  ["#", "الصنف / Item", "الكمية", "الوحدة", "السعر", "الإجمالي"].forEach((th, c) => put(R, c, th, XS.th));
  R++;
  for (let i = 0; i < inv.lines.length; i++) {
    const l = inv.lines[i];
    put(R, 0, i + 1, XS.cell, "n");
    put(R, 1, l.name, XS.cellS);
    put(R, 2, l.qty, XS.numCell, "n");
    put(R, 3, l.unit, XS.cell);
    put(R, 4, l.unitPrice, XS.numCell, "n");
    put(R, 5, Math.round(l.qty * l.unitPrice * 100) / 100, XS.numCell, "n");
    R++;
  }
  R++; // فراغ

  const totRow = (label: string, val: number, grand = false) => {
    put(R, 4, label, grand ? XS.grandLabel : XS.totLabel);
    put(R, 5, val, grand ? XS.grandVal : XS.totVal, "n");
    R++;
  };
  totRow("الإجمالي الفرعي", inv.subtotal);
  if (inv.discount > 0) totRow("الخصم", -inv.discount);
  if (inv.taxAmount > 0) totRow(`الضريبة ${inv.taxPct}%`, inv.taxAmount);
  totRow("الصافي (QR)", inv.total, true);
  if (inv.paidAmount > 0) { totRow("المدفوع", inv.paidAmount); totRow("المتبقي", Math.round((inv.total - inv.paidAmount) * 100) / 100); }
  R++; // فراغ

  put(R, 0, "المبلغ كتابةً", XS.label);
  put(R, 1, amountInWordsEn(inv.total), XS.value);
  for (let c = 2; c <= 5; c++) put(R, c, "", XS.value);
  merges.push({ s: { r: R, c: 1 }, e: { r: R, c: 5 } });

  const ws = buildStyledSheet(XLSX, { cells, merges, rows: R, cols: [6, 34, 10, 10, 13, 14] });
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // اتجاه الورقة من اليمين لليسار
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  XLSX.writeFile(wb, `${fileBase(s, inv.number)}.xlsx`);
}

/* ─────────────── كشف الحساب ─────────────── */

const ROW_KIND: Record<string, string> = { invoice: "فاتورة", payment: "دفعة", return: "مرتجع" };
const stBase = (s: Company, name: string) => `${(s.companyNameEn || "STATEMENT").trim().replace(/\s+/g, "-")}-${name.trim().replace(/\s+/g, "-")}`;

/** كشف الحساب → Word. */
export function statementToWord(st: any, customer: any, s: Company, dateStr: string) {
  const h = header(s);
  const rows = st.ledger.map((r: any) =>
    `<tr>
      <td class="c">${esc(r.date)}</td>
      <td class="c">${esc(r.kind === "invoice" || r.kind === "return" ? r.ref : (r.coveredInvoices ?? []).map((x: any) => x.number).join(", ") || "—")}</td>
      <td class="e">${r.debit ? num(r.debit) : "—"}</td>
      <td class="e">${r.credit ? num(r.credit) : "—"}</td>
      <td class="e"><b>${num(r.balance)}</b></td>
      <td class="c">${esc(r.chequeNumber || "—")}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${esc(stBase(s, customer.name))}</title>
<style>
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#222;font-size:11pt}
  .en{color:#0a7c3f;font-weight:bold;font-size:16pt;margin:0}
  .info{font-size:8.5pt;color:#333;line-height:1.4}
  h1{color:#5C1523;text-align:center;font-size:16pt;margin:10px 0}
  table{border-collapse:collapse;width:100%}
  .led td,.led th{border:1px solid #d9cfc0;padding:5px 8px;font-size:9.5pt}
  .led th{background:#5C1523;color:#C9A96E}
  .c{text-align:center}.e{text-align:right}.s{text-align:right}
  .sum td{border:1px solid #d9cfc0;padding:5px 10px;font-size:10pt}
  .sk{font-weight:bold;color:#666}
</style></head>
<body>
  <table style="border-bottom:3px solid #5C1523"><tr>
    <td style="text-align:left;width:50%"><p class="en" style="direction:ltr">${esc(h.nameEn)}</p>
      <div class="info" style="direction:ltr">CR. ${esc(h.cr)}, Mobile: ${esc(h.phone)}<br>${esc(h.email)}</div></td>
    <td style="text-align:right;width:50%"><p class="en">${esc(h.nameAr)}</p>
      <div class="info">س.ت: ${esc(h.cr)} ، جوال: ${esc(h.phone)}</div></td>
  </tr></table>

  <h1>كشف حساب — Statement of Account</h1>

  <table class="sum" style="margin-bottom:10px"><tr>
    <td class="sk">العميل / Customer</td><td>${esc(customer.name)}${customer.phone ? " — " + esc(customer.phone) : ""}</td>
    <td class="sk">التاريخ / Date</td><td>${esc(dateStr)}</td>
  </tr><tr>
    <td class="sk">إجمالي الفواتير</td><td>${num(st.totalInvoiced)}</td>
    <td class="sk">المدفوع</td><td>${num(st.totalPaid)}</td>
  </tr><tr>
    <td class="sk">المرتجعات</td><td>${num(st.totalReturned ?? 0)}</td>
    <td class="sk">الرصيد المتبقي</td><td><b>${num(st.balance)}</b></td>
  </tr></table>

  <table class="led">
    <tr><th>التاريخ</th><th>رقم الفاتورة</th><th>الفواتير</th><th>الدفعة</th><th>الرصيد</th><th>رقم الشيك</th></tr>
    ${rows}
  </table>
</body></html>`;

  download("﻿" + html, `${stBase(s, customer.name)}.doc`, "application/msword");
}

/** كشف الحساب → Excel (ورقة منسّقة RTL). */
export async function statementToExcel(st: any, customer: any, s: Company, dateStr: string) {
  const mod: any = await import("xlsx-js-style");
  const XLSX = mod.default ?? mod;
  const h = header(s);

  const cells: { r: number; c: number; v: any; t?: string; s?: any }[] = [];
  const merges: any[] = [];
  const put = (r: number, c: number, v: any, st2?: any, t?: string) => cells.push({ r, c, v, s: st2, t });
  const full = (r: number, e = 5) => merges.push({ s: { r, c: 0 }, e: { r, c: e } });

  let R = 0;
  put(R, 0, h.nameAr, XS.coAr); full(R++);
  put(R, 0, h.nameEn, XS.coEn); full(R++);
  put(R, 0, `س.ت ${h.cr} · جوال ${h.phone} · ${h.email}`, XS.info); full(R++);
  R++;
  put(R, 0, "كشف حساب  /  Statement of Account", XS.title); full(R++);

  const metaRow = (l1: string, v1: any, l2: string, v2: any) => {
    put(R, 0, l1, XS.label); put(R, 1, v1, XS.value);
    put(R, 3, l2, XS.label); put(R, 4, v2, XS.value);
    R++;
  };
  metaRow("العميل", customer.name, "التاريخ", dateStr);
  metaRow("إجمالي الفواتير", st.totalInvoiced, "المدفوع", st.totalPaid);
  metaRow("المرتجعات", st.totalReturned ?? 0, "الرصيد المتبقي", st.balance);
  R++;

  ["التاريخ", "رقم الفاتورة", "الفواتير", "الدفعة", "الرصيد", "رقم الشيك"].forEach((th, c) => put(R, c, th, XS.th));
  R++;
  for (const row of st.ledger) {
    put(R, 0, row.date, XS.cell);
    put(R, 1, row.kind === "invoice" || row.kind === "return" ? row.ref : (row.coveredInvoices ?? []).map((x: any) => x.number).join(", ") || "—", XS.cellS);
    put(R, 2, row.debit || "", row.debit ? XS.numCell : XS.cell, row.debit ? "n" : "s");
    put(R, 3, row.credit || "", row.credit ? XS.numCell : XS.cell, row.credit ? "n" : "s");
    put(R, 4, row.balance, XS.numCell, "n");
    put(R, 5, row.chequeNumber || "", XS.cell);
    R++;
  }

  const ws = buildStyledSheet(XLSX, { cells, merges, rows: R, cols: [15, 20, 15, 15, 15, 18] });
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // اتجاه الورقة من اليمين لليسار
  XLSX.utils.book_append_sheet(wb, ws, "Statement");
  XLSX.writeFile(wb, `${stBase(s, customer.name)}.xlsx`);
}
