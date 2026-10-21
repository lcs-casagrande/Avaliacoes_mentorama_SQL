# Registro do Culto: edição e subatividades

## Escopo e dados reais

O Pages usa o localStorage `iasdpi-demo-v1`. O Supabase permanece somente para
identificação e consultas: não há persistência operacional remota habilitada.
A base SQLite local foi inspecionada em modo somente leitura e contém zero cultos.
Não houve acesso aos registros do navegador do proprietário nem a arquivos privados
autenticados do Supabase. O PDF mencionado anteriormente não está disponível aqui.

Os testes usam cópias descartáveis do formato e do modelo disponíveis, datadas de
10/10/2026, com horários, observações multilinha, dados complementares e extra legado.
Uma atividade da cópia fictícia foi chamada Doxologia I para testar sua preservação;
isso NÃO altera o modelo da igreja nem representa uma conferência dos dados reais.
Os arquivos de cronograma padrão e as migrações SQL não foram modificados.
O formulário preserva os nomes, a ordem e os horários de qualquer modelo/registro
carregado, incluindo Doxologia I quando presente. Não inventa posição ou horário.

## Fluxo de edição

1. Entrar > Registrar culto: escolher um registro existente e Editar registro.
   Também é possível abrir Histórico > Ver resumo > Editar registro.
2. Os campos anteriores aparecem preenchidos. É possível editar nome, data,
   horários reais, responsáveis, notas, ocorrências, status e informações complementares.
   Os horários previstos aparecem como texto, sem campos de edição da programação.
3. Adicionar subatividade dentro da atividade desejada. Editar seus campos ali.
   Excluir subatividade exige confirmação e só persiste ao salvar o registro.
4. Salvar alterações faz PUT no mesmo ID e incrementa a versão de concorrência.
   O aviso identifica armazenamento neste navegador ou no servidor Python local,
   sem afirmar sincronização na nuvem. Reabrir recupera os campos persistidos.
5. Cancelar edição pede confirmação se houver alterações e descarta somente o
   formulário ainda não salvo. Não exclui o culto nem a versão armazenada.

Navegação e recarga avisam sobre alterações não salvas. O aviso de saída do navegador
depende do suporte e das regras do Chrome; encerrar à força um aplicativo pode não
emitir beforeunload. Não há promessa de salvamento automático de rascunhos.

Atividades antigas sem status explícito são exibidas como realizadas quando têm
início/término, ou pendentes em caso contrário. Não realizada não recebe horários
fictícios. Finalizar exige que cada principal esteja resolvida; subatividades não
exigem horários. Salvar alterações preserva o status global de um culto já finalizado.

## Contrato de dados compatível

Extensão opcional do formato anterior, sem alterar IDs ou a versão 1 dos backups:

```json
{
  "actual_details": {
    "principal-id": {
      "note": "Observação",
      "responsible": "Equipe",
      "status": "realizada",
      "subactivities": [{
        "id": "sub-id",
        "parent_id": "principal-id",
        "title": "Detalhamento",
        "responsible": "Equipe",
        "note": "Observação",
        "start": "09:31:17",
        "end": "09:34:18"
      }]
    }
  },
  "record_info": "Informações complementares"
}
```

Status aceitos: `pendente`, `realizada`, `nao_realizada`. As duas horas do filho
são opcionais independentemente; qualquer hora informada exige intervalo real
completo da principal e deve estar dentro dele. Se ambas existem, término >= início.
O vínculo parent_id e a unicidade do ID dentro da principal são validados. Limite:
50 subatividades por principal. A validação ocorre no adaptador local E no backend,
não somente na apresentação. Alterar o intervalo principal também revalida os filhos.

Filhos ficam em actual_details, nunca em plan.items/executions. Não recebem horário
previsto, não entram na sequência, nas transições ou nas métricas de duração/atraso.
Um filho de uma extra antiga fica no subactivities dessa extra. As extras antigas
continuam no extra_events original, sem conversão/reordenação automática e sem
perder seus campos complementares. A interface não cria novos eventos independentes.

