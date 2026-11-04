-- Rollback 022 SOMENTE antes de uso da estrutura nova. Não apaga dados operacionais.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Exige postgres.';END IF;
 IF EXISTS(SELECT 1 FROM public.iasdpi_event_series) OR EXISTS(SELECT 1 FROM public.iasdpi_event_reservations)
 OR EXISTS(SELECT 1 FROM public.iasdpi_events WHERE spaces IS NOT NULL OR approval_status<>'legacy' OR series_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.iasdpi_churches c WHERE c.code='IASD_PI' AND (SELECT count(*) FROM public.iasdpi_event_spaces s WHERE s.church_id=c.id)<>5)
 OR EXISTS(SELECT 1 FROM public.iasdpi_event_spaces s JOIN public.iasdpi_churches c ON c.id=s.church_id WHERE c.code<>'IASD_PI'
 OR NOT (s.code,s.name,s.exclusive) IN(('nave','Nave',true),('quadra','Quadra',true),('patio','Pátio',true),('salas','Salas',false),('externo','Externo',false))) THEN
 RAISE EXCEPTION 'Rollback recusado: existem dados 022. Faça backup e restaure em projeto isolado; não descarte séries, reservas ou aprovações.';END IF;
END $$;
DROP FUNCTION public.iasdpi_event_save(uuid,bigint,jsonb,uuid),public.iasdpi_event_submit(uuid,bigint,jsonb,uuid,boolean),public.iasdpi_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean),public.iasdpi_event_preview(jsonb,uuid[]),public.iasdpi_events_catalog(),public.iasdpi_event_history(uuid);
DROP FUNCTION iasdpi_schedule_private.calendar_events_feed(date,boolean);
ALTER FUNCTION iasdpi_schedule_private.calendar_events_feed_021(date,boolean) RENAME TO calendar_events_feed;
DROP FUNCTION iasdpi_schedule_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean),iasdpi_schedule_private.event_conflict_view(jsonb),iasdpi_schedule_private.event_conflicts(jsonb,uuid[]),iasdpi_schedule_private.event_dates(jsonb,date),iasdpi_schedule_private.event_interval(jsonb);
DROP TABLE public.iasdpi_event_reservations,public.iasdpi_event_series_versions;
DROP INDEX public.iasdpi_events_identity;
DROP FUNCTION iasdpi_schedule_private.event_space_key(text[]);
ALTER TABLE public.iasdpi_events DROP CONSTRAINT event_series_fk,DROP CONSTRAINT event_occurrence_identity,DROP COLUMN series_id,DROP COLUMN occurrence_on,DROP COLUMN approval_status,DROP COLUMN reservation_conflicts,DROP COLUMN spaces;
DROP TABLE public.iasdpi_event_series,public.iasdpi_event_spaces;
CREATE UNIQUE INDEX iasdpi_events_identity ON public.iasdpi_events(church_id,iasdpi_schedule_private.normal_name(title),date,end_date,coalesce(start_time::text,''),coalesce(end_time::text,''),coalesce(category,''),coalesce(department_id::text,''),iasdpi_schedule_private.normal_name(location));
ALTER FUNCTION iasdpi_schedule_private.event_save_021(uuid,bigint,jsonb,uuid) RENAME TO iasdpi_event_save;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_event_save(uuid,bigint,jsonb,uuid) SET SCHEMA public;
ALTER FUNCTION iasdpi_schedule_private.events_catalog_021() RENAME TO iasdpi_events_catalog;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_events_catalog() SET SCHEMA public;
ALTER FUNCTION iasdpi_schedule_private.event_history_021(uuid) RENAME TO iasdpi_event_history;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_event_history(uuid) SET SCHEMA public;
GRANT EXECUTE ON FUNCTION public.iasdpi_event_save(uuid,bigint,jsonb,uuid),public.iasdpi_events_catalog(),public.iasdpi_event_history(uuid) TO authenticated;
-- Não remover btree_gist/extensions: podem atender outras funcionalidades.
NOTIFY pgrst,'reload schema';
COMMIT;
