# REGISTO DAS ATIVIDADES DE TRATAMENTO — VOLTARISOS

**Art. 30.º do RGPD** · **Versão:** 0.1 (RASCUNHO, sem validação jurídica) · **Última revisão:** [DD/MM/AAAA]

> **Como usar este documento.** É um registo **interno** (não se publica; só se mostra à CNPD se pedir).
> Foi extraído do código (`backend/models.py`, `backend/retention.py`, `backend/gdpr.py`, integrações)
> e descreve o que o software **faz**, não o que um contrato diz. Os campos `[ ]` precisam de um
> facto que o código não conhece. Quando o software mudar (novo campo pessoal, novo fornecedor),
> **atualize este registo no mesmo PR**.
> Não afirma conformidade: apenas documenta. A validação é do jurista.

## 0. Identificação

| | |
|---|---|
| Entidade | [DENOMINAÇÃO SOCIAL], NIF/NIPC [NÚMERO], [MORADA] |
| Contacto de privacidade | legal@voltarisos.com |
| Encarregado de Proteção de Dados | [NOME / "não designado: decisão a tomar com o jurista"] |
| Papel | **Responsável** pelos dados de conta, segurança e faturação (linhas 1–4, 7–8). **Subcontratante** do Cliente quanto aos dados operacionais (linhas 5–6), a confirmar no Acordo de Tratamento de Dados. |

## 1. Atividades de tratamento

| # | Atividade | Titulares | Dados pessoais (campo no código) | Finalidade | Fundamento | Origem | Prazo de conservação |
|---|---|---|---|---|---|---|---|
| 1 | **Contas e autenticação** | Utilizadores dos Clientes | `users`: email, nome, telefone, cargo, avatar, cor, função, datas (criação, login, última atividade, aceitação de termos); hash da password; segredo e códigos de recuperação do 2FA | Prestar o serviço, autenticar, controlar acessos | Execução do contrato (6.º/1/b) | Utilizador ou administrador do tenant | Enquanto a conta existir; após anonimização (art. 17.º) ficam só `erased-<id>@erased.invalid` e dados sem identificação. Após fim de contrato: [PRAZO] |
| 2 | **Sessões de login** | Utilizadores | `user_sessions`: IP, user-agent, datas | Segurança, permitir terminar sessões | Interesse legítimo (6.º/1/f) | Gerado automaticamente | Até expirar (72 h) e apagadas 30 dias depois (`RETENTION_USER_SESSIONS_DAYS`) |
| 3 | **Registo de auditoria** | Utilizadores | `audit_logs`: email, IP, user-agent, ação, recurso, detalhes | Segurança, prova de ações (Art. 32.º), webhooks de auditoria do Cliente | Interesse legítimo (6.º/1/f) | Gerado automaticamente | 730 dias (`RETENTION_AUDIT_LOGS_DAYS`; piso 90). Na anonimização, IP e user-agent são apagados e o email substituído por pseudónimo |
| 4 | **Faturação e organização** | Representantes dos Clientes | `tenants`: nome da empresa, NIF/IVA, morada, país, emails de suporte e faturação; Stripe: cliente, subscrição e estado (não guardamos cartões) | Cobrança, obrigações fiscais | Contrato; obrigação jurídica (6.º/1/b, c) | Cliente / Stripe | Prazo legal de faturação (PT: 10 anos) [confirmar]; eventos Stripe de idempotência 90 dias |
| 5 | **Sites e equipamentos** | Proprietários/ocupantes dos sites (**inclui particulares no plano Home**) | `sites`: nome, `owner` (texto livre), `location`, `lat`/`lng`; `devices`: nome, identificadores e **credenciais de acesso ao equipamento** | Operar e otimizar a instalação | Contrato com o Cliente (subcontratante) | Cliente | Enquanto o site existir |
| 6 | **Telemetria de energia** | Ocupantes de sites (**consumo de uma habitação é dado pessoal**) | `device_readings` (potência, energia, SoC, por dispositivo); `device_readings_hourly`; alertas e previsões | Monitorizar, prever, otimizar, relatórios | Contrato com o Cliente (subcontratante) | Dispositivos / gateways | Leituras brutas 90 dias (piso 35); resumo horário **sem limite** [decidir: ver Pendentes]; alertas reconhecidos 180 d; previsões 60 d; execuções de otimização 180 d; relatórios 90 d |
| 7 | **Integrações e chaves** | Utilizadores | `oauth_connections`: tokens Google/Microsoft/Slack e etiqueta da conta; `api_keys`: prefixo e hash; `webhooks`: URL | Ligar serviços escolhidos pelo utilizador | Execução do contrato / consentimento do utilizador ao ligar | Utilizador | Até desligar/revogar; apagados na anonimização |
| 8 | **Contactos comerciais** | Interessados (sem conta) | `leads`: nome, email, empresa, origem | Responder a pedidos | Diligências pré-contratuais / consentimento | Titular (página pública) | 365 dias (`RETENTION_LEADS_DAYS`; piso 30) |
| 9 | **Monitorização de erros** | Utilizadores | Sentry: erros técnicos; **IP/cabeçalhos desligados por omissão** (`SENTRY_SEND_PII=false`) | Estabilidade | Interesse legítimo | Gerado automaticamente | Conforme o plano do Sentry [confirmar] |
| 10 | **Assistente (Copilot)** | Utilizadores | Texto livre escrito pelo utilizador + resumo operacional (preço, capacidade, receita). Sem email/nome no contexto automático; o texto livre pode conter dados pessoais | Responder a perguntas | Contrato | Utilizador | Não guardado pela app; OpenAI: [confirmar retenção/uso para treino na conta] |
| 11 | **Limitação de pedidos** | Visitantes | IP, em memória do processo (slowapi, sem armazenamento persistente) | Prevenir abuso | Interesse legítimo | Gerado automaticamente | Efémero (janela do limite) |

