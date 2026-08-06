// POST { email } — public. Re-sends a link ONLY to already-provisioned people.
// Deploy WITH  --no-verify-jwt  (see supabase/config.toml).
import { admin, cors, sendMagicLink } from "../_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

    const sb = admin();
    // authorised iff the email is a known candidate or admin
    const [{ data: cand }, { data: adm }] = await Promise.all([
      sb.from("candidates").select("email,full_name").eq("email", email).maybeSingle(),
      sb.from("admins").select("email").eq("email", email).maybeSingle(),
    ]);

    if (cand || adm) {
      await sendMagicLink(email, cand?.full_name ?? null);
    }
    // always 200 — never reveal whether the address is known
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
