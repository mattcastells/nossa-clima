import { Pressable, StyleSheet, TextInput as NativeTextInput, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme';

interface Props {
  actionLabel: string;
  onActionPress: () => void;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  actionAccessibilityLabel?: string;
  searchAccessibilityLabel?: string;
  accentBackgroundColor?: string;
  accentBorderColor?: string;
  accentTextColor?: string;
}

export const ActionSearchComposer = ({
  actionLabel,
  onActionPress,
  value,
  onChangeText,
  placeholder,
  actionAccessibilityLabel,
  searchAccessibilityLabel,
  accentBackgroundColor,
  accentBorderColor,
  accentTextColor,
}: Props) => {
  const theme = useAppTheme();
  const segmentBackgroundColor = accentBackgroundColor ?? (theme.dark ? '#47627F' : '#ECF4FD');
  const segmentBorderColor = accentBorderColor ?? (theme.dark ? '#FFFFFF' : '#D2E1F3');
  const segmentTextColor = accentTextColor ?? (theme.dark ? theme.colors.titleOnSoft : theme.colors.primary);

  return (
    <View
      style={[
        styles.searchComposer,
        {
          backgroundColor: theme.dark ? '#2B3138' : theme.colors.surface,
          borderColor: theme.colors.borderSoft,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
        onPress={onActionPress}
        style={({ pressed }) => [
          styles.actionSegment,
          {
            backgroundColor: segmentBackgroundColor,
            borderRightColor: segmentBorderColor,
          },
          pressed && styles.actionSegmentPressed,
        ]}
      >
        <Text style={[styles.actionSegmentText, { color: segmentTextColor }]}>{actionLabel}</Text>
      </Pressable>

      <View style={styles.searchInputSegment}>
        <Icon source="magnify" size={20} color={theme.colors.textMuted} />
        <NativeTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          selectionColor={theme.colors.primary}
          accessibilityLabel={searchAccessibilityLabel ?? placeholder}
          returnKeyType="search"
        />
        {value.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpiar busqueda"
            onPress={() => onChangeText('')}
            style={({ pressed }) => [styles.clearSearchButton, pressed && styles.clearSearchButtonPressed]}
          >
            <Icon source="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  searchComposer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionSegment: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  actionSegmentPressed: {
    opacity: 0.88,
  },
  actionSegmentText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  searchInputSegment: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 15,
    lineHeight: 20,
  },
  clearSearchButton: {
    paddingVertical: 6,
  },
  clearSearchButtonPressed: {
    opacity: 0.72,
  },
});
