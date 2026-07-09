import { authQuery as query, authMutation as mutation } from "./auth";
import { v } from "convex/values";
import { round2, todayStr, nextInvoiceNumber, logAction, recomputeBalance } from "./helpers";

const lineInput = v.object({
  itemId: v.optional(v.id("items")),
  name: v.string(),
  unit: v.string(),
  qty: v.number(),
  unitPrice: v.number(),
  cost: v.number(),
  note: v.optional(v.string()),
});

const discountType = v.union(v.literal("amount"), v.literal("percent"));

/** حساب إجماليات الفاتورة من الأسطر والخصم والضريبة. */
function computeTotals(
  lines: { qty: number; unitPrice: number; cost: number }[],
  discountType: "amount" | "percent",
  discountValue: number,
  taxPct: number,
) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const cost = round2(lines.reduce((s, l) => s + l.qty * l.cost, 0));
  const discount =
    discountType === "percent" ? round2((subtotal * discountValue) / 100) : round2(discountValue);
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = round2((afterDiscount * taxPct) / 100);
  const total = round2(afterDiscount + taxAmount);
  const expectedProfit = round2(afterDiscount - cost);
  return { subtotal, cost, discount, taxAmount, total, expectedProfit };
}

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("draft"), v.literal("approved"), v.literal("cancelled"))),
    customerId: v.optional(v.id("customers")),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let rows;
    if (args.customerId) {
      rows = await ctx.db.query("invoices").withIndex("by_customer", (q) => q.eq("customerId", args.customerId!)).collect();
    } else {
      rows = await ctx.db.query("invoices").withIndex("by_date").order("desc").collect();
    }
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, args.limit ?? 200);
  },
});

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, { id }) => {
    const inv = await ctx.db.get(id);
    if (!inv) return null;
    const customer = await ctx.db.get(inv.customerId);
    return { ...inv, customer };
  },
});

/** آخر فاتورة معتمدة لعميل (لميزة "تكرار الطلب"). */
export const lastForCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const rows = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
    const approved = rows.filter((r) => r.status !== "cancelled").sort((a, b) => b.createdAt - a.createdAt);
    return approved[0] ?? null;
  },
});

/** فواتير العميل المعتمدة التي عليها مبلغ متبقٍّ (لتوزيع الدفعات عليها). */
export const outstanding = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const rows = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
    return rows
      .filter((i) => i.status === "approved" && i.total - i.paidAmount > 0.01)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((i) => ({
        _id: i._id,
        number: i.number,
        date: i.date,
        total: i.total,
        paidAmount: i.paidAmount,
        remaining: round2(i.total - i.paidAmount),
      }));
  },
});

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    date: v.optional(v.string()),
    location: v.optional(v.string()),
    lpo: v.optional(v.string()),
    dn: v.optional(v.string()),
    lines: v.array(lineInput),
    discountType: v.optional(discountType),
    discountValue: v.optional(v.number()),
    taxPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("approved"))),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("العميل غير موجود");
    const date = todayStr(args.date);
    const dType = args.discountType ?? "amount";
    const dValue = args.discountValue ?? 0;
    const taxPct = args.taxPct ?? 0;
    const status = args.status ?? "draft";

    const lines = args.lines.map((l) => ({
      ...l,
      lineTotal: round2(l.qty * l.unitPrice),
    }));
    const t = computeTotals(lines, dType, dValue, taxPct);
    const belowCost = lines.some((l) => l.unitPrice < l.cost);
    const number = await nextInvoiceNumber(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("invoices", {
      number,
      customerId: args.customerId,
      customerName: customer.name,
      date,
      location: args.location,
      lpo: args.lpo,
      dn: args.dn,
      status,
      lines,
      subtotal: t.subtotal,
      discount: t.discount,
      discountType: dType,
      discountValue: dValue,
      taxPct,
      taxAmount: t.taxAmount,
      total: t.total,
      cost: t.cost,
      expectedProfit: t.expectedProfit,
      paidAmount: 0,
      notes: args.notes,
      belowCost,
      createdBy: args.createdBy,
      createdAt: now,
      approvedBy: status === "approved" ? args.createdBy : undefined,
      approvedAt: status === "approved" ? now : undefined,
    });

    if (status === "approved") {
      await recomputeBalance(ctx, args.customerId);
    }
    await logAction(ctx, "invoice", status === "approved" ? "create+approve" : "create", {
      entityId: id, userName: args.createdBy, details: `${number} — ${customer.name} — ${t.total}`,
    });
    return { id, number };
  },
});

