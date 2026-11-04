# G5 — Persistência das escalas do Ancionato

Implementação local na branch `feat/schedule-management-b1`. Não foram executados SQL, acessos a registros, criação de contas ou alterações no Supabase real. Sem commit, merge, push ou publicação. Configurações de produção G1–G4 continuam desativadas. Os trabalhos anteriores permanecem no checkout.

## O que foi concluído

O calendário aprovado foi reaproveitado. A organização continua independente: semanas completas de domingo a sábado e calendário anual com uma escolha por mês. Uma semana na virada do mês possui o mesmo UUID nos dois meses. Consultar não cria linhas no banco; o UUID virtual é determinístico por igreja, departamento, modalidade e início.

O código anterior condicionava a tela de anciãos à presença do adaptador demonstrativo. Essa condição foi removida. Com a 015 instalada, `settings.elder_periods` ativa a tela operacional e o frontend usa as RPCs existentes no mesmo cliente Supabase Auth. Consultas ao Ancionato não dependem da criação de funções ou eventos diários auxiliares.

Salvar afeta apenas os períodos editados da aba atual. Publicar exige confirmação e cobertura dos períodos da aba. Semanas pendentes não são salvas ao publicar meses, e vice-versa. A confirmação de gravação valida UUIDs, modalidade, datas, versão, responsável e estado retornados. Falhas mantêm os campos; nova tentativa da mesma gravação conserva o identificador idempotente.

A interface diferencia confirmação pelo Supabase de confirmação na memória da demonstração. Há consulta de versões por período, incluindo autor, data, responsável e estado. O histórico das versões é consultivo; não foi criada restauração automática de versões.

## Migração incremental 015

Arquivo: `database/015_elder_period_storage.sql`. Uma única transação; requer `postgres` e 001–014 completas. Recusa reexecução, sem sobrescrever uma instalação anterior.

Tabelas novas, justificadas pela identidade de períodos que cruzam meses e pela separação das modalidades:

| Tabela | Finalidade |
| --- | --- |
| `schedule_elder_periods` | Estado atual, UUID, igreja, departamento, modalidade, intervalo civil, pessoa, rascunho/publicado, revisão e autoria. |
| `schedule_elder_versions` | Instantâneos imutáveis por período/revisão, autor e momento. A aplicação não recebe UPDATE nem DELETE. |

Não foram criados cadastros paralelos de pessoas, igrejas, usuários ou departamentos. As FKs compostas incluem `church_id`. Não há importação, deduplicação por nome, alteração de horários ou atualização de dados preexistentes.

RPCs novas:

| RPC | Acesso e comportamento |
| --- | --- |
| `iasdpi_schedule_elder_workspace(uuid,date,integer)` | Sessão válida e consulta ao Ancionato ativo da igreja selecionada; períodos atuais/virtuais, histórico publicado e compromissos necessários à validação. Compromissos externos não expõem nomes de outros departamentos. |
| `iasdpi_schedule_elder_save(uuid,text,jsonb,uuid)` | Sessão e capacidades ministeriais revalidadas após adquirir o lock; lote de uma modalidade, CAS, idempotência, conflitos, versão e auditoria atômicos. |
| `iasdpi_schedule_elder_versions(uuid,text,date)` | Histórico privado do Ancionato autorizado, em ordem de versão. |

Entradas existentes ampliadas: `iasdpi_schedule_settings_get`, `iasdpi_schedule_rotation_context` e `iasdpi_schedule_published`. As implementações anteriores ficam preservadas como auxiliares privados. O restante do portal, autenticação, Cronoanálise, organograma e agenda oficial permanece com seus contratos anteriores.

## Permissões e isolamento

