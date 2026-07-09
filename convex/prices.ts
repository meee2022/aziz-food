import { authQuery as query, authMutation as mutation } from "./auth";
import { v } from "convex/values";
import { todayStr, priceOnDate } from "./helpers";

/** أسعار اليوم لكل الأصناف (لشاشة تحديث الأسعار اليومية). */
export const daily = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    const items = await ctx.db
      .query("items")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const out: any[] = [];
    for (const it of items) {
      const todayRec = await ctx.db
        .query("priceHistory")
        .withIndex("by_item_date", (q) => q.eq("itemId", it._id).eq("date", date))
        .first();
      const prev = await priceOnDate(ctx, it._id, date);
      out.push({
        itemId: it._id,
        nameEn: it.nameEn,
        nameAr: it.nameAr,
        unit: it.unit,
        categoryId: it.categoryId,
        cost: todayRec?.cost ?? prev?.cost ?? it.defaultCost,
        sell: todayRec?.sell ?? prev?.sell ?? it.defaultSell,
        updatedToday: !!todayRec,
      });
    }
    return out.sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  },
});

/** حفظ/تحديث سعر صنف ليوم محدد (upsert في priceHistory + الافتراضي في الصنف). */
export const setPrice = mutation({
  args: {
    itemId: v.id("items"),
    cost: v.number(),
    sell: v.number(),
    date: v.optional(v.string()),
    note: v.optional(v.string()),
    changedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    const existing = await ctx.db
      .query("priceHistory")
      .withIndex("by_item_date", (q) => q.eq("itemId", args.itemId).eq("date", date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cost: args.cost,
        sell: args.sell,
        note: args.note,
        changedBy: args.changedBy,
      });
    } else {
      await ctx.db.insert("priceHistory", {
        itemId: args.itemId,
        date,
        cost: args.cost,
        sell: args.sell,
        note: args.note,
        changedBy: args.changedBy,
        createdAt: Date.now(),
      });
    }
    // حدّث الافتراضي في الصنف ليكون أحدث سعر
    await ctx.db.patch(args.itemId, {
      defaultCost: args.cost,
      defaultSell: args.sell,
      updatedAt: Date.now(),
    });
  },
});

/** حفظ دفعة أسعار (من الجدول السريع أو استيراد Excel). */
export const setPricesBulk = mutation({
  args: {
    date: v.optional(v.string()),
    changedBy: v.optional(v.string()),
    rows: v.array(
      v.object({ itemId: v.id("items"), cost: v.number(), sell: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    let updated = 0;
    for (const r of args.rows) {
      const existing = await ctx.db
        .query("priceHistory")
        .withIndex("by_item_date", (q) => q.eq("itemId", r.itemId).eq("date", date))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { cost: r.cost, sell: r.sell, changedBy: args.changedBy });
      } else {
        await ctx.db.insert("priceHistory", {
          itemId: r.itemId,
          date,
          cost: r.cost,
          sell: r.sell,
          changedBy: args.changedBy,
          createdAt: Date.now(),
        });
      }
      await ctx.db.patch(r.itemId, {
        defaultCost: r.cost,
        defaultSell: r.sell,
        updatedAt: Date.now(),
      });
      updated++;
    }
    return { updated };
  },
});

/** استيراد أصناف/أسعار من Excel: يطابق بالاسم، ينشئ الجديد ويحدّث الموجود. */
export const importItems = mutation({
  args: {
    date: v.optional(v.string()),
    changedBy: v.optional(v.string()),
    rows: v.array(
      v.object({
        name: v.string(),
        unit: v.string(),
        cost: v.optional(v.number()),
        sell: v.number(),
        category: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    const now = Date.now();
    const allItems = await ctx.db.query("items").collect();
    const byName = new Map<string, any>(allItems.map((i: any) => [i.nameEn.trim().toLowerCase(), i]));
    const cats = await ctx.db.query("categories").collect();
    const catByName = new Map<string, any>(cats.map((c: any) => [c.nameEn.trim().toLowerCase(), c._id]));

    let created = 0,
      updated = 0;
    for (const r of args.rows) {
      const key = r.name.trim().toLowerCase();
      if (!key) continue;
      const cost = r.cost ?? 0;
      let categoryId = r.category ? catByName.get(r.category.trim().toLowerCase()) : undefined;

      let item: any = byName.get(key);
      if (!item) {
        const id = await ctx.db.insert("items", {
          nameEn: r.name.trim(),
          unit: r.unit || "KG",
          categoryId,
          defaultCost: cost,
          defaultSell: r.sell,
          active: true,
          createdAt: now,
          updatedAt: now,
        });
        item = (await ctx.db.get(id))!;
        byName.set(key, item);
        created++;
      } else {
        await ctx.db.patch(item._id, {
          unit: r.unit || item.unit,
          defaultCost: cost || item.defaultCost,
          defaultSell: r.sell,
          categoryId: categoryId ?? item.categoryId,
          updatedAt: now,
        });
        updated++;
      }
      // سجّل السعر في تاريخ الأسعار لهذا اليوم
      const existing = await ctx.db
        .query("priceHistory")
        .withIndex("by_item_date", (q) => q.eq("itemId", item!._id).eq("date", date))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { cost, sell: r.sell, note: "استيراد Excel", changedBy: args.changedBy });
      } else {
        await ctx.db.insert("priceHistory", {
          itemId: item._id,
          date,
          cost,
          sell: r.sell,
          note: "استيراد Excel",
          changedBy: args.changedBy,
          createdAt: now,
        });
      }
    }
    return { created, updated };
  },
});
