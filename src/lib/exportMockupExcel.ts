import ExcelJS from "exceljs";
import { computeKitRolledUpStatus, type CampaignMockup, type MockupStatus } from "@/hooks/useMockups";
import { buildExportFileName } from "@/lib/exportFileName";

const STATUS_LABEL: Record<MockupStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
  changes_requested: "Com alterações",
};

const STATUS_FILL: Record<MockupStatus, string> = {
  pending: "FFE5E7EB",
  approved: "FFD1FAE5",
  rejected: "FFFEE2E2",
  changes_requested: "FFFEF3C7",
};

const STATUS_FONT: Record<MockupStatus, string> = {
  pending: "FF374151",
  approved: "FF065F46",
  rejected: "FF991B1B",
  changes_requested: "FF92400E",
};

const DARK = "FF4A2C2A";
const RED = "FFC53030";

interface Params {
  campaignName: string;
  mockups: CampaignMockup[];
  pieces: any[];
  kits: any[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

export async function exportMockupExcel(params: Params): Promise<{ blob: Blob; fileName: string }> {
  const { campaignName, mockups, pieces, kits } = params;

  const piecesById = new Map<string, any>();
  pieces.forEach((p) => piecesById.set(p.id, p));
  const kitsById = new Map<string, any>();
  kits.forEach((k) => kitsById.set(k.id, k));

  const componentsByParent = new Map<string, CampaignMockup[]>();
  mockups.forEach((m) => {
    if (m.parent_mockup_id) {
      const arr = componentsByParent.get(m.parent_mockup_id) || [];
      arr.push(m);
      componentsByParent.set(m.parent_mockup_id, arr);
    }
  });
  for (const [k, v] of componentsByParent) {
    v.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    componentsByParent.set(k, v);
  }

  const topLevel = mockups.filter((m) => !m.parent_mockup_id);

  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";
  wb.created = new Date();

  const ws = wb.addWorksheet("Mockup");

  const headers = [
    "Código",
    "Tipo",
    "Nome original",
    "Nome proposto",
    "Tamanho original",
    "Tamanho proposto",
    "Especificação original",
    "Especificação proposta",
    "Instalação original",
    "Instalação proposta",
    "Status",
    "Anotação",
    "Observações",
    "Revisado em",
  ];

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 30 },
    { width: 30 },
    { width: 18 },
    { width: 18 },
    { width: 30 },
    { width: 30 },
    { width: 30 },
    { width: 30 },
    { width: 18 },
    { width: 12 },
    { width: 40 },
    { width: 20 },
  ];

  // Header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });
  headerRow.height = 26;

  const addMockupRow = (
    m: CampaignMockup,
    typeLabel: string,
    overrideStatus?: MockupStatus,
    nameOverride?: string,
    codeOverride?: string | number
  ) => {
    const piece = m.piece_id ? piecesById.get(m.piece_id) : null;
    const kit = m.kit_id ? kitsById.get(m.kit_id) : null;
    const code = codeOverride ?? piece?.code ?? kit?.code ?? "";
    const baseName = nameOverride || piece?.name || kit?.name || "—";
    const status = overrideStatus || m.status;
    // Only show alterations when status is changes_requested.
    const showAlt = status === "changes_requested";

    const row = ws.addRow([
      code,
      typeLabel,
      baseName,
      showAlt && m.alt_name_active && m.alt_name ? m.alt_name : "",
      piece?.size || "",
      showAlt && m.alt_size_active && m.alt_size ? m.alt_size : "",
      piece?.specification || "",
      showAlt && m.alt_specification_active && m.alt_specification ? m.alt_specification : "",
      piece?.installation_instructions || "",
      showAlt && m.alt_installation_active && m.alt_installation ? m.alt_installation : "",
      STATUS_LABEL[status],
      m.observations || "",
      fmtDate(m.reviewed_at),
    ]);

    // Wrap text & top alignment
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE5E7EB" } },
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        left: { style: "hair", color: { argb: "FFE5E7EB" } },
        right: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
    });

    // Red font for proposed columns when present and differs
    const propIdx = [4, 6, 8, 10];
    const origIdx = [3, 5, 7, 9];
    for (let i = 0; i < propIdx.length; i++) {
      const propCell = row.getCell(propIdx[i]);
      const origCell = row.getCell(origIdx[i]);
      const propVal = String(propCell.value || "");
      if (propVal && propVal !== String(origCell.value || "")) {
        propCell.font = { color: { argb: RED }, bold: true };
      }
    }

    // Status cell colored background
    const statusCell = row.getCell(11);
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: STATUS_FILL[status] },
    };
    statusCell.font = { color: { argb: STATUS_FONT[status] }, bold: true };
    statusCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  };

  for (const m of topLevel) {
    if (m.kit_id) {
      const kit = kitsById.get(m.kit_id);
      const components = componentsByParent.get(m.id) || [];
      const rolled = components.length > 0 ? computeKitRolledUpStatus(components) : m.status;
      addMockupRow(m, "Kit", rolled, kit?.name, kit?.code);
      for (const c of components) {
        const cp = c.piece_id ? piecesById.get(c.piece_id) : null;
        addMockupRow(c, `Componente do Kit ${kit?.name || ""}`.trim(), undefined, cp?.name, cp?.code);
      }
    } else {
      addMockupRow(m, "Peça");
    }
  }

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = buildExportFileName(`Mockup_${campaignName}`, { extension: "xlsx" });
  return { blob, fileName };
}
