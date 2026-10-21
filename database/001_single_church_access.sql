-- Tarefa 1: uma única igreja. REVISAR antes de executar no Supabase.
-- Nenhuma execução automática. Sem grants administrativos pelo frontend.
begin;

-- Deve ser criada pelo operador confiável no SQL Editor.
create table public.iasdpi_access (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('admin', 'leader')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.iasdpi_access owner to postgres;
alter table public.iasdpi_access enable row level security;
revoke all on public.iasdpi_access from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.iasdpi_access to authenticated;
create policy iasdpi_access_read_self on public.iasdpi_access
for select to authenticated using (
  user_id = (select auth.uid())
  and ((select auth.jwt())->>'is_anonymous') is distinct from 'true'
);
-- Não há INSERT/UPDATE/DELETE para authenticated, nem mesmo role='admin'.
-- Cadastro ou promoção só por operador confiável, fora do aplicativo.

create table public.iasdpi_templates (
  id text primary key,
  plan jsonb not null check (jsonb_typeof(plan) = 'object')
);
alter table public.iasdpi_templates owner to postgres;
alter table public.iasdpi_templates enable row level security;
revoke all on public.iasdpi_templates from public, anon, authenticated;
grant select on public.iasdpi_templates to authenticated;
create policy iasdpi_templates_authorized_read on public.iasdpi_templates
for select to authenticated using (
  exists (select 1 from public.iasdpi_access a
    where a.user_id = (select auth.uid()) and a.enabled
      and a.role in ('admin', 'leader'))
);

-- Compatível com a tabela de arquivos anterior; preserva dados e unicidade
-- por autor/digest. Não cria ainda o modelo multi-igreja.
create table if not exists public.culto_archives (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (coalesce(
    jsonb_typeof(payload) = 'object'
    and payload->>'format' = 'IASDPI-backup'
    and payload->'version' = '1'::jsonb
    and jsonb_typeof(payload->'programs') = 'array', false)
    and octet_length(payload::text) <= 20971520),
  created_at timestamptz not null default now(),
  unique (owner_id, digest)
);

-- Não aceitar silenciosamente outras políticas permissivas.
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public'
    and tablename='culto_archives'
    and policyname not in ('archive_owner_read','archive_owner_insert')) then
    raise exception 'Existem políticas de arquivo não reconhecidas. Revisão manual obrigatória.';
  end if;
end;
$$;
alter table public.culto_archives enable row level security;
revoke all on public.culto_archives from public, anon, authenticated;
-- Revogar também eventuais grants individuais de coluna anteriores.
revoke select (id,owner_id,digest,payload,created_at),
       insert (id,owner_id,digest,payload,created_at),
       update (id,owner_id,digest,payload,created_at),
       references (id,owner_id,digest,payload,created_at)
  on public.culto_archives from public, anon, authenticated;
grant select on public.culto_archives to authenticated;
grant insert (digest,payload) on public.culto_archives to authenticated;
drop policy if exists archive_owner_read on public.culto_archives;
drop policy if exists archive_owner_insert on public.culto_archives;
create policy archive_authorized_read on public.culto_archives
for select to authenticated using (
  exists (select 1 from public.iasdpi_access a
    where a.user_id = (select auth.uid()) and a.enabled
      and a.role in ('admin','leader'))
);
create policy archive_authorized_insert on public.culto_archives
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and exists (select 1 from public.iasdpi_access a
    where a.user_id = (select auth.uid()) and a.enabled
      and a.role in ('admin','leader'))
);
-- Sem UPDATE ou DELETE dos arquivos, inclusive para admin.

insert into public.iasdpi_templates (id,plan)
values ('culto-03102026', '{"name": "Culto de sábado", "date": "2026-10-03", "start": "09:30", "end": "11:24", "execution_mode": "manual", "team": {"Ancião do mês": "Adriano", "Recepção": "Nilce", "Diácono": "Rafael Braga", "Diaconisa": "Rose", "Diretor de culto": "Elmo", "Sonoplastia": "", "Equipe de louvor": "", "Responsável pela programação": "Elmo"}, "items": [{"id": "culto-03102026-1", "block": "Culto", "start": "09:30", "end": "09:35", "activity": "Música Congregacional (sentados)", "responsible": "Ministério de Louvor", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-2", "block": "Culto", "start": "09:35", "end": "09:40", "activity": "Música Congregacional (sentados)", "responsible": "Ministério de Louvor", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-3", "block": "Culto", "start": "09:40", "end": "09:45", "activity": "Música Congregacional (em pé)", "responsible": "Ministério de Louvor", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-4", "block": "Culto", "start": "09:45", "end": "09:50", "activity": "Oração Intercessora (de joelhos)", "responsible": "Núbia", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-5", "block": "Culto", "start": "09:50", "end": "10:00", "activity": "Adoração Infantil", "responsible": "Pr. Carlos", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-6", "block": "Culto", "start": "10:00", "end": "10:05", "activity": "Anúncios/Comunicação", "responsible": "Henrique", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-7", "block": "Culto", "start": "10:05", "end": "10:10", "activity": "Provai e Vede (vídeo)", "responsible": "Ministério da Mordomia", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-9", "block": "Culto", "start": "10:10", "end": "10:15", "activity": "Ofertório", "responsible": "Alçar Ofertas", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-10", "block": "Culto", "start": "10:15", "end": "10:17", "activity": "Oração pelas Ofertas", "responsible": "", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-11", "block": "Culto", "start": "10:17", "end": "10:22", "activity": "Mensagem Musical", "responsible": "Priscilla", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-12", "block": "Culto", "start": "10:22", "end": "11:05", "activity": "Sermão", "responsible": "Gabriel Henrique", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-13", "block": "Culto", "start": "11:05", "end": "11:10", "activity": "Mensagem Musical", "responsible": "Priscilla", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-14", "block": "Culto", "start": "11:10", "end": "11:15", "activity": "Apelo e Oração Final", "responsible": "Gabriel Henrique", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-15", "block": "Culto", "start": "11:15", "end": "11:20", "activity": "Música Congregacional (em pé)", "responsible": "Ministério de Louvor", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-16", "block": "Culto", "start": "11:20", "end": "11:22", "activity": "Orientações sobre a Classe", "responsible": "Ministério de Louvor e/ou Ancianato", "note": "", "parallel": false, "end_inferred": false}, {"id": "culto-03102026-17", "block": "Culto", "start": "11:22", "end": "11:24", "activity": "Vídeo para a saída das pessoas", "responsible": "Sonoplastia", "note": "", "parallel": false, "end_inferred": false}]}'::jsonb);
commit;

-- Bootstrap MANUAL, somente após conferir a identidade e e-mail confirmado:
-- insert into public.iasdpi_access (user_id,role)
-- values ('UUID_DA_CONTA_CONFIRMADA', 'admin');
-- Conta cadastrada no Auth, por si só, não ganha acesso.
-- Não criar triggers de autoaprovação nem ler role de user_metadata.
