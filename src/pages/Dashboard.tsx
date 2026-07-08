import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, today } from "../lib/format";
import { StatCard, Icon, Spinner, PageHeader } from "../components/ui";

export default function Dashboard() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const d = useQuery(api.dashboard.overview, { date: today() });

  if (d === undefined) return <Spinner />;

  const maxSales = Math.max(1, ...d.series.map((s) => s.sales));
  const crowns = ["crown-gold", "crown-silver", "crown-bronze"];

  return (
    <div className="animate-in">
      <div className="hero-premium" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--accent-light)" }}>{t("مرحبًا", "Welcome")}، {user?.name}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
          {t("ملخص اليوم", "Today's Summary")}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
      </div>

      {/* التنبيهات */}
      {d.alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {d.alerts.map((a, i) => (
            <div key={i} className={"pill " + (a.level === "danger" ? "badge-danger" : a.level === "warning" ? "badge-warning" : "badge-info")}
              style={{ padding: "8px 14px", justifyContent: "flex-start" }}>
              <Icon name="alert" size={15} /> {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* المؤشرات */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatCard label={t("مبيعات اليوم", "Today Sales")} value={money(d.todaySales)} icon="money" />
        <StatCard label={t("أرباح اليوم", "Today Profit")} value={money(d.todayProfit)} icon="chart" accent />
        <StatCard label={t("عدد الفواتير", "Invoices")} value={num(d.todayCount, 0)} icon="invoice" />
        <StatCard label={t("المديونيات", "Receivables")} value={money(d.totalReceivable)} icon="alert" accent sub={`${d.debtorCount} ${t("عميل", "clients")}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 22 }}>
        <StatCard label={t("مبيعات الأسبوع", "Week Sales")} value={money(d.weekSales)} icon="chart" />
        <StatCard label={t("مبيعات الشهر", "Month Sales")} value={money(d.monthSales)} icon="chart" />
        <StatCard label={t("أرباح الشهر", "Month Profit")} value={money(d.monthProfit)} icon="chart" accent />
        <StatCard label={t("العملاء", "Customers")} value={num(d.customerCount, 0)} icon="users" />
      </div>

      {/* رسم المبيعات آخر 7 أيام */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>{t("مبيعات آخر 7 أيام", "Last 7 Days")}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
          {d.series.map((s) => (
            <div key={s.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
              <div className="tabular" style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{num(s.sales, 0)}</div>
              <div title={money(s.sales)} style={{ width: "70%", maxWidth: 40, height: `${(s.sales / maxSales) * 100}%`, minHeight: 4, borderRadius: "8px 8px 0 0", background: "linear-gradient(180deg,var(--accent),var(--primary))" }} />
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{new Date(s.date + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { weekday: "short" })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* لوحات القوائم */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <LeaderCard title={t("أفضل العملاء", "Top Customers")} rows={d.topCustomers.map((c) => ({ name: c.name, value: money(c.total) }))} crowns={crowns} empty={t("لا بيانات", "No data")} />
        <LeaderCard title={t("أكثر الأصناف مبيعًا", "Top Items")} rows={d.topItems.map((c) => ({ name: c.name, value: `${num(c.qty)} ${c.unit}` }))} crowns={crowns} empty={t("لا بيانات", "No data")} />
        <LeaderCard title={t("الأعلى ربحًا", "Top Profit")} rows={d.topProfitItems.map((c) => ({ name: c.name, value: money(c.profit) }))} crowns={crowns} empty={t("لا بيانات", "No data")} />
        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>{t("أكبر المديونيات", "Top Debtors")}</div>
          {d.topDebtors.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>{t("لا مديونيات", "No debts")}</div> :
            d.topDebtors.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < d.topDebtors.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                <span className="tabular badge-danger pill">{money(c.balance)}</span>
              </div>
            ))}
        </div>
      </div>

      <div style={{ marginTop: 20, textAlign: "center" }}>
        <Link to="/invoice/new" className="btn-primary" style={{ padding: "12px 28px" }}>
          <Icon name="plus" /> {t("إنشاء فاتورة جديدة", "Create New Invoice")}
        </Link>
      </div>
    </div>
  );
}

function LeaderCard({ title, rows, crowns, empty }: { title: string; rows: { name: string; value: string }[]; crowns: string[]; empty: string }) {
  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 14 }}>{title}</div>
      {rows.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>{empty}</div> :
        rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div className={"crown-badge " + (crowns[i] ?? "badge-muted")}>{i + 1}</div>
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span className="tabular text-primary" style={{ fontWeight: 800, fontSize: 13 }}>{r.value}</span>
          </div>
        ))}
    </div>
  );
}
