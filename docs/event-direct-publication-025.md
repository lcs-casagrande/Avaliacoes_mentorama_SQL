# IASDPI — Publicação direta de eventos (025)

A etapa intermediária de aprovação foi retirada por solicitação da liderança. O usuário que já possui permissão de publicação pode usar **Publicar** em qualquer categoria. Salvar rascunho, cancelar, Restrito, igreja e alcance ministerial continuam independentes.

Eventos anteriormente pendentes permanecem como rascunhos até a publicação explícita. Editar/publicar preserva IDs, autor original e versões anteriores, inclusive a informação histórica de aprovação. Não há publicação automática nem concessão de permissões.

## Reservas e concorrência

Reservas exclusivas conflitantes continuam impedindo a publicação, mesmo com `p_accept_conflicts=true`. A interface mostra os conflitos e oferece salvar um rascunho. Rascunhos novos não reservam espaços; uma revisão privada preserva a reserva/publicação anterior até republicar ou cancelar. As operações mantêm transação, bloqueio, CAS, isolamento de igreja e exclusão GiST.

## Código e migrações

- `frontend/agenda.js`: botão Publicar, status editorial e conflito sem encaminhamento para aprovação.
- `tests/fixtures/event-planning-preview.js`: simulação equivalente, em memória, sem rede real.
- `database/025_event_direct_publication.sql`: após **001–024**, atualiza os RPCs existentes; não cria outro cadastro ou autenticação. O catálogo informa `event_approval_required=false`.
- `database/check_event_direct_publication.sql`: verificações de RLS, funções privadas e reserva exclusiva.
- `database/025_event_direct_publication_down.sql`: restaura as funções anteriores somente se não houve gravação pelo novo fluxo. Com gravações 025, recusa a reversão automática e exige recuperação comparada por backup em ambiente separado. Não apaga tabelas ou histórico.

A instalação 001–025 foi exercitada somente em PostgreSQL 17 descartável, `--network none`, sem portas. Nenhuma migração foi aplicada ao Supabase. O Pages usa exclusivamente o adaptador demonstrativo.

## Ajustes de escalas incluídos nesta publicação

A 024 acompanha esta entrega: listas e calendário em ordem alfabética, Comunicação compatível com outros departamentos e publicação com vagas em aberto (`A definir`). Os demais conflitos e permissões continuam validados. Consulte `schedule-publication-rules-024.md`; sua descrição da aprovação de eventos foi substituída pela decisão 025 deste relatório.

## Validação

Resultado e contagem sem somar reexecuções: `event-direct-publication-025-validation.json`.

- 16 testes nativos do fluxo 025: publicação geral direta, pendências antigas, séries, rascunhos, permissões, privacidade, histórico, concorrência, conflitos e reversão.
- 35 testes nativos de regressão 022/024 em instalações correspondentes.
- 101 testes Python de interface e validação de pacotes: Eventos, Escalas, Música, mês atual, login, navegação administrativa/pública e privacidade.
- 38 testes Node: planejamento, publicação de escalas, janela de edição e handlers de autenticação/recuperação.
- O pacote estático exato é revalidado no Chromium; casos repetidos não aumentam a contagem consolidada. Larguras: 360, 390, 768, 1024 e 1440 px.

Evidências locais: `dist/event-direct-publication-025/`, incluindo logs PostgreSQL/Chromium/Node e capturas desktop/mobile. Não foi reexecutada toda a suíte histórica do repositório.

## Homologação e ativação real

A atualização autorizada altera somente os três arquivos estáticos de `integrada/` no repositório **IASDPI-homologacao**. As demais prévias e o calendário histórico são preservados. O código é enviado apenas à branch `feat/schedule-management-b1` do repositório de desenvolvimento, sem merge.

Página: https://lcs-casagrande.github.io/IASDPI-homologacao/integrada/#events

Acesso, persistência e permissões da homologação estática são simulados. As alterações reiniciam ao recarregar; não inserir dados privados. A persistência compartilhada depende de implantação separada e autorizada de Auth/RPCs/migrações. A 025 não implica autorização para aplicar a 024 ou qualquer outra migração em banco real.
