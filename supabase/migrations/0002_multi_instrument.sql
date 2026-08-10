-- 0002_multi_instrument.sql
--
-- Prepares the schema for more than one instrument (e.g. a Harrison-style
-- assessment alongside the Strengths Profile).
--
-- Core change: "status / invited_at / completed_at" describe a CANDIDATE'S
-- RELATIONSHIP TO ONE INSTRUMENT, not the candidate. They move from
-- public.candidates onto a new public.assignments table, one row per
-- (candidate, instrument) pair.
--
-- This migration is NON-DESTRUCTIVE and BACKWARD-COMPATIBLE:
--   * candidates.status / .completed_at are retained and kept in sync by a
--     trigger, so the currently deployed app keeps working unchanged.
--   * all existing rows are backfilled as 'strengths-profile'.
-- Drop the deprecated columns in a later migration, once the app reads
-- exclusively from assignments.

begin;

-- ── 1. instruments (reference data) ────────────────────────────────────
create table if not exists public.instruments (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.instruments (slug, name, description, sort_order)
values (
  'strengths-profile',
  'Strengths Profile',
  'Forced-choice ipsative strengths instrument. 12 themes across 4 domains, 102 paired items.',
  10
)
on conflict (slug) do nothing;

-- ── 2. assignments (candidate × instrument) ────────────────────────────
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(user_id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  status        text not null default 'invited'
                  check (status in ('invited','in_progress','completed')),
  invited_by    uuid references auth.users(id),
  invited_at    timestamptz not null default now(),
  completed_at  timestamptz,
  -- one live assignment per instrument per candidate. Relax this (and add an
  -- attempt number) if you ever allow retakes.
  unique (candidate_id, instrument_id)
);

create index if not exists assignments_candidate_idx  on public.assignments(candidate_id);
create index if not exists assignments_instrument_idx on public.assignments(instrument_id);
create index if not exists assignments_status_idx     on public.assignments(status);

-- ── 3. backfill assignments from existing candidates ───────────────────
insert into public.assignments
  (candidate_id, instrument_id, status, invited_by, invited_at, completed_at)
select c.user_id, i.id, c.status, c.invited_by, c.invited_at, c.completed_at
from public.candidates c
cross join public.instruments i
where i.slug = 'strengths-profile'
on conflict (candidate_id, instrument_id) do nothing;

-- ── 4. link assessments to assignments ─────────────────────────────────
alter table public.assessments
  add column if not exists assignment_id uuid references public.assignments(id) on delete cascade;

-- unambiguous while only one instrument exists
update public.assessments a
   set assignment_id = asg.id
  from public.assignments asg
 where asg.candidate_id = a.candidate_id
   and a.assignment_id is null;

-- guard: refuse to proceed if anything failed to map
do $$
declare orphans int;
begin
  select count(*) into orphans from public.assessments where assignment_id is null;
  if orphans > 0 then
    raise exception 'Cannot proceed: % assessment row(s) have no assignment', orphans;
  end if;
end $$;

alter table public.assessments alter column assignment_id set not null;

create index if not exists assessments_assignment_idx on public.assessments(assignment_id);

-- ── 5. triggers now drive assignments, not candidates ──────────────────
create or replace function public.on_assessment_start()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.assignments
     set status = 'in_progress'
   where id = new.assignment_id and status = 'invited';
  return new;
end $$;

create or replace function public.on_assessment_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := now();
    update public.assignments
       set status = 'completed', completed_at = now()
     where id = new.assignment_id;
  end if;
  return new;
end $$;

-- ── 6. keep the deprecated candidates columns in sync ──────────────────
-- Best-effort rollup so the currently deployed UI keeps working:
-- in_progress wins over completed, completed over invited.
create or replace function public.sync_candidate_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  cid := coalesce(new.candidate_id, old.candidate_id);
  update public.candidates c set
    status = coalesce((
      select case
        when bool_or(a.status = 'in_progress') then 'in_progress'
        when bool_or(a.status = 'completed')   then 'completed'
        else 'invited'
      end
      from public.assignments a where a.candidate_id = cid
    ), 'invited'),
    completed_at = (
      select max(a.completed_at) from public.assignments a where a.candidate_id = cid
    )
  where c.user_id = cid;
  return null;
end $$;

drop trigger if exists trg_sync_candidate_status on public.assignments;
create trigger trg_sync_candidate_status
  after insert or update or delete on public.assignments
  for each row execute function public.sync_candidate_status();

-- ── 7. RLS ─────────────────────────────────────────────────────────────
alter table public.instruments enable row level security;
alter table public.assignments enable row level security;

-- instruments: any signed-in user may read the catalogue; admins manage it
drop policy if exists instruments_select on public.instruments;
create policy instruments_select on public.instruments
  for select using (auth.uid() is not null);

drop policy if exists instruments_admin on public.instruments;
create policy instruments_admin on public.instruments
  for all using (public.is_admin()) with check (public.is_admin());

-- assignments: candidate sees only their own; admins see and manage all
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (candidate_id = auth.uid() or public.is_admin());

drop policy if exists assignments_admin on public.assignments;
create policy assignments_admin on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- assessments: insert must reference an assignment the caller actually owns
drop policy if exists asmt_insert on public.assessments;
create policy asmt_insert on public.assessments
  for insert with check (
    candidate_id = auth.uid()
    and status = 'in_progress'
    and exists (
      select 1 from public.assignments a
       where a.id = assignment_id and a.candidate_id = auth.uid()
    )
  );

-- ── 8. grants (only needed if "auto-expose new tables" is off) ──────────
grant select on public.instruments to authenticated;
grant select on public.assignments to authenticated;
grant all    on public.instruments, public.assignments to service_role;

commit;
