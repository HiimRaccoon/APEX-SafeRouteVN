import { describe, expect, it } from "vitest";
import { getFixtureScenario, listFixtureScenarios } from "./fixtureCatalog";

describe("Member 1 fixture catalog", () => {
  it("keeps the pinned S0 contract of three orders and two vehicles", () => {
    const scenario = getFixtureScenario("S0");

    expect(scenario.initialState.orders).toHaveLength(3);
    expect(scenario.initialState.vehicles).toHaveLength(2); // V1, V2
  });

  it("exposes the real fixture event payloads without applying them", () => {
    const urgent = getFixtureScenario("S2").events[0];
    const unavailable = getFixtureScenario("S3").initialState.orders.find((order) => order.id === "O001");
    const rain = getFixtureScenario("S4").events[0];

    expect(urgent).toMatchObject({ type: "URGENT_ORDER", orderPayload: { priority: 3 } });
    expect(unavailable).toMatchObject({ status: "ONBOARD", assignedVehicleId: "V1" });
    expect(rain).toMatchObject({ type: "LOCAL_RAIN_WHAT_IF", polygon: { type: "Polygon" } });
  });

  it("lists only the four Phase 1 scenarios", () => {
    expect(listFixtureScenarios().map((scenario) => scenario.id)).toEqual(["S0", "S2", "S3", "S4"]);
  });
});
