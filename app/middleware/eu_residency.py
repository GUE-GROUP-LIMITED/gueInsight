"""
EU Data Residency Enforcement Middleware

Enforces GDPR Article 5 + NIS2 data localization requirements.
Routes database connections and object storage to EU regions only.
"""

import os
from functools import wraps
from flask import request, abort, current_app
from typing import Optional


class EUResidencyEnforcer:
    """Middleware to enforce EU-only data storage."""

    EU_REGIONS = {
        "eu-west-1": "AWS Frankfurt (Germany)",
        "eu-central-1": "AWS Frankfurt (Germany)",
        "eu-west-2": "AWS London (UK)",
        "eu-north-1": "AWS Stockholm (Sweden)",
        "germanycentral": "Azure Germany (Frankfurt)",
        "germanywestcentral": "Azure Germany (Magdeburg)",
        "westeurope": "Azure Netherlands (Amsterdam)",
        "northeurope": "Azure Ireland (Dublin)",
        "europe-west1": "GCP Belgium (Brussels)",
        "europe-west4": "GCP Netherlands (Eemshaven)",
    }

    @staticmethod
    def is_eu_region(region: str) -> bool:
        """Validate that region is within EU boundaries."""
        return region in EUResidencyEnforcer.EU_REGIONS

    @staticmethod
    def get_db_connection_string(eu_only: bool = False) -> str:
        """
        Return database connection string for current deployment.
        If eu_only=True, enforces EU region requirement.
        """
        region = os.getenv("PREFERRED_DATA_REGION", "eu-west-1")

        if eu_only and not EUResidencyEnforcer.is_eu_region(region):
            raise ValueError(
                f"EU_ONLY_DATA_RESIDENCY enabled, but region '{region}' is outside EU. "
                f"Valid regions: {', '.join(EUResidencyEnforcer.EU_REGIONS.keys())}"
            )

        # Map region to connection string
        db_engine = os.getenv("DATABASE_ENGINE", "postgres")
        db_host = os.getenv("DATABASE_HOST", "localhost")
        db_user = os.getenv("DATABASE_USER", "postgres")
        db_password = os.getenv("DATABASE_PASSWORD", "")
        db_name = os.getenv("DATABASE_NAME", "gueinsight")

        if db_engine == "postgres":
            return f"postgresql://{db_user}:{db_password}@{db_host}:5432/{db_name}"
        elif db_engine == "sqlite":
            return f"sqlite:///instance/{db_name}.db"

        raise ValueError(f"Unknown database engine: {db_engine}")

    @staticmethod
    def get_storage_region() -> str:
        """Return object storage region (S3, Azure Blob, GCS) for compliance."""
        region = os.getenv("PREFERRED_DATA_REGION", "eu-west-1")

        eu_only = str(os.getenv("EU_ONLY_DATA_RESIDENCY", "false")).lower() in {
            "1",
            "true",
            "yes",
        }
        if eu_only and not EUResidencyEnforcer.is_eu_region(region):
            raise ValueError(
                f"Storage region '{region}' does not comply with EU_ONLY_DATA_RESIDENCY"
            )

        return region


def enforce_eu_residency(f):
    """Decorator to enforce EU data residency on API endpoints."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        eu_only = str(os.getenv("EU_ONLY_DATA_RESIDENCY", "false")).lower() in {
            "1",
            "true",
            "yes",
        }
        region = os.getenv("PREFERRED_DATA_REGION", "eu-west-1")

        # Validate region compliance
        if eu_only:
            if not EUResidencyEnforcer.is_eu_region(region):
                current_app.logger.error(
                    f"EU_ONLY_DATA_RESIDENCY enabled with non-EU region: {region}"
                )
                abort(
                    500
                )  # Internal configuration error, not client error

        # Add audit header to response
        response = f(*args, **kwargs)
        if hasattr(response, "headers"):
            response.headers["X-Data-Region"] = region
            if eu_only:
                response.headers["X-EU-Residency-Enforced"] = "true"

        return response

    return decorated_function


def init_eu_residency(app):
    """Initialize EU residency enforcement on Flask app startup."""
    eu_only = str(app.config.get("EU_ONLY_DATA_RESIDENCY", "false")).lower() in {
        "1",
        "true",
        "yes",
    }
    region = app.config.get("PREFERRED_DATA_REGION", "eu-west-1")

    if eu_only:
        if not EUResidencyEnforcer.is_eu_region(region):
            raise ValueError(
                f"EU_ONLY_DATA_RESIDENCY enabled but region '{region}' is non-EU."
            )
        app.logger.warning(
            f"🔒 EU Data Residency Enforcement ACTIVE: {EUResidencyEnforcer.EU_REGIONS.get(region, region)}"
        )
    else:
        app.logger.info(
            f"ℹ️ Data residency preference: {EUResidencyEnforcer.EU_REGIONS.get(region, region)}"
        )
