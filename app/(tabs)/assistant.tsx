import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  ASSISTANT_AUDIO_MAX_DURATION_MS,
  ASSISTANT_RECORDING_OPTIONS,
  configureAudioModeForRecording,
  ensureAssistantAudioPermission,
  finalizeAssistantRecording,
  formatAssistantAudioDuration,
  resetAudioModeAfterRecording,
  type PendingAssistantAudio,
} from '@/features/assistant/audio';
import {
  getAssistantActionDetails,
  getAssistantActionTypeLabel,
  isAssistantActionExecutable,
  needsAssistantActionFollowUp,
  normalizeAssistantAction,
  serializeAssistantActionDraft,
  type AssistantActionDraft,
} from '@/features/assistant/actions';
import { useCreateAppointment } from '@/features/appointments/hooks';
import { useUpsertQuoteAppointment } from '@/features/appointments/hooks';
import { useSaveItem } from '@/features/items/hooks';
import { useCreatePrice } from '@/features/prices/hooks';
import { useAddQuoteMaterialItem, useAddQuoteServiceItem, useSaveQuote } from '@/features/quotes/hooks';
import { useSaveService } from '@/features/services/hooks';
import { useSaveStore } from '@/features/stores/hooks';
import { formatIsoDate } from '@/lib/dateTimeInput';
import { formatCurrencyArs, formatPercent } from '@/lib/format';
import { sendAssistantMessage, type AssistantHistoryMessage } from '@/services/assistant';
import { useAppTheme } from '@/theme';
import { executeAssistantActionDraft, validateAssistantActionDraft } from '@/features/assistant/execution';

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
  audioName?: string | null;
  audioDataUrl?: string | null;
  audioDurationMillis?: number | null;
  pending?: boolean;
  action?: {
    draft: AssistantActionDraft;
    state: 'pending' | 'running' | 'done';
    resultMessage?: string | null;
    errorMessage?: string | null;
  } | null;
};

const createLocalId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const formatDraftQuantity = (quantity: number, unit?: string | null): string => `${quantity}${unit ? ` ${unit}` : ''}`;
const formatServiceDraftPrice = (unitPrice?: number | null, basePrice?: number | null): string => {
  if (unitPrice != null && unitPrice > 0) return formatCurrencyArs(unitPrice);
  if (basePrice != null && basePrice > 0) return formatCurrencyArs(basePrice);
  return 'Catalogo o $0';
};
const formatMaterialDraftPrice = (unitPrice?: number | null, hasStore = false): string => {
  if (unitPrice != null && unitPrice > 0) return formatCurrencyArs(unitPrice);
  return hasStore ? 'Costo segun tienda' : 'Costo a definir';
};
const formatStorePriceDraftPrice = (price?: number | null): string =>
  price != null && price > 0 ? formatCurrencyArs(price) : 'Precio pendiente';

