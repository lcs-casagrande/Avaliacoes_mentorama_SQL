-- G11: conclusão administrativa sobre G10.3. REVISAR; não aplicar automaticamente.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_responsibility_account_plan()') IS NULL
 OR to_regclass('iasdpi_admin_private.account_creation_requests') IS NOT NULL THEN
  RAISE EXCEPTION 'Exige 001–026 e ausência da 027; não reaplicar.';
 END IF;
END $$;

-- Intenções de provisionamento, nunca senhas. Auth continua no provedor.
CREATE TABLE iasdpi_admin_private.account_creation_requests(
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 id uuid NOT NULL,person_id uuid NOT NULL,person_version bigint NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),identifier text NOT NULL,email text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','completed','cancelled')),
 user_id uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
 PRIMARY KEY(church_id,id),FOREIGN KEY(church_id,person_id) REFERENCES public.schedule_people(church_id,id)
);
CREATE UNIQUE INDEX account_creation_one_pending ON iasdpi_admin_private.account_creation_requests(church_id,person_id) WHERE status='pending';
ALTER TABLE iasdpi_admin_private.account_creation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE iasdpi_admin_private.account_creation_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY church_boundary ON iasdpi_admin_private.account_creation_requests AS RESTRICTIVE FOR ALL TO public
 USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE POLICY church_executor ON iasdpi_admin_private.account_creation_requests FOR ALL TO iasdpi_church_executor
 USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE POLICY credential_change_required ON iasdpi_admin_private.account_creation_requests AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.iasdpi_session_allowed()) WITH CHECK(public.iasdpi_session_allowed());
REVOKE ALL ON iasdpi_admin_private.account_creation_requests FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON iasdpi_admin_private.account_creation_requests TO iasdpi_church_executor;
CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_admin_private.account_creation_requests
 FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church();

-- Último acesso é opcional; o stub local de Auth não tem essa coluna.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='auth.users'::regclass AND attname='last_sign_in_at' AND NOT attisdropped) THEN
  EXECUTE 'CREATE VIEW iasdpi_admin_private.account_activity WITH(security_barrier=true) AS SELECT id,last_sign_in_at FROM auth.users';
 ELSE EXECUTE 'CREATE VIEW iasdpi_admin_private.account_activity WITH(security_barrier=true) AS SELECT id,NULL::timestamptz last_sign_in_at FROM auth.users';END IF;
END $$;
REVOKE ALL ON iasdpi_admin_private.account_activity FROM public,anon,authenticated,service_role;
GRANT SELECT ON iasdpi_admin_private.account_activity TO iasdpi_church_executor;

ALTER FUNCTION public.iasdpi_governance_catalog() SET SCHEMA iasdpi_admin_private;
ALTER FUNCTION iasdpi_admin_private.iasdpi_governance_catalog() RENAME TO catalog_before_027;
REVOKE ALL ON FUNCTION iasdpi_admin_private.catalog_before_027() FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_governance_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 PERFORM iasdpi_admin_private.require_admin();result:=iasdpi_admin_private.catalog_before_027();
 RETURN result||jsonb_build_object('administration_version',11,
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'version',p.version,'active',p.active,'auth_user_id',p.auth_user_id,
 'memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'department_id',m.department_id,'department',d.name,'is_ministry_head',m.is_ministry_head,'active',m.active)),'[]') FROM public.schedule_memberships m JOIN public.schedule_departments d ON d.id=m.department_id WHERE m.person_id=p.id)) ORDER BY p.display_name)
 FROM public.schedule_people p WHERE p.merged_into IS NULL),'[]'),
 'account_plan',public.iasdpi_responsibility_account_plan(),
 'pending_accounts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'person_id',r.person_id,'identifier',r.identifier,'created_at',r.created_at)) FROM iasdpi_admin_private.account_creation_requests r WHERE status='pending'),'[]'),
 'users',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',x.uid,'name',coalesce(p.display_name,old->>'name','Conta '||left(x.uid::text,8)),
 'person_id',p.id,'person_version',p.version,'role',old->>'role','status',coalesce(old->>'status',(SELECT status FROM iasdpi_admin_private.identity_states WHERE user_id=x.uid),'active'),
 'reset_blocked',coalesce((old->>'reset_blocked')::boolean,false),'must_change_password',coalesce((SELECT must_change_password FROM iasdpi_governance_private.identity_epochs WHERE user_id=x.uid),false),
 'last_sign_in_at',(SELECT last_sign_in_at FROM iasdpi_admin_private.account_activity WHERE id=x.uid),
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.department_id,'name',d.name,'status',a.status,'kind',a.responsibility_kind)) FROM public.schedule_department_access a JOIN public.schedule_departments d ON d.id=a.department_id WHERE a.user_id=x.uid),'[]')) ORDER BY coalesce(p.display_name,old->>'name'))
 FROM (SELECT (u->>'user_id')::uuid uid FROM jsonb_array_elements(result->'users') u UNION SELECT auth_user_id FROM public.schedule_people WHERE auth_user_id IS NOT NULL AND merged_into IS NULL) x
 LEFT JOIN public.schedule_people p ON p.auth_user_id=x.uid AND p.merged_into IS NULL
 LEFT JOIN LATERAL (SELECT u old FROM jsonb_array_elements(result->'users') u WHERE u->>'user_id'=x.uid::text) prior ON true),'[]'));
