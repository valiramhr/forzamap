// POST { user_id, scope, assignment_id? }  — admin only.
// Permanent deletion. There is no archive flag and no soft delete: what this
// removes is gone, and the cascades take the rest with it.
//   scope "assignment" — deletes one assignments row; its assessments cascade.
//   scope "candidate"  — deletes the auth user; candidates, assignments and
//                        assessments all cascade from auth.users.
// Deploy with --no-verify-jwt (see supabase/config.toml); the caller's JWT is
// checked here, so the admin test can't be skipped by an unauthenticated call.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { admin, cors } from "../_shared.ts";

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

    const { user_id, scope, assignment_id } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);
    if (scope !== "assignment" && scope !== "candidate") {
      return json({ error: `scope must be "assignment" or "candidate", got: ${scope}` }, 400);
    }

    // Two accounts this must never touch: your own, and any other admin's.
    // Both would be irreversible in a way no UI confirmation covers.
    if (user_id === user.id) {
      return json({ error: "you cannot delete your own account from here" }, 400);
    }
    const { data: targetIsAdmin } = await sb
      .from("admins").select("user_id").eq("user_id", user_id).maybeSingle();
    if (targetIsAdmin) {
      return json({ error: "that account is an administrator — remove it from the admins table before deleting it" }, 400);
    }

    if (scope === "assignment") {
      if (!assignment_id) return json({ error: 'assignment_id required for scope "assignment"' }, 400);

      // An assignment id alone would be enough to delete by, but checking it
      // against the candidate catches a stale row in a UI that has moved on.
      const { data: asg, error: fErr } = await sb
        .from("assignments").select("id,candidate_id").eq("id", assignment_id).maybeSingle();
      if (fErr) throw fErr;
      if (!asg) return json({ error: `no such assignment: ${assignment_id}` }, 400);
      if (asg.candidate_id !== user_id) {
        return json({ error: "that assignment belongs to a different candidate" }, 400);
      }

      // counted before the delete — afterwards there is nothing left to count
      const { count, error: cErr } = await sb
        .from("assessments").select("id", { count: "exact", head: true })
        .eq("assignment_id", assignment_id);
      if (cErr) throw cErr;

      const { error: dErr } = await sb.from("assignments").delete().eq("id", assignment_id);
      if (dErr) throw dErr;

      return json({ ok: true, deleted: { assignments: 1, assessments: count ?? 0 } });
    }

    // scope "candidate"
    const [{ data: asgs, error: aErr }, { count, error: cErr }] = await Promise.all([
      sb.from("assignments").select("id").eq("candidate_id", user_id),
      sb.from("assessments").select("id", { count: "exact", head: true }).eq("candidate_id", user_id),
    ]);
    if (aErr) throw aErr;
    if (cErr) throw cErr;

    const { error: dErr } = await sb.auth.admin.deleteUser(user_id);
    if (dErr) throw dErr;

    return json({
      ok: true,
      deleted: { assignments: asgs?.length ?? 0, assessments: count ?? 0 },
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
