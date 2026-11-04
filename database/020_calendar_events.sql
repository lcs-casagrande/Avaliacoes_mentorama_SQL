-- E1: eventos editoriais. Revisar após 001–019; não importa nem modifica dados existentes.
-- schedule_events continua representando eventos técnicos de participação nas escalas.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_schedule_private.person_aliases') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='iasdpi_church_executor') THEN
 RAISE EXCEPTION 'Exige postgres e a cadeia 001–019 completa.';END IF;
 IF to_regclass('public.iasdpi_events') IS NOT NULL THEN RAISE EXCEPTION '020 já instalada; não sobrescrever.';END IF;
END $$;

CREATE TABLE public.iasdpi_events(
 id uuid PRIMARY KEY,church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 160),
 date date NOT NULL,end_date date NOT NULL CHECK(end_date>=date AND end_date<=date+366),
 all_day boolean NOT NULL DEFAULT false,
 start_time time,end_time time,CHECK(NOT all_day OR start_time IS NULL AND end_time IS NULL),CHECK(status<>'published' OR end_time IS NULL OR start_time IS NOT NULL),
 CHECK(end_date>date OR end_time IS NULL OR end_time>start_time),
 location text NOT NULL DEFAULT '' CHECK(length(location)<=500),description text NOT NULL DEFAULT '' CHECK(length(description)<=5000),
 category text CHECK(category IN('church','department')),department_id uuid,
 CHECK(department_id IS NULL OR category IS NOT DISTINCT FROM 'department'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','cancelled')),
 version bigint NOT NULL CHECK(version>0),source_key text CHECK(length(source_key) BETWEEN 1 AND 500),
 source_url text CHECK(source_url='https://iasd-paradainglesa.netlify.app/'),
 CHECK((source_key IS NULL)=(source_url IS NULL)),
 cancellation_reason text NOT NULL DEFAULT '' CHECK(length(cancellation_reason)<=2000),
 created_by uuid NOT NULL REFERENCES auth.users(id),updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(church_id,id),UNIQUE(church_id,source_key),
 FOREIGN KEY(church_id,department_id) REFERENCES public.schedule_departments(church_id,id)
);
CREATE INDEX iasdpi_events_period ON public.iasdpi_events(church_id,date,end_date);
CREATE INDEX iasdpi_events_department ON public.iasdpi_events(church_id,department_id,status);
CREATE UNIQUE INDEX iasdpi_events_identity ON public.iasdpi_events(church_id,
 iasdpi_schedule_private.normal_name(title),date,end_date,coalesce(start_time::text,''),coalesce(end_time::text,''),
 coalesce(category,''),coalesce(department_id::text,''),iasdpi_schedule_private.normal_name(location));
CREATE TABLE public.iasdpi_event_versions(
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id(),event_id uuid NOT NULL,version bigint NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),captured_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL CHECK(status IN('draft','published','cancelled')),snapshot jsonb NOT NULL,
 PRIMARY KEY(church_id,event_id,version),FOREIGN KEY(church_id,event_id) REFERENCES public.iasdpi_events(church_id,id)
);
CREATE INDEX iasdpi_event_versions_public ON public.iasdpi_event_versions(church_id,event_id,version DESC) WHERE status IN('published','cancelled');
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['iasdpi_events','iasdpi_event_versions'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('CREATE POLICY church_boundary ON public.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON public.%I FOR ALL TO iasdpi_church_executor USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON public.iasdpi_events TO iasdpi_church_executor;
GRANT SELECT,INSERT ON public.iasdpi_event_versions TO iasdpi_church_executor;

CREATE FUNCTION iasdpi_schedule_private.event_can(u uuid,category text,department uuid,cap text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR (category='department' AND department IS NOT NULL
 AND iasdpi_schedule_private.has_capability(u,department,cap));
$$;
CREATE FUNCTION public.iasdpi_events_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 RETURN jsonb_build_object('is_admin',iasdpi_schedule_private.is_admin(u),'departments',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',d.id,'name',d.name,'code',d.code,'can_edit',iasdpi_schedule_private.has_capability(u,d.id,'edit'),
 'can_publish',iasdpi_schedule_private.has_capability(u,d.id,'publish')) ORDER BY d.name)
 FROM public.schedule_departments d WHERE d.active AND (iasdpi_schedule_private.is_admin(u) OR iasdpi_schedule_private.can_view(u,d.id))),'[]'),
 'events',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('can_edit',iasdpi_schedule_private.event_can(u,e.category,e.department_id,'edit'),
 'can_publish',iasdpi_schedule_private.event_can(u,e.category,e.department_id,'publish')) ORDER BY e.date,e.title)
 FROM public.iasdpi_events e WHERE iasdpi_schedule_private.is_admin(u) OR e.category='department' AND iasdpi_schedule_private.can_view(u,e.department_id)),'[]'));
END $$;

