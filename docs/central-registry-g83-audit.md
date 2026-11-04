# G8.3 — Auditoria e consolidação do Cadastro Geral

Branch: `feat/schedule-management-b1`. Base: G8.2 existente no checkout. O texto original da G8.1 não estava disponível; portanto, a matriz usa **os 12 requisitos de referência fornecidos na G8.3**, sem presumir exigências adicionais ausentes. Não foi reconstruída a G8.1.

A auditoria identificou uma base normalizada já adequada. As lacunas eram de acesso e consulta na interface integrada, além de a pesquisa RPC considerar somente o nome completo. A Fase A **já possuía pesquisa, CRUD e editor privado**: esses recursos não foram tratados como inexistentes. O editor G8.2 e o editor privado da Fase A foram reutilizados.

## Matriz G8.1 × G8.2 × consolidação

**Atendido** significa implementado no código; não significa ativado ou homologado no Supabase real. Evidências apontam para os arquivos do checkout.

| # | Requisito G8.1, conforme referência G8.3 | Situação encontrada na G8.2 | Situação após G8.3 | Evidência e correção |
| --- | --- | --- | --- | --- |
| 1 | Uma tabela central de pessoas por igreja | Atendido | Mantido e testado | `database/005_schedule_foundation.sql:23` define `schedule_people`; `database/011_church_isolation.sql:95` acrescenta igreja/RLS. Continua uma tabela física, particionada logicamente por `church_id`. Nenhuma nova tabela criada. |
| 2 | Pessoa em vários departamentos sem duplicação | Atendido | Mantido e testado | `005_schedule_foundation.sql:32` define `schedule_memberships` com unicidade pessoa/departamento; qualificações por vínculo em `:55`. `017_central_registry_integration.sql:54` salva somente vínculos enviados. Testes conservam um ID em três departamentos. |
| 3 | Nome completo, nome preferido, igreja e ativo/inativo | Estrutura atendida; edição de status da pessoa não estava exposta no formulário G8.2 | Interface consolidada; definição de categoria opcional pendente | `schedule_people.name`, `display_name`, `church_id`, `active` já existem. O formulário agora mostra os rótulos explícitos, igreja selecionada e flag **Pessoa ativa**; status do vínculo continua separado. Nenhum campo/tabela duplicado. |
| 4 | Contatos opcionais restritos | Segurança atendida; acesso indireto pelo cadastro da Fase A | Atendido com atalho integrado | `005_schedule_foundation.sql:89` guarda contato/notas em schema privado; `:168` exige admin. `frontend/schedule-foundation.js:178` reaproveita o editor existente. Novos testes negam leitura ao líder/anônimo e não encontram contatos nas projeções públicas/ministeriais. |
| 5 | Liderança, participação e habilitação separadas | Atendido | Mantido e testado | `is_ministry_head`, `participation_confirmed` (`017:8`) e `schedule_qualifications` são distintos. Nenhum papel Auth é concedido pela liderança ou por um vínculo ministerial. |
| 6 | Pesquisar, filtrar, cadastrar e editar pessoas | Parcial na interface integrada: a Fase A já tinha CRUD/pesquisa; Cadastro Geral G8.2 exibia vínculos por departamento e seletores, sem diretório com pessoas sem vínculo/status | Lacuna corrigida | Diretório usa a mesma projeção central, com busca por nome completo/preferido, status, departamento e **Sem departamento**, filtros combináveis e limpeza. Reutiliza o formulário G8.2. `frontend/schedule-foundation.js:209`; `018_registry_search.sql:7` amplia a pesquisa RPC ao nome preferido, preservando ACL. |
| 7 | Editar vínculos de vários departamentos de uma pessoa | Atendido pelo backend e por alternância entre departamentos; faltava uma visão conjunta | Lacuna de navegação corrigida | A ação **Vínculos** mostra as linhas autorizadas da mesma pessoa, reutilizando o editor por vínculo. Salvar uma linha conserva as demais, inclusive alterações pendentes. O botão Histórico envia o departamento da própria linha. `frontend/schedule-foundation.js:206`, `:239`. |
| 8 | Disponibilidades e limites independentes por departamento | Atendido | Mantido e testado | Disponibilidade normalizada em `005:66`, opção departamental e patch parcial em `017`; limite mensal em `schedule_memberships`. Nenhuma conversão de unknown em disponível e nenhuma nova política de distribuição. |
| 9 | Organograma e Escalas usam o cadastro central | Atendido, preparado para ativação | Mantido e regredido | `017:135` projeta liderança pública; `:159` fornece contexto central às escalas. `frontend/schedule-foundation.js:302` aplica liderança e `frontend/schedule-management.js:58` verifica confirmações. As fontes históricas permanecem referências até conciliação humana. |
| 10 | Preservar nomes históricos não conciliados | Atendido | Mantido e testado | `schedule_source_links` registra associação explícita; fonte original não é reescrita. `frontend/schedule-foundation.js:303`. Testes mantêm 15 registros de Sonoplastia e 5 de Comunicação, sem fusão de nomes semelhantes. |
| 11 | Permissões e isolamento por igreja | Atendido no código; ambiente real pendente | Mantido e testado localmente | FKs compostas por igreja em `011:139`, RLS restritiva em `011:169`, capacidades `members` no backend e funções SECURITY DEFINER com search_path vazio. A 018 mantém exatamente as concessões da pesquisa. Testes reais em PostgreSQL descartável; Auth/Edge reais não homologados. |
| 12 | Compatível com migrações 005–017 | Cadeia existente preparada | Compatibilidade local verificada | A cadeia 001–017 é instalada nas fixtures antes da 018. A 018 substitui apenas o corpo da função de pesquisa. Checks de 011–017 continuam sem divergências; hashes das migrações anteriores preservados. |

