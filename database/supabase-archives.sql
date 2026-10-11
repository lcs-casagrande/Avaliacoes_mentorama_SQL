-- Execute no SQL Editor de um projeto Supabase próprio.
-- Arquivo privado e imutável: nenhuma política permite alterar/apagar versões.
create table if not exists public.culto_archives (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'
    and payload->>'format' = 'IASDPI-backup'
    and jsonb_typeof(payload->'programs') = 'array'
    and octet_length(payload::text) <= 20971520),
  created_at timestamptz not null default now(),
  unique(owner_id, digest)
);
alter table public.culto_archives enable row level security;
revoke all on public.culto_archives from anon, authenticated;
grant select, insert on public.culto_archives to authenticated;
drop policy if exists archive_owner_read on public.culto_archives;
create policy archive_owner_read on public.culto_archives for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists archive_owner_insert on public.culto_archives;
create policy archive_owner_insert on public.culto_archives for insert to authenticated
  with check ((select auth.uid()) = owner_id);
