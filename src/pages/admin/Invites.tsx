import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import AdminNav from "./AdminNav";
import { PAPER, INK, MUTED, HAIR, BODY, FORZA } from "../../lib/ui";

interface Instrument { slug: string; name: string }
interface Recipient { email: string; name: string | null }
interface Outcome extends Recipient { ok: boolean; msg?: string }
interface Flagged { line: number; text: string }
interface Parsed { recipients: Recipient[]; invalid: Flagged[]; duplicates: string[] }

/* Deliberately loose. The edge function and the mail provider are the real
   validators; this only catches lines that plainly are not an address, so they
   can be shown to the admin instead of disappearing. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/* Resend allows 2 requests per second and throttles a burst, so a batch is
   paced one send at a time rather than fired off in parallel. */
const RATE_GAP_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Newlines and semicolons always separate entries. A comma is ambiguous — it
   divides "email, Full Name" but is also a common separator between addresses —
   so it is resolved per line: if what follows the first comma contains an "@"
   the line is a list of addresses, otherwise it is one address and a name. */
export function parseBulk(raw: string): Parsed {
  const recipients: Recipient[] = [];
  const invalid: Flagged[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  raw.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    for (const chunk of rawLine.split(";")) {
      const entry = chunk.trim();
      if (!entry) continue;

      const cut = entry.indexOf(",");
      let parts: Recipient[];
      if (cut === -1) {
        parts = [{ email: entry, name: null }];
      } else {
        const rest = entry.slice(cut + 1).trim();
        parts = rest.includes("@")
          ? entry.split(",").map((t) => ({ email: t.trim(), name: null }))
          : [{ email: entry.slice(0, cut).trim(), name: rest || null }];
      }

      for (const p of parts) {
        if (!EMAIL_RE.test(p.email)) { invalid.push({ line, text: p.email || entry }); continue; }
        const key = p.email.toLowerCase();
        if (seen.has(key)) { duplicates.push(p.email); continue; }
        seen.add(key);
        recipients.push(p);
      }
    }
  });

  return { recipients, invalid, duplicates };
}

/* invoke() reports any non-2xx as a generic FunctionsHttpError ("…non-2xx
   status code") and hands back the Response as .context. The reason the
   function actually gave is in that body, so read it — a failed address should
   report "unknown instrument: foo", not the wrapper. */
async function failureMessage(error: any, data: any): Promise<string | undefined> {
  if (!error) {
    const inline = (data as any)?.error;
    return inline ? String(inline) : undefined;
  }
  const res: Response | undefined =
    typeof Response !== "undefined" && error?.context instanceof Response ? error.context : undefined;
  if (res) {
    try {
      const body = await res.clone().json();
      if (body?.error) return String(body.error);
    } catch { /* not JSON — fall through */ }
    try {
      const text = (await res.clone().text()).trim();
      if (text) return text.slice(0, 300);
    } catch { /* unreadable — fall through */ }
  }
  return String(error?.message ?? error);
}

/* One address, one outcome. Always resolves: a throw here would abort the
   surrounding batch, and an address whose call errored must never be counted
   as sent. */
async function sendOne(r: Recipient, slug: string): Promise<Outcome> {
  try {
    const { data, error } = await supabase.functions.invoke("admin-invite", {
      body: { email: r.email, full_name: r.name || null, instrument_slug: slug },
    });
    const msg = await failureMessage(error, data);
    return { ...r, ok: !msg, msg };
  } catch (e: any) {
    return { ...r, ok: false, msg: String(e?.message ?? e) };
  }
}

