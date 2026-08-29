#!/bin/sh
echo "=== VoltarisOS starting ==="
# Seed admin account on every boot (idempotent — safe to run repeatedly)
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

# Celery worker + beat (background). The broker/result backend come from REDIS_URL.
# Explicit opt-in: set RUN_CELERY=1 to enable. RUN_CELERY != 1 (or unset) runs a
# pure-API container (offline detection off — readiness reports it honestly).
# Worker/beat tolerate a temporarily unavailable broker and back off until Redis
# is reachable.
if [ "$RUN_CELERY" = "1" ]; then
  celery -A backend.tasks.celery_app worker --loglevel=info &
  celery -A backend.tasks.celery_app beat --loglevel=info &
fi

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
