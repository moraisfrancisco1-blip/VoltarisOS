# PRODUCTION DEPLOYMENT CHECKLIST

Guia operacional de deployment para o **primeiro parque solar físico em modo
MONITORING**. Separa explicitamente o que está operacional (monitorização) do
que **não** está implementado (controlo físico).

> **MONITORING REAL (operacional):** ingestão, idempotência, alertas, offline
> detection, carbon, maintenance, tenant isolation.
>
> **CONTROLO FÍSICO NÃO IMPLEMENTADO:** envio de comandos a equipamentos,
> Modbus/MQTT, dispatch físico, `process_vpp_bid`. Nada aqui envia comandos.

---

## 1. Env vars obrigatórias (produção)

| Variável | Obrigatória | Exemplo | Notas |
|----------|-------------|---------|-------|
| `SECRET_KEY` | **sim** | (gerada) | JWT; sem fallback; gera com `secrets.token_urlsafe(32)` |
| `DATABASE_URL` | **sim** | `postgresql://...` | **SQLite em produção é bloqueado no arranque** |
| `ENVIRONMENT` | sim | `production` | Desativa OpenAPI/docs por defeito; ativa guards |
| `REDIS_URL` | se `RUN_CELERY=1` | `redis://...:6379/0` | Obrigatória se Celery ativo |
| `RUN_CELERY` | sim | `1` | `1` lança worker+beat; `0` só API |
| `GATEWAY_API_KEYS` | recomendada | `{"<key>":<tenant_id>}` | Sem ela, gateways não ingerem (readiness `not_configured`) |

### Opcionais
`PORT` (default 8000), `CORS_ORIGINS`, `ACCESS_TOKEN_EXPIRE_MINUTES`,
`DEVICE_OFFLINE_AFTER_MINUTES` (default 30), `OPENAI_API_KEY`,
`ENTSOE_API_KEY`/`EEX_API_KEY`, `STRIPE_*`, `ENABLE_DOCS` (`true` reativa docs em
produção), `SENTRY_DSN`.

## 2. Order de startup

`start.sh` (único container Railway):

1. Guard de configuração (`backend.startup.validate_startup_config`) — bloqueia SQLite em produção e `RUN_CELERY=1` sem `REDIS_URL`.
2. `create_all` + migrations idempotentes (`backend/migrations/runner.py`).
3. Seed admin (idempotente).
4. Se `RUN_CELERY != 0`: lança **worker** + **beat** (background).
5. `exec uvicorn backend.main:app`.

> `RUN_CELERY=0` → apenas API (sem offline detection automático; readiness reporta honestamente).

## 3. Redis / Celery requirements

- Celery usa `REDIS_URL` como broker e backend.
- Com `RUN_CELERY=1` e Redis indisponível, worker/beat fazem backoff e a API
  continua a servir; readiness/health reportam `degraded`/`unavailable` — **nunca** `healthy`.
- `detect_offline_devices` é agendado pelo beat a cada 5 min e é **idempotente**
  (não duplica alertas em re-execução).

## 4. Migrations

- Aplicadas automaticamente no arranque, idempotentes, ordenadas (`schema_migrations`).
- Relevantes: `add_device_reading_unique`, `add_site_timezone`, `add_device_external_id`.
- **Limitação**: numa corrida de arranque com **duas instâncias simultâneas** em
  Postgres, um `ALTER TABLE` concorrente pode falhar ("duplicate column"). Recomenda-se
  **arrancar uma única réplica** no deploy inicial (ou aplicar migrations manualmente
  antes de escalar). Não é usado locking distribuído.

## 5. Health / readiness endpoints

| Endpoint | Auth | Uso |
|----------|------|-----|
| `GET /health` | pública | liveness básico (sem dependências não críticas) |
| `GET /health/detailed` | pública | DB, Redis (honesto), Celery |
| `GET /ready` | pública | readiness de serviço (só DB crítico) p/ load balancer |
| `GET /api/admin/production-readiness` | SUPER_ADMIN | DB, Redis, Celery, migrations, ingest auth, offline detection |

## 6. Rollback básico

- **Code**: voltar ao commit/versão anterior e re-deploy (startup idempotente).
- **DB**: as migrations são aditivas/idempotentes; não é preciso rollback de schema
  para reverter código. As colunas novas ficam inofensivas.
- Nada aqui altera dados físicos nem envia comandos.

## 7. Smoke test pós-deploy

1. `GET /health` → `{"status":"ok"}`.
2. `GET /api/admin/production-readiness` (SUPER_ADMIN) → `status` honesto
   (`healthy`/`degraded`/`not_configured`); `components.migrations.status == "up_to_date"`.
3. Registar/confirmar tenant; criar site com `timezone`; criar device com `external_id`.
4. Configurar `GATEWAY_API_KEYS`; enviar leitura real via batch (device_id ou external_id).
5. Confirmar `accepted=1`; device `online`; carbon; maintenance; alert rule a disparar.
6. Retry da mesma leitura → `duplicated` (idempotência).
7. Com Celery ativo: confirmar `offline_detection_beat == "configured"` no readiness.
8. Confirmar que `/docs` está indisponível em produção (a menos que `ENABLE_DOCS=true`).

## 8. Limitações atuais (honestas)

- **Sem controlo físico** / envio de comandos a equipamentos.
- **Sem adapter de fabricante real** — o `GenericEquipmentAdapter` é apenas de
  teste; o primeiro adapter exige documentação real (ver `EQUIPMENT_ADAPTER_CONTRACT.md`).
- Offline detection exige Redis+Celery (`RUN_CELERY=1`); sem isso, readiness não
  é `healthy`.
- Sem locking distribuído em migrations; arrancar uma réplica no deploy inicial.
- Concorrência de ingestão protegida por índice único `(device_id, timestamp)`.