## 2. Destinatários e subcontratantes

| Fornecedor | Atividades | Localização | DPA / garantias de transferência |
|---|---|---|---|
| Railway | Alojamento (todas) | [região] | [aceite? data] |
| Stripe | 4 | [UE/EUA] | [aceite? data] |
| Sentry | 9 | [região] | [aceite? data] |
| OpenAI | 10 | EUA | [DPA + CCT/DPF? data] |
| Google / Microsoft / Slack | 7 (só se o utilizador ligar) | conforme prestador | termos do prestador |
| ENTSO-E, OMIE, Open-Meteo | Preços e meteorologia | UE | Não recebem dados pessoais |

Não foi encontrado no código nenhum envio de emails; se existir um serviço de email fora do repositório, acrescentar aqui.

## 3. Medidas de segurança (art. 32.º), tal como implementadas

- Passwords e chaves de API só como hash; segredo TOTP guardado em claro na base [**lacuna**: ver Pendentes].
- Isolamento por tenant e por função; 2FA opcional; sessões revogáveis; limitação de pedidos; CSP `script-src 'self'`.
- Registo de auditoria de ações de escrita; webhooks assinados; proteção SSRF em integrações.
- Retenção automática (job diário) com modo de simulação.
- Direitos dos titulares: exportação (`GET /api/privacy/me/export`) e anonimização (`POST /api/privacy/me/erase`, e variantes de administrador).
- Cópias de segurança: **não há backups automáticos ativos** no alojamento [**lacuna**: ver Pendentes].

## 4. Pendentes que este registo revelou

1. **Dados de habitações (plano Home).** Telemetria, `owner`, `location` e coordenadas de particulares são dados pessoais. *Parcialmente tratado:* a exportação e a eliminação de um site (`/api/privacy/sites/{id}/export|erase`) e a Política de Privacidade já os cobrem (PR claude/gdpr-household). Falta decidir o papel exacto (responsável vs. subcontratante) e que o apagar normal de um site/device (`DELETE`) continua a deixar a telemetria órfã: só a eliminação RGPD a remove.
2. **Resumo horário sem prazo** (`device_readings_hourly`): é dado pessoal quando o site é uma habitação. Existe agora `RETENTION_DEVICE_READINGS_HOURLY_DAYS` (por omissão 0 = sem limite, mínimo 365); falta **decidir o valor**.
3. **Segredo TOTP em claro** na base: cifrar em repouso.
4. **Backups automáticos** inexistentes; sem eles, não há disponibilidade/integridade demonstrável (art. 32.º/1/c).
5. **Eliminação de um tenant inteiro** e conservação de faturação: política por decidir.
6. **Violações de dados:** falta procedimento escrito (notificação à CNPD em 72 h).
7. **Acordo de Tratamento de Dados (art. 28.º)** com Clientes: não existe.
8. **Alojamento e fornecedores:** confirmar região e DPA de cada um (secção 2).
