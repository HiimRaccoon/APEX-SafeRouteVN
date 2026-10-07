Member 2 ownership.

The public forecast extension adds `runtime/forecast.py` and `RuntimeClient.job_forecast` in `runtime/sdk.py`, with test-first regressions in `tests/test_job_forecast.py`. The Git checkout includes the complete verified runtime production source dependency closure, imported unchanged from the received build except these two SDK files. The [supplemental release](../docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md) contains that closure and its newly sealed inventory. The received M1 source/data and pinned native dependencies are still separate prerequisites. Do not combine the new SDK with the historical inventory.

Contains:

candidate_paths/
    generator.py

matrix/
    matrix_builder.py

solver/
    vrptw_solver.py
    rolling_horizon.py

profiles/
    profile_engine.py

Responsibility:
D/T/R/G + DecisionResult FASTEST/BALANCED/SAFER.

## Publication repair ? release revision 2

The r1 publication was rejected because its baseline public handoff lock did not match the shipped SDK. Functional browser receipts remain historical evidence for build c333372; they are not r2 acceptance. The replacement uses SDK task02-m2-runtime-sdk/2 and a generated handoff lock /2 covering job_forecast, forecast schema/units and verifier bytes. It includes the unchanged frozen crosswalk in the production closure. Both sealing and packaging invoke the shipped verify_lock() after inventory verification. Frozen external API v1 is unchanged; baseline-to-v2 compatibility requires explicit migration.

Current release and byte pins: [release guide](../docs/M3_FORECAST_EXTENSION_RELEASE_20261007.md). Fresh native G0/HTTP and release-verification receipts for r2 are separate from the earlier browser run. Reviewer sign-off on Phase 3 remains pending; the earlier DONE statement describes functional gates and is superseded for publication by this repair.
