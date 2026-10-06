import type { DispatchSnapshot, ProposedAlternative } from "../types/dispatch";
import type { GeoJsonPolygon } from "../types/scenario";

type Point = [longitude: number, latitude: number];

export interface MapSegment {
  id: string;
  vehicleId: string;
  coordinates: Point[];
  completed: boolean;
  geometrySource: "SCHEMATIC_DEMO" | "MEMBER2_SUPPLIED";
  /** Shared presentation metadata; never changes route geometry. */
  legId?: string;
  color?: string;
}

export interface MapMarker {
  id: string;
  kind: "depot" | "order" | "vehicle";
  coordinates: Point;
  label: string;
  urgent?: boolean;
  unavailable?: boolean;
}

export interface MapScene {
  accepted: MapSegment[];
  proposed: MapSegment[];
  markers: MapMarker[];
  rain: GeoJsonPolygon | null;
  vehicleColors?: Record<string, string>;
}

export function createMapScene(snapshot: DispatchSnapshot, proposed?: ProposedAlternative, vehicleId?: string): MapScene {
  const active = snapshot.planState.acceptedPlans.find((plan) => plan.id === snapshot.planState.activeAcceptedPlanId);
  const accepted = active?.plan.vehiclePlans.filter((vehicle) => !vehicleId || vehicle.vehicleId === vehicleId).flatMap((vehicle) => {
    const completed = new Set(snapshot.executionState.progressByPlanId[active.id]?.[vehicle.vehicleId]?.completedSegmentIds ?? []);
    return vehicle.routeSegments.map((segment) => ({
      id: segment.id,
      vehicleId: vehicle.vehicleId,
      coordinates: segment.geometry.coordinates,
      completed: completed.has(segment.id),
      geometrySource: segment.geometrySource ?? "SCHEMATIC_DEMO"
    }));
  }) ?? [];
  const preview = vehicleId ? [] : proposed?.content.vehiclePlans.flatMap((vehicle) => vehicle.routeSegments.map((segment) => ({
    id: segment.id,
    vehicleId: vehicle.vehicleId,
    coordinates: segment.geometry.coordinates,
    completed: false,
    geometrySource: segment.geometrySource ?? "SCHEMATIC_DEMO"
  }))) ?? [];
  const driverOrderIds = vehicleId ? new Set(active?.plan.vehiclePlans.find((vehicle) => vehicle.vehicleId === vehicleId)?.orderedStops.flatMap((stop) => stop.orderIds) ?? []) : null;
  return {
    accepted,
    proposed: preview,
    rain: snapshot.decisionState.context.rain?.polygon ?? null,
    markers: [
      ...snapshot.decisionState.locations.filter((location) => location.kind !== "DELIVERY").map((location): MapMarker => ({
        id: location.id, kind: "depot", coordinates: [location.longitude, location.latitude], label: `Depot ${location.id}`
      })),
      ...snapshot.decisionState.orders.filter((order) => !driverOrderIds || driverOrderIds.has(order.id)).map((order): MapMarker => ({
        id: order.id, kind: "order", coordinates: [order.longitude, order.latitude], label: `${order.id} · ${order.status}`,
        urgent: order.priority >= 3
      })),
      ...snapshot.decisionState.vehicles.filter((vehicle) => !vehicleId || vehicle.id === vehicleId).map((vehicle): MapMarker => ({
        id: vehicle.id, kind: "vehicle", coordinates: [vehicle.currentPosition.longitude, vehicle.currentPosition.latitude],
        label: `${vehicle.id} · ${vehicle.availability}`, unavailable: vehicle.availability === "UNAVAILABLE"
      }))
    ]
  };
}
