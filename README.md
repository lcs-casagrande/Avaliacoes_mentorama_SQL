# IASDPI — Acompanhamento de Programação do Culto

MVP para cadastrar uma programação e acompanhar o planejado × realizado, com prioridade para celular e tablet.

**Administração de usuários:** interface e migração incremental em [Gestão de usuários](docs/user-management.md). Requer aprovação e aplicação da migração 002; não é ativada automaticamente.

**Acesso:** organograma e agenda são públicos. Planejamento, acompanhamento, realizado, histórico e backups exigem login Supabase e autorização `admin` ou `leader`. Veja [configuração e limites de segurança](docs/access-control.md). Sem configuração, o acesso privado permanece bloqueado; os dados existentes não são apagados.

## Executar

Requer Python 3.11+ e a base de fusos horários do sistema. Não há pacotes externos para instalar.

```sh
python3 backend/server.py
```

Abra `http://127.0.0.1:8000` no navegador da máquina que executa o servidor.

1. Em **Início**, crie uma programação ou use o exemplo.
2. Cadastre atividades em ordem cronológica, sem sobreposição, dentro do período da programação. Intervalos são permitidos. Marque como **pronta**.
3. Na data cadastrada, abra **Acompanhamento** e clique em **Iniciar atividade**. A execução começa pela primeira atividade, mesmo se o plano já indicar outra atividade naquele horário.
4. Use **Finalizar e avançar** para registrar o término e iniciar a próxima no mesmo instante. Ao concluir a última, o resumo aparece automaticamente no **Histórico**.

**Pausar acompanhamento** bloqueia o avanço, mas não desconta tempo: o relógio do culto continua contando. Observações devem ser salvas pelo botão correspondente.

## Organização e configuração

- `frontend/`: HTML, CSS e JavaScript, sem bibliotecas externas.
- `backend/server.py`: API e servidor local, usando a biblioteca padrão do Python.
- `data/iasdpi.sqlite3`: banco SQLite, criado automaticamente e ignorado pelo Git. Planejamento e registros de execução são armazenados separadamente. Preserve esse arquivo; para backup, pare o servidor antes de copiá-lo.

Configuração por variáveis de ambiente: `IASDPI_PORT` (8000), `IASDPI_HOST` (127.0.0.1), `IASDPI_DB` (caminho do banco) e `IASDPI_TIMEZONE` (America/Sao_Paulo). Os horários previstos pertencem à data e ao fuso da programação; horários reais são gerados no servidor e armazenados em UTC. Esta versão atende programações que começam e terminam no mesmo dia. Mantenha o fuso configurado para preservar o significado do histórico.

## Regras de acompanhamento

O plano fica protegido após o início. Duplicar copia itens e equipe para outra data, sem copiar execução ou ocorrências. Antes de iniciar, o destaque é a atividade prevista para o horário atual. Depois, é a atividade efetivamente em andamento; o item previsto naquele momento continua visível separadamente.

O desvio do horário usa a diferença entre o início real e previsto da atividade em andamento, somando eventual excesso sobre a duração planejada. A previsão de término é o término previsto mais esse desvio. Após finalizar, o desvio do término compara o último término real com o término previsto. O resumo também mostra a diferença de duração total, que pode ser distinta por causa do horário de início e dos intervalos. A primeira atividade com atraso observado é indicada; a causa deve ser registrada nas observações.

Os indicadores são arredondados ao minuto. Adiantamento e atraso de até 1 minuto são verdes; de 2 a 5, amarelos; acima de 5, vermelhos. Os limites estão centralizados em `thresholds` no frontend. Nenhum horário previsto é ajustado automaticamente.

## Limites desta versão

API protegida por Supabase Auth e lista de usuários autorizados, consultada em cada requisição. Antes de disponibilizar acesso compartilhado, configure as autorizações, HTTPS e valide a integração real. O servidor de desenvolvimento não deve ser publicado diretamente na Internet. Comandos usam controle de versão para impedir avanços repetidos e alterações concorrentes; use **Atualizar** para carregar ações feitas por outro operador.

A demonstração no GitHub Pages utiliza dados fictícios e armazenamento local do navegador, sem API ou banco corporativo. Para testar esse modo localmente, acrescente `?demo=1` ao endereço. Os dados da demonstração não são compartilhados entre dispositivos. GitHub Pages pode hospedar apenas o frontend; esta versão depende de uma API e não funciona integralmente no Pages sem um backend separado. Uma demonstração pública deve usar somente dados fictícios.

## GitHub Pages

A branch `gh-pages` contém somente os arquivos estáticos de `frontend/`, sem backend, banco ou configurações privadas. Em **Settings → Pages**, selecione **Deploy from a branch**, branch **gh-pages**, pasta **/ (root)** e salve. Essa ativação depende de permissão administrativa no GitHub.

