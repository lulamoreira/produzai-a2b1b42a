/** Download e combinação das imagens anexadas no Flow. */

function loadImage(blob: Blob): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Arquivo de imagem inválido"));
    };
    img.src = url;
  });
}

export async function fetchImageBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.size) throw new Error("Arquivo vazio");
  return blob;
}

/** Empilha várias imagens verticalmente, mesma largura, fundo branco. */
export async function combineImagesVertically(blobs: Blob[], gap = 16): Promise<Blob> {
  if (blobs.length === 1) return blobs[0];
  const loaded = await Promise.all(blobs.map(loadImage));
  try {
    const width = Math.min(1600, Math.max(...loaded.map(({ img }) => img.naturalWidth)));
    const heights = loaded.map(({ img }) => Math.round((img.naturalHeight * width) / img.naturalWidth));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = heights.reduce((a, b) => a + b, 0) + gap * (loaded.length - 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let y = 0;
    loaded.forEach(({ img }, i) => {
      ctx.drawImage(img, 0, y, width, heights[i]);
      y += heights[i] + gap;
    });
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/jpeg", 0.9),
    );
  } finally {
    loaded.forEach(({ url }) => URL.revokeObjectURL(url));
  }
}

/** Executa tarefas com concorrência limitada. */
export async function runInBatches<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}
