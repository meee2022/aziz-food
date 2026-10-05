import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/** One-time maintenance helper, callable only by trusted Convex code / CLI. */
export const attachFromUrl = internalAction({
  args: { nameEn: v.string(), url: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const response = await fetch(args.url);
    if (!response.ok) throw new Error(`Image download failed: ${response.status}`);
    const blob = await response.blob();
    const storageId = await ctx.storage.store(blob);
    return await ctx.runMutation(internal.itemImageSeed.attachStored, {
      nameEn: args.nameEn,
      storageId,
    });
  },
});

export const attachStored = internalMutation({
  args: { nameEn: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const matches = (await ctx.db.query("items").collect()).filter(
      (item) => item.nameEn.trim().toLowerCase() === args.nameEn.trim().toLowerCase(),
    );
    if (matches.length !== 1) {
      await ctx.storage.delete(args.storageId);
      throw new Error(`Expected one item named ${args.nameEn}, found ${matches.length}`);
    }
    const item = matches[0];
    if (item.imageId) await ctx.storage.delete(item.imageId).catch(() => {});
    await ctx.db.patch(item._id, { imageId: args.storageId, updatedAt: Date.now() });
    return { id: item._id, nameEn: item.nameEn };
  },
});

export const generateUploadUrls = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Invalid upload count");
    return await Promise.all(Array.from({ length: count }, () => ctx.storage.generateUploadUrl()));
  },
});

export const attachMany = internalMutation({
  args: {
    images: v.array(v.object({ itemId: v.id("items"), storageId: v.id("_storage") })),
  },
  handler: async (ctx, { images }) => {
    for (const image of images) {
      const item = await ctx.db.get(image.itemId);
      if (!item) {
        await ctx.storage.delete(image.storageId);
        continue;
      }
      if (item.imageId) await ctx.storage.delete(item.imageId).catch(() => {});
      await ctx.db.patch(item._id, { imageId: image.storageId, updatedAt: Date.now() });
    }
    return { attached: images.length };
  },
});
