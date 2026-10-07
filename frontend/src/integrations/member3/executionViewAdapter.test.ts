import { expect, it } from "vitest";
import { adaptAcceptedExecution } from "./executionViewAdapter";
import { basis } from "./testFixtures";
import { acceptedView } from "./acceptedTestFixture";
import type { M3ExecutionView } from "./types";
import { createMapScene } from "../../shared/components/mapScene";
import { createAdminMapPresentation } from "../../admin/adminMapPresentation";
import type { DispatchSnapshot } from "../../shared/types/dispatch";

it("preserves_all_edge_points_direction_and_fraction", () => {
  const view = acceptedView(); const original = structuredClone(view);
  const result = adaptAcceptedExecution(view);
  const route = result.planState.acceptedExecution!.segments[0];
  expect(route.coordinates).toEqual([[106.7, 10.8], [106.701, 10.802], [106.702, 10.803]]);
  expect(route.edgeId).toBe("edge-return"); expect(route.actionIndex).toBe(0);
  expect(route.fractionStart).toBe(0.25); expect(route.fractionStartExact).toBe("1/4");
  expect(route.returnToDepot).toBe(true); expect(route.completed).toBe(false);
  expect(view).toEqual(original);
});
it("rejects invalid EDGE identity, custody action and ordering", () => {
  for (const patch of [{ from_node: -1 }, { incoming_edge: 42 }, { end_us: "-1" }, { fraction_start: 0.9, fraction_end: 0.2 }]) {
    const view = acceptedView(); const routes = view.accepted_trajectory!.vehicle_routes as Array<{actions: Array<Record<string, unknown>>}>;
    Object.assign(routes[0].actions[0], patch);
    expect(() => adaptAcceptedExecution(view)).toThrow();
  }
});
it("does not mark actions after the last observation as completed", () => {
  const view = acceptedView(); view.vehicles[0].position_timestamp = "1970-01-01T07:00:01+07:00";
  expect(adaptAcceptedExecution(view).planState.acceptedExecution!.segments[0].completed).toBe(false);
});
it("keeps_proposal_and_accepted_sources_separate", () => {
  const view = acceptedView(); view.accepted_trajectory = null; view.active_job_id = null;
  const result = adaptAcceptedExecution(view);
  expect(result.planState.acceptedExecution).toBeNull();
  expect(result.planState.proposedAlternatives).toEqual([]);
  expect(view.vehicles[0].position_timestamp).toBeUndefined();
  expect(view.vehicles[0].activity).toBeUndefined();
});
it("rejects binding mismatch and malformed source geometry", () => {
  const view = acceptedView(); view.active_job_id = "another-job";
  expect(() => adaptAcceptedExecution(view)).toThrow();
  view.active_job_id = "job-return";
  const route = (view.accepted_trajectory!.vehicle_routes as Array<{actions: Array<Record<string, unknown>>}>)[0];
  route.actions[0].geometry = [[200, 10]];
  expect(() => adaptAcceptedExecution(view)).toThrow();
});
it("dims completed source edges and retains return-only continuation for Admin and Driver", () => {
  const view = acceptedView();
  // current_time is an absolute epoch; route times in the fixture have completed.
  view.vehicles[0].position_timestamp = view.current_time;
  const mapped = adaptAcceptedExecution(view);
  expect(mapped.planState.acceptedExecution!.segments[0].completed).toBe(true);
  const snapshot = { ...mapped, backend: { basis }, decisionState: { vehicles: [], orders: [], locations: [], context: { rain: null } } } as unknown as DispatchSnapshot;
  const driver = createMapScene(snapshot, undefined, "V1");
  expect(driver.accepted).toHaveLength(1); expect(driver.proposed).toEqual([]);
  expect(createMapScene(snapshot, undefined, "V2").accepted).toEqual([]);
  const admin = createAdminMapPresentation(snapshot, undefined, ["V1"]);
  expect(admin.source).toBe("ACCEPTED"); expect(admin.scene.accepted[0].completed).toBe(true);
  expect(admin.scene.accepted[0].coordinates).toEqual(driver.accepted[0].coordinates);
  expect(createAdminMapPresentation(snapshot, undefined, []).scene.accepted).toEqual([]);
});
