# Relatório de validação — horários importados e lixeira

Nenhum teste acessou registros reais do Supabase. PostgreSQL 17 em Docker com
`--network none`, sem portas publicadas; cada caso cria/remove seu próprio banco.
Testes de navegador usam Chromium/Playwright com Auth/REST interceptados e dados
fictícios. Não são uma sessão real no Supabase nem uma confirmação dos valores do
PDF remoto. O proprietário deve homologar o registro real após a implantação.

## Resultados

- Suíte completa: **138 testes passaram**, sem falhas ou testes ignorados.
  Comando: `IASDPI_PG_TEST_CONTAINER=iasdpi-trash-tests python3 -m unittest discover -s tests -v`.
  Log: `/tmp/iasdpi-culto-trash-tests-final.log`.
- Após acrescentar a regressão de timestamp na data errada e ajustar a preservação
  desse campo quando o usuário o corrige explicitamente: **30 testes passaram**
  nos módulos test_culto_recovery_browser, test_operational_browser e
  test_registration_edit. São **139 cenários distintos verificados** no total.
  Comando: `PYTHONPATH=tests python3 -m unittest test_culto_recovery_browser test_operational_browser test_registration_edit -v`.
  Log: `/tmp/iasdpi-time-final-targeted.log`.
- Validação sintática JavaScript e `git diff --check`: passaram.
- Pacote estático: somente 19 assets públicos e manifesto com hashes; geração
  mantém CSP, URLs relativas e cache por conteúdo. Agenda do commit atualmente
  publicado é fornecida via --agenda-data, sem substituir sua fonte por um
  snapshot local mais antigo. Scanner do gerador não detectou segredos.

| Cenário solicitado | Evidência / resultado |
| --- | --- |
| Abrir importação de 10/10/2026 | Cópia de 16 itens, horários mistos HH:mm:ss/SQL/ISO e primeiro início inválido abre com aviso no campo, sem RangeError; abrir não grava. |
| Editar e salvar | Correção manual atualiza o mesmo ID; segundos, responsáveis, observações, metadados desconhecidos, status legados e subatividades preservados. |
| Finalizar e consultar Histórico | Fixture de 10/10 finalizada, aparece no Histórico, continua com 16 itens e sem duplicação; também validado pela RPC em PostgreSQL real descartável. |
| Nulos, data inválida e precisão | Campos opcionais nulos/ausentes não derrubam a tela; datas desconhecidas continuam editáveis; frações de timestamp absoluto não editado preservadas; fuso histórico testado. |
| Timestamp real em outro dia | Aviso, salvamento impedido sem revisão; editar o mesmo relógio explicitamente corrige o contexto de data em vez de preservar silenciosamente a data errada. |
| Mover rascunho para lixeira | Exige confirmação, ID e versão; data/hora/autor/motivo registrados, outro culto intacto; nada é excluído ao instalar 004. |
| Detalhes da lixeira | Nome, data, ID, autor/momento da exclusão, motivo, atividades, horários, notas e subatividades consultáveis por admin. |
| Restaurar | Mesmo ID/status/documento, somente versão incrementada; auditoria conserva as operações anteriores; registros reaparecem no REST ativo. |
| Permissões | Líder, não autorizado, revogado, anon e anônimo de Auth bloqueados; acesso direto por tabela/helper privado recusado. Frontend não é a barreira de segurança. |
| Concorrência e repetição | Duas restaurações simultâneas: uma aplicada e outra recusada; UUID repetido reconfirma sem duplicar; versão antiga e reutilização divergente recusadas. |
| Impedir ressurgimento indevido | Gravação pendente, receipt antigo e importação do culto excluído bloqueados, inclusive deduplicação de importações com outro ID; prévia não expõe documento excluído. |
| Integridade/rollback | 004 conserva dados/atividades/modelos/acessos/archives; falha induzida antes de COMMIT reverte DDL, funções e políticas; importação inconsistente também pode ser restaurada sem reprojeção. |
| Regressões | Auth/admin, primeiro/último admin, modelos Liturgia I/Livre, subatividades, cancelamento, versões, backups, falhas de conexão, recuperação de envio, agenda e organograma cobertos pela suíte. |

## Arquivos desta entrega

Novos: database/004_culto_trash.sql, database/check_culto_trash.sql,
frontend/record-time.js, frontend/trash.js, tests/test_culto_trash_sql.py,
tests/test_culto_recovery_browser.py, docs/culto-trash.md e este relatório.

Atualizados: frontend/actuals.js, frontend/app.js, frontend/demo.js,
frontend/index.html, frontend/operational.js, backend/server.py (somente allowlist
estática), scripts/build_homologation.py, scripts/build_pages.py (pré-requisito
na descrição), scripts/export_preview.py e docs/supabase-operational.md.

001, 002 e 003 não foram alteradas. Configuração pública do Supabase, organograma,
arquivamento e SDK de autenticação permanecem iguais à fonte anterior. Há mudanças
anteriores já presentes no workspace; o git status da branch work não representa
apenas esta entrega. Nenhum commit, push, publicação ou SQL em produção foi feito.

Rollback preservado em tags locais sem sobrescrever as anteriores:
backup-pre-culto-trash-pages → e4afee260988d09b327ebd91af69ce67d4620da2;
backup-pre-culto-trash-source → 418e55a4993824ff6800f9ce9b7a4b8bfbcf60fe.

Apenas leitura da API pública do GitHub confirmou o HEAD do Pages acima. O pacote
final preparado é `/tmp/iasdpi-culto-trash-final`, ainda não publicado.
