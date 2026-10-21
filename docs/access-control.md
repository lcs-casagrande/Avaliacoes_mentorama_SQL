# Acesso público e administrativo — tarefa 1

## Escopo

Uma igreja: IASD Parada Inglesa. Organograma e agenda são públicos. Início operacional,
programações, acompanhamento, realizado, histórico e backups exigem Supabase Auth
e uma linha habilitada em `iasdpi_access`, com papel `admin` ou `leader`.
Os dois papéis podem operar esses módulos. A gestão de contas está em
[Administração > Usuários](user-management.md), ativada pela migração 002.
Nem administradores escrevem diretamente na lista: operações passam por RPCs.

Não existe modo de desenvolvimento que dispense a autorização. `?demo=1` apenas
seleciona o armazenamento local e continua exigindo login/autorização.

## Configuração necessária, ainda sujeita à aprovação

1. Revisar `database/001_single_church_access.sql` em homologação. Não é executado
   pelo servidor. Ele cria acesso e modelo de cronograma e prepara as políticas de
   arquivos, preservando a tabela anterior e sua unicidade por autor/digest.
   Se já houver tabelas de acesso/modelo ou políticas desconhecidas, para com erro.
   Revisar a estrutura existente antes da implantação e guardar backup recuperável.
2. Configurar uma conta Supabase Auth com e-mail confirmado e login por senha.
   Um operador confiável confere sua identidade e UUID e insere manualmente a
   autorização inicial. Não existe trigger de autoaprovação nem promoção baseada
   em `user_metadata`. Nunca colocar chave secreta/service_role no navegador.
3. No servidor, configurar `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. Permitir
   HTTPS ao domínio exato do projeto no ambiente. A URL deve ser a origem HTTPS
   pura, sem credenciais, caminhos, formatação Markdown ou parâmetros.
4. No frontend, conferir a URL em `frontend/config.js`. A chave **pública** pode
   ser configurada ali ou informada na seção de conexão do login. As variáveis do
   servidor não são publicadas automaticamente no JavaScript; placeholders do
   proxy do Codex não devem ser copiados para esse arquivo.
5. Testar contas autorizadas e não autorizadas, RLS de arquivo e revogação no
   Supabase real antes de publicar. A validação atual usa Supabase simulado.

Exemplo de bootstrap, apenas para execução administrativa posterior:

```sql
-- Conferir auth.users, identidade e e-mail confirmado antes de executar.
insert into public.iasdpi_access (user_id, role)
values ('UUID_CONFIRMADO_PELO_OPERADOR', 'admin');
-- Para revogar, o operador define enabled=false.
```

`database/supabase-archives.sql` ficou apenas como aviso de legado. Reaplicar as
políticas individuais antigas depois do novo roteiro poderia contornar a lista
de autorização. Não usar o SQL multi-igreja discutido no chat para esta tarefa.

## Proteções implementadas

- O backend valida o bearer token por `/auth/v1/user` no projeto configurado e
  consulta a autorização desse UUID. Não decodifica um JWT para confiar em claims
  locais, não aceita role do cliente e não mantém cache de permissões.
- A autorização ocorre antes de ler o corpo de escrita ou abrir o SQLite.
  Falha de rede/configuração bloqueia o acesso. Apenas `/api/health` é público.
- O frontend verifica a autorização antes de operações, inclusive chamadas diretas
  ao adaptador e exportação/restauração. Revê o acesso ao voltar à aba e a cada
  minuto. Expiração/revogação limpa somente memória e tela, nunca registros locais.
- Senhas e chaves administrativas nunca são persistidas. A sessão comum é mantida
  pelo SDK oficial Supabase, com renovação e recuperação; não há armazenamento
  manual de tokens pela aplicação. Ver [sessão e datas](session-and-date.md).
  Sair encerra a sessão local pelo SDK, preservando outras sessões do usuário.
- O cronograma predefinido saiu do bundle público: o backend o entrega somente na
  rota protegida `/api/chronogram`; Pages/prévia o obtêm de `iasdpi_templates` por RLS.
- A CSP do servidor permite conexões somente à própria origem e ao projeto
  Supabase configurado. Não libera `unsafe-inline` ou domínios arbitrários.
- O arquivo remoto usa a mesma sessão, e não uma segunda autenticação. Entrar não
  arquiva automaticamente os dados. Escritas posteriores podem arquivar cópias.
- As políticas propostas permitem arquivos compartilhados entre autorizados e
  proíbem UPDATE/DELETE e falsificação de autor pelo cliente. O JWT autenticado é
  necessário; possuir apenas a chave pública não concede acesso.

## Preservação e limites

As chaves `iasdpi-demo-v1`, `iasdpi-last-safety-copy-v1` e `iasdpi-before-restore-v1`
foram preservadas. Abrir a página pública não carrega nem inicializa os registros
locais. Login/logout não migram dados, não alteram o SQLite e não limpam o navegador.

Autenticação web não cifra dados antigos do `localStorage` nem protege contra uma
pessoa com acesso ao perfil do navegador/DevTools ou ao arquivo SQLite. Não usar
perfil compartilhado para dados sensíveis. O modo local permanece um armazenamento
do dispositivo, não uma base sincronizada. A restauração conserva versões diferentes.

O HTML independente agora abre no organograma e precisa de rede e autorização para
funções privadas; não há bypass offline. A agenda pública contém nomes públicos.
Não adicionar dados privados aos arquivos versionados de um repositório público:
proteger rotas HTTP não oculta conteúdo do histórico Git.

As autorizações locais só entram em vigor no Supabase após o SQL aprovado ser
aplicado. A versão pública anterior e políticas já existentes no projeto remoto
não são alteradas por este código. Não presumir produção protegida antes da revisão,
configuração, homologação e publicação autorizadas.

## Testes

```sh
python -B -m unittest discover -s tests -p 'test_access.py' -v
python -B -m unittest discover -s tests -p 'test_frontend_access.py' -v
```

Backend: biblioteca padrão, Supabase simulado e SQLite exclusivamente temporário.
Navegador: `tests/requirements.txt` e Chromium instalado; sem essas dependências a
suíte de navegador é explicitamente ignorada. Usa perfil isolado e intercepta as
requisições Supabase, sem credenciais reais nem acesso ao banco de produção.

Cobertura: visitantes, tokens inválidos, conta anônima, metadados adulterados,
papéis inválidos, revogação, falha de rede/configuração, expiração, rotas privadas,
arquivos não publicados, operação autorizada, segundos/extras, preservação de
registros, acesso público, navegação e mobile. O SQL/RLS real continua pendente.
