import { authQuery as query } from "./auth";
import { v } from "convex/values";
import { round2 } from "./helpers";

/** تقارير المبيعات/الأرباح خلال فترة، مجمّعة بعدة أبعاد. */
export const sales = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const invoices = (await ctx.db.query("invoices").collect()).filter(
      (i) => i.status === "approved" && i.date >= from && i.date <= to,
    );

    const byDay = new Map<string, { date: string; sales: number; profit: number; count: number }>();
    const byCustomer = new Map<string, { name: string; sales: number; profit: number; count: number }>();
    const byItem = new Map<string, { name: string; unit: string; qty: number; sales: number; profit: number }>();

    let totalSales = 0, totalProfit = 0, totalCost = 0;
    for (const inv of invoices) {
      totalSales = round2(totalSales + inv.total);
      totalProfit = round2(totalProfit + inv.expectedProfit);
      totalCost = round2(totalCost + inv.cost);

      const d = byDay.get(inv.date) ?? { date: inv.date, sales: 0, profit: 0, count: 0 };
      d.sales = round2(d.sales + inv.total); d.profit = round2(d.profit + inv.expectedProfit); d.count++;
      byDay.set(inv.date, d);

      const c = byCustomer.get(inv.customerId) ?? { name: inv.customerName, sales: 0, profit: 0, count: 0 };
      c.sales = round2(c.sales + inv.total); c.profit = round2(c.profit + inv.expectedProfit); c.count++;
      byCustomer.set(inv.customerId, c);

      for (const l of inv.lines) {
        const it = byItem.get(l.name) ?? { name: l.name, unit: l.unit, qty: 0, sales: 0, profit: 0 };
        it.qty = round2(it.qty + l.qty);
        it.sales = round2(it.sales + l.qty * l.unitPrice);
        it.profit = round2(it.profit + l.qty * (l.unitPrice - l.cost));
        byItem.set(l.name, it);
      }
    }

    return {
      from, to,
      totals: { sales: totalSales, profit: totalProfit, cost: totalCost, count: invoices.length },
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byCustomer: [...byCustomer.values()].sort((a, b) => b.sales - a.sales),
      byItem: [...byItem.values()].sort((a, b) => b.sales - a.sales),
    };
  },
});

/** تقرير مديونيات العملاء. */
export const receivables = query({
  args: {},
  handler: async (ctx) => {
    const customers = (await ctx.db.query("customers").collect())
      .filter((c) => c.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);
    const total = round2(customers.reduce((s, c) => s + c.balance, 0));
    return {
      total,
      rows: customers.map((c) => ({
        id: c._id, name: c.name, type: c.type, phone: c.phone,
        balance: round2(c.balance), creditLimit: c.creditLimit ?? null,
        overLimit: !!(c.creditLimit && c.balance > c.creditLimit),
      })),
    };
  },
});
