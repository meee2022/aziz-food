import { readExcelRaw } from "./xlsx";

export interface CatalogItem { itemId: string; name: string; nameAr?: string; unit: string; }
export interface ParsedLine { itemId: string; name: string; nameAr?: string; unit: string; qty: number; }
export interface ImportResult { matched: ParsedLine[]; unmatched: string[]; }

/** تطبيع نص للمطابقة: أحرف صغيرة، إزالة التشكيل والتطويل والمسافات الزائدة. */
function norm(s: string): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // تشكيل + تطويل
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
}

/** أفضل تطابق لصنف من الكتالوج حسب الاسم؛ يرجّع العنصر أو null. */
export function matchItem(catalog: CatalogItem[], query: string): CatalogItem | null {
  const q = norm(query);
  if (!q) return null;
  let best: CatalogItem | null = null;
  let bestScore = 0;
  const qTokens = new Set(q.split(" ").filter(Boolean));
  for (const it of catalog) {
    const cands = [norm(it.name), norm(it.nameAr ?? "")].filter(Boolean);
    let score = 0;
    for (const c of cands) {
      if (!c) continue;
      if (c === q) score = Math.max(score, 100);
      else if (c.startsWith(q) || q.startsWith(c)) score = Math.max(score, 80);
      else if (c.includes(q) || q.includes(c)) score = Math.max(score, 65);
      else {
        const cTokens = c.split(" ").filter(Boolean);
        const overlap = cTokens.filter((t) => qTokens.has(t)).length;
        if (overlap) score = Math.max(score, 40 + overlap * 10);
      }
    }
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return bestScore >= 55 ? best : null; // عتبة لتفادي المطابقات الضعيفة
}

const NAME_KEYS = ["description", "item", "product", "name", "الصنف", "اسم الصنف", "البيان", "المنتج", "الاصناف"];
const QTY_KEYS = ["qty", "quantity", "الكمية", "كمية", "العدد", "عدد"];

const toNum = (c: any): number => {
  if (c === null || c === undefined) return NaN;
  const s = String(c).trim().replace(/[,٬،]/g, ".").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!s) return NaN;
  const n = Number(s);
  return isNaN(n) ? NaN : n;
};

/** يبحث عن صف الترويسة ويحدّد عمودي «الصنف» و«الكمية». */
function findHeader(rows: any[][]): { row: number; name: number; qty: number } | null {
  const limit = Math.min(rows.length, 40);
  for (let r = 0; r < limit; r++) {
    const cells = rows[r] || [];
    let name = -1, qty = -1;
    for (let c = 0; c < cells.length; c++) {
      const v = norm(String(cells[c] ?? ""));
      if (!v) continue;
      if (name < 0 && NAME_KEYS.some((k) => v === norm(k) || v.includes(norm(k)))) name = c;
      if (qty < 0 && QTY_KEYS.some((k) => v === norm(k) || v.includes(norm(k)))) qty = c;
    }
    if (name >= 0 && qty >= 0) return { row: r, name, qty };
  }
  return null;
}

/**
 * قراءة ملف إكسيل طلب وتحويله لأصناف مطابقة (بدون ذكاء اصطناعي).
 * يقرأ ترويسة الأعمدة (Description/QTY أو الصنف/الكمية) ليأخذ الكمية من عمودها الصحيح،
 * ويتجاهل الأصناف بلا كمية — فقائمة الأسعار الكاملة لا تُضاف، فقط المطلوب فعلًا.
 */
export async function parseExcelOrder(file: File, catalog: CatalogItem[]): Promise<ImportResult> {
  const rows = await readExcelRaw(file);
  const matched: ParsedLine[] = [];
  const unmatched: string[] = [];
  const seen = new Map<string, ParsedLine>();

  const add = (name: string, qty: number) => {
    const it = matchItem(catalog, name);
    if (it) {
      const prev = seen.get(it.itemId);
      if (prev) prev.qty = Math.round((prev.qty + qty) * 100) / 100;
      else { const line = { itemId: it.itemId, name: it.name, nameAr: it.nameAr, unit: it.unit, qty }; seen.set(it.itemId, line); matched.push(line); }
    } else unmatched.push(name);
  };

  const h = findHeader(rows);
  if (h) {
    for (let r = h.row + 1; r < rows.length; r++) {
      const cells = rows[r] || [];
      const name = String(cells[h.name] ?? "").trim();
      if (name.length < 2) continue;
      const qty = toNum(cells[h.qty]);
      if (!(qty > 0)) continue; // بلا كمية ⇒ لم يُطلب
      add(name, qty);
    }
    return { matched, unmatched };
  }

  // بلا ترويسة: ملف بسيط (اسم، كمية) — أول نص = الصنف، أول رقم موجب بعده = الكمية
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    let name = "";
    let qty = NaN;
    for (const cell of row) {
      if (cell === null || cell === undefined || String(cell).trim() === "") continue;
      const n = toNum(cell);
      if (!name && isNaN(n) && String(cell).trim().length >= 2) name = String(cell).trim();
      else if (name && isNaN(qty) && !isNaN(n) && n > 0) qty = n;
    }
    if (!name) continue;
    add(name, isNaN(qty) ? 1 : qty);
  }
  return { matched, unmatched };
}
