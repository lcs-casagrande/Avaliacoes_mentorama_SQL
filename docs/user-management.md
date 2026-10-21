# Administração > Usuários — IASD Parada Inglesa

## Escopo e arquitetura

Uma igreja, com papéis `admin` e `leader`. Administradores podem consultar as
autorizações, buscar uma conta por e-mail exato, autorizar como líder, alterar o
perfil, reativar ou revogar acesso e gerar/revogar convites. Líderes não acessam
essas operações. Não há diretório público de contas do Supabase.

As operações são RPCs PostgreSQL SECURITY DEFINER, não chamadas à API administrativa
do Auth. Não há service_role, sb_secret, senha do banco ou outra chave administrativa
no frontend. A chave pública e o JWT do usuário autenticado são suficientes.

## Migração 002 — não executar sem aprovação

Pré-requisito: `database/001_single_church_access.sql` aplicado e conferido. Se as
três tabelas já existem, **não executar 001 novamente**. Revisar backups, estrutura,
proprietário e RLS antes de aplicar 002. O script depende de PostgreSQL com funções
nativas `gen_random_uuid` e `sha256` (testado em PostgreSQL 17).

`database/002_user_management.sql`:

- Exige executor `postgres` e confere proprietário/RLS de `iasdpi_access`.
- Não recria ou exclui `iasdpi_access`, `iasdpi_templates` ou `culto_archives`.
  Preserva as linhas, os perfis e os arquivos; revoga escrita direta na lista de
  acesso. Arquivos continuam sem UPDATE/DELETE para os usuários do aplicativo.
- Cria o schema **não exposto** `iasdpi_admin_private` e três tabelas novas:
  `control` (serialização), `invitations` (somente hash do token) e `audit`.
- Cria verificadores privados e sete RPCs públicas: `iasdpi_list_users`,
  `iasdpi_find_account`, `iasdpi_set_access`, `iasdpi_create_invite`,
  `iasdpi_list_invites`, `iasdpi_revoke_invite` e `iasdpi_accept_invite`.
- Objetos novos pertencem a postgres, por exigência do executor. Todas as funções
  usam SECURITY DEFINER, search_path vazio, nomes qualificados e nenhum SQL dinâmico.
  Não adicionar sobrecargas ou substituir seus proprietários sem revisão.
- Revoga EXECUTE de PUBLIC/anon; authenticated chama as RPCs, que verificam a
  autorização novamente no banco. Funções e tabelas privadas não recebem privilégios
  para anon/authenticated. Não adicionar o schema privado à lista exposta da API.
- A RLS existente de `iasdpi_access` permite consulta da própria associação. As
  RPCs consultam como proprietário, sem recursão. Não habilitar FORCE RLS nessa
  tabela sem redesenhar e testar as funções.
- Não cria associação ou administrador automaticamente. Não é idempotente:
  reaplicação falha em vez de sobrescrever objetos ou esconder divergências.

O log privado registra executor, ação, alvo, data e mudança de perfil. Nunca contém
senha, JWT ou token de convite. Não há tela pública para esse log; um operador
confiável pode consultá-lo pelo SQL Editor quando necessário.

## Primeiro administrador: procedimento exclusivamente administrativo

1. Criar uma conta no Supabase Auth e confirmar o e-mail.
2. O operador responsável confere pessoalmente identidade, e-mail e UUID.
3. Se ainda não existe administrador habilitado, executar manualmente o bloco
   abaixo no SQL Editor como operador confiável. Não expor como RPC.

```sql
begin;
do $$
declare v_email text := 'SEU_EMAIL_CONFIRMADO'; v_user uuid;
begin
  if exists(select 1 from public.iasdpi_access where role='admin' and enabled) then
    raise exception 'Já existe administrador. Usar a gestão de usuários.';
  end if;
  select id into v_user from auth.users
    where lower(email)=lower(v_email) and email_confirmed_at is not null
      and coalesce(is_anonymous,false)=false;
  if v_user is null then raise exception 'Conta não validada.'; end if;
  if exists(select 1 from public.iasdpi_access where user_id=v_user) then
    raise exception 'Já existe autorização para esta conta. Revisão manual necessária.';
  end if;
  insert into public.iasdpi_access(user_id,role,enabled) values(v_user,'admin',true);
end;
$$;
commit;
```

Depois do bootstrap, usar a página. Nenhum usuário sem acesso pode promover a si
próprio. Se não houver administradores por intervenção externa, recuperar por
procedimento administrativo supervisionado; nunca criar bootstrap público.

## Contas existentes

1. Entrar com uma conta admin e abrir **Administração · Usuários**.
2. Buscar o e-mail exato; a RPC só devolve uma conta correspondente, nunca pesquisa
   parcial de todo o Auth. Apenas admins podem fazer essa busca.
3. Se o e-mail estiver confirmado e não houver autorização, clicar **Autorizar
   como líder**. Conta ainda não confirmada deve concluir a confirmação primeiro.
4. Para promover, selecionar Administrador e salvar. Para revogar, desmarcar
   Acesso ativo e salvar. Autorizações revogadas permanecem no histórico de dados.
