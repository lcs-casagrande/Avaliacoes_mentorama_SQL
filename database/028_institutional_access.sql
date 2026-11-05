-- G12: REVISÃO OBRIGATÓRIA. Preparada, NÃO executada nesta etapa.
-- Reutiliza aliases, pessoas, ACL, Auth, RLS, versões e recuperação G1–G11.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('iasdpi_admin_private.account_creation_requests') IS NULL
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='iasdpi_admin_private.login_aliases'::regclass AND attname='slot_kind' AND NOT attisdropped) THEN
 RAISE EXCEPTION 'Exige 001–027; não reaplicar 028.';END IF;
END $$;
ALTER TABLE iasdpi_admin_private.login_aliases
 ADD COLUMN slot_kind text CHECK(slot_kind IN('department','position','elder','admin','member')),
 ADD COLUMN slot_label text,
 ADD COLUMN department_id uuid,
 ADD COLUMN slot_person_id uuid,
 ADD COLUMN responsible_person_id uuid,
 ADD COLUMN institutional_scopes uuid[] NOT NULL DEFAULT '{}',
 ADD COLUMN approve_general boolean NOT NULL DEFAULT false,
 ADD COLUMN shared_reader boolean NOT NULL DEFAULT false,
 ADD COLUMN credential_pending boolean NOT NULL DEFAULT false,
 ADD FOREIGN KEY(church_id,department_id) REFERENCES public.schedule_departments(church_id,id),
 ADD FOREIGN KEY(church_id,slot_person_id) REFERENCES public.schedule_people(church_id,id),
 ADD FOREIGN KEY(church_id,responsible_person_id) REFERENCES public.schedule_people(church_id,id),
 ADD CHECK(NOT approve_general OR slot_kind='elder'),
 ADD CHECK(NOT shared_reader OR slot_kind='member');
CREATE UNIQUE INDEX institutional_department_slot ON iasdpi_admin_private.login_aliases(church_id,department_id) WHERE slot_kind='department';
CREATE UNIQUE INDEX institutional_elder_slot ON iasdpi_admin_private.login_aliases(church_id,slot_person_id) WHERE slot_kind='elder';
CREATE INDEX institutional_responsible ON iasdpi_admin_private.login_aliases(church_id,responsible_person_id);

-- Nomes de departamentos já existentes no Organograma, sem pessoas ou habilitações.
-- Correspondências explícitas de código; nada é mesclado por semelhança de nomes.
INSERT INTO public.schedule_departments(church_id,code,name)
 SELECT church.id,CASE item WHEN 'Ministério da Música' THEN 'musica' WHEN 'Ministério da Família' THEN 'ministerio-da-familia' WHEN 'Ministério da Criança' THEN 'ministerio-da-crianca' ELSE public.iasdpi_alias_identifier(item) END,item
 FROM public.iasdpi_churches church CROSS JOIN jsonb_array_elements_text($departments$["Ancionato", "Ação Solidária Adventista (ASA)", "Clube de Aventureiros", "Clube de Desbravadores", "Comunicação", "Escola Sabatina", "Gol da Esperança", "Liberdade Religiosa", "Ministério Adventista das Possibilidades", "Ministério Jovem", "Ministério Pessoal", "Ministério Recuperação", "Ministério da Criança", "Ministério da Família", "Ministério da Mulher", "Ministério da Música", "Ministério da Saúde", "Ministério de Publicações", "Ministério dos Adolescentes", "Ministério dos Homens", "Mordomia Cristã", "Patrimônio", "Recepção", "Secretaria", "Sonoplastia", "Terceira Idade", "Tesouraria"]$departments$::jsonb)item
 WHERE church.code='IASD_PI' AND NOT EXISTS(SELECT 1 FROM public.schedule_departments old WHERE old.church_id=church.id AND (old.code=CASE item WHEN 'Ministério da Música' THEN 'musica' WHEN 'Ministério da Família' THEN 'ministerio-da-familia' WHEN 'Ministério da Criança' THEN 'ministerio-da-crianca' ELSE public.iasdpi_alias_identifier(item) END OR old.name=item));

