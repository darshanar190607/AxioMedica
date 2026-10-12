"""
Structured JSON logging configuration and HTTP request logging middleware.
"""
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class JSONFormatter(logging.Formatter):
    """
    Custom Formatter that outputs log records formatted as single-line JSON objects.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Include exception information if available
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        elif record.exc_text:
            log_data["exception"] = record.exc_text

        # Include custom extra fields if passed in extra={}
        extra_fields = {
            k: v
            for k, v in record.__dict__.items()
            if k not in (
                "args", "asctime", "created", "exc_info", "exc_text",
                "filename", "funcName", "levelname", "levelno", "lineno",
                "module", "msecs", "message", "msg", "name", "pathname",
                "process", "processName", "relativeCreated", "stack_info",
                "thread", "threadName"
            )
        }
        if extra_fields:
            log_data["extra"] = extra_fields

        return json.dumps(log_data, default=str)


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """
    Configures root and application loggers to output structured JSON to stdout.
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove all existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Attach JSON handler to stdout
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    handler.setLevel(level)
    root_logger.addHandler(handler)

    # Quieten noisy third-party loggers if needed
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    logger = logging.getLogger("axiomedica")
    logger.setLevel(level)
    return logger


class JSONRequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    FastAPI Middleware that logs every incoming HTTP request and response in structured JSON.
    """

    def __init__(self, app, logger: logging.Logger | None = None):
        super().__init__(app)
        self.logger = logger or logging.getLogger("axiomedica.http")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            # Skip high-frequency healthcheck logging in production to reduce noise if desired
            self.logger.info(
                f"{method} {path} -> {response.status_code} ({duration_ms}ms)",
                extra={
                    "http_method": method,
                    "http_path": path,
                    "http_status": response.status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                    "user_agent": request.headers.get("user-agent", ""),
                },
            )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            self.logger.error(
                f"Unhandled exception during {method} {path}: {str(exc)}",
                exc_info=True,
                extra={
                    "http_method": method,
                    "http_path": path,
                    "duration_ms": duration_ms,
                    "client_ip": client_ip,
                },
            )
            raise exc
