-- G8.4. Revisar após 001–018. Instalar NÃO renomeia nem mescla pessoas.
-- Renomeação/mesclagem: somente RPC administrativa, prévia e confirmação explícita.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_registry_people(text)') IS NULL
 OR to_regclass('public.schedule_source_links') IS NULL THEN RAISE EXCEPTION 'Exige postgres e cadeia 001–018 revisada.';END IF;
 IF to_regclass('iasdpi_schedule_private.person_aliases') IS NOT NULL THEN RAISE EXCEPTION '019 já instalada. Revisar sem sobrescrever.';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname IN('iasdpi_registry_identity_preview','iasdpi_registry_identity_apply','iasdpi_registry_audit')) OR (n.nspname='iasdpi_schedule_private' AND p.proname IN('canonical_person','confirmed_person_names','identity_group','identity_person_guard','identity_display_sync','identity_reference_guard','catalog_g83','save_g83','public_g83'))) THEN RAISE EXCEPTION 'Objetos G8.4 preexistentes: revisar antes de instalar.';END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['iasdpi_schedule_catalog','iasdpi_schedule_save','iasdpi_registry_people','iasdpi_registry_public','iasdpi_registry_history']) expected(name) WHERE (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=expected.name)<>1) THEN RAISE EXCEPTION 'RPC ausente ou sobrecarga inesperada. Revisar a cadeia anterior.';END IF;

END $$;
ALTER TABLE public.schedule_people ADD COLUMN merged_into uuid,
 ADD CONSTRAINT schedule_people_merged_fk FOREIGN KEY(church_id,merged_into) REFERENCES public.schedule_people(church_id,id),
 ADD CONSTRAINT schedule_people_merged_check CHECK(merged_into IS NULL OR (merged_into<>id AND NOT active));
CREATE INDEX schedule_people_merged ON public.schedule_people(church_id,merged_into) WHERE merged_into IS NOT NULL;
CREATE TABLE iasdpi_schedule_private.person_aliases(
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id(),person_id uuid NOT NULL,
 alias text NOT NULL CHECK(length(btrim(alias)) BETWEEN 2 AND 160),
 normalized_alias text GENERATED ALWAYS AS(iasdpi_schedule_private.normal_name(alias)) STORED,
 scope text NOT NULL DEFAULT '',created_by uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(church_id,person_id,normalized_alias,scope),
 FOREIGN KEY(church_id,person_id) REFERENCES public.schedule_people(church_id,id)
);
ALTER TABLE iasdpi_schedule_private.person_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_schedule_private.person_aliases FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT ON iasdpi_schedule_private.person_aliases TO iasdpi_church_executor;
CREATE POLICY church_boundary ON iasdpi_schedule_private.person_aliases AS RESTRICTIVE FOR ALL TO public
 USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE POLICY church_executor ON iasdpi_schedule_private.person_aliases FOR ALL TO iasdpi_church_executor
 USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_schedule_private.person_aliases FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church();
CREATE INDEX registry_alias_search ON iasdpi_schedule_private.person_aliases(church_id,normalized_alias);
DO $$ DECLARE c record;BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.schedule_availability'::regclass AND confrelid='public.schedule_memberships'::regclass AND contype='f' LOOP
 EXECUTE format('ALTER TABLE public.schedule_availability ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',c.conname);END LOOP;END $$;


