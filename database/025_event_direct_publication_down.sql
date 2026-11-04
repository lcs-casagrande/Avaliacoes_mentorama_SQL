-- 025 DOWN: nenhuma tabela ou versão é excluída.
-- Se houve gravação pelo fluxo novo, restaurar backup em ambiente isolado e comparar.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Exige postgres.';END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_operational_private.receipts WHERE signature LIKE 'event-submit-025:%' OR signature LIKE 'event-series-025:%') THEN
 RAISE EXCEPTION 'Reversão automática recusada: há eventos gravados pelo fluxo 025. Use recuperação por backup, sem apagar eventos ou históricos.';END IF;
END $$;

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.event_store_before_025(uuid,bigint,jsonb,uuid,uuid,date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.event_store_before_025(','FUNCTION iasdpi_schedule_private.event_store(');
END $$;
DROP FUNCTION iasdpi_schedule_private.event_store_before_025(uuid,bigint,jsonb,uuid,uuid,date,boolean);

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.iasdpi_event_submit_before_025(uuid,bigint,jsonb,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.iasdpi_event_submit_before_025(','FUNCTION public.iasdpi_event_submit(');
END $$;
DROP FUNCTION iasdpi_schedule_private.iasdpi_event_submit_before_025(uuid,bigint,jsonb,uuid,boolean);

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.iasdpi_event_save_before_025(uuid,bigint,jsonb,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.iasdpi_event_save_before_025(','FUNCTION public.iasdpi_event_save(');
END $$;
DROP FUNCTION iasdpi_schedule_private.iasdpi_event_save_before_025(uuid,bigint,jsonb,uuid);

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.iasdpi_event_series_save_before_025(uuid,bigint,jsonb,uuid,text,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.iasdpi_event_series_save_before_025(','FUNCTION public.iasdpi_event_series_save(');
END $$;
DROP FUNCTION iasdpi_schedule_private.iasdpi_event_series_save_before_025(uuid,bigint,jsonb,uuid,text,uuid,boolean);

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.iasdpi_events_catalog_before_025()'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.iasdpi_events_catalog_before_025(','FUNCTION public.iasdpi_events_catalog(');
END $$;
DROP FUNCTION iasdpi_schedule_private.iasdpi_events_catalog_before_025();

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.calendar_events_feed_before_025(date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.calendar_events_feed_before_025(','FUNCTION iasdpi_schedule_private.calendar_events_feed(');
END $$;
DROP FUNCTION iasdpi_schedule_private.calendar_events_feed_before_025(date,boolean);

DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('iasdpi_schedule_private.event_conflict_view_before_025(jsonb)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.event_conflict_view_before_025(','FUNCTION iasdpi_schedule_private.event_conflict_view(');
END $$;
DROP FUNCTION iasdpi_schedule_private.event_conflict_view_before_025(jsonb);

NOTIFY pgrst,'reload schema';
COMMIT;
