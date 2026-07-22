import { useMemo, useState } from "react";
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
  // فروع مختارة (فارغة = كل الفروع). "__none" = فواتير بدون فرع.
  const [selBranches, setSelBranches] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const all = useQuery(api.invoices.list, status ? { status: status as any } : {});

  const toggleBranch = (b: string) =>
    setSelBranches((prev) => { const n = new Set(prev); n.has(b) ? n.delete(b) : n.add(b); return n; });

  // الفروع المستخدمة فعلًا في الفواتير — لا حاجة لجدول فروع منفصل
  const branches = useMemo(() => {
    if (!all) return [];
    return [...new Set(all.map((i) => i.branch).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ar"));
  }, [all]);
  const hasNoBranch = useMemo(() => (all ?? []).some((i) => !i.branch), [all]);

  const invoices = useMemo(() => {
    if (!all) return [];
    const q = search.trim().toLowerCase();
    return all.filter((inv) => {
      if (selBranches.size > 0) {
        const ok = inv.branch ? selBranches.has(inv.branch) : selBranches.has("__none");
        if (!ok) return false;
      }
      if (!q) return true;
      return [inv.number, inv.customerName, inv.branch].some((f) => f?.toLowerCase().includes(q));
    });
  }, [all, selBranches, search]);

  if (all === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("الفواتير", "Invoices")} subtitle={t(`${invoices.length} فاتورة`, `${invoices.length} invoices`)}
        actions={<Link to="/invoice/new" className="btn-primary"><Icon name="plus" size={16} /> {t("فاتورة جديدة", "New")}</Link>} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {["", "approved", "draft", "cancelled"].map((s) => (
          <button key={s} className={status === s ? "btn-primary" : "btn-ghost"} onClick={() => setStatus(s)}>
            {s === "" ? t("الكل", "All") : t(STATUS[s][0], STATUS[s][1])}
          </button>
        ))}
        <input className="field" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("ابحث برقم الفاتورة أو العميل أو الفرع…", "Search number, customer or branch…")}
          style={{ width: "auto", flex: "1 1 220px", minWidth: 180 }} />
      </div>

      {/* فلتر الفروع — اختيار متعدد (اضغط الفروع اللي عايزها) */}
      {branches.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>{t("الفروع:", "Branches:")}</span>
          <button className={selBranches.size === 0 ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setSelBranches(new Set())}>
            {t("الكل", "All")}
          </button>
          {branches.map((b) => (
            <button key={b} className={selBranches.has(b) ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => toggleBranch(b)}>
              {selBranches.has(b) && <Icon name="check" size={12} />} {b}
            </button>
          ))}
          {hasNoBranch && (
            <button className={selBranches.has("__none") ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => toggleBranch("__none")}>
              {selBranches.has("__none") && <Icon name="check" size={12} />} {t("بدون فرع", "No branch")}
            </button>
          )}
          {selBranches.size > 0 && (
            <span className="text-muted" style={{ fontSize: 11.5 }}>
              {t(`(${selBranches.size} مختار)`, `(${selBranches.size} selected)`)}
            </span>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("رقم", "No.")}</th><th>{t("العميل", "Customer")}</th><th>{t("الفرع", "Branch")}</th><th>{t("التاريخ", "Date")}</th>
              <th>{t("الأصناف", "Items")}</th><th>{t("الصافي", "Total")}</th><th>{t("الربح", "Profit")}</th><th>{t("الحالة", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} style={{ cursor: "pointer" }} onClick={() => navigate(`/invoice/${inv._id}`)}>
                <td className="tabular" style={{ fontWeight: 700 }}>{inv.number}</td>
                <td style={{ fontWeight: 600 }}>{inv.customerName}</td>
                <td>{inv.branch ? <span className="pill badge-muted">{inv.branch}</span> : <span className="text-muted">—</span>}</td>
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
