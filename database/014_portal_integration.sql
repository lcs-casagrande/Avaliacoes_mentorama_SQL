-- G4: funções de integração, sem alterar registros ou permissões existentes.
-- Revisar após 001–013 completas; NÃO executado automaticamente.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_governance_catalog()') IS NULL OR to_regclass('iasdpi_governance_private.identity_epochs') IS NULL THEN RAISE EXCEPTION 'Exige postgres e G1–G3 completas.';END IF;
 IF to_regprocedure('public.iasdpi_schedule_published(date)') IS NOT NULL THEN RAISE EXCEPTION '014 já instalada; revisar sem sobrescrever.';END IF;
END $$;
-- Projeção pública estrita da última versão efetivamente publicada.
-- Uma revisão em rascunho nunca entra nesta consulta, nem substitui a versão aprovada.
CREATE FUNCTION public.iasdpi_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1000-01-01' OR p_month>'9998-12-01' THEN RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';END IF;
 RETURN coalesce((WITH published AS (
 SELECT p.id,p.department_id,d.name department,v.version,v.captured_at,v.snapshot
 FROM public.schedule_plans p JOIN public.schedule_departments d ON d.id=p.department_id AND d.active
 CROSS JOIN LATERAL (SELECT x.version,x.captured_at,x.snapshot FROM public.schedule_versions x
 WHERE x.plan_id=p.id AND x.snapshot->>'status'='published' ORDER BY x.version DESC LIMIT 1) v
 WHERE p.month=p_month AND p.church_id=public.iasdpi_current_church_id()
 ), rows AS (
 SELECT pub.id plan_id,pub.department_id,pub.department,pub.version,pub.captured_at,
 e.scheduled_on,e.title event_title,e.starts_at,e.ends_at,r.name role,p.display_name person,a->>'id' assignment_id
 FROM published pub CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(pub.snapshot->'requirements')='array' THEN pub.snapshot->'requirements' ELSE '[]'::jsonb END) req
 JOIN public.schedule_events e ON e.id::text=req->>'event_id' AND e.scheduled_on>=p_month AND e.scheduled_on<(p_month+interval '1 month')::date
 JOIN public.schedule_roles r ON r.id::text=req->>'role_id' AND r.department_id=pub.department_id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(req->'assignments')='array' THEN req->'assignments' ELSE '[]'::jsonb END) a
 JOIN public.schedule_people p ON p.id::text=a->>'person_id'
 ) SELECT jsonb_agg(jsonb_build_object('id','published:'||plan_id::text||':'||coalesce(assignment_id,person||scheduled_on::text||role),
 'date',scheduled_on,'department_id',department_id,'department',department,'person',person,'role',role,
 'event',event_title,'starts_at',starts_at,'ends_at',ends_at,'version',version,'published_at',captured_at,'origin','Escala publicada no sistema')
 ORDER BY scheduled_on,department,person,assignment_id) FROM rows),'[]'::jsonb);
END $$;
GRANT CREATE ON SCHEMA public TO iasdpi_church_executor;
ALTER FUNCTION public.iasdpi_schedule_published(date) OWNER TO iasdpi_church_executor;
REVOKE CREATE ON SCHEMA public FROM iasdpi_church_executor;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_published(date) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_published(date) TO anon,authenticated;
-- Contexto mínimo para navegação; não devolve pessoas, contatos ou rascunhos.
CREATE FUNCTION public.iasdpi_portal_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();c jsonb;BEGIN
 c:=public.iasdpi_schedule_catalog();
 RETURN jsonb_build_object('actor_id',u,'is_admin',iasdpi_schedule_private.is_admin(u),'departments',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',d->>'id','code',d->>'code','name',d->>'name','active',(d->>'active')::boolean,
 'can_edit',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'edit'),
 'can_publish',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'publish'),
 'can_manage_members',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'members'),
 'can_manage_access',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'access'),
 'can_handle_requests',iasdpi_schedule_private.has_capability(u,(d->>'id')::uuid,'requests')))
 FROM jsonb_array_elements(c->'departments') d),'[]'::jsonb));
END $$;
GRANT CREATE ON SCHEMA public TO iasdpi_church_executor;
ALTER FUNCTION public.iasdpi_portal_context() OWNER TO iasdpi_church_executor;
REVOKE CREATE ON SCHEMA public FROM iasdpi_church_executor;
REVOKE ALL ON FUNCTION public.iasdpi_portal_context() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_portal_context() TO authenticated;
-- Ponte de contexto: retorna SOMENTE igrejas autorizadas para auth.uid().
-- postgres é necessário para consultar as próprias associações entre igrejas;
-- não aceita user_id, não concede papéis e não devolve membros/contatos.
CREATE FUNCTION public.iasdpi_my_churches() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=auth.uid();BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false))
 OR EXISTS(SELECT 1 FROM iasdpi_governance_private.identity_epochs WHERE user_id=u AND (blocked OR (minimum_iat>0 AND minimum_iat>=coalesce((auth.jwt()->>'iat')::bigint,0)))) THEN RAISE EXCEPTION 'Entre novamente com uma identidade autorizada.' USING errcode='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'is_admin',EXISTS(SELECT 1 FROM public.iasdpi_access a WHERE a.church_id=c.id AND a.user_id=u AND a.enabled AND a.role='admin')) ORDER BY c.name,c.code)
 FROM public.iasdpi_churches c WHERE c.active AND c.listed
 AND NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.identity_states s WHERE s.church_id=c.id AND s.user_id=u AND s.status<>'active')
 AND NOT EXISTS(SELECT 1 FROM public.iasdpi_access a WHERE a.church_id=c.id AND a.user_id=u AND NOT a.enabled)
 AND (EXISTS(SELECT 1 FROM public.iasdpi_access a WHERE a.church_id=c.id AND a.user_id=u AND a.enabled)
 OR EXISTS(SELECT 1 FROM public.schedule_department_access a WHERE a.church_id=c.id AND a.user_id=u AND a.enabled AND a.status='active' AND a.can_view AND EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.church_id=c.id AND d.id=a.department_id AND d.active))
 OR EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.church_id=p.church_id AND m.person_id=p.id JOIN public.schedule_departments d ON d.church_id=m.church_id AND d.id=m.department_id AND d.active WHERE p.church_id=c.id AND p.auth_user_id=u AND p.active AND m.active AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access a WHERE a.church_id=c.id AND a.user_id=u AND a.department_id=m.department_id AND (NOT a.enabled OR a.status<>'active'))))),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.iasdpi_my_churches() FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_my_churches() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
