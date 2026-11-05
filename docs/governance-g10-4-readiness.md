# IASDPI — G10.4: relatório único de prontidão

**Decisão: cadeia local validada e pacote pronto para revisão; implantação real ainda não autorizada.** Nenhuma conexão com o Supabase, usuário real, configuração do projeto, merge, commit, push ou publicação foi realizada nesta etapa.

## 1. Evidências e limites

- Branch preservada: `feat/schedule-management-b1`; HEAD de referência `f7922c281d53a33a103f2510728fa02cdb69d58c`. A candidata inclui alterações locais da G10.3 ainda não commitadas. O manifesto registra SHA-256 dos SQLs, checks e componentes de runtime; o HEAD sozinho não identifica a entrega completa.
- G10.1, conforme resultado informado pelo usuário: estruturas compatíveis com 001–004, marcadores 005–025 ausentes, 12 tabelas, 22 funções, RLS ativa, executor e ledger ausentes.
- O relatório completo da G10.2 e o JSON integral observado não foram encontrados nos arquivos disponíveis. A análise indispensável foi reconstruída usando esse resumo, o código 001–025 e a implementação/relatório G10.3. Não foi repetida auditoria remota nem presumida uma comparação independente dos hashes reais.
- Referência local: base sintética 001–004, com as mesmas contagens 12/22, Auth simulado, um culto finalizado, um na Lixeira e modelos de 16/16/0 atividades. É equivalência ao código nominal e ao resumo informado, **não uma cópia validada do IASD_Parada**.
- O manifesto e este relatório não são autorização de execução. Mudança no estado real desde o inventário, objeto preexistente inesperado, política adicional ou divergência de owner exige parar e revisar o delta, sem reinstalar o core.

## 2. Conclusão de compatibilidade

A ordem correta para o estado informado é **005 → 006 → … → 025 → 026**: 22 migrações, sem 001–004. Não foi identificada necessidade de 027 ou outra migração adicional nesta consolidação.

A **026 é necessária** para as regras atuais: acessos administrativos exclusivos do administrador, responsabilidades confirmadas, aprovação de eventos gerais por ancião autorizado/admin, auditoria administrativa e troca obrigatória da senha provisória. A 025 sozinha mantém publicação geral direta e não representa o estado final aprovado da governança.

As tabelas centrais, Auth, RLS, RPCs e históricos existentes são reutilizados. A 026 acrescenta atributos ao ACL existente e ao controle global de sessão, sem criar outro Cadastro Geral, sistema de senha ou usuários Auth. Contas antigas não recebem troca obrigatória automaticamente.

No ensaio, as 22 etapas e seus checks passaram; os dados anteriores da Cronoanálise foram preservados após **cada etapa**. A leitura pública, negação de acesso indevido, escrita de um novo culto e auditoria exclusiva do administrador continuaram funcionando no PostgreSQL sintético.

Atenções indispensáveis:

- A 011 altera também tabelas/RPCs da Cronoanálise: `church_id`, backfill, PK/FK, índices, RLS, owners e executor. Exige janela para locks exclusivos e confirmação das permissões DCL do operador no Supabase gerenciado. O ensaio como postgres local não prova essas permissões do provedor.
- Instalar 005–010 **antes** da 011. O caminho alternativo da 011 sem Escalas não é o delta indicado pelo resultado informado; se já existir, interromper e adaptar.
- Não reaplicar 018 depois de 019, 021 depois de 022–026 ou 025 depois de 026. São etapas que substituem/movem funções, não arquivos idempotentes.
- Migração estrutural não importa automaticamente pessoas, fontes históricas ou Organograma da demonstração. A 005 cria apenas Sonoplastia, Diaconato, Música e Ancionato. Comunicação, Família e Criança, quando forem ativados, usam cadastros configuráveis existentes; não necessitam de novas tabelas/migrações por ministério.
- Preservar fontes de Sonoplastia (15 registros), Comunicação (5) e Ancionato. Conciliar/importar com prévia e aprovação específica; não criar pessoas por semelhança nem supor que o HTML demonstrativo já está persistido.

## 3. Lista exata e verificação de cada etapa

