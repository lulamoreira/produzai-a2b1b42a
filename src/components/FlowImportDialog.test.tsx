import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FlowImportDialog } from "./FlowImportDialog";
import { parseFlowPieceName } from "@/lib/parseFlowWorkbook";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), invalidate: vi.fn(), ensureLocations: vi.fn(), close: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/ensureCampaignLocations", () => ({ ensureCampaignLocations: mocks.ensureLocations }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (field: string) => {
        const query = {
          eq: () => query, order: () => query,
          limit: async () => ({ data: [{ [field]: field === "code" ? (table === "campaign_kits" ? 70 : 36) : (table === "campaign_kits" ? 29 : 18) }], error: null }),
        };
        return query;
      },
      insert: (payload: Record<string, unknown>) => mocks.insert(table, payload),
    }),
  },
}));

describe("Flow confirmation writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("writes one kit, one component, quantity-one link then unchanged standalone piece, using max kit code", async () => {
    const kitSource = "LINDT_SUMMER_INT_PROMOTABLE_KIT_LATERAL_50x88cm";
    const normalSource = "LINDT_SUMMER_INT_ADESIVO_20x20cm";
    render(<FlowImportDialog open onOpenChange={mocks.close} campaignId="campaign" campaignName="Test" pieces={[
      { ...parseFlowPieceName(kitSource), sourceName: kitSource, imageUrls: [] },
      { ...parseFlowPieceName(normalSource), sourceName: normalSource, imageUrls: [] },
    ]} />);
    const confirm = screen.getByRole("button", { name: /^Importar$/ });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(false));
    expect(mocks.insert).toHaveBeenCalledTimes(4);
    const calls = mocks.insert.mock.calls;
    expect(calls[0]).toEqual(["campaign_kits", expect.objectContaining({ name: "KIT Promotable Lateral", code: 71, display_order: 30, image_url: null })]);
    expect(calls[1]).toEqual(["campaign_pieces", expect.objectContaining({ name: "Promotable Lateral", code: 72, display_order: 31, kit_only: true, size: "50×88" })]);
    expect(calls[2]).toEqual(["campaign_kit_pieces", { kit_id: calls[0][1].id, piece_id: calls[1][1].id, quantity: 1, display_order: 0 }]);
    expect(calls[3]).toEqual(["campaign_pieces", expect.objectContaining({ name: "Adesivo", code: 73, display_order: 32, kit_only: false })]);
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["campaign_kits"] });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["campaign_kit_pieces"] });
  });
});