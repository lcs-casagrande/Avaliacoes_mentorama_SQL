-- Somente leitura; executar como postgres após 024; retorna só irregularidades.
SELECT 'RPC de configuração sem marcador 024' AS irregularidade WHERE strpos(pg_get_functiondef('public.iasdpi_schedule_settings_get()'::regprocedure),'allow_pending_publication')=0
UNION ALL SELECT 'Helper 024 acessível ao cliente' FROM pg_proc p WHERE p.pronamespace='iasdpi_schedule_private'::regnamespace AND (p.proname='departments_conflict' OR p.proname LIKE '%before_024') AND (has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'))
UNION ALL SELECT 'Publicação sem filtro de privacidade' WHERE strpos(pg_get_functiondef('public.iasdpi_schedule_published(date)'::regprocedure),'ancionato')=0
UNION ALL SELECT 'Preservação de datas encerradas ausente' WHERE strpos(pg_get_functiondef('iasdpi_schedule_private.plan_save_007(uuid,bigint,jsonb,uuid)'::regprocedure),'schedule-edit-window-023')=0;
