import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deletePdfFile,
  downloadPdfFile,
  listPdfFiles,
  openPdfFile,
  uploadPdfFile,
  type PdfUploadAsset,
} from '@/services/pdfFiles';
import type { PdfFile } from '@/types/db';

const PDF_FILES_QUERY_KEY = ['pdf-files'];

export const usePdfFiles = () =>
  useQuery({
    queryKey: PDF_FILES_QUERY_KEY,
    queryFn: listPdfFiles,
  });

export const useUploadPdfFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (asset: PdfUploadAsset) => uploadPdfFile(asset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PDF_FILES_QUERY_KEY });
    },
  });
};

export const useOpenPdfFile = () =>
  useMutation({
    mutationFn: (file: PdfFile) => openPdfFile(file),
  });

export const useDownloadPdfFile = () =>
  useMutation({
    mutationFn: (file: PdfFile) => downloadPdfFile(file),
  });

export const useDeletePdfFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: PdfFile) => deletePdfFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PDF_FILES_QUERY_KEY });
    },
  });
};