/** تعديل فاتورة قبل اعتمادها فقط. */
export const update = mutation({
  args: {
    id: v.id("invoices"),
    location: v.optional(v.string()),
    lpo: v.optional(v.string()),
    dn: v.optional(v.string()),
    lines: v.array(lineInput),
    discountType: v.optional(discountType),
    discountValue: v.optional(v.number()),
    taxPct: v.optional(v.number()),
    notes: v.optional(v.string()),
    editedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.id);
    if (!inv) throw new Error("الفاتورة غير موجودة");
    if (inv.status === "cancelled") throw new Error("لا يمكن تعديل فاتورة ملغاة");

    const dType = args.discountType ?? inv.discountType;
    const dValue = args.discountValue ?? inv.discountValue;
    const taxPct = args.taxPct ?? inv.taxPct;
    const lines = args.lines.map((l) => ({ ...l, lineTotal: round2(l.qty * l.unitPrice) }));
    const t = computeTotals(lines, dType, dValue, taxPct);

    await ctx.db.patch(args.id, {
      location: args.location ?? inv.location,
      lpo: args.lpo ?? inv.lpo,
      dn: args.dn ?? inv.dn,
      lines,
      subtotal: t.subtotal,
      discount: t.discount,
      discountType: dType,
      discountValue: dValue,
      taxPct,
      taxAmount: t.taxAmount,
      total: t.total,
      cost: t.cost,
      expectedProfit: t.expectedProfit,
      belowCost: lines.some((l) => l.unitPrice < l.cost),
      notes: args.notes ?? inv.notes,
    });
    // لو الفاتورة معتمدة، تغيّر الإجمالي يؤثر على مديونية العميل → أعد الحساب
    if (inv.status === "approved") await recomputeBalance(ctx, inv.customerId);
    await logAction(ctx, "invoice", inv.status === "approved" ? "edit-approved" : "edit", { entityId: args.id, userName: args.editedBy, details: inv.number });
  },
});

/** اعتماد الفاتورة: تجميد اللقطة وإضافة الإجمالي لمديونية العميل. */
export const approve = mutation({
  args: { id: v.id("invoices"), approvedBy: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.id);
    if (!inv) throw new Error("الفاتورة غير موجودة");
    if (inv.status === "approved") return;
    await ctx.db.patch(args.id, { status: "approved", approvedBy: args.approvedBy, approvedAt: Date.now() });
    await recomputeBalance(ctx, inv.customerId);
    await logAction(ctx, "invoice", "approve", { entityId: args.id, userName: args.approvedBy, details: inv.number });
  },
});

export const cancel = mutation({
  args: { id: v.id("invoices"), by: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const inv = await ctx.db.get(args.id);
    if (!inv) return;
    await ctx.db.patch(args.id, { status: "cancelled" });
    await recomputeBalance(ctx, inv.customerId);
    await logAction(ctx, "invoice", "cancel", { entityId: args.id, userName: args.by, details: inv.number });
  },
});

/** حذف نهائي لأي فاتورة (مسودة/معتمدة/ملغاة) مع إعادة حساب مديونية العميل. */
export const remove = mutation({
  args: { id: v.id("invoices"), by: v.optional(v.string()) },
  handler: async (ctx, { id, by }) => {
    const inv = await ctx.db.get(id);
    if (!inv) return;
    const number = inv.number;
    const customerId = inv.customerId;
    await ctx.db.delete(id);
    // المدفوعات المرتبطة تبقى كحركة للعميل؛ إعادة الحساب تُبقي الرصيد مطابقًا لكشف الحساب
    await recomputeBalance(ctx, customerId);
    await logAction(ctx, "invoice", "delete", { entityId: id, userName: by, details: number });
  },
});
