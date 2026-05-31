import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface TextItem {
  str: string;
  transform: number[];
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const allLines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];

    // Group text items by their Y position (row on the page).
    // transform[5] is the Y coordinate; items with the same (or very close) Y
    // belong to the same visual line. We bucket with ~2pt tolerance.
    const rowMap = new Map<number, string[]>();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2; // 2-pt bucket
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push(item.str);
    }

    // Sort rows top-to-bottom (higher Y = higher on page in PDF coords).
    const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineText = rowMap.get(y)!.join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) allLines.push(lineText);
    }
  }

  return allLines.join('\n');
}
