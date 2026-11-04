-- IASDPI B1.2: contexto somente leitura para proposta mensal. Revisar após 007.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_schedule_members()') IS NULL THEN
  RAISE EXCEPTION 'Instale 001–007 antes da 008, como postgres.';
 END IF;
END $$;

CREATE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
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
 ), days AS (SELECT generate_series(p_month::timestamp,(p_month+interval '1 month' - interval '1 day')::timestamp,interval '1 day')::date AS day)
 SELECT jsonb_build_object('month',p_month,'department_id',p_department,'basis_version',coalesce((SELECT version FROM public.schedule_plans WHERE id=current_plan),0),
 'history_scope','published-before-month',
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',person.id,
  'history_count',(SELECT count(DISTINCT day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'last_day',(SELECT max(day) FROM occupied WHERE person_id=person.id AND department_id=p_department AND day<p_month AND status='published'),
  'global_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND plan_id IS DISTINCT FROM current_plan AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'department_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT day FROM occupied WHERE person_id=person.id AND department_id=p_department AND plan_id IS DISTINCT FROM current_plan AND day>=p_month AND day<(p_month+interval '1 month')::date) x),'[]'::jsonb),
  'days',(SELECT jsonb_agg(jsonb_build_object('date',days.day,'state',iasdpi_schedule_private.day_availability(person.id,p_department,days.day),
   'conflict',EXISTS(SELECT 1 FROM occupied other WHERE other.person_id=person.id AND other.department_id<>p_department AND other.day=days.day
    AND NOT iasdpi_schedule_private.has_day_exception(person.id,days.day,p_department,other.department_id))) ORDER BY days.day) FROM days)
 ) ORDER BY person.id) FROM public.schedule_people person WHERE EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=person.id AND m.department_id=p_department)),'[]'::jsonb),
 'heads',coalesce((SELECT jsonb_agg(person.display_name ORDER BY person.display_name) FROM public.schedule_memberships member JOIN public.schedule_people person ON person.id=member.person_id
 WHERE member.department_id=p_department AND member.is_ministry_head AND member.active AND person.active),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) TO authenticated;

-- Estende a resposta existente sem tocar em dados nem alterar o contrato da B1.1.
ALTER FUNCTION public.iasdpi_schedule_workspace(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_workspace(uuid,date) RENAME TO workspace_007;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.workspace_007(uuid,date) FROM public,anon,authenticated;
CREATE FUNCTION public.iasdpi_schedule_workspace(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE workspace jsonb; u uuid; BEGIN
 workspace:=iasdpi_schedule_private.workspace_007(p_department,p_month);
 u:=iasdpi_schedule_private.actor();
 RETURN workspace||jsonb_build_object('monthly',true,'rotation_context',CASE WHEN iasdpi_schedule_private.can_manage(u,p_department)
  THEN public.iasdpi_schedule_rotation_context(p_department,p_month) ELSE NULL END);
END $$;
ALTER FUNCTION public.iasdpi_schedule_workspace(uuid,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_workspace(uuid,date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_workspace(uuid,date) TO authenticated;
-- Gravação continua nas RPCs/validações transacionais da 007; não publica propostas.
NOTIFY pgrst,'reload schema';
COMMIT;
