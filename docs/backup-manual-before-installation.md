# IASDPI — backup recuperável antes de instalar 005–026

**Método escolhido: exportação lógica completa pelo terminal.** O usuário confirmou plano Free e nenhum backup disponível no painel. Nenhuma operação remota foi executada. Compatibilidade G10.5 concluída; backup, restauração, criação de destino, configuração e instalação ainda exigem autorização. Não repetir os inventários G10.1/G10.5.

## 1. Escolher o método no painel

1. Abrir o projeto **IASD_Parada** e conferir nome/referência em **Project Settings → General**.
2. Abrir **Database → Backups**. Apenas consultar inicialmente; não clicar em Restore nem habilitar serviços pagos.
3. Anotar qual opção existe, o instante/fuso do backup ou ponto recuperável e a disponibilidade de **Restore to a New Project**. Os nomes dos menus podem variar.

| O painel mostra | Método indicado |
| --- | --- |
| PITR disponível | Preferir recuperação gerenciada no ponto confirmado imediatamente anterior à instalação; ensaiar em novo projeto |
| Backups diários disponíveis | Usar cópia gerenciada se ela incluir todas as gravações que precisam ser preservadas; ensaiar em novo projeto |
| Sem backup acessível / Free | Exportação lógica completa pelo terminal; recuperação em destino Supabase compatível exige o procedimento lógico do provedor e revisão dos objetos gerenciados |

O inventário confirmou PostgreSQL **17.11**, dados Auth e extensões, incluindo Vault; não informa se Vault contém dados utilizados. A confirmação posterior do usuário resolve a escolha: **no IASD_Parada atual, usar exportação lógica**. Não habilitar PITR, alterar plano ou criar projeto para obter backup gerenciado sem autorização.

Se o backup diário for anterior aos últimos cultos/alterações, ele não permite retorno sem perda. Escolher ponto mais recente, aguardar nova cópia com as escritas contidas, ou complementar com exportação lógica atual. Não adotar “até um dia de perda” implicitamente.

## 2. O que precisa ser preservado

| Parte | Cobertura e ação |
| --- | --- |
| Banco IASDPI | Todas as tabelas/dados, funções, constraints, índices, RLS/grants e schemas privados. Inclui Cronoanálise, modelos, cultos, projeções, arquivos, revisões, recibos, Lixeira, auditoria e permissões |
| Dados Auth | Usuários, UUIDs, identidades, hashes mantidos pelo Auth e demais registros do schema `auth`. O backup físico inclui esses dados; a exportação lógica deve incluí-los. Não recriar usuários manualmente nem substituir seus UUIDs |
| Configuração Auth | Site URL, redirects, provedores, inscrições, política de senha/sessão, SMTP/templates e hooks precisam de registro separado. Não presumir que a restauração do banco configura o serviço |
| Edge Functions | Guardar código efetivamente implantado, versão e configuração de cada função. Código em Git só serve como cópia se corresponder à versão implantada |
| Segredos/chaves | Guardar referências/versões no cofre administrativo e confirmar que os valores necessários podem ser recuperados. A lista de nomes no painel não é uma cópia dos valores. Não copiar para Git/chat |
| Storage | Banco contém metadados; arquivos/buckets/configurações exigem recuperação própria quando utilizados. Não considerar arquivos preservados apenas porque suas linhas foram restauradas |
| Ambiente externo | Frontend/configuração pública anterior, origens/CSP, Data API, Realtime, integrações, webhooks/jobs, DNS e configurações de hospedagem |
| Vault/criptografia | Clonagem física gerenciada preserva a chave raiz conforme o provedor. Dump lógico não a transporta automaticamente; se houver uso, preservar a chave pelo procedimento seguro do Supabase. Extensão instalada não prova uso nem dispensa a verificação |

Senhas de papéis SQL com LOGIN não equivalem a senhas de usuários Auth. Não redefinir senhas existentes para preparar o backup; recuperar acesso administrativo pelo procedimento aprovado se faltar a credencial.

## 3. Preparar o ponto de recuperação

Antes de executar qualquer caminho:

