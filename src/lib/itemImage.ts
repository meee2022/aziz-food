/**
 * رفع صورة صنف: نصغّر الصورة في المتصفح قبل الرفع (الكاميرا تنتج ملفات ضخمة)
 * فيصبح التخزين والتحميل خفيفين — المقاس المطلوب للعرض صغير أصلًا.
 */
const MAX_SIDE = 600;
const QUALITY = 0.82;

/** يقصّ الصورة مربّعة من المنتصف ويصغّرها، ويعيدها Blob بصيغة JPEG. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);          // قصّ مربّع من المنتصف
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const out = Math.min(MAX_SIDE, side);

  const canvas = document.createElement("canvas");
  canvas.width = out; canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out, out);        // خلفية بيضاء بدل الشفافية
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
  if (!blob) throw new Error("تعذّر تجهيز الصورة");
  return blob;
}

/** يصغّر الصورة ويرفعها على Convex ثم يربطها بالصنف. */
export async function uploadItemImage(
  file: File,
  itemId: string,
  getUploadUrl: () => Promise<string>,
  setImage: (args: { id: string; storageId: string }) => Promise<any>,
): Promise<void> {
  const blob = await shrinkImage(file);
  const url = await getUploadUrl();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
  if (!res.ok) throw new Error("فشل رفع الصورة");
  const { storageId } = await res.json();
  await setImage({ id: itemId, storageId });
}
