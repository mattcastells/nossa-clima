-- Iteracion 9: estados operativos del trabajo + limpieza de cancelados vencidos

alter table public.quotes
add column if not exists cancelled_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'quote_status'
  ) and not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'quote_status_legacy'
  ) then
    alter type public.quote_status rename to quote_status_legacy;
  end if;
end $$;

do $$
begin
  create type public.quote_status as enum ('pending', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

alter table public.quotes
  alter column status drop default;

alter table public.quotes
  alter column status type public.quote_status
  using (
    case status::text
      when 'approved' then 'completed'
      when 'rejected' then 'cancelled'
      when 'completed' then 'completed'
      when 'cancelled' then 'cancelled'
      else 'pending'
    end
  )::public.quote_status;

alter table public.quotes
  alter column status set default 'pending';

update public.quotes
set cancelled_at = coalesce(cancelled_at, updated_at, created_at, now())
where status = 'cancelled'
  and cancelled_at is null;

drop type if exists public.quote_status_legacy;

create index if not exists quotes_cancel_cleanup_idx
  on public.quotes(user_id, status, cancelled_at);

create or replace function public.purge_expired_cancelled_quotes(
  target_user_id uuid default auth.uid(),
  retention interval default interval '3 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_ids uuid[];
  deleted_count integer := 0;
begin
  if target_user_id is null then
    return 0;
  end if;

  select coalesce(array_agg(q.id), array[]::uuid[])
  into target_ids
  from public.quotes q
  where q.user_id = target_user_id
    and q.status = 'cancelled'
    and q.cancelled_at is not null
    and q.cancelled_at <= now() - retention;

  if array_length(target_ids, 1) is null then
    return 0;
  end if;

  delete from public.appointments
  where quote_id = any(target_ids);

  delete from public.quotes
  where id = any(target_ids);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.purge_expired_cancelled_quotes(uuid, interval) to authenticated;
