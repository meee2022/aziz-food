import { useState } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { money, today } from "../lib/format";
import { PageHeader, Icon, Modal, Spinner, Empty } from "../components/ui";

export default function PriceLists() {
  const t = useT(); const { lang } = useLang();
  const lists = useQuery(api.priceLists.list, {});
  const create = useMutation(api.priceLists.create);
  const update = useMutation(api.priceLists.update);
  const remove = useMutation(api.priceLists.remove);
  const [editing, setEditing] = useState<any>(null);
  const [pricing, setPricing] = useState<any>(null);

  if (lists === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("قوائم الأسعار", "Price Lists")} subtitle={t("أسعار موحّدة لكل شريحة عملاء", "Group pricing tiers")}
        actions={<button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} /> {t("قائمة جديدة", "New List")}</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {lists.map((l) => (
          <div key={l._id} className="card card-hover">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="icon-orb icon-orb-accent"><Icon name="tag" size={18} /></div>
                <div>
                  <div style={{ fontWeight: 800 }}>{lang === "ar" ? l.nameAr : l.nameEn}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{l.itemCount} {t("صنف مخصّص", "custom")} {l.marginPct ? `· ${l.marginPct > 0 ? "+" : ""}${l.marginPct}%` : ""}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPricing(l)}><Icon name="money" size={15} /> {t("الأسعار", "Prices")}</button>
              <button className="btn-ghost btn-icon" onClick={() => setEditing(l)}><Icon name="edit" size={15} /></button>
              <button className="btn-ghost btn-icon" onClick={() => confirm(t("حذف القائمة؟", "Delete?")) && remove({ id: l._id })}><Icon name="trash" size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      {lists.length === 0 && <Empty text={t("لا قوائم", "No lists")} icon="tag" />}

      {editing && <ListModal list={editing} onClose={() => setEditing(null)} onSave={async (d: any) => {
        if (editing._id) await update({ id: editing._id, ...d }); else await create(d); setEditing(null);
      }} />}
      {pricing && <PricingModal list={pricing} onClose={() => setPricing(null)} />}
    </div>
  );
}

function ListModal({ list, onClose, onSave }: any) {
  const t = useT();
  const [f, setF] = useState({ nameAr: list.nameAr ?? "", nameEn: list.nameEn ?? "", marginPct: list.marginPct ?? 0, note: list.note ?? "" });
  return (
    <Modal open title={list._id ? t("تعديل قائمة", "Edit List") : t("قائمة جديدة", "New List")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">{t("الاسم (عربي)", "Name AR")}</label><input className="field" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></div>
          <div><label className="label">{t("الاسم (إنجليزي)", "Name EN")}</label><input className="field" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></div>
        </div>
        <div><label className="label">{t("هامش عام % (على سعر البيع الافتراضي)", "Margin % over default")}</label><input className="field tabular" type="number" value={f.marginPct} onChange={(e) => setF({ ...f, marginPct: Number(e.target.value) })} /></div>
        <button className="btn-primary" disabled={!f.nameAr} onClick={() => onSave(f)}><Icon name="check" size={16} /> {t("حفظ", "Save")}</button>
      </div>
    </Modal>
  );
}

function PricingModal({ list, onClose }: any) {
  const t = useT(); const { lang } = useLang();
  const items = useQuery(api.items.list, { date: today() });
  const listItems = useQuery(api.priceLists.items, { priceListId: list._id });
  const setItemPrice = useMutation(api.priceLists.setItemPrice);
  const [search, setSearch] = useState("");
  if (items === undefined || listItems === undefined) return <Modal open title="…" onClose={onClose}><Spinner /></Modal>;
  const priceMap = new Map<any, any>(listItems.map((li: any) => [li.itemId, li.price]));
  const q = search.trim().toLowerCase();
  const rows = items.filter((it) => !q || it.nameEn.toLowerCase().includes(q) || (it.nameAr ?? "").includes(q));
  return (
    <Modal open wide title={(lang === "ar" ? list.nameAr : list.nameEn) + " — " + t("الأسعار", "Prices")} onClose={onClose}>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input className="field" placeholder={t("بحث…", "Search…")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingInlineStart: 38 }} />
        <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
      </div>
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className="data-table">
          <thead><tr><th>{t("الصنف", "Item")}</th><th>{t("الافتراضي", "Default")}</th><th style={{ width: 140 }}>{t("سعر القائمة", "List price")}</th></tr></thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it._id}>
                <td style={{ fontWeight: 700 }}>{lang === "ar" ? (it.nameAr ?? it.nameEn) : it.nameEn} <span className="pill badge-muted">{it.unit}</span></td>
                <td className="tabular text-muted">{money(it.todaySell, false)}</td>
                <td><input className="field tabular" type="number" placeholder={money(it.todaySell, false)} defaultValue={priceMap.get(it._id) ?? ""}
                  onBlur={(e) => { const v = e.target.value.trim(); setItemPrice({ priceListId: list._id, itemId: it._id, price: v === "" ? undefined : Number(v) }); }}
                  style={{ padding: "6px 8px" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
