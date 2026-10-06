# Member 3 Phase 1 implementation plan

**Goal:** Load an authenticated native M3 session and render its current world in the existing frontend.

**Spec:** The user's PHASE 1 request in this conversation is the approved scope and file/interface design. Execute inline in the current workspace; no Git repository is present and no commit or push is requested.

**Architecture:** A typed M3 HTTP client unwraps the documented response envelope and preserves diagnostics. BackendDispatchApi implements the existing DispatchApi read/load flow without importing fixtureCatalog, road packs or mock engines. DispatchContext chooses backend or mock using Vite environment configuration; injected APIs continue to work in tests.

**Constraints:** Keep UI layout and mock implementation unchanged. Do not implement Optimize, Select, Accept, Event, Pickup/Delivered or Replay. Do not fabricate accepted plans or routes. Real bearer tokens stay out of source, build artifacts, reports and evidence; browser credentials use session storage or an injected token provider. Backend session persistence contains only a server-scoped session/scenario pointer and always re-reads M3.

## Tasks

- [x] Capture hashes of existing frontend files and protected mock/plan modules before edits.
- [x] Write failing transport tests for envelope/authentication/errors and adapter tests for state projection, revision consistency, refresh authority and unsupported operations.
- [x] Add member3 client.ts/types.ts/errors.ts; map M3 orders, vehicles, depot/delivery locations, time and execution mode to the frontend snapshot. Validate session/basis/time agreement across reads; reject inconsistent or malformed responses without fallback.
- [x] Add BackendDispatchApi.ts and environment selection; preserve MockDispatchApi and all injected API tests. Handle initial read errors and unsubscribe correctly in DispatchContext without changing layout.
- [x] Add non-secret env example and operator documentation. Configure a private native M3 installation using the supplied release and runbook; do not change backend/runtime source.
- [x] Run full frontend tests, typecheck and build. Start native M3 and backend-mode Vite, select S1 in a real browser, capture authenticated HTTP responses and rendered state, then refresh with poisoned old mock localStorage.
- [x] Hash-check protected modules and report changed files, test counts, native session ID, eight orders, two vehicles, M3 locations/time/mode, and any acceptance limitations.

## Review focus

Tests cover network/auth/server errors with no mock fallback; missing or wrong schema; changed revision/session across projections; no accepted trajectory in a fresh session; old mock storage ignored on refresh; and unsupported actions cause no HTTP writes. Decimal-string int64 revisions and graph IDs must not silently lose precision.
