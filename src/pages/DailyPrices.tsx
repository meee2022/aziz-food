import { useState, useEffect, useMemo } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { num, today, PRICE_SOURCE } from "../lib/format";
import { PageHeader, Icon, Spinner, Empty, NumField } from "../components/ui";

interface Row { itemId: string; nameEn: string; nameAr?: string; unit: string; cost: number; sell: number; updatedToday: boolean; dirty?: boolean; }

export default function DailyPrices() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const [date, setDate] = useState(today());
  const data = useQuery(api.prices.daily, { date });
  const saveBulk = useMutation(api.prices.setPricesBulk);

  // معاينة سعر عميل مختار: يعرض السعر الفعّال ومصدره لكل صنف بجانب سعر اليوم
  const customers = useQuery(api.customers.list, {});
  const [customerId, setCustomerId] = useState<string>("");
  const custPrices = useQuery(
    api.customers.priceListFor,
    customerId ? { customerId: customerId as any, date } : "skip",
  );
  const custMap = useMemo(
    () => new Map((custPrices ?? []).map((p: any) => [p.itemId, p])),
    [custPrices],
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [belowOnly, setBelowOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setRows(data.map((r) => ({ ...r }))); }, [data]);

  const setVal = (id: string, field: "cost" | "sell", value: number) => {
    setRows((rs) => rs.map((r) => (r.itemId === id ? { ...r, [field]: value, dirty: true } : r)));
    setSaved(false);
  };

  const dirtyRows = rows.filter((r) => r.dirty);
  const belowCostCount = rows.filter((r) => r.sell > 0 && r.sell < r.cost).length;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (belowOnly && !(r.sell > 0 && r.sell < r.cost)) return false;
      return !q || r.nameEn.toLowerCase().includes(q) || (r.nameAr ?? "").includes(q);
    });
  }, [rows, search, belowOnly]);

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

  const showCust = !!customerId;

  return (
    <div className="animate-in">
      <PageHeader title={t("مركز الأسعار", "Price Center")} subtitle={t("سعر الشراء والبيع لليوم — وسعر أي عميل ومصدره في نفس المكان", "Cost & sell for the day — plus any customer's price and its source")}
        actions={
          <button className="btn-primary" onClick={save} disabled={saving || dirtyRows.length === 0}>
            <Icon name="check" size={16} /> {saving ? t("جارٍ الحفظ…", "Saving…") : t(`حفظ (${dirtyRows.length})`, `Save (${dirtyRows.length})`)}
          </button>
        } />

      {saved && <div className="pill badge-success" style={{ marginBottom: 12 }}><Icon name="check" size={14} /> {t("تم حفظ الأسعار", "Prices saved")}</div>}

      {belowCostCount > 0 && (
        <div className="pill badge-danger" style={{ marginBottom: 12, padding: "9px 13px", cursor: "pointer" }} onClick={() => setBelowOnly((v) => !v)}>
          <Icon name="alert" size={15} /> {t(`${belowCostCount} صنف سعر بيعه أقل من التكلفة`, `${belowCostCount} item(s) priced below cost`)}
          <span style={{ fontWeight: 800, marginInlineStart: 6 }}>{belowOnly ? t("• عرض الكل", "• show all") : t("• اعرضها فقط", "• show only these")}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input className="field" placeholder={t("بحث…", "Search…")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingInlineStart: 38 }} />
          <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
        </div>
        <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ width: "auto", minWidth: 170 }}>
          <option value="">{t("— بدون عميل (سعر اليوم) —", "— No customer (base) —")}</option>
          {(customers ?? []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <input className="field tabular" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "auto" }} />
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
              {showCust && <th style={{ width: 170 }}>{t("سعر العميل", "Customer price")}</th>}
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const margin = r.sell > 0 ? (((r.sell - r.cost) / r.sell) * 100) : 0;
              const below = r.sell > 0 && r.sell < r.cost;
              const cp: any = showCust ? custMap.get(r.itemId) : null;
              const src = cp ? (PRICE_SOURCE[cp.source] ?? PRICE_SOURCE.default) : null;
              return (
                <tr key={r.itemId} style={r.dirty ? { background: "color-mix(in srgb, var(--accent) 12%, transparent)" } : below ? { background: "var(--danger-bg)" } : undefined}>
                  <td style={{ fontWeight: 700 }}>{lang === "ar" ? (r.nameAr ?? r.nameEn) : r.nameEn}</td>
                  <td><span className="pill badge-muted">{r.unit}</span></td>
                  <td><NumField value={r.cost} onChange={(n) => setVal(r.itemId, "cost", n)} style={{ padding: "6px 8px" }} /></td>
                  <td><NumField value={r.sell} onChange={(n) => setVal(r.itemId, "sell", n)} style={{ padding: "6px 8px", fontWeight: 700 }} /></td>
                  <td><span className={"pill " + (margin < 0 ? "badge-danger" : margin < 15 ? "badge-warning" : "badge-success")}>{num(margin)}%</span></td>
                  {showCust && (
                    <td>
                      {cp ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <b className="tabular">{num(cp.sell)}</b>
                          <span className={"pill " + src![2]} style={{ fontSize: 10 }}>{t(src![0], src![1])}</span>
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  )}
                  <td>{r.updatedToday && !r.dirty ? <span className="text-accent" title={t("محدّث اليوم", "Updated today")}><Icon name="check" size={16} /></span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty text={t("لا أصناف", "No items")} />}
      </div>

      {showCust && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 10, textAlign: "center" }}>
          {t("«سعر العميل» يوضّح السعر الفعّال ومصدره. لتعديل سعر خاص افتح صفحة العميل ← الأسعار الخاصة.",
             "“Customer price” shows the effective price and its source. To set a special price open the customer page → Special Prices.")}
        </div>
      )}
      <div className="text-muted" style={{ fontSize: 12, marginTop: 6, textAlign: "center" }}>
        {t("يُحفظ سعر كل يوم في سجل منفصل — الفواتير القديمة لا تتأثر بتغيّر الأسعار.", "Each day's price is stored separately — old invoices are never affected.")}
      </div>
    </div>
  );
}
