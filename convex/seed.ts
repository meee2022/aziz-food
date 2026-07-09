import { mutation } from "./_generated/server";
import { adminMutation } from "./auth";
import { v } from "convex/values";
import { round2 } from "./helpers";

/**
 * بيانات الأصناف مستخرجة من ملفّي Excel (mohamed shahin):
 * [الاسم EN, الاسم AR, الوحدة, التصنيف, سعر بيع اليوم, سعر قديم (اختياري)].
 * سعر التكلفة يُقدَّر بـ 75% من البيع (لا يوجد في الملفات) ويمكن تعديله لاحقًا.
 */
const CATS: [string, string][] = [
  ["Vegetables", "خضروات"],
  ["Fruits", "فواكه"],
  ["Leafy", "ورقيات"],
  ["Herbs", "أعشاب"],
  ["Berries", "توتيات"],
];

const ITEMS: [string, string, string, string, number, number | null][] = [
  ["(Sweet) Rock Melon", "شمام", "KG", "Fruits", 10, 10],
  ["Apple Green", "تفاح أخضر", "KG", "Fruits", 10, 6.5],
  ["Asparagus (Small Size)", "هليون", "KG", "Vegetables", 80, 70],
  ["Avocado Hass", "أفوكادو", "Box", "Fruits", 80, 12],
  ["Baby Rocca", "جرجير", "Pkt125", "Leafy", 9, 8],
  ["Baby Spinach", "سبانخ", "Pkt125", "Leafy", 9, 8],
  ["Banana", "موز", "KG", "Fruits", 8, 5],
  ["Basil Leaves", "ريحان", "KG", "Herbs", 70, 70],
  ["Beetroot", "شمندر", "KG", "Vegetables", 5, 6],
  ["Black berry", "توت أسود", "Pkt125", "Berries", 20, 16.5],
  ["Blue berry", "توت أزرق", "Pkt125", "Berries", 10, 13],
  ["Brocoli fresh", "بروكلي", "KG", "Vegetables", 20, 14],
  ["Carrot", "جزر", "KG", "Vegetables", 6, 4],
  ["Cauliflower", "قرنبيط", "KG", "Vegetables", 10, 4],
  ["Cherry Tomato", "طماطم كرزية", "Pkt250", "Vegetables", 8, 22],
  ["Corinder leaves", "كزبرة", "KG", "Herbs", 15, 15],
  ["Cucumber", "خيار", "KG", "Vegetables", 6, 4.5],
  ["Fresh Orange", "برتقال", "KG", "Fruits", 5, 4],
  ["Garlic", "ثوم", "KG", "Vegetables", 8, 7],
  ["Ginger fresh", "زنجبيل", "KG", "Vegetables", 8, 9],
  ["Green Bell Pepper", "فلفل أخضر", "KG", "Vegetables", 7, 5],
  ["Iceberg Lettuce", "خس أيسبرغ", "Box", "Leafy", 50, 11.5],
  ["Lemon", "ليمون", "KG", "Fruits", 10, 5],
  ["Long Green Chilly", "فلفل حار أخضر", "KG", "Vegetables", 15, 10],
  ["Mint Leaves", "نعناع", "KG", "Herbs", 15, 16],
  ["Mushroom", "مشروم", "Pkt250", "Vegetables", 7, 5.5],
  ["Parsley Leaves", "بقدونس", "KG", "Herbs", 15, 12],
  ["Pineapple", "أناناس", "KG", "Fruits", 12, 14],
  ["Pomegranate", "رمان", "KG", "Fruits", 20, 13],
  ["Red Bell Pepper", "فلفل أحمر", "KG", "Vegetables", 14, 13],
  ["Red Cabage", "ملفوف أحمر", "KG", "Vegetables", 5, 5],
  ["Red Onion", "بصل أحمر", "KG", "Vegetables", 4, 2.5],
  ["Red Radish", "فجل أحمر", "KG", "Vegetables", 22, 20],
  ["Spring Onion", "بصل أخضر", "KG", "Leafy", 16, 12],
  ["Strawberry", "فراولة", "Pkt250", "Berries", 20, 40],
  ["Sweet Potato", "بطاطا حلوة", "KG", "Vegetables", 10, 6],
  ["Tomato", "طماطم", "KG", "Vegetables", 5, 3.4],
  ["White Cabbage", "ملفوف أبيض", "KG", "Vegetables", 4, 3.5],
  ["White Onion", "بصل أبيض", "KG", "Vegetables", 5, 5],
  ["Yellow Bell Pepper", "فلفل أصفر", "KG", "Vegetables", 14, 13],
  ["Celery Stick", "كرفس", "KG", "Vegetables", 28, null],
  ["Dill Leaves", "شبت", "KG", "Herbs", 15, null],
  ["Green Chilli", "فلفل أخضر حار", "KG", "Vegetables", 15, null],
  ["Leeks", "كراث", "KG", "Vegetables", 28, null],
  ["Mandarine", "يوسفي", "KG", "Fruits", 8, null],
  ["Mango", "مانجو", "KG", "Fruits", 14, null],
  ["Potato", "بطاطس", "KG", "Vegetables", 3.5, 2.75],
  ["Red Grapes", "عنب أحمر", "KG", "Fruits", 18, null],
  ["Romani Lettuce", "خس روماني", "Box", "Leafy", 80, null],
];

