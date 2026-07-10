import { useState, useMemo, useEffect, useRef } from "react";
import { useConvex } from "convex/react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, today } from "../lib/format";
import { PageHeader, Icon, Spinner, Empty } from "../components/ui";
import { useUnits } from "../lib/units";

interface Line { itemId?: string; name: string; unit: string; qty: number; unitPrice: number; cost: number; }

export default function InvoiceCreate() {
  const { id } = useParams();
  const editMode = !!id;
  const t = useT(); const { lang } = useLang();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const convex = useConvex();

  const customers = useQuery(api.customers.list, {});
  const existing = useQuery(api.invoices.get, editMode ? { id: id as any } : "skip");
  const createInvoice = useMutation(api.invoices.create);
  const updateInvoice = useMutation(api.invoices.update);

  const [customerId, setCustomerId] = useState<string>("");
  const [custSearch, setCustSearch] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [number, setNumber] = useState(""); // فارغ = ترقيم تلقائي
  const [numberTouched, setNumberTouched] = useState(false);
  const UNITS = useUnits();
  const [pickQty, setPickQty] = useState<Record<string, number>>({}); // كمية مبدئية داخل بطاقات الاختيار
  // افتراضيًا: أسعار اليوم. لو فعّلها المستخدم تُستخدم أسعار تاريخ الفاتورة من سجل الأسعار.
  const [usePricesOfDate, setUsePricesOfDate] = useState(false);
  const [location, setLocation] = useState("");
  const [lpo, setLpo] = useState("");
  const [dn, setDn] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  // أسعار الأصناف الفعّالة للعميل المختار + التصنيفات
  // تاريخ التسعير: أسعار اليوم افتراضيًا، أو أسعار تاريخ الفاتورة إن اختار المستخدم ذلك
  const pricingDate = usePricesOfDate ? date : today();
  const prices = useQuery(api.customers.priceListFor, customerId ? { customerId: customerId as any, date: pricingDate } : { date: pricingDate });
  const cats = useQuery(api.categories.list, {});
  // الرقم التالي المقترح حسب آخر فاتورة لهذا العميل
  const numberSuggestion = useQuery(api.invoices.nextNumberForCustomer, (!editMode && customerId) ? { customerId: customerId as any } : "skip");

  useEffect(() => { if (!editMode) setNumberTouched(false); }, [customerId, editMode]);
  useEffect(() => {
    if (editMode || numberTouched || !numberSuggestion) return;
    // تسلسل خاص بالعميل ⇒ عبّئ الرقم. ترقيم النظام ⇒ اتركه فارغًا (يُسنَد عند الحفظ).
    setNumber(numberSuggestion.mode === "customer" ? numberSuggestion.suggested : "");
  }, [numberSuggestion, editMode, numberTouched]);

  // تحميل فاتورة للتعديل
  useEffect(() => {
    if (editMode && existing) {
      if (existing.status === "cancelled") { navigate(`/invoice/${id}`); return; }
      setCustomerId(existing.customerId);
      setLines(existing.lines.map((l: any) => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice, cost: l.cost })));
      setDiscountType(existing.discountType); setDiscountValue(existing.discountValue);
      setTaxPct(existing.taxPct); setNotes(existing.notes ?? ""); setDate(existing.date); setNumber(existing.number);
      setLocation(existing.location ?? ""); setLpo(existing.lpo ?? ""); setDn(existing.dn ?? "");
    }
  }, [editMode, existing]);

  const customer = customers?.find((c) => c._id === customerId);
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const q = custSearch.trim().toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q));
  }, [customers, custSearch]);

  // كل الأصناف المطابقة للتصنيف + نص البحث (يعمل حتى بدون كتابة — للتصفّح بالضغط)
  const matchedItems = useMemo(() => {
    if (!prices) return [];
    const q = itemSearch.trim().toLowerCase();
    return prices.filter((p: any) =>
      (!catFilter || p.categoryId === catFilter) &&
      (!q || p.name.toLowerCase().includes(q) || (p.nameAr ?? "").includes(q)),
    );
  }, [prices, itemSearch, catFilter]);

  const pickQtyOf = (id: string) => pickQty[id] ?? 1;
  const setPickQtyOf = (id: string, v: number) => setPickQty((s) => ({ ...s, [id]: Math.max(0, Math.round(v * 100) / 100) }));

  const addItem = (p: any, qty?: number) => {
    const q = qty && qty > 0 ? qty : 1;
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.itemId === p.itemId);
      if (idx >= 0) { const copy = [...ls]; copy[idx] = { ...copy[idx], qty: Math.round((copy[idx].qty + q) * 100) / 100 }; return copy; }
      return [...ls, { itemId: p.itemId, name: p.name, unit: p.unit, qty: q, unitPrice: p.sell, cost: p.cost }];
    });
    setItemSearch("");
    setPickQty((s) => ({ ...s, [p.itemId]: 1 })); // أعد الكمية المبدئية
    itemInputRef.current?.focus();
  };

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const repeatLast = async () => {
    if (!customerId) return;
    const last = await convex.query(api.invoices.lastForCustomer, { customerId: customerId as any, token: token ?? "" } as any);
    if (!last) { alert(t("لا توجد فاتورة سابقة لهذا العميل", "No previous invoice")); return; }
    // استخدم الأسعار الحالية مع نفس الأصناف والكميات
    const priceMap = new Map((prices ?? []).map((p: any) => [p.itemId, p]));
    setLines(last.lines.map((l: any) => {
      const cur: any = l.itemId ? priceMap.get(l.itemId) : null;
      return { itemId: l.itemId, name: l.name, unit: l.unit, qty: l.qty, unitPrice: cur ? cur.sell : l.unitPrice, cost: cur ? cur.cost : l.cost };
    }));
  };

  // الإجماليات
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const totalCost = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const discount = discountType === "percent" ? (subtotal * discountValue) / 100 : discountValue;
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = (afterDiscount * taxPct) / 100;
  const total = afterDiscount + taxAmount;
  const profit = afterDiscount - totalCost;
  const belowCost = lines.some((l) => l.unitPrice < l.cost);
  const overLimit = customer?.creditLimit ? customer.balance + total > customer.creditLimit : false;

  const save = async (approve: boolean) => {
    if (!customerId || lines.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        lines: lines.map((l) => ({ itemId: l.itemId as any, name: l.name, unit: l.unit, qty: Number(l.qty), unitPrice: Number(l.unitPrice), cost: Number(l.cost) })),
        discountType, discountValue: Number(discountValue), taxPct: Number(taxPct), notes: notes || undefined,
        location: location || undefined, lpo: lpo || undefined, dn: dn || undefined,
      };
      if (editMode) {
        await updateInvoice({ id: id as any, date, number: number || undefined, ...payload, editedBy: user?.name });
        navigate(`/invoice/${id}`);
      } else {
        const res = await createInvoice({ customerId: customerId as any, date, number: number || undefined, ...payload, status: approve ? "approved" : "draft", createdBy: user?.name });
        navigate(`/invoice/${res.id}`);
      }
    } catch (e: any) {
      const m = String(e?.message ?? e).match(/Uncaught Error:\s*([^\n]+)/);
      alert((m ? m[1] : String(e?.message ?? e)).replace(/\s+at\s.*$/, "").trim() || t("تعذّر الحفظ", "Could not save"));
    } finally { setSaving(false); }
  };

  if (customers === undefined) return <Spinner />;

  return (
    <div className="animate-in">
      <PageHeader title={editMode ? t("تعديل فاتورة", "Edit Invoice") : t("فاتورة جديدة", "New Invoice")}
        subtitle={date !== today() ? t("تاريخ مخصّص", "Custom date") : undefined}
        actions={<>
          <div>
            <label className="label" style={{ marginBottom: 2 }}>{t("رقم الفاتورة", "Invoice #")}</label>
            <input className="field tabular" value={number} onChange={(e) => { setNumber(e.target.value); setNumberTouched(true); }}
              placeholder={t("تلقائي", "auto")} style={{ minWidth: 150, direction: "ltr", textAlign: "start" }} />
            {!editMode && !numberTouched && numberSuggestion && (
              numberSuggestion.mode === "customer" ? (
                <div className="text-accent" style={{ fontSize: 11, marginTop: 2, fontWeight: 700 }}>
                  {t("تسلسل هذا العميل بعد", "continues customer's")}{" "}
                  <span className="tabular" style={{ direction: "ltr", display: "inline-block" }}>{numberSuggestion.from}</span>
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {t("ترقيم النظام:", "system numbering:")}{" "}
                  <b className="tabular" style={{ direction: "ltr", display: "inline-block" }}>{numberSuggestion.suggested}</b>
                  {numberSuggestion.from && <> · {t("آخر فاتورة", "last")} <span className="tabular" style={{ direction: "ltr", display: "inline-block" }}>{numberSuggestion.from}</span></>}
                </div>
              )
            )}
            {!editMode && numberTouched && !number && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{t("فارغ = ترقيم النظام", "empty = system numbering")}</div>}
          </div>
          <div>
            <label className="label" style={{ marginBottom: 2 }}>{t("تاريخ الفاتورة", "Invoice date")}</label>
            <input className="field tabular" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ minWidth: 170 }} />
            {date !== today() && (
              <label title={t("افتراضيًا تُستخدم أسعار اليوم", "Default: today's prices")}
                style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, fontWeight: 700, color: usePricesOfDate ? "var(--accent-dark)" : "var(--muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={usePricesOfDate} onChange={(e) => setUsePricesOfDate(e.target.checked)} style={{ width: 15, height: 15 }} />
                {t("استخدام أسعار هذا التاريخ", "Use that date's prices")}
              </label>
            )}
          </div>
        </>} />

      {/* اختيار العميل */}
      <div className="card" style={{ marginBottom: 14 }}>
        <label className="label">{t("العميل", "Customer")}</label>
        {customer && !custOpen ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="icon-orb icon-orb-primary" style={{ width: 40, height: 40 }}><Icon name="users" size={18} /></div>
              <div>
                <div style={{ fontWeight: 800 }}>{customer.name} {customer.priceList && <span className="pill badge-champion" style={{ marginInlineStart: 6 }}>{lang === "ar" ? customer.priceList.nameAr : customer.priceList.nameEn}</span>}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {t("الرصيد", "Balance")}: <b className={customer.balance > 0.01 ? "text-danger" : ""}>{money(customer.balance)}</b>
                  {customer.creditLimit ? ` · ${t("الحد", "Limit")}: ${money(customer.creditLimit)}` : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-secondary" onClick={repeatLast}><Icon name="copy" size={15} /> {t("تكرار آخر طلب", "Repeat last")}</button>
              {!editMode && <button className="btn-ghost" onClick={() => { setCustOpen(true); setCustomerId(""); }}>{t("تغيير", "Change")}</button>}
            </div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input className="field" autoFocus placeholder={t("ابحث عن عميل بالاسم أو الهاتف…", "Search customer…")}
              value={custSearch} onChange={(e) => { setCustSearch(e.target.value); setCustOpen(true); }} onFocus={() => setCustOpen(true)} />
            {custOpen && (
              <div className="card" style={{ position: "absolute", insetInline: 0, top: "100%", marginTop: 4, zIndex: 10, maxHeight: 320, overflowY: "auto", padding: 6 }}>
                {filteredCustomers.length === 0 && <div className="text-muted" style={{ padding: 10, fontSize: 13 }}>{t("لا نتائج", "No results")}</div>}
                {[...filteredCustomers].sort((a, b) => Number(b.favorite) - Number(a.favorite)).map((c) => (
                  <div key={c._id} onClick={() => { setCustomerId(c._id); setCustOpen(false); setCustSearch(""); }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", borderRadius: 10, cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{c.favorite && <Icon name="star" size={13} className="text-accent" />} {c.name}</span>
                    <span className="text-muted" style={{ fontSize: 12 }}>{c.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {customerId && (
        <>
          {/* إضافة صنف — تصفّح بالضغط أو بحث (عربي/إنجليزي) — ثابت أعلى الشاشة */}
          <div className="card item-search-sticky" style={{ marginBottom: 14, position: "sticky", top: 56, zIndex: 15, boxShadow: "0 6px 20px -10px rgba(60,10,20,.35)" }}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPickerOpen(false); }}>
            <label className="label">{t("إضافة صنف — حدّد الكمية ثم أضف، أو اكتب للبحث", "Add item — set qty then add, or type to search")}</label>
            <input ref={itemInputRef} className="field" placeholder={t("اكتب اسم الصنف (عربي/إنجليزي)…", "Type item name…")} value={itemSearch}
              onChange={(e) => { setItemSearch(e.target.value); setPickerOpen(true); }}
              onFocus={() => setPickerOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter" && matchedItems[0]) addItem(matchedItems[0], pickQtyOf(matchedItems[0].itemId)); if (e.key === "Escape") setPickerOpen(false); }} style={{ paddingInlineStart: 38, fontSize: 16 }} />
            <span style={{ position: "absolute", insetInlineStart: 28, top: 42, color: "var(--muted)" }}><Icon name="search" size={18} /></span>

            {pickerOpen && (
              <div style={{ position: "absolute", insetInline: 0, top: "100%", marginTop: 6, zIndex: 25, background: "var(--card)", borderRadius: 14, border: "1px solid var(--border)", boxShadow: "0 18px 44px -14px rgba(40,10,20,.45)", overflow: "hidden" }}>
                {/* شرائح التصنيفات */}
                <div style={{ display: "flex", gap: 6, padding: 10, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
                  <button className={catFilter === "" ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setCatFilter("")}>{t("الكل", "All")}</button>
                  {cats?.map((c: any) => (
                    <button key={c._id} className={catFilter === c._id ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setCatFilter(c._id)}>
                      {lang === "ar" ? c.nameAr : c.nameEn}
                    </button>
                  ))}
                </div>
                {/* شبكة الأصناف */}
                <div style={{ maxHeight: 320, overflowY: "auto", padding: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 6 }}>
                  {matchedItems.map((p: any) => {
                    const q = pickQtyOf(p.itemId);
                    return (
                      <div key={p.itemId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 800, fontSize: 12.5, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lang === "ar" ? (p.nameAr ?? p.name) : p.name}</span>
                        <span className="text-muted" style={{ fontSize: 9.5, fontFamily: "Inter, sans-serif", direction: "ltr", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lang === "ar" ? p.name : (p.nameAr ?? "")}</span>
                        <span className="tabular" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {p.source === "customer" && <span title={t("سعر خاص", "Custom")} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-dark)" }} />}
                          <b className="text-primary" style={{ fontSize: 13 }}>{money(p.sell, false)}</b>
                          <span className="text-muted" style={{ fontSize: 9 }}>{p.unit}</span>
                        </span>
                        {/* الكمية + إضافة */}
                        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                          <button type="button" title="−1" onClick={() => setPickQtyOf(p.itemId, q - 1)}
                            style={{ width: 24, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>−</button>
                          <input className="tabular" type="number" min="0" step="0.25" value={q}
                            onChange={(e) => setPickQtyOf(p.itemId, Number(e.target.value))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(p, pickQtyOf(p.itemId)); } }}
                            style={{ width: 46, height: 26, textAlign: "center", borderRadius: 7, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, fontWeight: 700, color: "var(--ink)" }} />
                          <button type="button" title="+1" onClick={() => setPickQtyOf(p.itemId, q + 1)}
                            style={{ width: 24, height: 26, borderRadius: 7, border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer", fontWeight: 800, fontSize: 14, lineHeight: 1 }}>+</button>
                          <button type="button" title={t("إضافة للفاتورة", "Add")} onClick={() => addItem(p, pickQtyOf(p.itemId))}
                            style={{ flex: 1, height: 26, borderRadius: 7, border: "1px solid var(--accent)", background: "color-mix(in srgb,var(--accent) 22%,transparent)", color: "var(--primary)", cursor: "pointer", fontWeight: 800, fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                            <Icon name="plus" size={12} /> {t("أضف", "Add")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {matchedItems.length === 0 && <div className="text-muted" style={{ padding: 12, fontSize: 13, gridColumn: "1 / -1", textAlign: "center" }}>{t("لا أصناف مطابقة", "No matching items")}</div>}
                </div>
              </div>
            )}
          </div>

          {/* أسطر الفاتورة */}
          <div className="card" style={{ padding: 0, marginBottom: 14, overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("الصنف", "Item")}</th>
                  <th style={{ width: 128 }}>{t("الكمية", "Qty")}</th>
                  <th style={{ width: 110 }}>{t("السعر", "Price")}</th>
                  <th style={{ width: 100 }}>{t("الإجمالي", "Total")}</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const below = l.unitPrice < l.cost;
                  return (
                    <tr key={i} style={below ? { background: "var(--danger-bg)" } : undefined}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700 }}>{l.name}</span>
                          <select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })}
                            title={t("وحدة البيع لهذا السطر", "Unit for this line")}
                            style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
                            {[...new Set([l.unit, ...UNITS])].map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        {below && <div className="text-danger" style={{ fontSize: 11, color: "var(--danger)" }}><Icon name="alert" size={11} /> {t("أقل من التكلفة", "Below cost")} ({money(l.cost, false)})</div>}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                          {qtyPresets(l.unit).map(([label, q]) => (
                            <button key={label} type="button" onClick={() => setLine(i, { qty: q })}
                              style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, cursor: "pointer",
                                border: "1px solid " + (Math.abs(l.qty - q) < 1e-9 ? "var(--accent)" : "var(--border)"),
                                background: Math.abs(l.qty - q) < 1e-9 ? "color-mix(in srgb,var(--accent) 22%,transparent)" : "var(--surface)", color: "var(--ink)" }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <button type="button" className="btn-ghost" title="−1" onClick={() => setLine(i, { qty: Math.max(0, Math.round((l.qty - 1) * 100) / 100) })} style={{ padding: 0, width: 30, height: 34, minWidth: 30, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>−</button>
                          <input className="field tabular" type="number" step="0.25" min="0" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} style={{ padding: "6px 4px", width: 52, textAlign: "center" }} />
                          <button type="button" className="btn-ghost" title="+1" onClick={() => setLine(i, { qty: Math.round((l.qty + 1) * 100) / 100 })} style={{ padding: 0, width: 30, height: 34, minWidth: 30, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>+</button>
                        </div>
                      </td>
                      <td><input className="field tabular" type="number" step="0.25" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} style={{ padding: "6px 8px", width: 96, color: below ? "var(--danger)" : undefined, fontWeight: 700 }} /></td>
                      <td className="tabular" style={{ fontWeight: 800 }}>{money(l.qty * l.unitPrice, false)}</td>
                      <td><button className="btn-ghost btn-icon" onClick={() => removeLine(i)}><Icon name="trash" size={15} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lines.length === 0 && <Empty text={t("ابحث عن صنف وأضفه للفاتورة", "Search and add items")} icon="cart" />}
          </div>

          {lines.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
              <div className="card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 }}>
                  <div><label className="label">{t("الموقع", "Location")}</label><input className="field" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
                  <div><label className="label">{t("رقم الأوردر LPO", "LPO #")}</label><input className="field" value={lpo} onChange={(e) => setLpo(e.target.value)} /></div>
                  <div><label className="label">{t("أمر التسليم DN", "DN #")}</label><input className="field" value={dn} onChange={(e) => setDn(e.target.value)} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="label">{t("الخصم", "Discount")}</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input className="field tabular" type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                      <select className="field" style={{ width: 70 }} value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
                        <option value="amount">{money(0, true).split(" ")[1] || "$"}</option><option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="label">{t("الضريبة %", "Tax %")}</label><input className="field tabular" type="number" value={taxPct} onChange={(e) => setTaxPct(Number(e.target.value))} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label className="label">{t("ملاحظات", "Notes")}</label><input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ملاحظة داخل الفاتورة…", "Invoice note…")} /></div>
                </div>

                {(belowCost || overLimit) && (
                  <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {belowCost && <div className="pill badge-danger" style={{ padding: "8px 12px" }}><Icon name="alert" size={14} /> {t("تنبيه: توجد أصناف تُباع بأقل من سعر التكلفة", "Warning: items sold below cost")}</div>}
                    {overLimit && <div className="pill badge-warning" style={{ padding: "8px 12px" }}><Icon name="alert" size={14} /> {t("تنبيه: هذه الفاتورة تتجاوز الحد الائتماني للعميل", "Warning: exceeds customer credit limit")}</div>}
                  </div>
                )}

                <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, display: "grid", gap: 6 }}>
                  <Row label={t("الإجمالي الفرعي", "Subtotal")} value={money(subtotal)} />
                  {discount > 0 && <Row label={t("الخصم", "Discount")} value={"- " + money(discount)} />}
                  {taxAmount > 0 && <Row label={t("الضريبة", "Tax")} value={money(taxAmount)} />}
                  <Row label={t("الصافي", "Total")} value={money(total)} big />
                  <Row label={t("الربح المتوقع", "Expected profit")} value={money(profit)} accent />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }} className="no-print">
                {!editMode && (
                  <button className="btn-ghost" style={{ flex: 1, minWidth: 130, padding: 14 }} disabled={saving} onClick={() => save(false)}>
                    <Icon name="check" size={16} /> {t("حفظ كمسودة", "Save draft")}
                  </button>
                )}
                {!editMode && (
                  <button className="btn-primary" style={{ flex: 2, minWidth: 180, padding: 14, fontSize: 15 }} disabled={saving} onClick={() => save(true)}>
                    <Icon name="check" size={18} /> {saving ? t("جارٍ…", "…") : t("حفظ واعتماد الفاتورة", "Save & Approve")}
                  </button>
                )}
                {editMode && (
                  <button className="btn-primary" style={{ flex: 2, minWidth: 180, padding: 14 }} disabled={saving} onClick={() => save(false)}>
                    <Icon name="check" size={18} /> {t("حفظ التعديلات", "Save changes")}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** أوزان/كميات سريعة حسب وحدة الصنف: بالكيلو تظهر أوزان بالجرام/الكيلو، وغيرها أعداد. */
function qtyPresets(unit: string): [string, number][] {
  const u = (unit || "").toLowerCase();
  if (u.startsWith("kg") || u === "كجم" || u === "كيلو") {
    return [["150g", 0.15], ["300g", 0.3], ["500g", 0.5], ["1kg", 1], ["2kg", 2], ["5kg", 5]];
  }
  return [["1", 1], ["2", 2], ["3", 3], ["5", 5], ["10", 10]];
}

function Row({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontWeight: big ? 800 : 600, fontSize: big ? 16 : 14, color: accent ? "var(--accent-dark)" : "var(--muted)" }}>{label}</span>
      <span className="tabular" style={{ fontWeight: big ? 900 : 700, fontSize: big ? 20 : 15, color: accent ? "var(--accent-dark)" : "var(--ink)" }}>{value}</span>
    </div>
  );
}
