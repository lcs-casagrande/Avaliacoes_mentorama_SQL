# Lote 5 — Histórico e melhorias complementares

Branch `fix/history-complementary-lote5`, diretório `/workspace/iasdpi-lote5`.
Base: árvore completa de `fix/navigation-conflicts-lote4`, incluindo alterações
não commitadas. `/workspace/iasdpi-lote4` permanece intacto para rollback.
Os 268 testes anteriores foram preservados byte a byte. Não houve acesso a
registros de produção, envio real de e-mails, alteração de configuração do
Supabase, SQL em produção, commit, merge ou publicação.

## Diagnóstico e correções

| Achado confirmado antes | Implementação |
| --- | --- |
| Histórico mostrava todos os finalizados, sem período ou pesquisa | Pesquisa por nome sem distinguir acentos, data brasileira/ISO e período inclusivo; filtros combináveis e limpeza |
| Indicadores do Histórico usavam sempre toda a lista | Todos os indicadores, medianas e transições recebem o mesmo recorte; período e contagens explícitos |
| Ausência de resultados poderia ser confundida com consulta malsucedida | Estados do Lote 2 preservados: carregando, erro com nova tentativa, lista vazia e nenhum resultado filtrado |
| Login sem recuperação de senha | Solicitação por e-mail, callback PKCE, definição da senha e mensagens para link ausente, inválido, expirado ou utilizado |
| Modelos localizados apenas em Arquivo e banco | Administração · Modelos e botão Gerenciar modelos em Programações; mesmo formulário e mesmo RPC existentes |
| Aviso da fonte oficial também aparecia nas escalas manuais | Origem identificada por área; Comunicação e Sonoplastia explicitamente manuais, sem atualização ou vigência inventadas |
| Formatação de horários recriava objetos Intl muitas vezes | Reutilização de três formatadores com America/Sao_Paulo, sem cache de registros nem alteração dos valores |

A arquitetura foi preservada: JavaScript sem framework, frontend estático,
Supabase Auth/RLS e banco operacional. Não há novo cadastro paralelo, nova tabela,
RPC, alteração de schema ou dependência. O módulo de problemas e soluções não foi
iniciado.

## Histórico

- Pesquisa imediata com espera de 180 ms; também existe Aplicar filtros para
  teclado e datas. A consulta é sobre os registros ativos já autorizados pelo banco.
- Somente cultos finalizados entram no Histórico. Ambos os limites do período são
  inclusivos. Busca, período, indicadores, medianas e transições usam o mesmo recorte.
- Contexto informa período, quantidade encontrada, registros fora dos filtros e
  considerados/desconsiderados nos indicadores de término. As contagens de
  atividades ausentes/inválidas e a classificação neutra do Lote 2 permanecem.
- Data de filtro inválida impede apresentar indicadores daquele filtro. Uma data
  inconsistente no registro não é corrigida automaticamente; o usuário recebe
  contexto e pode localizar o registro para editar. Filtro por período a exclui.
- Nenhuma divisão por zero, ausência convertida em zero ou classificação positiva
  de registro incompleto foi introduzida. Limpar filtros não consulta a rede.
- Os filtros são temporários, não são dados de culto nem gravados no Supabase.
  Permanecem ao navegar e voltar na mesma sessão; recarregar a aplicação reinicia
  os filtros. A falha de consulta não vira ausência de registros.

## Recuperação de senha e segurança

- O link Esqueci minha senha abre uma página pública. A solicitação usa
  `resetPasswordForEmail` do cliente Supabase já existente, em PKCE.
- A mensagem é condicional e não informa se o e-mail existe. Rede/rate limit
  recebem erro sem confirmar envio. Há intervalo local de um minuto; a proteção
  efetiva contra abuso continua dependendo dos limites do Supabase.
- O redirecionamento é construído com a origem e o caminho atuais, descartando
  query strings; HTTPS é exigido fora do loopback local. Parâmetros como
  `redirect_to` fornecidos na URL não são usados como destino.
- O callback aceita código PKCE de recuperação, confere o tipo retornado pelo SDK
  e consome o código. Códigos/erros são removidos da URL antes das consultas.
  Tokens de fluxo implícito não são importados; o usuário solicita outro link.
