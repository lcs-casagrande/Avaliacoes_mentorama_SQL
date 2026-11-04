-- SOMENTE LEITURA. Executar como postgres depois da 005.
-- Resultado vazio = nenhuma das irregularidades abaixo foi encontrada.
WITH expected(name) AS (VALUES ('schedule_departments'),('schedule_people'),('schedule_memberships'),('schedule_roles'),('schedule_qualifications'),('schedule_availability'),('schedule_department_access')),
problems AS (
 SELECT 'tabela ausente ou RLS desabilitada: '||e.name AS problem
 FROM expected e LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||e.name)
 WHERE c.oid IS NULL OR NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole
 UNION ALL
 SELECT 'privilégio direto indevido: '||r.name||' / '||e.name
 FROM expected e CROSS JOIN (VALUES ('anon'),('authenticated')) r(name)
 WHERE to_regclass('public.'||e.name) IS NOT NULL
 AND has_table_privilege(r.name,'public.'||e.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 UNION ALL
 SELECT 'política permissiva inesperada: '||tablename||' / '||policyname
 FROM pg_policies WHERE schemaname='public' AND tablename IN (SELECT name FROM expected)
 UNION ALL
 SELECT 'função pública ausente: '||f.signature
 FROM (VALUES ('public.iasdpi_schedule_catalog()'),('public.iasdpi_schedule_person_details(uuid)'),('public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid)')) f(signature)
 WHERE to_regprocedure(f.signature) IS NULL
 UNION ALL
 SELECT 'função pública insegura: '||p.proname
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'iasdpi_schedule_%'
 AND (p.proowner<>'postgres'::regrole OR NOT p.prosecdef OR NOT coalesce('search_path=""'=ANY(p.proconfig),false)
 OR has_function_privilege('anon',p.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
 UNION ALL
 SELECT 'acesso ao schema privado: '||r.name FROM (VALUES ('anon'),('authenticated')) r(name)
 WHERE has_schema_privilege(r.name,'iasdpi_schedule_private','USAGE,CREATE')
 UNION ALL
 SELECT 'função privada acessível: '||p.proname||' / '||r.name
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN (VALUES ('anon'),('authenticated')) r(name)
 WHERE n.nspname='iasdpi_schedule_private' AND (p.proowner<>'postgres'::regrole OR has_function_privilege(r.name,p.oid,'EXECUTE'))
 UNION ALL
 SELECT 'tabela privada insegura: '||c.relname
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='iasdpi_schedule_private' AND c.relkind='r' AND
 (NOT c.relrowsecurity OR c.relowner<>'postgres'::regrole OR has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
) SELECT problem FROM problems ORDER BY problem;
