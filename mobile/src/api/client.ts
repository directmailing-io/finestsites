import { API_BASE, APP_VERSION, BUILD_NUMBER, CLIENT, MOCK } from '@/lib/config';

import type { ApiErrorBody } from './types';

/**
 * Netzwerk-Schicht der App.
 *
 * - Niemals Cookies: `credentials: 'omit'`. iOS speichert Cookies sonst automatisch, und
 *   BetterAuth lehnt dann Aktionen ohne Origin ab (Fund aus dem Gegencheck).
 * - Anmeldung nur über `Authorization: Bearer <token>` (BetterAuth bearer-Plugin).
 * - Jede Anfrage trägt X-FS-Client und X-App-Version, damit der Server App-Modus und
 *   Mindestversion erkennt.
 * - Im Mock-Modus beantwortet `mockFetch` alles aus Beispieldaten im Speicher.
 */

export class ApiError extends Error {
  status: number;
  code: string | null;
  /** Feld → Hinweis (VALIDATION_FAILED der App-Routen), sonst null. */
  fields: Record<string, string> | null;
  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? body?.error ?? `HTTP ${status}`);
    this.status = status;
    this.code = body?.code ?? null;
    this.fields = body?.fields ?? null;
  }
}

export class NetworkError extends Error {
  constructor(public readonly timeout: boolean) {
    super(timeout ? 'timeout' : 'network');
  }
}

let bearerToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let onTokenRotated: ((token: string) => void) | null = null;

export function setBearerToken(token: string | null) {
  bearerToken = token;
}
export function getBearerToken() {
  return bearerToken;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}
/** BetterAuth kann bei Anmelde-Routen ein neues Token im Header `set-auth-token` liefern. */
export function setTokenRotatedHandler(fn: ((token: string) => void) | null) {
  onTokenRotated = fn;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  /** Anmelde-Routen: 401 dort heißt „falsches Passwort“, nicht „abgemeldet“. */
  skipAuthHandling?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function baseHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'X-FS-Client': CLIENT,
    'X-App-Version': `${APP_VERSION} (${BUILD_NUMBER})`,
  };
  if (bearerToken) h.Authorization = `Bearer ${bearerToken}`;
  return h;
}

/** Rohe Antwort (z. B. um den Header `set-auth-token` beim Anmelden zu lesen). */
export async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const url = buildUrl(path, opts.query);
  const headers = baseHeaders();
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  if (MOCK) {
    const { mockFetch } = await import('./mock/server');
    return mockFetch(url, { method: opts.method ?? 'GET', headers, body });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body,
      credentials: 'omit',
      signal: controller.signal,
    });
    const rotated = res.headers.get('set-auth-token');
    if (rotated && bearerToken && rotated !== bearerToken && !opts.skipAuthHandling) {
      bearerToken = rotated;
      onTokenRotated?.(rotated);
    }
    return res;
  } catch (err) {
    throw new NetworkError(err instanceof Error && err.name === 'AbortError');
  } finally {
    clearTimeout(timer);
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, opts);
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    if (res.status === 401 && !opts.skipAuthHandling) onUnauthorized?.();
    throw new ApiError(res.status, (data as ApiErrorBody) ?? null);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};

/** Fehlertext für Menschen (deutsch, du-Form). Server-Texte werden nie direkt gezeigt. */
export function humanError(err: unknown): string {
  if (err instanceof NetworkError) {
    return err.timeout
      ? 'Zeitüberschreitung. Bitte versuche es erneut.'
      : 'Verbindungsfehler. Bitte prüfe deine Internetverbindung.';
  }
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Bitte melde dich erneut an.';
    if (err.status === 404) return 'Das gibt es nicht mehr.';
    if (err.status === 429) return 'Zu viele Versuche. Bitte warte kurz.';
  }
  return 'Das hat leider nicht geklappt. Bitte versuche es nochmal.';
}
