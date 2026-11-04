# Correção — mês atual e preenchimento automático

Branch: `feat/schedule-management-b1`. Validação local em 04/11/2026; nenhum SQL aplicado ao Supabase real.

## Causas identificadas

A montagem ainda selecionava o primeiro mês futuro ao abrir. Novembro podia ser selecionado, mas exigia o botão Começar escala, enquanto o fluxo habitual mostrava somente os meses previamente preparados. O rodízio também podia terminar com zero sugestões porque os nomes do Cadastro Geral não possuem, por padrão, participação, habilitação e disponibilidade confirmadas; o retorno anterior não orientava suficientemente o usuário.

## Regra de edição

- A data atual e o mês são definidos em `America/Sao_Paulo`.
- O mês atual sempre está liberado, a partir de hoje, para quem já possui permissão do departamento. Ontem e dias anteriores ficam somente para consulta, inclusive para administrador.
- O mês seguinte está incluído no período futuro. O administrador pode liberar 1, 2, 3 ou 6 meses no campo **Meses futuros liberados**, acessível pelo botão **Período de edição** na montagem ou por Administração → Configurações de escalas.
- O campo existente `planning_months` é reutilizado; seu valor anterior (inclusive o padrão de dois meses) foi preservado. A quantidade escolhida libera todos os meses entre hoje e o fim desse período.
- Alterar a configuração não apaga escalas. Meses fora do intervalo continuam disponíveis para consulta.
- A geração em lote continua começando no próximo mês. A preparação do mês selecionado é uma operação separada, idempotente, que inclui o mês atual e prepara somente datas ainda editáveis nos dias configurados para o departamento.
- A tela abre no mês atual e prepara automaticamente as vagas; não é necessário procurar um botão de geração. Preparar vagas vazias de uma escala nova não dispara aviso de perda de escolhas antes de o usuário escolher pessoas.
- Escolhas publicadas podem ser revisadas somente com a permissão de publicação já exigida anteriormente. Não houve ampliação de permissões por apelido, liderança ou organograma.

No Ancionato, semana e mês continuam unidades indivisíveis. Um período inteiramente encerrado fica bloqueado; a semana/mês em curso pode ser revisado, mantendo intervalo e histórico. O calendário anual preserva os 12 meses, com seletores desabilitados fora do período autorizado. Não foram criadas divisões diárias de períodos de anciãos.

## Rodízio

A proposta ignora dias encerrados e meses não liberados, preserva escolhas existentes, verifica compromissos publicados de todos os departamentos, habilitações, disponibilidade e limites. Pessoas desconhecidas não foram marcadas como disponíveis. Quando não há pessoa elegível, aparecem **0 vagas sugeridas**, **Conferir equipe** e um `?` com os motivos. A seleção manual continua submetida às regras anteriores, inclusive seus avisos e bloqueios.

Para testar o automático, confirme explicitamente participação, habilitação para a função e dias no Cadastro Geral. Testes isolados confirmaram duas pessoas, preencheram as 12 datas restantes de novembro de 2026 com distribuição equilibrada e mantiveram a escolha manual inicial. Outro teste publicou um compromisso fictício de Comunicação e verificou que Sonoplastia escolheu uma alternativa nessa data. Essas confirmações são exclusivamente dos testes, sem alterar disponibilidades reais nem os dados iniciais da demonstração.

O automático da Música permanece desativado conforme solicitado anteriormente. A seleção múltipla manual continua disponível.

## Backend e integridade

Migração incremental **023_schedule_edit_window.sql**, após 001–022. Não cria tabelas ou outro cadastro de pessoas. Acrescenta limites ao catálogo/configuração e contexto de rodízio, valida edição temporal nas RPCs de eventos operacionais, escala mensal e Ancionato, e acrescenta `iasdpi_schedule_prepare_month` para preparar o mês selecionado.

