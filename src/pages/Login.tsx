import { useState } from "react";
import { supabase } from "../lib/supabase";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestLink() {
    if (!email) return;
    setBusy(true);
    // public edge function — only sends if the address is already provisioned
    await supabase.functions.invoke("request-link", { body: { email } });
    setBusy(false);
    setSent(true); // always show the same confirmation (no enumeration)
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER, display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <p className="font-mono" style={{ fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Strengths Profile</p>
        <h1 className="font-serif" style={{ fontSize: "2rem", color: INK, marginBottom: 12 }}>Sign in</h1>
        {sent ? (
          <p style={{ color: "#3A3F49", lineHeight: 1.6 }}>
            If <strong>{email}</strong> was invited, a sign-in link is on its way.
            Open it on this device to continue. You can close this tab.
          </p>
        ) : (
          <>
            <p style={{ color: "#3A3F49", lineHeight: 1.6, marginBottom: 20 }}>
              Enter the email you were invited with. We'll send a one-tap sign-in
              link — there's no password, and accounts are invitation-only.
            </p>
            <input
              type="email" value={email} placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestLink()}
              style={{ width: "100%", padding: "12px 14px", border: `1px solid ${HAIR}`, background: "#fff", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }}
            />
            <button onClick={requestLink} disabled={busy}
              className="font-mono"
              style={{ width: "100%", padding: 14, background: INK, color: PAPER, fontSize: 13, letterSpacing: ".05em", textTransform: "uppercase", border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Sending…" : "Email me a link"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