const USERS: [string, string, "admin" | "sales" | "accountant" | "warehouse"][] = [
  ["المدير", "1234", "admin"],
  ["مندوب المبيعات", "1111", "sales"],
  ["المحاسب", "2222", "accountant"],
  ["أمين المخزن", "3333", "warehouse"],
];

const PRICE_LISTS: [string, string, number][] = [
  ["Restaurants", "قائمة المطاعم", 0],
  ["Hotels", "قائمة الفنادق", 10],
  ["Cafes", "قائمة الكافيهات", 5],
  ["VIP", "قائمة كبار العملاء", -5],
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export const run = mutation({
  args: { force: v.optional(v.boolean()), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("items").first();
    if (existing && !args.force) {
      return { skipped: true, message: "توجد بيانات بالفعل. مرّر force=true لإعادة التهيئة." };
    }
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const oldDate = daysAgo(7);

    // التصنيفات
    const catIds = new Map<string, any>();
    let sort = 0;
    for (const [en, ar] of CATS) {
      const id = await ctx.db.insert("categories", { nameEn: en, nameAr: ar, sort: sort++ });
      catIds.set(en, id);
    }

    // المستخدمون
    for (const [name, pin, role] of USERS) {
      const dup = await ctx.db.query("users").withIndex("by_pin", (q) => q.eq("pin", pin)).first();
      if (!dup) await ctx.db.insert("users", { name, pin, role, active: true, createdAt: now });
    }

    // قوائم الأسعار
    const listIds = new Map<string, any>();
    for (const [en, ar, margin] of PRICE_LISTS) {
      const id = await ctx.db.insert("priceLists", { nameEn: en, nameAr: ar, marginPct: margin, createdAt: now });
      listIds.set(en, id);
    }

    // الأصناف + تاريخ الأسعار (قديم + اليوم)
    let count = 0;
    for (const [en, ar, unit, cat, sell, oldSell] of ITEMS) {
      const cost = round2(sell * 0.75);
      const itemId = await ctx.db.insert("items", {
        nameEn: en,
        nameAr: ar,
        unit,
        categoryId: catIds.get(cat),
        defaultCost: cost,
        defaultSell: sell,
        origin: "local",
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      // نقطة سعر قديمة (من الملف الأول) إن وُجدت
      if (oldSell != null) {
        await ctx.db.insert("priceHistory", {
          itemId, date: oldDate, cost: round2(oldSell * 0.75), sell: oldSell,
          note: "سعر سابق", createdAt: now,
        });
      }
      // سعر اليوم (من الملف الثاني)
      await ctx.db.insert("priceHistory", {
        itemId, date: today, cost, sell, note: "سعر اليوم", createdAt: now,
      });
      count++;
    }

    // إعدادات عامة
    const setSetting = async (key: string, value: string) => {
      const ex = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", key)).first();
      if (ex) await ctx.db.patch(ex._id, { value });
      else await ctx.db.insert("settings", { key, value });
    };
    await setSetting("companyName", "مدم مي للتجارة");
    await setSetting("companyNameEn", "MADAME TRADING");
    await setSetting("cr", "147672");
    await setSetting("phone", "55239250");
    await setSetting("email", "azizhmicheh@outlook.sa");
    await setSetting("addressAr", "عين خالد 56، مبنى: 299، الدوحة – قطر");
    await setSetting("addressEn", "Ain Khalid-56, Building: 299, Doha-Qatar.");
    await setSetting("currency", "ر.ق");
    await setSetting("taxPct", "0");

    return { skipped: false, categories: CATS.length, items: count, users: USERS.length, priceLists: PRICE_LISTS.length };
  },
});

/** حذف كل البيانات (للمدير فقط، للتجارب). */
export const clearAll = adminMutation({
  args: { confirm: v.string() },
  handler: async (ctx: any, { confirm }: any) => {
    if (confirm !== "DELETE") throw new Error("مرّر confirm='DELETE' للتأكيد");
    const tables = [
      "invoices", "payments", "purchases", "returns", "priceHistory",
      "priceListItems", "customerPrices", "items", "customers", "priceLists",
      "categories", "counters", "auditLog", "settings", "users",
    ] as const;
    for (const t of tables) {
      const rows = await ctx.db.query(t).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    return { cleared: true };
  },
});