CREATE FUNCTION iasdpi_schedule_private.canonical_person(p uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(merged_into,id) FROM public.schedule_people WHERE id=p;
$$;
-- Lista fechada: nenhuma associação por semelhança ou inferência de ministério.
CREATE FUNCTION iasdpi_schedule_private.confirmed_person_names() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT '[{"name":"Lucas Borrego","aliases":["Mini Lucas"]},{"name":"Rafael Braga","aliases":["Rafa"]},{"name":"Gabriel Macedo","aliases":["Macedo","macedo Logos"]},{"name":"Raphael Moreira","aliases":["Raphael"]},{"name":"Paulo Scarpelini","aliases":["Paulito","Paulitos"]},{"name":"Samuel Ferreira","aliases":["Samuel"]},{"name":"Izabelle Souza","aliases":["Izabelle PI Souza"]},{"name":"Simone Cristina","aliases":["Simone/Profª de Pilates"]},{"name":"Letícia Ferreira","aliases":["Letícia PI"]},{"name":"Rosana Bianchini","aliases":["Rosana"]},{"name":"Victória Scarpelini","aliases":["Victoria"],"department":"clube-de-desbravadores"},{"name":"Luan Vaz","aliases":["Luan"]},{"name":"Henrique Franco","aliases":["Henrique"]}]'::jsonb; $$;

CREATE FUNCTION iasdpi_schedule_private.identity_group(target text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET jit=off AS $$
DECLARE rule jsonb;ids uuid[];blocked text[]:='{}';refs jsonb:='{}';rows jsonb;t text;names text[];part jsonb;BEGIN
 IF public.iasdpi_current_church_id()<>'1a5d0000-0000-4000-8000-000000000001'::uuid THEN RAISE EXCEPTION 'Correspondências autorizadas somente para IASD_PI.' USING errcode='42501';END IF;
 SELECT x INTO rule FROM jsonb_array_elements(iasdpi_schedule_private.confirmed_person_names()) x WHERE x->>'name'=target;
 IF rule IS NULL THEN RAISE EXCEPTION 'Nome fora das correspondências confirmadas.' USING errcode='22023';END IF;
 SELECT array_agg(iasdpi_schedule_private.normal_name(x)) INTO names FROM jsonb_array_elements_text(rule->'aliases'||jsonb_build_array(target)) x;
 SELECT array_agg(p.id ORDER BY (p.name=target) DESC,p.created_at,p.id),jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'display_name',p.display_name,'version',p.version,'active',p.active) ORDER BY (p.name=target) DESC,p.created_at,p.id)
 INTO ids,rows FROM public.schedule_people p WHERE p.merged_into IS NULL AND p.normalized_name=ANY(names)
 AND (p.normalized_name=iasdpi_schedule_private.normal_name(target) OR NOT rule?'department' OR EXISTS(SELECT 1 FROM public.schedule_memberships m JOIN public.schedule_departments d ON d.id=m.department_id WHERE m.person_id=p.id AND d.code=rule->>'department'));
 ids:=coalesce(ids,'{}');rows:=coalesce(rows,'[]');
 -- Relatório inclui TODAS as referências vivas e seus valores no token (sem expô-los ao cliente).
 FOREACH t IN ARRAY ARRAY['schedule_memberships','schedule_availability','schedule_assignments','schedule_day_exceptions','schedule_legacy_commitments','schedule_elder_periods','schedule_source_links'] LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),%L::jsonb) FROM public.%I x WHERE person_id=ANY($1)','[]',t) INTO part USING ids;refs:=refs||jsonb_build_object(t,part);
 END LOOP;
 refs:=refs||jsonb_build_object('people',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM public.schedule_people p WHERE p.id=ANY(ids)),'private_details',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY person_id),'[]') FROM iasdpi_schedule_private.person_details x WHERE person_id=ANY(ids)),
 'qualifications',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.membership_id,q.role_id),'[]') FROM public.schedule_qualifications q JOIN public.schedule_memberships m ON m.id=q.membership_id WHERE m.person_id=ANY(ids)),
 'confirmed_days',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY to_jsonb(c)::text),'[]') FROM iasdpi_schedule_private.confirmed_days c WHERE c.person_id=ANY(ids)),
 'aliases',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY to_jsonb(a)::text),'[]') FROM iasdpi_schedule_private.person_aliases a WHERE a.person_id=ANY(ids)));
 IF cardinality(ids)>1 THEN
 IF EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=ANY(ids) GROUP BY department_id HAVING count(*)>1) THEN blocked:=array_append(blocked,'Há vínculos duplicados no mesmo departamento. Revisar condições, funções e limites antes de mesclar.');END IF;
 IF (SELECT count(DISTINCT auth_user_id) FROM public.schedule_people WHERE id=ANY(ids))>1 THEN blocked:=array_append(blocked,'Há contas autenticadas diferentes. Nenhuma conta será desvinculada automaticamente.');END IF;
 IF (SELECT count(DISTINCT jsonb_build_array(active,max_monthly_count)) FROM public.schedule_people WHERE id=ANY(ids))>1 THEN blocked:=array_append(blocked,'Status ou limites globais divergem. Revisar antes da mesclagem.');END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_availability WHERE person_id=ANY(ids) AND department_id IS NULL AND active) THEN blocked:=array_append(blocked,'Disponibilidade global pode afetar novos departamentos. Revisão necessária.');END IF;
 IF (SELECT count(DISTINCT contact) FROM iasdpi_schedule_private.person_details WHERE person_id=ANY(ids) AND contact<>'')>1 OR (SELECT count(DISTINCT notes) FROM iasdpi_schedule_private.person_details WHERE person_id=ANY(ids) AND notes<>'')>1 THEN blocked:=array_append(blocked,'Contatos ou notas privadas divergem. Revisão administrativa necessária.');END IF;
 IF EXISTS(SELECT 1 FROM iasdpi_schedule_private.confirmed_days a JOIN iasdpi_schedule_private.confirmed_days b ON a.day=b.day AND a.department_id<>b.department_id AND a.person_id<>b.person_id WHERE a.person_id=ANY(ids) AND b.person_id=ANY(ids)) THEN blocked:=array_append(blocked,'As identidades possuem compromissos confirmados em departamentos diferentes no mesmo dia.');END IF;
 IF EXISTS(SELECT 1 FROM public.schedule_assignments WHERE person_id=ANY(ids) GROUP BY requirement_id HAVING count(*)>1) OR EXISTS(SELECT 1 FROM public.schedule_day_exceptions WHERE person_id=ANY(ids) GROUP BY day,department_a,department_b HAVING count(*)>1) THEN blocked:=array_append(blocked,'Referências operacionais duplicadas exigem revisão.');END IF;
 END IF;
 -- Falha fechada se uma evolução futura acrescentar uma referência não tratada.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.confrelid='public.schedule_people'::regclass AND k.conrelid NOT IN ('public.schedule_people'::regclass,'public.schedule_memberships'::regclass,'public.schedule_availability'::regclass,'public.schedule_assignments'::regclass,'public.schedule_day_exceptions'::regclass,'public.schedule_legacy_commitments'::regclass,'public.schedule_elder_periods'::regclass,'public.schedule_source_links'::regclass,'iasdpi_schedule_private.person_details'::regclass,'iasdpi_schedule_private.person_aliases'::regclass)) THEN blocked:=array_append(blocked,'Existe referência adicional ao cadastro central. Revisar a integração antes de consolidar.');END IF;
 RETURN jsonb_build_object('name',target,'aliases',rule->'aliases','department',rule->>'department','people',rows,'blockers',to_jsonb(blocked),
 'references',(SELECT jsonb_object_agg(key,jsonb_array_length(value)) FROM jsonb_each(refs)),
 'token',md5(jsonb_build_object('church',public.iasdpi_current_church_id(),'rule',rule,'people',rows,'references',refs,'blockers',blocked)::text));
