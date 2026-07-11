import { adminQuery } from "./auth";
import { v } from "convex/values";

/**
 * نسخة احتياطية كاملة — للمدير فقط.
 * تُصدَّر كل البيانات ما عدا الأسرار: كلمات سر الموظفين (pin) وكلمات سر بوابة العملاء (loginPin)
 * والجلسات — فلا تتسرّب في ملف يُحفَظ خارج النظام.
 */
export const exportAll = adminQuery({
  args: {},
  handler: async (ctx) => {
    const all = async (name: any) => await ctx.db.query(name).collect();
    const strip = (rows: any[], keys: string[]) =>
      rows.map((r) => { const c = { ...r }; for (const k of keys) delete c[k]; return c; });

    const [
      customers, items, categories, priceHistory, priceLists, priceListItems,
      customerPrices, invoices, returns, payments, purchases, expenses, orders, users, auditLog, settings,
    ] = await Promise.all([
      all("customers"), all("items"), all("categories"), all("priceHistory"), all("priceLists"), all("priceListItems"),
      all("customerPrices"), all("invoices"), all("returns"), all("payments"), all("purchases"), all("expenses"),
      all("orders"), all("users"), all("auditLog"), all("settings"),
    ]);

    return {
      exportedAt: Date.now(),
      counts: {
        customers: customers.length, items: items.length, invoices: invoices.length,
        payments: payments.length, returns: returns.length, expenses: expenses.length,
        purchases: purchases.length, orders: orders.length,
      },
      data: {
        customers: strip(customers, ["loginPin"]),
        items, categories, priceHistory, priceLists, priceListItems, customerPrices,
        invoices, returns, payments, purchases, expenses, orders,
        users: strip(users, ["pin"]),
        auditLog, settings,
      },
    };
  },
});
