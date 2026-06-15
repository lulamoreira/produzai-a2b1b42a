import { forwardRef, useMemo } from "react";

interface PdfStore {
  name: string;
  number?: string | number | null;
  model?: string | null;
  uf?: string | null;
  type?: string | null;
  primary_mod?: string | null;
  secondary_mod?: string | null;
}

interface PdfPiece {
  id: string | number;
  name: string;
  image_url?: string | null;
  category?: string | null;
}

interface PdfKit {
  id: string | number;
  name: string;
  code?: number | string | null;
  pieces: (PdfPiece & { qty: number })[];
}

interface LojaPdfTemplateProps {
  store: PdfStore;
  items: { piece: PdfPiece; qty: number }[];
  kits?: PdfKit[];
  footerLabel?: string;
}

const BRAND = "#8C6F4E";

/**
 * Off-screen A4 template for the store PDF.
 * Pieces are grouped by Local (category). A separate "Kits" section lists
 * the kit name + the component pieces of each kit defined in the campaign.
 */
const LojaPdfTemplate = forwardRef<HTMLDivElement, LojaPdfTemplateProps>(
  ({ store, items, kits = [], footerLabel }, ref) => {
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    // Pieces assigned to this store, grouped by category (Local)
    const grouped = useMemo(() => {
      const map = new Map<string, { piece: PdfPiece; qty: number }[]>();
      for (const it of items) {
        const key = (it.piece.category || "Outros").trim() || "Outros";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(it);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([cat, arr]) => ({
          category: cat,
          items: arr.sort((a, b) => a.piece.name.localeCompare(b.piece.name, "pt-BR")),
        }));
    }, [items]);

    // Pieces assigned to this store that also belong to some kit (badge data)
    const pieceKitMap = useMemo(() => {
      const m = new Map<string | number, string[]>();
      for (const k of kits) {
        for (const kp of k.pieces) {
          if (!m.has(kp.id)) m.set(kp.id, []);
          m.get(kp.id)!.push(k.name);
        }
      }
      return m;
    }, [kits]);

    // Density: scale thumbnails based on total piece count
    const total = items.length;
    let cols = 4;
    let thumb = 110;
    let pad = 10;
    let fontName = 11;
    if (total > 12) { cols = 5; thumb = 92; pad = 8; fontName = 10; }
    if (total > 22) { cols = 6; thumb = 78; pad = 7; fontName = 9.5; }
    if (total > 32) { cols = 7; thumb = 66; pad = 6; fontName = 9; }
    if (total > 44) { cols = 8; thumb = 58; pad = 5; fontName = 8.5; }

    const now = new Date().toLocaleString("pt-BR");

    const renderCard = (piece: PdfPiece, qty: number, kitNames?: string[]) => (
      <div
        key={`${piece.id}-${qty}`}
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          padding: pad - 2,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            width: thumb,
            height: thumb,
            borderRadius: 6,
            background: "#f4f4f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {piece.image_url ? (
            <img
              src={piece.image_url}
              crossOrigin="anonymous"
              alt={piece.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                display: "block",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span style={{ color: "#bbb", fontSize: 10 }}>sem imagem</span>
          )}
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: fontName,
            fontWeight: 600,
            color: "#222",
            textAlign: "center",
            lineHeight: 1.2,
            width: "100%",
            wordBreak: "break-word",
          }}
        >
          {piece.name}
        </div>

        {kitNames && kitNames.length > 0 && (
          <div
            style={{
              marginTop: 3,
              fontSize: fontName - 2.5,
              color: BRAND,
              fontWeight: 600,
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            🧩 {kitNames.join(", ")}
          </div>
        )}

        <div
          style={{
            marginTop: 6,
            background: BRAND,
            color: "#fff",
            padding: "2px 10px",
            borderRadius: 999,
            fontSize: fontName,
            fontWeight: 700,
            minWidth: 28,
            textAlign: "center",
          }}
        >
          {qty}
        </div>
      </div>
    );

    const sectionHeader = (label: string, count: number) => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 4,
            height: 16,
            background: BRAND,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#222",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            flex: 1,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#666",
            background: "#f1efe9",
            padding: "2px 8px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {count} {count === 1 ? "peça" : "peças"}
        </div>
      </div>
    );

    return (
      <div
        ref={ref}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: 794,
          minHeight: 1123,
          background: "#ffffff",
          color: "#111111",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: 32,
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingBottom: 16,
            borderBottom: `2px solid ${BRAND}`,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${BRAND}, #b08a63)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 28,
            }}
          >
            🏬
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15, color: "#1a1a1a" }}>
              {store.name}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#555",
                marginTop: 4,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span><strong style={{ color: "#333" }}>Código:</strong> {store.number}</span>
              {store.model && (
                <span
                  style={{
                    background: `${BRAND}15`,
                    color: BRAND,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {store.model}
                </span>
              )}
              {store.uf && <span><strong style={{ color: "#333" }}>UF:</strong> {store.uf}</span>}
              {store.type && <span><strong style={{ color: "#333" }}>Tipo:</strong> {store.type}</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
            <div style={{ fontSize: 11, color: "#888" }}>Total de peças</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: BRAND }}>{totalQty}</div>
          </div>
        </div>

        {(store.primary_mod || store.secondary_mod) && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "#444",
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {store.primary_mod && <span><strong>Primary:</strong> {store.primary_mod}</span>}
            {store.secondary_mod && <span><strong>Secondary:</strong> {store.secondary_mod}</span>}
          </div>
        )}

        {/* Pieces grouped by category */}
        {items.length === 0 ? (
          <div
            style={{
              marginTop: 24,
              padding: 24,
              textAlign: "center",
              color: "#888",
              background: "#fafafa",
              borderRadius: 8,
            }}
          >
            Nenhuma peça associada a esta loja.
          </div>
        ) : (
          grouped.map(({ category, items: catItems }) => (
            <div key={category}>
              {sectionHeader(category, catItems.length)}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: pad,
                }}
              >
                {catItems.map((it) =>
                  renderCard(it.piece, it.qty, pieceKitMap.get(it.piece.id))
                )}
              </div>
            </div>
          ))
        )}

        {/* Kits composition reference */}
        {kits.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                paddingTop: 10,
                borderTop: "1px dashed #ddd",
              }}
            >
              <div style={{ width: 4, height: 16, background: BRAND, borderRadius: 2 }} />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#222",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Kits da campanha — composição
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {kits.map((kit) => (
                <div
                  key={kit.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderLeft: `3px solid ${BRAND}`,
                    borderRadius: 6,
                    padding: 8,
                    background: "#fafaf7",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#222",
                      marginBottom: 6,
                    }}
                  >
                    {kit.code ? `[${kit.code}] ` : ""}{kit.name}
                    <span style={{ color: "#888", fontWeight: 500, marginLeft: 6 }}>
                      ({kit.pieces.length} {kit.pieces.length === 1 ? "peça" : "peças"})
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {kit.pieces.map((p) => (
                      <div
                        key={`${kit.id}-${p.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          background: "#fff",
                          border: "1px solid #e5e5e5",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 10,
                          color: "#333",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span style={{ color: "#888" }}>×{p.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            left: 32,
            right: 32,
            bottom: 16,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "#999",
            borderTop: "1px solid #eee",
            paddingTop: 8,
          }}
        >
          <span>Gerado em {now}</span>
          <span style={{ fontWeight: 700, color: BRAND }}>{footerLabel || "ProduzAI"}</span>
        </div>
      </div>
    );
  }
);

LojaPdfTemplate.displayName = "LojaPdfTemplate";

export default LojaPdfTemplate;
