import { authQuery as query, authMutation as mutation } from "./auth";
import { v } from "convex/values";
import { round2, todayStr, logAction, recomputeBalance, recomputeInvoicePaid } from "./helpers";

const method = v.union(v.literal("cash"), v.literal("transfer"), v.literal("card"));
const allocations = v.array(v.object({ invoiceId: v.id("invoices"), amount: v.number() }));

export const list = query({
  args: { customerId: v.optional(v.id("customers")), from: v.optional(v.string()), to: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let rows = args.customerId
      ? await ctx.db.query("payments").withIndex("by_customer", (q) => q.eq("customerId", args.customerId!)).collect()
      : await ctx.db.query("payments").withIndex("by_date").order("desc").collect();
    if (args.from) rows = rows.filter((r) => r.date >= args.from!);
    if (args.to) rows = rows.filter((r) => r.date <= args.to!);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("payments") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

/** تسجيل دفعة تحصيل، مع توزيع اختياري على فواتير محددة. */
export const create = mutation({
  args: {
    customerId: v.id("customers"),
    amount: v.number(),
    date: v.optional(v.string()),
    method,
    allocations: v.optional(allocations),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("العميل غير موجود");
    const allocs = (args.allocations ?? []).filter((a) => a.amount > 0);
    const id = await ctx.db.insert("payments", {
      customerId: args.customerId,
      customerName: customer.name,
      amount: args.amount,
      date: todayStr(args.date),
      method: args.method,
      allocations: allocs.length ? allocs : undefined,
      note: args.note,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    for (const a of allocs) await recomputeInvoicePaid(ctx, a.invoiceId);
    await recomputeBalance(ctx, args.customerId);
    await logAction(ctx, "payment", "create", { entityId: id, userName: args.createdBy, details: `${customer.name} — ${args.amount}` });
    return id;
  },
});

/** تعديل دفعة (تصحيح المبلغ/الطريقة/التاريخ/التوزيع). */
export const update = mutation({
  args: {
    id: v.id("payments"),
    amount: v.optional(v.number()),
    date: v.optional(v.string()),
    method: v.optional(method),
    allocations: v.optional(allocations),
    note: v.optional(v.string()),
    editedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.id);
    if (!p) throw new Error("الدفعة غير موجودة");
    const oldInvoices = new Set((p.allocations ?? []).map((a) => a.invoiceId));
    const newAllocs = args.allocations !== undefined
      ? args.allocations.filter((a) => a.amount > 0)
      : p.allocations ?? [];
    await ctx.db.patch(args.id, {
      amount: args.amount ?? p.amount,
      date: args.date ?? p.date,
      method: args.method ?? p.method,
      note: args.note ?? p.note,
      allocations: newAllocs.length ? newAllocs : undefined,
    });
    // أعد حساب المدفوع لكل الفواتير المتأثرة (القديمة + الجديدة)
    const affected = new Set<any>([...oldInvoices, ...newAllocs.map((a) => a.invoiceId)]);
    for (const invId of affected) await recomputeInvoicePaid(ctx, invId);
    await recomputeBalance(ctx, p.customerId);
    await logAction(ctx, "payment", "edit", { entityId: args.id, userName: args.editedBy, details: `${p.customerName}` });
  },
});

export const remove = mutation({
  args: { id: v.id("payments"), by: v.optional(v.string()) },
  handler: async (ctx, { id, by }) => {
    const p = await ctx.db.get(id);
    if (!p) return;
    const invoices = (p.allocations ?? []).map((a) => a.invoiceId);
    await ctx.db.delete(id);
    for (const invId of invoices) await recomputeInvoicePaid(ctx, invId);
    if (p.invoiceId) await recomputeInvoicePaid(ctx, p.invoiceId);
    await recomputeBalance(ctx, p.customerId);
    await logAction(ctx, "payment", "delete", { entityId: id, userName: by, details: `${p.customerName} — ${p.amount}` });
  },
});
