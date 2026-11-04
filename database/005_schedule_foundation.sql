-- IASDPI: Fase A. Revisar antes de executar como postgres; não importa escalas.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres' OR to_regclass('iasdpi_operational_private.receipts') IS NULL
 OR to_regprocedure('public.iasdpi_list_trash(integer)') IS NULL THEN
   RAISE EXCEPTION 'Execute 001–004 antes da 005, usando postgres.';
 END IF;
END $$;
CREATE SCHEMA iasdpi_schedule_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA iasdpi_schedule_private REVOKE EXECUTE ON FUNCTIONS FROM public;

CREATE FUNCTION iasdpi_schedule_private.normal_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(translate(lower(btrim(value)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '\s+', ' ', 'g');
$$;
CREATE TABLE public.schedule_departments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(code ~ '^[a-z][a-z0-9-]{1,59}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 normalized_name text GENERATED ALWAYS AS (iasdpi_schedule_private.normal_name(name)) STORED UNIQUE, active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.schedule_people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 display_name text NOT NULL CHECK(length(btrim(display_name)) BETWEEN 2 AND 160),
 normalized_name text GENERATED ALWAYS AS (iasdpi_schedule_private.normal_name(name)) STORED,
 auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX schedule_people_name_idx ON public.schedule_people(normalized_name);
CREATE TABLE public.schedule_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES public.schedule_people(id),
 department_id uuid NOT NULL REFERENCES public.schedule_departments(id), active boolean NOT NULL DEFAULT true,
 is_ministry_head boolean NOT NULL DEFAULT false,
 desired_monthly_count integer CHECK(desired_monthly_count BETWEEN 0 AND 100),
 max_monthly_count integer CHECK(max_monthly_count BETWEEN 0 AND 100),
 max_consecutive integer CHECK(max_consecutive BETWEEN 1 AND 100),
 preferences text NOT NULL DEFAULT '' CHECK(length(preferences)<=2000),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(person_id,department_id), UNIQUE(id,department_id),
 CHECK(desired_monthly_count IS NULL OR max_monthly_count IS NULL OR desired_monthly_count<=max_monthly_count)
);
CREATE INDEX schedule_memberships_department_idx ON public.schedule_memberships(department_id,person_id);
CREATE TABLE public.schedule_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_id uuid NOT NULL REFERENCES public.schedule_departments(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 120),
 normalized_name text GENERATED ALWAYS AS (iasdpi_schedule_private.normal_name(name)) STORED,
 description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 default_required_count integer CHECK(default_required_count BETWEEN 0 AND 100),
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(department_id,normalized_name), UNIQUE(id,department_id)
);
CREATE TABLE public.schedule_qualifications (
 membership_id uuid NOT NULL, role_id uuid NOT NULL, department_id uuid NOT NULL,
 PRIMARY KEY(membership_id,role_id),
 FOREIGN KEY(membership_id,department_id) REFERENCES public.schedule_memberships(id,department_id),
 FOREIGN KEY(role_id,department_id) REFERENCES public.schedule_roles(id,department_id)
);
CREATE FUNCTION iasdpi_schedule_private.valid_weekdays(days smallint[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT cardinality(days) BETWEEN 1 AND 7 AND NOT EXISTS(SELECT 1 FROM unnest(days) d WHERE d IS NULL OR d<0 OR d>6)
 AND cardinality(days)=(SELECT count(DISTINCT d) FROM unnest(days) d);
$$;
CREATE TABLE public.schedule_availability (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES public.schedule_people(id),
 department_id uuid REFERENCES public.schedule_departments(id),
 kind text NOT NULL CHECK(kind IN ('available','unavailable')), pattern text NOT NULL CHECK(pattern IN ('period','weekly')),
 starts_on date, ends_on date, weekdays smallint[], valid_from date, valid_until date,
 start_time time(0), end_time time(0), active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(person_id,department_id) REFERENCES public.schedule_memberships(person_id,department_id),
 CHECK((start_time IS NULL)=(end_time IS NULL)),
 CHECK((pattern='period' AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on>=starts_on AND weekdays IS NULL AND valid_from IS NULL AND valid_until IS NULL
        AND (start_time IS NULL OR (ends_on+end_time)>(starts_on+start_time)))
 OR (pattern='weekly' AND starts_on IS NULL AND ends_on IS NULL AND weekdays IS NOT NULL
     AND iasdpi_schedule_private.valid_weekdays(weekdays) AND (valid_until IS NULL OR valid_from IS NULL OR valid_until>=valid_from)
     AND (start_time IS NULL OR end_time>start_time)))
);
CREATE INDEX schedule_availability_person_idx ON public.schedule_availability(person_id,department_id);
CREATE TABLE public.schedule_department_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_id uuid NOT NULL REFERENCES public.schedule_departments(id),
 user_id uuid NOT NULL REFERENCES auth.users(id), access_level text NOT NULL CHECK(access_level IN ('manager','viewer')),
 enabled boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(department_id,user_id)
);
CREATE INDEX schedule_department_access_user_idx ON public.schedule_department_access(user_id,enabled);
CREATE TABLE iasdpi_schedule_private.person_details (
 person_id uuid PRIMARY KEY REFERENCES public.schedule_people(id),
 contact text NOT NULL DEFAULT '' CHECK(length(contact)<=1000), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=4000)
);
CREATE TABLE iasdpi_schedule_private.audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES auth.users(id),
 entity text NOT NULL, entity_id uuid NOT NULL, department_id uuid REFERENCES public.schedule_departments(id),
 version bigint NOT NULL, changed_fields text[] NOT NULL, reason text,
 captured_at timestamptz NOT NULL DEFAULT now()
);
-- Nenhuma política permissiva: acesso somente pelas RPCs abaixo, verificando identidade e escopo.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['schedule_departments','schedule_people','schedule_memberships','schedule_roles','schedule_qualifications','schedule_availability','schedule_department_access'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM public,anon,authenticated',t);
 END LOOP;
END $$;
ALTER TABLE iasdpi_schedule_private.person_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE iasdpi_schedule_private.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;

CREATE FUNCTION iasdpi_schedule_private.actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); BEGIN
 IF u IS NULL OR auth.jwt()->>'is_anonymous'='true'
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL AND NOT is_anonymous)
 OR EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=u AND NOT enabled) THEN
   RAISE EXCEPTION 'Conta confirmada e acesso ativo necessários.' USING errcode='42501';
 END IF;
 RETURN u;
