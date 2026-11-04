-- G8.2: integração sobre a cadeia 001–016 disponível. G8.1 não encontrada no checkout.
-- Nenhuma pessoa, disponibilidade ou habilitação é inferida de nomes/organograma.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_schedule_department_days(uuid)') IS NULL THEN RAISE EXCEPTION 'Exige postgres e 001–016 completas.';END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.schedule_memberships'::regclass AND attname='participation_confirmed' AND NOT attisdropped) THEN RAISE EXCEPTION '017 já instalada; revisar sem sobrescrever.';END IF;
END $$;
ALTER TABLE public.schedule_memberships
 ADD COLUMN participation_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN availability_override boolean NOT NULL DEFAULT false,
 ADD COLUMN leadership_scope text NOT NULL DEFAULT '' CHECK(length(leadership_scope)<=120);
ALTER TABLE public.schedule_availability DROP CONSTRAINT schedule_availability_origin_check;
ALTER TABLE public.schedule_availability ADD CONSTRAINT schedule_availability_origin_check CHECK(origin IN ('manual','daily-profile','registry-g82'));
-- Preserva confirmações explícitas existentes; liderança e função genérica não confirmam qualificação.
UPDATE public.schedule_memberships m SET participation_confirmed=true WHERE EXISTS(SELECT 1 FROM public.schedule_qualifications q WHERE q.membership_id=m.id);
CREATE TABLE public.schedule_source_links(
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 500),person_id uuid NOT NULL,
 reference jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(reference)='object'),
 version bigint NOT NULL CHECK(version>0),updated_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(church_id,source_key),FOREIGN KEY(church_id,person_id) REFERENCES public.schedule_people(church_id,id)
);
ALTER TABLE public.schedule_source_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.schedule_source_links FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.schedule_source_links TO iasdpi_church_executor;
CREATE POLICY church_boundary ON public.schedule_source_links AS RESTRICTIVE FOR ALL TO public USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE POLICY church_executor ON public.schedule_source_links FOR ALL TO iasdpi_church_executor USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON public.schedule_source_links FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church();
CREATE INDEX schedule_source_links_person ON public.schedule_source_links(church_id,person_id);
-- A implementação anterior à 010 já distingue disponibilidade desconhecida.
CREATE OR REPLACE FUNCTION iasdpi_schedule_private.day_availability(person uuid,department uuid,day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN iasdpi_schedule_private.day_availability_009(person,department,day)='unavailable' THEN 'unavailable'
 WHEN EXISTS(SELECT 1 FROM public.schedule_memberships m WHERE m.person_id=person AND m.department_id=department AND m.availability_override) THEN
 CASE WHEN EXISTS(SELECT 1 FROM public.schedule_availability v WHERE v.person_id=person AND v.department_id=department AND v.active AND v.kind='available' AND v.start_time IS NULL AND v.end_time IS NULL AND
 ((v.pattern='weekly' AND extract(dow FROM day)::smallint=ANY(v.weekdays) AND (v.valid_from IS NULL OR day>=v.valid_from) AND (v.valid_until IS NULL OR day<=v.valid_until)) OR (v.pattern='period' AND day BETWEEN v.starts_on AND v.ends_on))) THEN 'available' ELSE 'unknown' END
 ELSE iasdpi_schedule_private.day_availability_009(person,department,day) END;
$$;
CREATE FUNCTION public.iasdpi_registry_people(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.active AND iasdpi_schedule_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 IF p_search IS NULL OR length(p_search)>160 THEN RAISE EXCEPTION 'Pesquisa inválida.' USING errcode='22023';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'display_name',display_name,'active',active,'version',version) ORDER BY name,id) FROM public.schedule_people WHERE position(iasdpi_schedule_private.normal_name(p_search) in normalized_name)>0),'[]');
END $$;
CREATE FUNCTION public.iasdpi_registry_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();c jsonb;BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.active AND iasdpi_schedule_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 c:=public.iasdpi_schedule_catalog();
 RETURN c||jsonb_build_object('profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('membership_id',m.id,'weekdays',
 (SELECT jsonb_object_agg(day::text,coalesce((SELECT v.kind FROM public.schedule_availability v WHERE v.person_id=m.person_id AND (v.department_id=m.department_id OR (v.department_id IS NULL AND NOT m.availability_override)) AND v.active AND v.pattern='weekly' AND v.start_time IS NULL AND v.end_time IS NULL AND day=ANY(v.weekdays) ORDER BY CASE v.kind WHEN 'unavailable' THEN 0 ELSE 1 END LIMIT 1),'unknown')) FROM generate_series(0,6) day)))
 FROM public.schedule_memberships m WHERE iasdpi_schedule_private.has_capability(u,m.department_id,'members')),'[]'),
 'source_links',CASE WHEN iasdpi_schedule_private.is_admin(u) THEN coalesce((SELECT jsonb_agg(to_jsonb(l)-'church_id'-'updated_by') FROM public.schedule_source_links l),'[]') ELSE '[]'::jsonb END);
