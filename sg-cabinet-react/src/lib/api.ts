export type ApiError = {
  status: number;
  message: string;
  payload?: any;
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : path;

  const r = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers || {}),
      // content-type ставим только если есть body
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });

  const text = await r.text();
  let j: any = null;

  try{
    j = text ? JSON.parse(text) : null;
  }catch(_){
    // не JSON — оставим text
  }

  if (!r.ok || (j && j.ok === false)) {
    const err: ApiError = {
      status: r.status,
      message:
        (j && (j.error || j.message))
          ? String(j.error || j.message)
          : (text || `HTTP ${r.status}`),
      payload: j || text,
    };
    throw err;
  }

  return (j !== null ? j : (text as any)) as T;
}

function qs(obj: Record<string, any>){
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj || {})){
    if (v === undefined || v === null) continue;
    const s = String(v);
    if (!s) continue;
    p.set(k, s);
  }
  return p.toString();
}

/**
 * Typed API wrapper used by *Page.tsx routes.
 * Endpoints are aligned with your existing worker routes used in the older (non-Page) screens.
 */
export const api = {
  auth: {
    me: () => apiFetch<any>('/api/auth/me'),
    login: (email: string, password: string) =>
      apiFetch<any>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => apiFetch<any>('/api/auth/logout', { method: 'POST' }),
  },

  apps: {
    list: () => apiFetch<{ ok?: boolean; apps: any[] }>('/api/apps'),
  },

  dashboard: {
    summary: (appId: string, range: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/summary?${qs(range)}`),
    activity: (appId: string, opts: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/activity?${qs(opts)}`),
  },

  customers: {
    list: (appId: string, opts: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/customers?${qs(opts)}`),
  },

  sales: {
    stats: (appId: string, opts: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/sales/stats?${qs(opts)}`),
  },

  wheel: {
    stats: (appId: string, range: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/wheel/stats?${qs(range)}`),
    prizes: (appId: string) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/wheel/prizes`),
  },

  passport: {
    stats: (appId: string, range: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/passport/stats?${qs(range)}`),
  },

  calendar: {
    overview: (appId: string, range: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/calendar/bookings?${qs(range)}`),
  },

  profit: {
    report: (appId: string, range: any) =>
      apiFetch<any>(`/api/cabinet/apps/${encodeURIComponent(appId)}/profit/report?${qs(range)}`),
  },
};
