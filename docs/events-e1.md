# E1 — Eventos e Calendário Unificado

Data: 04/11/2026, America/Sao_Paulo. Branch: `feat/schedule-management-b1`.

## Escopo e arquitetura

O calendário combina escalas e eventos nos modos Tudo, Escalas e Eventos. O painel Filtros contém seleção múltipla de departamentos; em Escalas, também pessoas com pesquisa interna; em Eventos, categorias. Seleções no mesmo filtro usam OU; filtros distintos usam E. Sem seleção, todas as opções são consideradas. Trocar de modo limpa seleções que deixam de ser aplicáveis; navegar entre meses as preserva. Um dia pode conter várias escalas e eventos; detalhes, local, descrição e categoria ficam na seleção da data. A lista de pessoas usa somente nomes já autorizados nas fontes públicas, sem consultar cadastros pessoais privados. A opção provisória Evento Local foi substituída pelo novo pedido de classificação, cuja análise de impacto está em [event-classification-impact.md](event-classification-impact.md). A migração 020 e os registros existentes continuam preservados. A implementação local e a migração 021 estão descritas em [calendar-privacy-activation.md](calendar-privacy-activation.md), sem ativação no Supabase real.

A Gestão de Eventos reutiliza a igreja selecionada, Auth, capacidades ministeriais, navegação, componentes e chamadas RPC existentes. Permite criar, editar, salvar rascunho, publicar, cancelar e consultar versões. Não vincula eventos automaticamente a escalas nem muda programações de cultos. Cronoanálise e seus horários foram preservados.

`schedule_events` já representa eventos técnicos referenciados por atribuições, validações e conflitos. Não contém ciclo editorial. A migração **020** acrescenta somente `iasdpi_events` e `iasdpi_event_versions`, relacionadas às igrejas/departamentos existentes. Não recria pessoas, usuários ou escalas. A separação permite preservar as referências técnicas e publicar uma fotografia revisada enquanto a próxima revisão permanece em rascunho.

## Fontes e integridade

- Fonte consultada por HTTPS: https://iasd-paradainglesa.netlify.app/ . Metadados de conferência: `data/e1-source-review.json`.
- A leitura atual retornou 209 registros no intervalo já coberto pelo snapshot. O conteúdo corresponde ao arquivo existente; 21 IDs gerados pela fonte diferiram apesar de os dados serem idênticos. Os IDs locais foram preservados. `frontend/agenda-data.js` não foi substituído.
- O sincronizador agora reaproveita IDs por correspondência exata de título, datas, horários, natureza, pessoa, departamento, local e dia inteiro. Correspondência ambígua ou colisão interrompe a atualização. Não concilia títulos parecidos automaticamente.
- Existem 17 eventos da fonte em outubro/2026. A fonte apresenta **174 Anos da Escola Sabatina** e **175 Anos da Escola Sabatina** em 10/10. Ambos foram preservados; a interface pede conferência. Não foi escolhido um número por suposição.
- A imagem original de outubro não estava disponível como arquivo neste ambiente. Não houve nova extração independente da imagem. As transcrições autorizadas de **15 escalas de Sonoplastia e cinco de Comunicação** permanecem preservadas, assim como os períodos do Ancionato e os nomes oficiais confirmados.
- Categorias/departamentos desconhecidos ficam pendentes. Eventos da fonte com categoria pendente aparecem quando ambas as categorias de eventos estão ativas, com identificação de pendência. O cadastro exige confirmação antes da publicação gerenciada.
- A Agenda oficial permanece uma fonte própria. Não se executa importação automática para o banco. A prévia administrativa mostra cada registro e possíveis correspondências; só um administrador pode associar uma fonte oficial. A associação é imutável, identificada por igreja e ID de origem, e previne duplicação.
- Datas são civis ISO; apresentação brasileira. Conversões de timestamps da fonte usam America/Sao_Paulo, com horário de 24 horas. Ausência de horário não vira meia-noite. Dia inteiro é informação explícita, preservada quando presente na fonte.

## Segurança e persistência preparadas

