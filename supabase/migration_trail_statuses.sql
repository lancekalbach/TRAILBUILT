-- Run in Supabase SQL Editor if you already applied schema.sql once.
-- Adds editable trail open/closed status (admin-only writes).

create table if not exists public.trail_statuses (
  id text primary key,
  status text not null
    check (status in ('open', 'partial', 'closed')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.trail_statuses (id, status) values
  ('pbr:first-rodeo', 'open'),
  ('pbr:bar-dog', 'open'),
  ('pbr:darlin', 'open'),
  ('pbr:snot-rocket', 'open'),
  ('pbr:ramblin-man', 'open'),
  ('pbr:turn-n-burn', 'open'),
  ('pbr:b90', 'open'),
  ('pbr:hellbent', 'open'),
  ('pbr:rank-ride', 'open'),
  ('pbr:rated-r', 'open')
on conflict (id) do nothing;

alter table public.trail_statuses enable row level security;

drop policy if exists "Anyone can read trail statuses" on public.trail_statuses;
create policy "Anyone can read trail statuses"
  on public.trail_statuses for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update trail statuses" on public.trail_statuses;
create policy "Admins can update trail statuses"
  on public.trail_statuses for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert trail statuses" on public.trail_statuses;
create policy "Admins can insert trail statuses"
  on public.trail_statuses for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

alter publication supabase_realtime add table public.trail_statuses;
