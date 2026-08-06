import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { PAPER, INK, MUTED, HAIR } from "../lib/ui";

const inputStyle = {
  width: "100%", padding: "12px 14px", border: `1px solid ${HAIR}`,
  background: "#fff", fontSize: 15, marginBottom: 12, boxSizing: "border-box" as const,
};
const buttonStyle = {
  width: "100%", padding: 14, background: INK, color: PAPER, fontSize: 13,
  letterSpacing: ".05em", textTransform: "uppercase" as const, border: "none", cursor: "pointer",
};
const toggleStyle = {
  display: "block", marginTop: 20, background: "none", border: "none", padding: 0,
  color: MUTED, fontSize: 12, letterSpacing: ".05em", cursor: "pointer",
  textDecoration: "underline",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"link" | "password">("link");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function requestLink() {
    if (!email) return;
    setBusy(true);
    // public edge function — only sends if the address is already provisioned
    await supabase.functions.invoke("request-link", { body: { email } });
    setBusy(false);
    setSent(true); // always show the same confirmation (no enumeration)
  }

  async function signIn() {
    if (!email || !password) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    // same message for every failure (no enumeration)
    if (error) return setError("Sign in failed. Check your email and password.");
    navigate("/", { replace: true });
  }

  function switchMode(next: "link" | "password") {
    setMode(next);
    setPassword("");
    setError("");
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
        ) : mode === "password" ? (
          <>
            <p style={{ color: "#3A3F49", lineHeight: 1.6, marginBottom: 20 }}>
              Sign in with your email and password.
            </p>
            <input
              type="email" value={email} placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              style={inputStyle}
            />
            <input
              type="password" value={password} placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              style={inputStyle}
            />
            {error && (
              <p style={{ color: "#B4232A", fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{error}</p>
            )}
            <button onClick={signIn} disabled={busy}
              className="font-mono"
              style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button onClick={() => switchMode("link")} className="font-mono" style={toggleStyle}>
              Email me a link instead
            </button>
          </>
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
              style={inputStyle}
            />
            <button onClick={requestLink} disabled={busy}
              className="font-mono"
              style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Sending…" : "Email me a link"}
            </button>
            <button onClick={() => switchMode("password")} className="font-mono" style={toggleStyle}>
              Admin sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
