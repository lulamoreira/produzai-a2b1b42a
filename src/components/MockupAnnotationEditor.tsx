import { useEffect, useRef, useState, useCallback } from "react";
import { ReactSketchCanvas, type ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/button";
import { Pencil, Eraser, Circle, ArrowUpRight, Square, Undo2, Trash2, X, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tool = "pen" | "eraser" | "circle" | "arrow" | "rect";

interface ShapeAnnotation {
  type: "circle" | "arrow" | "rect";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageUrl: string;
  existingAnnotationUrl?: string | null;
  onSave: (annotatedUrl: string) => Promise<void>;
  campaignId: string;
  mockupId: string;
}

const COLORS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#000000"];
const STROKES: { label: string; v: number }[] = [
  { label: "Fino", v: 2 },
  { label: "Médio", v: 4 },
  { label: "Grosso", v: 8 },
];

export default function MockupAnnotationEditor({
  open,
  onOpenChange,
  imageUrl,
  existingAnnotationUrl,
  onSave,
  campaignId,
  mockupId,
}: Props) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shapes, setShapes] = useState<ShapeAnnotation[]>([]);
  const [previewShape, setPreviewShape] = useState<ShapeAnnotation | null>(null);
  const [imgRect, setImgRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const recomputeRect = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || !img.naturalWidth) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = cw;
    let h = cw / ratio;
    if (h > ch) {
      h = ch;
      w = h * ratio;
    }
    setImgRect({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onResize = () => recomputeRect();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, recomputeRect]);

  useEffect(() => {
    if (imgLoaded) recomputeRect();
  }, [imgLoaded, recomputeRect]);

  useEffect(() => {
    canvasRef.current?.eraseMode(tool === "eraser");
  }, [tool]);

  useEffect(() => {
    if (open) {
      setShapes([]);
      setPreviewShape(null);
      setImgLoaded(false);
      setTool("pen");
      setColor("#ef4444");
      setStrokeWidth(4);
    }
  }, [open]);

  const isShapeTool = tool === "circle" || tool === "arrow" || tool === "rect";

  const localPoint = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isShapeTool) return;
    e.preventDefault();
    overlayRef.current?.setPointerCapture(e.pointerId);
    const p = localPoint(e);
    setPreviewShape({
      type: tool as any,
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      color,
      strokeWidth,
    });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!previewShape) return;
    const p = localPoint(e);
    setPreviewShape({ ...previewShape, x2: p.x, y2: p.y });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!previewShape) return;
    overlayRef.current?.releasePointerCapture(e.pointerId);
    const dx = previewShape.x2 - previewShape.x1;
    const dy = previewShape.y2 - previewShape.y1;
    if (Math.hypot(dx, dy) > 4) setShapes((s) => [...s, previewShape]);
    setPreviewShape(null);
  };

  const handleUndo = () => {
    if (shapes.length > 0) {
      setShapes((s) => s.slice(0, -1));
    } else {
      canvasRef.current?.undo();
    }
  };
  const handleClear = () => {
    canvasRef.current?.clearCanvas();
    setShapes([]);
  };

  const renderSvg = (width: number, height: number, list: ShapeAnnotation[]) => {
    const elems = list.map((s, i) => {
      if (s.type === "rect") {
        const x = Math.min(s.x1, s.x2);
        const y = Math.min(s.y1, s.y2);
        const w = Math.abs(s.x2 - s.x1);
        const h = Math.abs(s.y2 - s.y1);
        return (
          <rect key={i} x={x} y={y} width={w} height={h} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} />
        );
      }
      if (s.type === "circle") {
        const cx = (s.x1 + s.x2) / 2;
        const cy = (s.y1 + s.y2) / 2;
        const rx = Math.abs(s.x2 - s.x1) / 2;
        const ry = Math.abs(s.y2 - s.y1) / 2;
        return <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={s.color} strokeWidth={s.strokeWidth} />;
      }
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = Math.max(10, s.strokeWidth * 3);
      const hx1 = s.x2 - head * Math.cos(angle - Math.PI / 6);
      const hy1 = s.y2 - head * Math.sin(angle - Math.PI / 6);
      const hx2 = s.x2 - head * Math.cos(angle + Math.PI / 6);
      const hy2 = s.y2 - head * Math.sin(angle + Math.PI / 6);
      return (
        <g key={i}>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={s.strokeWidth} strokeLinecap="round" />
          <polygon points={`${s.x2},${s.y2} ${hx1},${hy1} ${hx2},${hy2}`} fill={s.color} />
        </g>
      );
    });
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
        {elems}
      </svg>
    );
  };

  const svgToImage = (svgString: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
    });

  const handleSave = async () => {
    if (!imgRef.current || !imgRect) {
      toast.error("Imagem não pronta");
      return;
    }
    setSaving(true);
    try {
      const sourceImg = imgRef.current;
      const nW = sourceImg.naturalWidth;
      const nH = sourceImg.naturalHeight;

      const sketchDataUrl = await canvasRef.current!.exportImage("png");

      const offscreen = document.createElement("canvas");
      offscreen.width = nW;
      offscreen.height = nH;
      const ctx = offscreen.getContext("2d")!;
      ctx.drawImage(sourceImg, 0, 0, nW, nH);

      if (shapes.length > 0) {
        const dispW = imgRect.width;
        const dispH = imgRect.height;
        const adjusted = shapes.map((s) => ({
          ...s,
          x1: s.x1 - imgRect.left,
          y1: s.y1 - imgRect.top,
          x2: s.x2 - imgRect.left,
          y2: s.y2 - imgRect.top,
        }));
        const svgEl = renderSvg(dispW, dispH, adjusted);
        const tmp = document.createElement("div");
        const { renderToStaticMarkup } = await import("react-dom/server");
        tmp.innerHTML = renderToStaticMarkup(svgEl);
        const svgString = tmp.innerHTML;
        const shapesImg = await svgToImage(svgString);
        ctx.drawImage(shapesImg, 0, 0, nW, nH);
      }

      const sketchImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = sketchDataUrl;
      });
      ctx.drawImage(
        sketchImg,
        0,
        0,
        sketchImg.width,
        sketchImg.height,
        0,
        0,
        nW,
        nH
      );

      const blob: Blob = await new Promise((resolve, reject) => {
        offscreen.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/png", 0.92);
      });

      const path = `mockup-annotations/${campaignId}/${mockupId}_${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("campaign-assets")
        .upload(path, blob, { upsert: true, contentType: "image/png" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("campaign-assets").getPublicUrl(path);
      await onSave(data.publicUrl);
      toast.success("Anotação salva");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar anotação: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const allShapes = previewShape ? [...shapes, previewShape] : shapes;

  return (
    <div className="fixed inset-0 z-[120] bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="sticky top-0 z-10 bg-background border-b flex items-center gap-2 px-2 h-14">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-[44px]">
          <X className="w-4 h-4 mr-1" /> Cancelar
        </Button>
        <div className="flex-1 flex items-center justify-center gap-1 flex-wrap">
          <ToolBtn active={tool === "pen"} onClick={() => setTool("pen")} title="Caneta">
            <Pencil className="w-5 h-5" />
          </ToolBtn>
          <ToolBtn active={tool === "circle"} onClick={() => setTool("circle")} title="Círculo">
            <Circle className="w-5 h-5" />
          </ToolBtn>
          <ToolBtn active={tool === "arrow"} onClick={() => setTool("arrow")} title="Seta">
            <ArrowUpRight className="w-5 h-5" />
          </ToolBtn>
          <ToolBtn active={tool === "rect"} onClick={() => setTool("rect")} title="Retângulo">
            <Square className="w-5 h-5" />
          </ToolBtn>
          <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} title="Borracha">
            <Eraser className="w-5 h-5" />
          </ToolBtn>
          <ToolBtn onClick={handleUndo} title="Desfazer">
            <Undo2 className="w-5 h-5" />
          </ToolBtn>
          <ToolBtn onClick={handleClear} title="Limpar tudo">
            <Trash2 className="w-5 h-5" />
          </ToolBtn>
        </div>
        <Button onClick={handleSave} disabled={saving} className="min-h-[44px] bg-green-600 hover:bg-green-700 text-white">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="border-b px-3 py-2 flex items-center gap-3 flex-wrap bg-muted/30">
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-9 h-9 rounded-full border-2 ${color === c ? "ring-2 ring-offset-2 ring-foreground" : "border-border"}`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {STROKES.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setStrokeWidth(s.v)}
              className={`px-3 h-9 rounded-md border text-xs font-medium ${strokeWidth === s.v ? "bg-foreground text-background" : "bg-background"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {existingAnnotationUrl && (
          <span className="text-xs text-amber-700 ml-auto">Editando sobre anotação existente</span>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative bg-black overflow-hidden" style={{ touchAction: "none" }}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt="mockup"
          crossOrigin="anonymous"
          onLoad={() => setImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
        />
        {existingAnnotationUrl && (
          <img
            src={existingAnnotationUrl}
            alt=""
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none opacity-60"
            draggable={false}
          />
        )}
        {imgRect && (
          <div
            style={{
              position: "absolute",
              left: imgRect.left,
              top: imgRect.top,
              width: imgRect.width,
              height: imgRect.height,
              pointerEvents: isShapeTool ? "none" : "auto",
            }}
          >
            <ReactSketchCanvas
              ref={canvasRef}
              strokeColor={color}
              strokeWidth={strokeWidth}
              eraserWidth={20}
              canvasColor="transparent"
              style={{ width: "100%", height: "100%", border: "none" } as any}
              withTimestamp={false}
            />
          </div>
        )}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ pointerEvents: isShapeTool ? "auto" : "none", touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {containerRef.current && (
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${containerRef.current.clientWidth} ${containerRef.current.clientHeight}`}
            >
              {renderSvg(
                containerRef.current.clientWidth,
                containerRef.current.clientHeight,
                allShapes
              ).props.children}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center border ${
        active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}
