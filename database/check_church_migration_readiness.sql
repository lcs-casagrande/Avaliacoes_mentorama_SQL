-- SOMENTE LEITURA, antes da 011. Não concede acesso nem divulga contas.
WITH requirements AS (
 SELECT 'operator' item,current_user='postgres' ok,'Executar como postgres' detail
 UNION ALL SELECT 'postgresql',current_setting('server_version_num')::integer>=150000,'Exige PostgreSQL 15 ou superior'
 UNION ALL SELECT 'core_001_004',to_regprocedure('public.iasdpi_trash_program(text,bigint,uuid,text)') IS NOT NULL,'Base operacional 001–004 instalada'
 UNION ALL SELECT 'church_registry',to_regclass('public.iasdpi_churches') IS NULL,'Se já existe, não executar novamente; revisar cadastro existente'
 UNION ALL SELECT 'schedules',to_regclass('public.schedule_departments') IS NULL OR to_regprocedure('public.iasdpi_schedule_daily_role(uuid)') IS NOT NULL,'Escalas ausentes ou 005–010 completas; instalação parcial bloqueia a 011'
 UNION ALL SELECT 'create_role',EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolcreaterole OR rolsuper)),'O operador precisa poder criar/atribuir o papel executor NOLOGIN'
 UNION ALL SELECT 'auth_bridge',has_column_privilege(current_user,'auth.users','email','SELECT'),'O operador precisa ler os campos mínimos de Auth para criar a ponte privada'
 UNION ALL SELECT 'public_create',NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='public' AND a.grantee=0 AND a.privilege_type='CREATE'),'PUBLIC não deve conceder CREATE no schema public'
)
SELECT item,CASE WHEN ok THEN 'OK' ELSE 'REVISAR' END status,detail FROM requirements ORDER BY item;
