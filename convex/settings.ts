import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const all = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const ex = await ctx.db.query("settings").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (ex) await ctx.db.patch(ex._id, { value });
    else await ctx.db.insert("settings", { key, value });
  },
});
