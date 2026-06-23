#!/bin/bash
# Production server startup script for Linux/macOS
# Requires: Python 3.14+, virtual environment activated, Gunicorn installed
# Usage: ./scripts/run_production_linux.sh [--port 8000] [--workers 4]

set -e

PORT=8000
WORKERS=4

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --workers)
            WORKERS="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./scripts/run_production_linux.sh [--port 8000] [--workers 4]"
            exit 1
            ;;
    esac
done

# Check if virtual environment exists
if [ ! -f ".venv/bin/python" ]; then
    echo "ERROR: Virtual environment not found at .venv"
    echo "Please run: python -m venv .venv"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found"
    echo "Please create .env with required environment variables"
    exit 1
fi

# Validate environment configuration
echo "Validating production configuration..."
if ! .venv/bin/python -c "from app.config import Config; print('Config validated')" > /dev/null 2>&1; then
    echo "Configuration validation failed"
    exit 1
fi

echo "Configuration valid"

# Check if Gunicorn is installed
echo "Checking Gunicorn installation..."
if ! .venv/bin/python -m pip show gunicorn > /dev/null 2>&1; then
    echo "Installing Gunicorn and dependencies..."
    .venv/bin/python -m pip install gunicorn
fi

# Set production environment
export ENV=production
export FLASK_ENV=production

echo "Starting production server on port $PORT with $WORKERS workers..."
echo "Press Ctrl+C to stop"

# Start Gunicorn (production-grade WSGI server for Linux)
.venv/bin/gunicorn \
    --workers "$WORKERS" \
    --bind 0.0.0.0:"$PORT" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    wsgi:app

echo "Server stopped"
