-- G3: revisão obrigatória após 001–012 completas. Não executado automaticamente.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_admin_private.login_aliases') IS NULL OR to_regprocedure('public.iasdpi_schedule_daily_role(uuid)') IS NULL THEN RAISE EXCEPTION 'Exige postgres, G1/G2 e Escalas 005–010 completas.'; END IF;
 IF to_regclass('iasdpi_admin_private.identity_states') IS NOT NULL THEN RAISE EXCEPTION 'G3 já instalada; revisar, sem sobrescrever.'; END IF;
END $$;
ALTER TABLE public.schedule_department_access
 ADD COLUMN can_view boolean NOT NULL DEFAULT false,
 ADD COLUMN can_edit boolean NOT NULL DEFAULT false,
 ADD COLUMN can_publish boolean NOT NULL DEFAULT false,
 ADD COLUMN can_manage_members boolean NOT NULL DEFAULT false,
 ADD COLUMN can_manage_access boolean NOT NULL DEFAULT false,
 ADD COLUMN can_handle_requests boolean NOT NULL DEFAULT false,
 ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','revoked'));
UPDATE public.schedule_department_access SET can_view=true,can_edit=(access_level='manager'),can_publish=(access_level='manager'),can_manage_members=(access_level='manager'),status=CASE WHEN enabled THEN 'active' ELSE 'revoked' END;
CREATE TABLE iasdpi_admin_private.identity_states (
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),status text NOT NULL CHECK(status IN ('active','suspended','revoked')),
 version bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid REFERENCES auth.users(id),PRIMARY KEY(church_id,user_id)
);
CREATE TABLE iasdpi_admin_private.access_requests (
 id uuid PRIMARY KEY,church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 requester_name text NOT NULL CHECK(length(btrim(requester_name)) BETWEEN 2 AND 100),identifier text NOT NULL CHECK(length(identifier) BETWEEN 1 AND 254),
 department_id uuid,target_user_id uuid REFERENCES auth.users(id),kind text NOT NULL CHECK(kind IN ('access','password')),
 message text NOT NULL DEFAULT '' CHECK(length(message)<=1000),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','resetting','resolved','failed')),
 verification text NOT NULL DEFAULT '',reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,version bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(church_id,id),
 FOREIGN KEY(church_id,department_id) REFERENCES public.schedule_departments(church_id,id)
);
CREATE TABLE iasdpi_admin_private.reset_capabilities (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 request_id uuid NOT NULL,subject_id uuid NOT NULL REFERENCES auth.users(id),issuer_id uuid NOT NULL REFERENCES auth.users(id),
 expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),claimed_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','used','failed','revoked')),
 lease_id uuid,FOREIGN KEY(church_id,request_id) REFERENCES iasdpi_admin_private.access_requests(church_id,id),CHECK(expires_at>created_at)
);
CREATE INDEX access_requests_queue ON iasdpi_admin_private.access_requests(church_id,status,created_at);
CREATE UNIQUE INDEX one_reset_in_flight_per_identity ON iasdpi_admin_private.reset_capabilities(subject_id) WHERE status='processing';
CREATE UNIQUE INDEX reset_lease_unique ON iasdpi_admin_private.reset_capabilities(lease_id) WHERE lease_id IS NOT NULL;
CREATE INDEX reset_capabilities_request ON iasdpi_admin_private.reset_capabilities(church_id,request_id);
CREATE SCHEMA iasdpi_governance_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA iasdpi_governance_private FROM public,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA iasdpi_governance_private TO iasdpi_church_executor;
-- Segurança da identidade Auth é global: JWTs anteriores não podem ingressar
-- em outra igreja por convite após uma redefinição de credencial.
CREATE TABLE iasdpi_governance_private.identity_epochs (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),minimum_iat bigint NOT NULL DEFAULT 0,blocked boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE iasdpi_governance_private.identity_epochs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_governance_private.identity_epochs FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON iasdpi_governance_private.identity_epochs TO iasdpi_church_executor;
CREATE POLICY executor_only ON iasdpi_governance_private.identity_epochs FOR ALL TO iasdpi_church_executor USING(true) WITH CHECK(true);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['identity_states','access_requests','reset_capabilities'] LOOP
 EXECUTE format('ALTER TABLE iasdpi_admin_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON iasdpi_admin_private.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON iasdpi_admin_private.%I TO iasdpi_church_executor',t);
 EXECUTE format('CREATE POLICY church_boundary ON iasdpi_admin_private.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON iasdpi_admin_private.%I FOR ALL TO iasdpi_church_executor USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 EXECUTE format('CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_admin_private.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church()',t);
 END LOOP;
END $$;
-- Lock global por identidade Auth; o mesmo usuário pode existir em mais de uma igreja.
-- Impede criar um novo vínculo em outra igreja durante uma redefinição em curso.
CREATE FUNCTION iasdpi_admin_private.lock_identity(u uuid,allow_blocked boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$ DECLARE is_blocked boolean;BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Identidade inválida.' USING errcode='22023';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('iasdpi:auth:'||u::text,0));
 INSERT INTO iasdpi_governance_private.identity_epochs(user_id) VALUES(u) ON CONFLICT(user_id) DO UPDATE SET updated_at=clock_timestamp() RETURNING blocked INTO is_blocked;
 -- O upsert também força 40001 em snapshots REPEATABLE READ obsoletos.
 IF NOT allow_blocked AND is_blocked THEN RAISE EXCEPTION 'Identidade em redefinição; conclua a revisão antes de conceder acesso.' USING errcode='42501';END IF;
END $$;
CREATE FUNCTION iasdpi_admin_private.identity_active(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u IS NOT NULL AND NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.identity_states WHERE user_id=u AND status<>'active')
 AND NOT EXISTS(SELECT 1 FROM iasdpi_governance_private.identity_epochs WHERE user_id=u AND blocked)
 AND NOT EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=u AND NOT enabled);
$$;
CREATE FUNCTION public.iasdpi_session_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_admin_private.identity_active(auth.uid()) AND NOT EXISTS(SELECT 1 FROM iasdpi_governance_private.identity_epochs WHERE user_id=auth.uid() AND minimum_iat>=coalesce((auth.jwt()->>'iat')::bigint,0) AND minimum_iat>0);
$$;
CREATE FUNCTION iasdpi_admin_private.require_session() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT public.iasdpi_session_allowed() THEN RAISE EXCEPTION 'Acesso suspenso, revogado ou sessão anterior. Entre novamente ou procure a administração.' USING errcode='42501';END IF;RETURN auth.uid();END $$;
-- Reutiliza as implementações anteriores e acrescenta a barreira de sessão.
ALTER FUNCTION iasdpi_admin_private.require_admin() RENAME TO require_admin_g2;
CREATE FUNCTION iasdpi_admin_private.require_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_admin_private.require_session();RETURN iasdpi_admin_private.require_admin_g2();END $$;
ALTER FUNCTION iasdpi_operational_private.require_access() RENAME TO require_access_g2;
CREATE FUNCTION iasdpi_operational_private.require_access() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_admin_private.require_session();RETURN iasdpi_operational_private.require_access_g2();END $$;
ALTER FUNCTION iasdpi_schedule_private.actor() RENAME TO actor_g2;
CREATE FUNCTION iasdpi_schedule_private.actor() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_admin_private.require_session();RETURN iasdpi_schedule_private.actor_g2();END $$;
ALTER FUNCTION iasdpi_admin_private.alias_identity_allowed(uuid) RENAME TO alias_identity_allowed_g2;
CREATE FUNCTION iasdpi_admin_private.alias_identity_allowed(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_admin_private.identity_active(p_user) AND iasdpi_admin_private.alias_identity_allowed_g2(p_user); $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.is_admin(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_admin_private.identity_active(u) AND EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=u AND enabled AND role='admin'); $$;
CREATE FUNCTION iasdpi_schedule_private.has_capability(u uuid,d uuid,cap text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_admin_private.identity_active(u) AND (iasdpi_schedule_private.is_admin(u) OR EXISTS(SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_departments dep ON dep.id=a.department_id WHERE a.user_id=u AND a.department_id=d AND a.enabled AND a.status='active' AND dep.active AND CASE cap WHEN 'view' THEN can_view WHEN 'edit' THEN can_edit WHEN 'publish' THEN can_publish WHEN 'members' THEN can_manage_members WHEN 'access' THEN can_manage_access WHEN 'requests' THEN can_handle_requests ELSE false END));
$$;
-- can_manage passa a ser compatibilidade interna; gates públicos distinguem ações.
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.can_manage(u uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_schedule_private.has_capability(u,d,'edit') OR iasdpi_schedule_private.has_capability(u,d,'publish') OR iasdpi_schedule_private.has_capability(u,d,'members'); $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.can_view(u uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_schedule_private.has_capability(u,d,'view') OR (iasdpi_admin_private.identity_active(u) AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access a WHERE a.user_id=u AND a.department_id=d AND (NOT a.enabled OR a.status<>'active')) AND EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id JOIN public.schedule_departments dep ON dep.id=m.department_id WHERE p.auth_user_id=u AND p.active AND m.active AND m.department_id=d AND dep.active)); $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.can_see_person(u uuid,p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR (iasdpi_admin_private.identity_active(u) AND (EXISTS(SELECT 1 FROM public.schedule_people WHERE id=p AND auth_user_id=u AND active) OR EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=p AND iasdpi_schedule_private.has_capability(u,m.department_id,'view'))));
$$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities'] LOOP
 EXECUTE format('CREATE POLICY governance_session ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.iasdpi_session_allowed()) WITH CHECK(public.iasdpi_session_allowed())',t);END LOOP;END $$;
ALTER FUNCTION public.iasdpi_accept_invite(text) SET SCHEMA iasdpi_admin_private;
ALTER FUNCTION iasdpi_admin_private.iasdpi_accept_invite(text) RENAME TO accept_invite_g2;
CREATE FUNCTION public.iasdpi_accept_invite(p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_admin_private.require_session();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;PERFORM iasdpi_admin_private.lock_identity(auth.uid());PERFORM iasdpi_admin_private.require_session();PERFORM iasdpi_admin_private.accept_invite_g2(p_token);END $$;
ALTER FUNCTION public.iasdpi_set_access(uuid,text,boolean) SET SCHEMA iasdpi_admin_private;
ALTER FUNCTION iasdpi_admin_private.iasdpi_set_access(uuid,text,boolean) RENAME TO set_access_g2;
CREATE FUNCTION public.iasdpi_set_access(p_user_id uuid,p_role text,p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM iasdpi_admin_private.lock_admin();PERFORM iasdpi_admin_private.lock_identity(p_user_id,NOT coalesce(p_enabled,true));
 IF EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user_id AND role='admin' AND enabled) AND (p_role<>'admin' OR NOT p_enabled) AND NOT EXISTS(SELECT 1 FROM public.iasdpi_access a WHERE a.user_id<>p_user_id AND a.role='admin' AND a.enabled AND iasdpi_admin_private.identity_active(a.user_id)) THEN RAISE EXCEPTION 'Não é permitido remover o último administrador geral ativo.' USING errcode='23514';END IF;
 PERFORM iasdpi_admin_private.set_access_g2(p_user_id,p_role,p_enabled);
 INSERT INTO iasdpi_admin_private.identity_states(user_id,status,updated_by) VALUES(p_user_id,CASE WHEN p_enabled THEN 'active' ELSE 'revoked' END,auth.uid()) ON CONFLICT(church_id,user_id) DO UPDATE SET status=excluded.status,version=identity_states.version+1,updated_at=now(),updated_by=auth.uid();
END $$;
CREATE FUNCTION public.iasdpi_identity_state_save(p_user uuid,p_status text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE old public.iasdpi_access; actor uuid; BEGIN
 actor:=iasdpi_admin_private.lock_admin();IF p_status NOT IN ('active','suspended','revoked') OR coalesce(length(btrim(p_reason)),0)<10 THEN RAISE EXCEPTION 'Informe situação e motivo.' USING errcode='22023';END IF;
 SELECT * INTO old FROM public.iasdpi_access WHERE user_id=p_user;
 IF old.user_id IS NOT NULL THEN PERFORM public.iasdpi_set_access(p_user,old.role,p_status='active');END IF;
 IF old.user_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=p_user) THEN RAISE EXCEPTION 'Conta fora da igreja.' USING errcode='42501';END IF;
 INSERT INTO iasdpi_admin_private.identity_states(user_id,status,updated_by) VALUES(p_user,p_status,actor) ON CONFLICT(church_id,user_id) DO UPDATE SET status=excluded.status,version=identity_states.version+1,updated_at=now(),updated_by=actor;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(actor,'identity_'||p_status,p_user,jsonb_build_object('reason',left(p_reason,500)));
END $$;
CREATE FUNCTION public.iasdpi_department_access_save(p_department uuid,p_user uuid,p_flags jsonb,p_status text,p_expected_version bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; admin boolean; old public.schedule_department_access; result public.schedule_department_access; f text; BEGIN
 actor:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;actor:=iasdpi_schedule_private.actor();admin:=iasdpi_schedule_private.is_admin(actor);
 IF NOT iasdpi_schedule_private.has_capability(actor,p_department,'access') THEN RAISE EXCEPTION 'Sem gestão de acessos deste departamento.' USING errcode='42501';END IF;
 IF jsonb_typeof(p_flags) IS DISTINCT FROM 'object' OR p_status NOT IN ('active','suspended','revoked') OR p_expected_version IS NULL OR p_expected_version<0 OR EXISTS(SELECT 1 FROM jsonb_each(p_flags) j WHERE j.key NOT IN ('view','edit','publish','members','access','requests') OR jsonb_typeof(j.value)<>'boolean') THEN RAISE EXCEPTION 'Permissões inválidas.' USING errcode='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=p_department AND (active OR p_status<>'active')) OR NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=p_user AND (p_status<>'active' OR (email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)))) THEN RAISE EXCEPTION 'Departamento ou conta inválida.' USING errcode='22023';END IF;
 PERFORM iasdpi_admin_private.lock_identity(p_user,p_status<>'active');
 SELECT * INTO old FROM public.schedule_department_access WHERE department_id=p_department AND user_id=p_user FOR UPDATE;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Permissões alteradas em outro dispositivo.' USING errcode='40001';END IF;
 p_flags:=jsonb_build_object('view',coalesce(old.can_view,false),'edit',coalesce(old.can_edit,false),'publish',coalesce(old.can_publish,false),'members',coalesce(old.can_manage_members,false),'access',coalesce(old.can_manage_access,false),'requests',coalesce(old.can_handle_requests,false))||p_flags;
 IF NOT admin THEN
  IF NOT EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user) AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=p_user) THEN RAISE EXCEPTION 'Solicite à administração geral o vínculo inicial desta identidade.' USING errcode='42501';END IF;
  IF p_user=actor OR EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user AND role='admin') OR coalesce((p_flags->>'access')::boolean,false) IS DISTINCT FROM coalesce(old.can_manage_access,false) OR coalesce((p_flags->>'requests')::boolean,false) IS DISTINCT FROM coalesce(old.can_handle_requests,false) THEN RAISE EXCEPTION 'Somente administrador geral altera delegações ou a própria gestão.' USING errcode='42501';END IF;
  FOR f IN SELECT key FROM jsonb_each(p_flags) WHERE value='true'::jsonb LOOP IF NOT iasdpi_schedule_private.has_capability(actor,p_department,f) THEN RAISE EXCEPTION 'Não conceda permissões que você não possui.' USING errcode='42501';END IF;END LOOP;
 END IF;
 IF old.id IS NULL THEN INSERT INTO public.schedule_department_access(department_id,user_id,access_level,enabled) VALUES(p_department,p_user,'viewer',p_status='active') RETURNING * INTO old;END IF;
 UPDATE public.schedule_department_access SET can_view=coalesce((p_flags->>'view')::boolean,false),can_edit=coalesce((p_flags->>'edit')::boolean,false),can_publish=coalesce((p_flags->>'publish')::boolean,false),can_manage_members=coalesce((p_flags->>'members')::boolean,false),can_manage_access=coalesce((p_flags->>'access')::boolean,false),can_handle_requests=coalesce((p_flags->>'requests')::boolean,false),status=p_status,enabled=p_status='active',access_level=CASE WHEN coalesce((p_flags->>'edit')::boolean,false) OR coalesce((p_flags->>'members')::boolean,false) OR coalesce((p_flags->>'publish')::boolean,false) THEN 'manager' ELSE 'viewer' END,version=CASE WHEN p_expected_version=0 THEN 1 ELSE old.version+1 END,updated_at=now() WHERE id=old.id RETURNING * INTO result;
 IF (result.can_edit OR result.can_publish OR result.can_manage_members OR result.can_manage_access OR result.can_handle_requests) AND NOT result.can_view THEN RAISE EXCEPTION 'Habilite visualização para conceder outras ações.' USING errcode='23514';END IF;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(actor,'department_access_'||p_status,p_user,jsonb_build_object('department_id',p_department,'permissions',p_flags,'version',result.version));RETURN to_jsonb(result);
END $$;
-- Gates externos preservam implementações/validações transacionais de Escalas.
ALTER FUNCTION public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid) RENAME TO save_g2;
CREATE FUNCTION public.iasdpi_schedule_save(p_entity text,p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid; d uuid; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF p_entity='person' AND nullif(p_data->>'auth_user_id','') IS NOT NULL THEN PERFORM iasdpi_admin_private.lock_identity((p_data->>'auth_user_id')::uuid);END IF;
 IF p_entity='access' THEN RAISE EXCEPTION 'Use a Gestão de acessos para alterar permissões.' USING errcode='22023';END IF;
 IF NOT iasdpi_schedule_private.is_admin(u) THEN
  IF p_entity='person' THEN d:=(p_data->>'department_id')::uuid;
  ELSIF p_entity='membership' THEN SELECT department_id INTO d FROM public.schedule_memberships WHERE id=p_id;
  ELSIF p_entity='role' THEN SELECT department_id INTO d FROM public.schedule_roles WHERE id=p_id;
  ELSIF p_entity='availability' THEN SELECT department_id INTO d FROM public.schedule_availability WHERE id=p_id;END IF;
  d:=coalesce(d,(p_data->>'department_id')::uuid);
  IF NOT iasdpi_schedule_private.has_capability(u,d,'members') THEN RAISE EXCEPTION 'Sem administração de membros deste departamento.' USING errcode='42501';END IF;
 END IF;
 RETURN iasdpi_schedule_private.save_g2(p_entity,p_id,p_expected_version,p_data,p_request_id);
END $$;
ALTER FUNCTION public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_g2;
CREATE FUNCTION public.iasdpi_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid; d uuid; old public.schedule_plans; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();SELECT * INTO old FROM public.schedule_plans WHERE id=p_id;d:=coalesce(old.department_id,(p_data->>'department_id')::uuid);
 IF (p_data->>'status'='published' OR old.status='published') AND NOT iasdpi_schedule_private.has_capability(u,d,'publish') THEN RAISE EXCEPTION 'Sem permissão para publicar ou alterar escala publicada.' USING errcode='42501';END IF;
 IF (p_data-'status')<>'{}'::jsonb AND NOT iasdpi_schedule_private.has_capability(u,d,'edit') THEN RAISE EXCEPTION 'Sem permissão para editar escala.' USING errcode='42501';END IF;
 IF p_data='{}'::jsonb OR (p_data->>'status' IS DISTINCT FROM 'published' AND NOT iasdpi_schedule_private.has_capability(u,d,'edit')) THEN RAISE EXCEPTION 'Ação não autorizada.' USING errcode='42501';END IF;
 RETURN iasdpi_schedule_private.plan_save_g2(p_id,p_expected_version,p_data,p_request_id);
END $$;
ALTER FUNCTION public.iasdpi_schedule_catalog() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_catalog() RENAME TO catalog_g2;
CREATE FUNCTION public.iasdpi_schedule_catalog() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); result jsonb; BEGIN
 result:=iasdpi_schedule_private.catalog_g2();RETURN result||jsonb_build_object('departments',(SELECT coalesce(jsonb_agg(d||jsonb_build_object('can_edit',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'edit'),'can_publish',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'publish'),'can_manage_members',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'members'))),'[]') FROM jsonb_array_elements(result->'departments') d));END $$;
