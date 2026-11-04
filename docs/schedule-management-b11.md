# Fase B1.1 — escalas por dia

Branch: `feat/schedule-management-b1`. A implementação preserva as alterações anteriores, sem commit, merge, mudança na main ou publicação. Não houve acesso ou migração no Supabase real.

## Inspeção e modelo incremental

A 005 já possui pessoas, vínculos com vários departamentos, funções, habilitações, disponibilidade e autorização ministerial. A 006 representa eventos e atribuições com intervalos obrigatórios, planos mensais, snapshots de versões e auditoria. Ambas permanecem inalteradas.

`database/007_daily_schedules.sql` acrescenta:

| Estrutura | Alteração |
|---|---|
| `schedule_events` | `timing_mode` (`day`/`timed`); horários opcionais somente no modo diário; unicidade diária por nome/data. |
| `schedule_assignments` | `assigned_on` e `timing_mode`; novos registros diários não fabricam horários. |
| `schedule_people` | Limite mensal global opcional, no mesmo UUID da pessoa. |
| `schedule_availability` | Origem `manual` ou `daily-profile`, mantendo a mesma tabela normalizada. |
| `schedule_settings` | Uma configuração da igreja: 2 meses por padrão; opções 1/2/3/6; dias padrão quarta, sábado e domingo; datas extraordinárias. |
| `schedule_day_exceptions` | Pessoa, data, par de departamentos, justificativa, administrador, datas de aprovação/revogação e versão. |

Não há novo cadastro paralelo de membros, contas, departamentos ou escalas históricas. A planilha é uma projeção de pessoas/vínculos/funções/disponibilidade. Contas Auth continuam separadas e opcionais para os participantes ministeriais.

## Regras implementadas no PostgreSQL

- Toda atribuição tem data. Horários e frações antigos são preservados; não são substituídos por meia-noite.
- Novas gravações bloqueiam a mesma pessoa em departamentos diferentes na mesma data, mesmo que o cliente envie horários distintos. A validação é transacional, serializada pelo controle existente também usado nas revogações.
- A mesma pessoa pode exercer funções no mesmo departamento, respeitando habilitação, unicidades e disponibilidade. Limites mensais contam **dias distintos**, sem somar duas vezes funções na mesma data. O limite global e o limite do vínculo, quando informados, são aplicados.
- A ausência de confirmação resulta em `unknown`. Novas atribuições exigem `available`; indisponibilidade prevalece. Uma disponibilidade antiga limitada por horário não confirma o dia inteiro. Restrições horárias que intersectam o dia bloqueiam a atribuição diária.
- Exceções são por pessoa/data/par de departamentos, somente por admin, justificadas e auditadas. Não dispensam habilitação, disponibilidade ou quota. A revogação é bloqueada enquanto a autorização estiver em uso.
- Alterações cadastrais não podem invalidar atribuições diárias futuras. A transação é rejeitada e os dados anteriores permanecem. Não há recálculo retroativo destrutivo do histórico.
- Rascunho pode conter vagas sem pessoa; publicar exige cobertura completa. IDs, CAS, recibos idempotentes, snapshots e autoria da 006 continuam sendo utilizados.

## Geração do período

`iasdpi_schedule_generate_days` calcula o período no servidor, em `America/Sao_Paulo`, sempre do próximo mês em diante. Não recebe um mês inicial arbitrário do cliente. Outubro/2026 com padrão 2 resulta em novembro/dezembro; a virada de ano e o limite de data UTC/São Paulo estão testados.

Os dias habilitados e datas extraordinárias são persistentes. Podem ficar sem dias regulares e usar apenas datas extraordinárias. Datas fora do período gerado são preservadas na configuração, mas não incluídas nessa geração.

Mudar a configuração não remove eventos, planos ou atribuições. Gerar cria/reutiliza eventos **sem escolher pessoas nem montar escalas automaticamente**. O usuário abre cada mês para definir funções e voluntários.

Meses atuais/anteriores continuam consultáveis e editáveis; podem receber um evento extraordinário informado explicitamente. Isso é diferente da geração do período, que nunca inclui o mês atual. O botão de geração fica desabilitado fora do período configurado, e o servidor não permite contornar o início obrigatório no próximo mês.

## Interface

- `#schedule-build`: sem horas obrigatórias quando a 007 está instalada; lista o período autorizado e permite gerar dias, incluir evento extraordinário, preencher funções e salvar. A disponibilidade por pessoa/data vem do servidor; desconhecidos/indisponíveis não são selecionados automaticamente.
- `#schedule-members`: planilha administrativa com nome, departamentos, funções, flags disponível/indisponível nos sete dias, datas indisponíveis, limite, ativo/inativo e histórico. Nenhuma flag = desconhecida. As duas flags de um dia são mutuamente exclusivas.
- Departamentos e habilitações são editados pelos formulários já existentes em Cadastros; a planilha não cria uma segunda fonte. Regras manuais/antigas permanecem e são identificadas.
- Cada linha tem versão e salvamento próprio. Alterações em outras linhas são preservadas ao salvar ou consultar histórico. Há aviso para navegação com alterações pendentes.
- `#schedule-settings`: período, dias, datas extraordinárias e autorizações de exceção. O administrador deve confirmar a autorização. Gestores não recebem essa permissão por serem responsáveis ministeriais.
- A planilha tem rolagem horizontal localizada, inclusive no celular; o documento inteiro não se desloca horizontalmente.

## Segurança

Tabelas novas com RLS, proprietário postgres e privilégios diretos revogados. RPCs `SECURITY DEFINER`, `search_path=''`, execução apenas por authenticated e guardas internos de identidade/escopo. Helpers e funções legadas movidas para o schema privado permanecem sem execução pelos clientes.

