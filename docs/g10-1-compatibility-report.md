# G10.1 — Compatibilidade do Supabase existente

Data: 05/11/2026, America/Sao_Paulo. **Situação: inventário real aguardado.** Este relatório trata o `IASD_Parada` como projeto informado pelo usuário; não comprova seu conteúdo nem presume a instalação de 001–004.

A preparação não abriu conexão com Supabase, não executou migrações reais, não criou usuários, não mudou frontend/configurações e não realizou commit, push, merge ou publicação.

## Código de referência preservado

- Branch local e remota de desenvolvimento: `feat/schedule-management-b1`, commit `f7922c281d53a33a103f2510728fa02cdb69d58c`.
- Homologação estática existente: commit `711085f651a5f0b2d3e3cb3ab1500c9893b44e23` do repositório `IASDPI-homologacao`. O manifesto referencia exatamente o commit de desenvolvimento acima.
- A interface publicada já inclui as alterações **022–025**: recorrência/reservas, edição do mês atual, Comunicação compatível, vagas pendentes e publicação direta de eventos. Limitar a futura instalação à 021 não atende integralmente à versão visual aprovada.
- Os arquivos existentes de migração, aplicação e homologação foram preservados. Nenhuma sincronização com a `main` foi feita; ela e `gh-pages` têm alterações remotas próprias e não representam o estado instalado no banco.

## Reaproveitamento da G9

Foram revisados `database/check_g9_baseline.sql`, `scripts/audit_g9_migrations.py`, `scripts/compare_g9_snapshots.py`, `docs/governance-g9-homologation.md` e `docs/g9-real-validation.md`.

O baseline G9 é somente leitura, mas seus `core_fingerprints` usam consultas dinâmicas e agregação integral de registros operacionais. Também cobre marcadores somente até 019. **Não será executado no projeto real nesta etapa.** O novo `check_g10_1_inventory.sql` reaproveita a identificação estrutural e os hashes, amplia ACL/default privileges/dependências/marcadores até 025 e dispensa leitura dos dados de negócio.

O comparador G9 aceita exclusivamente o formato G9 com 19 marcadores: **não passar o novo JSON a ele sem adaptação**. Referências sintéticas e hashes de arquivos não são evidência de produção. A futura comparação usará a mesma consulta/versão de captura em uma referência compatível e no inventário observado, tratando diferenças do provedor e de versão PostgreSQL separadamente.

A G9 assumia homologação em projeto novo. Agora o usuário escolheu o banco existente da Cronoanálise. O gerador `build_homologation.py --real-homologation` rejeita deliberadamente os projetos de produção conhecidos. **Essa proteção foi mantida**: uma futura conexão ao projeto existente precisa de plano específico, sem simplesmente remover esse bloqueio ou trocar URL/chave na demonstração estática.

## Classificação preliminar de cada migração

Todas estão **indeterminadas**: nenhum resultado do banco foi recebido. A coluna de dependência expressa a cadeia de revisão do código, **não uma autorização ou lista de arquivos a executar**. A 011 admite um caminho core-only; esse caso exige plano diferente.

| Nº | Dependência de referência | Efeito/risco principal | Estado remoto |
| --- | --- | --- | --- |
| 001 | Auth/papéis do provedor e inventário prévio | Acesso, modelos e arquivo; seed de modelo. Não reexecutável | Indeterminada |
| 002 | 001 | Convites, administração e auditoria; schemas/RPCs novos | Indeterminada |
| 003 | 001–002 | Cultos operacionais, versões, projeções e modelos | Indeterminada |
| 004 | 001–003 | Lixeira, índices, colunas e policies existentes | Indeterminada |
| 005 | 001–004 | Cadastro único, vínculos, funções, habilitações, contatos privados | Indeterminada |
| 006 | 005 | Eventos técnicos de escala, planos, requisitos, atribuições e versões | Indeterminada |
| 007 | 006 | Backfill de datas, regras diárias, disponibilidade e exceções | Indeterminada |
| 008 | 007 | Contexto mensal/rodízio; move implementação anterior | Indeterminada |
| 009 | 008 | Compromissos históricos e validação cruzada | Indeterminada |
| 010 | 009 | Participação geral e edição manual; troca kernels | Indeterminada |
| 011 | 001–004; 005–010 completas se houver Escalas | Backfill, PK/FK, RLS e owners também da Cronoanálise; locks exclusivos | Indeterminada |
| 012 | 011 | Aliases Auth privados e orçamento de login; não cria contas | Indeterminada |
| 013 | 012 e Escalas 005–010 | Capacidades ministeriais, estados de acesso e recuperação | Indeterminada |
| 014 | 013 | Contexto do portal e feed publicado sanitizado | Indeterminada |
| 015 | 014 | Semana/mês do Ancionato, histórico e concorrência | Indeterminada |
| 016 | 015 | Dias por departamento; preserva configuração anterior | Indeterminada |
| 017 | 016 | Vínculos centrais e fontes; participa quem já tinha habilitação | Indeterminada |
| 018 | 017 | Busca substitui RPC existente; não reaplicar depois da 019 | Indeterminada |
| 019 | 018 | Aliases históricos e conciliação explícita; instalar não mescla pessoas | Indeterminada |
| 020 | 019 | Eventos editoriais e histórico, separados de `schedule_events` | Indeterminada |
| 021 | 020 | Classificação/privacidade e feeds; não reaplicar após 022–025 | Indeterminada |
| 022¹ | 021 | Recorrência, reservas exclusivas e alteração das RPCs | Indeterminada |
| 023¹ | 022 | Edição do mês atual, datas encerradas e janela futura | Indeterminada |
| 024¹ | 023 | Comunicação compatível e publicação com pendências | Indeterminada |
| 025¹ | 024 | Publicação direta de eventos; aprovação intermediária desativada | Indeterminada |

