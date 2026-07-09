import { authQuery, authMutation } from "./auth";
import { v } from "convex/values";
import { round2, todayStr } from "./helpers";

/** مصروفات خلال فترة + الإجمالي وتوزيعه حسب البند. */
export const list = authQuery({
  args: { from: v.optional(v.string()), to: v.optional(v.string()), category: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    let rows = await ctx.db.query("expenses").withIndex("by_date").order("desc").collect();
    if (args.from) rows = rows.filter((r: any) => r.date >= args.from);
    if (args.to) rows = rows.filter((r: any) => r.date <= args.to);
    if (args.category) rows = rows.filter((r: any) => r.category === args.category);
    rows.sort((a: any, b: any) => b.createdAt - a.createdAt);

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      total = round2(total + r.amount);
      byCategory[r.category] = round2((byCategory[r.category] ?? 0) + r.amount);
    }
    const breakdown = Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { rows, total, breakdown };
  },
});

export const create = authMutation({
  args: {
    date: v.optional(v.string()),
    category: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
    paidTo: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.insert("expenses", {
      date: todayStr(args.date),
      category: args.category,
      amount: args.amount,
      note: args.note,
      paidTo: args.paidTo,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const update = authMutation({
  args: {
    id: v.id("expenses"),
    date: v.optional(v.string()),
    category: v.optional(v.string()),
    amount: v.optional(v.number()),
    note: v.optional(v.string()),
    paidTo: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const remove = authMutation({
  args: { id: v.id("expenses") },
  handler: async (ctx: any, { id }: any) => {
    await ctx.db.delete(id);
  },
});
