# G6 — Checklist de ativação, backup e rollback

**Não executado em produção.** Pré-requisito: revisar o relatório G6 e resolver/aceitar explicitamente seu escopo e pendências. A demonstração não é prova de configuração real.

## 1. Antes de qualquer alteração real

- [ ] Identificar ambiente/projeto e confirmar que a primeira homologação usa Supabase não produtivo ou operação explicitamente autorizada.
- [ ] Executar `database/check_governance_readiness.sql` como consulta de metadados. Conferir resultados e histórico administrativo de execução; marcadores não comprovam hashes nem ordem.
- [ ] Comparar arquivos com `dist/governance-g6/migration-inventory.json`. Não aplicar arquivos `_down`, `check_*` ou o legado como se fossem etapas forward.
- [ ] Resolver dias por departamento e política de disponibilidade que serão ativados. Não aceitar divergência silenciosa entre prévia e banco.
- [ ] Definir responsáveis humanos por autorizações e recuperação de contas. Ser ancião/responsável no Organograma não concede administração.
- [ ] Preservar os IDs e o administrador existente; não recriar usuários ou deduzir identidades por nomes semelhantes.

## 2. Backup antes das migrações

- [ ] Preservar o pacote frontend **realmente publicado** e completo: manifesto, arquivos, hashes, SRI, configuração pública, agenda e recursos imutáveis necessários ao rollback. Validá-lo pelo gerador existente; não usar uma prévia HTML como backup de produção.
- [ ] Registrar branch/commit publicados e a revisão candidata; não considerar o HEAD do checkout com alterações pendentes como a versão pública.
- [ ] Obter snapshot/backup do PostgreSQL pelo procedimento administrativo autorizado. Incluir schema, dados, RLS, funções e permissões; verificar como Auth/Storage são cobertos no plano Supabase e preservar suas configurações separadamente.
- [ ] Testar a restauração em ambiente descartável e comparar contagens, UUIDs, versões e registros operacionais. Não expor dumps com e-mails/contatos em Pages, Git ou chat.
- [ ] Registrar o instante do backup, janela de alterações e responsabilidade por eventuais gravações posteriores. Restauração de snapshot não pode apagar mudanças novas sem análise explícita.

Esse procedimento é para mudanças estruturais. Atualizações normais do frontend não exigem exportar repetidamente backups do navegador. Rascunhos locais e eventuais dados legados ainda não importados não devem ser limpos automaticamente.

## 3. Ordem exata — executar somente etapas ausentes

1. `database/001_single_church_access.sql`
2. `database/002_user_management.sql`
3. `database/003_operational_storage.sql`
4. `database/004_culto_trash.sql`
5. `database/005_schedule_foundation.sql`
6. `database/006_schedule_management.sql`
7. `database/007_daily_schedules.sql`
8. `database/008_monthly_rotation.sql`
9. `database/009_confirmed_schedule_conflicts.sql`
10. `database/010_simple_daily_schedules.sql`
11. `database/011_church_isolation.sql`
12. `database/012_alias_login.sql`
13. `database/013_access_governance.sql`
14. `database/014_portal_integration.sql`
15. `database/015_elder_period_storage.sql`

- [ ] Rever dependências e executar uma transação versionada por vez, como postgres, apenas após aprovação. Interromper em qualquer erro; não avançar ignorando falhas nem reaplicar etapas confirmadas.
- [ ] Validar imediatamente os registros que existiam antes, incluindo precisão de horários, payloads, autoria e versões.
- [ ] Usar os checks 005–010 somente nas etapas às quais se referem. Após 015, usar os checks 011–015 e `check_governance_integration.sql`; esperado: zero irregularidades.
- [ ] Registrar arquivo/hash/data/operador/resultado. Não existe ledger próprio que substitua esse registro.

## 4. Auth e Edge Functions — configuração manual

- [ ] Confirmar Site URL e Redirect URLs para os endereços HTTPS exatos e caminhos existentes. Conferir recuperação PKCE em link válido, inválido, expirado e aberto em contexto sem verifier.
- [ ] Confirmar política de senha, CAPTCHA, renovação/expiração, MFA e exigência de reautenticação quando aplicáveis. Não desabilitar proteções para fazer o teste passar.
- [ ] Validar SMTP, remetente, template e entrega real com conta descartável; verificar também contas com e-mail institucional técnico, sem depender de e-mail pessoal.
- [ ] Implantar `alias-login` e `access-assistance` somente após autorização. O `verify_jwt=false` se aplica apenas a esses endpoints pré-autenticação; as ações privadas verificam o JWT e as RPCs verificam permissões.
- [ ] Configurar segredos somente no gerenciador seguro do Edge: `SUPABASE_SERVICE_ROLE_KEY`, chaves públicas necessárias, `IASDPI_ALIAS_LOGIN_PEPPER`, `IASDPI_GOVERNANCE_PEPPER`. Nunca no frontend, repositório ou chat.
- [ ] Configurar `IASDPI_ALIAS_ALLOWED_ORIGINS` e `IASDPI_GOVERNANCE_ORIGINS` com origens HTTPS exatas. Para Pages: `https://lcs-casagrande.github.io`, sem o caminho do repositório.
- [ ] Validar flags de servidor `IASDPI_ALIAS_LOGIN_ENABLED` / `IASDPI_GOVERNANCE_ENABLED`, limites antiabuso e orçamento compartilhado. Configurar header de IP somente se o gateway o sobrescrever de forma confiável.
- [ ] Confirmar que as versões das chaves administrativas suportadas pelos handlers/gateway são as configuradas. Não presumir que uma chave nova funciona apenas por ter nome semelhante.
- [ ] Manter `churchIsolationEnabled`, `aliasLoginEnabled`, `governanceEnabled`, `portalAccessEnabled` coerentes com as etapas realmente instaladas. Flags de UI não substituem permissões SQL.

