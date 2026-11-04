# G9 — Preparação para homologação real

Branch: `feat/schedule-management-b1`. Data: 03/11/2026. Esta entrega prepara homologação; **não autoriza nem executa ativação**. Não foram criados usuários reais, aplicadas migrações no Supabase, realizadas conciliações reais ou operações Git de commit/merge/push/deploy.

## Situação comprovada e limitações

| Item | Evidência | Situação |
| --- | --- | --- |
| Cadeia 005–019 | `dist/governance-g9/migration-review.json`; um arquivo forward por número, transações e hashes | Revisada localmente; arquivos anteriores preservados |
| Atualização partindo de 001–004 | `migration-rehearsal.json`; PostgreSQL 17, container sem rede, Auth simulado | 15 etapas instaladas; fingerprints do núcleo preservados após cada etapa |
| Modelos e cultos de referência | Dados **sintéticos**: modelos 16/16/0, dois cultos, um na Lixeira | Não equivalem a cópia nem consulta de produção |
| Gravação compartilhada e concorrência | `tests/test_g9_lifecycle_sql.py`: duas identidades, mesma versão, conflito entre departamentos | Exercitados no PostgreSQL descartável |
| Recuperação | `restore-evidence.json`: dump custom/restauração em banco novo e 41 tabelas comparadas | Igualdade dos dados e acesso privado bloqueado; mesmo cluster, papéis já existentes |
| Supabase de produção | Único GET anônimo de metadados REST: HTTP 401; `production-public-metadata.json` | Sem leitura de registros. Não comprova ausência de migrações nem falha da RLS |
| Configuração Auth/Edge real | Não há sessão administrativa autorizada disponível nesta execução | Pendente; código correto não comprova configuração instalada |
| Resultado consolidado da regressão | `test-summary.json` e logs referenciados na seção de resultados | Consultar resultado final; reexecuções são deduplicadas por ID |

A última base informada como instalada pelo usuário contém 001–004. **Isso é informação anterior, não inventário atual confirmado.** Os estados atuais dos cultos de 10/10 e 22/10 não foram consultados. Não se deve decidir o que instalar com base apenas nessa informação.

O ensaio usa PostgreSQL 17 com rede desativada, JIT desligado e persistência padrão do container; não mede desempenho nem disponibilidade do Supabase hospedado. O adaptador Auth local reproduz claims/roles para testar SQL, sem simular integralmente o serviço GoTrue.

Reprodução da regressão: provisionar um container PostgreSQL **descartável, sem portas e com `--network none`**, com os requisitos já usados pelos testes, e executar `python scripts/run_g9_regression.py --container NOME_DO_CONTAINER_DESCARTAVEL --output dist/governance-g9-rerun`. O runner recusa container com rede, usa cópia temporária do código, exclui variáveis Supabase/PG e não sobrescreve os artefatos anteriores. Não apontar testes de SQL para bancos existentes.

## Inventário real antes de escolher a sequência

1. No SQL Editor do ambiente a inventariar, como operador administrativo, executar **somente** `database/check_g9_baseline.sql`. É um único SELECT, produzindo uma célula JSON; não executa DDL/DML. Os testes executaram a consulta dentro de transação READ ONLY.
2. Guardar o JSON completo fora do repositório, em local protegido. Ele contém metadados, proprietários, privilégios, hashes de definições e contagens/digests do núcleo, sem registros individuais, e-mails, corpos de funções ou senhas. Não é backup. O digest percorre os dados do núcleo; avaliar custo se o banco crescer.
3. Comparar offline com a referência sintética equivalente. Exemplo **somente local**:

```sh
python scripts/compare_g9_snapshots.py --expected dist/governance-g9/expected-004.json --observed /tmp/iasdpi-producao-schema.json --output /tmp/iasdpi-baseline-diff.json
```