Arquivos originais em `database/`. O `governance-g10-4-migrations.json` contém ordem, predecessores, hashes e reação a falhas. Os checks abaixo foram exercitados **nesta ordem**, imediatamente após a respectiva migração. Zero linhas de irregularidade ou bloco DO concluído sem erro é o resultado esperado; HTTP 200/“Success” sozinho não substitui ler o resultado.

**Não executar agora. Não incluir `_down.sql`, `supabase-archives.sql`, checks como migrações, nem arquivos 001–004 no lote de instalação.**

| Etapa | Migração | Finalidade | Check imediatamente após |
| --- | --- | --- | --- |
| 005 | `005_schedule_foundation.sql` | Cadastro central e ministérios | `check_schedule_foundation.sql` |
| 006 | `006_schedule_management.sql` | Planos, atribuições e histórico | `check_schedule_management.sql` |
| 007 | `007_daily_schedules.sql` | Datas e configuração de planejamento | `check_daily_schedules.sql` |
| 008 | `008_monthly_rotation.sql` | Montagem mensal e rodízio | `check_monthly_rotation.sql` |
| 009 | `009_confirmed_schedule_conflicts.sql` | Conflitos e compromissos históricos | `check_confirmed_schedule_conflicts.sql` |
| 010 | `010_simple_daily_schedules.sql` | Montagem manual simplificada | `check_daily_schedules.sql` |
| 011 | `011_church_isolation.sql` | Igreja, backfill, chaves, RLS e executor | `check_church_isolation.sql` |
| 012 | `012_alias_login.sql` | Login por apelido | `check_alias_login.sql` |
| 013 | `013_access_governance.sql` | Capacidades e recuperação administrativa | `check_access_governance.sql` |
| 014 | `014_portal_integration.sql` | Portal e feeds publicados | `check_portal_integration.sql` |
| 015 | `015_elder_period_storage.sql` | Ancionato semanal e mensal | `check_elder_period_storage.sql`<br>`check_governance_integration.sql` |
| 016 | `016_department_schedule_days.sql` | Dias de escala por departamento | `check_department_schedule_days.sql` |
| 017 | `017_central_registry_integration.sql` | Integração central de pessoas e vínculos | `check_central_registry.sql` |
| 018 | `018_registry_search.sql` | Busca do Cadastro Geral | `check_central_registry.sql` |
| 019 | `019_registry_identities.sql` | Identidades, aliases históricos e conciliação | `check_registry_identities.sql` |
| 020 | `020_calendar_events.sql` | Eventos editoriais | `check_calendar_events.sql` |
| 021 | `021_calendar_classification_privacy.sql` | Classificação e privacidade | `check_calendar_privacy.sql` |
| 022 | `022_event_planning.sql` | Recorrência e reservas | `check_event_planning.sql` |
| 023 | `023_schedule_edit_window.sql` | Mês atual e janela de edição | `check_schedule_edit_window.sql` |
| 024 | `024_schedule_publication_rules.sql` | Comunicação e vagas pendentes | `check_schedule_publication_rules.sql` |
| 025 | `025_event_direct_publication.sql` | Kernel de publicação direta | `check_event_direct_publication.sql` |
| 026 | `026_governance_responsibilities.sql` | Governança final G10.3 e aprovação geral | `check_governance_responsibilities.sql` |

Após 026, executar `check_church_isolation.sql` e `check_governance_responsibilities.sql`, além da homologação funcional autorizada. Checks antigos 005–010 esperam owners anteriores à 011; não executá-los em lote no estado final como se todos fossem verificadores da 026. O ensaio executou os checks históricos nos seus checkpoints corretos.

## 4. Plano por etapas e critérios de interrupção

