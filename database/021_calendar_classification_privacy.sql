-- 021: classificação editorial e privacidade, após 001–020. Não importa ou reclassifica dados.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.iasdpi_events') IS NULL OR to_regprocedure('public.iasdpi_events_published(date)') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 001–020 completas.';END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='iasdpi_events' AND column_name='is_restricted') THEN RAISE EXCEPTION '021 já instalada; revisar sem sobrescrever.';END IF;
END $$;
ALTER TABLE public.iasdpi_events
 ADD COLUMN program_category text CHECK(program_category IN('general','departmental','reserved')),
 ADD COLUMN organizer_kind text CHECK(organizer_kind IN('local_church','association','school','department','other')),
 ADD COLUMN audience text CHECK(audience IN('whole_church','specific','restricted')),
 ADD COLUMN is_restricted boolean NOT NULL DEFAULT false,
 ADD COLUMN organizer_department_id uuid,
 ADD CONSTRAINT events_organizer_department_fk FOREIGN KEY(church_id,organizer_department_id) REFERENCES public.schedule_departments(church_id,id),
 ADD CONSTRAINT events_organizer_kind CHECK(organizer_department_id IS NULL OR organizer_kind IS NOT DISTINCT FROM 'department');
-- category/department_id continuam sendo o escopo de autorização. Não substituir por program_category.
CREATE OR REPLACE FUNCTION public.iasdpi_event_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;old public.iasdpi_events;e public.iasdpi_events;c uuid;sig text;r iasdpi_operational_private.receipts;
 result jsonb;needs_edit boolean;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_schedule_private.actor();c:=public.iasdpi_current_church_id();
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_request_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason','program_category','organizer_kind','audience','is_restricted','organizer_department_id')) THEN
 RAISE EXCEPTION 'Campos, identificador ou versão inválidos.' USING errcode='22023';END IF;
 SELECT * INTO old FROM public.iasdpi_events WHERE id=p_id FOR UPDATE;
 e:=jsonb_populate_record(NULL::public.iasdpi_events,coalesce(to_jsonb(old),'{}')||p_patch);
 needs_edit:=old.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) OR coalesce(e.status,'draft')='draft';
 IF (needs_edit AND (NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'edit'),false)))
 OR (e.status IN('published','cancelled') AND (NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'publish'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'publish'),false))) THEN
 RAISE EXCEPTION 'Sem permissão para gerir ou publicar este evento nesta igreja e departamento.' USING errcode='42501';END IF;
 sig:='events-e21:'||iasdpi_operational_private.fingerprint(jsonb_build_object('church',c,'id',p_id,'version',p_expected_version,'patch',p_patch));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.' USING errcode='40001';END IF;
 IF e.source_key IS NOT NULL AND (old.id IS NULL OR e.source_key IS DISTINCT FROM old.source_key) AND NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador associa eventos da fonte oficial.' USING errcode='42501';END IF;
 IF old.source_key IS NOT NULL AND (e.source_key IS DISTINCT FROM old.source_key OR e.source_url IS DISTINCT FROM old.source_url) THEN
 RAISE EXCEPTION 'A associação da fonte existente não pode ser substituída.' USING errcode='22023';END IF;
 IF e.source_key IS NOT NULL AND c<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Fonte exclusiva da IASD_PI.' USING errcode='42501';END IF;
 IF old.id IS NULL THEN
 e.is_restricted:=coalesce(e.is_restricted,false);e.all_day:=coalesce(e.all_day,false);e.status:=coalesce(e.status,'draft');e.created_by:=u;e.created_at:=now();e.location:=coalesce(e.location,'');e.description:=coalesce(e.description,'');e.cancellation_reason:=coalesce(e.cancellation_reason,'');
 END IF;
 IF NOT p_patch ? 'end_date' AND (old.id IS NULL OR old.end_date=old.date) THEN e.end_date:=e.date;END IF;
 IF e.status='published' AND e.end_time IS NOT NULL AND e.start_time IS NULL THEN RAISE EXCEPTION 'Horário inicial pendente. Confirme antes de publicar.' USING errcode='23514';END IF;
 IF e.status='published' AND (e.category IS NULL OR e.category='department' AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id=e.department_id AND d.active)) THEN
 RAISE EXCEPTION 'Confirme a categoria e o departamento responsável antes de publicar.' USING errcode='23514';END IF;
 e.id:=p_id;e.church_id:=c;e.version:=coalesce(old.version,0)+1;e.updated_by:=u;e.updated_at:=now();
 IF old.id IS NULL THEN INSERT INTO public.iasdpi_events SELECT e.*;
 ELSE UPDATE public.iasdpi_events SET title=e.title,date=e.date,end_date=e.end_date,all_day=e.all_day,start_time=e.start_time,end_time=e.end_time,
 program_category=e.program_category,organizer_kind=e.organizer_kind,audience=e.audience,is_restricted=e.is_restricted,organizer_department_id=e.organizer_department_id,location=e.location,description=e.description,category=e.category,department_id=e.department_id,status=e.status,source_key=e.source_key,source_url=e.source_url,
 cancellation_reason=e.cancellation_reason,version=e.version,updated_by=u,updated_at=e.updated_at WHERE id=p_id;END IF;
 INSERT INTO public.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(c,p_id,e.version,u,e.status,to_jsonb(e));
 result:=to_jsonb(e);INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;

