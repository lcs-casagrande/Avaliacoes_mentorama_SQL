> Plano histórico: o repositório separado foi abandonado. A publicação atual usa
> o Pages existente, conforme [pages-release.md](pages-release.md).

# Homologação no GitHub Pages — plano sujeito à aprovação

## Estado observado em 21/10/2026

- Principal: https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/.
- Pages ativo, HTTPS, publicação por branch `gh-pages`, diretório raiz.
- Um repositório oferece um site Pages. Trocar sua branch de origem substituiria
  o site principal, portanto essa configuração não será alterada.
- A referência remota `main` avançou por sincronizações de `frontend/agenda-data.js`.
  O checkout possui alterações não commitadas de autenticação e administração.
  Não fazer reset, rebase, commit ou push automático dessas alterações.
- `lcs-casagrande/IASDPI-homologacao` não existia na consulta à API (404).

## Proposta de publicação

Após aprovação explícita, criar o repositório público **IASDPI-homologacao** na mesma
conta e publicar apenas o pacote estático revisado, pela branch `main` desse novo
repositório. Não criar commits em `main` ou `gh-pages` do repositório principal.

URLs previstas, ainda não publicadas:

- Site: https://lcs-casagrande.github.io/IASDPI-homologacao/
- Login: https://lcs-casagrande.github.io/IASDPI-homologacao/#login
- Administração: https://lcs-casagrande.github.io/IASDPI-homologacao/#users

Publicar somente: index.html, styles.css, config.js, storage.js, auth.js, demo.js,
actuals.js, agenda-data.js, agenda.js, archive.js, organization.js, users.js, app.js,
.nojekyll e manifest.json. Sem Python, SQLite, SQL, testes, credenciais de ambiente
ou cronograma privado. A agenda será um snapshot público da versão publicada;
o workflow de sincronização do site principal permanece inalterado.

O pacote contém alterações ainda não commitadas. O manifesto registra o commit-base,
essa condição e os hashes dos arquivos para revisão. O primeiro commit de publicação
será somente no novo repositório e conterá exatamente os arquivos aprovados.

## Isolamento de dados e limites

Repositórios Pages da mesma conta compartilham a origem `https://lcs-casagrande.github.io`.
Um caminho/repositório diferente não é fronteira de segurança do navegador.

Para não ler nem modificar os registros principais por acidente, a homologação usa
prefixo `iasdpi-homologacao-v1:` em **todas** as chaves: registros, cópia anterior,
pré-restauração, configuração pública e marcador de pendência. O site principal
continua com suas chaves anteriores. Não há migração nem limpeza dos dados existentes.
Testes instrumentam getItem/setItem/removeItem e comprovam que o pacote não acessa
as chaves principais, mesmo após login, alteração local e restauração.

O pacote usa `storageMode=browser`, independentemente do hostname, e nunca solicita
`/api/` Python. Horários, cultos e backups permanecem locais e separados.

Com o projeto Supabase atual, o padrão preparado é **login e consultas**:

- Auth: login por senha, verificação de usuário, autorização e logout da sessão
  local (`scope=local`), para não revogar outras sessões do mesmo usuário.
- REST: leitura de autorização, modelos, arquivos e RPCs de listagem/busca.
- Bloqueia nos clientes de rede cadastro de contas, aceite/criação/revogação de
  convites, alteração de perfis e inserção de arquivos. Autoarquivamento desativado.
- A aplicação mostra um aviso permanente de homologação/consulta.

**Limite importante:** esse bloqueio evita alterações acidentais pela interface.
Não modifica a RLS nem retira os privilégios reais de uma conta admin. Quem possui
um JWT autorizado pode usar outro cliente para operar o projeto real. Para testes
completos de escrita e isolamento de banco, usar projeto Supabase de homologação;
para isolamento de origem do navegador, usar domínio/subdomínio diferente.
Não afirmar que uma URL Pages de outro repositório oferece esses isolamentos.

Login/logout podem gerar sessões e logs normais do Supabase Auth; não gravam cultos,
arquivos, convites ou autorizações. Nenhuma migração é executada na publicação.

## Gerar e conferir o pacote, sem publicar

```sh
python -B scripts/build_homologation.py \
  --output dist/homologacao \
  --site-url https://lcs-casagrande.github.io/IASDPI-homologacao/ \
  --agenda-data /CAMINHO/DO/SNAPSHOT_PUBLICO/agenda-data.js
python -B -m unittest discover -s tests -v
git diff --check
```

O destino precisa estar vazio: o gerador não apaga nem sobrescreve outra pasta.
Sem `--agenda-data`, utiliza o snapshot versionado local, que pode estar antigo.
O gerador aceita apenas a configuração pública de config.js, valida publishable,
recusa JWT literal/chave secreta e usa allowlist de arquivos. Não copia a credencial
injetada no proxy do Codex nem consulta variáveis administrativas.

O teste de navegador usa Supabase simulado e perfis isolados. Testes SQL locais
exigem ativação explícita e não usam o Supabase real. Não executar migrações ou
operações de administração no projeto real para testar a publicação.

## Supabase Auth — URLs

Login por senha e RPCs não precisam de redirecionamento OAuth; bastam URL pública,
publishable correta, e-mail confirmado e `iasdpi_access` com papel habilitado.

**Não substituir a Site URL existente de produção.** Se futuramente forem testados
convites/confirmação/recuperação no ambiente separado, adicionar em Authentication
> URL Configuration > Redirect URLs a URL exata de homologação:

```text
https://lcs-casagrande.github.io/IASDPI-homologacao/
```

Adicionar caminhos específicos somente quando o fluxo precisar. Não liberar todo
o domínio da conta com wildcard. A configuração de redirects não foi alterada por
esta preparação. Cadastro, convites e aceite continuam bloqueados no modo consulta.

## Passos após aprovação

1. Revalidar hashes do pacote, chave pública e snapshot da agenda.
2. Criar o novo repositório, sem modificar nenhum arquivo do repositório principal.
3. Fazer o primeiro commit do pacote estático no repositório novo e push para main.
4. Ativar Pages apenas no novo repositório, branch main, raiz. Não mudar a origem
   Pages do principal, DNS, domínio personalizado ou configurações Supabase.
5. Aguardar build e verificar as URLs de login/admin por Chrome e celular.
6. Confirmar anon bloqueado, login real pelo próprio usuário, listagem administrativa,
   armazenamento separado e nenhum pedido a /api/ ou RPC de escrita.
7. Conferir novamente principal e sua agenda; não apagar ou substituir seus dados.

Antes dessas ações, apresentar plano, lista de arquivos e URL prevista e obter a
aprovação exigida pelo usuário. Não entregar uma URL prevista como se já estivesse ativa.