-- Gate explícito de edição nas três entradas auxiliares que usam can_manage.
DO $$ DECLARE f text; signature text; def text; args text; gate text; BEGIN
 FOREACH f IN ARRAY ARRAY['iasdpi_schedule_event_create','iasdpi_schedule_generate_days','iasdpi_schedule_daily_role'] LOOP
 SELECT p.oid::regprocedure::text,pg_get_functiondef(p.oid) INTO signature,def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=f;
 -- Insere o gate no corpo público antes de qualquer caminho de compatibilidade.
 gate:=CASE WHEN f='iasdpi_schedule_event_create' THEN 'BEGIN IF NOT iasdpi_schedule_private.has_capability(iasdpi_schedule_private.actor(),(p_data->>''department_id'')::uuid,''edit'') THEN RAISE EXCEPTION ''Sem edição deste departamento.'' USING errcode=''42501'';END IF;'
 ELSE 'BEGIN IF NOT iasdpi_schedule_private.has_capability(iasdpi_schedule_private.actor(),p_department,''edit'') THEN RAISE EXCEPTION ''Sem edição deste departamento.'' USING errcode=''42501'';END IF;' END;
 IF strpos(def,'BEGIN')=0 THEN RAISE EXCEPTION 'Gate não reconhecido: %',f;END IF;
 gate:=replace(gate,'BEGIN IF','BEGIN PERFORM iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;IF');
 def:=overlay(def placing gate from strpos(def,'BEGIN') for 5);
 EXECUTE def;
 END LOOP;
