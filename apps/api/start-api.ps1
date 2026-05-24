$env:DATABASE_URL="postgresql+asyncpg://mnemo_user:mnemo_password@localhost:5433/mnemo_db"
$env:SIDECAR_URL="http://localhost:3001"
$env:CORS_ALLOWED_ORIGINS="http://localhost:3000"
python -m uvicorn mnemo_api.main:app --port 8001 --reload