- Todas as RPCs novas são SECURITY DEFINER com `search_path` vazio, pertencentes a `iasdpi_church_executor`, sem LOGIN/SUPERUSER/BYPASSRLS.
- As duas tabelas têm RLS com limite restritivo de igreja e acesso apenas pelo executor. Anônimos, authenticated e service_role não recebem escrita direta nem leitura direta nessas tabelas.
- Funções e views privadas não são acessíveis ao navegador. Views usam `security_invoker=true`.
- Administrador pode gerir apenas a igreja em que possui a autorização existente. Não há novo papel de superadministrador irrestrito.
- Gestor do Ancionato precisa das capacidades `view`, `edit` e/ou `publish` da G3. Ser ancião, responsável ministerial, pessoa cadastrada ou escolher um apelido não concede acesso.
- Editor sem publicação salva rascunhos, mas não publica nem revisa uma versão publicada. Publicador sem edição pode publicar uma versão existente sem alterar a pessoa; não pode criar/alterar atribuições. Visualizador autorizado consulta sem gravar.
- Alterações estruturais da identidade do período e transferência entre igrejas são rejeitadas.

## Conflitos, concorrência e histórico

Semanas reservam todos os dias civis, inclusive segunda/terça/quinta/sexta e dias de meses vizinhos. A mesma pessoa em outro departamento na mesma data é bloqueada, independentemente de horário. Exceção somente pelo mecanismo administrativo já existente, com justificativa e auditoria. Revogar uma exceção necessária a uma publicação vigente é impedido.

Ancião do mês continua sem bloquear outros departamentos, conforme decisão anterior. Vínculo e pessoa ativos continuam necessários para novas atribuições. Disponibilidade e limites não viraram proibições manuais; o rodízio anterior foi preservado.

O serviço central `confirmed_days` incorpora as semanas publicadas. A validação diária e o rodízio dos demais departamentos consultam os mesmos compromissos. Uma revisão em rascunho mantém a última publicação como compromisso, tanto nos períodos novos quanto nos planos diários já públicos. Rascunhos sem publicação anterior não reservam dias: a publicação posterior revalida.

As RPCs reutilizam o lock de controle da igreja. Duas publicações incompatíveis não podem confirmar juntas. A revisão esperada evita sobrescrita; uma transação REPEATABLE READ obsoleta falha em vez de contornar a revalidação. O lote é atômico e cada confirmação gera versão/auditoria. O campo `person_id` precisa ser explícito: omiti-lo é rejeitado, e `null` é a escolha explícita para limpar um rascunho. Repetir uma requisição não duplica versões; trocar seu conteúdo, autor ou escopo não reutiliza a confirmação.

Mudanças de vínculo/pessoa/exceção revalidam publicações vigentes/futuras; períodos encerrados permanecem históricos e não impedem aposentadoria de participantes. Não há exclusão física ou modificação das versões anteriores.

## Calendário público e dados históricos

`iasdpi_schedule_published(date)` continua anônimo e estritamente projetado. Acrescenta apenas a última versão publicada de cada período que intersecta o mês consultado. Não retorna UID do autor, contatos, notas, habilitações, disponibilidade ou rascunhos. Revisar privadamente mantém a publicação anterior; publicar a revisão substitui a projeção, preservando as versões.

O calendário exibe meses e faixas semanais pelo componente já aprovado. A chave da faixa impede duplicação com a referência oficial do mesmo intervalo. O arquivo original da Agenda não é alterado. Publicar invalida o cache público nesta aba; outro dispositivo consulta a versão atual ao recarregar. Não foi adicionado tempo real.

Sonoplastia (15 registros), Comunicação (5 registros) e referências de anciãos da Agenda continuam preservadas. Nomes históricos sem UUID confirmado não são fundidos com pessoas nem importados automaticamente. A detecção transacional cobre compromissos operacionais e referências históricas **já vinculadas a UUIDs no banco**; referências somente no arquivo público continuam sendo referência, não uma identidade presumida. Confirmar identidades e registrar referências adicionais exige ação administrativa específica pelo mecanismo existente.

## Arquivos da G5

