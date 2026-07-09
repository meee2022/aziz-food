import { query } from "./_generated/server";
import { adminMutation } from "./auth";
import { v } from "convex/values";

/** إعدادات عامة (اسم الشركة/العملة) — عامة لأنها تُعرض في شاشة الدخول قبل تسجيل الدخول.
 *  تقبل token اختياريًا (يُتجاهَل) حتى تعمل مع حقن الـ token في الواجهة. */
export const all = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },
});

export const set = adminMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx: any, { key, value }: any) => {
    const ex = await ctx.db.query("settings").withIndex("by_key", (q: any) => q.eq("key", key)).first();
    if (ex) await ctx.db.patch(ex._id, { value });
    else await ctx.db.insert("settings", { key, value });
  },
});
