import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { toUserErrorMessage } from '@/lib/errors';
import { BRAND_BLUE, BRAND_BLUE_SOFT } from '@/theme';

interface Props {
  isLoading: boolean;
  error: Error | null;
}

export const LoadingOrError = ({ isLoading, error }: Props) => {
  if (isLoading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color={BRAND_BLUE} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Cargando datos...
        </Text>
      </View>
    );
  }

  if (error) return <Text style={styles.errorText}>Error: {toUserErrorMessage(error)}</Text>;
  return null;
};

const styles = StyleSheet.create({
  loadingCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE4EC',
    backgroundColor: BRAND_BLUE_SOFT,
  },
  loadingText: {
    color: BRAND_BLUE,
  },
  errorText: {
    color: '#B3261E',
  },
});
