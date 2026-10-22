-- SOMENTE LEITURA. Executar como postgres. Não cria objetos nem altera cultos.
-- Inclui ativos e lixeira; não retorna responsáveis, nomes ou observações.
with recursive campos(program_id,caminho,valor) as (
  select id,array[]::text[],document from public.iasdpi_programs
  union all
  select c.program_id,c.caminho||filho.chave,filho.valor
  from campos c
  cross join lateral (
    select key,value from jsonb_each(
      case when jsonb_typeof(c.valor)='object' then c.valor else '{}'::jsonb end)
    union all
    select (ordinality-1)::text,value from jsonb_array_elements(
      case when jsonb_typeof(c.valor)='array' then c.valor else '[]'::jsonb end
    ) with ordinality
  ) filho(chave,valor)
)
select md5(p.id) as referencia,
  p.version as versao,
  p.document#>>'{plan,date}' as data_culto,
  p.document->>'status' as status,
  p.document->>'execution_mode' as modo,
  p.deleted_at is not null as na_lixeira,
  encode(sha256(convert_to(p.document::text,'UTF8')),'hex') as assinatura_conteudo,
  (select coalesce(jsonb_agg(jsonb_build_object('caminho',c.caminho,'valor',c.valor)
    order by c.caminho),'[]'::jsonb)
   from campos c where c.program_id=p.id and (
     c.caminho[array_length(c.caminho,1)] in (
       'date','start','end','planned_start','planned_end','started','ended','partial_end')
     or (c.caminho[1] in ('plan','actual_details','extra_events','executions')
       and c.caminho[array_length(c.caminho,1)] in (
         'id','parent_id','position','parallel','template_id'))
   )) as campos_temporais,
  (select coalesce(jsonb_agg(jsonb_build_object(
    'caminho',c.caminho,'tipo',jsonb_typeof(c.valor)) order by c.caminho),'[]'::jsonb)
   from campos c where c.program_id=p.id
     and c.caminho[array_length(c.caminho,1)] in (
       'plan','items','executions','actual_details','extra_events','subactivities')) as estruturas
from public.iasdpi_programs p
order by p.document#>>'{plan,date}',p.id;
