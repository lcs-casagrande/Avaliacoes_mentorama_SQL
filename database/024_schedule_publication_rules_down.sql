-- Reversão sem excluir dados. Publicações com pendências exigem recuperação revisada.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Exige postgres.';END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_versions v CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'requirements') r WHERE v.snapshot->>'status'='published' AND (r->>'required_count')::integer>jsonb_array_length(r->'assignments'))
 OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.published_elder_periods WHERE person_id IS NULL)
 OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.confirmed_days a JOIN iasdpi_schedule_private.confirmed_days b ON a.person_id=b.person_id AND a.day=b.day AND a.department_id<>b.department_id WHERE NOT iasdpi_schedule_private.departments_conflict(a.department_id,b.department_id) AND NOT iasdpi_schedule_private.has_day_exception_before_024(a.person_id,a.day,a.department_id,b.department_id)) THEN
 RAISE EXCEPTION 'Rollback recusado: há publicações pendentes ou coincidências autorizadas pela 024. Revise e restaure backup em ambiente isolado; não descarte históricos.';END IF;
END $$;
ALTER TABLE public.schedule_elder_periods ADD CONSTRAINT schedule_elder_periods_check1 CHECK(status<>'published' OR person_id IS NOT NULL);
DROP FUNCTION public.iasdpi_schedule_settings_get();
ALTER FUNCTION iasdpi_schedule_private.settings_get_before_024() RENAME TO iasdpi_schedule_settings_get;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() SET SCHEMA public;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_settings_get() TO authenticated;
DO $$ DECLARE x record;BEGIN
 FOR x IN SELECT * FROM(VALUES('has_day_exception','uuid,date,uuid,uuid'),('plan_save_007','uuid,bigint,jsonb,uuid'),('elder_save_before_023','uuid,text,jsonb,uuid'),('published_before_privacy','date')) v(name,args) LOOP
 EXECUTE replace(pg_get_functiondef(to_regprocedure('iasdpi_schedule_private.'||x.name||'_before_024('||x.args||')')),'FUNCTION iasdpi_schedule_private.'||x.name||'_before_024(','FUNCTION iasdpi_schedule_private.'||x.name||'(');
 EXECUTE format('DROP FUNCTION iasdpi_schedule_private.%I(%s)',x.name||'_before_024',x.args);END LOOP;
END $$;
DROP FUNCTION iasdpi_schedule_private.departments_conflict(uuid,uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