## 5. Homologação real com dados descartáveis

| Perfil/cenário | Validação obrigatória |
| --- | --- |
| Administrador da IASD_PI | Gerir somente sua igreja, preservar último administrador, cadastrar sem duplicar e consultar auditoria. |
| Administração com mais de uma autorização | Alternar somente igrejas expressamente autorizadas; não conceder superpoder global. |
| Sonoplastia, Música e Ancionato | Ver/editar/publicar somente nos departamentos permitidos. |
| Múltiplos ministérios | Alternar sem novo login; conflitos cruzados continuam aplicados. |
| Visitante e usuário sem ACL | Ler somente informações públicas; negar RPCs de escrita e rascunhos. |
| Perfil leitura / editor / publicador | Testar chamadas REST diretas, não apenas botões; distinguir capacidades. |
| Escala | Criar, salvar, reabrir em outro dispositivo, publicar, revisar sem duplicar e consultar histórico. |
| Equipe musical | Várias pessoas no mesmo evento, mesmos IDs ao reabrir, sem duplicação de pessoa na mesma função. |
| Ancionato | Semana domingo–sábado, virada do mês, ano mensal, publicação independente e exceção do ancião do mês. |
| Conflitos e concorrência | Publicar simultaneamente em dois dispositivos: nunca confirmar duas atribuições incompatíveis; versão obsoleta não sobrescreve. |
| Revogação | Bloquear nova escrita e sessão suspensa; distinguir acesso ministerial de autorização independente na Cronoanálise. |
| Recuperação | Pedido → verificação humana → link único/expirável → troca → revogação de sessões/refresh anteriores → entrada nova. Não testar com contas reais de membros. |
| Conteúdo público | Apenas última versão publicada; nenhuma nota privada, contato, UID administrativo ou rascunho. |
| Compatibilidade | Chrome/Firefox/Safari e aparelhos reais Android/iPhone; teclado e larguras previstas. Não declarar aprovado sem executar. |

Os dados fictícios devem ficar em homologação autorizada. Não publicar escalas de teste no banco de produção, especialmente sem um fluxo aprovado de retirada/cancelamento.

## 6. Publicação futura

- [ ] Resolver os bloqueantes e obter autorização separada para commit, merge, push e deploy.
- [ ] Montar pacote completo com o gerador existente, validar dependências, manifesto, hashes, SRI e caminhos relativos. Excluir fixtures, contas e senhas demonstrativas.
- [ ] Conferir diffs da Agenda/Organograma e dados atuais. Não aplicar conteúdo demonstrativo como seed real.
- [ ] Conferir login, portal público, calendário, rascunho privado e reabertura após o deploy autorizado.
- [ ] Usar monitoramento e revisão humana das primeiras publicações. Aprovar acesso público da RPC 014/015 independentemente do flag de frontend.

## 7. Critérios e procedimento de rollback

Acionar revisão/rollback se houver exposição de rascunhos/contatos, escrita sem ACL, acesso cruzado, perda/alteração inesperada de registros, duas publicações incompatíveis confirmadas ou falha essencial persistente de login/salvamento.

1. Interromper novas operações pelo procedimento operacional autorizado; preservar evidências, IDs e revisões. Não apagar cultos ou históricos.
2. Restaurar o pacote frontend anterior completo e já validado. Preservar banco, RLS, versões e dados novos. A interface antiga pode não administrar períodos novos do Ancionato: suspender esse uso até revisão.
3. Se necessário, operador autorizado desabilita a Edge afetada/ajusta concessões de forma revisada. Desligar flags de UI não revoga acesso SQL; não desabilitar RLS nem liberar privilégios amplos.
4. **Não executar `008_monthly_rotation_down.sql` após 009–015.** Os downs 005/006 são para instalações vazias, em suas etapas, e não são plano de rollback da cadeia completa. Não usar DROP/CASCADE para contornar bloqueios.
5. Preferir correção progressiva revisada. Uma reversão estrutural ou restauração de snapshot exige autorização específica e plano para preservar gravações posteriores ao backup.
6. Reexecutar checks finais e testes de escopo antes de reabrir a operação.

Nenhum desses passos foi executado no Supabase real nesta G6.
