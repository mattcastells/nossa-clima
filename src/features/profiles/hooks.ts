import { useQuery } from '@tanstack/react-query';

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
