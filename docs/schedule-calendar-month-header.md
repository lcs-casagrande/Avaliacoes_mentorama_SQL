# Faixa mensal no cabeçalho do calendário

- Branch: `feat/schedule-foundation-phase-a`.
- O responsável mensal aparece uma vez, acima dos dias da semana, em faixa de 28 px.
- A fonte existente identifica a função como **Ancião do Mês**. Não foi criada nem renomeada uma escala de diácono.
- Faixas semanais, filtros combinados, mudança de mês e detalhes por clique/teclado foram preservados.
- Nenhum dado, identificador ou período da agenda foi alterado. Nenhuma chamada ao Supabase, migração, publicação ou commit foi realizada nesta etapa.

## Arquivos desta alteração

- `frontend/agenda.js`: apresentação mensal no cabeçalho; somente faixas semanais entre as semanas.
- `frontend/styles.css`: faixa mensal compacta.
- `tests/test_schedule_calendar_compact.py`: expectativa mensal única e regressão de posição, altura, filtros e mudança de mês.

## Evidências

- `dist/schedule-month-header/tests.log`: testes direcionados do calendário.
- `dist/schedule-month-header/visual-check.json`: Chromium headless em 360, 390, 768, 1024 e 1440 px; faixa mensal única, 28 px, acima do cabeçalho e sem rolagem horizontal indevida.
- `dist/schedule-month-header/captures/`: capturas em cinco larguras.
- `dist/schedule-month-header/IASDPI-calendario-faixa-mensal.html`: prévia independente, sem conexão externa.

A suíte completa anterior não foi reexecutada neste ajuste localizado. Dispositivos físicos, Safari e Firefox não foram testados nesta etapa.

## Homologação

1. Abrir a prévia e selecionar outubro de 2026.
2. Confirmar uma única faixa “Ancião do Mês: Adriano Borrego”, acima de DOM–SÁB.
3. Abrir a faixa com clique ou Enter e conferir função e período completos.
4. Desativar Ancionato: a faixa deve desaparecer. Reativar e mudar para novembro: deve aparecer Elmo Carneiro.
