"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";

/**
 * تحويل طلب العميل (نص أو صورة) إلى أصناف وكميات مطابقة لكتالوج الأصناف.
 * يستخدم Claude (claude-opus-4-8). المفتاح السري في متغيّر البيئة ANTHROPIC_API_KEY على Convex.
 */
export const parseOrder = action({
  args: {
    token: v.string(),
    text: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
    imageMediaType: v.optional(v.string()), // image/png | image/jpeg | image/webp
  },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.runQuery(api.auth.me, { token: args.token });
    if (!user) throw new Error("غير مصرّح — سجّل الدخول");
    if (!args.text?.trim() && !args.imageBase64) throw new Error("اكتب الطلب أو أرفق صورة");

    const key = (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
    if (!key) throw new Error("لم يتم ضبط مفتاح الذكاء الاصطناعي (ANTHROPIC_API_KEY) على الخادم بعد.");

    // كتالوج الأصناف النشطة (المُعرّف + الاسمان + الوحدة)
    const items = await ctx.runQuery(api.customers.priceListFor, { token: args.token } as any);
    const catalog = items
      .map((i: any) => `${i.itemId}\t${i.name}\t${i.nameAr ?? ""}\t${i.unit}`)
      .join("\n");

    const client = new Anthropic({ apiKey: key });

    const system =
      "أنت تحوّل طلب عميل لتاجر جملة خضار وفواكه إلى بنود منظّمة. المدخل نص عربي/إنجليزي أو صورة لطلب مكتوب بخط اليد أو مطبوع. " +
      "طابِق كل صنف مطلوب بأقرب صنف في الكتالوج المرفق (CATALOG: أعمدة مفصولة بـ tab = المعرّف، الاسم الإنجليزي، الاسم العربي، الوحدة). " +
      "أعد itemId من الكتالوج بالضبط؛ إن لم تجد تطابقًا جيدًا اجعله سلسلة فارغة \"\". " +
      "qty رقم: حوّل مثل '2 كرتونة' إلى 2، و'نص كيلو' إلى 0.5، و'500 جرام' إلى 0.5 لو الوحدة كيلو. " +
      "unit: استخدم وحدة الصنف من الكتالوج إلا إذا حدّد العميل وحدة مختلفة صراحةً. " +
      "أدرِج فقط الأصناف المطلوبة فعلًا. أعد النتيجة JSON فقط بالشكل: " +
      '{"lines":[{"itemId":"","requested":"النص الأصلي","qty":0,"unit":""}]}';

    const content: any[] = [];
    if (args.imageBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: args.imageMediaType || "image/jpeg", data: args.imageBase64 },
      });
    }
    content.push({ type: "text", text: `${args.text ?? ""}\n\nCATALOG:\n${catalog}` });

    const resp: any = await (client.messages.create as any)({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content }],
    });

    if (resp.stop_reason === "refusal") throw new Error("تعذّر تحليل الطلب (رُفض من نموذج الذكاء الاصطناعي).");

    const textOut = (resp.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const parsed = extractJson(textOut);
    const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];

    const byId = new Map(items.map((i: any) => [i.itemId, i]));
    const matched: any[] = [];
    const unmatched: string[] = [];
    for (const l of lines) {
      const qty = Number(l.qty) || 0;
      if (qty <= 0) continue;
      const it: any = l.itemId ? byId.get(l.itemId) : null;
      if (it) matched.push({ itemId: it.itemId, name: it.name, nameAr: it.nameAr, unit: l.unit || it.unit, qty });
      else unmatched.push(String(l.requested || "").trim() || "صنف غير معروف");
    }
    return { matched, unmatched };
  },
});

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          itemId: { type: "string" },
          requested: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
        },
        required: ["itemId", "requested", "qty", "unit"],
      },
    },
  },
  required: ["lines"],
};

/** استخراج كائن JSON من نص النموذج بمرونة. */
function extractJson(s: string): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch {} }
  return null;
}
