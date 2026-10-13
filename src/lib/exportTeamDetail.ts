import ExcelJS from "exceljs";
import { saveBlobAs } from "./saveBlobAs";
import { format } from "date-fns";
import type { InstallationTeam, TeamMember, TeamVehicle } from "@/components/InstallationTeamDialog";

interface ExportTeamDetailData {
  team: InstallationTeam;
  members: TeamMember[];
  vehicles: TeamVehicle[];
  campaignName: string;
  clientName?: string;
  agencyName?: string;
  fileName: string;
}

const PRIMARY_COLOR = "3B4A6B";
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PRIMARY_COLOR}` } };
const ALT_ROW_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };

export async function exportTeamDetail(data: ExportTeamDetailData) {
  const { team, members, vehicles, campaignName, clientName, agencyName, fileName } = data;

  const wb = new ExcelJS.Workbook();

  // ─── Aba "Equipe": ficha da equipe + instaladores ────────
  const ws = wb.addWorksheet("Equipe");
  ws.columns = [
    { width: 5 },
    { width: 32 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
    { width: 10 },
  ];

  // Ficha da equipe
  const infoRows: Array<[string, string]> = [
    ["ProduzAI", ""],
    ["", ""],
    ["Equipe", team.name],
    ["Campanha", campaignName],
    ...(agencyName ? [["Agência", agencyName] as [string, string]] : []),
    ...(clientName ? [["Cliente", clientName] as [string, string]] : []),
    ["Data de exportação", format(new Date(), "dd/MM/yyyy 'às' HH:mm")],
    ["Instaladores", String(members.length)],
  ];
  infoRows.forEach(([label, value], i) => {
    const row = ws.addRow([label, value]);
    if (i === 0) {
      row.getCell(1).font = { bold: true, size: 16 };
    } else if (label) {
      row.getCell(1).font = { bold: true };
    }
  });

  ws.addRow([]);

  // Cabeçalho da tabela de instaladores
  const headerRow = ws.addRow(["#", "Nome", "Telefone", "RG", "CPF", "RU", "Líder"]);
  headerRow.height = 26;
  headerRow.eachCell((c) => {
    c.font = HEADER_FONT;
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", horizontal: "center" };
  });

  members.forEach((m, i) => {
    const rg = m.is_unified_doc ? "" : m.rg || "";
    const cpf = m.is_unified_doc ? "" : m.cpf || "";
    const ru = m.is_unified_doc ? m.cpf || m.rg || "" : "";
    const row = ws.addRow([
      i + 1,
      m.name,
      m.phone || "",
      rg,
      cpf,
      ru,
      m.is_leader ? "Sim" : "",
    ]);
    if (i % 2 === 1) row.eachCell((c) => { c.fill = ALT_ROW_FILL; });
    row.getCell(2).font = { bold: m.is_leader };
    row.getCell(7).alignment = { horizontal: "center" };
  });

  // ─── Veículos (quando houver) ────────────────────────────
  if (vehicles.length > 0) {
    ws.addRow([]);
    const vehHeader = ws.addRow(["Veículo", "Marca", "Cor", "Placa"]);
    vehHeader.height = 24;
    // Label na primeira célula com o estilo de cabeçalho
    vehHeader.getCell(1).font = HEADER_FONT;
    vehHeader.getCell(1).fill = HEADER_FILL;
    vehHeader.getCell(1).alignment = { vertical: "middle" };
    vehHeader.getCell(2).font = HEADER_FONT;
    vehHeader.getCell(2).fill = HEADER_FILL;
    vehHeader.getCell(2).alignment = { vertical: "middle" };
    vehHeader.getCell(3).font = HEADER_FONT;
    vehHeader.getCell(3).fill = HEADER_FILL;
    vehHeader.getCell(3).alignment = { vertical: "middle" };
    vehHeader.getCell(4).font = HEADER_FONT;
    vehHeader.getCell(4).fill = HEADER_FILL;
    vehHeader.getCell(4).alignment = { vertical: "middle" };

    vehicles.forEach((v, i) => {
      const row = ws.addRow([v.name || "", v.brand || "", v.color || "", v.plate || ""]);
      if (i % 2 === 1) row.eachCell((c) => { c.fill = ALT_ROW_FILL; });
    });
  }

  // ─── Download ────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await saveBlobAs(new Blob([buffer], { type: xlsxMime }), fileName, {
    mimeType: xlsxMime,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
