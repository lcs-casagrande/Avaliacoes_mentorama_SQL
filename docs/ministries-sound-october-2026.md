# Ministérios e escala de Sonoplastia — Outubro de 2026

Implementação preparada em 25/10/2026, sem commit ou publicação.

## Armazenamento e preservação

- Organograma: `frontend/organization.js`. Vínculos de acompanhamento pelos nove
  anciãos permanecem na estrutura original; um cadastro de responsáveis enriquece
  esses mesmos departamentos, sem repetir cards dos ministérios.
- Escalas manuais: `frontend/agenda.js`, no objeto existente `ministrySchedules`.
  Sonoplastia substitui a lista vazia; nenhum registro é acrescentado durante renderização.
- Agenda oficial: `frontend/agenda-data.js`, preservada integralmente. Comunicação,
  escalas de anciãos e mecanismo de sincronização permanecem independentes.
- Nenhuma tabela, migração, política RLS, usuário ou permissão Supabase foi criada
  ou alterada. Nomes do organograma não são contas Auth nem concessões de acesso.
- Pastor Luciano e os nove anciãos foram preservados. Os três departamentos fora
  da atualização (Tesouraria, Secretaria e Ministério Recuperação) continuam presentes,
  sem responsáveis inventados. Por isso são 29 entradas visíveis: 26 informadas + 3 preservadas.
- Ancionato mantém a grafia enviada e responsável não informado. A lista existente
  de anciãos foi mantida, sem presumir que algum deles coordena esse departamento.
- Diaconato é apresentado como duas entradas sob o mesmo acompanhamento anterior.
  Nomes antigos dos departamentos são reconhecidos na pesquisa; os títulos exibidos
  usam os nomes padronizados da solicitação.

## Ministérios cadastrados

| Ministério / departamento | Responsável |
| --- | --- |
| Diaconato — Diaconisas | Rose |
| Diaconato — Diáconos | Marciano |
| Ancionato | Não informado |
| Ministério da Criança | Luciana Abdias |
| Ministério dos Adolescentes | Taislane |
| Comunicação | Henrique |
| Ministério da Família | Luana e Raphael |
| Ministério da Saúde | Simone Cristina |
| Ministério de Publicações | Glaucia |
| Ministério da Música | Alexandre |
| Escola Sabatina | Renato |
| Mordomia Cristã | Samuel |
| Ministério Pessoal | Rosana |
| Ação Solidária Adventista (ASA) | João Pedro |
| Ministério Adventista das Possibilidades | João Pedro |
| Liberdade Religiosa | João Pedro |
| Ministério da Mulher | Gislaine |
| Recepção | Nilce |
| Ministério Jovem | Cauê |
| Clube de Desbravadores | Victoria |
| Clube de Aventureiros | Valeska |
| Terceira Idade | Sandra |
| Sonoplastia | Luan |
| Patrimônio | Sérgio |
| Ministério dos Homens | Paulo Scarpelini |
| Gol da Esperança | Nelson |

Os responsáveis são armazenados como listas, permitindo dois ou mais nomes no mesmo
ministério. O responsável do ministério é identificado separadamente do ancião de
acompanhamento e da pessoa escalada em uma data. Exemplo: Sonoplastia tem Luan como
responsável, com a escala abaixo incluindo outras pessoas.

## Escala de Sonoplastia — Outubro de 2026

Origem: escala manual fornecida pela liderança. Não há sincronização automática.
Última atualização do documento original: não informada. Vigência: 03/10 a 04/11/2026.

| Data | Dia da semana | Responsável pela atividade |
| --- | --- | --- |
| 03/10/2026 | Sábado | Mini Lucas |
| 04/10/2026 | Domingo | Rafa |
| 07/10/2026 | Quarta-feira | Samuel |
| 10/10/2026 | Sábado | Luan |
| 11/10/2026 | Domingo | Macedo |
| 14/10/2026 | Quarta-feira | Paulitos |
| 17/10/2026 | Sábado | Mini Lucas |
| 18/10/2026 | Domingo | Raphael |
| 21/10/2026 | Quarta-feira | Luan |
| 24/10/2026 | Sábado | Mini Lucas |
| 25/10/2026 | Domingo | Rafa |
| 28/10/2026 | Quarta-feira | Luan |
| 31/10/2026 | Sábado | Raphael |
| 01/11/2026 | Domingo | Raphael |
| 04/11/2026 | Quarta-feira | Paulitos |

**Em caso de impedimento, avisar antecipadamente no grupo responsável.**

Há 15 registros no documento: 13 em outubro e dois em novembro, conforme informado.
Datas, grafia e nomes foram preservados; nenhum contato telefônico foi incluído.
A referência utilizada foi a tabela textual da solicitação. Não havia uma nova
imagem acessível para comparação independente.

## Consulta e apresentação

1. Organograma: pesquisar ministério ou responsável, com ou sem acentos; Limpar
   pesquisa restaura os grupos. Busca é pública, mantém foco e não altera registros.
2. Escalas e agendas: em **Consultar**, escolher **Escala de Sonoplastia**. Usar
   **Mês e ano** para 10/2026 ou 11/2026. O título identifica o documento original
   de outubro; a lista e o calendário respeitam o mês selecionado.
3. A lista mostra data, dia da semana, ministério e pessoa escalada. O checkbox de
   nomes e as visualizações Lista/Calendário existentes foram preservados.
4. Para retornar aos compromissos oficiais, selecionar **Agenda da igreja**. Os
   eventos oficiais não foram substituídos nem misturados à escala manual.

## Validação e prévia

Há 22 testes específicos em `tests/test_ministries_sound_schedule.py`, além da
suíte anterior de 377 casos. O teste anterior da escala vazia continua existindo:
apenas seu cenário recebe explicitamente uma lista vazia temporária.

Evidências da execução completa, capturas e relatório ficam em
`dist/ministerios-sonoplastia/`. A prévia HTML independente é gerada com:

```sh
python -B scripts/export_preview.py --read-only --output dist/ministerios-sonoplastia/IASDPI-previa-ministerios-sonoplastia.html
```

A prévia bloqueia gravações remotas e serve à revisão visual. Não comprova login/RLS
real. Os testes de navegador usam perfis/dados fictícios e não modificam produção.
Dispositivos físicos não disponíveis permanecem como validação manual recomendada.

## Próxima publicação e rollback

O site público não foi atualizado nesta tarefa. A candidata e a prévia são locais.
Os pacotes homologados anteriormente permanecem intactos. Foram guardadas cópias
anteriores dos arquivos desta atualização e um inventário de hashes, sem commit.
Antes de publicar após aprovação, incorporar a agenda oficial mais recente, conferir
main e regenerar o pacote/manifesto com o commit final. Usar o procedimento de
`docs/final-release-preparation.md`; não limpar localStorage, IndexedDB ou Supabase.
