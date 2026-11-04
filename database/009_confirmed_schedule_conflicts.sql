-- IASDPI B1.2: confirmação antecipada e rascunhos não confirmados.
-- Revisar após 008. Não importa pessoas nem escalas automaticamente.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_schedule_rotation_context(uuid,date)') IS NULL THEN RAISE EXCEPTION 'Instale 001–008 como postgres antes da 009.'; END IF;
END $$;
CREATE TABLE public.schedule_legacy_commitments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_key text NOT NULL UNIQUE CHECK(length(source_key) BETWEEN 1 AND 300),
 person_id uuid NOT NULL REFERENCES public.schedule_people(id),department_id uuid NOT NULL REFERENCES public.schedule_departments(id),
 scheduled_on date NOT NULL,original_name text NOT NULL CHECK(length(original_name) BETWEEN 1 AND 160),
 created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_legacy_commitments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_legacy_commitments FROM public,anon,authenticated;
CREATE INDEX schedule_legacy_person_day ON public.schedule_legacy_commitments(person_id,scheduled_on,department_id);
CREATE VIEW iasdpi_schedule_private.confirmed_days AS
 SELECT a.person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM public.schedule_assignments a
 JOIN public.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) d(day)
 UNION ALL SELECT person_id,department_id,scheduled_on,NULL::uuid,NULL::uuid FROM public.schedule_legacy_commitments;
REVOKE ALL ON iasdpi_schedule_private.confirmed_days FROM public,anon,authenticated;
CREATE FUNCTION iasdpi_schedule_private.monthly_days(a public.schedule_assignments,mon date,in_department boolean) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT count(DISTINCT day) FROM (
 SELECT day FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=a.person_id AND c.plan_id IS DISTINCT FROM a.plan_id AND (NOT in_department OR c.department_id=a.department_id)
 UNION SELECT occupied FROM public.schedule_assignments x CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(x) occupied WHERE x.plan_id=a.plan_id AND x.person_id=a.person_id AND x.id<>a.id
 UNION SELECT occupied FROM iasdpi_schedule_private.assignment_days(a) occupied
 ) days WHERE day>=mon AND day<(mon+interval '1 month')::date;
