# Production server startup script for Windows
# Requires: Python 3.14+, virtual environment activated, Waitress installed
# Usage: .\scripts\run_production_windows.ps1 [-Port 8000] [-Workers 2]

param(
    [int]$Port = 8000,
    [int]$Workers = 2
)

# Check if virtual environment is activated
if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "ERROR: Virtual environment not found at .\.venv" -ForegroundColor Red
    Write-Host "Please run: python -m venv .venv" -ForegroundColor Yellow
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".\.env")) {
    Write-Host "ERROR: .env file not found" -ForegroundColor Red
    Write-Host "Please create .env with required environment variables" -ForegroundColor Yellow
    exit 1
}

# Validate environment configuration
Write-Host "Validating production configuration..." -ForegroundColor Cyan
$validation = & ".\.venv\Scripts\python.exe" -c "
from app.config import Config
try:
    print('Config validated')
except Exception as e:
    print(f'ERROR: {e}')
    exit(1)
"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Configuration validation failed" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration valid" -ForegroundColor Green

# Check if Waitress is installed
Write-Host "Checking Waitress installation..." -ForegroundColor Cyan
& ".\.venv\Scripts\python.exe" -m pip show waitress > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing Waitress..." -ForegroundColor Yellow
    & ".\.venv\Scripts\python.exe" -m pip install waitress
}

# Set production environment
$env:ENV = "production"
$env:FLASK_ENV = "production"

Write-Host "Starting production server on port $Port with $Workers workers..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

# Start Waitress (production-grade WSGI server for Windows)
& ".\.venv\Scripts\waitress-serve.exe" `
    --listen=0.0.0.0:$Port `
    --threads=$Workers `
    --connection-limit=1000 `
    --channel-timeout=120 `
    --log-socket `
    wsgi:app

Write-Host "Server stopped" -ForegroundColor Cyan
