import { authQuery, authMutation, customerQuery, customerMutation } from "./auth";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { effectivePrice, todayStr, round2, nextInvoiceNumber, logAction, recomputeBalance } from "./helpers";

async function nextOrderNumber(ctx: any): Promise<string> {
  const counter = await ctx.db.query("counters").withIndex("by_name", (q: any) => q.eq("name", "order")).first();
  let value = 1;
  if (counter) { value = counter.value + 1; await ctx.db.patch(counter._id, { value }); }
  else await ctx.db.insert("counters", { name: "order", value: 1 });
  return "ORD-" + String(value).padStart(6, "0");
}

/* ─────────── جهة العميل (بوابة الطلبات) ─────────── */

/** إنشاء طلب جديد من العميل. */
export const place = customerMutation({
  args: {
    lines: v.array(v.object({ itemId: v.id("items"), qty: v.number() })),
    note: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const customerId = ctx.user.customerId;
    const customer = await ctx.db.get(customerId);
    if (!customer) throw new Error("العميل غير موجود");
    const date = todayStr();
    const lines: any[] = [];
    for (const l of args.lines) {
      if (!l.qty || l.qty <= 0) continue;
      const it = await ctx.db.get(l.itemId);
      if (!it) continue;
      const p = await effectivePrice(ctx, { itemId: l.itemId, customerId, date });
      lines.push({
        itemId: l.itemId, name: it.nameEn, unit: it.unit,
        qtyRequested: l.qty, qtyApproved: l.qty, available: true,
        unitPrice: p.sell, cost: p.cost,
      });
    }
    if (lines.length === 0) throw new Error("الطلب فارغ");
    const number = await nextOrderNumber(ctx);
    const id = await ctx.db.insert("orders", {
      number, customerId, customerName: customer.name, date,
      status: "pending", lines, note: args.note, createdAt: Date.now(),
    });
    // إشعار واتساب للمالك (يعمل فقط إن كانت الإشعارات مفعّلة في الإعدادات)
    await ctx.scheduler.runAfter(0, internal.notify.sendOrderNotification, { orderId: id });
    return { id, number };
  },
});

