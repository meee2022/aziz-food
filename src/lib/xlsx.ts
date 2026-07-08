import * as XLSX from "xlsx";

/** قراءة أول ورقة من ملف Excel كصفوف كائنات (المفتاح = ترويسة العمود). */
export async function readExcel(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

/** قراءة صفوف خام (مصفوفات) لاكتشاف الأعمدة يدويًا (للملفات بدون ترويسة). */
export async function readExcelRaw(file: File): Promise<any[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

/** تصدير مصفوفة كائنات إلى ملف Excel. */
export function exportExcel(rows: Record<string, any>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : filename + ".xlsx");
}

/** محاولة استخراج (اسم، وحدة، سعر) من صف بأي ترتيب أعمدة شائع. */
export function guessItemRow(row: any[]): { name: string; unit: string; sell: number } | null {
  const cells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
  if (cells.length < 2) return null;
  // ابحث عن أول نص (اسم)، أول رقم (سعر)، ونص وحدة إن وُجد
  let name = "", unit = "KG", sell = NaN;
  const nums: number[] = [];
  const texts: string[] = [];
  for (const c of row) {
    if (c === null || c === undefined || String(c).trim() === "") continue;
    const n = Number(c);
    if (!isNaN(n) && String(c).trim() !== "") nums.push(n);
    else texts.push(String(c).trim());
  }
  if (texts.length === 0 || nums.length === 0) return null;
  name = texts[0];
  unit = texts[1] ?? "KG";
  sell = nums[nums.length - 1]; // آخر رقم غالبًا السعر
  if (!name || isNaN(sell)) return null;
  return { name, unit, sell };
}
