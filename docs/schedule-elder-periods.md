# Ancionato por semana e mês — prévia de revisão

Branch: `feat/schedule-management-b1`. Nenhum commit, SQL ou publicação executado.

## Comportamento

- **Ancião da semana:** um período completo de domingo a sábado. A chave é o tipo e o domingo inicial; a semana que atravessa meses mantém o mesmo UUID, pessoa e versão nas duas visualizações.
- **Ancião do mês:** área separada, do primeiro ao último dia do mês. Salvar/publicar uma área preserva as alterações pendentes e os registros da outra.
- A prévia reutiliza os dez anciãos cadastrados e exibe as referências semanais/mensais da cópia local da Agenda, sem modificar a fonte nem publicar atribuições novas automaticamente.
- O preenchimento automático propõe períodos vazios; preserva os preenchidos, considera histórico, limites e conflitos em todas as datas do intervalo, inclusive dias sem culto.
- Disponibilidade temporariamente desativada na nova prévia: não aparece como cadastro editável, não interfere nas sugestões e não é enviada ao salvar outros campos de membros. As regras anteriores continuam intactas. A configuração dos dias de culto não foi desativada.
- Os demais departamentos mantêm a montagem diária. O calendário público, os 15 registros de Sonoplastia e os cinco de Comunicação permanecem preservados.

## Arquivos

- `frontend/schedule-management.js`: períodos civis, áreas de anciãos, salvamento independente, navegação e pausa da disponibilidade.
- `frontend/schedule-foundation.js`, `frontend/styles.css`: cadastro de disponibilidade desativado nesse modo e apresentação responsiva.
- `scripts/build_schedule_demo.py`, `scripts/export_preview.py`: opção `--elder-periods` para HTML isolado.
- `tests/fixtures/schedule-elder-periods-preview.js`: RPCs **simuladas**, períodos canônicos, versões, validação de lotes e conflitos na aba.
- `tests/fixtures/schedule-known-preview.js`: preservação de campos de disponibilidade omitidos numa atualização parcial.
- `tests/test_schedule_elder_periods.py`: 12 testes novos. As sete suítes anteriores também foram executadas: 79 testes aprovados no total.

## Limites e integração operacional

Esta implementação de períodos está habilitada exclusivamente na demonstração em memória. `iasdpi_schedule_elder_workspace` e `iasdpi_schedule_elder_save` são contratos do adaptador local, **não funções instaladas no Supabase**. A 010 continua atendendo à montagem diária; esta entrega não a modifica.

Antes da ativação operacional, será necessário revisar uma migração específica para períodos semanais/mensais: chave única `(departamento, tipo, início)`, pessoa por FK, limites civis validados, status e versão; RPCs autenticadas com permissões ministeriais, lock transacional compartilhado com as escalas diárias, verificação de conflitos em todas as datas e auditoria. Os testes de concorrência desta entrega são do adaptador local, não comprovam RLS ou concorrência real no PostgreSQL para períodos.

Não há restauração ou conversão automática de escalas antigas. A visualização usa referências da Agenda; alterá-las na prévia não altera a Agenda original. Recarregar reinicia as alterações da demonstração.

## Revisão

Gerar HTML: `python scripts/export_preview.py --elder-periods --output CAMINHO_NOVO.html`.
Conferir novembro/dezembro de 2026, especialmente 29/11–05/12; alterar/salvar a semana e reabrir no mês seguinte; editar mensal e semanal sem interferência; testar preenchimento e tentativa com versão antiga; conferir membros e dados históricos.

Evidências: `dist/schedule-elder-periods/tests-final.log` e capturas desktop/mobile. Para rollback de visualização, as prévias anteriores e o site publicado no commit `453cc62` foram preservados.

## Ajuste de calendários — 29/10/2026

