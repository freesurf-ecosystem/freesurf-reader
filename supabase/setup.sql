-- FreeSurf Reader — Supabase tables
-- Cloud sync for saved recordings (optional sign-in)

create table if not exists public.reader_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  voice text not null,
  speed real not null default 1.0,
  text_preview text,
  audio_url text,
  created_at timestamptz not null default now()
);

alter table public.reader_history enable row level security;

drop policy if exists "users manage own reader history" on public.reader_history;
create policy "users manage own reader history"
  on public.reader_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
