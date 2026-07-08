import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { effectivePrice, todayStr } from "./helpers";

const customerType = v.union(
  v.literal("restaurant"),
  v.literal("cafe"),
  v.literal("hotel"),
  v.literal("supermarket"),
  v.literal("catering"),
  v.literal("cash"),
);
const paymentMethod = v.union(v.literal("cash"), v.literal("credit"), v.literal("transfer"));

export const list = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const rows = args.includeInactive
      ? await ctx.db.query("customers").collect()
      : await ctx.db.query("customers").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const lists = await ctx.db.query("priceLists").collect();
    const listMap = new Map(lists.map((l) => [l._id, l]));
    return rows
      .map((c) => ({ ...c, priceList: c.priceListId ? listMap.get(c.priceListId) ?? null : null }))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const create = mutation({
  args: {
    name: v.string(),
    nameEn: v.optional(v.string()),
    type: customerType,
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    area: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    paymentMethod,
    creditLimit: v.optional(v.number()),
    priceListId: v.optional(v.id("priceLists")),
    discountPct: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customers", {
      ...args,
      balance: 0,
      favorite: false,
      active: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    type: v.optional(customerType),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    area: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    paymentMethod: v.optional(paymentMethod),
    creditLimit: v.optional(v.number()),
    priceListId: v.optional(v.id("priceLists")),
    discountPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    favorite: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, rest);
  },
});

export const toggleFavorite = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    const c = await ctx.db.get(id);
    if (c) await ctx.db.patch(id, { favorite: !c.favorite });
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { active: false });
  },
});

/** أسعار كل الأصناف لعميل محدد (لعرض قائمة أسعاره / داخل الفاتورة). */
export const priceListFor = query({
  args: { customerId: v.optional(v.id("customers")), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const date = todayStr(args.date);
    const items = await ctx.db
      .query("items")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const out: any[] = [];
    for (const it of items) {
      const p = await effectivePrice(ctx, { itemId: it._id, customerId: args.customerId ?? null, date });
      out.push({
        itemId: it._id,
        name: it.nameEn,
        nameAr: it.nameAr,
        unit: it.unit,
        categoryId: it.categoryId,
        sell: p.sell,
        cost: p.cost,
        source: p.source, // customer / priceList / listMargin / default
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** حفظ سعر خاص لصنف لعميل (upsert). سعر صفر أو فارغ = حذف الخاص. */
export const setCustomerPrice = mutation({
  args: { customerId: v.id("customers"), itemId: v.id("items"), price: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customerPrices")
      .withIndex("by_customer_item", (q) =>
        q.eq("customerId", args.customerId).eq("itemId", args.itemId),
      )
      .first();
    if (args.price === undefined || args.price === null) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    if (existing) await ctx.db.patch(existing._id, { price: args.price });
    else
      await ctx.db.insert("customerPrices", {
        customerId: args.customerId,
        itemId: args.itemId,
        price: args.price,
      });
  },
});

/** تثبيت أسعار خاصة لعميل دفعةً واحدة بالاسم (استيراد Excel لأسعار عميل). */
export const setCustomerPricesByName = mutation({
  args: {
    customerId: v.id("customers"),
    rows: v.array(v.object({ name: v.string(), price: v.number() })),
    replace: v.optional(v.boolean()), // امسح الأسعار الخاصة الحالية أولًا
  },
  handler: async (ctx, args) => {
    if (args.replace) {
      const cur = await ctx.db
        .query("customerPrices")
        .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
        .collect();
      for (const e of cur) await ctx.db.delete(e._id);
    }
    const items = await ctx.db.query("items").collect();
    const byName = new Map(items.map((i) => [i.nameEn.trim().toLowerCase(), i._id]));
    let set = 0;
    const missed: string[] = [];
    for (const r of args.rows) {
      const itemId = byName.get(r.name.trim().toLowerCase());
      if (!itemId) { missed.push(r.name); continue; }
      const existing = await ctx.db
        .query("customerPrices")
        .withIndex("by_customer_item", (q) => q.eq("customerId", args.customerId).eq("itemId", itemId))
        .first();
      if (existing) await ctx.db.patch(existing._id, { price: r.price });
      else await ctx.db.insert("customerPrices", { customerId: args.customerId, itemId, price: r.price });
      set++;
    }
    return { set, missed };
  },
});

/** نسخ قائمة أسعار عميل إلى عميل آخر (نسخ الأسعار الخاصة). */
export const copyCustomerPrices = mutation({
  args: { fromId: v.id("customers"), toId: v.id("customers") },
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("customerPrices")
      .withIndex("by_customer", (q) => q.eq("customerId", args.fromId))
      .collect();
    // امسح الحالية للهدف
    const existing = await ctx.db
      .query("customerPrices")
      .withIndex("by_customer", (q) => q.eq("customerId", args.toId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);
    for (const s of source) {
      await ctx.db.insert("customerPrices", {
        customerId: args.toId,
        itemId: s.itemId,
        price: s.price,
      });
    }
    // انسخ أيضًا قائمة الأسعار والخصم
    const from = await ctx.db.get(args.fromId);
    if (from) await ctx.db.patch(args.toId, { priceListId: from.priceListId, discountPct: from.discountPct });
    return { copied: source.length };
  },
});

/** كشف حساب العميل: الفواتير + المدفوعات + الرصيد. */
export const statement = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const customer = await ctx.db.get(customerId);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();

    const approved = invoices.filter((i) => i.status === "approved");
    const totalInvoiced = approved.reduce((s, i) => s + i.total, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    // حركة موحّدة مرتبة زمنيًا
    const ledger = [
      ...approved.map((i) => ({
        kind: "invoice" as const,
        date: i.date,
        ref: i.number,
        debit: i.total,
        credit: 0,
        at: i.createdAt,
        id: i._id,
      })),
      ...payments.map((p) => ({
        kind: "payment" as const,
        date: p.date,
        ref: p.method,
        debit: 0,
        credit: p.amount,
        at: p.createdAt,
        id: p._id,
        method: p.method,
        note: p.note ?? "",
        allocations: p.allocations ?? [],
      })),
    ].sort((a, b) => a.at - b.at);

    let running = 0;
    const withBalance = ledger.map((row) => {
      running += row.debit - row.credit;
      return { ...row, balance: running };
    });

    return {
      customer,
      totalInvoiced,
      totalPaid,
      balance: totalInvoiced - totalPaid,
      invoiceCount: approved.length,
      lastPayment: payments.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      ledger: withBalance.reverse(),
    };
  },
});
