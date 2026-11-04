-- IASDPI — B1. Revisar e executar somente após 001–005, como postgres.
-- Não importa nem altera pessoas, fontes legadas, cultos ou agenda oficial.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_schedule_catalog()') IS NULL THEN
  RAISE EXCEPTION 'Execute 001–005 antes da 006, usando postgres.';
 END IF;
END $$;

CREATE TABLE public.schedule_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 normalized_title text GENERATED ALWAYS AS (iasdpi_schedule_private.normal_name(title)) STORED,
 scheduled_on date NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 source text, source_key text, created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '7 days'),
 CHECK(scheduled_on=(starts_at AT TIME ZONE 'America/Sao_Paulo')::date),
 CHECK((source IS NULL AND source_key IS NULL) OR (source IS NOT NULL AND source_key IS NOT NULL AND length(btrim(source)) BETWEEN 1 AND 100 AND length(btrim(source_key)) BETWEEN 1 AND 300)),
 UNIQUE(normalized_title,starts_at), UNIQUE(source,source_key)
);
CREATE INDEX schedule_events_month_idx ON public.schedule_events(scheduled_on);
CREATE TABLE public.schedule_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_id uuid NOT NULL REFERENCES public.schedule_departments(id),
 month date NOT NULL CHECK(extract(day FROM month)=1), title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_by uuid NOT NULL REFERENCES auth.users(id), updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(department_id,month), UNIQUE(id,department_id)
);
CREATE TABLE public.schedule_requirements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, department_id uuid NOT NULL,
 event_id uuid NOT NULL REFERENCES public.schedule_events(id), role_id uuid NOT NULL,
 required_count integer NOT NULL CHECK(required_count BETWEEN 1 AND 100), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 FOREIGN KEY(plan_id,department_id) REFERENCES public.schedule_plans(id,department_id),
 FOREIGN KEY(role_id,department_id) REFERENCES public.schedule_roles(id,department_id),
 UNIQUE(plan_id,event_id,role_id), UNIQUE(id,plan_id,department_id)
);
CREATE INDEX schedule_requirements_event_idx ON public.schedule_requirements(event_id);
CREATE TABLE public.schedule_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requirement_id uuid NOT NULL, plan_id uuid NOT NULL, department_id uuid NOT NULL,
 person_id uuid NOT NULL REFERENCES public.schedule_people(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 FOREIGN KEY(requirement_id,plan_id,department_id) REFERENCES public.schedule_requirements(id,plan_id,department_id),
 CHECK(ends_at>starts_at), UNIQUE(requirement_id,person_id)
);
CREATE INDEX schedule_assignments_person_idx ON public.schedule_assignments(person_id,starts_at,ends_at);
CREATE INDEX schedule_assignments_plan_idx ON public.schedule_assignments(plan_id);
CREATE TABLE public.schedule_versions (
 plan_id uuid NOT NULL REFERENCES public.schedule_plans(id), version bigint NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id), captured_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL,
 PRIMARY KEY(plan_id,version)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_events','schedule_plans','schedule_requirements','schedule_assignments','schedule_versions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated',t);
 END LOOP;
END $$;

CREATE FUNCTION iasdpi_schedule_private.plan_snapshot(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT to_jsonb(p)||jsonb_build_object('requirements',coalesce((SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object(
 'assignments',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.schedule_assignments a WHERE a.requirement_id=r.id),'[]'::jsonb)) ORDER BY r.id)
 FROM public.schedule_requirements r WHERE r.plan_id=p.id),'[]'::jsonb)) FROM public.schedule_plans p WHERE p.id=p_id;
$$;

