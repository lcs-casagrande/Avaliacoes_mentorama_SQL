# IASDPI — G6: auditoria e homologação integrada

Revisão concluída em 03/11/2026, fuso America/Sao_Paulo. Branch `feat/schedule-management-b1`, HEAD `a77b48b`. O checkout contém trabalhos acumulados sem commit de B1–B1.2 e G1–G5; foram preservados. Não houve commit, merge, push, deploy, criação de contas reais ou consultas/alterações no Supabase de produção.

**Parecer: apta para homologação demonstrativa, ainda não liberada para ativação real.** Há pendências de configuração/validação real e diferenças funcionais entre demonstrações e persistência que precisam ser resolvidas ou explicitamente delimitadas antes da ativação completa.

## Evidências e limites

- PostgreSQL 17 descartável em Docker, `--network none`: migrações, papéis, RPCs, RLS, integridade e concorrência com identidades e dados fictícios. Parte da execução usa I/O sem fsync/synchronous_commit/full_page_writes para reduzir custo do ambiente; não é um ensaio de durabilidade após crash ou de PITR.
- Chromium local: frontend e SDK Supabase reais com provedor Auth/RPC demonstrativo, sem chamadas externas. Larguras 360, 390, 768, 1024 e 1440 px.
- Node: handlers das Edge Functions com transporte e Auth simulados.
- Inspeção estática: migrações 005–015, permissões, auxiliares, reversões, navegação e integração.
- Não foram testados JWTs emitidos pelo Supabase real, painel Auth, SMTP, entrega de e-mail, sessões reais, gateways Edge, nem aparelhos físicos Android/iPhone ou Safari/Firefox. Esses itens permanecem pendentes.
- A tentativa anterior de regressão ampla perdeu seus logs temporários com a renovação do ambiente; ela não foi contabilizada como comprovação final. As verificações repetidas possuem logs persistentes em `dist/governance-g6/`.

**164 testes locais distintos aprovados nas verificações consolidadas, incluindo 20 novos da G6. Nenhuma falha remanescente nesses testes.** Não foi executada toda a suíte histórica do repositório.

| Grupo | Aprovados |
| --- | ---: |
| SQL G6 — cadeia completa, matriz de perfis e diagnóstico | 11 |
| SQL G5 — persistência, RLS, conflitos, concorrência e histórico | 23 |
| SQL G3 — delegação, recuperação, revogação e sessões | 22 |
| Chromium — G6, regressões de portal/identidade/escala e pacote | 86 |
| Node — login por apelido e recuperação controlada | 22 |
| Total sem duplicar reexecuções | **164** |

Evidência: `dist/governance-g6/test-results.json`, logs SQL/Edge, `browser-initial-evidence.log`, `family-music-fixed-date-evidence.log` e `browser-consolidated-results.json`. A rodada inicial de 86 testes do navegador teve duas falhas e um erro porque três cenários históricos pressupunham novembro/2026, enquanto o relógio atual gerava dezembro. O relógio foi fixado somente nessa fixture histórica, e seus dez cenários foram reexecutados e aprovados. Os outros 76 já estavam aprovados. As datas da aplicação continuam automáticas.

Os testes de banco aplicam as migrações em instâncias lógicas descartáveis; não são execuções no Supabase real. O teste de rollback reproduz deliberadamente a limitação G6-03 no banco descartável. A leitura de marcadores também foi executada em banco vazio: 11 ausências reportadas sem alterações.

Um teste de diagnóstico pode passar justamente por reproduzir uma limitação. Isso **não** transforma a funcionalidade limitada em aprovada. As situações funcionais estão classificadas abaixo.

## Migrações e arquitetura

Foram encontrados os 11 arquivos forward de 005 a 015, sem números ausentes ou duplicados. Arquivos `_down.sql` são reversões, não migrações adicionais. Os arquivos de verificação e `supabase-archives.sql` não entram na sequência: este último está explicitamente desativado como legado.

