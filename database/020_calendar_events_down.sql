-- Reversão exclusiva da 020 vazia; nunca remove eventos ou histórico preenchidos.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.iasdpi_events') IS NULL OR to_regclass('public.iasdpi_event_versions') IS NULL THEN
 RAISE EXCEPTION 'Revisar a instalação 020 com operador postgres.';END IF;
 IF EXISTS(SELECT 1 FROM public.iasdpi_events) OR EXISTS(SELECT 1 FROM public.iasdpi_event_versions) THEN
 RAISE EXCEPTION 'Rollback recusado: existem eventos ou versões. Use backup/restauração em destino separado ou correção forward revisada.';END IF;
END $$;
DROP FUNCTION public.iasdpi_events_catalog(),public.iasdpi_event_save(uuid,bigint,jsonb,uuid),public.iasdpi_event_history(uuid),public.iasdpi_events_published(date);
DROP FUNCTION iasdpi_schedule_private.event_can(uuid,text,uuid,text);
DROP TABLE public.iasdpi_event_versions;
DROP TABLE public.iasdpi_events;
NOTIFY pgrst,'reload schema';
COMMIT;