export default function Invites() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [slug, setSlug] = useState("");

  // single
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ email: string; instrument: string; ok: boolean; msg?: string }[]>([]);

  // bulk
  const [bulkText, setBulkText] = useState("");
  const [queue, setQueue] = useState<Recipient[]>([]);
  const [results, setResults] = useState<Outcome[]>([]);
  const [running, setRunning] = useState(false);
  const [batch, setBatch] = useState<{ slug: string; label: string } | null>(null);

  /* StrictMode mounts, unmounts and remounts in development, so this is set on
     every mount rather than only cleared on unmount. */
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("instruments")
        .select("slug,name").eq("is_active", true).order("sort_order", { ascending: true });
      const list = (data ?? []) as Instrument[];
      setInstruments(list);
      setSlug((s) => s || list[0]?.slug || "");
    })();
  }, []);

  const labelFor = (s: string) => instruments.find((i) => i.slug === s)?.name ?? s;

  /* Warn before a half-sent batch is abandoned. BrowserRouter is not a data
     router, so useBlocker is unavailable and in-app links are intercepted in
     the capture phase instead — before react-router's own click handler. */
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const guard = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!window.confirm("Invitations are still sending. Leave this page and stop the batch?")) {
        e.preventDefault(); e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [running]);

  const parsed = useMemo(() => parseBulk(bulkText), [bulkText]);

  async function invite() {
    if (!email || !slug || busy) return;
    setBusy(true);
    const outcome = await sendOne({ email, name: name || null }, slug);
    setBusy(false);
    setLog((l) => [{ email, instrument: labelFor(slug), ok: outcome.ok, msg: outcome.msg }, ...l]);
    // the instrument selection persists — inviting a cohort to the same
    // assessment is the common case
    if (outcome.ok) { setEmail(""); setName(""); }
  }

  /* Sequential by design: one in flight at a time with a gap between sends.
     Every address gets its own outcome — sendOne never rejects, so one failure
     neither aborts the batch nor hides the results either side of it. */
  async function runBatch(list: Recipient[], forSlug: string) {
    if (running || list.length === 0 || !forSlug) return;
    setRunning(true);
    setQueue(list);
    setResults([]);
    setBatch({ slug: forSlug, label: labelFor(forSlug) });
    const out: Outcome[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        if (!alive.current) return;   // the admin confirmed leaving mid-batch
        out.push(await sendOne(list[i], forSlug));
        if (!alive.current) return;
        setResults([...out]);
        if (i < list.length - 1) await sleep(RATE_GAP_MS);
      }
    } finally {
      if (alive.current) setRunning(false);
    }
  }

  const failures = results.filter((r) => !r.ok);
  const sent = results.length - failures.length;
  const done = queue.length > 0 && !running && results.length > 0;
  const canSendBulk = !running && parsed.recipients.length > 0 && !!slug;

  return (
    <div style={{ minHeight: "100vh", background: PAPER }}>
      <AdminNav />
      <div style={{ maxWidth: mode === "bulk" ? 640 : 520, margin: "0 auto", padding: "40px 24px", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}>
        <h1 className="font-display" style={{ fontSize: "1.8rem", color: INK, marginBottom: 8 }}>Send an invitation</h1>
        <p style={{ color: BODY, lineHeight: 1.6, marginBottom: 20 }}>
          The candidate receives a one-tap sign-in link by email. They can't self-register;
          only invited addresses can sign in.
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          {(["single", "bulk"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} disabled={running} className="font-label" aria-pressed={mode === m}
              style={{ flex: 1, padding: "9px 10px", fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase",
                background: mode === m ? INK : "transparent", color: mode === m ? PAPER : MUTED,
                border: `1px solid ${mode === m ? INK : HAIR}`, cursor: running ? "default" : "pointer", opacity: running && mode !== m ? 0.5 : 1 }}>
              {m === "single" ? "One at a time" : "Bulk"}
            </button>
          ))}
        </div>

        <label style={lbl} htmlFor="inv-instrument">Assessment</label>
        <select id="inv-instrument" value={slug} onChange={(e) => setSlug(e.target.value)}
          style={{ ...inp, color: INK, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" }}
          disabled={instruments.length === 0 || running}>
          {instruments.length === 0
            ? <option value="">Loading…</option>
            : instruments.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
        </select>

        {mode === "single" ? (
          <>
            <label style={lbl}>Full name (optional)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="Jordan Lee" />
            <label style={lbl}>Email</label>
            <input value={email} type="email" onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()} style={inp} placeholder="jordan@example.com" />
            <button onClick={invite} disabled={busy || !slug} className="font-label"
              style={{ ...btn, opacity: busy || !slug ? 0.6 : 1 }}>
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
          </>
        ) : (
          <>
            <label style={lbl} htmlFor="inv-bulk">Addresses — one per line</label>
            <textarea id="inv-bulk" value={bulkText} onChange={(e) => setBulkText(e.target.value)} disabled={running}
              rows={8} style={{ ...inp, resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, lineHeight: 1.6 }}
              placeholder={"jordan@example.com\nsam@example.com, Sam Okafor\nalex@example.com; robin@example.com"} />
            <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.6, margin: "2px 0 4px" }}>
              Commas and semicolons work too. Add a name after the address —
              <span className="font-mono"> sam@example.com, Sam Okafor</span> — and it is used for that invitation.
            </p>

            {bulkText.trim() !== "" && (
              <div style={{ border: `1px solid ${HAIR}`, background: "#fff", padding: "14px 16px", margin: "12px 0" }}>
                <div className="font-label" style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>
                  Preview — {parsed.recipients.length} {parsed.recipients.length === 1 ? "invitation" : "invitations"} to {labelFor(slug)}
                </div>
                {parsed.recipients.length > 0 && (
                  <ol style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 220, overflowY: "auto" }}>
                    {parsed.recipients.map((r) => (
                      <li key={r.email} className="font-mono" style={{ fontSize: 12, color: INK, padding: "3px 0" }}>
                        {r.email}{r.name ? <span style={{ color: MUTED }}> · {r.name}</span> : null}
                      </li>
                    ))}
                  </ol>
                )}
                {parsed.duplicates.length > 0 && (
                  <p style={{ color: MUTED, fontSize: 12, margin: "10px 0 0" }}>
                    {parsed.duplicates.length} duplicate {parsed.duplicates.length === 1 ? "address" : "addresses"} collapsed:{" "}
                    <span className="font-mono">{parsed.duplicates.join(", ")}</span>
                  </p>
                )}
                {parsed.invalid.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${HAIR}` }}>
                    <div className="font-label" style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: FORZA, marginBottom: 6 }}>
                      {parsed.invalid.length} {parsed.invalid.length === 1 ? "line" : "lines"} not read as an email address — these will not be sent
                    </div>
                    {parsed.invalid.map((f, i) => (
                      <div key={i} className="font-mono" style={{ fontSize: 12, color: FORZA, padding: "2px 0" }}>
                        line {f.line}: {f.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => runBatch(parsed.recipients, slug)} disabled={!canSendBulk} className="font-label"
              style={{ ...btn, opacity: canSendBulk ? 1 : 0.6 }}>
              {running
                ? `Sending ${Math.min(results.length + 1, queue.length)} of ${queue.length}…`
                : parsed.recipients.length === 0
                  ? "Send invitations"
                  : `Send ${parsed.recipients.length} ${parsed.recipients.length === 1 ? "invitation" : "invitations"}`}
            </button>

            {queue.length > 0 && (
              <div style={{ marginTop: 24 }}>
                {running && (
                  <p className="font-label" style={{ fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>
                    Sending {Math.min(results.length + 1, queue.length)} of {queue.length} — please stay on this page
                  </p>
                )}
                {done && (
                  <div style={{ marginBottom: 14 }}>
                    <p className="font-display" style={{ fontSize: "1.05rem", color: INK, margin: "0 0 4px" }}>
                      {sent} of {results.length} sent{failures.length > 0 ? ` · ${failures.length} failed` : ""}
                    </p>
                    <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>{batch?.label}</p>
                    {failures.length > 0 && (
                      <button onClick={() => runBatch(failures.map((f) => ({ email: f.email, name: f.name })), batch?.slug ?? slug)}
                        className="font-label"
                        style={{ marginTop: 12, padding: "9px 14px", fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase",
                          background: "none", color: FORZA, border: `1px solid ${FORZA}`, cursor: "pointer" }}>
                        Retry {failures.length} failed
                      </button>
                    )}
                  </div>
                )}
                {queue.map((r, i) => {
                  const o = results[i];
                  const pending = !o;
                  const active = running && i === results.length;
                  return (
                    <div key={`${r.email}-${i}`} className="font-mono"
                      style={{ fontSize: 12, padding: "8px 0", borderBottom: `1px solid ${HAIR}`, display: "flex", gap: 8,
                        color: pending ? MUTED : o.ok ? INK : FORZA, opacity: pending && !active ? 0.55 : 1 }}>
                      <span aria-hidden="true">{pending ? (active ? "→" : "·") : o.ok ? "✓" : "✕"}</span>
                      <span style={{ flex: 1, wordBreak: "break-word" }}>
                        {r.email}
                        {o && !o.ok && o.msg ? ` — ${o.msg}` : ""}
                        {pending && active ? " — sending…" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: MUTED, marginBottom: 6, marginTop: 14 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", border: `1px solid ${HAIR}`, background: "#fff", fontSize: 15, marginBottom: 6, boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", padding: 14, background: INK, color: PAPER, fontSize: 13, letterSpacing: ".07em", textTransform: "uppercase", border: "none", cursor: "pointer", marginTop: 8 };