CREATE FUNCTION public.iasdpi_event_save(p_id uuid,p_expected_version bigint,p_patch jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;old public.iasdpi_events;e public.iasdpi_events;c uuid;sig text;r iasdpi_operational_private.receipts;
 result jsonb;needs_edit boolean;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_schedule_private.actor();c:=public.iasdpi_current_church_id();
 IF p_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_request_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('title','date','end_date','all_day','start_time','end_time','location','description','category','department_id','status','source_key','source_url','cancellation_reason')) THEN
 RAISE EXCEPTION 'Campos, identificador ou versão inválidos.' USING errcode='22023';END IF;
 SELECT * INTO old FROM public.iasdpi_events WHERE id=p_id FOR UPDATE;
 e:=jsonb_populate_record(NULL::public.iasdpi_events,coalesce(to_jsonb(old),'{}')||p_patch);
 needs_edit:=old.id IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('status','cancellation_reason')) OR coalesce(e.status,'draft')='draft';
 IF (needs_edit AND (NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'edit'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'edit'),false)))
 OR (e.status IN('published','cancelled') AND (NOT coalesce(iasdpi_schedule_private.event_can(u,e.category,e.department_id,'publish'),false)
 OR old.id IS NOT NULL AND NOT coalesce(iasdpi_schedule_private.event_can(u,old.category,old.department_id,'publish'),false))) THEN
 RAISE EXCEPTION 'Sem permissão para gerir ou publicar este evento nesta igreja e departamento.' USING errcode='42501';END IF;
 sig:='events-e1:'||iasdpi_operational_private.fingerprint(jsonb_build_object('church',c,'id',p_id,'version',p_expected_version,'patch',p_patch));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Evento alterado em outro dispositivo. Recarregue e compare; suas alterações não foram salvas.' USING errcode='40001';END IF;
 IF e.source_key IS NOT NULL AND (old.id IS NULL OR e.source_key IS DISTINCT FROM old.source_key) AND NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador associa eventos da fonte oficial.' USING errcode='42501';END IF;
 IF old.source_key IS NOT NULL AND (e.source_key IS DISTINCT FROM old.source_key OR e.source_url IS DISTINCT FROM old.source_url) THEN
 RAISE EXCEPTION 'A associação da fonte existente não pode ser substituída.' USING errcode='22023';END IF;
 IF e.source_key IS NOT NULL AND c<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Fonte exclusiva da IASD_PI.' USING errcode='42501';END IF;
 IF old.id IS NULL THEN
 e.all_day:=coalesce(e.all_day,false);e.status:=coalesce(e.status,'draft');e.created_by:=u;e.created_at:=now();e.location:=coalesce(e.location,'');e.description:=coalesce(e.description,'');e.cancellation_reason:=coalesce(e.cancellation_reason,'');
 END IF;
 IF NOT p_patch ? 'end_date' AND (old.id IS NULL OR old.end_date=old.date) THEN e.end_date:=e.date;END IF;
 IF e.status='published' AND e.end_time IS NOT NULL AND e.start_time IS NULL THEN RAISE EXCEPTION 'Horário inicial pendente. Confirme antes de publicar.' USING errcode='23514';END IF;
 IF e.status='published' AND (e.category IS NULL OR e.category='department' AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id=e.department_id AND d.active)) THEN
 RAISE EXCEPTION 'Confirme a categoria e o departamento responsável antes de publicar.' USING errcode='23514';END IF;
 e.id:=p_id;e.church_id:=c;e.version:=coalesce(old.version,0)+1;e.updated_by:=u;e.updated_at:=now();
 IF old.id IS NULL THEN INSERT INTO public.iasdpi_events SELECT e.*;
 ELSE UPDATE public.iasdpi_events SET title=e.title,date=e.date,end_date=e.end_date,all_day=e.all_day,start_time=e.start_time,end_time=e.end_time,
 location=e.location,description=e.description,category=e.category,department_id=e.department_id,status=e.status,source_key=e.source_key,source_url=e.source_url,
 cancellation_reason=e.cancellation_reason,version=e.version,updated_by=u,updated_at=e.updated_at WHERE id=p_id;END IF;
 INSERT INTO public.iasdpi_event_versions(church_id,event_id,version,actor_id,status,snapshot) VALUES(c,p_id,e.version,u,e.status,to_jsonb(e));
 result:=to_jsonb(e);INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;

CREATE FUNCTION public.iasdpi_event_history(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();e public.iasdpi_events;BEGIN
 SELECT * INTO e FROM public.iasdpi_events WHERE id=p_id;
 IF e.id IS NULL OR NOT (iasdpi_schedule_private.is_admin(u) OR e.category='department' AND iasdpi_schedule_private.can_view(u,e.department_id)) THEN
 RAISE EXCEPTION 'Histórico indisponível para esta identidade.' USING errcode='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY version DESC) FROM public.iasdpi_event_versions v WHERE event_id=p_id),'[]');
END $$;
CREATE FUNCTION public.iasdpi_events_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF p_month IS NULL OR extract(day FROM p_month)<>1 THEN RAISE EXCEPTION 'Informe o primeiro dia do mês.' USING errcode='22023';END IF;
 -- A ponte existente valida igreja ativa/listada sem conceder SELECT direto na tabela.
 PERFORM public.iasdpi_current_church_id();
 RETURN (WITH latest AS(SELECT DISTINCT ON(event_id) event_id,status,snapshot FROM public.iasdpi_event_versions WHERE status IN('published','cancelled') ORDER BY event_id,version DESC)
 SELECT jsonb_build_object('events',coalesce((SELECT jsonb_agg((l.snapshot-'created_by'-'updated_by'-'cancellation_reason')||jsonb_build_object('department_name',d.name) ORDER BY l.snapshot->>'date',l.snapshot->>'title')
 FROM latest l LEFT JOIN public.schedule_departments d ON d.id=(l.snapshot->>'department_id')::uuid WHERE l.status='published'
 AND (l.snapshot->>'date')::date < (p_month+interval '1 month')::date AND (l.snapshot->>'end_date')::date>=p_month),'[]'),
 'suppressed_source_keys',coalesce((SELECT jsonb_agg(DISTINCT snapshot->>'source_key') FROM latest WHERE snapshot->>'source_key' IS NOT NULL),'[]')));
END $$;

GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 n.nspname='public' AND p.proname IN('iasdpi_events_catalog','iasdpi_event_save','iasdpi_event_history','iasdpi_events_published') OR n.nspname='iasdpi_schedule_private' AND p.proname='event_can' LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.iasdpi_events_published(date) TO anon;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