CREATE FUNCTION iasdpi_admin_private.shared_institutional_reader(u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE user_id=u AND slot_kind='member' AND shared_reader);
$$;
-- Impede promoção por caminhos antigos de concessão, além das validações da tabela.
CREATE FUNCTION iasdpi_admin_private.guard_shared_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF iasdpi_admin_private.shared_institutional_reader(NEW.user_id) AND
 (TG_TABLE_NAME='iasdpi_access' OR coalesce((to_jsonb(NEW)->>'can_edit')::boolean,false)
 OR coalesce((to_jsonb(NEW)->>'can_publish')::boolean,false)
 OR coalesce((to_jsonb(NEW)->>'can_manage_members')::boolean,false)
 OR coalesce((to_jsonb(NEW)->>'can_manage_access')::boolean,false)
 OR coalesce((to_jsonb(NEW)->>'can_handle_requests')::boolean,false)
 OR coalesce((to_jsonb(NEW)->>'can_approve_general_events')::boolean,false)) THEN
 RAISE EXCEPTION 'Conta membro compartilhada não pode receber privilégios de gestão.' USING errcode='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER shared_institutional_guard BEFORE INSERT OR UPDATE ON public.schedule_department_access FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.guard_shared_grant();
CREATE TRIGGER shared_institutional_guard BEFORE INSERT OR UPDATE ON public.iasdpi_access FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.guard_shared_grant();
-- A identidade compartilhada não pode ser reutilizada como conta pessoal ou alias de gestão.
CREATE FUNCTION iasdpi_admin_private.guard_shared_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_TABLE_NAME='schedule_people' THEN
 IF NEW.auth_user_id IS NOT NULL AND iasdpi_admin_private.shared_institutional_reader(NEW.auth_user_id) THEN RAISE EXCEPTION 'Identidade membro compartilhada não pode representar uma pessoa.';END IF;
 ELSE
 IF NEW.user_id IS NOT NULL AND iasdpi_admin_private.shared_institutional_reader(NEW.user_id) AND (NEW.slot_kind IS DISTINCT FROM 'member' OR NOT NEW.shared_reader) THEN RAISE EXCEPTION 'Identidade compartilhada é exclusiva do login membro.';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER shared_identity_guard BEFORE INSERT OR UPDATE ON public.schedule_people FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.guard_shared_identity();
CREATE TRIGGER shared_identity_guard BEFORE INSERT OR UPDATE ON iasdpi_admin_private.login_aliases FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.guard_shared_identity();
-- Responsabilidades ministeriais só podem mudar por administrador, mesmo via editores legados.
CREATE FUNCTION iasdpi_admin_private.guard_institutional_responsibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND NOT iasdpi_schedule_private.is_admin(auth.uid()) AND
 ((TG_OP='INSERT' AND (NEW.is_ministry_head OR coalesce(NEW.leadership_scope,'')<>'')) OR
 (TG_OP='UPDATE' AND (NEW.is_ministry_head,NEW.leadership_scope) IS DISTINCT FROM (OLD.is_ministry_head,OLD.leadership_scope))) THEN
 RAISE EXCEPTION 'Somente administrador altera responsáveis ministeriais.' USING errcode='42501';END IF;RETURN NEW;
END $$;
CREATE TRIGGER institutional_responsibility_guard BEFORE INSERT OR UPDATE ON public.schedule_memberships FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.guard_institutional_responsibility();
-- Diretórios operacionais não são a consulta publicada para membros.
DO $$ DECLARE t record;BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'schedule_%' OR tablename IN('iasdpi_events','iasdpi_event_versions','iasdpi_event_series','iasdpi_event_series_versions')) LOOP
 EXECUTE format('CREATE POLICY shared_published_only ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT iasdpi_admin_private.shared_institutional_reader(auth.uid())) WITH CHECK (NOT iasdpi_admin_private.shared_institutional_reader(auth.uid()))',t.schemaname,t.tablename);
 END LOOP;
END $$;
-- Helper de policy só retorna boolean; não revela identidade, e-mail ou configuração.
GRANT USAGE ON SCHEMA iasdpi_admin_private TO authenticated;
GRANT EXECUTE ON FUNCTION iasdpi_admin_private.shared_institutional_reader(uuid) TO authenticated;