| Operação | Autorização no PostgreSQL |
| --- | --- |
| Calendário publicado | Consulta pública somente na igreja ativa/listada selecionada |
| Catálogo/histórico privados | Identidade autorizada na igreja e departamento consultado |
| Criar/editar evento da igreja | Administrador autorizado da igreja |
| Criar/editar evento departamental | Administrador ou capacidade `edit` no departamento |
| Publicar/cancelar evento departamental | Administrador ou capacidade `publish` no departamento |
| Associar item da fonte oficial | Administrador; fonte restrita à IASD_PI |
| Escrita direta nas tabelas | Não concedida a anon, authenticated ou service_role |

As quatro RPCs novas são `iasdpi_events_catalog`, `iasdpi_event_save`, `iasdpi_event_history` e `iasdpi_events_published`. Apenas a última é executável por anônimos. Funções SECURITY DEFINER pertencem ao executor limitado existente, têm search_path vazio e não concedem execução de helpers privados. As duas tabelas têm RLS habilitada e forçada, com barreira por igreja.

Gravações usam ID estável, versão esperada, trava transacional já existente e recibo idempotente por identidade/igreja/pedido. Alterações parciais preservam campos não enviados, inclusive segundos/frações de horários antigos. Conflito de versão mantém o formulário e exige recarregar/comparar; não há sobrescrita automática. Campos ficam bloqueados enquanto se aguarda confirmação. Falhas de conexão preservam a edição para nova tentativa; confirmação só após a resposta RPC.

Cada alteração cria versão imutável, com autor/data/status. A consulta pública usa a última versão publicada ou cancelada, ignorando revisões privadas. Cancelar mantém histórico e impede que a cópia original da fonte reapareça. Não existe exclusão definitiva nesta entrega.

O flag `eventsEnabled` fica desativado por ausência na configuração operacional. A migração não é instalada nem ativada por publicação estática.

## Homologação estática e credenciais

Endereço: https://lcs-casagrande.github.io/IASDPI-homologacao/integrada/ . A versão anterior é preservada em `/integrada-g84/`; `/b12/` e o calendário histórico continuam disponíveis.

O pacote E1 identifica discretamente **IASDPI · Homologação**, acesso simulado e alterações temporárias. Usa adaptadores em memória, CSP `connect-src 'none'`, sem dependências externas nem conexão com o Supabase real. Alterações reiniciam ao recarregar; isso não representa persistência PostgreSQL ou autenticação real homologada.

Contas do simulador: `admin.iasdpi`, `som.iasdpi`, `musica.iasdpi`, `anciao.iasdpi`, `multi.iasdpi`, `leitura.iasdpi`. O roteiro contém também editor e Cronoanálise simulados. Senha pública exclusivamente fictícia: `Demonstracao#2026`. Nunca reutilizá-la em contas reais. A mudança dos identificadores ocorre apenas na exportação E1, preservando IDs/capacidades das identidades simuladas e compatibilidade das prévias antigas. Não cria aliases ou contas no Supabase.

## Migração e reversão — não executadas no Supabase

1. Inventariar o projeto de homologação separado e conferir a cadeia 001–019, conforme G9. Não presumir que a produção já tenha 005–019.
2. Revisar backup, restauração, Auth/gateway/permissões reais e pendências G9. Nenhuma configuração é alterada automaticamente.
3. Após autorização própria, executar `database/020_calendar_events.sql` em uma transação, como postgres, **depois de 019**. O arquivo rejeita reinstalação e não importa dados existentes.
4. Executar `database/check_calendar_events.sql`, somente leitura, como postgres. Resultado esperado: nenhuma irregularidade.
5. Homologar Auth/RLS reais com contas e eventos descartáveis no projeto separado. Conferir publicações, versões, revogação, igreja e concorrência.
6. Só então ativar `eventsEnabled: true`, mantendo G1–G4 necessários, e revisar a ativação real. Esta entrega publica somente o simulador.

`020_calendar_events_down.sql` é reversão apenas de instalação vazia. Recusa reverter quando existem eventos ou versões; não usa CASCADE nem apaga dados de outras fases. Com dados, desativar o flag e usar backup/restauração homologados; não executar DROP de eventos para contornar a proteção.

## Testes e reprodução

Testes E1: `test_events_sql.py`, `test_events_browser.py`, `test_events_sources.py`. Cobrem instalação 001–020, RLS, limites ministeriais/igreja, publicação privada/pública, cancelamento, histórico, concorrência real PostgreSQL, idempotência, precisão temporal, dia inteiro, rollback, deduplicação de fontes, filtros, aliases simulados, edição/erros, XSS e navegação. Chromium é usado em 360, 390, 768, 1024 e 1440 px. Isso não comprova Safari/Firefox ou aparelhos físicos.

