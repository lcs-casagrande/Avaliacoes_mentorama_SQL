-- 024: compatibilidade da Comunicação e publicação com vagas reais em aberto.
-- Somente revisão; executar após 001–023 e autorização. Não aprova eventos.
BEGIN;
DO $$ BEGIN IF current_user<>'postgres' OR to_regprocedure('iasdpi_schedule_private.edit_bounds()') IS NULL THEN RAISE EXCEPTION 'Exige postgres e migrações 001–023.';END IF;END $$;
CREATE FUNCTION iasdpi_schedule_private.departments_conflict(a uuid,b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a IS DISTINCT FROM b AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id IN(a,b) AND d.code='comunicacao');
$$;
-- O helper legado é usado por todos os validadores e contextos. Compatibilidade
-- fixa não cria uma exceção administrativa nem altera a tabela de auditoria.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.has_day_exception(uuid,date,uuid,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.has_day_exception(','FUNCTION iasdpi_schedule_private.has_day_exception_before_024(');
END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.has_day_exception(p_person uuid,p_day date,p_a uuid,p_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT iasdpi_schedule_private.departments_conflict(p_a,p_b) OR iasdpi_schedule_private.has_day_exception_before_024(p_person,p_day,p_a,p_b);
$$;
-- Preserva o OID e os validadores de autorização, datas, CAS e conflito.
DO $$ DECLARE body text;start_at integer;end_at integer;block text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.plan_save_007(uuid,bigint,jsonb,uuid)'::regprocedure);
 IF strpos(body,'schedule-edit-window-023')=0 THEN RAISE EXCEPTION 'Núcleo incompatível: preservação de datas encerradas ausente.';END IF;
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.plan_save_007(','FUNCTION iasdpi_schedule_private.plan_save_007_before_024(');
 start_at:=strpos(body,' IF next_status=''published'' AND (NOT EXISTS');
 IF start_at=0 THEN RAISE EXCEPTION 'Núcleo incompatível: validação de cobertura não localizada.';END IF;
 end_at:=strpos(substr(body,start_at),' result:=iasdpi_schedule_private.plan_snapshot(p_id);');
 IF end_at=0 THEN RAISE EXCEPTION 'Núcleo incompatível: limite de cobertura não localizado.';END IF;
 block:=substr(body,start_at,end_at-1);
 body:=replace(body,block,' IF next_status=''published'' AND NOT EXISTS(SELECT 1 FROM public.schedule_requirements WHERE plan_id=p_id) THEN RAISE EXCEPTION ''Cadastre ao menos uma vaga antes de publicar a escala.'' USING errcode=''23514'';END IF;'||chr(10));
 EXECUTE body;
END $$;
-- A pessoa pode permanecer nula em um período publicado, indicando A definir.
DO $$ DECLARE constraint_name text;BEGIN
 SELECT conname INTO STRICT constraint_name FROM pg_constraint WHERE conrelid='public.schedule_elder_periods'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%person_id IS NOT NULL%' AND pg_get_constraintdef(oid) LIKE '%published%';
 EXECUTE format('ALTER TABLE public.schedule_elder_periods DROP CONSTRAINT %I',constraint_name);
END $$;
-- A 023 continua envolvendo esta implementação e bloqueando períodos encerrados.
DO $$ DECLARE body text;old text:='IF p_status=''published'' AND p IS NULL THEN RAISE EXCEPTION ''Publicação bloqueada: há períodos sem ancião.'' USING errcode=''23514'';END IF;';BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.elder_save_before_023(uuid,text,jsonb,uuid)'::regprocedure);
 IF strpos(body,old)=0 THEN RAISE EXCEPTION 'Núcleo do Ancionato incompatível.';END IF;
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.elder_save_before_023(','FUNCTION iasdpi_schedule_private.elder_save_before_023_before_024(');
 EXECUTE replace(body,old,'-- 024: pessoa nula representa uma vaga publicada, sem compromisso atribuído.');
END $$;
-- Alimenta as consultas existentes ANTES do filtro de privacidade da 021.
-- Somente versões efetivamente publicadas; revisões em rascunho não vazam.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.published_before_privacy(date)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.published_before_privacy(','FUNCTION iasdpi_schedule_private.published_before_privacy_before_024(');
END $$;
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.published_before_privacy(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_schedule_private.published_before_privacy_before_024(p_month);
 RETURN rows||coalesce((WITH latest AS(
 SELECT p.id,p.department_id,d.name department,v.version,v.captured_at,v.snapshot
 FROM public.schedule_plans p JOIN public.schedule_departments d ON d.id=p.department_id AND d.active
 CROSS JOIN LATERAL(SELECT x.version,x.captured_at,x.snapshot FROM public.schedule_versions x WHERE x.plan_id=p.id AND x.snapshot->>'status'='published' ORDER BY x.version DESC LIMIT 1) v
 WHERE p.month=p_month AND p.church_id=public.iasdpi_current_church_id())
 SELECT jsonb_agg(jsonb_build_object('id','pending:'||p.id::text||':'||(req->>'id'),'date',e.scheduled_on,'department_id',p.department_id,'department',p.department,'person','','role',r.name,'event',e.title,'version',p.version,'published_at',p.captured_at,'origin','Escala publicada no sistema','pending',true,'vacancy_count',(req->>'required_count')::integer-jsonb_array_length(req->'assignments')))
 FROM latest p CROSS JOIN LATERAL jsonb_array_elements(p.snapshot->'requirements') req
 JOIN public.schedule_events e ON e.id=(req->>'event_id')::uuid AND e.scheduled_on>=p_month AND e.scheduled_on<(p_month+interval '1 month')::date
 JOIN public.schedule_roles r ON r.id=(req->>'role_id')::uuid AND r.department_id=p.department_id
 WHERE (req->>'required_count')::integer>jsonb_array_length(req->'assignments')),'[]')||
 coalesce((SELECT jsonb_agg(jsonb_build_object('id','elder-pending:'||p.id::text,'date',p.starts_on,'startDate',p.starts_on,'endDate',p.ends_on,'kind',p.kind,'department_id',p.department_id,'department',d.name,'person','','role',CASE WHEN p.kind='weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,'version',p.version,'published_at',p.captured_at,'origin','Escala publicada no sistema','pending',true,'vacancy_count',1))
 FROM iasdpi_schedule_private.published_elder_periods p JOIN public.schedule_departments d ON d.id=p.department_id AND d.active
 WHERE p.person_id IS NULL AND p.starts_on<=(p_month+interval '1 month - 1 day')::date AND p.ends_on>=p_month),'[]');
END $$;
ALTER FUNCTION public.iasdpi_schedule_settings_get() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() RENAME TO settings_get_before_024;
CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_schedule_private.settings_get_before_024()||jsonb_build_object('allow_pending_publication',true,'non_blocking_department_codes',jsonb_build_array('comunicacao'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname='iasdpi_schedule_settings_get' OR n.nspname='iasdpi_schedule_private' AND p.proname IN('departments_conflict','has_day_exception','has_day_exception_before_024','plan_save_007_before_024','elder_save_before_023_before_024','published_before_privacy','published_before_privacy_before_024','settings_get_before_024') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
