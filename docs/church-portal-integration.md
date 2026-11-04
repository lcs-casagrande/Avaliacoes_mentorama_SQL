# Portal IASDPI: ligação entre as páginas

## Implementado nesta revisão

Prévia pública opcional, na branch `feat/schedule-management-b1`, reunindo Início, Escalas, Organograma e Agenda. A navegação reutiliza o histórico e a proteção de alterações pendentes das escalas. Cadastros, membros e configurações continuam dentro de Escalas. O Organograma usa `frontend/organization.js`, com seus 26 ministérios e departamentos anteriores preservados. A Agenda usa as funções originais de `frontend/agenda.js` e uma cópia dos campos públicos de `frontend/agenda-data.js`.

Cronoanálise é uma entrada para `https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/#home`, em outra aba, identificada como acesso com login. Não foi incorporado outro cliente Supabase nem copiados registros privados. A autenticação e o banco desse módulo continuam independentes e protegidos como antes. Esta entrega liga a navegação; não unifica a persistência operacional das duas instalações.

Na prévia, consulta e montagem de escalas não pedem login. Gravar/publicar continua sendo simulação em memória da aba; recarregar reinicia essas alterações. Essa limitação fica acessível no botão `?`, sem alegar gravação compartilhada. O CSP mantém `connect-src 'none'`, os adaptadores bloqueiam rede e não há chave Supabase no pacote. O endereço oficial é permitido somente como link de navegação explícito, sem consulta automática. Dados de cultos, contatos e credenciais não são incluídos.

A versão anterior da prévia e os modos isolados de demonstração continuam disponíveis. Nada foi publicado, enviado ao Git ou executado no banco.

## Arquivos desta revisão

- `frontend/church-portal.js`: composição do portal, navegação interna e interações da Agenda.
- `frontend/styles.css`: estilos do portal e adaptação do seletor de mês na Agenda.
- `scripts/build_schedule_demo.py`: opção isolada de portal, componentes públicos, manifesto e allowlist do link oficial.
- `scripts/export_preview.py`: opção `--church-portal`.
- `tests/fixtures/schedule-b1-demo-navigation.js`: identificação da área ativa no cabeçalho do portal; comportamento anterior mantido nos demais modos.
- `tests/test_church_portal.py`: navegação, fontes, preservação das edições, isolamento e responsividade.
- Este relatório.

## Plano solicitado: gravação compartilhada (não ativada)

A montagem atual usa adaptadores locais. Os arquivos SQL 005–010 são propostas versionadas; sua existência não comprova instalação no Supabase. Os períodos de ancião por semana/mês ainda usam RPCs simuladas. Não é seguro apenas trocar o adaptador e anunciar persistência real.

1. **Inventariar o banco somente por leitura.** Confirmar migrações instaladas, assinaturas das RPCs, proprietários, RLS, ACLs e compatibilidade com a interface atual. Confirmar também como representar os períodos semanais/mensais dos anciãos e equipes com múltiplas pessoas. Revisar as migrações antes de pedir autorização de execução.
2. **Reutilizar o modelo existente.** Pessoas, vínculos e funções da 005; eventos, planos, requisitos, atribuições e versões da 006; configuração por dia, rodízio e conflitos das 007–010. Não criar outra base de pessoas ou substituir `culto_archives`. Os períodos de ancião precisam de integração operacional compatível, ainda a propor.
3. **Separar consulta pública de gravação.** Organograma e agenda continuam públicos. Para consultar escalas publicadas sem login, preparar projeção/RPC somente leitura com data, departamento, função e nome público; excluir rascunhos, contatos, indisponibilidades, IDs Auth e auditoria. Não conceder SELECT anônimo nas tabelas privadas nem acesso a helpers SECURITY DEFINER.
4. **Definir identidade de quem grava.** As RPCs atuais exigem sessão e autorização. Admin global pode administrar; gestor ministerial exige concessão explícita por departamento; ser responsável no Organograma não concede acesso. A proposta para produção é manter consultas abertas e pedir identificação somente ao salvar/publicar/administrar quando não houver sessão válida, reaproveitando Supabase Auth. Isso seria uma ampliação do pedido de login apenas na Cronoanálise e precisa ser acordado antes da ativação; nesta entrega não foi aplicado. Gravação pública anônima permitiria adulterações sem autoria confiável.
5. **Persistir com confirmação do servidor.** Manter UUIDs, versão esperada e request_id; confirmar sucesso somente após resposta; preservar o formulário em falhas. Publicação transacional revalida conflitos entre departamentos. Ancião do mês permanece fora da regra de conflito conforme solicitado. Disponibilidade permanece desativada conforme configuração vigente.
6. **Preservar os históricos.** Os 15 registros de Sonoplastia, cinco de Comunicação e períodos da Agenda oficial continuam fontes identificadas. Qualquer importação futura exige prévia e confirmação, sem mesclar apelidos nem duplicar eventos/atribuições. A agenda externa não é sobrescrita.
7. **Homologar antes de ativar.** Banco descartável: admin, gestor de um departamento, visualizador e anônimo; bloqueios entre departamentos; concorrência; reabertura em outro dispositivo; falha de rede; rascunhos não públicos; contato não exposto; publicação e revisão preservando versões. Depois, migrações e publicação somente com autorização específica. Rollback preferencial pelo frontend/feature flag, preservando dados e schema.

## Homologação visual

Gerar novo HTML, sem sobrescrever prévias anteriores:

```sh
python scripts/export_preview.py --church-portal --output dist/church-portal/IASDPI-portal-integrado-final.html
```

1. Abrir Início → Organograma; pesquisar responsável e limpar a pesquisa.
2. Abrir Agenda pelo menu `⋯`; alternar fonte, mês, calendário/lista e departamento.
3. Abrir Escalas → Montar escala; editar e tentar sair sem salvar: cancelar deve preservar os campos.
4. Salvar na aba, visitar Organograma e voltar: o rascunho deve permanecer. Conferir Família/Criança e seleção múltipla em Música.
5. Cronoanálise deve abrir o site oficial em outra aba. A prévia não autentica por conta própria nem consulta o banco. A validação real de login depende de sessão autorizada e não foi executada em produção.
6. Conferir 360, 390, 768, 1024 e 1440 px. Capturas e logs ficam em `dist/church-portal/`.

Commit sugerido (não realizado): `feat: integra navegação pública do portal IASDPI`.

## Resultado desta entrega

- **108 testes aprovados**: 11 novos do portal e 97 de regressão (autenticação simulada, navegação, calendário, anciãos, publicação na aba, limpeza, Família/Criança e equipe de Música). Sem falhas e sem testes ignorados nessas execuções.
- Chromium headless: 360, 390, 768, 1024 e 1440 px, navegação por teclado, Voltar/Avançar, links diretos e proteção de alterações não salvas. Não equivale a teste em aparelhos físicos, Safari ou Firefox.
- O HTML final independente foi aberto no navegador local: Início, Organograma, Agenda, Montar escala e Calendário, sem erros de execução nem requisições à produção.
- Logs: `dist/church-portal/tests-portal-final.log` e `dist/church-portal/tests-regression.log`. Verificação do artefato e SHA-256: `dist/church-portal/preview-check.json`. Capturas desktop/mobile no mesmo diretório.
- Login real e RLS remotos não foram exercitados. Nenhuma migração foi executada. Nenhum commit, push ou deploy foi realizado; o repositório de publicação permaneceu intacto em `d8b69f4ca0993e9f40c1268c45c016dcb33b2ecc`.
