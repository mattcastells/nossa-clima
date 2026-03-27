create table public.pdf_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger pdf_files_set_updated_at
before update on public.pdf_files
for each row execute function public.set_updated_at();

create trigger pdf_files_set_user_id
before insert on public.pdf_files
for each row execute function public.set_user_id_default();

create index pdf_files_user_created_idx
  on public.pdf_files(user_id, created_at desc);

alter table public.pdf_files enable row level security;

drop policy if exists "pdf_files_select_own" on public.pdf_files;
drop policy if exists "pdf_files_insert_own" on public.pdf_files;
drop policy if exists "pdf_files_update_own" on public.pdf_files;
drop policy if exists "pdf_files_delete_own" on public.pdf_files;

create policy "pdf_files_select_own"
on public.pdf_files
for select
using (user_id = auth.uid());

create policy "pdf_files_insert_own"
on public.pdf_files
for insert
with check (user_id = auth.uid());

create policy "pdf_files_update_own"
on public.pdf_files
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "pdf_files_delete_own"
on public.pdf_files
for delete
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-pdfs',
  'user-pdfs',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user_pdfs_select_own" on storage.objects;
drop policy if exists "user_pdfs_insert_own" on storage.objects;
drop policy if exists "user_pdfs_delete_own" on storage.objects;

create policy "user_pdfs_select_own"
on storage.objects
for select
using (
  bucket_id = 'user-pdfs'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "user_pdfs_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'user-pdfs'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "user_pdfs_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'user-pdfs'
  and auth.uid() is not null
  and split_part(name, '/', 1) = auth.uid()::text
);
