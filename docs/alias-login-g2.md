# Governança G2 — identificador institucional e Supabase Auth

## Estado e dependências

Implementação preparada após a 011/G1, na branch `feat/schedule-management-b1`. Não significa que G1 ou G2 foram instaladas no Supabase remoto. Não há integração administrativa remota usada nesta entrega. Nenhuma conta real foi criada, vinculada, alterada ou recebeu senha; nenhum SQL ou função Edge foi publicado em produção.

O frontend continua usando um cliente Supabase, com persistência, renovação, PKCE e recuperação por e-mail existentes. **Não existe tabela de senhas do IASDPI.** A senha é verificada exclusivamente pelo Supabase Auth. O serviço novo é uma Supabase Edge Function, compatível com o frontend estático do GitHub Pages; não exige expor o backend Python/SQLite.

## Identidade individual, apelidos e permissões

A migração `012_alias_login.sql` reserva na IASD_PI os identificadores abaixo, todos **desativados e sem usuário vinculado**:

| Identificador | Estado inicial |
|---|---|
| administrador | Reservado |
| anciaos | Reservado |
| sonoplastia | Reservado |
| musica | Reservado |
| diaconato | Reservado |
| comunicacao | Reservado |

Cada identificador é único por igreja e aponta, quando autorizado, para uma identidade Auth individual. A mesma pessoa pode possuir vários identificadores, mas terá a mesma identidade e as mesmas permissões ao usar qualquer um deles. Não são contas coletivas. Dois líderes não devem receber o mesmo par identificador/senha: cada um utiliza sua própria conta e, se necessário, identificadores distintos, como `sonoplastia.lider1` e `sonoplastia.lider2`. Esses exemplos não são cadastros nem novas atribuições reais.

`administrador` é apenas um nome de entrada. Ele não promove uma conta a admin. Os papéis reais continuam em `iasdpi_access`, por usuário e igreja; as permissões ministeriais continuam nas ACLs e vínculos existentes. Uma conta pode administrar vários departamentos sem precisar de várias senhas. Escolher igreja ou apelido não constitui autorização.

O cadastro de um vínculo exige admin da igreja atual, identidade já autorizada e confirmada, versão esperada e justificativa ao substituir uma identidade vinculada. Não há bootstrap de admin, associação livre ou autoaprovação. A auditoria registra ator, vínculo, versão e motivo. Alterar/revogar apelido não elimina permissões nem encerra todas as sessões Auth existentes: para revogar acesso, usar as autorizações de G1. Um usuário com e-mail continua podendo entrar por e-mail.

## Como funciona

1. O usuário seleciona igreja no fluxo G1 e informa **identificador ou e-mail + senha**.
2. Entradas com `@` seguem o `signInWithPassword` do SDK atual, preservando o login por e-mail.
3. Apelidos seguem para `/functions/v1/alias-login`. Não há chamada pública para converter apelido em e-mail.
4. A Edge Function, com credencial **somente no servidor**, aplica os limites de tentativas e consulta um RPC privado de resolução.
5. O serviço envia a senha ao endpoint oficial de senha do Supabase Auth usando a chave pública. Não usa Admin API para inventar sessão nem autenticar sem senha.
6. Confere a identidade retornada por Auth e revalida vínculo, versão e autorização da igreja. Se houve revogação/troca durante a autenticação ou a identidade diverge, recusa a entrada e revoga somente a sessão recém-emitida.
7. O retorno ao frontend contém apenas os tokens da sessão de usuário. O cliente **já existente** os entrega a `auth.setSession`; persistência e renovação ficam sob responsabilidade do SDK.
8. As telas e operações continuam verificando as permissões e RLS atuais, pelo UUID autenticado e pela igreja, sem usar o texto do apelido como papel.

Não há e-mail/UUID de destino na resposta de resolução pública, porque esse endpoint não existe. Os RPCs que retornam o vínculo só permitem execução por `service_role` e exigem claim de servidor. Mesmo um administrador autenticado não pode chamar esses RPCs de resolução. A administração tem seus próprios RPCs, sem e-mail no retorno.

