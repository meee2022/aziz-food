import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * تحويل طلب العميل (نص أو صورة) إلى أصناف وكميات مطابقة لكتالوج الأصناف.
 * يستخدم Claude (claude-opus-4-8) عبر نداء مباشر للـ API — المفتاح السري في
 * متغيّر البيئة ANTHROPIC_API_KEY على Convex.
 */
export const parseOrder = action({
  args: {
    token: v.string(),
    customerId: v.optional(v.id("customers")), // لتقييد الكتالوج بأصناف العميل وأسعاره
    text: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
    imageMediaType: v.optional(v.string()), // image/png | image/jpeg | image/webp
  },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.runQuery(api.auth.me, { token: args.token });
    if (!user) throw new Error("غير مصرّح — سجّل الدخول");
    if (!args.text?.trim() && !args.imageBase64) throw new Error("اكتب الطلب أو أرفق صورة");

    // نظّف المفتاح من أي حروف غير مطبوعة/غير ASCII قد تكون التصقت عند اللصق (مفاتيح Anthropic ASCII فقط)
    const key = (globalThis as any).process?.env?.ANTHROPIC_API_KEY?.replace(/[^\x21-\x7E]/g, "");
    if (!key) throw new Error("لم يتم ضبط مفتاح الذكاء الاصطناعي (ANTHROPIC_API_KEY) على الخادم بعد.");

    // الموديل المختار من الإعدادات (يختاره المالك من الشاشة)، وإلا متغيّر البيئة، وإلا الأرخص.
    const settings: any = await ctx.runQuery(api.settings.all, { token: args.token } as any);
    const model = normalizeModel(settings?.aiModel) || (globalThis as any).process?.env?.AI_MODEL?.trim() || "claude-haiku-4-5";

    // كتالوج الأصناف النشطة (المُعرّف + الاسمان + الوحدة) — مقيّد بكتالوج العميل إن كان له تخصيص
    const items = await ctx.runQuery(api.customers.priceListFor, {
      token: args.token, customerId: args.customerId, onlyAllowed: true,
    } as any);
    const catalog = items
      .map((i: any) => `${i.itemId}\t${i.name}\t${i.nameAr ?? ""}\t${i.unit}`)
      .join("\n");

    const system =
      "أنت تحوّل طلب عميل لتاجر جملة خضار وفواكه إلى بنود منظّمة. المدخل نص عربي/إنجليزي أو صورة لطلب مكتوب بخط اليد أو مطبوع. " +
      "عند وجود صورة لنموذج طلب مطبوع: افحص الصورة كاملة بدقة، واقرأ الكتابة اليدوية في خلايا NEW ORDER فقط، واربط كل كمية باسم الصنف المطبوع في الصف نفسه. " +
      "تجاهل صفوف النموذج الفارغة وعلامات الصح والخطوط الممتدة خارج الجدول، لكن لا تعتبر النموذج كله فارغًا لمجرد أن معظم صفوفه فارغة. " +
      "افحص نصفي الجدول الأيسر والأيمن، وكذلك أي أصناف مكتوبة يدويًا عند الحواف أو أسفل الجدول. ميّز pc/pce (قطعة) وkg وgm بدقة. " +
      "طابِق كل صنف مطلوب بأقرب صنف في الكتالوج المرفق (CATALOG: أعمدة مفصولة بـ tab = المعرّف، الاسم الإنجليزي، الاسم العربي، الوحدة). " +
      "أعد itemId من الكتالوج بالضبط؛ إن لم تجد تطابقًا جيدًا اجعله سلسلة فارغة \"\". " +
      "qty رقم: حوّل مثل '2 كرتونة' إلى 2، و'نص كيلو' إلى 0.5، و'500 جرام' إلى 0.5 لو الوحدة كيلو. " +
      "unit: استخدم وحدة الصنف من الكتالوج إلا إذا حدّد العميل وحدة مختلفة صراحةً. " +
      "أدرِج فقط الأصناف المطلوبة فعلًا. أعد النتيجة JSON فقط بلا أي شرح بالشكل: " +
      '{"lines":[{"itemId":"","requested":"النص الأصلي","qty":0,"unit":""}]}';

    const content: any[] = [];
    if (args.imageBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: args.imageMediaType || "image/jpeg", data: args.imageBase64 },
      });
    }
    content.push({
      type: "text",
      text: args.imageBase64
        ? `اقرأ كل الكميات المكتوبة يدويًا في صورة الطلب، خصوصًا عمود NEW ORDER في جانبي الجدول، ثم طابقها بالكتالوج.\n${args.text ?? ""}\n\nCATALOG:\n${catalog}`
        : `${args.text ?? ""}\n\nCATALOG:\n${catalog}`,
    });

    let lines = await requestLines(key, model, system, content);

    // بعض نماذج الرؤية قد تفسّر نموذجًا مطبوعًا كثيفًا على أنه فارغ. أعد المحاولة
    // فقط في هذه الحالة، بتوجيه بصري أكثر تحديدًا، بدل إظهار نتيجة مضللة للمستخدم.
    if (args.imageBase64 && lines.length === 0) {
      const retryContent = [...content];
      retryContent[retryContent.length - 1] = {
        type: "text",
        text:
          "المحاولة السابقة لم تجد بنودًا، لكن الصورة تحتوي كتابة زرقاء بخط اليد. كبّر الصورة ذهنيًا وامسح الصفوف واحدًا واحدًا من أعلى لأسفل في نصفي الجدول. " +
          "استخرج كل خلية مكتوبة في NEW ORDER واربطها باسم الصف المطبوع المقابل. لا تُرجع lines فارغة ما دامت توجد كميات بخط اليد.\n\n" +
          `CATALOG:\n${catalog}`,
      };
      lines = await requestLines(key, model, system, retryContent);
    }

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