- Na prévia simplificada, Ministério da Criança fica inativo, com o mesmo ID, pessoas e vínculos preservados; não aparece na montagem e o adaptador recusa sua gestão enquanto inativo. O organograma original não é alterado.
- Comunicação gera vagas apenas aos sábados. Os eventos compartilhados continuam disponíveis aos outros departamentos. Atribuições previamente existentes fora de sábado continuam visíveis e editáveis; não há limpeza automática.
- Ancião da semana: grade mensal de domingo a sábado, números acima da seleção, uma lista suspensa por semana inteira. A quantidade de dias respeita o mês (28, 29, 30 ou 31); dias adjacentes completam a semana e aparecem discretamente.
- Ancião do mês: grade anual janeiro–dezembro, uma lista por mês e navegação de ano. Datas, IDs canônicos, referências da Agenda e versões são reutilizados. Rascunhos podem ser salvos parcialmente; publicar exige preencher todos os períodos da aba atual.
- O contrato antigo de consulta permanece compatível; `p_year` é opcional no adaptador demonstrativo e permite carregar os 12 meses. Gravação anual aceita até 12 períodos, com validação integral antes de alterar qualquer um, versão esperada e idempotência.
- Testes novos: `tests/test_schedule_calendar_adjustments.py`. Expectativas dos testes antigos foram adaptadas à grade anual e ao sábado comum entre Sonoplastia/Comunicação, preservando os cenários de regressão.
- Prévia: `dist/schedule-calendar-adjustments/IASDPI-calendarios-revisao.html`; cenário sintético separado: `IASDPI-B12-cenario-teste.html` no mesmo diretório. Capturas semanais/anuais desktop/mobile, log `tests-final.log` e `preview-check.json` acompanham a entrega.
- Sem SQL, migrações, Supabase, commits ou publicação neste ajuste. O publicado `daedfd8` permanece preservado. As limitações de integração operacional descritas acima continuam vigentes: dados desta prévia ficam somente na memória da aba.

Commit sugerido: `feat: adapta calendarios de ancioes e vagas de comunicacao`.

Resultado deste ajuste: 109 testes aprovados (8 novos), sem falhas; Chromium local em 360, 390, 768, 1024 e 1440px. Prévia HTML exata verificada por HTTP local, com hashes CSP válidos e somente requisições locais. Não houve teste de Supabase nem publicação.

## Exceção do Ancião do mês — 29/10/2026

A responsabilidade mensal não reserva todos os dias do mês: não bloqueia outras escalas e não é bloqueada por elas, tanto na seleção manual quanto no rodízio e nas gravações do adaptador da prévia. O Ancião da semana mantém os bloqueios em todo o seu intervalo. A política é centralizada em `IASDPIElderPeriods.conflictsEnabled` e reutilizada na projeção dos compromissos e na validação ao salvar/publicar.

Escalas mensais continuam no calendário, na fonte original e no histórico de versões. Exigências de pessoa ativa, vínculo ao Ancionato, permissões, cobertura e versão esperada permanecem. Não houve execução de SQL nem integração de períodos ao Supabase real. Os testes de conflitos continuam sendo da demonstração em memória, não de concorrência real no banco.

Prévia: `dist/schedule-monthly-conflict-off/IASDPI-anciao-mes-sem-conflito.html`. Casos novos em `tests/test_schedule_monthly_conflict_off.py`: liberação mensal nos dois sentidos, proposta automática, bloqueio semanal, vínculo/versão e preservação do histórico. Este ajuste não foi publicado.

## Apresentação compacta para homologação — 29/10/2026

A opção `--review-ready` nos geradores prepara a interface de Sonoplastia, Ancionato e Comunicação sem banners técnicos ou links para cenários de teste. Os outros departamentos e cadastros continuam disponíveis. As instruções extensas, a origem dos períodos e a limitação de armazenamento ficam em ajudas `?`, acessíveis por mouse, teclado e toque. Erros e estados de salvamento continuam visíveis. O botão de recarga foi renomeado para `Recarregar escala`; ele consulta a última versão salva e preserva a confirmação antes de descartar alterações pendentes. O preenchimento automático recebe destaque suave; `Ver calendário` mantém semântica de link com aparência de botão.

