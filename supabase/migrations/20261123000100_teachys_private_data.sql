create table if not exists public.teachys_data (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (length(key) between 1 and 120),
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.teachys_data enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.teachys_data to authenticated;

drop policy if exists teachys_data_owner on public.teachys_data;
create policy teachys_data_owner
  on public.teachys_data for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'teachys_data'
  ) then
    alter publication supabase_realtime add table public.teachys_data;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teachys-files', 'teachys-files', false, 26214400, null)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = null;

drop policy if exists teachys_storage_owner on storage.objects;
create policy teachys_storage_owner
  on storage.objects for all to authenticated
  using (
    bucket_id = 'teachys-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'teachys-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
