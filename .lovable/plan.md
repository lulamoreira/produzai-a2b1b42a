## Diagnóstico

A loja **Quiosque Vitória** já foi excluída da lista mestre de lojas do cliente (`client_stores`), por isso não aparece mais na campanha base. Porém, ela continua presente **dentro do Ajuste** "Ajuste - 12/05/2026" da campanha **Inverno** porque o ajuste mantém um snapshot próprio das lojas e do rateio (independente do mestre):

- 1 linha em `campaign_adjustment_stores` (snapshot da loja, `is_deleted = false`) — por isso ela aparece na listagem do ajuste.
- 9 linhas em `campaign_adjustment_store_pieces` com quantidades (1, 1, 1, 1, 2, 1, 1, 2, 2) — por isso entra no rateio e soma no valor de produção do ajuste.

A loja original (`client_stores.id = 135028c8…`) não existe mais, então essas linhas estão órfãs.

## Correção (apenas dados, sem mudança de código)

Limpeza pontual nas tabelas do ajuste, escopo restrito a essa loja nesse ajuste:

1. `DELETE FROM campaign_adjustment_store_pieces` onde `adjustment_id = 172023cc-18e7-4b94-a1e5-119a8289b866` e `store_id = 135028c8-bd2d-49d4-882f-7929018ab6a6` → remove as 9 quantidades do rateio.
2. `DELETE FROM campaign_adjustment_stores` onde `id = 92957062-ad3c-4a11-bb68-18d95ed7cd9b` → remove a loja da listagem do ajuste.

Resultado: a loja some da listagem do ajuste, sai do rateio e deixa de contar no valor de produção. Nada mais é alterado (outras lojas, outras campanhas, outros ajustes e todo o restante permanecem intactos).

## Fora do escopo

- Não vou alterar nenhum código nem lógica de exclusão de lojas (você pediu para só corrigir esse problema).
- Se quiser, depois posso investigar por que a exclusão da loja mestre não propagou automaticamente para os ajustes — mas isso só se você confirmar.
