import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, formatDate, today } from "../lib/format";
import { PageHeader, Icon, Modal, Spinner, Empty } from "../components/ui";

export default function Purchases() {
  const t = useT(); const { lang } = useLang();
  const { user } = useAuth();
  const purchases = useQuery(api.purchases.list, {});
  const items = useQuery(api.items.list, { date: today() });
  const create = useMutation(api.purchases.create);
  const remove = useMutation(api.purchases.remove);
  const [open, setOpen] = useState(false);

  if (purchases === undefined) return <Spinner />;
  const total = purchases.reduce((s, p) => s + p.total, 0);

  return (
    <div className="animate-in">
      <PageHeader title={t("المشتريات", "Purchases")} subtitle={t(`إجمالي: ${money(total)}`, `Total: ${money(total)}`)}
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> {t("تسجيل شراء", "New Purchase")}</button>} />

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>{t("التاريخ", "Date")}</th><th>{t("المورّد", "Supplier")}</th><th>{t("الصنف", "Item")}</th><th>{t("الكمية", "Qty")}</th><th>{t("سعر الشراء", "Cost")}</th><th>{t("الإجمالي", "Total")}</th><th></th></tr></thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p._id}>
                <td>{formatDate(p.date, lang)}</td>
                <td>{p.supplier ?? "—"}</td>
                <td style={{ fontWeight: 600 }}>{p.itemName}</td>
                <td className="tabular">{p.qty}</td>
                <td className="tabular">{money(p.cost, false)}</td>
                <td className="tabular" style={{ fontWeight: 700 }}>{money(p.total, false)}</td>
                <td><button className="btn-ghost btn-icon" onClick={() => remove({ id: p._id })}><Icon name="trash" size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 && <Empty text={t("لا مشتريات", "No purchases")} icon="cart" />}
      </div>

      {open && <PurchaseModal items={items ?? []} onClose={() => setOpen(false)} onSave={async (d: any) => { await create({ ...d, createdBy: user?.name }); setOpen(false); }} />}
    </div>
  );
}

function PurchaseModal({ items, onClose, onSave }: any) {
  const t = useT(); const { lang } = useLang();
  const [f, setF] = useState({ supplier: "", itemId: "", itemName: "", qty: 1, cost: 0, note: "", updateCostPrice: true });
  const onItem = (id: string) => {
    const it = items.find((x: any) => x._id === id);
    setF({ ...f, itemId: id, itemName: it ? it.nameEn : "", cost: it ? it.todayCost : f.cost });
  };
  return (
    <Modal open title={t("تسجيل شراء", "New Purchase")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label className="label">{t("المورّد", "Supplier")}</label><input className="field" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></div>
        <div><label className="label">{t("الصنف", "Item")}</label>
          <select className="field" value={f.itemId} onChange={(e) => onItem(e.target.value)}>
            <option value="">—</option>{items.map((it: any) => <option key={it._id} value={it._id}>{lang === "ar" ? (it.nameAr ?? it.nameEn) : it.nameEn}</option>)}
          </select></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">{t("الكمية", "Qty")}</label><input className="field tabular" type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></div>
          <div><label className="label">{t("سعر الشراء", "Cost")}</label><input className="field tabular" type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} /></div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={f.updateCostPrice} onChange={(e) => setF({ ...f, updateCostPrice: e.target.checked })} />
          {t("تحديث سعر تكلفة الصنف لليوم", "Update item cost price for today")}
        </label>
        <div className="text-muted tabular" style={{ textAlign: "end", fontWeight: 800 }}>{t("الإجمالي", "Total")}: {money(f.qty * f.cost)}</div>
        <button className="btn-primary" disabled={!f.itemName || f.qty <= 0} onClick={() => onSave({ ...f, itemId: f.itemId || undefined, date: today() })}><Icon name="check" size={16} /> {t("حفظ", "Save")}</button>
      </div>
    </Modal>
  );
}