1. Combinar operador e janela; avisar os responsáveis para interromper as gravações da Cronoanálise e operações administrativas afetadas durante o corte. Nenhuma configuração foi alterada por este roteiro.
2. Registrar a última gravação que deve estar incluída, o instante do backup, o tempo máximo de indisponibilidade e a perda aceitável de dados. Para preservar integralmente, não aceitar perda de gravações já confirmadas.
3. Guardar o pacote frontend/configuração atual, commit da branch, manifesto das migrações e cópia das configurações da seção 2 em local protegido, fora do repositório. Preservar também a evidência de backup/restore.
4. Em **Authentication**, registrar as configurações indicadas, sem exportar contatos/senhas em relatório. Em **Edge Functions**, registrar versões/código/configuração e referências aos segredos. Não implantar as novas funções ainda.
5. Conferir integrações externas conhecidas. Um clone físico pode executar imediatamente jobs/webhooks/extensões restaurados. Não iniciá-lo se isso puder acionar produção, enviar mensagens ou executar tarefas sem contenção aprovada. Nesse caso, escolher recuperação lógica com revisão prévia dessas integrações.

## 4. Exportação completa pelo terminal — caminho para o Free

### Exportar sem alterar o banco

Estação administrativa protegida; comandos abaixo para **Bash/Linux/macOS/WSL**. Usar ferramentas PostgreSQL **17** atualizadas, compatíveis com a origem. Não usar chave anon/service_role como senha de conexão PostgreSQL.

1. No painel, clicar em **Connect**. Copiar **host, porta, database e usuário** da conexão direta; se não houver IPv6, escolher **Session pooler**. Não usar Transaction pooler. Usar a senha do banco já autorizada, sem redefini-la.
2. Criar um arquivo local `pg_service.conf`, fora do Git, com permissões restritas. Preencher os campos a partir do painel; obter o certificado CA indicado pelo provedor para validação TLS. Não colocar senha nesse arquivo:

```ini
[iasdpi_origem]
host=HOST_COPIADO_DO_PAINEL
port=PORTA_COPIADA_DO_PAINEL
dbname=postgres
user=USUARIO_COPIADO_DO_PAINEL
sslmode=verify-full
sslrootcert=/CAMINHO/PROTEGIDO/ca-do-projeto.crt
```

3. Em uma pasta **nova**, protegida e fora do repositório, executar após autorização. Ajustar somente o caminho do arquivo de serviço. A senha será solicitada no terminal sem ser incluída no comando:

```sh
set -e
umask 077
export PGSERVICEFILE='/CAMINHO/PROTEGIDO/pg_service.conf'
pg_dump --version
pg_dump --password --dbname='service=iasdpi_origem' \
  --format=custom --file=iasdpi-pre-005.dump 2>backup-database.stderr
pg_dumpall --password --database='service=iasdpi_origem' \
  --roles-only --no-role-passwords --file=roles-pre-005.sql 2>backup-roles.stderr
pg_restore --list iasdpi-pre-005.dump > conteudo-do-backup.txt
sha256sum iasdpi-pre-005.dump roles-pre-005.sql > SHA256SUMS
sha256sum --check SHA256SUMS
```

No macOS sem `sha256sum`, usar `shasum -a 256` e `shasum -a 256 -c SHA256SUMS`. Não reutilizar nomes sobre uma cópia existente. Verificar os dois arquivos stderr; qualquer erro ou ausência de conteúdo necessário interrompe a aprovação. Não desativar validação TLS para contornar falhas de certificado.

4. Confirmar no índice `conteudo-do-backup.txt`: schema/dados `public`, `iasdpi_admin_private`, `iasdpi_operational_private`, **`auth` e suas identidades/usuários**, funções, policies, grants e extensões. Não usar `--schema=public`, `--no-acl` ou `--no-owner` para simplificar a cópia. Revisar também outros schemas efetivamente presentes.
5. Guardar dump, roles, logs e configurações em armazenamento criptografado, com cópia independente e acesso administrativo. O dump contém material sensível de Auth. Não anexá-lo ao chat/Git. O checksum detecta alteração do arquivo; não prova recuperação.

## 5. Restaurar o caminho lógico em ambiente separado

