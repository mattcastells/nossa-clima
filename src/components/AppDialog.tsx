import { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog } from 'react-native-paper';

import { useAppTheme } from '@/theme';

type AppDialogProps = ComponentProps<typeof Dialog>;

export const AppDialog = ({ style, ...props }: AppDialogProps) => {
  const theme = useAppTheme();

  return <Dialog {...props} style={[styles.dialog, { backgroundColor: theme.colors.dialogSurface }, style]} />;
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
  },
});
