import { internalAction, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * إشعارات واتساب: عند وصول طلب جديد من عميل، تُجدوَل هذه الـ action
 * فترسل رسالة واتساب لرقم المالك عبر المزوّد المضبوط في الإعدادات.
 * لا تُرسل أي شيء إلا إذا فعّلت الإشعارات وضبطت الرقم والمفتاح.
 */

// ── استعلامات داخلية مساعدة ──

export const getSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;
    return s;
  },
});

export const getOrderSummary = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const o = await ctx.db.get(orderId);
    if (!o) return null;
    const total = o.lines.reduce((t, l) => t + l.qtyRequested * l.unitPrice, 0);
    return {
      number: o.number,
      customerName: o.customerName,
      date: o.date,
      note: o.note ?? "",
      lines: o.lines.map((l) => ({ name: l.name, qty: l.qtyRequested, unit: l.unit })),
      total: Math.round(total * 100) / 100,
    };
  },
});

/** التحقق من أن الـ token يخص مديرًا (للزر التجريبي). */
export const checkAdmin = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (!s) return false;
    return s.role === "admin";
  },
});

// ── الإرسال الفعلي ──

async function sendWhatsApp(settings: Record<string, string>, text: string) {
  if (settings.waNotifyEnabled !== "true") return { skipped: "disabled" };
  const phone = (settings.waPhone ?? "").replace(/\D/g, "");
  if (!phone) return { skipped: "no-phone" };
  const apiKey = settings.waApiKey ?? "";
  if (!apiKey) return { skipped: "no-apikey" };
  const provider = settings.waProvider || "callmebot";

  try {
    if (provider === "callmebot") {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent("+" + phone)}` +
        `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url);
      return { ok: r.ok, status: r.status, provider };
    }
    if (provider === "ultramsg") {
      const instance = settings.waInstanceId ?? "";
      if (!instance) return { skipped: "no-instance" };
      const r = await fetch(`https://api.ultramsg.com/${instance}/messages/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: apiKey, to: "+" + phone, body: text }).toString(),
      });
      return { ok: r.ok, status: r.status, provider };
    }
    return { skipped: "unknown-provider" };
  } catch (e: any) {
    return { error: String(e?.message ?? e) };
  }
}

/** تُجدوَل من orders.place عند وصول طلب جديد. */
export const sendOrderNotification = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const settings = await ctx.runQuery(internal.notify.getSettings, {});
    if (settings.waNotifyEnabled !== "true") return { skipped: "disabled" };
    const o = await ctx.runQuery(internal.notify.getOrderSummary, { orderId });
    if (!o) return { skipped: "no-order" };

    const items = o.lines.map((l) => `• ${l.name} × ${l.qty} ${l.unit}`).join("\n");
    const cur = settings.currency || "ر.ق";
    const text =
      `🛒 طلب جديد ${o.number}\n` +
      `العميل: ${o.customerName}\n` +
      `التاريخ: ${o.date}\n\n${items}\n\n` +
      `الإجمالي المتوقع: ${o.total} ${cur}` +
      (o.note ? `\nملاحظة العميل: ${o.note}` : "");

    return await sendWhatsApp(settings, text);
  },
});

/** زر "إرسال رسالة تجريبية" من شاشة الإعدادات (للمدير فقط). */
export const testWhatsApp = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const isAdmin = await ctx.runQuery(internal.notify.checkAdmin, { token });
    if (!isAdmin) throw new Error("غير مصرّح — للمدير فقط");
    const settings = await ctx.runQuery(internal.notify.getSettings, {});
    const res = await sendWhatsApp(settings, "✅ رسالة تجريبية من تطبيق إدارة الجملة — الإشعارات تعمل.");
    return res;
  },
});