Um projeto Supabase novo já possui schemas/papéis gerenciados. **Não executar `pg_restore` integral cegamente nele:** colisões em Auth/roles/extensões podem produzir recuperação incompleta. PostgreSQL comum sem as extensões Supabase também não é destino equivalente.

1. Após autorização, criar/selecionar destino Supabase protegido e independente. Registrar origem/destino e confirmar versões/extensões, papéis e chaves necessários; não ligar o frontend público.
2. Extrair arquivos de revisão da cópia local, sem acessar a origem. Estes comandos não restauram dados:

```sh
pg_restore --schema-only --file=schema-bruto.sql iasdpi-pre-005.dump
pg_restore --data-only --file=dados-brutos.sql iasdpi-pre-005.dump
```

Usar o [procedimento lógico oficial do Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) para preparar a partir desses arquivos o conjunto adequado ao destino: roles personalizados, schema da aplicação, dados completos incluindo Auth e customizações dos schemas gerenciados. Preservar dump/arquivos brutos e somas de verificação. Isso requer revisão técnica antes do próximo comando; não basta renomear os arquivos para “revisados”. Não autorizar instalação enquanto essa etapa e o ensaio não estiverem concluídos.
3. Não copiar cegamente papéis internos como `supabase_admin` nem alterar owners/grants para fazer o restore “passar”. Registrar qualquer adaptação necessária. Se houver Vault/colunas criptografadas, concluir o procedimento de chave raiz no destino antes de considerar os dados utilizáveis.
4. Quando o conjunto revisado estiver pronto, configurar serviço libpq **`iasdpi_destino`**, em arquivo protegido, com a referência **nova**, TLS e credencial do destino. O operador revisa a conexão antes do comando. Executar somente os arquivos revisados, nunca os arquivos brutos de roles automaticamente:

```sh
psql --password --dbname='service=iasdpi_destino' \
  --single-transaction --set=ON_ERROR_STOP=1 \
  --file=roles-revisados.sql --file=schema-revisado.sql \
  --command='SET session_replication_role = replica' \
  --file=dados-revisados.sql
```

O ajuste de triggers é restrito à sessão de restauração do **destino**, conforme o procedimento do provedor; não é ajuste de produção. Os arquivos devem corresponder à mesma cópia consistente e ser aptos à transação. Se a permissão do provedor, qualquer objeto ou arquivo não estiver revisado, **não executar**; este comando não resolve esses pré-requisitos automaticamente. Nenhum conjunto real de restore foi gerado/aprovado nesta preparação.

5. Executar a seção 6. Se falhar, manter a origem intacta e corrigir/recriar somente o destino autorizado. Não considerar exportação lógica aprovada enquanto não houver restauração integral verificada.

## 6. Validar que a restauração é recuperável

Não repetir a auditoria de compatibilidade. Usar seus resultados como referência; esta etapa verifica **o conteúdo restaurado e o funcionamento**, não reinstala o core.