END $$;

CREATE FUNCTION public.iasdpi_registry_identity_preview() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET jit=off AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Conciliação exige administrador da igreja.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('groups',CASE WHEN public.iasdpi_current_church_id()='1a5d0000-0000-4000-8000-000000000001'::uuid THEN
 (SELECT jsonb_agg(iasdpi_schedule_private.identity_group(x->>'name')) FROM jsonb_array_elements(iasdpi_schedule_private.confirmed_person_names()) x) ELSE '[]'::jsonb END,
 'possible_duplicates',coalesce((SELECT jsonb_agg(g) FROM (WITH labels AS (SELECT id,name,normalized_name FROM public.schedule_people WHERE merged_into IS NULL UNION SELECT p.id,p.name,a.normalized_alias FROM public.schedule_people p JOIN iasdpi_schedule_private.person_aliases a ON a.person_id=p.id WHERE p.merged_into IS NULL) SELECT normalized_name,count(*) count,jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY id) people FROM labels GROUP BY normalized_name HAVING count(*)>1) g),'[]'));
END $$;

CREATE FUNCTION public.iasdpi_registry_identity_apply(p_name text,p_canonical uuid,p_token text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET jit=off AS $$
DECLARE u uuid;g jsonb;ids uuid[];sources uuid[];t text;periodrow record;keep public.schedule_people;sig text;r iasdpi_operational_private.receipts;result jsonb;plan uuid;authid uuid;before_refs jsonb:='{}';part jsonb;BEGIN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador da igreja.' USING errcode='42501';END IF;
 IF p_request_id IS NULL OR p_token IS NULL OR p_canonical IS NULL OR p_name IS NULL THEN RAISE EXCEPTION 'Conciliação inválida.' USING errcode='22023';END IF;
 sig:='registry-identity:'||iasdpi_operational_private.fingerprint(jsonb_build_object('name',p_name,'canonical',p_canonical,'token',p_token,'church',public.iasdpi_current_church_id()));
 SELECT * INTO r FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN IF r.actor_id<>u OR r.signature<>sig THEN RAISE EXCEPTION 'Solicitação reutilizada.' USING errcode='22023';END IF;RETURN r.response;END IF;
 g:=iasdpi_schedule_private.identity_group(p_name);
 IF g->>'token'<>p_token THEN RAISE EXCEPTION 'Dados mudaram após a prévia. Recarregue e compare antes de confirmar.' USING errcode='40001';END IF;
 IF jsonb_array_length(g->'blockers')>0 THEN RAISE EXCEPTION 'Conciliação bloqueada: %',g->'blockers' USING errcode='23514';END IF;
 SELECT array_agg((x->>'id')::uuid) INTO ids FROM jsonb_array_elements(g->'people') x;
 IF ids IS NULL OR NOT p_canonical=ANY(ids) THEN RAISE EXCEPTION 'Escolha um identificador da prévia.' USING errcode='22023';END IF;
 SELECT array_agg(x) INTO sources FROM unnest(ids) x WHERE x<>p_canonical;sources:=coalesce(sources,'{}');
 IF EXISTS(SELECT 1 FROM public.schedule_people WHERE merged_into=ANY(sources)) THEN RAISE EXCEPTION 'Uma identidade já consolidada deve permanecer como identificador principal.' USING errcode='23514';END IF;
 PERFORM 1 FROM public.schedule_people WHERE id=ANY(ids) ORDER BY id FOR UPDATE;SET CONSTRAINTS ALL DEFERRED;
 SELECT * INTO STRICT keep FROM public.schedule_people WHERE id=p_canonical;
 FOREACH t IN ARRAY ARRAY['schedule_memberships','schedule_availability','schedule_assignments','schedule_day_exceptions','schedule_legacy_commitments','schedule_elder_periods','schedule_source_links'] LOOP
 EXECUTE format('SELECT coalesce(jsonb_agg(jsonb_build_object(%L,to_jsonb(x)->%L,%L,to_jsonb(x)->%L,%L,to_jsonb(x)->%L,%L,to_jsonb(x)->%L) ORDER BY to_jsonb(x)::text),%L) FROM public.%I x WHERE person_id=ANY($1)','id','id','person_id','person_id','source_key','source_key','version','version','[]',t) INTO part USING ids;
 before_refs:=before_refs||jsonb_build_object(t,part);END LOOP;
 before_refs:=before_refs||jsonb_build_object('auth_links',(SELECT jsonb_agg(jsonb_build_object('person_id',id,'auth_user_id',auth_user_id)) FROM public.schedule_people WHERE id=ANY(ids)));

 -- Guardar grafias antes da mudança, sem reescrever snapshots antigos.
 INSERT INTO iasdpi_schedule_private.person_aliases(person_id,alias,scope,created_by)
 SELECT p_canonical,v.alias,coalesce(g->>'department',''),u FROM public.schedule_people p CROSS JOIN LATERAL (VALUES(p.name),(p.display_name)) v(alias) WHERE p.id=ANY(ids) ON CONFLICT DO NOTHING;
 INSERT INTO iasdpi_schedule_private.person_aliases(person_id,alias,scope,created_by)
 SELECT p_canonical,x,coalesce(g->>'department',''),u FROM jsonb_array_elements_text(g->'aliases') x ON CONFLICT DO NOTHING;
 INSERT INTO iasdpi_schedule_private.person_aliases(person_id,alias,scope,created_by)
 SELECT p_canonical,alias,scope,u FROM iasdpi_schedule_private.person_aliases WHERE person_id=ANY(sources) ON CONFLICT DO NOTHING;
 SELECT max(auth_user_id::text)::uuid INTO authid FROM public.schedule_people WHERE id=ANY(ids);
 UPDATE public.schedule_people SET auth_user_id=NULL,version=version+1,updated_at=now() WHERE id=ANY(sources) AND auth_user_id IS NOT NULL;
 UPDATE public.schedule_people SET name=p_name,display_name=p_name,auth_user_id=authid,version=version+1,updated_at=now() WHERE id=p_canonical;
 INSERT INTO iasdpi_schedule_private.person_details(person_id,contact,notes,church_id)
 SELECT p_canonical,coalesce(max(nullif(contact,'')),''),coalesce(max(nullif(notes,'')),''),public.iasdpi_current_church_id() FROM iasdpi_schedule_private.person_details WHERE person_id=ANY(ids)
 ON CONFLICT(person_id) DO UPDATE SET contact=excluded.contact,notes=excluded.notes;
 UPDATE public.schedule_memberships SET person_id=p_canonical,version=version+1,updated_at=now() WHERE person_id=ANY(sources);
 UPDATE public.schedule_availability SET person_id=p_canonical,version=version+1,updated_at=now() WHERE person_id=ANY(sources);
 UPDATE public.schedule_day_exceptions SET person_id=p_canonical,version=version+1 WHERE person_id=ANY(sources);
 UPDATE public.schedule_legacy_commitments SET person_id=p_canonical WHERE person_id=ANY(sources);
 UPDATE public.schedule_source_links SET person_id=p_canonical,version=version+1,updated_at=now() WHERE person_id=ANY(sources);
 -- Cada planejamento tocado ganha versão; autoria de criação e snapshots antigos ficam intactos.
 FOR plan IN SELECT DISTINCT plan_id FROM public.schedule_assignments WHERE person_id=ANY(sources) LOOP
 UPDATE public.schedule_assignments SET person_id=p_canonical WHERE plan_id=plan AND person_id=ANY(sources);
 UPDATE public.schedule_plans SET version=version+1,updated_by=u,updated_at=now() WHERE id=plan;
 INSERT INTO public.schedule_versions(plan_id,version,actor_id,snapshot) SELECT id,version,u,iasdpi_schedule_private.plan_snapshot(id) FROM public.schedule_plans WHERE id=plan;
 END LOOP;
 FOR periodrow IN UPDATE public.schedule_elder_periods SET person_id=p_canonical,version=version+1,updated_by=u,updated_at=now() WHERE person_id=ANY(sources) RETURNING * LOOP
 INSERT INTO public.schedule_elder_versions(period_id,version,actor_id,snapshot) VALUES(periodrow.id,periodrow.version,u,to_jsonb(periodrow));END LOOP;
 UPDATE public.schedule_people SET merged_into=p_canonical,active=false,display_name=p_name,version=version+1,updated_at=now() WHERE id=ANY(sources);
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,version,changed_fields,reason)
 SELECT u,'registry-identity',p_canonical,version,ARRAY['names','aliases','canonical_id'],jsonb_build_object('before',g->'people','canonical_id',p_canonical,'name',p_name,'sources',sources,'references',g->'references','reference_ids_before',before_refs)::text FROM public.schedule_people WHERE id=p_canonical;
 result:=jsonb_build_object('person_id',p_canonical,'name',p_name,'retired_ids',sources);
 SET CONSTRAINTS ALL IMMEDIATE;INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,sig,result,now());RETURN result;
