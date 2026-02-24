

## Plano: Localizacoes de Pecas e Modelo "Outras"

### O que sera feito

1. **Modelo "Outras" sempre presente**: No dropdown "Modelo de Loja" do formulario de pecas, alem dos modelos cadastrados nas lojas do cliente, sempre incluir uma opcao "Outras" no final da lista.

2. **Cadastro de Localizacoes**: Criar um botao na aba Pecas para gerenciar localizacoes de pecas (CRUD). As localizacoes cadastradas serao armazenadas em uma nova tabela no banco de dados, vinculadas a campanha.

3. **Dropdown de Localizacao**: O campo "Localizacao na Loja" (atualmente um input de texto livre) sera convertido em um menu suspenso (Select/dropdown) populado com as localizacoes cadastradas.

---

### Detalhes Tecnicos

**1. Nova tabela `campaign_piece_locations`**

Criacao via migracao SQL:

```text
- id: uuid (PK, default gen_random_uuid())
- campaign_id: uuid (FK para campaigns, NOT NULL)
- name: text (NOT NULL)
- created_at: timestamptz (default now())
```

Politicas RLS seguindo o mesmo padrao das demais tabelas de campanha (SELECT/INSERT/UPDATE/DELETE verificando `has_client_access` / `has_client_edit_access` via campaigns).

**2. Botao "Gerenciar Localizacoes" na aba Pecas**

- Novo botao ao lado dos demais (Exportar, Revisar Codigos, Importar, Nova Peca)
- Abre um Dialog com:
  - Lista das localizacoes cadastradas para a campanha
  - Input + botao para adicionar nova localizacao
  - Botao de excluir em cada localizacao existente

**3. Hooks de dados**

No arquivo `src/hooks/useMultiClientData.ts`, adicionar:
- `useCampaignPieceLocations(campaignId)` - busca localizacoes
- `useAddCampaignPieceLocation()` - adiciona localizacao
- `useDeleteCampaignPieceLocation()` - remove localizacao

**4. Campo "Localizacao na Loja" como dropdown**

Na funcao `renderPieceFormFields`:
- Substituir o `<Input>` do campo "Localizacao na Loja" por um `<Select>` populado com as localizacoes da tabela `campaign_piece_locations`
- Manter fallback para input de texto caso nenhuma localizacao esteja cadastrada

**5. Modelo "Outras" no dropdown de Modelo de Loja**

Na funcao `renderPieceFormFields`:
- Ao renderizar o dropdown de "Modelo de Loja", adicionar `<SelectItem value="Outras">Outras</SelectItem>` como ultimo item, caso "Outras" nao ja exista na lista de modelos

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| Nova migracao SQL | Criar tabela `campaign_piece_locations` + RLS |
| `src/hooks/useMultiClientData.ts` | Adicionar hooks para localizacoes |
| `src/pages/CampaignDetail.tsx` | Botao de gerenciar localizacoes, dropdown no campo localizacao, "Outras" no modelo de loja |

