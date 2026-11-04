-- G7: reversão SOMENTE de 015 vazia, para o estado 014. Nunca usar com dados G5.
-- Exige pacote frontend anterior validado, snapshot e janela sem novas gravações.
-- Não usar CASCADE. Qualquer divergência aborta a transação inteira.
BEGIN;
DO $$ DECLARE f record;BEGIN
 IF current_user<>'postgres' OR to_regclass('public.schedule_elder_periods') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 015 instalada.';END IF;
 IF to_regprocedure('public.iasdpi_schedule_department_days(uuid)') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.schedule_departments'::regclass AND attname='planning_weekdays' AND NOT attisdropped) THEN
 RAISE EXCEPTION 'Há migrações posteriores à 015. Reversão automática recusada; use o procedimento G7.';END IF;
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 LOCK TABLE public.schedule_elder_periods,public.schedule_elder_versions IN ACCESS EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.schedule_elder_periods) OR EXISTS(SELECT 1 FROM public.schedule_elder_versions)
 OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.audit_logs WHERE entity LIKE 'elder-%')
 OR EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE signature LIKE 'elder-g5:%') THEN
 RAISE EXCEPTION '015 possui escalas ou histórico. Nada foi removido. Preserve o banco; restauração exige backup e revisão autorizada.';END IF;
 IF to_regprocedure('iasdpi_schedule_private.published_g4(date)') IS NULL
 OR to_regprocedure('iasdpi_schedule_private.settings_get_g4()') IS NULL
 OR to_regprocedure('iasdpi_schedule_private.rotation_context_g4(uuid,date)') IS NULL THEN RAISE EXCEPTION 'Implementações anteriores ausentes; não reverter automaticamente.';END IF;
 IF strpos(pg_get_functiondef('public.iasdpi_schedule_published(date)'::regprocedure),'published_g4')=0
 OR strpos(pg_get_functiondef('public.iasdpi_schedule_settings_get()'::regprocedure),'settings_get_g4')=0
 OR strpos(pg_get_functiondef('public.iasdpi_schedule_rotation_context(uuid,date)'::regprocedure),'rotation_context_g4')=0 THEN
 RAISE EXCEPTION 'RPCs modificadas depois da 015; revisão manual obrigatória.';END IF;
 -- Dependências adicionais em funções não são removidas implicitamente.
 FOR f IN SELECT p.oid::regprocedure::text sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND (p.prosrc LIKE '%schedule_elder_%' OR p.prosrc LIKE '%published_elder_periods%' OR p.prosrc LIKE '%elder_validate%' OR p.prosrc LIKE '%elder_id(%' OR p.prosrc LIKE '%elder_revalidate%')
 AND p.proname NOT IN ('iasdpi_schedule_elder_workspace','iasdpi_schedule_elder_save','iasdpi_schedule_elder_versions','iasdpi_schedule_published','elder_validate','elder_revalidate') LOOP
 RAISE EXCEPTION 'Dependência adicional %; restauração administrativa obrigatória.',f.sig;END LOOP;
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_people','schedule_memberships','schedule_departments','schedule_day_exceptions','schedule_legacy_commitments','schedule_assignments','schedule_elder_versions'] LOOP
 EXECUTE format('DROP TRIGGER elder_revalidate ON public.%I',t);END LOOP;
END $$;
CREATE OR REPLACE VIEW iasdpi_schedule_private.confirmed_days WITH(security_invoker=true) AS
 SELECT a.person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM public.schedule_assignments a
 JOIN public.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) d(day)
 UNION ALL SELECT person_id,department_id,scheduled_on,NULL::uuid,NULL::uuid FROM public.schedule_legacy_commitments;
DROP FUNCTION public.iasdpi_schedule_published(date),public.iasdpi_schedule_settings_get(),public.iasdpi_schedule_rotation_context(uuid,date);
ALTER FUNCTION iasdpi_schedule_private.published_g4(date) RENAME TO iasdpi_schedule_published;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_published(date) SET SCHEMA public;
ALTER FUNCTION iasdpi_schedule_private.settings_get_g4() RENAME TO iasdpi_schedule_settings_get;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() SET SCHEMA public;
ALTER FUNCTION iasdpi_schedule_private.rotation_context_g4(uuid,date) RENAME TO iasdpi_schedule_rotation_context;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_rotation_context(uuid,date) SET SCHEMA public;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_published(date) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_settings_get(),public.iasdpi_schedule_rotation_context(uuid,date) TO authenticated;
DROP FUNCTION public.iasdpi_schedule_elder_workspace(uuid,date,integer),public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid),public.iasdpi_schedule_elder_versions(uuid,text,date);
DROP FUNCTION iasdpi_schedule_private.elder_revalidate(),iasdpi_schedule_private.elder_validate(uuid,text,date,date,uuid),iasdpi_schedule_private.elder_id(uuid,text,date);
DROP VIEW iasdpi_schedule_private.published_elder_periods;
DROP TABLE public.schedule_elder_versions,public.schedule_elder_periods;
NOTIFY pgrst,'reload schema';
COMMIT;
