# G12 — tabela institucional de Usuários e Acessos

Branch `feat/schedule-management-b1`, base `ff235ba`. A homologação integrada usa a tabela nova; G11 e a primeira G12 continuam preservadas nas versões anteriores. Alterações demonstrativas reiniciam ao recarregar. Nenhuma conta, segredo, configuração ou banco Supabase foi alterado.

## Interface entregue

- Uma linha por departamento e cargo, incluindo Diaconisas/Diáconos, `anciao_1`…`anciao_10`, `admin` e `membro`. Logins permanentes; desativar um departamento não renumera os cargos nem exclui suas referências.
- Cinco colunas: Login, Responsável pesquisável, Permissões com seleção múltipla, Redefinir senha e Salvar. Pessoa escolhida por ID do Cadastro Geral, sem nomes livres nem outra base de pessoas. Salvar uma linha preserva as escolhas ainda não salvas nas outras.
- Criação, arquivamento e reativação de departamentos em Administração, junto da tabela. Cadastro Geral, Organograma, Escalas e Eventos usam o mesmo departamento. Calendário mantém registros históricos publicados. Departamento novo sem ancião de acompanhamento aparece sem inventar essa responsabilidade.
- Troca de responsável exige confirmação, bloqueia sessões anteriores e deixa redefinição pendente. Históricos mantêm os IDs e autores anteriores. Redefinição supervisionada usa link privado com expiração; não mostra senha. Uma pessoa em várias linhas continua com uma identidade e uma credencial individual; redefini-la afeta todos os seus logins.
- Administrador e aprovação geral exigem confirmações específicas; um departamento comum não possui a opção de aprovação. `membro` compartilha somente a identidade exclusiva de leitura, nunca a conta pessoal de seu custodiante.
- No celular a tabela possui rolagem horizontal dentro do painel; menus de seleção e botões não ampliam a página. Desktop e larguras 360, 390, 768, 1024 e 1440 px verificados.

## Matriz

| Perfil / login | Escalas e eventos | Aprovação geral | Cadastros e acessos |
| --- | --- | --- | --- |
| `admin` | Controle completo na igreja autorizada | Sim | Sim |
| Departamento / cargo ministerial | Editar e publicar nos departamentos explicitamente selecionados; padrão do departamento é seu próprio escopo | Não; pode solicitar publicação geral conforme responsabilidade confirmada | Não concede acessos nem administração global |
| `anciao_N` | Departamentos autorizados | Somente quando explicitamente autorizada no Ancionato | Sem administração global automática |
| `membro` | Apenas escalas publicadas autorizadas e eventos abertos | Não | Sem rascunhos, eventos restritos, Cadastro Geral, históricos privados ou ferramentas administrativas |
| Público | Calendário público vigente e Organograma | Não | Não |

A escolha do login não prova autorização: a identidade autenticada acumula somente os direitos validados pelo backend. Login institucional é uma reserva estável sobre o sistema de aliases existente. O cargo não substitui a identidade individual para autoria.

## Backend preparado, sem execução

`database/028_institutional_access.sql` é uma atualização incremental **preparada para revisão, não instalada nem executada, inclusive localmente nesta rodada**. Reutiliza `login_aliases`, `schedule_people`, vínculos, ACL, Auth, auditoria e recuperação G3/G11. Acrescenta metadados de cargo/responsável/escopos aos aliases; não cria tabelas de pessoas, senhas ou um Auth paralelo.

Prevê validação administrativa e de igreja, bloqueios transacionais e versões, consolidação dos escopos de todas as linhas da mesma identidade, barreira de credencial/epoch em trocas, proteção contra promoção de `membro` por RPCs antigos, restrição de tabelas privadas, consultas publicadas e preservação de histórias ao arquivar. Os nomes de departamentos já presentes no Organograma são associados por códigos/correspondências explícitas; não se inferem equivalências de pessoas.

O endpoint `institutional_reset` reaproveita Auth e links supervisionados existentes. Flag `IASDPI_INSTITUTIONAL_ENABLED=false` no template. `institutionalAccessEnabled` é opcional no frontend e exige G11; permanece ausente na configuração operacional atual.

**Limites para ativação:** a 028 passou por inspeção e parser da sintaxe SQL externa, sem aplicar DDL. Isso não comprova resolução de dependências, execução dos corpos PL/pgSQL, RLS ou concorrência em PostgreSQL. Esses ensaios continuam obrigatórios antes de autorizar qualquer instalação. As concessões ministeriais de identidades adotadas pela tabela serão recalculadas pela união das linhas; revisar previamente permissões legadas. Autorizações gerais anteriores não são removidas silenciosamente pelo arquivamento de um ministério.

O salvamento real pode deixar responsável associado e acesso pendente se ainda não houver Auth individual. Provisionar identidades exige autorização e o fluxo G11 existente; não ocorre na demonstração contra o Supabase. O leitor compartilhado precisa de Auth exclusivo, sem vínculo pessoal ou privilégio geral, associado posteriormente por RPC administrativa. A simulação cria somente representações temporárias em memória para permitir testar imediatamente esses fluxos.

## Testes

Consolidado e evidências: `docs/governance-g12-institutional-validation.json` e `dist/institutional-g12/`.

- 15 jornadas Chromium no HTML final: tabela completa, busca central, departamento com múltiplos acessos, troca sem reescrever histórico, recuperação supervisionada, membro restrito, aprovação pelo ancião, rejeição de versões antigas, criação/arquivamento entre módulos, remoção de permissões e identidade única para vários logins.
- 8 testes de contrato/inspeção dos arquivos preparados. **Não são testes PostgreSQL.**
- 63 testes Node de Auth/Edge/credenciais/eventos/datas, incluindo oito casos novos do reset institucional.
- 53 testes anteriores: G12 funcional (17), G11 (8), Cronoanálise/Auth (9), navegação (8) e pacote fechado/isolamento (11).

Total: **139 casos selecionados aprovados**, sem somar reexecuções. Não foi reexecutada a suíte histórica inteira. Não foram usados GoTrue, SMTP, contas, bancos ou permissões reais. Parser e verificações estáticas não equivalem a homologação do SQL.

Pendências: ensaiar 028 em PostgreSQL descartável quando autorizado; backup recuperável, restauração, janela e aprovação da instalação 005–028; conciliar responsáveis e permissões legadas; provisionar Auth individual e leitor exclusivo somente com autorização; homologar recuperação, revogação global no provedor, sessões e gravação compartilhada. Durante a troca a barreira/epoch bloqueia o acesso aplicativo imediatamente; o encerramento global no Auth integra a redefinição supervisionada existente.

Publicação autorizada exclusivamente na `main` de **IASDPI-homologacao**, conforme confirmação do usuário. Sem merge ou publicação na main oficial, sem ativação real. Prévia: `/integrada/`; cópia: `/g12-acessos/`. Credenciais fictícias de teste: `admin` ou `membro` / `Demonstracao#2026`; nunca usar credenciais pessoais nesta página pública.
