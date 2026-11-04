# G7 — Confiabilidade dos dias, rollback e preparação de Auth

Branch: `feat/schedule-management-b1`. Continuação do checkout com B1–G6, sem reset das alterações anteriores. Não houve commit, merge, push, publicação, acesso ao Supabase real, criação de conta real ou configuração de segredos.

## Diagnóstico e correções

| Achado | Correção e efeito |
| --- | --- |
| G6-02: configuração de dias somente global | Migração 016 acrescenta `schedule_departments.planning_weekdays`, reutilizando UUID, igreja, versão, RLS e auditoria existentes. Cada departamento pode salvar sua escolha. |
| Geração e proposta divergiam da configuração | RPC geradora usa os dias do departamento e datas extraordinárias existentes. Contexto de rodízio inclui a configuração; frontend cria novas vagas/propostas apenas para esses dias. Seleções já preenchidas e escalas anteriores são conservadas. |
| G6-03: down antigo podia remover RPCs posteriores | Guardas nos downs 005/006/008; novo down 015 exclusivamente vazio, transacional e sem CASCADE. Dados, histórico ou etapa posterior impedem a reversão. |
| Geração criava vagas, mas perdia a confirmação visual | Confirmação agora aparece após montar as vagas e informa a necessidade de revisar/salvar o rascunho. Não afirma que as atribuições foram salvas quando apenas os eventos foram confirmados. |
| Erro de RPC 016 ausente pouco específico | Frontend identifica a dependência da 016. Modo de consulta permite a nova leitura, mas continua bloqueando sua RPC de escrita. |

## Dados e permissões

A 016 é incremental, `BEGIN`/`COMMIT`, sem apagar tabelas ou registros. Não deve ser reaplicada. Exige cadeia 001–015 completa. Não cria nova tabela de pessoas, igrejas ou permissões.

- Departamentos novos: quarta, sábado e domingo (`[3,6,0]`). Departamentos existentes herdam a configuração global da própria igreja, inclusive escolhas personalizadas anteriores.
- Array vazio é permitido: nenhuma data recorrente; datas extraordinárias globais explicitamente cadastradas continuam incluídas. Não apaga eventos ou escalas existentes.
- Administração dos dias: papel `admin` da igreja, ou capacidade departamental `members`/`access`. Somente `edit` ou `publish` não concede essa administração. A autorização é verificada no PostgreSQL, sob o controle transacional existente, e revalidada após adquirir o lock.
- RPCs novas: `iasdpi_schedule_department_days(uuid)` e `iasdpi_schedule_department_days_save(uuid,bigint,smallint[],uuid)`. Salvamento com compare-and-swap da versão do departamento, recibo idempotente e auditoria.
- Wrappers mantêm assinaturas de settings, geração e contexto. A configuração global de meses/datas extraordinárias continua administrativa. Mudança de dias globais pelo cliente antigo é recusada com instrução explícita para configurar o departamento.
- Todas as novas funções privadas e públicas ficam sob executor sem login, SECURITY DEFINER e search_path vazio. Helpers/implementações antigas ficam privados; somente RPCs públicas são concedidas a authenticated. Anônimo não configura nem lê a configuração privada.
- Não muda RLS das tabelas operacionais nem autorizações atuais. Checks finais validam a cadeia e a nova coluna, sem concessão direta de escrita.

Dias são parâmetros de **geração e sugestão**, não uma proibição retroativa de datas manuais. O administrador pode conservar atribuições anteriores ou extraordinárias. Comunicação precisa ser explicitamente configurada para sábado após instalação autorizada; a 016 não inventa uma parametrização real a partir da demonstração. O demo conserva seu sábado já aprovado.

Ancionato: semana domingo–sábado e mês completo continuam independentes, com seus IDs, versões e publicação próprios. Selecionar dias de geração diária não recorta semanas/meses; a responsabilidade mensal continua fora do bloqueio cruzado, conforme a regra existente.

