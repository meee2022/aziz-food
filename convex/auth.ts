import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * مصادقة على مستوى الخادم بالجلسات (session tokens).
 * كل دوال البيانات تُغلَّف بـ authQuery/authMutation فتتطلب token جلسة صالح،
 * فلا يمكن استدعاء الـ API إطلاقًا بدون تسجيل دخول.
 */

const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 يومًا

async function getSessionUser(ctx: any, token: string | undefined) {
  if (!token) return null;
  const s = await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", token)).first();
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_MS) return null;
  return { id: s.userId ?? s.customerId, name: s.name, role: s.role, customerId: s.customerId ?? null };
}

/** استعلام محميّ: يتطلب token صالح، ويحقن ctx.user. */
export function authQuery(config: { args?: any; handler: (ctx: any, args: any) => any }) {
  return query({
    args: { ...(config.args ?? {}), token: v.string() },
    handler: async (ctx: any, args: any) => {
      const { token, ...rest } = args;
      const user = await getSessionUser(ctx, token);
      if (!user) throw new Error("غير مصرّح — سجّل الدخول");
      return config.handler({ ...ctx, user }, rest);
    },
  });
}

/** طفرة محميّة. */
export function authMutation(config: { args?: any; handler: (ctx: any, args: any) => any }) {
  return mutation({
    args: { ...(config.args ?? {}), token: v.string() },
    handler: async (ctx: any, args: any) => {
      const { token, ...rest } = args;
      const user = await getSessionUser(ctx, token);
      if (!user) throw new Error("غير مصرّح — سجّل الدخول");
      return config.handler({ ...ctx, user }, rest);
    },
  });
}

/** استعلام للمدير فقط. */
export function adminQuery(config: { args?: any; handler: (ctx: any, args: any) => any }) {
  return query({
    args: { ...(config.args ?? {}), token: v.string() },
    handler: async (ctx: any, args: any) => {
      const { token, ...rest } = args;
      const user = await getSessionUser(ctx, token);
      if (!user) throw new Error("غير مصرّح — سجّل الدخول");
      if (user.role !== "admin") throw new Error("هذه الصفحة للمدير فقط");
      return config.handler({ ...ctx, user }, rest);
    },
  });
}

/** طفرة للمدير فقط (إدارة المستخدمين/الإعدادات...). */
export function adminMutation(config: { args?: any; handler: (ctx: any, args: any) => any }) {
  return mutation({
    args: { ...(config.args ?? {}), token: v.string() },
    handler: async (ctx: any, args: any) => {
      const { token, ...rest } = args;
      const user = await getSessionUser(ctx, token);
      if (!user) throw new Error("غير مصرّح — سجّل الدخول");
      if (user.role !== "admin") throw new Error("هذه العملية للمدير فقط");
      return config.handler({ ...ctx, user }, rest);
    },
  });
}

/** استعلام محميّ للعميل فقط (بوابة الطلبات) — يحقن ctx.user.customerId. */
export function customerQuery(config: { args?: any; handler: (ctx: any, args: any) => any }) {
  return query({
    args: { ...(config.args ?? {}), token: v.string() },
    handler: async (ctx: any, args: any) => {
      const { token, ...rest } = args;
      const user = await getSessionUser(ctx, token);
      if (!user || user.role !== "customer" || !user.customerId) throw new Error("غير مصرّح");
      return config.handler({ ...ctx, user }, rest);
    },
  });
}

/** طفرة محميّة للعميل فقط. */
export function customerMutation(config: { args?: any; handler: (ctx: any, args: any) => any }) {
  return mutation({
    args: { ...(config.args ?? {}), token: v.string() },
    handler: async (ctx: any, args: any) => {
      const { token, ...rest } = args;
      const user = await getSessionUser(ctx, token);
      if (!user || user.role !== "customer" || !user.customerId) throw new Error("غير مصرّح");
      return config.handler({ ...ctx, user }, rest);
    },
  });
}

// ── دوال المصادقة العامة (بدون حماية) ──

/** تسجيل الدخول: موظف (users) أو عميل (customers.loginPin). ينشئ جلسة ويُرجع token. */
export const signIn = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const now = Date.now();
    const mkToken = () => crypto.randomUUID() + "." + crypto.randomUUID();

    // موظف
    const u = await ctx.db.query("users").withIndex("by_pin", (q) => q.eq("pin", pin)).first();
    if (u && u.active) {
      const token = mkToken();
      await ctx.db.insert("sessions", { token, userId: u._id, name: u.name, role: u.role, createdAt: now });
      return { token, user: { id: u._id, name: u.name, role: u.role, customerId: null } };
    }

    // عميل (بوابة الطلبات)
    if (pin) {
      const c = await ctx.db.query("customers").withIndex("by_loginPin", (q) => q.eq("loginPin", pin)).first();
      if (c && c.active) {
        const token = mkToken();
        await ctx.db.insert("sessions", { token, customerId: c._id, name: c.name, role: "customer", createdAt: now });
        return { token, user: { id: c._id, name: c.name, role: "customer", customerId: c._id } };
      }
    }
    return null;
  },
});

/** تسجيل الخروج: يحذف الجلسة. */
export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const s = await ctx.db.query("sessions").withIndex("by_token", (q) => q.eq("token", token)).first();
    if (s) await ctx.db.delete(s._id);
  },
});

/** التحقق من الجلسة الحالية (للتأكد أن الـ token ما زال صالحًا). */
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => getSessionUser(ctx, token),
});

/** تغيير كلمة سر المستخدم الحالي نفسه (لأي مستخدم مسجّل دخوله). */
export const changeMyPassword = mutation({
  args: { token: v.string(), newPin: v.string() },
  handler: async (ctx, { token, newPin }) => {
    const user = await getSessionUser(ctx, token);
    if (!user) throw new Error("غير مصرّح");
    if (newPin.length < 4) throw new Error("كلمة السر 4 خانات على الأقل");
    await ctx.db.patch(user.id, { pin: newPin });
    return { ok: true };
  },
});
