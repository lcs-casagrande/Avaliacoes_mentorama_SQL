# Entrega técnica — Gestão de Escalas, Fase A

## Resultado

Implementada na branch **feat/schedule-foundation-phase-a**, baseada em **a77b48b8f29f70be2984e9e799c8a5c352579648**. Árvore inicialmente limpa. A main remota consultada continua nessa base; publicação atual **d60965703db487d0c232bb152a965a816056e350**, GitHub Pages em gh-pages, raiz. Lotes 1–6 e atualização dos ministérios estão presentes na base. Nenhum commit, merge, push ou deploy desta entrega.

**455 testes aprovados, zero falhas, zero ignorados**, em 439,923 s na execução final. Mantidos os 399 casos existentes, acrescidos de 56: **33 PostgreSQL, 18 navegador e 5 pacote**. A execução preliminar teve dois problemas de teste, corrigidos antes da execução final: caminho de bundle com query string e offset residual de milissegundos ao congelar o relógio de uma fixture. Asserções originais de horário foram preservadas. O teste de manifesto desconhecido agora rejeita versão 3, pois a versão 2 é suportada.

## Diagnóstico e arquitetura

Agenda pública em `frontend/agenda.js`, escalas manuais em JavaScript e fonte oficial independente em `frontend/agenda-data.js`; organograma e ministérios em `frontend/organization.js`. Supabase operacional de cultos e arquivo imutável continuam separados. Perfis globais reais são admin/leader em iasdpi_access, conforme SQL e frontend. Não houve acesso administrativo ao Supabase remoto para atestar o schema instalado.

Modelo da Fase A: sete tabelas públicas (departamentos, pessoas, vínculos, funções, habilitações, disponibilidades e acessos departamentais), duas privadas (contatos/observações e auditoria). Reutiliza os mecanismos existentes de serialização e recibos; não cria tabelas de cultos, agenda ou usuário Auth redundantes. Eventos, atribuições, séries e versões de escalas ficam para fases posteriores. Detalhes: [modelo e ativação](schedule-foundation.md).

RLS das novas tabelas é default-deny; nenhuma leitura/escrita direta para anon/authenticated. Três RPCs autenticadas SECURITY DEFINER fazem leitura com escopo, edição com CAS e consulta administrativa de dados privados. Funções de proprietário postgres, search_path vazio e helpers privados inacessíveis aos clientes. Admin gerencia tudo; gestor e visualizador exigem ACL explícita; participante é vinculado opcionalmente à própria conta. Leader global e responsável no organograma não recebem acesso ministerial automático. Desativação global prevalece sobre ACL ministerial. Nenhuma chave administrativa foi adicionada ao frontend.

## Implementado

- Entrada **Escalas e agendas → Cadastros de escalas**, também na navegação.
- Pessoas com nomes de exibição, ativação/inativação e vínculo opcional com conta confirmada. Contato e observações somente para admin; nenhuma criação de login obrigatória.
- Vários departamentos por pessoa, responsabilidade ministerial, habilitações e preferências/limites opcionais por vínculo.
- Departamentos configuráveis e funções confirmadas pelo gestor, sem tornar exemplos obrigatórios.
- Disponibilidades semanais ou por período; horas em 24h, datas brasileiras, sem inferir horários dos cultos.
- Busca de conta pelo e-mail exato usando RPC administrativa existente; identificação não autoriza antes de salvar.
- Busca de cadastros, filtro departamental, campos preservados em falhas, estados de carregamento/erro/vazio, repetição segura e aviso de alterações pendentes.
- UUIDs, integridade referencial, unicidade dos vínculos, controle de versões, rejeição de campos indevidos e auditoria. Rafa e Raphael permanecem distintos; homônimo exige confirmação administrativa justificada.
- Referências de liderança existentes identificadas como referências do organograma. A migração semeia somente quatro departamentos; não cria pessoas, contas, atribuições ou permissões por inferência.
- Consulta das fontes legadas preservadas, sem importação automática. Sonoplastia mantém 15 registros, Comunicação mantém cinco; anciãos continuam vinculados à fonte oficial.
- Manifesto de pacote versão 2 exige o novo módulo e valida hashes/SRI. Aceita pacotes anteriores íntegros no formato 1. Adaptador fictício de prévia excluído do pacote de produção.

## Arquivos alterados

| Grupo | Arquivos |
|---|---|
| Novo módulo | frontend/schedule-foundation.js |
| Integração | frontend/agenda.js, frontend/app.js, frontend/auth.js, frontend/index.html, frontend/navigation.js, frontend/actuals.js |
| Estilo | frontend/styles.css |
| Banco | database/005_schedule_foundation.sql, database/005_schedule_foundation_down.sql, database/check_schedule_foundation.sql |
| Pacotes e prévia | scripts/build_homologation.py, scripts/export_preview.py |
| Testes novos | tests/test_schedule_foundation_sql.py, tests/test_schedule_foundation_browser.py, tests/test_schedule_foundation_package.py, tests/fixtures/schedule-foundation-preview.js |
| Fixtures existentes | tests/test_hour_format.py, tests/test_package_validation.py |
| Documentação | docs/schedule-foundation.md, docs/schedule-foundation-report.md |