1. **Preparação, sem SQL no banco:** revisar este relatório e os arquivos do pacote; confirmar projeto IASD_Parada, responsável, checksum, janela de mudança, cópia de frontend/configuração anterior, backup disponível e RPO/RTO. Registrar a autorização exata. Não executar bootstrap ou criar administrador novo: preservar a identidade administrativa já existente.
2. **Fundação 005–010:** executar um arquivo inteiro por vez, respeitando seu BEGIN/COMMIT. Rodar o check indicado e guardar resultado. Manter o frontend operacional atual; não ativar prematuramente novos módulos.
3. **Parada de controle antes da 011:** confirmar backup recuperável, janela sem escritas concorrentes afetadas e capacidade do operador para schemas/roles/grants necessários. Não tentar obter SUPERUSER/BYPASSRLS, alterar owners de Auth ou desativar RLS para contornar um erro do provedor.
4. **Isolamento e governança 011–016:** aplicar cada etapa/check. Conferir IASD_PI única ativa/autorizada, fallback do contexto antigo para IASD_PI, sessões existentes, core admin/leader e nenhuma concessão automática por nome/participação.
5. **Cadastro e identidades 017–019:** aplicar/checkar. Não mesclar pessoas ou importar nomes automaticamente. A 019 instala os instrumentos de conciliação, não uma autorização para executar grupos de mesclagem.
6. **Eventos/calendário 020–025:** aplicar/checkar e manter os novos módulos sem liberação. Reservas, datas, histórico e publicações exigem suas validações; 025 é estado intermediário para G10.3.
7. **Governança final 026:** aplicar e verificar RLS/RPCs/ACL/sessões/visibilidade. Não marcar nenhuma conta para troca de senha até o fluxo seguro de Edge e frontend estar implantado e autorizado. Concluir os checks finais.
8. **Ativação Auth/Edge/frontend, separadamente autorizada:** realizar a configuração abaixo, testar o provedor real e somente então liberar módulos. Criação de contas, concessões, aliases e importações são ações distintas da instalação estrutural.

**Qualquer erro ou irregularidade interrompe a sequência.** Registrar arquivo/hash, projeto, operador, horário, mensagem sanitizada e último checkpoint válido. Não executar a próxima etapa, não apagar objetos nem usar CASCADE. Uma migração pode ter feito COMMIT antes de o check falhar: não a reaplicar para “tentar novamente”. Verificar o que foi commitado e propor correção revisada. Os testes locais demonstraram esse caso, a recusa de reexecução da 005 e rollback de etapa sem predecessor.

Sem ledger existente, registrar externamente arquivo/hash, início/fim, commit confirmado e resultado do check. Não criar uma tabela de ledger improvisada nem converter automaticamente a cadeia para outro mecanismo de migração nesta implantação.

## 5. Auth, Edge Functions e frontend

| Componente | Preparação existente e ação posterior necessária |
| --- | --- |
| Auth atual | Preservar UUIDs, contas, login por e-mail, sessões e recuperação da Cronoanálise. Confirmar política de senha, expiração/refresh, SMTP, callbacks PKCE e redirects reais sem substituir URLs válidas |
| Criação de contas | Somente administrador por canal confiável; desabilitar inscrição pública no Auth durante a ativação aprovada e revisar convites pendentes. Não há conta de visitante, senha ministerial compartilhada ou provisionamento público |
| Login por apelido | Implantar `supabase/functions/alias-login/`; reutiliza Auth e resolução privada, sem revelar e-mail interno. Associação do alias não concede privilégios |
| Recuperação e senha | Implantar a versão G10.3 de `access-assistance/`, inclusive `change_password`, antes de habilitar troca obrigatória. Testar falha parcial, logout global, confirmação e login posterior |
| Segredos/origens | Usar gerenciador Supabase; jamais HTML/Git/chat. `SUPABASE_URL`, chave administrativa, chave pública; peppers/origens/flags `IASDPI_ALIAS_*` e `IASDPI_GOVERNANCE_*` conforme código. Confirmar presença/escopo, nunca copiar valores para relatório |
| Gateway | `verify_jwt=false` somente nas duas funções pré-auth declaradas em `supabase/config.toml`; ações privadas validam JWT e autorização no backend. Header de IP só se sobrescrito por gateway confiável |
| Frontend | Gerar pacote conectado sem fixtures, preservando o namespace/sessões apropriados e CSP/origem autorizada. A demonstração estática não é persistência real. `build_homologation.py --real-homologation` continua bloqueando o projeto de produção conhecido: não usar esse comando como bypass de implantação no IASD_Parada |
| Flags finais | Ativar de modo coerente `churchIsolationEnabled`, `aliasLoginEnabled`, `governanceEnabled`, `portalAccessEnabled`, `centralRegistryEnabled`, `eventsEnabled`, `calendarPrivacyEnabled` e `responsibilityGovernanceEnabled` somente após a cadeia/Edge compatíveis. Configuração atual permanece desativada |
| Dados iniciais | Cadastro único e vínculos confirmados; domínio institucional individual, canal privado de credencial e escopo administrativo definidos. Comunicação somente nos dias confirmados (sábado); demais dias/limites/habilitações não são inventados |

