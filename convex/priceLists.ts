import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const lists = await ctx.db.query("priceLists").collect();
    const out: any[] = [];
    for (const l of lists) {
      const count = (
        await ctx.db.query("priceListItems").withIndex("by_list", (q) => q.eq("priceListId", l._id)).collect()
      ).length;
      out.push({ ...l, itemCount: count });
    }
    return out;
  },
});

export const create = mutation({
  args: { nameAr: v.string(), nameEn: v.string(), marginPct: v.optional(v.number()), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db.insert("priceLists", { ...args, createdAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("priceLists"),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    marginPct: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("priceLists") },
  handler: async (ctx, { id }) => {
    const items = await ctx.db.query("priceListItems").withIndex("by_list", (q) => q.eq("priceListId", id)).collect();
    for (const it of items) await ctx.db.delete(it._id);
    await ctx.db.delete(id);
  },
});

/** أسعار الأصناف داخل قائمة أسعار محددة. */
export const items = query({
  args: { priceListId: v.id("priceLists") },
  handler: async (ctx, { priceListId }) => {
    const rows = await ctx.db
      .query("priceListItems")
      .withIndex("by_list", (q) => q.eq("priceListId", priceListId))
      .collect();
    return rows;
  },
});

export const setItemPrice = mutation({
  args: { priceListId: v.id("priceLists"), itemId: v.id("items"), price: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("priceListItems")
      .withIndex("by_list_item", (q) => q.eq("priceListId", args.priceListId).eq("itemId", args.itemId))
      .first();
    if (args.price === undefined || args.price === null) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    if (existing) await ctx.db.patch(existing._id, { price: args.price });
    else await ctx.db.insert("priceListItems", { priceListId: args.priceListId, itemId: args.itemId, price: args.price });
  },
});