## Interface e prévia

Na montagem, abrir **Dias de escala · departamento**, marcar dias e **Salvar dias do departamento**. A confirmação só ocorre após resposta válida. Falha mantém seleção; conflito de versão pede recarregamento/comparação. A configuração compartilha a versão do departamento com seu cadastro; edição concorrente de qualquer campo pode exigir recarregar.

O botão **Gerar dias do período** reaproveita a geração existente para acrescentar datas configuradas, sem limpar vagas. Depois revisar/preencher e salvar/publicar a escala pelas ações já existentes. Período permanece contado a partir do próximo mês em America/Sao_Paulo.

Prévia: `dist/governance-g7/IASDPI-G7-revisao.html`, standalone, CSP connect-src none, provedor fictício e armazenamento separado. Nenhuma requisição externa foi permitida nos testes da prévia. Contas/senhas/preferências são fictícias; nomes e fontes históricas conhecidos permanecem referências. Alterações reiniciam ao recarregar. Isso não demonstra persistência em Supabase; persistência SQL foi testada separadamente.

Entrar em **Montar escala**, escolher IASD_PI, usar `admin.pi.teste` / `Demonstracao#2026` (somente a demonstração). `som.teste` tem administração de membros em Sonoplastia; `multi.teste` pode editar/publicar seus dois departamentos, mas não administrar seus dias. Senha fictícia igual para esses cenários de demonstração; não é política para contas reais.

## Testes e evidências

**152 testes distintos aprovados; zero falhas e zero skips nas execuções finais.**

| Conjunto | Aprovados |
| --- | ---: |
| Novos cenários SQL G7 | 15 |
| Ancionato G5 reexecutado sobre 016 | 23 |
| Governança G6 reexecutada sobre 016 | 11 |
| Interface G7 integrada em Chromium | 17 |
| Regressão Cronoanálise, rascunhos, Agenda, Organograma e pacotes | 64 |
| Handlers Edge em Node | 22 |
| **Total distinto** | **152** |

A restauração ampliada foi repetida separadamente e passou; sua repetição não aumenta o total acima. O container exclusivo de PostgreSQL foi removido ao concluir os testes.

Resultados finais e comandos: `dist/governance-g7/test-results.json` e logs no mesmo diretório. A seleção de regressão cobre diretamente o escopo G7; não representa reexecução integral de todos os testes históricos do repositório.

- PostgreSQL 17 descartável, container exclusivo `--network none`, bancos independentes por teste. Migrações 001–016 instaladas somente nas fixtures. Nenhum endpoint ou banco real acessado.
- Novos testes: configuração por departamento, arrays inválidos/vazios, permissão/revogação/escopo de igreja, CAS e retry idempotente, geração, preservação de publicações, guardas de rollback, 015 vazia → 014 → reinstalação e recusa com dados/dependências.
- Regressões G5/G6 no schema 016: conflitos e concorrência reais com conexões PostgreSQL separadas, isolamento, publicações, rascunhos e revisões, versões, permissões e modalidades do Ancionato.
- Backup: dump custom e restore em banco novo; comparação ampliada dos hashes de **todas as tabelas public/auth/iasdpi_*** da fixture. Verificação de RLS e leitura anônima negada após restauração. Não cobre Auth hospedado, SMTP, MFA, Storage ou PITR reais.
- Chromium desktop: navegação, falha/retry, seleção preservada, bloqueio de alteração não salva, conflito de versões, geração após mudar dias, rodízio, períodos completos, perfis, recuperação simulada, calendário público e regressões principais. Capturas mobile/desktop em `g7-mobile.png`/`g7-desktop.png`; larguras 360,390,768,1024,1440.
- Node: handlers de alias e recuperação, incluindo erros, enumeração, autorização e falhas simuladas.
- Pacote: validação de inventário/hashes e rollback de versões anteriores; fixtures e senhas demonstrativas não entram no pacote operacional.