As execuções usam cópias isoladas do código e PostgreSQL descartável com rede desativada, sem registros ou credenciais de produção. Evidências locais em `dist/events-e1/`; não são publicadas com o site. O consolidado final é gerado em `dist/events-e1/validation-summary.json`, sem somar reexecuções do mesmo caso.

Resultado: **275 casos distintos aprovados**, sem falhas, erros ou casos pulados: 253 Python (incluindo 14 PostgreSQL E1, 13 Chromium E1 e seis fontes/pacote E1) e 22 Node. Os 20 testes de rascunhos do Lote 1 estão incluídos. Os 13 testes Chromium E1 foram repetidos no HTML exato preparado para homologação e não foram somados novamente. Uma correção visual posterior restrita aos botões E1 foi coberta nessa repetição. A suíte completa G9 anterior (1.145) não foi repetida integralmente nem somada a esse total. Resumo versionado: `docs/events-e1-validation.json`.

```sh
python scripts/run_g9_regression.py --container CONTAINER_SEM_REDE --output dist/events-e1/revalidacao --modules test_events_sql test_events_browser test_events_sources
python scripts/prepare_integrated_review.py --events --historical-site /CAMINHO/IASDPI-homologacao --output dist/events-e1/site-novo
```

## Roteiro do revisor

1. Sem login, abrir Calendário, outubro/2026, alternar Tudo/Escalas/Eventos, combinar seleções no painel Filtros e selecionar 10/10; conferir escalas, anciãos e eventos sem duplicar o original.
2. Abrir Montar escala para selecionar IASD_PI e entrar com `admin.iasdpi`; acessar Gestão de Eventos.
3. Conferir eventos da Agenda, selecionar outubro, revisar uma fonte. Salvar rascunho; confirmar que ainda não foi publicado como novo evento.
4. Confirmar categoria/departamento e publicar. Voltar ao Calendário: a fonte vinculada deve ser substituída pela publicação, mantendo uma entrada.
5. Editar e salvar rascunho; o Calendário conserva a publicação anterior. Publicar revisão e consultar Histórico. Cancelar e conferir desaparecimento público sem perda de histórico.
6. Criar dois eventos distintos no mesmo dia, com/sem horários. Conferir que nenhuma escala foi criada automaticamente.
7. Entrar com `som.iasdpi`: criar somente para Sonoplastia; não gerir evento da igreja ou de outro departamento. `leitura.iasdpi` não grava. `multi.iasdpi` alterna Sonoplastia/Música sem novo login.
8. Recarregar: alterações do simulador desaparecem e fontes históricas continuam. A identificação do ambiente informa essa limitação.

## Pendências e riscos

- Auth, RLS e gravação no Supabase real continuam **não homologados** nesta entrega. Nenhum SQL, conta, Edge Function ou configuração real foi alterado.
- A categoria, o local e o departamento de parte dos eventos precisam de confirmação; aniversários conflitantes da fonte também. Importação nunca é automática.
- A nova leitura de imagem depende do fornecimento da imagem original; nenhuma informação foi reconstruída por suposição.
- A fonte externa pode mudar. Conciliação exata preserva IDs de conteúdo equivalente; correções efetivas exigem revisão administrativa, sem inferência automática.
- Ressalvas G6/G9 anteriores e desempenho em grandes históricos não foram declarados resolvidos por E1.
- O acesso HTTPS publicado deve ser confirmado conforme disponibilidade de rede do ambiente; status de build do GitHub Pages e teste local não substituem uma navegação HTTPS efetiva.

## Publicação e rollback

Commit/push exclusivamente da branch de desenvolvimento no repositório original; nenhum merge em main/gh-pages. No repositório IASDPI-homologacao, somente HTML, roteiro e manifestos da demonstração; sem SQL, bancos ou backend. O gerador preserva byte a byte os arquivos anteriores fora de `/integrada/`, e arquiva a integrada G8.4.

Antes da atualização, a homologação está no commit `22c2aa41918e30e417ba6e606adadc056220b5c8`. Reverter somente o novo commit estático, sem reset/push forçado, restaura a demonstração anterior. Esse rollback não opera no Supabase. Os SHAs finais são entregues com o resultado da publicação.
