# Supabase operacional — IASD Parada Inglesa

## Estado da entrega

O proprietário confirmou a migração 003 aplicada em produção e os modelos
culto-03102026/liturgy-i/free com 16/16/0 atividades. Esta versão do frontend usa
Supabase operacional. O gerador build_pages.py produz esse modo por padrão; a
opção --operational continua aceita por compatibilidade.
Não há fallback automático para localStorage se o banco estiver indisponível.

A igreja é única, sem seletor. Auth e `iasdpi_access` continuam com admin/leader.
`culto_archives` continua como arquivo imutável adicional, nunca banco operacional.
Agenda e organograma continuam públicos e seus dados não foram migrados nesta tarefa.

## Ordem exata de ativação

1. **Não reaplicar 001, 002 nem 003 no projeto atual**: o proprietário confirmou
   todas executadas. Os passos estruturais abaixo servem para uma instalação nova. Em instalação nova: 001, cadastro administrativo do primeiro admin
   conforme access-control.md, 002 e só depois 003. A migração 003 não cadastra,
   promove, revoga nem substitui administradores.
2. Conferir o projeto correto no painel Supabase: o frontend usa o projeto
   `pwbxksxxmnblqwpvlheu`. Como operador confiável, executar no SQL Editor o arquivo
   **`database/check_operational_readiness.sql`**, que só consulta metadados,
   quantidades de papéis e IDs de modelos, sem listar dados pessoais ou credenciais.
   Conferir owners postgres, RLS ativa, acesso habilitado e o modelo
   `culto-03102026`. Se o esquema remoto divergir de 001/002, parar e revisar.
3. Após revisão/aprovação, executar **integralmente**
   **`database/003_operational_storage.sql`**, como postgres. É a **única nova
   migração estrutural**. Executa em uma transação BEGIN/COMMIT; qualquer erro
   desfaz toda a execução. Não foi feita para reaplicação: se já aplicada, conferir
   os objetos existentes, sem removê-los para tentar novamente.
4. Executar novamente a consulta de conferência. Verificar as três tabelas
   operacionais com SELECT para authenticated, sem INSERT/UPDATE/DELETE diretos;
   anon sem acesso; funções privadas sem EXECUTE/USAGE para os clientes; três RPCs
   públicas com EXECUTE somente para authenticated. Conferir o admin anterior e o
   conteúdo de iasdpi_templates/culto_archives preservados. Verificar Liturgia I
   e Livre no catálogo, mantendo também o modelo legado.
5. Gerar o pacote operacional de revisão (comando do passo 7, usando um diretório
   novo) e abri-lo em uma prévia HTTP controlada; o site publicado continua intacto.
   Homologar no navegador com uma conta autorizada. Usar cultos fictícios claramente
   identificados, autorizados para homologação. Para não tocar produção durante
   testes automatizados, foi usado PostgreSQL descartável sem rede e REST simulado.
   A aplicação não possui exclusão de cultos: combinar previamente a retenção dos
   registros de homologação, ou preferir um projeto Supabase descartável nesta etapa.
6. Confirmar Auth > URL Configuration: manter a URL do site principal
   `https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/` como Site URL e
   na lista de Redirect URLs. Preservar outras URLs válidas. Login por senha usa
   a sessão do SDK; convites/confirmação por e-mail dependem dessa configuração.
7. Após validação e autorização de publicação, gerar pacote estático:
   `python3 scripts/build_pages.py --operational --output dist/pages-supabase-after-sql --agenda-data /CAMINHO/agenda-data.js`
   Usar o snapshot mais recente da agenda publicada. O diretório de saída precisa
   estar vazio/ausente. Configuração pública contém somente URL e publishable key;
   `storageMode=supabase`, `remoteReadOnly=false`, namespace principal e CSP limitada
   ao próprio site/Supabase. Publicar os assets em gh-pages na raiz do repositório
   atual, com rollback preservado. Não publicar backend Python, SQLite, SQL ou dados.
