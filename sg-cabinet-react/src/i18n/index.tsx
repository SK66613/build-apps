import React from "react";
import RU from "./ru";
import EN from "./en";

export type Lang = "ru" | "en";
export type Dict = Record<string, string>;

export const DICTS: Record<Lang, Dict> = {
  ru: RU,
  en: EN,
};

export const LANGS: { code: Lang; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

function detectDefaultLang(): Lang {
  const saved = (localStorage.getItem("sg_lang") || "") as Lang;
  if (saved === "ru" || saved === "en") return saved;

  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("ru") ? "ru" : "en";
}

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(() => detectDefaultLang());

  const setLang = React.useCallback((l: Lang) => {
    if (!DICTS[l]) return;
    setLangState(l);
    try { localStorage.setItem("sg_lang", l); } catch (_) {}
    // опционально: событие для не-React частей
    try { window.dispatchEvent(new CustomEvent("sg:lang", { detail: { lang: l } })); } catch (_) {}
  }, []);

  const t = React.useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = DICTS[lang] || DICTS.en;
    let s = dict[key] ?? DICTS.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
