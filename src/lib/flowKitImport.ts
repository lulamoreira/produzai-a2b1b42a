import { ensureKitPrefix } from "./kitName";
import type { FlowParsedPiece } from "./parseFlowWorkbook";

/** Underscores delimitam tokens no nome bruto do Flow; espaços duplos são colapsados. */
export function normalizeFlowRawName(rawName: string): string {
  return rawName.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

/** Token KIT tolerante a espaços perdidos: "KIT", "K IT", "K  I T". */
const KIT_TOKEN_RE = /\bK\s*I\s*T\b/i;
const KIT_TOKEN_RE_GLOBAL = /\bK\s*I\s*T\b/gi;

export function isFlowKit(sourceName: string): boolean {
  return KIT_TOKEN_RE.test(normalizeFlowRawName(sourceName));
}

export function flowNameWithoutKit(name: string): string {
  return name.replace(KIT_TOKEN_RE_GLOBAL, " ").replace(/\s+/g, " ").trim();
}

/** Nome do kit como gravado na campanha (com prefixo "KIT "), para casar linhas do Flow com kits existentes. */
export function flowKitMatchName(parsedName: string): string {
  return ensureKitPrefix(flowNameWithoutKit(parsedName));
}

export interface FlowKitComponent {
  label: string;
  size: string;
}

const PART_SIZE_RE = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/i;

function titleLabel(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => (/[\d%&]/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Componentes descritos no parêntese final do nome bruto, separados por "/".
 * Retorna null quando nenhuma parte tem tamanho — nesse caso vale o comportamento
 * antigo: 1 componente e o parêntese permanece na especificação.
 */
export function parseKitComponents(sourceName: string): FlowKitComponent[] | null {
  const normalized = normalizeFlowRawName(sourceName);
  const parens = Array.from(normalized.matchAll(/\(([^)]*)\)/g));
  if (!parens.length) return null;
  const content = parens[parens.length - 1][1];
  const parts = content.split("/").map((part) => part.trim()).filter(Boolean);
  const components = parts.map((part) => {
    const match = part.match(PART_SIZE_RE);
    const size = match ? `${match[1]}×${match[2]}` : "";
    const label = titleLabel(
      part.replace(PART_SIZE_RE, " ").replace(/^[\s\-–—:.,]+|[\s\-–—:.,]+$/g, "").replace(/\s+/g, " ").trim(),
    );
    return { label, size };
  });
  return components.some((component) => component.size) ? components : null;
}

/** Remove o último grupo "(...)" do texto (usado quando ele virou componentes do kit). */
function withoutFinalParenthesis(text: string): string {
  return text.replace(/\([^()]*\)(?![\s\S]*\([^()]*\))/, " ").replace(/\s+/g, " ").trim();
}

const GENERIC_TIPO_WORDS = new Set(["descontos", "desconto", "kit"]);

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/[\d%&]/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

/** LOCAL: Title Case da categoria do kit, sem espaços ao redor de "&" ("PICK & MIX" → "Pick&Mix"). */
function flowComponentLocal(category: string): string {
  return titleCaseWords(category.trim()).replace(/\s*&\s*/g, "&");
}

/** TIPO: subgrupo do kit; senão o que sobra do nome-base sem as palavras do LOCAL e as genéricas. */
function flowComponentTipo(baseName: string, local: string, subLocation: string): string {
  const sub = subLocation.trim();
  if (sub) return sub;
  const localWords = new Set(local.toLowerCase().split(/[\s&]+/).filter(Boolean));
  const joined = local.toLowerCase().replace(/[\s&]+/g, "");
  if (joined) localWords.add(joined);
  const remaining = baseName.split(/\s+/).filter((word) => {
    const key = word.toLowerCase().replace(/&/g, "");
    return key && !localWords.has(key) && !GENERIC_TIPO_WORDS.has(key);
  });
  return remaining.length ? remaining.join(" ") : baseName;
}

export function buildFlowImportRecords(piece: FlowParsedPiece, campaignId: string, nextCode: number, nextOrder: number, imageUrl: string | null) {
  const kit = isFlowKit(piece.sourceName);
  const name = kit ? flowNameWithoutKit(piece.name) : piece.name.trim();
  if (!name) throw new Error("Informe o nome da peça antes de importar.");
  const common = {
    campaign_id: campaignId, category: piece.category.trim().toUpperCase(),
    sub_location: piece.subLocation.trim() || null,
    is_deleted: false, is_new: false, is_mockup: false,
  };
  const components = kit ? parseKitComponents(piece.sourceName) : null;
  // Quando o parêntese final vira componentes, ele não pode sobrar na especificação.
  const specification = components ? withoutFinalParenthesis(piece.specification.trim()) : piece.specification.trim();
  const basePiece = {
    ...common,
    kit_only: kit,
    specification: specification || "Vide Book/Manual",
    installation_instructions: "Sem informações específicas",
  };
  if (kit && components) {
    const local = flowComponentLocal(piece.category);
    const tipo = flowComponentTipo(name, local, piece.subLocation);
    return {
      kit: { ...common, name: ensureKitPrefix(name), image_url: imageUrl, code: nextCode, display_order: nextOrder },
      pieces: components.map((component, index) => ({
        ...basePiece,
        // "<TIPO> <RÓTULO> - <LOCAL>" (ex.: "Mobiles 10% - Pick&Mix").
        name: `${[tipo, component.label].filter(Boolean).join(" ")}${local ? ` - ${local}` : ""}`.replace(/\s+/g, " ").trim(),
        size: component.size,
        // A imagem do Flow fica só no 1º componente; os demais são completados depois.
        image_url: index === 0 ? imageUrl : null,
        code: nextCode + 1 + index,
        display_order: nextOrder + 1 + index,
      })),
      nextCode: nextCode + 1 + components.length,
      nextOrder: nextOrder + 1 + components.length,
    };
  }
  return {
    kit: kit ? { ...common, name: ensureKitPrefix(name), image_url: imageUrl, code: nextCode, display_order: nextOrder } : null,
    pieces: [{
      ...basePiece, name, size: piece.size.trim(), image_url: imageUrl,
      code: nextCode + (kit ? 1 : 0), display_order: nextOrder + (kit ? 1 : 0),
    }],
    nextCode: nextCode + (kit ? 2 : 1),
    nextOrder: nextOrder + (kit ? 2 : 1),
  };
}
