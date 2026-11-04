# Correção B1.2 — nomes informados, confirmações e conflitos

Branch `feat/schedule-management-b1`. Sem commit, push, merge, publicação ou acesso ao Supabase real.

## Causas e correções

A prévia anterior carregava participantes fictícios e disponibilidades de teste. A consulta 008 e a validação 007 tratavam outros rascunhos como compromissos confirmados. A consulta da proposta também precisava considerar reservas feitas dentro de um lote com vários departamentos.

- A prévia principal agora projeta os arquivos existentes da Agenda e do Organograma em um cadastro único de pessoas, departamentos e vínculos: 37 nomes e 25 departamentos normalizados. Há uma única entidade Diaconato com as lideranças de diáconos/diaconisas preservadas; isso não habilita ninguém como voluntário.
- Não há funções, habilitações, disponibilidades ou limites preenchidos automaticamente com nomes informados. A Fase A mantém seus cadastros; o Cadastro Geral oferece confirmação explícita de função e os controles de disponibilidade da B1.1. Limites vazios aparecem como pendentes, sem inventar um limite numérico; continuam opcionais quando não há política informada.
- As telas mensais consultam a mesma base apresentada no Cadastro Geral. A confirmação usa as RPCs já existentes para funções e vínculos, sem criar outra pessoa nem conceder permissão de login.
- O rodízio exclui compromissos confirmados na mesma data, independentemente de horários. Consulta os departamentos cruzados no backend e oferece motivos/alternativas. Outros rascunhos aparecem como possíveis disputas; alternativas sem disputa são priorizadas. Eles não consomem a quota confirmada de outro plano.
- Dentro do plano atual, atribuições já preenchidas e propostas durante a geração contam para distribuição/limites. A API pura `proposeBatch` reserva participantes entre departamentos do mesmo lote antes da próxima seleção, sem publicar automaticamente. A montagem visual continua por departamento; não foi acrescentada uma ação de publicação em lote.
- A publicação revalida todas as atribuições, inclusive quando a edição envia somente status, e mantém a serialização transacional e o CAS. Duas publicações conflitantes concorrentes não podem confirmar juntas.

## Pessoas e informações pendentes

Sonoplastia: Mini Lucas, Rafa, Samuel, Luan, Macedo, Paulitos e Raphael.

Comunicação: Henrique, Izabelle PI Souza, Simone/Profª de Pilates, macedo Logos e Letícia PI.

Rafa/Raphael, Macedo/macedo Logos, Lucas/Mini Lucas e Simone Cristina/Simone de Pilates permanecem entidades distintas. O texto histórico `Simone/Profªde Pilates 🧘` foi preservado; o nome no cadastro segue a grafia solicitada `Simone/Profª de Pilates`, com vínculo explícito àquela entrada.

Os responsáveis ministeriais do organograma foram reaproveitados como referências de liderança, sem habilitação implícita. Os anciãos conhecidos são referências do Ancionato, sem presumir função em um culto. Uma liderança não é uma conta administrativa e não recebe acesso por esse cadastro.

As identidades abaixo são **referências locais**, agrupadas somente por grafia exata fornecida. UUIDs são determinísticos desta prévia, não UUIDs consultados no Supabase. Homônimos e o mapeamento para os UUIDs reais exigem confirmação administrativa; não foi executada consolidação no banco. Os contatos privados não são importados.

Para todas as pessoas, disponibilidade semanal/por data, habilitação e limites estão pendentes até confirmação. Participação histórica não implica disponibilidade futura. As funções necessárias também devem ser confirmadas/cadastradas antes de gerar sugestões reais.

