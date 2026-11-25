import { supabase } from "@/integrations/supabase/client";
import { saveBlobAs } from "@/lib/saveBlobAs";

/** Linha crua de agency_suppliers (somente leitura). */
type RawSupplier = Record<string, unknown>;

export interface NormContact { nome: string; funcao: string; email: string; telefone: string; whatsapp: string }

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const oneLine = (v: unknown): string => s(v).replace(/\r\n|\r|\n/g, " / ");

/** Aceita os dois formatos gravados (pt: nome/funcao/telefone, en: name/role/phone). */
export function normalizeContacts(raw: unknown): NormContact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      nome: s(c.nome ?? c.name),
      funcao: s(c.funcao ?? c.role),
      email: s(c.email),
      telefone: s(c.telefone ?? c.phone),
      whatsapp: s(c.whatsapp),
    }))
    .filter((c) => Object.values(c).some((v) => v !== ""));
}

/** Só dígitos; mantém K (dígito verificador do RUT chileno). */
export const docDigits = (v: unknown): string => s(v).toUpperCase().replace(/[^0-9K]/g, "");

/** "AAAA-MM-DD HH:mm" em America/Sao_Paulo. */
export function fmtDateSP(v: unknown): string {
  const t = s(v);
  if (!t) return "";
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export const SUPPLIER_HEADERS = [
  "ID", "Razão social", "Nome fantasia", "País", "CNPJ/RUT", "CNPJ/RUT (só números)", "Contato principal",
  "Função do contato", "E-mail", "Telefone", "WhatsApp", "Site", "Instagram", "LinkedIn", "Facebook", "CEP",
  "Logradouro", "Número", "Complemento", "Bairro", "Cidade", "Estado", "Endereço (texto livre)", "Serviços",
  "Observações", "Qtd. contatos", "Qtd. arquivos", "CNPJ repetido", "Criado em", "Atualizado em",
];

export function buildSupplierRows(rows: RawSupplier[]) {
  const docCount = new Map<string, number>();
  rows.forEach((r) => { const d = docDigits(r.cnpj); if (d) docCount.set(d, (docCount.get(d) ?? 0) + 1); });

  const suppliers: string[][] = [];
  const contacts: string[][] = [];
  const files: string[][] = [];

  for (const r of rows) {
    const cs = normalizeContacts(r.contacts);
    const main = cs[0] ?? { nome: s(r.contact_name), funcao: "", email: s(r.email), telefone: s(r.phone), whatsapp: s(r.whatsapp) };
    const fl = Array.isArray(r.file_urls) ? (r.file_urls as Record<string, unknown>[]).filter((f) => f && typeof f === "object") : [];
    const services = Array.isArray(r.services) ? (r.services as unknown[]).map(s).filter(Boolean).join("; ") : "";
    const doc = s(r.cnpj);
    const digits = docDigits(r.cnpj);
    suppliers.push([
      s(r.id), oneLine(r.company_name), oneLine(r.trade_name), s(r.country), doc, digits, main.nome, main.funcao,
      s(r.email) || main.email, s(r.phone) || main.telefone, s(r.whatsapp) || main.whatsapp,
      s(r.website), s(r.instagram), s(r.linkedin), s(r.facebook), s(r.cep), oneLine(r.logradouro), s(r.numero),
      oneLine(r.complemento), oneLine(r.bairro), oneLine(r.cidade), s(r.estado), oneLine(r.address), services,
      oneLine(r.observations), String(cs.length), String(fl.length),
      digits && (docCount.get(digits) ?? 0) > 1 ? "SIM" : "", fmtDateSP(r.created_at), fmtDateSP(r.updated_at),
    ]);
    cs.forEach((c) => contacts.push([s(r.id), oneLine(r.company_name), doc, c.nome, c.funcao, c.email, c.telefone, c.whatsapp]));
    fl.forEach((f) => files.push([s(r.id), oneLine(r.company_name), s(f.name), s(f.url) || s(f.path)]));
  }
  return { suppliers, contacts, files };
}

export const slugAgency = (name: string) =>
  (name || "agencia").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").toLowerCase() || "agencia";

/** Lê todos os fornecedores com paginação estável e baixa o .xlsx. Retorna o número exportado. */
export async function exportSuppliersXlsx(agencyId: string, agencyName: string): Promise<number> {
  const PAGE = 1000;
  const all: RawSupplier[] = [];
  let total: number | null = null;
  for (let from = 0; total === null || from < total; from += PAGE) {
    const { data, error, count } = await supabase
      .from("agency_suppliers").select("*", { count: "exact" }).eq("agency_id", agencyId)
      .order("company_name").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (total === null) total = count ?? 0;
    all.push(...((data ?? []) as RawSupplier[]));
    if (!data || data.length === 0) break;
  }
  if (all.length !== (total ?? 0)) throw new Error("Exportação incompleta, tente de novo");

  const { suppliers, contacts, files } = buildSupplierRows(all);
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const addSheet = (name: string, headers: string[], rows: string[][]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    [headers, ...rows].forEach((vals) => {
      const row = ws.addRow(vals);
      row.eachCell({ includeEmpty: true }, (c) => { c.numFmt = "@"; });
    });
    for (let i = 1; i <= headers.length; i++) ws.getRow(1).getCell(i).numFmt = "@";
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    headers.forEach((h, i) => {
      const max = Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length));
      ws.getColumn(i + 1).width = Math.min(60, Math.max(10, max + 2));
      ws.getColumn(i + 1).numFmt = "@";
    });
  };
  addSheet("Fornecedores", SUPPLIER_HEADERS, suppliers);
  addSheet("Contatos", ["ID do fornecedor", "Razão social", "CNPJ/RUT", "Nome", "Função", "E-mail", "Telefone", "WhatsApp"], contacts);
  addSheet("Arquivos", ["ID do fornecedor", "Razão social", "Nome do arquivo", "URL"], files);

  const buf = await wb.xlsx.writeBuffer();
  const today = fmtDateSP(new Date().toISOString()).slice(0, 10);
  await saveBlobAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `fornecedores_${slugAgency(agencyName)}_${today}.xlsx`,
  );
  return all.length;
}
