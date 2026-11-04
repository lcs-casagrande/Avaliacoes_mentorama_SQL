# Consolidação para revisão técnica e homologação estática

> Registro da consolidação anterior G8.4, commit `676ac5c`. A atualização E1 é documentada em [events-e1.md](events-e1.md); as referências abaixo à ausência de E1 descrevem a entrega anterior, não a candidata atual.

Data: 04/11/2026 (America/Sao_Paulo). Branch autorizada: `feat/schedule-management-b1` no repositório `lcs-casagrande/Avaliacoes_mentorama_SQL`. A publicação estática é exclusiva de `lcs-casagrande/IASDPI-homologacao`.

## Estado do código e escopo

O checkout preservado contém os Lotes 1–6, Escalas B1–B1.2 e governança G1–G8.4, com a preparação G9. Os 242 arquivos do manifesto G9 estavam iguais na inspeção inicial. A base local era `a77b48b`; a `main` remota apresenta atualização automática apenas de `frontend/agenda-data.js`. Essa atualização não foi sobrescrita nem mesclada: a demonstração mostra o snapshot já existente nesta candidata e bloqueia sincronização externa.

| Área | Incluída para revisão |
| --- | --- |
| Portal, Agenda, Organograma | Navegação integrada e fontes públicas autorizadas |
| Cadastro Geral | Pessoas centrais, vários departamentos, habilitações e dias por vínculo, aliases/nomes confirmados, conciliação administrativa demonstrativa |
| Escalas | Montagem mensal, manual/rodízio, rascunho/publicação na mesma aba, conflitos e Ancionato semanal/mensal |
| Acessos | Login por apelido fictício, perfis e capacidades simulados; alternância de ministérios |
| Cronoanálise | Código e proteções preservados; demonstração com identidade `crono.teste`, sem cultos de produção |
| G9 | Inventário somente leitura, instalação sequencial/recuperação locais e checklist real |
| E1 — Gestão de Eventos | **Ausente; não anunciada nem incluída como funcionalidade pronta** |

G8.1 não foi recuperada como entrega autônoma: as lacunas foram auditadas e consolidadas em G8.3/G8.4, conforme `central-registry-g83-audit.md`. Recursos preparados/testados localmente não são recursos já ativados no Supabase.

## Demonstração e preservação

Endereço planejado para validação HTTPS: `https://lcs-casagrande.github.io/IASDPI-homologacao/integrada/`. O resultado efetivo do deploy e os SHAs são entregues ao concluir a publicação; não devem ser inferidos deste endereço planejado.

O novo caminho reaproveita `export_preview.py --registry-identities-preview`, acrescentando identificação visível e roteiro de contas fictícias. As edições reiniciam ao recarregar. Habilitação/disponibilidade pendentes continuam pendentes; o rodízio exige confirmação no Cadastro Geral. Os exemplos anteriores em `/b12/` continuam separados para testes rápidos.

Os nove arquivos anteriores do site foram inventariados. Somente o HTML inicial recebe um link para a nova demonstração; seu manifesto é atualizado. Os demais arquivos e caminhos anteriores permanecem byte a byte, incluindo calendários históricos e as duas demonstrações B1.2.

O pacote integrado contém apenas HTML independente, `LEIA-ME.md` e manifesto de hashes. Não inclui banco, backend Python, migrações, ZIPs, caches ou logs. Configuração/contas/tokens do simulador são deliberadamente fictícios. A CSP bloqueia conexões e formulários externos; o provedor simulado rejeita fetch/XHR/WebSocket para serviços reais. Um namespace próprio impede acesso aos registros locais e sessões de outras versões do IASDPI.

A origem GitHub Pages é compartilhada com o site oficial, portanto esta demonstração **não é ambiente para autenticação real**. Um HML real exigirá outro projeto Supabase e outra origem HTTPS, conforme G9. Senhas públicas do simulador jamais devem ser usadas em contas reais.

