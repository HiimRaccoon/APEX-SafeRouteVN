import type { DispatchApi } from "./DispatchApi";
import { BackendDispatchApi } from "./BackendDispatchApi";
import { MockDispatchApi } from "./MockDispatchApi";
import { Member3Client } from "../../integrations/member3/client";
export function createDispatchApi(env: { VITE_DISPATCH_MODE?: string; VITE_M3_BASE_URL?: string } = import.meta.env): DispatchApi {
  const mode = env.VITE_DISPATCH_MODE ?? "mock";
  if (mode === "backend") return new BackendDispatchApi({ client: new Member3Client({ baseUrl: env.VITE_M3_BASE_URL }) });
  if (mode === "mock") return new MockDispatchApi();
  throw new Error("VITE_DISPATCH_MODE must be backend or mock.");
}
