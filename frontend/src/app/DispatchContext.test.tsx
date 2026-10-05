import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { DispatchError } from "../mocks/engine/MockStateEngine";
import { MockDispatchApi } from "../services/api/MockDispatchApi";

class FailingOptimizeApi extends MockDispatchApi {
  override async optimize(): Promise<never> {
    throw new DispatchError("STALE_PROPOSAL", "Phương án đã cũ.");
  }
}

describe("Dispatch error presentation", () => {
  it("shows a typed API error in English on the Admin screen", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/admin"]}><App api={new FailingOptimizeApi()} /></MemoryRouter>);

    await user.click(await screen.findByRole("button", { name: /^optimize$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This proposal is outdated. Re-optimize to continue.");
  });
});