## Verificações e ajustes necessários à consolidação

- `.gitignore` passa a permitir somente `data/confirmed-person-names.json`, dependência de código com as correspondências expressamente confirmadas. Bancos, segredos e os demais arquivos de dados continuam ignorados.
- `prepare_integrated_review.py` prepara o pacote sem publicar, rejeita destino existente, segredos/referências ao Supabase real, arquivos extras e dependências externas e verifica preservação do site anterior.
- `test_integrated_review.py` acrescenta dez casos de integridade, navegação, permissões simuladas, rodízio após confirmação, publicação/reset e cinco larguras.
- O ensaio G9 isolado encontrou dependência da ordem de testes: `service_role` era criado por outra suíte. A fixture G9 agora declara esse papel simulado quando ausente. O ensaio foi repetido como primeiro teste de **outro cluster PostgreSQL vazio**, sem alterar migrações.
- Os primeiros testes novos foram ajustados para controles existentes: formulários recolhidos, seletor de mês personalizado, navegação principal e API `requireIdentity` para identidades ministeriais. Não foram alteradas regras de negócio para obter aprovação.

Resultado desta execução em `review-publication-tests.json`: **164 casos distintos aprovados**, compostos por 51 PostgreSQL, 77 Chromium, 14 preparação/pacote e 22 Node. O primeiro grupo teve 123 sucessos e uma falha de setup, cobrindo nove casos não executados; esses nove passaram no cluster novo. As reexecuções não são somadas como novos testes. Sem casos pulados no consolidado selecionado.

A regressão completa G9 anterior registrou 1.145 aprovações consolidadas; não foi repetida integralmente nem somada aos 164 casos desta publicação. Seus três casos intermitentes e as limitações já conhecidas permanecem documentados. Chromium em 360/390/768/1024/1440 não comprova compatibilidade com Safari, Firefox ou aparelhos físicos.

## Pendências reais

- Provisionamento e restauração em Supabase HML separado; confirmação administrativa do inventário atual da produção.
- Auth/Edge/gateway/SMTP, recuperação PKCE e RLS com JWTs reais; contas descartáveis e testes reais exigem autorização própria.
- Revisão e autorização da cadeia SQL antes de qualquer instalação. Migrações 005–019 preparadas; nenhuma aplicada nesta consolidação. Não reaplicar 018 depois de 019.
- Conciliação de pessoas e associação das fontes históricas somente por prévia/confirmação administrativa; referências pendentes limitam a cobertura histórica dos conflitos.
- Ressalvas G6/G9: quota ao revisar publicação, parâmetros desejado/consecutivos ainda não aplicados pelo automático, destino pós-recuperação ministerial e desempenho em históricos grandes. Não anunciar essas limitações como resolvidas.
- E1 permanece para desenvolvimento posterior; não foi iniciada nesta publicação.

## Reprodução e rollback

```sh
python scripts/prepare_integrated_review.py --historical-site /CAMINHO/IASDPI-homologacao --output dist/review-nova
python -m unittest discover -s tests -p test_integrated_review.py -v
```

O repositório de homologação deve estar com os arquivos anteriores rastreados. O preparador não sobrescreve seu checkout. No pacote final, `integrada/manifest.json` registra o SHA de origem do código e os hashes do HTML/roteiro.

Rollback da demonstração: reverter somente o commit estático de homologação, preservando o commit anterior `d8b69f4ca0993e9f40c1268c45c016dcb33b2ecc`. Isso remove a entrada integrada e restaura o HTML/manifesto inicial sem tocar no repositório oficial ou em dados do banco. Não executar reset/push forçado.

O commit de desenvolvimento preserva seu pai e não é merge na `main`. Não há deploy automático do site oficial em push dessa branch; o Pages oficial utiliza `gh-pages`, enquanto a homologação utiliza `main` de outro repositório. A agenda oficial possui automação própria, que não foi acionada nem alterada.
