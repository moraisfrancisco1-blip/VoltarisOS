# POLÍTICA DE PRIVACIDADE — VOLTARISOS

**Versão:** 0.1 (RASCUNHO — requer revisão jurídica antes de publicação)
**Data de entrada em vigor:** [DD/MM/AAAA]

> **Nota para quem publica este documento.** Foi redigido a partir do que o software
> efetivamente faz (modelo de dados, integrações, retenção, direitos implementados).
> Os campos entre `[PARENTESES]` dependem de factos que o código não conhece (identidade
> da empresa, contactos, contratos com subcontratantes) e têm de ser preenchidos.
> Deve ser revisto por um jurista e, se aplicável, pelo Encarregado de Proteção de Dados
> antes de ser apresentado a clientes. Ver a lista de verificação no fim.

---

## 1. Quem é o responsável pelo tratamento

**Responsável:** [DENOMINAÇÃO SOCIAL], NIF/NIPC [NÚMERO], com sede em [MORADA] ("VoltarisOS", "nós").
**Contacto para privacidade:** legal@voltarisos.com
**Encarregado de Proteção de Dados (EPD):** [NOME/CONTACTO, ou "não designado — não obrigatório por [fundamento]"]

### Papéis: responsável vs. subcontratante
- Quanto aos dados da **conta e da faturação** dos nossos Clientes e dos seus utilizadores, o VoltarisOS é **responsável pelo tratamento**.
- Quanto aos **dados operacionais** que o Cliente carrega ou liga à plataforma (sites, dispositivos, leituras de energia, ordens de mercado), o VoltarisOS atua como **subcontratante** do Cliente, que é o responsável. Esse tratamento rege-se pelo Acordo de Tratamento de Dados (art. 28.º RGPD) [ANEXO / LINK], que faz parte do contrato de licença.

## 2. Que dados tratamos

| Categoria | Dados | Origem |
|---|---|---|
| Conta | email, nome, telefone, cargo, cor de perfil, avatar, função (admin/membro), data de aceitação dos termos | Fornecidos pelo utilizador ou pelo administrador do tenant |
| Autenticação | palavra-passe (guardada só como hash bcrypt), segredo e códigos de recuperação do 2FA, chaves de API (guardadas só como hash) | Utilizador |
| Utilização e segurança | registo de auditoria (ação, data, endereço IP, user-agent), último acesso, sessões de login ativas (IP, user-agent, datas) | Gerado automaticamente |
| Organização | nome da empresa, morada, emails de suporte e faturação | Administrador do tenant |
| Faturação | cliente, subscrição e estado de pagamento no Stripe. **Não guardamos números de cartão** | Stripe / Cliente |
| Integrações | tokens OAuth (Google, Microsoft, Slack) e etiqueta da conta ligada; credenciais dos dispositivos configurados | Utilizador, quando liga a integração |
| Contactos comerciais | nome, email, empresa de quem se inscreve na página pública | Titular |
| Dados operacionais | sites, dispositivos, leituras de energia, preços, ordens VPP, alertas, relatórios | Cliente / dispositivos |
| Assistente (Copilot) | mensagem escrita e um resumo do estado operacional (preços, capacidade, receita) | Utilizador |

Não tratamos categorias especiais de dados (art. 9.º RGPD) nem dados de menores de forma intencional; o serviço destina-se a empresas e profissionais.

## 3. Para que fins e com que fundamento

| Finalidade | Fundamento (art. 6.º RGPD) |
|---|---|
| Criar e gerir a conta, autenticar, prestar o serviço contratado | Execução do contrato (n.º 1, b) |
| Faturação, cobrança e cumprimento de obrigações fiscais e contabilísticas | Execução do contrato; obrigação jurídica (b, c) |
| Segurança: registo de auditoria, deteção de abuso, limitação de pedidos, 2FA | Interesse legítimo (f) na segurança da plataforma e dos clientes |
| Monitorização de erros e desempenho (Sentry) | Interesse legítimo (f) |
| Comunicações de serviço (alertas, avisos de segurança, alterações aos termos) | Execução do contrato; interesse legítimo |
| Responder a pedidos comerciais da página pública | Diligências pré-contratuais (b) ou consentimento (a) |
| Exercício e defesa de direitos em processos | Interesse legítimo (f) |

Não vendemos dados pessoais, não os usamos para publicidade de terceiros nem para decisões exclusivamente automatizadas com efeitos jurídicos.

## 4. Com quem partilhamos (subcontratantes)

Recorremos apenas a prestadores necessários ao serviço, vinculados por contrato (art. 28.º):

| Prestador | Função | Dados | Localização |
|---|---|---|---|
| Railway | Alojamento da aplicação e da base de dados | Todos os dados da plataforma | [REGIÃO — confirmar] |
| Stripe | Pagamentos e subscrições | Email, nome, dados de faturação | [UE/EUA — DPF/CCT] |
| Sentry | Monitorização de erros | Erros técnicos. O envio de IP e cabeçalhos está **desligado por omissão** | [confirmar região] |
| OpenAI | Respostas do assistente | Mensagem escrita pelo utilizador (texto livre) e resumo operacional agregado (preços, capacidade, receita); o contexto enviado não inclui email nem nome | EUA — [CCT/DPF] |
| Google, Microsoft, Slack | Apenas se o utilizador ligar a integração | Tokens e dados autorizados pelo utilizador | conforme o prestador |
| Fornecedores de dados de mercado e meteorologia (ENTSO-E, OMIE, Open-Meteo) | Preços e previsão | Nenhum dado pessoal é enviado | — |
| [Fornecedor de email transacional] | Envio de emails | Email, nome | [confirmar] |

