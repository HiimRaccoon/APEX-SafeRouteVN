import { Member3Error } from "./errors";
import type { M3Capabilities, M3Catalog, M3Envelope, M3ExecutionView, M3LoadedSession, M3LocationsView, M3OrdersView, M3Ready, M3VehiclesView } from "./types";

export const M3_TOKEN_KEY = "saferoute.member3.bearer";
export interface Member3ClientOptions { baseUrl?: string; token?: () => string | null; fetch?: typeof fetch }

function browserToken(): string | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage.getItem(M3_TOKEN_KEY); }
  catch { return null; }
}

/** Only talks to the configured M3 origin; never redirects bearer credentials or falls back to fixtures. */
export class Member3Client {
  readonly baseUrl: string;
  private readonly token: () => string | null;
  private readonly fetcher: typeof fetch;
  constructor(options: Member3ClientOptions = {}) {
    const url = new URL(options.baseUrl ?? "http://127.0.0.1:8000");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Member3Error("INVALID_CONFIG", "M3 base URL must be an HTTP(S) server URL without credentials.");
    }
    this.baseUrl = url.href.replace(/\/$/, "");
    this.token = options.token ?? browserToken;
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  ready() { return this.request<M3Ready>("/ready", false); }
  capabilities() { return this.request<M3Capabilities>("/api/runtime/capabilities"); }
  scenarios() { return this.request<M3Catalog>("/api/scenarios"); }
  loadScenario(id: string, requestId: string) {
    return this.request<M3LoadedSession>(`/api/scenarios/${encodeURIComponent(id)}/load`, true, { request_id: requestId });
  }
  state(id: string) { return this.request<M3ExecutionView>(`/api/sessions/${encodeURIComponent(id)}/state`); }
  orders(id: string) { return this.request<M3OrdersView>(`/api/sessions/${encodeURIComponent(id)}/orders`); }
  vehicles(id: string) { return this.request<M3VehiclesView>(`/api/sessions/${encodeURIComponent(id)}/vehicles`); }
  locations(id: string) { return this.request<M3LocationsView>(`/api/sessions/${encodeURIComponent(id)}/locations`); }

  private async request<T>(path: string, authenticated = true, body?: { request_id: string }): Promise<T> {
    const token = authenticated ? this.token()?.trim() : null;
    if (authenticated && !token) throw new Member3Error("AUTH_REQUIRED", "M3 bearer token required. Configure the token for this browser session.");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined,
        cache: "no-store", redirect: "error", credentials: "omit", signal: AbortSignal.timeout(125000)
      });
    } catch {
      throw new Member3Error("NETWORK_ERROR", "Cannot reach M3. Check backend readiness, base URL and CORS.");
    }
    let value: M3Envelope<T>;
    try {
      value = await response.json();
      if (!value || value.schema_version !== "saferoute-m3-http-response/1" || typeof value.request_id !== "string" ||
          !["OK", "ERROR"].includes(value.status) || !Array.isArray(value.diagnostics) ||
          value.diagnostics.some((item) => !item || typeof item.code !== "string" || typeof item.message !== "string")) throw new Error();
    } catch {
      throw new Member3Error("INVALID_RESPONSE", "M3 returned an invalid HTTP response envelope.", response.status);
    }
    if (!response.ok || value.status !== "OK") {
      const first = value.diagnostics[0];
      throw new Member3Error(first?.code ?? "HTTP_ERROR", first?.message ?? "M3 request failed.", response.status, value.request_id, value.diagnostics);
    }
    if (value.data === null || typeof value.data !== "object" || Array.isArray(value.data)) {
      throw new Member3Error("INVALID_RESPONSE", "M3 response data is missing.", response.status, value.request_id);
    }
    return value.data;
  }
}