-- Serviço único de validação, chamado pela gravação e por gatilhos de integridade.
-- Na B1 funções distintas são exclusivas por padrão: não há exceção implícita.
CREATE FUNCTION iasdpi_schedule_private.validate_assignment(a public.schedule_assignments) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.schedule_requirements; e public.schedule_events; BEGIN
 SELECT * INTO STRICT r FROM public.schedule_requirements WHERE id=a.requirement_id;
 SELECT * INTO STRICT e FROM public.schedule_events WHERE id=r.event_id;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id
 JOIN public.schedule_qualifications q ON q.membership_id=m.id JOIN public.schedule_roles role ON role.id=q.role_id
 JOIN public.schedule_departments d ON d.id=m.department_id
 WHERE p.id=a.person_id AND p.active AND m.active AND d.active AND role.active AND m.department_id=r.department_id AND q.role_id=r.role_id) THEN
  RAISE EXCEPTION 'Voluntário sem habilitação ativa para esta função e departamento.' USING errcode='23514'; END IF;
 IF a.starts_at<e.starts_at OR a.ends_at>e.ends_at OR a.ends_at<=a.starts_at THEN
  RAISE EXCEPTION 'A participação deve estar dentro do horário do evento.' USING errcode='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_assignments other WHERE other.person_id=a.person_id AND other.id<>a.id
 AND tstzrange(other.starts_at,other.ends_at,'[)') && tstzrange(a.starts_at,a.ends_at,'[)')) THEN
  RAISE EXCEPTION 'Conflito: voluntário já escalado em horário sobreposto, inclusive em outro departamento.' USING errcode='23P01'; END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_availability v WHERE v.person_id=a.person_id AND v.active AND v.kind='unavailable'
 AND (v.department_id IS NULL OR v.department_id=r.department_id) AND (
 (v.pattern='period' AND tstzrange((v.starts_on+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN v.ends_on+1 ELSE v.ends_on END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))
 OR (v.pattern='weekly' AND EXISTS(SELECT 1 FROM generate_series((a.starts_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,
 (a.ends_at AT TIME ZONE 'America/Sao_Paulo')::date::timestamp,interval '1 day') AS days(day)
 WHERE extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day::date>=v.valid_from) AND (v.valid_until IS NULL OR day::date<=v.valid_until)
 AND tstzrange((day::date+coalesce(v.start_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo',
 ((CASE WHEN v.end_time IS NULL THEN day::date+1 ELSE day::date END)+coalesce(v.end_time,time '00:00')) AT TIME ZONE 'America/Sao_Paulo','[)') && tstzrange(a.starts_at,a.ends_at,'[)'))))) THEN
  RAISE EXCEPTION 'Conflito: voluntário indisponível no período informado.' USING errcode='23514'; END IF;
END $$;
CREATE FUNCTION iasdpi_schedule_private.assignment_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 PERFORM iasdpi_schedule_private.validate_assignment(NEW); RETURN NEW;
END $$;
CREATE TRIGGER schedule_assignment_guard BEFORE INSERT OR UPDATE ON public.schedule_assignments
 FOR EACH ROW EXECUTE FUNCTION iasdpi_schedule_private.assignment_guard();

-- A alteração posterior de disponibilidade/habilitação também não pode invalidar uma escala.
-- Diferido para permitir que a RPC 005 substitua o conjunto de habilitações atomicamente.
CREATE FUNCTION iasdpi_schedule_private.revalidate_plans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.schedule_assignments; BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 FOR a IN SELECT * FROM public.schedule_assignments LOOP PERFORM iasdpi_schedule_private.validate_assignment(a); END LOOP;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_people','schedule_memberships','schedule_roles','schedule_qualifications','schedule_availability','schedule_departments'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER schedule_b1_revalidate AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION iasdpi_schedule_private.revalidate_plans()',t);
 END LOOP;
END $$;

CREATE FUNCTION public.iasdpi_schedule_workspace(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.can_view(u,p_department) OR NOT (iasdpi_schedule_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM public.schedule_department_access WHERE user_id=u AND department_id=p_department AND enabled)) THEN
  RAISE EXCEPTION 'Sem consulta de escalas deste departamento.' USING errcode='42501'; END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 THEN RAISE EXCEPTION 'Informe o primeiro dia do mês.' USING errcode='22023'; END IF;
 RETURN jsonb_build_object('plan',(SELECT iasdpi_schedule_private.plan_snapshot(id) FROM public.schedule_plans WHERE department_id=p_department AND month=p_month),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e)-'normalized_title' ORDER BY starts_at,id) FROM public.schedule_events e WHERE scheduled_on>=p_month AND scheduled_on<(p_month+interval '1 month')::date),'[]'::jsonb),
 'versions',coalesce((SELECT jsonb_agg(jsonb_build_object('version',v.version,'actor_id',v.actor_id,'captured_at',v.captured_at) ORDER BY v.version DESC)
 FROM public.schedule_versions v JOIN public.schedule_plans p ON p.id=v.plan_id WHERE p.department_id=p_department AND p.month=p_month),'[]'::jsonb));
