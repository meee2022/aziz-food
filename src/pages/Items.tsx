import { useState, useMemo, useRef } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, today, formatDate } from "../lib/format";
import { readExcelRaw, guessItemRow, exportExcel } from "../lib/xlsx";
import { PageHeader, Icon, Modal, Spinner, Empty, NumField } from "../components/ui";

import { useUnits } from "../lib/units";

export default function Items() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const items = useQuery(api.items.list, { date: today() });
  const cats = useQuery(api.categories.list, {});
  const create = useMutation(api.items.create);
  const update = useMutation(api.items.update);
  const remove = useMutation(api.items.remove);
  const importItems = useMutation(api.prices.importItems);
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [editing, setEditing] = useState<any>(null);
  const [historyItem, setHistoryItem] = useState<any>(null);
  const [importResult, setImportResult] = useState<string>("");

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((it) =>
      (!catFilter || it.categoryId === catFilter) &&
      (!q || it.nameEn.toLowerCase().includes(q) || (it.nameAr ?? "").includes(q)),
    );
  }, [items, search, catFilter]);

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await readExcelRaw(file);
    const rows = raw.map(guessItemRow).filter(Boolean) as { name: string; unit: string; sell: number }[];
    if (rows.length === 0) { setImportResult(t("لم يتم العثور على صفوف صالحة", "No valid rows found")); return; }
    const res = await importItems({
      rows: rows.map((r) => ({ name: r.name, unit: r.unit, sell: r.sell })),
      changedBy: user?.name, date: today(),
    });
    setImportResult(t(`تم: ${res.created} صنف جديد، ${res.updated} تحديث`, `Done: ${res.created} new, ${res.updated} updated`));
    if (fileRef.current) fileRef.current.value = "";
  };

  const onExport = () => {
    if (!items) return;
    exportExcel(items.map((it) => ({
      Name: it.nameEn, NameAr: it.nameAr ?? "", Unit: it.unit,
      Category: it.category?.nameEn ?? "", Cost: it.todayCost, Sell: it.todaySell, Margin: it.marginPct + "%",
    })), `items-${today()}`);
  };

  if (items === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("الأصناف", "Items")} subtitle={t(`${items.length} صنف`, `${items.length} items`)}
        actions={<>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onImport} style={{ display: "none" }} />
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> {t("رفع Excel", "Import")}</button>
          <button className="btn-ghost" onClick={onExport}><Icon name="download" size={16} /> {t("تصدير", "Export")}</button>
          <button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} /> {t("صنف جديد", "New Item")}</button>
        </>} />

      {importResult && <div className="pill badge-success" style={{ marginBottom: 12 }}><Icon name="check" size={14} /> {importResult}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input className="field" placeholder={t("بحث عن صنف…", "Search item…")} value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingInlineStart: 38 }} />
          <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
        </div>
        <select className="field" style={{ maxWidth: 180 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">{t("كل التصنيفات", "All categories")}</option>
          {cats?.map((c) => <option key={c._id} value={c._id}>{lang === "ar" ? c.nameAr : c.nameEn}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("الصنف", "Item")}</th>
              <th>{t("الوحدة", "Unit")}</th>
              <th>{t("التصنيف", "Category")}</th>
              <th>{t("التكلفة", "Cost")}</th>
              <th>{t("البيع", "Sell")}</th>
              <th>{t("الربح %", "Margin")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it._id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{lang === "ar" ? (it.nameAr ?? it.nameEn) : it.nameEn}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{lang === "ar" ? it.nameEn : it.nameAr}</div>
                </td>
                <td><span className="pill badge-muted">{it.unit}</span></td>
                <td>{it.category ? (lang === "ar" ? it.category.nameAr : it.category.nameEn) : "—"}</td>
                <td className="tabular">{money(it.todayCost, false)}</td>
                <td className="tabular" style={{ fontWeight: 700 }}>{money(it.todaySell, false)}</td>
                <td><span className={"pill " + (it.marginPct < 0 ? "badge-danger" : it.marginPct < 15 ? "badge-warning" : "badge-success")}>{num(it.marginPct)}%</span></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-ghost btn-icon" title={t("سجل الأسعار", "Price history")} onClick={() => setHistoryItem(it)}><Icon name="chart" size={15} /></button>
                    <button className="btn-ghost btn-icon" onClick={() => setEditing(it)}><Icon name="edit" size={15} /></button>
                    <button className="btn-ghost btn-icon" onClick={() => confirm(t("حذف الصنف؟", "Delete item?")) && remove({ id: it._id })}><Icon name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty text={t("لا توجد أصناف", "No items")} />}
      </div>

      {editing && <ItemModal item={editing} cats={cats ?? []} onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (editing._id) await update({ id: editing._id, ...data });
          else await create(data);
          setEditing(null);
        }} />}

      {historyItem && <HistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
    </div>
  );
}

