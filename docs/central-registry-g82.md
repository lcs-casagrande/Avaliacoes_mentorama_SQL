# G8.2 — Cadastro Geral integrado

## Base encontrada e limites

Trabalho na branch `feat/schedule-management-b1`, sobre G7. **Não foi encontrada implementação ou migração identificada como G8.1 neste checkout**, nem nos outros diretórios do workspace pesquisados. A integração reutiliza o Cadastro Geral/Fase A/B1.1 existente; não presume que uma G8.1 externa tenha sido instalada. Antes da ativação, comparar eventual entrega G8.1 de outro checkout com a migração 017 para evitar colisões. Não foram realizados commit, merge, push, publicação, acesso a dados reais ou SQL no Supabase.

## Implementado

| Área | Comportamento |
| --- | --- |
| Pessoa única | `schedule_people.id` continua identificando a pessoa. Adicionar departamentos insere somente vínculos, sem duplicar pessoas. Cadastro central e nomes de exibição são atualizados com controle de versão. |
| Vínculos muitos-para-muitos | `schedule_memberships` mantém UNIQUE por pessoa/departamento e suas FKs por igreja. Cada vínculo possui status, condição de responsável, participação confirmada, habilitações, dias próprios ou herdados e limite mensal. |
| Funções | `schedule_qualifications` continua normalizada por vínculo/função. Alterar funções de um vínculo não remove qualificações de outro. Liderança não confirma participação nem habilita funções automaticamente. |
| Disponibilidade | Reutiliza `schedule_availability`, incluindo regras gerais, departamentais e por data/período. Unknown continua desconhecido; não é convertido em disponível. Regras de indisponibilidade prevalecem. Flags próprias substituem a confirmação semanal herdada, sem apagar as regras gerais ou manuais anteriores. |
| Rodízio | Exige pessoa/vínculo ativos, participação confirmada, qualificação explícita inclusive para função genérica, disponibilidade declarada, limites e ausência de conflito. Consulta o contexto central existente de todos os departamentos; reservas publicadas e exceções continuam no PostgreSQL. |
| Ancionato | Mantém semana e mês independentes. Proposta automática exige função correspondente e disponibilidade para o período. Semana continua domingo–sábado; mês não reserva dias em outros departamentos. Seleção manual e dados já salvos não são reconstruídos. |
| Organograma público | Projeta os vínculos ativos de liderança e nomes atuais. Subdivisões Diáconos/Diaconisas são explícitas. Configuração de liderança registrada passa a prevalecer; retirar o responsável não restaura silenciosamente o nome estático antigo. Referências não conciliadas permanecem preservadas. |
| Fontes antigas | Associações explícitas entre chave da fonte e ID central, sem mesclar nomes semelhantes. Escalas de dias/semanas conciliadas reutilizam a importação idempotente 009 para entrar nos compromissos por ID. Mês permanece referência, sem reserva diária. |
| Histórico | RPC específica por pessoa e departamento; líder autorizado consulta somente o seu escopo. Inclui registros atuais, versões e referências históricas conciliadas. Renomear não altera UUID nem snapshots antigos. As visualizações vinculadas usam o nome de exibição atual. |
| Interface | `schedule-members` apresenta a tabela por departamento, com funções, dias, limite, status, pendências e histórico. Seleção de múltiplos departamentos para uma pessoa existente. Salvamento por vínculo ou lote de novos vínculos, confirmação explícita, erros e campos pendentes preservados. |

A lista de pessoas consultada pela interface é uma projeção das tabelas centrais, não um segundo cadastro. Fontes estáticas do Organograma/Agenda são referências históricas e de conciliação, não são importadas como pessoas por correspondência de nome.

## Migração preparada: 017

Arquivo: `database/017_central_registry_integration.sql`. Executar **somente após revisão e autorização**, como postgres e com 001–016 completas. A execução é transacional e recusa reaplicação.

- Acrescenta `participation_confirmed`, `availability_override` e `leadership_scope` aos vínculos. Confirmações de qualificação já existentes inicializam participação; não infere disponibilidade nem funções a partir de liderança/histórico.
- Amplia a restrição `origin` da disponibilidade para aceitar `registry-g82`, preservando `manual` e `daily-profile`. Novas edições desativam somente regras anteriores deste formulário no mesmo vínculo, conservando o histórico e regras de outras origens.
- Cria `schedule_source_links`: associação de fonte histórica a pessoa, com igreja, versão, autoria e referência original. Não é outra tabela de pessoas nem substitui tabelas operacionais. Não cadastra pessoas, departamentos ou contas por seed.
- Mantém assinaturas de settings/contexto/workspace, acrescentando a política de elegibilidade e disponibilidade por data. Implementações anteriores ficam privadas para diagnóstico, sem EXECUTE para clientes.
- Mantém RLS e concessões dos cadastros existentes. A nova tabela tem RLS restritiva por igreja, FKs por igreja, índice por pessoa e nenhuma concessão direta a anon/authenticated.

