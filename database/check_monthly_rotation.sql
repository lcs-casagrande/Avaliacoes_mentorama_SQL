-- Somente leitura. Retorna exclusivamente irregularidades da 008.
WITH functions(signature) AS (VALUES
 ('public.iasdpi_schedule_rotation_context(uuid,date)'),
 ('public.iasdpi_schedule_workspace(uuid,date)'))
SELECT signature AS item,'RPC ausente ou permissões/proprietário inseguros' AS irregularity
FROM functions f LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.signature)
WHERE p.oid IS NULL OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef
 OR NOT coalesce('search_path=""'=ANY(p.proconfig),false)
 OR has_function_privilege('anon',p.oid,'EXECUTE')
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
UNION ALL
SELECT 'workspace_007','Helper privado ausente ou acessível aos clientes'
WHERE to_regprocedure('iasdpi_schedule_private.workspace_007(uuid,date)') IS NULL
 OR has_function_privilege('authenticated',to_regprocedure('iasdpi_schedule_private.workspace_007(uuid,date)'),'EXECUTE')
 OR has_function_privilege('anon',to_regprocedure('iasdpi_schedule_private.workspace_007(uuid,date)'),'EXECUTE');
