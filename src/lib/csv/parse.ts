import Papa from "papaparse";
import { rowLooksLikeHeader } from "./infer";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  /** True when the first CSV row was treated as column names. */
  hasHeaderRow: boolean;
}

function syntheticHeaders(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
}

function cellsToRow(
  cells: string[],
  headers: string[],
): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    cleaned[headers[i]!] = (cells[i] ?? "").trim();
  }
  return cleaned;
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
  });

  if (result.errors.length && !result.data.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to parse CSV");
  }

  const matrix = result.data
    .map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (matrix.length === 0) {
    return { headers: [], rows: [], hasHeaderRow: false };
  }

  const columnCount = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  const firstRow = matrix[0] ?? [];
  const hasHeaderRow = rowLooksLikeHeader(firstRow);

  const headers = hasHeaderRow
    ? Array.from({ length: columnCount }, (_, i) => {
        const raw = (firstRow[i] ?? "").trim();
        return raw || `Column ${i + 1}`;
      })
    : syntheticHeaders(columnCount);

  // Deduplicate headers so Record keys stay unique.
  const uniqueHeaders = headers.map((h, i) => {
    const dup = headers.indexOf(h) !== i;
    return dup ? `${h} (${i + 1})` : h;
  });

  const dataRows = hasHeaderRow ? matrix.slice(1) : matrix;
  const rows = dataRows
    .map((cells) => cellsToRow(cells, uniqueHeaders))
    .filter((row) => Object.values(row).some((v) => v.length > 0));

  return { headers: uniqueHeaders, rows, hasHeaderRow };
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  const text = await file.text();
  return parseCsvText(text);
}
