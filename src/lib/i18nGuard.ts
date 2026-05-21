/**
 * i18nGuard — detecta chaves de tradução ausentes em desenvolvimento.
 * Loga no console quando uma chave retorna o próprio nome (sinal de chave não encontrada).
 */
export function setupI18nGuard(i18nInstance: import("i18next").i18n) {
  if (import.meta.env.PROD) return;

  i18nInstance.on("missingKey", (lngs, namespace, key, res) => {
    console.warn(
      `%c[i18n] Chave ausente: "${namespace}:${key}" (idioma: ${lngs.join(", ")})`,
      "color: #C2714F; font-weight: bold;"
    );
  });
}