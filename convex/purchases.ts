import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { round2, todayStr } from "./helpers";

export const list = query({
  args: { from: v.optional(v.string()), to: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("purchases").withIndex("by_date").order("desc").collect();
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** تسجيل مشترى من مورّد. يحدّث سعر تكلفة الصنف لليوم اختياريًا. */
export const create = mutation({
  args: {
    date: v.optional(v.string()),
    supplier: v.optional(v.string()),
    itemId: v.optional(v.id("items")),
    itemName: v.string(),
    qty: v.number(),
    cost: v.number(),
    note: v.optional(v.string()),
    updateCostPrice: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    const id = await ctx.db.insert("purchases", {
      date,
      supplier: args.supplier,
      itemId: args.itemId,
      itemName: args.itemName,
      qty: args.qty,
      cost: args.cost,
      total: round2(args.qty * args.cost),
      note: args.note,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    if (args.updateCostPrice && args.itemId) {
      const existing = await ctx.db
        .query("priceHistory")
        .withIndex("by_item_date", (q) => q.eq("itemId", args.itemId!).eq("date", date))
        .first();
      const item = await ctx.db.get(args.itemId);
      const sell = existing?.sell ?? item?.defaultSell ?? args.cost;
      if (existing) await ctx.db.patch(existing._id, { cost: args.cost });
      else
        await ctx.db.insert("priceHistory", {
          itemId: args.itemId,
          date,
          cost: args.cost,
          sell,
          note: "من فاتورة شراء",
          createdAt: Date.now(),
        });
      await ctx.db.patch(args.itemId, { defaultCost: args.cost, updatedAt: Date.now() });
    }
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("purchases") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