| Ordem | Arquivo | Responsabilidade | Dependência principal |
| --- | --- | --- | --- |
| 005 | `005_schedule_foundation.sql` | Pessoas, departamentos, vínculos, funções, habilitações, disponibilidade, acesso e auditoria | 001–004 |
| 006 | `006_schedule_management.sql` | Eventos, planos, vagas, atribuições e versões | 005 |
| 007 | `007_daily_schedules.sql` | Planejamento por dia, preferências, meses futuros e exceções | 006 |
| 008 | `008_monthly_rotation.sql` | Contexto de rodízio e workspace mensal | 007 |
| 009 | `009_confirmed_schedule_conflicts.sql` | Compromissos confirmados, referências vinculadas e revalidação | 008 |
| 010 | `010_simple_daily_schedules.sql` | Participação diária genérica; preferências sem proibição manual | 009 |
| 011 | `011_church_isolation.sql` | IASD_PI, isolamento por igreja, FKs compostas, executor sem BYPASSRLS | 005–010 e tabelas operacionais anteriores |
| 012 | `012_alias_login.sql` | Apelidos privados, limites antiabuso e ponte de login institucional | 011 |
| 013 | `013_access_governance.sql` | Capacidades ministeriais, fila de recuperação, revogação e épocas de sessão | 012 |
| 014 | `014_portal_integration.sql` | Contexto do portal, igrejas autorizadas e projeção pública | 013 |
| 015 | `015_elder_period_storage.sql` | Períodos semanais/mensais, versões e conflitos do Ancionato | 014 |

A ordem de ativação é **001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015**, executando apenas o que estiver ausente e validado. Não reaplicar etapas instaladas nem concatenar tudo indiscriminadamente.

A cadeia completa foi instalada nos bancos descartáveis dos testes G6. Isso comprova compatibilidade da ordem local; não identifica o estado de produção. Não há ledger versionado próprio que certifique hashes e ordem efetivamente aplicados. Use `check_governance_readiness.sql` para levantar marcadores estruturais e confronte-os com o histórico administrativo. Objetos presentes não certificam qual versão do arquivo foi executada.

O inventário estático com hashes SHA-256 está em `dist/governance-g6/migration-inventory.json`. As migrações 005–015 não foram alteradas nesta auditoria. A comparação com os artefatos G5 confirma a preservação dos arquivos operacionais que constavam daquele manifesto.

### RLS, funções, índices e integridade

O levantamento do catálogo local incluiu 20 tabelas no recorte consultado, 113 funções, 73 índices de tabelas `schedule_*` e 34 políticas públicas de escalas. As contagens e definições estão em `catalogue-evidence.json`; não são uma medição de desempenho.

- As tabelas de escalas não concedem leitura/escrita direta aos clientes. O isolamento de igreja é aplicado por RLS restritiva; as capacidades departamentais são verificadas pelas RPCs. Não confundir isso com SELECT direto liberado por departamento.
- `iasdpi_church_executor` é NOLOGIN/NOBYPASSRLS. As RPCs operacionais e auxiliares usam proprietário e `search_path` controlados. As pontes que legitimamente consultam identidades/associações são excepcionadas e restritas.
- Chaves estrangeiras compostas impedem associar pessoa, departamento ou período de outra igreja. Unique/CAS impedem duplicação e sobrescrita concorrente.
- O lock de controle é reutilizado em alterações e publicação. Conflitos e permissões são revalidados no backend; ocultar botões não é a proteção.
- Versões publicadas continuam públicas durante uma revisão privada. Rascunhos nunca entram na projeção anônima. Semanas do Ancionato participam dos conflitos; ancião do mês mantém a exceção aprovada de não reservar dias.
- As rotinas privadas de apelidos e conclusão de recuperação só são utilizáveis pelo servidor autorizado. Os handlers revalidam Auth/escopo e não devolvem resolução pública de e-mail.
- Não foi encontrado segredo administrativo concreto no conjunto estático da demonstração. O frontend de produção continua recebendo apenas configuração pública; nenhum segredo foi lido ou incluído nesta entrega.

## Matriz de perfis