Não conceder `iasdpi_access.role='leader'` global a um gestor que só precisa de ministérios. Administradores confirmam responsabilidades via G10.3; ancião autorizado aprova evento geral sem receber administração de usuários ou edição de outro ministério. Eventos departamentais são diretos no próprio escopo. Auditoria é exclusivamente administrativa. Calendário/Organograma públicos permanecem sem conta; rascunhos/contatos e eventos Restritos não são públicos.

## 6. Backup e recuperação — procedimento para autorização

### Antes de instalar

1. Confirmar backup nativo/PITR disponível no plano e seu ponto de recuperação; definir RPO/RTO com o responsável. Não inventar retenção, tempo de restauração ou janela de locks com base no teste local.
2. Após autorização, produzir o backup suportado pelo Supabase e registrar projeto, instante, responsável e checksum dos artefatos exportados. Se houver dump lógico complementar, incluir esquema/dados da aplicação, histórico, grants/owners/policies/triggers/extensões e Auth conforme os procedimentos suportados pelo provedor; nunca exportar conteúdo real para Git/chat.
3. Guardar backups criptografados, com acesso administrativo restrito. Documentar separadamente Auth/SMTP/templates/redirects, versões Edge, origens/CSP, artefatos frontend e referências aos segredos no cofre. Dump PostgreSQL não recupera automaticamente configurações externas, gateway ou arquivos Storage.
4. Ensaiar recuperação em destino protegido e separado, com plano específico para papéis/schemas gerenciados; não importar um dump de roles locais sobre o Supabase. Conferir dados, funções, RLS, ACL, histórico e acesso negado, sem apontar um site público para a cópia.
5. Só considerar o backup apto após verificar restauração e compatibilidade. Não iniciar 011 se não houver recuperação aceitável e janela autorizada.

### Em caso de falha

1. Interromper novas etapas e conter apenas as escritas afetadas conforme plano aprovado; preservar logs sanitizados, checkpoint, estado de transação e histórico de ações.
2. Determinar se a etapa falhou antes do COMMIT ou se o check falhou depois. Voltar o frontend só se comprovadamente compatível com o esquema em uso. A 026 e contas marcadas para troca de senha exigem manter o fluxo seguro acessível.
3. Preferir correção incremental revisada quando há dados novos. Não executar cadeia de downs: 015/024/025 recusam certos estados, e 026 não possui down automático seguro após uso.
4. Se for necessária restauração, restaurar primeiro em destino separado, comparar e reconciliar cultos/acessos/históricos gravados após o backup. Restaurar por cima do projeto em uso pode perder dados novos da Cronoanálise e exige autorização própria.
5. Revalidar core, sessões, permissões e segurança antes de retomar. Manter auditoria, aliases e histórico; não deletá-los como estratégia de rollback.

O teste G10.4 restaurou a base 004 e o estado final 026 e comparou todas as **47 tabelas** do banco sintético final, além de funções/estrutura/ACL. O restore ocorreu no mesmo cluster, com roles já existentes: não comprova recuperação gerenciada do Supabase, GoTrue, SMTP, JWT, Storage ou outro cluster. Nenhum backup real foi executado.

## 7. Bloqueios e condições de liberação