- `database/015_elder_period_storage.sql` e `database/check_elder_period_storage.sql`.
- `frontend/schedule-management.js`: persistência real, consulta/edição separada, idempotência, retorno validado e histórico.
- `frontend/agenda.js`: períodos publicados do portal reutilizam as faixas existentes.
- `frontend/auth.js`: consultas de workspace/histórico incluídas na lista permitida do modo remoto somente leitura; escrita permanece bloqueada nesse modo.
- `scripts/export_preview.py`: opção `--elder-storage-preview`, namespace isolado e identificação G5.
- `tests/fixtures/schedule-elder-periods-preview.js` e `tests/fixtures/portal-integration-preview.js`: histórico e publicação simulados, contas fictícias do Ancionato.
- `tests/test_elder_storage_sql.py`, `tests/test_elder_storage_browser.py`.
- Este relatório e artefatos em `dist/elder-storage/`.

## Prévia e homologação

Arquivo: `dist/elder-storage/IASDPI-G5-Ancionato.html`. Gerar novamente com:

```bash
python scripts/export_preview.py --elder-storage-preview --output dist/elder-storage/IASDPI-G5-Ancionato.html
```

A prévia possui CSP `connect-src 'none'`, não contém a configuração real do Supabase e usa namespace local distinto da G4. Sessões fictícias usam o SDK existente; escalas ficam na memória e reiniciam ao recarregar. **Persistência após recarregamento foi validada pelas RPCs no PostgreSQL descartável, não por uma conexão real da prévia ao Supabase.**

Contas exclusivamente fictícias, senha `Demonstracao#2026`:

- `anciao.teste`: consulta, edição e publicação no Ancionato.
- `anciao.editor.teste`: consulta e edição, sem publicação.
- `anciao.leitura.teste`: consulta, sem edição.
- `admin.teste`: administração da IASD_PI na simulação.

Roteiro:

1. Abrir Montar escala, selecionar IASD_PI e entrar com `anciao.teste`.
2. Escolher os responsáveis das semanas, salvar e consultar Histórico. Conferir que o calendário público não recebeu o rascunho.
3. Abrir Ancião do mês, preencher os 12 meses e publicar. Conferir que as semanas continuam independentes.
4. Publicar as semanas, abrir Ver calendário e conferir faixas e nomes; revisar em rascunho e conferir que só a última publicação continua pública.
5. Consultar com leitor e editor. Verificar controles e tentativas negadas; o PostgreSQL descartável também testa chamadas diretas sem depender da interface.
6. Testar no celular e por teclado. Revisar as capturas desktop/mobile e o calendário anual.

## Testes e evidências

**100 testes distintos aprovados nas suítes executadas, incluindo 31 novos da G5; nenhuma falha restante nessas verificações.** Não representa a execução integral de todas as suítes históricas do repositório.

| Grupo | Testes distintos aprovados |
| --- | ---: |
| Novos G5 — PostgreSQL/RLS/RPCs | 23 |
| Novos G5 — interface integrada Chromium | 8 |
| Regressão G4 — portal, permissões e pacote | 22 |
| Regressão G4 — PostgreSQL | 11 |
| Regressão calendários de anciãos | 12 |
| Regressão publicação/calendário | 7 |
| Regressão exceção do ancião do mês | 6 |
| Regressão portal público | 11 |
| Total sem contar reexecuções | **100** |

Evidências em `dist/elder-storage/test-results.json`, `*-evidence.log` e `integrity.json` (SHA-256). Capturas: `desktop.png`, `mobile.png` e `monthly-mobile.png`.

Cobertura: rascunho/reabertura via RPC, publicação separada, último publicado durante revisão privada, lotes atômicos, idempotência, revisão obsoleta, dupla publicação concorrente entre departamentos, snapshot REPEATABLE READ obsoleto, exceções administrativas, revogação de permissões, leitura sem edição, acesso anônimo, igreja diferente, histórico imutável e preservação de registros anteriores à migração. A omissão de `person_id` é rejeitada sem limpar o rascunho; a limpeza explícita usa null.

