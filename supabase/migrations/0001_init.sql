-- Strengths Profile — schema, RLS, and status triggers
-- Invite-only: auth users are provisioned by edge functions (service role).
-- No self-signup. Also disable "Allow new users to sign up" in Auth settings.

create extension if not exists pgcrypto;

-- ── tables ─────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  status       text not null default 'invited'
                 check (status in ('invited','in_progress','completed')),
  invited_by   uuid references auth.users(id),
  invited_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.assessments (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(user_id) on delete cascade,
  status       text not null default 'in_progress'
                 check (status in ('in_progress','submitted')),
  items        jsonb not null,
  answers      jsonb not null default '{}'::jsonb,
  result       jsonb,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists assessments_candidate_idx on public.assessments(candidate_id);

-- ── helper: is the caller an admin? ────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ── status triggers (security definer: bypass RLS to touch candidates) ──
create or replace function public.on_assessment_start()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.candidates set status = 'in_progress'
   where user_id = new.candidate_id and status = 'invited';
  return new;
end $$;

create or replace function public.on_assessment_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    new.submitted_at := now();
    update public.candidates set status = 'completed', completed_at = now()
     where user_id = new.candidate_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_assessment_start on public.assessments;
create trigger trg_assessment_start after insert on public.assessments
  for each row execute function public.on_assessment_start();

drop trigger if exists trg_assessment_submit on public.assessments;
create trigger trg_assessment_submit before update on public.assessments
  for each row execute function public.on_assessment_submit();

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.admins      enable row level security;
alter table public.candidates  enable row level security;
alter table public.assessments enable row level security;

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select using (public.is_admin());

drop policy if exists cand_self_select on public.candidates;
create policy cand_self_select on public.candidates
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists cand_admin_manage on public.candidates;
create policy cand_admin_manage on public.candidates
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists asmt_select on public.assessments;
create policy asmt_select on public.assessments
  for select using (candidate_id = auth.uid() or public.is_admin());

drop policy if exists asmt_insert on public.assessments;
create policy asmt_insert on public.assessments
  for insert with check (candidate_id = auth.uid() and status = 'in_progress');

drop policy if exists asmt_update on public.assessments;
create policy asmt_update on public.assessments
  for update using (candidate_id = auth.uid() and status = 'in_progress')
              with check (candidate_id = auth.uid());
