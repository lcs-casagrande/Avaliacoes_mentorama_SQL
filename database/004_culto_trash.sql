-- IASDPI 004: lixeira recuperável. Executar somente após revisão, como postgres.
-- Pré-requisitos: 001, 002 e 003. Não altera o conteúdo dos cultos existentes.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

do $$ begin
  if current_user<>'postgres' then raise exception 'Execute como postgres.'; end if;
  if to_regprocedure('public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean)') is null
     or to_regprocedure('iasdpi_admin_private.lock_admin()') is null then
    raise exception 'Aplique 001, 002 e 003 primeiro.';
  end if;
  if exists(select 1 from pg_policies where schemaname='public'
    and tablename in ('iasdpi_programs','iasdpi_activities','iasdpi_subactivities')
    and policyname<>'operational_read') then
    raise exception 'Políticas adicionais encontradas: revisar antes de continuar.';
  end if;
end $$;

alter table public.iasdpi_programs
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete restrict,
  add column deletion_reason text check(length(deletion_reason)<=2000),
  add constraint iasdpi_trash_state check(
    (deleted_at is null and deleted_by is null and deletion_reason is null)
    or (deleted_at is not null and deleted_by is not null));
create index iasdpi_active_programs on public.iasdpi_programs(id) where deleted_at is null;
create index iasdpi_trashed_programs on public.iasdpi_programs(deleted_at desc,id) where deleted_at is not null;

create table iasdpi_operational_private.trash_audit (
  program_id text not null references public.iasdpi_programs(id) on delete restrict,
  action text not null check(action in ('trash','restore')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  happened_at timestamptz not null default now(),
  reason text check(length(reason)<=2000),
  previous_deleted_at timestamptz,
  previous_deleted_by uuid references auth.users(id) on delete restrict,
  previous_reason text,
  from_version bigint not null,
  to_version bigint not null check(to_version=from_version+1),
  primary key(program_id,to_version)
);
alter table iasdpi_operational_private.trash_audit owner to postgres;
alter table iasdpi_operational_private.trash_audit enable row level security;
revoke all on iasdpi_operational_private.trash_audit from public,anon,authenticated;

-- Nem mesmo admin consulta a lixeira pelo REST comum: somente pelas RPCs admin.
drop policy operational_read on public.iasdpi_programs;
create policy operational_read on public.iasdpi_programs for select to authenticated using (
  deleted_at is null and coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
  and exists(select 1 from public.iasdpi_access a where a.user_id=auth.uid() and a.enabled and a.role in ('admin','leader')));
drop policy operational_read on public.iasdpi_activities;
create policy operational_read on public.iasdpi_activities for select to authenticated using (
  exists(select 1 from public.iasdpi_programs p where p.id=program_id and p.deleted_at is null));
drop policy operational_read on public.iasdpi_subactivities;
create policy operational_read on public.iasdpi_subactivities for select to authenticated using (
  exists(select 1 from public.iasdpi_programs p where p.id=program_id and p.deleted_at is null));
revoke all on public.iasdpi_programs,public.iasdpi_activities,public.iasdpi_subactivities from public,anon,authenticated;
grant select on public.iasdpi_programs,public.iasdpi_activities,public.iasdpi_subactivities to authenticated;

-- Preserva a implementação validada da 003; envolve-a com a proteção da lixeira.
-- O original sai do schema exposto e perde EXECUTE dos clientes.
alter function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean) set schema iasdpi_operational_private;
alter function iasdpi_operational_private.iasdpi_save_program(text,bigint,jsonb,uuid,boolean) rename to save_program_003;
alter function public.iasdpi_preview_import(jsonb) set schema iasdpi_operational_private;
alter function iasdpi_operational_private.iasdpi_preview_import(jsonb) rename to preview_import_003;

