import { adminQuery } from "./auth";
import { v } from "convex/values";

/** سجل النشاط (للمدير فقط): مين عمل إيه ومتى، مع فلترة اختيارية بالنوع. */
export const list = adminQuery({
  args: {
    entity: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let rows;
    if (args.entity) {
      rows = await ctx.db.query("auditLog").withIndex("by_entity", (q) => q.eq("entity", args.entity!)).collect();
    } else {
      rows = await ctx.db.query("auditLog").collect();
    }
    rows.sort((a, b) => b.at - a.at); // الأحدث أولًا
    return rows.slice(0, args.limit ?? 300);
  },
});
