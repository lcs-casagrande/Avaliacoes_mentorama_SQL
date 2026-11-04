# G8.4 — Cadastro Geral de Membros e nomes confirmados

Branch: `feat/schedule-management-b1`. Retomada dos arquivos preservados após a interrupção. Nenhum acesso ao Supabase real, criação de conta real, commit, merge, push ou publicação.

## Resultado e nomes

O Cadastro Geral existente foi concluído, sem outra tabela de pessoas. A identificação principal continua em `schedule_people`, por igreja; os vínculos continuam em `schedule_memberships`. A 019 acrescenta apenas aliases históricos privados e o redirecionamento de IDs aposentados para o ID principal.

**Implementado e testado localmente não significa instalado no Supabase.** Instalar a 019 não modifica nomes, vínculos ou atribuições. A aplicação exige prévia e confirmação administrativa por grupo. A demonstração já começa com os nomes confirmados, utilizando cópias das referências conhecidas.

| Grafias confirmadas | Nome padronizado |
| --- | --- |
| Mini Lucas | Lucas Borrego |
| Rafa | Rafael Braga |
| Macedo / macedo Logos | Gabriel Macedo |
| Raphael | Raphael Moreira |
| Paulito / Paulitos | Paulo Scarpelini |
| Samuel | Samuel Ferreira |
| Izabelle PI Souza | Izabelle Souza |
| Simone/Profª de Pilates | Simone Cristina |
| Letícia PI | Letícia Ferreira |
| Rosana | Rosana Bianchini |
| Victoria (somente Desbravadores) | Victória Scarpelini |
| Luan | Luan Vaz |
| Henrique | Henrique Franco |

São 13 identidades confirmadas e 15 grafias anteriores. Não foram acrescentadas equivalências por semelhança. “Rafa” e “Raphael” continuam pessoas diferentes. “Victoria” só participa dessa correspondência quando vinculada ao código `clube-de-desbravadores`; não se altera automaticamente a identidade de outra Victoria.

## Integridade da conciliação

- A prévia apresenta pessoas, seus departamentos, IDs, quantidades de referências e impedimentos. O administrador escolhe o ID que será mantido e confirma a operação.
- A RPC adquire o mesmo lock administrativo das outras gravações, revalida o usuário/igreja e compara o token da prévia, incluindo versões, disponibilidades, vínculos, contatos e compromissos. Qualquer mudança invalida a confirmação antiga. Recibos permitem repetir a mesma solicitação sem duplicar operações.
- Vínculos de departamentos distintos são transferidos sem recriar seus IDs. Habilitações, liderança, participação, disponibilidade, limites e status dos vínculos são conservados. Nenhum nome concede função, disponibilidade ou permissão Auth.
- Dois vínculos no mesmo departamento, contas Auth diferentes, contatos/notas divergentes, limites/status globais diferentes, disponibilidade global e compromissos confirmados simultâneos exigem revisão. A rotina bloqueia a mesclagem e não escolhe valores silenciosamente. O bloqueio de sobreposição na conciliação é conservador, inclusive para históricos antigos; não se apagam compromissos para contorná-lo.
- Se uma evolução acrescentar uma FK não contemplada, a conciliação falha fechada. Sobrecargas ou objetos G8.4 preexistentes também impedem a instalação sem revisão.
- Nenhuma pessoa ou referência histórica é apagada. IDs antigos ficam inativos e redirecionados; não aparecem como novas pessoas selecionáveis nem podem receber novas atribuições. A mudança guarda nomes e referências anteriores no log privado.
- Snapshots antigos e autoria permanecem intactos. Planejamentos com atribuições transferidas e períodos do Ancionato recebem novas versões. Consultas de versões resolvem IDs antigos, sem reescrever os snapshots. Mudanças futuras de nome atualizam a exibição das referências consolidadas.
- Ancião da Semana e Ancião do Mês continuam independentes. O mês não reserva dias para detecção de conflitos, conforme a regra anterior.

## Cadastro, integração e acesso