END $$;

-- Impede reutilizar cadastros consolidados ou criar referências novas para IDs aposentados.
CREATE FUNCTION iasdpi_schedule_private.identity_person_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 IF OLD.merged_into IS NOT NULL AND NOT (pg_trigger_depth()>1 AND NEW.name=OLD.name AND NEW.merged_into=OLD.merged_into AND NOT NEW.active) THEN RAISE EXCEPTION 'Cadastro consolidado. Utilize o identificador principal.' USING errcode='23514';END IF;
 IF NEW.name IS DISTINCT FROM OLD.name OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
 u:=iasdpi_schedule_private.actor();INSERT INTO iasdpi_schedule_private.person_aliases(person_id,alias,created_by)
 SELECT coalesce(NEW.merged_into,NEW.id),x,u FROM unnest(ARRAY[OLD.name,OLD.display_name]) x ON CONFLICT DO NOTHING;
 END IF;RETURN NEW;
END $$;
CREATE FUNCTION iasdpi_schedule_private.identity_display_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.merged_into IS NULL AND NEW.display_name IS DISTINCT FROM OLD.display_name THEN UPDATE public.schedule_people SET display_name=NEW.display_name,version=version+1,updated_at=now() WHERE merged_into=NEW.id;END IF;RETURN NULL;END $$;
CREATE TRIGGER identity_person_guard BEFORE UPDATE ON public.schedule_people FOR EACH ROW EXECUTE FUNCTION iasdpi_schedule_private.identity_person_guard();
CREATE TRIGGER identity_display_sync AFTER UPDATE OF display_name ON public.schedule_people FOR EACH ROW EXECUTE FUNCTION iasdpi_schedule_private.identity_display_sync();
CREATE FUNCTION iasdpi_schedule_private.identity_reference_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.person_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.schedule_people WHERE id=NEW.person_id AND merged_into IS NOT NULL) THEN RAISE EXCEPTION 'Pessoa consolidada. Recarregue o cadastro central.' USING errcode='23514';END IF;RETURN NEW;END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_memberships','schedule_availability','schedule_assignments','schedule_day_exceptions','schedule_legacy_commitments','schedule_elder_periods','schedule_source_links'] LOOP
 EXECUTE format('CREATE TRIGGER identity_reference_guard BEFORE INSERT OR UPDATE OF person_id ON public.%I FOR EACH ROW EXECUTE FUNCTION iasdpi_schedule_private.identity_reference_guard()',t);END LOOP;
