-- Somente leitura, após 009. Retorna exclusivamente irregularidades.
WITH expected(signature) AS (VALUES
 ('public.iasdpi_schedule_rotation_context(uuid,date)'),
 ('public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid)'),
 ('public.iasdpi_schedule_register_legacy(jsonb,uuid)'),
 ('public.iasdpi_schedule_exception_save(uuid,bigint,jsonb)'),
 ('public.iasdpi_schedule_person_history(uuid)'))
SELECT signature AS item,'RPC ausente ou privilégios/proprietário incorretos' AS irregularity
FROM expected LEFT JOIN pg_proc p ON p.oid=to_regprocedure(signature)
WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR NOT coalesce('search_path=""'=ANY(p.proconfig),false)
 OR has_function_privilege('anon',p.oid,'execute') OR NOT has_function_privilege('authenticated',p.oid,'execute')
UNION ALL
SELECT 'schedule_legacy_commitments','Tabela ausente, sem RLS ou acessível diretamente'
WHERE NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.schedule_legacy_commitments') AND relrowsecurity AND relowner='postgres'::regrole)
 OR has_table_privilege('authenticated',to_regclass('public.schedule_legacy_commitments'),'select,insert,update,delete')
 OR has_table_privilege('anon',to_regclass('public.schedule_legacy_commitments'),'select,insert,update,delete')
UNION ALL
SELECT n.nspname||'.'||p.proname,'Função privada executável por cliente'
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='iasdpi_schedule_private' AND (has_function_privilege('authenticated',p.oid,'execute') OR has_function_privilege('anon',p.oid,'execute'));
