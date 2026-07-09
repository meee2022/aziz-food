import { useState } from "react";
import { useAuthedQuery as useQuery } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { money, num, formatDate, today } from "../lib/format";
import { exportExcel } from "../lib/xlsx";
import { PageHeader, Icon, Spinner, Empty, StatCard } from "../components/ui";

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export default function Reports() {
  const t = useT(); const { lang } = useLang();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [tab, setTab] = useState<"day" | "customer" | "item" | "debts">("day");
  const rep = useQuery(api.reports.sales, { from, to });
  const debts = useQuery(api.reports.receivables, {});

  if (rep === undefined) return <Spinner />;

  const exportCurrent = () => {
    if (tab === "day") exportExcel(rep.byDay.map((r) => ({ Date: r.date, Sales: r.sales, Profit: r.profit, Invoices: r.count })), `sales-by-day`);
    else if (tab === "customer") exportExcel(rep.byCustomer.map((r) => ({ Customer: r.name, Sales: r.sales, Profit: r.profit, Invoices: r.count })), `sales-by-customer`);
    else if (tab === "item") exportExcel(rep.byItem.map((r) => ({ Item: r.name, Unit: r.unit, Qty: r.qty, Sales: r.sales, Profit: r.profit })), `sales-by-item`);
    else if (debts) exportExcel(debts.rows.map((r) => ({ Customer: r.name, Balance: r.balance, CreditLimit: r.creditLimit ?? "", OverLimit: r.overLimit ? "Yes" : "" })), `receivables`);
  };

  const TABS: [string, string, string][] = [
    ["day", "حسب اليوم", "By Day"], ["customer", "حسب العميل", "By Customer"],
    ["item", "حسب الصنف", "By Item"], ["debts", "المديونيات", "Receivables"],
  ];

  return (
    <div className="animate-in">
      <PageHeader title={t("التقارير", "Reports")}
        actions={<button className="btn-secondary" onClick={exportCurrent}><Icon name="download" size={16} /> {t("تصدير Excel", "Export Excel")}</button>} />

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label className="label">{t("من", "From")}</label><input className="field tabular" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">{t("إلى", "To")}</label><input className="field tabular" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatCard label={t("إجمالي المبيعات", "Total Sales")} value={money(rep.totals.sales)} icon="money" />
        <StatCard label={t("ربح البضاعة", "Gross Profit")} value={money(rep.totals.profit)} icon="chart" accent />
        <StatCard label={t("المصروفات", "Expenses")} value={money((rep.totals as any).expenses ?? 0)} icon="money" accent />
        <StatCard label={t("صافي الربح", "Net Profit")} value={money((rep.totals as any).net ?? rep.totals.profit)} icon="chart" />
        <StatCard label={t("عدد الفواتير", "Invoices")} value={num(rep.totals.count, 0)} icon="invoice" />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {TABS.map((x) => <button key={x[0]} className={tab === x[0] ? "btn-primary" : "btn-ghost"} onClick={() => setTab(x[0] as any)}>{t(x[1], x[2])}</button>)}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {tab === "day" && <SimpleTable head={[t("التاريخ", "Date"), t("المبيعات", "Sales"), t("الأرباح", "Profit"), t("الفواتير", "Inv")]}
          rows={rep.byDay.map((r) => [formatDate(r.date, lang), money(r.sales, false), money(r.profit, false), String(r.count)])} empty={t("لا بيانات", "No data")} />}
        {tab === "customer" && <SimpleTable head={[t("العميل", "Customer"), t("المبيعات", "Sales"), t("الأرباح", "Profit"), t("الفواتير", "Inv")]}
          rows={rep.byCustomer.map((r) => [r.name, money(r.sales, false), money(r.profit, false), String(r.count)])} empty={t("لا بيانات", "No data")} />}
        {tab === "item" && <SimpleTable head={[t("الصنف", "Item"), t("الوحدة", "Unit"), t("الكمية", "Qty"), t("المبيعات", "Sales"), t("الأرباح", "Profit")]}
          rows={rep.byItem.map((r) => [r.name, r.unit, num(r.qty), money(r.sales, false), money(r.profit, false)])} empty={t("لا بيانات", "No data")} />}
        {tab === "debts" && (debts === undefined ? <Spinner /> :
          <SimpleTable head={[t("العميل", "Customer"), t("الرصيد", "Balance"), t("الحد الائتماني", "Limit"), t("الحالة", "Status")]}
            rows={debts.rows.map((r) => [r.name, money(r.balance, false), r.creditLimit ? money(r.creditLimit, false) : "—", r.overLimit ? t("تجاوز الحد", "Over limit") : t("ضمن الحد", "OK")])} empty={t("لا مديونيات", "No debts")} />)}
      </div>
    </div>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  return (
    <>
      <table className="data-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? "tabular" : ""} style={j === 0 ? { fontWeight: 700 } : undefined}>{c}</td>)}</tr>)}</tbody>
      </table>
      {rows.length === 0 && <Empty text={empty} icon="chart" />}
    </>
  );
}
