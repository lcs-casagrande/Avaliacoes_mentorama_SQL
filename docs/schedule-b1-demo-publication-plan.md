# Demonstração B1 — pacote e plano de publicação para autorização

**Situação: preparado localmente, não publicado.** Branch de desenvolvimento: `feat/schedule-management-b1`. Não foi feito commit, push, merge, deploy ou alteração no Supabase.

## Hospedagem existente e separação dos dados

Consultas somente leitura à API GitHub confirmaram:

- Repositório de destino: `lcs-casagrande/IASDPI-homologacao`.
- Branch de publicação: `main`, raiz `/`; GitHub Pages já ativo, HTTPS obrigatório.
- Commit atual: `79c2a258c7f2ef0bc6ab7d9c4154c901aef376b9`; status informado pelo GitHub: `built`.
- Não é necessário criar repositório ou configurar outro serviço.

A raiz manterá os cinco arquivos históricos **byte a byte**, incluindo o calendário visual aprovado e os cadastros da Fase A. Sonoplastia (15), Comunicação (5) e os períodos de anciãos permanecem em suas fontes atuais, sem mistura com os testes.

A nova área ficará em `/b1/`. Seu menu reúne **Montar escala**, **Calendário demonstrativo** e **Cadastros**. Um link abre o calendário histórico em outra aba, com `noopener`, mantendo o cenário fictício na aba original.

Endereço **planejado, ainda não publicado**: `https://lcs-casagrande.github.io/IASDPI-homologacao/b1/`.

## Pacote concreto

Diretório pronto: `dist/schedule-b1-homologacao/final/site/`.

Somente estes cinco caminhos serão adicionados no repositório de homologação:

```text
b1/index.html
b1/styles.css
b1/demo.js
b1/manifest.json
b1/.nojekyll
```

O diretório contém também uma cópia de referência dos cinco arquivos da raiz, com hashes idênticos aos atuais. Eles **não precisam ser alterados no commit**. O inventário está em `final/package-integrity.json`.

Nenhum SQL, banco, configuração de produção, biblioteca de autenticação, chave pública ou segredo administrativo é incluído. O HTML tem SRI para JavaScript/CSS e CSP `connect-src 'none'`, `form-action 'none'`. Fetch, XHR, WebSocket, EventSource e sendBeacon permanecem bloqueados. Não há serviço de backend ou envio de mensagens.

## Dados fictícios e funcionalidades

| Pessoa fictícia | Habilitações de exemplo |
|---|---|
| Alfa | Sonoplastia: áudio; Música: vocalista |
| Beta | Sonoplastia: áudio; Diaconato: diácono |
| Gama | Música: vocalista |
| Delta | Ancionato: ancião do culto |

Pessoas e habilitações são exemplos para uso imediato; **nenhum evento ou voluntário é escalado automaticamente**. Todas as atribuições dependem da seleção manual do usuário.

É possível escolher qualquer mês, gerar quartas/sábados/domingos com horários informados, adicionar evento extraordinário, escolher funções e vagas, selecionar pessoas, editar rascunhos, publicar uma demonstração e consultar versões. Somente os planos fictícios publicados aparecem no calendário demonstrativo; rascunhos permanecem na montagem.

As telas e as ações de publicação indicam o modo demonstrativo. Salvar e publicar atualizam apenas a memória da aba; **recarregar/fechar a página reinicia os testes**. Não há sincronização, login real, localStorage operacional ou associação com a identidade de membros da igreja.

O simulador valida habilitação, sobreposição entre departamentos e indisponibilidade. Isso é evidência do fluxo da demonstração, **não é homologação de RLS ou de transações do Supabase**. A migração 006 e o código operacional B1 não foram alterados nesta preparação.

## Roteiro acessível sem console

1. Abrir a B1 e escolher Sonoplastia e outubro de 2026 (ou outro mês).
2. Informar 09:30–11:30 e gerar os sábados. Nenhum horário é presumido.
3. Selecionar um evento, adicionar a função de áudio, escolher Alfa e salvar rascunho.
4. Abrir Música no mesmo mês, selecionar o mesmo evento, adicionar vocalista e escolher Alfa. Salvar deve exibir conflito, sem apagar o formulário ou alterar a escala de Sonoplastia.
5. Trocar por Gama e salvar. Clicar em **Publicar demonstração** e confirmar.
6. Consultar o calendário demonstrativo no mesmo mês. Abrir o dia por mouse ou teclado e conferir departamento, função, pessoa e origem fictícia.
7. Conferir Diaconato/Beta e Ancionato/Delta; ambos estão habilitados para novas escalas demonstrativas.
8. Alterar título/observação de um rascunho, salvar e consultar versões anteriores. Para voltar a rascunho a partir de uma publicação, confirmar a mudança de estado.
9. Usar Cadastros para consultar pessoas, vínculos, funções e disponibilidade fictícios. Voltar à montagem recarrega o catálogo simulado.
10. Abrir o calendário histórico pelo link em nova aba: os registros reais permanecem separados. Recarregar a B1 deve reiniciar somente a demonstração.

