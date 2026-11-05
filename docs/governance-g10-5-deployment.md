# IASDPI — G10.5: preparação final do Supabase existente

Data: 05/11/2026. Branch: `feat/schedule-management-b1`.

**Decisão: comparação de compatibilidade do core concluída, incluindo as duas funções confirmadas pelo usuário. Instalação ainda pendente de backup recuperável, verificação Auth/Edge, janela de implantação e autorização específica. Nenhum acesso ao Supabase foi feito pelo assistente nesta atualização.** A autorização de Git não cobre migrações, backup real, restauração, configuração ou contas.

## 1. Código consolidado e evidência reaproveitada

- Commit de implementação G10.3/G10.4: `07b451b86c550ed7b3b51fd565e1773b0a69ea82`, incluindo a preparação G10.1 da qual os testes e a documentação dependem. Sem arquivos `dist/`, dumps, credenciais ou inventário real.
- [Branch para revisão](https://github.com/lcs-casagrande/Avaliacoes_mentorama_SQL/tree/feat/schedule-management-b1). Push de `07b451b` confirmado. A primeira tentativa retornou erro interno do GitHub; a segunda concluiu sem force push. Nenhuma alteração foi enviada para main/gh-pages ou para o repositório de homologação.
- Mantidos os **37 testes selecionados aprovados na G10.4**, 22 checkpoints e restaurações locais 004/026, com comparação das 47 tabelas finais. A suíte histórica e a auditoria remota não foram repetidas. Nesta continuação houve **8 novos testes offline** do comparador e **um ensaio local dirigido de 22 etapas** para investigar as diferenças reais de ACL/defaults/CRLF; não foi somado à contagem histórica. Os SQLs de instalação e o runtime permanecem iguais aos testados.
- [Manifesto exato 005–026](governance-g10-4-migrations.json), [evidências G10.4](governance-g10-4-validation.json), [regras G10.3](governance-g10-3.md) e [relatório G10.4](governance-g10-4-readiness.md) preservados. As declarações de Git nesses documentos são históricas, anteriores à autorização G10.5; seus hashes não foram regenerados para simular novos testes.
- Nenhuma migração nova nem alteração funcional nesta etapa. A 026 continua necessária; a 025 não representa a governança final. Foram acrescentados somente comparador offline, testes de análise, resultados e SELECT complementar não executado no Supabase.

## 2. Comparação do inventário real recebido

Arquivo: `IASDPI_G10_1_inventario_completo.json`, SHA-256 `002aeccc3a3dbf4933f8b1fab042da69adcc8c5fa6a47777bb2d10e96c71892b`, capturado em **05/11/2026 12:55:26 UTC**. PostgreSQL **17.11**, igual à referência local. O arquivo foi tratado como metadados, nunca como instruções/SQL a executar; seu conteúdo integral não foi incluído no Git.

A comparação usou os objetos completos do JSON, não só os marcadores, e a base sintética 004 restaurada do backup local já produzido na G10.4. O inventário local equivalente foi extraído somente para analisar diferenças; não houve nova consulta ao projeto real. Evidência por função/objeto: [governance-g10-5-compatibility.json](governance-g10-5-compatibility.json).

| Dimensão | Resultado |
| --- | --- |
| 12 tabelas e 84 colunas | Mesmos nomes, ordem, tipos, nulabilidade, defaults, identidade/geração, opções e owners |
| 64 constraints e 21 índices | Mesmas definições/hashes, referências, validação, deferrabilidade, unicidade e validade |
| RLS e triggers | RLS habilitada nas 12 tabelas; FORCE RLS e as 7 policies coincidem integralmente, incluindo roles/comandos/USING/WITH CHECK; nenhum trigger não interno em ambas as bases |
| 22 funções | Assinaturas, retornos, linguagem, volatilidade, SECURITY DEFINER, owners e settings coincidem; **20 diferenças de hash explicadas automaticamente por CRLF** e **2 compatibilidades confirmadas pelo usuário após comparação direta dos corpos** |
| ACLs existentes | Anon/authenticated não ganharam capacidades adicionais em relação ao core nominal. `service_role` tem grants explícitos adicionais nas 6 tabelas públicas e EXECUTE em 16 funções, inclusive 2 backups privados sem USAGE do schema para esse papel |
| Schemas | Schemas privados e suas barreiras coincidem; `public` tem grants explícitos USAGE adicionais a anon/authenticated/service_role, sem CREATE para clientes |
| 384 dependências | Coincidem após normalizar exclusivamente OIDs em nomes automáticos de RI triggers/TOAST; nomes de negócio, referências e multiplicidade são preservados |
| Defaults e papéis | 96 grants padrão reais (48 de postgres, 48 de supabase_admin), ausentes na base nominal. postgres gerenciado não é superuser; service_role tem BYPASSRLS; authenticator é NOINHERIT. Isso não autoriza conceder esses atributos ao executor |
| Auth/ambiente | `auth.users`, `auth.identities`, `auth.uid()`/`auth.jwt()` e colunas necessárias presentes. Extensões e publicação Realtime foram revisadas como diferenças do provedor, sem confundir seus schemas com o aplicativo; configuração/serviço Auth não é provada pelo JSON |
| Delta 005–026 | Nenhuma tabela, schema privado de Escalas ou RPC exclusiva das novas fases aparece no escopo inventariado; apenas os objetos esperados do core. Os objetos novos da 026 também estão ausentes, embora a consulta antiga termine o conjunto de marcadores em 025. Nenhum ledger/executor existente foi encontrado |

### Duas funções conciliadas por confirmação do usuário

Em 05/11/2026, o usuário informou ter consultado diretamente as duas funções no Supabase IASD_Parada e comparado seus corpos com `database/002_user_management.sql`. Confirmou ambas como **compatíveis**, com lógica equivalente e diferenças de formatação CRLF. Essa confirmação encerra o bloqueio das duas definições. O assistente não repetiu a consulta nem recebeu novos corpos SQL para verificação independente.

Os hashes abaixo são preservados como evidência histórica da comparação automática; não foram alterados para simular igualdade de bytes.

| Função | MD5 local LF | MD5 local com corpo CRLF | MD5 informado pelo Supabase |
| --- | --- | --- | --- |
| `iasdpi_admin_private.lock_admin()` | `698ce1ca9601dcf2af3e7bf3bd2e6309` | `a60a2ceb0c2411234c8ba1b872a6c81b` | `a08de7e54bdd7ad4dbbd3c2487c6e92e` |
| `public.iasdpi_create_invite(text)` | `b31cc90fcae9b1b88d14cca3dfe2b2cd` | `4480642944ef71693ee508bdaedc9828` | `7a8b15d93b0a009e0d0489d8b333661d` |

O JSON original contém hash, não corpo SQL. A confirmação posterior do usuário resolve a equivalência de lógica dessas duas funções sem alterar os hashes observados. `lock_admin` participa da serialização administrativa, e `create_invite` de convites/autorizações; a 011 preserva/transforma implementações existentes. Não substituir nem reexecutar 002 por diferenças de formatação.

Para as outras 20 funções, o hash da **definição inteira** passou a coincidir ao transformar somente LF→CRLF no corpo local conhecido. Não foi feita normalização permissiva do código desconhecido. O comparador continua exibindo ACLs e outras diferenças, mesmo quando o corpo é conciliado.

**Classificação:** 001–004 compatíveis no escopo analisado, com a conclusão das duas funções da 002 baseada na confirmação do usuário. A execução literal de qualquer arquivo continua sem prova de ledger. 005–026 pendentes no escopo, condicionadas aos bloqueios operacionais e à autorização; não há necessidade demonstrada de 027. A integridade dos dados reais não é inferida de metadados.

### Ensaio dirigido às diferenças do provedor

Reproduzidos localmente os grants existentes, os 48 defaults de postgres/public, BYPASSRLS do service_role e os corpos CRLF comprovados. Os 48 defaults de supabase_admin foram revisados, mas não se aplicam às migrações executadas como postgres. Antes do delta, **todos os metadados das 12 tabelas coincidiram**; nas funções sobraram somente os dois hashes acima.

As **22 etapas 005–026 e seus checks passaram**, preservando os dados sintéticos do core em cada etapa. Limites do ensaio anterior: as duas funções então pendentes usaram o código nominal local; postgres local é superuser; Auth é stub; não é clone do banco real nem prova de DCL, gateway, dados ou Auth gerenciado. Os 37 testes anteriores não foram repetidos; os 8 testes do comparador permanecem como evidência anterior. Nenhum teste foi reexecutado nesta atualização documental.

**Leitura complementar encerrada pela confirmação do usuário.** `database/check_g10_5_function_definitions.sql` permanece preservado como artefato de preparação e não precisa ser executado novamente. Nenhum SQL foi executado pelo assistente; não há solicitação de nova auditoria ou de reenvio das definições.

O arquivo informa `transaction_read_only=off`: a sessão original não estava protegida por READ ONLY. Isso não torna o SELECT catalogal uma escrita nem justifica refazer a auditoria; tampouco se deve afirmar que aquela transação estava em modo READ ONLY. A identidade do projeto permanece atestada pelo envio do usuário, não por conexão independente desta análise.

## 3. O que fazer no painel agora — somente consultar

Sem clicar em Save, Restore, Reset password, Generate ou Deploy:

1. Abrir **IASD_Parada** e conferir em **Project Settings → General** o nome/referência. Comparar com o projeto configurado no frontend; não selecionar outro projeto por semelhança.
2. Em **Database → Backups**, anotar plano, backups/pontos PITR disponíveis, instante/fuso e possibilidade de restaurar em novo projeto. **Não** habilitar PITR, mudar plano ou iniciar restauração nesta etapa. A disponibilidade não foi presumida.
3. Em **Authentication → Users**, apenas confirmar que o administrador atual continua identificado. Não exportar usuários, criar conta ou redefinir senha.
4. Em **Authentication → Sign In / Providers**, **URL Configuration**, **Email/SMTP**, **Sessions** e telas equivalentes da versão do painel, registrar configurações relevantes sem valores secretos: inscrições públicas, provedor e-mail, Site URL/redirects, política de senha, sessão/refresh e recuperação.
5. Em **Edge Functions**, registrar se `alias-login` e `access-assistance` existem, versões e nomes dos segredos configurados. Não revelar/copiar valores. Em **Database/API/Integrations**, registrar schemas expostos e integrações externas relevantes, sem mudar nada.
6. O JSON G10.1 já foi analisado, e o usuário confirmou as duas definições complementares como compatíveis. Não repetir as consultas. Abrir o SQL Editor não é autorização para clicar **Run** em migração/check.

Essas informações são pré-condições operacionais, não uma nova auditoria SQL. Os nomes de menus podem variar; não usar uma opção destrutiva para localizar uma informação.

## 4. Backup e restauração: procedimento para aprovação

**Procedimento manual atualizado:** [backup antes da implantação](backup-manual-before-installation.md). O usuário confirmou plano Free e nenhum backup disponível no painel; o caminho atual é exportação lógica completa com validação em destino separado. Os caminhos gerenciados abaixo são alternativas condicionadas à disponibilidade futura e autorização, não opções já disponíveis no IASD_Parada.

### Caminho preferencial: backup gerenciado e recuperação separada

1. Definir operador, destino protegido, custo aprovado, RPO (perda máxima aceitável), RTO (tempo máximo de recuperação), janela sem gravações afetadas e ponto anterior à 005. Sem PITR, confirmar se o backup diário é recente o suficiente; um backup antigo não protege os cultos registrados depois dele.
2. Após autorização, em **Database → Backups → Scheduled backups / Point in Time**, selecionar/registrar o ponto recuperável efetivamente disponível. Não pressupor botão de download: backups físicos podem não ser baixáveis. Anotar identificação e instante; para arquivos exportados, gerar SHA-256 e guardar em cofre criptografado fora do Git.
3. O backup de banco inclui estruturas/dados da aplicação e dados Auth (UUIDs, identidades e hashes mantidos pelo provedor). **Não** recuperar contas recriando usuários manualmente: isso troca UUIDs e quebra vínculos. Não extrair hashes ou senhas para relatório.
4. Preservar separadamente configurações Auth/SMTP/templates/redirects/sessões, versões/configuração Edge, nomes e referências dos segredos no cofre, chaves/configuração do frontend, Data API, Realtime e integrações externas. Arquivos Storage não são recuperados pelo backup de banco; se usados, precisam de cópia e procedimento próprios. Senhas de roles LOGIN personalizadas também exigem tratamento próprio; não redefini-las preventivamente.
5. Para ensaio autorizado, usar **Database → Backups → Restore to a New Project**, se disponível, selecionar o ponto, revisar custo/destino e somente então confirmar. Isso cria projeto com dados reais e exige autorização específica, acesso restrito e nenhum frontend público conectado.
6. Antes de escolher clonagem física, verificar jobs `pg_cron`, webhooks, `pg_net`, wrappers e outras integrações: podem voltar a executar imediatamente no clone. Se não houver contenção segura, usar recuperação lógica revisada em destino isolado, conforme o provedor. Não desativar integrações da origem sem autorização.
7. No destino, validar contagens/digests aprovados, IDs/referências, documentos/revisões/modelos/Lixeira, funções/owners/RLS/grants e Auth. Reconfigurar os componentes externos com referências do destino, sem reutilizar endpoints/segredos da origem indiscriminadamente. Testes de login/redefinição/escrita exigem autorização própria; não enviar e-mails aos membros.
8. Somente após restauração verificada, aprovar o backup e a passagem pelo ponto crítico 011. O ensaio PostgreSQL local já concluído não aprova o mecanismo gerenciado real.

### Se não houver backup gerenciado adequado

Interromper a implantação até aprovar um caminho de exportação/restauração lógico completo. O SQL Editor não gera backup completo. Não redefinir a senha do banco para obter acesso nesta etapa.

Exemplo **para execução futura autorizada**, em estação administrativa com PostgreSQL compatível e serviço libpq `iasdpi_origem` configurado em arquivo protegido, SSL e credencial fora do shell/Git:

```sh
umask 077
pg_dump --dbname='service=iasdpi_origem' --format=custom --file=iasdpi-pre-g105.dump
pg_restore --list iasdpi-pre-g105.dump > iasdpi-pre-g105-conteudo.txt
sha256sum iasdpi-pre-g105.dump > iasdpi-pre-g105.dump.sha256
```

Não foi executado. Confirmar ausência de erros e presença de schemas privados IASDPI, `public`, dados Auth/identidades e objetos necessários no arquivo; sucesso parcial não é backup completo. Não adicionar `--schema=public`, pois excluiria Auth/históricos privados. Conferir também roles/grants globais, dependências gerenciadas e Vault/chaves, se utilizados. Arquivo SQL/TOC não comprova restauração.

Para restaurar em **outro Supabase**, seguir o [procedimento lógico do provedor](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), adaptado ao destino e testado antes do corte: roles/schema/data, customizações Auth/Storage e chaves de criptografia podem exigir etapas separadas. Não importar cegamente roles/owners gerenciados nem aplicar o dump por cima de um projeto em uso. Sem esse ensaio, este caminho permanece bloqueado. A criação do destino, exportação de dados reais e qualquer restore não estão autorizados agora.

### Falha durante a instalação

Parar no primeiro erro/check irregular, identificar último COMMIT e conter as escritas afetadas conforme plano. Não reaplicar a etapa commitada, não usar CASCADE nem encadear downs. A 026 não tem retorno automático seguro após uso; 015/024/025 também têm restrições.

Preferir correção incremental revisada quando existem novas gravações. Se precisar recuperar, restaurar primeiro em destino separado, conciliar os cultos/acessos/históricos posteriores ao ponto e aprovar o corte. **Restore/PITR no IASD_Parada substitui seu estado e interrompe a Cronoanálise**, podendo perder alterações posteriores: exige autorização distinta e janela própria. Preservar logs, auditoria e política de troca de senha até solução compatível.

Referências do provedor consultadas nesta preparação: [Database Backups](https://supabase.com/docs/guides/platform/backups) e [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project). Não houve consulta ao projeto real nem pressuposição sobre o plano contratado.

## 5. Instalação em grupos controlados — ainda não executar

Pré-condições: comparação integral aprovada; backup/recuperação verificados; arquivos/hashes do manifesto aprovados; administrador existente e janela confirmados. Não reinstalar 001–004, fazer bootstrap administrativo ou criar ledger improvisado.

| Grupo | Ordem exata | Verificação e ponto de interrupção |
| --- | --- | --- |
| A — Escalas | 005 → 006 → 007 → 008 → 009 → 010 | Check de cada etapa no manifesto; guardar resultado e comparar o core antes de avançar |
| B — Igreja/core | 011 | **Autorização/janela e DCL confirmados antes**; após, `check_church_isolation.sql`, IASD_PI, acesso/core e zero perda de dados |
| C — Acesso/Ancionato | 012 → 013 → 014 → 015 → 016 | Checks individuais de alias, governança, portal, Ancionato e dias; não ativar contas/flags |
| D — Cadastro Geral | 017 → 018 → 019 | Checks de cadastro e identidades; sem conciliação/importação automática |
| E — Eventos/regras | 020 → 021 → 022 → 023 → 024 → 025 | Checks individuais; manter os novos módulos fechados; 025 é intermediária |
| F — Governança final | 026 | `check_governance_responsibilities.sql` e final `check_church_isolation.sql`; não liberar sem backend compatível |

Cada grupo é um checkpoint de liberação, **não uma transação única**: executar um arquivo inteiro de cada vez, com seu BEGIN/COMMIT, pelo SQL Editor no projeto/papel conferidos ou canal administrativo aprovado. Após cada arquivo, executar somente os checks correspondentes listados no [manifesto](governance-g10-4-migrations.json), ler o resultado, guardar hash/horário/operador/COMMIT e autorizar avanço. Não executar os 22 arquivos de uma vez. Um check pode falhar depois de o COMMIT já ter ocorrido.

Erros, objetos inesperados, colisões, contagem alterada, owner/grant divergente ou dependência ausente interrompem o processo. Não executar checks históricos em lote após 026: alguns esperam o estado anterior à 011. Nenhum desses checks foi executado no Supabase nesta preparação.

## 6. Cronoanálise e ativação do acesso

A **011 é o ponto de maior impacto no núcleo existente**: acrescenta/preenche igreja, modifica chaves/FKs/índices, owners, funções e RLS e usa locks exclusivos. A 026 também altera validações de sessão/RPC e o controle administrativo. Instalação no mesmo Supabase não é isolamento de produção, mesmo que o frontend use uma URL de homologação.

Preservar UUIDs Auth e IDs de cultos, documentos, projeções, versões, modelos, arquivos, recibos e Lixeira. Não transformar líderes ministeriais em `iasdpi_access.role='leader'` global. Antes/depois dos pontos B/F, conferir o core e, em fluxo controlado autorizado, e-mail/login/sessão, consulta e gravação de um culto de teste separado, modelos, histórico e recuperação da Lixeira. Nenhum culto real deve ser usado como exercício. A preservação foi comprovada localmente; no projeto real depende dos gates e verificações autorizadas.

Checklist de ativação posterior, sem execução agora:

- [ ] **Auth → Sign In / Providers:** preservar provedor e-mail e UUIDs; desabilitar inscrições públicas apenas na ativação aprovada. Não substituir URLs, política de sessão ou SMTP da Cronoanálise sem análise.
- [ ] **Auth → URL Configuration/Email/Sessions:** acrescentar a origem HTTPS e callback PKCE exatos; validar recuperação, expiração/refresh/logout; revisar templates/remetente sem mandar mensagens reais não autorizadas.
- [ ] **Edge Functions:** implantar as versões revisadas `alias-login` e `access-assistance`. Aplicar `verify_jwt=false` somente nesses endpoints pré-auth do `supabase/config.toml`; emissão/reset/troca privada continuam exigindo JWT validado e autorização interna.
- [ ] **Edge → Secrets:** conferir `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` ou legado `SUPABASE_ANON_KEY`; `IASDPI_ALIAS_LOGIN_PEPPER`/`IASDPI_GOVERNANCE_PEPPER` (mínimo 32 caracteres); flags `IASDPI_ALIAS_LOGIN_ENABLED`/`IASDPI_GOVERNANCE_ENABLED`; listas exatas `IASDPI_ALIAS_ALLOWED_ORIGINS`/`IASDPI_GOVERNANCE_ORIGINS`. Não rotacionar peppers com links pendentes sem plano. Headers opcionais `IASDPI_*_TRUSTED_IP_HEADER` só com gateway que os sobrescreva.
- [ ] **Frontend conectado:** preparar origem/artefato sem fixtures e flags coerentes até `responsibilityGovernanceEnabled`. O gerador de HML recusa deliberadamente o projeto de produção; não remover a proteção para conectá-lo. Definir caminho de implantação autorizado antes de ativar.
- [ ] **Contas:** somente administrador provisiona individualmente por canal confiável, reutiliza o Cadastro Geral/UUID existente e confirma responsabilidades. Alias não é senha nem permissão; múltiplos ministérios são vínculos da mesma identidade. Não criar usuários agora.
- [ ] **Primeira senha:** credencial provisória única, entrega privada e `iasdpi_require_password_change` apenas após Edge/frontend seguros disponíveis. Testar troca própria e redefinição supervisionada, expiração/uso único/logout global e falhas parciais. Não marcar contas antigas indiscriminadamente.
- [ ] **Permissões:** líder publica no próprio ministério; evento geral por líder aguarda aprovação; ancião explicitamente autorizado/admin aprova; só admin gere contas/acessos/auditoria. Verificar com JWT real, sem conceder acesso pela simples participação.
- [ ] **Auditoria:** `iasdpi_governance_history` exclusiva do administrador; conferir ator/data/ação/registro/versões, aprovações e alterações de acesso sem senhas/tokens/contatos privados. Logs operacionais manuais do painel são evidência separada.
- [ ] **Público:** calendário e Organograma sem conta; respeitar a privacidade das escalas, eventos Restritos e rascunhos. Testar login por e-mail existente antes de liberar login por apelido aos responsáveis.

## 7. Bloqueios e próxima autorização

| Bloqueio | Para remover |
| --- | --- |
| Compatibilidade das duas definições do core | **Concluída por confirmação do usuário**; não constitui mais bloqueio |
| Recuperação real e continuidade da Cronoanálise | Confirmar plano/ponto/RPO/RTO e autorizar backup/ensaio separado com contenção de integrações externas |
| DCL, locks e janela da 011 | Confirmar operador e privilégios do provedor, duração aceitável e interrupção controlada de escritas |
| Auth/Edge/frontend e dados iniciais | Autorizar configuração/implantação controlada e testes com identidades permitidas; não presumir importação ou provisionamento |

**Próxima etapa:** confirmar backup recuperável, configurações Auth/Edge e janela de implantação, mantendo a verificação de DCL do operador prevista no plano. A instalação das 22 migrações continua aguardando autorização específica. Não repetir o inventário ou as consultas das duas funções.

**Exigem autorizações próprias:** exportar/copiar conteúdo real; criar destino e restaurar; executar cada lote SQL/checks no banco existente; mudar Auth/segredos/Edge/frontend; criar/vincular contas ou conceder permissões; importar/conciliar pessoas e históricos; realizar testes de gravação ou liberar módulos. A autorização atual de commit/push não cobre essas operações. Não há recomendação para começar 005 enquanto os bloqueios acima persistirem.
