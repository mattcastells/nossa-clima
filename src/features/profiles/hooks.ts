import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { listProfileDirectory } from '@/services/profiles';

const normalizeIds = (ids: string[]): string[] => Array.from(new Set(ids.filter(Boolean))).sort();

export const useProfileDirectory = (ids: string[]) => {
  const normalizedIds = normalizeIds(ids);

  return useQuery({
    queryKey: ['profile-directory', normalizedIds.join(',')],
    queryFn: () => listProfileDirectory(normalizedIds),
    enabled: normalizedIds.length > 0,
  });
};

/**
 * Nombre del técnico logueado, para precargar "Técnico encargado" al crear un
 * trabajo. Devuelve '' si todavía no cargó o si el perfil no tiene nombre: el
 * campo es editable igual.
 */
export const useCurrentTechnicianName = (): string => {
  const userId = useAuthStore((state) => state.userId);
  const { data } = useProfileDirectory(userId ? [userId] : []);
  return data?.[0]?.full_name?.trim() ?? '';
};
