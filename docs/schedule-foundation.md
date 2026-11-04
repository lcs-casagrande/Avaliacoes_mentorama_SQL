# Escalas — Fase A

## Diagnóstico e escopo

Base: `a77b48b`, branch de trabalho `feat/schedule-foundation-phase-a`. Os Lotes 1–6 e a atualização dos ministérios já integram essa base; a árvore estava limpa. A publicação consultada é `d609657`. Não foram feitas alterações de produção.

O frontend é HTML/CSS/JavaScript sem framework, publicado pelo GitHub Pages. `frontend/agenda.js` guarda Comunicação (5) e Sonoplastia (15); `agenda-data.js` é o snapshot próprio do calendário oficial, incluindo anciãos. `organization.js` guarda o organograma e os 26 ministérios. Nada disso será convertido ou sobrescrito automaticamente.

Auth utiliza um único cliente Supabase com PKCE, renovação e sessão persistente. `iasdpi_access` tem papéis reais **admin** e **leader**. Cultos usam `iasdpi_programs`, `iasdpi_activities`, `iasdpi_subactivities` e RPCs das migrações 003–004. `culto_archives` é arquivo imutável, não banco de escalas. A inspeção do banco nesta entrega refere-se às migrações versionadas: sem sessão administrativa disponível, não é comprovação das políticas instaladas no projeto remoto.

## Modelo proposto nesta fase

| Entidade | Finalidade |
|---|---|
| schedule_departments | Departamentos configuráveis, sem tabela por ministério |
| schedule_people | Identidade central, nome de exibição, ativo e vínculo opcional com Auth |
| schedule_memberships | Pessoa em vários departamentos, responsabilidade ministerial, preferências e limites opcionais |
| schedule_roles | Funções configuráveis e quantidade de referência opcional |
| schedule_qualifications | Habilitações por vínculo, com FKs compostas que impedem cruzar departamentos |
| schedule_availability | Disponibilidade/ausência semanal ou por período, geral ou departamental |
| schedule_department_access | Gestor ou visualizador explicitamente autorizado por administrador |
| iasdpi_schedule_private.person_details | Contato e observações privados, somente admin |
| iasdpi_schedule_private.audit_logs | Ator, entidade, versão, campos alterados e justificativa de homônimo |

UUIDs estáveis; versões otimistas; unicidade dos vínculos; índices de nome e escopo; referências a Auth opcionais. Nome não é identificador: Rafa e Raphael permanecem pessoas distintas. Nomes iguais exigem reutilizar um cadastro ou confirmação administrativa de homônimo com justificativa. Nenhum indivíduo é cadastrado, vinculado ou autorizado automaticamente.

Apenas quatro departamentos são semeados. Referências de liderança existentes: Sonoplastia/Luan; Diaconato/Marciano e Rose; Música/Alexandre. Os anciãos permanecem no organograma existente; funções ainda serão confirmadas. As sugestões de funções não são cadastros obrigatórios.

Disponibilidade usa datas e horas locais de `America/Sao_Paulo`; não há inferência do horário dos cultos. Regra semanal sem horário representa o dia inteiro; período pode atravessar datas. A Fase A cadastra restrições, mas ainda não valida nem publica escalas.

## Segurança

RLS habilitada e nenhum privilégio direto nas novas tabelas para anon/authenticated. Leitura e escrita somente pelas três RPCs SECURITY DEFINER, de proprietário postgres e search_path vazio; helpers privados sem USAGE/EXECUTE para clientes. Sem políticas permissivas, o REST direto é negado inclusive a administradores da aplicação.

Admin global gerencia tudo; leader global **não** recebe gestão ministerial automaticamente. Gestor explícito administra funções, vínculos, disponibilidades do seu departamento e cria participantes nesse departamento. Alterar identidade compartilhada, contatos, vínculo Auth, departamentos e acessos exige admin. Visualizador consulta seu escopo sem contatos nem preferências privadas. Participante com conta vinculada consulta somente o próprio cadastro e funções/departamentos associados. Sem vínculo/ACL não há acesso. Uma revogação global enabled=false prevalece sobre os acessos ministeriais.

