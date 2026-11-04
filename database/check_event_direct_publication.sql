-- Verificações pós-025: somente leitura. Executar em ambiente autorizado.
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid,n.nspname,p.proname,p.prosecdef,p.proconfig,r.rolname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='iasdpi_schedule_private' AND p.proname LIKE '%_before_025' LOOP
 IF f.rolname<>'iasdpi_church_executor' OR NOT coalesce(f.proconfig @> ARRAY['search_path=""'],false) OR has_function_privilege('anon',f.oid,'EXECUTE') OR has_function_privilege('authenticated',f.oid,'EXECUTE') OR has_function_privilege('service_role',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Backup exposto: %.',f.proname;END IF;END LOOP;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='iasdpi_schedule_private' AND p.proname LIKE '%_before_025')<>7 THEN RAISE EXCEPTION 'Cópias incompletas.';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.iasdpi_event_reservations'::regclass AND contype='x') THEN RAISE EXCEPTION 'Exclusão de reservas ausente.';END IF;
 IF has_function_privilege('anon','public.iasdpi_event_submit(uuid,bigint,jsonb,uuid,boolean)','EXECUTE') OR NOT has_function_privilege('authenticated','public.iasdpi_event_submit(uuid,bigint,jsonb,uuid,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Permissões inválidas.';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN('public.iasdpi_events'::regclass,'public.iasdpi_event_series'::regclass,'public.iasdpi_event_reservations'::regclass) AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'RLS ausente.';END IF;
END $$;