END $$;

CREATE FUNCTION public.iasdpi_account_link(p_person uuid,p_expected_version bigint,p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE p public.schedule_people;BEGIN
 PERFORM iasdpi_admin_private.lock_admin();SELECT * INTO p FROM public.schedule_people WHERE id=p_person FOR UPDATE;
 IF p.id IS NULL OR NOT p.active OR p.merged_into IS NOT NULL OR p.auth_user_id IS NOT NULL AND p.auth_user_id<>p_user
 OR EXISTS(SELECT 1 FROM public.schedule_people WHERE auth_user_id=p_user AND id<>p_person)
 OR NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=p_user AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN
 RAISE EXCEPTION 'Pessoa ou identidade incompatível; reutilize o cadastro existente, sem duplicar vínculos.' USING errcode='23514';END IF;
 RETURN public.iasdpi_schedule_save('person',p_person,p_expected_version,jsonb_build_object('auth_user_id',p_user),gen_random_uuid());
END $$;
CREATE FUNCTION public.iasdpi_account_state_save(p_user uuid,p_status text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_admin_private.lock_admin();
 IF EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user) OR EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=p_user) THEN
  PERFORM public.iasdpi_identity_state_save(p_user,p_status,p_reason);RETURN;END IF;
 IF p_status NOT IN('active','suspended','revoked') OR coalesce(length(btrim(p_reason)),0)<10
 OR NOT EXISTS(SELECT 1 FROM public.schedule_people WHERE auth_user_id=p_user AND merged_into IS NULL) THEN RAISE EXCEPTION 'Identidade, situação ou motivo inválido.' USING errcode='42501';END IF;
 INSERT INTO iasdpi_admin_private.identity_states(user_id,status,updated_by) VALUES(p_user,p_status,u)
 ON CONFLICT(church_id,user_id) DO UPDATE SET status=excluded.status,version=identity_states.version+1,updated_at=now(),updated_by=u;
