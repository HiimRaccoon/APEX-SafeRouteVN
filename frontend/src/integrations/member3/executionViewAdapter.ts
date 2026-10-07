import type { ExecutionState, PlanProfile, PlanState } from "../../shared/types/dispatch";
import type { MapSegment } from "../../shared/components/mapScene";
import { vehicleRouteColor } from "../../shared/components/routeLegPresentation";
import { finite, line, list, record, string, stringList } from "../member2/validation";
import { parseBasis } from "./revision";
import type { M3ExecutionView } from "./types";

function exact(value: unknown): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^(0|-?[1-9]\d*)$/.test(value)) {
    const result = BigInt(value);
    if (result >= -(1n << 63n) && result < (1n << 63n)) return result;
  }
  throw new Error("Invalid exact action time");
}
function nonnegative(value: unknown, name: string): number {
  const result = finite(value, name);
  if (result < 0) throw new Error(`Negative ${name}`);
  return result;
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(k => !(k in value)) || Object.keys(value).some(k => !required.includes(k) && !optional.includes(k))) throw new Error("Invalid trajectory fields");
}
function node(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid trajectory node");
}
const actionFields: Record<string, string[]> = {
  EDGE: ["edge_id", "from_node", "to_node", "incoming_edge", "fraction_start", "fraction_start_exact", "fraction_end", "geometry", "feature_payload", "distance_m", "exposure", "overlay_sha256", "temporal_policy", "temporal_segments"],
  PICKUP: ["order_id", "node_id", "load_after_kg"], SERVICE: ["order_id", "node_id", "load_after_kg", "continuation"], WAIT: ["node_id", "order_id", "reason"]
};
function epochUs(time: string): bigint {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?\+07:00$/.exec(time);
  if (!match || !Number.isFinite(Date.parse(time))) throw new Error("Invalid execution time");
  return BigInt(Date.parse(`${match[1]}+07:00`)) * 1000n + BigInt((match[2] ?? "").padEnd(6, "0"));
}

