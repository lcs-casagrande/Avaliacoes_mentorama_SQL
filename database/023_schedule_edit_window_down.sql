-- Reverte somente funções/política temporal. Não exclui escalas, versões ou configurações.
BEGIN;
DO $$ BEGIN IF current_user<>'postgres' THEN RAISE EXCEPTION 'Exige postgres e revisão administrativa.';END IF;END $$;
DROP FUNCTION public.iasdpi_schedule_prepare_month(uuid,date,uuid,text),public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_event_create(uuid,jsonb,uuid),public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid),public.iasdpi_schedule_settings_get(),public.iasdpi_schedule_rotation_context(uuid,date);
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT * FROM (VALUES('plan_save_before_023','iasdpi_schedule_plan_save','uuid,bigint,jsonb,uuid'),('event_create_before_023','iasdpi_schedule_event_create','uuid,jsonb,uuid'),('elder_save_before_023','iasdpi_schedule_elder_save','uuid,text,jsonb,uuid'),('settings_get_before_023','iasdpi_schedule_settings_get',''),('rotation_context_before_023','iasdpi_schedule_rotation_context','uuid,date')) v(old_name,new_name,args) LOOP
 EXECUTE format('ALTER FUNCTION iasdpi_schedule_private.%I(%s) RENAME TO %I',f.old_name,f.args,f.new_name);
 EXECUTE format('ALTER FUNCTION iasdpi_schedule_private.%I(%s) SET SCHEMA public',f.new_name,f.args);
 EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.new_name,f.args);
 END LOOP;
 EXECUTE replace(pg_get_functiondef('iasdpi_schedule_private.plan_save_007_before_023(uuid,bigint,jsonb,uuid)'::regprocedure),'FUNCTION iasdpi_schedule_private.plan_save_007_before_023(','FUNCTION iasdpi_schedule_private.plan_save_007(');
END $$;
DROP FUNCTION iasdpi_schedule_private.plan_save_007_before_023(uuid,bigint,jsonb,uuid),iasdpi_schedule_private.frozen_requirements(jsonb,date),iasdpi_schedule_private.assert_edit_day(date),iasdpi_schedule_private.assert_edit_month(date),iasdpi_schedule_private.edit_bounds();
NOTIFY pgrst,'reload schema';
COMMIT;