END $$;
CREATE FUNCTION iasdpi_admin_private.can_review(u uuid,d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_schedule_private.is_admin(u) OR (d IS NOT NULL AND iasdpi_schedule_private.has_capability(u,d,'requests')); $$;
-- Ponte global somente booleana: um admin de igreja não pode redefinir uma
-- identidade compartilhada com outra igreja. Nenhum detalhe é devolvido.
CREATE FUNCTION iasdpi_governance_private.has_other_church(u uuid,c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=u AND church_id<>c) OR EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=u AND church_id<>c) OR EXISTS(SELECT 1 FROM public.schedule_people WHERE auth_user_id=u AND church_id<>c);
$$;
REVOKE ALL ON FUNCTION iasdpi_governance_private.has_other_church(uuid,uuid) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION iasdpi_governance_private.has_other_church(uuid,uuid) TO iasdpi_church_executor;
CREATE FUNCTION iasdpi_admin_private.can_reset(u uuid,target uuid,d uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF target IS NULL OR u=target OR NOT iasdpi_admin_private.identity_active(u) OR NOT iasdpi_admin_private.can_review(u,d) OR iasdpi_governance_private.has_other_church(target,public.iasdpi_current_church_id()) THEN RETURN false;END IF;
 IF iasdpi_schedule_private.is_admin(u) THEN RETURN true;END IF;
 IF EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=target) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=target) AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access a WHERE a.user_id=target AND NOT iasdpi_schedule_private.has_capability(u,a.department_id,'requests'))
 AND NOT EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id WHERE p.auth_user_id=target AND NOT iasdpi_schedule_private.has_capability(u,m.department_id,'requests'));