Clientes antigos que omitirem subactivities não apagam os filhos existentes; enviar
uma lista vazia indica exclusão explícita. Dados desconhecidos do registro e dos
detalhes são preservados. Backups validam, cifram e restauram os campos opcionais.
No SQLite são utilizados os campos JSON existentes, sem migração de esquema.

O localStorage usa o mesmo identificador e a revisão existente, com Web Locks em
navegadores compatíveis para serializar gravações da aplicação. Versões concorrentes
são rejeitadas. O SQLite usa a transação e a revisão antes da gravação. Código externo
que editar diretamente o localStorage pode ignorar locks; exportar backups continua
necessário. Não limpar o armazenamento para atualizar o site.

## Data de 10/10/2026

O novo fluxo por modelos preenche a data atual de São Paulo automaticamente e
permite alterá-la em dd/mm/aaaa. Não foi reintroduzida 03/10 como data fixa. Ver
[record-templates.md](record-templates.md). A correção pontual com prévia de 03/10 para 10/10 continua
disponível no resumo do registro antigo. A edição de data também mantém o ID,
ajusta as datas dos timestamps e preserva horas e planejamento. Nenhuma dessas
ações é executada automaticamente no carregamento. Ver session-and-date.md.

## Supabase e evolução futura

Não há novo SQL para executar: o arquivo de backup existente usa payload JSONB,
cujas restrições da migração 001 aceitam os campos opcionais dentro de programs.
As RLS e os grants existentes permanecem. Não adicionar tabela de filhos sem uma
necessidade operacional nova e autorização. culto_archives continua imutável:
NÃO habilitar UPDATE/DELETE para implementar edição de registros.

Uma futura persistência operacional exigirá adaptador e tabela próprios, UPDATE
pelo mesmo ID com revisão, RLS restrita aos admin/leader habilitados da única igreja,
autoria e auditoria, além de testes de conflito e isolamento. Nada disso é declarado
implementado nesta entrega. Os backups remotos são independentes de sincronização.
O pacote preparado conserva remoteReadOnly=true e os bloqueios de escrita do cliente;
isso não reduz os privilégios de um JWT utilizado em outros clientes autorizados.

## Teste manual seguro e publicação

Para conferir os dados reais sem modificar o original: exportar backup protegido no
navegador de origem, criar outro perfil do Chrome, entrar e restaurar a cópia nesse
perfil. Abrir o culto de 10/10, anotar ID, quantidade de atividades e previstos;
editar uma hora, criar/editar/excluir filho, salvar e reabrir. Conferir que existe
um único registro com esse ID, os previstos são iguais e só as horas principais
afetam indicadores. Voltar ao perfil original sem restaurar ou importar automaticamente.

Pacote preparado: `dist/pages-registration-edit/`, 17 arquivos estáticos, com URLs
de recursos versionadas. O destino é o Pages existente na branch gh-pages, raiz.
Publicação autorizada pelo proprietário; pacote revisado e backups de rollback enviados ao GitHub antes do deploy.

Rollback do site atual: tag remota `backup-pre-registration-edit` aponta para
`8f06a7deec42af566859057cc941bdedd7de27b3`; tag remota
`backup-pre-registration-edit-source` aponta para
`a957164eb261539eb355c9f06e2d86d6ee4fff1e`. Nenhuma tag anterior foi sobrescrita e
as branches de backup remotas existentes foram mantidas. As referências de preservação foram enviadas ao remoto antes da publicação;
a agenda existente deve ser conferida e preservada no pacote.
Rollback deve gerar novo commit, sem force-push nem restauração automática dos dados.
Git preserva código, não os registros particulares do navegador.

Arquivos desta tarefa: frontend/actuals.js, app.js, demo.js, archive.js, styles.css;
backend/server.py; tests/test_registration_edit.py; tests/test_registration_backend.py;
docs/registration-edit.md. As mudanças de sessão e data preparadas na tarefa anterior
continuam incluídas no pacote, com seus testes de regressão.

Ao voltar a uma versão anterior do código, exportar o backup antes de editar.
Versões antigas que não conhecem subatividades podem descartá-las ao salvar;
um rollback de emergência deve priorizar consulta/exportação até uma versão compatível.
