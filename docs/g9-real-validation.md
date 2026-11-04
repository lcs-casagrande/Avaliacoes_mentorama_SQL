# G9 — Checklist de homologação controlada no Supabase

**Todos os exercícios reais abaixo estão pendentes.** Esta execução só usou PostgreSQL descartável, Auth simulado e Chromium local. O projeto HML deve ser separado da produção. Este roteiro não autoriza criar projeto/contas, enviar e-mails, mudar configurações ou gravar no Supabase.

## Preparação administrativa

- [ ] Autorizar projeto Supabase HML e hospedagem em origem HTTPS própria. Confirmar referências dos projetos e impedir endpoint/chaves de produção no pacote HML.
- [ ] Inventariar produção somente com `database/check_g9_baseline.sql`; guardar JSON protegido; comparar offline conforme relatório G9. Não copiar usuários, contatos ou cultos reais para o HML.
- [ ] Em HML vazio: 001→004, depois 005→019, um arquivo por vez. Bootstrap administrativo seguro conforme `access-control.md`; conferir UUID/igreja. Não repetir bootstrap sobre produção.
- [ ] Guardar hashes/resultado de cada migração e executar checks finais 011–019. Confirmar owners, SECDEF/search_path, schema privado, grants diretos, executor sem LOGIN/SUPERUSER/BYPASSRLS, RLS e FKs/índices válidos.
- [ ] Criar contas **descartáveis, distintas e expressamente autorizadas**: admin IASD_PI; ministerial Sonoplastia; Música; Ancionato; multi-departamento; somente visualização; autenticado sem ACL; Cronoanálise. Não transformar o nome de um responsável em conta nem compartilhar uma senha por ministério.
- [ ] Vincular apelidos individuais/autorizados às identidades e conceder capacidades por departamento. Preservar uma única igreja ativa IASD_PI; não criar igrejas fictícias. Isolamento com duas igrejas foi exercitado somente no banco descartável; um exercício equivalente hospedado exigiria autorização específica.
- [ ] Cadastrar pessoas/eventos fictícios claramente identificados para os testes de gravação; pessoas não precisam de conta Auth. Preservar as fontes históricas locais; não usar cultos reais nos exercícios.

## Auth e Edge: configuração efetiva, não apenas código

