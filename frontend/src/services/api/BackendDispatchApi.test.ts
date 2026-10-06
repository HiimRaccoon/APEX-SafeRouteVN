import { describe, expect, it, vi } from "vitest";
import { BackendDispatchApi } from "./BackendDispatchApi";
import { Member3Client } from "../../integrations/member3/client";
import { createMapScene } from "../../shared/components/mapScene";
import type { M3Vehicle, M3Projection, M3OrdersView } from "../../integrations/member3/types";
import { comparison } from "../../integrations/member3/testFixtures";

// Contract-shaped HTTP data, deliberately unrelated to frontend fixture IDs/coordinates.
function server() {
  const basis = { session_id: "m3-owned-session", build_sha256: "b".repeat(64), head_version: "2", generation: "0",
    root_sha256: "1".repeat(64), head_sha256: "2".repeat(64), source_sha256: "3".repeat(64), context_version: "context-1", overlay_sha256: null };
  const time = "2026-09-27T21:13:00+07:00";
  const physicalVehicle: M3Vehicle = { vehicle_id: "M3-V1", availability: "AVAILABLE", capacity_kg: 20, current_load_kg: 0,
    onboard_order_ids: [], remaining_range_m: 90000, position: { kind: "AT_NODE", node_id: "9007199254740993", coordinates: [106.72, 10.82], position_source: "SIMULATED" },
    position_timestamp: time, planned_suffix: [], activity: "IDLE" };
  const state = { schema_version: "task02-m2-execution-view/2", basis, current_time: time, execution_mode: "SIMULATED_REPLAY",
    real_world_observation: false, metric_scope: "OBSERVED_PREFIX_ONLY", order_ids: ["M3-O1"], delivered_prefix: [], planned_served_suffix: [],
    unserved: [{ order_id: "M3-O1", reason: "NO_ACCEPTED_PLAN" }], vehicles: [physicalVehicle], pending_event_ids: [], active_job_id: null,
    observed_metrics: null, planned_suffix_metrics: null, projected_whole_metrics: null, accepted_trajectory: null };
  const base: Omit<M3Projection, "schema_version"> = { basis, current_time: time, execution_mode: "SIMULATED_REPLAY", real_world_observation: false,
    units: { distance: "m", duration: "s", mass: "kg", money: "VND" } };
  const orders: M3OrdersView = { ...base, schema_version: "saferoute-m3-orders-view/1", orders: [{ order_id: "M3-O1", status: "WAITING", owner_vehicle_id: null,
    planned_in_accepted_suffix: false, unserved_reason: "NO_ACCEPTED_PLAN", demand_kg: 7, priority: 2, pickup_location_id: "M3-DEPOT", delivery_region_id: "M3-region",
    graph_node_id: "9007199254740993", coordinates: [106.73, 10.83], service_time_s: 900, earliest: time, preferred_due: time, hard_deadline: time }] };
  const vehicles = { ...base, schema_version: "saferoute-m3-vehicles-view/1", vehicles: [physicalVehicle], vehicle_metadata: [{ vehicle_id: "M3-V1",
    vehicle_type: "motorcycle", cost_per_km_vnd: 2300, range_m: 100000, working_start: time, working_end: time }] };
  const locations = { ...base, schema_version: "saferoute-m3-locations-view/1", locations: [
    { location_id: "M3-DEPOT", kind: "DEPOT", graph_node_id: "1", coordinates: [106.72, 10.82], opening_time: time, closing_time: time },
    { location_id: "delivery:M3-O1", kind: "DELIVERY", order_id: "M3-O1", graph_node_id: "9007199254740993", coordinates: [106.73, 10.83] }
  ] };
  const requests: { path: string; method: string; body: unknown }[] = [];
  const capabilities = { schema_version: "task02-m2-runtime-capabilities/1", build_sha256: basis.build_sha256 };
  const fetcher: typeof fetch = async (url, options) => {
    const path = new URL(String(url)).pathname;
    requests.push({ path, method: options?.method ?? "GET", body: options?.body ? JSON.parse(String(options.body)) : null });
    const data = path === "/ready" ? { ready: true } : path.endsWith("/capabilities") ? capabilities
      : path === "/api/scenarios" ? { schema_version: "saferoute-m3-scenario-catalog/1", execution_mode: "SIMULATED_REPLAY", real_world_observation: false,
          scenarios: ["S0", "S1"].map((scenario_id) => ({ scenario_id, fixture_sha256: "f".repeat(64), initial_time: time, order_count: 1, vehicle_count: 1 })), catalog_sha256: "c".repeat(64) }
      : path.endsWith("/load") ? { schema_version: "saferoute-m3-loaded-session/1", session: { session_id: basis.session_id,
          scenario_id: path.split("/")[3], build_sha256: basis.build_sha256, catalog_sha256: "c".repeat(64), fixture_sha256: "f".repeat(64) }, execution_view: state }
      : path.endsWith("/orders") ? orders : path.endsWith("/vehicles") ? vehicles : path.endsWith("/locations") ? locations : state;
    return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", status: "OK", request_id: "trace-1", data, diagnostics: [] }));
  };
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const client = new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" });
  return { client, storage, requests, values, state, orders, vehicles, locations, fetcher, capabilities };
}