| Recurso | Resultado |
| --- | --- |
| Pesquisa por nome e apelido | Busca central por nome completo, preferido e aliases; filtros combináveis por departamento e ativo/inativo. |
| Cadastro e edição | Reaproveita o formulário G8.3 e o editor privado da Fase A. Cadastro central de pessoa é exclusivo do administrador, inclusive pela RPC antiga. |
| Vários departamentos | Mesma pessoa/ID, edição conjunta dos vínculos, salvamento parcial e independente. |
| Liderança e participação | Campos separados; funções habilitadas e confirmações não são inferidas do Organograma. |
| Disponibilidade e limites | Permanecem por vínculo; desconhecido continua pendente. Não se transforma um responsável em voluntário disponível. |
| Contatos | Schema privado e RPC administrativa existentes; fora das projeções ministeriais e públicas. |
| Duplicidades | Indicadores por nomes e aliases exatos e por grupos confirmados. Homônimos e equivalências não confirmadas não são mesclados automaticamente. |
| Histórico cadastral | Administrador consulta autor (UUID), data em São Paulo, versão, entidade e campos alterados. Valores privados não entram na projeção de auditoria. |
| Líder ministerial | Consulta sua equipe e altera apenas vínculos autorizados; não renomeia/cria identidades centrais, não concilia pessoas nem lê contatos privados. |
| Público | Continua consultando Agenda, Organograma e escalas publicadas; não recebe contatos, UUIDs de contas, rascunhos ou auditoria. |
| Igreja | RLS, FKs compostas, papel executor sem BYPASSRLS e funções com search_path vazio continuam impondo o contexto autorizado. |

O Organograma e o calendário recebem os nomes centrais por projeção, mantendo fontes originais. A leitura pública da projeção foi corrigida para funcionar antes do login: consulta a lista pública de igrejas e usa IASD_PI somente se autorizada, sem alterar a seleção nem ampliar acesso às rotas privadas.

As 15 linhas históricas de Sonoplastia e 5 de Comunicação conservam IDs, datas e grafias de origem. A Agenda de Ancionato é preservada integralmente. Referências sem associação central continuam disponíveis para confirmação administrativa; não há importação automática de nomes desconhecidos. A variante gráfica da fonte de Comunicação, `Simone/Profªde Pilates 🧘`, continua intacta: a prévia reaproveita a associação explícita que já existia na composição de referências; não é acrescentada uma equivalência genérica por aproximação.

## Correções da revisão final

1. Estado de salvamento da conciliação separado do número de recarregamentos: os botões voltam a funcionar após o sucesso; respostas tardias de uma sessão encerrada são descartadas.
2. Adaptador G8.4 respeita os retornos não tratados das fixtures anteriores e usa o mesmo catálogo central. Não há outra lista operacional de pessoas.
3. Redirecionamentos permitem consultar versões com IDs aposentados sem mostrar “Pessoa indisponível”.
4. A antiga RPC de pessoas passou a exigir administração central, evitando contornar o formulário do Cadastro Geral. Edição autorizada de vínculos permanece disponível ao líder.
5. Identificada consulta de conciliação com mais de 11 s no PostgreSQL descartável, acima do timeout de 10 s do frontend. A mesma consulta com JIT desativado levou aproximadamente 0,22 s. A 019 desativa JIT **somente no escopo das três funções de conciliação**, restaurando o ajuste da sessão ao retornar; não muda configuração global. Medição final em `performance-evidence.json`, sem equivaler a desempenho comprovado em produção.

## Migração e ativação futura

