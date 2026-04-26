import ExcelJS from "exceljs";
import { saveBlobAs } from "./saveBlobAs";
import type { Schedule } from "@/types/schedule";
import type { ClientStore } from "@/hooks/useMultiClientData";
import type { InstallationTeam, TeamMember } from "@/components/InstallationTeamDialog";
import { buildAddress } from "@/lib/storeHelpers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExportData {
  campaignName: string;
  clientName: string;
  agencyName: string;
  stores: ClientStore[];
  scheduleMap: Record<string, Schedule>;
  teamMap: Record<string, InstallationTeam>;
  membersByTeam: Record<string, TeamMember[]>;
}

const PRIMARY_COLOR = "3B4A6B";
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${PRIMARY_COLOR}` } };
const ALT_ROW_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };
const CODE_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" } };
const CODE_BORDER: Partial<ExcelJS.Border> = { style: "medium", color: { argb: "FFF0C800" } };
const GROUP_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3EDF7" } };

function getEffective(schedule: Schedule | undefined) {
  if (!schedule) return { date: null, time: null, os: null, pref: null };
  const r = !!schedule.reschedule_enabled;
  return {
    date: r ? schedule.reschedule_date : schedule.scheduled_date,
    time: r ? schedule.reschedule_time : schedule.scheduled_time,
    os: r ? schedule.reschedule_os : schedule.installation_os,
    pref: r ? schedule.reschedule_preference : schedule.installation_preference,
  };
}

function getLeader(members: TeamMember[] | undefined): TeamMember | undefined {
  return members?.find(m => m.is_leader) || members?.[0];
}

function prefLabel(pref: string | null) {
  if (!pref || pref === "not_informed") return "";
  const map: Record<string, string> = { morning: "Manhã", afternoon: "Tarde", full_day: "Dia inteiro" };
  return map[pref] || pref;
}

function formatDateLong(d: string | null) {
  if (!d) return "";
  try { return format(new Date(d + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
}

function formatDateShort(d: string | null) {
  if (!d) return "";
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return d; }
}

const COLUMNS = [
  { header: "#", key: "idx", width: 5 },
  { header: "Loja", key: "store", width: 28 },
  { header: "Apelido", key: "nickname", width: 18 },
  { header: "Cidade", key: "city", width: 18 },
  { header: "UF", key: "state", width: 6 },
  { header: "Endereço", key: "address", width: 36 },
  { header: "Equipe", key: "team", width: 18 },
  { header: "Líder", key: "leader", width: 18 },
  { header: "Tel. Líder", key: "leaderPhone", width: 16 },
  { header: "Data", key: "date", width: 14 },
  { header: "Horário", key: "time", width: 10 },
  { header: "Turno", key: "shift", width: 12 },
  { header: "Código", key: "code", width: 12 },
];

function buildRow(idx: number, store: ClientStore, schedule: Schedule | undefined, teamMap: Record<string, InstallationTeam>, membersByTeam: Record<string, TeamMember[]>) {
  const eff = getEffective(schedule);
  const team = schedule?.team_id ? teamMap[schedule.team_id] : null;
  const leader = schedule?.team_id ? getLeader(membersByTeam[schedule.team_id]) : undefined;
  return {
    idx,
    store: store.name,
    nickname: store.nickname || "",
    city: store.city || "",
    state: store.state || "",
    address: buildAddress(store),
    team: team?.name || "",
    leader: leader?.name || "",
    leaderPhone: leader?.phone || "",
    date: formatDateShort(eff.date),
    time: eff.time || "",
    shift: prefLabel(eff.pref),
    code: schedule?.install_code || "",
  };
}

function styleHeaders(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.height = 32;
  row.eachCell(c => {
    c.font = HEADER_FONT;
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function styleDataRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number) {
  const codeCol = COLUMNS.length;
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    if ((r - startRow) % 2 === 1) {
      row.eachCell(c => { c.fill = ALT_ROW_FILL; });
    }
    // Leader bold
    const leaderCell = row.getCell(8);
    leaderCell.font = { bold: true };
    // Code cell styling
    const codeCell = row.getCell(codeCol);
    codeCell.fill = CODE_FILL;
    codeCell.font = { bold: true, name: "Courier New" };
    codeCell.alignment = { horizontal: "center", vertical: "middle" };
    codeCell.border = { top: CODE_BORDER, bottom: CODE_BORDER, left: CODE_BORDER, right: CODE_BORDER };
  }
}

export async function exportInstallCodes(data: ExportData) {
  const { campaignName, clientName, agencyName, stores, scheduleMap, teamMap, membersByTeam } = data;

  // Filter stores with install codes
  const storesWithCode = stores.filter(s => scheduleMap[s.id]?.install_code);
  if (storesWithCode.length === 0) {
    throw new Error("Nenhuma loja com código gerado.");
  }

  const wb = new ExcelJS.Workbook();

  // ─── Aba 1: Resumo ─────────────────────────────────────
  const wsResumo = wb.addWorksheet("Resumo");
  wsResumo.columns = [{ width: 28 }, { width: 40 }];
  const resumoRows = [
    ["ProduzAI", ""],
    ["", ""],
    ["Campanha", campaignName],
    ["Cliente", clientName],
    ["Agência", agencyName],
    ["Data de exportação", format(new Date(), "dd/MM/yyyy 'às' HH:mm")],
    ["Total de lojas com código", storesWithCode.length],
  ];
  resumoRows.forEach((r, i) => {
    const row = wsResumo.addRow(r);
    if (i === 0) { row.getCell(1).font = { bold: true, size: 16 }; }
    if (i >= 2) { row.getCell(1).font = { bold: true }; }
  });

  // ─── Aba 2: Códigos de Instalação ──────────────────────
  const wsCodigos = wb.addWorksheet("Códigos de Instalação");
  wsCodigos.columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));
  storesWithCode.forEach((store, i) => {
    wsCodigos.addRow(buildRow(i + 1, store, scheduleMap[store.id], teamMap, membersByTeam));
  });
  styleHeaders(wsCodigos);
  styleDataRows(wsCodigos, 2, storesWithCode.length + 1);
  wsCodigos.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + COLUMNS.length)}1` };
  wsCodigos.views = [{ state: "frozen", ySplit: 1 }];

  // ─── Aba 3: Por Equipe ────────────────────────────────
  const wsEquipe = wb.addWorksheet("Por Equipe");
  wsEquipe.columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));
  styleHeaders(wsEquipe);

  // Group by team
  const byTeam = new Map<string, ClientStore[]>();
  storesWithCode.forEach(s => {
    const teamId = scheduleMap[s.id]?.team_id || "__sem_equipe__";
    if (!byTeam.has(teamId)) byTeam.set(teamId, []);
    byTeam.get(teamId)!.push(s);
  });

  let eqIdx = 1;
  let currentRow = 2;
  byTeam.forEach((teamStores, teamId) => {
    const teamName = teamId === "__sem_equipe__" ? "Sem equipe" : (teamMap[teamId]?.name || "Equipe desconhecida");
    // Group header
    const groupRow = wsEquipe.addRow([`Equipe: ${teamName}`]);
    wsEquipe.mergeCells(currentRow, 1, currentRow, COLUMNS.length);
    groupRow.getCell(1).font = { bold: true, size: 11 };
    groupRow.getCell(1).fill = GROUP_FILL;
    groupRow.height = 28;
    currentRow++;

    teamStores.forEach(store => {
      wsEquipe.addRow(buildRow(eqIdx++, store, scheduleMap[store.id], teamMap, membersByTeam));
      currentRow++;
    });

    // Subtotal
    const subtotalRow = wsEquipe.addRow([`Total de lojas: ${teamStores.length}`]);
    wsEquipe.mergeCells(currentRow, 1, currentRow, COLUMNS.length);
    subtotalRow.getCell(1).font = { bold: true, italic: true };
    subtotalRow.getCell(1).alignment = { horizontal: "right" };
    currentRow++;
  });
  // Style data rows (skip group headers/subtotals)
  for (let r = 2; r < currentRow; r++) {
    const codeCell = wsEquipe.getRow(r).getCell(COLUMNS.length);
    if (codeCell.value && typeof codeCell.value === "string" && /^[a-z]{2}\d{3}$/.test(codeCell.value)) {
      codeCell.fill = CODE_FILL;
      codeCell.font = { bold: true, name: "Courier New" };
      codeCell.alignment = { horizontal: "center" };
      codeCell.border = { top: CODE_BORDER, bottom: CODE_BORDER, left: CODE_BORDER, right: CODE_BORDER };
    }
    const leaderCell = wsEquipe.getRow(r).getCell(8);
    if (leaderCell.value) leaderCell.font = { bold: true };
  }

  // ─── Aba 4: Por Loja ──────────────────────────────────
  const wsLoja = wb.addWorksheet("Por Loja");
  wsLoja.columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));
  styleHeaders(wsLoja);

  // Group by store name (sorted)
  const sortedStores = [...storesWithCode].sort((a, b) => a.name.localeCompare(b.name));
  let ljIdx = 1;
  sortedStores.forEach(store => {
    wsLoja.addRow(buildRow(ljIdx++, store, scheduleMap[store.id], teamMap, membersByTeam));
  });
  styleDataRows(wsLoja, 2, sortedStores.length + 1);
  wsLoja.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + COLUMNS.length)}1` };
  wsLoja.views = [{ state: "frozen", ySplit: 1 }];

  // ─── Download ──────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `${campaignName.replace(/[^\w\s-]/g, "")}_codigos_instalacao_${dateStr}.xlsx`;
  const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  await saveBlobAs(new Blob([buffer], { type: xlsxMime }), fileName, {
    mimeType: xlsxMime,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
