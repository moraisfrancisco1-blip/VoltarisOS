# 🚀 VoltarisOS — Guia de Deploy para Produção

## 📋 Pré-requisitos

### Contas Necessárias
- [ ] **Railway** — https://railway.app (plano Starter ou superior)
- [ ] **Stripe** — https://dashboard.stripe.com (para billing)
- [ ] **Sentry** — https://sentry.io (para monitorização de erros)
- [ ] **ENTSO-E** — https://transparency.entsoe.eu (para preços de mercado)
- [ ] **GitHub** — Repositório do VoltarisOS

### Ferramentas Locais
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login na Railway
railway login

# Verificar conexão
railway status
```

---

## 🔧 Configuração do Projeto na Railway

### 1. Criar Novo Projeto

```bash
# No diretório do projeto
cd /path/to/energy-vpp-platform

# Inicializar projeto Railway
railway init

# Ou conectar a um projeto existente
railway link
```

### 2. Adicionar Serviços

#### Serviço Principal (Backend + Frontend)
```bash
# O serviço principal já deve existir com o Dockerfile
# Verificar configuração
railway service list
```

#### Serviço Redis (Cache + Celery Broker)
```bash
# Adicionar Redis via Railway Dashboard
# ou via CLI:
railway add
# Selecionar: Redis
```

#### Serviço PostgreSQL (Produção)
```bash
# Adicionar PostgreSQL via Railway Dashboard
# ou via CLI:
railway add
# Selecionar: PostgreSQL
```

---

## 🔐 Variáveis de Ambiente

### Obrigatórias (Sem fallback)

```bash
# Segurança
SECRET_KEY=<gerar_com: python -c "import secrets; print(secrets.token_urlsafe(32))">

# Stripe (obter em: https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry (obter em: https://sentry.io/settings/projects/)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Recomendadas

```bash
# Database (fornecido automaticamente pelo Railway PostgreSQL)
DATABASE_URL=postgresql://...

# Redis (fornecido automaticamente pelo Railway Redis)
REDIS_URL=redis://...

# 2FA
TOTP_ISSUER=VoltarisOS
TOTP_ENABLED=true

# Mercado de Energia
ENTSOE_API_KEY=<solicitar_em: https://transparency.entsoe.eu/>
EEX_API_KEY=<solicitar_em: https://www.eex.com/data>
DEFAULT_MARKET=MIBEL

# Billing
STRIPE_METERED_PRICE_ID=price_...
BILLING_ENABLED=true

# Ambiente
ENVIRONMENT=production
RELEASE_VERSION=voltarisos@1.0.0

# CORS
BACKEND_CORS_ORIGINS=https://voltarisos.com,https://www.voltarisos.com

# Admin
ADMIN_INITIAL_PASSWORD=<password_seguro_para_primeiro_login>
BETA_CODE=<código_de_convite_para_registo>
```

### Como Configurar na Railway

```bash
# Via CLI
railway variables set SECRET_KEY=xxx
railway variables set STRIPE_SECRET_KEY=sk_live_xxx
railway variables set STRIPE_PUBLISHABLE_KEY=pk_live_xxx
railway variables set STRIPE_WEBHOOK_SECRET=whsec_xxx
railway variables set SENTRY_DSN=https://xxx@sentry.io/xxx
railway variables set ENVIRONMENT=production

# Ou via Dashboard
# https://railway.app/ → Projeto → Services → Variables
```

---

## 🚀 Deploy

### 1. Pré-Deploy Checklist

```bash
# Executar script de verificação
python scripts/pre_deploy_check.py

# Ou manualmente:
# - [ ] Todas as variáveis de ambiente configuradas
# - [ ] Stripe keys são de produção (sk_live_, pk_live_)
# - [ ] Sentry DSN configurado
# - [ ] DATABASE_URL aponta para PostgreSQL de produção
# - [ ] REDIS_URL configurado
# - [ ] Git está limpo (sem commits não pushados)
```

### 2. Deploy para Produção

```bash
# Push para branch main
git add .
git commit -m "chore: prepare for production deploy"
git push origin main

# Railway faz deploy automaticamente
# Ou forçar deploy manual:
railway up
```

### 3. Verificar Deploy

```bash
# Ver logs em tempo real
railway logs

# Ver status do deploy
railway status

# Testar health endpoint
curl https://voltarisos-production.up.railway.app/health
curl https://voltarisos-production.up.railway.app/health/detailed
```

---

## ✅ Verificação Pós-Deploy

### 1. Health Checks

