-- Preparação multi-igreja. REVISAR; nunca executar automaticamente.
-- Base obrigatória: 001–004. Se houver Escalas, exige 005–010 completas.
-- PostgreSQL >= 15. Executar como postgres em janela de manutenção.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::integer<150000
 OR to_regprocedure('public.iasdpi_trash_program(text,bigint,uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'Exige postgres, PostgreSQL 15+ e migrações 001–004.';
 END IF;
 IF to_regclass('public.iasdpi_churches') IS NOT NULL THEN
  RAISE EXCEPTION '011 já instalada ou cadastro de igrejas preexistente: revisar; nada sobrescrito.';
 END IF;
 IF to_regclass('public.schedule_departments') IS NOT NULL AND
 to_regprocedure('public.iasdpi_schedule_daily_role(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Escalas parcialmente instaladas: concluir e revisar 005–010 antes da 011.';
 END IF;
END $$;

CREATE TABLE public.iasdpi_churches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 active boolean NOT NULL DEFAULT false,
 listed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.iasdpi_churches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.iasdpi_churches FROM public,anon,authenticated;
INSERT INTO public.iasdpi_churches(id,code,name,active,listed)
 VALUES('1a5d0000-0000-4000-8000-000000000001','IASD_PI','IASD Parada Inglesa',true,true);

-- Metadados públicos autorizados pelo operador; não enumera membros/contas.
CREATE FUNCTION public.iasdpi_list_churches() RETURNS TABLE(id uuid,code text,name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,c.code,c.name FROM public.iasdpi_churches c WHERE c.active AND c.listed ORDER BY c.name,c.code;
$$;
CREATE FUNCTION public.iasdpi_current_church_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_code text; result uuid;
BEGIN
 BEGIN v_code:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-iasdpi-church';
 EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Contexto de igreja inválido.' USING errcode='42501'; END;
 -- Compatibilidade com o frontend anterior, somente para a igreja original.
 v_code:=coalesce(v_code,'IASD_PI');
 SELECT c.id INTO result FROM public.iasdpi_churches c WHERE c.code=v_code AND c.active AND c.listed;
 IF result IS NULL THEN RAISE EXCEPTION 'Igreja inativa ou não autorizada.' USING errcode='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.iasdpi_list_churches(),public.iasdpi_current_church_id() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_list_churches(),public.iasdpi_current_church_id() TO anon,authenticated;

-- Funções existentes deixam de ignorar RLS. Sem LOGIN, sem BYPASSRLS,
-- sem permissão de criar objetos e sem associação de clientes a este papel.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_church_executor') THEN
  CREATE ROLE iasdpi_church_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_church_executor'
   AND (rolcanlogin OR rolinherit OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='iasdpi_church_executor'::regrole AND member<>'postgres'::regrole)
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='iasdpi_church_executor'::regrole) THEN
  RAISE EXCEPTION 'Papel executor preexistente inseguro; revisar manualmente.';
 END IF;
END $$;
GRANT iasdpi_church_executor TO postgres;
GRANT USAGE ON SCHEMA public,auth,iasdpi_admin_private,iasdpi_operational_private TO iasdpi_church_executor;
GRANT CREATE ON SCHEMA public,iasdpi_admin_private,iasdpi_operational_private TO iasdpi_church_executor;
-- Ponte interna mínima para identidades globais. Não depende da RLS gerenciada
-- de auth.users; nenhuma senha/token/metadado é projetado ou acessível ao cliente.
CREATE VIEW iasdpi_admin_private.auth_accounts WITH(security_barrier=true) AS
 SELECT id,email,email_confirmed_at,is_anonymous FROM auth.users;
REVOKE ALL ON iasdpi_admin_private.auth_accounts FROM public,anon,authenticated;
GRANT SELECT ON iasdpi_admin_private.auth_accounts TO iasdpi_church_executor;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt(),public.iasdpi_current_church_id() TO iasdpi_church_executor;


CREATE TEMP TABLE iasdpi_011_tables(schema_name text,table_name text,rows_before bigint,digest_before text,PRIMARY KEY(schema_name,table_name)) ON COMMIT DROP;
INSERT INTO iasdpi_011_tables(schema_name,table_name)
SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND (n.nspname IN ('iasdpi_admin_private','iasdpi_operational_private','iasdpi_schedule_private')
 OR (n.nspname='public' AND (c.relname IN ('iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities') OR c.relname LIKE 'schedule\_%' ESCAPE '\')));
-- Falha fechada: uma tabela adicional desconhecida requer revisão prévia.
DO $$ DECLARE t record; count_before bigint; checksum text; BEGIN
 IF EXISTS(SELECT 1 FROM iasdpi_011_tables WHERE table_name NOT IN (
 'control','invitations','audit','revisions','receipts','trash_audit','person_details','audit_logs',
 'iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities',
 'schedule_departments','schedule_people','schedule_memberships','schedule_roles','schedule_qualifications','schedule_availability','schedule_department_access',
 'schedule_events','schedule_plans','schedule_requirements','schedule_assignments','schedule_versions','schedule_settings','schedule_day_exceptions','schedule_legacy_commitments')) THEN
 RAISE EXCEPTION 'Tabela não reconhecida: revisar inventário antes da 011.'; END IF;
 FOR t IN SELECT * FROM iasdpi_011_tables ORDER BY schema_name,table_name LOOP
  IF (SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=t.schema_name AND c.relname=t.table_name) IS DISTINCT FROM 'postgres'::regrole::oid THEN RAISE EXCEPTION 'Proprietário inesperado em %.%.',t.schema_name,t.table_name; END IF;
  EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',t.schema_name,t.table_name);
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(x)::text),%L ORDER BY md5(to_jsonb(x)::text)),%L)) FROM %I.%I x','','',t.schema_name,t.table_name) INTO count_before,checksum;
  UPDATE iasdpi_011_tables SET rows_before=count_before,digest_before=checksum WHERE schema_name=t.schema_name AND table_name=t.table_name;
  EXECUTE format('ALTER TABLE %I.%I ADD COLUMN church_id uuid NOT NULL DEFAULT %L REFERENCES public.iasdpi_churches(id)',t.schema_name,t.table_name,'1a5d0000-0000-4000-8000-000000000001');
  EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN church_id SET DEFAULT public.iasdpi_current_church_id()',t.schema_name,t.table_name);
  EXECUTE format('CREATE INDEX %I ON %I.%I(church_id)','church_scope_'||substr(md5(t.schema_name||'.'||t.table_name),1,16),t.schema_name,t.table_name);
 END LOOP;
END $$;

-- Chaves lógicas compartilháveis por igrejas; UUIDs e IDs históricos não mudam.
ALTER TABLE public.iasdpi_access DROP CONSTRAINT iasdpi_access_pkey, ADD PRIMARY KEY(church_id,user_id);
ALTER TABLE public.iasdpi_templates DROP CONSTRAINT iasdpi_templates_pkey, ADD PRIMARY KEY(church_id,id);
ALTER TABLE iasdpi_admin_private.control DROP CONSTRAINT control_pkey, ADD PRIMARY KEY(church_id,singleton);
ALTER TABLE iasdpi_operational_private.revisions DROP CONSTRAINT revisions_pkey, ADD PRIMARY KEY(church_id,resource,id,version);
ALTER TABLE iasdpi_operational_private.receipts DROP CONSTRAINT receipts_pkey, ADD PRIMARY KEY(church_id,request_id);
ALTER TABLE public.iasdpi_programs DROP CONSTRAINT iasdpi_programs_import_digest_key, ADD UNIQUE(church_id,import_digest);
ALTER TABLE public.culto_archives DROP CONSTRAINT culto_archives_owner_id_digest_key, ADD UNIQUE(church_id,owner_id,digest);
DROP INDEX iasdpi_admin_private.iasdpi_one_pending_invite;
CREATE UNIQUE INDEX iasdpi_one_pending_invite ON iasdpi_admin_private.invitations(church_id,email) WHERE consumed_at IS NULL AND revoked_at IS NULL;
DO $$ BEGIN
 IF to_regclass('public.schedule_departments') IS NOT NULL THEN
  ALTER TABLE public.schedule_departments DROP CONSTRAINT schedule_departments_code_key,DROP CONSTRAINT schedule_departments_normalized_name_key,
   ADD UNIQUE(church_id,code),ADD UNIQUE(church_id,normalized_name);
  ALTER TABLE public.schedule_people DROP CONSTRAINT schedule_people_auth_user_id_key,ADD UNIQUE(church_id,auth_user_id);
  ALTER TABLE public.schedule_settings DROP CONSTRAINT schedule_settings_pkey,ADD PRIMARY KEY(church_id,singleton);
  ALTER TABLE public.schedule_events DROP CONSTRAINT schedule_events_normalized_title_starts_at_key,DROP CONSTRAINT schedule_events_source_source_key_key,
   ADD UNIQUE(church_id,normalized_title,starts_at),ADD UNIQUE(church_id,source,source_key);
  DROP INDEX public.schedule_day_event_unique;
  CREATE UNIQUE INDEX schedule_day_event_unique ON public.schedule_events(church_id,normalized_title,scheduled_on) WHERE timing_mode='day';
  ALTER TABLE public.schedule_legacy_commitments DROP CONSTRAINT schedule_legacy_commitments_source_key_key,ADD UNIQUE(church_id,source_key);
 END IF;
END $$;

-- Igrejas futuras só podem ser cadastradas pelo operador. Criar a linha de
-- serialização na mesma transação evita mutações sem o bloqueio concorrente.
-- INVOKER: não concede poderes a quem não pode inserir no cadastro de igrejas.
CREATE FUNCTION iasdpi_admin_private.initialize_church() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 INSERT INTO iasdpi_admin_private.control(church_id,singleton) VALUES(NEW.id,true);
 IF to_regclass('public.schedule_settings') IS NOT NULL THEN
  EXECUTE 'INSERT INTO public.schedule_settings(church_id,singleton) VALUES($1,true)' USING NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER church_initialize AFTER INSERT ON public.iasdpi_churches
 FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.initialize_church();

-- Acrescenta igreja a TODAS as FKs entre tabelas do inventário.
-- Mantém as FKs antigas, incluindo as compostas, e suas ações de exclusão.
DO $$ DECLARE fk record; child_cols text; parent_cols text; suffix text; parent_key text; action text; BEGIN
 FOR fk IN SELECT con.*,nc.nspname child_schema,cc.relname child_table,np.nspname parent_schema,cp.relname parent_table
 FROM pg_constraint con JOIN pg_class cc ON cc.oid=con.conrelid JOIN pg_namespace nc ON nc.oid=cc.relnamespace
 JOIN pg_class cp ON cp.oid=con.confrelid JOIN pg_namespace np ON np.oid=cp.relnamespace
 JOIN iasdpi_011_tables a ON a.schema_name=nc.nspname AND a.table_name=cc.relname
 JOIN iasdpi_011_tables b ON b.schema_name=np.nspname AND b.table_name=cp.relname WHERE con.contype='f' LOOP
  SELECT string_agg(quote_ident(attname),',' ORDER BY ord) INTO child_cols FROM unnest(fk.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=k.num;
  SELECT string_agg(quote_ident(attname),',' ORDER BY ord) INTO parent_cols FROM unnest(fk.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=fk.confrelid AND a.attnum=k.num;
  suffix:=substr(md5(fk.oid::text||fk.conrelid::text),1,16);
  parent_key:='church_ref_'||substr(md5(fk.parent_schema||'.'||fk.parent_table||':'||parent_cols),1,16);
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=fk.confrelid AND conname=parent_key) THEN
   EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE(church_id,%s)',fk.parent_schema,fk.parent_table,parent_key,parent_cols);
  END IF;
  action:=CASE fk.confdeltype WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'a' THEN 'NO ACTION' ELSE NULL END;
  IF action IS NULL THEN RAISE EXCEPTION 'Ação de FK requer revisão: %',fk.conname; END IF;
  EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY(church_id,%s) REFERENCES %I.%I(church_id,%s) ON DELETE %s',fk.child_schema,fk.child_table,'church_fk_'||suffix,child_cols,fk.parent_schema,fk.parent_table,parent_cols,action);
 END LOOP;
END $$;

-- Transferência de um registro para outra igreja nunca é uma edição comum.
CREATE FUNCTION iasdpi_admin_private.immutable_church() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NEW.church_id IS DISTINCT FROM OLD.church_id THEN RAISE EXCEPTION 'Não é permitido transferir registros entre igrejas.' USING errcode='42501'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT * FROM iasdpi_011_tables LOOP
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schema_name,t.table_name);
  EXECUTE format('CREATE POLICY church_boundary ON %I.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t.schema_name,t.table_name);
  EXECUTE format('CREATE POLICY church_executor ON %I.%I FOR ALL TO iasdpi_church_executor USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t.schema_name,t.table_name);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I.%I TO iasdpi_church_executor',t.schema_name,t.table_name);
  EXECUTE format('CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON %I.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church()',t.schema_name,t.table_name);
 END LOOP;
END $$;

-- As duas operações UPSERT passam a usar a chave composta da igreja.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.iasdpi_set_access(uuid,text,boolean)'::regprocedure) INTO definition;
 IF position('on conflict(user_id)' IN definition)=0 THEN RAISE EXCEPTION 'iasdpi_set_access divergente: revisão obrigatória.'; END IF;
 EXECUTE replace(definition,'on conflict(user_id)','on conflict(church_id,user_id)');
 SELECT pg_get_functiondef('public.iasdpi_save_template(text,bigint,text,jsonb)'::regprocedure) INTO definition;
 IF position('on conflict(id)' IN definition)=0 THEN RAISE EXCEPTION 'iasdpi_save_template divergente: revisão obrigatória.'; END IF;
 EXECUTE replace(definition,'on conflict(id)','on conflict(church_id,id)');
END $$;

-- Inclusive implementações legadas privadas e gatilhos. Caso contrário,
-- chamar um helper SECURITY DEFINER postgres voltaria a contornar o isolamento.
DO $$ DECLARE f record; v record; s text; definition text; BEGIN
 FOREACH s IN ARRAY ARRAY['iasdpi_admin_private','iasdpi_operational_private','iasdpi_schedule_private'] LOOP
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=s) THEN
   EXECUTE format('GRANT USAGE,CREATE ON SCHEMA %I TO iasdpi_church_executor',s);
   EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM public,anon,authenticated',s);
  END IF;
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('iasdpi_admin_private','iasdpi_operational_private','iasdpi_schedule_private')
 OR (n.nspname='public' AND p.proname LIKE 'iasdpi\_%' ESCAPE '\' AND p.proname NOT IN ('iasdpi_list_churches','iasdpi_current_church_id')) LOOP
  SELECT pg_get_functiondef(f.signature::oid) INTO definition;
  IF position('auth.users' IN definition)>0 THEN EXECUTE replace(definition,'auth.users','iasdpi_admin_private.auth_accounts'); END IF;
  EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO iasdpi_church_executor',f.signature);
 END LOOP;
 FOR v IN SELECT c.oid::regclass object FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='v' AND n.nspname='iasdpi_schedule_private' LOOP
  EXECUTE format('ALTER VIEW %s OWNER TO iasdpi_church_executor',v.object);
  EXECUTE format('ALTER VIEW %s SET(security_invoker=true)',v.object);
 END LOOP;
END $$;

DO $$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY['public','iasdpi_admin_private','iasdpi_operational_private','iasdpi_schedule_private'] LOOP
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=s) THEN
   EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM iasdpi_church_executor',s);
   IF has_schema_privilege('iasdpi_church_executor',s,'CREATE') THEN RAISE EXCEPTION 'Executor herdou CREATE em %: revisar privilégios PUBLIC antes da 011.',s; END IF;
  END IF;
 END LOOP;
END $$;

-- Não altera conteúdo, IDs, timestamps, autoria, revisões ou respostas antigas.
DO $$ DECLARE t record; count_after bigint; checksum text; BEGIN
 FOR t IN SELECT * FROM iasdpi_011_tables LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(md5((to_jsonb(x)-%L)::text),%L ORDER BY md5((to_jsonb(x)-%L)::text)),%L)) FROM %I.%I x','church_id','','church_id','',t.schema_name,t.table_name) INTO count_after,checksum;
  IF count_after<>t.rows_before OR checksum IS DISTINCT FROM t.digest_before THEN
   RAISE EXCEPTION 'Integridade divergente em %.%; transação cancelada.',t.schema_name,t.table_name;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.iasdpi_churches)<>1 THEN RAISE EXCEPTION 'Cadastro inicial divergente.'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
