-- Reversão guardada: não apaga cadastros. Usar somente após revisão/autorização.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.schedule_plans') IS NOT NULL OR to_regclass('public.iasdpi_churches') IS NOT NULL OR to_regclass('public.schedule_elder_periods') IS NOT NULL THEN RAISE EXCEPTION 'Rollback 005 recusado: há migrações posteriores. Preserve o banco e use o procedimento G7.';END IF;
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Executar como postgres.'; END IF;
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 IF EXISTS(SELECT 1 FROM public.schedule_people)
 OR EXISTS(SELECT 1 FROM public.schedule_roles)
 OR EXISTS(SELECT 1 FROM public.schedule_memberships)
 OR EXISTS(SELECT 1 FROM public.schedule_qualifications)
 OR EXISTS(SELECT 1 FROM public.schedule_availability)
 OR EXISTS(SELECT 1 FROM public.schedule_department_access)
 OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.person_details)
 OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.audit_logs)
 OR EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE signature LIKE 'schedule-foundation:%')
 OR EXISTS(SELECT 1 FROM public.schedule_departments WHERE version<>1 OR NOT active OR (id,code,name) NOT IN (
 ('a0000000-0000-4000-8000-000000000001'::uuid,'sonoplastia','Sonoplastia'),
 ('a0000000-0000-4000-8000-000000000002'::uuid,'diaconato','Diaconato'),
 ('a0000000-0000-4000-8000-000000000003'::uuid,'musica','Música'),
 ('a0000000-0000-4000-8000-000000000004'::uuid,'ancionato','Ancionato'))) THEN
   RAISE EXCEPTION 'Reversão recusada: existem dados de usuário. Reverta somente o frontend e preserve o banco.';
 END IF;
END $$;
DROP FUNCTION public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid);
DROP FUNCTION public.iasdpi_schedule_person_details(uuid);
DROP FUNCTION public.iasdpi_schedule_catalog();
DROP FUNCTION iasdpi_schedule_private.can_see_person(uuid,uuid);
DROP FUNCTION iasdpi_schedule_private.can_view(uuid,uuid);
DROP FUNCTION iasdpi_schedule_private.can_manage(uuid,uuid);
DROP FUNCTION iasdpi_schedule_private.is_admin(uuid);
DROP FUNCTION iasdpi_schedule_private.actor();
DROP TABLE public.schedule_qualifications;
DROP TABLE public.schedule_availability;
DROP TABLE public.schedule_department_access;
DROP TABLE public.schedule_memberships;
DROP TABLE public.schedule_roles;
DROP TABLE iasdpi_schedule_private.person_details;
DROP TABLE iasdpi_schedule_private.audit_logs;
DROP TABLE public.schedule_people;
DROP TABLE public.schedule_departments;
DROP FUNCTION iasdpi_schedule_private.valid_weekdays(smallint[]);
DROP FUNCTION iasdpi_schedule_private.normal_name(text);
DROP SCHEMA iasdpi_schedule_private;
NOTIFY pgrst,'reload schema';
COMMIT;
