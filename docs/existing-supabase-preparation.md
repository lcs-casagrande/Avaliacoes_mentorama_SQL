# IASDPI — integração preparada sem ativação remota

Branch: `feat/schedule-management-b1`. O adiamento do backup libera o desenvolvimento e os testes locais; **não libera implantação, configuração ou gravação no IASD_Parada**.

Atualização G11: o perfil fechado também prepara `governanceAdministrationEnabled`; a ativação real passa a exigir a migração 027 após 026. Os resultados de 118 testes abaixo pertencem à preparação anterior; os resultados atuais e a matriz estão em [governance-g11.md](governance-g11.md).

## Entrega técnica

Foi reutilizado `scripts/build_homologation.py`, com a opção `--prepare-existing`. Ela prepara a referência pública do IASD_Parada e as flags dos módulos até a 026, mas força:

- `remoteDisabled=true` e `remoteReadOnly=true`: nenhuma chamada remota, inclusive login, refresh, recuperação ou publicação.
- CSP `connect-src 'none'`: também bloqueia fetch/XHR/conexões que tentem contornar os clientes da aplicação.
- Namespace `iasdpi-existing-preparation-v1`, separado das sessões e registros da Cronoanálise e da homologação.
- Pacote limpo, sem reaproveitar bundles anteriores, fixtures ou código servidor. Sem chave administrativa/segredos.

O modo não pode ser combinado com `--real-homologation`, modo operacional ou retenção de recursos anteriores. A validação do pacote confere config, manifesto e CSP. O gerador de homologação conectada continua recusando os projetos conhecidos de produção; a proteção não foi removida.

Gerar localmente em uma pasta nova:

```sh
python scripts/build_homologation.py --prepare-existing \
  --output dist/supabase-existing-preparation/final/site \
  --site-url https://preparacao.iasdpi.invalid/portal/
```

O domínio `.invalid` é somente identificação do pacote, não uma URL publicada. Servir os arquivos localmente, se necessário:

```sh
python -m http.server 8080 --bind 127.0.0.1 \
  --directory dist/supabase-existing-preparation/final/site
```

Abrir `http://127.0.0.1:8080/`. O pacote mostra que a conexão está desativada; **não permite testar login real ou persistência real**. Não editar as travas para ativá-lo. A ativação futura exige pacote específico revisado e autorização, não simples troca de uma flag.

`frontend/config.js`, estilos, HTML de origem e fontes históricas não foram modificados. Os novos guards são condicionais ao modo desativado; o comportamento anterior da Cronoanálise permanece no fluxo normal. Mensagens de preparação aparecem somente no pacote fechado. As alterações anteriores da G10.5 e o roteiro de backup foram preservados.

## Revisão Auth e Edge

| Item | Preparação conferida | Ainda depende do provedor |
| --- | --- | --- |
| Auth existente | Mesmo SDK/identidade; login por e-mail, PKCE, recuperação e “Manter conectado” preservados | Configuração efetiva de Site URL, redirects, senha, sessões, SMTP e entrega de recuperação |
| Apelido | `alias-login` resolve privadamente; aliases não concedem permissões, nem revelam e-mail interno | Migrações, implantação Edge, flags, peppers e origem HTTPS autorizados |
| Senha própria/primeiro acesso | G10.3 bloqueia dados até troca confirmada; não marca contas antigas automaticamente | GoTrue real, logout global, refresh/sessões e confirmação em caso de falha parcial |
| Recuperação administrativa | Fila existente, verificação de identidade, link controlado; somente administrador emite | Implantação da `access-assistance`, canal privado e exercício supervisionado autorizado |
| Ministerial | Responsabilidade confirmada + vínculo central + permissão por igreja/departamento; um usuário pode ter vários ministérios | Confirmar e conceder os vínculos reais, sem criar contas por participação ou nome |
| Edge/gateway | `supabase/config.toml` mantém `verify_jwt=false` apenas nos dois endpoints pré-auth; ações privadas validam JWT/escopo internamente | Provar comportamento do gateway com chaves/JWTs reais, sem desabilitar validações globalmente |

