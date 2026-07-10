import { useState } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { money, num, formatDate } from "../lib/format";
import { PageHeader, Icon, Modal, Spinner, Empty } from "../components/ui";

const STATUS: Record<string, [string, string, string]> = {
  pending: ["قيد المراجعة", "Pending", "badge-warning"],
  confirmed: ["معتمد", "Confirmed", "badge-success"],
  rejected: ["مرفوض", "Rejected", "badge-danger"],
};

export default function Orders() {
  const t = useT(); const { lang } = useLang();
  const [status, setStatus] = useState<string>("pending");
  const orders = useQuery(api.orders.list, status ? { status: status as any } : {});
  const [review, setReview] = useState<any>(null);

  if (orders === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("طلبات العملاء", "Customer Orders")} subtitle={t("راجع الطلبات واعتمدها أو حدّد المتاح", "Review, approve or set availability")} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {["pending", "", "confirmed", "rejected"].map((s) => (
          <button key={s} className={status === s ? "btn-primary" : "btn-ghost"} onClick={() => setStatus(s)}>
            {s === "" ? t("الكل", "All") : t(STATUS[s][0], STATUS[s][1])}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>{t("رقم", "No.")}</th><th>{t("العميل", "Customer")}</th><th>{t("التاريخ", "Date")}</th><th>{t("الأصناف", "Items")}</th><th>{t("الإجمالي المطلوب", "Requested")}</th><th>{t("الحالة", "Status")}</th></tr></thead>
          <tbody>
            {orders.map((o: any) => {
              const reqTotal = o.lines.reduce((s: number, l: any) => s + l.qtyRequested * l.unitPrice, 0);
              return (
                <tr key={o._id} style={{ cursor: "pointer" }} onClick={() => setReview(o)}>
                  <td className="tabular" style={{ fontWeight: 700 }}>{o.number}</td>
                  <td style={{ fontWeight: 600 }}>{o.customerName}</td>
                  <td>{formatDate(o.date, lang)}</td>
                  <td className="tabular">{o.lines.length}</td>
                  <td className="tabular" style={{ fontWeight: 700 }}>{money(reqTotal, false)}</td>
                  <td><span className={"pill " + STATUS[o.status][2]}>{t(STATUS[o.status][0], STATUS[o.status][1])}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && <Empty text={t("لا طلبات", "No orders")} icon="cart" />}
      </div>

      {review && <ReviewModal order={review} onClose={() => setReview(null)} />}
    </div>
  );
}

function ReviewModal({ order, onClose }: any) {
  const t = useT(); const { lang } = useLang();
  const navigate = useNavigate();
  const review = useMutation(api.orders.review);
  const confirm = useMutation(api.orders.confirm);
  const reject = useMutation(api.orders.reject);
  const isPending = order.status === "pending";

  const [lines, setLines] = useState<any[]>(order.lines.map((l: any) => ({ ...l })));
  const [ownerNote, setOwnerNote] = useState(order.ownerNote ?? "");
  const [busy, setBusy] = useState(false);

  const setLine = (i: number, patch: any) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const total = lines.filter((l) => l.available).reduce((s, l) => s + l.qtyApproved * l.unitPrice, 0);

  const doReview = async () => {
    setBusy(true);
    try {
      await review({ id: order._id, ownerNote: ownerNote || undefined, lines: lines.map((l, i) => ({ index: i, available: l.available, qtyApproved: Number(l.qtyApproved) })) });
      onClose();
    } finally { setBusy(false); }
  };
  const doConfirm = async () => {
    setBusy(true);
    try {
      // احفظ المراجعة أولًا ثم اعتمد
      await review({ id: order._id, ownerNote: ownerNote || undefined, lines: lines.map((l, i) => ({ index: i, available: l.available, qtyApproved: Number(l.qtyApproved) })) });
      const res = await confirm({ id: order._id, approveInvoice: true, ownerNote: ownerNote || undefined });
      onClose();
      navigate(`/invoice/${res.invoiceId}`);
    } finally { setBusy(false); }
  };
  const doReject = async () => {
    if (!window.confirm(t("رفض الطلب؟", "Reject order?"))) return;
    setBusy(true);
    try { await reject({ id: order._id, ownerNote: ownerNote || undefined }); onClose(); } finally { setBusy(false); }
  };

  return (
    <Modal open wide title={`${t("مراجعة الطلب", "Review order")} ${order.number} — ${order.customerName}`} onClose={onClose}>
      {order.note && <div className="pill badge-info" style={{ marginBottom: 12, padding: "8px 12px" }}><Icon name="alert" size={14} /> {t("ملاحظة العميل", "Customer note")}: {order.note}</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>{t("متاح", "Avail")}</th><th>{t("الصنف", "Item")}</th><th>{t("مطلوب", "Req")}</th><th>{t("معتمد", "Approve")}</th><th>{t("السعر", "Price")}</th><th>{t("الإجمالي", "Total")}</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ opacity: l.available ? 1 : 0.55 }}>
                <td style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={l.available} disabled={!isPending} onChange={(e) => setLine(i, { available: e.target.checked })} style={{ width: 18, height: 18 }} />
                </td>
                <td style={{ fontWeight: 700 }}>{l.name} <span className="pill badge-muted">{l.unit}</span></td>
                <td className="tabular">{num(l.qtyRequested)}</td>
                <td>
                  {isPending
                    ? <input className="field tabular" type="number" min="0" step="any" value={l.qtyApproved} disabled={!l.available} onChange={(e) => setLine(i, { qtyApproved: Number(e.target.value) })} style={{ padding: "5px 8px", width: 80 }} />
                    : <span className="tabular">{num(l.qtyApproved)}</span>}
                </td>
                <td className="tabular">{money(l.unitPrice, false)}</td>
                <td className="tabular" style={{ fontWeight: 700 }}>{l.available ? money(l.qtyApproved * l.unitPrice, false) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0" }}>
        <span className="text-muted" style={{ fontSize: 13 }}>{t("إجمالي المتاح", "Available total")}</span>
        <b className="tabular" style={{ fontSize: 18 }}>{money(total)}</b>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="label">{t("ملاحظة للعميل (تظهر له)", "Note to customer (visible)")}</label>
        <input className="field" value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} disabled={!isPending} placeholder={t("مثلاً: الطماطم خلصت اليوم", "e.g. tomato out today")} />
      </div>

      {order.status === "confirmed" && order.invoiceId && (
        <button className="btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={() => { onClose(); navigate(`/invoice/${order.invoiceId}`); }}>
          <Icon name="invoice" size={16} /> {t("عرض الفاتورة", "View invoice")}
        </button>
      )}

      {isPending && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" style={{ flex: 1, minWidth: 120 }} disabled={busy} onClick={doReview}><Icon name="check" size={16} /> {t("حفظ المراجعة", "Save review")}</button>
          <button className="btn-danger" disabled={busy} onClick={doReject}><Icon name="x" size={16} /> {t("رفض", "Reject")}</button>
          <button className="btn-primary" style={{ flex: 2, minWidth: 180 }} disabled={busy} onClick={doConfirm}><Icon name="check" size={18} /> {t("اعتماد وإنشاء فاتورة", "Approve → Invoice")}</button>
        </div>
      )}
    </Modal>
  );
}
