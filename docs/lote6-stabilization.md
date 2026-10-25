# IASDPI — Lote 6: estabilização e correção de bloqueantes

Data: 23/10/2026 16:01:37, America/Sao_Paulo. Branch: `fix/stabilization-lote6`.

## Parecer

**Apta com ressalvas.** Os bloqueantes reproduzidos na homologação dos Lotes 1–5 foram corrigidos na nova candidata. Resultado final: **338 testes por execução (307 existentes + 31 novos), três execuções completas**, sem retries automáticos. O procedimento de publicação exige o pacote anterior completo e a retenção dos recursos das versões anteriores. Auth/SMTP/RLS do Supabase instalado e dispositivos não disponíveis continuam com as ressalvas descritas abaixo; não foram homologados remotamente neste lote.

Não houve commit, merge, push, deploy, SQL em produção, envio de e-mail nem escrita em registros reais. Nenhuma migração foi criada. Os 82 arquivos inventariados do worktree `/workspace/iasdpi-lote5` foram preservados byte a byte; as correções estão somente no novo worktree. A candidata anterior reprovada não foi publicada. O código testado permaneceu congelado durante as três execuções finais.

## 1. Diagnóstico e soluções

### B1 — Recursos de versões diferentes durante atualização

**Causa:** `?v=hash` em nomes fixos não preserva o conteúdo anterior no servidor. O HTML publicado não inclui os módulos adicionados nos lotes; quando recebe um `app.js` novo por um caminho antigo, tenta usar `IASDPINavigation` sem que esse módulo tenha sido carregado. Um simples global vazio ou ajuste de ordem não resolveria a mistura dos demais componentes.

**Solução:** o gerador concatena o código existente, na ordem atual, em um bundle completo; publica-o em `assets/app-<SHA-256>.js`. CSS e carregador também usam nomes imutáveis pelo conteúdo. O HTML e o carregador fixam SRI (`integrity`, SHA-256), bloqueando conteúdo incorreto em um caminho esperado. Não há framework, minificador ou dependência de build nova.

O primeiro salto preserva os aliases JS/CSS do Pages já publicado, vindos de `--previous-site`, para que HTML antigo continue executando sua versão completa. Nas atualizações seguintes, o gerador retém recursos imutáveis anteriores. Isso é necessário também no rollback: apenas criar novos nomes sem preservar os caminhos antigos não resolveria o primeiro salto.

`frontend/release-loader.js` oferece mensagem explícita de falha, **Tentar novamente** quando o script não executou e recarga segura para falhas que exigem reiniciar o documento. Não duplica clientes Supabase nem executa novamente um bundle parcialmente inicializado. Antes da recarga, solicita `IASDPIDrafts.flush()` quando disponível; uma falha de preservação impede a recarga automática. Não limpa localStorage, IndexedDB, sessões ou rascunhos. Se o próprio carregador falha, o HTML ainda apresenta orientação/link de recarga.

A Agenda continua como `agenda-data.js`, **dado público mutável separado do código**. O workflow existente pode continuar atualizando esse arquivo; não foi alterado. O manifesto declara `mutable_assets`. O gerador usa a agenda do pacote anterior por padrão, evitando substituí-la pelo snapshot local mais antigo. A integridade imutável/SRI não é aplicada a esse dado público que deve poder mudar independentemente do código. A interface continua identificando a fonte e a data do snapshot.

Uma falha de CSS anterior à execução do carregador pode produzir um objeto `sheet` vazio no Chromium; o teste inicial encontrou isso. A verificação usa agora um marcador CSS no recurso gerado, além dos eventos de erro, para confirmar que os estilos da versão realmente carregaram. O marcador não altera a apresentação.

### B2 — Restauração concorrente do histórico

**Causa:** `popstate` e `hashchange` do mesmo deslocamento eram tratados como novas travessias; durante o retorno de uma saída cancelada, outro `history.go` podia ser enfileirado antes de concluir o anterior. Os saltos adicionais explicam os percursos inesperados e o timeout após confirmar o Avançar seguinte.

