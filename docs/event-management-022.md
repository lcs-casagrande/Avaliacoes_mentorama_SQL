# Gestão de Eventos — recorrências, espaços e aprovação

Revisão local de 04/11/2026, branch `feat/schedule-management-b1`. Os testes foram concluídos antes do commit. O usuário autorizou posteriormente commit, push da branch de desenvolvimento e publicação estática apenas em `IASDPI-homologacao`; a versão publicada deve ser conferida no manifesto de `/integrada/`. Não houve criação de contas, execução de migrações ou acesso ao Supabase real.

## Diagnóstico e solução

O módulo já utiliza `iasdpi_events`, versões imutáveis, RPCs autorizadas, igreja selecionada e permissões por departamento. `schedule_events` atende à montagem de escalas e não foi substituída nem vinculada automaticamente aos eventos editoriais. O calendário e os filtros existentes foram reutilizados.

O formulário passa a ter quatro seções: Informações do evento, Organização, Locais e reservas, Participação e visibilidade. Há um único Responsável / Organizador e um único Público-alvo. A organização administrativa permanece armazenada internamente para autorização; escolher um organizador não concede privilégios. Um departamento pode organizar uma Programação Geral. A opção Restrito continua independente e aparece abaixo do Público-alvo.

Dia inteiro fica ao lado dos horários e desabilita os campos. Nave, Quadra, Pátio, Salas e Externo são selecionados em lista expansível com checkboxes. As três primeiras opções são exclusivas; as duas últimas admitem utilização simultânea.

## Recorrência e edição

- Sem repetição, semanal por dia da semana ou mensal por posição (1ª–4ª/última) e dia.
- Novas séries terminam em 31 de dezembro do ano corrente em `America/Sao_Paulo`; frontend e PostgreSQL calculam o limite. Datas além dele são rejeitadas. Séries existentes preservam o limite original nas edições.
- Edição de uma ocorrência, desta e das próximas ou da série inteira. Cancelamento preserva registros e versões. Alterar o padrão cancela datas removidas com histórico, mantendo os IDs das datas que permanecem.
- Atualizar a lista não atualiza silenciosamente a versão-base de um formulário com alterações: uma edição concorrente deve ser recarregada e comparada.
- Eventos únicos antigos continuam editáveis, com campos históricos preservados. Converter automaticamente um evento antigo em série foi desabilitado para não perder sua identidade; uma série pode ser criada separadamente.

## Reservas, concorrência e privacidade

Os intervalos usam `[início, fim)`, fuso São Paulo e precisão de microssegundos no PostgreSQL. Um evento pode começar exatamente no fim do anterior. Dia inteiro inclui todos os dias até a data final. Sem Dia inteiro, confirmar uma nova reserva exclusiva exige intervalo completo válido; dados incompletos podem permanecer em rascunho.

A validação verifica cada ocorrência. A gravação revalida sob bloqueio transacional; a constraint de exclusão GiST impede reservas exclusivas simultâneas da mesma igreja/espaço. Atualizações exigem versão esperada. Somente eventos publicados confirmam novas reservas; rascunhos preservam a reserva da versão anteriormente publicada, quando houver, até nova publicação ou cancelamento.

Conflitos mostram espaço, data, intervalo e evento ocupante autorizado. Detalhes privados e títulos de revisões ainda não publicadas não são revelados a outros gestores. Locais antigos são considerados apenas quando o texto corresponde exatamente a um espaço conhecido. Horários antigos ausentes são sinalizados para revisão, sem inventar precisão ou regravar o registro. Textos de locais ambíguos não são associados automaticamente.

Evento único com conflito permanece bloqueado. Série com conflitos oferece **Continuar e enviar para aprovação**: salva ocorrências e conflitos, sem publicar nem confirmar novas reservas. A prévia é informativa; não substitui a validação transacional.

## Estados

| Dimensão | Estados e comportamento |
|---|---|
| Publicação | Rascunho, Publicado, Cancelado |
| Aprovação | Pendente, Aprovado, Rejeitado, Não exigida; Legado preserva registros anteriores |
| Nova Programação Geral | Pendente e rascunho, mesmo sem conflito |
| Programação Departamental/Atividade Reservada sem conflito | Mantém permissões de publicação e restrição existentes |
| Série com conflito | Pendente, fora do calendário público |

Pendência/rejeição não pode ser removida pelo solicitante alterando a categoria ou resolvendo apenas o conflito. A interface/RPC de decisão de um ancião autorizado, notificações e novos fluxos administrativos **não fazem parte desta entrega**. Por isso, novos eventos pendentes ainda não podem completar a aprovação nesta etapa.

## Arquivos desta entrega

