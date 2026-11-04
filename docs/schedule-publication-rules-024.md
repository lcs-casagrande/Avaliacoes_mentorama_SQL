# Revisão 024 — listas, Comunicação e publicação com vagas

Branch `feat/schedule-management-b1`. Revisão local em 04/11/2026; nenhum commit, push, publicação ou SQL no Supabase real nesta etapa.

## Resultado

- Calendário: pessoas em ordem alfabética dentro da data, independentemente do departamento. Vagas sem pessoa ficam depois dos nomes; a cronologia e as faixas do Ancionato são preservadas.
- Seletores de uma ou várias pessoas, Ancionato e tabela de distribuição usam nomes de exibição em ordem alfabética portuguesa. O catálogo central, IDs, ordem persistida das atribuições, vínculos e histórico não são regravados para ordenar a apresentação.
- Comunicação pode coincidir com outros departamentos na mesma data, nos dois sentidos de gravação. A regra é ministerial, não uma concessão de acesso. Não cria exceções administrativas ou pessoas novas. Indisponibilidade e limites continuam sendo avaliados pelo rodízio; outros pares de departamentos mantêm o bloqueio de conflitos.
- Escalas com vagas em aberto podem ser publicadas por quem já possui essa permissão. A confirmação informa a quantidade de pendências. O calendário mostra **A definir**, com a função nos detalhes acessíveis, e informa vagas pendentes sem contá-las como pessoas atribuídas.
- Escalas sem nenhuma função/vaga cadastrada continuam bloqueadas. A publicação não libera conflitos incompatíveis, dados inválidos, dias encerrados ou acesso sem permissão.
- Ancião da Semana e do Mês também podem publicar uma vaga real sem pessoa, preservando períodos distintos, datas, versões e a regra temporal da 023. Um período nulo não cria compromisso de voluntário.
- Rascunhos não aparecem publicamente. Uma revisão privada preserva a última publicação; preencher uma vaga no rascunho não altera o calendário até a nova publicação.

A visibilidade permanece a mesma: visitante consulta Ancionato e eventos públicos; demais escalas exigem login e autorização. Vagas vazias não expõem contatos, observações internas ou rascunhos.

## Evento pendente de aprovação

O cadastro e a edição podem ser testados. Novas Programações Gerais e séries com conflitos continuam pendentes, fora do calendário público. Não existe ainda a tela/RPC de decisão por um ancião explicitamente autorizado. Não foi implementada aprovação automática nem um botão fictício para aprovar. O `?` ao lado do estado explica a pendência e o caráter temporário da homologação.

Eventos departamentais e Atividades Reservadas sem conflitos mantêm as permissões existentes de publicação; a classificação não deve ser trocada apenas para contornar uma aprovação. As alterações da demonstração reiniciam ao recarregar a página inteira. Persistência compartilhada e autenticação operacional no Supabase seguem sem ativação.

Aprovação/rejeição de eventos, sua fila e a ativação real são etapas futuras, não parte desta correção de escalas.

## Banco

Migração incremental **024_schedule_publication_rules.sql**, após 001–023. Reutiliza as tabelas de departamentos, escalas, pessoas e versões; não cria tabelas paralelas.

A compatibilidade consulta o código `comunicacao` no cadastro da igreja. O helper privado legado `has_day_exception` passa a aceitar também a compatibilidade ministerial fixa, propagando a decisão aos validadores, contextos, períodos e referências históricas sem criar uma linha na tabela de exceções. Exceções administrativas preexistentes e sua auditoria são preservadas.

O núcleo de salvamento deixa de exigir cobertura completa, mantendo ao menos uma vaga cadastrada, controle transacional, RLS, permissões, validação de atribuições, versões e preservação física dos registros encerrados da 023. A restrição que exigia pessoa em todo período publicado do Ancionato é substituída pela possibilidade explícita de vaga; demais chaves e restrições permanecem.

A projeção acrescenta vagas da última versão publicada antes dos filtros de privacidade da 021. Um registro por função contém `vacancy_count`, evitando repetir chips idênticos para várias vagas. Consultas públicas e autenticadas continuam usando os mesmos endpoints autorizados.

`check_schedule_publication_rules.sql` é somente leitura. `024_schedule_publication_rules_down.sql` restaura funções e cobertura anteriores quando seguro; recusa reversão se encontra publicações pendentes no histórico ou coincidências dependentes da nova compatibilidade. Nesses casos, exige recuperação por backup/revisão em ambiente isolado, sem excluir registros. O rollback deve preceder o da 023. Não foi aplicado no Supabase.

## Arquivos

- `frontend/agenda.js`: ordenação do calendário, vagas e ajuda de aprovação.
- `frontend/schedule-management.js`: comparadores, compatibilidade, seletores e confirmação de publicação.
- `frontend/portal-access.js`: resumo de publicações diferencia registros e vagas pendentes.
- `scripts/export_preview.py` e adaptadores em `tests/fixtures/`: comportamento isolado na mesma base central em memória.
- `database/024_schedule_publication_rules.sql`, respectivo down e check somente leitura.
- `tests/test_schedule_publication_rules_sql.py`, `tests/test_schedule_publication_rules_browser.py`, `tests/schedule-publication-rules.test.mjs`: novos cenários.
- Testes existentes de janela de edição e Música adaptados à regra autorizada: Comunicação deixa de bloquear, mantendo prova de bloqueio Música × Sonoplastia.

## Verificação e prévia

**137 cenários selecionados aprovados, sem falhas finais:** 14 PostgreSQL, 85 outros casos Python de navegador/regressão e 38 Node. O HTML exato foi rechecado em sete fluxos de navegador (reexecuções, sem aumentar a contagem).

Resultados consolidados em `docs/schedule-publication-rules-024-validation.json`. PostgreSQL 17 descartável, sem rede/portas, com instalação 001–024; Chromium local; testes Node. O contêiner descartável foi removido após a validação. Não é um clone nem uma verificação do Supabase real. Não foi reexecutada toda a suíte histórica; a contagem considera casos únicos selecionados e o resultado final de cada caso, sem somar reexecuções.

Gerar: `python scripts/export_preview.py --event-management-preview --output dist/schedule-rules-024/IASDPI-revisao.html`.

Prévia isolada com contas fictícias: `admin.iasdpi` / `Demonstracao#2026`. Testar Escalas → Sonoplastia ou Comunicação → Publicar com vagas em aberto → Calendário. Em Música, selecionar nomes fora de ordem para conferir a ordenação visual. O automático da Música continua desativado.

Capturas desktop/mobile em `dist/schedule-rules-024/`. A prévia mantém CSP sem conexões externas, mesma fonte central de participantes e fontes históricas de Sonoplastia/Comunicação/Ancionato. Publicação na homologação depende de nova solicitação do usuário.

Commit sugerido: `feat: ordena pessoas e permite publicar escalas com vagas pendentes`.