**Solução:** `popstate` é a fonte da travessia e das mudanças de fragmento nos navegadores modernos. Há somente uma restauração em trânsito; eventos intermediários não iniciam outro `go`. O estado atual e o formulário permanecem intactos quando a saída é cancelada. Entradas continuam sendo criadas com `pushState` para navegação, e `replaceState` somente para identificar/restaurar a entrada apropriada. Não há `setTimeout`, sleep ou pausa artificial para resolver a corrida.

A proteção de alterações e o mecanismo de rascunhos existentes foram mantidos. `IASDPINavigation.pending()` é uma observação do estado, utilizada nos testes, sem permitir modificar a restauração.

### P6 — Novo registro imediatamente após login

**Causa confirmada:** autorização e prontidão da tela são estados diferentes. O menu já podia estar visível com `IASDPIAuth.allowed() === true`, enquanto `state.busy` e `bootInProgress` ainda estavam ativos. O handler antigo usava `guarded`, que retornava sem executar o clique. O teste original esperava apenas autorização, tornando o defeito intermitente.

Um controle executado no pacote completo do Lote 5, com consulta retida por um mock, confirmou: antes do clique `busy=true`, `boot=true`; após liberar a consulta, permaneceu em Início sem abrir `new-record-form`, sem erro de console. Evidência: `root-cause-login-control.json`.

**Solução:** a última intenção de navegação é preservada durante carregamento/operação e executada uma vez ao concluir. Somente navegação é enfileirada: não há reenvio automático de criação, salvamento ou finalização. A intenção privada é descartada quando o acesso é perdido. Chamadas concorrentes de `boot()` compartilham a mesma Promise, em vez de retornar prematuramente. O teste original não teve timeout aumentado nem espera adicional para esconder a falha.

## 2. Arquivos alterados especificamente no Lote 6

| Arquivo | Mudança |
| --- | --- |
| `frontend/navigation.js` | Uma restauração por travessia, sem processamento duplicado de hashchange |
| `frontend/app.js` | Preservação da intenção de navegação e boot compartilhado |
| `frontend/release-loader.js` | Novo carregador com SRI, falha explícita e recuperação segura |
| `scripts/build_homologation.py` | Bundle/CSS/carregador imutáveis, aliases legados, retenção e preparação de rollback |
| `scripts/build_pages.py` | `--previous-site` e `--rollback-site`; somente preparação local |
| `tests/test_homologation.py` | Atualização da asserção do pacote para incluir recursos gerados no subdiretório assets; nenhum caso removido |
| `tests/test_stabilization.py` | 31 novos testes de regressão, carregamento, versões, login e navegação |
| `tests/fixtures/pages-2ca4ebd.zip` | Snapshot somente dos assets públicos do Pages para regressão com a versão anterior real |
| `docs/lote6-stabilization.md` | Este relatório e procedimento de homologação/publicação |

Os arquivos acumulados dos Lotes 1–5 continuam presentes na árvore de trabalho. O HEAD `a26edac0ca11ae51b8c2463febcc8e0fb5058b74` sozinho não contém essas mudanças sem commit. Não foi gerado um novo commit. O inventário testado de 85 arquivos está em `dist/lote6/tested-source.json`, SHA-256 do inventário canônico: `3c2eeebd3a120ac9ba8b88008632d3877190947ccf1b3d61b11aa3ff610b6ca2`.

## 3. Testes e resultados finais

Comando: `PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-lote6-pg python -m unittest discover -s tests -v`.

| Execução completa | Aprovados | Falhas/erros | Ignorados | Tempo de processo | Retries automáticos |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 338/338 | 0 | 0 | 341.105 s | 0 |
| 2 | 338/338 | 0 | 0 | 345.426 s | 0 |
| 3 | 338/338 | 0 | 0 | 340.040 s | 0 |