4. Revisar cada ausência, objeto extra e definição divergente, incluindo funções públicas não pertencentes a extensões. Diferenças de versão PostgreSQL, papéis ou objetos gerenciados pelo provedor exigem análise humana. A comparação não gera SQL corretivo e **não compara os dados reais aos dados fictícios**.
5. Os marcadores não são um ledger de execução. A 018 substitui uma função preexistente; sua presença não distingue 017/018/019. Conferir hashes/definições, privilégios e histórico administrativo.
6. Se 011 já existir sem a fundação 005–010, **interromper o plano padrão**: 011 suporta o core sem Escalas, mas adicionar a fundação posteriormente exige uma adaptação revisada. Se houver etapas parciais, planejar apenas as ausentes após comparar estruturas. Não reaplicar uma cadeia inteira sobre um banco desconhecido.

As diferenças concretas contra a produção permanecem **pendentes desse inventário**. `planned-004-to-019-diff.json` mostra apenas a diferença planejada entre duas bases sintéticas, não uma auditoria do Supabase real.

## Ordem e dependências das migrações

Para um **projeto HML vazio e separado**, instalar primeiro `001_single_church_access.sql`, `002_user_management.sql`, `003_operational_storage.sql`, `004_culto_trash.sql`; então a sequência abaixo. A fixture local possui um modelo sintético com 16 atividades: uma instalação vazia não tem os 16 itens particulares da produção. O seed de modelos/dados HML deve ser revisado separadamente; não copiar cultos reais para viabilizar o teste.

| Ordem | Arquivo em `database/` | Mudança principal |
| --- | --- | --- |
| 005 | `005_schedule_foundation.sql` | Pessoas, departamentos, vínculos, funções, habilitações, disponibilidade e contatos privados |
| 006 | `006_schedule_management.sql` | Eventos, planos, requisitos, atribuições, versões e validação transacional |
| 007 | `007_daily_schedules.sql` | Regras por dia, configuração global, exceções administrativas e limites |
| 008 | `008_monthly_rotation.sql` | Contexto de rodízio e montagem mensal |
| 009 | `009_confirmed_schedule_conflicts.sql` | Compromissos históricos e conflitos entre departamentos |
| 010 | `010_simple_daily_schedules.sql` | Participação geral e edição manual compatível |
| 011 | `011_church_isolation.sql` | IASD_PI, backfill de igreja, FKs, RLS e executor sem BYPASSRLS |
| 012 | `012_alias_login.sql` | Aliases privados, reserva de identificadores e orçamento de login |
| 013 | `013_access_governance.sql` | Capacidades ministeriais, suspensão/revogação, fila e recuperação controlada |
| 014 | `014_portal_integration.sql` | Contexto do portal e feed público da última publicação |
| 015 | `015_elder_period_storage.sql` | Ancião da Semana/Mês independentes e versões |
| 016 | `016_department_schedule_days.sql` | Dias por departamento persistentes, autorização e controle de versão |
| 017 | `017_central_registry_integration.sql` | Vínculos centrais, fontes históricas e projeções |
| 018 | `018_registry_search.sql` | Busca por nome preferido |
| 019 | `019_registry_identities.sql` | Aliases históricos de pessoas, conciliação explícita, IDs aposentados e auditoria |

Cada arquivo tem BEGIN/COMMIT próprio. Executar um de cada vez, guardar sucesso/checksum e parar no primeiro erro. Não incluir `_down`, `check_*` ou `supabase-archives.sql` como etapas forward. Não executar todos em uma transação externa sem revisar os controles transacionais internos.

**Risco de reexecução confirmado localmente:** reaplicar a 018 depois da 019 regride a busca/filtragem das identidades consolidadas. O teste G9 detectou a divergência pelo hash da função. Isso não demanda alterar a migração antiga: exige ordem correta e proibição de reexecução. Um check só de proprietário/grant pode não detectar essa regressão.

Após 019, executar os checks finais: `check_church_isolation.sql`, `check_alias_login.sql`, `check_access_governance.sql`, `check_portal_integration.sql`, `check_elder_period_storage.sql`, `check_governance_integration.sql`, `check_department_schedule_days.sql`, `check_central_registry.sql`, `check_registry_identities.sql`. Esperado: **zero irregularidades**. Os checks históricos 005–010 podem esperar proprietários anteriores à 011; não utilizá-los isoladamente como critério da cadeia final. Conferir também FKs validadas, índices válidos, proprietários, search_path, EXECUTE, acesso a schemas privados e ausência de escrita direta, conforme snapshot/checks finais.