- É necessário abrir o link no navegador/perfil da solicitação, que contém o
  verificador PKCE gerenciado pelo SDK. Outro dispositivo ou navegador requer
  nova solicitação. Links consumidos ou inválidos não habilitam o formulário.
- Nova senha exige confirmação e pelo menos 12 caracteres; requisitos mais fortes
  do projeto continuam validados pelo servidor. As senhas não entram em rascunhos,
  localStorage, histórico de navegação ou arquivos do projeto.
- O SDK continua guardando sua própria sessão. Somente UID e prazo temporário
  são mantidos no sessionStorage, sob chave derivada da chave Auth de cada ambiente,
  para reabrir a definição após reload. O prazo local é de até 15 minutos e nunca
  excede a sessão; não altera a expiração configurada no Supabase.
- Solicitar um e-mail ou abrir um link inválido não substitui a autenticação
  existente. Após redefinir, a sessão local é encerrada e é solicitado novo login.
  Autorizações admin/leader não são concedidas, removidas ou alteradas.
- A prévia de consulta bloqueia envio de recuperação e atualização de senha.
  Nenhum e-mail foi enviado pelos testes; endpoints Auth foram interceptados.

## Configurações manuais pendentes no Supabase

Não foi possível confirmar o painel remoto. Conferir em projeto de testes antes
de publicar; nenhuma destas configurações foi alterada automaticamente:

1. **Authentication → Providers → Email**: provedor de e-mail habilitado.
2. **Authentication → URL Configuration → Site URL**:
   `https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/`
   (endereço configurado no gerador atual do repositório).
3. **Redirect URLs**: autorizar o caminho do aplicativo, por exemplo
   `https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/**`.
   O destino usado é o mesmo caminho com `#reset-password`. O padrão fica restrito
   ao repositório; não autorizar indiscriminadamente toda a origem ou domínios.
   Se preferir lista exata, homologar o destino completo com os parâmetros PKCE
   usados pelo SDK. Para um site de testes, cadastrar apenas o caminho desse site.
4. **Email → Reset Password**: manter um link de confirmação compatível com o
   fluxo padrão do Supabase, usando `{{ .ConfirmationURL }}`. Não trocar por um
   link que entregue tokens brutos ao frontend. Conferir validade do link.
5. **SMTP**: conferir provedor, remetente, entrega, spam e restrições do provedor
   padrão. Os limites e restrições de destinatários do Supabase podem impedir
   envio mesmo quando a interface está correta.
6. Conferir limites de envio e política de senha. Se CAPTCHA estiver exigido,
   sua integração precisa ser homologada; não foi acrescentado um widget neste lote.
7. Validar com **conta descartável de teste**, no mesmo navegador da solicitação.
   A prévia HTML read-only não envia e-mail. Para esse teste é necessário um
   ambiente autorizado que permita as operações Auth, sem usar cultos reais.

**Nenhuma migração SQL é necessária.** As tabelas e RPCs das migrações 001–004
permanecem como estão. `iasdpi_save_template` continua exigindo administrador e
versão esperada. Não é necessário recadastrar o administrador atual.

## Modelos e fontes das escalas

O gerenciamento de modelos reutiliza `templatePanel` e `saveTemplate`; a entrada
anterior em Arquivo e banco foi preservada. Atualizar um ID existente exige
confirmação e usa a versão consultada; não cria outro cadastro por causa da nova
página. Líderes não recebem o formulário; o RPC existente é a proteção efetiva.
Na prévia local, a página explica que gerenciar modelos exige o modo Supabase.

Agenda da igreja e Anciãos mostram a origem Google Calendar, data da consulta e
período importado. O aviso explica que se trata de cópia publicada, não de consulta
a cada abertura. Comunicação mostra cadastro manual, última atualização não
informada e intervalo das cinco datas cadastradas: 03/10/2026–31/10/2026.
Sonoplastia mostra ausência de escala e vigência indefinida. Nenhum nome ou data
foi alterado. Não foi atribuída a data de publicação do código como atualização
administrativa da escala.

Gerenciamento administrativo de escalas futuras é uma necessidade possível, mas
não há volume ou processo informado que justifique outro módulo agora. Se passar
a haver manutenção recorrente por responsáveis, propor cadastro simples com
origem, vigência, atualização e RLS; não foi implementado neste lote.

## Desempenho medido

