# Preparação multi-igreja — IASDPI

## Escopo e evidência da inspeção

Branch `feat/schedule-management-b1`. Inspeção das migrações 001–010, Auth, RPCs, persistência operacional, backups, permissões ministeriais, gerador de pacotes e backend SQLite. Não foi feita consulta autenticada ao projeto Supabase remoto: as conclusões sobre schema e RLS vêm dos arquivos versionados e dos testes em PostgreSQL descartável. As migrações instaladas em produção precisam ser conferidas pelo operador. Nenhuma conta real foi usada.

A versão atual usa Supabase Auth com um cliente, PKCE, `persistSession` e renovação automática. O JWT identifica uma conta global; `iasdpi_access` concede os papéis reais `admin` e `leader`. As escalas reutilizam participantes separados das contas Auth, vínculos, habilitações e ACLs ministeriais `manager`/`viewer`. Ser responsável no Organograma não concede acesso. Não foi criado papel fictício `user`.

Antes da 011, o banco não tinha cadastro de igrejas ou chave de igreja. As tabelas operacionais são compartilhadas pela única igreja e as RPCs SECURITY DEFINER, inclusive helpers privados, pertenciam a postgres. Acrescentar apenas filtros no JavaScript ou políticas RLS sem mudar essa execução não isolaria as chamadas privilegiadas.

## Implementação preparada

`database/011_church_isolation.sql` é uma única transação, com validação dos pré-requisitos e bloqueio das tabelas durante a mudança.

- Cria `iasdpi_churches` e **somente IASD Parada Inglesa**, código único `IASD_PI`, UUID estável `1a5d0000-0000-4000-8000-000000000001`, ativa e liberada para a lista pública. A aplicação não recebe permissão de criar, ativar ou editar igrejas.
- Acrescenta `church_id` obrigatório às tabelas existentes, atribuindo-as à IASD_PI sem alterar IDs ou conteúdos. Com 001–010 completas, são 29 tabelas existentes; com apenas 001–004, são 12. Nenhum cadastro de pessoa/departamento é duplicado.
- Escopa autorizações, modelos, controles de concorrência, configurações, recibos, revisões, chaves lógicas, origens externas e deduplicação pela igreja. IDs operacionais existentes continuam estáveis e globalmente únicos. A unicidade de arquivo continua sendo autor + digest, agora também por igreja; UPDATE/DELETE de arquivos continuam indisponíveis aos clientes.
- Acrescenta FKs compostas com igreja a todos os relacionamentos entre as tabelas desse inventário. Uma pessoa ou evento de outra igreja não pode ser vinculado, nem por um INSERT privilegiado que ignore RLS. Contas `auth.users` são globais por projeto e podem ser autorizadas em mais de uma igreja; participantes e permissões continuam separados por igreja.
- Adiciona uma política **restritiva** de igreja, preservando as políticas existentes de acesso e Lixeira. Mantém bloqueios de escrita direta e de execução dos helpers privados.
- As implementações antigas e atuais, helpers e gatilhos passam a pertencer ao papel `iasdpi_church_executor`: **NOLOGIN, NOBYPASSRLS, NOSUPERUSER**, sem CREATE, sem membros clientes e sem ser proprietário das tabelas. Assim, também as consultas internas aplicam RLS. O papel só tem acesso de tabela necessário para os códigos existentes; os clientes continuam limitados às permissões/RPCs anteriores.
- Uma ponte privada de Auth projeta exclusivamente ID, e-mail, confirmação e indicador anônimo, com proprietário postgres. Evita depender de alterações nas políticas gerenciadas de `auth.users`. Não inclui senha, token ou metadado de papel e não é acessível a anon/authenticated. Nenhuma função de mutação operacional continua executando como postgres.
- O contexto vem de `x-iasdpi-church`, validado contra o cadastro ativo/liberado. Esse cabeçalho é **seleção, não autorização**: as políticas e RPCs continuam verificando a conta, seu papel e seu escopo. Cabeçalho inexistente usa somente IASD_PI para compatibilidade com o frontend anterior; código inválido/inativo/não liberado falha, sem fallback silencioso.
- Igreja de um registro é imutável por edição comum. A migração compara quantidade e checksum de todas as linhas antes/depois, excluindo somente a nova coluna, e cancela a transação se houver diferença.
- Igrejas futuras cadastradas pelo operador recebem, na mesma transação, uma linha de controle de concorrência e, se instalado, configuração inicial de escalas. Não ganham pessoas, modelos, líderes nem administrador automaticamente.

