import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** تاريخ اليوم بصيغة YYYY-MM-DD (يمكن للعميل تمرير تاريخه المحلي). */
export function todayStr(date?: string): string {
  if (date) return date;
  return new Date().toISOString().slice(0, 10);
}

/** أحدث سعر (تكلفة/بيع) لصنف في يوم محدد أو قبله. */
export async function priceOnDate(
  ctx: Ctx,
  itemId: Id<"items">,
  date: string,
): Promise<{ cost: number; sell: number } | null> {
  const rec = await ctx.db
    .query("priceHistory")
    .withIndex("by_item_date", (q) => q.eq("itemId", itemId).lte("date", date))
    .order("desc")
    .first();
  if (!rec) return null;
  return { cost: rec.cost, sell: rec.sell };
}

/**
 * تحديد سعر البيع الفعّال لصنف لعميل في يوم محدد، حسب الأولوية:
 *  1) سعر خاص للعميل لهذا الصنف (customerPrices)
 *  2) سعر الصنف في قائمة أسعار العميل (priceListItems)
 *  3) هامش قائمة الأسعار مطبّق على سعر البيع اليومي
 *  4) سعر البيع اليومي (priceHistory) أو الافتراضي
 * وتُرجع أيضًا التكلفة (سعر اليوم أو الافتراضي) ومصدر السعر.
 */
export async function effectivePrice(
  ctx: Ctx,
  args: {
    itemId: Id<"items">;
    customerId?: Id<"customers"> | null;
    date: string;
  },
): Promise<{ sell: number; cost: number; source: string }> {
  const item = await ctx.db.get(args.itemId);
  const daily = await priceOnDate(ctx, args.itemId, args.date);
  const baseSell = daily?.sell ?? item?.defaultSell ?? 0;
  const cost = daily?.cost ?? item?.defaultCost ?? 0;

  if (args.customerId) {
    const customer = await ctx.db.get(args.customerId);

    // 1) سعر خاص بالعميل
    const cp = await ctx.db
      .query("customerPrices")
      .withIndex("by_customer_item", (q) =>
        q.eq("customerId", args.customerId!).eq("itemId", args.itemId),
      )
      .first();
    if (cp) return { sell: cp.price, cost, source: "customer" };

    // 2) و 3) قائمة أسعار العميل
    if (customer?.priceListId) {
      const pli = await ctx.db
        .query("priceListItems")
        .withIndex("by_list_item", (q) =>
          q.eq("priceListId", customer.priceListId!).eq("itemId", args.itemId),
        )
        .first();
      if (pli) return { sell: pli.price, cost, source: "priceList" };

      const list = await ctx.db.get(customer.priceListId);
      if (list?.marginPct) {
        const sell = round2(baseSell * (1 + list.marginPct / 100));
        return { sell, cost, source: "listMargin" };
      }
    }
  }

  return { sell: baseSell, cost, source: "default" };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** الرقم التسلسلي التالي للفاتورة INV-000001. */
export async function nextInvoiceNumber(ctx: MutationCtx): Promise<string> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "invoice"))
    .first();
  let value = 1;
  if (counter) {
    value = counter.value + 1;
    await ctx.db.patch(counter._id, { value });
  } else {
    await ctx.db.insert("counters", { name: "invoice", value: 1 });
  }
  return "INV-" + String(value).padStart(6, "0");
}

/**
 * إعادة حساب رصيد العميل من الصفر = (مجموع الفواتير المعتمدة − مجموع المدفوعات).
 * تُستدعى بعد أي إنشاء/تعديل/اعتماد/إلغاء/حذف فاتورة أو دفعة، فيظل الرصيد
 * مطابقًا لكشف الحساب دائمًا مهما حصل من تعديلات.
 */
export async function recomputeBalance(ctx: MutationCtx, customerId: Id<"customers">) {
  const invoices = await ctx.db
    .query("invoices")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .collect();
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .collect();
  const invoiced = invoices.filter((i) => i.status === "approved").reduce((s, i) => s + i.total, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  await ctx.db.patch(customerId, { balance: round2(invoiced - paid) });
}

/** إعادة حساب "المدفوع" لفاتورة من مجموع ما خُصّص لها في كل الدفعات. */
export async function recomputeInvoicePaid(ctx: MutationCtx, invoiceId: Id<"invoices">) {
  const inv = await ctx.db.get(invoiceId);
  if (!inv) return;
  const pays = await ctx.db
    .query("payments")
    .withIndex("by_customer", (q) => q.eq("customerId", inv.customerId))
    .collect();
  let paid = 0;
  for (const p of pays) {
    if (p.allocations && p.allocations.length) {
      for (const a of p.allocations) if (a.invoiceId === invoiceId) paid += a.amount;
    } else if (p.invoiceId === invoiceId) {
      paid += p.amount;
    }
  }
  await ctx.db.patch(invoiceId, { paidAmount: round2(paid) });
}

export async function logAction(
  ctx: MutationCtx,
  entity: string,
  action: string,
  opts: { entityId?: string; userName?: string; details?: string } = {},
) {
  await ctx.db.insert("auditLog", {
    entity,
    action,
    entityId: opts.entityId,
    userName: opts.userName,
    details: opts.details,
    at: Date.now(),
  });
}
