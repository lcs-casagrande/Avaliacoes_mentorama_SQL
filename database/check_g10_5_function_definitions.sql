-- G10.5 — complemento de leitura LIMITADO às duas definições ainda divergentes.
-- NÃO EXECUTADO. Não é migração, não reinstala funções e não repete o inventário.
-- Execução manual futura, após autorização, no projeto IASD_Parada confirmado.
-- Não consulta linhas Auth/negócio nem chama as funções da aplicação.
-- Revisar as definições privadamente antes de compartilhar: não enviar segredos.
WITH wanted(signature, inventory_md5) AS (
 VALUES
 ('iasdpi_admin_private.lock_admin()', 'a08de7e54bdd7ad4dbbd3c2487c6e92e'),
 ('public.iasdpi_create_invite(text)', '7a8b15d93b0a009e0d0489d8b333661d')
), resolved AS (
 SELECT w.*, to_regprocedure(w.signature)::oid AS oid FROM wanted w
)
SELECT r.signature,
       r.oid IS NOT NULL AS present,
       r.inventory_md5 AS expected_g10_1_md5,
       md5(pg_get_functiondef(r.oid)) AS current_definition_md5,
       md5(pg_get_functiondef(r.oid)) = r.inventory_md5 AS matches_g10_1,
       pg_get_functiondef(r.oid) AS definition
FROM resolved r
ORDER BY r.signature;