END $$;
CREATE FUNCTION public.iasdpi_account_create_begin(p_id uuid,p_person uuid,p_expected_version bigint,p_identifier text,p_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;p public.schedule_people;r iasdpi_admin_private.account_creation_requests;BEGIN
 u:=iasdpi_admin_private.lock_admin();p_identifier:=lower(btrim(p_identifier));p_email:=lower(btrim(p_email));
 IF p_id IS NULL OR p_identifier IS NULL OR p_identifier !~ '^[a-z][a-z0-9._-]{2,63}$' OR p_email IS NULL OR length(p_email)>254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Identificador, e-mail institucional e solicitação necessários.' USING errcode='22023';END IF;
 SELECT * INTO r FROM iasdpi_admin_private.account_creation_requests WHERE id=p_id;
 IF FOUND THEN
  IF r.actor_id<>u OR r.person_id<>p_person OR r.person_version<>p_expected_version OR r.identifier<>p_identifier OR r.email<>p_email THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='23514';END IF;
  IF r.status='cancelled' THEN RAISE EXCEPTION 'Tentativa encerrada; inicie uma nova solicitação.' USING errcode='23514';END IF;
  RETURN jsonb_build_object('completed',r.status='completed','person_id',r.person_id,'user_id',r.user_id,'name',(SELECT display_name FROM public.schedule_people WHERE id=r.person_id));END IF;
 SELECT * INTO p FROM public.schedule_people WHERE id=p_person FOR UPDATE;
 IF p.id IS NULL OR p.version<>p_expected_version THEN RAISE EXCEPTION 'Cadastro alterado; atualize antes de criar a conta.' USING errcode='40001';END IF;
 IF NOT p.active OR p.merged_into IS NOT NULL OR p.auth_user_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=p.id AND active)
 OR EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE lower(email)=p_email)
 OR EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE identifier=p_identifier AND user_id IS NOT NULL) THEN
 RAISE EXCEPTION 'Reutilize a conta existente ou confirme cadastro, vínculo e identificador antes de criar.' USING errcode='23514';END IF;
 INSERT INTO iasdpi_admin_private.account_creation_requests(id,person_id,person_version,actor_id,identifier,email) VALUES(p_id,p.id,p.version,u,p_identifier,p_email);
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'account_creation_requested',p.id,jsonb_build_object('entity','account','request_id',p_id));
 RETURN jsonb_build_object('completed',false,'person_id',p.id,'name',p.display_name);
END $$;
CREATE FUNCTION public.iasdpi_account_create_finish(p_id uuid,p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;r iasdpi_admin_private.account_creation_requests;v bigint;BEGIN
 u:=iasdpi_admin_private.lock_admin();SELECT * INTO r FROM iasdpi_admin_private.account_creation_requests WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.actor_id<>u THEN RAISE EXCEPTION 'Solicitação fora do alcance.' USING errcode='42501';END IF;
 IF r.status='completed' THEN IF r.user_id<>p_user THEN RAISE EXCEPTION 'Identidade divergente.';END IF;RETURN jsonb_build_object('completed',true,'user_id',r.user_id,'person_id',r.person_id);END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Tentativa encerrada; associação não realizada.' USING errcode='40001';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=p_user AND lower(email)=r.email AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN RAISE EXCEPTION 'Conta Auth não confirmada ou divergente.' USING errcode='23514';END IF;
 PERFORM public.iasdpi_account_link(r.person_id,r.person_version,p_user);
 SELECT coalesce((SELECT version FROM iasdpi_admin_private.login_aliases WHERE identifier=r.identifier),0) INTO v;
 IF EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE identifier=r.identifier AND user_id IS NOT NULL AND user_id<>p_user) THEN RAISE EXCEPTION 'Apelido vinculado por outra operação.' USING errcode='40001';END IF;
 PERFORM public.iasdpi_alias_save(r.identifier,p_user,true,v,'Criação individual confirmada pelo administrador');
 PERFORM public.iasdpi_require_password_change(p_user,'Credencial provisória individual de primeiro acesso');
 UPDATE iasdpi_admin_private.account_creation_requests SET status='completed',user_id=p_user,completed_at=now() WHERE id=p_id;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'account_created',p_user,jsonb_build_object('entity','account','person_id',r.person_id));
 RETURN jsonb_build_object('completed',true,'user_id',p_user,'person_id',r.person_id);
END $$;