END $$;

-- A RPC antiga também respeita o cadastro central: identidade só por admin.
ALTER FUNCTION public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid) SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid) RENAME TO save_g83;
CREATE FUNCTION public.iasdpi_schedule_save(p_entity text,p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;BEGIN
 IF p_entity='person' THEN
 u:=iasdpi_schedule_private.actor();UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;u:=iasdpi_schedule_private.actor();
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Identidade central administrada pela igreja. Edite somente os vínculos autorizados.' USING errcode='42501';END IF;END IF;
 RETURN iasdpi_schedule_private.save_g83(p_entity,p_id,p_expected_version,p_data,p_request_id);
END $$;

ALTER FUNCTION public.iasdpi_schedule_catalog() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_schedule_catalog() RENAME TO catalog_g83;
CREATE FUNCTION public.iasdpi_schedule_catalog() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;BEGIN
 c:=iasdpi_schedule_private.catalog_g83();RETURN c||jsonb_build_object('identity_registry',true,'identity_redirects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'canonical_id',p.merged_into,'original_name',p.name)) FROM public.schedule_people p WHERE p.merged_into IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(c->'people') x WHERE (x->>'id')::uuid=p.merged_into)),'[]'),'people',coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(c->'people') x JOIN public.schedule_people p ON p.id=(x->>'id')::uuid WHERE p.merged_into IS NULL),'[]'));END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_registry_people(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();term text;BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.active AND iasdpi_schedule_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 IF p_search IS NULL OR length(p_search)>160 THEN RAISE EXCEPTION 'Pesquisa inválida.' USING errcode='22023';END IF;term:=iasdpi_schedule_private.normal_name(p_search);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'display_name',p.display_name,'active',p.active,'version',p.version,'aliases',coalesce((SELECT jsonb_agg(DISTINCT alias ORDER BY alias) FROM iasdpi_schedule_private.person_aliases WHERE person_id=p.id),'[]')) ORDER BY p.name,p.id)
 FROM public.schedule_people p WHERE p.merged_into IS NULL AND (position(term in p.normalized_name)>0 OR position(term in iasdpi_schedule_private.normal_name(p.display_name))>0 OR EXISTS(SELECT 1 FROM iasdpi_schedule_private.person_aliases a WHERE a.person_id=p.id AND position(term in a.normalized_alias)>0))),'[]');END $$;
