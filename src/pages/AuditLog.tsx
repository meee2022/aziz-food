import { useMemo, useState } from "react";
import { useAuthedQuery as useQuery } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { formatDateTime } from "../lib/format";
import { PageHeader, Icon, Spinner, Empty } from "../components/ui";

// النوع: [عربي، إنجليزي، أيقونة، لون الشارة]
const ENTITY: Record<string, [string, string, string, string]> = {
  invoice: ["فاتورة", "Invoice", "invoice", "badge-info"],
  payment: ["دفعة", "Payment", "money", "badge-success"],
  return: ["مرتجع", "Return", "back", "badge-warning"],
  order: ["طلب", "Order", "clipboard", "badge-info"],
};

const ACTION: Record<string, [string, string]> = {
  create: ["إنشاء", "created"],
  "create+approve": ["إنشاء واعتماد", "created & approved"],
  edit: ["تعديل", "edited"],
  "edit-approved": ["تعديل فاتورة معتمدة", "edited approved"],
  approve: ["اعتماد", "approved"],
  cancel: ["إلغاء", "cancelled"],
  confirm: ["اعتماد طلب", "confirmed"],
  delete: ["حذف", "deleted"],
};

const FILTERS: [string, string, string][] = [
  ["", "الكل", "All"],
  ["invoice", "الفواتير", "Invoices"],
  ["payment", "المدفوعات", "Payments"],
  ["return", "المرتجعات", "Returns"],
  ["order", "الطلبات", "Orders"],
];

export default function AuditLog() {
  const t = useT(); const { lang } = useLang();
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const rows = useQuery(api.audit.list, entity ? { entity } : {});

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => [r.userName, r.details, r.action].some((f) => f?.toLowerCase().includes(q)));
  }, [rows, search]);

  if (rows === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("سجل النشاط", "Activity Log")} subtitle={t("مين عمل إيه ومتى — للمراجعة والمساءلة", "Who did what and when")} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {FILTERS.map(([k, ar, en]) => (
          <button key={k} className={entity === k ? "btn-primary" : "btn-ghost"} onClick={() => setEntity(k)}>{t(ar, en)}</button>
        ))}
        <input className="field" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t("ابحث باسم المستخدم أو التفاصيل…", "Search user or details…")}
          style={{ width: "auto", flex: "1 1 200px", minWidth: 160 }} />
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr>
            <th>{t("الوقت", "When")}</th><th>{t("النوع", "Type")}</th><th>{t("الإجراء", "Action")}</th>
            <th>{t("التفاصيل", "Details")}</th><th>{t("المستخدم", "User")}</th>
          </tr></thead>
          <tbody>
            {filtered.map((r: any) => {
              const e = ENTITY[r.entity] ?? [r.entity, r.entity, "box", "badge-muted"];
              const a = ACTION[r.action] ?? [r.action, r.action];
              return (
                <tr key={r._id}>
                  <td className="tabular" style={{ whiteSpace: "nowrap", fontSize: 12 }}>{formatDateTime(r.at, lang)}</td>
                  <td><span className={"pill " + e[3]}><Icon name={e[2]} size={12} /> {t(e[0], e[1])}</span></td>
                  <td style={{ fontWeight: 600 }}>{t(a[0], a[1])}</td>
                  <td className="text-muted" style={{ fontSize: 13 }}>{r.details || "—"}</td>
                  <td>{r.userName ? <span className="pill badge-muted">{r.userName}</span> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty text={t("لا نشاط", "No activity")} icon="clipboard" />}
      </div>
    </div>
  );
}
