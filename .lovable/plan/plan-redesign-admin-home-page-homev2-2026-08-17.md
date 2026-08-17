# Plan: Redesign Admin Home Page (HomeV2)

Redesign the Administrator home page (`src/pages/v2/HomeV2.tsx`) to follow the Design System v2.0 while adding favorites, real-time notifications, and enhanced campaign management.

## Technical Details

- **Favorites Section**: Uses `useCampaignFavorites` to display favorited campaigns as cards at the top.
- **Notification Feed**: Replaces "Recent Activity" with a list from `useNotifications`. Items navigate via `action_url` and mark as read on click.
- **Enhanced Campaign Cards**:
    - Full card links to campaign details.
    - **Star Toggle**: Uses `useToggleFavorite` for favoriting.
    - **Active Switch**: Admin/Master only. Uses `useUpdateCampaign` with an **AlertDialog** confirmation gate (Title: "Inativar campanha?" / "Reativar Campanha").
- **Design**: Earthy palette (#8C6F4E) with minimalist layouts.
- **State Management**: Invalidates `v2-dashboard-data`, `v2-recent-campaigns`, and `campaign_favorites` on changes to ensure zero-reload updates.

## User Review Required

> [!IMPORTANT]
> This is a frontend-only change. No database migrations or schema changes are involved.

- Confirm the "Recent Activity" removal is acceptable (replaced by real-time notifications).
- Verify that the Star/Switch placement on campaign cards meets UX expectations.

## Proposed Changes

### `src/pages/v2/HomeV2.tsx`

- Add `useCampaignFavorites`, `useToggleFavorite`, `useFavoriteIds`, `useNotifications`, and `useUpdateCampaign` hooks.
- Implement `FavoritesSection` component.
- Implement `NotificationsFeed` component (replacing `RecentActivity`).
- Implement `CampaignCard` with link, star, and switch (wrapped in `AlertDialog`).
- Ensure responsive grid layouts.