8. Conferir o site publicado em Chrome e celular: login, Novo registro, salvar,
   recarregar, abrir em outro dispositivo, editar, histórico e Administração > Usuários.
   Agenda e organograma devem abrir deslogados; registros não.
9. **Opcional, uma única vez por navegador que tenha registros antigos**:
   Arquivo e banco > Conferir registros antigos deste navegador > revisar nomes,
   datas, IDs e situações > selecionar novos registros > Confirmar importação.
   Ignorar conflitos até comparar manualmente. Não é preciso importar para começar
   a cadastrar cultos novos. A chave `iasdpi-demo-v1` nunca é removida ou regravada.
   Importar novamente apenas reconfirma ou informa conflitos; nunca atualiza o banco.

**Depois da ativação:** publicações de HTML/JS/CSS não apagam ou substituem cultos.
Não existe etapa de exportar/importar navegador a cada deploy. Futuras alterações
estruturais ainda precisam de migrações versionadas e revisão; deploy não executa SQL.

## SQL e modelo de dados

O SQL integral revisável está em `database/003_operational_storage.sql`.
Ele cria:

| Objeto | Finalidade |
| --- | --- |
| public.iasdpi_programs | ID estável textual, documento operacional, versão, autoria, datas de auditoria e fingerprint de importação |
| public.iasdpi_activities | PK (program_id,id), FK do culto, sequência real incluindo extras antigos, previstos, realizados, responsável e nota |
| public.iasdpi_subactivities | PK (program_id,parent_id,id), FK composta da principal, posição, horários opcionais, responsável e nota |
| iasdpi_operational_private.revisions | Versões anteriores automáticas de registros/modelos, fora do acesso direto do navegador |
| iasdpi_operational_private.receipts | Requisições idempotentes e respostas confirmadas, por autor, para repetir envios sem duplicar |

O documento JSONB é o agregado operacional compatível com o formato anterior,
com projeções relacionais escritas **na mesma transação**. Isso conserva campos
legados/desconhecidos, strings de horários com precisão original e IDs, e permite
consultas por relacionamentos. Não é um backup em culto_archives. Os IDs de
atividades são estáveis dentro do culto; os das subatividades, dentro da principal.
Uma falha de integridade desfaz o documento e todas as projeções/revisões daquele envio.

A tabela existente `iasdpi_templates` recebe apenas version, display_name,
updated_by e updated_at. O modelo legado fica intocado; Liturgia I é copiada dele
sem data fixa, e Livre inicia sem atividades. Outros modelos podem ser salvos por
admin em Arquivo e banco, usando uma programação prevista como referência.
Modelos não carregam execução real nem timestamps de uma data anterior.

As únicas novas RPCs públicas são:

```sql
-- Criação: expected_version=0. Atualização: versão que foi aberta pelo usuário.
-- request_id deve ser o MESMO ao repetir uma operação sem confirmação.
public.iasdpi_save_program(
  p_id text, p_expected_version bigint, p_document jsonb,
  p_request_id uuid, p_import boolean default false
);
-- Só consulta: retorna new, exists, duplicate ou conflict para cada registro.
public.iasdpi_preview_import(p_documents jsonb);
-- Somente admin. Cultos já criados não são alterados ao mudar o modelo.
public.iasdpi_save_template(
  p_id text, p_expected_version bigint, p_name text, p_plan jsonb
);
```

Criar cultos e atualizar edições compartilha a mesma RPC, mas não o mesmo
expected_version. A versão é atribuída pelo banco. UPDATE/DELETE diretos são
negados. Na importação, até uma versão local com número maior é impedida de
sobrescrever um registro divergente. Mesmo conteúdo com outro ID é reconhecido
pelo fingerprint de importação; o número de versão local permanece em
`import_source_version`. Nenhum ID local é trocado para esconder conflitos.

