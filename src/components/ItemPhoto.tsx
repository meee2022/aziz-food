import { Icon } from "./ui";

/**
 * صورة الصنف — تُستخدم في شاشة اختيار الأصناف وبوابة الطلبات وصفحة الأصناف.
 * بدون صورة تظهر أيقونة بديلة بنفس المقاس فلا يتغيّر تخطيط الشبكة.
 */
export default function ItemPhoto({ url, name, size, width, height, radius = 10, fit = "cover", style }: {
  url?: string | null; name?: string;
  size?: number;                       // اختصار لمربّع
  width?: number | string; height?: number | string;
  radius?: number; fit?: "cover" | "contain"; style?: any;
}) {
  const box: any = {
    width: width ?? size ?? 64,
    height: height ?? size ?? 64,
    borderRadius: radius, flexShrink: 0,
    background: "var(--surface)", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", color: "var(--muted)", ...style,
  };
  if (!url) return <div style={box} title={name} aria-hidden><Icon name="box" size={18} /></div>;
  return (
    <div style={box}>
      <img src={url} alt={name ?? ""} loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: fit, display: "block" }} />
    </div>
  );
}
