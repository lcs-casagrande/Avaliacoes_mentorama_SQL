-- G8.2 — somente leitura após 017, como postgres. Zero linhas = nenhuma irregularidade destes checks.
WITH names(name) AS (VALUES ('iasdpi_registry_people'),('iasdpi_registry_catalog'),('iasdpi_registry_save'),('iasdpi_registry_source_save'),('iasdpi_registry_public'),('iasdpi_registry_history')),
f AS(SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN(SELECT name FROM names)),
issues AS(
 SELECT 'missing_rpc' issue,name detail FROM names WHERE NOT EXISTS(SELECT 1 FROM f WHERE proname=name)
 UNION ALL SELECT 'rpc_security',oid::regprocedure::text FROM f WHERE proowner<>'iasdpi_church_executor'::regrole OR NOT prosecdef OR NOT coalesce('search_path=""'=ANY(proconfig),false) OR (proname<>'iasdpi_registry_public' AND has_function_privilege('anon',oid,'EXECUTE')) OR NOT has_function_privilege('authenticated',oid,'EXECUTE')
 UNION ALL SELECT 'public_projection','iasdpi_registry_public' WHERE NOT has_function_privilege('anon','public.iasdpi_registry_public()','EXECUTE')
 UNION ALL SELECT 'table_security',c.oid::regclass::text FROM pg_class c WHERE c.oid='public.schedule_source_links'::regclass AND (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
 UNION ALL SELECT 'church_boundary','schedule_source_links' WHERE NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.schedule_source_links'::regclass AND polname='church_boundary' AND NOT polpermissive)
 UNION ALL SELECT 'private_execute',p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='iasdpi_schedule_private' AND p.proname IN('settings_get_g7','rotation_context_g7','elder_workspace_g7','day_availability') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
) SELECT issue,detail FROM issues ORDER BY issue,detail;