/** طلبات العميل الحالي. */
export const myOrders = customerQuery({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query("orders").withIndex("by_customer", (q: any) => q.eq("customerId", ctx.user.customerId)).collect();
    return rows.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

/** أسعار أصناف العميل الحالي (لعرضها في بوابة الطلب). */
export const myItems = customerQuery({
  args: {},
  handler: async (ctx: any) => {
    const items = await ctx.db.query("items").withIndex("by_active", (q: any) => q.eq("active", true)).collect();
    const cats = await ctx.db.query("categories").collect();
    const catMap = new Map(cats.map((c: any) => [c._id, c]));
    const date = todayStr();
    const out: any[] = [];
    for (const it of items) {
      const p = await effectivePrice(ctx, { itemId: it._id, customerId: ctx.user.customerId, date });
      out.push({
        itemId: it._id, name: it.nameEn, nameAr: it.nameAr, unit: it.unit,
        categoryId: it.categoryId,
        category: it.categoryId ? catMap.get(it.categoryId) ?? null : null,
        sell: p.sell,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/* ─────────── جهة الموظف/المالك (مراجعة واعتماد) ─────────── */

export const list = authQuery({
  args: { status: v.optional(v.union(v.literal("pending"), v.literal("confirmed"), v.literal("rejected"))) },
  handler: async (ctx: any, args: any) => {
    let rows = await ctx.db.query("orders").withIndex("by_status").order("desc").collect();
    if (args.status) rows = rows.filter((r: any) => r.status === args.status);
    return rows.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});

export const pendingCount = authQuery({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query("orders").withIndex("by_status", (q: any) => q.eq("status", "pending")).collect();
    return rows.length;
  },
});

export const get = authQuery({
  args: { id: v.id("orders") },
  handler: async (ctx: any, { id }: any) => {
    const o = await ctx.db.get(id);
    if (!o) return null;
    const customer = await ctx.db.get(o.customerId);
    return { ...o, customer };
  },
});

/** مراجعة الطلب: تحديد المتاح/غير المتاح والكميات المعتمدة وملاحظة. */
export const review = authMutation({
  args: {
    id: v.id("orders"),
    lines: v.array(v.object({ index: v.number(), available: v.boolean(), qtyApproved: v.number() })),
    ownerNote: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const o = await ctx.db.get(args.id);
    if (!o) throw new Error("الطلب غير موجود");
    if (o.status !== "pending") throw new Error("لا يمكن مراجعة طلب مغلق");
    const lines = o.lines.map((l: any, i: number) => {
      const u = args.lines.find((x: any) => x.index === i);
      return u ? { ...l, available: u.available, qtyApproved: u.qtyApproved } : l;
    });
    await ctx.db.patch(args.id, { lines, ownerNote: args.ownerNote, reviewedBy: ctx.user.name, reviewedAt: Date.now() });
  },
});

/** اعتماد الطلب → إنشاء فاتورة بالأصناف المتاحة (كمية معتمدة > 0). */
export const confirm = authMutation({
  args: { id: v.id("orders"), approveInvoice: v.optional(v.boolean()), ownerNote: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const o = await ctx.db.get(args.id);
    if (!o) throw new Error("الطلب غير موجود");
    if (o.status !== "pending") throw new Error("الطلب مغلق بالفعل");
    const customer = await ctx.db.get(o.customerId);
    if (!customer) throw new Error("العميل غير موجود");

    const invLines = o.lines
      .filter((l: any) => l.available && l.qtyApproved > 0)
      .map((l: any) => ({
        itemId: l.itemId, name: l.name, unit: l.unit,
        qty: l.qtyApproved, unitPrice: l.unitPrice, cost: l.cost,
        lineTotal: round2(l.qtyApproved * l.unitPrice),
      }));
    if (invLines.length === 0) throw new Error("لا توجد أصناف متاحة لإنشاء فاتورة");

    const subtotal = round2(invLines.reduce((s: number, l: any) => s + l.lineTotal, 0));
    const cost = round2(invLines.reduce((s: number, l: any) => s + l.qty * l.cost, 0));
    const number = await nextInvoiceNumber(ctx);
    const now = Date.now();
    const status = args.approveInvoice ? "approved" : "draft";
    const invId = await ctx.db.insert("invoices", {
      number, customerId: o.customerId, customerName: customer.name, date: todayStr(),
      status, lines: invLines,
      subtotal, discount: 0, discountType: "amount", discountValue: 0,
      taxPct: 0, taxAmount: 0, total: subtotal, cost, expectedProfit: round2(subtotal - cost),
      paidAmount: 0, notes: `من الطلب ${o.number}`,
      belowCost: invLines.some((l: any) => l.unitPrice < l.cost),
      createdBy: ctx.user.name, createdAt: now,
      approvedBy: status === "approved" ? ctx.user.name : undefined,
      approvedAt: status === "approved" ? now : undefined,
    });
    if (status === "approved") {
      await recomputeBalance(ctx, o.customerId);
    }
    await ctx.db.patch(args.id, { status: "confirmed", invoiceId: invId, ownerNote: args.ownerNote, reviewedBy: ctx.user.name, reviewedAt: now });
    await logAction(ctx, "order", "confirm", { entityId: args.id, userName: ctx.user.name, details: `${o.number} → ${number}` });
    return { invoiceId: invId, invoiceNumber: number };
  },
});

export const reject = authMutation({
  args: { id: v.id("orders"), ownerNote: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const o = await ctx.db.get(args.id);
    if (!o) return;
    await ctx.db.patch(args.id, { status: "rejected", ownerNote: args.ownerNote, reviewedBy: ctx.user.name, reviewedAt: Date.now() });
  },
});
