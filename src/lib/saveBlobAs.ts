import { saveAs } from "file-saver";
import { toast } from "sonner";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Salva um Blob abrindo o diálogo "Salvar como" do navegador (File System Access API)
 * com fallback para download tradicional em navegadores sem suporte.
 *
 * Retorna `true` se o arquivo foi salvo, `false` se o usuário cancelou.
 */
export async function saveBlobAs(
  blob: Blob,
  suggestedName: string,
  options?: { mimeType?: string; description?: string; extension?: string }
): Promise<boolean> {
  const mimeType = options?.mimeType || blob.type || XLSX_MIME;
  const extension = options?.extension || (suggestedName.match(/\.[a-z0-9]+$/i)?.[0] ?? ".xlsx");
  const description = options?.description || "Planilha Excel";

  const anyWindow = window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof anyWindow.showSaveFilePicker === "function") {
    try {
      const handle = await anyWindow.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description,
            accept: { [mimeType]: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: unknown) {
      // AbortError = usuário cancelou o diálogo
      if (err instanceof DOMException && err.name === "AbortError") {
        return false;
      }
      // Se falhou por outro motivo (ex: permissão), cai para fallback
      console.warn("showSaveFilePicker falhou, usando fallback:", err);
    }
  }

  // Fallback: download tradicional para a pasta de Downloads
  toast.info("Arquivo salvo na pasta Downloads", { duration: 3000 });
  saveAs(blob, suggestedName);
  return true;
}

/**
 * Variante que recebe um workbook já transformado em ArrayBuffer.
 */
export async function saveXlsxAs(buffer: ArrayBuffer, suggestedName: string): Promise<boolean> {
  const blob = new Blob([buffer], { type: XLSX_MIME });
  return saveBlobAs(blob, suggestedName, {
    mimeType: XLSX_MIME,
    description: "Planilha Excel (.xlsx)",
    extension: ".xlsx",
  });
}
