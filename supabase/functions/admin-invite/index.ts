// POST { email, full_name? }  — admin only. Provisions candidate + sends link.
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

    const { email, full_name } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

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

    await sb.from("candidates").upsert({
      user_id: userId, email, full_name: full_name ?? null,
      invited_by: user.id,
    }, { onConflict: "user_id" });

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