CREATE FUNCTION public.iasdpi_registry_audit(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();ids uuid[];BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) OR NOT EXISTS(SELECT 1 FROM public.schedule_people WHERE id=p_person AND merged_into IS NULL) THEN RAISE EXCEPTION 'Histórico cadastral exige administrador da igreja.' USING errcode='42501';END IF;
 SELECT array_agg(id) INTO ids FROM public.schedule_people WHERE id=p_person OR merged_into=p_person;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'actor_id',a.actor_id,'entity',a.entity,'captured_at',a.captured_at,'version',a.version,'changed_fields',a.changed_fields) ORDER BY a.captured_at DESC,a.id)
 FROM iasdpi_schedule_private.audit_logs a WHERE a.entity_id=ANY(ids) OR a.entity_id IN(SELECT id FROM public.schedule_memberships WHERE person_id=p_person)),'[]');END $$;

CREATE OR REPLACE VIEW iasdpi_schedule_private.published_elder_periods WITH(security_invoker=true) AS
 SELECT p.id,p.church_id,p.department_id,p.kind,p.starts_on,p.ends_on,v.version,v.captured_at,
 iasdpi_schedule_private.canonical_person((v.snapshot->>'person_id')::uuid) person_id
 FROM public.schedule_elder_periods p CROSS JOIN LATERAL (
 SELECT x.version,x.captured_at,x.snapshot FROM public.schedule_elder_versions x
 WHERE x.church_id=p.church_id AND x.period_id=p.id AND x.snapshot->>'status'='published'
 ORDER BY x.version DESC LIMIT 1) v;
