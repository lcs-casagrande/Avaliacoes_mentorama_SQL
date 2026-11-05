# IASDPI — G10.3: governança, login e auditoria

Preparação local na branch `feat/schedule-management-b1`, baseada no commit `f7922c281d53a33a103f2510728fa02cdb69d58c`. Não houve SQL no Supabase, criação de contas reais, alteração de configuração real, commit, push, merge ou publicação. A homologação publicada continua na política 025; a regra nova só passa a valer após implantação autorizada.

## Continuidade da G10.2

A execução anterior da G10.2 foi informada pelo usuário e não foi repetida. Foi reutilizado somente o resumo disponível: marcadores 001–004, 12 tabelas, 22 funções, RLS ativa, sem executor e sem ledger. O relatório completo não está disponível neste checkout. **Suas conclusões não foram validadas neste ambiente.** Conforme a orientação mais recente, sua localização não bloqueia a continuidade local da G10.3 e não será exigida nova auditoria. As dependências indispensáveis à implantação estão registradas abaixo, sem presumir aprovação ou compatibilidade remota.

A branch remota de desenvolvimento permanece no mesmo commit local. As migrações 001–025 e as fontes históricas foram preservadas; a única migração adicional preparada é a **026**.

## Matriz de permissões

| Ação | Público | Membro comum | Líder confirmado | Ancião confirmado | Administrador |
| --- | --- | --- | --- | --- | --- |
| Abrir Calendário/Organograma | Sim, sem conta | Sim | Sim | Sim | Sim |
| Consultar dados publicados | Conforme visibilidade pública | Conforme autorização | Departamentos autorizados | Departamentos autorizados | Sua igreja |
| Criar/editar/publicar escala departamental | Não | Só concessão administrativa explícita | Próprio departamento | Ministérios vinculados e confirmados | Sua igreja |
| Criar/editar/publicar evento departamental | Não | Só concessão administrativa explícita | Próprio departamento | Ministérios vinculados e confirmados | Sua igreja |
| Submeter evento geral | Não | Conforme concessão aplicável, sem publicação automática | Sim, aguardando aprovação | Sim | Sim |
| Aprovar/publicar evento geral | Não | Não | Não, salvo autorização independente de ancião | Sim, com aprovação geral explicitamente autorizada | Sim |
| Editar outro departamento apenas porque pode aprovar evento geral | Não | Não | Não | Não | Sim, dentro de sua igreja |
| Criar/provisionar conta e conceder/alterar/revogar/suspender acesso | Não | Não | Não | Não | Sim, por fluxo seguro |
| Tratar recuperação supervisionada | Pode solicitar | Pode solicitar | Pode solicitar | Pode solicitar | Trata após verificar identidade |
| Alterar a própria senha | Não | Sessão individual autorizada | Sim | Sim | Sim |
| Consultar auditoria administrativa | Não | Não | Não | Não | Sim, somente sua igreja |
| Acessar Cronoanálise | Não | Permissão própria do core | Permissão própria do core | Permissão própria do core | Conforme autorização existente |

A visibilidade pública anterior foi mantida: eventos publicados não restritos e Ancionato; outras escalas exigem login/autorização. Rascunhos não se tornam públicos. Nenhuma conta de visitante é necessária.

Ser responsável, participante, habilitado ou usuário autenticado são condições distintas. O nome no Organograma prepara uma candidatura, não executa concessão. Somente o administrador confirma a responsabilidade e a identidade individual. A confirmação não habilita o voluntário para funções nem confirma disponibilidade.

## Migração incremental 026

Arquivo: `database/026_governance_responsibilities.sql`. Requer cadeia 001–025 compatível; recusa reexecução. Não instala automaticamente as etapas anteriores.

