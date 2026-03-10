/** Convert PDF base64 to an array of image data URLs (JPEG) for vision APIs. Max 15 pages. */
export async function pdfToImages(pdfBase64, maxPages = 15) {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  GlobalWorkerOptions.workerSrc = workerMod.default;
  const binary = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const doc = await getDocument({ data: binary }).promise;
  const n = Math.min(doc.numPages, maxPages);
  const urls = [];
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    urls.push(canvas.toDataURL("image/jpeg", 0.92));
  }
  return urls;
}