| Cultos / atividades | Carregar (ms) | Filtrar (ms, mediana) | Calcular indicadores (ms, mediana) | Atualizar tela completa (ms) |
| --- | ---: | ---: | ---: | ---: |
| 10 / 160 | 24.1 | 0.2 | 27.4 | 89.8 |
| 100 / 1600 | 69.1 | 0.4 | 262.0 | 788.4 |
| 500 / 8000 | 445.0 | 1.8 | 1266.1 | 3891.9 |
| 1000 / 16000 | 778.1 | 3.5 | 2526.0 | 7574.2 |

Medição inicial comparável: geração do HTML dos indicadores para 100 cultos passou de 18265.9 ms para 437.0 ms ao reutilizar formatadores (uma amostra por versão, antes da suíte final). Não confundir essa medida de HTML com o cálculo puro da tabela acima.

Em 1.000 cultos, a atualização completa ainda consome cerca de 7.6 s. Este é um limite confirmado, não eliminado pelos filtros rápidos. Dados brutos: `dist/lote5/performance.json`; medições inicial/após formatadores nos dois arquivos `performance-*.json`.

Medições no Chromium headless deste ambiente, com REST interceptado localmente.
Cada culto fictício contém 16 atividades; volumes crescem de 10 a 1.000 cultos
semanais. Não representam latência de produção, SMTP, Supabase real ou CPU de celular.
Filtros/cálculos: três amostras por volume; valores resumidos por mediana.
Carregamento e atualização completa de tela: uma amostra por volume.
O carregamento percorreu as páginas de 500 registros existentes no adaptador.

A alteração de desempenho é local: reutilizar formatadores. Não foi introduzido
cache de documentos que pudesse esconder mudanças de outro usuário. O crescimento
medido justifica propor paginação de detalhes/transições e agregação no servidor
para históricos grandes; isso exige definir consultas que preservem os indicadores
sobre o recorte completo e suas permissões. Não foi feita mudança estrutural.

## Arquivos alterados neste lote

- `frontend/history.js` (novo): filtros, contexto, resultados e estados do Histórico.
- `frontend/auth.js`: recuperação de senha, callback PKCE, formulários e mensagens.
- `frontend/app.js`: integração, indicadores com recorte, ações e inicialização dos formulários.
- `frontend/navigation.js`, `frontend/index.html`: rotas e entradas de recuperação/modelos; módulo Histórico.
- `frontend/operational.js`: extração do formulário existente para reutilização, sem novo RPC.
- `frontend/agenda.js`: identificação e vigência de cada fonte.
- `frontend/users.js`: tratamento de fragmentos de erro/recuperação sem importar tokens implícitos.
- `frontend/record-time.js`: formatadores reutilizados, mantendo parser e precisão.
- `frontend/styles.css`: filtros responsivos e links/avisos.
- `scripts/build_homologation.py`, `scripts/export_preview.py`: inclusão de history.js.
- `tests/test_history_complementary.py` (novo): 39 testes de navegador e desempenho.
- Este relatório. Arquivos em `dist/` são artefatos de revisão, não código publicado.

## Testes e prévia

**307 testes aprovados**, sem falhas, erros ou testes ignorados: 268 anteriores e
39 novos. Execução integral final: 312,550 segundos.
Log: `dist/lote5/testes.log` (original `/tmp/iasdpi-lote5-full.log`).

A suíte inclui regressões de rascunhos, rede, indicadores, responsividade,
Voltar/Avançar, concorrência, criação/edição/finalização, backups e SQL/RLS no
PostgreSQL 17 descartável sem rede. Os novos testes usam Chromium real com
requisições Auth e REST interceptadas. Não houve teste em registros de produção.

Reprodução com PostgreSQL descartável, sem rede, já iniciado:

    PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-lote5-pg-tests python -m unittest discover -s tests -v

Prévia HTML independente, sem gravações remotas:

    python scripts/export_preview.py --read-only --output dist/IASDPI-lote5-previa.html
    python -m http.server 8000 --directory dist

Abrir `http://localhost:8000/IASDPI-lote5-previa.html` com conta autorizada para as
páginas privadas. A prévia usa registros locais; não representa persistência
operacional remota. Não usar para apontamentos reais. O comparativo visual em
`dist/lote5/comparativo.html` usa dados fictícios e não exige login.

## Homologação integrada dos Lotes 1–5