## Segurança e revisão das RPCs anteriores

As funções novas SECURITY DEFINER pertencem a postgres, usam search_path vazio,
objetos qualificados e EXECUTE revogado de PUBLIC/anon. O schema privado não
concede USAGE nem acesso a tabelas/funções a authenticated. A RLS de leitura usa
uma consulta a iasdpi_access, cuja política consulta apenas auth.uid/JWT; não há
recursão de políticas. O acesso exige enabled, papel admin/leader e sessão não
anônima. Cadastro no Auth não concede associação ou papel.

As mutações operacionais usam a mesma linha de controle das RPCs 002 e reconferem
acesso após obter o bloqueio, evitando ultrapassar uma revogação concorrente.
O bloqueio global é deliberado para esta igreja e volume atual. A versão por culto
impede que uma edição antiga sobrescreva a de outro dispositivo. Recibos verificam
autor e assinatura; não aceitam reutilizar request_id com outro conteúdo.

Revisão estática de 001/002: list_users/find_account/list_invites exigem admin;
set_access e convites usam lock_admin; o último admin e a proibição de autoaprovação
são mantidos. Nenhuma dessas funções foi substituída. Os testes de segurança 002
foram executados em PostgreSQL isolado. **Não afirmamos ter comparado as definições
reais implantadas no Supabase**: a consulta de prontidão é parte obrigatória da ativação.
Não foi consultado ou alterado nenhum registro real nesta implementação.

## Falhas de conexão, edição parcial e horários

O site lê cultos do Supabase ao entrar/recarregar, nunca mescla automaticamente a
lista local. Novo registro grava no banco antes de abrir a execução. Edições usam
o mesmo ID e a versão aberta. Campos omitidos por operações parciais preservam os
valores anteriores; limpar explicitamente um campo na interface é uma edição válida.
O seletor de status não retorna. Campos antigos de status ficam no documento,
mas não decidem se uma atividade tem início/término. As subatividades não entram
em duração, atrasos ou sequência prevista e são validadas no cliente e na RPC.

A interface operacional mostra/digita HH:mm:ss, com segundos obrigatórios nos
horários editados, sem AM/PM ou frações. Datas são ISO
internamente e dd/mm/aaaa na interface; novos cultos usam America/Sao_Paulo.
Realizados ficam como timestamps/horas relacionais e strings originais no documento,
não como texto formatado dependente do navegador. Horários antigos não editados
conservam segundos, frações e fuso. Editar explicitamente um horário na nova tela
gera precisão de segundos; Agora usa São Paulo e mostra HH:mm:ss.

Antes de enviar uma edição, uma fila de recuperação opcional em IndexedDB guarda
request_id, versão e documento do envio, por usuário. **Não contém senhas ou tokens,
não é fonte operacional e não substitui o Supabase.** Em falha, não há confirmação
falsa; o formulário/aviso de alterações não salvas permanece e Arquivo e banco
permite conferir/repetir envios após recarga. Em conflito, reenviar não força
sobrescrita: comparar a versão atual e refazer a edição conscientemente. Se a fila
local também falhar, o site avisa para manter a aba aberta. Campos ainda não enviados
não são salvamento automático; fechar à força o navegador pode perder rascunhos.

## Preservação, rollback e limites

003 não altera registros de acesso, arquivos anteriores ou o modelo legado, não
executa importação e não toca em localStorage. Não há migração destrutiva, DROP,
TRUNCATE ou remoção de coluna. DELETE interno nas projeções reconstitui apenas as
atividades do mesmo culto dentro da transação de atualização; o culto mantém seu
ID e sua revisão anterior. As tabelas não admitem DELETE por usuários do site.

As revisões protegem alterações anteriores, mas ficam no mesmo projeto. Configurar
a retenção/backups do próprio Supabase conforme o plano contratado, com rotina de
recuperação do banco. Revisão operacional não substitui backup independente do
provedor. Nenhum backup manual de navegador é requisito para publicar o frontend.

