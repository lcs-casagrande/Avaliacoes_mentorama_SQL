# IASDPI — G11: administração, acessos e auditoria

Branch `feat/schedule-management-b1`. Autenticação, pessoas, vínculos, RLS e permissões anteriores foram reutilizados. O Supabase existente permanece sem alterações. Backup recuperável continua pendente de implantação, sem bloquear desenvolvimento/testes locais.

## Painel navegável

- **Administração → Usuários e Acessos:** tabela pesquisável por pessoa, apelido e ministério, situação, vínculo central e último acesso quando informado pelo Auth. Uma identidade pode ter vários ministérios.
- Criação individual via backend preparado, vínculo de conta Auth existente ao Cadastro Geral, edição dos vínculos/aliases e suspensão/revogação. A edição dos dados pessoais continua no Cadastro Geral, sem segunda base.
- **Ministérios e permissões:** seleção por identidade, permissões independentes de visualizar/editar/publicar/administrar membros, responsabilidade de líder/ancião confirmada no cadastro e aprovação geral explícita no Ancionato. Delegação de acessos para não administradores deixou de ser oferecida na UI final.
- **Responsáveis sem conta:** usa o plano G10.3 e os vínculos confirmados do Organograma; não transforma participantes ou nomes de escalas históricas em líderes.
- **Administração → Auditoria:** rota `#access-audit`, exclusiva do administrador, ações legíveis, ator/data, registro e diferenças relevantes. Sem senhas/tokens/e-mails técnicos. Links e abas antigas continuam compatíveis; ferramentas da Cronoanálise permanecem em área recolhida.
- Eventos gerais podem ser aprovados/publicados ou rejeitados; rejeição mantém rascunho/histórico. Calendário, rodízio, histórico, Ancionato e visual público preservados.

As rotas existentes não foram removidas. O menu novo é ativado por `governanceAdministrationEnabled`, dependente de `responsibilityGovernanceEnabled`. A configuração operacional atual permanece sem a flag. A homologação estática usa exclusivamente simulação em memória, claramente identificada, com alterações que reiniciam ao recarregar e CSP sem conexões externas.

## Matriz final

| Operação | Administrador da igreja | Ancião autorizado | Líder confirmado | Membro | Público |
| --- | --- | --- | --- | --- | --- |
| Contas, aliases, concessões e revogação | Sim, na igreja autorizada | Não | Não | Não | Não |
| Cadastro de pessoas/vínculos | Sim | Só campos/escopos explicitamente concedidos | Só campos/escopos explicitamente concedidos | Só concessão explícita | Sem dados privados |
| Editar/publicar escalas e eventos departamentais | Sim | Ministérios autorizados | Próprios ministérios autorizados | Apenas concessão explícita | Não |
| Enviar evento geral para aprovação | Sim | Conforme responsabilidade confirmada | Sim | Sem concessão automática por participação | Não |
| Aprovar/rejeitar evento geral | Sim | Ancionato explicitamente autorizado | Não | Não | Não |
| Trocar a própria senha | Autenticado | Autenticado | Autenticado | Autenticado | Recuperação autorizada |
| Emitir redefinição supervisionada | Sim, respeitando alcance e identidade verificada | Não | Não | Não | Não |
| Auditoria administrativa | Sim | Não | Não | Não | Não |
| Calendário publicado/Organograma | Sim | Sim | Sim | Sim | Sim, respeitando privacidade vigente |

As demais escalas exigem login/permissão segundo a política existente; o Ancionato e eventos abertos permanecem públicos. Rascunhos e eventos Restritos não são públicos. Papel de ancião não concede administração nem acesso automático à Cronoanálise. As permissões gerais legadas da Cronoanálise mantêm seu mecanismo existente; não são concedidas por criar conta ministerial.

## Migração incremental 027 — somente preparada

`database/027_governance_administration.sql` exige 001–026; não instala predecessoras, não importa pessoas, não cria usuários Auth e recusa reexecução.

- Amplia o catálogo administrativo com pessoas/vínculos existentes e último `auth.users.last_sign_in_at`, quando essa coluna estiver disponível. Timestamp corresponde à autenticação da identidade, não à atividade por ministério; ausência é “Não informado”. View privada, sem diretório Auth público.
- Acrescenta intenções de criação no schema privado: igreja, pessoa/versão, operador, identificador, e-mail institucional, estado e UUID Auth após conclusão. **Nenhuma coluna de senha/token.** RLS por igreja, barreira de troca obrigatória e nenhum acesso direto a clientes; uma tentativa pendente por pessoa.
- RPCs administrativas reaproveitam `iasdpi_schedule_save`, aliases, estados e responsabilidades existentes; verificam igreja, sessão, administrador, versões e referências. Reaproveitam UUIDs e não concedem permissões por participação.
- Rejeição de evento geral verifica aprovador/igreja/versão, serializa com decisões concorrentes, mantém versões/séries e recibo idempotente. A publicação departamental existente permanece direta.
- O helper copiado do catálogo anterior permanece privado, sem EXECUTE para clientes. Todas as novas RPCs usam executor existente e search_path vazio. `check_g11_administration.sql` verifica privilégios/barreiras.

Ordem futura: **005–026 conforme G10.5 → 027 → checks 011, 026 e G11**, somente após backup, janela/DCL e autorização. Não reaplicar 001–004 nem usar os arquivos antigos como scripts idempotentes. A 027 não possui down automático após uso: preservar histórico/intentos/contas, preferir correção incremental revisada ou recuperação coordenada por backup. Nada foi executado no Supabase.