-- Reserva logins em operação administrativa explícita; não cria Auth nem dá ACL.
CREATE FUNCTION iasdpi_admin_private.sync_institutional_slots() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE d record;p record;k text;n integer;BEGIN
 PERFORM iasdpi_admin_private.lock_admin();
 FOR d IN SELECT * FROM public.schedule_departments ORDER BY id LOOP
 IF NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE slot_kind='department' AND department_id=d.id) THEN
 k:=replace(public.iasdpi_alias_identifier(d.code),'-','_');
 IF EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE identifier=k AND slot_kind IS NOT NULL) THEN k:=left(k,50)||'_'||left(replace(d.id::text,'-',''),8);END IF;
 INSERT INTO iasdpi_admin_private.login_aliases(identifier,slot_kind,department_id,institutional_scopes)
 VALUES(k,'department',d.id,ARRAY[d.id]) ON CONFLICT(church_id,identifier) DO UPDATE SET slot_kind='department',department_id=d.id,institutional_scopes=ARRAY[d.id]
 WHERE login_aliases.slot_kind IS NULL;
 END IF;END LOOP;
 INSERT INTO iasdpi_admin_private.login_aliases(identifier,slot_kind,slot_label,department_id,institutional_scopes)
 SELECT pos.login,'position',pos.label,d.id,ARRAY[d.id] FROM public.schedule_departments d CROSS JOIN (VALUES('diaconato_diaconisas','Diaconato — Diaconisas'),('diaconato_diaconos','Diaconato — Diáconos'))pos(login,label)
 WHERE d.code='diaconato' ON CONFLICT(church_id,identifier) DO UPDATE SET slot_kind='position',slot_label=excluded.slot_label,department_id=excluded.department_id,institutional_scopes=excluded.institutional_scopes WHERE login_aliases.slot_kind IS NULL;
 SELECT coalesce(max(substring(identifier FROM '^anciao_([0-9]+)$')::integer),0) INTO n FROM iasdpi_admin_private.login_aliases;
 FOR p IN SELECT DISTINCT person.id FROM public.schedule_people person JOIN public.schedule_memberships m ON m.person_id=person.id JOIN public.schedule_departments d ON d.id=m.department_id
 WHERE d.code='ancionato' AND person.active AND person.merged_into IS NULL AND m.active ORDER BY person.id LOOP
 IF NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE slot_kind='elder' AND slot_person_id=p.id) THEN
 LOOP n:=n+1;k:='anciao_'||n;EXIT WHEN NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE identifier=k);END LOOP;
 INSERT INTO iasdpi_admin_private.login_aliases(identifier,slot_kind,slot_person_id,responsible_person_id,institutional_scopes)
 SELECT k,'elder',p.id,p.id,ARRAY[d.id] FROM public.schedule_departments d WHERE d.code='ancionato';
 END IF;END LOOP;
 INSERT INTO iasdpi_admin_private.login_aliases(identifier,slot_kind,shared_reader) VALUES('admin','admin',false),('membro','member',true)
 ON CONFLICT(church_id,identifier) DO UPDATE SET slot_kind=excluded.slot_kind,shared_reader=excluded.shared_reader WHERE login_aliases.slot_kind IS NULL;
END $$;
CREATE FUNCTION public.iasdpi_institutional_catalog() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM iasdpi_admin_private.sync_institutional_slots();
 RETURN jsonb_build_object('is_admin',true,
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'display_name',display_name,'active',active) ORDER BY display_name) FROM public.schedule_people WHERE merged_into IS NULL),'[]'),
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'active',active,'version',version) ORDER BY name) FROM public.schedule_departments),'[]'),
 'slots',coalesce((SELECT jsonb_agg(jsonb_build_object('identifier',a.identifier,'kind',slot_kind,'label',coalesce(a.slot_label,d.name,CASE slot_kind WHEN 'elder' THEN 'Ancião' WHEN 'admin' THEN 'Administrador' ELSE 'Membros · somente leitura' END),
 'person_id',responsible_person_id,'user_id',user_id,'version',a.version,'departments',institutional_scopes,'approve_general',approve_general,'shared',shared_reader,'credential_pending',credential_pending,'archived',coalesce(NOT d.active,false)) ORDER BY a.identifier)
 FROM iasdpi_admin_private.login_aliases a LEFT JOIN public.schedule_departments d ON d.id=a.department_id WHERE slot_kind IS NOT NULL),'[]'));
END $$;

