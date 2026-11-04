-- G9: SOMENTE LEITURA. Executar como postgres no SQL Editor, antes de instalar.
-- Um único resultado JSON. Não retorna pessoas, e-mails, senhas, tokens ou payloads.
-- Marcadores de objetos NÃO comprovam que o arquivo de migração foi executado.
WITH relations AS (
 SELECT c.*,n.nspname,pg_get_userbyid(c.relowner) owner_name
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN('r','v') AND (n.nspname LIKE 'iasdpi\_%' ESCAPE '\'
 OR (n.nspname='public' AND (c.relname LIKE 'iasdpi\_%' ESCAPE '\' OR c.relname LIKE 'schedule\_%' ESCAPE '\' OR c.relname='culto_archives')))
), actors AS (
 SELECT oid,rolname FROM pg_roles WHERE rolname IN('anon','authenticated','service_role','iasdpi_church_executor')
), markers(number,object_name,object_present) AS (
 VALUES
 (1,'iasdpi_access',to_regclass('public.iasdpi_access') IS NOT NULL),
 (2,'iasdpi_set_access',to_regprocedure('public.iasdpi_set_access(uuid,text,boolean)') IS NOT NULL),
 (3,'iasdpi_programs',to_regclass('public.iasdpi_programs') IS NOT NULL),
 (4,'iasdpi_trash_program',to_regprocedure('public.iasdpi_trash_program(text,bigint,uuid,text)') IS NOT NULL),
 (5,'schedule_people',to_regclass('public.schedule_people') IS NOT NULL),
 (6,'schedule_plans',to_regclass('public.schedule_plans') IS NOT NULL),
 (7,'schedule_settings',to_regclass('public.schedule_settings') IS NOT NULL),
 (8,'iasdpi_schedule_rotation_context',to_regprocedure('public.iasdpi_schedule_rotation_context(uuid,date)') IS NOT NULL),
 (9,'schedule_legacy_commitments',to_regclass('public.schedule_legacy_commitments') IS NOT NULL),
 (10,'iasdpi_schedule_daily_role',to_regprocedure('public.iasdpi_schedule_daily_role(uuid)') IS NOT NULL),
 (11,'iasdpi_churches',to_regclass('public.iasdpi_churches') IS NOT NULL),
 (12,'iasdpi_alias_save',to_regprocedure('public.iasdpi_alias_save(text,uuid,boolean,bigint,text)') IS NOT NULL),
 (13,'iasdpi_governance_catalog',to_regprocedure('public.iasdpi_governance_catalog()') IS NOT NULL),
 (14,'iasdpi_schedule_published',to_regprocedure('public.iasdpi_schedule_published(date)') IS NOT NULL),
 (15,'schedule_elder_periods',to_regclass('public.schedule_elder_periods') IS NOT NULL),
 (16,'planning_weekdays',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.schedule_departments') AND attname='planning_weekdays' AND NOT attisdropped)),
 (17,'schedule_source_links',to_regclass('public.schedule_source_links') IS NOT NULL),
 -- 018 substitui função que já existia: presença não distingue 017/018/019.
 (18,'iasdpi_registry_people: comparar hash da definição',to_regprocedure('public.iasdpi_registry_people(text)') IS NOT NULL),
 (19,'person_aliases',to_regclass('iasdpi_schedule_private.person_aliases') IS NOT NULL)
), core_fingerprints AS (
 SELECT r.nspname||'.'||r.relname name,
 ((xpath('/table/row/summary/text()',query_to_xml(format(
 'SELECT json_build_object(''rows'',count(*),''digest'',md5(coalesce(jsonb_agg(to_jsonb(x)-''church_id'' ORDER BY (to_jsonb(x)-''church_id'')::text),''[]''::jsonb)::text)) AS summary FROM %I.%I x',r.nspname,r.relname),false,false,'')))[1]::text)::jsonb value
 FROM relations r WHERE r.relkind='r' AND
 (r.nspname='public' AND r.relname IN('iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities')
 OR r.nspname='iasdpi_operational_private' AND r.relname IN('revisions','trash_audit'))
)
SELECT jsonb_build_object(
 'format','IASDPI_G9_SCHEMA_SNAPSHOT','version',1,'captured_at',clock_timestamp(),
 'operator',current_user,'postgresql_version_num',current_setting('server_version_num')::integer,
 'provider_auth_settings_verified',false,'migration_ledger_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
 'markers',(SELECT jsonb_agg(jsonb_build_object('number',number,'object',object_name,'present',object_present) ORDER BY number) FROM markers),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'privileges',
 (SELECT jsonb_object_agg(a.rolname,jsonb_build_object('usage',has_schema_privilege(a.oid,n.oid,'USAGE'),'create',has_schema_privilege(a.oid,n.oid,'CREATE'))) FROM actors a)) ORDER BY n.nspname) FROM pg_namespace n WHERE n.nspname='public' OR n.nspname LIKE 'iasdpi\_%' ESCAPE '\'),
 'relations',(SELECT jsonb_agg(jsonb_build_object('name',r.nspname||'.'||r.relname,'kind',r.relkind,'owner',r.owner_name,'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,'options',r.reloptions,
 'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,'generated',a.attgenerated,'default_md5',md5(pg_get_expr(d.adbin,d.adrelid)),'grants',
 (SELECT jsonb_object_agg(u.rolname,jsonb_build_object('select',has_column_privilege(u.oid,r.oid,a.attnum,'SELECT'),'insert',has_column_privilege(u.oid,r.oid,a.attnum,'INSERT'),'update',has_column_privilege(u.oid,r.oid,a.attnum,'UPDATE'))) FROM actors u)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'definition_md5',md5(pg_get_constraintdef(c.oid,true))) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=r.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_object('name',ci.relname,'valid',i.indisvalid,'ready',i.indisready,'definition_md5',md5(pg_get_indexdef(i.indexrelid))) ORDER BY ci.relname) FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid WHERE i.indrelid=r.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.policyname,'permissive',p.permissive,'roles',p.roles,'command',p.cmd,'using_md5',md5(p.qual),'check_md5',md5(p.with_check)) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname=r.nspname AND p.tablename=r.relname),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition_md5',md5(pg_get_triggerdef(t.oid,true))) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal),
 'privileges',(SELECT jsonb_object_agg(a.rolname,jsonb_build_object('select',has_table_privilege(a.oid,r.oid,'SELECT'),'insert',has_table_privilege(a.oid,r.oid,'INSERT'),'update',has_table_privilege(a.oid,r.oid,'UPDATE'),'delete',has_table_privilege(a.oid,r.oid,'DELETE'))) FROM actors a)
 ) ORDER BY r.nspname,r.relname) FROM relations r),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'definition_md5',md5(pg_get_functiondef(p.oid)),'execute',
 (SELECT jsonb_object_agg(a.rolname,has_function_privilege(a.oid,p.oid,'EXECUTE')) FROM actors a)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND (n.nspname LIKE 'iasdpi\_%' ESCAPE '\' OR n.nspname='public' AND (p.proname LIKE 'iasdpi\_%' ESCAPE '\' OR NOT EXISTS(SELECT 1 FROM pg_depend dep WHERE dep.classid='pg_proc'::regclass AND dep.objid=p.oid AND dep.refclassid='pg_extension'::regclass AND dep.deptype='e')))),
 'core_fingerprints',coalesce((SELECT jsonb_object_agg(name,value) FROM core_fingerprints),'{}')
) AS g9_snapshot;
