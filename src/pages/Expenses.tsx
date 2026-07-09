import { useState } from "react";
import { useAuthedQuery as useQuery, useAuthedMutation as useMutation } from "../lib/authedConvex";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { money, formatDate, today } from "../lib/format";
import { exportExcel } from "../lib/xlsx";
import { PageHeader, Icon, Modal, Spinner, Empty, StatCard } from "../components/ui";

export const EXPENSE_CATS = [
  "توصيل", "أجور عمال", "بنزين ونقل", "إيجار", "كهرباء ومياه",
  "مستلزمات وتغليف", "صيانة", "رسوم وضرائب", "أخرى",
];

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export default function Expenses() {
  const t = useT(); const { lang } = useLang();
  const { user } = useAuth();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const data = useQuery(api.expenses.list, { from, to });
  const create = useMutation(api.expenses.create);
  const update = useMutation(api.expenses.update);
  const remove = useMutation(api.expenses.remove);
  const [editing, setEditing] = useState<any>(null);

  if (data === undefined) return <Spinner />;

  const onExport = () => exportExcel(data.rows.map((r: any) => ({
    Date: r.date, Category: r.category, PaidTo: r.paidTo ?? "", Amount: r.amount, Note: r.note ?? "",
  })), `expenses-${from}_${to}`);

  return (
    <div className="animate-in">
      <PageHeader title={t("المصروفات", "Expenses")} subtitle={t("سجّل مصروفاتك لتعرف صافي الربح", "Track expenses to know net profit")}
        actions={<>
          <button className="btn-ghost" onClick={onExport}><Icon name="download" size={16} /> {t("تصدير", "Export")}</button>
          <button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} /> {t("مصروف جديد", "New Expense")}</button>
        </>} />

      <div className="card" style={{ marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label className="label">{t("من", "From")}</label><input className="field tabular" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label">{t("إلى", "To")}</label><input className="field tabular" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label={t("إجمالي المصروفات", "Total Expenses")} value={money(data.total)} icon="money" accent />
        <StatCard label={t("عدد البنود", "Entries")} value={String(data.rows.length)} icon="clipboard" />
      </div>

      {data.breakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>{t("التوزيع حسب البند", "By Category")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {data.breakdown.map((b: any) => (
              <div key={b.category} className="pill badge-muted" style={{ padding: "8px 14px", fontSize: 13 }}>
                {b.category}: <b className="tabular" style={{ marginInlineStart: 4 }}>{money(b.amount, false)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>{t("التاريخ", "Date")}</th><th>{t("البند", "Category")}</th><th>{t("لمن/جهة", "Paid to")}</th><th>{t("ملاحظة", "Note")}</th><th>{t("المبلغ", "Amount")}</th><th></th></tr></thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r._id}>
                <td>{formatDate(r.date, lang)}</td>
                <td><span className="pill badge-champion">{r.category}</span></td>
                <td>{r.paidTo ?? "—"}</td>
                <td className="text-muted" style={{ fontSize: 12 }}>{r.note ?? ""}</td>
                <td className="tabular" style={{ fontWeight: 800 }}>{money(r.amount, false)}</td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-ghost btn-icon" onClick={() => setEditing(r)}><Icon name="edit" size={15} /></button>
                    <button className="btn-ghost btn-icon" onClick={() => confirm(t("حذف المصروف؟", "Delete expense?")) && remove({ id: r._id })}><Icon name="trash" size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && <Empty text={t("لا مصروفات في هذه الفترة", "No expenses in this period")} icon="money" />}
      </div>

      {editing && <ExpenseModal expense={editing} onClose={() => setEditing(null)}
        onSave={async (d: any) => {
          if (editing._id) await update({ id: editing._id, ...d });
          else await create({ ...d, createdBy: user?.name });
          setEditing(null);
        }} />}
    </div>
  );
}

function ExpenseModal({ expense, onClose, onSave }: any) {
  const t = useT();
  const [f, setF] = useState({
    date: expense.date ?? today(),
    category: expense.category ?? EXPENSE_CATS[0],
    amount: expense.amount ?? 0,
    paidTo: expense.paidTo ?? "",
    note: expense.note ?? "",
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <Modal open title={expense._id ? t("تعديل مصروف", "Edit Expense") : t("مصروف جديد", "New Expense")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="label">{t("التاريخ", "Date")}</label><input className="field tabular" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div><label className="label">{t("المبلغ", "Amount")}</label><input className="field tabular" type="number" autoFocus value={f.amount} onChange={(e) => set("amount", Number(e.target.value))} style={{ fontWeight: 800 }} /></div>
        </div>
        <div><label className="label">{t("البند", "Category")}</label>
          <select className="field" value={EXPENSE_CATS.includes(f.category) ? f.category : "__custom"} onChange={(e) => set("category", e.target.value === "__custom" ? "" : e.target.value)}>
            {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__custom">{t("بند مخصّص…", "Custom…")}</option>
          </select>
          {!EXPENSE_CATS.includes(f.category) && <input className="field" style={{ marginTop: 8 }} placeholder={t("اكتب اسم البند", "Category name")} value={f.category} onChange={(e) => set("category", e.target.value)} />}
        </div>
        <div><label className="label">{t("لمن / جهة الصرف (اختياري)", "Paid to (optional)")}</label><input className="field" value={f.paidTo} onChange={(e) => set("paidTo", e.target.value)} /></div>
        <div><label className="label">{t("ملاحظة", "Note")}</label><input className="field" value={f.note} onChange={(e) => set("note", e.target.value)} /></div>
        <button className="btn-primary" disabled={!f.category || f.amount <= 0} onClick={() => onSave({ ...f, paidTo: f.paidTo || undefined, note: f.note || undefined })}>
          <Icon name="check" size={16} /> {t("حفظ", "Save")}
        </button>
      </div>
    </Modal>
  );
}