END $$;
CREATE FUNCTION public.iasdpi_governance_catalog() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); a boolean:=iasdpi_schedule_private.is_admin(u); BEGIN
 IF NOT a AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE iasdpi_schedule_private.has_capability(u,d.id,'access') OR iasdpi_schedule_private.has_capability(u,d.id,'requests') OR iasdpi_schedule_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Solicite autorização explícita para gerir acessos ou solicitações.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('actor_id',u,'is_admin',a,'church_id',public.iasdpi_current_church_id(),
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'can_access',iasdpi_schedule_private.has_capability(u,d.id,'access'),'can_requests',iasdpi_schedule_private.has_capability(u,d.id,'requests'),'can_members',iasdpi_schedule_private.has_capability(u,d.id,'members'))) FROM public.schedule_departments d WHERE d.active AND (a OR iasdpi_schedule_private.has_capability(u,d.id,'access') OR iasdpi_schedule_private.has_capability(u,d.id,'requests') OR iasdpi_schedule_private.has_capability(u,d.id,'members'))),'[]'::jsonb),
 'users',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',x.uid,'name',coalesce((SELECT p.display_name FROM public.schedule_people p WHERE p.auth_user_id=x.uid LIMIT 1),(SELECT identifier FROM iasdpi_admin_private.login_aliases WHERE user_id=x.uid ORDER BY identifier LIMIT 1),'Conta '||left(x.uid::text,8)),'role',(SELECT role FROM public.iasdpi_access WHERE user_id=x.uid),'enabled',(SELECT enabled FROM public.iasdpi_access WHERE user_id=x.uid),'reset_blocked',EXISTS(SELECT 1 FROM iasdpi_governance_private.identity_epochs WHERE user_id=x.uid AND blocked),'status',coalesce((SELECT status FROM iasdpi_admin_private.identity_states WHERE user_id=x.uid),(SELECT CASE WHEN enabled THEN 'active' ELSE 'revoked' END FROM public.iasdpi_access WHERE user_id=x.uid),'active'))) FROM (SELECT user_id uid FROM public.iasdpi_access WHERE a UNION SELECT user_id FROM public.schedule_department_access acl WHERE a OR iasdpi_schedule_private.has_capability(u,acl.department_id,'access') OR iasdpi_schedule_private.has_capability(u,acl.department_id,'requests') OR iasdpi_schedule_private.has_capability(u,acl.department_id,'members')) x),'[]'::jsonb),
 'access',coalesce((SELECT jsonb_agg(to_jsonb(acl)) FROM public.schedule_department_access acl WHERE a OR iasdpi_schedule_private.has_capability(u,acl.department_id,'access') OR iasdpi_schedule_private.has_capability(u,acl.department_id,'members')),'[]'::jsonb),
 'aliases',CASE WHEN a THEN public.iasdpi_alias_list() ELSE '[]'::jsonb END);
