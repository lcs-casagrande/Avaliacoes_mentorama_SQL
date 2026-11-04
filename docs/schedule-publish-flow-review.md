# Revisão do fluxo de montagem e publicação — B1.2

Branch: `feat/schedule-management-b1`. Sem commit, publicação, acesso ou alterações no Supabase.

## Correções

- Retirados os rótulos de participação geral do formulário e a preparação de eventos da montagem simplificada. Eventos já cadastrados continuam sendo lidos; as datas do período e as vagas são reutilizadas.
- Pessoas e distribuição agora é uma tabela: pessoa, atribuições no mês, dias distintos no mês e histórico publicado anterior. Período e unidades aparecem no cabeçalho; ausência de histórico não é apresentada como zero conhecido.
- Salvar rascunho, Publicar escala e Ver no calendário ficam na mesma barra, acessível durante a rolagem. A publicação é a ação principal e recebe confirmação separada do salvamento.
- A consulta abre no mês e departamento da escala. Os filtros de pessoa são reiniciados nessa navegação explícita para não esconder as novas publicações.
- Publicações de ancião da semana e do mês passaram a aparecer nas faixas do calendário da demonstração. Na consulta, uma publicação substitui a referência do mesmo período; a fonte original da Agenda permanece intacta.
- Uma nova revisão em rascunho mantém a última versão publicada visível, tanto para escalas diárias como para períodos de anciãos. Também conserva os compromissos dessa publicação na verificação de conflitos da prévia.
- Uma publicação diária prevalece na consulta sobre a escala manual da mesma data/departamento. Os 20 registros originais continuam preservados na fonte histórica, sem exclusão ou alteração.

## Evidências

`dist/schedule-final-flow/tests-final.log`: 101 testes aprovados, incluindo os 79 cenários anteriores, sete novos testes de publicação/consulta e 15 de regressão do calendário compacto.

`tests-publish-final.log`: nova execução dos sete cenários integrados após ajustes finais de textos e apresentação. Capturas desktop/mobile na mesma pasta.

Testado: rascunhos ocultos, publicação diária, abertura no mês correto, publicação semanal/mensal, ausência de duplicação na consulta, preservação da Agenda, revisão sem retirada da publicação anterior, falha de publicação sem perda do formulário, tabela e ações em 360/390/768/1024/1440 pixels e acesso por teclado.

São testes de navegador e adaptadores locais. Não comprovam gravação compartilhada, autenticação ministerial ou RLS no Supabase real.

## Podemos concluir?

| Item | Situação |
| --- | --- |
| Montagem simplificada e tabela | Pronto para homologação visual |
| Publicar e visualizar na mesma aba | Implementado e testado na demonstração |
| Dados históricos e calendário existente | Preservados |
| Disponibilidade | Continua desativada na nova prévia, sem apagar regras antigas |
| Gravação e leitura compartilhadas entre dispositivos | **Bloqueante para uso real:** a demonstração usa memória da aba |
| Anciãos por período no Supabase | **Bloqueante:** as RPCs de períodos existem somente no adaptador da prévia |
| Permissões e publicação pública reais das escalas | **Bloqueante:** exigem integração, migração revisada e homologação autenticada |

Podemos encerrar a revisão da interface após aceite; não declarar o módulo operacional concluído. A próxima etapa operacional é revisar a instalação/integração das migrações de escalas existentes, preparar a persistência de períodos com versões e validação transacional compartilhada, disponibilizar somente os campos públicos das versões publicadas e homologar administrador/gestor/consulta com contas descartáveis. Não foi executada nenhuma dessas alterações em produção nesta revisão.

## Como testar a prévia

1. Escolher departamento/mês e preencher as listas, ou usar o preenchimento automático.
2. Salvar rascunho e conferir que não aparece como publicação nova.
3. Publicar escala, confirmar e abrir Ver no calendário.
4. Em Ancionato, publicar semanal e mensal separadamente; conferir faixas e pessoa no período correto.
5. Editar uma publicação e salvar rascunho: a última publicação deve continuar na consulta até publicar a revisão.

O HTML é independente, com CSP bloqueando conexões externas. Recarregar reinicia a simulação. A versão online no commit `294c428` continua preservada; esta revisão não foi publicada.

Commit sugerido: `feat: simplifica montagem e integra publicacoes ao calendario da previa`.
