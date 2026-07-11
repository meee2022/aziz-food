import { authQuery as query, authMutation as mutation } from "./auth";
import { v } from "convex/values";
import { round2, todayStr, logAction, recomputeBalance } from "./helpers";

const returnLine = v.object({
  itemId: v.optional(v.id("items")),
  name: v.string(),
  unit: v.string(),
  qty: v.number(),
  unitPrice: v.number(),
  cost: v.number(),
  note: v.optional(v.string()),
});

/** قائمة المرتجعات (الأحدث أولًا)، مع فلترة اختيارية بعميل. */
export const list = query({
  args: { customerId: v.optional(v.id("customers")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let rows;
    if (args.customerId) {
      rows = await ctx.db.query("returns").withIndex("by_customer", (q) => q.eq("customerId", args.customerId!)).collect();
    } else {
      rows = await ctx.db.query("returns").withIndex("by_date").order("desc").collect();
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, args.limit ?? 200);
  },
});

/** تسجيل مرتجع: يُنقص مديونية العميل بقيمته. */
export const create = mutation({
  args: {
    customerId: v.id("customers"),
    invoiceId: v.optional(v.id("invoices")),
    invoiceNumber: v.optional(v.string()),
    date: v.optional(v.string()),
    lines: v.array(returnLine),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("العميل غير موجود");

    const lines = args.lines
      .filter((l) => l.qty > 0)
      .map((l) => ({ ...l, lineTotal: round2(l.qty * l.unitPrice) }));
    if (lines.length === 0) throw new Error("أضف صنفًا واحدًا على الأقل بكمية أكبر من صفر");

    const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

    const id = await ctx.db.insert("returns", {
      invoiceId: args.invoiceId,
      invoiceNumber: args.invoiceNumber,
      customerId: args.customerId,
      customerName: customer.name,
      date: todayStr(args.date),
      lines,
      total,
      note: args.note,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });

    await recomputeBalance(ctx, args.customerId);
    await logAction(ctx, "return", "create", {
      entityId: id, userName: args.createdBy,
      details: `مرتجع ${customer.name} بقيمة ${total}${args.invoiceNumber ? ` — فاتورة ${args.invoiceNumber}` : ""}`,
    });
    return id;
  },
});

/** حذف مرتجع وإرجاع المديونية كما كانت. */
export const remove = mutation({
  args: { id: v.id("returns"), by: v.optional(v.string()) },
  handler: async (ctx, { id, by }) => {
    const r = await ctx.db.get(id);
    if (!r) return;
    await ctx.db.delete(id);
    await recomputeBalance(ctx, r.customerId);
    await logAction(ctx, "return", "delete", {
      entityId: id, userName: by,
      details: `حذف مرتجع ${r.customerName} بقيمة ${r.total}`,
    });
  },
});