END $$;
CREATE FUNCTION public.iasdpi_governance_history(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Página inválida.';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT a.id,a.actor_id,a.action,a.target_id,a.details,a.created_at FROM iasdpi_admin_private.audit a WHERE iasdpi_schedule_private.is_admin(u) OR EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id::text=a.details->>'department_id' AND (iasdpi_schedule_private.has_capability(u,d.id,'access') OR iasdpi_schedule_private.has_capability(u,d.id,'requests') OR iasdpi_schedule_private.has_capability(u,d.id,'members'))) ORDER BY a.created_at DESC,a.id LIMIT 50 OFFSET p_offset) x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.iasdpi_department_members(p_department uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.has_capability(u,p_department,'members') THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'person_id',p.id,'name',p.display_name,'active',m.active,'version',m.version,'role_ids',coalesce((SELECT jsonb_agg(role_id) FROM public.schedule_qualifications WHERE membership_id=m.id),'[]'))) FROM public.schedule_memberships m JOIN public.schedule_people p ON p.id=m.person_id WHERE m.department_id=p_department),'[]'::jsonb);
END $$;
CREATE FUNCTION public.iasdpi_access_request_options() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name),'[]') FROM public.schedule_departments WHERE active AND church_id=public.iasdpi_current_church_id(); $$;
CREATE FUNCTION public.iasdpi_access_request_submit(p_id uuid,p_name text,p_identifier text,p_department uuid,p_kind text,p_message text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE target uuid; d uuid:=p_department; BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor necessário.' USING errcode='42501';END IF;
 IF p_id IS NULL OR coalesce(length(btrim(p_name)),0) NOT BETWEEN 2 AND 100 OR coalesce(length(btrim(p_identifier)),0) NOT BETWEEN 1 AND 254 OR p_kind NOT IN ('access','password') OR p_message IS NULL OR length(p_message)>1000 THEN RAISE EXCEPTION 'Solicitação inválida.' USING errcode='22023';END IF;
 IF d IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=d AND active) THEN RAISE EXCEPTION 'Departamento inválido.' USING errcode='22023';END IF;
 SELECT user_id INTO target FROM iasdpi_admin_private.login_aliases WHERE identifier=lower(btrim(p_identifier));
 IF target IS NULL AND position('@' IN p_identifier)>0 THEN SELECT id INTO target FROM iasdpi_admin_private.auth_accounts WHERE lower(email)=lower(btrim(p_identifier));END IF;
 IF target IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=target) AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=target) THEN target:=NULL;END IF;
 IF target IS NULL OR EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=target) OR (d IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=target AND department_id=d) AND NOT EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id WHERE p.auth_user_id=target AND m.department_id=d)) THEN d:=NULL;END IF;
 INSERT INTO iasdpi_admin_private.access_requests(id,requester_name,identifier,department_id,target_user_id,kind,message) VALUES(p_id,btrim(p_name),btrim(p_identifier),d,target,p_kind,p_message) ON CONFLICT(id) DO NOTHING;