| Item | Situação | Condição para avançar no projeto real |
| --- | --- | --- |
| Cadeia 005–026 no código nominal | Sem falha local nos checkpoints/ensaios | Revisar hashes e aprovar os arquivos exatos |
| Compatibilidade remota de definições/grants | Resultado G10.1 informado como compatível; JSON completo não revalidado aqui | Confirmação do responsável técnico sobre o estado/delta utilizado, reaproveitando evidência disponível; sem repetir auditoria automaticamente |
| Backup, janela e DCL do provedor | Não confirmados neste ambiente | Backup recuperável, RPO/RTO, papel operador e janela acordados antes da execução/011 |
| Artefato frontend conectado | Não publicado; gerador HML bloqueia produção deliberadamente | Definir/autorizar o caminho correto de implantação, sem fixtures nem remoção oportunista de proteções |
| Auth/Edge/gateway/SMTP reais | Código revisado; serviço hospedado não testado | Configurar/homologar em etapa autorizada, com identidades controladas expressamente permitidas |
| Pessoas, responsabilidades, aliases e dados iniciais | Não importados automaticamente | Confirmação administrativa, deduplicação por ID e autorização específica de dados/contas |
| Rastreabilidade da entrega | G10.3/026 ainda em alterações locais, com hashes | Revisão e autorização de commit/push da branch de desenvolvimento, sem merge/publicação implícitos |
| Autorização para operar no IASD_Parada | **Não concedida nesta solicitação** | Autorização específica para o lote, backup, configuração e testes de gravação |

O arquivo G10.2 não é condição para continuar desenvolvimento ou revisar este pacote. As evidências operacionais indispensáveis acima continuam pendentes; não foram consideradas validadas por simples menção a uma execução anterior.

## 8. Testes, artefatos e reprodução local

- **37 testes selecionados aprovados nesta execução:** 5 de preparação/pacote, 4 do ensaio/recuperação/interrupção e 28 da governança G10.3, sendo 32 com PostgreSQL descartável.
- **22 checkpoints de migração aprovados**, core preservado em cada etapa; nenhuma conta Auth criada pelas migrações e nenhuma pessoa importada automaticamente.
- Dois restores aprovados, schema/funções/ACL comparados e consultas privadas negadas após restore. Os testes G10.3 cobrem permissões, publicação, conflitos, concorrência, primeiro acesso, auditoria e escopos de líder/ancião/admin.
- A evidência anterior de 104 testes G10.3 permanece referenciada em `governance-g10-3-validation.json`; não foi somada à contagem atual nem equivale a testes com Auth real. A suíte histórica completa e os navegadores não foram reexecutados nesta consolidação sem alterações de interface.
- Logs e ensaio: `dist/governance-g10-4/tests-final.log`, `package-verified.log` e `rehearsal.json`. O pacote SQL **não contém backups**, credenciais, código servidor ou 001–004.

Reprodução local, com um contêiner PostgreSQL 17 **novo**, descartável, `--network none`, sem portas e sem conexão com Supabase:

```sh
IASDPI_PG_TEST_CONTAINER=NOME_DO_CONTAINER_DESCARTAVEL PYTHONPATH=tests python -m unittest test_g10_4_readiness test_g10_4_installation_sql test_g10_3_governance_sql -v
```

O primeiro teste confirma a ausência inicial do executor; não reutilizar um cluster já migrado para simular essa condição. Não há parâmetro de URL de produção nem instalador remoto neste runner; os testes usam `docker exec psql` no contêiner explicitamente validado sem rede.

Pacote de revisão: `dist/governance-g10-4/IASDPI-G10.4-revisao-SQL.zip`.

SHA-256 do pacote: `f326fa51bd5d3c24a31f76282b4f13885fe60231a563cf3700338c616e38c784`.

Fonte de ordem/hashes: `docs/governance-g10-4-migrations.json`; resultado consolidado: `docs/governance-g10-4-validation.json`.

## 9. Ações que exigem autorização específica

- Executar qualquer SQL/migração ou verificação no banco existente, produzir/exportar backup real ou restaurar/PITR.
- Configurar Auth/SMTP/redirects/Data API, segredos, funções Edge, flags, domínio/origem ou frontend conectado.
- Criar/convidar usuários reais, vincular aliases/UUIDs, conceder/suspender/revogar acesso, gerar/entregar credenciais, redefinir senhas ou invalidar sessões reais.
- Importar/conciliar pessoas, departamentos e históricos; executar gravações de homologação no projeto compartilhado.
- Fazer commit/push, merge ou publicação. Não há autorização implícita de produção neste relatório.

**Interrompido antes de qualquer operação no banco existente.**
