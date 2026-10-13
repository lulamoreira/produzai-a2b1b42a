import ExcelJS from "exceljs";
import { saveBlobAs } from "./saveBlobAs";
import { format } from "date-fns";
import type { InstallationTeam, TeamMember, TeamVehicle } from "@/components/InstallationTeamDialog";

export interface TeamClipboardData {
  team: InstallationTeam;
  members: TeamMember[];
  vehicles: TeamVehicle[];
  campaignName: string;
  clientName?: string;
  agencyName?: string;
}

interface ExportTeamDetailData extends TeamClipboardData {
  fileName: string;
}

interface TeamSection {
  title: string;
  fields: Array<[string, string]>;
}

// One data model keeps the Excel, rich clipboard and plain clipboard in sync.
function buildSections(data: TeamClipboardData): TeamSection[] {
  const sections: TeamSection[] = [{
    title: `Equipe: ${data.team.name}`,
    fields: [
      ["Campanha", data.campaignName],
      ...(data.agencyName ? [["Agência", data.agencyName] as [string, string]] : []),
      ...(data.clientName ? [["Cliente", data.clientName] as [string, string]] : []),
      ["Exportado em", format(new Date(), "dd/MM/yyyy 'às' HH:mm")],
      ["Instaladores", String(data.members.length)],
    ],
  }];
  data.members.forEach((member, index) => {
    sections.push({
      title: `Instalador ${index + 1}${member.is_leader ? " — Líder da equipe" : ""}`,
      fields: [
        ["Nome", member.name],
        ["Telefone", member.phone],
        ...(member.is_unified_doc
          ? [["RU", member.cpf || member.rg] as [string, string]]
          : [["RG", member.rg], ["CPF", member.cpf]] as Array<[string, string]>),
        ["Líder", member.is_leader ? "Sim" : "Não"],
      ],
    });
  });
  data.vehicles.forEach((vehicle, index) => {
    sections.push({
      title: `Veículo ${index + 1}`,
      fields: [["Nome", vehicle.name], ["Marca", vehicle.brand], ["Cor", vehicle.color], ["Placa", vehicle.plate]],
    });
  });
  return sections;
}

const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B4A6B" } };
const LABEL_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F4F7" } };

export async function exportTeamDetail(data: ExportTeamDetailData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ProduzAI";
  const ws = wb.addWorksheet("Equipe");
  ws.columns = [{ width: 23 }, { width: 28 }, { width: 24 }, { width: 20 }];
  ws.properties.defaultRowHeight = 24;
  ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.pageMargins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  const title = ws.addRow(["ProduzAI — Ficha da equipe"]);
  ws.mergeCells(title.number, 1, title.number, 4);
  title.font = { name: "Arial", bold: true, size: 18, color: { argb: "FF3B4A6B" } };
  title.height = 34;
  const hierarchy = ws.addRow([[data.agencyName, data.clientName, data.campaignName].filter(Boolean).join(" / ")]);
  ws.mergeCells(hierarchy.number, 1, hierarchy.number, 4);
  hierarchy.font = { name: "Arial", italic: true, size: 11 };
  hierarchy.alignment = { vertical: "middle", wrapText: true };
  hierarchy.height = 32;

  for (const section of buildSections(data)) {
    ws.addRow([]);
    const heading = ws.addRow([section.title]);
    ws.mergeCells(heading.number, 1, heading.number, 4);
    heading.height = 30;
    heading.getCell(1).fill = HEADER_FILL;
    heading.font = { name: "Arial", bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    heading.alignment = { vertical: "middle", wrapText: true };
    for (const [label, value] of section.fields) {
      const row = ws.addRow([`${label}:`, value || "Não informado"]);
      ws.mergeCells(row.number, 2, row.number, 4);
      row.getCell(1).font = { name: "Arial", bold: true, size: 11 };
      row.getCell(1).fill = LABEL_FILL;
      row.getCell(2).font = { name: "Arial", size: 11, bold: label === "Nome", italic: !value || label === "Exportado em" };
      row.alignment = { vertical: "middle", wrapText: true };
      row.height = Math.max(24, Math.ceil((value || "Não informado").length / 72) * 16 + 8);
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await saveBlobAs(new Blob([buffer], { type: mimeType }), data.fileName, {
    mimeType, description: "Planilha Excel (.xlsx)", extension: ".xlsx",
  });
}

/** Plain fallback uses WhatsApp-compatible emphasis; rich editors receive actual formatting. */
export function buildTeamClipboardText(data: TeamClipboardData): string {
  return buildSections(data).map((section) => [
    `*${section.title}*`,
    ...section.fields.map(([label, value]) => `*${label}:* ${value || "_Não informado_"}`),
  ].join("\n")).join("\n\n");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char] ?? char;
  });
}

export function buildTeamClipboardHtml(data: TeamClipboardData): string {
  return buildSections(data).map((section) =>
    `<section><h3><strong>${escapeHtml(section.title)}</strong></h3><p>${section.fields.map(([label, value]) =>
      `<strong>${escapeHtml(label)}:</strong> ${value ? escapeHtml(value) : "<em>Não informado</em>"}`,
    ).join("<br>")}</p></section>`,
  ).join("");
}
