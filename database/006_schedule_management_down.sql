-- Reversão de uma instalação B1 VAZIA, como postgres. Nunca apaga escalas.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.schedule_settings') IS NOT NULL OR to_regclass('public.iasdpi_churches') IS NOT NULL OR to_regclass('public.schedule_elder_periods') IS NOT NULL THEN RAISE EXCEPTION 'Rollback 006 recusado: há migrações posteriores. Preserve o banco e use o procedimento G7.';END IF;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Use postgres.'; END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_events) OR EXISTS(SELECT 1 FROM public.schedule_plans)
 OR EXISTS(SELECT 1 FROM public.schedule_versions) OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.audit_logs WHERE entity LIKE 'b1-%')
 OR EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE signature LIKE 'schedule-b1-%') THEN
  RAISE EXCEPTION 'B1 possui dados ou histórico. Reverta somente o frontend e preserve o banco; não remova esta proteção.';
 END IF;
END $$;
DROP FUNCTION public.iasdpi_schedule_plan_save(uuid,bigint,jsonb,uuid),public.iasdpi_schedule_event_create(uuid,jsonb,uuid),
 public.iasdpi_schedule_plan_version(uuid,bigint),public.iasdpi_schedule_workspace(uuid,date);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_people','schedule_memberships','schedule_roles','schedule_qualifications','schedule_availability','schedule_departments'] LOOP
  EXECUTE format('DROP TRIGGER schedule_b1_revalidate ON public.%I',t);
 END LOOP;
END $$;
DROP TRIGGER schedule_assignment_guard ON public.schedule_assignments;
DROP FUNCTION iasdpi_schedule_private.assignment_guard(),iasdpi_schedule_private.revalidate_plans(),
 iasdpi_schedule_private.validate_assignment(public.schedule_assignments),iasdpi_schedule_private.plan_snapshot(uuid);
DROP TABLE public.schedule_versions,public.schedule_assignments,public.schedule_requirements,public.schedule_plans,public.schedule_events;
NOTIFY pgrst,'reload schema';
COMMIT;