Template de configuração servidor: [existing-supabase-edge.env.example](existing-supabase-edge.env.example). Ele contém valores secretos vazios e flags desativadas; não foi carregado em nenhum ambiente. CORS exige origem HTTPS exata, sem caminho. Não usar domínio `.invalid`, localhost ou wildcard como origem de ativação real. Não trocar peppers/chaves existentes para contornar erros; revisar links pendentes antes de qualquer rotação.

As configurações hospedadas **não foram consultadas nem alteradas** nesta preparação. Testes com Auth simulado/claims PostgreSQL não provam configuração do GoTrue/SMTP/gateway. Nenhuma conta, senha provisória ou credencial real foi criada.

## Validação local

Resultados e limites: [existing-supabase-preparation-validation.json](existing-supabase-preparation-validation.json). Logs/capturas em `dist/supabase-existing-preparation/`.

**118 casos selecionados aprovados:** 56 PostgreSQL, 17 navegador, 16 pacote e 29 handlers/credenciais Node. Zero falhas/skips; não é reexecução da suíte histórica completa. A repetição dos testes de pacote após ajustar as mensagens não foi somada.

- Pacote/navegador: travas de rede, SDK/Auth/recuperação, CSP, rejeição de modos inseguros, sessão isolada e navegação desktop/celular.
- PostgreSQL descartável sem rede: cadeia local até 026, Cadastro Geral com pessoa única em três departamentos, rename preservando vínculos, rascunho/publicação, calendário, edição desatualizada, histórico e cancelamento de eventos.
- Governança/escala: líder/ancião/admin, múltiplas permissões, revogação, conflitos, concorrência, aprovação geral, Ancionato semanal/mensal e preservação da Cronoanálise.
- Regressão de Cadastro Geral/rodízio: funções, disponibilidade desconhecida, limites, vínculos independentes e isolamento.
- Handlers Node e navegador: login por apelido, enumeração, JWTs simulados, troca de senha, recuperação, falhas parciais e credenciais sintéticas.

Nenhuma migração nova foi necessária. As migrações 005–026 foram usadas **somente no PostgreSQL descartável**, conforme o objetivo de validação; não foram executadas no Supabase existente. Não foi repetida auditoria remota.

## Checklist de ativação futura — tudo pendente

- [ ] **Backup recuperável:** realizar e ensaiar o [roteiro Free](backup-manual-before-installation.md). Adiado pelo usuário; permanece condição de implantação.
- [ ] Aprovar janela, operador/DCL e procedimento de recuperação da Cronoanálise.
- [ ] Autorizar e instalar 005–026 em grupos/checkpoints do [plano G10.5](governance-g10-5-deployment.md), sem reinstalar 001–004.
- [ ] Conferir Auth no painel: manter contas/UUIDs/provedor e-mail e URLs existentes; revisar inscrições, redirects, PKCE, senha/sessões e SMTP. Alterações exigem autorização.
- [ ] Autorizar origem e artefato frontend realmente conectado, sem fixtures, com namespace/retornos e CSP adequados. Não publicar este pacote desativado como sistema funcional conectado.
- [ ] Implantar `alias-login` e `access-assistance` nas versões revisadas; configurar somente os segredos necessários no servidor e allowlists exatas. Não incluir service_role no frontend.
- [ ] Autorizar conciliação/importação dos dados necessários e confirmar responsabilidades; reaproveitar pessoas/UUIDs, sem mesclagens ou concessões automáticas.
- [ ] Autorizar individualmente provisionamento/vínculo de contas e aliases, permissões ministeriais e credenciais provisórias únicas. Só marcar troca obrigatória após Edge/frontend seguros disponíveis.
- [ ] Homologar com JWT/GoTrue reais: login por e-mail/apelido, troca/recuperação, revogação, múltiplos ministérios, rascunhos privados, publicação, conflitos e Ancionato independente.
- [ ] Validar Cronoanálise, calendário/Organograma públicos, restrição das demais escalas, eventos Restritos e auditoria exclusiva do administrador antes de liberar módulos.

**Nenhuma mudança de Supabase, deploy, publicação, commit, push ou merge foi feita nesta etapa.** Os testes locais e o adiamento do backup não constituem autorização para ativação real.
