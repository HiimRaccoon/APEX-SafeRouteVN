"""Read verified public forecasts bound to durable server-owned submissions."""
import sqlite3

from backend.api.errors import ApiError
from .runtime_gateway import RuntimeGateway


class ForecastService:
    def __init__(self, settings, repository, sessions, gateway):
        self.settings, self.repository, self.sessions, self.gateway = settings, repository, sessions, gateway

    async def read(self, session_id, job_id):
        try:
            self.sessions.session(session_id)
        except ApiError as error:
            if error.code == "INSTALLATION_BINDING_CHANGED":
                raise ApiError(503, error.code, "runtime", "Forecast installation binding changed") from error
            raise
        try:
            row = self.repository.job(session_id, job_id)
            if row["installation_sha256"] != self.sessions.installation_identity():
                raise ApiError(503, "JOB_BINDING_CHANGED", "runtime", "Forecast submit installation binding changed")
        except (sqlite3.Error, OSError, ValueError, TypeError, KeyError) as error:
            raise ApiError(503, "METADATA_UNAVAILABLE", "jobs", "Job metadata is unavailable") from error
        value = await self.gateway.job_forecast(session_id, job_id)
        try:
            RuntimeGateway.check_forecast(value, session_id, job_id, self.settings.installation()["expected_build_sha256"])
            if value["input_basis"] != row["basis"] or value["profile"] != row["profile"]:
                raise ValueError("Forecast differs from persisted submission")
        except (OSError, ValueError, TypeError, KeyError) as error:
            raise ApiError(503, "JOB_BINDING_CHANGED", "runtime", "Forecast differs from the persisted submit binding") from error
        return value
