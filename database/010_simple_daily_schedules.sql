-- Montagem por dia: participação geral, disponibilidade padrão e preferências.
-- REVISÃO SOMENTE. Executar depois de 001–009, com autorização administrativa.
-- Não altera pessoas, disponibilidades, atribuições nem versões já gravadas.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.schedule_legacy_commitments') IS NULL
 OR to_regprocedure('iasdpi_schedule_private.plan_save_007(uuid,bigint,jsonb,uuid)') IS NULL THEN
  RAISE EXCEPTION 'Instale 001–009 como postgres antes da 010.';
 END IF;
END $$;

ALTER TABLE public.schedule_roles ADD COLUMN general_assignment boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX schedule_one_general_role ON public.schedule_roles(department_id) WHERE general_assignment;
-- O marcador não é editável pela RPC genérica da 005; não se concede escrita direta.
CREATE FUNCTION public.iasdpi_schedule_daily_role(p_department uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; row public.schedule_roles; BEGIN
 u:=iasdpi_schedule_private.actor();
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.can_manage(u,p_department) OR NOT EXISTS(
  SELECT 1 FROM public.schedule_departments WHERE id=p_department AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501';
 END IF;
 SELECT * INTO row FROM public.schedule_roles WHERE department_id=p_department AND general_assignment;
 IF FOUND THEN
  IF NOT row.active THEN RAISE EXCEPTION 'Participação diária inativa. Revise o cadastro.' USING errcode='23514'; END IF;
 ELSE
  -- Nunca converte uma função técnica já cadastrada em participação geral.
  IF EXISTS(SELECT 1 FROM public.schedule_roles WHERE department_id=p_department
   AND normalized_name=iasdpi_schedule_private.normal_name('Participação no departamento')) THEN
   RAISE EXCEPTION 'Já existe uma função com este nome. Revise antes de ativar a participação diária.' USING errcode='23505';
  END IF;
  INSERT INTO public.schedule_roles(department_id,name,general_assignment)
   VALUES(p_department,'Participação no departamento',true) RETURNING * INTO row;
  INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields)
   VALUES(u,'daily-participation',row.id,p_department,row.version,ARRAY['create']);
 END IF;
 RETURN to_jsonb(row)-'normalized_name';
END $$;

ALTER FUNCTION iasdpi_schedule_private.day_availability(uuid,uuid,date) RENAME TO day_availability_009;
CREATE FUNCTION iasdpi_schedule_private.day_availability(person uuid,department uuid,day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE iasdpi_schedule_private.day_availability_009(person,department,day)
  WHEN 'unknown' THEN 'available' ELSE iasdpi_schedule_private.day_availability_009(person,department,day) END;
$$;

ALTER FUNCTION public.iasdpi_schedule_settings_get() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() RENAME TO settings_get_009;
CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_schedule_private.settings_get_009()||jsonb_build_object(
  'simplified_daily',true,'availability_default','available','availability_advisory',true);
END $$;
ALTER FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_rotation_context(uuid,date) RENAME TO rotation_context_009;
CREATE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_schedule_private.rotation_context_009(p_department,p_month)||jsonb_build_object(
  'availability_default','available','availability_advisory',true);
END $$;

-- Preserva a versão anterior para revisão/rollback administrativo.
ALTER FUNCTION iasdpi_schedule_private.validate_daily_assignment(public.schedule_assignments,boolean) RENAME TO validate_daily_assignment_009;
CREATE FUNCTION iasdpi_schedule_private.validate_daily_assignment(a public.schedule_assignments,p_new boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.schedule_requirements; event public.schedule_events; v_day date; other record; BEGIN
 SELECT * INTO STRICT req FROM public.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT event FROM public.schedule_events WHERE id=req.event_id;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_people p
  JOIN public.schedule_memberships m ON m.person_id=p.id
  JOIN public.schedule_departments d ON d.id=m.department_id
  JOIN public.schedule_roles role ON role.id=req.role_id AND role.department_id=m.department_id
  WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active
   AND m.department_id=a.department_id AND (role.general_assignment OR EXISTS(
    SELECT 1 FROM public.schedule_qualifications q WHERE q.membership_id=m.id AND q.role_id=role.id))) THEN
  RAISE EXCEPTION 'Pessoa inativa, sem vínculo ativo ou sem habilitação para a função específica.' USING errcode='23514';
 END IF;
 IF a.timing_mode='day' AND a.assigned_on<>event.scheduled_on THEN
  RAISE EXCEPTION 'Data da atribuição difere do evento.' USING errcode='23514';
 END IF;
 IF a.timing_mode='timed' AND (event.starts_at IS NULL OR a.starts_at<event.starts_at
  OR a.ends_at>event.ends_at OR a.ends_at<=a.starts_at) THEN
  RAISE EXCEPTION 'Intervalo histórico fora do evento.' USING errcode='23514';
 END IF;
 IF p_new OR a.timing_mode='day' THEN
  FOR v_day IN SELECT * FROM iasdpi_schedule_private.assignment_days(a) LOOP
   FOR other IN SELECT DISTINCT x.department_id FROM iasdpi_schedule_private.confirmed_days x
    WHERE x.person_id=a.person_id AND x.assignment_id IS DISTINCT FROM a.id
     AND x.department_id<>a.department_id AND x.day=v_day LOOP
    IF NOT iasdpi_schedule_private.has_day_exception(a.person_id,v_day,a.department_id,other.department_id) THEN
     RAISE EXCEPTION 'Conflito: pessoa em dois departamentos na mesma data. Exceção exige administrador e justificativa.' USING errcode='23P01';
    END IF;
   END LOOP;
  END LOOP;
 END IF;
 -- Disponibilidade e limites são preferências do rodízio, não proibições manuais.
 -- A RPC de gravação e seus gatilhos mantêm locks, CAS, cobertura e revalidação.
END $$;

ALTER FUNCTION public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_009;
CREATE FUNCTION public.iasdpi_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; a public.schedule_assignments; v_day date; reasons text[]; mon date; replayed boolean; BEGIN
 SELECT EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id) INTO replayed;
 result:=iasdpi_schedule_private.plan_save_009(p_id,p_expected_version,p_data,p_request_id);
 -- Uma repetição idempotente devolve a confirmação original, sem duplicar auditoria.
 IF replayed OR (result->>'version')::bigint<>p_expected_version+1 OR EXISTS(
  SELECT 1 FROM iasdpi_schedule_private.audit_logs WHERE entity='manual-preference-override' AND entity_id=p_request_id) THEN RETURN result; END IF;
 reasons:='{}';
 FOR a IN SELECT * FROM public.schedule_assignments WHERE plan_id=p_id LOOP
  FOR v_day IN SELECT * FROM iasdpi_schedule_private.assignment_days(a) LOOP
   IF iasdpi_schedule_private.day_availability(a.person_id,a.department_id,v_day)='unavailable' THEN reasons:=array_append(reasons,'availability'); END IF;
   mon:=date_trunc('month',v_day)::date;
   IF EXISTS(SELECT 1 FROM public.schedule_people WHERE id=a.person_id AND max_monthly_count IS NOT NULL
    AND iasdpi_schedule_private.monthly_days(a,mon,false)>max_monthly_count) THEN reasons:=array_append(reasons,'monthly-limit'); END IF;
   IF EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=a.person_id AND department_id=a.department_id AND max_monthly_count IS NOT NULL
    AND iasdpi_schedule_private.monthly_days(a,mon,true)>max_monthly_count) THEN reasons:=array_append(reasons,'department-limit'); END IF;
  END LOOP;
 END LOOP;
 IF cardinality(reasons)>0 THEN
  INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields,reason)
   VALUES(iasdpi_schedule_private.actor(),'manual-preference-override',p_request_id,(result->>'department_id')::uuid,(result->>'version')::bigint,
    ARRAY(SELECT DISTINCT unnest(reasons)),'Escolha manual permitida fora das preferências do automático.');
 END IF;
 RETURN result;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_daily_role(uuid),public.iasdpi_schedule_settings_get(),
 public.iasdpi_schedule_rotation_context(uuid,date),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_daily_role(uuid),public.iasdpi_schedule_settings_get(),
 public.iasdpi_schedule_rotation_context(uuid,date),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) TO authenticated;
COMMIT;
