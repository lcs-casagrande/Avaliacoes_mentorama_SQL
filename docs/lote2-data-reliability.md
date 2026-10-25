# Lote 2 — Confiabilidade dos dados

## Base e preservação

Branch de trabalho: `fix/data-reliability-lote2`, diretório `/workspace/iasdpi-lote2`.
Base Git: `a26edac0ca11ae51b8c2463febcc8e0fb5058b74`, acrescida de TODOS os
arquivos não commitados do Lote 1. A cópia foi comparada byte a byte antes das
alterações. `/workspace/iasdpi-lote1` e a branch `fix/drafts-lote1` permanecem
intactos; nenhum commit ou merge foi necessário para copiar o trabalho.
O diretório original `/workspace/IASDPI` também não foi modificado.

Referência: [relatório do Lote 1](lote1-drafts.md).
`frontend/drafts.js`, seus 20 testes e seu relatório permanecem integrais.
Os hooks de captura, restauração, autenticação e confirmação de gravação continuam
ativos nos três formulários. Não foram implementados os Lotes 3–5.

## Problemas, causas e correções

| Problema | Causa | Correção |
| --- | --- | --- |
| Leitura aceita 09:30:00, exportação rejeita | Regex HH:mm exclusiva no backup; execução validada por Date em vez do leitor tolerante | `validRecordClock` e `inspectRecordTime` compartilhados, sem transformar o documento exportado |
| Backup histórico não pode ser restaurado no schema operacional | Migração 003 exige previstos HH:mm e execuções com data | Prévia explícita de adaptação, mantendo o documento original em `backup_source.document`; nenhuma gravação antes da confirmação |
| Falha de consulta confundida com ausência de registros | Lista inicial vazia sem estado independente da consulta | Estados idle/loading/records/empty/error, botão Tentar novamente e troca atômica da lista após obter todas as páginas |
| Consulta seguinte apaga contexto ou responde depois do logout | Atualização sem controle de geração e sessão | Resultado atrasado descartado; erros preservam a última lista e não substituem campos em edição |
| Histórico exibe NaN% | Divisão pelo total zero | Sem amostra, apresenta Dados insuficientes; mediana vazia e média vazia retornam null |
| Resumo dá 0 min ou classifica incompleto como pontual | Desvio inicial zero; null somado/coagido a zero; eventos com qualquer término entram na amostra | Validação dos intervalos, exclusão explícita de dados incompletos/inválidos e classificação neutra |
| Mediana e médias ocultam a base de cálculo | Apenas valores aceitos eram visíveis | Quantidade considerada/desconsiderada, separando ausentes de inválidos |

## Compatibilidade de backups

- Formato externo continua `IASDPI-backup`, versão 1; arquivos antigos sem cifra
  continuam legíveis. AES-GCM, PBKDF2, exigência e confirmação da senha continuam
  funcionando. Senha incorreta ou arquivo adulterado não produz restauração.
- Exportar, decifrar, validar e restaurar localmente não normaliza os valores:
  HH:mm, HH:mm:ss, frações, offsets históricos, IDs, status legados, notas,
  responsáveis, atividades extras, subatividades e campos desconhecidos são mantidos.
- A validação é de estrutura e formatos reconhecidos, não uma recuperação
  automática de registros corrompidos. Valores realmente inválidos são recusados
  com mensagem; o arquivo e os registros originais permanecem intactos.
- Importação operacional sempre passa por prévia e confirmação existentes.
  Previsto HH:mm:00 pode tornar-se HH:mm sem mudar o horário; uma execução só com
  relógio recebe a data do culto usando America/Sao_Paulo, preservando segundos,
  frações e horário de verão histórico. A interface descreve essas adaptações e
  conserva a cópia integral original em `backup_source.document`.
- Previsto com segundos não nulos NÃO é truncado: exportação/restauração local
  continuam possíveis, mas sua importação operacional é bloqueada para revisão.
- Registros existentes no Supabase não são adaptados nem substituídos por este
  código. Conflitos, duplicidade, versão e RLS continuam nas RPCs atuais.
- O limite existente de 2 MiB por documento operacional continua valendo; a cópia
  original pode aumentar o tamanho da importação. Se o servidor recusar o tamanho,
  nenhuma confirmação de salvamento é apresentada e a origem permanece intacta.
- Não há nova migração SQL, mudança de tabelas, funções ou políticas RLS.

## Carregamento e indicadores

- Programações, Histórico, Registro, edição, acompanhamento e resumo dependem de
  uma consulta bem-sucedida. Erro leva ao estado de erro com nova tentativa, nunca
  à mensagem de vazio. Todo o resultado paginado deve chegar antes da troca da lista.
- Lista anterior fica em memória no erro, mas não é apresentada como uma consulta
  atualizada. Logout/invalidação de acesso elimina sua exposição conforme o Lote 1.
- Usuários/convites, arquivos históricos e Lixeira também distinguem carregamento,
  erro e vazio. Consultas com erro mostram nova tentativa.
- Zero real continua zero. Ausência de amostra usa null/traço/Dados insuficientes.
  Intervalos invertidos, datas diferentes e valores desconhecidos não entram nas
  médias, medianas ou classificações positivas.
- A aderência de atividades usa somente pares reais/previstos válidos e identifica
  os registros excluídos. Percentual parcial fica neutro. Indicadores do culto
  inteiro exigem preenchimento suficiente; não tratam cultos incompletos como pontuais.
- Mediana continua agrupando músicas e respeitando os términos de referência.
  Atividades simultâneas e subatividades não são somadas novamente ao tempo total.