A consulta de integridade foi testada também sob `America/Sao_Paulo` e os IDs sob DateStyle diferente; comparações de timestamps e identidades civis não dependem dessas configurações. A interface foi verificada em 360, 390, 768, 1024 e 1440 px, incluindo teclado, falha/repetição de gravação, confirmação malformada e calendário público.

Reprodução (somente com container PostgreSQL descartável `--network none`):

```bash
IASDPI_PG_TEST_CONTAINER=NOME_DO_CONTAINER PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=tests python -m unittest test_elder_storage_sql -v
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=tests python -m unittest test_elder_storage_browser test_portal_integration_browser test_portal_integration_package test_schedule_elder_periods test_schedule_publish_flow test_schedule_monthly_conflict_off test_church_portal -v
IASDPI_PG_TEST_CONTAINER=NOME_DO_CONTAINER PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=tests python -m unittest test_portal_integration_sql -v
```

O container temporário desta execução foi removido após os testes. Não houve contas nem gravações reais.

Não foram executados login real, validação de JWT pelo gateway real, RLS no projeto de produção ou testes físicos em Android/iPhone/Safari/Firefox. PostgreSQL local testa políticas/funções com papéis e claims fictícios; Chromium testa navegação e SDK com provedor simulado. Não declarar essas simulações como aprovação do ambiente real.

## Ativação gradual — somente após autorização

1. Confirmar quais migrações já estão instaladas; **não reaplicar 001–014**. A 015 depende delas. G1–G4 e Escalas 005–010 ainda precisam de ativação/revisão onde não estiverem instaladas.
2. Em Supabase de homologação autorizado, revisar as permissões G3 e as publicações que passarão a ser visíveis. Não conceder acesso ministerial baseado no organograma. Confirmar uma conta administrativa existente e uma conta ministerial descartável apenas nesse ambiente.
3. Preservar um pacote frontend válido e backup/snapshot do PostgreSQL pelo procedimento administrativo. Não depende de exportações repetidas do navegador.
4. Revisar e executar **somente `015_elder_period_storage.sql`**, como postgres, uma vez. Erros abortam a transação. Não há atualização de cultos, pessoas ou atribuições anteriores.
5. Executar `check_church_isolation.sql`, `check_access_governance.sql`, `check_portal_integration.sql` e `check_elder_period_storage.sql`. Esperado: zero irregularidades. Conferir os registros anteriores e seus totais.
6. Homologar contas reais descartáveis, JWTs, permissões, duas sessões simultâneas e consulta pública no ambiente autorizado. Não publicar escalas fictícias no banco de produção.
7. Somente após aprovação, preparar pacote/SRI pelo gerador existente, ativar as configurações G1–G4 necessárias e publicar o frontend autorizado. A migração expande a API pública mesmo antes dos flags do frontend: aprovar esse acesso explicitamente.
8. Primeira operação real: um gestor explicitamente autorizado salva um rascunho válido, reabre em outro dispositivo, e publica somente após revisão humana.

## Rollback e riscos

Não apagar tabelas novas, versões ou referências para reverter a interface. Restaurar o pacote frontend validado anterior e suspender o uso operacional das telas do Ancionato até revisão; manter banco, RLS e histórico. A interface anterior não administra os novos períodos: não usá-la para substituir o planejamento por planos diários paralelos. Uma reversão de RPCs/consulta pública precisa de revisão administrativa específica, sem eliminar dados.

A serialização por igreja e a revalidação diferida privilegiam integridade, reutilizando a arquitetura existente. Volume elevado pode exigir medição e otimização posterior. Referências históricas sem identidade confirmada, autenticação real, dispositivos físicos e implantação efetiva permanecem dependências explícitas. Não há envio de notificações, cancelamento público de publicações ou novas funções fora da G5.

Commit sugerido, não executado: `feat: persiste escalas semanais e mensais do Ancionato`.
