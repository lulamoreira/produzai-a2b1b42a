import { forwardRef } from "react";
import type { Store, Piece } from "@/hooks/useStoreData";

interface LojaPdfTemplateProps {
  store: Store;
  items: { piece: Piece; qty: number }[];
}

/**
 * Off-screen A4 template (794x1123px @96dpi) used to render the store PDF.
 * Renders fixed-size square frames for piece images with object-contain
 * letterboxing so all thumbnails align consistently.
 */
const LojaPdfTemplate = forwardRef<HTMLDivElement, LojaPdfTemplateProps>(
  ({ store, items }, ref) => {
    const totalQty = items.reduce((s, i) => s + i.qty, 0);

    // Adaptive card sizing to keep everything on a single A4 page.
    const count = items.length;
    let cols = 4;
    let thumb = 120;
    let pad = 12;
    let fontName = 12;
    if (count > 12) { cols = 5; thumb = 100; pad = 10; fontName = 11; }
    if (count > 20) { cols = 6; thumb = 86; pad = 8; fontName = 10; }
    if (count > 30) { cols = 7; thumb = 72; pad = 6; fontName = 9; }
    if (count > 42) { cols = 8; thumb = 62; pad = 5; fontName = 8.5; }

    const now = new Date().toLocaleString("pt-BR");

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
            borderBottom: "2px solid #8C6F4E",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "linear-gradient(135deg, #8C6F4E, #b08a63)",
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
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1.15,
                color: "#1a1a1a",
              }}
            >
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
              <span>
                <strong style={{ color: "#333" }}>Código:</strong> {store.number}
              </span>
              {store.model && (
                <span
                  style={{
                    background: "#8C6F4E15",
                    color: "#8C6F4E",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {store.model}
                </span>
              )}
              {store.uf && (
                <span>
                  <strong style={{ color: "#333" }}>UF:</strong> {store.uf}
                </span>
              )}
              {store.type && (
                <span>
                  <strong style={{ color: "#333" }}>Tipo:</strong> {store.type}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              fontSize: 12,
              color: "#555",
            }}
          >
            <div style={{ fontSize: 11, color: "#888" }}>Total de peças</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#8C6F4E" }}>
              {totalQty}
            </div>
          </div>
        </div>

        {/* Compact info row */}
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
            {store.primary_mod && (
              <span>
                <strong>Primary:</strong> {store.primary_mod}
              </span>
            )}
            {store.secondary_mod && (
              <span>
                <strong>Secondary:</strong> {store.secondary_mod}
              </span>
            )}
          </div>
        )}

        {/* Pieces grid */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#8C6F4E",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 10,
            }}
          >
            Peças associadas ({count})
          </div>

          {count === 0 ? (
            <div
              style={{
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: pad,
              }}
            >
              {items.map(({ piece, qty }) => (
                <div
                  key={piece.id}
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
                  {/* Square frame, contain-fit image */}
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
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <span style={{ color: "#bbb", fontSize: 10 }}>
                        sem imagem
                      </span>
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

                  {piece.category && (
                    <div
                      style={{
                        fontSize: fontName - 2,
                        color: "#777",
                        marginTop: 2,
                        textAlign: "center",
                      }}
                    >
                      {piece.category}
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 6,
                      background: "#8C6F4E",
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
              ))}
            </div>
          )}
        </div>

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
          <span style={{ fontWeight: 700, color: "#8C6F4E" }}>
            Lindt Excellence Pistache · Campanha Brasil 2026
          </span>
        </div>
      </div>
    );
  }
);

LojaPdfTemplate.displayName = "LojaPdfTemplate";

export default LojaPdfTemplate;
