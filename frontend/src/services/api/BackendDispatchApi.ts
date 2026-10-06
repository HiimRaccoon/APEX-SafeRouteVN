import { Member3Client } from "../../integrations/member3/client";
import { Member3Error } from "../../integrations/member3/errors";
import type { M3Basis, M3Catalog, M3Session, M3ComparisonView, CompareProfilesRequest } from "../../integrations/member3/types";
import { sameBasis, expectedRevision, parseBasis } from "../../integrations/member3/revision";
import { createPendingCommandStore, type PendingCommandStore } from "../../integrations/member3/requestId";
import { adaptScenarioCatalog, type ScenarioOption } from "../../integrations/member3/scenarioAdapter";
import { phase2Capabilities } from "../../integrations/member3/capabilities";
import { createPollCoordinator, type PollCoordinator, transientM3Error } from "../../integrations/member3/polling";
import { terminalComparison } from "../../integrations/member3/jobViewAdapter";
import { mapM3World } from "../../integrations/member3/worldState";
import type { DispatchSnapshot } from "../../shared/types/dispatch";
import type { ScenarioId } from "../../shared/types/scenario";
import type { DispatchApi } from "./DispatchApi";

interface PointerStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface SessionPointer { schemaVersion: 1; session?: M3Session; pending?: { scenarioId: ScenarioId; requestId: string }; comparison?: { id: string; inputBasis: M3Basis } }
function browserStorage(): PointerStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
}
function validSession(value: unknown): value is M3Session {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<M3Session>;
  return typeof item.session_id === "string" && item.session_id.length > 0 && /^S[0-4]$/.test(item.scenario_id ?? "") &&
    [item.build_sha256, item.catalog_sha256, item.fixture_sha256].every((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value));
}

