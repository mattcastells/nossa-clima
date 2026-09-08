/**
 * Lector minimo de ZIP.
 *
 * Un .xlsx es un ZIP con XML adentro. Node no trae lector de ZIP, y traer una
 * dependencia entera para leer una planilla por mes no se justifica: alcanza
 * con recorrer el directorio central e inflar cada entrada.
 *
 * Soporta lo unico que usan los generadores de xlsx: entradas guardadas
 * (metodo 0) y deflate (metodo 8).
 */

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;

/** El EOCD esta al final, despues de un comentario de hasta 64 KB. */
const findEndOfCentralDirectory = (buffer: Buffer): number => {
  const minOffset = Math.max(0, buffer.length - 0x10000 - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }

  return -1;
};

export interface ZipEntry {
  name: string;
  read: () => Buffer;
}

export const readZip = (buffer: Buffer): Map<string, ZipEntry> => {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) throw new Error('El archivo no es un ZIP valido (no encontre el directorio central).');

  if (buffer.readUInt32LE(eocd - 20) === ZIP64_LOCATOR_SIGNATURE) {
    throw new Error('El archivo usa ZIP64. Volve a guardar la planilla en formato xlsx normal.');
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);

  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`Entrada ${index} corrupta en el directorio central del ZIP.`);
    }

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    entries.set(name, {
      name,
      read: () => {
        if (buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
          throw new Error(`Cabecera local invalida para "${name}".`);
        }

        // La cabecera local tiene sus propias longitudes: no se pueden reusar
        // las del directorio central, suelen diferir en el campo extra.
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localNameLength + localExtraLength;
        const data = buffer.subarray(start, start + compressedSize);

        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);

        throw new Error(`Metodo de compresion ${method} no soportado en "${name}".`);
      },
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};

/** Lee una entrada como texto UTF-8. Null si no esta. */
export const readZipText = (entries: Map<string, ZipEntry>, name: string): string | null => {
  const entry = entries.get(name);
  return entry ? entry.read().toString('utf8') : null;
};