### Seletor e frontend

`frontend/churches.js` consulta `iasdpi_list_churches` antes de apresentar o formulário de login. A RPC publica somente ID, código e nome de igrejas ativas e com `listed=true`. Antes de autenticar não é possível conhecer os vínculos de uma pessoa; `listed` significa **liberação do cadastro para seleção pública**, não autorização do usuário. Só o servidor decide o acesso após o login.

Estados explícitos de carregamento, lista vazia, erro e nova tentativa. Não há lista fictícia de igrejas nem fallback quando a consulta falha. Trocar igreja faz logout local e recarrega a página, evitando reaproveitar dados em memória. A sessão autorizada e verificações de respostas também são vinculadas ao contexto de igreja.

O fluxo está preparado atrás de `churchIsolationEnabled: false` em `frontend/config.js`. **Ainda não foi ativado**, porque a migração não foi autorizada/executada no destino. Com a flag false, login e armazenamento existentes continuam funcionando. Após a ativação, todas as requisições REST e de arquivo levam o contexto; Auth continua com um único cliente e seus mecanismos atuais.

As chaves de localStorage, rascunhos e fila de recuperação da IASD_PI são preservadas. Igrejas futuras usam namespaces separados; a seleção guarda apenas código público em sessionStorage, nunca senha/token. A sessão Auth permanece sob gestão do SDK. Backups locais não são importados em outra igreja por engano.

Agenda e Organograma não tiveram seus conteúdos alterados. As fontes públicas em arquivos continuam sendo da IASD_PI; se outra igreja vier a ser ativada, o frontend mostra conteúdo público não configurado em vez de apresentar a agenda ou o organograma da Parada Inglesa sob outra identidade. O calendário público de homologação continua independente e não conecta à produção. Os períodos de anciãos simulados da prévia não se tornam operacionais por esta migração.

O backend Python/SQLite legado continua atendendo **somente IASD_PI** e nega qualquer outro código antes de consultar dados. O backend multi-igreja desta preparação é o PostgreSQL/Supabase com suas RPCs e RLS. Não foi convertido nem exposto um SQLite compartilhado entre igrejas.

### Pacotes e rollback

Manifesto versão 4 torna `churches.js` obrigatório, preservando hashes/SRI. O validador continua aceitando pacotes anteriores válidos de versões 1, 2 e 3, inclusive para rollback. Nenhum pacote anteriormente homologado foi reescrito.

## Ordem de homologação e ativação (não executada)

