import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      fetch(`/api/payments/session/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          setSessionData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching session:", err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)"
      }}>
        <div style={{ color: "var(--text)", fontSize: "18px" }}>A processar pagamento...</div>
      </div>
    );
  }

  const paid = sessionData && (sessionData.payment_status === "paid" || sessionData.payment_status === "no_payment_required");
  const failed = sessionData && sessionData.payment_status === "unpaid";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: "20px"
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "40px",
        maxWidth: "500px",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: paid ? "rgba(74, 222, 128, 0.1)" : failed ? "rgba(248, 113, 113, 0.1)" : "rgba(245, 158, 11, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px"
        }}>
          {paid ? <CheckCircle size={48} color="#4ade80" /> : failed ? <XCircle size={48} color="#f87171" /> : <CheckCircle size={48} color="#f59e0b" />}
        </div>

        <h1 style={{
          color: "var(--text)",
          fontSize: "28px",
          fontWeight: "700",
          marginBottom: "12px"
        }}>
          {paid ? "Pagamento Confirmado!" : failed ? "Pagamento Falhado" : "Pagamento Pendente"}
        </h1>

        <p style={{
          color: "var(--sub)",
          fontSize: "16px",
          marginBottom: "24px",
          lineHeight: "1.6"
        }}>
          {paid
            ? "A tua subscrição foi ativada com sucesso. Já podes aceder a todas as funcionalidades do VoltarisOS."
            : failed
              ? "O pagamento não foi concluído. Nenhum valor foi cobrado. Tenta novamente."
              : "Estamos a confirmar o teu pagamento. Isto pode demorar alguns instantes."}
        </p>

        {sessionData && (
          <div style={{
            background: "var(--surface2)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "24px",
            textAlign: "left"
          }}>
            <div style={{ color: "var(--sub)", fontSize: "12px", marginBottom: "8px" }}>
              Detalhes da Subscrição
            </div>
            <div style={{ color: "var(--text)", fontSize: "14px" }}>
              <div>Email: {sessionData.customer_email || "N/A"}</div>
              <div>Plano: {sessionData.metadata?.plan_id || "N/A"}</div>
              <div>Ciclo: {sessionData.metadata?.billing_cycle || "N/A"}</div>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/dashboard")}
          style={{
            background: "linear-gradient(135deg, #4ade80, #22d3ee)",
            border: "none",
            borderRadius: "12px",
            padding: "14px 32px",
            color: "#0a0f1a",
            fontSize: "16px",
            fontWeight: "700",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          Aceder ao Dashboard
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}