import { useNavigate } from "react-router-dom";
import { XCircle, ArrowLeft } from "lucide-react";

export default function PaymentCancel() {
  const navigate = useNavigate();

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
          background: "rgba(248, 113, 113, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px"
        }}>
          <XCircle size={48} color="#f87171" />
        </div>

        <h1 style={{
          color: "var(--text)",
          fontSize: "28px",
          fontWeight: "700",
          marginBottom: "12px"
        }}>
          Pagamento Cancelado
        </h1>

        <p style={{
          color: "var(--sub)",
          fontSize: "16px",
          marginBottom: "24px",
          lineHeight: "1.6"
        }}>
          O pagamento foi cancelado. Nenhum valor foi cobrado. Podes tentar novamente quando quiseres.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px 24px",
              color: "var(--text)",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <ArrowLeft size={20} />
            Voltar
          </button>
          <button
            onClick={() => navigate("/pricing")}
            style={{
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              border: "none",
              borderRadius: "12px",
              padding: "14px 24px",
              color: "#0a0f1a",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            Ver Planos
          </button>
        </div>
      </div>
    </div>
  );
}