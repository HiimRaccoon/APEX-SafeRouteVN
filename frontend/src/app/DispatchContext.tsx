import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DispatchSnapshot } from "../shared/types/dispatch";
import type { DispatchApi } from "../services/api/DispatchApi";
import { createDispatchApi } from "../services/api/createDispatchApi";
import { Member3Error } from "../integrations/member3/errors";
import { DispatchError, type DispatchErrorCode } from "../mocks/engine/MockStateEngine";

let defaultApi: DispatchApi | undefined;
function getDefaultApi() { return defaultApi ??= createDispatchApi(); }

interface DispatchContextValue {
  api: DispatchApi;
  snapshot: DispatchSnapshot | null;
  pending: boolean;
  error: string | null;
  invoke(operation: () => Promise<DispatchSnapshot>): Promise<void>;
}

const DispatchContext = createContext<DispatchContextValue | null>(null);

const errorMessages: Record<DispatchErrorCode, string> = {
  EVENT_ALREADY_TRIGGERED: "Only one event can be triggered in this demo round.",
  EVENT_NOT_READY: "This event or plan is not ready.",
  EVENT_WINDOW_EXPIRED: "The event window has expired.",
  NO_SELECTED_ALTERNATIVE: "Select a plan before dispatching.",
  STALE_PROPOSAL: "This proposal is outdated. Re-optimize to continue.",
  NO_ACTIVE_PLAN: "No dispatch plan has been assigned yet.",
  VEHICLE_UNAVAILABLE: "This vehicle is unavailable.",
  INVALID_CURRENT_STOP: "This order is not at the current stop.",
  URGENT_ORDER_NOT_CANCELLABLE: "The urgent order cannot be cancelled after pickup. Reset the demo to start a new round.",
  INVALID_ORDER_STATE: "This order cannot be updated in its current state."
};

function toMessage(error: unknown): string {
  if (error instanceof Member3Error) return `${error.code}: ${error.message}${error.requestId ? ` (request ${error.requestId})` : ""}`;
  if (error instanceof DispatchError) return errorMessages[error.code];
  return "The demo action could not be completed.";
}

export function DispatchProvider({ api = getDefaultApi(), children }: { api?: DispatchApi; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<DispatchSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setPending(true);
    setError(null);
    const unsubscribe = api.subscribe((next) => {
      if (active) {
        setSnapshot(next);
        if (next.backend) setError(next.backend.error ? `${next.backend.error.code}: ${next.backend.error.message}` : null);
      }
    });
    void api.getSnapshot()
      .then((next) => { if (active) { setSnapshot(next); if (next.backend?.error) setError(`${next.backend.error.code}: ${next.backend.error.message}`); } })
      .catch((reason) => { if (active) setError(toMessage(reason)); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; unsubscribe(); };
  }, [api]);

  const value = useMemo<DispatchContextValue>(() => ({
    api,
    snapshot,
    pending,
    error,
    async invoke(operation) {
      setPending(true);
      setError(null);
      try {
        const next = await operation();
        setSnapshot(next);
      } catch (reason) {
        setError(toMessage(reason));
      } finally {
        setPending(false);
      }
    }
  }), [api, error, pending, snapshot]);

  return <DispatchContext.Provider value={value}>{children}</DispatchContext.Provider>;
}

export function useDispatch() {
  const context = useContext(DispatchContext);
  if (!context) throw new Error("useDispatch phải nằm trong DispatchProvider.");
  return context;
}
