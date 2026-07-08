import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const cats = await ctx.db.query("categories").collect();
    return cats.sort((a, b) => a.sort - b.sort);
  },
});

export const create = mutation({
  args: { nameAr: v.string(), nameEn: v.string(), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const count = (await ctx.db.query("categories").collect()).length;
    return await ctx.db.insert("categories", { ...args, sort: count });
  },
});

export const update = mutation({
  args: {
    id: v.id("categories"),
    nameAr: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
