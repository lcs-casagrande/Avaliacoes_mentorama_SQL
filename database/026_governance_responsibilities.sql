-- G10.3: revisão após 001–025; não aplicar no Supabase real nesta etapa.
-- Não cria contas, credenciais ou permissões a partir de nomes/participação.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('iasdpi_schedule_private.iasdpi_events_catalog_before_025()') IS NULL THEN RAISE EXCEPTION 'Exige postgres e cadeia 001–025 revisada.';END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.schedule_department_access'::regclass AND attname='responsibility_kind' AND NOT attisdropped) THEN RAISE EXCEPTION '026 já instalada; não reaplicar.';END IF;
END $$;
ALTER TABLE public.schedule_memberships ADD CONSTRAINT memberships_church_identity_026 UNIQUE(church_id,id);
ALTER TABLE public.schedule_department_access
 ADD COLUMN responsibility_kind text NOT NULL DEFAULT 'manual' CHECK(responsibility_kind IN('manual','leader','elder')),
 ADD COLUMN responsibility_membership_id uuid,
 ADD COLUMN responsibility_confirmed_by uuid REFERENCES auth.users(id),
 ADD COLUMN responsibility_confirmed_at timestamptz,
 ADD COLUMN can_approve_general_events boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT responsibility_membership_scope FOREIGN KEY(church_id,responsibility_membership_id) REFERENCES public.schedule_memberships(church_id,id),
 ADD CONSTRAINT responsibility_evidence CHECK((responsibility_kind='manual' AND responsibility_membership_id IS NULL AND NOT can_approve_general_events)
 OR (responsibility_kind IN('leader','elder') AND responsibility_membership_id IS NOT NULL AND responsibility_confirmed_by IS NOT NULL AND responsibility_confirmed_at IS NOT NULL));
