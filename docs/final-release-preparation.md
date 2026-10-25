# Publicação dos Lotes 1–6 — preparação final

Esta é a sequência atual de implantação. `pages-release.md` documenta uma fase
histórica de validação local/read-only e não deve orientar esta publicação operacional.
Nenhum dos comandos de commit, merge ou publicação abaixo foi executado nesta etapa.

## Preflight obrigatório dos pacotes

O mesmo validador é aplicado ao pacote anterior, aos dois insumos de rollback
e ao conteúdo novo, antes de escrever o destino:

- Manifesto JSON, sem chaves duplicadas, versão suportada, origem Git e ambiente.
- Inventário obrigatório conforme versão legada ou bundle; caminhos permitidos.
- Presença e SHA-256 de **todos** os arquivos, inclusive bundles antigos retidos.
- Recursos com nome por conteúdo e respectivos hashes/SRI.
- Referências do HTML, dependências do loader e URLs/imports dos CSS.
- Correspondência entre entry, HTML e loader; nenhuma dependência fora do pacote.
- Rejeição de symlinks, arquivos não declarados e material secreto detectável.
- Agenda com JSON válido e hash correspondente, sem exceção silenciosa.

Conferência somente leitura:

```sh
python -B scripts/build_pages.py --validate-site CAMINHO_PACOTE
```

Retorna código diferente de zero e motivo se houver inconsistência. Hashes/SRI
detectam inconsistência; não constituem assinatura de autoria. A procedência dos
insumos continua dependendo do GitHub/commit aprovado.

O workflow legado atualiza `agenda-data.js` sem renovar o manifesto. Se a captura
publicada tiver somente esse hash defasado, **não usar o pacote inconsistente**.
Conservar a captura bruta e criar outra cópia atestada: verificar o blob Git no
commit capturado, registrar hashes original/atual e atualizar somente a entrada
da agenda no manifesto dessa cópia. Não modificar os ZIPs/pacotes homologados.
Qualquer outra divergência deve interromper o processo. Se a agenda avançar
novamente, repetir a captura e atestação com os dados mais recentes.

## Integração com main

A branch de trabalho continua `fix/stabilization-lote6`, sem merge em `main`.
A agenda de `origin/main` em `192792e6bb2fc07c6184168a295d01bc093e2eab`
foi incorporada ao diretório de trabalho. Era o único arquivo diferente entre
o HEAD-base e a main consultada. Não foram alteradas configurações ou cultos.

As melhorias dos lotes estão no working tree, incluindo módulos e testes ainda
não rastreados. A candidata não pode ser obtida apenas por checkout do HEAD atual.
Após aprovação:

1. Conferir novamente a main remota, o status e os arquivos não rastreados.
2. Incorporar novos avanços sem sobrescrever a agenda nem os lotes.
3. Revisar e adicionar explicitamente frontend, scripts, testes/fixture pública e
   documentação. Excluir dist, segredos, bancos e dados particulares.
4. Conferir staged diff, scanner de material privilegiado e `git diff --check`.
5. Criar commit de revisão, enviar branch e abrir PR. Só integrar em main após
   aprovação, preservando o histórico e a atualização automática da agenda.
6. Executar a suíte no resultado integrado se houver mudanças/conflitos.

Sugestão de commit: `fix: valida pacotes completos e prepara release dos lotes 1 a 6`.

## Checklist manual de Supabase

Sem mudanças automáticas. Projeto `pwbxksxxmnblqwpvlheu`:

- [ ] **URL Configuration:** conferir Site URL
  `https://lcs-casagrande.github.io/Avaliacoes_mentorama_SQL/` e Redirect URLs
  restritas ao caminho da aplicação. O callback usa `#reset-password`.
  Se usar padrão de caminhos, restringir a `/Avaliacoes_mentorama_SQL/**`,
  sem liberar toda a origem indiscriminadamente. Não adicionar URLs sem aprovação.
- [ ] **SMTP:** conferir remetente/domínio, provedor, limites, destinatários
  autorizados e spam. Confirmar entrega a uma caixa descartável controlada;
  não compartilhar senha SMTP, chaves ou conteúdo privado.
