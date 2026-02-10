import React from "react";

export type Lang = "ru" | "en";
type Dict = Record<string, string>;

const RU: Dict = {
  // common
  "common.loading": "Загрузка…",
  "common.save": "Сохранить",
  "common.cancel": "Отмена",
  "common.refresh": "Обновить",
  "common.logout": "Выйти",

  // login
  "login.title": "Вход в кабинет",
  "login.tab.login": "Вход",
  "login.tab.register": "Регистрация",
  "login.email": "Email",
  "login.password": "Пароль",
  "login.name": "Имя",
  "login.submit.login": "Войти",
  "login.submit.register": "Создать аккаунт",

  // cabinet/projects
  "cabinet.title": "Кабинет проектов",
  "cabinet.newProject": "Создать проект",
  "cabinet.projectName": "Название mini-app",
  "cabinet.open": "Открыть",
  "cabinet.empty": "Проектов пока нет — создай первый.",
};

const EN: Dict = {
  // common
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.refresh": "Refresh",
  "common.logout": "Log out",

  // login
  "login.title": "Sign in",
  "login.tab.login": "Login",
  "login.tab.register": "Register",
  "login.email": "Email",
  "login.password": "Password",
  "login.name": "Name",
  "login.submit.login": "Sign in",
  "login.submit.register": "Create account",

  // cabinet/projects
  "cabinet.title": "Projects",
  "cabinet.newProject": "Create project",
  "cabinet.projectName": "Mini-app name",
  "cabinet.open": "Open",
  "cabinet.empty": "No projects yet — create your first one.",
};

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
  const [lang, _setLang] = React.useState<Lang>(() => detectDefaultLang());

  const setLang = React.useCallback((l: Lang) => {
    _setLang(l);
    try { localStorage.setItem("sg_lang", l); } catch (_) {}
  }, []);

  const t = React.useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = lang === "ru" ? RU : EN;
    let s = dict[key] ?? key;
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