Repetir o snapshot no HML instalado e comparar offline com `--expected dist/governance-g9/expected-019.json --observed /tmp/iasdpi-hml-final.json`. Registrar e revisar as diferenças próprias do provedor; o estado dos marcadores sozinho não aprova a instalação.

## Ambiente HML isolado e pacote

- Criar um projeto Supabase próprio **somente após autorização**, com uma única igreja ativa IASD_PI. Não reutilizar o banco ou as chaves administrativas da produção.
- Hospedar o frontend em **origem HTTPS distinta**, por exemplo um projeto de hospedagem HML dedicado, sob `/portal/`. Este endereço é ilustrativo, não foi criado. Outro repositório Pages sob `lcs-casagrande.github.io` mantém a mesma origem e não isola completamente sessões/armazenamento.
- O gerador ganhou modo explícito `--real-homologation`, namespace `iasdpi-hml-real-v1`, persistência Supabase e configuração pública própria. Rejeita os dois projetos Supabase de produção conhecidos, os hosts existentes de produção/homologação compartilhados, modos incompatíveis, chaves secretas e campos extras. O modo antigo de consulta permanece intacto.
- Copiar `docs/hml-public.example.json` para arquivo externo ao Git; preencher somente URL e chave **publishable do HML**. O exemplo contém placeholders e deve ser rejeitado sem preenchimento. Flags G1–G4/Cadastro Geral só devem ser usadas com toda a cadeia implantada. Flags não substituem permissões.
- Exemplo de geração **após configurar/aprovar o HML**, sem publicar:

```sh
python scripts/build_homologation.py --real-homologation --public-config /tmp/iasdpi-hml-public.json --site-url https://iasdpi-hml.example.org/portal/ --output dist/g9-real-hml
```

O gerador atual exige HTTPS, um segmento de caminho e barra final. O pacote recebe manifesto, hashes e SRI. Manter as cinco flags do exemplo habilitadas para a homologação integrada: o modo antigo sem portal pode apontar a Cronoanálise para seu endereço oficial. Não usar esse modo parcial como isolamento completo.

Não foi gerado um pacote conectado a um projeto real nesta etapa. Os testes usam URL/chave deliberadamente fictícias e não fazem requisições externas. `frontend/config.js` e as migrações 005–019 não foram alterados pela G9.

Há alterações acumuladas não commitadas dos trabalhos anteriores. O HEAD sozinho não identifica esta candidata: usar o manifesto de hashes dos arquivos e, somente após autorização, criar o commit de referência do pacote revisado. Não descartar arquivos não rastreados para “limpar” a branch.

## Auth, permissões e implantação Edge

As identidades de login são do Supabase Auth; participantes ministeriais são outra entidade. O core mantém `admin`/`leader` em `iasdpi_access`. Acesso a Escalas usa capacidades por departamento (`view`, `edit`, `publish`, `members`, `access`, `requests`) e contexto de igreja. Um líder só ministerial pode não ter entrada de acesso à Cronoanálise. Ser ancião ou responsável no Organograma não concede administração.

| Entidade existente | Papel na integração |
| --- | --- |
| `public.iasdpi_churches` / `public.iasdpi_access` | Igreja ativa e autorização do usuário Auth no core; contexto e isolamento introduzidos pela 011 |
| `public.schedule_department_access` | Capacidades por usuário/igreja/departamento; não derivadas do nome ou liderança |
| `public.schedule_people` / `schedule_memberships` / `schedule_qualifications` | Identidade central, múltiplos vínculos e habilitações independentes; contato no schema privado |
| `iasdpi_admin_private.login_aliases` | Resolução privada de apelidos de login; acesso pelo componente servidor protegido |
| `public.schedule_plans` / `schedule_versions` / `schedule_assignments` | Rascunhos, atribuições, CAS e snapshots publicados; público recebe projeção sanitizada |
| `public.schedule_elder_periods` / `schedule_elder_versions` | Modalidades semanal/mensal independentes |
| `public.schedule_source_links` / `iasdpi_schedule_private.person_aliases` | Associação das fontes e grafias históricas, sem recriar cadastros |

