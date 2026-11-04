# Calendário mensal de escalas — evolução visual da Fase A

Branch: feat/schedule-foundation-phase-a. Sem commit, push, publicação ou acesso ao Supabase nesta etapa. Não implementa persistência da Fase B.

## Implementação

- `frontend/agenda.js`: componente IASDPIScheduleCalendar, acessível em `#schedule-calendar` e por Escalas e agendas → Calendário mensal de escalas. Lê as escalas manuais existentes, sem modificar arrays, importar pessoas ou criar atribuições.
- `frontend/app.js`, `frontend/auth.js`, `frontend/navigation.js`: rota pública de consulta das informações que já são públicas, integrada à navegação existente. Cadastro privado da Fase A continua exigindo autorização; esta rota não consulta pessoas privadas ou novas tabelas.
- `frontend/styles.css`: grade mensal domingo–sábado, identificação do dia atual, cores, filtros, detalhes e painéis adaptados às cinco larguras.
- `scripts/build_schedule_demo.py`: opção `--calendar-preview` reutiliza o componente real. Extrai os 15 registros diretamente da fonte de Sonoplastia; não mantém uma segunda lista manual. A opção padrão de demonstração fictícia anterior permanece disponível. `--standalone` gera um único HTML local com CSP por hashes.
- `tests/test_schedule_calendar.py`: regressões de calendário e integração com a Agenda anterior.

## Comportamento e origem

O mês inicial e o botão Hoje usam America/Sao_Paulo. A aritmética dos dias usa datas ISO com referência UTC ao meio-dia para evitar deslocamento de data. Há navegação de mês, seletor, legenda e filtros combináveis por departamento e pessoa. Limpar filtros não altera dados. Ao selecionar uma data, a lista mostra todas as entradas correspondentes aos filtros.

Sonoplastia permanece com 13 registros em outubro e dois em novembro de 2026, mantendo exatamente os nomes e datas. Rafa e Raphael continuam distintos. A consulta integrada também preserva Comunicação. A agenda oficial e o organograma continuam com suas fontes e telas próprias.

Cores: Sonoplastia azul, Diaconato verde, Música roxo, Ancionato dourado e Comunicação laranja. Outros departamentos recebem cores de fundo distintas calculadas para a legenda, com texto escuro e nomes explícitos. Os cinco pares principais passaram no teste de contraste mínimo 4,5:1. Informação não depende exclusivamente de cor.

Os exemplos de Diaconato/Marciano, Música/Alexandre e Ancionato/A definir aparecem somente ao habilitar a opção de exemplos, na data ilustrativa 10/10/2026. Estão marcados individualmente como Exemplo visual. A rota da aplicação inicia com exemplos desligados; a prévia local inicia ligados para avaliação. Nenhum exemplo é salvo, convertido em escala ou somado à lista de próximas escalas reais.

Próximas escalas considera hoje e os filtros, inclusive além do mês selecionado, limitado a seis itens de fonte informada. Pessoas escaladas considera a fonte informada no mês filtrado, sem exemplos. A área de funções sem responsável identifica exemplos e não presume que a ausência de funções na fonte seja uma vaga. Sem horários conhecidos, não há validação de conflitos.

Criar escala é apenas um botão visual desabilitado com explicação. Os cadastros fictícios da prévia não modificam a escala manual original.

## Prévia e segurança

Gerar em um destino vazio:

```bash
python scripts/build_schedule_demo.py --calendar-preview \
  --output dist/schedule-calendar/review \
  --standalone dist/schedule-calendar/IASDPI-calendario-previa.html
```

A prévia contém explicitamente os nomes já informados na escala de Sonoplastia. Portanto o banner diferencia escala informada e exemplos visuais; não declara que os 15 registros são fictícios. Não carregar o pacote anterior como se fosse esta revisão: a homologação publicada não foi atualizada.

Não há URL, chave, cliente Supabase ou acesso ao calendário externo no pacote local. CSP connect-src none/form-action none e bloqueios de fetch, XHR, WebSocket, EventSource e sendBeacon permanecem ativos. O HTML autossuficiente carrega apenas a si mesmo; scripts e estilos embutidos são autorizados pelos respectivos hashes. Mudanças nos cadastros demonstrativos ficam em memória e reiniciam ao recarregar.

## Validação

13 testes novos cobrem: 15 registros preservados; outubro/novembro sem duplicação; domingo–sábado; ano bissexto; mudança de mês; data atual em São Paulo durante virada UTC; detalhes com quatro entradas; filtros combinados; estados vazios; exemplos desligáveis; botão Criar escala bloqueado; ausência de gravação local; acesso aos cadastros e proteção de edição pendente; contraste; departamentos adicionais; escape de HTML; nomes longos; larguras 360/390/768/1024/1440; HTML único com CSP; rota pública e Voltar do navegador preservando a Agenda.

Capturas e verificação da prévia em `dist/schedule-calendar/captures` e `visual-check.json`. Testado em Chromium headless, sem afirmar validação em Android/iPhone físicos ou Safari. A suíte completa e seu resultado final ficam em `tests-all.log` e `test-summary.json` da mesma pasta.

Um estouro horizontal no primeiro teste foi causado por herança de white-space nowrap nos textos das tabelas; a correção permite quebra nos badges. O cabeçalho mobile de mês usa grade própria para evitar título comprimido. O HTML único executa o script depois do corpo para preservar a montagem do componente.

## Homologação sugerida

1. Abrir o HTML local e selecionar outubro/2026. Conferir 13 entradas de Sonoplastia; navegar a novembro e conferir 01/11 e 04/11.
2. Habilitar exemplos e selecionar 10/10: conferir quatro entradas com três identificadas como exemplos.
3. Selecionar Sonoplastia e Rafa; conferir que Raphael não é incluído. Combinar filtros sem resultados e limpar.
4. Usar Hoje; conferir a data brasileira em São Paulo. Navegar por teclado e selecionar um dia para ler os detalhes completos, especialmente no celular.
5. Abrir Cadastros, iniciar edição e voltar ao calendário: conferir a confirmação para descartar alterações pendentes.
6. Confirmar que Criar escala não grava e que recarregar reinicia apenas os cadastros fictícios. Não executar a migração 005 para avaliar esta prévia.

A Fase B permanece não iniciada. Persistência de escalas, publicação, trocas, geração e motor transacional de conflitos exigem etapas próprias.

## Resultado final

**474 testes aprovados, zero falhas e zero ignorados**, em 452,241 s: 461 casos anteriores e 13 novos de calendário. PostgreSQL descartável sem rede e Supabase HTTP simulado; nenhum teste acessou o banco de produção. A consulta de hashes confirmou a preservação das escalas originais, dos cadastros da Fase A, dos módulos de cultos e das migrações. Nenhuma publicação realizada.
