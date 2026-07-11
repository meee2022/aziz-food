import { useAuthedQuery as useQuery } from "../lib/authedConvex";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT } from "../lib/i18n";
import { money, waPhone } from "../lib/format";
import { PageHeader, Icon, Spinner, Empty } from "../components/ui";

const BUCKETS: [string, string, string][] = [
  ["b0", "0–30 يوم", "0–30d"],
  ["b30", "31–60 يوم", "31–60d"],
  ["b60", "61–90 يوم", "61–90d"],
  ["b90", "أكثر من 90", "90d+"],
];

export default function Aging() {
  const t = useT();
  const navigate = useNavigate();
  const data = useQuery(api.customers.aging, {});

  if (data === undefined) return <Spinner />;
  const { rows, totals } = data;

  const remind = (r: any) => {
    const overdue = r.b30 + r.b60 + r.b90;
    const msg = [
      `${t("تذكير ودّي", "Friendly reminder")} — ${r.name}`,
      `${t("إجمالي المستحق", "Total due")}: ${money(r.total)}`,
      overdue > 0.009 ? `${t("منها متأخر", "overdue")}: ${money(overdue)}` : "",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${waPhone(r.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="animate-in">
      <PageHeader title={t("متابعة الديون", "Receivables Aging")}
        subtitle={t(`إجمالي المستحق ${money(totals.total)} على ${rows.length} عميل`, `${money(totals.total)} due from ${rows.length} customers`)} />

      {/* ملخّص الشرائح */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 18 }}>
        {BUCKETS.map(([k, ar, en]) => {
          const v = (totals as any)[k] as number;
          const late = k !== "b0";
          return (
            <div key={k} className="card" style={{ padding: 14, borderInlineStart: `3px solid ${late ? "var(--danger)" : "var(--accent)"}` }}>
              <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>{t(ar, en)}</div>
              <div className="tabular" style={{ fontSize: 18, fontWeight: 800, color: late && v > 0 ? "var(--danger)" : "var(--ink)" }}>{money(v, false)}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr>
            <th>{t("العميل", "Customer")}</th>
            {BUCKETS.map(([k, ar, en]) => <th key={k} style={{ textAlign: "center" }}>{t(ar, en)}</th>)}
            <th>{t("الإجمالي", "Total")}</th>
            <th></th>
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.customerId} style={{ cursor: "pointer" }} onClick={() => navigate(`/customers/${r.customerId}`)}>
                <td style={{ fontWeight: 700 }}>{r.name}</td>
                {BUCKETS.map(([k]) => {
                  const v = r[k] as number;
                  const late = k !== "b0";
                  return <td key={k} className="tabular" style={{ textAlign: "center", color: late && v > 0 ? "var(--danger)" : v > 0 ? "var(--ink)" : "var(--muted)", fontWeight: v > 0 ? 700 : 400 }}>{v > 0 ? money(v, false) : "—"}</td>;
                })}
                <td className="tabular" style={{ fontWeight: 800 }}>{money(r.total, false)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="btn-ghost btn-icon" title={t("تذكير واتساب", "WhatsApp reminder")} onClick={() => remind(r)}>
                    <Icon name="whatsapp" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text={t("لا مديونيات — كله محصّل 👏", "No receivables — all collected 👏")} icon="check" />}
      </div>

      <div className="text-muted" style={{ fontSize: 12, marginTop: 10, textAlign: "center" }}>
        {t("تُوزَّع المدفوعات والمرتجعات على أقدم الفواتير أولًا، والعمر محسوب من تاريخ الفاتورة.",
           "Payments and returns are applied to the oldest invoices first; age is counted from the invoice date.")}
      </div>
    </div>
  );
}
