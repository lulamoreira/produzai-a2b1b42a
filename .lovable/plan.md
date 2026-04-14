

# Phase 2 — Module Registration & Routing

## Changes (6 files + 1 component update)

### 1. i18n — 3 files
Add `"loja_a_loja"` key to `modules` object:
- **pt-BR.json** line 157: add `"loja_a_loja": "Loja a Loja"` before closing brace
- **en.json** line 157: add `"loja_a_loja": "Store by Store"`
- **es.json** line 157: add `"loja_a_loja": "Tienda a Tienda"`

### 2. ModuleGrid.tsx — Add `badge` support
The `ModuleItem` interface currently has no `badge` field. Add optional `badge?: string` to the interface and render it as a small pill below the label when present. Also add `loja_a_loja` to `MODULE_COLORS`.

### 3. AppSidebar.tsx
- Add `LayoutGrid` to lucide imports (line 24)
- Add entry after `history` in `CAMPAIGN_MODULE_KEYS` (line 36):
  ```ts
  { key: "loja_a_loja", tKey: "modules.loja_a_loja", icon: LayoutGrid, color: "#5B7B5E" }
  ```
- Line 400: also exclude `loja_a_loja` for limited users (`mod.key === "loja_a_loja"`)
- Line 477: hide `loja_a_loja` when `!isAdmin` (same as budgets)

### 4. CampaignDetail.tsx
- Add `LayoutGrid` to lucide imports (line 43)
- Add to ModuleGrid items after `history` (line 1023):
  ```ts
  { key: "loja_a_loja", label: t("modules.loja_a_loja"), icon: LayoutGrid, visible: isAdmin, color: "#5B7B5E", badge: "Beta" }
  ```
- Add placeholder section after history section (after line 2450):
  ```tsx
  {activeSection === "loja_a_loja" && (
    <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
      <LayoutGrid className="w-5 h-5" />
      <span>{t("modules.loja_a_loja")} — Em desenvolvimento</span>
      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">Beta</span>
    </div>
  )}
  ```

### 5. usePermissionCategories.ts
Add two fields before `created_at` (line 35):
```ts
can_view_loja_a_loja: boolean;
can_edit_loja_a_loja: boolean;
```

### 6. useClientPermission.ts
Add to PermissionKey union (line 18):
```ts
| "can_view_loja_a_loja" | "can_edit_loja_a_loja"
```

### Build verification
Confirm zero TypeScript errors after all changes.

