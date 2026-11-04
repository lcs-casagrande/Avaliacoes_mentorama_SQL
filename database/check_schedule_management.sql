-- Somente leitura, como postgres. Zero linhas = nenhuma irregularidade detectada.
SELECT 'missing_table:'||name AS irregularity FROM unnest(ARRAY['schedule_events','schedule_plans','schedule_requirements','schedule_assignments','schedule_versions']) name WHERE to_regclass('public.'||name) IS NULL
UNION ALL SELECT 'missing_rpc:'||signature FROM unnest(ARRAY['public.iasdpi_schedule_workspace(uuid,date)','public.iasdpi_schedule_plan_version(uuid,bigint)','public.iasdpi_schedule_event_create(uuid,jsonb,uuid)','public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid)']) signature WHERE to_regprocedure(signature) IS NULL
UNION ALL SELECT 'private_schema_grant' WHERE has_schema_privilege('anon','iasdpi_schedule_private','USAGE,CREATE') OR has_schema_privilege('authenticated','iasdpi_schedule_private','USAGE,CREATE')
UNION ALL SELECT 'rls_or_table_owner:'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY(ARRAY['schedule_events','schedule_plans','schedule_requirements','schedule_assignments','schedule_versions'])
 AND (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole)
UNION ALL SELECT 'rpc:'||p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=ANY(ARRAY['iasdpi_schedule_workspace','iasdpi_schedule_plan_version','iasdpi_schedule_event_create','iasdpi_schedule_plan_save'])
 AND (p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR NOT ('search_path=""'=ANY(p.proconfig)) OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
UNION ALL SELECT 'table_grant:'||c.relname||':'||r.role FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated')) r(role)
 WHERE n.nspname='public' AND c.relname=ANY(ARRAY['schedule_events','schedule_plans','schedule_requirements','schedule_assignments','schedule_versions'])
 AND has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
UNION ALL SELECT 'private_function:'||p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='iasdpi_schedule_private' AND (has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'));
