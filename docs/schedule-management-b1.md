# Gestão de Escalas — Fase B1

Branch: `feat/schedule-management-b1`, criada a partir de `feat/schedule-foundation-phase-a`, sem commit, merge, push ou publicação. A árvore inicial continha as alterações não commitadas da Fase A e do calendário; elas foram mantidas. Base Git: `a77b48b`. A referência de homologação anterior permanece `79c2a25`.

## Diagnóstico e reutilização

O projeto continua com HTML/CSS/JavaScript sem framework. Auth usa o cliente Supabase existente, e `IASDPISchedules.request` reutiliza a identificação e o transporte da Fase A. Não há cliente ou token administrativo novo.

- A migração 005 já define departamentos, pessoas, vínculos, funções, habilitações, disponibilidade, ACL ministerial e auditoria privada. Não foi editada.
- Papéis globais: `admin` e `leader`. Acesso ministerial explícito: `manager` e `viewer`. Um `leader` global ou responsável no organograma não se torna gestor automaticamente.
- Comunicação e Sonoplastia permanecem nas listas originais de `frontend/agenda.js`; anciãos permanecem no snapshot `agenda-data.js`. Não há importação ou fusão automática de nomes ou atribuições.
- Cultos operacionais das migrações 003–004, arquivos, lixeira, organograma e rascunhos dos Lotes 1–6 continuam com suas estruturas próprias. A B1 não cria cópias desses registros.

## Modelo da migração 006

| Tabela nova | Finalidade e integridade |
|---|---|
| `schedule_events` | Culto ou evento compartilhado; UUID; data local, início/término `timestamptz`; identidade externa opcional; unicidade por título normalizado/início e por origem/identificador. Imutável pela API B1. |
| `schedule_plans` | Plano por departamento e mês; UUID; `draft`/`published`; versão otimista e autoria; único por departamento/mês. |
| `schedule_requirements` | Evento, função e quantidade de vagas; FKs compostas impedem usar função de outro departamento; único por plano/evento/função. |
| `schedule_assignments` | UUID da atribuição, pessoa existente e intervalo de participação; vínculo com a função necessária e o plano; mesma pessoa não aparece duas vezes na mesma função. |
| `schedule_versions` | Snapshot imutável de cada versão confirmada, ator e data; consulta somente com acesso ao departamento. |

Reutiliza `iasdpi_schedule_private.audit_logs`, o controle de serialização de `iasdpi_admin_private.control` e os recibos idempotentes de `iasdpi_operational_private.receipts`. Não cria um cadastro paralelo de pessoas, departamentos ou usuários. A recorrência é geração determinística de datas; não exige tabela de séries nesta etapa.

## Segurança, concorrência e regras

1. As cinco tabelas têm RLS habilitada, proprietário `postgres` e privilégios diretos revogados para `PUBLIC`, `anon` e `authenticated`. O REST direto é negado por padrão; não há políticas permissivas novas.
2. Quatro RPCs públicas são `SECURITY DEFINER`, com `search_path=''`, proprietário `postgres`, execução somente por `authenticated` e verificação de identidade/escopo dentro da função.
3. `iasdpi_schedule_workspace` e `iasdpi_schedule_plan_version` permitem consulta de administradores e ACL ministerial explícita do departamento. A montagem é restrita a admin ou manager. O acesso próprio de participantes da Fase A não concede consulta ao plano inteiro na B1.
4. `iasdpi_schedule_event_create` reutiliza um evento equivalente em vez de duplicá-lo. Se horários ou referência externa divergem, recusa e não altera o existente. Origem e identificador externo devem ser fornecidos juntos.
5. `iasdpi_schedule_plan_save` exige a versão atual; `40001` bloqueia edição antiga. Há apenas um plano por departamento/mês. As tentativas repetidas usam recibo, identidade, assinatura e escopo revalidados.
6. Mutações são serializadas pela mesma linha de controle usada nas revogações e cadastros 005. Dois dispositivos não podem passar simultaneamente pela verificação e confirmar uma sobreposição.
7. Um serviço privado central valida pessoa/vínculo/função/departamento ativos, habilitação, indisponibilidade e intervalos sobrepostos entre TODOS os departamentos, inclusive rascunhos. Intervalos adjacentes são permitidos: `[início,término)`.
8. Na B1, funções distintas são exclusivas quando os intervalos se sobrepõem. Não existem exceções automáticas de compatibilidade. A mensagem não revela os detalhes privados do outro departamento.
9. Regras `unavailable` globais ou departamentais, semanais ou por período, são impeditivas. As regras `available` da 005 continuam sendo disponibilidade/preferência, sem transformar ausência de preferência em proibição.
10. Gatilhos diferidos impedem que alterações posteriores em habilitações, disponibilidade ou estado dos cadastros invalidem uma atribuição existente. A substituição de habilitações pela RPC 005 é validada ao final da transação, sem rejeitar a remoção/reinserção temporária do mesmo conjunto.
11. Salvar rascunho permite vagas pendentes. Publicar exige pelo menos uma função e todas as vagas preenchidas. Cada gravação preserva a versão anterior.
12. Uma edição parcial sem `requirements` preserva as funções/atribuições. Quando o conjunto é enviado, sua substituição é atômica, mantendo os UUIDs fornecidos. Uma falha desfaz integralmente a transação.

