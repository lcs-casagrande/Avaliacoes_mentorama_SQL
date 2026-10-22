# Pós-instalação da migração 004

O proprietário confirmou a aplicação da 004 no projeto IASD_Parada e as RPCs
list_trash, restore_program, save_program, trash_detail e trash_program.
Não reaplicar 001–004. Nenhum registro real foi modificado nos testes.

## Verificação remota possível

Projeto utilizado pelo frontend: pwbxksxxmnblqwpvlheu.supabase.co.
Somente requisições de leitura com chave publishable, sem sessão administrativa:

| Consulta | Resultado real |
| --- | --- |
| iasdpi_programs, filtro deleted_at=is.null, limit=0 | HTTP 401 / PostgreSQL 42501 |
| iasdpi_activities, limit=0 | HTTP 401 / PostgreSQL 42501 |
| iasdpi_subactivities, limit=0 | HTTP 401 / PostgreSQL 42501 |
| RPC iasdpi_list_trash, offset=0 | HTTP 401 / PostgreSQL 42501 |
| RPC iasdpi_trash_detail, ID fictício inexistente | HTTP 401 / PostgreSQL 42501 |

Nenhum documento ou dado pessoal foi retornado ou exposto. Não foram chamadas
RPCs de gravação, exclusão ou restauração em produção. As duas RPCs consultadas
são de leitura, embora o transporte PostgREST utilize POST.

## Verificação ainda necessária para publicar

Falta executar **o arquivo original database/check_culto_trash.sql**, como
postgres no SQL Editor, e conferir sua saída. Este ambiente não possui conexão
PostgreSQL nem acesso administrativo à API de gerenciamento. A chave publishable
não concede acesso a pg_proc, ACLs e políticas via SQL. Não fornecer senhas nem
chaves administrativas ao navegador para contornar essa restrição.

Resultados esperados:

- Colunas deleted_at timestamptz, deleted_by uuid e deletion_reason text, nulas.
- RLS habilitada nas três tabelas públicas e na auditoria privada.
- SELECT dos programas somente ativos e autorizados; atividades/subatividades
  dependem do programa ativo, sem política adicional que amplie o acesso.
- As seis RPCs públicas e os três helpers listados: owner postgres, SECURITY
  DEFINER e search_path vazio. EXECUTE anon=false; authenticated=true somente
  nas RPCs públicas, false nos helpers privados.
- USAGE de authenticated no schema operacional privado: false.
- Escrita direta nas tabelas: false para anon/authenticated. SELECT público:
  authenticated=true nas três tabelas públicas, false na auditoria privada;
  anon=false em todas. SELECT ainda se submete à RLS.
- Contagens de ativos/lixeira devem corresponder à situação conhecida pelo
  proprietário; a verificação não move nem finaliza cultos.

Até receber essa saída, os bloqueios anônimos estão confirmados, mas não é
possível declarar auditadas as permissões instaladas para admin e leader.
A autorização de publicação já foi dada pelo proprietário e será usada após
concluir esta conferência, sem exigir nova aprovação para o mesmo escopo.

## Testes e pacote

A suíte local executa Auth/REST fictícios e PostgreSQL 17 descartável sem rede.
O teste de SQL aplica 001–004 e executa check_culto_trash.sql nesse banco,
verificando preservação dos documentos, RLS/ACLs, autoria, auditoria,
concorrência e recuperação. A saída local não substitui a conferência remota.
O pacote estático contém 19 assets e manifesto, com CSP, URLs relativas,
hashes para cache e o snapshot de agenda já publicado. Sem Python/SQLite/SQL
ou segredo administrativo. O rollback local permanece em
backup-pre-culto-trash-pages (e4afee260988d09b327ebd91af69ce67d4620da2).

Após publicar: entrar como admin → Administração · Lixeira → Atualizar lixeira.
Para mover o rascunho de 22/10, usar Programações → Mover para a lixeira,
conferindo data/nome/ID na confirmação. Detalhes e Restaurar ficam na Lixeira.
Para 10/10: Programações → Registrar culto → corrigir manualmente o horário
inconsistente → Salvar alterações → Finalizar e ver resumo → Histórico.
A edição preserva o mesmo ID; nenhuma dessas ações foi executada em produção.