**Limite inerente ao Auth:** após autenticar corretamente, o usuário recebe sua sessão Supabase normal; seu próprio UUID e os claims/atributos da sua conta podem ser vistos pelo SDK/JWT. Esta implementação não promete ocultar os atributos da conta do próprio titular autenticado. A proteção é contra resolução pública e enumeração antes da prova de senha.

## Banco

- `iasdpi_admin_private.login_aliases`: igreja, identificador, usuário opcional, estado, versão, autoria e timestamps. Sem senha/e-mail armazenado. RLS restritiva por igreja, sem acesso direto de clientes. Identificador único na igreja; usuário pode ter múltiplos identificadores.
- `iasdpi_login_private.budgets`: contadores de abuso em janelas fixas de minuto, com retenção de 15 minutos. Chaves HMAC; não armazena senha, e-mail, apelido ou IP em claro. São metadados privados de proteção do endpoint, não cadastros ministeriais.
- `iasdpi_alias_identifier(text)`: sugestão determinística para novos ministérios, removendo acentos e gerando identificador válido. Não cria conta, vínculo, permissão ou apelido automaticamente. Colisões precisam de revisão; a restrição de unicidade impede duplicação.
- Admin: `iasdpi_alias_list()` e `iasdpi_alias_save(text,uuid,boolean,bigint,text)`.
- Somente servidor: `iasdpi_alias_login_lookup(text)`, `iasdpi_alias_login_confirm(uuid,bigint,uuid)` e `iasdpi_alias_login_limit(text[])`.

A migração mantém o modelo G1: tabelas de negócio pertencem a postgres, funções executam como `iasdpi_church_executor` sem BYPASSRLS, schema privado sem acesso dos clientes e proteção de igreja no banco. O contador global tem política exclusiva para o executor; só RPCs de servidor podem usá-lo. Não altera programas, atividades, históricos, agenda, organograma, arquivos ou contas Auth.

## Proteção de tentativas e enumeração

O serviço usa resposta genérica idêntica para apelido inexistente, inativo, sem autorização, senha errada ou orçamento esgotado. Não reflete erros do provedor. Respostas de falha têm piso de um segundo e pequeno jitter. Apelido desconhecido também percorre o endpoint de senha com um destino inexistente; isso não cria conta nem dispara recuperação.

Os limites são transacionais em PostgreSQL, incluindo chamadas concorrentes: 300 tentativas/minuto globais, 120 por igreja, cinco por identificador e cinco por identidade (compartilhadas entre seus apelidos). Há limite de 30 por IP **somente quando o operador configurar um header confiável sobrescrito pelo gateway**. Sem essa configuração o código não confia em `x-forwarded-for` enviado pelo cliente; os demais limites continuam obrigatórios. Os valores são janelas fixas, não contagem deslizante.

CORS usa origens HTTPS exatas, sem wildcard; isso é uma camada adicional, não a proteção principal. JSON é limitado a 8 KB, campos desconhecidos são recusados, chamadas upstream têm timeout e não seguem redirecionamentos. Senhas não são normalizadas, registradas ou enviadas nos RPCs de dados. Respostas sensíveis usam `Cache-Control: no-store`. O código não registra corpos, segredos ou tokens em logs.

Os testes comprovam respostas e limites locais; não demonstram latências constantes em um provedor remoto. Antes de liberar, homologar comportamento real do Auth/gateway, limites, CAPTCHA/MFA quando exigidos pelo projeto e ausência de logging de payloads no serviço. Nenhuma política do provedor foi desativada.

## Conta sem e-mail pessoal

Supabase Auth exige um identificador próprio compatível com o provedor de senha. Para um líder sem e-mail pessoal, pode ser utilizada uma **conta individual com endereço institucional/técnico administrado pela igreja**, provisionada por processo confiável. O líder utilizará o apelido no site e não precisa digitar o endereço técnico.