Preservar as referências de rollback de código já existentes. **Após ativar gravação
centralizada, não voltar a um frontend que grave em localStorage**: isso dividiria
os registros. Rollback deve usar versão compatível com Supabase ou colocar as rotas
privadas em manutenção. Não desfazer 003 nem restaurar banco/localStorage
automaticamente; uma recuperação de dados é procedimento administrativo separado.

## Testes reproduzíveis

```bash
# Container postgres descartável, sem rede e sem portas publicadas.
IASDPI_PG_TEST_CONTAINER=iasdpi-operational-tests python3 -m unittest discover -s tests -v
```

O banco de cada teste tem nome único e é destruído ao final. O transporte REST dos
testes de navegador é simulado; os testes SQL usam PostgreSQL 17 real com auth.uid/JWT
simulados. Cobrem persistência, atualização de mesmo ID, revisões/autoria, RLS,
revogação, execução privada, importação, idempotência e dois processos concorrentes.
A homologação autenticada de uma gravação real pelo proprietário continua sendo
uma etapa manual. Não usamos sua conta nem alteramos cultos reais em testes.

Resultado executado após a revisão de 003: **119 testes passaram**, sem testes
ignorados, em PostgreSQL isolado e Chromium. Os 16 testes SQL operacionais incluem
agora origem das atividades, fuso histórico e rollback completo da migração. JavaScript passou em `node --check`
e `git diff --check` não apontou problemas. O pacote tem 18 arquivos estáticos,
hashes conferidos e o snapshot da agenda preservado. Nenhuma execução em produção.

## Arquivos desta implementação

- Banco: database/003_operational_storage.sql, database/check_operational_readiness.sql.
- Frontend: frontend/operational.js (novo), demo.js (motor de regras reutilizado sem
  gravar localmente no modo centralizado), app.js, actuals.js, archive.js, auth.js, index.html.
- Publicação: scripts/build_homologation.py, build_pages.py, export_preview.py.
- Backend legado: backend/server.py (apenas liberação do novo asset estático).
- Testes novos: tests/test_operational_sql.py e tests/test_operational_browser.py.
- Documentação: este documento e README.md.

001, 002, configuração da chave pública, storage.js, organograma e agenda não foram
alterados por esta implementação. As mudanças de horários da tarefa anterior estão
preservadas e foram incluídas na regressão. Não houve commit, push nem publicação.

Pacote final preparado nesta tarefa: `dist/pages-supabase-operational-final/`.
A versão anterior do site e as referências de rollback permanecem preservadas.
Os oito testes de navegador operacional foram repetidos após os ajustes finais de
recuperação de envios. A prévia HTML independente do exportador continua sendo
uma demonstração local, não homologação da persistência Supabase.

## Revisão da migração 003 antes de produção

- `position` já era declarada e inicializada em cada chamada. A nova projeção não
  depende desse contador: cada item recebe `planned` ou `extra` da consulta sobre
  sua origem, com ordem explícita dentro de cada array. A posição final intercalada
  continua preservada; um campo legado `kind` no JSON não interfere no tipo.
- Horas civis de extras e `partial_end` agora usam `(data + hora::time) AT TIME ZONE
  'America/Sao_Paulo'`. Não resta offset fixo -03:00 na migração. Instantes já
  gravados com offset/Z continuam sendo interpretados como instantes; o documento
  original não é reformatado nem regravado automaticamente. A projeção preserva
  segundos/microssegundos e considera o horário de verão histórico.
- A criação de Liturgia I exige os 16 itens confirmados na origem. O plano copiado
  deve ser igual ao original, retirando somente a data no nível principal. Essa
  igualdade inclui IDs, ordem, horários, responsáveis, notas e campos desconhecidos.
  Uma Liturgia I preexistente diferente causa erro, sem sobrescrevê-la. O ALTER
  TABLE mantém a origem bloqueada até o COMMIT durante cópia/conferência.
