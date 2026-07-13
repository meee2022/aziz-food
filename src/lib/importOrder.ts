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

/** قراءة ملف إكسيل طلب وتحويله لأصناف مطابقة (بدون ذكاء اصطناعي). */
export async function parseExcelOrder(file: File, catalog: CatalogItem[]): Promise<ImportResult> {
  const rows = await readExcelRaw(file);
  const matched: ParsedLine[] = [];
  const unmatched: string[] = [];
  const seen = new Map<string, ParsedLine>();

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    // اسم = أول خلية نصية طويلة؛ الكمية = أول رقم موجب
    let name = "";
    let qty = NaN;
    for (const cell of row) {
      if (cell === null || cell === undefined || String(cell).trim() === "") continue;
      const n = Number(String(cell).replace(/[,٬،]/g, "."));
      if (!name && isNaN(n) && String(cell).trim().length >= 2) name = String(cell).trim();
      else if (isNaN(qty) && !isNaN(n) && n > 0) qty = n;
    }
    if (!name) continue;
    if (isNaN(qty)) qty = 1; // بدون كمية ⇒ 1
    if (/^(الصنف|اسم|item|name|description|رقم|qty|الكمية|price|السعر)/i.test(name)) continue; // تخطّي الترويسة

    const it = matchItem(catalog, name);
    if (it) {
      const prev = seen.get(it.itemId);
      if (prev) prev.qty = Math.round((prev.qty + qty) * 100) / 100;
      else { const line = { itemId: it.itemId, name: it.name, nameAr: it.nameAr, unit: it.unit, qty }; seen.set(it.itemId, line); matched.push(line); }
    } else unmatched.push(name);
  }
  return { matched, unmatched };
}
