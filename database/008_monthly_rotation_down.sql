-- Rollback somente da 008: não altera tabelas, pessoas, escalas ou versões.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.schedule_legacy_commitments') IS NOT NULL OR to_regclass('public.iasdpi_churches') IS NOT NULL OR to_regclass('public.schedule_elder_periods') IS NOT NULL THEN RAISE EXCEPTION 'Rollback 008 recusado: há migrações posteriores. Preserve o banco e use o procedimento G7.';END IF;
 IF current_user<>'postgres' OR to_regprocedure('iasdpi_schedule_private.workspace_007(uuid,date)') IS NULL THEN
  RAISE EXCEPTION 'Rollback da 008 requer postgres e a versão 007 preservada.';
 END IF;
END $$;
DROP FUNCTION public.iasdpi_schedule_workspace(uuid,date);
ALTER FUNCTION iasdpi_schedule_private.workspace_007(uuid,date) RENAME TO iasdpi_schedule_workspace;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_workspace(uuid,date) SET SCHEMA public;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_workspace(uuid,date) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_workspace(uuid,date) TO authenticated;
DROP FUNCTION public.iasdpi_schedule_rotation_context(uuid,date);
NOTIFY pgrst,'reload schema';
COMMIT;
