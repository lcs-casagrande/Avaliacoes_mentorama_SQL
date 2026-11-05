# IASDPI — G10.5: preparação final do Supabase existente

Data: 05/11/2026. Branch: `feat/schedule-management-b1`.

**Decisão: roteiro preparado; G10.5 pendente da comparação integral, e instalação real bloqueada também pelos requisitos operacionais abaixo. Nenhum acesso ao Supabase foi feito nesta etapa.** A autorização atual cobre Git na branch de desenvolvimento; não cobre migrações, backup real, restauração, configuração ou contas.

## 1. Código consolidado e evidência reaproveitada

- Commit de implementação G10.3/G10.4: `07b451b86c550ed7b3b51fd565e1773b0a69ea82`, incluindo a preparação G10.1 da qual os testes e a documentação dependem. Sem arquivos `dist/`, dumps, credenciais ou inventário real.
- [Branch para revisão](https://github.com/lcs-casagrande/Avaliacoes_mentorama_SQL/tree/feat/schedule-management-b1). Push de `07b451b` confirmado. A primeira tentativa retornou erro interno do GitHub; a segunda concluiu sem force push. Nenhuma alteração foi enviada para main/gh-pages ou para o repositório de homologação.
- Mantidos os **37 testes selecionados aprovados na G10.4**, 22 checkpoints e restaurações locais 004/026, com comparação das 47 tabelas finais. Não foram repetidos testes, inventários ou migrações. Hashes dos SQLs/checks/runtime continuam iguais aos testados.
- [Manifesto exato 005–026](governance-g10-4-migrations.json), [evidências G10.4](governance-g10-4-validation.json), [regras G10.3](governance-g10-3.md) e [relatório G10.4](governance-g10-4-readiness.md) preservados. As declarações de Git nesses documentos são históricas, anteriores à autorização G10.5; seus hashes não foram regenerados para simular novos testes.
- Nenhuma migração nova nem alteração funcional nesta etapa. A 026 continua necessária; a 025 não representa a governança final.

## 2. Comparação integral 001–004: bloqueio explícito

Foram procurados o JSON e o relatório nos arquivos disponíveis em `/workspace` e `/tmp`, por nome e pelo formato `IASDPI_G10_1_SCHEMA_INVENTORY`. Foram encontrados o SQL e a preparação, **não o JSON integral retornado pelo Supabase nem o relatório completo G10.2**. A localização do arquivo já coletado foi solicitada, sem repetir a consulta.

O resumo recebido — 12 tabelas, 22 funções, RLS ativa, marcadores 001–004 presentes e 005–025 ausentes — não permite concluir equivalência. Consequentemente, **não há divergência remota comprovada nem liberação técnica do delta real**. O teste nominal local não substitui essa comparação.

| Dimensão exigida | O que comparar no JSON já coletado contra o código 001–004 e suas substituições | Estado nesta entrega |
| --- | --- | --- |
| Tabelas/colunas | Nomes, tipos, nulabilidade, defaults, identidade/geração e owners | Não comparado: JSON indisponível |
| Integridade | PK, UNIQUE, FK, colunas referenciadas, validação e deferrabilidade | Não comparado |
| Índices/triggers | Definições/hash, validade, função e estado de ativação | Não comparado |
| Funções | Assinatura completa, retorno, `definition_md5`, linguagem, volatilidade, SECURITY DEFINER, owner e search_path | Não comparado; contagem 22 não basta |
| RLS | Habilitação/force, comando, papéis, permissividade e hashes USING/WITH CHECK de cada policy | Somente habilitação informada; políticas não comparadas |
| Permissões | ACL explícita e efetiva, PUBLIC/anon/authenticated/service_role, schemas, colunas, sequências, EXECUTE e privilégios padrão | Não comparado |
| Dependências | `pg_depend`, primitivas Auth, extensões e referências dos corpos PL/pgSQL | Não comparado; catálogo não cobre todos os corpos |
| Ausência do delta | Conjunto de objetos/efeitos 005–026, não apenas seus marcadores; colisões/instalações parciais | Pendente de confirmação integral |

O inventário retorna hashes, não todos os corpos de função. Se algum hash divergir, registrar assinatura/esperado/observado e verificar versão do PostgreSQL antes de interpretar a diferença. Revisar apenas a definição divergente, com autorização de leitura complementar se indispensável; não sobrescrever a função nem refazer a auditoria inteira. `auth.uid()`/`auth.jwt()` hospedadas não devem ser comparadas como se fossem os stubs de Auth dos testes locais.

**Para desbloquear:** disponibilizar o JSON existente por canal protegido ou indicar seu caminho. Não enviar senhas, connection strings, dumps de Auth ou tokens. Esta entrega não solicita executar novamente `check_g10_1_inventory.sql`. Até a análise, 001–004 são “compatíveis conforme informação recebida”; 005–026 são “delta candidato”, não uma instalação autorizada.

## 3. O que fazer no painel agora — somente consultar

Sem clicar em Save, Restore, Reset password, Generate ou Deploy:

1. Abrir **IASD_Parada** e conferir em **Project Settings → General** o nome/referência. Comparar com o projeto configurado no frontend; não selecionar outro projeto por semelhança.
2. Em **Database → Backups**, anotar plano, backups/pontos PITR disponíveis, instante/fuso e possibilidade de restaurar em novo projeto. **Não** habilitar PITR, mudar plano ou iniciar restauração nesta etapa. A disponibilidade não foi presumida.
3. Em **Authentication → Users**, apenas confirmar que o administrador atual continua identificado. Não exportar usuários, criar conta ou redefinir senha.
4. Em **Authentication → Sign In / Providers**, **URL Configuration**, **Email/SMTP**, **Sessions** e telas equivalentes da versão do painel, registrar configurações relevantes sem valores secretos: inscrições públicas, provedor e-mail, Site URL/redirects, política de senha, sessão/refresh e recuperação.
5. Em **Edge Functions**, registrar se `alias-login` e `access-assistance` existem, versões e nomes dos segredos configurados. Não revelar/copiar valores. Em **Database/API/Integrations**, registrar schemas expostos e integrações externas relevantes, sem mudar nada.
6. Recuperar o resultado salvo da G10.1 a partir da exportação/arquivo anterior. Abrir o SQL Editor não é autorização para clicar **Run** em qualquer migração/check.

Essas informações são pré-condições operacionais, não uma nova auditoria SQL. Os nomes de menus podem variar; não usar uma opção destrutiva para localizar uma informação.

## 4. Backup e restauração: procedimento para aprovação

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
| Comparação remota integral 001–004 e ausência de efeitos 005–026 | Receber e analisar offline o JSON G10.1 já coletado; investigar somente diferenças indispensáveis |
| Recuperação real e continuidade da Cronoanálise | Confirmar plano/ponto/RPO/RTO e autorizar backup/ensaio separado com contenção de integrações externas |
| DCL, locks e janela da 011 | Confirmar operador e privilégios do provedor, duração aceitável e interrupção controlada de escritas |
| Auth/Edge/frontend e dados iniciais | Autorizar configuração/implantação controlada e testes com identidades permitidas; não presumir importação ou provisionamento |

**Você pode agora:** indicar o JSON já coletado e informar, por consulta ao painel, quais backups/PITR estão disponíveis. Não precisa executar novamente o inventário nem qualquer migração.

**Exigem autorizações próprias:** exportar/copiar conteúdo real; criar destino e restaurar; executar cada lote SQL/checks no banco existente; mudar Auth/segredos/Edge/frontend; criar/vincular contas ou conceder permissões; importar/conciliar pessoas e históricos; realizar testes de gravação ou liberar módulos. A autorização atual de commit/push não cobre essas operações. Não há recomendação para começar 005 enquanto os bloqueios acima persistirem.
