import * as XLSX from "xlsx";

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Try navigator.share for mobile devices (supports file sharing)
  if (navigator.share && typeof File !== "undefined") {
    const file = new File([blob], fileName, { type: blob.type });
    navigator.share({ files: [file] }).catch(() => {
      // Fallback if share is cancelled or fails
      fallbackDownload(blob, fileName);
    });
    return;
  }

  fallbackDownload(blob, fileName);
}

function fallbackDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);

  // Use setTimeout to ensure the click happens after the link is in the DOM
  setTimeout(() => {
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 100);
}
