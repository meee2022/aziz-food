/**
 * تشفير كلمات السر (PIN/بوابة العملاء).
 * كلمة السر هي نفسها المُعرِّف عند الدخول، فنحتاج تشفيرًا حتميًا (نفس المدخل ⇒ نفس الناتج)
 * حتى نبحث عنه بالفهرس. نضيف "فلفلًا" سريًا من متغيّر البيئة AUTH_PEPPER ليقاوم جداول القوس قزح.
 * القيم المشفّرة تُخزَّن بادئتها "sha256$" لتمييزها عن القديمة (نص صريح) أثناء الترقية التدريجية.
 */

const PREFIX = "sha256$";

export function isHashed(v: string | undefined | null): boolean {
  return !!v && v.startsWith(PREFIX);
}

export async function hashSecret(secret: string): Promise<string> {
  // process.env متاح في وقت تشغيل Convex؛ نصل إليه عبر globalThis لتفادي حاجة أنواع Node في فحص الواجهة
  const pepper = (globalThis as any).process?.env?.AUTH_PEPPER ?? "";
  const data = new TextEncoder().encode(pepper + "|" + secret);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return PREFIX + hex;
}

/** يطابق كلمة السر مع القيمة المخزّنة (مشفّرة كانت أو نصًا صريحًا قديمًا). */
export async function verifySecret(entered: string, stored: string | undefined | null): Promise<boolean> {
  if (!stored) return false;
  if (isHashed(stored)) return (await hashSecret(entered)) === stored;
  return entered === stored; // قيمة قديمة بنص صريح
}
