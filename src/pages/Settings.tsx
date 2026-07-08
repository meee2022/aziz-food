import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { PageHeader, Icon, Modal, Spinner } from "../components/ui";

const ROLES: [string, string, string][] = [
  ["admin", "مدير", "Admin"], ["sales", "مبيعات", "Sales"],
  ["accountant", "محاسب", "Accountant"], ["warehouse", "مخزن", "Warehouse"],
];

export default function Settings() {
  const t = useT(); const { lang } = useLang();
  const settings = useQuery(api.settings.all, {});
  const users = useQuery(api.users.list, {});
  const cats = useQuery(api.categories.list, {});
  const setSetting = useMutation(api.settings.set);
  const createUser = useMutation(api.users.create);
  const updateUser = useMutation(api.users.update);
  const createCat = useMutation(api.categories.create);
  const seed = useMutation(api.seed.run);

  const [company, setCompany] = useState<Record<string, string> | null>(null);
  const [userModal, setUserModal] = useState<any>(null);
  const [seedMsg, setSeedMsg] = useState("");

  if (settings === undefined || users === undefined) return <Spinner />;
  const s = company ?? settings;
  const setS = (k: string, v: string) => setCompany({ ...(company ?? settings), [k]: v });

  return (
    <div className="animate-in">
      <PageHeader title={t("الإعدادات", "Settings")} />

      {/* بيانات الشركة */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>{t("بيانات الشركة", "Company")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <div><label className="label">{t("اسم الشركة (عربي)", "Company (AR)")}</label><input className="field" value={s.companyName ?? ""} onChange={(e) => setS("companyName", e.target.value)} /></div>
          <div><label className="label">{t("اسم الشركة (إنجليزي)", "Company (EN)")}</label><input className="field" value={s.companyNameEn ?? ""} onChange={(e) => setS("companyNameEn", e.target.value)} /></div>
          <div><label className="label">{t("السجل التجاري", "CR #")}</label><input className="field tabular" value={s.cr ?? ""} onChange={(e) => setS("cr", e.target.value)} /></div>
          <div><label className="label">{t("الهاتف", "Phone")}</label><input className="field tabular" value={s.phone ?? ""} onChange={(e) => setS("phone", e.target.value)} /></div>
          <div><label className="label">{t("البريد الإلكتروني", "Email")}</label><input className="field" value={s.email ?? ""} onChange={(e) => setS("email", e.target.value)} /></div>
          <div><label className="label">{t("العملة", "Currency")}</label><input className="field" value={s.currency ?? "ر.ق"} onChange={(e) => setS("currency", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="label">{t("العنوان (عربي)", "Address (AR)")}</label><input className="field" value={s.addressAr ?? ""} onChange={(e) => setS("addressAr", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label className="label">{t("العنوان (إنجليزي)", "Address (EN)")}</label><input className="field" value={s.addressEn ?? ""} onChange={(e) => setS("addressEn", e.target.value)} /></div>
          <div><label className="label">{t("الضريبة الافتراضية %", "Default tax %")}</label><input className="field tabular" type="number" value={s.taxPct ?? "0"} onChange={(e) => setS("taxPct", e.target.value)} /></div>
        </div>
        <button className="btn-primary" style={{ marginTop: 14 }} disabled={!company} onClick={async () => {
          for (const [k, v] of Object.entries(company!)) await setSetting({ key: k, value: String(v) });
          setCompany(null); location.reload();
        }}><Icon name="check" size={16} /> {t("حفظ", "Save")}</button>
      </div>

      {/* المستخدمون */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="section-title">{t("المستخدمون والصلاحيات", "Users & Roles")}</div>
          <button className="btn-secondary" onClick={() => setUserModal({})}><Icon name="plus" size={15} /> {t("مستخدم", "User")}</button>
        </div>
        <table className="data-table">
          <thead><tr><th>{t("الاسم", "Name")}</th><th>{t("الدور", "Role")}</th><th>PIN</th><th>{t("الحالة", "Status")}</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>{u.name}</td>
                <td><span className="pill badge-info">{t(ROLES.find((r) => r[0] === u.role)?.[1] ?? "", ROLES.find((r) => r[0] === u.role)?.[2] ?? "")}</span></td>
                <td className="tabular">{u.pin}</td>
                <td>{u.active ? <span className="pill badge-success">{t("نشط", "Active")}</span> : <span className="pill badge-muted">{t("موقوف", "Off")}</span>}</td>
                <td><button className="btn-ghost btn-icon" onClick={() => setUserModal(u)}><Icon name="edit" size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* التصنيفات */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="section-title">{t("التصنيفات", "Categories")}</div>
          <button className="btn-secondary" onClick={async () => { const ar = prompt(t("اسم التصنيف بالعربي", "Category (AR)")); const en = prompt(t("بالإنجليزي", "(EN)")); if (ar && en) await createCat({ nameAr: ar, nameEn: en }); }}>
            <Icon name="plus" size={15} /> {t("تصنيف", "Category")}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cats?.map((c) => <span key={c._id} className="pill badge-champion">{lang === "ar" ? c.nameAr : c.nameEn}</span>)}
        </div>
      </div>

      {/* التهيئة الأولية */}
      <div className="card" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
        <div className="section-title" style={{ marginBottom: 8 }}>{t("التهيئة الأولية", "Seed Data")}</div>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>{t("تحميل الأصناف والتصنيفات وقوائم الأسعار والمستخدمين من بيانات Excel المرفقة (يُنفَّذ مرة واحدة).", "Load items, categories, price lists & users from the attached Excel data (run once).")}</p>
        {seedMsg && <div className="pill badge-success" style={{ marginBottom: 10 }}><Icon name="check" size={14} /> {seedMsg}</div>}
        <button className="btn-primary" onClick={async () => { const r = await seed({}); setSeedMsg(r.skipped ? t("البيانات موجودة بالفعل", "Data already exists") : t(`تم تحميل ${r.items} صنف`, `Loaded ${r.items} items`)); }}>
          <Icon name="upload" size={16} /> {t("تحميل البيانات الأولية", "Load seed data")}
        </button>
      </div>

      {userModal && <UserModal user={userModal} onClose={() => setUserModal(null)} onSave={async (d: any) => {
        if (userModal.id) await updateUser({ id: userModal.id, ...d }); else await createUser(d); setUserModal(null);
      }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSave }: any) {
  const t = useT();
  const [f, setF] = useState({ name: user.name ?? "", pin: user.pin ?? "", role: user.role ?? "sales", active: user.active ?? true });
  return (
    <Modal open title={user.id ? t("تعديل مستخدم", "Edit User") : t("مستخدم جديد", "New User")} onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        <div><label className="label">{t("الاسم", "Name")}</label><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label">{t("رمز الدخول PIN", "PIN")}</label><input className="field tabular" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></div>
        <div><label className="label">{t("الدور", "Role")}</label>
          <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r[0]} value={r[0]}>{t(r[1], r[2])}</option>)}</select></div>
        {user.id && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t("نشط", "Active")}</label>}
        <button className="btn-primary" disabled={!f.name || f.pin.length < 3} onClick={() => onSave(f)}><Icon name="check" size={16} /> {t("حفظ", "Save")}</button>
      </div>
    </Modal>
  );
}
