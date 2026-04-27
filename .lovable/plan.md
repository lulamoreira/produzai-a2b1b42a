## Objetivo

Permitir que **Admin** e **Master** (Global ou de Cliente com acesso) excluam qualquer loja do cadastro do cliente, com diálogo de confirmação que mostra **exatamente** o que será apagado em cascata.

## Importante: o que será apagado junto

A loja no banco já tem `ON DELETE CASCADE` configurado em várias tabelas. Por isso, ao excluir uma loja, são removidos automaticamente:

- Quantidades de peças por loja (Rateio) em todas as campanhas
- Status da loja por campanha
- Ocorrências da loja
- Agendamentos e histórico de agendamento
- Fotos de instalação
- Logs de acesso de instalação
- Contatos da loja
- Registros do Loja a Loja, portal da loja, tokens, conformidade, manutenção, reposição
- Notificações ligadas (mantidas, com store_id zerado)

> Não é possível "apagar só a loja e o Rateio" mantendo o resto órfão sem alterar o esquema do banco. Por isso o diálogo vai **listar a contagem de cada item** e exigir confirmação dupla.

## O que será feito

**1. Botão "Excluir loja" no diálogo "Editar Loja"** (`ClientDetail.tsx`)
- Aparece em vermelho, no rodapé do formulário, ao lado do "Salvar Alterações"
- Visível apenas para Admin / Master

**2. Diálogo de confirmação dedicado**
- Título: "Excluir loja **[Nome]**?"
- Lista com contagem do que será apagado:
  - X registros de Rateio (quantidades de peças)
  - Y ocorrências
  - Z agendamentos
  - N fotos de instalação
  - M contatos
  - K registros de Loja a Loja / portal
- Campo de texto: digitar o nome da loja para liberar o botão
- Botão final: "Excluir definitivamente"

**3. Permissão**
- Reutiliza o helper `useUserRole` e checa: `role === 'admin'` ou `role === 'master'`
- Não usa `can_delete_stores` do permission_categories (esse é para perfis Editor/Viewer)

**4. Reaproveita o hook existente**
- `useDeleteClientStore` em `src/hooks/useMultiClientData.ts` já faz o DELETE; nada novo no banco
- Após sucesso: invalida queries, fecha diálogos, toast "Loja removida"

## Arquivos alterados

- `src/pages/ClientDetail.tsx` — adiciona botão + AlertDialog de confirmação dentro do diálogo "Editar Loja"
- Novo componente `src/components/DeleteStoreDialog.tsx` — encapsula a contagem prévia (queries paralelas) e a confirmação por digitação

## Sem mudanças no banco

Nenhuma migração — o cascade já existe e o hook já existe. Só UI + permissão.

## Como reverter

Se algo der errado, use o histórico de versões:

<lov-actions>
  <lov-open-history>Ver histórico</lov-open-history>
</lov-actions>