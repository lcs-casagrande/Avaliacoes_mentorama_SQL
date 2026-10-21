# Datas dos cultos e sessão persistente

## Dados existentes: correção explícita de um único registro local

O Pages atual usa `iasdpi-demo-v1` no localStorage para cultos, planos, horários,
extras e histórico. O Codex não tem acesso ao navegador do proprietário. Não foi
localizado nem alterado remotamente o registro real de 03/10/2026. Arquivos no
Supabase são cópias independentes; esta atualização não os altera nem executa SQL.

No MESMO navegador que contém os dados:

1. Entrar e baixar um backup em Arquivo e banco antes de corrigir.
2. Histórico > Ver resumo do culto identificado como 03/10/2026.
3. Conferir correção para 10/10/2026. A janela mostra origem local, nome, ID,
   quantidade de atividades/extras, dados completos atuais e prévia das atividades.
4. Conferir que é o registro desejado, com as 16 atividades esperadas. Cancelar se
   houver qualquer dúvida; nada é alterado ao abrir ou cancelar a janela.
5. Confirmar correção deste registro. O ID e a quantidade de cultos permanecem iguais.
6. Conferir resumo, histórico, horários, responsáveis e observações e baixar novo backup.

O mecanismo modifica somente a data lógica do registro selecionado, datas dos
timestamps planejados/realizados e eventual data explícita no nome. Horas, minutos,
segundos, fuso, atividades, IDs internos, responsáveis, notas, ocorrências, extras
e status permanecem. A versão de concorrência aumenta em 1. IDs de modelo que
contêm `03102026` são identificadores internos, não a data exibida, e não são
renomeados para não romper referências dos horários.

Datas reais que já forem 10/10 são mantidas. Timestamps de outros dias ou dados
inválidos bloqueiam a correção para revisão, sem alteração do registro. A prévia
possui comparação integral com o registro relido no momento da confirmação: se
outra aba mudou qualquer campo, exige nova conferência. Repetir a correção num
registro já corrigido é bloqueado. Outros cultos não são excluídos ou mesclados.

Antes de salvar, é preservada uma cópia do registro original na chave local
`iasdpi-date-correction-backups-v1`, mantendo as cópias anteriores dessa chave.
As chaves de segurança e pré-restauração existentes não são substituídas por essa
correção. Se não houver espaço para guardar a cópia, a alteração não prossegue.
O backup exportado inclui os registros atuais e esse histórico bruto de segurança
em `dateCorrectionBackupsRaw`; ele não é restaurado ou aplicado automaticamente.
Essa cópia local NÃO substitui um backup externo. Nenhum token de Auth é exportado.

Se o culto existir apenas num arquivo Supabase, consultar/exportar sua cópia antes
de qualquer procedimento. A correção nesta interface atua exclusivamente no local;
não sobrescreve arquivos remotos, não cria outra versão remota e não restaura nada
automaticamente. Uma eventual correção de arquivo remoto exige decisão separada.

## Modelo padrão: data obrigatória

Registrar culto inicia por um campo de data vazio e obrigatório. O modelo privado
é carregado após a escolha; suas atividades são preservadas num clone com a data
escolhida. Ao salvar, os timestamps planejados e realizados, cabeçalhos, resumos,
histórico e relatórios usam essa mesma data. O modelo Supabase não é regravado.
Abrir a criação não cria registros, não reabre automaticamente um culto anterior
e não copia seus horários realizados. Para editar um culto existente, abrir seu
resumo e selecionar Editar registro.

## Sessão no celular

A implementação anterior fazia login REST manual, mantinha o token apenas em memória
e encerrava a sessão com temporizador de expiração, sem renovação. Recarregar/fechar
a aba perdia a sessão; voltar ao celular após a expiração exigia a senha novamente.

Agora existe um único cliente `@supabase/supabase-js` 2.118.0 por página, com:

- `persistSession: true`, `autoRefreshToken: true`, recuperação por `getSession`;
- `onAuthStateChange`, callback síncrono sem chamadas Auth dentro do lock do SDK;
- início/pausa da renovação conforme visibilidade e revalidação ao voltar à aba;
- `detectSessionInUrl: false`: este login é por senha, não OAuth; tokens colados
  em fragmentos de URL não são importados. Sessões existentes são recuperadas do SDK;
- chave de sessão `iasdpi-supabase-auth-v1`, com namespace separado na homologação;
- estado visível de recuperação, falha de conexão/autorização e sessão expirada;
- saída explícita por `signOut({scope:'local'})`, sem revogar outras sessões;
- consulta de usuário e de `iasdpi_access` antes de cada operação privada.

Access token e refresh token normais são persistidos e rotacionados pelo SDK em
seu formato padrão. A aplicação não implementa armazenamento manual de tokens,
não guarda senha, service_role, sb_secret nem papéis confiáveis no navegador.
O perfil admin é sempre conferido no servidor/RLS; persistência de identidade não
confere acesso a conta revogada. Falha de rede bloqueia operações privadas sem
apagar os cultos nem executar signOut automaticamente ao navegar.

O pacote mantém Supabase somente para login/renovação/logout e consultas. RPCs de
escrita, convites e arquivamento continuam bloqueados. Auth pode gerar sessões e
logs normais. Nenhuma política, tabela ou autorização é alterada nesta atualização.

No Chrome do celular: entrar uma vez, abrir Histórico, recarregar a página, fechar
e reabrir a aba no mesmo perfil, sair e voltar ao Chrome após algum tempo. A sessão
deve recuperar/renovar sem senha enquanto o refresh token for válido. Ao usar Sair,
reabrir deve pedir login, mantendo os cultos. Aba anônima, limpeza de dados do site,
revogação do token no servidor ou políticas do navegador podem impedir persistência.
Não limpar os dados do site para atualizar o código: fazer apenas uma recarga.

## SDK e verificações

Bundle UMD e licença MIT foram copiados do pacote npm versionado, após conferência
de integridade SHA-512 do tarball. Sem CDN ou instalação em tempo de execução.
SHA-256 `frontend/supabase-2.118.0.js`:
`ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`.

Os testes usam dados fictícios, Supabase interceptado e armazenamento isolado.
Cobrem recarga, refresh com token expirado, revogação, logout, modelo em nova data,
16 atividades/segundos/notas/extras, preservação de outro culto e de backups,
cancelamento, concorrência, idempotência e bloqueio de escritas remotas.
O login real e os registros do proprietário precisam de conferência no seu celular.

## Arquivos desta atualização

- Frontend: `frontend/auth.js`, `frontend/actuals.js`, `frontend/app.js`,
  `frontend/demo.js`, `frontend/archive.js`, `frontend/index.html`,
  `frontend/storage.js`, `frontend/styles.css`.
- SDK novo: `frontend/supabase-2.118.0.js`, `frontend/supabase.LICENSE`.
- Integração: `backend/server.py` (somente allowlist estática do SDK/licença),
  `scripts/build_homologation.py`, `scripts/export_preview.py`.
- Testes: `tests/test_frontend_access.py`, `tests/test_homologation.py`,
  `tests/test_pages_release.py`.
- Documentação: `docs/access-control.md`, `docs/homologation.md`,
  `docs/pages-release.md`, `docs/session-and-date.md`.

Pacote preparado em `dist/pages-session-date-final/`, com 17 arquivos estáticos,
sem backend, SQL ou bancos. Os backups Git existentes foram conferidos e mantidos.
Nesta etapa não houve commit, push, publicação ou acesso autenticado ao banco real.