| Perfil simulado | Resultado esperado | Resultado observado local | Situação |
| --- | --- | --- | --- |
| Administrador geral | Somente igrejas explicitamente autorizadas | A identidade com duas autorizações em banco descartável consultou as duas; não ganhou acesso a departamentos externos por trocar o header | Aprovado local |
| Administrador da IASD_PI | Gerir a IASD_PI, sem acesso cruzado | Consulta/gestão na IASD_PI; contexto de igreja não autorizada recusado | Aprovado local |
| Líder de Sonoplastia | Consultar/editar/publicar Sonoplastia | Demais departamentos recusados; Cronoanálise exige autorização própria | Aprovado local |
| Líder de Música | Gerir Música e equipes | Equipe com duas pessoas salva e publicada sem duplicar participantes | Aprovado local |
| Líder do Ancionato | Semanas e meses independentes | Rascunho semanal e publicação mensal coexistem; somente publicados entram no calendário | Aprovado local |
| Múltiplos departamentos | Alternar sem novo login | Mesma identidade conserva as permissões e os conflitos cruzados | Aprovado local |
| Visitante | Portal, Agenda, Organograma e publicados | Páginas públicas acessíveis; contexto privado e escrita recusados | Aprovado local |

Não existe um novo papel irrestrito denominado `superadmin`. Os nomes reais gerais continuam `admin` e `leader`; capacidades ministeriais são vinculadas à identidade e à igreja. “Administrador geral” descreve o alcance autorizado, não uma credencial que atravessa automaticamente todas as igrejas. A prévia lista somente IASD_PI.

## Homologação dos fluxos

| Cenário | Esperado | Observado e evidência | Situação |
| --- | --- | --- | --- |
| Selecionar igreja e entrar por apelido | Identidade estável, sem privilégios derivados do apelido | SDK/alias simulados no navegador; resolução privada e permissões verificadas em PostgreSQL; handlers testados em Node | Aprovado local; gateway real pendente |
| Cadastro central | Um UUID pode pertencer a vários ministérios | Nome duplicado recusado, vínculos múltiplos preservados e Rafa/Raphael/Raphael Moreira separados | Aprovado local |
| Disponibilidade semanal | Preferência orienta o automático; manual não é proibido | Flag semanal salva; rodízio não sugeriu o dia indisponível. Override manual permitido e auditado no PostgreSQL | Aprovado local; estado de ativação deve ser confirmado |
| Montagem e equipes | Calendário mensal e seleção de várias pessoas | Música com duas pessoas, salvamento e reabertura; cada atribuição permanece identificada | Aprovado local |
| Rodízio e conflitos | Sugestão editável; bloquear compromissos incompatíveis | Propostas editáveis e conflito cruzado detectado. Há ressalva de contagem durante revisão de publicação, abaixo | Aprovado com ressalva |
| Rascunho e publicação | Rascunho privado; publicar revalida | Projeção pública vazia antes da publicação; notas privadas não expostas | Aprovado local |
| Editar publicado | Mesmo ID e versões anteriores preservadas | Revisão privada mantém última publicação e cria histórico; CAS e requisições idempotentes testados | Aprovado local |
| Concorrência | Não confirmar duas publicações incompatíveis | Testes PostgreSQL de G3/G5 usam conexões concorrentes e snapshots obsoletos | Aprovado local |
| Revogar | Bloquear novas operações ministeriais | Publicação recusada depois da revogação. Login pode continuar se houver autorização independente de Cronoanálise; revogação global também bloqueia a identidade | Aprovado local |
| Recuperação administrativa | Pedido, verificação, link expirável/único, troca e revogação de sessões | Fluxo demonstrativo navegável; RPCs e sequência do handler testadas isoladamente | Aprovado local; Auth real pendente |
| Ancionato | Semana domingo–sábado e mês separados | UUID estável na virada do mês; mês não bloqueia outros ministérios; publicação por modalidade | Aprovado local |
| Cronoanálise | Preservar seu login e autorização | Perfil ministerial não recebe acesso global por entrar nas escalas; caminho/formulário original preservado | Aprovado no recorte testado |
| Agenda e Organograma | Permanecer públicos e preservar fontes | Navegação testada; 15 registros Sonoplastia e 5 Comunicação mantidos como referência histórica | Aprovado local |

