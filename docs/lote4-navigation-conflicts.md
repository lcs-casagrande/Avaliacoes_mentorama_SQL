# Lote 4 — Navegação, conflitos e acessibilidade

Branch: `fix/navigation-conflicts-lote4`, diretório `/workspace/iasdpi-lote4`.
Base: árvore completa de `fix/mobile-lote3`, incluindo os trabalhos não commitados
dos Lotes 1–3. O diretório `/workspace/iasdpi-lote3` permanece intacto como rollback.
Não foi realizado commit, merge, push, publicação, SQL ou acesso a dados de produção.

## Diagnóstico e resultado

Arquitetura preservada: JavaScript sem framework, rotas por hash, frontend estático,
Supabase Auth/RLS e persistência operacional por `iasdpi_save_program`.
O identificador do registro, a versão esperada e a chave idempotente continuam
protegendo a gravação. Backend Python, SQL, agenda, organograma e backups não foram
modificados neste lote. Os 230 testes anteriores permanecem byte a byte iguais.

| Antes: problema confirmado | Depois |
| --- | --- |
| Navegações usavam `replaceState`: Início → Programações → Histórico mantinha o mesmo tamanho de histórico | Navegações distintas usam `pushState`; metadados, identificação do registro recém-criado e atualização da mesma página usam `replaceState` |
| Voltar/Avançar não representavam as páginas visitadas | Eventos `popstate` e `hashchange` coordenados; evento duplicado é ignorado; cancelamento restaura a entrada anterior sem reconstruir os campos |
| Link com ID ausente podia abrir um formulário novo | Mensagem explícita de registro não encontrado; não abre outro culto nem cria um registro |
| Conflito apresentava somente mensagem, sem comparação | Janela com versão do banco, versão local, campos divergentes, seleção individual e confirmação |
| Rascunho de versão antiga só podia ser consultado | Comparação explícita com a versão atual, mantendo desabilitada a restauração direta incompatível |
| Nomes dos campos de subatividades se repetiam | Nome acessível contém índice/título da atividade principal e da subatividade; atualizado ao editar, excluir ou recuperar rascunho |
| Três seletores não tinham dimensões e fonte padronizadas | Modelo, registro existente e referência usam altura mínima de 48 px, fonte de 16 px e espaçamentos iguais |
| Foco dourado e bordas claras tinham contraste insuficiente | Foco azul de 3 px, bordas mais escuras e placeholders legíveis; testes numéricos dos contrastes envolvidos |

Diagnóstico anterior: `dist/lote4/diagnostico-antes.json`. Comparativo do mesmo
fluxo com dados fictícios: `dist/lote4/comparativo.html`, oito capturas em 390 e
1024 px. Testes adicionais de layout cobrem 360, 390, 768, 1024 e 1440 px.

## Navegação e proteção de alterações

- Rotas diretas e recarregamento preservam página e ID. Rotas de criação não
  selecionam automaticamente o culto anterior. Login pelo formulário de um link
  privado mantém o destino solicitado após autenticação.
- A mesma navegação não cria entradas duplicadas nem reinicia o formulário.
  Atualizações intencionais — salvar, criar, pausar/iniciar acompanhamento —
  podem renderizar a mesma rota sem acrescentar histórico.
- Voltar, Avançar, menus e mudança manual do hash consultam a proteção existente
  de rascunhos. Cancelar mantém os campos; aceitar mantém recuperação local.
  O aviso nativo ao fechar/recarregar a aba continua ativo.
- Após salvar observações, a versão-base dos novos rascunhos acompanha a versão
  confirmada, inclusive na segunda edição do mesmo formulário.
- Link de pular para conteúdo move o foco sem transformar `#app` em outra rota.
  A página atual também é identificada por `aria-current` na navegação.

## Resolução segura de conflitos

1. O servidor ou adaptador rejeita a versão antiga; o formulário permanece aberto.
2. A comparação consulta o registro atual com autenticação e RLS. Nenhuma diferença
   vem selecionada. Campos alterados apenas no banco são preservados.
