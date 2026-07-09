import { adminQuery, adminMutation } from "./auth";
import { v } from "convex/values";

const role = v.union(
  v.literal("admin"),
  v.literal("sales"),
  v.literal("accountant"),
  v.literal("warehouse"),
);

/** قائمة المستخدمين (للمدير فقط) — لا تُرجع كلمة السر إطلاقًا. */
export const list = adminQuery({
  args: {},
  handler: async (ctx: any) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u: any) => ({ id: u._id, name: u.name, role: u.role, active: u.active, hasPin: !!u.pin, owner: !!u.owner }));
  },
});

export const create = adminMutation({
  args: { name: v.string(), pin: v.string(), role },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.query("users").withIndex("by_pin", (q: any) => q.eq("pin", args.pin)).first();
    if (existing) throw new Error("كلمة السر مستخدمة بالفعل، اختر غيرها");
    return await ctx.db.insert("users", { ...args, active: true, createdAt: Date.now() });
  },
});

export const update = adminMutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    pin: v.optional(v.string()),
    role: v.optional(role),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...rest } = args;
    const target = await ctx.db.get(id);
    // حساب المالك لا يعدّله إلا هو نفسه
    if (target?.owner && ctx.user.id !== id) throw new Error("لا يمكن تعديل حساب المالك");
    await ctx.db.patch(id, rest);
  },
});

export const remove = adminMutation({
  args: { id: v.id("users") },
  handler: async (ctx: any, { id }: any) => {
    const target = await ctx.db.get(id);
    if (target?.owner) throw new Error("لا يمكن حذف حساب المالك");
    await ctx.db.patch(id, { active: false });
  },
});
