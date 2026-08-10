-- 0003_paradox_instrument.sql
--
-- Registers the Paradox Profile in the instrument catalogue introduced by
-- 0002. Reference data only — no schema change, and no assignments are
-- created here. Candidates are put onto the instrument through the normal
-- invite flow, which upserts an assignments row per (candidate, instrument).

insert into public.instruments (slug, name, description, sort_order)
values (
  'paradox-profile',
  'Paradox Profile',
  'Original instrument for internal talent discussion. 12 paradoxes, 24 traits, 120 items on a 10-point Likert scale.',
  20
)
on conflict (slug) do nothing;