1. Conferir o estado real com `database/check_church_migration_readiness.sql`, somente leitura. Verificar o resultado de cada linha e o histórico das migrações aplicadas. Exportar snapshot/backup do banco pelo mecanismo administrativo existente antes de mudança estrutural.
2. A 011 exige **001, 002, 003 e 004 já instaladas**; não repetir essas migrações. Se as tabelas de Escalas existirem, exige **005, 006, 007, 008, 009 e 010 completas**, nessa ordem. Instalação parcial de Escalas é recusada. **A entrega não autoriza instalar automaticamente 005–010 em produção.** Para usar a gestão operacional, revisar/homologar essas migrações pendentes antes da 011.
3. Em banco descartável ou projeto de homologação, executar `database/011_church_isolation.sql` integralmente, como postgres, em janela de manutenção. Uma falha desfaz a transação. A migração recusa cadastro de igrejas preexistente, instalação repetida, tabelas desconhecidas, proprietários inesperados, papel executor inseguro ou funções UPSERT divergentes.
4. Executar `database/check_church_isolation.sql` como postgres: deve retornar **zero linhas**. Verificar contagens, IDs e conteúdos com o snapshot, além de testar manualmente perfis e revogação. Os diagnósticos antigos que exigem proprietário postgres nas funções não representam a nova arquitetura; usar também o novo verificador.
5. Homologar Auth, recuperação PKCE, permissões de gestão, leitura e edição, backups, Lixeira, indisponibilidade de rede, rascunhos e versões. Confirmar em navegador real se o gateway permite o cabeçalho CORS `x-iasdpi-church`; isso não foi verificado no projeto remoto. A lista pública não deve expor igrejas inativas/não liberadas, nem pessoas/contatos.
6. Somente após revisão e autorização, repetir a migração no destino real e o verificador. Não desativar nem recadastrar o administrador atual: sua linha existente passa a pertencer à IASD_PI.
7. Somente após aprovação separada de publicação, habilitar `churchIsolationEnabled: true`, gerar/validar o pacote e publicar. Não muda Site URL, Redirect URLs, SMTP, template de recuperação ou política de senha do Supabase. Confirmar as URLs existentes no painel como parte da homologação.

**Instalação só do núcleo:** a 011 suporta um destino 001–004 sem Escalas para não forçar a criação de módulos novos. Depois disso, **não instalar as versões antigas 005–010 sem adaptação**, pois criariam tabelas/funções sem o novo escopo. A instalação futura de Escalas exigirá migração já compatível com igreja. Se o destino pretende ativar a gestão de Escalas agora, homologar sua sequência completa antes da 011.

## Primeiro administrador e expansão futura

A conta Auth atual não é recriada. O primeiro administrador existente é preservado por backfill de `iasdpi_access`, com o mesmo `user_id`, `role`, `enabled` e `created_at`. A migração não promove usuários.

Para uma futura igreja real, o operador confiável deverá cadastrar a igreja inicialmente inativa/não listada, verificar a identidade e e-mail confirmado da conta e inserir a autorização `admin` com `church_id` explícito. Só depois liberar o cadastro e ativar o frontend adequado. Esse bootstrap é administrativo e fora do site; um usuário não pode se associar livremente nem se promover. Depois, as RPCs atuais de usuários/convites administram apenas a igreja selecionada, protegendo o último administrador **daquela igreja**. Não foi criada igreja adicional no arquivo de migração.

## Riscos e limites

- **Pendente no remoto:** instalação real das migrações, privilégios do operador para criar papel/alterar proprietários e criar a ponte privada de Auth, comportamento do gateway/CORS e testes com sessões autorizadas reais. Testes locais não comprovam essas configurações do Supabase gerenciado.
- DDL mantém locks e calcula checksums; medir a duração com um snapshot representativo antes da janela de produção. A transação não deve ser fragmentada em execuções parciais.
- Novas funções/tabelas futuras precisam entrar no inventário de isolamento e manter execução sem BYPASSRLS. Não publicar migrações antigas por cima da nova segurança.
- Não há cadastro público de igrejas, seletor de organizações dentro de um culto, nova estrutura de Agenda ou migração do SQLite. Não foi ativada gravação compartilhada da homologação.
- Não foi feita exclusão, restauração ou edição de cultos reais, nem alteração no Auth remoto.

## Rollback

Antes da ativação, manter a flag false e o pacote anterior. Depois da 011, é possível voltar o frontend anterior ou desligar a flag: a ausência de cabeçalho continua restrita à IASD_PI e as RPCs preservam suas assinaturas. Isso mantém as novas colunas e proteções no banco; não remove igrejas ou dados. Não fazer rollback destrutivo de schema nem devolver funções ao bypass de postgres como solução automática. Se houver divergência após a migração, interromper a ativação e investigar com o snapshot administrativo.

