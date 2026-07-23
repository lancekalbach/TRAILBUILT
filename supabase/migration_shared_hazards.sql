-- Ensure hazards / markers / crew assignments persist for all users.
-- Paste into Supabase SQL Editor and Run.

create table if not exists public.markers (
  id uuid primary key default gen_random_uuid(),
  lng double precision not null,
  lat double precision not null,
  kind text not null
    check (kind in (
      'hazard',
      'downed-tree',
      'puddle',
      'clogged-culvert',
      'washout',
      'maintenance'
    )),
  note text,
  track_id text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  participant_ids uuid[] not null default '{}',
  completed_at timestamptz
);

create index if not exists markers_created_at_idx on public.markers (created_at desc);
create index if not exists markers_completed_at_idx on public.markers (completed_at);

alter table public.markers enable row level security;

-- Public read so every visitor / account sees the same hazards + crew assignments
drop policy if exists "Authenticated users can read markers" on public.markers;
drop policy if exists "Anyone can read markers" on public.markers;
create policy "Anyone can read markers"
  on public.markers for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can report markers" on public.markers;
create policy "Authenticated users can report markers"
  on public.markers for insert
  to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Creators and crew can update markers" on public.markers;
create policy "Creators and crew can update markers"
  on public.markers for update
  to authenticated
  using (created_by = auth.uid() or public.is_crew_or_admin())
  with check (created_by = auth.uid() or public.is_crew_or_admin());

drop policy if exists "Creators and admins can delete markers" on public.markers;
create policy "Creators and admins can delete markers"
  on public.markers for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_user_role() = 'admin'
  );

-- Atomic crew join (avoids lost updates when two crew accept at once)
create or replace function public.accept_marker_task(marker_id uuid)
returns public.markers
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.markers;
begin
  if auth.uid() is null or not public.is_crew_or_admin() then
    raise exception 'Only crew or admin can accept tasks';
  end if;

  update public.markers
  set participant_ids = case
    when auth.uid() = any (participant_ids) then participant_ids
    else array_append(participant_ids, auth.uid())
  end
  where id = marker_id
    and completed_at is null
  returning * into result;

  if result.id is null then
    raise exception 'Marker not found or already completed';
  end if;

  return result;
end;
$$;

create or replace function public.complete_marker_task(marker_id uuid)
returns public.markers
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.markers;
begin
  if auth.uid() is null or not public.is_crew_or_admin() then
    raise exception 'Only crew or admin can complete tasks';
  end if;

  update public.markers
  set completed_at = coalesce(completed_at, now())
  where id = marker_id
    and auth.uid() = any (participant_ids)
  returning * into result;

  if result.id is null then
    raise exception 'Join the task before marking it completed';
  end if;

  return result;
end;
$$;

grant execute on function public.accept_marker_task(uuid) to authenticated;
grant execute on function public.complete_marker_task(uuid) to authenticated;

-- Realtime sync across browsers / users
do $$
begin
  alter publication supabase_realtime add table public.markers;
exception
  when duplicate_object then null;
end $$;
