import { useState, useMemo } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, formatDate } from "../lib/format";
import { Icon, Spinner, Empty, NumField } from "../components/ui";

const STATUS: Record<string, [string, string, string]> = {
  pending: ["قيد المراجعة", "Pending review", "badge-warning"],
  confirmed: ["تم الاعتماد", "Confirmed", "badge-success"],
  rejected: ["مرفوض", "Rejected", "badge-danger"],
};

export default function CustomerPortal() {
  const t = useT(); const { lang, toggle } = useLang();
  const { user, logout } = useAuth();
  const settings = useQuery(api.settings.all, {});
  const [tab, setTab] = useState<"order" | "orders">("order");
  const brandAr = settings?.companyName || "سوق الجملة";
  const brandEn = settings?.companyNameEn || "Wholesale";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 14px 90px" }}>
      {/* الترويسة */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "color-mix(in srgb, var(--bg) 85%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.svg" width={34} height={34} alt="logo" />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>{lang === "ar" ? brandAr : brandEn}</div>
            <div className="text-muted" style={{ fontSize: 11 }}>{t("مرحبًا", "Welcome")}، {user?.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={toggle} style={{ padding: "6px 12px", fontWeight: 800 }}>{lang === "ar" ? "EN" : "ع"}</button>
          <button className="btn-ghost btn-icon" onClick={logout} title={t("خروج", "Logout")}><Icon name="logout" /></button>
        </div>
      </header>

      <div className="hero-premium" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{t("اطلب أصنافك بسهولة", "Order your items easily")}</div>
        <div style={{ fontSize: 12, color: "var(--accent-light)" }}>{t("اختر الأصناف والكميات وأرسل الطلب، وسنراجعه ونؤكّده لك.", "Pick items & quantities, we review and confirm.")}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button className={tab === "order" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("order")}><Icon name="cart" size={16} /> {t("طلب جديد", "New Order")}</button>
        <button className={tab === "orders" ? "btn-primary" : "btn-ghost"} onClick={() => setTab("orders")}><Icon name="invoice" size={16} /> {t("طلباتي", "My Orders")}</button>
      </div>

      {tab === "order" ? <NewOrder /> : <MyOrders />}
    </div>
  );
}

function NewOrder() {
  const t = useT(); const { lang } = useLang();
  const items = useQuery(api.orders.myItems, {});
  const cats = useQuery(api.categories.list, {});
  const place = useMutation(api.orders.place);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return items.filter((p: any) =>
      (!catFilter || p.categoryId === catFilter) &&
      (!q || p.name.toLowerCase().includes(q) || (p.nameAr ?? "").includes(q)),
    );
  }, [items, search, catFilter]);

  const set = (id: string, v: number) => setQty((s) => ({ ...s, [id]: Math.max(0, Math.round(v * 100) / 100) }));
  const cart = (items ?? []).filter((p: any) => (qty[p.itemId] ?? 0) > 0);
  const total = cart.reduce((s: number, p: any) => s + qty[p.itemId] * p.sell, 0);

  const submit = async () => {
    setSending(true);
    try {
      const lines = cart.map((p: any) => ({ itemId: p.itemId as any, qty: Number(qty[p.itemId]) }));
      const res = await place({ lines, note: note || undefined });
      setDone(res.number); setQty({}); setNote("");
    } finally { setSending(false); }
  };

  if (items === undefined) return <Spinner />;
  if (done) return (
    <div className="card" style={{ textAlign: "center", padding: 32 }}>
      <div className="icon-orb icon-orb-accent" style={{ margin: "0 auto 12px" }}><Icon name="check" size={24} /></div>
      <div className="section-title">{t("تم إرسال طلبك", "Order sent")} ✅</div>
      <p className="text-muted">{t("رقم الطلب", "Order #")}: <b className="tabular">{done}</b>. {t("سنراجعه ونؤكّده لك قريبًا.", "We'll review and confirm soon.")}</p>
      <button className="btn-primary" onClick={() => setDone(null)}><Icon name="plus" size={16} /> {t("طلب جديد", "New order")}</button>
    </div>
  );

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input className="field" placeholder={t("ابحث عن صنف…", "Search item…")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingInlineStart: 38 }} />
        <span style={{ position: "absolute", insetInlineStart: 12, top: 11, color: "var(--muted)" }}><Icon name="search" size={16} /></span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button className={catFilter === "" ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setCatFilter("")}>{t("الكل", "All")}</button>
        {cats?.map((c: any) => <button key={c._id} className={catFilter === c._id ? "btn-primary" : "btn-ghost"} style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => setCatFilter(c._id)}>{lang === "ar" ? c.nameAr : c.nameEn}</button>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        {filtered.map((p: any) => {
          const q = qty[p.itemId] ?? 0;
          return (
            <div key={p.itemId} className="card" style={{ padding: 12, border: q > 0 ? "1.5px solid var(--accent)" : undefined }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{lang === "ar" ? (p.nameAr ?? p.name) : p.name}</div>
              <div className="text-muted" style={{ fontSize: 11, fontFamily: "Inter, sans-serif", direction: "ltr" }}>{lang === "ar" ? p.name : (p.nameAr ?? "")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 8px" }}>
                <span className="pill badge-muted" style={{ fontSize: 10 }}>{p.unit}</span>
                <b className="text-primary tabular">{money(p.sell, false)}</b>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button type="button" className="btn-ghost" onClick={() => set(p.itemId, q - (q <= 1 ? 0.1 : 1))} style={{ padding: 0, width: 34, height: 34, minWidth: 34, fontSize: 20, fontWeight: 800 }}>−</button>
                <NumField value={q} onChange={(n) => set(p.itemId, n)} style={{ padding: "6px 4px", textAlign: "center" }} />
                <button type="button" className="btn-ghost" onClick={() => set(p.itemId, q + (q < 1 ? 0.1 : 1))} style={{ padding: 0, width: 34, height: 34, minWidth: 34, fontSize: 18, fontWeight: 800 }}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <Empty text={t("لا أصناف", "No items")} />}

      {/* سلة الطلب — ثابتة أسفل */}
      {cart.length > 0 && (
        <div className="no-print" style={{ position: "fixed", bottom: 0, insetInline: 0, background: "color-mix(in srgb, var(--card) 96%, transparent)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--border)", boxShadow: "0 -8px 24px -10px rgba(60,10,20,.25)", zIndex: 30, padding: "12px 16px" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <input className="field" placeholder={t("ملاحظة على الطلب (اختياري)", "Order note (optional)")} value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <span className="text-muted" style={{ fontSize: 12 }}>{cart.length} {t("صنف", "items")} · </span>
                <b className="tabular" style={{ fontSize: 18 }}>{money(total)}</b>
              </div>
              <button className="btn-primary" style={{ padding: "12px 24px", fontSize: 15 }} disabled={sending} onClick={submit}>
                <Icon name="check" size={18} /> {sending ? t("جارٍ الإرسال…", "Sending…") : t("إرسال الطلب", "Send Order")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MyOrders() {
  const t = useT(); const { lang } = useLang();
  const orders = useQuery(api.orders.myOrders, {});
  const [open, setOpen] = useState<any>(null);
  if (orders === undefined) return <Spinner />;
  if (orders.length === 0) return <Empty text={t("لا طلبات بعد", "No orders yet")} icon="invoice" />;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {orders.map((o: any) => {
        const reqTotal = o.lines.reduce((s: number, l: any) => s + l.qtyRequested * l.unitPrice, 0);
        return (
          <div key={o._id} className="card card-hover" style={{ cursor: "pointer" }} onClick={() => setOpen(open?._id === o._id ? null : o)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontWeight: 800 }} className="tabular">{o.number}</span>
                <span className="text-muted" style={{ fontSize: 12, marginInlineStart: 8 }}>{formatDate(o.date, lang)} · {o.lines.length} {t("صنف", "items")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="tabular" style={{ fontWeight: 700 }}>{money(reqTotal, false)}</span>
                <span className={"pill " + STATUS[o.status][2]}>{t(STATUS[o.status][0], STATUS[o.status][1])}</span>
              </div>
            </div>
            {open?._id === o._id && (
              <div style={{ marginTop: 12, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
                {o.lines.map((l: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", opacity: o.status !== "pending" && !l.available ? 0.5 : 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {o.status !== "pending" && (l.available ? <Icon name="check" size={13} className="text-accent" /> : <Icon name="x" size={13} />)} {l.name}
                      {o.status !== "pending" && !l.available && <span className="pill badge-danger" style={{ marginInlineStart: 6, fontSize: 10 }}>{t("غير متاح", "N/A")}</span>}
                    </span>
                    <span className="tabular text-muted" style={{ fontSize: 12 }}>
                      {t("طلب", "Req")} {num(l.qtyRequested)} {l.unit}
                      {o.status === "confirmed" && l.available && ` · ${t("تم", "OK")} ${num(l.qtyApproved)}`}
                    </span>
                  </div>
                ))}
                {o.note && <div style={{ fontSize: 12, marginTop: 6 }}><b>{t("ملاحظتك", "Your note")}:</b> {o.note}</div>}
                {o.ownerNote && <div className="pill badge-info" style={{ marginTop: 6, padding: "6px 10px" }}><Icon name="alert" size={13} /> {o.ownerNote}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
