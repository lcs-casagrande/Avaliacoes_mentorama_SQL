# Governança G3 — Gestão de acessos

Implementação local na branch `feat/schedule-management-b1`, sobre G1/G2 e as Escalas existentes. Nenhuma migração, conta, senha, autorização ou registro real foi alterado. Sem commit, merge, push ou publicação. Os sinalizadores G1/G2/G3 continuam desativados no frontend.

## O que foi implementado

- `#access-admin` (e o endereço anterior `#users`): usuários, apelidos, permissões, membros, solicitações e auditoria da igreja selecionada. A rota pode mostrar a tela de entrada; os dados exigem sessão e autorização nas RPCs.
- Administrador geral pode localizar uma conta Auth pelo e-mail exato, inclusive institucional, e conceder somente permissões ministeriais. Localizar a conta não a aprova nem cria um perfil `leader` geral. A pesquisa reutiliza `iasdpi_find_account`.
- Múltiplos departamentos por identidade, com visualização, edição, publicação e administração de membros independentes. As delegações de gestão de acessos e tratamento de solicitações são explícitas e somente o administrador geral pode concedê-las.
- Suspensão/revogação global na igreja e por departamento, sem apagar contas, pessoas, históricos ou apelidos. Reativação não fabrica um perfil geral para uma conta apenas ministerial.
- Vínculo/desvínculo de apelidos reutiliza a G2. Apelidos não concedem privilégios. Trocar o responsável por um apelido não transfere permissões automaticamente: revogue o antigo e autorize o novo explicitamente.
- Membros reutilizam `schedule_people`, `schedule_memberships` e as habilitações existentes. Não há segundo cadastro de pessoas. A página permite consultar e suspender vínculos; inclusão e habilitação continuam nos formulários da Fase A.
- Edição e publicação possuem gates distintos também nas RPCs. Quem apenas publica pode publicar um rascunho completo já salvo, sem enviar alterações de conteúdo. Editores sem publicação não alteram uma escala publicada.
- O acesso ao organograma e agenda públicos permanece independente. Nenhuma atividade ministerial ou nome no organograma é considerado perfil administrativo.

## Modelo e migração

Arquivo: `database/013_access_governance.sql` (transação única, revisão antes da instalação).

Requer PostgreSQL 15+, operador `postgres`, migrações 001–004 e Escalas 005–010 completas, seguidas de G1/011 e G2/012. Não repetir migrações já instaladas. A 013 recusa instalação duplicada e não remove dados.

| Objeto | Finalidade e proteção |
|---|---|
| `schedule_department_access` | Reutilizada; acrescenta seis capacidades e situação active/suspended/revoked, preservando UUIDs, vínculos e versões. Gestores antigos mantêm visualizar/editar/publicar/membros; não recebem delegação de acessos ou atendimento automaticamente. |
| `iasdpi_admin_private.identity_states` | Situação da identidade por igreja, versão e responsável pela alteração. |
| `iasdpi_admin_private.access_requests` | Fila por igreja/departamento, verificação de identidade, decisão, autor, data e versão. Não contém senhas. |
| `iasdpi_admin_private.reset_capabilities` | Hash HMAC de autorização de uso único, expiração, identidade alvo e operador. Nunca guarda o código bruto ou senha. Índice impede duas redefinições simultâneas da mesma identidade. |
| `iasdpi_governance_private.identity_epochs` | Metadado de segurança global da identidade Auth: corte de JWT e bloqueio em redefinição. Não é cadastro de outra igreja. Não é acessível pelo cliente. |
| `iasdpi_admin_private.audit` | Auditoria existente reutilizada para autor, data, ação, alvo e departamento quando aplicável. |

Tabelas são de `postgres`; RPCs e helpers operam como `iasdpi_church_executor` sem LOGIN/BYPASSRLS, com `search_path` vazio. As novas tabelas por igreja possuem RLS de fronteira e chaves compostas quando referenciam departamentos/solicitações. Não se concedem escritas diretas aos clientes.