function ItemModal({ item, cats, onClose, onSave }: any) {
  const t = useT(); const { lang } = useLang();
  const UNITS = useUnits();
  const [f, setF] = useState({
    nameEn: item.nameEn ?? "", nameAr: item.nameAr ?? "", unit: item.unit ?? "KG",
    categoryId: item.categoryId ?? "", defaultCost: item.todayCost ?? item.defaultCost ?? 0,
    defaultSell: item.todaySell ?? item.defaultSell ?? 0,
    origin: item.origin ?? "local",
  });
  const margin = f.defaultSell > 0 ? (((f.defaultSell - f.defaultCost) / f.defaultSell) * 100).toFixed(1) : "0";
  return (
    <Modal open title={item._id ? t("تعديل صنف", "Edit Item") : t("صنف جديد", "New Item")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div><label className="label">{t("الاسم (إنجليزي)", "Name (EN)")}</label><input className="field" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></div>
          <div><label className="label">{t("الاسم (عربي)", "Name (AR)")}</label><input className="field" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div><label className="label">{t("الوحدة", "Unit")}</label>
            <select className="field" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
          <div><label className="label">{t("التصنيف", "Category")}</label>
            <select className="field" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">—</option>{cats.map((c: any) => <option key={c._id} value={c._id}>{lang === "ar" ? c.nameAr : c.nameEn}</option>)}
            </select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12 }}>
          <div><label className="label">{t("سعر التكلفة", "Cost")}</label><NumField value={f.defaultCost} onChange={(n) => setF({ ...f, defaultCost: n })} /></div>
          <div><label className="label">{t("سعر البيع", "Sell")}</label><NumField value={f.defaultSell} onChange={(n) => setF({ ...f, defaultSell: n })} /></div>
          <div><label className="label">{t("هامش الربح", "Margin")}</label><div className="field tabular" style={{ background: "var(--surface)", fontWeight: 800 }}>{margin}%</div></div>
        </div>
        <div><label className="label">{t("المصدر", "Origin")}</label>
          <select className="field" value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })}>
            <option value="local">{t("محلي", "Local")}</option><option value="imported">{t("مستورد", "Imported")}</option>
          </select></div>
        <button className="btn-primary" disabled={!f.nameEn} onClick={() => onSave({ ...f, categoryId: f.categoryId || undefined })} style={{ marginTop: 6 }}>
          <Icon name="check" size={16} /> {t("حفظ", "Save")}
        </button>
      </div>
    </Modal>
  );
}

function HistoryModal({ item, onClose }: any) {
  const t = useT();
  const hist = useQuery(api.items.priceHistory, { itemId: item._id, limit: 60 });
  return (
    <Modal open title={t("سجل أسعار", "Price History") + " — " + item.nameEn} onClose={onClose}>
      {hist === undefined ? <Spinner /> : hist.length === 0 ? <Empty text={t("لا سجل", "No history")} /> : (
        <table className="data-table">
          <thead><tr><th>{t("التاريخ", "Date")}</th><th>{t("التكلفة", "Cost")}</th><th>{t("البيع", "Sell")}</th><th>{t("ملاحظة", "Note")}</th></tr></thead>
          <tbody>{hist.map((h: any) => (
            <tr key={h._id}><td>{formatDate(h.date)}</td><td className="tabular">{money(h.cost, false)}</td><td className="tabular" style={{ fontWeight: 700 }}>{money(h.sell, false)}</td><td className="text-muted" style={{ fontSize: 12 }}>{h.note ?? ""}</td></tr>
          ))}</tbody>
        </table>
      )}
    </Modal>
  );
}