¹ Dependências adicionais da versão publicada; não incluídas artificialmente no escopo 001–021 como se já estivessem no banco.

Catálogo revisável com arquivos, SHA-256, efeitos, riscos e existência de down: `g10-1-migration-review.json`. Há um único arquivo forward por número de 001 a 025. `_down.sql`, `check_*.sql` e `supabase-archives.sql` **não** são etapas forward da sequência.

Após o inventário, usar:

- **Instalada:** estruturas, implementações atuais ou substituições posteriores, owners, RLS, grants e dependências compatíveis; registrar evidência e proveniência. Isso não prova execução literal do arquivo sem histórico confiável.
- **Pendente:** ausência confirmada dos objetos/efeitos relevantes, com predecessores e projeto conferidos; nunca concluir por um único marcador.
- **Divergente:** instalação parcial, definição/RLS/ACL/owner inesperado, mudança fora de ordem ou efeito incompatível. Não tentar corrigir reaplicando o arquivo inteiro.
- **Indeterminada:** inventário ausente/incompleto, permissão insuficiente ou evidência ambígua — especialmente funções substituídas por etapas posteriores, como a 018.

## Configuração para conexão real: ainda não verificada

| Componente | Código atual e necessidade de verificação |
| --- | --- |
| Identidade do projeto | `frontend/config.js` aponta para a referência pública `pwbxksxxmnblqwpvlheu`; confirmar no painel que corresponde ao `IASD_Parada` informado |
| Auth existente | Preservar contas, UUIDs, login por e-mail, sessões e recuperação. Código usa SDK único, PKCE e tratamento explícito do callback. Conferir política real, redirects, sessões, SMTP e hooks no painel |
| Flags | No arquivo fonte, `churchIsolationEnabled`, `aliasLoginEnabled`, `governanceEnabled`, `portalAccessEnabled` e `centralRegistryEnabled` estão false; Eventos/privacidade não estão ativados ali. A prévia ativa seu próprio simulador. Nenhuma flag alterada nesta auditoria |
| Dependências de flags | Alias exige igreja; governança exige igreja+alias; portal exige governança; Cadastro Geral e Eventos exigem portal; privacidade exige Eventos. Flags não concedem permissão no banco |
| Backend | Verificar igreja/contexto `x-iasdpi-church`, autorização por capacidade e RPCs transacionais. Não substituir RLS por ocultação de menus |
| Edge Functions | Código disponível para `alias-login` e `access-assistance`; implantação real desconhecida. O `verify_jwt=false` local é específico dos endpoints pré-auth, com validação própria nas ações protegidas |
| Segredos | Somente verificar presença dos nomes abaixo; valores ficam no gerenciador do provedor. Nenhum segredo deve ir para HTML, relatório, chat ou Git |
| Frontend conectado | Necessita pacote próprio, configuração pública correta, persistência Supabase, namespace/retorno de sessão revisados e CSP para os endpoints autorizados. Não conectar o HTML exportado com fixtures ao banco real |
| Cronoanálise | Confirmar compatibilidade de leitura/escrita, modelos, versões, arquivos e lixeira antes de qualquer ativação do portal. Ser ancião/gestor de Escalas não concede acesso ao core |

Nomes necessários ao servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` ou legado `SUPABASE_ANON_KEY`; `IASDPI_ALIAS_LOGIN_PEPPER`, `IASDPI_ALIAS_LOGIN_ENABLED`, `IASDPI_ALIAS_ALLOWED_ORIGINS`; `IASDPI_GOVERNANCE_PEPPER`, `IASDPI_GOVERNANCE_ENABLED`, `IASDPI_GOVERNANCE_ORIGINS`. Os headers `IASDPI_ALIAS_TRUSTED_IP_HEADER` e `IASDPI_GOVERNANCE_TRUSTED_IP_HEADER` são opcionais e dependem de gateway que impeça falsificação. Peppers têm mínimo 32 caracteres no código; não gerar nem configurar valores agora.

## O que o inventário não conclui

Não confirma pessoas cadastradas, igreja IASD_PI efetivamente ativa, administradores existentes, contagens/históricos reais, qualidade de dados, desempenho, configuração GoTrue/SMTP/gateway ou implantação Edge. Não chama RPCs para provar permissões: até RPCs de catálogo/contexto podem atualizar controles/estado. `pg_depend` não cobre integralmente chamadas dentro de corpos PL/pgSQL; comparar os hashes e revisar as definições específicas quando necessário. Hash diferente não autoriza substituição automática, inclusive entre versões de PostgreSQL.

As 15 escalas de Sonoplastia, cinco de Comunicação, fontes do Ancionato, IDs e nomes confirmados permanecem preservados no código. Sua eventual presença/associação no banco real ainda depende de levantamento específico posterior; não se presume importação nem se executa conciliação automática.

## Validação desta preparação

Resultados em `g10-1-validation.json`. Testes locais verificam banco vazio, base 001–004, caminho 011 sem Escalas, cadeia 001–025 e metadados de objetos extras/inseguros, sem retornar valores sintéticos privados. O inventário é executado em transação READ ONLY no PostgreSQL descartável sem rede. A G9 é exercitada como regressão de seus mecanismos de preparação. Nenhum resultado local foi usado para marcar migrações remotas como instaladas.

Próxima etapa: seguir `g10-1-inventory-instructions.md` e receber o inventário. Plano, backup e autorizações: `g10-1-incremental-plan.md`.
