-- G7: somente leitura após 016, como postgres. Zero linhas = sem divergências destes checks.
WITH f AS(SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('iasdpi_schedule_department_days','iasdpi_schedule_department_days_save','iasdpi_schedule_generate_days','iasdpi_schedule_settings_get','iasdpi_schedule_settings_save','iasdpi_schedule_rotation_context')),
issues AS(
 SELECT 'missing_rpc' issue,name detail FROM unnest(ARRAY['iasdpi_schedule_department_days','iasdpi_schedule_department_days_save','iasdpi_schedule_generate_days','iasdpi_schedule_settings_get','iasdpi_schedule_settings_save','iasdpi_schedule_rotation_context']) name WHERE NOT EXISTS(SELECT 1 FROM f WHERE proname=name)
 UNION ALL SELECT 'rpc_security',oid::regprocedure::text FROM f WHERE proowner<>'iasdpi_church_executor'::regrole OR NOT prosecdef OR NOT coalesce('search_path=""'=ANY(proconfig),false) OR has_function_privilege('anon',oid,'EXECUTE') OR NOT has_function_privilege('authenticated',oid,'EXECUTE')
 UNION ALL SELECT 'invalid_days',id::text FROM public.schedule_departments WHERE planning_weekdays IS NULL OR NOT (cardinality(planning_weekdays)=0 OR iasdpi_schedule_private.valid_weekdays(planning_weekdays))
 UNION ALL SELECT 'column_write_grant','schedule_departments.planning_weekdays' WHERE has_column_privilege('authenticated','public.schedule_departments','planning_weekdays','UPDATE') OR has_column_privilege('anon','public.schedule_departments','planning_weekdays','UPDATE')
) SELECT issue,detail FROM issues ORDER BY issue,detail;