Esta entrega não escolhe domínio, cria contas, confirma e-mails artificialmente, redefine senhas ou envia credenciais. O cadastro de cada conta e de seu endereço institucional exige autorização separada. Senhas devem ser individuais e entregues por meio seguro, nunca em código, SQL de migração, chat ou planilha compartilhada.

A recuperação por e-mail existente continua funcionando quando o titular possui acesso ao endereço registrado. Para contas técnicas sem caixa acessível, será necessário procedimento administrativo de recuperação via Supabase Auth; não foi criado um endpoint público apelido → endereço de recuperação, nem é prometido envio a uma caixa inexistente.

## Ativação futura, por ordem (não executada)

1. Conferir/homologar G1/011 e `check_church_isolation.sql`. Não executar G2 sobre o banco de igreja única antigo.
2. Revisar `012_alias_login.sql` e executar primeiro em banco/projeto descartável. Depois, executar `check_alias_login.sql` e também o verificador G1: zero linhas esperado. A migração é transacional e recusa execução repetida.
3. Configurar a Edge Function no projeto de homologação. `supabase/config.toml` desabilita verificação JWT **somente para alias-login**, pois login ocorre antes de haver sessão. A função autentica com senha no Auth; as demais RPCs/telas continuam protegidas. Não aplicar essa opção a outras funções.
4. Usar exclusivamente o gerenciador de segredos da hospedagem. O runtime Supabase fornece `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`; pode ser configurada `SUPABASE_PUBLISHABLE_KEY` em substituição à chave pública antiga. Nenhuma chave administrativa vai para config.js ou GitHub Pages.
5. Cadastrar os segredos/configurações novos: `IASDPI_ALIAS_LOGIN_PEPPER` (aleatório, com pelo menos 32 caracteres), `IASDPI_ALIAS_ALLOWED_ORIGINS` (origens HTTPS exatas separadas por vírgula; para Pages, `https://lcs-casagrande.github.io`, sem caminho), `IASDPI_ALIAS_LOGIN_ENABLED=true`. `IASDPI_ALIAS_TRUSTED_IP_HEADER` é opcional e só deve ser definido após verificar o gateway. Não compartilhar esses valores no chat nem versioná-los.
6. A implantação do código está em `supabase/functions/alias-login/index.ts` + `handler.mjs`. GitHub Pages hospeda apenas o frontend. O deploy da função, os segredos e a migração exigem aprovação separada e não foram executados. Publicar apenas o frontend não habilita o login por apelido.
7. Um admin autenticado associa os identificadores às contas individuais existentes e já autorizadas, pelos RPCs administrativos. As reservas iniciais têm versão 1; criação de novo identificador usa versão esperada 0. Não inserir vínculos diretamente para contornar as validações. Não conceder ACL nem papel só porque o nome é institucional.
8. Homologar com contas descartáveis: igreja, senha válida/inválida, cada apelido da mesma identidade, e-mail antigo, sessão/reload/renovação/logout, recuperação, revogação, troca concorrente, permissões ministeriais e erro de rede. Confirmar que resolver RPC é negado a anon, leader e admin de aplicativo.
9. Após autorização, repetir a implantação aprovada no projeto real e só então habilitar `churchIsolationEnabled: true` e `aliasLoginEnabled: true` no frontend. Atualmente ambas permanecem false. O gerador de pacotes recusa habilitar alias com G1 desligada.

Site URL, Redirect URLs, SMTP, template de recuperação, política de senha e duração de sessão continuam nas configurações atuais do Supabase. Não foram alteradas automaticamente. CAPTCHA pode ser repassado pelo serviço quando fornecido; o formulário atual não adiciona widget novo. Requisitos reais do projeto precisam ser homologados antes da liberação.

## Administração de vínculos

