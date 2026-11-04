# Classificação e privacidade do calendário — implementação preparada

Branch `feat/schedule-management-b1`. Preparação e testes locais, sem SQL no Supabase ou contas reais. A publicação estática posterior, autorizada pelo usuário, é exclusiva de IASDPI-homologacao; ela não ativa esta política no Supabase nem publica o sistema operacional.

## Regra confirmada

- Sem login: eventos publicados não restritos e escalas publicadas do Ancionato.
- Outras escalas: somente com sessão válida e as permissões de consulta existentes da igreja/departamento. Login não concede administração ou acesso a outro ministério.
- O checkbox **Restrito — não mostrar no calendário público** vale para qualquer classificação. O evento restrito é omitido completamente: não retorna título, local, descrição ou identificador do registro na consulta pública.
- Classificação (Programação Geral/Programação Departamental/Atividade Reservada), organizador (Igreja Local/Associação/Escola Adventista/Departamento/Outro) e público-alvo (Toda a igreja/Público específico/Restrito-Convidados) são independentes do escopo de gestão. Não se infere restrição a partir da categoria ou público: o controle explícito é o checkbox.
- Dados sem classificação continuam pendentes. Nenhuma classificação, identidade ou disponibilidade foi inventada.

## Migração 021 — após 020

`database/021_calendar_classification_privacy.sql` acrescenta `program_category`, `organizer_kind`, `audience`, `is_restricted` e `organizer_department_id` em `iasdpi_events`. Reutiliza as tabelas e relações existentes; não cria outra base de pessoas, departamentos ou eventos. Não altera os valores antigos de `category`/`department_id`: esses continuam controlando autorização. Os novos campos editoriais começam nulos; a restrição começa falsa para preservar a condição pública dos registros antigos, sem inferências sobre o conteúdo.

A atualização parcial, IDs, versões, recibos de idempotência e fotografias anteriores são preservados. A RPC de gravação aceita os campos novos com validação e FK por igreja. Alterações editoriais não ampliam poderes do usuário.

Novas RPCs autenticadas: `iasdpi_events_visible(date)` e `iasdpi_schedule_visible(date)`. Os nomes públicos existentes continuam funcionando, mas `iasdpi_schedule_published(date)` passa a fornecer somente Ancionato, mesmo se chamada diretamente. As implementações antigas ficam privadas e sem EXECUTE para anon/authenticated. O endpoint público do Organograma também deixa de expor chaves de associação que identificam escalas privadas; a liderança pública é preservada.

O feed usa a última publicação, sem devolver rascunhos. A restrição atual e a da fotografia publicada são verificadas: restringir e salvar rascunho esconde a publicação anterior; desmarcar em rascunho não revela uma fotografia ainda restrita. Para tornar pública novamente, publicar uma revisão não restrita. Uma nova versão registra cada mudança; não há exclusão de eventos ou histórico.

`database/check_calendar_privacy.sql` retorna apenas irregularidades e é somente leitura, para executar como postgres depois da 021.

## Frontend, Agenda e pacotes

O flag `calendarPrivacyEnabled` exige `eventsEnabled` e a migração 021. Não está ativado na configuração operacional existente. A prévia nova o ativa exclusivamente no simulador.

Com o flag, Agenda e Calendário usam a mesma visualização protegida. Não existe retorno às listas estáticas de Sonoplastia/Comunicação nem aos eventos embutidos quando uma consulta falha. A interface exibe erro e permite nova tentativa. A chave de cache distingue igreja e identidade; logout/revogação limpa as consultas e impede reaproveitar resposta privada de outra sessão. Renovação de sessão não apaga o formulário de evento ainda em edição.

O gerador de pacotes operacionais remove as escalas manuais do JavaScript entregue e conserva no snapshot estático somente os períodos públicos dos anciãos. Todos os eventos passam a vir do backend. A validação rejeita pacotes adulterados ou que voltem a embutir escalas privadas. O sincronizador preserva a projeção somente-Ancionato quando encontra seu marcador; não reinsere automaticamente eventos no arquivo público.

A primeira publicação com essa política exige um pacote limpo, sem reter os recursos públicos antigos. O gerador recusa misturar configurações de privacidade diferentes. Isso não apaga registros: os arquivos de origem e backups são preservados no desenvolvimento. Arquivos previamente publicados/cacheados ou presentes no histórico público do Git não podem ser recolhidos retroativamente por RLS; não afirmar que esse material antigo se tornou secreto.

## Fontes antigas e ativação controlada

O inventário `dist/calendar-privacy/source-review.json` foi gerado por `scripts/prepare_calendar_source_review.py`: 154 eventos do snapshot e 20 escalas manuais (15 Sonoplastia + 5 Comunicação). Contém os originais, IDs de origem, propostas de ID e pendências. Não escreve no banco. Para considerar correspondências já existentes, fornecer um JSON autorizado com `events` ao argumento `--existing`. Correspondências possíveis e mais de um ID para a mesma origem exigem revisão; não há importação automática.