| Pessoa reaproveitada | Departamentos informados | Liderança ministerial informada |
|---|---|---|
| Henrique | Comunicação | Comunicação |
| Izabelle PI Souza | Comunicação | Não informada |
| Simone/Profª de Pilates | Comunicação | Não informada |
| macedo Logos | Comunicação | Não informada |
| Letícia PI | Comunicação | Não informada |
| Mini Lucas | Sonoplastia | Não informada |
| Rafa | Sonoplastia | Não informada |
| Samuel | Sonoplastia, Mordomia Cristã, Ancionato | Mordomia Cristã |
| Luan | Sonoplastia | Sonoplastia |
| Macedo | Sonoplastia | Não informada |
| Paulitos | Sonoplastia | Não informada |
| Raphael | Sonoplastia, Ministério da Família, Ancionato | Ministério da Família |
| Rose | Diaconato | Diaconato |
| Marciano | Diaconato | Diaconato |
| Luciana Abdias | Ministério da Criança | Ministério da Criança |
| Taislane | Ministério dos Adolescentes | Ministério dos Adolescentes |
| Luana | Ministério da Família | Ministério da Família |
| Simone Cristina | Ministério da Saúde | Ministério da Saúde |
| Glaucia | Ministério de Publicações | Ministério de Publicações |
| Alexandre | Música | Música |
| Renato | Escola Sabatina | Escola Sabatina |
| Rosana | Ministério Pessoal, Ancionato | Ministério Pessoal |
| João Pedro | Ação Solidária Adventista (ASA), Ministério Adventista das Possibilidades, Liberdade Religiosa | Ação Solidária Adventista (ASA), Ministério Adventista das Possibilidades, Liberdade Religiosa |
| Gislaine | Ministério da Mulher | Ministério da Mulher |
| Nilce | Recepção | Recepção |
| Cauê | Ministério Jovem | Ministério Jovem |
| Victoria | Clube de Desbravadores, Ancionato | Clube de Desbravadores |
| Valeska | Clube de Aventureiros | Clube de Aventureiros |
| Sandra | Terceira Idade | Terceira Idade |
| Sérgio | Patrimônio | Patrimônio |
| Paulo Scarpelini | Ministério dos Homens | Ministério dos Homens |
| Nelson | Gol da Esperança | Gol da Esperança |
| Adriano | Ancionato | Não informada |
| Lucas | Ancionato | Não informada |
| Elmo | Ancionato | Não informada |
| Márcia | Ancionato | Não informada |
| Márcio | Ancionato | Não informada |

## Histórico e migração 009 — preparada, não executada

Os 15 registros de Sonoplastia e 5 de Comunicação mantêm as datas, nomes originais e identificadores da fonte. `frontend/agenda.js`, `agenda-data.js`, `organization.js` e as migrações 005–008 permanecem inalterados. Não há restauração automática, exclusão ou substituição de dados.

A 009 cria uma tabela de **referências de compromissos históricos**, com FK para pessoas/departamentos existentes, fonte única, data, grafia original, autoria e timestamp. Não é outro cadastro de pessoas nem cria funções desconhecidas. A importação é opcional e explícita, via RPC administrativa `iasdpi_schedule_register_legacy`; exige mapeamento para UUIDs já existentes, é idempotente e não sobrescreve vínculos anteriores.

O banco vazio dessa tabela não conhece automaticamente os arquivos JavaScript publicados. Na produção, as referências históricas só entrarão na validação transacional depois da revisão do mapeamento e importação autorizada. A prévia principal já considera as 20 referências no seu estado local; não deve ser confundida com uma migração efetivada no Supabase.

A migração também atualiza o contexto de rodízio, a validação diária/quota, publicação parcial, proteção das exceções e consulta administrativa do histórico. Mantém RLS sem privilégios diretos, RPCs autenticadas com guardas de escopo/admin, proprietário postgres e search_path vazio; helpers privados sem execução pelos clientes. Não há chave administrativa no frontend.

Procedimento futuro: confirmar quais migrações 005–008 estão instaladas, revisar/aplicar apenas as pendentes em ordem e depois a 009, em homologação autorizada primeiro. Executar `database/check_confirmed_schedule_conflicts.sql` (somente leitura, espera-se zero irregularidades). Revisar os UUIDs históricos antes de chamar qualquer RPC de importação. Nada desse procedimento foi executado na produção.

