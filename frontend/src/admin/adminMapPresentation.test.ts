import { describe, expect, it } from "vitest";
import { MockStateEngine } from "../mocks/engine/MockStateEngine";
import { createAdminMapPresentation } from "./adminMapPresentation";

function acceptedS0() {
  const engine = new MockStateEngine();
  const optimized = engine.optimize();
  engine.selectAlternative(optimized.planState.proposedAlternatives[0].id);
  return { engine, snapshot: engine.acceptSelectedPlan(), proposal: optimized.planState.proposedAlternatives[0] };
}

describe("Admin map display preferences and operational legs", () => {
  it.each([{ ids: [] }, { ids: ["V1"] }, { ids: ["V2"] }, { ids: ["V1", "V2"] }])("shows only explicitly enabled vehicle routes: $ids", ({ ids }) => {
    const { snapshot } = acceptedS0();
    const before = structuredClone(snapshot);
    const result = createAdminMapPresentation(snapshot, undefined, ids);
    expect([...new Set(result.scene.accepted.map((s) => s.vehicleId))].sort()).toEqual([...ids].sort());
    expect(result.scene.proposed).toEqual([]);
    expect(result.scene.markers).toHaveLength(6);
    expect(result.scene.markers.filter((m) => m.kind === "vehicle").map((m) => m.id)).toEqual(["V1", "V2"]);
    expect(snapshot).toEqual(before);
  });

  it("defaults to hidden routes without removing markers or rain", () => {
    const engine = new MockStateEngine();
    engine.loadScenario("S4");
    const snapshot = engine.triggerFixtureEvent("S4-E1");
    const result = createAdminMapPresentation(snapshot);
    expect(result.scene.accepted).toEqual([]);
    expect(result.scene.proposed).toEqual([]);
    expect(result.scene.rain).toEqual(snapshot.decisionState.context.rain!.polygon);
    expect(result.scene.markers).toHaveLength(snapshot.decisionState.orders.length + snapshot.decisionState.vehicles.length + snapshot.decisionState.locations.length);
  });

  it("previews one valid selected proposal instead of overlaying the accepted route", () => {
    const { engine } = acceptedS0();
    const snapshot = engine.optimize();
    const proposal = snapshot.planState.proposedAlternatives[1];
    engine.selectAlternative(proposal.id);
    const result = createAdminMapPresentation(engine.getSnapshot(), proposal, ["V2"]);
    expect(result.source).toBe("PROPOSED");
    expect(result.scene.accepted).toEqual([]);
    expect(result.scene.proposed.map((s) => s.coordinates)).toEqual(proposal.content.vehiclePlans.find((v) => v.vehicleId === "V2")!.routeSegments.filter((s) => !s.toStopId.endsWith("return-depot")).map((s) => s.geometry.coordinates));
  });

  it.each(["session", "version", "selection"])("rejects a proposal with invalid %s binding", (field) => {
    const { snapshot, proposal } = acceptedS0();
    const candidate = structuredClone(proposal);
    snapshot.planState.proposedAlternatives = [candidate];
    snapshot.planState.selectedAlternativeId = candidate.id;
    if (field === "session") candidate.generatedForSessionId = "foreign-session";
    if (field === "version") candidate.generatedForStateVersion += 1;
    if (field === "selection") snapshot.planState.selectedAlternativeId = null;
    const result = createAdminMapPresentation(snapshot, candidate, ["V1"]);
    expect(result.source).toBe("ACCEPTED");
    expect(result.scene.proposed).toEqual([]);
    expect(result.scene.accepted.length).toBeGreaterThan(0);
  });

  it("colors operational legs rather than individual EDGE actions, keeping all supplied points", () => {
    const { snapshot } = acceptedS0();
    const first = createAdminMapPresentation(snapshot, undefined, ["V1", "V2"]);
    const second = createAdminMapPresentation(snapshot, undefined, ["V1", "V2"]);
    const v2 = first.scene.accepted.filter((s) => s.vehicleId === "V2");
    const legs = first.legs.filter((leg) => leg.vehicleId === "V2");
    expect(legs.map((leg) => leg.targetLabel)).toEqual(["O003", "O001"]);
    expect(new Set(legs.map((leg) => leg.color)).size).toBe(2);
    for (const leg of legs) {
      const edges = v2.filter((edge) => edge.legId === leg.id);
      expect(edges.length).toBeGreaterThan(1);
      expect(new Set(edges.map((edge) => edge.color))).toEqual(new Set([leg.color]));
    }
    const source = snapshot.planState.acceptedPlans[0].plan.vehiclePlans.find((v) => v.vehicleId === "V2")!;
    expect(source.routeSegments.some((s) => s.toStopId.endsWith("return-depot"))).toBe(true);
    expect(v2.map((s) => s.coordinates)).toEqual(source.routeSegments.filter((s) => !s.toStopId.endsWith("return-depot")).map((s) => s.geometry.coordinates));
    expect(first).toEqual(second);
    expect(first.legs.find((leg) => leg.vehicleId === "V1")!.color).toBe("#2563eb");
    expect(legs[0].color).toBe("#16a34a");
    expect(legs[1].color).toBe("#14532d");
  });

  it("hides completed travel while preserving the original next-leg color and geometry", () => {
    const { engine, snapshot } = acceptedS0();
    const before = createAdminMapPresentation(snapshot, undefined, ["V2"]);
    const nextLeg = before.legs.find((leg) => leg.vehicleId === "V2" && leg.targetLabel === "O001")!;
    for (const orderId of ["O003", "O001"]) engine.pickupOrder({ vehicleId: "V2", orderId });
    engine.deliverOrder({ vehicleId: "V2", orderId: "O003" });
    const result = createAdminMapPresentation(engine.getSnapshot(), undefined, ["V2"]);
    expect(result.legs.map((leg) => leg.targetLabel)).toEqual(["O001"]);
    expect(result.legs[0]).toEqual(nextLeg);
    expect(result.scene.accepted[0].coordinates).toEqual(before.scene.accepted.find((s) => s.legId === nextLeg.id)!.coordinates);
    expect(result.scene.accepted.every((s) => !s.completed)).toBe(true);
  });
});
