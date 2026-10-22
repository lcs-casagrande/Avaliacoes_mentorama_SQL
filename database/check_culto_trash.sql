-- Somente metadados e contagens. Não altera dados nem mostra registros pessoais.
begin read only;
select column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name='iasdpi_programs'
  and column_name in ('deleted_at','deleted_by','deletion_reason') order by column_name;
select schemaname,tablename,policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename in ('iasdpi_programs','iasdpi_activities','iasdpi_subactivities') order by tablename,policyname;
select n.nspname,p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'execute') as anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.proname in ('iasdpi_save_program','iasdpi_preview_import','iasdpi_trash_program','iasdpi_restore_program','iasdpi_list_trash','iasdpi_trash_detail','save_program_003','preview_import_003','change_trash') order by n.nspname,p.proname;
select has_schema_privilege('authenticated','iasdpi_operational_private','usage') as private_schema_usage;
select relname,relrowsecurity from pg_class where oid in (
  'public.iasdpi_programs'::regclass,'public.iasdpi_activities'::regclass,'public.iasdpi_subactivities'::regclass,
  'iasdpi_operational_private.trash_audit'::regclass);
select c.relname,r.role,has_table_privilege(r.role,c.oid,'select') as can_select,
 has_table_privilege(r.role,c.oid,'insert,update,delete,truncate') as any_direct_write
from pg_class c cross join (values('anon'),('authenticated')) r(role)
where c.oid in ('public.iasdpi_programs'::regclass,'public.iasdpi_activities'::regclass,'public.iasdpi_subactivities'::regclass,'iasdpi_operational_private.trash_audit'::regclass);
select count(*) filter(where deleted_at is null) as active,count(*) filter(where deleted_at is not null) as trashed from public.iasdpi_programs;
commit;
