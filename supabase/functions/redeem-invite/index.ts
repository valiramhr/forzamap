// POST { token } — public. Trades a durable invite token for a magic link.
//
// This is the whole point of the token: the emailed URL can be fetched by every
// scanner between here and the recipient's inbox without costing anything,
// because it carries no session. The magic link is minted here, on the request
// the real browser makes, and is followed by that browser within milliseconds.
// Session creation stays inside Supabase Auth — nothing here signs anybody in.
//
// Deploy with --no-verify-jwt (see supabase/config.toml): the caller is an
// anonymous browser holding a link, which is exactly the credential being
// checked.
import { admin, cors, siteUrl } from "../_shared.ts";

/* PostgREST returns a many-to-one embed as an object; tolerate an array too. */
const one = (x: any) => (Array.isArray(x) ? x[0] : x) ?? {};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "token required" }, 400);

    const sb = admin();
    const { data: assignment, error: aErr } = await sb.from("assignments")
      .select("id,status,candidate:candidates!inner(email)")
      .eq("invite_token", token).maybeSingle();
    if (aErr) throw aErr;

    // Deliberately the same answer for a token that never existed and one that
    // has been reset: from outside, a link that isn't recognised is a link that
    // isn't recognised.
    if (!assignment) {
      return json({
        reason: "not_found",
        error: "This link isn't recognised. It may have been replaced by a newer one.",
      }, 404);
    }

    if (assignment.status === "completed") {
      return json({
        reason: "completed",
        error: "This assessment has already been submitted. There is nothing left to complete.",
      }, 409);
    }

    const email = one(assignment.candidate).email;
    if (!email) throw new Error("assignment has no candidate email");

    const { data, error } = await sb.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: siteUrl() },
    });
    if (error) throw error;
    const url = data.properties?.action_link;
    if (!url) throw new Error("no action_link returned");

    return json({ ok: true, url });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
