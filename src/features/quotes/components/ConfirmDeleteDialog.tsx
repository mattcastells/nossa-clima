import { Button, Dialog, Portal, Text } from 'react-native-paper';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteDialog = ({ visible, title, message, loading = false, onCancel, onConfirm }: Props) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onCancel}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Content>
        <Text>{message}</Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onCancel}>Cancelar</Button>
        <Button onPress={onConfirm} loading={loading} textColor="#B00020">
          Eliminar
        </Button>
      </Dialog.Actions>
    </Dialog>
  </Portal>
);
