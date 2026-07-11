import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { hashSecret, verifySecret } from "./hash";

/**
 * أوامر طوارئ للمالك (break-glass) — دوال internal لا تُتاح عبر واجهة التطبيق
 * ولا الـ API العام إطلاقًا، وتُشغَّل فقط من جهاز المالك عبر:
 *   npx convex run admin:ensureOwner '{"name":"...","pin":"..."}'
 * فيستحيل أن يُقفَل المالك خارج التطبيق، ولا يقدر أحد غيره على استدعائها.
 */

/** إنشاء/إعادة ضبط حساب المالك (Super Admin). يُشغَّل من الـ CLI عند الحاجة. */
export const ensureOwner = internalMutation({
  args: { name: v.string(), pin: v.string() },
  handler: async (ctx, { name, pin }) => {
    if (pin.length < 4) throw new Error("كلمة السر 4 خانات على الأقل");
    const users = await ctx.db.query("users").collect();
    const hashed = await hashSecret(pin);
    // تأكّد أن كلمة السر لا تخصّ حسابًا آخر (غير حساب المالك) — مشفّرة كانت أو قديمة
    for (const u of users) {
      if (u.owner) continue;
      if (await verifySecret(pin, u.pin)) throw new Error("كلمة السر مستخدمة لحساب آخر، اختر غيرها");
    }

    const owner = users.find((u) => u.owner);
    if (owner) {
      await ctx.db.patch(owner._id, { name, pin: hashed, role: "admin", active: true, owner: true });
      return { action: "updated", name };
    }
    await ctx.db.insert("users", { name, pin: hashed, role: "admin", owner: true, active: true, createdAt: Date.now() });
    return { action: "created", name };
  },
});

/** إبطال كل الجلسات النشطة (لو خشيت أن أحدًا دخل) — CLI فقط. */
export const revokeAllSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("sessions").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { revoked: rows.length };
  },
});

/** عرض الحسابات (بدون كلمات السر) — CLI فقط، لأغراض الاسترداد. */
export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ name: u.name, role: u.role, active: u.active, owner: !!u.owner }));
  },
});
