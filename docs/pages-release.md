# Publicação no Pages existente — validação do Supabase Auth

## Destino e backups de código

Repositório: `lcs-casagrande/Avaliacoes_mentorama_SQL`.
Código na branch `main`; Pages na branch `gh-pages`, raiz, sem domínio personalizado.
URL: https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/.
O repositório separado de homologação foi abandonado por decisão do proprietário.

Backups criados antes da publicação, sem sobrescrever refs existentes:

- `backup-pre-supabase`: `bd0361690b9268cbdd4a05a8f1226060348542fe` (código).
- `backup-pre-supabase-pages`: `bf2e56e8102444d77e32324725a8b348fbff453f` (site anterior).

Essas branches NÃO contêm os registros dos navegadores.

## Onde estão os dados

- Pages: programações, planos, horários realizados, extras, notas e histórico
  permanecem no `localStorage`, chave original `iasdpi-demo-v1`, em cada perfil
  de navegador. Memória da tela é descartável; logout não remove os dados locais.
- Cópias locais: `iasdpi-last-safety-copy-v1` e `iasdpi-before-restore-v1`.
  Não são backup externo e desaparecem se os dados do navegador forem apagados.
- Agenda pública: `frontend/agenda-data.js`, sincronizada pelo workflow existente,
  e escalas complementares em `frontend/agenda.js`. Organograma em `organization.js`.
- Backend Python: SQLite somente no servidor onde for executado; não é publicado.
- Supabase: Auth, acesso por `iasdpi_access`, modelo em `iasdpi_templates` e cópias
  em `culto_archives`, conforme RLS/RPCs previamente instaladas pelo administrador.
  Não há sincronização operacional dos registros locais nesta publicação.
- Backups baixados são arquivos externos, independentes de Git e de Supabase.

## Exportar antes da atualização

Em CADA navegador que possui registros, abrir o site existente. Se houver opção
de backup, usá-la. A versão anterior pode não oferecer essa tela; nesse caso,
no Chrome de computador, F12 > Console, executar apenas este trecho revisado:

```javascript
(() => {
  const raw = localStorage.getItem('iasdpi-demo-v1');
  if (raw === null) throw Error('Este navegador não contém registros.');
  const data = {
    format: 'IASDPI-backup', version: 1, programs: JSON.parse(raw),
    localSafetyCopies: {
      previous: localStorage.getItem('iasdpi-last-safety-copy-v1'),
      beforeRestore: localStorage.getItem('iasdpi-before-restore-v1')
    }
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'IASDPI-backup-pre-supabase.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
})();
```

Este JSON contém dados pessoais e não é cifrado: guardar em local privado, não
anexar ao repositório público. O trecho não altera nem envia dados. Conferir que
o download terminou e que `programs` contém os registros esperados. Se o JSON
local estiver corrompido, não tentar corrigi-lo apagando o armazenamento.

No Chrome Android, os dados são do celular; abrir o site no computador não os
copia. Para exportar antes da atualização, usar inspeção remota do Chrome via USB.
Após atualizar, entrar no mesmo perfil e usar Arquivo e banco > Baixar backup,
com senha de pelo menos 10 caracteres. Guardar arquivo e senha separadamente.

## Restaurar somente por ação explícita

Entrar > Arquivo e banco > Restaurar uma cópia. Selecionar o JSON e informar a
senha caso seja cifrado. O arquivo acima não precisa de senha. O validador verifica
a estrutura antes de gravar. O merge ignora cópias idênticas; versões diferentes
com mesmo ID entram com novo ID e nome de cópia. Os registros atuais permanecem.
As cópias brutas em `localSafetyCopies` são para recuperação administrativa;
não são aplicadas automaticamente pela interface.

Não há migração, importação, restauração, limpeza ou carga de exemplos no boot.
O pacote deste Pages usa `storageNamespace=""`, preservando todas as chaves
originais. Não apagar cache com a opção de apagar dados do site. Para recarregar
o código, usar atualização da página/recarga forçada sem remover armazenamento.

## Pacote e segurança

Gerar somente os 17 arquivos estáticos pelo comando:

```sh
python -B scripts/build_pages.py --output dist/pages
python -B -m unittest discover -s tests -v
git diff --check
```

O destino deve estar vazio. O gerador inclui hashes de recursos na URL para evitar
mistura de versões, CSP com scripts da própria origem e conexão somente à origem
e ao projeto Supabase. Não publica Python, SQLite, SQL ou credenciais privadas.
Somente URL e publishable pública são incluídas. O manifesto registra hashes.

`remoteReadOnly=true`: login e logout local de Auth, consultas de autorização,
modelos e arquivos, RPCs de listagem/busca. Cadastro, convites, alteração de papéis,
arquivamento e autoarquivamento remotos são bloqueados antes da requisição.
Registros locais ainda podem ser criados/editados pelo usuário autorizado.

Esse bloqueio é prevenção de escrita pela aplicação, não revogação dos privilégios
do JWT: a proteção de acesso continua no Auth/RLS/RPC. Sem mudar banco ou papéis,
não é possível tornar um admin globalmente somente leitura em outros clientes.
Login/logout podem gerar sessões e logs normais no Auth. Não executar SQL.

Não trocar Site URL do Supabase. Login por senha dispensa nova redirect URL;
convites/recuperação permanecem desabilitados no pacote de validação.

## Homologação após publicar

1. Abrir a URL no mesmo navegador dos registros; verificar o aviso de validação.
2. Sem login, conferir Organograma e Escalas e agendas. Funções privadas pedem login.
3. Entrar com a conta confirmada e previamente autorizada, nunca enviar senha ao Codex.
4. Admin: Administração · Usuários > Atualizar lista; testar busca por e-mail exato.
   Alterações de acesso/convites devem falhar sem requisição de escrita.
5. Leader não deve acessar administração. Conferir histórico local e exportar backup.
6. Testes automatizados usam contas/dados fictícios e interceptam Supabase; o login
   real da conta do proprietário exige homologação pelo próprio usuário.

Rollback do código, se necessário, deve publicar um NOVO commit baseado na branch
de backup do Pages, preservando o histórico. Nunca reset/force-push nem restaurar
o armazenamento dos usuários automaticamente. Dados locais e cópias externas
precisam de recuperação independente do Git.

A evolução de datas e persistência de sessão está em [session-and-date.md](session-and-date.md).
O bundle do SDK e sua licença integram os 17 arquivos. A renovação de tokens Auth
é permitida no modo de consulta; escritas de dados/autorizações permanecem bloqueadas.