END $$;
CREATE FUNCTION public.iasdpi_access_requests(p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Página inválida.';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT r.*,iasdpi_admin_private.can_reset(u,r.target_user_id,r.department_id) can_reset FROM iasdpi_admin_private.access_requests r WHERE iasdpi_admin_private.can_review(u,r.department_id) ORDER BY r.created_at DESC,r.id LIMIT 50 OFFSET p_offset) q),'[]'::jsonb);
END $$;
CREATE FUNCTION public.iasdpi_access_request_review(p_id uuid,p_expected_version bigint,p_status text,p_verification text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid; r iasdpi_admin_private.access_requests; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();SELECT * INTO r FROM iasdpi_admin_private.access_requests WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR NOT iasdpi_admin_private.can_review(u,r.department_id) OR (NOT iasdpi_schedule_private.is_admin(u) AND EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=r.target_user_id AND role='admin')) THEN RAISE EXCEPTION 'Sem tratamento desta solicitação.' USING errcode='42501';END IF;
 IF p_expected_version IS NULL OR p_expected_version<1 OR r.version<>p_expected_version THEN RAISE EXCEPTION 'Solicitação já alterada.' USING errcode='40001';END IF;
 IF r.status NOT IN ('pending','verified','failed','rejected') OR p_status NOT IN ('verified','rejected','resolved') OR coalesce(length(btrim(p_verification)),0) NOT BETWEEN 10 AND 1000 OR r.target_user_id=u THEN RAISE EXCEPTION 'Verifique a identidade fora do sistema e registre o procedimento; autoaprovação não permitida.' USING errcode='22023';END IF;
 UPDATE iasdpi_admin_private.access_requests SET status=p_status,verification=p_verification,reviewed_by=u,reviewed_at=now(),version=version+1 WHERE id=p_id;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'request_'||p_status,r.target_user_id,jsonb_build_object('request_id',p_id,'department_id',r.department_id,'verification',p_verification));