describe("BackendDispatchApi foundation", () => {
  it("gives a session mutation priority over coalesced periodic reads and fences the late reply", async () => {
    vi.useFakeTimers();
    try {
      const s = server(); let hold = false, release!: () => void, pollSignal!: AbortSignal;
      const fetcher: typeof fetch = async (url, options) => {
        if (hold && String(url).endsWith("/state")) { hold = false; pollSignal = options!.signal!;
          await new Promise<void>(resolve => { release = resolve; }); }
        return s.fetcher(url, options);
      };
      const api = new BackendDispatchApi({ client: new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" }), storage: s.storage });
      await api.loadScenario("S1"); const published: string[] = []; const unsub = api.subscribe(next => published.push(next.decisionState.scenarioId));
      hold = true; await vi.advanceTimersByTimeAsync(2500);
      const next = api.loadScenario("S0"); expect(pollSignal.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(10000);
      expect(s.requests.filter(r => r.path.endsWith("/load"))).toHaveLength(1);
      release(); expect((await next).decisionState.scenarioId).toBe("S0");
      expect(published).toEqual(["S0"]); unsub();
      const readCount = s.requests.length; await vi.advanceTimersByTimeAsync(10000); expect(s.requests).toHaveLength(readCount);
    } finally { vi.useRealTimers(); }
  });
  it("definite STALE_HEAD refreshes world and permits a new explicit intent", async () => {
    const s = server(); let rejected = true; const posts: string[] = [];
    const fetcher: typeof fetch = async (url, options) => {
      if (String(url).endsWith("/profiles/compare")) {
        posts.push(options!.body as string);
        if (rejected) { rejected = false; s.state.basis.generation = "1";
          return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "ERROR", data: null, diagnostics: [{ code: "STALE_HEAD", path: "compare", message: "World changed" }] }), { status: 409 }); }
        const receipt = { schema_version: "saferoute-m3-profile-submission/1", session_id: s.state.basis.session_id, comparison_id: "comparison-new", mode: "NEW_BATCH", input_basis: s.state.basis, profiles: ["FASTEST", "BALANCED", "SAFER"], links: { poll: "/poll", cancel: "/cancel" } };
        return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "OK", data: receipt, diagnostics: [] }));
      }
      return s.fetcher(url, options);
    };
    const api = new BackendDispatchApi({ client: new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" }), storage: s.storage }); await api.loadScenario("S1");
    await expect(api.optimize()).rejects.toMatchObject({ code: "STALE_HEAD" });
    expect((await api.getSnapshot()).backend?.basis.generation).toBe("1"); expect(posts).toHaveLength(1);
    await api.optimize(); expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[1]).request_id).not.toBe(JSON.parse(posts[0]).request_id);
    expect(JSON.parse(posts[1]).expected_revision.generation).toBe("1");
  });
  it("does not submit an undurable intent after storage fails then Refresh", async () => {
    const s = server(); let failedWrites = 0, posts = 0;
    const storage = { getItem: s.storage.getItem, setItem: (k: string, v: string) => { if (k.includes("command.v1")) { failedWrites++; throw new Error("Storage unavailable"); } s.storage.setItem(k, v); } };
    const fetcher: typeof fetch = async (url, options) => { if (String(url).endsWith("/profiles/compare")) { posts++; throw new Error("Must not submit"); } return s.fetcher(url, options); };
    const api = new BackendDispatchApi({ client: new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" }), storage }); await api.loadScenario("S1");
    await expect(api.optimize()).rejects.toThrow();
    await api.getSnapshot().catch(() => {});
    expect(failedWrites).toBeGreaterThan(0); expect(posts).toBe(0);
  });
  it("retains the same recovery ID when comparison pointer persistence fails", async () => {
    const s = server(); let failPointer = true; const posts: string[] = [];
    const storage = { getItem: s.storage.getItem, setItem: (k: string, v: string) => { if (failPointer && k.includes("session.v1") && JSON.parse(v).comparison) throw new Error("Pointer unavailable"); s.storage.setItem(k, v); } };
    const receipt = { schema_version: "saferoute-m3-profile-submission/1", session_id: s.state.basis.session_id, comparison_id: "comparison-stable", mode: "NEW_BATCH", input_basis: s.state.basis, profiles: ["FASTEST", "BALANCED", "SAFER"], links: { poll: "/poll", cancel: "/cancel" } };
    const fetcher: typeof fetch = async (url, options) => {
      if (String(url).endsWith("/profiles/compare")) { posts.push(options!.body as string); return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "OK", data: receipt, diagnostics: [] })); }
      return s.fetcher(url, options);
    };
    const client = new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" });
    const api = new BackendDispatchApi({ client, storage }); await api.loadScenario("S1");
    await expect(api.optimize()).rejects.toThrow(); failPointer = false;
    const next = await new BackendDispatchApi({ client, storage }).getSnapshot();
    expect(posts).toHaveLength(2); expect(posts[1]).toBe(posts[0]); expect(next.backend?.comparison?.comparison_id).toBe("comparison-stable");
  });
  it.each([[401, "UNAUTHORIZED"], [403, "FORBIDDEN"], [409, "IDEMPOTENCY_CONFLICT"]])("fails closed for %s/%s and retains the exact intent", async (status, code) => {
    const s = server(); const posts: string[] = [];
    const fetcher: typeof fetch = async (url, options) => {
      if (String(url).endsWith("/profiles/compare")) { posts.push(options!.body as string); return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "ERROR", data: null, diagnostics: [{ severity: "ERROR", code, path: "compare", message: "Rejected" }] }), { status: status as number }); }
      return s.fetcher(url, options);
    };
    const api = new BackendDispatchApi({ client: new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" }), storage: s.storage }); await api.loadScenario("S1");
    await expect(api.optimize()).rejects.toMatchObject({ code });
    await expect(api.getSnapshot()).rejects.toMatchObject({ code });
    expect(posts).toHaveLength(2); expect(posts[1]).toBe(posts[0]);
    await expect(api.loadScenario("S0")).rejects.toMatchObject({ code: "PENDING_COMMAND" });
  });
  it("retries BUSY with bounded backoff and the same body", async () => {
    vi.useFakeTimers();
    try {
      const s = server(); let posts = 0; const bodies: string[] = [];
      const fetcher: typeof fetch = async (url, options) => {
        if (String(url).endsWith("/profiles/compare")) { posts++; bodies.push(options!.body as string); return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "ERROR", data: null, diagnostics: [{ severity: "ERROR", code: "RUNTIME_BUSY", path: "compare", message: "Busy" }] }), { status: 503 }); }
        return s.fetcher(url, options);
      };
      const api = new BackendDispatchApi({ client: new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" }), storage: s.storage }); await api.loadScenario("S1");
      const failed = expect(api.optimize()).rejects.toMatchObject({ code: "RUNTIME_BUSY" });
      await vi.advanceTimersByTimeAsync(7001); await failed;
      expect(posts).toBe(4); expect(new Set(bodies).size).toBe(1);
    } finally { vi.useRealTimers(); }
  });
  it("compare_submits_current_revision_once and survives lost reply/refresh", async () => {
    const s = server(); const posts: string[] = []; let lose = true;
    const receipt = { schema_version: "saferoute-m3-profile-submission/1", session_id: s.state.basis.session_id, comparison_id: "comparison-test", mode: "NEW_BATCH", input_basis: s.state.basis, profiles: ["FASTEST", "BALANCED", "SAFER"], links: { poll: "/poll", cancel: "/cancel" } };
    const fetcher: typeof fetch = async (url, options) => {
      if (String(url).endsWith("/profiles/compare")) { posts.push(options!.body as string); if (lose) { lose = false; throw new TypeError("Lost reply"); }
        return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "OK", data: receipt, diagnostics: [] }), { status: 202 }); }
      return s.fetcher(url, options);
    };
    const client = new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" });
    const api = new BackendDispatchApi({ client, storage: s.storage }); await api.loadScenario("S1");
    await expect(api.optimize()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    const next = await new BackendDispatchApi({ client, storage: s.storage }).getSnapshot();
    expect(posts).toHaveLength(2); expect(posts[1]).toBe(posts[0]);
    expect(JSON.parse(posts[0])).toMatchObject({ expected_revision: { head_version: "2", generation: "0" } });
    expect(JSON.parse(posts[0])).not.toHaveProperty("job_ids");
    expect(next.backend?.comparison).toMatchObject({ comparison_id: "comparison-test", status: "QUEUED" });
    expect(next.planState.proposedAlternatives).toEqual([]); expect(next.backend?.basis).toEqual(s.state.basis);
  });
  it("publishes bound lifecycle and preserves registry on fresh world reads", async () => {
    const s = server(); const c = comparison(); c.session_id = s.state.basis.session_id; c.input_basis = { ...s.state.basis };
    for (const j of c.jobs) j.view.input_basis = { ...s.state.basis };
    for (const j of c.outcome.comparison.jobs) j.basis = { ...s.state.basis };
    const receipt = { schema_version: "saferoute-m3-profile-submission/1", session_id: c.session_id, comparison_id: c.comparison_id, mode: "NEW_BATCH", input_basis: c.input_basis, profiles: ["FASTEST", "BALANCED", "SAFER"], links: c.links };
    const fetcher: typeof fetch = async (url, options) => {
      const path = new URL(String(url)).pathname;
      if (path.includes("/profiles/")) return new Response(JSON.stringify({ schema_version: "saferoute-m3-http-response/1", request_id: "trace", status: "OK", data: path.endsWith("/compare") ? receipt : c, diagnostics: [] }));
      return s.fetcher(url, options);
    };
    const api = new BackendDispatchApi({ client: new Member3Client({ fetch: fetcher, token: () => "test-only-bearer" }), storage: s.storage });
    await api.loadScenario("S1"); await api.optimize();
    const refreshed = await api.getSnapshot();
    expect(refreshed.backend?.comparison?.status).toBe("COMPLETED");
    expect(Object.keys(refreshed.backend?.jobs ?? {})).toHaveLength(3);
    s.state.basis.generation = "1";
    const newer = await api.getSnapshot(); expect(newer.backend?.comparison?.input_basis.generation).toBe("0");
    expect(newer.backend?.basis.generation).toBe("1");
  });
  it("renders server-owned world, preserving IDs, units, depot/delivery kinds and empty plans", async () => {
    const s = server();
    const api = new BackendDispatchApi({ client: s.client, storage: s.storage });
    const snapshots: unknown[] = [];
    api.subscribe((snapshot) => snapshots.push(snapshot));
    const snapshot = await api.loadScenario("S1");
    expect(snapshot.decisionState).toMatchObject({ sessionId: "m3-owned-session", scenarioId: "S1", version: 0 });
    expect(snapshot.decisionState.orders[0]).toMatchObject({ id: "M3-O1", latitude: 10.83, longitude: 106.73, demandKg: 7,
      status: "WAITING", assignedVehicleId: null, serviceTimeHours: 0.25, graphNodeId: "9007199254740993", pickedUpAt: null, deliveredAt: null });
    expect(snapshot.decisionState.vehicles[0]).toMatchObject({ id: "M3-V1", capacityKg: 20, currentPosition: { latitude: 10.82, longitude: 106.72, graphNodeId: "9007199254740993" } });
    expect(snapshot.decisionState.locations.map((item) => [item.id, item.kind])).toEqual([["M3-DEPOT", "DEPOT"], ["delivery:M3-O1", "DELIVERY"]]);
    expect(snapshot.demoClock.now).toBe("2026-09-27T21:13:00+07:00");
    expect(snapshot.backend).toMatchObject({ source: "MEMBER3_HTTP", executionMode: "SIMULATED_REPLAY", realWorldObservation: false });
    expect(snapshot.planState).toMatchObject({ acceptedPlans: [], proposedAlternatives: [], activeAcceptedPlanId: null });
    const scene = createMapScene(snapshot);
    expect(scene.markers.map((marker) => [marker.id, marker.kind])).toEqual([["M3-DEPOT", "depot"], ["M3-O1", "order"], ["M3-V1", "vehicle"]]);
    expect(scene.accepted).toEqual([]);
    expect(scene.proposed).toEqual([]);
    expect(snapshots).toHaveLength(1);
    expect(s.requests.map((item) => item.path)).toEqual(["/ready", "/api/runtime/capabilities", "/api/scenarios", "/api/scenarios/S1/load",
      "/api/sessions/m3-owned-session/state", "/api/sessions/m3-owned-session/orders", "/api/sessions/m3-owned-session/vehicles", "/api/sessions/m3-owned-session/locations"]);
  });

  it("refresh re-reads the saved M3 pointer and ignores poisoned mock authority", async () => {
    const s = server();
    s.values.set("saferoute.phase1.dispatch.v1", JSON.stringify({ schemaVersion: 1, snapshot: { decisionState: { orders: ["fake"] } } }));
    await new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1");
    s.requests.length = 0;
    s.state.current_time = s.orders.current_time = s.vehicles.current_time = s.locations.current_time = "2026-09-27T21:14:00+07:00";
    const next = await new BackendDispatchApi({ client: s.client, storage: s.storage }).getSnapshot();
    expect(next.decisionState.sessionId).toBe("m3-owned-session");
    expect(next.decisionState.orders.map((item) => item.id)).toEqual(["M3-O1"]);
    expect(next.demoClock.now).toBe("2026-09-27T21:14:00+07:00");
    expect(s.requests.every((item) => item.method === "GET")).toBe(true);
    expect([...s.values.values()].some((value) => value.includes('"orders"') && value.includes('"M3-O1"'))).toBe(false);
  });

  it("rejects torn reads instead of merging projections from another revision", async () => {
    const s = server();
    s.orders.basis = { ...s.orders.basis, head_sha256: "other-head" };
    await expect(new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1")).rejects.toMatchObject({ code: "STATE_CHANGED" });
  });

  it.each([
    ["0", "0"],
    ["9007199254740993", "9007199254740995"],
    ["9223372036854775807", "9223372036854775807"]
  ])("preserves the complete string revision (%s, %s) without using the legacy mock version", async (headVersion, generation) => {
    const s = server();
    s.state.basis.head_version = headVersion;
    s.state.basis.generation = generation;
    const snapshot = await new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1");
    expect(snapshot.backend?.basis).toEqual({ session_id: "m3-owned-session", build_sha256: "b".repeat(64),
      head_version: headVersion, generation, root_sha256: "1".repeat(64), head_sha256: "2".repeat(64),
      source_sha256: "3".repeat(64), context_version: "context-1", overlay_sha256: null });
    expect(snapshot.backend?.executionView.basis.head_version).toBe(headVersion);
    expect(snapshot.backend?.executionView.basis.generation).toBe(generation);
    expect(snapshot.decisionState.version).toBe(0);
  });

  it("refreshes generation-only changes while the head and legacy mock version stay unchanged", async () => {
    const s = server();
    const api = new BackendDispatchApi({ client: s.client, storage: s.storage });
    const before = await api.loadScenario("S1");
    s.state.basis = { ...s.state.basis, generation: "1" };
    s.orders.basis = s.vehicles.basis = s.locations.basis = s.state.basis;
    const after = await api.getSnapshot();
    expect(before.backend?.basis).toMatchObject({ head_version: "2", generation: "0" });
    expect(after.backend?.basis).toMatchObject({ head_version: "2", generation: "1" });
    expect(before.decisionState.version).toBe(0);
    expect(after.decisionState.version).toBe(0);
    expect(after.backend?.basis).not.toEqual(before.backend?.basis);
  });

  it("rejects projections whose generation differs even when their head version matches", async () => {
    const s = server();
    s.orders.basis = { ...s.orders.basis, generation: "1" };
    await expect(new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1"))
      .rejects.toMatchObject({ code: "STATE_CHANGED" });
  });

  it.each(["head_version", "generation"])("rejects invalid %s without converting it to a number", async (field) => {
    for (const value of [2, "01", "-1", "9223372036854775808"]) {
      const s = server();
      Reflect.set(s.state.basis, field, value);
      await expect(new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1"))
        .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    }
  });

  it("rejects malformed coverage and invalid coordinates rather than substituting fixtures", async () => {
    const s = server();
    s.orders.orders[0].coordinates = [300, 10];
    await expect(new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    s.orders.orders[0].coordinates = [106.73, 10.83];
    s.orders.orders[0].order_id = "unexpected";
    await expect(new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("refuses Phase 2 actions without performing HTTP mutations", async () => {
    const s = server();
    const api = new BackendDispatchApi({ client: s.client, storage: s.storage });
    for (const action of [() => api.selectAlternative("x"), () => api.acceptSelectedPlan(), () => api.triggerFixtureEvent("x"),
      () => api.setUrgentOrderEnabled(true), () => api.pickupOrder({ vehicleId: "v", orderId: "o" }), () => api.deliverOrder({ vehicleId: "v", orderId: "o" }),
      () => api.advanceDemoClock(10), () => api.resetDemoSession()]) {
      await expect(action()).rejects.toMatchObject({ code: "PHASE_NOT_SUPPORTED" });
    }
    expect(s.requests).toEqual([]);
  });

  it("uses the runtime physical status/custody rather than a source fixture default", async () => {
    const s = server();
    s.state.vehicles[0].onboard_order_ids = ["M3-O1"];
    s.state.vehicles[0].current_load_kg = 7;
    s.orders.orders[0].status = "ONBOARD";
    s.orders.orders[0].owner_vehicle_id = "M3-V1";
    const snapshot = await new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1");
    expect(snapshot.decisionState.orders[0]).toMatchObject({ status: "ONBOARD", assignedVehicleId: "M3-V1", pickedUpAt: null });
    expect(snapshot.decisionState.vehicles[0]).toMatchObject({ currentLoadKg: 7, onboardOrderIds: ["M3-O1"] });
  });

  it("shares concurrent initial reads so StrictMode does not create duplicate sessions", async () => {
    const s = server();
    const api = new BackendDispatchApi({ client: s.client, storage: s.storage });
    const [first, second] = await Promise.all([api.getSnapshot(), api.getSnapshot()]);
    expect(first.decisionState.sessionId).toBe(second.decisionState.sessionId);
    expect(s.requests.filter((item) => item.method === "POST")).toHaveLength(1);
  });

  it("retries an interrupted load with the persisted request ID after browser refresh", async () => {
    const s = server();
    let interrupted = false;
    const client = new Member3Client({ token: () => "test-only-bearer", fetch: async (url, options) => {
      const response = await s.fetcher(url, options);
      if (String(url).endsWith("/load") && !interrupted) { interrupted = true; throw new Error("response lost after commit"); }
      return response;
    } });
    await expect(new BackendDispatchApi({ client, storage: s.storage }).loadScenario("S1")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    const result = await new BackendDispatchApi({ client, storage: s.storage }).getSnapshot();
    expect(result.decisionState.scenarioId).toBe("S1");
    const bodies = s.requests.filter((item) => item.method === "POST").map((item) => item.body);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  it("rejects a newly loaded session from a different runtime build", async () => {
    const s = server();
    s.capabilities.build_sha256 = "d".repeat(64);
    await expect(new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("keeps overlapping scenario selections in call order instead of publishing an older world last", async () => {
    const s = server();
    let release!: () => void;
    let firstReadStarted!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const started = new Promise<void>((resolve) => { firstReadStarted = resolve; });
    let first = true;
    const client = new Member3Client({ token: () => "test-only-bearer", fetch: async (url, options) => {
      if (String(url).endsWith("/state") && first) { first = false; firstReadStarted(); await blocked; }
      return s.fetcher(url, options);
    } });
    const api = new BackendDispatchApi({ client, storage: s.storage });
    const published: string[] = [];
    api.subscribe((snapshot) => published.push(snapshot.decisionState.scenarioId));
    const older = api.loadScenario("S0");
    await started;
    const newer = api.loadScenario("S1");
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    await Promise.all([older, newer]);
    expect(published).toEqual(["S0", "S1"]);
    expect((await api.getSnapshot()).decisionState.scenarioId).toBe("S1");
  });

  it("accepts the native pre-plan vehicle shape without inventing unavailable position metadata", async () => {
    const s = server();
    // Observed on the native M3 initial state: these four fields appear only after a plan exists.
    for (const field of ["position_timestamp", "planned_suffix", "activity"]) Reflect.deleteProperty(s.state.vehicles[0], field);
    Reflect.deleteProperty(s.state.vehicles[0].position, "position_source");
    const snapshot = await new BackendDispatchApi({ client: s.client, storage: s.storage }).loadScenario("S1");
    expect(snapshot.decisionState.vehicles[0].positionTimestamp).toBeNull();
    expect(snapshot.backend?.executionMode).toBe("SIMULATED_REPLAY");
    expect(snapshot.planState.acceptedPlans).toEqual([]);
  });
});
