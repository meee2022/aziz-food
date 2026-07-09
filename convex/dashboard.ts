import { authQuery as query } from "./auth";
import { v } from "convex/values";
import { todayStr, round2 } from "./helpers";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const overview = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = todayStr(args.date);
    const weekAgo = addDays(today, -6);
    const monthAgo = addDays(today, -29);

    const invoices = (await ctx.db.query("invoices").collect()).filter((i) => i.status === "approved");
    const customers = await ctx.db.query("customers").collect();
    const items = await ctx.db.query("items").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const expenses = await ctx.db.query("expenses").collect();

    const sumExp = (pred: (e: any) => boolean) => round2(expenses.filter(pred).reduce((s: number, e: any) => s + e.amount, 0));
    const todayExpenses = sumExp((e) => e.date === today);
    const weekExpenses = sumExp((e) => e.date >= weekAgo);
    const monthExpenses = sumExp((e) => e.date >= monthAgo);

    const todayInv = invoices.filter((i) => i.date === today);
    const weekInv = invoices.filter((i) => i.date >= weekAgo);
    const monthInv = invoices.filter((i) => i.date >= monthAgo);

    const sum = (arr: typeof invoices, k: "total" | "expectedProfit") => round2(arr.reduce((s, i) => s + i[k], 0));

    // أفضل العملاء + أكثر الأصناف مبيعًا/ربحًا (خلال الشهر)
    const custAgg = new Map<string, { name: string; total: number }>();
    const itemQty = new Map<string, { name: string; unit: string; qty: number; profit: number; sales: number }>();
    for (const inv of monthInv) {
      const c = custAgg.get(inv.customerId) ?? { name: inv.customerName, total: 0 };
      c.total = round2(c.total + inv.total);
      custAgg.set(inv.customerId, c);
      for (const l of inv.lines) {
        const key = l.name;
        const it = itemQty.get(key) ?? { name: l.name, unit: l.unit, qty: 0, profit: 0, sales: 0 };
        it.qty = round2(it.qty + l.qty);
        it.sales = round2(it.sales + l.qty * l.unitPrice);
        it.profit = round2(it.profit + l.qty * (l.unitPrice - l.cost));
        itemQty.set(key, it);
      }
    }
    const topCustomers = [...custAgg.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const topItems = [...itemQty.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topProfitItems = [...itemQty.values()].sort((a, b) => b.profit - a.profit).slice(0, 5);

    // المديونيات
    const debtors = customers.filter((c) => c.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const totalReceivable = round2(debtors.reduce((s, c) => s + c.balance, 0));

    // سلسلة آخر 7 أيام (مبيعات/أرباح)
    const series: { date: string; sales: number; profit: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const dayInv = invoices.filter((x) => x.date === d);
      series.push({ date: d, sales: sum(dayInv, "total"), profit: sum(dayInv, "expectedProfit"), count: dayInv.length });
    }

    // ── تنبيهات ذكية ──
    const alerts: { type: string; level: "danger" | "warning" | "info"; msg: string }[] = [];
    const belowCostToday = todayInv.filter((i) => i.belowCost);
    if (belowCostToday.length)
      alerts.push({ type: "belowCost", level: "danger", msg: `${belowCostToday.length} فاتورة اليوم بها بيع بأقل من التكلفة` });
    const overLimit = customers.filter((c) => c.creditLimit && c.balance > c.creditLimit);
    for (const c of overLimit)
      alerts.push({ type: "creditLimit", level: "danger", msg: `${c.name} تجاوز الحد الائتماني (${round2(c.balance)})` });
    // أصناف لم تُسعّر اليوم
    let notPricedToday = 0;
    for (const it of items) {
      const rec = await ctx.db
        .query("priceHistory")
        .withIndex("by_item_date", (q) => q.eq("itemId", it._id).eq("date", today))
        .first();
      if (!rec) notPricedToday++;
    }
    if (notPricedToday > 0)
      alerts.push({ type: "notPriced", level: "warning", msg: `${notPricedToday} صنف لم يُحدَّث سعره اليوم` });
    if (debtors.length)
      alerts.push({ type: "debts", level: "info", msg: `${debtors.length} عميل عليهم مديونية بإجمالي ${totalReceivable}` });

    return {
      today,
      todaySales: sum(todayInv, "total"),
      todayProfit: sum(todayInv, "expectedProfit"),
      todayCount: todayInv.length,
      weekSales: sum(weekInv, "total"),
      weekProfit: sum(weekInv, "expectedProfit"),
      monthSales: sum(monthInv, "total"),
      monthProfit: sum(monthInv, "expectedProfit"),
      todayExpenses,
      weekExpenses,
      monthExpenses,
      todayNet: round2(sum(todayInv, "expectedProfit") - todayExpenses),
      monthNet: round2(sum(monthInv, "expectedProfit") - monthExpenses),
      customerCount: customers.filter((c) => c.active).length,
      itemCount: items.length,
      totalReceivable,
      debtorCount: debtors.length,
      topDebtors: debtors.slice(0, 5).map((c) => ({ name: c.name, balance: round2(c.balance) })),
      topCustomers,
      topItems,
      topProfitItems,
      series,
      alerts,
    };
  },
});