A exceção explícita de proprietário é `iasdpi_governance_private.has_other_church`, helper privado de `postgres` que retorna apenas um booleano para o executor. Ele detecta que uma credencial Auth pertence a mais de uma igreja; nunca devolve membros ou detalhes de outra igreja. Clientes não possuem USAGE/EXECUTE no schema.

`iasdpi_session_allowed` restringe também as leituras REST operacionais. Os helpers anteriores foram protegidos preservando seus OIDs, inclusive quando referenciados por funções antigas. Locks de controle por igreja e um lock global da identidade Auth serializam alterações. O upsert do metadado global força erro de serialização para snapshots REPEATABLE READ antigos. Isso impede criar vínculos em outra igreja durante uma redefinição em processamento.

O último administrador geral ativo é protegido contra suspensão, revogação e rebaixamento, inclusive concorrentes. Ser ancião, líder ministerial, participante ou usar o apelido `administrador` não satisfaz essa condição. O primeiro administrador continua sendo cadastrado pelo procedimento administrativo existente; não há bootstrap público.

## Matriz de autorização

| Ação | Administrador geral | Delegado ministerial | Pessoa sem delegação / anônimo |
|---|---|---|---|
| Consultar todos os acessos e apelidos da igreja | Sim | Somente identidades dentro do seu alcance; apelidos ficam com o administrador geral | Não |
| Criar/vincular/desvincular apelidos | Sim | Não | Não |
| Conceder capacidades por departamento | Sim | Apenas com `can_manage_access`, na sua área, sem se autoalterar ou conceder capacidades que não possui | Não |
| Delegar gestão de acessos ou atendimento | Sim | Não | Não |
| Suspender/revogar acesso da identidade na igreja | Sim, preservando último admin | Somente o acesso departamental autorizado | Não |
| Administrar membros/habilitações | Sim | Apenas com `can_manage_members` | Não |
| Tratar fila departamental | Sim | Apenas com `can_handle_requests` explícito | Não |
| Enviar solicitação pública | Sim | Sim | Sim, através da Edge com limite de requisições; sem consulta à fila |
| Redefinir credencial | Outro administrador ou delegado cujo alcance cobre toda a identidade alvo | Nunca contas gerais, próprias ou fora do alcance | Somente consumir autorização privada válida e definir nova senha |

Permissões ministeriais não dão acesso à Cronoanálise. O perfil geral `leader` existente continua dando o alcance operacional que já possuía; não é concedido automaticamente pela tela de permissões.

## Recuperação sem e-mail pessoal

1. Na entrada, a pessoa escolhe a igreja e abre **Solicitar acesso ou recuperação**. Informa nome, identificador (ou endereço institucional), departamento e pedido. Não informa senha ou documentos.
2. A Edge registra uma solicitação e retorna a mesma confirmação, independentemente de localizar a identidade. Não expõe uma resolução pública de identificador para e-mail.
3. Identidades desconhecidas, contas gerais e pedidos fora do departamento conhecido vão para a administração geral. Um apelido de outro departamento não permite investigar sua conta por uma fila ministerial.
4. O operador autorizado confirma a identidade por um canal confiável fora do site e registra como verificou. Autoaprovação é bloqueada. Marcar uma solicitação como verificada não concede permissões.
5. Após a verificação, outro operador com alcance suficiente gera um link privado de uso único, válido por 15 minutos. A emissão usa o JWT real do operador e a RPC revalida seu alcance. O link não é uma senha.
6. A pessoa abre o link e define a nova senha. O código é retirado imediatamente do fragmento da URL e mantido só na memória da aba. Atualizar a página exige reabrir o link original enquanto válido. Senha/código não são gravados em localStorage.
7. A Edge reivindica a autorização no banco, bloqueia sessões antigas, usa a recuperação nativa do Supabase Auth (`generate_link`/OTP privado), verifica a identidade retornada e atualiza a senha. O link/OTP nativo e o e-mail técnico nunca chegam ao navegador.
8. A Edge solicita logout global para revogar refresh sessions e conclui a transação administrativa. A aplicação também rejeita JWTs com `iat` anterior ou igual ao corte; isso é necessário porque logout por si só não invalida imediatamente todos os access tokens. Após a confirmação, aguarde dois segundos e faça novo login.

