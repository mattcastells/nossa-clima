import { ActivityIndicator, Text } from 'react-native-paper';

import { toUserErrorMessage } from '@/lib/errors';

interface Props {
  isLoading: boolean;
  error: Error | null;
}

export const LoadingOrError = ({ isLoading, error }: Props) => {
  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text variant="bodyMedium">Error: {toUserErrorMessage(error)}</Text>;
  return null;
};
