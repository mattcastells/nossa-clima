-- Add push_tokens table and scheduled_notification_id column on appointments

alter table if exists public.appointments
  add column if not exists scheduled_notification_id text;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_token text,
  device_token jsonb,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create policy "push_tokens_insert_own" on public.push_tokens for insert with check (user_id = auth.uid());
create policy "push_tokens_select_own" on public.push_tokens for select using (user_id = auth.uid());
create policy "push_tokens_update_own" on public.push_tokens for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_tokens_delete_own" on public.push_tokens for delete using (user_id = auth.uid());

-- index to lookup by expo token quickly
create index if not exists push_tokens_expo_token_idx on public.push_tokens(expo_token);
