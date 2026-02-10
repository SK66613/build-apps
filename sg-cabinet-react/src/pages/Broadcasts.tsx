import React from "react";
import { useParams } from "react-router-dom";

type Campaign = {
  id?: number | string;
  created_at?: string;
  ts?: string;

  title?: string;
  text?: string;

  segment?: string;
  status?: string; // draft/sent/ok/error
  sent?: number;
  delivered?: number;
  failed?: number;
  opened?: number; // если есть
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

function sumNum(arr: any[], key: string) {
  return arr.reduce((acc, x) => acc + (Number(x?.[key]) || 0), 0);
}

function clampText(s?: string, n = 120) {
  const v = (s || "").trim();
  if (v.length <= n) return v;
  return v.slice(0, n - 1) + "…";
}

export default function Broadcasts() {
  const { appId } = useParams<{ appId: string }>();

  const [q, setQ] = React.useState("");
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<string>("");
  const selected = React.useMemo(
    () => campaigns.find(c => String(c.id ?? "") === String(selectedId)),
    [campaigns, selectedId]
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // composer
  const [title, setTitle] = React.useState("");
  const [segment, setSegment] = React.useState("all");
  const [text, setText] = React.useState("");
  const [btnText, setBtnText] = React.useState("");
  const [btnUrl, setBtnUrl] = React.useState("");

  const filtered = React.useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return campaigns;
    return campaigns.filter(c => {
      const s = `${c.title || ""} ${c.segment || ""} ${c.text || ""}`.toLowerCase();
      return s.includes(v);
    });
  }, [campaigns, q]);

  const kpi = React.useMemo(() => {
    const list = campaigns;
    const sent = sumNum(list, "sent");
    const delivered = sumNum(list, "delivered");
    const failed = sumNum(list, "failed");
    const opened = sumNum(list, "opened");
    const total = list.length;

    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
    const failRate = sent > 0 ? Math.round((failed / sent) * 100) : 0;
    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;

    return { total, sent, delivered, failed, opened, deliveryRate, failRate, openRate };
  }, [campaigns]);

  const load = React.useCallback(async () => {
    if (!appId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch<any>(
        `/api/cabinet/apps/${encodeURIComponent(appId)}/broadcasts/campaigns`
      );
      const items = data?.items || data?.campaigns || data?.data || [];
      const list = Array.isArray(items) ? items : [];
      setCampaigns(list);

      // auto-select first
      if (!selectedId && list[0]?.id != null) setSelectedId(String(list[0].id));
    } catch (e: any) {
      setCampaigns([]);
      setErr(e?.message || "Ошибка загрузки рассылок");
    } finally {
      setLoading(false);
    }
  }, [appId, selectedId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setTitle("");
    setSegment("all");
    setText("");
    setBtnText("");
    setBtnUrl("");
    setDrawerOpen(true);
  }

  async function send() {
    if (!appId) return;
    const bodyText = text.trim();
    if (!bodyText) return;

    setSending(true);
    try {
      await apiFetch<any>(
        `/api/cabinet/apps/${encodeURIComponent(appId)}/broadcasts/send`,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim() || "Рассылка",
            segment: segment || "all",
            text: bodyText,
            btn_text: btnText.trim() || undefined,
            btn_url: btnUrl.trim() || undefined,
          }),
        }
      );

      setDrawerOpen(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Broadcasts</div>
          <div className="text-sm opacity-70">Кампании, рассылки и KPI</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="rounded-xl border bg-white/60 px-3 py-2 text-sm hover:bg-white/80"
          >
            Обновить
          </button>
          <button
            onClick={openCreate}
            className="rounded-xl border bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white"
          >
            Создать рассылку
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-4">
        {/* Left: list */}
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-3">
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по кампаниям…"
              className="w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            <button
              onClick={() => setQ("")}
              className="rounded-xl border bg-white/60 px-3 py-2 text-sm hover:bg-white/80"
              title="Очистить"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 text-xs opacity-70 flex items-center justify-between">
            <div>{loading ? "Загрузка…" : `${filtered.length} кампаний`}</div>
            {err ? <div className="text-red-600">{err}</div> : <div />}
          </div>

          <div className="mt-3 max-h-[70vh] overflow-auto rounded-xl">
            {filtered.length === 0 && !loading ? (
              <div className="p-4 text-sm opacity-70">Кампаний нет. Нажми “Создать рассылку”.</div>
            ) : (
              <div className="divide-y">
                {filtered.map((c) => {
                  const id = String(c.id ?? "");
                  const active = id && id === selectedId;
                  const created = c.created_at || c.ts;
                  const badge = (c.status || (c.sent ? "sent" : "draft")).toLowerCase();

                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className={cx(
                        "w-full text-left p-3 hover:bg-white/70",
                        active ? "bg-white/90" : "bg-transparent"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate font-medium">{c.title || "Рассылка"}</div>
                            <span className="ml-auto text-[11px] rounded-full border bg-white px-2 py-0.5">
                              {badge}
                            </span>
                          </div>
                          <div className="mt-1 text-xs opacity-70 truncate">
                            {c.segment ? `Сегмент: ${c.segment}` : "Сегмент: all"}
                            {created ? ` • ${formatWhen(created)}` : ""}
                          </div>
                          {c.text ? <div className="mt-2 text-sm opacity-80">{clampText(c.text, 140)}</div> : null}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                        <div className="rounded-xl border bg-white/70 px-2 py-1">
                          <div className="opacity-70">sent</div>
                          <div className="font-semibold">{Number(c.sent) || 0}</div>
                        </div>
                        <div className="rounded-xl border bg-white/70 px-2 py-1">
                          <div className="opacity-70">deliv</div>
                          <div className="font-semibold">{Number(c.delivered) || 0}</div>
                        </div>
                        <div className="rounded-xl border bg-white/70 px-2 py-1">
                          <div className="opacity-70">fail</div>
                          <div className="font-semibold">{Number(c.failed) || 0}</div>
                        </div>
                        <div className="rounded-xl border bg-white/70 px-2 py-1">
                          <div className="opacity-70">open</div>
                          <div className="font-semibold">{Number(c.opened) || 0}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: KPI panel always visible */}
        <div className="rounded-2xl border bg-white/60 backdrop-blur p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">KPI</div>
              <div className="text-xs opacity-70">Сводка по всем рассылкам (и выбранной ниже)</div>
            </div>
            <button
              onClick={openCreate}
              className="rounded-xl border bg-white/80 px-3 py-2 text-sm font-medium hover:bg-white"
            >
              + Новая
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Campaigns</div>
              <div className="text-lg font-semibold">{kpi.total}</div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Sent</div>
              <div className="text-lg font-semibold">{kpi.sent}</div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Delivered</div>
              <div className="text-lg font-semibold">{kpi.delivered}</div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Failed</div>
              <div className="text-lg font-semibold">{kpi.failed}</div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Delivery rate</div>
              <div className="text-lg font-semibold">{kpi.deliveryRate}%</div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Fail rate</div>
              <div className="text-lg font-semibold">{kpi.failRate}%</div>
            </div>
            <div className="rounded-2xl border bg-white/70 p-3">
              <div className="text-xs opacity-70">Open rate</div>
              <div className="text-lg font-semibold">{kpi.openRate}%</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-white/70 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Выбранная кампания</div>
              <div className="text-xs opacity-70">{selected?.created_at || selected?.ts ? formatWhen(selected.created_at || selected.ts) : ""}</div>
            </div>

            {!selected ? (
              <div className="mt-2 text-sm opacity-70">Выбери кампанию слева — тут будет детальная карточка.</div>
            ) : (
              <div className="mt-2">
                <div className="text-base font-semibold">{selected.title || "Рассылка"}</div>
                <div className="mt-1 text-xs opacity-70">Сегмент: {selected.segment || "all"} • статус: {(selected.status || "sent").toLowerCase()}</div>
                {selected.text ? <div className="mt-2 text-sm opacity-80 whitespace-pre-wrap">{selected.text}</div> : null}

                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl border bg-white/80 px-2 py-1">
                    <div className="opacity-70">sent</div>
                    <div className="font-semibold">{Number(selected.sent) || 0}</div>
                  </div>
                  <div className="rounded-xl border bg-white/80 px-2 py-1">
                    <div className="opacity-70">deliv</div>
                    <div className="font-semibold">{Number(selected.delivered) || 0}</div>
                  </div>
                  <div className="rounded-xl border bg-white/80 px-2 py-1">
                    <div className="opacity-70">fail</div>
                    <div className="font-semibold">{Number(selected.failed) || 0}</div>
                  </div>
                  <div className="rounded-xl border bg-white/80 px-2 py-1">
                    <div className="opacity-70">open</div>
                    <div className="font-semibold">{Number(selected.opened) || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* little “activity” placeholder (потом подключишь live/log) */}
          <div className="mt-3 rounded-2xl border bg-white/70 p-3">
            <div className="text-sm font-semibold">Live / Events</div>
            <div className="mt-1 text-sm opacity-70">
              Тут можно позже показать “последние доставки/ошибки” (как в старом), но KPI уже работает без этого.
            </div>
          </div>
        </div>
      </div>

      {/* Drawer composer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => !sending && setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white/85 backdrop-blur border-l shadow-2xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Новая рассылка</div>
                <div className="text-sm opacity-70">Сначала текст, потом отправка</div>
              </div>
              <button
                onClick={() => !sending && setDrawerOpen(false)}
                className="rounded-xl border bg-white/70 px-3 py-2 text-sm hover:bg-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 flex-1 overflow-auto">
              <div>
                <div className="text-xs opacity-70 mb-1">Заголовок</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Скидка на кофе сегодня"
                  className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>

              <div>
                <div className="text-xs opacity-70 mb-1">Сегмент</div>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                >
                  <option value="all">all</option>
                  <option value="active_7d">active_7d</option>
                  <option value="inactive_30d">inactive_30d</option>
                  <option value="vip">vip</option>
                </select>
                <div className="mt-1 text-[11px] opacity-60">
                  Сегменты можно расширить позже (как ты хотел — конструктор сегментов).
                </div>
              </div>

              <div>
                <div className="text-xs opacity-70 mb-1">Текст</div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder="Сообщение…"
                  className="w-full resize-none rounded-xl border bg-white/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <div className="text-xs opacity-70 mb-1">Кнопка — текст</div>
                  <input
                    value={btnText}
                    onChange={(e) => setBtnText(e.target.value)}
                    placeholder="Например: Открыть меню"
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Кнопка — URL</div>
                  <input
                    value={btnUrl}
                    onChange={(e) => setBtnUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-xl border bg-white/90 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-white/70 p-3">
                <div className="text-sm font-semibold">Превью</div>
                <div className="mt-1 text-sm opacity-80 whitespace-pre-wrap">{text.trim() ? text : "—"}</div>
                {(btnText.trim() || btnUrl.trim()) ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-xl border bg-white/80 px-3 py-2 text-sm">
                    <span className="font-medium">{btnText.trim() || "Кнопка"}</span>
                    <span className="text-xs opacity-60">{btnUrl.trim() || "URL"}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setDrawerOpen(false)}
                disabled={sending}
                className="rounded-xl border bg-white/70 px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => void send()}
                disabled={sending || !text.trim()}
                className="ml-auto rounded-xl border bg-white/90 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
              >
                {sending ? "Отправка…" : "Отправить"}
              </button>
            </div>

            {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
