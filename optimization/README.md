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