ALTER TABLE iasdpi_governance_private.identity_epochs ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
CREATE FUNCTION iasdpi_admin_private.responsibility_active(u uuid,d uuid,k text DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_admin_private.identity_active(u) AND EXISTS(
 SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_memberships m ON m.id=a.responsibility_membership_id AND m.department_id=a.department_id
 JOIN public.schedule_people p ON p.id=m.person_id JOIN public.schedule_departments dep ON dep.id=a.department_id
 WHERE a.user_id=u AND a.department_id=d AND a.enabled AND a.status='active' AND dep.active AND p.active AND m.active AND p.auth_user_id=u
 AND a.responsibility_kind IN('leader','elder') AND (k IS NULL OR a.responsibility_kind=k)
 AND (a.responsibility_kind<>'leader' OR m.is_ministry_head)
 AND (a.responsibility_kind<>'elder' OR dep.code='ancionato' OR EXISTS(
 SELECT 1 FROM public.schedule_department_access elder_acl JOIN public.schedule_departments elder_dep ON elder_dep.id=elder_acl.department_id
 JOIN public.schedule_memberships elder_member ON elder_member.id=elder_acl.responsibility_membership_id AND elder_member.person_id=p.id AND elder_member.active
 WHERE elder_acl.user_id=u AND elder_dep.code='ancionato' AND elder_dep.active AND elder_acl.responsibility_kind='elder' AND elder_acl.enabled AND elder_acl.status='active')));
$$;
CREATE FUNCTION iasdpi_admin_private.can_approve_general(u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_departments d ON d.id=a.department_id
 WHERE a.user_id=u AND d.code='ancionato' AND a.can_approve_general_events AND iasdpi_admin_private.responsibility_active(u,d.id,'elder'));
$$;
CREATE FUNCTION iasdpi_admin_private.has_confirmed_responsibility(u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE iasdpi_admin_private.responsibility_active(u,d.id));
$$;
-- O administrador confirma a responsabilidade existente; a RPC reutiliza pessoa,
-- vínculo e ACL. Nunca cria Cadastro Geral, usuário Auth ou habilitação.
CREATE FUNCTION public.iasdpi_responsibility_access_save(p_department uuid,p_user uuid,p_membership uuid,p_kind text,p_approve_general boolean,p_expected_version bigint,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; m public.schedule_memberships; d public.schedule_departments; result jsonb;BEGIN
 u:=iasdpi_admin_private.lock_admin();PERFORM iasdpi_admin_private.require_admin();
 IF p_kind NOT IN('leader','elder') OR p_approve_general IS NULL OR coalesce(length(btrim(p_reason)),0)<10 THEN RAISE EXCEPTION 'Confirme responsabilidade e justificativa.' USING errcode='22023';END IF;
 SELECT * INTO m FROM public.schedule_memberships WHERE id=p_membership AND department_id=p_department AND active FOR UPDATE;
 SELECT * INTO d FROM public.schedule_departments WHERE id=p_department AND active;
 IF m.id IS NULL OR d.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.schedule_people WHERE id=m.person_id AND auth_user_id=p_user AND active) THEN RAISE EXCEPTION 'Vínculo central e identidade confirmada necessários.' USING errcode='23514';END IF;
 IF p_kind='leader' AND NOT m.is_ministry_head THEN RAISE EXCEPTION 'Responsabilidade ministerial não confirmada no Organograma.' USING errcode='23514';END IF;
 IF p_kind='elder' AND d.code<>'ancionato' AND NOT EXISTS(SELECT 1 FROM public.schedule_departments x WHERE x.code='ancionato' AND iasdpi_admin_private.responsibility_active(p_user,x.id,'elder')) THEN RAISE EXCEPTION 'Confirme primeiro a responsabilidade individual no Ancionato.' USING errcode='23514';END IF;
 IF p_approve_general AND (p_kind<>'elder' OR d.code<>'ancionato') THEN RAISE EXCEPTION 'Aprovação geral exige Ancionato explicitamente autorizado.' USING errcode='23514';END IF;
 result:=public.iasdpi_department_access_save(p_department,p_user,'{"view":true,"edit":true,"publish":true,"access":false,"requests":false}', 'active',p_expected_version);
 UPDATE public.schedule_department_access SET responsibility_kind=p_kind,responsibility_membership_id=p_membership,responsibility_confirmed_by=u,responsibility_confirmed_at=clock_timestamp(),can_approve_general_events=p_approve_general WHERE id=(result->>'id')::uuid RETURNING to_jsonb(schedule_department_access) INTO result;
 RETURN result;
END $$;
-- Liderança não cria nem concede acessos; delegações antigas ficam sem efeito
-- nos caminhos administrativos, sem apagar seus registros históricos.
CREATE OR REPLACE FUNCTION iasdpi_admin_private.can_review(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_schedule_private.is_admin(u); $$;
CREATE OR REPLACE FUNCTION iasdpi_admin_private.can_reset(u uuid,target uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u IS DISTINCT FROM target AND iasdpi_schedule_private.is_admin(u) AND target IS NOT NULL
 AND NOT iasdpi_governance_private.has_other_church(target,public.iasdpi_current_church_id());
$$;
-- OID preservado: reforça também todos os kernels antigos que usam este helper.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.has_capability(uuid,uuid,text)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.has_capability(','FUNCTION iasdpi_schedule_private.has_capability_before_026(');
END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.has_capability(u uuid,d uuid,cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN cap IN('access','requests') THEN iasdpi_schedule_private.is_admin(u)
 ELSE iasdpi_schedule_private.has_capability_before_026(u,d,cap) AND NOT EXISTS(
 SELECT 1 FROM public.schedule_department_access a WHERE a.user_id=u AND a.department_id=d AND a.responsibility_kind<>'manual' AND NOT iasdpi_admin_private.responsibility_active(u,d)) END;
$$;
-- Troca obrigatória só é habilitada explicitamente, por administrador, em conta
-- individual já provisionada no Auth por procedimento autorizado separado.
CREATE FUNCTION public.iasdpi_require_password_change(p_user uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_admin_private.lock_admin();IF coalesce(length(btrim(p_reason)),0)<10 OR p_user=u OR NOT iasdpi_admin_private.alias_identity_allowed(p_user) THEN RAISE EXCEPTION 'Conta, responsável ou motivo inválido.' USING errcode='23514';END IF;
 PERFORM iasdpi_admin_private.lock_identity(p_user);
 UPDATE iasdpi_governance_private.identity_epochs SET must_change_password=true WHERE user_id=p_user;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(u,'temporary_password_required',p_user,'{}');
END $$;
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('public.iasdpi_session_allowed()'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_session_allowed(','FUNCTION iasdpi_admin_private.session_allowed_before_026(');
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_session_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_admin_private.session_allowed_before_026() AND NOT EXISTS(SELECT 1 FROM iasdpi_governance_private.identity_epochs WHERE user_id=auth.uid() AND must_change_password);
$$;
CREATE FUNCTION public.iasdpi_password_change_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=auth.uid();BEGIN
 IF NOT iasdpi_admin_private.session_allowed_before_026() OR NOT iasdpi_admin_private.alias_identity_allowed(u) OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN RAISE EXCEPTION 'Sessão individual autorizada necessária.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('must_change_password',coalesce((SELECT must_change_password FROM iasdpi_governance_private.identity_epochs WHERE user_id=u),false),'aliases',coalesce((SELECT jsonb_agg(identifier) FROM iasdpi_admin_private.login_aliases WHERE user_id=u),'[]'));
END $$;
CREATE FUNCTION public.iasdpi_password_change_confirm(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor seguro necessário.' USING errcode='42501';END IF;
 IF NOT iasdpi_admin_private.alias_identity_allowed(p_user) THEN RAISE EXCEPTION 'Identidade fora do alcance.' USING errcode='42501';END IF;
 PERFORM iasdpi_admin_private.lock_identity(p_user);
 UPDATE iasdpi_governance_private.identity_epochs SET must_change_password=false,minimum_iat=greatest(minimum_iat,floor(extract(epoch FROM clock_timestamp()))::bigint),updated_at=now() WHERE user_id=p_user;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(p_user,'own_password_changed',p_user,'{}');
END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.event_can(u uuid,category text,department uuid,cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR (category='department' AND department IS NOT NULL AND iasdpi_schedule_private.has_capability(u,department,cap))
 OR (category='church' AND cap IN('view','edit','publish') AND iasdpi_admin_private.has_confirmed_responsibility(u));
$$;
CREATE FUNCTION iasdpi_schedule_private.series_approval_state(p_series uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.iasdpi_events WHERE series_id=p_series AND approval_status='pending' AND status='draft') THEN 'pending'
 WHEN EXISTS(SELECT 1 FROM public.iasdpi_events WHERE series_id=p_series AND approval_status='approved' AND status='published') THEN 'approved' ELSE 'not_required' END;
$$;
-- Patches mínimos sobre os kernels 025, preservando OIDs, reservas, CAS e igreja.
DO $patch$ DECLARE body text;old text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.event_store(','FUNCTION iasdpi_schedule_private.event_store_before_026(');
 old:='result jsonb;needs_edit boolean;conflicts jsonb;period tstzrange;BEGIN';
 IF strpos(body,old)=0 OR strpos(body,'e.approval_status:=''not_required''; -- 025:')=0 THEN RAISE EXCEPTION 'Kernel 025 incompatível.';END IF;
 body:=replace(body,old,'result jsonb;needs_edit boolean;conflicts jsonb;period tstzrange;approval_execution boolean;BEGIN');
 old:=' needs_edit:=old.id IS NULL';
 body:=replace(body,old,' approval_execution:=coalesce(p_pending,false) AND old.id IS NOT NULL AND old.program_category=''general'' AND old.approval_status=''pending'' AND p_patch='' {"status":"published"}''::jsonb AND iasdpi_admin_private.can_approve_general(u);'||chr(10)||
 ' IF e.category=''church'' AND e.program_category IS DISTINCT FROM ''general'' AND NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION ''Somente administrador gerencia atividade geral sem classificação confirmada.'' USING errcode=''42501'';END IF;'||chr(10)||
 ' IF old.id IS NOT NULL AND old.category=''church'' AND old.created_by<>u AND NOT approval_execution AND NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION ''Evento geral de outra identidade.'' USING errcode=''42501'';END IF;'||chr(10)||old);
 body:=replace(body,'IF (needs_edit AND (','IF (NOT approval_execution AND needs_edit AND (');
 body:=replace(body,'OR (e.status IN(''published'',''cancelled'') AND (','OR (NOT approval_execution AND e.status IN(''published'',''cancelled'') AND (');
 body:=replace(body,'e.approval_status:=''not_required''; -- 025: publicação direta, sem reescrever versões anteriores.',
 'IF e.program_category=''general'' AND e.status=''published'' THEN IF iasdpi_admin_private.can_approve_general(u) THEN e.approval_status:=''approved'';ELSE e.approval_status:=''pending'';e.status:=''draft'';END IF;ELSE e.approval_status:=''not_required'';END IF;');
 EXECUTE body;
 body:=pg_get_functiondef('public.iasdpi_event_submit(uuid,bigint,jsonb,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_event_submit(','FUNCTION iasdpi_schedule_private.event_submit_before_026(');
 IF strpos(body,'event-submit-025:')=0 THEN RAISE EXCEPTION 'Submit 025 incompatível.';END IF;
 body:=replace(body,'event-submit-025:','event-submit-026:');
 body:=replace(body,'approval_status=''not_required'' WHERE id=e.series_id','approval_status=iasdpi_schedule_private.series_approval_state(e.series_id) WHERE id=e.series_id');EXECUTE body;
 body:=pg_get_functiondef('public.iasdpi_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_event_series_save(','FUNCTION iasdpi_schedule_private.event_series_save_before_026(');
 IF strpos(body,'event-series-025:')=0 THEN RAISE EXCEPTION 'Série 025 incompatível.';END IF;
 body:=replace(body,'event-series-025:','event-series-026:');
 body:=replace(body,' SELECT * INTO old FROM public.iasdpi_event_series WHERE id=p_id FOR UPDATE;',' SELECT * INTO old FROM public.iasdpi_event_series WHERE id=p_id FOR UPDATE; IF old.id IS NOT NULL AND old.category=''church'' AND old.created_by<>u AND NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION ''Série geral de outra identidade.'' USING errcode=''42501'';END IF;');
 body:=replace(body,' INSERT INTO public.iasdpi_event_series_versions VALUES(c,series.id',
 ' UPDATE public.iasdpi_event_series SET approval_status=iasdpi_schedule_private.series_approval_state(p_id) WHERE id=p_id RETURNING * INTO series;'||chr(10)||' INSERT INTO public.iasdpi_event_series_versions VALUES(c,series.id');EXECUTE body;
END $patch$;
CREATE FUNCTION public.iasdpi_event_approve(p_id uuid,p_expected_version bigint,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;e public.iasdpi_events;result jsonb;parent public.iasdpi_event_series;sig text;r iasdpi_operational_private.receipts;BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_admin_private.can_approve_general(u) THEN RAISE EXCEPTION 'Aprovação exige ancião autorizado ou administrador.' USING errcode='42501';END IF;
 IF p_request_id IS NULL OR p_id IS NULL OR p_expected_version IS NULL THEN RAISE EXCEPTION 'Identificador e versão necessários.' USING errcode='22023';END IF;
 sig:='event-approve-026:'||iasdpi_operational_private.fingerprint(jsonb_build_array(p_id,p_expected_version));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.';END IF;RETURN r.response;END IF;
 SELECT * INTO e FROM public.iasdpi_events WHERE id=p_id FOR UPDATE;
 IF e.id IS NULL OR e.program_category<>'general' OR e.approval_status<>'pending' OR e.status<>'draft' THEN RAISE EXCEPTION 'Evento geral não está aguardando aprovação.' USING errcode='23514';END IF;
 IF e.version<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado; revise antes de aprovar.' USING errcode='40001';END IF;
 result:=iasdpi_schedule_private.event_store(p_id,p_expected_version,'{"status":"published"}',gen_random_uuid(),NULL,NULL,true);
 IF e.series_id IS NOT NULL THEN
 UPDATE public.iasdpi_event_series SET version=version+1,approval_status=iasdpi_schedule_private.series_approval_state(e.series_id),updated_by=u,updated_at=now() WHERE id=e.series_id RETURNING * INTO parent;
 INSERT INTO public.iasdpi_event_series_versions VALUES(parent.church_id,parent.id,parent.version,u,now(),to_jsonb(parent));END IF;
 result:=result-ARRAY['reservation_conflicts'];
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
-- O catálogo existente é reutilizado; inclui fila geral somente ao aprovador.
ALTER FUNCTION public.iasdpi_events_catalog() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_events_catalog() RENAME TO events_catalog_before_026;
CREATE FUNCTION public.iasdpi_events_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor();c jsonb:=iasdpi_schedule_private.events_catalog_before_026();BEGIN
 RETURN c||jsonb_build_object('event_approval_required',true,'can_approve_general',iasdpi_admin_private.can_approve_general(u),
 'can_submit_general',iasdpi_schedule_private.is_admin(u) OR iasdpi_admin_private.has_confirmed_responsibility(u),
 'series',coalesce((SELECT jsonb_agg(item) FROM jsonb_array_elements(coalesce(c->'series','[]')) item
 WHERE iasdpi_schedule_private.is_admin(u) OR item->>'category'='department' AND iasdpi_schedule_private.can_view(u,(item->>'department_id')::uuid)
 OR item->>'category'='church' AND item->>'created_by'=u::text
 OR iasdpi_admin_private.can_approve_general(u) AND EXISTS(SELECT 1 FROM public.iasdpi_events e WHERE e.series_id=(item->>'id')::uuid AND e.program_category='general' AND e.approval_status='pending')),'[]'),
 'events',coalesce((SELECT jsonb_agg((to_jsonb(e)-'reservation_conflicts')||jsonb_build_object('can_edit',iasdpi_schedule_private.event_can(u,e.category,e.department_id,'edit') AND (e.category<>'church' OR e.created_by=u OR iasdpi_schedule_private.is_admin(u)),'can_publish',iasdpi_schedule_private.event_can(u,e.category,e.department_id,'publish') AND (e.category<>'church' OR e.created_by=u OR iasdpi_schedule_private.is_admin(u)),'reservation_conflicts',iasdpi_schedule_private.event_conflict_view(e.reservation_conflicts)) ORDER BY e.date,e.title)
 FROM public.iasdpi_events e WHERE iasdpi_schedule_private.is_admin(u)
 OR e.category='department' AND iasdpi_schedule_private.can_view(u,e.department_id)
 OR e.category='church' AND e.created_by=u AND iasdpi_admin_private.has_confirmed_responsibility(u)
 OR e.program_category='general' AND e.approval_status='pending' AND iasdpi_admin_private.can_approve_general(u)),'[]'));
END $$;
-- Histórico de registro não amplia o alcance de outro líder pelo conhecimento de um UUID.
ALTER FUNCTION public.iasdpi_event_history(uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_event_history(uuid) RENAME TO event_history_before_026;
CREATE FUNCTION public.iasdpi_event_history(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();e public.iasdpi_events;BEGIN
 SELECT * INTO e FROM public.iasdpi_events WHERE id=p_id;
 IF e.id IS NULL OR NOT(iasdpi_schedule_private.is_admin(u) OR e.category='department' AND iasdpi_schedule_private.can_view(u,e.department_id) OR e.category='church' AND e.created_by=u AND iasdpi_admin_private.has_confirmed_responsibility(u)) THEN RAISE EXCEPTION 'Histórico fora do alcance.' USING errcode='42501';END IF;
 RETURN iasdpi_schedule_private.event_history_before_026(p_id);
END $$;
DO $$ DECLARE body text;old text:='WHEN iasdpi_schedule_private.event_can(auth.uid(),e.category,e.department_id,''view'') THEN e.title';BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.event_conflict_view(jsonb)'::regprocedure);
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Projeção de conflito incompatível.';END IF;
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.event_conflict_view(','FUNCTION iasdpi_schedule_private.event_conflict_view_before_026(');
 EXECUTE replace(body,old,'WHEN iasdpi_schedule_private.event_can(auth.uid(),e.category,e.department_id,''view'') AND (e.category<>''church'' OR e.created_by=auth.uid() OR iasdpi_schedule_private.is_admin(auth.uid()) OR e.program_category=''general'' AND e.approval_status=''pending'' AND iasdpi_admin_private.can_approve_general(auth.uid())) THEN e.title');
END $$;
-- Valores de auditoria são explicitamente projetados: nunca JSON livre de senha,
-- token, contato, documento de culto ou descrição de evento.
CREATE FUNCTION iasdpi_admin_private.audit_projection(v jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(key,value),'{}') FROM jsonb_each(CASE WHEN jsonb_typeof(v)='object' THEN v ELSE '{}'::jsonb END) WHERE jsonb_typeof(value) IN('string','number','boolean','null') AND key IN
 ('id','user_id','department_id','role','enabled','status','can_view','can_edit','can_publish','can_manage_members','can_manage_access','can_handle_requests','responsibility_kind','responsibility_membership_id','responsibility_confirmed_by','can_approve_general_events','version','date','end_date','start_time','end_time','program_category','is_restricted','approval_status','kind','starts_on','ends_on','person_id');
$$;
CREATE FUNCTION iasdpi_admin_private.access_change_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NOT NULL THEN
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(auth.uid(),TG_TABLE_NAME||'_'||lower(TG_OP),coalesce((to_jsonb(NEW)->>'user_id')::uuid,(to_jsonb(NEW)->>'id')::uuid),
 jsonb_build_object('entity',TG_TABLE_NAME,'before',iasdpi_admin_private.audit_projection(CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END),'after',iasdpi_admin_private.audit_projection(to_jsonb(NEW))));END IF;RETURN NEW;
END $$;
CREATE TRIGGER governance_026_audit AFTER INSERT OR UPDATE ON public.schedule_department_access FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.access_change_audit();
CREATE TRIGGER governance_026_audit AFTER INSERT OR UPDATE ON public.iasdpi_access FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.access_change_audit();
CREATE TRIGGER governance_026_audit AFTER INSERT OR UPDATE ON iasdpi_admin_private.identity_states FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.access_change_audit();
CREATE OR REPLACE FUNCTION public.iasdpi_governance_history(p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_admin_private.require_admin();IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Página inválida.';END IF;
 RETURN coalesce((WITH versions AS(
 SELECT 'event'::text entity,event_id::text target_id,version,actor_id,captured_at created_at,snapshot,lag(snapshot) OVER(PARTITION BY event_id ORDER BY version) previous FROM public.iasdpi_event_versions
 UNION ALL SELECT 'schedule',plan_id::text,version,actor_id,captured_at,snapshot,lag(snapshot) OVER(PARTITION BY plan_id ORDER BY version) FROM public.schedule_versions
 UNION ALL SELECT 'elder',period_id::text,version,actor_id,captured_at,snapshot,lag(snapshot) OVER(PARTITION BY period_id ORDER BY version) FROM public.schedule_elder_versions
 ), records AS(
 SELECT 'access:'||a.id::text id,a.actor_id,a.action,a.target_id::text target_id,a.created_at,
 jsonb_build_object('entity',a.details->>'entity','before',iasdpi_admin_private.audit_projection(a.details->'before'),'after',iasdpi_admin_private.audit_projection(a.details->'after')) details FROM iasdpi_admin_private.audit a
 UNION ALL SELECT entity||':'||target_id||':'||version,actor_id,
 entity||CASE WHEN snapshot->>'approval_status'='pending' THEN '_approval_requested' WHEN snapshot->>'approval_status'='approved' AND snapshot->>'status'='published' THEN '_approved_and_published' ELSE '_'||coalesce(snapshot->>'status','changed') END,target_id,created_at,
 jsonb_build_object('entity',entity,'before',iasdpi_admin_private.audit_projection(previous),'after',iasdpi_admin_private.audit_projection(snapshot)) FROM versions
 UNION ALL SELECT 'registry:'||a.id::text,a.actor_id,a.entity||'_changed',a.entity_id::text,a.captured_at,
 jsonb_build_object('entity',a.entity,'version',a.version,'changed_fields',a.changed_fields) FROM iasdpi_schedule_private.audit_logs a
 ) SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT * FROM records ORDER BY created_at DESC,id LIMIT 50 OFFSET p_offset)x),'[]');
END $$;
-- Sem contas novas: plano administrativo derivado do Cadastro Geral existente.
CREATE FUNCTION public.iasdpi_responsibility_account_plan() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM iasdpi_admin_private.require_admin();
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',p.id,'name',p.display_name,'auth_user_id',p.auth_user_id,
 'suggested_alias',left(public.iasdpi_alias_identifier(p.name),56)||'.iasdpi','requires_identity_confirmation',p.auth_user_id IS NULL,
 'alias_requires_review',EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases a WHERE a.identifier=left(public.iasdpi_alias_identifier(p.name),56)||'.iasdpi' AND (a.user_id IS NULL OR a.user_id IS DISTINCT FROM p.auth_user_id)) OR EXISTS(SELECT 1 FROM public.schedule_people other WHERE other.active AND other.id<>p.id AND left(public.iasdpi_alias_identifier(other.name),56)=left(public.iasdpi_alias_identifier(p.name),56)),
 'departments',(SELECT jsonb_agg(jsonb_build_object('membership_id',m.id,'department_id',m.department_id,'responsible',m.is_ministry_head,'participation_confirmed',m.participation_confirmed)) FROM public.schedule_memberships m WHERE m.person_id=p.id AND m.active AND (m.is_ministry_head OR EXISTS(SELECT 1 FROM public.schedule_department_access a WHERE a.responsibility_membership_id=m.id AND a.responsibility_kind='elder')))) ORDER BY p.display_name)
 FROM public.schedule_people p WHERE p.active AND EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=p.id AND m.active AND (m.is_ministry_head OR EXISTS(SELECT 1 FROM public.schedule_department_access a WHERE a.responsibility_membership_id=m.id AND a.responsibility_kind='elder')))),'[]');
END $$;
DO $$ DECLARE name text;body text;BEGIN
 FOREACH name IN ARRAY ARRAY['iasdpi_department_access_save(uuid,uuid,jsonb,text,bigint)','iasdpi_governance_catalog()'] LOOP
 body:=pg_get_functiondef(('public.'||name)::regprocedure);
 EXECUTE replace(body,'FUNCTION public.'||split_part(name,'(',1)||'(','FUNCTION iasdpi_admin_private.'||split_part(name,'(',1)||'_before_026(');
 IF strpos(lower(body),'begin')=0 THEN RAISE EXCEPTION 'Gate administrativo incompatível.';END IF;
 body:=overlay(body placing 'BEGIN PERFORM iasdpi_admin_private.require_admin();' FROM strpos(lower(body),'begin') FOR 5);EXECUTE body;END LOOP;
END $$;
-- A recuperação supervisionada já troca a senha no Auth e revoga sessões.
DO $$ DECLARE body text;old text:='blocked=NOT p_success,minimum_iat=';BEGIN
 body:=pg_get_functiondef('public.iasdpi_access_reset_finish(uuid,boolean)'::regprocedure);
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Conclusão de recuperação incompatível.';END IF;
 EXECUTE replace(body,'FUNCTION public.iasdpi_access_reset_finish(','FUNCTION iasdpi_admin_private.access_reset_finish_before_026(');
 EXECUTE replace(body,old,'blocked=NOT p_success,must_change_password=CASE WHEN p_success THEN false ELSE must_change_password END,minimum_iat=');
END $$;
-- Gravações e leituras REST diretas também respeitam a troca obrigatória.
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND (n.nspname LIKE 'iasdpi\_%' ESCAPE '\' OR n.nspname='public' AND (c.relname LIKE 'iasdpi\_%' ESCAPE '\' OR c.relname LIKE 'schedule\_%' ESCAPE '\' OR c.relname='culto_archives')) LOOP
 EXECUTE format('CREATE POLICY credential_change_required ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.iasdpi_session_allowed()) WITH CHECK(public.iasdpi_session_allowed())',t.nspname,t.relname);END LOOP;
END $$;
CREATE FUNCTION public.iasdpi_password_change_begin(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' OR NOT iasdpi_admin_private.alias_identity_allowed(p_user) THEN RAISE EXCEPTION 'Servidor e identidade autorizados necessários.' USING errcode='42501';END IF;
 PERFORM iasdpi_admin_private.lock_identity(p_user);
 UPDATE iasdpi_governance_private.identity_epochs SET must_change_password=true,minimum_iat=greatest(minimum_iat,floor(extract(epoch FROM clock_timestamp()))::bigint),updated_at=now() WHERE user_id=p_user;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(p_user,'own_password_change_started',p_user,'{}');
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_admin_private,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('iasdpi_admin_private','iasdpi_schedule_private') AND (p.proname LIKE '%_before_026' OR p.proname IN('responsibility_active','can_approve_general','has_confirmed_responsibility','access_change_audit','audit_projection','series_approval_state'))
 OR n.nspname='public' AND p.proname IN('iasdpi_responsibility_access_save','iasdpi_require_password_change','iasdpi_password_change_context','iasdpi_password_change_begin','iasdpi_password_change_confirm','iasdpi_responsibility_account_plan','iasdpi_event_approve','iasdpi_events_catalog','iasdpi_event_history') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',f.sig,CASE WHEN f.proname IN('iasdpi_password_change_confirm','iasdpi_password_change_begin') THEN 'service_role' ELSE 'authenticated' END);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_admin_private,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
