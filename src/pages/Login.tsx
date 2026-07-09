import { useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useT, useLang } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/ui";

export default function Login() {
  const t = useT();
  const { toggle, lang } = useLang();
  const convex = useConvex();
  const { login } = useAuth();
  const navigate = useNavigate();
  const settings = useQuery(api.settings.all, {});
  const brand = lang === "ar" ? (settings?.companyName || "سوق الجملة") : (settings?.companyNameEn || "Wholesale Market");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (pin.length < 3) return;
    setLoading(true);
    setError("");
    try {
      const res = await convex.mutation(api.auth.signIn, { pin });
      if (res) {
        login(res.user as any, res.token);
        navigate("/");
      } else {
        setError(t("كلمة المرور غير صحيحة", "Incorrect password"));
      }
    } catch (e) {
      setError(t("تعذّر الاتصال بقاعدة البيانات", "Cannot reach the database"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <button className="btn-ghost no-print" onClick={toggle} style={{ position: "absolute", top: 16, insetInlineEnd: 16, fontWeight: 800 }}>
        {lang === "ar" ? "English" : "العربية"}
      </button>
      <div className="card-luxurious animate-in" style={{ width: "100%", maxWidth: 400, textAlign: "center", padding: 32 }}>
        <div className="hero-premium" style={{ padding: 28, marginBottom: 24, borderRadius: "var(--r-lg)" }}>
          <img src="/logo.svg" width={56} height={56} alt="logo" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{brand}</div>
          <div style={{ fontSize: 12, color: "var(--accent-light)" }}>{t("إدارة تجارة الخضروات والفواكه", "Fruits & Vegetables Trading")}</div>
        </div>
        <label className="label" style={{ textAlign: "start" }}>{t("كلمة المرور", "Password")}</label>
        <input
          className="field" type="password" value={pin} autoFocus autoComplete="current-password"
          onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("أدخل كلمة المرور", "Enter password")} style={{ textAlign: "center", fontSize: 18 }}
        />
        {error && <div className="pill badge-danger" style={{ marginTop: 12 }}><Icon name="alert" size={14} />{error}</div>}
        <button className="btn-primary" onClick={submit} disabled={loading || pin.length < 3} style={{ width: "100%", marginTop: 18, padding: 12 }}>
          {loading ? t("جارٍ الدخول…", "Signing in…") : t("دخول", "Sign in")}
        </button>
      </div>
    </div>
  );
}