A escrita usa o mesmo bloqueio transacional das configurações/permissões, revalida usuário/igreja/departamento e preserva controle de versão. A comparação normalizada de funções/atribuições passadas impede adulteração, inclusão e remoção por uma requisição forjada. O núcleo mantém as linhas passadas fisicamente intactas, inclusive IDs e autoria. Vagas passadas vazias não exigem preenchimento retroativo para publicar o restante do mês.

`check_schedule_edit_window.sql` é somente leitura e deve retornar zero irregularidades. `023_schedule_edit_window_down.sql` restaura as funções anteriores sem apagar dados, versões ou configuração. A reversão também remove o bloqueio temporal: exige revisão administrativa e deve ocorrer antes de reverter a 022. Não usa CASCADE.

## Arquivos

- `frontend/schedule-management.js`: política compartilhada de datas, mês atual, preparação, bloqueios, rodízio, Ancionato e acesso à configuração.
- `frontend/styles.css`: identificação discreta de datas encerradas e ajuda do rodízio.
- `scripts/export_preview.py`: inclui a política no adaptador integrado isolado.
- `tests/fixtures/schedule-edit-window-preview.js`: simula as RPCs da 023 sem rede.
- `tests/fixtures/schedule-known-preview.js`: reserva datas encerradas e valida publicação das vagas editáveis na mesma fonte de pessoas.
- `tests/test_login_month_music_browser.py`: atualiza o cenário de novembro para abertura e preparação automáticas.
- `tests/test_schedule_edit_window_browser.py`, `tests/test_schedule_edit_window_sql.py`, `tests/schedule-edit-window.test.mjs`: regressões de interface, PostgreSQL e motor.
- Migração 023, down e verificação somente leitura em `database/`.

## Prévia e limites

Gerar: `python scripts/export_preview.py --event-management-preview --output dist/schedule-edit-window/IASDPI-escalas.html`.

Acesso exclusivamente fictício: `admin.iasdpi` / `Demonstracao#2026`. Entre em Escalas → Sonoplastia. Novembro abre com listas em 04/11 ou depois; 01–03/11 ficam encerrados. Para testar um horizonte apenas até dezembro, abra Período de edição e selecione 1 mês.

**96 cenários selecionados aprovados, sem falhas finais:** 14 PostgreSQL, 48 outros testes Python de navegador/regressão e 34 Node. Casos repetidos são contados uma única vez, usando o resultado mais recente. Não representa uma execução integral de todas as suítes históricas. O HTML independente entregue passou ainda por três rechecagens de abertura de novembro e rodízio (casos repetidos, sem aumentar a contagem).

Resultados consolidados em `docs/schedule-edit-window-023-validation.json`; evidências locais em `dist/schedule-edit-window/`. PostgreSQL descartável sem rede e Chromium local; não houve validação em aparelhos físicos, Firefox, Safari ou Supabase real. O funcionamento do backend real depende da instalação autorizada da 023; o Pages utiliza apenas a simulação em memória.

Commit sugerido para revisão: `fix: libera mes atual e valida edicao e rodizio por data`.

## Testar sem publicar

Pacote `dist/schedule-edit-window/IASDPI-teste-local.zip`: extraia em uma pasta do computador e execute `python abrir_previa.py` (Python 3; Windows também aceita `py abrir_previa.py`). O navegador abre em um endereço 127.0.0.1, acessível somente nesse computador. O pacote contém o HTML exato, o inicializador e COMO_TESTAR.txt. Não instala dependências e não conecta ao Supabase.

Quatro fluxos foram rechecados no Chromium pelo próprio servidor do pacote: abertura de novembro, salvar/recarregar, rodízio com confirmações e conflito publicado de outro departamento. Todos passaram; são reexecuções, sem aumentar os 96 casos únicos. Abertura file:// foi bloqueada pelo administrador do navegador deste ambiente, por isso o caminho homologado é HTTP local. Essas verificações ocorreram antes da publicação. O usuário autorizou posteriormente commit/push da branch de desenvolvimento e publicação estática exclusivamente em IASDPI-homologacao; a versão deve ser conferida no manifesto de /integrada/.
