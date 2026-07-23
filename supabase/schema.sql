-- TrailBuilt schema: run once in Supabase SQL Editor
-- Dashboard → SQL → New query → paste → Run

create extension if not exists "pgcrypto";

create type public.user_role as enum ('user', 'crew', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

create table public.markers (
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

create index markers_created_at_idx on public.markers (created_at desc);
create index markers_completed_at_idx on public.markers (completed_at);

alter table public.profiles enable row level security;
alter table public.markers enable row level security;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_crew_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('crew', 'admin') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own display name"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Markers
create policy "Anyone can read markers"
  on public.markers for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can report markers"
  on public.markers for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Creators and crew can update markers"
  on public.markers for update
  to authenticated
  using (created_by = auth.uid() or public.is_crew_or_admin())
  with check (created_by = auth.uid() or public.is_crew_or_admin());

create policy "Creators and admins can delete markers"
  on public.markers for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_user_role() = 'admin'
  );

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

-- Trail open/closed status (readable by everyone; writable by admins)
create table public.trail_statuses (
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
  ('pbr:rated-r', 'open');

alter table public.trail_statuses enable row level security;

create policy "Anyone can read trail statuses"
  on public.trail_statuses for select
  to anon, authenticated
  using (true);

create policy "Admins can update trail statuses"
  on public.trail_statuses for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "Admins can insert trail statuses"
  on public.trail_statuses for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

-- Realtime for shared hazard feed + trail status
alter publication supabase_realtime add table public.markers;
alter publication supabase_realtime add table public.trail_statuses;
