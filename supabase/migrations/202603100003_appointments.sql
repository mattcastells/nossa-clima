-- Iteracion 3: agenda de turnos/trabajos

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  notes text,
  scheduled_for date not null,
  starts_at time,
  ends_at time,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  store_id uuid references public.stores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_appointment_integrity()
returns trigger
language plpgsql
as $$
declare
  store_ok boolean;
begin
  if new.user_id <> auth.uid() then
    raise exception 'user_id must match authenticated user';
  end if;

  if new.store_id is not null then
    select exists(
      select 1 from public.stores s
      where s.id = new.store_id and s.user_id = auth.uid()
    ) into store_ok;

    if not store_ok then
      raise exception 'Store invalid for current user';
    end if;
  end if;

  return new;
end;
$$;

create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger appointments_set_user_id before insert on public.appointments for each row execute function public.set_user_id_default();
create trigger validate_appointment_integrity_trigger
before insert or update on public.appointments
for each row execute function public.validate_appointment_integrity();

create index appointments_user_date_idx on public.appointments(user_id, scheduled_for, starts_at);

alter table public.appointments enable row level security;

create policy "appointments_select_own" on public.appointments for select using (user_id = auth.uid());
create policy "appointments_insert_own" on public.appointments for insert with check (user_id = auth.uid());
create policy "appointments_update_own" on public.appointments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "appointments_delete_own" on public.appointments for delete using (user_id = auth.uid());
