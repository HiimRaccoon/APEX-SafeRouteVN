import { Member3Client } from "../../integrations/member3/client";
import { Member3Error } from "../../integrations/member3/errors";
import type { M3Basis, M3Catalog, M3Session, M3ComparisonView, M3JobForecast, CompareProfilesRequest, AcceptPlanRequest, M3AcceptanceReceipt } from "../../integrations/member3/types";
import { adaptJobForecast } from "../../integrations/member3/forecastViewAdapter";
import { sameBasis, expectedRevision, parseBasis, canAcceptSelectedPlan } from "../../integrations/member3/revision";
import { createPendingCommandStore, type PendingCommand, type PendingCommandStore } from "../../integrations/member3/requestId";
import { adaptScenarioCatalog, type ScenarioOption } from "../../integrations/member3/scenarioAdapter";
import { phase2Capabilities } from "../../integrations/member3/capabilities";
import { createPollCoordinator, type PollCoordinator, transientM3Error } from "../../integrations/member3/polling";
import { terminalComparison } from "../../integrations/member3/jobViewAdapter";
import { mapM3World } from "../../integrations/member3/worldState";
import type { DispatchSnapshot } from "../../shared/types/dispatch";
import type { ScenarioId } from "../../shared/types/scenario";
import type { DispatchApi } from "./DispatchApi";