-- União de escopos de todas as linhas de uma identidade; nunca por apelido do JWT.
CREATE FUNCTION iasdpi_admin_private.reconcile_institutional_access(u uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE d record;flags jsonb;v bigint;kind text;approval boolean;BEGIN
 IF u IS NULL THEN RETURN;END IF;
 FOR d IN SELECT dep.id, bool_or(a.slot_kind<>'member') FILTER(WHERE a.id IS NOT NULL) manages,
 bool_or(a.slot_kind='elder' AND a.approve_general) FILTER(WHERE dep.code='ancionato') approves,
 bool_or(a.slot_kind IN('department','position') AND a.department_id=dep.id) head,
 bool_or(a.slot_kind='elder') elder
 FROM public.schedule_departments dep LEFT JOIN iasdpi_admin_private.login_aliases a ON a.user_id=u AND a.slot_kind IS NOT NULL AND dep.id=ANY(a.institutional_scopes)
 AND (a.department_id IS NULL OR EXISTS(SELECT 1 FROM public.schedule_departments own WHERE own.id=a.department_id AND own.active))
 WHERE dep.active GROUP BY dep.id LOOP
 SELECT version INTO v FROM public.schedule_department_access WHERE user_id=u AND department_id=d.id;
 IF d.manages IS NULL THEN
 IF v IS NOT NULL THEN PERFORM public.iasdpi_department_access_save(d.id,u,'{"view":false,"edit":false,"publish":false,"members":false,"access":false,"requests":false}', 'revoked',v);END IF;
 ELSE
 flags:=jsonb_build_object('view',true,'edit',d.manages,'publish',d.manages,'members',false);
 kind:=CASE WHEN d.head AND EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id WHERE p.auth_user_id=u AND m.department_id=d.id AND m.active AND m.is_ministry_head) THEN 'leader'
 WHEN d.elder AND EXISTS(SELECT 1 FROM public.schedule_people p JOIN public.schedule_memberships m ON m.person_id=p.id JOIN public.schedule_departments x ON x.id=m.department_id WHERE p.auth_user_id=u AND m.active AND x.code='ancionato')
 AND EXISTS(SELECT 1 FROM public.schedule_departments x WHERE x.id=d.id AND x.code='ancionato') THEN 'elder' ELSE 'manual' END;
 approval:=coalesce(d.approves,false) AND kind='elder';
 PERFORM public.iasdpi_governance_permission_save(d.id,u,kind,flags,'active',coalesce(v,0),approval);
 END IF;
 END LOOP;
