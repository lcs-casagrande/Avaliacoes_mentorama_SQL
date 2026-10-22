# Horários em 24 horas

Causa: inputs nativos type=time delegavam a apresentação AM/PM ao navegador.
Os horários previstos agora usam texto validado em HH:mm. Reais e subatividades
continuam em HH:mm:ss, com botão Agora em America/Sao_Paulo. Formatação de
agenda, metadados de arquivos e convites usa o mesmo fuso e relógio de 24 horas.

As funções de apresentação não modificam os documentos. Frações de segundos e
timestamps absolutos antigos não editados são preservados ao salvar uma nota.
Nenhuma migração, consulta autenticada ou alteração de dados reais do Supabase
foi executada. Auth, RLS e a persistência operacional permanecem inalteradas.
O backend local também calcula novos timestamps com ZoneInfo America/Sao_Paulo,
respeitando o horário de verão histórico, sem modificar os valores existentes.

Alterados: frontend/app.js, actuals.js, record-time.js, agenda.js, archive.js,
users.js e demo.js; backend/server.py. Novos testes: tests/test_hour_format.py.

Validação: 146 testes passaram no PostgreSQL descartável sem rede e navegadores
com Supabase interceptado. Os novos casos utilizam locale en-US e fuso
America/Los_Angeles; verificam meia-noite, Agora, todos os grupos de telas,
edição/reabertura, rejeição de 24:00, precisão antiga e métricas preservadas.
Log: /tmp/iasdpi-24h-complete-final.log. Uma primeira execução foi interrompida
pela reinicialização de bootstrap do PostgreSQL; a execução completa com a
instância estabilizada passou sem falhas nem testes ignorados.

Pacote operacional: /tmp/iasdpi-24h-pages (não publicado).
Prévia HTML: /workspace/IASDPI/dist/IASDPI-24h-previa.html. A prévia independente
usa o modo de demonstração local; o pacote do Pages usa Supabase operacional.
Rollback local preservado: backup-pre-24h-pages e backup-pre-24h-source.
O registro abaixo descreve a validação anterior à autorização final de publicação.


## Conferência dos registros de produção antes da publicação

Formato confirmado pelo usuário: previstos HH:mm; reais/subatividades HH:mm:ss.
A suíte completa de 146 testes acima utiliza dados fictícios. Ela não comprova
os valores dos registros reais de 10/10/2026 e 22/10/2026.

O ambiente dispõe de URL e chave pública, sem sessão de usuário autorizado
para ler os cultos sob RLS. Não foi tentado contornar essa restrição.
O usuário informou que 10/10 está finalizado e 22/10 está na Lixeira; essa
situação ainda não foi verificada por leitura dos documentos de produção.

Executar database/check_saved_time_compatibility.sql no SQL Editor como postgres
e exportar o resultado em JSON para conferência. A consulta é um único SELECT,
inclui ativos e Lixeira e retorna caminhos/valores temporais, estrutura,
identificadores técnicos e assinatura SHA-256 do documento. Não retorna nomes,
responsáveis, observações ou credenciais. Não salvar o resultado de produção em
arquivos versionados nem incluí-lo em artefatos públicos.

Teste adicional tests/test_saved_time_compatibility_sql.py aprovado no PostgreSQL
17 descartável sem rede: dois cultos fictícios, finalizado e Lixeira, frações de
segundo exatas, ausência de campos pessoais e comparação integral das tabelas
antes/depois em transação de leitura. Nenhuma consulta deste teste usa produção.

A apresentação não exige migração de dados. Não há novas mudanças de schema.
Segundos/frações ocultados na tela continuam no valor original não editado.
Uma edição explícita de um horário substitui esse horário, como já acontecia;
não se promete manter frações de um valor deliberadamente substituído.
Cálculos existentes usam a precisão de milissegundos do JavaScript e arredondam
indicadores conforme suas regras anteriores, sem regravar os horários originais.

O usuário posteriormente autorizou publicar o pacote aprovado sem aguardar a
leitura autenticada de produção. A compatibilidade descrita acima foi testada
com dados fictícios; os dois cultos reais não foram consultados nem alterados.


## Publicação autorizada em 22/10/2026

Formato reconfirmado: previstos HH:mm e reais/subatividades HH:mm:ss.
Verificação final: os seis testes de tests/test_hour_format.py passaram novamente,
sem falhas. O pacote confere os hashes dos recursos e mantém somente a chave
publishable. Backend Python e arquivos de banco não são publicados.
A atualização automática mais recente da agenda foi incorporada a partir de main.

Rollback da versão imediatamente anterior, sem sobrescrever os tags anteriores:
- backup-pre-24h-publicacao-20261022-source: 6953a38d860c116ed5c24b9e7b43dc172af07a4e
- backup-pre-24h-publicacao-20261022-pages: 079d9239e82a8857c8d8c695ca5a241ad807a8a5

Nenhuma migração de dados é necessária. A publicação substitui arquivos estáticos;
não executa SQL, não limpa localStorage e não altera documentos no Supabase.
