# Montagem direta por dia — B1.2

Branch: `feat/schedule-management-b1`. Sem commit, publicação ou acesso ao Supabase.

- A prévia simplificada abre o próximo mês com datas e vagas vazias. Não cria atribuições publicadas.
- Uma participação geral por evento elimina a etapa de cadastrar/adicionar função. Funções específicas e registros antigos continuam preservados.
- A lista de pessoas está em cada dia; no celular, a montagem usa uma lista de datas para manter os nomes legíveis. O calendário público não mudou.
- O botão **Preencher automaticamente** gera uma proposta editável. Se necessário, prepara as datas futuras antes de sugerir. Salvar e publicar continuam separados.
- Sem restrição informada, a política considera disponibilidade padrão. Não são criadas linhas de disponibilidade confirmada para simular essa política.
- Disponibilidade e limites orientam o automático; escolhas manuais fora das preferências recebem aviso. Pessoas inativas, ausência de vínculo, funções técnicas sem habilitação e conflitos confirmados entre departamentos continuam bloqueados.
- As datas indisponíveis e limites existentes não são apagados. A auditoria registra gravações manuais fora das preferências.

## Ativação operacional — pendente de autorização

Revisar `database/010_simple_daily_schedules.sql`, depois de 001–009. **Não foi executada em produção.**
A 010 acrescenta um marcador de participação geral à tabela de funções, uma RPC protegida para obter/criar essa participação e atualiza a política de disponibilidade/validação. Mantém RLS, ACLs, locks, versões e gravações idempotentes. Não altera cultos, pessoas, disponibilidades ou atribuições existentes durante a instalação.

A participação geral exige vínculo ativo; não equivale à confirmação de uma habilitação técnica. A RPC genérica não pode transformar funções técnicas em gerais. A autorização continua sendo administrador ou gestor explicitamente autorizado ao departamento.

O frontend ativa a montagem simplificada somente quando o backend anuncia o contrato da 010. Com 005–009 permanece no contrato anterior. A demonstração fornece o novo contrato exclusivamente em memória.

## Homologação e rollback

Prévia: `python scripts/export_preview.py --simplified-daily --output CAMINHO_NOVO.html`.

Testar: preencher automaticamente; trocar pessoa no dia; marcar uma indisponibilidade; verificar exclusão no automático e aviso na escolha manual; salvar/reabrir; verificar conflito entre departamentos.

Os testes PostgreSQL usam bancos exclusivos em um container `--network none`. Evidências em `dist/schedule-simple-daily/`: regressão de navegador, testes novos, regressão da 009, testes da 010 e capturas desktop/mobile.

As prévias anteriores não foram sobrescritas. Para voltar a uma demonstração anterior, abrir o HTML anterior; nenhum banco foi alterado. A migração preserva as funções anteriores em schema privado para revisão. Depois de aceitar participações gerais ou escolhas fora de preferências, **não reverter o banco automaticamente**: o contrato da 009 poderá rejeitar esses registros. Qualquer reversão operacional exige inventário e revisão, preservando as atribuições existentes.
