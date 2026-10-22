# Correção de horários importados e lixeira — implantação

O proprietário confirmou a 004 aplicada e concluiu a conferência administrativa
de permissões, RLS, owners e schemas privados sem divergências. A consulta final
de irregularidades retornou “Success. No rows returned”. Publicação autorizada
pelo proprietário; não reaplicar as migrações nem alterar cultos na implantação.
O Codex verificou os bloqueios anônimos pela API; a conferência SQL de produção
foi executada pelo proprietário, não pela chave pública do frontend.

## Diagnóstico e limites

O caminho de leitura antigo chamava Intl.format(new Date(valor)) sem validar a
data: `HH:mm:ss` e valores inconsistentes de PDF produziam Invalid Date e a exceção
RangeError: Invalid time value. Havia também uma concatenação de `:00` a horários
previstos que já poderiam conter segundos. A reprodução usa dados sintéticos com
16 atividades, início inconsistente, horários simples e timestamps SQL/ISO mistos.
Não houve sessão administrativa disponível para consultar o JSON protegido real:
o campo exato do registro remoto continua dependendo da conferência do proprietário.

record-time.js distingue horário civil, ISO, timestamptz textual e data; considera
America/Sao_Paulo inclusive no horário de verão histórico. A leitura não grava nem
muta registros. Valores desconhecidos continuam visíveis, com aviso junto ao campo.
Não são substituídos por horários inventados. Segundos aparecem em HH:mm:ss, sem
fração visível; timestamps completos antigos não editados mantêm sua precisão.
Horários simples são convertidos usando a data do culto somente ao salvar uma
edição explícita. A compatibilidade HH:mm:ss previsto com segundos zero não muda
os horários: ao salvar, representa esses mesmos horários como HH:mm exigido pela 003.
Valores previstos inconsistentes não são truncados para produzir horários válidos.

## SQL e ordem de ativação

1. Conferir o projeto IASD_Parada (`pwbxksxxmnblqwpvlheu`) e a presença de 001–003.
   Não reaplicar essas migrações. Preservar o backup do banco gerenciado pelo
   Supabase conforme a disponibilidade do plano; Git não é backup dos dados.
2. Revisar integralmente `database/004_culto_trash.sql`. Após autorização, executar
   uma única vez como postgres. BEGIN/COMMIT, lock_timeout 10s, statement_timeout
   60s; erros revertem também as alterações de funções e políticas. Não há DELETE,
   TRUNCATE ou alteração do document dos cultos na aplicação desta migração.
3. Executar `database/check_culto_trash.sql` (somente leitura). Confirmar owners,
   RLS, ACLs e novas RPCs. Não modificar iasdpi_access, modelos ou culto_archives.
4. Gerar/publicar o frontend preparado somente depois de instalar a 004: as
   consultas agora filtram deleted_at e dependem dessa coluna. Assets relativos
   possuem hashes de conteúdo e CSP; não há API Python ou SQLite no Pages.
5. Homologar com uma programação descartável criada pelo próprio administrador.
   Não usar o culto real de 10/10/2026 para testar exclusão ou restauração.

A 004 acrescenta deleted_at, deleted_by e deletion_reason em iasdpi_programs;
cria somente a auditoria privada trash_audit e índices. Mantém o documento e as
projeções. Atualiza RLS para ocultar programas excluídos e suas atividades também
de administradores no REST comum. As RPCs administrativas acessam a lixeira.

RPCs novas (SECURITY DEFINER, owner postgres, search_path vazio):

- iasdpi_trash_program(p_id,p_expected_version,p_request_id,p_reason opcional).
- iasdpi_restore_program(p_id,p_expected_version,p_request_id).
- iasdpi_list_trash(p_offset opcional): lotes de 100.
- iasdpi_trash_detail(p_id): documento e auditoria de um registro na lixeira.

EXECUTE somente authenticated não dispensa o teste admin/enabled dentro das RPCs.
Líderes, não autorizados, revogados e anônimos são bloqueados. Os helpers e a
versão original de save_program/preview_import ficam no schema privado, sem
USAGE/EXECUTE para clientes. As tabelas continuam sem escrita direta.

Todas as mutações usam o mutex da gestão de acesso e conferem novamente a
permissão. A versão esperada impede sobrescrita concorrente; UUID de requisição
permite reconfirmar uma resposta perdida sem repetir a operação. Gravações,
importações e reenvios antigos não podem ressuscitar um culto na lixeira. A
restauração incrementa a versão, mantém ID/status/atividades e conserva a auditoria
anterior. Não existe RPC nem botão de exclusão definitiva. Cada mudança acrescenta
uma revisão anterior completa e um evento de auditoria. Modelos não são excluídos.

## Como utilizar depois da implantação

- Programações → Registrar culto ou Ver programação → corrigir manualmente o
  campo inconsistente de 10/10/2026 → Salvar alterações → conferir → Finalizar e
  ver resumo. O identificador é mantido; Histórico lista o culto finalizado.
  Sem a correção manual, a validação aponta o campo e não confirma gravação.
- Admin → Programações → localizar exatamente 22/10/2026 — Culto de sábado →
  Mover para a lixeira. Conferir nome, data e ID na confirmação; motivo opcional.
  Essa ação não é disparada automaticamente pela atualização.
- Administração · Lixeira → Atualizar lixeira → Ver detalhes → Restaurar.
  Datas, autor e motivo aparecem no site. Após restauração, consultar Programações.
- Falha de rede não produz confirmação falsa. Para edição normal, os campos e a
  fila de recuperação existentes continuam preservados. Para lixeira, conferir
  a lista após reconectar antes de repetir; repetir a mesma operação na aba usa
  o mesmo UUID. Outra versão exige atualizar e confirmar novamente.

## Rollback e dados

A versão estática anterior é o commit Pages
`e4afee260988d09b327ebd91af69ce67d4620da2` (snapshot local preservado em
`/tmp/iasdpi-published-pages` e tag local backup-pre-culto-trash-pages).
Rollback deve publicar um novo commit com esse conteúdo, sem force-push. Manter
004 instalada: a RLS e o wrapper de gravação protegem a lixeira mesmo no frontend
anterior. Não reaplicar 003 nem remover colunas/tabelas para reverter a interface.
A versão anterior pode continuar apresentando o erro de horário importado; o
rollback é contingência, não uma correção dos dados. Nenhuma restauração de dados
ou do localStorage deve ser automática.

Para construir: `python3 scripts/build_pages.py --output /tmp/iasdpi-culto-trash-pages`.
O gerador recusa sobrescrever pastas não vazias e verifica segredos reconhecíveis.
Preservar também o snapshot de agenda mais recente da branch principal ao publicar.