## Verificações executadas

**58 testes direcionados aprovados, zero falhas:**

- 10 novos do pacote e demonstração completa: quatro departamentos, conflito/correção, vagas e publicação, edição/UUIDs/versões, evento extraordinário, indisponibilidade, menu, Voltar/Avançar, link direto, alterações pendentes, teclado, rede e histórico separado.
- 28 regressões do calendário aprovado.
- 6 regressões da demonstração/cadastros da Fase A.
- 14 regressões da interface, transporte e empacotamento B1.

Os 530 testes completos da entrega anterior foram preservados, mas **a suíte completa e os testes PostgreSQL não foram repetidos nesta preparação**, restrita ao host e aos dados simulados. Os hashes do código operacional, SQL, permissões e testes B1 anteriores permanecem iguais; o gerador de prévias foi estendido com modo opcional.

Chromium headless: montagem e calendário em 360, 390, 768, 1024 e 1440 px, sem rolagem horizontal indevida. Capturas em `dist/schedule-b1-homologacao/captures/`; resultados em `visual-check.json` e logs `tests-*.log`. Não foram testados dispositivos físicos, Safari ou Firefox.

O teste de navegação encontrou e corrigiu um problema do host demonstrativo com mudança de fragmento na mesma página. O teste correspondente passou após a correção; a navegação do site operacional não foi modificada.

## Arquivos de preparação

- `scripts/build_schedule_demo.py`: modo opcional `--homologation-demo`; demais modos preservados.
- `scripts/prepare_b1_demo.py`: monta o subdiretório, valida o pacote histórico e rejeita destino existente, arquivos ausentes/adulterados ou conexões/credenciais no pacote.
- `tests/fixtures/schedule-b1-homologation-demo.js`: pessoas fictícias habilitadas, indisponibilidade, roteiro e calendário de planos simulados.
- `tests/fixtures/schedule-b1-demo-navigation.js`: navegação exclusiva do host demonstrativo.
- `tests/test_schedule_b1_homologation_demo.py`: 10 novos testes.
- Este plano; artefatos e evidências locais em `dist/schedule-b1-homologacao/`.

Prévia HTML: `final/IASDPI-B1-demonstracao.html`. Para testar inclusive o link da raiz com todos os recursos, servir localmente:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory dist/schedule-b1-homologacao/final/site
```

Abrir `http://127.0.0.1:8765/b1/`. A prévia é local; nenhuma URL HTTPS B1 foi publicada ou verificada nesta etapa.

## Plano de atualização — executar somente após autorização

1. Reconsultar `IASDPI-homologacao/main`. Se o commit divergir de `79c2a25`, ou `/b1/` já existir, interromper e revisar antes de sobrescrever qualquer arquivo.
2. Preservar referência de rollback para `79c2a25`, com uma tag nova sem sobrescrever referências existentes.
3. Copiar e conferir **apenas os cinco arquivos novos `b1/`**. Verificar novamente SHA-256, SRI, ausência de segredos, conexão externa e dados reais no subdiretório B1.
4. Fazer commit e push exclusivamente no repositório `IASDPI-homologacao`, branch `main`; não fazer merge/commit no projeto oficial.
5. Aguardar o build automático do Pages já configurado. Não alterar source, domínio ou configurações do serviço.
6. Validar o commit implantado, HTTPS e caminho `/b1/`, recursos relativos, navegação, conflito/correção e visualização em celular emulado. Comparar os hashes da raiz antes/depois.
7. Entregar a URL e o commit, distinguindo a validação direta do site da confirmação pela API GitHub. A política atual do ambiente não permite presumir acesso direto a `lcs-casagrande.github.io`; eventual bloqueio deverá ser informado, sem afirmar abertura não testada.

**Rollback:** reverter exclusivamente o futuro commit que adiciona `b1/`; os arquivos históricos da raiz não mudam e não há banco a restaurar. Não restaurar ou alterar dados de produção.

Este plano não autoriza sua própria execução. A publicação aguarda autorização explícita do usuário.
