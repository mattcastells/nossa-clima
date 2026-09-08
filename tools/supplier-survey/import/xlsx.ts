/**
 * Lector de xlsx: hojas -> filas -> celdas de texto.
 *
 * No interpreta formatos ni formulas: devuelve el valor cacheado de cada celda,
 * que es lo que Excel/LibreOffice guardan junto a la formula. Para una planilla
 * de relevamiento alcanza y sobra.
 */

import { readZip, readZipText } from './zip.ts';

export interface Sheet {
  name: string;
  /** Filas indexadas por su numero real en la planilla (1-based). */
  rows: Array<{ rowNumber: number; cells: string[] }>;
}

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    // El & va al final: si no, re-decodifica lo que acabamos de escribir.
    .replace(/&amp;/g, '&');

/** "AB" -> 27. Indice 0-based de columna a partir de la referencia de celda. */
export const columnIndex = (cellRef: string): number => {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return 0;

  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
};

/** Cada <si> puede venir partido en varios <t> por los formatos internos. */
const parseSharedStrings = (xml: string | null): string[] => {
  if (!xml) return [];

  const strings: string[] = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const parts = [...(match[1] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) =>
      decodeXmlEntities(part[1] ?? ''),
    );
    strings.push(parts.join(''));
  }

  return strings;
};

const parseSheet = (xml: string, sharedStrings: readonly string[]): Sheet['rows'] => {
  const rows: Sheet['rows'] = [];

  for (const rowMatch of xml.matchAll(/<row[^>]*\sr="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];

    for (const cellMatch of (rowMatch[2] ?? '').matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';

      const reference = attributes.match(/\sr="([A-Z]+\d+)"/i)?.[1];
      if (!reference) continue;

      const type = attributes.match(/\st="([^"]+)"/)?.[1] ?? 'n';
      let value = '';

      if (type === 's') {
        const index = Number.parseInt(body.match(/<v>(\d+)<\/v>/)?.[1] ?? '-1', 10);
        value = sharedStrings[index] ?? '';
      } else if (type === 'inlineStr') {
        value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((part) => decodeXmlEntities(part[1] ?? ''))
          .join('');
      } else {
        // Numeros, fechas y el valor cacheado de las formulas.
        value = decodeXmlEntities(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
      }

      const column = columnIndex(reference);
      while (cells.length < column) cells.push('');
      cells[column] = value;
    }

    if (cells.length > 0) rows.push({ rowNumber: Number.parseInt(rowMatch[1] ?? '0', 10), cells });
  }

  return rows;
};

export const readWorkbook = (fileBuffer: Buffer): Sheet[] => {
  const entries = readZip(fileBuffer);

  const workbookXml = readZipText(entries, 'xl/workbook.xml');
  if (!workbookXml) throw new Error('El archivo no parece un xlsx: falta xl/workbook.xml.');

  const sharedStrings = parseSharedStrings(readZipText(entries, 'xl/sharedStrings.xml'));

  // El orden de <sheet> en workbook.xml es el orden de sheet1.xml, sheet2.xml…
  const names = [...workbookXml.matchAll(/<sheet[^>]*\sname="([^"]*)"/g)].map((match) =>
    decodeXmlEntities(match[1] ?? ''),
  );

  const sheets: Sheet[] = [];

  for (const [index, name] of names.entries()) {
    const xml = readZipText(entries, `xl/worksheets/sheet${index + 1}.xml`);
    if (!xml) continue;
    sheets.push({ name, rows: parseSheet(xml, sharedStrings) });
  }

  return sheets;
};

/** Busca una hoja por nombre, sin distinguir mayusculas ni tildes sobrantes. */
export const findSheet = (sheets: readonly Sheet[], name: string): Sheet | null => {
  const target = name.trim().toLowerCase();
  return sheets.find((sheet) => sheet.name.trim().toLowerCase() === target) ?? null;
};

/** Celda como texto limpio. Fuera de rango devuelve ''. */
export const cell = (row: { cells: string[] }, index: number): string => (row.cells[index] ?? '').trim();
