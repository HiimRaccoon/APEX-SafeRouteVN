export interface DispatchCapabilities { mode: "backend" | "mock"; optimize: boolean; accept: boolean; applyEvent: boolean; replay: boolean; driverActions: boolean; forecastGeometry: boolean }
// Server ownership is enforced by HTTP; do not infer roles from token contents.
export function phase2Capabilities(fresh: boolean): DispatchCapabilities {
  return { mode: "backend", optimize: fresh, accept: false, applyEvent: false, replay: false, driverActions: false, forecastGeometry: false };
}
