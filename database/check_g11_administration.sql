-- G11: verificador de catálogo; não provisiona contas nem chama RPCs da aplicação.
DO $$ DECLARE name text;BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('iasdpi_admin_private.account_creation_requests') AND relrowsecurity AND relforcerowsecurity)
 OR to_regclass('iasdpi_admin_private.account_activity') IS NULL THEN RAISE EXCEPTION 'G11 incompleta: tabela/atividade/RLS.';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='iasdpi_admin_private.account_creation_requests'::regclass AND polname='credential_change_required' AND NOT polpermissive) THEN RAISE EXCEPTION 'Barreira de credencial G11 ausente.';END IF;
 FOREACH name IN ARRAY ARRAY['iasdpi_governance_catalog()','iasdpi_account_link(uuid,bigint,uuid)','iasdpi_account_state_save(uuid,text,text)',
 'iasdpi_account_create_begin(uuid,uuid,bigint,text,text)','iasdpi_account_create_finish(uuid,uuid)','iasdpi_account_creation_cancel(uuid)',
 'iasdpi_governance_permission_save(uuid,uuid,text,jsonb,text,bigint,boolean)','iasdpi_event_reject(uuid,bigint,text,uuid)'] LOOP
 IF to_regprocedure('public.'||name) IS NULL OR has_function_privilege('anon','public.'||name,'EXECUTE')
 OR has_function_privilege('service_role','public.'||name,'EXECUTE')
 OR NOT has_function_privilege('authenticated','public.'||name,'EXECUTE')
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.'||name) AND prosecdef AND proowner='iasdpi_church_executor'::regrole AND proconfig=ARRAY['search_path=""'])
 THEN RAISE EXCEPTION 'RPC G11 ausente ou privilégios divergentes: %',name;END IF;END LOOP;
 IF has_table_privilege('anon','iasdpi_admin_private.account_creation_requests','SELECT') OR has_table_privilege('authenticated','iasdpi_admin_private.account_creation_requests','SELECT') THEN RAISE EXCEPTION 'Intenções privadas expostas.';END IF;
 IF has_function_privilege('authenticated','iasdpi_admin_private.catalog_before_027()','EXECUTE') OR has_function_privilege('service_role','iasdpi_admin_private.catalog_before_027()','EXECUTE') THEN RAISE EXCEPTION 'Cópia privada exposta.';END IF;
END $$;
