# IASDPI — G12: homologação funcional

Base: desenvolvimento `2a50af5`, homologação `8968a02`, branch `feat/schedule-management-b1`. Escopo: verificar jornadas existentes e corrigir defeitos demonstrados. Nenhuma migração nova ou alteração em 001–027, Auth, Edge ou banco hospedado.

## Cenários

| Jornada solicitada | Resultado | Evidência principal |
| --- | --- | --- |
| 1. Administrador cadastra pessoa, vincula ministérios e concede conta individual | Aprovada na simulação e no PostgreSQL local | G12 UI 01; SQL onboarding: mesmo ID, dois ministérios, credencial provisória, troca obrigatória e ACL explícita |
| 2. Líder consulta só seu ministério e publica escala | Aprovada | UI 02; SQL onboarding e regressão G10.3 após 027 |
| 3. Líder publica evento departamental diretamente | Aprovada | UI 03: chega ao calendário e à auditoria; SQL G10.3 |
| 4. Líder envia evento geral para aprovação | Aprovada, inclusive recorrência | UI 04/12: permanece rascunho pendente; SQL G10.3 |
| 5. Ancião autorizado aprova ou rejeita | Aprovada | UI 04/05, G11 UI, SQL decisões/revogação |
| 6. Identidade alterna entre ministérios | Aprovada sem novo login | UI 01/06/13; SQL mantém identidade única e vínculos independentes |
| 7. Administrador suspende acesso | Aprovada para conta inteira e para um ministério | UI 07/08/13: formulário, token anterior recusado, login negado, outro ministério preservado; SQL onboarding/revogação |
| 8. Administrador consulta ações na auditoria | Aprovada | UI 03/05/09/13/15; SQL histórico exclusivo do administrador |
| 9. Calendário publicado | Aprovada conforme privacidade vigente | UI 03/04/14/17: eventos abertos e Ancionato públicos; rascunhos/restritos ocultos e demais escalas sob login |
| 10. Cronoanálise preservada | Aprovada nos testes locais | UI 06/10, nove testes específicos de frontend/Auth e fingerprints SQL do núcleo |

Navegação entre módulos, formulários, erros, estados vazios e larguras 360, 390, 768, 1024 e 1440 px verificados. Ancião da Semana e do Mês foram publicados separadamente e consultados sem login, mantendo os dois planejamentos.

## Defeitos encontrados e corrigidos

| Gravidade / alcance | Defeito | Correção |
| --- | --- | --- |
| Alta, somente simulador | Suspensão de conta chamava um handler legado que não concluía a nova operação | Handler local aplica estado, preserva último administrador, registra autor e recusa sessão anterior/login |
| Média, somente simulador | Ministério suspenso continuava identificado como ativo | Catálogo usa o estado da ACL e bloqueia novos envios gerais pelo vínculo suspenso/revogado |
| Média, somente simulador | Cadastro e Escalas usam atalho local que não passava pela captura de auditoria; publicação departamental também faltava no painel | Registro após confirmação nos dois caminhos locais, com ID, ator, data e diferenças permitidas; recibos evitam duplicação por retry |
| Alta, somente simulador | Série geral não usava o fluxo de aprovação já implementado no PostgreSQL | Série e ocorrências ficam pendentes; decisões, versões, conflitos de reserva e idempotência preservados |
| Média, somente simulador | Handlers novos não conferiam uniformemente contexto de igreja, validade da sessão e barreira de senha provisória | Conferências alinhadas aos contratos existentes, preservando listagem pública de igrejas e contexto de troca de senha |
| Média, interface compartilhada | Ações retornadas pelo RPC real apareciam como identificadores técnicos, e campos cadastrais alterados eram omitidos | Rótulos em português e exibição dos campos autorizados, sem mostrar payload privado |
| Baixa, interface compartilhada | Pesquisa de usuários sem resultado e auditoria vazia deixavam apenas tabela em branco | Mensagens curtas de estado vazio |