END $$;
CREATE FUNCTION public.iasdpi_registry_save(p_person uuid,p_expected_person_version bigint,p_person_patch jsonb,p_links jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid;a boolean;p public.schedule_people;m public.schedule_memberships;entry jsonb;patch jsonb;dep uuid;expected bigint;result jsonb;sig text;receipt iasdpi_operational_private.receipts;r uuid;v text;days smallint[];kind text;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();a:=iasdpi_schedule_private.is_admin(u);
 IF p_person IS NULL OR p_request_id IS NULL OR p_expected_person_version IS NULL OR p_expected_person_version<0 OR jsonb_typeof(p_person_patch) IS DISTINCT FROM 'object' OR jsonb_typeof(p_links) IS DISTINCT FROM 'array' OR jsonb_array_length(p_links)>100 OR pg_column_size(p_links)>120000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_person_patch) k WHERE k NOT IN ('name','display_name','active')) THEN RAISE EXCEPTION 'Dados inválidos.' USING errcode='22023';END IF;
 IF NOT a AND (p_person_patch<>'{}' OR jsonb_array_length(p_links)=0) THEN RAISE EXCEPTION 'Dados da pessoa são administrados centralmente. Edite apenas os vínculos autorizados.' USING errcode='42501';END IF;
 -- Autoriza todos os vínculos antes de consultar recibo ou alterar qualquer linha.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_links) e GROUP BY e->>'department_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Departamento repetido no lote.' USING errcode='22023';END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_links) LOOP
 dep:=(entry->>'department_id')::uuid;
 IF dep IS NULL OR NOT iasdpi_schedule_private.has_capability(u,dep,'members') OR NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=dep AND active) THEN RAISE EXCEPTION 'Sem administração deste departamento.' USING errcode='42501';END IF;
 END LOOP;
 sig:='registry-g82:'||iasdpi_operational_private.fingerprint(jsonb_build_object('person',p_person,'version',p_expected_person_version,'patch',p_person_patch,'links',p_links));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF receipt.actor_id<>u OR receipt.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN receipt.response;END IF;
 SELECT * INTO p FROM public.schedule_people WHERE id=p_person FOR UPDATE;
 IF coalesce(p.version,0)<>p_expected_person_version THEN RAISE EXCEPTION 'Cadastro da pessoa mudou. Recarregue e compare.' USING errcode='40001';END IF;
 IF p.id IS NULL AND (NOT a OR NOT p_person_patch ? 'name') THEN RAISE EXCEPTION 'Selecione uma pessoa existente ou solicite cadastro ao administrador.' USING errcode='42501';END IF;
 IF p_person_patch<>'{}' THEN
 patch:=p_person_patch;
 IF patch ? 'name' AND NOT patch ? 'display_name' THEN patch:=patch||jsonb_build_object('display_name',patch->>'name');END IF;
 PERFORM public.iasdpi_schedule_save('person',p_person,p_expected_person_version,patch,gen_random_uuid());
 END IF;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_links) LOOP
 dep:=(entry->>'department_id')::uuid;expected:=(entry->>'expected_version')::bigint;patch:=entry->'patch';
 IF expected IS NULL OR expected<0 OR jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('department_id','expected_version','patch')) OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN ('active','is_ministry_head','leadership_scope','participation_confirmed','availability_override','max_monthly_count','role_ids','weekdays')) THEN RAISE EXCEPTION 'Vínculo ou campo inválido.' USING errcode='22023';END IF;
 SELECT * INTO m FROM public.schedule_memberships WHERE person_id=p_person AND department_id=dep FOR UPDATE;
 IF coalesce(m.version,0)<>expected THEN RAISE EXCEPTION 'Vínculo alterado em outra edição. Recarregue e compare.' USING errcode='40001';END IF;
 IF patch ? 'leadership_scope' AND patch->>'leadership_scope'<>'' AND NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=dep AND code='diaconato' AND patch->>'leadership_scope' IN ('Diaconato — Diáconos','Diaconato — Diaconisas')) THEN RAISE EXCEPTION 'Subdivisão de liderança inválida.' USING errcode='22023';END IF;
 IF patch ? 'role_ids' AND (jsonb_typeof(patch->'role_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(patch->'role_ids')>100) THEN RAISE EXCEPTION 'Funções inválidas.' USING errcode='22023';END IF;
 IF m.id IS NULL THEN INSERT INTO public.schedule_memberships(person_id,department_id) VALUES(p_person,dep) RETURNING * INTO m;END IF;
 UPDATE public.schedule_memberships SET active=CASE WHEN patch?'active' THEN (patch->>'active')::boolean ELSE active END,
 is_ministry_head=CASE WHEN patch?'is_ministry_head' THEN (patch->>'is_ministry_head')::boolean ELSE is_ministry_head END,
 leadership_scope=CASE WHEN patch?'leadership_scope' THEN patch->>'leadership_scope' ELSE leadership_scope END,
 participation_confirmed=CASE WHEN patch?'participation_confirmed' THEN (patch->>'participation_confirmed')::boolean ELSE participation_confirmed END,
 availability_override=CASE WHEN patch?'weekdays' THEN true WHEN patch?'availability_override' THEN (patch->>'availability_override')::boolean ELSE availability_override END,
 max_monthly_count=CASE WHEN patch?'max_monthly_count' THEN (patch->>'max_monthly_count')::integer ELSE max_monthly_count END,
 version=CASE WHEN expected=0 THEN 1 ELSE version+1 END,updated_at=now() WHERE id=m.id;
 IF patch ? 'role_ids' THEN
 DELETE FROM public.schedule_qualifications WHERE membership_id=m.id;
 FOR r IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(patch->'role_ids') LOOP
 IF NOT EXISTS(SELECT 1 FROM public.schedule_roles WHERE id=r AND department_id=dep AND active) THEN RAISE EXCEPTION 'Função de outro departamento ou inativa.' USING errcode='23514';END IF;
 INSERT INTO public.schedule_qualifications(membership_id,role_id,department_id) VALUES(m.id,r,dep);END LOOP;
 END IF;
 IF patch ? 'weekdays' THEN
 IF jsonb_typeof(patch->'weekdays') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each_text(patch->'weekdays') x WHERE x.key !~ '^[0-6]$' OR x.value NOT IN ('available','unavailable','unknown') OR x.value IS NULL) OR (SELECT count(*) FROM jsonb_object_keys(patch->'weekdays'))<>7 THEN RAISE EXCEPTION 'Confirme os sete dias: disponível, indisponível ou pendente.' USING errcode='22023';END IF;
 UPDATE public.schedule_availability SET active=false,version=version+1,updated_at=now() WHERE person_id=p_person AND department_id=dep AND origin='registry-g82' AND active;
 FOREACH kind IN ARRAY ARRAY['available','unavailable'] LOOP
 SELECT array_agg(key::smallint ORDER BY key) INTO days FROM jsonb_each_text(patch->'weekdays') WHERE value=kind;
 IF days IS NOT NULL THEN INSERT INTO public.schedule_availability(person_id,department_id,kind,pattern,weekdays,origin) VALUES(p_person,dep,kind,'weekly',days,'registry-g82');END IF;
 END LOOP;
 END IF;
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields,reason) VALUES(u,'registry-membership',m.id,dep,CASE WHEN expected=0 THEN 1 ELSE expected+1 END,ARRAY(SELECT jsonb_object_keys(patch)),jsonb_build_object('old_scope',m.leadership_scope,'scope',coalesce(patch->>'leadership_scope',m.leadership_scope))::text);
 END LOOP;
 SELECT jsonb_build_object('person',to_jsonb(person)-'auth_user_id'-'normalized_name','memberships',coalesce((SELECT jsonb_agg(to_jsonb(link)) FROM public.schedule_memberships link WHERE link.person_id=p_person AND iasdpi_schedule_private.has_capability(u,link.department_id,'members')),'[]')) INTO result FROM public.schedule_people person WHERE id=p_person;
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_registry_source_save(p_source_key text,p_person uuid,p_expected_version bigint,p_request_id uuid,p_reference jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE day date;u uuid;old public.schedule_source_links;result jsonb;sig text;r iasdpi_operational_private.receipts;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Associação exige administrador da igreja.' USING errcode='42501';END IF;
 IF p_source_key IS NULL OR length(p_source_key) NOT BETWEEN 1 AND 500 OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR NOT EXISTS(SELECT 1 FROM public.schedule_people WHERE id=p_person) THEN RAISE EXCEPTION 'Associação inválida.' USING errcode='22023';END IF;
 sig:='registry-source:'||iasdpi_operational_private.fingerprint(jsonb_build_object('source',p_source_key,'person',p_person,'version',p_expected_version,'reference',p_reference));SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 IF jsonb_typeof(p_reference) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_reference) k WHERE k NOT IN ('department_id','starts_on','ends_on','kind','original_name')) THEN RAISE EXCEPTION 'Referência histórica inválida.' USING errcode='22023';END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_legacy_commitments l WHERE (l.source_key=p_source_key OR starts_with(l.source_key,p_source_key||':day:')) AND l.person_id<>p_person) THEN RAISE EXCEPTION 'Compromisso histórico já conciliado com outra identidade. Exige revisão administrativa; não foi sobrescrito.' USING errcode='23505';END IF;
 IF p_reference<>'{}' THEN
 IF p_reference->>'kind' IS NULL OR length(coalesce(p_reference->>'original_name','')) NOT BETWEEN 1 AND 160 OR p_reference->>'kind' NOT IN ('daily','weekly','monthly') OR (p_reference->>'starts_on')::date IS NULL OR (p_reference->>'ends_on')::date IS NULL OR (p_reference->>'ends_on')::date<(p_reference->>'starts_on')::date OR (p_reference->>'ends_on')::date-(p_reference->>'starts_on')::date>31 THEN RAISE EXCEPTION 'Período histórico inválido.' USING errcode='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=p_person AND department_id=(p_reference->>'department_id')::uuid) THEN RAISE EXCEPTION 'Vincule a pessoa ao departamento antes de conciliar o histórico.' USING errcode='23514';END IF;
 -- Mês não reserva dias, conforme a regra do Ancionato. Dias/semanas reutilizam 009.
 IF p_reference->>'kind'<>'monthly' THEN
 FOR day IN SELECT x::date FROM generate_series((p_reference->>'starts_on')::date::timestamp,(p_reference->>'ends_on')::date::timestamp,interval '1 day') x LOOP
 PERFORM public.iasdpi_schedule_register_legacy(jsonb_build_array(jsonb_build_object('source_key',p_source_key||':day:'||day::text,'person_id',p_person,'department_id',p_reference->>'department_id','date',day,'original_name',p_reference->>'original_name')),gen_random_uuid());
 END LOOP;END IF;
 END IF;
 SELECT * INTO old FROM public.schedule_source_links WHERE source_key=p_source_key FOR UPDATE;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Associação alterada em outra edição.' USING errcode='40001';END IF;
 INSERT INTO public.schedule_source_links(source_key,person_id,reference,version,updated_by) VALUES(p_source_key,p_person,p_reference,1,u) ON CONFLICT(church_id,source_key) DO UPDATE SET person_id=excluded.person_id,reference=CASE WHEN p_reference='{}'::jsonb THEN schedule_source_links.reference ELSE p_reference END,version=schedule_source_links.version+1,updated_by=u,updated_at=now() RETURNING to_jsonb(schedule_source_links)-'church_id'-'updated_by' INTO result;
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason) VALUES(u,'registry-source',p_person,(result->>'version')::bigint,ARRAY['association'],p_source_key);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM public.iasdpi_current_church_id(); -- A função validada já exige igreja ativa/listada; não amplia grants de tabela.
 RETURN jsonb_build_object('heads',coalesce((SELECT jsonb_agg(jsonb_build_object('department_code',d.code,'department',d.name,'scope',m.leadership_scope,'name',p.display_name)) FROM public.schedule_memberships m JOIN public.schedule_people p ON p.id=m.person_id JOIN public.schedule_departments d ON d.id=m.department_id WHERE m.active AND m.is_ministry_head AND p.active AND d.active),'[]'),
 'configured',coalesce((SELECT jsonb_agg(x) FROM (SELECT DISTINCT d.code department_code,d.name department,scope.value scope FROM iasdpi_schedule_private.audit_logs a JOIN public.schedule_departments d ON d.id=a.department_id CROSS JOIN LATERAL jsonb_array_elements_text(jsonb_build_array((CASE WHEN a.entity='registry-membership' THEN a.reason::jsonb ELSE '{}'::jsonb END)->>'old_scope',(CASE WHEN a.entity='registry-membership' THEN a.reason::jsonb ELSE '{}'::jsonb END)->>'scope')) scope(value) WHERE a.entity='registry-membership' AND a.changed_fields && ARRAY['is_ministry_head','leadership_scope'] AND d.active) x),'[]'),
 'links',coalesce((SELECT jsonb_agg(jsonb_build_object('source_key',l.source_key,'display_name',p.display_name)) FROM public.schedule_source_links l JOIN public.schedule_people p ON p.id=l.person_id),'[]'));