A pessoa continua precisando de uma identidade individual no Supabase Auth com endereço técnico/institucional confirmado, conforme a G2. Ela não precisa fornecer e-mail pessoal nem conhecer o identificador técnico interno. Não são criadas contas reais, senhas coletivas ou senhas próprias em tabelas. Cadastros sem e-mail pessoal são feitos por operador autorizado no procedimento institucional; os convites por e-mail existentes permanecem disponíveis quando aplicáveis.

Não há envio de senha existente ou de senha nova por e-mail. Notificação institucional é opcional e não foi ativada. O fluxo PKCE por e-mail já existente permanece disponível.

### Limites e casos que exigem operador

- Uma credencial Auth é global. Se a identidade estiver vinculada a outra igreja, a redefinição pelo administrador de apenas uma igreja é recusada. Deve ser tratada pelo operador responsável por essa identidade fora deste fluxo, verificando os demais vínculos.
- Um delegado ministerial somente redefine contas exclusivamente ministeriais e cujos vínculos estejam todos no seu alcance. Uma delegação de atendimento não equivale a administração geral.
- O único administrador não pode aprovar a própria recuperação. É necessário o procedimento de recuperação do operador Supabase ou outro administrador previamente autorizado.
- Se o Auth mudar a senha mas a revogação/conclusão falhar, não se anuncia sucesso: a identidade fica bloqueada. Verifique os registros do backend e a situação da solicitação, sem registrar senhas. Rejeitar/concluir uma solicitação ou reativar um acesso não elimina esse bloqueio. Uma execução interrompida ainda em `processing` exige intervenção no backend seguro para encerrar a lease com `iasdpi_access_reset_finish(lease,false)`, após verificar que a operação anterior terminou; depois pode haver nova verificação/emissão. Não limpar epochs ou liberar o bloqueio diretamente para contornar uma falha.
- MFA, políticas reais de senha, CAPTCHA e comportamento do provedor Auth precisam ser homologados com contas descartáveis no projeto de teste. Nenhuma proteção do provedor é desativada pelo código.
- A revogação protege novas operações e limpa a interface ao detectar alteração de autorização; não remove informações que um usuário já tenha visto ou exportado legitimamente.

## Dependências e ativação futura — não executada

