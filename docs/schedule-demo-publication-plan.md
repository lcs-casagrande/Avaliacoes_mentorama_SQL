# Prévia HTTPS isolada — plano aguardando autorização

Branch de desenvolvimento: feat/schedule-foundation-phase-a. Não houve commit, push, migração ou publicação nesta preparação.

## Verificação de hospedagem

API GitHub consultada em 26/10/2026: lcs-casagrande/IASDPI-homologacao existe, é público e está vazio. has_pages=false; GET /pages retornou 404. Portanto não há prévia ativa pronta para reutilização. O Pages oficial segue no repositório Avaliacoes_mentorama_SQL, branch gh-pages, raiz. Não será modificado.

## Pacote concreto

Gerado por scripts/build_schedule_demo.py em dist/schedule-demo/site. Cinco arquivos: index.html, styles.css, demo.js, manifest.json e .nojekyll. Nenhum SQL, banco, configuração de produção, chave pública/privada ou biblioteca de autenticação é incluído.

Reutiliza os estilos e o componente frontend/schedule-foundation.js. A cópia de demonstração remove referências reais de liderança e a consulta às fontes legadas. O host fictício fornece pessoas Alfa/Beta/Gama, quatro departamentos de exemplo, funções, vínculos, habilitações e disponibilidade. Não exige login; o perfil administrativo é simulado. Alterações em memória na aba, descartadas ao recarregar. Não é teste de persistência/RLS.

CSP connect-src none e form-action none; fetch, XHR, WebSocket, EventSource e sendBeacon bloqueados. Sem carregamento de agenda, organograma ou dados do Supabase. Cada asset JS/CSS tem SRI. O banner visível informa DEMONSTRAÇÃO — DADOS FICTÍCIOS e pede que não sejam inseridas informações reais.

## Publicação proposta, somente após aprovação

1. Reconfirmar que o repositório de homologação continua vazio; havendo novos arquivos, interromper para revisar, sem sobrescrever trabalho.
2. Criar o primeiro commit **apenas dos cinco arquivos estáticos** na main do repositório separado IASDPI-homologacao e enviar para esse destino. Nenhum commit/merge na main do projeto oficial.
3. Ativar GitHub Pages nesse repositório, branch main, raiz, HTTPS.
4. Aguardar o build, verificar HTTPS, manifesto/SRI, banner e navegação dos cadastros em desktop e celular emulado. Só então entregar o endereço confirmado. Caso o ambiente bloqueie o domínio, solicitar a liberação suportada antes de afirmar que o endereço foi validado.
5. Reverter eventual falha somente no repositório de homologação ou desativar seu Pages; não tocar no site oficial.

## Evidências locais

6 testes novos aprovados em 5,873 s: construção, rejeição de sobrescrita, ausência de dados/configurações reais, navegação por todos os cadastros, gravação fictícia/habilitações, reinicialização da memória e bloqueio de rede/armazenamento. Formulários verificados em Chromium nas larguras 360, 390, 768, 1024 e 1440. Android/iPhone físicos e Safari não foram testados.

Os 455 testes anteriores não foram reexecutados nesta preparação. SHA-256 de todos os arquivos registrados no inventário da entrega anterior permanece igual; os seis novos testes exercitam exclusivamente o pacote isolado. Migração 005 não executada. Não houve chamadas ao Supabase.