export default function AssistantScreen() {
  const theme = useAppTheme();
  const toast = useAppToast();
  const scrollRef = useRef<ScrollView | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [pendingAudio, setPendingAudio] = useState<PendingAssistantAudio | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDurationMillis, setRecordingDurationMillis] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const saveStore = useSaveStore();
  const saveItem = useSaveItem();
  const saveService = useSaveService();
  const saveQuote = useSaveQuote();
  const createPrice = useCreatePrice();
  const addQuoteMaterialItem = useAddQuoteMaterialItem();
  const addQuoteServiceItem = useAddQuoteServiceItem();
  const createAppointment = useCreateAppointment();
  const upsertQuoteAppointment = useUpsertQuoteAppointment();

  const canSend = input.trim().length > 0 || pendingImage != null || pendingAudio != null;
  const hasRunningAction = messages.some((message) => message.action?.state === 'running');
  const activeIncompleteDraftMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.action?.state === 'pending' && needsAssistantActionFollowUp(message.action.draft));
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [isSending, messages.length]);

  useEffect(
    () => () => {
      const activeRecording = recordingRef.current;
      if (!activeRecording) return;
      recordingRef.current = null;
      void activeRecording.stopAndUnloadAsync().catch(() => {});
      void resetAudioModeAfterRecording().catch(() => {});
    },
    [],
  );

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

  const discardAudioRecording = async () => {
    const activeRecording = recordingRef.current;
    recordingRef.current = null;
    setIsRecordingAudio(false);
    setRecordingDurationMillis(0);

    if (!activeRecording) {
      await resetAudioModeAfterRecording().catch(() => {});
      return;
    }

    try {
      await activeRecording.stopAndUnloadAsync().catch(() => {});
    } finally {
      await resetAudioModeAfterRecording().catch(() => {});
    }
  };

  const clearConversation = async () => {
    if (recordingRef.current) {
      await discardAudioRecording();
    }
    setMessages([]);
    setInput('');
    setPendingImage(null);
    setPendingAudio(null);
    toast.success('Conversacion reiniciada.');
  };

  const requestConversationReset = () => {
    if (messages.length === 0 && !pendingImage && !pendingAudio && !input && !isRecordingAudio) return;
    setShowResetDialog(true);
  };

  const startAudioRecording = useCallback(async () => {
    if (isRecordingAudio || isSending) return;

    try {
      await ensureAssistantAudioPermission();
      await configureAudioModeForRecording();
      setPendingAudio(null);
      setRecordingDurationMillis(0);

      const { recording } = await Audio.Recording.createAsync(
        ASSISTANT_RECORDING_OPTIONS,
        (status) => {
          setRecordingDurationMillis(status.durationMillis ?? 0);
        },
        250,
      );

      recordingRef.current = recording;
      setIsRecordingAudio(true);
    } catch (error) {
      await resetAudioModeAfterRecording().catch(() => {});
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar la grabacion.');
    }
  }, [isRecordingAudio, isSending, toast]);

  const stopAudioRecording = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording) return;

    recordingRef.current = null;
    setIsRecordingAudio(false);

    try {
      const recorded = await finalizeAssistantRecording(activeRecording, recordingDurationMillis);
      setPendingAudio(recorded);
      setRecordingDurationMillis(recorded.durationMillis);
      toast.success('Audio adjuntado.');
    } catch (error) {
      setRecordingDurationMillis(0);
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la grabacion.');
    }
  }, [recordingDurationMillis, toast]);

  useEffect(() => {
    if (!isRecordingAudio || recordingDurationMillis < ASSISTANT_AUDIO_MAX_DURATION_MS) return;
    void stopAudioRecording();
  }, [isRecordingAudio, recordingDurationMillis, stopAudioRecording]);

  const toggleAudioRecording = async () => {
    if (isRecordingAudio) {
      await stopAudioRecording();
      return;
    }

    await startAudioRecording();
  };

  const confirmAction = async (messageId: string) => {
    const targetMessage = messages.find((message) => message.id === messageId);
    const targetAction = targetMessage?.action?.draft;

    if (!targetAction) return;
    const reviewedAction = await validateAssistantActionDraft(targetAction);

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId && message.action
          ? {
              ...message,
              action: {
                ...message.action,
                draft: reviewedAction,
                errorMessage: null,
              },
            }
          : message,
      ),
    );

    if (!isAssistantActionExecutable(reviewedAction)) {
      toast.error('La accion necesita datos mas claros antes de confirmarla.');
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId && message.action
          ? {
              ...message,
              action: {
                ...message.action,
                state: 'running',
                errorMessage: null,
              },
            }
          : message,
      ),
    );

    try {
      const successMessage = await executeAssistantActionDraft(reviewedAction, {
        saveStore: saveStore.mutateAsync,
        saveItem: saveItem.mutateAsync,
        saveService: saveService.mutateAsync,
        saveQuote: saveQuote.mutateAsync,
        addQuoteMaterialItem: addQuoteMaterialItem.mutateAsync,
        addQuoteServiceItem: addQuoteServiceItem.mutateAsync,
        createAppointment: createAppointment.mutateAsync,
        upsertQuoteAppointment: upsertQuoteAppointment.mutateAsync,
        createPriceRecord: createPrice.mutateAsync,
      });
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId && message.action
            ? {
                ...message,
                action: {
                  ...message.action,
                  state: 'done',
                  resultMessage: successMessage,
                  errorMessage: null,
                },
              }
            : message,
        ),
      );
      toast.success(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo ejecutar la accion propuesta.';
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId && item.action
            ? {
                ...item,
                action: {
                  ...item.action,
                  state: 'pending',
                  errorMessage: message,
                },
              }
            : item,
        ),
      );
      toast.error(message);
    }
  };

  const submit = async () => {
    if (!canSend || isSending) return;

    const text = input.trim();
    const image = pendingImage;
    const audio = pendingAudio;
    const pendingAssistantId = createLocalId('assistant-pending');
    const activePendingActionMessageId = activeIncompleteDraftMessage?.id ?? null;
    const pendingActionContext =
      activeIncompleteDraftMessage?.action != null ? serializeAssistantActionDraft(activeIncompleteDraftMessage.action.draft) : null;
    const fallbackText =
      image && audio ? 'Imagen y audio adjuntos' : image ? 'Imagen adjunta' : audio ? 'Audio adjunto' : '';

    const userMessage: ChatMessage = {
      id: createLocalId('user'),
      role: 'user',
      text: text || fallbackText,
      imageUri: image?.uri ?? null,
      imageDataUrl: image?.dataUrl ?? null,
      audioName: audio?.name ?? null,
      audioDataUrl: audio?.dataUrl ?? null,
      audioDurationMillis: audio?.durationMillis ?? null,
    };
    const history: AssistantHistoryMessage[] = [...messages.filter((message) => !message.pending), userMessage].map((message) => ({
      role: message.role,
      text: message.text,
      imageDataUrl: message.role === 'user' ? message.imageDataUrl ?? null : null,
      audioDataUrl: message.role === 'user' ? message.audioDataUrl ?? null : null,
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
    setPendingAudio(null);
    setRecordingDurationMillis(0);
    setIsSending(true);

    try {
      const reply = await sendAssistantMessage({
        history,
        context: {
          currentDate: formatIsoDate(new Date()),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        },
        pendingAction: pendingActionContext,
      });
      const normalizedAction = normalizeAssistantAction(reply.action);
      const reviewedAction = normalizedAction ? await validateAssistantActionDraft(normalizedAction) : null;
      setMessages((current) => {
        const withoutPlaceholder = current.filter((message) => message.id !== pendingAssistantId);

        if (activePendingActionMessageId && reviewedAction) {
          return withoutPlaceholder.map((message) =>
            message.id === activePendingActionMessageId
              ? {
                  ...message,
                  text: reply.text,
                  action: {
                    draft: reviewedAction,
                    state: 'pending',
                    errorMessage: null,
                    resultMessage: null,
                  },
                }
              : message,
          );
        }

        return [
          ...withoutPlaceholder,
          {
            id: createLocalId('assistant'),
            role: 'assistant',
            text: reply.text,
            action: reviewedAction
              ? {
                  draft: reviewedAction,
                  state: 'pending',
                }
              : null,
          },
        ];
      });
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
          <Text variant="headlineSmall" style={{ color: theme.colors.onSurface }}>
            Asistente AI
          </Text>
          <IconButton
            icon="refresh"
            size={18}
            mode="contained-tonal"
            containerColor={theme.colors.softBlue}
            iconColor={theme.colors.primary}
            onPress={requestConversationReset}
            disabled={messages.length === 0 && !pendingImage && !pendingAudio && !input && !isRecordingAudio}
            accessibilityLabel="Nueva conversacion"
          />
        </View>

        {messages.length === 0 ? (
          <Card mode="outlined" style={[styles.emptyCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                Todavia no hay mensajes
              </Text>
              <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>Proba con una consulta tecnica, una foto o un audio corto para analizar.</Text>
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
                <View style={styles.messageStack}>
                  <Card
                    mode="outlined"
                    style={[
                      styles.messageBubble,
                      message.role === 'user'
                        ? [styles.userBubble, { backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlueStrong }]
                        : [styles.assistantBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }],
                    ]}
                  >
                    <Card.Content style={styles.messageContent}>
                      {message.imageUri ? <Image source={{ uri: message.imageUri }} style={styles.messageImage} /> : null}
                      {message.audioName ? (
                        <View style={[styles.audioAttachmentRow, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderSoft }]}>
                          <Text style={[styles.audioAttachmentIcon, { color: theme.colors.primary }]}>Audio</Text>
                          <Text style={[styles.audioAttachmentText, { color: theme.colors.onSurface }]}>
                            {message.audioName}
                            {message.audioDurationMillis ? ` - ${formatAssistantAudioDuration(message.audioDurationMillis)}` : ''}
                          </Text>
                        </View>
                      ) : null}
                      {message.pending ? (
                        <View style={styles.pendingRow}>
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                          <Text style={[styles.pendingText, { color: theme.colors.textMuted }]}>Pensando respuesta...</Text>
                        </View>
                      ) : (
                        <Text
                          selectable={!message.pending && message.role === 'assistant'}
                          selectionColor={theme.colors.primary}
                          style={[styles.messageText, { color: message.role === 'user' ? theme.colors.titleOnSoft : theme.colors.onSurface }]}
                        >
                          {message.text}
                        </Text>
                      )}
                    </Card.Content>
                  </Card>

                  {message.role === 'assistant' && message.action ? (
                    <Card mode="outlined" style={[styles.actionCard, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderSoft }]}>
                      <Card.Content style={styles.actionContent}>
                        <View style={styles.actionHeaderRow}>
                          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                            {getAssistantActionTypeLabel(message.action.draft)}
                          </Text>
                          {message.action.state === 'done' ? (
                            <Text style={[styles.actionStatus, { color: theme.colors.toastSuccessText }]}>Hecho</Text>
                          ) : message.action.state === 'running' ? (
                            <Text style={[styles.actionStatus, { color: theme.colors.textMuted }]}>Ejecutando...</Text>
                          ) : null}
                        </View>

                        <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                          {message.action.draft.summary}
                        </Text>

                        {getAssistantActionDetails(message.action.draft).map((detail) => (
                          <View key={`${message.id}-${detail.label}`} style={styles.actionDetailRow}>
                            <Text style={[styles.actionDetailLabel, { color: theme.colors.textMuted }]}>{detail.label}</Text>
                            <Text style={[styles.actionDetailValue, { color: theme.colors.onSurface }]}>{detail.value}</Text>
                          </View>
                        ))}

                        {message.action.draft.kind === 'create_job'
                          ? (() => {
                              const jobPayload = message.action.draft.payload;

                              return (
                                <>
                                  {jobPayload.services.length > 0 ? (
                                    <View
                                      style={[
                                        styles.actionPreviewBlock,
                                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                                      ]}
                                    >
                                      <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                                        Servicios del trabajo
                                      </Text>
                                      {jobPayload.services.map((service, index) => (
                                        <View key={`${message.id}-service-${service.name}-${index}`} style={styles.actionPreviewRow}>
                                          <View style={styles.actionPreviewCopy}>
                                            <Text style={[styles.actionPreviewName, { color: theme.colors.onSurface }]}>{service.name}</Text>
                                            <Text style={[styles.actionPreviewSecondary, { color: theme.colors.textMuted }]}>
                                              {formatDraftQuantity(service.quantity)}
                                              {service.category ? ` - ${service.category}` : ''}
                                            </Text>
                                          </View>
                                          <Text style={[styles.actionPreviewMeta, { color: theme.colors.onSurface }]}>
                                            {formatServiceDraftPrice(service.unit_price, service.base_price)}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  ) : null}

                                  {jobPayload.materials.length > 0 ? (
                                    <View
                                      style={[
                                        styles.actionPreviewBlock,
                                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                                      ]}
                                    >
                                      <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                                        Materiales del trabajo
                                      </Text>
                                      {jobPayload.materials.map((material, index) => (
                                        <View key={`${message.id}-material-${material.name}-${index}`} style={styles.actionPreviewRow}>
                                          <View style={styles.actionPreviewCopy}>
                                            <Text style={[styles.actionPreviewName, { color: theme.colors.onSurface }]}>{material.name}</Text>
                                            <Text style={[styles.actionPreviewSecondary, { color: theme.colors.textMuted }]}>
                                              {formatDraftQuantity(material.quantity, material.unit)}
                                              {jobPayload.source_store?.name ? ` - ${jobPayload.source_store.name}` : ''}
                                              {jobPayload.default_material_margin_percent != null
                                                ? ` - margen ${formatPercent(jobPayload.default_material_margin_percent)}`
                                                : ''}
                                            </Text>
                                          </View>
                                          <Text style={[styles.actionPreviewMeta, { color: theme.colors.onSurface }]}>
                                            {formatMaterialDraftPrice(material.unit_price, Boolean(jobPayload.source_store?.name))}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  ) : null}
                                </>
                              );
                            })()
                          : null}

                        {message.action.draft.kind === 'create_store_price_batch'
                          ? (() => {
                              const storePricePayload = message.action.draft.payload;

                              return (
                                <View style={[styles.actionPreviewBlock, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
                                  <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                                    Materiales para la tienda
                                  </Text>
                                  {storePricePayload.items.map((item, index) => (
                                    <View key={`${message.id}-store-price-${item.name}-${index}`} style={styles.actionPreviewRow}>
                                      <View style={styles.actionPreviewCopy}>
                                        <Text style={[styles.actionPreviewName, { color: theme.colors.onSurface }]}>{item.name}</Text>
                                        <Text style={[styles.actionPreviewSecondary, { color: theme.colors.textMuted }]}>
                                          {storePricePayload.store?.name || 'Tienda pendiente'}
                                          {item.quantity_reference ? ` - ${item.quantity_reference}` : ''}
                                        </Text>
                                      </View>
                                      <Text style={[styles.actionPreviewMeta, { color: theme.colors.onSurface }]}>
                                        {formatStorePriceDraftPrice(item.price)}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              );
                            })()
                          : null}

                        {message.action.draft.hints.length > 0 ? (
                          <View style={[styles.actionInfoBox, { backgroundColor: theme.colors.softYellow, borderColor: theme.colors.borderSoft }]}>
                            {message.action.draft.hints.map((hint) => (
                              <Text key={`${message.id}-${hint}`} style={[styles.actionInfoText, { color: theme.colors.onSurface }]}>
                                {hint}
                              </Text>
                            ))}
                          </View>
                        ) : null}

                        {message.action.draft.problems.length > 0 ? (
                          <View style={[styles.actionProblemBox, { backgroundColor: theme.colors.toastErrorSurface, borderColor: theme.colors.error }]}>
                            {message.action.draft.problems.map((problem) => (
                              <Text key={`${message.id}-${problem}`} style={[styles.actionProblemText, { color: theme.colors.toastErrorText }]}>
                                {problem}
                              </Text>
                            ))}
                          </View>
                        ) : null}

                        {message.action.resultMessage ? (
                          <View style={[styles.actionInfoBox, { backgroundColor: theme.colors.toastSuccessSurface, borderColor: theme.colors.primary }]}>
                            <Text style={[styles.actionInfoText, { color: theme.colors.toastSuccessText }]}>{message.action.resultMessage}</Text>
                          </View>
                        ) : null}

                        {message.action.errorMessage ? (
                          <View style={[styles.actionProblemBox, { backgroundColor: theme.colors.toastErrorSurface, borderColor: theme.colors.error }]}>
                            <Text style={[styles.actionProblemText, { color: theme.colors.toastErrorText }]}>{message.action.errorMessage}</Text>
                          </View>
                        ) : null}

                        {message.action.state !== 'done' ? (
                          <Button
                            mode="contained"
                            icon="check"
                            onPress={() => confirmAction(message.id)}
                            disabled={!isAssistantActionExecutable(message.action.draft) || hasRunningAction}
                            loading={message.action.state === 'running'}
                            style={styles.actionButton}
                          >
                            Confirmar
                          </Button>
                        ) : null}
                      </Card.Content>
                    </Card>
                  ) : null}
                </View>
              </View>
            ))
          ) : null}
        </ScrollView>

        <Card mode="outlined" style={[styles.composerCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
          <Card.Content style={styles.composerContent}>
            {pendingImage ? (
              <View style={[styles.previewRow, { backgroundColor: theme.colors.softGreen, borderColor: theme.colors.softGreenStrong }]}>
                <Image source={{ uri: pendingImage.uri }} style={styles.previewImage} />
                <View style={styles.previewCopy}>
                  <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>{pendingImage.name}</Text>
                  <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>Se enviara con el proximo mensaje.</Text>
                </View>
                <IconButton icon="close" size={18} onPress={() => setPendingImage(null)} />
              </View>
            ) : null}

            {pendingAudio ? (
              <View style={[styles.previewRow, { backgroundColor: theme.colors.softYellow, borderColor: theme.colors.softYellowStrong }]}>
                <View style={[styles.audioPreviewBadge, { backgroundColor: theme.colors.softBlue }]}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>MIC</Text>
                </View>
                <View style={styles.previewCopy}>
                  <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>{pendingAudio.name}</Text>
                  <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                    Duracion {formatAssistantAudioDuration(pendingAudio.durationMillis)}. Se enviara con el proximo mensaje.
                  </Text>
                </View>
                <IconButton icon="close" size={18} onPress={() => setPendingAudio(null)} />
              </View>
            ) : null}

            {isRecordingAudio ? (
              <View style={[styles.recordingBanner, { backgroundColor: theme.colors.toastErrorSurface, borderColor: theme.colors.error }]}>
                <Text style={[styles.recordingText, { color: theme.colors.toastErrorText }]}>
                  Grabando audio... {formatAssistantAudioDuration(recordingDurationMillis)} / {formatAssistantAudioDuration(ASSISTANT_AUDIO_MAX_DURATION_MS)}
                </Text>
              </View>
            ) : null}

            {activeIncompleteDraftMessage?.action ? (
              <View style={[styles.recordingBanner, { backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlueStrong }]}>
                <Text style={[styles.recordingText, { color: theme.colors.primary }]}>
                  Hay un borrador pendiente. Responde con el dato faltante y se actualiza sobre el mismo contexto.
                </Text>
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
              contentStyle={styles.inputContent}
              placeholder="Escribi tu consulta para el asistente"
              textColor={theme.colors.onSurface}
              placeholderTextColor={theme.colors.textMuted}
            />

            <View style={styles.composerActions}>
              <Button
                mode="outlined"
                icon="image-outline"
                onPress={pickImage}
                disabled={isSending || isRecordingAudio}
                style={[styles.attachButton, { borderColor: theme.colors.borderSoft }]}
              >
                Imagen
              </Button>
              <Button
                mode={isRecordingAudio ? 'contained-tonal' : 'outlined'}
                icon={isRecordingAudio ? 'stop-circle-outline' : 'microphone-outline'}
                onPress={toggleAudioRecording}
                disabled={isSending}
                style={[styles.attachButton, { borderColor: theme.colors.borderSoft }]}
              >
                {isRecordingAudio ? 'Detener' : 'Audio'}
              </Button>
              <Button
                mode="contained"
                icon="send"
                onPress={submit}
                loading={isSending}
                disabled={!canSend || isSending || isRecordingAudio}
                style={styles.sendButton}
              >
                Enviar
              </Button>
            </View>
          </Card.Content>
        </Card>

        <AppDialog visible={showResetDialog} onDismiss={() => setShowResetDialog(false)}>
          <Dialog.Title style={{ color: theme.colors.onSurface }}>Nueva conversacion</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurface }}>Se van a borrar los mensajes actuales. Queres continuar?</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowResetDialog(false)}>Cancelar</Button>
            <Button
              onPress={() => {
                setShowResetDialog(false);
                void clearConversation();
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
  messageStack: {
    width: '88%',
    gap: 8,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    width: '100%',
    borderRadius: 16,
  },
  userBubble: {},
  assistantBubble: {},
  actionCard: {
    borderRadius: 16,
  },
  actionContent: {
    gap: 10,
    paddingVertical: 10,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  actionStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionDetailLabel: {
    flex: 1,
    fontSize: 13,
  },
  actionDetailValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
  actionInfoBox: {
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionInfoText: {
    lineHeight: 18,
  },
  actionProblemBox: {
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionProblemText: {
    lineHeight: 18,
    fontWeight: '600',
  },
  actionButton: {
    borderRadius: 12,
  },
  actionPreviewBlock: {
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionPreviewCopy: {
    flex: 1,
    gap: 2,
  },
  actionPreviewName: {
    fontWeight: '600',
  },
  actionPreviewSecondary: {
    lineHeight: 18,
  },
  actionPreviewMeta: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
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
    backgroundColor: '#CED8E3',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  audioAttachmentIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  audioAttachmentText: {
    flex: 1,
  },
  pendingText: {},
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
    borderWidth: 1,
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
  audioPreviewBadge: {
    width: 54,
    height: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: {
    flex: 1,
    gap: 2,
  },
  recordingBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  recordingText: {
    fontWeight: '700',
  },
  inputOutline: {
    borderRadius: 12,
  },
  inputContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  composerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attachButton: {
    flex: 1,
    minWidth: 110,
    borderRadius: 12,
  },
  sendButton: {
    flexBasis: '100%',
    borderRadius: 12,
  },
  dialogActions: {
    justifyContent: 'center',
    gap: 8,
  },
});
