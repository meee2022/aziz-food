/**
 * تحديث تلقائي: بعد كل نشر جديد على Vercel يحمل التطبيق النسخة الجديدة من نفسه
 * بدل أن يبقى التاب المفتوح على الكود القديم (فتظهر تعديلات "مش شغّالة").
 *
 * الآلية: البناء يضع معرّف البناء داخل الكود (__BUILD_ID__) ويكتب الملف /version.json
 * بنفس المعرّف. نفحص الملف عند الرجوع للتاب وكل دقيقة؛ لو اختلف المعرّف نعيد التحميل.
 */
declare const __BUILD_ID__: string;

const CURRENT = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
let pending = false;

/** لا نعيد التحميل والمستخدم في منتصف كتابة (فاتورة جديدة/تعديل أو حقل مُركّز عليه). */
function safeToReload(): boolean {
  const p = location.pathname;
  if (/\/invoice\/(new|[^/]+\/edit)$/.test(p)) return false;
  const a = document.activeElement as HTMLElement | null;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  return true;
}

async function check(): Promise<void> {
  if (CURRENT === "dev") return; // لا شيء في التطوير
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== CURRENT) pending = true;
  } catch { /* بلا شبكة — نحاول لاحقًا */ }
  if (pending && safeToReload()) location.reload();
}

export function startAutoUpdate(): void {
  if (import.meta.env.DEV || CURRENT === "dev") return; // لا شيء في التطوير
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  window.addEventListener("focus", () => check());
  // عند التنقّل داخل التطبيق (لو كان هناك تحديث معلّق تأجّل بسبب الكتابة)
  window.addEventListener("popstate", () => { if (pending && safeToReload()) location.reload(); });
  setInterval(check, 60_000);
  setTimeout(check, 5_000);
}