1. Provisionar/restaurar o Supabase de homologação separado; confirmar o inventário e a sequência já instalada. Rever 005–019 conforme G9 e 020 conforme E1. Não reaplicar versões antigas sobre correções novas.
2. Revisar e autorizar a 021; executar em uma transação somente depois de 020. Executar `check_calendar_privacy.sql` e os checks anteriores pertinentes. Não executar o check antigo que exige publicação anônima de todas as escalas como critério dessa política nova.
3. Conciliar as fontes em prévia administrativa. Escalas históricas confirmadas reutilizam `iasdpi_schedule_register_legacy`; exige pessoa/vínculo central e rejeita sobrescrita/conflitos. Nomes não conciliados permanecem nos originais, pendentes. Não criar pessoas/vínculos automaticamente por semelhança.
4. Para eventos, confirmar IDs/correspondências, gestão e publicação usando `iasdpi_event_save`, preservando `source_key`. Não importar em massa como eventos novos sem a conferência. A migração não faz importação nem publica o snapshot automaticamente.
5. Conferir no banco as 20 referências históricas e os eventos esperados, ou registrar explicitamente os ainda pendentes. **Não ativar a substituição do snapshot estático antes disso**: registros não importados continuariam preservados na origem, mas não apareceriam no novo calendário operacional.
6. Homologar JWTs/sessões, revogação, escopos e consultas diretas com contas descartáveis no projeto separado. Os testes locais não comprovam Auth/SMTP/RLS do Supabase de produção.
7. Só após autorização, gerar com os flags de governança, Eventos e privacidade habilitados; validar o pacote limpo e conferir que a implantação não deixe os arquivos antigos acessíveis no site atual. A homologação estática pode ser atualizada mediante autorização; a publicação operacional permanece pendente.

## Prévia e limites

`python scripts/prepare_integrated_review.py --privacy --historical-site /CAMINHO/IASDPI-homologacao --output dist/calendar-privacy/previa-nova`

A prévia integrada usa identidades fictícias (`admin.iasdpi`, `som.iasdpi`, etc.), senha pública fictícia `Demonstracao#2026`, memória e rede bloqueada. Demonstra os comportamentos; **o login simulado não protege o conteúdo do HTML**. Não publicar dados confidenciais nesse simulador. A proteção efetiva foi testada com papéis PostgreSQL em ambiente descartável, sem Supabase real. Uma atualização estática autorizada pode demonstrar o novo comportamento, mas não comprova a política no Supabase real. Não declarar autenticação simulada como proteção efetiva dos dados.

## Rollback

Não restaurar os endpoints públicos antigos nem republicar um pacote com escalas privadas embutidas. Em falha, desativar o módulo/servir página de manutenção sem dados, conservando o banco, versões e restrições da 021. Corrigir por migração posterior revisada. Restaurar backup para um destino isolado permite comparar e recuperar registros sem expor novamente escalas ou descartar campos preenchidos. Não há script destrutivo de DROP para contornar a proteção.

## Testes e evidências

PostgreSQL descartável sem rede: instalação 001–021, RLS/grants, anonimato, eventos restritos, outras escalas privadas, Ancionato público, isolamento entre igrejas/departamentos, enumerações, atualização parcial, precisão histórica, idempotência, revogação, concorrência e referências centrais.

Chromium local: filtros contextuais, checkboxes/pesquisa, criação/edição de eventos, restrição independente, login/logout, acesso à Agenda, campos preservados e cinco larguras (360/390/768/1024/1440). Pacotes: sanitização, adulteração, construção operacional e preservação dos 20 históricos em inventário. A suíte completa histórica não foi repetida; a regressão selecionada é consolidada sem somar reexecuções. Logs e resultados estão em `dist/calendar-privacy/`.

Resultado consolidado: **171 testes distintos aprovados**, sem falhas ou casos pulados: 13 PostgreSQL, 10 Chromium de privacidade, 8 de pacote/inventário, 27 de interface/eventos/filtros, 91 de compatibilidade e 22 Node. Resumo versionado em `docs/calendar-privacy-validation.json`. Os dez casos de privacidade foram repetidos contra o HTML exato da candidata e não foram somados novamente.

## Arquivos desta entrega

- Interface e autenticação: `frontend/agenda.js`, `frontend/auth.js`, `frontend/portal-access.js`, `frontend/styles.css`.
- Banco: `database/021_calendar_classification_privacy.sql`, `database/check_calendar_privacy.sql`.
- Prévia e pacote: `scripts/export_preview.py`, `scripts/prepare_integrated_review.py`, `scripts/build_homologation.py`, `scripts/calendar_privacy.py`, `scripts/sync_agenda.py`.
- Revisão de fontes: `scripts/prepare_calendar_source_review.py`.
- Testes: `tests/test_calendar_privacy_sql.py`, `tests/test_calendar_privacy_browser.py`, `tests/test_calendar_privacy_assets.py`, `tests/test_calendar_refine_browser.py`, `tests/test_events_browser.py`, `tests/fixtures/events-preview.js`.
- Documentação: `README.md`, `docs/events-e1.md`, `docs/event-classification-impact.md`, este relatório e `docs/calendar-privacy-validation.json`.