END $$;
CREATE FUNCTION public.iasdpi_registry_history(p_person uuid,p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_schedule_private.has_capability(u,p_department,'members') OR NOT EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=p_person AND department_id=p_department) THEN RAISE EXCEPTION 'Sem histórico deste vínculo.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT jsonb_agg(row ORDER BY row->>'assigned_on' DESC) FROM (
 SELECT jsonb_build_object('assigned_on',e.scheduled_on,'department',d.name,'role',r.name,'status',p.status) row FROM public.schedule_assignments a JOIN public.schedule_requirements req ON req.id=a.requirement_id JOIN public.schedule_roles r ON r.id=req.role_id JOIN public.schedule_departments d ON d.id=a.department_id JOIN public.schedule_events e ON e.id=req.event_id JOIN public.schedule_plans p ON p.id=a.plan_id WHERE a.person_id=p_person AND a.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.scheduled_on,'department',d.name,'role','Função histórica: Pendente de confirmação','status','Histórico manual — original preservado','original_name',l.original_name) FROM public.schedule_legacy_commitments l JOIN public.schedule_departments d ON d.id=l.department_id WHERE l.person_id=p_person AND l.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.reference->>'starts_on','ends_on',l.reference->>'ends_on','department',d.name,'role','Ancião do Mês · referência histórica','status','Histórico manual — original preservado') FROM public.schedule_source_links l JOIN public.schedule_departments d ON d.id=(l.reference->>'department_id')::uuid WHERE l.person_id=p_person AND d.id=p_department AND l.reference->>'kind'='monthly'
 UNION ALL SELECT jsonb_build_object('assigned_on',x.starts_on,'ends_on',x.ends_on,'department',d.name,'role',CASE x.kind WHEN 'weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,'status',x.status) FROM public.schedule_elder_periods x JOIN public.schedule_departments d ON d.id=x.department_id WHERE x.person_id=p_person AND x.department_id=p_department
 ) rows),'[]'),
 'versions',coalesce((SELECT jsonb_agg(row) FROM (
 SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'title','status',v.snapshot->>'status','captured_at',v.captured_at) row FROM public.schedule_versions v JOIN public.schedule_plans p ON p.id=v.plan_id WHERE p.department_id=p_department AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'requirements') req CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') a WHERE a->>'person_id'=p_person::text)
 UNION ALL SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'kind','status',v.snapshot->>'status','captured_at',v.captured_at) FROM public.schedule_elder_versions v JOIN public.schedule_elder_periods p ON p.id=v.period_id WHERE p.department_id=p_department AND v.snapshot->>'person_id'=p_person::text
 ) rows),'[]'));
