import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Card, Dialog, IconButton, Text, TextInput } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast } from '@/components/AppToastProvider';
import { sendAssistantMessage, type AssistantHistoryMessage } from '@/services/assistant';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN_SOFT } from '@/theme';

type PendingImage = {
  uri: string;
  dataUrl: string;
  name: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUri?: string | null;
  imageDataUrl?: string | null;
  pending?: boolean;
};

const createLocalId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export default function AssistantScreen() {
  const toast = useAppToast();
  const scrollRef = useRef<ScrollView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const canSend = input.trim().length > 0 || pendingImage != null;
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [isSending, messages.length]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Hace falta permiso para acceder a tus imagenes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      toast.error('No se pudo leer la imagen seleccionada.');
      return;
    }

    const mimeType = asset.mimeType?.trim() || 'image/jpeg';
    setPendingImage({
      uri: asset.uri,
      dataUrl: `data:${mimeType};base64,${asset.base64}`,
      name: asset.fileName?.trim() || 'Imagen adjunta',
    });
  };

  const clearConversation = () => {
    setMessages([]);
    setInput('');
    setPendingImage(null);
    toast.success('Conversacion reiniciada.');
  };

  const requestConversationReset = () => {
    if (messages.length === 0 && !pendingImage && !input) return;
    setShowResetDialog(true);
  };

  const submit = async () => {
    if (!canSend || isSending) return;

    const text = input.trim();
    const image = pendingImage;
    const pendingAssistantId = createLocalId('assistant-pending');

    const userMessage: ChatMessage = {
      id: createLocalId('user'),
      role: 'user',
      text: text || (image ? 'Imagen adjunta' : ''),
      imageUri: image?.uri ?? null,
      imageDataUrl: image?.dataUrl ?? null,
    };
    const history: AssistantHistoryMessage[] = [...messages.filter((message) => !message.pending), userMessage].map((message) => ({
      role: message.role,
      text: message.text,
      imageDataUrl: message.role === 'user' ? message.imageDataUrl ?? null : null,
    }));

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: pendingAssistantId,
        role: 'assistant',
        text: '',
        pending: true,
      },
    ]);
    setInput('');
    setPendingImage(null);
    setIsSending(true);

    try {
      const reply = await sendAssistantMessage({ history });
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingAssistantId
            ? {
                id: createLocalId('assistant'),
                role: 'assistant',
                text: reply.text,
              }
            : message,
        ),
      );
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== pendingAssistantId));
      toast.error(error instanceof Error ? error.message : 'No se pudo consultar el asistente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppScreen scrollable={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.titleRow}>
          <Text variant="headlineSmall">Asistente AI</Text>
          <IconButton
            icon="refresh"
            size={18}
            mode="contained-tonal"
            containerColor={BRAND_BLUE_SOFT}
            iconColor={BRAND_BLUE}
            onPress={requestConversationReset}
            disabled={messages.length === 0 && !pendingImage && !input}
            accessibilityLabel="Nueva conversacion"
          />
        </View>

        {messages.length === 0 ? (
          <Card mode="outlined" style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="titleMedium">Todavia no hay mensajes</Text>
              <Text style={styles.helperText}>Proba con una consulta tecnica o una foto del equipo para analizar.</Text>
            </Card.Content>
          </Card>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length > 0 ? (
            messages.map((message) => (
              <View
                key={message.id}
                style={[styles.messageRow, message.role === 'user' ? styles.userRow : styles.assistantRow]}
              >
                <Card
                  mode="outlined"
                  style={[
                    styles.messageBubble,
                    message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Card.Content style={styles.messageContent}>
                    {message.imageUri ? <Image source={{ uri: message.imageUri }} style={styles.messageImage} /> : null}
                    {message.pending ? (
                      <View style={styles.pendingRow}>
                        <ActivityIndicator size="small" color={BRAND_BLUE} />
                        <Text style={styles.pendingText}>Pensando respuesta...</Text>
                      </View>
                    ) : (
                      <Text style={styles.messageText}>{message.text}</Text>
                    )}
                  </Card.Content>
                </Card>
              </View>
            ))
          ) : null}
        </ScrollView>

        <Card mode="outlined" style={styles.composerCard}>
          <Card.Content style={styles.composerContent}>
            {pendingImage ? (
              <View style={styles.previewRow}>
                <Image source={{ uri: pendingImage.uri }} style={styles.previewImage} />
                <View style={styles.previewCopy}>
                  <Text variant="labelLarge">{pendingImage.name}</Text>
                  <Text style={styles.helperText}>Se enviara con el proximo mensaje.</Text>
                </View>
                <IconButton icon="close" size={18} onPress={() => setPendingImage(null)} />
              </View>
            ) : null}

            <TextInput
              mode="outlined"
              label="Consulta"
              value={input}
              onChangeText={setInput}
              multiline
              numberOfLines={4}
              outlineStyle={styles.inputOutline}
              placeholder="Escribi tu consulta para el asistente"
            />

            <View style={styles.composerActions}>
              <Button mode="outlined" icon="image-outline" onPress={pickImage} style={styles.attachButton}>
                Imagen
              </Button>
              <Button
                mode="contained"
                icon="send"
                onPress={submit}
                loading={isSending}
                disabled={!canSend || isSending}
                style={styles.sendButton}
              >
                Enviar
              </Button>
            </View>
          </Card.Content>
        </Card>

        <AppDialog visible={showResetDialog} onDismiss={() => setShowResetDialog(false)}>
          <Dialog.Title>Nueva conversacion</Dialog.Title>
          <Dialog.Content>
            <Text>Se van a borrar los mensajes actuales. Queres continuar?</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowResetDialog(false)}>Cancelar</Button>
            <Button
              onPress={() => {
                setShowResetDialog(false);
                clearConversation();
              }}
            >
              Reiniciar
            </Button>
          </Dialog.Actions>
        </AppDialog>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
  },
  helperText: {
    color: '#5f6368',
    lineHeight: 18,
  },
  messagesScroll: {
    flex: 1,
    minHeight: 0,
  },
  messagesContent: {
    gap: 10,
    paddingBottom: 4,
  },
  emptyCard: {
    borderRadius: 16,
    borderStyle: 'dashed',
  },
  emptyContent: {
    gap: 8,
    paddingVertical: 12,
  },
  messageRow: {
    width: '100%',
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    width: '88%',
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: BRAND_BLUE_SOFT,
    borderColor: '#C7D5E7',
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE4EC',
  },
  messageContent: {
    gap: 10,
    paddingVertical: 10,
  },
  messageText: {
    lineHeight: 20,
  },
  messageImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#E6EBF1',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingText: {
    color: '#5f6368',
  },
  composerCard: {
    borderRadius: 16,
  },
  composerContent: {
    gap: 12,
    paddingVertical: 10,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BRAND_GREEN_SOFT,
    borderRadius: 14,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 8,
  },
  previewImage: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#DCE4EC',
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  inputOutline: {
    borderRadius: 12,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  attachButton: {
    flex: 1,
    borderRadius: 12,
  },
  sendButton: {
    flex: 1,
    borderRadius: 12,
  },
  dialogActions: {
    justifyContent: 'center',
    gap: 8,
  },
});