- Reutiliza `schedule_department_access`: acrescenta origem da responsabilidade, referência ao vínculo central, confirmação administrativa e capacidade explícita de aprovação geral. A FK por igreja requer uma chave única `(church_id,id)` em `schedule_memberships`; nenhuma tabela paralela de pessoas/ACL foi criada.
- `iasdpi_responsibility_access_save` é exclusiva do administrador. Confere pessoa ativa, conta Auth associada, vínculo ativo, departamento e versão. Para líder exige responsabilidade ministerial no cadastro; para ancião de outros ministérios exige primeiro confirmação ativa no Ancionato. Aprovação geral só pode ser atribuída no vínculo de Ancionato.
- Responsabilidades são revalidadas a cada uso. Desativar o vínculo, trocar o usuário da pessoa ou revogar o vínculo de Ancionato impede o uso indevido das concessões derivadas. Demais vínculos da pessoa são preservados.
- Delegações antigas de `access`/`requests` permanecem no histórico, mas não autorizam líderes a gerir acessos. As RPCs de concessão, catálogo de acessos, auditoria e recuperação supervisionada passam a exigir administrador.
- Não concede `iasdpi_access.role='leader'` aos novos gestores ministeriais. Isso evitaria dar, indevidamente, acesso geral à Cronoanálise.
- Evento com `program_category='general'` submetido por líder sem capacidade de aprovação fica `draft/pending`, inclusive quando o organizador é departamental. Categoria editorial e departamento de autorização continuam independentes.
- `iasdpi_event_approve` aprova e publica a versão conferida, sem receber alterações arbitrárias do conteúdo. Revalida igreja, sessão, capacidade, versão e reservas exclusivas sob bloqueio transacional. Retry é idempotente; duas aprovações concorrentes não publicam duas versões.
- Rascunhos gerais, histórico por registro, definições de séries e títulos de revisões privadas não ficam acessíveis a outro líder pelo conhecimento de um UUID. O aprovador recebe o pedido pendente; aprovação não concede edição do conteúdo de outro responsável.
- Em recorrência, o pedido preserva as ocorrências e a aprovação é **por ocorrência**. Não foi criado outro calendário ou outro modelo de eventos. Revisão não aprovada preserva a publicação anterior, respeitando Restrito.
- Administrador/ancião com aprovação geral podem publicar eventos gerais dentro da autorização pertinente. Aprovar evento geral de outro departamento não concede edição de escalas/eventos departamentais desse ministério.

O verificador `database/check_governance_responsibilities.sql` confere funções, privilégios e a barreira de credencial. Deve ser usado somente em etapa autorizada após a 026; não faz parte do inventário G10.1.

## Fluxo de criação de contas — não executado

1. Administrador consulta `iasdpi_responsibility_account_plan()`. O plano usa pessoas/vínculos persistidos no Cadastro Geral: uma linha por pessoa, vários departamentos, UUID Auth existente quando associado e sugestão individual no padrão `nome-sobrenome.iasdpi`.
2. Conferir identidade e responsabilidades no Organograma. Pessoas somente participantes não recebem acesso. Para anciãos sem responsabilidade ainda conciliada, confirmar o papel primeiro; histórico de escala sozinho não comprova autorização. Não inferir equivalências de nomes.
3. Se houver `auth_user_id`, reutilizar a conta individual. Se faltar, o administrador provisiona uma conta pelo procedimento confiável Supabase Admin API/painel autorizado; não pelo navegador público. O endereço individual institucional/técnico depende de domínio confirmado, nunca de e-mail fictício ou senha coletiva.
4. Gerar uma credencial provisória diferente por conta, somente no servidor/procedimento autorizado. `credentials.mjs` prepara um gerador CSPRNG de 24 bytes (192 bits), com classes de caracteres e sem usar o apelido como senha. A biblioteca não cria contas nem é empacotada no frontend; nesta etapa só foi chamada com dados sintéticos de teste.
5. Associar o UUID Auth à pessoa existente pelo editor administrativo/RPC `iasdpi_schedule_save` já disponível. Não cadastrar a mesma pessoa de novo. Conferir sugestões de apelido: colisão com conta existente ou outro nome exige revisão; não substituir o vínculo silenciosamente.
6. Confirmar os vínculos com `iasdpi_responsibility_access_save`, uma operação por departamento, respeitando versões. No Ancionato, autorização para aprovação geral é explícita. Concessões adicionais ao membro comum continuam exclusivamente administrativas.
7. Vincular os apelidos pela RPC G2 existente e marcar `iasdpi_require_password_change` **antes de entregar a credencial**. A troca obrigatória é habilitada só para a identidade escolhida; contas/sessões existentes não são marcadas pela instalação da migração.
8. Entregar a credencial provisória individual por canal privado previamente combinado; não publicar em chat, SQL, auditoria, HTML ou planilha compartilhada. Nunca reaproveitar credencial de líder anterior.
9. Primeiro login redireciona para definir senha. RPCs e leituras REST do negócio ficam bloqueadas até a confirmação pelo servidor. A Edge verifica o usuário real, recusa senha igual ao apelido e envia a senha somente ao Auth. O banco recebe apenas UUIDs/metadados de controle.
10. A Edge bloqueia sessões anteriores, altera a senha no Auth, solicita logout global e confirma a conclusão no banco. Só então libera o bloqueio. A pessoa aguarda dois segundos e entra novamente. Falha parcial não anuncia sucesso nem libera acesso.

