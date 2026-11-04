# G7 — Reversão segura e recuperação

Procedimento preparado e testado somente em PostgreSQL descartável. Nenhuma reversão executada no Supabase.

## Causa e correção

O down 008 removia RPCs substituídas pelas etapas posteriores, sem conferir a etapa instalada. A 015 envolve views, funções renomeadas da 014 e triggers de revalidação; simplesmente remover suas tabelas é inseguro.

- Downs 005, 006 e 008 agora recusam dependências posteriores antes de qualquer alteração.
- `015_elder_period_storage_down.sql` é uma reversão **015 → 014**, somente para uma instalação 015 vazia e revisada. Não é um down da cadeia 005–015.
- Não há down automático da 016. Reverter o frontend preservando o banco é a opção normal; uma reversão estrutural da configuração exige revisão própria.

## Matriz de decisão

| Estado | Ação permitida após autorização |
| --- | --- |
| Somente 015, sem períodos, versões, recibos ou auditoria do Ancionato | Revisar snapshot, dependências e pacote 014; usar o down 015 transacional. |
| 015 com qualquer período, mesmo rascunho sem pessoa, ou histórico/recibos | Down recusa. Preservar banco e corrigir progressivamente; se necessário, recuperar backup em ambiente separado. |
| 016 ou outra dependência posterior | Down 015 recusa. Não remover coluna/função para contornar a guarda. |
| Funções anteriores ausentes/alteradas ou dependência adicional detectada | Down recusa ou erro de dependência aborta toda a transação. Revisão administrativa obrigatória. |

O down 015 adquire o controle transacional e locks das tabelas, verifica ausência de dados e restaura as três implementações guardadas da 014 e a view de compromissos anterior. Remove apenas objetos introduzidos pela 015 vazia, sem `CASCADE`. Não altera contas nem linhas de permissões. Não executar simultaneamente a outras migrações. Funções customizadas com SQL dinâmico exigem inspeção humana: a busca textual não comprova ausência de toda dependência possível.

## Antes de uma reversão autorizada

1. Identificar banco/projeto e cadeia efetivamente instalada, comparar hashes dos SQLs aprovados e executar checks somente leitura. Não inferir instalação pelo número do arquivo.
2. Interromper novas escritas pelo procedimento administrativo autorizado, incluindo clientes antigos e jobs; flags de interface não revogam RPCs.
3. Preservar pacote publicado completo, manifesto, SRI e configuração pública. Anotar commit/deploy. O checkout atual tem alterações anteriores não commitadas; seu HEAD não identifica a candidata.
4. Obter snapshot/backup consistente, incluindo dados, schema, funções, políticas e concessões. Confirmar cobertura de Auth/Storage/configurações no plano Supabase. Registrar instante e plano para alterações posteriores.
5. Restaurar e homologar em destino isolado antes de qualquer troca de endpoint. Não executar `DROP SCHEMA`, `CASCADE`, `--clean` ou restore sobre produção como atalho.
6. Somente com autorização específica, executar o down elegível em uma transação. Na primeira divergência, parar. Reexecutar os checks 011–014 e homologar frontend anterior; não usar checks de etapas 005–010 para exigir proprietários antigos.

## Recuperação quando existem dados

Preferir rollback do pacote frontend, conservando banco, IDs, versões, RLS e auditoria. Suspender a edição de modalidades que a interface antiga não representa. Corrigir progressivamente a causa.

Se restauração de backup for necessária: criar um projeto/banco de recuperação separado, restaurar o snapshot completo com suporte aos papéis e schemas do provedor, conferir UUIDs, conteúdos, versões, contagens, donos e RLS, homologar acesso com contas descartáveis e reconciliar escritas posteriores ao snapshot. Só depois solicitar autorização para troca de endpoint. Manter o banco anterior preservado. Dados recentes não podem ser descartados por um restore silencioso.

O teste automatizado executa `pg_dump -Fc` e `pg_restore --exit-on-error` **em banco novo**, sem `--clean`, e compara hashes de registros operacionais, cadastros, configurações, planos, períodos, versões, auditoria, arquivos e permissões, além dos checks de segurança. Também testa down 015 vazio seguido de reinstalação, recusa de 015 preenchida, recusa após 016 e dependência customizada.

Limite: o PostgreSQL local possui um stub de Auth e os papéis necessários previamente instalados. Esse teste não comprova restauração de SMTP, sessões reais, MFA, objetos Storage ou PITR do Supabase. Esses itens exigem exercício controlado no provedor. O container é efêmero, sem rede e com fsync desativado para testes; não valida durabilidade sob crash.