As FKs compostas/contexto, políticas RLS e RPCs impõem o isolamento no banco. A UI só organiza as opções; os testes chamam RPCs diretamente e tentam operações proibidas nas tabelas.

Não há um superusuário universal concedido pela interface: administradores atuam nas igrejas autorizadas. Vários apelidos podem resolver a mesma identidade; escolher outro apelido não muda as permissões. Aliases de login e aliases históricos de nomes de pessoas são estruturas distintas.

Checklist de Auth/Edge e execução real: `g9-real-validation.md`. A configuração necessita URL/chaves **do HML**, segredos no gerenciador do Supabase, allowlist de origem e implantação de `alias-login`/`access-assistance`. O modelo local de `auth.users` não testa GoTrue, gateway, SMTP, JWT real, PKCE ou políticas do serviço.

Primeiro administrador **apenas no HML**, mediante nova autorização: operador cria uma conta descartável no Auth, confirma o UUID e executa o bootstrap administrativo documentado em `access-control.md` antes da 011; a 011 associa o acesso existente à IASD_PI. Se a cadeia completa já foi instalada, usar procedimento administrativo com igreja explícita, revisão de estrutura e UUID, sem disponibilizar bootstrap público. Não reaproveitar uma senha coletiva, inferir contas por nome ou modificar o administrador de produção.

## Histórico e conciliação de nomes

As fontes originais de Sonoplastia (15), Comunicação (5) e Ancionato permanecem preservadas. Os testes de navegador verificam as referências locais; isso **não confirma importação/associação dessas linhas no Supabase real**. O ensaio G9 não importa escalas automaticamente.

Conflitos utilizam o ID central da pessoa. Uma referência histórica ainda sem associação não pode ser tratada como identidade conciliada por comparação de nomes; revisar as pendências antes de considerar completa a cobertura histórica dos conflitos no ambiente real.

A 019 instalada não mescla nem renomeia pessoas sozinha. Para conciliar, após autorização no ambiente alvo: consultar pendências → revisar referências/contatos/vínculos → escolher ID central → prévia/token → confirmar **cada grupo** → verificar novas versões/auditoria, sem reescrever snapshots históricos. Qualquer mudança entre prévia e confirmação exige nova prévia. Cancelar não altera dados.

Aplicar somente as 13 identidades e 15 grafias confirmadas em `central-registry-g84.md`: Lucas Borrego, Rafael Braga, Gabriel Macedo, Raphael Moreira, Paulo Scarpelini, Samuel Ferreira, Izabelle Souza, Simone Cristina, Letícia Ferreira, Rosana Bianchini, Victória Scarpelini (Victoria somente de Desbravadores), Luan Vaz e Henrique Franco. Não confundir Rafael Braga e Raphael Moreira. Duas pessoas em um mesmo departamento, contas distintas ou dados incompatíveis exigem análise; não forçar a mesclagem nem criar habilitação/disponibilidade por nome.

## Backup, recuperação e rollback

