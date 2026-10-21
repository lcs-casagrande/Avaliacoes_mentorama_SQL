-- Gestão de usuários da única igreja. Não executado automaticamente.
-- Requer 001 aplicado. Executar como postgres, primeiro em homologação.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Executar como postgres após revisão.';
  end if;
  if to_regclass('public.iasdpi_access') is null
     or to_regclass('public.iasdpi_templates') is null
     or to_regclass('public.culto_archives') is null then
    raise exception 'Aplicar e conferir a migração 001 primeiro.';
  end if;
  if not exists(select 1 from pg_class c where c.oid='public.iasdpi_access'::regclass
      and c.relowner=(select oid from pg_roles where rolname='postgres')
      and c.relrowsecurity and not c.relforcerowsecurity) then
    raise exception 'Conferir proprietário e RLS de iasdpi_access antes de prosseguir.';
  end if;
end;
$$;

create schema iasdpi_admin_private authorization postgres;
revoke all on schema iasdpi_admin_private from public, anon, authenticated;

create table iasdpi_admin_private.control (
  singleton boolean primary key check (singleton),
  revision bigint not null default 0
);
insert into iasdpi_admin_private.control(singleton) values (true);

create table iasdpi_admin_private.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  accepted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create unique index iasdpi_one_pending_invite
  on iasdpi_admin_private.invitations(email)
  where consumed_at is null and revoked_at is null;

create table iasdpi_admin_private.audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table iasdpi_admin_private.control enable row level security;
alter table iasdpi_admin_private.invitations enable row level security;
alter table iasdpi_admin_private.audit enable row level security;
revoke all on all tables in schema iasdpi_admin_private from public, anon, authenticated;

-- Sem escrita direta em autorizações, inclusive por admin do aplicativo.
revoke insert, update, delete, truncate, references, trigger
  on public.iasdpi_access from public, anon, authenticated;
revoke insert(user_id,role,enabled,created_at),
       update(user_id,role,enabled,created_at),
       references(user_id,role,enabled,created_at)
  on public.iasdpi_access from public, anon, authenticated;

create function iasdpi_admin_private.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null
     or ((select auth.jwt())->>'is_anonymous') = 'true'
     or not exists (select 1 from public.iasdpi_access a
                    where a.user_id=v_actor and a.role='admin' and a.enabled) then
    raise exception 'Acesso administrativo necessário.' using errcode='42501';
  end if;
  return v_actor;
end;
$$;

create function iasdpi_admin_private.lock_admin()
returns uuid language plpgsql volatile security definer set search_path = '' as $$
begin
  perform iasdpi_admin_private.require_admin();
  -- Todas as mutações usam a mesma linha: serialização + nova versão MVCC.
  update iasdpi_admin_private.control set revision=revision+1 where singleton;
  return iasdpi_admin_private.require_admin();
end;
$$;

