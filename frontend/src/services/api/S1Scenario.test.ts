import { describe, expect, it } from "vitest";
import s1Fixture from "../../../../scenarios/fixtures/thu-duc-binh-thanh-v1/S1.json";
import roadBundle from "../../mocks/data/member2-road-packs.json";
import { buildOfflineRoadAlternatives, type OfflineRoadBundle } from "../../mocks/engine/offlineRoadPlans";
import { MOCK_STORAGE_KEY, MockDispatchApi, type StorageLike } from "./MockDispatchApi";

class TestStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("S1 initial offline roads and dispatch lifecycle", () => {
  it("replaces an executed session with the clean, event-free S1 source state", async () => {
    const api = new MockDispatchApi({ storage: new TestStorage() });
    try {
      const old = await api.optimize();
      await api.selectAlternative(old.planState.proposedAlternatives[0].id);
      const accepted = await api.acceptSelectedPlan();
      const pickup = accepted.planState.acceptedPlans[0].plan.vehiclePlans.flatMap((vehicle) =>
        vehicle.orderedStops.filter((stop) => stop.kind === "DEPOT_PICKUP").map((stop) => ({ vehicleId: vehicle.vehicleId, orderId: stop.orderIds[0] })))[0];
      await api.pickupOrder(pickup);
      const loaded = await api.loadScenario("S1");
      expect(loaded.decisionState.sessionId).not.toBe(old.decisionState.sessionId);
      expect(loaded.decisionState).toMatchObject({
        scenarioId: "S1", version: 1, orders: s1Fixture.initialState.orders,
        vehicles: s1Fixture.initialState.vehicles, locations: s1Fixture.initialState.locations,
        events: [], context: { rain: null }
      });
      expect(loaded.decisionState.orders).toHaveLength(8);
      expect(loaded.decisionState.vehicles).toHaveLength(2);
      expect(loaded.planState).toEqual({ acceptedPlans: [], activeAcceptedPlanId: null,
        proposedAlternatives: [], selectedAlternativeId: null, operationalPlanAssessment: null });
      expect(loaded.executionState).toEqual({ activePlanId: null, progressByPlanId: {} });
      expect(loaded.demo.availableEvents).toEqual([]);
      expect(loaded.demo.roundEventId).toBeNull();
      expect(loaded.demoClock.now).toBe("2026-09-27T21:00:00+07:00");
    } finally { api.dispose(); }
  });

  it("optimizes all three S1 profiles using exact M2 EDGE geometry instead of schematic plans", async () => {
    const api = new MockDispatchApi({ storage: new TestStorage() });
    try {
      const initial = await api.loadScenario("S1");
      const bundle = roadBundle as unknown as OfflineRoadBundle;
      const pack = bundle.packs.find((candidate) => candidate.scenarioId === "S1" && candidate.phase === "INITIAL");
      expect(pack).toBeDefined();
      expect(pack!.certified).toBe(true);
      expect(pack!.initialState).toEqual(s1Fixture.initialState);
      expect(buildOfflineRoadAlternatives(initial.decisionState, bundle)).not.toBeNull();
      const snapshot = await api.optimize();
      const proposals = snapshot.planState.proposedAlternatives;
      expect(proposals.map((proposal) => proposal.content.profile)).toEqual(["FASTEST", "BALANCED", "SAFER"]);
      expect(snapshot.planState.activeAcceptedPlanId).toBeNull();
      for (const proposal of proposals) {
        expect(proposal.content.provenance).toMatchObject({ source: "Member 2 offline runtime", scenarioId: "S1",
          buildSha256: "80694f511dc735d0b6a1a0a830edd7f6267df395e87dad0ccf180914b49d5a41" });
        const witness = pack!.alternatives.find((alternative) => alternative.profile === proposal.content.profile)!;
        expect(witness.scenario_id).toBe("S1");
        expect(["FEASIBLE", "PARTIAL"]).toContain(witness.status);
        expect([...witness.served_orders, ...witness.unserved_orders.map((order) => order.order_id)].sort()).toEqual([
          "O001", "O002", "O003", "O004", "O005", "O006", "O007", "O008"
        ]);
        expect(proposal.content.unserved).toEqual(witness.unserved_orders.map((order) => ({ orderId: order.order_id, reason: order.reason })));
        const segments = proposal.content.vehiclePlans.flatMap((vehicle) => vehicle.routeSegments);
        expect(segments.length).toBeGreaterThan(8);
        expect(segments.every((segment) => segment.geometrySource === "MEMBER2_SUPPLIED")).toBe(true);
        expect(segments.some((segment) => segment.geometry.coordinates.length > 2)).toBe(true);
        for (const vehicle of proposal.content.vehiclePlans) {
          const source = witness.vehicle_routes.find((route) => route.vehicle_id === vehicle.vehicleId);
          expect(vehicle.routeSegments.map((segment) => segment.geometry.coordinates)).toEqual(
            source?.actions.filter((action) => action.kind === "EDGE").map((action) => action.geometry) ?? []);
          expect(vehicle.suppliedActions).toEqual(source?.actions ?? []);
        }
      }
    } finally { api.dispose(); }
  });

  it("keeps S1 proposals out of Driver execution until Accept and restores the exact accepted plan", async () => {
    const storage = new TestStorage();
    const admin = new MockDispatchApi({ storage });
    const driver = new MockDispatchApi({ storage });
    const syncDriver = () => window.dispatchEvent(new StorageEvent("storage", { key: MOCK_STORAGE_KEY, newValue: storage.getItem(MOCK_STORAGE_KEY) }));
    try {
      await admin.loadScenario("S1");
      const optimized = await admin.optimize();
      const selected = optimized.planState.proposedAlternatives[0];
      await admin.selectAlternative(selected.id);
      syncDriver();
      expect((await driver.getSnapshot()).executionState.activePlanId).toBeNull();
      expect((await driver.getSnapshot()).planState.acceptedPlans).toEqual([]);
      const accepted = await admin.acceptSelectedPlan();
      syncDriver();
      const received = await driver.getSnapshot();
      expect(received.executionState.activePlanId).toBe(accepted.planState.activeAcceptedPlanId);
      expect(received.planState.acceptedPlans).toHaveLength(1);
      expect(received.planState.acceptedPlans[0].plan).toEqual(selected.content);
      const hydrated = new MockDispatchApi({ storage });
      try { expect((await hydrated.getSnapshot()).planState.acceptedPlans).toEqual(accepted.planState.acceptedPlans); }
      finally { hydrated.dispose(); }
    } finally { admin.dispose(); driver.dispose(); }
  });
});