### Delimitação do item 3

“Vínculo com a igreja” foi interpretado como pertencimento à igreja selecionada, já representado pela FK `church_id`, agora visível na interface. A classificação **membro/visitante/convidado ou outra categoria** não está definida nos requisitos disponíveis; foi solicitada uma preferência opcional e não foram inventados tipos ou valores. Se essa classificação for desejada, sua definição permanece pendente antes de modelar o campo.

Os campos comportam nomes completos/preferidos, mas não comprovam que todo nome já informado seja um nome civil completo. As grafias existentes e referências incompletas foram conservadas; completar dados reais exige confirmação humana.

## Correções realizadas, sem novas estruturas

1. Diretório de pessoas no Cadastro Geral: inclui pessoas sem departamento, filtros combináveis e estados explícitos de zero resultados. Continua usando `iasdpi_registry_people`/`catalog`; não é uma nova fonte de dados.
2. Status **da pessoa** editável no formulário existente, separado do status **do vínculo**. O mesmo ID é atualizado; não há exclusão/recriação. Validações existentes podem impedir inativação incompatível com publicação vigente.
3. Consulta conjunta dos vínculos autorizados de uma pessoa, com o mesmo formulário por vínculo e histórico corretamente direcionado ao departamento da linha. Vínculos não enviados não são apagados.
4. Atalho administrativo para contatos privados reutiliza `iasdpi_schedule_person_details` e o editor da Fase A. O líder não recebe o editor; o PostgreSQL continua negando leitura privada mesmo com chamada direta.
5. Pesquisa RPC por nome preferido e completo, com normalização já existente de acentos/espaços/caixa. `%` é texto literal, não wildcard que enumera dados adicionais.
6. Fixture corrigida para preservar contato/notas ao simular uma alteração parcial de nome/status. A produção já preservava esses campos em tabela privada; a correção foi do simulador, sem mudar o contrato de segurança.

Não foram criadas tabelas, outro cadastro, autenticação, permissões, tipos de membro ou dados reais. A busca e as edições usam IDs e a igreja do contexto autenticado.

## Arquivos alterados nesta etapa

| Arquivo | Motivo |
| --- | --- |
| `database/018_registry_search.sql` | Migração pequena para pesquisa por nome preferido; sem alteração de linhas ou de tabelas. |
| `frontend/schedule-foundation.js` | Diretório/filtros, status, visão dos vínculos, encaminhamento do histórico e reaproveitamento do editor privado. |
| `frontend/styles.css` | Tabela de consulta geral com rolagem localizada e alvos de toque. |
| `scripts/export_preview.py` | Opção isolada `--registry-consolidation-preview`; não substitui a prévia G8.2 arquivada. |
| `tests/fixtures/registry-integration-preview.js` | Pesquisa equivalente à 018 e preservação dos detalhes privados na simulação. |
| `tests/test_registry_integration_browser.py` | Seletores de submit explicitados porque o formulário passou a ter também o botão de contatos. Os cenários anteriores foram mantidos. |
| `tests/test_registry_consolidation_sql.py` | Testes novos mais reutilização dos cenários G8.2 em 001–018. |
| `tests/test_registry_consolidation_browser.py` | Filtros, status, vínculos, contatos, permissões, alterações pendentes, teclado e responsividade. |
| Este relatório e `dist/registry-g83/` | Matriz, resultados, evidências, prévia e integridade dos arquivos. |

O git status contém alterações acumuladas anteriores: não foram sobrescritas, commitadas ou mescladas. As migrações 005–017 continuam com os mesmos hashes.

## Testes e evidências

Resultados consolidados em `dist/registry-g83/test-results.json`, com logs separados para PostgreSQL, interface, regressão e handlers. **142 cenários distintos aprovados ao considerar a reexecução isolada do cenário abaixo**, incluindo 12 cenários novos (5 SQL e 7 de interface). A suíte histórica completa não é declarada como reexecutada.

