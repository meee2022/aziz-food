import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("admin"),
  v.literal("sales"),
  v.literal("accountant"),
  v.literal("warehouse"),
);

/** تسجيل دخول مبسّط برمز PIN (يُستبدل بمزوّد مصادقة حقيقي لاحقًا). */
export const login = query({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const user = await ctx.db.query("users").withIndex("by_pin", (q) => q.eq("pin", pin)).first();
    if (!user || !user.active) return null;
    return { id: user._id, name: user.name, role: user.role };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ id: u._id, name: u.name, role: u.role, active: u.active, pin: u.pin }));
  },
});

export const create = mutation({
  args: { name: v.string(), pin: v.string(), role },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").withIndex("by_pin", (q) => q.eq("pin", args.pin)).first();
    if (existing) throw new Error("رمز الدخول مستخدم بالفعل");
    return await ctx.db.insert("users", { ...args, active: true, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    pin: v.optional(v.string()),
    role: v.optional(role),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { active: false });
  },
});
