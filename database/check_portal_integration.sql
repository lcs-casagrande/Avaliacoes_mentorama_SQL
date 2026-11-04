-- G4, somente leitura, como postgres após 014. Zero linhas = sem divergências destes checks.
WITH f AS(SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('iasdpi_schedule_published','iasdpi_my_churches','iasdpi_portal_context')),
issues AS(
 SELECT 'missing_rpc' issue,name detail FROM unnest(ARRAY['iasdpi_schedule_published','iasdpi_my_churches','iasdpi_portal_context']) name WHERE NOT EXISTS(SELECT 1 FROM f WHERE proname=name)
 UNION ALL SELECT 'security',oid::regprocedure::text FROM f WHERE NOT prosecdef OR NOT coalesce('search_path=""'=ANY(proconfig),false)
 UNION ALL SELECT 'feed_owner',oid::regprocedure::text FROM f WHERE proname IN('iasdpi_schedule_published','iasdpi_portal_context') AND proowner<>'iasdpi_church_executor'::regrole
 UNION ALL SELECT 'context_bridge_owner',oid::regprocedure::text FROM f WHERE proname='iasdpi_my_churches' AND proowner<>'postgres'::regrole
 UNION ALL SELECT 'feed_grant',oid::regprocedure::text FROM f WHERE proname='iasdpi_schedule_published' AND (NOT has_function_privilege('anon',oid,'execute') OR NOT has_function_privilege('authenticated',oid,'execute'))
 UNION ALL SELECT 'context_grant',oid::regprocedure::text FROM f WHERE proname IN('iasdpi_my_churches','iasdpi_portal_context') AND (has_function_privilege('anon',oid,'execute') OR NOT has_function_privilege('authenticated',oid,'execute'))
 UNION ALL SELECT 'write_grant',p.oid::regprocedure::text FROM pg_proc p WHERE p.oid IN('public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid)'::regprocedure,'public.iasdpi_schedule_event_create(uuid,jsonb,uuid)'::regprocedure) AND has_function_privilege('anon',p.oid,'execute')
)SELECT issue,detail FROM issues ORDER BY issue,detail;