| Grupo | Resultado | Evidência |
| --- | --- | --- |
| PostgreSQL descartável, cadeia 001–018 | 21 aprovados | `sql-evidence.log` |
| Cadastro Geral em Chromium | 18 aprovados; mesmos cenários repetidos na prévia final G8.3 | `browser-evidence.log`, `browser-g83-final-evidence.log` |
| Regressão dos módulos anteriores | 80 aprovados e 1 timeout inicial; cenário restante aprovado isoladamente | `regression-evidence.log`, `import-retry-evidence.log` |
| Handlers de autenticação/recuperação | 22 aprovados | `edge-evidence.log` |

**Instabilidade remanescente do teste:** a execução conjunta travou ao selecionar o modelo antes de iniciar a importação operacional. A reexecução isolada passou em 3,5 s, sem alteração de código ou de teste. A causa do timeout não foi comprovada; não foi tratada como correção da G8.3. O log da falha permanece disponível. Não há falha funcional persistente reproduzida, mas esse cenário deve ser acompanhado na próxima execução conjunta.

- **PostgreSQL real descartável:** esquema 001–018, uma tabela de pessoas, três vínculos por pessoa, preservação dos dados de todas as tabelas ao reaplicar 018, pesquisa por nome preferido, contato privado, acesso cruzado negado, versionamento, retry, concorrência, nomes e fontes históricas. Auth no PostgreSQL usa claims de teste; não comprova configuração do provedor.
- **Navegador Chromium:** backend demonstrativo sem rede externa, filtros combinados, pessoas sem vínculo, inativação, visão de três departamentos, preservação de alteração pendente em outro vínculo, reutilização do editor privado, checagem de escopo do histórico, permissões, teclado e larguras 360/390/768/1024/1440.
- **Regressão:** G7, Agenda, Organograma, Cronoanálise, horários, rascunhos, persistência simulada, pacotes/hashes/rollback e handlers de Auth/recuperação.
- Safari, Firefox e aparelhos físicos Android/iPhone não foram testados. Emulação de largura não equivale a homologação desses dispositivos.

As primeiras execuções registraram seletores ambíguos de testes e uma expectativa errada de quantidade na pesquisa por “Luan”, que corretamente também encontra “Luana”. Foram ajustadas as asserções/seletores, sem reduzir cobertura. Logs iniciais são preservados; tentativas/repetições não aumentam a contagem final.

## Prévia e homologação

```bash
python scripts/export_preview.py --registry-consolidation-preview --output dist/registry-g83/IASDPI-G83-revisao.html
```

HTML independente, namespace próprio G8.3, CSP `connect-src 'none'`, nomes já informados e contas/preferências/dados de operação exclusivamente demonstrativos. Alterações permanecem na memória da demonstração e reiniciam ao recarregar.

1. Abrir o HTML, entrar em **Montar escala** e selecionar IASD_PI. Conta fictícia: `admin.pi.teste`, senha `Demonstracao#2026`.
2. Abrir **Membros das escalas**. Pesquisar por nome completo ou preferido; combinar status/departamento e consultar pessoas sem vínculo.
3. **Editar pessoa** reutiliza o formulário do Cadastro Geral. Alterar nome preferido/status e salvar; conferir o mesmo ID e contagem de pessoas.
4. **Vínculos** abre todos os departamentos autorizados da pessoa. Alterar um limite/função sem salvar os outros; conferir preservação das alterações pendentes.
5. **Editar contatos privados** abre o editor administrativo já existente. Depois de salvar, voltar ao Cadastro Geral; contatos não devem aparecer no diretório, Organograma nem escalas públicas.
6. Conta fictícia `som.teste`, mesma senha: somente vínculos de Sonoplastia; sem editar pessoa central nem ver contato privado. Cadastro de responsável não amplia o acesso Auth.

## Migração, ativação e limites

A 018 exige 001–017 completas. Executar apenas etapas realmente ausentes após autorização específica. É uma mudança transacional/reaplicável da função existente, com as mesmas permissões e sem INSERT/UPDATE/DELETE de dados ou criação de tabela.

Antes da ativação real: comparar eventual G8.1 externa ainda ausente, conferir instalação real da cadeia, snapshot/backup e pacote anterior, revisar SQL 018, executar os checks de segurança de 011–017, homologar Auth/RLS com contas descartáveis e validar a nova interface. Não considerar flags de frontend ou testes simulados como autorização de banco.

Rollback preferencial: pacote frontend anterior validado, mantendo o banco. Se for necessário reverter apenas a pesquisa, revisar/restaurar a definição anterior de `iasdpi_registry_people(text)` da 017 com suas concessões. Não remover cadastros, referências ou vínculos. Nenhuma reversão foi realizada em produção.

**Pendências:** classificação opcional de vínculo com a igreja sem definição; texto original G8.1 ausente; ativação e Auth/Edge/RLS no Supabase real não homologados. As ressalvas já documentadas na G6 sobre consecutivas/quantidade desejada e contagem da própria publicação permanecem fora desta consolidação.

Nenhum SQL no Supabase real, conta real, commit, merge, push ou publicação nesta etapa. Desenvolvimento interrompido para revisão ao final.

Commit sugerido, não executado: `fix: consolida consulta e edição do cadastro geral`.