-- Projeção comum: consulta pública nunca recebe título, local ou descrição de evento restrito.
CREATE FUNCTION iasdpi_schedule_private.calendar_events_feed(p_month date,p_private boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 PERFORM public.iasdpi_current_church_id();
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1000-01-01' OR p_month>'9998-12-01' THEN RAISE EXCEPTION 'Informe o primeiro dia de um mês válido.' USING errcode='22023';END IF;
 IF p_private THEN u:=iasdpi_schedule_private.actor();END IF;
 RETURN (WITH latest AS(SELECT DISTINCT ON(event_id) event_id,status,snapshot FROM public.iasdpi_event_versions WHERE status IN('published','cancelled') ORDER BY event_id,version DESC)
 SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg((l.snapshot-'created_by'-'updated_by'-'cancellation_reason')||jsonb_build_object('department_name',d.name)
 ORDER BY l.snapshot->>'date',l.snapshot->>'title') FROM latest l JOIN public.iasdpi_events e ON e.id=l.event_id
 LEFT JOIN public.schedule_departments d ON d.id=(l.snapshot->>'department_id')::uuid
 WHERE l.status='published' AND (l.snapshot->>'date')::date<(p_month+interval '1 month')::date AND (l.snapshot->>'end_date')::date>=p_month
 AND ((NOT e.is_restricted AND NOT coalesce((l.snapshot->>'is_restricted')::boolean,false)) OR
 p_private AND (iasdpi_schedule_private.is_admin(u) OR l.snapshot->>'category'='department' AND iasdpi_schedule_private.can_view(u,(l.snapshot->>'department_id')::uuid)))),'[]'),
 -- IDs de origem somente de fotografias não restritas. Não retornar metadados de registros ocultos.
 'suppressed_source_keys',coalesce((SELECT jsonb_agg(DISTINCT l.snapshot->>'source_key') FROM latest l JOIN public.iasdpi_events e ON e.id=l.event_id
 WHERE l.snapshot->>'source_key' IS NOT NULL AND NOT e.is_restricted AND NOT coalesce((l.snapshot->>'is_restricted')::boolean,false)),'[]')));
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_events_published(p_month date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_schedule_private.calendar_events_feed(p_month,false); $$;
CREATE FUNCTION public.iasdpi_events_visible(p_month date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT iasdpi_schedule_private.calendar_events_feed(p_month,true); $$;

-- A implementação 015 é preservada como helper privado. O endpoint antigo passa a devolver só Ancionato.
ALTER FUNCTION public.iasdpi_schedule_published(date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_published(date) RENAME TO published_before_privacy;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.published_before_privacy(date) FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_schedule_private.published_before_privacy(p_month);
 RETURN coalesce((SELECT jsonb_agg(r) FROM jsonb_array_elements(rows) r WHERE EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id=(r->>'department_id')::uuid AND d.code='ancionato' AND d.active)),'[]');
END $$;
CREATE FUNCTION public.iasdpi_schedule_visible(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();rows jsonb;BEGIN
 rows:=iasdpi_schedule_private.published_before_privacy(p_month);
 RETURN coalesce((SELECT jsonb_agg(r) FROM jsonb_array_elements(rows) r WHERE EXISTS(SELECT 1 FROM public.schedule_departments d
 WHERE d.id=(r->>'department_id')::uuid AND (d.code='ancionato' OR iasdpi_schedule_private.can_view(u,d.id)))),'[]')||
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.source_key,'date',l.scheduled_on,'department_id',d.id,'department',d.name,'person_id',p.id,
 'person',p.display_name,'original_person',l.original_name,'role',NULL,'origin','Histórico manual confirmado','legacy',true) ORDER BY l.scheduled_on,l.source_key)
 FROM public.schedule_legacy_commitments l JOIN public.schedule_departments d ON d.id=l.department_id JOIN public.schedule_people p ON p.id=l.person_id
 WHERE l.scheduled_on>=p_month AND l.scheduled_on<(p_month+interval '1 month')::date AND iasdpi_schedule_private.can_view(u,d.id)),'[]');
END $$;
-- Retira associações históricas privadas do endpoint público de nomes/organograma.
ALTER FUNCTION public.iasdpi_registry_public() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_registry_public() RENAME TO registry_before_privacy;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.registry_before_privacy() FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;BEGIN
 c:=iasdpi_schedule_private.registry_before_privacy();
 RETURN c||jsonb_build_object('links',coalesce((SELECT jsonb_agg(link) FROM jsonb_array_elements(c->'links') link
 WHERE left(link->>'source_key',9)='ministry:' OR EXISTS(SELECT 1 FROM public.schedule_source_links s JOIN public.schedule_departments d ON d.id=(s.reference->>'department_id')::uuid
 WHERE s.source_key=link->>'source_key' AND s.reference->>'kind' IN('weekly','monthly') AND d.code='ancionato')),'[]'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_event_save','iasdpi_events_published','iasdpi_events_visible','iasdpi_schedule_published','iasdpi_schedule_visible','iasdpi_registry_public')
 OR n.nspname='iasdpi_schedule_private' AND p.proname IN('calendar_events_feed','published_before_privacy','registry_before_privacy') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.iasdpi_events_published(date),public.iasdpi_schedule_published(date),public.iasdpi_registry_public() TO anon;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