- [ ] **Template Reset Password:** link compatível com `{{ .ConfirmationURL }}`
  e fluxo PKCE; conferir expiração e eventuais personalizações do template.
- [ ] **Recuperação real:** em origem da candidata já autorizada, solicitar link
  com conta descartável, abrir no mesmo navegador/perfil, redefinir e entrar de
  novo. Testar link inválido, expirado e reutilizado. Nenhuma promoção de acesso.
  Envio de email requer autorização; prévia read-only bloqueia a operação.
- [ ] **Política de senha:** conferir regras aplicadas no servidor. A UI de
  recuperação exige 12 caracteres; isso não prova a política real do projeto.
  Conferir CAPTCHA/rate limit se habilitados, sem desativar proteções.
- [ ] **Sessões:** registrar duração JWT, renovação, inatividade e limite absoluto
  disponíveis no plano. Testar recarga, reabertura e retorno do background após
  expiração JWT no celular real. Não confundir expiração JWT com sessão renovável.
- [ ] **RLS autenticada:** perfis separados para admin, leader, Auth sem acesso
  habilitado e anônimo. Conferir respostas do servidor, não apenas botões.
  Admin/leader compartilham os cultos da igreja única; não há isolamento por autor.
  Conta sem autorização deve ser negada; leader não administra usuários/Lixeira/
  modelos; escrita direta e helpers privados devem ser bloqueados.
- [ ] Conferir catálogo instalado usando `database/check_culto_trash_summary.sql`
  e permissões das RPCs administrativas da migração 002. Não reaplicar SQL.
  Usar dados fictícios para operações de escrita, nunca membros ou cultos reais.

Registrar resultados sanitizados. Não enviar senhas, tokens, cookies de sessão,
chaves administrativas ou cabeçalhos Authorization no chat/repositório.
Não há nova migração de banco para esta correção do gerador.

## Pacote, publicação e pós-publicação

1. Capturar o commit realmente servido pelo Pages e seu pacote completo.
   Validar a cópia atestada e guardar a bruta. Coordenar a janela com o cron da agenda.
2. Após aprovação/versionamento, gerar em pasta nova:

   ```sh
   python -B scripts/build_pages.py --previous-site SNAPSHOT_VALIDADO --output dist/release-final
   python -B scripts/build_pages.py --validate-site dist/release-final
   python -B scripts/build_pages.py --rollback-site SNAPSHOT_VALIDADO --previous-site dist/release-final --output dist/rollback-final
   python -B scripts/build_pages.py --validate-site dist/rollback-final
   ```

3. Guardar manifesto, SHA256SUMS e evidências. Regenerar o manifesto após o commit
   final, sem alegar que o HEAD antigo contém mudanças ainda não versionadas.
4. Criar referência de rollback com nome novo, sem sobrescrever backups.
5. Publicar somente os arquivos estáticos validados na raiz de `gh-pages`, em
   novo commit; preservar aliases antigos e todas as gerações de bundles.
   Não publicar Python, SQL, banco, dados privados ou chave administrativa.
6. Confirmar build concluído no Pages. Registrar commit-fonte e commit publicado.
7. Testar aba nova e antiga, organograma/agenda, SRI/console, login/consultas com
   contas descartáveis autorizadas, rascunhos, histórico e navegação. Não apagar
   dados do site. Escritas somente em cultos fictícios previamente autorizados.

## Rollback

Reverter diante de falha persistente de bootstrap/SRI, regressão de login/gravação,
perda de rascunhos, dados incorretos ou exposição indevida. Diagnosticar falhas
transitórias; consulta falha não pode ser tratada como lista vazia.

Compor rollback usando pacote anterior **válido** e versão atual **válida**,
retendo os recursos novos para HTML em cache e a agenda mais recente. Se a agenda
ou a versão avançou, recapturar/atestar antes de compor. Validar novamente.

Publicar em novo commit de `gh-pages`, sem force push/reset. Confirmar build e
testar HTML antigo fresco e HTML novo em cache. Não fazer downgrade SQL, reimportar
registros, limpar localStorage/IndexedDB ou restaurar dados automaticamente.
Rollback do frontend não desfaz gravações do banco nem corrige uma RLS incorreta.
