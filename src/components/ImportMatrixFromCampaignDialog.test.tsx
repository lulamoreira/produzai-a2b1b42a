import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignPiece, ClientStore } from "@/hooks/useMultiClientData";
import ImportMatrixFromCampaignDialog from "./ImportMatrixFromCampaignDialog";

const mocks = vi.hoisted(() => ({ import: vi.fn(), close: vi.fn(), current: [] as { store_id: string; piece_id: string; quantity: number }[] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/PieceThumbnail", () => ({ default: () => null }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => <option value="">Selecionar</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => <option value={value} disabled={disabled}>{typeof children === "string" ? children : value}</option>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: async (name: string) => ({ error: null, data: name === "get_client_campaigns_for_import" ? [{ id: "source", name: "Origem" }] : {
    pieces: [{ id: "11111111-1111-1111-1111-111111111111", name: "Painel Lateral", code: 1 }],
    kits: [{ id: "22222222-2222-2222-2222-222222222222", name: "Painel", code: 2 }],
    kit_pieces: [{ kit_id: "22222222-2222-2222-2222-222222222222", piece_id: "11111111-1111-1111-1111-111111111111", quantity: 1 }],
    store_pieces: [
      { store_id: "s1", piece_id: "11111111-1111-1111-1111-111111111111", quantity: 8 },
      { store_id: "s2", piece_id: "11111111-1111-1111-1111-111111111111", quantity: 9 },
      { store_id: "outside", piece_id: "11111111-1111-1111-1111-111111111111", quantity: 99 },
    ],
  } }),
  from: (table: string) => {
    const query = { select: () => query, eq: () => query, order: () => query,
      range: async () => ({ data: table === "campaign_pieces" ? [{ id: "target", name: "Painel Lateral", code: 3 }] : mocks.current, error: null, count: table === "campaign_pieces" ? 1 : mocks.current.length }),
    };
    return query;
  },
} }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ImportMatrixFromCampaignDialog open onOpenChange={mocks.close} clientId="client" currentCampaignId="target-campaign" currentPieces={[] as CampaignPiece[]} currentKits={[]} currentStores={[
    { id: "s1", name: "Loja 1" }, { id: "s2", name: "Loja 2" }, { id: "new", name: "Loja Nova" },
  ] as ClientStore[]} onImport={mocks.import} /></QueryClientProvider>);
  return client;
}

describe("matrix quantity confirmation", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.current = []; mocks.import.mockResolvedValue(undefined); });
  afterEach(cleanup);

  it("auto-maps a missing kit-only target, rereads current values and imports only empty current-store cells", async () => {
    setup();
    await screen.findByRole("option", { name: "Origem" });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "source" } });
    await waitFor(() => expect(screen.getAllByRole("combobox")[2]).toHaveValue("target"));
    expect(screen.getByRole("alert")).toHaveTextContent("1 loja(s) sem referência — preencher à mão: Loja Nova");
    // A manual value appears after the dialog was opened.
    mocks.current = [{ store_id: "s1", piece_id: "target", quantity: 4 }];
    fireEvent.click(screen.getByRole("button", { name: "Pré-preencher rateio" }));
    await waitFor(() => expect(mocks.import).toHaveBeenCalledWith([{ storeId: "s2", pieceId: "target", quantity: 9 }]));
    expect(mocks.close).toHaveBeenCalledWith(false);
  });

  it("does not restore a manually cleared association when data refetches", async () => {
    const client = setup();
    await screen.findByRole("option", { name: "Origem" });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "source" } });
    await waitFor(() => expect(screen.getAllByRole("combobox")[2]).toHaveValue("target"));
    fireEvent.click(screen.getByRole("button", { name: "Limpar associação de Painel Lateral" }));
    await client.invalidateQueries({ queryKey: ["import-matrix-data-rpc", "source"] });
    expect(screen.getAllByRole("combobox")[2]).toHaveValue("");
    expect(screen.getByRole("button", { name: "Pré-preencher rateio" })).toBeDisabled();
  });
});