O modo compacto não altera permissões nem persistência e não pode ser combinado com o cenário fictício: os avisos desse cenário separado continuam explícitos. Os contratos e identificadores existentes são reutilizados. A exceção de conflitos do Ancião do mês permanece; semanas e demais departamentos mantêm suas validações.

Gerar: `python scripts/export_preview.py --review-ready --output CAMINHO_NOVO.html`. Prévia atual: `dist/schedule-review-ready/IASDPI-escalas-revisao-final.html`. Evidências: `tests-regression.log` (115 aprovados), `tests-review-final.log` (10 aprovados), capturas desktop/mobile e `result.json` no mesmo diretório. HTML final verificado por HTTP local; sem Supabase, SQL, commit ou publicação.

Na próxima publicação autorizada, usar o modo compacto e não reinjetar a navegação externa `Navegação B1.2`, banners ou links do cenário fictício no HTML limpo. Preservar os arquivos anteriores desse cenário e a raiz histórica. Rollback publicado preservado: `c1c8b08`.

Commit sugerido: `ui: simplifica apresentacao das escalas para homologacao`.

## Escolha imediata do mês em português — 29/10/2026

Na apresentação `--review-ready`, os campos nativos de mês foram substituídos por um seletor suspenso reutilizável: nome do mês em português, navegação de ano e grade de janeiro a dezembro. Selecionar um mês abre a escala sem botão de confirmação. O mesmo controle atende à montagem diária, às semanas do Ancionato e ao calendário de consulta. O ano da escala mensal do Ancionato também muda diretamente pela lista suspensa.

Os valores internos continuam em `YYYY-MM`. A troca preserva o aviso de edição pendente; cancelar restaura o mês exibido e mantém os campos. Escolher novamente o mês atual fecha o seletor sem descartar ou salvar dados. O controle oferece Escape, fechamento ao clicar fora, setas para navegar entre meses, retorno do foco e alvos de toque de 44px. Nenhuma biblioteca externa foi acrescentada. A apresentação anterior continua compatível.

Arquivos deste ajuste: `frontend/schedule-management.js`, `frontend/agenda.js`, `frontend/styles.css` e `tests/test_schedule_month_picker.py`. Prévia: `dist/schedule-month-picker/IASDPI-escalas-mes-portugues.html`; capturas desktop/mobile e evidências no mesmo diretório. Sem alteração de dados, Supabase, commit ou publicação.

Commit sugerido: `ui: abre escalas com seletor de mes em portugues`.

## Topo compacto e identidade visual — 29/10/2026

A apresentação de revisão usa uma faixa azul com monograma PI, identificação IASDPI/Parada Inglesa e destaque para a página atual. Montar escala, Calendário e Membros ficam visíveis; Cadastros e Configurações continuam no menu nativo `⋯`. O menu fecha após navegação aceita, Escape, saída do foco ou clique fora, sem ignorar a proteção de alterações pendentes. Voltar e Avançar atualizam o destaque do cabeçalho.

Em Chromium com viewport de 390px, a altura do cabeçalho caiu de 185px para 104px (43,8%). Alvos de toque continuam com pelo menos 44px. Os cinco tamanhos de tela e os acessos secundários foram verificados. Ajustou-se também o reconhecimento do bloco de origem no gerador da demonstração antiga, que já havia mudado de estrutura na apresentação compacta; suas mensagens e dados anteriores foram preservados.

Arquivos: `scripts/build_schedule_demo.py`, `tests/fixtures/schedule-b1-demo-navigation.js`, `frontend/styles.css`, `tests/test_schedule_compact_header.py`. Prévia: `dist/schedule-header/IASDPI-escalas-topo-compacto.html`; capturas desktop/mobile e `preview-check.json` no mesmo diretório. Nenhuma mudança no Supabase, SQL, commit ou publicação.

Commit sugerido: `ui: compacta cabecalho e reforca identidade das escalas`.

## Limpar a montagem atual — 30/10/2026

O botão `Limpar escala` retira os nomes da montagem atual, após confirmação que identifica mês/departamento ou a aba semanal/anual do Ancionato. Mantém datas, eventos, funções, quantidade de vagas, observações e os identificadores do registro. A ação só altera o formulário e marca alterações pendentes; nenhuma gravação ocorre até o usuário salvar. Recarregar escala pode recuperar a versão salva antes dessa confirmação de gravação.

