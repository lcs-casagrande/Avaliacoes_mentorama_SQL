-- IASDPI G10.1 — INVENTÁRIO SOMENTE LEITURA. Não é migração.
-- SQL Editor: conferir projeto IASD_Parada e papel postgres antes de executar.
-- PostgreSQL 15+. Nenhuma tabela de negócio/Auth é consultada; só metadados.
-- Não chama RPCs do IASDPI. Não retorna definições completas, contatos ou segredos.
-- Um único SELECT facilita a exportação no SQL Editor; nenhuma configuração é alterada.
WITH
actors AS (
 SELECT oid,rolname FROM pg_roles WHERE rolname IN
 ('anon','authenticated','service_role','authenticator','postgres','iasdpi_church_executor')
),
scopes AS (
 SELECT oid,nspname,nspowner,nspacl FROM pg_namespace
 WHERE nspname='public' OR nspname LIKE 'iasdpi\_%' ESCAPE '\'
),
relations AS (
 SELECT c.*,n.nspname FROM pg_class c JOIN scopes n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f','S')
),
routines AS (
 SELECT p.*,n.nspname FROM pg_proc p JOIN scopes n ON n.oid=p.pronamespace
 WHERE p.prokind IN ('f','p') AND NOT EXISTS(
  SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid
   AND d.refclassid='pg_extension'::regclass AND d.deptype='e')
),
object_nodes AS (
 SELECT 'pg_class'::regclass::oid classid,c.oid objid FROM pg_class c JOIN scopes n ON n.oid=c.relnamespace
 UNION ALL SELECT 'pg_proc'::regclass::oid,p.oid FROM routines p
 UNION ALL SELECT 'pg_constraint'::regclass::oid,c.oid FROM pg_constraint c JOIN relations r ON r.oid=c.conrelid
 UNION ALL SELECT 'pg_policy'::regclass::oid,p.oid FROM pg_policy p JOIN relations r ON r.oid=p.polrelid
 UNION ALL SELECT 'pg_trigger'::regclass::oid,t.oid FROM pg_trigger t JOIN relations r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal
),
markers(number,object_name,present) AS (
 VALUES
 (1,'public.iasdpi_access',to_regclass('public.iasdpi_access') IS NOT NULL),
 (2,'public.iasdpi_set_access(uuid,text,boolean)',to_regprocedure('public.iasdpi_set_access(uuid,text,boolean)') IS NOT NULL),
 (3,'public.iasdpi_programs',to_regclass('public.iasdpi_programs') IS NOT NULL),
 (4,'public.iasdpi_trash_program(text,bigint,uuid,text)',to_regprocedure('public.iasdpi_trash_program(text,bigint,uuid,text)') IS NOT NULL),
 (5,'public.schedule_people',to_regclass('public.schedule_people') IS NOT NULL),
 (6,'public.schedule_plans',to_regclass('public.schedule_plans') IS NOT NULL),
 (7,'public.schedule_settings',to_regclass('public.schedule_settings') IS NOT NULL),
 (8,'public.iasdpi_schedule_rotation_context(uuid,date)',to_regprocedure('public.iasdpi_schedule_rotation_context(uuid,date)') IS NOT NULL),
 (9,'public.schedule_legacy_commitments',to_regclass('public.schedule_legacy_commitments') IS NOT NULL),
 (10,'public.iasdpi_schedule_daily_role(uuid)',to_regprocedure('public.iasdpi_schedule_daily_role(uuid)') IS NOT NULL),
 (11,'public.iasdpi_churches',to_regclass('public.iasdpi_churches') IS NOT NULL),
 (12,'public.iasdpi_alias_save(text,uuid,boolean,bigint,text)',to_regprocedure('public.iasdpi_alias_save(text,uuid,boolean,bigint,text)') IS NOT NULL),
 (13,'public.iasdpi_governance_catalog()',to_regprocedure('public.iasdpi_governance_catalog()') IS NOT NULL),
 (14,'public.iasdpi_schedule_published(date)',to_regprocedure('public.iasdpi_schedule_published(date)') IS NOT NULL),
 (15,'public.schedule_elder_periods',to_regclass('public.schedule_elder_periods') IS NOT NULL),
 (16,'public.schedule_departments.planning_weekdays',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.schedule_departments') AND attname='planning_weekdays' AND NOT attisdropped)),
 (17,'public.schedule_source_links',to_regclass('public.schedule_source_links') IS NOT NULL),
 (18,'public.iasdpi_registry_people(text): assinatura compartilhada',to_regprocedure('public.iasdpi_registry_people(text)') IS NOT NULL),
 (19,'iasdpi_schedule_private.person_aliases',to_regclass('iasdpi_schedule_private.person_aliases') IS NOT NULL),
 (20,'public.iasdpi_events',to_regclass('public.iasdpi_events') IS NOT NULL),
 (21,'public.iasdpi_events.is_restricted',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.iasdpi_events') AND attname='is_restricted' AND NOT attisdropped)),
 (22,'public.iasdpi_event_series',to_regclass('public.iasdpi_event_series') IS NOT NULL),
 (23,'iasdpi_schedule_private.edit_bounds()',to_regprocedure('iasdpi_schedule_private.edit_bounds()') IS NOT NULL),
 (24,'iasdpi_schedule_private.departments_conflict(uuid,uuid)',to_regprocedure('iasdpi_schedule_private.departments_conflict(uuid,uuid)') IS NOT NULL),
 (25,'iasdpi_schedule_private.iasdpi_events_catalog_before_025()',to_regprocedure('iasdpi_schedule_private.iasdpi_events_catalog_before_025()') IS NOT NULL)
)
SELECT jsonb_build_object(
 'format','IASDPI_G10_1_SCHEMA_INVENTORY','version',1,'query_mode','metadata-only-single-select',
 'captured_at',clock_timestamp(),'operator',current_user,
 'database',current_database(),'postgresql_version_num',current_setting('server_version_num')::integer,
 'session_timezone',current_setting('TimeZone'),
 'transaction_read_only',current_setting('transaction_read_only'),
 'transaction_isolation',current_setting('transaction_isolation'),
 'project_identity_verified',false,'business_data_read',false,
 'auth_provider_settings_verified',false,'edge_deployments_verified',false,
 'migration_execution_proven',false,'plpgsql_body_dependencies_complete',false,
 'markers',coalesce((SELECT jsonb_agg(jsonb_build_object('number',number,'object',object_name,'present',present) ORDER BY number) FROM markers),'[]'),
 'migration_ledger',jsonb_build_object(
  'present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'rows_read',false,
  'columns',coalesce((SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=to_regclass('supabase_migrations.schema_migrations') AND a.attnum>0 AND NOT a.attisdropped),'[]')),
 'auth_primitives',jsonb_build_object(
  'users_table',to_regclass('auth.users') IS NOT NULL,
  'identities_table',to_regclass('auth.identities') IS NOT NULL,
  'uid_function',to_regprocedure('auth.uid()') IS NOT NULL,
  'jwt_function',to_regprocedure('auth.jwt()') IS NOT NULL,
  'users_columns',coalesce((SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=to_regclass('auth.users') AND a.attnum>0 AND NOT a.attisdropped),'[]')),
 'extensions',coalesce((SELECT jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),'[]'),
 'roles',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'superuser',r.rolsuper,'bypassrls',r.rolbypassrls,'inherit',r.rolinherit,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'replication',r.rolreplication) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN(SELECT rolname FROM actors)),'[]'),
 'role_memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'grantor',pg_get_userbyid(m.grantor),'admin_option',m.admin_option) ORDER BY m.roleid,m.member) FROM pg_auth_members m WHERE m.roleid IN(SELECT oid FROM actors) OR m.member IN(SELECT oid FROM actors)),'[]'),
 'schemas',coalesce((SELECT jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) x),'[]'),
  'privileges',(SELECT jsonb_object_agg(a.rolname,jsonb_build_object('usage',has_schema_privilege(a.oid,n.oid,'USAGE'),'create',has_schema_privilege(a.oid,n.oid,'CREATE'))) FROM actors a)) ORDER BY n.nspname) FROM scopes n),'[]'),
 'relations',coalesce((SELECT jsonb_agg(jsonb_build_object('name',r.nspname||'.'||r.relname,'kind',r.relkind,'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,
  'options_md5',md5(r.reloptions::text),'view_definition_md5',CASE WHEN r.relkind IN('v','m') THEN md5(pg_get_viewdef(r.oid,true)) END,
  'columns',coalesce((SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'nullable',NOT a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
   'default_md5',md5(pg_get_expr(d.adbin,d.adrelid)),
   'acl',coalesce((SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type) FROM aclexplode(a.attacl) x),'[]'),
   'privileges',(SELECT jsonb_object_agg(u.rolname,jsonb_build_object('select',has_column_privilege(u.oid,r.oid,a.attnum,'SELECT'),'insert',has_column_privilege(u.oid,r.oid,a.attnum,'INSERT'),'update',has_column_privilege(u.oid,r.oid,a.attnum,'UPDATE'))) FROM actors u)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'),
  'constraints',coalesce((SELECT jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,
   'columns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num),
   'references',CASE WHEN c.confrelid<>0 THEN c.confrelid::regclass::text END,
   'referenced_columns',(SELECT jsonb_agg(a.attname ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num),
   'definition_md5',md5(pg_get_constraintdef(c.oid,true))) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=r.oid),'[]'),
  'indexes',coalesce((SELECT jsonb_agg(jsonb_build_object('name',ci.relname,'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'method',am.amname,'definition_md5',md5(pg_get_indexdef(i.indexrelid))) ORDER BY ci.relname) FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid JOIN pg_am am ON am.oid=ci.relam WHERE i.indrelid=r.oid),'[]'),
  'policies',coalesce((SELECT jsonb_agg(jsonb_build_object('name',p.policyname,'permissive',p.permissive,'roles',p.roles,'command',p.cmd,'using_md5',md5(p.qual),'check_md5',md5(p.with_check)) ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname=r.nspname AND p.tablename=r.relname),'[]'),
  'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'function',t.tgfoid::regprocedure::text,'definition_md5',md5(pg_get_triggerdef(t.oid,true))) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=r.oid AND NOT t.tgisinternal),'[]'),
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type) FROM aclexplode(coalesce(r.relacl,acldefault(CASE WHEN r.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,r.relowner))) x),'[]'),
  'privileges',CASE WHEN r.relkind<>'S' THEN (SELECT jsonb_object_agg(a.rolname,jsonb_build_object('select',has_table_privilege(a.oid,r.oid,'SELECT'),'insert',has_table_privilege(a.oid,r.oid,'INSERT'),'update',has_table_privilege(a.oid,r.oid,'UPDATE'),'delete',has_table_privilege(a.oid,r.oid,'DELETE'),'truncate',has_table_privilege(a.oid,r.oid,'TRUNCATE'),'references',has_table_privilege(a.oid,r.oid,'REFERENCES'),'trigger',has_table_privilege(a.oid,r.oid,'TRIGGER'))) FROM actors a)
   ELSE (SELECT jsonb_object_agg(a.rolname,jsonb_build_object('usage',has_sequence_privilege(a.oid,r.oid,'USAGE'),'select',has_sequence_privilege(a.oid,r.oid,'SELECT'),'update',has_sequence_privilege(a.oid,r.oid,'UPDATE'))) FROM actors a) END
 ) ORDER BY r.nspname,r.relname) FROM relations r),'[]'),
 'functions',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',p.nspname,'name',p.proname,'kind',p.prokind,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
  'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatility',p.provolatile,'language',l.lanname,'definition_md5',md5(pg_get_functiondef(p.oid)),
  'settings',coalesce((SELECT jsonb_agg(jsonb_build_object('name',split_part(v,'=',1),'value',CASE WHEN split_part(v,'=',1) IN('search_path','row_security','statement_timeout','lock_timeout','TimeZone') THEN substr(v,strpos(v,'=')+1) END,'value_md5',md5(substr(v,strpos(v,'=')+1))) ORDER BY v) FROM unnest(p.proconfig) v),'[]'),
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY x.grantee,x.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x),'[]'),
  'execute',(SELECT jsonb_object_agg(a.rolname,has_function_privilege(a.oid,p.oid,'EXECUTE')) FROM actors a)
 ) ORDER BY p.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM routines p JOIN pg_language l ON l.oid=p.prolang),'[]'),
 'default_privileges',coalesce((SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,
  'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable) ORDER BY d.defaclrole,n.nspname,d.defaclobjtype,x.grantee,x.privilege_type)
 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) x WHERE d.defaclnamespace=0 OR d.defaclnamespace IN(SELECT oid FROM scopes)),'[]'),
 'dependencies',coalesce((SELECT jsonb_agg(jsonb_build_object('type',d.deptype,'object',pg_describe_object(d.classid,d.objid,d.objsubid),'references',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid)) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid)
 FROM pg_depend d WHERE EXISTS(SELECT 1 FROM object_nodes n WHERE n.classid=d.classid AND n.objid=d.objid) OR EXISTS(SELECT 1 FROM object_nodes n WHERE n.classid=d.refclassid AND n.objid=d.refobjid)),'[]'),
 'publications',coalesce((SELECT jsonb_agg(jsonb_build_object('name',p.pubname,'all_tables',p.puballtables,'insert',p.pubinsert,'update',p.pubupdate,'delete',p.pubdelete,'truncate',p.pubtruncate,
  'tables',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',t.schemaname,'table',t.tablename) ORDER BY t.schemaname,t.tablename) FROM pg_publication_tables t WHERE t.pubname=p.pubname),'[]')) ORDER BY p.pubname) FROM pg_publication p),'[]')
) AS g10_1_inventory;
