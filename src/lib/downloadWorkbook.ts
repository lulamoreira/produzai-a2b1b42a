import * as XLSX from "xlsx";

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });

  if (canShareFiles(blob, fileName)) {
    return;
  }

  triggerBrowserDownload(blob, fileName);
}

function canShareFiles(blob: Blob, fileName: string) {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function" ||
    typeof File === "undefined"
  ) {
    return false;
  }

  const file = new File([blob], fileName, { type: XLSX_MIME_TYPE });

  if (!navigator.canShare({ files: [file] })) {
    return false;
  }

  void navigator.share({ files: [file], title: fileName }).catch(() => {
    triggerBrowserDownload(blob, fileName);
  });

  return true;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
    (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

  if (isIOS || isSafari) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = url;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