- **Nova:** `database/019_registry_identities.sql`, transacional e sem alteração automática de pessoas. A 019 em preparação foi corrigida; não há migração 020.
- **Verificação somente leitura:** `database/check_registry_identities.sql`, retorna apenas irregularidades de funções, proprietários, concessões, schemas, RLS e redirecionamentos.
- As migrações 005–018 foram preservadas; não se reaplica uma etapa já instalada.
- Ordem completa, caso ainda ausentes: **005 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018 → 019**, após 001–004. Antes de executar, inventariar o ambiente real e revisar a cadeia/checks existentes, incluindo o checklist G7 de Auth/Edge Functions. Nenhuma etapa foi aplicada em produção nesta tarefa. Conferir também quais pessoas e referências já existem no cadastro real; a 019 não cria pessoas ausentes ou vínculos por nomes.
- A FK de disponibilidade para vínculo torna-se diferível, inicialmente imediata, para transferir pessoa e vínculos atomicamente. A conciliação força a validação das restrições antes de confirmar. Não se retiram FKs, RLS ou validações de publicação.
- Antes da ativação: backup PostgreSQL verificável de dados/esquema e pacote anterior; revisão de SQL; checks de 011–019; homologação controlada com identidades autorizadas; inspeção de cada grupo/conflito antes de confirmar.
- Rollback preferencial: frontend anterior, mantendo o schema aditivo. Não executar DROP de aliases ou de IDs aposentados. Reverter uma mesclagem demanda revisar o log privado, snapshots e backup, incluindo alterações posteriores; não há “desmesclar” automático que possa descartar dados novos. Recuperação por backup deve ser ensaiada em banco isolado antes de qualquer restauração real.

## Arquivos desta etapa

| Arquivo | Alteração |
| --- | --- |
| `data/confirmed-person-names.json` | Correspondências fechadas da liderança, sem IDs, pessoas novas ou permissões. SQL e fixture são comparados nos testes. |
| `database/019_registry_identities.sql` | Aliases privados, redirecionamentos, prévia/confirmação, histórico e proteção da RPC antiga. |
| `database/check_registry_identities.sql` | Checagem somente leitura de instalação e segurança. |
| `frontend/schedule-foundation.js` | Busca por aliases, indicadores, conciliação, histórico, navegação e tratamento do estado de salvamento. |
| `frontend/schedule-management.js` | Resolução de nomes centrais em versões antigas de escalas e Ancionato. |
| `frontend/auth.js` | Consulta pública da projeção sem seleção prévia e whitelist de metadados em modo somente leitura; gravação continua bloqueada nesse modo. |
| `frontend/church-portal.js`, `frontend/index.html` | Nome do acesso: Cadastro Geral, no módulo e no menu principal. |
| `frontend/styles.css` | Ajustes restritos à conciliação e às tabelas. |
| `scripts/export_preview.py` | Opção isolada `--registry-identities-preview`. |
| `tests/fixtures/registry-identities-preview.js` | Integração demonstrativa sobre o catálogo já existente, sem rede externa. |
| `tests/test_registry_identities_sql.py` | Testes reais em PostgreSQL descartável. |
| `tests/test_registry_identities_browser.py` | Testes interativos em Chromium, permissões simuladas e cinco larguras. |
| Este relatório e `dist/registry-g84/` | Evidências, hashes e prévia final. |

Há muitas alterações acumuladas anteriores no checkout: não foram descartadas nem substituídas. Agenda, Organograma, suas fontes originais e as migrações 005–018 foram conferidos pelo manifesto de preservação. O HTML/ZIP anterior G8.3 foi preservado como referência de rollback demonstrativo.

## Resultados e limites

**177 verificações aprovadas na rodada final, sem falhas ou skips:**

| Grupo | Aprovados | Evidência |
| --- | --- | --- |
| PostgreSQL 17, cadeia 001–019 | 42 | `sql-final-pass.log` (41) + `sql-name-followup.log` (1 adicional) |
| Interface G8.4 e regressão G8.3 | 32 | `browser-final-pass.log` (31) + `preview-isolation-final.log` (1 adicional) |
| G7, portal, Cronoanálise, persistência, horários, rascunhos, pacotes e rollback | 81 | `regression-evidence.log` |
| Handlers de login/recuperação | 22 | `edge-evidence.log` |

Resultado estruturado: `test-results.json`. Medição final da consulta: `performance-evidence.json`. Integridade: `integrity.json`. Fontes históricas, migrações anteriores e pacote demonstrativo anterior conferidos em `preservation-evidence.json`.

A rodada confirma 15 linhas de Sonoplastia, 5 de Comunicação e preservação da Agenda oficial; versões semanais/mensais do Ancionato são exercitadas no PostgreSQL. Não foram consultados registros reais do Supabase.