Podemos ainda divulgar dados a autoridades quando a lei o exigir. [CONFIRMAR LISTA ATUAL ANTES DE PUBLICAR.]

## 5. Transferências para fora do EEE
Quando um subcontratante trata dados fora do Espaço Económico Europeu (p. ex. EUA), a transferência assenta numa decisão de adequação (incluindo o Data Privacy Framework, para entidades certificadas) ou em Cláusulas Contratuais-Tipo, com as medidas suplementares necessárias. [CONFIRMAR POR PRESTADOR.]

## 6. Durante quanto tempo conservamos os dados

Aplicamos limites automáticos de conservação (valores por omissão, configuráveis):

| Dados | Conservação |
|---|---|
| Leituras de dispositivos em bruto | 90 dias; depois mantém-se apenas o resumo horário agregado |
| Registo de auditoria | 730 dias |
| Alertas reconhecidos | 180 dias (os não reconhecidos não são apagados automaticamente) |
| Previsões, execuções de otimização, trabalhos de relatório e ficheiros PDF | 60–180 dias, consoante o tipo |
| Sessões de login | Terminadas ao sair, ao mudar a palavra-passe ou por um administrador; os registos expirados são apagados após 30 dias |
| Contactos comerciais (leads) | 365 dias |
| Eventos de webhook do Stripe (idempotência) | 90 dias |
| Conta e dados do tenant | Enquanto o contrato estiver ativo; depois [PRAZO — ex. 30 dias] para exportação e eliminação |
| Documentos de faturação | O prazo legal aplicável (em Portugal, 10 anos) |

## 7. Os seus direitos

Pode, a qualquer momento: **aceder** aos seus dados, **retificá-los**, **apagá-los**, **limitar** ou **opor-se** ao tratamento, e pedir a **portabilidade**; quando o tratamento se basear em consentimento, pode **retirá-lo** sem afetar o que foi feito antes.

**Como exercer, diretamente na plataforma:**
- **Exportar** os seus dados em JSON: `GET /api/privacy/me/export`.
- **Apagar** (anonimizar) a sua conta: `POST /api/privacy/me/erase`, confirmando com a palavra-passe. Remove nome, telefone, cargo, avatar, 2FA e tokens de integrações; revoga as chaves de API; e retira o seu email, IP e user-agent dos registos de auditoria, que permanecem de forma anonimizada. O único administrador de um tenant tem de nomear outro antes.
- Um administrador do tenant pode fazer o mesmo por um colega da sua organização.
- Os restantes pedidos: legal@voltarisos.com. Respondemos no prazo de **um mês**, prorrogável nos termos do art. 12.º RGPD.

Se for utilizador de uma empresa Cliente, o seu primeiro contacto para dados operacionais da empresa é essa empresa.

**Reclamação:** pode apresentar queixa à autoridade de controlo, em Portugal a **Comissão Nacional de Proteção de Dados (CNPD)**, www.cnpd.pt, ou à autoridade do seu Estado-Membro.

## 8. Segurança
Palavras-passe e chaves de API só são guardadas sob a forma de hash; a comunicação é cifrada (HTTPS); o acesso é separado por organização (tenant) e por função; existe autenticação de dois fatores opcional, registo de auditoria e limitação de pedidos; [DESCREVER A POLÍTICA DE CÓPIAS DE SEGURANÇA — hoje não há backups automáticos ativos no alojamento, confirmar antes de afirmar]. Em caso de violação de dados pessoais com risco para os titulares, notificamos a CNPD em 72 horas e os afetados quando exigido (arts. 33.º e 34.º).

## 9. Cookies e armazenamento local
Usamos o estritamente necessário para manter a sessão: um cookie de sessão (`vos_session`, httpOnly) e armazenamento local do navegador para o token e preferências (idioma, tema). Não usamos cookies de publicidade nem de análise de terceiros. [CONFIRMAR SE A PÁGINA PÚBLICA USA ANALÍTICA.]

## 10. Alterações
Podemos atualizar esta política; a versão em vigor e a data constam no topo. Alterações materiais serão comunicadas com antecedência razoável.

---

## Lista de verificação antes de publicar (para o responsável)
- [ ] Preencher identidade, NIF, morada, EPD e data.
- [ ] Confirmar a região e o DPA com cada prestador (Railway, Stripe, Sentry, OpenAI, email) e ajustar a secção 4–5.
- [ ] Decidir o prazo de conservação após o fim do contrato (sec. 6).
- [ ] Ativar e documentar cópias de segurança (sec. 8).
- [ ] Redigir/anexar o Acordo de Tratamento de Dados (art. 28.º) e fazer o contrato de licença apontar para esta política com link real (hoje aponta para um email).
- [ ] Confirmar se a página pública usa analítica ou cookies adicionais.
- [ ] Rever se o EPD é obrigatório; registar o tratamento (art. 30.º).
- [ ] Revisão por jurista.
