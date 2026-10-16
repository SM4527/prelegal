export interface Credentials {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
}

/** A non-2xx response from the backend, carrying FastAPI's `detail` message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the same-origin FastAPI backend under /api and parses the JSON response. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  return res.json();
}

/** FastAPI's string `detail`, else the status text (for 422 detail lists or non-JSON error pages). */
async function errorMessage(res: Response): Promise<string> {
  const detail = await res.json().then((body) => body?.detail, () => undefined);
  return typeof detail === "string" ? detail : res.statusText || `Request failed (${res.status})`;
}

const post = <T>(path: string, data?: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });

export const auth = {
  signup: (credentials: Credentials) => post<User>("/auth/signup", credentials),
  signin: (credentials: Credentials) => post<User>("/auth/signin", credentials),
  signout: () => post<void>("/auth/signout"),
  me: () => apiFetch<User>("/auth/me"),
};