END $$;
CREATE FUNCTION iasdpi_schedule_private.is_admin(u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=u AND enabled AND role='admin');
$$;
CREATE FUNCTION iasdpi_schedule_private.can_manage(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_departments dep ON dep.id=a.department_id
 WHERE a.user_id=u AND a.department_id=d AND a.enabled AND a.access_level='manager' AND dep.active);
$$;
CREATE FUNCTION iasdpi_schedule_private.can_view(u uuid,d uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR EXISTS(
 SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_departments dep ON dep.id=a.department_id
 WHERE a.user_id=u AND a.department_id=d AND a.enabled AND dep.active)
 OR EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id
 JOIN public.schedule_departments dep ON dep.id=m.department_id
 WHERE p.auth_user_id=u AND p.active AND m.active AND m.department_id=d AND dep.active);
$$;
CREATE FUNCTION iasdpi_schedule_private.can_see_person(u uuid,p uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT iasdpi_schedule_private.is_admin(u) OR EXISTS(SELECT 1 FROM public.schedule_people WHERE id=p AND auth_user_id=u AND active)
 OR EXISTS(SELECT 1 FROM public.schedule_memberships m JOIN public.schedule_department_access a ON a.department_id=m.department_id
 JOIN public.schedule_departments d ON d.id=a.department_id
 WHERE m.person_id=p AND a.user_id=u AND a.enabled AND d.active);
$$;
CREATE FUNCTION public.iasdpi_schedule_catalog() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor(); a boolean:=iasdpi_schedule_private.is_admin(u); result jsonb; BEGIN
 IF NOT a AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE iasdpi_schedule_private.can_view(u,d.id)) THEN
   RAISE EXCEPTION 'Solicite acesso a um departamento ao administrador.' USING errcode='42501';
 END IF;
 SELECT jsonb_build_object('actor_id',u,'is_admin',a,
 'departments',coalesce((SELECT jsonb_agg((to_jsonb(d)-'normalized_name')||jsonb_build_object('can_manage',iasdpi_schedule_private.can_manage(u,d.id),'can_roster',
 a OR EXISTS(SELECT 1 FROM public.schedule_department_access acl WHERE acl.department_id=d.id AND acl.user_id=u AND acl.enabled)))
 FROM public.schedule_departments d WHERE iasdpi_schedule_private.can_view(u,d.id)),'[]'::jsonb),
 'people',coalesce((SELECT jsonb_agg(to_jsonb(p)-'normalized_name'-'auth_user_id') FROM public.schedule_people p WHERE iasdpi_schedule_private.can_see_person(u,p.id)),'[]'::jsonb),
 'memberships',coalesce((SELECT jsonb_agg(CASE WHEN iasdpi_schedule_private.can_manage(u,m.department_id) OR EXISTS(SELECT 1 FROM public.schedule_people p WHERE p.id=m.person_id AND p.auth_user_id=u AND p.active)
 THEN to_jsonb(m) ELSE to_jsonb(m)-'preferences'-'desired_monthly_count'-'max_monthly_count'-'max_consecutive' END)
 FROM public.schedule_memberships m WHERE iasdpi_schedule_private.can_view(u,m.department_id) AND iasdpi_schedule_private.can_see_person(u,m.person_id)),'[]'::jsonb),
 'roles',coalesce((SELECT jsonb_agg(to_jsonb(r)-'normalized_name') FROM public.schedule_roles r WHERE iasdpi_schedule_private.can_view(u,r.department_id)),'[]'::jsonb),
 'qualifications',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM public.schedule_qualifications q JOIN public.schedule_memberships m ON m.id=q.membership_id
 WHERE iasdpi_schedule_private.can_view(u,q.department_id) AND iasdpi_schedule_private.can_see_person(u,m.person_id)),'[]'::jsonb),
 'availability',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.schedule_availability v WHERE iasdpi_schedule_private.can_see_person(u,v.person_id) AND
 (a OR (v.department_id IS NOT NULL AND iasdpi_schedule_private.can_manage(u,v.department_id)) OR EXISTS(SELECT 1 FROM public.schedule_people p WHERE p.id=v.person_id AND p.auth_user_id=u AND p.active))), '[]'::jsonb),
 'access',CASE WHEN a THEN coalesce((SELECT jsonb_agg(to_jsonb(acl)) FROM public.schedule_department_access acl),'[]'::jsonb) ELSE '[]'::jsonb END) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.iasdpi_schedule_person_details(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=iasdpi_schedule_private.actor(); BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) THEN RAISE EXCEPTION 'Somente administrador.' USING errcode='42501'; END IF;
 RETURN (SELECT jsonb_build_object('auth_user_id',p.auth_user_id,'contact',coalesce(d.contact,''),'notes',coalesce(d.notes,''))
 FROM public.schedule_people p LEFT JOIN iasdpi_schedule_private.person_details d ON d.person_id=p.id WHERE p.id=p_id);
