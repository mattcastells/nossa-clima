import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { logDevWarning } from '@/lib/devLogger';
import { supabase } from '@/lib/supabase';
import type { PdfFile } from '@/types/db';
import { isMissingSupabaseRelationError } from './supabaseCompatibility';

const PDF_STORAGE_BUCKET = 'user-pdfs';
const PDF_SIGNED_URL_TTL_SECONDS = 60 * 15;
export const MAX_PDF_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export interface PdfUploadAsset {
  uri: string;
  name: string;
  mimeType?: string | null | undefined;
  size?: number | null | undefined;
}

interface StorageErrorLike {
  message?: string | null;
  details?: string | null;
  error?: string | null;
  statusCode?: string | number | null;
  status?: number | null;
}

const getPdfFeatureMissingMigrationError = (): Error =>
  new Error('Falta aplicar la migracion de PDFs en Supabase.');

const getStorageErrorText = (error: StorageErrorLike | null | undefined): string =>
  [error?.message, error?.details, error?.error]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

const isMissingPdfStorageBucketError = (error: StorageErrorLike | null | undefined): boolean => {
  if (!error) return false;

  const text = getStorageErrorText(error);
  return text.includes('bucket') && (text.includes('not found') || text.includes('does not exist') || text.includes('missing'));
};

const getCurrentUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const userId = data.user?.id;
  if (!userId) {
    throw new Error('No hay una sesion activa para cargar PDFs.');
  }

  return userId;
};

const ensurePdfFileName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return 'documento.pdf';

  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
};