1. Registrar backup/ponto, origem/destino, versão, operador, início/fim e resultado. Comparações com a origem devem corresponder ao **mesmo ponto**; origem que continuou recebendo gravações não serve como referência exata de uma cópia anterior.
2. Conferir no destino as **12 tabelas** do core e todas as linhas da cópia: as seis públicas (`iasdpi_access`, `iasdpi_templates`, `culto_archives`, `iasdpi_programs`, `iasdpi_activities`, `iasdpi_subactivities`), três administrativas (`control`, `invitations`, `audit`) e três operacionais (`revisions`, `receipts`, `trash_audit`). Comparar contagens e conteúdo/digests contra a referência protegida do ponto de backup, sem exportar linhas pessoais para relatório. Contagem igual, sozinha, não prova dados iguais.
3. Reaproveitar `database/check_g9_baseline.sql` **somente se for necessária a coleta de validação autorizada do restore**: `core_fingerprints` traz contagem/digest de oito tabelas principais, não de todo o banco/Auth. O comparador `compare_g9_snapshots.py` não compara esses digests automaticamente. Não apresentar esse check isolado como prova integral; conferir também control/invitations/audit/receipts, Auth e demais schemas presentes na cópia.
4. Conferir usuários/identidades **com os mesmos UUIDs**, associações, estado e credenciais Auth preservadas. Não criar usuários substitutos, resetar senhas de membros ou enviar mensagens para testar. Sessões/JWTs do projeto original não devem ser considerados válidos em outro projeto; reautenticar apenas contas existentes cujo uso no ensaio foi autorizado.
5. Comparar funções, owners, RLS e grants do destino com a evidência existente da G10.5. Não conceder permissões extras para esconder falhas. Usuário sem permissão deve continuar impedido de ler/gravar dados privados.
6. Com frontend **privado e apontando apenas ao destino**, configurar o mínimo de Auth/Edge necessário ao ensaio usando dados do destino. Não implantar antecipadamente a governança 005–026 para testar a recuperação da base 004.
7. Com conta existente autorizada, testar login por e-mail atual, leitura dos modelos e cultos, histórico/arquivos/Lixeira e permissões. Confirmar culto finalizado e seus dados de execução. Fazer gravação/edição/recuperação de **um culto de teste claramente identificado somente no destino**, se esse teste estiver autorizado. Não modificar um culto histórico nem a origem.
8. Guardar evidências sanitizadas e anotar diferenças explicadas de ambiente. Só marcar **BACKUP RECUPERÁVEL VALIDADO** quando dados, Auth, permissões, funcionamento, configurações necessárias e capacidade de retorno estiverem conferidos. Download, “Restore completed”, contagens ou um login isolado não bastam.

## 7. Se uma migração falhar na implantação futura

1. **Parar imediatamente:** não executar a próxima migração nem reaplicar a que pode ter feito COMMIT. Guardar arquivo/hash, erro sanitizado e último checkpoint aprovado.
2. Se a transação falhou **antes do COMMIT**, confirmar rollback dessa etapa. Etapas anteriores commitadas permanecem instaladas; não presumir retorno automático à base 004.
3. Se o arquivo commitou e o check falhou, manter as escritas afetadas contidas e revisar o estado antes de corrigir. Preferir correção incremental revisada quando há dados novos.
4. Não encadear downs nem usar CASCADE. 015/024/025 têm restrições; 026 não tem reversão automática segura após uso. Não apagar histórico, contas ou permissões para obter rollback.
5. Se for necessário retorno por backup, restaurar primeiro em destino separado e reconciliar gravações posteriores ao ponto. Aprovar a decisão de corte. **No Free atual, não há botão de restore/PITR disponível para este retorno:** será recuperação lógica coordenada, com tratamento dos objetos criados e dependências. Nunca aplicar o dump por cima da origem em uso. Reposição no projeto original ou mudança para o destino restaurado exige plano revisado, autorização distinta e janela, pois interrompe a Cronoanálise.
6. Repor o frontend/configurações/Edge compatíveis com o banco recuperado; preservar UUIDs e tratar sessões/recuperações pendentes. Se houver mudança de projeto, revisar endpoints, chaves, origens e novas sessões explicitamente. Não apontar o frontend antigo para esquema incompatível. Revalidar Cronoanálise, Auth e permissões antes de retomar. Recuperação ainda não ensaiada não é plano de retorno aprovado.

## Registro mínimo para aprovação

```text
Projeto origem/referência:
Método: físico diário / PITR / lógico
Ponto e fuso; última gravação incluída:
Artefatos e SHA-256, se exportados:
Cópia independente/cofre e responsável:
Projeto destino/referência diferente:
Dados/Cronoanálise/modelos/históricos: aprovado / pendente
Auth/UUIDs/identidades: aprovado / pendente
RLS/permissões e leitura negada: aprovado / pendente
Configurações/Edge/Storage/Vault: aprovado / não utilizado confirmado / pendente
Teste funcional no destino e evidência:
Tempo de recuperação observado; perda aceitável acordada:
Pendências e decisão do responsável:
Autorização de instalação 005–026: PENDENTE
```

Não enviar dumps, senhas, chaves, tokens ou registros pessoais com esse resumo. **Nenhuma instalação está liberada por este roteiro.**

Referências: [Backups do Supabase](https://supabase.com/docs/guides/platform/backups), [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project), [Backup/restore lógico](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). [Plano G10.5](governance-g10-5-deployment.md).
