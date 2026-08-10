import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminNav from "./AdminNav";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../../lib/ui";

interface Instrument { slug: string; name: string }

export default function Invites() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [slug, setSlug] = useState("");
  const [log, setLog] = useState<{ email: string; instrument: string; ok: boolean; msg?: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("instruments")
        .select("slug,name").eq("is_active", true).order("sort_order", { ascending: true });
      const list = (data ?? []) as Instrument[];
      setInstruments(list);
      setSlug((s) => s || list[0]?.slug || "");
    })();
  }, []);

  async function invite() {
    if (!email || !slug) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email, full_name: name || null, instrument_slug: slug },
    });
    setBusy(false);
    const ok = !error && !(data as any)?.error;
    const label = instruments.find((i) => i.slug === slug)?.name ?? slug;
    setLog((l) => [{ email, instrument: label, ok, msg: error?.message ?? (data as any)?.error }, ...l]);
    // the instrument selection persists — inviting a cohort to the same
    // assessment is the common case
    if (ok) { setEmail(""); setName(""); }
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <AdminNav />
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
        <h1 className="font-display" style={{ fontSize: "1.8rem", color: INK, marginBottom: 8 }}>Send an invitation</h1>
        <p style={{ color: BODY, lineHeight: 1.6, marginBottom: 24 }}>
          The candidate receives a one-tap sign-in link by email. They can't self-register;
          only invited addresses can sign in.
        </p>
        <label style={lbl} htmlFor="inv-instrument">Assessment</label>
        <select id="inv-instrument" value={slug} onChange={(e) => setSlug(e.target.value)}
          style={{ ...inp, color: INK, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}
          disabled={instruments.length === 0}>
          {instruments.length === 0
            ? <option value="">Loading…</option>
            : instruments.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
        </select>

        <label style={lbl}>Full name (optional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="Jordan Lee" />
        <label style={lbl}>Email</label>
        <input value={email} type="email" onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()} style={inp} placeholder="jordan@example.com" />
        <button onClick={invite} disabled={busy || !slug} className="font-label"
          style={{ width: "100%", padding: 14, background: INK, color: PAPER, fontSize: 13, letterSpacing: ".07em", textTransform: "uppercase", border: "none", cursor: "pointer", opacity: busy || !slug ? 0.6 : 1 }}>
          {busy ? "Sending…" : "Send invitation"}
        </button>

        {log.length > 0 && (
          <div style={{ marginTop: 28 }}>
            {log.map((e, i) => (
              <div key={i} className="font-mono" style={{ fontSize: 12, padding: "8px 0", borderBottom: `1px solid ${HAIR}`, color: e.ok ? INK : FORZA }}>
                {e.ok ? "✓ sent to " : "✕ "} {e.email} · {e.instrument}{e.msg ? ` — ${e.msg}` : ""}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
const lbl: React.CSSProperties = { display: "block", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, marginBottom: 6, marginTop: 14 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", border: `1px solid ${HAIR}`, background: "#fff", fontSize: 15, marginBottom: 6, boxSizing: "border-box" };
