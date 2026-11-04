-- 022: eventos recorrentes, locais e aprovação. Executar SOMENTE após revisão e 001–021.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('iasdpi_schedule_private.calendar_events_feed(date,boolean)') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 001–021.';END IF;
 IF to_regclass('public.iasdpi_event_series') IS NOT NULL THEN RAISE EXCEPTION '022 já instalada; não sobrescrever.';END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE TABLE public.iasdpi_event_spaces(
 church_id uuid NOT NULL REFERENCES public.iasdpi_churches(id),code text NOT NULL,name text NOT NULL,exclusive boolean NOT NULL,
 PRIMARY KEY(church_id,code),CHECK(code IN('nave','quadra','patio','salas','externo')));
INSERT INTO public.iasdpi_event_spaces SELECT c.id,v.* FROM public.iasdpi_churches c CROSS JOIN(VALUES
 ('nave','Nave',true),('quadra','Quadra',true),('patio','Pátio',true),('salas','Salas',false),('externo','Externo',false)) v(code,name,exclusive) WHERE c.code='IASD_PI';
CREATE TABLE public.iasdpi_event_series(
 id uuid PRIMARY KEY,church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 definition jsonb NOT NULL,until_date date NOT NULL,version bigint NOT NULL,
 approval_status text NOT NULL CHECK(approval_status IN('not_required','pending','approved','rejected')),
 category text,department_id uuid,created_by uuid NOT NULL REFERENCES auth.users(id),updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(church_id,id),
 FOREIGN KEY(church_id,department_id) REFERENCES public.schedule_departments(church_id,id));
CREATE TABLE public.iasdpi_event_series_versions(
 church_id uuid NOT NULL,event_series_id uuid NOT NULL,version bigint NOT NULL,actor_id uuid NOT NULL REFERENCES auth.users(id),
 captured_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb NOT NULL,PRIMARY KEY(church_id,event_series_id,version),
 FOREIGN KEY(church_id,event_series_id) REFERENCES public.iasdpi_event_series(church_id,id));
ALTER TABLE public.iasdpi_events ADD COLUMN spaces text[],ADD COLUMN approval_status text NOT NULL DEFAULT 'legacy'
 CHECK(approval_status IN('legacy','not_required','pending','approved','rejected')),
 ADD COLUMN series_id uuid,ADD COLUMN occurrence_on date,ADD COLUMN reservation_conflicts jsonb NOT NULL DEFAULT '[]',
 ADD CONSTRAINT event_series_fk FOREIGN KEY(church_id,series_id) REFERENCES public.iasdpi_event_series(church_id,id),
 ADD CONSTRAINT event_occurrence_identity CHECK((series_id IS NULL)=(occurrence_on IS NULL));
-- Preserva a identidade anterior e diferencia os conjuntos de locais novos.
CREATE FUNCTION iasdpi_schedule_private.event_space_key(codes text[]) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT coalesce(string_agg(length(x)::text||':'||x,';' ORDER BY x),'') FROM unnest(codes) x; $$;
DROP INDEX public.iasdpi_events_identity;
CREATE UNIQUE INDEX iasdpi_events_identity ON public.iasdpi_events(church_id,
 iasdpi_schedule_private.normal_name(title),date,end_date,coalesce(start_time::text,''),coalesce(end_time::text,''),
 coalesce(category,''),coalesce(department_id::text,''),iasdpi_schedule_private.normal_name(location),iasdpi_schedule_private.event_space_key(spaces));
CREATE UNIQUE INDEX event_occurrence_unique ON public.iasdpi_events(church_id,series_id,occurrence_on) WHERE series_id IS NOT NULL;
CREATE TABLE public.iasdpi_event_reservations(
 church_id uuid NOT NULL,event_id uuid NOT NULL,space_code text NOT NULL,occupied tstzrange NOT NULL,
 PRIMARY KEY(church_id,event_id,space_code),FOREIGN KEY(church_id,event_id) REFERENCES public.iasdpi_events(church_id,id),
 FOREIGN KEY(church_id,space_code) REFERENCES public.iasdpi_event_spaces(church_id,code),CHECK(NOT isempty(occupied)));
