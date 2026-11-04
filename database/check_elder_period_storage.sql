-- Somente leitura, como postgres após 015. Zero linhas = sem irregularidades verificadas.
WITH issues AS (
 SELECT 'missing_rpc' issue,sig detail FROM unnest(ARRAY['public.iasdpi_schedule_elder_workspace(uuid,date,integer)','public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid)','public.iasdpi_schedule_elder_versions(uuid,text,date)']) sig WHERE to_regprocedure(sig) IS NULL
 UNION ALL SELECT 'rpc_acl' issue,p.oid::regprocedure::text detail FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('iasdpi_schedule_elder_workspace','iasdpi_schedule_elder_save','iasdpi_schedule_elder_versions')
 AND (p.proowner<>'iasdpi_church_executor'::regrole OR NOT p.prosecdef OR NOT coalesce('search_path=""'=ANY(p.proconfig),false)
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
 UNION ALL SELECT 'table_acl',c.oid::regclass::text FROM pg_class c WHERE c.oid IN ('public.schedule_elder_periods'::regclass,'public.schedule_elder_versions'::regclass)
 AND (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
 UNION ALL SELECT 'version_integrity',p.id::text FROM public.schedule_elder_periods p WHERE NOT EXISTS(SELECT 1 FROM public.schedule_elder_versions v WHERE v.church_id=p.church_id AND v.period_id=p.id AND v.version=p.version AND jsonb_populate_record(NULL::public.schedule_elder_periods,v.snapshot) IS NOT DISTINCT FROM p)
 UNION ALL SELECT 'wrong_department',p.id::text FROM public.schedule_elder_periods p JOIN public.schedule_departments d ON d.church_id=p.church_id AND d.id=p.department_id WHERE d.code<>'ancionato'
) SELECT issue,detail FROM issues ORDER BY issue,detail;
