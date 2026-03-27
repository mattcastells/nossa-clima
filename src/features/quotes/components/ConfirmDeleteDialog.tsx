import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { useAppTheme } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteDialog = ({ visible, title, message, loading = false, onCancel, onConfirm }: Props) => (
  <ConfirmDeleteDialogContent
    visible={visible}
    title={title}
    message={message}
    loading={loading}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
);

const ConfirmDeleteDialogContent = ({ visible, title, message, loading = false, onCancel, onConfirm }: Props) => {
  const theme = useAppTheme();

  return (
    <Portal>
      <AppDialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>Cancelar</Button>
          <Button
            mode="text"
            onPress={onConfirm}
            loading={loading}
            textColor={theme.colors.error}
          >
            Eliminar
          </Button>
        </Dialog.Actions>
      </AppDialog>
    </Portal>
  );
};
