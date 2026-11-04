# G4 — Portal integrado e ativação gradual

Implementação local na branch `feat/schedule-management-b1`, preservando G1–G3 e os Lotes anteriores. Sem commit, merge, push, publicação ou acesso ao Supabase real. Os flags de produção continuam desativados.

## Resultado

| Área | Comportamento preparado |
|---|---|
| Início | `#church-home`, público. Reutiliza o portal aprovado. |
| Agenda / Organograma | Públicos, com os dados e fontes existentes. Conteúdo da IASD_PI não é reutilizado para outra igreja. |
| Escalas publicadas | `#schedule-calendar`, público; mantém históricos manuais e Agenda oficial e consulta a projeção de versões publicadas. |
| Montagem / Cadastros | Exigem identidade Auth e permissões verificadas no servidor. O login ministerial não concede o perfil geral de acesso à Cronoanálise. |
| Departamentos | Prioriza os departamentos autorizados. Alternância mantém a mesma identidade e sessão SDK; não pede senha novamente. |
| Gestão de acessos | Reutiliza G3. Delegados entram apenas no alcance autorizado. Planilha/configurações gerais continuam exclusivas do administrador da igreja. |
| Cronoanálise | `#home`, formulário e validação existentes preservados. O novo Início público usa outra rota. |

Criar/editar, administrar membros e publicar continuam capacidades diferentes. A interface consulta o contexto do servidor; RPCs G3 revalidam a sessão e o departamento na gravação/publicação, preservando versões, conflitos e controle de concorrência. A seleção da igreja e o nome/apelido do usuário não concedem permissões.

O papel existente `admin` é vinculado a cada igreja. A administração de várias igrejas significa possuir autorização em cada uma delas. Não se criou uma permissão irrestrita sobre todas as igrejas. O seletor após autenticação usa apenas as associações autorizadas do próprio usuário e conserva a sessão do SDK ao recarregar o contexto. Somente IASD_PI permanece cadastrada/ativa pela configuração preparada; igrejas auxiliares foram usadas apenas em bancos descartáveis de testes.

## Migração preparada

`database/014_portal_integration.sql`, depois de 001–013 completas. Não cria tabelas, membros ou novas permissões ministeriais e não modifica registros existentes.

| RPC | Acesso e conteúdo |
|---|---|
| `iasdpi_schedule_published(date)` | Anônimo/autenticado: projeção estrita da última versão publicada de cada escala do mês e igreja. Retorna data, departamento, pessoa, função, evento, horários, versão e origem. Não retorna observações, contatos, disponibilidade, Auth UID ou rascunhos. |
| `iasdpi_portal_context()` | Autenticado/autorizado: identidade, perfil administrativo na igreja e capacidades departamentais para navegação. Não retorna cadastros de pessoas ou escalas. |
| `iasdpi_my_churches()` | Autenticado: somente igrejas ativas/listadas às quais `auth.uid()` está autorizado; exclui acessos suspensos/revogados e sessões bloqueadas. Não recebe um user_id arbitrário nem consulta membros de outras igrejas. |

A leitura pública usa `schedule_versions`, não o documento do rascunho atual. Uma nova revisão privada mantém a última versão publicada até nova publicação, como na demonstração já aprovada. O histórico permanece intacto. Nomes exibidos são os nomes centrais do cadastro; contatos e observações nunca entram na projeção.

As duas primeiras funções pertencem ao executor sem BYPASSRLS, com RLS de igreja. `iasdpi_my_churches` é uma ponte de metadados de `postgres`, com `search_path` vazio, necessária para listar exclusivamente as próprias associações entre igrejas. É somente leitura e não concede acesso. O verificador G1 foi atualizado para reconhecer essa exceção específica e conferir seu proprietário.

`database/check_portal_integration.sql` é somente leitura, após 014. Resultado sem linhas indica ausência de irregularidades nos checks executados, não comprova funcionamento real do Auth.

**Atenção à ativação pública:** a 014 concede execução anônima da projeção publicada. Depois de instalada, a API pública funciona independentemente do flag do frontend. Antes da instalação real, revisar e aprovar quais versões já marcadas como publicadas poderão expor nomes, datas e funções. Ocultar botões ou desativar o flag não revoga esse acesso no banco.

## Demonstração para homologação

Arquivo: `dist/portal-integration/IASDPI-G4-homologacao.html`.

