import type { VehiclePlan } from "../types/dispatch";

const PALETTES: Record<string, readonly string[]> = {
  V1: ["#2563eb", "#06b6d4", "#4f46e5", "#0284c7", "#38bdf8", "#1e40af"],
  V2: ["#16a34a", "#14532d", "#65a30d", "#22c55e", "#14b8a6", "#15803d"]
};
const FALLBACK_PALETTE = ["#475569", "#94a3b8", "#64748b", "#334155"];

export function vehicleRouteColor(vehicleId: string): string {
  return (PALETTES[vehicleId] ?? FALLBACK_PALETTE)[0];
}

export interface RouteLeg {
  id: string;
  vehicleId: string;
  number: number;
  targetLabel: string;
  color: string;
}

/** Assign colors to supplied stop-to-stop legs before filtering progress.
 * No coordinates are generated or modified. Return forecasts stay in the plan.
 */
export function describeRouteLegs(vehicle: VehiclePlan): { legs: RouteLeg[]; bySegmentId: Map<string, RouteLeg> } {
  const palette = PALETTES[vehicle.vehicleId] ?? FALLBACK_PALETTE;
  const groups = new Map<string, RouteLeg>();
  const bySegmentId = new Map<string, RouteLeg>();
  for (const segment of vehicle.routeSegments) {
    if (segment.toStopId.endsWith("return-depot")) continue;
    const key = JSON.stringify([segment.fromStopId, segment.toStopId]);
    let leg = groups.get(key);
    if (!leg) {
      const target = vehicle.orderedStops.find((s) => s.id === segment.toStopId);
      const number = groups.size + 1;
      leg = {
        id: `${vehicle.vehicleId}:${key}`,
        vehicleId: vehicle.vehicleId,
        number,
        targetLabel: target?.kind === "DELIVERY" ? target.orderIds.join(", ") : target?.kind === "DEPOT_PICKUP" ? "Depot pickup" : segment.toStopId,
        color: palette[(number - 1) % palette.length]
      };
      groups.set(key, leg);
    }
    bySegmentId.set(segment.id, leg);
  }
  return { legs: [...groups.values()], bySegmentId };
}