## Arquivos desta entrega

- Banco: `011_church_isolation.sql`, `check_church_migration_readiness.sql`, `check_church_isolation.sql`.
- Frontend: novo `churches.js`; integração em `config.js`, `index.html`, `auth.js`, `app.js`, `archive.js`, `storage.js`, `drafts.js`, `operational.js` e `styles.css`.
- Backend legado: `access_control.py` e allowlist estática de `server.py`.
- Empacotamento: `build_homologation.py` e `export_preview.py`.
- Testes: novos `test_church_isolation_sql.py` e `test_church_selection.py`; expectativas de manifesto atualizadas em `test_package_validation.py`, `test_schedule_foundation_package.py` e `test_schedule_management_browser.py`.

Commit sugerido (não realizado): `feat: prepara isolamento por igreja e seleção antes do login`.

## Resultados verificáveis

**274 testes aprovados, sem falhas nas execuções finais:**

| Grupo | Aprovados | Evidência |
|---|---:|---|
| Isolamento em PostgreSQL 17 descartável, sem rede | 16 | `dist/church-isolation/tests-postgresql.log` |
| Seletor, Auth simulado, backend legado, cultos, calendário e pacotes | 139 | `dist/church-isolation/tests-frontend-package.log` |
| Recuperação PKCE, histórico, rascunhos, navegação, conflitos e release | 117 | `dist/church-isolation/tests-auth-drafts-navigation.log` |
| Exigência do módulo e rollback de pacote v3 | 2 | `dist/church-isolation/tests-church-package.log` |

São **25 cenários novos** (16 SQL e nove de seletor/backend/pacotes), além das regressões executadas. Isso não representa executar indiscriminadamente toda a suíte acumulada do projeto. Os testes de SQL criam e removem bancos UUID descartáveis; igrejas auxiliares existem exclusivamente nesses bancos, nunca na migração entregue.

Confirmado em PostgreSQL: backfill sem alteração do JSON, 16 atividades e subatividade preservadas, precisão de microssegundos, admin anterior mantido, dados de outra igreja invisíveis, negação de edição/Lixeira/restauração entre igrejas, FKs compostas, autorização por igreja, último admin, convites independentes, recibos com mesmo request_id em igrejas diferentes, gravação/publicação de escala, atualização parcial, versão antiga recusada, proteção da ponte Auth mesmo com RLS em auth.users, núcleo sem Escalas e recusa transacional de instalação parcial.

No navegador Chromium headless: seletor antes da senha, erro versus lista vazia, nova tentativa, manipulação de opção rejeitada, cabeçalho de igreja nos requests interceptados, nomespaces, teclado e 360/390/768/1024/1440 px. Não equivale a testes em aparelhos físicos, Firefox/Safari ou sessões Supabase reais.

Prévia independente: `dist/church-isolation/IASDPI-selecao-igreja-final.html`. Reutiliza os componentes reais de seleção e formulário, mas intercepta localmente a lista de igrejas e bloqueia qualquer conexão externa. Exibe somente IASD_PI e não autentica nem envia senhas. Fluxo selecionar → formulário → trocar igreja verificado no HTML final, sem erros de execução. Capturas em `selector-mobile.png` e `login-after-selection-mobile.png`.

`dist/church-isolation/result.json` registra hashes SHA-256 das migrações, verificadores e prévia. Nenhum SQL foi executado no Supabase real; não houve commit, push, merge ou publicação.

Na revisão visual final, o texto de carregamento foi corrigido para não permanecer após a lista estar pronta. Os 18 cenários relevantes de seleção, Auth e pacote foram repetidos após esse ajuste, todos aprovados (`tests-selector-final.log`); são revalidações dos cenários contabilizados acima.