RPCs novas:

| RPC | Permissão |
| --- | --- |
| `iasdpi_registry_people(text)` | Admin ou autorização `members` em algum departamento; retorna somente ID, nomes, status e versão da igreja para evitar duplicação. Não revela contato, notas, login ou vínculos privados de outros departamentos. |
| `iasdpi_registry_catalog()` | Admin/gestor de membros; projeções de vínculos e perfis autorizados. Associações de fontes somente para admin. |
| `iasdpi_registry_save(uuid,bigint,jsonb,jsonb,uuid)` | Dados centrais da pessoa: admin. Vínculos: capacidade `members` em **todos** os departamentos enviados; alterações são atômicas e parciais. |
| `iasdpi_registry_source_save(text,uuid,bigint,uuid,jsonb)` | Somente admin; confirma associação e metadados da fonte. Reutiliza registro histórico 009 para dias/semanas. Não sobrescreve compromissos conciliados com outra identidade. |
| `iasdpi_registry_history(uuid,uuid)` | Somente `members` no departamento solicitado; não expõe histórico de outros departamentos. |
| `iasdpi_registry_public()` | Anônimo/autenticado: somente nomes de liderança, identificação do departamento/escopo e nomes públicos de fontes conciliadas. Sem UUID de conta, contato, notas, disponibilidade ou rascunhos. |

As funções são SECURITY DEFINER, com search_path vazio e proprietário executor sem login/BYPASSRLS. Gravações adquirem o controle transacional existente, revalidam identidade/escopo, usam versão por pessoa/vínculo e recibo idempotente. Vínculos não mencionados no patch não são alterados. Edição concorrente do mesmo vínculo falha com versão obsoleta; dois departamentos mantêm versões independentes.

`is_ministry_head` não concede acesso ao sistema. Permissões continuam vinculadas à identidade Supabase Auth e à igreja/departamento, nunca ao nome ou condição no Organograma.

## Uso e prévia

Gerar novamente, sem publicar:

```bash
python scripts/export_preview.py --registry-preview --output dist/registry-g82/IASDPI-G82-revisao.html
```

A prévia é standalone, com contas fictícias e CSP `connect-src 'none'`. Usa os nomes já informados como referências e as fontes públicas históricas preservadas; preferências e confirmações começam pendentes. A fixture G8.2 descarta somente confirmações e conciliações hipotéticas da fixture G6 em memória; não altera a fonte pública original, o banco ou outra prévia. Recarregar reinicia a simulação.

1. Abrir a prévia, **Montar escala**, IASD_PI, entrar com `admin.pi.teste` / `Demonstracao#2026` (credenciais fictícias somente deste HTML).
2. **Membros das escalas** → Cadastro Geral. Selecionar departamento e editar uma linha. Confirmar participação, marcar função e dias realmente verificados; **Salvar vínculo**.
3. Em **Vincular pessoa a departamentos**, selecionar a pessoa existente e marcar vários departamentos. Só vínculos ainda inexistentes são acrescentados; não há remoção automática por desmarcar um departamento.
4. Cada vínculo pode ser ativado/inativado individualmente. Um vínculo em uso por escala publicada pode ter alteração recusada pela validação existente: revisar a escala de forma autorizada antes de retirar habilitação/ativação necessária.
5. Em **Cadastrar ou atualizar pessoa**, admin edita nome e nome de exibição. O nome de exibição acompanha o nome por padrão, podendo ser explicitamente personalizado. O ID e as versões históricas permanecem iguais.
6. Em **Associações pendentes**, conferir a origem e a identidade, depois confirmar. Fontes datadas também entram no histórico/validação por ID; é preciso possuir o vínculo departamental antes. Uma associação já importada não pode ser redirecionada silenciosamente para outra pessoa.
7. Testar o líder `som.teste`, mesma senha fictícia: somente Sonoplastia, edição dos seus vínculos, sem renomeação central nem associação administrativa.

Flags semanais descrevem preferências/declarações. Regras por data/período existentes continuam aplicadas no cálculo real por data, podendo prevalecer sobre a semana exibida na tabela. Limite em branco significa não informado; zero é um limite real. O salvamento não publica automaticamente escala alguma.

## Testes e evidências

**124 testes distintos aprovados, zero falhas ou skips nas execuções finais selecionadas.**

| Conjunto | Casos distintos |
| --- | ---: |
| PostgreSQL 017: 16 de integração e 23 de regressão do Ancionato | 39 |
| Navegador/pacotes: 11 G8.2 e 52 regressões | 63 |
| Node: handlers de autenticação e recuperação | 22 |
| **Total** | **124** |

