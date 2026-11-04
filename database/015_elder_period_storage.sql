-- G5: Ancionato semanal/mensal. Revisar e executar após 001–014, como postgres.
-- Não importa referências, não cria pessoas e não altera atribuições existentes.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_portal_context()') IS NULL
 OR to_regprocedure('public.iasdpi_schedule_published(date)') IS NULL THEN
 RAISE EXCEPTION 'Exige postgres e migrações 001–014 completas.';END IF;
 IF to_regclass('public.schedule_elder_periods') IS NOT NULL THEN RAISE EXCEPTION '015 já instalada; revisar sem sobrescrever.';END IF;
END $$;
CREATE TABLE public.schedule_elder_periods (
 id uuid PRIMARY KEY,
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 department_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('weekly','monthly')),
 starts_on date NOT NULL CHECK(starts_on BETWEEN date '1000-01-01' AND date '9998-12-31'),ends_on date NOT NULL,
 person_id uuid,status text NOT NULL CHECK(status IN ('draft','published')),version bigint NOT NULL CHECK(version>0),
 created_by uuid NOT NULL REFERENCES auth.users(id),updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='weekly' AND extract(dow FROM starts_on)=0 AND ends_on=starts_on+6)
 OR (kind='monthly' AND extract(day FROM starts_on)=1 AND ends_on=(starts_on+interval '1 month - 1 day')::date)),
 CHECK(status<>'published' OR person_id IS NOT NULL),
 FOREIGN KEY(church_id,department_id) REFERENCES public.schedule_departments(church_id,id),
 FOREIGN KEY(church_id,person_id) REFERENCES public.schedule_people(church_id,id),
 UNIQUE(church_id,department_id,kind,starts_on),UNIQUE(church_id,id)
);
CREATE INDEX schedule_elder_range ON public.schedule_elder_periods(church_id,department_id,starts_on,ends_on);
CREATE TABLE public.schedule_elder_versions (
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 period_id uuid NOT NULL,version bigint NOT NULL CHECK(version>0),
 actor_id uuid NOT NULL REFERENCES auth.users(id),captured_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb NOT NULL,
 PRIMARY KEY(church_id,period_id,version),FOREIGN KEY(church_id,period_id) REFERENCES public.schedule_elder_periods(church_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_elder_periods','schedule_elder_versions'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT,INSERT%s ON public.%I TO iasdpi_church_executor',CASE WHEN t='schedule_elder_periods' THEN ',UPDATE' ELSE '' END,t);
 EXECUTE format('CREATE POLICY church_boundary ON public.%I AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 EXECUTE format('CREATE POLICY church_executor ON public.%I FOR ALL TO iasdpi_church_executor USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id())',t);
 EXECUTE format('CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON public.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church()',t);
 END LOOP;
END $$;
-- Identidade determinística dos períodos virtuais: consulta não grava dados.
CREATE FUNCTION iasdpi_schedule_private.elder_id(d uuid,k text,s date) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(public.iasdpi_current_church_id()::text||':'||d::text||':'||k||':'||to_char(s,'YYYY-MM-DD'))::uuid;
$$;
CREATE VIEW iasdpi_schedule_private.published_elder_periods WITH(security_invoker=true) AS
 SELECT p.id,p.church_id,p.department_id,p.kind,p.starts_on,p.ends_on,v.version,v.captured_at,
 (v.snapshot->>'person_id')::uuid person_id
 FROM public.schedule_elder_periods p CROSS JOIN LATERAL (
 SELECT x.version,x.captured_at,x.snapshot FROM public.schedule_elder_versions x
 WHERE x.church_id=p.church_id AND x.period_id=p.id AND x.snapshot->>'status'='published'
 ORDER BY x.version DESC LIMIT 1) v;
-- Mantém a versão publicada como compromisso mesmo durante uma revisão em rascunho.
CREATE OR REPLACE VIEW iasdpi_schedule_private.confirmed_days WITH(security_invoker=true) AS
 SELECT a.person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM public.schedule_assignments a
 JOIN public.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) d(day)
 UNION ALL SELECT person_id,department_id,scheduled_on,NULL::uuid,NULL::uuid FROM public.schedule_legacy_commitments
 -- Uma revisão diária privada também não apaga o compromisso ainda público.
 UNION ALL SELECT a.person_id,p.department_id,day,p.id,a.id FROM public.schedule_plans p
 CROSS JOIN LATERAL (SELECT v.snapshot FROM public.schedule_versions v WHERE v.plan_id=p.id AND v.snapshot->>'status'='published' ORDER BY v.version DESC LIMIT 1) v
 CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'requirements') req
 CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') entry
 CROSS JOIN LATERAL jsonb_populate_record(NULL::public.schedule_assignments,entry||jsonb_build_object('timing_mode',coalesce(entry->>'timing_mode','timed'))) a
 CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) day
 WHERE p.status='draft'
 UNION ALL SELECT p.person_id,p.department_id,d.day::date,NULL::uuid,p.id
 FROM iasdpi_schedule_private.published_elder_periods p
 CROSS JOIN LATERAL generate_series(p.starts_on::timestamp,p.ends_on::timestamp,interval '1 day') d(day) WHERE p.kind='weekly';
