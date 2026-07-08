import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { num, today } from "../lib/format";
import { PageHeader, Icon, Spinner, Empty } from "../components/ui";

interface Row { itemId: string; nameEn: string; nameAr?: string; unit: string; cost: number; sell: number; updatedToday: boolean; dirty?: boolean; }

export default function DailyPrices() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const data = useQuery(api.prices.daily, { date });
  const saveBulk = useMutation(api.prices.setPricesBulk);

  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setRows(data.map((r) => ({ ...r }))); }, [data]);

  const setVal = (id: string, field: "cost" | "sell", value: number) => {
    setRows((rs) => rs.map((r) => (r.itemId === id ? { ...r, [field]: value, dirty: true } : r)));
    setSaved(false);
  };

  const dirtyRows = rows.filter((r) => r.dirty);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.nameEn.toLowerCase().includes(q) || (r.nameAr ?? "").includes(q));
  }, [rows, search]);

  const save = async () => {
    if (dirtyRows.length === 0) return;
    setSaving(true);
    await saveBulk({
      date, changedBy: user?.name,
      rows: dirtyRows.map((r) => ({ itemId: r.itemId as any, cost: Number(r.cost), sell: Number(r.sell) })),
    });
    setSaving(false); setSaved(true);
    setRows((rs) => rs.map((r) => ({ ...r, dirty: false, updatedToday: true })));
  };

  if (data === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={t("تحديث أسعار اليوم", "Daily Prices")} subtitle={t("عدّل الأسعار بسرعة واحفظها دفعة واحدة", "Edit prices fast, save at once")}
        actions={
          <button className="btn-primary" onClick={save} disabled={saving || dirtyRows.length === 0}>
            <Icon name="check" size={16} /> {saving ? t("جارٍ الحفظ…", "Saving…") : t(`حفظ (${dirtyRows.length})`, `Save (${dirtyRows.length})`)}
          </button>
        } />

      {saved && <div className="pill badge-success" style={{ marginBottom: 12 }}><Icon name="check" size={14} /> {t("تم حفظ الأسعار", "Prices saved")}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input className="field" placeholder={t("بحث…", "Search…")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingInlineStart: 38 }} />
          <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
        </div>
        <div>
          <input className="field tabular" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("الصنف", "Item")}</th>
              <th>{t("الوحدة", "Unit")}</th>
              <th style={{ width: 120 }}>{t("سعر الشراء", "Cost")}</th>
              <th style={{ width: 120 }}>{t("سعر البيع", "Sell")}</th>
              <th style={{ width: 90 }}>{t("الربح %", "Margin")}</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const margin = r.sell > 0 ? (((r.sell - r.cost) / r.sell) * 100) : 0;
              return (
                <tr key={r.itemId} style={r.dirty ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)" } : undefined}>
                  <td style={{ fontWeight: 700 }}>{lang === "ar" ? (r.nameAr ?? r.nameEn) : r.nameEn}</td>
                  <td><span className="pill badge-muted">{r.unit}</span></td>
                  <td><input className="field tabular" type="number" step="0.25" value={r.cost} onChange={(e) => setVal(r.itemId, "cost", Number(e.target.value))} style={{ padding: "6px 8px" }} /></td>
                  <td><input className="field tabular" type="number" step="0.25" value={r.sell} onChange={(e) => setVal(r.itemId, "sell", Number(e.target.value))} style={{ padding: "6px 8px", fontWeight: 700 }} /></td>
                  <td><span className={"pill " + (margin < 0 ? "badge-danger" : margin < 15 ? "badge-warning" : "badge-success")}>{num(margin)}%</span></td>
                  <td>{r.updatedToday && !r.dirty ? <span className="text-accent" title={t("محدّث اليوم", "Updated today")}><Icon name="check" size={16} /></span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty text={t("لا أصناف", "No items")} />}
      </div>
      <div className="text-muted" style={{ fontSize: 12, marginTop: 10, textAlign: "center" }}>
        {t("يُحفظ سعر كل يوم في سجل منفصل — الفواتير القديمة لا تتأثر بتغيّر الأسعار.", "Each day's price is stored separately — old invoices are never affected.")}
      </div>
    </div>
  );
}
