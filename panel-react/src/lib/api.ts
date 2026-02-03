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
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let j: any = null;
  try { j = await r.json(); } catch(_){ }

  if (!r.ok || (j && j.ok === false)) {
    const err: ApiError = {
      status: r.status,
      message: (j && (j.error || j.message)) ? String(j.error || j.message) : `HTTP ${r.status}`,
      payload: j,
    };
    throw err;
  }

  return j as T;
}
