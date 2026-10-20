/**
 * Confirma que um arquivo recém-enviado ao storage existe de fato antes de
 * gravar seu link numa peça/kit. Evita links "fantasmas" (imagens quebradas).
 * Tenta 3 vezes para tolerar atraso curto de propagação.
 */
export async function assertStoredImage(publicUrl: string): Promise<void> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) await new Promise((r) => setTimeout(r, 500 * attempt));
    try {
      const res = await fetch(publicUrl.split("?")[0], { method: "HEAD", cache: "no-store" });
      if (res.ok) return;
      lastStatus = res.status;
    } catch {
      lastStatus = 0;
    }
  }
  throw new Error(`A imagem não foi salva no servidor (HTTP ${lastStatus || "rede"}). Tente enviar novamente.`);
}
