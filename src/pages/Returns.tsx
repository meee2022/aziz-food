import { useMemo, useState } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, formatDate } from "../lib/format";
import { PageHeader, Icon, Modal, Spinner, Empty, NumField } from "../components/ui";

export default function Returns() {
  const t = useT(); const { lang } = useLang();
  const { user } = useAuth();
  const returns = useQuery(api.returns.list, {});
  const removeReturn = useMutation(api.returns.remove);
  const [open, setOpen] = useState(false);

  if (returns === undefined) return <Spinner />;
  const total = returns.reduce((s: number, r: any) => s + r.total, 0);

  return (
    <div className="animate-in">
      <PageHeader title={t("المرتجعات", "Returns")} subtitle={t(`${returns.length} مرتجع — إجمالي ${money(total)}`, `${returns.length} returns — total ${money(total)}`)}
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> {t("مرتجع جديد", "New return")}</button>} />

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr>
            <th>{t("التاريخ", "Date")}</th><th>{t("العميل", "Customer")}</th><th>{t("فاتورة", "Invoice")}</th>
            <th>{t("الأصناف", "Items")}</th><th>{t("القيمة", "Value")}</th><th>{t("ملاحظة", "Note")}</th><th></th>
          </tr></thead>
          <tbody>
            {returns.map((r: any) => (
              <tr key={r._id}>
                <td>{formatDate(r.date, lang)}</td>
                <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                <td>{r.invoiceNumber ? <span className="pill badge-info">{r.invoiceNumber}</span> : <span className="text-muted">—</span>}</td>
                <td className="tabular">{r.lines.length}</td>
                <td className="tabular" style={{ fontWeight: 700, color: "var(--danger)" }}>{money(r.total, false)}</td>
                <td className="text-muted" style={{ fontSize: 12 }}>{r.note || "—"}</td>
                <td>
                  <button className="btn-ghost btn-icon" title={t("حذف", "Delete")}
                    onClick={() => window.confirm(t("حذف هذا المرتجع؟ سيُعاد حساب رصيد العميل.", "Delete this return? Balance will be recomputed.")) && removeReturn({ id: r._id, by: user?.name })}>
                    <Icon name="trash" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {returns.length === 0 && <Empty text={t("لا مرتجعات", "No returns")} icon="box" />}
      </div>

      {open && <ReturnModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function ReturnModal({ onClose }: { onClose: () => void }) {
  const t = useT(); const { lang } = useLang();
  const { user } = useAuth();
  const customers = useQuery(api.customers.list, {});
  const [customerId, setCustomerId] = useState("");
  const invoices = useQuery(api.invoices.list, customerId ? { customerId: customerId as any, status: "approved" } : "skip");
  const create = useMutation(api.returns.create);

  const [invoiceId, setInvoiceId] = useState("");
  const [lines, setLines] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const selectedInvoice = useMemo(() => (invoices ?? []).find((i: any) => i._id === invoiceId), [invoices, invoiceId]);

  // عند اختيار فاتورة: حمّل أسطرها مع كمية إرجاع مبدئية = 0
  const loadInvoice = (id: string) => {
    setInvoiceId(id);
    const inv = (invoices ?? []).find((i: any) => i._id === id);
    if (inv) {
      setLines(inv.lines.map((l: any) => ({
        itemId: l.itemId, name: l.name, unit: l.unit, unitPrice: l.unitPrice, cost: l.cost,
        soldQty: l.qty, qty: 0, // كمية المرتجع
      })));
    } else {
      setLines([]);
    }
  };

  const setQty = (i: number, qty: number) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, qty } : l)));
  const total = lines.reduce((s, l) => s + (l.qty > 0 ? l.qty * l.unitPrice : 0), 0);

  const save = async () => {
    setErr("");
    const picked = lines.filter((l) => l.qty > 0);
    if (!customerId) { setErr(t("اختر العميل", "Pick a customer")); return; }
    if (picked.length === 0) { setErr(t("حدّد كمية الإرجاع لصنف واحد على الأقل", "Set a return qty for at least one item")); return; }
    setBusy(true);
    try {
      await create({
        customerId: customerId as any,
        invoiceId: (invoiceId || undefined) as any,
        invoiceNumber: selectedInvoice?.number,
        lines: picked.map((l) => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty: Number(l.qty), unitPrice: Number(l.unitPrice), cost: Number(l.cost) })),
        note: note || undefined,
        createdBy: user?.name,
      });
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e).replace(/^.*Error:\s*/s, "").split("\n")[0]);
      setBusy(false);
    }
  };

  return (
    <Modal open wide title={t("تسجيل مرتجع", "New return")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="label">{t("العميل", "Customer")}</label>
            <select className="field" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setInvoiceId(""); setLines([]); }}>
              <option value="">{t("— اختر —", "— pick —")}</option>
              {(customers ?? []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("من فاتورة (اختياري)", "From invoice (optional)")}</label>
            <select className="field" value={invoiceId} disabled={!customerId} onChange={(e) => loadInvoice(e.target.value)}>
              <option value="">{t("— بدون فاتورة —", "— none —")}</option>
              {(invoices ?? []).map((i: any) => <option key={i._id} value={i._id}>{i.number} · {formatDate(i.date, lang)} · {money(i.total, false)}</option>)}
            </select>
          </div>
        </div>

        {lines.length > 0 ? (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr>
                <th>{t("الصنف", "Item")}</th><th>{t("مُباع", "Sold")}</th><th style={{ width: 120 }}>{t("كمية الإرجاع", "Return qty")}</th>
                <th>{t("السعر", "Price")}</th><th>{t("القيمة", "Value")}</th>
              </tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} style={l.qty > 0 ? { background: "color-mix(in srgb,var(--danger) 8%,transparent)" } : undefined}>
                    <td style={{ fontWeight: 700 }}>{l.name} <span className="pill badge-muted">{l.unit}</span></td>
                    <td className="tabular">{num(l.soldQty)}</td>
                    <td><NumField value={l.qty} onChange={(n) => setQty(i, Math.min(n, l.soldQty))} style={{ padding: "5px 8px", width: 90 }} /></td>
                    <td className="tabular">{money(l.unitPrice, false)}</td>
                    <td className="tabular" style={{ fontWeight: 700 }}>{l.qty > 0 ? money(l.qty * l.unitPrice, false) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : customerId ? (
          <div className="text-muted" style={{ fontSize: 13, padding: "8px 2px" }}>
            {t("اختر فاتورة لتحميل أصنافها، وحدّد كمية الإرجاع لكل صنف.", "Pick an invoice to load its items, then set the return qty per item.")}
          </div>
        ) : null}

        <div>
          <label className="label">{t("ملاحظة", "Note")}</label>
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("مثلاً: بضاعة تالفة", "e.g. damaged goods")} />
        </div>

        {err && <div className="pill badge-danger" style={{ padding: "8px 12px" }}><Icon name="alert" size={14} /> {err}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="text-muted" style={{ fontSize: 13 }}>{t("إجمالي المرتجع", "Return total")}</span>
          <b className="tabular" style={{ fontSize: 18, color: "var(--danger)" }}>{money(total)}</b>
        </div>

        <button className="btn-primary" disabled={busy || total <= 0} style={{ width: "100%" }} onClick={save}>
          <Icon name="check" size={16} /> {busy ? t("جارٍ الحفظ…", "Saving…") : t("حفظ المرتجع", "Save return")}
        </button>
      </div>
    </Modal>
  );
}