/** Native world authority and forecast job orchestration; never solves or accepts locally. */
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
  private readonly commands: PendingCommandStore;
  private readonly polling: PollCoordinator;
  private snapshot?: DispatchSnapshot;
  private comparison?: M3ComparisonView;
  private scenarios: ScenarioOption[] = [];
  private pollWorldRead?: Promise<DispatchSnapshot>;
  private queuedOperations = 0;

  constructor(options: { client?: Member3Client; storage?: PointerStorage } = {}) {
    this.client = options.client ?? new Member3Client();
    this.storage = options.storage ?? browserStorage();
    this.storageKey = `saferoute.member3.session.v1:${this.client.baseUrl}`;
    this.commands = createPendingCommandStore(this.storage, this.client.baseUrl);
    this.polling = createPollCoordinator({
      readWorld: (sid, signal) => {
        if (this.queuedOperations || this.pointer.session?.session_id !== sid) return Promise.reject(new DOMException("Stale read", "AbortError"));
        const session = this.pointer.session;
        const read = this.readWorld(session, signal, false);
        this.pollWorldRead = read;
        void read.finally(() => { if (this.pollWorldRead === read) this.pollWorldRead = undefined; }).catch(() => {});
        return read;
      },
      readComparison: (sid, cid, signal) => this.client.comparison(sid, cid, signal),
      publishWorld: snapshot => { this.publish(snapshot); },
      publishComparison: view => { this.bindComparison(view); if (this.snapshot) this.publish(this.snapshot); },
      onError: error => { this.markStale(error); }, now: Date.now,
      schedule: (callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); },
      isVisible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
      subscribeVisibility: callback => { if (typeof document === "undefined") return () => {}; document.addEventListener("visibilitychange", callback); return () => document.removeEventListener("visibilitychange", callback); }
    });
    try {
      const saved = JSON.parse(this.storage?.getItem(this.storageKey) ?? "null") as SessionPointer | null;
      if (saved?.schemaVersion === 1) {
        if (validSession(saved.session)) this.pointer.session = saved.session;
        if (saved.comparison && typeof saved.comparison.id === "string" && saved.comparison.id.length > 0 && saved.session &&
            parseBasis(saved.comparison.inputBasis).session_id === saved.session.session_id) this.pointer.comparison = saved.comparison;
        if (saved.pending && /^S[0-4]$/.test(saved.pending.scenarioId) && typeof saved.pending.requestId === "string" && saved.pending.requestId.length > 0) this.pointer.pending = saved.pending;
      }
    } catch { /* Invalid local pointer cannot become physical authority. */ }
  }
  subscribe(listener: (snapshot: DispatchSnapshot) => void) {
    this.listeners.add(listener); this.resumePolling();
    return () => { this.listeners.delete(listener); if (!this.listeners.size) this.polling.stop(); };
  }
  getSnapshot(): Promise<DispatchSnapshot> {
    // Share the initial read/load during React StrictMode's two mounts.
    if (!this.initialRead) this.initialRead = this.enqueue(() => this.currentWorld()).finally(() => { this.initialRead = undefined; });
    return this.initialRead;
  }
  private async currentWorld() {
    await this.ensureFoundation();
    if (this.pointer.pending) return this.performLoadScenario(this.pointer.pending.scenarioId);
    if (!this.pointer.session) return this.performLoadScenario("S0");
    await this.readWorld(this.pointer.session);
    const pending = this.commands.read();
    if (pending?.sessionId === this.pointer.session.session_id) {
      if (pending.operation === "compare") return this.submitComparison();
      if (pending.operation === "cancelComparison") return this.performCancelComparison();
    }
    if (this.pointer.comparison) this.bindComparison(await this.client.comparison(this.pointer.session.session_id, this.pointer.comparison.id));
    return this.publish(this.snapshot!, true);
  }
  loadScenario(id: ScenarioId): Promise<DispatchSnapshot> { return this.enqueue(() => this.performLoadScenario(id)); }
  private enqueue(operation: () => Promise<DispatchSnapshot>) {
    this.queuedOperations++; this.polling.stop();
    const activeRead = this.pollWorldRead;
    const result = this.operationQueue.then(async () => { await activeRead?.catch(() => {}); return operation(); })
      .catch(error => { this.markStale(error); throw error; })
      .finally(() => { this.queuedOperations--; if (!this.queuedOperations) this.resumePolling(); });
    this.operationQueue = result.then(() => {}, () => {});
    return result;
  }
  private async performLoadScenario(id: ScenarioId): Promise<DispatchSnapshot> {
    if (this.commands.read()) throw new Member3Error("PENDING_COMMAND", "Resolve the pending backend command before changing session.");
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
    this.comparison = undefined;
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
      this.scenarios = adaptScenarioCatalog(catalog);
      if (this.pointer.session && (this.pointer.session.build_sha256 !== capabilities.build_sha256 || this.pointer.session.catalog_sha256 !== catalog.catalog_sha256)) {
        throw new Member3Error("SESSION_BINDING_CHANGED", "Saved M3 session belongs to a different runtime or catalog.");
      }
      return catalog;
    })().catch((error) => { this.foundation = undefined; throw error; });
    return this.foundation;
  }
  private async readWorld(session: M3Session, signal?: AbortSignal, publish = true): Promise<DispatchSnapshot> {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      const state = await this.client.state(session.session_id, signal);
      const orders = await this.client.orders(session.session_id, signal);
      const vehicles = await this.client.vehicles(session.session_id, signal);
      const locations = await this.client.locations(session.session_id, signal);
      try {
        const snapshot = mapM3World(session, state, orders, vehicles, locations, this.client.baseUrl);
        signal?.throwIfAborted();
        return publish ? this.publish(snapshot, true) : snapshot;
      } catch (error) {
        if (!(error instanceof Member3Error) || error.code !== "STATE_CHANGED" || attempt === 2) throw error;
      }
    }
    throw new Member3Error("STATE_CHANGED", "M3 world changed repeatedly during the read.");
  }
  private persist(required = false) {
    try {
      if (required && !this.storage) throw new Error("Storage required");
      this.storage?.setItem(this.storageKey, JSON.stringify(this.pointer));
    } catch {
      if (required) throw new Member3Error("COMMAND_STORAGE_UNAVAILABLE", "Cannot persist the comparison reference; the original command remains available for recovery.");
      // Phase 1 read/load pointers keep their existing optional persistence behavior.
    }
  }
  private unsupported(): Promise<DispatchSnapshot> {
    return Promise.reject(new Member3Error("PHASE_NOT_SUPPORTED", "This action is not connected in backend Phase 2."));
  }
  optimize() { return this.enqueue(async () => {
    if (!this.pointer.session) await this.currentWorld();
    await this.readWorld(this.pointer.session!);
    if (this.comparison && !terminalComparison(this.comparison) && !this.commands.read()) throw new Member3Error("COMPARISON_IN_PROGRESS", "A comparison is already running; refresh or cancel it.");
    return this.submitComparison();
  }); }
  private async submitComparison(): Promise<DispatchSnapshot> {
    const session = this.pointer.session!, basis = this.snapshot!.backend!.basis;
    const existing = this.commands.read();
    if (existing && (existing.operation !== "compare" || existing.sessionId !== session.session_id)) throw new Member3Error("PENDING_COMMAND", "Another backend command needs reconciliation.");
    const intent = existing ? { operation: existing.operation, sessionId: existing.sessionId, body: existing.body, inputBasis: existing.inputBasis } :
      { operation: "compare", sessionId: session.session_id, body: { expected_revision: expectedRevision(basis) }, inputBasis: basis };
    const pending = this.commands.begin(intent);
    if (!pending.inputBasis || parseBasis(pending.inputBasis).session_id !== session.session_id ||
        JSON.stringify(pending.body) !== JSON.stringify({ expected_revision: expectedRevision(pending.inputBasis) })) throw new Member3Error("INVALID_RESPONSE", "Stored compare intent has invalid revision/basis binding.");
    let receipt;
    try { receipt = await this.retryCommand(() => this.client.compareProfiles(session.session_id, { ...pending.body, request_id: pending.requestId } as CompareProfilesRequest)); }
    catch (error) {
      // Native ProfileService rejects STALE_HEAD before creating the batch (after looking up any historical receipt).
      if (error instanceof Member3Error && error.status === 409 && error.code === "STALE_HEAD") {
        this.commands.complete(pending.requestId); await this.readWorld(session);
      }
      throw error;
    }
    if (receipt.session_id !== session.session_id || receipt.mode !== "NEW_BATCH" || !pending.inputBasis || !sameBasis(receipt.input_basis, parseBasis(pending.inputBasis))) throw new Member3Error("INVALID_RESPONSE", "Comparison receipt differs from original intent basis.");
    this.pointer.comparison = { id: receipt.comparison_id, inputBasis: receipt.input_basis }; this.persist(true);
    this.comparison = { schema_version: "saferoute-m3-profile-comparison/1", session_id: receipt.session_id, comparison_id: receipt.comparison_id, input_basis: receipt.input_basis,
      mode: receipt.mode, status: "QUEUED", jobs: receipt.profiles.map(profile => ({ profile, job_id: null, view: null })), outcome: null,
      links: receipt.links, execution_mode: "SIMULATED_REPLAY", real_world_observation: false, metric_scope: "FORECAST_ONLY", exposure_is_proxy: true };
    this.commands.complete(pending.requestId);
    return this.publish(this.snapshot!, true);
  }
  cancelComparison() { return this.enqueue(() => this.performCancelComparison()); }
  private async performCancelComparison() {
    const session = this.pointer.session, target = this.pointer.comparison;
    if (!session || !target) throw new Member3Error("NO_COMPARISON", "No comparison to cancel.");
    const intent = { sessionId: session.session_id, operation: "cancelComparison", resourceId: target.id, body: {} };
    const pending = this.commands.begin(intent);
    await this.retryCommand(() => this.client.cancelComparison(session.session_id, target.id, pending.requestId));
    this.commands.complete(pending.requestId);
    this.bindComparison(await this.client.comparison(session.session_id, target.id));
    return this.publish(this.snapshot!, true);
  }
  capabilities() { return Promise.resolve(phase2Capabilities(!this.snapshot?.backend?.stale)); }
  private async retryCommand<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (!transientM3Error(error) || error instanceof Member3Error && error.code === "NETWORK_ERROR" || attempt >= 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  private bindComparison(view: M3ComparisonView) {
    const reference = this.pointer.comparison;
    if (!reference || view.comparison_id !== reference.id || !sameBasis(view.input_basis, reference.inputBasis)) throw new Member3Error("INVALID_RESPONSE", "Comparison binding changed.");
    this.comparison = view;
  }
  private publish(snapshot: DispatchSnapshot, fresh = false): DispatchSnapshot {
    const oldError = fresh ? undefined : this.snapshot?.backend?.error;
    const next: DispatchSnapshot = { ...snapshot, backend: { ...snapshot.backend!, scenarios: this.scenarios, comparison: this.comparison,
      jobs: Object.fromEntries((this.comparison?.jobs ?? []).flatMap(row => row.view ? [[row.view.job_id, row.view]] : [])),
      stale: Boolean(oldError), error: oldError, capabilities: phase2Capabilities(!oldError) } };
    this.snapshot = next;
    for (const listener of this.listeners) listener(next);
    return next;
  }
  private markStale(error: unknown) {
    if (!this.snapshot?.backend || error instanceof DOMException && error.name === "AbortError") return;
    const value = error instanceof Member3Error ? { code: error.code, message: error.message } : { code: "BACKEND_ERROR", message: "M3 read/action failed." };
    this.snapshot = { ...this.snapshot, backend: { ...this.snapshot.backend, stale: true, error: value, capabilities: phase2Capabilities(false) } };
    for (const listener of this.listeners) listener(this.snapshot);
  }
  private resumePolling() {
    const session = this.pointer.session;
    if (!session || !this.listeners.size || this.queuedOperations) return;
    this.polling.watchWorld(session.session_id);
    if (this.comparison && !terminalComparison(this.comparison)) this.polling.watchComparison(session.session_id, this.comparison.comparison_id);
  }
  selectAlternative(_id: string) { return this.unsupported(); }
  acceptSelectedPlan() { return this.unsupported(); }
  triggerFixtureEvent(_id: string) { return this.unsupported(); }
  setUrgentOrderEnabled(_enabled: boolean) { return this.unsupported(); }
  pickupOrder(_input: { vehicleId: string; orderId: string }) { return this.unsupported(); }
  deliverOrder(_input: { vehicleId: string; orderId: string }) { return this.unsupported(); }
  advanceDemoClock(_minutes: number) { return this.unsupported(); }
  resetDemoSession() { return this.unsupported(); }
}