## Arquivos do Lote 2

- `frontend/record-time.js`: validação central e intervalos/amostras sem mutação.
- `frontend/archive.js`: compatibilidade, importação explicitada e estados de consulta.
- `frontend/app.js`: estados da consulta, nova tentativa, proteção de resultados
  atrasados e indicadores de Histórico, Início e Resumo.
- `frontend/actuals.js`: reutilização da validação e intervalos válidos no resumo.
- `frontend/operational.js`: importação compatível e carregamento centralizado.
- `frontend/users.js`, `frontend/trash.js`: estados de consulta e nova tentativa.
- `tests/test_data_reliability.py`: regressões de navegador e PostgreSQL descartável.
- Este relatório. Prévia HTML e ZIP em `dist/`, fora do versionamento.

Os arquivos adicionais que aparecem no diff Git da branch pertencem ao Lote 1
não commitado (auth, drafts, index, styles e geradores); não são remoções ou
substituições do trabalho anterior.

## Testes e limitações

Resultado final: **207 testes distintos aprovados**, sem falhas restantes ou testes
ignorados: 147 anteriores + 20 do Lote 1 + 40 novos do Lote 2 (37 de navegador,
3 de PostgreSQL real descartável).

A execução completa após os ajustes de código passou nos 201 casos então
carregados pelo discovery (235,437 s); seis casos adicionados durante essa execução
foram executados separadamente e passaram (7,349 s). Não se somam as repetições das
execuções anteriores. Logs: `/tmp/iasdpi-lote2-full-final.log` e
`/tmp/iasdpi-lote2-final-cases.log`. O discovery atual contém os 207 casos.

Com PostgreSQL descartável sem rede já disponível:

    PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-lote2-pg-tests python -m unittest discover -s tests -v

Cobertura nova: formatos HH:mm/HH:mm:ss/frações, backup cifrado e antigo,
download real no Chromium, importação/restauração, senha incorreta/adulteração,
importação PostgreSQL com 16 itens e microssegundos, horário de verão histórico,
reabertura/edição, idempotência, falha temporária, nova tentativa, lista realmente
vazia, resposta malformada, falha na segunda página, logout durante consulta,
Usuários/arquivos/Lixeira, métricas ausentes/inválidas/incompletas, zero real,
duração zero, média/mediana sem base, extras incompletos e subatividades.

Fluxos de criação Liturgia I/Livre, edição, acompanhamento, finalização, Auth,
RLS, concorrência e rascunhos foram novamente exercitados pela suíte existente.
A prévia HTML gerada também foi servida via HTTP local e aberta no Chromium com
REST simulado: organograma, agenda, login, registro, histórico sem dados válidos,
e botão Tentar novamente em 360/390/768/1024/1440 px, sem erro de execução.
O pacote operacional foi gerado em `/tmp/iasdpi-lote2-pages-candidate`, com hashes
de recursos e checagem de material secreto do gerador, sem publicação.

Todos os dados utilizados são fictícios. As chamadas REST no navegador são
interceptadas. Os testes PostgreSQL recusam contêiner com rede habilitada e criam
bases descartáveis. Não há teste de escrita nem consulta aos cultos reais de produção.
Sem sessão real, não se afirma homologação do Supabase publicado. Firefox não está
instalado; navegador validado: Chromium, inclusive com locale en-US e fuso estrangeiro.

## Homologação

1. Gerar a prévia: `python scripts/export_preview.py --read-only --output dist/IASDPI-lote2-previa.html`.
   Ela é local e bloqueia gravações remotas; não é o banco operacional de produção.
   Para revisão via HTTP: `python -m http.server 8000 --directory dist` e abrir
   `http://localhost:8000/IASDPI-lote2-previa.html`.
2. Entrar com conta autorizada. Criar registros fictícios Liturgia I e Livre,
   preencher parcialmente, salvar, recarregar e editar. Confirmar rascunhos após
   navegação/reautenticação, sem copiar dados reais para a prévia.
3. Completar um registro fictício e finalizar. Conferir resumo, planejados HH:mm,
   reais HH:mm:ss, responsáveis, observações, subatividades e indicadores.
4. Baixar backup com senha; restaurar o mesmo arquivo e conferir que não duplica
   registros idênticos. Senha incorreta deve falhar sem mudar dados. Um arquivo
   histórico HH:mm:ss deve continuar exportável e restaurável.
5. Usar modo offline do navegador e tentar atualizar as programações. Deve aparecer
   erro com Tentar novamente. Voltar online e clicar novamente: só uma consulta
   confirmada pode apresentar registros ou lista vazia.
6. Conferir histórico com dados completos, ausentes e inválidos em cópias de teste.
   Não deve aparecer NaN%, Infinity, 0 min fictício ou selo positivo para incompleto.
7. Para homologar importação operacional, usar ambiente Supabase de testes com
   migrações 001–004, nunca registros reais. Revisar adaptações e conflitos na prévia;
   só confirmar arquivos fictícios. Conferir `backup_source.document` e os microssegundos.

## Entrega e rollback

Sem commit, merge, push, publicação ou execução de SQL em produção.
Rollback de código: a árvore do Lote 1 permanece em `/workspace/iasdpi-lote1`.
Nenhum localStorage, IndexedDB de usuário real, registro Supabase, agenda ou
organograma publicado foi apagado ou modificado. Futuro deploy deve incluir todos
os arquivos estáticos dos dois lotes, após autorização explícita.