Módulos de persistência de cultos, rascunhos, conflitos e histórico, backend, modelo padrão, organograma, snapshot da agenda e migrações 001–004 permaneceram idênticos à base, conferidos por SHA-256. agenda.js recebeu somente o acesso ao cadastro; os dados manuais estão preservados. Nenhum registro real foi consultado ou alterado durante testes.

## Evidências de teste

- PostgreSQL 17 em container descartável **sem rede**, auth.users e claims fictícios; bancos criados/removidos por teste. Cobertura de admin, gestor, visualizador, participante, anônimo e não autorizado; negação de acesso direto/privado; escopo cruzado; vínculo Auth; contatos; revogação durante gravação; retries; concorrência; campos parciais; homônimos; disponibilidade; down guardado; consulta de irregularidades.
- Chromium headless com Supabase HTTP simulado: criação, edição, reabertura após reload, dois departamentos por pessoa, funções/habilitações, indisponibilidade, erro/retry, formulário preservado, navegação pendente, login ministerial sem liberar cultos, lookup, fontes, teclado/foco e textos longos.
- Capturas e medição de overflow em **360, 390, 768, 1024 e 1440 px**. Nenhum estouro horizontal nos cenários de lista/formulário. Verificação visual de capturas mobile e desktop. Não equivale a teste em Android/iPhone físicos, Firefox ou Safari.
- Pacote real carregado localmente com CSP/SRI e adaptador fictício por instrumentação; sem pageerror ou requisições externas nessa verificação.
- Pacote anterior publicado preservado; geração e validação de candidata e rollback, incluindo HTML anterior e agenda. Código-base arquivado em ZIP, sem tocar backups já existentes.

Comando da execução integral:

```bash
PYTHONDONTWRITEBYTECODE=1 IASDPI_PG_TEST_CONTAINER=iasdpi-phase-a-tests python -m unittest discover -s tests -v
```

O container foi exclusivo desta execução; requer PostgreSQL descartável em rede none. Não apontar os testes para produção.

## Prévia, ativação e pendências

Artefatos em `dist/schedule-foundation`: `IASDPI-previa-fase-a.html`, capturas, `tests-final.log`, `test-summary.json`, `visual-check.json`, `preservation-and-package.json`, candidata, rollback e arquivos de integridade. A prévia é fictícia, usa namespace próprio e grava apenas em memória no novo módulo. Não é uma demonstração de gravação remota. Gerar novamente:

```bash
python scripts/export_preview.py --read-only --schedule-preview --output dist/schedule-foundation/IASDPI-previa-fase-a.html
```

Ordem de ativação, após revisão e autorização: confirmar 001–004 já instaladas → executar **somente 005** em homologação → executar `check_schedule_foundation.sql` (somente leitura, zero irregularidades) → homologar contas descartáveis e persistência real → autorizar migração de produção e publicação separadamente. Não reinstalar 001–004. Nenhuma configuração Auth/SMTP ou política antiga foi alterada.

Pendências: instalação autorizada da 005; confirmação das funções praticadas e dos vínculos de liderança; concessão explícita das ACLs; homologação autenticada no Supabase real; navegadores/dispositivos não disponíveis. Contatos e notas ficaram restritos ao admin como padrão conservador. RLS instalada, URLs de Auth e sessões reais não foram atestadas por estes testes isolados.

Riscos conhecidos: o cadastro inteiro do escopo é carregado de uma vez; a serialização usa uma linha comum, adequada ao pequeno volume atual, a medir antes de volumes maiores. O novo formulário conserva alterações em memória durante falhas de gravação, mas não cria rascunho persistente próprio; avisa antes de sair/recarregar. Rascunhos dos cultos permanecem intactos. A preservação é confirmada por testes e comparação de código, sem acesso ao conteúdo do banco real.

Rollback: antes de dados na nova fundação, o down guardado pode remover apenas a instalação vazia mediante autorização. Havendo qualquer cadastro/auditoria, **reverter somente o frontend**, mantendo schema/dados. Nunca contornar a guarda com CASCADE. A publicação anterior d609657 e seu pacote foram preservados.

## Fase B proposta, não iniciada

1. Revisar tabelas schedule_events (referência externa idempotente), schedule_series, schedule_plans, schedule_assignments e schedule_versions, reaproveitando os cadastros desta fase.
2. Formulário simples departamento/mês/eventos/funções/pessoas, rascunho, revisão e publicação manual; consulta pública só de informações autorizadas.
3. Importação opcional com prévia dos 15 registros de Sonoplastia, Comunicação e anciãos; confirmação de identidades e horários ausentes, sem consolidar nomes automaticamente. Não duplicar eventos da fonte oficial.
4. RPCs autenticadas, CAS e publicação transacional, sem editar automaticamente programação de culto aprovada. Avisar divergências de referência.
5. Testes de criação/edição/publicação, duplicidade, permissões, concorrência, importação idempotente, preservação das fontes e mobile. Motor completo de conflitos cruzados na Fase C; geração equilibrada na D; trocas/notificações na E.

Fase A pronta para revisão e homologação. Produção não foi migrada nem publicada; não há autorização implícita para iniciar a Fase B.
