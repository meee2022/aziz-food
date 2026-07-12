import { useRef, useState } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, num, formatDate, formatDateTime, amountInWordsEn, waPhone } from "../lib/format";
import { invoiceToWord, invoiceToExcel, elementToPdfBlob, sharePdf } from "../lib/docExport";
import { Icon, Spinner, Empty } from "../components/ui";

export default function InvoiceView() {
  const { id } = useParams();
  const t = useT(); const { lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const inv = useQuery(api.invoices.get, { id: id as any });
  const settings = useQuery(api.settings.all, {});
  const approve = useMutation(api.invoices.approve);
  const cancel = useMutation(api.invoices.cancel);
  const removeInvoice = useMutation(api.invoices.remove);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  if (inv === undefined || settings === undefined) return <Spinner />;
  if (!inv) return <Empty text={t("الفاتورة غير موجودة", "Not found")} />;

  const s = settings;
  const nameEn = s.companyNameEn || "MADAME TRADING";
  const nameAr = s.companyName || "مدم مي للتجارة";
  const c = inv.customer;

  // توليد الفاتورة PDF حقيقيًا ومشاركتها (واتساب على الموبايل) أو تنزيلها (كمبيوتر)
  const sharePdfInvoice = async () => {
    if (!sheetRef.current) return;
    setSharing(true);
    try {
      const blob = await elementToPdfBlob(sheetRef.current);
      const file = `${nameEn.replace(/\s+/g, "-")}-${inv.number}.pdf`;
      const caption = `${nameAr}\n${t("فاتورة", "Invoice")} ${inv.number} — ${inv.customerName}\n${t("الإجمالي", "Total")}: ${money(inv.total)}`;
      const res = await sharePdf(blob, file, { title: `${t("فاتورة", "Invoice")} ${inv.number}`, text: caption });
      if (res === "downloaded") alert(t("جهازك لا يدعم المشاركة المباشرة — نُزّل ملف الـ PDF، أرفقه في واتساب يدويًا.", "Your device can't share directly — the PDF was downloaded; attach it in WhatsApp manually."));
    } catch (e) {
      alert(t("تعذّر توليد ملف الـ PDF", "Could not generate the PDF"));
    } finally { setSharing(false); }
  };

  // حفظ الفاتورة كـ PDF عبر طباعة المتصفح، مع تسمية الملف برقم الفاتورة
  const savePdf = () => {
    const prev = document.title;
    document.title = `${nameEn.replace(/\s+/g, "-")}-${inv.number}`;
    window.print();
    setTimeout(() => (document.title = prev), 500);
  };

  const whatsapp = () => {
    const lines = inv.lines.map((l: any, i: number) => `${i + 1}. ${l.name} ×${num(l.qty)} ${l.unit} = ${money(l.qty * l.unitPrice)}`).join("\n");
    const msg = [
      `*${nameAr}*`, `${t("فاتورة", "Invoice")} ${inv.number}`, `${t("العميل", "Customer")}: ${inv.customerName}`,
      inv.branch ? `${t("الفرع", "Branch")}: ${inv.branch}` : "",
      inv.location ? `${t("الموقع", "Location")}: ${inv.location}` : "",
      "", lines, "", `${t("الإجمالي", "Total")}: *${money(inv.total)}*`,
    ].filter(Boolean).join("\n");
    // برقم محفوظ: محادثة مباشرة مع العميل. بدون رقم: يفتح واتساب ليختار المستخدم جهة الاتصال.
    const phone = waPhone(c?.phone, s.countryCode);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="animate-in">
      {/* أزرار التحكم — لا تُطبع */}
      <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Link to="/invoices" className="btn-ghost"><Icon name="back" size={16} /> {t("رجوع", "Back")}</Link>
        <div style={{ flex: 1 }} />
        {inv.status !== "cancelled" && <Link to={`/invoice/${inv._id}/edit`} className="btn-ghost"><Icon name="edit" size={16} /> {t("تعديل", "Edit")}</Link>}
        {inv.status === "draft" && <button className="btn-primary" onClick={() => approve({ id: inv._id, approvedBy: user?.name })}><Icon name="check" size={16} /> {t("اعتماد", "Approve")}</button>}
        <button className="btn-ghost" onClick={() => window.print()}><Icon name="print" size={16} /> {t("طباعة", "Print")}</button>
        <button className="btn-secondary" onClick={savePdf}><Icon name="download" size={16} /> PDF</button>
        <button className="btn-secondary" onClick={() => invoiceToExcel(inv, s)}><Icon name="download" size={16} /> Excel</button>
        <button className="btn-secondary" onClick={() => invoiceToWord(inv, s)}><Icon name="download" size={16} /> Word</button>
        <button className="btn-primary" disabled={sharing} onClick={sharePdfInvoice}>
          <Icon name="whatsapp" size={16} /> {sharing ? t("جارٍ التحضير…", "Preparing…") : t("مشاركة PDF", "Share PDF")}
        </button>
        <button className="btn-ghost" onClick={whatsapp}><Icon name="whatsapp" size={16} /> {t("واتساب نص", "Text")}</button>
        {inv.status !== "cancelled" && <button className="btn-ghost" style={{ color: "var(--warning)" }} onClick={() => confirm(t("إلغاء الفاتورة؟ (تبقى محفوظة كملغاة)", "Cancel invoice? (kept as cancelled)")) && cancel({ id: inv._id, by: user?.name })}><Icon name="x" size={16} /> {t("إلغاء", "Cancel")}</button>}
        <button className="btn-danger" onClick={() => confirm(t("حذف الفاتورة نهائيًا؟ لا يمكن التراجع.", "Delete invoice permanently? Cannot be undone.")) && removeInvoice({ id: inv._id, by: user?.name }).then(() => navigate("/invoices"))}><Icon name="trash" size={16} /> {t("حذف", "Delete")}</button>
      </div>

      {/* ورقة الفاتورة (مطابقة لقالب MADAME TRADING) */}
      <div ref={sheetRef} className="invoice-sheet" style={{ maxWidth: 820, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "18px 22px", boxShadow: "0 10px 30px -12px rgba(0,0,0,.15)", border: "1px solid var(--border)" }}>
        {/* الترويسة ثنائية اللغة */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "2px solid var(--primary)", paddingBottom: 8 }}>
          <div style={{ direction: "ltr", textAlign: "left" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#0a7c3f", letterSpacing: .5 }}>{nameEn}</div>
            <div style={{ fontSize: 10, color: "var(--ink)", lineHeight: 1.45 }}>
              CR. {s.cr || "147672"}, Mobile: {s.phone || "55239250"}<br />
              {s.email || "azizhmicheh@outlook.sa"}<br />
              {s.addressEn || "Ain Khalid-56, Building: 299, Doha-Qatar."}
            </div>
          </div>
          <div style={{ direction: "rtl", textAlign: "right" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#0a7c3f" }}>{nameAr}</div>
            <div style={{ fontSize: 10, color: "var(--ink)", lineHeight: 1.45 }}>
              س.ت: {s.cr || "147672"} ، جوال: {s.phone || "55239250"}<br />
              {s.email || "azizhmicheh@outlook.sa"}<br />
              {s.addressAr || "عين خالد 56، مبنى: 299، الدوحة – قطر"}
            </div>
          </div>
        </div>

        {/* العنوان + الحالة */}
        <div style={{ textAlign: "center", position: "relative", margin: "8px 0 7px" }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2.5, color: "var(--primary)" }}>INVOICE</span>
          <span className={"pill " + (inv.status === "approved" ? "badge-success" : inv.status === "draft" ? "badge-warning" : "badge-danger")}
            style={{ position: "absolute", insetInlineEnd: 0, top: 0 }}>
            {inv.status === "approved" ? t("معتمدة", "Approved") : inv.status === "draft" ? t("مسودة", "Draft") : t("ملغاة", "Cancelled")}
          </span>
        </div>

        {/* بيانات الفاتورة — أعمدة تتكيّف مع العرض: سبعة حقول في صفّين بدل أربعة */}
        <div className="inv-meta" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(185px,1fr))", gap: 0, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 9 }}>
          <MetaRow labelAr="التاريخ" labelEn="Date" value={formatDate(inv.date, "en")} />
          <MetaRow labelAr="رقم الفاتورة" labelEn="Invoice #" value={inv.number} strong />
          <MetaRow labelAr="العميل" labelEn="Customer" value={inv.customer?.nameEn || inv.customerName} />
          <MetaRow labelAr="الفرع" labelEn="Branch" value={inv.branch || "—"} />
          <MetaRow labelAr="الموقع" labelEn="Location" value={inv.location || "—"} />
          <MetaRow labelAr="أمر تسليم" labelEn="DN #" value={inv.dn || "—"} />
          <MetaRow labelAr="رقم الأوردر" labelEn="LPO #" value={inv.lpo || "—"} />
        </div>

        {/* جدول الأصناف */}
        <table className="inv-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              <ThCell ar="رقم" en="SN" w="7%" />
              <ThCell ar="اسم الصنف" en="ITEM DESCRIPTION" />
              <ThCell ar="الكمية" en="QTY" w="11%" />
              <ThCell ar="الوحدة" en="UNIT" w="12%" />
              <ThCell ar="السعر" en="PRICE (Qr)" w="15%" />
              <ThCell ar="الإجمالي" en="TOTAL (Qr)" w="16%" />
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l: any, i: number) => (
              <tr key={i}>
                <Td center>{i + 1}</Td>
                <Td>{l.name}{lang === "ar" && l.nameAr ? "" : ""}</Td>
                <Td center>{num(l.qty)}</Td>
                <Td center>{l.unit}</Td>
                <Td num>{num(l.unitPrice)}</Td>
                <Td num strong>{num(l.qty * l.unitPrice)}</Td>
              </tr>
            ))}
            {/* أسطر فارغة لملء الجدول حتى 8 على الأقل */}
            {Array.from({ length: Math.max(0, 6 - inv.lines.length) }).map((_, i) => (
              <tr key={"e" + i}><Td center>{inv.lines.length + i + 1}</Td><Td></Td><Td></Td><Td></Td><Td></Td><Td></Td></tr>
            ))}
          </tbody>
        </table>

        {/* التذييل: المبلغ كتابةً + الإجماليات */}
        <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>{t("المبلغ كتابةً", "Amount in words")}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, direction: "ltr", textAlign: "start", fontFamily: "Inter, sans-serif" }}>{amountInWordsEn(inv.total)}</div>
            {inv.notes && <div style={{ marginTop: 10, fontSize: 12 }}><b>{t("ملاحظات", "Note")}:</b> {inv.notes}</div>}
          </div>
          <div style={{ flex: "0 1 260px", minWidth: 230 }}>
            <TotalLine ar="الإجمالي الفرعي" en="Sub Total (QR)" value={num(inv.subtotal)} />
            {inv.discount > 0 && <TotalLine ar="الخصم" en="Discount" value={"- " + num(inv.discount)} />}
            {inv.taxAmount > 0 && <TotalLine ar={`الضريبة ${inv.taxPct}%`} en="Tax" value={num(inv.taxAmount)} />}
            <div style={{ background: "var(--primary)", color: "#fff", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 13, direction: "ltr" }}>Grand Total (QR)</span>
              <span className="tabular" style={{ fontWeight: 900, fontSize: 18, color: "var(--accent-light)" }}>{num(inv.total)}</span>
            </div>
            {inv.paidAmount > 0 && (
              <><TotalLine ar="المدفوع" en="Paid" value={num(inv.paidAmount)} />
                <TotalLine ar="المتبقي" en="Remaining" value={num(inv.total - inv.paidAmount)} /></>
            )}
          </div>
        </div>

        {/* التواقيع */}
        <div className="invoice-sign" style={{ display: "flex", justifyContent: "space-between", gap: 20, marginTop: 22, paddingTop: 6 }}>
          <SignLine ar="المستلم" en="Received by" />
          <SignLine ar="مندوب الشركة" en="EFT Representative" />
        </div>

        {/* الربح — لا يُطبع */}
        <div className="no-print" style={{ marginTop: 16, padding: 10, borderRadius: 8, background: "color-mix(in srgb, var(--accent) 12%, transparent)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700 }} className="text-accent">{t("الربح المتوقع (داخلي)", "Expected profit (internal)")}</span>
          <span className="tabular text-accent" style={{ fontWeight: 900 }}>{money(inv.expectedProfit)}</span>
        </div>
        {inv.approvedAt && <div className="text-muted no-print" style={{ fontSize: 11, marginTop: 8, textAlign: "center" }}>{t("اعتُمدت", "Approved")}: {formatDateTime(inv.approvedAt, lang)} {inv.approvedBy ? `— ${inv.approvedBy}` : ""}</div>}
      </div>

      <style>{`
        .inv-table th, .inv-table td { border: 1px solid #d9cfc0; padding: 5px 8px; }
        .inv-table thead th { background: var(--primary); color: var(--accent-light); }
        /* الفواصل على كل خلية — الحدّ الخارجي يخفيه overflow:hidden فيصحّ مع أي عدد أعمدة */
        .inv-meta > div { border-bottom: 1px solid var(--border); border-inline-end: 1px solid var(--border); }
        @media print {
          .invoice-sheet { box-shadow: none !important; border: none !important; max-width: 100% !important; padding: 0 !important; page-break-inside: avoid; }
          .invoice-sheet .inv-table td { height: 22px !important; padding: 3px 8px !important; }
          .invoice-sign { margin-top: 14px !important; }
          .invoice-sheet { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}

function MetaRow({ labelAr, labelEn, value, strong }: { labelAr: string; labelEn: string; value: string; strong?: boolean }) {
  const { lang } = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 9px", fontSize: 11.5 }}>
      <span style={{ fontWeight: 800, color: "var(--muted)", minWidth: 74 }}>{lang === "ar" ? labelAr : labelEn}</span>
      <span style={{ fontWeight: strong ? 900 : 600, color: strong ? "var(--primary)" : "var(--ink)" }} className="tabular">{value}</span>
    </div>
  );
}

function ThCell({ ar, en, w }: { ar: string; en: string; w?: string }) {
  return (
    <th style={{ width: w, textAlign: "center", fontSize: 11, fontWeight: 800, lineHeight: 1.3 }}>
      <div>{en}</div><div style={{ fontSize: 10.5, opacity: .9 }}>{ar}</div>
    </th>
  );
}

function Td({ children, center, num, strong }: { children?: any; center?: boolean; num?: boolean; strong?: boolean }) {
  return <td className={num ? "tabular" : ""} style={{ textAlign: center ? "center" : num ? "end" : "start", fontWeight: strong ? 800 : 500, height: 25 }}>{children}</td>;
}

function TotalLine({ ar, en, value }: { ar: string; en: string; value: string }) {
  // عناوين الإجماليات بالإنجليزية دائمًا (مطابقة للقالب الرسمي) حتى في الفاتورة العربية
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 4px", fontSize: 12.5, borderBottom: "1px dashed var(--border)" }}>
      <span style={{ color: "var(--muted)", fontWeight: 700, direction: "ltr" }}>{en}</span>
      <span className="tabular" style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SignLine({ ar, en }: { ar: string; en: string }) {
  const { lang } = useLang();
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ borderTop: "1.5px solid var(--ink)", marginTop: 28, paddingTop: 6, fontSize: 12, fontWeight: 700 }}>
        {lang === "ar" ? ar : en} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 10 }}>{lang === "ar" ? en : ar}</span>
      </div>
    </div>
  );
}
