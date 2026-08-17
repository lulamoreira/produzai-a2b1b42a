# Plano de Redesign da HomeV2

Redesenhar a página inicial do Administrador (`HomeV2.tsx`) para incluir favoritos, notificações em tempo real e controles avançados de campanha.

## Mudanças Propostas

### UI / UX
- **Grade de Favoritos**: Adicionar uma seção no topo com os "quadrinhos" das campanhas favoritadas pelo usuário.
- **Substituição de Atividade Recente**: Remover o bloco de "Atividade Recente" e substituí-lo por uma lista de "Notificações" (usando o conteúdo do sininho), permitindo navegação direta para o assunto da notificação.
- **Cards de Campanhas Recentes**:
    - Transformar o card inteiro em um link clicável para a campanha.
    - Adicionar um botão de estrela para favoritar/desfavoritar.
    - Adicionar um switch ou botão para ativar/desativar a campanha (apenas administradores/masters).

### Técnico
- **Hooks**: Integrar `useCampaignFavorites`, `useToggleFavorite`, `useNotifications` e `useUpdateCampaign`.
- **Componentes**: Criar/Ajustar sub-componentes para os novos cards de campanha que suportem as ações de favoritar e mudar status.
- **Layout**: Manter a estética minimalista e terrosa do sistema (Design System v2.0).

## Detalhes Técnicos
- Utilizar `useCampaignFavorites` para popular a nova seção de topo.
- Utilizar `useNotifications` para a lista lateral de notificações.
- Implementar as mutações de `useToggleFavorite` e `useUpdateCampaign` nos cards de campanhas recentes.
- Garantir que o link das notificações funcione corretamente usando `action_url` ou metadados da notificação.
