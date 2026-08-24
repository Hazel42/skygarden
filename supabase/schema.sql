create table if not exists public.garden_saves (
  user_id uuid primary key default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.garden_saves enable row level security;

drop policy if exists "own select" on public.garden_saves;
drop policy if exists "own insert" on public.garden_saves;
drop policy if exists "own update" on public.garden_saves;

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