END $$;
CREATE FUNCTION public.iasdpi_access_reset_issue(p_request uuid,p_expected_version bigint,p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid; r iasdpi_admin_private.access_requests; until_at timestamptz:=clock_timestamp()+interval '15 minutes'; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();SELECT * INTO r FROM iasdpi_admin_private.access_requests WHERE id=p_request FOR UPDATE;
 IF r.id IS NULL OR NOT iasdpi_admin_private.can_reset(u,r.target_user_id,r.department_id) THEN RAISE EXCEPTION 'Redefinição fora do alcance; procure o administrador geral ou o operador responsável pela identidade compartilhada.' USING errcode='42501';END IF;
 IF p_expected_version IS NULL OR p_expected_version<1 OR r.version<>p_expected_version THEN RAISE EXCEPTION 'Solicitação alterada.' USING errcode='40001';END IF;
 IF r.kind<>'password' OR r.status<>'verified' OR r.reviewed_by IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Verificação de identidade obrigatória.' USING errcode='22023';END IF;
 UPDATE iasdpi_admin_private.reset_capabilities SET status='revoked' WHERE request_id=p_request AND status='pending';
 INSERT INTO iasdpi_admin_private.reset_capabilities(token_hash,request_id,subject_id,issuer_id,expires_at) VALUES(p_hash,p_request,r.target_user_id,u,until_at);
 UPDATE iasdpi_admin_private.access_requests SET version=version+1 WHERE id=p_request;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'reset_issued',r.target_user_id,jsonb_build_object('request_id',p_request,'department_id',r.department_id,'expires_at',until_at));RETURN jsonb_build_object('expires_at',until_at);
END $$;
CREATE FUNCTION public.iasdpi_access_reset_claim(p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE cap iasdpi_admin_private.reset_capabilities; r iasdpi_admin_private.access_requests; lease uuid:=gen_random_uuid(); BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor necessário.' USING errcode='42501';END IF;
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;SELECT * INTO cap FROM iasdpi_admin_private.reset_capabilities WHERE token_hash=p_hash FOR UPDATE;
 SELECT * INTO r FROM iasdpi_admin_private.access_requests WHERE id=cap.request_id;
 IF cap.subject_id IS NOT NULL THEN PERFORM iasdpi_admin_private.lock_identity(cap.subject_id,true);END IF;
 IF cap.status IS DISTINCT FROM 'pending' OR cap.expires_at<=clock_timestamp() OR r.status<>'verified' OR NOT iasdpi_admin_private.can_reset(cap.issuer_id,cap.subject_id,r.department_id) THEN RAISE EXCEPTION 'Link inválido ou expirado.' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=cap.subject_id AND email IS NOT NULL) THEN RAISE EXCEPTION 'Conta incompatível com recuperação.' USING errcode='42501';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_admin_private.reset_capabilities WHERE subject_id=cap.subject_id AND status='processing') THEN RAISE EXCEPTION 'Redefinição já em processamento; solicite revisão administrativa.' USING errcode='42501';END IF;
 INSERT INTO iasdpi_governance_private.identity_epochs(user_id,minimum_iat,blocked) VALUES(cap.subject_id,floor(extract(epoch FROM clock_timestamp()))::bigint,true) ON CONFLICT(user_id) DO UPDATE SET minimum_iat=greatest(identity_epochs.minimum_iat,excluded.minimum_iat),blocked=true,updated_at=now();
 UPDATE iasdpi_admin_private.reset_capabilities SET status='processing',claimed_at=now(),lease_id=lease WHERE token_hash=p_hash;
 UPDATE iasdpi_admin_private.access_requests SET status='resetting',version=version+1 WHERE id=cap.request_id;
 RETURN jsonb_build_object('lease',lease,'user_id',cap.subject_id,'email',(SELECT email FROM iasdpi_admin_private.auth_accounts WHERE id=cap.subject_id));
