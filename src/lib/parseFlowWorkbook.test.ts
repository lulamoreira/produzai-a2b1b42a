import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { commonFlowPrefix, parseFlowPieceName, parseFlowWorkbook } from "./parseFlowWorkbook";

describe("parseFlowPieceName", () => {
  it("extrai a última medida, sem cm e mantendo vírgula", () => {
    expect(parseFlowPieceName("LINDT_SUMMER_TDS_VIT_ADESIVO_10x5cm_62,5x170cm").size).toBe("62,5×170");
  });

  it("move a nota entre parênteses para especificação", () => {
    const p = parseFlowPieceName("LINDT_SUMMER_INT_SHELFTALK_PAINEL_ 140x20cm (Dobra: 8cm)", "", {}, "LINDT SUMMER");
    expect(p.specification).toBe("(Dobra: 8cm)");
    expect(p.size).toBe("140×20");
    expect(p.name).toBe("Shelftalk Painel");
  });

  it("mapeia o token de local e corrige K IT", () => {
    const p = parseFlowPieceName("LINDT_SUMMER_VIT_K IT_REVESTIMENTO_100x50cm", "", {}, "LINDT SUMMER");
    expect(p.category).toBe("Vitrine");
    expect(p.name).toBe("KIT Revestimento");
    expect(p.subLocation).toBe("Revestimento");
  });

  it("usa a Demanda quando o token é só TDS", () => {
    expect(parseFlowPieceName("LINDT_SUMMER_TDS_DISPLAY_30x30cm", "QUIOSQUE").category).toBe("QUIOSQUE");
  });

  it("remove o prefixo comum da campanha quando informado", () => {
    const p = parseFlowPieceName("LINDT_CH_SUMMER27_VIT_SHELFTALK_2020_10x5cm", "", {}, "LINDT CH SUMMER27");
    expect(p.name).toBe("Shelftalk 2020");
    expect(p.category).toBe("Vitrine");
  });
});

describe("commonFlowPrefix", () => {
  it("detecta o prefixo comum a todas as peças, sem hardcode de campanha", () => {
    expect(commonFlowPrefix([
      "LINDT_CH_SUMMER27_VIT_SHELFTALK_2020",
      "LINDT_CH_SUMMER27_INT_DISPLAY_30x30cm",
    ])).toBe("LINDT CH SUMMER27");
  });

  it("para antes de palavras de tipo/local da peça", () => {
    expect(commonFlowPrefix([
      "LINDT_CH_VIT_ADESIVO_10x5cm",
      "LINDT_CH_VIT_TAG_20x10cm",
    ])).toBe("LINDT CH");
  });

  it("retorna vazio com menos de duas peças ou sem prefixo comum", () => {
    expect(commonFlowPrefix(["LINDT_CH_SUMMER27_VIT_TAG"])).toBe("");
    expect(commonFlowPrefix(["AAA_VIT_TAG", "BBB_VIT_TAG"])).toBe("");
  });
});

describe("parseFlowWorkbook", () => {
  it("lê cabeçalho na linha 4 e casa hyperlinks dos anexos pelo nome", () => {
    const pecas = XLSX.utils.aoa_to_sheet([["t"], ["e"], [], ["Nome", "Demanda"], ["LINDT_SUMMER_VIT_TAG_10x5cm", "PAREDE"], ["LINDT_SUMMER_INT_DISPLAY_20x20cm", "PAREDE"]]);
    const anexos = XLSX.utils.aoa_to_sheet([["t"], ["e"], [], ["Demanda", "Peça", "Link"], ["PAREDE", "LINDT_SUMMER_VIT_TAG_10x5cm", "abrir"], ["PAREDE", "LINDT_SUMMER_VIT_TAG_10x5cm", "abrir"]]);
    anexos["C5"].l = { Target: "https://a/1.png" };
    anexos["C6"].l = { Target: "https://a/2.png" };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, pecas, "Todas as Peças");
    XLSX.utils.book_append_sheet(wb, anexos, "Anexos");
    const pieces = parseFlowWorkbook(wb);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].imageUrls).toEqual(["https://a/1.png", "https://a/2.png"]);
    expect(pieces[1].imageUrls).toEqual([]);
  });
});
