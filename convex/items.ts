import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { priceOnDate, todayStr, round2 } from "./helpers";

/** كل الأصناف مع سعر اليوم (تكلفة/بيع) وهامش الربح. */
export const list = query({
  args: { date: v.optional(v.string()), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    const items = args.includeInactive
      ? await ctx.db.query("items").collect()
      : await ctx.db
          .query("items")
          .withIndex("by_active", (q) => q.eq("active", true))
          .collect();

    const cats = await ctx.db.query("categories").collect();
    const catMap = new Map(cats.map((c) => [c._id, c]));

    const out: any[] = [];
    for (const it of items) {
      const daily = await priceOnDate(ctx, it._id, date);
      const cost = daily?.cost ?? it.defaultCost;
      const sell = daily?.sell ?? it.defaultSell;
      const margin = sell > 0 ? round2(((sell - cost) / sell) * 100) : 0;
      const pricedToday = !!(await ctx.db
        .query("priceHistory")
        .withIndex("by_item_date", (q) => q.eq("itemId", it._id).eq("date", date))
        .first());
      out.push({
        ...it,
        category: it.categoryId ? catMap.get(it.categoryId) ?? null : null,
        todayCost: cost,
        todaySell: sell,
        marginPct: margin,
        pricedToday, // هل حُدّث سعره اليوم؟
      });
    }
    return out.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  },
});

export const get = query({
  args: { id: v.id("items") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

/** تاريخ أسعار صنف خلال فترة. */
export const priceHistory = query({
  args: { itemId: v.id("items"), limit: v.optional(v.number()) },
  handler: async (ctx, { itemId, limit }) => {
    const rows = await ctx.db
      .query("priceHistory")
      .withIndex("by_item_date", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(limit ?? 60);
    return rows;
  },
});

export const create = mutation({
  args: {
    nameEn: v.string(),
    nameAr: v.optional(v.string()),
    unit: v.string(),
    categoryId: v.optional(v.id("categories")),
    defaultCost: v.number(),
    defaultSell: v.number(),
    origin: v.optional(v.union(v.literal("local"), v.literal("imported"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("items", {
      ...args,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    // سجّل السعر كنقطة في تاريخ الأسعار
    await ctx.db.insert("priceHistory", {
      itemId: id,
      date: todayStr(),
      cost: args.defaultCost,
      sell: args.defaultSell,
      note: "إنشاء الصنف",
      createdAt: now,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("items"),
    nameEn: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    unit: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    defaultCost: v.optional(v.number()),
    defaultSell: v.optional(v.number()),
    origin: v.optional(v.union(v.literal("local"), v.literal("imported"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, { ...rest, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, { id }) => {
    // حذف ناعم للحفاظ على سلامة الفواتير القديمة
    await ctx.db.patch(id, { active: false, updatedAt: Date.now() });
  },
});
