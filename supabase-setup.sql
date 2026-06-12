-- ============================================================
-- TypeRace 67 — Supabase setup
-- Paste this entire script into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ---------- TABLES ----------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique not null check (char_length(username) between 2 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  username    text not null,
  time_ms     integer not null check (time_ms > 0),
  sentence_id integer not null check (sentence_id between 0 and 9),
  played_at   timestamptz not null default now()
);

create index if not exists scores_time_idx on public.scores (time_ms asc);
create index if not exists scores_user_idx on public.scores (user_id, time_ms asc);

-- ---------- ROW LEVEL SECURITY ----------

alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

-- profiles: anyone can read; only the owner can insert/update their own row
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- scores: anyone can read (leaderboard); authenticated users insert only their own
create policy "scores_select_all"
  on public.scores for select
  using (true);

create policy "scores_insert_own"
  on public.scores for insert to authenticated
  with check (auth.uid() = user_id);

-- ---------- BEST-SCORE-PER-PLAYER VIEW (for global rank) ----------

create or replace view public.best_scores
with (security_invoker = true) as
select distinct on (user_id)
  user_id, username, time_ms, sentence_id, played_at
from public.scores
order by user_id, time_ms asc;

-- ---------- REALTIME ----------
-- Broadcast inserts on scores so the leaderboard updates live for everyone.

alter publication supabase_realtime add table public.scores;

-- ============================================================
-- Done. Also check Dashboard → Database → Replication and make sure
-- "scores" appears under the supabase_realtime publication.
-- ============================================================