## Fluxo real preparado de criação individual

1. Administrador seleciona a pessoa central existente, confirma identidade, escolhe apelido individual e informa e-mail institucional ou usa domínio institucional previamente aprovado. Sem domínio configurado e sem e-mail informado, a operação é recusada; não cria endereço fictício automaticamente.
2. A Edge existente `access-assistance` valida JWT, igreja, orçamento e configuração. A RPC `iasdpi_account_create_begin` revalida administrador/pessoa/versão, conta/alias existente e reserva uma intenção única antes de chamar Auth.
3. O módulo servidor `accounts.mjs` reutiliza `credentials.mjs` para gerar senha provisória individual com fonte criptográfica. Só o Supabase Auth recebe a senha; ela nunca vai às RPCs, tabelas ou logs do aplicativo.
4. A conclusão transacional vincula o mesmo UUID à pessoa, associa o alias e exige troca no primeiro acesso. Não concede ACL ministerial nem papel geral da Cronoanálise. Administrador configura cada ministério separadamente.
5. A credencial só aparece após confirmação de todas as etapas, em campo oculto por padrão, sem armazenamento local, descartado ao fechar/navegar/sair e após dois minutos. Repetição de solicitação concluída não retorna a senha novamente; nesse caso usa-se redefinição supervisionada.
6. Primeiro login passa pelo fluxo G10.3 de alteração da própria senha, confirmação segura e revogação de sessões. A fila administrativa e recuperação por e-mail continuam existentes; nunca enviar senha existente por e-mail.

**Limite importante:** Auth e banco não compartilham uma única transação. Se Auth criar a conta e a associação falhar, não anunciar sucesso, conceder acesso ou excluir a conta automaticamente. A tentativa fica pendente. O administrador confere a identidade/conta Auth existente, vincula o mesmo UUID e utiliza redefinição supervisionada se necessário; não tenta duplicar a conta. “Encerrar tentativa” preserva histórico e não apaga Auth. Uma tentativa encerrada não pode concluir depois. Resposta perdida após sucesso também exige recuperação, não reexibição de senha.

## Validação e evidências

Consolidado em `governance-g11-validation.json`; logs e capturas em `dist/governance-g11/`. PostgreSQL 17 descartável, `--network none`, Auth sintético; Chromium com rede externa negada; handlers em Node com provedor simulado.

**127 testes selecionados aprovados:** 39 PostgreSQL (incluindo os casos da G10.3 após 027), 8 fluxos visuais G11, 41 de pacote/navegação/regressão e 39 de Auth/Edge/credenciais Node. Zero falhas, erros ou skips no resultado final.

Cobertura: criação sem privilégios automáticos, reutilização de pessoa/UUID, conflitos de alias, cancelamento e concorrência de intenções; último administrador; líder/ancião/membro/múltiplos ministérios; suspensão/revogação; aprovar/rejeitar e histórico; senha provisória, troca e recuperação; calendário público/rascunhos privados; mobile/desktop; regressão da Cronoanálise e do gerador fechado.

Falhas iniciais de fixtures (versões assumidas/atributo de teste e texto transformado por CSS) foram corrigidas, sem enfraquecer validações. A regressão identificou a necessidade da policy `credential_change_required` na tabela nova, e ela foi incluída. A contagem consolidada usa o último resultado por caso e não soma repetições. A suíte histórica inteira não foi reexecutada.

## Pendências para Auth real e implantação

- Backup recuperável/restore ensaiado no plano Free; janela, operador/DCL e autorização da instalação 005–027.
- Conferir Auth real: inscrições públicas, e-mail existente, Site URL/redirects PKCE, SMTP/templates, política de senha, sessões/refresh e recuperação. Não presumir configurações hospedadas por testes locais.
- Implantar a versão completa da Edge, incluindo `accounts.mjs`/`credentials.mjs`. Flags anteriores e `IASDPI_ACCOUNT_CREATION_ENABLED` permanecem desativadas até autorização. Template: `existing-supabase-edge.env.example`; confirmar domínio institucional, cofre/peppers/chaves e origens HTTPS exatas. Nenhum segredo foi criado/configurado.
- Frontend conectado aprovado com flags coerentes até G11, sem fixtures. O gerador de HML conectada continua recusando os projetos conhecidos de produção; não remover a proteção nem publicar o pacote de preparação fechado como sistema real ativo.
- Conciliação/importação e responsabilidades confirmadas; contas reais somente com autorização individual. Uma identidade por responsável, múltiplos vínculos, credenciais privadas únicas e sem compartilhamento real.
- Homologar JWT/GoTrue/gateway/SMTP reais, falhas parciais, expiração de sessões e fluxos compartilhados, preservando a Cronoanálise. Safari/Firefox e aparelhos físicos ainda não foram testados nesta entrega.

## Git e homologação

Somente a branch de desenvolvimento do repositório oficial será enviada; sem merge/release/deploy oficial. A homologação estática usa o repositório já configurado `lcs-casagrande/IASDPI-homologacao`, com Pages servido da branch própria `main`. Atualização direta de arquivos estáticos nesse repositório não é merge na main oficial. Preservar raiz, calendário histórico e demonstrações anteriores; atualizar a integrada e disponibilizar a mesma versão em `/g11/`.

Nenhuma migração, usuário, permissão ou configuração real do Supabase foi alterada. Backup permanece pendente explícito; não houve ativação real.
