export function KpiCard({ title, value, hint }: { title: string; value: string | number; hint?: string }){
  return (
    <div className="sg-card" style={{ padding: 16 }}>
      <div className="sg-muted" style={{ fontWeight: 800, fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8 }}>{value}</div>
      {hint && <div className="sg-muted" style={{ marginTop: 6, fontSize: 12 }}>{hint}</div>}
    </div>
  );
}
