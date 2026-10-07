# IASDPI — Acompanhamento de Programação do Culto

MVP para cadastrar uma programação e acompanhar o planejado × realizado, com prioridade para celular e tablet.

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

Aplicação local, sem autenticação. Antes de disponibilizar acesso compartilhado por celular/tablet ou implantar em servidor corporativo, implemente autenticação, HTTPS e controle de acesso. O servidor de desenvolvimento não deve ser publicado diretamente na Internet. Comandos usam controle de versão para impedir avanços repetidos e alterações concorrentes; use **Atualizar** para carregar ações feitas por outro operador.

A demonstração no GitHub Pages utiliza dados fictícios e armazenamento local do navegador, sem API ou banco corporativo. Para testar esse modo localmente, acrescente `?demo=1` ao endereço. Os dados da demonstração não são compartilhados entre dispositivos. GitHub Pages pode hospedar apenas o frontend; esta versão depende de uma API e não funciona integralmente no Pages sem um backend separado. Uma demonstração pública deve usar somente dados fictícios.

## GitHub Pages

A branch `gh-pages` contém somente os arquivos estáticos de `frontend/`, sem backend, banco ou configurações privadas. Em **Settings → Pages**, selecione **Deploy from a branch**, branch **gh-pages**, pasta **/ (root)** e salve. Essa ativação depende de permissão administrativa no GitHub.

As alterações na demonstração ficam no armazenamento local do navegador. O aplicativo com API Python e SQLite continua sendo a versão local.

## Registro manual do culto de 03/10/2026

Em **Início** ou **Programações**, selecione **Realizado · 03/10/2026**. O formulário contém os 17 itens e a equipe informada. Preencha início/término reais e salve parcialmente; **Finalizar e ver resumo** exige todos os horários. **Corrigir realizado** reabre o formulário após finalizar. Os itens das 10:10 permanecem simultâneos e não são somados duas vezes na duração total. Para anúncios, o término ausente continua sinalizado; 10:05 é somente a referência estimada de comparação. No GitHub Pages, os registros ficam exclusivamente neste navegador.
