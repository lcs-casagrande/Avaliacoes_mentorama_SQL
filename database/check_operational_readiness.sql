-- Somente leitura: inspeção administrativa antes/depois de 003. Não é migração.
select current_user, current_database();
select c.relname, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity as rls,
       c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities');
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where tablename in
 ('iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities');
select n.nspname,p.proname,pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname like 'iasdpi_%')
   or n.nspname in ('iasdpi_admin_private','iasdpi_operational_private');
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in
 ('iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities');
select id,jsonb_array_length(plan->'items') as activities from public.iasdpi_templates;
select role,enabled,count(*) from public.iasdpi_access group by role,enabled;
-- As mesmas contas/admins habilitados devem permanecer após a migração.

select table_name,column_name,grantee,privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name in
 ('iasdpi_access','iasdpi_templates','culto_archives','iasdpi_programs','iasdpi_activities','iasdpi_subactivities')
 and grantee in ('PUBLIC','anon','authenticated');
