import { useState, useMemo } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { money } from "../lib/format";
import { PageHeader, Icon, Modal, Spinner, Empty, NumField } from "../components/ui";

export const CUSTOMER_TYPES: [string, string, string][] = [
  ["restaurant", "مطعم", "Restaurant"],
  ["cafe", "كافيه", "Cafe"],
  ["hotel", "فندق", "Hotel"],
  ["supermarket", "سوبر ماركت", "Supermarket"],
  ["catering", "شركة تموين", "Catering"],
  ["cash", "نقدي", "Cash"],
];
export const PAY_METHODS: [string, string, string][] = [
  ["cash", "نقدي", "Cash"],
  ["credit", "آجل", "Credit"],
  ["transfer", "تحويل بنكي", "Transfer"],
];

export default function Customers() {
  const t = useT(); const { lang } = useLang();
  const navigate = useNavigate();
  const customers = useQuery(api.customers.list, {});
  const lists = useQuery(api.priceLists.list, {});
  const create = useMutation(api.customers.create);
  const update = useMutation(api.customers.update);
  const toggleFav = useMutation(api.customers.toggleFavorite);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState<any>(null);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    return customers.filter((c) =>
      (!typeFilter || c.type === typeFilter) &&
      (!q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)),
    );
  }, [customers, search, typeFilter]);

  if (customers === undefined) return <Spinner />;
  const typeLabel = (ty: string) => { const f = CUSTOMER_TYPES.find((x) => x[0] === ty); return f ? t(f[1], f[2]) : ty; };

  return (
    <div className="animate-in">
      <PageHeader title={t("العملاء", "Customers")} subtitle={t(`${customers.length} عميل`, `${customers.length} customers`)}
        actions={<button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} /> {t("عميل جديد", "New Customer")}</button>} />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input className="field" placeholder={t("بحث بالاسم أو الهاتف…", "Search name or phone…")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingInlineStart: 38 }} />
          <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
        </div>
        <select className="field" style={{ maxWidth: 180 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">{t("كل الأنواع", "All types")}</option>
          {CUSTOMER_TYPES.map((c) => <option key={c[0]} value={c[0]}>{t(c[1], c[2])}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {filtered.map((c) => (
          <div key={c._id} className="card card-hover" style={{ cursor: "pointer" }} onClick={() => navigate(`/customers/${c._id}`)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                <div className="icon-orb icon-orb-primary" style={{ width: 42, height: 42 }}><Icon name="users" size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{typeLabel(c.type)} {c.area ? "· " + c.area : ""}</div>
                </div>
              </div>
              <button className="btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); toggleFav({ id: c._id }); }}
                style={{ color: c.favorite ? "var(--accent-dark)" : "var(--muted)" }}>
                <Icon name="star" size={16} />
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11 }}>{t("الرصيد المستحق", "Balance")}</div>
                <div className={"tabular pill " + (c.balance > 0.01 ? "badge-danger" : "badge-success")}>{money(c.balance)}</div>
              </div>
              {c.priceList && <span className="pill badge-champion">{lang === "ar" ? c.priceList.nameAr : c.priceList.nameEn}</span>}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <Empty text={t("لا عملاء", "No customers")} icon="users" />}

      {editing && <CustomerModal customer={editing} lists={lists ?? []} onClose={() => setEditing(null)}
        onSave={async (data: any) => {
          if (editing._id) await update({ id: editing._id, ...data });
          else await create(data);
          setEditing(null);
        }} />}
    </div>
  );
}

export function CustomerModal({ customer, lists, onClose, onSave }: any) {
  const t = useT(); const { lang } = useLang();
  const [f, setF] = useState({
    name: customer.name ?? "", nameEn: customer.nameEn ?? "", type: customer.type ?? "restaurant", phone: customer.phone ?? "",
    address: customer.address ?? "", area: customer.area ?? "", contactPerson: customer.contactPerson ?? "",
    paymentMethod: customer.paymentMethod ?? "credit", creditLimit: customer.creditLimit ?? 0,
    priceListId: customer.priceListId ?? "", discountPct: customer.discountPct ?? 0, notes: customer.notes ?? "",
    loginPin: customer.loginPin ?? "",
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <Modal open wide title={customer._id ? t("تعديل عميل", "Edit Customer") : t("عميل جديد", "New Customer")} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div><label className="label">{t("اسم العميل (عربي)", "Name (AR)")}</label><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">{t("الاسم بالإنجليزي (للفاتورة)", "Name (EN — for invoice)")}</label><input className="field" value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} style={{ direction: "ltr" }} /></div>
        <div><label className="label">{t("النوع", "Type")}</label>
          <select className="field" value={f.type} onChange={(e) => set("type", e.target.value)}>{CUSTOMER_TYPES.map((c) => <option key={c[0]} value={c[0]}>{t(c[1], c[2])}</option>)}</select></div>
        <div><label className="label">{t("الهاتف", "Phone")}</label><input className="field tabular" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><label className="label">{t("المنطقة", "Area")}</label><input className="field" value={f.area} onChange={(e) => set("area", e.target.value)} /></div>
        <div><label className="label">{t("الشخص المسؤول", "Contact person")}</label><input className="field" value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t("العنوان", "Address")}</label><input className="field" value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div><label className="label">{t("طريقة الدفع", "Payment")}</label>
          <select className="field" value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>{PAY_METHODS.map((c) => <option key={c[0]} value={c[0]}>{t(c[1], c[2])}</option>)}</select></div>
        <div><label className="label">{t("الحد الائتماني", "Credit limit")}</label><NumField value={f.creditLimit} onChange={(n) => set("creditLimit", n)} /></div>
        <div><label className="label">{t("قائمة الأسعار", "Price list")}</label>
          <select className="field" value={f.priceListId} onChange={(e) => set("priceListId", e.target.value)}>
            <option value="">{t("الافتراضي", "Default")}</option>{lists.map((l: any) => <option key={l._id} value={l._id}>{lang === "ar" ? l.nameAr : l.nameEn}</option>)}
          </select></div>
        <div><label className="label">{t("خصم خاص %", "Discount %")}</label><NumField value={f.discountPct} onChange={(n) => set("discountPct", n)} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t("🔑 كلمة سر دخول العميل لبوابة الطلبات (اختياري)", "🔑 Customer order-portal password (optional)")}</label>
          <input className="field" value={f.loginPin} onChange={(e) => set("loginPin", e.target.value)} placeholder={t("اتركها فارغة لتعطيل الدخول", "leave empty to disable login")} style={{ direction: "ltr", textAlign: "start" }} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label className="label">{t("ملاحظات", "Notes")}</label><input className="field" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <button className="btn-primary" disabled={!f.name} style={{ marginTop: 14, width: "100%" }}
        onClick={() => onSave({ ...f, priceListId: f.priceListId || undefined, creditLimit: f.creditLimit || undefined, discountPct: f.discountPct || undefined, loginPin: f.loginPin || undefined })}>
        <Icon name="check" size={16} /> {t("حفظ", "Save")}
      </button>
    </Modal>
  );
}
