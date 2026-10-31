// QR codes SVG générés dans le navigateur (bibliothèque qrcode).
import QRCode from "qrcode";

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);

/** SVG autonome : QR + libellé écrit dessous. Les couleurs du QR restent noir sur blanc (lisibilité du scan). */
export function qrSvg(url: string, label: string): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const margin = 4;
  const scale = 10;
  const qrPx = (size + margin * 2) * scale;
  const textArea = 70;
  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.get(row, col)) d += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${qrPx}" height="${qrPx + textArea}" viewBox="0 0 ${qrPx} ${qrPx + textArea}">
<rect width="100%" height="100%" fill="#fff"/>
<g transform="scale(${scale})"><path d="${d}" fill="#000" shape-rendering="crispEdges"/></g>
<text x="${qrPx / 2}" y="${qrPx + 42}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" fill="#000">${escapeXml(label)}</text>
</svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFileName = (s: string) =>
  s.normalize("NFKD").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "table";