## Achados e correções necessárias

| ID | Gravidade / tipo | Evidência | Impacto e correção necessária |
| --- | --- | --- | --- |
| G6-01 | Alta — bloqueante de ativação | Não houve acesso autorizado ao painel/serviços reais; flags G1–G4 permanecem false | Homologar Auth, Edge, sessões, CORS, recuperação e RLS com contas descartáveis em ambiente real autorizado. Código declarado não comprova funcionamento real. |
| G6-02 | Alta — diferença funcional confirmada | `database/007_daily_schedules.sql:21` contém dias globais, sem `department_weekdays`; teste G6 criou Comunicação e um evento de quarta-feira foi aceito | A regra aprovada de Comunicação somente aos sábados está na demonstração, não na parametrização persistente. Preparar configuração departamental e geração/filtro coerentes antes de ativar esse fluxo completo. Não foi criada migração corretiva nesta auditoria. |
| G6-03 | Alta — rollback operacional confirmado | `database/008_monthly_rotation_down.sql:4` verifica apenas a função antiga; linhas 8–13 removem RPCs atuais. Reprodução após 015 confirmou a remoção de `iasdpi_schedule_rotation_context` | Não utilizar esse down após migrações posteriores. Adotar rollback de pacote e correção progressiva; incluir guardas de versão antes de autorizar qualquer reversão estrutural. Não houve perda de dados no teste. |
| G6-04 | Média — verificação incompatível | `database/check_schedule_management.sql:10` exige proprietário postgres; G1 transfere corretamente para executor. `check_schedule_foundation.sql` também trata políticas novas como inesperadas | Os checks antigos são válidos apenas para suas etapas. Entregue `check_governance_integration.sql` para a cadeia final, junto aos verificadores 011–015. Não corrigir permissões seguras para satisfazer um check antigo. |
| G6-05 | Média — limitação confirmada na resposta SQL | `database/015_elder_period_storage.sql:195` une compromissos confirmados sem excluir o próprio plano em revisão; teste preserva `global_days` da publicação anterior | Pode restringir indevidamente a proposta automática ao mover participações com limite mensal. A resposta SQL foi reproduzida; o impacto sobre cada formulário completo depende da combinação de limite/datas. Excluir a própria publicação do cálculo da proposta em revisão, mantendo a reserva pública para outros departamentos. Edição manual continua disponível. |
| G6-06 | Média — código inspecionado | `frontend/schedule-foundation.js:104` expõe limite consecutivo e quantidade desejada; o motor em `frontend/schedule-management.js` não usa esses dois campos | Não apresentar esses parâmetros como critérios aplicados pelo automático. Implementar/testar a semântica ou retirar a promessa até sua implementação. Não foi inventada uma regra adicional nesta auditoria. |
| G6-07 | Média — configuração/onboarding | A 005 cadastra somente quatro departamentos (`:271`); participantes, aliases ativos e históricos vinculados não são importados do Organograma automaticamente | Cadastrar/vincular os demais departamentos e identidades após conferência humana, com IDs estáveis. A prévia usa nomes conhecidos, mas isso não significa cadastro operacional real já existente. |
| G6-08 | Baixa — navegação inspecionada | `frontend/schedule-management.js:551` limita a barra do Ancionato a seis departamentos; a barra diária usa um disclosure após seis (`:226`) | Administrador com sete departamentos encontra Sonoplastia no workspace superior; a navegação do Ancionato não oferece o mesmo fallback. Padronizar o acesso sem reconstruir o calendário. |
| G6-09 | Média — destino de navegação, validação adicional recomendada | `frontend/governance.js:35` mantém “Entrar” em `#login`, que representa o login da Cronoanálise na G4 | Após recuperação de um líder só ministerial, o atalho pode conduzir ao formulário errado. Rever destino para portal/login ministerial; não foi declarado teste no Supabase real desse comportamento. |