As correções do simulador não são apresentadas como alterações no Supabase. As regras SQL correspondentes já existiam e foram revalidadas após 027 no PostgreSQL descartável. Ajustes iniciais da infraestrutura de testes (classe-base, organizador do evento e cache público mensal) não foram classificados como defeitos do produto.

## Testes e reprodução

**149 casos selecionados aprovados**, sem somar repetições:

| Suíte | Casos | Log em `dist/governance-g12/` |
| --- | ---: | --- |
| PostgreSQL G11 + regressão G10.3 após 027 | 37 | `postgres.log` |
| PostgreSQL jornadas G12 + integração após 027 | 4 | `postgres-functional.log` |
| G12 Chromium, pacote estático exato | 17 | `browser-release.log` |
| G11 Chromium, pacote estático exato | 8 | `browser-g11-release.log` |
| Cronoanálise/frontend Auth | 9 | `crono-regression.log` |
| Navegação anterior | 8 | `navigation-regression.log` |
| Pacote fechado / isolamento de conexão real | 11 | `package-isolation.log` |
| Node: Auth, credenciais, contas, datas e eventos | 55 | `node-release.log` |

PostgreSQL 17 em contêiner `--network none`, sem portas e com Auth sintético. Chromium local sem requisições externas. O pacote final foi copiado integralmente para o servidor local dos testes, sem substituir os handlers no teste. As chamadas Auth/Edge são simuladas; isso não valida GoTrue, SMTP ou gateway hospedados. Não foi reexecutada a suíte histórica completa. Capturas e hashes estão no consolidado `governance-g12-validation.json` e no diretório de evidências.

Reprodução: `python -m unittest discover -s tests -p test_g12_functional_browser.py -v`; para usar o HTML final, definir `IASDPI_G12_STATIC_HTML` com o caminho absoluto. Banco: definir `IASDPI_PG_TEST_CONTAINER` com um PostgreSQL descartável **sem rede**, e executar os arquivos `test_g11_administration_sql.py` e `test_g12_functional_sql.py`. Node: `node --test tests/*.test.mjs`.

## Simulação e implantação real

- Homologação estática em `/integrada/` e cópia G12 em `/g12/`; G11 e demonstrações anteriores preservadas. Login fictício `admin.iasdpi` / `Demonstracao#2026`. Alterações só na memória da aba, reiniciadas ao recarregar; não há persistência compartilhada entre dispositivos/abas nem confidencialidade de dados embutidos no HTML público.
- Nova sessão de demonstração isolada em `iasdpi-g12-preview-v1`; nomes, IDs, vínculos e fontes históricas autorizadas reutilizados. Nenhuma pessoa sintética de teste é incluída permanentemente: os testes cadastram e descartam apenas no seu navegador/banco isolado.
- Implementação real continua preparada nas migrações 005–027, RPCs e Edge existentes. A 027 **não foi aplicada ao Supabase**, e nenhuma conta real foi criada. Banco, configurações operacionais, dados históricos, estilos e autorização da Cronoanálise não foram modificados.
- Pendências de implantação: backup recuperável com restauração ensaiada; janela/operador e autorização específica para 005–027; configurar e homologar Auth, domínio institucional, redirects/SMTP, Edge e segredos; confirmar responsabilidades individuais e autorizar contas reais; testar revogação/refresh e gravação compartilhada com dois navegadores conectados no ambiente aprovado.
- Criação Auth e conclusão por RPC continuam sem transação única entre serviços: falha parcial exige conciliação administrativa do UUID e recuperação supervisionada, sem duplicar/excluir contas automaticamente.
- Não houve merge na main, alteração do site oficial, SQL remoto ou ativação da conexão real. Aprovação local não substitui a homologação controlada do provedor. Safari/Firefox e aparelhos físicos permanecem fora desta rodada.

Arquivos funcionais alterados: `frontend/governance.js` e `tests/fixtures/governance-final-preview.js`. Novos testes: `tests/test_g12_functional_browser.py` e `tests/test_g12_functional_sql.py`. Sem funcionalidades ou estruturas de dados paralelas.
