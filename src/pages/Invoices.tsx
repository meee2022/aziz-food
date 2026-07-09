import { useState } from "react";
import { useAuthedQuery as useQuery } from "../lib/authedConvex";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { money, formatDate } from "../lib/format";
import { PageHeader, Icon, Spinner, Empty } from "../components/ui";

const STATUS: Record<string, [string, string, string]> = {
  draft: ["مسودة", "Draft", "badge-warning"],
  approved: ["معتمدة", "Approved", "badge-success"],
  cancelled: ["ملغاة", "Cancelled", "badge-danger"],
};

export default function Invoices() {
  const t = useT(); const { lang } = useLang();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("");
  const invoices = useQuery(api.invoices.list, status ? { status: status as any } : {});

  if (invoices === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("الفواتير", "Invoices")} subtitle={t(`${invoices.length} فاتورة`, `${invoices.length} invoices`)}
        actions={<Link to="/invoice/new" className="btn-primary"><Icon name="plus" size={16} /> {t("فاتورة جديدة", "New")}</Link>} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["", "approved", "draft", "cancelled"].map((s) => (
          <button key={s} className={status === s ? "btn-primary" : "btn-ghost"} onClick={() => setStatus(s)}>
            {s === "" ? t("الكل", "All") : t(STATUS[s][0], STATUS[s][1])}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("رقم", "No.")}</th><th>{t("العميل", "Customer")}</th><th>{t("التاريخ", "Date")}</th>
              <th>{t("الأصناف", "Items")}</th><th>{t("الصافي", "Total")}</th><th>{t("الربح", "Profit")}</th><th>{t("الحالة", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} style={{ cursor: "pointer" }} onClick={() => navigate(`/invoice/${inv._id}`)}>
                <td className="tabular" style={{ fontWeight: 700 }}>{inv.number}</td>
                <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                <td>{formatDate(inv.date, lang)}</td>
                <td className="tabular">{inv.lines.length}</td>
                <td className="tabular" style={{ fontWeight: 800 }}>{money(inv.total, false)}</td>
                <td className="tabular text-accent">{money(inv.expectedProfit, false)}</td>
                <td>
                  <span className={"pill " + STATUS[inv.status][2]}>{t(STATUS[inv.status][0], STATUS[inv.status][1])}</span>
                  {inv.belowCost && <span title={t("بيع بأقل من التكلفة", "Below cost")} className="text-danger" style={{ marginInlineStart: 4, color: "var(--danger)" }}><Icon name="alert" size={13} /></span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <Empty text={t("لا فواتير", "No invoices")} icon="invoice" />}
      </div>
    </div>
  );
}
