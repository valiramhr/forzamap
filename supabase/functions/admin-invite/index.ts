// POST { email, full_name?, instrument_slug? }  — admin only.
// Provisions candidate + assignment, sends link.
// Deploy WITH jwt verification (default).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { admin, cors, sendMagicLink } from "../_shared.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    // who is calling?
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const sb = admin();
    const { data: isAdmin } = await sb
      .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const { email, full_name, instrument_slug } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

    // resolve the instrument before provisioning anyone, so a bad slug can't
    // leave a candidate behind with no assignment
    const slug = instrument_slug ?? "strengths-profile";
    const { data: instrument } = await sb
      .from("instruments").select("id").eq("slug", slug).maybeSingle();
    if (!instrument) return json({ error: `unknown instrument: ${slug}` }, 400);

    // create the auth user (idempotent: ignore "already registered")
    const { data: created, error: cErr } =
      await sb.auth.admin.createUser({ email, email_confirm: true });
    let userId = created?.user?.id;
    if (cErr && !/registered|exists/i.test(cErr.message)) throw cErr;
    if (!userId) {
      // already existed — find them
      const { data: list } = await sb.auth.admin.listUsers();
      userId = list.users.find((u) => u.email === email)?.id;
    }
    if (!userId) throw new Error("could not resolve user id");

    // full_name is only written when one was actually supplied — re-inviting an
    // existing candidate with the name field empty must not clear their name.
    await sb.from("candidates").upsert({
      user_id: userId, email, ...(full_name ? { full_name } : {}),
      invited_by: user.id,
    }, { onConflict: "user_id" });

    // one row per (candidate, instrument). Re-inviting an existing assignment
    // re-points invited_by but leaves status/invited_at alone, so progress
    // already made on the instrument survives.
    const { error: aErr } = await sb.from("assignments").upsert({
      candidate_id: userId, instrument_id: instrument.id, invited_by: user.id,
    }, { onConflict: "candidate_id,instrument_id" });
    if (aErr) throw aErr;

    await sendMagicLink(email, full_name);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