- BEGIN/COMMIT permanece integral. A migração não executa DELETE de registros: os
  DELETE dentro do corpo de project_program só recompõem projeções ao atualizar
  um culto futuramente, dentro da transação e mantendo revisão e ID. Não há DROP
  nem TRUNCATE. Uma segunda execução não é prevista; objetos conflitantes exigem
  revisão e abortam sem substituição silenciosa.

A regressão SQL inclui 16 planejadas + extras no início/meio/fim, atualização
repetida, São Paulo em janeiro/julho de 2018 e em 2026 com sessão SQL em Asia/Tokyo,
frações originais, cópia integral, origem com quantidade inesperada, modelo
preexistente conflitante e erro proposital imediatamente antes de COMMIT. Esse
último teste confirma rollback de schema, tabelas, colunas e seeds, com permissões,
admins, modelos anteriores e culto_archives preservados. Tudo em banco descartável
sem rede; nenhuma aplicação no Supabase real e nenhuma publicação.

Arquivos alterados nesta revisão: database/003_operational_storage.sql,
tests/test_operational_sql.py e docs/supabase-operational.md. Regressão completa:
119 testes em 115,940 segundos; nenhum SQL executado em produção e nenhum deploy.

## Publicação operacional autorizada

O usuário confirmou 003 aplicada e autorizou a publicação após os testes. A sonda
de leitura confirmou Supabase Auth HTTP 200 e recusa anônima 401/42501 para
iasdpi_programs, iasdpi_activities e iasdpi_subactivities, sem consultar cultos.
O contrato frontend usa os nomes/assinaturas da migração 003: RPC save_program
com expected_version/request_id, preview_import e save_template, mais SELECT das
tabelas com token Auth. Nenhum service_role/sb_secret é incluído no pacote.

Os horários previstos continuam HH:mm. Horários reais são HH:mm:ss em registro,
edição, acompanhamento e histórico. Horas antigas sem segundos aparecem com :00;
segundos/frações/fuso originais permanecem no dado se não forem editados.
A validação exige segundos quando um valor é digitado, mas aceita campos em branco
ao salvar parcialmente. A API permanece compatível com horários legados.

Rollback de código anterior à ativação: preservar tags
backup-pre-supabase-operational e backup-pre-supabase-operational-source antes do
push. A versão anterior usa armazenamento local: após gravações no Supabase,
ela só deve ser usada para consulta/diagnóstico isolado, sem criar novos registros
no site principal. Não desfazer 003 nem restaurar automaticamente localStorage.

Teste manual após publicar: Entrar > Registrar culto > Liturgia I > Novo registro;
nomear TESTE DESCARTÁVEL, preencher uma atividade e Salvar alterações. Recarregar
e abrir em outro dispositivo autorizado; alterar uma nota e salvar no mesmo ID.
A versão deve aumentar e a mensagem deve confirmar Supabase. Não finalizar o culto
com horários faltantes. Se preferir Livre, editar a programação prevista para
adicionar a primeira atividade antes de registrar horários. O teste não exclui nem
substitui cultos anteriores. A exclusão de cultos não é oferecida nesta versão;
manter o registro de teste identificado até limpeza administrativa autorizada.

A sincronização automática da agenda altera somente agenda-data.js no Pages e
preserva config.js/operational.js. A publicação usa os recursos com hashes para
evitar mistura de arquivos antigos em cache. A aplicação nunca importa, limpa
ou substitui automaticamente a chave local iasdpi-demo-v1.

Regressão desta publicação: 121 testes na bateria completa e oito testes do
gerador/isolamento, incluindo um novo teste de que Pages é operacional por padrão
(122 testes distintos aprovados). Os três schemas/tabelas de acesso existentes
permanecem preservados; esta publicação não executa migração no Supabase.