Todas as mutações usam a linha de serialização já existente em `iasdpi_admin_private.control`, a mesma das revogações. CAS impede salvar uma versão antiga. Repetição do mesmo request_id usa recibos existentes, com identidade, assinatura e permissões revalidadas. Não há DELETE, autoaprovação ou associação livre. Auditoria não replica conteúdo de contato/observações. Os recibos de mutação ficam em schema privado já existente.

## Ativação e reversão

1. Confirmar 001–004 instaladas e revisar `database/005_schedule_foundation.sql`.
2. Executar 005 **somente após autorização** em homologação primeiro, como postgres. Tudo ocorre em uma transação; falha não deixa instalação parcial. Não executar novamente sobre uma instalação existente.
3. Admin abre **Escalas e agendas → Cadastros de escalas**; cadastra pessoas, vínculos e funções confirmadas. Contas não são obrigatórias.
4. Executar `database/check_schedule_foundation.sql` como postgres: consulta somente leitura que deve retornar zero irregularidades.
5. Acesso ministerial é concedido separadamente pelo admin, a uma conta existente e confirmada. Sem atribuir papel global leader para isso.
6. Homologar com contas descartáveis admin/gestor/visualizador/participante/sem acesso e repetir verificações de privilégios no ambiente real.

`database/005_schedule_foundation_down.sql` reverte somente uma instalação sem dados de usuário. Havendo cadastros, auditoria ou recibos, recusa a remoção: despublicar/reverter frontend preservando o schema é a opção segura. Nunca usar CASCADE para contornar essa proteção. Os arquivos antigos de rollback continuam intactos. A publicação atual não é alterada nesta entrega.

## Homologação da Fase A

1. Abra a prévia fictícia; cadastre pessoa e confira nome de exibição, vínculo e estado de salvamento. A prévia isolada reinicia ao recarregar e não é evidência de persistência real.
2. Após instalar 005 em ambiente autorizado, use conta admin descartável: crie pessoa uma vez, associe a dois departamentos, cadastre funções e habilitações distintas. Reabra em outro dispositivo e confira os mesmos UUIDs.
3. Registre ausência por datas e regra semanal com horas em 24h; nenhuma escala deve ser gerada. Preferências e limites são opcionais; zero difere de não informado.
4. Compare nomes semelhantes; confirme que Rafa e Raphael continuam distintos. Homônimo exato exige confirmação administrativa e motivo; não fundir automaticamente.
5. Conceda gestão a uma conta confirmada somente em Sonoplastia; confirme que não obtém permissão para Diaconato ou cultos. Visualizador não pode salvar; participante vinculado consulta só o próprio cadastro. A marca de responsável ministerial não muda permissões.
6. Tente salvar duas versões do mesmo cadastro, revogue acesso com gravação pendente, interrompa uma consulta e repita. O backend deve negar versão antiga/ator revogado; o formulário deve preservar campos nas falhas e não anunciar salvamento antes da confirmação.
7. Confira Agenda, organograma, 15 registros de Sonoplastia, Comunicação e fonte oficial dos anciãos sem importação automática. Teste inativação/reativação sem excluir históricos.
8. Execute a suíte e confira os artefatos de integridade antes de qualquer publicação. Revisão e autorização de banco e publicação continuam sendo etapas separadas.

## Próximas fases (não implementadas)

Fase B: propor schedule_events (referência externa única sem sobrescrever agenda), schedule_series, schedule_plans (departamento/mês/estado/versão), schedule_assignments (evento/função/pessoa/intervalo) e schedule_versions. Criação manual e publicação autenticada transacional, consulta por mês/departamento, importação idempotente com prévia e confirmação de identidades. Conferir quantidade por evento; nenhuma pessoa/horário desconhecido será inventado. A escala legada continuará como fonte identificada até importação confirmada. Não substituir programação de culto aprovada automaticamente.

Fase C: serviço transacional único de conflitos cruzados, indisponibilidade, cobertura, limites e exceções justificadas, serializado com a publicação. Intervalos desconhecidos geram validação parcial explícita. Fase D: sugestões e propostas equilibradas com revisão. Fase E: solicitações de troca, confirmações e notificações autorizadas; histórico imutável e pessoas afetadas.
