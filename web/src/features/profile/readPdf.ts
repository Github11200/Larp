// Resumes are parsed in the browser, so the API only ever receives text. pdf.js loads on first use.
// Legacy build: the modern one needs very new JS (Uint8Array.toHex) that many phones lack.
export async function readPdf(file: File): Promise<string> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, i) => {
      const { items } = await (await doc.getPage(i + 1)).getTextContent();
      return items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
    }),
  );
  return pages.join("\n").trim();
}
