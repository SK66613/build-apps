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
