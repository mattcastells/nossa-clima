import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { useAppTheme } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  /** Texto del botón destructivo. Por defecto "Eliminar". */
  confirmLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteDialog = ({
  visible,
  title,
  message,
  confirmLabel = 'Eliminar',
  loading = false,
  onCancel,
  onConfirm,
}: Props) => {
  const theme = useAppTheme();

  return (
    <Portal>
      <AppDialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button mode="text" onPress={onConfirm} loading={loading} disabled={loading} textColor={theme.colors.error}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </AppDialog>
    </Portal>
  );
};