Nos anciãos, limpar semanas não limpa a escala mensal; limpar o ano não interfere nas semanas. A mesma semana que cruza meses continua compartilhando o identificador. O cadastro e a fonte original da Agenda permanecem intactos. A última publicação continua visível no calendário ao editar ou salvar uma revisão como rascunho; uma escala vazia não pode ser republicada. O botão fica desativado quando não há nomes ou enquanto uma gravação está em andamento e não é oferecido na consulta ou no modo sem gestão.

Arquivos: `frontend/schedule-management.js`, `frontend/styles.css`, `tests/test_schedule_clear.py`. Os metadados de permissão recebidos na página de anciãos são reaplicados a cada renderização, para que a limpeza não use o catálogo anterior após recarga de permissões. Contratos SQL e IDs permanecem iguais. Prévia final: `dist/schedule-clear/IASDPI-escalas-limpar-final.html`. Sem Supabase, migração, commit ou publicação. A versão publicada `d8b69f4` permanece preservada.

Commit sugerido: `feat: permite limpar os nomes da escala em edicao`.

## Família, Criança, resumo e equipe de Música — 30/10/2026

- Família e Criança reutilizam os departamentos, UUIDs e vínculos já derivados do organograma. Família: Luana e Raphael. Criança: Luciana Abdias. Criança foi reativada por solicitação atual, substituindo a desativação anterior. Comunicação, Família e Criança têm novas vagas somente aos sábados; registros antigos fora desse padrão continuam preservados.
- Na apresentação de revisão, os seis departamentos principais ficam acessíveis: Sonoplastia, Ancionato, Comunicação, Família, Criança e Música. Os demais continuam nos acessos existentes.
- O bloco de feedback e os indicadores da montagem diária ficam imediatamente depois do calendário, antes da tabela de distribuição. O contador de períodos do Ancionato também fica depois de seu calendário.
- Música usa checkboxes na participação geral diária, permitindo várias pessoas no mesmo dia. A quantidade de vagas acompanha a seleção manual, com mínimo de uma vaga quando ninguém está marcado, respeitando o formato existente (`required_count` entre 1 e 100). Cada pessoa mantém uma atribuição e UUID próprios; desmarcar uma não recria as outras. Funções específicas antigas continuam compatíveis.
- Vínculo ativo, atividade da pessoa e conflitos continuam verificados na seleção e novamente ao salvar/publicar. Pessoas previamente salvas que perderam vínculo continuam visíveis para correção; não são apagadas silenciosamente. Limpar escala continua retirando nomes sem apagar datas, vagas ou observações. A publicação anterior permanece enquanto a nova versão está em rascunho.
- Na base entregue, Música possui apenas Alexandre. Nenhum outro músico, disponibilidade ou habilitação técnica foi inventado. Os testes de equipe múltipla adicionam vínculos a cópias descartáveis, não ao cadastro entregue nem ao Supabase.

Não há necessidade de novo formato de dados para a equipe: as atribuições e a quantidade de vagas já suportam múltiplas pessoas. Nenhum SQL foi executado e não houve commit ou publicação. Prévia: `dist/schedule-family-children-music/IASDPI-escalas-ampliadas-final.html`.

Arquivos: `frontend/schedule-management.js`, `frontend/styles.css`, `scripts/build_schedule_demo.py`, `tests/fixtures/schedule-known-preview.js`, `tests/test_schedule_family_music.py`, `tests/test_schedule_review_ready.py` e `tests/test_schedule_calendar_adjustments.py`. A expectativa antiga de Criança inativa foi atualizada porque o pedido atual reativa esse departamento.

Validação: 10 testes novos e 57 de regressão aprovados. Evidências em `dist/schedule-family-children-music/`. Sem validação de banco real; este módulo continua em memória na prévia.

Commit sugerido: `feat: inclui familia e crianca e permite equipe multipla em musica`.
