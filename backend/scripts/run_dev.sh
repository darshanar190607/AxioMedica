#!/usr/bin/env bash
# Quick local dev startup script
set -e

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

echo "Starting AxioMedica FastAPI server in reload mode..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