CREATE FUNCTION iasdpi_schedule_private.elder_validate(d uuid,k text,s date,e date,p uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE other record; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=d AND code='ancionato' AND active)
 OR (p IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.schedule_people person JOIN public.schedule_memberships m ON m.person_id=person.id
 WHERE person.id=p AND person.active AND m.department_id=d AND m.active)) THEN
 RAISE EXCEPTION 'Pessoa inativa, sem vínculo ativo no Ancionato ou departamento indisponível.' USING errcode='23514';END IF;
 -- O vínculo ativo é a elegibilidade usada nesta modalidade; não cria habilitações.
 -- Disponibilidade e limites permanecem preferências; mensal não reserva dias.
 IF k='weekly' AND p IS NOT NULL THEN
 FOR other IN SELECT DISTINCT c.department_id,c.day FROM iasdpi_schedule_private.confirmed_days c
 WHERE c.person_id=p AND c.department_id<>d AND c.day BETWEEN s AND e LOOP
 IF NOT iasdpi_schedule_private.has_day_exception(p,other.day,d,other.department_id) THEN
 RAISE EXCEPTION 'Conflito com outro departamento em %; exige exceção administrativa justificada.',to_char(other.day,'DD/MM/YYYY') USING errcode='23P01';END IF;
 END LOOP;END IF;
END $$;
CREATE FUNCTION public.iasdpi_schedule_elder_workspace(p_department uuid,p_month date,p_year integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor();first_day date;last_day date;result jsonb; BEGIN
 IF NOT iasdpi_schedule_private.can_view(u,p_department) OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=p_department AND code='ancionato' AND active) THEN
 RAISE EXCEPTION 'Sem consulta autorizada ao Ancionato desta igreja.' USING errcode='42501';END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1000-02-01' OR p_month>'9998-11-01'
 OR (p_year IS NOT NULL AND (p_year<1000 OR p_year>9998)) THEN RAISE EXCEPTION 'Mês ou ano inválido.' USING errcode='22023';END IF;
 first_day:=p_month-extract(dow FROM p_month)::integer;last_day:=(p_month+interval '1 month - 1 day')::date;
 WITH definitions AS (
 SELECT 'weekly'::text kind,day::date starts_on,day::date+6 ends_on FROM generate_series(first_day::timestamp,last_day::timestamp,interval '7 days') day
 UNION ALL SELECT 'monthly',day::date,(day+interval '1 month - 1 day')::date FROM generate_series(
 coalesce(make_date(p_year,1,1),p_month)::timestamp,coalesce(make_date(p_year,12,1),p_month)::timestamp,interval '1 month') day
 ) SELECT jsonb_agg(coalesce(to_jsonb(p),jsonb_build_object('id',iasdpi_schedule_private.elder_id(p_department,x.kind,x.starts_on),
 'department_id',p_department,'kind',x.kind,'starts_on',x.starts_on,'ends_on',x.ends_on,'person_id',NULL,'status','draft','version',0)) ORDER BY x.kind DESC,x.starts_on)
 INTO result FROM definitions x LEFT JOIN public.schedule_elder_periods p ON p.department_id=p_department AND p.kind=x.kind AND p.starts_on=x.starts_on;
 RETURN jsonb_build_object('periods',result,'availability_enabled',false,
 'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',c.person_id,'department_id',CASE WHEN c.department_id=p_department THEN p_department ELSE NULL END,'date',c.day,'status','published'))
 FROM iasdpi_schedule_private.confirmed_days c WHERE c.day BETWEEN first_day AND last_day+6
 AND (c.department_id=p_department OR NOT iasdpi_schedule_private.has_day_exception(c.person_id,c.day,p_department,c.department_id)) AND EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.department_id=p_department AND m.person_id=c.person_id AND m.active)),'[]'),
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'kind',kind,'starts_on',starts_on,'ends_on',ends_on,'person_id',person_id,'status','published','version',version) ORDER BY starts_on)
 FROM iasdpi_schedule_private.published_elder_periods WHERE department_id=p_department AND starts_on<p_month),'[]'));
