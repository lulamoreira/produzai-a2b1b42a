---
title: Corrigir função de clonagem de renegociação
description: Atualizar clone_campaign_for_renegotiation para incluir cronograma, links de vencedor e descontos.
---

## Problema
A função `clone_campaign_for_renegotiation` atual não está copiando dados críticos da campanha original para a nova versão de renegociação, resultando em perda de informações de cronograma, configurações de links de entrega e valores de desconto.

## Solução
Substituir a função SQL existente por uma versão aprimorada que garante a cópia idêntica dos seguintes módulos:
1. **Cronograma**: Inclusão da tabela `budget_timeline_entries`.
2. **Configurações de Vencedor**: Mapeamento dos campos `winner_book_url`, `winner_cc_email` e `winner_mockup_url` na tabela `budget_settings`.
3. **Custos Extras e Descontos**: Cópia dos campos `discount_value` e `adjusted_discount_value` na tabela `budget_extra_costs`.

## Detalhes Técnicos
- **Linguagem**: PL/pgSQL
- **Segurança**: `SECURITY DEFINER` para garantir acesso correto às tabelas durante o processo de clonagem.
- **Tabelas Afetadas**: `campaigns`, `budget_settings`, `budget_timeline_entries`, `budget_extra_costs` (além das tabelas de peças, kits e fornecedores já mapeadas).

## Plano de Ação
1. Executar migração SQL para atualizar a função `public.clone_campaign_for_renegotiation`.
2. Validar permissões de execução para a função atualizada.
