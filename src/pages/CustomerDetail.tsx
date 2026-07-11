import { useState } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, formatDate, today, waPhone } from "../lib/format";
import { PageHeader, Icon, Modal, Spinner, Empty, NumField, parseNum, normalizeNum } from "../components/ui";
import { CUSTOMER_TYPES } from "./Customers";
import { useUnits, parseCustomUnits, BASE_UNITS } from "../lib/units";

export default function CustomerDetail() {
  const { id } = useParams();
  const cid = id as any;
  const t = useT(); const { lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const st = useQuery(api.customers.statement, { customerId: cid });
  const customers = useQuery(api.customers.list, { includeInactive: true });
  const settings = useQuery(api.settings.all, {});
  const copyPrices = useMutation(api.customers.copyCustomerPrices);

  const [tab, setTab] = useState<"statement" | "prices">("statement");
  const [payOpen, setPayOpen] = useState(false);
  const [editPay, setEditPay] = useState<any>(null);
  const [copyFrom, setCopyFrom] = useState("");

  if (st === undefined) return <Spinner />;
  if (!st.customer) return <Empty text={t("العميل غير موجود", "Not found")} />;
  const c = st.customer;
  const typeLabel = (ty: string) => { const f = CUSTOMER_TYPES.find((x) => x[0] === ty); return f ? t(f[1], f[2]) : ty; };

  const sendStatementWhatsapp = () => {
    const lines = [
      `*${t("كشف حساب", "Statement")}* — ${c.name}`,
      `${t("إجمالي الفواتير", "Invoiced")}: ${money(st.totalInvoiced)}`,
      `${t("المدفوع", "Paid")}: ${money(st.totalPaid)}`,
      `${t("المتبقي", "Balance")}: ${money(st.balance)}`,
    ].join("\n");
    // بدون رقم محفوظ يفتح واتساب ليختار المستخدم جهة الاتصال
    window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(lines)}`, "_blank");
  };

  return (
    <div className="animate-in">
      <div className="no-print">
        <PageHeader title={c.name} subtitle={`${typeLabel(c.type)} ${c.area ? "· " + c.area : ""}`}
          actions={<>
            <Link to="/customers" className="btn-ghost"><Icon name="back" size={16} /> {t("رجوع", "Back")}</Link>
            {tab === "statement" && <button className="btn-ghost" onClick={() => window.print()}><Icon name="print" size={16} /> {t("طباعة كشف", "Print")}</button>}
            <button className="btn-secondary" onClick={sendStatementWhatsapp}><Icon name="whatsapp" size={16} /> {t("إرسال كشف", "Send")}</button>
            <button className="btn-primary" onClick={() => setPayOpen(true)}><Icon name="money" size={16} /> {t("تسجيل دفعة", "Add Payment")}</button>
          </>} />
      </div>

      {/* ترويسة الطباعة فقط: اسم الشركة + العميل + التاريخ */}
      <div className="print-only cd-print-head" style={{ display: "none", marginBottom: 12, borderBottom: "2px solid var(--primary)", paddingBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0a7c3f" }}>{settings?.companyName || "مدم مي للتجارة"}</div>
            <div style={{ fontSize: 12, color: "#0a7c3f", fontFamily: "Inter, sans-serif" }}>{settings?.companyNameEn || "MADAME TRADING"}</div>
          </div>
          <div style={{ textAlign: "end" }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{t("كشف حساب", "Statement of Account")}</div>
            <div style={{ fontSize: 13 }}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</div>
            <div className="text-muted" style={{ fontSize: 11 }}>{formatDate(today(), lang)}</div>
          </div>
        </div>
      </div>

      {/* بطاقات ملخص */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <SummaryTile label={t("إجمالي الفواتير", "Total Invoiced")} value={money(st.totalInvoiced)} />
        <SummaryTile label={t("المدفوع", "Paid")} value={money(st.totalPaid)} good />
        <SummaryTile label={t("المتبقي", "Balance")} value={money(st.balance)} danger={st.balance > 0.01} />
        <SummaryTile label={t("عدد الفواتير", "Invoices")} value={num(st.invoiceCount, 0)} />
      </div>

      {c.phone && <div style={{ marginBottom: 14 }}><span className="pill badge-muted"><Icon name="phone" size={13} /> {c.phone}</span>
        {c.creditLimit ? <span className="pill badge-info" style={{ marginInlineStart: 6 }}>{t("الحد الائتماني", "Credit")}: {money(c.creditLimit)}</span> : null}
        {c.contactPerson ? <span className="pill badge-muted" style={{ marginInlineStart: 6 }}>{c.contactPerson}</span> : null}
      </div>}

      {user?.role === "admin" && <div className="no-print"><PortalAccess customerId={cid} customer={c} /></div>}

      <div className="no-print" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button className={tab === "statement" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("statement")}>{t("كشف الحساب", "Statement")}</button>
        <button className={tab === "prices" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("prices")}>{t("الأسعار الخاصة", "Special Prices")}</button>
      </div>

      <style>{`@media print { .print-only { display: block !important; } .cd-print-head { display: block !important; } }`}</style>

      {tab === "statement" ? (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>{t("التاريخ", "Date")}</th><th>{t("البيان", "Ref")}</th><th>{t("مدين", "Debit")}</th><th>{t("دائن", "Credit")}</th><th>{t("الرصيد", "Balance")}</th></tr></thead>
            <tbody>
              {st.ledger.map((row: any) => (
                <tr key={row.id} style={{ cursor: row.kind === "return" ? "default" : "pointer" }}
                  onClick={() => row.kind === "invoice" ? navigate(`/invoice/${row.id}`) : row.kind === "payment" ? setEditPay(row) : undefined}>
                  <td>{formatDate(row.date, lang)}</td>
                  <td>{
                    row.kind === "invoice" ? <span className="pill badge-info">{row.ref}</span>
                    : row.kind === "return" ? <span className="pill badge-warning"><Icon name="back" size={11} /> {t("مرتجع", "Return")}{row.ref !== "—" ? ` · ${row.ref}` : ""}</span>
                    : <span className="pill badge-success"><Icon name="edit" size={11} /> {t("دفعة", "Payment")}</span>
                  }</td>
                  <td className="tabular">{row.debit ? money(row.debit, false) : "—"}</td>
                  <td className="tabular">{row.credit ? money(row.credit, false) : "—"}</td>
                  <td className="tabular" style={{ fontWeight: 700 }}>{money(row.balance, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {st.ledger.length === 0 && <Empty text={t("لا حركات", "No transactions")} icon="invoice" />}
        </div>
      ) : (
        <SpecialPrices customerId={cid} customers={customers ?? []} copyFrom={copyFrom} setCopyFrom={setCopyFrom} onCopy={async () => { if (copyFrom) { await copyPrices({ fromId: copyFrom as any, toId: cid }); setCopyFrom(""); } }} />
      )}

      {payOpen && <PaymentModal customerId={cid} defaultAmount={st.balance > 0 ? st.balance : 0} onClose={() => setPayOpen(false)} />}
      {editPay && <PaymentModal customerId={cid} payment={editPay} onClose={() => setEditPay(null)} />}
    </div>
  );
}

/** حروف وأرقام بلا المتشابهات (0/O، 1/I/l) حتى يقرأها العميل من رسالة واتساب بلا لبس. */
const PW_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makePassword = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => PW_CHARS[n % PW_CHARS.length]).join("");

/** بوابة طلبات العميل: تعيين كلمة السر، إرسالها له، أو إلغاء دخوله. */
function PortalAccess({ customerId, customer }: { customerId: any; customer: any }) {
  const t = useT();
  const current = useQuery(api.customers.portalPassword, { id: customerId });
  const setPassword = useMutation(api.customers.setPortalPassword);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const portalUrl = `${window.location.origin}/login`;
  const enabled = !!current?.enabled;
  // النص الصريح المتاح للإرسال: ما كتبه/ولّده المدير الآن، أو القديم غير المشفّر إن وُجد
  const sharePw = draft || current?.plain || "";

  const save = async (pw: string | undefined) => {
    setBusy(true); setErr("");
    try {
      await setPassword({ id: customerId, password: pw });
      if (!pw) setDraft(""); // عند الإلغاء فقط؛ بعد التعيين نُبقي النص الصريح ليُرسَل للعميل
    } catch (e: any) {
      setErr(String(e?.message ?? e).replace(/^.*Error:\s*/s, "").split("\n")[0]);
    } finally { setBusy(false); }
  };

  const message = () =>
    [`*${customer.name}*`,
     t("تقدر تطلب من موقعنا مباشرة:", "You can order directly from our site:"),
     portalUrl, "",
     `${t("كلمة السر", "Password")}: ${sharePw}`].join("\n");

  const copy = async () => {
    await navigator.clipboard.writeText(message());
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const sendWhatsapp = () => {
    // بدون رقم محفوظ يفتح واتساب ليختار المستخدم جهة الاتصال
    window.open(`https://wa.me/${waPhone(customer.phone)}?text=${encodeURIComponent(message())}`, "_blank");
  };

  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="icon-orb icon-orb-primary" style={{ width: 34, height: 34 }}><Icon name="cart" size={16} /></div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{t("بوابة الطلبات", "Order portal")}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {enabled
              ? t("العميل يقدر يدخل ويطلب بنفسه", "The customer can sign in and order")
              : t("الدخول غير مفعّل — عيّن كلمة سر ليطلب بنفسه", "Disabled — set a password to let them order")}
          </div>
        </div>
        <span className={"pill " + (enabled ? "badge-success" : "badge-muted")}>
          {enabled ? t("مفعّلة", "Enabled") : t("غير مفعّلة", "Disabled")}
        </span>
        <button className="btn-ghost" onClick={() => { setOpen((o) => !o); setErr(""); }}>
          <Icon name={open ? "x" : "settings"} size={15} /> {open ? t("إغلاق", "Close") : t("إدارة", "Manage")}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)", display: "grid", gap: 10 }}>
          <div>
            <label className="label">{t("رابط الدخول", "Sign-in link")}</label>
            <div className="field" style={{ direction: "ltr", textAlign: "start", background: "var(--surface)", fontSize: 13 }}>{portalUrl}</div>
          </div>

          <div>
            <label className="label">{enabled ? t("تعيين كلمة سر جديدة", "Set a new password") : t("كلمة السر", "Password")}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input className="field tabular" value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder={enabled ? t("اكتب/ولّد كلمة جديدة", "type/generate a new one") : t("4 أحرف على الأقل", "at least 4 characters")}
                style={{ direction: "ltr", textAlign: "start", flex: "1 1 180px", fontWeight: 700, letterSpacing: 1 }} />
              <button className="btn-ghost" onClick={() => setDraft(makePassword())}>{t("توليد", "Generate")}</button>
              <button className="btn-primary" disabled={busy || draft.length < 4} onClick={() => save(draft)}>
                <Icon name="check" size={15} /> {enabled ? t("تغيير", "Change") : t("تفعيل", "Enable")}
              </button>
            </div>
            {enabled && !sharePw && (
              <div className="text-muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                {t("كلمة السر مشفّرة ولا يمكن عرضها. لإرسالها للعميل ولّد كلمة جديدة.",
                   "The password is encrypted and can't be shown. Generate a new one to send it.")}
              </div>
            )}
          </div>

          {err && <div className="pill badge-danger" style={{ padding: "8px 12px" }}><Icon name="alert" size={14} /> {err}</div>}

          {enabled && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn-secondary" disabled={!sharePw} onClick={sendWhatsapp}>
                <Icon name="whatsapp" size={15} /> {t("إرسال للعميل", "Send to customer")}
              </button>
              <button className="btn-ghost" disabled={!sharePw} onClick={copy}>
                <Icon name={copied ? "check" : "copy"} size={15} /> {copied ? t("تم النسخ", "Copied") : t("نسخ", "Copy")}
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn-danger" disabled={busy}
                onClick={() => window.confirm(t("إلغاء دخول العميل للبوابة؟", "Disable portal access?")) && save(undefined)}>
                <Icon name="x" size={15} /> {t("إلغاء الدخول", "Disable")}
              </button>
            </div>
          )}

          <div className="text-muted" style={{ fontSize: 11.5 }}>
            {t("تغيير كلمة السر أو إلغاؤها يُخرج العميل فورًا من أي جهاز داخل منه.",
               "Changing or disabling the password signs the customer out everywhere.")}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, good, danger }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="text-muted" style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div className={"tabular"} style={{ fontSize: 20, fontWeight: 900, color: danger ? "var(--danger)" : good ? "var(--success)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}

function PaymentModal({ customerId, payment, defaultAmount, onClose }: any) {
  const t = useT();
  const { user } = useAuth();
  const isEdit = !!payment;
  const create = useMutation(api.payments.create);
  const update = useMutation(api.payments.update);
  const remove = useMutation(api.payments.remove);
  const outstanding = useQuery(api.invoices.outstanding, { customerId });
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const [amount, setAmount] = useState<number>(isEdit ? payment.credit : (defaultAmount || 0));
  const [method, setMethod] = useState<string>(isEdit ? payment.method : "cash");
  const [date, setDate] = useState<string>(isEdit ? payment.date : today());
  const [note, setNote] = useState<string>(isEdit ? (payment.note || "") : "");
  const [allocs, setAllocs] = useState<Record<string, number>>(
    isEdit && payment.allocations ? Object.fromEntries(payment.allocations.map((a: any) => [a.invoiceId, a.amount])) : {},
  );
  const [saving, setSaving] = useState(false);

  const toggle = (inv: any) => setAllocs((prev) => { const n = { ...prev }; if (inv._id in n) delete n[inv._id]; else n[inv._id] = inv.remaining; return n; });
  const setAlloc = (id: string, v: number) => setAllocs((prev) => ({ ...prev, [id]: v }));
  const allocated = r2(Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0));

  const autoAllocate = () => {
    let left = amount; const n: Record<string, number> = {};
    for (const inv of (outstanding || [])) { if (left <= 0.001) break; const take = Math.min(left, inv.remaining); n[inv._id] = r2(take); left = r2(left - take); }
    setAllocs(n);
  };

  const save = async () => {
    setSaving(true);
    const allocations = Object.entries(allocs).filter(([, v]) => Number(v) > 0).map(([invoiceId, amt]) => ({ invoiceId: invoiceId as any, amount: Number(amt) }));
    try {
      if (isEdit) await update({ id: payment.id, amount: Number(amount), method: method as any, date, note: note || undefined, allocations, editedBy: user?.name });
      else await create({ customerId, amount: Number(amount), method: method as any, date, note: note || undefined, allocations, createdBy: user?.name });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open title={isEdit ? t("تعديل دفعة", "Edit Payment") : t("تسجيل دفعة", "Add Payment")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
          <div><label className="label">{t("المبلغ", "Amount")}</label><NumField autoFocus value={amount} onChange={setAmount} style={{ fontSize: 18, fontWeight: 800 }} /></div>
          <div><label className="label">{t("طريقة الدفع", "Method")}</label>
            <select className="field" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">{t("نقدي", "Cash")}</option><option value="transfer">{t("تحويل", "Transfer")}</option><option value="card">{t("بطاقة", "Card")}</option>
            </select></div>
          <div><label className="label">{t("التاريخ", "Date")}</label><input className="field tabular" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div><label className="label">{t("ملاحظة", "Note")}</label><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></div>

        {outstanding && outstanding.length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{t("توزيع على الفواتير (اختياري)", "Allocate to invoices (optional)")}</span>
              <button className="btn-ghost" style={{ padding: "4px 10px" }} onClick={autoAllocate}><Icon name="check" size={13} /> {t("توزيع تلقائي", "Auto")}</button>
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: 6 }}>
              {outstanding.map((inv: any) => { const on = inv._id in allocs; return (
                <div key={inv._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: on ? "color-mix(in srgb,var(--accent) 14%,transparent)" : "var(--surface)" }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(inv)} />
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 92 }} className="tabular">{inv.number}</span>
                  <span className="text-muted" style={{ fontSize: 12, flex: 1 }}>{t("المتبقي", "Rem")}: {money(inv.remaining, false)}</span>
                  <NumField disabled={!on} value={on ? allocs[inv._id] : ""} placeholder="—" onChange={(n) => setAlloc(inv._id, n)} style={{ width: 96, padding: "5px 8px" }} />
                </div> ); })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5, fontWeight: 700 }}>
              <span className="text-muted">{t("الموزّع", "Allocated")}: <b className="tabular">{money(allocated, false)}</b></span>
              <span style={{ color: allocated > amount + 0.01 ? "var(--danger)" : "var(--muted)" }}>{t("غير موزّع", "Unallocated")}: <b className="tabular">{money(r2(amount - allocated), false)}</b></span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" style={{ flex: 1 }} disabled={saving || amount <= 0} onClick={save}><Icon name="check" size={16} /> {isEdit ? t("حفظ التعديلات", "Save Changes") : t("حفظ الدفعة", "Save Payment")}</button>
          {isEdit && <button className="btn-danger" onClick={() => confirm(t("حذف الدفعة؟", "Delete payment?")) && remove({ id: payment.id, by: user?.name }).then(onClose)}><Icon name="trash" size={16} /> {t("حذف", "Delete")}</button>}
        </div>
      </div>
    </Modal>
  );
}

