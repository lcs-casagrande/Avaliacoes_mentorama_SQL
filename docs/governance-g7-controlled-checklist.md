# G7 — Checklist de homologação controlada

**Tudo abaixo permanece pendente no Supabase real.** Não foram acessados seus dados, painel, contas ou segredos. Os testes locais usam Auth simulado e PostgreSQL descartável. Nenhuma alteração de configuração está autorizada por este checklist.

## Preparação e ordem

- [ ] Identificar projeto, endpoints e migrações já aplicadas mediante metadados e registro administrativo. Preservar administrador existente, UUIDs e histórico.
- [ ] Aprovar backup e testar recuperação em destino separado, conforme `governance-g7-rollback.md`.
- [ ] Aplicar somente etapas ausentes, na ordem: **001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016**. Usar os nomes versionados de `database/`; `_down`, `check_*` e SQL legado não são migrações forward. Não reaplicar 001–004 já existentes por simples suposição.
- [ ] A 016 exige a cadeia 001–015 completa. Ler `016_department_schedule_days.sql` e autorizar separadamente sua execução. Ela acrescenta uma coluna aos departamentos, duas RPCs e wrappers compatíveis; não cria outra tabela de pessoas ou permissões.
- [ ] Após 016, executar como postgres: `check_church_isolation.sql`, `check_alias_login.sql`, `check_access_governance.sql`, `check_portal_integration.sql`, `check_elder_period_storage.sql`, `check_governance_integration.sql`, `check_department_schedule_days.sql`. Zero linhas nos checks de irregularidades é o esperado. Não usar check de uma etapa antiga como verificação da cadeia final.
- [ ] Conferir os dias herdados da configuração global para cada departamento existente. Novos departamentos começam quarta/sábado/domingo. Para Comunicação somente aos sábados, um administrador deverá salvar essa escolha explicitamente; não há alteração automática dos seus dados.

## Auth, Edge e segredos — somente configuração administrativa

| Local | Configuração/validação necessária |
| --- | --- |
| Supabase Auth / URLs | Conferir Site URL do site aprovado e Redirect URLs exatas por ambiente. Manter os caminhos do repositório Pages; evitar wildcard amplo. Confirmar retorno PKCE na mesma origem e navegador. |
| Auth / e-mail | Conferir SMTP, remetente autorizado, template de recuperação, prazo/uso único e entrega com conta descartável autorizada. Não assumir funcionamento por haver formulário no código. |
| Auth / segurança | Conferir política de senha (o reset administrativo local exige pelo menos 12 caracteres), MFA se adotado, duração JWT, refresh rotation e expiração/revogação. |
| Edge `alias-login` | Somente servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` (ou legado `SUPABASE_ANON_KEY`), `IASDPI_ALIAS_LOGIN_PEPPER` (mínimo 32 caracteres), `IASDPI_ALIAS_LOGIN_ENABLED`, `IASDPI_ALIAS_ALLOWED_ORIGINS`. |
| Edge `access-assistance` | Somente servidor: URL e chaves acima, `IASDPI_GOVERNANCE_PEPPER` (mínimo 32), `IASDPI_GOVERNANCE_ENABLED`, `IASDPI_GOVERNANCE_ORIGINS`. Pepper não pode mudar durante a vida de links pendentes sem plano de invalidação. |
| CORS / gateway | Origens HTTPS exatas. Pages: `https://lcs-casagrande.github.io`, sem caminho. Configurar `IASDPI_ALIAS_TRUSTED_IP_HEADER` / `IASDPI_GOVERNANCE_TRUSTED_IP_HEADER` apenas se o gateway sobrescrever o header. Não confiar em IP informado pelo cliente. |
| Implantação Edge | `verify_jwt=false` é necessário somente nesses dois endpoints de pré-autenticação; ações privadas verificam usuário e RPCs conferem escopo. Testar o gateway com o tipo real de chave configurada. Não copiar segredo para config pública. |
| Frontend | Um único cliente SDK; `persistSession` e `autoRefreshToken` ativos, `flowType: pkce`, retorno validado explicitamente (`detectSessionInUrl:false`). Ativar flags G1–G4 somente após dependências implantadas e verificadas. Flags não concedem privilégios. |

Não solicitar nem colar valores de segredos no chat. Não gerar contas, senhas ou peppers reais por este documento. Configurar segredos pelo gerenciador seguro do Supabase. Frontend recebe apenas URL e chave pública.

## Exercício autorizado com contas/dados descartáveis

- [ ] Login válido/inválido por apelido e e-mail: mesma identidade, sem divulgação de e-mail interno nem ampliação de privilégios; rejeitar igreja não autorizada e alias revogado.
- [ ] Sessão: refresh, expiração, logout, suspensão/revogação e retorno em outro dispositivo. Preservar rascunho próprio durante reautenticação; não revelar rascunho de outro usuário.
- [ ] Recuperação por e-mail: solicitação genérica → link PKCE no navegador de origem → senha nova → login; rejeitar link usado/expirado/inválido e redirect externo.
- [ ] Recuperação administrativa: fila → verificação humana → emissão com JWT e escopo → link de uso único → redefinição → invalidar sessões/refresh anteriores. Ancião só trata quando explicitamente autorizado; nunca enviar senha existente.
- [ ] RLS/REST: anônimo só lê conteúdo público; usuário autenticado sem ACL não lê rascunhos nem grava. Não liberar acesso direto a tabelas para contornar erro de RPC.
- [ ] Dias: administrador da igreja e delegado `members` ou `access` do departamento podem alterar; `edit`/`publish` isoladamente não. Testar chamada RPC direta, outro departamento e outra igreja.
- [ ] Persistência: salvar dias e reabrir em outro dispositivo; versão obsoleta deve falhar preservando seleção; repetir mesmo request após resposta perdida não duplica auditoria.
- [ ] Geração/rodízio: selecionar sábados, gerar período futuro, conferir datas e vagas; mudar dias não elimina eventos ou atribuições anteriores. Seleção vazia gera apenas datas extraordinárias configuradas; validar sua lista global.
- [ ] Comunicação: homologar configuração só sábado. Ancionato: semanas domingo–sábado e meses completos continuam distintos; Ancião do Mês não bloqueia outros ministérios.
- [ ] Conflito: publicar simultaneamente duas escalas incompatíveis em departamentos diferentes; somente uma confirma. Rascunhos alheios não reservam vaga, publicação revalida.
- [ ] Público: última versão publicada somente; rascunho ou revisão não publicada não substitui o feed. Conferir Agenda, Organograma e Cronoanálise sem alterar cultos reais.
- [ ] Compatibilidade: navegador/aparelho real Android/iPhone, Firefox/Safari, largura 360/390/768/1024/1440 e teclado. Chromium desktop emulado não comprova esses aparelhos.

**Liberação:** G7 preparada para revisão local. Auth/Edge reais e decisões remanescentes da G6 não estão aprovados por este documento. Não publicar, aplicar migrações nem criar contas reais sem autorização posterior específica.
