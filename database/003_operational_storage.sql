-- IASDPI: banco operacional de uma única igreja. Requer 001 e 002.
-- Executar somente após revisão e homologação. Nunca recria tabelas existentes.
begin;
do $$ begin
  if current_user <> 'postgres' or to_regclass('iasdpi_admin_private.control') is null then
    raise exception 'Executar como postgres; conferir 001 e 002 aplicadas.';
  end if;
end $$;

create schema iasdpi_operational_private authorization postgres;
revoke all on schema iasdpi_operational_private from public, anon, authenticated;

create function iasdpi_operational_private.require_access() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or coalesce(auth.jwt()->>'is_anonymous','false')='true'
     or not exists(select 1 from public.iasdpi_access where user_id=actor and enabled and role in ('admin','leader')) then
    raise exception 'Acesso autorizado necessário.' using errcode='42501';
  end if;
  return actor;
end $$;

create table public.iasdpi_programs (
  id text primary key check(length(id) between 1 and 200),
  version bigint not null check(version>0),
  document jsonb not null check(jsonb_typeof(document)='object' and document->>'id'=id
    and (document->>'version')::bigint=version and octet_length(document::text)<=2097152),
  import_digest text unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index iasdpi_program_date on public.iasdpi_programs ((document->'plan'->>'date'),id);
create table public.iasdpi_activities (
  program_id text not null references public.iasdpi_programs(id) on delete restrict,
  id text not null check(length(id) between 1 and 200),
  position integer not null check(position>=0),
  kind text not null check(kind in ('planned','extra')),
  title text not null check(length(trim(title)) between 1 and 200),
  planned_start time, planned_end time,
  actual_start timestamptz, actual_end timestamptz,
  responsible text not null default '' check(length(responsible)<=200),
  note text not null default '' check(length(note)<=2000),
  primary key(program_id,id), unique(program_id,position),
  check((kind='extra' and planned_start is null and planned_end is null)
     or (kind='planned' and planned_start is not null and planned_end>planned_start)),
  check(actual_start is null or actual_end is null or actual_end>=actual_start)
);
create table public.iasdpi_subactivities (
  program_id text not null,
  parent_id text not null,
  id text not null check(length(id) between 1 and 200),
  position integer not null check(position>=0),
  title text not null check(length(trim(title)) between 1 and 200),
  actual_start time, actual_end time,
  responsible text not null default '' check(length(responsible)<=200),
  note text not null default '' check(length(note)<=2000),
  primary key(program_id,parent_id,id), unique(program_id,parent_id,position),
  foreign key(program_id,parent_id) references public.iasdpi_activities(program_id,id) on delete restrict,
  check(actual_start is null or actual_end is null or actual_end>=actual_start)
);
-- Revisões operacionais automáticas: não dependem de culto_archives/navegador.
create table iasdpi_operational_private.revisions (
  resource text not null check(resource in ('program','template')),
  id text not null, version bigint not null, document jsonb not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  captured_at timestamptz not null default now(),
  primary key(resource,id,version)
);
create table iasdpi_operational_private.receipts (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  signature text not null, response jsonb not null,
  created_at timestamptz not null default now()
);
alter table iasdpi_operational_private.revisions enable row level security;
alter table iasdpi_operational_private.receipts enable row level security;
revoke all on all tables in schema iasdpi_operational_private from public,anon,authenticated;

-- Acesso de leitura compartilhado; nenhuma escrita direta, mesmo por admin.
alter table public.iasdpi_programs owner to postgres;
alter table public.iasdpi_activities owner to postgres;
alter table public.iasdpi_subactivities owner to postgres;
alter table public.iasdpi_programs enable row level security;
alter table public.iasdpi_activities enable row level security;
alter table public.iasdpi_subactivities enable row level security;
revoke all on public.iasdpi_programs,public.iasdpi_activities,public.iasdpi_subactivities from public,anon,authenticated;
grant select on public.iasdpi_programs,public.iasdpi_activities,public.iasdpi_subactivities to authenticated;
create policy operational_read on public.iasdpi_programs for select to authenticated using (
  coalesce(auth.jwt()->>'is_anonymous','false')<>'true' and exists(select 1 from public.iasdpi_access a where a.user_id=auth.uid() and a.enabled and a.role in ('admin','leader')));
create policy operational_read on public.iasdpi_activities for select to authenticated using (
  coalesce(auth.jwt()->>'is_anonymous','false')<>'true' and exists(select 1 from public.iasdpi_access a where a.user_id=auth.uid() and a.enabled and a.role in ('admin','leader')));
create policy operational_read on public.iasdpi_subactivities for select to authenticated using (
  coalesce(auth.jwt()->>'is_anonymous','false')<>'true' and exists(select 1 from public.iasdpi_access a where a.user_id=auth.uid() and a.enabled and a.role in ('admin','leader')));

-- Projeção relacional, validada dentro da mesma transação do documento completo.
create function iasdpi_operational_private.project_program(p jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare item jsonb; detail jsonb; execution jsonb; child jsonb;
  day date; identifier text:=p->>'id'; subposition integer;
  a timestamptz; b timestamptz; x time; y time; item_id text; kind text;
  previous_end time; plan_start time; plan_end time; parallel_start time;
  ordered_ids text[]; extra jsonb; extra_position integer; extra_positions integer[]:='{}';
begin
  if jsonb_typeof(p->'plan') is distinct from 'object'
     or jsonb_typeof(p->'plan'->'items') is distinct from 'array'
     or jsonb_typeof(p->'executions') is distinct from 'object'
     or jsonb_typeof(coalesce(p->'actual_details','{}'))<>'object'
     or jsonb_typeof(coalesce(p->'extra_events','[]'))<>'array'
     or coalesce(p->>'execution_mode','') not in ('manual','live')
     or coalesce(p->>'status','') not in ('Planejamento','Pronta','Em andamento','Finalizada')
     or coalesce(length(trim(p->'plan'->>'name')),0) not between 1 and 200
     or coalesce(length(p->>'note'),0)>5000 or coalesce(length(p->>'incident'),0)>5000
     or coalesce(length(p->>'record_info'),0)>5000 then
    raise exception 'Registro inválido.' using errcode='22023';
  end if;
  day:=(p->'plan'->>'date')::date;
  if day is null or to_char(day,'YYYY-MM-DD')<>p->'plan'->>'date' then raise exception 'Data inválida.'; end if;
  if jsonb_array_length(p->'plan'->'items')+jsonb_array_length(coalesce(p->'extra_events','[]'))>100 then raise exception 'Limite de 100 atividades.'; end if;
  if jsonb_array_length(p->'plan'->'items')=0 then
    if p->'plan'->>'template_id' is distinct from 'free' or p->>'status'='Finalizada' then raise exception 'Programação vazia inválida.'; end if;
  else
    if coalesce(p->'plan'->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(p->'plan'->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horários previstos inválidos.'; end if;
    plan_start:=(p->'plan'->>'start')::time; plan_end:=(p->'plan'->>'end')::time;
    if plan_end<=plan_start then raise exception 'Intervalo previsto inválido.'; end if;
    previous_end:=plan_start;
  end if;
  -- Não aceitar execuções órfãs nem ocultar dados desconhecidos em projeções.
  if exists(select 1 from jsonb_object_keys(p->'executions') k where not exists(
    select 1 from jsonb_array_elements(p->'plan'->'items') i where i->>'id'=k)) then raise exception 'Execução sem atividade.'; end if;
  ordered_ids:=array(select value->>'id' from jsonb_array_elements(p->'plan'->'items'));
  for extra in select value from jsonb_array_elements(coalesce(p->'extra_events','[]')) order by (value->>'position')::integer loop
    if coalesce(extra->>'position','')!~'^[0-9]+$' then raise exception 'Posição extra inválida.'; end if;
    extra_position:=(extra->>'position')::integer;
    if extra_position>=jsonb_array_length(p->'plan'->'items')+jsonb_array_length(p->'extra_events') or extra_position=any(extra_positions) then raise exception 'Posição extra inválida.'; end if;
    extra_positions:=array_append(extra_positions,extra_position);
    ordered_ids:=coalesce(ordered_ids[1:extra_position],'{}')||array[extra->>'id']||coalesce(ordered_ids[extra_position+1:array_length(ordered_ids,1)],'{}');
  end loop;
  delete from public.iasdpi_subactivities where program_id=identifier;
  delete from public.iasdpi_activities where program_id=identifier;
  -- O tipo vem da origem; a posição intercalada não decide se é previsto/extra.
  for item, kind in
    select source.value,source.source_kind from (
      select value,'planned'::text as source_kind,0 as source_order,ordinality
      from jsonb_array_elements(p->'plan'->'items') with ordinality
      union all
      select value,'extra'::text as source_kind,1 as source_order,ordinality
      from jsonb_array_elements(coalesce(p->'extra_events','[]')) with ordinality
    ) source order by source.source_order,source.ordinality
  loop
    item_id:=item->>'id';
    if item_id is null or item_id='' then raise exception 'ID de atividade obrigatório.'; end if;
    detail:=case when kind='extra' then item else coalesce(p->'actual_details'->item_id,'{}') end;
    execution:=coalesce(p->'executions'->item_id,'{}');
    if kind='planned' then
      if coalesce(item->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(item->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horários previstos inválidos.'; end if;
      x:=(item->>'start')::time;y:=(item->>'end')::time;
      if x<plan_start or y>plan_end or y<=x or (x<previous_end and not coalesce(coalesce((item->>'parallel')::boolean,false) and x=parallel_start and y=previous_end,false)) then raise exception 'Sequência prevista inválida.'; end if;
      parallel_start:=case when coalesce((item->>'parallel')::boolean,false) then x else null end;previous_end:=y;
      a:=nullif(execution->>'started','')::timestamptz;b:=nullif(execution->>'ended','')::timestamptz;
      if a is null and nullif(detail->>'partial_end','') is not null then b:=(day+(detail->>'partial_end')::time) at time zone 'America/Sao_Paulo'; end if;
    else
      x:=null;y:=null;
      a:=case when nullif(item->>'start','') is not null then (day+(item->>'start')::time) at time zone 'America/Sao_Paulo' end;
      b:=case when nullif(item->>'end','') is not null then (day+(item->>'end')::time) at time zone 'America/Sao_Paulo' end;
    end if;
    if (a is not null and (a at time zone 'America/Sao_Paulo')::date<>day)
       or (b is not null and (b at time zone 'America/Sao_Paulo')::date<>day) then raise exception 'Horário real em outra data.'; end if;
    insert into public.iasdpi_activities values(identifier,item_id,array_position(ordered_ids,item_id)-1,kind,item->>'activity',x,y,a,b,coalesce(detail->>'responsible',item->>'responsible',''),coalesce(detail->>'note',''));
    if jsonb_typeof(coalesce(detail->'subactivities','[]'))<>'array' or jsonb_array_length(coalesce(detail->'subactivities','[]'))>50 then raise exception 'Subatividades inválidas.'; end if;
    subposition:=0;
    for child in select value from jsonb_array_elements(coalesce(detail->'subactivities','[]')) loop
      if child->>'parent_id' is distinct from item_id then raise exception 'Vínculo de subatividade inválido.'; end if;
      x:=nullif(child->>'start','')::time;y:=nullif(child->>'end','')::time;
      if (x is not null or y is not null) and (a is null or b is null) then raise exception 'Intervalo principal incompleto.'; end if;
      if (x is not null and (x<(a at time zone 'America/Sao_Paulo')::time or x>(b at time zone 'America/Sao_Paulo')::time))
       or (y is not null and (y<(a at time zone 'America/Sao_Paulo')::time or y>(b at time zone 'America/Sao_Paulo')::time)) then raise exception 'Subatividade fora do intervalo principal.'; end if;
      insert into public.iasdpi_subactivities values(identifier,item_id,child->>'id',subposition,child->>'title',x,y,coalesce(child->>'responsible',''),coalesce(child->>'note',''));
      subposition:=subposition+1;
    end loop;
  end loop;
end $$;

create function iasdpi_operational_private.fingerprint(p jsonb) returns text
language sql immutable set search_path='' as $$
  select encode(sha256(convert_to((p-'id'-'version'-'import_source_version')::text,'UTF8')),'hex');
$$;

create function public.iasdpi_save_program(p_id text,p_expected_version bigint,p_document jsonb,p_request_id uuid,p_import boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; old public.iasdpi_programs; receipt iasdpi_operational_private.receipts;
  doc jsonb; signature text; fingerprint text; response jsonb;
begin
  actor:=iasdpi_operational_private.require_access();
  -- Mesmo bloqueio das RPCs 002: revogação e gravação não ultrapassam uma à outra.
  update iasdpi_admin_private.control set revision=revision+1 where singleton;
  actor:=iasdpi_operational_private.require_access();
  if p_id is null or length(p_id) not between 1 and 200 or p_request_id is null or p_expected_version is null
    or p_expected_version<0 or p_import is null or p_document->>'id' is distinct from p_id
    or jsonb_typeof(p_document) is distinct from 'object' or octet_length(p_document::text)>2097152 then raise exception 'Requisição inválida.' using errcode='22023'; end if;
  signature:=iasdpi_operational_private.fingerprint(jsonb_build_object('id',p_id,'expected',p_expected_version,'data',p_document,'import',p_import));
  select * into receipt from iasdpi_operational_private.receipts where request_id=p_request_id;
  if found then
    if receipt.actor_id<>actor or receipt.signature<>signature then raise exception 'Requisição reutilizada com conteúdo diferente.' using errcode='22023'; end if;
    return receipt.response;
  end if;
  select * into old from public.iasdpi_programs where id=p_id for update;
  fingerprint:=iasdpi_operational_private.fingerprint(p_document);
  if p_import then
    if p_expected_version<>0 then raise exception 'Importação não atualiza registros.'; end if;
    if old.id is not null then
      if iasdpi_operational_private.fingerprint(old.document)=fingerprint then return jsonb_build_object('status','exists','document',old.document); end if;
      raise exception 'Conflito de importação: registro existente preservado.' using errcode='40001';
    end if;
    select * into old from public.iasdpi_programs where import_digest=fingerprint;
    if found then return jsonb_build_object('status','duplicate','document',old.document); end if;
  end if;
  if (old.id is null and p_expected_version<>0) or (old.id is not null and old.version<>p_expected_version) then
    raise exception 'Registro alterado em outro dispositivo. Suas alterações não foram gravadas; compare antes de tentar novamente.' using errcode='40001';
  end if;
  doc:=coalesce(old.document,'{}'::jsonb)||p_document||jsonb_build_object('version',p_expected_version+1);
  if p_import then doc:=doc||jsonb_build_object('import_source_version',p_document->'version'); end if;
  if old.id is null then
    insert into public.iasdpi_programs(id,version,document,import_digest,created_by,updated_by)
      values(p_id,1,doc,case when p_import then fingerprint end,actor,actor);
  else
    insert into iasdpi_operational_private.revisions values('program',p_id,old.version,old.document,actor,now());
    update public.iasdpi_programs set version=version+1,document=doc,updated_by=actor,updated_at=now() where id=p_id;
  end if;
  perform iasdpi_operational_private.project_program(doc);
  response:=jsonb_build_object('status',case when p_import then 'imported' else 'saved' end,'document',doc);
  insert into iasdpi_operational_private.receipts values(p_request_id,actor,signature,response,now());
  return response;
end $$;

create function public.iasdpi_preview_import(p_documents jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p jsonb; existing public.iasdpi_programs; result jsonb:='[]'; fp text; label text;
begin
  perform iasdpi_operational_private.require_access();
  if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents)>500 or octet_length(p_documents::text)>20971520 then raise exception 'Importação inválida.'; end if;
  for p in select value from jsonb_array_elements(p_documents) loop
    fp:=iasdpi_operational_private.fingerprint(p);
    select * into existing from public.iasdpi_programs where id=p->>'id';
    if found then label:=case when iasdpi_operational_private.fingerprint(existing.document)=fp then 'exists' else 'conflict' end;
    else
      select * into existing from public.iasdpi_programs where import_digest=fp;
      label:=case when found then 'duplicate' else 'new' end;
    end if;
    result:=result||jsonb_build_array(jsonb_build_object('id',p->>'id','name',p->'plan'->>'name','date',p->'plan'->>'date','status',label,'remote_id',existing.id,'remote_version',existing.version));
  end loop;
  return result;
end $$;

-- Estende os modelos existentes, sem substituir seu conteúdo ou a autorização.
alter table public.iasdpi_templates add column version bigint not null default 1 check(version>0),
  add column display_name text not null default '' check(length(display_name)<=200),
  add column updated_by uuid references auth.users(id) on delete restrict,
  add column updated_at timestamptz not null default now();
-- ALTER TABLE mantém bloqueio até COMMIT: a origem não muda entre cópia/conferência.
do $$
declare source_plan jsonb; copied_plan jsonb;
begin
  select plan into source_plan from public.iasdpi_templates where id='culto-03102026';
  if not found or jsonb_typeof(source_plan->'items') is distinct from 'array' then
    raise exception 'Modelo de origem culto-03102026 ausente ou inválido.';
  end if;
  if jsonb_array_length(source_plan->'items')<>16 then
    raise exception 'O modelo original deve conter exatamente 16 atividades; revisar antes de aplicar 003.';
  end if;
  insert into public.iasdpi_templates(id,plan,display_name)
    values('liturgy-i',source_plan-'date','Liturgia I — Padrão')
    on conflict(id) do nothing;
  select plan into copied_plan from public.iasdpi_templates where id='liturgy-i';
  -- Comparação JSONB preserva conteúdo, IDs e ordem dos 16 itens, sem recriá-los.
  if copied_plan is distinct from (source_plan-'date') then
    raise exception 'Liturgia I diverge da origem; nenhum modelo existente será sobrescrito.';
  end if;
end $$;
insert into public.iasdpi_templates(id,plan,display_name) values('free','{"name":"Culto livre","start":"","end":"","items":[],"team":{},"template_id":"free","execution_mode":"manual"}','Livre — Sem atividades') on conflict(id) do nothing;

create function public.iasdpi_save_template(p_id text,p_expected_version bigint,p_name text,p_plan jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; old public.iasdpi_templates; candidate jsonb; item jsonb; ids text[]:='{}';
  previous_end time; boundary time; a time; b time; parallel_start time;
begin
  actor:=iasdpi_admin_private.lock_admin();
  if p_id is null or p_id!~'^[a-z0-9_-]{1,100}$' or coalesce(length(trim(p_name)),0) not between 1 and 200
    or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_plan) is distinct from 'object'
    or octet_length(p_plan::text)>2097152 then raise exception 'Modelo inválido.'; end if;
  select * into old from public.iasdpi_templates where id=p_id for update;
  if (old.id is null and p_expected_version<>0) or (old.id is not null and old.version<>p_expected_version) then raise exception 'Modelo alterado; atualize.' using errcode='40001'; end if;
  -- Validar o cronograma antes de substituir um modelo compartilhado.
  if jsonb_typeof(p_plan->'items') is distinct from 'array' or jsonb_array_length(p_plan->'items')>100
    or (p_id<>'free' and jsonb_array_length(p_plan->'items')=0) then raise exception 'Atividades do modelo inválidas.'; end if;
  if jsonb_array_length(p_plan->'items')>0 then
    if coalesce(p_plan->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_plan->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horários do modelo inválidos.'; end if;
    previous_end:=(p_plan->>'start')::time;boundary:=(p_plan->>'end')::time;
    for item in select value from jsonb_array_elements(p_plan->'items') loop
      if coalesce(length(trim(item->>'activity')),0) not between 1 and 200
        or coalesce(length(item->>'id'),0) not between 1 and 200 or (item->>'id')=any(ids)
        or coalesce(item->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(item->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Atividade do modelo inválida.'; end if;
      a:=(item->>'start')::time;b:=(item->>'end')::time;
      if b<=a or b>boundary or a<(p_plan->>'start')::time or (a<previous_end and not coalesce(coalesce((item->>'parallel')::boolean,false) and a=parallel_start and b=previous_end,false)) then raise exception 'Sequência do modelo inválida.'; end if;
      ids:=array_append(ids,item->>'id');previous_end:=b;parallel_start:=case when coalesce((item->>'parallel')::boolean,false) then a else null end;
    end loop;
  end if;
  p_plan:=(p_plan-'date'-'planned_start'-'planned_end')||jsonb_build_object('items',
    (select coalesce(jsonb_agg(value-'planned_start'-'planned_end'),'[]') from jsonb_array_elements(p_plan->'items')));
  if p_id='free' and (jsonb_array_length(p_plan->'items')<>0 or coalesce(p_plan->>'start','')<>'' or coalesce(p_plan->>'end','')<>'') then raise exception 'Livre deve permanecer sem atividades ou horários previstos.'; end if;
  if old.id is not null then insert into iasdpi_operational_private.revisions values('template',p_id,old.version,to_jsonb(old),actor,now()); end if;
  insert into public.iasdpi_templates(id,plan,display_name,version,updated_by)
    values(p_id,p_plan-'date',trim(p_name),1,actor)
    on conflict(id) do update set plan=excluded.plan,display_name=excluded.display_name,version=iasdpi_templates.version+1,updated_by=actor,updated_at=now();
  select to_jsonb(t) into candidate from public.iasdpi_templates t where id=p_id;
  return candidate;
end $$;

-- Fixar explicitamente proprietários e privilégios. Funções privadas não são RPCs.
alter function iasdpi_operational_private.require_access() owner to postgres;
alter function iasdpi_operational_private.project_program(jsonb) owner to postgres;
alter function iasdpi_operational_private.fingerprint(jsonb) owner to postgres;
alter function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean) owner to postgres;
alter function public.iasdpi_preview_import(jsonb) owner to postgres;
alter function public.iasdpi_save_template(text,bigint,text,jsonb) owner to postgres;
revoke all on all functions in schema iasdpi_operational_private from public,anon,authenticated;
revoke all on function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean),public.iasdpi_preview_import(jsonb),public.iasdpi_save_template(text,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.iasdpi_save_program(text,bigint,jsonb,uuid,boolean),public.iasdpi_preview_import(jsonb),public.iasdpi_save_template(text,bigint,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
