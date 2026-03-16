import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { toUserErrorMessage } from '@/lib/errors';
import { useAppTheme } from '@/theme';

interface Props {
  isLoading: boolean;
  error: Error | null;
}

export const LoadingOrError = ({ isLoading, error }: Props) => {
  const theme = useAppTheme();

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingCard,
          {
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.softBlue,
          },
        ]}
      >
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.titleOnSoft }]}>
          Cargando datos...
        </Text>
      </View>
    );
  }

  if (error) return <Text style={[styles.errorText, { color: theme.colors.error }]}>Error: {toUserErrorMessage(error)}</Text>;
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
  },
  loadingText: {},
  errorText: {
    color: '#B3261E',
  },
});
