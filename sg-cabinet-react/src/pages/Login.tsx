// src/pages/Login.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../app/auth";

type MsgType = "error" | "success" | "";

function mapError(code: string) {
  switch (code) {
    case "EMAIL_EXISTS": return "Этот e-mail уже зарегистрирован. Попробуй войти.";
    case "BAD_EMAIL": return "Некорректный e-mail.";
    case "WEAK_PASSWORD": return "Пароль слишком короткий.";
    case "INVALID_CREDENTIALS":
    case "BAD_CREDENTIALS": return "Неверный e-mail или пароль.";
    case "EMAIL_OR_PASSWORD_MISSING": return "Заполни e-mail и пароль.";
    case "BAD_INPUT": return "Проверь e-mail и пароль (пароль минимум 6 символов).";
    case "EMAIL_NOT_VERIFIED": return "E-mail ещё не подтверждён.";
    default: return code ? `Ошибка: ${code}` : "Ошибка";
  }
}

function errToCode(e: any): string {
  // apiFetch бросает {status,message,payload}
  if (e && typeof e === 'object') {
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error === 'string') return e.error;
  }
  return String(e?.message || e || 'ERROR');
}

export default function Login() {
  const nav = useNavigate();
  const { refresh } = useAuth();

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

  async function doLogin() {
    if (!email.trim() || !pass) {
      setMsg({ text: "Заполни e-mail и пароль.", type: "error" });
      return;
    }
    setBusy(true);
    setMsg({ text: "Входим…", type: "" });

    try {
      const r = await post("/api/auth/login", { email: email.trim(), password: pass });
      if (!r?.ok) throw new Error(r?.error || "LOGIN_FAILED");

      // ✅ FIX: дождаться обновления me в react-query, чтобы Guarded сразу пропустил
      await refresh();

      setMsg({ text: "Готово. Открываю кабинет…", type: "success" });
      nav("/cabinet", { replace: true });
    } catch (e: any) {
      setMsg({ text: mapError(errToCode(e)), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function doRegister() {
    if (!email.trim() || !pass) {
      setMsg({ text: "Заполни e-mail и пароль.", type: "error" });
      return;
    }
    setBusy(true);
    setMsg({ text: "Создаю аккаунт…", type: "" });

    try {
      const r = await post("/api/auth/register", { name: name.trim(), email: email.trim(), password: pass });
      if (!r?.ok) throw new Error(r?.error || "REGISTER_FAILED");

      await post("/api/auth/login", { email: email.trim(), password: pass });

      // ✅ FIX: обновить me
      await refresh();

      setMsg({ text: "Аккаунт создан. Открываю кабинет…", type: "success" });
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
          <div className="hint">Вход в кабинет</div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "tab active" : "tab"}
            disabled={busy}
            onClick={() => { setMode("login"); setMsg({ text: "", type: "" }); }}
          >
            Вход
          </button>
          <button
            className={mode === "register" ? "tab active" : "tab"}
            disabled={busy}
            onClick={() => { setMode("register"); setMsg({ text: "", type: "" }); }}
          >
            Регистрация
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
              <label>Имя</label>
              <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} />
            </>
          )}
          <label>Email</label>
          <input className="sg-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Пароль</label>
          <input className="sg-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />

          <button className="sg-btn" disabled={busy} type="submit">
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
