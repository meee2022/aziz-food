import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

/* ── أيقونات SVG بسيطة ── */
const PATHS: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  invoice: "M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v5h5M8 13h8M8 17h5",
  plus: "M12 5v14M5 12h14",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  chart: "M18 20V10M12 20V4M6 20v-6",
  cart: "M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  print: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6v-8z",
  whatsapp: "M17.6 6.3A7.85 7.85 0 0 0 12 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1A7.9 7.9 0 0 0 12 20a7.94 7.94 0 0 0 5.6-13.6zM12 18.5a6.6 6.6 0 0 1-3.4-.9l-.24-.15-2.5.66.67-2.43-.16-.25A6.55 6.55 0 1 1 12 18.5z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  copy: "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  money: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  alert: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  back: "M19 12H5M12 19l-7-7 7-7",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1.05.36 2.07.7 3a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.08-1.27a2 2 0 0 1 2.11-.45c.94.34 1.96.57 3 .7A2 2 0 0 1 22 16.92z",
  menu: "M3 12h18M3 6h18M3 18h18",
  clipboard: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
};

export function Icon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

/* ── نافذة منبثقة ── */
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,10,15,.45)", backdropFilter: "blur(3px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card-luxurious animate-in"
        style={{ width: "100%", maxWidth: wide ? 820 : 520, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 22px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <h3 className="section-title">{title}</h3>
          <button className="btn-ghost btn-icon" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div style={{ padding: 22, overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function StatCard({ label, value, icon, accent, sub }: {
  label: string; value: string; icon: string; accent?: boolean; sub?: string;
}) {
  // "1,582.00 ر.ق" ⇒ الرقم بارز والعملة لاحقة صغيرة، فلا تزدحم البطاقة
  const m = value.match(/^(-?[\d,]+(?:\.\d+)?)\s+(\S.*)$/);
  const amount = m ? m[1] : value;
  const suffix = m ? m[2] : null;
  return (
    <div className="card card-hover animate-in" style={{ display: "flex", alignItems: "center", gap: 11, padding: 14 }}>
      <div className={accent ? "icon-orb icon-orb-accent" : "icon-orb icon-orb-primary"}
        style={{ width: 38, height: 38, flex: "0 0 auto" }}><Icon name={icon} size={18} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="text-muted" style={{ fontSize: 11.5, fontWeight: 700 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1.3 }}>
          <span className="tabular" style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>{amount}</span>
          {suffix && <span className="text-muted" style={{ fontSize: 10.5, fontWeight: 700 }}>{suffix}</span>}
        </div>
        {sub && <div className="text-muted" style={{ fontSize: 10.5 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Empty({ text, icon = "box" }: { text: string; icon?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
      <div className="icon-orb icon-orb-accent" style={{ margin: "0 auto 12px" }}><Icon name={icon} size={22} /></div>
      <div style={{ fontWeight: 700 }}>{text}</div>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 34, height: 34, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "var(--ink)" }}>{title}</h1>
        {subtitle && <div className="text-muted" style={{ fontSize: 13 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}