END $$;
CREATE FUNCTION public.iasdpi_access_reset_finish(p_lease uuid,p_success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE cap iasdpi_admin_private.reset_capabilities; BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor necessário.' USING errcode='42501';END IF;
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;SELECT * INTO cap FROM iasdpi_admin_private.reset_capabilities WHERE lease_id=p_lease AND status='processing' FOR UPDATE;
 IF cap.subject_id IS NOT NULL THEN PERFORM iasdpi_admin_private.lock_identity(cap.subject_id,true);END IF;
 IF cap.token_hash IS NULL OR p_success IS NULL THEN RAISE EXCEPTION 'Conclusão inválida.' USING errcode='42501';END IF;
 UPDATE iasdpi_admin_private.reset_capabilities SET status=CASE WHEN p_success THEN 'used' ELSE 'failed' END WHERE token_hash=cap.token_hash;
 UPDATE iasdpi_admin_private.access_requests SET status=CASE WHEN p_success THEN 'resolved' ELSE 'failed' END,version=version+1 WHERE id=cap.request_id;
 -- Em falha parcial, a identidade permanece bloqueada para revisão administrativa.
 UPDATE iasdpi_governance_private.identity_epochs SET blocked=NOT p_success,minimum_iat=greatest(minimum_iat,floor(extract(epoch FROM clock_timestamp()))::bigint),updated_at=now() WHERE user_id=cap.subject_id;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(cap.issuer_id,CASE WHEN p_success THEN 'reset_completed' ELSE 'reset_failed' END,cap.subject_id,jsonb_build_object('request_id',cap.request_id,'execution','secure_backend'));
END $$;
DO $$ DECLARE f regprocedure; def text; gate text; BEGIN
 FOREACH f IN ARRAY ARRAY['iasdpi_admin_private.require_admin_g2()'::regprocedure,'iasdpi_operational_private.require_access_g2()'::regprocedure,'iasdpi_schedule_private.actor_g2()'::regprocedure] LOOP
  SELECT pg_get_functiondef(f) INTO def;
  IF strpos(lower(def),'begin')=0 THEN RAISE EXCEPTION 'Helper não reconhecido.';END IF;
  def:=overlay(def placing 'BEGIN PERFORM iasdpi_admin_private.require_session();' from strpos(lower(def),'begin') for 5);EXECUTE def;
 END LOOP;
END $$;
-- Também atualiza o OID antigo, utilizado por planos SQL já analisados.
CREATE OR REPLACE FUNCTION iasdpi_admin_private.alias_identity_allowed_g2(p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT iasdpi_admin_private.identity_active(p_user) OR NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=p_user AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user AND enabled AND role IN ('admin','leader')) OR EXISTS(SELECT 1 FROM public.schedule_departments d WHERE iasdpi_schedule_private.can_view(p_user,d.id));
END $$;
-- ACL final: todas as novas funções usam o executor sem BYPASSRLS, salvo a
-- ponte privada somente booleana para detectar identidades de outras igrejas.
GRANT CREATE ON SCHEMA public,iasdpi_admin_private,iasdpi_operational_private,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('iasdpi_admin_private','iasdpi_operational_private','iasdpi_schedule_private') OR(n.nspname='public' AND p.proname LIKE 'iasdpi\_%' ESCAPE '\' AND p.proname NOT IN ('iasdpi_list_churches','iasdpi_current_church_id')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);
 IF f.sig::text LIKE 'iasdpi_%private.%' THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_admin_private,iasdpi_operational_private,iasdpi_schedule_private FROM iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('iasdpi_session_allowed','iasdpi_identity_state_save','iasdpi_department_access_save','iasdpi_governance_catalog','iasdpi_governance_history','iasdpi_department_members','iasdpi_access_request_options','iasdpi_access_request_submit','iasdpi_access_requests','iasdpi_access_request_review','iasdpi_access_reset_issue','iasdpi_access_reset_claim','iasdpi_access_reset_finish') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.iasdpi_session_allowed(),public.iasdpi_identity_state_save(uuid,text,text),public.iasdpi_department_access_save(uuid,uuid,jsonb,text,bigint),public.iasdpi_governance_catalog(),public.iasdpi_governance_history(integer),public.iasdpi_department_members(uuid),public.iasdpi_access_requests(integer),public.iasdpi_access_request_review(uuid,bigint,text,text),public.iasdpi_access_reset_issue(uuid,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_access_request_options() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_access_request_submit(uuid,text,text,uuid,text,text),public.iasdpi_access_reset_claim(text),public.iasdpi_access_reset_finish(uuid,boolean) TO service_role;
-- CREATE FUNCTION substituiu entradas movidas; manter autenticação das entradas originais.
GRANT EXECUTE ON FUNCTION public.iasdpi_accept_invite(text),public.iasdpi_set_access(uuid,text,boolean),public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_catalog() TO authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_accept_invite(text),public.iasdpi_set_access(uuid,text,boolean),public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_catalog() FROM public,anon,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