Os 45 casos SQL usam PostgreSQL 17 descartável, sem rede/portas publicadas. A infraestrutura Auth de testes é uma fixture; não representa execução no Supabase real. O navegador utiliza Chromium com Auth/REST interceptados e registros fictícios, sem modificar os cultos de 10/10 ou 22/10. Backups, indicadores, permissões, rascunhos cifrados, conflitos, PKCE e os fluxos integrados anteriores estão incluídos na regressão.

Um smoke adicional usou os arquivos exatos da candidata: criou um culto descartável com a data atual, preencheu as 16 atividades, adicionou uma subatividade, salvou, recarregou e finalizou o mesmo ID (versão 3). O registro ficou completo, com desvio zero real, e apareceu no Histórico filtrado como 1 de 2 cultos fictícios. O download cifrado de backup também funcionou. Não houve pageerror nem console.error nesse percurso; evidência em `integrated-smoke.json`. Todas as operações Auth/REST foram simuladas, não gravadas no Supabase real.

### Tentativas rápidas do cenário anteriormente falho

| Execução | Resultado | Retries | Pausas artificiais |
| --- | ---: | ---: | --- |
| 1 | 100/100 | 0 | Não |
| 2 | 100/100 | 0 | Não |
| 3 | 100/100 | 0 | Não |

Total final: **300/300 tentativas**, distribuídas entre três suítes. Cada tentativa abre Registro → Histórico → Voltar, edita a nota, Avança e cancela, preserva o texto, Avança e confirma, verifica Histórico sem entradas extras e confirma que o documento remoto fictício não mudou. Usa esperas por estado/elemento, sem sleeps. Há ainda testes da quantidade de chamadas `history.go`, fragmentos cancelados repetidamente e as regressões originais de links diretos, recarga e rascunhos/conflitos.

### Histórico de falhas de desenvolvimento, sem ocultação por retry

Não houve retry automático por caso. Antes das três suítes finais, o primeiro grupo de 26 testes novos terminou com **21 aprovados, 2 falhas e 3 erros**. Os achados foram registrados: validação de CSS com `sheet` vazio precisava do marcador; duas asserções liam o rascunho antes de terminar a descriptografia; e duas instrumentações Playwright precisavam retornar `undefined`, evitando aguardar o boot retido ou invocar acidentalmente uma função de navegação. Foram corrigidos código/testes antes de repetir o grupo. Uma repetição isolada da asserção de rascunho também falhou antes dessa correção de espera.

Depois disso, o grupo de 26 passou; foi ampliado para 31 e passou antes do congelamento e das três execuções completas. Logs das etapas intermediárias estão em `dist/lote6/desenvolvimento`; não são contabilizados como execuções finais aprovadas. As falhas anteriores da homologação 1–5 continuam preservadas em seu relatório original.

## 4. Combinações de versões e recuperação

| Cenário executado em Chromium | Observado |
| --- | --- |
| HTML publicado antigo com pacote novo | Aliases originais preservados; Organograma e Agenda funcionam sem IASDPINavigation ausente |
| HTML novo com bytes do JS antigo sob URL do bundle novo | SRI bloqueia execução; mensagem/retry aparecem; após restaurar o recurso, abre normalmente |
| Carregador incompatível ou indisponível | SRI impede execução incompatível; fallback estático de recarga permanece acessível |
| Aba aberta durante atualização | Formulário e nota permanecem; após recarga explícita, rascunho cifrado é recuperável |
| Recarga durante publicação com bundle novo ausente | Erro explícito; rascunho e armazenamento anterior preservados; recurso restaurado e retry recuperam formulário/rascunho |
| HTML anterior retido em cache após atualização | Executa o bundle completo anterior, que foi retido; navegação funciona |
| Rollback com HTML novo ainda em cache | Recursos novos retidos permitem executar sua versão completa |
| Nova abertura após rollback para a versão publicada | Executa o HTML/aliases originais e abre Agenda/Organograma |
| Rascunho novo seguido de rollback e nova atualização | O rollback não apaga a cópia cifrada; volta a ser recuperável após retornar à versão com suporte |
| Arquivos de aliases parcialmente trocados | O HTML novo usa o bundle imutável e não executa aliases incompatíveis |
| Falha temporária de bundle ou carregador | Nova tentativa/recarga explícita; sem limpeza de storage nem gravação remota |
| Falha de CSS ou agenda pública | Estado de recuperação explícito; nenhuma alteração nos documentos operacionais |
| Pacote anterior corrompido ou dependência legada ausente | Preparação recusa o recurso inconsistente antes de gerar a candidata |

