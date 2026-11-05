# G10.1 — Plano incremental condicionado ao inventário

**Não é roteiro de execução de SQL.** A sequência específica de migrações necessárias e qualquer SQL de instalação definitivo ficam bloqueados até receber o inventário real, esclarecer divergências e obter autorização posterior. Não executar a cadeia 001–025 por suposição.

## Etapas

| Etapa | Trabalho preparado | Critério de saída |
| --- | --- | --- |
| 0 — Identificação | Executar somente o inventário de metadados no painel; registrar nome/referência do projeto e opções Auth/Edge disponíveis | JSON/CSV completo recebido, sem segredos, projeto correto confirmado |
| 1 — Compatibilidade | Comparar tabelas, colunas, hashes de funções/policies, RLS, grants diretos/de coluna/herdados/defaults, owners, schemas expostos, PK/FK, índices, triggers e dependências | Classificação por migração: instalada, pendente, divergente ou indeterminada, com evidências; nenhuma suposição sobre 001–004 |
| 2 — Plano específico | Separar o que já está instalado e compatível do que precisa de adaptação; esclarecer funções substituídas e caminho 011 core-only | Lista exata das etapas realmente necessárias, pré-condições, checks adequados à versão e riscos; SQL definitivo somente depois da etapa 1 |
| 3 — Ensaio isolado | Reproduzir estrutura observada em PostgreSQL descartável com dados sintéticos; ensaiar somente o delta proposto, backup e recuperação | Integridade, concorrência, publicação, histórico e regressão da Cronoanálise aprovados; diferenças do Auth gerenciado ainda identificadas |
| 4 — Preparação de ativação | Revisar backup/PITR, janela de manutenção, RPO/RTO, configurações e retorno; autorizações separadas | Usuário aprova plano concreto, arquivos/checksums e ações exatas; responsável e critérios de parada definidos |
| 5 — Aplicação autorizada | Uma etapa revisada por vez, verificar resultado/checks e parar em erro; não executar down/reaplicar para “tentar novamente” | Estruturas e capacidades finais conferidas, Cronoanálise preservada, nenhum privilégio ampliado indevidamente |
| 6 — Auth/Edge e cliente | Ativar somente configurações autorizadas e gerar pacote conectado sem fixtures; validar com identidades de teste expressamente autorizadas | Compatibilidade de login por e-mail/apelido, recuperação, sessões e permissões reais; nenhuma exposição de segredo |
| 7 — Liberação gradual | Liberar o portal/módulos com dependências consistentes; acompanhar erros e preservar retorno | Aceite funcional e de segurança do usuário; publicação só mediante autorização específica |

A ordem de referência do código é 001 → 002 → … → 021 → 022 → 023 → 024 → 025, mas o **delta executável pode ser diferente ou exigir adaptação**. Se 001–004 já estiverem corretas, não serão reinstaladas. Se 011 existir sem Escalas, não anexar 005–010 sem plano próprio. Se houver divergência, interromper a cadeia padrão. A 018 não deve ser reaplicada depois da 019; a 021 não deve substituir implementações da 022–025.

## Riscos e bloqueios

| Gravidade | Risco | Controle antes de ativar |
| --- | --- | --- |
| Bloqueador | Estado real do IASD_Parada e da Auth não inventariado | Receber e revisar resultados; nenhuma instalação agora |
| Alta | 011 altera igreja, chaves, owners e RLS da própria Cronoanálise; locks exclusivos podem interromper gravações | Comparar estruturas reais, ensaiar delta e compatibilidade do frontend anterior, medir janela e revisar backup |
| Alta | Duplicar ou sobrescrever estruturas existentes por reaplicação | Classificação por objeto/implementação; arquivo e checksum registrados; instalação parcial exige correção específica |
| Alta | Considerar homologação isolada só por usar outro frontend com o mesmo Supabase | Tratar o banco existente como produção compartilhada. Testes de gravação reais dependem de autorização própria e delimitação dos dados |
| Alta | Ativar interface atual apenas com banco até 021 | Revisar dependências 022–025 ou definir pacote deliberadamente limitado; não reintroduzir aprovação retirada nem regras antigas |
| Alta | Perda de cultos novos ao restaurar backup antigo no projeto compartilhado | Restaurar primeiro em destino separado, reconciliar deltas e aprovar corte; não sobrescrever banco em uso |
| Alta | Confundir proprietário de ministério, participante, habilitação e conta Auth | Reutilizar IDs, aliases e vínculos centrais; conceder capacidades só a identidades confirmadas |
| Alta | Usar nomes padronizados como autorização para mesclar registros ou importar históricos | Prévia por grupo, referências/conflitos/versões conferidos e confirmação; não executar conciliação em migração automaticamente |
| Alta | Gravar sem permissão, expor rascunhos/contatos ou quebrar isolamento | RLS e RPCs verificadas com JWTs reais em etapa autorizada; schemas privados não expostos; política Restrito preservada |
| Média | Comparação somente por marcador/hash gerar falso positivo | Conferir cadeia de substituições, versão PG, definição específica e regras de acesso; pg_depend não descreve todo corpo PL/pgSQL |
| Média | Cookies/armazenamento de previews na mesma origem interferirem em sessões | Revisar origem, namespace, URLs e PKCE; não reaproveitar simuladores nem alterar sessão operacional sem plano |