1. Antes de mudanças reais, obter backup consistente de schema/dados/funções/RLS/ACL, com dependências de papéis documentadas, além do pacote anterior validado. Guardar criptografado fora do Git/chat e testar recuperação em destino separado.
2. Configurações Auth, SMTP/templates, Edge Functions/segredos, Storage e backups/PITR do provedor são inventário separado. Um dump de tabelas de aplicação não cobre tudo. Não copiar roles internos do Supabase cegamente nem retirar owner/ACL para contornar erros sem revisar segurança.
3. O teste local usa `pg_dump -Fc` e `pg_restore --exit-on-error` em banco **novo no mesmo cluster**; compara os dados de 41 tabelas após conciliação/publicação e confirma bloqueio de acesso privado. É evidência de recuperação local, não de portabilidade/restauração do Supabase gerenciado.
4. Os downs 005/006/008/015 têm pré-condições e não constituem rollback global 019→004. A 015 recusa reversão com dependências/dados; essa recusa e preservação foram testadas. Não usar DROP/CASCADE ou remoção de histórico para destravar.
5. Preferir correção forward revisada. Para contingência, voltar ao pacote anterior validado, preservar banco e suspender gravações da versão nova quando necessário. Recuperação de banco exige autorização, destino separado, validação e reconciliação das gravações posteriores ao backup; nunca restaurar cegamente por cima de dados novos.
6. Conciliações já confirmadas não possuem “desfazer” universal: usar auditoria/IDs aposentados e backup para planejar uma correção explícita, sem apagar histórico.

## Critérios de aprovação e pendências

| Classificação | Pendência | Condição para liberar |
| --- | --- | --- |
| Bloqueante para ativação real | Estrutura atual da produção desconhecida | Snapshot administrativo, revisão das divergências e plano apenas das etapas ausentes |
| Bloqueante para homologação real | Projeto HML, origem própria e contas descartáveis ainda não provisionados | Autorização e configuração isolada |
| Bloqueante para aprovação de segurança real | Auth/Edge, SMTP, PKCE e RLS com JWT real não exercitados | Matriz `g9-real-validation.md` aprovada com evidências |
| Bloqueante para implantação | Recuperação no provedor não comprovada | Backup e restauração HML controlada com owners/ACL/configuração revisados |
| Importante | Navegadores/dispositivos reais não testados nesta rodada | Chromium local não comprova Safari, Firefox, Android ou iPhone |
| Importante | Limitações G6-05/06/09 | Rever cálculo de quota ao editar publicação; parâmetros desejado/consecutivos não aplicados pelo automático; destino pós-recuperação ministerial. Não prometer regras não exercitadas |

Não é necessário implementar novas funcionalidades para preparar o HML. Problemas encontrados na regressão e seus impedimentos ficam discriminados na seção de resultados final e em `test-summary.json`; não considerar testes falhos como aprovados por serem antigos.

**Pronto:** ensaio local, inventário somente leitura, comparador offline, cadeia/hashes revisados, teste de recuperação e modo de pacote HML isolado. **Ainda não liberado:** ativação real. Próximas ações exigem autorização explícita para criar/configurar projeto e hospedagem, aplicar SQL, instalar Edge/segredos, criar contas e executar gravações/e-mails de teste no HML. Produção permanece fora desse exercício. Commit, push, merge e publicação exigem autorização própria.

## Resultado final dos testes

**1.145 testes distintos aprovados no resultado consolidado: 1.123 Python + 22 Node.** Incluem os 19 novos casos G9 (9 PostgreSQL + 10 preparação/pacote). Zero casos sem execução, pulados ou com falha remanescente no consolidado. Evidência por ID: `dist/governance-g9/test-summary.json`.

Não foi uma única rodada limpa. A execução original coletou os 1.104 casos anteriores, executou 862 e registrou 831 sucessos, 9 falhas e 33 erros (incluindo erros de preparação de classes). Todos os casos afetados foram reexecutados; não se contou uma classe que falhou no setup como casos aprovados. A descoberta atual tem mais 19 casos G9. O consolidado deduplica por ID e aponta o arquivo de evidência de cada resultado final.

| Rodada | Resultado bruto | Tratamento |
| --- | --- | --- |
| Original, cópia isolada | 831 sucessos, 9 falhas, 33 erros | Preservado em `full-regression.log`/`python-results.json`; houve ausência inicial de metadados Git e cenários legados divergentes |
| `revalidation` | 292/294; uma falha e um erro | Classes/pacotes reexecutados após corrigir o harness; dois casos retomados isoladamente |
| `legacy-revalidation` | 138/138 | Relógio de outubro/2026 explícito, link acessível específico, consulta de configuração compatível com B1 |
| G9 direcionada | 19/19 | `g9-final.log`; preparação/pacote reconferidos 10/10 em `g9-package-final.log` |
| `isolated-recheck` | 2/2 | Subatividades e prévia de correção de data |
| `additional-recheck` | 9/9 | Dois testes de pacote/igreja, seis de demo e um de recuperação de falha |
| Node, handlers Edge com fetch/Auth simulados | 22/22 | `node-regression.log`; não comprova gateway/GoTrue/SMTP reais |

