-- Somente leitura, como postgres, após 007. Esperado: nenhuma irregularidade.
WITH required_tables(name) AS (VALUES('schedule_settings'),('schedule_day_exceptions')),
required_functions(signature) AS (VALUES
 ('public.iasdpi_schedule_settings_get()'),('public.iasdpi_schedule_settings_save(bigint,jsonb)'),
 ('public.iasdpi_schedule_generate_days(uuid,text,uuid)'),('public.iasdpi_schedule_member_save(uuid,bigint,jsonb,uuid)'),
 ('public.iasdpi_schedule_members()'),('public.iasdpi_schedule_person_history(uuid)'),
 ('public.iasdpi_schedule_exceptions()'),('public.iasdpi_schedule_exception_save(uuid,bigint,jsonb)'),
 ('public.iasdpi_schedule_event_create(uuid,jsonb,uuid)'),('public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid)'),('public.iasdpi_schedule_workspace(uuid,date)'))
SELECT 'missing_table:'||name AS irregularity FROM required_tables WHERE to_regclass('public.'||name) IS NULL
UNION ALL SELECT 'missing_function:'||signature FROM required_functions WHERE to_regprocedure(signature) IS NULL
UNION ALL SELECT 'rls_or_owner:'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN required_tables t ON t.name=c.relname WHERE n.nspname='public' AND (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole)
UNION ALL SELECT 'direct_grant:'||t.name||':'||role FROM required_tables t CROSS JOIN (VALUES('anon'),('authenticated')) r(role) WHERE to_regclass('public.'||t.name) IS NOT NULL AND has_table_privilege(role,to_regclass('public.'||t.name),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
UNION ALL SELECT 'rpc_security:'||p.proname FROM required_functions f JOIN pg_proc p ON p.oid=to_regprocedure(f.signature) WHERE p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR NOT ('search_path=""'=ANY(p.proconfig)) OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
UNION ALL SELECT 'private_grant:'||p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='iasdpi_schedule_private' AND (has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'))
UNION ALL SELECT 'private_schema' WHERE has_schema_privilege('authenticated','iasdpi_schedule_private','USAGE,CREATE') OR has_schema_privilege('anon','iasdpi_schedule_private','USAGE,CREATE');
