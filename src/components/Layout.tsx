import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthedMutation, useAuthedQuery } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { Icon } from "./ui";
import { useT, useLang } from "../lib/i18n";
import { useAuth, can } from "../lib/auth";

interface NavItem { to: string; section: string; icon: string; ar: string; en: string; }

const NAV: NavItem[] = [
  { to: "/", section: "dashboard", icon: "dashboard", ar: "لوحة التحكم", en: "Dashboard" },
  { to: "/invoice/new", section: "invoice-new", icon: "plus", ar: "فاتورة جديدة", en: "New Invoice" },
  { to: "/invoices", section: "invoices", icon: "invoice", ar: "الفواتير", en: "Invoices" },
  { to: "/orders", section: "orders", icon: "clipboard", ar: "الطلبات", en: "Orders" },
  { to: "/returns", section: "returns", icon: "back", ar: "المرتجعات", en: "Returns" },
  { to: "/customers", section: "customers", icon: "users", ar: "العملاء", en: "Customers" },
  { to: "/aging", section: "aging", icon: "alert", ar: "متابعة الديون", en: "Receivables" },
  { to: "/items", section: "items", icon: "box", ar: "الأصناف", en: "Items" },
  { to: "/prices", section: "prices", icon: "money", ar: "مركز الأسعار", en: "Price Center" },
  { to: "/price-lists", section: "priceLists", icon: "tag", ar: "قوائم الأسعار", en: "Price Lists" },
  { to: "/purchases", section: "purchases", icon: "cart", ar: "المشتريات", en: "Purchases" },
  { to: "/expenses", section: "expenses", icon: "money", ar: "المصروفات", en: "Expenses" },
  { to: "/reports", section: "reports", icon: "chart", ar: "التقارير", en: "Reports" },
  { to: "/audit", section: "audit", icon: "clipboard", ar: "سجل النشاط", en: "Activity Log" },
  { to: "/settings", section: "settings", icon: "settings", ar: "الإعدادات", en: "Settings" },
];

// أهم عناصر الشريط السفلي للجوال
const MOBILE = ["dashboard", "orders", "invoice-new", "invoices", "customers"];

export default function Layout({ children }: { children: ReactNode }) {
  const t = useT();
  const { toggle, lang } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const settings = useQuery(api.settings.all, {});
  const signOut = useAuthedMutation(api.auth.signOut);
  const pendingOrders = (useAuthedQuery(api.orders.pendingCount, {}) as number) ?? 0;
  const brand = lang === "ar" ? (settings?.companyName || "سوق الجملة") : (settings?.companyNameEn || "Wholesale");
  const items = NAV.filter((n) => can(user?.role, n.section));
  const mobileItems = items.filter((n) => MOBILE.includes(n.section)).slice(0, 5);

  const roleLabel: Record<string, [string, string]> = {
    admin: ["مدير", "Admin"], sales: ["مبيعات", "Sales"],
    accountant: ["محاسب", "Accountant"], warehouse: ["مخزن", "Warehouse"],
  };

  return (
    <div className="app-root" style={{ display: "flex", minHeight: "100vh" }}>
      {/* الشريط الجانبي - كمبيوتر */}
      <aside className="no-print sidebar-desktop" style={{
        width: 248, flexShrink: 0, background: "linear-gradient(180deg,var(--primary-dark),var(--primary-deep))",
        color: "#fff", padding: "20px 14px", position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 20px" }}>
          <img src="/logo.svg" width={38} height={38} alt="logo" />
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#fff" }}>{brand}</div>
            <div style={{ fontSize: 11, color: "var(--accent)" }}>{t("خضروات وفواكه", "Fruits & Veg")}</div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}
              className={({ isActive }) => "nav-link" + (isActive ? " nav-link-active" : "")}>
              <Icon name={n.icon} size={19} />
              <span>{t(n.ar, n.en)}</span>
              {n.section === "orders" && pendingOrders > 0 && (
                <span style={{ marginInlineStart: "auto", background: "#e11d48", color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 999, minWidth: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{pendingOrders}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* المحتوى */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="no-print" style={{
          height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", position: "sticky", top: 0, zIndex: 20,
          background: "color-mix(in srgb, var(--bg) 82%, transparent)", backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img className="logo-mobile" src="/logo.svg" width={30} height={30} alt="logo" style={{ display: "none" }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>{brand}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn-ghost" onClick={toggle} style={{ padding: "6px 12px", fontWeight: 800 }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "var(--surface)" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--primary-light),var(--primary-dark))", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                {user?.name?.[0] ?? "?"}
              </div>
              <div style={{ lineHeight: 1.1 }} className="hide-mobile">
                <div style={{ fontSize: 12, fontWeight: 800 }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{user && t(roleLabel[user.role][0], roleLabel[user.role][1])}</div>
              </div>
            </div>
            <button className="btn-ghost btn-icon" onClick={() => { signOut({}).catch(() => {}); logout(); navigate("/login"); }} title={t("خروج", "Logout")}>
              <Icon name="logout" />
            </button>
          </div>
        </header>

        <main className="app-main" style={{ flex: 1, padding: "20px 16px 88px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>

      {/* الشريط السفلي - جوال */}
      <nav className="no-print bottom-nav" style={{
        position: "fixed", bottom: 0, insetInline: 0, height: 64, display: "none",
        background: "color-mix(in srgb, var(--card) 92%, transparent)", backdropFilter: "blur(12px)",
        borderTop: "1px solid var(--border)", zIndex: 30, justifyContent: "space-around", alignItems: "center",
      }}>
        {mobileItems.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}
            className={({ isActive }) => "bnav" + (isActive ? " bnav-active" : "")}>
            <span style={{ position: "relative" }}>
              <Icon name={n.icon} size={21} />
              {n.section === "orders" && pendingOrders > 0 && <span style={{ position: "absolute", top: -4, insetInlineEnd: -6, background: "#e11d48", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 999, minWidth: 15, height: 15, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{pendingOrders}</span>}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700 }}>{t(n.ar, n.en)}</span>
          </NavLink>
        ))}
      </nav>

      <style>{`
        .nav-link { display:flex; align-items:center; gap:11px; padding:11px 13px; border-radius:12px; color:#e9dfe2; font-weight:600; font-size:14px; transition:all .18s ease; }
        .nav-link:hover { background:rgba(255,255,255,.08); color:#fff; }
        .nav-link-active { background:linear-gradient(135deg,rgba(201,169,110,.22),rgba(201,169,110,.10)); color:#fff; box-shadow:inset 0 0 0 1px rgba(201,169,110,.4); }
        .nav-link-active svg { color:var(--accent); }
        .bnav { display:flex; flex-direction:column; align-items:center; gap:2px; color:var(--muted); padding:6px 10px; border-radius:12px; }
        .bnav-active { color:var(--primary); }
        .bnav-active svg { color:var(--primary); }
        @media (max-width: 860px) {
          .sidebar-desktop { display:none !important; }
          .bottom-nav { display:flex !important; }
          .logo-mobile { display:block !important; }
          .hide-mobile { display:none !important; }
        }
      `}</style>
    </div>
  );
}
