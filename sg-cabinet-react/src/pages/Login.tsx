// src/pages/Login.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../app/auth";
import { useI18n } from "../i18n";
import { LanguageSelect } from "../components/LanguageSelect";

type MsgType = "error" | "success" | "";

function errToCode(e: any): string {
  // apiFetch бросает {status,message,payload}
  if (e && typeof e === "object") {
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return String(e?.message || e || "ERROR");
}

export default function Login() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const { t } = useI18n();

  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ text: string; type: MsgType }>({ text: "", type: "" });

  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [name, setName] = React.useState("");

  // если уже есть сессия — сразу в кабинет
  React.useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<any>("/api/auth/me");
        if (me?.ok && me?.authenticated) nav("/cabinet", { replace: true });
      } catch (_) {}
    })();
  }, [nav]);

  const post = (path: string, body: any) =>
    apiFetch<any>(path, { method: "POST", body: JSON.stringify(body || {}) });

  function mapError(code: string) {
    switch (code) {
      case "EMAIL_EXISTS": return t("err.EMAIL_EXISTS");
      case "BAD_EMAIL": return t("err.BAD_EMAIL");
      case "WEAK_PASSWORD": return t("err.WEAK_PASSWORD");
      case "INVALID_CREDENTIALS":
      case "BAD_CREDENTIALS": return t("err.BAD_CREDENTIALS");
      case "EMAIL_OR_PASSWORD_MISSING": return t("err.EMAIL_OR_PASSWORD_MISSING");
      case "BAD_INPUT": return t("err.BAD_INPUT");
      case "EMAIL_NOT_VERIFIED": return t("err.EMAIL_NOT_VERIFIED");
      default: return code ? t("err.GENERIC", { code }) : t("err.UNKNOWN");
    }
  }

  async function doLogin() {
    if (!email.trim() || !pass) {
      setMsg({ text: t("err.EMAIL_OR_PASSWORD_MISSING"), type: "error" });
      return;
    }
    setBusy(true);
    setMsg({ text: t("login.progress.signin"), type: "" });

    try {
      const r = await post("/api/auth/login", { email: email.trim(), password: pass });
      if (!r?.ok) throw new Error(r?.error || "LOGIN_FAILED");

      // ✅ дождаться обновления me в react-query, чтобы Guarded сразу пропустил
      await refresh();

      setMsg({ text: t("login.progress.openCabinet"), type: "success" });
      nav("/cabinet", { replace: true });
    } catch (e: any) {
      setMsg({ text: mapError(errToCode(e)), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function doRegister() {
    if (!email.trim() || !pass) {
      setMsg({ text: t("err.EMAIL_OR_PASSWORD_MISSING"), type: "error" });
      return;
    }
    setBusy(true);
    setMsg({ text: t("login.progress.register"), type: "" });

    try {
      const r = await post("/api/auth/register", { name: name.trim(), email: email.trim(), password: pass });
      if (!r?.ok) throw new Error(r?.error || "REGISTER_FAILED");

      await post("/api/auth/login", { email: email.trim(), password: pass });

      // ✅ обновить me
      await refresh();

      setMsg({ text: t("login.progress.openCabinet"), type: "success" });
      nav("/cabinet", { replace: true });
    } catch (e: any) {
      setMsg({ text: mapError(errToCode(e)), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand">Sales Genius</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="hint">{t("login.title")}</div>
            <LanguageSelect className="lang-select" disabled={busy} />
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            disabled={busy}
            onClick={() => { setMode("login"); setMsg({ text: "", type: "" }); }}
          >
            {t("login.tab.login")}
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            disabled={busy}
            onClick={() => { setMode("register"); setMsg({ text: "", type: "" }); }}
          >
            {t("login.tab.register")}
          </button>
        </div>

        {!!msg.text && (
          <div className={`auth-msg ${msg.type || ""}`}>{msg.text}</div>
        )}

        <form
          className="auth-form"
          onSubmit={(e) => { e.preventDefault(); mode === "login" ? doLogin() : doRegister(); }}
        >
          {mode === "register" && (
            <>
              <label>{t("login.name")}</label>
              <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} />
            </>
          )}
          <label>{t("login.email")}</label>
          <input className="sg-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>{t("login.password")}</label>
          <input className="sg-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />

          <button className="sg-btn" disabled={busy} type="submit">
            {mode === "login" ? t("login.submit.login") : t("login.submit.register")}
          </button>
        </form>
      </div>
    </div>
  );
}
