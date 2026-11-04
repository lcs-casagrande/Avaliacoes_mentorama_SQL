-- G2: apelidos individuais sobre Supabase Auth. Requer 011/G1.
-- REVISAR. Não cria contas, senhas nem concede permissões a líderes.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('public.iasdpi_churches') IS NULL
 OR to_regclass('iasdpi_admin_private.auth_accounts') IS NULL THEN
  RAISE EXCEPTION 'Executar como postgres após homologar 011/G1.';
 END IF;
 IF to_regclass('iasdpi_admin_private.login_aliases') IS NOT NULL THEN RAISE EXCEPTION 'G2 já existe; revisar, sem sobrescrever.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN RAISE EXCEPTION 'Papel de servidor service_role necessário.'; END IF;
END $$;
CREATE TABLE iasdpi_admin_private.login_aliases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 church_id uuid NOT NULL DEFAULT public.iasdpi_current_church_id() REFERENCES public.iasdpi_churches(id),
 identifier text NOT NULL CHECK(identifier ~ '^[a-z][a-z0-9._-]{2,63}$'),
 user_id uuid REFERENCES auth.users(id),
 enabled boolean NOT NULL DEFAULT false CHECK(NOT enabled OR user_id IS NOT NULL),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id),
 UNIQUE(church_id,identifier)
);
CREATE INDEX login_aliases_identity ON iasdpi_admin_private.login_aliases(church_id,user_id);
ALTER TABLE iasdpi_admin_private.login_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_admin_private.login_aliases FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON iasdpi_admin_private.login_aliases TO iasdpi_church_executor;
CREATE POLICY church_boundary ON iasdpi_admin_private.login_aliases AS RESTRICTIVE FOR ALL TO public
 USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE POLICY church_executor ON iasdpi_admin_private.login_aliases FOR ALL TO iasdpi_church_executor
 USING(church_id=public.iasdpi_current_church_id()) WITH CHECK(church_id=public.iasdpi_current_church_id());
CREATE TRIGGER church_immutable BEFORE UPDATE OF church_id ON iasdpi_admin_private.login_aliases
 FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.immutable_church();
-- Reservas desativadas: nenhuma identidade ou senha é inventada.
INSERT INTO iasdpi_admin_private.login_aliases(church_id,identifier)
 SELECT c.id,a FROM public.iasdpi_churches c CROSS JOIN unnest(ARRAY['administrador','anciaos','sonoplastia','musica','diaconato','comunicacao']) a
 WHERE c.code='IASD_PI';

CREATE FUNCTION iasdpi_admin_private.alias_identity_allowed(p_user uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE allowed boolean; BEGIN
 IF p_user IS NULL OR NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=p_user AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user AND NOT enabled) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user AND enabled AND role IN ('admin','leader')) THEN RETURN true; END IF;
 IF to_regclass('public.schedule_department_access') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.schedule_department_access a JOIN public.schedule_departments d ON d.id=a.department_id WHERE a.user_id=$1 AND a.enabled AND d.active)
  OR EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id JOIN public.schedule_departments d ON d.id=m.department_id WHERE p.auth_user_id=$1 AND p.active AND m.active AND d.active)' INTO allowed USING p_user;
  RETURN allowed;
 END IF;
 RETURN false;