Gerar novamente:

```sh
python scripts/export_preview.py --integrated-access-preview --output dist/portal-integration/IASDPI-G4-homologacao.html
```

A demonstração utiliza o SDK e as telas reais com um provedor Auth/RPC simulado e dados de montagem fictícios em memória. A CSP bloqueia conexões externas; fetch, XHR e WebSocket não chegam ao Supabase. Os testes foram executados servindo o HTML por HTTP local. Não foi publicada URL HTTPS.

| Identificador fictício | Alcance demonstrativo |
|---|---|
| `som.teste` | Sonoplastia: editar/publicar e administrar membros. |
| `multi.teste` | Sonoplastia e Música: editar/publicar com a mesma sessão. |
| `leitura.teste` | Consulta de Sonoplastia, sem gravação. |
| `editor.teste` | Edição de Sonoplastia, sem publicação. |
| `admin.teste` | Administração da IASD_PI no cenário fictício. |
| `crono.teste` | Login geral `leader` da Cronoanálise; sem permissão ministerial de escalas. |

Senha **exclusivamente fictícia** dos exemplos: `Demonstracao#2026`. As contas também aparecem na ajuda da prévia. Nenhuma conta real ou senha de produção foi criada ou consultada.

A sessão simulada é mantida pelo SDK no namespace próprio da prévia, separado dos registros existentes. As escalas modificadas ficam em memória e reiniciam ao recarregar. Os históricos públicos originais de Sonoplastia, Comunicação e anciãos continuam como fontes distintas; nenhum registro real é importado, consolidado ou sobrescrito. Os participantes dos cadastros e os exemplos novos são fictícios. A demonstração não é um backend de segurança e não deve ser utilizada com dados particulares.

### Roteiro rápido

1. Sem login, abrir Início, Agenda, Organograma e Escalas publicadas.
2. Abrir Montar escala, escolher IASD_PI e entrar com `som.teste`.
3. Preencher automaticamente, revisar e salvar. Conferir que o rascunho não aparece no calendário público.
4. Publicar após confirmação. Abrir o calendário; sair da conta e confirmar que somente a versão publicada continua visível.
5. Entrar com `multi.teste`; alternar Sonoplastia/Música sem novo login. Testar uma atribuição conflitante da mesma pessoa na mesma data.
6. Com `editor.teste`, confirmar que pode salvar e não publicar; com `leitura.teste`, confirmar ausência de gravação.
7. Com `admin.teste`, abrir Gestão de acessos, cadastros e configurações. Conferir a montagem de anciãos por semanas e por meses no cenário demonstrativo.
8. Em Cronoanálise, utilizar o formulário original e `crono.teste`. O acesso ministerial sozinho não autoriza essa área.
9. Testar Voltar/Avançar, recarregar, teclado e mudanças não salvas. Uma falha de consulta pública deve mostrar erro e Tentar novamente; não uma lista vazia.

## Ativação gradual — somente após autorização

1. **Revisão:** inventariar quais migrações realmente estão instaladas. Se faltarem, revisar 005–010, G1/011, G2/012 e G3/013, nessa ordem. Não repetir migrações já instaladas. Conferir backup do banco e pacote atual; o novo código não demanda exportações locais repetidas.
2. **Homologação real:** instalar a sequência revisada e a 014 em projeto Supabase de teste, com contas descartáveis. Configurar G2/G3, origens HTTPS, Auth, recuperação de senha e secrets somente no servidor. Confirmar os verificadores 011–014 e testes de RLS com sessões reais, incluindo expiração e renovação.
3. **Consulta controlada:** habilitar `churchIsolationEnabled`, `aliasLoginEnabled`, `governanceEnabled` e `portalAccessEnabled` apenas no ambiente aprovado. Autorizar inicialmente um líder de teste somente para visualizar. O banco deve negar gravações, além das restrições da interface.
4. **Escritas controladas:** em homologação, conceder editar/publicar separadamente e validar rascunhos, concorrência, substituições manuais, rodízio e histórico. Não usar cultos reais para esses testes.
5. **Publicação pública:** revisar os campos e versões expostos pela 014, obter autorização e só então aplicar em produção/publicar o pacote. Validar entrada anônima e escopo administrativo imediatamente após a publicação. Uma publicação não altera a Agenda oficial nem uma programação de culto já aprovada.

