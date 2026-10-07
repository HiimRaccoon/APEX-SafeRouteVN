import { createMapScene, type MapScene, type MapSegment } from "../shared/components/mapScene";
import type { DispatchSnapshot, ProposedAlternative } from "../shared/types/dispatch";
import { proposalCurrency } from "../integrations/member3/revision";
import { describeRouteLegs, vehicleRouteColor, type RouteLeg } from "../shared/components/routeLegPresentation";

export const adminVehicleColor = vehicleRouteColor;
export type AdminRouteLeg = RouteLeg;

export interface AdminMapPresentation {
  scene: MapScene;
  legs: AdminRouteLeg[];
  source: "PROPOSED" | "ACCEPTED" | null;
  completionAvailable?: boolean;
}

/** Read-only projection of the current plan; visibility is never operational state. */
export function createAdminMapPresentation(
  snapshot: DispatchSnapshot,
  selected?: ProposedAlternative,
  visibleVehicleIds: readonly string[] = []
): AdminMapPresentation {
  if (snapshot.backend) {
    const accepted = snapshot.planState.acceptedExecution;
    const base = createMapScene(snapshot);
    const segments = base.accepted.filter(s => visibleVehicleIds.includes(s.vehicleId));
    const byLeg = new Map<string, AdminRouteLeg>();
    const countByVehicle = new Map<string, number>();
    for (const segment of base.accepted) {
      const id = segment.legId ?? segment.id;
      if (!byLeg.has(id)) {
        const next = (countByVehicle.get(segment.vehicleId) ?? 0) + 1;
        const ordinal = /:leg:([1-9]\d*)$/.exec(id)?.[1];
        const number = ordinal && Number.isSafeInteger(Number(ordinal)) ? Number(ordinal) : next;
        countByVehicle.set(segment.vehicleId, number);
        byLeg.set(id, { id, vehicleId: segment.vehicleId, number,
          targetLabel: segment.returnToDepot ? "Mandatory return continuation" : "Planned service", color: segment.color ?? adminVehicleColor(segment.vehicleId) });
      }
    }
    return { scene: { ...base, accepted: segments, proposed: [], vehicleColors: Object.fromEntries(snapshot.decisionState.vehicles.map(v => [v.id, adminVehicleColor(v.id)])) },
      legs: [...byLeg.values()].filter(leg => visibleVehicleIds.includes(leg.vehicleId)), source: accepted ? "ACCEPTED" : null, completionAvailable: false };
  }
  const active = snapshot.planState.acceptedPlans.find((p) => p.id === snapshot.planState.activeAcceptedPlanId);
  const validSelected = selected && snapshot.planState.selectedAlternativeId === selected.id &&
    snapshot.planState.proposedAlternatives.some((p) => p.id === selected.id) &&
    proposalCurrency(selected, snapshot) === "CURRENT" ? selected : undefined;
  const plan = validSelected?.content ?? active?.plan;
  const source = validSelected ? "PROPOSED" : active ? "ACCEPTED" : null;
  const base = createMapScene(snapshot);
  const scene: MapScene = { ...base, accepted: [], proposed: [],
    vehicleColors: Object.fromEntries(snapshot.decisionState.vehicles.map((v) => [v.id, adminVehicleColor(v.id)])) };
  const legs: AdminRouteLeg[] = [];
  for (const vehicle of plan?.vehiclePlans ?? []) {
    if (!visibleVehicleIds.includes(vehicle.vehicleId)) continue;
    const description = describeRouteLegs(vehicle);
    const completed = new Set(source === "ACCEPTED" && active
      ? snapshot.executionState.progressByPlanId[active.id]?.[vehicle.vehicleId]?.completedSegmentIds ?? [] : []);
    const renderedLegIds = new Set<string>();
    const rendered: MapSegment[] = [];
    for (const segment of vehicle.routeSegments) {
      const leg = description.bySegmentId.get(segment.id);
      if (!leg) continue;
      // Assign colors before filtering so progress never renumbers/recolors a remaining leg.
      if (completed.has(segment.id)) continue;
      renderedLegIds.add(leg.id);
      rendered.push({ id: segment.id, vehicleId: vehicle.vehicleId, coordinates: segment.geometry.coordinates,
        completed: false, geometrySource: segment.geometrySource ?? "SCHEMATIC_DEMO", legId: leg.id, color: leg.color });
    }
    legs.push(...description.legs.filter((leg) => renderedLegIds.has(leg.id)));
    if (source === "PROPOSED") scene.proposed.push(...rendered);
    else scene.accepted.push(...rendered);
  }
  return { scene, legs, source };
}
