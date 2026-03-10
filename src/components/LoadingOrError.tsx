import { ActivityIndicator, Text } from 'react-native-paper';

interface Props {
  isLoading: boolean;
  error: Error | null;
}

export const LoadingOrError = ({ isLoading, error }: Props) => {
  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text variant="bodyMedium">Error: {error.message}</Text>;
  return null;
};