3. O usuário pode fechar, atualizar a comparação, carregar a versão do banco ou
   selecionar mudanças próprias. Todas as substituições exigem confirmação.
4. A versão é consultada novamente. Se mudou, a comparação é atualizada e as
   seleções são limpas. Não ocorre reaplicação sobre outra versão.
5. Antes de reaplicar, uma cópia anterior é cifrada no mecanismo de rascunhos do
   Lote 1, por usuário/escopo e com o prazo existente de 24 horas. O documento de
   envio rejeitado, quando disponível, é incluído dentro dessa cópia cifrada.
   Se a cópia persistente falhar, a reaplicação é bloqueada, preservando os campos.
6. Só o envio rejeitado correspondente, comprovadamente antigo, é retirado da fila
   local. Outros envios pendentes permanecem. Isso não faz gravação no banco.
7. O formulário carrega a base recente e recebe apenas a seleção. A confirmação
   visual informa **ainda não salvo**. É necessário clicar em Salvar; a gravação
   usa o mesmo ID, a nova versão esperada e a proteção de concorrência existente.

A edição prevista continua protegida após o início. Subatividades e atividades
extras legadas são comparadas pelos IDs. Inclusão/exclusão selecionada pode ser
reaplicada; mudanças de ordem exigem revisão manual, preservando a ordem recente.
Rascunhos antigos sem uma base original confiável mostram essa limitação e
exigem seleção manual de cada diferença. Não há mesclagem automática.

Precisão de horários não selecionados permanece na versão do banco. Quando um
horário original com frações é explicitamente selecionado, a precisão original
é preservada no rascunho/formulário e no próximo salvamento, sem exibir frações.
Metadados desconhecidos do modelo, da equipe e dos itens são preservados ao
salvar a programação prevista; campos editáveis continuam passando pela validação.

## Arquivos próprios do Lote 4

| Arquivo | Alteração |
| --- | --- |
| `frontend/navigation.js` (novo) | Histórico, rotas, cancelamento de travessia e foco |
| `frontend/conflicts.js` (novo) | Comparação, confirmação, seleção, revalidação e reaplicação local |
| `frontend/app.js` | Integração das rotas/conflitos, atualizações na mesma rota, registro ausente, foco e nomes acessíveis após alterações |
| `frontend/actuals.js` | Contexto acessível das subatividades, metadados de precisão e identificação da rota ao salvar |
| `frontend/drafts.js` | Comparação de rascunhos antigos, cópia cifrada adicional e reaplicação sobre a base atual |
| `frontend/operational.js` | Preservação do código de conflito e retirada restrita do envio rejeitado |
| `frontend/demo.js` | Código de conflito compatível e preservação de metadados na edição prevista |
| `frontend/styles.css` | Seletores, foco, contraste e janela de comparação responsiva |
| `frontend/index.html` | Carregamento dos dois módulos novos |
| `scripts/build_homologation.py`, `scripts/export_preview.py` | Inclusão dos módulos nos pacotes e na prévia |
| `tests/test_navigation_conflicts.py` (novo) | 38 cenários interativos com dados descartáveis |
| Este relatório | Evidências, limitações e homologação |

Outros arquivos já modificados no status Git pertencem aos Lotes 1–3 e foram
transportados sem descartar trabalho. Não foram adicionadas dependências.

## Verificação

**268 testes aprovados**, sem falhas nem testes ignorados: 230 anteriores e
38 novos deste lote. Execução final integral: 307,116 segundos.
Log: `dist/lote4/testes.log` (original: `/tmp/iasdpi-lote4-final.log`).
Sintaxe JavaScript e `git diff --check` também passaram.

A prévia HTML foi exercitada por HTTP local: salvar/reabrir, conflito seletivo,
organograma (nove anciões) e agenda, sem erros de execução e sem RPC de gravação
remota. O comparativo abriu suas oito imagens incorporadas e coube em 360 px.
Evidências: `dist/lote4/previa-verificacao.json` e `dist/lote4/integridade.json`.
Pacote estático revisável de 22 arquivos preparado em
`/tmp/iasdpi-lote4-pages-final`, com recursos versionados por conteúdo e sem
publicação. A configuração do pacote permite operação Supabase quando publicada;
a prévia independente bloqueia gravações remotas.

