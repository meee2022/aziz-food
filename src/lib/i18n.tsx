import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "ar" | "en";
interface LangCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const Ctx = createContext<LangCtx>({ lang: "ar", dir: "rtl", setLang: () => {}, toggle: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "ar");

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
  }, [lang]);

  const dir = lang === "ar" ? "rtl" : "ltr";
  return (
    <Ctx.Provider value={{ lang, dir, setLang, toggle: () => setLang(lang === "ar" ? "en" : "ar") }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);

/** ترجمة سريعة: t("عربي","English"). */
export function useT() {
  const { lang } = useLang();
  return (ar: string, en: string) => (lang === "ar" ? ar : en);
}