create function public.iasdpi_save_program(p_id text,p_expected_version bigint,p_document jsonb,p_request_id uuid,p_import boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform iasdpi_operational_private.require_access();
  update iasdpi_admin_private.control set revision=revision+1 where singleton;
  perform iasdpi_operational_private.require_access();
  if exists(select 1 from public.iasdpi_programs p where p.deleted_at is not null
    and (p.id=p_id or (p_import and p.import_digest=iasdpi_operational_private.fingerprint(p_document)))) then
    raise exception 'Registro indisponível para gravação. Solicite ao administrador que confira a lixeira.' using errcode='42501';
  end if;
  return iasdpi_operational_private.save_program_003(p_id,p_expected_version,p_document,p_request_id,p_import);
end $$;

create function public.iasdpi_preview_import(p_documents jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rows jsonb; row jsonb; result jsonb:='[]';
begin
  rows:=iasdpi_operational_private.preview_import_003(p_documents);
  for row in select value from jsonb_array_elements(rows) loop
    if exists(select 1 from public.iasdpi_programs p where p.id=row->>'remote_id' and p.deleted_at is not null) then
      row:=(row-'remote_id'-'remote_version')||jsonb_build_object('status','unavailable');
    end if;
    result:=result||jsonb_build_array(row);
  end loop;
  return result;
end $$;

create function iasdpi_operational_private.change_trash(
  p_id text,p_expected_version bigint,p_delete boolean,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; old public.iasdpi_programs; updated public.iasdpi_programs;
  receipt iasdpi_operational_private.receipts; signature text; response jsonb;
begin
  actor:=iasdpi_admin_private.lock_admin();
  if p_id is null or length(p_id) not between 1 and 200 or p_expected_version is null
     or p_expected_version<1 or p_delete is null or p_request_id is null
     or coalesce(length(p_reason),0)>2000 then
    raise exception 'Requisição inválida.' using errcode='22023';
  end if;
  signature:=iasdpi_operational_private.fingerprint(jsonb_build_object(
    'operation',case when p_delete then 'trash' else 'restore' end,'program_id',p_id,
    'expected',p_expected_version,'reason',p_reason));
  select * into receipt from iasdpi_operational_private.receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id<>actor or receipt.signature<>signature then
      raise exception 'Requisição reutilizada com conteúdo diferente.' using errcode='22023';
    end if;
    return receipt.response;
  end if;
  select * into old from public.iasdpi_programs where id=p_id for update;
  if not found then raise exception 'Registro não encontrado.' using errcode='P0002'; end if;
  if old.version<>p_expected_version or (old.deleted_at is not null)=p_delete then
    raise exception 'Registro alterado em outro dispositivo. Atualize a lista antes de continuar.' using errcode='40001';
  end if;
  insert into iasdpi_operational_private.revisions values('program',p_id,old.version,old.document,actor,now());
  update public.iasdpi_programs set version=version+1,
    document=jsonb_set(document,'{version}',to_jsonb(version+1)),
    updated_by=actor,updated_at=now(),
    deleted_at=case when p_delete then now() end,
    deleted_by=case when p_delete then actor end,
    deletion_reason=case when p_delete then nullif(trim(p_reason),'') end
    where id=p_id returning * into updated;
  -- Não reprojetar nem validar horários aqui: a lixeira deve preservar até importações inconsistentes.
  insert into iasdpi_operational_private.trash_audit values(
    p_id,case when p_delete then 'trash' else 'restore' end,actor,now(),
    case when p_delete then nullif(trim(p_reason),'') end,
    old.deleted_at,old.deleted_by,old.deletion_reason,old.version,updated.version);
  response:=jsonb_build_object('status',case when p_delete then 'trashed' else 'restored' end,
    'document',updated.document,'deleted_at',updated.deleted_at,'deleted_by',updated.deleted_by,'deletion_reason',updated.deletion_reason);
  insert into iasdpi_operational_private.receipts values(p_request_id,actor,signature,response,now());
  return response;
end $$;

create function public.iasdpi_trash_program(p_id text,p_expected_version bigint,p_request_id uuid,p_reason text default null)
returns jsonb language sql security definer set search_path='' as $$
  select iasdpi_operational_private.change_trash(p_id,p_expected_version,true,p_reason,p_request_id);
$$;
create function public.iasdpi_restore_program(p_id text,p_expected_version bigint,p_request_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select iasdpi_operational_private.change_trash(p_id,p_expected_version,false,null,p_request_id);
$$;
create function public.iasdpi_list_trash(p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform iasdpi_admin_private.require_admin();
  if p_offset is null or p_offset<0 then raise exception 'Página inválida.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.deleted_at desc,t.id) from (
    select p.id,p.version,p.document,p.deleted_at,p.deleted_by,p.deletion_reason,u.email as deleted_by_email
    from public.iasdpi_programs p left join auth.users u on u.id=p.deleted_by
    where p.deleted_at is not null order by p.deleted_at desc,p.id limit 100 offset p_offset
  ) t),'[]'::jsonb);
end $$;
create function public.iasdpi_trash_detail(p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform iasdpi_admin_private.require_admin();
  select jsonb_build_object('id',p.id,'version',p.version,'document',p.document,
    'deleted_at',p.deleted_at,'deleted_by',p.deleted_by,'deleted_by_email',u.email,'deletion_reason',p.deletion_reason,
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.to_version) from iasdpi_operational_private.trash_audit a where a.program_id=p.id),'[]'::jsonb))
    into result from public.iasdpi_programs p left join auth.users u on u.id=p.deleted_by
    where p.id=p_id and p.deleted_at is not null;
  if result is null then raise exception 'Registro não encontrado na lixeira.' using errcode='P0002'; end if;
  return result;
end $$;

-- Proprietários e ACLs explícitos: helpers não são chamáveis pelo navegador.
alter function iasdpi_operational_private.save_program_003(text,bigint,jsonb,uuid,boolean) owner to postgres;
alter function iasdpi_operational_private.preview_import_003(jsonb) owner to postgres;
alter function iasdpi_operational_private.change_trash(text,bigint,boolean,text,uuid) owner to postgres;
alter function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean) owner to postgres;
alter function public.iasdpi_preview_import(jsonb) owner to postgres;
alter function public.iasdpi_trash_program(text,bigint,uuid,text) owner to postgres;
alter function public.iasdpi_restore_program(text,bigint,uuid) owner to postgres;
alter function public.iasdpi_list_trash(integer) owner to postgres;
alter function public.iasdpi_trash_detail(text) owner to postgres;
revoke all on schema iasdpi_operational_private from public,anon,authenticated;
revoke all on all functions in schema iasdpi_operational_private from public,anon,authenticated;
revoke all on function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean),public.iasdpi_preview_import(jsonb),
  public.iasdpi_trash_program(text,bigint,uuid,text),public.iasdpi_restore_program(text,bigint,uuid),
  public.iasdpi_list_trash(integer),public.iasdpi_trash_detail(text) from public,anon,authenticated;
grant execute on function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean),public.iasdpi_preview_import(jsonb),
  public.iasdpi_trash_program(text,bigint,uuid,text),public.iasdpi_restore_program(text,bigint,uuid),
  public.iasdpi_list_trash(integer),public.iasdpi_trash_detail(text) to authenticated;
notify pgrst,'reload schema';
commit;