Execução reproduzível com PostgreSQL descartável já iniciado, sem rede:

    PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-lote4-pg-tests python -m unittest discover -s tests -v

Os 38 novos testes exercitam Chromium real com REST interceptado, duas contas e
contextos independentes. Cobrem Voltar/Avançar, links, reload, confirmação de saída,
rascunhos, conflitos no Registro/Resumo/Programação, seleção parcial, concorrência
após a comparação, microsegundos, fila de envios, revogação, falha de consulta e
de cópia local, teclado, nomes acessíveis, foco, HTML em texto e cinco larguras.
As regressões anteriores cobrem também criação, edição, acompanhamento, finalização,
backups, indicadores, autenticação e SQL/RLS em bancos PostgreSQL descartáveis.

## Prévia e homologação

Gerar a prévia independente com gravações remotas bloqueadas:

    python scripts/export_preview.py --read-only --output dist/IASDPI-lote4-previa.html
    python -m http.server 8000 --directory dist

Abrir `http://localhost:8000/IASDPI-lote4-previa.html`. Organograma e agenda são
públicos. As páginas privadas exigem uma conta autorizada; a prévia usa registros
locais e não grava cultos no Supabase. O comparativo visual abre sem login e não
consulta serviços externos. Não use a prévia local para registrar cultos reais.

1. Em dados descartáveis, abrir Registro; editar uma observação; usar Voltar e
   cancelar. Confirmar campo e URL. Repetir aceitando; Avançar e recuperar rascunho.
2. Recarregar um link com ID; confirmar o mesmo registro. Abrir ID inexistente;
   confirmar mensagem sem formulário novo. Testar também modelo Livre.
3. Em ambiente de testes autorizado, abrir o mesmo culto em dois dispositivos.
   No primeiro salvar uma nota. No segundo editar outro campo e salvar: conferir
   ambas as versões, selecionar só a alteração desejada e confirmar.
4. Confirmar que a comparação não grava. Revisar o formulário reaplicado e clicar
   em Salvar. Reabrir e conferir o mesmo ID, campos do outro usuário e horários.
5. Alterar novamente pelo outro dispositivo enquanto a comparação está aberta;
   confirmar nova comparação sem seleções automáticas. Repetir com rascunho antigo.
6. Testar com Tab/Shift+Tab, Enter, setas e Escape. Conferir o foco ao fechar a
   comparação, seletores, subatividades com títulos iguais e a tabela no celular.
7. Em Android/iPhone reais, confirmar barra de salvamento, teclado virtual, área
   segura e deslocamento horizontal restrito à tabela de comparação.

## Riscos e limitações restantes

- Não foram acessados registros reais do Supabase. A integração de navegador usa
  REST simulado; as permissões existentes são verificadas em PostgreSQL isolado.
- Chromium disponível; Safari, Firefox, leitor de tela e dispositivos físicos
  permanecem para homologação. Não se declara conformidade WCAG completa.
- Mudanças estruturais complexas, especialmente reordenação e campos removidos
  pela versão recente, requerem revisão manual. A cópia local antiga permanece
  consultável; não é reaplicada automaticamente.
- Rascunhos são recuperação temporária, dependem do navegador e expiram em 24h.
  Criptografia local não protege contra XSS nem acesso ao perfil do navegador.
- Abertura `file://` é bloqueada neste ambiente; a prévia é verificada por HTTP.
- Não há migração SQL neste lote. Nenhuma permissão ou proteção do banco muda.
- Rollback: preservar a árvore original do Lote 3. A entrega permanece sem commit;
  não trocar para ela por `reset --hard` ou descartar alterações pendentes.
- Lote 5 não iniciado. Publicação, commit e merge dependem de autorização futura.

Commit sugerido, sem execução: `fix: corrige navegação, resolução de conflitos e acessibilidade`.
