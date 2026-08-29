from fastapi import APIRouter
from pydantic import BaseModel
import datetime, os, random
from backend.models import utcnow_naive

router = APIRouter()

class CopilotRequest(BaseModel):
    message: str
    context: dict = {}

# System prompt for VoltarisOS AI Copilot
SYSTEM_PROMPT = """You are VoltarisAI, an expert energy management copilot embedded in VoltarisOS — a Virtual Power Plant (VPP) operating system for solar + battery sites in Portugal.

Your role: help operators manage their energy assets, maximize revenue, and optimize trading decisions.

You have access to live platform context (provided in each message). Use it to give precise, data-driven answers.

Your expertise covers:
- Battery state of charge (SoC), health, degradation, charge/discharge scheduling
- Solar PV production forecasting and performance analysis
- Day-ahead and intraday electricity market trading (MIBEL/OMIE)
- Grid balance, frequency regulation, ancillary services
- Carbon credits, Guarantees of Origin (GoO), sustainability metrics
- Predictive maintenance, anomaly detection, equipment health
- Revenue optimization: when to buy cheap, when to sell at peak
- Portuguese energy regulations and OMIE market mechanics

Communication style:
- Respond in the SAME language the user writes in (Portuguese if they write Portuguese, English if English)
- Be concise but thorough — operators are busy
- Use **bold** for key numbers and decisions
- Give actionable recommendations, not just observations
- Reference actual data from the context when available
- Keep responses under 200 words unless the user asks for a detailed analysis

Always end with a short actionable insight or recommendation if relevant."""

def build_context_string(context: dict) -> str:
    """Convert frontend context dict into readable string for the prompt.

    Only values actually supplied by the caller are included. If the context
    is explicitly flagged `data_status == "simulated"` (or is empty), no
    fabricated operational numbers (grid price / revenue / P&L / SoC) are
    invented and injected as if they were real.
    """
    if not context:
        return ""

    parts = []
    now = utcnow_naive().strftime("%Y-%m-%d %H:%M UTC")
    parts.append(f"Current time: {now}")

    if context.get("sites"):
        parts.append(f"Active sites: {context['sites']}")
    if context.get("battery_soc"):
        parts.append(f"Battery SoC: {context['battery_soc']}%")
    if context.get("solar_production"):
        parts.append(f"Solar production now: {context['solar_production']} kW")
    if context.get("grid_price"):
        parts.append(f"Current grid price: €{context['grid_price']}/MWh")
    if context.get("daily_revenue"):
        parts.append(f"Revenue today: €{context['daily_revenue']}")
    if context.get("total_capacity"):
        parts.append(f"Total battery capacity: {context['total_capacity']} kWh")
    if context.get("pnl"):
        parts.append(f"Trading P&L today: €{context['pnl']}")

    # Never fabricate operational numbers. If no real context was supplied
    # (simulated or empty), disclose that explicitly instead of inventing data.
    if context.get("data_status") == "simulated" or len(parts) == 1:
        parts.append("[Aviso: dados de contexto simulados/indisponíveis — não representam operações reais.]")

    return "\n".join(parts)


def get_openai_response(message: str, context: dict) -> str:
    """Call OpenAI GPT-4o API."""
    try:
        from openai import OpenAI
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        
        client = OpenAI(api_key=api_key)
        
        context_str = build_context_string(context)
        user_message = f"[Platform context]\n{context_str}\n\n[User question]\n{message}"
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=400,
            temperature=0.7,
        )
        
        return response.choices[0].message.content, False

    except Exception as e:
        # Fallback to static responses if API fails — caller must disclose this to the user
        return get_fallback_response(message, str(e)), True


def get_fallback_response(message: str, error: str = "") -> str:
    """Fallback responses when OpenAI is unavailable."""
    msg = message.lower()
    
    _SIM = "⚠️ *Dados simulados (VoltarisAI indisponível de momento)* — "

    RESPONSES = {
        "receita": [
            _SIM + "Com base num exemplo, a receita de hoje está em **€382** — acima da média semanal em 8.4%. O pico de preço às 18h deverá gerar mais **€45-60** se a bateria descarregar como planeado.",
        ],
        "bateria": [
            _SIM + "Rotterdam está a **78% SoC** — boa posição para o pico das 18h. Rebordelo: 45%. Recomendo manter Rebordelo acima de 20% — previsão de baixa irradiância amanhã.",
        ],
        "trading": [
            _SIM + "Preço day-ahead pico: **€127/MWh** às 18:00. Estratégia: carregar 02:00-05:00 (€38/MWh), descarregar no pico. Margem estimada: **€89/MWh**.",
        ],
        "solar": [
            _SIM + "Produção solar hoje: **1,847 kWh**. Rotterdam: 156 kW ativos. Irradiância: 612 W/m². Performance ratio: 91%.",
        ],
        "default": [
            "⚠️ **Dados simulados** — VoltarisAI (GPT-4o) está temporariamente indisponível. Isto é uma resposta de exemplo, não reflete os dados reais da tua conta.",
        ]
    }
    
    if any(w in msg for w in ["receita", "revenue", "ganho", "€"]):
        return random.choice(RESPONSES["receita"])
    elif any(w in msg for w in ["bateria", "battery", "soc"]):
        return random.choice(RESPONSES["bateria"])
    elif any(w in msg for w in ["trade", "trading", "preço", "mercado"]):
        return random.choice(RESPONSES["trading"])
    elif any(w in msg for w in ["solar", "sol", "produção"]):
        return random.choice(RESPONSES["solar"])
    else:
        return random.choice(RESPONSES["default"])


@router.post("/api/copilot")
def copilot(req: CopilotRequest):
    start = utcnow_naive()
    response, llm_simulated = get_openai_response(req.message, req.context)
    # Preserve the simulated signal: either the LLM fallback was used, or the
    # caller supplied a context explicitly flagged as simulated.
    context_simulated = req.context.get("data_status") == "simulated"
    simulated = llm_simulated or context_simulated
    elapsed_ms = int((utcnow_naive() - start).total_seconds() * 1000)

    return {
        "response": response,
        "simulated": simulated,  # true when GPT-4o was unavailable or context was simulated
        "timestamp": utcnow_naive().isoformat(),
        "model": "fallback" if llm_simulated else "gpt-4o",
        "tokens": len(response.split()) * 2,  # rough estimate
        "latency_ms": elapsed_ms,
    }


@router.get("/api/copilot/suggestions")
def suggestions():
    return {"suggestions": [
        "Qual é a receita de hoje?",
        "Estado das baterias agora?",
        "Quando devo descarregar esta tarde?",
        "Quanto CO₂ evitei este mês?",
        "Há algum alerta de manutenção?",
        "Analisa a estratégia de trading para amanhã",
        "Qual o melhor momento para carregar a bateria esta noite?",
    ]}
