-- B1.1: revisão obrigatória. Executar somente após 001–006, como postgres.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'Execute 001–006 primeiro, como postgres.'; END IF;
 END $$;
ALTER TABLE public.schedule_events ADD COLUMN timing_mode text NOT NULL DEFAULT 'timed' CHECK(timing_mode IN ('day','timed'));
ALTER TABLE public.schedule_events ALTER COLUMN starts_at DROP NOT NULL,ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_event_mode CHECK((timing_mode='day' AND starts_at IS NULL AND ends_at IS NULL) OR (timing_mode='timed' AND starts_at IS NOT NULL AND ends_at IS NOT NULL));
CREATE UNIQUE INDEX schedule_day_event_unique ON public.schedule_events(normalized_title,scheduled_on) WHERE timing_mode='day';
ALTER TABLE public.schedule_assignments ADD COLUMN timing_mode text NOT NULL DEFAULT 'timed' CHECK(timing_mode IN ('day','timed')),ADD COLUMN assigned_on date;
-- Somente a data derivada é preenchida. Timestamps e precisão existentes não mudam.
ALTER TABLE public.schedule_assignments DISABLE TRIGGER schedule_assignment_guard;
UPDATE public.schedule_assignments SET assigned_on=(starts_at AT TIME ZONE 'America/Sao_Paulo')::date;
ALTER TABLE public.schedule_assignments ENABLE TRIGGER schedule_assignment_guard;
ALTER TABLE public.schedule_assignments ALTER COLUMN assigned_on SET NOT NULL,ALTER COLUMN starts_at DROP NOT NULL,ALTER COLUMN ends_at DROP NOT NULL;
ALTER TABLE public.schedule_assignments ADD CONSTRAINT schedule_assignment_mode CHECK((timing_mode='day' AND starts_at IS NULL AND ends_at IS NULL) OR (timing_mode='timed' AND starts_at IS NOT NULL AND ends_at IS NOT NULL));
CREATE INDEX schedule_assignment_day_idx ON public.schedule_assignments(person_id,assigned_on,department_id);
ALTER TABLE public.schedule_people ADD COLUMN max_monthly_count integer CHECK(max_monthly_count BETWEEN 0 AND 100);
ALTER TABLE public.schedule_availability ADD COLUMN origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','daily-profile'));

CREATE TABLE public.schedule_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),planning_months integer NOT NULL DEFAULT 2 CHECK(planning_months IN (1,2,3,6)),
 weekdays smallint[] NOT NULL DEFAULT ARRAY[3,6,0]::smallint[] CHECK(cardinality(weekdays)=0 OR iasdpi_schedule_private.valid_weekdays(weekdays)),
 extra_dates date[] NOT NULL DEFAULT '{}',version bigint NOT NULL DEFAULT 1,updated_by uuid REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.schedule_settings(singleton) VALUES(true);
CREATE TABLE public.schedule_day_exceptions (
 id uuid PRIMARY KEY,person_id uuid NOT NULL REFERENCES public.schedule_people(id),day date NOT NULL,
 department_a uuid NOT NULL REFERENCES public.schedule_departments(id),department_b uuid NOT NULL REFERENCES public.schedule_departments(id),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),enabled boolean NOT NULL DEFAULT true,
 approved_by uuid NOT NULL REFERENCES auth.users(id),approved_at timestamptz NOT NULL DEFAULT now(),
 revoked_by uuid REFERENCES auth.users(id),revoked_at timestamptz,version bigint NOT NULL DEFAULT 1,
 CHECK(department_a<department_b),UNIQUE(person_id,day,department_a,department_b)
);
ALTER TABLE public.schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_day_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_settings,public.schedule_day_exceptions FROM public,anon,authenticated;

