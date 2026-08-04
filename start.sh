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

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
