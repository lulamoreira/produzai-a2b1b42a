# Revisão de Rateio por capacidade

- Levar os rótulos personalizados do cliente até a revisão e associar cada item ao campo mais específico pelo nome e localização.
- Comparar faltas somente entre lojas elegíveis, incluindo a capacidade de vitrine; manter os textos e o limiar atuais.
- Substituir a divergência simétrica de quantidade por “Quantidade abaixo da capacidade”: mínimo de quatro lojas com item e capacidade positiva, padrão presente em pelo menos 60% e alerta somente abaixo de 90% do esperado.
- Incluir o novo tipo no agrupamento da tela e do relatório, sem alterar as verificações 2, 3 e 4.
- Testar capacidades numéricas, booleanas e textuais, correspondência dos campos e limites proporcionais. Conferir a revisão em uma campanha real sem alterar dados.

## Detalhes técnicos

A análise continua em `reviewRateio`, com sexto argumento opcional para os rótulos. Não haverá IA, função remota ou gravação de quantidades.