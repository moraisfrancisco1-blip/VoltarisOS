#!/bin/sh
echo "=== VoltarisOS starting ==="
python -c "
from backend.database import SessionLocal, engine
from backend import models
models.Base.metadata.create_all(bind=engine)
from backend.routers.auth import seed_admin
db = SessionLocal()
seed_admin(db)
db.close()
print('DB seeded OK')
" 2>&1 || echo "Seed warning (non-fatal)"

if [ "${RUN_CELERY:-false}" = "true" ] && [ -n "${REDIS_URL:-}" ]; then
    celery -A backend.tasks worker --loglevel=info --hostname=voltaris-worker@%h &
fi

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