Não foi demonstrada perda de registros ou acesso cruzado indevido nos testes executados. Isso não elimina as pendências nem equivale a uma auditoria de penetração completa.

As correções G6-02, G6-03, G6-05 e G6-06 **não foram aplicadas ao código operacional ou às migrações existentes**: esta etapa entrega o diagnóstico antes da ativação. Foi entregue a ferramenta conjunta de verificação, que resolve a ambiguidade de G6-04 sem reescrever verificadores históricos.

## Prévia integrada

Arquivo: `dist/governance-g6/IASDPI-G6-homologacao.html`.

Contas fictícias, senha inicial **`Demonstracao#2026`**:

| Conta | Alcance demonstrativo |
| --- | --- |
| `admin.geral.teste` | Administração, limitada à IASD_PI listada |
| `admin.pi.teste` | Administração da IASD_PI |
| `som.teste` | Sonoplastia |
| `musica.teste` | Música |
| `anciao.teste` | Ancionato |
| `multi.teste` | Sonoplastia e Música |

Há contas adicionais de edição/leitura na lista expansível da própria prévia. Sem login, consultar portal, agenda, organograma e calendário público.

O catálogo reaproveita os nomes informados; não funde nomes semelhantes. Vínculos usados para simular testes, preferências, permissões e novas atribuições são demonstrativos. O teste que coloca Luan também na Música não é uma confirmação real de habilitação. As fontes históricas públicas continuam distintas das novas publicações simuladas.

Para homologar disponibilidade sem reativar produção, a composição G6 expõe os controles existentes apenas no ambiente demonstrativo. O planejamento do Ancionato começa vazio; referências da Agenda permanecem no calendário público, sem importação automática. Publicações, recuperação e permissões simuladas reiniciam ao recarregar.

A prévia é um HTML independente com CSP `connect-src 'none'` e transporte simulado. Usa namespace `iasdpi-g6-preview-v1`, sem gravar nos dados locais do site oficial. Não contém a configuração real do Supabase nem contatos privados. Uma simulação JavaScript não comprova segurança do servidor; os testes PostgreSQL e Edge são evidências separadas.

Reprodução:

```bash
python scripts/export_preview.py --governance-audit-preview --output dist/governance-g6/IASDPI-G6-homologacao.html
python scripts/audit_governance_inventory.py
```

Roteiro visual: entrar → escolher departamento → revisar Membros/Cadastros → montar ou pré-preencher → salvar rascunho → conferir calendário público → publicar → conferir calendário → revisar publicação → consultar histórico. Para recuperação: Solicitar acesso → pedir recuperação de `som.teste` → entrar como administrador → Solicitações → registrar verificação fictícia → emitir link → definir senha exclusivamente fictícia. Nenhuma mensagem é enviada.

## Arquivos preparados na G6

- `database/check_governance_readiness.sql`: marcadores estruturais somente leitura, utilizável antes da cadeia completa.
- `database/check_governance_integration.sql`: verificação somente leitura após 015.
- `scripts/audit_governance_inventory.py`: inventário e hashes locais.
- `scripts/governance_audit_preview.py`: composição isolada com nomes informados.
- `scripts/export_preview.py`: opção G6, mantendo modos anteriores.
- `tests/fixtures/governance-integration-preview.js` e hooks condicionais em `portal-integration-preview.js`: simulação G6, excluída do pacote de produção.
- `tests/test_governance_integration_sql.py`, `tests/test_governance_integration_browser.py`: cenários integrados e diagnósticos reproduzíveis.
- `tests/test_schedule_family_music.py`: relógio fixo apenas para os cenários históricos de novembro/2026; evita dependência do mês do host.
- Este relatório, checklist de ativação e artefatos em `dist/governance-g6/`.

## Próxima decisão

Revisar os achados, delimitar a primeira ativação e autorizar separadamente as correções necessárias e a homologação em Supabase não produtivo. A ordem exata, backup, rollback e verificações reais estão em `docs/governance-g6-activation-checklist.md`.

Não iniciar ativação, migração corretiva, merge ou publicação automaticamente.