Usar dados e contas descartáveis, em ambiente de testes autorizado, com perfis
admin e leader em dois contextos/dispositivos. Não executar esta lista sobre os
cultos reais de 10/10 ou sobre a Lixeira de produção.

1. **Acesso:** visitante vê organograma e agenda; login recupera a sessão; líder
   não gerencia autorizações, Lixeira ou modelos. Recarregar sem perder a sessão.
2. **Criação:** Liturgia I mantém as 16 atividades; Livre inicia vazio. Data atual
   de São Paulo, editável em dd/mm/aaaa; nenhum 03/10 fixo é reaplicado.
3. **Registro:** preencher parcialmente, salvar sem finalizar; reabrir pelo mesmo
   ID. Previsto HH:mm; real HH:mm:ss; Agora usa segundos; nenhum AM/PM.
4. **Subatividades:** adicionar, editar e excluir com confirmação; validar limites
   dentro da atividade; não duplicar duração nem alterar os previstos.
5. **Rascunhos:** sair cancelando, sair aceitando, recarregar e recuperar. Repetir
   após salvar observações e iniciar uma segunda edição. Outra conta não vê rascunhos.
6. **Rede:** simular falha ao salvar/consultar; manter campos, não confirmar gravação
   sem resposta; tentar novamente sem duplicar. Não apresentar ausência em caso de erro.
7. **Finalização e backups:** finalizar cópia completa; consultar Resumo/Histórico;
   exportar, importar e restaurar cópias descartáveis com HH:mm/HH:mm:ss e frações.
8. **Mobile e teclado:** 360/390/768/1024/1440 px, textos longos, barra Salvar sem
   finalizar, teclado virtual/área segura, foco, subatividades nomeadas e tabelas locais.
9. **Navegação:** Voltar/Avançar, link direto e reload; cancelamento mantém campos;
   ID inexistente não abre outro culto nem cria duplicata.
10. **Conflito:** abrir o mesmo culto em dois dispositivos, salvar por um e tentar
    pelo outro; comparar, selecionar e confirmar. Reaplicar não grava; Salvar usa
    a versão atual. Alteração posterior força nova comparação. Repetir com rascunho antigo.
11. **Histórico:** combinar pesquisa e limites inclusivos; comparar indicadores com
    o recorte; limpar; conferir vazio/erro/carregamento, registros incompletos e inválidos.
12. **Modelos:** acessar por Programações e Administração, atualizar um ID com
    confirmação, conferir mesmo cadastro e preservação dos cultos anteriores.
13. **Agenda:** alternar áreas; conferir origem, período e atualização. Escala manual
    não pode parecer sincronizada; ausência em Sonoplastia não recebe dados inventados.
14. **Senha:** conta descartável, e-mail conhecido/desconhecido com mensagem genérica;
    link no mesmo navegador, senha confirmada, novo login; testar link usado/expirado,
    falta de verificador e falha de rede. Verificar que perfis permanecem iguais.
15. **Volume:** repetir os volumes fictícios e conferir tempos com os números deste
    relatório antes de adotar paginação/consultas agregadas.

## Riscos e limites

- Nenhum registro de produção foi verificado ou modificado. REST Auth/operacional
  foi simulado; SQL/RLS existentes foram testados somente em PostgreSQL isolado.
- SMTP, entrega real, configurações de URL e fluxo no provedor de e-mail exigem
  homologação manual. A interface não consegue garantir entrega nem identificar cadastro.
- Safari, Firefox, leitor de tela e dispositivos físicos não foram testados; simulação
  de viewport/teclado não substitui homologação nesses aparelhos.
- O Histórico ainda carrega todos os documentos autorizados em páginas de 500;
  grandes volumes continuam custosos para cálculo e DOM. Medições não são SLA.
- Rascunhos continuam temporários, cifrados localmente por 24 h, dependentes do
  navegador. Não substituem persistência operacional nem protegem contra XSS.
- `file://` é bloqueado pelo navegador deste ambiente; prévia verificada por HTTP.
- Rollback é a árvore intacta do Lote 4, incluindo alterações não commitadas.
  Não usar reset destrutivo para descartar os trabalhos acumulados.
- Desenvolvimento encerrado neste lote para homologação integrada. Sem novo módulo
  de problemas/soluções, commit, merge ou publicação.

Commit sugerido, sem execução: `feat: adiciona filtros do histórico e recuperação de senha`.