interface PointerStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface SessionPointer { schemaVersion: 1; session?: M3Session; pending?: { scenarioId: ScenarioId; requestId: string }; comparison?: { id: string; inputBasis: M3Basis }; previewJobId?: string }
function samePublicValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left)) return Array.isArray(right) && left.length === right.length && left.every((value, i) => samePublicValue(value, right[i]));
  if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(right)) {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => key in b && samePublicValue(a[key], b[key]));
  }
  return false;
}
function forecastCapabilities(fresh: boolean) { return { ...phase2Capabilities(fresh), forecastGeometry: fresh, accept: fresh }; }
function browserStorage(): PointerStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
}
function commandTabId(): string | null | undefined {
  if (typeof window === "undefined") return undefined;
  const key = "saferoute.member3.command-tab.v1";
  try {
    const saved = window.sessionStorage.getItem(key);
    if (saved && /^[A-Za-z0-9-]{1,200}$/.test(saved)) return saved;
    const id = crypto.randomUUID(); window.sessionStorage.setItem(key, id); return id;
  } catch { return null; }
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
  private commands: PendingCommandStore;
  private commandScope: string;
  private readonly browserCommandIdentity: boolean;
  private legacyCommands = false;
  private readonly polling: PollCoordinator;
  private snapshot?: DispatchSnapshot;
  private comparison?: M3ComparisonView;
  private readonly forecasts = new Map<string, M3JobForecast>();
  private scenarios: ScenarioOption[] = [];
  private pollWorldRead?: Promise<DispatchSnapshot>;
  private queuedOperations = 0;
  private acceptFlight?: Promise<DispatchSnapshot>;
  private acceptances: M3AcceptanceReceipt[] = [];

  constructor(options: { client?: Member3Client; storage?: PointerStorage } = {}) {
    this.client = options.client ?? new Member3Client();
    this.storage = options.storage ?? browserStorage();
    this.storageKey = `saferoute.member3.session.v1:${this.client.baseUrl}`;
    const tabId = commandTabId();
    this.browserCommandIdentity = typeof tabId === "string";
    this.commandScope = tabId ? `${this.client.baseUrl}:tab:${tabId}` : this.client.baseUrl;
    const commandStorage = tabId === null ? undefined : this.storage;
    const legacy = createPendingCommandStore(commandStorage, this.client.baseUrl);
    this.legacyCommands = Boolean(legacy.read());
    this.commands = this.legacyCommands ? legacy : createPendingCommandStore(commandStorage, this.commandScope);
    this.polling = createPollCoordinator({
      readWorld: (sid, signal) => {
        if (this.queuedOperations || this.pointer.session?.session_id !== sid) return Promise.reject(new DOMException("Stale read", "AbortError"));
        const session = this.pointer.session;
        const read = this.readWorld(session, signal, false);
        this.pollWorldRead = read;
        void read.finally(() => { if (this.pollWorldRead === read) this.pollWorldRead = undefined; }).catch(() => {});
        return read;
      },
      readComparison: (sid, cid, signal) => this.readComparison(sid, cid, signal),
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
        if (typeof saved.previewJobId === "string") this.pointer.previewJobId = saved.previewJobId;
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
    const pending = this.commands.read();
    if (pending?.operation === "accept" && pending.sessionId && pending.sessionId !== this.pointer.session?.session_id) {
      // The shared pointer can change in another tab; recover this command's owned session.
      const recovered = await this.client.session(pending.sessionId);
      if (!validSession(recovered) || recovered.session_id !== pending.sessionId || recovered.build_sha256 !== pending.inputBasis?.build_sha256) {
        throw new Member3Error("INVALID_RESPONSE", "Pending Accept session binding is invalid.");
      }
      this.pointer = { schemaVersion: 1, session: recovered };
      this.comparison = undefined; this.forecasts.clear(); this.acceptances = [];
      this.persist(true);
    }
    await this.ensureFoundation();
    if (this.pointer.pending) return this.performLoadScenario(this.pointer.pending.scenarioId);
    if (!this.pointer.session) return this.performLoadScenario("S0");
    await this.readWorld(this.pointer.session);
    if (pending?.sessionId === this.pointer.session.session_id) {
      if (pending.operation === "compare") return this.submitComparison();
      if (pending.operation === "cancelComparison") return this.performCancelComparison();
      if (pending.operation === "accept") return this.performAccept();
      throw new Member3Error("PENDING_COMMAND", "The pending backend command cannot be reconciled by this phase.");
    }
    if (pending) throw new Member3Error("PENDING_COMMAND", "Pending command belongs to another session; restore its session before retrying.");
    await this.readAcceptances(this.pointer.session.session_id);
    if (this.pointer.comparison) this.bindComparison(await this.readComparison(this.pointer.session.session_id, this.pointer.comparison.id));
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
    this.forecasts.clear();
    this.acceptances = [];
    this.persist();
    const world = await this.readWorld(loaded.session, undefined, false); // Load receipt is historical; re-read current state.
    await this.readAcceptances(loaded.session.session_id);
    return this.publish(world, true);
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
  private completeCommand(requestId: string) {
    this.commands.complete(requestId);
    if (this.legacyCommands && !this.commands.read()) {
      this.legacyCommands = false;
      this.commands = createPendingCommandStore(this.storage, this.commandScope);
    }
  }
  private beginCommand(intent: Omit<PendingCommand, "requestId">): PendingCommand {
    if (!this.commands.read() && this.browserCommandIdentity) {
      try {
        // sessionStorage is copied into opener-created tabs. Allocate a new namespace
        // for each new intent; retain the saved namespace only when replaying it.
        const activeId = window.sessionStorage.getItem("saferoute.member3.command-tab.v1");
        const active = activeId ? createPendingCommandStore(this.storage, `${this.client.baseUrl}:tab:${activeId}`) : undefined;
        if (active?.read()) this.commands = active;
        else {
          const id = crypto.randomUUID();
          window.sessionStorage.setItem("saferoute.member3.command-tab.v1", id);
          this.commandScope = `${this.client.baseUrl}:tab:${id}`;
          this.commands = createPendingCommandStore(this.storage, this.commandScope);
        }
      } catch { throw new Member3Error("COMMAND_STORAGE_UNAVAILABLE", "Cannot persist the command recovery identity."); }
    }
    return this.commands.begin(intent);
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
    const pending = this.beginCommand(intent);
    if (!pending.inputBasis || parseBasis(pending.inputBasis).session_id !== session.session_id ||
        JSON.stringify(pending.body) !== JSON.stringify({ expected_revision: expectedRevision(pending.inputBasis) })) throw new Member3Error("INVALID_RESPONSE", "Stored compare intent has invalid revision/basis binding.");
    let receipt;
    try { receipt = await this.retryCommand(() => this.client.compareProfiles(session.session_id, { ...pending.body, request_id: pending.requestId } as CompareProfilesRequest)); }
    catch (error) {
      // Native ProfileService rejects STALE_HEAD before creating the batch (after looking up any historical receipt).
      if (error instanceof Member3Error && error.status === 409 && error.code === "STALE_HEAD") {
        this.completeCommand(pending.requestId); await this.readWorld(session);
      }
      throw error;
    }
    if (receipt.session_id !== session.session_id || receipt.mode !== "NEW_BATCH" || !pending.inputBasis || !sameBasis(receipt.input_basis, parseBasis(pending.inputBasis))) throw new Member3Error("INVALID_RESPONSE", "Comparison receipt differs from original intent basis.");
    this.pointer.comparison = { id: receipt.comparison_id, inputBasis: receipt.input_basis }; this.persist(true);
    this.comparison = { schema_version: "saferoute-m3-profile-comparison/1", session_id: receipt.session_id, comparison_id: receipt.comparison_id, input_basis: receipt.input_basis,
      mode: receipt.mode, status: "QUEUED", jobs: receipt.profiles.map(profile => ({ profile, job_id: null, view: null })), outcome: null,
      links: receipt.links, execution_mode: "SIMULATED_REPLAY", real_world_observation: false, metric_scope: "FORECAST_ONLY", exposure_is_proxy: true };
    this.completeCommand(pending.requestId);
    return this.publish(this.snapshot!, true);
  }
  cancelComparison() { return this.enqueue(() => this.performCancelComparison()); }
  private async performCancelComparison() {
    const session = this.pointer.session, target = this.pointer.comparison;
    if (!session || !target) throw new Member3Error("NO_COMPARISON", "No comparison to cancel.");
    const intent = { sessionId: session.session_id, operation: "cancelComparison", resourceId: target.id, body: {} };
    const pending = this.beginCommand(intent);
    await this.retryCommand(() => this.client.cancelComparison(session.session_id, target.id, pending.requestId));
    this.completeCommand(pending.requestId);
    this.bindComparison(await this.readComparison(session.session_id, target.id));
    return this.publish(this.snapshot!, true);
  }
  capabilities() { return Promise.resolve(forecastCapabilities(Boolean(this.snapshot && !this.snapshot.backend?.stale && !this.commands.read() && !this.queuedOperations))); }
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
  private async readComparison(sid: string, cid: string, signal?: AbortSignal) {
    const view = await this.client.comparison(sid, cid, signal);
    const reference = this.pointer.comparison;
    if (!reference || view.comparison_id !== reference.id || !sameBasis(view.input_basis, reference.inputBasis)) throw new Member3Error("INVALID_RESPONSE", "Comparison binding changed.");
    // The existing comparison lane owns forecast reads. Certified terminal jobs are immutable.
    const forecasts = await Promise.all(view.jobs.filter(row => row.job_id && row.view?.plan_available && !this.forecasts.has(row.job_id))
      .map(async row => {
        const forecast = await this.client.jobForecast(sid, row.job_id!, signal);
        if (forecast.profile !== row.profile || !sameBasis(forecast.input_basis, row.view!.input_basis) || !samePublicValue(forecast.job_view, row.view)) {
          throw new Member3Error("INVALID_RESPONSE", "Forecast differs from certified comparison job.");
        }
        return forecast;
      }));
    signal?.throwIfAborted();
    forecasts.forEach(forecast => this.forecasts.set(forecast.job_id, forecast));
    for (const row of view.jobs) {
      const forecast = row.job_id && this.forecasts.get(row.job_id);
      if (forecast && (forecast.profile !== row.profile || !samePublicValue(forecast.job_view, row.view))) {
        throw new Member3Error("INVALID_RESPONSE", "Certified forecast job binding changed.");
      }
    }
    return view;
  }
  private publish(snapshot: DispatchSnapshot, fresh = false): DispatchSnapshot {
    const oldError = fresh ? undefined : this.snapshot?.backend?.error;
    const mutationPending = Boolean(this.commands.read());
    const proposedAlternatives = oldError ? [] : (this.comparison?.jobs ?? []).flatMap(row => {
      const forecast = row.job_id && this.forecasts.get(row.job_id);
      if (!forecast || !row.view?.plan_available) return [];
      const proposal = adaptJobForecast(forecast, { basis: snapshot.backend!.basis, jobId: row.job_id!, profile: row.profile,
        comparisonId: this.comparison!.comparison_id, vehicleIds: snapshot.decisionState.vehicles.map(v => v.id), deliveredPrefix: snapshot.backend!.executionView.delivered_prefix });
      return proposal ? [proposal] : [];
    });
    const selectedAlternativeId = proposedAlternatives.some(p => p.id === this.pointer.previewJobId) ? this.pointer.previewJobId! : null;
    const next: DispatchSnapshot = { ...snapshot, backend: { ...snapshot.backend!, scenarios: this.scenarios, comparison: this.comparison,
      jobs: Object.fromEntries((this.comparison?.jobs ?? []).flatMap(row => row.view ? [[row.view.job_id, row.view]] : [])),
      stale: Boolean(oldError), error: oldError, mutationPending, acceptances: this.acceptances,
      capabilities: forecastCapabilities(!oldError && !mutationPending) },
      planState: { ...snapshot.planState, proposedAlternatives, selectedAlternativeId } };
    this.snapshot = next;
    for (const listener of this.listeners) listener(next);
    return next;
  }
  private markStale(error: unknown) {
    if (!this.snapshot?.backend || error instanceof DOMException && error.name === "AbortError") return;
    const value = error instanceof Member3Error ? { code: error.code, message: error.message } : { code: "BACKEND_ERROR", message: "M3 read/action failed." };
    this.snapshot = { ...this.snapshot, planState: { ...this.snapshot.planState, proposedAlternatives: [], selectedAlternativeId: null },
      backend: { ...this.snapshot.backend, stale: true, error: value, capabilities: forecastCapabilities(false) } };
    for (const listener of this.listeners) listener(this.snapshot);
  }
  private resumePolling() {
    const session = this.pointer.session;
    if (!session || !this.listeners.size || this.queuedOperations) return;
    this.polling.watchWorld(session.session_id);
    if (this.comparison && !terminalComparison(this.comparison)) this.polling.watchComparison(session.session_id, this.comparison.comparison_id);
  }
  selectAlternative(id: string): Promise<DispatchSnapshot> {
    if (!this.snapshot || this.snapshot.backend?.stale || this.queuedOperations || this.commands.read() || !this.snapshot.planState.proposedAlternatives.some(p => p.id === id)) {
      return Promise.reject(new Member3Error("PREVIEW_UNAVAILABLE", "No current certified forecast is available for preview."));
    }
    this.pointer.previewJobId = id; this.persist();
    return Promise.resolve(this.publish(this.snapshot));
  }
  acceptSelectedPlan(): Promise<DispatchSnapshot> {
    if (this.acceptFlight) return this.acceptFlight;
    const pending = this.commands.read();
    if (!pending && (!this.snapshot || this.queuedOperations || !canAcceptSelectedPlan(this.snapshot))) {
      return Promise.reject(new Member3Error("ACCEPT_UNAVAILABLE", "Select a current certified plan from a fresh world before Accept."));
    }
    this.acceptFlight = this.enqueue(() => this.performAccept()).finally(() => { this.acceptFlight = undefined; });
    return this.acceptFlight;
  }
  private async readAcceptances(sid: string) {
    const audit = await this.client.acceptances(sid);
    if (audit.acceptances.some(r => r.input_basis.build_sha256 !== this.pointer.session?.build_sha256)) throw new Member3Error("INVALID_RESPONSE", "Acceptance history belongs to another build.");
    this.acceptances = audit.acceptances;
  }
  private async performAccept(): Promise<DispatchSnapshot> {
    const session = this.pointer.session;
    if (!session) throw new Member3Error("ACCEPT_UNAVAILABLE", "No server session is loaded.");
    const existing = this.commands.read();
    if (existing && (existing.operation !== "accept" || existing.sessionId !== session.session_id)) throw new Member3Error("PENDING_COMMAND", "Another backend command needs reconciliation.");
    if (!existing) {
      await this.readWorld(session);
      if (!canAcceptSelectedPlan(this.snapshot!)) throw new Member3Error("ACCEPT_UNAVAILABLE", "Proposal is no longer current; re-optimize before Accept.");
    }
    const proposal = this.snapshot!.planState.proposedAlternatives.find(p => p.id === this.snapshot!.planState.selectedAlternativeId);
    const intent = existing ? { operation: existing.operation, sessionId: existing.sessionId, resourceId: existing.resourceId, body: existing.body, inputBasis: existing.inputBasis } :
      { operation: "accept", sessionId: session.session_id, resourceId: proposal!.origin!.kind === "MEMBER3" ? proposal!.origin!.jobId : "",
        body: { expected_revision: expectedRevision(this.snapshot!.backend!.basis) }, inputBasis: this.snapshot!.backend!.basis };
    const pending = this.beginCommand(intent);
    if (!pending.resourceId || !pending.inputBasis || parseBasis(pending.inputBasis).session_id !== session.session_id ||
        pending.inputBasis.build_sha256 !== session.build_sha256 ||
        JSON.stringify(pending.body) !== JSON.stringify({ expected_revision: expectedRevision(pending.inputBasis) })) throw new Member3Error("INVALID_RESPONSE", "Stored Accept intent has invalid revision/basis binding.");
    this.publish(this.snapshot!);
    let result;
    try { result = await this.retryCommand(() => this.client.accept(session.session_id, pending.resourceId!, { ...pending.body, request_id: pending.requestId } as AcceptPlanRequest)); }
    catch (error) {
      if (error instanceof Member3Error && error.status === 409 && ["STALE_HEAD", "JOB_STALE", "WITNESS_REQUIRED", "WITNESS_INVALID"].includes(error.code)) {
        this.completeCommand(pending.requestId);
        await this.readWorld(session); await this.readAcceptances(session.session_id);
      }
      throw error;
    }
    if (!sameBasis(result.receipt.input_basis, pending.inputBasis)) throw new Member3Error("INVALID_RESPONSE", "Accept receipt differs from original intent basis.");
    // Never publish the receipt or response view as current physical authority.
    const world = await this.readWorld(session, undefined, false);
    await this.readAcceptances(session.session_id);
    if (!this.acceptances.some(r => r.acceptance_id === result.receipt.acceptance_id)) this.acceptances = [result.receipt, ...this.acceptances];
    this.completeCommand(pending.requestId);
    return this.publish(world, true);
  }
  triggerFixtureEvent(_id: string) { return this.unsupported(); }
  setUrgentOrderEnabled(_enabled: boolean) { return this.unsupported(); }
  pickupOrder(_input: { vehicleId: string; orderId: string }) { return this.unsupported(); }
  deliverOrder(_input: { vehicleId: string; orderId: string }) { return this.unsupported(); }
  advanceDemoClock(_minutes: number) { return this.unsupported(); }
  resetDemoSession() { return this.unsupported(); }
}
