import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AdminNav from "./AdminNav";
import { PAPER, INK, MUTED, HAIR } from "../../lib/ui";

interface Row { user_id: string; email: string; full_name: string | null; status: string; invited_at: string; completed_at: string | null }

const STATUS: Record<string, { label: string; color: string }> = {
  invited: { label: "Invited", color: "#6B7280" },
  in_progress: { label: "In progress", color: "#C08A2D" },
  completed: { label: "Completed", color: "#2E7D74" },
};

export default function Candidates() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("candidates")
        .select("user_id,email,full_name,status,invited_at,completed_at")
        .order("invited_at", { ascending: false });
      setRows((data ?? []) as Row[]); setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <AdminNav />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <h1 className="font-serif" style={{ fontSize: "1.8rem", color: INK, marginBottom: 20 }}>Candidates</h1>
        {loading ? <p className="font-mono" style={{ color: MUTED }}>Loading…</p> : rows.length === 0 ? (
          <p style={{ color: MUTED }}>No candidates yet. Send an invitation to get started.</p>
        ) : (
          <div style={{ background: HAIR, display: "grid", gap: 1 }}>
            {rows.map((r) => {
              const st = STATUS[r.status] ?? STATUS.invited;
              const done = r.status === "completed";
              const inner = (
                <div style={{ background: PAPER, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-serif" style={{ fontSize: "1.05rem", color: INK }}>{r.full_name || r.email}</div>
                    {r.full_name && <div className="font-mono" style={{ fontSize: 12, color: MUTED }}>{r.email}</div>}
                  </div>
                  <span className="font-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", padding: "3px 8px", borderRadius: 4, color: st.color, background: st.color + "18" }}>{st.label}</span>
                  {done && <span className="font-mono" style={{ fontSize: 12, color: MUTED }}>View →</span>}
                </div>
              );
              return done
                ? <Link key={r.user_id} to={`/admin/candidates/${r.user_id}`} style={{ textDecoration: "none" }}>{inner}</Link>
                : <div key={r.user_id}>{inner}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
