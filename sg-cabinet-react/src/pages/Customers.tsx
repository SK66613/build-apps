import React from "react";
import { useParams } from "react-router-dom";

type Customer = {
  tg_id: string | number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  created_at?: string;
  last_seen_at?: string;
  coins?: number;
  orders_count?: number;
};

type DialogRow = {
  tg_id: string | number;
  title?: string; // name / username
  username?: string;
  last_text?: string;
  last_at?: string;
  unread?: number;
};

type DialogMessage = {
  id?: number | string;
  ts?: string;
  at?: string;
  created_at?: string;
  dir?: "in" | "out"; // incoming/outgoing
  from?: "user" | "bot" | "admin";
  text?: string;
  meta?: any;
};

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || (data && data.ok === false)) {
    const msg = data?.error || data?.message || `HTTP_${r.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(+d)) return "";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function displayName(u: Partial<Customer & DialogRow>) {
  const fn = (u as any).first_name || "";
  const ln = (u as any).last_name || "";
  const name = `${fn} ${ln}`.trim();
  const un = (u as any).username ? `@${(u as any).username}` : "";
  return name || (u as any).title || un || `tg:${(u as any).tg_id ?? ""}`;
}

function avatarLetter(u: Partial<Customer & DialogRow>) {
  const s = displayName(u);
  return (s?.trim()?.[0] || "U").toUpperCase();
}

export default function Customers() {
  const { appId } = useParams<{ appId: string }>();

  const [mode, setMode] = React.useState<"customers" | "dialogs">("customers");
  const [q, setQ] = React.useState("");
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [dialogs, setDialogs] = React.useState<DialogRow[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [listErr, setListErr] = React.useState<string | null>(null);

  const [activeTgId, setActiveTgId] = React.useState<string>("");
  const [activeUser, setActiveUser] = React.useState<Partial<Customer & DialogRow> | null>(null);

  const [messages, setMessages] = React.useState<DialogMessage[]>([]);
  const [loadingDialog, setLoadingDialog] = React.useState(false);
  const [dialogErr, setDialogErr] = React.useState<string | null>(null);

  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const list = React.useMemo(() => {
    if (mode === "dialogs") return dialogs.map(d => ({ kind: "dialog" as const, ...d }));
    return customers.map(c => ({ kind: "customer" as const, ...c }));
  }, [mode, customers, dialogs]);

  const canUse = Boolean(appId);

  // Load customers list (search)
  React.useEffect(() => {
    if (!canUse) return;
    let alive = true;
    setLoadingList(true);
    setListErr(null);

    const run = async () => {
      try {
        if (mode === "customers") {
          const data = await apiFetch<any>(
            `/api/cabinet/apps/${encodeURIComponent(appId!)}/customers?query=${encodeURIComponent(q)}&limit=200`
          );
          const items = data?.items || data?.customers || data?.data || [];
          if (!alive) return;
          setCustomers(Array.isArray(items) ? items : []);
        } else {
          const data = await apiFetch<any>(
            `/api/cabinet/apps/${encodeURIComponent(appId!)}/dialogs?range=30d&q=${encodeURIComponent(q)}`
          );
          const items = data?.items || data?.dialogs || data?.data || [];
          if (!alive) return;
          setDialogs(Array.isArray(items) ? items : []);
        }
      } catch (e: any) {
        if (!alive) return;
        setListErr(e?.message || "Ошибка загрузки");
        if (mode === "customers") setCustomers([]);
        else setDialogs([]);
      } finally {
        if (alive) setLoadingList(false);
      }
    };

    const t = setTimeout(run, 200); // debounce
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [canUse, appId, mode, q]);

  // Load dialog messages
  const loadDialog = React.useCallback(async (tgId: string) => {
    if (!appId || !tgId) return;
    setLoadingDialog(true);
    setDialogErr(null);
    try {
      const data = await apiFetch<any>(
        `/api/cabinet/apps/${encodeURIComponent(appId)}/dialog/${encodeURIComponent(tgId)}`
      );
      const items = data?.items || data?.messages || data?.data || [];
      setMessages(Array.isArray(items) ? items : []);
    } catch (e: any) {
      setMessages([]);
      setDialogErr(e?.message || "Ошибка загрузки диалога");
    } finally {
      setLoadingDialog(false);
    }
  }, [appId]);

  const pick = React.useCallback((row: any) => {
    const tgId = String(row.tg_id ?? "");
    setActiveTgId(tgId);
    setActiveUser(row);
    void loadDialog(tgId);
  }, [loadDialog]);

  // auto-scroll
  const chatRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loadingDialog]);

  async function send() {
    if (!appId || !activeTgId) return;
    const v = text.trim();
    if (!v) return;

    setSending(true);
    try {
      await apiFetch<any>(
        `/api/cabinet/apps/${encodeURIComponent(appId)}/dialog/${encodeURIComponent(activeTgId)}`,
        { method: "POST", body: JSON.stringify({ text: v }) }
      );

      // optimistic append
      setMessages((prev) => [
        ...prev,
        { id: `tmp_${Date.now()}`, ts: new Date().toISOString(), dir: "out", from: "admin", text: v },
      ]);
      setText("");
    } catch (e: any) {
      setDialogErr(e?.message || "Не удалось отправить");
    } finally {
      setSending(false);
      // refresh to get canonical status/ts
      void loadDialog(activeTgId);
    }
  }

  const headerTitle = activeUser ? displayName(activeUser) : "Выберите пользователя";
  const headerSub = activeUser?.username ? `@${activeUser.username}` : activeTgId ? `tg_id: ${activeTgId}` : "";

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Customers</div>
          <div className="text-sm opacity-70">Поиск пользователей и личные сообщения</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("customers")}
            className={cx(
              "rounded-xl px-3 py-2 text-sm font-medium border",
              mode === "customers" ? "bg-white/80" : "bg-white/40 hover:bg-white/60"
            )}
          >
            Пользователи
          </button>
          <button
            onClick={() => setMode("dialogs")}
            className={cx(
              "rounded-xl px-3 py-2 text-sm font-medium border",
              mode === "dialogs" ? "bg-white/80" : "bg-white/40 hover:bg-white/60"
            )}
          >
            Диалоги
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        {/* Left */}
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={mode === "customers" ? "Найти пользователя (имя, @, tg_id)..." : "Поиск по диалогам..."}
                className="w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
            <button
              onClick={() => setQ("")}
              className="rounded-xl border bg-white/60 px-3 py-2 text-sm hover:bg-white/80"
              title="Очистить"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 text-xs opacity-70 flex items-center justify-between">
            <div>{loadingList ? "Загрузка…" : `${list.length} записей`}</div>
            {listErr ? <div className="text-red-600">{listErr}</div> : <div />}
          </div>

          <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl">
            {list.length === 0 && !loadingList ? (
              <div className="p-4 text-sm opacity-70">Ничего не найдено.</div>
            ) : (
              <div className="divide-y">
                {list.map((row: any) => {
                  const tgId = String(row.tg_id ?? "");
                  const active = tgId && tgId === activeTgId;

                  const subtitle =
                    mode === "dialogs"
                      ? (row.last_text ? row.last_text : (row.last_at ? formatWhen(row.last_at) : ""))
                      : (row.username ? `@${row.username}` : (row.created_at ? `с ${formatWhen(row.created_at)}` : ""));

                  return (
                    <button
                      key={`${mode}_${tgId}`}
                      onClick={() => pick(row)}
                      className={cx(
                        "w-full text-left p-3 flex items-center gap-3 hover:bg-white/70",
                        active ? "bg-white/90" : "bg-transparent"
                      )}
                    >
                      <div className="h-10 w-10 rounded-2xl border bg-white/70 flex items-center justify-center font-semibold">
                        {avatarLetter(row)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium">{displayName(row)}</div>
                          {row.unread ? (
                            <span className="ml-auto text-xs rounded-full border bg-white px-2 py-0.5">
                              {row.unread}
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-xs opacity-70">{subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-3 flex flex-col min-h-[520px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{headerTitle}</div>
              <div className="text-xs opacity-70">{headerSub}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!activeTgId || loadingDialog}
                onClick={() => activeTgId && loadDialog(activeTgId)}
                className="rounded-xl border bg-white/60 px-3 py-2 text-sm hover:bg-white/80 disabled:opacity-50"
              >
                Обновить
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border bg-white/60 flex-1 overflow-auto p-3" ref={chatRef}>
            {!activeTgId ? (
              <div className="h-full flex items-center justify-center text-sm opacity-70">
                Выбери пользователя слева — справа откроется чат.
              </div>
            ) : loadingDialog ? (
              <div className="text-sm opacity-70">Загрузка диалога…</div>
            ) : dialogErr ? (
              <div className="text-sm text-red-600">{dialogErr}</div>
            ) : messages.length === 0 ? (
              <div className="text-sm opacity-70">Сообщений пока нет. Напиши первым 🙂</div>
            ) : (
              <div className="space-y-2">
                {messages.map((m, idx) => {
                  const dir = m.dir || (m.from === "admin" || m.from === "bot" ? "out" : "in");
                  const t = m.ts || m.at || m.created_at;
                  const when = formatWhen(t);

                  return (
                    <div key={String(m.id ?? idx)} className={cx("flex", dir === "out" ? "justify-end" : "justify-start")}>
                      <div
                        className={cx(
                          "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                          dir === "out" ? "bg-white/90" : "bg-white/70"
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.text || ""}</div>
                        {when ? <div className="mt-1 text-[11px] opacity-60">{when}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeTgId ? "Написать сообщение…" : "Сначала выбери пользователя слева"}
              disabled={!activeTgId}
              rows={2}
              className="flex-1 resize-none rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              onClick={() => void send()}
              disabled={!activeTgId || sending || !text.trim()}
              className="rounded-xl border bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
              title="Ctrl+Enter"
            >
              {sending ? "…" : "Отправить"}
            </button>
          </div>

          <div className="mt-1 text-[11px] opacity-60">
            Подсказка: <span className="font-medium">Ctrl+Enter</span> для отправки.
          </div>
        </div>
      </div>
    </div>
  );
}