/** Projects only accepted public EDGE geometry. Stops and observation timestamps are never invented. */
export function adaptAcceptedExecution(view: M3ExecutionView): { planState: PlanState; executionState: ExecutionState } {
  const basis = { ...parseBasis(view.basis) };
  const planState: PlanState = { acceptedExecution: null, acceptedPlans: [], activeAcceptedPlanId: null, proposedAlternatives: [], selectedAlternativeId: null, operationalPlanAssessment: null };
  const executionState: ExecutionState = { activePlanId: null, progressByPlanId: {} };
  if (view.schema_version !== "task02-m2-execution-view/2" || view.execution_mode !== "SIMULATED_REPLAY" || view.real_world_observation !== false) throw new Error("Invalid execution contract");
  if (view.accepted_trajectory === null) {
    if (view.active_job_id !== null) throw new Error("Active job missing accepted trajectory");
    return { planState, executionState };
  }
  const trajectory = record(view.accepted_trajectory, "accepted_trajectory");
  fields(trajectory, ["job_id", "profile", "forecast", "domain_sha256", "vehicle_routes"]);
  const jobId = string(trajectory.job_id, "job_id");
  if (jobId !== view.active_job_id || trajectory.forecast !== true || !["FASTEST", "BALANCED", "SAFER"].includes(String(trajectory.profile)) ||
      typeof trajectory.domain_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(trajectory.domain_sha256)) throw new Error("Accepted trajectory binding mismatch");
  const now = epochUs(view.current_time);
  const segments: MapSegment[] = [];
  const vehicleIds = new Set<string>(); const served: string[] = [];
  for (const rawRoute of list(trajectory.vehicle_routes, "vehicle_routes")) {
    const route = record(rawRoute, "route"), vehicleId = string(route.vehicle_id, "vehicle_id");
    fields(route, ["vehicle_id", "order_sequence", "actions", "start_us", "return_us", "start_node", "end_node"], ["route_column_id", "return_load_kg", "total_distance_m", "total_travel_time_s", "total_exposure", "total_cost_vnd", "total_soft_lateness_s"]);
    node(route.start_node); node(route.end_node);
    const vehicle = view.vehicles.find(v => v.vehicle_id === vehicleId);
    if (!vehicle || vehicleIds.has(vehicleId)) throw new Error("Accepted route vehicle mismatch");
    vehicleIds.add(vehicleId);
    served.push(...stringList(route.order_sequence, "order_sequence"));
    const actions = list(route.actions, "actions").map(a => record(a, "action"));
    let previous = exact(route.start_us); const end = exact(route.return_us);
    if (end < previous) throw new Error("Reversed route time");
    let leg = 1;
    for (const [index, action] of actions.entries()) {
      const start = exact(action.start_us), finish = exact(action.end_us);
      if (start < previous || finish < start || finish > end) throw new Error("Unordered accepted action times");
      previous = finish;
      if (!["EDGE", "PICKUP", "SERVICE", "WAIT"].includes(String(action.kind))) throw new Error("Unknown accepted action");
      fields(action, ["kind", "start_us", "end_us"], actionFields[String(action.kind)]);
      if (action.kind === "PICKUP" || action.kind === "SERVICE") {
        string(action.order_id, "order_id"); node(action.node_id);
        if (finite(action.load_after_kg, "load_after_kg") < -1e-9 || action.kind === "PICKUP" && start !== finish || action.continuation !== undefined && typeof action.continuation !== "boolean") throw new Error("Invalid custody action");
      }
      if (action.kind === "SERVICE") leg++;
      if (action.kind !== "EDGE") continue;
      const edgeId = string(action.edge_id, "edge_id");
      node(action.from_node); node(action.to_node);
      if (action.incoming_edge !== null) string(action.incoming_edge, "incoming_edge");
      const fractionStart = nonnegative(action.fraction_start, "fraction_start"), fractionEnd = nonnegative(action.fraction_end, "fraction_end");
      if (fractionStart > fractionEnd || fractionEnd > 1) throw new Error("Invalid EDGE fraction");
      const fractionStartExact = action.fraction_start_exact;
      if (fractionStartExact !== undefined) {
        if (typeof fractionStartExact !== "string" || !/^(0|[1-9]\d*)(\/[1-9]\d*)?$/.test(fractionStartExact)) throw new Error("Invalid exact EDGE fraction");
        const [n, d = 1n] = fractionStartExact.split("/").map(BigInt);
        if (n > d || d >= (1n << 63n)) throw new Error("Invalid exact EDGE progress");
      }
      record(action.feature_payload, "feature_payload");
      nonnegative(action.distance_m, "distance_m"); nonnegative(action.exposure, "exposure");
      const nextService = actions.slice(index + 1).find(a => a.kind === "SERVICE");
      const returnToDepot = !nextService;
      // A pristine initial view has no observation timestamp. Do not manufacture a completed prefix.
      const observationTime = vehicle.position_timestamp === undefined ? null : epochUs(vehicle.position_timestamp);
      if (observationTime !== null && observationTime > now) throw new Error("Future observation time");
      const completed = observationTime !== null && finish <= observationTime;
      segments.push({ id: `${jobId}:${vehicleId}:action:${index}`, vehicleId, edgeId, actionIndex: index,
        coordinates: line(action.geometry, "EDGE.geometry"), fractionStart, fractionEnd,
        ...(typeof fractionStartExact === "string" ? { fractionStartExact } : {}), returnToDepot,
        completed, geometrySource: "MEMBER2_SUPPLIED", legId: `${vehicleId}:leg:${leg}`, color: vehicleRouteColor(vehicleId) });
    }
    if (actions.length && previous !== end) throw new Error("Route return differs from final action");
  }
  const expected = [...view.delivered_prefix, ...view.planned_served_suffix];
  if (new Set(served).size !== served.length || served.length !== expected.length || served.some(id => !expected.includes(id))) throw new Error("Accepted route service coverage mismatch");
  planState.acceptedExecution = { source: "MEMBER3_HTTP", jobId, profile: trajectory.profile as PlanProfile, basis, segments,
    unserved: view.unserved.map(item => ({ orderId: item.order_id, reason: item.reason })) };
  executionState.activePlanId = jobId;
  return { planState, executionState };
}