A criação efetiva de contas continua sendo uma ação administrativa autorizada fora do frontend público. Não foi criado endpoint de autocadastro/provisionamento público. **Na implantação será obrigatório desabilitar novas inscrições públicas no Auth**; a verificação no frontend não substitui essa configuração do provedor. Revisar convites pendentes sem revogá-los automaticamente.

## Alteração e recuperação de senha

- A pessoa autenticada usa **Alterar senha**, na área da conta. A nova ação `change_password` reutiliza `access-assistance`; não aceita UUID alvo enviado pelo cliente.
- Recuperação por e-mail permanece disponível; com a política G10.3 ativa, a conclusão usa a mesma operação segura para sincronizar o bloqueio de primeiro acesso e a revogação de sessões.
- Recuperação sem e-mail pessoal reutiliza a fila G3, verificação administrativa e link de uso único. Anciãos e líderes não podem emitir redefinições supervisionadas. O último administrador não é removido; recuperação própria indisponível exige o procedimento confiável do operador ou outro administrador autorizado.
- `identity_epochs` recebe somente `must_change_password`, sem senha/hash de senha próprio. A migração não marca contas atuais. Se a alteração no provedor ou logout falhar, o acesso da identidade continua bloqueado para revisão.

## Auditoria

A consulta existente `iasdpi_governance_history(offset)` passa a exigir administrador. Reutiliza `iasdpi_admin_private.audit` e os históricos de Eventos, Escalas, Ancionato e Cadastro Geral. Não foi criada tabela paralela de auditoria.

Retorna responsável, data/hora, ação, entidade/registro, versão e projeções anteriores/novas quando disponíveis. Inclui pedidos de aprovação, aprovação/publicação, cancelamento, concessão/revogação/suspensão de acessos e eventos de troca de senha. As alterações do Cadastro Geral apresentam os campos alterados; os valores privados não são incluídos.

As projeções são explícitas: não retornam senhas, tokens, e-mails técnicos, contatos, descrições livres, documentos de culto ou justificativas privadas arbitrárias. O painel administrativo mostra registro e alterações com conteúdo escapado. A consulta não substitui logs do provedor nem audita comandos manuais externos feitos por operadores; esses precisam do controle administrativo do Supabase.

## Plano de implantação e retorno

