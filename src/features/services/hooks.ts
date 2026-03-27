import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createServiceCategory,
  deleteService,
  deleteServiceCategory,
  listServiceCategoryNames,
  listServices,
  renameServiceCategory,
  upsertService,
} from '@/services/services';
import type { Service } from '@/types/db';

export const useServices = () => useQuery({ queryKey: ['services'], queryFn: listServices });
export const useServiceCategories = () => useQuery({ queryKey: ['service-categories'], queryFn: listServiceCategoryNames });

const invalidateServiceQueries = async (queryClient: ReturnType<typeof useQueryClient>): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['services'] }),
    queryClient.invalidateQueries({ queryKey: ['service-categories'] }),
  ]);
};

export const useSaveService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Service> & { name: string }) => upsertService(payload),
    onSuccess: () => invalidateServiceQueries(queryClient),
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => deleteService(serviceId),
    onSuccess: () => invalidateServiceQueries(queryClient),
  });
};

export const useCreateServiceCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryName: string) => createServiceCategory(categoryName),
    onSuccess: () => invalidateServiceQueries(queryClient),
  });
};

export const useRenameServiceCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currentName, nextName }: { currentName: string; nextName: string }) =>
      renameServiceCategory({ currentName, nextName }),
    onSuccess: () => invalidateServiceQueries(queryClient),
  });
};

export const useDeleteServiceCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryName: string) => deleteServiceCategory(categoryName),
    onSuccess: () => invalidateServiceQueries(queryClient),
  });
};
