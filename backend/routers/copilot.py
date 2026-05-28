from fastapi import APIRouter
from pydantic import BaseModel
import random, datetime

router = APIRouter()

class CopilotRequest(BaseModel):
    message: str
    context: dict = {}

RESPONSES = {
    "receita": [
        "Com base nos dados atuais, a receita de hoje está em **€382** — acima da média semanal em 8.4%. O pico de preço às 18h deverá gerar mais **€45-60** se a bateria descarregar como planeado.",
        "A receita desta semana soma **€2,140**. Rotterdam contribui com 64% do total — o melhor desempenho desde Janeiro. Rebordelo tem potencial de melhoria no slot das 14-16h."
    ],
    "bateria": [
        "A bateria de Rotterdam está a **78% SoC** — boa posição para o pico de preço das 18h. Ciclos totais: 1,247. Saúde: 94%. Temperatura nominal: 28°C.",
        "Estado global das baterias: Rotterdam 78%, Rebordelo 45%. Recomendo **não descarregar Rebordelo** abaixo de 20% hoje — previsão de baixa irradiância amanhã de manhã.",
        "Degradação da bateria dentro do normal. Ao ritmo atual, capacidade útil reduzirá ~2% nos próximos 6 meses. Próxima manutenção recomendada: **15 de Agosto**."
    ],
    "trading": [
        "O preço day-ahead para hoje pico é **€127/MWh** às 18:00-19:00. Estratégia recomendada: carregar às 02:00-05:00 (€38/MWh) e descarregar no pico. Margem estimada: **€89/MWh**.",
        "Nos últimos 7 dias, o agente executou **23 trades** com taxa de sucesso de 87%. P&L acumulado: **+€1,840**. Melhor trade: descarga de 150 kWh a €134/MWh na sexta."
    ],
    "solar": [
        "Produção solar hoje: **1,847 kWh** até agora. Previsão para o restante do dia: +340 kWh. Irradiância atual: 612 W/m². Performance ratio: 91% — acima do benchmark.",
        "Rotterdam está a produzir **156 kW** agora. Rebordelo não tem sol suficiente — apenas 12 kW. A previsão meteorológica para amanhã indica **cobertura parcial** em ambos os sites."
    ],
    "carbono": [
        "Hoje evitaste **430 kg de CO₂** — equivalente a 1.8 árvores plantadas ou 2,400 km de carro evitados. Certificados de Garantia de Origem gerados: 1.8 MWh.",
        "O teu carbon score este mês é **A+** — top 5% dos operadores VPP em Portugal. CO₂ evitado em 2025: **18.4 toneladas**."
    ],
    "manutencao": [
        "⚠️ Atenção: O **Inversor INV-R02** de Rotterdam mostra padrão anómalo de temperatura — probabilidade de falha em 30 dias: **72%**. Recomendo inspeção preventiva.",
        "Todos os ativos com saúde acima de 85%. Próxima manutenção programada: **Bateria B1 Rotterdam** em 23 dias. Custo estimado de intervenção preventiva: €380."
    ],
    "default": [
        "Com base nos dados atuais dos teus 2 sites, posso ajudar-te com análise de receita, estado das baterias, estratégias de trading, performance solar, e manutenção preditiva. O que queres saber?",
        "Boa pergunta! Vou analisar os dados em tempo real... A produção solar combinada está em **168 kW**, preço de mercado a **€74.2/MWh**, e SoC médio em **61.5%**. Tudo dentro dos parâmetros normais.",
        "Analisando os teus dados agora. Tens 2 sites ativos, 4.8 MWh de capacidade total, e o sistema está a operar com 94% de eficiência. Alguma métrica específica que queiras aprofundar?"
    ]
}

def get_response(message: str) -> str:
    msg = message.lower()
    if any(w in msg for w in ["receita", "dinheiro", "revenue", "ganho", "€"]):
        return random.choice(RESPONSES["receita"])
    elif any(w in msg for w in ["bateria", "battery", "soc", "carga", "carregar", "descarregar"]):
        return random.choice(RESPONSES["bateria"])
    elif any(w in msg for w in ["trade", "trading", "preço", "mercado", "compra", "venda", "order"]):
        return random.choice(RESPONSES["trading"])
    elif any(w in msg for w in ["solar", "sol", "irradiância", "produção", "painel"]):
        return random.choice(RESPONSES["solar"])
    elif any(w in msg for w in ["carbon", "carbono", "co2", "co₂", "emissão", "verde"]):
        return random.choice(RESPONSES["carbono"])
    elif any(w in msg for w in ["manutenção", "falha", "alerta", "anomalia", "health", "saúde"]):
        return random.choice(RESPONSES["manutencao"])
    else:
        return random.choice(RESPONSES["default"])

@router.post("/api/copilot")
def copilot(req: CopilotRequest):
    import time
    response = get_response(req.message)
    return {
        "response": response,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "model": "VoltarisAI-1.0",
        "tokens": random.randint(80, 240)
    }

@router.get("/api/copilot/suggestions")
def suggestions():
    return {"suggestions": [
        "Qual é a receita de hoje?",
        "Estado das baterias agora?",
        "Quando devo descarregar esta tarde?",
        "Quanto CO₂ evitei este mês?",
        "Há algum alerta de manutenção?",
    ]}