**Dependência preexistente do Ancionato:** os calendários específicos de ancião da semana/mês já eram implementados somente no adaptador de demonstração; não existem RPCs operacionais `iasdpi_schedule_elder_workspace/save` nas migrações 005–013. Foram preservados na prévia, sem inventar persistência real. A 014 não cria essa estrutura. A ativação da montagem desses períodos no Supabase depende de uma evolução posterior, revisada e autorizada; a consulta histórica pública continua funcionando. Não classificar a simulação desses períodos como persistência homologada.

A demonstração oferece recuperação pela fila G3, mas não executa redefinições em provedor real. A recuperação G2/G3, MFA, SMTP, política de senha, sessões reais e browsers/dispositivos físicos continuam pendentes de homologação autorizada. Foram automatizados Chromium e as larguras 360/390/768/1024/1440 px; não se declara teste real em iPhone/Safari ou Android.

## Arquivos desta etapa

- Novos: `frontend/portal-access.js`; migração 014 e `database/check_portal_integration.sql`; `tests/fixtures/portal-integration-preview.js`; testes G4 SQL, navegador e pacote; este relatório.
- Integração: `frontend/{church-portal,churches,auth,app,navigation,schedule-management,agenda,config}.js`, `index.html`, `styles.css`.
- Empacotamento: `scripts/{export_preview,build_homologation}.py`, `backend/server.py` (somente permitir servir os JS estáticos), verificador G1.
- Testes anteriores: atualizados os números esperados de manifesto e o caso de versão desconhecida. Pacotes anteriores não foram regravados.

## Rollback

O manifesto passa a versão 6 para exigir os dois módulos; inventários 1–5 continuam aceitos. A compatibilidade de rollback para inventário v5 foi testada em cópia descartável. Antes de futura publicação, arquivar o pacote real atualmente publicado, incluindo o snapshot mais recente da Agenda.

Desativar `portalAccessEnabled` conserva as rotas e comportamentos anteriores. Isso não remove registros nem relaxa RLS. Se for necessário interromper o acesso público após instalar a 014, o operador deverá revogar explicitamente EXECUTE de `anon` em `iasdpi_schedule_published(date)`, mediante autorização. Não apagar versões, filas, dados ou barreiras de sessão da G3 para retornar o frontend anterior.

Commit sugerido, quando autorizado: `feat: integra portal público e permissões ministeriais G4`.

## Testes executados

**311 testes aprovados nas suítes selecionadas, incluindo 33 novos da G4. Nenhum teste falho nos resultados finais.** Não representa a totalidade histórica do repositório. Os três testes históricos inicialmente ignorados na execução sem PostgreSQL foram executados e aprovados na suíte SQL dedicada; repetições não entram no total.

| Grupo | Aprovados | Evidência |
|---|---:|---|
| G4 navegação, SDK/Auth simulado, permissões, estados e 5 larguras | 19 | `browser-package-evidence.log` |
| G4 manifesto, isolamento dos exemplos e rollback v5 | 3 | `browser-package-evidence.log` |
| G4 RLS/projeção/escopo e publicação concorrente | 11 | `sql-evidence.log` + dois cenários em `security-regression-evidence.log` |
| Regressões de navegador e pacote anteriores | 231 | `legacy-regression-evidence.log` |
| G3 em PostgreSQL + restauração histórica SQL | 25 | `security-regression-evidence.log` |
| Handlers G2/G3 | 22 | `node-regression-evidence.log` |

As nove verificações SQL iniciais passaram, incluindo isolamento da consulta pública e metadados próprios, projeção sem campos privados e bloqueio de publicação após revogação. Dois cenários adicionais comprovaram conflitos cruzados e exatamente um vencedor para publicações concorrentes. O verificador 014 e os verificadores G1/G3 retornaram zero irregularidades no banco descartável.

PostgreSQL executado em container dedicado `--network none`, com contas e registros fictícios. Navegador: Chromium, HTML servido por HTTP local e chamadas Auth/RPC simuladas; nenhum acesso ao Supabase real. O SDK de sessão utilizado é o mesmo do frontend, não uma segunda implementação de login.

Evidências: `dist/portal-integration/*evidence.log`, `test-results.json`, `source-integrity.json`, `g4-desktop.png` e `g4-mobile.png`.
