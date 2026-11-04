# Publicação da demonstração integrada — calendário e criação de escalas

Escopo autorizado: branch `feat/schedule-management-b1` no repositório de desenvolvimento e somente arquivos estáticos de `lcs-casagrande/IASDPI-homologacao`. Não houve autorização para SQL, migrações, merge em main oficial, usuários reais ou deploy operacional.

A candidata integra o painel Tudo/Escalas/Eventos, seleção múltipla, filtros rápidos sincronizados, aviso de login, classificação/organizador/público-alvo e checkbox Restrito. Sem login simulado, o calendário demonstra eventos não restritos e Ancionato; os demais departamentos são consultados com as permissões da identidade fictícia.

## Acesso e roteiro

- URL de entrada: https://lcs-casagrande.github.io/IASDPI-homologacao/integrada/#schedule-build . Escolher IASD_PI.
- Identificador fictício: `admin.iasdpi`.
- Senha pública exclusivamente fictícia: `Demonstracao#2026`. Não é senha de uma conta Supabase real; nunca reutilizar em contas reais.
- Escolher Sonoplastia em Meus departamentos e um mês futuro descartável.
- O automático exige participação, habilitação e dias confirmados no Cadastro Geral. Informação pendente não é disponibilidade. Confirmar somente no cenário demonstrativo; isso não altera cadastros reais.
- Salvar rascunho, reabrir, publicar separadamente e conferir o Calendário com login. Sair deve retirar as escalas privadas da consulta simulada.
- As edições reiniciam ao atualizar/reabrir o HTML. Não há persistência compartilhada ou envio ao Supabase nessa demonstração.

## Validação e isolamento

O roteiro de criação é exercitado pelo Chromium: login administrativo, navegação real para Sonoplastia, confirmação de participante na simulação, pré-preenchimento, salvar, reabrir o mesmo rascunho, publicar e consultar o calendário, seguido de logout. O teste não opera no banco real. Outras suítes verificam filtros, dados antigos, permissões simuladas, campos de eventos, pacotes e cinco larguras.

O pacote usa CSP `connect-src 'none'`, sem scripts/recursos externos, URLs de projeto Supabase real ou credenciais privilegiadas. O único identificador publishable é explicitamente fictício. Auth/SQL reais continuam pendentes; os testes anteriores de PostgreSQL 001–021 foram executados em ambiente descartável e não são repetidos apenas para a publicação estática quando os SQLs permanecem iguais.

## Preservação e rollback

A página integrada substitui somente `integrada/index.html`, `integrada/LEIA-ME.md` e `integrada/manifest.json`. Root, `/b12/`, `/integrada-g84/` e demais exemplos anteriores permanecem byte a byte; não afirmar que os exemplos públicos antigos passaram a ter autenticação real. A base da homologação antes desta atualização é `e597c67605a3501eeec6c1bb38303e122e576d6d`. O commit anterior permite reverter a apresentação estática, sem efeitos no Supabase. Esse rollback de demonstração não é procedimento de rollback operacional: um pacote operacional não pode reabrir escalas privadas.

O manifesto registra o commit de origem e os hashes do HTML/roteiro. Os SHAs efetivamente publicados e o status do GitHub Pages são entregues ao concluir a publicação. A inspeção de HTTPS pode ser limitada pela política de rede deste ambiente; build e deploy devem ser confirmados separadamente pelo GitHub.

## Ativação real pendente

Revisar a cadeia SQL e o inventário no projeto Supabase de homologação separado, aplicar somente com autorização, conciliar as fontes e confirmar Auth/RLS reais. A migração 021 fica preparada, sem execução. Consultar [calendar-privacy-activation.md](calendar-privacy-activation.md). Nenhuma edição desta demonstração deve ser anunciada como salva na nuvem.

Regressão desta publicação: **126 testes distintos aprovados** (104 Python/Chromium e 22 Node), sem falhas, erros ou casos pulados. Inclui criação administrativa, salvar/reabrir/publicar, filtros e privacidade simulada. Não corresponde à repetição da suíte histórica inteira nem a testes no Supabase real. Evidências locais em `dist/calendar-publication/`.
