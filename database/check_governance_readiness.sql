-- G6: SOMENTE LEITURA. Marcadores estruturais, não substituem hashes/registro administrativo.
-- Pode ser executado antes de 005–015. Não cria objetos, contas ou permissões.
SELECT stage,marker,CASE WHEN present THEN 'Presente: confirmar versão e histórico de aplicação' ELSE 'Ausente: não avançar fora da ordem' END status
FROM (VALUES
 ('005','schedule_departments',to_regclass('public.schedule_departments') IS NOT NULL),
 ('006','schedule_plans',to_regclass('public.schedule_plans') IS NOT NULL),
 ('007','schedule_settings',to_regclass('public.schedule_settings') IS NOT NULL),
 ('008','rotation_context',to_regprocedure('public.iasdpi_schedule_rotation_context(uuid,date)') IS NOT NULL),
 ('009','schedule_legacy_commitments',to_regclass('public.schedule_legacy_commitments') IS NOT NULL),
 ('010','general_assignment',EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.schedule_roles') AND attname='general_assignment' AND NOT attisdropped)),
 ('011','church_registry_and_executor',to_regclass('public.iasdpi_churches') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_church_executor')),
 ('012','login_aliases',to_regclass('iasdpi_admin_private.login_aliases') IS NOT NULL),
 ('013','identity_epochs',to_regclass('iasdpi_governance_private.identity_epochs') IS NOT NULL),
 ('014','portal_context',to_regprocedure('public.iasdpi_portal_context()') IS NOT NULL),
 ('015','schedule_elder_periods',to_regclass('public.schedule_elder_periods') IS NOT NULL)
) checks(stage,marker,present) ORDER BY stage;
