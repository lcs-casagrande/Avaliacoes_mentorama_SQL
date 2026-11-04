-- SOMENTE LEITURA, após 020. Retorna apenas irregularidades; executar como postgres.
WITH tables AS(SELECT unnest(ARRAY['iasdpi_events','iasdpi_event_versions']) name),
functions AS(SELECT unnest(ARRAY['public.iasdpi_events_catalog()','public.iasdpi_event_save(uuid,bigint,jsonb,uuid)',
'public.iasdpi_event_history(uuid)','public.iasdpi_events_published(date)','iasdpi_schedule_private.event_can(uuid,text,uuid,text)']) sig),
checks AS(
 SELECT 'table' kind,t.name object,'Tabela ausente ou RLS insegura' issue FROM tables t LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||t.name)
 WHERE c.oid IS NULL OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity
 UNION ALL SELECT 'grant',t.name,'Privilégio direto indevido' FROM tables t CROSS JOIN(VALUES('anon'),('authenticated'),('service_role')) a(role)
 WHERE coalesce(has_table_privilege(a.role,to_regclass('public.'||t.name),'SELECT,INSERT,UPDATE,DELETE'),false)
 UNION ALL SELECT 'function',f.sig,'Ausente, proprietário/search_path/SECURITY DEFINER divergentes' FROM functions f LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.sig)
 WHERE p.oid IS NULL OR p.proowner<>'iasdpi_church_executor'::regrole OR NOT p.prosecdef OR NOT 'search_path=""'=ANY(coalesce(p.proconfig,'{}'))
 UNION ALL SELECT 'execute',f.sig,'Execução pública indevida' FROM functions f WHERE f.sig<>'public.iasdpi_events_published(date)' AND coalesce(has_function_privilege('anon',to_regprocedure(f.sig),'EXECUTE'),false)
 UNION ALL SELECT 'execute',f.sig,'Helper privado exposto' FROM functions f WHERE f.sig LIKE 'iasdpi_schedule_private.%' AND coalesce(has_function_privilege('authenticated',to_regprocedure(f.sig),'EXECUTE'),false)
 UNION ALL SELECT 'execute','public.iasdpi_events_published(date)','Consulta pública não concedida' WHERE NOT coalesce(has_function_privilege('anon',to_regprocedure('public.iasdpi_events_published(date)'),'EXECUTE'),false)
 UNION ALL SELECT 'constraint',c.conname,'Restrição não validada' FROM pg_constraint c WHERE c.conrelid IN(to_regclass('public.iasdpi_events'),to_regclass('public.iasdpi_event_versions')) AND NOT c.convalidated
 UNION ALL SELECT 'index',c.relname,'Índice inválido' FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid IN(to_regclass('public.iasdpi_events'),to_regclass('public.iasdpi_event_versions')) AND (NOT i.indisvalid OR NOT i.indisready)
)
SELECT * FROM checks ORDER BY kind,object;
