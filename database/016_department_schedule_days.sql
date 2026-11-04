-- G7: dias por departamento; executar somente após revisão e 001–015 completas.
-- Não remove eventos, planos, atribuições, históricos, contas ou permissões.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid)') IS NULL
 OR to_regprocedure('public.iasdpi_portal_context()') IS NULL THEN RAISE EXCEPTION 'Exige postgres e migrações 001–015 completas.';END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.schedule_departments'::regclass AND attname='planning_weekdays' AND NOT attisdropped) THEN RAISE EXCEPTION '016 já instalada; não sobrescrever.';END IF;
END $$;
ALTER TABLE public.schedule_departments ADD COLUMN planning_weekdays smallint[] NOT NULL DEFAULT ARRAY[3,6,0]::smallint[]
 CHECK(cardinality(planning_weekdays)=0 OR iasdpi_schedule_private.valid_weekdays(planning_weekdays));
-- Preserva a escolha global anterior das igrejas já existentes; departamentos novos
-- começam com quarta/sábado/domingo. Apenas a coluna nova é preenchida.
UPDATE public.schedule_departments d SET planning_weekdays=s.weekdays FROM public.schedule_settings s
 WHERE s.church_id=d.church_id AND s.weekdays IS DISTINCT FROM d.planning_weekdays;
