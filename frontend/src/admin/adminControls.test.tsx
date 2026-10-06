import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { MockStateEngine } from "../mocks/engine/MockStateEngine";
import { MOCK_STORAGE_KEY, MockDispatchApi } from "../services/api/MockDispatchApi";
import type { DispatchSnapshot } from "../shared/types/dispatch";

function renderAdmin(initial?: DispatchSnapshot) {
  const stored = new Map<string, string>();
  if (initial) stored.set(MOCK_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, snapshot: initial }));
  const api = new MockDispatchApi({ storage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => { stored.set(key, value); },
    removeItem: (key) => { stored.delete(key); }
  } });
  return { api, user: userEvent.setup(), ...render(<MemoryRouter initialEntries={["/admin"]}><App api={api} /></MemoryRouter>) };
}

describe("Admin controls reflect supported operations", () => {
  it.each([
    { capacities: [4, 6], demands: [6, 3, 2], expected: "Total orders (11 kg) exceed fleet capacity (10 kg)" },
    { capacities: [8, 10], demands: [9, 2, 1], expected: "Order (9 kg) exceeds smallest vehicle capacity (8 kg)" }
  ])("derives capacity warnings from the actual vehicle limits: $expected", async ({ capacities, demands, expected }) => {
    const snapshot = new MockStateEngine().getSnapshot();
    snapshot.decisionState.vehicles.forEach((vehicle, index) => { vehicle.capacityKg = capacities[index]; });
    snapshot.decisionState.orders.forEach((order, index) => { order.demandKg = demands[index]; });
    renderAdmin(snapshot);
    expect(await screen.findByText(expected, { exact: false })).toBeInTheDocument();
  });

  it("keeps the whole sample form read-only and styles Current Queue only from actual priorities", async () => {
    const { api, user, container } = renderAdmin();
    const priority = await screen.findByLabelText("Priority");
    expect(priority).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /add order/i })).toBeDisabled();
    const fields = container.querySelectorAll<HTMLInputElement>(".order-entry-form input");
    expect(fields.length).toBeGreaterThan(5);
    expect([...fields].every((field) => field.readOnly || field.disabled)).toBe(true);
    expect(container.querySelectorAll(".order-entry-form select:not(:disabled)")).toHaveLength(0);
    const initial = await api.getSnapshot();
    await user.type(priority, "Urgent");
    expect(priority).toHaveValue("Normal");
    expect(await api.getSnapshot()).toEqual(initial);
    expect(container.querySelectorAll(".order-queue .row-urgent")).toHaveLength(0);
    await user.click(screen.getByRole("switch", { name: "Urgent Order" }));
    const urgentRows = container.querySelectorAll(".order-queue .row-urgent");
    expect(urgentRows).toHaveLength(1);
    expect(urgentRows[0]).toHaveTextContent("O009");
    expect(priority).toHaveValue("Normal");
    expect(screen.getByText(/current queue/i)).toHaveTextContent("4 orders");
  });

  it("offers fixed profiles without editable weights and calls Optimize without custom objectives", async () => {
    const { api, user } = renderAdmin();
    const optimize = vi.spyOn(api, "optimize");
    await screen.findByText("Fleet / Preferences");
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: /^optimize$/i }));
    expect(optimize).toHaveBeenCalledWith();
    expect((await api.getSnapshot()).planState.proposedAlternatives.map((p) => p.content.profile)).toEqual(["FASTEST", "BALANCED", "SAFER"]);
  });

  it("displays unequal scenario capacities as non-editable values and derives total capacity from state", async () => {
    const snapshot = new MockStateEngine().getSnapshot();
    snapshot.decisionState.vehicles[0].capacityKg = 8;
    snapshot.decisionState.vehicles[1].capacityKg = 10;
    const { api } = renderAdmin(snapshot);
    const first = await screen.findByLabelText("Capacity V1");
    expect(first.tagName).toBe("OUTPUT");
    expect(first).toHaveTextContent("8");
    expect(screen.getByLabelText("Capacity V2")).toHaveTextContent("10");
    expect(screen.getByText("Total capacity: 18 kg")).toBeInTheDocument();
    expect(screen.getAllByText("Scenario capacity")).toHaveLength(2);
    expect(screen.queryByRole("spinbutton", { name: /capacity/i })).not.toBeInTheDocument();
    expect((await api.getSnapshot()).decisionState.vehicles).toEqual(snapshot.decisionState.vehicles);
  });
});
