"""
Structured JSON logging configuration for the ML service.

Configures container-friendly stdout logging, rotating application logs,
and a dedicated JSONL audit stream for prediction analysis.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from app.core.config import settings

_LOG_MAX_BYTES = 10 * 1024 * 1024
_LOG_BACKUP_COUNT = 5
_PREDICTION_AUDIT_LOGGER_NAME = "prediction_audit"

_STANDARD_RECORD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys())


class JSONFormatter(logging.Formatter):
    """Emit each log record as a single JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        log_entry.update(_collect_extra_fields(record))
        return json.dumps(log_entry, default=str)


class JSONLineFormatter(logging.Formatter):
    """Emit audit records as one compact JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": record.getMessage(),
        }

        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        log_entry.update(_collect_extra_fields(record))
        return json.dumps(log_entry, default=str)


def _collect_extra_fields(record: logging.LogRecord) -> dict:
    extra_fields: dict = {}
    for key, value in record.__dict__.items():
        if key in _STANDARD_RECORD_ATTRS or key.startswith("_"):
            continue
        if value is not None:
            extra_fields[key] = value
    return extra_fields


def _make_rotating_handler(path, formatter: logging.Formatter, *, level: int | None = None) -> RotatingFileHandler:
    handler = RotatingFileHandler(
        path,
        maxBytes=_LOG_MAX_BYTES,
        backupCount=_LOG_BACKUP_COUNT,
        encoding="utf-8",
        delay=True,
    )
    handler.setFormatter(formatter)
    if level is not None:
        handler.setLevel(level)
    return handler


def setup_logging(log_level: str = "INFO") -> None:
    """Configure structured JSON logging for the entire application."""
    settings.log_dir.mkdir(parents=True, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(console_handler)

    app_log_handler = _make_rotating_handler(settings.log_dir / "app.log", JSONFormatter())
    error_log_handler = _make_rotating_handler(
        settings.log_dir / "error.log",
        JSONFormatter(),
        level=logging.WARNING,
    )
    root_logger.addHandler(app_log_handler)
    root_logger.addHandler(error_log_handler)

    audit_logger = logging.getLogger(_PREDICTION_AUDIT_LOGGER_NAME)
    audit_logger.handlers.clear()
    audit_logger.setLevel(logging.INFO)
    audit_logger.propagate = False
    audit_handler = _make_rotating_handler(
        settings.log_dir / "predictions.jsonl",
        JSONLineFormatter(),
        level=logging.INFO,
    )
    audit_logger.addHandler(audit_handler)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True

    # Quiet down noisy libraries.
    for name in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)


def log_prediction_audit(**fields) -> None:
    """Write a single structured prediction audit event."""
    logging.getLogger(_PREDICTION_AUDIT_LOGGER_NAME).info("prediction_audit", extra=fields)
