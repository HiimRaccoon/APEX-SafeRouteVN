import { describe, expect, it, vi } from "vitest";
import { Member3Client } from "./client";
import { Member3Error } from "./errors";

function response(data: unknown, status = 200, diagnostics: unknown[] = []) {
  return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace-1",
    status: status < 400 ? "OK" : "ERROR", data, diagnostics }), { status });
}

describe("M3 HTTP boundary", () => {
  it("unwraps data and sends bearer only to the configured server", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ scenarios: [{ scenario_id: "S1" }] }));
    const client = new Member3Client({ baseUrl: "http://127.0.0.1:8000/", token: () => "test-only-bearer", fetch: fetcher });
    expect(await client.scenarios()).toEqual({ scenarios: [{ scenario_id: "S1" }] });
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8000/api/scenarios", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer test-only-bearer" }), redirect: "error", cache: "no-store"
    }));
  });

  it("sends the same request ID when a load is retried", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ session: { session_id: "server-session" } }, 201));
    const client = new Member3Client({ token: () => "test-only-bearer", fetch: fetcher });
    await client.loadScenario("S1", "load-stable-id");
    await client.loadScenario("S1", "load-stable-id");
    expect(fetcher.mock.calls.map(([, options]) => options?.body)).toEqual([
      '{"request_id":"load-stable-id"}', '{"request_id":"load-stable-id"}'
    ]);
  });

  it("exposes backend code, trace and diagnostics without swallowing 401", async () => {
    const diagnostics = [{ code: "UNAUTHORIZED", path: "authentication", message: "Valid bearer token required", severity: "ERROR" }];
    const client = new Member3Client({ token: () => "test-only-bearer", fetch: async () => response(null, 401, diagnostics) });
    await expect(client.scenarios()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401, requestId: "trace-1", diagnostics });
  });

  it("allows anonymous readiness but refuses authenticated reads without a token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ ready: true }));
    const client = new Member3Client({ token: () => null, fetch: fetcher });
    expect(await client.ready()).toEqual({ ready: true });
    await expect(client.scenarios()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects non-M3 responses and maps network errors without exposing credentials", async () => {
    const invalid = new Member3Client({ token: () => "test-only-bearer", fetch: async () => new Response('{"data":{}}') });
    await expect(invalid.scenarios()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    const offline = new Member3Client({ token: () => "secret", fetch: async () => { throw new Error("secret socket detail"); } });
    await expect(offline.scenarios()).rejects.toBeInstanceOf(Member3Error);
    await expect(offline.scenarios()).rejects.toMatchObject({ code: "NETWORK_ERROR", message: expect.not.stringContaining("secret") });
  });
});