Os 16 casos SQL do núcleo e a validação visual foram repetidos após os últimos ajustes; repetições não aumentam o total. A tabela final foi verificada com linhas abaixo de 300 px e sem estouro horizontal da página nas cinco larguras.

Resultados finais: `dist/registry-g82/test-results.json`; logs e capturas no mesmo diretório. Distinguem testes PostgreSQL de testes com backend simulado no navegador.

- PostgreSQL 17 exclusivo, `--network none`, banco novo por cenário e descarte ao finalizar. Testes de três departamentos/mesma pessoa, funções distintas, parcialidade, concorrência real, escopo/revogação, RLS, nomes, versões, conciliação histórica e conflitos por ID.
- Regressão do Ancionato sobre 017: rascunhos, publicação, modalidades independentes, concorrência, exceções e versões.
- Chromium: tabela, múltiplos vínculos, disponibilidade pendente, confirmação de função/participação, falha de conexão, rascunho de cadastro, saída com alterações pendentes, associação de fonte, Organograma e conflitos cruzados antes de sugerir.
- Regressões G7, Agenda, Organograma, Cronoanálise, precisão dos horários, persistência de execução e pacotes/hashes; handlers Auth/recuperação em Node.
- Larguras 360,390,768,1024,1440; tabela com rolagem localizada. Isso não comprova Safari/Firefox nem aparelhos físicos Android/iPhone.

A suíte histórica completa não é declarada como reexecutada. Tentativas iniciais/repetições não são somadas como novos testes. Foram corrigidos durante os testes: reconhecimento de alterações digitadas antes do blur, preservação dos formulários em falha, restrição do novo origin, permissão da projeção pública e tratamento de nome de exibição.

## Arquivos desta etapa

- Banco: `database/017_central_registry_integration.sql`, `database/check_central_registry.sql`.
- Interface/integração: `frontend/schedule-foundation.js`, `frontend/schedule-management.js`, `frontend/organization.js`, `frontend/agenda.js`, `frontend/portal-access.js`, `frontend/auth.js`, `frontend/config.js`, `frontend/styles.css`.
- Pacote/prévia: `scripts/build_homologation.py`, `scripts/export_preview.py`, `tests/fixtures/registry-integration-preview.js`.
- Testes: `tests/test_registry_integration_sql.py`, `tests/test_registry_integration_browser.py`.
- Relatório e artefatos: este documento e `dist/registry-g82/`.

O checkout já possuía alterações acumuladas anteriores. Essa lista identifica o trabalho G8.2, não todos os arquivos do git status. As migrações forward 001–016 não são reescritas por esta etapa.

## Ativação futura e rollback

1. Conciliar a ausência da G8.1 e comparar eventuais SQLs externos antes de aplicar 017. Confirmar migrações efetivamente instaladas; não reaplicar etapas antigas por suposição.
2. Backup administrativo consistente do banco e pacote publicado completo, testado em destino isolado. Preservar UUIDs, autorizações, arquivos e escritas posteriores ao snapshot.
3. Após autorização, aplicar somente migrações ausentes, em ordem 001 → … → 016 → 017. Nenhuma foi aplicada nesta entrega.
4. Executar checks de 011–017, incluindo `check_central_registry.sql`, como leitura de metadados. Homologar Auth/Edge/RLS reais com contas descartáveis, conforme checklist G7. Código/fixtures não comprovam configuração do provedor.
5. Ativar `centralRegistryEnabled:true` somente com as dependências de portal/G1–G4 ativas e a 017 verificada. A flag permanece **false** no arquivo operacional; o gerador valida o tipo e a dependência do portal. Planejar atualização de cache/pacote para clientes usarem a política nova de sugestões.
6. Revisar associações humanas, departamentos, funções e declarações de disponibilidade. Não assumir que o nome semelhante identifica a mesma pessoa. Disponibilidades antigas já declaradas no banco são preservadas; sua origem deve ser conferida durante homologação se houver dúvida sobre padrões inferidos no passado.

Rollback preferencial: retornar ao pacote anterior validado, manter banco e dados novos, desativar a nova interface por configuração revisada e suspender operação incompatível até revisão. Não remover a tabela de associações nem colunas com dados. Reversão estrutural exige backup testado e autorização própria; downs 005/006/008/015 continuam sujeitos às guardas da G7. Não há down destrutivo automático da 017.

Pendências: implantação real das migrações ainda não autorizada; G8.1 externa não disponível para comparação; Auth/Edge/SMTP/recuperação e RLS no provedor continuam sem homologação real. Ressalvas G6 sobre limite consecutivo/quantidade desejada e carga da própria publicação anterior não são resolvidas por esta integração.

Commit sugerido, não executado: `feat: integra cadastro central aos ministérios e escalas`.