$$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.validate_daily_assignment(a public.schedule_assignments,p_new boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.schedule_requirements; event public.schedule_events; v_day date; other record; maximum integer; count_days integer; mon date; BEGIN
 SELECT * INTO STRICT req FROM public.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT event FROM public.schedule_events WHERE id=req.event_id;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id
 JOIN public.schedule_qualifications q ON q.membership_id=m.id JOIN public.schedule_roles role ON role.id=q.role_id JOIN public.schedule_departments d ON d.id=m.department_id
 WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active AND m.department_id=a.department_id AND q.role_id=req.role_id) THEN RAISE EXCEPTION 'Voluntário sem habilitação ativa.' USING errcode='23514'; END IF;
 IF a.timing_mode='day' AND a.assigned_on<>event.scheduled_on THEN RAISE EXCEPTION 'Data da atribuição difere do evento.' USING errcode='23514'; END IF;
 IF a.timing_mode='timed' THEN
  IF event.starts_at IS NULL OR a.starts_at<event.starts_at OR a.ends_at>event.ends_at OR a.ends_at<=a.starts_at THEN RAISE EXCEPTION 'Intervalo histórico fora do evento.' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_availability v WHERE v.person_id=a.person_id AND v.active AND v.kind='unavailable'
 AND (v.department_id IS NULL OR v.department_id=req.department_id) AND (
 (v.pattern='period' AND tstzrange((v.starts_on+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))
 OR (v.pattern='weekly' AND EXISTS(SELECT 1 FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 (a.ends_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') AS days(calendar_day)
 WHERE extract(dow FROM calendar_day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR calendar_day::date>=v.valid_from) AND (v.valid_until IS NULL OR calendar_day::date<=v.valid_until)
 AND tstzrange((calendar_day::date+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN calendar_day::date+1 ELSE calendar_day::date END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))))) THEN
  RAISE EXCEPTION 'Conflito: voluntário indisponível no período informado.' USING errcode='23514'; END IF;
 END IF;
 IF p_new OR a.timing_mode='day' THEN
  FOR v_day IN SELECT * FROM iasdpi_schedule_private.assignment_days(a) LOOP
   IF iasdpi_schedule_private.day_availability(a.person_id,a.department_id,v_day)<>'available' THEN RAISE EXCEPTION 'Disponibilidade não confirmada ou pessoa indisponível nesta data. Revise as flags do cadastro.' USING errcode='23514'; END IF;
   FOR other IN SELECT DISTINCT x.department_id FROM iasdpi_schedule_private.confirmed_days x WHERE x.person_id=a.person_id AND x.assignment_id IS DISTINCT FROM a.id AND x.department_id<>a.department_id AND x.day=v_day LOOP
    IF NOT iasdpi_schedule_private.has_day_exception(a.person_id,v_day,a.department_id,other.department_id) THEN RAISE EXCEPTION 'Conflito: pessoa em dois departamentos na mesma data. Somente administrador pode autorizar uma exceção justificada.' USING errcode='23P01'; END IF;
   END LOOP;
   mon:=date_trunc('month',v_day)::date;
   SELECT max_monthly_count INTO maximum FROM public.schedule_people WHERE id=a.person_id;
   SELECT iasdpi_schedule_private.monthly_days(a,mon,false) INTO count_days;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal da pessoa excedido (dias distintos).' USING errcode='23514'; END IF;
   SELECT max_monthly_count INTO maximum FROM public.schedule_memberships WHERE person_id=a.person_id AND department_id=a.department_id;
   SELECT iasdpi_schedule_private.monthly_days(a,mon,true) INTO count_days;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal do vínculo excedido.' USING errcode='23514'; END IF;
  END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor(); result jsonb; current_plan uuid; BEGIN
 IF NOT iasdpi_schedule_private.can_manage(u,p_department) OR NOT EXISTS(
  SELECT 1 FROM public.schedule_departments WHERE id=p_department AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501';
 END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<date '1000-01-01' OR p_month>date '9998-12-01' THEN
  RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';
 END IF;
 SELECT id INTO current_plan FROM public.schedule_plans WHERE department_id=p_department AND month=p_month;
 -- Somente pessoas do departamento solicitado. Conflitos externos são booleanos:
 -- não revelam departamento, nomes, observações ou detalhes das outras escalas.
 WITH occupied AS MATERIALIZED (
  SELECT a.person_id,a.department_id,a.plan_id,d.day,p.status FROM public.schedule_assignments a
  JOIN public.schedule_plans p ON p.id=a.plan_id
  CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) d(day)
  WHERE EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=a.person_id AND m.department_id=p_department)
 UNION ALL SELECT l.person_id,l.department_id,NULL::uuid,l.scheduled_on,'published' FROM public.schedule_legacy_commitments l WHERE EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=l.person_id AND m.department_id=p_department)
 ), days AS (SELECT generate_series(p_month::timestamp,(p_month+interval '1 month' - interval '1 day')::timestamp,interval '1 day')::date AS day)
 SELECT jsonb_build_object('month',p_month,'department_id',p_department,'basis_version',coalesce((SELECT version FROM public.schedule_plans WHERE id=current_plan),0),
 'history_scope','published-before-month','drafts_are_warnings',true,
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',person.id,
  'history_count',(SELECT count(DISTINCT day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'last_day',(SELECT max(day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'global_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND (plan_id IS NULL OR plan_id IS DISTINCT FROM current_plan) AND status='published' AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'department_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND department_id=p_department AND (plan_id IS NULL OR plan_id IS DISTINCT FROM current_plan) AND status='published' AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'days',(SELECT jsonb_agg(jsonb_build_object('date',days.day,'state',iasdpi_schedule_private.day_availability(person.id,p_department,days.day),
   'conflict',EXISTS(SELECT 1 FROM occupied other WHERE other.person_id=person.id AND other.department_id<>p_department AND other.status='published' AND other.day=days.day
    AND NOT iasdpi_schedule_private.has_day_exception(person.id,days.day,p_department,other.department_id)),
   'draft_dispute',EXISTS(SELECT 1 FROM occupied other WHERE other.person_id=person.id AND other.department_id<>p_department AND other.status='draft' AND other.day=days.day)) ORDER BY days.day) FROM days)
 ) ORDER BY person.id) FROM public.schedule_people person WHERE EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=person.id AND m.department_id=p_department)),'[]'::jsonb),
 'heads',coalesce((SELECT jsonb_agg(person.display_name ORDER BY person.display_name) FROM public.schedule_memberships member JOIN public.schedule_people person ON person.id=member.person_id
 WHERE member.department_id=p_department AND member.is_ministry_head AND member.active AND person.active),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

-- Revalidação obrigatória inclusive em publicação parcial (status sem requirements).
ALTER FUNCTION public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_007;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.plan_save_007(uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
CREATE FUNCTION public.iasdpi_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; a public.schedule_assignments; BEGIN
 result:=iasdpi_schedule_private.plan_save_007(p_id,p_expected_version,p_data,p_request_id);
 IF EXISTS(SELECT 1 FROM public.schedule_plans WHERE id=p_id AND status='published') THEN
  FOR a IN SELECT * FROM public.schedule_assignments WHERE plan_id=p_id LOOP PERFORM iasdpi_schedule_private.validate_daily_assignment(a,true); END LOOP;
 END IF;
 RETURN result;
END $$;
-- Mapeamento explícito dos nomes históricos para UUIDs existentes. Nunca cria pessoas,
-- funções ou disponibilidade. Não transfere nem sobrescreve uma referência já registrada.
CREATE FUNCTION public.iasdpi_schedule_register_legacy(p_rows jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; row jsonb; old public.schedule_legacy_commitments; sig text; receipt iasdpi_operational_private.receipts; n integer:=0; result jsonb; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador confirma identidades históricas.' USING errcode='42501'; END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>500 OR pg_column_size(p_rows)>500000 THEN RAISE EXCEPTION 'Referências inválidas.' USING errcode='22023'; END IF;
 sig:='schedule-legacy:'||iasdpi_operational_private.fingerprint(p_rows);
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(row) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(row) k WHERE NOT k=ANY(ARRAY['source_key','person_id','department_id','date','original_name'])) THEN RAISE EXCEPTION 'Campos históricos inválidos.' USING errcode='22023'; END IF;
  SELECT * INTO old FROM public.schedule_legacy_commitments WHERE source_key=row->>'source_key';
  IF FOUND THEN
   IF old.person_id IS DISTINCT FROM (row->>'person_id')::uuid OR old.department_id IS DISTINCT FROM (row->>'department_id')::uuid OR old.scheduled_on IS DISTINCT FROM (row->>'date')::date OR old.original_name IS DISTINCT FROM row->>'original_name' THEN RAISE EXCEPTION 'Referência histórica já vinculada; não sobrescrita.' USING errcode='23505'; END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=(row->>'person_id')::uuid AND department_id=(row->>'department_id')::uuid) THEN RAISE EXCEPTION 'Confirme o vínculo histórico da pessoa antes de importar.' USING errcode='23514'; END IF;
   INSERT INTO public.schedule_legacy_commitments(source_key,person_id,department_id,scheduled_on,original_name,created_by)
   VALUES(row->>'source_key',(row->>'person_id')::uuid,(row->>'department_id')::uuid,(row->>'date')::date,row->>'original_name',u);n:=n+1;
  END IF;
 END LOOP;
 -- Importação também não pode invalidar escalas publicadas já existentes.
 FOR old IN SELECT l.* FROM public.schedule_legacy_commitments l JOIN jsonb_array_elements(p_rows) j ON l.source_key=j->>'source_key' LOOP
  IF EXISTS(SELECT 1 FROM iasdpi_schedule_private.confirmed_days other WHERE other.person_id=old.person_id AND other.day=old.scheduled_on AND other.department_id<>old.department_id AND NOT iasdpi_schedule_private.has_day_exception(old.person_id,old.scheduled_on,old.department_id,other.department_id)) THEN RAISE EXCEPTION 'Conflito com compromisso confirmado; revise a identidade antes de importar.' USING errcode='23P01'; END IF;
 END LOOP;
 result:=jsonb_build_object('inserted',n,'considered',jsonb_array_length(p_rows));
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'legacy-mapping',p_request_id,1,ARRAY['person_id','source_key'],'Mapeamento explícito; nomes e registros originais preservados.');
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now()); RETURN result;
END $$;
-- Uma exceção em uso por compromisso histórico também não pode ser revogada.
ALTER FUNCTION public.iasdpi_schedule_exception_save(uuid,bigint,jsonb) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_exception_save(uuid,bigint,jsonb) RENAME TO exception_save_007;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.exception_save_007(uuid,bigint,jsonb) FROM public,anon,authenticated;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.exception_save_007(p_id uuid,p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; old public.schedule_day_exceptions; a uuid; b uuid; person uuid; day date; v_enabled boolean; result jsonb; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador autoriza exceções.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['person_id','day','department_a','department_b','reason','enabled'])) THEN RAISE EXCEPTION 'Exceção inválida.' USING errcode='22023'; END IF;
 SELECT * INTO old FROM public.schedule_day_exceptions WHERE id=p_id;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Exceção mudou. Recarregue.' USING errcode='40001'; END IF;
 person:=coalesce(old.person_id,(p_data->>'person_id')::uuid);day:=coalesce(old.day,(p_data->>'day')::date);a:=least((p_data->>'department_a')::uuid,(p_data->>'department_b')::uuid);b:=greatest((p_data->>'department_a')::uuid,(p_data->>'department_b')::uuid);
 IF old.id IS NOT NULL THEN
  IF (p_data ? 'person_id' AND (p_data->>'person_id')::uuid IS DISTINCT FROM old.person_id) OR (p_data ? 'day' AND (p_data->>'day')::date IS DISTINCT FROM old.day) OR (a IS NOT NULL AND (a<>old.department_a OR b<>old.department_b)) THEN RAISE EXCEPTION 'A identidade da autorização não pode mudar.' USING errcode='22023'; END IF;
  a:=old.department_a;b:=old.department_b;
 END IF;
 IF person IS NULL OR day IS NULL OR a IS NULL OR b IS NULL OR a=b OR NOT EXISTS(SELECT 1 FROM public.schedule_people WHERE id=person AND active) OR (SELECT count(*) FROM public.schedule_departments WHERE id IN (a,b) AND active)<>2 THEN RAISE EXCEPTION 'Pessoa, data ou departamentos inválidos.' USING errcode='22023'; END IF;
 v_enabled:=coalesce((p_data->>'enabled')::boolean,old.enabled,true);
 IF NOT v_enabled AND EXISTS(SELECT 1 FROM iasdpi_schedule_private.confirmed_days x JOIN iasdpi_schedule_private.confirmed_days y ON y.person_id=x.person_id AND y.day=x.day WHERE x.person_id=person AND x.department_id=a AND y.department_id=b AND x.day=coalesce(old.day,(p_data->>'day')::date)) THEN RAISE EXCEPTION 'Exceção em uso por compromissos confirmados; corrija uma das atribuições antes de revogar.' USING errcode='23514'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO public.schedule_day_exceptions(id,person_id,day,department_a,department_b,reason,enabled,approved_by) VALUES(p_id,person,day,a,b,p_data->>'reason',v_enabled,u);
 ELSE UPDATE public.schedule_day_exceptions SET reason=coalesce(p_data->>'reason',reason),enabled=v_enabled,approved_by=CASE WHEN v_enabled AND NOT old.enabled THEN u ELSE approved_by END,approved_at=CASE WHEN v_enabled AND NOT old.enabled THEN now() ELSE approved_at END,revoked_by=CASE WHEN NOT v_enabled THEN u ELSE NULL END,revoked_at=CASE WHEN NOT v_enabled THEN now() ELSE NULL END,version=version+1 WHERE id=p_id; END IF;
 SELECT to_jsonb(x) INTO result FROM public.schedule_day_exceptions x WHERE id=p_id;
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'daily-exception',p_id,(result->>'version')::bigint,ARRAY(SELECT jsonb_object_keys(p_data)),p_data->>'reason');RETURN result;
END $$;