## Interface e fluxo

Rota: `#schedule-build`. O botão **Criar escala** do calendário abre a página. O shell pode mostrar login; dados e operações continuam protegidos no servidor.

1. Entrar com conta confirmada e autorização de administração ou gestão do departamento.
2. Escolher departamento, mês e ano e abrir a escala existente ou o plano novo.
3. Informar nome, início e término dos cultos. Selecionar quartas-feiras, sábados e/ou domingos e gerar as datas. Não há horários predefinidos.
4. Gerar grupos separados para horários diferentes. Para um evento extraordinário, informar data, nome, horários e, se atravessar a meia-noite, data final explícita.
5. Selecionar eventos, função existente e quantidade de vagas; adicionar ao plano. A mesma função/evento não é adicionada novamente.
6. Selecionar voluntários habilitados e observações. Não há distribuição automática. Novas atribuições usam o intervalo conhecido do evento; intervalos parciais já existentes são preservados. O backend também aceita e valida intervalos parciais explícitos.
7. Salvar rascunho e aguardar a confirmação. Falhas preservam campos; a interface não anuncia gravação na nuvem sem a resposta confirmada.
8. Comparar a versão salva antes de reaplicar uma edição antiga. **Atualizar do banco** pede confirmação se houver alterações pendentes; não ocorre sobrescrita automática.
9. Publicar mediante confirmação explícita e validação de cobertura/conflitos. Salvar uma escala publicada como rascunho também exige confirmação da mudança de estado; a versão anterior permanece no histórico.

Datas aparecem em dd/mm/aaaa e novos horários de eventos em HH:mm, com campos de texto 24h. O banco converte usando `America/Sao_Paulo`, incluindo datas históricas com horário de verão; não há deslocamento fixo embutido. Os cultos antigos e seus horários reais não são modificados.

## Arquivos desta fase

- `database/006_schedule_management.sql`, `006_schedule_management_down.sql`, `check_schedule_management.sql`.
- Novo componente `frontend/schedule-management.js`.
- Integração em `agenda.js`, `schedule-foundation.js`, `actuals.js`, `auth.js`, `navigation.js`, `app.js`, `index.html` e `styles.css`.
- Empacotamento em `scripts/build_homologation.py`, `export_preview.py` e `build_schedule_demo.py`.
- Fixture exclusiva de demonstração `tests/fixtures/schedule-management-preview.js`.
- Testes novos `tests/test_schedule_management_sql.py` e `tests/test_schedule_management_browser.py`; testes de versão de manifesto atualizados em `test_schedule_foundation_package.py` e `test_package_validation.py`.

O manifesto passa à versão **3** para exigir o novo módulo. Pacotes 1 e 2 e seus inventários históricos continuam sendo aceitos e podem ser usados para rollback; não se exige o módulo B1 num pacote anterior.

## Evidências e limites dos testes

**530 testes aprovados, zero falhas, zero testes ignorados**, em 555,073 s. Foram mantidos os 489 cenários disponíveis na base atual (incluindo os ajustes posteriores aos 474) e acrescentados 41: 27 PostgreSQL e 14 de navegador/empacotamento/transporte. Consultar `dist/schedule-b1/tests-all.log`, `tests-sql-final.log`, `tests-browser-final.log` e `verification.json`.

A primeira execução completa encontrou uma validação incompleta de origem ao reutilizar eventos. Ela foi corrigida e a suíte inteira foi repetida com sucesso. `auth-ui-check.json` registra adicionalmente login, sessão após recarga, calendário → montagem no frontend completo com HTTP interceptado e o registro local fictício inalterado.

