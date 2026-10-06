export type M3ScenarioId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";
export interface M3Diagnostic { severity: "ERROR" | "WARNING"; code: string; path: string; message: string }
export interface M3Envelope<T> {
  schema_version: "saferoute-m3-http-response/1";
  request_id: string;
  status: "OK" | "ERROR";
  data: T | null;
  diagnostics: M3Diagnostic[];
}
export interface M3Basis {
  session_id: string;
  head_version: string;
  generation: string;
  build_sha256: string;
  root_sha256: string;
  head_sha256: string;
  source_sha256: string;
  context_version: string;
  overlay_sha256: string | null;
}
export interface M3WorldView {
  schema_version: string;
  basis: M3Basis;
  current_time: string;
  execution_mode: "SIMULATED_REPLAY";
  real_world_observation: false;
}
export interface M3Vehicle {
  vehicle_id: string;
  availability: "AVAILABLE" | "UNAVAILABLE";
  capacity_kg: number;
  current_load_kg: number;
  onboard_order_ids: string[];
  remaining_range_m: number;
  position: { kind: string; coordinates: [number, number]; node_id?: number | string; position_source?: "SIMULATED" };
  position_timestamp?: string;
  planned_suffix?: string[];
  activity?: string;
}
export interface M3ExecutionView extends M3WorldView {
  schema_version: "task02-m2-execution-view/2";
  order_ids: string[];
  delivered_prefix: string[];
  planned_served_suffix: string[];
  vehicles: M3Vehicle[];
  unserved: Array<{ order_id: string; reason: string; owner_vehicle_id?: string | null }>;
  pending_event_ids: string[];
  accepted_trajectory: Record<string, unknown> | null;
  active_job_id: string | null;
  observed_metrics: Record<string, number> | null;
  planned_suffix_metrics: Record<string, number> | null;
  projected_whole_metrics: Record<string, number> | null;
  metric_scope: "OBSERVED_PREFIX_ONLY";
}
export interface M3Projection extends M3WorldView {
  units: { distance: "m"; duration: "s"; mass: "kg"; money: "VND" };
}
export interface M3OrdersView extends M3Projection {
  schema_version: "saferoute-m3-orders-view/1";
  orders: Array<{ order_id: string; status: "WAITING" | "ONBOARD" | "DELIVERED"; owner_vehicle_id: string | null;
    planned_in_accepted_suffix: boolean; unserved_reason: string | null; demand_kg: number; priority: number;
    pickup_location_id: string; delivery_region_id: string; graph_node_id: string; coordinates: [number, number];
    service_time_s: number; earliest: string; preferred_due: string; hard_deadline: string }>;
}
export interface M3VehiclesView extends M3Projection {
  schema_version: "saferoute-m3-vehicles-view/1";
  vehicles: M3Vehicle[];
  vehicle_metadata: Array<{ vehicle_id: string; vehicle_type: string; cost_per_km_vnd: number; range_m: number; working_start: string; working_end: string }>;
}
export interface M3LocationsView extends M3Projection {
  schema_version: "saferoute-m3-locations-view/1";
  locations: Array<{ location_id: string; kind: "DEPOT" | "DELIVERY"; order_id?: string; graph_node_id: string;
    coordinates: [number, number]; opening_time?: string; closing_time?: string }>;
}
export interface M3Session { session_id: string; scenario_id: M3ScenarioId; build_sha256: string; catalog_sha256: string; fixture_sha256: string }
export interface M3LoadedSession { schema_version: "saferoute-m3-loaded-session/1"; session: M3Session; execution_view: M3ExecutionView }
export interface M3Catalog {
  schema_version: "saferoute-m3-scenario-catalog/1";
  catalog_sha256: string;
  execution_mode: "SIMULATED_REPLAY";
  real_world_observation: false;
  scenarios: Array<{ scenario_id: M3ScenarioId; fixture_sha256: string; initial_time: string; order_count: number; vehicle_count: number }>;
}
export interface M3Capabilities { schema_version: "task02-m2-runtime-capabilities/1"; build_sha256: string; [key: string]: unknown }
export interface M3Ready { ready: boolean; checks: Record<string, string>; execution_mode: "SIMULATED_REPLAY" }
