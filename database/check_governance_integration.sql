-- G6: somente leitura, como postgres após 015. Não é uma migração.
-- Checagem conjunta sem pressupor os proprietários antigos dos checks 005–010.
WITH required(sig) AS (VALUES
 ('public.iasdpi_portal_context()'),('public.iasdpi_my_churches()'),('public.iasdpi_schedule_catalog()'),
 ('public.iasdpi_schedule_workspace(uuid,date)'),('public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid)'),
 ('public.iasdpi_schedule_published(date)'),('public.iasdpi_schedule_rotation_context(uuid,date)'),
 ('public.iasdpi_schedule_elder_workspace(uuid,date,integer)'),('public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid)'),
 ('public.iasdpi_schedule_elder_versions(uuid,text,date)'),('public.iasdpi_alias_login_lookup(text)'),
 ('public.iasdpi_access_reset_claim(text)'),('public.iasdpi_access_reset_finish(uuid,boolean)')
), scoped AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'schedule\_%' ESCAPE '\'
), issues AS (
 SELECT 'missing_rpc' issue,sig detail FROM required WHERE to_regprocedure(sig) IS NULL
 UNION ALL SELECT 'rpc_security',r.sig FROM required r JOIN pg_proc p ON p.oid=to_regprocedure(r.sig)
 WHERE NOT p.prosecdef OR NOT coalesce('search_path=""'=ANY(p.proconfig),false)
 OR p.proowner<>CASE WHEN r.sig='public.iasdpi_my_churches()' THEN 'postgres'::regrole ELSE 'iasdpi_church_executor'::regrole END
 UNION ALL SELECT 'rls_or_owner',relname FROM scoped WHERE NOT relrowsecurity OR relowner<>'postgres'::regrole
 UNION ALL SELECT 'church_boundary',s.relname FROM scoped s WHERE NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=s.oid AND NOT p.polpermissive AND p.polname='church_boundary' AND pg_get_expr(p.polqual,p.polrelid) LIKE '%iasdpi_current_church_id%')
 UNION ALL SELECT 'direct_table_access',relname FROM scoped WHERE has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
 UNION ALL SELECT 'anonymous_private_rpc',p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'iasdpi_schedule\_%' ESCAPE '\' AND p.proname<>'iasdpi_schedule_published' AND has_function_privilege('anon',p.oid,'EXECUTE')
 UNION ALL SELECT 'service_only_rpc',sig FROM required WHERE sig IN ('public.iasdpi_alias_login_lookup(text)','public.iasdpi_access_reset_claim(text)','public.iasdpi_access_reset_finish(uuid,boolean)')
 AND (has_function_privilege('authenticated',to_regprocedure(sig),'EXECUTE') OR has_function_privilege('anon',to_regprocedure(sig),'EXECUTE'))
 UNION ALL SELECT 'public_feed',sig FROM required WHERE sig='public.iasdpi_schedule_published(date)' AND NOT has_function_privilege('anon',to_regprocedure(sig),'EXECUTE')
) SELECT issue,detail FROM issues ORDER BY issue,detail;