Os testes verificam preservação dos documentos fictícios e ausência de `pageerror`. Falhas de rede/SRI injetadas geram mensagens esperadas no console e são verificadas como bloqueios seguros; não se afirma console vazio nesses cenários deliberados. Nos fluxos normais e no smoke do pacote exato, não foram observadas exceções JavaScript inesperadas.

## 5. Prévia e compatibilidade

- `dist/lote6/IASDPI-previa-lote6.html`: HTML independente atualizado, gerado por `scripts/export_preview.py --read-only`. Remoto em modo de consulta, dados de demonstração locais. Não é a candidata operacional e não substitui o Supabase.
- O navegador gerenciado bloqueou a tentativa de abrir `file://` com `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Não foi contornado. O mesmo HTML foi validado por HTTP local: login simulado, criação Liturgia I com 16 atividades, data atual e nenhum pageerror. A abertura por duplo clique no navegador do usuário permanece para homologação manual.
- Pacote operacional exato testado localmente em 12 telas × larguras **360, 390, 768, 1024 e 1440 px**, com textos longos, sem estouro horizontal global. Há capturas em `dist/lote6/capturas`.
- Chromium headless 151.0.7922.173 em Linux. **Não testados:** Google Chrome proprietário, Firefox, Safari/WebKit, Android/iPhone/tablets físicos, leitores de tela ou teclado virtual real. Não há declaração de compatibilidade ou certificação WCAG completa nesses ambientes.

## 6. Segurança, integridade e pendências

- Auth, SDK e arquivos SQL 001–004 não foram alterados. As chaves e IDs de registros, modelos, horários/frações, responsáveis e observações não foram migrados ou normalizados por este lote.
- Nenhuma chamada a contas/cultos reais, criação/revogação de autorizações, SQL ou e-mail em produção. Somente consultas GET à configuração/build público do GitHub Pages foram usadas na preparação.
- Candidata contém apenas assets públicos estáticos. Backend Python/SQLite, arquivos SQL, `.env`, bancos, testes e fixture ZIP não integram o deploy. Configuração mantém URL/chave publishable; nenhuma chave administrativa.
- Rascunhos cifrados foram preservados. A fila operacional de envios pendentes em IndexedDB continua sendo mecanismo separado e não cifrado; não foi apagada nem alterada neste lote.

| Pendência/risco | Classificação | Tratamento |
| --- | --- | --- |
| Usar pacote anterior completo, preservar aliases e recursos imutáveis | **Bloqueante se ignorado no deploy** | A candidata entregue foi gerada com `--previous-site` e `legacy_compatibility_ready=true`; conferir todos os hashes antes de publicar |
| Código dos lotes ainda sem commit | **Bloqueante no procedimento de release** | Revisar diff e produzir commit apenas após autorização; regenerar pacote a partir desse commit |
| Auth/SMTP/redirect URLs e RLS autenticada do projeto real não testados neste lote | **Importante** | Manter verificações/configurações manuais pendentes da homologação anterior; não anunciar recuperação de senha real como homologada sem teste autorizado |
| Firefox/Safari, dispositivos físicos e abertura por duplo clique | **Importante** | Homologar manualmente; não inferir compatibilidade apenas pela viewport |
| Retenção de recursos antigos faz o diretório assets crescer | **Melhoria futura** | Definir política de retenção depois; não podar recursos nesta publicação/rollback |
| Histórico de 1.000 cultos continua com renderização longa | **Melhoria futura** | Não otimizado neste lote; métricas renovadas em performance-run-1/2/3.json, sem mudança estrutural |
| Fila local não cifrada em perfis compartilhados | **Importante** | Limite preexistente; avaliar uso compartilhado sem descartar envios pendentes |

## 7. Plano de publicação e rollback — não executado

O Pages consultado continua publicando `gh-pages`, raiz `/`, em:
https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/

Último build consultado: `2ca4ebdf5a0d7ce2a1a2fb13cf8095a2b332b860`, status `built`. Esse é o site anterior, não um deploy do Lote 6.

1. Homologar a prévia e as ressalvas necessárias ao escopo. Após autorização, revisar/adicionar a árvore completa dos lotes e criar o commit. Não publicar o HEAD antigo isoladamente.
2. Obter uma cópia completa e conferida do Pages então publicado, incluindo assets imutáveis de releases anteriores e a agenda mais recente. Coordenar a janela com o workflow de agenda para evitar pushes concorrentes; não mudar dados ou permissões Supabase.
3. Gerar em diretório novo: `python scripts/build_pages.py --output dist/pages-candidata --previous-site CAMINHO_DO_PAGES_ATUAL`. Não usar saída de build sem pacote anterior como publicação sobre o site existente; o gerador a identifica como sem compatibilidade legada conferida.
4. Conferir manifesto, hashes de todos os arquivos, `legacy_compatibility_ready=true`, URLs relativas, nomes/SRI, chaves somente públicas e exclusão de backend/bancos. Testar cliente novo e HTML em cache antes do push.
5. Publicar somente o pacote estático completo em `gh-pages` após autorização. Não trocar aliases antigos por fontes novos nem remover assets retidos. Confirmar o build e a URL. Não há SQL, migração, recadastro de admin ou exportação manual recorrente do navegador para este lote.
6. Testar público, login e permissões; gravação operacional somente em culto descartável previamente autorizado. Não usar os cultos reais de 10/10/2026 ou 22/10/2026 como teste de escrita.

**Rollback preparado:** `python scripts/build_pages.py --output dist/pages-rollback --rollback-site CAMINHO_DA_VERSAO_ANTERIOR --previous-site CAMINHO_DO_PAGES_ATUAL`. Essa composição restaura o HTML/aliases anteriores, retém os recursos imutáveis atuais para abas em cache e conserva a agenda mais recente. Publicar por novo commit de reversão aprovado, conferir build e navegar com os dois estados de cache. Não usar exclusão simples do diretório assets nem apenas sobrescrever com um ZIP antigo incompleto.

Rollback de frontend não desfaz gravações no Supabase e não restaura storage, rascunhos ou backups automaticamente. Uma aba já executando código antigo não recebe atualização forçada. Versões anteriores sem suporte a rascunhos não passam a oferecer essa funcionalidade retroativamente; campos ainda só em memória seguem a proteção de saída da versão em execução.

## Entrega para revisão

- `IASDPI-lote6-candidata.zip`: nova candidata operacional preparada, não publicada.
- `IASDPI-lote6-rollback.zip`: rollback composto com retenção dos recursos da candidata.
- `IASDPI-previa-lote6.html` / `.zip`: prévia independente, remoto somente consulta.
- `regression-summary.json`, três logs completos, três arquivos das 100 tentativas, inventários SHA-256, controles de causa e capturas.

**Apta com ressalvas. Desenvolvimento encerrado neste lote para revisão.** Nenhum Lote 7, commit, merge ou publicação iniciado. Sugestão de commit futura, somente após aprovação: `fix: estabiliza atualizações e navegação do IASDPI`.
