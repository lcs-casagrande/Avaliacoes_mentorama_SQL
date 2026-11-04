-- Somente leitura. Resultado vazio = nenhuma irregularidade nestes metadados.
WITH functions AS (
 SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN('iasdpi_registry_identity_preview','iasdpi_registry_identity_apply','iasdpi_registry_audit','iasdpi_registry_people','iasdpi_schedule_catalog','iasdpi_schedule_save','iasdpi_registry_public','iasdpi_registry_history'))
 OR (n.nspname='iasdpi_schedule_private' AND p.proname IN('canonical_person','confirmed_person_names','identity_group','identity_person_guard','identity_display_sync','identity_reference_guard','catalog_g83','save_g83','public_g83'))
), issues AS (
 SELECT 'function' kind,p.oid::regprocedure::text object,'proprietário, SECURITY DEFINER ou search_path divergente' issue
 FROM functions p WHERE p.proowner<>'iasdpi_church_executor'::regrole OR (NOT p.prosecdef AND p.proname<>'confirmed_person_names') OR NOT 'search_path=""'=ANY(coalesce(p.proconfig,'{}'))
 UNION ALL SELECT 'function',p.oid::regprocedure::text,'execução indevida para anônimo ou authenticated'
 FROM functions p WHERE (p.proname<>'iasdpi_registry_public' AND has_function_privilege('anon',p.oid,'EXECUTE'))
 OR (p.nspname='iasdpi_schedule_private' AND has_function_privilege('authenticated',p.oid,'EXECUTE'))
 UNION ALL SELECT 'table','iasdpi_schedule_private.person_aliases','RLS ausente' WHERE NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('iasdpi_schedule_private.person_aliases')),false)
 UNION ALL SELECT 'table','iasdpi_schedule_private.person_aliases','privilégio direto indevido' WHERE EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r WHERE has_table_privilege(r,'iasdpi_schedule_private.person_aliases','SELECT,INSERT,UPDATE,DELETE'))
 UNION ALL SELECT 'policy','person_aliases','políticas de isolamento ausentes' WHERE (SELECT count(*) FROM pg_policy WHERE polrelid='iasdpi_schedule_private.person_aliases'::regclass AND polname IN('church_boundary','church_executor'))<>2
 UNION ALL SELECT 'role','iasdpi_church_executor','papel executor inseguro' WHERE EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_church_executor' AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb))
 UNION ALL SELECT 'schema',nspname,'CREATE indevido' FROM pg_namespace WHERE nspname IN('public','iasdpi_schedule_private') AND (has_schema_privilege('iasdpi_church_executor',oid,'CREATE') OR has_schema_privilege('authenticated',oid,'CREATE') OR has_schema_privilege('anon',oid,'CREATE'))
 UNION ALL SELECT 'policy','person_aliases','política adicional ou papel divergente' FROM pg_policy WHERE polrelid='iasdpi_schedule_private.person_aliases'::regclass AND NOT ((polname='church_boundary' AND NOT polpermissive AND polroles=ARRAY[0::oid]) OR (polname='church_executor' AND polpermissive AND polroles=ARRAY['iasdpi_church_executor'::regrole::oid]))
 UNION ALL SELECT 'identity','schedule_people','redirecionamento encadeado' WHERE EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_people root ON root.id=p.merged_into AND root.church_id=p.church_id WHERE root.merged_into IS NOT NULL)
 UNION ALL SELECT 'function','G8.4','funções públicas ausentes' WHERE (SELECT count(*) FROM functions WHERE nspname='public')<>8
)
SELECT * FROM issues ORDER BY kind,object,issue;
