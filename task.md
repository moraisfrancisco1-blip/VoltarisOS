# VoltarisOS — Elite Feature Batch

## Features a implementar (tudo em paralelo)

### 1. 🧠 AI Copilot — `AICopilot.jsx` (floating widget em App.jsx)
- Chat bubble flutuante no canto inferior direito, disponível em todas as páginas
- Backend: POST /api/copilot — mock responses inteligentes com contexto dos dados
- Reconhece perguntas sobre: receita, bateria, trading, sites, preços
- Animação de typing, histórico da conversa, sugestões rápidas

### 2. 🌍 Carbon Intelligence — `CarbonDashboard.jsx`
- CO₂ evitado em tempo real (kWh solar × 0.233 kg CO₂/kWh)
- Garantias de Origem geradas
- Equivalências: árvores, viagens avião, carros
- Carbon score por site (A/B/C/D rating)
- Chart histórico de carbono evitado
- "Carbon Certificate" mock exportável

### 3. 📡 Autonomous Trading Agent — `AutonomousTrading.jsx`
- Agent status: RUNNING / PAUSED / STOPPED
- Log ao vivo de decisões com timestamp
- Configuração de regras: preço mínimo venda, preço máximo compra, SoC limites
- P&L do agente em tempo real
- Toggle para override manual
- Simulação de ordens sendo executadas

### 4. ⚡ Digital Twin — `DigitalTwin.jsx`
- Visualização 3D SVG animada do site (painel solar, bateria, rede, consumo)
- Fluxos de energia animados entre componentes (setas animadas)
- Estado em tempo real: temperaturas, tensões, potências
- Previsão 15/30/60 min de SoC
- Toggle entre Rotterdam e Rebordelo

### 5. 🔮 Predictive Maintenance — `PredictiveMaintenance.jsx`
- Lista de ativos com health score (0-100%)
- Probabilidade de falha nos próximos 7/30/90 dias
- Alertas preditivos com severidade
- Histórico de anomalias detetadas
- "Maintenance Schedule" recomendado pelo AI
- Degradação de bateria ao longo do tempo (chart)

### 6. 📱 Mobile App — Expo app separado
- Lê skill app primeiro
- Screens: Dashboard, Sites, Battery, Alerts, Trading
- Push notifications simuladas
- SoC widget-style cards

### 7. 🎛️ White-label / Multi-tenant
- Settings page upgrade: upload logo, brand colors, custom domain
- Backend: /api/tenant config
- Sidebar e header refletem brand do tenant
- Demo: switching entre "Voltaris Demo" e custom tenant

## Ordem de execução
1. Backend routes (copilot + trading agent + tenant)
2. Frontend pages (5 novas páginas)
3. AI Copilot widget (App.jsx)
4. Sidebar update (novas páginas)
5. Mobile app (Expo)
6. Git push
