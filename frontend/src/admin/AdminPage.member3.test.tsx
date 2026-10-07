import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { App } from "../app/App";
import { MockDispatchApi } from "../services/api/MockDispatchApi";
import { basis, comparison } from "../integrations/member3/testFixtures";
import { phase2Capabilities } from "../integrations/member3/capabilities";
import type { DispatchSnapshot } from "../shared/types/dispatch";
import type { M3ComparisonView, M3ExecutionView } from "../integrations/member3/types";

class BackendView extends MockDispatchApi {
  constructor(private stale: boolean, private running: boolean, private metrics = false) { super(); }
  override subscribe(_listener: (snapshot: DispatchSnapshot) => void) { return () => {}; }
  override async getSnapshot() {
    const s = await super.getSnapshot(); s.decisionState.sessionId = basis.session_id;
    const c = comparison() as M3ComparisonView;
    if (this.metrics) c.outcome!.comparison!.jobs.forEach(j => { j.metrics = { total_distance_m: 2500, total_travel_time_s: 90, total_exposure: 234, total_cost_vnd: 4000 }; });
    if (this.running) { c.status = "RUNNING"; c.outcome = null; c.jobs[0].view = null; }
    s.backend = { source: "MEMBER3_HTTP", baseUrl: "http://127.0.0.1:8000", executionMode: "SIMULATED_REPLAY", realWorldObservation: false,
      basis, executionView: { observed_metrics: null, planned_suffix_metrics: null, projected_whole_metrics: null } as M3ExecutionView, comparison: c, capabilities: phase2Capabilities(!this.stale), stale: this.stale,
      error: this.stale ? { code: "UNAUTHORIZED", message: "Token expired" } : undefined,
      scenarios: [{ id: "S0", orderCount: 17, vehicleCount: 4, initialTime: "2026-09-27T21:00:00+07:00", fixtureSha256: "a".repeat(64) }] };
    return s;
  }
}
it("renders server lifecycle/verdict without fake metrics, routes or recommendation", async () => {
  render(<MemoryRouter initialEntries={["/admin"]}><App api={new BackendView(false, false)} /></MemoryRouter>);
  expect(await screen.findByText(/Comparison COMPLETED/)).toHaveTextContent("COMPARABLE");
  expect(screen.getByRole("option", { name: /17 orders.*4 vehicles/ })).toBeInTheDocument();
  expect(screen.getAllByText(/Certified witness/)).toHaveLength(3);
  expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Select FASTEST" })).toBeDisabled();
});
it("renders native forecast units and provenance without inventing fuel or observed KPIs", async () => {
  render(<MemoryRouter initialEntries={["/admin"]}><App api={new BackendView(false, false, true)} /></MemoryRouter>);
  expect(await screen.findAllByText("234 proxy")).toHaveLength(3);
  expect(screen.getAllByText("1.5 min")).toHaveLength(3);
  expect(screen.getAllByText("4,000 VND")).toHaveLength(3);
  expect(screen.getAllByText(/MEMBER3_HTTP.*FORECAST_ONLY/)).toHaveLength(3);
  expect(screen.getByLabelText("Backend execution metrics")).toHaveTextContent("OBSERVED_PREFIX_ONLY");
  expect(screen.getByLabelText("Backend execution metrics")).not.toHaveTextContent("234");
  expect(screen.getByRole("button", { name: "Select FASTEST" })).toBeDisabled();
});
it("keeps stale or running Optimize disabled and exposes refresh", async () => {
  render(<MemoryRouter initialEntries={["/admin"]}><App api={new BackendView(true, true)} /></MemoryRouter>);
  expect(await screen.findByRole("button", { name: /^Optimize$/ })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("UNAUTHORIZED");
  expect(screen.getByRole("button", { name: "Refresh backend" })).toBeEnabled();
});
