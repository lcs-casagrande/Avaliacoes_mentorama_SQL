-- 025: publicação direta de eventos por usuários já autorizados.
-- Revisão somente: não aplicar no Supabase real sem autorização. Após 001–024.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('iasdpi_schedule_private.departments_conflict(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'Exige postgres e migrações 001–024.';END IF;
END $$;

-- iasdpi_schedule_private.event_store: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.event_store_before_025(uuid,bigint,jsonb,uuid,uuid,date,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('iasdpi_schedule_private.event_store(uuid,bigint,jsonb,uuid,uuid,date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.event_store(','FUNCTION iasdpi_schedule_private.event_store_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["e.approval_status:=coalesce(old.approval_status,'not_required');\n IF old.id IS NULL OR e.program_category IS DISTINCT FROM old.program_category THEN e.approval_status:=CASE WHEN e.program_category='general' THEN 'pending' ELSE 'not_required' END;END IF;\n IF old.approval_status IN('pending','rejected') THEN e.approval_status:=old.approval_status;END IF;\n IF p_pending OR e.program_category='general' AND EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) THEN e.approval_status:='pending';END IF;\n IF e.approval_status IN('pending','rejected') AND e.status='published' THEN e.status:='draft';END IF;", "e.approval_status:='not_required'; -- 025: publicação direta, sem reescrever versões anteriores."], ["jsonb_array_length(e.reservation_conflicts)>0 AND NOT p_pending", "jsonb_array_length(e.reservation_conflicts)>0 AND e.status='published'"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: iasdpi_schedule_private.event_store.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_event_submit: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.iasdpi_event_submit_before_025(uuid,bigint,jsonb,uuid,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_event_submit(uuid,bigint,jsonb,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_event_submit(','FUNCTION iasdpi_schedule_private.iasdpi_event_submit_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["event-submit-022:", "event-submit-025:"], ["IF jsonb_array_length(conflicts)>0 AND e.series_id IS NOT NULL AND NOT coalesce(p_accept_conflicts,false) THEN RETURN jsonb_build_object('requires_confirmation',true,'conflicts',iasdpi_schedule_private.event_conflict_view(conflicts));END IF;", "-- 025: conflitos são bloqueios de publicação, nunca pedidos de aprovação."], ["e.series_id IS NOT NULL AND jsonb_array_length(conflicts)>0);", "false);"], ["approval_status=CASE WHEN result->>'approval_status'='pending' THEN 'pending' ELSE approval_status END", "approval_status='not_required'"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_event_submit.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_event_save: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.iasdpi_event_save_before_025(uuid,bigint,jsonb,uuid)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_event_save(uuid,bigint,jsonb,uuid)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_event_save(','FUNCTION iasdpi_schedule_private.iasdpi_event_save_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["Esta ocorrência possui conflitos; revise e envie para aprovação na nova interface.", "Reserva em conflito. Revise os locais e horários antes de publicar."]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_event_save.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_event_series_save: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.iasdpi_event_series_save_before_025(uuid,bigint,jsonb,uuid,text,uuid,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_event_series_save(uuid,bigint,jsonb,uuid,text,uuid,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_event_series_save(','FUNCTION iasdpi_schedule_private.iasdpi_event_series_save_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["event-series-022:", "event-series-025:"], ["IF (plan->>'conflict_count')::integer>0 AND NOT coalesce(p_accept_conflicts,false) AND definition->>'status'<>'cancelled' THEN\n RETURN plan||jsonb_build_object('requires_confirmation',true);END IF;", "IF (plan->>'conflict_count')::integer>0 AND definition->>'status'='published' THEN\n RAISE EXCEPTION 'Reserva em conflito: resolva os locais e horários antes de publicar a série.' USING errcode='23P01';END IF;"], ["pending:=coalesce(definition->>'program_category'='general',false) OR (plan->>'conflict_count')::integer>0 OR coalesce(old.approval_status IN('pending','rejected'),false);", "pending:=false; -- 025: rascunhos não confirmam reservas; publicação exige ausência de conflitos."], ["CASE WHEN pending THEN 'pending' ELSE 'not_required' END", "'not_required'"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_event_series_save.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- public.iasdpi_events_catalog: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.iasdpi_events_catalog_before_025()') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('public.iasdpi_events_catalog()'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_events_catalog(','FUNCTION iasdpi_schedule_private.iasdpi_events_catalog_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["'event_management_v2',true,", "'event_management_v2',true,'event_approval_required',false,"]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: public.iasdpi_events_catalog.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- iasdpi_schedule_private.calendar_events_feed: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.calendar_events_feed_before_025(date,boolean)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('iasdpi_schedule_private.calendar_events_feed(date,boolean)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.calendar_events_feed(','FUNCTION iasdpi_schedule_private.calendar_events_feed_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[["\n WHERE coalesce(e->>'approval_status','legacy') NOT IN('pending','rejected') AND NOT EXISTS(SELECT 1 FROM public.iasdpi_event_series s WHERE s.id=(e->>'series_id')::uuid AND s.approval_status IN('pending','rejected'))", ""]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: iasdpi_schedule_private.calendar_events_feed.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

-- iasdpi_schedule_private.event_conflict_view: preserva OID, permissões e validações não alteradas.
DO $migration$ DECLARE body text;before_text text;after_text text;change jsonb;BEGIN
 IF to_regprocedure('iasdpi_schedule_private.event_conflict_view_before_025(jsonb)') IS NOT NULL THEN RAISE EXCEPTION '025 já instalada ou cópia de segurança existente.';END IF;
 body:=pg_get_functiondef('iasdpi_schedule_private.event_conflict_view(jsonb)'::regprocedure);
 EXECUTE replace(body,'FUNCTION iasdpi_schedule_private.event_conflict_view(','FUNCTION iasdpi_schedule_private.event_conflict_view_before_025(');
 FOR change IN SELECT value FROM jsonb_array_elements($patch$[[" AND NOT EXISTS(SELECT 1 FROM public.iasdpi_event_series es WHERE es.id=e.series_id AND es.approval_status IN('pending','rejected'))", ""]]$patch$::jsonb) LOOP
 before_text:=change->>0;after_text:=change->>1;
 IF strpos(body,before_text)=0 THEN RAISE EXCEPTION 'Núcleo incompatível: iasdpi_schedule_private.event_conflict_view.';END IF;
 body:=replace(body,before_text,after_text);END LOOP;
 EXECUTE body;
END $migration$;

GRANT CREATE ON SCHEMA iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='iasdpi_schedule_private' AND p.proname LIKE '%_before_025' LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);END LOOP;
END $$;
REVOKE CREATE ON SCHEMA iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
