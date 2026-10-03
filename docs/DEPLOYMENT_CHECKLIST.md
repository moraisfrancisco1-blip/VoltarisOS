# PRODUCTION DEPLOYMENT CHECKLIST

Guia operacional de deployment para o **primeiro parque solar físico em modo
MONITORING**. Separa explicitamente o que está operacional (monitorização) do
que **não** está implementado (controlo físico).

> **MONITORING REAL (operacional):** ingestão, idempotência, alertas, offline
> detection, carbon, maintenance, tenant isolation.
>
> **CONTROLO FÍSICO NÃO IMPLEMENTADO:** dispatch físico a partir do otimizador
> (`control/` só faz dry-run), `process_vpp_bid`.
>
> **Exceção:** os endpoints `/api/ev/{id}/command` e `/api/ev/{id}/optimise`
> escrevem registos Modbus num carregador Alfen. São restritos a
> TENANT_ADMIN/SUPER_ADMIN, auditados (`device.command`, `device.optimise`), o
> valor da corrente tem um teto rígido de 32 A no conector e o `host` passa pela
> guarda anti-SSRF.

---

## 1. Env vars obrigatórias (produção)

| Variável | Obrigatória | Exemplo | Notas |
|----------|-------------|---------|-------|
| `SECRET_KEY` | **sim** | (gerada) | JWT; sem fallback; gera com `secrets.token_urlsafe(32)` |
| `DATABASE_URL` | **sim** | `postgresql://...` | **SQLite em produção é bloqueado no arranque** |
| `ENVIRONMENT` | sim | `production` | Desativa OpenAPI/docs por defeito; ativa guards |
| `REDIS_URL` | se `RUN_CELERY=1` | `redis://...:6379/0` | Obrigatória se Celery ativo |
| `RUN_CELERY` | sim | `1` | `1` lança worker+beat; `0` só API |
| `ALLOW_PRIVATE_DESTINATIONS` | não | `false` (defeito em produção) | Guarda anti-SSRF (`backend/netguard.py`): o servidor **não** liga a endereços privados/loopback (testes de ligação de dispositivos, carregadores EV, webhooks). Endereços de metadados cloud (169.254.x) são sempre bloqueados. Só pôr `true` numa instalação on-prem de um único tenant que fale mesmo com equipamento na LAN; na cloud, o equipamento do cliente é alcançado pelo gateway. |
| `GATEWAY_API_KEYS` | recomendada | `{"<key>":<tenant_id>}` | Sem ela, gateways não ingerem (readiness `not_configured`) |

### Opcionais
`PORT` (default 8000), `CORS_ORIGINS`, `ACCESS_TOKEN_EXPIRE_MINUTES`,
`DEVICE_OFFLINE_AFTER_MINUTES` (default 30), `OPENAI_API_KEY`,
`ENTSOE_API_KEY`/`EEX_API_KEY`, `STRIPE_*`, `ENABLE_DOCS` (`true` reativa docs em
produção), `SENTRY_DSN` (opcional `SENTRY_SEND_PII=true` envia IPs/cabeçalhos ao Sentry — só com DPA; por omissão não envia).

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

---

## Retenção de dados

Sem retenção, `device_readings` (uma linha a cada ~30 s por dispositivo), as
previsões, as otimizações, os alertas e os relatórios crescem para sempre.
`backend/retention.py` corre **diariamente às 03:30** (tarefa Celery
`backend.tasks.run_retention`, requer `RUN_CELERY=1`) e limita cada tabela.

| Dataset | Defeito | Mínimo | Notas |
|---|---|---|---|
| `DEVICE_READINGS` | 90 dias | 35 | Telemetria bruta. **Antes de apagar, cada hora é resumida** em `device_readings_hourly` (guardada para sempre), para os gráficos de carbono, a cobertura de telemetria e a energia solar continuarem a ver o histórico. O mínimo existe porque a previsão de carga lê 28 dias de leituras brutas. |
| `AUDIT_LOGS` | 730 dias | 90 | Única exceção à regra "só acrescenta". Cada execução que apaga algo regista `retention.run`. |
| `ALERTS` | 180 dias | 30 | Só alertas **reconhecidos**; os por reconhecer nunca são apagados. |
| `FORECAST_RECORDS` | 60 dias | 30 | |
| `VPP_RUNS` | 180 dias | 30 | Execuções de otimização e os seus registos de despacho. **As propostas (`vpp_bids`) nunca são apagadas.** |
| `REPORT_JOBS` | 90 dias | 7 | Linhas e ficheiros PDF (só dentro do diretório de relatórios). |
| `STRIPE_EVENTS` | 90 dias | 30 | Chaves de idempotência do webhook (o Stripe repete até ~3 dias). |
| `LEADS` | 365 dias | 30 | Contactos da landing page (dados pessoais). |

Configuração: `RETENTION_<DATASET>_DAYS` (`0` = guardar para sempre; abaixo do
mínimo é subido para o mínimo), `RETENTION_ENABLED`, `RETENTION_DRY_RUN`,
`RETENTION_MAX_SECONDS` (180, abaixo do soft limit de 240 s da tarefa),
`RETENTION_BATCH_SIZE`. A execução é retomável: se o tempo acabar, a seguinte
continua do dia mais antigo que falta.

**Primeira ativação (recomendado):**
1. `GET /api/admin/retention` (SUPER_ADMIN): vê a política efetiva e a idade dos dados mais antigos.
2. `POST /api/admin/retention/run` (por defeito é **simulação**): vê o que seria apagado.
3. Só então deixa a tarefa diária correr, ou `POST /api/admin/retention/run?dry_run=false`.

Sem Celery: `python -m backend.retention --dry-run` e depois sem `--dry-run`, num cron do Railway.

> A partir da primeira execução real, as leituras brutas com mais de 90 dias
> **deixam de existir** (só ficam os resumos horários). Se precisas de mais, sobe
> `RETENTION_DEVICE_READINGS_DAYS` **antes** da primeira execução.