function SpecialPrices({ customerId, customers, copyFrom, setCopyFrom, onCopy }: any) {
  const t = useT(); const { lang } = useLang();
  const prices = useQuery(api.customers.priceListFor, { customerId, date: today() });
  const setPrice = useMutation(api.customers.setCustomerPrice);
  const setSetting = useMutation(api.settings.set);
  const settings = useQuery(api.settings.all, {});
  const UNITS = useUnits();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  /** إضافة وحدة جديدة من داخل القائمة (للمدير) ثم اختيارها لهذا الصنف. */
  const addUnitAndApply = async (itemId: any, currentPrice: number | undefined) => {
    const u = prompt(t("اسم الوحدة الجديدة (مثلاً Pkt100)", "New unit name (e.g. Pkt100)"))?.trim();
    if (!u) return;
    const cur = parseCustomUnits(settings?.customUnits);
    if (!BASE_UNITS.includes(u) && !cur.includes(u)) {
      await setSetting({ key: "customUnits", value: [...cur, u].join(",") });
    }
    await setPrice({ customerId, itemId, price: currentPrice, unit: u });
  };

  if (prices === undefined) return <Spinner />;
  const q = search.trim().toLowerCase();
  const rows = prices.filter((p: any) => !q || p.name.toLowerCase().includes(q) || (p.nameAr ?? "").includes(q));
  const sourceLabel: Record<string, string> = { customer: t("خاص", "Custom"), priceList: t("قائمة", "List"), listMargin: t("هامش", "Margin"), default: t("افتراضي", "Default") };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <input className="field" placeholder={t("بحث…", "Search…")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingInlineStart: 38 }} />
          <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
        </div>
        <select className="field" style={{ maxWidth: 220 }} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">{t("نسخ أسعار من عميل…", "Copy prices from…")}</option>
          {customers.filter((c: any) => c._id !== customerId).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button className="btn-secondary" disabled={!copyFrom} onClick={onCopy}><Icon name="copy" size={16} /> {t("نسخ", "Copy")}</button>
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>{t("الصنف", "Item")}</th><th style={{ width: 130 }}>{t("وحدة خاصة", "Custom unit")}</th><th>{t("السعر الفعّال", "Effective")}</th><th>{t("المصدر", "Source")}</th><th style={{ width: 140 }}>{t("سعر خاص", "Custom price")}</th></tr></thead>
          <tbody>
            {rows.map((p: any) => {
              const baseUnit = p.baseUnit ?? p.unit;
              const unitOverride = p.unit !== baseUnit ? p.unit : undefined;   // وحدة خاصة إن اختلفت عن وحدة الصنف
              const customPrice = p.source === "customer" ? p.sell : undefined;
              return (
                <tr key={p.itemId}>
                  <td style={{ fontWeight: 700 }}>{lang === "ar" ? (p.nameAr ?? p.name) : p.name}</td>
                  <td>
                    <select className="field" value={p.unit}
                      onChange={(e) => {
                        const u = e.target.value;
                        if (u === "__add") { addUnitAndApply(p.itemId, customPrice); return; }
                        setPrice({ customerId, itemId: p.itemId, price: customPrice, unit: u === baseUnit ? undefined : u });
                      }}
                      style={{ padding: "5px 8px", fontWeight: unitOverride ? 800 : 400, color: unitOverride ? "var(--accent-dark)" : undefined }}>
                      {[...new Set([baseUnit, ...UNITS])].map((u) => <option key={u} value={u}>{u}{u === baseUnit ? ` (${t("أساسي", "base")})` : ""}</option>)}
                      {user?.role === "admin" && <option value="__add">＋ {t("وحدة جديدة…", "New unit…")}</option>}
                    </select>
                  </td>
                  <td className="tabular" style={{ fontWeight: 700 }}>{money(p.sell, false)}</td>
                  <td><span className={"pill " + (p.source === "customer" ? "badge-champion" : "badge-muted")}>{sourceLabel[p.source]}</span></td>
                  <td>
                    <input className="field tabular" inputMode="decimal" dir="ltr" placeholder="—" defaultValue={customPrice ?? ""}
                      onBlur={(e) => { const v = normalizeNum(e.target.value); setPrice({ customerId, itemId: p.itemId, price: v === "" ? undefined : parseNum(v), unit: unitOverride }); }}
                      style={{ padding: "6px 8px" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
        {t("السعر: اكتبه واضغط خارج الحقل للحفظ (فارغ = السعر الافتراضي). الوحدة: اخترها لتصبح خاصة بهذا العميل (مثلاً الموز بالكرتونة).", "Price: type and blur to save (empty = default). Unit: pick a custom unit for this customer (e.g. bananas by carton).")}
      </div>
    </div>
  );
}