```bash
# Health básico
curl -s https://voltarisos-production.up.railway.app/health | jq

# Health detalhado (verifica DB, Redis, Celery)
curl -s https://voltarisos-production.up.railway.app/health/detailed | jq

# Readiness check (para load balancers)
curl -s https://voltarisos-production.up.railway.app/ready | jq
```

### 2. Testes Funcionais

```bash
# Testar login
curl -X POST https://voltarisos-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@voltaris.com", "password": "<ADMIN_INITIAL_PASSWORD>"}'

# Testar batch ingest
curl -X POST https://voltarisos-production.up.railway.app/api/devices/ingest/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"readings": [{"device_id": 1, "power_kw": 100.5}]}'

# Testar WebSocket (com wscat)
npm install -g wscat
wscat -c "wss://voltarisos-production.up.railway.app/ws/dashboard?token=<TOKEN>"
```

### 3. Monitorização

```bash
# Verificar Sentry
# https://sentry.io/ → Projeto → Issues

# Verificar Railway Metrics
# https://railway.app/ → Projeto → Metrics

# Verificar Stripe Webhooks
# https://dashboard.stripe.com/ → Developers → Webhooks
```

---

## 🔄 Rollback Procedure

### Rollback Rápido

```bash
# Ver histórico de deploys
railway deployment list

# Rollback para deploy anterior
railway deployment rollback <deployment_id>
```

### Rollback Manual

```bash
# Reverter para commit anterior
git revert HEAD
git push origin main

# Railway faz deploy automaticamente
```

---

## 📊 Scaling

### Vertical Scaling (Railway)

```bash
# Aumentar recursos via Dashboard
# https://railway.app/ → Projeto → Settings → Resources

# Ou via CLI
railway service settings
```

### Horizontal Scaling

```bash
# Adicionar réplicas (requer plano Enterprise)
# https://railway.app/ → Projeto → Scaling

# Configurar auto-scaling
# Min: 2 replicas
# Max: 10 replicas
# Target CPU: 70%
```

---

## 🔒 Segurança em Produção

### Checklist de Segurança

- [ ] **HTTPS** — Forçado via HSTS header
- [ ] **CORS** — Configurado apenas para domínios permitidos
- [ ] **Rate Limiting** — Ativo em `/api/auth/login` e `/api/auth/register`
- [ ] **2FA** — Habilitado para contas admin
- [ ] **Audit Logs** — Todas as ações críticas registadas
- [ ] **Secrets** — Nenhum hardcoded no código
- [ ] **Non-root User** — Docker corre como user `voltaris`
- [ ] **Health Checks** — Configurados no Dockerfile

### Rotação de Secrets

```bash
# Gerar novo SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Atualizar na Railway
railway variables set SECRET_KEY=<novo_valor>

# Restart do serviço
railway restart
```

---

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. "Database connection failed"
```bash
# Verificar DATABASE_URL
railway variables get DATABASE_URL

# Verificar status do PostgreSQL
railway service status postgres

# Ver logs do PostgreSQL
railway logs postgres
```

#### 2. "Redis connection failed"
```bash
# Verificar REDIS_URL
railway variables get REDIS_URL

# Verificar status do Redis
railway service status redis
```

#### 3. "Sentry not reporting errors"
```bash
# Verificar SENTRY_DSN
railway variables get SENTRY_DSN

# Testar erro manualmente
curl https://voltarisos-production.up.railway.app/api/test-error
```

#### 4. "WebSocket connection refused"
```bash
# Verificar se WebSocket está habilitado
curl https://voltarisos-production.up.railway.app/health/detailed | jq '.components.websocket'

# Verificar CORS para WebSocket
railway variables get BACKEND_CORS_ORIGINS
```

---

## 📞 Suporte

### Links Úteis
- **Railway Docs**: https://docs.railway.app/
- **Stripe Docs**: https://stripe.com/docs
- **Sentry Docs**: https://docs.sentry.io/
- **FastAPI Docs**: https://fastapi.tiangolo.com/

### Contacto
- **Email**: support@voltarisos.com
- **Discord**: https://discord.gg/voltarisos
- **GitHub Issues**: https://github.com/moraisfrancisco1-blip/VoltarisOS/issues

---

## 📝 Changelog de Deploy

### v1.0.0 (2026-08-08)
- ✅ Initial production deploy
- ✅ Batch ingest endpoint
- ✅ MILP optimization
- ✅ WebSocket real-time updates
- ✅ Stripe metered billing
- ✅ Sentry integration
- ✅ ENTSO-E/EEX market integration
- ✅ 2FA authentication
- ✅ Load testing suite

---

*Última atualização: 2026-08-08*