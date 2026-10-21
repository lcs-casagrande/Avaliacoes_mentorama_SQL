# Registro do Culto — modelos e data automática

## Criação

Registrar culto apresenta o seletor **Modelo da programação** e **Novo registro**.
Não há etapa obrigatória de escolha de data. Um novo formulário é aberto com a
data atual em America/Sao_Paulo; os registros existentes não são reabertos ou
alterados por essa ação. A criação só é persistida quando o usuário salva ou abre
a edição da programação prevista, que primeiro salva o rascunho.

- **Liturgia I — Padrão**: nome atual do modelo antes chamado Doxologia I.
  Carrega integralmente o modelo privado existente por api('chronogram'), conserva
  equipe, atividades, IDs internos, sequência e previstos, mas usa a data atual.
  O nome do modelo não implica renomear atividades ou registros antigos.
- **Livre — Sem atividades**: não consulta o modelo padrão. Abre com items=[],
  horários previstos vazios e equipe vazia. Não cria atividades de exemplo.

O catálogo cultoTemplates, em frontend/actuals.js, mantém IDs estáveis, rótulos e
fonte de cada modelo separados da apresentação. Outros modelos podem ser
acrescentados ao catálogo e às fontes privadas sem duplicar o fluxo de criação.
Não foi implementada uma tela de cadastro de modelos nesta entrega.

## Datas e edição

Campos de data da aplicação usam dd/mm/aaaa, inclusive execução, planejamento e
duplicação. O armazenamento e os timestamps continuam ISO. Datas são validadas
antes de salvar; 31/02, por exemplo, não é aceito. O parser também aceita ISO como
entrada compatível e o normaliza na saída do campo. O fuso de criação é explícito
e independe do fuso configurado no navegador.

Editar registro conserva ID, horários reais, responsáveis, notas, ocorrências,
status e subatividades. A data pode ser alterada manualmente, mantendo a hora
local dos timestamps. Nada recupera, corrige, mescla ou exclui automaticamente
o registro de 03/10. O proprietário pode preencher 10/10 manualmente.

**Editar programação prevista** abre um editor separado, disponível antes de
iniciar a execução. Em um rascunho Livre, essa tela começa sem linhas de atividade;
o usuário define início/término previstos e utiliza Adicionar atividade.
Salvar programação retorna ao registro de execução do mesmo ID. Campos previstos
não podem ser alterados pela edição da execução. Registros em andamento/finalizados
mantêm a proteção de planejamento existente.

As subatividades continuam internas à principal e não entram nos previstos,
transições, duração total ou atrasos. A edição, exclusão confirmada, aviso de
rascunho e cancelamento continuam disponíveis.

## Compatibilidade e persistência

plan.template_id é opcional: liturgy-i ou free no catálogo inicial. Registros
antigos sem esse atributo permanecem válidos e não são migrados.
Somente um rascunho manual explicitamente Livre admite items=[] e start/end vazios;
nesse caso planned_start/planned_end são null, em vez de horários fictícios.
Esse formato pode ser salvo, recarregado e exportado/restaurado em backup.
Finalizar um culto sem atividades é bloqueado. Programações comuns continuam
exigindo atividades e horários válidos. O backend aplica as mesmas regras.

A chave local iasdpi-demo-v1 continua igual. Não há limpeza de dados, importação
automática ou envio de registros para o Supabase. O pacote mantém remoteReadOnly.
Auth pode criar/renovar sessões normais; tabelas, modelos e autorizações não são
alterados por essa publicação. JSONB dos arquivos de backup já comporta os campos
opcionais, sem migração ou alteração de RLS; arquivos remotos continuam imutáveis.

## Testes e implantação

Testes de navegador usam contas simuladas e dados descartáveis. Cobrem ambos os
modelos, ausência de requisição de template no Livre, data perto da meia-noite UTC,
formato brasileiro, alteração manual, programação Livre, edição pelo mesmo ID,
subatividades, métricas, recarga, backup e conservação de registros antigos.
SQLite de teste é temporário; não há teste de escrita no Supabase real.

O arquivo backend/chronogram.json e o modelo privado no Supabase não são alterados.
Publicar somente o pacote estático do gerador build_pages.py. Preservar a agenda
mais recente do Pages, que pode avançar automaticamente pelo workflow existente.
Enviar os backups do código atual antes dos novos commits, sem sobrescrever refs.
Rollback requer novo commit e exportação dos dados antes de editar com versão
antiga: versões anteriores não conhecem rascunhos Livre vazios.

Arquivos da atualização: frontend/actuals.js, app.js, demo.js, archive.js, index.html;
backend/server.py; tests/test_frontend_access.py, test_registration_edit.py,
test_registration_backend.py; docs/record-templates.md e notas de fluxo anteriores.
