-- 0004_invite_tokens.sql
--
-- Durable per-assignment invite tokens, replacing the emailed magic link as the
-- thing a candidate is given.
--
-- Why: corporate mail scanners pre-fetch every URL in an incoming message. A
-- Supabase magic link is single-use, so the scanner consumes it before the
-- recipient ever clicks, and the human is handed a dead link. A token carries no
-- session of its own — it is an opaque, durable name for one assignment. The
-- landing page trades it for a magic link that is minted and consumed inside the
-- same second, which no scanner is around for.
--
-- The token is a bearer credential for that candidate's assessment: anyone
-- holding it can sit the instrument as them. It is unguessable (32 random bytes)
-- and can be rotated from the admin table, which is what "Reset link" does.
--
-- No RLS change. The token is read by the redeem-invite edge function under the
-- service role, which bypasses RLS entirely; the existing assignments policies
-- already let an admin read and rotate it, and let a candidate see only their
-- own row.

begin;

-- ── 1. columns ─────────────────────────────────────────────────────────
-- The default covers any row created outside the invite function (a manual
-- insert, a future backfill) — an assignment with no token has no link that can
-- be handed out, and nothing else would notice until someone tried to use one.
alter table public.assignments
  add column if not exists invite_token text
    default encode(gen_random_bytes(32), 'hex'),
  add column if not exists invite_token_created_at timestamptz
    default now();

-- ── 2. backfill ────────────────────────────────────────────────────────
-- Existing rows predate the default, so they are filled in explicitly. One
-- token per row: gen_random_bytes is volatile, so the update evaluates it per
-- row rather than once for the statement.
update public.assignments
   set invite_token = encode(gen_random_bytes(32), 'hex'),
       invite_token_created_at = coalesce(invite_token_created_at, invited_at, now())
 where invite_token is null;

-- ── 3. uniqueness and lookup ───────────────────────────────────────────
-- One index does both jobs: the token has to be unique (it names exactly one
-- assignment), and redemption looks an assignment up by it on every arrival.
-- A separate non-unique index on the same column would only duplicate this one.
create unique index if not exists assignments_invite_token_key
  on public.assignments (invite_token);

comment on column public.assignments.invite_token is
  'Opaque durable invite token, 32 random bytes hex. Exchanged for a fresh magic link by the redeem-invite edge function. Bearer credential — rotate it (and the timestamp) to kill a shared link.';
comment on column public.assignments.invite_token_created_at is
  'When the current token was minted. Reset by a rotation, not by a re-invite.';

commit;