| Configuração | Validação manual no HML |
| --- | --- |
| Site URL | HTTPS do frontend HML, com caminho `/portal/` e barra final; conferir endereço efetivamente publicado |
| Redirect URLs | Allowlist exata para HML/base e retorno `#reset-password`; confirmar URL realmente enviada pelo SDK, sem wildcard amplo ou retorno a produção |
| SMTP/remetente | Entrega a conta descartável autorizada, domínio/remetente válidos, quotas, erros e logs sem credenciais |
| Template de recuperação | Link oficial do Supabase adequado ao fluxo configurado; sem resolver alias publicamente ou incluir senhas; testar uso único, expiração e URL final |
| Política de senhas | Conferir painel do provedor; reset administrativo exige mínimo 12 caracteres no código; provar rejeição conforme política real |
| Sessões | Duração JWT, refresh rotation, inatividade/limites se disponíveis, revogação; não inferir configuração pelo SDK |
| SDK | Uma instância; persistSession/autoRefreshToken ativos, flowType PKCE; detectSessionInUrl=false com processamento explícito do callback. Provar ciclo completo, sem desativar validações |
| `alias-login` | Segredos **do HML**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` ou legado `SUPABASE_ANON_KEY`, `IASDPI_ALIAS_LOGIN_PEPPER` (mín.32), `IASDPI_ALIAS_LOGIN_ENABLED=true`, `IASDPI_ALIAS_ALLOWED_ORIGINS` |
| `access-assistance` | URL/chaves acima; `IASDPI_GOVERNANCE_PEPPER` (mín.32), `IASDPI_GOVERNANCE_ENABLED=true`, `IASDPI_GOVERNANCE_ORIGINS`. Não trocar pepper com links pendentes sem plano de invalidação |
| Origens/IP | Origem HTTPS exata, sem caminho; só configurar `IASDPI_ALIAS_TRUSTED_IP_HEADER`/`IASDPI_GOVERNANCE_TRUSTED_IP_HEADER` se o gateway substituir esse header, impedindo falsificação |
| Gateway | `verify_jwt=false` somente nesses endpoints pré-auth; testar a chave pública real no gateway e a validação interna de JWT/escopo nas ações privadas |

Guardar segredos apenas no gerenciador do Supabase, nunca no chat, repositório, HTML ou config pública. Não colar HAR completo, JWTs, senhas ou e-mails pessoais como evidência. Configuração real do template/PKCE depende de teste de entrega e retorno; não aprovar por inspeção visual do painel.

## Matriz para execução real

Registrar para cada linha: data, ambiente, versão/hash, perfil, IDs fictícios, esperado, observado, evidência sanitizada e aprovado/reprovado. **Todas as linhas começam pendentes**; testes locais não as convertem em aprovação real.

| ID | Cenário/perfil | Resultado exigido |
| --- | --- | --- |
| H01 | Login por e-mail e apelido, senha válida/inválida | Mesma identidade e capacidades; erro genérico; sem exposição de e-mail interno |
| H02 | Dois apelidos na mesma conta; apelido suspenso/revogado | Nenhuma ampliação de privilégios; apelido revogado não autentica |
| H03 | Identificador inexistente, igreja inválida, tentativas repetidas | Sem enumeração; limites aplicados; nenhuma resolução pública para e-mail |
| H04 | Refresh, expiração, logout, reautenticação | Sessão consistente; rascunho próprio recuperável; sem leitura do rascunho de outro usuário |
| H05 | Recuperação por e-mail com conta descartável | PKCE completo no navegador de origem; senha nova; link expirado/reutilizado/inválido e redirect externo rejeitados |
| H06 | Recuperação administrativa sem e-mail pessoal | Fila/identidade verificada por operador autorizado; link controlado; sessões anteriores invalidadas quando aplicável; sem senha existente enviada |
| H07 | Visitante anônimo, chamadas REST/RPC diretas | Início/Agenda/Organograma/publicado acessíveis; catálogo privado, contatos, rascunhos e gravações negados |
| H08 | Autenticado sem ACL e somente visualização | Nenhuma escrita; sem departamentos não autorizados; chamada direta não contorna interface |
| H09 | Gestores Sonoplastia/Música/Ancionato | Consultar/editar/publicar apenas segundo capacidades de seu departamento; liderança cadastral não concede login/admin |
| H10 | Multi-departamento | Alternar sem novo login; um único ID de pessoa, funções/disponibilidade/limites independentes por vínculo |
| H11 | Admin IASD_PI e contexto de igreja inválido/não autorizado | Operar só IASD_PI autorizada; não ampliar acesso trocando header/alias; último admin protegido |
| H12 | Cadastro Geral | Criar/editar pessoa fictícia e três vínculos; editar um preserva outros; contatos restritos; aliases sem duplicação automática |
| H13 | Rodízio | Sugerir só ativo/habilitado/disponível; desconhecido fica pendente; consultar compromissos de todos os departamentos; nenhum auto-publicar |
| H14 | Gravação compartilhada, dois navegadores/contas HML | A salva, B lê mesmo ID; B com versão antiga é rejeitado; falha de conexão mantém edição; retry idempotente não duplica |
| H15 | Publicação concorrente entre departamentos | Uma pessoa no mesmo dia incompatível: somente uma publicação confirma; exceção exige admin/justificativa/auditoria |
| H16 | Publicação e revisão de rascunho | Visitante vê última publicação, nunca a revisão não publicada, nem notas privadas; histórico/autor/versão preservados |
| H17 | Ancião da Semana/Mês | Salvar/publicar separadamente; semana domingo–sábado; mês não reserva dias de outros departamentos; CAS/histórico corretos |
| H18 | Dias por departamento | Somente permissão administrativa adequada altera; leitura em outro dispositivo; mudar dias não apaga escalas existentes |
| H19 | Conciliação de nomes | Prévia/cancelamento não gravam; confirmação por grupo autorizada; token antigo falha; IDs, versões e histórico preservados |
| H20 | Revogar/suspender acesso em outra sessão | Requisição nova perde acesso mesmo com tela aberta; sessão antiga não permite salvar/publicar |
| H21 | Cronoanálise e portal | Login/proteções existentes preservados; criar/editar/finalizar culto fictício; Resumo/Histórico/backup/Lixeira funcionam sem cultos reais |
| H22 | Histórico das fontes | Sonoplastia15, Comunicação5 e Ancionato com IDs/datas/grafias de origem preservados; associação central explícita, não importação automática |
| H23 | Navegadores e celular | Voltar/Avançar, teclado/foco, 360/390/768/1024/1440; testar aparelhos reais disponíveis e registrar os não testados |
| H24 | Backup/recuperação HML | Restaurar em destino separado; conferir dados, owners, ACL/RLS, funções e configuração externa; retestar H07/H14/H16 |

Testes SQL com `SET LOCAL ROLE`/claims e rollback em PostgreSQL descartável comprovam regras do banco, não autenticam pelo serviço. Em HML, combinar chamadas via SDK/REST com **JWT real de cada conta** e testes administrativos somente leitura. Para concorrência, utilizar duas conexões independentes; uma única transação com duas chamadas sequenciais não comprova proteção de corrida.

## Liberação

- [ ] Baseline identificado, cadeia aplicada apenas no HML e zero irregularidades nos checks finais.
- [ ] Regressão local sem falhas impeditivas e falhas antigas/retries documentados por ID.
- [ ] H01–H22/H24 aprovados com evidências; H23 explicita aparelhos efetivamente usados.
- [ ] Sem segredos no pacote; URL/key somente HML; origem/namespace próprios; sem chamadas a produção.
- [ ] Backup e rollback testados, alterações posteriores ao backup contempladas.
- [ ] Usuário revisou resultados e autorizou a próxima etapa. Produção, publicação e operações Git continuam bloqueadas até autorização específica.

Ao encontrar falha: interromper gravações de teste afetadas, preservar evidência sanitizada e corrigir sob revisão. Não conceder privilégios amplos nem desativar RLS para obter teste verde.
