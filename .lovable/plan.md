

## Plano: adicionar cards de clientes na tela "Meu Acesso"

### Objetivo
Para usuários restritos (acesso só a campanhas), mostrar **uma seção de clientes acessíveis** acima da seção atual de campanhas. Cada card de cliente leva à página do cliente (`/agency/:agencyId/clients/:clientId`), onde o usuário verá apenas as campanhas permitidas pela RLS.

### Validação técnica (concluída)
- `ClientDetail` não bloqueia usuário restrito — apenas exige login.
- `useCampaigns(clientId)` lê de `campaigns` filtrando por `client_id`. A RLS via `has_campaign_access` garante que usuário restrito só veja as campanhas a que tem acesso direto.
- `useUserDirectAccess` já retorna `clientId`, `clientName` e `agencyId` em cada `CampaignAccess` — podemos derivar a lista de clientes únicos sem fetch adicional.

### Nova estrutura da tela `MeuAcesso.tsx`

```text
┌─ Header: "Meu Acesso" ─────────────────────────┐
│                                                │
├─ ⭐ Favoritos (se houver) ────────────────────┤
│   [card campanha] [card campanha] ...          │
│                                                │
├─ ─────────── divisor ─────────                │
│                                                │
├─ 🏢 Meus Clientes (NOVO) ─────────────────────┤
│   [card cliente] [card cliente] ...            │
│   → onClick: /agency/:a/clients/:c             │
│                                                │
├─ ─────────── divisor ─────────                │
│                                                │
├─ 💼 Minhas Campanhas (existente) ─────────────┤
│   Cliente A                                    │
│     [card camp] [card camp]                    │
│   Cliente B                                    │
│     [card camp]                                │
└────────────────────────────────────────────────┘
```

### Implementação (arquivo único: `src/pages/MeuAcesso.tsx`)

1. **Derivar lista única de clientes** a partir de `directCampaigns`:
   ```ts
   const uniqueClients = Array.from(
     new Map(directCampaigns.map(c => [c.clientId, {
       clientId: c.clientId,
       clientName: c.clientName,
       agencyId: c.agencyId,
       campaignCount: 0,
     }])).values()
   );
   // contar campanhas por cliente
   directCampaigns.forEach(c => {
     const entry = uniqueClients.find(u => u.clientId === c.clientId);
     if (entry) entry.campaignCount++;
   });
   uniqueClients.sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));
   ```

2. **Adicionar nova seção "Meus Clientes"** entre Favoritos e Minhas Campanhas:
   - Ícone `Building2` + título `t("meuAcesso.myClients", "Meus Clientes")`
   - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`
   - Cada card:
     - Mesmo estilo dos cards existentes (`card-base`, borda lateral colorida `#6366f1`)
     - Avatar inicial do nome do cliente
     - Nome do cliente (h3)
     - Subtexto: `"{campaignCount} campanha(s)"`
     - "Acessar →" no canto inferior
   - `onClick`: `navigate(/agency/${agencyId}/clients/${clientId})`

3. **Divisores condicionais**:
   - Entre Favoritos e Clientes: se ambos existirem
   - Entre Clientes e Campanhas: se ambos existirem
   - Manter o atual entre Favoritos e Campanhas só se Clientes não aparecer

4. **Empty state** atualizado: texto se mantém quando nem favoritos nem campanhas existem (clientes derivam de campanhas, então mesma condição).

5. **Imports**: adicionar `Building2` ao import do lucide-react.

### Sem mudanças em
- `useUserDirectAccess.ts` (já fornece tudo)
- `ClientDetail.tsx` (RLS já filtra campanhas)
- Rotas, RLS, banco
- `Favorites.tsx`, `App.tsx`, `AppSidebar.tsx`

### Teste pós-implementação
- Login restrito com 2 campanhas em clientes diferentes → ver 2 cards de cliente + 2 cards de campanha agrupados
- Clicar em card de cliente → entrar em ClientDetail e ver só as campanhas permitidas
- Login restrito com 1 favorito + 1 campanha → ver favorito, 1 card de cliente, 1 card de campanha
- Login restrito sem nada → empty state inalterado

