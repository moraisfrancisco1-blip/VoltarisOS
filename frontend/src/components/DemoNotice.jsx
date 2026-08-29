export default function DemoNotice({ children = "Demo mode — alguns dados desta página são simulados e não representam operações reais." }) {
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10, marginBottom: 16,
      background: "linear-gradient(90deg, #78350f, #92400e)",
      border: "1px solid #f59e0b66", color: "#fcd34d", fontSize: 13, fontWeight: 600,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 14 }}>🧪</span>
      <span>{children}</span>
    </div>
  );
}
