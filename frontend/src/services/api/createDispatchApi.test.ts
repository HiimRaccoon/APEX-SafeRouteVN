import { describe, expect, it } from "vitest";
import { createDispatchApi } from "./createDispatchApi";
import { BackendDispatchApi } from "./BackendDispatchApi";
import { MockDispatchApi } from "./MockDispatchApi";

describe("dispatch environment selection", () => {
  it("uses backend when explicitly configured and preserves mock/offline defaults", () => {
    expect(createDispatchApi({ VITE_DISPATCH_MODE: "backend", VITE_M3_BASE_URL: "http://127.0.0.1:8000" })).toBeInstanceOf(BackendDispatchApi);
    expect(createDispatchApi({ VITE_DISPATCH_MODE: "mock" })).toBeInstanceOf(MockDispatchApi);
    expect(createDispatchApi({})).toBeInstanceOf(MockDispatchApi);
  });
  it("does not silently choose mock for an invalid configured mode", () => {
    expect(() => createDispatchApi({ VITE_DISPATCH_MODE: "backedn" })).toThrow(/VITE_DISPATCH_MODE/);
  });
});
