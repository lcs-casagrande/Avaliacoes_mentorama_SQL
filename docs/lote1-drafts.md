# Lote 1 — rascunhos e sessão

Base: main a26edac0ca11ae51b8c2463febcc8e0fb5058b74. Comparação com a auditoria
45aa73b: somente frontend/agenda-data.js mudou, por sincronização automática.
Os três formulários e a autenticação continuavam com as falhas auditadas.
Implementação isolada em /workspace/iasdpi-lote1, branch fix/drafts-lote1.
O diretório original /workspace/IASDPI e seus trabalhos pendentes foram preservados.

| Item | Informação |
|---|---|
| Problema | Edição não salva desaparecia ao perder sessão, navegar ou recarregar. Planejamento e observações do resumo não tinham proteção de saída. |
| Causa | Somente o formulário de execução mantinha um booleano em memória. A invalidação da autenticação limpava o estado, sem persistir um rascunho. |
| Solução | Serviço reutilizável para os três formulários, snapshots estruturados, restauração explícita após verificar identidade, escopo por conta/registro/formulário/aba, expiração e limpeza no logout. |
| Arquivos | frontend/drafts.js, app.js, actuals.js, auth.js, index.html, styles.css; scripts/build_homologation.py, export_preview.py; tests/test_drafts.py; este relatório. |
| Testes | 20 regressões novas de navegador. A suíte completa inclui também backend, pacotes, permissões e PostgreSQL 17 descartável sem rede. Resultado final: 167 testes aprovados (147 existentes + 20 novos), sem falhas ou testes ignorados. |
| Resultado | Lote 1 implementado. Nenhuma gravação de produção, migração, commit, push ou publicação. |
| Riscos | Recuperação restrita a este navegador; depende de armazenamento disponível. Criptografia local não protege contra XSS, scripts maliciosos da mesma origem ou acesso ao perfil do navegador. |

## Funcionamento e segurança

- Dados são cifrados com AES-GCM e chave aleatória por usuário e escopo.
  A chave Web Crypto não é exportável e fica no IndexedDB. Não há senhas,
  access_token, refresh_token ou chaves administrativas nos snapshots.
- A aplicação continua dependendo de Supabase Auth e RLS. A cópia local é apenas
  recuperação de edição; não é banco operacional nem confirmação de salvamento.
- A origem, o caminho, o projeto, o modo de armazenamento, a conta, o tipo de
  formulário e o ID do registro delimitam os rascunhos. Abas têm chaves distintas.
  Outra conta não recebe os controles ou o conteúdo do rascunho anterior.
- A interface confirma novamente o acesso antes de decifrar/restaurar. Uma conta
  revogada não pode recuperá-lo. Em caso de falha temporária ou expiração da
  sessão, o conteúdo continua cifrado para recuperação após reautenticação.
- O usuário escolhe Recuperar rascunho. Se a versão do registro mudou, somente a
  consulta está disponível; não há aplicação automática sobre a versão nova.
  Comparação e mesclagem assistida continuam reservadas ao Lote 4.
- Preservam-se valores dos controles, horários editados e metadados dos horários
  originais, IDs, ordem e subatividades. A restauração não dispara gravação remota.
- Salvar remove apenas revisões confirmadas. Uma edição posterior ao envio
  permanece como rascunho. Uma criação confirmada associa o rascunho ao novo ID,
  inclusive antes de uma segunda operação de alteração de status.
- Navegar preserva um rascunho após confirmação. Cancelar edição descarta apenas
  as mudanças locais confirmadas pelo usuário. Sair da conta informa que todos
  os rascunhos desse usuário neste escopo serão removidos, incluindo outras abas.
  O outbox operacional anterior e as chaves locais antigas não são apagados.
  Essa fila anterior mantém seu formato existente e não recebe a criptografia
  nova dos rascunhos; não se afirma que todas as cópias locais são cifradas.
  Se o navegador impedir a remoção no logout, a sessão é encerrada e o usuário
  recebe orientação para limpar os dados do site em dispositivo compartilhado.
- Validade de 24 horas desde a última alteração; rascunhos expirados são recusados
  e removidos na próxima consulta do armazenamento. Não há garantia de apagamento
  físico enquanto o navegador estiver fechado.
- Quando IndexedDB não funciona, a cópia cifrada fica apenas na memória da aba.
  A interface informa que recarregar ou fechar pode perdê-la. A confirmação do
  servidor continua sendo necessária.
- Captura ocorre nos eventos de edição, mudanças estruturais, navegação e
  visibilidade. Fechamento abrupto do sistema antes da conclusão da escrita,
  exclusão dos dados do navegador ou comprometimento do dispositivo não são
  cenários de recuperação garantida.

## Verificação

Somente contas e registros fictícios; REST interceptado nos testes de navegador.
Testes SQL usam um contêiner com --network none, recusando outra configuração.
Sem sessão autorizada de produção: não foi comprovado o comportamento do projeto
Supabase real. Não foram executados SQL, alterações de RLS ou mudanças de dados
nesse projeto. Firefox não está instalado; testes visuais usam Chromium.

Os 20 casos novos cobrem: reautenticação; expiração; reload; nova aba; duas abas;
cancelamento de navegação; Registro/Programações/Resumo; subatividades e precisão
original; confirmação de salvamento; edição posterior ao envio; duas contas;
revogação; cancelamento e confirmação de logout; cifra/chave; TTL; versão
divergente; IndexedDB indisponível; larguras 360/390/768/1024/1440; falha de limpeza no logout; e pacote HTML.

Com PostgreSQL descartável já disponível:

    PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-lote1-pg-tests python -m unittest discover -s tests -v

Log final: /tmp/iasdpi-lote1-verified.log. Execução completa: 184,118 segundos.
O HTML independente também foi exercitado via HTTP local no Chromium.
A abertura direta file:// é bloqueada pela política do navegador deste ambiente,
portanto não foi validada nesse modo.

## Revisão e futura implantação

Prévia independente segura para revisão:

    python scripts/export_preview.py --read-only --output dist/IASDPI-lote1-previa.html

Essa prévia usa modo local e bloqueia gravações remotas, inclusive administração
e arquivamento; não representa gravação operacional no Supabase. Não embute dados
reais. A autenticação e as consultas permitidas dependem de conta autorizada.

Após revisão e autorização, publicar o bundle completo, incluindo drafts.js.
O gerador scripts/build_pages.py já inclui esse recurso e seus hashes de cache.
Nenhuma migração SQL ou configuração nova de segredo é necessária.
Rollback: voltar ao bundle anterior completo. O IndexedDB de rascunhos é novo;
registros operacionais e chaves locais antigas permanecem intactos.

Próximo lote: backup/compatibilidade, estados de carregamento e indicadores.
Não foram implementadas correções dos Lotes 2–5 nem novos módulos de gestão.