async function requestLines(key: string, model: string, system: string, content: any[]): Promise<any[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(buildBody(model, system, content)),
  });

  const data: any = await res.json();
  if (!res.ok || data?.type === "error") {
    throw new Error("الذكاء الاصطناعي: " + (data?.error?.message || `خطأ ${res.status}`));
  }
  if (data.stop_reason === "refusal") throw new Error("تعذّر تحليل الطلب (رُفض من نموذج الذكاء الاصطناعي).");

  const textOut = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const parsed = extractJson(textOut);
  let lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
  // لو انقطع الرد (نادر بعد رفع الحد) أنقذ ما أمكن من البنود المكتملة
  if (data.stop_reason === "max_tokens" || lines.length === 0) {
    const salvaged = salvageLines(textOut);
    if (salvaged.length > lines.length) lines = salvaged;
  }
  return lines;
}

/**
 * جسم الطلب حسب الموديل. الافتراضي Haiku (الأرخص) — لا يقبل thinking/effort.
 * لتغيير الموديل: اضبط متغيّر البيئة AI_MODEL على Convex (مثلاً claude-sonnet-5 أو claude-opus-4-8).
 */
const ALLOWED_MODELS = ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"];
/** يقبل فقط الموديلات المسموح بها (يمنع قيمًا غلط من الإعدادات). */
function normalizeModel(v: any): string | null {
  const s = String(v ?? "").trim();
  return ALLOWED_MODELS.includes(s) ? s : null;
}

function buildBody(model: string, system: string, content: any[]): any {
  const modern = /opus-4-[678]|sonnet-5|fable-5/.test(model); // موديلات تقبل adaptive + effort
  const body: any = {
    model,
    max_tokens: modern ? 16000 : 8000,
    system,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  };
  if (modern) {
    body.thinking = { type: "adaptive" };
    body.output_config.effort = "low";
  }
  return body;
}

/** استخراج كل كائن بند مكتمل من نص JSON حتى لو كان مقطوعًا/غير صالح ككل. */
function salvageLines(s: string): any[] {
  const out: any[] = [];
  const re = /\{[^{}]*"itemId"[^{}]*\}/g;
  const matches = s.match(re) || [];
  for (const m of matches) { try { out.push(JSON.parse(m)); } catch {} }
  return out;
}
