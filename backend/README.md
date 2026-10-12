# AxioMedica Backend — FastAPI API Service

Production-ready asynchronous backend service for the AxioMedica Tele-Rehabilitation platform.

---

## 🛠 Features & Architecture

- **FastAPI**: Fully asynchronous REST API with automatic OpenAPI (Swagger) documentation.
- **SQLAlchemy 2.x**: Asynchronous ORM (`asyncpg`) with connection pooling (`pool_size`, `max_overflow`, `pool_pre_ping`).
- **PostgreSQL 16**: Relational data store for users, exercise sessions, and telemetry.
- **Pydantic v2 & pydantic-settings**: Strictly validated schemas and environment configuration.
- **Structured JSON Logging**: Centralized single-line JSON log formatting with latency tracking middleware.
- **Global Exception Handling**: Structured error responses with distinct domain error codes.
- **CORS Configured for Expo**: Out-of-the-box support for Expo Go, web development servers, and local network IPs.
- **ML Serving Router**: Pluggable inference router for Person B's ML pipeline integration.
- **Containerized**: Production-ready `Dockerfile` and `docker-compose.yml` with automated database health checks.

---

## 📁 Directory Structure

```
backend/
├── alembic/                  # Database migration scripts
│   ├── versions/             # Migration revision files
│   └── env.py                # Async migration execution configuration
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/    # Route controllers (health, auth, etc.)
│   │       └── api.py        # v1 router aggregator
│   ├── core/
│   │   ├── config.py         # Pydantic settings & .env loader
│   │   ├── logging.py        # Structured JSON formatter & request middleware
│   │   └── exceptions.py     # Domain exceptions & global exception handlers
│   ├── db/
│   │   └── session.py        # Async engine, connection pool, get_db dependency
│   ├── models/               # SQLAlchemy 2.0 declarative database models
│   │   └── base.py           # Base DeclarativeBase and common mixins
│   ├── schemas/              # Pydantic v2 validation models
│   │   └── health.py         # Healthcheck schemas
│   ├── services/             # Business logic layer
│   ├── ml_serving/           # ML inference serving router (Person B)
│   │   └── router.py         # Model status & inference endpoints
│   └── main.py               # FastAPI application entrypoint
├── scripts/                  # Automation & helper scripts
│   ├── wait_for_db.py        # Async DB connectivity polling script
│   └── run_dev.sh            # Local dev start script
├── tests/                    # Automated test suites
│   ├── conftest.py           # Pytest fixtures & async test client
│   └── unit/                 # Unit tests (health, config, ML serving)
├── .env.example              # Environment variables template
├── alembic.ini               # Alembic configuration
├── docker-compose.yml        # PostgreSQL 16 + API composition
├── Dockerfile                # Multi-stage container image definition
├── requirements.txt          # Python dependency list
└── README.md
```

---

## 🚀 Quick Start Guide

### Method 1: Running with Docker Compose (Recommended)

This spins up both **PostgreSQL 16** and the **FastAPI application** with live reloading enabled:

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Copy the environment template
cp .env.example .env

# 3. Start PostgreSQL and FastAPI
docker compose up --build
```

The API will be available at `http://localhost:8000`.

---

### Method 2: Running Locally with Python Virtual Environment

#### 1. Prerequisites
- Python 3.11+
- Running PostgreSQL 16 instance

#### 2. Setup Virtual Environment

**On Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

**On Linux / macOS:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

#### 3. Run Database Migrations
```bash
alembic upgrade head
```

#### 4. Start the Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🩺 Testing the `/health` Endpoint

The `/health` endpoint validates both application operational status and live database connectivity.

### Using `curl`:
```bash
curl -i http://localhost:8000/health
```

### Using PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:8000/health | ConvertTo-Json
```

### Expected Response (when DB is healthy):
```json
{
  "status": "healthy",
  "app_name": "AxioMedica Backend API",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-10-08T04:20:00.000000Z",
  "services": {
    "database": {
      "status": "connected",
      "latency_ms": 1.45
    }
  }
}
```

*Note: If PostgreSQL is unreachable, the endpoint returns `HTTP 503 Service Unavailable` with `"status": "unhealthy"` and `"services.database.status": "disconnected"`.*

---

## 🧪 Running Automated Tests

Run the test suite using `pytest`:

```bash
# Run all unit tests
pytest tests/ -v

# Run with coverage report
pytest --cov=app tests/
```

---

## 📖 API Documentation & Interactive Explorer

Once the server is running, explore and test the endpoints directly in your browser:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON**: [http://localhost:8000/api/v1/openapi.json](http://localhost:8000/api/v1/openapi.json)

---

## 🔑 Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | string | `postgresql+asyncpg://postgres:postgres@localhost:5432/axiomedica_db` | Async database connection URL |
| `JWT_SECRET` | string | — | Secret key for JWT signing |
| `ACCESS_TTL_MIN` | int | `60` | Access token expiration in minutes |
| `REFRESH_TTL_DAYS` | int | `30` | Refresh token expiration in days |
| `CORS_ORIGINS` | list / string | `http://localhost:8081,...` | Allowed CORS origins for Expo & Web |
| `ENVIRONMENT` | string | `development` | Environment name (`development`, `production`, `test`) |
| `LOG_LEVEL` | string | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