Não há down automático destrutivo da 009: referências ou rascunhos novos podem depender do novo contrato. O site oficial e os pacotes anteriores permanecem preservados para revisão/rollback do frontend.

## Prévia e roteiro

- Principal: `dist/schedule-b12-correction/release/IASDPI-B12-corrigida.html`. Nomes informados; confirmações pendentes. Sem rede, sem gravação real, reinicia ao recarregar.
- Teste separado: `dist/schedule-b12-correction/release/IASDPI-B12-cenario-teste.html`. Somente voluntários A/B/C/D fictícios, com funções e disponibilidade explicitamente de teste. Usa as mesmas regras atualizadas de conflito/rascunho, sem nenhum nome ou histórico real. O botão de rodízio está pronto para clicar.

Na principal, abra Membros, confira a pessoa existente e confirme a função pelo formulário de habilitação. Confirme apenas os dias verificados e salve a linha. Na montagem, gere os eventos, selecione o dia e inclua as funções/vagas confirmadas. O rodízio deve deixar pendente quem ainda não tem informação suficiente. Não é necessário confirmar ninguém real para testar: abra o cenário fictício em outra aba.

## Testes e limites

Resultados: suíte completa com **615 testes aprovados** em 714,030 s, sem falhas. Depois foram acrescentados dois testes do cenário separado; a execução final dos 11 testes de nomes/cenário passou em 7,058 s, e os 12 testes SQL da versão final passaram em 47,479 s. São **617 cenários distintos aprovados**, com repetições identificadas nos logs; não foi declarada uma execução única de 617 testes.

Foram verificadas três telas em 360, 390, 768, 1024 e 1440 px (15 combinações), sem estouro horizontal da página. O link entre a prévia principal e o cenário separado foi aberto e o rodízio fictício preencheu 13 vagas, sem erros de execução ou requisições externas. Capturas em 390 e 1440 px; cadastro desktop e montagem mobile inspecionados visualmente.

Evidências em `dist/schedule-b12-correction/`: `tests-all.log`, `tests-known-final.log`, `tests-sql-final.log`, `visual-check.json`, `verification.json` e `captures/`.

A suíte completa inclui os testes anteriores e os novos cenários de cadastro, preservação de fontes, motor em lote e validação PostgreSQL. O cenário separado recebeu testes adicionais depois dessa execução. Os logs finais e o manifesto distinguem essas execuções, sem somar repetições como novos testes.

PostgreSQL 17 descartável, sem rede: publicação concorrente (somente uma confirma), atualização parcial/status, quotas, indisponibilidade/habilitação, rascunhos versus publicados, mapeamento histórico idempotente, RLS/privilégios, exceção em uso e preservação de dados antigos. Navegador Chromium com dados locais/interceptações; sem contas nem registros reais.

Sem homologação remota do Supabase, Safari, Firefox ou dispositivos físicos. As cinco larguras são verificadas em Chromium. A alteração de regras de rascunhos depende da 009; a aplicação não deve anunciar essa alteração no banco antes de sua instalação autorizada.

## Arquivos desta correção

Novos: `database/009_confirmed_schedule_conflicts.sql`, `database/check_confirmed_schedule_conflicts.sql`, `scripts/schedule_reference_preview.py`, `tests/fixtures/schedule-known-preview.js`, `tests/fixtures/schedule-confirmation-scenario-ready.js`, `tests/test_schedule_known_people.py`, `tests/test_schedule_confirmed_conflicts_sql.py` e este relatório.

Integração: `frontend/schedule-management.js`, `scripts/build_schedule_demo.py`, `scripts/export_preview.py` e novos testes no arquivo existente `tests/test_schedule_monthly_browser.py`. Não houve alteração na configuração Supabase, na main ou no site oficial.

Commit sugerido (não realizado): `fix: confirma participantes e antecipa conflitos nas escalas`.
