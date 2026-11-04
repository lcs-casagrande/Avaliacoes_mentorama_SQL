# IASDPI — Navegação e organização dos módulos

## Diagnóstico e inventário

A leitura do código identificou 29 rotas e 22 links no cabeçalho. As capturas anteriores confirmam cabeçalho com várias linhas, duas barras de departamentos na montagem e entradas sobrepostas para Agenda e Calendário. O inventário dos hashes, links anteriores e controles literais/dinâmicos está em [portal-navigation-inventory.json](portal-navigation-inventory.json). Esse levantamento do código não equivale à execução de todas as combinações de formulários.

Não são duplicidades funcionais: Histórico de cultos, versões das escalas, auditoria cadastral, arquivos imutáveis, backup protegido e Lixeira. Todos foram preservados. Os formulários avançados de pessoas e vínculos utilizam as mesmas entidades do Cadastro Geral; não houve cópia de tabelas ou de participantes.

## Mapa implantado na demonstração

| Área | Rotas preservadas | Organização |
| --- | --- | --- |
| Início | `church-home` | Calendário em destaque, ministérios e próximas programações. Ferramentas de gestão aparecem somente com acesso validado. |
| Calendário | `schedule-calendar`, `agendas` | Uma entrada principal. Na candidata com privacidade, ambos os hashes mostram o calendário unificado. Filtros, eventos, escalas e detalhes existentes foram preservados. |
| Escalas | `schedule-build` | Uma única barra de departamentos autorizados. Montagem mensal, equipes de Música, Ancionato semanal/mensal, rodízio, conflitos, salvar e publicar. |
| Eventos | `events` | Gestão e publicação; a consulta acontece no calendário geral. |
| Organograma | `organization` | Consulta pública. Edição de pessoas, liderança e vínculos no Cadastro Geral autorizado. |
| Cronoanálise | `home`, `programs`, `actuals`, `tracking`, `history`, `edit`, `plan-edit`, `summary` | Navegação contextual própria: Visão geral, Programações, Registrar culto, Acompanhar e Histórico. Preserva o login, as permissões, os rascunhos e os fluxos existentes. |
| Administração — equipes | `schedule-members`, `schedule-setup` | Cadastro Geral e Departamentos e funções. O cadastro avançado abre inicialmente em Departamentos, mantendo suas demais abas e formulários. |
| Administração — governança | `schedule-settings`, `access-admin`, `users`, `access-request` | Configurações, acessos e solicitações. Usuários da Cronoanálise permanece disponível no fluxo legado quando a governança integrada está desativada. |
| Administração — registros | `models`, `history`, `archive`, `trash` | Modelos, Histórico, Arquivos e backups, Lixeira. As autorizações próprias da Cronoanálise continuam obrigatórias. |
| Autenticação e recuperação | `portal-login`, `login`, `invite`, `forgot-password`, `reset-password`, `controlled-reset` | Rotas mantidas; não há uma nova autenticação ou resolução pública de apelidos. |

Visitante: **Início · Calendário · Organograma · Entrar**. Administrador: **Início · Calendário · Escalas · Eventos · Organograma · Cronoanálise · Administração**. A área discreta de conta reúne a identificação do perfil validado, igreja e Sair. No celular, Menu expande a navegação; Administração utiliza um agrupamento nativo acessível por teclado. Escape fecha o agrupamento e devolve o foco.

A barra global de “Meus departamentos” foi retirada. O seletor contextual existente na montagem é a única seleção de departamento nessa página; a escolha e o rascunho são mantidos ao navegar. O seletor de igreja permanece quando há mais de uma igreja autorizada. Não foram criadas igrejas ou alterados seus acessos.

## Dados e permissões

Esta publicação inclui também os ajustes locais anteriormente revisados: opções de pessoas curtas, Sonoplastia visível e a equipe de Música com Alexandre e os 12 participantes informados. Identidades confirmadas são reutilizadas no Cadastro Geral, sem presumir habilitação musical ou disponibilidade. As 15 referências de Sonoplastia, cinco de Comunicação e o Ancionato permanecem preservados.