END $$;
CREATE FUNCTION public.iasdpi_schedule_elder_save(p_department uuid,p_status text,p_rows jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;item jsonb;old public.schedule_elder_periods;nextrow public.schedule_elder_periods;k text;s date;e date;p uuid;v bigint;rid uuid;seen text[]:='{}';sig text;receipt iasdpi_operational_private.receipts;result jsonb:='[]';batch_kind text;BEGIN
 u:=iasdpi_schedule_private.actor();
 -- Mesmo lock das RPCs operacionais: READ COMMITTED revalida após espera;
 -- REPEATABLE READ obsoleto falha com 40001 em vez de contornar o conflito.
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_schedule_private.actor();
 IF p_status IS NULL OR p_status NOT IN ('draft','published') OR p_request_id IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 12 OR pg_column_size(p_rows)>100000 THEN RAISE EXCEPTION 'Gravação de períodos inválida.' USING errcode='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=p_department AND code='ancionato' AND active)
 OR NOT iasdpi_schedule_private.has_capability(u,p_department,'view')
 OR NOT iasdpi_schedule_private.has_capability(u,p_department,CASE WHEN p_status='published' THEN 'publish' ELSE 'edit' END) THEN
 RAISE EXCEPTION 'Sem permissão para esta ação do Ancionato nesta igreja.' USING errcode='42501';END IF;
 sig:='elder-g5:'||iasdpi_operational_private.fingerprint(jsonb_build_object('department',p_department,'status',p_status,'rows',p_rows));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023';END IF;RETURN receipt.response;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT (item ? 'person_id') OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) key WHERE NOT key=ANY(ARRAY['id','kind','starts_on','ends_on','person_id','expected_version']))
 THEN RAISE EXCEPTION 'Campos do período inválidos.' USING errcode='22023';END IF;
 k:=item->>'kind';s:=(item->>'starts_on')::date;e:=(item->>'ends_on')::date;p:=(item->>'person_id')::uuid;v:=(item->>'expected_version')::bigint;rid:=(item->>'id')::uuid;
 IF k IS NULL OR k NOT IN ('weekly','monthly') OR s IS NULL OR e IS NULL OR s<'1000-01-01' OR s>'9998-12-31' OR v IS NULL OR v<0 OR rid IS NULL
 OR (k='weekly' AND (extract(dow FROM s)<>0 OR e<>s+6)) OR (k='monthly' AND (extract(day FROM s)<>1 OR e<>(s+interval '1 month - 1 day')::date))
 OR k||':'||s::text=ANY(seen) OR (batch_kind IS NOT NULL AND batch_kind<>k) THEN RAISE EXCEPTION 'Períodos únicos e da mesma modalidade: domingo a sábado ou mês completo.' USING errcode='22023';END IF;
 batch_kind:=k;seen:=array_append(seen,k||':'||s::text);
 SELECT * INTO old FROM public.schedule_elder_periods WHERE department_id=p_department AND kind=k AND starts_on=s FOR UPDATE;
 IF rid IS DISTINCT FROM coalesce(old.id,iasdpi_schedule_private.elder_id(p_department,k,s)) OR coalesce(old.version,0)<>v THEN
 RAISE EXCEPTION 'Esta escala mudou em outra edição. Recarregue e compare antes de salvar.' USING errcode='40001';END IF;
 IF (old.person_id IS DISTINCT FROM p OR old.id IS NULL OR p_status='draft') AND NOT iasdpi_schedule_private.has_capability(u,p_department,'edit') THEN RAISE EXCEPTION 'Sem permissão para editar o Ancionato.' USING errcode='42501';END IF;
 IF old.status='published' AND NOT iasdpi_schedule_private.has_capability(u,p_department,'publish') THEN RAISE EXCEPTION 'Sem permissão para revisar escala publicada.' USING errcode='42501';END IF;
 IF p_status='published' AND p IS NULL THEN RAISE EXCEPTION 'Publicação bloqueada: há períodos sem ancião.' USING errcode='23514';END IF;
 PERFORM iasdpi_schedule_private.elder_validate(p_department,k,s,e,p);
 INSERT INTO public.schedule_elder_periods(id,department_id,kind,starts_on,ends_on,person_id,status,version,created_by,updated_by)
 VALUES(rid,p_department,k,s,e,p,p_status,v+1,u,u)
 ON CONFLICT(id) DO UPDATE SET person_id=excluded.person_id,status=excluded.status,version=excluded.version,updated_by=u,updated_at=now()
 RETURNING * INTO nextrow;
 INSERT INTO public.schedule_elder_versions(period_id,version,actor_id,snapshot) VALUES(rid,nextrow.version,u,to_jsonb(nextrow));
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields)
 VALUES(u,'elder-'||k,rid,p_department,nextrow.version,ARRAY['person_id','status']);
 result:=result||jsonb_build_array(to_jsonb(nextrow));
 END LOOP;
 result:=jsonb_build_object('periods',result);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_schedule_elder_versions(p_department uuid,p_kind text,p_starts_on date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_schedule_private.can_view(u,p_department) OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=p_department AND code='ancionato' AND active) THEN RAISE EXCEPTION 'Sem consulta ao histórico do Ancionato.' USING errcode='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('version',v.version,'actor_id',v.actor_id,'captured_at',v.captured_at,'snapshot',v.snapshot) ORDER BY v.version DESC)
 FROM public.schedule_elder_versions v JOIN public.schedule_elder_periods p ON p.church_id=v.church_id AND p.id=v.period_id
 WHERE p.department_id=p_department AND p.kind=p_kind AND p.starts_on=p_starts_on),'[]');END $$;
