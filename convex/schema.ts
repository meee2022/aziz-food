import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * مخطط قاعدة بيانات منصة تجارة جملة الخضروات والفواكه.
 *
 * الأعمدة الثلاثة التي يقوم عليها التصميم (حسب طلب العميل):
 *  1) تاريخ الأسعار  price history  → جدول priceHistory (سعر أي صنف في أي يوم).
 *  2) تسعير خاص لكل عميل customer-specific pricing → priceLists + customerPrices.
 *  3) لقطة الفاتورة الثابتة invoice snapshot → حقول lines داخل invoice تُجمّد
 *     الاسم/الوحدة/السعر/التكلفة وقت البيع، فلا تتأثر بتغيّر الأسعار لاحقًا.
 */

// أنواع مشتركة
const invoiceLine = v.object({
  itemId: v.optional(v.id("items")),
  name: v.string(),        // لقطة الاسم وقت البيع
  unit: v.string(),        // لقطة الوحدة
  qty: v.number(),
  unitPrice: v.number(),   // لقطة سعر البيع
  cost: v.number(),        // لقطة سعر التكلفة (للربح الحقيقي)
  lineTotal: v.number(),   // qty * unitPrice
  note: v.optional(v.string()),
});

export default defineSchema({
  // ── المستخدمون والصلاحيات ──
  users: defineTable({
    name: v.string(),
    pin: v.string(), // رمز دخول مبسّط (يُستبدل بمزوّد مصادقة لاحقًا)
    role: v.union(
      v.literal("admin"),
      v.literal("sales"),
      v.literal("accountant"),
      v.literal("warehouse"),
    ),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_pin", ["pin"]),

  // ── التصنيفات ──
  categories: defineTable({
    nameAr: v.string(),
    nameEn: v.string(),
    color: v.optional(v.string()),
    sort: v.number(),
  }),

  // ── الأصناف ──
  items: defineTable({
    nameEn: v.string(),
    nameAr: v.optional(v.string()),
    unit: v.string(),               // KG / Box / Pkt250 ...
    categoryId: v.optional(v.id("categories")),
    defaultCost: v.number(),        // سعر شراء/تكلفة افتراضي
    defaultSell: v.number(),        // سعر بيع افتراضي
    origin: v.optional(v.union(v.literal("local"), v.literal("imported"))),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["active"])
    .index("by_category", ["categoryId"]),

  // ── تاريخ الأسعار (لكل صنف/يوم) ──
  priceHistory: defineTable({
    itemId: v.id("items"),
    date: v.string(),               // YYYY-MM-DD
    cost: v.number(),
    sell: v.number(),
    changedBy: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_item_date", ["itemId", "date"])
    .index("by_date", ["date"]),

  // ── قوائم الأسعار (مطاعم/فنادق/كافيهات/VIP) ──
  priceLists: defineTable({
    nameAr: v.string(),
    nameEn: v.string(),
    // خصم/هامش عام على القائمة (نسبة). موجب = زيادة على البيع الافتراضي، سالب = خصم.
    marginPct: v.optional(v.number()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }),

  // أسعار صنف محدد داخل قائمة أسعار
  priceListItems: defineTable({
    priceListId: v.id("priceLists"),
    itemId: v.id("items"),
    price: v.number(),
  })
    .index("by_list", ["priceListId"])
    .index("by_list_item", ["priceListId", "itemId"]),

  // سعر خاص لصنف محدد لعميل محدد (أعلى أولوية)
  customerPrices: defineTable({
    customerId: v.id("customers"),
    itemId: v.id("items"),
    price: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_customer_item", ["customerId", "itemId"]),

  // ── العملاء ──
  customers: defineTable({
    name: v.string(),
    nameEn: v.optional(v.string()),   // اسم إنجليزي (يظهر في الفاتورة الرسمية)
    type: v.union(
      v.literal("restaurant"),
      v.literal("cafe"),
      v.literal("hotel"),
      v.literal("supermarket"),
      v.literal("catering"),
      v.literal("cash"),
    ),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    area: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    paymentMethod: v.union(
      v.literal("cash"),
      v.literal("credit"),
      v.literal("transfer"),
    ),
    creditLimit: v.optional(v.number()),
    priceListId: v.optional(v.id("priceLists")),
    discountPct: v.optional(v.number()),
    balance: v.number(),           // مديونية العميل (موجب = مدين لنا)
    favorite: v.boolean(),
    active: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_active", ["active"])
    .index("by_favorite", ["favorite"]),

  // ── الفواتير (مع لقطة ثابتة للأسطر) ──
  invoices: defineTable({
    number: v.string(),            // رقم تلقائي INV-000123
    customerId: v.id("customers"),
    customerName: v.string(),      // لقطة
    date: v.string(),              // YYYY-MM-DD
    location: v.optional(v.string()),   // الموقع
    lpo: v.optional(v.string()),        // رقم الأوردر LPO#
    dn: v.optional(v.string()),         // أمر تسليم DN#
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("cancelled"),
    ),
    lines: v.array(invoiceLine),
    subtotal: v.number(),
    discount: v.number(),          // قيمة الخصم
    discountType: v.union(v.literal("amount"), v.literal("percent")),
    discountValue: v.number(),     // القيمة المدخلة (نسبة أو مبلغ)
    taxPct: v.number(),
    taxAmount: v.number(),
    total: v.number(),             // الصافي
    cost: v.number(),              // إجمالي التكلفة (لقطة)
    expectedProfit: v.number(),    // الربح المتوقع
    paidAmount: v.number(),        // ما دُفع من الفاتورة
    notes: v.optional(v.string()),
    belowCost: v.boolean(),        // علم: بيع بأقل من التكلفة في أي سطر
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
  })
    .index("by_customer", ["customerId"])
    .index("by_date", ["date"])
    .index("by_status", ["status"])
    .index("by_number", ["number"]),

  // ── المرتجعات ──
  returns: defineTable({
    invoiceId: v.optional(v.id("invoices")),
    invoiceNumber: v.optional(v.string()),
    customerId: v.id("customers"),
    customerName: v.string(),
    date: v.string(),
    lines: v.array(invoiceLine),
    total: v.number(),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_date", ["date"]),

  // ── مدفوعات العملاء (التحصيل) ──
  payments: defineTable({
    customerId: v.id("customers"),
    customerName: v.string(),
    amount: v.number(),
    date: v.string(),
    method: v.union(v.literal("cash"), v.literal("transfer"), v.literal("card")),
    invoiceId: v.optional(v.id("invoices")),
    // توزيع الدفعة على فواتير محددة (اختياري): كل عنصر = فاتورة + المبلغ المخصّص لها
    allocations: v.optional(
      v.array(v.object({ invoiceId: v.id("invoices"), amount: v.number() })),
    ),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_date", ["date"]),

  // ── المشتريات من الموردين (لحساب التكلفة الحقيقية) ──
  purchases: defineTable({
    date: v.string(),
    supplier: v.optional(v.string()),
    itemId: v.optional(v.id("items")),
    itemName: v.string(),
    qty: v.number(),
    cost: v.number(),              // سعر شراء الوحدة
    total: v.number(),
    note: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_item", ["itemId"]),

  // ── سجل التدقيق ──
  auditLog: defineTable({
    entity: v.string(),
    entityId: v.optional(v.string()),
    action: v.string(),
    userName: v.optional(v.string()),
    details: v.optional(v.string()),
    at: v.number(),
  }).index("by_entity", ["entity"]),

  // ── عدّادات (ترقيم الفواتير) ──
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  // ── إعدادات عامة (اسم الشركة/الضريبة/العملة) ──
  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});