END $$;
CREATE FUNCTION public.iasdpi_institutional_save(p_identifier text,p_expected_version bigint,p_person uuid,p_departments uuid[],p_approve_general boolean,p_confirm_reset boolean,p_confirm_elevated boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid;r iasdpi_admin_private.login_aliases;p public.schedule_people;target uuid;changed boolean;v bigint;before jsonb;m public.schedule_memberships;BEGIN
 a:=iasdpi_admin_private.lock_admin();SELECT * INTO r FROM iasdpi_admin_private.login_aliases WHERE identifier=p_identifier AND slot_kind IS NOT NULL FOR UPDATE;
 IF r.id IS NULL OR r.version IS DISTINCT FROM p_expected_version OR r.department_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE id=r.department_id AND active) THEN RAISE EXCEPTION 'Linha alterada ou arquivada; recarregue.' USING errcode='40001';END IF;
 IF p_departments IS NULL OR p_approve_general IS NULL OR p_confirm_reset IS NULL OR p_confirm_elevated IS NULL OR
 cardinality(p_departments)<>(SELECT count(DISTINCT x) FROM unnest(p_departments)x) OR EXISTS(SELECT 1 FROM unnest(p_departments)x WHERE NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.id=x AND d.active)) THEN RAISE EXCEPTION 'Departamentos ou confirmações inválidos.';END IF;
 IF p_person IS NOT NULL THEN SELECT * INTO p FROM public.schedule_people WHERE id=p_person AND active AND merged_into IS NULL FOR UPDATE;IF p.id IS NULL THEN RAISE EXCEPTION 'Selecione pessoa ativa do Cadastro Geral.';END IF;END IF;
 changed:=r.responsible_person_id IS DISTINCT FROM p_person;
 IF changed AND NOT p_confirm_reset THEN RAISE EXCEPTION 'Troca exige redefinição de credencial e bloqueio das sessões.';END IF;
 IF p_approve_general AND (r.slot_kind<>'elder' OR NOT r.approve_general AND NOT p_confirm_elevated) THEN RAISE EXCEPTION 'Aprovação geral exige conta de ancião e confirmação explícita.' USING errcode='42501';END IF;
 IF p_approve_general AND NOT EXISTS(SELECT 1 FROM public.schedule_departments WHERE code='ancionato' AND id=ANY(p_departments)) THEN RAISE EXCEPTION 'Inclua o Ancionato para autorizar aprovação geral.';END IF;
 IF r.slot_kind='elder' AND p_person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.schedule_memberships m JOIN public.schedule_departments d ON d.id=m.department_id WHERE m.person_id=p_person AND m.active AND d.code='ancionato') THEN RAISE EXCEPTION 'Confirme antes o vínculo no Ancionato.';END IF;
 IF r.slot_kind='admin' AND (p_person IS NULL OR (changed OR p.auth_user_id IS DISTINCT FROM r.user_id) AND NOT p_confirm_elevated) THEN RAISE EXCEPTION 'Confirme o responsável e o controle administrativo completo.';END IF;
 target:=CASE WHEN r.shared_reader THEN r.user_id ELSE p.auth_user_id END;
 IF target IS NOT NULL AND NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=target AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false)) THEN RAISE EXCEPTION 'Identidade Auth confirmada necessária.';END IF;
 IF target IS NOT NULL AND r.shared_reader AND (EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=target) OR EXISTS(SELECT 1 FROM public.schedule_people WHERE auth_user_id=target) OR EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE user_id=target AND id<>r.id)) THEN RAISE EXCEPTION 'Membro compartilhado exige identidade exclusiva, sem vínculos pessoais/administrativos.';END IF;
 before:=jsonb_build_object('person_id',r.responsible_person_id,'version',r.version,'approval_status',r.approve_general);
 IF r.slot_kind IN('department','position') AND changed THEN
 IF r.responsible_person_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases other WHERE other.id<>r.id AND other.department_id=r.department_id AND other.responsible_person_id=r.responsible_person_id) THEN
 SELECT * INTO m FROM public.schedule_memberships WHERE person_id=r.responsible_person_id AND department_id=r.department_id;
 IF m.id IS NOT NULL THEN PERFORM public.iasdpi_registry_save(r.responsible_person_id,(SELECT version FROM public.schedule_people WHERE id=r.responsible_person_id),'{}',jsonb_build_array(jsonb_build_object('department_id',r.department_id,'expected_version',m.version,'patch',jsonb_build_object('is_ministry_head',false))),gen_random_uuid());END IF;
 END IF;
 IF p_person IS NOT NULL THEN
 SELECT * INTO m FROM public.schedule_memberships WHERE person_id=p_person AND department_id=r.department_id;
 PERFORM public.iasdpi_registry_save(p_person,p.version,'{}',jsonb_build_array(jsonb_build_object('department_id',r.department_id,'expected_version',coalesce(m.version,0),'patch',jsonb_build_object('is_ministry_head',true,'active',true))),gen_random_uuid());
 END IF;END IF;
 -- A autoridade é calculada no servidor; o cliente nunca informa kind, user_id, flags ou role.
 UPDATE iasdpi_admin_private.login_aliases SET responsible_person_id=p_person,user_id=target,institutional_scopes=CASE WHEN r.slot_kind='admin' THEN '{}'::uuid[] ELSE p_departments END,
 approve_general=p_approve_general,enabled=target IS NOT NULL,credential_pending=r.credential_pending OR changed OR target IS DISTINCT FROM r.user_id,version=version+1,updated_at=clock_timestamp(),updated_by=a WHERE id=r.id;
 IF target IS NOT NULL AND r.slot_kind='admin' THEN PERFORM public.iasdpi_set_access(target,'admin',true);END IF;
 IF r.slot_kind<>'admin' THEN PERFORM iasdpi_admin_private.reconcile_institutional_access(r.user_id);IF target IS DISTINCT FROM r.user_id THEN PERFORM iasdpi_admin_private.reconcile_institutional_access(target);END IF;END IF;
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(a,'institutional_access_saved',r.id,jsonb_build_object('entity','institutional_access','before',before,'after',jsonb_build_object('person_id',p_person,'version',r.version+1)));
 -- Executar por último: o operador pode ser a identidade que está sendo substituída.
 IF changed OR target IS DISTINCT FROM r.user_id THEN
 FOR target IN SELECT x FROM (SELECT DISTINCT x FROM unnest(ARRAY[r.user_id,target])x WHERE x IS NOT NULL) q ORDER BY (x=a),x LOOP
 PERFORM public.iasdpi_require_password_change(target,'Responsável institucional alterado; redefinição obrigatória');
 UPDATE iasdpi_governance_private.identity_epochs SET minimum_iat=greatest(minimum_iat,floor(extract(epoch FROM clock_timestamp()))::bigint),updated_at=now() WHERE user_id=target;
 END LOOP;END IF;
 RETURN jsonb_build_object('saved',true,'credential_pending',(SELECT credential_pending FROM iasdpi_admin_private.login_aliases WHERE id=r.id),'version',r.version+1);
