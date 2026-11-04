# IASDPI — B1.2: montagem mensal e rodízio

## Escopo e preservação

Implementação na branch `feat/schedule-management-b1`, sobre a B1.1. Não houve commit, push, merge, publicação, consulta ao Supabase real ou execução de migração em produção. A main não foi alterada.

Agenda oficial, escala de Sonoplastia (15 registros), Comunicação, períodos de anciãos e organograma permanecem nos mesmos arquivos. Migrações 005–007 não foram reescritas. Participantes continuam separados de contas Auth; responsável ministerial não recebe permissão automaticamente.

## Implementado

- Montagem mensal como visão principal após instalação da 008. Botões abrem a visão específica de cada departamento autorizado, reutilizando um componente; novos departamentos aparecem a partir do cadastro.
- Nome, responsável ministerial, calendário, funções/vagas por dia, participantes habilitados, distribuição e ações de pré-preencher/salvar/publicar. Responsáveis vêm de vínculos marcados como liderança; na ausência deles, a aplicação usa somente a referência já existente do organograma, quando disponível. Sem informação: “Não informado no cadastro”. Não há inserção automática de líderes no banco.
- Calendário domingo–sábado com as cores já usadas: Sonoplastia azul, Diaconato verde, Música roxo, Ancionato dourado. No celular, células compactas abrem detalhes completos, acessíveis por teclado. A cor não substitui os nomes/descrições acessíveis.
- Clique em um dia permite escolher evento/função, quantidade de vagas, pessoa, substituição, remoção da atribuição ou função e observações. Vaga vazia é permitida em rascunho. Quando há vários eventos no dia, o usuário seleciona os eventos explicitamente.
- Indicadores de total/preenchidas/pendentes, pessoas distintas e atribuições com impedimentos. Distribuição por pessoa mostra atribuições no mês e dias do histórico. Ausência de contexto de validação aparece como “Não verificado”.
- Visão antiga em lista, comparação, histórico de versões, eventos extraordinários, geração administrativa do período e cadastros da B1.1 continuam acessíveis.

## Rodízio e integridade

O botão **Pré-preencher por rodízio** consulta novamente cadastro, permissões e contexto de conflitos. A proposta é uma cópia editável: não grava nem publica, não substitui atribuições existentes e preserva seus IDs/timestamps. Se a versão do banco mudou, a proposta é recusada até atualizar/comparar.

Cada vaga considera pessoa ativa, vínculo ativo, função ativa/habilitada, disponibilidade explicitamente confirmada na data, ausência de conflito entre departamentos e limites globais/do vínculo. Desconhecido não significa disponível. Exceção administrativa existente pode liberar o conflito diário, mas não dispensa as demais regras.

Prioridades: menor número de dias já atribuídos no mês, evitar repetir participantes da rodada, menor participação histórica e posição no cursor circular. O cursor continua após a pessoa com participação publicada mais recente anterior ao mês; empates têm ordem estável por UUID. O histórico considerado é o estado atualmente publicado dos planos anteriores ao mês; não são somados snapshots repetidos de versões.

As atribuições existentes entram na distribuição e não são removidas. Limites contam dias distintos, preservando a regra da 007; duas funções do mesmo departamento no mesmo dia não consomem dois dias. Os indicadores de participações mostram separadamente a quantidade de atribuições. Se não existe pessoa elegível, a vaga permanece pendente com os motivos consultáveis.

Horários legados permanecem íntegros, incluindo microssegundos. O cálculo de dias ocupados trata intervalos exclusivos no término e o fuso `America/Sao_Paulo`, inclusive um término com fração residual imediatamente após meia-noite. Não modifica nem arredonda os valores enviados ao salvamento.

O motor do navegador ajuda a montar a proposta; não é a barreira de segurança. As RPCs/gatilhos da 007 continuam revalidando gravações, disponibilidade, quotas, CAS e conflitos sob a trava transacional compartilhada. Uma alteração simultânea pode invalidar uma sugestão; nesse caso o salvamento é recusado, mantendo o formulário para revisão.

## Migração incremental 008 — não aplicada

`database/008_monthly_rotation.sql` cria a RPC de leitura `iasdpi_schedule_rotation_context(uuid,date)` e estende o workspace para ativar a visão mensal. Não cria tabelas, pessoas, funções ou atribuições e não altera cultos.

O contexto contém somente pessoas vinculadas ao departamento solicitado, disponibilidade resumida por data, datas já ocupadas para cálculo de limite, contagem/última data publicada anterior ao mês e responsáveis cadastrados. Um conflito externo é booleano: não expõe o nome do departamento externo, sua escala, observações, contatos ou contas.

A RPC exige gestor do departamento ou admin. Proprietário postgres, `SECURITY DEFINER`, `search_path=''`, execução somente authenticated e guarda interna. O workspace mantém as verificações anteriores de consulta; leitores autorizados recebem a visão mensal sem o contexto privado de rodízio. O helper movido para schema privado não é executável pelos clientes.

Ativação futura, somente mediante autorização:

1. Confirmar quais migrações já estão instaladas; aplicar apenas as pendentes em ordem 005 → 006 → 007 → 008, após revisão/homologação. Não repetir automaticamente as instaladas.
2. Aplicar a 008 em transação como postgres, primeiro em homologação autorizada.
3. Executar `database/check_monthly_rotation.sql` (somente leitura): resultado esperado sem irregularidades. Executar também os checks anteriores pertinentes.
4. Testar contas descartáveis de admin, gestor de um departamento e leitor. Testar quota, disponibilidade desconhecida, edição simultânea e publicação com vaga vazia.
5. Homologar o frontend; preparar publicação somente após autorização.

Rollback da 008: `database/008_monthly_rotation_down.sql` restaura somente as funções da 007; não remove tabelas nem dados. O frontend mantém fallback para a montagem B1.1 sem a 008. O rollback foi incluído nos testes PostgreSQL descartáveis. Não executar downs das fases anteriores como parte deste procedimento.

## Calendário público

O calendário público existente permanece inalterado. Rascunhos da nova montagem não são consultados por ele. A publicação operacional continua registrada/versionada internamente, mas sua integração com a fonte pública ainda exige autorização específica; a tela informa essa condição. Não foram concedidas novas permissões anônimas.

Na demonstração isolada, somente escalas fictícias publicadas aparecem no calendário demonstrativo, separado dos registros históricos reais. Nada é enviado ao site oficial.

## Arquivos e evidências

**Resultado final: 588 testes aprovados, zero falhas e zero testes ignorados, em 654,884 segundos.** Os 564 testes anteriores foram preservados; a B1.2 acrescenta 24 (14 de navegador/motor e 10 de PostgreSQL). A suíte completa terminou com `OK`.

Novos: `database/008_monthly_rotation.sql`, `008_monthly_rotation_down.sql`, `check_monthly_rotation.sql`; `tests/test_schedule_monthly_sql.py`, `test_schedule_monthly_browser.py`, `tests/fixtures/schedule-monthly-preview.js`; este relatório.

Integração: `frontend/schedule-management.js` (componente existente e motor puro), `frontend/auth.js` (nova consulta no transporte de leitura), `frontend/styles.css`, `scripts/build_schedule_demo.py`, `scripts/export_preview.py`. Não há novo SDK, cliente Auth ou asset obrigatório.

Prévia: `dist/schedule-b12/IASDPI-B12-revisao.html`. Banner de demonstração, pessoas e histórico fictícios, disponibilidade fictícia explicitamente cadastrada. CSP sem conexões externas; não inclui credenciais ou cliente Supabase. Salva somente na memória da aba; recarregar reinicia a demonstração. Isso não comprova persistência remota.

Evidências: `dist/schedule-b12/tests-all.log`, `tests-monthly-evidence.log`, `visual-check.json`, `verification.json`, `captures/`. A suíte completa é o resultado final de referência; logs de execuções interrompidas ou parciais durante ajustes não representam a aprovação final.

Foram verificadas dez combinações de página/largura (montagem com proposta e detalhes de conflito, em cinco larguras), sem estouro horizontal do documento, erros de execução ou requisições externas. Capturas salvas em 390 e 1440 px e inspecionadas visualmente. Pacote estático e hashes CSP conferidos. `git diff --check` sem problemas.

Testes PostgreSQL: migração não altera dados anteriores, escopo/permissões, disponibilidade, conflito externo com metadados mínimos, exceção, quotas/contexto, IDs/versionamento/persistência, leitura sem mutação, concorrência/CAS preservados e rollback. As regressões da 007 incluem duas gravações simultâneas no mesmo dia.

Testes Chromium: distribuição equilibrada/circular, continuidade histórica, desconhecidos/indisponíveis/inativos/sem habilitação, limites inclusive zero, campos históricos intactos e borda de microssegundos, proposta sem salvamento, edição/substituição/remoção, vagas pendentes, retry preservando formulário, evento extraordinário, departamento adicional sem componente novo, teclado e cinco larguras (360/390/768/1024/1440).

## Homologação sugerida

1. Abrir a prévia e conferir Sonoplastia, Diaconato, Música e Ancionato.
2. Expandir “Preparar eventos e informações da escala” e gerar os dias do período futuro.
3. Selecionar uma data, adicionar função/vagas, repetir para outras datas e pré-preencher. Revisar distribuição e impedimentos.
4. Substituir uma pessoa, deixar uma vaga vazia e salvar rascunho; atualizar do banco simulado para confirmar o mesmo plano. Publicar com pendência deve falhar.
5. Tentar a mesma pessoa/data em outro departamento. Consultar os motivos e autorizar exceção apenas pela configuração administrativa, quando apropriado.
6. Completar vagas, confirmar publicação demonstrativa e consultar o calendário fictício. Conferir que nenhuma escala histórica foi alterada.

## Limites

Sem testes de produção, SMTP, contas reais ou Supabase remoto. Persistência, RLS e concorrência verificadas em PostgreSQL descartável; navegação/transportes simulados em Chromium. Safari, Firefox e aparelhos físicos não foram homologados. Mudanças de cadastro/conflito posteriores à consulta sempre exigem validação final no salvamento. Não foi implementada publicação pública de novas escalas, troca de participantes, notificações ou alteração de regras administrativas fora da B1.2.
