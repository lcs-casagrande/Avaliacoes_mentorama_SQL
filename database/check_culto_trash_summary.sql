-- SOMENTE LEITURA. Executar como postgres no SQL Editor.
-- Um único resultado com sete linhas: o editor não oculta consultas anteriores.
select '01_colunas' as verificacao, coalesce(jsonb_agg(to_jsonb(c) order by c.column_name),'[]'::jsonb) as resultado
from (
  select column_name,data_type,is_nullable from information_schema.columns
  where table_schema='public' and table_name='iasdpi_programs'
    and column_name in ('deleted_at','deleted_by','deletion_reason')
) c
union all
select '02_funcoes',coalesce(jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'nome',p.proname,'argumentos',pg_get_function_identity_arguments(p.oid),
  'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,
  'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'))
  order by n.nspname,p.proname),'[]'::jsonb)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in (
  'iasdpi_save_program','iasdpi_preview_import','iasdpi_trash_program',
  'iasdpi_restore_program','iasdpi_list_trash','iasdpi_trash_detail'))
  or (n.nspname='iasdpi_operational_private' and p.proname in (
    'save_program_003','preview_import_003','change_trash','require_access','project_program'))
  or (n.nspname='iasdpi_admin_private' and p.proname in ('require_admin','lock_admin'))
union all
select '03_rls',coalesce(jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'tabela',c.relname,'owner',pg_get_userbyid(c.relowner),
  'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname),'[]'::jsonb)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in ('iasdpi_programs','iasdpi_activities','iasdpi_subactivities'))
  or (n.nspname='iasdpi_operational_private' and c.relname='trash_audit')
union all
select '04_politicas',coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname),'[]'::jsonb)
from pg_policies p
where (schemaname='public' and tablename in ('iasdpi_programs','iasdpi_activities','iasdpi_subactivities'))
  or (schemaname='iasdpi_operational_private' and tablename='trash_audit')
union all
select '05_privilegios_tabelas',coalesce(jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'tabela',c.relname,'role',r.role,
  'select',has_table_privilege(r.role,c.oid,'SELECT'),
  'escrita_tabela',has_table_privilege(r.role,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
  'escrita_coluna',has_any_column_privilege(r.role,c.oid,'INSERT,UPDATE,REFERENCES'))
  order by n.nspname,c.relname,r.role),'[]'::jsonb)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('anon'),('authenticated')) r(role)
where (n.nspname='public' and c.relname in ('iasdpi_programs','iasdpi_activities','iasdpi_subactivities'))
  or (n.nspname='iasdpi_operational_private' and c.relname='trash_audit')
union all
select '06_schemas_privados',coalesce(jsonb_agg(jsonb_build_object(
  'schema',n.nspname,'role',r.role,
  'usage',has_schema_privilege(r.role,n.oid,'USAGE'),
  'create',has_schema_privilege(r.role,n.oid,'CREATE')) order by n.nspname,r.role),'[]'::jsonb)
from pg_namespace n cross join (values('anon'),('authenticated')) r(role)
where n.nspname in ('iasdpi_operational_private','iasdpi_admin_private')
union all
select '07_contagens',jsonb_build_object(
  'ativos',count(*) filter(where deleted_at is null),
  'lixeira',count(*) filter(where deleted_at is not null))
from public.iasdpi_programs
order by verificacao;