CREATE FUNCTION public.iasdpi_schedule_exception_save(p_id uuid,p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 result:=iasdpi_schedule_private.exception_save_007(p_id,p_expected_version,p_data);
 IF NOT (result->>'enabled')::boolean AND EXISTS(
  SELECT 1 FROM iasdpi_schedule_private.confirmed_days a JOIN iasdpi_schedule_private.confirmed_days b ON a.person_id=b.person_id AND a.day=b.day
  WHERE a.person_id=(result->>'person_id')::uuid AND a.day=(result->>'day')::date AND a.department_id=(result->>'department_a')::uuid AND b.department_id=(result->>'department_b')::uuid
 ) THEN RAISE EXCEPTION 'Exceção em uso por compromissos confirmados, inclusive históricos.' USING errcode='23514'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_exception_save(uuid,bigint,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_exception_save(uuid,bigint,jsonb) TO authenticated;
ALTER FUNCTION public.iasdpi_schedule_person_history(uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_person_history(uuid) RENAME TO person_history_007;
CREATE FUNCTION public.iasdpi_schedule_person_history(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 result:=iasdpi_schedule_private.person_history_007(p_person);
 RETURN result||jsonb_build_object('current',(result->'current')||coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'assigned_on',l.scheduled_on,'department',d.name,'role','Função histórica: Pendente de confirmação','status','Histórico manual — original preservado','original_name',l.original_name,'source_key',l.source_key) ORDER BY l.scheduled_on DESC) FROM public.schedule_legacy_commitments l JOIN public.schedule_departments d ON d.id=l.department_id WHERE l.person_id=p_person),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_person_history(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_person_history(uuid) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_rotation_context(uuid,date),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_register_legacy(jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_rotation_context(uuid,date),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_register_legacy(jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
