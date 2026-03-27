import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useDeletePdfFile, useDownloadPdfFile, useOpenPdfFile, usePdfFiles, useUploadPdfFile } from '@/features/pdfFiles/hooks';
import { ConfirmDeleteDialog } from '@/features/quotes/components/ConfirmDeleteDialog';
import { toUserErrorMessage } from '@/lib/errors';
import { formatDateTimeAr } from '@/lib/format';
import { MAX_PDF_FILE_SIZE_BYTES } from '@/services/pdfFiles';
import { useAppTheme } from '@/theme';
import type { PdfFile } from '@/types/db';

const MAX_PDF_SIZE_MB = Math.round(MAX_PDF_FILE_SIZE_BYTES / (1024 * 1024));

const formatFileSize = (value: number): string => {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
};

export default function DocumentsScreen() {
  const theme = useAppTheme();
  const toast = useAppToast();
  const { data, isLoading, error } = usePdfFiles();
  const uploadPdf = useUploadPdfFile();
  const openPdf = useOpenPdfFile();
  const downloadPdf = useDownloadPdfFile();
  const deletePdf = useDeletePdfFile();
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PdfFile | null>(null);

  const pdfFiles = data ?? [];
  const isBusy = Boolean(pendingActionKey) || uploadPdf.isPending || openPdf.isPending || downloadPdf.isPending || deletePdf.isPending;

  const pickPdf = async () => {
    try {
      setPendingActionKey('upload');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) {
        throw new Error('No se encontro ningun PDF para cargar.');
      }

      await uploadPdf.mutateAsync({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      });

      toast.success('PDF cargado.');
    } catch (uploadError) {
      toast.error(toUserErrorMessage(uploadError, 'No se pudo cargar el PDF.'));
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleOpen = async (file: PdfFile) => {
    try {
      setPendingActionKey(`open:${file.id}`);
      await openPdf.mutateAsync(file);
    } catch (openError) {
      toast.error(toUserErrorMessage(openError, 'No se pudo abrir el PDF.'));
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleDownload = async (file: PdfFile) => {
    try {
      setPendingActionKey(`download:${file.id}`);
      await downloadPdf.mutateAsync(file);

      if (Platform.OS === 'android') {
        toast.success('PDF descargado en la carpeta seleccionada.');
      } else if (Platform.OS === 'web') {
        toast.success('Descarga iniciada.');
      } else {
        toast.success('Elegi donde guardar el PDF.');
      }
    } catch (downloadError) {
      toast.error(toUserErrorMessage(downloadError, 'No se pudo descargar el PDF.'));
    } finally {
      setPendingActionKey(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setPendingActionKey(`delete:${deleteTarget.id}`);
      await deletePdf.mutateAsync(deleteTarget);
      toast.success('PDF eliminado.');
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error(toUserErrorMessage(deleteError, 'No se pudo eliminar el PDF.'));
    } finally {
      setPendingActionKey(null);
    }
  };

  return (
    <AppScreen title="PDFs">
      <Card mode="contained" style={[styles.heroCard, { backgroundColor: theme.colors.softBlue }]}>
        <Card.Content style={styles.heroContent}>
          <Text variant="titleMedium" style={{ color: theme.colors.titleOnSoft }}>
            Carga y consulta PDFs desde la app
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Sube manuales, fichas tecnicas o archivos de trabajo y luego abre o descarga cada PDF cuando lo necesites.
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            Limite por archivo: {MAX_PDF_SIZE_MB} MB.
          </Text>
          <Button
            mode="contained"
            icon="file-upload-outline"
            onPress={pickPdf}
            loading={pendingActionKey === 'upload'}
            disabled={isBusy}
            style={styles.uploadButton}
          >
            Cargar manual
          </Button>
        </Card.Content>
      </Card>

      <LoadingOrError isLoading={isLoading} error={error} />

      {!isLoading && !error && pdfFiles.length === 0 ? (
        <Card mode="outlined" style={[styles.emptyCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.emptyContent}>
            <Text variant="titleMedium" style={{ color: theme.colors.titleOnSoft }}>
              Todavia no hay PDFs cargados
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Usa el boton de arriba para subir el primer archivo y dejarlo disponible dentro de la app.
            </Text>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.list}>
        {pdfFiles.map((file, index) => (
          <AnimatedEntrance key={file.id} delay={70 + index * 35} distance={10}>
            <Card mode="outlined" style={[styles.fileCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.fileContent}>
                <View style={styles.fileHeader}>
                  <View style={styles.fileTitleBlock}>
                    <Text variant="titleMedium" style={{ color: theme.colors.titleOnSoft }} numberOfLines={2}>
                      {file.file_name}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted }}>
                      {formatFileSize(file.file_size_bytes)} - {formatDateTimeAr(file.created_at)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    mode="contained-tonal"
                    icon="file-eye-outline"
                    onPress={() => void handleOpen(file)}
                    loading={pendingActionKey === `open:${file.id}`}
                    disabled={isBusy}
                    style={styles.actionButton}
                  >
                    Abrir
                  </Button>
                  <Button
                    mode="outlined"
                    icon="download"
                    onPress={() => void handleDownload(file)}
                    loading={pendingActionKey === `download:${file.id}`}
                    disabled={isBusy}
                    style={styles.actionButton}
                  >
                    Descargar
                  </Button>
                  <Button
                    mode="text"
                    textColor={theme.colors.error}
                    icon="trash-can-outline"
                    onPress={() => setDeleteTarget(file)}
                    disabled={isBusy}
                    style={styles.deleteButton}
                  >
                    Eliminar
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </AnimatedEntrance>
        ))}
      </View>

      <ConfirmDeleteDialog
        visible={Boolean(deleteTarget)}
        title="Eliminar PDF"
        message={`Seguro que queres eliminar "${deleteTarget?.file_name ?? 'este PDF'}"?`}
        loading={pendingActionKey === `delete:${deleteTarget?.id ?? ''}`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 16,
  },
  heroContent: {
    gap: 12,
  },
  uploadButton: {
    alignSelf: 'flex-start',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyContent: {
    gap: 8,
    paddingVertical: 10,
  },
  list: {
    gap: 12,
  },
  fileCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  fileContent: {
    gap: 14,
    paddingVertical: 10,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  fileTitleBlock: {
    flex: 1,
    gap: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
  },
  deleteButton: {
    alignSelf: 'center',
  },
});