create function public.iasdpi_list_users(p_offset integer default 0)
returns table(user_id uuid,email text,role text,enabled boolean,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform iasdpi_admin_private.require_admin();
  if p_offset is null or p_offset<0 then
    raise exception 'Página inválida.' using errcode='22023';
  end if;
  return query select a.user_id,u.email::text,a.role,a.enabled,a.created_at
    from public.iasdpi_access a join auth.users u on u.id=a.user_id
    order by a.created_at,a.user_id limit 50 offset p_offset;
end;
$$;

-- Busca exata de uma conta, somente para admin. Não é diretório público do Auth.
create function public.iasdpi_find_account(p_email text)
returns table(user_id uuid,email text,confirmed boolean,authorized boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform iasdpi_admin_private.require_admin();
  if p_email is null or char_length(p_email)>254 then
    raise exception 'E-mail inválido.' using errcode='22023';
  end if;
  return query select u.id,u.email::text,u.email_confirmed_at is not null,
    exists(select 1 from public.iasdpi_access a where a.user_id=u.id)
    from auth.users u where lower(u.email)=lower(btrim(p_email))
    and coalesce(u.is_anonymous,false)=false limit 1;
end;
$$;

create function public.iasdpi_set_access(p_user_id uuid,p_role text,p_enabled boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid; v_old public.iasdpi_access%rowtype;
begin
  v_actor:=iasdpi_admin_private.lock_admin();
  if p_user_id is null or p_role is null or p_role not in ('admin','leader')
     or p_enabled is null then
    raise exception 'Autorização inválida.' using errcode='22023';
  end if;
  select * into v_old from public.iasdpi_access where user_id=p_user_id;
  if v_old.role='admin' and v_old.enabled
     and (p_role<>'admin' or not p_enabled)
     and not exists(select 1 from public.iasdpi_access a
       where a.role='admin' and a.enabled and a.user_id<>p_user_id) then
    raise exception 'Não é permitido remover ou rebaixar o último administrador.' using errcode='23514';
  end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id
      and (not p_enabled or (u.email_confirmed_at is not null
        and coalesce(u.is_anonymous,false)=false))) then
    raise exception 'A conta deve existir e ter e-mail confirmado.' using errcode='22023';
  end if;
  insert into public.iasdpi_access(user_id,role,enabled)
    values(p_user_id,p_role,p_enabled)
    on conflict(user_id) do update set role=excluded.role,enabled=excluded.enabled;
  if v_old.role='admin' and (p_role<>'admin' or not p_enabled) then
    update iasdpi_admin_private.invitations i set revoked_at=now()
      where i.created_by=p_user_id and i.revoked_at is null and i.consumed_at is null;
  end if;
  insert into iasdpi_admin_private.audit(actor_id,action,target_id,details)
    values(v_actor,'set_access',p_user_id,
      jsonb_build_object('previous',to_jsonb(v_old),'role',p_role,'enabled',p_enabled));
end;
$$;

create function public.iasdpi_create_invite(p_email text)
returns table(id uuid,email text,token text,expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid;v_email text;v_token text;v_id uuid;v_expires timestamptz;
begin
  v_actor:=iasdpi_admin_private.lock_admin();
  v_email:=lower(btrim(p_email));
  if v_email is null or char_length(v_email)>254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido.' using errcode='22023';
  end if;
  if exists(select 1 from auth.users u join public.iasdpi_access a on a.user_id=u.id
      where lower(u.email)=v_email) then
    raise exception 'Conta já cadastrada nas autorizações. Altere seu acesso na lista.' using errcode='22023';
  end if;
  update iasdpi_admin_private.invitations i set revoked_at=now()
    where i.email=v_email and i.consumed_at is null and i.revoked_at is null;
  -- Dois UUIDs v4: aproximadamente 244 bits de entropia; só o hash é persistido.
  v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  v_expires:=now()+interval '48 hours';
  insert into iasdpi_admin_private.invitations as i(email,token_hash,created_by,expires_at)
    values(v_email,encode(sha256(convert_to(v_token,'UTF8')),'hex'),v_actor,v_expires)
    returning i.id into v_id;
  insert into iasdpi_admin_private.audit(actor_id,action,target_id)
    values(v_actor,'create_invite',v_id);
  return query select v_id,v_email,v_token,v_expires;
end;
$$;

create function public.iasdpi_list_invites()
returns table(id uuid,email text,created_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform iasdpi_admin_private.require_admin();
  return query select i.id,i.email,i.created_at,i.expires_at
    from iasdpi_admin_private.invitations i
    where i.revoked_at is null and i.consumed_at is null and i.expires_at>now()
    order by i.created_at desc limit 100;
end;
$$;

create function public.iasdpi_revoke_invite(p_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_actor uuid;
begin
  v_actor:=iasdpi_admin_private.lock_admin();
  update iasdpi_admin_private.invitations i set revoked_at=now()
    where i.id=p_id and i.consumed_at is null and i.revoked_at is null;
  if not found then
    raise exception 'Convite indisponível.' using errcode='22023';
  end if;
  insert into iasdpi_admin_private.audit(actor_id,action,target_id)
    values(v_actor,'revoke_invite',p_id);
end;
$$;

-- Exceção deliberada: usuário ainda não autorizado pode aceitar um convite
-- que corresponda ao seu e-mail CONFIRMADO, nunca escolher seu papel.
create function public.iasdpi_accept_invite(p_token text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();v_email text;v_invite iasdpi_admin_private.invitations%rowtype;
begin
  select lower(u.email) into v_email from auth.users u where u.id=v_user
    and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false;
  if v_email is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Convite inválido ou indisponível.' using errcode='42501';
  end if;
  if not exists(select 1 from iasdpi_admin_private.invitations i
      where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
        and i.email=v_email and i.revoked_at is null and i.consumed_at is null
        and i.expires_at>clock_timestamp()) then
    raise exception 'Convite inválido ou indisponível.' using errcode='42501';
  end if;
  update iasdpi_admin_private.control set revision=revision+1 where singleton;
  select * into v_invite from iasdpi_admin_private.invitations i
    where i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
      and i.email=v_email and i.revoked_at is null and i.consumed_at is null
      and i.expires_at>clock_timestamp() for update;
  if not found or exists(select 1 from public.iasdpi_access a where a.user_id=v_user)
     or not exists(select 1 from public.iasdpi_access a
       where a.user_id=v_invite.created_by and a.role='admin' and a.enabled) then
    raise exception 'Convite inválido ou indisponível.' using errcode='42501';
  end if;
  insert into public.iasdpi_access(user_id,role,enabled) values(v_user,'leader',true);
  update iasdpi_admin_private.invitations set consumed_at=now(),accepted_by=v_user
    where id=v_invite.id;
  insert into iasdpi_admin_private.audit(actor_id,action,target_id,details)
    values(v_user,'accept_invite',v_user,jsonb_build_object('invite_id',v_invite.id));
end;
$$;

-- Objetos novos pertencem a postgres (verificação inicial). Não há SQL dinâmico.
-- Funções privadas não podem ser chamadas por anon/authenticated.
revoke all on all functions in schema iasdpi_admin_private from public,anon,authenticated;

-- Não revogar funções de outros módulos no schema public.
revoke all on function public.iasdpi_list_users(integer) from public,anon,authenticated;
revoke all on function public.iasdpi_find_account(text) from public,anon,authenticated;
revoke all on function public.iasdpi_set_access(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.iasdpi_create_invite(text) from public,anon,authenticated;
revoke all on function public.iasdpi_list_invites() from public,anon,authenticated;
revoke all on function public.iasdpi_revoke_invite(uuid) from public,anon,authenticated;
revoke all on function public.iasdpi_accept_invite(text) from public,anon,authenticated;
grant execute on function public.iasdpi_list_users(integer),public.iasdpi_find_account(text),
  public.iasdpi_set_access(uuid,text,boolean),public.iasdpi_create_invite(text),
  public.iasdpi_list_invites(),public.iasdpi_revoke_invite(uuid),
  public.iasdpi_accept_invite(text) to authenticated;
commit;
