import { Member3Client } from "../../integrations/member3/client";
import { Member3Error } from "../../integrations/member3/errors";
import type { M3Catalog, M3Session } from "../../integrations/member3/types";
import { mapM3World } from "../../integrations/member3/worldState";
import type { DispatchSnapshot } from "../../shared/types/dispatch";
import type { ScenarioId } from "../../shared/types/scenario";
import type { DispatchApi } from "./DispatchApi";

interface PointerStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface SessionPointer { schemaVersion: 1; session?: M3Session; pending?: { scenarioId: ScenarioId; requestId: string } }
function browserStorage(): PointerStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
}
function validSession(value: unknown): value is M3Session {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<M3Session>;
  return typeof item.session_id === "string" && item.session_id.length > 0 && /^S[0-4]$/.test(item.scenario_id ?? "") &&
    [item.build_sha256, item.catalog_sha256, item.fixture_sha256].every((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
}

/** Phase 1: native session loading and world reads only; no mock authority or planning dependency. */
export class BackendDispatchApi implements DispatchApi {
  private readonly client: Member3Client;
  private readonly storage?: PointerStorage;
  private readonly storageKey: string;
  private readonly listeners = new Set<(snapshot: DispatchSnapshot) => void>();
  private pointer: SessionPointer = { schemaVersion: 1 };
  private foundation?: Promise<M3Catalog>;
  private runtimeBuildSha256?: string;
  private initialRead?: Promise<DispatchSnapshot>;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: { client?: Member3Client; storage?: PointerStorage } = {}) {
    this.client = options.client ?? new Member3Client();
    this.storage = options.storage ?? browserStorage();
    this.storageKey = `saferoute.member3.session.v1:${this.client.baseUrl}`;
    try {
      const saved = JSON.parse(this.storage?.getItem(this.storageKey) ?? "null") as SessionPointer | null;
      if (saved?.schemaVersion === 1) {
        if (validSession(saved.session)) this.pointer.session = saved.session;
        if (saved.pending && /^S[0-4]$/.test(saved.pending.scenarioId) && typeof saved.pending.requestId === "string" && saved.pending.requestId.length > 0) this.pointer.pending = saved.pending;
      }
    } catch { /* Invalid local pointer cannot become physical authority. */ }
  }
  subscribe(listener: (snapshot: DispatchSnapshot) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  getSnapshot(): Promise<DispatchSnapshot> {
    // Share the initial read/load during React StrictMode's two mounts.
    if (!this.initialRead) this.initialRead = this.enqueue(() => this.currentWorld()).finally(() => { this.initialRead = undefined; });
    return this.initialRead;
  }
  private async currentWorld() {
    await this.ensureFoundation();
    if (this.pointer.pending) return this.performLoadScenario(this.pointer.pending.scenarioId);
    if (!this.pointer.session) return this.performLoadScenario("S0");
    return this.readWorld(this.pointer.session);
  }
  loadScenario(id: ScenarioId): Promise<DispatchSnapshot> { return this.enqueue(() => this.performLoadScenario(id)); }
  private enqueue(operation: () => Promise<DispatchSnapshot>) {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => {}, () => {});
    return result;
  }
  private async performLoadScenario(id: ScenarioId): Promise<DispatchSnapshot> {
    const catalog = await this.ensureFoundation();
    const scenario = catalog.scenarios.find((item) => item.scenario_id === id);
    if (!scenario) throw new Member3Error("SCENARIO_UNAVAILABLE", "Scenario is not available in M3.");
    const pending = this.pointer.pending?.scenarioId === id ? this.pointer.pending : { scenarioId: id, requestId: `m4-load-${crypto.randomUUID()}` };
    this.pointer.pending = pending;
    this.persist(); // Persist request identity before POST; ambiguous failures retry the same ID.
    const loaded = await this.client.loadScenario(id, pending.requestId);
    if (loaded.schema_version !== "saferoute-m3-loaded-session/1" || !validSession(loaded.session) || loaded.session.scenario_id !== id ||
        loaded.session.build_sha256 !== this.runtimeBuildSha256 || loaded.session.fixture_sha256 !== scenario.fixture_sha256 ||
        loaded.session.catalog_sha256 !== catalog.catalog_sha256 || loaded.execution_view?.basis?.session_id !== loaded.session.session_id) {
      throw new Member3Error("INVALID_RESPONSE", "M3 returned an invalid loaded-session binding.");
    }
    this.pointer = { schemaVersion: 1, session: loaded.session };
    this.persist();
    return this.readWorld(loaded.session); // Load receipt is historical; re-read current state.
  }
  private ensureFoundation(): Promise<M3Catalog> {
    if (!this.foundation) this.foundation = (async () => {
      const ready = await this.client.ready();
      if (ready.ready !== true) throw new Member3Error("BACKEND_NOT_READY", "M3 is not ready.");
      const capabilities = await this.client.capabilities();
      const catalog = await this.client.scenarios();
      if (capabilities.schema_version !== "task02-m2-runtime-capabilities/1" || catalog.schema_version !== "saferoute-m3-scenario-catalog/1" ||
          !/^[a-f0-9]{64}$/.test(capabilities.build_sha256) || !Array.isArray(catalog.scenarios) ||
          catalog.scenarios.some((item) => !item || !/^S[0-8]$/.test(item.scenario_id) || !/^[a-f0-9]{64}$/.test(item.fixture_sha256)) ||
          !/^[a-f0-9]{64}$/.test(catalog.catalog_sha256) || catalog.execution_mode !== "SIMULATED_REPLAY" || catalog.real_world_observation !== false) {
        throw new Member3Error("INVALID_RESPONSE", "M3 runtime/catalog contract is invalid.");
      }
      this.runtimeBuildSha256 = capabilities.build_sha256;
      if (this.pointer.session && (this.pointer.session.build_sha256 !== capabilities.build_sha256 || this.pointer.session.catalog_sha256 !== catalog.catalog_sha256)) {
        throw new Member3Error("SESSION_BINDING_CHANGED", "Saved M3 session belongs to a different runtime or catalog.");
      }
      return catalog;
    })().catch((error) => { this.foundation = undefined; throw error; });
    return this.foundation;
  }
  private async readWorld(session: M3Session): Promise<DispatchSnapshot> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = await this.client.state(session.session_id);
      const orders = await this.client.orders(session.session_id);
      const vehicles = await this.client.vehicles(session.session_id);
      const locations = await this.client.locations(session.session_id);
      try {
        const snapshot = mapM3World(session, state, orders, vehicles, locations, this.client.baseUrl);
        for (const listener of this.listeners) listener(snapshot);
        return snapshot;
      } catch (error) {
        if (!(error instanceof Member3Error) || error.code !== "STATE_CHANGED" || attempt === 2) throw error;
      }
    }
    throw new Member3Error("STATE_CHANGED", "M3 world changed repeatedly during the read.");
  }
  private persist() {
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.pointer)); } catch { /* Persistence is optional. */ }
  }
  private unsupported(): Promise<DispatchSnapshot> {
    return Promise.reject(new Member3Error("PHASE_NOT_SUPPORTED", "This action is not connected in backend Phase 1."));
  }
  optimize() { return this.unsupported(); }
  selectAlternative(_id: string) { return this.unsupported(); }
  acceptSelectedPlan() { return this.unsupported(); }
  triggerFixtureEvent(_id: string) { return this.unsupported(); }
  setUrgentOrderEnabled(_enabled: boolean) { return this.unsupported(); }
  pickupOrder(_input: { vehicleId: string; orderId: string }) { return this.unsupported(); }
  deliverOrder(_input: { vehicleId: string; orderId: string }) { return this.unsupported(); }
  advanceDemoClock(_minutes: number) { return this.unsupported(); }
  resetDemoSession() { return this.unsupported(); }
}
