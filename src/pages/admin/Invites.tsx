import { useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminNav from "./AdminNav";
import { PAPER, INK, MUTED, HAIR } from "../../lib/ui";

export default function Invites() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [log, setLog] = useState<{ email: string; ok: boolean; msg?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!email) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email, full_name: name || null },
    });
    setBusy(false);
    const ok = !error && !(data as any)?.error;
    setLog((l) => [{ email, ok, msg: error?.message ?? (data as any)?.error }, ...l]);
    if (ok) { setEmail(""); setName(""); }
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <AdminNav />
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <h1 className="font-serif" style={{ fontSize: "1.8rem", color: INK, marginBottom: 8 }}>Send an invitation</h1>
        <p style={{ color: "#3A3F49", lineHeight: 1.6, marginBottom: 24 }}>
          The candidate receives a one-tap sign-in link by email. They can't self-register;
          only invited addresses can sign in.
        </p>
        <label style={lbl}>Full name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="Jordan Lee" />
        <label style={lbl}>Email</label>
        <input value={email} type="email" onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()} style={inp} placeholder="jordan@example.com" />
        <button onClick={invite} disabled={busy} className="font-mono"
          style={{ width: "100%", padding: 14, background: INK, color: PAPER, fontSize: 13, letterSpacing: ".05em", textTransform: "uppercase", border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Sending…" : "Send invitation"}
        </button>

        {log.length > 0 && (
          <div style={{ marginTop: 28 }}>
            {log.map((e, i) => (
              <div key={i} className="font-mono" style={{ fontSize: 12, padding: "8px 0", borderBottom: `1px solid ${HAIR}`, color: e.ok ? INK : "#9C3D54" }}>
                {e.ok ? "✓ sent to " : "✕ "} {e.email}{e.msg ? ` — ${e.msg}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
const lbl: React.CSSProperties = { display: "block", fontFamily: "ui-monospace, monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: MUTED, marginBottom: 6, marginTop: 14 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", border: `1px solid ${HAIR}`, background: "#fff", fontSize: 15, marginBottom: 6, boxSizing: "border-box" };