5. Conta já cadastrada nas autorizações, inclusive revogada, deve ser gerida pela
   lista; convite não pode reativá-la. A lista tem páginas de 50 contas.

O último administrador ativo não pode ser revogado ou rebaixado pela RPC. Mutações
usam uma linha de controle, com reavaliação do executor após o bloqueio. Corridas
em isolamento mais restrito podem produzir erro 40001; atualizar e tentar a operação
novamente. Um operador SQL privilegiado continua podendo contornar essas regras.

Revogação não destrói registros de culto. O backend consulta a autorização em cada
requisição; o frontend verifica nas operações, na volta à aba e periodicamente.
Uma revogação não recolhe arquivos já baixados por alguém anteriormente autorizado.

## Novos usuários: convite e confirmação

1. Admin informa o e-mail em Convidar novo líder e gera um link.
2. A RPC cria um token aleatório de aproximadamente 244 bits, guarda somente seu
   SHA-256 e devolve o token uma vez. Prazo: 48 horas. Um convite novo invalida o
   anterior daquele e-mail. A lista não permite recuperar o token original.
3. O admin copia e envia o link por canal privado ao destinatário. **Não há envio
   automático de convite por e-mail nesta etapa.** Gerar links no endereço HTTPS
   do site, não no HTML baixado. O fragmento `#invite/TOKEN` não vai no pedido HTTP
   e é retirado da barra de endereço ao abrir; fica apenas em memória durante uso.
4. O convidado pode entrar com sua conta ou cadastrar uma nova pelo Supabase Auth.
   A senha só é enviada ao Auth; o cadastro não cria autorização.
5. Após confirmar o e-mail, deve reabrir o link original e usar Entrar e aceitar.
   O aplicativo não importa tokens da URL de confirmação nem depende de persistir
   JWT ou senha. Configure Site URL/redirects no Supabase para o endereço real.
6. A RPC de aceite valida JWT, conta não anônima, e-mail confirmado exatamente
   correspondente, token, validade, uso único e administrador emissor ainda ativo.
   O papel é sempre `leader`, sem parâmetro para escolher `admin`.
7. O convite é consumido na mesma transação da autorização. Falhas não consomem o
   convite. Reutilização, e-mail diferente, expiração e revogação são rejeitados.

**Obrigatório no Supabase Auth:** habilitar e-mail/senha e confirmação de e-mail.
Para cadastro pelo convite, permitir novas inscrições. Essas inscrições, mesmo
fora de convite, não dão acesso ao IASDPI. Configurar SMTP, limites de envio e
proteção contra abuso/CAPTCHA conforme a operação; a confirmação precisa ser real,
não autoconfirmada. Não compartilhar um convite em grupos ou canais públicos.

Um convite não pode reativar acesso previamente revogado. Revogar/rebaixar um
administrador pela RPC também cancela seus convites pendentes. E-mails e dados de
outras contas não são mostrados no fluxo público; somente admins veem a lista de
autorizações ou uma conta pesquisada por e-mail exato.

## Ativação e homologação

1. Preservar backup recuperável e revisar 001 já aplicada e os papéis existentes.
2. Aplicar 002 como postgres **primeiro em homologação**, após aprovação.
3. Conferir schema privado não exposto e nenhuma chave administrativa no frontend.
4. Configurar Auth/e-mail, chave pública e domínio HTTPS já usados na tarefa 1.
5. Usar duas contas admin, uma leader e uma sem acesso. Testar lista, busca exata,
   promoção, revogação, último admin, convite correto/incorreto/expirado/repetido,
   conta não confirmada e tentativa de chamada REST direta como leader/anon.
6. Conferir organograma e agenda públicos, cultos, histórico, registros e backups.
7. Só então autorizar migração de produção, commit e publicação separadamente.

Nenhuma migração foi aplicada ao Supabase por esta implementação. Políticas de um
projeto remoto já existente não são corrigidas simplesmente por carregar o frontend.

## Testes reproduzíveis

```sh
python -B -m unittest discover -s tests -v
```

Sem a configuração abaixo, testes PostgreSQL são marcados como ignorados. Backend
usa SQLite temporário, e testes de navegador interceptam chamadas Supabase.

Para SQL/RLS e concorrência reais, criar container PostgreSQL local descartável,
sem rede ou publicação de portas (imagem testada: postgres:17-bookworm):

```sh
docker run --rm -d --network none --name iasdpi-users-test \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-bookworm
IASDPI_PG_TEST_CONTAINER=iasdpi-users-test \
  python -B -m unittest discover -s tests -p 'test_user_management_sql.py' -v
docker stop iasdpi-users-test
```

Os testes recusam containers com rede diferente de none, criam bancos novos com
prefixo `iasdpi_test_` e removem somente esses bancos. `auth.users`, `auth.uid()` e
`auth.jwt()` são simulados nesse PostgreSQL isolado; funções, grants, RLS e bloqueios
da aplicação são reais. Não usar URL de banco Supabase para essa suíte. Isso não
substitui homologação do gateway Auth/REST e do serviço de e-mail reais.
