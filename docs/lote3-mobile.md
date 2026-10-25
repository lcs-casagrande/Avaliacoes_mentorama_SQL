# Lote 3 — Responsividade e experiência mobile

Branch: `fix/mobile-lote3`, diretório `/workspace/iasdpi-lote3`.
Base: árvore completa de `fix/data-reliability-lote2`, incluindo suas alterações
não commitadas. O diretório do Lote 2 permanece intacto como opção de rollback.
Nenhum commit, merge, push, publicação ou alteração de produção foi realizado.

## Diagnóstico registrado antes das alterações

Chromium, acesso administrativo fictício, 5 larguras: 360, 390, 768, 1024 e 1440 px.
Foram feitas 80 medições: oito páginas, com texto normal e longo, em cada largura.
55 capturas por fase incluem o início das páginas e o meio do Registro do Culto.
As imagens usam dados fictícios; a data 10/10/2026 nas imagens não representa
uma leitura do culto real no Supabase.

| Problema confirmado | Causa | Correção |
| --- | --- | --- |
| Documento de 1.402 px numa viewport de 1.024 px, mesmo sem texto longo | Menu administrativo sem quebra de linha no desktop | Flex com quebra, base de largura e cabeçalho em duas linhas quando necessário |
| Documento de 1.502 px numa viewport de 1.440 px | Mesmo menu, somado à marca e aos espaçamentos | Navegação respeita a largura disponível, preservando os links e rótulos existentes |
| Textos longos produziam documentos de até 3.836 px | Mínimos automáticos de grid/flex, títulos e responsáveis sem quebra | `minmax(0,…)`, `min-width:0` e quebra de texto nos componentes apropriados |
| Salvar ficava distante durante o preenchimento das 16 atividades | Ação disponível apenas no fim do formulário | Uma única barra fixa de salvamento, com estado visível durante a rolagem |
| Teclado e controles fixos podiam ocultar os últimos campos | Ausência de compensação da área visível e espaço final | Altura medida, área segura, VisualViewport e espaço de rolagem adicional |
| Alguns erros de data e subatividade eram apresentados somente no início do formulário | Exceções sem associação ao controle | Mensagem junto ao campo, foco e `aria-describedby`, sem mudar os critérios de validação |

Após a implementação, as mesmas 80 medições não apresentam estouro horizontal
no documento. Tabelas largas continuam rolando dentro de seu próprio contêiner.
Não foi aplicado `overflow-x:hidden` ao documento para esconder o problema.

## Funcionamento e preservação

- Mantidas cores, fontes, componentes, menus, permissões e regras de negócio.
  Grades se adaptam, textos quebram e os menus ficam dentro do cabeçalho.
- Tabelas com overflow tornam-se regiões identificadas e focáveis por teclado;
  a seta horizontal rola a tabela, sem deslocar a página.
- A barra contém somente **Salvar alterações** e o estado: existente/salvo,
  pendente, salvando, confirmação ou erro. **Finalizar e ver resumo** continua
  separado no fim do formulário, com as validações existentes.
- Existe apenas um botão `name="save"`. Ele é o primeiro submit no DOM:
  Enter aciona salvar, sem finalizar. Não há uma nova rota de persistência.
- Confirmação continua dependendo da resposta do mesmo backend/RPC. Durante o
  envio os controles ficam bloqueados pelo mecanismo existente. Falha preserva
  campos e rascunhos; não há confirmação fictícia de gravação.
- A confirmação visível diferencia Supabase de armazenamento local. A barra também
  indica alterações recuperadas de rascunhos, sem classificá-las como salvas.
- `safe-area-inset-*` protege a barra; `viewport-fit=cover` permite o uso dessas
  áreas. O espaço inferior acompanha a altura da barra e a redução da área visível.
  O mesmo cuidado foi aplicado à ação fixa do Acompanhamento no celular.
- Alvos de toque do Registro têm pelo menos 44 px de altura. Controles mobile
  usam fonte de pelo menos 16 px. Rótulos e instruções continuam presentes.
- Nenhuma migração, alteração de modelo, fuso, horário, ID, versão ou formato de
  armazenamento. Atividades/subatividades, indicadores, backups e autenticação
  continuam usando as implementações dos lotes anteriores.
- `frontend/drafts.js`, os 20 testes do Lote 1 e os 40 testes do Lote 2 permanecem
  byte a byte iguais à base. Os hooks existentes foram preservados.