END $$;
CREATE FUNCTION public.iasdpi_schedule_plan_version(p_id uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor(); d uuid; BEGIN
 SELECT department_id INTO d FROM public.schedule_plans WHERE id=p_id;
 -- Reutiliza exatamente a verificação de consulta do workspace, sem devolver outros departamentos.
 PERFORM public.iasdpi_schedule_workspace(d,(SELECT month FROM public.schedule_plans WHERE id=p_id));
 RETURN (SELECT snapshot FROM public.schedule_versions WHERE plan_id=p_id AND version=p_version);
END $$;

-- Eventos compartilhados são imutáveis nesta fase. Repetir título+início ou origem reutiliza o UUID.
CREATE FUNCTION public.iasdpi_schedule_event_create(p_id uuid,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; d uuid; day date; finish_day date; first_at timestamptz; last_at timestamptz; old public.schedule_events;
 signature text; receipt iasdpi_operational_private.receipts; result jsonb;
BEGIN
 u:=iasdpi_schedule_private.actor(); UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton; u:=iasdpi_schedule_private.actor();
 d:=(p_data->>'department_id')::uuid;
 IF NOT iasdpi_schedule_private.can_manage(u,d) OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=d AND active) THEN
  RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>8000
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(ARRAY['department_id','title','date','end_date','start_time','end_time','source','source_key']))
 OR coalesce(p_data->>'start_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(p_data->>'end_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
  RAISE EXCEPTION 'Evento inválido. Informe título, data e horários HH:mm.' USING errcode='22023'; END IF;
 IF ((p_data->>'source') IS NULL)<>((p_data->>'source_key') IS NULL)
 OR (p_data->>'source' IS NOT NULL AND (length(btrim(p_data->>'source')) NOT BETWEEN 1 AND 100 OR length(btrim(p_data->>'source_key')) NOT BETWEEN 1 AND 300)) THEN
  RAISE EXCEPTION 'Informe origem e identificador externo juntos, ou deixe ambos vazios.' USING errcode='22023'; END IF;
 day:=(p_data->>'date')::date; finish_day:=coalesce((p_data->>'end_date')::date,day);
 first_at:=(day+(p_data->>'start_time')::time) AT TIME ZONE 'America/Sao_Paulo';
 last_at:=(finish_day+(p_data->>'end_time')::time) AT TIME ZONE 'America/Sao_Paulo';
 IF day IS NULL OR last_at<=first_at THEN RAISE EXCEPTION 'Informe um término posterior ao início (e data final em eventos noturnos).' USING errcode='22023'; END IF;
 signature:='schedule-b1-event:'||iasdpi_operational_private.fingerprint(jsonb_build_object('id',p_id,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
  RETURN receipt.response;
 END IF;
 SELECT * INTO old FROM public.schedule_events WHERE id=p_id OR (normalized_title=iasdpi_schedule_private.normal_name(p_data->>'title') AND starts_at=first_at)
 OR (source=p_data->>'source' AND source_key=p_data->>'source_key') ORDER BY id LIMIT 1;
 IF FOUND THEN
  IF p_data->>'source' IS NOT NULL AND (old.source IS DISTINCT FROM p_data->>'source' OR old.source_key IS DISTINCT FROM p_data->>'source_key') THEN
   RAISE EXCEPTION 'Já existe evento equivalente com outra referência. Revise a identidade; nenhuma associação foi feita automaticamente.' USING errcode='23505'; END IF;
  IF old.starts_at<>first_at OR old.ends_at<>last_at OR old.normalized_title<>iasdpi_schedule_private.normal_name(p_data->>'title') OR old.scheduled_on<>day THEN
   RAISE EXCEPTION 'Já existe um evento com esta identidade e horários diferentes. Reutilize o evento existente; nada foi sobrescrito.' USING errcode='23505'; END IF;
  result:=to_jsonb(old)-'normalized_title';
 ELSE
  INSERT INTO public.schedule_events(id,title,scheduled_on,starts_at,ends_at,source,source_key,created_by)
  VALUES(p_id,p_data->>'title',day,first_at,last_at,p_data->>'source',p_data->>'source_key',u) RETURNING to_jsonb(schedule_events.*)-'normalized_title' INTO result;
  INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields) VALUES(u,'b1-event',p_id,d,1,ARRAY['create']);
 END IF;
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,signature,result,now()); RETURN result;
END $$;

CREATE FUNCTION public.iasdpi_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
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
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE NOT k=ANY(ARRAY['id','person_id','starts_at','ends_at'])) THEN RAISE EXCEPTION 'Atribuição inválida.' USING errcode='22023'; END IF;
    INSERT INTO public.schedule_assignments(id,requirement_id,plan_id,department_id,person_id,starts_at,ends_at)
    VALUES((item->>'id')::uuid,r.id,p_id,d,(item->>'person_id')::uuid,coalesce((item->>'starts_at')::timestamptz,e.starts_at),coalesce((item->>'ends_at')::timestamptz,e.ends_at));
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_workspace(uuid,date),public.iasdpi_schedule_plan_version(uuid,bigint),
 public.iasdpi_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_workspace(uuid,date),public.iasdpi_schedule_plan_version(uuid,bigint),
 public.iasdpi_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
