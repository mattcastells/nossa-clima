import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export interface PendingAssistantAudio {
  uri: string;
  dataUrl: string;
  name: string;
  durationMillis: number;
  mimeType: string;
}

export const ASSISTANT_AUDIO_MIME_TYPE = 'audio/aac';
export const ASSISTANT_AUDIO_MAX_DURATION_MS = 60_000;
const MIN_VALID_DURATION_MS = 600;

export const ASSISTANT_RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.aac',
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    maxFileSize: 2_000_000,
  },
  ios: {
    extension: '.aac',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

export const ensureAssistantAudioPermission = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    throw new Error('La grabacion de audio no esta disponible en web.');
  }

  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Hace falta permiso para usar el microfono.');
  }
};

export const configureAudioModeForRecording = async (): Promise<void> => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};

export const resetAudioModeAfterRecording = async (): Promise<void> => {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};

export const formatAssistantAudioDuration = (durationMillis: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const finalizeAssistantRecording = async (
  recording: Audio.Recording,
  durationMillis: number,
): Promise<PendingAssistantAudio> => {
  try {
    await recording.stopAndUnloadAsync();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('E_AUDIO_NODATA')) {
      throw new Error('La grabacion fue demasiado corta. Proba de nuevo.');
    }
    throw error;
  } finally {
    await resetAudioModeAfterRecording().catch(() => {});
  }

  const uri = recording.getURI();
  if (!uri) {
    throw new Error('No se pudo recuperar el audio grabado.');
  }

  if (durationMillis < MIN_VALID_DURATION_MS) {
    throw new Error('La grabacion fue demasiado corta. Proba de nuevo.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('No se pudo leer el audio grabado.');
  }

  return {
    uri,
    dataUrl: `data:${ASSISTANT_AUDIO_MIME_TYPE};base64,${base64}`,
    name: `Audio ${formatAssistantAudioDuration(durationMillis)}`,
    durationMillis,
    mimeType: ASSISTANT_AUDIO_MIME_TYPE,
  };
};