CREATE FUNCTION iasdpi_schedule_private.future_months(today date,count integer) RETURNS date[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT array_agg((date_trunc('month',today)::date+make_interval(months=>n))::date ORDER BY n) FROM generate_series(1,count) n; $$;
CREATE FUNCTION iasdpi_schedule_private.assignment_days(a public.schedule_assignments) RETURNS SETOF date
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT a.assigned_on WHERE a.timing_mode='day'
 UNION ALL SELECT d::date FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 ((a.ends_at-interval '1 microsecond') AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') d WHERE a.timing_mode='timed';
$$;
CREATE FUNCTION iasdpi_schedule_private.day_availability(person uuid,department uuid,day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.schedule_availability v WHERE v.person_id=person AND v.active AND (v.department_id IS NULL OR v.department_id=department)
 AND v.kind='unavailable' AND ((v.pattern='period' AND tsrange(day::timestamp,(day+1)::timestamp,'[)') && tsrange(v.starts_on+coalesce(v.start_time,time '00:00'),(CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00'),'[)')) OR (v.pattern='weekly' AND extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day>=v.valid_from) AND (v.valid_until IS NULL OR day<=v.valid_until)))) THEN 'unavailable'
 WHEN EXISTS(SELECT 1 FROM public.schedule_availability v WHERE v.person_id=person AND v.active AND (v.department_id IS NULL OR v.department_id=department)
 AND v.kind='available' AND v.start_time IS NULL AND v.end_time IS NULL AND ((v.pattern='period' AND day BETWEEN v.starts_on AND v.ends_on) OR (v.pattern='weekly' AND extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day>=v.valid_from) AND (v.valid_until IS NULL OR day<=v.valid_until)))) THEN 'available' ELSE 'unknown' END;
$$;
CREATE FUNCTION iasdpi_schedule_private.has_day_exception(p_person uuid,p_day date,p_a uuid,p_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.schedule_day_exceptions x WHERE x.person_id=p_person AND x.day=p_day AND x.department_a=least(p_a,p_b) AND x.department_b=greatest(p_a,p_b) AND x.enabled); $$;

CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_departments d ON d.id=a.department_id WHERE a.user_id=u AND a.enabled AND d.active) THEN RAISE EXCEPTION 'Sem acesso às escalas.' USING errcode='42501'; END IF;
 RETURN (SELECT to_jsonb(s)||jsonb_build_object('daily',true,'can_edit',iasdpi_schedule_private.is_admin(u),'today',(now() AT TIME ZONE 'America/Sao_Paulo')::date,'future_months',iasdpi_schedule_private.future_months((now() AT TIME ZONE 'America/Sao_Paulo')::date,s.planning_months)) FROM public.schedule_settings s);
END $$;
CREATE FUNCTION public.iasdpi_schedule_settings_save(p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid; days smallint[]; extras date[]; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador altera o período e os dias.' USING errcode='42501'; END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['planning_months','weekdays','extra_dates'])) THEN RAISE EXCEPTION 'Configuração inválida.' USING errcode='22023'; END IF;
 IF p_data ? 'weekdays' THEN SELECT coalesce(array_agg(value::smallint),'{}') INTO days FROM jsonb_array_elements_text(p_data->'weekdays'); END IF;
 IF p_data ? 'extra_dates' THEN SELECT coalesce(array_agg(DISTINCT value::date),'{}') INTO extras FROM jsonb_array_elements_text(p_data->'extra_dates'); END IF;
 IF (extras IS NOT NULL AND (cardinality(extras)>366 OR array_position(extras,NULL) IS NOT NULL)) THEN RAISE EXCEPTION 'Datas extraordinárias inválidas.' USING errcode='22023'; END IF;
 UPDATE public.schedule_settings SET planning_months=CASE WHEN p_data ? 'planning_months' THEN (p_data->>'planning_months')::integer ELSE planning_months END,weekdays=coalesce(days,weekdays),extra_dates=coalesce(extras,extra_dates),version=version+1,updated_by=u,updated_at=now() WHERE singleton AND version=p_expected_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Configuração mudou. Recarregue antes de salvar.' USING errcode='40001'; END IF;
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields) VALUES(u,'daily-settings','00000000-0000-4000-8000-000000000007',(SELECT version FROM public.schedule_settings),ARRAY(SELECT jsonb_object_keys(p_data)));
 RETURN public.iasdpi_schedule_settings_get();
END $$;

ALTER FUNCTION public.iasdpi_schedule_event_create(uuid,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_event_create(uuid,jsonb,uuid) RENAME TO event_create_006;
CREATE FUNCTION public.iasdpi_schedule_event_create(p_id uuid,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; d uuid; day date; old public.schedule_events; result jsonb; receipt iasdpi_operational_private.receipts; sig text; BEGIN
 IF nullif(p_data->>'start_time','') IS NOT NULL OR nullif(p_data->>'end_time','') IS NOT NULL THEN RETURN iasdpi_schedule_private.event_create_006(p_id,p_data,p_request_id); END IF;
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();d:=(p_data->>'department_id')::uuid;
 IF NOT iasdpi_schedule_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=d AND active) THEN RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','title','date','end_date','start_time','end_time','source','source_key'])) OR length(btrim(p_data->>'title')) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe título e data válidos.' USING errcode='22023'; END IF;
 day:=(p_data->>'date')::date;
 IF day IS NULL OR (p_data->>'end_date' IS NOT NULL AND (p_data->>'end_date')::date<>day) OR ((p_data->>'source') IS NULL)<>((p_data->>'source_key') IS NULL) THEN RAISE EXCEPTION 'A escala diária deve informar uma única data e origem completa, quando usada.' USING errcode='22023'; END IF;
 sig:='schedule-daily-event:'||iasdpi_operational_private.fingerprint(jsonb_build_object('id',p_id,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_events WHERE id=p_id OR (timing_mode='day' AND scheduled_on=day AND normalized_title=iasdpi_schedule_private.normal_name(p_data->>'title')))
 AND p_data->>'source_key' IS NULL AND (SELECT count(*) FROM public.schedule_events WHERE scheduled_on=day AND normalized_title=iasdpi_schedule_private.normal_name(p_data->>'title'))>1 THEN
  RAISE EXCEPTION 'Há vários eventos históricos com esse nome na data. Selecione o evento existente; nenhuma identidade foi mesclada.' USING errcode='23505'; END IF;
 SELECT * INTO old FROM public.schedule_events WHERE id=p_id OR (scheduled_on=day AND normalized_title=iasdpi_schedule_private.normal_name(p_data->>'title')) OR (source=p_data->>'source' AND source_key=p_data->>'source_key') ORDER BY (id=p_id) DESC,timing_mode,id LIMIT 1;
 IF FOUND THEN
  IF old.scheduled_on<>day OR old.normalized_title<>iasdpi_schedule_private.normal_name(p_data->>'title') OR (p_data->>'source' IS NOT NULL AND (old.source IS DISTINCT FROM p_data->>'source' OR old.source_key IS DISTINCT FROM p_data->>'source_key')) THEN RAISE EXCEPTION 'Evento existente com outra identidade. Nada foi alterado.' USING errcode='23505'; END IF;
  result:=to_jsonb(old)-'normalized_title';
 ELSE
  INSERT INTO public.schedule_events(id,title,scheduled_on,timing_mode,source,source_key,created_by) VALUES(p_id,p_data->>'title',day,'day',p_data->>'source',p_data->>'source_key',u) RETURNING to_jsonb(schedule_events.*)-'normalized_title' INTO result;
  INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'daily-event',p_id,d,1,ARRAY['create']);
 END IF;
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_schedule_generate_days(p_department uuid,p_title text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; s public.schedule_settings; months date[]; day date; result jsonb:='[]'; row jsonb; sig text; receipt iasdpi_operational_private.receipts; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.can_manage(u,p_department) THEN RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF p_request_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe o nome dos cultos.' USING errcode='22023'; END IF;
 sig:='schedule-daily-generation:'||iasdpi_operational_private.fingerprint(jsonb_build_object('department',p_department,'title',p_title));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 SELECT * INTO s FROM public.schedule_settings;months:=iasdpi_schedule_private.future_months((now() AT TIME ZONE 'America/Sao_Paulo')::date,s.planning_months);
 FOR day IN SELECT d::date FROM generate_series(months[1]::timestamp,(months[array_length(months,1)]+interval '1 month' - interval '1 day')::timestamp,interval '1 day') d WHERE extract(dow FROM d)::smallint=ANY(s.weekdays) OR d::date=ANY(s.extra_dates) LOOP
  row:=public.iasdpi_schedule_event_create(gen_random_uuid(),jsonb_build_object('department_id',p_department,'title',p_title,'date',day),gen_random_uuid());result:=result||jsonb_build_array(row);
 END LOOP;
 row:=jsonb_build_object('months',months,'events',result,'settings_version',s.version);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,row,now());RETURN row;
END $$;

ALTER FUNCTION public.iasdpi_schedule_workspace(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_workspace(uuid,date) RENAME TO workspace_006;
CREATE FUNCTION public.iasdpi_schedule_workspace(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb; BEGIN
 result:=iasdpi_schedule_private.workspace_006(p_department,p_month);
 RETURN result||jsonb_build_object('settings',public.iasdpi_schedule_settings_get(),'availability',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',m.person_id,'date',d::date,'state',iasdpi_schedule_private.day_availability(m.person_id,p_department,d::date))) FROM public.schedule_memberships m CROSS JOIN generate_series(p_month::timestamp,(p_month+interval '1 month' - interval '1 day')::timestamp,interval '1 day') d WHERE m.department_id=p_department AND m.active),'[]'::jsonb));
END $$;

CREATE FUNCTION iasdpi_schedule_private.validate_daily_assignment(a public.schedule_assignments,p_new boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE req public.schedule_requirements; event public.schedule_events; day date; other record; maximum integer; count_days integer; mon date; BEGIN
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
  FOR day IN SELECT * FROM iasdpi_schedule_private.assignment_days(a) LOOP
   IF iasdpi_schedule_private.day_availability(a.person_id,a.department_id,day)<>'available' THEN RAISE EXCEPTION 'Disponibilidade não confirmada ou pessoa indisponível nesta data. Revise as flags do cadastro.' USING errcode='23514'; END IF;
   FOR other IN SELECT DISTINCT x.department_id FROM public.schedule_assignments x CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(x) occupied WHERE x.person_id=a.person_id AND x.id<>a.id AND x.department_id<>a.department_id AND occupied=day LOOP
    IF NOT iasdpi_schedule_private.has_day_exception(a.person_id,day,a.department_id,other.department_id) THEN RAISE EXCEPTION 'Conflito: pessoa em dois departamentos na mesma data. Somente administrador pode autorizar uma exceção justificada.' USING errcode='23P01'; END IF;
   END LOOP;
   mon:=date_trunc('month',day)::date;
   SELECT max_monthly_count INTO maximum FROM public.schedule_people WHERE id=a.person_id;
   SELECT count(DISTINCT occupied) INTO count_days FROM (SELECT occupied FROM public.schedule_assignments x CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(x) occupied WHERE x.person_id=a.person_id AND x.id<>a.id UNION SELECT occupied FROM iasdpi_schedule_private.assignment_days(a) occupied) dates WHERE occupied>=mon AND occupied<(mon+interval '1 month')::date;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal da pessoa excedido (dias distintos).' USING errcode='23514'; END IF;
   SELECT max_monthly_count INTO maximum FROM public.schedule_memberships WHERE person_id=a.person_id AND department_id=a.department_id;
   SELECT count(DISTINCT occupied) INTO count_days FROM (SELECT occupied FROM public.schedule_assignments x CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(x) occupied WHERE x.person_id=a.person_id AND x.department_id=a.department_id AND x.id<>a.id UNION SELECT occupied FROM iasdpi_schedule_private.assignment_days(a) occupied) dates WHERE occupied>=mon AND occupied<(mon+interval '1 month')::date;
   IF maximum IS NOT NULL AND count_days>maximum THEN RAISE EXCEPTION 'Limite mensal do vínculo excedido.' USING errcode='23514'; END IF;
  END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.validate_assignment(a public.schedule_assignments) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN PERFORM iasdpi_schedule_private.validate_daily_assignment(a,true); END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.assignment_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE event public.schedule_events; BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 SELECT e.* INTO STRICT event FROM public.schedule_requirements r JOIN public.schedule_events e ON e.id=r.event_id WHERE r.id=NEW.requirement_id;
 NEW.assigned_on:=CASE WHEN NEW.timing_mode='day' THEN event.scheduled_on ELSE (NEW.starts_at AT TIME ZONE 'America/Sao_Paulo')::date END;
 PERFORM iasdpi_schedule_private.validate_assignment(NEW);RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.revalidate_plans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE item public.schedule_assignments; BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 FOR item IN SELECT * FROM public.schedule_assignments WHERE assigned_on>=(now() AT TIME ZONE 'America/Sao_Paulo')::date LOOP
  -- Horários antigos não são transformados nem recebem exceções automáticas.
  PERFORM iasdpi_schedule_private.validate_daily_assignment(item,false);
 END LOOP;RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; old public.schedule_plans; d uuid; mon date; next_status text; signature text; result jsonb;
 receipt iasdpi_operational_private.receipts; req jsonb; item jsonb; r public.schedule_requirements; e public.schedule_events; n bigint;
BEGIN
 u:=iasdpi_schedule_private.actor(); UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton; u:=iasdpi_schedule_private.actor();
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>1000000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','month','title','status','requirements'])) THEN
  RAISE EXCEPTION 'Plano, versão ou campos inválidos.' USING errcode='22023'; END IF;
 SELECT * INTO old FROM public.schedule_plans WHERE id=p_id FOR UPDATE;
 d:=coalesce(old.department_id,(p_data->>'department_id')::uuid); mon:=coalesce(old.month,(p_data->>'month')::date);
 IF NOT iasdpi_schedule_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=d AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF mon IS NULL OR extract(day FROM mon)<>1 OR (p_data ? 'department_id' AND (p_data->>'department_id')::uuid IS DISTINCT FROM d)
 OR (p_data ? 'month' AND (p_data->>'month')::date IS DISTINCT FROM mon) THEN RAISE EXCEPTION 'Departamento e mês são obrigatórios e não podem ser transferidos.' USING errcode='22023'; END IF;
 signature:='schedule-b1-plan:'||iasdpi_operational_private.fingerprint(jsonb_build_object('id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
  RETURN receipt.response;
 END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Esta escala mudou em outro dispositivo. Seus campos devem ser preservados; recarregue e compare antes de reaplicar.' USING errcode='40001'; END IF;
 next_status:=coalesce(p_data->>'status',old.status,'draft'); n:=coalesce(old.version,0)+1;
 IF old.id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.schedule_plans WHERE department_id=d AND month=mon) THEN RAISE EXCEPTION 'Já existe uma escala deste departamento e mês. Abra a existente.' USING errcode='23505'; END IF;
  INSERT INTO public.schedule_plans(id,department_id,month,title,status,version,created_by,updated_by)
  VALUES(p_id,d,mon,coalesce(p_data->>'title','Escala mensal'),next_status,n,u,u);
 ELSE UPDATE public.schedule_plans SET title=coalesce(p_data->>'title',title),status=next_status,version=n,updated_by=u,updated_at=now() WHERE id=p_id; END IF;
 IF p_data ? 'requirements' THEN
  IF jsonb_typeof(p_data->'requirements') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'requirements')>500 THEN RAISE EXCEPTION 'Lista de funções inválida ou excessiva.' USING errcode='22023'; END IF;
  -- O conjunto completo é substituído atomicamente. Campo ausente mantém os dados existentes.
  DELETE FROM public.schedule_assignments WHERE plan_id=p_id;
  DELETE FROM public.schedule_requirements WHERE plan_id=p_id;
  FOR req IN SELECT value FROM jsonb_array_elements(p_data->'requirements') LOOP
   IF jsonb_typeof(req) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(req) k WHERE NOT k=ANY(ARRAY['id','event_id','role_id','required_count','notes','assignments'])) THEN RAISE EXCEPTION 'Função necessária inválida.' USING errcode='22023'; END IF;
   SELECT * INTO e FROM public.schedule_events WHERE id=(req->>'event_id')::uuid;
   IF e.id IS NULL OR e.scheduled_on<mon OR e.scheduled_on>=(mon+interval '1 month')::date OR NOT EXISTS(SELECT 1 FROM public.schedule_roles WHERE id=(req->>'role_id')::uuid AND department_id=d AND active) THEN
    RAISE EXCEPTION 'Evento fora do mês ou função inativa/de outro departamento.' USING errcode='23514'; END IF;
   INSERT INTO public.schedule_requirements(id,plan_id,department_id,event_id,role_id,required_count,notes)
   VALUES((req->>'id')::uuid,p_id,d,e.id,(req->>'role_id')::uuid,(req->>'required_count')::integer,coalesce(req->>'notes','')) RETURNING * INTO r;
   IF jsonb_typeof(req->'assignments') IS DISTINCT FROM 'array' OR jsonb_array_length(req->'assignments')>r.required_count THEN RAISE EXCEPTION 'Lista de voluntários inválida ou maior que as vagas.' USING errcode='23514'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(req->'assignments') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE NOT k=ANY(ARRAY['id','person_id','starts_at','ends_at','timing_mode'])) THEN RAISE EXCEPTION 'Atribuição inválida.' USING errcode='22023'; END IF;
    INSERT INTO public.schedule_assignments(id,requirement_id,plan_id,department_id,person_id,starts_at,ends_at,timing_mode)
    VALUES((item->>'id')::uuid,r.id,p_id,d,(item->>'person_id')::uuid,CASE WHEN coalesce(item->>'timing_mode',e.timing_mode)='day' THEN NULL ELSE coalesce((item->>'starts_at')::timestamptz,e.starts_at) END,CASE WHEN coalesce(item->>'timing_mode',e.timing_mode)='day' THEN NULL ELSE coalesce((item->>'ends_at')::timestamptz,e.ends_at) END,coalesce(item->>'timing_mode',e.timing_mode));
   END LOOP;
  END LOOP;
 END IF;
 IF next_status='published' AND (NOT EXISTS(SELECT 1 FROM public.schedule_requirements WHERE plan_id=p_id) OR EXISTS(
 SELECT 1 FROM public.schedule_requirements coverage WHERE coverage.plan_id=p_id AND (SELECT count(*) FROM public.schedule_assignments assigned WHERE assigned.requirement_id=coverage.id)<coverage.required_count)) THEN
  RAISE EXCEPTION 'Publicação bloqueada: existem funções sem voluntários suficientes.' USING errcode='23514'; END IF;
 result:=iasdpi_schedule_private.plan_snapshot(p_id);
 INSERT INTO public.schedule_versions(plan_id,version,actor_id,snapshot) VALUES(p_id,n,u,result);
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'b1-plan',p_id,d,n,ARRAY(SELECT jsonb_object_keys(p_data)));
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,signature,result,now()); RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_schedule_members() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador consulta a planilha central.' USING errcode='42501'; END IF;
 RETURN jsonb_build_object('catalog',public.iasdpi_schedule_catalog(),'members',coalesce((SELECT jsonb_agg((to_jsonb(p)-ARRAY['normalized_name','auth_user_id'])||jsonb_build_object(
 'weekdays',(SELECT jsonb_object_agg(d::text,CASE WHEN EXISTS(SELECT 1 FROM public.schedule_availability a WHERE a.person_id=p.id AND a.origin='daily-profile' AND a.pattern='weekly' AND a.kind='unavailable' AND d::smallint=ANY(a.weekdays) AND a.active) THEN 'unavailable' WHEN EXISTS(SELECT 1 FROM public.schedule_availability a WHERE a.person_id=p.id AND a.origin='daily-profile' AND a.pattern='weekly' AND a.kind='available' AND d::smallint=ANY(a.weekdays) AND a.active) THEN 'available' ELSE 'unknown' END) FROM generate_series(0,6) d),
 'unavailable_dates',coalesce((SELECT jsonb_agg(a.starts_on ORDER BY a.starts_on) FROM public.schedule_availability a WHERE a.person_id=p.id AND a.origin='daily-profile' AND a.pattern='period' AND a.active),'[]'::jsonb),
 'manual_rules',(SELECT count(*) FROM public.schedule_availability a WHERE a.person_id=p.id AND a.origin='manual' AND a.active)) ORDER BY p.name) FROM public.schedule_people p),'[]'::jsonb));
END $$;
CREATE FUNCTION public.iasdpi_schedule_member_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; result jsonb; sig text; receipt iasdpi_operational_private.receipts; kind text; days smallint[]; day date; BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador altera a planilha central.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>24000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['name','display_name','active','max_monthly_count','weekdays','unavailable_dates'])) THEN RAISE EXCEPTION 'Campos da pessoa inválidos.' USING errcode='22023'; END IF;
 sig:='schedule-daily-member:'||iasdpi_operational_private.fingerprint(jsonb_build_object('id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023'; END IF;RETURN receipt.response; END IF;
 result:=public.iasdpi_schedule_save('person',p_id,p_expected_version,p_data-ARRAY['weekdays','unavailable_dates','max_monthly_count'],gen_random_uuid());
 IF p_data ? 'max_monthly_count' THEN UPDATE public.schedule_people SET max_monthly_count=(p_data->>'max_monthly_count')::integer WHERE id=p_id; END IF;
 IF p_data ? 'weekdays' THEN
  IF jsonb_typeof(p_data->'weekdays') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each_text(p_data->'weekdays') x WHERE x.key!~'^[0-6]$' OR x.value IS NULL OR x.value NOT IN ('available','unavailable','unknown')) THEN RAISE EXCEPTION 'Flags semanais inválidas.' USING errcode='22023'; END IF;
  DELETE FROM public.schedule_availability WHERE person_id=p_id AND origin='daily-profile' AND pattern='weekly';
  FOREACH kind IN ARRAY ARRAY['available','unavailable'] LOOP
   SELECT array_agg(key::smallint ORDER BY key) INTO days FROM jsonb_each_text(p_data->'weekdays') x WHERE x.value=kind;
   IF days IS NOT NULL THEN INSERT INTO public.schedule_availability(person_id,kind,pattern,weekdays,origin) VALUES(p_id,kind,'weekly',days,'daily-profile'); END IF;
  END LOOP;
 END IF;
 IF p_data ? 'unavailable_dates' THEN
  IF jsonb_typeof(p_data->'unavailable_dates') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data->'unavailable_dates')>366 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'unavailable_dates') x WHERE x='null'::jsonb) THEN RAISE EXCEPTION 'Datas indisponíveis inválidas.' USING errcode='22023'; END IF;
  DELETE FROM public.schedule_availability WHERE person_id=p_id AND origin='daily-profile' AND pattern='period';
  FOR day IN SELECT DISTINCT value::date FROM jsonb_array_elements_text(p_data->'unavailable_dates') LOOP INSERT INTO public.schedule_availability(person_id,kind,pattern,starts_on,ends_on,origin) VALUES(p_id,'unavailable','period',day,day,'daily-profile');END LOOP;
 END IF;
 SELECT to_jsonb(p)-ARRAY['normalized_name','auth_user_id'] INTO result FROM public.schedule_people p WHERE id=p_id;
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields) VALUES(u,'daily-member',p_id,(result->>'version')::bigint,ARRAY(SELECT jsonb_object_keys(p_data)));
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_schedule_person_history(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador consulta este histórico.' USING errcode='42501'; END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('department',d.name,'role',r.name,'event',e.title,'status',p.status) ORDER BY a.assigned_on DESC) FROM public.schedule_assignments a JOIN public.schedule_requirements req ON req.id=a.requirement_id JOIN public.schedule_roles r ON r.id=req.role_id JOIN public.schedule_departments d ON d.id=a.department_id JOIN public.schedule_events e ON e.id=req.event_id JOIN public.schedule_plans p ON p.id=a.plan_id WHERE a.person_id=p_person),'[]'::jsonb),
 'versions',coalesce((SELECT jsonb_agg(x) FROM (SELECT v.plan_id,v.version,v.captured_at,v.snapshot->>'title' title,v.snapshot->>'status' status FROM public.schedule_versions v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'requirements') req CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') a WHERE a->>'person_id'=p_person::text) ORDER BY v.captured_at DESC LIMIT 200) x),'[]'::jsonb));
END $$;
CREATE FUNCTION public.iasdpi_schedule_exceptions() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador consulta exceções.' USING errcode='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.day DESC) FROM public.schedule_day_exceptions x),'[]'::jsonb);
END $$;
CREATE FUNCTION public.iasdpi_schedule_exception_save(p_id uuid,p_expected_version bigint,p_data jsonb) RETURNS jsonb
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
 IF NOT v_enabled AND EXISTS(SELECT 1 FROM public.schedule_assignments x CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(x) occupied JOIN public.schedule_assignments y ON y.person_id=x.person_id AND y.department_id=b CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(y) occupied_y WHERE x.person_id=person AND x.department_id=a AND occupied=day AND occupied_y=day) THEN RAISE EXCEPTION 'Exceção em uso. Corrija uma das atribuições antes de revogar.' USING errcode='23514'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO public.schedule_day_exceptions(id,person_id,day,department_a,department_b,reason,enabled,approved_by) VALUES(p_id,person,day,a,b,p_data->>'reason',v_enabled,u);
 ELSE UPDATE public.schedule_day_exceptions SET reason=coalesce(p_data->>'reason',reason),enabled=v_enabled,approved_by=CASE WHEN v_enabled AND NOT old.enabled THEN u ELSE approved_by END,approved_at=CASE WHEN v_enabled AND NOT old.enabled THEN now() ELSE approved_at END,revoked_by=CASE WHEN NOT v_enabled THEN u ELSE NULL END,revoked_at=CASE WHEN NOT v_enabled THEN now() ELSE NULL END,version=version+1 WHERE id=p_id; END IF;
 SELECT to_jsonb(x) INTO result FROM public.schedule_day_exceptions x WHERE id=p_id;
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'daily-exception',p_id,(result->>'version')::bigint,ARRAY(SELECT jsonb_object_keys(p_data)),p_data->>'reason');RETURN result;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_schedule_workspace(uuid,date),public.iasdpi_schedule_settings_get(),public.iasdpi_schedule_settings_save(bigint,jsonb),public.iasdpi_schedule_generate_days(uuid,text,uuid),public.iasdpi_schedule_members(),public.iasdpi_schedule_member_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_person_history(uuid),public.iasdpi_schedule_exceptions(),public.iasdpi_schedule_exception_save(uuid,bigint,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_schedule_workspace(uuid,date),public.iasdpi_schedule_settings_get(),public.iasdpi_schedule_settings_save(bigint,jsonb),public.iasdpi_schedule_generate_days(uuid,text,uuid),public.iasdpi_schedule_members(),public.iasdpi_schedule_member_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_person_history(uuid),public.iasdpi_schedule_exceptions(),public.iasdpi_schedule_exception_save(uuid,bigint,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