-- Mantém a versão publicada como compromisso mesmo durante uma revisão em rascunho.
CREATE OR REPLACE VIEW iasdpi_schedule_private.confirmed_days WITH(security_invoker=true) AS
 SELECT iasdpi_schedule_private.canonical_person(a.person_id) person_id,a.department_id,d.day,a.plan_id,a.id assignment_id FROM public.schedule_assignments a
 JOIN public.schedule_plans p ON p.id=a.plan_id AND p.status='published'
 CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) d(day)
 UNION ALL SELECT iasdpi_schedule_private.canonical_person(person_id),department_id,scheduled_on,NULL::uuid,NULL::uuid FROM public.schedule_legacy_commitments
 -- Uma revisão diária privada também não apaga o compromisso ainda público.
 UNION ALL SELECT iasdpi_schedule_private.canonical_person(a.person_id),p.department_id,day,p.id,a.id FROM public.schedule_plans p
 CROSS JOIN LATERAL (SELECT v.snapshot FROM public.schedule_versions v WHERE v.plan_id=p.id AND v.snapshot->>'status'='published' ORDER BY v.version DESC LIMIT 1) v
 CROSS JOIN LATERAL jsonb_array_elements(v.snapshot->'requirements') req
 CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') entry
 CROSS JOIN LATERAL jsonb_populate_record(NULL::public.schedule_assignments,entry||jsonb_build_object('timing_mode',coalesce(entry->>'timing_mode','timed'))) a
 CROSS JOIN LATERAL iasdpi_schedule_private.assignment_days(a) day
 WHERE p.status='draft'
 UNION ALL SELECT p.person_id,p.department_id,d.day::date,NULL::uuid,p.id
 FROM iasdpi_schedule_private.published_elder_periods p
 CROSS JOIN LATERAL generate_series(p.starts_on::timestamp,p.ends_on::timestamp,interval '1 day') d(day) WHERE p.kind='weekly';