As correções do harness preservam as verificações: a cópia temporária agora permite leitura do Git sem atualizar o índice; cenários datados não dependem do mês do host; o link distingue navegação oculta e visível; a demo B1 anterior à 007 responde à sondagem de configurações sem inventar dias; a inspeção do pacote distingue nomes de variáveis opcionais de configurações/dados efetivamente definidos, com verificação de ausência no navegador.

**Ressalva importante:** três testes falharam em uma execução concorrente e passaram isoladamente, sem alteração do código funcional: nomes acessíveis de subatividades (espera pelo segundo campo), correção com prévia obsoleta (mensagem ainda “Processando…”) e falha temporária ao salvar escala (espera pelo alerta). A causa da intermitência não foi comprovada. Preservar os traces e validar sincronização/fluxos no HML; aprovação isolada não demonstra inexistência de uma corrida. Esses três IDs constam no consolidado.

A medição de Histórico, com REST simulado e outras suítes em paralelo, registrou para 1.000 cultos: aproximadamente **2,26 s de carregamento e 23,29 s de aplicação/renderização**. Artefato: `history-performance.json`. É um indício de custo no cliente, não benchmark controlado nem evidência de latência do Supabase; não se pode comparar diretamente com medições antigas em outra carga. Não foram implementadas otimizações ou paginação nesta preparação.

Preservação: `preservation.json` confirma frontend, Edge Functions e migrações 005–019 intactos nesta G9, além dos **46 itens do manifesto G8.4 sem divergências**, incluindo HTML/ZIP de revisão anteriores. `candidate-source-integrity.json` identifica por SHA-256 os arquivos da candidata não commitada. O ambiente PostgreSQL descartável foi encerrado após os testes; a limpeza está registrada em `local-cleanup.json`.

**Parecer:** preparação disponível para revisão e homologação controlada, com as ressalvas acima. Não há autorização nem evidência suficiente para ativação real. Inventário real, provisionamento HML, Auth/Edge/RLS com sessões reais e recuperação no provedor continuam bloqueantes para essa ativação.

## Arquivos desta G9

- `database/check_g9_baseline.sql`: novo inventário somente leitura, não migração.
- `scripts/audit_g9_migrations.py`, `scripts/compare_g9_snapshots.py`: auditoria e comparação offline.
- `scripts/run_g9_regression.py`: cópia isolada, exclusão de credenciais, logs/resultados e revalidações por ID.
- `scripts/build_homologation.py`: modo explícito de pacote para Supabase HML separado.
- `tests/test_g9_preparation.py`, `tests/test_g9_lifecycle_sql.py`: 19 casos novos de preparação e ensaio PostgreSQL.
- `tests/test_schedule_known_people.py`, `tests/test_schedule_calendar.py`, `tests/fixtures/schedule-b1-homologation-demo.js`: ajustes de regressão para relógio determinístico, link acessível específico e compatibilidade da demonstração B1 antiga com a consulta de configurações. Não mudam regras ou dados operacionais.
- `tests/test_schedule_demo.py`: distingue referências opcionais no código de dados efetivamente definidos; mantém bloqueios de rede/segredos e verifica no navegador a ausência de configuração e escala reais.
- `docs/hml-public.example.json`, este relatório e `g9-real-validation.md`: configuração pública de exemplo e roteiro.

Os demais arquivos modificados/não rastreados no checkout pertencem aos trabalhos anteriores e foram preservados. Nenhuma migração 020 foi criada. Sugestão futura de commit, **não executado**: `test: prepara homologacao isolada e auditoria G9`.
