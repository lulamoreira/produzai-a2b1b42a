import ExcelJS from "exceljs";
import { saveBlobAs } from "./saveBlobAs";
import { getCoverageMatch, getCoverageScope, type CoverageTeamLike } from "./teamCoverage";
import type { Schedule } from "@/types/schedule";
import type { ClientStore } from "@/hooks/useMultiClientData";
import type { InstallationTeam, TeamMember } from "@/components/InstallationTeamDialog";

interface ExportTeamsByStoreData {
  fileName: string;
  stores: ClientStore[];
  scheduleMap: Record<string, Schedule>;
  teams: InstallationTeam[];
  membersByTeam: Record<string, TeamMember[]>;
}

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const STORE_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B4A6B" } };
const SUBHEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3EDF7" } };
const SUPPORT_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0B2" } };

const COLUMN_WIDTHS = [34, 30, 18, 18, 18, 18];

function storeHeaderText(store: ClientStore) {
  const place = [store.city, store.state].filter(Boolean).join("/");
  const code = (store as any).store_code ? ` (${(store as any).store_code})` : "";
  return `LOJA: ${store.name}${code}${place ? ` — ${place}` : ""}`;
}

/** RG / CPF / RU split, mirroring the existing "Equipes" sheet rules. */
function docCells(member: TeamMember) {
  const isRU = !!(member as any).is_unified_doc;
  return {
    rg: isRU ? "" : member.rg || "",
    cpf: isRU ? "" : member.cpf || "",
    ru: isRU ? member.cpf || "" : "",
  };
}

export async function exportTeamsByStore(data: ExportTeamsByStoreData) {
  const { fileName, stores, scheduleMap, teams, membersByTeam } = data;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Por Loja");
  ws.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  const supportTeams = teams.filter((tm) => getCoverageScope(tm as CoverageTeamLike) !== "none");

  stores.forEach((store) => {
    // Store header
    const headerRow = ws.addRow([storeHeaderText(store)]);
    ws.mergeCells(headerRow.number, 1, headerRow.number, COLUMN_WIDTHS.length);
    headerRow.getCell(1).font = HEADER_FONT;
    headerRow.getCell(1).fill = STORE_FILL;
    headerRow.height = 22;

    // Column sub-header
    const subRow = ws.addRow(["Equipe", "Nome", "RG", "CPF", "RU", "Telefone"]);
    subRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = SUBHEADER_FILL;
    });

    // Assigned team members
    const assignedTeamId = scheduleMap[store.id]?.team_id || null;
    const assignedTeam = assignedTeamId ? teams.find((tm) => tm.id === assignedTeamId) : undefined;
    const assignedMembers = assignedTeamId ? membersByTeam[assignedTeamId] || [] : [];

    if (assignedTeam && assignedMembers.length > 0) {
      assignedMembers.forEach((m) => {
        const d = docCells(m);
        ws.addRow([assignedTeam.name, m.name, d.rg, d.cpf, d.ru, m.phone || ""]);
      });
    } else if (assignedTeam) {
      ws.addRow([assignedTeam.name, "(sem membros cadastrados)", "", "", "", ""]);
    } else {
      ws.addRow(["(sem equipe atribuída)", "", "", "", "", ""]);
    }

    // Support teams covering this store (never duplicating the assigned team)
    supportTeams.forEach((supportTeam) => {
      if (supportTeam.id === assignedTeamId) return;
      const match = getCoverageMatch(supportTeam as CoverageTeamLike, store);
      if (!match) return;

      const label = `APOIO — ${supportTeam.name} (${match})`;
      const members = membersByTeam[supportTeam.id] || [];
      const rows = members.length > 0
        ? members.map((m) => {
            const d = docCells(m);
            return [label, m.name, d.rg, d.cpf, d.ru, m.phone || ""];
          })
        : [[label, "(sem membros cadastrados)", "", "", "", ""]];

      rows.forEach((values) => {
        const row = ws.addRow(values);
        for (let c = 1; c <= COLUMN_WIDTHS.length; c++) row.getCell(c).fill = SUPPORT_FILL;
      });
    });

    ws.addRow([]);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await saveBlobAs(new Blob([buffer], { type: xlsxMime }), fileName, {
    mimeType: xlsxMime,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