## Arquivos próprios deste lote

- `frontend/styles.css`: contenção, grades, texto, toque, tabelas e barra fixa.
- `frontend/actuals.js`: barra e estados, medidas da área visível, foco, associação
  de erro ao campo, sem nova lógica de persistência.
- `frontend/app.js`: montagem do layout, estado do envio e erros próximos aos campos.
- `frontend/index.html`: viewport com áreas seguras.
- `tests/test_mobile_ux.py`: 23 regressões novas de navegador.
- Este relatório. Artefatos em `dist/` não integram o pacote publicado.

## Testes

**230 testes aprovados**, sem falhas ou testes ignorados: 207 anteriores
(147 originais + 20 do Lote 1 + 40 do Lote 2) e 23 novos do Lote 3.
Execução integral: 261,524 segundos. Log: `/tmp/iasdpi-lote3-full.log`.
A suíte inclui backend, pacotes, autenticação, permissões, PostgreSQL descartável,
backups, indicadores, fluxo de registro e rascunhos.
O pacote estático também foi preparado em `/tmp/iasdpi-lote3-pages-candidate`,
com recursos versionados por conteúdo e validação do gerador, sem publicação.
A prévia HTML independente foi exercitada por HTTP local: organograma, agenda,
login simulado, edição no meio do formulário, salvamento local e reabertura após
reload, sem erros de execução. O comparativo independente abriu suas dez imagens
incorporadas e coube na viewport mobile. Nenhuma chamada externa real foi usada.

Os 23 novos casos cobrem: 12 páginas nas cinco larguras com textos longos;
visitante/líder/admin; posição da barra no meio do formulário; toque; atualização
pelo mesmo ID; confirmação somente após resposta; erro e nova tentativa; Enter e
preenchimento parcial; finalização separada e inválida; foco/mensagem de erro;
redimensionamento e deslocamento simulados de VisualViewport; zoom; rascunho
recuperado; tabela rolável por teclado; alvos de toque/fonte; saída da página;
Acompanhamento; confirmação local; datas e título obrigatórios; duplicação.

REST interceptado e dados descartáveis. SQL/RLS são testados em PostgreSQL 17
sem rede; não se acessam ou modificam cultos reais de produção.
Com contêiner descartável já disponível:

    PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-lote3-pg-tests python -m unittest discover -s tests -v

## Revisão e homologação

Gerar a prévia independente, com gravações remotas bloqueadas:

    python scripts/export_preview.py --read-only --output dist/IASDPI-lote3-previa.html

Servir localmente, se necessário:

    python -m http.server 8000 --directory dist

Abrir `http://localhost:8000/IASDPI-lote3-previa.html` e entrar com uma conta
autorizada. A prévia usa armazenamento local e não grava cultos no Supabase.
Para validar persistência remota, usar apenas um ambiente de testes autorizado.

1. Criar um registro fictício; preencher uma atividade no meio do formulário.
   A barra deve indicar pendência. Salvar deve manter o culto aberto.
2. Reabrir o registro, conferir horários, observações e subatividades.
3. Simular conexão indisponível e tentar salvar: manter campos/rascunho e mostrar erro.
   Reconectar e repetir; aguardar a confirmação.
4. Confirmar que Enter salva. Finalizar somente pelo botão específico no fim do
   formulário, após preencher os horários obrigatórios.
5. No celular, abrir o teclado nos últimos campos, nas subatividades e nas notas
   do Acompanhamento. Campo/foco e ações devem continuar acessíveis; fechar o teclado
   deve reposicionar a barra.
6. Testar menus de admin, nomes longos e tabelas nas cinco larguras; a rolagem
   horizontal deve ficar apenas na tabela. Validar também teclado e foco visível.
7. Conferir a prévia visual comparativa e as capturas em `dist/mobile/`.

## Limitações e riscos restantes

- VisualViewport/teclado e toque foram simulados no Chromium. Isso não substitui
  homologação em Android e iPhone reais, especialmente Safari, zoom e área do notch.
- Firefox e Safari não estão disponíveis neste ambiente; não são declarados testados.
- A abertura direta `file://` é bloqueada pela política do navegador deste ambiente.
  A prévia independente é verificada por HTTP local.
- O menu mobile continua explícito, para preservar a navegação atual. Não foram
  introduzidos menus ocultos, novos componentes de navegação ou novas permissões.
- Lote 4 não foi iniciado. Implantação e commit dependem de autorização posterior.