-- Revalida publicações preservadas ao alterar vínculo, pessoa, exceção ou compromisso.
CREATE FUNCTION iasdpi_schedule_private.elder_revalidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE p record;BEGIN
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 FOR p IN SELECT * FROM iasdpi_schedule_private.published_elder_periods WHERE ends_on>=(now() AT TIME ZONE 'America/Sao_Paulo')::date LOOP
 PERFORM iasdpi_schedule_private.elder_validate(p.department_id,p.kind,p.starts_on,p.ends_on,p.person_id);END LOOP;RETURN NULL;END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_people','schedule_memberships','schedule_departments','schedule_day_exceptions','schedule_legacy_commitments','schedule_assignments','schedule_elder_versions'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER elder_revalidate AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION iasdpi_schedule_private.elder_revalidate()',t);END LOOP;
END $$;
-- Amplia o feed público existente, sem expor rascunhos, contatos ou autores.
ALTER FUNCTION public.iasdpi_schedule_published(date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_published(date) RENAME TO published_g4;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.published_g4(date) FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_schedule_published(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE rows jsonb;BEGIN
 rows:=iasdpi_schedule_private.published_g4(p_month);
 RETURN rows||coalesce((SELECT jsonb_agg(jsonb_build_object('id','elder:'||p.id::text,'date',p.starts_on,'startDate',p.starts_on,'endDate',p.ends_on,
 'kind',p.kind,'department_id',p.department_id,'department',d.name,'person',person.display_name,'role',CASE WHEN p.kind='weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,
 'version',p.version,'published_at',p.captured_at,'origin','Escala publicada no sistema') ORDER BY p.starts_on,p.kind)
 FROM iasdpi_schedule_private.published_elder_periods p JOIN public.schedule_departments d ON d.id=p.department_id AND d.active
 JOIN public.schedule_people person ON person.id=p.person_id
 WHERE p.starts_on<=(p_month+interval '1 month - 1 day')::date AND p.ends_on>=p_month),'[]');END $$;
ALTER FUNCTION public.iasdpi_schedule_settings_get() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() RENAME TO settings_get_g4;
CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_schedule_private.settings_get_g4()||jsonb_build_object('elder_periods',true);END $$;
-- O rodízio diário consulta os mesmos compromissos antes de sugerir pessoas.
ALTER FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_rotation_context(uuid,date) RENAME TO rotation_context_g4;
REVOKE ALL ON FUNCTION iasdpi_schedule_private.rotation_context_g4(uuid,date) FROM public,anon,authenticated,service_role;
CREATE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 result:=iasdpi_schedule_private.rotation_context_g4(p_department,p_month);
 RETURN result||jsonb_build_object('people',coalesce((SELECT jsonb_agg(person||jsonb_build_object(
 'history_count',(SELECT count(DISTINCT c.day) FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id=p_department AND c.day<p_month),
 'last_day',(SELECT max(c.day) FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id=p_department AND c.day<p_month),
 'global_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT value::date AS day FROM jsonb_array_elements_text(person->'global_days') UNION SELECT c.day FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.day>=p_month AND c.day<(p_month+interval '1 month')::date) dates),'[]'),
 'department_days',coalesce((SELECT jsonb_agg(day ORDER BY day) FROM (SELECT DISTINCT value::date AS day FROM jsonb_array_elements_text(person->'department_days') UNION SELECT c.day FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id=p_department AND c.day>=p_month AND c.day<(p_month+interval '1 month')::date) dates),'[]'),
 'days',coalesce((SELECT jsonb_agg(day_item.value||jsonb_build_object('conflict',coalesce((day_item.value->>'conflict')::boolean,false) OR EXISTS(
 SELECT 1 FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=(person->>'person_id')::uuid AND c.department_id<>p_department AND c.day=(day_item.value->>'date')::date
 AND NOT iasdpi_schedule_private.has_day_exception(c.person_id,c.day,p_department,c.department_id)))) FROM jsonb_array_elements(person->'days') day_item(value)),'[]')))
 FROM jsonb_array_elements(result->'people') person),'[]'));
END $$;
-- Workspace B1.1 faz despacho dinâmico para settings_get, preservando o restante.
-- Proprietários sem BYPASSRLS; auxiliares jamais executáveis pelo navegador.
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='iasdpi_schedule_private' AND p.proname IN ('elder_id','elder_validate','elder_revalidate','published_g4','settings_get_g4','rotation_context_g4'))
 OR (n.nspname='public' AND p.proname IN ('iasdpi_schedule_elder_workspace','iasdpi_schedule_elder_save','iasdpi_schedule_elder_versions','iasdpi_schedule_published','iasdpi_schedule_settings_get','iasdpi_schedule_rotation_context')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 END LOOP;END $$;
ALTER VIEW iasdpi_schedule_private.published_elder_periods OWNER TO iasdpi_church_executor;
REVOKE ALL ON iasdpi_schedule_private.published_elder_periods FROM public,anon,authenticated,service_role;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_elder_workspace(uuid,date,integer),public.iasdpi_schedule_elder_save(uuid,text,jsonb,uuid),
 public.iasdpi_schedule_elder_versions(uuid,text,date),public.iasdpi_schedule_settings_get(),public.iasdpi_schedule_rotation_context(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_published(date) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
