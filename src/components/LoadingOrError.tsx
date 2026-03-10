import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { toUserErrorMessage } from '@/lib/errors';

interface Props {
  isLoading: boolean;
  error: Error | null;
}

export const LoadingOrError = ({ isLoading, error }: Props) => {
  if (isLoading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" />
        <Text variant="bodyMedium">Cargando...</Text>
      </View>
    );
  }

  if (error) return <Text style={styles.errorText}>Error: {toUserErrorMessage(error)}</Text>;
  return null;
};

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#B3261E',
  },
});