| Arquivo | Alteração |
|---|---|
| `frontend/agenda.js` | Motor de recorrência, formulário, conflitos, estados e edição de séries |
| `frontend/auth.js` | RPC de prévia adicionada à lista de consultas permitidas |
| `frontend/styles.css` | Seções e formulário responsivo |
| `scripts/export_preview.py` | Opção `--event-management-preview` |
| `database/022_event_planning.sql` | Persistência, autorização, concorrência e reservas |
| `database/022_event_planning_down.sql` | Reversão protegida antes do uso |
| `database/check_event_planning.sql` | Verificação somente leitura de RLS, privilégios, RPCs e integridade |
| `tests/fixtures/event-planning-preview.js` | Adaptador demonstrativo em memória, sem Supabase |
| `tests/fixtures/events-preview.js` | Identidade demonstrativa também considera os espaços; suporte controlado ao adaptador 022 |
| `tests/event-planning.test.mjs` | Casos do motor puro |
| `tests/test_event_planning_browser.py` | Fluxos e responsividade no Chromium |
| `tests/test_event_planning_sql.py` | Persistência, RLS, concorrência, histórico e rollback reais em PostgreSQL descartável |

Alterações locais anteriores de login integrado, sessão, seleção de mês e Música foram preservadas, incluindo seus testes. Não foram descartadas nem apresentadas como novas funcionalidades de Eventos.

## Migração e recuperação

A ordem incremental é 001–019 existentes → `020_calendar_events.sql` → `021_calendar_classification_privacy.sql` → **022**. Somente 022 é nova nesta entrega. Ela reaproveita eventos/versões e acrescenta espaços, série, versões de série e reservas; não cria outra fonte de eventos ou pessoas. Depende de `btree_gist` e preserva o schema da extensão caso ela já esteja instalada.

Novas tabelas usam RLS forçada por igreja e não concedem consulta/escrita direta a `anon`/`authenticated`. RPCs executam com identidade controlada, `search_path` vazio e revalidam igreja, usuário e departamento. A listagem pública continua pela RPC existente, excluindo pendências e restritos. `check_event_planning.sql` deve retornar zero irregularidades.

O frontend novo depende da capacidade `event_management_v2` do catálogo. Sem 022, mantém o formulário anterior; sua existência no código não comprova instalação no Supabase.

Antes de qualquer ativação: backup consistente e restauração de ensaio em projeto isolado; verificar 001–021 e extensões; aplicar 022 apenas após autorização; executar o check e os fluxos com contas de homologação. Não usar esta instalação descartável como prova do estado da produção.

O down recusa reversão quando encontra séries, reservas, metadados novos ou configuração de espaços alterada. Antes do uso, restaura RPCs e índice anteriores sem excluir dados históricos. Após uso, o procedimento é restaurar backup em projeto isolado, conferir contagens/IDs/versões/permissões e reconciliar explicitamente mudanças posteriores antes de trocar o ambiente. Não há reversão destrutiva automática ou `CASCADE`. A extensão não é removida.

## Prévia e homologação

Gerar: `python scripts/export_preview.py --event-management-preview --output dist/event-management/IASDPI-eventos.html`.

Abrir o HTML independente, Entrar com **admin.iasdpi / Demonstracao#2026** (credenciais exclusivamente fictícias) e acessar Eventos → Novo evento. A igreja padrão é IASD Parada Inglesa. O adaptador simula Auth/RPC em memória; alterações reiniciam ao recarregar e a CSP bloqueia conexões externas. As fontes históricas previamente autorizadas permanecem separadas dos eventos sintéticos criados para testar.

Testar: publicar uma Programação Departamental com Nave e Pátio; tentar outra sobreposta; criar série semanal conflitante e confirmar envio para aprovação; criar Programação Geral com responsável departamental; editar uma ocorrência ou toda uma série. As pendências não devem aparecer no calendário público.

Capturas: `dist/event-management/eventos-form-desktop.png` e `eventos-form-mobile.png`. Larguras verificadas: 360, 390, 768, 1024 e 1440 px, incluindo navegação por teclado. Não foi testado em aparelho físico, Firefox, Safari ou Supabase real.

**374 cenários únicos aprovados, zero falhas/erros finais:** 48 no PostgreSQL, 298 outros casos Python (navegador, integridade e regressão) e 28 no Node. Resultados consolidados estão em `docs/event-management-022-validation.json`.

Comandos principais: `PYTHONPATH=tests python -m unittest test_event_planning_browser test_events_browser test_calendar_privacy_browser -v`; `IASDPI_PG_TEST_CONTAINER=<descartavel-sem-rede> PYTHONPATH=tests python -m unittest test_event_planning_sql test_events_sql test_calendar_privacy_sql -v`; `node --test tests/*.test.mjs`. O primeiro comando usa adaptadores locais; o segundo exige apenas contêiner PostgreSQL descartável, nunca um projeto Supabase real. Os logs locais ficam em `dist/event-management/`; a contagem consolidada considera cada cenário apenas uma vez e usa a última execução nas verificações repetidas. Não representa uma execução integral de todas as suítes históricas do projeto.

Commit sugerido, para revisão futura: `feat: reorganiza eventos com recorrencias e reservas protegidas`.
