import type { DispatchSnapshot } from "../../shared/types/dispatch";
import type { ScenarioId } from "../../shared/types/scenario";

export interface DispatchApi {
  capabilities?(): Promise<import("../../integrations/member3/capabilities").DispatchCapabilities>;
  cancelComparison?(): Promise<DispatchSnapshot>;
  getSnapshot(): Promise<DispatchSnapshot>;
  subscribe(listener: (snapshot: DispatchSnapshot) => void): () => void;
  loadScenario(id: ScenarioId): Promise<DispatchSnapshot>;
  optimize(): Promise<DispatchSnapshot>;
  selectAlternative(planId: string): Promise<DispatchSnapshot>;
  acceptSelectedPlan(): Promise<DispatchSnapshot>;
  triggerFixtureEvent(eventId: string): Promise<DispatchSnapshot>;
  setUrgentOrderEnabled(enabled: boolean): Promise<DispatchSnapshot>;
  pickupOrder(input: { vehicleId: string; orderId: string }): Promise<DispatchSnapshot>;
  deliverOrder(input: { vehicleId: string; orderId: string }): Promise<DispatchSnapshot>;
  advanceDemoClock(minutes: number): Promise<DispatchSnapshot>;
  resetDemoSession(): Promise<DispatchSnapshot>;
}
