

## Tornar o breadcrumb clicável (Cliente e Campanha)

Atualmente, no breadcrumb "Vimer Retail Experience › Lindt Chile › Pralinas" exibido no topo da campanha:

- **"Pralinas"** (nome da campanha) é apenas texto em negrito e não navega para lugar nenhum.
- **"Lindt Chile"** (nome do cliente) só é clicável quando há uma sub-seção aberta (Instalações, Agendamento, etc.). Na tela inicial da campanha, ele também fica inerte.

A correção transformará ambos em links funcionais.

### Comportamento esperado

| Item clicado | Destino |
|--------------|---------|
| Nome da agência (ex.: Vimer Retail Experience) | Tela de Agências (`/`) — já funciona |
| Nome do cliente (ex.: Lindt Chile) | Página do cliente com a lista de campanhas (`/agency/:agencyId/clients/:clientId`) |
| Nome da campanha (ex.: Pralinas) | Hub principal da campanha (volta para a tela inicial sem sub-seção, removendo `?section=...`) |
| Nome da sub-seção atual (quando houver) | Permanece como rótulo final, sem link |

### Detalhes técnicos

1. **`src/pages/CampaignDetail.tsx`** (geração do array de breadcrumbs, linhas ~972–989):
   - Sempre atribuir `href` para o item do **cliente**, independente de haver `activeSection` (apenas continua bloqueado em `isLimitedMode`).
   - Sempre atribuir `href` para o item da **campanha** apontando para `/agency/${agencyId}/clients/${clientId}/campaigns/${campaignId}`. Quando o usuário já está no hub (sem `activeSection`), clicar nesse link não fará nada visível, mas também não quebra; quando houver uma seção aberta, o clique remove o `?section=...` e volta ao hub.

2. **`src/components/AppLayout.tsx`** (renderização do breadcrumb, linhas ~197–204):
   - O último item do breadcrumb é renderizado como texto em negrito não clicável (linha 200–202). Vamos torná-lo clicável quando ele tiver `href` definido — usando um `<button>` com o mesmo estilo bold atual, que dispara `navigate(crumb.href)`.
   - Isso faz com que o nome da campanha (último item no hub da campanha) e o nome da sub-seção (quando aplicável) respeitem o `href`. Itens sem `href` continuam como texto puro.

3. Nenhuma alteração é necessária em rotas, permissões ou lógica de carregamento — as rotas de destino (`ClientDetail` e `CampaignDetail`) já existem e funcionam.

### Restrições preservadas

- Em `isLimitedMode` (usuários com acesso restrito a uma única campanha) os links de Agência, Cliente e Campanha continuam desabilitados, como hoje.
- Estilo visual (tipografia, cores, negrito, truncamento) permanece idêntico — apenas a interatividade é adicionada.

