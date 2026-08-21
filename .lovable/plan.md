# Plano de Implementação - Fase 2: Desconto do Fornecedor no Portal

Este plano detalha a implementação da Fase 2 do recurso de descontos, permitindo que os fornecedores insiram descontos diretamente via portal em campanhas de renegociação.

## Alterações Técnicas

### 1. Banco de Dados (Migração SQL)
Recriação das funções RPC para incluir a lógica de renegociação e suporte ao campo de desconto:
- `get_supplier_portal_budget`: Agora retorna `is_renegotiation` baseado no `origin_label` da campanha.
- `supplier_portal_save_extra_costs`: Atualizada para permitir a gravação de `discount_value` (e `adjusted_discount_value` em modo negociação).

### 2. Frontend: Portal do Fornecedor (`src/pages/SupplierPortal.tsx`)
- **Estado e Tipos**: Adição dos campos `discount_value` e `adjusted_discount_value` à interface `ExtraCosts` e ao estado inicial.
- **Carregamento de Dados**: Mapeamento do novo campo `is_renegotiation` vindo do RPC e inicialização dos valores de desconto (considerando o status de negociação para usar valores ajustados).
- **Interface (UI)**:
  - Adição de um novo input "Desconto (R$)" na seção de custos extras.
  - O campo será exibido apenas se `is_renegotiation` for verdadeiro.
  - Implementação de persistência automática (onBlur) para o desconto.
- **Cálculos e Resumo**:
  - Atualização da lógica do `grandTotal` para subtrair o desconto.
  - Inclusão de uma linha de "Desconto" no resumo financeiro quando aplicável.
- **Exportação e Submissão**: Inclusão do desconto no payload de submissão e no resumo final.

## Segurança
- Uso de `SECURITY DEFINER` nas funções RPC para permitir que fornecedores anônimos (via token) realizem gravações restritas sem vazar outros dados sensíveis.
- Validação rigorosa dos campos permitidos (`installation_value`, `freight_value`, `discount_value`).

---
### 📊 Relatório de Execução

**Padrão utilizado:** RPC-Driven Portal Extension

**Sub-agentes ativados:**
- 🎨 **UI Architect** — ✅ Executado
- 🗄️ **Supabase Engineer** — ✅ Executado
- 🔍 **Code Auditor** — ✅ Executado
- 🧪 **Testing Agent** — ➖ Não necessário
- 📈 **SEO Optimizer** — ➖ Não necessário
- 🚀 **Deploy Ops** — ➖ Não necessário
- 🔌 **API Integrator** — ➖ Não necessário