As alterações na demonstração ficam no armazenamento local do navegador. O aplicativo com API Python e SQLite continua sendo a versão local.

## Registro manual do culto de 03/10/2026

Em **Início** ou **Programações**, selecione **Realizado · 03/10/2026**. O formulário contém os 17 itens e a equipe informada. Preencha início/término reais e salve parcialmente; **Finalizar e ver resumo** exige todos os horários. **Corrigir realizado** reabre o formulário após finalizar. Os itens das 10:10 permanecem simultâneos e não são somados duas vezes na duração total. Para anúncios, o término ausente continua sinalizado; 10:05 é somente a referência estimada de comparação. No GitHub Pages, os registros ficam exclusivamente neste navegador.

## Prévia sem publicação

Execute `python3 scripts/export_preview.py` para gerar `dist/IASDPI-previa.html` e o ZIP correspondente. Extraia o ZIP e abra o HTML no Chrome ou Edge. O arquivo reúne toda a demonstração, sem instalar dependências ou acessar a API. Durante os ajustes, entregue a prévia atualizada; publique no Pages quando a versão estiver concluída.

## Agenda oficial

A página **Escalas e agendas** separa anciãos mensais/semanais e eventos da igreja. O arquivo `frontend/agenda-data.js` contém apenas dados públicos importados do calendário incorporado em https://iasd-paradainglesa.netlify.app/. A data da última consulta aparece na tela. Comunicação mantém a escala informada pelo usuário, separada da fonte Google.

Para atualizar manualmente:

```sh
python3 -m pip install -r scripts/agenda-requirements.txt
python3 scripts/sync_agenda.py
python3 scripts/export_preview.py
```

O importador descobre o calendário no iframe ou no JavaScript do site; `--calendar-id` permite informar diretamente um ID público. O período padrão começa em fevereiro de 2026 e termina em dezembro de daqui a três anos; `--from-month` e `--to-month` permitem consultar outros períodos. Falhas de rede ou parsing preservam a última versão. Não são necessárias chaves privadas; o Google Calendar permanece somente leitura.

O workflow **Sincronizar agenda oficial** consulta a fonte a cada seis horas ou por execução manual. Ele atualiza somente os dados da agenda em `main` e `gh-pages`, sem publicar automaticamente alterações de layout. A agenda publicada usa a última consulta concluída; o horário do GitHub Actions pode sofrer atrasos. Se o workflow falhar, consulte sua execução e use a atualização manual.

Duplicações exatamente iguais são removidas. Dias inteiros consecutivos com título, departamento e local iguais são agrupados apenas na apresentação, preservando os IDs originais. Eventos simultâneos e horários diferentes continuam visíveis com avisos de conferência. Departamentos vêm do sufixo `| Departamento` do título ou de um campo explícito na descrição; informações ausentes não são inventadas.

## Preservação e arquivo privado

**Arquivo e banco** exporta todos os registros em um arquivo protegido por senha (AES-GCM, chave derivada com PBKDF2/SHA-256). Guarde uma cópia fora do dispositivo; a senha não fica no arquivo nem é recuperável pelo site. A restauração no Pages/HTML preserva os registros atuais, ignora cópias iguais e cria um novo registro para versões diferentes com o mesmo ID. O HTML baixado não contém os dados de outro navegador/origem; para exportar os registros do celular, use o site no mesmo endereço em que foram preenchidos.

Os registros do Pages continuam na chave `iasdpi-demo-v1`; leituras não removem exemplos nem modificam registros antigos. Antes de cada escrita local, `iasdpi-last-safety-copy-v1` recebe o estado anterior. Essa cópia também é local: limpar o navegador pode removê-la. Um erro de espaço impede a nova escrita e mantém os registros existentes.

Para arquivar em banco privado, crie um projeto Supabase, revise `database/001_single_church_access.sql` e crie uma conta em Supabase Auth. O SQL depende de aprovação e execução administrativa; a conta também precisa ser autorizada em `iasdpi_access`. Na página, informe URL do projeto, chave pública publishable/anon e credenciais da conta. Nunca use service_role, chave secreta ou senha do banco. O site grava versões imutáveis e confirma a existência de cada arquivo depois da inserção. O roteiro de RLS limita leitura/inserção às contas autorizadas da única igreja, sem permissão de alteração/exclusão. A sessão fica apenas em memória; a senha não é persistida. Escritas locais continuam funcionando sem banco, e falhas remotas não apagam dados locais.

A integração Supabase precisa ser configurada e validada no projeto real antes de ser considerada ativa. O esquema SQL e o cliente foram preparados; nenhum banco externo é criado automaticamente e nenhum registro de um navegador é migrado sem conexão autenticada. A restauração no SQLite não é feita pelo cliente de backup; preserve também o arquivo do banco do servidor.