END $$;
-- Contexto central mantém a detecção cruzada, mas nunca converte unknown em available.
ALTER FUNCTION public.iasdpi_schedule_rotation_context(uuid,date) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_rotation_context(uuid,date) RENAME TO rotation_context_g7;
CREATE FUNCTION public.iasdpi_schedule_rotation_context(p_department uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;BEGIN
 c:=iasdpi_schedule_private.rotation_context_g7(p_department,p_month);
 RETURN c||jsonb_build_object('central_registry',true,'availability_enabled',true,'availability_default','unknown','people',coalesce((SELECT jsonb_agg(person||jsonb_build_object('days',(SELECT jsonb_agg(day||jsonb_build_object('state',iasdpi_schedule_private.day_availability((person->>'person_id')::uuid,p_department,(day->>'date')::date))) FROM jsonb_array_elements(person->'days') day))) FROM jsonb_array_elements(c->'people') person),'[]'));
END $$;
ALTER FUNCTION public.iasdpi_schedule_settings_get() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_settings_get() RENAME TO settings_get_g7;
CREATE FUNCTION public.iasdpi_schedule_settings_get() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN iasdpi_schedule_private.settings_get_g7()||jsonb_build_object('central_registry',true,'availability_enabled',true,'availability_default','unknown');END $$;
-- Períodos do Ancionato consultam confirmação por data, sem recortar semanas/meses.
ALTER FUNCTION public.iasdpi_schedule_elder_workspace(uuid,date,integer) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_elder_workspace(uuid,date,integer) RENAME TO elder_workspace_g7;
CREATE FUNCTION public.iasdpi_schedule_elder_workspace(p_department uuid,p_month date,p_year integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;s date;e date;BEGIN
 c:=iasdpi_schedule_private.elder_workspace_g7(p_department,p_month,p_year);
 SELECT min((x->>'starts_on')::date),max((x->>'ends_on')::date) INTO s,e FROM jsonb_array_elements(c->'periods') x;
 RETURN c||jsonb_build_object('central_registry',true,'availability_days',coalesce((SELECT jsonb_agg(jsonb_build_object('person_id',m.person_id,'date',d::date,'state',iasdpi_schedule_private.day_availability(m.person_id,p_department,d::date))) FROM public.schedule_memberships m CROSS JOIN generate_series(s::timestamp,e::timestamp,interval '1 day') d WHERE m.department_id=p_department AND m.active),'[]'));
END $$;
GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN ('iasdpi_registry_history','iasdpi_registry_people','iasdpi_registry_catalog','iasdpi_registry_save','iasdpi_registry_source_save','iasdpi_registry_public','iasdpi_schedule_elder_workspace','iasdpi_schedule_rotation_context','iasdpi_schedule_settings_get')) OR (n.nspname='iasdpi_schedule_private' AND p.proname IN ('day_availability','rotation_context_g7','settings_get_g7','elder_workspace_g7')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 IF f.proname='iasdpi_registry_public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