CREATE FUNCTION public.iasdpi_account_creation_cancel(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_admin_private.lock_admin();
 UPDATE iasdpi_admin_private.account_creation_requests SET status='cancelled' WHERE id=p_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa não está pendente.' USING errcode='40001';END IF;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'account_creation_cancelled',p_id,'{"entity":"account"}');
END $$;
CREATE FUNCTION public.iasdpi_governance_permission_save(p_department uuid,p_user uuid,p_kind text,p_flags jsonb,p_status text,p_expected_version bigint,p_approve_general boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r jsonb;m uuid;BEGIN
 PERFORM iasdpi_admin_private.lock_admin();
 IF p_kind IS NULL OR p_kind NOT IN('manual','leader','elder') OR p_approve_general IS NULL OR jsonb_typeof(p_flags) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Perfil ou permissões inválidos.' USING errcode='22023';END IF;
 IF p_status='active' AND p_kind<>'manual' THEN
  SELECT m.id INTO m FROM public.schedule_memberships m JOIN public.schedule_people p ON p.id=m.person_id WHERE p.auth_user_id=p_user AND m.department_id=p_department AND m.active;
  r:=public.iasdpi_responsibility_access_save(p_department,p_user,m,p_kind,p_approve_general,p_expected_version,'Responsabilidade conferida pelo administrador no Cadastro Geral');
  RETURN public.iasdpi_department_access_save(p_department,p_user,(p_flags-ARRAY['access','requests'])||'{"access":false,"requests":false}'::jsonb,p_status,(r->>'version')::bigint);
 END IF;
 IF p_approve_general AND p_kind='manual' THEN RAISE EXCEPTION 'Aprovação exige Ancionato confirmado.' USING errcode='23514';END IF;
 r:=public.iasdpi_department_access_save(p_department,p_user,(p_flags-ARRAY['access','requests'])||'{"access":false,"requests":false}'::jsonb,p_status,p_expected_version);
 IF p_status='active' THEN UPDATE public.schedule_department_access SET responsibility_kind='manual',responsibility_membership_id=NULL,responsibility_confirmed_by=NULL,responsibility_confirmed_at=NULL,can_approve_general_events=false WHERE id=(r->>'id')::uuid RETURNING to_jsonb(schedule_department_access) INTO r;END IF;
 RETURN r;
END $$;

CREATE FUNCTION public.iasdpi_event_reject(p_id uuid,p_expected_version bigint,p_reason text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;e public.iasdpi_events;r iasdpi_operational_private.receipts;sig text;result jsonb;parent public.iasdpi_event_series;BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_admin_private.can_approve_general(u) THEN RAISE EXCEPTION 'Rejeição exige ancião autorizado ou administrador.' USING errcode='42501';END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR coalesce(length(btrim(p_reason)),0)<10 OR length(p_reason)>500 THEN RAISE EXCEPTION 'Informe registro, versão e motivo da rejeição.' USING errcode='22023';END IF;
 sig:='event-reject-027:'||iasdpi_operational_private.fingerprint(jsonb_build_array(p_id,p_expected_version,p_reason));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.';END IF;RETURN r.response;END IF;
 SELECT * INTO e FROM public.iasdpi_events WHERE id=p_id FOR UPDATE;
 IF e.id IS NULL OR e.program_category<>'general' OR e.approval_status<>'pending' OR e.status<>'draft' THEN RAISE EXCEPTION 'Evento não está aguardando decisão.' USING errcode='23514';END IF;
 IF e.version<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado; revise antes de rejeitar.' USING errcode='40001';END IF;
 UPDATE public.iasdpi_events SET approval_status='rejected',version=version+1,updated_by=u,updated_at=now() WHERE id=p_id RETURNING * INTO e;
 INSERT INTO public.iasdpi_event_versions VALUES(e.church_id,e.id,e.version,u,now(),e.status,to_jsonb(e));
 IF e.series_id IS NOT NULL THEN
 UPDATE public.iasdpi_event_series SET version=version+1,approval_status=iasdpi_schedule_private.series_approval_state(e.series_id),updated_by=u,updated_at=now() WHERE id=e.series_id RETURNING * INTO parent;
 INSERT INTO public.iasdpi_event_series_versions VALUES(parent.church_id,parent.id,parent.version,u,now(),to_jsonb(parent));END IF;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'event_rejected',e.id,jsonb_build_object('entity','event','before',jsonb_build_object('approval_status','pending'),'after',jsonb_build_object('approval_status','rejected'),'version',e.version));
 result:=to_jsonb(e);INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN('iasdpi_governance_catalog','iasdpi_account_link','iasdpi_account_state_save','iasdpi_account_create_begin','iasdpi_account_create_finish','iasdpi_account_creation_cancel','iasdpi_governance_permission_save','iasdpi_event_reject') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