Os logs de tentativas interrompidas e de correções permanecem separados. Reexecuções não aumentam a contagem final. A suíte histórica completa do repositório não é declarada como reexecutada.

Banco: PostgreSQL 17 em container `--network none`, bancos e identidades sintéticos. RLS, permissões, CAS, recibos, concorrência real de processos, versões publicadas/rascunhos, datas e autoria são exercitados no banco. Claims Auth são simulados; não comprovam SMTP, Edge Functions ou sessão real do Supabase.

Interface: Chromium, provedor demonstrativo, rede externa bloqueada; 360, 390, 768, 1024 e 1440 px, teclado e capturas desktop/mobile. Não foram homologados Safari, Firefox ou aparelhos físicos. Os handlers Auth/recuperação usam testes isolados, sem mensagens ou serviços reais.

## Prévia e roteiro

```bash
python scripts/export_preview.py --registry-identities-preview --output dist/registry-g84/IASDPI-G84-revisao.html
```

HTML independente, marcado como demonstração G8.4, namespace próprio desde a inicialização do armazenamento/Auth (isolado das versões anteriores), CSP `connect-src 'none'`. Nomes públicos já informados; contas, contatos e operações fictícios. Sem persistência real; recarregar reinicia a demonstração. O arquivo final foi validado por HTTP local, sem requisições externas. A abertura por URI `file://` é bloqueada pela política do Chromium deste ambiente, portanto não foi declarada como validada. Se necessário, servir localmente com `python -m http.server 8000 --bind 127.0.0.1 --directory dist/registry-g84` e abrir `http://127.0.0.1:8000/IASDPI-G84-revisao.html`.

1. Abrir o HTML. **Montar escala → IASD_PI →** conta fictícia `admin.pi.teste`, senha `Demonstracao#2026`.
2. Abrir **Cadastro Geral**. Pesquisar Macedo, macedo Logos e Gabriel Macedo: o mesmo ID deve ser encontrado. Verificar Samuel Ferreira e Raphael Moreira em vários departamentos.
3. Editar um vínculo, salvar e conferir que os demais departamentos não mudaram. Confirmar que liderança, habilitação e disponibilidade continuam campos diferentes.
4. Abrir **Nomes confirmados e possíveis duplicidades**. Revisar IDs, departamentos e referências. Para exercitar a conciliação na demonstração, cadastrar “Paulito” sem departamento; abrir/atualizar a prévia, escolher o ID principal, cancelar primeiro e depois confirmar. Conferir aliases e **Histórico cadastral**.
5. Consultar as 15 linhas de Sonoplastia e as 5 de Comunicação no calendário. Conferir a Agenda e as modalidades semanal/mensal do Ancionato.
6. Com a conta fictícia `som.teste`, mesma senha, conferir edição apenas da própria equipe e ausência de conciliação, alteração de identidade e contatos privados.
7. Simular falha de gravação nos testes: nenhuma mensagem de sucesso sem confirmação; os dois cadastros permanecem até a resposta válida. Validar que os botões funcionam após salvar.

## Pendências e liberação

A prévia permite iniciar homologação integrada **demonstrativa**. Para homologação no Supabase real, ainda são necessárias revisão/aprovação de instalação, backup validado, verificação das migrações realmente presentes, Auth/Edge/RLS reais e revisão individual de referências/conflitos. Essas verificações não são substituídas pelos testes locais.

A conciliação cobre somente as equivalências confirmadas e casos seguros. Homônimos, vínculos duplicados no mesmo departamento, contas distintas, dados privados divergentes ou compromissos incompatíveis continuam bloqueados para revisão; não são removidos para viabilizar uma mesclagem. Disponibilidades/habilitações pendentes continuam pendentes. Não há migração de cultos, horários ou credenciais. Aliases históricos de pessoas são separados dos apelidos institucionais de login.

Não executar a 019 nem ativar produção sem revisão e autorização. Trabalho interrompido ao entregar para revisão.

Commit sugerido, não executado: `fix: consolida nomes e conciliação do cadastro geral`.
