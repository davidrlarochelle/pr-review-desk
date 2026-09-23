export const apiBase = import.meta.env.VITE_API_URL || "";

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || res.statusText;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return parseResponse<T>(res);
}
