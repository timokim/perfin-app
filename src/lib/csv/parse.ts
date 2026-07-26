import Papa from "papaparse";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length && !result.data.length) {
    throw new Error(result.errors[0]?.message ?? "Failed to parse CSV");
  }

  const headers =
    result.meta.fields?.filter((h) => h && h.trim().length > 0) ?? [];

  const rows = result.data
    .map((row) => {
      const cleaned: Record<string, string> = {};
      for (const key of headers) {
        const value = row[key];
        cleaned[key] = value == null ? "" : String(value).trim();
      }
      return cleaned;
    })
    .filter((row) => Object.values(row).some((v) => v.length > 0));

  return { headers, rows };
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  const text = await file.text();
  return parseCsvText(text);
}
