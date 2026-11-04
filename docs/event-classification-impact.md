# Revisão da classificação de eventos — análise antes da implementação

Branch: `feat/schedule-management-b1`. Somente inspeção do código e do snapshot público local; não houve consulta ou alteração no Supabase real. A revisão abaixo substitui a proposta provisória de filtro “Evento Local”. Este documento registra a análise anterior à implementação. A decisão posterior e a migração preparada estão descritas em calendar-privacy-activation.md. Nenhuma alteração foi executada no Supabase real.

## Evidências atuais

- `database/020_calendar_events.sql`: `category` aceita `church`/`department`; a restrição também vincula `department_id` a `department`. O helper `event_can`, o catálogo, o histórico e a RPC de gravação usam esse escopo para autorização. Trocar diretamente os valores dessa coluna mudaria a segurança do sistema.
- A RPC `iasdpi_events_published` publica a última fotografia publicada, retirando autoria e motivo de cancelamento. Ainda não há regra de ocultação por público-alvo: hoje títulos, locais e descrições publicados são públicos.
- `frontend/agenda.js`: o snapshot oficial ainda deriva o tipo antigo da presença de um departamento. Essa inferência não é suficiente para a nova classificação editorial.
- O snapshot contém 154 eventos, dos quais 153 informam departamento, além dos períodos de anciãos. Há 17 eventos em outubro/2026. Exemplo: “Culto Divino” está vinculado ao Ancionato. Isso não o torna automaticamente uma programação para público específico.
- A fonte possui título, departamento, datas, horários e local; não possui os novos campos de classificação, organizador e público-alvo. Não preencher os campos ausentes por suposição.

## Separação recomendada

| Campo | Valores propostos | Função |
| --- | --- | --- |
| `program_category` | `general`, `departmental`, `reserved`; nulo enquanto pendente | Programação Geral, Programação Departamental, Atividade Reservada |
| `organizer_kind` | `local_church`, `association`, `school`, `department`, `other`; nulo enquanto desconhecido | Identificar o organizador, sem conceder permissões |
| `audience` | `whole_church`, `specific`, `restricted`; nulo enquanto desconhecido | Toda a igreja, Público específico, Restrito/Convidados |
| Escopo de gestão existente | `category` + `department_id` + igreja | Preservar as autorizações atuais e os vínculos existentes |

Se o organizador for um departamento distinto do gestor, a referência de organizador deve ser separada e vinculada à mesma igreja por FK. Não reutilizar o campo de autorização de forma que escolher um organizador altere privilégios. Não criar pessoas, igrejas ou departamentos novos para preencher lacunas.

## Impactos nos módulos

1. **Filtros:** Tudo/Escalas/Eventos permanecem. Em Eventos, substituir os rótulos provisórios por Programação Geral, Programação Departamental e Atividade Reservada. Exibir pendências separadamente. Nunca tratar nulo como Geral. Dentro de cada filtro usar OU; entre categoria e departamento, E. O filtro departamental deve usar o vínculo real de responsabilidade, não inferir um organizador ou público.
2. **Cadastro:** apresentar classificação, organizador e público-alvo como campos independentes; distinguir o departamento que gerencia o registro. A publicação precisa de validação no backend. Definir os campos obrigatórios e o tratamento de registros anteriores antes de ativar novas exigências.
3. **Calendário:** preservar datas, vários itens por dia, escalas e anciãos. Exibir a classificação e os detalhes autorizados. O filtro público e a contagem não podem revelar detalhes que a RPC tenha ocultado.
4. **Acesso público:** a decisão sobre eventos reservados/restritos foi solicitada ao usuário: somente ocupação, ocultação total ou detalhes publicados. Não implementar nem presumir essa política enquanto estiver indefinida. A proteção deve existir na resposta PostgreSQL/RPC, e também no adaptador demonstrativo; esconder texto pelo JavaScript não basta.
5. **Persistência:** preparar posteriormente uma migração 021 incremental após 020, com novos campos opcionais, restrições e atualizações das RPCs. Preservar RLS, controle de versão, idempotência, gravação parcial e histórico. Não reescrever a migração 020 já distribuída.
6. **Reversão:** não remover campos preenchidos ou versões para reverter. Desativar a nova apresentação e preservar os dados; reversão estrutural somente quando vazia ou com plano de restauração validado.

## Conciliação histórica

- Preservar `category`, `department_id`, IDs, fontes e fotografias anteriores.
- Igreja → Geral e Departamento → Departamental são **candidatos de revisão**, não um UPDATE em massa.
- Não classificar por palavras no título nem concluir público/organizador a partir do nome do ministério.
- Apresentar registro, escopo antigo, proposta e pendências ao administrador. Confirmar no mesmo ID com versão esperada, gerando nova fotografia auditada.
- Conservar registros não conciliados como pendentes. Não despublicar, duplicar ou apagar automaticamente eventos anteriores.

## Próximos testes necessários

- Categorias editoriais sem alterar o alcance de acesso; gestor ministerial não ganha permissões ao escolher Igreja/Associação/Outro como organizador.
- Compatibilidade com snapshots antigos sem os novos campos e preservação integral dos dados históricos.
- Conciliação explícita, versões e concorrência; atualização parcial sem limpar outros campos.
- Público restrito e reservado conforme a regra confirmada: testar anonimato diretamente na RPC e no simulador.
- Filtros por novas categorias e departamentos combinados, pendências, eventos simultâneos e responsividade.

Os testes da reorganização dos filtros são evidências da etapa visual anterior; não comprovam esses novos campos ou a política pública ainda não implementada. A opção provisória Evento Local foi removida da prévia atual; a implementação preparada e seus testes estão descritos em calendar-privacy-activation.md. A política nova ainda não foi aplicada à homologação online. Nenhum commit, push ou publicação foi realizado nesta etapa.
