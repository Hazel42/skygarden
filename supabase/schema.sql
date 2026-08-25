create table if not exists public.garden_saves (
  user_id uuid primary key default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.garden_saves enable row level security;

drop policy if exists "own select" on public.garden_saves;
drop policy if exists "own insert" on public.garden_saves;
drop policy if exists "own update" on public.garden_saves;
drop policy if exists "own delete" on public.garden_saves;

create policy "own select"
  on public.garden_saves for select
  to anon, authenticated
  using (auth.uid() = user_id);

create policy "own insert"
  on public.garden_saves for insert
  to anon, authenticated
  with check (auth.uid() = user_id);

create policy "own update"
  on public.garden_saves for update
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own delete"
  on public.garden_saves for delete
  to anon, authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- PROFILES â€” one row per auth user, auto-created by trigger
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_length check (char_length(username) >= 3)
);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;

create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "Users can update own profile."
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'gardener_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'display_name', 'Gardener')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- keep updated_at fresh on profile edits
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

-- ============================================================
-- Leaderboard (tambahan) — aman dijalankan berulang kali
-- ============================================================
alter table public.profiles add column if not exists garden_level int not null default 1;
alter table public.profiles add column if not exists best_stage int not null default 1;
alter table public.profiles add column if not exists total_placed int not null default 0;

create or replace view public.leaderboard as
  select id, display_name, garden_level, best_stage, total_placed, updated_at
  from public.profiles
  where coalesce(display_name, '') <> ''
  order by best_stage desc, garden_level desc, total_placed desc
  limit 50;
grant select on public.leaderboard to anon, authenticated;