Configuração, planilha, histórico individual e exceções verificam administrador no banco. A consulta de configuração e disponibilidade resumida para montagem respeita o acesso ao departamento. Contato privado, e-mail e vínculo Auth não são expostos na planilha.

O shell das rotas administrativas pode mostrar carregamento/login/recusa antes da verificação; o conteúdo depende das RPCs administrativas. Isso permite reutilizar a sessão iniciada no módulo de escalas. Foram testados o acesso após esse login e o bloqueio de um líder por link direto. Ocultar menus não é a barreira de segurança.

## Compatibilidade e limites importantes

- O preenchimento incremental de `assigned_on` deriva a data local dos timestamps antigos, sem alterar seus valores. Os antigos não são transformados automaticamente em atribuições diárias.
- Registros com horários continuam legíveis. Novas edições/gravações passam pela regra diária e pela disponibilidade confirmada; um histórico antes válido com dois departamentos no mesmo dia pode exigir revisão administrativa antes de ser salvo novamente. A migração não cria exceções automáticas para esses casos.
- Eventos antigos com o mesmo nome/data e horários distintos não são mesclados arbitrariamente. O cadastro diário pede seleção explícita de uma identidade existente quando houver ambiguidade.
- Não há alteração nas programações/execuções/arquivos de cultos das migrações 001–004, nem importação dos 15 registros de Sonoplastia, dos 5 de Comunicação ou dos períodos de anciãos. O organograma e o calendário aprovado são preservados.
- A prévia é fictícia e em memória; recarregar reinicia os dados. Não demonstra persistência real, RLS ou concorrência do Supabase remoto. Essas regras são verificadas separadamente em PostgreSQL descartável.
- Depois do uso de dados diários, desfazer o schema não pode simplesmente restaurar `NOT NULL` nos horários: isso exigiria inventar dados. Não foi criado down destrutivo; rollback deve preservar o schema/dados e ser planejado separadamente. Nenhuma publicação foi realizada nesta entrega.

## Testes e evidências

Suíte completa: **564 testes aprovados, zero falhas**, em 613,783 segundos. Foram preservados os 540 testes disponíveis na base de trabalho e acrescentados 24: 16 de PostgreSQL e 8 de navegador. Os testes não usam contas nem registros reais.

Resultados finais: `dist/schedule-b11/tests-all.log`, `tests-sql-final.log`, `tests-browser-final.log`, `verification.json` e `visual-check.json`.

PostgreSQL 17 em Docker sem rede: futuro/virada de ano/fuso, configurações e versões, dias regulares/extraordinários, múltiplos ministérios por pessoa, desconhecido, indisponibilidade, limites, conflitos, duas gravações simultâneas, exceção autorizada/escopo/auditoria, acesso direto negado e horários antigos com microssegundos preservados.

Chromium: modo diário, planilha, flags, edição de outra linha preservada, navegação com pendências, configuração, recusa de desconhecidos por teclado, login e rotas do frontend completo, bloqueio de não administrador. HTTP Supabase é interceptado nesses testes; não há homologação remota implícita.

Verificação de montagem, planilha, configurações, exceção e calendário em 360, 390, 768, 1024 e 1440 px, sem estouro horizontal do documento. Capturas salvas em 390 e 1440 px; inspeção visual da configuração mobile e da planilha desktop. Não houve requisições externas nem erros de execução na verificação. Dispositivos físicos, Firefox e Safari não foram testados.

Homologação local: abra a prévia, confirme disponibilidades em Membros, gere o período em Montar escala, salve uma atribuição e tente usar a mesma pessoa no mesmo dia em outro departamento. Após observar o bloqueio, descarte apenas essa edição pendente, autorize uma exceção justificada em Configurações e repita a tentativa. Confira também uma pessoa sem flags, a alteração de período/dias e o histórico individual. A publicação nessa prévia é somente uma simulação em memória.

## Arquivos desta fase e prévia

Novos: `database/007_daily_schedules.sql`, `database/check_daily_schedules.sql`, `tests/test_schedule_daily_sql.py`, `tests/test_schedule_daily_browser.py`, `tests/fixtures/schedule-daily-preview.js` e este relatório.

Integração: `frontend/schedule-management.js`, `auth.js`, `app.js`, `navigation.js`, `index.html`, `styles.css`, `scripts/build_schedule_demo.py` e `scripts/export_preview.py`. O novo módulo continua no recurso já versionado da B1; o inventário de assets não foi reconstruído.

Prévia: `dist/schedule-b11/IASDPI-B11-revisao.html`, exportada por `scripts/export_preview.py --daily-preview`. Somente dados fictícios, CSP sem conexões externas, nenhum segredo ou cliente Supabase. Capturas e scripts de reprodução permanecem em `dist/schedule-b11/`.

## Ativação futura — não executada

1. Confirmar instalação de 001–006. Se ainda não aplicadas, revisar e executar 005, depois 006, antes da 007; não repetir migrações já instaladas.
2. Revisar a 007 e verificar casos legados com pessoa em vários departamentos na mesma data; não apagar nem gerar aprovações automaticamente.
3. Aplicar 007 primeiro em ambiente de homologação autorizado, como postgres. A migração é transacional.
4. Executar `check_daily_schedules.sql`, somente leitura: zero linhas é o esperado após instalação íntegra.
5. Com contas descartáveis, testar admin, gestor e usuário sem acesso; confirmar flags explicitamente, gerar período futuro e tentar gravações simultâneas. Autorizar uma exceção justificada e verificar auditoria.
6. Somente após nova aprovação preparar implantação do frontend. Nenhum dado real do Supabase foi consultado ou alterado nesta entrega.