- PostgreSQL 17 real em Docker com `--network none`, bancos `iasdpi_test_<uuid>` descartáveis, papéis e pessoas fictícios. Inclui RLS, grants, proprietários, persistência entre conexões, atualização, idempotência, rollback, indisponibilidade, habilitação, conflitos e concorrência entre transações.
- Chromium: componentes reais, RPC simulada; geração de datas em 48 meses e ano bissexto, eventos extraordinários, criação/reabertura, versões, vagas, publicação confirmada, falha de conexão, conflito, guarda de navegação e responsividade. Testes do transporte real do frontend usam HTTP interceptado, sem Supabase remoto.
- `visual-check.json` e capturas em 360, 390, 768, 1024 e 1440 px; nenhum estouro horizontal encontrado. Android/iPhone físicos, Safari e Firefox não foram homologados.
- Produção: nenhuma migração, requisição ao Supabase, alteração de conta, culto ou autorização foi executada. Os resultados locais não comprovam a instalação ou configuração remota.

## Prévia navegável

Arquivo: `dist/schedule-b1/IASDPI-escalas-B1-final.html`. Contém apenas dados fictícios e o componente B1 real; nenhuma credencial, cliente Supabase ou conexão externa. A CSP bloqueia rede e submissões externas. A persistência é **simulada em memória** e reinicia ao recarregar; isso está indicado no banner. A persistência operacional real foi verificada separadamente nos testes PostgreSQL.

Para servir localmente: `python -m http.server 8765 --bind 127.0.0.1 --directory dist/schedule-b1`; abrir `http://127.0.0.1:8765/IASDPI-escalas-B1-final.html`. Não é publicação pública. Os cadastros fictícios estão disponíveis pelo menu; a agenda real não é carregada nessa demonstração.

## Ativação futura — somente após revisão e autorização

1. Confirmar 001–004 e o administrador existente. Se 005 ainda estiver pendente, revisar e aplicar **005 primeiro**, sem recadastrar pessoas já existentes. Conferir `check_schedule_foundation.sql`.
2. Revisar e aplicar **006_schedule_management.sql**, uma única vez, como postgres e em uma transação. Instalar primeiro num Supabase de homologação autorizado.
3. Executar `check_schedule_management.sql`, somente leitura: nenhuma linha é o resultado esperado após a instalação completa.
4. Homologar com contas descartáveis admin, manager de um departamento, viewer e sem ACL. Testar em dois navegadores salvamento concorrente e revogação. Não usar cultos reais.
5. Depois de aprovação separada, preparar commit/publicação do frontend; nenhum segredo administrativo é necessário no navegador.
6. Criar um evento descartável e rascunho no ambiente de teste, salvar, reabrir em outro dispositivo, conferir os UUIDs e versões; concluir a homologação antes de usar escalas reais.

## Rollback e limitações

- Antes da ativação, preservar o pacote atual e a referência publicada `79c2a25`. Nenhum pacote anterior foi alterado nesta fase.
- Se a B1 já possuir dados, reverter o frontend e **manter o schema e os dados**. Não usar `CASCADE` nem remover histórico/recibos para contornar a proteção.
- `006_schedule_management_down.sql` só aceita uma instalação B1 vazia, sem eventos, planos, versões, auditoria ou recibos B1. Preserva todos os cadastros 005. Aplicar down 006 antes de considerar qualquer down 005.
- Eventos compartilhados são imutáveis nesta B1; uma identidade existente com horários divergentes exige revisão, sem correção silenciosa. Edição posterior de eventos usados por várias escalas requer fluxo específico em fase futura.
- O calendário público continua consultando suas fontes legadas/oficiais. A integração B1 é o acesso à montagem e consulta administrativa por departamento/mês; planos novos não são expostos publicamente nem sincronizados com a agenda oficial ou programações de culto.
- Uma geração recorrente faz confirmações de eventos individuais. Se a conexão falhar, mostra quantos foram confirmados; repetir reutiliza eventos idênticos. O plano completo, atribuições, versão e auditoria são salvos numa única transação.
- A serialização central prioriza integridade. O gatilho de alterações cadastrais revalida as atribuições existentes; deverá ser medido antes de volumes grandes. Não foram implementadas otimizações especulativas.
- Sem geração automática de voluntários, trocas, notificações, importação automática ou novas funcionalidades de colaboração. A implementação encerra na B1 para revisão.