END $$;
CREATE FUNCTION public.iasdpi_institutional_department_save(p_id uuid,p_expected_version bigint,p_name text,p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE d public.schedule_departments;result jsonb;affected uuid;BEGIN
 PERFORM iasdpi_admin_private.lock_admin();SELECT * INTO d FROM public.schedule_departments WHERE id=p_id FOR UPDATE;
 IF coalesce(d.version,0)<>p_expected_version THEN RAISE EXCEPTION 'Departamento alterado; recarregue.' USING errcode='40001';END IF;
 result:=public.iasdpi_schedule_save('department',p_id,p_expected_version,jsonb_build_object('code',coalesce(d.code,public.iasdpi_alias_identifier(p_name)),'name',p_name,'active',p_active),gen_random_uuid());
 PERFORM iasdpi_admin_private.sync_institutional_slots();FOR affected IN SELECT DISTINCT user_id FROM iasdpi_admin_private.login_aliases WHERE slot_kind IS NOT NULL AND user_id IS NOT NULL AND (department_id=p_id OR p_id=ANY(institutional_scopes)) LOOP PERFORM iasdpi_admin_private.reconcile_institutional_access(affected);END LOOP;RETURN result;
END $$;
-- Redefinição usa a fila/links de uso único existentes. O servidor cria hash, nunca senha.
CREATE FUNCTION public.iasdpi_institutional_reset_request(p_identifier text,p_expected_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid;r iasdpi_admin_private.login_aliases;request_id uuid:=gen_random_uuid();BEGIN
 u:=iasdpi_admin_private.lock_admin();SELECT * INTO r FROM iasdpi_admin_private.login_aliases WHERE identifier=p_identifier AND slot_kind IS NOT NULL FOR UPDATE;
 IF r.user_id IS NULL OR r.version IS DISTINCT FROM p_expected_version OR r.responsible_person_id IS NULL THEN RAISE EXCEPTION 'Confirme responsável, identidade e versão antes de redefinir.';END IF;
 IF r.user_id=u THEN RETURN jsonb_build_object('self_change',true);END IF;
 INSERT INTO iasdpi_admin_private.access_requests(id,requester_name,identifier,kind,department_id,target_user_id,status,reviewed_by,verification)
 VALUES(request_id,left((SELECT display_name FROM public.schedule_people WHERE id=r.responsible_person_id),100),r.identifier,'password',r.department_id,r.user_id,'verified',u,'Responsável confirmado pelo administrador na tabela institucional');
 PERFORM public.iasdpi_require_password_change(r.user_id,'Redefinição institucional supervisionada');
 UPDATE iasdpi_governance_private.identity_epochs SET minimum_iat=greatest(minimum_iat,floor(extract(epoch FROM clock_timestamp()))::bigint),updated_at=now() WHERE user_id=r.user_id;
 UPDATE iasdpi_admin_private.login_aliases SET credential_pending=true WHERE id=r.id;
 RETURN jsonb_build_object('request_id',request_id,'version',1);
END $$;
-- Membro compartilhado: associação futura de Auth exclusivo, nunca da conta pessoal do custodiante.
CREATE FUNCTION public.iasdpi_institutional_member_bind(p_user uuid,p_expected_version bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r iasdpi_admin_private.login_aliases;BEGIN
 PERFORM iasdpi_admin_private.lock_admin();SELECT * INTO r FROM iasdpi_admin_private.login_aliases WHERE identifier='membro' AND slot_kind='member' FOR UPDATE;
 IF r.version IS DISTINCT FROM p_expected_version OR r.user_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM iasdpi_admin_private.auth_accounts WHERE id=p_user AND email_confirmed_at IS NOT NULL AND NOT coalesce(is_anonymous,false))
 OR EXISTS(SELECT 1 FROM public.iasdpi_access WHERE user_id=p_user) OR EXISTS(SELECT 1 FROM public.schedule_people WHERE auth_user_id=p_user)
 OR EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE user_id=p_user) OR EXISTS(SELECT 1 FROM public.schedule_department_access WHERE user_id=p_user) THEN
 RAISE EXCEPTION 'Use uma nova identidade exclusiva de leitura, provisionada com autorização.';END IF;
 UPDATE iasdpi_admin_private.login_aliases SET user_id=p_user,enabled=true,credential_pending=true,version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=r.id;
 PERFORM iasdpi_admin_private.reconcile_institutional_access(p_user);
 PERFORM public.iasdpi_require_password_change(p_user,'Credencial provisória do leitor institucional');
 INSERT INTO iasdpi_admin_private.audit(actor_id,action,target_id,details) VALUES(auth.uid(),'institutional_member_bound',r.id,jsonb_build_object('entity','institutional_access','after',jsonb_build_object('user_id',p_user)));
END $$;
CREATE FUNCTION iasdpi_admin_private.institutional_slot_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF OLD.slot_kind IS NOT NULL AND (NEW.identifier,NEW.slot_kind,NEW.department_id,NEW.slot_person_id) IS DISTINCT FROM (OLD.identifier,OLD.slot_kind,OLD.department_id,OLD.slot_person_id) THEN RAISE EXCEPTION 'Login institucional e cargo são permanentes; arquive o departamento.';END IF;RETURN NEW;
END $$;
CREATE TRIGGER institutional_slot_immutable BEFORE UPDATE ON iasdpi_admin_private.login_aliases FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.institutional_slot_immutable();
CREATE FUNCTION iasdpi_admin_private.institutional_credential_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT NEW.must_change_password AND NOT NEW.blocked THEN
 UPDATE iasdpi_admin_private.login_aliases SET credential_pending=false,version=version+1,updated_at=clock_timestamp() WHERE user_id=NEW.user_id AND slot_kind IS NOT NULL AND credential_pending;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER institutional_credential_completed AFTER UPDATE ON iasdpi_governance_private.identity_epochs FOR EACH ROW EXECUTE FUNCTION iasdpi_admin_private.institutional_credential_completed();
-- Usa o mesmo provedor e fila G3; o término supervisionado também encerra a senha provisória.
-- A Edge chama password_change_confirm após access_reset_finish, com service_role.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('public.iasdpi_portal_context()'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_portal_context(','FUNCTION iasdpi_admin_private.portal_context_before_028(');
 body:=pg_get_functiondef('public.iasdpi_events_visible(date)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_events_visible(','FUNCTION iasdpi_admin_private.events_visible_before_028(');
 body:=pg_get_functiondef('public.iasdpi_schedule_visible(date)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_schedule_visible(','FUNCTION iasdpi_admin_private.schedule_visible_before_028(');
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_portal_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();BEGIN
 IF NOT iasdpi_admin_private.shared_institutional_reader(u) THEN RETURN iasdpi_admin_private.portal_context_before_028();END IF;
 RETURN jsonb_build_object('actor_id',u,'is_admin',false,'published_only',true,'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'code',d.code,'active',d.active,'can_edit',false,'can_publish',false,'can_manage_members',false)) FROM public.schedule_departments d WHERE d.active AND iasdpi_schedule_private.can_view(u,d.id)),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_events_visible(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF iasdpi_admin_private.shared_institutional_reader(iasdpi_schedule_private.actor()) THEN RETURN public.iasdpi_events_published(p_month);END IF;
 RETURN iasdpi_admin_private.events_visible_before_028(p_month);
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_schedule_visible(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();rows jsonb;BEGIN
 rows:=iasdpi_admin_private.schedule_visible_before_028(p_month);IF NOT iasdpi_admin_private.shared_institutional_reader(u) THEN RETURN rows;END IF;
 RETURN coalesce((SELECT jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(row) WHERE key IN('id','date','department_id','department','person','role','startDate','endDate','kind','pending','vacancy_count','version','origin'))) FROM jsonb_array_elements(rows)row),'[]');
END $$;
-- Bloqueia troca de responsável por formulários antigos sem a barreira de credencial.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('public.iasdpi_alias_save(text,uuid,boolean,bigint,text)'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_alias_save(','FUNCTION iasdpi_admin_private.alias_save_before_028(');
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_alias_save(p_identifier text,p_user_id uuid,p_enabled boolean,p_expected_version bigint,p_reason text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM iasdpi_admin_private.lock_admin();IF EXISTS(SELECT 1 FROM iasdpi_admin_private.login_aliases WHERE identifier=lower(btrim(p_identifier)) AND slot_kind IS NOT NULL) THEN RAISE EXCEPTION 'Use a tabela institucional para este login.' USING errcode='42501';END IF;
 RETURN iasdpi_admin_private.alias_save_before_028(p_identifier,p_user_id,p_enabled,p_expected_version,p_reason);
END $$;
-- RPCs de dados privados recusam o leitor compartilhado, inclusive sob SECURITY DEFINER.
DO $$ DECLARE f record;body text;args text;oldname text;BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('iasdpi_registry_catalog','iasdpi_registry_people','iasdpi_registry_history','iasdpi_registry_audit','iasdpi_schedule_catalog','iasdpi_schedule_plan_version','iasdpi_schedule_members','iasdpi_schedule_settings_get','iasdpi_schedule_exceptions','iasdpi_schedule_department_days','iasdpi_schedule_workspace','iasdpi_schedule_person_details','iasdpi_schedule_person_history','iasdpi_schedule_rotation_context','iasdpi_schedule_elder_workspace','iasdpi_schedule_elder_versions','iasdpi_events_catalog','iasdpi_event_history') LOOP
 body:=pg_get_functiondef(f.oid);oldname:=f.proname||'_before_028';
 EXECUTE replace(body,'FUNCTION public.'||f.proname||'(','FUNCTION iasdpi_admin_private.'||oldname||'(');
 -- Inserção após o primeiro BEGIN do corpo PL/pgSQL mantém assinatura/retorno existentes.
 IF (SELECT lanname FROM pg_language WHERE oid=(SELECT prolang FROM pg_proc WHERE oid=f.oid))<>'plpgsql' THEN RAISE EXCEPTION 'Revisar wrapper não PL/pgSQL: %',f.proname;END IF;
 EXECUTE regexp_replace(body,'\mBEGIN\M','BEGIN IF iasdpi_admin_private.shared_institutional_reader(auth.uid()) THEN RAISE EXCEPTION ''Conta membro: somente conteúdo publicado autorizado.'' USING errcode=''42501'';END IF;','i');
 END LOOP;
END $$;
-- Departamentos do Organograma vêm da mesma fonte normalizada, inclusive arquivamento.
DO $$ DECLARE body text;BEGIN
 body:=pg_get_functiondef('public.iasdpi_registry_public()'::regprocedure);
 EXECUTE replace(body,'FUNCTION public.iasdpi_registry_public(','FUNCTION iasdpi_admin_private.registry_public_before_028(');
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_registry_public() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 RETURN iasdpi_admin_private.registry_public_before_028()||jsonb_build_object('departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'active',active) ORDER BY name) FROM public.schedule_departments),'[]'));
END $$;
-- Instalação futura termina com privilégios mínimos. Nenhuma aplicação nesta entrega.
GRANT CREATE ON SCHEMA public,iasdpi_admin_private TO iasdpi_church_executor;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND (p.proname LIKE 'iasdpi_institutional_%' OR p.proname='iasdpi_alias_save')) OR (n.nspname='iasdpi_admin_private' AND (p.proname LIKE '%_before_028' OR p.proname IN('shared_institutional_reader','guard_institutional_responsibility','guard_shared_identity','guard_shared_grant','sync_institutional_slots','reconcile_institutional_access','institutional_slot_immutable','institutional_credential_completed'))) LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO iasdpi_church_executor',f.sig);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated,service_role',f.sig);
 IF f.nspname='public' OR f.proname='shared_institutional_reader' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public,iasdpi_admin_private FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
