-- G2 somente leitura; executar como postgres após 012. Zero linhas = sem irregularidades verificadas.
WITH functions AS (
 SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.proname IN ('alias_identity_allowed','iasdpi_alias_identifier','iasdpi_alias_list','iasdpi_alias_save','iasdpi_alias_login_lookup','iasdpi_alias_login_confirm','iasdpi_alias_login_limit')
), issues AS (
 SELECT 'reserved_aliases' issue,'Reservas institucionais ausentes' detail WHERE EXISTS(
 SELECT name FROM unnest(ARRAY['administrador','anciaos','sonoplastia','musica','diaconato','comunicacao']) name
 EXCEPT SELECT a.identifier FROM iasdpi_admin_private.login_aliases a JOIN public.iasdpi_churches c ON c.id=a.church_id WHERE c.code='IASD_PI')
 UNION ALL SELECT 'service_execute',oid::regprocedure::text FROM functions WHERE proname IN ('iasdpi_alias_login_lookup','iasdpi_alias_login_confirm','iasdpi_alias_login_limit') AND
 (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE') OR NOT has_function_privilege('service_role',oid,'EXECUTE'))
 UNION ALL SELECT 'function_owner',oid::regprocedure::text FROM functions WHERE proowner<>'iasdpi_church_executor'::regrole
 UNION ALL SELECT 'function_path',oid::regprocedure::text FROM functions WHERE NOT coalesce('search_path=""'=ANY(proconfig),false)
 UNION ALL SELECT 'private_execute','alias_identity_allowed' FROM functions WHERE proname='alias_identity_allowed' AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))
 UNION ALL SELECT 'private_schema',nspname FROM pg_namespace WHERE nspname IN ('iasdpi_admin_private','iasdpi_login_private') AND
 (has_schema_privilege('anon',oid,'USAGE') OR has_schema_privilege('authenticated',oid,'USAGE'))
 UNION ALL SELECT 'rls',c.oid::regclass::text FROM pg_class c WHERE c.oid IN ('iasdpi_admin_private.login_aliases'::regclass,'iasdpi_login_private.budgets'::regclass) AND NOT c.relrowsecurity
 UNION ALL SELECT 'direct_access',c.oid::regclass::text FROM pg_class c WHERE c.oid IN ('iasdpi_admin_private.login_aliases'::regclass,'iasdpi_login_private.budgets'::regclass) AND
 (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))
 UNION ALL SELECT 'unbound_enabled',a.id::text FROM iasdpi_admin_private.login_aliases a WHERE a.enabled AND a.user_id IS NULL
 UNION ALL SELECT 'missing_church',a.id::text FROM iasdpi_admin_private.login_aliases a LEFT JOIN public.iasdpi_churches c ON c.id=a.church_id WHERE c.id IS NULL
)
SELECT issue,detail FROM issues ORDER BY issue,detail;
