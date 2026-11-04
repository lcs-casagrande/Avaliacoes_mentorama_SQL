-- G8.3: corrige somente a pesquisa do cadastro central. Não cria tabelas nem altera registros.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regprocedure('public.iasdpi_registry_save(uuid,bigint,jsonb,jsonb,uuid)') IS NULL
 OR to_regclass('public.schedule_source_links') IS NULL THEN RAISE EXCEPTION 'Exige postgres e migrações 001–017 completas.';END IF;
END $$;
CREATE OR REPLACE FUNCTION public.iasdpi_registry_people(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=iasdpi_schedule_private.actor();term text;BEGIN
 IF NOT iasdpi_schedule_private.is_admin(u) AND NOT EXISTS(SELECT 1 FROM public.schedule_departments d WHERE d.active AND iasdpi_schedule_private.has_capability(u,d.id,'members')) THEN RAISE EXCEPTION 'Sem administração de membros.' USING errcode='42501';END IF;
 IF p_search IS NULL OR length(p_search)>160 THEN RAISE EXCEPTION 'Pesquisa inválida.' USING errcode='22023';END IF;
 term:=iasdpi_schedule_private.normal_name(p_search);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'display_name',display_name,'active',active,'version',version) ORDER BY name,id)
 FROM public.schedule_people WHERE position(term in normalized_name)>0 OR position(term in iasdpi_schedule_private.normal_name(display_name))>0),'[]');
END $$;
GRANT CREATE ON SCHEMA public TO iasdpi_church_executor;
ALTER FUNCTION public.iasdpi_registry_people(text) OWNER TO iasdpi_church_executor;
REVOKE ALL ON FUNCTION public.iasdpi_registry_people(text) FROM public,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.iasdpi_registry_people(text) TO authenticated;
REVOKE CREATE ON SCHEMA public FROM iasdpi_church_executor;
NOTIFY pgrst,'reload schema';
COMMIT;