Foram preservados logs das tentativas iniciais: dois seletores novos precisaram de ajuste e houve uma confirmação de geração substituída por aviso de rascunho, corrigida antes do resultado final. Uma execução paralela foi interrompida após timeouts; os cenários foram repetidos em sequência. Tentativas interrompidas e repetições não são somadas como novos testes aprovados.

## Arquivos do trabalho G7

| Grupo | Arquivos |
| --- | --- |
| Banco novo | `database/016_department_schedule_days.sql`, `database/check_department_schedule_days.sql`, `database/015_elder_period_storage_down.sql` |
| Guardas em reversões existentes | `database/005_schedule_foundation_down.sql`, `database/006_schedule_management_down.sql`, `database/008_monthly_rotation_down.sql` |
| Frontend | `frontend/schedule-management.js`, `frontend/auth.js` |
| Prévia | `scripts/export_preview.py`, `tests/fixtures/department-days-preview.js` |
| Testes | `tests/test_department_days_sql.py`, `tests/test_department_days_browser.py`, `tests/test_governance_integration_sql.py` (expectativa da guarda corrigida e destino de evidência parametrizável) |
| Documentação | Este relatório, `docs/governance-g7-rollback.md`, `docs/governance-g7-controlled-checklist.md` |
| Artefatos de revisão | HTML/ZIP, capturas, logs, inventário e hashes em `dist/governance-g7/`; não são deploy. |

Os demais arquivos já modificados/não rastreados pertencem ao trabalho acumulado anterior e foram preservados; esta lista não é o git status completo do checkout.

## Pendências e riscos

| Classificação | Pendência |
| --- | --- |
| Bloqueante para ativação real | G6-01: Auth/Edge reais, secrets, CORS, gateway, SMTP, PKCE, renovação/revogação e recuperação completa não homologados no provedor. Seguir checklist controlado. |
| Bloqueante para usar G7 em produção | Aprovação e aplicação ordenada das migrações ausentes até 016, checks reais, backup homologado e parametrização departamental. Nada disso foi executado. |
| Importante | G6-05: carga da própria publicação anterior pode restringir propostas com limite mensal durante revisão. Continua reproduzida; edição manual permanece alternativa. Fora das correções solicitadas nesta G7. |
| Importante | G6-06: quantidade desejada e limite de consecutivas do cadastro não são critérios aplicados pelo motor atual. Não prometer cumprimento desses campos na ativação. |
| Importante | G6-07: onboarding real de departamentos, pessoas, apelidos e vínculos exige revisão humana; não inferir permissões do Organograma nem mesclar nomes semelhantes. |
| Importante | G6-09: atalho após recuperação aponta para login da Cronoanálise; homologar destino do líder ministerial antes da abertura desse fluxo. |
| Melhoria futura | G6-08: navegação de mais de seis departamentos a partir do Ancionato usa o workspace superior como alternativa. |
| Pendente de validação | Safari/Firefox, Android/iPhone físicos e restauração gerenciada de Auth/Storage não testados. Emulação de largura não comprova dispositivos reais. |

Os bloqueios técnicos G6-02/G6-03 possuem correções locais testadas. **Candidata disponível para revisão; ativação real ainda não liberada.** Não iniciar outras funcionalidades nesta entrega.

## Revisão sugerida

1. Abrir a prévia e testar admin, editor/publicador e acesso a outro departamento.
2. Salvar somente sábado, gerar período, comparar vagas e pré-preencher. Manter datas/atribuições antigas.
3. Abrir Ancionato, trocar modalidade, conferir semana completa e 12 meses; configuração diária não deve reduzir períodos.
4. Ler SQL 016 e procedimento de rollback; conferir inventário e resultados dos testes.
5. Aprovar separadamente homologação real conforme checklist. Não aplicar down nem SQL estrutural em produção por este relatório.

Commit sugerido, **não executado**: `fix: persiste dias por departamento e protege rollback de escalas`.