1. Revisar o inventário de migrações e permissões do ambiente. Preservar backup do banco e pacote atual. Validar primeiro em homologação.
2. Se ainda pendentes, revisar e aplicar 005–010, 011 e 012 nessa ordem. Só depois revisar/aplicar 013 como `postgres`. Não reinstalar 001/002 nem substituir o administrador existente.
3. Executar `database/check_church_isolation.sql`, `check_alias_login.sql` e `check_access_governance.sql` como postgres. Os verificadores retornam apenas irregularidades; zero linhas não substitui testes autenticados reais.
4. Publicar a Edge **access-assistance**, depois de autorização específica. Seu `verify_jwt=false` permite envio público e consumo do link, mas emissão verifica Auth e autorização de usuário no servidor. Não desativar JWT nas demais funções.
5. Configurar exclusivamente nos secrets da Edge: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` (ou ANON), `IASDPI_GOVERNANCE_PEPPER` aleatório forte (mínimo 32 caracteres), `IASDPI_GOVERNANCE_ORIGINS` com origens HTTPS exatas e `IASDPI_GOVERNANCE_ENABLED=true`. Opcional: `IASDPI_GOVERNANCE_TRUSTED_IP_HEADER` apenas quando um gateway confiável sobrescreve esse cabeçalho; não confiar em X-Forwarded-For fornecido pelo cliente. Confirmar também limites antiabuso do gateway. Nunca colocar esses secrets no frontend, repositório ou chat.
6. G2/alias-login deve estar instalada e configurada conforme `docs/alias-login-g2.md`. O limite transacional da G2 é reutilizado, com HMAC por igreja/ação, além do limite global; não há resolução pública de e-mail.
7. Conferir Site URL/Redirect URLs para recuperação por e-mail, SMTP/template, política de senha, MFA e expiração de sessão. O atendimento controlado não exige SMTP para enviar mensagens: `generate_link` só gera a recuperação no servidor. Não presumir que o provedor está configurado corretamente pelo simples fato de existir código.
8. Homologar com contas descartáveis e as permissões do ambiente real. Somente então habilitar `churchIsolationEnabled`, `aliasLoginEnabled` e `governanceEnabled` no frontend. A CSP do pacote admite apenas o host Supabase configurado. Nenhuma chave administrativa entra no pacote.
9. O pacote gerado passa a manifesto **5** para exigir `governance.js`; pacotes 1–4 continuam válidos e o rollback para v4 foi testado. Pacotes anteriores homologados não foram regravados.

## Homologação sugerida

1. Entrar como administrador e conferir a igreja IASD_PI. Localizar uma conta técnica descartável: confirmar que pesquisar não autoriza. Conceder somente visualizar/editar Sonoplastia; confirmar que não recebe acesso à Cronoanálise.
2. Acrescentar Música à mesma identidade. Conceder publicar separadamente. Confirmar edição e publicação com e sem cada capacidade.
3. Delegar gestão de acessos em Sonoplastia. Confirmar que o delegado não altera Música, não se promove, não altera o administrador e não concede publicação sem possuí-la.
4. Vincular dois apelidos à identidade; trocar um vínculo com motivo. Confirmar que apelidos não transferem papéis. Revogar o acesso do antigo líder e confirmar que perde os dados do módulo.
5. Suspender uma identidade ministerial e reativar: confirmar preservação dos vínculos e ausência de perfil geral criado automaticamente.
6. Tentar remover o último admin; repetir com duas operações simultâneas em contas de teste. Uma autorização geral ativa deve permanecer.
7. Enviar pedidos de acesso e senha sem login. Confirmar resposta genérica, filas por alcance, identidade verificada fora do site, proibição de autoaprovação e expiração/uso único do link.
8. Executar recuperação completa na conta descartável. Confirmar nova senha, bloqueio de tokens antigos e logout dos outros dispositivos. Interromper o provedor em ambiente de teste e verificar bloqueio sem confirmação falsa.
9. Com segunda igreja exclusivamente no banco descartável, confirmar ausência de leitura/concessão cruzada e rejeição de redefinição de identidade compartilhada. A instalação mantém somente IASD_PI ativa.
10. Conferir layouts em 360/390/768/1024/1440 px, teclado, mensagens de erro e reabertura das páginas. Chrome/Chromium foi automatizado; dispositivos físicos, Safari/Firefox e Auth real permanecem pendentes.

## Arquivos desta etapa

Novos: migração/verificador 013/G3; `frontend/governance.js`; `supabase/functions/access-assistance/{index.ts,handler.mjs}`; três arquivos Python de testes G3; `tests/access_assistance_handler.test.mjs`; `tests/fixtures/governance-preview.js`; este relatório.

Integração: `frontend/{config,auth,users,navigation,app,schedule-foundation,schedule-management}.js`, `index.html`, `styles.css`; `supabase/config.toml`; `backend/server.py` (somente permitir servir o JS estático); `scripts/{build_homologation,export_preview}.py`.

Testes anteriores ajustados exclusivamente para a nova versão do manifesto: `test_package_validation.py`, `test_church_selection.py`, `test_schedule_foundation_package.py`, `test_schedule_management_browser.py`. Demais alterações que já estavam na branch, incluindo os Lotes 1–6 e G1/G2, foram preservadas.

## Prévia e evidências

Gerar novamente: `python scripts/export_preview.py --governance-preview --output dist/access-governance/IASDPI-G3-acessos.html`.

A prévia possui dados fictícios em memória, configuração própria, fetch interceptado e CSP bloqueando conexões externas/frames. Não utiliza contas ou banco reais. É uma apresentação, não comprovação do Supabase Auth em produção. A navegação e a simulação de salvamento foram automatizadas pelo teste de prévia.

Capturas: `dist/access-governance/g3-mobile.png` e `g3-desktop.png`. Evidências finais em `dist/access-governance/*evidence.log` e resumo em `test-results.json`.

## Rollback

Manter os três flags desativados impede ativação prematura. Após futura implantação, desligar a Edge (`IASDPI_GOVERNANCE_ENABLED=false`) interrompe novas emissões/consumos; isso não desbloqueia execuções parciais. Desabilitar o flag de interface oculta o módulo, sem apagar filas ou auditoria.

Não fornecer DOWN automático que apague o histórico, retire a RLS ou volte a aceitar sessões revogadas. A transação da migração pode ser revertida antes de COMMIT; depois de utilizada, eventuais correções de banco devem ser feitas por migração aditiva revisada. Rollback do pacote HTML/JS não equivale a rollback de segurança do banco: o formulário antigo de permissões da Fase A é recusado pela 013 e deve continuar substituído pela G3.

Commit sugerido, quando autorizado: `feat: adiciona governança de acessos por igreja e recuperação controlada`.

## Resultado dos testes desta execução

**383 testes aprovados nas suítes selecionadas, incluindo 50 testes novos da G3; nenhum teste falho nos resultados finais.** Não é a execução integral de todos os testes históricos do repositório. As repetições após correções não foram somadas. Três testes de restauração histórica inicialmente ignorados na execução sem PostgreSQL foram executados e aprovados no banco descartável dedicado.

| Grupo | Aprovados | Ambiente e alcance |
|---|---:|---|
| Novos testes SQL G3 | 22 | PostgreSQL 17 em Docker `--network none`; RLS real, grants, operações fictícias, concorrência e compatibilidade aditiva. |
| Novos testes de navegador G3 | 12 | Chromium, Auth/RPC/Edge interceptados, incluindo revogação de catálogo carregado e concessão sem promoção geral. |
| Novo handler Edge G3 | 11 | Node/Web APIs, provedor Auth simulado, falhas fechadas e ausência de resolução pública. |
| Novos testes de pacote/prévia | 5 | Manifesto/SRI, rollback v4, integridade, prévia navegável sem conexões externas. |
| Regressões de interface/dados selecionadas | 235 | Rascunhos, conflitos, navegação, recuperação PKCE, históricos, backups, seleção de igreja, G2 e Fases A/B. |
| Regressões SQL anteriores | 45 | Gestão de usuários, G1, G2 e restauração histórica; somente PostgreSQL descartável. |
| Backend e publicação estática existentes | 42 | Autorização, usuários e comportamento dos pacotes Pages; ambiente local. |
| Handler G2 existente | 11 | Login por apelido, orçamento, enumeração e compatibilidade. |

Foram comprovados no banco descartável: preservação dos 16 itens, subatividade e valores históricos usados como referência; mesmas identidades e autorizações gerais após 013; retenção das capacidades dos gestores anteriores; edição/publicação separadas; proteção do último administrador em concorrência; bloqueio entre igrejas; recusa de snapshots antigos; indisponibilidade de tabelas/helpers privados ao cliente; expiração e uso único da autorização de redefinição. Os três verificadores SQL 011/012/G3 retornaram zero irregularidades nesse ambiente.

**Não comprovado em produção:** execução da Edge no Supabase, credenciais do servidor, comportamento real do Auth/SMTP/MFA, recuperação completa com uma conta descartável real, URLs e permissões efetivamente instaladas. Esses itens continuam dependentes da instalação e homologação autorizadas. Nenhum resultado simulado foi classificado como teste real de produção.