As operações usam a sessão normal do admin da igreja e não chave privilegiada no navegador. Exemplo do corpo enviado ao RPC `iasdpi_alias_save`, **não executado**:

```json
{
  "p_identifier": "sonoplastia",
  "p_user_id": "UUID_DA_CONTA_INDIVIDUAL_JA_AUTORIZADA",
  "p_enabled": true,
  "p_expected_version": 1,
  "p_reason": "Vínculo conferido pela administração"
}
```

O e-mail não faz parte desse corpo nem do retorno. Primeiro consultar `iasdpi_alias_list` para conferir versões e evitar substituir cadastro recente. Esta fase entrega os RPCs de governança; não acrescenta uma nova página de gestão de apelidos fora do escopo solicitado.

## Rollback e limites

Manter `aliasLoginEnabled=false` restaura o uso do e-mail sem modificar contas, senhas ou sessões. Desativar a função no servidor impede novos logins por apelido; as sessões já emitidas continuam sendo sessões nativas, sujeitas às permissões/revogações de G1. Não apagar aliases/usuários nem reverter dados de cultos para fazer rollback.

Não há teste com Deno/Edge Runtime hospedado ou senha real do Supabase nesta entrega. O handler portátil é testado em Node com fetch/Auth simulados; RLS, RPCs, concorrência e migrações são exercitados em PostgreSQL descartável sem rede. A homologação real e o provisionamento individual permanecem pendentes de autorização e configuração.

## Arquivos G2

- `database/012_alias_login.sql`, `database/check_alias_login.sql`.
- `supabase/config.toml`, `supabase/functions/alias-login/index.ts`, `supabase/functions/alias-login/handler.mjs`.
- `frontend/auth.js`, `frontend/config.js`, `frontend/schedule-foundation.js`, `frontend/schedule-management.js` e `scripts/build_homologation.py`.
- `tests/alias_login_handler.test.mjs`, `tests/test_alias_login_sql.py`, `tests/test_alias_login_browser.py` e este relatório.

Commit sugerido, não realizado: `feat: prepara login institucional por apelido com Supabase Auth`.

## Evidências desta entrega

**186 testes aprovados, sem falhas nas execuções finais**: 28 cenários novos e 158 de regressão.

| Execução | Aprovados | Evidência |
|---|---:|---|
| Handler Edge portátil, Auth/fetch simulados em Node | 11 | `dist/alias-login/tests-edge-handler-final.log` |
| Migração, RLS, permissões e concorrência em PostgreSQL 17 sem rede | 10 | `dist/alias-login/tests-postgresql-final.log` |
| Login por apelido/e-mail, SDK, G1, sessões e interface no Chromium | 25 | `dist/alias-login/tests-browser.log` |
| Recuperação PKCE, rascunhos, formulários ministeriais, navegação e pacotes | 140 | `dist/alias-login/tests-regression.log` |

Os sete cenários novos do navegador foram repetidos após o ajuste final de validação, todos aprovados (`tests-browser-final.log`), sem contá-los novamente no total. Não é uma afirmação de execução de toda a suíte histórica acumulada do projeto.

A concorrência real foi testada com oito transações independentes: apenas cinco tentativas por bucket foram admitidas e as recusas mantiveram os contadores. As respostas de falha e o piso de tempo foram testados com relógio/fetch simulados, não medidos no Supabase real. Não foi testada uma senha real ou enviado e-mail.

Prévia visual isolada: `dist/alias-login/IASDPI-G2-login-final.html`, sem rede, sem SDK conectado e sem envio de credenciais. Ela permite selecionar IASD_PI e avaliar o formulário de identificador/e-mail. O login real não é simulado como sucesso nessa prévia. Capturas e verificação do artefato estão no mesmo diretório.

Hashes dos arquivos entregues, contagens e escopo dos testes: `dist/alias-login/result.json`. Configuração real, associação de identidades, implantação da Edge Function e homologação autenticada no destino permanecem pendentes. Não houve SQL remoto, commit, merge, push ou deploy.