CREATE OR REPLACE FUNCTION public.iasdpi_registry_history(p_person uuid,p_department uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_schedule_private.has_capability(u,p_department,'members') OR NOT EXISTS(SELECT 1 FROM public.schedule_memberships WHERE person_id=p_person AND department_id=p_department) THEN RAISE EXCEPTION 'Sem histórico deste vínculo.' USING errcode='42501';END IF;
 RETURN jsonb_build_object('current',coalesce((SELECT jsonb_agg(row ORDER BY row->>'assigned_on' DESC) FROM (
 SELECT jsonb_build_object('assigned_on',e.scheduled_on,'department',d.name,'role',r.name,'status',p.status) row FROM public.schedule_assignments a JOIN public.schedule_requirements req ON req.id=a.requirement_id JOIN public.schedule_roles r ON r.id=req.role_id JOIN public.schedule_departments d ON d.id=a.department_id JOIN public.schedule_events e ON e.id=req.event_id JOIN public.schedule_plans p ON p.id=a.plan_id WHERE a.person_id=p_person AND a.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.scheduled_on,'department',d.name,'role','Função histórica: Pendente de confirmação','status','Histórico manual — original preservado','original_name',l.original_name) FROM public.schedule_legacy_commitments l JOIN public.schedule_departments d ON d.id=l.department_id WHERE l.person_id=p_person AND l.department_id=p_department
 UNION ALL SELECT jsonb_build_object('assigned_on',l.reference->>'starts_on','ends_on',l.reference->>'ends_on','department',d.name,'role','Ancião do Mês · referência histórica','status','Histórico manual — original preservado') FROM public.schedule_source_links l JOIN public.schedule_departments d ON d.id=(l.reference->>'department_id')::uuid WHERE l.person_id=p_person AND d.id=p_department AND l.reference->>'kind'='monthly'
 UNION ALL SELECT jsonb_build_object('assigned_on',x.starts_on,'ends_on',x.ends_on,'department',d.name,'role',CASE x.kind WHEN 'weekly' THEN 'Ancião da Semana' ELSE 'Ancião do Mês' END,'status',x.status) FROM public.schedule_elder_periods x JOIN public.schedule_departments d ON d.id=x.department_id WHERE x.person_id=p_person AND x.department_id=p_department
 ) rows),'[]'),
 'versions',coalesce((SELECT jsonb_agg(row) FROM (
 SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'title','status',v.snapshot->>'status','captured_at',v.captured_at) row FROM public.schedule_versions v JOIN public.schedule_plans p ON p.id=v.plan_id WHERE p.department_id=p_department AND EXISTS(SELECT 1 FROM jsonb_array_elements(v.snapshot->'requirements') req CROSS JOIN LATERAL jsonb_array_elements(req->'assignments') a WHERE iasdpi_schedule_private.canonical_person((a->>'person_id')::uuid)=p_person)
 UNION ALL SELECT jsonb_build_object('version',v.version,'title',v.snapshot->>'kind','status',v.snapshot->>'status','captured_at',v.captured_at) FROM public.schedule_elder_versions v JOIN public.schedule_elder_periods p ON p.id=v.period_id WHERE p.department_id=p_department AND iasdpi_schedule_private.canonical_person((v.snapshot->>'person_id')::uuid)=p_person
 ) rows),'[]'));
END $$;


-- Projeção pública estritamente das equivalências que a liderança confirmou;
-- nunca enumera contatos, apelidos de login ou nomes privados de outras pessoas.
ALTER FUNCTION public.iasdpi_registry_public() SET SCHEMA iasdpi_schedule_private;
ALTER FUNCTION iasdpi_schedule_private.iasdpi_registry_public() RENAME TO public_g83;
CREATE FUNCTION public.iasdpi_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE c jsonb;names jsonb;BEGIN
 c:=iasdpi_schedule_private.public_g83();names:=coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('alias',a.alias,'name',p.display_name,'department',a.scope))
 FROM iasdpi_schedule_private.person_aliases a JOIN public.schedule_people p ON p.id=a.person_id AND p.merged_into IS NULL
 WHERE public.iasdpi_current_church_id()='1a5d0000-0000-4000-8000-000000000001'::uuid AND EXISTS(SELECT 1 FROM jsonb_array_elements(iasdpi_schedule_private.confirmed_person_names()) r CROSS JOIN LATERAL jsonb_array_elements_text(r->'aliases') n WHERE iasdpi_schedule_private.normal_name(n)=a.normalized_alias AND coalesce(r->>'department','')=a.scope)),'[]');RETURN c||CASE WHEN jsonb_array_length(names)>0 THEN jsonb_build_object('confirmed_names',names) ELSE '{}'::jsonb END;END $$;

GRANT CREATE ON SCHEMA public,iasdpi_schedule_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure::text sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
 (n.nspname='public' AND p.proname IN('iasdpi_registry_identity_preview','iasdpi_registry_identity_apply','iasdpi_registry_audit','iasdpi_registry_people','iasdpi_schedule_catalog','iasdpi_schedule_save','iasdpi_registry_history','iasdpi_registry_public')) OR
 (n.nspname='iasdpi_schedule_private' AND p.proname IN('canonical_person','confirmed_person_names','identity_group','identity_person_guard','identity_display_sync','identity_reference_guard','catalog_g83','save_g83','public_g83')) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;IF f.proname='iasdpi_registry_public' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_schedule_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