END $$;

CREATE FUNCTION public.iasdpi_schedule_save(p_entity text,p_id uuid,p_expected_version bigint,p_data jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; admin boolean; tab text; permitted text[]; oldrow jsonb; patch jsonb:=p_data;
 d uuid; person uuid; columns text; values_sql text; assignments text; result jsonb; signature text;
 receipt iasdpi_operational_private.receipts; new_version bigint; roles jsonb; role_id uuid;
BEGIN
 u:=iasdpi_schedule_private.actor();
 -- Serializa mutações e revogações; REPEATABLE READ/SERIALIZABLE falha com 40001 em disputa.
 UPDATE iasdpi_admin_private.control SET revision=revision+1 WHERE singleton;
 u:=iasdpi_schedule_private.actor(); admin:=iasdpi_schedule_private.is_admin(u);
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR pg_column_size(p_data)>24000 THEN
   RAISE EXCEPTION 'Identificador, versão ou dados inválidos.' USING errcode='22023'; END IF;
 CASE p_entity
 WHEN 'department' THEN tab:='schedule_departments'; permitted:=ARRAY['code','name','active'];
 WHEN 'person' THEN tab:='schedule_people'; permitted:=ARRAY['name','display_name','auth_user_id','active','department_id','contact','notes','confirm_homonym','reason'];
 WHEN 'membership' THEN tab:='schedule_memberships'; permitted:=ARRAY['person_id','department_id','active','is_ministry_head','desired_monthly_count','max_monthly_count','max_consecutive','preferences','role_ids'];
 WHEN 'role' THEN tab:='schedule_roles'; permitted:=ARRAY['department_id','name','description','default_required_count','active'];
 WHEN 'availability' THEN tab:='schedule_availability'; permitted:=ARRAY['person_id','department_id','kind','pattern','starts_on','ends_on','weekdays','valid_from','valid_until','start_time','end_time','active'];
 WHEN 'access' THEN tab:='schedule_department_access'; permitted:=ARRAY['department_id','user_id','access_level','enabled'];
 ELSE RAISE EXCEPTION 'Cadastro desconhecido.' USING errcode='22023'; END CASE;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(permitted)) THEN RAISE EXCEPTION 'Campo não permitido.' USING errcode='22023'; END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',tab) INTO oldrow USING p_id;
 IF p_entity IN ('department','access') AND NOT admin THEN RAISE EXCEPTION 'Somente administrador.' USING errcode='42501'; END IF;
 d:=CASE WHEN oldrow IS NOT NULL AND p_entity<>'person' THEN (oldrow->>'department_id')::uuid ELSE (p_data->>'department_id')::uuid END;
 IF oldrow IS NOT NULL AND ((p_data ? 'department_id' AND (p_data->>'department_id')::uuid IS DISTINCT FROM d)
 OR (p_data ? 'person_id' AND p_data->>'person_id' IS DISTINCT FROM oldrow->>'person_id')
 OR (p_data ? 'user_id' AND p_data->>'user_id' IS DISTINCT FROM oldrow->>'user_id')) THEN
   RAISE EXCEPTION 'O vínculo existente não pode ser transferido; inative-o e cadastre outro.' USING errcode='22023'; END IF;
 IF p_entity NOT IN ('department','access') AND NOT admin AND NOT iasdpi_schedule_private.can_manage(u,d) THEN
   RAISE EXCEPTION 'Sem gestão deste departamento.' USING errcode='42501'; END IF;
 person:=coalesce((oldrow->>'person_id')::uuid,(p_data->>'person_id')::uuid);
 IF p_entity IN ('membership','availability') AND NOT admin AND NOT iasdpi_schedule_private.can_see_person(u,person) THEN
   RAISE EXCEPTION 'Pessoa fora do cadastro autorizado; solicite vínculo ao administrador.' USING errcode='42501'; END IF;
 IF p_entity='access' AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=(coalesce(oldrow,p_data)->>'user_id')::uuid AND email_confirmed_at IS NOT NULL AND NOT is_anonymous) THEN
   RAISE EXCEPTION 'A conta deve existir e ter e-mail confirmado.' USING errcode='22023'; END IF;
 IF p_entity='person' AND p_data->>'auth_user_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=(p_data->>'auth_user_id')::uuid AND email_confirmed_at IS NOT NULL AND NOT is_anonymous) THEN
   RAISE EXCEPTION 'Vincule somente uma conta existente e confirmada.' USING errcode='22023'; END IF;
 signature:='schedule-foundation:'||iasdpi_operational_private.fingerprint(jsonb_build_object('module','schedule-foundation','entity',p_entity,'id',p_id,'expected',p_expected_version,'data',p_data));
 SELECT * INTO receipt FROM iasdpi_operational_private.receipts WHERE request_id=p_request_id;
 IF FOUND THEN
   IF receipt.actor_id<>u OR receipt.signature<>signature THEN RAISE EXCEPTION 'Solicitação já utilizada.' USING errcode='22023'; END IF;
   RETURN receipt.response;
 END IF;
 IF p_entity='person' AND NOT admin AND (oldrow IS NOT NULL OR p_data ?| ARRAY['auth_user_id','contact','notes','confirm_homonym','reason']) THEN
   RAISE EXCEPTION 'Identidade e dados privados são administrados centralmente.' USING errcode='42501'; END IF;
 IF p_entity='person' AND oldrow IS NOT NULL AND p_data ? 'department_id' THEN RAISE EXCEPTION 'Altere departamentos pelo cadastro de vínculos.' USING errcode='22023'; END IF;
 IF (oldrow IS NULL AND p_expected_version<>0) OR (oldrow IS NOT NULL AND (oldrow->>'version')::bigint<>p_expected_version) THEN
   RAISE EXCEPTION 'Este cadastro mudou em outro dispositivo. Recarregue antes de reaplicar suas alterações.' USING errcode='40001'; END IF;
 IF p_entity='person' THEN
   IF (oldrow IS NULL OR (p_data ? 'name' AND p_data->>'name' IS DISTINCT FROM oldrow->>'name')) AND EXISTS(SELECT 1 FROM public.schedule_people WHERE id<>p_id AND normalized_name=iasdpi_schedule_private.normal_name(coalesce(p_data->>'name',oldrow->>'name')))
      AND NOT (admin AND coalesce((p_data->>'confirm_homonym')::boolean,false) AND length(btrim(p_data->>'reason'))>=10) THEN
     RAISE EXCEPTION 'Já existe um nome igual. Reutilize o cadastro ou peça ao administrador para confirmar um homônimo com justificativa.' USING errcode='23514'; END IF;
   IF p_data ? 'contact' OR p_data ? 'notes' THEN
     INSERT INTO iasdpi_schedule_private.person_details(person_id,contact,notes)
       SELECT p_id,'','' WHERE oldrow IS NOT NULL ON CONFLICT DO NOTHING;
     -- Para criação, inserir detalhes após a identidade.
   END IF;
   patch:=patch-ARRAY['department_id','contact','notes','confirm_homonym','reason'];
 END IF;
 IF p_entity='membership' AND p_data ? 'role_ids' THEN
   roles:=p_data->'role_ids'; patch:=patch-'role_ids';
   IF jsonb_typeof(roles) IS DISTINCT FROM 'array' OR jsonb_array_length(roles)>100 THEN RAISE EXCEPTION 'Habilitações inválidas.' USING errcode='22023'; END IF;
 END IF;
 new_version:=coalesce((oldrow->>'version')::bigint,0)+1;
 patch:=patch||jsonb_build_object('id',p_id,'version',new_version,'updated_at',now());
 SELECT string_agg(format('%I',k),','),string_agg(format('p.%I',k),','),string_agg(format('%I=p.%I',k,k),',')
 INTO columns,values_sql,assignments FROM jsonb_object_keys(patch) k;
 IF oldrow IS NULL THEN
   EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) p RETURNING to_jsonb(%I.*)',tab,columns,values_sql,tab,tab) INTO result USING patch;
 ELSE
   EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) p WHERE t.id=$2 RETURNING to_jsonb(t.*)',tab,assignments,tab) INTO result USING oldrow||patch,p_id;
 END IF;
 IF p_entity='person' THEN
   IF p_data ? 'contact' OR p_data ? 'notes' THEN
     INSERT INTO iasdpi_schedule_private.person_details(person_id,contact,notes) VALUES(p_id,coalesce(p_data->>'contact',''),coalesce(p_data->>'notes',''))
     ON CONFLICT(person_id) DO UPDATE SET contact=CASE WHEN p_data ? 'contact' THEN coalesce(p_data->>'contact','') ELSE person_details.contact END,
       notes=CASE WHEN p_data ? 'notes' THEN coalesce(p_data->>'notes','') ELSE person_details.notes END;
   END IF;
   IF oldrow IS NULL AND d IS NOT NULL THEN
     INSERT INTO public.schedule_memberships(person_id,department_id) VALUES(p_id,d);
   END IF;
 END IF;
 IF roles IS NOT NULL THEN
   DELETE FROM public.schedule_qualifications WHERE membership_id=p_id;
   FOR role_id IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(roles) LOOP
     INSERT INTO public.schedule_qualifications(membership_id,department_id,role_id) VALUES(p_id,d,role_id);
   END LOOP;
 END IF;
 result:=result-ARRAY['normalized_name','auth_user_id'];
 INSERT INTO iasdpi_schedule_private.audit_logs(actor_id,entity,entity_id,department_id,version,changed_fields,reason)
 VALUES(u,p_entity,p_id,d,new_version,ARRAY(SELECT jsonb_object_keys(p_data)),CASE WHEN p_entity='person' THEN p_data->>'reason' END);
 INSERT INTO iasdpi_operational_private.receipts VALUES(p_request_id,u,signature,result,now());
 RETURN result;
END $$;
-- Somente departamentos: nomes no organograma NÃO são contas nem concedem acesso.
INSERT INTO public.schedule_departments(id,code,name) VALUES
 ('a0000000-0000-4000-8000-000000000001','sonoplastia','Sonoplastia'),
 ('a0000000-0000-4000-8000-000000000002','diaconato','Diaconato'),
 ('a0000000-0000-4000-8000-000000000003','musica','Música'),
 ('a0000000-0000-4000-8000-000000000004','ancionato','Ancionato');
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA iasdpi_schedule_private FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.iasdpi_schedule_catalog(),public.iasdpi_schedule_person_details(uuid),public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_schedule_catalog(),public.iasdpi_schedule_person_details(uuid),public.iasdpi_schedule_save(text,uuid,bigint,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