DO $$ DECLARE n text;BEGIN
 SELECT ns.nspname INTO n FROM pg_extension x JOIN pg_namespace ns ON ns.oid=x.extnamespace WHERE x.extname='btree_gist';
 EXECUTE format('ALTER TABLE public.iasdpi_event_reservations ADD CONSTRAINT exclusive_event_space EXCLUDE USING gist(church_id %I.gist_uuid_ops WITH =,space_code %I.gist_text_ops WITH =,occupied WITH &&)',n,n);
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['iasdpi_event_spaces','iasdpi_event_series','iasdpi_event_series_versions','iasdpi_event_reservations'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('CREATE POLICY church_boundary ON public.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON public.%I FOR ALL TO iasdpi_church_executor USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 END LOOP;
END $$;
GRANT SELECT ON public.iasdpi_event_spaces TO iasdpi_church_executor;
GRANT SELECT,INSERT,UPDATE ON public.iasdpi_event_series TO iasdpi_church_executor;
GRANT SELECT,INSERT ON public.iasdpi_event_series_versions TO iasdpi_church_executor;
GRANT SELECT,INSERT,DELETE ON public.iasdpi_event_reservations TO iasdpi_church_executor;
CREATE FUNCTION iasdpi_schedule_private.event_interval(e jsonb) RETURNS tstzrange
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE a timestamptz;b timestamptz;BEGIN
 IF coalesce((e->>'all_day')::boolean,false) THEN a:=(e->>'date')::date::timestamp AT TIME ZONE 'America/Sao_Paulo';b:=((coalesce(nullif(e->>'end_date',''),e->>'date'))::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo';
 ELSE IF nullif(e->>'start_time','') IS NULL OR nullif(e->>'end_time','') IS NULL THEN RETURN NULL;END IF;
 a:=((e->>'date')::date+(e->>'start_time')::time) AT TIME ZONE 'America/Sao_Paulo';b:=(coalesce(nullif(e->>'end_date',''),e->>'date')::date+(e->>'end_time')::time) AT TIME ZONE 'America/Sao_Paulo';END IF;
 IF b<=a THEN RAISE EXCEPTION 'O término deve ocorrer após o início.' USING errcode='23514';END IF;RETURN tstzrange(a,b,'[)');END $$;
CREATE FUNCTION iasdpi_schedule_private.event_dates(p_data jsonb,p_until date) RETURNS date[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ DECLARE first_day date:=(p_data->>'date')::date;last_day date;d date;out date[]:='{}';freq text:=coalesce(p_data->>'recurrence','none');weekday integer;ordinal integer;span integer;BEGIN
 span:=coalesce(nullif(p_data->>'end_date','')::date,first_day)-first_day;
 IF first_day IS NULL OR span<0 OR span>366 OR freq NOT IN('none','weekly','monthly') THEN RAISE EXCEPTION 'Datas ou recorrência inválidas.';END IF;
 IF freq='none' THEN RETURN ARRAY[first_day];END IF;
 IF first_day>p_until OR first_day+span>p_until THEN RAISE EXCEPTION 'A data inicial/final ultrapassa o limite da recorrência: %.',to_char(p_until,'DD/MM/YYYY');END IF;
 weekday:=coalesce((p_data->>'recurrence_weekday')::integer,extract(dow FROM first_day)::integer);ordinal:=coalesce((p_data->>'recurrence_ordinal')::integer,1);
 IF weekday NOT BETWEEN 0 AND 6 OR ordinal NOT IN(-1,1,2,3,4) OR p_until-first_day>7000 THEN RAISE EXCEPTION 'Revise o dia, a posição e a data inicial da recorrência.';END IF;
 FOR d IN SELECT generate_series(first_day::timestamp,(p_until-span)::timestamp,'1 day')::date LOOP
 last_day:=(date_trunc('month',d::timestamp)+interval '1 month - 1 day')::date;
 IF extract(dow FROM d)=weekday AND (freq='weekly' OR ordinal=-1 AND d+7>last_day OR ordinal>0 AND ((extract(day FROM d)::integer-1)/7+1)=ordinal) THEN out:=array_append(out,d);END IF;
 END LOOP;
 IF cardinality(out)=0 OR cardinality(out)>1000 THEN RAISE EXCEPTION 'Nenhuma ocorrência válida ou série muito extensa. Revise as datas.';END IF;RETURN out;END $$;
CREATE FUNCTION iasdpi_schedule_private.event_conflicts(e jsonb,p_exclude uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE span tstzrange:=iasdpi_schedule_private.event_interval(e);c uuid:=public.iasdpi_current_church_id();BEGIN
 IF span IS NULL THEN RETURN '[]';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('space_code',s.code,'space_name',s.name,'date',e->>'date','occupied',r.occupied::text,'other_event_id',r.event_id))
 FROM public.iasdpi_event_reservations r JOIN public.iasdpi_event_spaces s ON s.church_id=r.church_id AND s.code=r.space_code
 WHERE r.church_id=c AND s.exclusive AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]'))) AND NOT r.event_id=ANY(p_exclude) AND r.occupied&&span),'[]')||
 -- Textos antigos só são interpretados se corresponderem EXATAMENTE a um local conhecido. Nada é regravado.
 coalesce((WITH latest AS(SELECT DISTINCT ON(event_id) event_id,status,snapshot FROM public.iasdpi_event_versions WHERE status IN('published','cancelled') ORDER BY event_id,version DESC)
 SELECT jsonb_agg(jsonb_build_object('space_code',s.code,'space_name',s.name,'date',e->>'date','occupied',coalesce(iasdpi_schedule_private.event_interval(l.snapshot),tstzrange(((l.snapshot->>'date')::date::timestamp AT TIME ZONE 'America/Sao_Paulo'),(((l.snapshot->>'end_date')::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'),'[)'))::text,'other_event_id',v.id,'legacy',true,'time_pending',iasdpi_schedule_private.event_interval(l.snapshot) IS NULL))
 FROM latest l JOIN public.iasdpi_events v ON v.id=l.event_id JOIN public.iasdpi_event_spaces s ON s.church_id=v.church_id AND s.exclusive AND iasdpi_schedule_private.normal_name(l.snapshot->>'location')=iasdpi_schedule_private.normal_name(s.name)
 WHERE l.status='published' AND nullif(l.snapshot->'spaces','null') IS NULL AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]'))) AND NOT v.id=ANY(p_exclude)
 AND coalesce(iasdpi_schedule_private.event_interval(l.snapshot),tstzrange(((l.snapshot->>'date')::date::timestamp AT TIME ZONE 'America/Sao_Paulo'),(((l.snapshot->>'end_date')::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'),'[)'))&&span),'[]');END $$;
CREATE FUNCTION iasdpi_schedule_private.event_conflict_view(rows jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg((r-'other_event_id')||jsonb_build_object('period_label',CASE WHEN coalesce((r->>'time_pending')::boolean,false) THEN 'Horário pendente de revisão' WHEN r->>'occupied' IS NOT NULL THEN to_char(lower((r->>'occupied')::tstzrange) AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||' → '||to_char(upper((r->>'occupied')::tstzrange) AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ELSE 'Horário não informado' END,'event_title',CASE WHEN e.id IS NULL THEN 'Outra ocorrência desta série' WHEN iasdpi_schedule_private.event_can(auth.uid(),e.category,e.department_id,'view') THEN e.title WHEN NOT e.is_restricted AND pub.status='published' AND NOT coalesce((pub.snapshot->>'is_restricted')::boolean,false) AND NOT EXISTS(SELECT 1 FROM public.iasdpi_event_series es WHERE es.id=e.series_id AND es.approval_status IN('pending','rejected')) THEN pub.snapshot->>'title' ELSE 'Evento restrito' END)), '[]')
 FROM jsonb_array_elements(rows) r LEFT JOIN public.iasdpi_events e ON e.id=(r->>'other_event_id')::uuid LEFT JOIN LATERAL(SELECT status,snapshot FROM public.iasdpi_event_versions v WHERE v.event_id=e.id AND v.status IN('published','cancelled') ORDER BY version DESC LIMIT 1) pub ON true;
$$;
CREATE FUNCTION public.iasdpi_event_preview(p_data jsonb,p_exclude uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();d date;days date[];e jsonb;out jsonb:='[]';conflicts jsonb;until_day date:=(date_trunc('year',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 year - 1 day')::date;BEGIN
 IF p_exclude IS NULL THEN p_exclude:='{}';END IF;
 until_day:=least(until_day,coalesce(nullif(p_data->>'recurrence_until','')::date,until_day));
 IF NOT coalesce(iasdpi_schedule_private.event_can(u,p_data->>'category',(p_data->>'department_id')::uuid,'edit'),false) THEN RAISE EXCEPTION 'Sem permissão para cadastrar neste departamento.' USING errcode='42501';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_exclude) x WHERE NOT EXISTS(SELECT 1 FROM public.iasdpi_events v WHERE v.id=x AND iasdpi_schedule_private.event_can(u,v.category,v.department_id,'edit'))) THEN RAISE EXCEPTION 'Exclusão de validação não autorizada.' USING errcode='42501';END IF;
 IF nullif(p_data->'spaces','null') IS NOT NULL AND (jsonb_typeof(p_data->'spaces')<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'spaces') x WHERE NOT EXISTS(SELECT 1 FROM public.iasdpi_event_spaces s WHERE s.code=x))) THEN RAISE EXCEPTION 'Local inválido.';END IF;
 days:=iasdpi_schedule_private.event_dates(p_data,until_day);
 FOREACH d IN ARRAY days LOOP
 IF nullif(p_data->>'preview_from','') IS NOT NULL AND d<(p_data->>'preview_from')::date THEN CONTINUE;END IF;
 e:=p_data||jsonb_build_object('date',d,'end_date',d+(coalesce(nullif(p_data->>'end_date','')::date,(p_data->>'date')::date)-(p_data->>'date')::date));
 conflicts:=iasdpi_schedule_private.event_conflicts(e,p_exclude);
 IF EXISTS(SELECT 1 FROM public.iasdpi_event_spaces s WHERE s.exclusive AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]')))) THEN
 conflicts:=conflicts||coalesce((SELECT jsonb_agg(jsonb_build_object('space_code',s.code,'space_name',s.name,'date',d,'occupied',iasdpi_schedule_private.event_interval(prev)::text,'other_event_id',NULL)) FROM jsonb_array_elements(out) prev CROSS JOIN public.iasdpi_event_spaces s WHERE s.exclusive AND s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]'))) AND iasdpi_schedule_private.event_interval(prev)&&iasdpi_schedule_private.event_interval(e)),'[]');END IF;
 out:=out||jsonb_build_array(e||jsonb_build_object('reservation_conflicts',iasdpi_schedule_private.event_conflict_view(conflicts)));
 END LOOP;
 RETURN jsonb_build_object('until',until_day,'occurrences',out,'conflict_count',(SELECT count(*) FROM jsonb_array_elements(out) x WHERE jsonb_array_length(x->'reservation_conflicts')>0));END $$;

CREATE FUNCTION iasdpi_schedule_private.event_store(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid,p_series uuid DEFAULT NULL,p_anchor date DEFAULT NULL,p_pending boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;old public.iasdpi_events;e public.iasdpi_events;c uuid;sig text;r iasdpi_operational_private.receipts;
 result jsonb;needs_edit boolean;conflicts jsonb;period tstzrange;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_schedule_private.actor();c:=public.iasdpi_current_church_id();
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_request_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason','program_category','organizer_kind','audience','is_restricted','organizer_department_id','spaces')) THEN
 RAISE EXCEPTION 'Campos, identificador ou versão inválidos.' USING errcode='22023';END IF;
 SELECT * INTO old FROM public.iasdpi_events WHERE id=p_id FOR UPDATE;
 e:=jsonb_populate_record(NULL::public.iasdpi_events,coalesce(to_jsonb(old),'{}')||p_patch);
 needs_edit:=old.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) OR coalesce(e.status,'draft')='draft';
 IF (needs_edit AND (NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'edit'),false)))
 OR (e.status IN('published','cancelled') AND (NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'publish'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'publish'),false))) THEN
 RAISE EXCEPTION 'Sem permissão para gerir ou publicar este evento nesta igreja e departamento.' USING errcode='42501';END IF;
 sig:='events-e22-store:'||iasdpi_operational_private.fingerprint(jsonb_build_object('church',c,'id',p_id,'version',p_expected_version,'patch',p_patch));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.' USING errcode='40001';END IF;
 IF e.source_key IS NOT NULL AND (old.id IS NULL OR e.source_key IS DISTINCT FROM old.source_key) AND NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador associa eventos da fonte oficial.' USING errcode='42501';END IF;
 IF old.source_key IS NOT NULL AND (e.source_key IS DISTINCT FROM old.source_key OR e.source_url IS DISTINCT FROM old.source_url) THEN
 RAISE EXCEPTION 'A associação da fonte existente não pode ser substituída.' USING errcode='22023';END IF;
 IF e.source_key IS NOT NULL AND c<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Fonte exclusiva da IASD_PI.' USING errcode='42501';END IF;
 IF old.id IS NULL THEN
 e.approval_status:='not_required';e.reservation_conflicts:='[]';e.is_restricted:=coalesce(e.is_restricted,false);e.all_day:=coalesce(e.all_day,false);e.status:=coalesce(e.status,'draft');e.created_by:=u;e.created_at:=now();e.location:=coalesce(e.location,'');e.description:=coalesce(e.description,'');e.cancellation_reason:=coalesce(e.cancellation_reason,'');
 END IF;
 IF NOT p_patch ? 'end_date' AND (old.id IS NULL OR old.end_date=old.date) THEN e.end_date:=e.date;END IF;
 IF e.status='published' AND e.end_time IS NOT NULL AND e.start_time IS NULL THEN RAISE EXCEPTION 'Horário inicial pendente. Confirme antes de publicar.' USING errcode='23514';END IF;
 IF e.status='published' AND (e.category IS NULL OR e.category='department' AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id=e.department_id AND d.active)) THEN
 RAISE EXCEPTION 'Confirme a categoria e o departamento responsável antes de publicar.' USING errcode='23514';END IF;
 IF p_series IS NOT NULL THEN e.series_id:=p_series;e.occurrence_on:=p_anchor;END IF;
 IF e.spaces IS NOT NULL AND (cardinality(e.spaces)<>(SELECT count(DISTINCT x) FROM unnest(e.spaces) x) OR EXISTS(SELECT 1 FROM unnest(e.spaces) x WHERE NOT EXISTS(SELECT 1 FROM public.iasdpi_event_spaces s WHERE s.code=x))) THEN RAISE EXCEPTION 'Locais inválidos ou duplicados.';END IF;
 e.reservation_conflicts:=CASE WHEN e.status='cancelled' THEN '[]'::jsonb ELSE iasdpi_schedule_private.event_conflicts(to_jsonb(e),ARRAY[p_id]) END;
 IF jsonb_array_length(e.reservation_conflicts)>0 AND NOT p_pending THEN RAISE EXCEPTION 'Reserva em conflito: %',iasdpi_schedule_private.event_conflict_view(e.reservation_conflicts)::text USING errcode='23P01';END IF;
 e.approval_status:=coalesce(old.approval_status,'not_required');
 IF old.id IS NULL OR e.program_category IS DISTINCT FROM old.program_category THEN e.approval_status:=CASE WHEN e.program_category='general' THEN 'pending' ELSE 'not_required' END;END IF;
 IF old.approval_status IN('pending','rejected') THEN e.approval_status:=old.approval_status;END IF;
 IF p_pending OR e.program_category='general' AND EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) THEN e.approval_status:='pending';END IF;
 IF e.approval_status IN('pending','rejected') AND e.status='published' THEN e.status:='draft';END IF;
 period:=iasdpi_schedule_private.event_interval(to_jsonb(e));
 IF e.status='published' AND period IS NULL AND EXISTS(SELECT 1 FROM public.iasdpi_event_spaces s WHERE s.exclusive AND s.code=ANY(e.spaces)) THEN RAISE EXCEPTION 'Informe início e término ou marque Dia inteiro para confirmar a reserva exclusiva.' USING errcode='23514';END IF;
 IF e.status='published' AND e.program_category IS NULL AND coalesce(old.status,'draft')<>'published' THEN RAISE EXCEPTION 'Confirme o Público-alvo antes de publicar.';END IF;
 e.id:=p_id;e.church_id:=c;e.version:=coalesce(old.version,0)+1;e.updated_by:=u;e.updated_at:=now();
 IF old.id IS NULL THEN INSERT INTO public.iasdpi_events SELECT e.*;
 ELSE UPDATE public.iasdpi_events SET title=e.title,date=e.date,end_date=e.end_date,all_day=e.all_day,start_time=e.start_time,end_time=e.end_time,
 spaces=e.spaces,approval_status=e.approval_status,series_id=e.series_id,occurrence_on=e.occurrence_on,reservation_conflicts=e.reservation_conflicts,program_category=e.program_category,organizer_kind=e.organizer_kind,audience=e.audience,is_restricted=e.is_restricted,organizer_department_id=e.organizer_department_id,location=e.location,description=e.description,category=e.category,department_id=e.department_id,status=e.status,source_key=e.source_key,source_url=e.source_url,
 cancellation_reason=e.cancellation_reason,version=e.version,updated_by=u,updated_at=e.updated_at WHERE id=p_id;END IF;
 IF e.status IN('published','cancelled') THEN
 DELETE FROM public.iasdpi_event_reservations WHERE event_id=p_id;
 IF e.status='published' AND period IS NOT NULL THEN INSERT INTO public.iasdpi_event_reservations SELECT c,p_id,s.code,period FROM public.iasdpi_event_spaces s WHERE s.exclusive AND s.code=ANY(e.spaces);END IF;END IF;
 INSERT INTO public.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(c,p_id,e.version,u,e.status,to_jsonb(e));
 result:=to_jsonb(e);INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;


ALTER FUNCTION public.iasdpi_event_save(uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_event_save(uuid,bigint,jsonb,uuid) RENAME TO event_save_021;
CREATE FUNCTION public.iasdpi_event_submit(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid,p_accept_conflicts boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor();e public.iasdpi_events;candidate jsonb;conflicts jsonb;result jsonb;signature text;r iasdpi_operational_private.receipts;parent public.iasdpi_event_series;BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 SELECT * INTO e FROM public.iasdpi_events WHERE id=p_id FOR UPDATE;candidate:=coalesce(to_jsonb(e),'{}')||p_patch;
 IF NOT coalesce(iasdpi_schedule_private.event_can(u,candidate->>'category',(candidate->>'department_id')::uuid,'edit'),false) OR e.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR p_patch->>'status' IN('published','cancelled') AND NOT coalesce(iasdpi_schedule_private.event_can(u,candidate->>'category',(candidate->>'department_id')::uuid,'publish'),false) THEN RAISE EXCEPTION 'Sem permissão para salvar/publicar o evento.' USING errcode='42501';END IF;
 signature:='event-submit-022:'||iasdpi_operational_private.fingerprint(jsonb_build_array(public.iasdpi_current_church_id(),p_id,p_expected_version,p_patch,p_accept_conflicts));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.';END IF;RETURN r.response;END IF;
 IF coalesce(e.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare.' USING errcode='40001';END IF;
 conflicts:=CASE WHEN p_patch->>'status'='cancelled' THEN '[]'::jsonb ELSE iasdpi_schedule_private.event_conflicts(candidate,ARRAY[p_id]) END;
 IF jsonb_array_length(conflicts)>0 AND e.series_id IS NOT NULL AND NOT coalesce(p_accept_conflicts,false) THEN RETURN jsonb_build_object('requires_confirmation',true,'conflicts',iasdpi_schedule_private.event_conflict_view(conflicts));END IF;
 result:=iasdpi_schedule_private.event_store(p_id,p_expected_version,p_patch,gen_random_uuid(),NULL,NULL,e.series_id IS NOT NULL AND jsonb_array_length(conflicts)>0);
 IF e.series_id IS NOT NULL THEN
 UPDATE public.iasdpi_event_series SET version=version+1,updated_by=u,updated_at=now(),approval_status=CASE WHEN result->>'approval_status'='pending' THEN 'pending' ELSE approval_status END WHERE id=e.series_id RETURNING * INTO parent;
 INSERT INTO public.iasdpi_event_series_versions VALUES(parent.church_id,parent.id,parent.version,u,now(),to_jsonb(parent));END IF;
 result:=jsonb_build_object('event',result||jsonb_build_object('reservation_conflicts',iasdpi_schedule_private.event_conflict_view(result->'reservation_conflicts')),'requires_confirmation',false);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,signature,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_event_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 result:=public.iasdpi_event_submit(p_id,p_expected_version,p_patch,p_request_id,false);
 IF coalesce((result->>'requires_confirmation')::boolean,false) THEN RAISE EXCEPTION 'Esta ocorrência possui conflitos; revise e envie para aprovação na nova interface.';END IF;RETURN result->'event';END $$;

CREATE FUNCTION public.iasdpi_event_series_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid,p_scope text DEFAULT 'all',p_occurrence uuid DEFAULT NULL,p_accept_conflicts boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor();c uuid:=public.iasdpi_current_church_id();old public.iasdpi_event_series;series public.iasdpi_event_series;selected public.iasdpi_events;row public.iasdpi_events;
 definition jsonb;plan jsonb;item jsonb;patch jsonb;result jsonb;records jsonb:='[]';days date[];excluded uuid[];cutoff date;until_day date;pending boolean;signature text;r iasdpi_operational_private.receipts;BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_scope IS NULL OR p_scope NOT IN('all','following') OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','program_category','organizer_kind','organizer_department_id','is_restricted','spaces','recurrence','recurrence_weekday','recurrence_ordinal')) THEN RAISE EXCEPTION 'Dados ou abrangência da série inválidos.';END IF;
 SELECT * INTO old FROM public.iasdpi_event_series WHERE id=p_id FOR UPDATE;
 definition:=coalesce(old.definition,'{}')||p_patch;definition:=definition||jsonb_build_object('status',coalesce(definition->>'status','draft'));
 IF NOT coalesce(iasdpi_schedule_private.event_can(u,definition->>'category',(definition->>'department_id')::uuid,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'edit'),false)
 OR definition->>'status' IN('published','cancelled') AND (NOT coalesce(iasdpi_schedule_private.event_can(u,definition->>'category',(definition->>'department_id')::uuid,'publish'),false) OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'publish'),false)) THEN RAISE EXCEPTION 'Sem permissão para editar/publicar esta série.' USING errcode='42501';END IF;
 signature:='event-series-022:'||iasdpi_operational_private.fingerprint(jsonb_build_array(c,p_id,p_expected_version,p_patch,p_scope,p_occurrence,p_accept_conflicts));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'A série foi alterada em outro dispositivo. Recarregue e compare.' USING errcode='40001';END IF;
 IF old.id IS NULL AND p_scope<>'all' OR definition->>'recurrence' IS NULL OR definition->>'recurrence' NOT IN('weekly','monthly') OR definition->>'status' NOT IN('draft','published','cancelled') THEN RAISE EXCEPTION 'Recorrência/status inválido.';END IF;
 IF p_scope='following' THEN SELECT * INTO selected FROM public.iasdpi_events WHERE id=p_occurrence AND series_id=p_id;
 IF selected.id IS NULL THEN RAISE EXCEPTION 'Ocorrência não pertence à série.';END IF;cutoff:=selected.occurrence_on;END IF;
 until_day:=coalesce(old.until_date,(date_trunc('year',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 year - 1 day')::date);
 days:=iasdpi_schedule_private.event_dates(definition,until_day);
 SELECT coalesce(array_agg(id),'{}') INTO excluded FROM public.iasdpi_events WHERE series_id=p_id AND (cutoff IS NULL OR occurrence_on>=cutoff);
 -- Prévia e gravação ficam sob o MESMO bloqueio transacional. A consulta prévia não autoriza a escrita.
 plan:=public.iasdpi_event_preview(definition||jsonb_build_object('preview_from',cutoff,'recurrence_until',until_day),excluded);
 IF (plan->>'conflict_count')::integer>0 AND NOT coalesce(p_accept_conflicts,false) AND definition->>'status'<>'cancelled' THEN
 RETURN plan||jsonb_build_object('requires_confirmation',true);END IF;
 pending:=coalesce(definition->>'program_category'='general',false) OR (plan->>'conflict_count')::integer>0 OR coalesce(old.approval_status IN('pending','rejected'),false);
 INSERT INTO public.iasdpi_event_series(id,church_id,definition,until_date,version,approval_status,category,department_id,created_by,updated_by)
 VALUES(p_id,c,definition,until_day,1,CASE WHEN pending THEN 'pending' ELSE 'not_required' END,definition->>'category',(definition->>'department_id')::uuid,u,u)
 ON CONFLICT(id) DO UPDATE SET definition=excluded.definition,version=iasdpi_event_series.version+1,approval_status=excluded.approval_status,category=excluded.category,department_id=excluded.department_id,updated_by=u,updated_at=now() RETURNING * INTO series;
 FOR row IN SELECT * FROM public.iasdpi_events WHERE series_id=p_id AND (cutoff IS NULL OR occurrence_on>=cutoff) AND NOT occurrence_on=ANY(days) LOOP
 PERFORM iasdpi_schedule_private.event_store(row.id,row.version,'{"status":"cancelled","cancellation_reason":"Alteração explícita da recorrência; identidade/histórico preservados."}',gen_random_uuid(),NULL,NULL,true);END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(plan->'occurrences') LOOP
 IF cutoff IS NOT NULL AND (item->>'date')::date<cutoff THEN CONTINUE;END IF;
 SELECT * INTO row FROM public.iasdpi_events WHERE series_id=p_id AND occurrence_on=(item->>'date')::date;
 patch:=item-ARRAY['recurrence','recurrence_weekday','recurrence_ordinal','reservation_conflicts','preview_from','recurrence_until'];
 result:=iasdpi_schedule_private.event_store(coalesce(row.id,gen_random_uuid()),coalesce(row.version,0),patch,gen_random_uuid(),p_id,(item->>'date')::date,pending);
 records:=records||jsonb_build_array(result||jsonb_build_object('reservation_conflicts',item->'reservation_conflicts'));
 END LOOP;
 INSERT INTO public.iasdpi_event_series_versions VALUES(c,series.id,series.version,u,now(),to_jsonb(series)||jsonb_build_object('scope',p_scope,'occurrence_id',p_occurrence));
 result:=jsonb_build_object('series',to_jsonb(series),'events',records,'conflict_count',plan->'conflict_count','requires_confirmation',false);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,signature,result,now());RETURN result;
END $$;

ALTER FUNCTION public.iasdpi_events_catalog() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_events_catalog() RENAME TO events_catalog_021;
CREATE FUNCTION public.iasdpi_events_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb:=iasdpi_schedule_private.events_catalog_021();u uuid:=iasdpi_schedule_private.actor();BEGIN
 RETURN c||jsonb_build_object('event_management_v2',true,
 'events',coalesce((SELECT jsonb_agg(e||jsonb_build_object('reservation_conflicts',iasdpi_schedule_private.event_conflict_view(e->'reservation_conflicts'))) FROM jsonb_array_elements(c->'events') e),'[]'),
 'spaces',coalesce((SELECT jsonb_agg(to_jsonb(s)-'church_id' ORDER BY code) FROM public.iasdpi_event_spaces s),'[]'),
 'organizer_options',jsonb_build_array(jsonb_build_object('value','local_church','label','Igreja Local'),jsonb_build_object('value','association','label','Associação / Missão'),jsonb_build_object('value','school','label','Escola Adventista'),jsonb_build_object('value','other','label','Outros'))||coalesce((SELECT jsonb_agg(jsonb_build_object('value','department:'||(d->>'id'),'label',d->>'name')) FROM jsonb_array_elements(c->'departments') d),'[]'),
 'series',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.iasdpi_event_series s WHERE iasdpi_schedule_private.event_can(u,s.category,s.department_id,'view')),'[]'));
END $$;
ALTER FUNCTION public.iasdpi_event_history(uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_event_history(uuid) RENAME TO event_history_021;
CREATE FUNCTION public.iasdpi_event_history(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(v||jsonb_build_object('snapshot',(v->'snapshot')||jsonb_build_object('reservation_conflicts',iasdpi_schedule_private.event_conflict_view(coalesce(v->'snapshot'->'reservation_conflicts','[]'))))),'[]') FROM jsonb_array_elements(iasdpi_schedule_private.event_history_021(p_id)) v; $$;
ALTER FUNCTION iasdpi_schedule_private.calendar_events_feed(date,boolean) RENAME TO calendar_events_feed_021;
CREATE FUNCTION iasdpi_schedule_private.calendar_events_feed(p_month date,p_private boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE r jsonb:=iasdpi_schedule_private.calendar_events_feed_021(p_month,p_private);BEGIN
 RETURN r||jsonb_build_object('events',coalesce((SELECT jsonb_agg((e-ARRAY['reservation_conflicts'])||jsonb_build_object('space_names',coalesce((SELECT jsonb_agg(s.name ORDER BY s.code) FROM public.iasdpi_event_spaces s WHERE s.code IN(SELECT jsonb_array_elements_text(coalesce(nullif(e->'spaces','null'),'[]')))),'[]'))) FROM jsonb_array_elements(r->'events') e
 WHERE coalesce(e->>'approval_status','legacy') NOT IN('pending','rejected') AND NOT EXISTS(SELECT 1 FROM public.iasdpi_event_series s WHERE s.id=(e->>'series_id')::uuid AND s.approval_status IN('pending','rejected'))),'[]'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_event_submit','iasdpi_event_save','iasdpi_event_preview','iasdpi_event_series_save','iasdpi_events_catalog','iasdpi_event_history') OR
 n.nspname='iasdpi_schedule_private' AND p.proname IN('event_space_key','event_interval','event_dates','event_conflicts','event_conflict_view','event_store','event_save_021','events_catalog_021','event_history_021','calendar_events_feed','calendar_events_feed_021') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
