# G10.1 — Executar o inventário no Supabase

Esta etapa **não instala nada**. O resultado real ainda não foi recebido. Não executar migrações, bootstrap de administrador, checks com `DO`/RPCs, importações ou redefinições de senha.

1. Abra o painel Supabase e selecione **IASD_Parada**, o projeto já utilizado pela Cronoanálise.
2. Em Settings → General, confira o nome e a referência do projeto. O código atual aponta para a referência pública `pwbxksxxmnblqwpvlheu`; isso é uma pista de configuração, **não uma confirmação da identidade do projeto aberto**. Se a referência for diferente, informe a diferença antes de prosseguir. Não copie chaves ou connection strings.
3. Abra **SQL Editor → New query**. Confira que o papel selecionado é `postgres`. Não use Run para qualquer migração 001–025.
4. Cole integralmente [check_g10_1_inventory.sql](../database/check_g10_1_inventory.sql) e execute somente esse arquivo. Ele contém **um único SELECT**, sem alterações de configuração, DDL, DML ou chamadas a funções da aplicação.
5. O resultado possui uma linha e a coluna **`g10_1_inventory`**. Use a opção de exportação do resultado disponível no painel ou copie o JSON completo dessa célula. Se o painel oferecer apenas CSV, exporte o CSV; a célula contém o mesmo JSON.
6. Guarde o arquivo em local privado e envie o resultado para comparação. Não o publique no GitHub. Se houver erro ou truncamento, envie a mensagem e interrompa; não crie objetos, altere permissões ou remova proteções para fazer a consulta funcionar.

A consulta acessa catálogos de tabelas, colunas, funções, constraints, índices, RLS, triggers, grants, papéis, dependências e publicações. **Não lê linhas de pessoas, usuários Auth, cultos, escalas, eventos ou recibos.** Não lê corpos de mensagens, contatos, senhas, JWTs ou conteúdo do histórico de migrações. Definições são representadas por hashes; configurações não reconhecidas de funções têm o valor ocultado.

`transaction_read_only` informa o estado da sessão usada pelo painel. Pode aparecer `off` na execução normal: isso não transforma o SELECT em escrita. Nos testes locais, a mesma consulta foi exercitada dentro de uma transação PostgreSQL explicitamente `READ ONLY`, além da revisão que impede chamadas a RPCs e varreduras de dados de negócio.

Mesmo sem dados de negócio, o inventário contém identificadores técnicos internos; trate o arquivo como informação administrativa. O tamanho do resultado varia com os objetos existentes. Não enviar dump completo, arquivos `.env`, HAR, chaves, credenciais ou exportações de `auth.users`.

## Informações do painel que o SQL não comprova

Anote **somente metadados, opções e nomes**, sem alterar nada. O caminho exato pode variar na versão do painel:

| Área | Informar sem expor segredos |
| --- | --- |
| Projeto | Nome, referência e versão principal do PostgreSQL |
| Auth → URL Configuration | Site URL e Redirect URLs permitidas, sem parâmetros de recuperação/tokens |
| Auth → Sign In / Providers | Provedores habilitados; opções de e-mail, confirmação, cadastro e login anônimo |
| Auth → Security / Sessions | Política mínima de senha, expiração JWT e políticas de sessão disponíveis no plano; nunca a chave de assinatura |
| Auth → Emails / SMTP | Se SMTP está configurado e templates de recuperação personalizados; não copiar credenciais ou endereços pessoais |
| Auth → Hooks | Nomes/tipos dos hooks ativos, sem URL com segredo ou conteúdo privado |
| Edge Functions | Se `alias-login` e `access-assistance` existem; status/versão/data de implantação e opção de verificação JWT |
| Edge → Secrets | Apenas presença/ausência dos nomes listados no relatório de compatibilidade. Nunca os valores |
| API / Data API | Schemas expostos; schemas `iasdpi_*_private` não devem ser expostos |
| Database → Backups | Disponibilidade de backup, retenção/PITR e possibilidade de restauração em destino separado; não iniciar backup/restauração nesta etapa |

Se algum campo não estiver acessível, registre **não verificado**. Não criar conta de teste nem efetuar login de teste: a autenticação real será validada em etapa autorizada.

## Histórico de migrações

O inventário verifica se `supabase_migrations.schema_migrations` existe e lista somente suas colunas. **Não lê a coluna `statements`**, que pode conter SQL sensível. Se houver registros no painel de migrations, informe apenas versões/nomes e origem conhecida da aplicação. SQL executado manualmente pode não constar desse histórico. Um nome de tabela existente não prova que o arquivo correspondente foi executado, nem que sua definição atual esteja correta.

## O que acontece depois

Após receber o JSON/CSV e os metadados disponíveis, comparar a estrutura real com as referências revisadas, esclarecer divergências e classificar cada migração. Só então será preparado um plano específico para o estado observado. **Nenhum SQL de instalação definitivo está incluído nesta entrega.**