## Backup e recuperação — preparar, não executar agora

1. Confirmar disponibilidade/retensão de backup e PITR do plano do Supabase. Registrar ponto de recuperação, RPO/RTO acordados e janela sem novas gravações quando necessária. Nesta fase não baixar backup real nem executar dump.
2. Antes da ativação autorizada, preservar esquema/dados da aplicação, histórico, permissões, owners, extensões e dependências. Proteger o backup com acesso restrito e criptografia; registrar checksum. Backups de Auth podem conter informações críticas e nunca devem ser anexados ao chat/Git.
3. Inventariar separadamente configuração do provedor: Auth/redirects/templates/SMTP, funções Edge, nomes/versões dos segredos, domínio/CSP e artefatos do frontend. Um dump PostgreSQL não recupera automaticamente gateway, configuração Auth ou arquivos de Storage.
4. Planejar recuperação de Auth e papéis gerenciados conforme os mecanismos suportados pelo Supabase; o restore local G9 no mesmo cluster não prova recuperação de identidades, SMTP ou gateway em outro projeto.
5. Ensaiar restauração em destino separado e protegido, sem apontar frontend público para essa cópia; conferir esquema, dados, constraints, RLS, grants, histórico, Cronoanálise e acesso negado aos clientes indevidos.
6. Para falha após ativação, conter somente as novas escritas afetadas conforme plano aprovado e guardar evidências. Retornar o frontend somente se compatível com o schema em uso. Não usar `DROP ... CASCADE`, apagar históricos ou executar toda a sequência de down.
7. Com gravações posteriores ao backup, preferir correção incremental ou restauração separada com reconciliação dos deltas. Restaurar por cima do IASD_Parada em uso exigirá avaliação e autorização próprias.

Há down condicionado para algumas etapas, não rollback universal. A 015 recusa dados/histórico ou dependências posteriores; a 024 recusa estados que dependem das regras novas; a 025 recusa reversão automática após gravações pelo fluxo novo. Para as demais, revisar o down existente ou recuperar por backup conforme o estado real.

## Checklist de aceitação futura

- [ ] Referência/projeto e inventário completo confirmados; nenhuma migração indeterminada no delta aprovado.
- [ ] Instalação real registrada com arquivos/checksums; owners, RLS, grants, search_path, FKs, índices e triggers compatíveis.
- [ ] Contas existentes/UUIDs e login da Cronoanálise preservados; administrador final não removido; liderança não concede acesso.
- [ ] Apelido/e-mail autenticam a mesma identidade; trocar apelido não amplia capacidades; inexistência de alias não enumera dados pessoais.
- [ ] Sessão, refresh, logout, PKCE, recuperação e revogação funcionam no provedor real; nenhuma senha própria em tabela pública.
- [ ] Cadastro central único, múltiplos departamentos e funções por pessoa, contatos privados e disponibilidade desconhecida tratados corretamente.
- [ ] Rascunho/publicação/revisão, rodízio e conflitos cruzados/CAS concorrente validados; Comunicação compatível, mês do Ancionato sem bloqueio e vagas publicadas conforme regras atuais.
- [ ] Ancionato semanal e mensal independentes; público vê somente Ancionato e eventos não restritos; demais escalas exigem autorização.
- [ ] Eventos gerais/departamentais/reservados publicam diretamente conforme capacidade; reservas exclusivas continuam protegidas.
- [ ] Fontes históricas de Sonoplastia/Comunicação/Ancionato preservadas; nada importado/mesclado sem revisão.
- [ ] Cronoanálise, modelos, Agenda, Organograma, arquivos, lixeira e histórico sem regressão.
- [ ] Backup/restauração/retorno ensaiados, deltas posteriores contemplados e testes em celular/navegadores registrados.
- [ ] Sem fixtures, credenciais reais ou segredos no pacote; flags e origens consistentes; aceite e autorização de publicação separados.

## Ações que exigem autorização posterior

- Aplicar qualquer migração, adaptação DDL, backfill, bootstrap, importação ou conciliação no banco existente.
- Criar/convidar usuários, vincular aliases, alterar permissões, redefinir senha, revogar sessões ou gravar dados de teste reais.
- Publicar Edge Functions, definir/rotacionar segredos ou alterar Auth/SMTP/redirects/Data API/RLS/configurações do projeto.
- Fazer backup/exportação de conteúdo real, criar destino com cópia real, executar restauração/PITR ou alterar dados recuperados.
- Gerar/ativar frontend conectado ao IASD_Parada, substituir simuladores, alterar flags persistentes, fazer commit/push/merge ou publicar.

A preparação do inventário somente leitura já está no escopo desta solicitação. **O próximo passo é receber os resultados, não instalar estruturas.**
