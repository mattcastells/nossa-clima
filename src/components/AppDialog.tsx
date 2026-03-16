import { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog } from 'react-native-paper';

type AppDialogProps = ComponentProps<typeof Dialog>;

export const AppDialog = ({ style, ...props }: AppDialogProps) => <Dialog {...props} style={[styles.dialog, style]} />;

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    backgroundColor: '#F8F3FB',
  },
});