Nenhuma alteração em SQL, esquema, Auth, RLS, RPCs, Edge Functions ou registros reais. Ocultar/agrupar menus não concede permissões: guardas, validações de identidade, conflitos e controle de versões continuam nos serviços existentes. Uma sessão ministerial administrativa não se transforma automaticamente em autorização da Cronoanálise.

A demonstração usa contas fictícias, dados editáveis em memória e CSP que bloqueia conexões externas. O aviso de homologação e reinício ao recarregar permanece visível. Não há autenticação real nem persistência compartilhada nessa página estática.

## Verificações e capturas

Os testes novos utilizam Chromium local e interação com os controles: visitante, administrador, cinco módulos, autorização própria da Cronoanálise, menus agrupados, logout, seleção única de departamento, rascunho pendente, salvar/reabrir, hashes antigos, recarregamento, Voltar/Avançar, teclado e cinco larguras (360, 390, 768, 1024, 1440). A regressão inclui eventos, calendário, permissões simuladas, conflitos, Cadastro Geral e Cronoanálise. Resultado: **192 testes distintos aprovados** (170 Python/Chromium e 22 Node), sem falhas, erros ou casos pulados nos resultados finais selecionados. Inclui 24 testes de funcionalidades no pacote estático e oito testes da navegação no pacote final; repetições não foram somadas novamente. Evidências e identificação dos casos estão em [portal-navigation-tests.json](portal-navigation-tests.json).

Não são testes em Supabase real, contas reais, Safari, Firefox ou dispositivos físicos Android/iPhone. Nenhum teste PostgreSQL foi repetido para essa reorganização visual; as migrações não foram alteradas.

| Visão | Desktop | Celular |
| --- | --- | --- |
| Pública | [Captura](assets/portal-navigation/public-desktop.png) | [Captura](assets/portal-navigation/public-mobile.png) |
| Administrador | [Captura](assets/portal-navigation/admin-desktop.png) | [Captura](assets/portal-navigation/admin-mobile.png) |

## Homologação e rollback

1. Abra `/integrada/#church-home` e consulte Calendário e Organograma sem login.
2. Entre com a conta fictícia administrativa indicada no aviso/roteiro. Abra os módulos e Administração; confira a área de conta.
3. Em Escalas, selecione Sonoplastia, altere uma escolha e tente navegar: cancelar a saída deve preservar o rascunho. Salve e volte à página para reabrir a mesma escala.
4. Confira Música com seleção múltipla e Ancionato nas duas modalidades. Publicar continua separado de salvar.
5. Abra Cronoanálise e confirme sua autorização própria. Programações, registro, acompanhamento, resumo e histórico continuam no módulo existente.
6. Em 390 px, abra Menu; teste os links, Administração, Escape e Sair. Após sair, as ferramentas de edição desaparecem e o calendário permanece público conforme as regras anteriores.
7. Recarregue: a demonstração reinicia suas alterações. Não utilizar para operação real.

Publicação limitada à branch `feat/schedule-management-b1` e aos três arquivos estáticos de `/integrada/` no repositório de homologação. Demais demonstrações e a página principal são preservadas byte a byte. Rollback: restaurar esses três arquivos a partir do commit anterior da homologação (`63431f7a9a202e436f55dcd34de44b8c66406348`), criar novo commit e deixar o Pages republicar. Isso não restaura/reescreve dados no Supabase. Nenhum merge em main oficial ou deploy de produção foi autorizado ou executado.

A consulta direta ao domínio github.io é limitada pela política de rede deste ambiente. A entrega verifica os bytes publicados pela API do GitHub, HTTPS obrigatório e o resultado do build/deploy do Pages; não declara teste interativo remoto em dispositivos reais.