1. Usar o resumo disponível da **G10.2** como contexto, sem tratá-lo como prova de compatibilidade. Antes de qualquer implantação autorizada, obter a confirmação técnica do delta exato 005–025 e de sua compatibilidade com o core existente; essa dependência permanece pendente. Não repetir a auditoria nem condicionar o desenvolvimento à localização de um arquivo específico.
2. Confirmar, antes da implantação, o plano de backup/recuperação e os critérios de preservação da Cronoanálise. Esses itens não foram verificados aqui e não são considerados aprovados pela simples referência à G10.2. Os ensaios locais acrescentam capacidades antigas, múltiplos vínculos, aliases, aprovações pendentes e metadados globais de sessão.
3. Instalar somente o delta 005–025 aprovado para o estado real; depois, a 026 revisada, uma transação por etapa. Parar no primeiro erro, sem reaplicar arquivos antigos. Não implantar durante redefinições em processamento sem tratamento explícito.
4. Executar o check 026 e os fluxos de segurança em ambiente controlado autorizado. Não usar testes de gravação contra cultos reais.
5. Implantar a versão revisada da Edge `access-assistance`, conferir CORS/segredos já previstos e Auth/SMTP/redirects. Não trocar peppers ou chaves para “fazer funcionar”. Login por apelido continua sendo G2/Supabase Auth.
6. Preparar o frontend conectado **sem fixtures**, com `responsibilityGovernanceEnabled=true` e as dependências G1–G4/Cadastro Geral/Eventos/privacidade coerentes. A flag permanece ausente/desligada na configuração atual. O gerador de HML continua recusando os projetos de produção; seu uso no IASD_Parada requer um caminho de implantação expressamente autorizado e tecnicamente confirmado, sem presumir aprovação da G10.2 nem remover a proteção.
7. Testar JWTs reais, recuperação, login existente, sessão/renovação, permissões, Publicar/Enviar para aprovação, concorrência, calendário e Cronoanálise antes de liberar o acesso.
8. Só depois da autorização de contas: conciliar os responsáveis confirmados no Cadastro Geral, provisionar/vincular identidades e entregar credenciais individuais. A instalação estrutural não importa automaticamente pessoas da demonstração ou da Agenda.

Não há down automático seguro da 026 após uso. Foram preservadas implementações privadas anteriores para diagnóstico; restaurá-las isoladamente não reverte metadados, políticas ou decisões novas. Retorno exige backup em destino separado, revisão dos deltas de cultos/ACL/históricos/sessões e procedimento coordenado. Não apagar auditoria ou restaurar por cima da Cronoanálise em uso; não desativar a tela de troca de senha enquanto houver contas aguardando conclusão.

## Testes e limites

Resultado consolidado: `governance-g10-3-validation.json`. PostgreSQL 17 descartável, sem rede/portas, Auth sintético; Chromium local e handlers em Node. São testes de preparação/regras, não homologação do provedor real nem prova da G10.2 real.

Os testes cobrem líder, ancião autorizado/não autorizado, administrador, membro, visitante, múltiplos departamentos, associação ao Auth sem novo cadastro, colisão de alias, revogação, aprovação concorrente, reserva exclusiva, versões, rascunhos, publicação, auditoria privada, troca obrigatória/voluntária de senha e compatibilidade da Cronoanálise.

Pendências para ativação: confirmação técnica do delta de instalação e da preservação do core, backup/recuperação, configurações reais de Auth/Edge, domínio institucional e canal privado de entrega, confirmação individual das responsabilidades, teste de JWTs/GoTrue/SMTP em ambiente autorizado e aprovação específica da implantação. Não foram testados Safari/Firefox nem aparelhos físicos nesta execução.

## Dependências indispensáveis para a implantação, sem bloquear o desenvolvimento

| Pendência | Informação indispensável | Situação nesta execução |
| --- | --- | --- |
| Delta de instalação | Quais etapas 005–025 são necessárias e se as definições/owners/RLS/grants reais de 001–004 atendem aos pré-requisitos | Não validado aqui; resumo recebido não comprova equivalência |
| Preservação da Cronoanálise | Compatibilidade das alterações de igreja, chaves, RPCs, permissões e sessões com o core em uso | Testes locais aprovados; compatibilidade remota não presumida |
| Recuperação | Backup/restauração, ponto de corte e tratamento de gravações posteriores | Não confirmado neste ambiente |
| Configuração e autorização | Auth/Edge/frontend reais e autorização específica da implantação | Nenhuma configuração ou instalação executada |

Essas confirmações podem ser reaproveitadas da execução anterior ou fornecidas pelo responsável técnico; não exigem localizar um nome de arquivo específico nem refazer a auditoria. Até sua confirmação e autorização, a 026 é uma preparação local. As regras de governança e os testes da G10.3 continuam utilizáveis para revisão.