END $$;
CREATE FUNCTION public.iasdpi_alias_identifier(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 WITH candidate AS (SELECT nullif(left(trim(both '-' from regexp_replace(translate(lower(btrim(p_name)),
 'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),'[^a-z0-9]+','-','g')),64),'') AS slug)
 SELECT CASE WHEN slug IS NULL THEN NULL WHEN slug !~ '^[a-z]' OR length(slug)<3 THEN left('ministerio-'||slug,64) ELSE slug END FROM candidate;
$$;
CREATE FUNCTION public.iasdpi_alias_list() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM iasdpi_admin_private.require_admin();
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'identifier',identifier,'user_id',user_id,'enabled',enabled,'version',version) ORDER BY identifier) FROM iasdpi_admin_private.login_aliases),'[]'::jsonb);
END $$;
CREATE FUNCTION public.iasdpi_alias_save(p_identifier text,p_user_id uuid,p_enabled boolean,p_expected_version bigint,p_reason text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; old iasdpi_admin_private.login_aliases; result iasdpi_admin_private.login_aliases;
BEGIN
 actor:=iasdpi_admin_private.lock_admin();p_identifier:=lower(btrim(p_identifier));
 IF p_identifier IS NULL OR p_identifier !~ '^[a-z][a-z0-9._-]{2,63}$' OR p_expected_version IS NULL OR p_expected_version<0 OR p_enabled IS NULL OR (p_enabled AND p_user_id IS NULL) THEN RAISE EXCEPTION 'Identificador ou vínculo inválido.' USING errcode='22023'; END IF;
 IF p_user_id IS NOT NULL AND NOT iasdpi_admin_private.alias_identity_allowed(p_user_id) THEN RAISE EXCEPTION 'Autorize previamente esta identidade na igreja; apelidos não concedem acesso.' USING errcode='42501'; END IF;
 SELECT * INTO old FROM iasdpi_admin_private.login_aliases WHERE identifier=p_identifier FOR UPDATE;
 IF coalesce(old.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Apelido alterado. Recarregue antes de continuar.' USING errcode='40001'; END IF;
 IF old.user_id IS NOT NULL AND old.user_id IS DISTINCT FROM p_user_id AND coalesce(length(btrim(p_reason)),0)<10 THEN RAISE EXCEPTION 'Justifique a mudança de identidade do apelido.' USING errcode='22023'; END IF;
 IF old.id IS NULL THEN
  INSERT INTO iasdpi_admin_private.login_aliases(identifier,user_id,enabled,updated_by) VALUES(p_identifier,p_user_id,p_enabled,actor) RETURNING * INTO result;
 ELSE
  UPDATE iasdpi_admin_private.login_aliases SET user_id=p_user_id,enabled=p_enabled,version=version+1,updated_at=now(),updated_by=actor WHERE id=old.id RETURNING * INTO result;
 END IF;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(actor,'alias_binding',p_user_id,jsonb_build_object('alias_id',result.id,'version',result.version,'previous_user_id',old.user_id,'enabled',p_enabled,'reason',left(p_reason,500)));
 RETURN jsonb_build_object('id',result.id,'identifier',result.identifier,'user_id',result.user_id,'enabled',result.enabled,'version',result.version);
END $$;
-- Resolução PRIVADA de servidor. Sem EXECUTE para clientes ou usuários admin.
CREATE FUNCTION public.iasdpi_alias_login_lookup(p_identifier text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor necessário.' USING errcode='42501'; END IF;
 RETURN (SELECT jsonb_build_object('alias_id',a.id,'user_id',a.user_id,'email',u.email,'version',a.version)
 FROM iasdpi_admin_private.login_aliases a JOIN iasdpi_admin_private.auth_accounts u ON u.id=a.user_id
 WHERE a.identifier=lower(btrim(p_identifier)) AND a.enabled AND u.email IS NOT NULL AND iasdpi_admin_private.alias_identity_allowed(a.user_id));
END $$;
CREATE FUNCTION public.iasdpi_alias_login_confirm(p_alias_id uuid,p_version bigint,p_user_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor necessário.' USING errcode='42501'; END IF;
 RETURN EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE id=p_alias_id AND version=p_version AND user_id=p_user_id AND enabled AND iasdpi_admin_private.alias_identity_allowed(p_user_id));
END $$;

-- Contadores globais de abuso, sem e-mails, apelidos, IPs ou senhas em claro.
-- Não são dados ministeriais: buckets HMAC privados, expiram em 15 minutos.
CREATE SCHEMA iasdpi_login_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA iasdpi_login_private FROM public,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA iasdpi_login_private TO iasdpi_church_executor;
CREATE TABLE iasdpi_login_private.budgets (
 bucket text NOT NULL CHECK(bucket='global' OR bucket ~ '^(church|alias|identity|ip):[0-9a-f]{64}$'),
 window_at timestamptz NOT NULL,attempts bigint NOT NULL CHECK(attempts>0),PRIMARY KEY(bucket,window_at)
);
ALTER TABLE iasdpi_login_private.budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON iasdpi_login_private.budgets FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON iasdpi_login_private.budgets TO iasdpi_church_executor;
CREATE POLICY backend_only ON iasdpi_login_private.budgets FOR ALL TO iasdpi_church_executor USING(true) WITH CHECK(true);
CREATE FUNCTION public.iasdpi_alias_login_limit(p_keys text[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text; cap integer; count_now bigint; minute_at timestamptz:=date_trunc('minute',clock_timestamp()); BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Servidor necessário.' USING errcode='42501'; END IF;
 IF p_keys IS NULL OR cardinality(p_keys) NOT BETWEEN 1 AND 5 OR EXISTS(SELECT 1 FROM unnest(p_keys) key WHERE key IS NULL OR (key<>'global' AND key !~ '^(church|alias|identity|ip):[0-9a-f]{64}$')) THEN RAISE EXCEPTION 'Buckets inválidos.' USING errcode='22023'; END IF;
 FOR k IN SELECT key FROM (SELECT DISTINCT key FROM unnest(p_keys) key) keys ORDER BY CASE WHEN key='global' THEN 0 ELSE 1 END,key LOOP
  cap:=CASE split_part(k,':',1) WHEN 'global' THEN 300 WHEN 'church' THEN 120 WHEN 'ip' THEN 30 ELSE 5 END;
  INSERT INTO iasdpi_login_private.budgets(bucket,window_at,attempts) VALUES(k,minute_at,1)
   ON CONFLICT(bucket,window_at) DO UPDATE SET attempts=budgets.attempts+1 RETURNING attempts INTO count_now;
  IF count_now>cap THEN RETURN false; END IF;
 END LOOP;
 DELETE FROM iasdpi_login_private.budgets WHERE window_at<minute_at-interval '15 minutes';
 RETURN true;
END $$;
-- Novo owner precisa de CREATE apenas durante transferência, nunca após commit.
GRANT CREATE ON SCHEMA public,iasdpi_admin_private TO iasdpi_church_executor;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY[
 'iasdpi_admin_private.alias_identity_allowed(uuid)'::regprocedure,
 'public.iasdpi_alias_identifier(text)'::regprocedure,'public.iasdpi_alias_list()'::regprocedure,
 'public.iasdpi_alias_save(text,uuid,boolean,bigint,text)'::regprocedure,
 'public.iasdpi_alias_login_lookup(text)'::regprocedure,'public.iasdpi_alias_login_confirm(uuid,bigint,uuid)'::regprocedure,
 'public.iasdpi_alias_login_limit(text[])'::regprocedure] LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f);
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_admin_private FROM iasdpi_church_executor;
GRANT EXECUTE ON FUNCTION public.iasdpi_alias_identifier(text),public.iasdpi_alias_list(),public.iasdpi_alias_save(text,uuid,boolean,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.iasdpi_alias_login_lookup(text),public.iasdpi_alias_login_confirm(uuid,bigint,uuid),public.iasdpi_alias_login_limit(text[]) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