const sanitizeStorageFileName = (value: string): string => {
  const normalized = ensurePdfFileName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const withoutExtension = normalized.replace(/\.pdf$/i, '');
  const safeBase = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeBase || 'documento'}.pdf`;
};

const decodeBase64ToArrayBuffer = (value: string): ArrayBuffer => {
  const normalized = value.replace(/\s+/g, '');

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const paddingLength = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const outputLength = (normalized.length / 4) * 3 - paddingLength;
  const bytes = new Uint8Array(outputLength);
  let byteIndex = 0;

  for (let index = 0; index < normalized.length; index += 4) {
    const chunk = normalized.slice(index, index + 4);
    const enc1 = alphabet.indexOf(chunk[0] ?? 'A');
    const enc2 = alphabet.indexOf(chunk[1] ?? 'A');
    const enc3 = chunk[2] === '=' ? 0 : alphabet.indexOf(chunk[2] ?? 'A');
    const enc4 = chunk[3] === '=' ? 0 : alphabet.indexOf(chunk[3] ?? 'A');

    const triple = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;

    bytes[byteIndex] = (triple >> 16) & 255;
    byteIndex += 1;

    if (chunk[2] !== '=' && byteIndex < outputLength) {
      bytes[byteIndex] = (triple >> 8) & 255;
      byteIndex += 1;
    }

    if (chunk[3] !== '=' && byteIndex < outputLength) {
      bytes[byteIndex] = triple & 255;
      byteIndex += 1;
    }
  }

  return bytes.buffer;
};

const readUploadBytes = async (asset: PdfUploadAsset): Promise<ArrayBuffer> => {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error('No se pudo leer el PDF seleccionado.');
    }
    return response.arrayBuffer();
  }

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('No se pudo leer el PDF seleccionado.');
  }

  return decodeBase64ToArrayBuffer(base64);
};

const getSignedPdfUrl = async (storagePath: string, downloadFileName?: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(PDF_STORAGE_BUCKET)
    .createSignedUrl(storagePath, PDF_SIGNED_URL_TTL_SECONDS, downloadFileName ? { download: downloadFileName } : undefined);

  if (error) {
    if (isMissingPdfStorageBucketError(error)) {
      throw getPdfFeatureMissingMigrationError();
    }
    throw error;
  }
  if (!data?.signedUrl) {
    throw new Error('No se pudo preparar el PDF.');
  }

  return data.signedUrl;
};

const getWorkingDirectory = (): string => {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('No se encontro una carpeta disponible para manejar PDFs.');
  }

  return directory;
};

const buildTempPdfUri = (fileName: string): string => `${getWorkingDirectory()}${Date.now()}-${sanitizeStorageFileName(fileName)}`;

const splitFileName = (value: string): { base: string; extension: string } => {
  const extensionIndex = value.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return { base: value, extension: '' };
  }

  return {
    base: value.slice(0, extensionIndex),
    extension: value.slice(extensionIndex),
  };
};

const createUniqueSafFileUri = async (
  directoryUri: string,
  fileName: string,
  mimeType: string,
  storageAccessFramework: typeof FileSystem.StorageAccessFramework,
): Promise<string> => {
  try {
    return await storageAccessFramework.createFileAsync(directoryUri, fileName, mimeType);
  } catch {
    const { base, extension } = splitFileName(fileName);
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    return storageAccessFramework.createFileAsync(directoryUri, `${base}-${timestamp}${extension}`, mimeType);
  }
};

const requestAndroidPdfDirectoryUri = async (
  storageAccessFramework: typeof FileSystem.StorageAccessFramework,
): Promise<string> => {
  const downloadsRootUri = storageAccessFramework.getUriForDirectoryInRoot('Download');
  const preferredPermission = await storageAccessFramework.requestDirectoryPermissionsAsync(downloadsRootUri);
  if (preferredPermission.granted && preferredPermission.directoryUri) {
    return preferredPermission.directoryUri;
  }

  const fallbackPermission = await storageAccessFramework.requestDirectoryPermissionsAsync();
  if (!fallbackPermission.granted || !fallbackPermission.directoryUri) {
    throw new Error('No se otorgo permiso para guardar el PDF. Selecciona una carpeta para continuar.');
  }

  return fallbackPermission.directoryUri;
};

const triggerWebDownload = async (url: string, fileName: string): Promise<void> => {
  if (typeof document === 'undefined') {
    await Linking.openURL(url);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeStorageFileName(fileName);
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const listPdfFiles = async (): Promise<PdfFile[]> => {
  const { data, error } = await supabase.from('pdf_files').select('*').order('created_at', { ascending: false });
  if (error) {
    if (isMissingSupabaseRelationError(error, 'pdf_files')) {
      return [];
    }
    throw error;
  }
  return data ?? [];
};

export const uploadPdfFile = async (asset: PdfUploadAsset): Promise<PdfFile> => {
  const userId = await getCurrentUserId();
  const displayFileName = ensurePdfFileName(asset.name);

  if ((asset.size ?? 0) > MAX_PDF_FILE_SIZE_BYTES) {
    throw new Error('El PDF supera el limite de 20 MB.');
  }

  const fileBytes = await readUploadBytes(asset);
  if (fileBytes.byteLength === 0) {
    throw new Error('El PDF seleccionado esta vacio.');
  }

  if (fileBytes.byteLength > MAX_PDF_FILE_SIZE_BYTES) {
    throw new Error('El PDF supera el limite de 20 MB.');
  }

  const storagePath = `${userId}/${Date.now()}-${sanitizeStorageFileName(displayFileName)}`;
  const { error: uploadError } = await supabase.storage.from(PDF_STORAGE_BUCKET).upload(storagePath, fileBytes, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) {
    if (isMissingPdfStorageBucketError(uploadError)) {
      throw getPdfFeatureMissingMigrationError();
    }
    throw uploadError;
  }

  try {
    const { data, error } = await supabase
      .from('pdf_files')
      .insert({
        user_id: userId,
        file_name: displayFileName,
        storage_path: storagePath,
        mime_type: 'application/pdf',
        file_size_bytes: fileBytes.byteLength,
      })
      .select()
      .single();

    if (error) {
      if (isMissingSupabaseRelationError(error, 'pdf_files')) {
        throw getPdfFeatureMissingMigrationError();
      }
      throw error;
    }
    return data;
  } catch (error) {
    const cleanup = await supabase.storage.from(PDF_STORAGE_BUCKET).remove([storagePath]);
    if (cleanup.error) {
      logDevWarning('Failed to clean up orphan PDF after DB insert error.', cleanup.error);
    }
    throw error;
  }
};

export const openPdfFile = async (file: PdfFile): Promise<void> => {
  const signedUrl = await getSignedPdfUrl(file.storage_path);

  // Protect devices from attempting to open very large PDFs that could OOM.
  if (file.file_size_bytes && file.file_size_bytes > MAX_PDF_FILE_SIZE_BYTES) {
    throw new Error('El PDF es demasiado grande para abrir en el dispositivo.');
  }

  if (Platform.OS === 'web' || Platform.OS === 'ios') {
    await Linking.openURL(signedUrl);
    return;
  }

  const downloadResult = await FileSystem.downloadAsync(signedUrl, buildTempPdfUri(file.file_name));

  try {
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/pdf',
    });
  } catch {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Abrir PDF',
        UTI: '.pdf',
      });
      return;
    }

    await Linking.openURL(signedUrl);
  }
};

export const downloadPdfFile = async (file: PdfFile): Promise<void> => {
  const signedUrl = await getSignedPdfUrl(file.storage_path, sanitizeStorageFileName(file.file_name));

  if (Platform.OS === 'web') {
    await triggerWebDownload(signedUrl, file.file_name);
    return;
  }

  const downloadResult = await FileSystem.downloadAsync(signedUrl, buildTempPdfUri(file.file_name));

  // Prevent loading huge files into memory on device when using StorageAccessFramework / readAsStringAsync
  if (file.file_size_bytes && file.file_size_bytes > MAX_PDF_FILE_SIZE_BYTES) {
    // Cleanup the downloaded temporary file and inform caller
    try {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
    } catch (_err) {
      // ignore cleanup failure
    }
    throw new Error('El PDF es demasiado grande para descargar en el dispositivo.');
  }

  try {
    if (Platform.OS === 'android') {
      const { StorageAccessFramework } = FileSystem;
      const directoryUri = await requestAndroidPdfDirectoryUri(StorageAccessFramework);
  const fileBase64 = await FileSystem.readAsStringAsync(downloadResult.uri, { encoding: FileSystem.EncodingType.Base64 });
      const targetUri = await createUniqueSafFileUri(directoryUri, sanitizeStorageFileName(file.file_name), 'application/pdf', StorageAccessFramework);
      await StorageAccessFramework.writeAsStringAsync(targetUri, fileBase64, { encoding: FileSystem.EncodingType.Base64 });
      return;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Guardar PDF',
        UTI: '.pdf',
      });
      return;
    }

    const targetDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    if (!targetDirectory) {
      throw new Error('No se encontro una carpeta disponible para guardar el PDF.');
    }

    await FileSystem.copyAsync({
      from: downloadResult.uri,
      to: `${targetDirectory}${sanitizeStorageFileName(file.file_name)}`,
    });
  } finally {
    try {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
    } catch {
      // Ignore temporary file cleanup failures.
    }
  }
};

export const deletePdfFile = async (file: PdfFile): Promise<void> => {
  const { error } = await supabase.from('pdf_files').delete().eq('id', file.id);
  if (error) {
    if (isMissingSupabaseRelationError(error, 'pdf_files')) {
      throw getPdfFeatureMissingMigrationError();
    }
    throw error;
  }

  const storageResult = await supabase.storage.from(PDF_STORAGE_BUCKET).remove([file.storage_path]);
  if (storageResult.error && !isMissingPdfStorageBucketError(storageResult.error)) {
    logDevWarning('Failed to remove PDF binary from storage after deleting metadata.', storageResult.error);
  }
};
