-- Revisão: 001–022 obrigatórias. Não altera dados/histórico nem aplica configuração em produção.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean)') IS NULL
 OR to_regprocedure('iasdpi_schedule_private.plan_save_007(uuid,bigint,jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'Instale 001–022 como postgres.';END IF;
END $$;
CREATE FUNCTION iasdpi_schedule_private.edit_bounds() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE first_day date:=(clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;n integer;BEGIN
 SELECT planning_months INTO STRICT n FROM public.schedule_settings;
 RETURN jsonb_build_object('schedule_edit_policy',true,'today',first_day,'editable_from',first_day,'editable_until',(date_trunc('month',first_day)+(n+1)*interval '1 month'-interval '1 day')::date);
END $$;
CREATE FUNCTION iasdpi_schedule_private.assert_edit_day(day date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE b jsonb:=iasdpi_schedule_private.edit_bounds();BEGIN
 IF day IS NULL OR day<(b->>'editable_from')::date THEN RAISE EXCEPTION 'Data encerrada: dias anteriores a hoje são somente para consulta.' USING errcode='23514';END IF;
 IF day>(b->>'editable_until')::date THEN RAISE EXCEPTION 'Data fora do período de edição. Solicite ao administrador a liberação de meses futuros.' USING errcode='23514';END IF;
END $$;
CREATE FUNCTION iasdpi_schedule_private.assert_edit_month(month date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE b jsonb:=iasdpi_schedule_private.edit_bounds();BEGIN
 IF month IS NULL OR month<date_trunc('month',(b->>'today')::date)::date OR month>(b->>'editable_until')::date THEN RAISE EXCEPTION 'Mês somente para consulta. O mês atual sempre está liberado; meses futuros dependem da configuração administrativa.' USING errcode='23514';END IF;
END $$;
-- Normaliza somente campos editáveis; ordem de arrays, aliases e nomes não alteram a identidade.
CREATE FUNCTION iasdpi_schedule_private.frozen_requirements(data jsonb,cutoff date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r->>'id','event_id',r->>'event_id','role_id',r->>'role_id','required_count',(r->>'required_count')::integer,'notes',coalesce(r->>'notes',''),
 'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a->>'id','person_id',a->>'person_id','timing_mode',coalesce(a->>'timing_mode',e.timing_mode),'starts_at',coalesce(nullif(a->>'starts_at','')::timestamptz,e.starts_at),'ends_at',coalesce(nullif(a->>'ends_at','')::timestamptz,e.ends_at)) ORDER BY a->>'id') FROM jsonb_array_elements(coalesce(r->'assignments','[]')) a),'[]')) ORDER BY r->>'id'),'[]')
 FROM jsonb_array_elements(coalesce(data->'requirements','[]')) r JOIN public.schedule_events e ON e.id=(r->>'event_id')::uuid WHERE e.scheduled_on<cutoff;
$$;
-- Preserva a implementação anterior sem substituir o OID original (invalida caches).
DO $$ DECLARE body text;old text;new text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.plan_save_007(uuid,bigint,jsonb,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.plan_save_007(', 'FUNCTION iasdpi_schedule_private.plan_save_007_before_023(');
 old:='DELETE FROM public.schedule_assignments WHERE plan_id=p_id;';new:='DELETE FROM public.schedule_assignments removed_assignment WHERE removed_assignment.plan_id=p_id AND EXISTS(SELECT 1 FROM public.schedule_requirements retained_req JOIN public.schedule_events retained_event ON retained_event.id=retained_req.event_id WHERE retained_req.id=removed_assignment.requirement_id AND retained_event.scheduled_on>=(iasdpi_schedule_private.edit_bounds()->>''today'')::date);';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (atribuições).';END IF;body:=replace(body,old,new);
 old:='DELETE FROM public.schedule_requirements WHERE plan_id=p_id;';new:='DELETE FROM public.schedule_requirements retained_req WHERE retained_req.plan_id=p_id AND EXISTS(SELECT 1 FROM public.schedule_events retained_event WHERE retained_event.id=retained_req.event_id AND retained_event.scheduled_on>=(iasdpi_schedule_private.edit_bounds()->>''today'')::date);';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (funções).';END IF;body:=replace(body,old,new);
 old:='INSERT INTO public.schedule_requirements(id,plan_id,department_id,event_id,role_id,required_count,notes)';new:='IF e.scheduled_on<(iasdpi_schedule_private.edit_bounds()->>''today'')::date THEN CONTINUE;END IF; -- schedule-edit-window-023: passado previamente comparado e preservado'||chr(10)||old;
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (passado).';END IF;body:=replace(body,old,new);
 old:='coverage.plan_id=p_id AND (SELECT';new:='coverage.plan_id=p_id AND EXISTS(SELECT 1 FROM public.schedule_events dated WHERE dated.id=coverage.event_id AND dated.scheduled_on>=(iasdpi_schedule_private.edit_bounds()->>''today'')::date) AND (SELECT';
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo de escalas incompatível (cobertura).';END IF;body:=replace(body,old,new);
 EXECUTE body;
END $$;
ALTER FUNCTION public.iasdpi_schedule_settings_get() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() RENAME TO settings_get_before_023;
CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_schedule_private.settings_get_before_023()||iasdpi_schedule_private.edit_bounds();END $$;
ALTER FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_rotation_context(uuid,date) RENAME TO rotation_context_before_023;
CREATE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_schedule_private.rotation_context_before_023(p_department,p_month)||iasdpi_schedule_private.edit_bounds();END $$;
ALTER FUNCTION public.iasdpi_schedule_event_create(uuid,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_event_create(uuid,jsonb,uuid) RENAME TO event_create_before_023;
CREATE FUNCTION public.iasdpi_schedule_event_create(p_id uuid,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.has_capability(u,(p_data->>'department_id')::uuid,'edit') THEN RAISE EXCEPTION 'Sem edição neste departamento.' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id) THEN
 PERFORM iasdpi_schedule_private.assert_edit_day((p_data->>'date')::date);
 IF nullif(p_data->>'end_date','') IS NOT NULL THEN PERFORM iasdpi_schedule_private.assert_edit_day((p_data->>'end_date')::date);END IF;END IF;
 RETURN iasdpi_schedule_private.event_create_before_023(p_id,p_data,p_request_id);
END $$;
ALTER FUNCTION public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid) RENAME TO plan_save_before_023;
CREATE FUNCTION public.iasdpi_schedule_plan_save(p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;old jsonb;mon date;d uuid;today date;result jsonb;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 old:=iasdpi_schedule_private.plan_snapshot(p_id);d:=coalesce((old->>'department_id')::uuid,(p_data->>'department_id')::uuid);
 IF NOT iasdpi_schedule_private.has_capability(u,d,'edit') AND NOT iasdpi_schedule_private.has_capability(u,d,'publish') THEN RAISE EXCEPTION 'Sem edição/publicação deste departamento.' USING errcode='42501';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id) THEN RETURN iasdpi_schedule_private.plan_save_before_023(p_id,p_expected_version,p_data,p_request_id);END IF;
 mon:=coalesce((old->>'month')::date,(p_data->>'month')::date);PERFORM iasdpi_schedule_private.assert_edit_month(mon);today:=(iasdpi_schedule_private.edit_bounds()->>'today')::date;
 IF p_data ? 'requirements' THEN
 IF iasdpi_schedule_private.frozen_requirements(p_data,today) IS DISTINCT FROM iasdpi_schedule_private.frozen_requirements(old,today) THEN RAISE EXCEPTION 'Datas encerradas não podem ser alteradas, incluídas ou removidas. Preserve os registros anteriores a hoje.' USING errcode='23514';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'requirements') r JOIN public.schedule_events e ON e.id=(r->>'event_id')::uuid WHERE e.scheduled_on>(iasdpi_schedule_private.edit_bounds()->>'editable_until')::date) THEN RAISE EXCEPTION 'Data fora do período de edição.' USING errcode='23514';END IF;END IF;
 result:=iasdpi_schedule_private.plan_save_before_023(p_id,p_expected_version,p_data,p_request_id);
 IF iasdpi_schedule_private.frozen_requirements(result,today) IS DISTINCT FROM iasdpi_schedule_private.frozen_requirements(old,today) THEN RAISE EXCEPTION 'Os registros encerrados devem permanecer intactos.' USING errcode='23514';END IF;
 RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid) RENAME TO elder_save_before_023;
CREATE FUNCTION public.iasdpi_schedule_elder_save(p_department uuid,p_status text,p_rows jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;item jsonb;b jsonb;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.has_capability(u,p_department,CASE WHEN p_status='published' THEN 'publish' ELSE 'edit' END) THEN RAISE EXCEPTION 'Sem permissão para esta ação do Ancionato.' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id) THEN
 b:=iasdpi_schedule_private.edit_bounds();FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 IF (item->>'ends_on')::date<(b->>'today')::date OR (item->>'starts_on')::date>(b->>'editable_until')::date THEN RAISE EXCEPTION 'Período do Ancionato somente para consulta. Edite períodos em curso ou meses futuros liberados.' USING errcode='23514';END IF;END LOOP;END IF;
 RETURN iasdpi_schedule_private.elder_save_before_023(p_department,p_status,p_rows,p_request_id);
END $$;
CREATE FUNCTION public.iasdpi_schedule_prepare_month(p_department uuid,p_month date,p_request_id uuid,p_title text DEFAULT 'Culto') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;d public.schedule_departments;s public.schedule_settings;b jsonb;day date;e jsonb;events jsonb:='[]';sig text;receipt iasdpi_operational_private.receipts;result jsonb;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 SELECT * INTO d FROM public.schedule_departments WHERE id=p_department AND active;
 IF d.id IS NULL OR NOT iasdpi_schedule_private.has_capability(u,d.id,'edit') THEN RAISE EXCEPTION 'Sem edição neste departamento.' USING errcode='42501';END IF;
 sig:='schedule-prepare-023:'||iasdpi_operational_private.fingerprint(jsonb_build_array(public.iasdpi_current_church_id(),p_department,p_month,p_title));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.';END IF;RETURN receipt.response;END IF;
 PERFORM iasdpi_schedule_private.assert_edit_month(p_month);
 IF extract(day FROM p_month)<>1 OR p_request_id IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Mês, título ou solicitação inválidos.';END IF;
 SELECT * INTO STRICT s FROM public.schedule_settings;b:=iasdpi_schedule_private.edit_bounds();
 FOR day IN SELECT generate_series(p_month::timestamp,(p_month+interval '1 month - 1 day')::timestamp,'1 day')::date LOOP
 IF day>=(b->>'today')::date AND (extract(dow FROM day)::smallint=ANY(d.planning_weekdays) OR day=ANY(s.extra_dates)) THEN
 e:=public.iasdpi_schedule_event_create(gen_random_uuid(),jsonb_build_object('department_id',d.id,'title',p_title,'date',day),gen_random_uuid());events:=events||jsonb_build_array(e);END IF;END LOOP;
 result:=jsonb_build_object('events',events,'settings_version',s.version,'month',p_month);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_schedule_settings_get','iasdpi_schedule_rotation_context','iasdpi_schedule_event_create','iasdpi_schedule_plan_save','iasdpi_schedule_elder_save','iasdpi_schedule_prepare_month') OR
 n.nspname='iasdpi_schedule_private' AND p.proname IN('edit_bounds','assert_edit_day','assert_edit_month','frozen_requirements','plan_save_007_before_023','settings_get_before_023','rotation_context_before_023','event_create_before_023','plan_save_before_023','elder_save_before_023') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