CREATE FUNCTION iasdpi_schedule_private.can_configure_days(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR iasdpi_schedule_private.has_capability(u,d,'members') OR iasdpi_schedule_private.has_capability(u,d,'access');
$$;
CREATE FUNCTION public.iasdpi_schedule_department_days(p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_schedule_private.can_view(u,p_department) OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=p_department AND active) THEN RAISE EXCEPTION 'Sem consulta deste departamento.' USING errcode='42501';END IF;
 RETURN (SELECT jsonb_build_object('department_id',id,'weekdays',planning_weekdays,'version',version,'can_edit',iasdpi_schedule_private.can_configure_days(u,id)) FROM public.schedule_departments WHERE id=p_department AND active);
END $$;
CREATE FUNCTION public.iasdpi_schedule_department_days_save(p_department uuid,p_expected_version bigint,p_weekdays smallint[],p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;d public.schedule_departments;sig text;r iasdpi_operational_private.receipts;result jsonb;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.can_configure_days(u,p_department) THEN RAISE EXCEPTION 'Sem administração deste departamento.' USING errcode='42501';END IF;
 SELECT * INTO d FROM public.schedule_departments WHERE id=p_department AND active FOR UPDATE;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Departamento indisponível nesta igreja.' USING errcode='42501';END IF;
 IF p_expected_version IS NULL OR p_expected_version<1 OR p_request_id IS NULL OR p_weekdays IS NULL OR array_ndims(p_weekdays)>1
 OR NOT (cardinality(p_weekdays)=0 OR iasdpi_schedule_private.valid_weekdays(p_weekdays)) THEN RAISE EXCEPTION 'Dias ou versão inválidos. Use dias únicos de 0 a 6.' USING errcode='22023';END IF;
 sig:='department-days-g7:'||iasdpi_operational_private.fingerprint(jsonb_build_object('department',p_department,'version',p_expected_version,'weekdays',p_weekdays));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF d.version<>p_expected_version THEN RAISE EXCEPTION 'Configuração alterada em outro dispositivo. Recarregue e compare antes de salvar.' USING errcode='40001';END IF;
 UPDATE public.schedule_departments SET planning_weekdays=p_weekdays,version=version+1,updated_at=now() WHERE id=d.id;
 result:=public.iasdpi_schedule_department_days(d.id);
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields)
 VALUES(u,'department-days',d.id,d.id,(result->>'version')::bigint,ARRAY['planning_weekdays']);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_schedule_settings_get() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() RENAME TO settings_get_g5;
CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 RETURN iasdpi_schedule_private.settings_get_g5()||jsonb_build_object('department_days_enabled',true,
 'department_weekdays',coalesce((SELECT jsonb_object_agg(id,planning_weekdays) FROM public.schedule_departments WHERE active AND iasdpi_schedule_private.can_view(u,id)),'{}'),
 'department_days_versions',coalesce((SELECT jsonb_object_agg(id,version) FROM public.schedule_departments WHERE active AND iasdpi_schedule_private.can_view(u,id)),'{}'),
 'department_days_can_edit',coalesce((SELECT jsonb_object_agg(id,iasdpi_schedule_private.can_configure_days(u,id)) FROM public.schedule_departments WHERE active AND iasdpi_schedule_private.can_view(u,id)),'{}'));
END $$;
ALTER FUNCTION public.iasdpi_schedule_settings_save(bigint,jsonb) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_save(bigint,jsonb) RENAME TO settings_save_g5;
CREATE FUNCTION public.iasdpi_schedule_settings_save(p_expected_version bigint,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador altera o período global.' USING errcode='42501';END IF;
 IF p_data ? 'weekdays' AND p_data->'weekdays' IS DISTINCT FROM (SELECT to_jsonb(weekdays) FROM public.schedule_settings) THEN
 RAISE EXCEPTION 'Configure os dias em cada departamento. Os dias globais anteriores foram preservados.' USING errcode='22023';END IF;
 RETURN iasdpi_schedule_private.settings_save_g5(p_expected_version,p_data-'weekdays');
END $$;
-- Mantém a implementação anterior privada para diagnóstico e recuperação revisada.
ALTER FUNCTION public.iasdpi_schedule_generate_days(uuid,text,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_generate_days(uuid,text,uuid) RENAME TO generate_days_g5;
CREATE FUNCTION public.iasdpi_schedule_generate_days(p_department uuid,p_title text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;s public.schedule_settings;d public.schedule_departments;months date[];day date;events jsonb:='[]';sig text;r iasdpi_operational_private.receipts;result jsonb;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.has_capability(u,p_department,'edit') THEN RAISE EXCEPTION 'Sem edição deste departamento.' USING errcode='42501';END IF;
 SELECT * INTO d FROM public.schedule_departments WHERE id=p_department AND active;
 IF d.id IS NULL THEN RAISE EXCEPTION 'Departamento indisponível.' USING errcode='42501';END IF;
 IF p_request_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Informe o nome dos cultos.' USING errcode='22023';END IF;
 sig:='department-generation-g7:'||iasdpi_operational_private.fingerprint(jsonb_build_object('department',p_department,'title',p_title));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 SELECT * INTO s FROM public.schedule_settings;
 months:=iasdpi_schedule_private.future_months((now() AT TIME ZONE 'America/Sao_Paulo')::date,s.planning_months);
 FOR day IN SELECT x::date FROM generate_series(months[1]::timestamp,(months[array_length(months,1)]+interval '1 month - 1 day')::timestamp,interval '1 day') x
 WHERE extract(dow FROM x)::smallint=ANY(d.planning_weekdays) OR x::date=ANY(s.extra_dates) LOOP
 events:=events||jsonb_build_array(public.iasdpi_schedule_event_create(gen_random_uuid(),jsonb_build_object('department_id',p_department,'title',p_title,'date',day),gen_random_uuid()));
 END LOOP;
 result:=jsonb_build_object('months',months,'events',events,'settings_version',s.version,'department_days_version',d.version,'weekdays',d.planning_weekdays);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
ALTER FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_rotation_context(uuid,date) RENAME TO rotation_context_g5;
CREATE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 result:=iasdpi_schedule_private.rotation_context_g5(p_department,p_month);
 RETURN result||jsonb_build_object('planning_weekdays',(SELECT planning_weekdays FROM public.schedule_departments WHERE id=p_department),'extra_dates',(SELECT extra_dates FROM public.schedule_settings));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='iasdpi_schedule_private' AND p.proname IN ('can_configure_days','settings_get_g5','settings_save_g5','generate_days_g5','rotation_context_g5'))
 OR (n.nspname='public' AND p.proname IN ('iasdpi_schedule_department_days','iasdpi_schedule_department_days_save','iasdpi_schedule_settings_get','iasdpi_schedule_settings_save','iasdpi_schedule_generate_days','iasdpi_schedule_rotation_context')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
