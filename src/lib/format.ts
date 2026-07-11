let CURRENCY = "ر.ق";
export function setCurrency(c: string) {
  CURRENCY = c || "ر.ق";
}
export function currency() {
  return CURRENCY;
}

/** تنسيق مبلغ مالي بأرقام لاتينية واضحة + رمز العملة. */
export function money(n: number | undefined | null, withSymbol = true): string {
  const v = n ?? 0;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol ? `${s} ${CURRENCY}` : s;
}

export function num(n: number | undefined | null, dp = 2): string {
  const v = n ?? 0;
  return v.toLocaleString("en-US", { maximumFractionDigits: dp });
}

/** مصدر سعر البيع كما تعيده effectivePrice: [عربي، إنجليزي، صنف الشارة]. */
export const PRICE_SOURCE: Record<string, [string, string, string]> = {
  customer:   ["خاص بالعميل", "Customer", "badge-champion"],
  priceList:  ["قائمة أسعار", "Price list", "badge-info"],
  listMargin: ["هامش القائمة", "List margin", "badge-info"],
  default:    ["سعر اليوم", "Today", "badge-muted"],
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** تجهيز رقم للواتساب: أرقام فقط + مفتاح الدولة (قطر 974 افتراضيًا). */
export function waPhone(raw: string | undefined | null, countryCode = "974"): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);           // 00974... → 974...
  if (d.startsWith(countryCode)) return d;          // فيه المفتاح بالفعل
  if (d.length <= 8) return countryCode + d;         // رقم محلي (8 أرقام) → أضف المفتاح
  return d;                                          // رقم دولي آخر — اتركه
}

export function formatDate(d: string, lang: "ar" | "en" = "ar"): string {
  try {
    const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
    return date.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function formatDateTime(ms: number, lang: "ar" | "en" = "ar"): string {
  return new Date(ms).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/* ── تفقيط: تحويل المبلغ إلى كلمات عربية (ريال قطري) ── */
const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rem) {
    if (rem < 20) parts.push(ONES[rem]);
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      if (o) parts.push(ONES[o] + " و" + TENS[t]);
      else parts.push(TENS[t]);
    }
  }
  return parts.join(" و");
}

function intToArabic(n: number): string {
  if (n === 0) return "صفر";
  const groups: [number, string, string, string][] = [
    [1_000_000_000, "مليار", "ملياران", "مليارات"],
    [1_000_000, "مليون", "مليونان", "ملايين"],
    [1_000, "ألف", "ألفان", "آلاف"],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [value, sing, dual, plural] of groups) {
    const count = Math.floor(rest / value);
    rest = rest % value;
    if (count === 0) continue;
    if (count === 1) parts.push(sing);
    else if (count === 2) parts.push(dual);
    else if (count >= 3 && count <= 10) parts.push(under1000(count) + " " + plural);
    else parts.push(under1000(count) + " " + sing);
  }
  if (rest) parts.push(under1000(rest));
  return parts.join(" و");
}

/** المبلغ كتابةً بالعربي مع العملة، مثال: "ألف ومئتان وخمسون ريالاً قطرياً وخمسون درهماً فقط لا غير". */
export function amountInWordsAr(amount: number): string {
  const riyals = Math.floor(Math.abs(amount));
  const dirhams = Math.round((Math.abs(amount) - riyals) * 100);
  let s = intToArabic(riyals) + " ريال قطري";
  if (dirhams > 0) s += " و" + intToArabic(dirhams) + " درهم";
  return s + " فقط لا غير";
}

/* ── التفقيط بالإنجليزية ── */
const ONES_EN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS_EN = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function threeEn(n: number): string {
  let s = "";
  const h = Math.floor(n / 100), r = n % 100;
  if (h) s += ONES_EN[h] + " hundred";
  if (r) {
    if (s) s += " ";
    if (r < 20) s += ONES_EN[r];
    else { s += TENS_EN[Math.floor(r / 10)]; if (r % 10) s += "-" + ONES_EN[r % 10]; }
  }
  return s;
}

function intToEn(n: number): string {
  if (n === 0) return "zero";
  const scales: [number, string][] = [[1_000_000_000, "billion"], [1_000_000, "million"], [1_000, "thousand"]];
  let s = "", rest = n;
  for (const [v, name] of scales) {
    const c = Math.floor(rest / v); rest = rest % v;
    if (c) s += (s ? " " : "") + threeEn(c) + " " + name;
  }
  if (rest) s += (s ? " " : "") + threeEn(rest);
  return s;
}

/** المبلغ كتابةً بالإنجليزية، مثال: "One thousand ninety-eight Qatari Riyals and fifty Dirhams only". */
export function amountInWordsEn(amount: number): string {
  const riyals = Math.floor(Math.abs(amount));
  const dirhams = Math.round((Math.abs(amount) - riyals) * 100);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  let s = cap(intToEn(riyals)) + " Qatari Riyal" + (riyals === 1 ? "" : "s");
  if (dirhams > 0) s += " and " + intToEn(dirhams) + " Dirham" + (dirhams === 1 ? "" : "s");
  return s + " only";
}
